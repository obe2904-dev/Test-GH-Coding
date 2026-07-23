# Dashboard Profile Edge Functions

## Scope

This note documents the edge functions used by `/dashboard/profile`, what each function does, how the page calls it, and which database tables it owns.

The direct edge-function callers from [src/pages/dashboard/BusinessProfilePage.tsx](src/pages/dashboard/BusinessProfilePage.tsx) are:

- `analyze-and-distribute-website`
- `start-scrape-job`
- `extract-from-scrape`

The related recovery path is:

- `scrape-webhook`

The adjacent V5 brand-profile generator is:

- `brand-profile-generator-v5`

## Call Graph From The Page

The page uses three flows:

1. Main analysis flow: `handleAnalyzeWebsite()` calls `analyze-and-distribute-website`.
2. Scrape-only debug flow: `handleScrapeOnly()` calls `start-scrape-job`.
3. Extract-only debug flow: `handleExtractAndSave()` calls `extract-from-scrape`.

The page does not call `scrape-webhook` directly. That function is part of the backend completion path when scraping is driven outside the synchronous wrapper.

## `analyze-and-distribute-website`

File: [supabase/functions/analyze-and-distribute-website/index.ts](supabase/functions/analyze-and-distribute-website/index.ts)

### Purpose

This is the main one-click website analysis orchestrator. It combines auth validation, scrape caching, fresh scraping, scrape persistence, extraction, and post-processing.

### What The Page Sends

The page sends:

- `url`
- `force_refresh: true`
- `Authorization: Bearer <session token>`

The page intentionally does not send business-name or business-type hints for this path.

### Request Flow

1. Read JSON body and verify `url` exists.
2. Create a service-role Supabase client with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
3. Validate the bearer token with `supabase.auth.getUser(token)`.
4. Resolve the current user’s business from `businesses` by `owner_id`.
5. If `force_refresh` is false, try to reuse a recent row from `website_scrape_results`.
6. If cache is valid, short-circuit into `extract-from-scrape` and return cached analysis output.
7. If cache is absent or stale, call Cloud Run to scrape the site.
8. Insert the fresh scrape payload into `website_scrape_results`.
9. Call `extract-from-scrape` to distribute structured fields into normalized tables.
10. Update `businesses.website_url` to the analyzed URL.
11. Queue menu enrichment jobs if the scrape produced menu pages.

### Tables Touched

- `businesses`
- `website_scrape_results`
- `scrape_jobs`

### Output Shape

The page expects a JSON response with fields such as:

- `success`
- `scrape_id`
- `quality`
- `cached`
- `duration_ms`
- `extraction_summary`
- `distribution_summary`

### Failure Modes

Typical failures are:

- missing `url`
- missing authorization header
- invalid or expired token
- no business found for the user
- scraper failure
- extraction failure

### Why It Matters

This function is the canonical profile-analysis path. It keeps the page from inventing state locally by forcing the scrape and persistence steps to happen on the server.

## `start-scrape-job`

File: [supabase/functions/start-scrape-job/index.ts](supabase/functions/start-scrape-job/index.ts)

### Purpose

This is the synchronous scrape wrapper used by the debug scrape-only flow. It creates a persistent scrape job row, sends the scrape request to Cloud Run, then writes the completed payload back to the same row.

### What The Page Sends

The page sends:

- `url`
- `force_refresh: true`
- `Authorization: Bearer <session token>`

### Request Flow

1. Read and normalize the URL.
2. Create a service-role Supabase client.
3. Validate the user token.
4. Resolve the user’s business from `businesses`.
5. Look for a recent cached scrape unless `force_refresh` is set.
6. If cache exists, return it immediately.
7. Otherwise insert a new `website_scrape_results` row with a processing payload.
8. Call Cloud Run with the scrape URL and job metadata.
9. Update the inserted row with the returned payload, content quality, and menu source.
10. Return the completed job record to the caller.

### Tables Touched

- `businesses`
- `website_scrape_results`

### Output Shape

The page expects fields such as:

- `success`
- `job_id`
- `status`
- `scraped_at`
- `content_quality`
- `menu_source`
- `payload`

### Failure Modes

Typical failures are:

- missing authorization header
- invalid or expired token
- no business found for the user
- missing Cloud Run credentials
- Cloud Run request failure
- insert or update failure on `website_scrape_results`

### Why It Matters

This is the most conservative scrape path. It ensures the UI only treats a scrape as real after the row exists in `website_scrape_results`.

