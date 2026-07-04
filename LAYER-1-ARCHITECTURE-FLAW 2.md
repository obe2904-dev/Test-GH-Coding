# Layer 1 Architecture Flaw: The "Disassemble-Then-Guess" Anti-Pattern

**Critical Assessment: Why Layer 1 is "Badly Programmed"**

Date: May 7, 2026  
Author: Architecture Review  
Status: NO CODE - Conceptual Analysis Only

---

## The User's Observation

> "We already have all the information!!!! I can see it in frontend. WHY IS LAYER 1 SO BADLY PROGRAMMED."

**The user is absolutely correct.**

---

## What Actually Happens: The Extraction → Destruction → Reconstruction Cycle

### Step 1: GPT-4o Extraction (STRUCTURED DATA CREATED) ✅

**Edge Function:** `menu-extract-v2`  
**Input:** Menu webpage HTML  
**Output:** `menu_results_v2` table with `structured_data` JSONB

**What GPT-4o Captures:**
```json
{
  "menuTitle": "AFTEN",                    // ← Programme NAME
  "availabilityTime": "17.30-21.30",       // ← Programme TIME WINDOW  
  "availabilityDays": "dagligt",           // ← Programme DAYS
  "categories": [
    {
      "name": "FORRETTER",
      "items": [
        {"name": "...", "price": "125", "currency": "DKK"}
      ]
    },
    {
      "name": "HOVEDRETTER", 
      "items": [...]
    }
  ]
}
```

**Also Stored:**
- `source_url`: "https://cafefaust.dk/menukort/aften/"  ← Contains 'aften' keyword
- `service_periods`: Can be set during extraction

**Result:** Perfect programme data structure! Each menu_result IS a programme with:
- Clear name (menuTitle)
- Exact time window (availabilityTime) 
- Structured items (categories[].items[])
- Identifier (source_url)

---

### Step 2: Normalization Worker (STRUCTURE DESTROYED) 💥

**Migration:** `20260507000001_create_menu_normalization_worker.sql`  
**Trigger:** After menu extraction completes  
**Process:** Flattens structured menu into individual item rows

**What Happens to AFTEN Menu (36 items):**

**BEFORE (structured_data):**
```
1 menu object
  ├─ menuTitle: "AFTEN"
  ├─ availabilityTime: "17.30-21.30"  
  └─ categories: [3 categories, 36 items total]
```

**AFTER (menu_items_normalized):**
```
36 separate rows:
  Row 1: {item_name: "Tartelette med vandmelon", service_periods: ['dinner'], menu_title: "AFTEN", ...}
  Row 2: {item_name: "Grillet okse", service_periods: ['dinner'], menu_title: "AFTEN", ...}
  ...
  Row 36: {item_name: "Brownie", service_periods: ['dinner'], menu_title: "AFTEN", ...}
```

**What's Lost:**
- ❌ availabilityTime: "17.30-21.30" → Not copied to normalized items
- ❌ menuSubtitle → Not copied
- ❌ availabilityDays → Not copied  
- ❌ source_url → Not copied
- ❌ Relationship between items (they were part of ONE menu) → Scattered across rows

**What's Kept:**
- ✅ menu_title: "AFTEN" → Copied to each row
- ✅ service_periods: ['dinner'] → Derived via pattern matching (fragile)

---

### Step 3: Layer 1 "Detection" (RECONSTRUCTION ATTEMPTED) 🤔

**File:** `programme-detection.ts`  
**Input:** 143 flattened items from `menu_items_normalized`  
**Process:** Try to figure out which items belong to which programme

**The Logic:**
```typescript
// Step 1: Extract what service_periods exist
const menuServicePeriods = extractServicePeriodsFromMenu(menuItems)
// Result: ['brunch', 'dinner', 'bar'] (if normalization worked)

// Step 2: Check if any keywords match
if (menuServicePeriods.includes('dinner') || menuTitles.includes('aften')) {
  // Detected dinner programme!
}

// Step 3: Assign time window
timeWindow = {
  start: '17:00',  // ← HARDCODED! Ignores actual "17.30-21.30"
  end: '22:00'     // ← HARDCODED! Ignores actual "17.30-21.30"
}
```

**What Detection DOESN'T Use:**
- ❌ menu_results_v2.structured_data.availabilityTime (the ACTUAL time window)
- ❌ menu_results_v2.source_url (contains reliable keywords)  
- ❌ menu_results_v2.structured_data.menuTitle (the ACTUAL programme name)
- ❌ The fact that menu_results_v2 rows ARE programmes

**What Detection DOES Use:**
- ✅ Keyword matching against hardcoded lists
- ✅ Pattern matching on menu_title field (copied from structured_data)
- ✅ Hardcoded time windows from PROGRAMME_TIME_WINDOWS constant

