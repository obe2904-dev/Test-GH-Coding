# V5-ONLY Development Cleanup Plan

**Context**: Development stage - NO legacy data concerns  
**Goal**: Clean, robust code/prompts/database focused on V5 architecture only  
**Date**: 2026-06-23

---

## Strategic Decision: V5-ONLY Architecture

Since we're in development stage and don't need to maintain legacy V4 data:

✅ **FOCUS**: V5 brand-profile-generator-v5 architecture  
❌ **IGNORE**: V4 brand-profile-generator legacy fields  
🧹 **ACTION**: Drop all V4-only fields, clean up code reading them

---

## Analysis: 15 "Actively Used" Fields Reassessed

### ✅ KEEP (4 fields) - V5-Compatible or Valid NULL

1. **identity_keywords** - ✅ Already has V5-first fallback (keep)
2. **humor_level** - ✅ Already has V5-first fallback (keep)
3. **content_strategy_confirmed** - ✅ User action, NULL is valid (keep)
4. **certifications** - ✅ Manual data, NULL is valid (keep)

### ❌ DROP (10 fields) - V4-Only, V5 Has Replacements

5. **business_model_type** - V4 only → V5 has layer_0_intelligence.business_category
6. **audience_breadth** - V4 only → V5 has strategic_audience_segments
7. **classification_rationale** - V4 only, low value internal field
8. **voice_style** - BUGGY (maps to wrong field), not needed
9. **cta_style** - V4 only → can infer from commercial_baseline_mode
10. **commercial_strategy_reasoning** - V4 only, low value internal field
11. **quality_status** - V4 only, internal field
12. **content_pillars_jsonb** - V4 only → V5 has content_strategy.brand_anchors
13. **brand_essence_elaboration** - V4 only → V5 has identity.brand_essence (cleaner)
14. **values** - Rarely used, redundant with brand_essence

### 🚨 FIX (1 field) - V5 Gap

15. **commercial_baseline_mode** - V4 writes it, **V5 DOESN'T** → V5 generator needs to write this!

---

## Action Plan

### Phase 1: Fix V5 Generator Gap (CRITICAL)

**Issue**: V5 generator doesn't write `commercial_baseline_mode` but code expects it

**File**: `supabase/functions/brand-profile-generator-v5/index.ts`

**Action**: Add commercial_baseline_mode write after Layer 6 (Marketing Manager Brief)

```typescript
// After generating marketing_manager_brief, infer commercial mode
const commercialMode = inferCommercialMode(marketingBrief, programmes)

// Write to database
await supabase
  .from('business_brand_profile')
  .update({
    commercial_baseline_mode: commercialMode, // ADD THIS
    marketing_manager_brief: marketingBrief,
    // ... other V5 fields
  })
```

**Helper Function**:
```typescript
function inferCommercialMode(brief: string, programmes: any[]): 'booking_push' | 'footfall_push' | 'balanced' {
  // Check if business has booking-focused programmes
  const hasBookingProgrammes = programmes.some(p => 
    p.communication_objectives?.includes('booking') ||
    p.communication_objectives?.includes('reservation')
  )
  
  // Check marketing brief signals
  const briefLower = brief.toLowerCase()
  const hasBookingSignals = briefLower.includes('booking') || 
                           briefLower.includes('reservation') ||
                           briefLower.includes('book ahead')
  const hasFootfallSignals = briefLower.includes('walk-in') ||
                            briefLower.includes('foot traffic') ||
                            briefLower.includes('drop-in')
  
  if (hasBookingProgrammes || hasBookingSignals) return 'booking_push'
  if (hasFootfallSignals) return 'footfall_push'
  return 'balanced'
}
```

---

### Phase 2: Fix voice_style Bug

**Issue**: get-weekly-strategy maps brand_essence to voice_style (WRONG)

**File**: `supabase/functions/get-weekly-strategy/index.ts`

**Current Code (line 1374)** - WRONG:
```typescript
voice_style: brandProfile.brand_essence || '',
```

**Fixed Code** - Use V5 voice data:
```typescript
voice_style: brandProfile.brand_profile_v5?.voice?.tone_dna || 
             brandProfile.brand_essence || '', // fallback for safety
```

