"""Exercise the real HTTP flows with isolated storage and mocked face-provider calls."""
import io
import json
import unittest
from unittest.mock import Mock, patch

from botocore.exceptions import EndpointConnectionError
from PIL import Image
from sqlalchemy.dialects.mysql import MEDIUMBLOB
from sqlalchemy.ext.compiler import compiles

from app import create_app
from app.extensions import db
from app.models import Account, Booking, CustomerProfile, Review, WorkerIdentity, WorkerProfile
from test_configuration import config_for


@compiles(MEDIUMBLOB, "sqlite")
def sqlite_blob(_type, _compiler, **_kw):
    return "BLOB"


def photo(color="red"):
    buffer = io.BytesIO()
    Image.new("RGB", (320, 240), color).save(buffer, "JPEG")
    return buffer.getvalue()


class IdentityReviewTests(unittest.TestCase):
    def setUp(self):
        config = config_for()
        config.SQLALCHEMY_DATABASE_URI = "sqlite://"
        config.SQLALCHEMY_ENGINE_OPTIONS = {}
        config.TESTING = True
        self.app = create_app(config)
        with self.app.app_context():
            db.create_all()
            for role in ("worker", "customer", "admin", "customer"):
                db.session.add(Account(role=role, verification="none"))
            db.session.commit()
            db.session.add(WorkerProfile(user_id=1, name="Test Worker", service_id="electrician",
                                        city="Islamabad", area="G-10", experience_years=5, moderation="pending"))
            db.session.add(CustomerProfile(user_id=2, name="Customer", city="Islamabad", area="G-10"))
            db.session.commit()
        self.worker, self.customer, self.admin, self.other = [self.client(i) for i in range(1, 5)]
        self.headers = {"X-CSRF-Token": "test-csrf"}
        self.quota = patch("app.main.identity.reserve_quota")
        self.quota.start()
        self.addCleanup(self.quota.stop)
        self.addCleanup(self.cleanup)

    def cleanup(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
            db.engine.dispose()

    def client(self, account_id):
        client = self.app.test_client()
        with client.session_transaction() as session:
            session.update(account_id=account_id, csrf_token="test-csrf")
        return client

    def upload(self, client=None, **values):
        data = {"selfie": (io.BytesIO(photo()), "selfie.jpg"),
                "cnic_front": (io.BytesIO(photo("blue")), "cnic.jpg"), "identity_consent": "true"}
        data.update(values)
        return (client or self.worker).post("/api/profile/identity", data=data, headers=self.headers)

    def decision(self, **values):
        item = self.admin.get("/api/admin/review").json["profiles"][0]
        return self.admin.patch("/api/admin/review/profiles/1", headers=self.headers, json={
            "decision": "approved", "identity_confirmed": True,
            "identity_version": item["identity"]["version"], **values,
        })

    def test_manual_submission_private_photos_and_admin_approval(self):
        self.assertEqual(self.admin.get("/api/admin/review").json["profiles"], [])
        result = self.upload()
        self.assertEqual(result.status_code, 201, result.json)
        self.assertEqual(result.json["identity"]["face_check"], "manual_review")
        url = self.admin.get("/api/admin/review").json["profiles"][0]["identity"]["cnic_url"]
        self.assertEqual(self.worker.get(url).status_code, 200)
        self.assertEqual(self.admin.get(url).content_type, "image/jpeg")
        self.assertIn("no-store", self.admin.get(url).headers["Cache-Control"])
        self.assertEqual(self.customer.get(url).status_code, 404)
        self.assertEqual(self.other.get(url).status_code, 404)
        self.assertEqual(self.app.test_client().get(url).status_code, 401)
        self.assertEqual(self.decision(identity_confirmed=False).status_code, 400)
        self.assertEqual(self.decision().status_code, 200)
        with self.app.app_context():
            identity = db.session.scalar(db.select(WorkerIdentity))
            self.assertEqual(identity.reviewed_by, 3)
            self.assertIsNotNone(identity.reviewed_at)
        public = self.customer.get("/api/workers").json["workers"][0]
        self.assertNotIn("identity", public)
        self.assertNotIn("cnic_front", public)

    def test_photos_consent_csrf_and_role_are_required(self):
        self.assertEqual(self.upload(self.customer).status_code, 403)
        self.assertEqual(self.upload(identity_consent="false").status_code, 400)
        self.assertEqual(self.upload(cnic_front="").status_code, 400)
        self.assertEqual(self.upload(cnic_front=(io.BytesIO(b"<svg/>"), "cnic.jpg")).status_code, 400)
        self.assertEqual(self.upload(cnic_front=(io.BytesIO(photo()), "cnic.jpg")).status_code, 400)
        self.assertEqual(self.upload(cnic_front=(io.BytesIO(b"x" * 700001), "cnic.jpg")).status_code, 400)
        self.assertEqual(self.worker.post("/api/profile/identity", data={}).status_code, 403)
        self.assertEqual(self.admin.patch("/api/admin/review/profiles/1", headers=self.headers,
                                         json={"decision": "approved"}).status_code, 409)

    def test_automatic_match_submits_but_does_not_auto_approve(self):
        self.app.config["REKOGNITION_REGION"] = "test-region"
        client = Mock()
        client.detect_faces.return_value = {"FaceDetails": [{"Confidence": 99.9}]}
        client.compare_faces.return_value = {"FaceMatches": [{"Similarity": 98.6}]}
        with patch("app.services.identity.boto3.client", return_value=client):
            result = self.upload()
        self.assertEqual(result.status_code, 201, result.json)
        self.assertEqual(result.json["identity"]["face_check"], "matched")
        self.assertEqual(result.json["moderation"], "pending")
        self.assertEqual(client.detect_faces.call_count, 2)
        self.assertEqual(client.compare_faces.call_args.kwargs["SimilarityThreshold"], 95)

    def test_mismatch_multiple_faces_and_provider_failure_do_not_submit(self):
        self.app.config["REKOGNITION_REGION"] = "test-region"
        client = Mock()
        client.detect_faces.return_value = {"FaceDetails": [{"Confidence": 99.9}]}
        client.compare_faces.return_value = {"FaceMatches": []}
        with patch("app.services.identity.boto3.client", return_value=client):
            self.assertEqual(self.upload().status_code, 400)
            client.detect_faces.return_value = {"FaceDetails": [{"Confidence": 99.9}] * 2}
            self.assertEqual(self.upload().status_code, 400)
        with patch("app.services.identity.boto3.client", side_effect=EndpointConnectionError(endpoint_url="test")):
            self.assertEqual(self.upload().status_code, 503)
        self.assertEqual(self.admin.get("/api/admin/review").json["profiles"], [])

    def test_resubmission_preserves_booking_and_rejects_stale_admin_decision(self):
        self.upload()
        old = self.admin.get("/api/admin/review").json["profiles"][0]["identity"]["version"]
        self.assertEqual(self.decision().status_code, 200)
        with self.app.app_context():
            profile = db.session.get(WorkerProfile, 1)
            profile.active_booking_id = 77
            profile.taking_work = False
            db.session.commit()
        self.assertEqual(self.upload().status_code, 201)
        self.assertEqual(self.decision(identity_version=old).status_code, 409)
        with self.app.app_context():
            profile = db.session.get(WorkerProfile, 1)
            self.assertEqual((profile.moderation, profile.active_booking_id, profile.taking_work), ("pending", 77, False))
            self.assertEqual(db.session.query(WorkerIdentity).count(), 1)
            self.assertIsNone(db.session.scalar(db.select(WorkerIdentity)).reviewed_by)

    def test_new_profile_and_identity_saved_in_one_submission(self):
        with self.app.app_context():
            db.session.add(Account(role="worker", verification="none"))
            db.session.commit()
        data = {"profile": json.dumps({"name": "New Worker", "city": "Islamabad", "area": "G-10",
                                       "service_id": "electrician", "experience_years": 3}),
                "selfie": (io.BytesIO(photo()), "selfie.jpg"),
                "cnic_front": (io.BytesIO(photo("blue")), "cnic.jpg"), "identity_consent": "true"}
        with patch("app.main.jobs.reserve_quota"):
            result = self.client(5).post("/api/profile", data=data, headers=self.headers)
        self.assertEqual(result.status_code, 201, result.json)
        self.assertTrue(result.json["user"]["profile_complete"])
        self.assertEqual(len(self.admin.get("/api/admin/review").json["profiles"]), 1)

    def test_customer_completes_and_reviews_once_and_rating_is_public(self):
        with self.app.app_context():
            profile = db.session.get(WorkerProfile, 1)
            profile.moderation = "approved"
            job = Booking(customer_id=2, worker_id=1, state="confirmed", quote_pkr=1000)
            db.session.add(job)
            db.session.flush()
            profile.active_booking_id = job.id
            db.session.commit()
        def post(client, action, data=None):
            return client.post(f"/api/jobs/1/{action}", json=data or {}, headers=self.headers)
        self.assertEqual(post(self.customer, "review", {"rating": 5}).status_code, 409)
        self.assertEqual(post(self.other, "complete").status_code, 404)
        self.assertEqual(post(self.customer, "complete").status_code, 200)
        self.assertEqual(post(self.worker, "review", {"rating": 5}).status_code, 403)
        self.assertEqual(post(self.other, "review", {"rating": 5}).status_code, 404)
        for rating in (0, 6, True, "5"):
            self.assertEqual(post(self.customer, "review", {"rating": rating}).status_code, 400)
        self.assertEqual(post(self.customer, "review", {"rating": 5, "text": "  Great work!  "}).status_code, 201)
        self.assertEqual(post(self.customer, "review", {"rating": 4}).status_code, 409)
        self.assertTrue(self.customer.get("/api/jobs").json["jobs"][0]["reviewed"])
        catalog = self.customer.get("/api/workers").json["workers"][0]
        self.assertEqual((catalog["rating"], catalog["review_count"], catalog["available"]), (5, 1, True))
        self.assertEqual(self.customer.get("/api/workers/1/reviews").json["reviews"][0]["text"], "Great work!")


if __name__ == "__main__":
    unittest.main()
