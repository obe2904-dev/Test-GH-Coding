# ROOT CAUSE ANALYSIS: Layer 3 Inconsistencies

## Date: 2026-05-07
## Issue: Location naming inconsistency + Value title/description mismatch

---

## ISSUE 1: "ved Aarhus Å" vs "ved åen"

### What the User Sees:
- Brand Essence: "ved **Aarhus Å**"
- Positioning: "ved **åen**" ✅
- What Makes Us Different: "ved **Aarhus Å**"

### Root Cause:

**Data Provided to AI:**
```
LOCATION: Aarhus, Danmark
NEIGHBORHOOD: Aarhus
LOCAL REFERENCE: ved åen  ← Intended single source of truth
AREA TYPE: waterfront
```

**Current SYSTEM_PROMPT:**
```typescript
3. LOCATION CONTEXT MATTERS
   - Urban tourist area → "Historisk café i Nyhavn"
   - Suburban residential → "Kvartercafé hvor nabolaget mødes"
```

**Problem:**
- ✅ Prompt SHOWS "LOCAL REFERENCE: ved åen" in user prompt
- ❌ SYSTEM_PROMPT has NO explicit rule saying "USE LOCAL REFERENCE WHEN IT EXISTS"
- ❌ AI sees multiple location signals (city, neighborhood, area_type, local_reference)
- ❌ AI has world knowledge that "Aarhus Å" is the river in Aarhus
- ❌ AI constructs "ved Aarhus Å" (combining city + river knowledge)

**Why It's Inconsistent:**
- Sometimes AI uses "ved åen" (following the data)
- Sometimes AI constructs "ved Aarhus Å" (using its world knowledge)
- No explicit precedence rule in SYSTEM_PROMPT

### Non-Hardcoded Solution:

**Add explicit precedence rule to SYSTEM_PROMPT:**
```typescript
3. LOCATION NAMING - SINGLE SOURCE OF TRUTH
   When LOCAL REFERENCE field exists, use ONLY that exact phrase.
   Do NOT construct alternative location names from city/area_type/neighborhood.
   
   Examples:
   - LOCAL REFERENCE: "ved åen" → Use "ved åen" everywhere
   - LOCAL REFERENCE: missing → OK to use area_type/neighborhood
   
   ❌ WRONG: "ved Aarhus Å" (constructed from world knowledge)
   ✅ CORRECT: "ved åen" (from LOCAL REFERENCE field)
```

---

## ISSUE 2: "Lokal forankring" (title) vs "danske råvarer" (description)

### What the User Sees:
```
Core Value:
- Title: "Lokal forankring"
- Description: "bruger danske råvarer som Højer pølser og Tange Sø ost"
```

### Root Cause:

**Geographic Accuracy Rule (Currently in SYSTEM_PROMPT):**
```typescript
9. GEOGRAPHIC ACCURACY FOR "LOKAL"
   "Lokal" means from the same city/municipality (within ~30km)
   Suppliers from other cities/regions: Use "regional" or "dansk" instead
```

**Problem:**
- ✅ DESCRIPTION correctly says "danske råvarer" (following rule 9)
- ❌ TITLE says "Lokal forankring" (pattern-based, not validated against rule 9)
- ❌ Mismatch: Title claims "lokal", description admits "dansk"

**Why It Happens:**
- AI generates VALUE TITLES based on common patterns in examples
- "Lokal forankring" is a common value title in Danish restaurants
- AI then generates DESCRIPTION following the geographic accuracy rule
- But TITLES aren't explicitly validated against the same rule

### Non-Hardcoded Solution:

**Extend geographic accuracy rule to VALUE TITLES:**
```typescript
9. GEOGRAPHIC ACCURACY FOR "LOKAL" (applies to ALL text, including value titles)
   "Lokal" means from the same city/municipality (within ~30km)
   
   For supplier-based values:
   - Suppliers <30km: "Lokal forankring" + "lokale produkter"
   - Suppliers >30km: "Regional forankring" or "Dansk kvalitet" + "danske/regionale råvarer"
   
   VALUE TITLE must match VALUE DESCRIPTION geography:
   ❌ WRONG: Title "Lokal forankring" + Description "danske råvarer"
   ✅ CORRECT: Title "Dansk kvalitet" + Description "danske råvarer"
```

