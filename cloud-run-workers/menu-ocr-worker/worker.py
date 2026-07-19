"""Menu extraction worker class."""

import time
import hashlib
import logging
import traceback
import requests
from typing import Optional, Dict, Any
from datetime import datetime

from config import (
    supabase,
    FETCH_TIMEOUT_SECONDS,
    MAX_LLM_CHARS,
    STALE_JOB_MINUTES,
    GPT52_VISION_ENABLED,
    GPT52_MODEL,
)
from utils.helpers import utc_now_iso, looks_like_pdf
from utils.text_processing import (
    normalize_language_code,
    compress_text_for_llm,
    clean_html_text_for_llm,
    html_to_text,
    find_pdf_links,
)
from utils.corrections import apply_ocr_corrections
from utils.storage import (
    storage_public_url,
    storage_upload_public,
    storage_upload_public_with_mime_fallback,
)
from extractors.pdf_extractor import extract_text_staged
from extractors.vision_extractor import extract_with_vision
from extractors.browser_extractor import extract_with_browser, is_html_empty_or_minimal
from parsers.menu_parser import parse_menu_with_llm, validate_structured_menu

logger = logging.getLogger(__name__)


class MenuOCRWorker:
    """Worker that processes menu extraction jobs from Supabase queue."""
    
    def __init__(self):
        self._last_stale_requeue_at = 0.0
        self._last_vision_error: Optional[str] = None

    def _vision_error_is_auth(self) -> bool:
        """Check if last vision error was authentication-related."""
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

        try:
            resp = supabase.rpc('claim_menu_result_v2', {}).execute()
            data = getattr(resp, 'data', None)
            if data:
                if isinstance(data, list):
                    return data[0] if data else None
                if isinstance(data, dict):
                    return data if data.get('id') else None
            return None
        except Exception as e:
            rpc_error = e
            logger.error("Failed to claim job via RPC claim_menu_result_v2: %s", str(e))

        # Fallback: claim via conditional update
        try:
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
                'claimed_at': utc_now_iso(),
            }
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

            return None
        except Exception as e:
            logger.error(
                "Fallback claim failed after RPC error (%s): %s",
                str(rpc_error) if rpc_error else "<none>",
                str(e),
            )
            return None

    def _requeue_stale_jobs(self) -> None:
        """Requeue jobs stuck in processing beyond threshold."""
        try:
            resp = supabase.rpc('requeue_stale_menu_results_v2', {
                'max_age_minutes': STALE_JOB_MINUTES
            }).execute()
            requeued = getattr(resp, 'data', None)
            if isinstance(requeued, int) and requeued > 0:
                logger.warning(f"Requeued {requeued} stale menu_results_v2 job(s)")
            return
        except Exception as e:
            logger.error(f"Failed to requeue stale jobs via RPC: {str(e)}")

        try:
            threshold_dt = datetime.utcnow().timestamp() - (STALE_JOB_MINUTES * 60)
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
        """Fetch URL and return content bytes and content type."""
        resp = requests.get(url, timeout=FETCH_TIMEOUT_SECONDS, headers={
            "User-Agent": "Mozilla/5.0 (compatible; MenuBot/1.0)"
        })
        resp.raise_for_status()
        content_type = (resp.headers.get('Content-Type') or '').split(';')[0].strip().lower()
        return resp.content, content_type

    def process_job(self, job: Dict[str, Any]) -> bool:
        """Process a single menu extraction job."""
        try:
            result_id = job.get('id')
            business_id = job.get('business_id')
            pdf_url = job.get('source_url') or job.get('pdf_url')
            pdf_bucket = job.get('storage_bucket') or job.get('pdf_bucket')
            pdf_path = job.get('storage_path') or job.get('pdf_path')
            language_code = normalize_language_code(job.get('language_code'))

            if not result_id or not business_id:
                raise ValueError("Invalid job payload (missing id/business_id)")

            if not pdf_url and not (pdf_bucket and pdf_path):
                raise ValueError("Invalid job payload (missing pdf_url or storage reference)")

            logger.info(f"Processing job {result_id} (lang={language_code})")

            if not pdf_url and pdf_bucket and pdf_path:
                pdf_url = storage_public_url(pdf_bucket, pdf_path)

            start_time = time.time()

            # Fetch content
            content_bytes, content_type = self._fetch_url(pdf_url)

            # If HTML, try to find PDF link
            if content_type == 'text/html' and not looks_like_pdf(content_bytes):
                html = content_bytes.decode('utf-8', errors='ignore')
                pdf_links = find_pdf_links(html, pdf_url)
                if pdf_links:
                    logger.info(f"Found {len(pdf_links)} PDF link(s) on page; using first: {pdf_links[0]}")
                    pdf_url = pdf_links[0]
                    content_bytes, content_type = self._fetch_url(pdf_url)

            is_pdf = looks_like_pdf(content_bytes) or content_type == 'application/pdf' or (pdf_url.lower().split('?')[0].endswith('.pdf'))
            is_image = content_type.startswith('image/') or any(pdf_url.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.webp'])
            source_sha = hashlib.sha256(content_bytes).hexdigest()

            # SHA deduplication: if identical content was already successfully extracted,
            # reuse the result instead of re-running expensive LLM calls.
            try:
                dedup_resp = (
                    supabase
                    .table('menu_results_v2')
                    .select('id, structured_data, raw_text, extraction_method')
                    .eq('sha256', source_sha)
                    .eq('status', 'done')
                    .neq('id', result_id)
                    .limit(1)
                    .execute()
                )
                dedup_rows = getattr(dedup_resp, 'data', None) or []
                if dedup_rows:
                    prior = dedup_rows[0]
                    prior_method = prior.get('extraction_method') or 'unknown'
                    logger.info(f"SHA dedup hit — reusing prior extraction (sha={source_sha[:12]}…, method={prior_method})")
                    supabase.table('menu_results_v2').update({
                        'status': 'done',
                        'raw_text': prior.get('raw_text'),
                        'structured_data': prior.get('structured_data'),
                        'extraction_method': prior_method + '+dedup',
                        'sha256': source_sha,
                        'completed_at': utc_now_iso(),
                        'source_url': pdf_url,
                        'source_content_type': content_type,
                        'language_code': language_code,
                    }).eq('id', result_id).execute()
                    return True
            except Exception as _dedup_err:
                logger.warning(f"SHA dedup check failed (will re-extract): {_dedup_err}")

            structured_data = None
            raw_text = None
            metrics = {}

            if is_pdf:
                if not pdf_path:
                    storage_path = f"{business_id}/menu/{source_sha}.pdf"
                    public_url = storage_upload_public("business-documents", storage_path, content_bytes, content_type="application/pdf")
                    pdf_bucket = "business-documents"
                    pdf_path = storage_path
                else:
                    public_url = storage_public_url(pdf_bucket, pdf_path)

                # Extract text
                try:
                    extracted_text, metrics = extract_text_staged(content_bytes, language_code)
                    raw_text = extracted_text
                    if language_code == "da":
                        raw_text = apply_ocr_corrections(raw_text)
                except RuntimeError as e:
                    if str(e) != "HARD_PDF_REQUIRES_GPT52_VISION":
                        raise

                    logger.info("Hard PDF detected (low digital text). Using GPT-5.2 vision.")
                    vision_text, vision_menu, vision_metrics = extract_with_vision(content_bytes, language_code)

                    if not vision_menu or not validate_structured_menu(vision_menu):
                        if self._vision_error_is_auth():
                            user_reason = (
                                "Menu extraction is temporarily unavailable due to a server configuration issue. "
                                "Please try again later."
                            )
                        else:
                            user_reason = (
                                "We couldn't reliably read this menu. "
                                "The PDF appears to be a low-quality scan or uses styling/layout that prevents accurate extraction. "
                                "Please provide a clearer PDF link (higher contrast / less compression)."
                            )
                        supabase.table('menu_results_v2').update({
                            'status': 'error',
                            'error_message': user_reason,
                            'raw_text': (vision_text or None),
                            'extraction_method': 'gpt-5.2-vision',
                            'completed_at': utc_now_iso(),
                            'storage_bucket': pdf_bucket,
                            'storage_path': pdf_path,
                            'source_url': pdf_url,
                            'source_content_type': content_type,
                            'language_code': language_code,
                            'sha256': source_sha,
                        }).eq('id', result_id).execute()
                        return False

                    raw_text = (vision_text or "").strip() or "(extracted via vision)"
                    metrics = vision_metrics
                    structured_data = vision_menu
                    if isinstance(structured_data, dict):
                        meta = structured_data.get('_meta', {})
                        meta.update({
                            'source': 'gpt-5.2-vision',
                            'notes': 'Extracted from rendered PDF images (scan/low digital text).',
                        })
                        structured_data['_meta'] = meta
            elif is_image:
                # Direct image menu (JPG, PNG, etc.)
                logger.info(f"🖼️ Processing image menu: {content_type}")
                
                # Store image
                ext = '.jpg' if content_type == 'image/jpeg' else \
                      '.png' if content_type == 'image/png' else \
                      '.webp' if content_type == 'image/webp' else '.jpg'
                storage_path = f"{business_id}/menu/{source_sha}{ext}"
                public_url = storage_upload_public("business-documents", storage_path, content_bytes, content_type=content_type or "image/jpeg")
                pdf_bucket = "business-documents"
                pdf_path = storage_path
                
                # Use GPT vision to extract from image
                try:
                    # Create a simple wrapper to use the vision extractor with raw image bytes
                    # The vision extractor expects PNG bytes in a list
                    logger.info("🔍 Using GPT vision for image extraction")
                    from extractors.vision_extractor import parse_menu_from_images_with_vision
                    
                    # Convert image to PNG if needed (vision model works best with PNG)
                    try:
                        from PIL import Image
                        import io
                        
                        img = Image.open(io.BytesIO(content_bytes))
                        png_buffer = io.BytesIO()
                        img.save(png_buffer, format='PNG')
                        png_bytes = png_buffer.getvalue()
                        images_png = [png_bytes]
                    except Exception as conv_err:
                        logger.warning(f"Image conversion failed, using raw bytes: {conv_err}")
                        images_png = [content_bytes]
                    
                    vision_text, vision_menu = parse_menu_from_images_with_vision(
                        images_png, 
                        language_code,
                        GPT52_MODEL
                    )
                    
                    if not vision_menu or not validate_structured_menu(vision_menu):
                        error_code = 'invalid_output' if vision_menu else 'no_menu_found'
                        user_reason = (
                            "Could not extract a valid menu from this image. "
                            "Please ensure the image shows a clear menu with prices and try again."
                        )
                        supabase.table('menu_results_v2').update({
                            'status': 'error',
                            'error_code': error_code,
                            'error_message': user_reason,
                            'raw_text': (vision_text or None),
                            'extraction_method': 'image_ocr',
                            'completed_at': utc_now_iso(),
                            'storage_bucket': pdf_bucket,
                            'storage_path': pdf_path,
                            'source_url': pdf_url,
                            'source_content_type': content_type,
                            'language_code': language_code,
                            'sha256': source_sha,
                        }).eq('id', result_id).execute()
                        return False
                    
                    raw_text = (vision_text or "").strip() or "(extracted via vision from image)"
                    metrics = {
                        'total_pages': 1,
                        'char_count': len(raw_text),
                        'method': 'image_ocr',
                    }
                    structured_data = vision_menu
                    if isinstance(structured_data, dict):
                        meta = structured_data.get('_meta', {})
                        meta.update({
                            'source': 'gpt-5.2-vision',
                            'notes': 'Extracted directly from image menu.',
                        })
                        structured_data['_meta'] = meta
                        
                except Exception as img_err:
                    logger.error(f"Image extraction failed: {img_err}")
                    supabase.table('menu_results_v2').update({
                        'status': 'error',
                        'error_code': 'parser_failed',
                        'error_message': f"Image extraction failed: {str(img_err)}",
                        'extraction_method': 'image_ocr',
                        'completed_at': utc_now_iso(),
                        'storage_bucket': pdf_bucket,
                        'storage_path': pdf_path,
                        'source_url': pdf_url,
                        'source_content_type': content_type,
                        'language_code': language_code,
                        'sha256': source_sha,
                    }).eq('id', result_id).execute()
                    return False
            else:
                # HTML menu page
                html = content_bytes.decode('utf-8', errors='ignore')
                
                # Check if HTML is minimal/empty (JavaScript-rendered content)
                # If so, use browser to render the page
                if is_html_empty_or_minimal(html):
                    logger.info("⚠️ HTML appears to be JavaScript-rendered - using browser fallback")
                    try:
                        rendered_html, rendered_text = extract_with_browser(pdf_url, timeout_ms=30000)
                        html = rendered_html
                        logger.info(f"✅ Browser rendering successful: {len(html)} chars HTML")
                        metrics = {
                            'total_pages': 1,
                            'char_count': len(rendered_text),
                            'method': 'browser',
                        }
                    except Exception as browser_err:
                        logger.error(f"❌ Browser fallback failed: {browser_err}")
                        # Continue with original static HTML (will likely fail parsing, but worth trying)
                        logger.info("⚠️ Falling back to static HTML extraction")
                
                snapshot_path = f"{business_id}/menu_snapshots/{source_sha}.html"
                public_url = storage_upload_public_with_mime_fallback(
                    "business-documents",
                    snapshot_path,
                    content_bytes,
                    primary_content_type="text/html",
                    fallback_content_type="application/pdf",
                )
                pdf_bucket = "business-documents"
                pdf_path = snapshot_path

                raw_text = html_to_text(html)
                
                # Only set metrics if not already set by browser extraction
                if 'metrics' not in locals():
                    metrics = {
                        'total_pages': 1,
                        'char_count': len(raw_text),
                        'method': 'html',
                    }

            # Parse with LLM if not already parsed by vision
            method = metrics.get('method')
            if method in ('html', 'browser'):
                llm_text = clean_html_text_for_llm(raw_text, max_chars=MAX_LLM_CHARS)
            else:
                llm_text = compress_text_for_llm(raw_text, max_chars=MAX_LLM_CHARS)

            if structured_data is None:
                structured_data = parse_menu_with_llm(llm_text, language_code, model="gpt-4o-mini")
                # NOTE: gpt-4o text retry removed — if mini can't parse clean text, gpt-4o won't either;
                # the bottleneck is input quality, not model capability. Vision fallback below handles hard cases.

                # Fallback to vision for failed PDF parsing
                if is_pdf and GPT52_VISION_ENABLED and not validate_structured_menu(structured_data):
                    logger.info("Text parse failed for PDF; falling back to GPT-5.2 vision")
                    vision_text, vision_menu, vision_metrics = extract_with_vision(content_bytes, language_code)

                    if vision_menu and validate_structured_menu(vision_menu):
                        raw_text = (vision_text or "").strip() or raw_text
                        metrics = vision_metrics
                        structured_data = vision_menu
                        if isinstance(structured_data, dict):
                            meta = structured_data.get('_meta', {})
                            meta.update({
                                'source': 'gpt-5.2-vision',
                                'notes': 'Fallback: extracted from rendered PDF images because text parsing was unreliable.',
                            })
                            structured_data['_meta'] = meta
                    else:
                        logger.warning("GPT-5.2 vision fallback did not produce a valid menu")

            processing_time_ms = int((time.time() - start_time) * 1000)

            # Persist to business_documents
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

            # Update job status
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

            logger.info(f"✅ Job {result_id} completed in {processing_time_ms}ms")
            return True

        except Exception as e:
            logger.error(f"Error processing job: {str(e)}\n{traceback.format_exc()}")

            if 'result_id' in locals():
                update_payload: Dict[str, Any] = {
                    'status': 'error',
                    'error_message': str(e),
                    'completed_at': utc_now_iso(),
                }
                if 'metrics' in locals() and isinstance(metrics, dict):
                    update_payload['extraction_method'] = metrics.get('method')
                supabase.table('menu_results_v2').update(update_payload).eq('id', result_id).execute()

            return False

    def run(self):
        """Main worker loop - continuously poll queue for jobs."""
        logger.info("Menu OCR Worker starting...")

        if not supabase:
            logger.error("❌ Supabase client not initialized - cannot process jobs")
            return

        while True:
            try:
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
