# Programme Detection Analysis - Café Faust
**Data Audit Based on User-Provided Evidence**

## Evidence We Have (From User)

### Menu: AFTEN
- **Source:** https://cafefaust.dk/menukort/aften/
- **Items:** 36 items
- **Average Price:** 157 DKK
- **Time Window:** 🕐 17.30-21.30
- **Description:** Evening menu with varied dishes from appetizers to desserts

### Total Normalized Items
- User reported: 143 items normalized from 6 menu extractions
- V5 Edge Function logs: "✅ Menu: 143 items"

### Detected Programmes (Current)
1. **Morgenmad/Brunch** (07:00-11:00) - 1 menu evidence
2. **Bar/Drinks** (22:00-02:00) - 1 menu evidence

### Missing Programmes
- **Frokost** (lunch) - NOT detected
- **Aftensmad** (dinner) - NOT detected despite AFTEN menu existing

---

## Analysis: What We HAVE vs What We USE

### ✅ Data That EXISTS (Based on AFTEN Example)

**From URL Structure:**
```
https://cafefaust.dk/menukort/aften/
                              ↑
                    Keyword: "aften" (dinner)
```

**From Menu Metadata (shown in UI):**
- Menu title: "AFTEN"
- Time window: 17.30-21.30
- Item count: 36 items
- Description mentions: forretter (appetizers), hovedretter (mains), desserter (desserts)

**Expected for Other Menus:**
If AFTEN menu has this structure, likely the other menus do too:
- `/menukort/morgenmad/` → Morgenmad menu
- `/menukort/frokost/` → Frokost menu
- `/menukort/bar/` → Bar menu

### ❌ Data That's NOT BEING USED

**1. Time Window Data**
- **EXISTS:** 17.30-21.30 (shown in UI)
- **FIELD LOCATION:** Unknown - could be:
  - `structured_data.timeWindow`
  - `structured_data.serviceHours`
  - Embedded in description
- **NORMALIZATION:** Code doesn't check timeWindow field
- **IMPACT:** Programme times are hardcoded (17:00-22:00) instead of using actual times (17:30-21:30)

**2. URL Path Keywords**
- **EXISTS:** `/menukort/aften/` contains "aften"
- **AVAILABLE IN:** `menu_results_v2.source_url` field
- **NORMALIZATION:** Code checks `menuTitle` but NOT `source_url`
- **IMPACT:** Missing reliable service period evidence

**3. Menu Title**
- **EXISTS:** "AFTEN" 
- **NORMALIZATION:** Pattern matches `LIKE '%aften%'` → assigns `['dinner']`
- **DETECTION:** Searches for keywords `['aftensmad', 'dinner', 'aften', 'middag']`
- **PROBLEM:** Normalization assigns 'dinner', detection searches for 'aften'
  - If detection finds 'dinner' → ✅ matches
  - If detection finds 'aften' in menu_title directly → might not match service_periods

---

## Gap Analysis: Why Only 2 of 4 Programmes Detected

### Working Detection (2 programmes):

**Morgenmad/Brunch:**
- Menu title likely contains "BRUNCH" or "MORGENMAD"
- Pattern match assigns: `['breakfast']` or `['brunch']`
- Detection keywords: `['brunch', 'morgenmad', 'breakfast', 'morgen']`
- **Result:** ✅ MATCH (likely 'brunch' matched directly)

**Bar/Drinks:**
- Menu title likely contains "BAR" or "COCKTAIL"
- Pattern match assigns: `['bar']`
- Detection keywords: `['bar', 'drinks', 'cocktails', 'natteliv']`
- **Result:** ✅ MATCH ('bar' matched)

### Failed Detection (2 programmes):

