# V5 Brand Profile ↔ Phase 3 Integration Gap Analysis

**Date**: May 10, 2026  
**Purpose**: Establish V5 Brand Profile (`brand_profile_v5` JSONB) as single source of truth  
**Current State**: Phase 3 reads from **legacy individual columns**, NOT from V5 JSONB  

---

## Executive Summary

**Critical Finding**: Phase 3 (generate-text-from-idea) is **NOT wired to the `brand_profile_v5` JSONB column**. It queries 27+ individual legacy columns from `business_brand_profile` table.

**Migration Blockers Identified**:
1. **17 fields** used by Phase 3 are **missing from V5BrandProfile interface**
2. **V5 JSONB column** contains data that Phase 3 doesn't consume yet
3. **Extended voice fields** (tone_model, voice_examples) have no V5 mapping

**Required Actions**:
1. Extend V5BrandProfile interface to include missing fields
2. Update V5 generator to populate extended fields  
3. Migrate Phase 3 to read from `brand_profile_v5` JSONB
4. Deprecate legacy columns after dual-write validation period

---

## Part 1: Fields in V5 Brand Profile NOT Used by Phase 3

### V5BrandProfile → Phase 3 Mapping

| **V5 JSONB Path** | **Phase 3 Usage** | **Notes** |
|---|---|---|
| **programmes[]** | ❌ NOT USED | Layer 1-2-4 programme data. Phase 3 doesn't consume programmes yet. Used in Phase 1/2 only. |
| `programmes[].type` | ❌ | "brunch", "lunch", "dinner", "bar" |
| `programmes[].name` | ❌ | Display name |
| `programmes[].timeWindow{start,end}` | ❌ | Service hours |
| `programmes[].daysOfWeek[]` | ❌ | Operating days |
| `programmes[].confidence` | ❌ | high/medium/low |
| `programmes[].menuEvidence[]` | ❌ | Evidence list |
| `programmes[].commercialOrientation` | ❌ | Layer 2 decision_timing, goal_split, content_affinity |
| `programmes[].audienceSegments[]` | ❌ | Per-programme segments |
| **identity** | ⚠️ PARTIAL USE | Only brand_essence used, rest ignored |
| `identity.brand_essence` | ✅ USED | Parsed from legacy `brand_essence` column with v5 format detection |
| `identity.positioning` | ❌ NOT USED | 2-3 sentence competitive differentiation |
| `identity.core_values[]` | ❌ NOT USED | 3-5 guiding principles |
| `identity.what_makes_us_different` | ❌ NOT USED | One sentence USP |
| `identity.identity_confidence` | ❌ NOT USED | 0-1 score |
| `identity.identity_reasoning` | ❌ NOT USED | Why these values chosen |
| `identity.identity_sources[]` | ❌ NOT USED | Evidence sources |
| **voice** | ⚠️ PARTIAL USE | Some fields used via legacy columns |
| `voice.tone_rules[]` | ✅ USED | Via legacy `tone_of_voice.value` (5 writing rules) |
| `voice.personality_traits[]` | ❌ NOT USED | 3-5 traits like ["kortfattet", "direkte", "venlig"] |
| `voice.formality_level` | ✅ USED | Via legacy `tone_of_voice.formality_level` (v2 fallback) |
| `voice.humor_style` | ✅ USED | Via legacy `humor_level` column |
| `voice.sentence_structure` | ❌ NOT USED | short_declarative/conversational/formal/varied |
| `voice.voice_confidence` | ❌ NOT USED | 0-1 score |
| `voice.voice_reasoning` | ❌ NOT USED | How voice was derived |
| **writing_examples** | ✅ MOSTLY USED | Via legacy columns |
| `writing_examples.typical_openings[]` | ✅ USED | Via legacy `typical_openings` column |
| `writing_examples.typical_closings[]` | ✅ USED | Via legacy `typical_closings` column (emoji-stripped) |
| `writing_examples.signature_phrases[]` | ✅ USED | Via legacy `signature_phrases` column |
| `writing_examples.good_examples[]` | ❌ NOT USED | Optional full post examples (good) |
| `writing_examples.bad_examples[]` | ❌ NOT USED | Optional full post examples (bad) |
| **guardrails** | ✅ MOSTLY USED | Via legacy columns |
| `guardrails.never_say[]` | ✅ USED | Via legacy `never_say` column |
| `guardrails.content_exclusions[]` | ✅ USED | Via legacy `content_exclusions` column |
| `guardrails.factual_constraints[]` | ❌ NOT USED | Rules like "Opfind aldrig events" |
| `guardrails.seasonal_notes[]` | ❌ NOT USED | Optional seasonal guidance |
| **generation_metadata** | ❌ NOT USED | request_id, duration_ms, ai_models_used |

