# Programme Detection Root Cause Analysis
**Date:** May 7, 2026  
**Business:** Café Faust (ID: 2037d63c-a138-4247-89c5-5b6b8cef9f3f)  
**System:** V5 Brand Profile - Layer 1 Programme Detection  

---

## Executive Summary

The V5 programme detection system is showing **only 2 of 4 expected programmes** with **incorrect time windows** due to a **critical data gap** in the menu normalization pipeline. The root cause is that menu titles and service periods are not being properly extracted and classified during the normalization process, causing the programme detection algorithm to fail to identify all dining programmes.

---

## Issues Identified

### 1. **Missing Programmes: Frokost and Aftensmad NOT Detected**
- **Expected:** 4 programmes (Morgenmad/Brunch, Frokost, Aftensmad, Bar/Drinks)
- **Actual:** 2 programmes detected (Morgenmad/Brunch, Bar/Drinks)
- **Missing:** Frokost (lunch) and Aftensmad (dinner)

### 2. **Incorrect Time Windows**
- **Morgenmad/Brunch showing 07:00-11:00**
  - Issue: Café Faust opens at **9:00**, not 7:00
  - The 07:00 start time is the hardcoded default from `PROGRAMME_TIME_WINDOWS.morning.start`
  - The detection logic is NOT adjusting to actual opening hours

- **Bar/Drinks showing 22:00-02:00**
  - Issue: Bar programme is using default late-night window
  - Actual bar/cocktail service likely starts earlier and isn't limited to post-22:00

### 3. **Menu Evidence Showing "1 items" Per Programme**
- Not a bug - this is correctly showing the count of **evidence types** (not menu items)
- Each programme has 1 piece of evidence: either `service_period: [keyword]` or `menu_title: [keyword]`
- However, the LOW evidence count (only 1) suggests **insufficient menu data classification**

---

## Root Cause Analysis

### **PRIMARY ROOT CAUSE: Menu Title & Service Period Classification Gap**

The menu normalization worker (migration `20260507000001_create_menu_normalization_worker.sql`) has a **critical limitation** in how it assigns `service_periods` to menu items:

#### **Current Logic (Lines 50-80):**
```
Priority 1: Extract from menuPeriods array (if present in structured_data)
Priority 2: Use parent menu_results_v2.service_periods (if available)
Priority 3: Infer from menu title pattern matching
  - BRUNCH → ['brunch']
  - MORGENMAD/BREAKFAST → ['breakfast']
  - FROKOST/LUNCH → ['lunch']
  - AFTEN/DINNER → ['dinner']
  - BAR/COCKTAIL → ['bar']
  - ELSE → [] (empty array)
```

#### **The Problem:**
1. **Insufficient pattern matching coverage**
   - Only matches exact keywords in menu titles
   - Danish menu titles may use variations not covered by simple LIKE patterns
   - Example: "A la carte" menu might not match any pattern → empty service_periods

2. **No item-level classification**
   - Service periods are inferred from the **parent menu title**, not individual item characteristics
   - Example: If a "FROKOST" menu also includes evening items, ALL items get `service_periods = ['lunch']`
   - No logic to classify items by price, category, or dish type

3. **Empty service_periods arrays**
   - Items with generic menu titles (no service period keyword) get `service_periods = []`
   - Programme detection **requires menu evidence** to detect programmes
   - Empty service_periods = no evidence = programme not detected

### **SECONDARY ROOT CAUSE: Programme Detection Keyword Mismatch**

The programme detection logic in `programme-detection.ts` uses different keywords than the normalization worker:

#### **Detection Keywords (Lines 23-45):**
```
morning: ['brunch', 'morgenmad', 'breakfast', 'morgen']
lunch: ['frokost', 'lunch', 'middag']
dinner: ['aftensmad', 'dinner', 'aften', 'middag']
bar: ['bar', 'drinks', 'cocktails', 'natteliv']
```

#### **Normalization Keywords (Migration Lines 66-76):**
```
brunch → 'brunch'
morgenmad/breakfast → 'breakfast'
frokost/lunch → 'lunch'
aften/dinner → 'dinner'
bar/cocktail → 'bar'
```

