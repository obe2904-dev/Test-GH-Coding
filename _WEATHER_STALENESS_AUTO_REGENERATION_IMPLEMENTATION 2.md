# Weather & Staleness Auto-Regeneration Implementation

**Date:** 2026-06-15  
**Status:** ✅ Implemented  
**Location:** `supabase/functions/get-weekly-strategy/index.ts`

---

## Problem Statement

### Data Alignment Issues
- **"Ugens kontekst"** (top section) → FRESH data from database
- **"Vejrudsigt"** (weather) → FRESH data from OpenWeatherMap API
- **"Ugens Strategi"** (strategic brief) → CACHED data from `weekly_strategies` table
- **Result:** User sees contradictory information when:
  1. Weather forecast updates (rainy → sunny)
  2. Brand profile regenerated (content_strategy updated)

### Regeneration Logic Inconsistency
- **Current week:** Cannot regenerate (locked once in progress)
- **Next week:** Can regenerate anytime (no restrictions)
- **Problem:** User can accidentally regenerate and lose high-quality first-generation strategy

---

## Solution Implemented

### 1. Weather Change Detection (`hasSignificantWeatherChange`)

**Triggers regeneration when:**
- Rain pattern shifts ≥2 days (e.g., 2 rainy days → 5 rainy days)
- Temperature changes ≥5°C average
- Weather pattern shifts (e.g., `cold_week` → `hot_week`)

**Examples:**
```typescript
// Triggers regeneration:
Old: 2 rainy days, 18°C average, pattern: "mild_week"
New: 5 rainy days, 13°C average, pattern: "rainy_week"
→ Auto-regenerate (rain +3 days, temp -5°C, pattern changed)

// Does NOT trigger:
Old: 3 rainy days, 18°C, pattern: "mixed_week"
New: 4 rainy days, 17°C, pattern: "mixed_week"
→ Keep cache (only +1 rain day, -1°C, same pattern)
```

**Code Location:** Lines 35-78

---

### 2. Brand Profile Staleness Detection (`checkStrategyFreshness`)

**Triggers regeneration when:**
- `business_brand_profile.updated_at` > `weekly_strategies.generated_at`
- Example: Brand profile regenerated → content_strategy changed → old weekly strategy now stale

**Returns:**
```typescript
{
  isStale: boolean,
  reason?: string,  // e.g., "Brand profile updated 15 minutes after strategy generation"
  brand_profile_updated?: string,  // ISO timestamp
  strategy_generated?: string  // ISO timestamp
}
```

**Code Location:** Lines 80-108

---

### 3. Auto-Regeneration Logic

**Applies to BOTH current and next week:**
- No longer allows unrestricted regeneration for next week
- Both weeks now follow same rules: regenerate ONLY when data changes significantly
- Prevents "AI forced to regenerate from scratch" quality loss

**Flow:**
```
1. Fetch existing strategy from weekly_strategies
2. IF existing AND status='generated' AND !body.regenerate:
   a. Check weather changes → hasSignificantWeatherChange()
   b. Check brand profile staleness → checkStrategyFreshness()
   c. IF either returns true → shouldAutoRegenerate = true
3. IF shouldAutoRegenerate:
   → Skip cache, proceed to regeneration
4. ELSE:
   → Return cached strategy
```

**Code Location:** Lines 1517-1546

---

## Benefits

### ✅ Data Alignment
- Weather changes → Strategy auto-regenerates → All sections aligned
- Brand profile updated → Strategy auto-regenerates → "Ingen baseline content strategy fundet" message disappears
- User always sees consistent data across all UI sections

### ✅ Quality Preservation
- Next week no longer allows arbitrary regeneration
- Regeneration only happens when underlying data changed
- Prevents "different but not better" AI outputs from unnecessary regeneration

### ✅ User Experience
- No manual "delete and regenerate" workflow needed
- System automatically detects when regeneration improves vs just changes
- Logs clearly indicate WHY regeneration happened:
  ```
  [get-weekly-strategy] Weather changed significantly since strategy generation — auto-regenerating
  [get-weekly-strategy] Brand profile updated since strategy generation: Brand profile updated 15 minutes after strategy generation
  ```

