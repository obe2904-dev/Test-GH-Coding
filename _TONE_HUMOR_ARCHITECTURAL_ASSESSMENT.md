# Tone & Humor Architectural Assessment

## Problem Statement

**humor_style** and **tone** are over-defined across multiple fields with broken wiring and active contradictions.

### Issue 1: humor_style Exists But Gets null

**Evidence:**
- `brand_profile_v5.voice.humor_style` exists in V5 schema (types-v5.ts line 193)
- `BusinessContext` does NOT include `humorLevel` (resolve-context.ts lines 55-97)
- `PromptOptions` expects `humorLevel` (types.ts line 82)
- `index.ts` tries to pass `humorLevel: biz.humorLevel` (line 187) → **always null/undefined**
- `buildPrompt` receives null and humor logic never executes (prompt-builders.ts line 608)

**Root cause:** `fetchBusinessContext` never reads `brand_profile_v5` column - it only reads flat legacy columns.

### Issue 2: Tone Contradiction (semi-formal vs casual)

**Four places defining tone:**
1. **`brand_profile_v5.voice.formality_level`** = `"semi-formal"` (V5 legacy field)
2. **`brand_profile_v5.voice.tone_dna.recommended_tone.formality`** = `"casual_enthusiast"` (V5.5 strategic DNA)
3. **`tone_of_voice` (flat column)** = `{primary_tone, attributes, formality_level}` (V2 legacy)
4. **`tone_model.writing_rules`** = array of rules (V5 flat column)

**Active contradiction:**
- UI shows "Formalitet: semi-formal" (reading from `brand_profile_v5.voice.formality_level`)
- But `tone_dna` says `"casual"` in strategic recommendation
- Text generation gets conflicting signals

**Current wiring:**
```typescript
// resolve-context.ts line 166
.select('tone_of_voice, tone_model, ...')  // ❌ Reads flat legacy columns
// Does NOT read brand_profile_v5 column at all!
```

### Issue 3: V5.5 tone_dna is Authoritative But Not Used

**`tone_dna` structure (types-v5.ts lines 130-180):**
```typescript
interface V5ToneDNA {
  recommended_tone: {
    formality: string;                  // "casual_friend", "elevated_casual", etc.
    humor_instruction: string;          // How to use humor
    emoji_frequency: string;            // Emoji guidance
  };
  location_driver: {...};               // Waterfront positioning strategy
  culinary_character: {...};            // Culinary tone (casual dining, etc.)
  owner_voice: {...};                   // Owner personality influence
  market_context: {...};                // Competitive positioning
  strategic_summary: string;            // 2-3 sentence synthesis
  tone_do_list: string[];               // 5-7 strategic guidelines
  tone_dont_list: string[];             // 3-5 warnings
}
```

**This is the authoritative source** - it synthesizes:
- Location strategy (waterfront, urban, etc.)
- Culinary positioning (casual dining, fine dining, etc.)
- Owner personality
- Market context
- Strategic tone recommendation with reasoning

**But:** Text generation never reads it. It reads flat `tone_of_voice.value` instead.

## Proposed Solution

### Deprecate Flat Fields, Read from brand_profile_v5 Only

**Fields to deprecate:**
1. ❌ `humor_level` (flat column) → Use `brand_profile_v5.voice.tone_dna.recommended_tone.humor_instruction`
2. ❌ `tone_of_voice` (flat column) → Use `brand_profile_v5.voice.tone_dna.tone_do_list`
3. ❌ `brand_profile_v5.voice.formality_level` (legacy V5 field) → Use `brand_profile_v5.voice.tone_dna.recommended_tone.formality`

**New wiring (resolve-context.ts):**
```typescript
// Read brand_profile_v5 JSONB column
const { data: brandProfile } = await supabase
  .from('business_brand_profile')
  .select('brand_profile_v5, booking_link, business_identity_persona, voice_guardrails')
  .eq('business_id', businessId)
  .single()

// Extract from V5.5 tone_dna (authoritative)
const toneDNA = brandProfile?.brand_profile_v5?.voice?.tone_dna
if (toneDNA) {
  humorLevel = toneDNA.recommended_tone?.humor_instruction || 'moderate'
  brandTone = toneDNA.strategic_summary  // 2-3 sentence synthesis
  brandWritingRules = toneDNA.tone_do_list || []
  // formality is embedded in recommended_tone.formality
}

// Fallback to legacy if tone_dna missing (backward compat)
if (!brandTone && brandProfile?.brand_profile_v5?.voice?.tone_rules) {
  brandWritingRules = brandProfile.brand_profile_v5.voice.tone_rules
}
```

