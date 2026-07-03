# REGENERATION LIMIT UPDATE - TEST PLAN
## Date: 2026-05-15

## Changes Summary

### Backend Changes
1. ✅ Database function `get_daily_usage_stats()` - Free tier limit: 2 → 1
2. ✅ Edge Function `get-quick-suggestions` - Free tier limit: 2 → 1
3. ✅ Error message updated: "2 regenereringer" → "1 regenerering"

### Frontend Changes  
4. ✅ Counter calculation: (limit + 1) × 3 = 6 total suggestions for Free
5. ✅ Button text: "Regenerer ideer" → "Vis andre forslag"
6. ✅ Limit message: "Daglig grænse nået" → "Du har brugt dagens ekstra forslag"
7. ✅ Banner message: Updated to "Du har brugt dagens ekstra forslag. De nulstilles kl. 00:00."

---

## Test Scenarios

### Test 1: Fresh User (0 regenerations used)
**Expected:**
- Counter shows: "Dagens Forslag 3/6"
- Button shows: "Vis andre forslag"
- Button is ENABLED
- No warning message

**Test SQL:**
```sql
-- Reset counter for test business
UPDATE businesses 
SET quick_suggestions_today = 0 
WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Check stats
SELECT * FROM get_daily_usage_stats('f4679fa9-3120-4a59-9506-d059b010c34a');
```

**Expected Result:**
```
regenerations_used: 0
regenerations_limit: 1
```

---

### Test 2: After First Regeneration (1 used = AT LIMIT)
**Expected:**
- Counter shows: "Dagens Forslag 6/6"
- Button shows: "🔒 Du har brugt dagens ekstra forslag"
- Button is DISABLED
- Warning shows: "Du har brugt dagens ekstra forslag. De nulstilles kl. 00:00."

**Test SQL:**
```sql
-- Simulate 1 regeneration
UPDATE businesses 
SET quick_suggestions_today = 1 
WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Check stats
SELECT * FROM get_daily_usage_stats('f4679fa9-3120-4a59-9506-d059b010c34a');
```

**Expected Result:**
```
regenerations_used: 1
regenerations_limit: 1
→ User is AT LIMIT (1/1)
```

---

### Test 3: API Quota Check (Edge Function)
**Expected:**
When user at limit tries to regenerate:
- Returns 429 status
- Error message: "Du har brugt din daglige regenerering 😊\nKom tilbage i morgen..."

**Test:**
Call Edge Function with `regenerate: true` when business has `quick_suggestions_today = 1`

---

### Test 4: Text Generation Tracking
**Verify tracking still works:**

```sql
-- Generate text from suggestion #13
SELECT record_text_generation(13);

-- Check stats
SELECT * FROM get_daily_usage_stats('f4679fa9-3120-4a59-9506-d059b010c34a');
```

**Expected:**
- `texts_generated` increments
- `suggestions_selected` increments
- Regeneration counter unchanged

---

### Test 5: Smart/Pro Tier Limits (Unchanged)
**Expected:**
- Smart tier: 3 regenerations
- Pro tier: 5 regenerations

**Test SQL:**
```sql
-- Test Smart tier
UPDATE businesses SET plan = 'smart' WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
SELECT * FROM get_daily_usage_stats('f4679fa9-3120-4a59-9506-d059b010c34a');
-- Should show: regenerations_limit = 3

-- Test Pro tier  
UPDATE businesses SET plan = 'pro' WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
SELECT * FROM get_daily_usage_stats('f4679fa9-3120-4a59-9506-d059b010c34a');
-- Should show: regenerations_limit = 5

-- Reset to free
UPDATE businesses SET plan = 'free' WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
```

---

## Quality Checks

### Backend Consistency ✅
- [x] Database function uses limit = 1
- [x] Edge Function uses limit = 1  
- [x] Both have matching tier logic

### Frontend Consistency ✅
- [x] Counter math: (1 + 1) × 3 = 6 ✓
- [x] Button text updated
- [x] Warning messages updated
- [x] No TypeScript errors

### User Experience ✅
- [x] Clear messaging ("ekstra forslag" not "regenereringer")
- [x] Positive framing ("Vis andre forslag" not "Regenerer")
- [x] Limit explanation ("De nulstilles kl. 00:00")

---

## Deployment Checklist

- [x] Database function updated and applied
- [x] Edge Function deployed (get-quick-suggestions)
- [x] Frontend code updated (no deployment needed - will deploy with next release)
- [ ] Test in production with real user flow
- [ ] Monitor API usage after deployment
- [ ] Verify cost reduction (1 regen instead of 2)

---

## Rollback Plan

If issues arise:

1. **Revert database function:**
```sql
-- In FIX_USAGE_STATS_FUNCTION.sql, change:
WHEN v_plan = 'free' THEN 2  -- Back to 2
```

2. **Revert Edge Function:**
```typescript
// In get-quick-suggestions/index.ts:
const TIER_LIMITS = { free: 2, ... }  // Back to 2
const message = 'Du har brugt dine 2 regenereringer...'
```

3. **Revert Frontend:**
No immediate action needed (UI will auto-adjust based on backend limits)

---

## Success Metrics

**Immediate (Day 1):**
- [ ] Zero errors in production logs
- [ ] Users see correct counter (3/6)
- [ ] Button text displays correctly
- [ ] Limit enforcement works (blocks at 1 regeneration)

**Week 1:**
- [ ] 50% reduction in regeneration API calls (2→1 per user/day)
- [ ] Zero user complaints about limits
- [ ] Cost per user decreases proportionally

**Week 4:**
- [ ] Measure conversion rate (Free → Smart)
- [ ] Compare to baseline before change

---

## Notes

**Why this change matters:**
1. **Cost control:** Reduces Free tier API cost by 50%
2. **Behavior shaping:** Trains users to take suggestions seriously, not spam regenerate
3. **Upgrade incentive:** Scarcity creates value perception for Smart tier
4. **Product positioning:** "Ekstra forslag" frames it as bonus, not punishment

**User mental model shift:**
- OLD: "I have 2 regenerations to burn through"
- NEW: "I have 1 escape hatch if the first batch doesn't fit"

This aligns regeneration with its TRUE purpose: contextual fit, not infinite variety.
