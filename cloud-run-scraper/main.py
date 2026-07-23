"""
Cloud Run Website Scraper - Async Pattern (v4)
Writes payloads directly to Supabase, calls webhook with metadata only
"""

import os
import json
import time
import asyncio
import requests
from flask import Flask, request, jsonify
from datetime import datetime, timezone
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Environment variables
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
SCRAPE_WEBHOOK_SECRET = os.getenv('SCRAPE_WEBHOOK_SECRET')
WEBHOOK_URL = os.getenv('WEBHOOK_URL')
CLOUD_RUN_API_KEY = os.getenv('CLOUD_RUN_API_KEY', '')

# Quality mapping
QUALITY_MAP = {
    'excellent': 'rich',
    'good': 'rich',
    'partial': 'thin',
    'poor': 'shell',
    'failed': 'shell'
}


def write_payload_to_supabase(job_id: str, extraction_result: dict) -> bool:
    """
    Write full scraping payload directly to Supabase website_scrape_results table
    CRITICAL: Must happen BEFORE webhook call
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("Missing Supabase credentials")
    
    headers = {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'  # Don't echo back the payload
    }
    
    # Extract metadata
    quality_rating = extraction_result.get('quality', {}).get('rating', 'partial')
    menu_all = extraction_result.get('services', {}).get('menu_all', [])
    menu_source = menu_all[0].get('detection_method') if menu_all else None
    
    # Prepare payload
    payload_data = {
        'payload': extraction_result,  # Full JSON payload
        'content_quality': QUALITY_MAP.get(quality_rating, 'thin'),
        'menu_source': menu_source,
        'scraped_at': datetime.now(timezone.utc).isoformat(),
    }
    
    # Update the processing row
    url = f'{SUPABASE_URL}/rest/v1/website_scrape_results?id=eq.{job_id}'
    
    try:
        response = requests.patch(url, headers=headers, json=payload_data, timeout=30)
        
        if response.status_code not in [200, 204]:
            logger.error(f"Failed to write payload: {response.status_code} {response.text}")
            return False
        
        logger.info(f"✅ Payload written to Supabase for job {job_id}")
        
        # Small delay to ensure DB commit
        time.sleep(0.5)
        return True
        
    except Exception as e:
        logger.error(f"Exception writing payload: {str(e)}")
        return False


def notify_webhook_completion(job_id: str, extraction_result: dict) -> bool:
    """
    Call webhook with metadata only (NOT full payload)
    CRITICAL: Only call AFTER payload write succeeds
    """
    if not WEBHOOK_URL or not SCRAPE_WEBHOOK_SECRET:
        logger.warning("Missing webhook configuration")
        return False
    
    # Extract metadata
    quality_rating = extraction_result.get('quality', {}).get('rating', 'partial')
    menu_all = extraction_result.get('services', {}).get('menu_all', [])
    menu_source = menu_all[0].get('detection_method') if menu_all else None
    menu_pages_queued = len(extraction_result.get('menu_pages_queued', []))
    
    # Prepare lightweight metadata
    metadata = {
        'job_id': job_id,
        'status': 'success',
        'quality': QUALITY_MAP.get(quality_rating, 'thin'),
        'menu_source': menu_source,
        'menu_pages_queued': menu_pages_queued
    }
    
    headers = {
        'Content-Type': 'application/json',
        'X-Scrape-Webhook-Secret': SCRAPE_WEBHOOK_SECRET
    }
    
    try:
        response = requests.post(WEBHOOK_URL, headers=headers, json=metadata, timeout=10)
        
        if response.status_code not in [200, 204]:
            logger.warning(f"⚠️ Webhook failed: {response.status_code} {response.text}")
            return False
        
        logger.info(f"✅ Webhook notified for job {job_id}")
        return True
        
    except Exception as e:
        logger.error(f"Exception calling webhook: {str(e)}")
        return False


def handle_failure(job_id: str, error_message: str):
    """
    Handle scraping failure - write error to DB and notify webhook
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return
    
    headers = {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        'status': 'failed',
        'error': error_message[:1000],  # Truncate if too long
        'completed_at': datetime.now(timezone.utc).isoformat()
    }
    
    url = f'{SUPABASE_URL}/rest/v1/website_scrape_results?id=eq.{job_id}'
    
    try:
        requests.patch(url, headers=headers, json=payload, timeout=10)
        logger.info(f"❌ Failure recorded for job {job_id}")
    except Exception as e:
        logger.error(f"Failed to record failure: {str(e)}")
    
    # Notify webhook of failure
    if WEBHOOK_URL and SCRAPE_WEBHOOK_SECRET:
        try:
            requests.post(
                WEBHOOK_URL,
                headers={
                    'Content-Type': 'application/json',
                    'X-Scrape-Webhook-Secret': SCRAPE_WEBHOOK_SECRET
                },
                json={
                    'job_id': job_id,
                    'status': 'failed',
                    'error': error_message[:500]
                },
                timeout=10
            )
        except:
            pass


