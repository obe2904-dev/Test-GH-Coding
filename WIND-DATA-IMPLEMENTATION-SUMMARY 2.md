# Wind Data Implementation Summary
**Date:** 2026-06-09  
**Feature:** Add wind information to Weekly Plan weather display  
**Update:** Shows specific windy days with descriptive wind terms, bundling consecutive days with same conditions

## Problem Statement
The Weekly Plan weather section currently shows temperature, sun, clouds, and rain data, but **wind information is missing** despite its significant impact on outdoor seating decisions for restaurants.

## Discovery
Wind data is **already being collected** by the system:
- ✅ Backend types include `wind_speed?: number` (in m/s) in `DayWeather` interface
- ✅ Weather API fetches wind speed from OpenWeatherMap
- ✅ Wind is used in `outdoorScore()` calculation in weather-interpreter.ts
- ❌ Wind was **not displayed** in the UI weather summary

## Solution Implemented

### 1. Wind Description Function
Added `getWindDescription()` function that converts wind speed (m/s) to descriptive Danish terms based on the Beaufort scale:

| Wind Speed | Description (Danish) | Description (English) |
|------------|---------------------|---------------------|
| < 2 m/s | Stille | Calm |
| 2-4 m/s | Let vind | Light breeze |
| 4-6 m/s | Svag vind | Gentle breeze |
| 6-8 m/s | Jævn vind | Moderate breeze |
| 8-11 m/s | Frisk vind | Fresh breeze |
| 11-14 m/s | Hård vind | Strong breeze |
| 14+ m/s | Stiv kuling | Near gale |

### 2. Updated Weather Summary Display
**File:** `src/components/weekly-plan/WeeklyPlanOverview.tsx`

Shows **all days** with their wind conditions, intelligently bundled:

**Before:**
- "4 dage med blæsevejr (gns. 8 m/s)"
- "mest blæsende lørdag (12 m/s)"

**After (showing all days):**
- Single consistent wind: "vind: mandag-søndag (let vind)"
- Multiple conditions: "vind: mandag-onsdag (svag vind), torsdag (jævn vind), fredag-søndag (frisk vind)"
- Mixed week: "vind: mandag (let vind), tirsdag-fredag (svag vind), lørdag-søndag (frisk vind)"

### 3. Day Bundling Logic
Added intelligent grouping algorithm:
- Shows **ALL days** with wind data (not just windy days >7 m/s)
- Groups **consecutive days** with the **same wind description** into ranges
- Format: "startDay-endDay (windDesc)"
- Single days remain as "day (windDesc)"
- Different wind conditions create separate groups

**Example scenarios:**
```
Input: All week 3-4 m/s (all "let vind")
Output: "vind: mandag-søndag (let vind)"

Input: Mon-Wed 5 m/s (svag vind), Thu 7 m/s (jævn vind), Fri-Sun 9 m/s (frisk vind)
Output: "vind: mandag-onsdag (svag vind), torsdag (jævn vind), fredag-søndag (frisk vind)"

Input: Mon 2 m/s (let vind), Tue-Fri 5 m/s (svag vind), Sat-Sun 9 m/s (frisk vind)
Output: "vind: mandag (let vind), tirsdag-fredag (svag vind), lørdag-søndag (frisk vind)"
```

### 3. Weekend Wind Display
Updated weekend summary to use descriptive terms instead of m/s values:

**Before:**
- "— blæsende (8 m/s påvirker udendørsservering)"

**After:**
- "— frisk vind påvirker udendørsservering"

### 4. Wind Display Logic

#### Week-level wind summary:
- **All days shown** - Every day with wind data is included
- Format: "vind: [grouped days with descriptions]"
- Bundling occurs when consecutive days have identical wind descriptions
- Shows complete wind pattern for the week, not just notable/windy days

#### Weekend-specific wind:
- **Good weekend** (no rain, warm, no wind): "Godt for udetrafik"
- **Warm but windy weekend**: "— [wind description] påvirker udendørsservering"
- Wind description based on average weekend wind speed

### 5. Wind Display Approach

All wind speeds are shown with descriptive terms:

| Wind Speed (m/s) | Description | Display |
|------------------|-------------|----------|
| All speeds | Beaufort-based term | Always shown with day name/range |

No filtering is applied - even light winds (2-4 m/s) are displayed, as they're still relevant for outdoor seating planning.

## Files Modified

### Code Changes
1. **src/components/weekly-plan/WeeklyPlanOverview.tsx**
   - Added `getWindDescription()` function for m/s → descriptive text conversion
   - Updated wind display to show **all days** (not just windy days >7 m/s)
   - Implemented intelligent bundling of consecutive days with same wind descriptions
   - Modified weekend wind display to use descriptive terms

