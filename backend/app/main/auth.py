import hmac
import re
import secrets
import time

from flask import abort, current_app, request, session
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from . import main_bp
from ..extensions import db
from ..models import Account, EmailVerificationChallenge, VerificationChallenge, WorkerProfile
from ..services.verification import (
    check_sms, digest, normalize_email, normalize_phone, reserve_quota, send_email, send_sms, verification_mode,
)

CODE_LIFETIME = 600
CODE_ATTEMPTS = 5
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128

CONTACTS = {
    "email": ("email", EmailVerificationChallenge, normalize_email, "Enter a valid email address."),
    "sms": ("phone", VerificationChallenge, normalize_phone, "Enter a Pakistani mobile number, like 03001234567."),
}


def json_body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        abort(400, description="Send the requested information and try again.")
    return data


def current_account(role=None):
    account = db.session.get(Account, session.get("account_id")) if session.get("account_id") else None
    if not account:
        abort(401, description="Sign in to continue.")
    if role and account.role != role:
        abort(403, description="This action is available to the other account type.")
    return account


def profile_for(account):
    return db.session.scalar(db.select(WorkerProfile).where(WorkerProfile.user_id == account.id))


def session_data():
    csrf = session.get("csrf_token")
    if not csrf:
        csrf = session["csrf_token"] = secrets.token_urlsafe(32)
    account_id = session.get("account_id")
    account = db.session.get(Account, account_id) if account_id else None
    profile = profile_for(account) if account and account.role == "worker" else None
    mode = verification_mode()
    return {
        "csrf_token": csrf,
        "user": {
            "role": account.role, "profile_name": profile.name if profile else None,
            "profile_complete": profile is not None, "verification": account.verification,
        } if account else None,
        "demo_auth": mode == "demo",
        "verification_mode": mode,
        "verification_modes": {"email": verification_mode("email"), "sms": mode},
        "demo_data": current_app.config["SEED_SAMPLE_DATA"],
        "voice_profile": bool(current_app.config.get("GROQ_API_KEY") or current_app.config["GEMINI_API_KEY"]),
    }


@main_bp.before_request
def verify_csrf():
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        expected = session.get("csrf_token")
        if not expected or not hmac.compare_digest(expected.encode(), request.headers.get("X-CSRF-Token", "").encode()):
            abort(403, description="This page’s session expired. Refresh and try again.")


@main_bp.get("/session")
def get_session():
    return session_data()


def start_session(account):
    account_id = account.id
    session.clear()
    session["account_id"] = account_id
    session.permanent = True
    return session_data()


@main_bp.post("/auth/password")
def authenticate_password():
    data = json_body()
    email = normalize_email(data.get("email"))
    password = data.get("password")
    intent, role = data.get("intent"), data.get("role")
    if not email:
        abort(400, description="Enter a valid email address.")
    if intent not in ("register", "login") or (intent == "register" and role not in ("customer", "worker")):
        abort(400, description="Choose to sign in or pick an account type to register.")
    if not isinstance(password, str) or not PASSWORD_MIN_LENGTH <= len(password) <= PASSWORD_MAX_LENGTH:
        abort(400, description="Use a password between 8 and 128 characters.")
    reserve_quota("password-ip", request.remote_addr or "unknown", 30, 600)
    reserve_quota("password-email", email, 10, 600)

    if intent == "login":
        account = db.session.scalar(db.select(Account).where(Account.email == email))
        if not account or not account.password_hash or not check_password_hash(account.password_hash, password):
            abort(401, description="Email or password is incorrect.")
        return start_session(account)

    account = Account(email=email, password_hash=generate_password_hash(password), role=role, verification="none")
    db.session.add(account)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        abort(409, description="An account already exists for this email. Sign in instead.")
    return start_session(account), 201


