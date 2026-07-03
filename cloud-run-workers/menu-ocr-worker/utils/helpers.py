"""General helper utilities."""

from datetime import datetime


def utc_now_iso() -> str:
    """Get current UTC time in ISO format."""
    return datetime.utcnow().isoformat() + 'Z'


def looks_like_pdf(content: bytes) -> bool:
    """Check if content looks like a PDF."""
    return content.startswith(b"%PDF-")
