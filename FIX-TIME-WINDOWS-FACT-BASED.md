# Fix: Time Windows Now Based on Facts (Not Hardcoded)

**Date:** May 22, 2026  
**Status:** ✅ Implemented  
**Issue:** `business_programme_profiles.time_windows` was using hardcoded values instead of actual extracted data

---

## Problem Statement

The system was using **hardcoded time windows** from `PROGRAMME_TIME_WINDOWS` constant instead of the **actual time windows** extracted from menus in `menu_results_v2.structured_data.availabilityTime`.

### Example of the Issue:

**Actual Menu Data (IGNORED):**
```json
{
  "menuTitle": "AFTEN",
  "availabilityTime": "17.30-21.30",  // ← REAL DATA FROM MENU
  "categories": [...]
}
```

**What Was Saved (HARDCODED):**
```sql
time_windows = ["17:00-22:00"]  -- ← HARDCODED, IGNORING ACTUAL "17.30-21.30"
```

---

## Root Cause

The system had **TWO detection methods**:

1. **V1 Detection** (Old, Hardcoded)
   - Used `PROGRAMME_TIME_WINDOWS` constant
   - Ignored `availabilityTime` from menu extractions
   - Was the DEFAULT behavior

2. **V2 Detection** (New, Fact-Based)
   - Reads `menu_results_v2.structured_data.availabilityTime`
   - Uses actual extracted time windows
   - Was behind a feature flag `USE_DETECTION_V2=true`

**The problem:** V2 existed but was NOT enabled by default.

---

## Solution Implemented

### 1. Made V2 Detection the Default

**File:** `supabase/functions/brand-profile-generator-v5/index.ts`

**Before:**
```typescript
const USE_DETECTION_V2 = Deno.env.get('USE_DETECTION_V2') === 'true'

if (USE_DETECTION_V2) {
  // Use V2 (fact-based)
} else {
  // Use V1 (hardcoded) ← DEFAULT
}
```

**After:**
```typescript
const USE_DETECTION_V1_OVERRIDE = Deno.env.get('USE_DETECTION_V1_OVERRIDE') === 'true'

if (USE_DETECTION_V1_OVERRIDE) {
  // Use V1 (hardcoded) ← NOW OPT-IN
} else {
  // Use V2 (fact-based) ← NOW DEFAULT
}
```

### 2. Added Logging for Transparency

**File:** `supabase/functions/_shared/brand-profile/programme-detection-v2.ts`

Now logs when actual vs hardcoded time windows are used:

```typescript
if (!timeWindow) {
  console.log(`⚠️ No availabilityTime found for ${programmeName}, using hardcoded defaults`)
  timeWindowSource = 'hardcoded'
} else {
  console.log(`✅ Using extracted time window for ${programmeName}: ${data.availabilityTime}`)
  timeWindowSource = 'extracted'
}
```

### 3. Updated Evidence Tracking

Menu evidence now indicates the source:

```typescript
if (data.availabilityTime) {
  menuEvidence.push(`Time: ${data.availabilityTime} (extracted from menu)`)
} else {
  menuEvidence.push(`Time: ${timeWindow.start}-${timeWindow.end} (hardcoded fallback)`)
}
```

---

## How It Works Now

### Priority Order:

1. **Extract from Menu** (Highest Priority)
   - Source: `menu_results_v2.structured_data.availabilityTime`
   - Example: `"17.30-21.30"` → saves as `["17:30-21:30"]`
   - Logged as: `✅ Using extracted time window`

2. **Infer from Opening Hours** (Bar/Cocktails Only)
   - Source: Actual opening/closing times from `opening_hours` table
   - Logic: Cocktails available from mid-afternoon (16:00) to closing
   - Example: Opens 09:00, closes 22:00 → Cocktails `["16:00-22:00"]`
   - Covers: Afternoon terrace drinks, dinner drinks, late-night bar
   - Logged as: `⚠️ No availabilityTime found, inferring from opening hours`

3. **Fallback to Hardcoded** (Only if no extraction & no opening hours)
   - Source: `PROGRAMME_TIME_WINDOWS[programmeType]`
   - Example: `dinner` → `["17:00-22:00"]`
   - Logged as: `⚠️ No availabilityTime found, using hardcoded defaults`

### Data Flow:

```
menu_results_v2.structured_data.availabilityTime
  ↓
detectProgrammesV2() → parseTimeWindow()
  ↓
programme.timeWindow {start: "17:30", end: "21:30"}
  ↓
business_programme_profiles.time_windows = ["17:30-21:30"]
```

---

## Verification

### Check if V2 is Being Used:

Look for this log in Edge Function output:
```
🆕 Using Detection V2 (extraction-based with actual time windows)
```

### Check if Actual Time Windows Are Used:

