from io import BytesIO
import math

from flask import abort, request
from sqlalchemy import func

from ..extensions import db
from ..main.data import AREAS, CITIES, SERVICES, WORKERS
from ..models import Account, Booking, CustomerProfile, Message, Review, WorkerProfile

SERVICE_IDS = {service["id"] for service in SERVICES}
NEARBY_RADIUS_KM = 5


def distance_km(origin, target):
    lat, lon = map(math.radians, origin)
    other_lat, other_lon = map(math.radians, target)
    a = math.sin((other_lat - lat) / 2) ** 2
    a += math.cos(lat) * math.cos(other_lat) * math.sin((other_lon - lon) / 2) ** 2
    return 12742 * math.asin(min(1, math.sqrt(a)))


def customer_location(account):
    profile = db.session.scalar(db.select(CustomerProfile).where(CustomerProfile.user_id == account.id))
    if not profile:
        abort(400, description="Save your neighbourhood in your profile to find nearby workers.")
    return profile


def nearby_distance(location, worker):
    if location.city != worker.city:
        return None
    distance = distance_km(AREAS[location.city][location.area], AREAS[worker.city][worker.area])
    return distance if distance <= NEARBY_RADIUS_KM else None
AUDIO_LIMIT = 1_500_000
AUDIO_TYPES = {"audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"}


def seed_catalog():
    customer_phone = "+923000000099"
    customer = db.session.scalar(db.select(Account).where(Account.phone == customer_phone))
    if not customer:
        customer = Account(phone=customer_phone, role="customer", verification="demo")
        db.session.add(customer)
        db.session.flush()
    existing = set(db.session.scalars(db.select(WorkerProfile.seed_key).where(WorkerProfile.seed_key.is_not(None))))
    for row in WORKERS:
        key = row["id"]
        if key in existing:
            continue
        account = Account(phone=f"+923000000{key:03d}", role="worker", verification="demo")
        db.session.add(account)
        db.session.flush()
        profile = WorkerProfile(
            user_id=account.id, seed_key=key, name=row["name"], service_id=row["service_id"],
            city=row["city"], area=row["area"], experience_years=row["experience_years"], taking_work=row["available"],
        )
        db.session.add(profile)
        db.session.flush()
        job = Booking(customer_id=customer.id, worker_id=profile.id, state="completed", quote_pkr=1800)
        db.session.add(job)
        db.session.flush()
        db.session.add(Message(booking_id=job.id, sender_id=customer.id, text="Could you take a look at a small repair?"))
        db.session.add(Review(
            booking_id=job.id, worker_id=profile.id, rating=5 if key % 3 else 4,
            text="Arrived when agreed and explained the work clearly.", demo=True,
        ))
    db.session.commit()


def rating_summary():
    rows = db.session.execute(db.select(
        Review.worker_id, func.avg(Review.rating), func.count(Review.id),
    ).group_by(Review.worker_id))
    return {worker_id: (round(float(average), 1), count) for worker_id, average, count in rows}


def worker_data(profile, rating=None, distance=None, verification=None):
    rating = rating or (None, 0)
    return {
        "id": profile.id, "name": profile.name, "service_id": profile.service_id,
        "city": profile.city, "area": profile.area, "experience_years": profile.experience_years,
        "available": profile.available, "busy": profile.active_booking_id is not None,
        "demo": profile.seed_key is not None, "phone_verified": verification == "sms",
        "email_verified": verification == "email",
        "rating": rating[0], "review_count": rating[1], "distance_km": distance,
    }


def validated_profile(data):
    name, city, area = data.get("name"), data.get("city"), data.get("area")
    trade, years = data.get("service_id"), data.get("experience_years")
    if not isinstance(name, str) or not 2 <= len(name.strip()) <= 80:
        abort(400, description="Add the name customers should see.")
    if not isinstance(trade, str) or trade not in SERVICE_IDS:
        abort(400, description="Choose a trade.")
    if city not in CITIES or not isinstance(area, str) or area not in AREAS[city]:
        abort(400, description="Choose your city and neighbourhood.")
    if type(years) is not int or not 0 <= years <= 70:
        abort(400, description="Choose your years of experience.")
    return {"name": name.strip(), "service_id": trade, "city": city, "area": area, "experience_years": years}


def read_audio(file):
    if file is None:
        return None, None
    mime = file.mimetype
    data = file.stream.read(AUDIO_LIMIT + 1)
    is_audio = (
        mime == "audio/webm" and data.startswith(b"\x1a\x45\xdf\xa3")
        or mime == "audio/ogg" and data.startswith(b"OggS")
        or mime == "audio/mp4" and data[4:8] == b"ftyp"
        or mime == "audio/mpeg" and (data.startswith(b"ID3") or data[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"))
        or mime == "audio/wav" and data.startswith(b"RIFF") and data[8:12] == b"WAVE"
    )
    if mime not in AUDIO_TYPES or not is_audio or len(data) > AUDIO_LIMIT:
        abort(400, description="Record a supported audio note under 1.5 MB.")
    return data, mime


def message_input():
    if request.mimetype == "multipart/form-data":
        text = request.form.get("text", "")
        audio, mime = read_audio(request.files.get("audio"))
    else:
        from ..main.auth import json_body

        text, audio, mime = json_body().get("text", ""), None, None
    if not isinstance(text, str) or len(text.strip()) > 1000:
        abort(400, description="Use up to 1,000 characters for a message.")
    if not text.strip() and audio is None:
        abort(400, description="Write a short message or record a voice note.")
    return text.strip(), audio, mime


def audio_file(message):
    from flask import send_file

    response = send_file(BytesIO(message.audio), mimetype=message.audio_mime, conditional=True)
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response
