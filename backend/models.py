"""Pydantic models for GUI Blox. UUID string ids; datetimes stored as ISO strings."""
import uuid
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from security import now_utc, iso


def new_id() -> str:
    return str(uuid.uuid4())


# ---------- Auth ----------
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    turnstile_token: Optional[str] = None
    fingerprint: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# ---------- User ----------
class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    email_verified: bool
    plan: str
    credits: int
    suspended: bool
    created_at: str


def new_user_doc(email: str, password_hash: str, fingerprint: Optional[str], ip: Optional[str], code: str) -> dict:
    return {
        "id": new_id(),
        "email": email.lower(),
        "password_hash": password_hash,
        "email_verified": False,
        "verification_code": code,
        "plan": "free",
        "credits": 0,          # activated to 5 after verification
        "free_credit_granted": False,
        "suspended": False,
        "fingerprint": fingerprint,
        "signup_ip": ip,
        "created_at": iso(now_utc()),
    }


# ---------- API Keys ----------
class CreateKeyRequest(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    ip_allowlist: List[str] = []


class UpdateKeyRequest(BaseModel):
    ip_allowlist: List[str] = []


# ---------- Workspace / Commands ----------
class PromptRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)
    context: Optional[Dict[str, Any]] = None


class BridgeResult(BaseModel):
    command_id: str
    status: str            # "done" | "error"
    logs: List[str] = []
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class BridgeContext(BaseModel):
    selection: List[str] = []
    open_script: Optional[str] = None


class BridgeLog(BaseModel):
    level: str = "info"     # info | warn | error
    message: str
    source: str = "studio"


# ---------- Projects ----------
class ProjectRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    data: Dict[str, Any] = {}
