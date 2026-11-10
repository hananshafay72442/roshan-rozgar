import secrets

from flask import abort, make_response
from sqlalchemy import select

from . import main_bp
from .auth import current_account
from ..extensions import db
from ..models import WorkerIdentity, WorkerProfile, utc_now
from ..services.identity import identity_data, identity_evidence
from ..services.verification import reserve_quota


@main_bp.post("/profile/identity")
def submit_identity():
    account = current_account("worker")
    reserve_quota("identity", str(account.id), 5, 3600)
    # Lock the profile so resubmission cannot race with an administrator's decision.
    profile = db.session.scalar(select(WorkerProfile).where(WorkerProfile.user_id == account.id).with_for_update())
    if not profile:
        abort(409, description="Complete your trade profile first.")
    if profile.seed_key is not None:
        abort(409, description="Use your own worker account to submit identity documents.")
    evidence = identity_evidence()
    identity = db.session.scalar(select(WorkerIdentity).where(WorkerIdentity.worker_id == profile.id))
    if identity is None:
        identity = WorkerIdentity(worker_id=profile.id)
        db.session.add(identity)
    for key, value in evidence.items():
        setattr(identity, key, value)
    identity.submitted_at, identity.reviewed_by, identity.reviewed_at = utc_now(), None, None
    identity.submission_token = secrets.token_hex(16)
    profile.moderation = "pending"
    db.session.commit()
    return {"identity": identity_data(profile.id), "moderation": "pending"}, 201


@main_bp.get("/identity/<int:worker_id>/<string:kind>")
def identity_image(worker_id, kind):
    account = current_account()
    profile = db.session.get(WorkerProfile, worker_id)
    if not profile or (account.role != "admin" and profile.user_id != account.id) or kind not in {"selfie", "cnic_front"}:
        abort(404)
    identity = db.session.scalar(select(WorkerIdentity).where(WorkerIdentity.worker_id == worker_id))
    if not identity:
        abort(404)
    response = make_response(getattr(identity, kind))
    response.headers.update({"Content-Type": "image/jpeg", "X-Content-Type-Options": "nosniff",
                             "Content-Disposition": f'inline; filename="{kind}.jpg"',
                             "Cache-Control": "no-store, private"})
    return response
