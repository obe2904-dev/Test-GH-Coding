# Fix: Location Intelligence Loading Error

## Problem Summary

When accessing `http://localhost:3000/dashboard/location`, two errors occurred:

1. **AI Analysis Error**: `ReferenceError: hospitalityPlaces is not defined`
2. **Frontend Error**: `Failed to load location data: Cannot coerce the result to a single JSON object`

## Root Causes

### Cause 1: AI Analysis Failure
The AI analyzer was failing with a `ReferenceError`. This triggered the fallback to POI-based scoring.

### Cause 2: Fallback Data Not Saved
When AI analysis failed:
- The system correctly fell back to POI-based scores
- **BUT**: These fallback scores were NOT saved to the database (by design, to avoid "cache poisoning")
- **RESULT**: Frontend tried to load data with `.single()` but found no data → error

### Cause 3: Frontend Used Wrong Query Method
The frontend used `.single()` which:
- Requires EXACTLY one row
- Throws error if zero rows exist
- Throws "Cannot coerce to single JSON object" if multiple rows exist

## Fixes Applied

### Fix 1: Save Fallback Data with Version Flag
**File**: `supabase/functions/populate-location-intelligence/index.ts` (lines 570-599)

**Change**: Always save data to database, even when using fallback
- Fallback data is saved with `schema_version = 1`
- AI-generated data is saved with `schema_version = 2`
- Next request will detect version mismatch and retry AI analysis

**Before**:
```typescript
if (analyzedLocation._is_fallback) {
  console.warn('⚠️ Fallback NOT saved to database');
  // Data not saved!
} else {
  await saver.saveLocationIntelligence(...);
}
```

**After**:
```typescript
// ALWAYS save to database
const versionToSave = analyzedLocation._is_fallback ? 1 : LOCATION_SCHEMA_VERSION;

if (analyzedLocation._is_fallback) {
  console.warn('⚠️ Saving fallback with version 1 - will retry on next request');
  delete analyzedLocation._is_fallback;
  delete analyzedLocation._fallback_warning;
}

await saver.saveLocationIntelligence(business_id, analyzedLocation, versionToSave);
```

### Fix 2: Use `.maybeSingle()` in Frontend
**File**: `src/pages/dashboard/LocationIntelligencePage.tsx` (line 485)

**Change**: Use `.maybeSingle()` instead of `.single()`
- `.maybeSingle()` returns `null` if no data exists (instead of throwing error)
- Allows graceful handling of missing data

**Before**:
```typescript
const { data: locationData, error: loadError } = await supabase
  .from('business_location_intelligence')
  .select('*')
  .eq('business_id', businessId)
  .single();  // ← Throws error if no data
```

**After**:
```typescript
const { data: locationData, error: loadError } = await supabase
  .from('business_location_intelligence')
  .select('*')
  .eq('business_id', businessId)
  .maybeSingle();  // ← Returns null if no data
```

### Fix 3: Improved Error Message
Also updated the error message to be more informative:

```typescript
if (!locationData) {
  throw new Error('No location data found after generation - AI analysis may have failed and fallback was not saved');
}
```

## How It Works Now

### Flow When AI Succeeds
1. AI analyzes location → generates scores
2. Data saved with `schema_version = 2`
3. Frontend loads and displays

### Flow When AI Fails
1. AI fails → falls back to POI-based scores
2. **NEW**: Fallback data saved with `schema_version = 1`
3. Frontend loads fallback data successfully
4. **Next request**: Detects version mismatch → retries AI analysis

### Schema Version Logic
Already existed in the code (line 264):
```typescript
const cachedSchemaVersion = (cachedIntel as any).schema_version || 1;
const schemaMatches = cachedSchemaVersion === LOCATION_SCHEMA_VERSION;

if (cacheAgeDays < CACHE_TTL_DAYS && schemaMatches) {
  // Use cached data
} else {
  // Re-run analysis
}
```

## Deployment Steps

### 1. Redeploy Edge Function
```bash
cd "supabase/functions/populate-location-intelligence"
npx supabase functions deploy populate-location-intelligence
```

### 2. Frontend Will Update Automatically
The frontend changes are in the React app and will take effect on next build/reload.

### 3. Test
1. Go to `http://localhost:3000/dashboard/location`
2. Click "Analysér" button
3. Should work even if AI fails

## Still To Investigate

The original AI error `ReferenceError: hospitalityPlaces is not defined` doesn't appear in the source code. This might be:
- A runtime hallucination by the AI model
- An issue in the compiled Deno runtime
- An outdated deployed version

**Next steps**:
1. Redeploy the function
2. Monitor the logs for the hospitalityPlaces error
3. If it persists, we need to investigate the actual runtime behavior

## Files Modified

1. ✅ `supabase/functions/populate-location-intelligence/index.ts`
2. ✅ `supabase/functions/populate-location-intelligence/index 2.ts` (duplicate)
3. ✅ `src/pages/dashboard/LocationIntelligencePage.tsx`
4. ✅ `src/pages/dashboard/LocationIntelligencePage 2.tsx` (duplicate)
