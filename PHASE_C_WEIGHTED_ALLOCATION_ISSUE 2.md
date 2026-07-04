# Phase C Weighted Allocation Issue

## Context
Implementing Phase C to use **full goal_split percentages** for weighted type allocation instead of just dominant mode.

**Business**: Café Faust (`f4679fa9-3120-4a59-9506-d059b010c34a`)

**Goal Splits from Brand Profile** (verified in database):
- **AFTEN** (dinner): 50% footfall, 30% brand, 20% retention  
- **FROKOST** (lunch): 60% footfall, 20% brand, 20% retention  
- **Brunch** (morning): 60% footfall, 25% brand, 15% retention

## What's Implemented

### ✅ Phase C Infrastructure Created
- **File**: `supabase/functions/_shared/contentTypeSystem.ts`
- **Function**: `getEligibleTypesForProgramme(goalSplit)` (lines 70-100)
  - Takes full goal_split object (e.g., `{drive_footfall: 60, strengthen_brand: 20, retain_regulars: 20}`)
  - Calculates weight for each type based on which goals apply
  - Returns `{type, weight}[]` array
  - Example: PRODUCT gets 0.6 weight from 60% footfall, OCCASION gets 0.6 from footfall + 0.2 from brand = 0.8 total

### ✅ Database Field Names Corrected
- Fixed to match actual schema: `strengthen_brand`, `retain_regulars` (NOT `build_brand`/`retain_loyalty`)
- Goal splits stored as 0-100 values in DB (not 0-1 decimals)

### ✅ Integration Working
- Phase C runs between Phase 1 and Phase 2
- All 4 types (PRODUCT, EXPERIENCE, OCCASION, RETENTION) can be allocated

## The Problem

### ❌ Weighted Allocation NOT Activating

**Expected Behavior**:
```
type_rationale: "PRODUCT (lunch: 60% footfall, 20% brand, 20% retention, target: 35%, current: 0%, priority: 12.45)"
```

**Actual Behavior**:
```
type_rationale: "PRODUCT (goal: footfall, target: 35%, current: 0%, priority: 9.25)"
```

The system is falling back to simple dominant-mode logic instead of using weighted allocation.

## Root Cause Analysis

### Hypothesis: `programmeGoalSplits` Map Not Being Populated

**File**: `supabase/functions/_shared/post-helpers/weekly-strategy-generator.ts` (lines 88-110)

```typescript
const programmeGoalSplits: Record<string, any> = {};
const businessProgrammes = (context as any).business_programmes || [];
businessProgrammes.forEach((prog: any) => {
  if (prog.programme_type && prog.baseline_goal_split) {
    programmeGoalSplits[prog.programme_type] = prog.baseline_goal_split;
    if (prog.programme_name) {
      programmeGoalSplits[prog.programme_name] = prog.baseline_goal_split;
    }
  }
});
```

**Possible Issues**:
1. `context.business_programmes` might be undefined/empty
2. `baseline_goal_split` might not be included in the query that builds context
3. Programme type mapping might be incorrect

### Programme Type Mapping

**Database** → **Phase C Code**:
- `dinner` → `dinner` ✓
- `lunch` → `lunch` ✓  
- `morning` → `morning` ✓

**Phase 1 Output** → **Phase C Mapping** (lines 127-138):
- "promoted_moment" contains text like "frokost fredag-søndag"
- Code maps: `includes('frokost')` → `'lunch'`
- Code maps: `includes('aften')` → `'dinner'`  
- Code maps: `includes('brunch')` → `'morning'`

## Debugging Steps for Next Session

### 1. Check if `business_programmes` Exists in Context

**Add temporary debug output** in `weekly-strategy-generator.ts` around line 89:
```typescript
console.log('[DEBUG] business_programmes count:', businessProgrammes.length);
console.log('[DEBUG] business_programmes data:', JSON.stringify(businessProgrammes.map(p => ({
  type: p.programme_type,
  name: p.programme_name,
  has_split: !!p.baseline_goal_split
}))));
```

### 2. Check Context Building Query

**File to inspect**: Look for where `StrategyContext` is built (likely in `get-weekly-strategy/index.ts`)

**Check if query includes**:
```sql
SELECT 
  bpp.programme_type,
  bpp.programme_name,
  bpp.baseline_goal_split  -- THIS MUST BE INCLUDED
FROM business_programme_profiles bpp
WHERE bpp.business_id = $1
```

### 3. Verify Programme Matching

**Add debug in `allocateContentTypes()`** (contentTypeSystem.ts line 245):
```typescript
const goalSplit = programmeGoalSplits[programmeType];
console.log(`[DEBUG] Looking for programme "${programmeType}", found: ${!!goalSplit}, available keys: ${Object.keys(programmeGoalSplits).join(', ')}`);
```

## Test Command

```bash
curl -s -X POST "https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/get-weekly-strategy" \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "f4679fa9-3120-4a59-9506-d059b010c34a",
    "week_number": 24,
    "year": 2026,
    "force_regenerate": true
  }' | jq -r '.strategy.post_ideas[0] | {type: .content_type, rationale: .type_rationale}'
```

## Expected Fix

Once `programmeGoalSplits` is properly populated with the full goal_split objects, the allocation should use the weighted scoring in lines 280-310 of `contentTypeSystem.ts`, which multiplies base score by `(1 + programmeWeight)` to boost types that align with the programme's goals.

## Files Modified in This Session

1. `supabase/functions/_shared/contentTypeSystem.ts`
   - Added `getEligibleTypesForProgramme()` function
   - Modified `allocateContentTypes()` to use weighted scoring
   - Fixed goal_split field names

2. `supabase/functions/_shared/post-helpers/weekly-strategy-generator.ts`
   - Added Phase C orchestration between Phase 1 and Phase 2
   - Built `programmeGoalSplits` map from business_programmes
   - Added programme type mapping logic

3. `supabase/functions/_shared/post-helpers/strategy/phase2/index.ts`
   - Added `typeAllocations` parameter

4. `supabase/functions/_shared/post-helpers/strategy/phase2/phase2a.ts`
   - Added Phase C override logic

## Database Verification

Programme data confirmed in database:
```bash
deno run --allow-net --allow-env --allow-read _temp_check_programmes.mjs
# Output:
# dinner (AFTEN): {"drive_footfall":50,"retain_regulars":20,"strengthen_brand":30}
# lunch (FROKOST): {"drive_footfall":60,"retain_regulars":20,"strengthen_brand":20}
# morning (Brunch): {"drive_footfall":60,"retain_regulars":15,"strengthen_brand":25}
```

Data is in database with correct field names ✓
