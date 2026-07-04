# Brand Profile Fallback Builder: Factual Accuracy Problem

**Date:** April 29, 2026  
**Status:** 🔴 CRITICAL - Fallback builder passes validation but generates factually inaccurate content  
**Component:** `/supabase/functions/_shared/brand-profile/repair/fallback-builders.ts`

---

## Executive Summary

Quality validation system works correctly (detects operational language, measures emotional positioning). However, the **fallback builder optimizes for passing validation rules rather than factual accuracy**, resulting in content that passes all checks but contains false claims.

**Core Issue:** The fallback builder makes cultural/temporal assumptions instead of analyzing actual business data.

---

## What Was Built (Working Correctly)

### 1. Quality Validators (`quality-validators.ts`)
✅ **Status:** Fully functional, all tests passing

**Validates 4 dimensions:**
- Forbidden patterns: "serverer", "skifter til", "om dagen...om aftenen"
- Emotional positioning: 0-10 score based on patterns like "det velfortjente stop", "når du skal have"
- Sensory grounding: Spatial, visual, temporal language
- Unverifiable claims: Awards, heritage, age claims without evidence

**What it does well:**
- Correctly detects operational vs emotional language
- Identifies forbidden pattern violations
- Scores emotional positioning accurately

**What it doesn't check:**
- ❌ Factual accuracy of temporal claims (e.g., is 9:30 AM "morgenkaffe"?)
- ❌ Whether mentioned offerings match actual menu data
- ❌ Cultural accuracy of interpretations

### 2. Integration (`validators.ts`, `index.ts`)
✅ **Status:** Deployed to production, quality checks active

- Quality validation runs after structural validation
- Fallback triggers when validation fails
- System detects operational language in AI output

### 3. Fallback Builder Rewrite (`fallback-builders.ts`)
⚠️ **Status:** Generates analytical output that passes validation but contains factual errors

**What changed:**
- OLD: Operational enumeration ("serverer X om dagen og skifter til Y om aftenen")
- NEW: Analytical interpretation with emotional hooks ("Det velfortjente stop...åbent fra morgenkaffe til natøl")

**Validation results:**
- Forbidden patterns: 5 → 0 ✅
- Emotional score: 0/10 → 3/10 ✅
- Structural validation: PASS ✅

**But factually wrong:** See Problem section below

---

## The Problem: Factual Errors in "Successful" Output

### Example: Café Faust (Business ID: 2037d63c-a138-4247-89c5-5b6b8cef9f3f)

**Fallback Output (passes all validation):**
```
"Det velfortjente stop ved åen i Aarhus — åbent fra morgenkaffe til natøl."
```

**Validation Results:**
- ✅ Contains "det velfortjente stop" (emotional positioning +3)
- ✅ Contains location cue "ved åen i Aarhus"
- ✅ Zero forbidden patterns
- ✅ Passes all quality checks

**Factual Errors:**

1. **"morgenkaffe" - WRONG**
   - Business opens: 9:30 AM (or 9:00 AM)
   - In Danish culture, "morgen" = 6-8 AM
   - 9:30 is late breakfast/brunch timing, NOT morning coffee

2. **"kaffe" - MISLEADING**
   - Actual core offerings: Brunch, frokost, 3-retters menuer, cocktails
   - Kaffe exists but is NOT a core offering worth highlighting
   - Misrepresents business identity

3. **"natøl" - WRONG**
   - Actual late-night offering: Cocktails (not beer)
   - Drinks menu doesn't emphasize beer
   - Closes 02:00 on weekends but with cocktails, not "øl"

### What the Business Actually Is

**Real Identity (from data):**
- All-day waterfront destination with multiple modes:
  - Family-friendly relaxed mornings (børnemenu, brunch)
  - Casual daytime eating (solid frokost, takeaway)
  - Elevated evening dining (delikate 3-retters menuer)
  - Social late-night bar scene (cocktails til kl. 02 weekends)

**Correct interpretation should be:**
- "fra brunch til cocktails" (actual offerings, not invented)
- "all-day waterfront" (interprets what multi-mode means)
- Opening time = late breakfast/brunch, not "morgen"

---

## Root Cause Analysis

### Why This Happened Twice

**First error (stopped by user):**
- Proposed: "kaffe om morgenen når du skal have starten på dagen"
- Error: Opens 9:30 (not morning), missed restaurant identity
- User response: "NO CODE - you are drifting without thinking"

**Second error (just discovered):**
- Generated: "morgenkaffe til natøl"
- Same errors: Wrong time interpretation, wrong offerings
- But this time it **passed validation** so was deployed

**Pattern:** Agent optimized for passing quality checks, not verifying facts

### The Core Problem

**Fallback builder logic:**
```typescript
const earliestOpen = 9  // or 9.5
const latestClose = 2
const temporalSpan = "åbent fra morgenkaffe til natøl"  // ❌ ASSUMPTION
```

**Assumptions made (all wrong):**
1. 9:00-9:30 opening = "morgenkaffe" → Cultural error
2. Late closing = "natøl" → Menu data error
3. Temporal span sounds good = good output → Style over substance

**What should happen:**
1. Read actual menu categories: brunch, frokost, cocktails
2. Interpret opening time culturally: 9:30 = late breakfast/brunch
3. Use actual drink offerings: cocktails (not "øl")
4. Generate: "fra brunch til cocktails" or similar data-grounded text

