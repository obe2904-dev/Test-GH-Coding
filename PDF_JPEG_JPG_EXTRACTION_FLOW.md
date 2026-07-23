# PDF/JPEG/JPG Extraction Flow

## Scope
This document maps the current upload flow for PDF, JPEG, JPG, and PNG menu files from the dashboard button to storage, extraction, and dashboard rendering.

It covers:
- the UI entry point in the dashboard
- the upload Edge Function
- the extraction Edge Function
- the database tables involved
- the realtime read-back path used by the UI

## Short Version

```text
MenuPage.tsx upload form
  -> queue-menu-upload-v2
    -> Supabase Storage: menu-files
    -> business_documents
    -> menu_sources
    -> menu-extract-v2
      -> menu_results_v2
      -> OCR / PDF parsing / structured menu data
  -> MenuPage.tsx reloads and subscribes to menu_results_v2
```

Important correction:
- The file itself is stored in Supabase Storage, not in a Postgres table.
- The database stores metadata and extraction results.

## 0. Related Code Surfaces

These are the main code files that participate in the menu system around uploads and extraction:

- [src/pages/dashboard/MenuPage.tsx](src/pages/dashboard/MenuPage.tsx) - dashboard UI, upload form, extraction subscription, card loading
- [src/pages/dashboard/businessProfile/components/hooks/useMenuHandlers.ts](src/pages/dashboard/businessProfile/components/hooks/useMenuHandlers.ts) - alternate direct URL extraction flow used in business profile tooling
- [supabase/functions/detect-menus/index.ts](supabase/functions/detect-menus/index.ts) - detects candidate menu URLs and classifies them with `source_kind`
- [supabase/functions/queue-menu-upload-v2/index.ts](supabase/functions/queue-menu-upload-v2/index.ts) - upload ingestion for PDF/JPG/JPEG/PNG
- [supabase/functions/menu-extract-v2/index.ts](supabase/functions/menu-extract-v2/index.ts) - unified extraction engine for URLs, images, and PDFs

The PDF/JPG upload path uses `MenuPage.tsx` -> `queue-menu-upload-v2` -> `menu-extract-v2`.
The direct URL path uses `detect-menus` and then either `MenuPage.tsx` or `useMenuHandlers.ts` to call `menu-extract-v2`.

## 1. UI Entry Point

### File
- [src/pages/dashboard/MenuPage.tsx](src/pages/dashboard/MenuPage.tsx)

### Relevant sections
- Upload panel markup: around line 1748
- File upload handler: around line 1038
- Dashboard data loading and job subscription: around line 250 and line 560

### What the UI does
The upload section labeled "Upload PDF eller JPG" lets the user:
- choose one or more files
- enter a menu headline
- optionally set service time values in the current UI
- start the upload

`handleUploadFile()` is the main client-side entry point. It:
- verifies there is a logged-in session
- validates the selected files
- checks file size against a 10 MB limit
- allows PDF, JPEG, JPG, and PNG files
- sends each file as `FormData` to `queue-menu-upload-v2`
- creates placeholder cards while extraction is running
- reloads menu cards after upload

### UI-to-function request payload
The frontend sends:
- `file`
- `businessId`
- `languageCode`
- `fileName`
- `menuHeadline`

### UI states
The upload handler uses:
- `isUploadingFile` to show upload progress
- `setError(...)` for validation and failure messages
- `showToastNotification(...)` for success feedback
- `setProcessingUploads(...)` to show placeholder cards

## 2. Upload Edge Function

### File
- [supabase/functions/queue-menu-upload-v2/index.ts](supabase/functions/queue-menu-upload-v2/index.ts)

### Purpose
This function is the actual ingestion point for PDF/JPG/JPEG/PNG uploads.

It is responsible for:
- authentication and authorization
- byte-level file type detection
- storage in `menu-files`
- metadata writes to `business_documents`
- source registration in `menu_sources`
- direct delegation to `menu-extract-v2`

### Step-by-step behavior

#### 2.1 Validate request and auth
The function:
- checks for `POST`
- validates the `Authorization` header
- verifies the user session
- verifies access to the business

