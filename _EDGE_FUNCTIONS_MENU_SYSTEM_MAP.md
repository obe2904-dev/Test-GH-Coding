# Edge Functions - Menu System Map

**Created:** 2026-07-23  
**Purpose:** Map all Edge functions involved in menu detection, extraction, and processing

---

## 🎯 Primary Menu Functions (Active in Current Flow)

### 1. `detect-menus`
**Path:** `supabase/functions/detect-menus/index.ts`  
**Purpose:** Detect menu URLs from business websites and classify content type  
**Called By:** MenuPage.tsx (`handleDetectMenus`)  
**Calls:** Nothing (standalone crawler)  
**Returns:** 
- `detectedMenuUrls` (legacy array of strings)
- `detectedSources` (new array with `{url, source_kind, label}`)

**Source Kind Classification:**
- `html` - Standard web pages
- `pdf` - PDF documents
- `image` - JPG/PNG/WebP files
- `mealo` - Mealo restaurant platform
- `iframe_platform` - SPA platforms (Webflow, Dinnerbooking, etc.)

**Key Features:**
- Parallel HEAD requests to classify undetected URLs
- Preserves Mealo `restaurantid` query param
- Content-type detection during expansion loop
- 4-second timeout per URL

---

### 2. `menu-extract-v2`
**Path:** `supabase/functions/menu-extract-v2/index.ts`  
**Purpose:** Unified extraction engine for all menu types  
**Called By:** 
- MenuPage.tsx (`extractMenuInternal` for direct URL extraction)
- useMenuHandlers.ts (`handleFetchMenuUrl`, `extractMenuFromUrl`)

**Calls Internally:**
- Google Vision API (direct integration, not via ocr-menu)
- Cloud Run menu-ocr-worker (for large PDFs and complex extractions)

**Processing Modes:**
1. **HTML Mode:** Fetch HTML, extract text, send to LLM
2. **PDF Mode (Fast-path):** 
   - ≤5 MB: Extract text in Edge function, send to LLM
   - >5 MB: Delegate to Cloud Run worker
3. **Image Mode:** Google Vision OCR → LLM parsing
4. **Mealo/iframe_platform:** Delegate to Cloud Run worker with Puppeteer

**Returns:** Writes to `menu_results_v2` table with:
- `status`: 'queued' | 'processing' | 'completed' | 'error'
- `extracted_data`: Full JSON menu structure
- `source_id`: Link to menu_sources entry

**Environment Variables Used:**
- `GOOGLE_VISION_API_KEY` - For image OCR
- `MENU_OCR_WORKER_URL` - Cloud Run worker endpoint
- `MENU_OCR_WORKER_TOKEN` - Worker auth token
- `MENU_OCR_WORKER_GCP_SA_JSON` - Service account for OIDC
- `MENU_OCR_WORKER_TRIGGER_ON_ENQUEUE` - Enable instant worker trigger
- `OPENAI_API_KEY` - For LLM menu parsing

---

### 3. `queue-menu-upload-v2`
**Path:** `supabase/functions/queue-menu-upload-v2/index.ts`  
**Purpose:** Handle PDF/JPG/PNG file uploads, store in Supabase Storage, queue extraction  
**Called By:** MenuPage.tsx (`handleUploadFile`)  
**Calls:** 
- `triggerMenuWorkerOnce()` - Attempts to wake Cloud Run worker

**Flow:**
1. Validate uploaded file (type, size)
2. Store in `menu-files` bucket
3. Create `menu_sources` entry with:
   - `source_url` = publicUrl from storage
   - `source_kind` = 'pdf' | 'image'
   - `label` = filename
4. Create `menu_results_v2` entry with:
   - `status` = 'queued'
   - `source_id` = link to menu_sources
   - `source_url` = publicUrl
   - `storage_bucket` = 'menu-files'
   - `storage_path` = path in bucket
5. Attempt to trigger Cloud Run worker

**Current Issue:** 
- Cloud Run worker not processing queued jobs
- Environment variables for worker trigger not configured
- Jobs remain in 'queued' status indefinitely

---

## 🔄 Legacy/Alternative Menu Functions

### 4. `ocr-menu`
**Path:** `supabase/functions/ocr-menu/index.ts`  
**Purpose:** Direct Google Vision API wrapper for menu image OCR  
**Status:** ⚠️ Legacy - menu-extract-v2 has integrated Google Vision  
**Called By:** ImageOCRStrategy.ts (legacy extraction strategy)  
**Returns:** Raw OCR text with confidence score

