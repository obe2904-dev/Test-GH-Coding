# Website Analysis Findings and Recommendations

## Scope
This note summarizes the current scrape and AI analysis pipeline, the dashboard wiring, and the consistency between extracted data and Supabase writes.

## Main Findings

The current dashboard page is not wired to a true two-step workflow. The visible profile page uses a single unified analysis action, while the older step-based hook is disabled and returns dummy values. The UI text suggests separate scrape and AI steps, but the active behavior is one unified call.

The scrape-to-database path is only partially consistent. The raw scrape payload is stored correctly, and several structured fields are mapped to the right tables. However, some AI-derived fields are written to column names that do not match the current schema, or to fields with a different expected data shape.

The business ID flow is correct in principle. The authenticated user is resolved, the business is selected from `businesses`, and that business ID is reused across the downstream writes. That part of the pipeline is sound.

The cached scrape branch is not equivalent to the fresh scrape branch. It calls distribution without carrying the AI result through the same path, so cached runs can behave differently from fresh runs.

The unified edge function also has a call-signature mismatch in the cached branch. That makes the cached path structurally weaker than the fresh path.

## Field Consistency Assessment

### Correct or mostly correct
- Raw scrape payload stored in `website_scrape_results`.
- Business ID reused across linked tables.
- `businesses.name` and `last_scraped_at`.
- `business_profile.booking_url`.
- `business_profile.user_about_text`.
- `business_profile.long_description`.
- `business_profile.menu_signal.signatureItems`.
- `business_operations` service booleans.
- Contact fields and opening hours are mapped sensibly when source data exists.

### Conditional only
- Business name updates only if confidence is high enough.
- Contact info updates only if confidence is high enough.
- Opening hours only update if candidates exist and parse successfully.
- Social accounts only update if a handle can be extracted.
- Menu sources only update if a menu URL exists.

### Mismatched or risky
- `venue_hooks` is stored into `key_offerings` as an array, while the schema expects text.
- `keywords` is written to `business_keywords`, while the schema shows `keywords`.
- `tone_of_voice` is written to `brand_tone`, which does not match the schema excerpt reviewed.
- Cached analysis does not fully follow the same AI-to-distribution path as fresh analysis.

## Two-Step System Assessment

The intended two-step model exists in the codebase, but it is not active on the main profile page.

- The disabled hook still reflects a queued step-based architecture.
- The dashboard button on the active page calls the unified one-shot analysis.
- Legacy step-based functions still exist, but they are not the main user path.

So the project currently has two competing architectures, but only one is actually wired into the user-facing dashboard.

## Functionality Assessment

The current unified flow is functional for fresh analyses: scrape, AI extraction, and database distribution happen in sequence. The main weakness is not the scraping itself, but the consistency and overwrite behavior of the downstream writes.

The biggest practical risk is silent partial success. The system can return a successful analysis result even when some downstream fields are not written as intended, because several writes are conditional and some mappings do not align with the schema.

## Recommendations

1. Standardize the data model for AI outputs so each field has one canonical database target.
2. Align AI write targets with the current schema before relying on regenerated data.
3. Make the cached path behave the same as the fresh path for AI analysis and distribution.
4. Choose one active architecture for the dashboard: unified one-shot or true two-step. Keep the other as a legacy/test path only.
5. Treat conditional confidence-based updates as partial enrichment, not full overwrite.
6. Add a clear success summary that distinguishes between scrape success, AI success, and database write success.
7. Verify the currently deployed database schema before assuming a field is populated just because the function logs success.

## Bottom Line

The system is close to working end-to-end, but it is not fully consistent yet. Scraping works, the business ID linkage is correct, and some fields are written correctly. The main remaining issue is that the AI layer and the database schema are not fully aligned, so regeneration does not reliably overwrite every derived field.