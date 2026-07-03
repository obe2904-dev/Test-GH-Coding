"""Website analyzer worker class."""

import time
import logging
import traceback
from typing import Optional, Dict, Any
from datetime import datetime

from config import (
    supabase,
    OPENAI_API_KEY,
    FETCH_TIMEOUT_SECONDS,
    MAX_CONTENT_SIZE_MB,
    STALE_JOB_MINUTES,
    GPT_MODEL,
    GPT_FALLBACK_MODEL,
    MAX_AI_RETRIES,
)
from utils.helpers import utc_now_iso, normalize_url
from utils.web_fetcher import extract_text_from_html, extract_metadata, extract_ui_elements_from_html
from utils.browser_fetcher import fetch_webpage_with_browser, fetch_webpage_simple
from analyzers.content_analyzer import analyze_website_content, generate_brand_profile

logger = logging.getLogger(__name__)


class WebsiteAnalyzerWorker:
    """Worker that processes website analysis jobs from Supabase queue."""
    
    def __init__(self):
        self._last_stale_requeue_at = 0.0

    def claim_next_job(self) -> Optional[Dict[str, Any]]:
        """Atomically claim the next queued job via Postgres RPC."""
        rpc_error: Optional[Exception] = None

        # Try RPC first
        try:
            resp = supabase.rpc('claim_website_analysis_job', {}).execute()
            data = getattr(resp, 'data', None)
            if data:
                if isinstance(data, list):
                    return data[0] if data else None
                if isinstance(data, dict):
                    return data if data.get('id') else None
            return None
        except Exception as e:
            rpc_error = e
            logger.error("Failed to claim job via RPC: %s", str(e))

        # Fallback: manual claim
        try:
            resp = (
                supabase
                .table('website_analysis_jobs')
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
            job_id = candidate.get('id')
            if not job_id:
                return None

            claimed_payload: Dict[str, Any] = {
                'status': 'processing',
                'claimed_at': utc_now_iso(),
            }

            upd = (
                supabase
                .table('website_analysis_jobs')
                .update(claimed_payload)
                .eq('id', job_id)
                .eq('status', 'queued')
                .execute()
            )
            updated_rows = getattr(upd, 'data', None) or []
            if updated_rows:
                logger.warning("Claimed job via fallback: id=%s", str(job_id))
                return updated_rows[0]

            return None
        except Exception as e:
            logger.error("Fallback claim failed: %s", str(e))
            return None

    def _requeue_stale_jobs(self) -> None:
        """Requeue jobs stuck in processing beyond threshold."""
        try:
            resp = supabase.rpc('requeue_stale_website_jobs', {
                'max_age_minutes': STALE_JOB_MINUTES
            }).execute()
            requeued = getattr(resp, 'data', None)
            if isinstance(requeued, int) and requeued > 0:
                logger.warning(f"Requeued {requeued} stale website_analysis_jobs")
            return
        except Exception as e:
            logger.error(f"Failed to requeue stale jobs via RPC: {str(e)}")

        # Fallback
        try:
            threshold_dt = datetime.utcnow().timestamp() - (STALE_JOB_MINUTES * 60)
            threshold_iso = datetime.utcfromtimestamp(threshold_dt).isoformat() + 'Z'
            upd = (
                supabase
                .table('website_analysis_jobs')
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

    def process_job(self, job: Dict[str, Any]) -> bool:
        """Process a single website analysis job."""
        try:
            job_id = job.get('id')
            business_id = job.get('business_id')
            website_url = job.get('website_url')

            if not job_id or not business_id or not website_url:
                raise ValueError("Invalid job payload")

            logger.info(f"Processing job {job_id} for {website_url}")
            start_time = time.time()

            # Normalize URL
            website_url = normalize_url(website_url)

            logger.info("Fetch (browser) start url=%s timeout_ms=%s", website_url, FETCH_TIMEOUT_SECONDS * 1000)

            # Try browser-based fetch first (for SPAs and JS-heavy sites)
            html, final_url, fetch_error = fetch_webpage_with_browser(
                website_url,
                timeout=FETCH_TIMEOUT_SECONDS * 1000  # Convert to milliseconds
            )
            logger.info("Fetch (browser) done url=%s final_url=%s chars=%s err=%s", website_url, final_url, len(html or ""), fetch_error)
            
            # Fallback to simple fetch if browser fails
            if fetch_error or not html:
                logger.warning(f"Browser fetch failed, trying simple: {fetch_error}")
                html, final_url, fetch_error = fetch_webpage_simple(
                    website_url,
                    timeout=FETCH_TIMEOUT_SECONDS
                )
                logger.info("Fetch (simple) done url=%s final_url=%s chars=%s err=%s", website_url, final_url, len(html or ""), fetch_error)

            if fetch_error or not html:
                raise Exception(fetch_error or "Failed to fetch webpage")

            # Extract content
            text_content = extract_text_from_html(html)
            metadata = extract_metadata(html)

            # Extract UI elements for robust CTA/header/nav phrases
            extracted_ui = extract_ui_elements_from_html(html)

            # Store a truncated raw HTML snippet (best-effort)
            max_html_chars = int(MAX_CONTENT_SIZE_MB * 1024 * 1024)
            raw_html = (html or "")[:max_html_chars]

            if not text_content or len(text_content.strip()) < 100:
                raise Exception("Insufficient content extracted from webpage")

            # Analyze with AI
            analysis = None
            for attempt in range(MAX_AI_RETRIES + 1):
                model = GPT_MODEL if attempt == 0 else GPT_FALLBACK_MODEL
                logger.info(f"Analyzing with {model} (attempt {attempt + 1})")
                
                logger.info("Analysis start model=%s text_len=%s", model, len(text_content or ""))

                analysis = analyze_website_content(
                    text_content,
                    metadata,
                    final_url,
                    OPENAI_API_KEY,
                    model=model
                )

                if analysis:
                    logger.info("Analysis succeeded model=%s", model)
                
                if analysis:
                    break
                
                if attempt < MAX_AI_RETRIES:
                    logger.warning(f"Analysis attempt {attempt + 1} failed, retrying...")
                    time.sleep(2)

            if not analysis:
                raise Exception("Failed to analyze website content after retries")

            # Generate brand profile (optional enhancement)
            logger.info("Brand profile start")
            brand_profile = generate_brand_profile(
                analysis,
                OPENAI_API_KEY,
                model=GPT_MODEL
            )
            logger.info("Brand profile done")

            # Combine results
            result = {
                'website_url': final_url,
                'analysis': analysis,
                'brand_profile': brand_profile,
                'metadata': metadata,
                'extracted': extracted_ui,
                'analyzed_at': utc_now_iso()
            }

            processing_time_ms = int((time.time() - start_time) * 1000)

            # Update job status
            logger.info("Updating job status to done id=%s", job_id)
            supabase.table('website_analysis_jobs').update({
                'status': 'done',
                'result': result,
                'completed_at': utc_now_iso()
            }).eq('id', job_id).execute()

            # Update business profile (only columns that exist on the table)
            try:
                update_payload: Dict[str, Any] = {
                    'website_analysis': result,
                    'updated_at': utc_now_iso()
                }

                # Map optional fields if present
                if analysis.get('business_name'):
                    update_payload['name'] = analysis.get('business_name')
                if analysis.get('business_type'):
                    update_payload['vertical'] = analysis.get('business_type')

                logger.info("Updating business profile id=%s payload_keys=%s", business_id, list(update_payload.keys()))
                resp = supabase.table('businesses').update(update_payload).eq('id', business_id).execute()
                logger.info(f"✅ Updated business profile for {business_id}; rows={len(getattr(resp, 'data', []) or [])}")
            except Exception as e:
                logger.error(f"Failed to update business profile: {str(e)}")

            # Also write a row into website_analyses for Brand Profile Generator compatibility
            try:
                wa_payload: Dict[str, Any] = {
                    'business_id': business_id,
                    'source_url': final_url,
                    'status': 'success',
                    'last_run_at': utc_now_iso(),
                    'raw_result': result,
                    'raw_html': raw_html,
                    'cta_texts': extracted_ui.get('cta_texts') or [],
                    'headers': extracted_ui.get('headers') or [],
                    'nav_items': extracted_ui.get('nav_items') or [],
                    'hero_texts': extracted_ui.get('hero_texts') or [],
                }
                supabase.table('website_analyses').insert(wa_payload).execute()
                logger.info("✅ Inserted website_analyses row for business_id=%s", business_id)
            except Exception as e:
                # Do not fail the job if this insert fails (e.g., table/columns not migrated in this env yet)
                logger.warning("website_analyses insert skipped/failed: %s", str(e))

            logger.info(f"✅ Job {job_id} completed in {processing_time_ms}ms")
            return True

        except Exception as e:
            logger.error(f"Error processing job: {str(e)}\n{traceback.format_exc()}")

            if 'job_id' in locals():
                supabase.table('website_analysis_jobs').update({
                    'status': 'error',
                    'error_message': str(e),
                    'completed_at': utc_now_iso()
                }).eq('id', job_id).execute()

            return False

    def run(self):
        """Main worker loop - continuously poll queue for jobs."""
        logger.info("Website Analyzer Worker starting...")

        if not supabase:
            logger.error("❌ Supabase client not initialized")
            return

        while True:
            try:
                now_s = time.time()
                if now_s - self._last_stale_requeue_at > 60:
                    self._requeue_stale_jobs()
                    self._last_stale_requeue_at = now_s

                job = self.claim_next_job()

                if not job:
                    logger.debug("No job claimed (queue empty)")
                    time.sleep(2)
                    continue

                logger.info("Claimed job %s url=%s status=%s", job.get('id'), job.get('website_url'), job.get('status'))
                self.process_job(job)

            except Exception as e:
                logger.error(f"Worker error: {str(e)}\n{traceback.format_exc()}")
                time.sleep(5)
