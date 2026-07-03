# Layer 1 Programme Detection - Logic Assessment
**Comprehensive Analysis of Detection Strategy**

Date: May 7, 2026  
Status: Assessment (No Code Changes)

---

## Overview: The Detection Approach

Layer 1 uses **deterministic pattern matching** (not AI) to detect business programmes from two data sources:

1. **Menu Data** → Evidence that a programme exists (keywords in service_periods, menu_titles)
2. **Opening Hours** → Time windows when each programme operates

### Core Strategy
```
IF (menu contains 'brunch' OR 'morgenmad' keywords)
  THEN detect 'morning' programme
  AND assign time window (from hours OR hardcoded 07:00-11:00)
```

---

## Architecture: How It Works

### Three-Step Process

**Step 1: Extract Menu Evidence**
- Reads `menu_items_normalized.service_periods[]` array
- Reads `menu_items_normalized.menu_title` field
- Creates two lists:
  - `menuServicePeriods`: all unique values from service_periods arrays
  - `menuTitles`: all unique menu titles

**Step 2: Analyze Opening Hours**
- Groups opening_hours by time pattern (e.g., "09:00-23:00")
- Identifies if business has one time pattern (all-day) or multiple patterns
- Creates `timePatterns[]` array with start, end, days

**Step 3: Match Programmes**
- For each programme type (morning, lunch, dinner, bar):
  - Check if ANY keyword matches menuServicePeriods OR menuTitles
  - If match found → programme detected
- Then assign time windows:
  - **Single programme** → try to match opening hours
  - **Multiple programmes** → use hardcoded time windows

---

## The Keyword Matching System

### Programme Type: MORNING
**Hardcoded Window:** 07:00-11:00  
**Keywords:** `['brunch', 'morgenmad', 'breakfast', 'morgen']`

**Evidence Sources:**
- service_periods contains: 'brunch', 'morgenmad', 'breakfast', or 'morgen'
- menu_title contains: 'brunch', 'morgenmad', 'breakfast', or 'morgen'

### Programme Type: LUNCH
**Hardcoded Window:** 11:00-15:00  
**Keywords:** `['frokost', 'lunch', 'middag']`

**Evidence Sources:**
- service_periods contains: 'frokost', 'lunch', or 'middag'
- menu_title contains: 'frokost', 'lunch', or 'middag'

### Programme Type: DINNER
**Hardcoded Window:** 17:00-22:00  
**Keywords:** `['aftensmad', 'dinner', 'aften', 'middag']`

**Evidence Sources:**
- service_periods contains: 'aftensmad', 'dinner', 'aften', or 'middag'
- menu_title contains: 'aftensmad', 'dinner', 'aften', or 'middag'

### Programme Type: BAR
**Hardcoded Window:** 22:00-02:00  
**Keywords:** `['bar', 'drinks', 'cocktails', 'natteliv']`

**Evidence Sources:**
- service_periods contains: 'bar', 'drinks', 'cocktails', or 'natteliv'
- menu_title contains: 'bar', 'drinks', 'cocktails', or 'natteliv'

---

## Critical Design Flaw: The Keyword Alignment Gap

### The Problem

**Normalization Layer** (menu worker):
```sql
WHEN LOWER(v_menu_title) LIKE '%aften%' 
  THEN v_service_periods := ARRAY['dinner'];  -- Assigns ENGLISH
```

**Detection Layer** (programme-detection.ts):
```typescript
keywords: ['aftensmad', 'dinner', 'aften', 'middag']  // Searches for BOTH
```

### Why This Works... Sometimes

**Scenario 1: Menu title "AFTEN"**
- Normalization: pattern matches `%aften%` → assigns `['dinner']`
- Detection: searches for 'aften' in menu_title → ❌ MISSES (searches service_periods only)
- Detection: searches for 'dinner' in service_periods → ✅ FINDS
- **Result:** Programme DETECTED (by accident - found English translation)

