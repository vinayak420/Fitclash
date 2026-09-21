import io
import os
import uuid
from functools import lru_cache

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from fastapi import HTTPException, status
from PIL import Image, ImageDraw, ImageOps

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
AVATAR_SIZE = 512


def public_avatar_url(user) -> str | None:
    if not getattr(user, "avatar_key", None):
        return None
    version = user.avatar_key.rsplit("/", 1)[-1].split(".")[0]
    return f"/users/{user.id}/avatar?v={version}"


def process_avatar(data: bytes) -> bytes:
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except Exception:
        raise HTTPException(status_code=400, detail="That file is not a valid image.")

    fmt = (image.format or "").upper()
    if fmt not in ALLOWED_FORMATS:
        raise HTTPException(status_code=400, detail="Use a JPG, PNG, or WebP image.")

    image = ImageOps.exif_transpose(image)
    image = image.convert("RGBA")
    width, height = image.size
    side = min(width, height)
    left = (width - side) // 2
    top = (height - side) // 2
    image = image.crop((left, top, left + side, top + side))
    image = image.resize((AVATAR_SIZE, AVATAR_SIZE), Image.Resampling.LANCZOS)

    mask = Image.new("L", (AVATAR_SIZE, AVATAR_SIZE), 0)
    ImageDraw.Draw(mask).ellipse((1, 1, AVATAR_SIZE - 2, AVATAR_SIZE - 2), fill=255)
    rounded = Image.new("RGBA", (AVATAR_SIZE, AVATAR_SIZE), (0, 0, 0, 0))
    rounded.paste(image, (0, 0), mask)

    buffer = io.BytesIO()
    rounded.save(buffer, format="WEBP", quality=85, method=6)
    return buffer.getvalue()


@lru_cache(maxsize=1)
def _client_and_bucket():
    endpoint = os.getenv("AWS_ENDPOINT_URL_S3")
    access_key = os.getenv("AWS_ACCESS_KEY_ID")
    secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
    region = os.getenv("AWS_REGION", "ap-southeast-1")
    bucket = os.getenv("AWS_S3_BUCKET", "fitclash-avatars")
    if not all([endpoint, access_key, secret_key, bucket]):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Profile photo storage is not configured.",
        )
    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=region,
        config=Config(s3={"addressing_style": "path"}),
    )
    return client, bucket


def _ensure_bucket(client, bucket: str):
    try:
        client.head_bucket(Bucket=bucket)
        return
    except ClientError:
        pass
    try:
        client.create_bucket(Bucket=bucket)
    except ClientError as err:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not access the profile photo bucket.",
        ) from err


def upload_avatar(user_id: int, image_bytes: bytes) -> str:
    client, bucket = _client_and_bucket()
    _ensure_bucket(client, bucket)
    key = f"avatars/{user_id}/{uuid.uuid4().hex}.webp"
    try:
        client.put_object(
            Bucket=bucket,
            Key=key,
            Body=image_bytes,
            ContentType="image/webp",
            CacheControl="public, max-age=31536000",
        )
    except ClientError as err:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not save the profile photo.",
        ) from err
    return key


def download_avatar(key: str) -> bytes:
    client, bucket = _client_and_bucket()
    try:
        obj = client.get_object(Bucket=bucket, Key=key)
        return obj["Body"].read()
    except ClientError as err:
        raise HTTPException(status_code=404, detail="Profile photo not found.") from err


def delete_avatar(key: str) -> None:
    if not key:
        return
    client, bucket = _client_and_bucket()
    try:
        client.delete_object(Bucket=bucket, Key=key)
    except ClientError:
        pass
