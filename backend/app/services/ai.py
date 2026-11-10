"""Server-side Gemini adapter. Never send the API key to the frontend."""

import httpx
from flask import current_app
from google import genai
from google.genai import errors, types


class AIServiceError(RuntimeError):
    pass


def groq_audio_profile(audio, mime, instructions):
    """Transcribe speech, then extract a profile. The caller validates every field."""
    key = current_app.config.get("GROQ_API_KEY")
    extensions = {"audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/wav": "wav", "audio/mpeg": "mp3"}
    extension = extensions.get(mime.split(";")[0], "webm")
    try:
        with httpx.Client(base_url="https://api.groq.com/openai/v1/", timeout=12,
                          headers={"Authorization": f"Bearer {key}"}) as client:
            response = client.post("audio/transcriptions", files={"file": (f"profile.{extension}", audio, mime)},
                                   data={"model": current_app.config["GROQ_SPEECH_MODEL"], "response_format": "json"})
            response.raise_for_status()
            transcript = response.json().get("text", "")
            if not isinstance(transcript, str) or not transcript.strip():
                raise AIServiceError("No speech was detected.")
            response = client.post("chat/completions", json={
                "model": current_app.config["GROQ_MODEL"],
                "messages": [{"role": "system", "content": instructions},
                             {"role": "user", "content": transcript[:12000]}],
                "response_format": {"type": "json_object"}, "max_completion_tokens": 2048,
            })
            response.raise_for_status()
            result = response.json()["choices"][0]["message"]["content"]
            if not isinstance(result, str) or not result.strip():
                raise AIServiceError("No profile was returned.")
            return result
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError):
        raise AIServiceError("Groq voice assistance is unavailable. Check API access and quota.") from None


def generate_text(prompt, *, system_instruction=None):
    if not isinstance(prompt, str) or not prompt.strip():
        raise ValueError("A non-empty prompt is required.")
    return generate_content(prompt, types.GenerateContentConfig(
        system_instruction=system_instruction, max_output_tokens=512,
    ))


def generate_content(contents, options):
    api_key = current_app.config.get("GEMINI_API_KEY")
    if not api_key:
        raise AIServiceError("Set GEMINI_API_KEY in backend/.env to enable Gemini.")

    try:
        with genai.Client(
            api_key=api_key,
            vertexai=False,
            http_options=types.HttpOptions(
                api_version="v1beta", timeout=15000,
                retry_options=types.HttpRetryOptions(attempts=1),
            ),
        ) as client:
            response = client.models.generate_content(
                model=current_app.config["GEMINI_MODEL"],
                contents=contents, config=options,
            )
            result = response.text
    except errors.APIError as error:
        message = str(error.message).lower()
        if error.code == 403 and "free tier" in message and "billing" in message:
            raise AIServiceError(
                "This Google project has no Gemini free-tier access. Enable billing in "
                "Google AI Studio or use a project with available API access."
            ) from None
        raise AIServiceError(
            f"Gemini request failed (HTTP {error.code}). Check the key, model, and quota."
        ) from None
    except httpx.TimeoutException:
        raise AIServiceError("Gemini timed out. Try again shortly.") from None
    except httpx.HTTPError:
        raise AIServiceError("Cannot reach Gemini. Check the server's network connection.") from None

    if not result or not result.strip():
        raise AIServiceError("Gemini returned no text. Try another prompt or check the model.")
    return result.strip()
