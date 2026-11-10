# Roshan Rozgar · روشن روزگار

A neighbourhood marketplace for skilled trades in Islamabad and Rawalpindi.
Built with React, Vite, GSAP, Flask, SQLAlchemy, SQLite for local demos, and
MySQL/TiDB for shared deployments.

## Hackathon flow

| Outcome | What to demonstrate |
| --- | --- |
| Onboarding | Register as a worker by phone. Record a short introduction in Urdu, Roman Urdu or English. Gemini extracts the name, trade, neighbourhood and experience. Listen to or check the draft, correct any gaps, then publish. The guided path offers trade icons, tap choices and speech prompts. |
| Discovery | Choose a city, neighbourhood and trade. Browse available workers in approximate distance order and open reviews. |
| Communication | Request a worker. Both accounts can exchange text or playable voice notes. The worker sends a quote in PKR and the customer sees that exact price before accepting. |
| Booking | Accept the quote. The worker becomes booked in the same database transaction and a second customer cannot confirm them. Completing or cancelling the booking releases the worker according to their availability setting. |
| Trust | The customer can leave one review for a completed job. Its rating and note appear in the worker’s public reviews. A phone verification badge indicates SMS verification. |

Payments, government identity checks and native apps are outside the project
scope. A local demo is supported for judging.

## Run locally

Use Python 3.11+ and Node 22.12+. Run from the repository root.

```powershell
python -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
npm --prefix frontend ci --include=dev
npm run dev
```

On Linux or macOS, use `backend/.venv/bin/python` for the install command.
Open the URL printed by Vite, usually `http://localhost:5173`. The root script
starts Flask on port 5000 and Vite proxies requests to it. Local SQLite creates
the schema and seeds sample records on first run. Its database lives in
`backend/instance/`.

To run the compiled site and API together, run `npm run build` from the root
and `python -m flask --app wsgi:app run` from `backend/` using the virtual
environment. Flask serves the built frontend. The existing Dockerfile also
builds both and runs Gunicorn on port 8000 by default.

## Verification, AI and shared database

Copy `backend/.env.example` to `backend/.env` for optional configuration.

| Setting | Purpose |
| --- | --- |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` | Enable real passwordless SMS sign-up and sign-in with a six-digit Twilio Verify service. All three are required for live SMS. |
| `DEMO_VERIFICATION` | Local SQLite defaults to a clearly labelled, one-time demo code shown in the browser. Set to `0` to require SMS. Demo verification is unavailable on a shared database or in production. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Enable voice-to-profile extraction through the Google Gemini Developer API. The default model is `gemini-3.5-flash-lite`. Choose a model your Google project can use for audio input. |
| `SEED_SAMPLE_DATA` | Enables fictional workers, completed jobs and reviews. Use `0` on a real-user deployment. |
| `APP_ENV`, `SECRET_KEY` | Production requires `APP_ENV=production`, a shared random secret, and HTTPS. Local sessions use a generated secret in the instance folder if the setting is omitted. |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL`, `DB_CA_PATH` | Point Flask at the existing MySQL/TiDB database. TiDB uses TLS; port 4000 is the default. Run `python -m flask --app wsgi:app init-marketplace` from `backend/` before starting the app with a shared database. |

`check-db` verifies database access with `SELECT 1`. `check-ai` sends a short
Gemini request to check model access and quota. Both are Flask commands
available from `backend/` with the same `--app wsgi:app` flag.

### Demo accounts

Use separate browser profiles or a private window for the two roles.
In **Sign in**, choose **Demo worker** or **Demo customer**, get a demo code
and verify it.

| Role | Sample phone | What it opens |
| --- | --- | --- |
| Customer | `03000000099` | Requests and completed sample jobs |
| Worker | `03000000001` | Ahmed Ali, an available electrician in G-10 |

The sample profiles, jobs and reviews are fictional. Newly created demo
accounts, requests and voice notes are stored locally. Sample code delivery
does not send a real SMS. The label **Phone verified** is reserved for
accounts that verify with SMS. The worker’s phone number is never published.

### Limits and AI disclosure

- Discovery uses approximate neighbourhood centres and straight-line distances.
  Availability is current in the database. Job workspaces poll for updates.
- The Gemini API processes onboarding audio only when the worker requests a
  profile draft. Voice notes sent to a job are stored with that job and are
  playable by its two participants. Browser microphone access needs HTTPS or
  localhost. Speech prompts and guided dictation depend on installed voices and
  browser speech support. Without a configured Gemini key, guided setup remains
  available.
- [Google Gemini Developer API](https://ai.google.dev/gemini-api/docs/audio) via
  the Google Gen AI SDK is the AI service used for voice onboarding.
  Supported browsers can additionally provide guided dictation through the
  [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API).
  [Twilio Verify](https://www.twilio.com/docs/verify) handles configured SMS.
- OpenAI ChatGPT/Codex assisted with requirements analysis, code, and validation.

## Design sources

- The electrician hero photo comes from the project’s Figma export.
- RippleButton, ScrollDrops, GlassNavbar and HeroVisual are adapted from the
  supplied reusable React components. GSAP and ScrollTrigger power the scroll
  effects. The hero uses a 1.618:1 split on desktop. White and neutral surfaces
  carry most of the page, with orange reserved for actions and emphasis.
- Dribbble references informed the location-first entry, quick trade selection,
  and straightforward worker UI. [Baru](https://dribbble.com/shots/27469557-Baru-On-Demand-Home-Services-Marketplace-Landing-Page-UI) ·
  [Job portal design for blue-collar workers](https://dribbble.com/shots/3831879-Job-portal-design-for-blue-collar-workers)
- The Manrope and Space Grotesk typefaces are served locally through Fontsource.

## Checks

From `backend/`, run `python -m unittest discover -s tests -v` with the virtual
environment. The suite covers one-time verification codes and role isolation,
concurrent booking, audio access, review publication, and provider response
handling. Provider calls are mocked. From the root, run `npm run build`.
