# Commercial Strategy Data Gap Analysis

**Analysis Date:** 5. maj 2026  
**Scope:** Why AI commercial strategy analyzer makes incorrect conclusions for Cafe Faust  
**Method:** Deep-dive comparison of analyzer code vs DATABASE-COMPLETE-MAPPING.md

---

## EXECUTIVE SUMMARY

The commercial strategy analyzer is making **fundamentally incorrect assessments** because it's querying **fields that don't exist** and **ignoring fields that do exist**. This is a **schema mismatch problem**, not an AI reasoning problem.

**Incorrect AI Output for Cafe Faust:**
- ❌ "no outdoor seating" (there IS outdoor seating)
- ❌ "no seasonal offerings" (needs verification against menu data)
- ❌ "family occasions not relevant" (there IS a kids menu)
- ❌ "operates without a reservation system" (has DinnerBooking link)

**Root Cause:** Commercial strategy analyzer was built with **assumed schema** that doesn't match **actual production schema**.

---

## CRITICAL SCHEMA MISMATCHES

### 1. Menu Analysis Completely Broken ❌

**What the analyzer queries:**
```typescript
.select('price, dish_name, description')
```

**What actually exists in menu_items_normalized:**
- `item_price` (not `price`)
- `item_name` (not `dish_name`)
- `item_description` (not `description`)

**Impact:**
- Menu query returns **zero results** or fails silently
- AI receives: `item_count: 0`, `has_seasonal_items: false`, `price_point: undefined`
- AI concludes: "No menu data available, no seasonal offerings"

**Evidence in DB Schema (DATABASE-COMPLETE-MAPPING.md, line 555-590):**
```
menu_items_normalized columns:
- item_name (text, NOT NULL)
- item_description (text)
- item_price (text)
- is_seasonal (boolean, DEFAULT FALSE) ← EXISTS BUT IGNORED
- is_signature (boolean, DEFAULT FALSE)
- seasonal_ingredients (text[])
```

**What SHOULD happen:**
1. Query correct column names: `item_name, item_description, item_price`
2. Use `is_seasonal` flag directly instead of text search
3. Check `seasonal_ingredients` array for better detection

---

### 2. Kids Menu Data Completely Ignored ❌

**What the analyzer checks:**
- Nothing. The field is never queried.

**What exists in business_operations:**
- `has_kids_menu` (boolean, DEFAULT FALSE) — Added in migration 20260118000001

**Impact:**
- AI has **zero visibility** into family-friendly offerings
- Mother's Day and Father's Day triggers get disabled for businesses WITH kids menus
- AI reasoning: "not relevant since there are no family-oriented services"

**Evidence in DB Schema (line 194):**
```
business_operations.has_kids_menu | boolean | DEFAULT FALSE | Kids menu available
```

**What SHOULD happen:**
1. Query `has_kids_menu` from business_operations
2. Pass it to the prompt as `has_kids_menu: boolean`
3. Update trigger logic: MD_WEEK and FD_WEEK should enable if has_kids_menu=true

---

### 3. Outdoor Seating Detection Fails ❌

**What the analyzer queries:**
```typescript
outdoor_seating_capacity // expects a number
```

**What exists in business_operations:**
- `seating_capacity_outdoor` (integer) — Actual name
- `has_outdoor_seating` (boolean, DEFAULT FALSE) — More reliable signal

**Impact:**
- If `seating_capacity_outdoor` is NULL but `has_outdoor_seating` is TRUE, AI thinks: "None"
- WEATHER_BREAK trigger gets disabled incorrectly
- User says: "There is outdoor seating, but not info of number of seat"

**Evidence in DB Schema (line 188-189):**
```
seating_capacity_indoor  | integer  | - | Indoor seating capacity
seating_capacity_outdoor | integer  | - | Outdoor seating capacity
has_outdoor_seating      | boolean  | DEFAULT FALSE | Outdoor seating available
```

**What SHOULD happen:**
1. Query BOTH `has_outdoor_seating` (boolean) AND `seating_capacity_outdoor` (number)
2. Prompt should check: `has_outdoor_seating || outdoor_seating_capacity > 0`
3. If boolean is TRUE but capacity is NULL, treat as "outdoor seating exists, size unknown"

---

