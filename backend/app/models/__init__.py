from datetime import datetime, timezone

from sqlalchemy.dialects.mysql import MEDIUMBLOB
from sqlalchemy.orm import deferred

from ..extensions import db


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Account(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    phone = db.Column(db.String(16), unique=True)
    email = db.Column(db.String(254), unique=True)
    contact_phone = db.Column(db.String(16))
    password_hash = db.Column(db.String(255))
    role = db.Column(db.String(12), nullable=False)
    verification = db.Column(db.String(8), nullable=False)


class CustomerProfile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("account.id"), nullable=False, unique=True)
    name = db.Column(db.String(80), nullable=False)
    city = db.Column(db.String(24), nullable=False)
    area = db.Column(db.String(32), nullable=False)


class _CodeChallenge:
    token = db.Column(db.String(32), nullable=False, unique=True)
    intent = db.Column(db.String(8), nullable=False)
    role = db.Column(db.String(12), nullable=True)
    method = db.Column(db.String(8), nullable=False)
    digest = db.Column(db.String(64), nullable=True)
    issued_at = db.Column(db.Integer, nullable=False)
    attempts = db.Column(db.Integer, nullable=False, default=0)
    used = db.Column(db.Boolean, nullable=False, default=False)


class VerificationChallenge(_CodeChallenge, db.Model):
    phone = db.Column(db.String(16), primary_key=True)


class EmailVerificationChallenge(_CodeChallenge, db.Model):
    email = db.Column(db.String(254), primary_key=True)


class RateBucket(db.Model):
    key = db.Column(db.String(96), primary_key=True)
    window = db.Column(db.Integer, primary_key=True)
    count = db.Column(db.Integer, nullable=False)


class WorkerProfile(db.Model):
    moderation = db.Column(db.String(8), nullable=False, server_default="approved")
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("account.id"), nullable=False, unique=True)
    seed_key = db.Column(db.Integer, unique=True)
    name = db.Column(db.String(80), nullable=False)
    service_id = db.Column(db.String(24), nullable=False)
    city = db.Column(db.String(24), nullable=False)
    area = db.Column(db.String(32), nullable=False)
    experience_years = db.Column(db.Integer, nullable=False)
    taking_work = db.Column(db.Boolean, nullable=False, default=True)
    active_booking_id = db.Column(db.Integer, nullable=True)

    @property
    def available(self):
        return self.moderation == "approved" and self.taking_work and self.active_booking_id is None


class Booking(db.Model):
    moderation = db.Column(db.String(8), nullable=False, server_default="approved")
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("account.id"), nullable=False, index=True)
    worker_id = db.Column(db.Integer, db.ForeignKey("worker_profile.id"), nullable=False, index=True)
    state = db.Column(db.String(12), nullable=False, default="requested")
    quote_pkr = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utc_now)


class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    booking_id = db.Column(db.Integer, db.ForeignKey("booking.id"), nullable=False, index=True)
    sender_id = db.Column(db.Integer, db.ForeignKey("account.id"), nullable=False)
    text = db.Column(db.String(1000), nullable=False, default="")
    audio = deferred(db.Column(MEDIUMBLOB))
    audio_mime = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, nullable=False, default=utc_now)


class Review(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    booking_id = db.Column(db.Integer, db.ForeignKey("booking.id"), unique=True)
    worker_id = db.Column(db.Integer, db.ForeignKey("worker_profile.id"), nullable=False, index=True)
    rating = db.Column(db.Integer, nullable=False)
    text = db.Column(db.String(400), nullable=False, default="")
    demo = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=utc_now)
