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
| `backend/app/config.py` | Environment-based configuration |
| `backend/app/extensions.py` | Shared database and migration extensions |
| `backend/app/main/` | Health and catalog API routes; fictional demo data |
| `backend/app/models/` | Home for future database models |
| `backend/wsgi.py` | Flask and Gunicorn entry point |
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

No environment file or cloud database is required to view the homepage. Optionally
copy `backend/.env.example` to `backend/.env`. SQLite is the development default;
the catalog currently uses in-memory sample data and does not read or write a database.
SQLAlchemy and Flask-Migrate are initialized for the next stage. No models or initial
migration exist yet; the app does not call `db.create_all()` on startup.

Set a generated `SECRET_KEY` before adding sessions or authentication. A TiDB/MySQL
connection will also need its driver and TLS configuration when database work starts.

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
- **AI services used by the application:** none yet.
- **AI coding assistant:** OpenAI ChatGPT/Codex helped write this foundation.
- **Component credit:** RippleButton comes from the supplied `React-RippleButton.rar`
  UI kit and was adapted for ember styling, links, and buttons. Other supplied
  components remain outside this minimal homepage.
- Wordly was inspected for folder conventions only; its project-specific code was not copied.

The current scaffold demonstrates homepage browsing only, not the hackathon's full
onboarding → discovery → communication → booking → trust flow.
