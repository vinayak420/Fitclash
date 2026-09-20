# FitClash — Fitness Challenge Platform

A full-stack implementation of the Fitness Challenge Platform BRD: users sign up, create or join
communities with friends via invite codes, complete a daily checklist, earn points, unlock badges, and
compete on leaderboards.

## Architecture

This matches the BRD's high-level design:

```
React Frontend  →  REST API  →  FastAPI Backend
                                   ├─ Authentication (JWT)
                                   ├─ Group Service
                                   ├─ Challenge Service
                                   ├─ Submission Service
                                   ├─ Leaderboard Service
                                   └─ Badge Service
                                        ↓
                                    SQLite (default) / PostgreSQL
```

- **Backend**: FastAPI + SQLAlchemy, JWT auth (bcrypt password hashing), SQLite by default
  (zero setup — swap in Postgres by changing one environment variable).
- **Frontend**: React (Vite) + React Router, talking to the backend over a REST API.
- **Database schema** mirrors the BRD exactly: `User`, `Group`, `GroupMember`, `Challenge`,
  `ChallengeItem`, `DailySubmission`, `SubmissionItem`, `Badge`, `UserBadge`.

## Features implemented

- Email/password signup and login (JWT-based sessions)
- Create a community → you become Admin, get a 6-character invite code (no challenge is created yet)
- Join a community with an invite code
- **Challenges have a start date (auto-filled to today) and an optional end date** — leave it
  blank to run indefinitely
- Admin can rename the active challenge, add/remove checklist items (with point values), and
  remove members
- **Admin can end the active challenge at any time** from Manage → this finalizes it, crowns
  whoever scored the most points during that challenge as the winner, and the community needs a new
  challenge started before members can check in again
- One checklist submission per user per day; locks after submitting
- Points roll up to both the community total and the user's overall total across all their communities
- Leaderboards: community total, this week, and overall (across all communities)
- **Badges** (7 total, evaluated automatically after each check-in):
  - **All-Rounder** — complete every checklist item in a single day
  - **3 / 5 / 10 / 30-Day Streak** — complete every item for that many consecutive days (four
    separate badges)
  - **Winner of the Week** — finish a completed calendar week on top of a community's leaderboard
  - **Winner of the Month** — finish a completed calendar month on top of a community's leaderboard
- **Profile stats** (shown in the sidebar): total points, current full-completion streak, badges
  earned, and **challenges won** (how many community challenges you've been crowned the winner of)
- **Delete a community** — the admin can permanently delete a community (and all its history) from Manage,
  with a type-the-community-name confirmation step
- **Email verification** — new accounts get a verification link; a banner prompts unverified
  users to verify, with a resend option. Login isn't blocked on this — it's just a nudge.
- **Forgot / reset password** — a standard "forgot password" flow with time-limited, single-use
  reset links

### About email in this project

There's no real email provider wired in by default, so verification and password-reset emails are
printed to the **backend terminal** by a "console" email backend — this is what most frameworks do
out of the box for local development. To make local testing painless without digging through logs,
the API also returns a direct link (`dev_verification_url` / `dev_url`) in these cases, and the
frontend surfaces it right in the UI. This convenience **automatically disables itself** the moment
you configure real SMTP (see below) — at that point emails are actually sent and the API stops
echoing links back.

To send real emails, set these backend environment variables before starting the server:

```bash
export EMAIL_BACKEND=smtp
export SMTP_HOST=smtp.yourprovider.com
export SMTP_PORT=587
export SMTP_USER=your-smtp-username
export SMTP_PASSWORD=your-smtp-password
export FROM_EMAIL=no-reply@yourdomain.com
export FRONTEND_URL=https://your-deployed-frontend.com
```

## Running it locally

You'll need **Python 3.10+** and **Node.js 18+** installed.

### 1. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # on Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API now runs at `http://localhost:8000`. A `fitclash.db` SQLite file is created automatically
on first run — no database setup required. Interactive API docs are available at
`http://localhost:8000/docs`.

**To use PostgreSQL instead of SQLite**, set an environment variable before starting the server:

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/fitclash"
```

(install `psycopg2-binary` via pip if you do this).

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL it prints (typically `http://localhost:5173`). It's already configured to talk to
the backend at `http://localhost:8000` via the `.env` file — change `VITE_API_BASE_URL` there if
your backend runs elsewhere.

### 3. Try it out

1. Sign up with a name, email, and password.
2. Create a community — you'll get an invite code.
3. Open an incognito window (or have a friend) sign up and join using that code.
4. Check off today's items and submit — watch points, streaks, and the leaderboard update.
5. As the community admin, visit the **Manage** tab to edit the checklist.

## Configuration

Backend environment variables (optional):

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./fitclash.db` | Database connection string |
| `FITCLASH_SECRET_KEY` | a dev default | JWT signing secret — **set this to a random value in production** |
| `EMAIL_BACKEND` | `console` | `console` prints emails to the terminal; `smtp` sends real emails |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | unset | SMTP credentials, required when `EMAIL_BACKEND=smtp` |
| `FROM_EMAIL` | `no-reply@fitclash.local` | "From" address on outgoing emails |
| `FRONTEND_URL` | `http://localhost:5173` | Used to build verification/reset links in emails |

Frontend environment variables (`frontend/.env`):

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Base URL of the backend API |

## Deploying

- **Backend**: deploy as any ASGI app (e.g. `uvicorn app.main:app` behind a process manager, or
  on Render/Railway/Fly.io). Point `DATABASE_URL` at a managed Postgres instance and set a strong
  `FITCLASH_SECRET_KEY`.
- **Frontend**: `npm run build` produces a static `dist/` folder deployable to Vercel, Netlify,
  Cloudflare Pages, or any static host. Set `VITE_API_BASE_URL` to your deployed backend's URL at
  build time.
- Update the backend's CORS `allow_origins` (in `app/main.py`) to your frontend's real domain
  instead of `*` once you deploy.

## Project structure

```
fitclash/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app, CORS, router wiring
│   │   ├── models.py          # SQLAlchemy models (User, Group, GroupMember, Challenge,
│   │   │                      #   ChallengeItem, ChallengeWinner, DailySubmission, ...)
│   │   ├── schemas.py         # Pydantic request/response models
│   │   ├── database.py        # DB engine/session setup
│   │   ├── security.py        # bcrypt hashing + JWT
│   │   ├── deps.py            # auth & permission dependencies
│   │   ├── badge_service.py   # streak/points calc + badge evaluation
│   │   └── routers/
│   │       ├── auth.py
│   │       ├── groups.py      # groups + challenge management
│   │       ├── submissions.py
│   │       ├── leaderboard.py
│   │       └── users.py       # stats + badges
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── api.js              # fetch wrapper for the backend
    │   ├── context/AuthContext.jsx
    │   ├── pages/              # Login, Signup, Dashboard
    │   └── components/         # tabs, modals, shared UI
    └── package.json
```
