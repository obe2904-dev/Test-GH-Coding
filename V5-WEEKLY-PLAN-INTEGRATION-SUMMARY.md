# Weekly Plan V5 Integration - Implementation Summary

**Date:** 2026-05-09  
**Status:** Core implementation complete, deployment debugging in progress  
**Approach:** Pure V5 (brand_profile_v5 JSONB as single source of truth)

---

## ✅ Completed Work

### 1. Database Schema Migration
**File:** `supabase/migrations/20260509_create_photo_analysis_table.sql`

Created new `business_photo_analysis` table to properly separate photo analysis data from brand profile:

```sql
CREATE TABLE business_photo_analysis (
  business_id UUID PRIMARY KEY REFERENCES business_brand_profile(id),
  visual_character TEXT,
  interior_identity TEXT,
  venue_scene TEXT,
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  analysis_confidence NUMERIC(3,2) CHECK (analysis_confidence >= 0 AND analysis_confidence <= 1)
);
```

**Rationale:** Photo analysis (`visual_character`, `interior_identity`, `venue_scene`) is operational data, not brand strategy. Separating it allows clean V5 brand profile structure focused on strategic identity/voice.

**Action Required:** Execute this migration via Supabase dashboard SQL editor (migration history mismatch prevents CLI push).

---

### 2. V5 Transformation Helpers
**File:** `supabase/functions/_shared/brand-profile/v5-transformers.ts` (300 lines)

Created comprehensive transformation layer to bridge V5 JSONB structure → legacy `brand_voice` format that existing prompts expect.

#### Key Functions:

1. **`deriveContentStrategy(programmes)`**
   - Aggregates programme-level `commercialOrientation` into business-wide strategy
   - Calculates weighted average of goal splits (awareness/engagement/conversion)
   - Finds most common `decision_timing` across programmes
   - Returns fallback strategy for prompts that need single business-level strategy

2. **`deriveTargetAudience(programmes)`**
   - Combines `audienceSegments` from all programmes
   - Deduplicates and returns primary target audience

3. **`getActiveProgramme(programmes, day, time)`**
   - Time-aware programme selection for context-appropriate strategy
   - Filters by: day match → time window match → falls back to dominant programme
   - Enables context-aware content generation (brunch posts use brunch programme data)

4. **`getDominantProgramme(programmes)`**
   - Returns programme with highest confidence score
   - Used as fallback when no time-specific match

5. **`constructBrandVoiceFromV5(v5Profile)`**
   - **Main transformer:** Converts V5 layers into `brand_voice` object
   - Maps Layer 3 (identity) → `brand_essence`, `core_values`, `what_makes_us_different`
   - Maps Layer 5a (voice) → `tone_rules`, `personality_traits`, `formality_level`, `humor_style`
   - Maps Layer 5b (writing_examples) → `typical_openings`, `typical_closings`, `signature_phrases`
   - Maps Layer 5c (guardrails) → `never_say`, `content_exclusions`, `factual_constraints`
   - Derives `content_strategy` from programmes
   - Returns complete `brand_voice` object compatible with existing prompts

6. **Helper Formatters:**
   - `formatToneRules(voice)`: Numbered list for prompts
   - `formatGuardrails(guardrails)`: Formatted constraints
   - `formatCoreValues(identity)`: Bullet list

**Purpose:** Maintains backward compatibility with existing Phase 1/2 prompts while establishing V5 as single source of truth. Allows incremental prompt updates without big-bang refactor.

---

### 3. get-weekly-strategy V5 Integration
**File:** `supabase/functions/get-weekly-strategy/index.ts`

#### Changes Made:

**A. Imports Updated (lines 15-30)**
```typescript
// REMOVED: V5 flags, fetchV5IdentityProfile, IdentityProfile
// ADDED: getV5Profile, constructBrandVoiceFromV5, deriveContentStrategy, 
//        deriveTargetAudience, getActiveProgramme, formatToneRules, 
//        formatGuardrails, V5BrandProfile
```

