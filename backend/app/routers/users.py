from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user
from ..badge_service import compute_user_stats, get_user_badges_view
from ..storage import download_avatar

router = APIRouter(prefix="/users/me", tags=["users"])
avatar_router = APIRouter(prefix="/users", tags=["users"])


@router.get("/stats", response_model=schemas.UserStats)
def my_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    stats = compute_user_stats(db, current_user.id)
    badge_count = len([b for b in get_user_badges_view(db, current_user.id) if b["earned"]])
    return schemas.UserStats(
        overall_points=stats["overall_points"],
        streak=stats["streak"],
        total_submissions=stats["total_submissions"],
        group_count=stats["group_count"],
        badge_count=badge_count,
        challenges_won=stats["challenges_won"],
    )


@router.get("/badges", response_model=list[schemas.BadgeOut])
def my_badges(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return get_user_badges_view(db, current_user.id)


@avatar_router.get("/{user_id}/avatar")
def get_user_avatar(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user or not user.avatar_key:
        raise HTTPException(status_code=404, detail="Profile photo not found.")
    payload = download_avatar(user.avatar_key)
    return Response(
        content=payload,
        media_type="image/webp",
        headers={"Cache-Control": "public, max-age=86400"},
    )