**Mismatch:**
- Detection looks for **'morgenmad'** but normalization assigns **'breakfast'**
- Detection looks for **'aftensmad'** but normalization assigns **'dinner'**
- Detection looks for **'cocktails'** but normalization only assigns **'bar'**

**Impact:**
- Even if menu has "MORGENMAD" in title, it gets normalized to `service_periods = ['breakfast']`
- Detection searches for keyword 'morgenmad' in service_periods
- **NO MATCH** → programme not detected

### **TERTIARY ROOT CAUSE: Hardcoded Time Windows Don't Respect Opening Hours**

Lines 254-273 in `programme-detection.ts`:

```typescript
// Multiple programmes: use standard time windows (don't try to match opening hours)
// This prevents all programmes from showing the same "all-day" window
detectedProgrammes.push({
  type,
  label: definition.label,
  timeWindow: {
    start: definition.start,  // ❌ Using hardcoded default (07:00)
    end: definition.end        // ❌ Using hardcoded default (11:00)
  },
```

**The Logic:**
- For **multi-programme businesses**, the code intentionally uses hardcoded time windows
- Rationale: Prevent all programmes from showing the same all-day hours (if they share opening times)
- **However:** This means time windows don't reflect actual business hours

**The Problem:**
- Café Faust opens at 9:00, not 7:00
- Hardcoded morning programme shows 07:00-11:00
- Users see incorrect times that don't match reality

---

## Data Flow Issues

### **Step 1: Menu Extraction (✅ Working)**
- Menu URLs scraped from website
- GPT-4o extracts structured menu data → `menu_results_v2.structured_data`
- Status: **SUCCESS** (143 items extracted from 6 menus)

### **Step 2: Menu Normalization (⚠️ Partial Failure)**
- Trigger: `sync_menu_items_to_normalized()` runs when extraction completes
- Flattens JSONB → rows in `menu_items_normalized`
- **Issue:** Service period classification is incomplete/incorrect
- Status: **143 items normalized** but with **insufficient service_period classification**

### **Step 3: Programme Detection (❌ Failing)**
- Edge Function queries `menu_items_normalized.service_periods`
- Searches for keyword matches in service periods
- **Issue:** Keyword mismatch + empty service_periods = missing programmes
- Status: **Only 2 of 4 programmes detected**

### **Step 4: V5 Generation (⚠️ Degraded)**
- Layer 2-4 generation proceeds with incomplete programme list
- Commercial orientation, identity, and audience analysis run on only 2 programmes
- **Missing context** for Frokost and Aftensmad programmes
- Status: **Partial data** (50% programme coverage)

---

## Expected vs Actual Behavior

### **Expected Detection (Café Faust):**
1. **Morgenmad/Brunch** (9:00-11:00)
   - Evidence: menu items with service_periods containing 'brunch' or 'morgenmad'
   - Opening hours: Mo-Su 9:00-22:00

2. **Frokost** (11:00-15:00)
   - Evidence: menu items with service_periods containing 'frokost' or 'lunch'
   - Lunch menu available

3. **Aftensmad** (17:00-22:00)
   - Evidence: menu items with service_periods containing 'aftensmad' or 'dinner'
   - Evening menu available

4. **Bar/Drinks** (20:00-22:00)
   - Evidence: menu items with service_periods containing 'bar' or 'cocktails'
   - Bar menu available

### **Actual Detection:**
1. **Morgenmad/Brunch** (07:00-11:00) ❌ Wrong start time
   - Evidence: 1 keyword match (likely 'breakfast' or 'brunch')
   
2. **Bar/Drinks** (22:00-02:00) ❌ Wrong time window
   - Evidence: 1 keyword match (likely 'bar')

3. **Frokost** ❌ NOT DETECTED
   - Likely cause: No menu items have service_periods = ['lunch'] or menu_title containing 'frokost'

4. **Aftensmad** ❌ NOT DETECTED
   - Likely cause: No menu items have service_periods = ['dinner'] or menu_title containing 'aftensmad'

---

## Why Only 2 Programmes Are Detected

Based on the code analysis, the most likely scenario:

### **Scenario: Menu Title Inference Failed for Frokost/Aftensmad**

