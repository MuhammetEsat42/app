"""Resend transactional email — verification codes. Non-blocking (sync SDK in a thread)."""
import os
import logging
import asyncio
import resend

logger = logging.getLogger("guiblox")

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
resend.api_key = RESEND_API_KEY


def _html(code: str) -> str:
    return f"""
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D14;padding:32px 0;font-family:Arial,Helvetica,sans-serif">
  <tr><td align="center">
    <table width="440" cellpadding="0" cellspacing="0" style="background:#13131F;border:1px solid #2a2440;border-radius:12px;padding:32px">
      <tr><td style="color:#A78BFA;font-size:20px;font-weight:bold;padding-bottom:8px">GUI Blox</td></tr>
      <tr><td style="color:#f8fafc;font-size:16px;font-weight:bold;padding-bottom:6px">Verify your email</td></tr>
      <tr><td style="color:#94a3b8;font-size:13px;padding-bottom:20px">Enter this code to activate your 5 free credits.</td></tr>
      <tr><td align="center" style="background:#0A0A0F;border:1px solid #8B5CF6;border-radius:10px;padding:16px 0;color:#A78BFA;font-size:30px;font-weight:bold;letter-spacing:8px">{code}</td></tr>
      <tr><td style="color:#64748b;font-size:11px;padding-top:20px">If you didn't request this, ignore this email.</td></tr>
    </table>
  </td></tr>
</table>"""


async def send_verification_email(email: str, code: str) -> bool:
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set; skipping email send")
        return False
    params = {
        "from": f"GUI Blox <{SENDER_EMAIL}>",
        "to": [email],
        "subject": "Your GUI Blox verification code",
        "html": _html(code),
    }
    try:
        res = await asyncio.to_thread(resend.Emails.send, params)
        rid = res.get("id") if isinstance(res, dict) else getattr(res, "id", None)
        logger.info(f"Verification email sent to {email}: id={rid}")
        return True
    except Exception as e:
        logger.error(f"Resend email failed for {email}: {e}")
        return False
