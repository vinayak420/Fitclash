def _png_bytes():
    from PIL import Image
    import io
    img = Image.new("RGB", (40, 20), (124, 92, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_reject_non_image(client, auth_headers):
    res = client.post(
        "/auth/me/avatar",
        headers=auth_headers,
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert res.status_code == 400


def test_reject_oversize(client, auth_headers, monkeypatch):
    monkeypatch.setattr("app.routers.auth.MAX_UPLOAD_BYTES", 10)
    res = client.post(
        "/auth/me/avatar",
        headers=auth_headers,
        files={"file": ("big.png", b"x" * 20, "image/png")},
    )
    assert res.status_code == 400


def test_upload_replace_and_delete(client, auth_headers, monkeypatch):
    stored = {}

    def fake_upload(user_id, image_bytes):
        key = f"avatars/{user_id}/test.webp"
        stored[key] = image_bytes
        return key

    monkeypatch.setattr("app.routers.auth.upload_avatar", fake_upload)
    monkeypatch.setattr("app.routers.auth.delete_avatar", lambda key: stored.pop(key, None))
    monkeypatch.setattr("app.routers.users.download_avatar", lambda key: stored[key])

    me = client.get("/auth/me", headers=auth_headers)
    assert me.status_code == 200
    assert me.json()["avatar_url"] is None

    res = client.post(
        "/auth/me/avatar",
        headers=auth_headers,
        files={"file": ("photo.png", _png_bytes(), "image/png")},
    )
    assert res.status_code == 200, res.text
    assert res.json()["avatar_url"].startswith("/users/")
    user_id = res.json()["id"]

    img = client.get(f"/users/{user_id}/avatar")
    assert img.status_code == 200
    assert img.headers["content-type"] == "image/webp"

    deleted = client.delete("/auth/me/avatar", headers=auth_headers)
    assert deleted.status_code == 200
    assert deleted.json()["avatar_url"] is None
    assert client.get(f"/users/{user_id}/avatar").status_code == 404
