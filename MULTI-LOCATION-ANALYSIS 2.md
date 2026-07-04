# Multi-Location Multi-Programme Complexity Analysis
**Café Faust System Capability Assessment**

## ⚠️ CRITICAL DISCOVERY: Code/Database Mismatch

### Database Query Results Reveal:

**Fields that DON'T exist (but code expects):**
- ❌ `competition_density` - Code expects this
- ❌ `competition_count` - Code expects this
- ❌ `top_competitors` - Code expects this
- ❌ `tourist_context` - Code expects this
- ❌ `city` - Code expects this

**Fields that DO exist (but code doesn't use):**
- ✅ `nearby_hospitality.density_label` = **"high"** ← The actual competition data!
- ✅ `nearby_hospitality.total_count` = 16 (within 300m)
- ✅ `nearby_hospitality.breakdown` = {bar: 2, cafe: 2, restaurant: 12}
- ✅ `concept_fit_by_category` = 3 location contexts (tourist, waterfront, city_centre)
- ✅ `category_scores.tourist` = 60
- ✅ `category_scores.waterfront` = 100
- ✅ `category_scores.city_centre` = 65

**Result:** The AI receives `undefined` for all competition fields → Falls back to generic reasoning

---

## The Multi-Location Reality (Better Than Expected!)

### Your 3 Locations ARE in the Database:

```json
"concept_fit_by_category": {
  "waterfront": {
    "category_score": 100,
    "ui_summary": {
      "one_liner": "Café Faust tilbyder madoplevelser ved åen i Aarhus.",
      "best_marketing_angle": "Fremhæv udeservering med 30+ pladser"
    },
    "is_strategy_driver": true
  },
  "city_centre": {
    "category_score": 65,
    "ui_summary": {
      "one_liner": "Central café med varieret menu og udeservering"
    }
  },
  "tourist": {
    "category_score": 60,
    "ui_summary": {
      "one_liner": "Lokal café ved åen med moderat pris og unik oplevelse"
    }
  }
}
```

**Each has:**
- Unique marketing angle
- Location-specific strengths
- Different fit levels
- Custom content emphasis

**But:** The Edge Function ignores all of this! It only uses `area_type: "waterfront"`.

---

## Investigation Summary: NO CODE AUDIT

### Your Setup Complexity
- **Business**: Café Faust
- **Programmes**: Brunch, Frokost, Aftensmad, Cocktails (+ børnemenu, takeaway)
- **Locations**: 3 distinct contexts (Vandfront, Bymidten, Turistområde)
- **Result**: Each programme has different strategic needs per location

### Critical Finding: **SYSTEM DOES NOT HANDLE MULTI-LOCATION** ❌

---

## How The System Actually Works

### Data Flow Investigation

**Step 1: Location Data Fetch** (Line 136-140, brand-profile-generator-v5/index.ts)
```typescript
const { data: location } = await supabaseClient
  .from('business_location_intelligence')
  .select('*')
  .eq('business_id', businessId)
  .single()  // ← PROBLEM: Only gets ONE location!
```

**Finding**: `.single()` means the system fetches **only ONE location record** per business.

**Impact**: 
- Café Faust has 3 location contexts → System uses only 1
- Which one? Whichever was inserted first/last (unpredictable)
- All programmes (Brunch, Frokost, Aftensmad, Bar) use THE SAME location data

---

### Step 2: Competition Data Pass-Through

**Where it's used** (Line 220, brand-profile-generator-v5/index.ts):
```typescript
{
  competition_density: location?.competition_density,  // "high" | "medium" | "low"
  competition_count: location?.competition_count,      // Number (e.g., 15)
  top_competitors: location?.top_competitors
}
```

**Where it goes to AI** (Line 210-214, commercial-orientation.ts):
```typescript
`Konkurrence: ${location.competition_density} (${location.competition_count} konkurrenter inden for 500m)`
```

**Finding**: The AI receives competition data as TEXT from the database.

**Your Observation**: 
> "NOTE: There is heavy competition in the area."

**AI Output Says**: 
> "moderat konkurrence" (moderate competition)

**Root Cause**: The database `business_location_intelligence.competition_density` field contains "medium" not "high".

---

## Current System Limitations

### ❌ **Cannot Handle**:

1. **Multiple Locations Per Business**
   - Database structure: 1 row per business in `business_location_intelligence`
   - Code fetches: `.single()` (only 1 record)
   - Reality: Café Faust has 3 different location contexts
   
2. **Programme-Specific Location Context**
   - Brunch at Vandfront vs Brunch at Bymidten = different strategies
   - System: Same location data for all programmes
   
3. **Seasonal Tourist Patterns**
   - Field: `tourist_context` (static text)
   - Example values: "high tourist area", "local crowd", "mixed"
   - Missing: "July-only tourists" vs "year-round tourists"
   
4. **Location-Aware Competition Density**
   - Vandfront: May have different competition than Bymidten
   - System: One competition_density value for entire business

---

## Data Quality Issue: Competition Density

### Your Reasoning Output:
```
"Aftensmad i Aarhus' waterfront-område kræer en planlagt tilgang, 
da gæsterne ofte reserverer bord i forvejen. Med en moderat konkurrence..."
                                                    ^^^^^^^^^^^^^^^^
```

### Your Observation:
```
"NOTE: There is heavy competition in the area."
```

### **Root Cause**: Database has wrong value

**To verify**, run this query:
```sql
SELECT 
  business_id,
  area_type,
  competition_density,
  competition_count,
  neighborhood
FROM business_location_intelligence
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';
```

**Expected Finding**: `competition_density` column contains `'medium'` not `'high'`

**AI is NOT wrong** - it's accurately using the data it receives.

---

## Can AI Handle This Complexity?

### ✅ **AI CAN Handle** (if given correct data):

1. **Nuanced Reasoning**
   - ✅ Multi-language menus → international tourists
   - ✅ Time-based context (17:30 dinner vs 09:00 brunch)
   - ✅ Location type influence (waterfront vs city center)
   - ✅ Competition density impact on strategy

2. **Context Integration**
   - ✅ Combines programme type + location + competition
   - ✅ Generates specific reasoning (not generic)
   - ✅ Validates reasoning quality (>20 chars, no banned phrases)

### ❌ **AI CANNOT Handle** (data structure limitations):

1. **Multi-location differentiation** → Only receives 1 location
2. **Seasonal patterns** → No date/season field in data
3. **Programme-location combinations** → No linking table
4. **Real-time competition changes** → Static database value

---

## Architecture Gap Analysis

### Current: **Single-Location Single-Strategy Model**
```
Business (Café Faust)
  └─ 1 Location Record (which one?)
      └─ Layer 2: Commercial Strategy
          ├─ Brunch   → Uses same location
          ├─ Frokost  → Uses same location
          ├─ Aftensmad → Uses same location
          └─ Bar      → Uses same location
```

### Reality: **Multi-Location Multi-Strategy Model**
```
Business (Café Faust)
  ├─ Location 1: Vandfront
  │   ├─ Layer 2: Brunch Strategy (waterfront context)
  │   ├─ Layer 2: Frokost Strategy (waterfront context)
  │   └─ Layer 2: Aftensmad Strategy (waterfront context)
  ├─ Location 2: Bymidten
  │   ├─ Layer 2: Brunch Strategy (city center context)
  │   ├─ Layer 2: Frokost Strategy (city center context)
  │   └─ Layer 2: Aftensmad Strategy (city center context)
  └─ Location 3: Turistområde
      ├─ Layer 2: Brunch Strategy (tourist area context)
      ├─ Layer 2: Frokost Strategy (tourist area context)
      └─ Layer 2: Aftensmad Strategy (tourist area context)
```

**Result**: 3 locations × 4 programmes = **12 unique strategies** (not 4)

---

## Immediate Data Quality Fix

### Step 1: Check Current Competition Value
Run: [CHECK-LOCATION-DATA.sql](CHECK-LOCATION-DATA.sql)

### Step 2: Update If Incorrect
```sql
UPDATE business_location_intelligence
SET competition_density = 'high'  -- Change from 'medium'
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';
```

### Step 3: Regenerate Profile
The AI reasoning will now say "høj konkurrence" (high competition) instead of "moderat konkurrence".

---

## Long-Term Architecture Solutions

### Option 1: **Multi-Location Table Structure** (Proper Solution)
```sql
-- New table: business_locations (many-to-one with businesses)
CREATE TABLE business_locations (
  id uuid PRIMARY KEY,
  business_id uuid REFERENCES businesses(id),
  location_name text,  -- 'Vandfront', 'Bymidten', 'Turistområde'
  area_type text,
  competition_density text,
  tourist_context text,
  tourist_seasonality jsonb,  -- {"peak": "july-august", "year_round": false}
  PRIMARY KEY (business_id, location_name)
);

-- Modified: business_programme_profiles (add location_id)
ALTER TABLE business_programme_profiles
ADD COLUMN location_id uuid REFERENCES business_locations(id);

-- Result: Each programme can have location-specific strategy
-- Brunch at Vandfront ≠ Brunch at Bymidten
```

### Option 2: **Primary Location Flag** (Quick Fix)
```sql
-- Add to existing business_location_intelligence
ALTER TABLE business_location_intelligence
ADD COLUMN is_primary boolean DEFAULT true;

-- Allow multiple rows, fetch primary
SELECT * FROM business_location_intelligence
WHERE business_id = ? AND is_primary = true
LIMIT 1;
```

### Option 3: **Location-Agnostic Strategy** (Current Workaround)
- Accept that strategy is business-wide, not location-specific
- Update competition_density to reflect highest competition across all locations
- Use generic tourist_context that applies to all locations
- Document limitation: "Strategy is averaged across all locations"

---

## Summary

| Question | Answer |
|----------|--------|
| **How is multi-location handled?** | It's not. System uses 1 location per business (`.single()`). |
| **Can AI handle complexity?** | Yes, IF given correct data. AI reasoning is high-quality. |
| **Why "moderate" competition?** | Database has wrong value, not AI error. |
| **Why same strategy for all locations?** | Architecture limitation - no programme-location linking. |
| **Can this be fixed?** | Yes. Need either: (1) Multi-location table, (2) Primary location flag, or (3) Accept limitation and use average values. |

**Immediate Action**: Fix `competition_density` data value.

**Strategic Decision**: Determine if multi-location support is needed, or if primary location approach is acceptable.
