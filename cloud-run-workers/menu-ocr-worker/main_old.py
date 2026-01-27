"""Menu extraction worker.

Claims queued jobs from Supabase (`menu_results_v2`), fetches PDFs/HTML, performs staged text
extraction (digital text → Document AI OCR → Tesseract fallback), parses structured
menu JSON using OpenAI, and persists results back to Supabase.

This worker is designed to be cost-aware:
- Prefer cheap digital text extraction when possible.
- Only use Document AI when text density is low (scanned/complex PDFs).
"""

import os
import json
import time
import logging
import traceback
import threading
import hashlib
import base64
from typing import Optional, Dict, Any
from datetime import datetime

import fitz  # PyMuPDF
import pytesseract
from PIL import Image
import requests
from supabase import create_client, Client
from flask import Flask, jsonify, request

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Supabase client
def _clean_env_value(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    v = value.strip()
    # Common copy/paste mistake: include surrounding quotes in the env var value.
    if (len(v) >= 2) and ((v[0] == '"' and v[-1] == '"') or (v[0] == "'" and v[-1] == "'")):
        v = v[1:-1].strip()
    return v or None


SUPABASE_URL = _clean_env_value(os.getenv("SUPABASE_URL"))
SUPABASE_KEY = _clean_env_value(os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
SUPABASE_SERVICE_ROLE_KEY = SUPABASE_KEY
OPENAI_API_KEY = _clean_env_value(os.getenv("OPENAI_API_KEY"))

supabase: Client = None

# Optional: protect the /run-once trigger endpoint.
# If set, requests must include matching header: x-worker-token
WORKER_TRIGGER_TOKEN = os.getenv("WORKER_TRIGGER_TOKEN")

# If false, do not start the background polling thread; rely on /run-once (e.g.
# Cloud Scheduler OIDC) to drive processing.
_bg_poll_env = (os.getenv("WORKER_BACKGROUND_POLL_ENABLED") or "true").strip().lower()
WORKER_BACKGROUND_POLL_ENABLED = _bg_poll_env in ("1", "true", "yes")

# Optional: set this at deploy time (e.g. git SHA) to verify which revision is running.
WORKER_BUILD_ID = (os.getenv("WORKER_BUILD_ID") or "").strip()


def _mask_secret(value: Optional[str]) -> str:
    if not value:
        return "<missing>"
    value = value.strip()
    if not value:
        return "<missing>"
    if len(value) <= 10:
        return f"{value[:2]}…(len={len(value)})"
    return f"{value[:6]}…(len={len(value)})"


def _utc_now_iso() -> str:
    return datetime.utcnow().isoformat() + 'Z'

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

# OCR Corrections for Danish
DANISH_OCR_CORRECTIONS = {
    'abler': 'æbler',
    'ablekompot': 'æblekompot',
    'ablemost': 'æblemost',
    'zbler': 'æbler',
    'hvidlog': 'hvidløg',
    'hvidlgg': 'hvidløg',
    'smgr': 'smør',
    'smor': 'smør',
    'sennepsfro': 'sennepsfrø',
    'rode': 'røde',
    'gronne': 'grønne',
    'koldroget': 'koldrøget',
    'flode': 'fløde',
    'rodbede': 'rødbede',
    'radbede': 'rødbede',
    'croutons': 'crôutons',
    'crotitons': 'crôutons',
    'veloute': 'velouté',
    'creme brulee': 'crème brûlée',
    'a la carte': 'à la carte',
    # Add more as needed
}


def _normalize_language_code(language_code: Optional[str]) -> str:
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


def _tesseract_lang_for(language_code: str) -> str:
    # Keep this small for now (da + en-US). Extend later.
    if language_code == "da":
        return "dan"
    return "eng"


def _compress_text_for_llm(text: str, max_chars: int) -> str:
    """Reduce boilerplate and keep menu-relevant lines for faster LLM parsing.

    We still store the full raw text in the DB; this only affects what we send to the LLM.
    """
    if not text:
        return ""
    if max_chars <= 0:
        return text

    # Normalize to lines and keep structure
    lines = [ln.strip() for ln in text.splitlines()]
    lines = [ln for ln in lines if ln]
    if not lines:
        return text[:max_chars]

    import re

    price_re = re.compile(r"(\b\d{1,4}\s*(?:[\.,]\d{1,2})?\s*(?:kr\b|kroner\b|dkk\b)\b|\b\d{1,4}\s*[-–—]?\s*[\.,]-\b|\b\d{1,4}\s*[\.,]-\b)", re.IGNORECASE)
    heading_re = re.compile(r"^[A-ZÆØÅ0-9][A-ZÆØÅ0-9\s\-–—:]{2,}$")

    keep: list[str] = []
    # First pass: menu-salient lines
    for ln in lines:
        if ln.startswith("-"):
            keep.append(ln)
            continue
        if price_re.search(ln):
            keep.append(ln)
            continue
        if heading_re.match(ln) and len(ln) <= 80:
            keep.append(ln)

    # If we kept too little, include the beginning of the document (often contains menu)
    if len(keep) < 10:
        keep = lines[: min(len(lines), 120)]
    else:
        # Also include a bit of surrounding context near kept lines
        # (cheap heuristic: append next line after each kept line when available)
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


def _truncate_text(text: str, max_chars: int) -> str:
    if not text:
        return ""
    if max_chars <= 0:
        return text
    if len(text) <= max_chars:
        return text
    return text[:max_chars]


def _clean_html_text_for_llm(text: str, max_chars: int) -> str:
    """Remove obvious website boilerplate while preserving menu-relevant lines.

    This is a latency optimization (fewer tokens) without changing stored raw_text.
    """
    if not text:
        return ""

    import re

    lines = [ln.strip() for ln in text.splitlines()]
    lines = [ln for ln in lines if ln]

    if not lines:
        return _truncate_text(text, max_chars)

    # Keep menu-salient lines no matter what.
    price_re = re.compile(r"(\b\d{1,4}\s*(?:[\.,]\d{1,2})?\s*(?:kr\b|kroner\b|dkk\b)\b|\b\d{1,4}\s*[-–—]?\s*[\.,]-\b|\b\d{1,4}\s*[\.,]-\b)", re.IGNORECASE)
    keep_always = lambda ln: ln.startswith("-") or bool(price_re.search(ln))

    # Drop common nav/footer/cookie noise unless it contains pricing.
    drop_re = re.compile(
        r"(cookie|privacy|privatliv|persondata|gdpr|terms|vilkår|scroll to top|link to|facebook|instagram|tiktok|youtube|newsletter|copyright|all rights reserved)",
        re.IGNORECASE,
    )

    cleaned: list[str] = []
    for ln in lines:
        if keep_always(ln):
            cleaned.append(ln)
            continue
        if drop_re.search(ln):
            continue
        # Remove very short menu/navigation-only tokens
        if len(ln) <= 2:
            continue
        cleaned.append(ln)

    # If we removed too much, fall back to the original lines.
    if len(cleaned) < 20:
        cleaned = lines

    # Dedupe exact repeats (menus often duplicate headers)
    out_lines: list[str] = []
    seen = set()
    for ln in cleaned:
        key = ln.lower()
        if key in seen:
            continue
        seen.add(key)
        out_lines.append(ln)

    out = "\n".join(out_lines)
    return _truncate_text(out, max_chars)


def _storage_public_url(bucket: str, path: str) -> str:
    # Public bucket URL format
    base = (SUPABASE_URL or "").rstrip("/")
    return f"{base}/storage/v1/object/public/{bucket}/{path}"


def _storage_upload_public(bucket: str, path: str, content: bytes, content_type: str = "application/pdf") -> str:
    """Upload bytes to a public Supabase Storage bucket using the REST API.

    We do this via HTTP to avoid client-library drift across environments.
    """
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
    return _storage_public_url(bucket, path)


def _storage_upload_public_with_mime_fallback(
    bucket: str,
    path: str,
    content: bytes,
    primary_content_type: str,
    fallback_content_type: str,
) -> str:
    """Upload with a primary MIME type, falling back if the bucket rejects it.

    Some Supabase buckets enforce a restrictive allowed MIME allowlist.
    """
    try:
        return _storage_upload_public(bucket, path, content, content_type=primary_content_type)
    except RuntimeError as e:
        msg = str(e)
        if "invalid_mime_type" not in msg:
            raise
        logger.warning(
            f"Storage rejected MIME {primary_content_type} for {bucket}/{path}; "
            f"retrying with {fallback_content_type}"
        )
        return _storage_upload_public(bucket, path, content, content_type=fallback_content_type)


def _looks_like_pdf(content: bytes) -> bool:
    return content.startswith(b"%PDF-")


def _html_to_text(html: str) -> str:
    import re

    # Preserve structure for common block/list elements before stripping tags.
    # This materially improves menu parsing quality.
    html = re.sub(r"<\s*br\s*/?\s*>", "\n", html, flags=re.IGNORECASE)
    html = re.sub(r"</\s*(p|div|li|tr|h[1-6])\s*>", "\n", html, flags=re.IGNORECASE)
    html = re.sub(r"<\s*li\b[^>]*>", "- ", html, flags=re.IGNORECASE)

    # Remove script/style blocks
    text = re.sub(r"<script[^>]*>[\s\S]*?</script>", " ", html, flags=re.IGNORECASE)
    text = re.sub(r"<style[^>]*>[\s\S]*?</style>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<!--([\s\S]*?)-->", " ", text)
    # Strip tags
    text = re.sub(r"<[^>]+>", " ", text)
    # Decode a few common entities
    text = (
        text.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
    )
    # Normalize whitespace but keep newlines
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\n\s+", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = text.strip()
    return text


def _find_pdf_links(html: str, base_url: str) -> list[str]:
    """Very small heuristic: extract links ending with .pdf.

    This is not a crawler; it’s a pragmatic fallback for menu pages.
    """
    import re
    from urllib.parse import urljoin

    links = re.findall(r"href=[\"']([^\"']+\.pdf(?:\?[^\"']*)?)[\"']", html, flags=re.IGNORECASE)
    out: list[str] = []
    for href in links:
        out.append(urljoin(base_url, href))
    # Dedup while preserving order
    seen = set()
    deduped = []
    for u in out:
        if u in seen:
            continue
        seen.add(u)
        deduped.append(u)
    return deduped


def _is_docai_configured() -> bool:
    return bool(os.getenv("DOCAI_PROCESSOR_ID") and os.getenv("DOCAI_LOCATION") and os.getenv("GOOGLE_CLOUD_PROJECT"))


def _docai_extract_text(pdf_content: bytes, timeout_seconds: int) -> str:
    """Extract text via Google Document AI OCR.

    Requires env:
    - GOOGLE_CLOUD_PROJECT
    - DOCAI_LOCATION
    - DOCAI_PROCESSOR_ID
    """
    from google.cloud import documentai  # type: ignore

    project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
    location = os.getenv("DOCAI_LOCATION")
    processor_id = os.getenv("DOCAI_PROCESSOR_ID")

    client = documentai.DocumentProcessorServiceClient()
    name = client.processor_path(project_id, location, processor_id)

    raw_document = documentai.RawDocument(content=pdf_content, mime_type="application/pdf")
    request = documentai.ProcessRequest(name=name, raw_document=raw_document)
    # Hard timeout so a single job can't block the worker indefinitely.
    result = client.process_document(request=request, timeout=timeout_seconds)

    document = result.document
    full_text = document.text or ""

    def layout_to_text(layout) -> str:
        if not layout or not layout.text_anchor or not layout.text_anchor.text_segments:
            return ""
        pieces = []
        for seg in layout.text_anchor.text_segments:
            start = int(getattr(seg, "start_index", 0) or 0)
            end = int(seg.end_index)
            pieces.append(full_text[start:end])
        return "".join(pieces)

    # Reconstruct in page order using paragraph layouts (good enough for menus)
    pages_out = []
    for page in document.pages:
        para_texts = []
        for para in page.paragraphs:
            t = layout_to_text(para.layout).strip()
            if t:
                para_texts.append(t)
        pages_out.append("\n".join(para_texts))

    combined = "\n\n".join([p for p in pages_out if p.strip()]).strip()
    return combined


class MenuOCRWorker:
    def __init__(self):
        # Heuristics for "digital PDF" detection
        self.min_chars_per_page_for_digital = int(os.getenv("MIN_CHARS_PER_PAGE_FOR_DIGITAL", "250"))
        self.min_total_chars_for_digital = int(os.getenv("MIN_TOTAL_CHARS_FOR_DIGITAL", "800"))
        self.max_pages_to_process = int(os.getenv("MAX_PAGES_TO_PROCESS", "12"))
        self.use_docai_on_low_text = os.getenv("DOCAI_ENABLED", "true").lower() in ("1", "true", "yes")
        self.docai_timeout_seconds = int(os.getenv("DOCAI_TIMEOUT_SECONDS", "90"))
        self.fetch_timeout_seconds = int(os.getenv("FETCH_TIMEOUT_SECONDS", "25"))
        self.tesseract_zoom = float(os.getenv("TESSERACT_ZOOM", "1.5"))
        self.max_llm_chars = int(os.getenv("MAX_LLM_CHARS", "18000"))
        self.stale_job_minutes = int(os.getenv("STALE_JOB_MINUTES", "12"))
        self._last_stale_requeue_at = 0.0

        # Hard-PDF strategy: use GPT-5.2 vision on rendered pages instead of OCR.
        self.gpt52_vision_enabled = os.getenv("GPT52_VISION_ENABLED", "true").lower() in ("1", "true", "yes")
        self.gpt52_model = os.getenv("GPT52_MODEL", "gpt-5.2")
        self.gpt52_max_pages = int(os.getenv("GPT52_MAX_PAGES", "4"))
        self.gpt52_max_image_width = int(os.getenv("GPT52_MAX_IMAGE_WIDTH", "1400"))
        self.gpt52_timeout_seconds = int(os.getenv("GPT52_TIMEOUT_SECONDS", "120"))
        self._last_vision_error: Optional[str] = None

        # If true, we do NOT try DocAI/Tesseract for hard PDFs; we either succeed via GPT-5.2 or fail.
        self.hard_pdf_skip_ocr = os.getenv("HARD_PDF_SKIP_OCR", "true").lower() in ("1", "true", "yes")

    def _vision_error_is_auth(self) -> bool:
        msg = (self._last_vision_error or "").lower()
        return (
            "invalid_api_key" in msg
            or "incorrect api key" in msg
            or "authenticationerror" in msg
            or "error code: 401" in msg
        )

    def claim_next_job(self) -> Optional[Dict[str, Any]]:
        """Atomically claim the next queued job via Postgres RPC."""
        rpc_error: Optional[Exception] = None

        # Preferred path: use DB RPC (atomic + efficient)
        try:
            resp = supabase.rpc('claim_menu_result_v2', {}).execute()
            data = getattr(resp, 'data', None)
            if data:
                # Some clients return a dict, others a list
                if isinstance(data, list):
                    return data[0] if data else None
                if isinstance(data, dict):
                    return data if data.get('id') else None
            return None
        except Exception as e:
            rpc_error = e
            logger.error(
                "Failed to claim job via RPC claim_menu_result_v2: %s",
                str(e),
            )

        # Fallback path: claim via conditional update (works even if RPC perms drift)
        # This is safe with multiple workers because we only update rows still in status=queued.
        try:
            # Find oldest queued job
            resp = (
                supabase
                .table('menu_results_v2')
                .select('*')
                .eq('status', 'queued')
                .order('created_at', desc=False)
                .limit(1)
                .execute()
            )
            rows = getattr(resp, 'data', None) or []
            if not rows:
                return None

            candidate = rows[0]
            result_id = candidate.get('id')
            if not result_id:
                return None

            claimed_payload: Dict[str, Any] = {
                'status': 'processing',
                'claimed_at': _utc_now_iso(),
            }
            # Best-effort increment attempts if present
            try:
                attempts = int(candidate.get('attempts') or 0)
                claimed_payload['attempts'] = attempts + 1
            except Exception:
                pass

            upd = (
                supabase
                .table('menu_results_v2')
                .update(claimed_payload)
                .eq('id', result_id)
                .eq('status', 'queued')
                .execute()
            )
            updated_rows = getattr(upd, 'data', None) or []
            if updated_rows:
                logger.warning(
                    "Claimed job via fallback (RPC failed): id=%s rpc_err=%s",
                    str(result_id),
                    str(rpc_error) if rpc_error else "<none>",
                )
                return updated_rows[0]

            # Another worker likely grabbed it.
            return None
        except Exception as e:
            logger.error(
                "Fallback claim failed after RPC error (%s): %s",
                str(rpc_error) if rpc_error else "<none>",
                str(e),
            )
            return None

    def _requeue_stale_jobs(self) -> None:
        """Requeue jobs stuck in processing beyond the configured threshold.

        Preferred path uses the DB RPC. Fallback uses a conditional update.
        """
        # Preferred RPC
        try:
            resp = supabase.rpc('requeue_stale_menu_results_v2', {
                'max_age_minutes': self.stale_job_minutes
            }).execute()
            requeued = getattr(resp, 'data', None)
            if isinstance(requeued, int) and requeued > 0:
                logger.warning(f"Requeued {requeued} stale menu_results_v2 job(s)")
            return
        except Exception as e:
            logger.error(f"Failed to requeue stale jobs via RPC: {str(e)}")

        # Fallback: directly update stale rows
        try:
            threshold_dt = datetime.utcnow().timestamp() - (self.stale_job_minutes * 60)
            threshold_iso = datetime.utcfromtimestamp(threshold_dt).isoformat() + 'Z'
            upd = (
                supabase
                .table('menu_results_v2')
                .update({'status': 'queued', 'claimed_at': None})
                .eq('status', 'processing')
                .lt('claimed_at', threshold_iso)
                .execute()
            )
            updated_rows = getattr(upd, 'data', None) or []
            if updated_rows:
                logger.warning(f"Requeued {len(updated_rows)} stale job(s) via fallback")
        except Exception as e:
            logger.error(f"Fallback stale requeue failed: {str(e)}")

    def _fetch_url(self, url: str) -> tuple[bytes, str]:
        resp = requests.get(url, timeout=self.fetch_timeout_seconds, headers={
            "User-Agent": "Mozilla/5.0 (compatible; MenuBot/1.0)"
        })
        resp.raise_for_status()
        content_type = (resp.headers.get('Content-Type') or '').split(';')[0].strip().lower()
        return resp.content, content_type

    def _extract_text_digital(self, pdf_content: bytes) -> tuple[str, Dict[str, Any]]:
        metrics: Dict[str, Any] = {
            'total_pages': 0,
            'char_count': 0,
            'method': 'pymupdf',
        }

        doc = fitz.open(stream=pdf_content, filetype="pdf")
        total_pages = min(len(doc), self.max_pages_to_process)
        metrics['total_pages'] = total_pages

        pages = []
        per_page_counts = []
        for i in range(total_pages):
            page = doc[i]
            # "text" tends to be better than "blocks" for preserving line breaks
            t = page.get_text("text")
            t = (t or "").strip()
            pages.append(t)
            per_page_counts.append(len(t))

        combined = "\n\n".join([p for p in pages if p]).strip()
        metrics['char_count'] = len(combined)
        metrics['chars_per_page'] = (sum(per_page_counts) / total_pages) if total_pages else 0
        metrics['per_page_chars'] = per_page_counts
        return combined, metrics
        
    def extract_text_with_tesseract(self, pdf_content: bytes, language_code: str) -> tuple[str, Dict[str, Any]]:
        """
        Extract text from PDF using PyMuPDF rendering + Tesseract OCR.
        Returns: (raw_text, metrics)
        """
        metrics = {
            'total_pages': 0,
            'avg_confidence': 0.0,
            'char_count': 0,
            'garbled_words': 0,
            'method': 'tesseract',
        }
        
        try:
            doc = fitz.open(stream=pdf_content, filetype="pdf")
            metrics['total_pages'] = min(len(doc), self.max_pages_to_process)
            
            all_text = []
            confidences = []
            
            tess_lang = _tesseract_lang_for(language_code)

            for page_num in range(metrics['total_pages']):
                page = doc[page_num]
                
                # Try to extract text directly first (for digital PDFs)
                text = page.get_text()
                
                # If very little text, render to image and OCR
                if len((text or '').strip()) < 50:
                    # Convert page to image and OCR
                    # Default 1.5x for speed; can be tuned via TESSERACT_ZOOM
                    pix = page.get_pixmap(matrix=fitz.Matrix(self.tesseract_zoom, self.tesseract_zoom))
                    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    
                    # Tesseract OCR with language config
                    data = pytesseract.image_to_data(img, lang=tess_lang, output_type=pytesseract.Output.DICT)
                    text = '\n'.join(data['text'])
                    
                    # Calculate confidence for this page
                    confidences_page = [int(conf) for conf in data['conf'] if int(conf) > 0]
                    if confidences_page:
                        confidences.extend(confidences_page)
                
                all_text.append(text)
            
            raw_text = '\n'.join(all_text)
            
            # Calculate metrics
            metrics['char_count'] = len(raw_text)
            if confidences:
                metrics['avg_confidence'] = sum(confidences) / len(confidences)
            
            # Count garbled words (simple heuristic: 2+ consecutive non-letter symbols)
            import re
            special_patterns = re.findall(r"[^a-zæøåA-ZÆØÅ\s\-']{2,}", raw_text)
            metrics['garbled_words'] = len(special_patterns)
            
            logger.info(f"Extracted {metrics['char_count']} chars, "
                       f"confidence: {metrics['avg_confidence']:.1f}%, "
                       f"garbled: {metrics['garbled_words']}")
            
            return raw_text, metrics
            
        except Exception as e:
            logger.error(f"Error extracting PDF: {str(e)}")
            raise
    
    def apply_ocr_corrections(self, text: str) -> str:
        """Apply Danish OCR corrections to text."""
        corrected = text
        
        # Sort by length (longest first) for specificity
        for wrong, right in sorted(DANISH_OCR_CORRECTIONS.items(), 
                                   key=lambda x: len(x[0]), reverse=True):
            # Case-insensitive replacement with word boundaries where appropriate
            corrected = corrected.replace(wrong, right)
        
        return corrected

    def parse_menu_with_llm(self, text: str, language_code: str, model: str) -> Optional[Dict[str, Any]]:
        """Parse menu text into structured JSON using an LLM."""
        try:
            from openai import OpenAI

            client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

            if language_code == "da":
                system_prompt = """You are a precise Danish restaurant menu extraction expert.

Return ONLY valid JSON (no markdown, no explanation) with this structure:
{
  "summary": "short menu summary in Danish",
  "categories": [
    {
      "name": "Category name",
      "items": [
        {
          "name": "Item name",
          "description": "Description or null",
          "price": 145.0,
          "currency": "DKK"
        }
      ]
    }
  ]
}

Rules:
- Preserve Danish characters (æ, ø, å) exactly as written.
- Do not invent items. Only extract what is explicitly present.
- Keep multi-line item descriptions grouped with the item name.
- Extract numeric prices when present. If missing, set price null.

Splitting:
- If a dish (e.g. a platter/menu) lists many components separated by commas/newlines (like "2 slags sild..., røget laks..., æg og rejer...") then create one item per component instead of one huge description.
- For headings like "Juleplatte" you may use it as a category name, and put the components as items.

Price parsing (DKK):
- Parse common Danish formats: "20.-", "20,-", "20 kr", "20 kroner", "DKK 20".
- If currency is not shown but the restaurant is Danish, set currency to "DKK" when a price exists.
"""
            else:
                system_prompt = """You are a precise restaurant menu extraction expert (English).

Return ONLY valid JSON (no markdown, no explanation) with this structure:
{
  "summary": "short menu summary in English",
  "categories": [
    {
      "name": "Category name",
      "items": [
        {
          "name": "Item name",
          "description": "Description or null",
          "price": 12.5,
          "currency": "USD"
        }
      ]
    }
  ]
}

Rules:
- Do not invent items. Only extract what is explicitly present.
- Keep multi-line item descriptions grouped with the item name.
- Extract numeric prices when present. If missing, set price null.

Splitting:
- If an item contains a long comma-separated list of components, create one item per component instead of one huge description.
"""

            llm_start = time.time()
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Parse this menu:\n\n{text}"},
                ],
                # Ask the API to enforce JSON so we avoid parse errors/retries.
                response_format={"type": "json_object"},
                temperature=0.0,
                max_tokens=1400 if model == "gpt-4o-mini" else 2000,
            )

            logger.info(
                f"LLM {model} finished in {int((time.time() - llm_start) * 1000)}ms; input_chars={len(text)}"
            )

            result_text = response.choices[0].message.content.strip()

            # Handle markdown code blocks defensively
            if result_text.startswith("```json"):
                result_text = result_text[7:]
            if result_text.startswith("```"):
                result_text = result_text[3:]
            if result_text.endswith("```"):
                result_text = result_text[:-3]

            structured = json.loads(result_text)
            logger.info(f"Parsed {len(structured.get('categories', []))} menu categories using {model}")
            return structured

        except Exception as e:
            logger.error(f"Error parsing menu with LLM: {str(e)}")
            return None

    def _validate_structured_menu(self, structured: Optional[Dict[str, Any]]) -> bool:
        if not structured or not isinstance(structured, dict):
            return False
        categories = structured.get('categories')
        if not isinstance(categories, list) or len(categories) == 0:
            return False
        total_items = 0
        for cat in categories:
            items = (cat or {}).get('items')
            if isinstance(items, list):
                total_items += len(items)
        return total_items > 0

    def extract_text_staged(self, pdf_content: bytes, language_code: str) -> tuple[str, Dict[str, Any]]:
        """Staged text extraction to control cost and improve robustness."""
        digital_text, digital_metrics = self._extract_text_digital(pdf_content)
        total_chars = digital_metrics.get('char_count', 0) or 0
        chars_per_page = digital_metrics.get('chars_per_page', 0) or 0

        # Digital path (cheap)
        if total_chars >= self.min_total_chars_for_digital and chars_per_page >= self.min_chars_per_page_for_digital:
            return digital_text, digital_metrics

        # If the PDF looks like an image/scanned menu, prefer GPT-5.2 vision over OCR (configurable).
        if self.gpt52_vision_enabled and self.hard_pdf_skip_ocr:
            raise RuntimeError("HARD_PDF_REQUIRES_GPT52_VISION")

        # Document AI path (robust, cost-aware)
        if self.use_docai_on_low_text and _is_docai_configured():
            try:
                logger.info("Using Document AI OCR (low text density detected)")
                docai_text = _docai_extract_text(pdf_content, timeout_seconds=self.docai_timeout_seconds)
                if len(docai_text.strip()) >= 200:
                    return docai_text, {
                        'total_pages': digital_metrics.get('total_pages', 0),
                        'char_count': len(docai_text),
                        'method': 'docai',
                    }
            except Exception as e:
                logger.error(f"Document AI OCR failed, falling back to Tesseract: {str(e)}")

        # Tesseract fallback (works without GCP setup, but lower quality)
        return self.extract_text_with_tesseract(pdf_content, language_code)

    def _render_pdf_pages_to_pngs(self, pdf_content: bytes) -> list[bytes]:
        """Render first N pages of a PDF to PNG images for vision models."""
        doc = fitz.open(stream=pdf_content, filetype="pdf")
        page_count = min(len(doc), max(1, self.gpt52_max_pages))
        out: list[bytes] = []

        for i in range(page_count):
            page = doc[i]
            rect = page.rect
            base_width = float(rect.width or 1.0)
            # Scale such that width ~= gpt52_max_image_width (cap at 3x zoom to avoid huge images).
            zoom = min(3.0, max(1.0, self.gpt52_max_image_width / base_width))
            pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
            out.append(pix.tobytes("png"))

        return out

    def _parse_menu_from_images_with_gpt52(self, images_png: list[bytes], language_code: str) -> tuple[Optional[str], Optional[Dict[str, Any]]]:
        """Use GPT-5.2 vision to extract readable text + structured menu JSON from images."""
        try:
            from openai import OpenAI

            self._last_vision_error = None
            client = OpenAI(api_key=OPENAI_API_KEY)

            if language_code == "da":
                system_prompt = (
                    "You extract Danish restaurant menus from images. "
                    "Return ONLY valid JSON (no markdown).\n\n"
                    "Schema:\n"
                    "{\n"
                    "  \"extracted_text\": \"string\",\n"
                    "  \"menu\": {\n"
                    "    \"summary\": \"short menu summary in Danish\",\n"
                    "    \"categories\": [\n"
                    "      {\n"
                    "        \"name\": \"Category name\",\n"
                    "        \"items\": [\n"
                    "          {\n"
                    "            \"name\": \"Item name\",\n"
                    "            \"description\": \"Description or null\",\n"
                    "            \"price\": 145.0,\n"
                    "            \"currency\": \"DKK\"\n"
                    "          }\n"
                    "        ]\n"
                    "      }\n"
                    "    ]\n"
                    "  }\n"
                    "}\n\n"
                    "Rules:\n"
                    "- Preserve Danish characters (æ, ø, å).\n"
                    "- Do not invent items.\n"
                    "- Parse prices if shown (20.-, 20,-, 20 kr). If missing, set price null.\n"
                    "- If currency not shown but price exists, use DKK."
                )
            else:
                system_prompt = (
                    "You extract restaurant menus from images. "
                    "Return ONLY valid JSON (no markdown).\n\n"
                    "Schema:\n"
                    "{\n"
                    "  \"extracted_text\": \"string\",\n"
                    "  \"menu\": {\n"
                    "    \"summary\": \"short menu summary in English\",\n"
                    "    \"categories\": [ ... ]\n"
                    "  }\n"
                    "}\n\n"
                    "Rules:\n"
                    "- Do not invent items.\n"
                    "- Extract numeric prices when present, else null."
                )

            content_parts: list[Dict[str, Any]] = [
                {"type": "text", "text": "Extract the menu from these images."}
            ]
            for img in images_png:
                b64 = base64.b64encode(img).decode("utf-8")
                content_parts.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{b64}"},
                })

            llm_start = time.time()
            try:
                # gpt-5.2 expects max_completion_tokens. Some other models/SDK combos
                # accept only max_tokens. We'll try the preferred parameter first,
                # then fall back.
                response = client.chat.completions.create(
                    model=self.gpt52_model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": content_parts},
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.0,
                    max_completion_tokens=2200,
                )
            except TypeError as e:
                # Older OpenAI SDKs don't accept max_completion_tokens.
                msg = str(e)
                if "max_completion_tokens" not in msg:
                    raise

                response = client.chat.completions.create(
                    model=self.gpt52_model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": content_parts},
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.0,
                    max_tokens=2200,
                )
            except Exception as e:
                # Some API/model combos reject max_tokens and require max_completion_tokens.
                msg = str(e)
                if "max_tokens" in msg and "max_completion_tokens" in msg:
                    response = client.chat.completions.create(
                        model=self.gpt52_model,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": content_parts},
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.0,
                        max_tokens=2200,
                    )
                else:
                    raise
            logger.info(
                "GPT-5.2 vision finished in %dms; pages=%d",
                int((time.time() - llm_start) * 1000),
                len(images_png),
            )

            result_text = response.choices[0].message.content.strip()
            payload = json.loads(result_text)
            extracted_text = payload.get("extracted_text")
            menu = payload.get("menu")
            if isinstance(extracted_text, str) and isinstance(menu, dict):
                return extracted_text, menu
            return None, None
        except Exception as e:
            self._last_vision_error = str(e)
            logger.error("GPT-5.2 vision parse failed: %s", str(e), exc_info=True)
            return None, None
    
    def process_job(self, job: Dict[str, Any]) -> bool:
        try:
            result_id = job.get('id')
            business_id = job.get('business_id')
            pdf_url = job.get('source_url') or job.get('pdf_url')
            pdf_bucket = job.get('storage_bucket') or job.get('pdf_bucket')
            pdf_path = job.get('storage_path') or job.get('pdf_path')
            language_code = _normalize_language_code(job.get('language_code'))

            if not result_id or not business_id:
                raise ValueError("Invalid job payload (missing id/business_id)")

            if not pdf_url and not (pdf_bucket and pdf_path):
                raise ValueError("Invalid job payload (missing pdf_url or storage reference)")

            logger.info(f"Processing job {result_id} (lang={language_code})")

            # Prefer public URL if present, otherwise compute from storage reference
            if not pdf_url and pdf_bucket and pdf_path:
                pdf_url = _storage_public_url(pdf_bucket, pdf_path)

            start_time = time.time()

            # Fetch URL bytes (PDF or HTML)
            content_bytes, content_type = self._fetch_url(pdf_url)

            # If it’s HTML, try to discover a PDF link first (common on restaurant sites)
            if content_type == 'text/html' and not _looks_like_pdf(content_bytes):
                html = content_bytes.decode('utf-8', errors='ignore')
                pdf_links = _find_pdf_links(html, pdf_url)
                if pdf_links:
                    logger.info(f"Found {len(pdf_links)} PDF link(s) on page; using first: {pdf_links[0]}")
                    pdf_url = pdf_links[0]
                    content_bytes, content_type = self._fetch_url(pdf_url)

            is_pdf = _looks_like_pdf(content_bytes) or content_type == 'application/pdf' or (pdf_url.lower().split('?')[0].endswith('.pdf'))

            # Persist source content (menus must be saved)
            source_sha = hashlib.sha256(content_bytes).hexdigest()

            if is_pdf:
                # Store PDF if not already stored
                if not pdf_path:
                    storage_path = f"{business_id}/menu/{source_sha}.pdf"
                    public_url = _storage_upload_public("business-documents", storage_path, content_bytes, content_type="application/pdf")
                    pdf_bucket = "business-documents"
                    pdf_path = storage_path
                else:
                    public_url = _storage_public_url(pdf_bucket, pdf_path)

                # Extract text (digital first, then either OCR or GPT-5.2 vision depending on hardness)
                try:
                    extracted_text, metrics = self.extract_text_staged(content_bytes, language_code)
                    raw_text = extracted_text
                    if language_code == "da":
                        raw_text = self.apply_ocr_corrections(raw_text)
                except RuntimeError as e:
                    if str(e) != "HARD_PDF_REQUIRES_GPT52_VISION":
                        raise

                    logger.info("Hard PDF detected (low digital text). Using GPT-5.2 vision.")
                    images = self._render_pdf_pages_to_pngs(content_bytes)
                    vision_text, vision_menu = self._parse_menu_from_images_with_gpt52(images, language_code)

                    if not vision_menu or not self._validate_structured_menu(vision_menu):
                        if self._vision_error_is_auth():
                            user_reason = (
                                "Menu extraction is temporarily unavailable due to a server configuration issue. "
                                "Please try again later."
                            )
                        else:
                            user_reason = (
                                "We couldn’t reliably read this menu. "
                                "The PDF appears to be a low-quality scan or uses styling/layout that prevents accurate extraction. "
                                "Please provide a clearer PDF link (higher contrast / less compression)."
                            )
                        supabase.table('menu_results_v2').update({
                            'status': 'error',
                            'error_message': user_reason,
                            # Persist whatever text we got back from vision to help debugging.
                            # (Even when the structured menu validation fails.)
                            'raw_text': (vision_text or None),
                            'extraction_method': 'gpt-5.2-vision',
                            'completed_at': _utc_now_iso(),
                            'storage_bucket': pdf_bucket,
                            'storage_path': pdf_path,
                            'source_url': pdf_url,
                            'source_content_type': content_type,
                            'language_code': language_code,
                            'sha256': source_sha,
                        }).eq('id', result_id).execute()
                        return False

                    raw_text = (vision_text or "").strip() or "(extracted via vision)"
                    metrics = {
                        'total_pages': min(len(images), self.gpt52_max_pages),
                        'char_count': len(raw_text),
                        'method': 'gpt-5.2-vision',
                    }
                    structured_data = vision_menu
                    if isinstance(structured_data, dict):
                        meta = structured_data.get('_meta')
                        if not isinstance(meta, dict):
                            meta = {}
                        meta.update({
                            'source': 'gpt-5.2-vision',
                            'notes': 'Extracted from rendered PDF images (scan/low digital text).',
                        })
                        structured_data['_meta'] = meta
            else:
                # HTML menu page: snapshot it and extract readable text
                html = content_bytes.decode('utf-8', errors='ignore')
                snapshot_path = f"{business_id}/menu_snapshots/{source_sha}.html"
                public_url = _storage_upload_public_with_mime_fallback(
                    "business-documents",
                    snapshot_path,
                    content_bytes,
                    primary_content_type="text/html",
                    # Many setups allow only PDFs in this bucket; fall back to PDF MIME
                    # if HTML MIME is blocked, so extraction can still complete.
                    fallback_content_type="application/pdf",
                )
                pdf_bucket = "business-documents"
                pdf_path = snapshot_path

                raw_text = _html_to_text(html)
                metrics = {
                    'total_pages': 1,
                    'char_count': len(raw_text),
                    'method': 'html',
                }

            # Parse with LLM (cost-aware model escalation)
            # IMPORTANT: For HTML pages, the "menu" is often a long line without prices/bullets.
            # Our aggressive compression can accidentally drop the actual items. So:
            # - HTML: pass through (truncated)
            # - PDF/OCR: compress (faster + cheaper)
            method = (metrics or {}).get('method')
            if method == 'html':
                # Keep content but drop boilerplate; big latency win on web pages.
                llm_text = _clean_html_text_for_llm(raw_text, max_chars=self.max_llm_chars)
            else:
                llm_text = _compress_text_for_llm(raw_text, max_chars=self.max_llm_chars)

            # If we already produced structured_data via vision, keep it.
            if 'structured_data' not in locals() or structured_data is None:
                structured_data = self.parse_menu_with_llm(llm_text, language_code, model="gpt-4o-mini")
                if not self._validate_structured_menu(structured_data):
                    logger.info("Low/empty parse result, retrying with gpt-4o")
                    structured_data = self.parse_menu_with_llm(llm_text, language_code, model="gpt-4o")

                # If text extraction succeeded but parsing still failed, fall back to GPT-5.2 vision for PDFs.
                # This matches the real-world case where LLMs can read the visual layout even when extracted text
                # is incomplete/garbled (multi-column, decorative fonts, embedded text as glyphs, etc.).
                if (
                    is_pdf
                    and self.gpt52_vision_enabled
                    and not self._validate_structured_menu(structured_data)
                ):
                    logger.info("Text parse failed for PDF; falling back to GPT-5.2 vision")
                    images = self._render_pdf_pages_to_pngs(content_bytes)
                    vision_text, vision_menu = self._parse_menu_from_images_with_gpt52(images, language_code)

                    if vision_menu and self._validate_structured_menu(vision_menu):
                        raw_text = (vision_text or "").strip() or raw_text
                        metrics = {
                            'total_pages': min(len(images), self.gpt52_max_pages),
                            'char_count': len(raw_text or ""),
                            'method': 'gpt-5.2-vision',
                        }
                        structured_data = vision_menu
                        if isinstance(structured_data, dict):
                            meta = structured_data.get('_meta')
                            if not isinstance(meta, dict):
                                meta = {}
                            meta.update({
                                'source': 'gpt-5.2-vision',
                                'notes': 'Fallback: extracted from rendered PDF images because text parsing was unreliable.',
                            })
                            structured_data['_meta'] = meta
                    else:
                        logger.warning("GPT-5.2 vision fallback did not produce a valid menu")

            processing_time_ms = int((time.time() - start_time) * 1000)

            # Persist structured result into business_documents (canonical for downstream AI)
            try:
                file_name = f"{source_sha}.pdf" if is_pdf else f"{source_sha}.html"
                supabase.table('business_documents').upsert({
                    'business_id': business_id,
                    'document_type': 'menu',
                    'file_name': file_name,
                    'storage_path': pdf_path,
                    'public_url': public_url,
                    'extracted_text': raw_text,
                    'extracted_json': structured_data,
                    'file_size': len(content_bytes),
                    'updated_at': datetime.utcnow().isoformat() + 'Z',
                }, on_conflict='storage_path').execute()
            except Exception as e:
                logger.error(f"Failed to upsert business_documents: {str(e)}")

            # Update v2 job row
            supabase.table('menu_results_v2').update({
                'status': 'done',
                'raw_text': raw_text,
                'structured_data': structured_data,
                'extraction_method': metrics.get('method', None),
                'sha256': source_sha,
                'completed_at': datetime.utcnow().isoformat() + 'Z',
                'storage_bucket': pdf_bucket,
                'storage_path': pdf_path,
                'source_url': pdf_url,
                'source_content_type': content_type,
                'language_code': language_code,
            }).eq('id', result_id).execute()
            
            return True
            
        except Exception as e:
            logger.error(f"Error processing job: {str(e)}\n{traceback.format_exc()}")
            
            # Update with error status
            if 'result_id' in locals():
                update_payload: Dict[str, Any] = {
                    'status': 'error',
                    'error_message': str(e),
                    'completed_at': _utc_now_iso(),
                }
                try:
                    if 'metrics' in locals() and isinstance(metrics, dict):
                        update_payload['extraction_method'] = metrics.get('method')
                except Exception:
                    pass
                supabase.table('menu_results_v2').update(update_payload).eq('id', result_id).execute()
            
            return False
    
    def run(self):
        """Main worker loop - continuously poll queue for jobs."""
        logger.info("Menu OCR Worker starting...")
        
        # Ensure Supabase client is available
        if not supabase:
            logger.error("❌ Supabase client not initialized - cannot process jobs")
            return
        
        while True:
            try:
                # Periodically requeue stale processing jobs (e.g. worker crash mid-job).
                now_s = time.time()
                if now_s - self._last_stale_requeue_at > 60:
                    self._requeue_stale_jobs()
                    self._last_stale_requeue_at = now_s

                job = self.claim_next_job()

                if not job:
                    time.sleep(2)
                    continue

                self.process_job(job)
                
            except Exception as e:
                logger.error(f"Worker error: {str(e)}\n{traceback.format_exc()}")
                time.sleep(5)


