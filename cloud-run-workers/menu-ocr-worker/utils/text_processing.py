"""Text processing utilities for menu extraction."""

import re
from typing import Optional


def normalize_language_code(language_code: Optional[str]) -> str:
    """Normalize language codes to standard format."""
    if not language_code:
        return "da"
    lc = language_code.strip()
    if not lc:
        return "da"
    low = lc.lower()
    if low == "da" or low.startswith("da-"):
        return "da"
    if low in ("en", "en-us", "en_us"):
        return "en-US"
    return lc


def tesseract_lang_for(language_code: str) -> str:
    """Get Tesseract language code from normalized language code."""
    if language_code == "da":
        return "dan"
    return "eng"


def compress_text_for_llm(text: str, max_chars: int) -> str:
    """Reduce boilerplate and keep menu-relevant lines for faster LLM parsing."""
    if not text:
        return ""
    if max_chars <= 0:
        return text

    lines = [ln.strip() for ln in text.splitlines()]
    lines = [ln for ln in lines if ln]
    if not lines:
        return text[:max_chars]

    price_re = re.compile(
        r"(\b\d{1,4}\s*(?:[\.,]\d{1,2})?\s*(?:kr\b|kroner\b|dkk\b)\b|"
        r"\b\d{1,4}\s*[-–—]?\s*[\.,]-\b|\b\d{1,4}\s*[\.,]-\b)",
        re.IGNORECASE
    )
    heading_re = re.compile(r"^[A-ZÆØÅ0-9][A-ZÆØÅ0-9\s\-–—:]{2,}$")

    keep: list[str] = []
    for ln in lines:
        if ln.startswith("-"):
            keep.append(ln)
            continue
        if price_re.search(ln):
            keep.append(ln)
            continue
        if heading_re.match(ln) and len(ln) <= 80:
            keep.append(ln)

    if len(keep) < 10:
        keep = lines[: min(len(lines), 120)]
    else:
        keep_with_context: list[str] = []
        line_set = set(keep)
        for i, ln in enumerate(lines):
            if ln in line_set:
                keep_with_context.append(ln)
                if i + 1 < len(lines) and lines[i + 1] not in line_set:
                    keep_with_context.append(lines[i + 1])
        keep = keep_with_context

    out = "\n".join(keep)
    if len(out) > max_chars:
        out = out[:max_chars]
    return out


def truncate_text(text: str, max_chars: int) -> str:
    """Truncate text to maximum character count."""
    if not text or max_chars <= 0:
        return text
    if len(text) <= max_chars:
        return text
    return text[:max_chars]


def clean_html_text_for_llm(text: str, max_chars: int) -> str:
    """Remove obvious website boilerplate while preserving menu-relevant lines."""
    if not text:
        return ""

    lines = [ln.strip() for ln in text.splitlines()]
    lines = [ln for ln in lines if ln]

    if not lines:
        return truncate_text(text, max_chars)

    price_re = re.compile(
        r"(\b\d{1,4}\s*(?:[\.,]\d{1,2})?\s*(?:kr\b|kroner\b|dkk\b)\b|"
        r"\b\d{1,4}\s*[-–—]?\s*[\.,]-\b|\b\d{1,4}\s*[\.,]-\b)",
        re.IGNORECASE
    )
    keep_always = lambda ln: ln.startswith("-") or bool(price_re.search(ln))

    drop_re = re.compile(
        r"(cookie|privacy|privatliv|persondata|gdpr|terms|vilkår|scroll to top|"
        r"link to|facebook|instagram|tiktok|youtube|newsletter|copyright|all rights reserved)",
        re.IGNORECASE,
    )

    cleaned: list[str] = []
    for ln in lines:
        if keep_always(ln):
            cleaned.append(ln)
            continue
        if drop_re.search(ln):
            continue
        if len(ln) <= 2:
            continue
        cleaned.append(ln)

    if len(cleaned) < 20:
        cleaned = lines

    out_lines: list[str] = []
    seen = set()
    for ln in cleaned:
        key = ln.lower()
        if key in seen:
            continue
        seen.add(key)
        out_lines.append(ln)

    out = "\n".join(out_lines)
    return truncate_text(out, max_chars)


def html_to_text(html: str) -> str:
    """Convert HTML to plain text while preserving structure."""
    html = re.sub(r"<\s*br\s*/?\s*>", "\n", html, flags=re.IGNORECASE)
    html = re.sub(r"</\s*(p|div|li|tr|h[1-6])\s*>", "\n", html, flags=re.IGNORECASE)
    html = re.sub(r"<\s*li\b[^>]*>", "- ", html, flags=re.IGNORECASE)

    text = re.sub(r"<script[^>]*>[\s\S]*?</script>", " ", html, flags=re.IGNORECASE)
    text = re.sub(r"<style[^>]*>[\s\S]*?</style>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<!--([\s\S]*?)-->", " ", text)
    text = re.sub(r"<[^>]+>", " ", text)

    text = (
        text.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
    )

    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\n\s+", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def find_pdf_links(html: str, base_url: str) -> list[str]:
    """Extract PDF links from HTML."""
    from urllib.parse import urljoin

    links = re.findall(r"href=[\"']([^\"']+\.pdf(?:\?[^\"']*)?)[\"']", html, flags=re.IGNORECASE)
    out: list[str] = []
    for href in links:
        out.append(urljoin(base_url, href))

    seen = set()
    deduped = []
    for u in out:
        if u in seen:
            continue
        seen.add(u)
        deduped.append(u)
    return deduped
