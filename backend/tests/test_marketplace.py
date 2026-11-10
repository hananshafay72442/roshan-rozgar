import io
import tempfile
import unittest
import wave
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch

from app import create_app
from app.config import Config


def wav_data():
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as audio:
        audio.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
        audio.writeframes(b"\0" * 1600)
    return buffer.getvalue()


class MarketplaceTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        with patch.dict("os.environ", {}, clear=True):
            config = Config()
        config.TESTING = True
        config.SECRET_KEY = "test-only"
        config.SEED_SAMPLE_DATA = False
        config.SQLALCHEMY_DATABASE_URI = f"sqlite:///{directory.name}/marketplace.db"
        self.app = create_app(config)

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
            import time
            with patch("app.main.auth.time.time", return_value=time.time() + 35):
                self.assertEqual(self.post(client, "/auth/code", {"phone": payload["phone"], "intent": "login"}).status_code, 201)
                self.assertEqual(self.post(client, "/auth/verify", {"code": "987654"}).json["user"]["role"], "worker")

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