---

## The Anti-Pattern: Why This is "Badly Programmed"

### 1. **Destroys Structure, Then Tries to Rebuild It**

**What Happens:**
1. GPT-4o creates perfect programme structure in `menu_results_v2`
2. Normalization flattens it into individual items (loses programme metadata)
3. Detection tries to re-group items back into programmes (reverse engineering)

**This is like:**
- Disassembling a car into parts
- Throwing away the assembly manual
- Then trying to figure out what the car was by looking at scattered bolts

**Why It's Wrong:**
- Original structure is authoritative and complete
- Flattening loses critical metadata (time windows, days, descriptions)
- Reconstruction is guesswork (keyword matching, hardcoded assumptions)

### 2. **Ignores Available Data, Uses Inference Instead**

**Available (UNUSED):**
- ✅ `structured_data.availabilityTime`: "17.30-21.30"
- ✅ `structured_data.menuTitle`: "AFTEN"  
- ✅ `source_url`: "/menukort/aften/"
- ✅ `structured_data.availabilityDays`: "dagligt"

**Used Instead (INFERIOR):**
- ❌ Hardcoded: `{start: '17:00', end: '22:00'}`
- ❌ Pattern matching: `LOWER(menu_title) LIKE '%aften%'`
- ❌ Keyword matching: `keywords.includes('dinner')`
- ❌ Inferred from opening hours: "Business opens 09:00 → morning programme starts 07:00" (wrong!)

**Result:**
- Shows wrong time windows (17:00-22:00 instead of 17.30-21.30)
- Fragile detection (depends on pattern matching working)
- Can't detect programmes if normalization fails to assign service_periods

### 3. **Solves a Problem That Doesn't Exist**

**Problem Layer 1 Thinks It's Solving:**
> "We have unstructured menu item data. We need to detect which items belong to which programme."

**Actual Situation:**
> "We have perfectly structured programme data in menu_results_v2. Each menu_result IS a programme. Just read it."

**The Question Detection Asks:**
> "Do these 143 items contain evidence of a dinner programme?"

**The Question Detection SHOULD Ask:**
> "How many menu_result rows exist with status='done'? Each one is a programme."

### 4. **Frontend Can Display Data That Layer 1 Can't Access**

**User Evidence:**
> "I can see it in frontend"

**What Frontend Shows:**
- Menu title: "AFTEN"
- Items: 36 items
- Time window: 🕐 17.30-21.30
- Average price: 157 DKK
- URL: /menukort/aften/

**Where This Data Comes From:**
- NOT from Layer 1 detection
- Directly from `menu_results_v2.structured_data`
- Frontend queries the extraction results directly

**The Irony:**
- Frontend: Reads structured_data directly → sees everything ✅
- Layer 1: Reads normalized items → misses time windows, uses hardcoded values ❌

**This proves the data EXISTS and is ACCESSIBLE.**  
Layer 1 is just looking in the wrong place.

---

## What Layer 1 SHOULD Do (Conceptually)

### Correct Architecture: Read Structure, Don't Reconstruct It

**Current (WRONG):**
```
menu_results_v2 (structured)
      ↓ normalization (flattening)
menu_items_normalized (items only)
      ↓ detection (keyword matching)
programmes (reconstructed, partial data)
```

**Better (RIGHT):**
```
menu_results_v2 (structured)
      ↓ DIRECT READ
programmes (complete data, no reconstruction)

ALSO:
menu_results_v2 
      ↓ normalization (for item-level queries only)  
menu_items_normalized (searchable items)
```

### Layer 1 Should Be This Simple:

**Pseudocode:**
```typescript
function detectProgrammes(businessId: string): Programme[] {
  // Step 1: Query completed menu extractions
  const menuResults = await supabase
    .from('menu_results_v2')
    .select('*')
    .eq('business_id', businessId)
    .eq('status', 'done')
  
  // Step 2: Each menu_result IS a programme
  const programmes = menuResults.map(menuResult => {
    const data = menuResult.structured_data
    
    return {
      name: data.menuTitle || extractFromUrl(menuResult.source_url),
      type: classifyProgrammeType(data.menuTitle, menuResult.source_url),
      timeWindow: parseTimeWindow(data.availabilityTime) || inferFromType(type),
      days: data.availabilityDays || 'all',
      itemCount: data.categories.flatMap(c => c.items).length,
      categories: data.categories,
      url: menuResult.source_url,
      evidence: `Extracted from ${menuResult.source_url}`,
      confidence: data.availabilityTime ? 'high' : 'medium'
    }
  })
  
  return programmes
}
```

