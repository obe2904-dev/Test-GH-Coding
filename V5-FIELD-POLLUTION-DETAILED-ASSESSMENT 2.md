# V5 Field Pollution Assessment - Detailed Analysis

**Purpose**: Analyze 15 actively-used fields for value, population status, and action plan  
**Created**: 2026-06-23  
**Context**: Fields marked as "schema-only" but actively read by Edge Functions - potential NULL pollution

---

## Executive Summary

**CRITICAL FINDING**: Both V4 and V5 generators are still active:
- `brand-profile-generator` (V4) - called by `useBrandProfileGeneration.ts`  
- `brand-profile-generator-v5` (V5) - called by `useBrandProfileV5Generation.ts`

This means V4 fields ARE being written for some businesses, while others may have only V5 data.

**Result**: When code reads V4 fields but business has only V5 profile → NULL pollution in prompts!

---

## Assessment Framework

For each field, we analyze:
1. **VALUE**: Does this information provide value to content generation?
2. **WRITE PATTERN**: Which generator writes it? V4, V5, or both?
3. **READ PATTERN**: Where is it read? Active Edge Functions?
4. **V5 EQUIVALENT**: Does V5 have a replacement in brand_profile_v5 JSONB?
5. **NULL POLLUTION RISK**: What % of businesses likely have NULL (V5-only profiles)?
6. **ACTION**: Keep, drop, or migrate to V5 extractor?

---

## Field-by-Field Analysis

### 1. business_model_type

**VALUE**: ⚠️ MODERATE
- Used in get-quick-suggestions to infer audience type
- Helps categorize business (e.g., "neighborhood cafe" vs "destination restaurant")

**WRITE PATTERN**: ✍️ V4 ONLY
- Written by brand-profile-generator (V4) at line 1250
- Part of B0 classification stage
- NOT written by V5

**READ PATTERN**: 📖 ACTIVE
- get-quick-suggestions lines 2581-2582
- Used to determine businessModelTypeQS variable

**V5 EQUIVALENT**: ✅ YES
- V5 Layer 0: `brand_profile_v5.layer_0_intelligence.business_category`
- V5 Layer 1: `brand_profile_v5.programmes[].type`

**NULL POLLUTION RISK**: 🔴 HIGH
- All V5-only businesses have NULL
- Estimate: 50-80% of active businesses (if V5 is now primary)

**RECOMMENDED ACTION**: 🔄 **MIGRATE TO V5 EXTRACTOR**
```typescript
// Create extractBusinessModelType() in v5-extractors.ts
function extractBusinessModelType(brandProfile: any): string {
  if (brandProfile.brand_profile_v5?.layer_0_intelligence?.business_category) {
    return brandProfile.brand_profile_v5.layer_0_intelligence.business_category
  }
  // Fallback to V4 field
  return brandProfile.business_model_type || ''
}
```

---

### 2. audience_breadth

**VALUE**: ⚠️ MODERATE
- Used in get-quick-suggestions to understand audience scope
- Helps tune content specificity (broad vs niche)

**WRITE PATTERN**: ✍️ V4 ONLY
- Written by brand-profile-generator (V4) at line 1252
- Part of B0 classification stage

**READ PATTERN**: 📖 ACTIVE
- get-quick-suggestions lines 2579-2580

**V5 EQUIVALENT**: ✅ YES
- V5 Layer 4: `brand_profile_v5.layer_4_audience_strategy.strategic_audience_segments`
- Can infer breadth from number/diversity of segments

**NULL POLLUTION RISK**: 🔴 HIGH
- All V5-only businesses have NULL

**RECOMMENDED ACTION**: 🔄 **MIGRATE TO V5 EXTRACTOR**
```typescript
function extractAudienceBreadth(brandProfile: any): string {
  const v5Audiences = brandProfile.brand_profile_v5?.layer_4_audience_strategy?.strategic_audience_segments
  if (v5Audiences && Array.isArray(v5Audiences)) {
    // Infer breadth from audience diversity
    return v5Audiences.length > 3 ? 'broad' : 'niche'
  }
  return brandProfile.audience_breadth || ''
}
```

---

### 3. classification_rationale

**VALUE**: ⚠️ LOW
- Internal field explaining business classification reasoning
- NOT used in prompts, only in B0 classification stage

**WRITE PATTERN**: ✍️ V4 ONLY
- Written by brand-profile-generator (V4)
- Part of B0 classification output

**READ PATTERN**: 📖 MINIMAL
- Only read by brand-profile-generator (V4) itself
- Not used in content generation

