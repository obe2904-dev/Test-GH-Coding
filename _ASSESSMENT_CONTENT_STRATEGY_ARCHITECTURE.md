# Content Strategy Architecture Assessment
**Date:** 2025-01-15  
**Business:** Café Faust  
**Business ID:** f4679fa9-3120-4a59-9506-d059b010c34a

## Executive Summary

Found **two critical schema mismatches** preventing proper content strategy tracking:

1. **Database Schema Issue:** Missing `inferred_content_type` column in `daily_suggestions`
2. **Type Mismatch Issue:** `deriveContentStrategy()` returns wrong field names

---

## Issue 1: Missing Database Column

### Problem
```
Could not find the 'inferred_content_type' column of 'daily_suggestions' in the schema cache (PGRST204)
```

### Root Cause
- Migration file `PHASE1-QUICKSTART.sql` line 12 defines: `ALTER TABLE daily_suggestions ADD COLUMN IF NOT EXISTS inferred_content_type TEXT;`
- This migration was never applied to the live database
- `saveWeeklyPlan()` at line 1386 tries to insert `inferred_content_type: idea.inferred_content_type || null`

### Impact
- Weekly plan generation fails when trying to save posts to `daily_suggestions`
- Content type tracking completely broken
- Cannot measure post type distribution over time

### Fix Required
```sql
ALTER TABLE daily_suggestions ADD COLUMN IF NOT EXISTS inferred_content_type TEXT;
ALTER TABLE daily_suggestions ADD COLUMN IF NOT EXISTS validation_result JSONB;

CREATE INDEX IF NOT EXISTS idx_daily_suggestions_content_type 
  ON daily_suggestions(inferred_content_type);
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_validation 
  ON daily_suggestions USING GIN (validation_result);
```

---

## Issue 2: content_strategy Field Name Mismatch

### Problem
UI shows: **"Ingen baseline content strategy fundet — standardfordeling anvendt."**

### Root Cause - Schema Mismatch

**Expected Structure** (from `ContentStrategy` interface):
```typescript
content_strategy: {
  primary_goal: 'drive_footfall' | 'build_brand' | 'retain_loyalty',
  goal_blend: {
    drive_footfall: number,
    build_brand: number,
    retain_loyalty: number
  },
  content_category_weights: {
    product_menu: number,
    craving_visual: number,
    behind_scenes: number,
    team_people: number
  },
  footfall_signals: string[],
  brand_anchors: string[],
  loyalty_hooks: string[]
}
```

**Actual Structure** (from `deriveContentStrategy()` in v5-transformers.ts line 29):
```typescript
{
  default_goal_split: {          // ❌ WRONG - should be "goal_blend"
    drive_footfall: number,
    strengthen_brand: number,     // ❌ WRONG - should be "build_brand"
    retain_regulars: number       // ❌ WRONG - should be "retain_loyalty"
  },
  decision_timing: string,
  programmes_summary: [...]
  // ❌ MISSING: content_category_weights
  // ❌ MISSING: primary_goal, footfall_signals, brand_anchors, loyalty_hooks
}
```

**Consumer Code** (strategy-modulator.ts line 423):
```typescript
const cs = context.brand_voice?.content_strategy;

if (!cs?.goal_blend) {  // ❌ FAILS because field is "default_goal_split"
  console.log('[Modulator] No baseline content_strategy — returning defaults');
  return {
    week_goal_blend: { drive_footfall: 50, build_brand: 25, retain_loyalty: 25 },
    week_content_category_weights: { product_menu: 35, craving_visual: 25, behind_scenes: 25, team_people: 15 },
    week_strategic_rationale: 'Ingen baseline content strategy fundet — standardfordeling anvendt.',
    // ...
  };
}
```

### Impact
1. **All businesses fallback to default strategy** even if brand profile generated content_strategy
2. **No personalized content distribution** based on business type
3. **Cannot track content type balance over time** - defeats purpose of content_strategy
4. **Post type diversity not enforced** - exactly the issue user reported

### Fix Required

**Option A: Fix deriveContentStrategy to return correct structure**  
File: `supabase/functions/_shared/brand-profile/v5-transformers.ts` line 29

**Option B: Check if AI-generated content_strategy exists in database**  
The deriveContentStrategy is only called when transforming V5 programmes to legacy format.  
If brand profile AI already generated full content_strategy, we should use that instead.

---

## Content Strategy Measurement Architecture

### Current State
1. ✅ Content types defined in Phase 2b (`menu_item`, `craving_visual`, `behind_scenes`, `team_people`, etc.)
2. ✅ Content type assignment logic exists in type allocator
3. ✅ `inferred_content_type` field populated during strategy generation
4. ❌ **Column missing from database** → cannot save inferred type
5. ❌ **content_strategy baseline wrong** → no personalized targets
6. ❌ **No drift tracking** → cannot measure if posts are balanced over time

