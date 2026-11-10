import json
import unittest
from unittest.mock import patch

import httpx
from flask import Flask

from app.services.ai import AIServiceError, groq_audio_profile


class GroqTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(GROQ_API_KEY="private-test-key", GROQ_MODEL="openai/gpt-oss-20b",
                               GROQ_SPEECH_MODEL="whisper-large-v3-turbo")

    def run_provider(self, handler):
        client = httpx.Client(base_url="https://api.groq.com/openai/v1/",
                              transport=httpx.MockTransport(handler))
        with self.app.app_context(), patch("app.services.ai.httpx.Client", return_value=client):
            return groq_audio_profile(b"audio", "audio/webm", "Extract JSON, never invent fields.")

    def test_transcript_is_passed_as_untrusted_user_input(self):
        seen = []
        def handler(request):
            seen.append(request.url.path)
            if request.url.path.endswith("transcriptions"):
                self.assertIn(b'filename="profile.webm"', request.content)
                return httpx.Response(200, json={"text": "Ahmed, electrician in G-10"})
            payload = json.loads(request.content)
            self.assertEqual(payload["messages"][1], {"role": "user", "content": "Ahmed, electrician in G-10"})
            self.assertEqual(payload["response_format"], {"type": "json_object"})
            return httpx.Response(200, json={"choices": [{"message": {"content": '{"name":"Ahmed"}'}}]})
        self.assertEqual(json.loads(self.run_provider(handler))["name"], "Ahmed")
        self.assertEqual(len(seen), 2)

    def test_provider_error_does_not_expose_body(self):
        with self.assertRaises(AIServiceError) as error:
            self.run_provider(lambda request: httpx.Response(401, text="private-test-key"))
        self.assertNotIn("private-test-key", str(error.exception))

    def test_empty_transcript_stops_before_extraction(self):
        calls = []
        def handler(request):
            calls.append(request.url.path)
            return httpx.Response(200, json={"text": ""})
        with self.assertRaises(AIServiceError):
            self.run_provider(handler)
        self.assertEqual(len(calls), 1)

    def test_malformed_provider_response_is_a_safe_error(self):
        with self.assertRaises(AIServiceError):
            self.run_provider(lambda request: httpx.Response(200, json={"text": "Ahmed", "choices": []}))
