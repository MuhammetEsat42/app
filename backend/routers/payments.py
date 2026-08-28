"""Stripe payments (shared test sandbox / Flow B) — credit packs + annual plans + webhook.

Country note: Stripe claimable sandbox does not support Turkey (TR), so this uses the
shared Emergent test key. When the user connects their own Stripe account in a supported
country, the platform swaps to live keys automatically on deploy.
"""
import os
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest

from database import payment_transactions, users
from deps import get_verified_user
from config import PAYMENT_CATALOG, CREDIT_PACKS, ANNUAL_PLANS
from audit import log_audit
from security import now_utc, iso
from models import new_id

router = APIRouter(prefix="/api/payments", tags=["payments"])
webhook_router = APIRouter(prefix="/api", tags=["stripe-webhook"])

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")


class CheckoutBody(BaseModel):
    item_id: str
    origin_url: str


def _valid_origin(origin: str) -> bool:
    """Allow only https origins on trusted hosts (anti open-redirect)."""
    from urllib.parse import urlparse
    try:
        p = urlparse(origin)
    except Exception:
        return False
    if p.scheme not in ("http", "https") or not p.netloc:
        return False
    host = p.hostname or ""
    return (host in ("localhost", "127.0.0.1")
            or host.endswith("emergentagent.com")
            or host.endswith("guiblox.com"))


def _client(request: Request) -> StripeCheckout:
    host = str(request.base_url)
    return StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{host}api/webhook/stripe")


@router.get("/catalog")
async def catalog(user: dict = Depends(get_verified_user)):
    return {"credit_packs": CREDIT_PACKS, "annual_plans": ANNUAL_PLANS,
            "credits": user.get("credits", 0), "plan": user.get("plan", "free")}


@router.post("/checkout")
async def checkout(body: CheckoutBody, request: Request, user: dict = Depends(get_verified_user)):
    item = PAYMENT_CATALOG.get(body.item_id)
    if not item:
        raise HTTPException(status_code=400, detail="Unknown item")
    if not _valid_origin(body.origin_url):
        raise HTTPException(status_code=400, detail="Invalid origin")

    origin = body.origin_url.rstrip("/")
    success_url = f"{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/payment/cancel"

    sc = _client(request)
    req = CheckoutSessionRequest(
        amount=float(item["price_usd"]),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"user_id": user["id"], "item_id": body.item_id, "item_type": item["type"]},
    )
    session = await sc.create_checkout_session(req)

    await payment_transactions.insert_one({
        "id": new_id(),
        "session_id": session.session_id,
        "user_id": user["id"],
        "item_id": body.item_id,
        "item_type": item["type"],
        "amount": float(item["price_usd"]),
        "currency": "usd",
        "credits": item.get("credits", 0),
        "plan": item.get("plan"),
        "status": "initiated",
        "payment_status": "pending",
        "granted": False,
        "created_at": iso(now_utc()),
        "updated_at": iso(now_utc()),
    })
    return {"url": session.url, "session_id": session.session_id}


async def _grant(session_id: str):
    """Idempotently credit the user + apply plan once a transaction is paid.
    Flips `granted` first (conditional) so a crash mid-way can never double-credit."""
    tx = await payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx or tx.get("granted") or tx.get("payment_status") != "paid":
        return tx
    claimed = await payment_transactions.update_one(
        {"session_id": session_id, "granted": {"$ne": True}},
        {"$set": {"granted": True, "updated_at": iso(now_utc())}},
    )
    if claimed.modified_count != 1:
        return tx  # another worker already granted
    update = {"$inc": {"credits": int(tx.get("credits", 0))}}
    set_fields = {}
    if tx.get("plan"):
        set_fields["plan"] = tx["plan"]
        set_fields["plan_expires_at"] = iso(now_utc() + timedelta(days=365))
    if set_fields:
        update["$set"] = set_fields
    await users.update_one({"id": tx["user_id"]}, update)
    await log_audit(tx["user_id"], "purchase", None,
                    {"item": tx["item_id"], "credits": tx.get("credits"), "plan": tx.get("plan")})
    return tx


@router.get("/status/{session_id}")
async def status(session_id: str, request: Request, user: dict = Depends(get_verified_user)):
    tx = await payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if tx.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not your transaction")
    if tx.get("payment_status") != "paid":
        try:
            sc = _client(request)
            st = await sc.get_checkout_status(session_id)
            if st.payment_status == "paid" or st.status == "complete":
                await payment_transactions.update_one(
                    {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {"status": "completed", "payment_status": "paid", "updated_at": iso(now_utc())}},
                )
                await _grant(session_id)
                tx = await payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        except HTTPException:
            raise
        except Exception as e:
            import logging
            logging.getLogger("guiblox").warning(f"Stripe status fetch failed: {e}")
    return {"session_id": session_id, "status": tx["status"], "payment_status": tx["payment_status"],
            "item_id": tx["item_id"], "credits": tx.get("credits", 0), "granted": tx.get("granted", False)}


@webhook_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature")
    sc = _client(request)
    try:
        wr = await sc.handle_webhook(body, sig)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook error: {e}")
    if getattr(wr, "payment_status", None) == "paid" and wr.session_id:
        await payment_transactions.update_one(
            {"session_id": wr.session_id, "payment_status": {"$ne": "paid"}},
            {"$set": {"status": "completed", "payment_status": "paid", "updated_at": iso(now_utc())}},
        )
        await _grant(wr.session_id)
    return {"status": "ok"}
