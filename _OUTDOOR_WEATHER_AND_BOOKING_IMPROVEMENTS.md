# Outdoor Weather & Booking CTA Improvements
**Date**: 2026-07-11  
**Status**: ✅ Implemented

## Overview
Enhanced the AI suggestions system to actively promote outdoor seating when weather is good AND intelligently assign booking CTAs based on timing and context.

---

## 1. Outdoor Seating Strategic Angle Promotion

### Problem
The system was **passive** about outdoor seating:
- ✅ Already checked weather + outdoor seating availability
- ✅ Passed weather info to AI prompt
- ⚠️ BUT: Only mentioned as context, didn't actively encourage outdoor-focused suggestions
- ⚠️ Only strong encouragement in Slot B when weather was "PERFEKT"

### Solution
When `has_outdoor_seating = TRUE` AND weather is good (contains "Perfekt" or "GODT VEJR"):
- **Added strategic directive to AI prompt** telling it to prioritize at least ONE outdoor-focused suggestion
- Uses concrete outdoor terms: "terrassen", "udenfor", "i solen", "frisk luft"
- Makes outdoor seating a **central angle**, not just a side note

### Files Changed
**`supabase/functions/_shared/dagens-forslag-prompt-builder.ts`**

**Location 1** (Line ~493 - Shared context for all 3 slots):
```typescript
Udeservering: ${ctx.outdoorNote}${ctx.outdoorProhibitionBlock}${
  ctx.outdoorNote?.includes('Perfekt') || ctx.outdoorNote?.includes('GODT VEJR') 
    ? '\n🌤️ STRATEGISK ANBEFALING: Med perfekt udevejr SOM VI HAR I DAG skal mindst ÉT af de tre forslag fremhæve udeservering som central vinkel. Brug konkrete udtryk: "terrassen", "udenfor", "i solen", "frisk luft" — gør vejret til en del af forslaget, ikke bare en sidenote.' 
    : ''
}
```

**Location 2** (Line ~512 - Free tier context):
```typescript
Udeservering: ${ctx.outdoorNote}${ctx.outdoorProhibitionBlock}${
  ctx.outdoorNote?.includes('Perfekt') || ctx.outdoorNote?.includes('GODT VEJR') 
    ? '\n🌤️ STRATEGISK ANBEFALING: Med perfekt udevejr SOM VI HAR I DAG skal mindst ÉT af de tre forslag fremhæve udeservering som central vinkel. Brug konkrete udtryk: "terrassen", "udenfor", "i solen", "frisk luft".' 
    : ''
}
```

### Expected Behavior
**BEFORE:**
- Weather: "22°C, sunny" + outdoor seating → AI mentions it passively
- Suggestions: 3 generic menu items with possible weather mention in text

**AFTER:**
- Weather: "22°C, sunny" + outdoor seating → Strategic directive activated
- Suggestions: At least 1 suggestion features outdoor dining as PRIMARY angle
- Example: "Pasta på terrassen i solen" instead of "Pasta med trøffel"

---

## 2. Intelligent Booking CTA Assignment

### Problem
The system used **simplistic CTA logic**:
```typescript
cta_intent: s.slot === 'guest_moment' ? 'social' 
          : s.slot === 'brand_behind' ? 'engagement' 
          : 'visit'  // Default for all offering slots
```

**Issues:**
- Didn't consider time of day (dinner = prime booking time)
- Didn't use weather + outdoor combo as booking opportunity
- Didn't check if business has `booking_url`
- Always defaulted to generic 'visit' CTA

### Solution
**New intelligent CTA determination** based on:
1. **Dinner hours** (17:00-21:00) → `booking`
2. **Weekend brunch** (Sat/Sun 10:00-14:00) → `booking`
3. **Perfect outdoor weather + outdoor seating** (11:00-20:00) → `booking`
4. **No booking URL available** → `visit` (fallback)

### Files Changed

**`supabase/functions/get-quick-suggestions/suggestion-persister.ts`**

**New Function** (Lines 42-110):
```typescript
/**
 * Determine intelligent CTA intent based on time, weather, and booking capability
 * Prioritizes booking for prime dining times and good outdoor weather
 */
function determineCtaIntent(
  slot: string | undefined,
  suggestedTime: string,
  weatherForecast: string | null,
  bookingUrl: string | null,
  hasOutdoorSeating: boolean
): string {
  // Non-offering slots use fixed intents
  if (slot === 'guest_moment') return 'social'
  if (slot === 'brand_behind') return 'engagement'
  
  // No booking URL = can't use booking intent
  if (!bookingUrl) return 'visit'
  
  // Parse suggested time
  const [hours] = suggestedTime.split(':').map(Number)
  
  // Check for good outdoor weather
  let hasGoodOutdoorWeather = false
  if (hasOutdoorSeating && weatherForecast) {
    try {
      const weather = JSON.parse(weatherForecast)
      hasGoodOutdoorWeather = !!(weather.outdoor && 
        (weather.outdoor.includes('Perfekt') || weather.outdoor.includes('Bedst')))
    } catch {
      // Invalid JSON, ignore
    }
  }
  
  // BOOKING TRIGGERS:
  // 1. Dinner hours (17:00-21:00) - prime reservation time
  if (hours >= 17 && hours <= 21) {
    return 'booking'
  }
  
  // 2. Weekend brunch (Saturday/Sunday 10:00-14:00)
  const now = new Date()
  const isWeekend = now.getDay() === 0 || now.getDay() === 6
  if (isWeekend && hours >= 10 && hours <= 14) {
    return 'booking'
  }
  
  // 3. Perfect outdoor weather + outdoor seating = booking opportunity
  if (hasGoodOutdoorWeather && hours >= 11 && hours <= 20) {
    return 'booking'
  }
  
  // Default to casual visit for other times
  return 'visit'
}
```

