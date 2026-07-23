# Dashboard Menu Tech Map

This document maps the code, databases, and edge functions used by the dashboard menu page at /dashboard/menu.

## Scope

Primary UI entry point:
- [src/pages/dashboard/MenuPage.tsx](src/pages/dashboard/MenuPage.tsx)

This page is the direct controller for menu source management, menu extraction, timing edits, and normalized item toggles.

## Code Used By The Page

### Direct page dependencies
- [src/pages/dashboard/MenuPage.tsx](src/pages/dashboard/MenuPage.tsx)
- [src/stores/tierStore.ts](src/stores/tierStore.ts)
- [src/stores/businessStore.ts](src/stores/businessStore.ts)
- [src/lib/urlNormalization.ts](src/lib/urlNormalization.ts)
- [src/components/ui/Feedback.tsx](src/components/ui/Feedback.tsx)
- [src/pages/dashboard/BusinessProfileIcons.tsx](src/pages/dashboard/BusinessProfileIcons.tsx)

### Behaviors implemented in the page
- Loads the current business and menu state from Supabase.
- Detects menu URLs from a business website.
- Creates menu source records for manual URL, PDF upload, and manual text flows.
- Starts menu extraction jobs and subscribes to realtime updates.
- Shows extracted structured menu data and lets the user edit timing and item flags.
- Updates the business pricing context from extracted menu data.

## Database Tables Used

### Directly read and written by the page

| Table | How it is used |
| --- | --- |
| businesses | Loads the current business and website URL for the selected business. |
| menu_sources | Stores each menu URL or uploaded source, its status, label, type, and error state. |
| menu_results_v2 | Stores extraction jobs, structured menu data, summaries, timing, and job status. |
| menu_items_normalized | Stores flattened menu items and supports signature / active toggles. |
| business_operations | Stores price level and inferred operations context. |

### Supporting database objects referenced by the flow
- RLS policies on businesses, menu_sources, menu_results_v2, and menu_items_normalized control access.
- Realtime publication for menu_results_v2 is required for the job status subscription used by the page.
- The page depends on the source_id link between menu_results_v2 and menu_sources for accurate job matching.

## Edge Functions Used

### Direct calls from the page

| Edge function | Purpose | Call site |
| --- | --- | --- |
| detect-menus | Detects menu URLs from the business website. | Automatic website scan in MenuPage.tsx |
| menu-extract-v2 | Starts a menu extraction job for a single source URL. | Extraction queue and selected source extraction |
| queue-menu-upload-v2 | Queues uploaded PDF or image menu files for extraction. | File upload flow |
| menu-extract-v2 | Processes manual text menu input through the extraction pipeline. | Manual text flow |

## MenuPage Call Details

### 1. `detect-menus` call and `detectedMenuUrls` consumption
- The page reads the active session token with `supabase.auth.getSession()` and sends it as `Authorization: Bearer <token>`.
- It normalizes the business website URL by prepending `https://` when needed.
- It POSTs JSON to `import.meta.env.VITE_SUPABASE_FUNCTION_DETECT_MENUS` with:
	- `url: normalizedUrl`
	- `businessId`
- It reads the response with:
	- `result.detectedMenuUrls || result.allMenuUrls || []`
- The array is deduplicated with `new Set(...)` before being merged into local UI state.
- Each detected URL becomes an object with:
	- `url`
	- `isExisting` from the existing `menu_sources` rows
	- `status: 'pending'`

### 2. How detected URLs become `menu_sources` rows
- The detected URLs are not inserted immediately on detection.
- They first appear in `detectedUrls` state and are pre-selected for the user.
- When the user clicks extract, `handleExtractSelected()` upserts them into `menu_sources` using:
	- `business_id`
	- `source_url` as the decoded and trimmed URL
	- `normalized_url`
	- `menu_type` from `detectMenuType(url)`
	- `label` from `detectMenuLabel(url)`
	- `created_by` from `supabase.auth.getUser()`
	- `source_origin: 'ai_detected'`
	- `status: 'pending'`
	- `source_type: 'url'`
