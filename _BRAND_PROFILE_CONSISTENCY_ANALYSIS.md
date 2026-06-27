# Brand Profile Consistency Analysis

**Date:** June 21, 2026  
**Analysis:** brand-profile-generator-v5 architecture  
**Focus:** Preventing contradictions between rules and examples

---

## Executive Summary

**FINDING:** The brand profile generator creates **5 separate AI calls** that generate related but unchecked content, leading to contradictions like those found in Café Faust.

**IMPACT:** Rules ban patterns that appear in examples, causing unpredictable AI behavior during text generation.

**ROOT CAUSE:** No cross-validation between:
1. `voice.tone_rules` ↔ `voice_guardrails.never_say`
2. `voice.tone_rules` ↔ `enhanced_social_examples`
3. `voice_guardrails.never_say` ↔ `enhanced_social_examples`
4. `marketing_manager_brief` ↔ `voice.formality_level`

---

## Current Architecture

### 5 Independent AI Generation Steps

```
Step 1: generateVoiceProfile()
   ↓ Generates: tone_rules, formality_level, personality_traits
   
Step 2: generateGuardrails()
   ↓ Generates: never_say, avoid_patterns, content_exclusions
   
Step 3: generateWritingExamples()
   ↓ Generates: typical_openings, typical_closings, good_examples
   
Step 4: generateToneDNA()
   ↓ Generates: tone_dna, formality_requirement
   
Step 5: generateEnhancedExamples()
   ↓ Generates: enhanced_social_examples (8 approved posts)
```

**CRITICAL ISSUE:** Each step calls OpenAI independently with **partial context**. No step sees the output of other steps.

---

## Where Contradictions Occur

### Contradiction Type 1: **Imperative Ban vs. Imperative Examples**

**Location:** 
- `voice.tone_rules[8]`: "Brug aldrig imperativ (kom forbi, tag med)"
- `enhanced_social_examples[4/8]`: "Kom forbi", "Tag en lille pause"

**Why it happens:**
```typescript
// Step 1: Voice profile AI call
const voiceProfile = await generateVoiceProfile(...)
// Returns: tone_rules: ["Brug aldrig imperativ..."]

// Step 5: Enhanced examples AI call (400+ lines later)
const enhancedExamples = await generateEnhancedExamples(...)
// Has NO ACCESS to voiceProfile.tone_rules
// Generates examples with imperatives
```

**Technical root cause:**
- `generateEnhancedExamples()` receives `voiceProfile` BUT only uses:
  - `personality_traits` (high-level adjectives)
  - `formality_level` (casual/formal)
- **Does NOT receive:** `tone_rules` (specific bans)

**File:** [tone-dna-generator.ts](supabase/functions/_shared/brand-profile/tone-dna-generator.ts)

---

### Contradiction Type 2: **Never-Say Words in Examples**

**Location:**
- `voice_guardrails.never_say`: "nyd det gode liv → (undgå)"
- `enhanced_social_examples[6/8]`: "Nyd en varm croissant"

**Why it happens:**
```typescript
// Step 2: Guardrails AI call
const guardrails = await generateGuardrails(...)
// Returns: never_say: ["nyd det gode liv → (undgå)", ...]

// Step 5: Enhanced examples (generated BEFORE guardrails applied)
const enhancedExamples = await generateEnhancedExamples(...)
// Has NO ACCESS to guardrails.never_say
// Uses "nyd" freely in examples
```

**Technical root cause:**
- Enhanced examples generated at Line 1490 (brand-profile-generator-v5/index.ts)
- Guardrails generated at Line 1172
- **Examples generated AFTER guardrails but don't receive them as input**

