# V5.8: Marketing Manager Brief Consolidation & Phase 1 Integration

**Date:** 2026-07-XX  
**Status:** ✅ Implemented  
**Goal:** Consolidate persona architecture into single strategic source (marketing_manager_brief) and wire into Phase 1 weekly strategy generation

---

## Background

### The Problem

**Dual Persona Architecture Created Confusion:**
- `marketing_manager_brief` (V5.3): Synthesized ~200-word strategic guidance from all brand layers
- `business_identity_persona`: Legacy full business facts with embedded culinary character
- **Gap:** Both existed, but Phase 1 weekly strategy wasn't using marketing_manager_brief
- **Result:** Strategic guidance loaded but not injected into prompts (L1403 in get-weekly-strategy/index.ts)

### The Decision

**User Directive:** "We need to decide on using one, and as marketing_manager is latest and active let's use that"

**Chosen Solution:** Hybrid Enhancement
1. **Enhance** marketing_manager_brief generation with richer context (platforms, service periods, culinary synthesis)
2. **Wire** marketing_guidance into Phase 1 buildIdentityBlock() as primary source
3. **Keep** legacy fallback for businesses that haven't regenerated profiles

---

## Implementation Summary

### 1. Enhanced Marketing Manager Brief Interface

**File:** `supabase/functions/_shared/brand-profile/marketing-manager-brief-generator.ts`

**Added Fields:**
```typescript
export interface MarketingManagerBriefInput {
  // ... existing fields ...
  selectedPlatforms?: string[]  // NEW V5.8: From profiles.selected_platforms
  servicePeriods?: string[]     // NEW V5.8: Active service periods (from programmes)
}
```

**Purpose:** Enable platform-aware and service-period-aware strategic guidance

---

### 2. Enhanced Prompt Builder

**File:** `supabase/functions/_shared/brand-profile/marketing-manager-brief-generator.ts`  
**Function:** `buildMarketingBriefPrompt()`

**New Sections Added:**

#### Platform Context (L373-387)
```typescript
if (input.selectedPlatforms && input.selectedPlatforms.length > 0) {
  parts.push(`=== PLATFORME ===`)
  parts.push(`Aktive kanaler: ${input.selectedPlatforms.join(', ')}`)
  
  if (input.selectedPlatforms.length > 1) {
    parts.push(`VIGTIGT: Samme caption-tekst bruges på alle platforme.`)
    parts.push(`Kun hashtags og booking-CTA format varierer.`)
    parts.push(`Skriv derfor universelt - ikke platform-specifikt.`)
    parts.push(`Fokus på klarhed og substans frem for dogmatisk korthed.`)
  }
}
```

**Rationale:** Same text used on both Facebook and Instagram, only hashtags/CTA differ

#### Service Period Context (L389-396)
```typescript
if (input.servicePeriods && input.servicePeriods.length > 1) {
  parts.push(`=== AKTIVE SERVICEPERIODER ===`)
  parts.push(`Perioder: ${input.servicePeriods.join(', ')}`)
  parts.push(`OVERVEJ: Tone-forskelle mellem perioder (fx casual frokost, elevated aften).`)
}
```

**Rationale:** Multi-period businesses need tone calibration guidance (brunch=casual, dinner=elevated)

#### Enhanced Output Template
**Updated guidance:**
- **VIRKSOMHED:** Extract and synthesize culinary character from business_identity_persona
- **FREMHÆV ALTID:** Reference positioning_angles and location_gap for USP guidance
- **DIN STEMME:** 
  - Prioritize **clarity over brevity** (substance matters more than dogmatic shortness)
  - Multi-platform: Write universally, substansrigt, scanbart
  - Service period tone: Frokost=casual, Aften=elevated
- **STRATEGI:** Include goal_blend reference and programme-specific tone guidance

**Content Philosophy:** "Prioritér KLARHED over korthed - forklar hvad I tilbyder og hvorfor det betyder noget"

---

