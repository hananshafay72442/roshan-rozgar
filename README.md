# Roshan Rozgar · روشن روزگار

A neighbourhood marketplace for skilled trades in Islamabad and Rawalpindi.
Built with React, Vite, GSAP, Flask, SQLAlchemy, and MySQL.

## Hackathon flow

| Outcome | What to demonstrate |
| --- | --- |
| Onboarding | Register as a worker with an email address and password, or choose SMS. Record a short introduction in Urdu, Roman Urdu or English. Gemini extracts the name, trade, neighbourhood and experience. Listen to or check the draft, correct any gaps, then publish. The guided path offers trade icons, tap choices and speech prompts. |
| Discovery | Choose a city, neighbourhood and trade. Browse available workers in approximate distance order and open reviews. |
| Communication | Request a worker. Both accounts can exchange text or playable voice notes. The worker can decline or offer a price in PKR. Either side can counter the other’s price. |
| Booking | Accept the other side’s current offer. The worker becomes booked in the same database transaction and a second customer cannot confirm them. Completing or cancelling the booking releases the worker according to their availability setting. |
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
builds both, initializes the database schema, and runs Gunicorn on port 8000 by default.

## Admin review

### Worker face photo and CNIC front

New worker setup requires a face photo and CNIC front, with a private-review
consent checkbox. Photos are compressed in the browser, validated and re-encoded
on the server, and stored privately in a new MySQL `worker_identity` table.
`init-marketplace` creates this table additively; existing accounts, bookings,
SMS access and reviews are preserved. Existing workers can submit or replace
their photos from **Worker workspace → Identity verification**. A resubmission
returns the profile to pending without releasing its active booking.

Only submissions with both photos enter the admin queue. The administrator sees
the two images side by side, the face-check result, and must explicitly confirm
the face/document check before approval. A stale decision is rejected if the
worker has replaced the photos. Images are served only to their owner or an
administrator, with `no-store` headers; customers never receive CNIC photos.