## `scrape-webhook`

File: [supabase/functions/scrape-webhook/index.ts](supabase/functions/scrape-webhook/index.ts)

### Purpose

This is the completion callback for Cloud Run when scraping is executed asynchronously. It updates the scrape row after the external worker finishes.

### Request Shape

The webhook expects JSON containing:

- `job_id`
- `status`
- `payload`
- `error`

### Request Flow

1. Parse the webhook payload.
2. Create a service-role Supabase client.
3. If `status === 'completed'` and `payload` is present, update the matching `website_scrape_results` row.
4. If `status === 'failed'`, update the same row with failure metadata.
5. Return a JSON success or error response.

### Tables Touched

- `website_scrape_results`

### Output Shape

The webhook returns a small JSON response such as:

- `success`
- `job_id`

### Why It Matters

This is the fallback that keeps the persistent scrape row accurate even when the scrape happens outside the synchronous page-driven path.

## `extract-from-scrape`

File: [supabase/functions/extract-from-scrape/index.ts](supabase/functions/extract-from-scrape/index.ts)

### Purpose

This is the structured extraction and distribution layer. It takes the latest scrape payload for a business and writes the normalized profile data into the database.

### What The Page Sends

The page sends:

- `business_id`
- `Authorization: Bearer <session token>`

### Request Flow

1. Fetch the latest `website_scrape_results` row for the business.
2. Read the scrape payload.
3. Normalize the payload structure.
4. Check content quality and decide whether AI extraction is allowed.
5. Run deterministic tier-1 extraction from explicit payload fields.
6. Run tier-2 keyword extraction for closed-vocabulary signals.
7. Run tier-3 AI extractors only when quality thresholds pass.
8. Build table-specific result buckets.
9. Upsert or update each target table.
10. Return a summary of found, saved, and failed fields.

### Internal Buckets

The extractor distributes data into:

- `business_locations`
- `business_operations`
- `business_profile`
- `businesses`
- `opening_hours`

### Tables Touched

- `website_scrape_results`
- `business_locations`
- `business_operations`
- `business_profile`
- `businesses`
- `opening_hours`

### Output Shape

The response includes:

- `success`
- `scrape_id`
- `business_id`
- `scraped_at`
- `ai_used`
- `quality`
- `extraction`

### Failure Modes

Typical failures are:

- missing `business_id`
- no scrape row found for the business
- empty payload
- low-quality content that skips AI extraction
- table write failures

### Why It Matters

This function is the core bridge from raw crawl data to usable application state. It is where the page’s discovered facts become normalized table rows.

## `brand-profile-generator-v5`

File: [supabase/functions/brand-profile-generator-v5/index.ts](supabase/functions/brand-profile-generator-v5/index.ts)

### Purpose

This is the newer V5 brand-profile generator. It is not called directly from `BusinessProfilePage`, but it owns the long-term brand-intelligence data model used elsewhere in the app.

### What It Writes

It writes the complete V5 profile to `business_brand_profile`, including:

- `brand_profile_v5`
- `brand_profile_v5_generated_at`
- `brand_profile_v5_version`
- `enhanced_social_examples`
- `enhanced_avoid_examples`
- `social_writing_examples`
- `voice_guardrails`
- `business_identity_persona`
- `marketing_manager_brief`
- `commercial_baseline_mode`
- `strategic_audience_segments`
- `strategic_coverage`
- `location_strategy`
- `generation_status`
- `data_sources_used`
- `content_strategy`
- `business_character`

### Why It Matters To The Profile Page

The page still reads `business_character` and `booking_link`, but the richer system now lives here. That means `/dashboard/profile` is partly a legacy bridge and partly a manual control surface for the newer V5 architecture.

## Shared Ownership Rules

1. Raw crawl state belongs in `website_scrape_results`.
2. Profile distribution belongs in `extract-from-scrape`.
3. One-click orchestration belongs in `analyze-and-distribute-website`.
4. Sync scrape debugging belongs in `start-scrape-job`.
5. Asynchronous scraper completion belongs in `scrape-webhook`.
6. Long-term brand intelligence belongs in `brand-profile-generator-v5` and the `business_brand_profile` V5 columns.

## Practical Read Order

If you are tracing a profile bug, read the edge functions in this order:

1. `analyze-and-distribute-website`
2. `extract-from-scrape`
3. `start-scrape-job`
4. `scrape-webhook`
5. `brand-profile-generator-v5`

That order matches the profile page’s actual user-facing flow.