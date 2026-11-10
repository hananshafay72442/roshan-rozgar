"""Phone verification transports and database-backed request limits."""

import hashlib
import hmac
import re
import time

import httpx
from flask import abort, current_app
from sqlalchemy import delete, update
from sqlalchemy.exc import IntegrityError

from ..extensions import db
from ..models import RateBucket

DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")


def normalize_phone(value):
    if not isinstance(value, str):
        return None
    value = re.sub(r"[\s()-]", "", value.translate(DIGITS))
    if re.fullmatch(r"03[0-9]{9}", value):
        value = "+92" + value[1:]
    elif re.fullmatch(r"923[0-9]{9}", value):
        value = "+" + value
    return value if re.fullmatch(r"\+923[0-9]{9}", value) else None


def digest(*values):
    return hmac.digest(current_app.secret_key.encode(), "|".join(values).encode(), "sha256").hex()


def reserve_quota(scope, value, limit, seconds):
    window = int(time.time()) // seconds * seconds
    key = f"{scope}:{hashlib.sha256(value.encode()).hexdigest()}"
    increment = update(RateBucket).where(
        RateBucket.key == key, RateBucket.window == window, RateBucket.count < limit,
    ).values(count=RateBucket.count + 1)
    if db.session.execute(increment).rowcount:
        db.session.commit()
        return

    try:
        db.session.add(RateBucket(key=key, window=window, count=1))
        db.session.execute(delete(RateBucket).where(RateBucket.key == key, RateBucket.window < window))
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        if db.session.execute(increment).rowcount:
            db.session.commit()
            return
        db.session.rollback()
        abort(429, description="Too many attempts. Wait a little and try again.")


def twilio_available():
    return bool(current_app.config["TWILIO_VERIFY_SERVICE_SID"])


def verification_mode():
    if twilio_available():
        return "sms"
    return "demo" if current_app.config["DEMO_VERIFICATION"] else "unavailable"


def twilio_connection():
    config = current_app.config
    url = f'https://verify.twilio.com/v2/Services/{config["TWILIO_VERIFY_SERVICE_SID"]}'
    return url, (config["TWILIO_ACCOUNT_SID"], config["TWILIO_AUTH_TOKEN"])


def check_sms_service():
    if not twilio_available():
        raise RuntimeError("Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID in the backend environment.")
    url, auth = twilio_connection()
    try:
        response = httpx.get(url, auth=auth, timeout=8)
        response.raise_for_status()
        service = response.json()
    except (httpx.HTTPError, ValueError):
        raise RuntimeError("Could not verify the Twilio service. Check the credentials, Verify service SID, and network access.") from None
    if not isinstance(service, dict) or service.get("code_length") != 6:
        raise RuntimeError("Set the Twilio Verify service's code length to six digits.")


def twilio_request(action, values):
    url, auth = twilio_connection()
    try:
        response = httpx.post(
            f"{url}/{action}", auth=auth,
            data=values, timeout=8,
        )
        if action == "VerificationCheck" and response.status_code in {400, 404}:
            return False
        if response.status_code == 429:
            abort(429, description="Too many SMS attempts. Try again in a few minutes.")
        response.raise_for_status()
        return response.json().get("status") == ("approved" if action == "VerificationCheck" else "pending")
    except (httpx.HTTPError, ValueError):
        abort(503, description="SMS verification is temporarily unavailable. Please try again.")


def send_sms(phone):
    if not twilio_request("Verifications", {"To": phone, "Channel": "sms"}):
        abort(503, description="We couldn’t send an SMS code. Please try again.")


def check_sms(phone, code):
    return twilio_request("VerificationCheck", {"To": phone, "Code": code})