### 3. Phase 1 Integration

**File:** `supabase/functions/_shared/post-helpers/strategy/phase1.ts`  
**Function:** `buildIdentityBlock()`  
**Lines:** 357-396

**NEW Logic (V5.8):**
```typescript
function buildIdentityBlock(context: WeekContext): string {
  // NEW V5.8: Marketing guidance is the primary strategic source
  if (context.marketing_guidance) {
    return `## STRATEGISK RETNING\n\n${context.marketing_guidance}\n`;
  }
  
  // FALLBACK: Legacy field assembly (if marketing_guidance missing)
  const bv = context.brand_voice as any;
  const lines: string[] = [];
  // ... existing legacy logic ...
  return `## FORRETNINGSIDENTITET\n${lines.join('\n')}`;
}
```

**Impact:**
- When `marketing_guidance` present: Inject directly under "STRATEGISK RETNING" heading
- When missing: Fall back to legacy brand_essence/business_character assembly
- Ensures businesses with new profiles get consolidated guidance, old profiles still work

---

### 4. Type Safety

**File:** `supabase/functions/_shared/post-helpers/types/strategy-types.ts`  
**Interface:** `WeekContext`  
**Line:** 381-388

**Added Field:**
```typescript
/**
 * V5.8: Marketing manager brief — synthesized strategic guidance (~200 words).
 * Consolidates business identity, voice rules, positioning angles, USPs, and CTA strategy.
 * Prioritized over scattered legacy fields when available.
 * Generated by marketing-manager-brief-generator and stored in business_brand_profile.marketing_manager_brief.
 * When present, Phase 1 injects this directly under "STRATEGISK RETNING" instead of assembling identity from fragments.
 */
marketing_guidance?: string;
```

---

### 5. Data Pipeline

**File:** `supabase/functions/brand-profile-generator-v5/index.ts`

#### 5a. Fetch Selected Platforms

**Function:** `fetchBusinessData()`  
**Lines:** 291-379

**Added:**
```typescript
{ data: userProfile }  // From profiles table
] = await Promise.all([
  // ... existing fetches ...
  supabaseClient
    .from('profiles')
    .select('selected_platforms')
    .eq('business_id', businessId)
    .maybeSingle()
])
```

**Return type updated:**
```typescript
Promise<{
  // ... existing fields ...
  userProfile: any
}>
```

#### 5b. Extract & Pass Context

**Lines:** 1554-1607

**New Logic:**
```typescript
// V5.8: Extract service periods and platforms for enhanced marketing brief
const servicePeriods = [...new Set(dedupedProgrammesEnriched.map(p => p.programme.type))];
const selectedPlatforms = fetchedData.userProfile?.selected_platforms || [];

console.log(`Service periods: ${servicePeriods.join(', ')}`)
console.log(`Selected platforms: ${selectedPlatforms.join(', ')}`)

const marketingManagerBrief = await generateMarketingManagerBrief(
  {
    // ... existing fields ...
    selectedPlatforms: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
    servicePeriods: servicePeriods.length > 0 ? servicePeriods : undefined,
  },
  openaiClient,
  requestId
)
```

---

## Data Verification

**Test Businesses:**
1. **Café Faust** (02765409-46b9-4287-808f-21cf9d631f86)
2. **Restaurant Valdemar** (69c4a56b-5317-41ad-86a0-b2237393fbd1)

**Verified Data Availability:**
- ✅ Both have `marketing_manager_brief` and `business_identity_persona`
- ✅ Both have `selected_platforms`: ['facebook', 'instagram']
- ✅ Café Faust: 4 service periods (bar, brunch, dinner, lunch)
- ✅ Restaurant Valdemar: 3 service periods (all_day, dinner, lunch)
- ✅ Both have location_gap: 'premium_positioning'
- ✅ Both have complete tone_rules, formality_level, humor_style
- ✅ Both have positioning_angles from location strategy

**Query Used:**
```sql
SELECT 
  b.id,
  b.name,
  (bbp.brand_profile_v5->>'marketing_manager_brief') IS NOT NULL as has_mm_brief,
  (bbp.brand_profile_v5->>'business_identity_persona') IS NOT NULL as has_biz_persona,
  p.selected_platforms,
  jsonb_array_length((bbp.brand_profile_v5->'voice_profile'->'tone_rules')) as tone_rules_count,
  bbp.brand_profile_v5->'voice_profile'->>'formality_level' as formality,
  bbp.brand_profile_v5->'voice_profile'->>'humor_style' as humor,
  jsonb_array_length((bbp.brand_profile_v5->'location_strategy'->'positioning_angles')) as positioning_angles_count,
  bbp.brand_profile_v5->'location_strategy'->>'competitive_gap' as location_gap,
  (SELECT array_agg(DISTINCT service_period_name) 
   FROM menu_results_v2 
   WHERE business_id = b.id AND status = 'done') as service_periods
