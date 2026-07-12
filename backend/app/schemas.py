from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field


# ---------- Auth ----------

class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SignupResponse(TokenResponse):
    dev_verification_url: Optional[str] = None


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    is_email_verified: bool

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    message: str
    dev_url: Optional[str] = None


class VerifyEmailRequest(BaseModel):
    token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=6, max_length=128)


# ---------- Challenge / items ----------

class ChallengeItemOut(BaseModel):
    id: int
    name: str
    points: int

    class Config:
        from_attributes = True


class ChallengeItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    points: int = Field(ge=1, le=1000)


class ChallengeOut(BaseModel):
    id: int
    name: str
    start_date: date
    end_date: Optional[date] = None
    is_active: bool
    items: List[ChallengeItemOut] = []

    class Config:
        from_attributes = True


class ChallengeRename(BaseModel):
    name: str = Field(min_length=1, max_length=150)


class ChallengeStartRequest(BaseModel):
    name: str = Field(min_length=1, max_length=150, default="Daily Basics")
    end_date: Optional[date] = None


class ChallengeWinnerOut(BaseModel):
    user_id: int
    name: str
    points: int

    class Config:
        from_attributes = True


class ChallengeSummary(BaseModel):
    id: int
    name: str
    start_date: date
    end_date: Optional[date] = None
    winners: List[ChallengeWinnerOut] = []

    class Config:
        from_attributes = True


class ChallengeEndResult(BaseModel):
    challenge: ChallengeSummary
    final_standings: List[ChallengeWinnerOut]


# ---------- Groups ----------

class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    end_date: Optional[date] = None


class GroupJoin(BaseModel):
    invite_code: str = Field(min_length=1, max_length=12)


class MemberOut(BaseModel):
    user_id: int
    name: str
    role: str

    class Config:
        from_attributes = True


class GroupSummary(BaseModel):
    id: int
    name: str
    invite_code: str
    is_admin: bool
    member_count: int

    class Config:
        from_attributes = True


class GroupDetail(BaseModel):
    id: int
    name: str
    invite_code: str
    admin_id: int
    members: List[MemberOut]
    challenge: Optional[ChallengeOut]
    last_completed_challenge: Optional[ChallengeSummary] = None

    class Config:
        from_attributes = True


# ---------- Submissions ----------

class SubmissionCreate(BaseModel):
    completed_item_ids: List[int]


class SubmissionOut(BaseModel):
    id: int
    date: date
    points_earned: int
    is_full_completion: bool
    completed_item_ids: List[int]

    class Config:
        from_attributes = True


# ---------- Leaderboard ----------

class LeaderboardRow(BaseModel):
    user_id: int
    name: str
    points: int
    rank: int


# ---------- Badges ----------

class BadgeOut(BaseModel):
    code: str
    name: str
    description: str
    earned: bool
    earned_at: Optional[datetime] = None


# ---------- Stats ----------

class UserStats(BaseModel):
    overall_points: int
    streak: int
    total_submissions: int
    group_count: int
    badge_count: int
    challenges_won: int
