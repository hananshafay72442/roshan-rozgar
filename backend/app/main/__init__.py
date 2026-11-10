from flask import Blueprint

main_bp = Blueprint("main", __name__, url_prefix="/api")

from . import auth, jobs, routes, voice
