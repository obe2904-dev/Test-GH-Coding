# Program-Based Posting Time Implementation

**Date**: 27. maj 2026  
**Function**: `get-quick-suggestions`  
**Status**: 🚧 In Progress - Debugging Program Extraction

## Purpose

Implement accurate posting time suggestions based on actual menu service programs (Brunch, Lunch, Dinner) instead of generic keyword heuristics. This ensures the UI shows realistic posting times that align with service hours.

### Example Issue
- **Before**: Brunch suggestion shows posting time at 09:00 (opening time)
- **After**: Brunch suggestion shows posting time at 10:00-12:00 (mid-service, when customers are actively ordering)

## Architecture Changes

### 1. Program Data Extraction
**Source**: `menu_results_v2.structured_data.menuPeriods`

Programs are now extracted from the structured menu data:
```typescript
const menuPeriods = r.structured_data?.menuPeriods
if (Array.isArray(menuPeriods)) {
  for (const period of menuPeriods) {
    const type = period.type?.toLowerCase()
    if ((type === 'brunch' || type === 'lunch' || type === 'dinner') && 
        period.name && period.startTime && period.endTime) {
      programsFromMenu.push({
        name: period.name,
        start: period.startTime,
        end: period.endTime
      })
    }
  }
}
```

**Example Data (Cafe Faust)**:
- BRUNCH: 09:30-14:00
- FROKOST: 09:00-17:30  
- AFTEN: 17:30-21:30
- MENUKORT: 16:00-23:00

### 2. Program Matching Logic

The `getContentAwareTime()` function now matches content to specific programs:

#### Brunch Posts
- **Matching**: Keywords like "brunch", "æg", "croissant", "pandekage"
- **Timing**: Post 1-2 hours into service (mid-brunch peak)
- **Formula**: `startTime + max(60min, 40% of service duration)`

#### Lunch Posts  
- **Matching**: Keywords like "frokost", "sandwich", "smørrebrød", "salat"
- **Timing**: Post 2 hours before service ends (lunch planning window)
- **Formula**: `endTime - 120min (but not before 30min into service)`

#### Dinner Posts
- **Matching**: Keywords like "aftensmad", "bøf", "3-retters", "pasta"
- **Timing**: Post 30 minutes before service starts (dinner planning)
- **Formula**: `startTime - 30min`

### 3. Parameter Threading

Programs array is threaded through the call chain:
```
main() 
  → extractProgramsFromMenu (lines 1082-1112)
  → persistAndAssemble(..., programsFromMenu)
  → getContentAwareTime(..., programs)
```

## Current Status

### ✅ Completed
1. Updated `getContentAwareTime()` function signature to accept programs parameter
2. Implemented program matching logic (brunch/lunch/dinner)
3. Added optimal time calculation formulas
4. Updated `persistAndAssemble()` function signature to accept and pass programs
5. Modified program extraction to use `menuPeriods` instead of non-existent `programs` field
6. Added debug logging to track program extraction and matching

### 🚧 In Progress
1. **Program extraction showing 0 programs** - Debug logs show:
   - `🔍 Checking 5 menu results for programs...`
   - But no programs being added
   - Need to verify `menuPeriods` filtering logic

### 🔴 Issues Encountered

#### Issue #1: Wrong Data Structure (RESOLVED)
- **Problem**: Code was looking for `structured_data.programs` 
- **Reality**: Data is in `structured_data.menuPeriods`
- **Fix**: Updated extraction to use `menuPeriods` array

#### Issue #2: Programs Not Being Extracted (ACTIVE)
- **Problem**: Debug logs show menu results found but no programs extracted
- **Logs**: 
  ```
  🔍 Checking 5 menu results for programs...
  Menu 772286e1: X periods
  (no "✅ Added" logs appearing)
  ```
- **Hypothesis**: Type filtering (`type === 'brunch'`) may be too strict
- **Next Step**: Check actual `type` values in menuPeriods data

#### Issue #3: Fallback Time Always Used
- **Problem**: All suggestions showing `10:00:00` (fallback time)
- **Cause**: Programs array is empty, so program matching never succeeds
- **Impact**: UI not showing program-aware times yet

## Testing

### Test Business: Cafe Faust
- **Business ID**: `f4679fa9-3120-4a59-9506-d059b010c34a`
- **Tier**: Paid
- **Menu Results**: 5 menus (brunch, lunch, dinner variants)

