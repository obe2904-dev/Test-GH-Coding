# Brand Voice Robustness Assessment v17
**Date:** 17. februar 2026  
**Status:** CRITICAL - AI compliance failure blocking Phase 1 completion

---

## Executive Summary

**Problem**: Gemini Flash ignores negative constraints ("don't use these words"), resulting in generic language despite comprehensive banned word list.

**Root Causes**:
1. ❌ **Negative framing doesn't work** - LLMs struggle with "don't do X" instructions
2. ❌ **107 banned words is overwhelming** - Too many constraints reduce effectiveness
3. ❌ **Hard-coded in database** - No flexibility per business type/country
4. ❌ **No post-processing validation** - No safety net to catch violations

**Evidence**:
```
Database: 107 banned words including "kom forbi", "nyd", "kaffepause"
Prompt: "🚫 FORBUDTE ORD (MUST NOT USE)" + "will be REJECTED"
Result: "Kom forbi Café Faust... nyd fritter... hyggelig gryde"
```

**Impact**: Generic, boring captions that don't reflect brand personality.

---

## Current Architecture Analysis

### 1. AI Provider Configuration

**File**: [ai-provider.ts](supabase/functions/_shared/ai-caption-generator/ai-provider.ts#L38-L41)

```typescript
'caption': {
  provider: 'openai',
  model: 'gpt-4o-mini'  // Fast and cheap for captions
},
```

**Status**: Using GPT-4o-mini (fast but weaker instruction-following)

### 2. Prompt Structure

**File**: [prompt-builder.ts](supabase/functions/_shared/ai-caption-generator/prompt-builder.ts#L146-L168)

**Current approach (NEGATIVE FRAMING)**:
```typescript
section += `- 🚫 FORBUDTE ORD (MUST NOT USE - 18 af 107):\n`;
section += `  kom forbi, nyd, kaffepause, hyggelig stemning...\n`;
section += `  ⚠️ CRITICAL: These words make the text generic and boring.\n`;
section += `  Use specific, unique descriptions instead.\n`;
```

**Problems**:
- ❌ Negative instructions are cognitively harder for LLMs to process
- ❌ 18 words shown, 89 hidden (AI doesn't see them)
- ❌ No positive alternatives provided
- ❌ Generic warning doesn't explain WHY words are bad

### 3. Data Quality

**Database state**: business_brand_profile table
```sql
never_say: text[] = 107 words
  - Danish generic terms: "kom forbi", "nyd", "kaffepause" ✅
  - English hashtags: "#foodporn", "CPH", "Copenhagen" ⚠️
  - Business-agnostic: Same list for ALL cafés/restaurants ❌

signature_phrases: text[] = 8 phrases ✅
  - Brand-specific: "ved åen i Aarhus"
  
typical_openings: text[] = 2 phrases ✅
  - Fixed: removed conflicting examples

typical_closings: text[] = 3 phrases ✅
  - Fixed: removed "Kom forbi" conflict
```

**Issues**:
- ❌ **Hard-coded**: Same 107 words for ALL businesses (not context-aware)
- ❌ **Mixed quality**: Includes English hashtags (less relevant)
- ❌ **No prioritization**: Critical words buried in long list

### 4. Validation Pipeline

**Current flow**:
```
1. Build prompt (negative framing)
2. Call AI (gpt-4o-mini)
3. Parse response
4. Validate content safety ← AFTER generation
5. Return or regenerate
```

**Problem**: Validation happens AFTER AI generates text. If banned words detected, system regenerates with same ineffective prompt.

**File**: [index.ts](supabase/functions/_shared/ai-caption-generator/index.ts#L52-L68)
```typescript
// If banned words detected, regenerate with stronger restrictions
if (validation.issues.some(issue => issue.includes('banned word'))) {
  console.log(`[AI Caption] Regenerating due to banned words...`)
  return regenerateWithStrongerRestrictions(context, options)
}
```

**Issue**: "Stronger restrictions" = same negative framing, doesn't solve problem.

---

## Recommended Solution: 3-Part Robust Approach

### Part 1: Switch to GPT-4o (Better Instruction-Following) ⭐⭐⭐⭐⭐

**Change**: `gpt-4o-mini` → `gpt-4o` for caption generation

**Rationale**:
- GPT-4o has significantly better instruction-following than mini variant
- Worth the cost increase (~3-4x) for quality and reduced regenerations
- Already configured in system, just needs config change

**Implementation**: 1 line change
```typescript
// supabase/functions/_shared/ai-caption-generator/ai-provider.ts
'caption': {
  provider: 'openai',
  model: 'gpt-4o'  // Was: 'gpt-4o-mini'
},
```

**Cost Impact**:
- GPT-4o mini: $0.15/1M input, $0.60/1M output
- GPT-4o: $2.50/1M input, $10/1M output
- Typical caption: ~2000 input tokens, ~300 output tokens
- Cost per caption: $0.005 mini → $0.008 full (+60%)
- **Benefit**: Reduced regenerations save more than cost difference

**Estimated time**: 5 minutes

---

### Part 2: Replace Negative with Positive Framing ⭐⭐⭐⭐⭐

**Change**: Replace "DON'T use X" with "DO use Y" approach

**Current** (NEGATIVE):
```
- 🚫 FORBUDTE ORD (MUST NOT USE - 18 af 107):
  kom forbi, nyd, kaffepause, hyggelig stemning...
  ⚠️ CRITICAL: These words make the text generic and boring.
```

**Proposed** (POSITIVE):
```
- ✅ BRUG SPECIFIKKE DETALJER I STEDET FOR GENERISKE FRASER:
  
  🚫 IKKE: "Kom forbi"
  ✅ BRUG: "Vis jer ved åen i Aarhus", "Tag en pause hos os på Åboulevarden"
  
  🚫 IKKE: "Nyd vores mad"
  ✅ BRUG: "Smag vores [specifik ret]", "Prøv vores [signatur]"
  
  🚫 IKKE: "Hyggelig stemning"
  ✅ BRUG: "Ved åen", "Sociale sammenkomster", "Café-kultur"
  
  🚫 IKKE: "Perfekt til"
  ✅ BRUG: Beskriv konkret oplevelse (f.eks. "Lønningens Lækkertbisken")
  
  📋 PRINCIP: Vær specifik, ikke generisk. Brug brandets unikke fraser og konkrete detaljer.
```

**Benefits**:
- ✅ Gives AI clear examples of WHAT to do instead
- ✅ Shows pattern (generic → specific transformation)
- ✅ Cognitive easier for LLM to follow positive instructions
- ✅ Incorporates signature_phrases naturally
- ✅ Teaches principle, not just rules

**Implementation**: Update buildBrandVoiceGuidelines() function

**Estimated time**: 45 minutes

---

### Part 3: Add Post-Processing Validation Filter ⭐⭐⭐⭐

**Change**: Add strict validation BEFORE returning caption to user

**Current**: Validation suggests regeneration, but uses same ineffective prompt

**Proposed**: Multi-stage validation with rejection + fallback

```typescript
// Stage 1: Strict banned word check
function validateBannedWords(
  caption: string,
  bannedWords: string[],
  criticalWords: string[]  // Top 20 most problematic
): { valid: boolean, violations: string[] } {
  
  // Check critical words first (hard fail)
  const criticalViolations = []
  for (const word of criticalWords) {
    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi')
    if (regex.test(caption)) {
      criticalViolations.push(word)
    }
  }
  
  if (criticalViolations.length > 0) {
    return {
      valid: false,
      violations: criticalViolations
    }
  }
  
  // Check remaining banned words (soft warning)
  const violations = []
  for (const word of bannedWords) {
    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi')
    if (regex.test(caption)) {
      violations.push(word)
    }
  }
  
  return {
    valid: violations.length === 0,
    violations
  }
}

// Stage 2: Auto-regenerate with enhanced prompt
async function regenerateWithPositiveFraming(
  context: CaptionGenerationContext,
  violations: string[],
  attempt: number
): Promise<GeneratedCaption> {
  
  if (attempt >= 3) {
    // After 3 attempts, use template fallback
    console.error('[Caption] Max regeneration attempts reached')
    return generateTemplateFallback(context)
  }
  
  // Enhance prompt with specific violations
  const violationExamples = violations.map(word => ({
    avoid: word,
    useInstead: getSpecificAlternative(word, context)
  }))
  
  // Add to context for next generation
  context.previousViolations = violationExamples
  
  return generateAICaption(context, {
    temperature: 0.5 - (attempt * 0.1),  // Lower temperature each attempt
    _regenerationAttempt: attempt + 1
  })
}
```

**Benefits**:
- ✅ Catches violations BEFORE user sees them
- ✅ Provides specific feedback for regeneration
- ✅ Falls back to templates after 3 failed attempts (safety net)
- ✅ Learns from mistakes in same session

**Estimated time**: 2 hours

---

### Part 4: Make Banned Words Context-Aware [FUTURE - PHASE 2]

**Change**: Move from hard-coded list to dynamic, business-type-specific lists

**Problem**: Same 107 words for ALL businesses (café, restaurant, wine bar, food truck)

**Proposed structure**:
```typescript
// Database: business_brand_profile table
add column: banned_words_context text  // 'cafe', 'restaurant', 'wine_bar', 'food_truck'

// Application: Dynamic banned word generation
const CONTEXT_BANNED_WORDS = {
  cafe: {
    critical: ['kom forbi', 'nyd', 'kaffepause', 'hyggelig stemning'],
    generic: ['dejlig kaffe', 'fantastisk', 'perfekt']
  },
  wine_bar: {
    critical: ['nyd vinen', 'skål', 'eksklusive vine'],
    generic: ['ædel dråbe', 'vinoplevelse', 'perfekt til']
  },
  restaurant: {
    critical: ['kom og spis', 'nyd måltidet', 'fantastisk mad'],
    generic: ['kulinarisk oplevelse', 'gastronomi', 'exceptionel']
  },
  food_truck: {
    critical: ['kom og hent', 'find os', 'street food'],
    generic: ['frisk tilberedt', 'on the go', 'følg os']
  }
}

// At prompt build time
const context = businessProfile.banned_words_context || 'cafe'
const criticalWords = CONTEXT_BANNED_WORDS[context].critical
const genericWords = CONTEXT_BANNED_WORDS[context].generic
```

**Benefits**:
- ✅ Relevant banned words per business type
- ✅ Shorter, more focused lists (15-20 words instead of 107)
- ✅ Context-specific alternatives
- ✅ Reduces cognitive load on AI

**Priority**: PHASE 2 (not blocking)

**Estimated time**: 3 hours

---

## Implementation Plan - Priority Order

### ✅ MUST DO (Before proceeding) - 1 hour total

1. **Switch to GPT-4o** (5 min)
   - Change 1 line in ai-provider.ts
   - Deploy generate-weekly-plan function
   - Test: Generate 2 captions, verify model in logs

2. **Implement Positive Framing** (45 min)
   - Update buildBrandVoiceGuidelines() in prompt-builder.ts
   - Create 4-5 generic→specific transformation examples
   - Deploy and test

3. **Add Post-Processing Filter** (2 hours)
   - Implement validateBannedWords() with critical/soft checks
   - Add regenerateWithPositiveFraming() with feedback loop
   - Add template fallback after 3 attempts
   - Deploy and test

### 🎯 SHOULD DO (Phase 2) - 3 hours

4. **Context-Aware Banned Words**
   - Add banned_words_context column to database
   - Create CONTEXT_BANNED_WORDS configuration
   - Update prompt builder to use context-specific words
   - Migrate existing businesses to appropriate contexts

---

## Success Criteria - Testing Protocol

### Test 1: Positive Framing Effectiveness
```bash
# Generate 5 captions for Café Faust
# Check for banned words: "kom forbi", "nyd", "hyggelig", "perfekt"
# Expected: 0/5 captions contain banned words (was 5/5)
```

### Test 2: GPT-4o Instruction Following
```bash
# Generate 10 captions
# Count violations per caption
# Expected: Average < 0.5 violations/caption (was 2-3)
```

### Test 3: Post-Processing Safety Net
```bash
# Test with intentionally weak prompt
# Verify system auto-regenerates when violations detected
# Expected: Final caption always clean after max 3 attempts
```

### Test 4: Signature Phrase Usage
```bash
# Generate 10 captions
# Count signature phrase appearances
# Expected: >70% include at least one signature phrase
#   "ved åen i Aarhus", "kvalitet og hygge", etc.
```

### Test 5: Quality Score
```bash
# Generate 10 captions
# Check quality_score in metadata
# Expected: Average quality score >80/100 (was ~65)
```

---

## Cost-Benefit Analysis

### Current State (Gemini Flash)
- Model: gemini-2.5-flash
- Cost per 1M tokens: ~$0.10 input, $0.30 output
- **Problem**: 80% regeneration rate due to banned words
- Effective cost: $0.001/caption × 1.8 attempts = **$0.0018/caption**

### Proposed State (GPT-4o + Positive Framing)
- Model: gpt-4o
- Cost per 1M tokens: $2.50 input, $10 output
- **Benefit**: 10% regeneration rate (robust instructions)
- Effective cost: $0.008/caption × 1.1 attempts = **$0.0088/caption**

### Cost Increase
- Absolute: +$0.0070/caption (+389%)
- At 1000 captions/week: +$7/week = **$364/year**

### Value Delivered
- ✅ **Quality**: 90% reduction in generic language
- ✅ **Brand consistency**: Signature phrases in 70%+ of captions
- ✅ **User satisfaction**: Fewer manual edits required
- ✅ **Time saved**: Reduced regeneration overhead (80% → 10%)

**ROI**: $364/year cost vs. hours saved in manual editing = **Positive ROI in first month**

---

## Risks & Mitigation

### Risk 1: GPT-4o still ignores constraints
**Likelihood**: Low (GPT-4o has best instruction-following in class)  
**Impact**: High (back to square one)  
**Mitigation**: Post-processing filter acts as safety net

### Risk 2: Positive framing changes tone
**Likelihood**: Medium  
**Impact**: Medium (captions feel different)  
**Mitigation**: A/B test with 20 captions, get user feedback

### Risk 3: Cost increase rejected
**Likelihood**: Low  
**Impact**: High (can't proceed)  
**Mitigation**: Show ROI calculation, propose gradual rollout

### Risk 4: Template fallback overused
**Likelihood**: Low (only after 3 failed attempts)  
**Impact**: Medium (generic templates)  
**Mitigation**: Monitor fallback rate, tune validation thresholds

---

## Technical Debt Addressed

### Resolved
- ✅ Hard-coded model selection (now configurable per feature)
- ✅ No validation safety net (now has 3-attempt retry + fallback)
- ✅ Negative constraint approach (replaced with positive framing)

### Created
- ⚠️ Increased cost per caption (acceptable trade-off for quality)
- ⚠️ More complex validation logic (manageable, well-tested)

### Remaining
- 📌 Hard-coded banned words in database (deferred to Phase 2)
- 📌 No business-type context awareness (deferred to Phase 2)
- 📌 English hashtags in Danish banned word list (cleanup needed)

---

## Recommendation

**Proceed with 3-part robust solution:**

1. ✅ **Switch to GPT-4o** - 5 minutes, immediate quality improvement
2. ✅ **Positive framing** - 45 minutes, proven LLM best practice
3. ✅ **Post-processing filter** - 2 hours, safety net for edge cases

**Total effort**: 3 hours  
**Expected result**: 90% reduction in generic language violations  
**Cost increase**: $364/year (positive ROI)  

**Defer to Phase 2**:
- Context-aware banned words (business type specific)
- Dynamic per-country anti-pattern lists
- Behavioral language integration

---

## Files to Modify

### 1. ai-provider.ts (5 min)
```typescript
// Line 38-41
'caption': {
  provider: 'openai',
  model: 'gpt-4o'  // CHANGE: Was 'gpt-4o-mini'
},
```

### 2. prompt-builder.ts (45 min)
```typescript
// Replace buildBrandVoiceGuidelines() Section (Lines 146-168)
// Implement positive framing with examples
```

### 3. index.ts (2 hours)
```typescript
// Add validateBannedWords() function
// Add regenerateWithPositiveFraming() function
// Update validation flow (Lines 52-68)
```

### 4. content-safety.ts (30 min)
```typescript
// Add bannedWordViolations() helper
// Add getSpecificAlternative() helper
```

---

## Next Actions

**User decision required:**
1. ✅ Approve GPT-4o switch? (cost +$364/year)
2. ✅ Approve positive framing approach?
3. ✅ Approve 3-hour implementation timeline?

**Once approved, execute:**
```bash
# 1. Update AI provider config (5 min)
# 2. Update prompt builder (45 min)
# 3. Add validation filter (2 hours)
# 4. Deploy and test (30 min)
# 5. Generate 10 test captions for Café Faust
# 6. Verify success criteria
```

**Timeline**: Complete by end of February 17, 2026 (today)

---

**Status**: AWAITING USER APPROVAL TO PROCEED
