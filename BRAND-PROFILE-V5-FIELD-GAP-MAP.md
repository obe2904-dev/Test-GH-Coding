# Brand Profile V5 Field Gap Map

**Scope**: Cafe Faust / `brand-profile-generator-v5`

This note maps the legacy flat fields shown in the sample row to the current V5 generator behavior.

## Short Answer

The V5 prompt does **not** populate the legacy flat columns directly. The generator now writes:

- `brand_profile_v5` JSONB
- `business_identity_persona`
- `strategic_audience_segments`
- `voice_guardrails`
- flattened enhanced examples for voice validation

Any legacy column that is still `null` in the sample row is either:

1. not written by the V5 generator,
2. replaced by a V5 JSONB path, or
3. intentionally kept for backward compatibility only.

## Fields Not Populated By This Prompt

These legacy columns are not written by `brand-profile-generator-v5` in the current save path:

| Field | Status | Notes |
|---|---|---|
| `tone_keywords` | Not populated | No V5 write target |
| `voice_style` | Not populated | Replaced by V5 voice structure |
| `values` | Not populated | Not written by V5 generator |
| `certifications` | Not populated | Not written by V5 generator |
| `do_not_say` | Not populated | Replaced by `voice_guardrails` / V5 voice controls |
| `cta_preference` | Not populated | No V5 write target |
| `business_model_type` | Not populated | Replaced by runtime audience / programme logic |
| `primary_copy_hook` | Not populated | Replaced by V5 audience and identity signals |
| `audience_breadth` | Not populated | Not written by V5 generator |
| `classification_rationale` | Not populated | Not written by V5 generator |
| `brand_essence_elaboration` | Not populated | No V5 write target |
| `core_offerings` | Not populated | No V5 write target |
| `content_focus` | Not populated | No V5 write target |
| `communication_goal` | Not populated | No V5 write target |
| `target_audience` | Not populated | Replaced by `strategic_audience_segments` |
| `content_pillars` | Not populated | No V5 write target |
| `things_to_avoid` | Not populated | Replaced by `voice_guardrails` |
| `image_preferences` | Not populated | No V5 write target |
| `identity_keywords` | Not populated | No V5 write target |
| `voice_constraints` | Not populated | Replaced by V5 voice / guardrails |
| `voice_rationale` | Not populated | Replaced by `voice_profile.voice_reasoning` inside JSONB |
| `audience_framework` | Not populated | Replaced by `strategic_audience_segments` |
| `voice_system` | Not populated | Replaced by `brand_profile_v5.voice` |
| `content_strategy` | Not populated | No V5 write target |
| `posting_occasions` | Not populated | No V5 write target |
| `posting_occasions_hash` | Not populated | No V5 write target |
| `things_to_avoid_jsonb` | Not populated | Replaced by `voice_guardrails` |
| `image_preferences_jsonb` | Not populated | No V5 write target |
| `core_offerings_jsonb` | Not populated | No V5 write target |
| `social_style` | Not populated | Replaced by V5 voice fields |
| `voice_examples` | Not populated | Replaced by `social_writing_examples` and `enhanced_social_examples` |
| `tone_model` | Not populated | Legacy structure not written by current V5 save path |
| `quality_status` | Not populated | No V5 write target |
| `generation_errors` | Not populated | Only surfaced as function errors, not saved as a field |
| `version_hash` | Not populated | Not written by V5 generator |
| `typical_openings` | Not populated at top level | Present only inside `brand_profile_v5.writing_examples`, not as the old flat column |
| `location_intelligence` | Not populated | Moved into `brand_profile_v5.layer_0_intelligence.geographic_context` |

## Migrated Or Replaced Fields

These are not lost; they moved into the V5 structure or into companion fields:

