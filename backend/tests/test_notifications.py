import os

from app.notification_service import (
    create_notification,
    notify_badges_earned,
    run_challenge_lifecycle,
    run_daily_reminders,
)
from app import models
from app.database import SessionLocal


def _signup(client, name, email):
    res = client.post("/auth/signup", json={"name": name, "email": email, "password": "secret1"})
    assert res.status_code == 201, res.text
    headers = {"Authorization": f"Bearer {res.json()['access_token']}"}
    me = client.get("/auth/me", headers=headers)
    return headers, me.json()


def _start_with_items(client, headers, group_id, items):
    started = client.post(
        f"/groups/{group_id}/challenge/start",
        json={"name": "Arena", "end_date": None},
        headers=headers,
    )
    assert started.status_code == 201, started.text
    created = []
    for name, points in items:
        item = client.post(
            f"/groups/{group_id}/challenge/items",
            json={"name": name, "points": points},
            headers=headers,
        )
        assert item.status_code == 201, item.text
        created.append(item.json())
    return started.json(), created


def _notes(client, headers):
    res = client.get("/notifications", headers=headers)
    assert res.status_code == 200, res.text
    return res.json()


def test_notifications_require_auth(client):
    assert client.get("/notifications").status_code == 401
    assert client.post("/notifications/1/read").status_code == 401
    assert client.post("/notifications/read-all").status_code == 401


def test_community_join_notifies_admin_not_joiner(client, auth_headers):
    created = client.post("/groups", json={"name": "Gym"}, headers=auth_headers)
    assert created.status_code == 201
    invite = created.json()["invite_code"]
    bob_headers, bob = _signup(client, "Rahul Sharma", "rahul-n@example.com")
    joined = client.post("/groups/join", json={"invite_code": invite}, headers=bob_headers)
    assert joined.status_code == 200, joined.text

    admin_notes = _notes(client, auth_headers)
    join_notes = [n for n in admin_notes["items"] if n["type"] == "COMMUNITY_JOIN"]
    assert len(join_notes) == 1
    assert "Rahul Sharma" in join_notes[0]["title"]
    assert "Gym" in join_notes[0]["body"]
    assert "/communities/" in join_notes[0]["link_path"]

    bob_notes = _notes(client, bob_headers)
    assert all(n["type"] != "COMMUNITY_JOIN" for n in bob_notes["items"])


def test_cannot_read_another_users_notification(client, auth_headers):
    created = client.post("/groups", json={"name": "Gym"}, headers=auth_headers)
    invite = created.json()["invite_code"]
    bob_headers, _bob = _signup(client, "Bob", "bob-n@example.com")
    client.post("/groups/join", json={"invite_code": invite}, headers=bob_headers)
    admin_notes = _notes(client, auth_headers)["items"]
    note_id = admin_notes[0]["id"]
    assert client.post(f"/notifications/{note_id}/read", headers=bob_headers).status_code == 404


