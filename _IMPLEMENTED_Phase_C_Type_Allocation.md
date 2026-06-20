# Phase C Implementation: Programme × Type Grid Allocation

**Status**: ✅ ACTIVE (Deployed 2026-01-25)

## Overview

Phase C activates the Programme × Type grid allocation system using 8-week drift tracking (Phase B) to assign content_type (PRODUCT/EXPERIENCE/OCCASION/RETENTION) to each post based on:

1. **Programme goal-mode inheritance** - Post inherits goal from assigned programme
2. **Type-goal eligibility filtering** - Only types valid for that goal are considered
3. **Drift correction** - Corrects deviation from target type mix (35/30/25/10)
4. **Staleness priority** - Boosts types not used recently
5. **Distribution balance** - Ensures degeneracy guard (not 4 identical types)

## Architecture

### Flow
```
Phase 1: Strategic Brief
  ↓ Assigns goal_mode to each angle (drive_footfall, enhance_brand, retain_loyalty)
  
Phase C: Type Allocation ⭐ NEW
  ↓ Maps angles to content_type using TYPE_GOAL_ELIGIBILITY
  ↓ Applies drift + staleness correction
  ↓ Maps content_type → content_category
  
Phase 2a: Content Planner
  ↓ Uses Phase C category overrides (product_menu, craving_visual, behind_scenes, team_people)
  
Phase 2b: Content Detailer
  ↓ Generates final post content
```

### Type-Goal Eligibility Matrix
```
Goal Mode     | Eligible Types
------------- | --------------------------------
footfall      | PRODUCT, OCCASION
brand         | EXPERIENCE, OCCASION  
retention     | EXPERIENCE, RETENTION
```

### Type → Category Mapping
```
Content Type   | Goal Mode | Category Assigned
-------------- | --------- | ------------------
PRODUCT        | any       | product_menu
EXPERIENCE     | brand     | behind_scenes
EXPERIENCE     | retention | craving_visual
OCCASION       | any       | product_menu
RETENTION      | retention | team_people
RETENTION      | other     | behind_scenes
```

## Implementation Details

### Files Modified

**1. contentTypeSystem.ts**
- Added `normalizeGoalMode()` - Maps Phase 1 values to GoalMode enum
- Added `mapTypeToContentCategory()` - Translates 4-types to template categories
- Updated `allocateContentTypes()` - Uses post.goal_mode directly instead of programme lookup

**2. weekly-strategy-generator.ts**
- Inserted Phase C between Phase 1 and Phase 2
- Fetches type analytics (staleness + drift) from Phase B tracking
- Builds programmeGoals map from business_programmes
- Creates angleIdeas with goal_mode from Phase 1
- Calls allocateContentTypes() with drift correction
- Maps resulting types to categories for Phase 2

**3. phase2/index.ts**
- Added `typeAllocations` parameter to `generateContentPlanSplit()`
- Passes Phase C allocations to Phase 2a

**4. phase2/phase2a.ts**
- Added `categoryOverrides` parameter to `generateContentPlan2a()`
- Uses Phase C category when available, falls back to Phase 2a type mapping

## Goal Mode Normalization

Phase 1 uses verbose goal_mode values:
- `drive_footfall` → normalized to `footfall`
- `enhance_brand`, `enhance_brand_awareness`, `build_brand` → `brand`
- `retain_loyalty`, `increase_loyalty`, `build_loyalty` → `retention`

Phase C normalizes these before applying TYPE_GOAL_ELIGIBILITY.

## Allocation Logic

For each post:
1. Get goal_mode from angle (Phase 1 slot assignment)
2. Normalize goal_mode ('drive_footfall' → 'footfall')
3. Filter to eligible types (footfall → [PRODUCT, OCCASION])
4. Score each type:
   - Base priority = 1.0
   - +staleness priority (0-1.0 based on days since last used)
   - ×drift correction (0.0-2.0x based on actual vs target %)
   - +distribution gap (boost if under target, reduce if over)
   - +urgency factor (if remaining posts need this type to hit target)
5. Select highest-scoring type
6. Map type → category using goal_mode context
7. Add type_rationale for debugging

## Example Output

```json
{
  "id": 1,
  "content_type": "EXPERIENCE",
  "content_category": "behind_scenes",
  "goal_mode": "enhance_brand",
  "type_rationale": "EXPERIENCE (goal: brand, target: 30%, current: 0%, priority: 8.50)",
  "title": "Behind the Brunch: Vores æggekoge-teknik"
}
```

## Verification

Test Phase C allocation:
```bash
curl -X POST 'https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/get-weekly-strategy' \
  -H "Content-Type: application/json" \
  -d '{"business_id": "f4679fa9-3120-4a59-9506-d059b010c34a", "week_number": 24, "year": 2026, "regenerate": true}' \
&& sleep 45 \
&& curl -s -X POST 'https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/get-weekly-strategy' \
  -H "Content-Type: application/json" \
  -d '{"business_id": "f4679fa9-3120-4a59-9506-d059b010c34a", "week_number": 24, "year": 2026}' \
  | jq -r '.strategy.post_ideas[] | "\(.content_type) (\(.goal_mode)) → \(.content_category)"'
```

Expected:
- All posts have `content_type` field (PRODUCT, EXPERIENCE, OCCASION, or RETENTION)
- All posts have `type_rationale` field showing priority calculation
- Category mapping follows Type → Category rules above
- Distribution respects TYPE_GOAL_ELIGIBILITY (footfall posts only get PRODUCT/OCCASION)

## Known Behavior

1. **Footfall-heavy weeks**: If Phase 1 assigns all slots to drive_footfall goal_mode, Phase C will only allocate PRODUCT and OCCASION types (both footfall-eligible). This is correct behavior - restaurants naturally have footfall-heavy content.

2. **Goal mode determines type pool**: Brand-goal posts can get EXPERIENCE or OCCASION. Retention-goal posts can get EXPERIENCE or RETENTION. Footfall-goal posts can only get PRODUCT or OCCASION.

3. **Drift correction**: If actual type distribution is far from target (e.g., 60% PRODUCT when target is 35%), Phase C will boost other types' priority scores to correct the drift over subsequent weeks.

## Bundle Size

- Before Phase C: 696.5kB
- After Phase C: 692.1kB (slightly smaller due to code optimization)

## Deployment

```bash
supabase functions deploy get-weekly-strategy --no-verify-jwt
```

## Next Steps

- ✅ Phase A (schema) - Active
- ✅ Phase B (tracking) - Active (logging only)
- ✅ **Phase C (allocation) - ACTIVE** ⭐
- ⏳ Phase D (validation) - Monitor type distribution accuracy over 4-8 weeks
- ⏳ Phase E (tuning) - Adjust target_type_mix based on business performance

---
**Implementation Date**: January 25, 2026  
**Bundle Size**: 692.1kB  
**Status**: Production-ready, Phase C fully activated
