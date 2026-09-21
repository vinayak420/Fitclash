from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import (
    hash_password, verify_password, create_access_token,
    generate_raw_token, hash_token,
)
from ..deps import get_current_user
from ..email_utils import (
    send_verification_email, send_password_reset_email, is_console_backend,
)
from ..storage import (
    ALLOWED_CONTENT_TYPES, MAX_UPLOAD_BYTES, delete_avatar, process_avatar, upload_avatar,
)

router = APIRouter(prefix="/auth", tags=["auth"])

VERIFICATION_TOKEN_TTL = timedelta(hours=24)
RESET_TOKEN_TTL = timedelta(hours=1)


def _issue_verification_token(db: Session, user: models.User) -> str:
    raw = generate_raw_token()
    record = models.EmailVerificationToken(
        user_id=user.id,
        token_hash=hash_token(raw),
        expires_at=datetime.utcnow() + VERIFICATION_TOKEN_TTL,
    )
    db.add(record)
    db.commit()
    return raw


def _issue_reset_token(db: Session, user: models.User) -> str:
    raw = generate_raw_token()
    record = models.PasswordResetToken(
        user_id=user.id,
        token_hash=hash_token(raw),
        expires_at=datetime.utcnow() + RESET_TOKEN_TTL,
    )
    db.add(record)
    db.commit()
    return raw


@router.post("/signup", response_model=schemas.SignupResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: schemas.SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    user = models.User(
        name=payload.name.strip(),
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        is_email_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    raw_token = _issue_verification_token(db, user)
    dev_url = send_verification_email(user.email, user.name, raw_token)

    token = create_access_token({"sub": str(user.id)})
    return schemas.SignupResponse(
        access_token=token,
        dev_verification_url=dev_url if is_console_backend() else None,
    )


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token}


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return schemas.user_out_from_orm(current_user)


@router.post("/me/avatar", response_model=schemas.UserOut)
async def upload_my_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Use a JPG, PNG, or WebP image.")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="The selected file is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Keep the photo under 5 MB.")

    processed = process_avatar(data)
    new_key = upload_avatar(current_user.id, processed)
    old_key = current_user.avatar_key
    current_user.avatar_key = new_key
    db.commit()
    db.refresh(current_user)
    if old_key and old_key != new_key:
        delete_avatar(old_key)
    return schemas.user_out_from_orm(current_user)


@router.delete("/me/avatar", response_model=schemas.UserOut)
def delete_my_avatar(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    old_key = current_user.avatar_key
    current_user.avatar_key = None
    db.commit()
    db.refresh(current_user)
    if old_key:
        delete_avatar(old_key)
    return schemas.user_out_from_orm(current_user)


@router.post("/verify-email", response_model=schemas.MessageResponse)
def verify_email(payload: schemas.VerifyEmailRequest, db: Session = Depends(get_db)):
    token_hash = hash_token(payload.token)
    record = db.query(models.EmailVerificationToken).filter(
        models.EmailVerificationToken.token_hash == token_hash
    ).first()
    if not record or record.used_at is not None or record.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="This verification link is invalid or has expired")

    user = db.query(models.User).filter(models.User.id == record.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="This verification link is invalid or has expired")

    user.is_email_verified = True
    record.used_at = datetime.utcnow()
    db.commit()
    return schemas.MessageResponse(message="Your email has been verified.")


@router.post("/resend-verification", response_model=schemas.MessageResponse)
def resend_verification(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.is_email_verified:
        return schemas.MessageResponse(message="Your email is already verified.")
    raw_token = _issue_verification_token(db, current_user)
    dev_url = send_verification_email(current_user.email, current_user.name, raw_token)
    return schemas.MessageResponse(
        message="Verification email sent.",
        dev_url=dev_url if is_console_backend() else None,
    )


@router.post("/forgot-password", response_model=schemas.MessageResponse)
def forgot_password(payload: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    generic_message = "If an account exists for that email, we've sent a password reset link."
    user = db.query(models.User).filter(models.User.email == payload.email.lower()).first()
    if not user:
        # Don't reveal whether the email is registered.
        return schemas.MessageResponse(message=generic_message)

    raw_token = _issue_reset_token(db, user)
    dev_url = send_password_reset_email(user.email, user.name, raw_token)
    return schemas.MessageResponse(
        message=generic_message,
        dev_url=dev_url if is_console_backend() else None,
    )


@router.post("/reset-password", response_model=schemas.MessageResponse)
def reset_password(payload: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    token_hash = hash_token(payload.token)
    record = db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.token_hash == token_hash
    ).first()
    if not record or record.used_at is not None or record.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired")

    user = db.query(models.User).filter(models.User.id == record.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired")

    user.hashed_password = hash_password(payload.new_password)
    record.used_at = datetime.utcnow()
    db.commit()
    return schemas.MessageResponse(message="Your password has been updated. You can now log in.")
