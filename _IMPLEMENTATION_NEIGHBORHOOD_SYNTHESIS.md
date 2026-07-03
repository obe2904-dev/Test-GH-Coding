# IMPLEMENTATION COMPLETE: Neighborhood Data Synthesis Solution

## Problem Summary
The `neighborhood` field in `business_location_intelligence` is used extensively across 16+ files in both runtime and prompt layers, but Google Maps only provides neighborhood data for major cities. Rural areas, small towns, and many non-urban locations have no formal neighborhood boundaries, leaving the field null and weakening brand profile quality.

## Solution Implemented: Two-Layer Architecture

### **Layer 1: Smart Synthesis at Write Time**

**File**: `supabase/functions/populate-location-intelligence/index.ts`

**What Changed**:
- Added `synthesizeNeighborhoodFromAreaType()` helper function
- Synthesizes location phrases from `city + area_type` when Google returns null
- Applied immediately after `LocationAnalyzer.analyze()` call

**Danish Phrase Mappings**:
```typescript
{
  'city_centre': `${city} centrum`,
  'residential': `${city} boligområde`,
  'office': `${city} erhvervsområde`,
  'transport_hub': `${city} transportknudepunkt`,
  'waterfront': `${city} havn`,
  'shopping_district': `${city} shoppingområde`,
  'mixed_use': city, // Just city name for mixed-use
  'destination': `${city} attraktion`,
  'nature_park': `${city} naturområde`,
}
```

**Examples**:
- Kolding + city_centre → "Kolding centrum"
- Aarhus + waterfront → "Aarhus havn"
- Odense + residential → "Odense boligområde"

**Fallback Chain**:
1. Google-provided neighborhood (if available) ✅
2. Synthesized from city + area_type (if neighborhood is null) ✅
3. Just city name (if area_type is also null) ✅

---

### **Layer 2: Prompt Fallback Standardization**

**Files Updated** (5 files):

1. **commercial-orientation.ts** (lines 168-178)
   - Added fallback chain: `local_location_reference || neighborhood || city`
   - Ensures commercial orientation prompts always have location context

2. **business-identity-persona.ts** (lines 203-212)
   - Added fallback chain: `local_location_reference || neighborhood || city`
   - Ensures persona generation always has neighborhood-level context

3. **prompts/prompt-b.ts** (line 1009)
   - Added fallback chain to neighborhood display
   - Changed: `${neighborhood || '—'}` → `${local_location_reference || neighborhood || cityName || '—'}`

4. **audience-profile.ts** (line 284)
   - Added `local_location_reference` to existing fallback
   - Changed: `${location.neighborhood || business.city}` → `${location.local_location_reference || location.neighborhood || business.city}`
   - (Lines 216, 262, 329 already had correct fallback)

5. **brand-profile-generator-v5/index.ts** (lines 643-649)
   - Added validation warning when neighborhood is missing
   - Logs actionable message to refresh location intelligence

**Files Already Correct**:
- `identity-profile.ts` - Has separate checks with CRITICAL instruction when `local_location_reference` exists
- `audience-profile.ts` - Lines 216, 262, 329 already had full fallback chain

---

### **Backfill Migration**

**File**: `_BACKFILL_SYNTHESIZED_NEIGHBORHOODS.sql`

**Purpose**: Apply synthesis logic to all existing rows with null neighborhood

**Steps**:
1. Check count of null neighborhoods
2. Preview what will be synthesized
3. Apply UPDATE with same synthesis logic as Edge Function
4. Verify results
5. Check for any remaining nulls (should only be businesses without city data)

**SQL Logic**:
```sql
UPDATE business_location_intelligence bli
SET neighborhood = CASE 
  WHEN area_type = 'city_centre' THEN city || ' centrum'
  WHEN area_type = 'residential' THEN city || ' boligområde'
  -- ... (full mapping)
  ELSE city  -- Fallback
END
WHERE neighborhood IS NULL AND city IS NOT NULL
```

