import os

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..notification_service import run_challenge_lifecycle, run_daily_reminders

router = APIRouter(prefix="/internal/cron", tags=["cron"])


def _require_cron(x_cron_secret: str | None):
    expected = os.getenv("CRON_SECRET", "").strip()
    if not expected or x_cron_secret != expected:
        raise HTTPException(status_code=401, detail="Not authorized")


@router.post("/challenge-lifecycle")
def challenge_lifecycle(
    db: Session = Depends(get_db),
    x_cron_secret: str | None = Header(default=None, alias="X-Cron-Secret"),
):
    _require_cron(x_cron_secret)
    return run_challenge_lifecycle(db)


@router.post("/daily-reminders")
def daily_reminders(
    db: Session = Depends(get_db),
    x_cron_secret: str | None = Header(default=None, alias="X-Cron-Secret"),
):
    _require_cron(x_cron_secret)
    return {"sent": run_daily_reminders(db)}
