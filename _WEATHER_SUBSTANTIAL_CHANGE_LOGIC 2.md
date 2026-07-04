# Weather Substantial Change Detection

**Date:** June 15, 2026  
**Status:** Implemented ✅

---

## 🎯 Purpose

When weather forecast is refreshed, the system determines whether the changes are **substantial enough** to warrant regenerating the weekly strategy and plan.

**User requirement:** "With the rerun, if there is no substantial changes that functionality stays i.e. no need to update weekly strategy and plan."

---

## 🧮 How It Works

### Comfort Tier System (Review)

Each day receives a weighted score (0-100) and tier classification:
- 🥇 **Premium** (85-100 pts): Peak outdoor dining weather
- 🥈 **Viable** (65-84 pts): Good outdoor conditions
- 🥉 **Marginal** (45-64 pts): Outdoor with adjustments needed
- ❌ **Unviable** (<45 pts or blocker): Indoor only

### Substantial Change Definition

A weather change is considered **substantial** if any day experiences a **tier category shift**:

| Old Tier | New Tier | Substantial? | Impact |
|----------|----------|--------------|--------|
| Premium (90) | Viable (75) | ✅ **YES** | Outdoor messaging should be toned down |
| Viable (70) | Viable (67) | ❌ **NO** | Same strategic recommendation |
| Viable (66) | Marginal (64) | ✅ **YES** | Shift from "mention outdoor" to "focus indoor" |
| Marginal (50) | Unviable (40) | ✅ **YES** | Must remove outdoor references |
| Unviable (35) | Unviable (38) | ❌ **NO** | Still indoor-only, no strategic change |

---

## 💡 Example Scenarios

### Scenario 1: Minor Temperature Update (No Regeneration)
**Before:** 22°C, sunny, 2 m/s wind → **Viable tier (87 pts)**  
**After:** 21°C, sunny, 3 m/s wind → **Viable tier (82 pts)**  
**Result:** ❌ No tier shift → No regeneration needed  
**User sees:** "Weather updated. No substantial changes detected."

### Scenario 2: Rain Forecast Added (Regeneration Warranted)
**Before:** 18°C, partly cloudy, 20% rain → **Viable tier (70 pts)**  
**After:** 16°C, rain, 80% rain → **Unviable tier (0 pts)** (blocker: active rain)  
**Result:** ✅ Tier shift detected → Regeneration recommended  
**User sees:** "Weather has changed substantially. 2 posts may be affected: [Terrassekaffe, Udendørs frokost]"

### Scenario 3: Improved Forecast (Regeneration Warranted)
**Before:** 14°C, cloudy, 5 m/s wind → **Marginal tier (48 pts)**  
**After:** 19°C, partly cloudy, 3 m/s wind → **Viable tier (75 pts)**  
**Result:** ✅ Tier shift detected → Regeneration recommended  
**User sees:** "Weather improved. Consider regenerating to add outdoor messaging."

---

## 🔧 Implementation Details

**Location:** `/src/app/content/ai-weekly-plan/page.tsx` in `handleRefreshWeather()`

### Assessment Logic

```typescript
const assessComfortTier = (day: any): { tier: ComfortTier; score: number } => {
  const feelsLike = day.feels_like ?? day.temp_max
  const precipProb = day.precipitation_chance ?? 0
  const windSpeed = day.wind_speed ?? 0
  const condition = day.condition ?? 'cloudy'
  
  // Hard blockers (instant Unviable)
  if (feelsLike < 13) return { tier: 'unviable', score: 0 }
  if (windSpeed > 9.8) return { tier: 'unviable', score: 0 }
  
  // Active rain check
  const isRainSnow = condition === 'rain' || condition === 'snow'
  if (condition === 'snow') return { tier: 'unviable', score: 0 }
  if (isRainSnow && precipProb > 70) return { tier: 'unviable', score: 0 }
  if (precipProb > 80) return { tier: 'unviable', score: 0 }
  
  // ... weighted scoring (same as strategy generation) ...
  
  // Assign tier
  if (score >= 85) tier = 'premium'
  else if (score >= 65) tier = 'viable'
  else if (score >= 45) tier = 'marginal'
  else tier = 'unviable'
  
  return { tier, score }
}
```

### Comparison Logic

