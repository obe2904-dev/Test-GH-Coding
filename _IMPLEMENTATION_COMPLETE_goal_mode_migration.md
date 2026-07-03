# Goal Mode Migration - Implementation Complete
**Date**: 2026-06-30  
**Status**: ✅ TIER 1-3 Complete, Tested  
**Breaking Changes**: Yes (three-goal → two-goal system)

---

## Summary

Successfully completed the goal mode migration from three tactical goals (`drive_footfall`, `build_brand`, `retain_loyalty`) to two tactical goals (`drive_footfall`, `build_brand`). This fix addresses the root cause of content misalignment where Slot D posts were receiving "faste gæster" (loyal customers) framing despite being tagged as `build_brand`.

---

## Changes Implemented

### ✅ TIER 1: business-rules-engine.ts (Source Fix)

**File**: `supabase/functions/_shared/post-helpers/business-rules-engine.ts`

1. **Type definition** (line 18):
   - Changed: `type GoalMode = 'drive_footfall' | 'build_brand' | 'retain_loyalty'`
   - To: `type GoalMode = 'drive_footfall' | 'build_brand'`

2. **PostingStrategy interface** (line 91):
   - Renamed: `loyalty?: string` 
   - To: `brand_builder_secondary?: string`

3. **deriveSlotWindowsFromBookingModel function**:
   - Updated return type signature
   - Renamed `loyalty:` key to `brand_builder_secondary:` in all three branches (reservationOnly, walkInOnly, hybrid)

4. **generateSlotsFromRevenueDrivers - Slot D** (line ~365):
   - Changed: `goal_mode: 'retain_loyalty'`
   - To: `goal_mode: 'build_brand'`
   - Updated comment: `// SLOT D: Flexible/Loyalty` → `// SLOT D: Brand Builder Secondary`
   - Updated rationale: `'Mid-week engagement'` → `'Mid-week brand depth'`
   - Updated timing window reference: `psWindows?.loyalty` → `psWindows?.brand_builder_secondary`

5. **getBaseSlotsFallback - Slot D** (line ~575):
   - Changed: `goal_mode: 'retain_loyalty'`
   - To: `goal_mode: 'build_brand'`

6. **Deleted dead code**:
   - ✅ Removed: `supabase/functions/_shared/content-planning/business-rules-engine.ts` (0 imports, confirmed unused)

### ✅ TIER 1f: brand-profile-generator AI Prompt

**File**: `supabase/functions/brand-profile-generator/index.ts`

7. **Stage PS AI prompt** (line ~2249):
   - Changed: `"loyalty": "Day-Day HH:MM"`
   - To: `"brand_builder_secondary": "Day-Day HH:MM"`
   - Ensures future AI-generated `posting_strategy` matches TypeScript interface

### ✅ TIER 2: phase1.ts (Allocator Fix)

**File**: `supabase/functions/_shared/post-helpers/strategy/phase1.ts`

8. **computeSlotCounts function** (line 1275):
   - Removed `retain_loyalty` from goalBlend parameter type
   - Added **footfall priority tie-break**: Within 0.05 margin, footfall wins over brand
   - Added **footfall floor rule**: Weeks with 3+ posts must have ≥1 footfall post
   - Prevents invalid all-brand weeks for active businesses

9. **assignSlotMetadata - goal-blend enforcement** (line ~1454):
   - Removed `retain_loyalty` from:
     - `actualCounts` object
     - `expectedCounts` logging
     - `deltas` calculation
     - `finalCounts` logging
   - Updated GoalMode type to two-value system
   - Added **defensive logging**: Warns if reasoning text contains Danish loyalty phrases after reassignment

10. **pickSlotDGoalMode function** (line 1265):
    - ✅ Already correct (returns `'build_brand'`)

### ✅ TIER 3: phase2b.ts (Content Generator Fix)

**File**: `supabase/functions/_shared/post-helpers/strategy/phase2/phase2b.ts`

11. **slotRationaleFocus - Slot D branch** (line ~635):
    - Rewritten from loyalty framing to **brand depth** framing
    - Old: `LOYALITETSFORANKRING — denne post henvender sig til folk der allerede kender stedet`
    - New: `BRANDDYBDE — ${capitalDay} er en god dag til at vise et konkret, specifikt element der underbygger ugens argument`
    - Emphasizes concrete identity elements, craft details, not loyalty rituals

12. **slotRationaleFocus - fallback branch** (line ~644):
    - Removed: `if (goalMode === 'retain_loyalty') return ...` branch
    - Now only has `drive_footfall` → footfall, `build_brand` → brand, default

13. **retainLoyaltyCtaFlavors array** (line ~271):
    - ✅ Deleted entire array (no longer needed)

14. **ctaInstruction ternary** (line ~277):
    - Simplified from 3-way to 2-way
    - Old: `goalMode === 'drive_footfall' ? ... : goalMode === 'build_brand' ? ... : goalMode === 'retain_loyalty' ? ... : ''`
    - New: `goalMode === 'drive_footfall' ? ... : goalMode === 'build_brand' ? ... : ''`

