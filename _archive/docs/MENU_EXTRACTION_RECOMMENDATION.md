# Menu Extraction — Assessment & Recommended Implementation Plan (2025-12-18)

## Executive Summary
Your current menu extraction is split across **three partially overlapping pipelines** (Tika-based sync extraction, an async `menu_results` queue + Cloud Run OCR worker, and a URL/Upload “fallback” extractor). The core issue isn’t Supabase — it’s **text-extraction quality and reading order** for real-world menus (multi-column, tables, stylized typography, scanned PDFs), which then makes LLM parsing unreliable.

**Recommendation:** keep Supabase as the orchestration layer (auth, storage, job tracking, realtime UI updates), but replace the “OCR + layout understanding” layer with a modern document OCR service (best fit on GCP: **Google Document AI OCR**). Use a **tiered, multi-stage pipeline**:

1) Cheap & fast extraction for digital PDFs (PyMuPDF text)  
2) Document AI OCR for scans / complex layouts (keeps reading order + structure)  
3) LLM parsing to your JSON schema (default `gpt-4o-mini`, escalate to `gpt-4o` only when needed)  
4) Optional vision-based rescue only for hard pages

This yields higher robustness while controlling cost via **fallback escalation** and **caching**.

## Current State (From Repo)
### Pipelines observed
- **Async “queue” design (good idea):** `menu_results` table + Realtime subscription in the frontend.
- **Cloud Run worker (currently inconsistent/buggy):** the worker queries `menu_results` rows but the processing function expects PGMQ-like payload fields (and still calls `pgmq_pop`). This looks like it will error and/or double-ack incorrectly.
- **Edge Function Tika extraction:** `upload-pdf` uses a Cloud Run Tika endpoint and then parses into JSON (`business_documents.extracted_json`).
- **Fallback “extract-menu-url” / “extract-menu-pdf”:** returns raw extracted text to populate a description field (useful fallback, but not robust extraction/structuring).

### Root causes of quality issues
- **Tika is not a layout engine.** It often loses reading order for multi-column/table menus.
- **Tesseract OCR is fragile** for stylized menus (kerning, rotation, low contrast) and doesn’t produce reliable layout/reading order. Even “perfect OCR text” is not guaranteed.
- **LLM parsing quality is bounded by extraction quality.** Better prompts help (you already have strong prompts), but won’t fix scrambled input.

## Best Target Solution
### Architecture (high level)
- **Supabase Edge Function**: validates auth, normalizes source (URL vs upload), stores PDF (if needed), creates an extraction job row.
- **Job table**: use `menu_results` or a new `document_jobs` table with retries, progress, and artifact metadata.
- **Cloud Run “document extraction” worker** (Python): downloads the PDF, runs staged extraction and parsing, writes results back.
- **Realtime updates**: frontend subscribes to job row updates.

### Extraction strategy (cost + robustness)
1. **Detect PDF type**
   - Attempt PyMuPDF text extraction per page.
   - Compute a “text density” heuristic: chars per page, number of glyphs, etc.
   - If text density is high: treat as digital PDF.

2. **Digital PDF path (cheap)**
   - Use PyMuPDF text blocks (not just `get_text()`), preserve line breaks.
   - Run your existing language OCR-correction layer only if needed (usually less needed for digital PDFs).

3. **Scanned / complex PDF path (robust)**
  - Use **Google Document AI OCR** (or equivalent) as a *gated fallback* to extract:
     - text,
     - layout blocks,
     - reading order.
   - Reconstruct text in the reading order into a stable “menu-text” form.

**Cost-control gates (recommended defaults):**
- Run DocAI only when digital extraction has low text density (e.g., average < ~250 chars/page) or the first parse yields empty/low-quality JSON.
- Cap processing per document (e.g., 12 pages max; most menus are 3–4 pages).
- Cache by PDF hash to avoid re-processing the same menu.

4. **LLM parsing to JSON (structured output)**
   - Use `response_format: { type: 'json_object' }` (already used in parts of the repo).
   - Default to `gpt-4o-mini` and escalate to `gpt-4o` only if:
     - parse yields empty categories/items,
     - confidence heuristics are low,
     - or OCR indicates complex layout.

5. **Vision-based rescue (optional, only on failures)**
   - For a small percentage of PDFs, use LLM vision per page image.
   - This is expensive; use only when OCR/layout fails.

### Data model recommendation
Keep **one canonical structured output** for the rest of the product:
- `business_documents.extracted_json` (already present) as the canonical menu JSON for content generation.

