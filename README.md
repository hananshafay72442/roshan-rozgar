# Roshan Rozgar · روشن روزگار

A local marketplace connecting households with skilled trade workers in Pakistan.
Built for the COMSATS CUI AI Web Forge hackathon.

## Current scope

This is the initial foundation: a responsive white-and-ember homepage, six trade
categories, and sample worker browsing by city, service, and availability. Catalog
data comes from the Flask API; loading, retry, and empty states are included.

Worker onboarding, accounts, voice/AI features, messaging, price agreement, booking,
availability updates, and reviews are **not implemented yet**. The homepage describes
the planned flow and labels unavailable features. There is no payment integration.

## Stack and structure

React + Vite, plain CSS, Flask app factory and blueprints, Flask-SQLAlchemy,
Flask-Migrate. No frontend UI framework or router is needed for this single page.

| Path | Purpose |
| --- | --- |
| `backend/app/__init__.py` | App factory, extensions, blueprint registration, built frontend serving |
| `backend/app/config.py` | Environment-based SQLite/TiDB, TLS, and Gemini configuration |
| `backend/app/extensions.py` | Shared database and migration extensions |
| `backend/app/main/` | Health and catalog API routes; fictional demo data |
| `backend/app/models/` | Home for future database models |
| `backend/wsgi.py` | Flask and Gunicorn entry point |
| `backend/app/services/ai.py` | Server-side Gemini client, bounded timeouts, safe error messages |
| `backend/app/commands.py` | Database and Gemini connection checks |
| `frontend/src/app/` | Application entry/layout |
| `frontend/src/pages/` | Page-level components |
| `frontend/src/components/` | Reusable UI, including the supplied RippleButton |
| `frontend/src/api/` | Shared fetch client |
| `frontend/src/hooks/` | Catalog fetching and loading/error state |
| `frontend/src/styles/` | Global and page styles |

## Local setup (Windows PowerShell)

Requires Python 3.11+ and Node.js 22.12+ (or a supported newer LTS).
Run these commands from the repository root.

### Terminal 1 — backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m flask --app wsgi:app run --debug --port 5000
```

### Terminal 2 — frontend

```powershell
cd frontend
npm ci --include=dev
npm run dev
```

Open the URL Vite prints (normally `http://localhost:5173`). Vite proxies `/api`
to Flask on port 5000, so CORS setup is unnecessary. Keep both terminals running.
On Linux/macOS, use `.venv/bin/python` instead of the Windows executable path.

After the initial dependency setup, you can also start both processes from the
repository root with `npm run dev`. This shortcut uses `backend/.venv` and your
installed Vite dependency. Stop it with Ctrl+C; restart after backend edits.

### Configuration and database

Copy `backend/.env.example` to `backend/.env` and fill in your own values. The file
is ignored by Git and excluded from Docker images; never put secrets in `.env.example`
or frontend `VITE_*` variables. Existing process environment variables take precedence
over the file. An environment file is optional for the default local SQLite setup.

| Variable | Behavior |
| --- | --- |
| `APP_ENV` | `development`, `testing`, or `production`; production requires `SECRET_KEY` and `DB_HOST` and enables secure session cookies |
| `SECRET_KEY` | Shared random session secret; optional while running the local catalog without authentication |
| `DB_HOST` | Empty selects local SQLite; a value selects MySQL/TiDB through PyMySQL |
| `DB_PORT` | MySQL/TiDB port, defaults to `4000` |
| `DB_NAME` | Database name, e.g. `roshanRozgar`, without a trailing semicolon |
| `DB_USER`, `DB_PASSWORD` | Database credentials; fill in the TiDB password before connecting |
| `DB_SSL` | `1` enables certificate and hostname verification; TiDB Cloud requires it |
| `DB_CA_PATH` | Optional CA file, resolved relative to `backend/`; e.g. `certs/isrgrootx1.pem`. Empty uses Certifi's public CA bundle |
| `SEED_SAMPLE_DATA` | `1` exposes fictional in-memory workers on the homepage; `0` returns no workers. No rows are inserted on Docker startup |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Reserved for future admin accounts; currently unused. Leave empty |
| `GEMINI_API_KEY` | Optional Google Gemini key, used only on the backend |
| `GEMINI_MODEL` | Defaults to `gemini-3.5-flash-lite`; override with a Gemini model available to your project |

