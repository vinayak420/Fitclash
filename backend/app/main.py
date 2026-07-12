from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine, SessionLocal
from .routers import auth, groups, submissions, leaderboard, users
from .badge_service import seed_badges

Base.metadata.create_all(bind=engine)

with SessionLocal() as db:
    seed_badges(db)

app = FastAPI(title="FitClash API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for local development; restrict this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(groups.router)
app.include_router(submissions.router)
app.include_router(leaderboard.router)
app.include_router(users.router)


@app.get("/health")
def health():
    return {"status": "ok"}
