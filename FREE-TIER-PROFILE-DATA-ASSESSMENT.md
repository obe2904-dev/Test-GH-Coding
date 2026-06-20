# FREE TIER PROFILE DATA ASSESSMENT

## User Requirements Summary

**Keep as-is:**
- ✅ Tone of Voice: 'venlig, informativ' (no changes)

**Add access to:**
1. Opening hours (if entered)
2. Booking link (if available)  
3. Kitchen closing time (if entered)
4. **A)** Menu names from Profile → "Hvad tilbyder I? (kun navne)"
5. **B)** "Om os" description from Profile → Factual business context

---

## DATA STORAGE MAPPING

### A) Menu Names - "Hvad tilbyder I?"

**Location:** `business_profile.key_offerings`  
**Format:** TEXT field (newline-separated list)  
**Example Data (Cafe Faust):**
```
PARISERBØF
VOL AU VENT
CLUB SANDWICH ALA FAUST
FAUSTBURGER
GAMMELDAGS ÆBLEKAGE
```

**Frontend Display:**  
[BusinessProfilePage.tsx](src/pages/dashboard/BusinessProfilePage.tsx#L1289)
- Section: "Hvad tilbyder I? (kun navne)"
- Editable textarea with guidance: "Angiv 5-7 af jeres hovedprodukter eller populære retter — kun navne, ingen beskrivelser"

**Current Backend Access:**

✅ **get-quick-suggestions** (Idea Generation):
- [Lines 998-1015](supabase/functions/get-quick-suggestions/index.ts#L998-L1015)
- Queries `business_profile.key_offerings` for Free tier
- Parses newline-separated list
- Uses as `signatureItems` for idea generation
- **Result:** Free tier daily suggestions CAN reference menu names ✅

❌ **generate-text-from-idea** (Caption Generation):
- Does NOT fetch `key_offerings` at all
- Only knows: `business_character`, `booking_link`
- **Result:** When converting idea to caption, AI doesn't know dish names ❌
- **Impact:** AI hallucinates ingredients because it doesn't know what "Faustburger" is

---

### B) "Om os" Description

**Location:** `business_brand_profile.business_character`  
**Format:** TEXT field (paragraph description)  
**Example Data (Cafe Faust):**
```
Café beliggende ved åen i Aarhus, der tilbyder brunch, solid frokost og 
delikate 3-retters menuer. Frokostmenuen er tilgængelig fra kl. 09.00 til 
17.30 og inkluderer retter som pariserbøf, bøf & bearnaise og falafelsalat. 
Stedet har udendørs siddepladser og tilbyder cocktails. Åbent til kl. 02.00 
i weekenden.

FROKOST · 09.00 – 17.30
AFTEN
BRUNCH
COCKTAILS
```

**Frontend Display:**  
[BusinessProfilePage.tsx](src/pages/dashboard/BusinessProfilePage.tsx#L1248-L1250)
- Section: "Om os"
- Label: "Om os (kort beskrivelse)"
- Editable textarea with AI suggest button

**Current Backend Access:**

✅ **generate-text-from-idea** (Caption Generation):
- [Line 720](supabase/functions/generate-text-from-idea/resolve-context.ts#L720)
- Fetches `business_character` for Free tier
- Stored in `BusinessContext.businessCharacter`
- **Result:** Free tier caption generation HAS "Om os" context ✅

✅ **get-quick-suggestions** (Idea Generation):
- Also has access to `business_character` via separate fetch
- Uses for business type detection and context
- **Result:** Free tier idea generation HAS "Om os" context ✅

---

## CURRENT FREE TIER DATA ACCESS ANALYSIS

### What Free Tier CURRENTLY Has

| Data Field | Idea Generation | Caption Generation | Status |
|------------|----------------|-------------------|--------|
| `booking_link` | ✅ | ✅ | Working |
| `business_character` (Om os) | ✅ | ✅ | Working |
| `key_offerings` (Menu names) | ✅ | ❌ | **MISSING** |
| `reservation_required` | ✅ | ✅ | Working |
| `accepts_walk_ins` | ✅ | ✅ | Working |
| `opening_hours` | ❌ | ❌ | **BLOCKED** |
| `kitchen_close_time` | ❌ | ❌ | **BLOCKED** |

### Critical Gap Identified

**Problem:** Menu name disconnect between idea generation and caption generation

1. **Idea Generation** (get-quick-suggestions):
   - Fetches `key_offerings` ✅
   - Generates suggestion: "Faustburger med sprød bacon" ✅
   - Stores in `daily_suggestions.menu_item_name`

2. **Caption Generation** (generate-text-from-idea):
   - Receives suggestion with `menu_item_name: "Faustburger"` 
   - Does NOT fetch `key_offerings` ❌
   - Tries to look up "Faustburger" in `menu_items_normalized` (doesn't exist) ❌
   - Falls back to `menu_results_v2` (empty for Free tier) ❌
   - **Result:** AI knows title "Faustburger med sprød bacon" but doesn't know if Faustburger is a real dish or what it contains
   - **Consequence:** AI hallucinates ingredients: "briochebolle", "chilimayo", "syltede rødløg"

**Root Cause:**  
Caption generation has NO menu knowledge — not even the simple dish names that idea generation used.

---

## IMPACT ANALYSIS

### Example Flow: Free Tier User Generates Caption for "Faustburger"

**Current State (BROKEN):**

1. User clicks "Læg op i dag" → 3 suggestions generated
2. Suggestion B: "Faustburger med sprød bacon" 
   - Generated using `key_offerings` which includes "FAUSTBURGER" ✅
3. User selects suggestion → Generate caption text
4. Caption generator receives:
   - `menu_item_name`: "Faustburger"
   - `caption_base`: "Faustburger med sprød bacon"
   - `businessCharacter`: "Café beliggende ved åen i Aarhus..." ✅
   - `key_offerings`: **NOT FETCHED** ❌
5. AI prompt sees:
   - "The user wants a post about: Faustburger med sprød bacon"
   - "Business: Café beliggende ved åen..."
   - **Does NOT see:** List of actual menu items
6. AI thinks:
   - "Faustburger sounds like a burger"
   - "Training data says burgers have brioche buns, mayo, pickled onions"
   - Generates: "Vores Faustburger kommer med sprød bacon på briochebolle, toppes med chilimayo og syltede rødløg 🍔"
   - **Problem:** Invented "briochebolle", "chilimayo", "syltede rødløg" ❌

**Desired State (FIXED):**

1-3. Same as above
4. Caption generator receives:
   - `menu_item_name`: "Faustburger"  
   - `caption_base`: "Faustburger med sprød bacon"
   - `businessCharacter`: "Café beliggende ved åen..." ✅
   - `key_offerings`: "PARISERBØF\nVOL AU VENT\nCLUB SANDWICH ALA FAUST\nFAUSTBURGER\nGAMMELDAGS ÆBLEKAGE" ✅
5. AI prompt sees:
   - "The user wants a post about: Faustburger med sprød bacon"
   - "Business: Café beliggende ved åen..."
   - **ALSO sees:** "Known menu items: PARISERBØF, VOL AU VENT, CLUB SANDWICH ALA FAUST, FAUSTBURGER, GAMMELDAGS ÆBLEKAGE"
6. AI thinks:
   - "Faustburger is in the known menu list ✅"
   - "I only have the name and 'med sprød bacon' from title"
   - OBSERVER persona: "Du må KUN rapportere verificerbare facts"
   - Generates: "Faustburger med bacon serveres nu" ✅
   - **No hallucinations** ✅

---

## OPERATIONAL DATA (Opening Hours + Kitchen Close)

### Opening Hours

**Current Status:** ❌ BLOCKED for Free tier

**Location:** [resolve-context.ts lines 688-711](supabase/functions/generate-text-from-idea/resolve-context.ts#L688-L711)

**Code:**
```typescript
if (isPaid) {
  // ... brand profile fetching ...
  
  // 3. Opening hours (paid only — factual time constraint)
  const { data: hoursRows } = await supabase
    .from('opening_hours')
    .select('open_time, close_time, closed')
    .eq('business_id', businessId)
    .eq('kind', 'normal')
    .eq('weekday', todayName)
    .limit(1)
  const todayHours = hoursRows?.[0]
  if (todayHours && !todayHours.closed) {
    todayOpenTime = todayHours.open_time || ''
    todayCloseTime = todayHours.close_time || ''
  }
}
```

**Problem:** Opening hours fetch is inside `if (isPaid)` block

**Impact:** Free tier gets empty strings for `todayOpenTime` and `todayCloseTime`

**User Requirement:** "We have opening hours, so these should be used" ✅

**Example Data (Cafe Faust):**
- The "Om os" description says: "Frokostmenuen er tilgængelig fra kl. 09.00 til 17.30"
- This information exists in `opening_hours` table but Free tier can't access it
- Result: AI can't say "Vi åbner kl. 09.00" even though it's factual data

---

### Kitchen Closing Time

**Current Status:** ❌ BLOCKED for Free tier

**Location:** [resolve-context.ts lines 527-528](supabase/functions/generate-text-from-idea/resolve-context.ts#L527-L528)

**Code:**
```typescript
if (isPaid) {
  // ... inside business_operations fetch ...
  if (opsRow?.kitchen_close_time) kitchenCloseTime = opsRow.kitchen_close_time
}
```

**Problem:** `kitchen_close_time` is fetched only inside `isPaid` block

**But:** Free tier ALREADY queries `business_operations` table (lines 724-730):
```typescript
const { data: opsRow } = await supabase
  .from('business_operations')
  .select('reservation_required, accepts_walk_ins')
  .eq('business_id', businessId)
  .single()
```

**Easy Fix:** Just add `kitchen_close_time` to the SELECT list in Free tier block

**User Requirement:** "We have kitchen closing time if entered" ✅

**Impact:** 
- Current: Free tier can't mention "Køkkenet lukker kl. 21"
- Fixed: Free tier can state factual kitchen hours if business has entered them

---

## RISK ASSESSMENT

### Low Risk Changes ✅ (Pure Factual Data)

1. **Add `key_offerings` to Free tier caption generation**
   - Type: Fetch existing data field
   - Data: User-entered dish names (5-7 items max)
   - Format: Simple names, no descriptions
   - Hallucination risk: **REDUCES hallucinations** (gives AI boundary of real dishes)
   - Quality impact: **HIGH** — AI stops inventing ingredients
   - Example: Instead of "briochebolle, chilimayo", AI writes "Faustburger serveres"

2. **Move opening hours outside `isPaid` block**
   - Type: Factual operational data
   - Data: Clock times from database
   - Hallucination risk: **ZERO** (objective times)
   - Quality impact: **MEDIUM** — Time-aware captions ("Åbner om 30 min")
   - Example: "Vi serverer frokost fra kl. 09.00"

3. **Add `kitchen_close_time` to Free tier fetch**
   - Type: Factual operational data  
   - Data: Optional field (only if entered)
   - Hallucination risk: **ZERO** (objective time)
   - Quality impact: **LOW-MEDIUM** — Useful for late-day posts
   - Example: "Køkkenet lukker kl. 21 — bestil nu"

### Why These Changes Are SAFE

**Principle:** Free tier anti-hallucination strategy is OBSERVER persona:
> "DU ER OBSERVATØR — ikke historiefortæller. ROLLE: Du beskriver præcist hvad der ER verificerbart."

**Current Problem:**  
AI is told to "only report facts" but doesn't HAVE the facts (menu names)

**Solution:**  
Give AI more FACTUAL data to work with:
- Menu names → Know which dishes exist
- Opening hours → Know when service happens  
- Kitchen close time → Know booking deadline
- "Om os" description → Already working ✅

**Result:**  
OBSERVER persona becomes MORE effective when it has MORE facts to observe.

**Counter-intuitive but true:**  
More data = Less hallucination (when data is factual and persona is bounded)

---

## COMPARISON: Free vs Paid Data Access

### Current State

| Data Type | Free Tier | Paid Tier | Free Should Have |
|-----------|-----------|-----------|------------------|
| **Brand Profile V5** | ❌ | ✅ Full | ❌ Keep blocked |
| **Menu Descriptions** | ❌ | ✅ Full | ❌ Keep blocked |
| **Menu Names** | ❌ | ✅ Via V5 | ✅ **YES** (simple list) |
| **"Om os" Text** | ✅ | ✅ | ✅ Already working |
| **Opening Hours** | ❌ | ✅ | ✅ **YES** (factual time) |
| **Kitchen Close Time** | ❌ | ✅ | ✅ **YES** (factual time) |
| **Booking Link** | ✅ | ✅ | ✅ Already working |
| **Booking Pattern** | ✅ | ✅ | ✅ Already working |
| **Brand Voice** | Fallback | ✅ Full | Keep fallback |
| **Writing Rules** | Empty | ✅ Full | Keep empty |
| **Emoji Level** | Default | ✅ Custom | Keep default |

### Proposed State

**Free Tier Philosophy:**  
Give Free tier access to FACTUAL operational data (what exists, when it's available) but NOT subjective brand voice or creative descriptions.

**What Free Tier Gets:**
- ✅ Dish names (not descriptions)
- ✅ Opening hours (not brand voice about atmosphere)
- ✅ Kitchen close time (not service style descriptions)
- ✅ "Om os" description (user-written factual context)
- ✅ Booking link + pattern (operational info)
- ❌ Brand profile v5 (creative voice, writing rules, emoji preferences)
- ❌ Menu descriptions (detailed ingredients, preparation methods)

**Paid Tier Advantage Preserved:**
- ✅ Full menu descriptions with ingredients and details
- ✅ Custom brand voice with personality traits
- ✅ Writing rules and style guidelines
- ✅ Custom emoji levels and typical closings
- ✅ Audience segmentation and timing strategies
- ✅ Higher temperature (0.7) creative generation
- ✅ More regenerations per day (3-5 vs 1)

---

## IMPLEMENTATION SUMMARY

### Changes Required

**File:** `supabase/functions/generate-text-from-idea/resolve-context.ts`

#### Change 1: Add `key_offerings` fetch for Free tier

**Location:** After line 720 (Free tier block)

**Current:**
```typescript
} else {
  // Free tier: still resolve booking_link + booking pattern signals
  const { data: freeBooking } = await supabase
    .from('business_brand_profile')
    .select('booking_link, business_character')
    .eq('business_id', businessId)
    .single()
  bookingLink = (freeBooking as any)?.booking_link ?? null
  businessCharacter = (freeBooking as any)?.business_character ?? ''
  
  // Fetch booking pattern...
}
```

**Add after booking pattern fetch:**
```typescript
// Fetch key_offerings (menu names without descriptions)
// Used to verify dish names mentioned in suggestions are real
const { data: profileData } = await supabase
  .from('business_profile')
  .select('key_offerings')
  .eq('business_id', businessId)
  .single()

let keyOfferings = ''
if (profileData?.key_offerings) {
  keyOfferings = profileData.key_offerings.trim()
}
```

**Then:** Add `keyOfferings` to prompt building logic

---

#### Change 2: Move opening hours outside `isPaid` block

**Current:** Lines 688-711 inside `if (isPaid)`

**Move to:** After Free/Paid branching reunites (before line 735)

**Result:** Both Free and Paid tiers get opening hours

---

#### Change 3: Add `kitchen_close_time` to Free tier fetch

**Current:** Lines 724-730 (Free tier business_operations fetch)
```typescript
const { data: opsRow } = await supabase
  .from('business_operations')
  .select('reservation_required, accepts_walk_ins')
  .eq('business_id', businessId)
  .single()
```

**Change to:**
```typescript
const { data: opsRow } = await supabase
  .from('business_operations')
  .select('reservation_required, accepts_walk_ins, kitchen_close_time')
  .eq('business_id', businessId)
  .single()
```

**Add:**
```typescript
if (opsRow?.kitchen_close_time) kitchenCloseTime = opsRow.kitchen_close_time
```

---

### Prompt Integration

Once `key_offerings` is available, add to Free tier prompt context:

**Location:** `supabase/functions/generate-text-from-idea/prompt-components.ts`

**Free tier INDHOLD block should reference:**
```typescript
if (ctx.keyOfferings) {
  // Add known menu items section
  `VERIFICERBARE MENUPUNKTER (kun navne — INGEN detaljer):
${ctx.keyOfferings.split('\n').filter(s => s.trim()).map(name => `- ${name.trim()}`).join('\n')}

REGEL: Hvis "${ctx.menuItemName}" findes i listen ovenfor, ved du det er en reel ret.
Du ved KUN navnet — ikke ingredienser, tilberedning eller præsentation.
Skriv derfor kun: "${ctx.menuItemName} serveres" eller lignende.
Opfind ALDRIG detaljer der ikke står i brugerens titel.`
}
```

**Example result:**
```
VERIFICERBARE MENUPUNKTER (kun navne — INGEN detaljer):
- PARISERBØF
- VOL AU VENT  
- CLUB SANDWICH ALA FAUST
- FAUSTBURGER
- GAMMELDAGS ÆBLEKAGE

REGEL: Hvis "Faustburger" findes i listen ovenfor, ved du det er en reel ret.
Du ved KUN navnet — ikke ingredienser, tilberedning eller præsentation.
Skriv derfor kun: "Faustburger serveres" eller lignende.
Opfind ALDRIG detaljer der ikke står i brugerens titel.
```

---

## EXPECTED OUTCOMES

### Before Changes (Current State)

**User selects:** "Faustburger med sprød bacon"

**AI generates:**
> "Vores saftige Faustburger kommer med sprød bacon, serveres på en lun briochebolle og toppes med hjemmelavet chilimayo og syltede rødløg 🍔✨"

**Problems:**
- ❌ "briochebolle" — invented
- ❌ "hjemmelavet chilimayo" — invented  
- ❌ "syltede rødløg" — invented
- ❌ "saftige", "lun" — texture/temperature hallucinations

---

### After Changes (Fixed State)

**User selects:** "Faustburger med sprød bacon"

**AI receives:**
- Menu item: "Faustburger"
- Title: "Faustburger med sprød bacon"
- **Known dishes:** PARISERBØF, VOL AU VENT, CLUB SANDWICH ALA FAUST, **FAUSTBURGER**, GAMMELDAGS ÆBLEKAGE
- Om os: "Café beliggende ved åen i Aarhus, der tilbyder brunch, solid frokost..."
- Opening hours: "09.00 - 17.30"
- OBSERVER persona: "Du må KUN rapportere verificerbare facts"

**AI generates:**
> "Faustburger med bacon serveres nu 🍔"

**Or with time context:**
> "Faustburger med bacon — serveres til kl. 17.30 🍔"

**Result:**
- ✅ Only states verified facts (Faustburger exists, has bacon)
- ✅ No invented ingredients
- ✅ Time-aware if relevant
- ✅ Minimal, factual, non-hallucinatory

---

## CONCLUSION

### Summary of Findings

**Free tier currently has:**
- ✅ "Om os" description (working well)
- ✅ Booking link (working well)
- ✅ Booking patterns (working well)
- ❌ Menu names (used by idea generation, NOT by caption generation)
- ❌ Opening hours (blocked by isPaid condition)
- ❌ Kitchen close time (blocked by isPaid condition)

**Root cause of hallucinations:**
Caption generation receives suggestions about dishes ("Faustburger") but has NO knowledge of what dishes actually exist. AI fills the gap with training data.

**Solution:**
Give Free tier access to factual operational data that already exists in database:
1. Menu names (simple list, no descriptions)
2. Opening hours (clock times)
3. Kitchen close time (if entered)

**Risk level:** LOW
- All changes add factual, objective data
- No subjective interpretation needed
- OBSERVER persona becomes MORE effective with MORE facts
- Paid tier advantages fully preserved (descriptions, brand voice, creative freedom)

**Implementation complexity:** LOW
- 3 small query changes in resolve-context.ts
- 1 prompt addition in prompt-components.ts
- No database schema changes needed
- All data already exists and is populated

**Expected impact:** HIGH
- Eliminates most Free tier hallucinations
- Enables time-aware captions
- Preserves clear Free vs Paid value distinction
- Improves Free tier quality without creative complexity

**Recommendation:** Proceed with all 3 changes (menu names + opening hours + kitchen close time)
