# Testing Strategy: Platform-Specific Draft Split Fix

**Date**: 2026-06-19  
**Related Design**: `_DESIGN_PLATFORM_DRAFT_SPLITTING_FIX.md`  
**Code Changed**: `src/pages/dashboard/CreatePostPage.tsx`

---

## 🎯 Testing Objective

Verify that clicking "Fortsæt til Udgiv" in Design stage correctly:
1. ✅ Splits unified draft into 2 platform-specific drafts (when user has both FB + IG)
2. ✅ Each draft contains ONLY that platform's content (3 hashtags for FB, 5 for IG)
3. ✅ Facebook draft includes booking URL when applicable
4. ✅ Instagram draft NEVER includes booking URL
5. ✅ Suggestion status updates to 'consumed'
6. ✅ Forslag and Design stages become locked (view-only)

---

## 📋 Pre-Test Setup

### Requirements
- ✅ User must have BOTH Facebook AND Instagram connected
- ✅ At least 1 AI-generated daily suggestion available
- ✅ Database access for verification queries

### Test Data Preparation
```sql
-- Verify you have a suggestion available
SELECT id, business_id, title, status, generated_platform_content 
FROM daily_suggestions 
WHERE business_id = 'YOUR_BUSINESS_ID' 
  AND status = 'available' 
  AND date = CURRENT_DATE
LIMIT 1;

-- Note the suggestion ID for testing
```

---

## 🧪 Test Case 1: Both Platforms (Facebook + Instagram)

### Scenario
User with both FB and IG clicks "Fortsæt til Udgiv" from Design stage.

### Steps
1. **Navigate to AI Post Creation**
   - Go to http://localhost:3000/dashboard/create?mode=ai
   - Verify both FB and IG toggles are enabled in Forslag

2. **Generate Idea (Forslag → Design)**
   - Select a daily suggestion
   - Click "Næste" → verify text generation runs
   - **Open browser console** (⌘⌥I on Mac)
   - Look for log: `✅ Store populated, advancing to Design step`

3. **Verify Unified Draft Exists**
   - Still in Design stage
   - Run database query:
   ```sql
   SELECT id, business_id, platform, post_text, content_json::jsonb->'platformContent' as platform_content
   FROM post_drafts 
   WHERE business_id = 'YOUR_BUSINESS_ID' 
     AND idea_source = 'quick_suggestions'
     AND suggestion_id = YOUR_SUGGESTION_ID
     AND platform IS NULL;  -- Unified draft has NULL platform
   ```
   - **Expected**: 1 row with platform=NULL, platformContent contains both facebook and instagram

4. **Click "Fortsæt til Udgiv"**
   - In Design stage, click the blue "Fortsæt til Udgiv" button
   - **Watch console for logs**:
   ```
   [handleCreateNext] Advancing from Design → Udgiv
   [updateSuggestionStatus] Updating suggestion 123 to status=consumed
   ✅ Suggestion 123 status updated to consumed
   [handleCreateNext] Splitting draft into platform-specific drafts: ["facebook", "instagram"]
   [buildPlatformDraftContent] Extracting content for platform: facebook
   ✅ Platform facebook content extracted: {hashtagCount: 3, ...}
   ✅ Saved facebook draft with XXX chars
   [buildPlatformDraftContent] Extracting content for platform: instagram
   ✅ Platform instagram content extracted: {hashtagCount: 5, ...}
   ✅ Saved instagram draft with XXX chars
   [handleCreateNext] ✅ Platform split complete, unified draft deleted
   ```

5. **Verify Database Changes**
   ```sql
   -- Should return 2 rows: one for facebook, one for instagram
   SELECT 
     platform,
     post_text,
     content_json::jsonb->'hashtags' as hashtags,
     content_json::jsonb->'adjustments'->'includeBookingLink' as booking_link,
     suggested_post_datetime
   FROM post_drafts 
   WHERE business_id = 'YOUR_BUSINESS_ID' 
     AND idea_source = 'quick_suggestions'
     AND suggestion_id = YOUR_SUGGESTION_ID
   ORDER BY platform;
   ```

6. **Verify Suggestion Status Updated**
   ```sql
   SELECT id, status, selected_at, consumed_at 
   FROM daily_suggestions 
   WHERE id = YOUR_SUGGESTION_ID;
   ```
   - **Expected**: status='consumed', consumed_at is NOW()

### ✅ Success Criteria

| Aspect | Expected Result | How to Verify |
|--------|----------------|---------------|
| **Draft Count** | 2 rows (facebook, instagram) | SQL query returns 2 rows |
| **Facebook Hashtags** | Exactly 3 hashtags | Count hashtags in `post_text` for facebook row |
| **Instagram Hashtags** | Exactly 5 hashtags | Count hashtags in `post_text` for instagram row |
| **Facebook Booking URL** | `includeBookingLink: true` (when applicable) | Check `content_json.adjustments.includeBookingLink` |
| **Instagram Booking URL** | `includeBookingLink: false` (always) | Check `content_json.adjustments.includeBookingLink` |
| **Suggestion Status** | `status='consumed'` | Query daily_suggestions table |
| **Unified Draft Deleted** | 0 rows with platform=NULL | Query with `platform IS NULL` returns nothing |
| **Console Logs** | All ✅ checkmarks appear | Browser console shows success logs |