**Frokost:**
- Menu title likely "FROKOST"
- Pattern match: `LIKE '%frokost%'` → assigns `['lunch']`
- Detection keywords: `['frokost', 'lunch', 'middag']`
- **Hypothesis:** Detection finds 'lunch' → ✅ should match
- **Alternative:** Pattern match failed (title doesn't contain 'frokost') → `[]` empty
- **Result:** ❌ NOT DETECTED

**Aftensmad:**
- Menu title: "AFTEN" (we know this exists)
- Pattern match: `LIKE '%aften%'` → assigns `['dinner']`
- Detection keywords: `['aftensmad', 'dinner', 'aften', 'middag']`
- **Expected:** Detection finds 'dinner' → ✅ should match
- **Result:** ❌ NOT DETECTED (contradiction!)

---

## The Mystery: Why is AFTEN Not Detected?

### What We Know:
1. AFTEN menu EXISTS (36 items, user showed evidence)
2. Menu title is "AFTEN"
3. Pattern matching SHOULD assign `service_periods = ['dinner']`
4. Detection SHOULD find 'dinner' or 'aften' keyword
5. BUT: Programme NOT detected

### Possible Explanations:

**Hypothesis 1: Menu Title Format Mismatch**
- Pattern checks: `LOWER(v_menu_title) LIKE '%aften%'`
- Menu title might be stored with extra formatting: "AFTEN " (trailing space), " AFTEN", "Aften Menu"
- TRIM not applied before LIKE check
- Result: Pattern doesn't match → empty service_periods

**Hypothesis 2: Service Periods Overwritten**
- Priority 1 (menuPeriods) might have wrong/empty value
- Priority 2 (parent service_periods) might override with wrong value
- Priority 3 (pattern match) never executes
- Result: Wrong service_periods assigned

**Hypothesis 3: Detection Searches Wrong Place**
- Detection might search `menu_title` field directly instead of `service_periods`
- Normalization assigns to `service_periods` array
- Detection looks in wrong field
- Result: Data exists but not found

**Hypothesis 4: Items Have Empty service_periods**
- Normalization runs but assigns empty arrays
- Menu title pattern doesn't match (case sensitivity, formatting)
- URL not checked (missed opportunity)
- Result: All 36 AFTEN items get `service_periods = []`

---

## Required Investigation (With Service Role Access)

To solve this, need to query actual data:

```sql
-- What service_periods did AFTEN items get?
SELECT DISTINCT service_periods, menu_title, menu_url, COUNT(*)
FROM menu_items_normalized
WHERE business_id = '2037d63c...'
  AND menu_url LIKE '%aften%'
GROUP BY service_periods, menu_title, menu_url;

-- What's in the structured_data for AFTEN menu?
SELECT 
  source_url,
  structured_data->>'menuTitle',
  structured_data->'menuPeriods',
  service_periods
FROM menu_results_v2
WHERE business_id = '2037d63c...'
  AND source_url LIKE '%aften%';

-- What does detection actually see?
-- (Check programme_profiles table for evidence field)
SELECT 
  programme_name,
  programme_type,
  menu_evidence
FROM business_programme_profiles
WHERE business_id = '2037d63c...';
```

---

## Likely Fix (Based on Analysis)

### Issue: Pattern Matching Incomplete

**Current Pattern Matching (Lines 68-78):**
```
WHEN LOWER(v_menu_title) LIKE '%aften%' 
  THEN v_service_periods := ARRAY['dinner'];
```

**Problems:**
1. Doesn't preserve original Danish keyword
2. Translates 'aften' → 'dinner' (English)
3. Detection searches for 'aften' (Danish) → won't find 'dinner'

**Fix:**
```
WHEN LOWER(v_menu_title) LIKE '%aften%' 
  THEN v_service_periods := ARRAY['aften', 'dinner'];
     -- Keep BOTH Danish and English
```

### Issue: URL Not Checked

**Current:** Normalization never looks at source_url
**Fix:** Add Priority 0 before menuPeriods:

```
-- Priority 0: Extract from URL path
IF NEW.source_url IS NOT NULL THEN
  CASE
    WHEN NEW.source_url LIKE '%/morgenmad/%' OR NEW.source_url LIKE '%/brunch/%' 
      THEN v_service_periods := ARRAY['morgenmad', 'brunch'];
    WHEN NEW.source_url LIKE '%/frokost/%' OR NEW.source_url LIKE '%/lunch/%'
      THEN v_service_periods := ARRAY['frokost', 'lunch'];
    WHEN NEW.source_url LIKE '%/aften/%' OR NEW.source_url LIKE '%/dinner/%'
      THEN v_service_periods := ARRAY['aften', 'dinner'];
    WHEN NEW.source_url LIKE '%/bar/%' OR NEW.source_url LIKE '%/cocktail/%'
      THEN v_service_periods := ARRAY['bar', 'drinks'];
  END CASE;
END IF;
```

### Issue: Time Windows Hardcoded

**Current:** Uses hardcoded PROGRAMME_TIME_WINDOWS
**Fix:** Use actual time data from extraction
- Check if `structured_data.timeWindow` exists
- Parse and use for programme time windows
- Fallback to hardcoded only if no time data

---

## Next Steps

1. **Get service_role access** to query actual data
2. **Verify hypothesis** about empty service_periods for AFTEN menu
3. **Check structured_data field names** (timeWindow vs serviceHours vs other)
4. **Implement fixes** based on confirmed root cause
5. **Test with re-normalization** of existing 143 items