---

## What's NOT Implemented (Future Work)

### Todo #3: Visual Indicators in UI
- **Current:** No UI indication that strategy is stale
- **Needed:** Warning banner: "⚠️ Strategy generated before brand profile update - regeneration recommended"
- **Status:** Not started

### Todo #4: Non-Weather Regeneration UX
- **Current:** No preview/diff system, no selective update
- **Needed:** 
  - "Preview changes before regenerating"
  - "Update only strategic brief, keep post ideas"
  - "Show diff of old vs new"
- **Status:** Design phase needed

---

## Testing Scenarios

### Scenario 1: Weather Forecast Updates
```
1. Generate strategy for week 2026-06-22 (weather: 2 rainy days, 18°C)
2. Weather API updates (now: 5 rainy days, 13°C)
3. User refreshes Weekly Plan page
Expected: Strategy auto-regenerates with new weather context
```

### Scenario 2: Brand Profile Regenerated
```
1. Generate strategy (content_strategy = NULL)
   → Strategy contains "Ingen baseline content strategy fundet"
2. Regenerate brand profile
   → content_strategy now = {drive_footfall: 57, build_brand: 27, retain_loyalty: 17}
3. User views Weekly Plan
Expected: Strategy auto-regenerates with correct content_strategy
```

### Scenario 3: No Significant Changes
```
1. Generate strategy (weather: 3 rainy days, 18°C)
2. Weather updates slightly (weather: 4 rainy days, 17°C)
3. User refreshes page
Expected: Cached strategy returned (changes not significant)
```

---

## Database Schema Dependencies

### Required Fields
- `business_brand_profile.updated_at` (timestamp) - Added in this implementation
- `weekly_strategies.week_context_snapshot` (jsonb) - Already exists, contains weather snapshot
- `weekly_strategies.generated_at` (timestamp) - Already exists

### Query Changes
```sql
-- Added updated_at to brand_profile SELECT query (line 233)
SELECT 
  ...,
  updated_at
FROM business_brand_profile
WHERE business_id = $1;

-- Added week_context_snapshot to existing strategy SELECT (line 1547)
SELECT 
  id, status, narrative, strategic_priorities, post_ideas, 
  selected_idea_ids, strategic_brief, strategic_brief_raw, 
  strategy_version, generated_at, week_context_snapshot
FROM weekly_strategies
WHERE business_id = $1 AND week_start = $2;
```

---

## Logging & Debugging

**Key Log Messages:**
```
[Weather Change] Rain days changed: { old: 2, new: 5, delta: 3 }
[Weather Change] Temperature changed significantly: { old: 18, new: 13, delta: 5 }
[Weather Change] Pattern shifted: { old: 'mild_week', new: 'rainy_week' }
[get-weekly-strategy] Weather changed significantly since strategy generation — auto-regenerating
[get-weekly-strategy] Brand profile updated since strategy generation: Brand profile updated 15 minutes after strategy generation
[get-weekly-strategy] Regenerating despite existing strategy: {
  existing_id: '...',
  existing_status: 'generated',
  regenerate_flag: false,
  auto_regenerate: true,
  auto_regenerate_reason: 'weather_changed+brand_profile_updated'
}
```

---

## Related Files

- `supabase/functions/get-weekly-strategy/index.ts` - Main implementation
- `supabase/functions/_shared/post-helpers/strategy/weather-interpreter.ts` - Weather scoring bug fixed (condition check before precipitation_chance)
- `src/lib/locales/da.json` - Removed "Godt for udetrafik" hardcoded assessment
- `src/components/weekly-plan/WeeklyPlanOverview.tsx` - Removed hardcoded weekend assessment logic

---

## Next Steps

1. **Test in production with real weather changes**
   - Monitor logs for auto-regeneration triggers
   - Verify data alignment across UI sections

2. **Implement visual indicators (Todo #3)**
   - Add staleness metadata to API response
   - Show warning banner in UI when regeneration recommended but not auto-triggered

3. **Design selective update UX (Todo #4)**
   - User research: When do users want to regenerate?
   - Prototype: Preview/diff system
   - Implement: Selective section updates without full regeneration