### 🔍 Detailed Verification: Hashtag Content

**Facebook post_text should contain:**
```
[Base text with emojis]

#AarhusCCafe #AarhusC #Moulesfrites
```

**Instagram post_text should contain:**
```
[Base text with emojis]

#AarhusCCafe #AarhusC #Moulesfrites #Cafe #CoffeeLovers
```

**Check exact counts:**
```sql
-- Count hashtags in post_text
SELECT 
  platform,
  (LENGTH(post_text) - LENGTH(REPLACE(post_text, '#', ''))) as hashtag_count,
  post_text
FROM post_drafts 
WHERE suggestion_id = YOUR_SUGGESTION_ID;
```

---

## 🧪 Test Case 2: Single Platform (Facebook Only)

### Scenario
User with only Facebook enabled clicks "Fortsæt til Udgiv".

### Steps
1. Disable Instagram in Forslag stage (toggle off)
2. Select suggestion, generate text
3. Click "Fortsæt til Udgiv"

### Expected Behavior
- **No split occurs** (single platform)
- Unified draft updated with `suggestedPostDatetime`
- Console log: `✅ Single platform draft updated with suggested datetime`
- Database: 1 row with platform=NULL
- Suggestion status: 'consumed'

---

## 🧪 Test Case 3: Single Platform (Instagram Only)

### Scenario
User with only Instagram enabled.

### Expected
Same as Test Case 2, but platform preference is Instagram.

---

## 🧪 Test Case 4: Booking Link Logic

### Scenario
Verify CTA differentiation based on booking availability.

### Setup
```sql
-- Check if business has booking_url configured
SELECT id, booking_url 
FROM businesses 
WHERE id = 'YOUR_BUSINESS_ID';
```

### Test 4A: Booking URL Exists
**Given**: Business has `booking_url` configured  
**When**: Generate post with booking CTA intent  
**Then**:
- Facebook draft: `content_json.adjustments.includeBookingLink = true`
- Instagram draft: `content_json.adjustments.includeBookingLink = false`

### Test 4B: No Booking URL
**Given**: Business has no `booking_url`  
**When**: Generate post  
**Then**:
- Both platforms: `includeBookingLink = false`

---

## 🧪 Test Case 5: Weekly Plan Posts

### Scenario
Test draft split when post comes from Weekly Plan (not daily suggestions).

### Steps
1. Navigate to Weekly Plan
2. Click "Create Post" on a planned post
3. Complete Design → Udgiv flow

### Expected
- Same split behavior as Test Case 1
- `idea_source = 'weekly_plan'`
- `suggestion_id = NULL` (not applicable)
- `weekly_plan_slot_date` populated instead

---

## 🧪 Test Case 6: Error Handling

### Scenario 6A: Network Failure During Split
**Simulate**: Disconnect network mid-split  
**Expected**: 
- Console error logged
- User sees error message
- Partial drafts may exist (acceptable — user can retry)

### Scenario 6B: Suggestion Status Update Fails
**Simulate**: Database permission error  
**Expected**:
- Error logged: `Failed to update suggestion status`
- Draft split **still completes** (non-blocking)
- User can proceed to Udgiv

---

## 🧪 Test Case 7: UI State (Locked Stages)

### Scenario
After advancing to Udgiv, verify Forslag and Design are locked.

### Steps
1. Complete flow: Forslag → Design → Udgiv
2. Try to go back to Design stage
3. Try to go back to Forslag stage

### Expected
- **Design Stage**: View-only, no text editing allowed
- **Forslag Stage**: Locked for the selected idea only
- Other ideas (if multiple) remain selectable

### UI Verification
- Edit buttons should be disabled
- Text fields should be read-only
- Visual indicator shows "locked" state

---

## 🐛 Common Issues & Debugging

### Issue: "Split complete" log appears but no drafts in database

**Debugging Steps**:
1. Check console for error logs
2. Verify `buildDbDraftKey()` returns valid key
3. Run query with broader filters:
   ```sql
   SELECT * FROM post_drafts 
   WHERE business_id = 'YOUR_BUSINESS_ID' 
   ORDER BY updated_at DESC 
   LIMIT 10;
   ```

### Issue: Both drafts have identical content

**Root Cause**: `buildPlatformDraftContent()` not filtering hashtags correctly

**Debugging**:
1. Check console log: `✅ Platform X content extracted: {hashtagCount: ...}`
2. Verify hashtag count matches (3 for FB, 5 for IG)
3. If counts are wrong, check `platformHashtagViews` in PostContent

