# Dashboard Profile End-to-End Map

## Scope

This document maps the `/dashboard/profile` screen end to end: route entry, UI reads, manual saves, analysis flows, edge functions, and the database state each step owns.

## Route Entry

The route is registered in [src/App.tsx](src/App.tsx#L60) and rendered at [src/App.tsx](src/App.tsx#L208). The page implementation is [src/pages/dashboard/BusinessProfilePage.tsx](src/pages/dashboard/BusinessProfilePage.tsx#L52).

The page is also linked from the sidebar, top bar, dashboard overview, menu page, location page, and setup flows, so it acts as a central setup hub rather than an isolated profile form.

## What The Page Does

`BusinessProfilePage` is a multi-purpose editor. It:

1. Loads the selected business for the signed-in user.
2. Pulls together business identity, location, profile, brand, opening hours, and operations data.
3. Allows manual edits and persistence back to Supabase.
4. Launches website analysis and scrape/extract pipelines.
5. Reconciles AI-derived data with the user-editable fields on the page.

## Component Internals

The page is built as a stateful orchestration component rather than a thin form.

### State Blocks

It keeps separate state for:

- business identity, contact, and location fields
- manual opening-hours editing
- service model flags
- menu-derived highlights and descriptions
- website analysis lifecycle state
- saved snapshot versus current edits
- multi-business selection and business ID resolution

That separation matters because analysis and manual editing happen in parallel. A field can be loaded from the database, changed by website analysis, and still remain unsaved until the user confirms it.

### Helper Functions

Three local helpers control the editable form lifecycle:

- `buildStateSnapshot()` captures the editable core fields into a single object.
- `applyState()` hydrates the React state from a saved snapshot.
- `syncSavedSnapshot()` stores the current snapshot and clears the unsaved flag.

These are what let the page implement revert, change detection, and "saved vs dirty" status without relying on a form library.

### Opening Hours Shape

The page keeps opening hours in a Danish weekday map (`man`, `tir`, `ons`, `tor`, `fre`, `lør`, `søn`) and normalizes the manual `extraWindows` format separately. This is important because the database stores `opening_hours` as rows while the UI edits a grouped schedule.

### Menu Extraction State

The `menuHighlights`, `menuDescription`, and `menuProgrammes` state is derived from `business_profile.menu_signal` first, then `business_profile.menu_structure`. In other words, the UI does not invent menu intelligence; it renders the analysis result back into a human-editable summary.

## Code Inventory

This section lists the concrete code pieces used by the page and the edge functions it drives.

### Imports In `BusinessProfilePage`

- React hooks: `useEffect`, `useState`
- i18n: `useTranslation`
- Supabase client: `supabase`
- Stores: `useConnectionsStore`, `useTierStore`, `useBusinessStore`
- UX guard: `useUnsavedChangesPrompt`
- UI components and helpers: `AnalyzeIcon`, `BusinessSelector`, `QuarterHourTimePicker`, `guessBusinessSector`, `getPrimaryType`, `getBusinessTypeLabel`, `enrichKeyOfferings`

### Local Types And Constants

- `DEFAULT_COUNTRY`
- `ProfileFormState`
- `createDefaultState()`
- `DaySchedule`
- `ManualWindow`
- `ManualDaySchedule`
- `WeekSchedule`
- `DayKey`
- `ManualWeekSchedule`
- `createEmptySchedule()`
- `createEmptyManualDay()`
- `createEmptyManualSchedule()`
- `normalizeManualSchedule()`
- `serializeManualSchedule()`

### Form State Variables

Core editable values:

- `websiteUrl`
- `businessName`
- `businessSector`
- `businessCategory`
- `aboutText`
- `phone`
- `email`
- `address`
- `postalCode`
- `city`
- `country`
- `bookingLink`
- `logoUrl`
- `keyOfferings`
- `localLocationReference`

UI and analysis state:

- `isAnalyzing`
- `analysisCompleted`
- `analysisAttempts`
- `justSaved`
- `hasUnsavedChanges`
- `isLoadingProfile`
- `savedState`
- `businessId`

Collapsible panels:

- `isEditingBasics`
- `isEditingLocation`
- `isEditingContact`
- `isEditingKeyOfferings`
- `_isEditingAbout`
- `_isEditingHours`
- `_isEditingMenu`
- `_newMenuItem`
- `_isEditingService`

Website scrape/extract state:

- `isScraping`
- `isExtracting`
- `extractStage`
- `scrapeResult`
- `extractResult`
- `scrapeError`
- `extractError`
- `showRawScrapeData`
- `showRawExtractData`

Menu and brand state:

- `menuHighlights`
- `menuDescription`
- `menuProgrammes`
- `businessCharacter`
- `isEditingCharacter`
- `isGeneratingCharacter`

Opening hours and operations state:

- `openingHours`
- `manualHours`
- `openingHoursReview`
- `hasTableService`
- `hasTakeaway`
- `hasDelivery`
- `hasOutdoorSeating`
- `hasWifi`
- `hasPowerOutlets`
- `hasParking`
- `reservationRequired`
- `hasKidsMenu`
- `kitchenCloseTime`
- `weeklyProgramme`

### Local State Helpers

- `markUnsaved()` marks the form dirty.
- `buildStateSnapshot()` snapshots the editable fields.
- `applyState(state)` rehydrates the form from a saved snapshot.
- `syncSavedSnapshot(state)` stores a snapshot and clears the dirty flag.

These helpers are what make revert and dirty-state tracking work without a dedicated form manager.

### Effects

- A `useEffect` runs `loadPlatformsFromDatabase()` once after mount.
- A second `useEffect` loads the full profile graph whenever `selectedBusinessId` changes.

The business-load effect is the core data bootstrap path. It resolves the user, selects the business, loads all related rows, and then synchronizes the UI state.

### Event Handlers

- `handleBusinessSelect(businessId)` updates the selected business and closes the selector.
- `handleWebsiteAnalysis(forceRefresh = false)` launches the website analysis path and applies returned fields to local state.
- `handleScrapeOnly()` runs the scrape-only debug path through `start-scrape-job`.
- `handleExtractAndSave()` runs the extract-only debug path through `extract-from-scrape`.
- `handleAnalyzeWebsite()` runs the unified scrape → analyze → distribute path.
- `handleSaveProfile(overrideValues?)` persists the manual edits back to Supabase.
- `handleGenerateBusinessCharacter()` is intentionally disabled and only warns that V5 owns generation.
- `handleRevertChanges()` restores the last saved snapshot.

### Rendering Sections

The UI is organized into these sections:

- website analysis launcher
- business basics
- about / character editor
- key offerings
- location
- contact
- opening hours
- service model
- kitchen close time
- weekly programme
- save bar
- paid-tier navigation button

Each section is tied to one or more database writes or derived fields. The page is not just displaying data; it is the user’s control surface for the full profile graph.

### Edge-Function Touchpoints From The Page

- `start-scrape-job` for scrape-only debug flow
- `extract-from-scrape` for extract-only debug flow
- `analyze-and-distribute-website` for the main one-click analysis flow

The page uses `fetch` directly against the Supabase functions base URL and passes a bearer auth token from the current session.

### Code Paths Inside `analyze-and-distribute-website`

- `serve(async (req) => { ... })` is the request entry point.
- CORS preflight is handled first with an `OPTIONS` response.
- `url` and `force_refresh` are read from the JSON body.
- The function creates a service-role Supabase client with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- Auth is validated with `supabase.auth.getUser(token)`.
- The business is resolved from `businesses` by `owner_id`.
- Recent cache is read from `website_scrape_results` before any fresh scrape.
- Cached results can short-circuit into `extract-from-scrape`.
- Fresh scraping uses the Cloud Run scraper.
- The scrape payload is inserted into `website_scrape_results`.
- The extraction phase is delegated to `extract-from-scrape`.
- `businesses.website_url` is updated after analysis.
- `scrape_jobs` can be queued for menu enrichment if menu pages were detected.

### Code Paths Inside `start-scrape-job`

- `serve(async (req) => { ... })` is the request entry point.
- URL normalization prepends `https://` when needed and trims whitespace.
- Auth is validated with `supabase.auth.getUser(token)`.
- A `website_scrape_results` row is inserted before calling Cloud Run.
- The Cloud Run response is written back to the same row.
- Failures update the stored job payload to a failed state.

### Code Paths Inside `scrape-webhook`

- `serve(async (req) => { ... })` is the request entry point.
- The webhook receives `job_id`, `status`, `payload`, and `error`.
- A completed webhook updates `website_scrape_results` with the full payload and quality data.
- A failed webhook updates the row payload with failure metadata.

### Code Paths Inside `extract-from-scrape`

- `serve(async (req) => { ... })` is the request entry point.
- The latest `website_scrape_results` row is fetched for the business.
- `extractTier1()` maps direct payload paths to structural fields.
- `extractTier2()` detects closed-vocabulary fields by keyword scan.
- `extractUsingAIExtractors()` runs only when the quality gate allows it.
- `buildBusinessLocations()`, `buildBusinessOperations()`, `buildBusinessProfile()`, `buildBusinesses()`, and `buildOpeningHoursRows()` split the result into table-specific buckets.
- `writeBusinessLocations()`, `writeBusinessOperations()`, `writeBusinessProfile()`, `writeBusinesses()`, and `writeOpeningHours()` persist the buckets.

### UI-Visible Code Outcomes

- Dirty/saved status comes from `hasUnsavedChanges`, `savedState`, and `justSaved`.
- The progress indicator reflects the setup path from profile to menu to location to brand.
- Menu highlights are refreshed after analysis from `business_profile` rather than from transient local analysis state.
- The business selector appears when the user has more than one business and no matching selection is available.

### What Is Legacy Versus What Is Current

- Current page-owned data: business basics, location, contact, opening hours, service model, and limited brand bridge fields.
- Legacy bridge data: `business_character` and `booking_link` in `business_brand_profile`.
- Current analysis store: `business_profile` and `business_operations`.
- Current raw-analysis archive: `website_scrape_results`.
- Current brand intelligence system: `brand_profile_v5` and flattened V5 fields written by the V5 generator.

## Read Path

On mount, the page:

1. Gets the active Supabase user via auth.
2. Loads all `businesses` rows for that owner.
3. If multiple businesses exist, it shows the selector and waits for a choice.
4. Once a business is chosen, it loads the related records.

The main reads are in [src/pages/dashboard/BusinessProfilePage.tsx](src/pages/dashboard/BusinessProfilePage.tsx#L312) through [src/pages/dashboard/BusinessProfilePage.tsx](src/pages/dashboard/BusinessProfilePage.tsx#L463).

### Tables Read By The Page

- `businesses` for the core business row, name, website, type, logo, and local location reference.
- `business_locations` for primary contact and address data.
- `business_profile` for `user_about_text`, `key_offerings`, `booking_url`, `menu_signal`, `menu_structure`, and related website-analysis output.
- `business_brand_profile` for `business_character` and legacy booking link data.
- `website_analyses` for the latest `source_url` only.
- `opening_hours` for the weekly schedule.
- `business_operations` for service-model flags and operational timing.

## Manual Save Path

The save action starts in [src/pages/dashboard/BusinessProfilePage.tsx](src/pages/dashboard/BusinessProfilePage.tsx#L1282).

When the user saves, the page writes to:

- `businesses`: `name`, `website_url`, `logo_url`, `local_location_reference`, and `business_type_hybrid`.
- `business_locations`: the primary contact row, updated or inserted as needed.
- `business_profile`: `user_about_text`, `key_offerings`, and `booking_url`.
- `business_brand_profile`: `booking_link` and `business_character`.
- `opening_hours`: normal hours are deleted and reinserted from the in-memory schedule.
- `business_operations`: flags like table service, takeaway, delivery, seating, Wi-Fi, parking, kids menu, reservation requirements, kitchen close time, and weekly programme.

The save path is the page’s manual source of truth for user-edited data. It does not invoke the V5 generator.

## Website Analysis Path

The main analysis button calls `analyze-and-distribute-website` at [src/pages/dashboard/BusinessProfilePage.tsx](src/pages/dashboard/BusinessProfilePage.tsx#L1149).

There are also two debug flows:

- scrape-only via `start-scrape-job` at [src/pages/dashboard/BusinessProfilePage.tsx](src/pages/dashboard/BusinessProfilePage.tsx#L1002)
- extract-only via `extract-from-scrape` at [src/pages/dashboard/BusinessProfilePage.tsx](src/pages/dashboard/BusinessProfilePage.tsx#L1067)

### Unified Analysis Sequence

`analyze-and-distribute-website` performs this chain:

1. Verify auth and resolve the user’s business.
2. Check `website_scrape_results` for a recent cache hit.
3. If no cache is used, scrape the website through Cloud Run.
4. Store the raw scrape payload in `website_scrape_results`.
5. Call `extract-from-scrape` to distribute the data into normalized tables.
6. Update the business website URL.
7. Queue async menu enrichment jobs when menu pages are detected.

The edge function lives in [supabase/functions/analyze-and-distribute-website/index.ts](supabase/functions/analyze-and-distribute-website/index.ts#L1).

### What The Page Sends

The page passes only the normalized URL plus a force-refresh flag. It intentionally avoids sending business name or type hints so the extractor can re-read the website instead of confirming stale onboarding data.

The page also handles auth token refresh if the first request comes back unauthorized, which keeps the user flow resilient when the session is stale.

### What The Page Receives Back

The response is used only as a summary signal. The page updates local state from the returned values, counts how many fields changed, marks the form dirty for review, and then refreshes menu highlights from the database after the analysis completes.

## Scrape and Extract Ownership

### `start-scrape-job`

[supabase/functions/start-scrape-job/index.ts](supabase/functions/start-scrape-job/index.ts#L1) is the synchronous scrape wrapper. It:

- normalizes the URL,
- resolves the user’s business,
- creates a `website_scrape_results` row with `processing` state,
- triggers Cloud Run,
- updates the scrape row with the returned payload,
- and returns the completed scrape result.

Its behavior is intentionally conservative: it creates a persistent scrape record before the expensive fetch finishes, so the UI can always anchor its progress to a real database row.

### `scrape-webhook`

[supabase/functions/scrape-webhook/index.ts](supabase/functions/scrape-webhook/index.ts#L1) is the completion webhook path. It updates the same `website_scrape_results` row when Cloud Run reports success or failure.

This webhook is the recovery path when the scraper runs independently of the synchronous wrapper. It keeps the same row ID and only changes the stored payload/status fields.

### `extract-from-scrape`

[supabase/functions/extract-from-scrape/index.ts](supabase/functions/extract-from-scrape/index.ts#L1) is the data-distribution step. It fetches the latest scrape for the business and writes normalized values into multiple tables.

Its core flow is:

1. fetch the latest `website_scrape_results` row for the business
2. derive tier-1 structural fields from explicit payload paths
3. derive tier-2 closed-vocabulary fields from keyword scans
4. run AI extractors only when the content quality passes the gate
5. split the result into per-table buckets
6. upsert each bucket with a single write per table

The helper writers at [supabase/functions/extract-from-scrape/index.ts](supabase/functions/extract-from-scrape/index.ts#L772) through [supabase/functions/extract-from-scrape/index.ts](supabase/functions/extract-from-scrape/index.ts#L897) are the key ownership boundary:

- `writeBusinessLocations` upserts `business_locations`.
- `writeBusinessOperations` upserts `business_operations`.
- `writeBusinessProfile` upserts `business_profile`.
- `writeBusinesses` updates `businesses`.
- `writeOpeningHours` deletes and reinserts `opening_hours` rows.

## Database Map

### `website_scrape_results`

This table is the raw scrape audit log and cache. It stores the source URL, normalized URL, scrape timestamps, quality metadata, the full payload, and extraction status fields. The table definition is in [supabase/migrations/20260713000000_create_website_scrape_results.sql](supabase/migrations/20260713000000_create_website_scrape_results.sql#L18).

The important design choice is that the raw payload is preserved verbatim. That lets the analysis pipeline re-run extraction later without losing the original crawl context.

### `businesses`

This is the top-level business identity row. On this screen it holds the business name, website URL, logo URL, hybrid type, and local location reference.

### `business_locations`

This is the primary contact/location row. For this page it is the structured address and contact source, and the extractor also writes to it automatically.

### `business_profile`

This table acts as the website-analysis profile store. It currently holds user-facing about text, key offerings, booking URL, menu signal, menu structure, keywords, and some AI-derived summaries.

In practice, this is the page’s bridge table for website-derived facts: if the user runs analysis, the new data is expected to land here or be reflected here after extraction.

The website-analysis schema additions are in [supabase/migrations/20251223100000_add_website_analysis_crawl_fields.sql](supabase/migrations/20251223100000_add_website_analysis_crawl_fields.sql#L57), and the booking URL column is added in [supabase/migrations/20250704120000_add_booking_url_to_business_profile.sql](supabase/migrations/20250704120000_add_booking_url_to_business_profile.sql#L1).

### `business_brand_profile`

This is split between legacy manual fields and the V5 profile system.

- The page manually reads and writes `business_character` and `booking_link`.
- The V5 generator writes `brand_profile_v5`, `business_identity_persona`, `voice_guardrails`, flattened examples, `marketing_manager_brief`, `strategic_audience_segments`, `location_strategy`, and other derived V5 fields.

The page still uses this table because it owns a small amount of legacy UI state, but the newer content-generation path increasingly reads the V5 columns instead of the old standalone fields.

The V5 flattening migrations are [supabase/migrations/20260612000001_flatten_brand_examples.sql](supabase/migrations/20260612000001_flatten_brand_examples.sql#L1) and [supabase/migrations/20260612000002_flatten_voice_guardrails.sql](supabase/migrations/20260612000002_flatten_voice_guardrails.sql#L1).

### `business_operations`

This table stores operational structure used by content and strategy generation. The base schema is in [supabase/migrations/20260113000000_business_knowledge_foundation.sql](supabase/migrations/20260113000000_business_knowledge_foundation.sql#L76). Later additions include `has_reservation_system` in [supabase/migrations/20260505000004_add_has_reservation_system.sql](supabase/migrations/20260505000004_add_has_reservation_system.sql#L1).

For this page, `business_operations` is the home for service model and timing facts extracted from the website and then manually refined by the user.

### `opening_hours`

This table stores one row per weekday. The page reads it into a Danish day-key schedule and writes it back by deleting and reinserting the normal rows.

## Legacy Versus Authoritative Data

This is the key architectural split for `/dashboard/profile`:

- `business_profile` remains the primary profile store for the page’s manual and website-analysis data.
- `business_brand_profile.business_character` is still used by the page, but it is legacy compared with the V5 profile model.
- `business_brand_profile.brand_profile_v5` is the authoritative V5 source for downstream AI systems.
- `business_identity_persona` and `voice_guardrails` are the flattened high-access V5 fields used for fast reads.

The V5 generator explicitly saves the complete profile to `brand_profile_v5` and also writes flattened columns for fast access in [supabase/functions/brand-profile-generator-v5/index.ts](supabase/functions/brand-profile-generator-v5/index.ts#L2180).

### Ownership Matrix

| Area | Primary owner | Notes |
|---|---|---|
| Raw scrape payload | `website_scrape_results` | Immutable source record for the crawl |
| Manual profile edits | `BusinessProfilePage` | User-reviewed form state and save action |
| Website-analysis summary | `business_profile` | Menu signal, keywords, about text, booking URL |
| Operational facts | `business_operations` | Service model, hours, kitchen timing, weekly programme |
| Legacy brand bridge | `business_brand_profile` | Small manual fields plus V5 compatibility |
| Authoritative V5 profile | `brand_profile_v5` | Downstream AI source of truth |

The practical rule is: if the page is showing something the user can edit directly, that field usually belongs to the manual save path; if the data came from crawling or extraction, it belongs to the analysis pipeline and should be traceable back to `website_scrape_results`.

## Practical Edge Cases

1. Multiple businesses: the page can stop and show the selector instead of loading a single profile row.
2. Cached website analysis: the analysis edge function can reuse a recent scrape without re-scraping.
3. Partial data: the page tolerates missing profile, brand, or operations rows and fills defaults where possible.
4. Manual vs AI conflict: AI analysis can update fields immediately, but the page still marks changes as unsaved so the user can review before saving.
5. Legacy brand profile drift: the page still reads `business_character`, but downstream content generation increasingly depends on the V5 profile tables and JSONB.

6. Cache reuse: `analyze-and-distribute-website` can skip a fresh scrape if a recent valid result already exists, so the page may complete without calling Cloud Run again.

7. Session staleness: the page refreshes auth tokens before analysis when needed, which avoids false failures from expired sessions.

## Bottom Line

`/dashboard/profile` is the main reconciliation screen for business identity data. It bridges raw business records, website-derived profile data, manual edits, and the newer V5 brand-profile architecture. The page is intentionally broad, but the strongest ownership rule is simple: raw scrape state lives in `website_scrape_results`, normalized profile state lives mostly in `business_profile` and `business_operations`, and the long-term brand system lives in `business_brand_profile` with V5 as the authoritative layer.