### Translation Files
2. **src/lib/locales/da.json** (Danish)
   - Updated `weekendWindy`: "— {{wind}} påvirker udendørsservering" (takes descriptive term)
   - Changed `windyDays` to `windDays`: "vind: {{days}}" (neutral label for all days)
   - Added wind description terms:
     - `windCalm`: "stille"
     - `windLight`: "let vind"
     - `windGentle`: "svag vind"
     - `windModerate`: "jævn vind"
     - `windFresh`: "frisk vind"
     - `windStrong`: "hård vind"
     - `windGale`: "stiv kuling"

3. **src/lib/locales/en.json** (English)
   - Updated `weekendWindy`: "— {{wind}} affects outdoor seating"
   - Changed `windyDays` to `windDays`: "wind: {{days}}" (neutral label for all days)
   - Added wind description terms:
     - `windCalm`: "calm"
     - `windLight`: "light breeze"
     - `windGentle`: "gentle breeze"
     - `windModerate`: "moderate breeze"
     - `windFresh`: "fresh breeze"
     - `windStrong`: "strong breeze"
     - `windGale`: "near gale"

## Testing Recommendations

1. **UI Testing:**
   - View Weekly Plan with wind data
   - Verify wind information shows specific days with descriptive terms
   - Check that consecutive days with same wind are bundled into ranges
   - Verify weekend summary uses descriptive wind terms

2. **Edge Cases:**
   - Week with no wind data (should handle gracefully with `wind_speed?: number`)
   - Week with consistent wind all week (should show as single range)
   - Week with changing wind conditions each day (should list all days separately)
   - Week with alternating wind conditions (should create multiple groups)

3. **Example Scenarios:**

**Scenario A: Consistent light wind all week**
```
Input: All days 3-4 m/s ("let vind")
Output: "vind: mandag-søndag (let vind)"
```

**Scenario B: Changing conditions through the week**
```
Input: Mon-Wed 5 m/s (svag vind), Thu 7 m/s (jævn vind), Fri-Sun 9 m/s (frisk vind)
Output: "vind: mandag-onsdag (svag vind), torsdag (jævn vind), fredag-søndag (frisk vind)"
```

**Scenario C: Weekend with strong wind**
```
Input: Mon-Fri 4 m/s (let vind), Sat-Sun 12 m/s (hård vind)
Output: "vind: mandag-fredag (let vind), lørdag-søndag (hård vind)"
Weekend: "— hård vind påvirker udendørsservering"
```

**Scenario D: Variable conditions**
```
Input: Each day has different wind speed/description
Output: "vind: mandag (let vind), tirsdag (svag vind), onsdag (jævn vind), torsdag (frisk vind), fredag (jævn vind), lørdag-søndag (frisk vind)"
```

## Business Impact

### For Restaurants with Outdoor Seating:
- ✅ Know which specific days will be windy
- ✅ Understand severity of wind conditions using familiar terms
- ✅ Better planning for outdoor seating setup/teardown
- ✅ Can adjust content strategy day-by-day based on wind

### For Content Strategy:
- Wind + rain = emphasize indoor atmosphere
- Wind + cold = highlight cozy indoor seating
- Low wind + warm = promote outdoor dining
- Specific day knowledge = can plan daily content around conditions

## Backwards Compatibility

✅ **Fully backwards compatible**
- Uses optional `wind_speed?: number` field
- Falls back gracefully when wind data is unavailable
- Existing weekly plans without wind data will work unchanged

## User Experience Improvements

1. **Complete week visibility** - See wind conditions for every day, not just windy ones
2. **Better comprehension** - "frisk vind" is more intuitive than "8 m/s" for most users
3. **Familiar terminology** - Beaufort scale terms are commonly used in Danish weather forecasts
4. **Concise bundling** - Consecutive days with same conditions shown as ranges (e.g., "fredag-søndag") reduces clutter
5. **At-a-glance planning** - Easy to see patterns like "entire week has let vind" or "weekend gets windy"
6. **Actionable for all conditions** - Even "let vind" and "svag vind" matter for outdoor setup decisions

## Completion Status

✅ **COMPLETE** - Wind data is now displayed with:
- **All days** shown with their wind conditions (not filtered by threshold)
- Descriptive Beaufort-based wind terms instead of m/s values
- Intelligent bundling of consecutive days with same wind conditions
- Clear, complete wind pattern overview for the entire week
