# Phase 2: Brand Profile Information Adequacy Analysis
**Date:** 2026-06-02  
**Context:** Evaluating what brand profile data is needed for weekly strategy/plan vs text generation

---

## Executive Summary

**Current State:** Brand Profile contains **adequate structural information** but suffers from **unclear separation of concerns** between:
1. **Strategy Layer** (where to post, when, what angle)
2. **Generation Layer** (how to write, tone, voice)

**Key Finding:** The hardcoded FORBUDTE VENDINGER list (25+ phrases) in Phase 2c prompts **bypasses** the brand profile's `never_say` field, making brand-specific tone control impossible.

**Recommendation:** Move tone constraints from prompts → brand profile for business-specific flexibility while clarifying which data serves strategy vs generation.

---

## Brand Profile Structure Map

### 1. PROGRAM IDENTIFICATION
**UI Fields:**
- Programme names (MENUKORT, AFTEN, FROKOST, Brunch)
- Confidence scores (70%-90%)
- Menu items per programme
- Opening hours per programme

**Database Storage:** `business_programme_profiles` table
- `programme_name`, `timing`, `confidence`, `accepts_reservations`, `is_active`

**Used By:**
- ✅ **get-weekly-strategy** (lines 362-395): Programme goal mode mapping, active programmes filter
- ✅ **Phase 1 strategy** (lines 949+): Programme allocation to angles
- ❌ **NOT used in text generation** (Phase 2b uses programme from selected post idea)

**Adequacy:** ✅ **ADEQUATE** - Provides necessary context for strategy layer

---

### 2. MENU OVERVIEW & GASTRONOMIC PROFILE
**UI Fields:**
- Overordnet Menu-Oversigt (8 bullet points about fusion, vegetarian, etc.)
- Gastronomisk Profil (price level, atmosphere description)
- Signatur-Temaer (7 themes: Dansk og Europæisk Fusion, etc.)

**Database Storage:** `business_brand_profile.brand_profile_v5`
- `overview.menu_overview`
- `overview.gastronomic_profile`  
- `themes.signature_themes[]`

**Used By:**
- ❌ **NOT directly used in get-weekly-strategy** (strategy uses menu items directly from menu_results_v2)
- ⚠️ **PARTIALLY used in Phase 2b** (line 410-415): `brand_essence_elaboration` only
- ✅ **Used in UI display** only

**Adequacy:** ⚠️ **OVER-GENERATED** - Too verbose for actual usage
- Menu overview (8 bullets) → Only used for UI display, not in prompts
- Gastronomic profile → Not used in prompts
- Signature themes → Not used in prompts

**Recommendation:** 
- Keep for UI/documentation purposes
- Don't expect AI to reference these in prompts (too much cognitive load)
- Use menu items directly instead

---

### 3. COMMERCIAL STRATEGY (GOAL SPLITS)
**UI Fields:**
- Per-programme goal splits (Skab besøg 60%, Styrk brand 20%, etc.)
- AI-begrundelse per programme
- Beslutnings-timing (mixed, planned_reservation, spontaneous_walk_in)

**Database Storage:** `business_programme_profiles`
- `footfall_weight`, `brand_weight`, `loyalty_weight`
- `visit_mode` (spontaneous_walk_in, planned_reservation, mixed)

