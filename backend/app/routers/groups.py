from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user, get_membership_or_404, require_admin
from ..storage import public_avatar_url

router = APIRouter(prefix="/groups", tags=["groups"])


def _get_active_challenge(db: Session, group_id: int):
    return (
        db.query(models.Challenge)
        .filter(models.Challenge.group_id == group_id, models.Challenge.is_active.is_(True))
        .first()
    )


def _get_last_completed_challenge(db: Session, group_id: int):
    return (
        db.query(models.Challenge)
        .filter(models.Challenge.group_id == group_id, models.Challenge.is_active.is_(False))
        .order_by(models.Challenge.end_date.desc(), models.Challenge.id.desc())
        .first()
    )


def _challenge_out(challenge: models.Challenge) -> schemas.ChallengeOut:
    return schemas.ChallengeOut(
        id=challenge.id,
        name=challenge.name,
        start_date=challenge.start_date,
        end_date=challenge.end_date,
        is_active=challenge.is_active,
        items=[schemas.ChallengeItemOut.model_validate(i) for i in challenge.items],
    )


def _challenge_summary(db: Session, challenge: models.Challenge) -> schemas.ChallengeSummary:
    winner_rows = (
        db.query(models.ChallengeWinner, models.User)
        .join(models.User, models.User.id == models.ChallengeWinner.user_id)
        .filter(models.ChallengeWinner.challenge_id == challenge.id)
        .all()
    )
    winners = [
        schemas.ChallengeWinnerOut(
            user_id=u.id, name=u.name, points=cw.points, avatar_url=public_avatar_url(u),
        ) for cw, u in winner_rows
    ]
    return schemas.ChallengeSummary(
        id=challenge.id, name=challenge.name, start_date=challenge.start_date,
        end_date=challenge.end_date, winners=winners,
    )


def _group_detail(db: Session, group: models.Group) -> schemas.GroupDetail:
    members = (
        db.query(models.GroupMember, models.User)
        .join(models.User, models.User.id == models.GroupMember.user_id)
        .filter(models.GroupMember.group_id == group.id)
        .all()
    )
    member_out = [
        schemas.MemberOut(
            user_id=u.id, name=u.name, role=gm.role.value, avatar_url=public_avatar_url(u),
        ) for gm, u in members
    ]

    active_challenge = _get_active_challenge(db, group.id)
    challenge_out = _challenge_out(active_challenge) if active_challenge else None

    last_completed = _get_last_completed_challenge(db, group.id)
    last_completed_out = _challenge_summary(db, last_completed) if last_completed else None

    return schemas.GroupDetail(
        id=group.id,
        name=group.name,
        invite_code=group.invite_code,
        admin_id=group.admin_id,
        members=member_out,
        challenge=challenge_out,
        last_completed_challenge=last_completed_out,
    )


