PRIVATE_KEYS = {
    "email",
    "hashed_password",
    "password",
    "password_hash",
    "is_email_verified",
    "access_token",
    "avatar_key",
}


def _signup(client, name, email):
    res = client.post("/auth/signup", json={"name": name, "email": email, "password": "secret1"})
    assert res.status_code == 201, res.text
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200, me.text
    return headers, me.json()


def _start_and_item(client, headers, group_id, name, points):
    started = client.post(
        f"/groups/{group_id}/challenge/start",
        json={"name": "Public profile challenge"},
        headers=headers,
    )
    assert started.status_code == 201, started.text
    item = client.post(
        f"/groups/{group_id}/challenge/items",
        json={"name": name, "points": points},
        headers=headers,
    )
    assert item.status_code == 201, item.text
    return item.json()


def test_public_profile_requires_auth(client):
    res = client.get("/users/1/profile")
    assert res.status_code == 401


def test_public_profile_404(client, auth_headers):
    res = client.get("/users/99999/profile", headers=auth_headers)
    assert res.status_code == 404


def test_public_profile_hides_private_fields_and_zeros(client, auth_headers):
    me = client.get("/auth/me", headers=auth_headers)
    user_id = me.json()["id"]
    res = client.get(f"/users/{user_id}/profile", headers=auth_headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["id"] == user_id
    assert body["name"] == "Ada"
    assert body["weekly_points"] == 0
    assert body["streak"] == 0
    assert body["badge_count"] == 0
    assert body["challenges_won"] == 0
    assert body["badges"] == []
    for key in PRIVATE_KEYS:
        assert key not in body
    own = client.get("/users/me/stats", headers=auth_headers)
    assert own.status_code == 200
    stats = own.json()
    assert "overall_points" in stats
    assert stats["streak"] == 0
    assert stats["badge_count"] == 0
    assert stats["challenges_won"] == 0


def test_weekly_points_match_leaderboard_and_allow_negative(client, auth_headers):
    ada = client.get("/auth/me", headers=auth_headers).json()
    created = client.post("/groups", json={"name": "Crew"}, headers=auth_headers)
    assert created.status_code == 201, created.text
    group = created.json()
    group_id = group["id"]
    invite = group["invite_code"]
    plus = _start_and_item(client, auth_headers, group_id, "Run", 10)
    minus = client.post(
        f"/groups/{group_id}/challenge/items",
        json={"name": "Junk", "points": -2},
        headers=auth_headers,
    ).json()

    bob_headers, bob = _signup(client, "Rahul Sharma", "rahul@example.com")
    joined = client.post("/groups/join", json={"invite_code": invite}, headers=bob_headers)
    assert joined.status_code == 200, joined.text

    ada_sub = client.post(
        f"/groups/{group_id}/submissions",
        json={"completed_item_ids": [plus["id"]]},
        headers=auth_headers,
    )
    assert ada_sub.status_code == 201, ada_sub.text
    bob_sub = client.post(
        f"/groups/{group_id}/submissions",
        json={"completed_item_ids": [minus["id"]]},
        headers=bob_headers,
    )
    assert bob_sub.status_code == 201, bob_sub.text
    assert bob_sub.json()["points_earned"] == -2

    weekly = client.get(f"/groups/{group_id}/leaderboard?mode=weekly", headers=auth_headers)
    assert weekly.status_code == 200, weekly.text
    by_id = {row["user_id"]: row["points"] for row in weekly.json()}

    bob_profile = client.get(
        f"/users/{bob['id']}/profile?group_id={group_id}",
        headers=auth_headers,
    )
    assert bob_profile.status_code == 200, bob_profile.text
    bob_body = bob_profile.json()
    assert "email" not in bob_body
    assert bob_body["name"] == "Rahul Sharma"
    assert bob_body["weekly_points"] == by_id[bob["id"]] == -2
    assert bob_body["badge_count"] == 0
    assert bob_body["challenges_won"] == 0

    ada_profile = client.get(
        f"/users/{ada['id']}/profile?group_id={group_id}",
        headers=bob_headers,
    )
    assert ada_profile.status_code == 200
    assert ada_profile.json()["weekly_points"] == by_id[ada["id"]] == 10
    assert ada_profile.json()["streak"] == client.get("/users/me/stats", headers=auth_headers).json()["streak"]

    ended = client.post(f"/groups/{group_id}/challenge/end", headers=auth_headers)
    assert ended.status_code == 200, ended.text
    after_end = client.get(f"/users/{ada['id']}/profile", headers=bob_headers)
    assert after_end.status_code == 200
    assert after_end.json()["challenges_won"] == 1
    ada_stats = client.get("/users/me/stats", headers=auth_headers).json()
    assert ada_stats["challenges_won"] == 1
    assert after_end.json()["badge_count"] == ada_stats["badge_count"]
