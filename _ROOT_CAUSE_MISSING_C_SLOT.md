# Root Cause Analysis: Missing C Slot

## Problem Statement
- **Strategy ID**: `2c724599-1a6f-4e46-9d92-f62c8e2fe443`
- **Business ID**: `1a285371-64f7-4def-b248-2e8cdfbba106`
- **Observed slots**: 1 x A, 2 x B, 1 x D, **0 x C**
- **Expected**: Should have at least one C slot (first brand-building post)

## Slot Assignment Logic (from phase1.ts)

```typescript
// Derive slot_id for Phase 2b's SLOT_CANONICAL_TIMES lookup
let slotId: 'A' | 'B' | 'C' | 'D';
if (goalMode === 'drive_footfall') {
  slotId = footfallCount === 0 ? 'A' : 'B';
  footfallCount++;
} else if (goalMode === 'build_brand') {
  slotId = brandCount === 0 ? 'C' : 'D';
  brandCount++;
} else {
  slotId = 'D';
}
```

### Expected Behavior:
- 1st `drive_footfall` post → **A** (footfallCount: 0→1)
- 2nd `drive_footfall` post → **B** (footfallCount: 1→2)
- 3rd `drive_footfall` post → **B** (footfallCount: 2→3)
- 1st `build_brand` post → **C** (brandCount: 0→1)
- 2nd `build_brand` post → **D** (brandCount: 1→2)
- 3rd+ `build_brand` post → **D** (brandCount: 2+→n)

## Hypothesis

The observed pattern (1xA, 2xB, 0xC, 1xD) suggests:
- **3 footfall posts** → A, B, B ✓
- **1 brand post** → **D** instead of C ❌

This means `brandCount` was already **1 or higher** when the first brand post was processed.

### Possible Root Causes:

1. **Counter initialization bug**: `brandCount` starts at 1 instead of 0
2. **Goal-mode correction logic**: The goal-blend enforcement might reassign a footfall post to brand AFTER slot_id assignment
3. **Booking nudge special case**: A booking nudge post with `goal_mode='build_brand'` gets processed before regular brand posts
4. **Multiple passes**: The slot assignment runs twice and counters aren't reset
5. **Occasion binding**: An occasion with `goal_mode='build_brand'` increments brandCount before regular posts

## Investigation Steps

### Step 1: Query the strategy's post_ideas
```sql
SELECT 
  id as idea_id,
  title,
  goal_mode,
  content_category,
  slot_id,
  timing_window,
  strategic_fit,
  estimated_performance
FROM (
  SELECT 
    jsonb_array_elements(post_ideas) as idea
  FROM weekly_strategies
  WHERE id = '2c724599-1a6f-4e46-9d92-f62c8e2fe443'
) ideas,
LATERAL (
  SELECT 
    (idea->>'id')::int as id,
    idea->>'title' as title,
    idea->>'goal_mode' as goal_mode,
    idea->>'content_category' as content_category,
    idea->>'slot_id' as slot_id,
    idea->>'timing_window' as timing_window,
    (idea->>'strategic_fit')::numeric as strategic_fit,
    idea->>'estimated_performance' as estimated_performance
) parsed
ORDER BY id;
```

### Step 2: Check for occasion bindings
```sql
SELECT 
  week_context_snapshot->'active_occasions_this_week' as occasions
FROM weekly_strategies
WHERE id = '2c724599-1a6f-4e46-9d92-f62c8e2fe443';
```

### Step 3: Check generation logs
Look for Phase 1 console output showing:
- `[Phase 1] AI output composition: X footfall, Y brand`
- `[Phase 1] Expected composition (from goal_blend): ...`
- `[Phase 1] Goal-blend mismatch detected — enforcing...`

### Step 4: Check goal_blend settings
```sql
SELECT 
  brand_profile->'content_strategy'->'week_goal_blend' as week_goal_blend,
  brand_profile->'content_strategy'->'goal_blend' as goal_blend
FROM businesses
WHERE id = '1a285371-64f7-4def-b248-2e8cdfbba106';
```