FROM businesses b
JOIN business_brand_profile bbp ON bbp.business_id = b.id
JOIN profiles p ON p.business_id = b.id
WHERE b.id IN (
  '02765409-46b9-4287-808f-21cf9d631f86',  -- Café Faust
  '69c4a56b-5317-41ad-86a0-b2237393fbd1'   -- Restaurant Valdemar
);
```

---

## Platform Strategy

**Clarified Behavior:**
- Same caption text used on **both Facebook and Instagram**
- **Differences:**
  - **Hashtags:** Platform-specific sets (generated post-text in `generate-text-from-idea`)
  - **CTA Formatting:** 
    - Facebook: Can include booking URL directly
    - Instagram: Always type='soft', no clickable URLs
- **Response Structure:**
  ```typescript
  {
    sharedText: string,
    facebook: { text: string, hashtags: string[], cta: {...} },
    instagram: { text: string, hashtags: string[], cta: {...} }
  }
  ```

**Implementation:** Already working correctly in `generate-text-from-idea/index.ts` L483-515

---

## Content Philosophy

**User Quote:** "As many texts have been very short we have put in these requirements. I know shorter texts are recommended but for our users and their customers we need to communicate what this business is about and what it offers and that is more important than a dogmatic rule with short texts"

**Design Response:**
- Prompt guidance: "Prioritér KLARHED over korthed"
- Example instruction: "Friskbagt croissant hver morgen, smør fra lokalt mejeri" (good) vs "God morgenmad" (too vague)
- Multi-platform note: "skriv universelt, substansrigt, scanbart"

**Rationale:** Substance over brevity — explain offerings and why they matter

---

## Testing Plan

### Phase 1: Regenerate Brand Profiles
```bash
# Test with Café Faust
curl -X POST https://[project-ref].supabase.co/functions/v1/brand-profile-generator-v5 \
  -H "Authorization: Bearer [anon-key]" \
  -H "Content-Type: application/json" \
  -d '{"businessId": "02765409-46b9-4287-808f-21cf9d631f86", "forceRegenerate": true}'

# Test with Restaurant Valdemar
curl -X POST https://[project-ref].supabase.co/functions/v1/brand-profile-generator-v5 \
  -H "Authorization: Bearer [anon-key]" \
  -H "Content-Type: application/json" \
  -d '{"businessId": "69c4a56b-5317-41ad-86a0-b2237393fbd1", "forceRegenerate": true}'
```

**Verify:**
- ✅ New `marketing_manager_brief` contains platform guidance section
- ✅ Contains "PLATFORME: Facebook, Instagram"
- ✅ Contains service period tone guidance if multi-period
- ✅ Contains location positioning angles in FREMHÆV ALTID section
- ✅ Contains "Prioritér KLARHED over korthed" in DIN STEMME section
- ✅ Word count remains ~200 words

### Phase 2: Generate Weekly Plan
```bash
# Test Phase 1 integration
curl -X POST https://[project-ref].supabase.co/functions/v1/get-weekly-strategy \
  -H "Authorization: Bearer [anon-key]" \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": "02765409-46b9-4287-808f-21cf9d631f86",
    "weekStart": "2026-07-14",
    "regenerate": true
  }'
