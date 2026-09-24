from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user, get_membership_or_404
from ..badge_service import compute_user_stats, compute_weekly_points, get_user_badges_view
from ..storage import download_avatar, public_avatar_url

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


def _public_profile_payload(db: Session, user: models.User, group_id: Optional[int]) -> schemas.PublicUserProfile:
    stats = compute_user_stats(db, user.id)
    earned_badges = [b for b in get_user_badges_view(db, user.id) if b["earned"]]
    return schemas.PublicUserProfile(
        id=user.id,
        name=user.name,
        avatar_url=public_avatar_url(user),
        weekly_points=compute_weekly_points(db, user.id, group_id),
        streak=stats["streak"],
        badge_count=len(earned_badges),
        challenges_won=stats["challenges_won"],
        badges=earned_badges,
    )


@avatar_router.get("/{user_id}/profile", response_model=schemas.PublicUserProfile)
def get_public_profile(
    user_id: int,
    group_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if group_id is not None:
        get_membership_or_404(db, group_id, current_user.id)
    return _public_profile_payload(db, user, group_id)


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