---

## Implementation Checklist

✅ **Write-path synthesis** in `populate-location-intelligence/index.ts`
✅ **Backfill SQL migration** created
✅ **Prompt fallback standardization** across 5 files
✅ **Validation warning** in brand-profile-generator-v5
✅ **No schema changes** - reuses existing field
✅ **Backward compatible** - Google neighborhoods preserved
✅ **Operator override preserved** - `local_location_reference` still wins

---

## Next Steps

### 1. Run Backfill Migration
```bash
# In Supabase SQL Editor
# URL: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new
# Execute: _BACKFILL_SYNTHESIZED_NEIGHBORHOODS.sql
```

### 2. Test Write Path
Trigger location intelligence refresh for a business without Google neighborhood data:
```typescript
// In any Edge Function or client code
await supabase.functions.invoke('populate-location-intelligence', {
  body: { business_id: 'test-business-id', force_refresh: true }
})
```

### 3. Verify Prompt Output
Generate brand profile for a rural/small-town business and confirm:
- ✅ Location context is never empty
- ✅ Synthesized neighborhood appears in prompts
- ✅ `local_location_reference` overrides when set

---

## Architecture Benefits

✅ **Minimal code surface** - Only write path + 5 prompt files
✅ **No new fields** - Reuses existing `neighborhood` column
✅ **Semantic accuracy** - "Kolding centrum" is factually correct
✅ **Forward compatible** - New businesses get synthesized values automatically
✅ **Backward compatible** - Existing Google neighborhoods unchanged
✅ **Operator control** - `local_location_reference` still highest priority

---

## Risk Assessment

**Low Risk**:
- No breaking changes to schema
- Fallback chain prevents empty location context
- Synthesis uses existing verified data (city + area_type)

**Potential Concern**:
- Cannot distinguish "real Google neighborhood" from "synthesized location phrase" in database
- **Mitigation**: Not needed for prompt quality; only matters for data lineage tracking
- If needed later, can add new field `location_context` and keep `neighborhood` as raw Google data

---

## Files Modified

### Edge Functions
- `supabase/functions/populate-location-intelligence/index.ts` (+20 lines)
- `supabase/functions/brand-profile-generator-v5/index.ts` (+6 lines)

### Prompt Layer
- `supabase/functions/_shared/brand-profile/commercial-orientation.ts`
- `supabase/functions/_shared/brand-profile/business-identity-persona.ts`
- `supabase/functions/_shared/brand-profile/audience-profile.ts`
- `supabase/functions/_shared/brand-profile/prompts/prompt-b.ts`

### SQL
- `_BACKFILL_SYNTHESIZED_NEIGHBORHOODS.sql` (new file)

---

## Validation Commands

```sql
-- Check synthesis coverage
SELECT 
  COUNT(*) FILTER (WHERE neighborhood LIKE '% centrum') AS city_centre,
  COUNT(*) FILTER (WHERE neighborhood LIKE '% havn') AS waterfront,
  COUNT(*) FILTER (WHERE neighborhood LIKE '% boligområde') AS residential,
  COUNT(*) FILTER (WHERE neighborhood NOT LIKE '% %') AS city_only,
  COUNT(*) FILTER (WHERE neighborhood IS NULL) AS still_null
FROM business_location_intelligence;

-- Verify prompt fallback
SELECT 
  b.name,
  bli.local_location_reference,
  bli.neighborhood,
  bl.city,
  COALESCE(bli.local_location_reference, bli.neighborhood, bl.city) AS final_location_context
FROM business_location_intelligence bli
JOIN businesses b ON bli.business_id = b.id
LEFT JOIN business_locations bl ON b.id = bl.business_id AND bl.is_primary = true
LIMIT 20;
```

---

## Implementation Date
2026-06-25

## Status
✅ **COMPLETE** - Ready for backfill migration and testing