- The upsert key is `business_id,normalized_url`, which keeps source IDs stable across retries.
- After the upsert, the page queries the fresh `menu_sources` rows by `normalized_url`, reloads the cards, and starts extraction for each returned row.

### 3. `menu-extract-v2` payload
- The page calls `POST ${import.meta.env.VITE_SUPABASE_URL}/functions/v1/menu-extract-v2`.
- It sends the current access token in `Authorization` and the anon key in `apikey`.
- The JSON body is:
	- `businessId`
	- `sourceId`
	- `sourceUrl` after URL normalization
	- `languageCode: 'da'`
- Before sending, the page removes stale queued or processing jobs for that `sourceId` so retries start cleanly.

### 4. `source_type` values set on `menu_sources`
- The page explicitly sets `source_type: 'url'` for:
	- manual URL adds
	- AI-detected URLs that are upserted during `handleExtractSelected()`
- The page sets `source_origin` to distinguish the source path:
	- `manual_added`
	- `ai_detected`
- The page does not set a `source_type` value itself for the file-upload flow; that flow is delegated to `queue-menu-upload-v2`.
- The manual text flow does not create a `menu_sources` row in this component; it calls the menu extraction endpoint with `sourceType: 'manual_text'` in the request body.

### Related backend functions in the menu pipeline
These are not called directly by the page, but they are part of the same menu system and are useful when tracing end-to-end behavior:
- [supabase/functions/menu-enqueue/index.ts](supabase/functions/menu-enqueue/index.ts)
- [supabase/functions/menu-sync/index.ts](supabase/functions/menu-sync/index.ts)
- [supabase/functions/scrape-menu/index.ts](supabase/functions/scrape-menu/index.ts)
- [supabase/functions/analyze-menu-metadata/index.ts](supabase/functions/analyze-menu-metadata/index.ts)

## Data Flow Summary

1. The page loads the current business from businesses and the selected business store.
2. It reads menu_sources and menu_results_v2 to build the visible menu cards.
3. It can call detect-menus to discover menu URLs from the website.
4. It inserts or updates menu_sources rows for manual URLs, selected detected URLs, or uploaded files.
5. It starts extraction through menu-extract-v2 or queue-menu-upload-v2.
6. It waits for realtime updates from menu_results_v2 and refreshes the UI when jobs complete.
7. It writes timing edits back to menu_results_v2 and item flags back to menu_items_normalized.
8. It updates business_operations with a derived price level after successful extraction.

## Important Notes

- The page currently relies on realtime updates from menu_results_v2 rather than browser-side extraction.
- The source_id column on menu_results_v2 is the key link that keeps job results attached to the correct menu_sources row.
- The page still reads historical legacy data where source_id may be missing, so URL-based fallback matching remains in place.
- menu_items_normalized is used for item-level controls only; the extraction source of truth is menu_results_v2.

## Files To Inspect Next

- [src/pages/dashboard/MenuPage.tsx](src/pages/dashboard/MenuPage.tsx)
- [supabase/functions/detect-menus/index.ts](supabase/functions/detect-menus/index.ts)
- [supabase/functions/menu-extract-v2/index.ts](supabase/functions/menu-extract-v2/index.ts)
- [supabase/functions/queue-menu-upload-v2/index.ts](supabase/functions/queue-menu-upload-v2/index.ts)
- [supabase/migrations/20260719000000_add_source_id_to_menu_results_v2.sql](supabase/migrations/20260719000000_add_source_id_to_menu_results_v2.sql)
- [supabase/migrations/20260719000001_add_error_code_to_menu_results_v2.sql](supabase/migrations/20260719000001_add_error_code_to_menu_results_v2.sql)
- [supabase/migrations/20260526000001_sync_menu_items_normalized.sql](supabase/migrations/20260526000001_sync_menu_items_normalized.sql)
