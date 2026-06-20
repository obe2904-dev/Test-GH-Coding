# Content Strategy Fix - Verification and Next Steps

## Current Status

✅ **Database has correct data:**
```json
{
  "goal_blend": {
    "drive_footfall": 57,
    "build_brand": 27,
    "retain_loyalty": 17
  },
  "content_category_weights": {
    "product_menu": 30,
    "craving_visual": 30,
    "behind_scenes": 25,
    "team_people": 15
  }
}
```

❌ **UI still shows:** "Ingen baseline content strategy fundet — standardfordeling anvendt."

## Timeline

| Time | Event |
|------|-------|
| 12:15:17 | V5 profile generated (content_strategy was NULL) |
| 12:45:21 | Fix SQL ran (content_strategy populated) |
| After | "Regenerated weekly plan" |

## Why the Message Still Shows

The fallback message **"Ingen baseline content strategy fundet — standardfordeling anvendt."** is **STORED IN** the weekly plan record itself (specifically in the `week_strategic_rationale` field).

This message is generated ONCE when the weekly plan is created, and it's based on what content_strategy was in the database AT THAT MOMENT.

### Scenario Analysis

**Scenario A: Viewing an OLD weekly plan**
- You regenerated the plan for the SAME week that was generated before 12:45:21
- The old record still exists and shows the old message
- **Check:** Run `_CHECK_WEEKLY_PLAN_TIMESTAMP.sql` and see if `generated_at` is BEFORE or AFTER 12:45:21

**Scenario B: Regenerated but cached UI**
- The plan was regenerated with correct data
- Browser is showing cached version
- **Fix:** Hard refresh (Cmd+Shift+R) or clear cache

**Scenario C: UI showing wrong week**
- You're viewing a different week's plan than the one you just generated
- **Check:** Verify which week you're viewing in the UI

## Verification Steps

### Step 1: Check Weekly Plan Timestamp

Run [_CHECK_WEEKLY_PLAN_TIMESTAMP.sql](_CHECK_WEEKLY_PLAN_TIMESTAMP.sql) in Supabase:

```sql
-- Check when the weekly plan was actually generated
SELECT 
  week_start,
  generated_at,
  summary
FROM weekly_content_plans
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY generated_at DESC
LIMIT 1;
```

**If `generated_at` is:**
- **BEFORE 12:45:21** → You're viewing an old plan (Scenario A)
- **AFTER 12:45:21** → Plan has correct data, UI issue (Scenario B)

### Step 2: Generate a FRESH Weekly Plan

The safest way to verify the fix is working:

1. **Generate for NEXT week** (not this week)
2. This ensures a completely fresh plan with no cached data
3. The new plan should show actual strategy numbers instead of the fallback

**Expected result for new plan:**
```
Denne uge: 2 opslag driver bookinger, 1 opslag styrker brand, 1 opslag plejer stamgæster. 
| Baseline-strategi: 57% bookinger, 27% brand, 17% stamgæster.
```

### Step 3: Check the Data in Weekly Plan Record

Once you know the timestamp, check the actual data stored:

```sql
-- See what's actually stored in the plan
SELECT 
  week_start,
  generated_at,
  posts->>0 as first_post,
  summary
FROM weekly_content_plans
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND week_start = 'YYYY-MM-DD'  -- Replace with the week you're viewing
LIMIT 1;
```

Look for `week_strategic_rationale` in the post data or summary.

## Most Likely Cause

Based on typical usage patterns, **Scenario A is most likely:**

You regenerated the weekly plan for **the current week**, but:
1. When you clicked "regenerate", it might have created a NEW record
2. But the UI is still showing the OLD record from before the fix
3. OR the regenerate created an updated record but didn't delete/replace the old one

## Recommended Action

**Option 1: Generate for NEXT week (Recommended)**
- Go to weekly plan UI
- Click to generate a plan for NEXT Monday
- This will be completely fresh and should show correct strategy

**Option 2: Delete old plan and regenerate**
```sql
-- Delete ALL weekly plans for this business (backup first!)
DELETE FROM weekly_content_plans 
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Then regenerate in the UI
```

**Option 3: Hard refresh browser**
- Cmd+Shift+R (Mac) or Ctrl+Shift+F5 (Windows)
- This clears browser cache

## Technical Explanation

### Where the Message Comes From

**File:** `supabase/functions/_shared/post-helpers/strategy/strategy-modulator.ts` (line 428)

```typescript
if (!cs?.goal_blend) {
  console.log('[Modulator] No baseline content_strategy — returning defaults');
  return {
    week_strategic_rationale: 'Ingen baseline content strategy fundet — standardfordeling anvendt.',
    // ... fallback values
  };
}
```

This function runs ONCE during weekly plan generation and saves the result to the database.

### Why Regenerating Might Not Help

If you're regenerating the SAME week:
1. The system might check if a plan already exists
2. It might UPDATE the existing record
3. But the UI might still show cached data
4. OR there might be multiple records for the same week

---

**Next Step:** Please run `_CHECK_WEEKLY_PLAN_TIMESTAMP.sql` and share the results, especially the `generated_at` timestamp, so we can determine which scenario applies.
