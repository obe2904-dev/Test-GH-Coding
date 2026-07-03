# Origin Mention Strategy & Wallpaper Avoidance

**Version**: V5.3  
**Date**: 24. maj 2026  
**Status**: ✅ Implemented

---

## Executive Summary

**Problem**: Menu description examples were creating "wallpaper effect" - formulaic patterns where every dish starts with nationality ("Italiensk lasagne", "Fransk vol au vent", "Belgisk moules frites"). Users tune out repetitive patterns.

**Solution**: Implemented intelligent origin mention strategy with enforced variation in `menu_description_examples`. System now:
1. Analyzes menu for existing origin mention patterns
2. Generates examples showing 3 different structures (origin-led, ingredient-led, technique-led)
3. Adds wallpaper avoidance rules to guardrails
4. Provides metadata explaining when to use origin mentions

---

## Implementation Details

### 1. Enhanced Prompt (v5-prompts.ts)

**File**: `supabase/functions/_shared/brand-profile/v5-prompts.ts`

**Changes Made**:
- Added **VARIATION FRAMEWORK** section with 3 explicit structures:
  - Example 1: EXPLICIT ORIGIN (nationality-led)
  - Example 2: INGREDIENT-LED (focus on main ingredients)
  - Example 3: IMPLICIT ORIGIN (dish name signals origin - skip redundancy)

- Added **ORIGIN MENTION STRATEGI** (decision logic):
  - ✅ BRUG origin framing IF: signature_themes mention international cuisine, dish is less known, authenticity is core value
  - ❌ SKIP origin framing IF: signature_themes are local/Danish focus, dish is universally known, dish name already signals origin

- Added **WALLPAPER AVOIDANCE RULES**:
  - ❌ FORBUDT: All 3 examples start with nationality (robotic pattern)
  - ✅ KRÆVET: 3 different openings, 3 different lengths, 3 different focus areas

**Example Output**:
```typescript
menu_description_examples: [
  // Origin-led (13 words)
  "Moules frites - belgisk klassiker med dampede blåmuslinger i hvidvin, serveret med sprøde pommes frites",
  
  // Ingredient-led (9 words)
  "Pariserbøf med 350 g dansk oksekød, rødbeder og kapers",
  
  // Technique-led (13 words)
  "Hjemmelavet lasagne - lag af pasta, kødsauce og cremet bechamel, gratineret med ost"
]
```

### 2. Type Definitions (types-v5.ts)

**File**: `supabase/functions/_shared/brand-profile/types-v5.ts`

**New Fields Added**:

```typescript
export interface V5Voice {
  // ... existing fields ...
  
  menu_description_metadata?: {         // NEW (v5.3): Origin mention strategy guidance
    origin_mention_frequency?: 'never' | 'selective' | 'frequent' | 'always';
    origin_mention_reasoning?: string;  // Why this frequency (based on menu analysis)
    variation_enforced?: boolean;       // Whether examples show varied structures
    detected_origin_keywords?: string[]; // Origins found in menu ["fransk", "italiensk"]
  };
}

export interface V5Guardrails {
  // ... existing fields ...
  
  avoid_patterns?: {
    // ... existing patterns ...
    formulaic_wallpaper?: string[];     // NEW (v5.3): Wallpaper avoidance rules
  };
  
  wallpaper_avoidance?: {               // NEW (v5.3): Structured wallpaper rules
    max_origin_mentions_percentage?: number;  // e.g., 30 = max 30% of descriptions
    required_variation_patterns?: string[];   // What variation is required
    forbidden_repetitions?: string[];         // What repetitions are forbidden
  };
}
```

### 3. Menu Origin Analysis (voice-profile.ts)

**File**: `supabase/functions/_shared/brand-profile/voice-profile.ts`

**New Function**:

```typescript
export function analyzeMenuOriginStrategy(
  menuItems?: Array<{ name?: string; description?: string }>,
  signatureThemes?: string[]
): {
  frequency: 'never' | 'selective' | 'frequent' | 'always';
  reasoning: string;
  detected_keywords: string[];
}
```

**How It Works**:
1. Scans menu items for origin keywords (belgisk, fransk, italiensk, etc.)
2. Calculates percentage of items mentioning origins
3. Checks signature_themes for international/fusion indicators
4. Returns frequency recommendation:
   - **never** (0% + no international theme)
   - **selective** (<30% or <15% with no international theme)
   - **frequent** (30-70% or with international theme)
   - **always** (>70%)