### 4. Reservation System Field Missing ❌

**What the analyzer queries:**
```typescript
has_reservation_system // DOES NOT EXIST
```

**What exists in business_operations:**
- `reservation_required` (boolean, DEFAULT FALSE)
- `accepts_walk_ins` (boolean, DEFAULT TRUE)

**What we just tried to fix:**
- Created migration 20260505000004_add_has_reservation_system.sql
- But this proves the **analyzer was built against a different schema**

**Impact:**
- Query fails or returns NULL
- AI defaults to: `has_reservation_system: false`
- Booking-oriented triggers (VD_WEEK, MD_WEEK, FD_WEEK) get disabled

**Evidence in Migration:**
- has_reservation_system is **NOT in original schema** (20260113000000)
- Was **assumed to exist** by commercial strategy code
- We had to add it manually via new migration

**What SHOULD happen:**
1. Migration should run successfully (we created it)
2. Backfill logic: if business has `booking_link` in business_brand_profile → set `has_reservation_system = TRUE`
3. Or: derive from `reservation_required=true OR booking_link IS NOT NULL`

---

### 5. Service Periods Field Dropped ❌

**What the analyzer queries:**
```typescript
service_periods // expects array or JSONB
```

**What exists in business_operations:**
- `primary_service_period` (text, CHECK IN breakfast/brunch/lunch/dinner/all_day/evening_only)

**What was removed:**
- `service_periods` (jsonb) — **Dropped in migration 20260420000002**

**Impact:**
- Query returns NULL or empty
- AI prompt receives: "Service periods: Not specified"
- Family triggers (brunch-oriented MD_WEEK) can't properly assess relevance

**Evidence in DB Schema (line 209):**
```
primary_service_period | text | CHECK IN (...) | Primary service focus (Added 20260420000002)
```

**Removed Columns (line 213):**
```
service_periods (Dropped 20260420000002)
```

**What SHOULD happen:**
1. Update analyzer to query `primary_service_period` (singular, text)
2. Convert to array in code: `[primary_service_period]`
3. Or: check if it includes 'brunch' for MD_WEEK relevance

---

### 6. Location Types Structure Mismatch ⚠️

**What the analyzer expects:**
```typescript
location_types?: string[] // Array with up to 4 values
```

**What might exist in business_location_intelligence:**
- Could be `location_type` (singular) with single value
- Or `location_types` (array) depending on migration history

**Needs verification:**
- Check actual column name in business_location_intelligence
- Check if it's text or text[]

**Evidence in DB Schema (line 253-280):**
```
business_location_intelligence has:
- category_scores (jsonb)
- location_type_matches (jsonb)
```

**Missing from documented schema:**
- Clear definition of `location_types` as standalone column

**What SHOULD happen:**
1. Verify actual column structure via direct DB query
2. Update analyzer to match reality
3. If location_type is singular, wrap in array: `[location_type]`

---

## DATA FLOW PROBLEMS

### Menu Seasonal Detection Logic Flaw

**Current approach:**
```typescript
// Text search for keywords
const seasonalKeywords = ['seasonal', 'season', 'forår', 'sommer', ...];
const has_seasonal_items = menuItems.some(item => {
  const text = `${item.dish_name || ''} ${item.description || ''}`.toLowerCase();
  return seasonalKeywords.some(keyword => text.includes(keyword));
});
```

**Problems:**
1. Column names are wrong (dish_name vs item_name)
2. Ignores explicit `is_seasonal` boolean flag
3. Text search misses items like "Strawberry Salad" (seasonal ingredient, no keyword)

**Better approach:**
```typescript
// Use explicit flag FIRST, then text search as backup
const has_seasonal_items = menuItems.some(item => item.is_seasonal) ||
  menuItems.some(item => item.seasonal_ingredients?.length > 0);
```

---

### Price Point Calculation Fails

**Current approach:**
```typescript
.filter(item => item.price && item.price > 0)
.map(item => item.price);
```

**Problems:**
1. Column is `item_price` (text), not `price` (number)
2. Text parsing required: "125 kr" → 125
3. Query returns empty array → `price_point: undefined`

**Evidence:**
- DB schema shows `item_price | text` (line 566)
- No numeric price column exists