**Scenario 2: Menu title "FROKOST"**
- Normalization: pattern matches `%frokost%` → assigns `['lunch']`
- Detection: searches for 'frokost' in menu_title → should find... but depends on execution
- Detection: searches for 'lunch' in service_periods → ✅ should find
- **Result:** Should be DETECTED

**Scenario 3: Menu title "Aftensmad" (formal Danish)**
- Normalization: pattern checks `%aften%` → ✅ MATCHES → assigns `['dinner']`
- Detection: searches for 'aftensmad' in menu_title → ✅ FINDS
- Detection: also finds 'dinner' in service_periods → double evidence
- **Result:** Programme DETECTED

### The Actual Bug

Look at lines 217-235 in programme-detection.ts:

```typescript
const hasMenuEvidence = definition.keywords.some(keyword => {
  // Check service periods
  const foundInPeriods = menuServicePeriods.some(period => 
    period.includes(keyword)
  )
  if (foundInPeriods) {
    menuEvidence.push(`service_period: ${keyword}`)
  }
  
  // Check menu titles
  const foundInTitles = menuTitles.some(title => 
    title.includes(keyword)
  )
  if (foundInTitles) {
    menuEvidence.push(`menu_title: ${keyword}`)
  }
  
  return foundInPeriods || foundInTitles
})
```

**What This Does:**
1. Searches `menuServicePeriods` (extracted from normalized items)
2. Searches `menuTitles` (raw menu title field)

**Why AFTEN Menu Gets Detected:**
- menuServicePeriods = `['dinner']` (from normalization)
- menuTitles = `['aften']` (raw menu title)
- Keywords = `['aftensmad', 'dinner', 'aften', 'middag']`
- Detection finds 'dinner' in menuServicePeriods → ✅
- Detection finds 'aften' in menuTitles → ✅
- **Programme should be detected!**

---

## The Real Mystery: Why Only 2 of 4?

### What We Know
- **Detected:** Morgenmad/Brunch, Bar/Drinks (2 programmes)
- **Missing:** Frokost, Aftensmad (2 programmes)

### Hypothesis 1: Menu Titles Don't Match Pattern

**If menu_title = "Aftenmenu"** (not "AFTEN"):
- Normalization checks: `LOWER(v_menu_title) LIKE '%aften%'`
- "aftenmenu" contains "aften" → ✅ SHOULD MATCH
- Assigns: `['dinner']`
- Detection: finds 'dinner' in service_periods → ✅ SHOULD DETECT

**If menu_title = "A la carte - Aften"**:
- Contains "aften" → should match
- Should work

**If menu_title = "Evening Menu"** (English):
- Pattern checks: `%dinner%`
- "evening menu" contains "dinner"? → ❌ NO
- Pattern checks: `%aften%` → ❌ NO
- Falls through to default → `[]` empty
- Detection searches for 'dinner' in service_periods → ❌ NOT FOUND
- **Programme NOT detected**

### Hypothesis 2: service_periods is Empty

**If normalization fails:**
- v_service_periods remains `[]` empty
- menuServicePeriods = `[]`
- Detection only finds evidence in menuTitles
- If menuTitles also empty or doesn't match → NOT DETECTED

**Why normalization might fail:**
- menuPeriods (Priority 1) exists but has wrong format
- service_periods (Priority 2) exists and overrides with empty array
- Pattern matching (Priority 3) never executes

### Hypothesis 3: Case Sensitivity Issue

**Pattern matching uses LOWER():**
```sql
WHEN LOWER(v_menu_title) LIKE '%aften%'
```

**But item.menu_title might be:**
- NULL → no title stored
- "" empty string
- "  " whitespace only
- Different casing with special characters

**Detection uses .includes():**
```typescript
title.includes(keyword)  // Both already lowercased
```

Should work... unless:
- `menuTitles` array construction fails
- Some items have menu_title but most don't
- Different menus have different title formats