### Summary: V5 Fields Not Used

**Total V5 fields**: 38  
**Used by Phase 3**: 9 (24%)  
**NOT used by Phase 3**: 29 (76%)

**Biggest gaps**:
- ❌ **programmes[]** array (12 fields) - Phase 3 doesn't consume programme structure
- ❌ **identity** details (6 of 7 fields) - Only brand_essence used
- ❌ **voice** metadata (3 fields) - personality_traits, sentence_structure, confidence/reasoning
- ❌ **writing_examples** optional (2 fields) - good_examples, bad_examples
- ❌ **guardrails** extended (2 fields) - factual_constraints, seasonal_notes

---

## Part 2: Fields Used by Phase 3 NOT in V5 Brand Profile

### Phase 3 Requirements → V5 Gap Analysis

#### **CRITICAL MISSING FIELDS** (17 fields)

These fields are actively used in Phase 3 caption generation but have **NO mapping** in V5BrandProfile interface:

| **Legacy Column** | **Phase 3 Usage** | **Data Type** | **Migration Path** |
|---|---|---|---|
| **Extended Voice Fields** | | | |
| `tone_model` | ✅ CRITICAL | JSONB | **ADD to V5Voice** |
| `tone_model.writing_rules[]` | ✅ Core voice rules | string[] | Map to voice.tone_rules |
| `tone_model.good_examples[]` | ✅ Few-shot examples | string[] | Map to writing_examples.good_examples |
| `tone_model.avoid_examples[]` | ✅ Anti-patterns | string[] | NEW: voice.avoid_examples |
| `tone_model.content_anchors[]` | ✅ Programme/menu categories | string[] | NEW: voice.content_anchors |
| `tone_model.emoji_level` | ✅ none/minimal/moderate/frequent | string | NEW: voice.emoji_level |
| `voice_examples` | ✅ CRITICAL | JSONB | **ADD to V5WritingExamples** |
| `voice_examples.vocabulary.prefer[]` | ✅ Brand vocabulary | string[] | NEW: writing_examples.prefer_vocabulary |
| `voice_examples.vocabulary.avoid[]` | ✅ Off-brand words | string[] | NEW: writing_examples.avoid_vocabulary |
| `voice_examples.do_say[]` | ✅ Example sentences | string[] | NEW: writing_examples.do_say_examples |
| **Voice Constraints & Rationale** | | | |
| `voice_constraints` | ✅ Writing principles | JSONB {value, proof} | Map to voice.tone_rules (append) |
| `voice_rationale` | ✅ Register constraint | text | NEW: voice.register_guidance |
| **Identity Extensions** | | | |
| `business_character` | ✅ What business IS | text | **ADD to V5Identity** as identity.business_description |
| `identity_keywords[]` | ✅ 3-5 identity chips | text[] | **ADD to V5Identity** as identity.category_keywords |
| **Visual/Venue Context** | | | |
| `recognizable_interior_identity` | ✅ Venue description | JSONB {value, proof} | **NEW Section**: V5VenueContext |
| `visual_character` | ✅ Concept label | text | **NEW Section**: V5VenueContext.visual_concept |
| `venue_scene` | ✅ Scene-setting language | text | **NEW Section**: V5VenueContext.scene_description |
| `venue_data_source` | ✅ Metadata | text | **NEW Section**: V5VenueContext.data_source |
| **Communication Strategy** | | | |
| `communication_goal` | ✅ Primary objective | JSONB {value, primary} | **ADD to V5Identity** as identity.primary_goal |
| `emotional_promise` | ✅ Guest feeling | text | **ADD to V5Identity** as identity.emotional_promise |
| **Location Intelligence** | | | |
| `location_intelligence` | ✅ Copy-hook tokens | JSONB | **NEW Section**: V5LocationContext |
| `location_intelligence.matched_motivations[]` | ✅ e.g. "destinationsbesøg" | string[] | NEW: location_context.visit_motivations |
| **Brand Context & Story** | | | |
| `brand_context` | ✅ Origin/differentiator/landmarks | JSONB | **ADD to V5Identity** as identity.brand_story |
| `brand_context.origin_story` | ✅ How business started | string | identity.brand_story.origin |
| `brand_context.unique_differentiator` | ✅ What makes different | string | identity.brand_story.differentiator |
| `brand_context.local_landmarks[]` | ✅ Location references | string[] | identity.brand_story.local_references |
| **Audience Segments Extended** | | | |
| `audience_segments` | ✅ B5 segments array | JSONB | V5Programme.audienceSegments (exists but not used by Phase 3) |
| `audience_segments.business_model_type` | ✅ offer_led/occasion_led/etc | string | **NEW**: V5AudienceClassification.business_model |
| `audience_segments.primary_copy_hook` | ✅ product/location/programme | string | **NEW**: V5AudienceClassification.primary_hook |
| `audience_segments.audience_breadth` | ✅ narrow/mixed/broad | string | **NEW**: V5AudienceClassification.breadth |