def test_points_logged_signed_values_and_overtake(client, auth_headers):
    created = client.post("/groups", json={"name": "Crew"}, headers=auth_headers)
    group_id = created.json()["id"]
    invite = created.json()["invite_code"]
    bob_headers, bob = _signup(client, "Rahul Sharma", "rahul-pts@example.com")
    client.post("/groups/join", json={"invite_code": invite}, headers=bob_headers)
    _challenge, items = _start_with_items(client, auth_headers, group_id, [("Small", 5), ("Big", 10), ("Junk", -2)])
    small, big, minus = items

    ada_sub = client.post(
        f"/groups/{group_id}/submissions",
        json={"completed_item_ids": [small["id"]]},
        headers=auth_headers,
    )
    assert ada_sub.status_code == 201
    assert any("+5" in n["title"] for n in _notes(client, auth_headers)["items"] if n["type"] == "POINTS_LOGGED")

    bob_sub = client.post(
        f"/groups/{group_id}/submissions",
        json={"completed_item_ids": [big["id"], minus["id"]]},
        headers=bob_headers,
    )
    assert bob_sub.status_code == 201
    assert bob_sub.json()["points_earned"] == 8
    bob_points = [n for n in _notes(client, bob_headers)["items"] if n["type"] == "POINTS_LOGGED"]
    assert any("+8" in n["title"] for n in bob_points)

    ada_over = [n for n in _notes(client, auth_headers)["items"] if n["type"] == "LEADERBOARD_OVERTAKEN"]
    assert len(ada_over) == 1
    assert "Rahul Sharma" in ada_over[0]["body"]
    assert ada_over[0]["actor_user_id"] == bob["id"]

    junk_group = client.post("/groups", json={"name": "Neg"}, headers=auth_headers)
    gid = junk_group.json()["id"]
    _c2, items2 = _start_with_items(client, auth_headers, gid, [("Junk", -2)])
    neg = client.post(
        f"/groups/{gid}/submissions",
        json={"completed_item_ids": [items2[0]["id"]]},
        headers=auth_headers,
    )
    assert neg.status_code == 201
    assert any("-2" in n["title"] and n["type"] == "POINTS_LOGGED" for n in _notes(client, auth_headers)["items"])


def test_badge_award_is_once(client, auth_headers):
    created = client.post("/groups", json={"name": "Badges"}, headers=auth_headers)
    group_id = created.json()["id"]
    _challenge, items = _start_with_items(client, auth_headers, group_id, [("Only", 5)])
    sub = client.post(
        f"/groups/{group_id}/submissions",
        json={"completed_item_ids": [items[0]["id"]]},
        headers=auth_headers,
    )
    assert sub.status_code == 201
    me = client.get("/auth/me", headers=auth_headers).json()
    notes = [n for n in _notes(client, auth_headers)["items"] if n["type"] == "BADGE_EARNED"]
    assert len(notes) == 1
    assert "All-Rounder" in notes[0]["body"]

    db = SessionLocal()
    try:
        badge = db.query(models.Badge).filter(models.Badge.code == "full_sweep").first()
        notify_badges_earned(db, me["id"], [badge])
        notify_badges_earned(db, me["id"], [badge])
    finally:
        db.close()
    notes_after = [n for n in _notes(client, auth_headers)["items"] if n["type"] == "BADGE_EARNED"]
    assert len(notes_after) == 1


def test_challenge_start_end_and_week_reminder_idempotent(client, auth_headers):
    created = client.post("/groups", json={"name": "Timed"}, headers=auth_headers)
    group_id = created.json()["id"]
    from datetime import date, timedelta
    end = date.today() + timedelta(days=7)
    started = client.post(
        f"/groups/{group_id}/challenge/start",
        json={"name": "Seven-day grind", "end_date": end.isoformat()},
        headers=auth_headers,
    )
    assert started.status_code == 201, started.text
    starts = [n for n in _notes(client, auth_headers)["items"] if n["type"] == "CHALLENGE_STARTED"]
    assert len(starts) == 1

    db = SessionLocal()
    try:
        run_challenge_lifecycle(db, today=date.today())
        run_challenge_lifecycle(db, today=date.today())
    finally:
        db.close()
    notes = _notes(client, auth_headers)["items"]
    assert len([n for n in notes if n["type"] == "CHALLENGE_STARTED"]) == 1
    assert len([n for n in notes if n["type"] == "CHALLENGE_ENDING_SOON"]) == 1

    ended = client.post(f"/groups/{group_id}/challenge/end", headers=auth_headers)
    assert ended.status_code == 200, ended.text
    assert len([n for n in _notes(client, auth_headers)["items"] if n["type"] == "CHALLENGE_ENDED"]) == 1
    client.post(f"/groups/{group_id}/challenge/end", headers=auth_headers)
    assert len([n for n in _notes(client, auth_headers)["items"] if n["type"] == "CHALLENGE_ENDED"]) == 1