**Updated Function Signature** (Line ~150):
```typescript
export async function persistAndAssemble(
  // ... existing parameters ...
  bookingUrl?: string | null,           // NEW
  hasOutdoorSeating?: boolean           // NEW
): Promise<any[]>
```

**Usage in Row Building** (Line ~300):
```typescript
cta_intent: determineCtaIntent(
  s.slot, 
  row.suggested_time, 
  weatherForecast, 
  bookingUrl ?? null, 
  hasOutdoorSeating ?? false
),
```

**`supabase/functions/get-quick-suggestions/index.ts`**

**Extract Booking URL** (Line ~1930):
```typescript
const bookingUrl = businessProfile?.booking_url ?? null

console.log(`✅ V5 data loaded: ${v5Programmes?.length || 0} programmes, ops=${!!businessOps}, bookingUrl=${!!bookingUrl}`)
```

**Pass to persistAndAssemble** (Line ~4035):
```typescript
const finalSuggestions = await persistAndAssemble(
  suggestions, effectiveSlotCount, supabase, businessId, today, weatherForecast,
  menuDescriptionMap, slotExpectedContentTypes, todayOpenTime, todayCloseTime, kitchenCloseTime,
  regenerate, plannerRationale, programsFromMenu, clientNow, timeline.slots,
  rotationQueue, currentServicePeriod, weatherInfo,
  bookingUrl, hasOutdoorSeating  // NEW: CTA intelligence parameters
)
```

### Expected Behavior

**BEFORE:**
```json
{
  "title": "Ribeye steak til aftensmad",
  "suggested_time": "18:00",
  "cta_intent": "visit"  // Generic
}
```

**AFTER:**
```json
{
  "title": "Ribeye steak til aftensmad",
  "suggested_time": "18:00",
  "cta_intent": "booking"  // Intelligent - dinner time + booking URL available
}
```

**Booking CTA Examples:**
- 18:30 dinner post + booking URL → `"booking"` → "Book dit bord nu"
- 11:00 brunch on Saturday + booking URL → `"booking"` → "Reservér weekend brunch"
- 14:00 lunch + perfect outdoor weather + outdoor seating + booking URL → `"booking"` → "Sikr dig et bord på terrassen"
- 12:00 lunch + no booking URL → `"visit"` → "Kom forbi i dag"

---

## Testing Checklist

### Outdoor Angle Promotion
- [ ] Business with `has_outdoor_seating = true`
- [ ] Weather forecast returns "Perfekt til udeservering" or "GODT VEJR"
- [ ] Generate suggestions (`/dashboard/create?mode=ai`)
- [ ] Verify at least ONE suggestion mentions outdoor/terrassen/udenfor explicitly in title/rationale

### Booking CTA
- [ ] Business with `booking_url` configured
- [ ] Generate suggestion for 18:00 (dinner time)
- [ ] Verify `cta_intent = "booking"` in database
- [ ] Verify final text includes booking CTA ("Book dit bord", "Reservér", etc.)

### Edge Cases
- [ ] No outdoor seating + good weather → No outdoor directive (correct)
- [ ] Outdoor seating + bad weather → Outdoor PROHIBITION active (correct)
- [ ] No booking URL → cta_intent = "visit" even at dinner time (correct)
- [ ] Non-offering slots → cta_intent = "social"/"engagement" (unchanged)

---

## Database Schema
No changes required. Uses existing columns:
- `business_operations.has_outdoor_seating`
- `business_profile.booking_url`
- `daily_suggestions.cta_intent`

---

## Rollback
If issues arise, revert these files:
1. `supabase/functions/_shared/dagens-forslag-prompt-builder.ts`
2. `supabase/functions/get-quick-suggestions/suggestion-persister.ts`
3. `supabase/functions/get-quick-suggestions/index.ts`

Git commit hash: [Will be added after commit]

---

## Related Documentation
- Weather comfort tiers: `supabase/functions/_shared/post-helpers/strategy/weather-comfort-tiers.ts`
- CTA selection: `supabase/functions/generate-text-from-idea/select-cta.ts`
- Content planning: `CONTENT-PAGES-DATA-FLOW.md`