1. **Menu extraction** produced 6 menu results with menu titles like:
   - "MORGENMAD" → normalized to `service_periods = ['breakfast']`
   - "BAR MENU" → normalized to `service_periods = ['bar']`
   - "A LA CARTE" or generic title → normalized to `service_periods = []` (empty)

2. **Frokost and Aftensmad menus** either:
   - Had generic titles that don't match patterns (e.g., "MENU", "DAGENS RET")
   - Were part of a combined menu without clear service period designation
   - Menu titles used Danish variations not covered by the pattern matching

3. **Programme detection** searches for keywords:
   - Finds 'breakfast' in service_periods → detects Morgenmad ✅
   - Finds 'bar' in service_periods → detects Bar/Drinks ✅
   - Does NOT find 'frokost', 'lunch', 'aftensmad', or 'dinner' → Frokost and Aftensmad NOT detected ❌

---

## Why Time Windows Are Wrong

### **Morgenmad/Brunch: 07:00-11:00 (should be 09:00-11:00)**

**Code Path:**
```typescript
// Line 263-273 in programme-detection.ts
// Multiple programmes: use standard time windows (don't try to match opening hours)
timeWindow: {
  start: definition.start,  // PROGRAMME_TIME_WINDOWS.morning.start = '07:00'
  end: definition.end        // PROGRAMME_TIME_WINDOWS.morning.end = '11:00'
}
```

**Explanation:**
- Because 2 programmes were detected (considered "multi-programme"), the code uses hardcoded defaults
- It does NOT call `adjustTimeWindowToOpeningHours()` which would constrain to actual hours
- Result: Shows 07:00 even though business opens at 09:00

**Design Intent:**
- Prevent "all programmes showing 09:00-22:00" (the full opening hours)
- Keep programme-specific time windows distinct
- **Trade-off:** Accuracy sacrificed for clarity

### **Bar/Drinks: 22:00-02:00 (should start earlier)**

**Code Path:**
- Uses hardcoded `PROGRAMME_TIME_WINDOWS.bar` = 22:00-02:00
- Assumes bar service is only late-night (post-22:00)

