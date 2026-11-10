# Roshan Rozgar · روشن روزگار

A neighbourhood marketplace for skilled trades in Islamabad and Rawalpindi.
Built with React, Vite, GSAP, Flask, SQLAlchemy, and MySQL.

## Hackathon flow

| Outcome | What to demonstrate |
| --- | --- |
| Onboarding | Register as a worker with a one-time email code or SMS. Record a short introduction in Urdu, Roman Urdu or English. Gemini extracts the name, trade, neighbourhood and experience. Listen to or check the draft, correct any gaps, then publish. The guided path offers trade icons, tap choices and speech prompts. |
| Discovery | Choose a city, neighbourhood and trade. Browse available workers in approximate distance order and open reviews. |
| Communication | Request a worker. Both accounts can exchange text or playable voice notes. The worker sends a quote in PKR and the customer sees that exact price before accepting. |
| Booking | Accept the quote. The worker becomes booked in the same database transaction and a second customer cannot confirm them. Completing or cancelling the booking releases the worker according to their availability setting. |
| Trust | The customer can leave one review for a completed job. Its rating and note appear in the worker’s public reviews. A badge indicates whether a worker verified by email or SMS. |

Payments, government identity checks and native apps are outside the project
scope. A local demo is supported for judging.

## Run locally

Use Python 3.11+, Node 22.12+, and MySQL 8.4. The included Compose service
starts MySQL with persistent storage and exposes it only on your machine.
From the repository root, copy the environment example and set
`DB_PASSWORD` in the copy before starting MySQL.

```powershell
Copy-Item backend/.env.example backend/.env
# Set DB_PASSWORD in backend/.env before running the next command.
docker compose --env-file backend/.env up -d --wait db
python -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
npm --prefix frontend ci --include=dev
Push-Location backend
.\.venv\Scripts\python.exe -m flask --app wsgi:app init-marketplace
Pop-Location
npm run dev
```

On Linux or macOS, use `cp`, `pushd` and `popd` with the virtual
environment’s `bin/python` executable. If you already run MySQL locally,
create an empty `utf8mb4` database and a user with privileges on that schema,
then set the matching backend environment values and skip the Compose command.
Open the URL printed by Vite, usually `http://localhost:5173`. The root script
starts Flask on port 5000 and Vite proxies requests to it.

To run the compiled site and API together, run `npm run build` from the root
and `python -m flask --app wsgi:app run` from `backend/` using the virtual
environment. Flask serves the built frontend. The existing Dockerfile also
builds both and runs Gunicorn on port 8000 by default.

## Verification, AI and deployment

