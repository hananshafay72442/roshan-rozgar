import io
import os
import time
import unittest
import wave
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch

from sqlalchemy import inspect
from sqlalchemy.engine import make_url

from app import create_app
from app.config import LOCAL_DB_HOSTS, Config
from app.extensions import db
from app.models import Account, RateBucket


def wav_data():
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as audio:
        audio.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
        audio.writeframes(b"\0" * 1600)
    return buffer.getvalue()


class MarketplaceTests(unittest.TestCase):
    def setUp(self):
        test_url = os.environ.get("TEST_MYSQL_URL")
        if not test_url:
            self.skipTest("Set TEST_MYSQL_URL to run the MySQL integration suite.")
        url = make_url(test_url)
        if url.drivername != "mysql+pymysql" or url.host not in LOCAL_DB_HOSTS or url.database != "roshan_test":
            self.fail("TEST_MYSQL_URL must target a dedicated local MySQL database named roshan_test.")
        settings = {
            "APP_ENV": "testing", "DB_HOST": url.host, "DB_PORT": str(url.port or 3306),
            "DB_NAME": url.database, "DB_USER": url.username or "", "DB_PASSWORD": url.password or "",
            "DB_SSL": "0", "DEMO_VERIFICATION": "1", "SECRET_KEY": "test-only",
        }
        with patch.dict("os.environ", settings, clear=True):
            config = Config()
        config.TESTING = True
        self.app = create_app(config)
        with self.app.app_context():
            if inspect(db.engine).get_table_names():
                self.fail("Use an empty roshan_test database for integration tests.")
        self.addCleanup(self.drop_test_tables)
        self.initialize_database()

    def initialize_database(self):
        result = self.app.test_cli_runner().invoke(args=["init-marketplace"])
        self.assertEqual(result.exit_code, 0, result.output)

    def drop_test_tables(self):
        with self.app.app_context():
            db.drop_all()
            db.engine.dispose()

    @staticmethod
    def headers(client):
        return {"X-CSRF-Token": client.get("/api/session").json["csrf_token"]}

    def post(self, client, path, payload=None):
        return client.post(f"/api{path}", json=payload, headers=self.headers(client))

    def verified(self, role, suffix):
        client = self.app.test_client()
        start = self.post(client, "/auth/code", {
            "phone": f"030010000{suffix:02}", "intent": "register", "role": role,
        })
        self.assertEqual(start.status_code, 201, start.json)
        verify = self.post(client, "/auth/verify", {"code": start.json["demo_code"]})
        self.assertEqual(verify.status_code, 200, verify.json)
        self.assertEqual(verify.json["user"]["role"], role)
        return client

    def new_worker(self):
        worker = self.verified("worker", 1)
        created = self.post(worker, "/profile", {
            "name": "Test Electrician", "city": "Islamabad", "area": "G-10",
            "service_id": "electrician", "experience_years": 12,
        })
        self.assertEqual(created.status_code, 201, created.json)
        result = worker.get("/api/profile").json["profile"]
        return worker, result["id"]

    def test_local_code_requires_csrf_is_single_use_and_limits_guesses(self):
        client = self.app.test_client()
        payload = {"phone": "03001000001", "role": "worker", "intent": "register"}
        self.assertEqual(client.post("/api/auth/code", json=payload).status_code, 403)
        started = self.post(client, "/auth/code", payload)
        code = started.json["demo_code"]
        self.assertRegex(code, r"^\d{6}$")
        self.assertEqual(self.post(client, "/auth/code", payload).status_code, 429)
        self.assertEqual(self.post(self.app.test_client(), "/auth/verify", {"code": code}).status_code, 400)
        wrong = "123456" if code != "123456" else "654321"
        for _ in range(5):
            self.assertIn("didn’t match", self.post(client, "/auth/verify", {"code": wrong}).json["error"])
        self.assertIn("too many attempts", self.post(client, "/auth/verify", {"code": code}).json["error"])
        valid = self.verified("customer", 2)
        self.assertEqual(self.post(valid, "/auth/verify", {"code": code}).status_code, 400)
        self.assertIsNone(self.post(valid, "/auth/logout").json["user"])
        self.assertEqual(valid.get("/api/jobs").status_code, 401)

    def test_live_sms_contract_creates_and_signs_in_existing_account(self):
        self.app.config["TWILIO_VERIFY_SERVICE_SID"] = "fake-service"
        client = self.app.test_client()
        payload = {"phone": "03001000003", "role": "worker", "intent": "register"}
        with patch("app.main.auth.send_sms") as send, patch("app.main.auth.check_sms", return_value=True) as check:
            response = self.post(client, "/auth/code", payload)
            self.assertEqual(response.status_code, 201)
            self.assertIsNone(response.json["demo_code"])
            send.assert_called_once_with("+923001000003")
            result = self.post(client, "/auth/verify", {"code": "987654"})
            check.assert_called_once_with("+923001000003", "987654")
            self.assertEqual(result.json["user"]["verification"], "sms")
            self.assertIsNone(self.post(client, "/auth/logout").json["user"])
            # Another code window has elapsed.
            with patch("app.main.auth.time.time", return_value=time.time() + 35):
                self.assertEqual(self.post(client, "/auth/code", {"phone": payload["phone"], "intent": "login"}).status_code, 201)
                self.assertEqual(self.post(client, "/auth/verify", {"code": "987654"}).json["user"]["role"], "worker")

    def test_password_registration_and_login_without_email_delivery(self):
        self.app.config.update(DEMO_VERIFICATION=False, RESEND_API_KEY="", RESEND_FROM_EMAIL="")
        client = self.app.test_client()
        payload = {"email": "Customer@EXAMPLE.COM", "password": "test-only-password", "role": "customer", "intent": "register"}
        self.assertEqual(client.get("/api/session").json["verification_modes"]["email"], "unavailable")
        result = self.post(client, "/auth/password", payload)
        self.assertEqual(result.status_code, 201, result.json)
        self.assertEqual(result.json["user"]["role"], "customer")
        self.assertEqual(result.json["user"]["verification"], "none")
        with self.app.app_context():
            account = db.session.scalar(db.select(Account).where(Account.email == "customer@example.com"))
            self.assertTrue(account.password_hash.startswith("scrypt:"))
            self.assertNotIn(payload["password"], account.password_hash)
        self.assertEqual(self.post(self.app.test_client(), "/auth/password", payload).status_code, 409)
        self.assertIsNone(self.post(client, "/auth/logout").json["user"])
        login = {"email": "customer@example.com", "password": payload["password"], "intent": "login"}
        self.assertEqual(self.post(client, "/auth/password", login | {"password": "wrong-password"}).status_code, 401)
        self.assertEqual(self.post(client, "/auth/password", login).json["user"]["role"], "customer")

    def test_live_email_code_creates_an_account_and_signs_it_back_in(self):
        self.app.config.update(RESEND_API_KEY="test-key", RESEND_FROM_EMAIL="verify@example.com")
        client = self.app.test_client()
        self.assertEqual(client.get("/api/session").json["verification_modes"], {"email": "email", "sms": "demo"})
        payload = {"channel": "email", "email": "Worker@EXAMPLE.COM", "role": "worker", "intent": "register"}
        with patch("app.main.auth.secrets.randbelow", return_value=482716), patch("app.services.verification.httpx.post") as send:
            started = self.post(client, "/auth/code", payload)
            self.assertEqual(started.status_code, 201, started.json)
            self.assertIsNone(started.json["demo_code"])
            self.assertNotIn("482716", started.get_data(as_text=True))
            self.assertEqual(send.call_args.args, ("https://api.resend.com/emails",))
            message = send.call_args.kwargs["json"]
            self.assertEqual(message["from"], "verify@example.com")
            self.assertEqual(message["to"], ["worker@example.com"])
            self.assertIn("482716", message["text"])
            self.assertEqual(self.post(self.app.test_client(), "/auth/verify", {"code": "482716"}).status_code, 400)
            self.assertEqual(self.post(client, "/auth/verify", {"code": "482717"}).status_code, 400)

            verified = self.post(client, "/auth/verify", {"code": "482716"})
            self.assertEqual(verified.status_code, 200, verified.json)
            self.assertEqual(verified.json["user"]["verification"], "email")
            password_attempt = payload | {"password": "test-only-password"}
            self.assertEqual(self.post(self.app.test_client(), "/auth/password", password_attempt).status_code, 409)
            self.assertEqual(self.post(client, "/auth/verify", {"code": "482716"}).status_code, 400)
            self.assertIsNone(self.post(client, "/auth/logout").json["user"])

            login = {"channel": "email", "email": "worker@example.com", "intent": "login"}
            with patch("app.main.auth.time.time", return_value=time.time() + 35):
                self.assertEqual(self.post(client, "/auth/code", login).status_code, 201)
                result = self.post(client, "/auth/verify", {"code": "482716"})
                self.assertEqual(result.json["user"]["role"], "worker")

    def test_parallel_email_requests_share_an_ip_quota(self):
        barrier = Barrier(4)

        def request_code(index):
            client = self.app.test_client()
            headers = self.headers(client)
            barrier.wait(timeout=5)
            response = client.post("/api/auth/code", headers=headers, json={
                "channel": "email", "email": f"user{index}@example.com",
                "role": "customer", "intent": "register",
            })
            return response.status_code

        with ThreadPoolExecutor(max_workers=4) as pool:
            self.assertEqual(list(pool.map(request_code, range(4))), [201] * 4)
        with self.app.app_context():
            count = db.session.scalar(db.select(RateBucket.count).where(RateBucket.key.startswith("issue-ip:")))
            self.assertEqual(count, 4)

    def test_mysql_upgrade_preserves_phone_accounts_profiles_and_jobs(self):
        _, worker_id = self.new_worker()
        customer = self.verified("customer", 2)
        created = self.post(customer, "/jobs", {"worker_id": worker_id, "text": "A loose socket."})
        job_id = created.json["job"]["id"]
        with self.app.app_context(), db.engine.begin() as connection:
            connection.exec_driver_sql("DROP TABLE email_verification_challenge")
            connection.exec_driver_sql("ALTER TABLE account DROP COLUMN email, DROP COLUMN password_hash, MODIFY COLUMN phone VARCHAR(16) NOT NULL")
        self.initialize_database()
        self.initialize_database()
        client = self.app.test_client()
        with patch("app.main.auth.time.time", return_value=time.time() + 35):
            started = self.post(client, "/auth/code", {"phone": "03001000002", "intent": "login"})
            result = self.post(client, "/auth/verify", {"code": started.json["demo_code"]})
            self.assertEqual(result.json["user"]["role"], "customer")
            self.assertEqual(client.get(f"/api/jobs/{job_id}").status_code, 200)
            self.assertEqual(client.get("/api/workers").json["workers"][0]["id"], worker_id)
        for role in ("worker", "customer"):
            client = self.app.test_client()
            started = self.post(client, "/auth/code", {
                "channel": "email", "email": f"{role}@example.com", "intent": "register", "role": role,
            })
            self.assertEqual(started.status_code, 201, started.json)
            result = self.post(client, "/auth/verify", {"code": started.json["demo_code"]})
            self.assertEqual(result.json["user"]["role"], role)

    def test_database_check_runs_a_mysql_query(self):
        result = self.app.test_cli_runner().invoke(args=["check-db"])
        self.assertEqual(result.exit_code, 0, result.output)
        self.assertIn("succeeded", result.output)

    def test_seed_switch_controls_the_catalog(self):
        client = self.app.test_client()
        self.assertEqual(client.get("/api/workers").json["total"], 0)
        self.app.config["SEED_SAMPLE_DATA"] = True
        self.initialize_database()
        self.assertEqual(client.get("/api/workers").json["total"], 12)
        self.assertEqual(len(client.get("/api/services").json["services"]), 6)
        self.assertEqual(client.get("/api/health").status_code, 200)

    def test_missing_sms_setup_is_visible_before_asking_for_a_code(self):
        client = self.app.test_client()
        self.assertEqual(client.get("/api/session").json["verification_mode"], "demo")
        self.app.config["DEMO_VERIFICATION"] = False
        session = client.get("/api/session").json
        self.assertEqual(session["verification_mode"], "unavailable")
        self.assertEqual(session["verification_modes"], {"email": "unavailable", "sms": "unavailable"})
        result = self.post(client, "/auth/code", {
            "phone": "03001000003", "role": "worker", "intent": "register",
        })
        self.assertEqual(result.status_code, 503)
        self.assertNotIn("demo_code", result.json)
        result = self.post(client, "/auth/code", {
            "channel": "email", "email": "worker@example.com", "role": "worker", "intent": "register",
        })
        self.assertEqual(result.status_code, 503)
        self.assertNotIn("demo_code", result.json)

    def test_check_sms_reads_the_service_without_sending_a_code(self):
        self.app.config.update(
            TWILIO_ACCOUNT_SID="test-account", TWILIO_AUTH_TOKEN="test-token",
            TWILIO_VERIFY_SERVICE_SID="test-service",
        )
        with patch("app.services.verification.httpx.get") as read:
            read.return_value.json.return_value = {"code_length": 6}
            result = self.app.test_cli_runner().invoke(args=["check-sms"])
            self.assertEqual(result.exit_code, 0, result.output)
            read.assert_called_once_with(
                "https://verify.twilio.com/v2/Services/test-service",
                auth=("test-account", "test-token"), timeout=8,
            )
            read.return_value.json.return_value = {"code_length": 4}
            result = self.app.test_cli_runner().invoke(args=["check-sms"])
            self.assertNotEqual(result.exit_code, 0)
            self.assertIn("six digits", result.output)

    def test_booking_is_atomic_and_review_updates_discovery(self):
        worker, worker_id = self.new_worker()
        customers = [self.verified("customer", index) for index in (2, 3)]
        available = f"/api/workers?city=Islamabad&area=G-10&service=electrician&available=true"
        self.assertEqual(customers[0].get(available).json["workers"][0]["distance_km"], 0.0)
        jobs = []
        for customer in customers:
            result = self.post(customer, "/jobs", {"worker_id": worker_id, "text": "Switch needs fixing."})
            self.assertEqual(result.status_code, 201, result.json)
            jobs.append(result.json["job"]["id"])
        for job in jobs:
            self.assertEqual(self.post(worker, f"/jobs/{job}/quote", {"quote_pkr": 1250}).status_code, 200)
        self.assertEqual(self.post(customers[0], f"/jobs/{jobs[0]}/accept", {"quote_pkr": 1100}).status_code, 409)
        self.assertEqual(customers[1].get(f"/api/jobs/{jobs[0]}").status_code, 404)

        barrier = Barrier(2)

        def accept(pair):
            customer, job = pair
            headers = self.headers(customer)
            barrier.wait(timeout=5)
            return customer.post(f"/api/jobs/{job}/accept", json={"quote_pkr": 1250}, headers=headers).status_code

        with ThreadPoolExecutor(max_workers=2) as executor:
            outcomes = list(executor.map(accept, zip(customers, jobs)))
        self.assertEqual(sorted(outcomes), [200, 409])
        winner = outcomes.index(200)
        job = jobs[winner]
        customer = customers[winner]
        self.assertEqual(customer.get(available).json["total"], 0)
        self.assertEqual(customers[1 - winner].get(f"/api/jobs/{jobs[1 - winner]}").json["job"]["state"], "quoted")
        self.assertEqual(self.post(customer, f"/jobs/{job}/review", {"rating": 5}).status_code, 409)
        self.assertEqual(self.post(worker, f"/jobs/{job}/complete").status_code, 200)
        self.assertEqual(customer.get(available).json["total"], 1)
        self.assertEqual(self.post(customer, f"/jobs/{job}/review", {"rating": 5, "text": "Arrived on time."}).status_code, 201)
        self.assertEqual(self.post(customer, f"/jobs/{job}/review", {"rating": 4}).status_code, 409)
        self.assertEqual(customer.get(available).json["workers"][0]["rating"], 5.0)

    def test_voice_messages_are_playable_only_by_job_participants(self):
        worker, worker_id = self.new_worker()
        customer = self.verified("customer", 2)
        audio = wav_data()
        response = customer.post("/api/jobs", data={
            "worker_id": str(worker_id), "audio": (io.BytesIO(audio), "note.wav", "audio/wav"),
        }, headers=self.headers(customer))
        self.assertEqual(response.status_code, 201, response.json)
        job = response.json["job"]["id"]
        detail = worker.get(f"/api/jobs/{job}").json
        url = detail["messages"][0]["audio_url"]
        with worker.get(url) as playback:
            self.assertEqual(playback.content_type, "audio/wav")
            self.assertEqual(playback.data, audio)
        other = self.verified("customer", 3)
        self.assertEqual(other.get(url).status_code, 404)
        rejected = worker.post(f"/api/jobs/{job}/messages", data={
            "audio": (io.BytesIO(b"<html>"), "note.wav", "audio/wav"),
        }, headers=self.headers(worker))
        self.assertEqual(rejected.status_code, 400)

    def test_gemini_profile_draft_is_validated_before_use(self):
        worker = self.verified("worker", 1)
        raw = '{"name":"Ali","service_id":"electrician","city":"Islamabad","area":"Unknown","experience_years":8}'
        with patch("app.main.voice.generate_content", return_value=raw):
            response = worker.post("/api/voice/profile", data={
                "audio": (io.BytesIO(wav_data()), "profile.wav", "audio/wav"),
            }, headers=self.headers(worker))
        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(response.json["profile"]["area"], "")
        self.assertEqual(response.json["profile"]["experience_years"], 8)
        self.assertEqual(self.post(worker, "/profile", response.json["profile"]).status_code, 400)


if __name__ == "__main__":
    unittest.main()