### Test Commands
```bash
# Trigger regeneration and check suggested_time
deno run --allow-net --allow-env --allow-read _trigger_regenerate.mjs

# Check program data structure
deno run --allow-net --allow-env --allow-read _check_programs_data.mjs

# View Edge Function logs
deno run --allow-net --allow-env --allow-read _fetch_logs.mjs
```

### Expected Results
- **Brunch post (Æggekage)**: `10:30:00` or `11:00:00`
- **Lunch post (Smørrebrød)**: `15:30:00` (2h before 17:30 close)
- **Dinner post (Bøf)**: `17:00:00` (30min before 17:30 service)

### Actual Results (Current)
- All posts: `10:00:00` (fallback keyword heuristic)

## Data Verification

### menuPeriods Structure (from database)
```json
{
  "name": "BRUNCH",
  "type": "brunch",
  "items": ["THE ONE", "THE FAVORIT", ...],
  "endTime": "14:00",
  "startTime": "09:30"
}
```

### Extraction Filtering
Current filter requires:
1. `period.type` matches `'brunch'|'lunch'|'dinner'`
2. `period.name` exists
3. `period.startTime` exists  
4. `period.endTime` exists

**Potential Issue**: Categories like "KLASSIKERE", "SALATER", etc. have `type: "other"` or `type: "late_night"` and are correctly filtered out, but we need to verify the service-level periods are being captured.

## AI Prompt Integration

### DagensPromptContext (Already Implemented ✅)
The AI prompt builder already receives program context:
```typescript
currentProgram?: {
  name: string;
  start: string;
  end: string;
  hoursUntilClose: number;
}
allPrograms?: Array<{name, start, end}>
```

### AI Receives (Example)
```
Aktivt program: Frokost (09:00-17:30) — 4.5h tilbage

⚠️ Mindre end 2 timer tilbage i programmet - vurder om retten når at tiltrække gæster
```

**Status**: ✅ Working - AI uses this for reasoning about timing appropriateness

## Next Steps

### Immediate (Debug)
1. Add more granular logging to program extraction loop
2. Log each `menuPeriods` item with its type value
3. Verify filter conditions match actual data structure
4. Check if service-level periods exist vs category-level periods

### After Debug Resolution
1. Remove debug logging (clean up console.logs)
2. Run full test suite with 10+ regenerations
3. Verify suggested_time varies by content type
4. Document actual time ranges achieved

### Future Enhancements
1. **Program Priority**: If multiple programs match, choose the one closest to current time
2. **Cross-Program Items**: Handle items available in multiple programs (e.g., coffee during all service periods)
3. **Special Programs**: Handle bar/drinks programs that run 16:00-23:00
4. **Time-of-Day Awareness**: Adjust suggestions based on current time (don't suggest brunch at 15:00)

## Related Files

### Modified
- `supabase/functions/get-quick-suggestions/index.ts` (lines 94-172, 349-363, 415-420, 1082-1112, 2400-2410)
- `supabase/functions/_shared/dagens-forslag-prompt-builder.ts` (already updated, deployed ✅)

### Testing Scripts
- `_trigger_regenerate.mjs` - Trigger single regeneration
- `_check_programs_data.mjs` - Inspect menuPeriods structure  
- `_fetch_logs.mjs` - Retrieve Edge Function logs

### Database
- Source: `menu_results_v2.structured_data.menuPeriods`
- Output: `daily_suggestions.suggested_time`

## Cost & Quota Impact

**No change** - This update only affects the `suggested_time` field calculation (backend logic). No additional API calls, no model changes.

## Deployment Status

### Backend
- **Deployed**: Yes (latest deployment includes debug logging)
- **Version**: Lines 1082-1112 use menuPeriods extraction
- **Status**: Functional but programs array coming back empty

### Frontend
- **No changes required** - UI already displays `suggested_time` field

## Success Criteria

### Phase 1: Debug Complete ✅
- [ ] Programs successfully extracted from menuPeriods
- [ ] Debug logs show "✅ Added: BRUNCH (09:30-14:00)"
- [ ] Programs array populated with 3-4 service periods

### Phase 2: Matching Works ✅
- [ ] Brunch posts show 10:00-12:00 posting time
- [ ] Lunch posts show ~2h before service end
- [ ] Dinner posts show ~30min before service start
- [ ] Debug logs show "✅ Matched BRUNCH program"

### Phase 3: Production Ready ✅
- [ ] Remove debug logging
- [ ] Test with 20+ regenerations across different times of day
- [ ] Verify no regression in suggestion quality
- [ ] Document final time ranges in user-facing docs