**V5 EQUIVALENT**: ✅ YES
- V5 Layer 0: `brand_profile_v5.layer_0_intelligence` (implicit reasoning)

**NULL POLLUTION RISK**: 🟡 MEDIUM
- Not in active prompts, so NULL doesn't pollute content generation

**RECOMMENDED ACTION**: ⚪ **KEEP FOR V4 COMPATIBILITY**
- Low priority - only needed if V4 generator is still active
- If V4 is deprecated, can drop

---

### 4. voice_style

**VALUE**: 🔴 CRITICAL (BUT MISUSED!)
- Used in get-weekly-strategy line 1374
- **BUT**: Mapped to wrong field! Maps brand_essence to voice_style

**WRITE PATTERN**: ✍️ UNKNOWN
- No grep matches for `voice_style:` writes
- Appears to be legacy/unused field

**READ PATTERN**: 📖 ACTIVE BUT WRONG
```typescript
// get-weekly-strategy/index.ts:1374
voice_style: brandProfile.brand_essence || '',
```
This is a BUG! Should read from voice fields, not brand_essence.

**V5 EQUIVALENT**: ✅ YES
- V5 voice: `brand_profile_v5.voice.tone_dna`

**NULL POLLUTION RISK**: 🟡 MEDIUM
- Field itself is likely always NULL
- But code reads brand_essence instead (wrong but functional)

**RECOMMENDED ACTION**: 🐛 **FIX BUG + DROP FIELD**
```typescript
// BEFORE (wrong):
voice_style: brandProfile.brand_essence || '',

// AFTER (correct):
voice_style: extractVoiceStyle(brandProfile), // reads from V5 voice.tone_dna
```

---

### 5. cta_style

**VALUE**: ✅ HIGH
- Used extensively in analyze-concept-fit (20+ matches)
- Determines CTA tone (friendly_invite, direct_action, community_style, book_ahead)

**WRITE PATTERN**: ✍️ V4 ONLY
- Written by brand-profile-generator (V4) with fallback logic
- Lines 461, 463, 510, 514, 638-639, 686-688

**READ PATTERN**: 📖 VERY ACTIVE
- analyze-concept-fit (primary CTA logic)
- brand-profile-generator (V4 validation)

**V5 EQUIVALENT**: ❓ PARTIAL
- V5 has `marketing_manager_brief` but not explicit CTA style
- May need to infer from voice + commercial mode

**NULL POLLUTION RISK**: 🔴 HIGH
- All V5-only businesses have NULL
- CTA logic degrades to generic defaults

**RECOMMENDED ACTION**: 🔄 **MIGRATE OR DEPRECATE**

**Option A: Migrate to V5 extractor**
```typescript
function extractCTAStyle(brandProfile: any): string {
  // Try V5 inference from voice + commercial mode
  const v5Brief = brandProfile.marketing_manager_brief
  const commercialMode = brandProfile.commercial_baseline_mode
  
  if (v5Brief && commercialMode) {
    // Infer CTA style from brief + mode
    if (commercialMode === 'booking_push') return 'book_ahead'
    if (v5Brief.includes('community')) return 'community_style'
    // ... logic
  }
  
  // Fallback to V4
  return brandProfile.cta_style || 'friendly_invite'
}
```

**Option B: Deprecate and use commercial_baseline_mode**
- analyze-concept-fit already has commercial_baseline_mode
- Could simplify to just use that instead of cta_style

---

### 6. commercial_baseline_mode

**VALUE**: ✅ CRITICAL
- Core commercial strategy field
- Used in commercial-mode-classifier and multiple tests
- Determines booking_push vs footfall_push vs balanced

**WRITE PATTERN**: ✍️ V4 ONLY
- Written by brand-profile-generator (V4) line 2182
- Part of commercial strategy stage

**READ PATTERN**: 📖 VERY ACTIVE
- commercial-mode-classifier.ts line 242
- commercial-mode tests (20+ matches)
- Type definitions across multiple files

**V5 EQUIVALENT**: ❌ NO
- V5 does NOT write this field
- V5 has marketing_manager_brief but not explicit mode

**NULL POLLUTION RISK**: 🔴 CRITICAL
- All V5-only businesses have NULL
- Commercial logic falls back to 'balanced' (line 242)

**RECOMMENDED ACTION**: 🚨 **CRITICAL - NEEDS V5 GENERATION**

This field is CRITICAL but V5 doesn't write it!

**Option A: Add to V5 generator**
- V5 should write commercial_baseline_mode during Layer 6 (Marketing Manager Brief)