@main_bp.post("/auth/code")
def issue_code():
    data = json_body()
    channel = data.get("channel", "sms")
    if not isinstance(channel, str) or channel not in CONTACTS:
        abort(400, description="Choose email or SMS for your code.")
    field, challenge_model, normalize, invalid_contact = CONTACTS[channel]
    address = normalize(data.get(field))
    intent, role = data.get("intent"), data.get("role")
    if not address:
        abort(400, description=invalid_contact)
    if intent not in ("register", "login") or (intent == "register" and role not in ("customer", "worker")):
        abort(400, description="Choose to sign in or pick an account type to register.")

    method = verification_mode(channel)
    if method == "unavailable":
        abort(503, description=(
            "Email sign-in is unavailable right now. Please try again later." if channel == "email"
            else "SMS sign-in is unavailable right now. Please try again later."
        ))

    reserve_quota("issue-ip", request.remote_addr or "unknown", 30, 600)
    now = int(time.time())
    existing = db.session.get(challenge_model, address)
    if existing and existing.issued_at > now - 30:
        abort(429, description="Wait 30 seconds before requesting another code.")
    reserve_quota(f"issue-{field}-hour", address, 8, 3600)
    token = secrets.token_hex(16)
    code = f"{secrets.randbelow(1000000):06d}" if method != "sms" else None
    values = {
        "token": token, "intent": intent, "role": role if intent == "register" else None,
        "method": method, "digest": digest(address, token, code) if code else None,
        "issued_at": now, "attempts": 0, "used": False,
    }
    try:
        if existing:
            issued = db.session.execute(update(challenge_model).where(
                getattr(challenge_model, field) == address, challenge_model.issued_at <= now - 30,
            ).values(**values))
            if not issued.rowcount:
                abort(429, description="A code was just requested. Please wait before trying again.")
        else:
            db.session.add(challenge_model(**{field: address}, **values))
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        abort(429, description="A code was just requested. Please wait before trying again.")
    if method == "sms":
        send_sms(address)
    elif method == "email":
        send_email(address, code, token, CODE_LIFETIME)
    session["verification"] = {"channel": channel, "token": token}
    return {"expires_in": CODE_LIFETIME, "demo_code": code if method == "demo" else None}, 201


@main_bp.post("/auth/verify")
def verify_code():
    code = json_body().get("code")
    if not isinstance(code, str) or not re.fullmatch(r"[0-9]{6}", code):
        abort(400, description="Enter the six-digit code.")
    pending = session.get("verification")
    if not pending:
        abort(400, description="Request a new verification code.")
    channel = pending.get("channel", "sms")
    field, challenge_model, _, _ = CONTACTS[channel]
    token = pending["token"]
    reserve_quota("verify-ip", request.remote_addr or "unknown", 60, 600)
    cutoff = int(time.time()) - CODE_LIFETIME
    valid = (
        challenge_model.token == token,
        challenge_model.issued_at > cutoff, challenge_model.used.is_(False),
    )
    reserved = db.session.execute(update(challenge_model).where(
        *valid, challenge_model.attempts < CODE_ATTEMPTS,
    ).values(attempts=challenge_model.attempts + 1))
    if not reserved.rowcount:
        abort(400, description="That code is expired or has too many attempts. Request a new one.")
    db.session.commit()

    challenge = db.session.scalar(db.select(challenge_model).where(challenge_model.token == token))
    if not challenge:
        abort(400, description="A newer code was requested. Use the latest code.")
    address = getattr(challenge, field)
    approved = (
        check_sms(address, code) if challenge.method == "sms"
        else hmac.compare_digest(challenge.digest, digest(address, token, code))
    )
    if not approved:
        abort(400, description="That code didn’t match. Check the six digits and try again.")

    consumed = db.session.execute(update(challenge_model).where(*valid).values(used=True))
    if not consumed.rowcount:
        abort(409, description="This code was already used. Request a new code.")
    account = db.session.scalar(db.select(Account).where(getattr(Account, field) == address))
    if account and account.password_hash:
        db.session.commit()
        abort(403, description="This account uses a password. Sign in with your password.")
    if account and account.verification in ("sms", "email") and challenge.method != account.verification:
        db.session.commit()
        abort(403, description=(
            "This account requires email verification." if account.verification == "email"
            else "This account requires SMS verification."
        ))
    if account and challenge.intent == "register" and account.role != challenge.role:
        db.session.commit()
        abort(409, description=(
            "This email already has an account of another type. Sign in instead." if channel == "email"
            else "This phone already has an account of another type. Sign in instead."
        ))
    if account is None and challenge.intent == "login":
        db.session.commit()
        abort(404, description=(
            "There’s no account for this email. Choose Create account first." if channel == "email"
            else "There’s no account for this number. Choose Create account first."
        ))
    if account is None:
        account = Account(**{field: address}, role=challenge.role, verification=challenge.method)
        db.session.add(account)
    elif challenge.method != "demo":
        account.verification = challenge.method
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        abort(409, description=(
            "An account already exists for this email. Sign in instead." if channel == "email"
            else "An account already exists for this number. Sign in instead."
        ))
    return start_session(account)


@main_bp.post("/auth/logout")
def sign_out():
    session.clear()
    return session_data()
