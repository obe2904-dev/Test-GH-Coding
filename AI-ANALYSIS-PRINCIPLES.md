# AI Analysis Principles - Data-First Investigation
**Created:** May 7, 2026  
**Purpose:** Prevent theorizing without evidence; ensure all analysis is grounded in actual system data

---

## Core Principle: INVESTIGATE, DON'T THEORIZE

**Never build theories about what data exists or doesn't exist without first querying the actual database.**

---

## The Failure Pattern to Avoid

### ❌ **What NOT to Do:**
1. Read code that processes data
2. See fallback logic or pattern matching
3. Assume: "The upstream data must be missing/incomplete"
4. Build entire analysis around that assumption
5. Propose fixes for problems that may not exist

### ✅ **What TO Do:**
1. **Query the actual data first**
2. Inspect 3-5 real examples
3. Map what exists vs what's used
4. Identify actual gaps (not assumed gaps)
5. Propose fixes based on evidence

---

## Mandatory Investigation Process

### Step 1: DATA AUDIT (Always First)
Before any analysis, answer these questions with **database queries**:

```
1. What data DO we have?
   - Query the source tables
   - Look at 3-5 real examples
   - Note all field names and values
   
2. What formats/structures exist?
   - Check JSONB structures
   - Check array contents
   - Check NULL vs empty vs populated
   
3. What's already captured?
   - Don't assume fields are missing
   - Check alternative field names
   - Check related tables
```

**CRITICAL: Never proceed to Step 2 without completing Step 1**

### Step 2: GAP ANALYSIS (Evidence-Based)
Compare what we have vs what we use:

```
1. Map the data flow:
   Source Data → Processing → Output → Usage
   
2. At each step, check:
   - What fields are READ?
   - What fields EXIST but aren't read?
   - What transformations happen?
   - What data is LOST?
   
3. Identify the actual gap:
   - "Field X exists but code reads field Y"
   - "Data exists in format A but code expects format B"
   - "URL contains info but we only check title"
```

### Step 3: ROOT CAUSE (Verify with Data)
Every root cause statement must be verifiable:

```
❌ BAD: "The extraction doesn't capture service periods"
✅ GOOD: "Queried menu_results_v2, found structured_data.menuTitle 
         exists but structured_data.menuPeriods is NULL in 6/6 samples"

❌ BAD: "Pattern matching fails because menus are varied"
✅ GOOD: "Checked 50 menus, 23 have titles not matching our 5 patterns:
         - 'A la carte' (8 menus)
         - 'Dagens ret' (7 menus)  
         - 'Weekend menu' (5 menus)"
```

### Step 4: SOLUTION DESIGN (Data-Informed)
Fixes must address actual gaps found in Step 2:

```
1. If field exists but isn't used:
   → Add code to read that field
   
2. If data exists in wrong format:
   → Transform or parse differently
   
3. If data truly is missing:
   → THEN consider improving extraction
```

---

## Specific Checks for Data Pipeline Issues

### When Investigating Menu/Service Period Problems:

**1. Check Extraction Output:**
```sql
SELECT 
  source_url,
  structured_data->>'menuTitle',
  structured_data->'menuPeriods',
  structured_data->'timeWindow',
  structured_data->'serviceHours',
  service_periods
FROM menu_results_v2 
WHERE business_id = '[target-business]'
LIMIT 5;
```

**2. Check URL Patterns:**
```sql
SELECT DISTINCT source_url 
FROM menu_results_v2 
WHERE business_id = '[target-business]';
```
→ URLs often contain service period info: `/aften/`, `/brunch/`, `/bar/`

**3. Check What Normalization Actually Produced:**
```sql
SELECT 
  menu_title,
  service_periods,
  COUNT(*) 
FROM menu_items_normalized 
WHERE business_id = '[target-business]'
GROUP BY menu_title, service_periods;
```

**4. Check Field Name Variations:**
Don't assume field names. Check the actual JSONB structure:
```sql
SELECT jsonb_object_keys(structured_data) as field_name
FROM menu_results_v2 
WHERE business_id = '[target-business]'
LIMIT 1;
```

---

## Respect Domain Knowledge

### When User Says: "Most businesses have X"
**DON'T:** Assume edge cases or complexity  
**DO:** Trust that real-world data follows common patterns