**Option B: Extractor with intelligent inference**
```typescript
function extractCommercialBaselineMode(brandProfile: any): string {
  // V5 path: infer from marketing_manager_brief
  const v5Brief = brandProfile.marketing_manager_brief
  if (v5Brief) {
    // Parse brief for commercial intent signals
    if (v5Brief.includes('booking') || v5Brief.includes('reservation')) {
      return 'booking_push'
    }
    // ... logic
  }
  
  // V4 path
  return brandProfile.commercial_baseline_mode || 'balanced'
}
```

---

### 7. commercial_strategy_reasoning

**VALUE**: ⚠️ LOW
- Internal reasoning text
- Written by V4 generator but not heavily used in prompts

**WRITE PATTERN**: ✍️ V4 ONLY
- Written by brand-profile-generator (V4) line 2184

**READ PATTERN**: 📖 MINIMAL
- Type definitions only, not in active prompts

**V5 EQUIVALENT**: ✅ YES
- V5: `brand_profile_v5.layer_6_marketing_manager_brief` (implicit reasoning)

**NULL POLLUTION RISK**: 🟡 LOW
- Not in active prompts

**RECOMMENDED ACTION**: ⚪ **KEEP FOR V4 COMPATIBILITY** or **DROP**
- Low impact - not affecting content generation quality

---

### 8. identity_keywords

**VALUE**: ✅ HIGH
- Used in generate-text-from-idea and get-quick-suggestions
- Provides 3-5 identity chips (what the business IS)

**WRITE PATTERN**: ✍️ V4 ONLY
- Written by brand-profile-generator (V4) lines 764-766, 2533

**READ PATTERN**: 📖 ACTIVE
- generate-text-from-idea lines 347-349
- get-quick-suggestions lines 2628-2639
- ai-enhance line 83

**V5 EQUIVALENT**: ✅ YES
- V5: `brand_profile_v5.layer_0_intelligence.category_keywords`

**NULL POLLUTION RISK**: 🔴 HIGH
- All V5-only businesses have NULL
- **ALREADY HAS V5-FIRST FALLBACK** in code! (get-quick-suggestions line 2628)

**RECOMMENDED ACTION**: ✅ **ALREADY MIGRATED!**
```typescript
// get-quick-suggestions already has V5-first fallback:
if (v5Identity?.category_keywords) {
  // V5 path
} else if ((brandProfile as any).identity_keywords) {
  // V4 fallback
}
```

**NOTE**: This field is FINE - no action needed!

---

### 9. humor_level

**VALUE**: ✅ MODERATE
- Modulates tone instructions (none, subtle, playful, bold)
- Used in get-quick-suggestions for humor register

**WRITE PATTERN**: ✍️ V4 ONLY + V5 MIGRATION
- V4 writes it (brand-profile-generator)
- V5 MIGRATES it from legacy (brand-profile-generator-v5 lines 1149-1152)

**READ PATTERN**: 📖 ACTIVE
- get-quick-suggestions lines 2459-2462
- brand-voice types (fallback logic)

**V5 EQUIVALENT**: ✅ YES
- V5: `brand_profile_v5.voice.humor_style`
- **ALREADY HAS V5-FIRST FALLBACK** (get-quick-suggestions line 2462)

**NULL POLLUTION RISK**: 🟢 LOW
- V5 migrates legacy value
- V5-first fallback already in code

**RECOMMENDED ACTION**: ✅ **ALREADY MIGRATED!**
```typescript
// get-quick-suggestions already has V5-first fallback:
const humorLevel = v5Voice?.humor_style ?? (brandProfile as any).humor_level
```

**NOTE**: This field is FINE - no action needed!

---

### 10. content_strategy_confirmed

**VALUE**: ⚠️ LOW
- Boolean flag indicating manual confirmation
- Used in get-quick-suggestions line 2389

**WRITE PATTERN**: ✍️ MANUAL/FRONTEND
- Likely set by user action in frontend
- Not generated by AI

**READ PATTERN**: 📖 MINIMAL
- get-quick-suggestions line 2389 (isConfirmed check)

**V5 EQUIVALENT**: ❌ NO
- User action field, not AI-generated

**NULL POLLUTION RISK**: 🟡 MEDIUM
- Most businesses likely have NULL (not confirmed)
- NULL is valid state (not confirmed)

**RECOMMENDED ACTION**: ✅ **KEEP - VALID NULL STATE**
- NULL means "not confirmed" which is correct
- No action needed