| Legacy field | New home | Notes |
|---|---|---|
| `voice_examples` | `brand_profile_v5.voice.social_writing_examples`, `brand_profile_v5.voice.enhanced_social_examples` | Legacy example store replaced by V5 voice examples |
| `tone_model` | `brand_profile_v5.voice` | The V5 voice object carries the structured replacement |
| `voice_constraints` | `brand_profile_v5.guardrails` and V5 voice metadata | Split across structured guardrails and voice rules |
| `do_not_say` / `things_to_avoid` | `brand_profile_v5.guardrails` | Guardrails are now structured |
| `target_audience` / `audience_framework` / `audience_breadth` | `strategic_audience_segments` and `brand_profile_v5.layer_1_programmes[].audienceSegments` | Audience is programme-aware now |
| `location_intelligence` | `brand_profile_v5.layer_0_intelligence.geographic_context` | Location context is nested in Layer 0 |
| `business_character` | `business_identity_persona` and `brand_profile_v5.layer_0_intelligence.business_identity.system_persona` | Kept for compatibility, but V5 persona is the primary source |

## What The Current V5 Generator Actually Saves

The current `brand-profile-generator-v5` save block writes these V5-oriented fields:

- `brand_profile_v5`
- `brand_profile_v5_generated_at`
- `brand_profile_v5_version`
- `enhanced_social_examples`
- `enhanced_avoid_examples`
- `social_writing_examples`
- `voice_guardrails`
- `business_identity_persona`
- `strategic_audience_segments`
- `business_character` for backward compatibility

## Practical Interpretation

If you are checking the row you pasted, the fields listed in the first table are not being populated by the current prompt because they are no longer the active write targets. The real output lives inside `brand_profile_v5` and the compatibility columns above.

## Relevant Source Files

- `supabase/functions/brand-profile-generator-v5/index.ts`
- `supabase/functions/_shared/brand-profile/types-v5.ts`
- `supabase/functions/_shared/brand-profile/business-identity-persona.ts`
- `supabase/functions/_shared/brand-profile/voice-profile.ts`

---

## Location Reference Bug Analysis — "ved åen" vs "ved vandet"

**Trigger**: Test business has `business_location_intelligence.local_location_reference = "ved åen"`, but AI-generated copy prefers "ved vandet", which pulls in sea/wave imagery ("bølger", "solens genskind i vandet") that is wrong for a riverside café.

This is a multi-layer chain failure spanning both edge functions.

---

### The authoritative source field

`business_location_intelligence.local_location_reference` is the single source of truth for what a business calls its location in its own words. It is set manually by the operator or derived from Om Os text. For Café Faust the value is `"ved åen"`.

A second copy of the field also exists on the `businesses` table. In `brand-profile-generator-v5/index.ts` the generator always resolves it as:

```
business.local_location_reference || location?.local_location_reference
```

where `location` is the `business_location_intelligence` row. So the generator correctly prefers the `businesses` copy and falls back to `business_location_intelligence`. Both columns are currently in sync for Café Faust.

---

### Layer-by-layer breakdown

#### Layer 1 — `geographic-context.ts` → `inferLocationType()`

"ved åen" and "ved vandet" are matched by the same regex branch and collapsed into one type:

```
/ved åen|ved havnen|ved vandet|ved stranden|ved søen/  →  waterfront_leisure
```

Both variants receive identical `tone_implications`:
> "Fremhæv location kraftigt - det er jeres USP. Casual leisure tone, nævn udendørs servering hvis relevant, sæson/vejr relevant."

No sub-typing distinguishes a **river setting** ("ved åen": rolig strøm, naturlyd, fugle) from an **open-water setting** ("ved vandet"/"ved stranden": bølger, havudsigt, maritimt). This is where semantic contamination begins.

---

#### Layer 2 — `brand-profile-generator-v5/index.ts` → `generateToneDNA()` call

`brand-profile-generator-v5` fetches `business_location_intelligence` using `select('*')` (line 534), so `location.local_location_reference` **is** present in the `location` variable. However it is **not forwarded** to `generateToneDNA()`:

```typescript
location_intelligence: location ? {
  category_scores: locationScores,
  neighborhood_character: location.neighborhood_character,
  area_type: location.area_type,
  location_marketing_hooks: location.location_marketing_hooks
  // ← local_location_reference is never passed here
} : undefined,
```

The `ToneDNAInput` interface has no `local_location_reference` field in its `location_intelligence` block, so the value is structurally excluded.

---

#### Layer 3 — `data-gatherer.ts` SELECT gap

The shared data-gatherer used by the brand-profile pipeline queries `business_location_intelligence` with an explicit named column list:

```typescript
supabase.from('business_location_intelligence')
  .select('neighborhood, area_type, category_scores, location_marketing_hooks, concept_fit_by_category')
```

`local_location_reference` is not in this list. Any code path that goes through `data-gatherer.ts` instead of the direct `select('*')` in the main generator will silently lose the field.

---

#### Layer 4 — `fetch-v5-profile.ts` — explicit TODO

The shared V5 profile fetcher has this comment at line 56:

```typescript
// Note: local_location_reference will be fetched from business_location_intelligence when needed
…
local_location_reference: undefined  // TODO: Fetch from business_location_intelligence
```

This is an acknowledged but unresolved gap that affects every consumer of `fetchV5IdentityProfile()`.

---

#### Layer 5 — `v5-prompts.ts` → tone DNA prompt

The prompt template for `V5_TONE_DNA_STRATEGIC_PROMPTS` shows an example JSON with `"natural_vocabulary": ["ved åen", "udsigt", "udeservering"]`. This is a **template illustration**, not a constraint. The `{location_intelligence}` placeholder in the PLACERING section is never actually replaced in `buildToneDNAPrompt()` — the actual location data is appended as raw JSON below the main prompt body, with no instruction to treat `local_location_reference` as non-negotiable.

Without that anchor the AI generating `natural_vocabulary` may output "ved vandet", "åen", "havnefronten" — all semantically valid for `area_type: "waterfront"`, `category_scores: { waterfront: 95 }` — but factually wrong for this business.

---

#### Layer 6 — `generate-text-from-idea/resolve-context.ts` — field never fetched

`fetchBusinessContext()` only queries:

```typescript
supabase.from('business_locations').select('city, country')
```

`business_location_intelligence` is **not queried at all** in this function. As a result, `local_location_reference` never enters the text-generation path. The return object is missing these fields that `index.ts` expects:

| Field `index.ts` passes to `buildPrompt()` | Status in `fetchBusinessContext()` return |
|---|---|
| `biz.localLocationReference` | Not fetched → `undefined` |
| `biz.locationText` | Not computed → `undefined` |
| `biz.locationIntelligenceMotivations` | Not fetched → `undefined` |
| `biz.touristContext` | Not fetched → `undefined` |
| `biz.venueCharacter` | Not fetched → `undefined` |
| `biz.venueScene` | Not fetched → `undefined` |
| `biz.effectiveVertical` | Not computed → `undefined` |
| `biz.targetAudience` | Not fetched → `undefined` |
| `biz.kitchenCloseTime` / `biz.todayCloseTime` | Not fetched → `undefined` |

The `resolveContentContext()` call in `index.ts` also passes `biz.touristContext` and `biz.localLocationReference` as extra positional arguments, but the function signature only accepts 5 parameters — they are silently ignored.

---

#### Layer 7 — `prompt-builders.ts` → location block injection

`locationVocabulary` (populated from `tone_dna.location_driver.natural_vocabulary`) is injected as the authoritative location anchor:

```
📍 FAKTISKE LOKATIONSREFERENCER — dokumenterede stedsbeskrivelser for DENNE virksomhed:
  • [whatever tone_dna generated]
Når du refererer til lokation: brug PRÆCIST disse termer (ikke generiske alternativer).
```

If tone DNA was generated with "ved vandet" in `natural_vocabulary` (Layers 2–5 above), that wrong term is now **enforced** with an explicit hard instruction.

The same prompt also explicitly discards the correct phrase appearing in `brandGoodExamples`:
> "Konkrete omgivelser, lokaliteter og rekvisitter i disse eksempler (fx "ved åen", "udsigt", "vandet") tilhører EKSEMPLETS scene — de er IKKE facts om dette opslag"

So the correct phrase is discarded and the wrong phrase is locked in.

---

### Summary gap table