**Better approach:**
```typescript
// Parse text prices
const prices = menuItems
  .map(item => {
    const match = item.item_price?.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
  })
  .filter(p => p !== null && p > 0);
```

---

## BUSINESS PROFILE GAPS

### Weekly Programme (Ugentligt program) Not Connected

**User note:**
> "local events is ad-hoc and will most likely be entered in manually (we do not have that now, and I do not expect it to in) expect if this in in Business profile under Ugentligt program"

**What exists in business_operations:**
- `weekly_programme` (jsonb) — Added in migration 20260418000004

**What commercial analyzer does:**
- **Nothing.** The field is never queried.

**Evidence in DB Schema:**
- Migration 20260418000004 added weekly_programme column
- Comment says: "Recurring events that AI can't find on website — happy hour, quiz night, DJ, live music, Friday brunch, etc."

**Impact:**
- LOCAL_EVENT trigger decisions made without knowledge of recurring events
- AI can't factor in "Friday brunch" when assessing MD_WEEK relevance
- User-entered programme data is completely ignored

**What SHOULD happen:**
1. Query `weekly_programme` from business_operations
2. Parse JSONB to extract recurring events
3. Pass to prompt: "Recurring weekly events: Friday brunch, Thursday quiz night"
4. Use for LOCAL_EVENT trigger reasoning

---

## PROMPT LOGIC ISSUES

### Weather Trigger Logic Too Strict

**Prompt guideline:**
> "Weather relevance: Only enable weather triggers if outdoor seating is significant (15+ seats)."

**Problem:**
- User says: "There is outdoor seating, but not info of number of seat"
- If capacity is NULL but `has_outdoor_seating=true`, AI sees "None"
- Weather trigger disabled even though outdoor seating exists

**Better logic:**
```
IF has_outdoor_seating = TRUE:
  IF seating_capacity_outdoor >= 15:
    → HIGH priority weather trigger
  ELSE IF seating_capacity_outdoor IS NULL:
    → MODERATE priority (assume small terrace)
  ELSE:
    → LOW priority (1-5 seats)
```

---

### Family Trigger Logic Ignores Kids Menu

**Prompt guideline:**
> "MD_WEEK - Mother's Day: Relevant for brunch service, family-friendly venues"