---

### 11. values

**VALUE**: ⚠️ LOW
- Business values array
- Used in analyze-concept-fit line 1019

**WRITE PATTERN**: ✍️ UNKNOWN
- No grep matches for writes
- Likely legacy/deprecated

**READ PATTERN**: 📖 MINIMAL
- analyze-concept-fit (prompt context only)

**V5 EQUIVALENT**: ✅ YES
- V5: `brand_profile_v5.identity.core_values` (deprecated in V5 but extractor exists)

**NULL POLLUTION RISK**: 🟡 MEDIUM
- Not heavily used

**RECOMMENDED ACTION**: 🔄 **MIGRATE OR DROP**
- Can use extractCoreValues() if needed
- Or remove from analyze-concept-fit prompt (values are in brand_essence anyway)

---

### 12. certifications

**VALUE**: ⚠️ LOW
- Business certifications array
- Used in strategy-feasibility-validator line 356

**WRITE PATTERN**: ✍️ UNKNOWN
- No grep matches for writes
- Likely manual entry or legacy

**READ PATTERN**: 📖 MINIMAL
- strategy-feasibility-validator (concept filtering)

**V5 EQUIVALENT**: ❌ NO
- User/manual data, not AI-generated

**NULL POLLUTION RISK**: 🟢 LOW
- NULL is valid (no certifications)
- Falls back to empty array in code

**RECOMMENDED ACTION**: ✅ **KEEP - VALID NULL STATE**
- NULL means "no certifications" which is correct
- Already handles NULL gracefully: `|| []`

---

### 13. quality_status

**VALUE**: ⚠️ LOW
- Internal quality flag (green/yellow/red)
- Used in brand-profile-generator (V4) only

**WRITE PATTERN**: ✍️ V4 ONLY
- Written by brand-profile-generator (V4) lines 1446, 1471, 2529

**READ PATTERN**: 📖 MINIMAL
- Only read by brand-profile-generator (V4) itself
- Not used in content generation

**V5 EQUIVALENT**: ❌ NO
- V5 doesn't have quality status

**NULL POLLUTION RISK**: 🟡 LOW
- Not in prompts

**RECOMMENDED ACTION**: ⚪ **KEEP FOR V4 COMPATIBILITY** or **DROP**
- Only needed if V4 is still active
- Can drop if V4 deprecated

---

### 14. content_pillars_jsonb

**VALUE**: ⚠️ LOW  
- Content pillar structure
- Written and read by brand-profile-generator (V4) only

**WRITE PATTERN**: ✍️ V4 ONLY
- Written by brand-profile-generator (V4) lines 1457-1458, 2520

**READ PATTERN**: 📖 V4 ONLY
- Only read by brand-profile-generator (V4) for persistence

**V5 EQUIVALENT**: ✅ YES
- V5: `brand_profile_v5.content_strategy.brand_anchors`

**NULL POLLUTION RISK**: 🟢 LOW
- Not used in active content generation
- V4 internal field only

**RECOMMENDED ACTION**: ⚪ **KEEP FOR V4 COMPATIBILITY** or **DROP**
- Only needed if V4 is still active

---

### 15. brand_essence_elaboration

**VALUE**: ⚠️ MODERATE
- Elaborated brand essence text
- Used in generate-weekly-plan and V4 generator validation

**WRITE PATTERN**: ✍️ V4 ONLY
- Written by brand-profile-generator (V4) lines 758-761

**READ PATTERN**: 📖 ACTIVE
- generate-weekly-plan line 356
- brand-profile-generator validation lines 551, 566

**V5 EQUIVALENT**: ✅ YES
- V5: `brand_profile_v5.identity.brand_essence` (more concise)

**NULL POLLUTION RISK**: 🟡 MEDIUM
- V5 has brand_essence but not "elaboration"
- generate-weekly-plan may get NULL for V5 profiles

**RECOMMENDED ACTION**: 🔄 **MIGRATE TO V5 EXTRACTOR**
```typescript
function extractBrandEssenceElaboration(brandProfile: any): string {
  // V5 path: use brand_essence (no separate elaboration)
  if (brandProfile.brand_profile_v5?.identity?.brand_essence) {
    return brandProfile.brand_profile_v5.identity.brand_essence
  }
  // V4 path
  return brandProfile.brand_essence_elaboration || brandProfile.brand_essence || ''
}
```

---

## Summary Table

