# Navigation Flow Quality Assurance Test Guide

## Overview
This guide tests the 3-stage navigation flow (Ugentlig/Forslag → Design → Udgiv) for:
- **Quick Suggestions** (Lav forslag nu - same-day ideas)
- **Weekly Plan** (current week + next week)
- **Manual Write** mode

---

## Test 1: Quick Suggestions - Forward Navigation

### Steps:
1. Navigate to `/dashboard/create?mode=ai`
2. Wait for "Generer forslag nu" or 3 AI suggestions to load
3. If gate view: Click "Generer forslag nu" → verify 3 suggestions appear
4. Click on Suggestion #1
5. Verify step changes to "Design" (step 2)
6. Verify generated text appears in editor
7. Verify hashtags are populated
8. Click "Næste" to go to Publish
9. Verify calendar and scheduling UI appears

### Expected Results:
✅ Suggestion selection advances to Design automatically  
✅ Content is generated and displayed  
✅ Can navigate to Publish with valid content  

### Error Conditions to Test:
❌ Try clicking Publish indicator (step 3) from Generate → Should be blocked  
❌ Try clicking Publish indicator without content → Should be blocked

---

## Test 2: Quick Suggestions - Backward Navigation

### Steps:
1. Complete Test 1 to reach Publish step
2. Click "Tilbage" button to return to Design
3. Verify content is still present (text, hashtags, photos if uploaded)
4. Click "Tilbage" again to return to Generate
5. Verify suggestions are still visible
6. Click "Næste" to return to Design
7. Verify content is restored (text, hashtags)

### Expected Results:
✅ Back navigation preserves content  
✅ Forward navigation restores content  
✅ No blank/empty pages during navigation

---

## Test 3: Quick Suggestions - Photo Persistence