---

### Phase 3: Drop 10 V4-Only Fields from Database

**Migration File**: `supabase/migrations/20260623000003_drop_v4_legacy_fields.sql`

```sql
-- Drop 10 V4-only fields from business_brand_profile
ALTER TABLE business_brand_profile
  DROP COLUMN IF EXISTS business_model_type,
  DROP COLUMN IF EXISTS audience_breadth,
  DROP COLUMN IF EXISTS classification_rationale,
  DROP COLUMN IF EXISTS voice_style,
  DROP COLUMN IF EXISTS cta_style,
  DROP COLUMN IF EXISTS commercial_strategy_reasoning,
  DROP COLUMN IF EXISTS quality_status,
  DROP COLUMN IF EXISTS content_pillars_jsonb,
  DROP COLUMN IF EXISTS brand_essence_elaboration,
  DROP COLUMN IF EXISTS values;
```

---

### Phase 4: Remove Code Reading Dropped Fields

**Files to Clean**:

1. **get-quick-suggestions/index.ts**
   - Remove business_model_type read (lines 2581-2582)
   - Remove audience_breadth read (lines 2579-2580)
   - ✅ Keep identity_keywords (has V5-first fallback)
   - ✅ Keep humor_level (has V5-first fallback)

2. **get-weekly-strategy/index.ts**
   - Fix voice_style bug (line 1374)

3. **analyze-concept-fit/index.ts**
   - Remove cta_style reads (20+ matches) → use commercial_baseline_mode instead
   - Remove values read (line 1019) → redundant with brand_essence

4. **generate-weekly-plan/index.ts**
   - Remove brand_essence_elaboration read (line 356)

5. **brand-profile-generator/index.ts** (V4)
   - ⚠️ **DECISION NEEDED**: Deprecate entire V4 generator?
   - If keeping V4 for development, it can stay
   - If V5 is primary, consider removing V4 entirely

---

### Phase 5: Clean Up Type Definitions

**Files to Update**:
- Remove dropped fields from TypeScript interfaces
- Update SELECT queries to not fetch dropped fields
- Clean up test files

---

## Summary: Development-Stage Cleanup

### Database Changes
- ✅ **Keep**: 4 fields (identity_keywords, humor_level, content_strategy_confirmed, certifications)
- ❌ **Drop**: 10 V4-only fields
- 🔧 **Fix**: 1 V5 generator gap (commercial_baseline_mode)

### Code Changes
- 🐛 **Fix**: voice_style bug in get-weekly-strategy
- 🧹 **Remove**: All reads of dropped V4 fields (5 files)
- 🔧 **Add**: commercial_baseline_mode inference in V5 generator

### Result
- ✨ Clean V5-only architecture
- 🚀 No legacy baggage
- 📊 Smaller database schema (10 fewer columns)
- 🎯 Focused code paths (no V4 fallback complexity)

---

## Migration Order

1. **Phase 1 (CRITICAL)**: Fix V5 generator to write commercial_baseline_mode
2. **Phase 2**: Fix voice_style bug
3. **Phase 3**: Drop 10 V4 fields from database
4. **Phase 4**: Remove code reading dropped fields
5. **Phase 5**: Clean up types

**Estimated Time**: 3-4 hours for complete cleanup

---

## Final State: business_brand_profile Fields

**After Cleanup**:
- 9 migrated V5 fields (using extractors)
- 7 flattened V5 fields (written by V5)
- 4 kept legacy fields (V5-compatible or valid NULL)
- **Total fields dropped**: 10 (V4-only) + 8 (from Option 1) + 2 (Option A) = **20 fields cleaned up**

**Clean, robust, V5-focused architecture** ✨

---

## Next Steps

**Proceed with migration?**

- [ ] Phase 1: Fix V5 generator (commercial_baseline_mode)
- [ ] Phase 2: Fix voice_style bug
- [ ] Phase 3: Create & run migration to drop 10 fields
- [ ] Phase 4: Remove code reading dropped fields
- [ ] Phase 5: Clean up types

**All phases or step-by-step?**