def test_daily_reminder_skips_users_who_logged(client, auth_headers):
    from datetime import date
    created = client.post("/groups", json={"name": "Remind"}, headers=auth_headers)
    group_id = created.json()["id"]
    invite = created.json()["invite_code"]
    bob_headers, _bob = _signup(client, "Rahul", "rahul-rem@example.com")
    client.post("/groups/join", json={"invite_code": invite}, headers=bob_headers)
    _challenge, items = _start_with_items(client, auth_headers, group_id, [("Run", 10)])
    client.post(
        f"/groups/{group_id}/submissions",
        json={"completed_item_ids": [items[0]["id"]]},
        headers=auth_headers,
    )
    db = SessionLocal()
    try:
        run_daily_reminders(db, today=date.today())
        run_daily_reminders(db, today=date.today())
    finally:
        db.close()
    ada_rem = [n for n in _notes(client, auth_headers)["items"] if n["type"] == "DAILY_POINTS_REMINDER"]
    bob_rem = [n for n in _notes(client, bob_headers)["items"] if n["type"] == "DAILY_POINTS_REMINDER"]
    assert ada_rem == []
    assert len(bob_rem) == 1


def test_mark_read_and_multiple_push_subscriptions(client, auth_headers):
    created = client.post("/groups", json={"name": "Push"}, headers=auth_headers)
    invite = created.json()["invite_code"]
    bob_headers, _bob = _signup(client, "Rahul", "rahul-push@example.com")
    client.post("/groups/join", json={"invite_code": invite}, headers=bob_headers)
    listed = _notes(client, auth_headers)
    assert listed["unread_count"] >= 1
    note_id = listed["items"][0]["id"]
    read = client.post(f"/notifications/{note_id}/read", headers=auth_headers)
    assert read.status_code == 200
    assert read.json()["read_at"]
    client.post("/notifications/read-all", headers=auth_headers)
    after = _notes(client, auth_headers)
    assert after["unread_count"] == 0
    assert all(n["read_at"] for n in after["items"])

    first = client.post(
        "/notifications/subscribe",
        json={"endpoint": "https://push.example/one", "keys": {"p256dh": "aaa", "auth": "bbb"}},
        headers=auth_headers,
    )
    second = client.post(
        "/notifications/subscribe",
        json={"endpoint": "https://push.example/two", "keys": {"p256dh": "ccc", "auth": "ddd"}},
        headers=auth_headers,
    )
    assert first.status_code == 201
    assert second.status_code == 201
    db = SessionLocal()
    try:
        me = client.get("/auth/me", headers=auth_headers).json()
        count = db.query(models.PushSubscription).filter(models.PushSubscription.user_id == me["id"]).count()
        assert count == 2
        stale = db.query(models.PushSubscription).filter(models.PushSubscription.endpoint == "https://push.example/one").first()
        db.delete(stale)
        db.commit()
        assert db.query(models.PushSubscription).filter(models.PushSubscription.user_id == me["id"]).count() == 1
    finally:
        db.close()


def test_cron_requires_secret(client):
    os.environ["CRON_SECRET"] = "test-cron-secret"
    assert client.post("/internal/cron/daily-reminders").status_code == 401
    ok = client.post("/internal/cron/daily-reminders", headers={"X-Cron-Secret": "test-cron-secret"})
    assert ok.status_code == 200
    os.environ.pop("CRON_SECRET", None)


def test_create_notification_self_actor_skipped(client, auth_headers):
    me = client.get("/auth/me", headers=auth_headers).json()
    db = SessionLocal()
    try:
        created = create_notification(
            db,
            user_id=me["id"],
            ntype=models.NotificationType.COMMUNITY_JOIN,
            title="nope",
            body="nope",
            event_key="self-skip",
            actor_user_id=me["id"],
        )
        assert created is None
    finally:
        db.close()
