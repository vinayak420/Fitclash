import json
import os
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import models


def _ist():
    try:
        from zoneinfo import ZoneInfo
        return ZoneInfo("Asia/Kolkata")
    except Exception:
        return timezone(timedelta(hours=5, minutes=30), name="IST")


def signed_points_label(points: int) -> str:
    return f"+{points}" if points > 0 else str(points)


def _type_enabled(db: Session, user_id: int, ntype: models.NotificationType) -> bool:
    pref = (
        db.query(models.NotificationPreference)
        .filter(
            models.NotificationPreference.user_id == user_id,
            models.NotificationPreference.type == ntype.value,
        )
        .first()
    )
    if pref is None:
        return True
    return bool(pref.enabled)


def _community_admins(db: Session, group: models.Group) -> list[models.User]:
    members = (
        db.query(models.GroupMember, models.User)
        .join(models.User, models.User.id == models.GroupMember.user_id)
        .filter(models.GroupMember.group_id == group.id)
        .all()
    )
    by_id = {}
    for membership, user in members:
        if membership.role == models.RoleEnum.ADMIN or user.id == group.admin_id:
            by_id[user.id] = user
    return list(by_id.values())


def _group_member_ids(db: Session, group_id: int) -> list[int]:
    return [
        row[0]
        for row in db.query(models.GroupMember.user_id).filter(models.GroupMember.group_id == group_id).all()
    ]


def challenge_points_map(db: Session, challenge: models.Challenge) -> dict[int, int]:
    member_ids = _group_member_ids(db, challenge.group_id)
    points = {uid: 0 for uid in member_ids}
    rows = (
        db.query(models.DailySubmission.user_id, func.coalesce(func.sum(models.DailySubmission.points_earned), 0))
        .filter(models.DailySubmission.challenge_id == challenge.id)
        .group_by(models.DailySubmission.user_id)
        .all()
    )
    for uid, total in rows:
        points[uid] = int(total or 0)
    return points


def create_notification(
    db: Session,
    *,
    user_id: int,
    ntype: models.NotificationType,
    title: str,
    body: str,
    event_key: str,
    challenge_id: int | None = None,
    community_id: int | None = None,
    actor_user_id: int | None = None,
    reference_id: int | None = None,
    link_path: str | None = None,
) -> models.Notification | None:
    if user_id == actor_user_id:
        return None
    if not _type_enabled(db, user_id, ntype):
        return None
    row = models.Notification(
        user_id=user_id,
        type=ntype.value,
        title=title[:200],
        body=body[:500],
        event_key=event_key[:180],
        challenge_id=challenge_id,
        community_id=community_id,
        actor_user_id=actor_user_id,
        reference_id=reference_id,
        link_path=link_path,
    )
    nested = db.begin_nested()
    try:
        db.add(row)
        db.flush()
        nested.commit()
    except IntegrityError:
        nested.rollback()
        return None
    db.commit()
    db.refresh(row)
    send_web_push(db, row)
    return row


def send_web_push(db: Session, notification: models.Notification) -> None:
    public_key = os.getenv("VAPID_PUBLIC_KEY", "").strip()
    private_key = os.getenv("VAPID_PRIVATE_KEY", "").strip()
    subject = os.getenv("VAPID_SUBJECT", "").strip()
    if not public_key or not private_key or not subject:
        return
    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        return

    payload = json.dumps({
        "title": notification.title,
        "body": notification.body,
        "url": notification.link_path or "/notifications",
        "notification_id": notification.id,
    })
    subs = (
        db.query(models.PushSubscription)
        .filter(models.PushSubscription.user_id == notification.user_id)
        .all()
    )
    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=payload,
                vapid_private_key=private_key,
                vapid_claims={"sub": subject},
            )
        except WebPushException as exc:
            status = getattr(getattr(exc, "response", None), "status_code", None)
            if status in (404, 410):
                db.delete(sub)
                db.commit()
        except Exception:
            continue


def notify_community_join(db: Session, group: models.Group, joiner: models.User) -> None:
    for admin in _community_admins(db, group):
        if admin.id == joiner.id:
            continue
        create_notification(
            db,
            user_id=admin.id,
            ntype=models.NotificationType.COMMUNITY_JOIN,
            title=f"{joiner.name} joined your community",
            body=f"{joiner.name} joined {group.name}.",
            event_key=f"community_join:{group.id}:{joiner.id}:{admin.id}",
            community_id=group.id,
            actor_user_id=joiner.id,
            link_path=f"/communities/{group.id}?tab=community",
        )


def notify_badges_earned(db: Session, user_id: int, badges: list) -> None:
    for badge in badges:
        create_notification(
            db,
            user_id=user_id,
            ntype=models.NotificationType.BADGE_EARNED,
            title="🏆 You earned a new badge!",
            body=f"You earned the {badge.name} badge!",
            event_key=f"badge_earned:{user_id}:{badge.id}",
            reference_id=badge.id,
            link_path="/profile",
        )


