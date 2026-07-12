import enum
import secrets
from datetime import datetime, date

from sqlalchemy import (
    Column, Integer, String, ForeignKey, DateTime, Date, Boolean, Enum, UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .database import Base


def gen_invite_code(length: int = 6) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))


class RoleEnum(str, enum.Enum):
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_email_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    memberships = relationship("GroupMember", back_populates="user", cascade="all, delete-orphan")
    submissions = relationship("DailySubmission", back_populates="user", cascade="all, delete-orphan")
    badges = relationship("UserBadge", back_populates="user", cascade="all, delete-orphan")


class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token_hash = Column(String(255), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token_hash = Column(String(255), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    invite_code = Column(String(12), unique=True, index=True, default=gen_invite_code)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    members = relationship("GroupMember", back_populates="group", cascade="all, delete-orphan")
    # A group can have many challenges over its lifetime; at most one is_active=True at a time.
    challenges = relationship("Challenge", back_populates="group", cascade="all, delete-orphan")
    submissions = relationship("DailySubmission", back_populates="group", cascade="all, delete-orphan")


class GroupMember(Base):
    __tablename__ = "group_members"
    __table_args__ = (UniqueConstraint("group_id", "user_id", name="uq_group_user"),)

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(Enum(RoleEnum), default=RoleEnum.MEMBER, nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)

    group = relationship("Group", back_populates="members")
    user = relationship("User", back_populates="memberships")


class Challenge(Base):
    __tablename__ = "challenges"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    name = Column(String(150), nullable=False, default="Daily Basics")
    start_date = Column(Date, default=date.today, nullable=False)
    end_date = Column(Date, nullable=True)  # null = indefinite / not yet ended
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    group = relationship("Group", back_populates="challenges")
    items = relationship("ChallengeItem", back_populates="challenge", cascade="all, delete-orphan")
    winners = relationship("ChallengeWinner", back_populates="challenge", cascade="all, delete-orphan")


class ChallengeItem(Base):
    __tablename__ = "challenge_items"

    id = Column(Integer, primary_key=True, index=True)
    challenge_id = Column(Integer, ForeignKey("challenges.id"), nullable=False)
    name = Column(String(200), nullable=False)
    points = Column(Integer, nullable=False, default=5)

    challenge = relationship("Challenge", back_populates="items")


class ChallengeWinner(Base):
    """Recorded when a challenge is ended: the top scorer(s) for that challenge's duration."""
    __tablename__ = "challenge_winners"

    id = Column(Integer, primary_key=True, index=True)
    challenge_id = Column(Integer, ForeignKey("challenges.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    points = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    challenge = relationship("Challenge", back_populates="winners")
    user = relationship("User")


class DailySubmission(Base):
    __tablename__ = "daily_submissions"
    __table_args__ = (UniqueConstraint("user_id", "group_id", "date", name="uq_user_group_date"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    challenge_id = Column(Integer, ForeignKey("challenges.id"), nullable=False)
    date = Column(Date, default=date.today, nullable=False)
    points_earned = Column(Integer, default=0)
    is_full_completion = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="submissions")
    group = relationship("Group", back_populates="submissions")
    items = relationship("SubmissionItem", back_populates="submission", cascade="all, delete-orphan")


class SubmissionItem(Base):
    __tablename__ = "submission_items"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("daily_submissions.id"), nullable=False)
    challenge_item_id = Column(Integer, ForeignKey("challenge_items.id"), nullable=False)

    submission = relationship("DailySubmission", back_populates="items")


class Badge(Base):
    __tablename__ = "badges"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=False)


class UserBadge(Base):
    __tablename__ = "user_badges"
    __table_args__ = (UniqueConstraint("user_id", "badge_id", name="uq_user_badge"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    badge_id = Column(Integer, ForeignKey("badges.id"), nullable=False)
    earned_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="badges")
    badge = relationship("Badge")
