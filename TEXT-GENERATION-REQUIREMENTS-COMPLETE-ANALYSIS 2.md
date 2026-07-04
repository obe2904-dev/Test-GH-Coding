# Complete Text Generation Requirements Analysis
**Pipeline**: Phase 1 (Strategy) → Phase 2 (Plan) → Phase 3 (Text Generation)  
**Date**: May 10, 2026  
**Purpose**: Identify all requirements for AI text generation and map to V5 Brand Profile

---

## Part 1: What Information Is Needed for AI Text Generation?

### A. TEXT QUALITY PARAMETERS

#### **1. Text Length**

**Required**: Character count target (varies by content type)

| **Content Type** | **Length Target** | **Reason** |
|---|---|---|
| Menu posts | 300-450 characters | Needs space for dish description + sensory detail + CTA |
| Atmosphere/Behind scenes | 180-300 characters | Shorter due to 7-word first-line constraint + 3-line max |

**Where controlled**:
- **Code location**: [prompt-builders.ts lines 560-565](supabase/functions/generate-text-from-idea/prompt-builders.ts#L560-L565)
- **Prompt injection**: `KRAV 1) Længde: ${lengthKrav}`
- **Not stored in database** - hardcoded logic based on content type

---

#### **2. Humor Level**

**Required**: Tone register (none/subtle/moderate/high)

**Options**:
- `none` / `serious` → "INGEN humor — hold en oprigtig og seriøs tone"
- `subtle` / `dry` / `low` → "let selvironisk eller tør — kun hvis det opstår naturligt"
- `high` / `playful` → "legesyg tone — lette jokes og ordspil er velkomne"
- `moderate` → (default, no explicit instruction)

**Where controlled**:
- **Legacy column**: `business_brand_profile.humor_level` (text)
- **V5 JSONB**: `brand_profile_v5.voice.humor_style` (enum: 'dry' | 'playful' | 'professional' | 'none')
- **Code location**: [prompt-builders.ts lines 246-254](supabase/functions/generate-text-from-idea/prompt-builders.ts#L246-L254)
- **Prompt injection**: Conditional line in BRANDSTEMME block when not 'moderate'

**⚠️ MAPPING GAP**: V5 uses `humor_style`, legacy uses `humor_level` - need consistent enum values

---

#### **3. Tone (Casual/Formal/Neutral)**

**Required**: Voice formality + personality traits

**Parameters**:
- **Formality level**: informal | semi-formal | formal
- **Tone rules**: 3-7 actionable voice rules (how to write)
- **Personality traits**: 3-5 adjectives (kortfattet, direkte, venlig, etc.)
- **Sentence structure**: short_declarative | conversational | formal | varied

**Where controlled**:
- **Legacy columns**:
  - `tone_of_voice.value` (JSONB) - 5 writing rules as plain text
  - `tone_of_voice.formality_level` (v2 fallback)
  - `tone_model.writing_rules[]` (JSONB array)
- **V5 JSONB**:
  - `brand_profile_v5.voice.tone_rules[]` (5-7 rules)
  - `brand_profile_v5.voice.formality_level`
  - `brand_profile_v5.voice.personality_traits[]`
  - `brand_profile_v5.voice.sentence_structure`
- **Code location**: [resolve-context.ts lines 370-395](supabase/functions/generate-text-from-idea/resolve-context.ts#L370-L395)
- **Prompt injection**: Core of BRANDSTEMME block

**✅ GOOD**: V5 structure is richer (personality_traits, sentence_structure) - upgrade path clear

---

#### **4. Emoji Rules**

**Required**: Emoji frequency instruction

**Options**:
- `none` → "Brug INGEN emojis"
- `minimal` / `low` → "0-1 emoji maksimum"
- `moderate` → "1-2 emojis naturligt placeret" (default)
- `frequent` / `high` → "2-3 emojis naturligt placeret"

**Special rule**: ☕ ONLY if coffee/espresso/latte explicitly mentioned as drink in text

**Where controlled**:
- **Legacy columns**:
  - `tone_model.emoji_level` (preferred)
  - `tone_of_voice.emoji_frequency` (v2 fallback)
- **V5 JSONB**: ❌ **MISSING** - no `voice.emoji_level` field
- **Code location**: [resolve-context.ts lines 420-433](supabase/functions/generate-text-from-idea/resolve-context.ts#L420-L433)
- **Prompt injection**: `KRAV 3) ${emojiInstruction}`

**🚨 CRITICAL GAP**: Emoji level not in V5BrandProfile - must add `voice.emoji_level`

---

#### **5. Content Anchors**

**Required**: Factual boundaries (what the business actually offers)

**Purpose**: Prevents AI hallucination of non-existent dishes/services

**Examples**: ["Brunch", "Frokost", "Aftensmad", "Cocktails", "À la carte"]

**Where controlled**:
- **Legacy column**: `tone_model.content_anchors[]` (JSONB array)
- **V5 JSONB**: ❌ **MISSING** - no `voice.content_anchors` field
- **Code location**: [resolve-context.ts line 421](supabase/functions/generate-text-from-idea/resolve-context.ts#L421)
- **Prompt injection**: `Konceptankre (hvad dette sted faktisk tilbyder): ${contentAnchors.join(', ')}`

**🚨 CRITICAL GAP**: Content anchors not in V5 - must add to `voice.content_anchors[]`

---

#### **6. Voice Examples**

**Required**: Few-shot voice calibration

**Types**:
1. **Good examples** - Full caption examples showing desired voice
2. **Avoid examples** - Anti-patterns (wrong register)
3. **Typical openings** - Example opening sentences (rhythm/register)
4. **Typical closings** - Example CTAs (brand-specific phrases)
5. **Do-say examples** - Curated example sentences (strong voice anchor)
6. **Prefer vocabulary** - Brand-natural words (8 max)
7. **Avoid vocabulary** - Off-brand words (8 max)

**Where controlled**:
- **Legacy columns**:
  - `tone_model.good_examples[]`
  - `tone_model.avoid_examples[]`
  - `typical_openings[]` (text[])
  - `typical_closings[]` (text[])
  - `voice_examples.do_say[]` (JSONB)
  - `voice_examples.vocabulary.prefer[]` (JSONB)
  - `voice_examples.vocabulary.avoid[]` (JSONB)
- **V5 JSONB**:
  - `writing_examples.good_examples[]` ✅
  - `writing_examples.bad_examples[]` ✅ (but avoid_examples is better name)
  - `writing_examples.typical_openings[]` ✅
  - `writing_examples.typical_closings[]` ✅
  - ❌ **MISSING**: `do_say_examples`, `prefer_vocabulary`, `avoid_vocabulary`
- **Code location**: [resolve-context.ts lines 470-502](supabase/functions/generate-text-from-idea/resolve-context.ts#L470-L502)

**🚨 GAPS**: Need to extend `V5WritingExamples` with 3 fields: `do_say_examples`, `prefer_vocabulary`, `avoid_vocabulary`

---

#### **7. Guardrails**

**Required**: Hard constraints (what to NEVER say/do)

**Types**:
1. **never_say[]** - Word replacements ("morgenmad → brunch")
2. **content_exclusions** - Topics to avoid ("Ingen politiske emner")
3. **factual_constraints** - Rules ("Opfind aldrig events")
4. **voice_rationale** - Register constraints for atmosphere posts

**Where controlled**:
- **Legacy columns**:
  - `never_say[]` (text[])
  - `content_exclusions` (text)
  - `voice_rationale` (text) - "Hvorfor denne anbefaling?"
- **V5 JSONB**:
  - `guardrails.never_say[]` ✅
  - `guardrails.content_exclusions[]` ✅
  - `guardrails.factual_constraints[]` ✅
  - ❌ **MISSING**: `voice_rationale` (should be in `voice.register_guidance`)
- **Code location**: [resolve-context.ts lines 448-465, 492-495](supabase/functions/generate-text-from-idea/resolve-context.ts#L448-L465)

**🚨 GAP**: voice_rationale needs mapping to V5 (suggest: `voice.register_guidance`)

---

### B. CONTEXTUAL INFORMATION

#### **8. Business Identity**

**Required**: What the business IS (prevents hallucination)

**Fields**:
1. **business_character** - "Hyggelig café ved Aarhus Å med fokus på..." (text description)
2. **identity_keywords[]** - ["café", "bakery", "brunch-spot"] (3-5 category chips)
3. **brand_essence** - 1-2 sentence soul of the business
4. **brand_story** - origin_story, unique_differentiator, local_landmarks

**Where controlled**:
- **Legacy columns**:
  - `business_character` (text)
  - `identity_keywords[]` (text[])
  - `brand_essence` (JSONB {value, proof})
  - `brand_context` (JSONB: origin_story, unique_differentiator, local_landmarks)
- **V5 JSONB**:
  - ❌ **MISSING**: `business_character` (should be in `identity.business_description`)
  - ❌ **MISSING**: `identity_keywords` (should be in `identity.category_keywords`)
  - `identity.brand_essence` ✅
  - ❌ **MISSING**: `brand_story` (should be in `identity.brand_story`)
- **Code location**: [resolve-context.ts lines 532-569](supabase/functions/generate-text-from-idea/resolve-context.ts#L532-L569)
- **Prompt injection**: `Hvad dette sted er: ${businessCharacter}`

**🚨 CRITICAL GAPS**: 4 identity fields missing from V5

---

#### **9. Venue/Visual Context**

**Required**: Photo-derived venue description (for atmosphere posts)

**Fields**:
1. **recognizable_interior_identity** - Factual venue description from photo analysis
2. **visual_character** - Concept label (formality + type): "afslappet café", "modern fine-dining"
3. **venue_scene** - Observational scene-setting: "Naturligt lys, lyse træborde, sort kaffeudstyr"
4. **venue_data_source** - 'photo_analysis' | 'manual' | 'inferred'

**Where controlled**:
- **Legacy columns**: All 4 fields exist in `business_brand_profile`
- **V5 JSONB**: ❌ **ALL MISSING** - no venue context section
- **Code location**: [resolve-context.ts lines 510-520](supabase/functions/generate-text-from-idea/resolve-context.ts#L510-L520)
- **Prompt injection**: Critical for atmosphere posts - sets tone register and factual anchor

**🚨 CRITICAL GAP**: Entire venue context section missing - need `V5VenueContext` interface

---

#### **10. Audience Segments & Business Model**

**Required**: Who to write for + which copy hook to lead with

**Fields**:
1. **audience_segments[]** - B5 segments with timing_windows, motivation, content_angles
2. **business_model_type** - offer_led | occasion_led | destination_led | audience_led
3. **primary_copy_hook** - product | location | programme | identity
4. **audience_breadth** - narrow | mixed | broad
5. **target_audience** - Legacy fallback text description

**Where controlled**:
- **Legacy columns**:
  - `audience_segments` (JSONB with .segments[] array + classification fields)
  - `target_audience` (JSONB or text)
- **V5 JSONB**:
  - `programmes[].audienceSegments[]` ✅ (per-programme segments)
  - ❌ **MISSING**: business_model_type, primary_copy_hook, audience_breadth (classification)
- **Code location**: [resolve-context.ts lines 552-598](supabase/functions/generate-text-from-idea/resolve-context.ts#L552-L598)
- **Runtime logic**: `matchActiveSegment()` picks segment for current day/hour
- **Prompt injection**: `Overvejende gæstetype i dette tidsrum: ${activeSegmentName} — ${activeSegmentMotivation}`

**🚨 GAP**: B5 classification fields missing - need `V5AudienceClassification` section

---

#### **11. Location Intelligence**

**Required**: Copy-hook tokens + competitive context

**Fields**:
1. **matched_motivations[]** - ["destinationsbesøg", "romantisk_stemning", "arbejdsfrokost"]
2. **hospitality_density** - Competitive landscape (tæt/moderat/lav)
3. **seasonal_context** - Month + weekday + location-type seasonality
4. **tourist_appeal** - Boolean (tourist_factor ≥ 0.5)

**Where controlled**:
- **Legacy column**: `location_intelligence.matched_motivations[]` (JSONB)
- **Separate table**: `business_location_intelligence` (nearby_hospitality, category_scores, tourist_factor)
- **V5 JSONB**: ❌ **MISSING** - no location context section
- **Code location**: [resolve-context.ts lines 604-632, 715-738](supabase/functions/generate-text-from-idea/resolve-context.ts#L604-L632)
- **Prompt injection**: `Besøgsmotivation (hvad tiltrækker gæster): ${motivations.join(', ')}`

**📝 DECISION NEEDED**: Should location intel go in V5 or stay in separate table?
- **Argument FOR V5**: Part of brand positioning (why people come)
- **Argument AGAINST**: Environmental data that changes independently (competitive landscape)

---

#### **12. Communication Goals**

**Required**: What the caption should achieve

**Fields**:
1. **communication_goal** - Primary objective (text)
2. **emotional_promise** - The feeling guests take home (text)
3. **goal_mode** - drive_footfall | build_brand | retain_loyalty (runtime, from weekly plan)

**Where controlled**:
- **Legacy columns**:
  - `communication_goal` (JSONB {value, primary})
  - `emotional_promise` (text)
- **V5 JSONB**:
  - ❌ **MISSING**: `communication_goal` (should be in `identity.primary_goal`)
  - ❌ **MISSING**: `emotional_promise` (should be in `identity.emotional_promise`)
- **Code location**: [resolve-context.ts lines 590-604](supabase/functions/generate-text-from-idea/resolve-context.ts#L590-L604)
- **Prompt injection**: `Kommunikationsmål: ${communicationGoal}` + role framing for goal_mode

**🚨 GAPS**: 2 strategic fields missing from V5 identity section

---

### C. OUTPUT FORMAT CONTROLS

#### **13. Hashtags**

**Generated**: Not stored in brand profile - computed at runtime

**Algorithm** ([post-process.ts lines 100-200](supabase/functions/generate-text-from-idea/post-process.ts#L100-L200)):
1. Extract keyword from: menuItemName → contentBlock RET: prefix → AI keyword
2. Classify content domain: coffee | drinks | food | bakery | neutral
3. Facebook: `[city, keyword]` (1-2 tags)
4. Instagram: `[cityDomainTag, keyword?, secondaryLocalTag?, vibeTag?]` (3-5 tags)

**City-domain mapping**:
- Aarhus coffee: ['AarhusC', 'KaffeAarhus']
- København food: ['SpisIKøbenhavn', 'KøbenhavnMad']
- Etc.

**NOT in brand profile** - pure runtime logic

---

#### **14. Call-to-Action (CTA)**

**Selected**: Runtime logic based on booking patterns + goal mode

**Sources** ([select-cta.ts](supabase/functions/generate-text-from-idea/select-cta.ts)):
1. **Typical closings** - Brand-specific CTAs from brand profile (preferred)
2. **Default CTAs** - Hardcoded fallbacks by language
3. **Booking CTAs** - "Book bord" when reservation_required=true

**CTA styles**:
- `strict` - Verbatim CTA at end, booking link appended as button
- `soft` - AI integrates CTA naturally into text

**Where controlled**:
- **Legacy column**: `typical_closings[]` (text[])
- **V5 JSONB**: `writing_examples.typical_closings[]` ✅
- **Operational data**: `business_operations.reservation_required, accepts_walk_ins, booking_link`

**✅ GOOD**: V5 has typical_closings, operational data stays in separate table

---

#### **15. AI Model Parameters**

**Fixed**: Not in brand profile - hardcoded in [generate-text.ts](supabase/functions/generate-text-from-idea/generate-text.ts#L30-L42)

```typescript
{
  model: isPaid ? 'gpt-4o' : 'gpt-4o-mini',
  temperature: 0.7,
  max_tokens: 650,
  top_p: 0.9
}
```

**NOT configurable per business** - system-level constants

---

### D. POST-PROCESSING VALIDATIONS

#### **16. Quality Gates**

**Spelling check triggers** ([post-process.ts lines 30-50](supabase/functions/generate-text-from-idea/post-process.ts#L30-L50)):
- Double spacing: `/ {2}/`
- Space before punctuation: `/ [.!?,;]/`
- Repeated punctuation: `!!`, `??`, `,,`
- AI-tell hyphen: ` - ` / ` – `
- Split compound nouns (Danish): `æggekage` → ❌ `ægge kage`

**Banned closers** (stripped automatically):
- "Vi ses", "Vi venter", "Velkommen til", "Kom forbi", "Svip forbi", etc.

**Scene format rules** (atmosphere/behind_scenes):
- Rule 6: First line ≤ 7 words
- Rule 7: No furniture/room/light as grammatical subject
- Rule 8: Max 3 lines total (+ CTA line)

**NOT in brand profile** - universal quality standards

---

## Part 2: Mapping to Old vs New Brand Profile

### COMPLETE FIELD MAPPING TABLE

| **Requirement** | **Legacy Column** | **V5 JSONB Path** | **Status** |
|---|---|---|---|
| **TEXT QUALITY** | | | |
| Text length | ❌ None (hardcoded) | ❌ None (hardcoded) | ✅ Runtime logic |
| Humor level | `humor_level` (text) | `voice.humor_style` | ⚠️ Enum mismatch |
| Tone rules | `tone_of_voice.value`, `tone_model.writing_rules[]` | `voice.tone_rules[]` | ✅ Mapped |
| Formality | `tone_of_voice.formality_level` | `voice.formality_level` | ✅ Mapped |
| Personality traits | ❌ None | `voice.personality_traits[]` | 🆕 V5 only |
| Sentence structure | ❌ None | `voice.sentence_structure` | 🆕 V5 only |
| **EMOJI & STYLE** | | | |
| Emoji level | `tone_model.emoji_level` | ❌ **MISSING** | 🚨 Must add |
| Content anchors | `tone_model.content_anchors[]` | ❌ **MISSING** | 🚨 Must add |
| **VOICE EXAMPLES** | | | |
| Good examples | `tone_model.good_examples[]` | `writing_examples.good_examples[]` | ✅ Mapped |
| Avoid examples | `tone_model.avoid_examples[]` | `writing_examples.bad_examples[]` | ⚠️ Rename to avoid_examples |
| Typical openings | `typical_openings[]` | `writing_examples.typical_openings[]` | ✅ Mapped |
| Typical closings | `typical_closings[]` | `writing_examples.typical_closings[]` | ✅ Mapped |
| Do-say examples | `voice_examples.do_say[]` | ❌ **MISSING** | 🚨 Must add |
| Prefer vocabulary | `voice_examples.vocabulary.prefer[]` | ❌ **MISSING** | 🚨 Must add |
| Avoid vocabulary | `voice_examples.vocabulary.avoid[]` | ❌ **MISSING** | 🚨 Must add |
| **GUARDRAILS** | | | |
| Never say | `never_say[]` | `guardrails.never_say[]` | ✅ Mapped |
| Content exclusions | `content_exclusions` | `guardrails.content_exclusions[]` | ✅ Mapped |
| Factual constraints | ❌ None | `guardrails.factual_constraints[]` | 🆕 V5 only |
| Voice rationale | `voice_rationale` | ❌ **MISSING** | 🚨 Must add |
| **IDENTITY** | | | |
| Brand essence | `brand_essence` | `identity.brand_essence` | ✅ Mapped |
| Business character | `business_character` | ❌ **MISSING** | 🚨 Must add |
| Identity keywords | `identity_keywords[]` | ❌ **MISSING** | 🚨 Must add |
| Brand story | `brand_context{origin_story, unique_differentiator, local_landmarks}` | ❌ **MISSING** | 🚨 Must add |
| Communication goal | `communication_goal` | ❌ **MISSING** | 🚨 Must add |
| Emotional promise | `emotional_promise` | ❌ **MISSING** | 🚨 Must add |
| Core values | ❌ None | `identity.core_values[]` | 🆕 V5 only |
| Positioning | ❌ None | `identity.positioning` | 🆕 V5 only |
| What makes different | ❌ None | `identity.what_makes_us_different` | 🆕 V5 only |
| **VENUE/VISUAL** | | | |
| Interior identity | `recognizable_interior_identity` | ❌ **MISSING** | 🚨 Must add |
| Visual character | `visual_character` | ❌ **MISSING** | 🚨 Must add |
| Venue scene | `venue_scene` | ❌ **MISSING** | 🚨 Must add |
| Data source | `venue_data_source` | ❌ **MISSING** | 🚨 Must add |
| **AUDIENCE** | | | |
| Audience segments | `audience_segments.segments[]` | `programmes[].audienceSegments[]` | ⚠️ Different structure |
| Business model | `audience_segments.business_model_type` | ❌ **MISSING** | 🚨 Must add |
| Primary hook | `audience_segments.primary_copy_hook` | ❌ **MISSING** | 🚨 Must add |
| Audience breadth | `audience_segments.audience_breadth` | ❌ **MISSING** | 🚨 Must add |
| Target audience | `target_audience` | ❌ None (derive from segments) | 📝 Runtime transform |
| **LOCATION** | | | |
| Visit motivations | `location_intelligence.matched_motivations[]` | ❌ **MISSING** | 🚨 Must add OR keep in table |
| Hospitality density | `business_location_intelligence.nearby_hospitality` | ❌ **MISSING** | 📝 Keep in table (environmental) |
| Seasonal context | Computed from `category_scores` | ❌ **MISSING** | 📝 Keep in table (dynamic) |
| Tourist appeal | `business_location_intelligence.tourist_factor` | ❌ **MISSING** | 📝 Keep in table (environmental) |

**Legend**:
- ✅ Mapped - V5 has equivalent field
- 🆕 V5 only - New field in V5 (not used by Phase 3 yet)
- ⚠️ Issue - Exists but with naming/structure mismatch
- 🚨 Must add - Required by Phase 3, missing from V5
- 📝 Decision - Needs architectural decision (V5 vs separate table)

---

## Part 3: Integration Status Overview

### Phase 1: get-weekly-strategy ✅ **FULLY MIGRATED TO V5**

**Status**: ✅ Reading from `brand_profile_v5` JSONB via `getV5Profile()`

**What V5 provides**:
- programmes[] → Commercial orientation, audience segments per programme
- identity → brand_essence, positioning, core_values
- voice → tone_rules, formality_level, humor_style
- writing_examples → typical_openings, typical_closings
- guardrails → never_say, content_exclusions

**Transformation layer**: [v5-transformers.ts](supabase/functions/_shared/brand-profile/v5-transformers.ts)
- `deriveContentStrategy()` - Aggregates programme-level goals to business-wide strategy
- `deriveTargetAudience()` - Aggregates programme segments to primary audience
- `getActiveProgramme()` - Selects programme for current day/time
- `constructBrandVoiceFromV5()` - Builds legacy WeekContext.brand_voice structure

**Code reference**: [get-weekly-strategy/index.ts lines 271-310](supabase/functions/get-weekly-strategy/index.ts#L271-L310)

**✅ CONFIRMED**: Phase 1 is V5-native. No migration needed.

---

### Phase 2: generate-weekly-plan ⚠️ **PARTIALLY MIGRATED**

**Status**: ⚠️ Queries `business_brand_profile.*` for snapshot building, but doesn't use V5 JSONB

**What it queries**:
- Line 438: `.from('business_brand_profile').select('*')` for week_context_snapshot

**Why**: Fast-path optimization to skip 6 DB queries when snapshot exists

**V5 Status**: Phase 2 doesn't consume brand profile data for prompts - it executes the strategy created by Phase 1. Only snapshot caching uses legacy columns.

**Action**: 
- ✅ **NO MIGRATION NEEDED** - Phase 2 doesn't use brand voice for AI generation
- 📝 Update snapshot builder to cache V5 JSONB when available (low priority optimization)

---

### Phase 3: generate-text-from-idea 🚨 **NOT MIGRATED - LEGACY COLUMNS**

**Status**: 🚨 Reading from 27+ individual `business_brand_profile` columns

**Query location**: [resolve-context.ts line 363](supabase/functions/generate-text-from-idea/resolve-context.ts#L363)

```typescript
.select('brand_essence, tone_of_voice, tone_model, content_strategy, things_to_avoid, 
         never_say, voice_constraints, typical_closings, voice_examples, signature_phrases, 
         booking_link, voice_rationale, recognizable_interior_identity, business_character, 
         identity_keywords, humor_level, target_audience, communication_goal, emotional_promise, 
         content_exclusions, typical_openings, location_intelligence, brand_context, 
         visual_character, venue_scene, venue_data_source, audience_segments')
```

**Fields used in prompts**:
1. Core voice: brand_essence, tone_of_voice, tone_model
2. Constraints: things_to_avoid, never_say, voice_constraints
3. Examples: voice_examples, typical_closings, typical_openings, signature_phrases
4. Identity: business_character, identity_keywords
5. Goals: communication_goal, emotional_promise
6. Content: content_strategy, content_exclusions, content_anchors
7. Venue: recognizable_interior_identity, visual_character, venue_scene
8. Audience: audience_segments, target_audience
9. Location: location_intelligence
10. Voice rationale

**🚨 CRITICAL**: Phase 3 is the text generation workhorse - this is where V5 migration matters most

---

## Part 4: Required V5 Extensions for Phase 3 Migration

### New V5 Sections Needed

#### **1. V5VoiceExtended** (add 3 fields)

```typescript
export interface V5VoiceExtended extends V5Voice {
  // ✅ Keep existing: tone_rules, personality_traits, formality_level, humor_style,
  //    sentence_structure, voice_confidence, voice_reasoning
  
  // 🆕 ADD:
  content_anchors: string[];           // Programmes + menu categories (factual boundaries)
  emoji_level: 'none' | 'minimal' | 'moderate' | 'frequent';
  avoid_examples?: string[];           // Anti-pattern examples
  register_guidance?: string;          // voice_rationale equivalent (register constraint for atmosphere posts)
}
```

---

#### **2. V5WritingExamplesExtended** (add 3 fields)

```typescript
export interface V5WritingExamplesExtended extends V5WritingExamples {
  // ✅ Keep existing: typical_openings, typical_closings, signature_phrases,
  //    good_examples, bad_examples
  
  // 🆕 ADD:
  prefer_vocabulary?: string[];        // Brand-natural words (8 max)
  avoid_vocabulary?: string[];         // Off-brand words (8 max)
  do_say_examples?: string[];          // Curated example sentences (strong few-shot)
}
```

---

#### **3. V5IdentityExtended** (add 5 fields)

```typescript
export interface V5IdentityExtended extends V5Identity {
  // ✅ Keep existing: brand_essence, positioning, core_values, what_makes_us_different,
  //    identity_confidence, identity_reasoning, identity_sources
  
  // 🆕 ADD:
  business_description: string;        // What the business IS (prevents hallucination)
  category_keywords: string[];         // 3-5 identity chips (cafe, bakery, etc.)
  primary_goal: string;                // Primary communication objective
  emotional_promise?: string;          // The feeling guests take home
  brand_story?: {
    origin?: string;                   // How business started
    differentiator?: string;           // What makes it different
    local_references?: string[];       // Local landmarks for context
  };
}
```

---

#### **4. V5VenueContext** (NEW SECTION - 4 fields)

```typescript
export interface V5VenueContext {
  interior_identity: string;           // Factual venue description (from photo analysis)
  visual_concept: string;              // Concept label (formality + type)
  scene_description: string;           // Observational scene-setting language
  data_source: 'photo_analysis' | 'manual' | 'inferred';
  confidence?: number;                 // 0-1 score
}
```

---

#### **5. V5LocationContext** (NEW SECTION - 4 fields)

```typescript
export interface V5LocationContext {
  visit_motivations: string[];         // Copy-hook tokens: "destinationsbesøg", "romantisk_stemning"
  hospitality_density?: {
    label: 'low' | 'moderate' | 'high';
    nearby_count: number;
    radius_meters: number;
    breakdown?: Record<string, number>; // {restaurant: 12, cafe: 5, bar: 3}
  };
  seasonal_relevance?: string;         // Month + weekday + location-category seasonality signal
  tourist_appeal?: boolean;            // tourist_factor ≥ 0.5
}
```

**📝 DECISION POINT**: Should hospitality_density, seasonal_relevance, tourist_appeal be in V5 or stay in `business_location_intelligence` table?

**Recommendation**: 
- ✅ **visit_motivations** → V5 (stable, part of brand positioning)
- ❌ **hospitality_density, seasonal_relevance, tourist_appeal** → Keep in separate table (environmental data, changes independently)

---

#### **6. V5AudienceClassification** (NEW SECTION - 3 fields)

```typescript
export interface V5AudienceClassification {
  business_model: 'offer_led' | 'occasion_led' | 'destination_led' | 'audience_led';
  primary_hook: 'product' | 'location' | 'programme' | 'identity';
  breadth: 'narrow' | 'mixed' | 'broad';
  reasoning?: string;                  // Why this classification
}
```

---

### Extended V5BrandProfile Structure

```typescript
export interface V5BrandProfile {
  version: string;
  generated_at: string;
  generation_metadata?: { ... };
  
  programmes: V5Programme[];                  // ✅ Existing (Layer 1-2-4)
  identity: V5IdentityExtended;               // ⭐ EXTENDED (5 new fields)
  voice: V5VoiceExtended;                     // ⭐ EXTENDED (4 new fields)
  writing_examples: V5WritingExamplesExtended; // ⭐ EXTENDED (3 new fields)
  guardrails: V5Guardrails;                   // ✅ Existing
  
  venue_context?: V5VenueContext;             // 🆕 NEW SECTION (4 fields)
  location_context?: V5LocationContext;       // 🆕 NEW SECTION (1 field - visit_motivations only)
  audience_classification?: V5AudienceClassification; // 🆕 NEW SECTION (3 fields)
}
```

---

## Part 5: Field Count Summary

### Phase 3 Requirements

| **Category** | **Total Fields** | **In V5** | **Missing** | **% Coverage** |
|---|---|---|---|---|
| Text quality | 6 | 3 | 3 | 50% |
| Voice examples | 7 | 4 | 3 | 57% |
| Guardrails | 4 | 3 | 1 | 75% |
| Identity | 8 | 3 | 5 | 38% |
| Venue/Visual | 4 | 0 | 4 | 0% |
| Audience | 5 | 1 | 4 | 20% |
| Location | 4 | 0 | 1-4 | 0-75% (decision dependent) |
| **TOTAL** | **38** | **14** | **21-24** | **37-41%** |

### Current V5BrandProfile

| **Section** | **Fields Defined** | **Used by Phase 3** | **Waste** |
|---|---|---|---|
| programmes[] | 12 | 0 | 100% |
| identity | 7 | 1 (brand_essence) | 86% |
| voice | 7 | 3 (tone_rules, formality, humor) | 57% |
| writing_examples | 5 | 4 | 20% |
| guardrails | 4 | 3 | 25% |
| **TOTAL** | **35** | **11** | **69%** |

**Key Insight**: V5 currently provides only 37-41% of what Phase 3 needs. 69% of V5 fields go unused.

---

## Part 6: Migration Priority

### 🔴 CRITICAL (Blocks text generation quality)

1. **voice.emoji_level** - Controls emoji frequency (none/minimal/moderate/frequent)
2. **voice.content_anchors[]** - Factual boundaries (prevents menu hallucination)
3. **identity.business_description** - What the business IS (prevents concept hallucination)
4. **identity.category_keywords[]** - Identity chips (cafe/bakery/etc.)
5. **venue_context** - ALL 4 fields (critical for atmosphere posts)

**Impact if missing**: ❌ Broken atmosphere posts, hallucinated dishes, wrong emoji usage

---

### 🟡 HIGH (Degrades voice quality)

6. **writing_examples.prefer_vocabulary[]** - Brand-natural words
7. **writing_examples.avoid_vocabulary[]** - Off-brand words
8. **writing_examples.do_say_examples[]** - Few-shot voice anchors
9. **voice.avoid_examples[]** - Anti-pattern examples (wrong register)
10. **voice.register_guidance** - voice_rationale equivalent
11. **identity.brand_story** - origin/differentiator/landmarks
12. **identity.primary_goal** - communication_goal
13. **identity.emotional_promise** - Feeling to evoke

**Impact if missing**: ⚠️ Generic voice, less brand-authentic, missing strategic layer

---

### 🟢 MEDIUM (Nice-to-have enhancements)

14. **audience_classification** - ALL 3 fields (business_model, primary_hook, breadth)
15. **location_context.visit_motivations[]** - Copy-hook tokens

**Impact if missing**: ℹ️ Less targeted messaging, generic audience framing

---

### 🔵 LOW (Environmental data - keep in separate tables)

16. **Hospitality density** - Stay in `business_location_intelligence`
17. **Seasonal context** - Stay in `business_location_intelligence` (computed)
18. **Tourist appeal** - Stay in `business_location_intelligence`
19. **Opening hours** - Stay in `opening_hours` table
20. **Price level** - Stay in `business_operations`

**Impact**: ✅ No migration needed - operational/environmental data belongs elsewhere

---

## Part 7: Recommended Architecture

### ✅ Hybrid Model (Single Source of Truth for Brand, Separate for Operations)

**V5 Brand Profile** contains:
- Identity, voice, writing style, guardrails, venue context, audience classification

**Separate Tables** contain:
- business_operations (price_level, hours, booking patterns, kitchen_close_time)
- opening_hours (day-specific times)
- business_location_intelligence (hospitality_density, seasonal_context, tourist_appeal)

**Why Hybrid**:
- Brand profile data is **stable** (regenerated weekly/monthly)
- Operational data is **dynamic** (hours change, menus change, pricing changes)
- Location data is **environmental** (competitive landscape, tourism patterns)

---

## Summary: Next Actions

### 1. Extend V5BrandProfile Interface ✅

Add 3 new sections + extend 3 existing sections:
- V5VoiceExtended (+4 fields)
- V5WritingExamplesExtended (+3 fields)
- V5IdentityExtended (+5 fields)
- V5VenueContext (new, 4 fields)
- V5LocationContext (new, 1 field)
- V5AudienceClassification (new, 3 fields)

**Total new/extended fields**: 20

---

### 2. Update V5 Generator ✅

Modify:
- Layer 3 (identity) - add 5 new fields
- Layer 5a (voice) - add 4 new fields
- Layer 5b (writing_examples) - add 3 new fields
- NEW Layer 6 (venue_context) - 4 fields
- NEW Layer 7 (location_context) - 1 field
- NEW Layer 8 (audience_classification) - 3 fields

---

### 3. Migrate Phase 3 to V5 ✅

Change resolve-context.ts from:
```typescript
.select('brand_essence, tone_of_voice, tone_model, ...')  // 27 columns
```

To:
```typescript
.select('brand_profile_v5')  // 1 JSONB column
```

Parse V5 structure and map to BusinessContext interface.

---

### 4. Validation Period (2-4 weeks) ✅

- Dual-write: V5 generator populates both V5 JSONB AND legacy columns
- Phase 3 reads from V5 with legacy fallback
- A/B test caption quality
- Monitor performance (JSONB parsing vs column access)

---

### 5. Deprecate Legacy Columns (June 2026) ✅

After 4 weeks of stable V5 operation, drop 27 legacy columns:
- tone_of_voice, tone_model, voice_examples, voice_constraints, voice_rationale
- business_character, identity_keywords, brand_essence, brand_context
- recognizable_interior_identity, visual_character, venue_scene
- communication_goal, emotional_promise, location_intelligence
- typical_openings, typical_closings, signature_phrases, never_say, content_exclusions

**Keep**: booking_link, atmosphere_confidence_level, created_at, updated_at

---

**END OF COMPLETE ANALYSIS**
