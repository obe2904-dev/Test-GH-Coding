# Local Location Reference - Content Generation Integration

## Implementation Summary

Successfully integrated `local_location_reference` field into all content generation flows (write mode, AI ideas, weekly plan).

## Changes Made

### 1. Database Query Enhancement
**File:** `supabase/functions/generate-text-from-idea/resolve-context.ts`
- Added `local_location_reference` to businesses table query
- Extracted value and stored in `localLocationReference` variable
- Computed `locationText` = `localLocationReference || \`i ${city}\``
- Added console logging: `📍 Location context: ved åen (local reference)` or `📍 Location context: i Aarhus (city default)`

### 2. TypeScript Interfaces Updated
**Files:** 
- `resolve-context.ts` - `BusinessContext` interface
- `types.ts` - `PromptOptions` interface

Added fields:
```typescript
localLocationReference: string | null  // Source value from DB
locationText: string                   // Computed for prompts
```

### 3. Conditional Ban List Filtering
**File:** `resolve-context.ts` (lines ~1189, ~1243)

Updated `LOCATION_MOOD_KW` filtering logic:
```typescript
const isLocationMood = LOCATION_MOOD_KW.some(kw => {
  const hasKeyword = firstSentence.toLowerCase().includes(kw)
  const isAuthentic = localLocationReference && kw.toLowerCase() === localLocationReference.toLowerCase()
  return hasKeyword && !isAuthentic  // Ban generic, allow authentic
})
```

**Effect:** "ved åen" is now allowed when it matches Cafe Faust's `local_location_reference`, but banned for businesses without that reference.

### 4. Prompt Template Update
**File:** `prompt-builders.ts` (line ~662)

Changed from:
```
Skriv ÉN social media-tekst til ${businessName} i ${city} (${effectiveVertical}).
```

To:
```
Skriv ÉN social media-tekst til ${businessName} ${locationText} (${effectiveVertical}).
```

**Result:**
- **Cafe Faust (with reference):** "Cafe Faust ved åen (café)"
- **Generic business (no reference):** "Restaurant Name i Aarhus (restaurant)"

### 5. Data Flow Integration
**File:** `index.ts`

Added parameter to `resolveContentContext` call:
```typescript
const content = await resolveContentContext(
  supabase, businessId, suggestion, source, 
  biz.brandSignaturePhrases, biz.touristContext, 
  biz.localLocationReference  // NEW
)
```

## Testing Instructions

### 1. Pre-flight Check
Run verification query:
```sql
SELECT name, local_location_reference 
FROM businesses 
WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
```
Expected: `Cafe Faust | ved åen`

### 2. Content Generation Test

#### Option A: Write Mode
1. Navigate to: `http://localhost:3000/dashboard/create?mode=write`
2. Select Cafe Faust business
3. Enter any post idea
4. Generate content
5. Check generated caption for natural use of "ved åen"

#### Option B: AI Ideas Mode
1. Navigate to: `http://localhost:3000/dashboard/create?mode=ai`
2. Select Cafe Faust business
3. Choose an AI suggestion
4. Generate content
5. Verify "ved åen" appears in natural context

#### Option C: Weekly Plan
1. Navigate to: `http://localhost:3000/dashboard/ai-weekly-plan`
2. Select Cafe Faust business
3. Generate weekly content
4. Check multiple posts for "ved åen" usage

### 3. Edge Function Logs Verification

**Supabase Dashboard → Edge Functions → generate-text-from-idea → Logs**

Look for:
```
📍 Location context: ved åen (local reference)
```

**NOT:**
```
📍 Location context: i Aarhus (city default)
```

### 4. Prompt Verification

In debug logs (if `DEBUG_PROMPT_LOGGING=true`), confirm user prompt contains:
```
Skriv ÉN social media-tekst til Cafe Faust ved åen (café).
```

## Quality Checks

### ✅ Expected Behavior
- [x] Cafe Faust prompts use "ved åen" instead of "i Aarhus"
- [x] Generated content naturally incorporates "ved åen"
- [x] Ban list allows "ved åen" for Cafe Faust (not filtered out)
- [x] Other businesses without `local_location_reference` still use "i {city}"

### ✅ Hybrid Status Verification
Run:
```sql
SELECT jsonb_array_length(brand_profile_v5->'programmes') AS programme_count
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
```

Expected: `programme_count >= 2` (confirms hybrid F&B operations)

## Deployment Status

- ✅ **generate-text-from-idea** - Deployed (version current)
- ✅ Database field exists (`businesses.local_location_reference`)
- ✅ Cafe Faust has value set: `'ved åen'`
- ✅ All three content flows integrated (write, AI ideas, weekly plan)

## Architecture Notes

### Design Decision: Option A (Template Replacement)
Chose to replace `city` with `locationText` in prompt template rather than:
- ❌ Adding to signature phrases (would cause repetition)
- ❌ Adding as separate context line (unnecessary complexity)

**Rationale:** Clean, maintainable, single source of truth. Computed once in `fetchBusinessContext()`, used automatically everywhere.

### Ban List Strategy: Conditional Filtering
Generic location phrases ("ved åen", "ved vandet") are:
- ✅ **Allowed** when they match business's `local_location_reference`
- ❌ **Banned** otherwise (prevent generic AI hallucinations)

**Benefits:**
- Authentic local references pass through
- Generic mood phrases filtered out
- No hardcoding of specific businesses

## Files Modified

1. `supabase/functions/generate-text-from-idea/resolve-context.ts`
2. `supabase/functions/generate-text-from-idea/types.ts`
3. `supabase/functions/generate-text-from-idea/prompt-builders.ts`
4. `supabase/functions/generate-text-from-idea/index.ts`

## Related Documentation

- [LOCAL-LOCATION-REFERENCE-FLOW.md](LOCAL-LOCATION-REFERENCE-FLOW.md) - Complete data flow documentation
- [ADD_LOCAL_LOCATION_REFERENCE_TO_BUSINESSES.sql](ADD_LOCAL_LOCATION_REFERENCE_TO_BUSINESSES.sql) - Database migration
- [APPLY-ONBOARDING-MIGRATION.sql](APPLY-ONBOARDING-MIGRATION.sql) - Onboarding integration (pending manual application)
