import os
import secrets
from pathlib import Path
from tempfile import NamedTemporaryFile

from flask import Flask, abort, send_from_directory
from dotenv import load_dotenv
from werkzeug.exceptions import HTTPException

from .extensions import db, migrate


def local_secret(instance_path):
    directory = Path(instance_path)
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / "session-secret"
    if not target.exists():
        with NamedTemporaryFile(dir=directory, mode="w", delete=False) as temporary:
            temporary.write(secrets.token_hex(32))
        try:
            os.link(temporary.name, target)
        except FileExistsError:
            pass
        finally:
            Path(temporary.name).unlink()
    return target.read_text().strip()


def create_app(config_class=None):
    if config_class is None:
        load_dotenv(Path(__file__).resolve().parents[1] / ".env")
        from .config import Config
        config_class = Config()

    app = Flask(__name__, static_folder=None)
    app.config.from_object(config_class)
    if not app.secret_key:
        app.secret_key = local_secret(app.instance_path)

    db.init_app(app)
    migrate.init_app(app, db)

    from .main import main_bp
    app.register_blueprint(main_bp)

    from .commands import register_commands
    register_commands(app)

    @app.errorhandler(HTTPException)
    def handle_http_error(error):
        response = error.get_response()
        response.data = app.json.dumps({"error": error.description})
        response.content_type = "application/json"
        return response

    @app.get("/")
    def home():
        directory = Path(app.config["FRONTEND_DIST"])
        if not (directory / "index.html").is_file():
            abort(503, description="Build the frontend first with npm run build.")
        return send_from_directory(directory, "index.html")

    @app.get("/assets/<path:filename>")
    def frontend_assets(filename):
        return send_from_directory(Path(app.config["FRONTEND_DIST"]) / "assets", filename)

    @app.get("/favicon.svg")
    def favicon():
        return send_from_directory(app.config["FRONTEND_DIST"], "favicon.svg")

    return app
