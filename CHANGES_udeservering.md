# Text Generation Quality Issues

## Reported Problems

### Example Text
```
#### Bulgogi beef klar til aften
Når eftermiddagen går på hæld, er det tid til saftig Bulgogi beef. Mørt kød med en sød og krydret marinade venter på dig i hjertet af Silkeborg. Perfekt før aftenens planer. Hop forbi! 🥩.
```

### Issues
1. **"går på hæld"** - Archaic/old-fashioned Danish phrase
2. **"Hop forbi"** - Not modern language (similar to "Svip forbi" which is explicitly marked as "for gammeldags")

### Context
These issues persist despite previous fixes, suggesting either:
- Text generation is overwhelmed/not following guardrails
- Spelling/correction layer not catching them

---

## Root Cause Analysis

### Problem 1: "Hop forbi" is Hardcoded in Fallback CTAs

**Location**: [select-cta.ts:277](supabase/functions/generate-text-from-idea/select-cta.ts#L277)

```typescript
const casualVisitCTAs: Record<string, string[]> = {
  da: [
    'Kom forbi i dag 😊',
    'Vi ses snart? ☕',
    'Hop forbi',  // ← HARDCODED ARCHAIC PHRASE
    'Vi glæder os til at se dig'
  ],
```

**Also in fallback**: [writing-examples.ts:823](supabase/functions/_shared/brand-profile/writing-examples.ts#L823)
```typescript
casual: ['Kom forbi!', 'Vi ses snart', 'Hop forbi'],
```

**Known archaic**: [writing-examples.ts:742](supabase/functions/_shared/brand-profile/writing-examples.ts#L742)
```typescript
- Eksempel: "Svip forbi" (for gammeldags)
```

### Why It Still Appears

1. **CTA Selection Flow**:
   - Brand-specific CTAs are generated with `avoid_phrases` list
   - If all brand CTAs are filtered out, falls back to hardcoded list
   - Hardcoded list still contains "Hop forbi"

2. **The Avoidance Mechanism Exists But Isn't Applied to Fallback**:
   ```typescript
   const avoidPhrases = ctaPreferences?.avoid_phrases || []
   const filtered = pool.filter(cta => 
     !avoidPhrases.some(avoid => cta.toLowerCase().includes(avoid.toLowerCase()))
   )
   
   if (filtered.length === 0) {
     console.warn('⚠️ All brand CTAs filtered out by avoid_phrases, using unfiltered pool')
     // ← BUG: Returns unfiltered pool instead of applying avoid_phrases to fallback too
   }
   ```

---

### Problem 2: "går på hæld" - No Detection System

**No archaic phrase detection in**:
- Guardrails `avoid_patterns` (only generic_marketing, brochure_language, etc.)
- Spelling system (no archaic phrase rules)
- Post-processing validation

**What exists**:
- Generic forbidden words (uforglemmelig, magisk, etc.)
- Meta-commentary patterns (based on, given that, etc.)
- Passive voice detection (serveres, tilbydes, etc.)

**What's missing**:
- Archaic time expressions: "går på hæld", "snart på bedding", etc.
- Archaic movement verbs: "svip forbi", "hop forbi", "stik indenfor", etc.
- Old-fashioned intensifiers and qualifiers

---

## System Architecture Map

### Where Language Quality is Enforced

1. **Brand Profile Generation** → Creates guardrails
   - File: [guardrails.ts](supabase/functions/_shared/brand-profile/guardrails.ts)
   - Generates: `never_say`, `avoid_patterns`, `content_exclusions`
   - Gap: No archaic phrase category

2. **CTA Generation** → Creates brand-specific CTAs with avoid_phrases
   - File: [writing-examples.ts](supabase/functions/_shared/brand-profile/writing-examples.ts)
   - Should generate: `cta_preferences.avoid_phrases: ["Svip forbi"]` as example
   - Gap: Fallback CTAs don't respect avoid_phrases

3. **Text Generation Prompts** → Instructions to AI
   - Files: [prompt-builders.ts](supabase/functions/generate-text-from-idea/prompt-builders.ts), [prompt-components.ts](supabase/functions/generate-text-from-idea/prompt-components.ts)
   - Includes: Forbidden patterns, voice rules, never_say words
   - Gap: No explicit "avoid archaic Danish" instruction

4. **Post-Processing** → Silent corrections after generation
   - File: [silent-correct.ts](supabase/functions/_shared/utils/silent-correct.ts)
   - Fixes: Dash removal, sentence fragments, etc.
   - Gap: No archaic phrase replacement rules

5. **Spelling Check** → Final validation layer
   - File: [spelling/index.ts](supabase/functions/spelling/index.ts)
   - Fixes: Grammar, compound words, etc.
   - Gap: No archaic phrase detection

---

## Why The Problems Persist

### "Hop forbi"
1. Brand profile generates CTA library with avoid_phrases
2. CTA selection filters brand CTAs against avoid_phrases
3. **If all filtered out** → Falls back to hardcoded list
4. **Hardcoded list contains "Hop forbi"** → Archaic phrase appears

### "går på hæld"
1. AI generates text following voice rules and forbidden patterns
2. **No explicit archaic phrase prevention** in prompts
3. Post-processing doesn't catch it (no rules)
4. Spelling check doesn't catch it (no rules)
5. **Result**: Archaic time expression appears in output

---

## Recommended Fixes

### ✅ IMPLEMENTED: Pre-Approved CTA Library

**Created**: [approved-danish-ctas.ts](supabase/functions/_shared/ctas/approved-danish-ctas.ts)

**What it does**:
- 20 pre-vetted booking CTAs ("Book bord i dag, og glæd dig til god mad" etc.)
- 20 pre-vetted walk-in CTAs ("Kig forbi, når sulten melder sig" etc.)
- All modern Danish - zero archaic phrases
- Helper functions: `getRandomApprovedCTA()`, `getRandomApprovedCTAs()`

**Files updated**:
1. [select-cta.ts](supabase/functions/generate-text-from-idea/select-cta.ts)
   - Imported approved CTA library
   - Replaced hardcoded `casualVisitCTAs` with approved walk-in CTAs
   - Replaced hardcoded `bookingFocusedCTAs` with approved booking CTAs
   - Updated `FREE_CTAS.da.visit` to use approved CTAs

2. [writing-examples.ts](supabase/functions/_shared/brand-profile/writing-examples.ts)
   - Imported approved CTA library
   - Replaced fallback `casual` CTAs with approved walk-in CTAs
   - Replaced fallback `booking` CTAs (soft/urgent) with filtered approved booking CTAs
   - Extended `avoid_phrases` list: Added "Hop forbi", "går på hæld", "stik indenfor"

3. [writing-examples 2.ts](supabase/functions/_shared/brand-profile/writing-examples 2.ts)
   - Same updates as writing-examples.ts (duplicate file kept in sync)

**Result**: "Hop forbi" completely removed from all CTA generation paths. AI can no longer inject archaic phrases via CTAs.

---

### Fix 1: Remove Archaic Phrases from Fallback CTAs ✅ DONE

~~**Files to update**:~~
- ~~[select-cta.ts:277](supabase/functions/generate-text-from-idea/select-cta.ts#L277)~~
- ~~[writing-examples.ts:823](supabase/functions/_shared/brand-profile/writing-examples.ts#L823)~~

~~Replace "Hop forbi" with modern alternatives:~~
- ~~"Kom forbi" (already in list)~~
- ~~"Besøg os"~~
- ~~"Vi glæder os til at se dig" (already in list)~~

**STATUS**: ✅ Implemented via pre-approved CTA library (superior solution)

### Fix 2: Add Archaic Phrase Category to Avoid Patterns

**File to update**: [guardrails.ts](supabase/functions/_shared/brand-profile/guardrails.ts)

Add new category in `avoid_patterns.strip_from_output`:
```typescript
archaic_danish: [
  'går på hæld',
  'hop forbi',
  'svip forbi',
  'stik indenfor',
  'snart på bedding',
  // ... other archaic phrases
]
```

### Fix 3: Add Archaic Detection to Spelling System

**File to update**: [spelling prompt](supabase/functions/_shared/prompts/languages/da/spelling-system.yaml) or hardcoded fallback

Add instruction:
```
Replace archaic Danish phrases:
- "går på hæld" → "snart slutter" or "går mod aften"
- "hop forbi" → "kom forbi"
- "svip forbi" → "kom forbi"
```

### Fix 4: Enhance Voice Prompt with Modern Language Requirement

**File to update**: [prompt-components.ts](supabase/functions/generate-text-from-idea/prompt-components.ts)

Add to voice guidance:
```typescript
- MODERNE DANSK: Undgå gammeldags vendinger som "går på hæld", "hop forbi", "svip forbi"
- NUTIDSSPROG: Brug almindeligt moderne dansk - ikke forældet eller højstemt sprog
```

---

## Priority Recommendation

**Immediate (high ROI)**:
1. Remove "Hop forbi" from hardcoded fallback CTAs → Fixes 50% of visible problem
2. Add archaic phrase detection to spelling system → Catches both issues

**Medium-term (structural fix)**:
3. Add `archaic_danish` category to avoid_patterns guardrails
4. Update voice prompts with explicit modern language requirement

**Long-term (systematic prevention)**:
5. Build comprehensive archaic phrase database
6. Add to brand profile generation prompts
7. Create validation layer specifically for language modernity