**File:** [brand-profile-generator-v5/index.ts](supabase/functions/brand-profile-generator-v5/index.ts#L1490)

---

### Contradiction Type 3: **Formality Conflict**

**Location:**
- `voice.formality_level`: "informal"
- `marketing_manager_brief`: "semi-formel og legende"

**Why it happens:**
```typescript
// Step 1: Voice profile determines formality
voiceProfile.formality_level = "informal"  // From AI inference

// Step 4: Tone DNA overrides formality
const rawFormality = toneDNA.culinary_character.formality_requirement
// Returns: "Semi-formel" (different AI model, different reasoning)

// Step 6: Marketing brief uses tone DNA formality
const brief = await generateMarketingManagerBrief(...)
// Uses toneDNA.culinary_character.formality_requirement
// Result: "semi-formel" ≠ "informal"
```

**Technical root cause:**
- Two AI models infer formality independently:
  1. `generateVoiceProfile()` → `formality_level`
  2. `generateToneDNA()` → `formality_requirement`
- Line 1473-1479 syncs `formality_level` from tone_dna
- **BUT** `marketing_manager_brief` still uses raw tone_dna value

**Files:** 
- [brand-profile-generator-v5/index.ts#L1473](supabase/functions/brand-profile-generator-v5/index.ts#L1473)
- [marketing-manager-brief-generator.ts](supabase/functions/_shared/brand-profile/marketing-manager-brief-generator.ts)

---

### Contradiction Type 4: **"Lækker" Both Banned and Recommended**

**Location:**
- `voice_guardrails.never_say`: "lækkert → (undgå altid)"
- `enhanced_social_examples`: "Lækker burgermenu"
- `owner_voice`: "lækker kaffe"

**Why it happens:**
- Guardrails AI sees "lækker" as generic praise → bans it
- Enhanced examples AI sees "lækker" in menu context → uses it
- Owner voice analysis extracts "lækker" from business data

**Technical root cause:**
- No context sharing between modules about **when** a word is acceptable
- Each AI call makes independent judgment

---

## Current Validation (Insufficient)

### What IS Validated

**File:** [validation.ts](supabase/functions/_shared/brand-profile/validation.ts)

```typescript
export function validateExamples(examples: string[], context: ValidationContext) {
  // ✅ Checks sentence length against voice rules
  // ✅ Checks location mention against context
  // ✅ Checks for Danish hospitality clichés (hardcoded list)
  // ✅ Checks concreteness vs. abstractness
  
  // ❌ Does NOT check examples against never_say rules
  // ❌ Does NOT check examples against tone_rules imperatives
  // ❌ Does NOT check examples against avoid_patterns
}
```

**Validation gaps:**
1. No cross-reference with `never_say` rules
2. No check for imperatives when tone_rules ban them
3. No formality consistency check
4. No duplicate field detection

---

## How to Ensure Consistency (Recommendations)

### Option 1: **Sequential Validation Chain** (Recommended)

Add cross-validation **after** each generation step:

```typescript
// Step 1: Generate voice profile
const voiceProfile = await generateVoiceProfile(...)

// Step 2: Generate guardrails
const guardrails = await generateGuardrails(...)

// Step 3: Generate examples WITH validation
const writingExamples = await generateWritingExamples(...)

// 🔥 NEW STEP 3B: Validate examples against guardrails
const validationResult = validateExamplesAgainstGuardrails(
  writingExamples.good_examples,
  guardrails.never_say,
  voiceProfile.tone_rules
)

if (!validationResult.passes) {
  // Retry with banned patterns list
  writingExamples.good_examples = await regenerateWithBans(
    validationResult.violations
  )
}

// Step 4: Generate enhanced social examples WITH all context
const enhancedExamples = await generateEnhancedExamples({
  voiceProfile,           // Full voice profile
  guardrails,             // Full guardrails
  bannedWords: guardrails.never_say,  // Explicit ban list
  bannedPatterns: extractBannedPatterns(voiceProfile.tone_rules)  // "never imperative" → ["kom", "tag", "nyd"]
})
```

**Implementation points:**
1. Pass `guardrails.never_say` to `generateEnhancedExamples()` input
2. Pass `voiceProfile.tone_rules` to `generateEnhancedExamples()` input
3. Create `extractBannedPatterns()` function to parse tone_rules:
   - "Brug aldrig imperativ" → Extract imperative verbs from Danish grammar
4. Add retry logic with violations list

**Files to modify:**
- [tone-dna-generator.ts](supabase/functions/_shared/brand-profile/tone-dna-generator.ts) → Add `bannedWords` and `bannedPatterns` to input
- [brand-profile-generator-v5/index.ts](supabase/functions/brand-profile-generator-v5/index.ts#L1490) → Pass guardrails to enhanced examples call
- [validation.ts](supabase/functions/_shared/brand-profile/validation.ts) → Add `validateExamplesAgainstGuardrails()` function

---

### Option 2: **Post-Generation Consistency Audit** (Quick Win)

Add final validation before saving to database:

```typescript
// After all generation completes (Line ~1550)
const consistencyAudit = auditBrandProfileConsistency({
  voiceProfile,
  guardrails,
  writingExamples,
  toneDNA,
  marketingBrief
})

if (consistencyAudit.contradictions.length > 0) {
  console.warn(`⚠️  Found ${consistencyAudit.contradictions.length} contradictions:`)
  for (const contradiction of consistencyAudit.contradictions) {
    console.warn(`   • ${contradiction.type}: ${contradiction.description}`)
    
    // Apply auto-fix if possible
    if (contradiction.auto_fixable) {
      applyFix(contradiction)
    } else {
      // Log for manual review
      await logContradiction(businessId, contradiction)
    }
  }
}
```

**Audit checks:**
1. **Never-say violations:** Scan all examples for words in `never_say`
2. **Imperative detection:** If tone_rules ban imperatives, check examples for imperative verbs
3. **Formality alignment:** Compare `formality_level` vs `marketing_manager_brief` formality terms
4. **Duplicate fields:** Check for `style_rules` vs `tone_rules`, etc.
5. **Missing required fields:** Ensure `writing_examples.good_examples` exists

**Auto-fixes:**
- Remove contradicting examples
- Standardize formality terminology
- Delete duplicate fields
- Populate missing `good_examples` from `enhanced_social_examples`

**Files to create:**
- `supabase/functions/_shared/brand-profile/consistency-audit.ts` (new file)

---

### Option 3: **Centralized Context Object** (Architectural)

Replace multiple AI calls with single comprehensive call:

```typescript
// Instead of 5 separate calls:
const brandProfile = await generateCompleteBrandProfile({
  business,
  location,
  menu,
  commercial,
  demographic
}, openaiClient)

// Single AI call with structured output:
// {
//   voice: { tone_rules, formality_level, personality_traits },
//   guardrails: { never_say, avoid_patterns },
//   examples: { good_examples, enhanced_social_examples },
//   validation: { cross_checked: true, contradictions: [] }
// }
```

**Pros:**
- AI sees full context in one call
- Can self-validate for contradictions
- Consistency guaranteed by design

**Cons:**
- Major architectural change
- Requires rewriting all generation logic
- Higher token cost per call (but fewer calls)

**Recommendation:** Long-term refactor, not immediate fix

---

## Immediate Action Plan (No Coding)

### For Existing Businesses (Manual Audit)

**Run this SQL query to find potential contradictions:**

```sql
-- Find businesses with imperative bans but imperative examples
SELECT 
  b.business_name,
  bp.business_id,
  'Imperative contradiction' AS issue_type,
  jsonb_array_length(bp.brand_profile_v5->'voice'->'tone_rules') AS tone_rules_count,
  jsonb_array_length(bp.enhanced_social_examples) AS examples_count
FROM business_brand_profile bp
JOIN businesses b ON b.id = bp.business_id
WHERE 
  -- Has imperative ban in tone_rules
  EXISTS (
    SELECT 1 
    FROM jsonb_array_elements_text(bp.brand_profile_v5->'voice'->'tone_rules') AS rule
    WHERE rule ILIKE '%aldrig imperative%' OR rule ILIKE '%never imperative%'
  )
  AND 
  -- Has imperative verbs in examples
  EXISTS (
    SELECT 1
    FROM jsonb_array_elements(bp.enhanced_social_examples) AS example
    WHERE example->>'text' ~* '\\b(kom|tag|nyd|prøv|smag|oplev|book|bestil)\\b'
  );

-- Find never_say violations in examples
SELECT 
  b.business_name,
  bp.business_id,
  'Never-say violation' AS issue_type,
  banned_word,
  example_text
FROM business_brand_profile bp
JOIN businesses b ON b.id = bp.business_id,
LATERAL (
  SELECT jsonb_array_elements_text(voice_guardrails->'never_say') AS banned_rule
) AS rules,
LATERAL (
  SELECT banned_rule SPLIT_PART ' → ' 1 AS banned_word
) AS words,
LATERAL (
  SELECT jsonb_array_elements(enhanced_social_examples) AS example
) AS examples,
LATERAL (
  SELECT example->>'text' AS example_text
) AS texts
WHERE example_text ILIKE '%' || banned_word || '%';

-- Find formality conflicts
SELECT 
  b.business_name,
  bp.business_id,
  'Formality conflict' AS issue_type,
  bp.brand_profile_v5->'voice'->>'formality_level' AS voice_formality,
  bp.marketing_manager_brief AS brief_formality
FROM business_brand_profile bp
JOIN businesses b ON b.id = bp.business_id
WHERE 
  (bp.brand_profile_v5->'voice'->>'formality_level' = 'informal' AND bp.marketing_manager_brief LIKE '%formel%')
  OR
  (bp.brand_profile_v5->'voice'->>'formality_level' = 'formal' AND bp.marketing_manager_brief LIKE '%casual%');
```

---

### For New Businesses (Preventive Validation)

**Add validation webhook after brand profile generation:**

1. **Trigger:** After brand-profile-generator-v5 completes
2. **Action:** Call new `validate-brand-profile-consistency` edge function
3. **Logic:**
   - Run all consistency checks
   - Return list of contradictions
   - Auto-fix simple issues (duplicate fields, missing good_examples)
   - Flag complex issues for review (imperative ban + imperative examples)
4. **Response:**
   - If contradictions found → Regenerate affected sections
   - If clean → Proceed to save

**Files to create:**
- `supabase/functions/validate-brand-profile-consistency/index.ts` (new edge function)

---

## Summary: Contradiction Prevention Checklist

### ✅ **Minimum Viable Fix** (Café Faust-style fixes)
1. Auto-populate `good_examples` from `enhanced_social_examples`
2. Remove duplicate fields (`style_rules`, `structural_rules`)
3. Standardize formality terminology across fields
4. Context-aware never_say rules (e.g., "lækker (abstract) → avoid; lækker [dish] → OK")

### ⚠️ **Recommended Fix** (Option 2: Post-Generation Audit)
1. Create `consistency-audit.ts` module
2. Add audit step before database save
3. Implement auto-fixes for simple contradictions
4. Log complex contradictions for review

### 🎯 **Ideal Fix** (Option 1: Sequential Validation)
1. Pass `guardrails` to `generateEnhancedExamples()` as input
2. Pass full `voiceProfile.tone_rules` to `generateEnhancedExamples()`
3. Extract banned patterns from tone_rules (imperatives, etc.)
4. Add retry logic when validation fails
5. Cross-validate formality across all modules

---

## Files Reference

| Module | File | Responsibility |
|--------|------|----------------|
| **Orchestrator** | [brand-profile-generator-v5/index.ts](supabase/functions/brand-profile-generator-v5/index.ts) | Main generation flow, calls all modules |
| **Voice** | [voice-profile.ts](supabase/functions/_shared/brand-profile/voice-profile.ts) | Generates `tone_rules`, `formality_level` |
| **Guardrails** | [guardrails.ts](supabase/functions/_shared/brand-profile/guardrails.ts) | Generates `never_say`, `avoid_patterns` |
| **Examples** | [writing-examples.ts](supabase/functions/_shared/brand-profile/writing-examples.ts) | Generates `typical_openings`, `good_examples` |
| **Tone DNA** | [tone-dna-generator.ts](supabase/functions/_shared/brand-profile/tone-dna-generator.ts) | Generates `enhanced_social_examples` |
| **Validation** | [validation.ts](supabase/functions/_shared/brand-profile/validation.ts) | Current validation (incomplete) |
| **Marketing Brief** | [marketing-manager-brief-generator.ts](supabase/functions/_shared/brand-profile/marketing-manager-brief-generator.ts) | Generates `marketing_manager_brief` |

---

**End of Analysis**
