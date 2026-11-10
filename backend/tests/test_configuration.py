import os
import ssl
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import certifi
import httpx
from google.genai import errors

from app import create_app
from app.config import BACKEND_DIR, Config
from app.services.ai import AIServiceError, generate_text


def config_for(**values):
    defaults = {"DB_HOST": "127.0.0.1", "DB_USER": "test-user", "DB_PASSWORD": "test-password", "DB_SSL": "0"}
    with patch.dict(os.environ, defaults | values, clear=True):
        return Config()


class ConfigurationTests(unittest.TestCase):
    def test_local_mysql_uses_port_3306_and_requires_credentials(self):
        for missing in ("DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"):
            with self.subTest(missing=missing), self.assertRaisesRegex(ValueError, "for MySQL"):
                config_for(**{missing: ""})
        config = config_for(DB_CA_PATH="missing.pem")
        self.assertEqual(config.SQLALCHEMY_DATABASE_URI.drivername, "mysql+pymysql")
        self.assertEqual(config.SQLALCHEMY_DATABASE_URI.port, 3306)
        self.assertEqual(config.SQLALCHEMY_DATABASE_URI.query["charset"], "utf8mb4")
        self.assertNotIn("ssl_ca", config.SQLALCHEMY_ENGINE_OPTIONS["connect_args"])
        self.assertFalse(config.SESSION_COOKIE_SECURE)

    def test_tidb_preserves_special_characters_in_credentials_and_verifies_tls(self):
        config = config_for(
            DB_HOST="example.tidbcloud.com", DB_PORT="4000", DB_NAME="roshanRozgar",
            DB_USER="example.root", DB_PASSWORD="p@ss:/?#%word", DB_SSL="1",
            DB_CA_PATH="certs/isrgrootx1.pem",
        )
        url = config.SQLALCHEMY_DATABASE_URI
        self.assertEqual(url.drivername, "mysql+pymysql")
        self.assertEqual(url.password, "p@ss:/?#%word")
        self.assertEqual(url.database, "roshanRozgar")
        self.assertEqual(url.port, 4000)
        args = config.SQLALCHEMY_ENGINE_OPTIONS["connect_args"]
        self.assertTrue(args["ssl_verify_cert"])
        self.assertTrue(args["ssl_verify_identity"])
        self.assertEqual(args["ssl_ca"], str(BACKEND_DIR / "certs/isrgrootx1.pem"))
        context = ssl.create_default_context(cafile=args["ssl_ca"])
        self.assertTrue(context.check_hostname)
        self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)

    def test_blank_ca_uses_public_ca_bundle(self):
        config = config_for(DB_HOST="example.tidbcloud.com", DB_USER="example.root", DB_SSL="1")
        self.assertEqual(config.SQLALCHEMY_ENGINE_OPTIONS["connect_args"]["ssl_ca"], certifi.where())

    def test_bad_tidb_configuration_fails_without_leaking_password(self):
        base = {"DB_HOST": "example.tidbcloud.com", "DB_USER": "example.root", "DB_PASSWORD": "test-secret", "DB_SSL": "1"}
        for change in [
            {"DB_NAME": "roshanRozgar;"}, {"DB_PORT": "not-a-port"},
            {"DB_PORT": "65536"}, {"DB_CA_PATH": "missing.pem"}, {"DB_SSL": "0"},
        ]:
            with self.subTest(change=change), self.assertRaises(ValueError) as error:
                config_for(**(base | change))
            self.assertNotIn("test-secret", str(error.exception))

    def test_production_requires_shared_secret_and_explicit_database(self):
        for values in [{"APP_ENV": "production"}, {"APP_ENV": "production", "SECRET_KEY": "example", "DB_HOST": ""}]:
            with self.subTest(values=values), self.assertRaises(ValueError):
                config_for(**values)
        config = config_for(APP_ENV="production", SECRET_KEY="example")
        self.assertTrue(config.SESSION_COOKIE_SECURE)

    def test_demo_verification_is_opt_in_and_local_only(self):
        self.assertFalse(config_for().DEMO_VERIFICATION)
        self.assertTrue(config_for(DEMO_VERIFICATION="1").DEMO_VERIFICATION)
        for values in [{"APP_ENV": "production", "SECRET_KEY": "example"}, {"DB_HOST": "remote.example.com"}]:
            with self.subTest(values=values), self.assertRaisesRegex(ValueError, "local MySQL"):
                config_for(DEMO_VERIFICATION="1", **values)

    def test_configuration_is_read_again_for_each_app(self):
        first = config_for(GEMINI_MODEL="gemini-3.5-flash-lite")
        second = config_for(GEMINI_MODEL="gemini-3.8-flash")
        self.assertNotEqual(first.GEMINI_MODEL, second.GEMINI_MODEL)