**Used By:**
- ✅ **get-weekly-strategy** (lines 512-528): Programme goal mode mapping for content type allocation
- ✅ **Phase C allocation** (Phase C uses dominant goal mode to assign content types)
- ❌ **NOT used in text generation** (text gen doesn't care about goals)

**Adequacy:** ✅ **ADEQUATE & CRITICAL** 
- Directly drives content type allocation
- Visit_mode influences temporal distribution

**Missing:** 
- ❌ Programme-specific tone preferences (formal dinner vs casual brunch should have different voice)
- ❌ Programme-specific content preferences (brunch = visual focus, dinner = ambiance)

**Recommendation:**
- Add programme-level tone modifiers:
  ```typescript
  programme_profiles: {
    tone_modifier: 'formal' | 'casual' | 'energetic' | 'refined'
    content_preference: 'product_focus' | 'experience_focus' | 'balanced'
  }
  ```

---

### 4. AUDIENCE SEGMENTS
**UI Fields:**
- Per-programme segments (primary/secondary/niche)
- Timing windows (Mandag-Fredag 12:00-14:00)
- Motivation (convenience, social_gathering, experience_seeking)
- Content vinkler (3 bullet points per segment)

**Database Storage:** `business_brand_profile.brand_profile_v5.segments[]`

**Used By:**
- ❌ **NOT used in get-weekly-strategy** (strategy uses programme goals, not segments)
- ❌ **NOT used in Phase 1** (angles are goal-driven, not segment-driven)
- ⚠️ **IMPLICITLY used in Phase 2b** (line 419): `target_audience` field only (not full segments)

**Adequacy:** ⚠️ **OVER-GENERATED, UNDER-UTILIZED**
- Segments are detailed (primary/secondary/niche with timing, motivation, vinkler)
- But prompts don't actually reference segment structure
- Only generic `target_audience` string is used

**Current Usage:**
```typescript
// Phase 2b line 419-423
const targetAudienceRaw = (context.brand_voice as any)?.target_audience;
const targetAudienceDescription = targetAudienceRaw 
  ? `Målgruppe: ${targetAudienceRaw}` 
  : '';
```

**Problem:** Richly structured segment data → flattened to single string → minimal prompt impact

**Recommendation:**
- **Option A (Simplify):** Remove segment structure, keep only `target_audience` string
- **Option B (Utilize):** Pass primary segment to Phase 2b for angle-specific targeting:
  ```typescript
  // Match angle to relevant segment
  const relevantSegment = findSegmentForAngle(angle, segments);
  prompt += `Målgruppe for dette opslag: ${relevantSegment.name} (${relevantSegment.motivation})`;
  ```

---

### 5. VOICE & GUIDELINES

#### 5A. Stemmeprofil (Tone Model)
**UI Fields:**
- Tone percentage (80%)
- 7 tone rules (numbered list)
- Personality keywords (moderne, indbydende, sofistikeret, lokal, kreativ)
- Formality (semi-formal)
- Humor (playful)
- Emoji usage (minimal, +29% engagement)
- Sentence style (conversational)

**Database Storage:** `business_brand_profile.brand_profile_v5.voice`
- `tone_dna` (80% confidence score)
- `tone_rules[]` (7 rules)
- `tone_model.personality[]`
- `tone_model.formality`
- `tone_model.humor`
- `emoji_usage`

**Used By:**
- ✅ **get-weekly-strategy** (lines 1114-1169): Builds `brand_voice` object with `tone_dna`, `tone_rules`
- ✅ **Phase 2b text generation** (line 395): `tone_keywords` (derived from `tone_model.primary_keywords`)
- ✅ **v5-voice-helpers** (lines 48-106): Formats tone rules, signature phrases, never_say into prompts

**Adequacy:** ✅ **ADEQUATE** - Well-structured, actively used

**Current Flow:**
```
brand_profile_v5.voice.tone_rules[] 
  → brand_voice.tone_rules 
  → v5-voice-helpers.formatVoiceContext()
  → Phase 2b prompt: "TONE RULES (følg disse direkte):\n  - ${rule}"
```

---

#### 5B. Skrive-eksempler (Writing Examples)
**UI Fields:**
- Menu examples (3 dishes with alternatives)
  - "Langsomt ovnbagt laks med cremet hollandaise og grillet citron"
  - Alternative: "Saftig laks fra ovnen med kogte kartofler og forårsløg"

**Database Storage:** `business_brand_profile.brand_profile_v5.examples`
- `menu_descriptions[]`
- `social_post_examples[]`

**Used By:**
- ✅ **v5-voice-helpers** (line 48): `signature_phrases` extracted from examples
- ⚠️ **Phase 2b** (line 443): `signature_phrases` shown in prompt (max 4)

**Adequacy:** ⚠️ **PARTIALLY ADEQUATE**
- Examples exist but not fully utilized
- Menu examples good for showing tone
- But Phase 2b doesn't show full menu example context

**Recommendation:**
- Show 1-2 complete menu examples in Phase 2b prompt as reference
- Currently only shows extracted signature phrases (loses context)

---

#### 5C. Guardrails (Forbidden Content)
**UI Fields:**
- Sig aldrig (word substitutions):
  - `billig → god værdi`
  - `lækker → sprød, cremet, saftig`
  - `fantastisk → (fjern ordet)`
- Indholdsudelukkelser (6 bullets about controversial topics, alcohol, etc.)
- Faktuelle begrænsninger (4 bullets: "Opfind aldrig events...", "Bekræft åbningstider...")

**Database Storage:** `business_brand_profile.brand_profile_v5.guardrails`
- `never_say[]` (word-level prohibitions)
- `content_exclusions[]` (topic-level restrictions)
- `factual_constraints[]` (hallucination prevention)

**Used By:**
- ✅ **v5-voice-helpers** (line 57, 104-106): Extracts `never_say` and shows in prompt
- ⚠️ **Phase 2c** (line 191): Extracts `never_say` (max 6) for narrative generation
- ❌ **BYPASSED by hardcoded FORBUDTE VENDINGER** in Phase 2c (lines 354-365)

**CRITICAL PROBLEM:**

```typescript
// Phase 2c hardcoded forbidden phrases (lines 354-365)
FORBUDTE VENDINGER (må ALDRIG optræde):
  "hygge" · "hyggelig" · "hyggelige" · "hyggefølelse" · "hyggepause"
  "lokal perle" · "socialt samvær" · "fristed" · "oase"
  [20+ more phrases]
```

**This hardcoded list OVERRIDES brand profile `never_say`**

**Impact:**
- ❌ Cafe Faust brand profile has `never_say: ["hygge", "hyggelig"]` → IGNORED
- ❌ Classical Italian restaurant can't use "hygge" either → WRONG (they shouldn't anyway, but constraint is wrong reason)
- ❌ Danish hygge-focused café can't use "hygge" → BREAKS brand flexibility

