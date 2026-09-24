def _start_challenge(client, headers, group_id, name="Signed points"):
    started = client.post(
        f"/groups/{group_id}/challenge/start",
        json={"name": name},
        headers=headers,
    )
    assert started.status_code == 201, started.text
    return started.json()


def _add_item(client, headers, group_id, name, points):
    res = client.post(
        f"/groups/{group_id}/challenge/items",
        json={"name": name, "points": points},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()


def _setup_group(client, auth_headers):
    created = client.post("/groups", json={"name": "Points Crew"}, headers=auth_headers)
    assert created.status_code == 201, created.text
    group_id = created.json()["id"]
    _start_challenge(client, auth_headers, group_id)
    return group_id


def test_rejects_old_non_integer_and_out_of_range(client, auth_headers):
    group_id = _setup_group(client, auth_headers)
    too_low = client.post(
        f"/groups/{group_id}/challenge/items",
        json={"name": "Too low", "points": -1001},
        headers=auth_headers,
    )
    assert too_low.status_code == 422
    too_high = client.post(
        f"/groups/{group_id}/challenge/items",
        json={"name": "Too high", "points": 1001},
        headers=auth_headers,
    )
    assert too_high.status_code == 422


def test_positive_task_adds_ten(client, auth_headers):
    group_id = _setup_group(client, auth_headers)
    item = _add_item(client, auth_headers, group_id, "Complete 5km run", 10)
    sub = client.post(
        f"/groups/{group_id}/submissions",
        json={"completed_item_ids": [item["id"]]},
        headers=auth_headers,
    )
    assert sub.status_code == 201, sub.text
    assert sub.json()["points_earned"] == 10


def test_negative_task_subtracts_two(client, auth_headers):
    group_id = _setup_group(client, auth_headers)
    item = _add_item(client, auth_headers, group_id, "Eat junk food", -2)
    sub = client.post(
        f"/groups/{group_id}/submissions",
        json={"completed_item_ids": [item["id"]]},
        headers=auth_headers,
    )
    assert sub.status_code == 201, sub.text
    assert sub.json()["points_earned"] == -2


def test_mixed_tasks_sum_to_eight(client, auth_headers):
    group_id = _setup_group(client, auth_headers)
    plus = _add_item(client, auth_headers, group_id, "Complete workout", 10)
    minus = _add_item(client, auth_headers, group_id, "Eat junk food", -2)
    sub = client.post(
        f"/groups/{group_id}/submissions",
        json={"completed_item_ids": [plus["id"], minus["id"]]},
        headers=auth_headers,
    )
    assert sub.status_code == 201, sub.text
    assert sub.json()["points_earned"] == 8


def test_negative_daily_total_is_not_clamped(client, auth_headers):
    group_id = _setup_group(client, auth_headers)
    plus = _add_item(client, auth_headers, group_id, "Show up", 5)
    minus = _add_item(client, auth_headers, group_id, "Skip workout", -10)
    sub = client.post(
        f"/groups/{group_id}/submissions",
        json={"completed_item_ids": [plus["id"], minus["id"]]},
        headers=auth_headers,
    )
    assert sub.status_code == 201, sub.text
    assert sub.json()["points_earned"] == -5
    board = client.get(f"/groups/{group_id}/leaderboard?mode=group", headers=auth_headers)
    assert board.status_code == 200, board.text
    assert board.json()[0]["points"] == -5
    stats = client.get("/users/me/stats", headers=auth_headers)
    assert stats.status_code == 200, stats.text
    assert stats.json()["overall_points"] == -5


def test_deleting_negative_task_reverses_its_points(client, auth_headers):
    group_id = _setup_group(client, auth_headers)
    plus = _add_item(client, auth_headers, group_id, "Complete workout", 10)
    minus = _add_item(client, auth_headers, group_id, "Eat junk food", -2)
    sub = client.post(
        f"/groups/{group_id}/submissions",
        json={"completed_item_ids": [plus["id"], minus["id"]]},
        headers=auth_headers,
    )
    assert sub.json()["points_earned"] == 8

    deleted = client.delete(
        f"/groups/{group_id}/challenge/items/{minus['id']}",
        headers=auth_headers,
    )
    assert deleted.status_code == 204, deleted.text

    today = client.get(f"/groups/{group_id}/submissions/today", headers=auth_headers)
    assert today.status_code == 200, today.text
    assert today.json()["points_earned"] == 10
    assert minus["id"] not in today.json()["completed_item_ids"]


def test_editing_task_points_recalculates_submission(client, auth_headers):
    group_id = _setup_group(client, auth_headers)
    item = _add_item(client, auth_headers, group_id, "Workout", 5)
    sub = client.post(
        f"/groups/{group_id}/submissions",
        json={"completed_item_ids": [item["id"]]},
        headers=auth_headers,
    )
    assert sub.json()["points_earned"] == 5

    updated = client.put(
        f"/groups/{group_id}/challenge/items/{item['id']}",
        json={"name": "Workout", "points": -3},
        headers=auth_headers,
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["points"] == -3

    today = client.get(f"/groups/{group_id}/submissions/today", headers=auth_headers)
    assert today.json()["points_earned"] == -3
    board = client.get(f"/groups/{group_id}/leaderboard?mode=group", headers=auth_headers)
    assert board.json()[0]["points"] == -3