The old `DATABASE_URL`, `OPENAI_API_KEY`, and `OPENAI_MODEL` settings are no longer
used. This project uses the `DB_*` fields and Google Gemini, not the copied MandiWise
configuration or the OpenAI API.

The catalog currently uses in-memory sample data and does not read or write a database.
SQLAlchemy and Flask-Migrate are initialized for the next stage. No models or initial
migration exist yet; the app does not call `db.create_all()` on startup.

The PyMySQL driver and TLS configuration are included. The configured database must
already exist. Set a generated `SECRET_KEY` before adding sessions or authentication.

From `backend/`, check your connections:

```powershell
.\.venv\Scripts\python.exe -m flask --app wsgi:app check-db
.\.venv\Scripts\python.exe -m flask --app wsgi:app check-ai
```

`check-db` runs `SELECT 1` without schema changes. `check-ai` sends one short request
to Google and consumes the project's normal Gemini quota. These checks are not run
on application startup. The homepage works without an AI key.
If Google rejects generation because the project's free tier is unavailable,
`check-ai` reports the billing/access requirement. A successful model lookup alone
does not mean the project has permission or quota to generate responses.

## Build and run as one service

```powershell
cd frontend
npm run build
cd ../backend
.\.venv\Scripts\python.exe -m flask --app wsgi:app run --port 5000
```

Open `http://localhost:5000`. Flask serves `frontend/dist` and the API from one origin.
Rebuild after frontend edits. For Linux production use:

```bash
cd backend
gunicorn --bind 0.0.0.0:8000 wsgi:app
```

The root Dockerfile also builds both parts into one service:

```bash
docker build -t roshan-rozgar .
docker run --rm -p 8000:8000 roshan-rozgar
```

`PORT` can override the container's default port of 8000. Docker commands require Docker installed.
To use your `.env` values inside the container, replace the run command with:

```bash
docker run --rm -p 8000:8000 --env-file backend/.env roshan-rozgar
```

On Render, set the same values in the service's environment settings; local `.env`
files are not included in the image.

## API

| Method | Route | Result |
| --- | --- | --- |
| GET | `/api/health` | Application liveness (does not test a database) |
| GET | `/api/services` | Six service categories and supported cities |
| GET | `/api/workers` | Fictional worker profiles and `demo: true` |
| GET | `/api/workers?city=Islamabad&service=electrician&available=true` | Filtered sample workers |

Invalid filters return JSON with HTTP 400. Unknown routes return JSON with HTTP 404.

## Demo data, AI disclosure, and credits

- All 12 worker names, neighbourhoods, experience, and availability values in
  `backend/app/main/data.py` are fictional, seeded in memory, and reset on process restart.
- City filtering is not GPS or distance-based discovery. Availability is static.
  No worker has been identity-verified and no booking is performed.
- **AI service:** Google Gemini Developer API, via the official `google-genai`
  SDK. A server-side `generate_text` adapter and `check-ai` command are included;
  user-facing AI/voice workflows are not implemented yet. Model access and quotas
  depend on the Google project. Documentation: https://ai.google.dev/gemini-api/docs.
- **AI coding assistant:** OpenAI ChatGPT/Codex helped write this foundation.
- **Component credit:** RippleButton comes from the supplied `React-RippleButton.rar`
  UI kit and was adapted for ember styling, links, and buttons. Other supplied
  components remain outside this minimal homepage.
- Wordly was inspected for folder conventions only; its project-specific code was not copied.

The current scaffold demonstrates homepage browsing only, not the hackathon's full
onboarding → discovery → communication → booking → trust flow.

## Backend checks

From `backend/`, run `.\.venv\Scripts\python.exe -m unittest discover -s tests -v`
(or `.venv/bin/python -m unittest discover -s tests -v` on Linux/macOS).
Tests cover SQLite fallback, TiDB TLS and special-character credentials, invalid
configuration, seed toggling, and Gemini response/error handling. Gemini is mocked
in tests; tests do not use your real key or contact your database.
