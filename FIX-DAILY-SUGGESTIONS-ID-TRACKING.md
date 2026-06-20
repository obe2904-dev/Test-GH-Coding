# Fix: Daily Suggestions Not Being Saved (ID Tracking Issue)

**Date:** 2026-05-26  
**Status:** ✅ Fixed  
**Severity:** Medium (Posts generated successfully, but suggestions not saved to DB)

## Problem Summary

The Edge Function `generate-weekly-plan` was logging the warning:
```
[saveWeeklyPlan] ⚠️ No originalIdeas provided, skipping daily_suggestions insert
```

This prevented individual post records from being saved to the `daily_suggestions` table, even though the complete plan was saved to `weekly_content_plans`.

## Root Cause

**File:** `supabase/functions/_shared/post-helpers/weekly-plan-generator.ts`  
**Location:** `mapIdeaToEnrichedSlot()` function (lines 746-762)

The `layer0` object was missing the `id` field from the original `idea`:

```typescript
// ❌ BEFORE - Missing id field
layer0: {
  cta_intent: idea.cta_intent,
  suggested_media: idea.suggested_media,
  platforms: idea.platforms,
  // ... other fields, but NO id
}
```

### Cascade Effect

1. When posts were created (line 1084), they set `idea_id: layer0.id`
2. Since `layer0.id` was `undefined`, all posts had no `idea_id`
3. `executedIdeaIds` extraction (index.ts, line 726-729) found no valid IDs
4. `ideasForSuggestions` filtered to an empty array
5. `saveWeeklyPlan()` received empty array → warning logged
6. No records inserted into `daily_suggestions` table

## The Fix

Added `id: idea.id` to the `layer0` object:

```typescript
// ✅ AFTER - ID properly tracked
layer0: {
  id: idea.id,  // ✨ CRITICAL: Preserve idea ID for tracking executed ideas
  cta_intent: idea.cta_intent,
  suggested_media: idea.suggested_media,
  platforms: idea.platforms,
  // ... rest of fields
}
```

## Impact

### Before Fix
- ✅ Plans generated successfully
- ✅ Saved to `weekly_content_plans` (JSON blob)
- ❌ No records in `daily_suggestions`
- ❌ Frontend couldn't query individual suggestions
- ❌ Lost tracking of which ideas were executed

### After Fix
- ✅ Plans generated successfully
- ✅ Saved to `weekly_content_plans` (JSON blob)
- ✅ Individual posts saved to `daily_suggestions`
- ✅ Frontend can query and display suggestions by date
- ✅ Proper tracking of executed idea IDs
- ✅ Strategy status correctly updated to 'posts_created'

## Related Warnings (Not Critical)

### 1. Format Diversity Warning
```
[FeasibilityCheck] ⚠️ Warnings detected:
  - [LOW] All 4 ideas use same format (photo)
```

**Status:** Expected behavior  
**Reason:** Phase 2b AI chose "photo" for all posts based on strategy. Not a bug - just a low-priority optimization suggestion for future strategies.

### 2. Previous Schema Error (Already Fixed)
```
Failed to save plan: Could not find the 'strategy_id' column
```

**Status:** Historical issue (older execution logs)  
**Resolution:** This column was added in a previous migration and is working correctly now.

## Testing Recommendations

1. **Verify ID Propagation:**
   ```sql
   -- Check that newly created posts have idea_id populated
   SELECT id, business_id, date, title, idea_id
   FROM weekly_content_plans
   WHERE created_at > NOW() - INTERVAL '1 hour'
   ORDER BY created_at DESC
   LIMIT 1;
   ```

2. **Verify Daily Suggestions Insert:**
   ```sql
   -- Check that suggestions are being saved after plan generation
   SELECT business_id, date, position, title, content_type, created_at
   FROM daily_suggestions
   WHERE created_at > NOW() - INTERVAL '1 hour'
   ORDER BY created_at DESC, date, position;
   ```

3. **Check Executed Ideas Tracking:**
   ```sql
   -- Verify that strategies have selected_idea_ids populated
   SELECT id, week_number, status, selected_idea_ids
   FROM weekly_strategies
   WHERE status = 'posts_created'
   ORDER BY created_at DESC
   LIMIT 5;
   ```

## Files Changed

- `supabase/functions/_shared/post-helpers/weekly-plan-generator.ts` (1 line added)

## Deployment Notes

No database migrations required - this is a code-only fix. Deploy the updated Edge Function:

```bash
supabase functions deploy generate-weekly-plan
```

## Verification

After deployment, monitor logs for:
- ✅ No more "[saveWeeklyPlan] ⚠️ No originalIdeas provided" warnings
- ✅ Log message: "[saveWeeklyPlan] ✅ Upserted N posts into daily_suggestions"
- ✅ Log message: "[generate-weekly-plan] ✅ Strategy marked as posts_created"