- **Automatic matching:** set `REKOGNITION_REGION` and backend AWS credentials
  (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_SESSION_TOKEN` for
  temporary credentials), or use an AWS role. Grant only
  `rekognition:DetectFaces` and `rekognition:CompareFaces`. The backend requires
  one face in each photo and at least 95% similarity before sending the request
  to the admin. A match still requires manual admin approval. Provider failures
  return a retry error and never silently bypass the comparison.
- **Without configuration:** the UI clearly says automatic matching is disabled,
  and the submission is labelled **Manual face comparison required**. The admin
  compares the photos. This is not a mocked successful biometric check.

This checks photo similarity and supports human review; it does not validate
CNIC authenticity with NADRA, verify document numbers, or provide liveness
detection. With automatic matching enabled, the two photos are sent to Amazon
Rekognition with the worker's consent. No real CNIC images are included in the
repository or sample dataset. Provider tests use synthetic images and mocked
responses. See [Amazon's face comparison documentation](https://docs.aws.amazon.com/rekognition/latest/dg/faces-comparefaces.html).

### Customer reviews

Customers can select **Work finished? Complete and review** for their confirmed
booking, then choose 1–5 stars and an optional note. The workspace has a
**Reviews to write** filter and a visible prompt on completed, unreviewed jobs.
Reviews appear above the conversation. Only the booking's customer can post,
once per completed booking; duplicate, premature and worker reviews are rejected.
Ratings update public worker cards and reviews immediately.

The isolated identity/review HTTP tests run without an external database using
temporary SQLite storage; face-provider calls and MySQL quota claims are mocked.
The dedicated MySQL suite remains available through `TEST_MYSQL_URL`.

After running `init-marketplace`, run `python -m flask --app wsgi:app create-admin`
from `backend/`. Enter a new email and password at the prompts, then sign in
and open **Admin review**. Administrators can approve or reject new or
edited worker profiles and see their supplied contact numbers. Approved
profiles become discoverable. Job requests go directly to the selected
worker, who can send a price or decline. Customers can accept or counter
with a lower or higher amount. The worker can accept the counteroffer or
send a new price. Accepting the other party’s offer confirms the booking.

## Verification, AI and deployment

| Setting | Purpose |
| --- | --- |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Optional delivery settings for existing accounts that sign in with an email code. Email and password work without a sender. |
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

On deployments that start Flask or Gunicorn directly, run
`python -m flask --app wsgi:app init-marketplace` from `backend/` before
starting the app. The database user running it needs schema creation and
alteration privileges. The upgrade preserves existing accounts, profiles,
and jobs. New email accounts use passwords and have no email verification
badge. Existing phone accounts can still choose **Phone (SMS)**.

### Configure email delivery for existing code-based accounts

1. Create a [Resend account](https://resend.com/). Add and verify a sending
   domain you own in the [Domains dashboard](https://resend.com/domains).
2. Create a sending API key and set it as `RESEND_API_KEY` in the backend
   host’s environment. Set `RESEND_FROM_EMAIL` to a sender on the verified
   domain, such as `Roshan Rozgar <verify@example.com>`.
3. Redeploy the backend. Existing email-code users can select **Use an email
   code** on the sign-in form.

For a local delivery test, Resend’s `onboarding@resend.dev` sender can send
codes to your Resend account email. Sending codes to other addresses requires
a verified domain.

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

With `SEED_SAMPLE_DATA=1`, the sample accounts, phone numbers, worker profiles,
completed bookings, messages, quotes, ratings and reviews are fictional.
With `DEMO_VERIFICATION=1` and no delivery provider configured, one-time codes
appear in the browser. Integration tests mock Twilio, Resend and AI responses.
New accounts, profiles, requests, voice notes and moderation decisions persist
in MySQL. Email and password registration works without a delivery provider.

### Limits and AI disclosure

- Discovery uses approximate neighbourhood centres and straight-line distances.
  Availability is current in the database. Job workspaces poll for updates.
- The Gemini API processes onboarding audio only when the worker requests a
  profile draft. Voice notes sent to a job are stored with that job and are
  playable by its two participants. Browser microphone access needs HTTPS or localhost.
  Speech prompts and guided dictation depend on installed voices and
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

### Signed-in home and password entry

After sign-in, the hero shows the account's active requests, quotes, bookings and
completed jobs awaiting a customer review. Opening a request uses the existing
private job workspace. The summary refreshes while the page is visible. Email
registration requires matching passwords and offers a show-password control;
existing password accounts and SMS sign-in continue using the same endpoints.

### Groq voice onboarding

Set `GROQ_API_KEY` only in the backend environment to use Groq for voice profiles.
When configured, Groq Whisper (`GROQ_SPEECH_MODEL=whisper-large-v3-turbo`)
transcribes the recording and `GROQ_MODEL=openai/gpt-oss-20b` extracts a profile.
The existing validation and confirmation step still apply. Without a Groq key,
the existing Gemini path is used. Guided setup remains available on provider errors.
Recordings and transcripts are sent to the selected provider only when the worker
requests assistance. No key belongs in frontend code or the repository.
Services: [Groq speech recognition](https://console.groq.com/docs/speech-to-text)
and [Groq structured text](https://console.groq.com/docs/structured-outputs).

## Running the checks

### Role-specific home and profile editing

Guests see the unchanged hero, service explanations and public reviews (sample
reviews are labelled). Customer discovery and requests require sign-in. Workers
see their job summary, public profile and availability controls rather than a
customer worker catalog. Navigation follows the account role.

Both roles can select **Edit your profile** from home or the workspace. Customers
save a display name, city and neighbourhood. Workers edit their existing trade
profile with the same guided steps; edits preserve bookings, availability,
reviews, sign-in credentials and account ownership. Customer profiles use a new
table created additively by `init-marketplace`; existing MySQL accounts remain.

Discovery is restricted server-side to workers in the customer's saved city and
within **5 km of the saved neighbourhood centre**. Query parameters cannot widen
this boundary. Direct requests and worker reviews enforce the same boundary.
Changing location requires saving the customer's profile. This is approximate
neighbourhood-based proximity, not GPS or address verification. Existing job
conversations remain accessible after moving neighbourhoods.

### Requirements review (10 November 2026)

| PDF outcome | Implemented flow | Remaining live checks |
| --- | --- | --- |
| Low-literacy onboarding | SMS path, spoken prompts, guided profile and AI voice draft with confirmation | Live SMS needs Twilio configuration; AI needs a working provider key |
| Nearby, available discovery | Trade/city/neighbourhood filtering, approximate distance and current availability | Phone layout on the reported device |
| Accessible communication and price agreement | Participant-only text/audio messages and explicit quote acceptance | Two-role live voice recording on a real phone |
| Consistent booking | Transactional reservation, conflict protection and availability release | Dedicated local MySQL integration suite |
| Trust after the job | One customer review per completed booking and public ratings | Full two-role judging walkthrough |

Deployment smoke checks verified customer and worker email/password signup,
logout and sign-in using new synthetic QA accounts. One initial worker sign-in
returned HTTP 500; a repeat worker flow passed. Logs identified a dropped MySQL
connection. Connections now recycle after five minutes and interruptions return
a safe HTTP 503 with a retry message. Writes are never automatically replayed.
SMS reported unavailable before these
changes. Existing accounts, database schema and SMS settings were not changed.

Create an empty local MySQL database named `roshan_test` and grant a test
user privileges on that schema. Set `TEST_MYSQL_URL` to its connection URL,
such as `mysql+pymysql://test_user:test_password@127.0.0.1:3306/roshan_test`.
From `backend/`, run `python -m unittest discover -s tests -v` with the virtual
environment. Integration tests create and drop their tables in the test
database. Without `TEST_MYSQL_URL`, only the database-independent tests run.
The suite covers the schema upgrade, verification, role isolation, concurrent
booking, audio access, and reviews. Provider calls are mocked. From the
root, run `npm run build`.

## Mock and real data

- With `SEED_SAMPLE_DATA=1`, the fictional workers, sample customer, completed
  jobs, messages and reviews are seeded for the demo. The trade and neighbourhood
  lists and approximate coordinates are built-in reference data.
- With `DEMO_VERIFICATION=1`, the development app shows a demo code instead of
  contacting the unconfigured provider. Tests mock SMS, email and AI provider
  responses.
- Real registrations, contact numbers, worker profiles, requests, voice notes,
  ratings and moderation decisions are stored in MySQL. Admin decisions are
  manual. Email signup does not verify ownership of the address or optional
  contact number.