---

## IMPLEMENTATION PLAN (Generic, Data-Driven)

### Change 1: Location Naming Precedence
**File:** `identity-profile.ts` SYSTEM_PROMPT
**Action:** Replace rule 3 "LOCATION CONTEXT MATTERS" with explicit precedence rule

**Before:**
```typescript
3. LOCATION CONTEXT MATTERS
   - Urban tourist area → "Historisk café i Nyhavn"
   - Suburban residential → "Kvartercafé hvor nabolaget mødes"
```

**After:**
```typescript
3. LOCATION NAMING - SINGLE SOURCE OF TRUTH
   If LOCAL REFERENCE exists in data: Use ONLY that exact phrase for location.
   Do NOT construct alternative names from city/neighborhood/area_type/world knowledge.
   
   Data shows: LOCAL REFERENCE: "ved åen"
   ✅ Correct: "café ved åen"
   ❌ Wrong: "café ved Aarhus Å" (don't use world knowledge to expand)
   
   If NO local reference: OK to use neighborhood or area_type.
```

### Change 2: Geographic Consistency in Value Titles
**File:** `identity-profile.ts` SYSTEM_PROMPT
**Action:** Extend rule 9 to cover value titles

**Before:**
```typescript
9. GEOGRAPHIC ACCURACY FOR "LOKAL"
   "Lokal" means from the same city/municipality (within ~30km)
   Suppliers from other cities/regions: Use "regional" or "dansk" instead
```

**After:**
```typescript
9. GEOGRAPHIC ACCURACY (applies to all text including VALUE TITLES)
   "Lokal" = within 30km of business location
   "Regional" = same region/country
   
   For core_values about suppliers:
   - If suppliers <30km: Title "Lokal forankring" + Description "lokale produkter"
   - If suppliers >30km: Title "Dansk kvalitet" or "Regional forankring" + Description "danske/regionale råvarer"
   
   RULE: Value title geographic claim MUST match description.
   ❌ "Lokal forankring" + "danske råvarer" (mismatch)
   ✅ "Dansk kvalitet" + "danske råvarer" (consistent)
```

---

## VALIDATION

**Test Case:** Café Faust regeneration after changes

**Expected Results:**

**Location Naming:**
- Brand Essence: "café ved åen" (not "ved Aarhus Å") ✅
- Positioning: "ved åen" ✅
- What Makes Us Different: "ved åen" ✅

**Value Titles:**
- If suppliers are Højer (160km) + Tange Sø (90km):
  - Title: "Dansk kvalitet" or "Regional forankring" ✅
  - Description: "danske råvarer" or "regionale produkter" ✅
  - NO "Lokal forankring" title ✅

---

## WHY THIS IS NOT HARDCODED

1. **Location naming rule is generic:**
   - Works for ANY business with `local_location_reference` field
   - If field is empty, falls back to area_type/neighborhood
   - No Café Faust-specific logic

2. **Geographic accuracy rule is data-driven:**
   - Based on supplier distance (if we had that data)
   - Uses 30km threshold (standard definition of "local")
   - Applies to ANY business in ANY city

3. **Value title consistency is a pattern:**
   - Generic rule: Title geographic claim must match description
   - No hardcoded titles or supplier names
   - Validation logic, not specific fixes

---

## NOTES

**Current Workaround:**
The system currently has `local_location_reference = 'ved åen'` working ~66% of the time (Positioning uses it correctly, but Brand Essence and What Makes Us Different sometimes construct "ved Aarhus Å").

**After Fix:**
Should be 100% consistent: ALL location references use "ved åen" when that field exists.