**BusinessContext changes:**
```typescript
interface BusinessContext {
  // ... existing fields ...
  humorLevel: string                    // NEW: from tone_dna.recommended_tone.humor_instruction
  formalityLevel: string                // NEW: from tone_dna.recommended_tone.formality
  toneDNASummary: string                // NEW: tone_dna.strategic_summary (replaces brandTone)
  // DEPRECATED:
  // brandTone (replaced by toneDNASummary)
}
```

## Benefits

1. **Single source of truth:** `brand_profile_v5` contains all V5/V5.5 data
2. **No contradictions:** tone_dna is strategic synthesis, not competing with flat fields
3. **humor_style works:** Direct wire from V5 schema to prompt
4. **Cleaner architecture:** No legacy flat columns to maintain
5. **Richer context:** tone_dna includes location/culinary/owner/market strategy

## UI Impact

**Current UI (BrandProfilePageV5.tsx lines 661-679):**
```tsx
<div>Personlighed: {profile.brand_profile_v5.voice.personality_traits?.join(', ')}</div>
<div>Formalitet: {profile.brand_profile_v5.voice.formality_level}</div>
<div>Humor: {profile.brand_profile_v5.voice.humor_style}</div>
```

**Should read from tone_dna instead:**
```tsx
<div>Personlighed: {profile.brand_profile_v5.voice.personality_traits?.join(', ')}</div>
<div>Formalitet: {profile.brand_profile_v5.voice.tone_dna?.recommended_tone?.formality}</div>
<div>Humor: {profile.brand_profile_v5.voice.tone_dna?.recommended_tone?.humor_instruction}</div>
```

This ensures UI and text generation read from same source.

## Implementation Plan

### Phase 1: Wire brand_profile_v5 Reading
- [ ] Update `fetchBusinessContext` to SELECT `brand_profile_v5` column
- [ ] Extract `tone_dna` from JSONB
- [ ] Populate `humorLevel`, `toneDNASummary`, `formalityLevel` from tone_dna
- [ ] Add fallbacks to legacy fields for backward compatibility

### Phase 2: Update Prompt Building
- [ ] Use `tone_dna.tone_do_list` instead of `tone_model.writing_rules`
- [ ] Use `tone_dna.strategic_summary` for context block
- [ ] Use `tone_dna.recommended_tone.humor_instruction` for humor guidance

### Phase 3: Update UI
- [ ] Change `BrandProfilePageV5.tsx` to read from `tone_dna.recommended_tone`
- [ ] Ensure consistency between UI display and text generation input

### Phase 4: Deprecation
- [ ] Mark `tone_of_voice`, `tone_model`, flat `humor_level` as DEPRECATED
- [ ] Generator continues writing to these for backward compat
- [ ] Text generation reads only from `brand_profile_v5`

## Related Issues

This is architecturally similar to:
- **v5.1.5:** business_character deprecation (two fields storing same data)
- Both cases: legacy flat columns creating drift from V5 JSONB structure
- Solution pattern: Single source of truth in `brand_profile_v5`, backward compat in generator

## Files to Modify

1. `supabase/functions/generate-text-from-idea/resolve-context.ts` - Read brand_profile_v5
2. `supabase/functions/generate-text-from-idea/types.ts` - Add humorLevel, formalityLevel to BusinessContext
3. `supabase/functions/generate-text-from-idea/prompt-builders.ts` - Use tone_dna fields
4. `src/pages/dashboard/BrandProfilePageV5.tsx` - Display from tone_dna
5. `supabase/functions/generate-text-from-idea/index.ts` - Pass humorLevel from BusinessContext

## Verification

After implementation, verify:
- [ ] Café Faust humor_style flows from DB → BusinessContext → PromptOptions → buildPrompt
- [ ] tone_dna.strategic_summary appears in prompts
- [ ] No contradiction between formality_level and tone_dna.recommended_tone.formality
- [ ] UI displays match text generation inputs
