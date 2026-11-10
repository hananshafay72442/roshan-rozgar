import json

from flask import abort, current_app, request
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError

from . import main_bp
from .auth import current_account, json_body, profile_for, session_data
from ..extensions import db
from ..models import Booking, Message, Review, WorkerIdentity, WorkerProfile
from ..services.identity import identity_data, identity_evidence
from ..services.verification import reserve_quota
from ..services.marketplace import audio_file, customer_location, nearby_distance, message_input, validated_profile, worker_data

OFFER_STATES = {"requested", "quoted", "countered"}
OPEN_STATES = OFFER_STATES | {"confirmed"}
PRICE_CHANGED = "The quote changed. Review the latest price and try again."


def job_data(job, profile, reviewed):
    return {
        "id": job.id, "worker": worker_data(profile), "state": job.state,
        "quote_pkr": job.quote_pkr, "moderation": job.moderation, "reviewed": reviewed is not None,
        "created_at": job.created_at.isoformat() + "Z",
    }


def job_query():
    return db.select(Booking, WorkerProfile, Review.id).join(
        WorkerProfile, WorkerProfile.id == Booking.worker_id,
    ).outerjoin(Review, Review.booking_id == Booking.id)


def owned_job(job_id, account):
    row = db.session.execute(job_query().where(Booking.id == job_id)).one_or_none()
    if not row:
        abort(404, description="This job was not found.")
    job, profile, reviewed = row
    if account.id not in (job.customer_id, profile.user_id):
        abort(404, description="This job was not found.")
    return job, profile, reviewed


def add_message(job, account, values):
    text, audio, mime = values
    db.session.add(Message(booking_id=job.id, sender_id=account.id, text=text, audio=audio, audio_mime=mime))


def checked_update(query, error):
    if not db.session.execute(query).rowcount:
        db.session.rollback()
        abort(409, description=error)


@main_bp.post("/profile")
def create_profile():
    account = current_account("worker")
    if profile_for(account):
        abort(409, description="Your worker profile is already complete.")
    evidence = None
    if request.mimetype == "multipart/form-data":
        reserve_quota("identity", str(account.id), 5, 3600)
        try:
            data = json.loads(request.form.get("profile", ""))
        except (ValueError, TypeError):
            abort(400, description="Send the requested information and try again.")
        if not isinstance(data, dict):
            abort(400, description="Send the requested information and try again.")
        details = validated_profile(data)
        evidence = identity_evidence()
    else:
        details = validated_profile(json_body())
    profile = WorkerProfile(user_id=account.id, moderation="pending", **details)
    db.session.add(profile)
    try:
        if evidence:
            db.session.flush()
            db.session.add(WorkerIdentity(worker_id=profile.id, **evidence))
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        abort(409, description="Your worker profile is already complete.")
    return session_data(), 201


@main_bp.get("/profile")
def get_profile():
    account = current_account("worker")
    profile = profile_for(account)
    return {"identity_mode": "automatic" if current_app.config.get("REKOGNITION_REGION") else "manual", "profile": {
        **worker_data(profile, verification=account.verification), "taking_work": profile.taking_work,
        "identity": identity_data(profile.id),
    } if profile else None}


@main_bp.get("/jobs")
def list_jobs():
    account = current_account()
    owner = Booking.customer_id == account.id if account.role == "customer" else WorkerProfile.user_id == account.id
    results = db.session.execute(job_query().where(owner).order_by(Booking.id.desc()))
    return {"jobs": [job_data(*row) for row in results]}


@main_bp.post("/jobs")
def request_job():
    account = current_account("customer")
    values = request.form if request.mimetype == "multipart/form-data" else json_body()
    worker_id = values.get("worker_id")
    if isinstance(worker_id, str) and worker_id.isascii() and worker_id.isdecimal() and len(worker_id) <= 10:
        worker_id = int(worker_id)
    if type(worker_id) is not int or not 1 <= worker_id <= 2147483647:
        abort(400, description="Choose a worker to request.")
    profile = db.session.get(WorkerProfile, worker_id)
    if not profile or profile.moderation != "approved" or (profile.seed_key and not current_app.config["SEED_SAMPLE_DATA"]):
        abort(404, description="This worker is no longer listed.")
    if nearby_distance(customer_location(account), profile) is None:
        abort(403, description="Choose a worker within 5 km of your saved neighbourhood.")
    if not profile.available:
        abort(409, description="This worker is unavailable now. Please choose another.")
    values = message_input()
    job = Booking(customer_id=account.id, worker_id=profile.id)
    db.session.add(job)
    db.session.flush()
    add_message(job, account, values)
    db.session.commit()
    return {"job": job_data(job, profile, None)}, 201


@main_bp.get("/jobs/<int:job_id>")
def job_detail(job_id):
    account = current_account()
    job, profile, reviewed = owned_job(job_id, account)
    messages = db.session.scalars(db.select(Message).where(
        Message.booking_id == job.id,
    ).order_by(Message.id))
    return {
        "job": job_data(job, profile, reviewed),
        "messages": [{
            "id": message.id, "mine": message.sender_id == account.id, "text": message.text,
            "audio_url": f"/api/jobs/{job.id}/audio/{message.id}" if message.audio_mime else None,
            "created_at": message.created_at.isoformat() + "Z",
        } for message in messages],
    }


