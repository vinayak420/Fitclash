import calendar
from datetime import date, timedelta
from collections import defaultdict

from sqlalchemy.orm import Session
from sqlalchemy import func

from . import models

BADGE_DEFS = [
    {"code": "full_sweep", "name": "All-Rounder", "description": "Complete every checklist item in a single day"},
    {"code": "streak_3", "name": "3-Day Streak", "description": "Complete every item, 3 days in a row"},
    {"code": "streak_5", "name": "5-Day Streak", "description": "Complete every item, 5 days in a row"},
    {"code": "streak_10", "name": "10-Day Streak", "description": "Complete every item, 10 days in a row"},
    {"code": "streak_30", "name": "30-Day Streak", "description": "Complete every item, 30 days in a row"},
    {"code": "weekly_winner", "name": "Winner of the Week", "description": "Top the leaderboard for a completed week in one of your groups"},
    {"code": "monthly_winner", "name": "Winner of the Month", "description": "Top the leaderboard for a completed month in one of your groups"},
]

STREAK_THRESHOLDS = {"streak_3": 3, "streak_5": 5, "streak_10": 10, "streak_30": 30}


def seed_badges(db: Session) -> None:
    for b in BADGE_DEFS:
        existing = db.query(models.Badge).filter(models.Badge.code == b["code"]).first()
        if not existing:
            db.add(models.Badge(**b))
    db.commit()


# ---------- streak (based on full-completion days) ----------

def compute_full_completion_streak(db: Session, user_id: int) -> int:
    dates = {
        row[0]
        for row in db.query(models.DailySubmission.date)
        .filter(models.DailySubmission.user_id == user_id, models.DailySubmission.is_full_completion.is_(True))
        .distinct()
        .all()
    }
    today = date.today()
    if today in dates:
        start = today
    elif (today - timedelta(days=1)) in dates:
        start = today - timedelta(days=1)
    else:
        return 0

    streak = 0
    cursor = start
    while cursor in dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def has_full_sweep(db: Session, user_id: int) -> bool:
    return (
        db.query(models.DailySubmission)
        .filter(models.DailySubmission.user_id == user_id, models.DailySubmission.is_full_completion.is_(True))
        .first()
        is not None
    )


# ---------- weekly / monthly period wins ----------

def _iso_week_bounds(year: int, week: int):
    start = date.fromisocalendar(year, week, 1)  # Monday
    end = date.fromisocalendar(year, week, 7)    # Sunday
    return start, end


def _month_bounds(year: int, month: int):
    start = date(year, month, 1)
    last_day = calendar.monthrange(year, month)[1]
    end = date(year, month, last_day)
    return start, end


def _has_won_completed_period(db: Session, user_id: int, period: str) -> bool:
    """period is 'week' or 'month'. Checks, across every group the user belongs to, whether
    there is at least one *completed* period where this user had the strictly-highest points
    among that group's members (ties count as a win for all tied users)."""
    today = date.today()

    group_ids = [
        row[0]
        for row in db.query(models.GroupMember.group_id).filter(models.GroupMember.user_id == user_id).all()
    ]
    if not group_ids:
        return False

    for group_id in group_ids:
        member_ids = {
            row[0]
            for row in db.query(models.GroupMember.user_id).filter(models.GroupMember.group_id == group_id).all()
        }
        if len(member_ids) < 1:
            continue

        subs = (
            db.query(models.DailySubmission.user_id, models.DailySubmission.date, models.DailySubmission.points_earned)
            .filter(models.DailySubmission.group_id == group_id)
            .all()
        )
        if not subs:
            continue

        # bucket points by period key -> {user_id: total_points}, and track period end date
        buckets: dict = defaultdict(lambda: defaultdict(int))
        period_end_for_key: dict = {}

        for uid, sub_date, pts in subs:
            if period == "week":
                iso_year, iso_week, _ = sub_date.isocalendar()
                key = (iso_year, iso_week)
                if key not in period_end_for_key:
                    _, end = _iso_week_bounds(iso_year, iso_week)
                    period_end_for_key[key] = end
            else:
                key = (sub_date.year, sub_date.month)
                if key not in period_end_for_key:
                    _, end = _month_bounds(sub_date.year, sub_date.month)
                    period_end_for_key[key] = end
            buckets[key][uid] += pts

        for key, totals in buckets.items():
            end_date = period_end_for_key[key]
            if end_date >= today:
                continue  # period hasn't fully completed yet
            if not totals:
                continue
            max_points = max(totals.values())
            if max_points <= 0:
                continue
            if totals.get(user_id, -1) == max_points:
                return True

    return False


# ---------- aggregate stats ----------

def compute_user_stats(db: Session, user_id: int) -> dict:
    overall_points = (
        db.query(func.coalesce(func.sum(models.DailySubmission.points_earned), 0))
        .filter(models.DailySubmission.user_id == user_id)
        .scalar()
    )
    total_submissions = (
        db.query(func.count(models.DailySubmission.id))
        .filter(models.DailySubmission.user_id == user_id)
        .scalar()
    )
    group_count = (
        db.query(func.count(models.GroupMember.id))
        .filter(models.GroupMember.user_id == user_id)
        .scalar()
    )
    challenges_won = (
        db.query(func.count(models.ChallengeWinner.id))
        .filter(models.ChallengeWinner.user_id == user_id)
        .scalar()
    )
    streak = compute_full_completion_streak(db, user_id)
    return {
        "overall_points": overall_points or 0,
        "total_submissions": total_submissions or 0,
        "group_count": group_count or 0,
        "streak": streak,
        "challenges_won": challenges_won or 0,
    }


def evaluate_and_award_badges(db: Session, user_id: int) -> list:
    """Checks badge criteria for a user and awards any newly-earned badges.
    Returns the list of newly-awarded Badge objects."""
    streak = compute_full_completion_streak(db, user_id)
    full_sweep = has_full_sweep(db, user_id)
    won_week = _has_won_completed_period(db, user_id, "week")
    won_month = _has_won_completed_period(db, user_id, "month")

    criteria = {
        "full_sweep": full_sweep,
        "streak_3": streak >= 3,
        "streak_5": streak >= 5,
        "streak_10": streak >= 10,
        "streak_30": streak >= 30,
        "weekly_winner": won_week,
        "monthly_winner": won_month,
    }

    already_earned_codes = {
        ub.badge.code
        for ub in db.query(models.UserBadge).filter(models.UserBadge.user_id == user_id).all()
    }

    newly_awarded = []
    for badge in db.query(models.Badge).all():
        if criteria.get(badge.code) and badge.code not in already_earned_codes:
            ub = models.UserBadge(user_id=user_id, badge_id=badge.id)
            db.add(ub)
            newly_awarded.append(badge)
    if newly_awarded:
        db.commit()
    return newly_awarded


def get_user_badges_view(db: Session, user_id: int) -> list:
    earned = {
        ub.badge_id: ub.earned_at
        for ub in db.query(models.UserBadge).filter(models.UserBadge.user_id == user_id).all()
    }
    result = []
    for badge in db.query(models.Badge).all():
        result.append({
            "code": badge.code,
            "name": badge.name,
            "description": badge.description,
            "earned": badge.id in earned,
            "earned_at": earned.get(badge.id),
        })
    return result