### Steps:
1. Select AI Suggestion #1
2. In Design step, upload a photo
3. Navigate to Publish (step 3)
4. Navigate back to Design
5. **Verify photo is still visible** (should NOT reload from DB)
6. Navigate back to Generate
7. Select different suggestion (Suggestion #2)
8. Click "Næste" to Design
9. Verify photo from Suggestion #1 is NOT shown
10. Navigate back, select Suggestion #1 again
11. Verify photo from step 2 is restored

### Expected Results:
✅ Photos persist when navigating within same suggestion  
✅ Photos are cleared when switching suggestions  
✅ Photos are restored when returning to same suggestion  

---

## Test 4: Quick Suggestions - Data Isolation

### Steps:
1. Select Suggestion #1, generate content
2. Edit the text manually (add "EDITED 1" to the end)
3. Upload a photo
4. Navigate back to Generate
5. Select Suggestion #2
6. Verify content from Suggestion #1 does NOT appear
7. Generate content for Suggestion #2
8. Edit text (add "EDITED 2")
9. Navigate back to Generate
10. Select Suggestion #1 again
11. Verify "EDITED 1" text is restored
12. Verify photo from step 3 is restored

### Expected Results:
✅ Each suggestion maintains its own draft  
✅ No data drift between suggestions  
✅ Drafts are restored when returning to same suggestion

---

## Test 5: Weekly Plan - Post Switching

### Steps:
1. Navigate to `/dashboard/content/ai-weekly-plan`
2. Wait for weekly plan to load
3. Click "Brug dette opslag →" on Post Day 1
4. Verify navigation to create page with content auto-generated
5. Edit the text (add "MONDAY EDIT")
6. In the tab strip at top, click Post Day 2
7. Verify content changes to Day 2's post
8. Click back to Post Day 1 tab
9. Verify "MONDAY EDIT" text is preserved
10. Navigate to Publish
11. Navigate back to Design
12. Switch tabs between different posts
13. Verify each post keeps its own edits

### Expected Results:
✅ Each weekly plan post maintains independent draft  
✅ Tab switching preserves edits  
✅ No data drift between different days  
✅ **Loading state prevents rapid clicking** (should not allow switching while loading)

---

## Test 6: Weekly Plan - Photo Persistence Per Post

### Steps:
1. Open weekly plan Post Day 1
2. Upload photo A
3. Switch to Post Day 2 (via tab)
4. Upload photo B
5. Switch back to Post Day 1
6. Verify photo A is shown (not photo B)
7. Switch to Post Day 2
8. Verify photo B is shown (not photo A)

### Expected Results:
✅ Photos are isolated per post  
✅ Photo switching works correctly

---

## Test 7: Manual Write Mode - Validation

### Steps:
1. Navigate to `/dashboard/create?mode=write`
2. Verify step indicator shows Generate (step 1)
3. Try clicking Publish indicator → Should be blocked (no content)
4. Click Design step indicator → Should be allowed (can upload photos)
5. Try clicking Publish → Should still be blocked (no text or photos)
6. Upload a photo
7. Try clicking Publish → Should now be ALLOWED (has photo, no text required)
8. Remove photo
9. Type text "This is my manual post content"
10. Try clicking Publish → Should be ALLOWED (has text)

### Expected Results:
✅ Publish requires either text (≥10 chars) OR photos  
✅ Navigation guards prevent empty publish  
✅ Can publish with photos only  
✅ Can publish with text only

---

## Test 8: Committed Suggestion Lock

### Steps:
1. Select an AI suggestion and complete it to Publish
2. Schedule or publish the post
3. Navigate back to `/dashboard/create?mode=ai`
4. Verify the published suggestion shows lock badge
5. Try clicking on locked suggestion
6. Verify you cannot edit it
7. Verify other suggestions are still selectable

### Expected Results:
✅ Published suggestions are locked  
✅ Lock badge is visible  
✅ Cannot edit committed suggestions  
✅ Other suggestions remain available

---

## Test 9: Navigation After Midnight Reset

### Setup:
Wait for date change at midnight OR manually change system time to 23:59, wait 2 minutes

### Steps:
1. Before midnight: Generate AI suggestions
2. Select and edit Suggestion #1
3. After midnight: Refresh page
4. Navigate to create page
5. Verify old suggestions are cleared
6. Verify "Generer forslag nu" gate appears
7. Generate new suggestions for new day
8. Verify previous day's draft is NOT shown

### Expected Results:
✅ Suggestions reset at midnight  
✅ Gate view appears for new day  
✅ Previous drafts don't leak into new day

---

## Test 10: Empty Page Guards

### Scenario A: No selection
1. Go to `/dashboard/create?mode=ai`
2. Do NOT select any suggestion
3. Try clicking Design step indicator → Should be blocked
4. Try clicking Publish step indicator → Should be blocked

### Scenario B: Deleted content
1. Select suggestion, generate content
2. Navigate to Design
3. Delete all text
4. Remove all photos (if any)
5. Try navigating to Publish → Should be blocked

### Scenario C: Weekly plan no generation
1. Open weekly plan post
2. Immediately try clicking Publish indicator → Should be blocked until content generates

### Expected Results:
✅ Cannot advance without selection/content  
✅ Cannot publish empty posts  
✅ No blank/white screen pages

---

## Browser Console Tests

Run these in browser console to validate state:

```javascript
// Test 1: Check current step
console.log('Current step:', window.location.pathname)

// Test 2: Check Zustand store state
const store = window.__ZUSTAND_STORE__ // If exposed
console.log('Active path:', store?.activePath)
console.log('Current step:', store?.aiIdeerStep)
console.log('Post content:', store?.postContent)

// Test 3: Check for errors
console.log('Errors:', document.querySelectorAll('[class*="error"]').length)

// Test 4: Validate photos loaded
console.log('Photos:', store?.photoContent?.uploadedMedia?.length)
```

---

## Performance Tests

### Test 11: Rapid Navigation
1. Quickly click: Generate → Design → Publish → Design → Generate
2. Verify no crashes
3. Verify content remains consistent

### Test 12: Rapid Suggestion Switching
1. Click Suggestion #1 → #2 → #3 → #1 → #2 rapidly
2. Verify no crashes
3. Verify correct content loads for final selection

### Test 13: Weekly Plan Rapid Tab Switching
1. Rapidly click through all 7 post tabs
2. Verify loading state prevents issues
3. Verify no blank content appears

---

## Acceptance Criteria

All tests must pass with:
- ✅ No TypeScript errors
- ✅ No console errors
- ✅ No blank/white pages
- ✅ Data persists correctly
- ✅ No data drift between ideas
- ✅ Navigation guards work
- ✅ Photos load/clear appropriately
- ✅ Smooth user experience

---

## Known Issues to Verify Are Fixed

1. ~~Photo clearing on same suggestion return~~ → FIXED: Now tracks previous ID
2. ~~Missing Publish guards for AI/Weekly~~ → FIXED: Added RULE 2 & 3
3. ~~Weekly plan race condition~~ → FIXED: Added loading state
4. ~~Blank pages during navigation~~ → FIXED: Content guards in place

---

## Regression Tests

After implementing fixes, ensure:
- [ ] Test 1-13 all pass
- [ ] No new errors in console
- [ ] Performance is acceptable (no noticeable lag)
- [ ] Mobile view works (if applicable)
- [ ] Works in Chrome, Safari, Firefox
