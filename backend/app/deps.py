from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from . import models
from .database import get_db
from .security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_access_token(credentials.credentials)
    if payload is None or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user = db.query(models.User).filter(models.User.id == int(payload["sub"])).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_membership_or_404(db: Session, group_id: int, user_id: int) -> models.GroupMember:
    membership = (
        db.query(models.GroupMember)
        .filter(models.GroupMember.group_id == group_id, models.GroupMember.user_id == user_id)
        .first()
    )
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of this group")
    return membership


def require_admin(db: Session, group_id: int, user_id: int) -> models.GroupMember:
    membership = get_membership_or_404(db, group_id, user_id)
    if membership.role != models.RoleEnum.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the group admin can do this")
    return membership
