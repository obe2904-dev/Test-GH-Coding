"""Menu extraction worker - Flask app and entry point."""

import os
import logging
import threading
import traceback
from flask import Flask, jsonify, request

from config import (
    supabase,
    WORKER_TRIGGER_TOKEN,
    WORKER_BACKGROUND_POLL_ENABLED,
    WORKER_BUILD_ID,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY,
)
from worker import MenuOCRWorker

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global worker instance
worker_instance = None


def _authorized_worker_trigger(req) -> bool:
    """Check if request is authorized to trigger worker."""
    if not WORKER_TRIGGER_TOKEN:
        return True
    provided = req.headers.get('x-worker-token') or req.headers.get('X-Worker-Token')
    return bool(provided) and provided == WORKER_TRIGGER_TOKEN


# Initialize Flask app
app = Flask(__name__)


@app.route('/run-once', methods=['POST'])
def run_once():
    """Trigger endpoint for processing one job (for Cloud Scheduler)."""
    if not _authorized_worker_trigger(request):
        return jsonify({"error": "unauthorized"}), 401

    if not supabase:
        return jsonify({"error": "supabase_not_initialized"}), 500

    global worker_instance
    if not worker_instance:
        try:
            worker_instance = MenuOCRWorker()
        except Exception as e:
            return jsonify({"error": f"failed_to_init_worker: {str(e)}"}), 500

    try:
        worker_instance._requeue_stale_jobs()
    except Exception as e:
        logger.warning("Stale requeue failed in /run-once: %s", str(e))

    job = worker_instance.claim_next_job()
    if not job:
        return jsonify({"claimed": False}), 200

    ok = worker_instance.process_job(job)
    return jsonify({
        "claimed": True,
        "processed": bool(ok),
        "job_id": job.get('id'),
    }), 200


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
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
    """Root endpoint."""
    return jsonify({"service": "menu-ocr-worker", "status": "running"}), 200


if __name__ == "__main__":
    try:
        worker_instance = MenuOCRWorker()

        if WORKER_BACKGROUND_POLL_ENABLED:
            worker_thread = threading.Thread(target=worker_instance.run, daemon=True)
            worker_thread.start()
            logger.info("Worker thread started (background polling enabled)")
        else:
            logger.info("Worker background polling disabled; awaiting /run-once triggers")

        if WORKER_BUILD_ID:
            logger.info("Worker build id: %s", WORKER_BUILD_ID)
    except Exception as e:
        logger.error(f"Failed to start worker thread: {str(e)}\n{traceback.format_exc()}")

    port = int(os.getenv("PORT", 8080))
    logger.info(f"Starting HTTP server on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
