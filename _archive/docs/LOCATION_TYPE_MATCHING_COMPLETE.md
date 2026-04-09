# Location Type Matching - Pure Location Analysis

## Overview
Separates **pure location analysis** from **business concept fit analysis**.

### STEP 1: Location Type Matching (NEW)
**Question:** "What types of locations describe this physical location?"
**Independent of:** Business menu, hours, concept
**Based on:** Address, neighborhood, POIs, geographic context

### STEP 2: Concept Fit Analysis (EXISTING)
**Question:** "How well does the business concept fit each location type?"
**Depends on:** Business menu, hours, pricing, service model
**Uses:** Location types from STEP 1

---

## Database Schema

### New Column: `location_type_matches`
**Table:** `business_location_intelligence`
**Type:** JSONB
**Purpose:** Store which of the 10 location types match this physical location

**Format:**
```json
{
  "city_centre": {
    "match_score": 85,
    "match_level": "strong",
    "confidence": 0.9,
    "reason": "Ikonisk bymidteadresse. Høj tæthed af restauranter og cafeer"
  },
  "shopping_district": {
    "match_score": 75,
    "match_level": "strong",
    "confidence": 0.85,
    "reason": "Shoppinggade. Mange forretninger i området"
  },
  "residential": {
    "match_score": 25,
    "match_level": "weak",
    "confidence": 0.7,
    "reason": "Høj kommerciel tæthed (ikke primært bolig)"
  }
}
```

---

## The 10 Location Types

1. **City Centre** 🏛️ - Central streets, high pedestrian flow
2. **Residential** 🏘️ - Housing areas, locals dominate
3. **Tourist** 📸 - Near landmarks, seasonal spikes
4. **Office** 🏢 - Business district, weekday traffic
5. **Transport Hub** 🚉 - Stations, grab-and-go behavior
6. **Student** 🎓 - Universities, young demographic
7. **Waterfront** 🌊 - Water proximity, weather-sensitive
8. **Shopping District** 🛍️ - Retail-heavy, daytime peaks
9. **Mixed-Use** 🏙️ - Modern developments, diverse
10. **Destination** 🚗 - Low walk-in, intentional visits

---

## Evaluation Logic

### City Centre
- **High signals:** Strøget, Købmagergade, Indre By, high POI density
- **Score boost:** Tourist attractions nearby, high retail density
- **Confidence:** 0.95 for iconic addresses, 0.7 default

### Residential
- **High signals:** Østerbro, Nørrebro, low commercial density
- **Score penalty:** High hotels, tourist attractions
- **Confidence:** 0.8 for clear neighborhoods, 0.6 default

### Tourist
- **High signals:** Nyhavn, Tivoli, high tourist attractions
- **Score boost:** Many hotels, landmark proximity
- **Confidence:** 0.95 for iconic spots, 0.7 default

### Office
- **High signals:** Nordhavn, Ørestad, high office POI count
- **Score boost:** Low tourist/residential signals
- **Confidence:** 0.8 for business districts, 0.6 default

### Transport Hub
- **High signals:** "station", "banegård", "metro" in address
- **Score boost:** Multiple transit stations nearby
- **Confidence:** 0.95 for stations, 0.8 default

### Student
- **High signals:** "universitet", "campus" in address
- **Score boost:** University POIs nearby
- **Confidence:** 0.9 for campuses, 0.75 default

### Waterfront
- **High signals:** "havn", "kaj" in address, water distance < 100m
- **Score gradient:** Distance-based scoring
- **Confidence:** 0.95 for waterfront addresses, 0.85 default

### Shopping District
- **High signals:** "Strøget", "gågade", high retail density
- **Score boost:** Very high restaurant/cafe counts
- **Confidence:** 0.9 for shopping streets, 0.7 default

### Mixed-Use
- **High signals:** Ørestad, Nordhavn, balanced POI mix
- **Score boost:** Diversity of office + retail + hotels
- **Confidence:** 0.8 for known areas, 0.6 default

### Destination
- **High signals:** Low total POI density, outlying neighborhoods
- **Score boost:** Very sparse commercial activity
- **Confidence:** 0.8 for clear cases, 0.65 default

---

## Workflow