#### 2.2 Read and validate the uploaded file
It parses the multipart form and reads:
- `file`
- `businessId`
- `languageCode`
- `fileName`
- `menuHeadline`
- optional `servicePeriod`

It then:
- rejects empty files
- rejects files over 10 MB
- detects the actual file type from magic bytes

Detected kinds:
- `pdf`
- `jpeg`
- `png`

The code deliberately does not trust the extension alone.

#### 2.3 Normalize the file name
The function sanitizes the uploaded name and forces the extension to match the detected kind.
That matters because the downstream extraction logic also uses the URL extension as a routing signal.

#### 2.4 Store the file in Supabase Storage
The file is uploaded to:
- bucket: `menu-files`
- path: `businessId/<uuid>_<filename>`

This is the only place where the actual file bytes are stored.

#### 2.5 Write canonical file metadata
The function upserts a row in `business_documents` with:
- `business_id`
- `document_type = 'menu'`
- `file_name`
- `storage_path`
- `public_url`
- `file_size`
- timestamps

This row is metadata only. It is not the file blob itself.

#### 2.6 Register the source in `menu_sources`
The function upserts a row with:
- `source_url = publicUrl`
- `normalized_url = publicUrl`
- `source_type = 'pdf'` for PDFs, `url` for images
- `source_kind = 'pdf'` or `image`
- `source_origin = 'manual_added'`
- `status = 'pending'`
- `menu_type = 'standard'`
- `file_name`
- `label`
- `created_by`

This gives uploads the same source-driven structure as URL-based menus.

#### 2.7 Call `menu-extract-v2`
The function then POSTs directly to `menu-extract-v2` with:
- `businessId`
- `sourceId`
- `url` pointing at the public Storage URL
- `languageCode`
- optional `servicePeriod`

If the extraction call fails, the source row is updated to:
- `status = 'error'`
- `error_message = ...`

The upload still remains stored in `menu-files` and tracked in `business_documents`.

### Important schema detail
- `source_type` is a legacy field and only accepts `url` or `pdf`.
- `source_kind` is the newer classifier that distinguishes uploaded file kinds.

## 3. Extraction Edge Function

### File
- [supabase/functions/menu-extract-v2/index.ts](supabase/functions/menu-extract-v2/index.ts)

### Purpose
This is the unified extraction engine that turns a source URL into a menu result.

For upload flow, the URL is the public Storage URL created by `queue-menu-upload-v2`.

### Step-by-step behavior

#### 3.1 Auth and business checks
The function accepts both normal user-token invocations and service-role invocations.

It verifies:
- `businessId`
- source URL or manual text
- business access, unless a service-role call is allowed

#### 3.2 Create the job row
It inserts a row in `menu_results_v2` with:
- `business_id`
- `source_id`
- `source_url`
- `status = 'queued'`
- `language_code`
- fields for storage metadata when relevant

This row is what the UI subscribes to.

#### 3.3 Probe the source content
The function fetches the URL and determines whether the content is:
- image
- PDF
- HTML or other web content

It uses both headers and magic-byte checks.

#### 3.4 Image path
If the content is an image:
- the image is downloaded
- Google Vision OCR is run directly in the function
- the OCR text is parsed with OpenAI
- structured menu data is generated
- the result row is updated to `done`

It also stores:
- `raw_text`
- `structured_data`
- `extraction_method = 'edge_ocr'`
- derived classification fields

If OCR fails, the result row is marked `error`.

#### 3.5 PDF path
If the content is a PDF:
- a fast path is attempted for smaller files using Docling plus OpenAI
- if that fails or the file is larger, a slower Docling-based path is used

The PDF path updates `menu_results_v2` with:
- `structured_data`
- `raw_text` where applicable
- `service_periods`
- `service_period_name`
- `menu_type`
- `time_start`
- `time_end`
- `time_source`
- `time_confirmed`
- `extraction_method`

The result is finalized as `done` when successful.

#### 3.6 Result synchronization
After extraction, the function also synchronizes normalized items and may update business-level metadata such as establishment type.

## 3.7 Direct URL flow that feeds the same extraction engine