**Key Differences:**
- ✅ Reads menu_results_v2 directly (source of truth)
- ✅ Uses structured_data fields (menuTitle, availabilityTime, categories)
- ✅ Falls back to URL parsing if title missing
- ✅ Uses actual time windows from extraction
- ✅ No keyword matching needed (data is already structured)
- ✅ No flattening/reconstruction cycle

---

## Why the Current Approach Exists (Hypothesis)

### Likely Design Evolution:

**Phase 1:** Initial implementation
- Had menu_items table (manually entered items)
- Needed to group items into programmes
- Keyword detection made sense (no structured extraction yet)

**Phase 2:** Added GPT-4o extraction
- Created menu_results_v2 with structured_data
- Created normalization to populate menu_items_normalized
- **Kept old detection logic** (technical debt)

**Phase 3:** Detection never updated
- Detection still reads from normalized items
- Never refactored to read structured_data directly
- Normalization became intermediary, not source of truth

**Result:** Architecture debt  
- New system (extraction → structured_data) not fully integrated
- Old system (item-level detection) still in use
- Two sources of truth exist, but wrong one is queried

---

## Real-World Example: Café Faust

### What Exists in Database:

**menu_results_v2 (4 rows, each is a programme):**
```
1. source_url: .../menukort/morgenmad/
   structured_data: {
     menuTitle: "MORGENMAD", 
     availabilityTime: "09:00-11:30",
     categories: [...]
   }

2. source_url: .../menukort/frokost/  
   structured_data: {
     menuTitle: "FROKOST",
     availabilityTime: "11:00-15:00",  
     categories: [...]
   }

3. source_url: .../menukort/aften/
   structured_data: {
     menuTitle: "AFTEN",
     availabilityTime: "17.30-21.30",  ← USER SAW THIS!
     categories: [36 items]
   }

4. source_url: .../menukort/bar/
   structured_data: {
     menuTitle: "BAR",
     availabilityTime: "20:00-23:00",
     categories: [...]  
   }
```

**Perfect programme data! 4 programmes, clear names, exact times, all items.**

### What Layer 1 Does Instead:

**Reads:** menu_items_normalized (143 flattened rows)  
**Finds:** Keywords 'brunch' and 'bar' in service_periods  
**Detects:** 2 programmes (missing FROKOST and AFTEN)  
**Assigns:** Hardcoded time windows (07:00-11:00, 22:00-02:00)  

**Shows User:**
- ❌ "Morgenmad: 07:00-11:00" (actual: 09:00-11:30)
- ❌ "Bar: 22:00-02:00" (actual: 20:00-23:00)  
- ❌ Missing FROKOST programme entirely
- ❌ Missing AFTEN programme entirely (despite user seeing "🕐 17.30-21.30" in frontend!)

### Why FROKOST and AFTEN Not Detected:

**NOT because data is missing** (it's all in menu_results_v2)  
**Because:**
1. Normalization assigned wrong service_periods (or empty arrays)
2. Detection searches service_periods, doesn't find keywords
3. Detection never checks menu_results_v2.structured_data directly
4. Detection never checks source_url paths

**The data exists. Layer 1 is looking in the wrong table.**

---

## The User's Point: "We Already Have All The Information"

### What the User Sees in Frontend:

**Business Profile Page:**
- Business name: "Café Faust"
- Opening hours: 09:00-23:00
- Location, description, etc.

**Menu Display:**
- Menu: AFTEN
- Source: Aftenmenu https://cafefaust.dk/menukort/aften/
- Items: 36 items
- Average: 157 DKK  
- Time: 🕐 17.30-21.30

**Layer 2-4 Profiles:**
- Commercial orientation per programme
- Identity profile (brand essence, positioning)
- Audience segments per programme

### What's Missing:

**Layer 1 Programme Detection:**
- Only shows 2 of 4 programmes
- Shows wrong time windows  
- Doesn't use the data the frontend can display

### The User's Conclusion:

> "Layer 1 should think like this: 'Ok, what kind of business is this and what do they offer - what do they sell? Let me look at the available information. Ohh it is all there under menu and business profile.'"

**Translation:**
- Don't try to "detect" programmes by keyword matching 143 flattened items
- Just READ the menu_results_v2 table where programmes are already structured
- Each menu extraction IS a programme
- All the metadata (title, time, days, items) is right there

**The user is describing exactly what Layer 1 should be:**
- A READER of existing structured data
- NOT a DETECTOR using keyword inference

---

## Fundamental Architecture Question

### What IS a "Programme"?

**Current Definition (Detection Logic):**
> "A programme is a time-based service window that we detect by finding menu items with matching keywords and inferring time windows from opening hours or hardcoded defaults."

**Correct Definition (What It Should Be):**
> "A programme is a distinct menu offering. Each menu_result with status='done' represents one programme. The programme's name is menuTitle, time window is availabilityTime, and offerings are in categories[]."

### The Shift Needed:

**FROM:**
- Programme = inferred concept derived from item patterns
- Detection = keyword matching + pattern recognition  
- Source = flattened menu_items_normalized table

**TO:**
- Programme = concrete entity (each menu extraction)
- Detection = reading structured extraction results
- Source = menu_results_v2.structured_data

---

## Why This Matters (Business Impact)

### Current Problems:

1. **Wrong Time Windows Shown to Users**
   - User sees "07:00-11:00" when business opens at 09:00
   - Confusing, unprofessional, incorrect

2. **Missing Programmes**
   - Only 2 of 4 programmes detected
   - Layer 2-4 analysis incomplete (missing FROKOST, AFTEN profiles)
   - User can't see full brand profile

3. **Fragile Detection**
   - Depends on normalization working correctly
   - If service_periods assignment fails → programme not detected
   - No fallback to source URL or structured_data

4. **Duplicated Effort**
   - GPT-4o extracts perfect data
   - Then we throw it away and try to reconstruct it  
   - Waste of computation and complexity

5. **Frontend vs Backend Mismatch**
   - Frontend shows "🕐 17.30-21.30" (from structured_data)
   - Backend shows "17:00-22:00" (from hardcoded constants)
   - Inconsistent user experience

---

## Conclusion: The Assessment

### Is Layer 1 "Badly Programmed"?

**Yes, from an architecture perspective.**

**Specifically:**

1. ✅ **The user is correct:** All information already exists in structured form
2. ✅ **The approach is backwards:** Destroys structure then tries to rebuild it
3. ✅ **The data source is wrong:** Reads normalized items instead of extraction results
4. ✅ **The logic is redundant:** Keyword detection unnecessary when structure exists
5. ✅ **The results are inferior:** Missing programmes, wrong times, low confidence

### The Core Issue:

**Layer 1 was designed for a world where programmes needed to be INFERRED from unstructured data.**

**But in the current system:**
- Programmes are EXTRACTED by GPT-4o in structured format
- Each menu_result IS a programme
- Detection is solving a problem that GPT-4o already solved

### What Layer 1 Should Be:

**NOT:** "Programme Detection" (implies inference, guessing, pattern matching)  
**BUT:** "Programme Reader" (reading existing structured data)

**NOT:** Keyword matching against flattened items  
**BUT:** Parsing menu_results_v2.structured_data

**NOT:** Using hardcoded time windows  
**BUT:** Using extracted availabilityTime values

**NOT:** Inferring from 143 scattered items  
**BUT:** Reading 4 complete menu objects

---

## Next Steps (If This Were to Be Fixed)

### Option 1: Refactor Layer 1 (Major Change)

1. Change detectProgrammes() to read menu_results_v2 directly
2. Map structured_data to Programme objects
3. Use availabilityTime for time windows
4. Use menuTitle + source_url for programme identification
5. Keep menu_items_normalized for item-level queries only
6. Remove keyword matching logic (no longer needed)

### Option 2: Hybrid Approach (Smaller Change)

1. Keep current detection for businesses without menu extractions
2. Add new path for businesses WITH extractions:
   - Check menu_results_v2 first
   - If extraction exists, read structured_data
   - Fall back to keyword detection only if no extractions
3. Gradually migrate all businesses to extraction-based approach

### Option 3: Frontend Bypass (Quick Fix)

1. Don't wait for Layer 1 to be fixed
2. Frontend reads menu_results_v2 directly for programme display
3. Use structured_data for accurate time windows, item counts
4. Only use Layer 1 for classification (morning/lunch/dinner/bar type)
5. Replace Layer 1 entirely in next major refactor

---

## Final Observation

**The user's frustration is valid.**

When you can see "🕐 17.30-21.30" in the frontend, but Layer 1 shows "17:00-22:00", and only detects 2 of 4 programmes, it's clear something is architecturally wrong.

The data exists.  
The structure exists.  
The frontend can read it.  

Layer 1 just needs to **read the same source** instead of trying to **reconstruct what was already extracted.**

**This is a classic case of:**
- ✅ Data is perfect (GPT-4o extraction works beautifully)
- ✅ Storage is correct (menu_results_v2 has all metadata)
- ✅ Frontend is smart (reads structured_data directly)
- ❌ Layer 1 is outdated (reads from wrong table, uses wrong logic)

**Solution:** Make Layer 1 as simple as the user describes:
> "Look at the available information. Ohh it is all there under menu and business profile."

Read menu_results_v2. Each row is a programme. Done.