**B. Data Fetching Replaced (lines 220-310)**
```typescript
// OLD: SELECT brand_essence, tone_of_voice, content_focus, target_audience, 
//      ...28 legacy columns FROM business_brand_profile
// NEW: getV5Profile(dataClient, businessId) → V5BrandProfile
//      + business_photo_analysis fetch
//      + legacy brand_context (temporary, for backward compatibility)
```

**Fail-Fast Validation:**
```typescript
if (!v5Profile) {
  return new Response(JSON.stringify({
    success: false,
    error: 'V5 Brand Profile not generated. Please generate brand profile first.',
    missing_profile: true
  }), { status: 400 })
}
```

Forces V5 profile generation before weekly strategy can run (no silent fallbacks).

**C. brand_voice Construction Replaced (lines 1096-1157)**
```typescript
// OLD: 133 lines of manual parsing/transformation
// NEW: Single constructBrandVoiceFromV5(v5Profile) call
//      + Photo analysis data injection
//      + Price level from operations
//      + Legacy brand_context (temporary)
```

**D. Programme Extraction Updated (lines 930-970)**
```typescript
// OLD: Extract from audience_segments.timing_windows
// NEW: Use v5Profile.programmes directly
```

**E. V5 Profile in Context Snapshot (line 1157)**
```typescript
v5_profile: v5Profile,  // Added for generate-weekly-plan to reconstruct context
```

**F. Legacy brandProfile References Removed (lines 938, 958, 1046, 1054)**
```typescript
// OLD: brandProfile.business_character
// NEW: v5Profile.identity.positioning

// OLD: brandProfile.booking_link  
// NEW: operations.booking_link || legacyBrandContext.booking_link

// OLD: Extract programmes from brandProfile.audience_segments
// NEW: v5Profile.programmes
```

---

## ⚠️ Current Status: Deployment Debugging

### Issue:
Deno bundler failing with parse error:
```
Expected ',', got 'catch' at ...get-weekly-strategy/index.ts:1558:5
```

### Attempted Fixes:
1. ✅ Changed brand_voice IIFE from arrow function to regular function
2. ✅ Unnested price_level IIFE
3. 🔄 Still debugging - syntax appears correct to TypeScript, but Deno parser rejects

### Next Steps for Debugging:
1. Check for invisible characters or encoding issues
2. Try isolating the brand_voice IIFE into a separate helper function
3. Verify all braces/parentheses match (automated bracket matching tool)
4. Test with simpler brand_voice construction (remove IIFEs entirely)

---

## 📋 Remaining Work

### Phase 1: Data Layer (Current)
- [x] business_photo_analysis table migration
- [x] V5 transformation helpers  
- [x] get-weekly-strategy V5 integration
- [ ] **Debug and deploy get-weekly-strategy**
- [ ] Execute photo_analysis migration in database
- [ ] Test weekly strategy generation for Café Faust

### Phase 2: Prompt Updates (Week 2)
- [ ] Update Phase 1 prompt (phase1.ts lines 406-480)
  - Replace PERSONALITY ANCHOR section
  - Use formatToneRules(), formatGuardrails(), formatCoreValues()
  - Structure: V5 Identity → Voice → Writing Examples → Guardrails → Programme strategy
- [ ] Update Phase 2 prompts (phase2ab-unified.ts lines 158-160)
  - Replace voiceConstraints with v5_guardrails
  - Add tone_rules reminder

### Phase 3: Testing & Validation (Week 2-3)
- [ ] Generate weekly strategy for Café Faust with V5 profile
- [ ] Compare output quality vs legacy (tone accuracy, brand consistency)
- [ ] Verify week_context_snapshot contains v5_profile
- [ ] Test generate-weekly-plan can reconstruct context from snapshot

### Phase 4: Rollout & Cleanup (Week 3)
- [ ] Backfill V5 profiles for other businesses
- [ ] Update generate-weekly-plan consumer (use v5_profile from snapshot)
- [ ] Monitor production logs for V5-related errors
- [ ] Deprecate legacy brand_profile columns (mark for removal)