@router.post("", response_model=schemas.GroupDetail, status_code=status.HTTP_201_CREATED)
def create_group(
    payload: schemas.GroupCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Create a group only. Challenges are started later via POST /groups/{id}/challenge/start."""
    group = models.Group(name=payload.name.strip(), admin_id=current_user.id)
    db.add(group)
    db.flush()

    membership = models.GroupMember(group_id=group.id, user_id=current_user.id, role=models.RoleEnum.ADMIN)
    db.add(membership)

    db.commit()
    db.refresh(group)
    return _group_detail(db, group)


@router.post("/join", response_model=schemas.GroupDetail)
def join_group(
    payload: schemas.GroupJoin,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    group = (
        db.query(models.Group)
        .filter(models.Group.invite_code == payload.invite_code.strip().upper())
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail="No community found with that invite code")

    existing = (
        db.query(models.GroupMember)
        .filter(models.GroupMember.group_id == group.id, models.GroupMember.user_id == current_user.id)
        .first()
    )
    if not existing:
        db.add(models.GroupMember(group_id=group.id, user_id=current_user.id, role=models.RoleEnum.MEMBER))
        db.commit()

    return _group_detail(db, group)


@router.get("/mine", response_model=list[schemas.GroupSummary])
def my_groups(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memberships = (
        db.query(models.GroupMember)
        .options(joinedload(models.GroupMember.group))
        .filter(models.GroupMember.user_id == current_user.id)
        .all()
    )
    result = []
    for m in memberships:
        member_count = (
            db.query(models.GroupMember).filter(models.GroupMember.group_id == m.group_id).count()
        )
        result.append(
            schemas.GroupSummary(
                id=m.group.id,
                name=m.group.name,
                invite_code=m.group.invite_code,
                is_admin=m.role == models.RoleEnum.ADMIN,
                member_count=member_count,
            )
        )
    return result


@router.get("/{group_id}", response_model=schemas.GroupDetail)
def get_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    get_membership_or_404(db, group_id, current_user.id)
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Community not found")
    return _group_detail(db, group)


@router.put("/{group_id}", response_model=schemas.GroupDetail)
def rename_group(
    group_id: int,
    payload: schemas.GroupRename,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_admin(db, group_id, current_user.id)
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Community not found")
    group.name = payload.name.strip()
    db.commit()
    db.refresh(group)
    return _group_detail(db, group)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_admin(db, group_id, current_user.id)
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Community not found")
    db.delete(group)
    db.commit()
    return None


@router.delete("/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    group_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_admin(db, group_id, current_user.id)
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if user_id == group.admin_id:
        raise HTTPException(status_code=400, detail="The admin cannot be removed from the community")
    membership = (
        db.query(models.GroupMember)
        .filter(models.GroupMember.group_id == group_id, models.GroupMember.user_id == user_id)
        .first()
    )
    if membership:
        db.delete(membership)
        db.commit()
    return None


# ---------- challenge management (admin only) ----------

@router.put("/{group_id}/challenge", response_model=schemas.ChallengeOut)
def rename_challenge(
    group_id: int,
    payload: schemas.ChallengeRename,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_admin(db, group_id, current_user.id)
    challenge = _get_active_challenge(db, group_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="No active challenge for this community")
    challenge.name = payload.name.strip()
    db.commit()
    db.refresh(challenge)
    return _challenge_out(challenge)


@router.post("/{group_id}/challenge/items", response_model=schemas.ChallengeItemOut, status_code=status.HTTP_201_CREATED)
def add_item(
    group_id: int,
    payload: schemas.ChallengeItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_admin(db, group_id, current_user.id)
    challenge = _get_active_challenge(db, group_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="No active challenge for this community")
    item = models.ChallengeItem(challenge_id=challenge.id, name=payload.name.strip(), points=payload.points)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{group_id}/challenge/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_item(
    group_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_admin(db, group_id, current_user.id)
    challenge = _get_active_challenge(db, group_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="No active challenge for this community")
    item = (
        db.query(models.ChallengeItem)
        .filter(models.ChallengeItem.id == item_id, models.ChallengeItem.challenge_id == challenge.id)
        .first()
    )
    if item:
        db.delete(item)
        db.commit()
    return None


@router.post("/{group_id}/challenge/start", response_model=schemas.ChallengeOut, status_code=status.HTTP_201_CREATED)
def start_challenge(
    group_id: int,
    payload: schemas.ChallengeStartRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_admin(db, group_id, current_user.id)
    if payload.end_date and payload.end_date < date.today():
        raise HTTPException(status_code=400, detail="End date cannot be in the past")

    existing = _get_active_challenge(db, group_id)
    if existing:
        raise HTTPException(status_code=400, detail="There's already an active challenge — end it first")

    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Challenge name is required")

    challenge = models.Challenge(
        group_id=group_id, name=name, start_date=date.today(),
        end_date=payload.end_date, is_active=True,
    )
    db.add(challenge)
    db.commit()
    db.refresh(challenge)
    return _challenge_out(challenge)


@router.post("/{group_id}/challenge/end", response_model=schemas.ChallengeEndResult)
def end_challenge(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_admin(db, group_id, current_user.id)
    challenge = _get_active_challenge(db, group_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="No active challenge to end")

    # Tally points earned during this specific challenge instance, per member.
    member_ids = {
        row[0]
        for row in db.query(models.GroupMember.user_id).filter(models.GroupMember.group_id == group_id).all()
    }
    totals = {uid: 0 for uid in member_ids}
    rows = (
        db.query(models.DailySubmission.user_id, models.DailySubmission.points_earned)
        .filter(models.DailySubmission.challenge_id == challenge.id)
        .all()
    )
    for uid, pts in rows:
        totals[uid] = totals.get(uid, 0) + pts

    max_points = max(totals.values()) if totals else 0

    challenge.is_active = False
    challenge.end_date = date.today()
    db.flush()

    winners = []
    if max_points > 0:
        for uid, pts in totals.items():
            if pts == max_points:
                cw = models.ChallengeWinner(challenge_id=challenge.id, user_id=uid, points=pts)
                db.add(cw)
                winners.append((uid, pts))

    db.commit()
    db.refresh(challenge)

    users = db.query(models.User).filter(models.User.id.in_(member_ids)).all()
    users_by_id = {u.id: u for u in users}
    final_standings = sorted(
        [
            schemas.ChallengeWinnerOut(
                user_id=uid,
                name=users_by_id[uid].name if uid in users_by_id else "Unknown",
                points=pts,
                avatar_url=public_avatar_url(users_by_id[uid]) if uid in users_by_id else None,
            )
            for uid, pts in totals.items()
        ],
        key=lambda r: r.points, reverse=True,
    )

    return schemas.ChallengeEndResult(
        challenge=_challenge_summary(db, challenge),
        final_standings=final_standings,
    )