#### **Additional Context Fields** (Not in Brand Profile)

These are fetched from **other tables** (business_operations, opening_hours, business_location_intelligence):

| **Table** | **Field** | **Phase 3 Usage** |
|---|---|---|
| `business_operations` | `price_level` | ✅ Budget/casual/premium label |
| `business_operations` | `reservation_required` | ✅ Booking pattern signal |
| `business_operations` | `accepts_walk_ins` | ✅ Walk-in signal |
| `business_operations` | `kitchen_close_time` | ✅ Food service constraint |
| `opening_hours` | `open_time, close_time, closed` | ✅ Daily hours (by weekday) |
| `business_location_intelligence` | `nearby_hospitality` | ✅ Competitive density |
| `business_location_intelligence` | `category_scores` | ✅ Seasonal context |
| `business_location_intelligence` | `tourist_factor` | ✅ International appeal flag |

**NOTE**: These should remain in separate tables (operational data, not brand profile).

---

## Part 3: Proposed V5 Brand Profile Extension

### Extended V5BrandProfile Interface

```typescript
export interface V5BrandProfile {
  version: string;
  generated_at: string;
  generation_metadata?: { ... };
  
  programmes: V5Programme[];           // ✅ Existing (Layer 1-2-4)
  identity: V5IdentityExtended;        // ⭐ EXTENDED
  voice: V5VoiceExtended;              // ⭐ EXTENDED
  writing_examples: V5WritingExamplesExtended;  // ⭐ EXTENDED
  guardrails: V5Guardrails;            // ✅ Existing
  
  venue_context?: V5VenueContext;      // 🆕 NEW SECTION
  location_context?: V5LocationContext; // 🆕 NEW SECTION
  audience_classification?: V5AudienceClassification; // 🆕 NEW SECTION
}

// ============================================================================
// EXTENDED SECTIONS
// ============================================================================

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

export interface V5VoiceExtended extends V5Voice {
  // ✅ Keep existing: tone_rules, personality_traits, formality_level, humor_style,
  //    sentence_structure, voice_confidence, voice_reasoning
  
  // 🆕 ADD:
  content_anchors: string[];           // Programmes + menu categories (factual boundaries)
  emoji_level: 'none' | 'minimal' | 'moderate' | 'frequent';
  avoid_examples?: string[];           // Anti-pattern examples
  register_guidance?: string;          // Register constraint for atmosphere/BTS posts
}

export interface V5WritingExamplesExtended extends V5WritingExamples {
  // ✅ Keep existing: typical_openings, typical_closings, signature_phrases,
  //    good_examples, bad_examples
  
  // 🆕 ADD:
  prefer_vocabulary?: string[];        // Brand-natural words (8 max)
  avoid_vocabulary?: string[];         // Off-brand words (8 max)
  do_say_examples?: string[];          // Curated example sentences (strong few-shot)
}

// ============================================================================
// NEW SECTIONS
// ============================================================================

export interface V5VenueContext {
  interior_identity: string;           // Factual venue description (from photo analysis)
  visual_concept: string;              // Concept label (formality + type)
  scene_description: string;           // Observational scene-setting language
  data_source: 'photo_analysis' | 'manual' | 'inferred';
  confidence?: number;                 // 0-1 score
}

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

export interface V5AudienceClassification {
  business_model: 'offer_led' | 'occasion_led' | 'destination_led' | 'audience_led';
  primary_hook: 'product' | 'location' | 'programme' | 'identity';
  breadth: 'narrow' | 'mixed' | 'broad';
  reasoning?: string;                  // Why this classification
}
```

