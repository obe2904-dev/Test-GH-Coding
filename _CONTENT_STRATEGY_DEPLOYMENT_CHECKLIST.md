# Content Strategy Deployment Checklist

## Current Status

✅ **Code Changes Complete:**
- [x] brand-profile-generator/index.ts - Stage PS generates content_strategy from programmes
- [x] v5-transformers.ts - deriveContentStrategy() returns goal_blend
- [x] Database migration SQL ready (_RUN_THIS_IN_SUPABASE_SQL_EDITOR.sql)
- [x] brand-profile-generator deployed

✅ **Functions Deployed:**
- [x] brand-profile-generator (deployed successfully)
- [x] get-weekly-strategy (no changes - already current)

## Remaining Issues

### Issue 1: Brand Profile Not Regenerated
**Problem:** UI still shows "Ingen baseline content strategy fundet"

**Cause:** Café Faust's brand_brand_profile was generated BEFORE the content_strategy code was added

**Solution:** Regenerate brand profile for Café Faust

**Steps:**
1. Run `_check_content_strategy.sql` query #1 to confirm content_strategy is missing
2. Option A (recommended): Delete existing profile and regenerate via dashboard
3. Option B (quick fix): Run manual UPDATE query to patch content_strategy

### Issue 2: weatherHallucinationFail Error
**Problem:** Frontend console shows "Error: weatherHallucinationFail is not defined"

**Possible Causes:**
1. Cached/stale Edge Function deployment
2. TypeScript compilation issue
3. Runtime scope issue with `rainyWeekWarning` variable

**Investigation Steps:**
1. Check Supabase Edge Function logs for full error stack trace
2. Verify phase2c.ts lines 555-585 compiled correctly
3. Check if RAINY_WEEK_HALLUCINATIONS constant is accessible in scope

**Current Code Structure (phase2c.ts):**
```typescript
// Line 140: rainyWeekWarning defined in main function scope
const rainyWeekWarning = rainyDayCount >= Math.ceil(totalDayCount / 2) ? ...

// Line 556: RAINY_WEEK_HALLUCINATIONS uses rainyWeekWarning (closure access)
const RAINY_WEEK_HALLUCINATIONS = rainyWeekWarning 
  ? ['godt vejr', 'fint vejr', ...]
  : [];

// Line 573: weatherHallucinationFail uses RAINY_WEEK_HALLUCINATIONS
const weatherHallucinationFail = RAINY_WEEK_HALLUCINATIONS.some(...)
```

## Next Steps

### Step 1: Check Database State
Run `_check_content_strategy.sql` to see if content_strategy exists

### Step 2: Regenerate Brand Profile
```sql
-- Option A: Force full regeneration
DELETE FROM business_brand_profile 
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Then trigger regeneration via dashboard
```

### Step 3: Test Weekly Plan Generation
- Generate new weekly plan for Café Faust
- Check if "Ingen baseline content strategy fundet" message is gone
- Verify goal_blend appears in logs

### Step 4: Investigate weatherHallucinationFail Error
- Check Supabase Functions logs for stack trace
- May need to redeploy get-weekly-strategy with force flag
- Or add defensive check: `const RAINY_WEEK_HALLUCINATIONS = Array.isArray(...) ? ... : []`

## Expected Outcome

After regeneration, `brand_voice.content_strategy` should contain:
```json
{
  "goal_blend": {
    "drive_footfall": 55,
    "build_brand": 25,
    "retain_loyalty": 20
  },
  "content_category_weights": {
    "product_menu": 35,
    "craving_visual": 25,
    "behind_scenes": 25,
    "team_people": 15
  }
}
```

And weekly plan UI should show:
```
Denne uge: X opslag driver bookinger, Y opslag styrker brand.
```
(No "Ingen baseline content strategy fundet" message)