The PDF/JPG upload path is not the only way a menu reaches extraction.
The same `menu-extract-v2` function is also used by direct URL flows.

### `detect-menus`

#### File
- [supabase/functions/detect-menus/index.ts](supabase/functions/detect-menus/index.ts)

#### Purpose
This function scans a business website for candidate menu URLs and classifies them.

#### What it returns
- legacy `detectedMenuUrls` string array
- richer `detectedSources` objects with `url`, `source_kind`, and `label`

#### `source_kind` values it can emit
- `html`
- `pdf`
- `image`
- `mealo`
- `iframe_platform`

#### Why it matters here
`detect-menus` feeds the same source model used by uploads, so the dashboard can route a discovered menu URL into the same extraction engine.

### `useMenuHandlers.ts`

#### File
- [src/pages/dashboard/businessProfile/components/hooks/useMenuHandlers.ts](src/pages/dashboard/businessProfile/components/hooks/useMenuHandlers.ts)

#### Purpose
This hook is an alternate direct URL extraction entry point used in the business profile tooling.

#### Relevant behavior
- posts a URL directly to `menu-extract-v2`
- waits for `menu_results_v2` updates via realtime subscription
- writes extracted data into `menu_extractions`

This is adjacent to the upload flow, not part of the file upload path itself, but it uses the same extraction backend.

## 4. Database Tables Involved

### `menu-files` Storage bucket
This is not a Postgres table. It is the storage location for the uploaded PDF or image bytes.

### `business_documents`
Path in code:
- [supabase/functions/queue-menu-upload-v2/index.ts](supabase/functions/queue-menu-upload-v2/index.ts)

Purpose:
- canonical record for uploaded documents
- survives even if extraction fails later

Important fields written by the upload function:
- `business_id`
- `document_type`
- `file_name`
- `storage_path`
- `public_url`
- `file_size`

### `menu_sources`
Path in code:
- [supabase/functions/queue-menu-upload-v2/index.ts](supabase/functions/queue-menu-upload-v2/index.ts)
- [src/pages/dashboard/MenuPage.tsx](src/pages/dashboard/MenuPage.tsx)

Purpose:
- source registry for URLs and uploads
- stable source identity for extraction jobs

Important fields:
- `source_url`
- `normalized_url`
- `source_type`
- `source_kind`
- `source_origin`
- `status`
- `error_message`
- `file_name`
- `label`
- `menu_type`
- `created_by`

### `menu_results_v2`
Path in code:
- [supabase/functions/menu-extract-v2/index.ts](supabase/functions/menu-extract-v2/index.ts)
- [src/pages/dashboard/MenuPage.tsx](src/pages/dashboard/MenuPage.tsx)

Purpose:
- job tracking table
- final extraction output table

Important fields:
- `business_id`
- `source_id`
- `source_url`
- `source_kind`
- `status`
- `attempts`
- `claimed_at`
- `completed_at`
- `extraction_method`
- `raw_text`
- `structured_data`
- `error_message`
- `service_periods`
- `service_period_name`
- `menu_type`
- `time_start`
- `time_end`
- `time_source`
- `time_confirmed`

## 5. Dashboard Read-Back Path

### File
- [src/pages/dashboard/MenuPage.tsx](src/pages/dashboard/MenuPage.tsx)

### What it does
The dashboard reloads sources and results, then merges them into cards.

#### `loadMenuCards()`
This function:
- loads rows from `menu_sources`
- loads rows from `menu_results_v2`
- maps results by `source_id`
- falls back to URL matching only for legacy rows
- derives card status from result status

#### Realtime subscription
When an extraction starts, the UI subscribes to updates on `menu_results_v2` using `postgres_changes`.

When the row changes:
- `queued` or `processing` becomes `extracting`
- `done` or `completed` becomes `extracted`
- `failed` or `error` becomes `error`

This is how the dashboard updates without a full page refresh.

## 6. Status Mapping

The UI reads result state from `menu_results_v2.status` and `menu_sources.status`.

Mapping used in the dashboard:
- `queued` -> `extracting`
- `processing` -> `extracting`
- `done` -> `extracted`
- `completed` -> `extracted`
- `failed` -> `error`
- `error` -> `error`
- no result -> `pending`

