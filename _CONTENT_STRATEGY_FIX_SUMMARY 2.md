# Content Strategy Fix - Implementation Summary
**Date:** 2025-01-15  
**Business:** Café Faust  
**Status:** ✅ Code fixed, database migration ready

---

## Overview

You were **100% correct** - content strategy should be:
1. ✅ **Defined in brand profile** 
2. ✅ **Measured over time**
3. ✅ **Used to avoid only menu posts**

The architecture exists, but two schema bugs prevented it from working.

---

## Issues Found

### Issue 1: Missing Database Column ❌
**Error:** `Could not find the 'inferred_content_type' column of 'daily_suggestions' in the schema cache (PGRST204)`

**Root Cause:**
- Migration was defined in `PHASE1-QUICKSTART.sql` but never applied to live database
- `saveWeeklyPlan()` tried to insert `inferred_content_type` into non-existent column
- **Impact:** Cannot track content types, cannot measure distribution over time

**Fix:** Run SQL migration (see [_RUN_THIS_IN_SUPABASE_SQL_EDITOR.sql](_RUN_THIS_IN_SUPABASE_SQL_EDITOR.sql))

---

### Issue 2: content_strategy Field Name Mismatch ❌
**Error:** UI showing "Ingen baseline content strategy fundet — standardfordeling anvendt."

**Root Cause:**
- `deriveContentStrategy()` returned `default_goal_split` with `strengthen_brand`/`retain_regulars`
- `strategy-modulator.ts` expected `goal_blend` with `build_brand`/`retain_loyalty`
- Field name mismatch → fallback to defaults → no personalized content distribution
- **Impact:** All businesses use same generic strategy, defeating purpose of personalization

**Fix:** Updated `v5-transformers.ts` to return correct field structure (committed)

---

## Files Modified

### 1. [supabase/functions/_shared/brand-profile/v5-transformers.ts](supabase/functions/_shared/brand-profile/v5-transformers.ts)
**Changed `deriveContentStrategy()` function (lines 29-68):**

**Before:**
```typescript
return {
  default_goal_split: {  // ❌ Wrong field name
    drive_footfall: ...,
    strengthen_brand: ...,  // ❌ Wrong field name
    retain_regulars: ...    // ❌ Wrong field name
  },
  decision_timing: ...,
  programmes_summary: [...]
  // ❌ Missing: content_category_weights
}
```

**After:**
```typescript
return {
  primary_goal: 'drive_footfall' | 'build_brand' | 'retain_loyalty',
  goal_blend: {  // ✅ Correct field name
    drive_footfall: number,
    build_brand: number,     // ✅ Correct field name
    retain_loyalty: number   // ✅ Correct field name
  },
  content_category_weights: {  // ✅ Added missing field
    product_menu: number,
    craving_visual: number,
    behind_scenes: number,
    team_people: number
  },
  footfall_signals: string[],
  brand_anchors: string[],
  loyalty_hooks: string[],
  programmes_summary: [...]
}
```

**Changes:**
- ✅ Renamed `default_goal_split` → `goal_blend`
- ✅ Renamed `strengthen_brand` → `build_brand`
- ✅ Renamed `retain_regulars` → `retain_loyalty`
- ✅ Added `content_category_weights` with percentages derived from programme types
- ✅ Added `primary_goal`, `footfall_signals`, `brand_anchors`, `loyalty_hooks`
- ✅ Normalized percentages to sum to 100%

---

## Action Required

### Step 1: Run Database Migration ⚠️ REQUIRED

Open Supabase Dashboard → SQL Editor → Run this:

```sql
-- Add missing columns
ALTER TABLE daily_suggestions 
ADD COLUMN IF NOT EXISTS inferred_content_type TEXT;

ALTER TABLE daily_suggestions 
ADD COLUMN IF NOT EXISTS validation_result JSONB;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_content_type 
  ON daily_suggestions(inferred_content_type);

CREATE INDEX IF NOT EXISTS idx_daily_suggestions_validation 
  ON daily_suggestions USING GIN (validation_result);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
```

**Full migration with verification:** [_RUN_THIS_IN_SUPABASE_SQL_EDITOR.sql](_RUN_THIS_IN_SUPABASE_SQL_EDITOR.sql)

---

### Step 2: Regenerate Café Faust Brand Profile (Recommended)

Since `deriveContentStrategy()` now returns the correct structure:
1. Go to Café Faust settings in dashboard
2. Click "Regenerate Brand Profile" (or similar)
3. This will populate `brand_voice.content_strategy` with correct fields