**Integration**:
- Called automatically during `generateVoiceProfile()`
- Results stored in `voice.menu_description_metadata`
- Used to inform AI prompt about origin mention strategy

### 4. Guardrails Enhancement (guardrails.ts)

**File**: `supabase/functions/_shared/brand-profile/guardrails.ts`

**Changes Made**:

1. **Added formulaic_wallpaper patterns**:
```typescript
patterns.formulaic_wallpaper = [
  'Ikke start hver ret med nationality (Italiensk..., Fransk..., Spansk...)',
  'Variér mellem ingrediens/tilberedning/oprindelse som åbning',
  'Undgå "klassisk [nationality]" i mere end 30% af beskrivelser',
  'Brug ikke samme sætningsstruktur i alle beskrivelser',
  'Maksimalt 1 af 3 menu-beskrivelser må nævne dish origin',
  'Variation i længde: nogle korte (5-8 ord), nogle medium (9-12 ord), nogle lange (13+ ord)'
]
```

2. **Added wallpaper_avoidance structured rules**:
```typescript
guardrails.wallpaper_avoidance = {
  max_origin_mentions_percentage: 30,
  required_variation_patterns: [
    'Variér mellem ingrediens-led, tilberednings-led og origin-led åbninger',
    'Brug forskellige sætningslængder (kort/medium/lang)',
    'Skift fokusområde: origin → ingredienser → tekstur/tilberedning'
  ],
  forbidden_repetitions: [
    'Ikke brug "klassisk [nationality]" i 2+ beskrivelser',
    'Ikke start alle beskrivelser med samme mønster',
    'Undgå repetition af samme adjektiver på tværs af retter'
  ]
}
```

---

## Usage Examples

### Example 1: International Fusion Café

**Menu Analysis**:
- 45% of menu items mention origin ("italiensk pasta", "fransk brød", "belgisk øl")
- Signature themes: ["Dansk og International Fusion", "Autentisk Håndværk"]

**Output**:
```typescript
{
  menu_description_metadata: {
    origin_mention_frequency: "frequent",
    origin_mention_reasoning: "Menu nævner origins regelmæssigt (45% af 120 retter) og signature themes inkluderer international cuisine. Origin framing er del af brandidentiteten.",
    variation_enforced: true,
    detected_origin_keywords: ["italiensk", "fransk", "belgisk", "dansk", "hjemmelavet"]
  },
  
  menu_description_examples: [
    "Moules frites - belgisk klassiker med dampede blåmuslinger i hvidvin og pommes frites",
    "Pariserbøf med 350 g dansk oksekød, rødbeder og kapers",
    "Croque madame - ristet sandwich med skinke, ost og spejlæg"
  ]
}
```

**Rationale**: With international theme, 1 of 3 examples uses origin framing, but NOT all 3.

### Example 2: Local Danish Café

**Menu Analysis**:
- 8% of menu items mention origin (only "dansk rugbrød", "lokale råvarer")
- Signature themes: ["Hjemmelavet Kvalitet", "Danske Klassikere"]

**Output**:
```typescript
{
  menu_description_metadata: {
    origin_mention_frequency: "never",
    origin_mention_reasoning: "Menu nævner ikke cuisine origins (8% af 65 retter). Fokuser på ingredienser og tilberedning i stedet.",
    variation_enforced: true,
    detected_origin_keywords: ["dansk", "hjemmelavet", "lokale"]
  },
  
  menu_description_examples: [
    "Smørrebrød med rullepølse, sky og rødbeder",
    "Hjemmelavet kanelsnegl med smør og kanel",
    "Rugbrød med æggesalat og radiser"
  ]
}
```

**Rationale**: No international theme, so examples focus on ingredients/preparation, not origins.

### Example 3: High-End Italian Restaurant

**Menu Analysis**:
- 75% of menu items mention "italiensk" or specific regions ("Toscana", "Puglia")
- Signature themes: ["Autentisk Italiensk Tradition", "Regionale Specialiteter"]

