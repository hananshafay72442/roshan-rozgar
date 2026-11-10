from pathlib import Path

from flask import Flask, send_from_directory
from dotenv import load_dotenv
from werkzeug.exceptions import HTTPException

from .extensions import db, migrate


def create_app(config_class=None):
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")

    if config_class is None:
        from .config import Config
        config_class = Config

    app = Flask(__name__, static_folder=None)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)

    from . import models
    from .main import main_bp
    app.register_blueprint(main_bp)

    @app.errorhandler(HTTPException)
    def handle_http_error(error):
        if error.code == 503:
            return {"error": "Build the frontend first with npm run build."}, 503
        response = error.get_response()
        response.data = app.json.dumps({"error": error.description})
        response.content_type = "application/json"
        return response

    @app.get("/")
    def home():
        directory = Path(app.config["FRONTEND_DIST"])
        if not (directory / "index.html").is_file():
            from flask import abort
            abort(503)
        return send_from_directory(directory, "index.html")

    @app.get("/assets/<path:filename>")
    def frontend_assets(filename):
        return send_from_directory(Path(app.config["FRONTEND_DIST"]) / "assets", filename)

    @app.get("/favicon.svg")
    def favicon():
        return send_from_directory(app.config["FRONTEND_DIST"], "favicon.svg")

    return app