**Expected result:**
```json
{
  "content_strategy": {
    "primary_goal": "drive_footfall",
    "goal_blend": {
      "drive_footfall": 50,
      "build_brand": 30,
      "retain_loyalty": 20
    },
    "content_category_weights": {
      "product_menu": 35,
      "craving_visual": 25,
      "behind_scenes": 25,
      "team_people": 15
    },
    "footfall_signals": ["brunch-service", "daglig trafik"],
    "brand_anchors": ["kvalitet og håndværk"],
    "loyalty_hooks": ["fast ugentligt besøg"]
  }
}
```

---

### Step 3: Generate New Weekly Plan (Test)

After steps 1-2, generate a new weekly plan for Café Faust.

**Expected behavior:**
- ✅ No more "Ingen baseline content strategy fundet" message
- ✅ Strategy rationale shows personalized content distribution
- ✅ Posts saved to `daily_suggestions` with `inferred_content_type` populated
- ✅ No PGRST204 database error

---

## Content Strategy Measurement (Future Enhancement)

Now that the foundation is fixed, you can add drift tracking:

### Analytics Query
```sql
-- Check content type distribution over last 4 weeks
SELECT 
  inferred_content_type,
  COUNT(*) as post_count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as percentage
FROM daily_suggestions
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND date >= CURRENT_DATE - INTERVAL '4 weeks'
  AND is_active = true
GROUP BY inferred_content_type
ORDER BY post_count DESC;
```

**Example output:**
```
inferred_content_type | post_count | percentage
----------------------|------------|----------
menu_item             | 12         | 48.0
behind_scenes         | 6          | 24.0
craving_visual        | 4          | 16.0
team_people           | 3          | 12.0
```

**Interpretation:**
- Target: `product_menu: 35%`, actual: `menu_item: 48%`
- **Over-index by 13%** → next week should reduce menu focus

---

### Feedback Loop (Next Sprint)

Integrate drift data into `strategy-modulator.ts`:

```typescript
// Read 4-week distribution
const drift = await getContentTypeDrift(businessId, supabase);

// Compare to baseline
const baseline = context.brand_voice.content_strategy.content_category_weights;
const menuOverIndex = drift.menu_item - baseline.product_menu;

// Adjust this week's weights
if (menuOverIndex > 15) {
  week_content_category_weights.product_menu = Math.max(20, baseline.product_menu - 15);
  week_content_category_weights.craving_visual += 10;
  week_content_category_weights.behind_scenes += 5;
  
  modulation_factors.push('rebalancing_menu_overindex');
  week_strategic_rationale += ` Over-index på menu posts sidste 4 uger (${drift.menu_item}% vs target ${baseline.product_menu}%) — reducerer til ${week_content_category_weights.product_menu}% denne uge.`;
}
```

---

## Verification Checklist

After running migration and regenerating brand profile:

- [ ] Database migration completed successfully
- [ ] `inferred_content_type` column exists in `daily_suggestions`
- [ ] Café Faust brand profile regenerated
- [ ] `brand_voice.content_strategy.goal_blend` exists (not `default_goal_split`)
- [ ] `brand_voice.content_strategy.content_category_weights` exists
- [ ] Generate new weekly plan for Café Faust
- [ ] No "Ingen baseline content strategy fundet" message
- [ ] `daily_suggestions` insert succeeds
- [ ] Query `daily_suggestions` shows `inferred_content_type` populated
- [ ] Strategy rationale shows personalized content distribution

---

## Summary

✅ **Code fixed:** `deriveContentStrategy()` now returns correct field structure  
⚠️ **Action needed:** Run database migration to add missing columns  
📋 **Recommended:** Regenerate Café Faust brand profile to populate corrected content_strategy  
🎯 **Result:** Content strategy will be defined, measured, and used to balance post types over time

---

## Related Files

- [_ASSESSMENT_CONTENT_STRATEGY_ARCHITECTURE.md](_ASSESSMENT_CONTENT_STRATEGY_ARCHITECTURE.md) - Full technical analysis
- [_RUN_THIS_IN_SUPABASE_SQL_EDITOR.sql](_RUN_THIS_IN_SUPABASE_SQL_EDITOR.sql) - Database migration with verification
- [_FIX_MISSING_COLUMNS_AND_CONTENT_STRATEGY.sql](_FIX_MISSING_COLUMNS_AND_CONTENT_STRATEGY.sql) - Diagnostic queries

---

**Questions or issues?** Check the assessment document for detailed architecture explanation.