### When "Analyser Lokation" is pressed:

1. **Get location context** from Google Maps analysis
   - Address, neighborhood, city
   - Nearby POIs (restaurants, cafes, hotels, etc.)
   - Landmarks, water distance

2. **STEP 1: Location Type Matching** ← NEW
   ```typescript
   const locationTypeMatches = analyzeLocationTypes(locationContext);
   // Returns scores for all 10 location types
   ```

3. **STEP 2: Concept Fit Analysis** ← EXISTING
   ```typescript
   const conceptFit = analyzeConceptFit(categories, businessData);
   // How business fits each detected location type
   ```

4. **Save to database**
   - `location_type_matches` ← STEP 1 results
   - `concept_fit_by_category` ← STEP 2 results

---

## Files Changed

### New Files
1. **`src/lib/location/locationTypeMatcher.ts`** (680 lines)
   - Pure location analysis logic
   - Evaluates all 10 location types
   - Returns match scores, levels, confidence, reasons

2. **`supabase/migrations/20260122000000_add_location_type_matches.sql`**
   - Adds `location_type_matches` JSONB column
   - Includes documentation comment

3. **`ADD_LOCATION_TYPE_MATCHES_COLUMN.sql`**
   - Quick execution script for Supabase SQL Editor

### Modified Files
1. **`src/types/database/location.ts`**
   - Added `LocationTypeMatch` interface
   - Added `location_type_matches` to `BusinessLocationIntelligence`

2. **`src/pages/dashboard/LocationIntelligencePage.tsx`**
   - Imports `analyzeLocationTypes`
   - Calls STEP 1 before STEP 2
   - Saves location type matches to database

---

## Migration Steps

1. **Apply database migration:**
   ```sql
   -- Run in Supabase SQL Editor
   \i supabase/migrations/20260122000000_add_location_type_matches.sql
   ```
   Or copy content of `ADD_LOCATION_TYPE_MATCHES_COLUMN.sql`

2. **Restart dev server** (types updated)

3. **Test workflow:**
   - Go to Location Intelligence page
   - Click "Analyser Lokation"
   - Check console for:
     - `📍 STEP 1 - Location Type Matches:` (pure location)
     - `🎯 STEP 2 - Concept Fit Analysis:` (business fit)

4. **Verify in database:**
   ```sql
   SELECT 
     neighborhood,
     location_type_matches,
     concept_fit_by_category
   FROM business_location_intelligence
   WHERE business_id = 'your-business-id';
   ```

---

## Example Output

### For: "Strøget 45, København"

**STEP 1 - Location Type Matches:**
```json
{
  "city_centre": {
    "match_score": 95,
    "match_level": "strong",
    "confidence": 0.95,
    "reason": "Ikonisk bymidteadresse. Høj tæthed af restauranter og cafeer. Flere turistattraktioner i nærheden"
  },
  "shopping_district": {
    "match_score": 90,
    "match_level": "strong",
    "confidence": 0.9,
    "reason": "Shoppinggade. Høj tæthed af forretninger"
  },
  "tourist": {
    "match_score": 75,
    "match_level": "strong",
    "confidence": 0.85,
    "reason": "Flere turistattraktioner i området. Mange hoteller i området"
  },
  "residential": {
    "match_score": 15,
    "match_level": "weak",
    "confidence": 0.8,
    "reason": "Høj kommerciel tæthed (ikke primært bolig)"
  }
}
```

**STEP 2 - Concept Fit Analysis:**
(How the cafe's menu/hours fit each location type - existing system)

---

## Key Improvements

✅ **Separation of Concerns**
- Location analysis is independent of business
- Reusable for any business at the same location

✅ **Transparency**
- Clear reasons for each location type match
- Confidence scores show certainty level

✅ **Foundation for Strategy**
- Pure location data feeds into concept fit
- Can compare multiple businesses at same location

✅ **Debugging**
- Console logs show STEP 1 vs STEP 2
- Easy to see which analysis failed

---

## Status

- ✅ Database migration created
- ✅ Location type matcher implemented
- ✅ Frontend integration complete
- ✅ Types updated
- ⏳ Migration pending execution
- ⏳ Testing pending

**Next:** Apply migration, test on real address
