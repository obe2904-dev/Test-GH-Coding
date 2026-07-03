"""Supabase storage utilities."""

import requests
import logging
from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

logger = logging.getLogger(__name__)


def storage_public_url(bucket: str, path: str) -> str:
    """Get public URL for a storage object."""
    base = (SUPABASE_URL or "").rstrip("/")
    return f"{base}/storage/v1/object/public/{bucket}/{path}"


def storage_upload_public(bucket: str, path: str, content: bytes, content_type: str = "application/pdf") -> str:
    """Upload bytes to a public Supabase Storage bucket."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

    url = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/{bucket}/{path}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": content_type,
        "x-upsert": "true",
    }
    resp = requests.post(url, headers=headers, data=content, timeout=60)
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Storage upload failed: {resp.status_code} {resp.text}")
    return storage_public_url(bucket, path)


def storage_upload_public_with_mime_fallback(
    bucket: str,
    path: str,
    content: bytes,
    primary_content_type: str,
    fallback_content_type: str,
) -> str:
    """Upload with a primary MIME type, falling back if the bucket rejects it."""
    try:
        return storage_upload_public(bucket, path, content, content_type=primary_content_type)
    except RuntimeError as e:
        msg = str(e)
        if "invalid_mime_type" not in msg:
            raise
        logger.warning(
            f"Storage rejected MIME {primary_content_type} for {bucket}/{path}; "
            f"retrying with {fallback_content_type}"
        )
        return storage_upload_public(bucket, path, content, content_type=fallback_content_type)
