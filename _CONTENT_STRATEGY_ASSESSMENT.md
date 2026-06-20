# Content Strategy Issue - Assessment and Fix

## Issue Summary

**Problem:** UI shows "Ingen baseline content strategy fundet — standardfordeling anvendt." (No baseline content strategy found — standard distribution applied)

**Expected:** Content strategy should be automatically derived from programme-level `baseline_goal_split` data

**Business ID:** `f4679fa9-3120-4a59-9506-d059b010c34a` (Café Faust)

## Current Architecture

### How It Should Work

1. **V5 Brand Profile Generator** runs and creates programmes with commercial orientation
2. Each programme gets a `baseline_goal_split` like:
   ```json
   {
     "drive_footfall": 60,
     "retain_regulars": 15,
     "strengthen_brand": 25
   }
   ```

3. **deriveContentStrategy()** aggregates these splits:
   - Calculates weighted average across all programmes
   - Maps field names: `strengthen_brand` → `build_brand`, `retain_regulars` → `retain_loyalty`
   - Returns structure with `goal_blend` and `content_category_weights`

4. **Saves to database** in `business_brand_profile.content_strategy`:
   ```json
   {
     "goal_blend": {
       "drive_footfall": 60,
       "build_brand": 25,
       "retain_loyalty": 15
     },
     "content_category_weights": {
       "product_menu": 30,
       "craving_visual": 30,
       "behind_scenes": 25,
       "team_people": 15
     },
     "primary_goal": "drive_footfall",
     "source": "3 programmes"
   }
   ```

5. **Weekly Plan** reads `content_strategy.goal_blend` and uses it for strategy modulation

### Current Code Status

✅ **deriveContentStrategy() implemented** - [supabase/functions/_shared/brand-profile/v5-transformers.ts](supabase/functions/_shared/brand-profile/v5-transformers.ts#L34-L120)

✅ **Called during generation** - [supabase/functions/brand-profile-generator-v5/index.ts](supabase/functions/brand-profile-generator-v5/index.ts#L1497)

✅ **Saved to database** - [supabase/functions/brand-profile-generator-v5/index.ts](supabase/functions/brand-profile-generator-v5/index.ts#L1528)

## Diagnosis Steps

### 1. Check if content_strategy exists

Run [_CHECK_CONTENT_STRATEGY_STATUS.sql](_CHECK_CONTENT_STRATEGY_STATUS.sql):

```sql
SELECT 
  business_id,
  content_strategy,
  brand_profile_v5_generated_at
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
```

**Possible outcomes:**

**A. content_strategy IS NULL**
- The profile was generated before deriveContentStrategy was implemented
- OR the profile was generated but deriveContentStrategy returned null
- **Solution:** Run manual fix OR regenerate profile

**B. content_strategy EXISTS but missing goal_blend**
- Old format (before June 15, 2026 fix)
- Had `default_goal_split` instead of `goal_blend`
- **Solution:** Run manual fix OR regenerate profile

**C. content_strategy EXISTS with correct structure**
- Weekly plan is not reading it correctly
- **Solution:** Check weekly plan data fetching code

### 2. Check programme data

```sql
SELECT 
  programme_type,
  programme_name,
  baseline_goal_split
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
```

**Should show:** 3 programmes (brunch, lunch, dinner/bar) with baseline_goal_split populated

## Solution Options

### Option A: Manual Fix (Immediate)

Run [_FIX_CONTENT_STRATEGY_FROM_PROGRAMMES.sql](_FIX_CONTENT_STRATEGY_FROM_PROGRAMMES.sql) to calculate and save content_strategy from existing programme data.

**Pros:**
- Immediate fix
- No need to regenerate entire profile
- Preserves all other V5 data

**Cons:**
- Manual SQL execution required
- Uses generic content_category_weights (not programme-specific)

### Option B: Regenerate V5 Profile (Recommended)

Click the "🔄 Regenerate" button at http://localhost:3000/dashboard/brand

**Pros:**
- Ensures all data is up-to-date
- Uses latest deriveContentStrategy logic
- Automatic, no SQL required

**Cons:**
- Takes 20-30 seconds
- Requires OpenAI API calls

### Option C: Check if Already Fixed

1. Clear browser cache (Cmd+Shift+R)
2. Navigate to weekly plan generation
3. Check if message still appears

**Reason:** Your recent regeneration might have already fixed it, but browser cache is showing old data.

## Verification

After applying the fix, verify by:

1. **Check database:**
   ```sql
   SELECT 
     content_strategy->'goal_blend' as goal_blend,
     content_strategy->'primary_goal' as primary_goal
   FROM business_brand_profile
   WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
   ```
   
   Should show actual values, not NULL

2. **Generate weekly plan** and check logs for:
   - Should NOT see: "Ingen baseline content strategy fundet"
   - Should see: Actual goal_blend values being used

3. **Check UI weekly plan display:**
   - Should show calculated strategy percentages
   - Should NOT show fallback message

## Assessment Results

Based on your description:

✅ **Programme data exists** - You mentioned 3 menus with baseline_goal_split
✅ **Code is correct** - deriveContentStrategy is called and saves data
❓ **Database state unknown** - Need to check if content_strategy is actually NULL

### Most Likely Cause

Given that you regenerated the profile and still see the fallback message, the most likely causes are:

1. **Browser cache** - Old data cached in frontend
2. **Timing issue** - Regeneration completed but frontend didn't refetch
3. **Data structure mismatch** - content_strategy exists but in old format (pre-fix)

### Recommended Action

1. **First:** Run `_CHECK_CONTENT_STRATEGY_STATUS.sql` to see actual database state
2. **If NULL:** Run `_FIX_CONTENT_STRATEGY_FROM_PROGRAMMES.sql` for immediate fix
3. **If correct:** Clear browser cache and refresh
4. **Test:** Generate a new weekly plan and verify message is gone

## Technical Details

### Field Name Mapping

The deriveContentStrategy function maps old V5 programme names to new Weekly Plan names:

| Programme Field | Weekly Plan Field |
|----------------|------------------|
| `drive_footfall` | `drive_footfall` (same) |
| `strengthen_brand` | `build_brand` |
| `retain_regulars` | `retain_loyalty` |

### Calculation Method

For a business with 3 programmes:

```
Brunch:  drive_footfall=65, strengthen_brand=20, retain_regulars=15
Lunch:   drive_footfall=60, strengthen_brand=25, retain_regulars=15  
Dinner:  drive_footfall=55, strengthen_brand=30, retain_regulars=15

Average:
  drive_footfall = (65 + 60 + 55) / 3 = 60
  build_brand = (20 + 25 + 30) / 3 = 25
  retain_loyalty = (15 + 15 + 15) / 3 = 15
  
Total = 100 ✓
```

## Files Created

1. `_CHECK_CONTENT_STRATEGY_STATUS.sql` - Diagnostic queries
2. `_FIX_CONTENT_STRATEGY_FROM_PROGRAMMES.sql` - Manual fix script
3. `_CONTENT_STRATEGY_ASSESSMENT.md` - This document

---

**Next Step:** Please run `_CHECK_CONTENT_STRATEGY_STATUS.sql` in Supabase SQL Editor and share the results so we can determine the exact cause and apply the appropriate fix.