@main_bp.post("/jobs/<int:job_id>/messages")
def send_message(job_id):
    account = current_account()
    job, _, _ = owned_job(job_id, account)
    if job.state not in OPEN_STATES or job.moderation == "rejected":
        abort(409, description="This conversation is closed.")
    add_message(job, account, message_input())
    db.session.commit()
    return {"sent": True}, 201


@main_bp.get("/jobs/<int:job_id>/audio/<int:message_id>")
def job_audio(job_id, message_id):
    owned_job(job_id, current_account())
    message = db.session.get(Message, message_id)
    if not message or message.booking_id != job_id or not message.audio_mime:
        abort(404, description="This voice note was not found.")
    return audio_file(message)


def propose_price(job_id, role, next_state):
    account = current_account(role)
    job, _, _ = owned_job(job_id, account)
    data = json_body()
    price = data.get("quote_pkr")
    if type(price) is not int or not 1 <= price <= 1_000_000:
        abort(400, description="Enter a whole amount between Rs 1 and Rs 1,000,000.")
    if job.moderation == "rejected" or job.state not in OFFER_STATES:
        abort(409, description="This job is no longer open for a quote.")
    if role == "customer" and job.state != "quoted":
        abort(409, description=PRICE_CHANGED)
    if role == "customer" or job.state == "countered" or "previous_quote_pkr" in data:
        previous_price = data.get("previous_quote_pkr")
        if previous_price != job.quote_pkr or (previous_price is not None and type(previous_price) is not int):
            abort(409, description=PRICE_CHANGED)
    if job.state != next_state and price == job.quote_pkr:
        abort(400, description="Accept the current price or enter a different amount.")
    checked_update(update(Booking).where(
        Booking.id == job.id, Booking.moderation != "rejected", Booking.state == job.state,
        Booking.quote_pkr == job.quote_pkr,
    ).values(state=next_state, quote_pkr=price), PRICE_CHANGED)
    db.session.commit()
    return {"state": next_state}


@main_bp.post("/jobs/<int:job_id>/quote")
def quote_job(job_id):
    return propose_price(job_id, "worker", "quoted")


@main_bp.post("/jobs/<int:job_id>/counter")
def counter_quote(job_id):
    return propose_price(job_id, "customer", "countered")


@main_bp.post("/jobs/<int:job_id>/accept")
def accept_quote(job_id):
    account = current_account()
    if account.role not in ("customer", "worker"):
        abort(403, description="This action is available to the other account type.")
    job, profile, _ = owned_job(job_id, account)
    price = json_body().get("quote_pkr")
    if type(price) is not int or not 1 <= price <= 1_000_000:
        abort(400, description="Select the current quote to confirm the booking.")
    expected_state = "quoted" if account.role == "customer" else "countered"
    checked_update(update(Booking).where(
        Booking.id == job.id, Booking.moderation != "rejected",
        Booking.state == expected_state, Booking.quote_pkr == price,
    ).values(state="confirmed"), PRICE_CHANGED)
    checked_update(update(WorkerProfile).where(
        WorkerProfile.id == profile.id, WorkerProfile.active_booking_id.is_(None),
        WorkerProfile.taking_work.is_(True),
    ).values(active_booking_id=job.id), "This worker is already booked or unavailable. The job was not confirmed.")
    db.session.commit()
    return {"state": "confirmed"}


def close_job(job_id, state):
    account = current_account("worker" if state == "declined" else None)
    job, profile, _ = owned_job(job_id, account)
    previous_state = job.state
    allowed_states = {
        "completed": {"confirmed"}, "declined": OFFER_STATES, "cancelled": OPEN_STATES,
    }
    if previous_state not in allowed_states[state] or job.moderation == "rejected":
        abort(409, description="This job can’t be changed in its current state.")
    checked_update(update(Booking).where(
        Booking.id == job.id, Booking.moderation != "rejected", Booking.state == previous_state,
    ).values(state=state), "This job changed. Refresh to see the latest status.")
    if previous_state == "confirmed":
        checked_update(update(WorkerProfile).where(
            WorkerProfile.id == profile.id, WorkerProfile.active_booking_id == job.id,
        ).values(active_booking_id=None), "The booking changed. Refresh to see the latest status.")
    db.session.commit()
    return {"state": state}


@main_bp.post("/jobs/<int:job_id>/complete")
def complete_job(job_id):
    return close_job(job_id, "completed")


@main_bp.post("/jobs/<int:job_id>/decline")
def decline_job(job_id):
    return close_job(job_id, "declined")


@main_bp.post("/jobs/<int:job_id>/cancel")
def cancel_job(job_id):
    return close_job(job_id, "cancelled")


@main_bp.post("/jobs/<int:job_id>/review")
def review_job(job_id):
    account = current_account("customer")
    job, profile, reviewed = owned_job(job_id, account)
    if job.state != "completed" or reviewed:
        abort(409, description="A completed job can be reviewed once.")
    data = json_body()
    rating, text = data.get("rating"), data.get("text", "")
    if type(rating) is not int or not 1 <= rating <= 5 or not isinstance(text, str) or len(text.strip()) > 400:
        abort(400, description="Choose 1 to 5 stars and use up to 400 characters for the note.")
    db.session.add(Review(
        booking_id=job.id, worker_id=profile.id, rating=rating, text=text.strip(),
        demo=profile.seed_key is not None or account.verification == "demo",
    ))
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        abort(409, description="This job already has a review.")
    return {"reviewed": True}, 201
