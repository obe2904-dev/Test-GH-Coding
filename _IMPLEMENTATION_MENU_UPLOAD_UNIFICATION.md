# Menu Upload Unification Implementation

**Date:** 2026-07-23  
**Commit:** f2725de

## Summary

Unified the PDF/JPG upload flow with the source-driven model used by "Importer valgte" and direct URL imports. All three entry points now converge on the same persistent menu source structure.

## Problem

Previously, PDF/JPG uploads bypassed the `menu_sources` table:
- Direct URL and "Importer valgte" created `menu_sources` entries before extraction
- PDF/JPG uploads went straight to `menu_results_v2` without a source record
- This meant uploads were extracted and analyzed, but didn't appear in the same permanent dashboard model

## Solution

Modified [supabase/functions/queue-menu-upload-v2/index.ts](supabase/functions/queue-menu-upload-v2/index.ts) to:

1. **Create menu_sources entry** after file upload
   - Maps file type to `source_kind`: 'pdf' for PDFs, 'image' for JPG/PNG
   - Uses uploaded file's public URL as `source_url`
   - Sets `label` from user-provided headline or filename
   - Links to authenticated user via `created_by`

2. **Link extraction job to source**
   - Added `source_id` to `menu_results_v2` insert
   - Maintains bidirectional relationship between source and result

3. **Return sourceId in response**
   - Frontend can now track uploaded files by both `sourceId` and `resultId`

## What Changed

### Backend
- [supabase/functions/queue-menu-upload-v2/index.ts](supabase/functions/queue-menu-upload-v2/index.ts)
  - Lines 348-380: Create `menu_sources` entry with upsert
  - Line 383: Add `source_id` to `menu_results_v2` payload
  - Line 405: Include `sourceId` in success response

### Frontend
- No changes needed in [src/pages/dashboard/MenuPage.tsx](src/pages/dashboard/MenuPage.tsx)
- Existing `loadMenuCards()` already joins `menu_sources` with `menu_results_v2`
- Uploaded files now automatically appear in the unified card list

## Result

All three import flows now follow the same pattern:

```
User Action → menu_sources entry → menu_results_v2 job → Dashboard card
```

### Direct URL
1. User enters URL → `handleAddManualUrl`
2. Upsert `menu_sources` with `source_kind` from detection
3. Call `menu-extract-v2`
4. Display unified card

### Importer valgte
1. User detects menus → select URLs → click "Importer valgte"
2. Upsert `menu_sources` for selected URLs
3. Trigger extraction for each
4. Display unified cards

### PDF/JPG upload (NEW)
1. User uploads file → `queue-menu-upload-v2`
2. Store file → **Create `menu_sources` entry**
3. Queue extraction job
4. Display unified card

## Migration Compatibility

The `source_kind` column added in [20260722000000_add_source_kind_to_menu_sources.sql](supabase/migrations/20260722000000_add_source_kind_to_menu_sources.sql) accepts:
- `'html'` - Web pages
- `'pdf'` - PDF documents ✓ Used by uploads
- `'image'` - Image files ✓ Used by uploads
- `'mealo'` - Mealo restaurant platform
- `'iframe_platform'` - Embedded platform menus

## Testing

To verify the unification:

1. Upload a PDF menu with headline "Lunch Menu"
2. Check database:
   ```sql
   SELECT id, source_url, source_kind, label, status 
   FROM menu_sources 
   WHERE label = 'Lunch Menu';
   ```
3. Verify extraction result links to source:
   ```sql
   SELECT r.id, r.source_id, r.status, s.source_kind, s.label
   FROM menu_results_v2 r
   JOIN menu_sources s ON r.source_id = s.id
   WHERE s.label = 'Lunch Menu';
   ```
4. Confirm dashboard displays uploaded menu in same card format as imported URLs

## Benefits

- **Unified data model**: All menus stored consistently
- **Better tracking**: Source records persist even if extraction fails
- **Consistent UI**: Same card rendering for all import methods
- **Simpler maintenance**: Single code path for dashboard display
- **Proper source attribution**: Every result linked to original source