**Output**:
```typescript
{
  menu_description_metadata: {
    origin_mention_frequency: "always",
    origin_mention_reasoning: "Menu bruger origin mentions konsekvent (75% af 50 retter). Autenticitet og provenance er central for brandet.",
    variation_enforced: true,
    detected_origin_keywords: ["italiensk", "toscana", "puglia", "autentisk", "tradition"]
  },
  
  menu_description_examples: [
    "Burrata - cremet mozzarella fra Puglia med tomater og basilikum",
    "Pappardelle med vildsvine-ragù, langtidsstegt i rødvin",
    "Tiramisu - klassisk dessert med mascarpone, kaffe og amaretto"
  ]
}
```

**Rationale**: Authenticity is central, but still shows variation (region mention → technique → classic reference).

---

## Decision Tree: When to Mention Origin

```
┌─────────────────────────────────────┐
│ Should this dish mention origin?   │
└──────────────┬──────────────────────┘
               │
               ▼
     ┌─────────────────────┐
     │ Is dish name itself │ YES → Skip origin mention
     │ already national?   │       (e.g., "Croque Madame" = French)
     │ (croque, falafel,   │       Focus on: ingredients, texture
     │  bibimbap, etc.)    │
     └─────────┬───────────┘
               │ NO
               ▼
     ┌─────────────────────┐
     │ Does brand profile  │ NO  → Skip origin mention
     │ emphasize           │       Focus on: local, homemade, Danish
     │ international/      │
     │ fusion cuisine?     │
     └─────────┬───────────┘
               │ YES
               ▼
     ┌─────────────────────┐
     │ Is this dish well-  │ YES → Skip origin mention
     │ known in Denmark?   │       (e.g., lasagne, pizza, burger)
     │                     │       Focus on: quality, preparation
     └─────────┬───────────┘
               │ NO
               ▼
     ┌─────────────────────┐
     │ Have you already    │ YES → Skip origin mention
     │ used origin framing │       (avoid wallpaper - max 30%)
     │ in 30%+ of today's  │
     │ descriptions?       │
     └─────────┬───────────┘
               │ NO
               ▼
         ✅ USE ORIGIN MENTION
         (e.g., "belgisk ret", "fransk klassiker")
```

---

## AI Mode Integration

### Where This is Used

1. **Brand Profile Generation** (`brand-profile-generator-v5`)
   - `generateVoiceProfile()` calls `analyzeMenuOriginStrategy()`
   - Results stored in `brand_profile_v5.voice.menu_description_metadata`

2. **Dagens Forslag** (`get-quick-suggestions`)
   - Could read `menu_description_metadata.origin_mention_frequency` to inform suggestions
   - (Not yet integrated - Priority 2 enhancement)

3. **Caption Generation** (`generate-text-from-idea`)
   - Could use `guardrails.wallpaper_avoidance` rules in validation
   - (Not yet integrated - Priority 2 enhancement)

### Future Integration Points

**Priority 1** (High Impact):
- Add `menu_description_metadata` to `generate-text-from-idea` prompt context
- Use origin frequency to modulate AI behavior ("selective" → less origin framing)

**Priority 2** (Medium Impact):
- Validation layer: Check generated text against `wallpaper_avoidance.max_origin_mentions_percentage`
- Reject captions that violate variation requirements

**Priority 3** (Low Impact):
- Weekly content calendar: Track origin mention frequency across week
- Alert if >30% of week's captions use origin framing

---

## Testing & Validation

### How to Test

1. **Check Café Faust Examples**:
```sql
SELECT 
  jsonb_pretty(brand_profile_v5->'voice'->'menu_description_examples') as examples,
  jsonb_pretty(brand_profile_v5->'voice'->'menu_description_metadata') as metadata
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
```

**Expected**: 2-3 examples with DIFFERENT structures (not all starting with nationality)

2. **Check Guardrails**:
```sql
SELECT 
  jsonb_pretty(brand_profile_v5->'guardrails'->'avoid_patterns'->'formulaic_wallpaper') as wallpaper_rules,
  jsonb_pretty(brand_profile_v5->'guardrails'->'wallpaper_avoidance') as wallpaper_avoidance
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
```

**Expected**: 6 formulaic_wallpaper rules + structured wallpaper_avoidance object

3. **Regenerate Brand Profile**:
```typescript
// Trigger brand profile regeneration for test business
// Check that menu_description_examples show variation
```

