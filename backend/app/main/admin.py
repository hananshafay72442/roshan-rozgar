from flask import abort, request
from sqlalchemy import update

from . import main_bp
from .auth import current_account, json_body
from ..extensions import db
from ..models import Account, WorkerProfile


@main_bp.get("/admin/review")
def review_queue():
    current_account("admin")
    status = request.args.get("status", "pending")
    if status not in {"pending", "approved", "rejected"}:
        abort(400, description="Choose a review status.")
    profiles = db.session.execute(db.select(WorkerProfile, Account)
        .join(Account, Account.id == WorkerProfile.user_id)
        .where(WorkerProfile.moderation == status, WorkerProfile.seed_key.is_(None))
        .order_by(WorkerProfile.id.desc()).limit(100))
    return {
        "profiles": [{
            "id": profile.id, "name": profile.name, "service": profile.service_id,
            "city": profile.city, "area": profile.area, "experience": profile.experience_years,
            "phone": account.phone or account.contact_phone,
        } for profile, account in profiles],
    }


@main_bp.patch("/admin/review/profiles/<int:item_id>")
def decide(item_id):
    current_account("admin")
    decision = json_body().get("decision")
    if decision not in ("approved", "rejected"):
        abort(400, description="Choose approve or reject.")
    result = db.session.execute(update(WorkerProfile).where(
        WorkerProfile.id == item_id, WorkerProfile.moderation == "pending", WorkerProfile.seed_key.is_(None),
    ).values(moderation=decision))
    if not result.rowcount:
        abort(409, description="This item is no longer pending.")
    db.session.commit()
    return {"moderation": decision}