---

## Part 4: Migration Plan

### Phase A: Extend V5 Generator

**Files to Update**:
1. `supabase/functions/_shared/brand-profile/types-v5.ts`
   - Add V5IdentityExtended, V5VoiceExtended, V5WritingExamplesExtended
   - Add V5VenueContext, V5LocationContext, V5AudienceClassification
   - Update V5BrandProfile to use extended interfaces

2. `supabase/functions/generate-brand-profile-v5/layers/layer-3-identity.ts`
   - Add business_description extraction (from business_character)
   - Add category_keywords extraction (from identity_keywords)
   - Add primary_goal extraction (from communication_goal)
   - Add emotional_promise extraction
   - Add brand_story extraction (from brand_context)

3. `supabase/functions/generate-brand-profile-v5/layers/layer-5-voice.ts`
   - Add content_anchors extraction (from tone_model.content_anchors)
   - Add emoji_level extraction (from tone_model.emoji_level)
   - Add avoid_examples extraction (from tone_model.avoid_examples)
   - Add register_guidance extraction (from voice_rationale)

4. `supabase/functions/generate-brand-profile-v5/layers/layer-5-writing-examples.ts`
   - Add prefer_vocabulary extraction (from voice_examples.vocabulary.prefer)
   - Add avoid_vocabulary extraction (from voice_examples.vocabulary.avoid)
   - Add do_say_examples extraction (from voice_examples.do_say)

5. **NEW FILE**: `supabase/functions/generate-brand-profile-v5/layers/layer-6-venue-context.ts`
   - Generate V5VenueContext from recognizable_interior_identity, visual_character, venue_scene
   - Query business_photo_analysis table for source data

6. **NEW FILE**: `supabase/functions/generate-brand-profile-v5/layers/layer-7-location-context.ts`
   - Generate V5LocationContext from location_intelligence, business_location_intelligence
   - Include hospitality_density, seasonal_relevance, tourist_appeal

7. **NEW FILE**: `supabase/functions/generate-brand-profile-v5/layers/layer-8-audience-classification.ts`
   - Extract B5 business_model_type, primary_copy_hook, audience_breadth
   - Generate reasoning for classification

### Phase B: Dual-Write Period

**Duration**: 2-4 weeks  
**Objective**: Validate V5 JSONB contains all fields Phase 3 needs

**Actions**:
1. Deploy extended V5 generator
2. Regenerate brand profiles for test businesses (Café Faust, etc.)
3. Verify `brand_profile_v5` JSONB contains all 17 missing fields
4. Keep legacy columns populated (dual-write mode)

**Validation Queries**:
```sql
-- Check V5 completeness for Café Faust
SELECT 
  brand_profile_v5->>'version' as version,
  brand_profile_v5->'identity'->>'business_description' as business_desc_v5,
  business_character as business_desc_legacy,
  jsonb_array_length(brand_profile_v5->'voice'->'content_anchors') as anchors_v5,
  jsonb_array_length(tone_model->'content_anchors') as anchors_legacy,
  brand_profile_v5->'venue_context'->>'interior_identity' as venue_v5,
  recognizable_interior_identity->>'value' as venue_legacy
FROM business_brand_profile
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';
```

### Phase C: Migrate Phase 3 to V5 JSONB

**Files to Update**:
1. `supabase/functions/generate-text-from-idea/resolve-context.ts`
   - Change SELECT query from individual columns to `brand_profile_v5`
   - Parse V5 JSONB structure instead of legacy columns
   - Map V5 paths to BusinessContext interface

**Before** (lines 363-367):
```typescript
const { data: brandProfile } = await supabase
  .from('business_brand_profile')
  .select('brand_essence, tone_of_voice, tone_model, content_strategy, ...')
  .eq('business_id', businessId)
  .single()
```

**After**:
```typescript
const { data: brandProfile } = await supabase
  .from('business_brand_profile')
  .select('brand_profile_v5')
  .eq('business_id', businessId)
  .single()

const v5 = brandProfile?.brand_profile_v5 as V5BrandProfile | null
if (!v5) {
  // Fallback to legacy columns for businesses without V5 profile
  const { data: legacy } = await supabase
    .from('business_brand_profile')
    .select('brand_essence, tone_of_voice, ...')
    .eq('business_id', businessId)
    .single()
  // Parse legacy format...
}
```

