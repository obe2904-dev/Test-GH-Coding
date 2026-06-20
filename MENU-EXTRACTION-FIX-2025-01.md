# Menu Extraction Fix - January 2025

## Problem Summary
Menu extractions were failing for JavaScript-rendered websites (React, Vue, Next.js) because the `hasMenuSignal()` function checked for text content before JavaScript loaded. This caused 6 Café Faust menus to get stuck in queue, routed to non-existent Cloud Run worker.

## Root Cause
```typescript
// OLD LOGIC - TOO STRICT
if (hasMenuSignal(llmText)) {
  // Only try Edge extraction if text.length >= 1000 AND (priceHits >= 2 OR keywordHits >= 2)
  // Problem: JavaScript-rendered pages return minimal HTML before JS executes
}
```

## Solution Implemented
```typescript
// NEW LOGIC - ALWAYS TRY EDGE FIRST
// Removed hasMenuSignal() pre-filter entirely for HTML pages
console.log(`🔍 Attempting Edge extraction for HTML (${llmText.length} chars)`)

try {
  const structured = await parseMenuWithOpenAI(llmText, languageCode)
  
  // Validate that we actually got menu data
  if (!structured?.categories || structured.categories.length === 0) {
    throw new Error('No menu categories extracted from HTML')
  }
  
  // ... proceed with extraction
} catch (edgeErr) {
  // Enhanced error handling
  if (errorMsg.includes('No menu categories')) {
    // Mark as error - no menu found
  } else {
    // Fall back to Cloud Run for parsing errors
  }
}
```

## Key Changes

### 1. Always Try Edge First
- **Before**: Pre-filtered HTML with hasMenuSignal() → many false negatives
- **After**: Always try GPT-4o-mini extraction for HTML
- **Rationale**: GPT-4o-mini costs ~$0.003 per extraction - cheaper to try than to filter

### 2. Validate Results
- Check that extracted data contains `categories` array
- Throw error if empty → allows proper error handling

### 3. Enhanced Error Handling
- **"No menu found"**: Mark as error, don't retry (final state)
- **Parsing/API errors**: Fall back to Cloud Run as last resort
- **Success**: Mark as done, store structured data

### 4. Preserved Architecture
- Edge Function still handles 95% of cases (cheap, fast)
- Cloud Run still reserved for complex PDFs requiring OCR
- Tiered cost optimization remains intact

## Testing Instructions

### 1. Clean Up Stuck Queue
Run the cleanup script to reset stuck entries:
```bash
psql YOUR_DATABASE_URL < _reset_cafe_faust_queue.sql
```

Or use Supabase SQL Editor:
```sql
UPDATE menu_results_v2 
SET status = 'error', error_message = 'Superseded by new extraction logic', completed_at = NOW()
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a' AND status = 'queued';

UPDATE menu_sources
SET status = 'pending'
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a' AND status = 'extracting';
```

### 2. Test Extraction
1. Navigate to http://localhost:3000/dashboard/menu
2. Find Café Faust in the business selector
3. Click "Udtræk" (Extract) on any menu source
4. Monitor extraction progress:
   - Should complete in 10-30 seconds
   - Status should change: `pending` → `processing` → `done`
   - Check structured_data is populated in menu_results_v2

### 3. Verify Queue Behavior
- Queue processes one extraction at a time (already confirmed working)
- Multiple extractions will queue sequentially
- No changes needed to MenuPage.tsx

## Database Diagnostics

### Check Extraction Status
```sql
SELECT 
  ms.url,
  ms.status as source_status,
  mr.status as result_status,
  mr.extraction_method,
  mr.created_at,
  mr.completed_at,
  mr.error_message
FROM menu_sources ms
LEFT JOIN menu_results_v2 mr ON mr.source_id = ms.id
WHERE ms.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY mr.created_at DESC;
```

### Expected Results
- `extraction_method = 'edge_html'` (not 'cloudrun_fallback')
- `status = 'done'` within 30 seconds
- `structured_data` contains categories, items, prices
- `error_message` is NULL for successful extractions

## Files Modified
- `supabase/functions/menu-extract-v2/index.ts`
  - Removed `hasMenuSignal()` check for HTML (lines 1125-1359)
  - Added category validation after OpenAI parsing
  - Enhanced error handling in catch block
  - Marked `hasMenuSignal()` as deprecated

## Deployment
```bash
supabase functions deploy menu-extract-v2
```

**Status**: ✅ Deployed successfully on January 2025

## Cost Impact
- **Before**: ~95% Edge, ~5% Cloud Run (same as after)
- **After**: Same distribution - we just reduced false negatives
- **Net change**: Minimal - we're now successfully extracting menus that were previously failing

## Future Optimizations
- Consider removing `hasMenuSignal()` function entirely if not used elsewhere
- Monitor extraction success rates to validate fix
- Consider adding retry logic for temporary API failures