## 7. End-to-End Sequence

```text
1. User opens Dashboard -> MenuPage.tsx
2. User selects PDF/JPG/JPEG/PNG file
3. handleUploadFile() validates file and session
4. Browser POSTs FormData to queue-menu-upload-v2
5. queue-menu-upload-v2 checks auth and business access
6. queue-menu-upload-v2 detects file kind from bytes
7. queue-menu-upload-v2 uploads bytes to Supabase Storage bucket menu-files
8. queue-menu-upload-v2 writes business_documents metadata
9. queue-menu-upload-v2 writes menu_sources row
10. queue-menu-upload-v2 calls menu-extract-v2 with the public storage URL
11. menu-extract-v2 inserts menu_results_v2 job row
12. menu-extract-v2 probes URL and routes to image or PDF logic
13. menu-extract-v2 performs OCR or PDF parsing
14. menu-extract-v2 writes structured_data and final status to menu_results_v2
15. MenuPage.tsx reloads and/or receives realtime update
16. UI card changes from extracting to extracted or error
```

## 8. Legacy or Non-Primary Functions

These files exist in the repo but are not the main path for the current upload flow:
- [supabase/functions/detect-menus/index.ts](supabase/functions/detect-menus/index.ts)
- [supabase/functions/ocr-menu/index.ts](supabase/functions/ocr-menu/index.ts)
- [supabase/functions/scrape-menu/index.ts](supabase/functions/scrape-menu/index.ts)
- [supabase/functions/parse-menu-text/index.ts](supabase/functions/parse-menu-text/index.ts)
- [supabase/functions/persist-menu-extraction/index.ts](supabase/functions/persist-menu-extraction/index.ts)
- [supabase/functions/download-menu-pdf/index.ts](supabase/functions/download-menu-pdf/index.ts)
- [supabase/functions/extract-pdf-text/index.ts](supabase/functions/extract-pdf-text/index.ts)

## 8.1 Full Edge Function Inventory

### Active in the current menu system
- `detect-menus` - finds candidate menu URLs and classifies them
- `queue-menu-upload-v2` - ingests uploaded PDF/JPG/JPEG/PNG files
- `menu-extract-v2` - performs extraction for URLs, PDFs, and images

### Present but not the primary current path
- `ocr-menu` - older OCR wrapper
- `scrape-menu` - older scraping proxy
- `parse-menu-text` - older text parsing helper
- `persist-menu-extraction` - older persistence layer
- `download-menu-pdf` - file download helper for PDF sources
- `extract-pdf-text` - PDF text extraction helper

### External or adjacent systems referenced by the current code
- Cloud Run worker used by `menu-extract-v2` for some routing cases
- Supabase Storage bucket `menu-files`
- `menu_results_v2` realtime subscription used by the UI

## 9. Key Implementation Notes

- The file bytes are stored in Supabase Storage, not directly in Postgres.
- `menu_sources` is the source registry.
- `menu_results_v2` is the job and result table.
- `source_kind` is the main classifier for uploaded file type.
- `source_type` remains a legacy compatibility field.
- The current upload path does not depend on the old Cloud Run worker queue for the main PDF/JPG flow.

## 10. Practical Summary

If you are tracing a PDF/JPG upload in code, the important files are:
- [src/pages/dashboard/MenuPage.tsx](src/pages/dashboard/MenuPage.tsx)
- [supabase/functions/queue-menu-upload-v2/index.ts](supabase/functions/queue-menu-upload-v2/index.ts)
- [supabase/functions/menu-extract-v2/index.ts](supabase/functions/menu-extract-v2/index.ts)

If you are tracing the direct URL detection path that feeds the same backend, also include:
- [supabase/functions/detect-menus/index.ts](supabase/functions/detect-menus/index.ts)
- [src/pages/dashboard/businessProfile/components/hooks/useMenuHandlers.ts](src/pages/dashboard/businessProfile/components/hooks/useMenuHandlers.ts)

If you are tracing persisted data, the important places are:
- `menu-files` Storage bucket
- `business_documents`
- `menu_sources`
- `menu_results_v2`