### Desired State
1. Brand profile contains valid `content_strategy` with:
   - `goal_blend` percentages (drive_footfall, build_brand, retain_loyalty)
   - `content_category_weights` percentages (product_menu, craving_visual, behind_scenes, team_people)
2. Weekly strategy modulator reads baseline and adjusts for context
3. Phase 2b assigns `inferred_content_type` to each post
4. `saveWeeklyPlan()` saves `inferred_content_type` to `daily_suggestions.inferred_content_type`
5. Analytics queries aggregate `inferred_content_type` over past 4-8 weeks
6. Future weekly plans see drift data and adjust to rebalance

### Missing Components
1. ✅ **Baseline definition** - exists in ContentStrategy interface
2. ❌ **Database schema** - missing `inferred_content_type` column
3. ❌ **Data population** - `deriveContentStrategy()` returns wrong structure
4. ❌ **Drift tracking queries** - no analytics on content_type distribution
5. ❌ **Feedback loop** - weekly modulator doesn't yet consume drift data

---

## Recommendations

### Immediate Fixes (Blocking)
1. **Run database migration** to add `inferred_content_type` column
2. **Fix `deriveContentStrategy()`** to return correct field names:
   - Rename `default_goal_split` → `goal_blend`
   - Rename `strengthen_brand` → `build_brand`
   - Rename `retain_regulars` → `retain_loyalty`
   - Add missing `content_category_weights` field
   - Add missing `primary_goal`, `footfall_signals`, `brand_anchors`, `loyalty_hooks`

### Short-term Improvements
3. **Verify brand profile AI generates full content_strategy**
   - Check if Prompt B already includes this
   - If yes, ensure database.ts saves it correctly
   - If no, add to prompt or rely on fallback

4. **Create drift tracking query**
   ```sql
   SELECT 
     inferred_content_type,
     COUNT(*) as post_count,
     ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as percentage
   FROM daily_suggestions
   WHERE business_id = $1
     AND date >= CURRENT_DATE - INTERVAL '4 weeks'
     AND is_active = true
   GROUP BY inferred_content_type
   ORDER BY post_count DESC;
   ```

5. **Integrate drift data into weekly modulation**
   - Read 4-week content_type distribution
   - Compare to baseline `content_category_weights`
   - Adjust week_content_category_weights to rebalance
   - Log: "Over-index på menu posts sidste 4 uger (45% vs target 35%) — reducerer til 25% denne uge"

### Long-term Architecture
6. **Add content_strategy adherence dashboard**
   - Show baseline vs. actual distribution (line chart over 12 weeks)
   - Alert if deviation > 20% for more than 3 weeks
   - Allow manual override of baseline if business evolves

7. **Refine content_category_weights**
   - Current categories: product_menu, craving_visual, behind_scenes, team_people
   - Consider adding: atmosphere, event_promo, educational, seasonal_special
   - Map `inferred_content_type` values to these categories

---

## Files to Modify

1. **Database Migration**
   - File: `_FIX_MISSING_COLUMNS_AND_CONTENT_STRATEGY.sql` (already created)
   - Action: Apply via Supabase SQL Editor

2. **deriveContentStrategy Fix**
   - File: `supabase/functions/_shared/brand-profile/v5-transformers.ts` line 29-68
   - Action: Return correct field structure matching ContentStrategy interface

3. **Fallback Generator Fix**
   - File: `supabase/functions/_shared/brand-profile/fallbacks.ts` line 359+
   - Action: Ensure buildContentStrategyFallback returns correct structure

4. **Weekly Modulator Enhancement** (future)
   - File: `supabase/functions/_shared/post-helpers/strategy/strategy-modulator.ts`
   - Action: Add drift tracking and rebalancing logic

---

## Testing Checklist

- [ ] Run migration to add `inferred_content_type` column
- [ ] Verify column exists: `SELECT column_name FROM information_schema.columns WHERE table_name = 'daily_suggestions' AND column_name = 'inferred_content_type'`
- [ ] Fix deriveContentStrategy to return `goal_blend` instead of `default_goal_split`
- [ ] Add `content_category_weights` to deriveContentStrategy return value
- [ ] Regenerate Café Faust brand profile to populate corrected content_strategy
- [ ] Generate new weekly plan for Café Faust
- [ ] Verify no more "Ingen baseline content strategy fundet" message
- [ ] Verify `daily_suggestions` insert succeeds with `inferred_content_type`
- [ ] Query `daily_suggestions` to see content_type distribution
- [ ] Create analytics query for 4-week content balance tracking

---

## Conclusion

The user's concern is **100% valid**: content strategy should be:
1. **Defined in brand profile** ✅ (schema exists, but data broken)
2. **Measured over time** ❌ (database column missing, no drift tracking)
3. **Used to avoid only menu posts** ❌ (baseline broken, no rebalancing)

Both issues are **schema/data mismatches**, not conceptual gaps. The architecture is sound, but implementation has two critical bugs preventing it from working.