if __name__ == "__main__":
    # Initialize worker (but don't run it yet)
    try:
        worker = MenuOCRWorker()
        # Expose for Flask routes below
        worker_instance = worker

        if WORKER_BACKGROUND_POLL_ENABLED:
            # Start worker in background thread (daemon=True so it doesn't block shutdown)
            worker_thread = threading.Thread(target=worker.run, daemon=True)
            worker_thread.start()
            logger.info("Worker thread started")
        else:
            logger.info("Worker background polling disabled; awaiting /run-once triggers")

        if WORKER_BUILD_ID:
            logger.info("Worker build id: %s", WORKER_BUILD_ID)
    except Exception as e:
        logger.error(f"Failed to start worker thread: {str(e)}\n{traceback.format_exc()}")
        # Continue anyway - Flask app should still start for health checks
    
    # Start Flask app for health checks
    try:
        app = Flask(__name__)

        def _authorized_worker_trigger(req) -> bool:
            # If no token configured, allow (keeps local/dev simple).
            if not WORKER_TRIGGER_TOKEN:
                return True
            provided = req.headers.get('x-worker-token') or req.headers.get('X-Worker-Token')
            return bool(provided) and provided == WORKER_TRIGGER_TOKEN

        @app.route('/run-once', methods=['POST'])
        def run_once():
            if not _authorized_worker_trigger(request):
                return jsonify({"error": "unauthorized"}), 401

            if not supabase:
                return jsonify({"error": "supabase_not_initialized"}), 500

            # Ensure we have a worker instance even if thread startup failed.
            w = globals().get('worker_instance')
            if not w:
                try:
                    w = MenuOCRWorker()
                    globals()['worker_instance'] = w
                except Exception as e:
                    return jsonify({"error": f"failed_to_init_worker: {str(e)}"}), 500

            # In Scheduler-only mode, this is our main heartbeat, so also requeue
            # stale jobs before claiming.
            try:
                w._requeue_stale_jobs()
            except Exception as e:
                logger.warning("Stale requeue failed in /run-once: %s", str(e))

            job = w.claim_next_job()
            if not job:
                return jsonify({"claimed": False}), 200

            ok = w.process_job(job)
            return jsonify({
                "claimed": True,
                "processed": bool(ok),
                "job_id": job.get('id'),
            }), 200
        
        @app.route('/health', methods=['GET'])
        def health():
            return jsonify({
                "status": "healthy",
                "build_id": WORKER_BUILD_ID or None,
                "supabase_initialized": bool(supabase),
                "supabase_url_set": bool(SUPABASE_URL),
                "supabase_service_role_key_set": bool(SUPABASE_SERVICE_ROLE_KEY),
                "openai_api_key_set": bool(OPENAI_API_KEY),
            }), 200
        
        @app.route('/', methods=['GET'])
        def index():
            return jsonify({"service": "menu-ocr-worker", "status": "running"}), 200
        
        port = int(os.getenv("PORT", 8080))
        logger.info(f"Starting HTTP server on port {port}")
        app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
    except Exception as e:
        logger.error(f"Failed to start Flask app: {str(e)}\n{traceback.format_exc()}")
        raise
