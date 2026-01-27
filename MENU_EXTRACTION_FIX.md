# Menu Extraction Polling Fix

## Problem
The frontend was repeatedly polling the `menu_results_v2` table even after menu extraction was completed. This caused:
- Excessive API calls to Supabase
- Browser console spam with repeated fetch logs
- Unnecessary resource usage

## Root Cause
When a menu extraction job completed quickly (before realtime subscription was established), the immediate fetch would detect the `done` status and process the result. However, the polling interval (`setInterval`) was still being set up afterward, causing continuous 5-second polls even though the job was already finished.

## Solution
Added an `isAlreadyCompleted` flag that:
1. Gets set to `true` when immediate fetch finds a completed job (`done` or `error` status)
2. Prevents the polling interval from being created if the job is already completed
3. Properly cleans up the realtime subscription

This fix was applied to both:
- `handleFetchMenuUrl()` - Single URL extraction
- `extractMenuFromUrl()` - Multi-URL extraction from menu sources

## Files Changed
- [src/pages/dashboard/businessProfile/components/hooks/useMenuHandlers.ts](src/pages/dashboard/businessProfile/components/hooks/useMenuHandlers.ts)

## Simplified Menu Extraction Architecture

### User Flow
1. **User provides menu URL** (HTML page, easy-to-read PDF, or scanned/image PDF)
2. **Job queued** in `menu_results_v2` table with status: `queued`
3. **Cloud Run worker** claims job and sets status to `processing`
4. **Extraction happens** based on document type:
   - **HTML**: Extract text directly from webpage
   - **Digital PDF**: Extract embedded text (fast, no OCR needed)
   - **Scanned PDF**: Use GPT-4o vision to read from rendered images (your GPT-5.2 preference)
5. **Results stored** in `menu_results_v2` with status: `done` or `error`
6. **Frontend receives** results via realtime subscription OR polling fallback

### Models Used (No OCR Worker Needed)
- **Easy PDFs with digital text**: Direct text extraction using PyMuPDF
- **Difficult/scanned PDFs**: GPT-4o or GPT-4 vision models read rendered PNG images
- **Menu parsing**: GPT-4o-mini parses extracted text into structured JSON

### Key Components

#### Backend
- **Cloud Run Worker**: [cloud-run-workers/menu-ocr-worker/main.py](cloud-run-workers/menu-ocr-worker/main.py)
  - Claims jobs from queue
  - Fetches PDF/HTML
  - Extracts text (staged approach: digital → vision fallback)
  - Parses menu into structured JSON
  - Updates database

#### Frontend
- **Menu Handlers Hook**: [src/pages/dashboard/businessProfile/components/hooks/useMenuHandlers.ts](src/pages/dashboard/businessProfile/components/hooks/useMenuHandlers.ts)
  - Queues extraction jobs
  - Monitors status via realtime + polling
  - Updates UI when complete

#### Database
- **menu_results_v2**: Job queue with statuses (`queued`, `processing`, `done`, `error`)
- **business_documents**: Persistent storage of extracted menus
- **menu_extractions**: User-facing menu data

## Testing
1. Try a PDF menu extraction
2. Check browser console - should see only ONE fetch completion message (not repeated)
3. Verify menu appears in UI after extraction completes
4. Check that realtime updates OR polling (whichever triggers first) properly stop after completion

## No OCR Worker Required
Your architecture correctly uses:
- **PyMuPDF** for digital PDF text extraction
- **GPT-4o/GPT-5.2 vision** for scanned PDFs instead of dedicated OCR
- This is simpler and more cost-effective than running separate OCR services