**Current Code Flow:**
```
Brand Profile never_say[] → v5-voice-helpers → Phase 2c prompt (max 6 words shown)
       ↓ BUT THEN...
Phase 2c hardcoded FORBUDTE VENDINGER (25+ phrases) → OVERRIDES everything
```

**Recommendation:** **PHASE 2 PRIORITY FIX**
1. Move all hardcoded FORBUDTE VENDINGER → default brand profile `never_say`
2. Remove hardcoded list from Phase 2c prompt
3. Use brand profile `never_say` as single source of truth
4. Each business can customize their own prohibitions

---

### 6. AI-BEGRUNDELSE (Confidence & Reasoning)
**UI Fields:**
- 80% confidence score
- AI explanation of how tone was derived
- Context factors analyzed (kulturel kontekst, målgrupper, prisniveau, etc.)
- Arketype (versatile_casual_waterfront)

**Database Storage:** `business_brand_profile.brand_profile_v5`
- `voice.confidence`
- `voice.ai_rationale`
- `archetype`

**Used By:**
- ❌ **NOT used in prompts** (metadata only)
- ✅ **UI display** for transparency

**Adequacy:** ✅ **ADEQUATE for its purpose** (transparency, not functional)

---

## Information Adequacy Summary

### ✅ ADEQUATE (Keep As-Is)
1. **Programme identification** → Drives strategy allocation
2. **Commercial strategy (goal splits)** → Drives content type system
3. **Tone rules (voice.tone_rules)** → Actively used in prompts
4. **Personality/formality model** → Shapes tone keywords

### ⚠️ OVER-GENERATED (Simplify or Better Utilize)
1. **Menu overview (8 bullets)** → UI display only, not used in prompts
2. **Gastronomic profile** → UI display only
3. **Signature themes** → UI display only
4. **Audience segments (detailed structure)** → Flattened to single `target_audience` string
5. **Writing examples** → Only `signature_phrases` extracted, full examples not shown in prompts

### ❌ MISSING (Add for Phase 2)
1. **Programme-level tone modifiers** → Brunch should sound different than formal dinner
2. **Creativity/consistency/variety dials** → User requested: "Classical Italian vs Cafe Faust should differ"
3. **Business-specific forbidden phrases** → Currently hardcoded system-wide

### 🚨 CRITICAL ISSUE (Fix Immediately)
**Hardcoded FORBUDTE VENDINGER bypasses brand profile `never_say`**
- Phase 2c lines 354-365: 25+ hardcoded forbidden phrases
- Overrides business-specific brand profile settings
- Breaks brand flexibility (all businesses get same prohibitions)

---

## Responsibility Boundaries: Strategy vs Generation

### get-weekly-strategy (Strategy Layer)
**Purpose:** WHAT to post, WHEN, and WHY (strategic decisions)

**Should Use:**
- ✅ Programme identification (which programmes active)
- ✅ Commercial strategy (goal splits → content type allocation)
- ✅ Menu items (what products to feature)
- ✅ Events, weather, economic timing (contextual triggers)
- ✅ Historical variety tracking (staleness, drift)

