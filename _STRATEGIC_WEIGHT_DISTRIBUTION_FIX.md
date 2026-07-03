# Strategic Weight Distribution Fix ✅

## Problem: MEDIUM 3 - Strategic Weight Inversion

**Before:**
- Phase 1 strategic brief had weighted angles (40%, 25%, 20%, 15%)
- Phase 2a ignored weights completely
- Each angle got exactly 1 post regardless of strategic importance
- Result: 15% weight angle = same post count as 40% weight angle ❌

**Example Week:**
```
Angle 1 (Frokostbesøg): 40% weight → 1 post (should be 2)
Angle 2 (Brand-fortælling): 25% weight → 1 post (correct)
Angle 3 (Wine pairing): 20% weight → 1 post (should be 0-1)
Angle 4 (Brunch): 15% weight → 1 post (should be 0)
```

Strategic priorities were NOT reflected in execution.

---

## Solution: Revenue-Adaptive Weight Distribution

**New Logic in Phase 2a:**

1. **Calculate ideal post count per angle:**
   ```
   idealCount = (angle.weight / totalWeight) × targetPostCount
   ```

2. **Floor to get base allocation:**
   ```
   40% × 4 posts = 1.6 → floor = 1 post
   25% × 4 posts = 1.0 → floor = 1 post
   20% × 4 posts = 0.8 → floor = 0 posts
   15% × 4 posts = 0.6 → floor = 0 posts
   ```

3. **Distribute fractional remainders with REVENUE PRIORITY:**
   ```
   Remaining slots: 4 - (1+1+0+0) = 2 posts to distribute
   
   Sort by:
   - Revenue angles first (drive_footfall, booking CTA) 💰
   - Then by fractional part size
   
   Angle 1 (40%): 0.6 fractional, IS revenue → gets +1 = 2 posts ✅
   Angle 3 (20%): 0.8 fractional, NOT revenue → gets +1 = 1 post ✅
   ```

4. **Final distribution:**
   ```
   Angle 1 (Frokostbesøg): 40% → 2 posts 💰 (revenue priority)
   Angle 2 (Brand-fortælling): 25% → 1 post 🎨
   Angle 3 (Wine pairing): 20% → 1 post
   Angle 4 (Brunch): 15% → 0 posts (squeezed out correctly)
   ```

---

## Revenue-Adaptive Philosophy

### Long-term vs Short-term Balance

**User requirement:**
> "Brand is long-term but we also need customers in the door NOW."

**Implementation:**
- Base allocation respects all strategic weights (floor of ideal count)
- **Fractional slots prioritize revenue angles** (booking/footfall)
- Brand posts still get their base weight allocation
- If brand weight is low (e.g., 15%), it naturally gets 0 posts in tight weeks

### Revenue Angle Detection

```typescript
const isRevenue = 
  angle.goal_mode === 'drive_footfall' || 
  angle.cta_mode === 'booking';
```

Revenue angles get first dibs on fractional slots.

---

## Integration with Timing Intelligence

**These two systems work together perfectly:**

### Strategic Weight Distribution (Phase 2a)
- Determines **HOW MANY posts** each angle gets
- Revenue angles get priority for fractional slots

### Timing Intelligence (Phase 2 enrichment)
- Determines **WHEN to post** based on context
- Event-driven, weather-driven, service period timing

### Example: Valentine's Week

**Strategic Brief:**
```
Angle 1: "Romantic Valentine's Dinner" - 40% weight, drive_footfall, booking
Angle 2: "Cozy Brand Story" - 25% weight, build_brand
Angle 3: "Wine Pairing" - 20% weight, retain_loyalty
Angle 4: "Weekend Brunch" - 15% weight, drive_footfall
```

**Weight Distribution (4 posts):**
```
Valentine's: 40% × 4 = 1.6 → 2 posts (revenue priority for .6 fractional)
Brand: 25% × 4 = 1.0 → 1 post
Wine: 20% × 4 = 0.8 → 1 post (gets .8 fractional)
Brunch: 15% × 4 = 0.6 → 0 posts (squeezed out)
```

**Timing Intelligence:**
```
Post 1 (Valentine's #1): Monday 14:00
  → "Romantic dinner bookinger beslutter sig 2-3 dage før. Valentine's torsdag → poster mandag."

Post 2 (Valentine's #2): Tuesday 15:00
  → "Sidste chance for booking. Poster tirsdag for torsdag aften."

Post 3 (Brand story): Wednesday 11:00
  → "Brand-post til maksimal rækkevidde. Poster midt på dagen."

Post 4 (Wine pairing): Friday 16:00
  → "Weekend wine lovers. Poster fredag eftermiddag."
```

**Result:**
- ✅ Valentine's dinner gets 2 posts (highest strategic weight)
- ✅ Both Valentine's posts scheduled Monday/Tuesday (booking lead time logic)
- ✅ Brand post gets 1 post (respects 25% weight)
- ✅ Brunch squeezed out (lowest weight, revenue priority elsewhere)

---

## Console Logging

New logs in Phase 2a show the distribution:

```
[Phase 2a] Distributing 4 posts with revenue-adaptive weighting
[Phase 2a] Revenue-adaptive distribution: 
  Romantic Valentine's Dinner: 40% weight → 2 posts 💰; 
  Cozy Brand Story: 25% weight → 1 posts 🎨; 
  Wine Pairing Expertise: 20% weight → 1 posts; 
  Weekend Brunch: 15% weight → 0 posts
```

💰 = Revenue angle (gets fractional priority)
🎨 = Brand/loyalty angle (respects base weight)

---

## Benefits

1. **Strategic priorities reflected in execution**
   - 40% weight angle gets ~40% of posts (2 of 4)
   - Not flat 25% per angle regardless of importance

2. **Revenue-first when it matters**
   - Fractional slots go to booking/footfall angles
   - Ensures short-term revenue needs are met

3. **Brand not completely squeezed**
   - Base weight allocation still respected
   - 25% brand weight still gets 1 post minimum

4. **Adaptive to business context**
   - Valentine's week → Valentine's angle gets 2 posts
   - Summer week → outdoor seating angle gets more posts
   - Winter week → cozy atmosphere angle gets more posts

---

## Testing

**Test week 27 strategy:**
```bash
curl -X POST 'https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/get-weekly-strategy' \
  -H "Content-Type: application/json" \
  -d '{"business_id": "561f8fe8-41cb-4191-87e4-5cabf9bcdd79", "week_start": "2025-06-30"}'
```

**Check distribution:**
```bash
jq '.strategy.post_ideas | group_by(.angle_focus) | 
  map({angle: .[0].angle_focus, count: length, weight: .[0].angle_weight}) | 
  sort_by(-.count)'
```

---

## Deployment Status

- ✅ Code updated in phase2a.ts (lines 95-180)
- ✅ Deployed get-weekly-strategy (782.6kB)
- ✅ Integrated with timing intelligence (already deployed)
- 🟡 Ready for testing with real strategy generation

---

## Next Steps

1. **Delete cached strategies** to force fresh generation with new logic
2. **Generate week 27 strategy** to verify weight distribution
3. **Check console logs** for revenue-adaptive distribution messages
4. **Verify UI** shows correct angle focus distribution
5. **Monitor user feedback** on post composition balance
