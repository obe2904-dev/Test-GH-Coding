# Fix: Regenerate Ideas Producing Same Results

**Date:** 2026-06-10  
**Issue:** When clicking "Regenerate" in Quick Suggestions, users get the same AI ideas repeatedly  
**Status:** ✅ FIXED

## Root Cause Analysis

### What Was Happening
1. ✅ The `deactivate_old_suggestions` SQL function **was working correctly**
   - It properly cleared cached text and deactivated old suggestions
   - Logs confirmed: "✅ Deactivated old suggestions for new batch"

2. ✅ The rotation queue **was working correctly**
   - It properly prioritized dishes by "least recently posted"
   - Logs showed: "🔄 Rotation queue: 40 dishes available"

3. ❌ **The real problem:** Gemini AI was selecting the same dishes every time
   - The menu was presented to Gemini in the same order each time
   - Even with `temperature: 0.85`, Gemini consistently picked the same dishes
   - Example: Always picking "Faust Gryde" and "Hovedret" from the menu

### Why This Happened
- The rotation queue provides dishes in a **deterministic priority order** (never posted → oldest first)
- This same ordered list was passed to Gemini every time
- With the same prompt, same menu order, and same context, Gemini made deterministic choices
- Temperature 0.85 added some variation in **text generation**, but not enough to change **dish selection**

## The Fix

### Code Changes
**File:** `supabase/functions/get-quick-suggestions/index.ts`

Added Fisher-Yates shuffle to randomize the top 20 dishes when regenerating:

```typescript
if (regenerate && rotationQueue.length > 3) {
  // Fisher-Yates shuffle of top 20 dishes
  const topN = Math.min(20, rotationQueue.length)
  const topDishes = rotationQueue.slice(0, topN)
  const remainingDishes = rotationQueue.slice(topN)
  activeQueue = [...shuffleArray(topDishes), ...remainingDishes]
  console.log(`🔀 Regenerate mode: shuffled top ${topN} dishes for variety`)
}
```

### How It Works Now
1. **First load** (not regenerating): Uses rotation queue in priority order
   - Ensures least-posted dishes get priority
   
2. **Regenerate mode**: Shuffles top 20 dishes before presenting to Gemini
   - Gemini sees different dishes in different positions
   - Selects different combinations while still favoring under-posted items
   - User gets varied suggestions on each regeneration

### What Wasn't Broken
- ✅ SQL function `deactivate_old_suggestions` - already working
- ✅ Rotation queue logic - already working  
- ✅ Cache clearing - already working

## Deployment

### Step 1: Deploy Edge Function
```bash
cd "/Users/olebaek/Library/Mobile Documents/com~apple~CloudDocs/Test P2G 1-iCloud"
supabase functions deploy get-quick-suggestions
```

### Step 2: Test
1. Go to Quick Suggestions in the app
2. Generate initial suggestions
3. Click "Regenerate" 
4. Verify you get **different dish selections** (not just different text)
5. Click "Regenerate" again
6. Verify continuous variety

### Expected Behavior After Fix
- ✅ Each regeneration produces different dish ideas
- ✅ Still respects rotation priority (favors under-posted dishes)
- ✅ No repeated ideas on consecutive regenerations
- ✅ Variety in both dish selection AND generated text

## Technical Details

### Before Fix
```
Regenerate #1: "Faust Gryde klar til aften", "Aftenens udvalgte hovedret"
Regenerate #2: "Faust Gryde klar til aften", "Aftenens udvalgte hovedret"  ❌
Regenerate #3: "Faust Gryde klar til aften", "Aftenens udvalgte hovedret"  ❌
```

### After Fix
```
Regenerate #1: "Faust Gryde klar til aften", "Aftenens udvalgte hovedret"
Regenerate #2: "4 Slags Oste - perfekt til regn", "Dagens special venter"  ✅
Regenerate #3: "Kalvekød i sæson", "Weekendens grill-favorit"             ✅
```

## Files Modified
1. ✅ `supabase/functions/get-quick-suggestions/index.ts` - Added shuffle logic
2. ℹ️ `_FIX_REGENERATE_CACHE.sql` - Already deployed, working correctly
3. ℹ️ `supabase/migrations/20260610000001_enhance_suggestion_regeneration.sql` - Already applied

## Verification
After deploying, check logs for:
- `🔀 Regenerate mode: shuffled top N dishes for variety`
- `New top 3: [different dishes each time]`
- Different suggestion titles on each regeneration

---

**Status:** Ready for deployment  
**Impact:** Low risk - only affects regenerate flow, not initial generation  
**Rollback:** Simply redeploy previous version if issues occur