| Field | Value | Write | Read | V5 Equiv | NULL Risk | Action |
|-------|-------|-------|------|----------|-----------|--------|
| business_model_type | MODERATE | V4 only | Active | ✅ Yes | 🔴 HIGH | 🔄 Migrate |
| audience_breadth | MODERATE | V4 only | Active | ✅ Yes | 🔴 HIGH | 🔄 Migrate |
| classification_rationale | LOW | V4 only | Minimal | ✅ Yes | 🟡 MEDIUM | ⚪ Keep/Drop |
| voice_style | CRITICAL | None | ACTIVE BUG | ✅ Yes | 🟡 MEDIUM | 🐛 Fix Bug |
| cta_style | HIGH | V4 only | Very Active | ❓ Partial | 🔴 HIGH | 🔄 Migrate |
| commercial_baseline_mode | CRITICAL | V4 only | Very Active | ❌ NO | 🔴 CRITICAL | 🚨 V5 Generate |
| commercial_strategy_reasoning | LOW | V4 only | Minimal | ✅ Yes | 🟡 LOW | ⚪ Keep/Drop |
| identity_keywords | HIGH | V4 only | Active | ✅ Yes | 🟢 LOW | ✅ Already Fixed |
| humor_level | MODERATE | V4+V5 | Active | ✅ Yes | 🟢 LOW | ✅ Already Fixed |
| content_strategy_confirmed | LOW | Manual | Minimal | ❌ N/A | 🟡 MEDIUM | ✅ Keep |
| values | LOW | Unknown | Minimal | ✅ Yes | 🟡 MEDIUM | 🔄 Migrate or Drop |
| certifications | LOW | Manual | Minimal | ❌ N/A | 🟢 LOW | ✅ Keep |
| quality_status | LOW | V4 only | Minimal | ❌ NO | 🟡 LOW | ⚪ Keep/Drop |
| content_pillars_jsonb | LOW | V4 only | V4 only | ✅ Yes | 🟢 LOW | ⚪ Keep/Drop |
| brand_essence_elaboration | MODERATE | V4 only | Active | ✅ Yes | 🟡 MEDIUM | 🔄 Migrate |

---

## Priority Actions

### 🚨 CRITICAL (Do First)

**1. Fix commercial_baseline_mode**
- V5 doesn't write it but code expects it
- All V5 businesses fall back to 'balanced'
- **ACTION**: Add commercial_baseline_mode to V5 generator OR create smart extractor

**2. Fix voice_style bug**
- get-weekly-strategy maps brand_essence to voice_style (WRONG)
- **ACTION**: Fix mapping to use actual voice data

### 🔴 HIGH PRIORITY (NULL Pollution)

**3. Migrate business_model_type** - V5 extractor reading from layer_0_intelligence.business_category
**4. Migrate audience_breadth** - V5 extractor inferring from strategic_audience_segments
**5. Migrate cta_style** - V5 extractor or deprecate in favor of commercial_baseline_mode
**6. Migrate brand_essence_elaboration** - V5 extractor using identity.brand_essence

### ✅ ALREADY FIXED

**7. identity_keywords** - Already has V5-first fallback in get-quick-suggestions
**8. humor_level** - Already has V5-first fallback in get-quick-suggestions

### ⚪ LOW PRIORITY (V4 Compatibility)

**9. classification_rationale** - Keep if V4 active, drop if V4 deprecated
**10. commercial_strategy_reasoning** - Keep if V4 active, drop if V4 deprecated
**11. quality_status** - Keep if V4 active, drop if V4 deprecated
**12. content_pillars_jsonb** - Keep if V4 active, drop if V4 deprecated

### ✅ KEEP (Valid NULL States)

**13. content_strategy_confirmed** - Boolean flag, NULL is valid (not confirmed)
**14. certifications** - Array field, NULL is valid (no certifications)

### 🔄 REVIEW

**15. values** - Rarely used, can migrate or drop from analyze-concept-fit

---

## Next Steps - User Decision Required

**Option 1: Conservative (Recommended)**
- Fix 2 critical issues (commercial_baseline_mode, voice_style bug)
- Migrate 4 high-priority fields to V5 extractors
- Keep low-priority V4 compatibility fields
- Total: 6 fixes

**Option 2: Aggressive**
- Same as Option 1
- Drop all V4-only fields (assume V4 will be deprecated)
- Drop values from analyze-concept-fit
- Total: 6 fixes + 5 drops

**Option 3: Database Verification First**
- Run `_verify_brand_profile_fields_status.sql` queries
- See actual NULL % for each field
- Then decide based on data

---

**Which option would you like to proceed with?**
