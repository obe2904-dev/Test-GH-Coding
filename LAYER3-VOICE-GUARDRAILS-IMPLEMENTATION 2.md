# Layer 3 Enhancement: Voice, Examples & Guardrails

**Implementation Guide for Copilot**  
**Date**: May 8, 2026  
**Objective**: Expand Layer 3 (Brand Profile) with 3 new sections: Voice & Tone, Writing Examples, Content Guardrails

---

## Executive Summary

Currently, Layer 3 only contains **Brand Identity** (brand_essence, positioning, core_values, what_makes_us_different). This is insufficient for quality content generation because it tells us WHAT the business is but not HOW to communicate.

**Missing critical sections:**
1. **Voice & Tone** - How the business communicates (formality, humor, storytelling style)
2. **Writing Examples** - Concrete examples of the brand voice in action
3. **Content Guardrails** - What to NEVER say (safety rules)

**Current coverage**: ~40% of needed brand profile data  
**After implementation**: ~95% coverage  
**Result**: Can fully replace legacy brand_voice system

---

## Gap Analysis: Old vs New Brand Profile

### 🚨 What's Currently Missing from V5

**Old System Has (but New Layer 3 doesn't):**

#### Voice & Tone:
- ❌ `tone_of_voice` - How the business communicates
- ❌ `tone_keywords[]` - Personality descriptors
- ❌ `formality` - informal/semi-formal/formal
- ❌ `humor_level` - low/moderate/high
- ❌ `storytelling_style` - anecdotal/direct/descriptive
- ❌ `emoji_style` - minimal/moderate/expressive
- ❌ `voice_constraints` - Writing principles/rules

#### Writing Examples:
- ❌ `typical_openings[]` - Example opening lines
- ❌ `typical_closings[]` - Example CTAs/closings
- ❌ `signature_phrases[]` - Brand-specific phrases

#### Guardrails:
- ❌ `never_say[]` - Word-level blocklist with replacements
- ❌ `do_not_say[]` - Topic/approach blocklist

**Impact**: Content generation systems (Weekly Plan, Dagens Forslag) currently have NO voice guidance, leading to inconsistent tone and potential brand violations.

---

### ✅ What You Already Have in V5 (No Changes Needed)

**Layer 1: Programme Detection** - ✅ Keep as-is
- Detects: Brunch, Frokost, Aftensmad, Bar, etc.
- Status: Working perfectly
- No changes needed

**Layer 2: Commercial Orientation** - ✅ Keep as-is
- Content strategy: Commercial vs Engagement balance
- Promotion timing/frequency rules
- Status: **Superior to old `content_strategy`**
- No changes needed

**Layer 3: Identity** - ✅ Keep + expand with 3 new sections
- Current fields:
  - `brand_essence` ✅
  - `positioning` ✅
  - `core_values[]` ✅
  - `what_makes_us_different` ✅
  - `local_location_reference` ✅
- Status: Working, factually accurate, strict guardrails implemented
- **Action**: Add voice, writing_examples, guardrails sections

**Layer 4: Audience Segments** - ✅ Keep as-is
- Programme-specific segments with motivations, timing, content angles
- Status: **Superior to old `target_audience`**
- Includes behavioral targeting (e.g., brunch-only, no breakfast patterns)
- No changes needed

---

### 📋 Implementation Priority

**This document focuses on**: Expanding Layer 3 with 3 new sections

**What NOT to change**:
- Layer 1 (Programme Detection) - working perfectly
- Layer 2 (Commercial Orientation) - superior to legacy system
- Layer 4 (Audience Segments) - superior to legacy system
- Layer 3 identity fields - keep all existing fields unchanged

**What TO add**:
- Layer 3: `voice` section (8 fields)
- Layer 3: `writing_examples` section (3 fields)
- Layer 3: `guardrails` section (2 fields)

---

## Implementation Plan - OPTION C: Integration Approach (REVISED MAY 8)

**Approach**: Integrate existing fields into V5 + minimal cleanup + single-voice paradigm
**Timeline**: 25-37 hours (vs 42-60 for Option B, 29-43 for Option A)
**Why**: Database audit revealed fields marked "unused" are ACTIVELY USED in production

**CRITICAL AUDIT FINDING** (May 8, 2026):
- ❌ Original plan to delete `typical_openings`/`typical_closings` **BLOCKED**
- ✅ Database shows: 100% populated openings, 67% populated closings
- ✅ Grep search found: 249 code references to "deleted" fields
- ✅ User requirement: "Don't touch what works perfectly"
- **Decision**: **INTEGRATE instead of DELETE** (Option C approach)

### Phase 0: Database Cleanup & Consolidation (REVISED MAY 8)

#### 🚨 CRITICAL AUDIT FINDINGS - PLAN REVISED

**Date**: May 8, 2026  
**Status**: Database audit completed - **ORIGINAL DELETION PLAN BLOCKED**

**Audit Command**:
```bash
# Database audit script
deno run --allow-net --allow-env scripts/audit-voice-fields.ts
```

**Findings Summary** (3 active businesses audited):

| Field | Populated | Code Refs | Risk | Decision |
|-------|-----------|-----------|------|----------|
| `typical_openings` | **100% (3/3)** | 25 refs | 🔴 HIGH | ❌ **CANNOT DELETE** |
| `typical_closings` | **67% (2/3)** | 20 refs | 🔴 HIGH | ❌ **CANNOT DELETE** |
| `tone_keywords` | 33% (1/3) | 15 refs | 🔴 HIGH | ⚠️ Keep as fallback |
| `voice_options` | 33% (1/3) | 10 refs | 🔴 HIGH | ⚠️ Investigate Sprint 1 |
| `do_not_say` | **0% (NULL)** | 12 refs | 🟡 MEDIUM | ✅ Can delete after code cleanup |

**Example Data Found**:
```typescript
// typical_openings (100% populated - actively used!):
["Denne uge på Restaurant Klokken", "Vores køkken"]

// typical_closings (67% populated - actively used!):
["Book dit bord", "Reservér via vores hjemmeside"]

// tone_keywords (33% populated - fallback when tone_model empty):
["Raffineret", "Passioneret", "Autentisk", "Nordisk", "Håndværk"]
```

**Code Usage Hotspots** (from 249 grep results):
- [generate-weekly-plan/index.ts](supabase/functions/generate-weekly-plan/index.ts) - Uses `typical_openings`, `typical_closings`
- [get-weekly-strategy/index.ts](supabase/functions/get-weekly-strategy/index.ts) - Uses `tone_keywords`, `typical_openings`, `typical_closings`
- [phase2b.ts](supabase/functions/_shared/post-helpers/strategy/phase2/phase2b.ts) - Uses `typical_openings`, `typical_closings`
- [resolve-context.ts](supabase/functions/generate-text-from-idea/resolve-context.ts) - Uses all fields

**Conclusion**: 
- ❌ **Original Option B plan (delete fields) is NOT VIABLE**
- ✅ **Revised Option C: INTEGRATE existing fields into V5** (pure add-on approach)
- 💡 **User requirement**: "Don't touch what works perfectly" → These fields ARE working!

---

#### 0.1 Revised Field Strategy (Option C: Integration)

**Objective**: Preserve working fields, integrate into V5, only delete truly dead fields

**NEW APPROACH - INTEGRATE INTO V5**:

**KEEP & INTEGRATE** (working, populated, actively used):
- ✅ `typical_openings` (text[]) → V5 `voice_profile.writing_examples.typical_openings`
  - Current data: 100% populated with real examples
  - Used by: Weekly Plan, Weekly Strategy, Post Helpers, Content Generation
  - Action: **Map directly into V5**, regenerate if empty
  
- ✅ `typical_closings` (text[]) → V5 `voice_profile.writing_examples.typical_closings`
  - Current data: 67% populated with CTAs
  - Used by: Weekly Plan, CTA selection, Post Helpers
  - Action: **Map directly into V5**, regenerate if empty
  
- ✅ `tone_keywords` (text[]) → Fallback when `tone_model.primary_keywords` empty
  - Current data: 33% populated
  - Used by: Quick Suggestions (fallback logic), Weekly Plan
  - Action: **Keep as database fallback**, migrate to V5 if present

- ✅ `tone_of_voice` (text) → V5 `voice_profile.voice.tone_of_voice`
- ✅ `tone_model` (JSONB) → V5 `voice_profile` (extract writing_rules, good_examples)
- ✅ `voice_constraints` (text) → V5 `voice_profile.voice.writing_principles`
- ✅ `never_say` (text[]) → V5 `voice_profile.guardrails.never_say`
- ✅ `signature_phrases` (text[]) → V5 `voice_profile.writing_examples.signature_phrases`
- ✅ `humor_level`, `formality`, `emoji_style`, `storytelling_style` → V5 `voice_profile.voice.*`

**DELETE ONLY TRULY DEAD FIELDS**:
- ❌ `do_not_say` (JSONB) - **NULL in 100% of rows**, never populated
  - Action: Remove code references (12 total), then delete column
  - Migration: Merge any historical data into `never_say`

**INVESTIGATE** (unexpected findings):
- ⚠️ `voice_options` (JSONB) - 33% populated but Sprint 1 supposedly removed it?
  - Action: Check Sprint 1 migration status, verify if residual data or incomplete migration
  - Decision: Pending investigation

**Timeline**: 1-2 hours for revised mapping

---

#### 0.2 Create Minimal Database Migration (Option C)

**Objective**: Remove ONLY truly dead field (`do_not_say`), add V5 metadata tracking

**Migration tasks**:

```sql
-- Migration: 20260508_integrate_voice_v5.sql
-- OPTION C: Integration approach - minimal deletions

-- 1. REMOVE ONLY TRULY DEAD FIELD
ALTER TABLE business_brand_profile 
  DROP COLUMN IF EXISTS do_not_say;  -- NULL in 100% of rows, never used

-- NOTE: Keeping these fields (contrary to original plan):
--   - typical_openings  (100% populated, 25 code refs)
--   - typical_closings  (67% populated, 20 code refs)
--   - tone_keywords     (33% populated, 15 code refs - fallback)
--   - voice_options     (33% populated - pending Sprint 1 investigation)

-- 2. ADD V5 INTEGRATION METADATA
ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS voice_v5_migrated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS voice_v5_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voice_v5_version TEXT DEFAULT 'v5.0';

-- 3. ADD INTEGRATION COMMENTS
COMMENT ON COLUMN business_brand_profile.typical_openings IS 
  'Example opening sentences. Integrated into brand_profile_v5.writing_examples.typical_openings. Still used by legacy code - do NOT delete.';
  
COMMENT ON COLUMN business_brand_profile.typical_closings IS 
  'Example closing CTAs. Integrated into brand_profile_v5.writing_examples.typical_closings. Still used by legacy code - do NOT delete.';
  
COMMENT ON COLUMN business_brand_profile.tone_keywords IS 
  'Simple personality keywords (fallback when tone_model.primary_keywords empty). Used by Quick Suggestions - do NOT delete.';

COMMENT ON COLUMN business_brand_profile.never_say IS 
  'Word-level guardrails (format: "word → replacement"). Consolidated from old never_say + do_not_say. Integrated into brand_profile_v5.guardrails.never_say.';
  
-- 4. MARK VOICE_OPTIONS FOR FUTURE INVESTIGATION
COMMENT ON COLUMN business_brand_profile.voice_options IS 
  'LEGACY: Dual-voice paradigm from old system. Sprint 1 intended to remove but 1/3 businesses still have data. Investigate before deleting.';
```

**Impact**:
- Database columns: **44 → 43** (only 1 field deleted, not 5)
- Data preservation: **100%** of working fields kept
- Code impact: **Minimal** (only remove `do_not_say` references)
- Breaking changes: **None** (all working systems preserved)

**Timeline**: 30 minutes to write + test migration

---

#### 0.3 Update Code References to Deleted Field Only

**Objective**: Remove references to `do_not_say` only (12 references)

**Files to update** (from grep search):

1. **Database queries** (remove `do_not_say` from SELECT):
   - [get-quick-suggestions/index.ts](supabase/functions/get-quick-suggestions/index.ts#L1306)
   - [get-weekly-strategy/index.ts](supabase/functions/get-weekly-strategy/index.ts)
   - [resolve-context.ts](supabase/functions/generate-text-from-idea/resolve-context.ts)

2. **Type definitions** (mark as deprecated):
   - [brand-voice.ts](supabase/functions/_shared/types/brand-voice.ts)
     - Add `@deprecated` to `do_not_say` field
     - Update helper functions to use `never_say` only
     - Remove `migrateDoNotSayToNeverSay()` (no longer needed - field deleted)

3. **Helper functions** (remove do_not_say logic):
   - [dagens-forslag-prompt-builder.ts](supabase/functions/_shared/dagens-forslag-prompt-builder.ts)
   - [strategy/phase2/phase2c.ts](supabase/functions/_shared/post-helpers/strategy/phase2/phase2c.ts)

**Search pattern** (verify 12 references):
```bash
grep -r "do_not_say" \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir="node_modules" --exclude-dir=".git" \
  | grep -v "migrations/" \
  | wc -l
```

**Expected result**: ~12 references (excluding migration files)

**Timeline**: 1-2 hours (much faster than original 3-4 hours)

---

### Phase 1: Assessment & Discovery

#### 1.1 Audit Existing Voice/Guardrails Systems

**Objective**: Map what already exists and where (POST-cleanup)

**Locations to review**:
- [x] `business_brand_profile` table schema - **NOW 38 columns** (down from 44)
  - Remaining: `tone_of_voice`, `tone_model`, `voice_constraints`, `never_say`, `signature_phrases`
  - Remaining: `humor_level`, `formality`, `emoji_style`, `storytelling_style`
  - New metadata: `voice_source`, `voice_last_generated_at`, `voice_generation_version`
- [ ] TypeScript types: Updated `brand-voice.ts` with deprecations
- [ ] AI Generation functions:
  - `voice-options-generator.ts` - **REFACTOR to single-voice**
  - `tone-of-voice-extractor.ts` - **SKIP website analysis path**
- [ ] Content consumption points:
  - `get-quick-suggestions/index.ts` - Updated queries (no dead fields)
  - Weekly Plan generator - Updated queries
  - Dagens Forslag generator - Updated queries

**Questions to answer**:
1. ✅ What fields exist in database? → **9 voice fields remain** (down from 13)
2. ✅ What fields are actually populated? → **All remaining fields populated**
3. ✅ Which fields are actively used? → **Audit complete via grep search**
4. ✅ Dead fields removed? → **5 columns dropped**
5. ❓ What's the current data quality? (populated rate, consistency)

---

#### 1.2 Map Old Structure → New V5 Structure

**Objective**: Design the bridge between cleaned legacy and V5

**Old System AFTER Phase 0 cleanup** (business_brand_profile - 9 voice fields):
```
tone_of_voice          → text (narrative rules)
tone_model             → JSONB {primary_keywords, writing_rules, formality, emoji_level, good_examples, avoid_examples}
voice_constraints      → text (hard rules)
never_say              → text[] (consolidated word-level bans)
signature_phrases      → text[] (brand phrases)
humor_level            → text (none/subtle/moderate/high)
formality              → text (casual/professional/formal)
emoji_style            → text (none/minimal/moderate/expressive)
storytelling_style     → text (minimal/some_context/detailed)

❌ DELETED: do_not_say, tone_keywords, typical_openings, typical_closings, voice_options
```

**New V5 Structure** (brand_profile_v5 - clean JSONB):
```json
{
  "voice": {
    "tone_of_voice": "string",           // ← OLD: tone_of_voice (text) OR AI-generated
    "formality": "informal",             // ← OLD: formality OR tone_model.formality_level
    "humor_level": "moderate",           // ← OLD: humor_level
    "storytelling_style": "anecdotal",   // ← OLD: storytelling_style
    "emoji_style": "moderate",           // ← OLD: emoji_style OR tone_model.emoji_level
    "writing_principles": "string",      // ← OLD: voice_constraints + tone_model.writing_rules[] (merge)
    "voice_confidence": 0.85,            // ← NEW: AI-generated or 0.7 for migrated
    "voice_reasoning": "string"          // ← NEW: AI explains voice choice
  },
  "writing_examples": {
    "typical_openings": ["string"],      // ← NEW: AI-generated (old field deleted)
    "typical_closings": ["string"],      // ← NEW: AI-generated (old field deleted)
    "signature_phrases": ["string"],     // ← OLD: signature_phrases (copy as-is)
    "examples_confidence": 0.75,         // ← NEW: calculated
    "examples_reasoning": "string"       // ← NEW: why these examples fit
  },
  "guardrails": {
    "never_say": ["string"],             // ← OLD: never_say (format: "word → replacement")
    "do_not_say": ["string"],            // ← NEW: AI-generated topic-level bans
    "guardrails_confidence": 0.9,        // ← NEW: calculated
    "guardrails_reasoning": "string"     // ← NEW: why these guardrails
  }
}
```

**Mapping Strategy** (REVISED - INTEGRATION APPROACH):

**DIRECT COPY** (100% preservation - NO AI regeneration):
- ✅ `typical_openings` → `writing_examples.typical_openings` (IF populated, else AI-generate)
  - Current: **100% populated** with real examples
  - Strategy: Direct copy from database, preserve existing content
- ✅ `typical_closings` → `writing_examples.typical_closings` (IF populated, else AI-generate)
  - Current: **67% populated** with CTAs
  - Strategy: Direct copy from database for 2/3 businesses, AI-generate for 1/3
- ✅ `signature_phrases` → `writing_examples.signature_phrases`
- ✅ `never_say` → `guardrails.never_say` (already includes migrated do_not_say data)
- ✅ `formality` → `voice.formality`
- ✅ `humor_level` → `voice.humor_level`
- ✅ `emoji_style` → `voice.emoji_style`
- ✅ `storytelling_style` → `voice.storytelling_style`
- ✅ `tone_of_voice` → `voice.tone_of_voice`

**CONSOLIDATE & TRANSFORM** (merge multiple sources):
- ⚙️ `voice_constraints` + `tone_model.writing_rules[]` → `voice.writing_principles`
  - Merge both sources into unified bullet points
  - Remove duplicates, format consistently
- ⚙️ `formality` + `tone_model.formality_level` → `voice.formality` (prefer formality field)
- ⚙️ `emoji_style` + `tone_model.emoji_level` → `voice.emoji_style` (prefer emoji_style field)

**GENERATE FROM SCRATCH** (only when legacy data missing):
- 🆕 `typical_openings` - AI-generate ONLY if database field NULL/empty (0% of cases currently)
- 🆕 `typical_closings` - AI-generate ONLY if database field NULL/empty (33% of cases currently)
- 🆕 `do_not_say` (topic-level) - Always AI-generated (NEW field, different from deleted JSONB!)
- 🆕 All confidence scores and reasoning text

**KEY CHANGES FROM ORIGINAL PLAN**:
1. ❌ **NOT deleting** `typical_openings` (was marked "unused" - docs were WRONG)
2. ❌ **NOT deleting** `typical_closings` (was marked "unused" - docs were WRONG)  
3. ❌ **NOT deleting** `tone_keywords` (actively used as fallback in production)
4. ✅ **Only deleting** `do_not_say` (verified NULL in 100% of rows)
5. ✅ **Preserving** existing examples instead of regenerating with AI

**Benefits of Integration Approach**:
- ✅ Zero data loss (100% preservation of working fields)
- ✅ Zero breaking changes (all 249 code references keep working)
- ✅ True "pure add-on" (no modifications to working systems)
- ✅ Faster migration (reuse 100% populated openings, 67% populated closings)
- ✅ Better content quality (preserves human-reviewed examples)

**Confidence Scoring Strategy**:
- `voice_confidence`: 1.0 for direct field copy, 0.8-0.9 for consolidated/merged
- `examples_confidence`: 1.0 for legacy data preservation, 0.7-0.9 for AI-generated
- `guardrails_confidence`: 1.0 for word-level (direct copy), 0.8-0.9 for topic-level (AI)

---

#### 1.3 Identify Code Reuse & Refactoring Opportunities

**Objective**: Extract reusable logic, simplify where possible

**Existing AI generation logic**:

1. **`voice-options-generator.ts`** - **REFACTOR REQUIRED**:
   - Current: Generates TWO voices (website + ai_enriched)
   - Lines 150-200: Signal analysis logic ✅ **REUSE**
     - Pricing → formality
     - Menu naming → personality
     - Ownership register detection
   - Lines 50-120: `ENRICHED_SCHEMA` prompt ⚠️ **SIMPLIFY**
     - Remove "Option A vs B" logic
     - Extract AI-enriched path only
     - Simplify verbose instructions (match V5 style)
   - **Refactor plan**:
     - Create new `voice-profile.ts` based on AI-enriched path
     - Copy signal analysis helper functions
     - Rewrite prompt in V5's concise 11-rule format
     - Drop website analysis completely

2. **`tone-of-voice-extractor.ts`** - **SKIP THIS FILE**:
   - Purpose: Extract voice from website content
   - Status: Not needed for V5 (menu/programme-driven only)
   - **Decision**: Don't use, rely on business data only

3. **Type definitions** (`brand-voice.ts`) - **UPDATE & DEPRECATE**:
   - Current: 100+ line interface with deprecated fields
   - **Refactor plan**:
     - Mark old `BrandVoice` as `@deprecated`
     - Create new `V5VoiceProfile` interface
     - Add JSDoc warnings for deleted fields
     - Add migration helpers

**Refactoring decisions**:
1. ✅ **Extract signal analysis** from voice-options-generator.ts
2. ✅ **Simplify prompt** - rewrite in V5's concise style
3. ✅ **Single voice only** - drop dual-option paradigm
4. ❌ **Skip website extraction** - not needed for V5
5. ✅ **Deprecate old types** - clear migration path

---

#### 1.4 Analyze Data Quality & Completeness

**Objective**: Understand what data is available for migration

**Query to run**:
```sql
SELECT 
  COUNT(*) as total_businesses,
  COUNT(tone_of_voice) as has_tone_of_voice,
  COUNT(tone_model) as has_tone_model,
  COUNT(never_say) as has_never_say,
  COUNT(signature_phrases) as has_signature_phrases,
  COUNT(typical_openings) as has_typical_openings,
  COUNT(formality) as has_formality,
  COUNT(humor_level) as has_humor_level,
  COUNT(do_not_say) as has_do_not_say,
  AVG(CASE WHEN tone_of_voice IS NOT NULL THEN 1 ELSE 0 END) * 100 as pct_tone_of_voice,
  AVG(CASE WHEN never_say IS NOT NULL THEN 1 ELSE 0 END) * 100 as pct_never_say
FROM business_brand_profile
WHERE business_id IN (
  SELECT id FROM businesses WHERE deleted_at IS NULL
);
```

**Expected insights**:
- How many businesses have voice data?
- Which fields have highest/lowest population rate?
- Is `do_not_say` truly NULL everywhere? (docs say yes)

---

### Phase 2: Design & Architecture

#### 2.1 Database Schema Design

**Objective**: Plan V5 storage structure (post-cleanup)

**Strategy: Pure JSONB in V5**
- Store all voice/examples/guardrails in `brand_profile_v5` JSONB only
- Keep cleaned old columns (9 fields) for backward compatibility (read-only)
- No new database columns needed
- Advantage: Clean V5 structure, no schema bloat
- Migration: Old columns → V5 JSONB is one-way (V5 becomes source of truth)

**Metadata tracking**:
```sql
-- Already added in Phase 0.2
voice_source                  -- 'legacy' | 'v5_generated' | 'manual'
voice_last_generated_at       -- Timestamp
voice_generation_version      -- 'v1' | 'v5'
```

**Timeline**: No additional time (schema defined in Phase 0)

---

#### 2.2 TypeScript Type System

**Objective**: Update types for V5 + deprecate old

**Files to update**:

1. **`src/types/brand-profile-v5.ts`** - Add voice sections
```typescript
export interface V5VoiceProfile {
  voice: {
    tone_of_voice: string
    formality: 'informal' | 'semi-formal' | 'formal'
    humor_level: 'low' | 'moderate' | 'high'
    storytelling_style: 'anecdotal' | 'direct' | 'descriptive'
    emoji_style: 'minimal' | 'moderate' | 'expressive'
    writing_principles: string
    voice_confidence: number
    voice_reasoning: string
  }
  writing_examples: {
    typical_openings: string[]
    typical_closings: string[]
    signature_phrases: string[]
    examples_confidence: number
    examples_reasoning: string
  }
  guardrails: {
    never_say: string[]       // Format: "word → replacement"
    do_not_say: string[]      // Topic-level bans
    guardrails_confidence: number
    guardrails_reasoning: string
  }
}

export interface CompleteBrandProfile {
  identity: IdentityProfile   // Existing
  voice: V5VoiceProfile       // NEW
  // ... other sections
}
```

2. **`supabase/functions/_shared/types/brand-voice.ts`** - Deprecate old
```typescript
/**
 * @deprecated Use V5VoiceProfile from brand-profile-v5.ts instead
 * Legacy BrandVoice interface maintained for backward compatibility only
 * 
 * MIGRATION PATH:
 * - Read from brand_profile_v5.voice instead of direct columns
 * - Fields removed in Phase 0: do_not_say, tone_keywords, typical_openings, typical_closings
 */
export interface BrandVoice {
  // Remaining fields only...
  tone_of_voice?: string
  formality?: 'casual' | 'professional' | 'formal'
  humor_level?: 'none' | 'subtle' | 'playful' | 'bold'
  // ... etc
}
```

3. **New file: `supabase/functions/_shared/brand-profile/voice-profile.ts`**
   - Layer 3B: Voice generation logic
   - Input: Same as identity-profile.ts + identity output for context
   - Output: `V5VoiceProfile`
   - Includes signal analysis helpers (extracted from voice-options-generator.ts)

**Timeline**: 2-3 hours

---

#### 2.3 AI Prompt Design - SIMPLIFIED

**Objective**: Create single-voice prompt in V5's concise style

**Approach**: Single Layer 3B call (voice + examples + guardrails together)

**Prompt structure** (matching identity-profile.ts style):

```typescript
const VOICE_SYSTEM_PROMPT = `Du er brand voice specialist for restauranter og caféer.

DIN OPGAVE:
Generer voice, writing examples, og guardrails baseret på FAKTISKE data og identity profile.
Output skal være valid JSON format.

KRITISKE PRINCIPPER:

═══════════════════════════════════════════════════════════
SECTION 1: VOICE & TONE GENERATION
═══════════════════════════════════════════════════════════

REGEL 1: VOICE AFLEDT FRA POSITIONING
- Casual positioning → informal formality + moderate humor
- Fine dining → formal + low humor  
- Family-friendly → moderate emoji
- Walk-in only → approachable tone
- Late hours (>23:00) → playful/edgy tone

REGEL 2: FORMALITY BASERET PÅ PRISNIVEAU
- Budget (retter <75kr) → informal
- Mid-range (75-150kr) → semi-formal
- Premium (>150kr) → formal

REGEL 3: STORYTELLING FRA LOCATION
- Waterfront/nature location → descriptive storytelling
- Urban/city centre → direct/concise
- Neighborhood café → anecdotal storytelling

REGEL 4: EMOJI BASERET PÅ KATEGORI
- Bar/nightlife → moderate/expressive
- Fine dining → minimal/none
- Casual café → moderate

REGEL 5: WRITING PRINCIPLES MÅ VÆRE SPECIFIKKE
Kombiner voice_constraints + tone_model.writing_rules til konkrete principper.
Format: "Vi [handling] fordi [reason based on business signals]"
Eksempel: "Vi bruger konkrete tidspunkter (kl. 9, kl. 21) fordi vi har 4 dagsprogrammer"

═══════════════════════════════════════════════════════════
SECTION 2: WRITING EXAMPLES GENERATION
═══════════════════════════════════════════════════════════

REGEL 6: OPENINGS MATCHER FORMALITY
- Informal: "Tænk dig:", "Det her er perfekt til:", "Kom til [programme]"
- Semi-formal: "Vi byder på:", "I dag serverer vi:", "Oplev [dish]"  
- Formal: "Vi præsenterer:", "Vores køkken tilbyder:", "Velkommen til [programme]"

REGEL 7: CLOSINGS INKLUDERER HANDLING
- Walk-in: "Kom forbi i dag", "Vi ses ved bordet"
- Reservationer: "Book dit bord nu", "Ring for reservering"
- Late hours: "Vi er åbne til [time]", "Kom forbi i aften"

REGEL 8: SIGNATURE PHRASES FRA FAKTISKE DATA
- Location reference: Use exact phrase (e.g., "ved åen")
- Menu items: Actual dish names (e.g., "hjemmelavet granola")
- Programmes: Actual programme names (e.g., "fra brunch til bar")
- Suppliers: If supplier_analysis exists, mention verified names

═══════════════════════════════════════════════════════════
SECTION 3: GUARDRAILS (SAFETY RULES)
═══════════════════════════════════════════════════════════

REGEL 9: CRITICAL GUARDRAILS (OBLIGATORISKE)
IF programme includes "Morgenmad/Brunch":
  never_say MUST include: "morgenmad → ALWAYS use 'brunch'"

IF local_location_reference exists:
  do_not_say MUST include: "Never elaborate location beyond '[exact reference]'"

IF positioning is casual:
  never_say MUST include: "fine dining → we are casual, not formal"

IF any programme is walk-in only:
  do_not_say MUST include: "No 'reservationer' for [programme name]"

REGEL 10: ADDITIONAL WORD-LEVEL BANS
Generate 5-10 never_say rules in format: "banned word → replacement"
Examples:
- "billig → use 'god værdi' or 'fair pris'"
- "discount → describe value directly"
- "deal → be specific about offering"

REGEL 11: TOPIC-LEVEL BANS
Generate 3-7 do_not_say rules (topics/approaches to avoid)
Examples:
- "Competition or price comparisons"
- "Health claims without verification"
- "Superlatives without evidence ('bedste', 'perfekte')"

OUTPUT FORMAT:
{
  "voice": {
    "tone_of_voice": "...",
    "formality": "informal|semi-formal|formal",
    "humor_level": "low|moderate|high",
    "storytelling_style": "anecdotal|direct|descriptive",
    "emoji_style": "minimal|moderate|expressive",
    "writing_principles": "...",
    "voice_confidence": 0.0-1.0,
    "voice_reasoning": "..."
  },
  "writing_examples": {
    "typical_openings": ["...", "...", "..."],
    "typical_closings": ["...", "...", "..."],
    "signature_phrases": ["...", "...", "..."],
    "examples_confidence": 0.0-1.0,
    "examples_reasoning": "..."
  },
  "guardrails": {
    "never_say": ["word → replacement", ...],
    "do_not_say": ["topic", ...],
    "guardrails_confidence": 0.0-1.0,
    "guardrails_reasoning": "..."
  }
}
`
```

**Key simplifications vs old system**:
- ✅ 11 concise rules (vs verbose paragraph instructions)
- ✅ Clear derivation logic (formality from price, emoji from category)
- ✅ Single voice output (no Option A vs B)
- ✅ Matches identity-profile.ts style
- ✅ No "differentiation test" verbosity

**Model settings**:
```typescript
model: 'gpt-4o'
temperature: 0.1  // Match identity generation
max_tokens: 1500  // Slightly more than identity (3 sections)
```

**Timeline**: 3-4 hours to write + test prompt

---

#### 2.4 Integration Points Planning

**Objective**: Plan how V5 integrates with content systems

**Consumption points**:
1. **Weekly Plan Generator**
   - Currently reads: `tone_of_voice`, `signature_phrases`, `never_say`
   - Migration: Read from `brand_profile_v5.voice.*` instead
   - Fallback: If V5 empty, read old columns

2. **Dagens Forslag Generator**
   - Currently reads: `tone_model`, `voice_constraints`, `typical_openings`
   - Migration: Read from `brand_profile_v5.writing_examples.*`
   - Fallback: Same as above

3. **Dashboard UI**
   - Currently displays: Old columns
   - Migration: Display V5 data, allow editing
   - Two-way sync: Edit in UI → update V5 → optionally update old columns

**Fallback Strategy**:
```typescript
// Pseudo-code for graceful fallback
function getVoice(businessId: string) {
  const profile = await fetchBrandProfile(businessId)
  
  // Try V5 first
  if (profile.brand_profile_v5?.voice) {
    return profile.brand_profile_v5.voice
  }
  
  // Fallback to old columns
  return {
    tone_of_voice: profile.tone_of_voice,
    formality: profile.formality,
    humor_level: profile.humor_level,
    // ... map old columns
  }
}
```

---

### Phase 3: Implementation Phases

#### 3.1 Phase 3A: Foundation (TypeScript & Database)

**Tasks**:
- [ ] Update `brand-profile-v5.ts` types with voice/examples/guardrails sections
- [ ] Create `voice-profile.ts` generation function (stub version)
- [ ] Add V5 voice section to database (JSONB, no migration needed)
- [ ] Write migration query to copy old data → V5 format (testing only)

**Deliverables**:
- TypeScript compiles with new types
- Database accepts V5 voice structure
- Test script: `scripts/test-v5-voice-migration.ts`

**Success criteria**:
- ✅ Types are correct
- ✅ Can write V5 voice data to database
- ✅ Can read it back correctly

**Timeline**: ~2-4 hours

---

#### 3.2 Phase 3B: AI Generation Logic

**Tasks**:
- [ ] Design Layer 3B prompt (voice + examples + guardrails)
- [ ] Implement `generateVoiceProfile()` function
- [ ] Add confidence scoring logic
- [ ] Add reasoning generation ("why this voice")
- [ ] Test with Café Faust (known good case)

**Key decisions**:
- ❓ Reuse `voice-options-generator.ts` prompt or create new?
- ❓ Single call vs two calls (3A + 3B)?
- ❓ What temperature setting? (suggest 0.1 like identity)

**Deliverables**:
- Working `voice-profile.ts` function
- Test script: `scripts/test-voice-generation.ts`
- Validation: Voice matches business characteristics

**Success criteria**:
- ✅ Generates all 3 sections (voice, examples, guardrails)
- ✅ Output is factual (no hallucinations)
- ✅ Formality/humor match business positioning
- ✅ Guardrails include critical rules (brunch, location, etc.)

**Timeline**: ~4-6 hours

---

#### 3.3 Phase 3C: V5 Generator Integration

**Tasks**:
- [ ] Update `brand-profile-generator-v5/index.ts`
- [ ] Add Layer 3B call after Layer 3A (identity)
- [ ] Pass identity output → voice generation (for context)
- [ ] Merge identity + voice → complete Layer 3
- [ ] Update database write to store voice sections
- [ ] Test end-to-end generation

**Code location**:
`supabase/functions/brand-profile-generator-v5/index.ts`
- Line ~200-250: After Layer 3A identity generation
- Add: Layer 3B voice generation call
- Line ~400-450: Database update section
- Update: Write voice to `brand_profile_v5.voice`

**Deliverables**:
- Updated V5 generator function
- Deployed to Edge Functions
- Test: Regenerate Café Faust profile

**Success criteria**:
- ✅ V5 generator creates 4 sections (identity + voice + examples + guardrails)
- ✅ All data stored in `brand_profile_v5` JSONB
- ✅ No breaking changes to existing Layer 1, 2, 4

**Timeline**: ~3-4 hours

---

#### 3.4 Phase 3D: Content System Integration

**Tasks**:
- [ ] Update Weekly Plan to read V5 voice
- [ ] Update Dagens Forslag to read V5 writing_examples
- [ ] Add fallback logic (V5 → old columns)
- [ ] Update prompt injection to use new structure
- [ ] Test content generation quality

**Files to update**:
- Weekly Plan generator (location TBD - need to find)
- Dagens Forslag: `get-quick-suggestions/index.ts`
  - Line ~1306: Database query (add `brand_profile_v5`)
  - Line ~1400-1500: Context building (read V5 voice)

**Prompt changes**:
```typescript
// OLD:
VOICE: ${brandProfile.tone_of_voice}
SIGNATURE PHRASES: ${brandProfile.signature_phrases.join(', ')}

// NEW:
VOICE: ${brandProfile.brand_profile_v5.voice.tone_of_voice}
FORMALITY: ${brandProfile.brand_profile_v5.voice.formality}
WRITING PRINCIPLES: ${brandProfile.brand_profile_v5.voice.writing_principles}
SIGNATURE PHRASES: ${brandProfile.brand_profile_v5.writing_examples.signature_phrases.join(', ')}
NEVER SAY: ${brandProfile.brand_profile_v5.guardrails.never_say.join(', ')}
```

**Deliverables**:
- Updated content generators
- A/B test: Old voice vs V5 voice content quality
- Documentation: Integration guide updates

**Success criteria**:
- ✅ Content generators read V5 voice successfully
- ✅ Generated content matches expected tone
- ✅ Guardrails are enforced (no "morgenmad", no elaborated locations)
- ✅ Fallback works when V5 is empty

**Timeline**: ~4-6 hours

---

#### 3.5 Phase 3E: Migration & Deployment

**Tasks**:
- [ ] Create migration script: Old columns → V5 structure
- [ ] Run migration for all businesses with voice data
- [ ] Validate migration quality (spot checks)
- [ ] Deploy V5 generator to production
- [ ] Monitor for errors/regressions
- [ ] Update documentation

**Migration script**:
`scripts/migrate-voice-to-v5.ts`
```typescript
// Pseudo-code
for each business in business_brand_profile {
  if (has old voice data) {
    v5Voice = {
      voice: {
        tone_of_voice: old.tone_of_voice,
        tone_keywords: old.tone_keywords,
        formality: old.formality,
        humor_level: old.humor_level,
        storytelling_style: old.storytelling_style,
        emoji_style: old.emoji_style,
        writing_principles: combineRules(old.voice_constraints, old.tone_model),
        voice_confidence: 0.7, // conservative
        voice_reasoning: "Migrated from legacy system"
      },
      writing_examples: {
        typical_openings: old.typical_openings,
        typical_closings: old.typical_closings,
        signature_phrases: old.signature_phrases,
        examples_confidence: 0.7,
        examples_reasoning: "Migrated from legacy system"
      },
      guardrails: {
        never_say: old.never_say,
        do_not_say: extractFromOld(old.do_not_say), // may be empty
        guardrails_confidence: 0.8,
        guardrails_reasoning: "Migrated from legacy system"
      }
    }
    
    update brand_profile_v5 with v5Voice
  }
}
```

**Validation**:
- Compare 10-20 businesses: Old voice vs V5 voice
- Check for data loss (missing fields)
- Check for data corruption (malformed JSON)

**Deliverables**:
- Migration script (tested)
- Migration log (success/failure counts)
- Updated BRAND-PROFILE-V5-INTEGRATION-GUIDE.md

**Success criteria**:
- ✅ 95%+ businesses migrated successfully
- ✅ No data loss
- ✅ Content generation quality maintained or improved

**Timeline**: ~3-4 hours

---

### Phase 4: Testing & Validation

#### 4.1 Unit Testing

**Test cases**:
1. **Voice generation**:
   - Test: Café Faust → generates appropriate casual voice
   - Test: Fine dining restaurant → generates formal voice
   - Test: Bar with late hours → generates playful voice
   
2. **Guardrails logic**:
   - Test: "Morgenmad/Brunch" programme → never_say includes "morgenmad"
   - Test: local_location_reference="ved åen" → do_not_say includes location rule
   - Test: Casual positioning → never_say includes "fine dining"
   
3. **Examples generation**:
   - Test: Openings match formality level
   - Test: Closings include appropriate CTAs
   - Test: Signature phrases use actual menu items

**Test script**: `scripts/validate-voice-profile.ts`

---

#### 4.2 Integration Testing

**Test cases**:
1. **End-to-end V5 generation**:
   - Generate complete profile (Layers 1-4)
   - Verify voice section populated
   - Check: No null fields, valid confidence scores
   
2. **Content generation**:
   - Generate Weekly Plan using V5 voice
   - Generate Dagens Forslag using V5 writing_examples
   - Compare quality: V5 vs old system
   
3. **Fallback testing**:
   - Empty V5 → should use old columns
   - Partial V5 → should merge with old data

---

#### 4.3 Quality Validation

**Metrics to track**:
- Voice appropriateness (manual review)
- Guardrails completeness (% with critical rules)
- Examples relevance (match business type?)
- Content quality impact (A/B test)

**Validation script**: `scripts/final-voice-validation.ts`
- Similar to existing `final-validation.ts`
- 5 test suite for voice:
  1. ✅ Voice formality matches positioning
  2. ✅ Critical guardrails present
  3. ✅ Writing examples factual (no hallucinations)
  4. ✅ Signature phrases use actual menu items
  5. ✅ Tone consistency across sections

---

### Phase 5: Documentation & Handoff

#### 5.1 Technical Documentation

**Documents to create/update**:
- [x] LAYER3-VOICE-GUARDRAILS-IMPLEMENTATION.md (this doc)
- [ ] BRAND-PROFILE-V5-INTEGRATION-GUIDE.md (add voice sections)
- [ ] API documentation (voice section schema)
- [ ] Database schema documentation

---

#### 5.2 User Documentation

**For business owners**:
- How voice is generated (transparency)
- How to edit voice settings (future: dashboard UI)
- How voice affects content quality

**For developers**:
- How to read V5 voice in content systems
- Fallback strategy guide
- Migration guide (if adding new businesses)

---

### Risk Analysis & Mitigation

#### Risk 1: Data Quality - Old System

**Risk**: Old voice data may be incomplete/inconsistent
**Probability**: HIGH (docs mention `do_not_say` is NULL everywhere)
**Impact**: MEDIUM (affects migration quality)

**Mitigation**:
- Run data audit first (Phase 1.4)
- Set conservative confidence scores for migrated data (0.7)
- Mark migrated data with metadata: `source: "migrated_from_legacy"`
- Allow regeneration to improve quality

---

#### Risk 2: Prompt Complexity

**Risk**: Adding 3 sections to Layer 3 may exceed token limits
**Probability**: MEDIUM
**Impact**: HIGH (generation fails)

**Mitigation**:
- Option 1: Two separate API calls (3A identity, 3B voice)
- Option 2: Increase max_tokens from 1000 → 2000
- Option 3: Use streaming to handle large outputs
- Monitor token usage during testing

---

#### Risk 3: Breaking Changes

**Risk**: V5 changes break existing content systems
**Probability**: LOW (if fallback implemented)
**Impact**: HIGH (content generation stops)

**Mitigation**:
- Implement fallback logic (V5 → old columns)
- Test extensively before rollout
- Deploy gradually (test businesses first)
- Keep old columns populated during transition
- Monitor error logs after deployment

---

#### Risk 4: Voice Quality Regression

**Risk**: AI-generated voice worse than old system
**Probability**: MEDIUM
**Impact**: HIGH (content quality decreases)

**Mitigation**:
- A/B test: Old voice vs V5 voice (sample 20 businesses)
- Manual review by stakeholders
- Iterate on prompt based on feedback
- Allow manual override (dashboard editing)
- Keep temperature low (0.1) to reduce creativity

---

### Success Metrics

**Technical metrics**:
- ✅ 100% of businesses have V5 voice section
- ✅ 95%+ migration success rate
- ✅ <2% error rate in voice generation
- ✅ Voice generation time <3 seconds (per business)

**Quality metrics**:
- ✅ 90%+ voice formality matches positioning
- ✅ 100% critical guardrails present (brunch, location)
- ✅ 0% hallucinated facilities/services in examples
- ✅ Content generation quality maintained or improved

**Integration metrics**:
- ✅ Weekly Plan uses V5 voice successfully
- ✅ Dagens Forslag uses V5 writing_examples successfully
- ✅ Fallback logic working (0 errors when V5 empty)

---

### Timeline Summary - OPTION C (Integration Approach - REVISED)

**REVISED PLAN** (May 8, 2026 - Post-Audit)

| Phase | Description | Estimated Time |
|-------|-------------|----------------|
| **0. Minimal Database Cleanup** | Delete ONLY `do_not_say`, add V5 metadata | **2-3 hours** ⬇️ |
| 0.1 | Revised field strategy (integration vs deletion) | 1 hour |
| 0.2 | Create minimal migration script (1 field deletion) | 30 min |
| 0.3 | Update code references (do_not_say only - 12 refs) | 1-2 hours |
| **1. Assessment** | Audit (integration-focused), map existing→V5 | **3-4 hours** ⬇️ |
| 1.1 | Audit existing systems (simpler - no cleanup) | 1 hour |
| 1.2 | Map old→new V5 (integration, not regeneration) | 1-2 hours |
| 1.3 | Identify code reuse (simpler - keep fallbacks) | 1 hour |
| **2. Design** | Schema, types, simplified prompts | **4-6 hours** ⬇️ |
| 2.1 | V5 schema design (minimal changes) | 1 hour |
| 2.2 | TypeScript types (integration helpers) | 1-2 hours |
| 2.3 | AI prompt design (conditional generation) | 2-3 hours |
| **3A. Foundation** | TypeScript + integration setup | **2-3 hours** ⬇️ |
| **3B. AI Logic** | Voice generation (conditional - only if needed) | **3-5 hours** ⬇️ |
| 3B.1 | Integration logic (check existing before AI) | 1-2 hours |
| 3B.2 | Conditional AI generation (only for missing fields) | 2-3 hours |
| **3C. V5 Integration** | Update V5 generator | **3-4 hours** |
| **3D. Content Integration** | Weekly Plan, Dagens Forslag | **2-3 hours** ⬇️ |
| 3D.1 | Update queries (remove do_not_say only) | 30 min |
| 3D.2 | Wire up guardrails to prompts | 1-2 hours |
| 3D.3 | Add V5 fallback logic (keep legacy fallbacks) | 30 min |
| **3E. Migration** | Integrate old→V5 (simple copy, not regeneration) | **2-3 hours** ⬇️ |
| 3E.1 | Write integration script (direct copy strategy) | 1 hour |
| 3E.2 | Run migration + validation | 1-2 hours |
| **4. Testing** | Unit, integration, quality validation | **4-6 hours** |
| 4.1 | Unit tests (integration + conditional AI) | 2-3 hours |
| 4.2 | Integration tests (verify legacy compatibility) | 1-2 hours |
| 4.3 | Regression testing (all 249 code refs still work) | 1 hour |
| **5. Documentation** | Tech docs, integration guide | **2-3 hours** ⬇️ |
| **TOTAL** | | **25-37 hours** ⬇️ **40-60% FASTER!** |

**Comparison vs Original Plans**:
- ❌ Option A (Minimal): 29-43 hours - Still deleted working fields
- ❌ Option B (Thorough): 42-60 hours - Deleted too many fields
- ✅ **Option C (Integration)**: **25-37 hours** - Preserves working data!

**Time Savings Breakdown**:
- ⬇️ Phase 0: **6-9h → 2-3h** (only delete 1 field, not 5)
- ⬇️ Phase 1: **4-6h → 3-4h** (simpler mapping, no cleanup)
- ⬇️ Phase 2: **5-7h → 4-6h** (less schema changes)
- ⬇️ Phase 3B: **5-7h → 3-5h** (conditional AI, not always)
- ⬇️ Phase 3D: **5-7h → 2-3h** (12 refs vs 249 refs)
- ⬇️ Phase 3E: **4-5h → 2-3h** (direct copy vs regeneration)

**Why Option C is Fastest**:
1. ✅ **Zero data loss** - Copy existing fields instead of AI-regenerating
2. ✅ **Minimal code changes** - 12 references to update (do_not_say) vs 249 (all fields)
3. ✅ **No breaking changes** - All working systems keep working
4. ✅ **True "pure add-on"** - Matches user requirement perfectly
5. ✅ **Better quality** - Preserves 100% populated openings, 67% populated closings

---

### Revised Implementation Summary

**WHAT CHANGED AFTER AUDIT** (May 8, 2026):

**ORIGINAL PLAN (Option B - BLOCKED)**:
- Delete 5 fields: do_not_say, tone_keywords, typical_openings, typical_closings, voice_options
- Regenerate all examples with AI
- Update 249 code references
- 42-60 hours timeline

**REVISED PLAN (Option C - APPROVED)**:
- Delete 1 field: do_not_say (only NULL field)
- **KEEP** typical_openings (100% populated, 25 refs)
- **KEEP** typical_closings (67% populated, 20 refs)
- **KEEP** tone_keywords (fallback logic, 15 refs)
- **INTEGRATE** into V5 instead of regenerating
- Update 12 code references (do_not_say only)
- **25-37 hours timeline** (40% faster!)

**WHY THE CHANGE**:
- Database audit revealed fields marked "unused" are ACTIVELY USED
- 249 grep references found across codebase
- 100% of businesses have populated typical_openings
- User requirement: "Don't touch what works perfectly"

**BENEFITS OF OPTION C**:
1. ✅ **Faster delivery** - 25-37 hours vs 42-60 hours
2. ✅ **Zero risk** - No breaking changes to production
3. ✅ **Higher quality** - Preserves human-reviewed examples
4. ✅ **True add-on** - Matches user constraint perfectly
5. ✅ **Cleaner migration** - Simple copy vs complex regeneration

---

## Key Integration Decisions (Option C)

### 1. **Database Cleanup** ✅ HIGH VALUE

**What's being removed**:
- `do_not_say` (JSONB) - NULL everywhere, never populated
- `tone_keywords` (text[]) - Redundant with tone_model.primary_keywords
- `typical_openings` (text[]) - Marked "unused" in docs
- `typical_closings` (text[]) - Marked "unused" in docs
- `voice_options` (JSONB) - Dual-voice paradigm being dropped

**Why this matters**:
- Prevents zombie fields from surfacing in future code
- Reduces cognitive load (9 fields instead of 14)
- Clear migration path (old columns → V5 JSONB)
- Database query performance (fewer columns to scan)

**Risk mitigation**:
- Keep data in V5 JSONB for 90 days as safety net
- Add database comments explaining what was removed & why
- Comprehensive grep search before deletion

---

### 2. **Single-Voice Paradigm** ✅ HIGH VALUE

**Old system**: Generate TWO voices, user picks one
```typescript
VoiceOptions {
  options: {
    website: VoiceOption,      // From website content
    ai_enriched: VoiceOption   // From menu/signals
  },
  recommended: 'website' | 'ai_enriched'
}
```

**New V5 system**: Generate ONE voice
```typescript
V5VoiceProfile {
  voice: {...},
  writing_examples: {...},
  guardrails: {...}
}
```

**Benefits**:
- 50% cost savings (1 OpenAI call vs 2)
- Simpler UX (no choice paralysis)
- Faster generation (<3s vs ~5s)
- Clearer source of truth

**Trade-off**:
- Lose website-based voice option
- **Mitigation**: V5 is menu/programme-driven (more accurate anyway)

---

### 3. **Prompt Simplification** ✅ MEDIUM VALUE

**Old style** (voice-options-generator.ts):
```typescript
"<2-4 danske ord der beskriver stemmen — KUN ord der er sande for 
DENNE virksomhed men ikke for en tilfældig café to gader væk. 
Brug ALDRIG 'alsidig', 'mangfoldig', 'varieret', 'nærværende', 
'indbydende', 'autentisk', 'hyggelig'. Find i stedet ord der peger 
på stedet konkret: beliggenhed, specifikke retter, åbningstider, koncept..."

"DIFFERENTIERINGSTEST (OBLIGATORISK): Stil spørgsmålet 'Kan en 
tilfældig café to gader væk bruge denne regel om sig selv?' — hvis 
ja, er reglen for generisk..."
```

**New V5 style** (matching identity-profile.ts):
```typescript
REGEL 1: VOICE AFLEDT FRA POSITIONING
- Casual positioning → informal formality + moderate humor
- Fine dining → formal + low humor

REGEL 2: FORMALITY BASERET PÅ PRISNIVEAU
- Budget (<75kr) → informal
- Mid-range (75-150kr) → semi-formal
- Premium (>150kr) → formal
```

**Benefits**:
- Easier to understand & maintain
- Consistent with existing V5 prompts
- Clearer derivation logic
- Less AI "creativity" (more deterministic)

**Risk**:
- Output quality might change
- **Mitigation**: Extensive A/B testing (Phase 4)

---

### 4. **Consolidated Guardrails** ✅ HIGH VALUE

**Old system**: 3 separate systems, none working
```
never_say[]          // AI-generated, in DB, NOT used in prompts
do_not_say (JSONB)   // Always NULL, never populated
buildNeverSayList()  // File-based function, never called
```

**New V5 system**: Single source, actually enforced
```json
{
  "guardrails": {
    "never_say": ["word → replacement"],  // Word-level bans
    "do_not_say": ["topic"],              // Topic-level bans
    "source": "v5_generated"
  }
}
```

**Implementation**:
```typescript
// In content generation prompt
FORBIDDEN WORDS:
${brandProfile.brand_profile_v5.guardrails.never_say.map(rule => `❌ ${rule}`).join('\n')}

FORBIDDEN TOPICS:
${brandProfile.brand_profile_v5.guardrails.do_not_say.map(topic => `❌ ${topic}`).join('\n')}
```

**Benefits**:
- Guardrails finally enforced (they exist but unused now!)
- Single source of truth
- Clear format (word → replacement)

---

### 5. **Signal Analysis Extraction** ✅ MEDIUM VALUE

**Current**: Signal analysis buried in voice-options-generator.ts
**New**: Extracted to reusable helpers

```typescript
// Extract to: voice-profile-helpers.ts

export function deriveFormalityFromPricing(avgPrice: number): Formality {
  if (avgPrice < 75) return 'informal'
  if (avgPrice < 150) return 'semi-formal'
  return 'formal'
}

export function deriveEmojiStyleFromCategory(category: string): EmojiStyle {
  if (category.includes('fine dining')) return 'minimal'
  if (category.includes('bar') || category.includes('nightlife')) return 'expressive'
  return 'moderate'
}

export function deriveStorytellingFromLocation(areaType: string): StorytellingStyle {
  if (areaType === 'waterfront' || areaType === 'nature') return 'descriptive'
  if (areaType === 'urban' || areaType === 'city_centre') return 'direct'
  return 'anecdotal'
}
```

**Benefits**:
- Testable logic (unit tests for derivation rules)
- Reusable across V5 layers
- Clear business logic (not hidden in prompts)
- Can evolve independently

---

## Risks & Mitigation (Option B)

### Risk 1: Database Migration Breaks Production

**Probability**: LOW  
**Impact**: CRITICAL

**Mitigation**:
1. Test migration on staging database first
2. Take database backup before migration
3. Keep deleted field data in V5 JSONB (safety net)
4. Rollback plan: Restore columns from V5 if needed
5. Monitor error logs 24h after deployment

---

### Risk 2: Code References to Deleted Fields Surface Later

**Probability**: MEDIUM  
**Impact**: HIGH

**Mitigation**:
1. Comprehensive grep search before deletion:
   ```bash
   grep -r "do_not_say\|tone_keywords\|typical_openings\|typical_closings" \
     --include="*.ts" --include="*.tsx" --include="*.sql" --include="*.md"
   ```
2. Add TypeScript deprecation warnings:
   ```typescript
   /** @deprecated Field removed in Phase 0. Use brand_profile_v5.guardrails.do_not_say */
   do_not_say?: never
   ```
3. Add database-level comments:
   ```sql
   COMMENT ON COLUMN ... IS 'REMOVED 2026-05-08. Migrated to brand_profile_v5.guardrails'
   ```
4. Keep migration reversible for 90 days

---

### Risk 3: Prompt Simplification Reduces Output Quality

**Probability**: MEDIUM  
**Impact**: MEDIUM

**Mitigation**:
1. A/B test: Old prompt vs new prompt (20 businesses)
2. Manual review by stakeholders
3. Metrics: Compare formality accuracy, guardrails completeness
4. Fallback: Keep old prompt as "verbose mode" if needed
5. Iterate based on test results before full rollout

---

### Risk 4: Single-Voice Approach Too Restrictive

**Probability**: LOW  
**Impact**: LOW

**Mitigation**:
1. V5 voice is data-driven (more accurate than website extraction)
2. Allow manual override in dashboard (future feature)
3. Voice regeneration always available (re-run Layer 3B)
4. If needed later: Can add "voice variants" without dual-option paradigm

---

### Risk 5: Timeline Overrun (+13-17 hours overhead)

**Probability**: MEDIUM  
**Impact**: LOW (project timeline dependent)

**Mitigation**:
1. Phase 0 (cleanup) can be done in parallel with other work
2. Some refactoring tasks are "nice to have" (can defer if needed)
3. Core functionality delivery timeline: Same as Option A (just cleaner)
4. Buffer: Add 10% contingency (4-6 hours) for unexpected issues

---

### Next Steps (Immediate) - OPTION B APPROVED

**BEFORE writing any code**:

1. **Run comprehensive field usage audit** (Phase 0.1)
   ```bash
   # Search for all references to fields marked for deletion
   cd "/Users/olebaek/Library/Mobile Documents/com~apple~CloudDocs/Test P2G 1-iCloud"
   
   grep -r "do_not_say\|tone_keywords\|typical_openings\|typical_closings\|voice_options" \
     --include="*.ts" --include="*.tsx" --include="*.sql" \
     --exclude-dir="node_modules" --exclude-dir=".git" \
     > field-usage-audit.txt
   
   # Review results before proceeding
   ```
   **Goal**: Confirm fields are truly unused (or document where they need updates)

2. **Review this plan** with stakeholders
   - Confirm: Database migration strategy (Phase 0.2)
   - Confirm: Single-voice approach (no dual options)
   - Confirm: Timeline acceptable (42-60 hours)
   - Confirm: Risk mitigation satisfactory

3. **Run data quality audit** (Phase 1.4)
   ```sql
   -- Check current state BEFORE cleanup
   SELECT 
     COUNT(*) as total_businesses,
     COUNT(tone_of_voice) as has_tone_of_voice,
     COUNT(tone_model) as has_tone_model,
     COUNT(never_say) as has_never_say,
     COUNT(signature_phrases) as has_signature_phrases,
     COUNT(do_not_say) as has_do_not_say,  -- Should be 0
     COUNT(tone_keywords) as has_tone_keywords,
     COUNT(typical_openings) as has_typical_openings,
     COUNT(typical_closings) as has_typical_closings,
     COUNT(voice_options) as has_voice_options
   FROM business_brand_profile
   WHERE business_id IN (
     SELECT id FROM businesses WHERE deleted_at IS NULL
   );
   ```
   **Goal**: Baseline metrics before any changes

4. **Test existing voice generation** (understand current system)
   ```bash
   # Test voice-options-generator.ts with Café Faust
   # Review: Does it generate good output?
   # Identify: Which parts to reuse vs rebuild
   ```

5. **Create Phase 0 implementation ticket**
   - Database migration script
   - Field usage update checklist
   - Rollback plan documentation

**Once approved**:

**Week 1**: Phase 0 (Database Cleanup)
- Day 1-2: Audit + migration script + testing
- Day 3: Deploy to staging, monitor
- Day 4: Code reference updates
- Day 5: Deploy to production, monitor 24h

**Week 2**: Phase 1-2 (Assessment + Design)
- Day 1: Post-cleanup audit
- Day 2-3: Type system updates + prompt design
- Day 4-5: Review + iteration

**Week 3**: Phase 3A-3C (Implementation Core)
- Day 1: Foundation (types, database setup)
- Day 2-3: AI generation logic (voice-profile.ts)
- Day 4-5: V5 generator integration

**Week 4**: Phase 3D-3E (Integration + Migration)
- Day 1-2: Content system integration
- Day 3: Data migration script
- Day 4: Run migration + validation
- Day 5: Buffer for issues

**Week 5**: Phase 4-5 (Testing + Documentation)
- Day 1-2: Unit + integration tests
- Day 3: Quality validation + A/B testing
- Day 4-5: Documentation + handoff

**Total**: ~5 weeks (part-time) or ~2 weeks (full-time)

---

## Success Criteria (Option B)

**Technical metrics**:
- ✅ Database reduced from 44 to 38 voice-related columns
- ✅ Zero references to deleted fields in codebase
- ✅ 100% of businesses have V5 voice section populated
- ✅ 95%+ migration success rate
- ✅ <2% error rate in voice generation
- ✅ Voice generation time <3 seconds (single call vs old dual-call)
- ✅ Guardrails finally enforced in content generation

**Quality metrics**:
- ✅ 90%+ voice formality matches positioning
- ✅ 100% critical guardrails present (brunch, location, casual/formal)
- ✅ 0% hallucinated facilities/services in examples
- ✅ Content generation quality maintained or improved vs old system
- ✅ A/B test: New prompts ≥ old prompts (quality parity minimum)

**Code quality metrics**:
- ✅ TypeScript types clean (no @ts-ignore for deleted fields)
- ✅ All deprecated fields have JSDoc warnings
- ✅ Database comments explain migration history
- ✅ No zombie fields surfacing in unexpected places
- ✅ Signal derivation logic unit-tested (>80% coverage)

**Integration metrics**:
- ✅ Weekly Plan reads V5 voice successfully
- ✅ Dagens Forslag reads V5 writing_examples successfully
- ✅ Guardrails enforced in prompts (validate with test generation)
- ✅ Fallback logic working (0 errors when V5 empty)
- ✅ Dashboard displays V5 data correctly

---

## Appendix: Field-by-Field Decision Matrix

| Field | Current Status | Decision | Rationale |
|-------|---------------|----------|-----------|
| `tone_of_voice` | ✅ Populated, used | KEEP → V5 | Core field, migrate to V5 |
| `tone_model` | ✅ Populated, used | KEEP → V5 | Structured data, merge into V5 |
| `voice_constraints` | ✅ Populated, used | KEEP → V5 | Merge with writing_principles |
| `never_say` | ✅ Populated, NOT enforced | KEEP → V5 | Finally wire up in prompts |
| `signature_phrases` | ✅ Populated, used | KEEP → V5 | Brand-specific phrases, valuable |
| `humor_level` | ✅ Populated, used | KEEP → V5 | Personality trait, used |
| `formality` | ✅ Populated, used | KEEP → V5 | Core voice attribute |
| `emoji_style` | ✅ Populated, used | KEEP → V5 | Practical guidance |
| `storytelling_style` | ✅ Populated, used | KEEP → V5 | Narrative approach |
| **`do_not_say`** | ❌ NULL everywhere | **DELETE** | Never populated, use never_say |
| **`tone_keywords`** | 🟡 Populated, low signal | **DELETE** | Redundant with tone_model |
| **`typical_openings`** | 🟡 Populated, unused | **DELETE** | Docs say "cut", regenerate in V5 |
| **`typical_closings`** | 🟡 Populated, unused | **DELETE** | Docs say "cut", regenerate in V5 |
| **`voice_options`** | 🟡 Populated, dual-voice | **DELETE** | Paradigm being dropped |

**Total**: 9 fields kept (migrate to V5), 5 fields deleted

---

## Current State

### Layer 3: Identity Profile (Existing)

**Database**: `business_brand_profile.brand_profile_v5` JSONB column

**Current Structure**:
```json
{
  "identity": {
    "brand_essence": "En alsidig café ved åen...",
    "positioning": "Café Faust er det ideelle sted...",
    "core_values": [
      "Hjemmelavet kvalitet - alt fra granola...",
      "Regional forankring - anvender regionale..."
    ],
    "what_makes_us_different": "Vi er den eneste café ved åen...",
    "local_location_reference": "ved åen",
    "identity_confidence": 0.9,
    "identity_reasoning": "Brand essence og positioning er baseret..."
  }
}
```

**What's missing**: Voice, Examples, Guardrails

---

## Target State

### Layer 3: Brand Profile (Enhanced)

**Database**: Same location (`business_brand_profile.brand_profile_v5`), expanded structure

**Target Structure**:
```json
{
  "identity": { /* existing - keep as-is */ },
  
  "voice": {
    "tone_of_voice": "Venlig, afslappet og direkte - vi snakker til gæsterne som venner",
    "tone_keywords": ["lokal", "autentisk", "hyggeligt", "uformel", "kvalitet"],
    "formality": "informal",
    "humor_level": "moderate",
    "storytelling_style": "anecdotal",
    "emoji_style": "moderate",
    "writing_principles": "Vi skriver direkte og ærligt fordi vores gæster værdsætter autenticitet over poleret markedsføring. Korte sætninger, konkret sprog, ingen jargon.",
    "voice_confidence": 0.85,
    "voice_reasoning": "Tone afledt af casual positioning..."
  },
  
  "writing_examples": {
    "typical_openings": [
      "Tænk dig: [scene/menu item]...",
      "Det her er perfekt til en [occasion]...",
      "Kom til [meal] ved åen..."
    ],
    "typical_closings": [
      "Kom forbi i dag – vi ses ved bordet",
      "Vi glæder os til at se dig ved åen",
      "Book dit bord nu"
    ],
    "signature_phrases": [
      "hjemmelavet fra bunden",
      "regionale råvarer",
      "ved åen",
      "fra brunch til bar",
      "all-day café oplevelse",
      "vegetariske og veganske muligheder"
    ],
    "examples_confidence": 0.75,
    "examples_reasoning": "Eksempler genereret fra core values..."
  },
  
  "guardrails": {
    "never_say": [
      "billig → use 'god værdi' or 'fair pris'",
      "discount → describe the value directly",
      "deal → be specific about the offering",
      "morgenmad → ALWAYS use 'brunch'",
      "fine dining → we are casual, not formal"
    ],
    "do_not_say": [
      "Competition or price comparisons",
      "'Reservationer' for brunch (walk-in only)",
      "'Aarhus Å' → ONLY use 'ved åen'",
      "Adding extra geographic specificity beyond 'ved åen'"
    ],
    "guardrails_confidence": 0.9,
    "guardrails_reasoning": "Guardrails baseret på verified facts..."
  }
}
```

---

## Implementation Steps

### Step 1: Update TypeScript Types

**File**: `src/types/brand-profile-v5.ts`

**Action**: Expand `IdentityProfile` interface to include 3 new sections

**Current code** (lines 9-17):
```typescript
export interface IdentityProfile {
  brand_essence: string
  positioning: string
  core_values: string[]
  what_makes_us_different: string
  identity_confidence: number
  identity_reasoning?: string
  local_location_reference?: string
}
```

**New code** (replace with):
```typescript
/**
 * Layer 3: Complete Brand Profile
 * Stored in business_brand_profile.brand_profile_v5 JSONB
 * Generated by brand-profile-generator-v5
 */
export interface CompleteBrandProfile {
  // Section A: Brand Identity
  identity: {
    brand_essence: string
    positioning: string
    core_values: string[]  // Array of "Title - Description" strings
    what_makes_us_different: string
    local_location_reference?: string  // e.g., "ved åen"
    identity_confidence: number  // 0-1
    identity_reasoning?: string
  }
  
  // Section B: Voice & Tone
  voice: {
    tone_of_voice: string  // e.g., "Venlig, afslappet og direkte"
    tone_keywords: string[]  // e.g., ["lokal", "autentisk", "hyggeligt"]
    formality: 'informal' | 'semi-formal' | 'formal'
    humor_level: 'low' | 'moderate' | 'high'
    storytelling_style: 'anecdotal' | 'direct' | 'descriptive'
    emoji_style: 'minimal' | 'moderate' | 'expressive'
    writing_principles: string  // Why this style matters
    voice_confidence: number  // 0-1
    voice_reasoning?: string
  }
  
  // Section C: Writing Examples
  writing_examples: {
    typical_openings: string[]  // 3-5 example opening lines
    typical_closings: string[]  // 3-5 example CTAs/closings
    signature_phrases: string[]  // 5-10 brand-specific phrases
    examples_confidence: number  // 0-1
    examples_reasoning?: string
  }
  
  // Section D: Content Guardrails
  guardrails: {
    never_say: string[]  // Word-level blocklist with replacements
    do_not_say: string[]  // Topic/approach blocklist
    guardrails_confidence: number  // 0-1
    guardrails_reasoning?: string
  }
}

// Backwards compatibility: IdentityProfile = just the identity section
export type IdentityProfile = CompleteBrandProfile['identity']
```

**Why**: Maintains backwards compatibility with existing Phase 1 integration while enabling full profile usage.

---

### Step 2: Update AI Generation Prompt

**File**: `supabase/functions/brand-profile-generator-v5/index.ts` (or wherever the Layer 3 generation prompt is)

**Action**: Expand AI prompt to generate all 4 sections in one call

**Current prompt structure** (assumed):
```typescript
const prompt = `
Generate brand identity for ${businessName}...

OUTPUT FORMAT (JSON):
{
  "identity": {
    "brand_essence": "...",
    "positioning": "...",
    "core_values": ["...", "..."],
    "what_makes_us_different": "...",
    "identity_confidence": 0.9,
    "identity_reasoning": "..."
  }
}
`
```

**New prompt** (replace with):
```typescript
const prompt = `
You are a brand strategist generating a complete brand profile for a Danish café/restaurant.

BUSINESS: ${businessName}
LOCATION: ${locationData}
PROGRAMMES: ${programmes.map(p => p.programme_name).join(', ')}
MENU ITEMS: ${topMenuItems}
OPENING HOURS: ${openingHours}

TASK: Generate a complete 4-section brand profile.

═══════════════════════════════════════════════════════════
SECTION A: BRAND IDENTITY
═══════════════════════════════════════════════════════════

Generate:
- brand_essence: One-sentence summary of who this business is
- positioning: 2-3 sentence market positioning statement
- core_values: Array of 3-5 values in format "Title - Description"
- what_makes_us_different: One sentence USP
- local_location_reference: Factual location phrase (e.g., "ved åen") - ONLY if explicitly mentioned
- identity_confidence: 0-1 (how confident you are)
- identity_reasoning: Why you chose these elements

CRITICAL RULES:
- Use ONLY verified data from the business data provided
- If programmes include "Morgenmad/Brunch", this is BRUNCH ONLY (never use "morgenmad" in identity)
- Location reference must be exact phrase from data, NO elaboration
- Base core values on menu evidence and verified operations

═══════════════════════════════════════════════════════════
SECTION B: VOICE & TONE
═══════════════════════════════════════════════════════════

Generate:
- tone_of_voice: How this business communicates (1-2 sentences)
- tone_keywords: 5-7 personality descriptors (Danish words)
- formality: "informal" | "semi-formal" | "formal"
- humor_level: "low" | "moderate" | "high"
- storytelling_style: "anecdotal" | "direct" | "descriptive"
- emoji_style: "minimal" | "moderate" | "expressive"
- writing_principles: Why this style matters (1-2 sentences)
- voice_confidence: 0-1
- voice_reasoning: How you derived the voice from the business data

DERIVATION LOGIC:
- Casual positioning → informal formality, moderate humor
- Fine dining → formal, low humor
- No reservations (walk-in) → approachable, informal
- Homemade/artisan focus → authentic, direct storytelling
- Family-friendly → warm, moderate emoji usage
- Bar/nightlife → playful, higher humor

═══════════════════════════════════════════════════════════
SECTION C: WRITING EXAMPLES
═══════════════════════════════════════════════════════════

Generate:
- typical_openings: Array of 3-5 example opening lines
- typical_closings: Array of 3-5 example CTAs/closings
- signature_phrases: Array of 5-10 brand-specific phrases
- examples_confidence: 0-1
- examples_reasoning: Why these examples fit the brand

OPENINGS should:
- Match the tone (informal/formal)
- Reference specific programmes or offerings
- Be 1 sentence max

CLOSINGS should:
- Include clear CTAs
- Reference booking/walk-in behavior from data
- Match formality level

SIGNATURE PHRASES should:
- Pull from core values and positioning
- Include location reference if exists
- Reference homemade/regional/key differentiators

═══════════════════════════════════════════════════════════
SECTION D: CONTENT GUARDRAILS
═══════════════════════════════════════════════════════════

Generate:
- never_say: Array of 5-10 forbidden words with replacements (format: "word → replacement")
- do_not_say: Array of 3-7 forbidden topics/approaches
- guardrails_confidence: 0-1
- guardrails_reasoning: Why these guardrails protect the brand

MANDATORY GUARDRAILS:
1. If programme is "Morgenmad/Brunch" → never_say MUST include "morgenmad → ALWAYS use 'brunch'"
2. If local_location_reference exists → do_not_say MUST include "Never add geographic specificity beyond '[reference]'"
3. If casual positioning → never_say MUST include "fine dining → we are casual, not formal"
4. If walk-in only for any programme → do_not_say MUST include "No 'reservationer' for [programme]"

COMMON FORBIDDEN WORDS (add if appropriate):
- "billig → use 'god værdi'"
- "discount → describe value directly"
- "deal → be specific"

COMMON FORBIDDEN TOPICS (add if appropriate):
- "Competition or price comparisons"
- "Invented facilities or services"

═══════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════

Return valid JSON with this exact structure:

{
  "identity": {
    "brand_essence": "string",
    "positioning": "string",
    "core_values": ["string", "string", ...],
    "what_makes_us_different": "string",
    "local_location_reference": "string or null",
    "identity_confidence": 0.9,
    "identity_reasoning": "string"
  },
  "voice": {
    "tone_of_voice": "string",
    "tone_keywords": ["string", "string", ...],
    "formality": "informal",
    "humor_level": "moderate",
    "storytelling_style": "anecdotal",
    "emoji_style": "moderate",
    "writing_principles": "string",
    "voice_confidence": 0.85,
    "voice_reasoning": "string"
  },
  "writing_examples": {
    "typical_openings": ["string", "string", "string"],
    "typical_closings": ["string", "string", "string"],
    "signature_phrases": ["string", "string", ...],
    "examples_confidence": 0.75,
    "examples_reasoning": "string"
  },
  "guardrails": {
    "never_say": ["word → replacement", "word → replacement", ...],
    "do_not_say": ["topic", "topic", ...],
    "guardrails_confidence": 0.9,
    "guardrails_reasoning": "string"
  }
}

Generate now:
`
```

**Why**: Single AI call generates complete brand profile. Structured rules ensure consistency and factual accuracy.

---

### Step 3: Update Data Fetchers

**File**: `supabase/functions/_shared/data-fetchers/fetch-v5-profile.ts`

**Current function**:
```typescript
export async function fetchV5IdentityProfile(
  supabase: SupabaseClient,
  businessId: string
): Promise<IdentityProfile | null>
```

**Action**: Add new function to fetch complete profile:

```typescript
/**
 * Fetch complete Layer 3 Brand Profile (all 4 sections)
 * @returns CompleteBrandProfile or null if not found
 */
export async function fetchCompleteBrandProfile(
  supabase: SupabaseClient,
  businessId: string
): Promise<CompleteBrandProfile | null> {
  const { data, error } = await supabase
    .from('business_brand_profile')
    .select('brand_profile_v5')
    .eq('business_id', businessId)
    .single()

  if (error || !data?.brand_profile_v5) {
    logV5('fetch-complete-profile-missing', { businessId })
    return null
  }

  const profile = data.brand_profile_v5 as CompleteBrandProfile

  // Validate all required sections exist
  if (!profile.identity || !profile.voice || !profile.writing_examples || !profile.guardrails) {
    logV5('fetch-complete-profile-incomplete', { 
      businessId,
      hasIdentity: !!profile.identity,
      hasVoice: !!profile.voice,
      hasExamples: !!profile.writing_examples,
      hasGuardrails: !!profile.guardrails
    })
    return null
  }

  logV5('fetch-complete-profile-success', { 
    businessId,
    identityConfidence: profile.identity.identity_confidence,
    voiceConfidence: profile.voice.voice_confidence,
    examplesConfidence: profile.writing_examples.examples_confidence,
    guardrailsConfidence: profile.guardrails.guardrails_confidence
  })

  return profile
}

// Keep backwards compatibility
export async function fetchV5IdentityProfile(
  supabase: SupabaseClient,
  businessId: string
): Promise<IdentityProfile | null> {
  const completeProfile = await fetchCompleteBrandProfile(supabase, businessId)
  return completeProfile?.identity || null
}
```

**Why**: Maintains backwards compatibility while enabling full profile fetching.

---

### Step 4: Update Phase 1 Prompt Integration

**File**: `supabase/functions/_shared/post-helpers/strategy/phase1.ts`

**Current integration** (around line 378-405):
```typescript
${context.v5_identity ? `
═══════════════════════════════════════════════
V5 BRAND IDENTITY (Layer 3 - Verified Facts)
═══════════════════════════════════════════════

BRAND ESSENCE:
${context.v5_identity.brand_essence}

POSITIONING:
${context.v5_identity.positioning}

CORE VALUES:
${context.v5_identity.core_values.map((v, i) => `${i + 1}. ${v}`).join('\n')}

WHAT MAKES US DIFFERENT:
${context.v5_identity.what_makes_us_different}

${context.v5_identity.local_location_reference ? `🚨 LOCATION REFERENCE (MANDATORY):
ALWAYS use: "${context.v5_identity.local_location_reference}"
NEVER add extra geographic specificity beyond this phrase.
` : ''}

Identity Confidence: ${Math.round(context.v5_identity.identity_confidence * 100)}%

═══════════════════════════════════════════════
` : ''}
```

**New integration** (replace with):
```typescript
${context.v5_brand_profile ? `
═══════════════════════════════════════════════
V5 BRAND PROFILE (Layer 3 - Complete)
═══════════════════════════════════════════════

⚠️ CRITICAL: This section contains VERIFIED brand profile data.
Use this as the PRIMARY brand source. It OVERRIDES legacy brand_voice fields.

─────────────────────────────────────────────
BRAND IDENTITY
─────────────────────────────────────────────

BRAND ESSENCE:
${context.v5_brand_profile.identity.brand_essence}

POSITIONING:
${context.v5_brand_profile.identity.positioning}

CORE VALUES:
${context.v5_brand_profile.identity.core_values.map((v, i) => `${i + 1}. ${v}`).join('\n')}

WHAT MAKES US DIFFERENT:
${context.v5_brand_profile.identity.what_makes_us_different}

${context.v5_brand_profile.identity.local_location_reference ? `🚨 LOCATION REFERENCE (MANDATORY):
ALWAYS use: "${context.v5_brand_profile.identity.local_location_reference}"
NEVER add extra geographic specificity beyond this phrase.
` : ''}

─────────────────────────────────────────────
VOICE & TONE
─────────────────────────────────────────────

TONE: ${context.v5_brand_profile.voice.tone_of_voice}

PERSONALITY KEYWORDS: ${context.v5_brand_profile.voice.tone_keywords.join(' · ')}

STYLE PARAMETERS:
• Formality: ${context.v5_brand_profile.voice.formality}
• Humor: ${context.v5_brand_profile.voice.humor_level}
• Storytelling: ${context.v5_brand_profile.voice.storytelling_style}
• Emoji Usage: ${context.v5_brand_profile.voice.emoji_style}

WRITING PRINCIPLES:
${context.v5_brand_profile.voice.writing_principles}

─────────────────────────────────────────────
WRITING EXAMPLES
─────────────────────────────────────────────

TYPICAL OPENINGS:
${context.v5_brand_profile.writing_examples.typical_openings.map(o => `• "${o}"`).join('\n')}

TYPICAL CLOSINGS:
${context.v5_brand_profile.writing_examples.typical_closings.map(c => `• "${c}"`).join('\n')}

SIGNATURE PHRASES (use naturally):
${context.v5_brand_profile.writing_examples.signature_phrases.map(p => `• "${p}"`).join('\n')}

─────────────────────────────────────────────
🚨 CONTENT GUARDRAILS (NEVER VIOLATE)
─────────────────────────────────────────────

FORBIDDEN WORDS:
${context.v5_brand_profile.guardrails.never_say.map(rule => `❌ ${rule}`).join('\n')}

FORBIDDEN TOPICS/APPROACHES:
${context.v5_brand_profile.guardrails.do_not_say.map(topic => `❌ ${topic}`).join('\n')}

─────────────────────────────────────────────
CONFIDENCE SCORES
─────────────────────────────────────────────

Identity: ${Math.round(context.v5_brand_profile.identity.identity_confidence * 100)}%
Voice: ${Math.round(context.v5_brand_profile.voice.voice_confidence * 100)}%
Examples: ${Math.round(context.v5_brand_profile.writing_examples.examples_confidence * 100)}%
Guardrails: ${Math.round(context.v5_brand_profile.guardrails.guardrails_confidence * 100)}%

═══════════════════════════════════════════════
` : ''}
```

**Why**: Provides complete brand context to AI in one section, replacing need for legacy brand_voice.

---

### Step 5: Update WeekContext Interface

**File**: `supabase/functions/_shared/post-helpers/types/strategy-types.ts`

**Current** (around line 390-405):
```typescript
v5_identity?: {
  brand_essence: string;
  positioning: string;
  core_values: string[];
  what_makes_us_different: string;
  identity_confidence: number;
  identity_reasoning?: string;
  local_location_reference?: string;
};
```

**Replace with**:
```typescript
/**
 * V5 Complete Brand Profile (Layer 3)
 * Generated by brand-profile-generator-v5, stored in business_brand_profile.
 * Used when V5_ENABLED && V5_LAYER3_ENABLED feature flags are true.
 * Provides complete brand context: identity, voice, examples, guardrails.
 */
v5_brand_profile?: CompleteBrandProfile;

// Backwards compatibility - deprecated, use v5_brand_profile.identity instead
v5_identity?: IdentityProfile;
```

**Why**: Maintains backwards compatibility while enabling full profile usage.

---

### Step 6: Update get-weekly-strategy Integration

**File**: `supabase/functions/get-weekly-strategy/index.ts`

**Current code** (around line 330):
```typescript
let v5Identity: IdentityProfile | null = null;
if (isV5EnabledForBusiness(body.business_id) && V5_FLAGS.LAYER3_ENABLED) {
  console.log('[get-weekly-strategy] V5 Layer 3 enabled - fetching identity profile');
  v5Identity = await fetchV5IdentityProfile(dataClient, body.business_id);
  if (v5Identity) {
    logV5('layer3-integration', {
      businessId: body.business_id,
      confidence: v5Identity.identity_confidence,
      hasLocationRef: !!v5Identity.local_location_reference
    });
  }
}
```

**Replace with**:
```typescript
let v5BrandProfile: CompleteBrandProfile | null = null;
if (isV5EnabledForBusiness(body.business_id) && V5_FLAGS.LAYER3_ENABLED) {
  console.log('[get-weekly-strategy] V5 Layer 3 enabled - fetching complete brand profile');
  v5BrandProfile = await fetchCompleteBrandProfile(dataClient, body.business_id);
  
  if (v5BrandProfile) {
    logV5('layer3-complete-integration', {
      businessId: body.business_id,
      identityConfidence: v5BrandProfile.identity.identity_confidence,
      voiceConfidence: v5BrandProfile.voice.voice_confidence,
      examplesConfidence: v5BrandProfile.writing_examples.examples_confidence,
      guardrailsConfidence: v5BrandProfile.guardrails.guardrails_confidence,
      hasLocationRef: !!v5BrandProfile.identity.local_location_reference,
      toneKeywords: v5BrandProfile.voice.tone_keywords.length,
      signaturePhrases: v5BrandProfile.writing_examples.signature_phrases.length,
      neverSayRules: v5BrandProfile.guardrails.never_say.length
    });
  } else {
    // Fallback: try to fetch just identity for backwards compatibility
    const v5Identity = await fetchV5IdentityProfile(dataClient, body.business_id);
    if (v5Identity) {
      console.log('[get-weekly-strategy] Only identity section available (incomplete profile)');
      // Create minimal profile with just identity
      v5BrandProfile = {
        identity: v5Identity,
        voice: null as any,  // Will trigger legacy fallback
        writing_examples: null as any,
        guardrails: null as any
      };
    }
  }
}
```

**And update weekContext** (around line 1275):
```typescript
v5_brand_profile: v5BrandProfile || undefined,
v5_identity: v5BrandProfile?.identity || undefined,  // Backwards compatibility
```

**Why**: Graceful degradation - uses complete profile if available, falls back to identity-only if not.

---

### Step 7: Update Feature Flags (Optional)

**File**: `supabase/functions/_shared/config/v5-flags.ts`

**Action**: Add new flag for complete profile vs identity-only

```typescript
export const V5_FLAGS = {
  ENABLED: Deno.env.get('V5_ENABLED') === 'true',
  LAYER3_ENABLED: Deno.env.get('V5_LAYER3_ENABLED') === 'true',
  LAYER3_COMPLETE: Deno.env.get('V5_LAYER3_COMPLETE') === 'true',  // NEW
  LAYER4_ENABLED: Deno.env.get('V5_LAYER4_ENABLED') === 'true',
  // ... rest of flags
}
```

**Environment variable**:
```bash
V5_LAYER3_COMPLETE=true  # Use complete brand profile (voice, examples, guardrails)
V5_LAYER3_COMPLETE=false # Use identity only (backwards compatible)
```

**Why**: Enables gradual rollout of complete profile vs identity-only.

---

### Step 8: Update UI Display (Frontend)

**Location**: Frontend component that displays Layer 3 brand profile

**Current UI** (assumed structure):
```tsx
<section>
  <h3>Brand Identity</h3>
  <div>Brand Essence: {profile.identity.brand_essence}</div>
  <div>Positioning: {profile.identity.positioning}</div>
  <div>Core Values:
    <ul>
      {profile.identity.core_values.map(v => <li>{v}</li>)}
    </ul>
  </div>
  <div>What Makes Us Different: {profile.identity.what_makes_us_different}</div>
</section>
```

**New UI** (expand with 3 new sections):
```tsx
{/* Section A: Brand Identity */}
<section className="brand-identity">
  <h3>✨ Brand Identity</h3>
  <p className="description">Core identity elements for your business</p>
  
  <div className="field">
    <label>Brand Essence</label>
    <p>{profile.identity.brand_essence}</p>
  </div>
  
  <div className="field">
    <label>Positioning</label>
    <p>{profile.identity.positioning}</p>
  </div>
  
  <div className="field">
    <label>Core Values</label>
    <ul>
      {profile.identity.core_values.map((v, i) => (
        <li key={i}>{v}</li>
      ))}
    </ul>
  </div>
  
  <div className="field">
    <label>What Makes Us Different</label>
    <p>{profile.identity.what_makes_us_different}</p>
  </div>
  
  <div className="confidence">
    <label>AI Confidence</label>
    <div className="stars">
      {renderStars(profile.identity.identity_confidence)}
      <span>{Math.round(profile.identity.identity_confidence * 100)}%</span>
    </div>
    <details>
      <summary>AI Reasoning</summary>
      <p>{profile.identity.identity_reasoning}</p>
    </details>
  </div>
</section>

{/* Section B: Voice & Tone */}
<section className="voice-tone">
  <h3>🎤 Voice & Tone</h3>
  <p className="description">How {businessName} communicates</p>
  
  <div className="field">
    <label>Tone of Voice</label>
    <p>{profile.voice.tone_of_voice}</p>
  </div>
  
  <div className="field">
    <label>Tone Keywords</label>
    <div className="keywords">
      {profile.voice.tone_keywords.map(kw => (
        <span key={kw} className="keyword">{kw}</span>
      ))}
    </div>
  </div>
  
  <div className="field">
    <label>Communication Style</label>
    <ul>
      <li>Formality: <strong>{profile.voice.formality}</strong></li>
      <li>Humor: <strong>{profile.voice.humor_level}</strong></li>
      <li>Storytelling: <strong>{profile.voice.storytelling_style}</strong></li>
      <li>Emoji Usage: <strong>{profile.voice.emoji_style}</strong></li>
    </ul>
  </div>
  
  <div className="field">
    <label>Writing Principles</label>
    <p>{profile.voice.writing_principles}</p>
  </div>
  
  <div className="confidence">
    <label>AI Confidence</label>
    <div className="stars">
      {renderStars(profile.voice.voice_confidence)}
      <span>{Math.round(profile.voice.voice_confidence * 100)}%</span>
    </div>
    <details>
      <summary>AI Reasoning</summary>
      <p>{profile.voice.voice_reasoning}</p>
    </details>
  </div>
</section>

{/* Section C: Writing Examples */}
<section className="writing-examples">
  <h3>✍️ Writing Examples</h3>
  <p className="description">{businessName}'s voice in action</p>
  
  <div className="field">
    <label>Typical Openings</label>
    <ul>
      {profile.writing_examples.typical_openings.map((opening, i) => (
        <li key={i}>"{opening}"</li>
      ))}
    </ul>
  </div>
  
  <div className="field">
    <label>Typical Closings</label>
    <ul>
      {profile.writing_examples.typical_closings.map((closing, i) => (
        <li key={i}>"{closing}"</li>
      ))}
    </ul>
  </div>
  
  <div className="field">
    <label>Signature Phrases</label>
    <ul>
      {profile.writing_examples.signature_phrases.map((phrase, i) => (
        <li key={i}>"{phrase}"</li>
      ))}
    </ul>
  </div>
  
  <div className="confidence">
    <label>AI Confidence</label>
    <div className="stars">
      {renderStars(profile.writing_examples.examples_confidence)}
      <span>{Math.round(profile.writing_examples.examples_confidence * 100)}%</span>
    </div>
    <details>
      <summary>AI Reasoning</summary>
      <p>{profile.writing_examples.examples_reasoning}</p>
    </details>
  </div>
</section>

{/* Section D: Content Guardrails */}
<section className="guardrails">
  <h3>🚨 Content Guardrails</h3>
  <p className="description">What to avoid in communication</p>
  
  <div className="field">
    <label>Never Use These Words</label>
    <ul>
      {profile.guardrails.never_say.map((rule, i) => (
        <li key={i} className="forbidden">❌ {rule}</li>
      ))}
    </ul>
  </div>
  
  <div className="field">
    <label>Never Mention</label>
    <ul>
      {profile.guardrails.do_not_say.map((topic, i) => (
        <li key={i} className="forbidden">❌ {topic}</li>
      ))}
    </ul>
  </div>
  
  <div className="confidence">
    <label>AI Confidence</label>
    <div className="stars">
      {renderStars(profile.guardrails.guardrails_confidence)}
      <span>{Math.round(profile.guardrails.guardrails_confidence * 100)}%</span>
    </div>
    <details>
      <summary>AI Reasoning</summary>
      <p>{profile.guardrails.guardrails_reasoning}</p>
    </details>
  </div>
</section>
```

**Why**: User sees complete brand profile in one page, can validate/edit each section.

---

### Step 9: Testing & Validation

**Create test script**: `scripts/test-complete-brand-profile.ts`

```typescript
#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

const CAFE_FAUST_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'

console.log('Testing Complete Brand Profile for Café Faust...\n')

// 1. Fetch complete profile
const { data, error } = await supabase
  .from('business_brand_profile')
  .select('brand_profile_v5')
  .eq('business_id', CAFE_FAUST_ID)
  .single()

if (error) {
  console.error('❌ Error fetching profile:', error)
  Deno.exit(1)
}

const profile = data.brand_profile_v5

console.log('═══════════════════════════════════════════════')
console.log('SECTION A: BRAND IDENTITY')
console.log('═══════════════════════════════════════════════\n')

console.log('✅ Brand Essence:', profile.identity.brand_essence)
console.log('✅ Positioning:', profile.identity.positioning)
console.log('✅ Core Values:', profile.identity.core_values.length)
console.log('✅ What Makes Different:', profile.identity.what_makes_us_different)
console.log('✅ Location Reference:', profile.identity.local_location_reference || 'N/A')
console.log('✅ Confidence:', Math.round(profile.identity.identity_confidence * 100) + '%')

console.log('\n═══════════════════════════════════════════════')
console.log('SECTION B: VOICE & TONE')
console.log('═══════════════════════════════════════════════\n')

if (!profile.voice) {
  console.error('❌ Voice section missing!')
} else {
  console.log('✅ Tone of Voice:', profile.voice.tone_of_voice)
  console.log('✅ Tone Keywords:', profile.voice.tone_keywords.join(', '))
  console.log('✅ Formality:', profile.voice.formality)
  console.log('✅ Humor Level:', profile.voice.humor_level)
  console.log('✅ Storytelling Style:', profile.voice.storytelling_style)
  console.log('✅ Emoji Style:', profile.voice.emoji_style)
  console.log('✅ Writing Principles:', profile.voice.writing_principles)
  console.log('✅ Confidence:', Math.round(profile.voice.voice_confidence * 100) + '%')
}

console.log('\n═══════════════════════════════════════════════')
console.log('SECTION C: WRITING EXAMPLES')
console.log('═══════════════════════════════════════════════\n')

if (!profile.writing_examples) {
  console.error('❌ Writing examples section missing!')
} else {
  console.log('✅ Typical Openings:', profile.writing_examples.typical_openings.length)
  profile.writing_examples.typical_openings.forEach((o, i) => {
    console.log(`   ${i + 1}. "${o}"`)
  })
  
  console.log('✅ Typical Closings:', profile.writing_examples.typical_closings.length)
  profile.writing_examples.typical_closings.forEach((c, i) => {
    console.log(`   ${i + 1}. "${c}"`)
  })
  
  console.log('✅ Signature Phrases:', profile.writing_examples.signature_phrases.length)
  profile.writing_examples.signature_phrases.forEach((p, i) => {
    console.log(`   ${i + 1}. "${p}"`)
  })
  
  console.log('✅ Confidence:', Math.round(profile.writing_examples.examples_confidence * 100) + '%')
}

console.log('\n═══════════════════════════════════════════════')
console.log('SECTION D: CONTENT GUARDRAILS')
console.log('═══════════════════════════════════════════════\n')

if (!profile.guardrails) {
  console.error('❌ Guardrails section missing!')
} else {
  console.log('✅ Never Say:', profile.guardrails.never_say.length)
  profile.guardrails.never_say.forEach((rule, i) => {
    console.log(`   ${i + 1}. ❌ ${rule}`)
  })
  
  console.log('✅ Do Not Say:', profile.guardrails.do_not_say.length)
  profile.guardrails.do_not_say.forEach((topic, i) => {
    console.log(`   ${i + 1}. ❌ ${topic}`)
  })
  
  console.log('✅ Confidence:', Math.round(profile.guardrails.guardrails_confidence * 100) + '%')
}

console.log('\n═══════════════════════════════════════════════')
console.log('VALIDATION SUMMARY')
console.log('═══════════════════════════════════════════════\n')

const validations = {
  hasIdentity: !!profile.identity,
  hasVoice: !!profile.voice,
  hasExamples: !!profile.writing_examples,
  hasGuardrails: !!profile.guardrails,
  identityComplete: profile.identity?.core_values?.length >= 3,
  voiceComplete: profile.voice?.tone_keywords?.length >= 5,
  examplesComplete: profile.writing_examples?.signature_phrases?.length >= 5,
  guardrailsComplete: profile.guardrails?.never_say?.length >= 3
}

const allValid = Object.values(validations).every(v => v === true)

if (allValid) {
  console.log('✅ ALL VALIDATIONS PASSED')
  console.log('   Complete brand profile ready for production use.')
} else {
  console.log('❌ VALIDATION FAILURES:')
  Object.entries(validations).forEach(([key, value]) => {
    if (!value) console.log(`   - ${key}: FAILED`)
  })
}

console.log('\n')
```

**Run test**:
```bash
deno run --allow-net --allow-env --allow-read --env-file=.env scripts/test-complete-brand-profile.ts
```

---

### Step 10: Migration Plan

**For Café Faust (test business)**:

1. ✅ Regenerate Layer 3 with new prompt
2. ✅ Validate all 4 sections present
3. ✅ Test in Phase 1 integration
4. ✅ Compare quality vs identity-only

**For other businesses**:

1. Set `V5_LAYER3_COMPLETE=false` (identity-only, backwards compatible)
2. Gradually regenerate profiles with complete structure
3. Enable `V5_LAYER3_COMPLETE=true` when >80% have complete profiles

---

## Success Criteria

### Functional Requirements

- ✅ All 4 sections generated in one AI call
- ✅ Data stored in same JSONB column
- ✅ Backwards compatible with identity-only
- ✅ Phase 1 prompt uses all 4 sections
- ✅ UI displays all 4 sections
- ✅ Confidence scores for each section

### Quality Requirements

- ✅ Voice section accurately reflects business positioning
- ✅ Writing examples feel authentic to brand
- ✅ Guardrails include mandatory rules (brunch, location)
- ✅ All AI reasoning is clear and fact-based

### Performance Requirements

- ✅ Single AI generation ≤30 seconds
- ✅ Database fetch ≤100ms
- ✅ No regressions in strategy generation time

---

## Rollback Plan

**If implementation fails:**

1. Set `V5_LAYER3_COMPLETE=false`
2. System falls back to identity-only (current behavior)
3. Legacy brand_voice continues to work

**If quality degrades:**

1. Adjust AI prompt sections
2. Regenerate profiles
3. Compare A/B results

---

## Example Output for Café Faust

Expected complete brand profile after implementation:

```json
{
  "identity": {
    "brand_essence": "En alsidig café ved åen, der tilbyder en bred vifte af brunch, frokost og aftensmad med fokus på regionale råvarer.",
    "positioning": "Café Faust er det ideelle sted ved åen for dem, der ønsker en helhedsoplevelse fra brunch til bar. Vi skiller os ud ved at tilbyde hjemmelavede retter med regionale ingredienser, hvilket sikrer en autentisk smagsoplevelse hele dagen.",
    "core_values": [
      "Hjemmelavet kvalitet - alt fra granola til Nutella er lavet fra bunden",
      "Regional forankring - anvender regionale råvarer som ost fra Tange Sø og pølser fra Højer",
      "Bred tilgængelighed - åbent fra brunch kl. 09:30 på hverdage og kl. 09:00 i weekenden til bar kl. 02:00 fredag-lørdag",
      "Variation og inklusion - tilbyder både vegetariske og veganske brunchmuligheder"
    ],
    "what_makes_us_different": "Vi er den eneste café ved åen, der kombinerer hjemmelavede retter med regionale råvarer i en all-day café oplevelse.",
    "local_location_reference": "ved åen",
    "identity_confidence": 0.9,
    "identity_reasoning": "Brand essence og positioning er baseret på all-day café konceptet med 4 programmer og den specifikke location 'ved åen'. Core values er verificeret gennem menu-data (hjemmelavede produkter, regionale råvarer) og åbningstider (dag-specifikke)."
  },
  "voice": {
    "tone_of_voice": "Venlig, afslappet og direkte - vi snakker til gæsterne som venner",
    "tone_keywords": ["lokal", "autentisk", "hyggeligt", "uformel", "kvalitet", "hjemmelavet", "afslappet"],
    "formality": "informal",
    "humor_level": "moderate",
    "storytelling_style": "anecdotal",
    "emoji_style": "moderate",
    "writing_principles": "Vi skriver direkte og ærligt fordi vores gæster værdsætter autenticitet over poleret markedsføring. Korte sætninger, konkret sprog, ingen jargon. Vi fortæller små historier om råvarer og køkken, men holder det kort og tilgængeligt.",
    "voice_confidence": 0.85,
    "voice_reasoning": "Tone afledt af casual positioning (all-day café, ikke fine dining), no-reservation policy for brunch (afslappet), homemade focus (autentisk), og location ved åen (lokal forankring). Informal formality matcher walk-in approach og broad accessibility."
  },
  "writing_examples": {
    "typical_openings": [
      "Tænk dig: frisk brunch ved åen...",
      "Det her er perfekt til en afslappet weekend...",
      "Kom til frokost ved åen - vi har plads til dig",
      "Lige nu kan du nyde..."
    ],
    "typical_closings": [
      "Kom forbi i dag – vi ses ved bordet",
      "Vi glæder os til at se dig ved åen",
      "Ingen reservation nødvendig - kom som du er",
      "Book dit bord til aftensmad" 
    ],
    "signature_phrases": [
      "hjemmelavet fra bunden",
      "regionale råvarer",
      "ved åen",
      "fra brunch til bar",
      "all-day café oplevelse",
      "vegetariske og veganske muligheder",
      "ost fra Tange Sø",
      "ingen reservationer til brunch",
      "åbent til kl. 02:00 i weekenden"
    ],
    "examples_confidence": 0.75,
    "examples_reasoning": "Eksempler genereret fra core values (hjemmelavet, regionale råvarer) og positioning (ved åen, brunch til bar). Opening lines matcher informal tone og location focus. Signature phrases pulled directly from verified facts i core values."
  },
  "guardrails": {
    "never_say": [
      "morgenmad → ALWAYS use 'brunch'",
      "billig → use 'god værdi' or 'fair pris'",
      "discount → describe the value directly",
      "deal → be specific about the offering",
      "fine dining → we are casual, not formal",
      "Aarhus Å → ONLY use 'ved åen'"
    ],
    "do_not_say": [
      "Competition or price comparisons",
      "'Reservationer' for brunch (walk-in only, verified from hours)",
      "Adding extra geographic specificity beyond 'ved åen'",
      "Claiming 'local' ingredients (verified: regional, not local)",
      "Invented facilities or services not in database"
    ],
    "guardrails_confidence": 0.9,
    "guardrails_reasoning": "Guardrails baseret på verified facts: programme er 'Morgenmad/Brunch' men only brunch behavior (CRITICAL rule), location reference is exact 'ved åen' (no elaboration), casual positioning excludes fine dining language, walk-in only for brunch (verified from hours), regional not local ingredients (verified from supplier distances: 44-165km)."
  }
}
```

---

## Timeline Estimate

**Phase 1**: Type definitions & data structures (2 hours)
- Update brand-profile-v5.ts
- Update strategy-types.ts
- Update fetch-v5-profile.ts

**Phase 2**: AI generation prompt (3 hours)
- Update brand-profile-generator-v5 prompt
- Test with Café Faust
- Iterate on quality

**Phase 3**: Integration (2 hours)
- Update get-weekly-strategy
- Update phase1.ts prompt injection
- Add feature flags

**Phase 4**: UI (3 hours)
- Update frontend component
- Add 3 new sections
- Test rendering

**Phase 5**: Testing & validation (2 hours)
- Create test script
- Validate Café Faust
- A/B test quality

**Total**: ~12 hours development time

---

## Questions for Implementation

1. **Where is the Layer 3 generation function?**
   - File path: `supabase/functions/brand-profile-generator-v5/index.ts`?
   - Or different location?

2. **What model is used for Layer 3 generation?**
   - Current: gpt-4o (as shown in UI)?
   - Should we keep same model for all 4 sections?

3. **Should voice/examples/guardrails be editable by user?**
   - Or AI-only with regeneration button?

4. **Rollout strategy?**
   - Regenerate Café Faust first?
   - Or all 14 businesses at once?

---

## Success Metrics

**After implementation, measure:**

1. **Coverage**:
   - % of businesses with complete profiles (target: 100% of active)
   
2. **Quality**:
   - Voice consistency score (manual review)
   - Guardrail compliance (automated check in generated content)
   - User satisfaction (feedback on profile accuracy)

3. **Impact**:
   - Brand voice consistency in generated posts ≥95%
   - Reduction in off-brand content ≥90%
   - Reduction in forbidden word usage = 100%

---

## Next Steps

1. Review this implementation guide
2. Confirm file paths and structure assumptions
3. Implement Phase 1 (type definitions)
4. Test with Café Faust
5. Iterate on AI prompt quality
6. Deploy to production

---

**End of Implementation Guide**
