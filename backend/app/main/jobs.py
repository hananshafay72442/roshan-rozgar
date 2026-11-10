from flask import abort, current_app, request
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError

from . import main_bp
from .auth import current_account, json_body, profile_for, session_data
from ..extensions import db
from ..models import Booking, Message, Review, WorkerProfile
from ..services.marketplace import audio_file, message_input, validated_profile, worker_data

OPEN_STATES = {"requested", "quoted", "confirmed"}


def job_data(job, profile, reviewed):
    return {
        "id": job.id, "worker": worker_data(profile), "state": job.state,
        "quote_pkr": job.quote_pkr, "reviewed": reviewed is not None,
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
    db.session.add(WorkerProfile(user_id=account.id, **validated_profile(json_body())))
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        abort(409, description="Your worker profile is already complete.")
    return session_data(), 201


@main_bp.get("/profile")
def get_profile():
    account = current_account("worker")
    profile = profile_for(account)
    return {"profile": {
        **worker_data(profile, verification=account.verification), "taking_work": profile.taking_work,
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
    if not profile or (profile.seed_key and not current_app.config["SEED_SAMPLE_DATA"]):
        abort(404, description="This worker is no longer listed.")
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
    if job.state not in OPEN_STATES:
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


@main_bp.post("/jobs/<int:job_id>/quote")
def quote_job(job_id):
    account = current_account("worker")
    job, _, _ = owned_job(job_id, account)
    price = json_body().get("quote_pkr")
    if type(price) is not int or not 1 <= price <= 1_000_000:
        abort(400, description="Enter a whole amount between Rs 1 and Rs 1,000,000.")
    checked_update(update(Booking).where(
        Booking.id == job.id, Booking.state.in_(("requested", "quoted")),
    ).values(state="quoted", quote_pkr=price), "This job is no longer open for a quote.")
    db.session.commit()
    return {"state": "quoted"}


@main_bp.post("/jobs/<int:job_id>/accept")
def accept_quote(job_id):
    account = current_account("customer")
    job, profile, _ = owned_job(job_id, account)
    price = json_body().get("quote_pkr")
    if type(price) is not int or price < 1:
        abort(400, description="Select the current quote to confirm the booking.")
    checked_update(update(Booking).where(
        Booking.id == job.id, Booking.state == "quoted", Booking.quote_pkr == price,
    ).values(state="confirmed"), "The quote changed. Review the latest price and try again.")
    checked_update(update(WorkerProfile).where(
        WorkerProfile.id == profile.id, WorkerProfile.active_booking_id.is_(None),
        WorkerProfile.taking_work.is_(True),
    ).values(active_booking_id=job.id), "This worker is already booked or unavailable. The job was not confirmed.")
    db.session.commit()
    return {"state": "confirmed"}


def close_job(job_id, state):
    account = current_account("worker" if state == "completed" else None)
    job, profile, _ = owned_job(job_id, account)
    previous_state = job.state
    valid = previous_state == "confirmed" if state == "completed" else previous_state in OPEN_STATES
    if not valid:
        abort(409, description="This job can’t be changed in its current state.")
    checked_update(update(Booking).where(
        Booking.id == job.id, Booking.state == previous_state,
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