**Note:** Not currently used in main MenuPage flow. menu-extract-v2 handles OCR internally.

---

### 5. `scrape-menu`
**Path:** `supabase/functions/scrape-menu/index.ts`  
**Purpose:** CORS proxy for Cloud Run scraper  
**Status:** ⚠️ Legacy - direct Cloud Run worker integration preferred  
**Called By:** menuExtractionService.ts (legacy service)  
**Calls:** Cloud Run scraper `/scrape-v3` endpoint

---

### 6. `parse-menu-text`
**Path:** `supabase/functions/parse-menu-text/index.ts`  
**Purpose:** Parse extracted menu text using GPT-4o with Danish language support  
**Status:** ⚠️ Legacy - menu-extract-v2 handles parsing internally  
**Called By:** useMenuHandlers.ts (`extractMenuFromUrl`)  
**Features:**
- Multi-line item grouping
- Danish special character preservation (æ, ø, å)
- OCR correction preprocessing
- Category detection

---

### 7. `persist-menu-extraction`
**Path:** `supabase/functions/persist-menu-extraction/index.ts`  
**Purpose:** Server-side persistence with ownership validation  
**Status:** ⚠️ Legacy - menu-extract-v2 writes directly to DB  
**Called By:** MenuPersistence.ts (legacy persistence layer)  
**Writes To:**
- `menu_results_v2` table
- `menu_items_normalized` table

---

### 8. `download-menu-pdf` 
**Path:** `supabase/functions/download-menu-pdf/index.ts`  
**Purpose:** Download PDF from URL and store in Supabase Storage  
**Status:** ⚠️ Legacy - queue-menu-upload-v2 handles uploads  
**Called By:** ImageOCRStrategy.ts (legacy extraction strategy)

---

### 9. `extract-pdf-text`
**Path:** `supabase/functions/extract-pdf-text/index.ts`  
**Purpose:** Extract text from stored PDF (text layer check)  
**Status:** ⚠️ Legacy - menu-extract-v2 handles PDF text extraction  
**Called By:** ImageOCRStrategy.ts (legacy extraction strategy)

---

### 10. `menu-enqueue`
**Path:** `supabase/functions/menu-enqueue/index.ts`  
**Purpose:** Queue menu extraction jobs (alternative to menu-extract-v2)  
**Status:** ⚠️ Not used in current MenuPage flow  
**Features:** Auth validation, business access check, job queueing

---

## ☁️ Cloud Run Workers

### `menu-ocr-worker`
**Path:** `cloud-run-workers/menu-ocr-worker/worker.py`  
**Purpose:** Async processing of complex menu extractions  
**Triggered By:** 
- menu-extract-v2 Edge function (via `triggerMenuWorkerDirect`)
- queue-menu-upload-v2 (via `triggerMenuWorkerOnce`)
- Cloud Scheduler (polling mode if env vars not configured)

**Processes:**
- Large PDFs (>5 MB)
- SPA platforms requiring Puppeteer (iframe_platform)
- Complex multi-page menus
- OCR fallback for scanned PDFs

**Polling:** Checks `menu_results_v2` table for jobs with `status='queued'`

**RPC Function:** Uses `claim_menu_result_v2()` to atomically claim jobs

**Current Issue:** Not picking up the queued PDF job (source: 06f07e0d-6986-4c32-a51d-3e92abf8e503)

---

## 📊 Database Tables

### `menu_sources`
**Purpose:** Source registration before extraction  
**Columns:**
- `id` (uuid, PK)
- `business_id` (uuid, FK)
- `source_url` (text) - URL or storage public URL
- `source_kind` (text) - 'html' | 'pdf' | 'image' | 'mealo' | 'iframe_platform'
- `label` (text) - Display name
- `status` (text) - 'active' | 'archived'

**Written By:** 
- MenuPage.tsx (after detect-menus, manual URL add)
- queue-menu-upload-v2 (after file upload)

---

### `menu_results_v2`
**Purpose:** Extraction job queue and results  
**Columns:**
- `id` (uuid, PK)
- `business_id` (uuid, FK)
- `source_id` (uuid, FK → menu_sources)
- `source_url` (text)
- `storage_bucket` (text) - For uploaded files
- `storage_path` (text) - For uploaded files
- `status` (text) - 'queued' | 'processing' | 'completed' | 'error'
- `extracted_data` (jsonb) - Full menu structure
- `error_message` (text)
- `claimed_at` (timestamp)
- `attempts` (integer)