def notify_points_logged(db: Session, user_id: int, submission: models.DailySubmission, challenge: models.Challenge) -> None:
    label = signed_points_label(submission.points_earned)
    prefix = "✅" if submission.points_earned >= 0 else "➖"
    create_notification(
        db,
        user_id=user_id,
        ntype=models.NotificationType.POINTS_LOGGED,
        title=f"{prefix} You logged {label} points today",
        body=f"You logged {label} points today in {challenge.name}.",
        event_key=f"points_logged:{submission.id}",
        challenge_id=challenge.id,
        community_id=submission.group_id,
        reference_id=submission.id,
        link_path=f"/communities/{submission.group_id}",
    )


def notify_leaderboard_overtakes(
    db: Session,
    *,
    challenge: models.Challenge,
    actor: models.User,
    before: dict[int, int],
    after: dict[int, int],
    on_date: date,
) -> None:
    me = actor.id
    my_before = before.get(me, 0)
    my_after = after.get(me, 0)
    for other_id, other_before in before.items():
        if other_id == me:
            continue
        other_after = after.get(other_id, 0)
        if my_before < other_before and my_after > other_after:
            create_notification(
                db,
                user_id=other_id,
                ntype=models.NotificationType.LEADERBOARD_OVERTAKEN,
                title="📈 You've been overtaken",
                body=f"{actor.name} just overtook you in the {challenge.name} leaderboard.",
                event_key=f"leaderboard_overtaken:{challenge.id}:{other_id}:{me}:{on_date.isoformat()}",
                challenge_id=challenge.id,
                community_id=challenge.group_id,
                actor_user_id=me,
                link_path=f"/communities/{challenge.group_id}?tab=leaderboard",
            )


def notify_challenge_members(
    db: Session,
    challenge: models.Challenge,
    ntype: models.NotificationType,
    title: str,
    body: str,
    event_prefix: str,
    tab: str | None = None,
) -> None:
    q = f"?tab={tab}" if tab else ""
    for uid in _group_member_ids(db, challenge.group_id):
        create_notification(
            db,
            user_id=uid,
            ntype=ntype,
            title=title,
            body=body,
            event_key=f"{event_prefix}:{challenge.id}:{uid}",
            challenge_id=challenge.id,
            community_id=challenge.group_id,
            link_path=f"/communities/{challenge.group_id}{q}",
        )


def notify_challenge_started(db: Session, challenge: models.Challenge) -> None:
    notify_challenge_members(
        db,
        challenge,
        models.NotificationType.CHALLENGE_STARTED,
        "🔥 Your challenge starts today!",
        f"{challenge.name} starts today. Good luck!",
        "challenge_started",
    )


def notify_challenge_ended(db: Session, challenge: models.Challenge) -> None:
    notify_challenge_members(
        db,
        challenge,
        models.NotificationType.CHALLENGE_ENDED,
        "🏁 Challenge complete!",
        f"{challenge.name} ends today.",
        "challenge_ended",
        tab="community",
    )


def run_challenge_lifecycle(db: Session, today: date | None = None) -> dict:
    """Date-based challenge reminders. Uses UTC calendar dates to match date.today() writes on Render."""
    today = today or date.today()
    started = ended = soon = 0
    active = db.query(models.Challenge).filter(models.Challenge.is_active.is_(True)).all()
    for challenge in active:
        if challenge.start_date == today:
            before = db.query(models.Notification).filter(
                models.Notification.event_key.like(f"challenge_started:{challenge.id}:%")
            ).count()
            notify_challenge_started(db, challenge)
            after = db.query(models.Notification).filter(
                models.Notification.event_key.like(f"challenge_started:{challenge.id}:%")
            ).count()
            started += max(0, after - before)
        if challenge.end_date == today:
            notify_challenge_ended(db, challenge)
            ended += 1
        if challenge.end_date and challenge.end_date == today + timedelta(days=7):
            notify_challenge_members(
                db,
                challenge,
                models.NotificationType.CHALLENGE_ENDING_SOON,
                "⏳ One week left!",
                f"{challenge.name} ends in one week. Keep pushing!",
                "challenge_ending_soon",
            )
            soon += 1
    return {"started": started, "ended": ended, "ending_soon": soon}


def run_daily_reminders(db: Session, today: date | None = None) -> int:
    today = today or datetime.now(_ist()).date()
    sent = 0
    active = db.query(models.Challenge).filter(models.Challenge.is_active.is_(True)).all()
    for challenge in active:
        if challenge.end_date and challenge.end_date < today:
            continue
        if challenge.start_date and challenge.start_date > today:
            continue
        member_ids = _group_member_ids(db, challenge.group_id)
        logged = {
            row[0]
            for row in db.query(models.DailySubmission.user_id)
            .filter(
                models.DailySubmission.challenge_id == challenge.id,
                models.DailySubmission.date == today,
            )
            .all()
        }
        for uid in member_ids:
            if uid in logged:
                continue
            created = create_notification(
                db,
                user_id=uid,
                ntype=models.NotificationType.DAILY_POINTS_REMINDER,
                title="⏰ Don't forget to log your points!",
                body=f"You haven't logged your points for {challenge.name} today.",
                event_key=f"daily_reminder:{challenge.id}:{uid}:{today.isoformat()}",
                challenge_id=challenge.id,
                community_id=challenge.group_id,
                link_path=f"/communities/{challenge.group_id}",
            )
            if created:
                sent += 1
    return sent