Store supporting artifacts for debugging and re-processing:
- extracted raw text,
- extractor type (`pymupdf_text`, `docai_ocr`, `vision`),
- page count, processing time,
- confidence/quality metrics,
- a content hash for caching.

## Implementation Plan (Phased)
### Phase 0 — Align & de-risk (1–2 days)
- Decide the single canonical pipeline output (recommend: `business_documents.extracted_json`).
- Decide whether `menu_results` remains the job table or you introduce a dedicated `document_jobs`.
- Add a clear “job status contract” (`queued|processing|done|error`) and a minimal retry policy.

### Phase 1 — Fix + consolidate async job processing (1–3 days)
- Make the Cloud Run worker consistent with the queue mechanism:
  - either **table polling** (recommended) with row-level locking/claiming,
  - or real PGMQ (only if you truly need it).
- Ensure the worker updates job rows with:
  - `status`, `progress`, `error_message`, `processing_time_ms`, `extraction_method`.
- Frontend continues subscribing via Realtime.

### Phase 2 — Replace OCR extraction engine (3–7 days)
- Implement Document AI OCR integration inside the worker.
- Add staged extraction logic:
  - try PyMuPDF first,
  - fallback to Document AI.
- Keep existing OCR correction dictionaries as a post-process step (but they should become less critical).

### Phase 3 — Standardize parsing + validation (2–5 days)
- Unify parsing to a single JSON schema (categories/items/prices/dietary).
- Add validation + auto-retry:
  - If JSON is invalid or empty → retry with upgraded extraction or model.
- Add dedup/caching:
  - hash PDF bytes or URL + last-modified/etag when possible.

### Phase 4 — URL menus (2–5 days)
- For HTML menus:
  - improve extraction with a readability extractor (Python) and better cleaning.
  - detect PDF links and enqueue PDFs.
- Optional: JS-rendered pages via Playwright only for paid tiers.

## Operational Notes
- **Cost control:** staged fallbacks, per-tier escalations, caching, and short-circuiting on repeats.
- **Observability:** store a small sample of raw text + metrics per job; keep full raw text gated to admin/debug.
- **Security:** ensure all fetches are SSRF-safe (allowlist domains or block private IP ranges), and store PDFs in Supabase Storage with signed URLs.

## Implementation Checklist (repo changes already prepared)
### Database
- Apply migration [supabase/migrations/020_menu_results_v2.sql](supabase/migrations/020_menu_results_v2.sql) (adds `source_type`, storage refs, `language_code`, `pdf_sha256`, and `claim_menu_result()` RPC).
- Ensure [supabase/migrations/004_add_extracted_json.sql](supabase/migrations/004_add_extracted_json.sql) has been applied (required for `business_documents.extracted_json`).

### Edge Functions
- Deploy URL enqueue: [supabase/functions/extract-menu-pdf/index.ts](supabase/functions/extract-menu-pdf/index.ts)
- Deploy upload enqueue: [supabase/functions/queue-menu-upload/index.ts](supabase/functions/queue-menu-upload/index.ts)

### Cloud Run Worker
- Update deps: [cloud-run-workers/menu-ocr-worker/requirements.txt](cloud-run-workers/menu-ocr-worker/requirements.txt) includes `google-cloud-documentai`.
- Worker implementation: [cloud-run-workers/menu-ocr-worker/main.py](cloud-run-workers/menu-ocr-worker/main.py)

**Required env vars**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

**Optional (Document AI OCR fallback)**
- `DOCAI_ENABLED=true|false` (default true)
- `GOOGLE_CLOUD_PROJECT`
- `DOCAI_LOCATION` (e.g. `eu` or `us` depending on your processor)
- `DOCAI_PROCESSOR_ID`

**Cost-control knobs (optional)**
- `MIN_CHARS_PER_PAGE_FOR_DIGITAL` (default 250)
- `MIN_TOTAL_CHARS_FOR_DIGITAL` (default 800)
- `MAX_PAGES_TO_PROCESS` (default 12)

### Languages
- Jobs can carry `language_code` (defaults to `da`). For English menus, enqueue with `languageCode: "en-US"`.

## Open Questions (to finalize “best solution”)
1) Languages: start with Danish + English (US), then expand (Swedish, Norwegian, Dutch, French, English UK, ...).
2) PDFs: average 3–4 pages; preliminary mix suggests ~75–85% digital and ~15–25% scanned.
3) Cost per extraction targets by tier (free/paid)?
4) Are menus mostly PDFs, or mostly HTML pages with PDFs embedded?
5) Retention: menus must be stored; downstream needs the extracted result (JSON/text).
