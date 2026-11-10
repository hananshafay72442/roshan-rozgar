import math

from flask import abort, current_app, request

from . import main_bp
from .auth import current_account, json_body, profile_for
from .data import AREAS, CITIES, SERVICES
from ..extensions import db
from ..models import Account, Review, WorkerProfile
from ..services.marketplace import SERVICE_IDS, rating_summary, worker_data


@main_bp.after_request
def api_headers(response):
    response.headers["Cache-Control"] = "no-store"
    return response


@main_bp.get("/health")
def health():
    return {"status": "ok", "app": "roshan-rozgar"}


@main_bp.get("/services")
def services():
    return {"services": SERVICES, "cities": CITIES, "areas": {city: list(areas) for city, areas in AREAS.items()}}


def distance_km(origin, target):
    lat, lon = map(math.radians, origin)
    other_lat, other_lon = map(math.radians, target)
    a = math.sin((other_lat - lat) / 2) ** 2
    a += math.cos(lat) * math.cos(other_lat) * math.sin((other_lon - lon) / 2) ** 2
    return round(12742 * math.asin(min(1, math.sqrt(a))), 1)


@main_bp.get("/workers")
def workers():
    city = request.args.get("city", "")
    area = request.args.get("area", "")
    trade = request.args.get("service", "")
    available = request.args.get("available", "")
    if city and city not in CITIES:
        abort(400, description="Choose Islamabad or Rawalpindi.")
    if area and area not in AREAS.get(city, {}):
        abort(400, description="Choose a neighbourhood in your selected city.")
    if trade and trade not in SERVICE_IDS:
        abort(400, description="Choose a valid service.")
    if available not in {"", "true", "false"}:
        abort(400, description="Available must be true or false.")

    sample_data = current_app.config["SEED_SAMPLE_DATA"]
    query = db.select(WorkerProfile, Account.verification).join(Account, Account.id == WorkerProfile.user_id)
    if not sample_data:
        query = query.where(WorkerProfile.seed_key.is_(None))
    if city:
        query = query.where(WorkerProfile.city == city)
    if trade:
        query = query.where(WorkerProfile.service_id == trade)
    if available:
        is_available = WorkerProfile.taking_work.is_(True) & WorkerProfile.active_booking_id.is_(None)
        query = query.where(is_available if available == "true" else ~is_available)

    ratings = rating_summary()
    results = []
    for profile, verification in db.session.execute(query):
        distance = distance_km(AREAS[city][area], AREAS[city][profile.area]) if area else None
        results.append(worker_data(profile, ratings.get(profile.id), distance, verification))
    results.sort(key=lambda item: (not item["available"], item["distance_km"] or 0, item["id"]))
    return {"workers": results, "total": len(results), "demo": sample_data}


@main_bp.get("/workers/<int:worker_id>/reviews")
def worker_reviews(worker_id):
    profile = db.session.get(WorkerProfile, worker_id)
    if not profile or (profile.seed_key and not current_app.config["SEED_SAMPLE_DATA"]):
        abort(404, description="This worker is no longer listed.")
    reviews = db.session.scalars(db.select(Review).where(
        Review.worker_id == worker_id,
    ).order_by(Review.id.desc()).limit(30))
    return {"reviews": [{"rating": review.rating, "text": review.text, "demo": review.demo} for review in reviews]}


@main_bp.patch("/profile/availability")
def update_availability():
    account = current_account("worker")
    profile = profile_for(account)
    available = json_body().get("taking_work")
    if not profile or type(available) is not bool:
        abort(400, description="Complete your profile and choose an availability setting.")
    profile.taking_work = available
    db.session.commit()
    return {"taking_work": profile.taking_work, "available": profile.available}
