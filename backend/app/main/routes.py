from flask import abort, current_app, request

from . import main_bp
from .auth import current_account, json_body, profile_for
from .data import AREAS, CITIES, SERVICES
from ..extensions import db
from ..models import Account, CustomerProfile, Review, WorkerProfile
from ..services.marketplace import SERVICE_IDS, NEARBY_RADIUS_KM, customer_location, nearby_distance, rating_summary, validated_profile, worker_data


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


@main_bp.get("/workers")
def workers():
    location = customer_location(current_account("customer"))
    city, area = location.city, location.area
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
    query = db.select(WorkerProfile, Account.verification).join(Account, Account.id == WorkerProfile.user_id).where(WorkerProfile.moderation == "approved")
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
        distance = nearby_distance(location, profile)
        if distance is not None:
            results.append(worker_data(profile, ratings.get(profile.id), round(distance, 1), verification))
    results.sort(key=lambda item: (not item["available"], item["distance_km"] or 0, item["id"]))
    return {"workers": results, "total": len(results), "demo": sample_data, "radius_km": NEARBY_RADIUS_KM}


@main_bp.get("/testimonials")
def testimonials():
    query = db.select(Review, WorkerProfile).join(WorkerProfile, WorkerProfile.id == Review.worker_id)
    if not current_app.config["SEED_SAMPLE_DATA"]:
        query = query.where(Review.demo.is_(False), WorkerProfile.seed_key.is_(None))
    rows = db.session.execute(query.where(Review.text != "").order_by(Review.id.desc()).limit(3))
    return {"reviews": [{"worker_name": worker.name, "rating": review.rating,
                         "text": review.text, "demo": review.demo} for review, worker in rows]}


@main_bp.get("/account/profile")
def get_customer_profile():
    account = current_account("customer")
    profile = db.session.scalar(db.select(CustomerProfile).where(CustomerProfile.user_id == account.id))
    return {"profile": {"name": profile.name, "city": profile.city, "area": profile.area} if profile else None}


@main_bp.patch("/account/profile")
def save_customer_profile():
    from .auth import session_data
    account = current_account("customer")
    data = json_body()
    name, city, area = data.get("name"), data.get("city"), data.get("area")
    if not isinstance(name, str) or not 2 <= len(name.strip()) <= 80:
        abort(400, description="Add the name customers should see.")
    if not isinstance(city, str) or city not in AREAS or not isinstance(area, str) or area not in AREAS[city]:
        abort(400, description="Choose your city and neighbourhood.")
    profile = db.session.scalar(db.select(CustomerProfile).where(CustomerProfile.user_id == account.id))
    if not profile:
        profile = CustomerProfile(user_id=account.id)
        db.session.add(profile)
    profile.name, profile.city, profile.area = name.strip(), city, area
    db.session.commit()
    return session_data()


@main_bp.patch("/profile")
def edit_worker_profile():
    from .auth import session_data
    account = current_account("worker")
    profile = profile_for(account)
    if not profile:
        abort(404, description="Complete your profile and choose an availability setting.")
    details = validated_profile(json_body())
    if any(getattr(profile, key) != value for key, value in details.items()):
        profile.moderation = "pending"
        for key, value in details.items():
            setattr(profile, key, value)
    db.session.commit()
    return session_data()


@main_bp.get("/workers/<int:worker_id>/reviews")
def worker_reviews(worker_id):
    account = current_account()
    profile = db.session.get(WorkerProfile, worker_id)
    if not profile or (profile.moderation != "approved" and profile.user_id != account.id) or (profile.seed_key and not current_app.config["SEED_SAMPLE_DATA"]):
        abort(404, description="This worker is no longer listed.")
    if account.role == "customer" and nearby_distance(customer_location(account), profile) is None:
        abort(403, description="Choose a worker within 5 km of your saved neighbourhood.")
    if account.role == "worker" and profile.user_id != account.id:
        abort(403, description="This action is available to the other account type.")
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
