from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from .. import models, schemas
from ..badge_service import weekly_points_cutoff
from ..database import get_db
from ..deps import get_current_user, get_membership_or_404
from ..storage import public_avatar_url

router = APIRouter(prefix="/groups/{group_id}/leaderboard", tags=["leaderboard"])


@router.get("", response_model=list[schemas.LeaderboardRow])
def leaderboard(
    group_id: int,
    mode: Literal["group", "weekly", "overall"] = Query("group"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    get_membership_or_404(db, group_id, current_user.id)

    member_rows = (
        db.query(models.GroupMember, models.User)
        .join(models.User, models.User.id == models.GroupMember.user_id)
        .filter(models.GroupMember.group_id == group_id)
        .all()
    )
    member_ids = [u.id for _, u in member_rows]
    names = {u.id: u.name for _, u in member_rows}
    avatars = {u.id: public_avatar_url(u) for _, u in member_rows}

    points_by_user = {uid: 0 for uid in member_ids}

    if mode == "overall":
        rows = (
            db.query(models.DailySubmission.user_id, func.sum(models.DailySubmission.points_earned))
            .filter(models.DailySubmission.user_id.in_(member_ids))
            .group_by(models.DailySubmission.user_id)
            .all()
        )
    else:
        q = db.query(
            models.DailySubmission.user_id, func.sum(models.DailySubmission.points_earned)
        ).filter(
            models.DailySubmission.group_id == group_id,
            models.DailySubmission.user_id.in_(member_ids),
        )
        if mode == "weekly":
            q = q.filter(models.DailySubmission.date >= weekly_points_cutoff())
        rows = q.group_by(models.DailySubmission.user_id).all()

    for uid, total in rows:
        points_by_user[uid] = int(total or 0)

    ranked = sorted(points_by_user.items(), key=lambda kv: kv[1], reverse=True)
    return [
        schemas.LeaderboardRow(
            user_id=uid,
            name=names.get(uid, "Unknown"),
            points=pts,
            rank=idx + 1,
            avatar_url=avatars.get(uid),
        )
        for idx, (uid, pts) in enumerate(ranked)
    ]
