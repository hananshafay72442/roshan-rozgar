from flask import abort, request
from sqlalchemy import update

from . import main_bp
from .auth import current_account, json_body
from ..extensions import db
from ..models import Account, WorkerIdentity, WorkerProfile, utc_now


@main_bp.get("/admin/review")
def review_queue():
    current_account("admin")
    status = request.args.get("status", "pending")
    if status not in {"pending", "approved", "rejected"}:
        abort(400, description="Choose a review status.")
    profiles = db.session.execute(db.select(WorkerProfile, Account, WorkerIdentity)
        .join(Account, Account.id == WorkerProfile.user_id)
        .join(WorkerIdentity, WorkerIdentity.worker_id == WorkerProfile.id)
        .where(WorkerProfile.moderation == status, WorkerProfile.seed_key.is_(None))
        .order_by(WorkerProfile.id.desc()).limit(100))
    return {
        "profiles": [{
            "id": profile.id, "name": profile.name, "service": profile.service_id,
            "city": profile.city, "area": profile.area, "experience": profile.experience_years,
            "phone": account.phone or account.contact_phone,
            "identity": {"face_check": identity.face_check, "similarity": identity.similarity,
                         "version": identity.submission_token,
                         "submitted_at": identity.submitted_at.isoformat() + "Z",
                         "selfie_url": f"/api/identity/{profile.id}/selfie?v={identity.submission_token}",
                         "cnic_url": f"/api/identity/{profile.id}/cnic_front?v={identity.submission_token}"},
        } for profile, account, identity in profiles],
    }


@main_bp.patch("/admin/review/profiles/<int:item_id>")
def decide(item_id):
    account = current_account("admin")
    data = json_body()
    decision = data.get("decision")
    if decision not in ("approved", "rejected"):
        abort(400, description="Choose approve or reject.")
    profile = db.session.scalar(db.select(WorkerProfile).where(WorkerProfile.id == item_id).with_for_update())
    identity = db.session.scalar(db.select(WorkerIdentity).where(WorkerIdentity.worker_id == item_id))
    if not profile or not identity:
        abort(409, description="The worker must submit a face photo and CNIC front first.")
    if data.get("identity_version") != identity.submission_token:
        abort(409, description="The identity photos changed. Refresh the queue before deciding.")
    if decision == "approved" and data.get("identity_confirmed") is not True:
        abort(400, description="Check the face photo and CNIC before approving this worker.")
    result = db.session.execute(update(WorkerProfile).where(
        WorkerProfile.id == item_id, WorkerProfile.moderation == "pending", WorkerProfile.seed_key.is_(None),
    ).values(moderation=decision))
    if not result.rowcount:
        abort(409, description="This item is no longer pending.")
    identity.reviewed_by, identity.reviewed_at = account.id, utc_now()
    db.session.commit()
    return {"moderation": decision}