Look for this log:
```
✅ Using extracted time window for AFTEN: 17.30-21.30
```

### Check Database:

```sql
SELECT 
  business_id,
  programme_name,
  time_windows,
  menu_evidence
FROM business_programme_profiles
WHERE business_id = 'your-business-id'
```

Look for evidence like:
```
menu_evidence = [
  "Extracted from https://...",
  "Time: 17.30-21.30 (extracted from menu)",  ← FACT-BASED
  "Title: AFTEN"
]
```

vs

```
menu_evidence = [
  "...",
  "Time: 17:00-22:00 (hardcoded fallback)",  ← FALLBACK
]
```

---

## Migration Path

### For Existing Data:

To update existing businesses with fact-based time windows:

```sql
-- Regenerate brand profiles with V2 detection
-- Call brand-profile-generator-v5 with forceRegenerate=true
```

Or use the Edge Function:
```typescript
await fetch('https://.../brand-profile-generator-v5', {
  method: 'POST',
  body: JSON.stringify({
    businessId: 'your-business-id',
    forceRegenerate: true
  })
})
```

### Override to V1 (Emergency Only):

If V2 detection causes issues:
```bash
supabase secrets set USE_DETECTION_V1_OVERRIDE=true
```

---

## Files Changed

1. **`supabase/functions/brand-profile-generator-v5/index.ts`**
   - Changed default from V1 to V2
   - Inverted feature flag logic

2. **`supabase/functions/_shared/brand-profile/programme-detection-v2.ts`**
   - Added logging for time window source
   - Enhanced evidence tracking

---

## Special Case: Cocktails/Bar Programmes

When a cocktail/bar menu has **no stated time** (common scenario), the system uses **intelligent inference** instead of blind hardcoding:

### Old Approach (Wrong):
```typescript
// Hardcoded: 22:00-02:00 (assumes late-night bar only)
time_windows = ["22:00-02:00"]  // ❌ Ignores reality
```

**Problems:**
- Assumes cocktails only served late at night (22:00+)
- Ignores afternoon terrace drinks (16:00)
- Ignores dinner drinks (18:00-22:00)
- Often shows impossible times (closes at 22:00 but says "22:00-02:00")

### New Approach (Smart):
```typescript
// Infers from actual opening hours
if (closes_at_22:00) {
  time_windows = ["16:00-22:00"]  // ✅ Afternoon to close
}

if (closes_at_02:00) {
  time_windows = ["18:00-02:00"]  // ✅ Evening to late-night
}
```

**Benefits:**
- ✅ Covers **afternoon drinks** (16:00 summer terrace)
- ✅ Covers **dinner drinks** (18:00-22:00 with food)
- ✅ Covers **late-night bar** (22:00+ if open)
- ✅ Uses **actual closing time** (facts, not assumptions)

### Example: Café Faust

**Actual Data:**
- Cocktail menu: No `availabilityTime` stated
- Opening hours: Closes at 22:00

**Old System:**
```
time_windows = ["22:00-02:00"]  ❌ Impossible (closes at 22:00!)
```

**New System:**
```
time_windows = ["16:00-22:00"]  ✅ Realistic (afternoon to close)
menu_evidence = "Time: 16:00-22:00 (inferred from closing hours)"
```

This covers:
- ☀️ Summer afternoon drinks on the terrace (16:00-18:00)
- 🍽️ Cocktails with dinner (18:00-22:00)
- 🌙 Late evening drinks before closing (20:00-22:00)

---

## Impact

### Before Fix:
- ❌ All time windows were hardcoded (e.g., always "17:00-22:00" for dinner)
- ❌ Ignored actual menu data (e.g., "17.30-21.30")
- ❌ Inconsistent with what users saw in frontend

### After Fix:
- ✅ Time windows based on actual menu extractions
- ✅ Falls back to hardcoded only when no data available
- ✅ Consistent with frontend display
- ✅ Transparent logging shows data source

---

## Related Documentation

- **Architecture Issue:** [LAYER-1-ARCHITECTURE-FLAW.md](LAYER-1-ARCHITECTURE-FLAW.md)
- **V2 Implementation:** [LAYER-1-REFACTOR-IMPLEMENTATION-PLAN.md](LAYER-1-REFACTOR-IMPLEMENTATION-PLAN.md)
- **V2 Results:** [V2-IMPLEMENTATION-RESULTS.md](V2-IMPLEMENTATION-RESULTS.md)

---

## Summary

**Time windows are now FACT-BASED by default** 🎉

The system now:
1. Reads actual time windows from menu extractions
2. Only uses hardcoded defaults when no menu data exists
3. Logs which source was used for transparency
4. Provides clear evidence in the database

This fixes the "disassemble-then-guess" anti-pattern identified in the architecture review.
