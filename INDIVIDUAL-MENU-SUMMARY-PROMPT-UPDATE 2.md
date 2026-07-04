# Individual Menu Summary Prompt Update - Complete

**Date:** 21. maj 2026  
**Status:** ✅ Deployed Successfully  
**Deployment Size:** 169kB

---

## Changes Implemented

### 1. Updated Prompt in menu-extract-v2/index.ts

**Previous Persona:**
```
Du er ekspert i restaurantmarkedsføring
```

**New Persona:**
```
Du er professionel menu-analytiker
```

### 2. Added System Prompt (NEW)

```javascript
Du er professionel menu-analytiker der laver objektive menubeskrivelser.

KRITISKE REGLER:
1. Beskriv KUN hvad menuen tilbyder - produkter, retter, mad/drikke
2. Beskriv KATEGORIER (smørrebrød, hovedretter, desserter) - ALDRIG specifikke retnavne
3. Objektiv tone - INGEN subjektive ord (lækre, hyggelig, fantastisk, afslappet)
4. INGEN målgruppe (familier, par, børn)
5. INGEN atmosfære (afslappet, hyggelig, stemningsfuld)
6. Returner KUN bullet-listen med • symbol
```

### 3. Updated User Prompt Instructions

**Removed:**
- ❌ "hvem henvender den sig til" (target audience)
- ❌ "Nævn gerne 1-3 karakteristiske retter" (specific dishes)
- ❌ No ban on subjective language

**Added:**
- ✅ "Fokuser KUN på produkter, retter og tilbud - IKKE målgruppe"
- ✅ "Beskriv KATEGORIER og MADTYPER - ALDRIG specifikke retnavne"
- ✅ "INGEN subjektive ord (lækre, hyggelig, afslappet, fantastisk)"
- ✅ "INGEN atmosfære-beskrivelser"
- ✅ "INGEN målgruppe-vurderinger"
- ✅ English language support (same rules)

### 4. Updated Documentation

**File:** MENU-EXTRACTION-PROMPTS-DOCUMENTATION.md

Updated:
- Stage 2 prompt example
- Quality validation criteria
- Output example (showing objective style)

---

## Contamination Eliminated

### Before (OLD PROMPT):
```
• Menuen "AFTEN" tilbyder et varieret udvalg af retter, der spænder 
  fra klassiske forretter til kreative hovedretter og lækre desserter.
• Den henvender sig til både familier, par og venner, der ønsker en 
  hyggelig aften med god mad i en afslappet atmosfære.
• Karakteristiske retter inkluderer Moules Mariniers som forret, 
  Ovnbagt Laks som hovedret og Gammeldags Æblekage til dessert.
```

**Issues:**
- ❌ "lækre desserter" (subjective)
- ❌ "familier, par og venner" (target audience)
- ❌ "hyggelig aften", "afslappet atmosfære" (atmosphere)
- ❌ "Moules Mariniers", "Ovnbagt Laks", "Gammeldags Æblekage" (specific dishes)

### After (NEW PROMPT - EXPECTED):
```
• Omfattende udvalg af forretter, hovedretter og desserter
• Kategorierne dækker klassiske danske retter og moderne caféinspirationer
• Vegetariske og glutenfrie alternativer tilgængelige
• Drikketilbud omfatter både alkoholiske og alkoholfrie valg
• Børnemenu tilgængelig med flere kategorier
```

**Quality:**
- ✅ Objective, factual descriptions
- ✅ Category-focused (no specific dishes)
- ✅ No target audience
- ✅ No atmosphere
- ✅ No subjective language

---

## Impact on Data Pipeline

### Clean Pipeline Architecture (After Fix):

```
1. Detailed Menu Extraction (menu-extractor.ts)
   → GPT-4o, temp 0.0
   → Stores structured_data
   ↓
2. Individual Menu Summary (menu-extract-v2/index.ts) ✅ FIXED
   → GPT-4o-mini, temp 0.3
   → Persona: "professionel menu-analytiker"
   → Stores CLEAN ai_summary
   ↓
3. Cross-Menu Summary (menu-overview-summary.ts)
   → GPT-4o-mini, temp 0.5
   → Persona: "professionel menu-analytiker"
   → Reads CLEAN input → Generates CLEAN output
   ↓
4. Gastronomic Profile (menu-overview-summary.ts)
   → GPT-4o-mini, temp 0.3
   → Ultra-short factual profile
```

