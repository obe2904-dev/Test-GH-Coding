"""Configuration and environment variables for menu extraction worker."""

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


# Environment variables
SUPABASE_URL = _clean_env_value(os.getenv("SUPABASE_URL"))
SUPABASE_KEY = _clean_env_value(os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
SUPABASE_SERVICE_ROLE_KEY = SUPABASE_KEY
OPENAI_API_KEY = _clean_env_value(os.getenv("OPENAI_API_KEY"))

# Worker configuration
WORKER_TRIGGER_TOKEN = os.getenv("WORKER_TRIGGER_TOKEN")
_bg_poll_env = (os.getenv("WORKER_BACKGROUND_POLL_ENABLED") or "true").strip().lower()
WORKER_BACKGROUND_POLL_ENABLED = _bg_poll_env in ("1", "true", "yes")
WORKER_BUILD_ID = (os.getenv("WORKER_BUILD_ID") or "").strip()

# Extraction configuration
MIN_CHARS_PER_PAGE_FOR_DIGITAL = int(os.getenv("MIN_CHARS_PER_PAGE_FOR_DIGITAL", "250"))
MIN_TOTAL_CHARS_FOR_DIGITAL = int(os.getenv("MIN_TOTAL_CHARS_FOR_DIGITAL", "800"))
MAX_PAGES_TO_PROCESS = int(os.getenv("MAX_PAGES_TO_PROCESS", "12"))
MAX_LLM_CHARS = int(os.getenv("MAX_LLM_CHARS", "18000"))
STALE_JOB_MINUTES = int(os.getenv("STALE_JOB_MINUTES", "12"))

# Document AI configuration
DOCAI_ENABLED = os.getenv("DOCAI_ENABLED", "true").lower() in ("1", "true", "yes")
DOCAI_TIMEOUT_SECONDS = int(os.getenv("DOCAI_TIMEOUT_SECONDS", "90"))

# Tesseract configuration
TESSERACT_ZOOM = float(os.getenv("TESSERACT_ZOOM", "1.5"))

# GPT-5.2 Vision configuration
GPT52_VISION_ENABLED = os.getenv("GPT52_VISION_ENABLED", "true").lower() in ("1", "true", "yes")
GPT52_MODEL = os.getenv("GPT52_MODEL", "gpt-5.2")
GPT52_MAX_PAGES = int(os.getenv("GPT52_MAX_PAGES", "4"))
GPT52_MAX_IMAGE_WIDTH = int(os.getenv("GPT52_MAX_IMAGE_WIDTH", "1400"))
GPT52_TIMEOUT_SECONDS = int(os.getenv("GPT52_TIMEOUT_SECONDS", "120"))
HARD_PDF_SKIP_OCR = os.getenv("HARD_PDF_SKIP_OCR", "true").lower() in ("1", "true", "yes")

# Fetch configuration
FETCH_TIMEOUT_SECONDS = int(os.getenv("FETCH_TIMEOUT_SECONDS", "25"))


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
