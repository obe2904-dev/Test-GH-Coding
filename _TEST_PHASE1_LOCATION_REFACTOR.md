# Phase 1 Location Intelligence Refactor - Test Plan

## Implementation Summary

Phase 1 adds new fields to location intelligence without removing old WHO/WHEN/WHY fields:

### New Fields Added
1. **physical_context** (JSONB)
   - `pedestrian_flow`: Derived from nearby POI density ('very_high' | 'high' | 'medium' | 'low')
   - `transit_within_150m`: Boolean - transit stop within 150m
   - `nearest_transit`: Object with name and distance_meters
   - `parking_within_300m`: Boolean - parking within 300m
   - `street_level`: null (Google doesn't provide floor info)

2. **raw_competitive_venues** (JSONB array, max 8 venues)
   - `name`: Venue name
   - `distance_meters`: Distance from business
   - `rating`: Google rating (1-5)
   - `user_ratings_total`: Number of reviews
   - `price_level`: Google price level (1-4)
   - `place_id`: Google Place ID
   - `types`: Array of Google place types

### Code Changes Made

#### 1. Helper Functions Added (index.ts)
- `derivePedestrianFlow()`: Calculates pedestrian flow from POI density
- `generatePhysicalContext()`: Generates physical_context object

#### 2. Competitive Venues Refactored (index.ts)
- **Old**: Called `getPlaceDetails()` for top 4 venues (expensive API calls)
- **New**: Stores raw data for top 8 venues without expensive detail calls
- **Backward Compatibility**: Still fetches details for top 4 for WHO/WHEN/WHY (deprecated, will be removed in Phase 3)

#### 3. Interface Updates (location-analyzer.ts)
- Added `PhysicalContext` interface
- Added `RawCompetitiveVenue` interface
- Added `physical_context` and `raw_competitive_venues` to `AnalyzedLocation`

#### 4. Database Saver Validation (database-saver.ts)
- Added `VALID_AREA_TYPES` constant
- Validates `area_type` before saving
- Defaults to 'mixed_use' if invalid type detected

#### 5. Migration Created
- `20260625000001_add_location_physical_context.sql`
- Adds JSONB columns with proper comments
- Non-breaking (additive only)

### Backward Compatibility

✅ **Old fields kept intact:**
- `who_analysis`, `when_analysis`, `why_analysis`
- `who_analysis_internal`, `when_analysis_internal`, `why_analysis_internal`
- All existing fields remain unchanged

✅ **No breaking changes:**
- Phase 1 is purely additive
- Existing API consumers continue to work
- Brand Profile can start consuming new fields when ready

## Testing Checklist

### 1. Database Migration
```sql
-- Apply migration
\i supabase/migrations/20260625000001_add_location_physical_context.sql

-- Verify columns added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'business_location_intelligence'
  AND column_name IN ('physical_context', 'raw_competitive_venues');
```

### 2. Function Deployment
```bash
# Deploy updated function
supabase functions deploy populate-location-intelligence

# Verify deployment
supabase functions list
```

### 3. Test with Real Business
```bash
# Test with business 95d657ad-d791-422b-ad40-ec7a5f1c2b0c (Silkeborg)
curl -X POST \
  https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/populate-location-intelligence \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"business_id": "95d657ad-d791-422b-ad40-ec7a5f1c2b0c", "force_refresh": true}'
```

### 4. Verify Data Saved
```sql
SELECT 
  business_id,
  neighborhood,
  area_type,
  physical_context->>'pedestrian_flow' as pedestrian_flow,
  physical_context->>'transit_within_150m' as transit_within_150m,
  physical_context->'nearest_transit'->>'name' as nearest_transit,
  jsonb_array_length(raw_competitive_venues) as competitor_count,
  who_analysis IS NOT NULL as has_who_analysis, -- Should still be true
  when_analysis IS NOT NULL as has_when_analysis, -- Should still be true
  why_analysis IS NOT NULL as has_why_analysis -- Should still be true
FROM business_location_intelligence
WHERE business_id = '95d657ad-d791-422b-ad40-ec7a5f1c2b0c';
```

### 5. Validate Physical Context
```sql
-- Check physical_context structure
SELECT 
  business_id,
  neighborhood,
  jsonb_pretty(physical_context) as physical_context_formatted
FROM business_location_intelligence
WHERE business_id = '95d657ad-d791-422b-ad40-ec7a5f1c2b0c';

-- Expected output:
-- {
--   "pedestrian_flow": "high",
--   "transit_within_150m": true,
--   "nearest_transit": {
--     "name": "Silkeborg Station",
--     "distance_meters": 120
--   },
--   "parking_within_300m": true,
--   "street_level": null
-- }
```

### 6. Validate Raw Competitive Venues
```sql
-- Check raw_competitive_venues structure
SELECT 
  business_id,
  jsonb_array_length(raw_competitive_venues) as venue_count,
  jsonb_pretty(raw_competitive_venues->0) as first_venue_sample
FROM business_location_intelligence
WHERE business_id = '95d657ad-d791-422b-ad40-ec7a5f1c2b0c';

-- Expected output:
-- venue_count: 4-8
-- first_venue_sample: {
--   "name": "Competitor Café",
--   "distance_meters": 150,
--   "rating": 4.5,
--   "user_ratings_total": 234,
--   "price_level": 2,
--   "place_id": "ChIJ...",
--   "types": ["cafe", "restaurant", "food"]
-- }
```

### 7. Validate area_type
```sql
-- Ensure no invalid area_types sneak through
SELECT 
  business_id,
  area_type,
  CASE 
    WHEN area_type NOT IN ('city_centre', 'residential', 'office', 'transport_hub', 
                           'waterfront', 'shopping_district', 'mixed_use', 'destination', 'nature_park')
    THEN '❌ INVALID'
    ELSE '✅ VALID'
  END as validation_status
FROM business_location_intelligence
WHERE business_id = '95d657ad-d791-422b-ad40-ec7a5f1c2b0c';

-- Should show: ✅ VALID
```

### 8. Log Inspection
Check Edge Function logs for:
- ✅ `[4.1/6] Generating physical context...`
- ✅ `Physical context: pedestrian_flow=high, transit_within_150m=true`
- ✅ `Stored X raw competitive venues`
- ✅ No errors about invalid area_type
- ✅ WHO/WHEN/WHY analysis still runs (backward compatibility)

## Success Criteria

✅ Migration applies cleanly without errors  
✅ Edge Function deploys without errors  
✅ Test business regeneration succeeds  
✅ `physical_context` populated with all fields  
✅ `raw_competitive_venues` contains 4-8 venues  
✅ Old WHO/WHEN/WHY fields still populated  
✅ No invalid `area_type` values  
✅ Logs show new steps without errors  

## Next Steps (Phase 2 - Future)

Once Phase 1 is validated:
1. Update Brand Profile to consume `physical_context` and `raw_competitive_venues`
2. Implement WHO/WHEN/WHY generation in Brand Profile context
3. Validate Brand Profile produces equal or better results
4. Phase 3: Remove deprecated WHO/WHEN/WHY fields from location intelligence

## Rollback Plan

If issues occur:
```sql
-- Rollback migration (columns are nullable, safe to drop)
ALTER TABLE business_location_intelligence 
  DROP COLUMN IF EXISTS physical_context,
  DROP COLUMN IF EXISTS raw_competitive_venues;

-- Redeploy previous version
git checkout HEAD~1 supabase/functions/populate-location-intelligence/
supabase functions deploy populate-location-intelligence
```

## Code Quality Checks

- ✅ TypeScript interfaces properly typed
- ✅ Helper functions documented
- ✅ Validation added for area_type
- ✅ Backward compatibility maintained
- ✅ Console logging for debugging
- ✅ Error handling preserved
- ✅ No breaking changes