2. Map V5 JSONB paths to BusinessContext fields:
```typescript
// V5 mapping
brandTone = v5.voice.tone_rules.join('\n')
brandWritingRules = v5.voice.tone_rules
brandGoodExamples = v5.writing_examples.good_examples || []
brandAvoidExamples = v5.voice.avoid_examples || []
brandSignaturePhrases = v5.writing_examples.signature_phrases
contentAnchors = v5.voice.content_anchors
typicalClosings = v5.writing_examples.typical_closings
typicalOpenings = v5.writing_examples.typical_openings
thingsToAvoid = v5.guardrails.never_say.join(', ')
voiceConstraints = '' // Combined into voice.tone_rules
businessCharacter = v5.identity.business_description
identityKeywords = v5.identity.category_keywords
humorLevel = v5.voice.humor_style
communicationGoal = v5.identity.primary_goal
emotionalPromise = v5.identity.emotional_promise || ''
brandContext = v5.identity.brand_story || null
venueIdentity = v5.venue_context?.interior_identity || ''
venueCharacter = v5.venue_context?.visual_concept || ''
venueScene = v5.venue_context?.scene_description || ''
locationIntelligenceMotivations = v5.location_context?.visit_motivations || []
businessModelType = v5.audience_classification?.business_model || ''
primaryCopyHook = v5.audience_classification?.primary_hook || ''
audienceBreadth = v5.audience_classification?.breadth || ''
// ... etc
```

### Phase D: Deprecate Legacy Columns

**Timeline**: After 4 weeks of successful V5-only operation  
**Objective**: Remove data duplication

**Migration SQL**:
```sql
-- Mark legacy columns as deprecated (do NOT drop yet)
COMMENT ON COLUMN business_brand_profile.tone_of_voice IS 
  'DEPRECATED: Migrated to brand_profile_v5.voice.tone_rules. Will be dropped June 2026.';

COMMENT ON COLUMN business_brand_profile.tone_model IS 
  'DEPRECATED: Migrated to brand_profile_v5.voice.content_anchors + emoji_level + avoid_examples. Will be dropped June 2026.';

-- ... etc for all 27 migrated columns
```

**Final Drop** (June 2026):
```sql
ALTER TABLE business_brand_profile
  DROP COLUMN tone_of_voice,
  DROP COLUMN tone_model,
  DROP COLUMN voice_examples,
  DROP COLUMN voice_constraints,
  DROP COLUMN voice_rationale,
  DROP COLUMN business_character,
  DROP COLUMN identity_keywords,
  DROP COLUMN recognizable_interior_identity,
  DROP COLUMN visual_character,
  DROP COLUMN venue_scene,
  DROP COLUMN venue_data_source,
  DROP COLUMN communication_goal,
  DROP COLUMN emotional_promise,
  DROP COLUMN location_intelligence,
  DROP COLUMN brand_context,
  DROP COLUMN typical_openings,
  DROP COLUMN typical_closings,
  DROP COLUMN signature_phrases,
  DROP COLUMN never_say,
  DROP COLUMN content_exclusions,
  DROP COLUMN brand_essence;
  -- Keep: booking_link, atmosphere_confidence_level, created_at, updated_at
```

---

## Part 5: Risk Assessment