### Quality Checks

✅ **PASS Criteria**:
- [ ] Examples use 3 different opening structures
- [ ] Maximum 1 of 3 examples mentions origin
- [ ] No two examples start with same word/pattern
- [ ] Different sentence lengths (short/medium/long)
- [ ] `menu_description_metadata.variation_enforced = true`
- [ ] `guardrails.wallpaper_avoidance.max_origin_mentions_percentage = 30`

❌ **FAIL Criteria**:
- All 3 examples start with "Italiensk...", "Fransk...", "Belgisk..."
- All 3 examples use same sætningsstruktur
- 2+ examples use "klassisk [nationality]"
- No variation in sentence length

---

## Migration Guide

### Existing Businesses

**No Migration Required**: This is additive V5.3 enhancement.

Existing `menu_description_examples` will remain unchanged until brand profile is regenerated. When regenerated:
- Old examples (if formulaic) will be replaced with varied examples
- New metadata fields will be populated
- Guardrails will include wallpaper avoidance rules

### Manual Override

If a business wants specific examples that violate variation rules:
1. Manually edit `brand_profile_v5.voice.menu_description_examples`
2. Set `menu_description_metadata.variation_enforced = false`
3. System will not enforce variation for this business

---

## Performance Impact

**Computational Cost**: Minimal
- `analyzeMenuOriginStrategy()` is simple string matching (no AI calls)
- Runs once during brand profile generation
- Adds ~5ms to generation time

**AI Token Cost**: Zero
- No additional AI calls
- Prompt is longer but within existing budget
- Guardrails generation already uses AI

**Database Impact**: Minimal
- New JSONB fields in existing structure
- No schema migration required
- Backward compatible

---

## Related Documentation

- **Prompt Library**: `v5-prompts.ts` (lines 387-523)
- **Type Definitions**: `types-v5.ts` (lines 100-140)
- **Voice Generation**: `voice-profile.ts` (lines 17-125)
- **Guardrails**: `guardrails.ts` (lines 520-590)
- **Gap Analysis**: `AI-MODE-BRAND-PROFILE-V5-GAP-ANALYSIS.md`

---

## Version History

**V5.3** (24. maj 2026)
- ✅ Added origin mention strategy analysis
- ✅ Enhanced prompt with variation framework
- ✅ Added wallpaper avoidance to guardrails
- ✅ Added menu_description_metadata to types

**V5.2** (20. maj 2026)
- ✅ Added menu_description_examples to voice profile

**V5.1** (9. maj 2026)
- ✅ Added structured avoid_patterns to guardrails

**V5.0** (Initial release)
- ✅ Core brand profile V5 structure

---

## Contact & Support

**Questions**: Review this document + related code files  
**Issues**: Check guardrails output in database  
**Enhancements**: Propose in team discussion

---

## Appendix: Real-World Example

### Before V5.3 (Wallpaper Pattern)

```typescript
menu_description_examples: [
  "Italiensk lasagne med lag af pasta og kødsauce",
  "Fransk vol au vent med kylling og champignon",
  "Belgisk moules frites med muslinger og pommes frites"
]
```

**Problem**: All start with nationality. Robotic. Wallpaper effect.

### After V5.3 (Variation Pattern)

```typescript
menu_description_examples: [
  "Moules frites - belgisk klassiker med dampede blåmuslinger i hvidvin og pommes frites",
  "Pariserbøf med 350 g dansk oksekød, rødbeder og kapers",
  "Hjemmelavet lasagne - lag af pasta, kødsauce og cremet bechamel, gratineret med ost"
]

menu_description_metadata: {
  origin_mention_frequency: "selective",
  origin_mention_reasoning: "Menu bruger origin mentions sparsomt (22% af 195 retter). Brug kun når det tilføjer autenticitetsværdi.",
  variation_enforced: true,
  detected_origin_keywords: ["belgisk", "dansk", "italiensk", "fransk", "hjemmelavet"]
}
```

**Solution**: 
- Example 1: Origin-led with full description
- Example 2: Ingredient-led (no origin needed for pariserbøf)
- Example 3: Technique-led (lasagne is universally known)
- Variation in structure, length, and focus
- Strategic use of origin (1 of 3, not 3 of 3)
