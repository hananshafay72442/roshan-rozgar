"""Server-side Gemini adapter. Never send the API key to the frontend."""

import httpx
from flask import current_app
from google import genai
from google.genai import errors, types


class AIServiceError(RuntimeError):
    pass


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
