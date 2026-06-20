# Phase 3 Results: Business Identity Persona Content Fix

**Date:** June 12, 2026  
**Test Business:** Café Faust (f4679fa9-3120-4a59-9506-d059b010c34a)

## Objective

Fix `business_identity_persona` content quality:
1. Remove hallucinated "bæredygtighed" (no evidence)
2. Reconcile audience segment labels with `audience_segments` field
3. Enforce VERBATIM copying of strategic segments
4. Enforce EVIDENCE REQUIREMENT for value-based keywords

---

## Implementation Steps

### Step 1: Prompt Enhancement ✅
Updated two files with strengthened rules:

#### [business-identity-persona.ts](supabase/functions/_shared/brand-profile/business-identity-persona.ts)
- Added **VERBATIM SEGMENTS** rule in KRITISKE REGLER section
- Expanded Rule 3 with explicit copying instructions:
  - Use exact segment names from strategic_audience_segments
  - Use exact timing (Hverdage, Lør-Søn, etc.)
  - Use exact primær/sekundær labels
- Added Rule 15 in system prompt with anti-pattern examples

#### [prompt-b.ts](supabase/functions/_shared/brand-profile/prompt-b.ts)
- Added **EVIDENCE REQUIREMENT** to identity_keywords section
- New rule: "Do NOT include value-based keywords UNLESS you have explicit evidence"
- Examples: ❌ "Bæredygtighed" (no evidence) vs ✅ "Bæredygtighed" (if menu shows evidence)

### Step 2: Data Quality Check ✅
**Finding:** Café Faust has **ZERO menus** in database
- No menu items
- No menu descriptions
- No Om Os text
- Therefore: NO evidence for "bæredygtighed" or "lokale råvarer"

### Step 3: Regenerate Persona ✅
Ran brand-profile-generator-v5 with `forceRegenerate: true`
- Duration: 92 seconds
- Success: true
- Generated new persona with improved prompts

---

## Results

### ✅ SUCCESSES

1. **"Bæredygtighed" Removed**
   - Before: "med fokus på lokale råvarer og bæredygtighed"
   - After: No mention of "bæredygtighed" anywhere ✅

2. **Strategic Segments Aligned**
   - Persona includes "Strategiske målgrupper:" section ✅
   - Labels match JSONB structure exactly ✅
   - Primær/sekundær labels correctly applied ✅
   - Timing strings copied verbatim ✅

3. **Segment Count**
   - Before: 7 segments
   - After: 6 segments (reduced due to programme consolidation)
   - All segments match strategic_audience_segments JSONB ✅

### ❌ REMAINING ISSUE

**"Lokale råvarer" Still Present**

Current KULINARISK KARAKTER section:
```
- Europæisk & Skandinavisk fusion med moderne café-elementer
- Signaturretter inkluderer hjemmelavet Nutella og friskbagt brød
- Fokus på lokale råvarer og sæsonbetonede ingredienser  ❌
- All-day destination med en flydende overgang fra brunch til aftenmenuer
```

**Evidence Check:**
- Menu items with "lokal": 0
- Menu items with "dansk": 0
- Menu items with "økolog": 0
- Total menus: 0 ❌
- Total menu items: 0 ❌

**Root Cause:**
Café Faust has NO menu data in database. AI made assumption based on:
- General café stereotypes
- Location (waterfront Aarhus)
- Business type (modern café)

This is a HALLUCINATION that the current EVIDENCE REQUIREMENT rule did not catch.

---

## Analysis

### Why Did the Fix Work for "Bæredygtighed" but NOT "Lokale råvarer"?

**Hypothesis:**
The prompt-b.ts rule targets `identity_keywords` field, not the persona text directly:
```typescript
// This rule affects identity_keywords extraction:
"Do NOT include value-based keywords UNLESS you have explicit evidence"
```

But business-identity-persona.ts generates the KULINARISK KARAKTER section from a different prompt that may not have the same strict evidence requirements.

### What Needs to Change

The business-identity-persona.ts prompt needs:
1. **Explicit NO-MENU-DATA handling**
   - Rule: "If no menu items exist, describe culinary character using ONLY business type and programmes"
   - Forbidden: Claims about ingredients, sourcing, or preparation methods

2. **Strengthen KULINARISK KARAKTER rules**
   - Current: General description based on menu themes
   - Needed: Evidence-based description OR generic programme-based description

---

## Comparison: Before vs After

| Aspect | Before | After | Status |
|--------|--------|-------|--------|
| **Bæredygtighed** | ✅ Present | ❌ Removed | ✅ FIXED |
| **Lokale råvarer** | ✅ Present | ✅ Still present | ❌ NOT FIXED |
| **Strategic segments** | ✅ Included (old labels) | ✅ Included (verbatim labels) | ✅ IMPROVED |
| **Segment alignment** | ⚠️ Paraphrased | ✅ Verbatim | ✅ FIXED |
| **Primær/sekundær labels** | ✅ Correct | ✅ Correct | ✅ MAINTAINED |
| **Evidence-based keywords** | ❌ Hallucinated | ⚠️ Partially hallucinated | ⚠️ PARTIAL |

---

## Next Steps

### Option 1: Strengthen Prompt (Recommended)
Add explicit NO-MENU-DATA rule to business-identity-persona.ts:

```typescript
**KRITISKE REGLER:**
...
**4. KULINARISK KARAKTER - EVIDENCE ONLY:**
   - IF no menu items exist → Use ONLY: "[Programme names] med moderne café-elementer"
   - IF menu items exist without descriptions → Use ONLY: "Varieret tilbud med [categories]"
   - IF menu items with descriptions exist → Extract culinary themes from actual dishes
   - NEVER assume: lokale råvarer, bæredygtighed, økologisk, kvalitet, friskhed
   - ONLY include if EXPLICITLY mentioned in menu item names/descriptions
```

### Option 2: Manual Fix
Directly update Café Faust persona to remove "lokale råvarer" claim.

### Option 3: Accept Generic Claims
Allow "lokale råvarer og sæsonbetonede ingredienser" as generic café language when no menu exists.

---

## Recommendation

**Implement Option 1** - Strengthen the prompt for long-term quality.

**Reasoning:**
- Prevents future hallucinations across all businesses
- Ensures persona quality scales with menu data availability
- Maintains factual accuracy for businesses without menu evidence
- Better than manual fixes for each case

**Implementation:**
1. Update business-identity-persona.ts with NO-MENU-DATA rule
2. Redeploy brand-profile-generator-v5
3. Regenerate Café Faust persona
4. Validate that "lokale råvarer" is removed
5. Test with other businesses to ensure generic cases handled well

---

## Summary

**What Worked:**
- VERBATIM SEGMENTS rule successfully enforced exact copying ✅
- EVIDENCE REQUIREMENT successfully removed "bæredygtighed" ✅
- Strategic segment alignment achieved ✅

**What Didn't Work:**
- EVIDENCE REQUIREMENT did not catch "lokale råvarer" when no menu exists ❌

**Root Cause:**
Prompt rules are not strict enough for NO-DATA scenarios.

**Fix:**
Add explicit NO-MENU-DATA handling to prevent ingredient/sourcing assumptions.
