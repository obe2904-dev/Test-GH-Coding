# CODE-DATABASE MISMATCH: Competition Data Issue

## Critical Finding: Edge Function Uses Wrong Field Names ❌

### What the Edge Function Code Expects
**File:** `supabase/functions/brand-profile-generator-v5/index.ts` (Line 220)

```typescript
{
  competition_density: location?.competition_density,  // ❌ Field doesn't exist
  competition_count: location?.competition_count,      // ❌ Field doesn't exist
  top_competitors: location?.top_competitors           // ❌ Field doesn't exist
}
```

**File:** `supabase/functions/_shared/brand-profile/commercial-orientation.ts` (Line 210-214)

```typescript
if (location.competition_density && location.competition_count !== undefined) {
  parts.push(
    `Konkurrence: ${location.competition_density} (${location.competition_count} konkurrenter inden for 500m)`
  );
}
```

**Result:** These fields are `undefined`, so the AI prompt gets NO competition data.

---

### What Actually Exists in the Database

**Table:** `business_location_intelligence`

```json
{
  "nearby_hospitality": {
    "density_label": "high",        // ← The ACTUAL competition level
    "total_count": 16,               // ← The ACTUAL competitor count
    "radius_meters": 300,            // ← Within 300m (not 500m)
    "breakdown": {
      "bar": 2,
      "cafe": 2,
      "restaurant": 12
    }
  }
}
```

**Also Available:**
```json
{
  "concept_fit_by_category": {
    "waterfront": {
      "fit_reasons": ["...full list of competitive advantages..."],
      "watchouts": ["...competitive gaps..."],
      "marketing_implications": {
        "content_emphasis": ["...specific strategies per location type..."]
      }
    }
  }
}
```

---

## Impact on AI Reasoning

### Current Behavior (with missing data):

**AI Prompt Receives:**
```
LOCATION KONTEKST:
Område: Aarhus, 
Type: waterfront
Turister: undefined

MENU:
Prisrange: 49-295 kr
Antal retter: 94
```

**AI Output:**
> "Med en moderat konkurrence..."

**Why "moderat"?** 
- No competition data provided
- AI infers from context (waterfront, Aarhus)
- Defaults to moderate assumption

---

### Should Receive (with correct fields):

**AI Prompt Should Get:**
```
LOCATION KONTEKST:
Område: Aarhus
Type: waterfront
Konkurrence: high (16 konkurrenter inden for 300m)

Nærmeste konkurrenter:
  - Café Rømer (150m) (4.2★)
  - Basso Aarhus (200m) (4.4★)
  - Banken FoodHall (180m) (4.1★)

MENU:
Prisrange: 49-295 kr
Antal retter: 94
```

**Expected AI Output:**
> "Café Faust opererer i et område med høj konkurrence (16 restauranter/cafeer inden for 300m), 
> hvilket kræver fokus på differentiering gennem udeservering og waterfront-placering..."

---

## Why the Mismatch Exists

### Historical Schema Evolution

**Hypothesis:** The location intelligence table schema evolved, but Edge Function code wasn't updated.

**Old Schema (assumed):**
```sql
CREATE TABLE business_location_intelligence (
  competition_density text,        -- 'high' | 'medium' | 'low'
  competition_count integer,
  top_competitors jsonb
);
```

**Current Schema (actual):**
```sql
CREATE TABLE business_location_intelligence (
  nearby_hospitality jsonb  -- Contains density_label, total_count, breakdown
);
```

**Code Update:** Never happened! Functions still reference old field names.

---

## The Fix (Required)

### Option 1: Update Edge Function to Use Correct Fields ✅ RECOMMENDED

**File:** `supabase/functions/brand-profile-generator-v5/index.ts`

```typescript
// CURRENT (wrong):
{
  competition_density: location?.competition_density,
  competition_count: location?.competition_count,
}

// SHOULD BE:
{
  competition_density: location?.nearby_hospitality?.density_label,
  competition_count: location?.nearby_hospitality?.total_count,
}
```

**File:** `supabase/functions/_shared/brand-profile/commercial-orientation.ts`

Update AI prompt to use:
```typescript
if (location.nearby_hospitality?.density_label && location.nearby_hospitality?.total_count) {
  parts.push(
    `Konkurrence: ${location.nearby_hospitality.density_label} ` +
    `(${location.nearby_hospitality.total_count} konkurrenter inden for ` +
    `${location.nearby_hospitality.radius_meters}m)`
  );
}
```

### Option 2: Add Alias Fields to Database (Backwards Compatibility)

Add computed columns:
```sql
ALTER TABLE business_location_intelligence
ADD COLUMN competition_density text 
  GENERATED ALWAYS AS (nearby_hospitality->>'density_label') STORED;

ADD COLUMN competition_count integer 
  GENERATED ALWAYS AS ((nearby_hospitality->>'total_count')::integer) STORED;
```

---

## Multi-Location Data is Already There! 🎉

### The `concept_fit_by_category` Structure

Your 3 location contexts **already exist in a single record**:

```json
{
  "waterfront": {
    "category_score": 100,
    "is_strategy_driver": true,
    "ui_summary": {
      "one_liner": "Café Faust tilbyder madoplevelser ved åen i Aarhus.",
      "best_marketing_angle": "Fremhæv udeservering med 30+ pladser"
    },
    "fit_reasons": [
      "Udeservering og takeaway (perfekt til gåture)",
      "Serverer \"destinationsbesøg (planlagt tur)\" motivation"
    ]
  },
  "city_centre": {
    "category_score": 65,
    "ui_summary": {
      "one_liner": "Central café med varieret menu og udeservering",
      "best_marketing_angle": "Fremhæv all-day service fra brunch til sen aften"
    }
  },
  "tourist": {
    "category_score": 60,
    "ui_summary": {
      "one_liner": "Lokal café ved åen med moderat pris og unik oplevelse",
      "best_marketing_angle": "Tiltræk turister med engelske menuer"
    }
  }
}
```

**Each location type has:**
- ✅ Unique marketing angle
- ✅ Location-specific strengths (`fit_reasons`)
- ✅ Competitive watchouts
- ✅ Content emphasis strategies
- ✅ Scoring (waterfront=100, city_centre=65, tourist=60)

**But:** The Edge Function only uses `area_type: "waterfront"` and ignores the rich multi-location data!

---

## Summary

| Issue | Status | Fix Required |
|-------|--------|--------------|
| **Competition data missing** | ❌ Field name mismatch | Update code to use `nearby_hospitality` |
| **Multi-location support** | ✅ Already in DB! | Update code to read `concept_fit_by_category` |
| **Why AI says "moderate"** | No data = inference | Fix field mapping |
| **User observation "heavy"** | ✅ Correct! DB shows "high" | Fix will expose this |

**Immediate Action:**
1. Fix field mapping: `competition_density` → `nearby_hospitality.density_label`
2. Fix field mapping: `competition_count` → `nearby_hospitality.total_count`
3. Consider using `concept_fit_by_category` for multi-location strategies

**Result:** AI reasoning will change from "moderat konkurrence" to "høj konkurrence (16 konkurrenter)" ✅