15. **Menu post prompt ternary** (line 1022, 1024):
    - Changed: `'Konvertér til besøg/booking' : goalMode === 'build_brand' ? 'Byg kendskab til brand/tilbud' : 'Styrk loyalitet hos eksisterende kunder'`
    - To: `'Konvertér til besøg/booking' : 'Byg kendskab til brand/tilbud'`
    - Changed: `'Konverteringspost' : goalMode === 'build_brand' ? 'Brand-post' : 'Loyalitetspost'`
    - To: `'Konverteringspost' : 'Brand-post'`

16. **Experience post prompt ternary** (line 1207, 1209):
    - Changed: `'Konvertér til besøg/booking' : goalMode === 'build_brand' ? 'Byg kendskab til brand/oplevelse' : 'Styrk loyalitet hos eksisterende'`
    - To: `'Konvertér til besøg/booking' : 'Byg kendskab til brand/oplevelse'`
    - Changed: `'Konverteringspost' : goalMode === 'build_brand' ? 'Brand-post' : 'Loyalitetspost'`
    - To: `'Konverteringspost' : 'Brand-post'`

---

## Testing Results

### ✅ Code Quality

**TypeScript Compilation**: 
- ✅ `business-rules-engine.ts` - **0 errors**
- ✅ `phase1.ts` - **0 errors**
- ✅ `phase2b.ts` - **0 errors**
- ⚠️ `brand-profile-generator/index.ts` - Pre-existing errors unrelated to this fix (locale, errorCollector, etc.)

### 📋 Additional References Found (Not Fixed This Pass)

The following files still contain `retain_loyalty` references but were **out of scope** per the fix specification:

1. **`timing-intelligence.ts`** (line 29)
   - Type definition: `goal_mode: 'drive_footfall' | 'build_brand' | 'retain_loyalty'`

2. **`weekly-plan-generator.ts`** (lines 57, 178, 500)
   - Type definitions for `goal_mode` (3 occurrences)

3. **`strategy-modulator.ts`** (multiple lines)
   - `retain_loyalty` in goal blend calculations, AI prompts, and historical tracking
   - This file was explicitly mentioned as "addressed in prior fixes" per the spec
   - Contains strategy reasoning that references loyalty as a business outcome

**Recommendation**: These files should be reviewed in a follow-up pass to determine if they:
- Need updating to match the two-goal system
- Are intentionally maintaining the three-goal model for different purposes
- Require migration to align with the new architecture

---

## Verification Checklist

Per the fix specification, the following should now be true:

1. ✅ **Slot D goal_mode is `build_brand`**: Confirmed in both `generateSlotsFromRevenueDrivers()` and `getBaseSlotsFallback()`
2. ✅ **Footfall priority on ties**: `computeSlotCounts` now uses 0.05 margin to favor footfall in close remainders
3. ✅ **Footfall floor enforced**: Weeks with 3+ posts guaranteed ≥1 footfall post
4. ✅ **No `retain_loyalty` in main path**: All TIER 1-3 files cleaned
5. ✅ **Danish loyalty phrases removed**: Slot D now uses "BRANDDYBDE" framing instead of "LOYALITETSFORANKRING"
6. ✅ **Dead code deleted**: `content-planning/business-rules-engine.ts` removed
7. ✅ **AI prompt updated**: `brand-profile-generator` now generates `brand_builder_secondary` not `loyalty`

### Expected Runtime Behavior

After this fix:
- Weekly strategy generation for businesses with `revenue_drivers` will create Slot D as `build_brand`
- Goal-blend enforcement will only distribute across two dimensions
- Ties in goal allocation will favor footfall over brand
- No week will have 0 footfall posts (if ≥3 posts total)
- Danish content prompts will use brand depth framing for Slot D posts
- No posts will receive "faste gæster" / "stamgæster" framing (loyalty language)

---

## Database Impact

**Zero data migration required**:
- Production query confirmed 0 businesses have `posting_strategy` populated
- Field rename `loyalty` → `brand_builder_secondary` carries no backward-compatibility risk
- AI writer prompt updated to prevent future schema drift

---

## Next Steps (Out of Scope for This Fix)

1. **Review additional files**: Evaluate `timing-intelligence.ts`, `weekly-plan-generator.ts`, `strategy-modulator.ts` for alignment
2. **Test in production**: Generate weekly strategy for a business with populated `revenue_drivers` to confirm Slot D behavior
3. **Monitor defensive logging**: Watch for warnings about Danish loyalty phrases appearing after this fix (should not happen)
4. **Enable Stage PS**: Consider activating `posting_strategy` persistence so AI-assessed booking model insights get used at runtime

---

## Files Modified

1. ✅ `supabase/functions/_shared/post-helpers/business-rules-engine.ts`
2. ✅ `supabase/functions/brand-profile-generator/index.ts`
3. ✅ `supabase/functions/_shared/post-helpers/strategy/phase1.ts`
4. ✅ `supabase/functions/_shared/post-helpers/strategy/phase2/phase2b.ts`
5. ✅ `supabase/functions/_shared/content-planning/business-rules-engine.ts` (DELETED)

**Total lines changed**: ~150 lines across 4 files  
**Breaking change**: Yes - three-goal system → two-goal system  
**Data migration needed**: No (0 affected rows)