**Result:** Consistent professional persona throughout entire pipeline eliminates contamination.

---

## Next Steps

### STEP 1: Regenerate Menus ⏳
**Action:** Extract menus again for test business (Café Faust)
**Location:** http://localhost:3000/dashboard/menu
**Process:**
1. Navigate to menu dashboard
2. Click "Extract Menu" for each service period (or all at once)
3. Wait for extraction to complete
4. New ai_summary will be generated with clean prompts

### STEP 2: Verify Individual Summaries ⏳
**Action:** Run quality check SQL
**File:** `_check_individual_menu_summary_quality.sql`
**Expected:**
- ✅ All "Objective" (no subjective language)
- ✅ All "No audience" (no target groups)
- ✅ All "No atmosphere" (no mood descriptions)
- ✅ 4-5 bullets per summary
- ✅ 80-150 words per summary

### STEP 3: Regenerate Brand Profile ⏳
**Action:** Click "Regenerate" button in Brand Profile
**Location:** http://localhost:3000/dashboard/brand-profile
**Process:**
1. Reads CLEAN individual menu summaries
2. Generates cross-menu summary
3. Generates gastronomic profile
4. Generates signature themes

### STEP 4: Verify Brand Profile Output ⏳
**Action:** Run existing verification SQL
**Files:**
- `_check_gastronomic_profile.sql`
- `_check_signature_themes.sql`
**Expected:**
- ✅ Clean cross-menu summary (no contamination)
- ✅ Signature themes include service periods (Brunch-specialist, etc.)
- ✅ Signature themes include beverage focus if applicable
- ✅ Gastronomic profile is 1-2 factual sentences

### STEP 5: Execute Pending Migrations ⏳
**Action:** Run SQL migrations in Supabase SQL Editor
**Files:**
- `ADD_GASTRONOMIC_PROFILE_COLUMN.sql`
- `ADD_SIGNATURE_THEMES_COLUMN.sql`
**Purpose:** Create separate database columns for new fields

---

## Files Modified

1. ✅ `supabase/functions/menu-extract-v2/index.ts` (lines 743-808)
2. ✅ `MENU-EXTRACTION-PROMPTS-DOCUMENTATION.md` (Stage 2 documentation)
3. ✅ Deployed to Supabase (169kB, successful)

## Files Created

1. ✅ `_check_individual_menu_summary_quality.sql` (verification query)
2. ✅ `INDIVIDUAL-MENU-SUMMARY-PROMPT-UPDATE.md` (this file)

---

## Testing Checklist

- [ ] Extract menus for Café Faust (all service periods)
- [ ] Run `_check_individual_menu_summary_quality.sql`
- [ ] Verify NO subjective language in ai_summary
- [ ] Verify NO target audience in ai_summary
- [ ] Verify NO specific dish names in ai_summary
- [ ] Verify category-focused descriptions
- [ ] Regenerate Brand Profile
- [ ] Run `_check_gastronomic_profile.sql`
- [ ] Run `_check_signature_themes.sql`
- [ ] Verify clean output in UI (no contamination)
- [ ] Execute database migrations
- [ ] Re-verify with separate columns

---

## Success Metrics

**Individual Menu Summary Quality:**
- Objective tone: 100% (no subjective words)
- Category-focused: 100% (no specific dishes)
- No audience: 100% (no target groups)
- No atmosphere: 100% (no mood descriptions)

**Cross-Menu Summary Quality:**
- Uses clean input ✅
- Generates clean output ✅
- Signature themes include service periods ✅
- Signature themes include beverage focus if applicable ✅

**Gastronomic Profile Quality:**
- 1-2 sentences only ✅
- Factual, no sales language ✅
- Mentions price level or style ✅

---

**Status:** Ready for testing. All code changes deployed successfully.