class GeminiTests(unittest.TestCase):
    def setUp(self):
        self.config = config_for(GEMINI_API_KEY="test-key-never-public", GEMINI_MODEL="gemini-3.5-flash-lite")
        self.app = create_app(self.config)

    def test_uses_configured_key_model_and_returns_text(self):
        with self.app.app_context(), patch("app.services.ai.genai.Client") as factory:
            client = factory.return_value.__enter__.return_value
            client.models.generate_content.return_value = SimpleNamespace(text="  OK  ")
            self.assertEqual(generate_text("Say OK"), "OK")
            self.assertEqual(factory.call_args.kwargs["api_key"], "test-key-never-public")
            request = client.models.generate_content.call_args.kwargs
            self.assertEqual(request["model"], "gemini-3.5-flash-lite")
            self.assertEqual(request["contents"], "Say OK")

    def test_missing_key_does_not_attempt_network_request(self):
        self.app.config["GEMINI_API_KEY"] = ""
        with self.app.app_context(), patch("app.services.ai.genai.Client") as factory:
            with self.assertRaisesRegex(AIServiceError, "GEMINI_API_KEY"):
                generate_text("Say OK")
            factory.assert_not_called()

    def test_auth_failure_does_not_expose_provider_error_or_key(self):
        with self.app.app_context(), patch("app.services.ai.genai.Client") as factory:
            client = factory.return_value.__enter__.return_value
            client.models.generate_content.side_effect = errors.ClientError(
                401, {"error": {"message": "test-key-never-public is invalid"}}, None,
            )
            with self.assertRaises(AIServiceError) as error:
                generate_text("Say OK")
            self.assertIn("HTTP 401", str(error.exception))
            self.assertNotIn("test-key-never-public", str(error.exception))

    def test_billing_denial_explains_the_required_project_setup(self):
        with self.app.app_context(), patch("app.services.ai.genai.Client") as factory:
            client = factory.return_value.__enter__.return_value
            client.models.generate_content.side_effect = errors.ClientError(
                403, {"error": {"message": "The Gemini API free tier is not available for this project. Set up billing."}}, None,
            )
            with self.assertRaisesRegex(AIServiceError, "Enable billing"):
                generate_text("Say OK")

    def test_timeout_is_reported_without_request_details(self):
        with self.app.app_context(), patch("app.services.ai.genai.Client") as factory:
            client = factory.return_value.__enter__.return_value
            client.models.generate_content.side_effect = httpx.ReadTimeout("sensitive request details")
            with self.assertRaisesRegex(AIServiceError, "timed out"):
                generate_text("Say OK")

    def test_blank_model_output_is_an_error(self):
        with self.app.app_context(), patch("app.services.ai.genai.Client") as factory:
            factory.return_value.__enter__.return_value.models.generate_content.return_value = SimpleNamespace(text=None)
            with self.assertRaisesRegex(AIServiceError, "no text"):
                generate_text("Say OK")


if __name__ == "__main__":
    unittest.main()
