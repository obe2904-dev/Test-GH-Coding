# Root Cause: Posts Not Saved to daily_suggestions

## Executive Summary

**Posts are generated successfully but NEVER inserted into `daily_suggestions` table.**

## Architecture Discovery

### Current Flow
1. `get-weekly-strategy` → generates strategy → saves to `weekly_strategies` with `status='generated'`
2. Frontend polls until `status='generated'`  
3. Frontend calls `generate-weekly-plan` with `strategy_id`
4. `generate-weekly-plan` → calls `generateWeeklyPlan()` → calls `saveWeeklyPlan()`
5. **`saveWeeklyPlan()` inserts ONLY into `weekly_content_plans` (legacy JSON blob)**
6. **NO CODE inserts into `daily_suggestions` table**

### The Missing Piece

**File**: `supabase/functions/_shared/post-helpers/weekly-plan-generator.ts`  
**Function**: `saveWeeklyPlan()` (line 1190)  
**Problem**: Only inserts into `weekly_content_plans`, NOT `daily_suggestions`

```typescript
export async function saveWeeklyPlan(
  plan: WeeklyContentPlan,
  supabaseClient: SupabaseClient
): Promise<{ success: boolean; planId?: string; error?: string }> {
  try {
    const { data, error } = await supabaseClient
      .from('weekly_content_plans')  // ❌ LEGACY TABLE
      .insert({
        user_id: plan.userId,
        business_id: plan.businessId,
        week_number: plan.weekNumber,
        week_start: plan.weekStart,
        week_end: plan.weekEnd,
        generated_at: plan.generatedAt,
        strategy_id: plan.strategyId || null,
        posts: plan.posts,  // ❌ Entire posts array as JSON blob
        summary: plan.summary,
        learning_data: plan.learningData,
      })
      .select('id')
      .single()
    
    if (error) {
      return { success: false, error: error.message }
    }
    
    return { success: true, planId: data.id }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}
```

## Evidence from Logs

### get-weekly-strategy logs (May 3, 16:23:57 UTC)
✅ Phase 0, 1, 2 completed  
✅ 4 posts generated  
✅ Validation ran: "4 posts validated, 1 auto-fixed"  
✅ Booking-occasion detected: "🎉 Mors Dag" (4 times)  
✅ inferred_content_type set: "dinner", "brunch"  
✅ Strategy saved: `status='generated'`, ID: `c21313de-8ad7-4290-9433-bab63f8224a3`  

### generate-weekly-plan logs (May 4, 05:48:48 UTC)
✅ Plan generated: 4 posts  
✅ Strategy marked as posts_created (rows affected: null)  
❌ **NO log showing INSERT into daily_suggestions**  

### Database State
```sql
SELECT * FROM daily_suggestions 
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
AND created_at::date = '2026-05-03';
-- Result: 0 rows
```

```sql
SELECT * FROM weekly_strategies 
WHERE id = 'c21313de-8ad7-4290-9433-bab63f8224a3';
-- Result: 1 row, status = 'posts_created'
```

```sql
SELECT * FROM weekly_content_plans 
WHERE strategy_id = 'c21313de-8ad7-4290-9433-bab63f8224a3';
-- Result: 1 row, posts stored as JSON blob
```

## The Fix

**Add code to insert individual posts into `daily_suggestions` table.**

### Required Changes

1. **Modify `saveWeeklyPlan()`** to insert posts into `daily_suggestions`
2. **Map fields** from `plan.posts[]` to `daily_suggestions` schema
3. **Add logging** to confirm INSERT succeeded

### Field Mapping Needed

`daily_suggestions` schema (from migration 20260503):
- `business_id` ← plan.businessId
- `title` ← post.title (from idea)
- `rationale` ← post.rationale (from idea)
- `content_type` ← post.content_type (from idea)
- `suggested_time` ← post.suggested_time (from idea)
- `date` ← post.suggested_day (from idea)
- `position` ← index + 1
- `validation_result` ← post.validation_result (from Phase 1 validation)
- `inferred_content_type` ← post.inferred_content_type (from Phase 2b)
- `is_active` ← true
- `selected` ← false

## Why This Wasn't Caught Earlier

1. **UI showed preview data** from `weekly_strategies.post_ideas` (in-memory)
2. **UI never refreshed** from `daily_suggestions` table
3. **No error thrown** - code worked perfectly, just saved to wrong table
4. **Testing focused on generation** not database persistence

## Impact

**ALL regenerated strategies since Phase 1 implementation have zero database records.**

The April 30-May 2 posts visible in SQL are from old code (pre-Layer 0 refactor).

## Next Steps

1. Implement `saveWeeklyPlan()` fix to insert into `daily_suggestions`
2. Verify with SQL query after regeneration
3. Check if UI needs updates to read from `daily_suggestions`
4. Consider backfilling missing records from `weekly_content_plans.posts` JSON
