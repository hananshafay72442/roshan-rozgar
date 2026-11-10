import os
from pathlib import Path

import certifi
from sqlalchemy.engine import URL

BACKEND_DIR = Path(__file__).resolve().parents[1]
LOCAL_DB_HOSTS = {"127.0.0.1", "localhost", "::1"}


def env_bool(name, default=False):
    value = os.getenv(name, str(default)).strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"{name} must be 1/0 or true/false.")


class Config:
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    PERMANENT_SESSION_LIFETIME = 60 * 60 * 24 * 7
    MAX_CONTENT_LENGTH = 1_600_000
    FRONTEND_DIST = BACKEND_DIR.parent / "frontend" / "dist"

    def __init__(self):
        self.APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
        if self.APP_ENV not in {"development", "testing", "production"}:
            raise ValueError("APP_ENV must be development, testing, or production.")
        self.SECRET_KEY = os.getenv("SECRET_KEY") or None
        self.SESSION_COOKIE_SECURE = self.APP_ENV == "production"
        if self.APP_ENV == "production" and not self.SECRET_KEY:
            raise ValueError("Set a random SECRET_KEY for production.")

        self.DB_HOST = os.getenv("DB_HOST", "").strip()
        self.DB_NAME = os.getenv("DB_NAME", "roshanRozgar").strip()
        self.DB_USER = os.getenv("DB_USER", "").strip()
        self.DB_PASSWORD = os.getenv("DB_PASSWORD", "")
        if not all((self.DB_HOST, self.DB_NAME, self.DB_USER, self.DB_PASSWORD)):
            raise ValueError("Set DB_HOST, DB_NAME, DB_USER, and DB_PASSWORD for MySQL.")
        if self.DB_NAME.endswith(";"):
            raise ValueError("Remove the trailing semicolon from DB_NAME.")

        tidb = self.DB_HOST.endswith(".tidbcloud.com")
        try:
            port = int(os.getenv("DB_PORT", "4000" if tidb else "3306"))
        except ValueError:
            raise ValueError("DB_PORT must be an integer.") from None
        if not 1 <= port <= 65535:
            raise ValueError("DB_PORT must be between 1 and 65535.")
        self.SQLALCHEMY_DATABASE_URI = URL.create(
            "mysql+pymysql", host=self.DB_HOST, port=port,
            username=self.DB_USER, password=self.DB_PASSWORD, database=self.DB_NAME,
            query={"charset": "utf8mb4"},
        )

        self.DB_SSL = env_bool("DB_SSL", True)
        connect_args = {"connect_timeout": 10, "read_timeout": 30, "write_timeout": 30}
        if self.DB_SSL:
            ca_value = os.getenv("DB_CA_PATH", "").strip()
            ca_path = Path(ca_value).expanduser() if ca_value else Path(certifi.where())
            if not ca_path.is_absolute():
                ca_path = BACKEND_DIR / ca_path
            if not ca_path.is_file():
                raise ValueError("DB_CA_PATH must point to an existing CA certificate file.")
            connect_args.update(
                ssl_verify_cert=True, ssl_verify_identity=True, ssl_ca=str(ca_path.resolve()),
            )
        elif tidb:
            raise ValueError("TiDB Cloud requires DB_SSL=1.")
        self.SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True, "pool_recycle": 300, "connect_args": connect_args}

        self.SEED_SAMPLE_DATA = env_bool("SEED_SAMPLE_DATA")
        self.DEMO_VERIFICATION = env_bool("DEMO_VERIFICATION")
        if self.DEMO_VERIFICATION and (self.APP_ENV == "production" or self.DB_HOST not in LOCAL_DB_HOSTS):
            raise ValueError("Demo verification requires a local MySQL database in development or testing.")
        self.TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
        self.TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
        self.TWILIO_VERIFY_SERVICE_SID = os.getenv("TWILIO_VERIFY_SERVICE_SID", "").strip()
        twilio = (self.TWILIO_ACCOUNT_SID, self.TWILIO_AUTH_TOKEN, self.TWILIO_VERIFY_SERVICE_SID)
        if any(twilio) and not all(twilio):
            raise ValueError("Set all three TWILIO_* values to enable SMS verification.")
        self.RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
        self.RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "").strip()
        # Reserved for the future account/admin flow; no administrator is created at startup.
        self.ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "").strip()
        self.ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
        self.GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
        self.GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
        self.GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b").strip()
        self.GROQ_SPEECH_MODEL = os.getenv("GROQ_SPEECH_MODEL", "whisper-large-v3-turbo").strip()
        self.GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite").strip()
        if not self.GEMINI_MODEL.startswith("gemini-"):
            raise ValueError("GEMINI_MODEL must be a Gemini model, such as gemini-3.5-flash-lite.")