### Example:
```
User: "Restaurants have menus labeled BRUNCH, LUNCH, DINNER"

❌ WRONG Response: 
   "But what if menus are ambiguous or don't have clear labels?
    We need sophisticated pattern matching..."

✅ RIGHT Response:
   "Let me check if our extraction is capturing those labels.
    [Run query]
    Found: All 4 menus have clear titles and time windows.
    Issue: We're not using the time window data we already have."
```

---

## Verification Checklist

Before presenting any analysis, verify:

- [ ] I queried the actual source data (not just read code)
- [ ] I looked at 3+ real examples (not just 1 edge case)
- [ ] Every assumption is backed by a database query result
- [ ] I checked for alternative field names (menuPeriods, timeWindow, serviceHours, etc.)
- [ ] I mapped the full data flow from extraction → normalization → detection
- [ ] I identified what data EXISTS but ISN'T USED (not just what's missing)
- [ ] I can point to specific records/fields that prove my root cause

---

## Red Flags That Signal "Stop and Query Data"

If you catch yourself saying:
- "The extraction **probably** doesn't capture..."
- "This field is **likely** empty..."
- "The data **might** be in format X..."
- "**Most** menus probably don't have..."

**STOP. Query the database. Replace "probably" with evidence.**

---

## Example: Correct Investigation Flow

### Problem: "Programme detection only finds 2 of 4 expected programmes"

#### ❌ WRONG Approach (Theorizing):
1. Look at detection code
2. See it searches for keywords
3. Assume: "Extraction doesn't capture service periods"
4. Write analysis about improving extraction
5. **Never verify if extraction actually works**

#### ✅ RIGHT Approach (Investigating):

**Step 1: Query Extraction Results**
```sql
-- What did we actually extract?
SELECT source_url, structured_data 
FROM menu_results_v2 
WHERE business_id = 'cafe-faust'
```

**Result:** Found 4 menus:
- `/morgenmad/` - title: "MORGENMAD", 36 items
- `/frokost/` - title: "FROKOST", 28 items  
- `/aften/` - title: "AFTEN", 36 items, timeWindow: "17.30-21.30"
- `/bar/` - title: "BAR MENU", 12 items

**Step 2: Query Normalization Output**
```sql
SELECT menu_title, service_periods, COUNT(*) 
FROM menu_items_normalized 
WHERE business_id = 'cafe-faust'
GROUP BY menu_title, service_periods
```

**Result:** 
- MORGENMAD → service_periods = ['breakfast']
- AFTEN → service_periods = ['dinner']
- FROKOST → service_periods = [] (empty!)
- BAR MENU → service_periods = [] (empty!)

**Step 3: Check Detection Keywords**
```typescript
// Detection searches for:
lunch: ['frokost', 'lunch', 'middag']
bar: ['bar', 'drinks', 'cocktails']
```

**Step 4: Identify Gap**
- ✅ Extraction works (all 4 menus captured with titles)
- ❌ Normalization pattern matching is incomplete:
  - "FROKOST" title doesn't match any pattern → empty array
  - "BAR MENU" matches pattern → but assigns 'bar'
  - Detection searches for 'frokost' but finds 'lunch' → mismatch

**Step 5: Solution**
1. Fix normalization to use menu title keyword directly (not translate it)
2. Add URL path checking (already have `/frokost/`, `/bar/`)
3. Fix keyword alignment between normalization and detection

---

## Quick Reference: Investigation vs Theorizing

| Situation | ❌ Theorizing | ✅ Investigating |
|-----------|---------------|------------------|
| Missing programmes | "Extraction doesn't capture periods" | Query menu_results_v2, check what fields exist |
| Wrong time windows | "Need better pattern matching" | Check if timeWindow field already exists |
| Empty service periods | "Menus are too varied" | Query 50 menus, count pattern match failures |
| Data not used | "Upstream doesn't provide it" | Check if field exists with different name |

---

## Commitment

**Going forward in this chat and all future work:**

1. ✅ Always query data before analyzing code
2. ✅ Show 3-5 real examples to ground analysis  
3. ✅ Map what EXISTS vs what's USED
4. ✅ Verify every assumption with evidence
5. ✅ Respect user's domain knowledge about how real businesses work
6. ✅ When user shows data, acknowledge it and use it
7. ✅ Never proceed with analysis if Step 1 (Data Audit) is incomplete

**Remember: Code shows what we DO with data. Databases show what data we HAVE. Always check HAVE before analyzing DO.**
