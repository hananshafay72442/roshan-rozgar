from flask import abort, current_app, request

from . import main_bp
from .data import CITIES, SERVICES, WORKERS


@main_bp.get("/health")
def health():
    return {"status": "ok", "app": "roshan-rozgar"}


@main_bp.get("/services")
def services():
    return {"services": SERVICES, "cities": CITIES}


@main_bp.get("/workers")
def workers():
    city = request.args.get("city", "")
    service_id = request.args.get("service", "")
    available = request.args.get("available", "")

    if city and city not in CITIES:
        abort(400, description="Choose Islamabad or Rawalpindi.")
    if service_id and service_id not in {service["id"] for service in SERVICES}:
        abort(400, description="Choose a valid service.")
    if available not in {"", "true", "false"}:
        abort(400, description="Available must be true or false.")

    sample_data = current_app.config.get("SEED_SAMPLE_DATA", True)
    results = [
        worker for worker in (WORKERS if sample_data else [])
        if (not city or worker["city"] == city)
        and (not service_id or worker["service_id"] == service_id)
        and (not available or worker["available"] == (available == "true"))
    ]
    return {"workers": results, "total": len(results), "demo": sample_data}