| Layer | File | Gap |
|---|---|---|
| Type inference | `_shared/brand-profile/geographic-context.ts` | `inferLocationType()` collapses "ved åen" and "ved vandet" into one type with identical guidance — no river vs. open-water distinction |
| ToneDNA input type | `_shared/brand-profile/tone-dna-generator.ts` | `ToneDNAInput.location_intelligence` has no `local_location_reference` field |
| ToneDNA call | `brand-profile-generator-v5/index.ts` | `generateToneDNA()` omits `local_location_reference` from the `location_intelligence` argument even though `location.local_location_reference` is available |
| Shared data query | `_shared/brand-profile/data-gatherer.ts` | Named SELECT omits `local_location_reference` from `business_location_intelligence` |
| Shared profile fetch | `_shared/data-fetchers/fetch-v5-profile.ts` | Acknowledged TODO — `local_location_reference` always set to `undefined` |
| Prompt template | `_shared/brand-profile/v5-prompts.ts` | `{location_intelligence}` placeholder not replaced in `buildToneDNAPrompt()`; `local_location_reference` not treated as a non-negotiable constraint |
| Context fetch | `generate-text-from-idea/resolve-context.ts` | `business_location_intelligence` not queried at all; `local_location_reference` never enters the text-generation path |
| Prompt injection | `generate-text-from-idea/prompt-builders.ts` | `locationVocabulary` is enforced verbatim — if tone DNA contains wrong terms, those are locked in; correct phrase in examples is explicitly discarded |

---

### Required fixes (what, not how)

1. **`ToneDNAInput`** (`tone-dna-generator.ts`): add `local_location_reference?: string` to the `location_intelligence` block.

2. **`generateToneDNA()` call** (`brand-profile-generator-v5/index.ts`): pass `local_location_reference: location?.local_location_reference` into the `location_intelligence` argument.

3. **`buildToneDNAPrompt()`** (`tone-dna-generator.ts`): when `local_location_reference` is present, add a hard constraint to the prompt — the value must appear verbatim as the **first** entry in `natural_vocabulary` and must not be paraphrased or replaced.

4. **`data-gatherer.ts`**: add `local_location_reference` to the named SELECT from `business_location_intelligence`.

5. **`fetch-v5-profile.ts`**: resolve the TODO — fetch `local_location_reference` from `business_location_intelligence` and populate the field.

6. **`generate-text-from-idea/resolve-context.ts`**:
   - Add a query to `business_location_intelligence` (or extend the existing `business_locations` query) to fetch `local_location_reference`.
   - Add `localLocationReference`, `locationText`, `locationIntelligenceMotivations`, `touristContext`, `venueCharacter`, `venueScene`, `effectiveVertical`, `targetAudience`, `kitchenCloseTime`, `todayCloseTime` to the `BusinessContext` interface and the return object.
   - When `localLocationReference` is available, prepend it as the **first** entry in `locationVocabulary`, overriding whatever tone DNA generated.

7. **`geographic-context.ts`**: split `waterfront_leisure` into sub-types — at minimum `river_waterfront` ("ved åen", "ved bækken", "langs åen") and `open_water_waterfront` ("ved vandet", "ved havet", "ved stranden", "ved søen") — with separate `tone_implications` that reflect the correct imagery for each. This prevents river references from ever producing sea/wave vocabulary.

---

### Updated relevant source files

**Generator (`brand-profile-generator-v5`)**
- `supabase/functions/brand-profile-generator-v5/index.ts`
- `supabase/functions/_shared/brand-profile/geographic-context.ts`
- `supabase/functions/_shared/brand-profile/tone-dna-generator.ts`
- `supabase/functions/_shared/brand-profile/v5-prompts.ts`
- `supabase/functions/_shared/brand-profile/types-v5.ts`
- `supabase/functions/_shared/brand-profile/location-intelligence.ts`
- `supabase/functions/_shared/brand-profile/data-gatherer.ts`
- `supabase/functions/_shared/data-fetchers/fetch-v5-profile.ts`
- `supabase/functions/_shared/brand-profile/business-identity-persona.ts`
- `supabase/functions/_shared/brand-profile/voice-profile.ts`

**Consumer (`generate-text-from-idea`)**
- `supabase/functions/generate-text-from-idea/index.ts`
- `supabase/functions/generate-text-from-idea/resolve-context.ts`
- `supabase/functions/generate-text-from-idea/prompt-builders.ts`
- `supabase/functions/generate-text-from-idea/types.ts`
- `supabase/functions/generate-text-from-idea/prompt-components.ts`