**Current inputs:**
- `service_periods` (but field doesn't exist)
- No kids menu data at all

**Problem:**
- Cafe Faust has kids menu → family-friendly
- But AI has no way to know this
- MD_WEEK gets disabled

**Better logic:**
```
MD_WEEK should enable IF:
  - has_kids_menu = TRUE, OR
  - primary_service_period includes 'brunch', OR
  - brand_essence includes 'family'
```

---

## SUMMARY OF GAPS

| Data Point | Exists in DB? | Queried by Analyzer? | Impact if Missing |
|------------|---------------|---------------------|-------------------|
| **has_kids_menu** | ✅ business_operations | ❌ NO | Family triggers disabled incorrectly |
| **has_outdoor_seating** | ✅ business_operations | ❌ NO (only checks capacity) | Weather trigger disabled |
| **seating_capacity_outdoor** | ✅ business_operations | ✅ YES (wrong name) | Returns NULL, AI sees "None" |
| **has_reservation_system** | ❌ MISSING (we added) | ✅ YES | All booking triggers fail |
| **is_seasonal (menu flag)** | ✅ menu_items_normalized | ❌ NO (text search instead) | Seasonal detection fails |
| **seasonal_ingredients** | ✅ menu_items_normalized | ❌ NO | Better seasonal detection missed |
| **item_name/price/desc** | ✅ menu_items_normalized | ❌ WRONG NAMES | Menu analysis completely fails |
| **primary_service_period** | ✅ business_operations | ❌ NO (queries old field) | Brunch detection fails |
| **weekly_programme** | ✅ business_operations | ❌ NO | Recurring events ignored |
| **booking_link** | ✅ business_brand_profile | ❌ NO | Reservation capability invisible |

---

## RECOMMENDED FIX SEQUENCE (NO CODE)

### Phase 1: Schema Alignment (Critical)
1. **Run migration 20260505000004** to add `has_reservation_system` column
2. **Backfill reservation data**: Set `has_reservation_system=TRUE` where `booking_link IS NOT NULL` in business_brand_profile
3. **Verify outdoor seating data**: Query Cafe Faust to check if `has_outdoor_seating` is TRUE
4. **Verify kids menu data**: Query Cafe Faust to check if `has_kids_menu` is TRUE

### Phase 2: Menu Data Integrity
1. **Verify menu items exist** for Cafe Faust in menu_items_normalized
2. **Check is_seasonal flags** on menu items
3. **Check seasonal_ingredients** arrays
4. **Parse item_price** text to confirm price point can be calculated

### Phase 3: Code Updates (Required for Fix)
1. **Fix menu query** column names: price→item_price, dish_name→item_name, description→item_description
2. **Add has_kids_menu** to business_operations query and prompt context
3. **Add has_outdoor_seating** to business_operations query
4. **Update outdoor_seating_capacity** to seating_capacity_outdoor
5. **Replace service_periods** query with primary_service_period
6. **Add weekly_programme** query and parsing logic
7. **Use is_seasonal flag** instead of text search for seasonal detection
8. **Cross-reference booking_link** from business_brand_profile to verify reservation capability

### Phase 4: Prompt Logic Updates
1. **Relax weather trigger logic** to enable if has_outdoor_seating=TRUE even without capacity number
2. **Add kids menu logic** to MD_WEEK and FD_WEEK trigger decisions
3. **Add brunch logic** using primary_service_period for MD_WEEK
4. **Add weekly_programme context** to LOCAL_EVENT reasoning

### Phase 5: Data Quality Checks
1. **For all businesses**: Run query to check how many have NULL vs actual values for key fields
2. **Identify data entry gaps**: Which businesses need outdoor seating capacity filled in?
3. **Create data quality dashboard**: Track completeness of has_kids_menu, has_outdoor_seating, weekly_programme

---

## IMMEDIATE ACTION FOR CAFE FAUST

**To fix Cafe Faust's incorrect analysis right now:**

1. **Run SQL:**
```sql
-- Add missing column
RUN supabase/migrations/20260505000004_add_has_reservation_system.sql

-- Set correct flags for Cafe Faust
UPDATE business_operations
SET 
  has_reservation_system = TRUE,
  has_outdoor_seating = TRUE,
  has_kids_menu = TRUE  -- VERIFY THIS FIRST
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';
```

2. **Verify menu data exists:**
```sql
SELECT COUNT(*), 
       COUNT(*) FILTER (WHERE is_seasonal = TRUE) as seasonal_items,
       COUNT(*) FILTER (WHERE seasonal_ingredients IS NOT NULL) as items_with_seasonal_ingredients
FROM menu_items_normalized
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';
```

3. **Then regenerate brand profile**

**Expected outcome after data fix:**
- AI should see: reservation system, outdoor seating, kids menu
- VD_WEEK, MD_WEEK, FD_WEEK triggers should enable
- WEATHER_BREAK should enable
- Summary text should reflect family-friendly + outdoor + reservations

---

## WHY THIS HAPPENED

**Root cause:** Commercial strategy analyzer was likely **developed against a test database** or **older schema version** that had:
- `price`, `dish_name`, `description` columns in menu table
- `has_reservation_system` column in business_operations
- `service_periods` (plural, JSONB) in business_operations

**When it was deployed to production:**
- Real schema had different column names
- Some fields were dropped in migrations (service_periods)
- Some fields never existed (has_reservation_system)
- Some fields exist but were never queried (has_kids_menu, weekly_programme)

**This is a classic integration testing gap:** Code works in dev environment, silently fails in production because schema doesn't match assumptions.

---

## CONCLUSION

The AI is **reasoning correctly** based on the data it receives. The problem is the data it receives is **fundamentally incomplete and incorrect** due to schema mismatches.

**Current state:**
- Menu analysis: **100% broken** (wrong column names)
- Kids menu detection: **0% coverage** (field not queried)
- Outdoor seating: **partial** (capacity queried, boolean ignored)
- Reservations: **broken** (field missing, now being fixed)
- Seasonal offerings: **unreliable** (text search instead of flags)

**After fixes:**
- All data points should flow correctly to AI
- Cafe Faust should get accurate commercial strategy
- Other businesses should also improve significantly

**Next step:** Fix the schema mismatches in code, then regenerate all commercial strategies for accuracy.
