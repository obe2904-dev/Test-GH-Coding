"""General helper utilities."""

from datetime import datetime
from typing import Optional
import re
from urllib.parse import urlparse


def utc_now_iso() -> str:
    """Get current UTC time in ISO format."""
    return datetime.utcnow().isoformat() + 'Z'


def normalize_url(url: str) -> str:
    """Normalize URL to standard format."""
    url = url.strip()
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    return url.rstrip('/')


def extract_domain(url: str) -> str:
    """Extract domain from URL."""
    parsed = urlparse(url)
    return parsed.netloc or parsed.path


def is_valid_url(url: str) -> bool:
    """Check if URL is valid."""
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except:
        return False


def clean_text(text: str) -> str:
    """Clean and normalize text."""
    if not text:
        return ""
    # Remove multiple spaces
    text = re.sub(r'\s+', ' ', text)
    # Remove multiple newlines
    text = re.sub(r'\n\s*\n', '\n\n', text)
    return text.strip()


def truncate_text(text: str, max_length: int) -> str:
    """Truncate text to maximum length."""
    if not text or len(text) <= max_length:
        return text
    return text[:max_length] + "..."