---

## The Multi-Programme Time Window Problem

### Lines 263-273: The Hardcoded Logic

```typescript
} else {
  // Multiple programmes: use standard time windows (don't try to match opening hours)
  // This prevents all programmes from showing the same "all-day" window
  detectedProgrammes.push({
    type,
    label: definition.label,
    timeWindow: {
      start: definition.start,  // HARDCODED: 07:00, 11:00, 17:00, 22:00
      end: definition.end        // HARDCODED: 11:00, 15:00, 22:00, 02:00
    },
```

### The Issue

**For Café Faust:**
- Opens: 09:00 (not 07:00)
- Has 4 programmes detected
- Triggers multi-programme logic
- Shows: "Morgenmad: 07:00-11:00" ← WRONG! Should be 09:00-11:00
- Shows: "Bar: 22:00-02:00" ← Might be wrong, depends on actual closing time

**The Comment Explains Why:**
> "This prevents all programmes from showing the same 'all-day' window"

**The Intent:**
- If business is open 09:00-23:00 continuously
- Don't show ALL programmes as "09:00-23:00"
- Instead, partition the day into logical segments

**The Flaw:**
- Partitioning is fine for RELATIVE time (lunch comes after breakfast)
- But using absolute hardcoded times ignores ACTUAL opening hours
- Better approach: partition proportionally within actual hours

### What It SHOULD Do

**Option A: Proportional Partitioning**
- Business hours: 09:00-23:00 (14 hours)
- 4 programmes detected
- Divide equally: 3.5 hours each
  - Morgenmad: 09:00-12:30
  - Frokost: 12:30-16:00
  - Aften: 16:00-19:30
  - Bar: 19:30-23:00

**Option B: Smart Partitioning Based on Typical Patterns**
- Use hardcoded OFFSETS not absolute times
- Morgenmad: opening_time + 0 hours → opening_time + 2 hours
- Frokost: morgenmad_end → morgenmad_end + 3 hours
- Dinner: business_opens + 8 hours → closing_time - 1 hour
- Bar: closing_time - 1 hour → closing_time

**Option C: Use Menu-Extracted Time Windows**
- If GPT-4o extracts "🕐 17.30-21.30" from menu
- Store in structured_data.timeWindow
- Use those actual times instead of hardcoded windows
- Fallback to smart partitioning only if no time data

---

## Missing Evidence Source: URL Paths

### What's NOT Being Used

**Available Data:**
```
menu_results_v2.source_url = "https://cafefaust.dk/menukort/aften/"
                                                          ↑↑↑↑↑↑
                                                    Contains 'aften'
```

**Current Logic:**
- ❌ Never checks source_url
- ✅ Only checks menu_title and service_periods

### Why URLs Are Valuable

**URL Structure Patterns:**
- `/menukort/morgenmad/` → Breakfast menu
- `/menukort/frokost/` → Lunch menu
- `/menukort/aften/` → Dinner menu
- `/menukort/bar/` → Bar/drinks menu

**Benefits:**
1. **High Reliability:** URLs are structured, not free text
2. **Danish Keywords:** Uses actual Danish terms from restaurant
3. **Unambiguous:** URL path is clear categorization
4. **Always Present:** source_url is always populated (how else did we fetch it?)

**Evidence Quality:**
- menu_title: might be missing, might be in English, might be ambiguous
- service_periods: derived from normalization (can fail)
- source_url: primary source, always Danish, clear intent

### Where to Add URL Checking

**In Normalization (menu worker):**
Add Priority 0 before checking menuPeriods:
```
Priority 0: Extract from source_url path
Priority 1: Extract from menuPeriods
Priority 2: Use parent service_periods
Priority 3: Pattern match menu title
```

**In Detection:**
Pass source_url to menu items
Check URL in addition to title and periods

---

## Assessment: Strengths & Weaknesses

### ✅ Strengths