| Setting | Purpose |
| --- | --- |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Enable real passwordless email sign-up and sign-in. Email is the default choice for both account types. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` | Enable real passwordless SMS sign-up and sign-in with a six-digit Twilio Verify service. All three are required for live SMS. |
| `DEMO_VERIFICATION` | Set to `1` for on-screen demo codes on a local MySQL database in development or testing. The default is `0`. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Enable voice-to-profile extraction through the Google Gemini Developer API. The default model is `gemini-3.5-flash-lite`. Choose a model your Google project can use for audio input. |
| `SEED_SAMPLE_DATA` | Set to `1` to install fictional workers, completed jobs and reviews when initializing the database. The default is `0`. |
| `APP_ENV`, `SECRET_KEY` | Production requires `APP_ENV=production`, a shared random secret, and HTTPS. Local sessions use a generated secret in the instance folder if the setting is omitted. |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | MySQL connection settings. The default port is `3306` for MySQL and `4000` for TiDB Cloud. |
| `DB_SSL`, `DB_CA_PATH` | Enable verified TLS for hosted MySQL with `DB_SSL=1`. Set a CA file if your host provides one. TLS is required for TiDB Cloud. |

`check-db` verifies database access with `SELECT 1`. `check-ai` sends a short
Gemini request to check model access and quota. Both are Flask commands
available from `backend/` with the same `--app wsgi:app` flag.

Run `python -m flask --app wsgi:app init-marketplace` from `backend/`
before starting the app against a new database or upgrading an existing
one. The database user running it needs schema creation and alteration
privileges. The upgrade preserves existing phone accounts, profiles, and
jobs. Existing users can choose **Phone (SMS)** to sign in. Email registration
creates a separate account.

### Turn on live email verification

1. Create a [Resend account](https://resend.com/). Add and verify a sending
   domain you own in the [Domains dashboard](https://resend.com/domains).
2. Create a sending API key and set it as `RESEND_API_KEY` in the backend
   host’s environment. Set `RESEND_FROM_EMAIL` to a sender on the verified
   domain, such as `Roshan Rozgar <verify@example.com>`.
3. Redeploy the backend. Choose **Email** at sign-up and confirm that the
   six-digit code arrives and signs you in.

For a local delivery test, Resend’s `onboarding@resend.dev` sender can send
codes to your Resend account email. Public sign-ups require a verified domain.

### Turn on live SMS verification

1. Create a six-digit service in the [Twilio Verify Console](https://www.twilio.com/console/verify/services).
2. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_VERIFY_SERVICE_SID`
   in the backend host’s environment settings. For a local backend, put them in
   `backend/.env`. Keep the token in the backend environment.
3. Allow Pakistan SMS traffic in [Verify Geo Permissions](https://www.twilio.com/docs/verify/preventing-toll-fraud/verify-geo-permissions).
4. Restart the backend or redeploy it with the new environment. From `backend/`,
   run `python -m flask --app wsgi:app check-sms` with the virtual environment.
   This checks service access and code length without sending an SMS.

For a local demo with on-screen one-time codes, use `APP_ENV=development`,
`DEMO_VERIFICATION=1`, and a MySQL server on localhost. Leave the provider
settings unset for the channels you want to demo. On a shared server, users
can switch to the other channel if their chosen service is unavailable.

### Demo accounts

Use separate browser profiles or a private window for the two roles.
Register with any valid-format email to try the email flow locally. To use an
existing sample account, open **Sign in**, choose **Phone (SMS)**, then select
**Demo worker** or **Demo customer** and verify with the demo code.

| Role | Sample phone | What it opens |
| --- | --- | --- |
| Customer | `03000000099` | Requests and completed sample jobs |
| Worker | `03000000001` | Ahmed Ali, an available electrician in G-10 |

The sample profiles, jobs and reviews are fictional. Newly created demo
accounts, requests and voice notes are stored in your local MySQL database. Demo delivery
displays the code in the browser. **Email verified** and **Phone verified**
indicate a real code was verified. The worker’s contact details stay private.

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
  [Resend](https://resend.com/docs/api-reference/emails/send-email) handles
  configured email and [Twilio Verify](https://www.twilio.com/docs/verify)
  handles configured SMS.
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
- Roman Urdu opens by default. The header switches between Roman Urdu, Urdu script
  and English. Manrope, Space Grotesk, and Noto Nastaliq Urdu are served locally
  through Fontsource.
- Section 01’s illustrated service cards draw on the category clarity of
  [Nasir Uddin’s handyman booking design](https://dribbble.com/shots/27384919-Home-Services-Handyman-Booking-Website-Design).

## Checks

Create an empty local MySQL database named `roshan_test` and grant a test
user privileges on that schema. Set `TEST_MYSQL_URL` to its connection URL,
such as `mysql+pymysql://test_user:test_password@127.0.0.1:3306/roshan_test`.
From `backend/`, run `python -m unittest discover -s tests -v` with the virtual
environment. Integration tests create and drop their tables in the test
database. Without `TEST_MYSQL_URL`, only the database-independent tests run.
The suite covers the schema upgrade, verification, role isolation, concurrent
booking, audio access, and reviews. Provider calls are mocked. From the
root, run `npm run build`.