---

## Data Available (But Not Being Used Correctly)

The fallback builder has access to:

```typescript
interface DataSources {
  business: { city, address, vertical, category, business_name }
  location: { enrichment: { macro, micro } }
  menu: { items, categories, programmes }  // ← Contains actual offerings
  opening_hours: { weekday, open_time, close_time }  // ← Contains actual times
  website: { keywords, hooks, menu_mentions, analysis }
  operations: { has_outdoor_seating, has_takeaway, has_kids_menu, kitchen_close_time }
  profile: { business_category }
}
```

**Currently:** Fallback uses `opening_hours.open_time` to calculate `earliestOpen` but then **assumes** what that means ("morgenkaffe")

**Should:** Use `menu.categories` and `menu.programmes` to determine **actual offerings** (brunch, cocktails), then interpret time in that context

---

## What Needs to Happen

### 1. Add Factual Accuracy Validation Layer

Create validators that check:
- **Temporal claims vs cultural norms:** 9:30 ≠ "morgen" in Denmark
- **Offering claims vs menu data:** Only mention items/categories in menu
- **Drink claims vs drink menu:** "øl" vs "cocktails" vs "drinks"
- **Interpretation grounding:** Every claim must cite data source

### 2. Rewrite Fallback to Be Data-Literal

**Current approach:**
- Read opening hours → assume what they mean → generate poetic span

**Required approach:**
- Read menu categories → use actual names → interpret what experience means
- Read opening times → apply cultural context → describe accurately
- Read drinks menu → use actual drink types → avoid assumptions

**Example logic:**
```typescript
// WRONG (current)
const temporalSpan = "åbent fra morgenkaffe til natøl"

// RIGHT (data-grounded)
const morningOffering = menu.categories.includes('brunch') ? 'brunch' : 'morgenmad'
const eveningOffering = menu.categories.includes('cocktails') ? 'cocktails' : 'drinks'
const temporalSpan = `åbent fra ${morningOffering} til ${eveningOffering}`
```

### 3. Change Testing Approach

**Current test:** Does output pass quality validators? ✅

**Missing test:** Does output match source data?
- Opening time claim → Check against `opening_hours`
- Offering claim → Check against `menu.categories` or `menu.items`
- Cultural interpretation → Apply cultural norms (9:30 ≠ morgen)

### 4. Hard Rules for Fallback Builder

1. **Every claim must cite data:** No "morgenkaffe" without menu evidence
2. **Cultural verification required:** Time interpretations must match Danish norms
3. **Use actual menu terminology:** "brunch" not "morgenkaffe", "cocktails" not "natøl"
4. **Interpretation ≠ invention:** Interpret what data MEANS, don't invent what it SAYS

---

## Files to Modify

### High Priority

1. **`fallback-builders.ts` (lines 509-650):** Rewrite `buildFallbackBrandEssence()`
   - Replace temporal assumptions with menu-driven logic
   - Use actual offering names from `menu.categories`
   - Apply cultural time interpretation rules

2. **`quality-validators.ts` (new function):** Add `validateFactualAccuracy()`
   - Check temporal claims against cultural norms
   - Verify offering claims against menu data
   - Flag assumptions without data support

### Medium Priority

3. **`validators.ts`:** Add factual accuracy check after quality validation
4. **`index.ts`:** Include factual accuracy errors in fallback trigger

---

## Testing Requirements

### Before deploying any new fallback logic:

1. **Data verification test:**
   - Input: Café Faust data (opens 9:30, has brunch/cocktails)
   - Expected: "brunch til cocktails" (or similar)
   - Forbidden: "morgenkaffe", "natøl", any un-grounded claims

2. **Cultural accuracy test:**
   - 6:00-8:00 opening → "morgenkaffe" ✅
   - 9:00-10:00 opening → "brunch" or "morgenmad" ✅
   - 9:00-10:00 opening → "morgenkaffe" ❌

3. **Menu evidence test:**
   - Menu has "cocktails" → can mention "cocktails" ✅
   - Menu has "øl" category → can mention "øl" ✅
   - Menu has cocktails → mention "natøl" ❌ (wrong type)
   - Menu has no kaffe category → emphasize "morgenkaffe" ❌

---

## Success Criteria

**A fallback is successful when:**
1. ✅ Passes quality validation (emotional positioning, no forbidden patterns)
2. ✅ Every claim has data source (menu category, opening time, feature)
3. ✅ Cultural interpretations are accurate (time, terminology)
4. ✅ Matches business identity (café vs restaurant vs bar emphasis)
5. ✅ Adapts to data richness (specific when rich, generic when sparse)

**Current status:** Only criterion 1 met

---

## Context for New Chat

**What works:**
- Quality validators detect operational language correctly
- Integration triggers fallback when AI fails
- System architecture is sound

**What's broken:**
- Fallback optimizes for pattern compliance over factual accuracy
- No validation layer for data-to-claim matching
- Cultural assumptions not verified against norms

**Starting point for fixes:**
- Read `fallback-builders.ts` lines 509-650
- Review `DataSources` interface to see available data
- Check `menu.categories` and `menu.programmes` for actual offerings
- Consider cultural time interpretation rules (Denmark-specific)

**Previous conversation had 7550+ lines** - recommend starting fresh with this document rather than reading full transcript.
