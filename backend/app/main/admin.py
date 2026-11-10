from flask import abort, request
from sqlalchemy import update
from sqlalchemy.orm import aliased

from . import main_bp
from .auth import current_account, json_body
from ..extensions import db
from ..models import Account, Booking, CustomerProfile, Message, WorkerProfile
from ..services.marketplace import audio_file

MODELS = {"profiles": WorkerProfile, "requests": Booking}


@main_bp.get("/admin/review")
def review_queue():
    current_account("admin")
    status = request.args.get("status", "pending")
    if status not in {"pending", "approved", "rejected"}:
        abort(400, description="Choose a review status.")
    worker_account = aliased(Account)
    profiles = db.session.execute(db.select(WorkerProfile, Account)
        .join(Account, Account.id == WorkerProfile.user_id)
        .where(WorkerProfile.moderation == status, WorkerProfile.seed_key.is_(None))
        .order_by(WorkerProfile.id.desc()).limit(100))
    requests = db.session.execute(db.select(Booking, WorkerProfile, Account, worker_account, CustomerProfile, Message)
        .join(WorkerProfile, WorkerProfile.id == Booking.worker_id)
        .join(Account, Account.id == Booking.customer_id)
        .join(worker_account, worker_account.id == WorkerProfile.user_id)
        .outerjoin(CustomerProfile, CustomerProfile.user_id == Account.id)
        .outerjoin(Message, (Message.booking_id == Booking.id) &
                   (Message.id == db.select(db.func.min(Message.id))
                    .where(Message.booking_id == Booking.id).correlate(Booking).scalar_subquery()))
        .where(Booking.moderation == status, Booking.state != "cancelled")
        .order_by(Booking.id.desc()).limit(100))
    return {
        "profiles": [{
            "id": profile.id, "name": profile.name, "service": profile.service_id,
            "city": profile.city, "area": profile.area, "experience": profile.experience_years,
            "phone": account.phone or account.contact_phone,
        } for profile, account in profiles],
        "requests": [{
            "id": job.id, "customer": customer.name if customer else None, "worker": profile.name,
            "phone": account.phone or account.contact_phone, "worker_phone": worker.phone or worker.contact_phone,
            "text": message.text if message else "",
            "audio": f"/api/admin/audio/{message.id}" if message and message.audio_mime else None,
        } for job, profile, account, worker, customer, message in requests],
    }


@main_bp.patch("/admin/review/<kind>/<int:item_id>")
def decide(kind, item_id):
    current_account("admin")
    model = MODELS.get(kind)
    decision = json_body().get("decision")
    if not model or decision not in ("approved", "rejected"):
        abort(400, description="Choose approve or reject.")
    conditions = [model.id == item_id, model.moderation == "pending"]
    if model is Booking:
        conditions.append(model.state == "requested")
    result = db.session.execute(update(model).where(*conditions).values(moderation=decision))
    if not result.rowcount:
        abort(409, description="This item is no longer pending.")
    db.session.commit()
    return {"moderation": decision}


@main_bp.get("/admin/audio/<int:message_id>")
def review_audio(message_id):
    current_account("admin")
    message = db.session.get(Message, message_id)
    if not message or not message.audio_mime or message.id != db.session.scalar(db.select(db.func.min(Message.id))
            .where(Message.booking_id == message.booking_id)):
        abort(404, description="This voice note was not found.")
    return audio_file(message)
