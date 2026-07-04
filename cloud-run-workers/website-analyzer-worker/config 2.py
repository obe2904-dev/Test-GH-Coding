"""Configuration and environment variables for website analyzer worker."""

import os
import logging
from typing import Optional
from supabase import create_client, Client

logger = logging.getLogger(__name__)


def _clean_env_value(value: Optional[str]) -> Optional[str]:
    """Remove accidental quotes from environment variables."""
    if value is None:
        return None
    v = value.strip()
    if (len(v) >= 2) and ((v[0] == '"' and v[-1] == '"') or (v[0] == "'" and v[-1] == "'")):
        v = v[1:-1].strip()
    return v or None


def _mask_secret(value: Optional[str]) -> str:
    """Mask sensitive values for logging."""
    if not value:
        return "<missing>"
    value = value.strip()
    if not value:
        return "<missing>"
    if len(value) <= 10:
        return f"{value[:2]}…(len={len(value)})"
    return f"{value[:6]}…(len={len(value)})"


# Environment variables (reuse same credentials as menu-ocr-worker)
SUPABASE_URL = _clean_env_value(os.getenv("SUPABASE_URL"))
SUPABASE_KEY = _clean_env_value(os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
SUPABASE_SERVICE_ROLE_KEY = SUPABASE_KEY
OPENAI_API_KEY = _clean_env_value(os.getenv("OPENAI_API_KEY"))

# Worker configuration
WORKER_TRIGGER_TOKEN = os.getenv("WORKER_TRIGGER_TOKEN")
_bg_poll_env = (os.getenv("WORKER_BACKGROUND_POLL_ENABLED") or "false").strip().lower()
WORKER_BACKGROUND_POLL_ENABLED = _bg_poll_env in ("1", "true", "yes")
WORKER_BUILD_ID = (os.getenv("WORKER_BUILD_ID") or "").strip()

# Analysis configuration
FETCH_TIMEOUT_SECONDS = int(os.getenv("FETCH_TIMEOUT_SECONDS", "25"))
MAX_CONTENT_SIZE_MB = int(os.getenv("MAX_CONTENT_SIZE_MB", "10"))
STALE_JOB_MINUTES = int(os.getenv("STALE_JOB_MINUTES", "12"))
MAX_AI_RETRIES = int(os.getenv("MAX_AI_RETRIES", "2"))

# AI configuration
GPT_MODEL = os.getenv("GPT_MODEL", "gpt-4o")
GPT_FALLBACK_MODEL = os.getenv("GPT_FALLBACK_MODEL", "gpt-4o-mini")
MAX_TOKENS = int(os.getenv("MAX_TOKENS", "2000"))

# Initialize Supabase client
supabase: Optional[Client] = None

try:
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables")
        raise ValueError("Missing Supabase credentials")
    
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    logger.info("✅ Supabase client initialized")
    logger.info(
        "Supabase env: url=%s key=%s",
        (SUPABASE_URL or "<missing>").rstrip("/")[:48] + ("…" if SUPABASE_URL and len(SUPABASE_URL) > 48 else ""),
        _mask_secret(SUPABASE_KEY),
    )
except Exception as e:
    logger.error(f"Failed to initialize Supabase client: {str(e)}")
    logger.info("Note: Worker will run but cannot process jobs without Supabase connection")
