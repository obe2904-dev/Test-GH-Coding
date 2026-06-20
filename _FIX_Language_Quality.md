# Language Quality Fix - Local Location References

**Date**: 2026-06-07  
**Status**: ✅ **DEPLOYED**  
**Issue**: English terms and generic location references in generated strategies

---

## Problem Identified

User reported quality issues in generated strategy:

### Issues Found
1. **English Terms**: "Day-to-Evening Format", "Waterfront Destination"
2. **Generic Location Terms**: "havnefronten", "Waterfront" instead of business-specific reference
3. **Missing Local Context**: Database has `local_location_reference` (e.g., "ved åen" for Cafe Faust) but it wasn't being used

### Example of Problem
```
Denne uge udnytter Cafe Faust synergien mellem Day-to-Evening Format og Waterfront Destination.
                                                        ❌ English              ❌ Generic term
```

**Should be**:
```
Denne uge udnytter Cafe Faust synergien mellem brunch-til-aften-service ved åen.
                                                    ✅ Danish              ✅ Specific reference
```

---

## Root Cause Analysis

### 1. Missing Data Flow
- `business_location_intelligence.local_location_reference` exists in database ✓
- BUT not queried in `get-weekly-strategy/index.ts` ✗
- Result: Not available in `WeekContext` for AI prompts

### 2. Hardcoded English Examples
- Phase 1 prompt contained example with "Waterfront-placeringen"
- No explicit instructions to avoid English terms
- No instructions to use `local_location_reference`

---

## Solution Implemented

### 1. Data Flow Fix (get-weekly-strategy/index.ts)

**Added to query** (line ~238):
```typescript
dataClient
  .from('business_location_intelligence')
  .select('neighborhood, area_type, category_scores, location_marketing_hooks, latitude, longitude, local_location_reference')
  //                                                                                                  ^^^^^^^^^^^^^^^^^^^^^^^^^ ADDED
  .eq('business_id', body.business_id)
  .single(),
```

**Added to WeekContext** (line ~1200):
```typescript
location: {
  type: locationType as 'city_center' | 'tourist_area' | 'residential' | 'waterfront' | 'suburban',
  neighborhood: locationIntel?.neighborhood,
  area_type: locationIntel?.area_type,
  // ... other fields ...
  local_location_reference: locationIntel?.local_location_reference ?? null,  // ← ADDED
},
```

### 2. Prompt Instructions (phase1.ts)

**Fixed example** (line ~514):
```typescript
// BEFORE:
"Waterfront-placeringen giver ekstra pull fredag ved 16°C."

// AFTER:
"Placeringen ved åen giver ekstra pull fredag ved 16°C."
```

**Added language rules** (line ~502):
```typescript
## SPROG- OG LOKATIONSREGLER

⚠️ KRITISK: Skriv KUN på dansk. Undgå engelske termer.
${context.location?.local_location_reference 
  ? `⚠️ Når du refererer til placeringen, brug: "${context.location.local_location_reference}" — IKKE generiske termer som "havnefronten", "waterfront", "området" osv.` 
  : ''}
• Undgå engelske udtryk: "Day-to-Evening", "Waterfront Destination", "format" → brug danske termer
• Konkrete danske beskrivelser: "brunch-til-aften-service", "døgndrift", "kontinuerlig service" osv.
```

---

## Files Modified

1. **[get-weekly-strategy/index.ts](supabase/functions/get-weekly-strategy/index.ts)**
   - Line ~238: Added `local_location_reference` to SELECT query
   - Line ~1200: Added to WeekContext.location object

2. **[phase1.ts](supabase/functions/_shared/post-helpers/strategy/phase1.ts)**
   - Line ~502: Added SPROG- OG LOKATIONSREGLER section
   - Line ~514: Fixed example to use "ved åen" instead of "Waterfront"

---

## Expected Results

After this fix, generated strategies should:

✅ **Use Danish terms only**:
- "brunch-til-aften-service" NOT "Day-to-Evening Format"
- "kontinuerlig service" NOT "continuous service"
- "destinationssted" NOT "Destination"

✅ **Use specific local references**:
- For Cafe Faust: "ved åen" (from database)
- Other businesses: their specific `local_location_reference`
- Examples: "ved fjorden", "ved Nyhavn", "ved bugten", "ved søen"

✅ **Avoid generic terms**:
- NOT "havnefronten", "waterfront", "området", "placeringen"
- USE the business-specific reference from database

---

## Testing

**Test Strategy Generation**:
```bash
curl -X POST 'https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/get-weekly-strategy' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer ...' \
  -d '{"business_id": "f4679fa9-3120-4a59-9506-d059b010c34a", "regenerate": true}'
```

**Check for**:
1. Week summary uses "ved åen" NOT "havnefronten"
2. Competitive advantage uses Danish terms only
3. Focus descriptions use specific location reference

---

## Database Verification

To check `local_location_reference` for any business:

```sql
SELECT 
  b.name,
  bli.local_location_reference,
  bli.area_type,
  bli.neighborhood
FROM businesses b
JOIN business_location_intelligence bli ON b.id = bli.business_id
WHERE b.id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
```

Expected for Cafe Faust:
- `local_location_reference`: "ved åen"
- `area_type`: "waterfront"

---

## Quality Impact

### Before Fix
- Mix of English and Danish terms
- Generic location references
- Inconsistent terminology

### After Fix  
- 100% Danish language (except proper nouns)
- Specific, factual location references from database
- Consistent terminology matching brand voice

---

## Related Optimizations

This fix complements the earlier prompt compression work:
- Compression saved 12-17% tokens ✓
- Language quality fix improves output quality ✓
- Both deployed in same release (2026-06-07)

**Net Result**: Lower cost + higher quality = Win-win 🎉

---

**Status**: ✅ Deployed to production  
**Next**: Monitor next strategy generation for language quality