**1. Deterministic & Transparent**
- No AI randomness
- Easy to debug (exact keyword matching)
- Predictable results

**2. Multi-Language Support**
- Keywords include both Danish and English
- Handles variations (aften/aftensmad, frokost/lunch)

**3. Dual Evidence Sources**
- Checks both service_periods AND menu_titles
- Increases detection rate

**4. Confidence Scoring**
- High confidence when menu evidence + matching hours
- Medium confidence when evidence + adjusted hours
- Low confidence when only inferred from hours

**5. Single vs Multi-Programme Logic**
- Recognizes different detection strategies needed
- Single programme: match exact hours
- Multi programmes: partition the day

### ❌ Weaknesses

**1. Keyword Translation Mismatch**
- Normalization assigns English ('dinner')
- Detection searches both ('aften', 'dinner')
- Works by accident, but fragile
- **Impact:** Medium - works but unpredictable

**2. Ignores URL Evidence**
- Most reliable evidence source unused
- URLs always contain Danish keywords
- **Impact:** HIGH - missing detection opportunities

**3. Hardcoded Multi-Programme Windows**
- Shows wrong opening times (07:00 vs actual 09:00)
- Doesn't respect actual business hours
- **Impact:** HIGH - user sees incorrect information

**4. No Time Window Extraction**
- GPT-4o extracts "🕐 17.30-21.30" but it's not stored/used
- Could show actual programme hours
- **Impact:** MEDIUM - shows approximate times instead of exact

**5. Pattern Matching Fragility**
- LIKE '%aften%' works for "AFTEN", "Aftenmenu"
- Fails for "Evening Menu", "À la carte"
- No stemming, no fuzzy matching
- **Impact:** MEDIUM - works for Danish sites, fails for international

**6. Single-Pass Keyword Check**
- Uses `.some()` - stops at first match
- Doesn't count evidence strength
- Programme with 1 item gets same confidence as 50 items
- **Impact:** LOW - confidence field exists but underutilized

**7. menuTitles Might Be Empty**
- Depends on menu_items_normalized.menu_title field
- If normalization doesn't populate it → empty array
- Detection loses one evidence source
- **Impact:** Depends on data quality

---

## The Café Faust Anomaly

### Expected Behavior

**4 Menus (from your evidence):**
1. MORGENMAD/BRUNCH → should detect 'brunch' or 'morgenmad'
2. FROKOST → should detect 'frokost' or 'lunch'
3. AFTEN → should detect 'aften' or 'dinner'
4. BAR → should detect 'bar' or 'drinks'

**143 Items Normalized** → All should have service_periods assigned

**Detection Should Find:**
- menuServicePeriods: ['breakfast', 'lunch', 'dinner', 'bar'] (English from normalization)
- menuTitles: ['morgenmad', 'frokost', 'aften', 'bar'] (Danish from original titles)
- Keywords match → ALL 4 programmes detected

### Actual Behavior

**Only 2 Detected:**
- Morgenmad/Brunch ✅
- Bar/Drinks ✅
- Frokost ❌
- Aftensmad ❌

### Why This Doesn't Make Sense

**AFTEN Menu:**
- User showed: 36 items, clear title "AFTEN"
- Normalization should assign: service_periods = ['dinner']
- Detection should find: 'dinner' in menuServicePeriods OR 'aften' in menuTitles
- **Should be detected**

**Possible Explanations:**

**A) menuServicePeriods is NOT ['breakfast', 'lunch', 'dinner', 'bar']**
- Maybe it's ['brunch', 'bar'] only
- FROKOST items got empty service_periods
- AFTEN items got empty service_periods
- Only BRUNCH and BAR items populated correctly

**B) menuTitles is NOT ['morgenmad', 'frokost', 'aften', 'bar']**
- Maybe menu_title field is NULL for most items
- Only 2 menus have titles populated
- Detection only finds 2