**Should NOT Use:**
- ❌ Tone rules (that's for text generation)
- ❌ Forbidden phrases (that's for text generation)
- ❌ Writing examples (that's for text generation)
- ❌ Detailed segment targeting (strategy uses programmes + goals)

**Current Violations:**
- ⚠️ get-weekly-strategy line 1114-1169: Builds full `brand_voice` object with tone_rules, never_say
  - **Why:** Passed forward to generate-weekly-plan
  - **Fix:** Keep minimal brand_voice in strategy (just business_character), full voice in generation

---

### generate-weekly-plan (Generation Layer)
**Purpose:** HOW to write posts (tone, voice, style)

**Should Use:**
- ✅ Tone rules (from brand_profile_v5.voice.tone_rules)
- ✅ Forbidden phrases (from brand_profile_v5.guardrails.never_say)
- ✅ Writing examples (from brand_profile_v5.examples)
- ✅ Signature phrases (from brand_profile_v5.examples.signature_phrases)
- ✅ Personality/formality/humor settings

**Should NOT Use:**
- ❌ Programme goal splits (already decided by strategy)
- ❌ Content type allocation (already assigned by strategy)
- ❌ Historical variety tracking (already handled by strategy)

**Current State:** ✅ Mostly correct separation

---

## Phase 2 Recommendations

### HIGH PRIORITY: Move Forbidden Phrases to Brand Profile

**Problem:** Hardcoded FORBUDTE VENDINGER in Phase 2c bypass brand profile

**Solution:**

#### Step 1: Database Migration
```sql
-- Add default forbidden phrases to existing brand profiles
UPDATE business_brand_profile
SET brand_profile_v5 = jsonb_set(
  COALESCE(brand_profile_v5, '{}'::jsonb),
  '{guardrails,never_say}',
  '["hygge", "hyggelig", "hyggelige", "lokal perle", "socialt samvær", 
    "fristed", "oase", "autentisk oplevelse", "fantastisk", "dejlig", 
    "almindelig", "billig", "lækker", "hurtig mad", "standard kaffe",
    "trækker folk ind", "foråret er på vej", "folk vil forkæle sig selv",
    "noget for enhver", "tag chancen", "friske sæsoningredienser",
    "i læ for vejret", "oplagt valg", "oplagt udflugtsmål"]'::jsonb,
  true
);
```

#### Step 2: Remove Hardcoded List from Phase 2c
```typescript
// DELETE lines 354-365 in phase2c.ts
// FORBUDTE VENDINGER (må ALDRIG optræde...

// REPLACE with dynamic brand profile never_say
const neverSay: string[] = (bv?.never_say || []);
const forbiddenPhrases = neverSay.length > 0 
  ? `ALDRIG BRUG (erstat med alternativer):\n${neverSay.map(n => `  - ${n}`).join('\n')}`
  : '';
```

#### Step 3: Allow Per-Business Customization
```typescript
// Businesses can now customize their own forbidden phrases
// Classical Italian: Add "hygge" (not Italian vibe)
// Danish hygge café: Remove "hygge" (it's their brand!)
// Formal restaurant: Add casual phrases like "cool", "fed"
```

**Impact:**
- ✅ Brand flexibility restored
- ✅ Single source of truth (brand profile)
- ✅ UI can show/edit forbidden phrases
- ✅ ~15 lines removed from prompt

---

### MEDIUM PRIORITY: Add Creativity/Consistency Dials

**User Request:**
> "Creativity, consistency and variety should be determined in Brand Profile. 
> A classical Italian restaurant would have different metrics than Cafe Faust."

**Add to brand_profile_v5:**
```typescript
brand_profile_v5: {
  voice: {
    // ... existing fields
    creativity_level: 'conservative' | 'balanced' | 'bold'  // New
    consistency_priority: 'high' | 'medium' | 'low'        // New
    variety_tolerance: 0.0 - 1.0                           // New (0 = repeat same angles, 1 = maximum variety)
  }
}
```

**Usage:**
```typescript
// Phase 1: Adjust angle variety based on creativity_level
if (creativity_level === 'conservative') {
  // Prefer tested angles, repeat successful patterns
  // Example: Classical Italian → same menu highlights, seasonal variations only
} else if (creativity_level === 'bold') {
  // Encourage experimentation, try new angles
  // Example: Cafe Faust → fusion experiments, unexpected combinations
}

// Phase 2b: Adjust language creativity
if (creativity_level === 'conservative') {
  prompt += "Brug klassisk kulinarisk sprog med fokus på tradition og kvalitet";
} else {
  prompt += "Brug moderne, lidt lege sprog med fusion-twist";
}
```

---

### MEDIUM PRIORITY: Programme-Level Tone Modifiers

**Add to business_programme_profiles:**
```sql
ALTER TABLE business_programme_profiles
ADD COLUMN tone_modifier TEXT CHECK (tone_modifier IN ('formal', 'casual', 'energetic', 'refined', 'playful')),
ADD COLUMN content_preference TEXT CHECK (content_preference IN ('product_focus', 'experience_focus', 'atmosphere_focus', 'balanced'));
```

**Usage:**
```typescript
// Phase 2b: Adjust tone per programme
const programme = angle.programme; // "Brunch" or "AFTEN"
const toneModifier = programmeProfiles[programme].tone_modifier;

if (toneModifier === 'casual') {
  prompt += "Brug afslappet, tilgængeligt sprog";
} else if (toneModifier === 'refined') {
  prompt += "Brug sofistikeret kulinarisk sprog";
}
```

**Examples:**
- Cafe Faust Brunch: `tone_modifier: 'casual'` → "Morgenmad ved åen"
- Cafe Faust AFTEN: `tone_modifier: 'refined'` → "Aftensmenu med nordiske inspirationer"

---

### LOW PRIORITY: Simplify Over-Generated Fields

**Option A: Keep for UI, Don't Expect Prompt Usage**
- Menu overview (8 bullets) → UI documentation only
- Gastronomic profile → UI documentation only
- Signature themes → UI documentation only

**Option B: Remove Entirely**
- If not used in prompts and not valuable for UI, remove from generation

**Recommendation:** Keep for now (useful for human review), but don't count on AI using them.

---

## Implementation Plan: Phase 2

### Week 1: Forbidden Phrases Migration (High Impact, Low Risk)

**Day 1-2:**
1. Create migration SQL to add default `never_say` list to all brand profiles
2. Run migration on staging
3. Verify all businesses have `never_say` populated

**Day 3:**
4. Update Phase 2c to use `brand_voice.never_say` dynamically
5. Remove hardcoded FORBUDTE VENDINGER list
6. Deploy to staging

**Day 4:**
7. Test 10 businesses with different brand profiles
8. Verify forbidden phrases enforced correctly
9. Deploy to production

**Day 5:**
10. Monitor logs for 24h
11. Add UI for editing `never_say` field (optional)

**Expected Impact:**
- 15 lines removed from Phase 2c prompt
- Brand flexibility restored
- Single source of truth

---

### Week 2: Creativity Dials (Medium Impact, Medium Risk)

**Day 1-2:**
1. Add `creativity_level`, `consistency_priority`, `variety_tolerance` to brand_profile_v5 schema
2. Create AI logic to infer these from existing brand profile during regeneration
3. Set defaults for existing businesses

**Day 3-4:**
4. Update Phase 1 to use creativity_level for angle selection
5. Update Phase 2b to use creativity_level for language guidance
6. Test conservative vs bold profiles side-by-side

**Day 5:**
7. Deploy to production with monitoring
8. A/B test creativity levels on 2-3 businesses

**Expected Impact:**
- Brand-driven variety control
- Classical Italian ≠ Cafe Faust tone differentiation

---

### Week 3: Programme Tone Modifiers (Low Impact, Low Risk)

**Day 1:**
1. Add `tone_modifier`, `content_preference` columns to business_programme_profiles
2. Infer defaults from programme name + visit_mode

**Day 2-3:**
3. Update Phase 2b to use programme tone_modifier
4. Test Brunch vs AFTEN tone differences

**Day 4:**
5. Deploy to production
6. Monitor for consistent programme-specific tone

**Expected Impact:**
- Programme-appropriate voice
- Brunch = casual, Dinner = refined

---

## Testing Protocol

### Before Each Phase 2 Change:
1. **Baseline:** Generate 5 strategies with current system
2. **Change:** Deploy Phase 2 update
3. **Compare:** Regenerate same 5 strategies
4. **Validate:**
   - No hallucinations introduced
   - Tone constraints enforced
   - Quality maintained or improved
5. **Monitor:** Watch logs for 24h post-deploy

### Quality Metrics:
- Event accuracy (0 hallucinations)
- Tone compliance (forbidden phrases caught)
- Brand differentiation (Classical Italian ≠ Cafe Faust)
- User satisfaction (manual review of 10 posts)

---

## Questions for User

1. **Forbidden Phrases Priority:** Should we start with moving forbidden phrases to brand profile (Week 1)? This is highest impact, lowest risk.

2. **Creativity Dials:** Do you want per-business creativity controls (conservative Classical Italian vs bold Cafe Faust)?

3. **Programme Tone:** Should Brunch sound different than formal Dinner for same business?

4. **Over-Generated Fields:** Keep menu overview/gastronomic profile for UI docs, or remove entirely?

5. **Text Generation Boundary:** Should tone rules stay in brand profile or move to separate `text_generation_settings` table?

---

## Next Steps

**Awaiting your decision:**
- Proceed with Week 1 (Forbidden Phrases Migration)?
- Skip to Week 2 (Creativity Dials)?
- Combine Week 1 + 2 for faster delivery?
- Test on staging first or direct to production?