def perform_scraping(url: str) -> dict:
    """
    Perform actual website scraping
    TODO: Replace with your actual scraping logic
    
    This is a placeholder - you need to implement your scraping logic here
    or import from your existing scraper module
    """
    # PLACEHOLDER: This should be replaced with your actual scraping implementation
    # For now, return a minimal valid structure
    
    import urllib.request
    import urllib.error
    
    try:
        # Simple fetch to validate URL
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            content = response.read().decode('utf-8', errors='ignore')
        
        # Minimal extraction result structure
        return {
            'success': True,
            'version': 'v4-async',
            'extraction': {
                'meta': {
                    'title': 'Website Title',
                    'final_url': url,
                    'canonical_url': url
                },
                'contact': {
                    'emails': [],
                    'phones': [],
                    'addresses': []
                },
                'quality': {
                    'rating': 'good',
                    'warnings': [],
                    'fields_found': 5,
                    'fields_expected': 8
                },
                'business': {
                    'name': {'value': 'Business Name', 'confidence': 0.8},
                    'description': {'value': 'Business Description', 'confidence': 0.8}
                },
                'services': {
                    'menu': None,
                    'menu_all': [],
                    'booking': None
                }
            },
            'pages_crawled': [{'url': url, 'quality': 'good'}],
            'menu_pages_queued': [],
            'scraper_metadata': {
                'version': 'v4-async',
                'duration_ms': 1000,
                'scraper_type': 'cloud-run-async'
            }
        }
    except Exception as e:
        logger.error(f"Scraping failed: {str(e)}")
        raise


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'version': 'v4-async'}), 200


@app.route('/scrape-v3', methods=['POST'])
def scrape_v3():
    """
    Main scraping endpoint - Async pattern
    
    Request body:
    {
        "url": "https://example.com",
        "job_id": "uuid",
        "callback_url": "https://...",  # Ignored (we use env var)
        "async": true
    }
    
    Returns 202 Accepted immediately, then:
    1. Performs scraping
    2. Writes full payload to Supabase
    3. Calls webhook with metadata only
    """
    # API Key authentication
    api_key = request.headers.get('X-API-Key', '')
    if CLOUD_RUN_API_KEY and api_key != CLOUD_RUN_API_KEY:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        data = request.get_json()
        url = data.get('url')
        job_id = data.get('job_id')
        is_async = data.get('async', False)
        
        if not url:
            return jsonify({'error': 'url is required'}), 400
        
        if not job_id:
            return jsonify({'error': 'job_id is required'}), 400
        
        logger.info(f"📥 Received scrape request: {url} (job_id: {job_id}, async: {is_async})")
        
        # For async mode, start scraping in background
        if is_async:
            # Start async processing
            asyncio.create_task(async_scrape_worker(url, job_id))
            
            # Return 202 immediately
            return jsonify({
                'success': True,
                'accepted': True,
                'job_id': job_id,
                'message': 'Scraping started in background'
            }), 202
        
        # Synchronous mode (fallback for compatibility)
        return sync_scrape(url, job_id)
    
    except Exception as e:
        logger.error(f"Error in scrape endpoint: {str(e)}")
        return jsonify({'error': str(e)}), 500


async def async_scrape_worker(url: str, job_id: str):
    """
    Background worker for async scraping
    """
    try:
        logger.info(f"🔄 Starting async scrape for {url}")
        
        # Perform scraping
        extraction_result = perform_scraping(url)
        
        # Write payload to Supabase (FIRST)
        write_success = write_payload_to_supabase(job_id, extraction_result)
        
        if not write_success:
            raise Exception("Failed to write payload to Supabase")
        
        # Call webhook (SECOND, after payload write)
        notify_webhook_completion(job_id, extraction_result)
        
        logger.info(f"✅ Async scrape completed for {url}")
        
    except Exception as e:
        logger.error(f"❌ Async scrape failed for {url}: {str(e)}")
        handle_failure(job_id, str(e))


def sync_scrape(url: str, job_id: str):
    """
    Synchronous scraping (legacy mode)
    """
    try:
        extraction_result = perform_scraping(url)
        
        # Write to Supabase
        write_payload_to_supabase(job_id, extraction_result)
        
        # Call webhook
        notify_webhook_completion(job_id, extraction_result)
        
        # Return minimal response (not full payload)
        return jsonify({
            'success': True,
            'job_id': job_id,
            'quality': extraction_result.get('quality', {}).get('rating')
        }), 200
        
    except Exception as e:
        handle_failure(job_id, str(e))
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 8080))
    app.run(host='0.0.0.0', port=port)