### Low Risk (Safe to Proceed)
- ✅ V5 structure is well-defined
- ✅ Phase 3 is isolated (doesn't affect Phase 1/2)
- ✅ Can maintain legacy fallback during migration
- ✅ Test business (Café Faust) available for validation

### Medium Risk (Mitigation Required)
- ⚠️ **17 missing fields** need V5 generator updates (extensive work)
- ⚠️ **Type mapping complexity** - JSONB parsing vs direct column access
- ⚠️ **Audience segments** - V5 has per-programme segments, Phase 3 needs active segment for current time
- ⚠️ **Performance** - JSONB parsing may be slower than direct column access

**Mitigation**:
- Implement extended V5 generator incrementally (one layer at a time)
- Add comprehensive TypeScript types for V5 parsing
- Cache parsed V5 data in memory (single parse per request)
- Benchmark JSONB vs column performance (expect <5ms difference)

### High Risk (Requires User Decision)
- 🚨 **Audience segment matching logic** - Phase 3 does runtime day/hour matching (`matchActiveSegment()`) but V5 stores static programme segments
  - **Option 1**: Keep audience_segments in separate column (hybrid approach)
  - **Option 2**: Add V5AudienceClassification with business_model_type (simplified)
  - **Option 3**: Move matchActiveSegment logic to V5 generator (pre-compute active segment)
  
- 🚨 **Location intelligence** - business_location_intelligence table holds runtime data (hospitality_density, tourist_factor) that changes independently of brand profile
  - **Option 1**: Keep in separate table, Phase 3 joins on demand
  - **Option 2**: Denormalize into V5LocationContext (stale data risk)

---

## Part 6: Recommended Approach

### **Hybrid Architecture** (Recommended)

**Single Source of Truth**: `brand_profile_v5` JSONB for **brand identity, voice, and writing style**  
**Separate Sources**: Operational + location data remain in their own tables

```typescript
// Phase 3 data fetch (recommended)
const { data: profile } = await supabase
  .from('business_brand_profile')
  .select('brand_profile_v5')  // ← Single brand profile fetch
  .eq('business_id', businessId)
  .single()

// Operational data (separate fetch)
const { data: operations } = await supabase
  .from('business_operations')
  .select('price_level, reservation_required, accepts_walk_ins, kitchen_close_time')
  .eq('business_id', businessId)
  .single()

// Location intelligence (separate fetch)
const { data: location } = await supabase
  .from('business_location_intelligence')
  .select('nearby_hospitality, category_scores, tourist_factor')
  .eq('business_id', businessId)
  .single()

// Opening hours (separate fetch, day-specific)
const { data: hours } = await supabase
  .from('opening_hours')
  .select('open_time, close_time, closed')
  .eq('business_id', businessId)
  .eq('weekday', todayName)
  .single()
```

**What Goes in V5 Brand Profile**:
- ✅ Brand identity (essence, positioning, values, story)
- ✅ Voice & tone (rules, examples, constraints)
- ✅ Writing examples (openings, closings, phrases, vocabulary)
- ✅ Guardrails (never_say, content_exclusions, factual_constraints)
- ✅ Venue context (interior_identity, visual_concept, scene_description)
- ✅ Audience classification (business_model, primary_hook, breadth)

**What Stays Outside V5**:
- ❌ Operational data (price_level, reservation_required, kitchen_close_time) → business_operations table
- ❌ Opening hours (day-specific, time-bound) → opening_hours table
- ❌ Location intelligence (hospitality_density, tourist_factor) → business_location_intelligence table
- ❌ Runtime segment matching (day/hour-based) → compute on-demand in Phase 3

**Why Hybrid**:
- Brand profile data is **stable** (regenerated weekly/monthly)
- Operational data is **dynamic** (hours change, menus change, pricing changes)
- Location data is **environmental** (competitive landscape, tourism patterns)
- Clean separation of concerns

---

## Summary: Action Items

### Immediate (Week 1):
1. ✅ **User Decision**: Approve hybrid architecture (V5 for brand, separate tables for ops/location)
2. ✅ **User Decision**: Approve V5BrandProfile extension (3 new sections, 17 new fields)
3. 📝 Update `types-v5.ts` with extended interfaces
4. 📝 Extend V5 generator layers 3, 5 to populate new fields
5. 📝 Create new layers 6-8 (venue, location, audience classification)

### Short-term (Week 2-3):
6. 🧪 Test extended V5 generator with Café Faust
7. 🧪 Validate brand_profile_v5 JSONB contains all 17 missing fields
8. 📝 Update Phase 3 resolve-context.ts to read from brand_profile_v5
9. 📝 Add legacy column fallback for businesses without V5 profile

### Medium-term (Week 4-6):
10. 🚀 Deploy Phase 3 V5 integration to production
11. 📊 Monitor performance (JSONB parsing vs column access)
12. 🧪 A/B test caption quality (V5 vs legacy)
13. 📝 Mark legacy columns as deprecated (add comments)

### Long-term (June 2026):
14. 🗑️ Drop deprecated legacy columns after 4 weeks of stable V5 operation
15. 📚 Update documentation to reflect V5 as single source of truth
16. ✅ Close migration project

---

## Questions for User

1. **Approve hybrid architecture?** (V5 for brand, separate tables for ops/location/hours)
2. **Approve V5BrandProfile extension?** (Add 3 new sections: venue_context, location_context, audience_classification)
3. **Timeline preference?** (Aggressive 2-week migration vs conservative 6-week rollout)
4. **Testing scope?** (Single test business vs full pilot with 5-10 businesses)
5. **Performance benchmark required?** (JSONB vs column speed comparison before migration)

---

**END OF ANALYSIS**
