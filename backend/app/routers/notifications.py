from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _list_query(db: Session, user_id: int):
    return (
        db.query(models.Notification)
        .filter(models.Notification.user_id == user_id)
        .order_by(models.Notification.created_at.desc())
    )


def _unread_count(db: Session, user_id: int) -> int:
    return (
        db.query(models.Notification)
        .filter(models.Notification.user_id == user_id, models.Notification.read_at.is_(None))
        .count()
    )


@router.get("/push-config", response_model=schemas.PushConfigOut)
def push_config():
    import os
    public_key = os.getenv("VAPID_PUBLIC_KEY", "").strip()
    return schemas.PushConfigOut(public_key=public_key or None, configured=bool(public_key))


@router.get("", response_model=schemas.NotificationListOut)
def list_notifications(
    unread_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = _list_query(db, current_user.id)
    if unread_only:
        q = q.filter(models.Notification.read_at.is_(None))
    items = q.limit(100).all()
    return schemas.NotificationListOut(items=items, unread_count=_unread_count(db, current_user.id))


@router.get("/unread-count")
def unread_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return {"unread_count": _unread_count(db, current_user.id)}


@router.post("/{notification_id}/read", response_model=schemas.NotificationOut)
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    row = (
        db.query(models.Notification)
        .filter(models.Notification.id == notification_id, models.Notification.user_id == current_user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Notification not found.")
    if row.read_at is None:
        row.read_at = datetime.utcnow()
        db.commit()
        db.refresh(row)
    return row


@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    now = datetime.utcnow()
    (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id, models.Notification.read_at.is_(None))
        .update({models.Notification.read_at: now}, synchronize_session=False)
    )
    db.commit()
    return {"unread_count": 0}


@router.post("/subscribe", status_code=201)
def subscribe(
    payload: schemas.PushSubscribeRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    keys = payload.keys or {}
    p256dh = keys.get("p256dh")
    auth = keys.get("auth")
    if not p256dh or not auth:
        raise HTTPException(status_code=422, detail="Push subscription keys are required.")
    existing = (
        db.query(models.PushSubscription)
        .filter(models.PushSubscription.endpoint == payload.endpoint)
        .first()
    )
    if existing:
        if existing.user_id != current_user.id:
            existing.user_id = current_user.id
        existing.p256dh = p256dh
        existing.auth = auth
        existing.user_agent = payload.user_agent
        db.commit()
        return {"id": existing.id, "status": "updated"}
    row = models.PushSubscription(
        user_id=current_user.id,
        endpoint=payload.endpoint,
        p256dh=p256dh,
        auth=auth,
        user_agent=payload.user_agent,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "status": "created"}


@router.delete("/subscribe")
def unsubscribe(
    payload: schemas.PushSubscribeRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    row = (
        db.query(models.PushSubscription)
        .filter(
            models.PushSubscription.endpoint == payload.endpoint,
            models.PushSubscription.user_id == current_user.id,
        )
        .first()
    )
    if row:
        db.delete(row)
        db.commit()
    return {"status": "removed"}