### Issue: Instagram draft has booking URL

**Root Cause**: Platform filtering not working in `buildPlatformDraftContent()`

**Debugging**:
1. Check `content_json.adjustments.includeBookingLink` in database
2. Should be `false` for Instagram, regardless of business booking_url
3. Verify `platformContent.adjustments` is correctly extracted

### Issue: Suggestion status stays 'selected'

**Root Cause**: `updateSuggestionStatus()` failed silently

**Debugging**:
1. Check console for error: `Failed to update suggestion status`
2. Verify suggestion_id and business_id match
3. Check database permissions for daily_suggestions table

---

## 📊 Complete Verification Query

Run this after completing a full flow to verify everything:

```sql
WITH suggestion_info AS (
  SELECT id, business_id, title, status, consumed_at
  FROM daily_suggestions
  WHERE id = YOUR_SUGGESTION_ID
),
draft_info AS (
  SELECT 
    platform,
    (LENGTH(post_text) - LENGTH(REPLACE(post_text, '#', ''))) as hashtag_count,
    content_json::jsonb->'adjustments'->'includeBookingLink' as has_booking_link,
    LENGTH(post_text) as text_length
  FROM post_drafts
  WHERE suggestion_id = YOUR_SUGGESTION_ID
)
SELECT 
  s.status as suggestion_status,
  s.consumed_at,
  d.platform,
  d.hashtag_count,
  d.has_booking_link,
  d.text_length
FROM suggestion_info s
CROSS JOIN draft_info d
ORDER BY d.platform;
```

**Expected Output**:
```
suggestion_status | consumed_at           | platform  | hashtag_count | has_booking_link | text_length
------------------|-----------------------|-----------|---------------|------------------|-------------
consumed          | 2026-06-19 14:30:00   | facebook  | 3             | true             | 250
consumed          | 2026-06-19 14:30:00   | instagram | 5             | false            | 270
```

---

## 🚀 Quick Smoke Test

**Fastest way to verify the fix works:**

1. Open browser console
2. Navigate to `/dashboard/create?mode=ai`
3. Select ANY suggestion with both platforms enabled
4. Click through: Forslag → Design → Udgiv
5. **Look for this exact log**:
   ```
   ✅ Platform facebook content extracted: {hashtagCount: 3, ...}
   ✅ Platform instagram content extracted: {hashtagCount: 5, ...}
   ```

If you see those two logs with correct hashtag counts → **Fix is working!** ✅

---

## 📝 Test Report Template

After testing, document results:

```markdown
## Test Execution Report
**Date**: [DATE]
**Tester**: [NAME]
**Environment**: localhost:3000
**Business ID**: [ID]
**Suggestion ID**: [ID]

### Test Results
- [ ] Test Case 1: Both Platforms - PASS/FAIL
- [ ] Test Case 2: Facebook Only - PASS/FAIL
- [ ] Test Case 3: Instagram Only - PASS/FAIL
- [ ] Test Case 4: Booking Link Logic - PASS/FAIL
- [ ] Test Case 5: Weekly Plan Posts - PASS/FAIL
- [ ] Test Case 6: Error Handling - PASS/FAIL
- [ ] Test Case 7: UI State (Locked) - PASS/FAIL

### Issues Found
[List any bugs or unexpected behavior]

### Console Logs
[Paste relevant console output]

### Database Verification
[Paste SQL query results]
```

---

## 🎓 Advice on Test Quality

### Before Implementation Testing
1. ✅ **Test in development first** — never test in production
2. ✅ **Use console logs extensively** — they show what the code is doing
3. ✅ **Verify at database level** — UI can lie, database doesn't
4. ✅ **Test all paths** — both platforms, single platform, errors

### During Testing
1. ⚠️ **Watch for silent failures** — check both console AND database
2. ⚠️ **Test edge cases** — no booking URL, network failures, permission errors
3. ⚠️ **Verify counts manually** — don't trust aggregate queries alone

### After Testing
1. 📊 **Document everything** — what you tested, what you found
2. 🐛 **Report bugs immediately** — with steps to reproduce
3. ✅ **Regression test** — ensure old flows still work (single platform, weekly plan)

---

## ✅ Definition of Done

The fix is **READY FOR PRODUCTION** when:

- [x] All 7 test cases pass
- [x] Console logs show correct hashtag counts (3 vs 5)
- [x] Database verification confirms 2 separate drafts
- [x] Facebook draft has booking URL (when applicable)
- [x] Instagram draft NEVER has booking URL
- [x] Suggestion status updates to 'consumed'
- [x] Unified draft is deleted after split
- [x] No errors in console during happy path
- [x] Error handling works gracefully
- [x] UI shows locked states correctly

**Estimated Testing Time**: 30-45 minutes for complete verification

---

**Next Steps After Testing**:
1. If all tests pass → Deploy to production
2. If tests fail → Debug using console logs + SQL queries
3. Monitor production logs for first 24h after deployment
