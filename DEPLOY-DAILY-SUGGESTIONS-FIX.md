# Deployment Checklist: Daily Suggestions ID Tracking Fix

**Date:** 2026-05-26  
**Fix Reference:** FIX-DAILY-SUGGESTIONS-ID-TRACKING.md

## Pre-Deployment Checklist

- [x] Code fix applied to `weekly-plan-generator.ts`
- [x] TypeScript compilation verified (no errors)
- [ ] Test locally with Supabase CLI
- [ ] Deploy to production
- [ ] Verify fix with monitoring

## Deployment Steps

### 1. Test Locally (Recommended)

```bash
cd "/Users/olebaek/Library/Mobile Documents/com~apple~CloudDocs/Test P2G 1-iCloud"

# Start local Supabase
supabase start

# Deploy function locally
supabase functions serve generate-weekly-plan

# Test the function
curl -i --location --request POST 'http://localhost:54321/functions/v1/generate-weekly-plan' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"strategy_id": "test-strategy-id"}'
```

### 2. Deploy to Production

```bash
# Ensure you're in the project directory
cd "/Users/olebaek/Library/Mobile Documents/com~apple~CloudDocs/Test P2G 1-iCloud"

# Deploy the Edge Function
supabase functions deploy generate-weekly-plan --project-ref kvqdkohdpvmdylqgujpn
```

### 3. Verify Deployment

Check the Supabase dashboard:
- Go to: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/functions
- Find `generate-weekly-plan` function
- Verify deployment version is updated

## Post-Deployment Verification

### 1. Monitor Logs

Watch for successful log messages in the Supabase Edge Function logs:

**Expected Success Logs:**
```
✅ [saveWeeklyPlan] ✅ Upserted N posts into daily_suggestions (rows affected: N)
✅ [generate-weekly-plan] ✅ Strategy marked as posts_created: <strategy-id>
```

**Should NOT Appear:**
```
❌ [saveWeeklyPlan] ⚠️  No originalIdeas provided, skipping daily_suggestions insert
```

### 2. Database Verification

Run these queries in Supabase SQL Editor:

```sql
-- 1. Check that new posts have idea_id populated
SELECT 
  id, 
  week_start, 
  jsonb_array_length(posts) as post_count,
  (posts->0->>'idea_id') as first_post_idea_id
FROM weekly_content_plans
WHERE generated_at > NOW() - INTERVAL '1 hour'
ORDER BY generated_at DESC
LIMIT 5;

-- 2. Verify daily_suggestions are being created
SELECT 
  business_id,
  date,
  position,
  title,
  content_type,
  created_at
FROM daily_suggestions
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC, date, position;

-- 3. Check strategy tracking
SELECT 
  id,
  week_number,
  status,
  selected_idea_ids,
  created_at
FROM weekly_strategies
WHERE status = 'posts_created'
  AND updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC
LIMIT 5;
```

### 3. Test End-to-End Flow

1. Generate a new weekly strategy
2. Generate weekly plan from that strategy
3. Verify:
   - Plan is saved to `weekly_content_plans`
   - Individual suggestions saved to `daily_suggestions`
   - Strategy status updated to `posts_created`
   - `selected_idea_ids` array populated with executed IDs

## Rollback Plan

If issues are detected:

```bash
# Revert to previous version (if you have git history)
git revert HEAD
supabase functions deploy generate-weekly-plan --project-ref kvqdkohdpvmdylqgujpn

# OR manually revert the change:
# Remove `id: idea.id,` from line 749 in weekly-plan-generator.ts
```

## Expected Behavior Changes

### Before Fix
- Plan generated successfully
- Saved to `weekly_content_plans` only
- Warning in logs about originalIdeas
- No `daily_suggestions` records

### After Fix  
- Plan generated successfully
- Saved to both `weekly_content_plans` AND `daily_suggestions`
- No warnings about originalIdeas
- Proper ID tracking throughout the flow

## Success Criteria

- ✅ No "[saveWeeklyPlan] ⚠️ No originalIdeas" warnings
- ✅ Logs show "Upserted N posts into daily_suggestions"  
- ✅ SQL queries return populated records in `daily_suggestions`
- ✅ Posts have `idea_id` field populated
- ✅ Strategies have `selected_idea_ids` populated

## Contact

If you encounter issues during deployment, check:
- Supabase project logs
- Edge Function runtime logs
- Database error logs

Review the detailed fix documentation in:
- `FIX-DAILY-SUGGESTIONS-ID-TRACKING.md`
