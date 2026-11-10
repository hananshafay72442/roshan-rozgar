import hmac
import re
import secrets
import time

from flask import abort, current_app, request, session
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError

from . import main_bp
from ..extensions import db
from ..models import Account, VerificationChallenge, WorkerProfile
from ..services.verification import check_sms, digest, normalize_phone, reserve_quota, send_sms, twilio_available

CODE_LIFETIME = 600
CODE_ATTEMPTS = 5


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
    return {
        "csrf_token": csrf,
        "user": {
            "role": account.role, "profile_name": profile.name if profile else None,
            "profile_complete": profile is not None, "verification": account.verification,
        } if account else None,
        "demo_auth": current_app.config["DEMO_VERIFICATION"] and not twilio_available(),
        "demo_data": current_app.config["SEED_SAMPLE_DATA"],
        "voice_profile": bool(current_app.config["GEMINI_API_KEY"]),
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


@main_bp.post("/auth/code")
def issue_code():
    data = json_body()
    phone = normalize_phone(data.get("phone"))
    intent, role = data.get("intent"), data.get("role")
    if not phone:
        abort(400, description="Enter a Pakistani mobile number, like 03001234567.")
    if intent not in ("register", "login") or (intent == "register" and role not in ("customer", "worker")):
        abort(400, description="Choose to sign in or pick an account type to register.")

    method = "sms" if twilio_available() else "demo"
    if method == "demo" and not current_app.config["DEMO_VERIFICATION"]:
        abort(503, description="Phone verification is not configured on this server.")

    reserve_quota("issue-ip", request.remote_addr or "unknown", 30, 600)
    now = int(time.time())
    existing = db.session.get(VerificationChallenge, phone)
    if existing and existing.issued_at > now - 30:
        abort(429, description="Wait 30 seconds before requesting another code.")
    reserve_quota("issue-phone-hour", phone, 8, 3600)
    token = secrets.token_hex(16)
    code = f"{secrets.randbelow(1000000):06d}" if method == "demo" else None
    values = {
        "token": token, "intent": intent, "role": role if intent == "register" else None,
        "method": method, "digest": digest(phone, token, code) if code else None,
        "issued_at": now, "attempts": 0, "used": False,
    }
    try:
        if existing:
            issued = db.session.execute(update(VerificationChallenge).where(
                VerificationChallenge.phone == phone, VerificationChallenge.issued_at <= now - 30,
            ).values(**values))
            if not issued.rowcount:
                abort(429, description="A code was just requested. Please wait before trying again.")
        else:
            db.session.add(VerificationChallenge(phone=phone, **values))
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        abort(429, description="A code was just requested. Please wait before trying again.")
    if method == "sms":
        send_sms(phone)
    session["verification"] = {"phone": phone, "token": token}
    return {"expires_in": CODE_LIFETIME, "demo_code": code}, 201


@main_bp.post("/auth/verify")
def verify_code():
    code = json_body().get("code")
    if not isinstance(code, str) or not re.fullmatch(r"[0-9]{6}", code):
        abort(400, description="Enter the six-digit code.")
    pending = session.get("verification")
    if not pending:
        abort(400, description="Request a new verification code.")
    phone, token = pending["phone"], pending["token"]
    reserve_quota("verify-ip", request.remote_addr or "unknown", 60, 600)
    cutoff = int(time.time()) - CODE_LIFETIME
    valid = (
        VerificationChallenge.phone == phone, VerificationChallenge.token == token,
        VerificationChallenge.issued_at > cutoff, VerificationChallenge.used.is_(False),
    )
    reserved = db.session.execute(update(VerificationChallenge).where(
        *valid, VerificationChallenge.attempts < CODE_ATTEMPTS,
    ).values(attempts=VerificationChallenge.attempts + 1))
    if not reserved.rowcount:
        abort(400, description="That code is expired or has too many attempts. Request a new one.")
    db.session.commit()

    challenge = db.session.get(VerificationChallenge, phone)
    if challenge.token != token:
        abort(400, description="A newer code was requested. Use the latest code.")
    approved = (
        check_sms(phone, code) if challenge.method == "sms"
        else hmac.compare_digest(challenge.digest, digest(phone, token, code))
    )
    if not approved:
        abort(400, description="That code didn’t match. Check the six digits and try again.")

    consumed = db.session.execute(update(VerificationChallenge).where(*valid).values(used=True))
    if not consumed.rowcount:
        abort(409, description="This code was already used. Request a new code.")
    account = db.session.scalar(db.select(Account).where(Account.phone == phone))
    if account and account.verification == "sms" and challenge.method != "sms":
        db.session.commit()
        abort(403, description="This account requires SMS verification.")
    if account and challenge.intent == "register" and account.role != challenge.role:
        db.session.commit()
        abort(409, description="This phone already has an account of another type. Sign in instead.")
    if account is None and challenge.intent == "login":
        db.session.commit()
        abort(404, description="There’s no account for this number. Choose Create account first.")
    if account is None:
        account = Account(phone=phone, role=challenge.role, verification=challenge.method)
        db.session.add(account)
    elif challenge.method == "sms":
        account.verification = "sms"
    db.session.commit()
    account_id = account.id
    session.clear()
    session["account_id"] = account_id
    session.permanent = True
    return session_data()


@main_bp.post("/auth/logout")
def sign_out():
    session.clear()
    return session_data()