**C) Keywords Don't Match What's Actually There**
- FROKOST menu stored as "Lunch Menu" (English)
- Pattern doesn't match 'lunch' → assigns empty
- AFTEN menu stored as "À la carte" (French)
- Pattern doesn't match → assigns empty

---

## Root Cause Diagnosis

### What We Need to Know (Can't See Without Data)

**1. What's in menuServicePeriods?**
```typescript
const menuServicePeriods = extractServicePeriodsFromMenu(menuItems)
console.log('menuServicePeriods:', menuServicePeriods)
// Expected: ['brunch', 'lunch', 'dinner', 'bar'] or Danish equivalents
// Actual: ['brunch', 'bar'] ???
```

**2. What's in menuTitles?**
```typescript
const menuTitles = extractMenuTitles(menuItems)
console.log('menuTitles:', menuTitles)
// Expected: ['aften', 'frokost', 'morgenmad', 'bar']
// Actual: [???]
```

**3. What's in menu_items_normalized for AFTEN items?**
```sql
SELECT DISTINCT 
  service_periods,
  menu_title,
  menu_url,
  COUNT(*)
FROM menu_items_normalized
WHERE business_id = '2037d63c...'
  AND (menu_url LIKE '%aften%' OR menu_title ILIKE '%aften%')
GROUP BY 1,2,3;
```

**4. What's the raw structured_data from GPT-4o extraction?**
```sql
SELECT 
  structured_data->>'menuTitle',
  structured_data->'menuPeriods',
  jsonb_object_keys(structured_data)
FROM menu_results_v2
WHERE source_url LIKE '%aften%';
```

### The Diagnostic Questions

1. **Do AFTEN items have service_periods?** → If NO: normalization bug
2. **Do AFTEN items have menu_title?** → If NO: extraction or normalization bug
3. **Does structured_data contain menuPeriods?** → If YES: why not used?
4. **Does structured_data contain timeWindow?** → If YES: why not used?
5. **Are FROKOST and AFTEN patterns different from BRUNCH and BAR?** → What makes 2 work and 2 fail?

---

## Recommendations (Assessment Only)

### Priority 1: Add URL Evidence Checking
**Impact:** HIGH  
**Effort:** LOW  
**Rationale:** URLs are the most reliable evidence source and always available

### Priority 2: Fix Multi-Programme Time Windows
**Impact:** HIGH  
**Effort:** MEDIUM  
**Rationale:** Showing 07:00 start when business opens 09:00 is user-facing error

### Priority 3: Extract and Use Menu Time Windows
**Impact:** MEDIUM  
**Effort:** HIGH  
**Rationale:** GPT-4o already extracts this data, just need to store and use it

### Priority 4: Bilingual service_periods Assignment
**Impact:** MEDIUM  
**Effort:** LOW  
**Rationale:** Assign both Danish and English to reduce fragility

### Priority 5: Add Logging to Detection
**Impact:** LOW (debugging only)  
**Effort:** LOW  
**Rationale:** Can't diagnose without seeing what detection actually receives

### Priority 6: Strengthen Pattern Matching
**Impact:** LOW  
**Effort:** MEDIUM  
**Rationale:** Most Danish restaurants use Danish keywords, edge case only

---

## Conclusion

**The detection logic is fundamentally sound** - it checks the right evidence sources and uses reasonable keyword matching.

**The bugs are execution-level, not design-level:**
1. Multi-programme time windows use hardcoded absolute times instead of respecting actual hours
2. URL evidence completely ignored despite being most reliable
3. Possible data quality issue where some menus don't get service_periods assigned

**The Café Faust mystery suggests:**
- 2 menus (BRUNCH, BAR) have complete data → detected
- 2 menus (FROKOST, AFTEN) have incomplete data → not detected
- Need actual database query to confirm what data exists vs. what code expects

**Next step:** Query actual menu_items_normalized and menu_results_v2 data with service role access to see what normalization actually produced.