```

**Verify:**
- ✅ Phase 1 prompt contains `## STRATEGISK RETNING` (not `## FORRETNINGSIDENTITET`)
- ✅ marketing_manager_brief text appears in full
- ✅ Strategic brief reflects location positioning
- ✅ Slot allocation consistent with service periods

### Phase 3: Generate Caption
```bash
# Test text generation uses enhanced brief
curl -X POST https://[project-ref].supabase.co/functions/v1/generate-text-from-idea \
  -H "Authorization: Bearer [anon-key]" \
  -H "Content-Type: application/json" \
  -d '{
    "postId": "[weekly_plan_post_id]",
    "regenerate": true
  }'
```

**Verify:**
- ✅ Caption reflects voice from marketing_manager_brief
- ✅ Location positioning mentioned if flagged as primary USP
- ✅ Text substantial (not dogmatically short)
- ✅ Same text in both facebook.text and instagram.text
- ✅ Hashtags differ between platforms
- ✅ CTA format appropriate per platform

---

## Migration Strategy

**Graceful Degradation:**
- Businesses with old brand profiles → legacy field assembly
- Businesses with V5.8 profiles → marketing_guidance takes priority
- No data loss — both fields preserved during transition

**Rollout:**
1. Deploy code (already backward-compatible)
2. Regenerate brand profiles for pilot businesses (Café Faust, Restaurant Valdemar)
3. Verify weekly plans use new guidance
4. Batch regenerate remaining businesses (optional, can happen organically)

**No Breaking Changes:**
- Phase 3 text generation already correctly prioritizes marketing_manager_brief
- Phase 1 gains new behavior but falls back gracefully
- WeekContext type allows optional marketing_guidance

---

## Files Modified

1. **supabase/functions/_shared/brand-profile/marketing-manager-brief-generator.ts**
   - Interface: Added `selectedPlatforms`, `servicePeriods`
   - Prompt: Added platform section, service period section, enhanced output template

2. **supabase/functions/_shared/post-helpers/strategy/phase1.ts**
   - Function: `buildIdentityBlock()` prioritizes marketing_guidance

3. **supabase/functions/_shared/post-helpers/types/strategy-types.ts**
   - Interface: Added `marketing_guidance?: string` to WeekContext

4. **supabase/functions/brand-profile-generator-v5/index.ts**
   - Function: `fetchBusinessData()` now fetches userProfile
   - Logic: Extracts servicePeriods and selectedPlatforms, passes to generateMarketingManagerBrief()

---

## Code Quality Assessment

**✅ No Compilation Errors** (verified with get_errors)
- All modified files pass TypeScript checks
- Pre-existing errors in phase1.ts unrelated to changes

**✅ Type Safety**
- All new fields properly typed
- Optional fields use `?:` syntax
- JSDoc documentation added

**✅ Backward Compatibility**
- Fallback logic preserves old behavior
- No required fields added to interfaces
- Graceful handling of missing data

**✅ Logging**
- Service periods logged at L1560
- Selected platforms logged at L1561
- Debugging enabled for future troubleshooting

---

## Next Steps

1. **Deploy to production** (code ready)
2. **Regenerate test business profiles** (Café Faust, Restaurant Valdemar)
3. **Verify weekly plan generation** uses new marketing_guidance
4. **Monitor caption quality** for substance vs. brevity balance
5. **Document learnings** in repo memory if patterns emerge

---

## Related Documentation

- User Memory: `/memories/weekly-plan-preferences.md`
- Repo Memory: `/memories/repo/v5-data-architecture-migration.md`
- Repo Memory: `/memories/repo/subscription-tier-architecture.md`

---

**Completion:** All tasks implemented and tested at code level. Ready for runtime validation.
