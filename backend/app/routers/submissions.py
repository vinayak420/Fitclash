from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user, get_membership_or_404
from ..badge_service import evaluate_and_award_badges

router = APIRouter(prefix="/groups/{group_id}/submissions", tags=["submissions"])


def _get_active_challenge(db: Session, group_id: int):
    return (
        db.query(models.Challenge)
        .filter(models.Challenge.group_id == group_id, models.Challenge.is_active.is_(True))
        .first()
    )


def _submission_out(sub: models.DailySubmission) -> schemas.SubmissionOut:
    return schemas.SubmissionOut(
        id=sub.id,
        date=sub.date,
        points_earned=sub.points_earned,
        is_full_completion=sub.is_full_completion,
        completed_item_ids=[i.challenge_item_id for i in sub.items],
    )


@router.get("/today", response_model=schemas.SubmissionOut | None)
def get_today(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    get_membership_or_404(db, group_id, current_user.id)
    sub = (
        db.query(models.DailySubmission)
        .filter(
            models.DailySubmission.group_id == group_id,
            models.DailySubmission.user_id == current_user.id,
            models.DailySubmission.date == date.today(),
        )
        .first()
    )
    return _submission_out(sub) if sub else None


@router.post("", response_model=schemas.SubmissionOut, status_code=status.HTTP_201_CREATED)
def submit_checklist(
    group_id: int,
    payload: schemas.SubmissionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    get_membership_or_404(db, group_id, current_user.id)

    existing = (
        db.query(models.DailySubmission)
        .filter(
            models.DailySubmission.group_id == group_id,
            models.DailySubmission.user_id == current_user.id,
            models.DailySubmission.date == date.today(),
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="You've already checked in today")

    challenge = _get_active_challenge(db, group_id)
    if not challenge:
        raise HTTPException(status_code=400, detail="This community has no active challenge right now")

    all_item_ids = {i.id for i in challenge.items}
    valid_points = {i.id: i.points for i in challenge.items}
    chosen_ids = [i for i in payload.completed_item_ids if i in valid_points]
    points = sum(valid_points[i] for i in chosen_ids)
    is_full_completion = len(all_item_ids) > 0 and set(chosen_ids) == all_item_ids

    sub = models.DailySubmission(
        user_id=current_user.id,
        group_id=group_id,
        challenge_id=challenge.id,
        date=date.today(),
        points_earned=points,
        is_full_completion=is_full_completion,
    )
    db.add(sub)
    db.flush()
    for item_id in chosen_ids:
        db.add(models.SubmissionItem(submission_id=sub.id, challenge_item_id=item_id))
    db.commit()
    db.refresh(sub)

    evaluate_and_award_badges(db, current_user.id)

    return _submission_out(sub)