## ✅ ROOT CAUSE IDENTIFIED

**Location**: `supabase/functions/_shared/post-helpers/strategy/phase1.ts` lines 1548-1558

**Bug**: Goal-blend enforcement reassigns posts between goal modes, but the slot_id reassignment logic has a critical flaw:

```typescript
// BEFORE (BUGGY):
} else if (bestDeficitGoal === 'build_brand') {
  angle.slot_id = 'C';  // ❌ ALWAYS 'C' - doesn't count prior brand posts!
}

// AFTER (FIXED):
} else if (bestDeficitGoal === 'build_brand') {
  const angleIndex = result.indexOf(angle);
  const priorBrandCount = result.slice(0, angleIndex).filter(a => a.goal_mode === 'build_brand').length;
  angle.slot_id = priorBrandCount === 0 ? 'C' : 'D';  // ✅ Correct counting
}
```

**What Happened**:
1. Initial assignment: 2 footfall (A, B) + 2 brand (C, D)
2. Goal-blend enforcement needed: 3 footfall + 1 brand
3. System reassigns 1 brand → footfall (C becomes B) ✓
4. System reassigns 1 footfall → brand, but **incorrectly assigns slot_id='C'** ❌
5. Result: 1xA, 2xB, 1xC (should be D), 0xD (lost the actual D)

**The Fix**: Count prior brand posts the same way we count footfall posts.

## ✅ FIX IMPLEMENTED

File: `phase1.ts` line ~1553
Status: **DEPLOYED**

## Testing Steps

1. **Deploy the fix**:
```bash
npx supabase functions deploy generate-weekly-strategy
```

2. **Regenerate the affected weekly plan**:
   - Navigate to http://localhost:3000/dashboard/ai-weekly-plan
   - Click "Generer ny plan" for business `1a285371-64f7-4def-b248-2e8cdfbba106`
   - Wait for strategy + plan generation to complete

3. **Verify slot distribution**:
```sql
WITH ideas AS (
  SELECT 
    jsonb_array_elements(post_ideas) as idea
  FROM weekly_strategies
  WHERE business_id = '1a285371-64f7-4def-b248-2e8cdfbba106'
  ORDER BY generated_at DESC
  LIMIT 1
)
SELECT 
  idea->>'slot_id' as slot_id,
  COUNT(*) as count
FROM ideas
GROUP BY idea->>'slot_id'
ORDER BY slot_id;
```

Expected result for a 4-post week with 3 footfall + 1 brand:
- A: 1
- B: 2
- C: 1
- D: 0

**OR** for 2 footfall + 2 brand:
- A: 1
- B: 1
- C: 1
- D: 1

4. **Check console logs** for Phase 1 enforcement:
   - Look for: `[Phase 1] Goal-blend mismatch detected — enforcing...`
   - Verify: `[Phase 1] Final composition after enforcement: X footfall, Y brand`
   - No C slots should be missing!

## Prevention

This bug highlights the need for **symmetry in goal-mode reassignment logic**. Any future changes to slot assignment should:
- Use the same counting pattern for all goal modes
- Add unit tests for edge cases (4→3 footfall, 2→3 brand, etc.)
- Log slot_id distribution in Phase 1 output for debugging

## Query to Run

Execute this to get the actual data:
```sql
-- Get post ideas with slot assignments
WITH ideas AS (
  SELECT 
    jsonb_array_elements(post_ideas) as idea
  FROM weekly_strategies
  WHERE id = '2c724599-1a6f-4e46-9d92-f62c8e2fe443'
)
SELECT 
  (idea->>'id')::int as idea_id,
  idea->>'title' as title,
  idea->>'goal_mode' as goal_mode,
  idea->>'content_category' as content_category,
  idea->>'slot_id' as slot_id,
  idea->>'booking_nudge_warranted' as booking_nudge
FROM ideas
ORDER BY (idea->>'id')::int;
```