**Written By:**
- menu-extract-v2 (creates + updates)
- queue-menu-upload-v2 (creates)
- menu-ocr-worker (updates)

**Read By:**
- MenuPage.tsx (via Realtime subscription)
- menu-ocr-worker (polls for queued jobs)

---

## 🔧 Current Architecture Flow

### Direct URL Extraction (html/mealo/iframe_platform)
```
MenuPage.tsx (detect)
  ↓ POST
detect-menus
  ↓ returns detectedSources with source_kind
MenuPage.tsx (shows in detectedUrls)
  ↓ User clicks "Tilføj valgte" or adds manual URL
MenuPage.tsx (handleExtractSelected / handleAddManualUrl)
  ↓ Upserts to menu_sources with source_kind
  ↓ POST
menu-extract-v2
  ↓ Creates menu_results_v2 with status='queued'
  ↓ (if small HTML/PDF) Processes immediately → status='completed'
  ↓ (if complex) Delegates to Cloud Run worker
menu-ocr-worker (polling)
  ↓ Claims job via claim_menu_result_v2()
  ↓ Processes with Puppeteer/OCR
  ↓ Updates menu_results_v2 with extracted_data
MenuPage.tsx (Realtime subscription)
  ↓ Receives update, displays menu card
```

### PDF/JPG Upload Flow
```
MenuPage.tsx (handleUploadFile)
  ↓ POST with FormData
queue-menu-upload-v2
  ↓ Stores file in menu-files bucket
  ↓ Creates menu_sources entry (source_kind='pdf'|'image')
  ↓ Creates menu_results_v2 entry (status='queued')
  ↓ Calls triggerMenuWorkerOnce() ❌ NOT CONFIGURED
menu-ocr-worker (polling) ❌ NOT PICKING UP JOB
  ↓ Should claim job via claim_menu_result_v2()
  ↓ Should process PDF with OCR
  ↓ Should update menu_results_v2 with extracted_data
MenuPage.tsx (Realtime subscription)
  ↓ Waits indefinitely... 🔴 STUCK HERE
```

---

## 🚨 Current Problem

**Symptom:** PDF upload creates menu_sources and menu_results_v2 entries successfully, but extraction never completes.

**Root Cause:** Cloud Run worker not processing queued jobs because:
1. `MENU_OCR_WORKER_TRIGGER_ON_ENQUEUE` env var not set in queue-menu-upload-v2
2. Cloud Run worker may have scaled to zero and not waking up
3. Scheduled polling may not be configured or is failing

**Affected Job:**
- `source_id`: 06f07e0d-6986-4c32-a51d-3e92abf8e503
- `result_id`: b9ec55b8-f82f-48cc-8a15-adaa33c93d14
- `status`: 'queued' (stuck for 5+ minutes)

---

## 💡 Solution Options

### Option A: Configure Cloud Run Worker Trigger
**Pros:** Matches intended architecture, async processing  
**Cons:** Requires infrastructure configuration, Cloud Run billing  
**Steps:**
1. Set environment variables in queue-menu-upload-v2 and menu-extract-v2:
   - `MENU_OCR_WORKER_URL`
   - `MENU_OCR_WORKER_TOKEN`
   - `MENU_OCR_WORKER_GCP_SA_JSON`
   - `MENU_OCR_WORKER_TRIGGER_ON_ENQUEUE='true'`
2. Verify Cloud Run worker is deployed and accessible
3. Test with manual trigger

### Option B: Call menu-extract-v2 Directly for Uploads
**Pros:** Reuses existing Edge function, no Cloud Run needed for small files  
**Cons:** Edge function has execution time limits (25s on Pro plan)  
**Steps:**
1. Modify queue-menu-upload-v2 to call menu-extract-v2 instead of queueing
2. Pass storage URL to menu-extract-v2
3. menu-extract-v2 handles PDF extraction internally (fast-path ≤5 MB)
4. Delegates to Cloud Run only for large files

### Option C: Hybrid Approach
**Pros:** Best of both worlds  
**Cons:** More complex  
**Steps:**
1. Small PDFs/images (<2 MB): Call menu-extract-v2 directly
2. Large files: Queue for Cloud Run worker with proper trigger

---

## 📝 Recommendation

**For immediate fix:** Option B (call menu-extract-v2 directly)  
**Reason:** Simpler, no infrastructure dependencies, reuses proven code

**For production:** Option C (hybrid approach)  
**Reason:** Handles all file sizes efficiently

**Next Step:** Decide which option to implement, then proceed with changes.
