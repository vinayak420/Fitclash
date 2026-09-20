from app import models
from app.database import SessionLocal


def test_create_group_does_not_create_challenge_or_items(client, auth_headers):
    res = client.post("/groups", json={"name": "Morning Grind"}, headers=auth_headers)
    assert res.status_code == 201, res.text
    body = res.json()

    assert body["name"] == "Morning Grind"
    assert body["invite_code"]
    assert body["members"][0]["role"] == "ADMIN"
    assert body["challenge"] is None
    assert body["last_completed_challenge"] is None

    group_id = body["id"]
    db = SessionLocal()
    try:
        challenges = db.query(models.Challenge).filter_by(group_id=group_id).all()
        assert challenges == []
        assert db.query(models.ChallengeItem).count() == 0
    finally:
        db.close()


def test_start_challenge_creates_empty_challenge_without_default_items(client, auth_headers):
    created = client.post("/groups", json={"name": "Crew"}, headers=auth_headers)
    assert created.status_code == 201, created.text
    group_id = created.json()["id"]
    assert created.json()["challenge"] is None

    started = client.post(
        f"/groups/{group_id}/challenge/start",
        json={"name": "Morning routine"},
        headers=auth_headers,
    )
    assert started.status_code == 201, started.text
    challenge = started.json()
    assert challenge["name"] == "Morning routine"
    assert challenge["is_active"] is True
    assert challenge["items"] == []

    detail = client.get(f"/groups/{group_id}", headers=auth_headers)
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert body["challenge"]["id"] == challenge["id"]
    assert body["challenge"]["items"] == []
    assert body["last_completed_challenge"] is None

    db = SessionLocal()
    try:
        assert db.query(models.Challenge).filter_by(group_id=group_id).count() == 1
        assert db.query(models.ChallengeItem).count() == 0
    finally:
        db.close()


def test_start_challenge_requires_name(client, auth_headers):
    created = client.post("/groups", json={"name": "Crew"}, headers=auth_headers)
    group_id = created.json()["id"]

    missing = client.post(f"/groups/{group_id}/challenge/start", json={}, headers=auth_headers)
    assert missing.status_code == 422

    blank = client.post(
        f"/groups/{group_id}/challenge/start",
        json={"name": "   "},
        headers=auth_headers,
    )
    assert blank.status_code == 400
    db = SessionLocal()
    try:
        assert db.query(models.Challenge).filter_by(group_id=group_id).count() == 0
    finally:
        db.close()


def test_non_admin_cannot_start_challenge(client, auth_headers):
    created = client.post("/groups", json={"name": "Crew"}, headers=auth_headers)
    group_id = created.json()["id"]
    invite = created.json()["invite_code"]

    member = client.post(
        "/auth/signup",
        json={"name": "Bo", "email": "bo@example.com", "password": "secret1"},
    )
    assert member.status_code == 201, member.text
    member_headers = {"Authorization": f"Bearer {member.json()['access_token']}"}
    joined = client.post("/groups/join", json={"invite_code": invite}, headers=member_headers)
    assert joined.status_code == 200, joined.text

    started = client.post(
        f"/groups/{group_id}/challenge/start",
        json={"name": "Morning routine"},
        headers=member_headers,
    )
    assert started.status_code == 403
    db = SessionLocal()
    try:
        assert db.query(models.Challenge).filter_by(group_id=group_id).count() == 0
    finally:
        db.close()