---

## 🎯 Architecture Decisions

### Pure V5 Approach (Chosen)
- brand_profile_v5 JSONB is single source of truth
- No dual code paths (no hybrid legacy/V5 logic)
- Fail-fast validation (require V5 profile, no silent fallbacks)
- Transformation layer for backward compatibility
- Clean separation: brand strategy (V5) ≠ photo analysis (separate table)

### Benefits:
1. **Clean architecture:** Single source of truth eliminates sync issues
2. **Maintainability:** No complex conditional logic for legacy vs V5
3. **Clarity:** Obvious which businesses need V5 migration
4. **Future-proof:** Easy to update prompts to native V5 structure later
5. **Incremental migration:** Transformation layer allows gradual prompt updates

### Tradeoffs:
1. Requires V5 profile generation for all businesses (one-time cost)
2. Transformation overhead (minimal - runs once per week per business)
3. Week_context_snapshot slightly larger (includes full V5 profile)

---

## 📊 Testing Readiness

### Test Business: Café Faust
- **Business ID:** `2037d63c-a138-4247-89c5-5b6b8cef9f3f`
- **V5 Profile:** ✅ Complete (all 5 layers generated)
- **V5 Quality:** ✅ Verified (AI reasoning displays correctly in frontend)

### Test Checklist (After Deployment):
1. Call get-weekly-strategy for Café Faust
2. Verify V5 profile loaded successfully (check logs)
3. Verify brand_voice constructed correctly (check snapshot)
4. Verify Phase 0→1→2ab→2c flow completes
5. Compare strategic_brief quality to previous weeks
6. Check week_context_snapshot contains v5_profile
7. Verify generate-weekly-plan can load v5_profile from snapshot

---

## 🔗 Dependencies

### Edge Functions:
- **get-weekly-strategy** (this file) → Uses V5 transformation helpers
- **generate-weekly-plan** → Will use v5_profile from week_context_snapshot (future update)
- **brand-profile-generator-v5** → Generates V5 profiles (deployed, working)

### Database Tables:
- **business_brand_profile** → brand_profile_v5 JSONB column (single source of truth)
- **business_photo_analysis** → NEW table (migration pending)
- **weekly_strategies** → Stores week_context_snapshot with v5_profile

### Frontend:
- **BrandProfilePageV5.tsx** → Displays V5 profile (working, verified)
- **AI Weekly Plan page** → Calls get-weekly-strategy (will use V5 after deployment)

---

## 📝 Key Learnings

1. **Separation of Concerns:** Photo analysis ≠ brand strategy → separate tables
2. **Time-Aware Programmes:** V5's programme.timeWindow enables context-aware content
3. **Transformation Layer:** Enables Pure V5 approach without big-bang prompt refactor
4. **Fail-Fast Validation:** Better than silent fallbacks for development clarity
5. **JSONB Single Source:** Eliminates 28-column fragmentation, improves consistency

---

## 🚀 Next Actions

### Immediate (Developer):
1. Debug Deno parse error in get-weekly-strategy/index.ts
2. Deploy get-weekly-strategy with V5 integration
3. Execute business_photo_analysis migration via Supabase dashboard

### Week 2 (Prompt Updates):
4. Update Phase 1 prompt to use V5 structure natively
5. Update Phase 2 prompts for V5 guardrails
6. Test weekly strategy generation end-to-end

### Week 3 (Rollout):
7. Backfill V5 profiles for remaining businesses
8. Update generate-weekly-plan to use v5_profile snapshot
9. Monitor production, deprecate legacy columns

---

**Integration Philosophy:** "Clean V5-based system with preserved robustness"  
**Migration Strategy:** Pure V5 (no hybrid), fail-fast validation, transformation layer for compatibility  
**Success Metric:** Weekly strategies generated from V5 profile with equal/better quality than legacy