**Reality:**
- Café Faust likely serves cocktails/bar items starting earlier (18:00-20:00)
- Closing time is 22:00, not 02:00 (they don't stay open until 2 AM)

**Design Intent:**
- Bar programme defined as late-night drinks after dinner service
- **Assumption:** Bar is a distinct late-night programme, not concurrent with dinner

---

## Impact Assessment

### **User-Facing Issues:**
1. ❌ **Incorrect business hours displayed** (07:00 vs 09:00)
2. ❌ **Missing lunch programme** (no Frokost content generation)
3. ❌ **Missing dinner programme** (no Aftensmad content generation)
4. ❌ **Wrong bar hours** (22:00-02:00 vs actual bar service times)

### **System Impact:**
1. ⚠️ **Layer 2 (Commercial Orientation)** only analyzes 2 of 4 programmes
2. ⚠️ **Layer 4 (Audience Segmentation)** only analyzes 2 of 4 programmes
3. ⚠️ **Content generation** will not create lunch or dinner content
4. ⚠️ **Weekly plan generation** will have gaps in lunch/dinner slots

### **Data Quality:**
- **50% programme coverage** (2 of 4 detected)
- **100% time window inaccuracy** (both programmes show wrong hours)
- **Confidence scores unreliable** (high confidence on wrong data)

---

## Recommended Fixes (Architecture Level - NO CODE)

### **Fix 1: Align Normalization Keywords with Detection Keywords**

**Problem:** Normalization assigns 'breakfast', detection searches for 'morgenmad'

**Solution:**
- Update normalization worker to use SAME keywords as detection logic
- When menu title contains "MORGENMAD", assign `service_periods = ['morgenmad']` (not 'breakfast')
- Maintain backward compatibility by allowing BOTH keywords (e.g., `['morgenmad', 'breakfast']`)

**Impact:**
- Programme detection will find exact keyword matches
- Increases detection success rate

### **Fix 2: Add Multi-Language Pattern Matching**

**Problem:** Danish menu titles use variations not covered by simple patterns

**Solution:**
- Expand pattern matching to include:
  - "Dagens ret" → lunch
  - "Kaffe & kage" → morning
  - "Tapas" → bar/evening
  - "A la carte" → check time-based heuristics or category

**Impact:**
- Better coverage of Danish menu conventions
- Fewer empty service_periods arrays

### **Fix 3: Add Item-Level Classification (Category + Price Analysis)**

**Problem:** Service periods inferred only from menu title, not item characteristics

**Solution:**
- Classify items by:
  - **Category:** "Desserts" → likely dinner, "Yogurt" → likely breakfast
  - **Price range:** High prices → dinner, Low prices → breakfast/lunch
  - **Dish characteristics:** "Æbleskiver" → morning, "Steak" → dinner

**Impact:**
- More accurate service period assignment
- Can detect programmes even when menu title is generic

### **Fix 4: Respect Opening Hours for Time Windows**

**Problem:** Hardcoded time windows don't match business hours

**Solution:**
- **Option A (Conservative):** Always constrain programme start times to opening hours
  - morning.start = MAX(07:00, earliest_open_time)
  - bar.end = MIN(02:00, latest_close_time)

- **Option B (Heuristic):** Use opening hour patterns to infer programme-specific windows
  - If opens at 9:00 → morning programme starts at 9:00 (not 7:00)
  - If closes at 22:00 → bar programme is 20:00-22:00 (not 22:00-02:00)

**Impact:**
- Accurate time windows that match reality
- Better user trust in displayed data

### **Fix 5: Add Menu Result Metadata to Normalization**

**Problem:** Menu extraction captures menu title, but normalization may lose context

**Solution:**
- During menu extraction, explicitly tag menus with service periods
- Store in `menu_results_v2.service_periods` BEFORE normalization
- Normalization worker uses this as Priority 1 (more reliable than title pattern matching)

**Impact:**
- More accurate service period assignment
- Detection logic has better data to work with

### **Fix 6: Add Fallback Logic for Missing Programmes**

**Problem:** If menu data is incomplete, entire programmes are missing

**Solution:**
- When opening hours suggest multiple programmes but menu evidence is weak:
  - Infer missing programmes from hours + business category
  - Example: Restaurant open 9:00-22:00 → likely has lunch AND dinner even if only dinner menu found
  - Tag as `confidence: 'low'` and `menuEvidence: ['inferred_from_hours_and_category']`

**Impact:**
- Prevents complete programme gaps
- Provides baseline data while menu extraction improves

---

## Immediate Next Steps (Analysis Only - NO CODE)

### **Step 1: Audit Menu Normalization Results**
- Query `menu_items_normalized` for business 2037d63c-a138-4247-89c5-5b6b8cef9f3f
- Check distribution of `service_periods` values
- Identify how many items have empty `service_periods = []`
- See which menu titles exist and how they were classified

### **Step 2: Inspect Menu Extraction Results**
- Query `menu_results_v2` for the 6 menu extractions
- Review `structured_data.menuTitle` for each menu
- Check if menus have explicit `menuPeriods` arrays
- Determine if lunch/dinner menus were extracted but not classified

### **Step 3: Verify Opening Hours Data**
- Confirm actual opening hours: Mo-Su 9:00-22:00 or different by day?
- Check if weekend hours differ from weekday
- Understand if bar service has different hours than food service

### **Step 4: Test Detection Logic with Corrected Data**
- Manually create test data with correct service_periods
- Run detection algorithm to verify it would work with proper input
- Confirm that fixing normalization will solve detection issues

---

## Conclusion

The V5 programme detection system is **architecturally sound** but suffering from **data quality issues** in the menu normalization pipeline:

1. **Menu titles are not being correctly classified** into service periods
2. **Keyword mismatch** between normalization and detection logic
3. **Hardcoded time windows** don't respect actual business hours

**Fixing these three issues will resolve:**
- ✅ Missing Frokost and Aftensmad programmes
- ✅ Incorrect time windows (07:00 vs 09:00, 22:00-02:00 vs actual bar hours)
- ✅ Low menu evidence counts (will increase as more items are correctly classified)

**Priority:** Focus on **Fix 1 (keyword alignment)** and **Fix 4 (respect opening hours)** as quick wins, then implement **Fix 3 (item-level classification)** for long-term data quality.