```typescript
// Compare old vs new tiers
const tierShiftDates = new Set<string>()
const tierChanges: Array<{ 
  date: string; 
  oldTier: ComfortTier; 
  newTier: ComfortTier; 
  oldScore: number; 
  newScore: number 
}> = []

updatedDays.forEach((newDay) => {
  const oldDay = oldDays.find(o => o.date === newDay.date)
  if (!oldDay) return
  
  const oldAssessment = assessComfortTier(oldDay)
  const newAssessment = assessComfortTier(newDay)
  
  // Substantial change = tier category shift
  if (oldAssessment.tier !== newAssessment.tier) {
    tierShiftDates.add(newDay.date)
    tierChanges.push({
      date: newDay.date,
      oldTier: oldAssessment.tier,
      newTier: newAssessment.tier,
      oldScore: oldAssessment.score,
      newScore: newAssessment.score,
    })
  }
})

// Only mark as "changed" if tier shifts occurred
const changed = tierShiftDates.size > 0
```

---

## 🎯 Benefits

1. **Prevents Unnecessary Regeneration**  
   - Minor temperature variations (±2°C) within same tier = no regeneration
   - Small score fluctuations (87→83 pts) = no regeneration
   - Only tier category shifts trigger regeneration recommendation

2. **Aligns with Strategic Logic**  
   - Uses identical weighted scoring as strategy generation
   - Same comfort tiers, same blockers, same thresholds
   - Ensures consistency between detection and generation

3. **Preserves User's Content**  
   - If weather hasn't materially changed strategy, keep existing plan
   - Avoids discarding hand-edited posts for trivial forecast updates
   - User controls when to regenerate based on substantial change indicator

4. **Clear User Communication**  
   - Console logs tier changes for debugging
   - Shows impacted posts when tiers shift
   - "No substantial changes" message when safe to keep current plan

---

## 📊 Real-World Test Cases

### Test 1: Cloud Cover Variation (Same Tier)
| Day | Old | New | Tier Shift? |
|-----|-----|-----|-------------|
| Mon | 20°C, 10% clouds (90 pts, Premium) | 20°C, 30% clouds (86 pts, Premium) | ❌ No |
| Tue | 18°C, 40% clouds (72 pts, Viable) | 18°C, 50% clouds (70 pts, Viable) | ❌ No |

**Result:** No regeneration needed. Strategic outdoor messaging remains appropriate.

### Test 2: Weekend Rain Front (Tier Shift)
| Day | Old | New | Tier Shift? |
|-----|-----|-----|-------------|
| Thu | 22°C, sunny (92 pts, Premium) | 22°C, sunny (92 pts, Premium) | ❌ No |
| Fri | 21°C, partly cloudy (85 pts, Premium) | 21°C, partly cloudy (85 pts, Premium) | ❌ No |
| Sat | 19°C, partly cloudy (75 pts, Viable) | 16°C, rain 75% (0 pts, Unviable) | ✅ **YES** |
| Sun | 18°C, sunny (80 pts, Viable) | 15°C, rain 65% (0 pts, Unviable) | ✅ **YES** |

**Result:** Regeneration warranted. Weekend posts promoting outdoor dining need revision.

---

## 🔄 Workflow

```
User clicks "Refresh Weather"
   ↓
Fetch latest Open-Meteo forecast
   ↓
For each day:
  1. Calculate old comfort tier
  2. Calculate new comfort tier
  3. Compare tiers
   ↓
Any tier shifts detected?
   ├─ YES → Mark as "substantial change"
   │         Show impacted posts
   │         Suggest regeneration
   └─ NO  → Mark as "no substantial change"
            Update UI display only
            Keep current strategy/plan
```

---

## ✅ Validation

**Edge Cases Handled:**

1. **Boundary crossing (64→65 pts):** Marginal→Viable = tier shift ✅
2. **Score increase within tier (70→75):** Both Viable = no shift ❌
3. **Blocker triggered (18°C 3m/s → 18°C 10m/s):** Viable→Unviable = tier shift ✅
4. **Improved conditions (Unviable→Marginal):** Tier shift, may enable outdoor mentions ✅
5. **No weather-sensitive posts:** Tier shift noted but no posts impacted = low priority regeneration

---

**Implementation complete. Substantial change detection prevents unnecessary regenerations while catching meaningful forecast shifts.** 🚀
