from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import SessionLocal, ensure_schema
from .routers import auth, groups, submissions, leaderboard, users, notifications, cron
from .badge_service import seed_badges

ensure_schema()

with SessionLocal() as db:
    seed_badges(db)

app = FastAPI(title="FitClash API", version="1.0.0")

origins = [
    "https://fitclash-two.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(groups.router)
app.include_router(submissions.router)
app.include_router(leaderboard.router)
app.include_router(users.router)
app.include_router(users.avatar_router)
app.include_router(notifications.router)
app.include_router(cron.router)


@app.get("/health")
def health():
    return {"status": "ok"}
