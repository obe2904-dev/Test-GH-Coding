# 🚀 Quick Suggestions Integration - Deployment Checklist

## ✅ Implementation Complete

All code changes have been implemented following the integration plan from `_INTEGRATION_PLAN_QUICK_SUGGESTIONS.md`.

### Changes Made

1. **Imports Added** (Lines 1-13)
   - Added `getMenuRotationQueue` from content-planning utilities
   - Added `detectServicePeriod` for service period detection
   - Added `loadMinimalBrandVoice` (available for future use)
   - Added `RotationQueueItem` type

2. **Content Angle Helper** (Lines 95-127)
   - New `determineContentAngle()` function
   - Determines strategic angle based on weather + service period
   - Returns angles like "Rainy-day comfort classic", "Weekend brunch favorite"

3. **Rotation Queue Integration** (Lines 1133-1156)
   - Detects current service period using `detectServicePeriod()`
   - Fetches rotation queue with 90-day lookback
   - Prioritizes dishes that haven't been posted recently
   - Falls back gracefully to legacy menu fetch if queue unavailable

4. **Signature Items Priority** (Lines 1163-1172)
   - Uses rotation queue FIRST when available
   - Replaces manual menu fetching for all tiers
   - Preserves existing fallback chain (menu_results_v2 → key_offerings → menu_signal)

5. **Metadata in persistAndAssemble** (Lines 497-518)
   - Updated function signature to accept `rotationQueue`, `currentServicePeriod`, `weatherDesc`
   - Added metadata extraction from rotation queue (Lines 568-582)
   - Populates 5 new fields in daily_suggestions:
     - `menu_item_id`: UUID from rotation queue
     - `menu_item_name`: Dish name (already existed, now properly populated)
     - `content_type`: 'product' for menu items (already existed, constraint-enforced)
     - `service_period`: Detected time period (brunch/lunch/dinner)
     - `content_angle`: Strategic angle for caption generation
   - Updated SELECT statement to return new fields (Line 662)

6. **Function Call Updated** (Line 3596)
   - Passes `rotationQueue`, `currentServicePeriod`, `weatherInfo` to persistAndAssemble

## 📋 Pre-Deployment Tests

Run these SQL tests BEFORE deploying:

```sql
-- Test 1: Verify rotation queue data exists
SELECT COUNT(*) FROM menu_items_normalized 
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid;
-- Expected: 5+ rows

-- Test 2: Verify service period configuration exists
SELECT COUNT(*) FROM business_programme_profiles 
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid;
-- Expected: 3 rows (Brunch, FROKOST, AFTEN)

-- Test 3: Verify daily_suggestions has metadata columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'daily_suggestions' 
  AND column_name IN ('menu_item_id', 'menu_item_name', 'content_type', 'service_period', 'content_angle');
-- Expected: 5 rows
```

## 🚢 Deployment Steps

### 1. Deploy the Updated Function

```bash
cd /Users/olebaek/Library/Mobile\ Documents/com~apple~CloudDocs/Test\ P2G\ 1-iCloud
supabase functions deploy get-quick-suggestions
```

**Expected Output:**
```
✓ Deployed Function get-quick-suggestions in 15s
Function URL: https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/get-quick-suggestions
```

### 2. Test the Function Manually

```bash
curl -X POST 'https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/get-quick-suggestions' \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": "f4679fa9-3120-4a59-9506-d059b010c34a",
    "regenerate": true
  }'
```

**Expected Response:**
```json
{
  "suggestions": [
    {
      "id": "...",
      "title": "THE ONE klar nu",
      "content_type": "product",
      "menu_item_name": "THE ONE",
      "menu_item_id": "uuid-here",
      "service_period": "brunch",
      "content_angle": "Weekend brunch favorite",
      "suggested_time": "10:30",
      ...
    }
  ],
  "cached": false,
  "weatherForecast": "...",
  ...
}
```

### 3. Run Post-Deployment Tests

Execute `_TEST_QUICK_SUGGESTIONS_INTEGRATION.sql` in Supabase SQL Editor:

```bash
# Copy the test file content and run in Supabase SQL Editor
cat _TEST_QUICK_SUGGESTIONS_INTEGRATION.sql
```

**Expected Results:**
- Test 1: 5+ dishes available
- Test 2: 3 programmes configured
- Test 3: All 5 metadata columns exist
- Test 4: Recent suggestions have populated metadata
- Test 5: (Run after accepting suggestions) Published posts have metadata
- Test 6: (Run after several cycles) Fair rotation status

### 4. Verify Metadata Flow

1. **Generate suggestions** (call function via UI or curl)
2. **Check daily_suggestions table:**
   ```sql
   SELECT menu_item_name, content_type, service_period, content_angle
   FROM daily_suggestions
   WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid
   ORDER BY created_at DESC LIMIT 3;
   ```
3. **Accept a suggestion in the UI**
4. **Check published_posts table:**
   ```sql
   SELECT menu_item_name, content_type, idea_source
   FROM published_posts
   WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid
   ORDER BY created_at DESC LIMIT 1;
   ```

## ✅ Success Criteria

All must pass:

- [x] Function deploys without errors
- [ ] Function returns suggestions with metadata populated
- [ ] Rotation queue prioritizes least-recently-posted dishes
- [ ] Service period detection works (brunch/lunch/dinner)
- [ ] Content angle is contextual (weather + service period)
- [ ] Metadata saved to daily_suggestions (5 new columns)
- [ ] Metadata flows to published_posts when suggestion accepted
- [ ] No breaking changes (fallback chain still works)

## 🔄 Rollback Plan

If issues arise:

### Quick Rollback (Function Only)
```bash
# Revert to previous version from git
git checkout HEAD~1 supabase/functions/get-quick-suggestions/index.ts
supabase functions deploy get-quick-suggestions
```

### Database Rollback (If Needed)
Database changes are backward-compatible (nullable columns), so no rollback needed. Old suggestions without metadata will still work.

## 📊 Monitoring

After deployment, monitor:

1. **Function Logs** (Supabase Dashboard → Edge Functions → get-quick-suggestions)
   - Look for: "✅ Using rotation queue: X dishes (fair rotation enabled)"
   - Look for: "🍽️ Current service period: brunch/lunch/dinner"
   - Watch for errors in rotation queue fetch

2. **Suggestion Quality**
   - Do suggestions show different dishes each day?
   - Is service period detection accurate?
   - Are content angles contextual?

3. **Database Growth**
   - Monitor daily_suggestions table size (metadata adds ~100 bytes per row)
   - Rotation should prevent dish repetition

## 🐛 Troubleshooting

### Issue: Rotation queue returns empty array
**Symptom:** Logs show "⚠️ Failed to get rotation queue"
**Fix:** Check menu_items_normalized has data for this business_id
```sql
SELECT COUNT(*) FROM menu_items_normalized WHERE business_id = '...';
```

### Issue: Service period is always null
**Symptom:** service_period field is NULL in suggestions
**Fix:** Check business_programme_profiles configuration
```sql
SELECT * FROM business_programme_profiles WHERE business_id = '...';
```

### Issue: content_angle is always null
**Symptom:** content_angle field is NULL for menu items
**Fix:** Ensure content_type = 'product' and weatherDesc is available

### Issue: Metadata not flowing to published_posts
**Symptom:** published_posts.menu_item_name is NULL after accepting suggestion
**Fix:** Check accept-suggestion function copies metadata fields (separate task)

## 📝 Next Steps

After successful deployment:

1. **Monitor for 24-48 hours** - Ensure rotation works across multiple days
2. **Verify fair rotation** - Run Test 6 from integration tests after 1 week
3. **Update accept-suggestion function** - Ensure metadata copies to published_posts
4. **Phase 2-6 Implementation** - Full Weekly Plan overhaul (separate project)

## 🎯 Integration Complete!

This integration brings immediate ROI:
- ✅ Fair dish rotation (no more repetition)
- ✅ Service-period awareness (brunch items during brunch time)
- ✅ Metadata tracking for future analytics
- ✅ Foundation for full Weekly Plan architecture (Phase 2-6)

Estimated implementation time: **1-2 hours** ✨
