# Hybrid Programme Rotation — Content Distribution Plan

**Date:** 1 May 2026  
**Status:** 🔴 NOT IMPLEMENTED — System generates ideas but doesn't ensure programme coverage  
**Test Case:** Café Faust (Business ID: `2037d63c-a138-4247-89c5-5b6b8cef9f3f`)

---

## ✅ DECISION MADE: Simplify Time Slots (Choice A)

**Date:** 1 May 2026  
**Decision:** Remove Danish time period labels (morgen, formiddag, etc.) from backend data structure. Keep **programme-driven** approach.

**Rationale:**
- Content generation is **programme-driven**, not time-period-driven
- The 6 Danish time labels (morgen/formiddag/middag/eftermiddag/aften/nat) were decorative but not functional
- Content logic uses programme names (Brunch, Frokost, Aftensmad, Cocktails) — not time labels
- Time period labels created confusion: data model had 6 periods but content generation used 4 hardcoded thresholds
- **The real gap** is programme rotation logic, not time-of-day labeling

**What Changed:**
- ✅ Removed `label` field from `TimeSlot` interface
- ✅ Simplified `VoiceSystem` to use `programmeSpecific` (not Danish period keys)
- ✅ Frontend derives display labels client-side from programme names
- ✅ Focus effort on **programme coverage tracking** (the real problem)

**New TimeSlot Structure:**
```typescript
timeSlots: [
  { programmes: ['Brunch'], audiences: ['weekendgæster', 'par'], contexts: ['weekend-brunch'] },
  { programmes: ['Frokost'], audiences: ['kontoransatte', 'kollegaer'], contexts: ['frokostpause'] },
  { programmes: ['Aftensmad'], audiences: ['par', 'vennegrupper'], contexts: ['romantisk aftensmad'] },
  { programmes: ['Cocktails'], audiences: ['natteliv-gæster'], contexts: ['weekend-udgang'] }
]
```

---

## Executive Summary

Multi-programme venues (hybrid businesses with 3+ service periods) need systematic content rotation to ensure all offerings get coverage. Currently, the system detects programmes but **doesn't distribute ideas across them**.

**Test Business Context:**
- **Café Faust** has 4 programmes: Brunch → Frokost → Aftensmad → Cocktails (late night)
- Opens 09:30, closes 02:00 weekends
- This is the **extreme case** — if we can handle 4 programmes, we handle all others

**Current Gap:**
- System identifies `primaryServicePeriod = 'all_day'` ✅
- System maps programmes to timeSlots with audiences ✅
- System generates ideas but **no rotation logic** ❌
- Cocktails (lowest revenue contributor) gets over-emphasized due to late hours being "distinctive"

---

## Problem Analysis

### What Exists Today

**Detection (Working):**
```typescript
// supabase/functions/generate-weekly-plan/index.ts
const { servicePeriods, primaryServicePeriod } = deriveServicePeriods(menuItems)

if (periodCount >= 3 || (servicePeriods.brunch && servicePeriods.lunch && servicePeriods.dinner)) {
  primaryServicePeriod = 'all_day'
}
```

**Time Slot Mapping (Working):**
```typescript
// supabase/functions/_shared/brand-profile/repair/fallback-builders.ts
timeSlots: [
  { programmes: ['Brunch'], audiences: ['kontoransatte', 'weekendgæster', 'par'] },
  { programmes: ['Frokost'], audiences: ['kontoransatte', 'forretnings-frokost', 'kollegaer'] },
  { programmes: ['Aftensmad'], audiences: ['par', 'vennegrupper', 'familier'] },
  { programmes: ['Cocktails'], audiences: ['natteliv-gæster', 'vennegrupper', 'par'] }
]
```

**What's Missing:**
1. **No rotation scheduler** in Weekly Plan
2. **No coverage checker** in Dagens Forslag
3. **No revenue weighting** to prioritize high-value programmes
4. **No calendar context** (first weekend, payday, etc.)

---

## Test Case: Café Faust 4-Programme Distribution

### Business Profile
- **Programmes:** Brunch (09:30-14:00), Frokost (11:00-16:00), Aftensmad (17:00-22:00), Cocktails (20:00-02:00)
- **Revenue Priority:** Aftensmad > Frokost > Brunch > Cocktails (estimated)
- **Volume Priority:** Frokost > Brunch > Aftensmad > Cocktails
- **Distinctiveness:** Cocktails (late hours) > Brunch (waterfront weekend) > Others

### Current Behavior (Problem)
Voice option emphasizes: **"Cocktailprogrammet kører til kl. 02:00 i weekenden"**
- Over-indexes on distinctiveness (late hours)
- Under-represents revenue drivers (dinner, lunch)

### Desired Behavior (Solution)
**Weekly rotation for 3-post plan:**
```
Week 1:
  Monday:    Frokost idea (business lunch segment)
  Thursday:  Aftensmad idea (dinner segment)
  Saturday:  Brunch idea (weekend waterfront)

Week 2:
  Tuesday:   Aftensmad idea (date night)
  Friday:    Cocktails idea (weekend kickoff) ← First weekend logic
  Sunday:    Brunch idea (weekend closing)

Week 3:
  Monday:    Frokost idea (different dish than Week 1)
  Wednesday: Atmosphere idea (location/vibe, no programme)
  Saturday:  Aftensmad idea (weekend dinner)

Week 4:
  Tuesday:   Frokost idea
  Friday:    Cocktails idea (payday weekend)
  Sunday:    BTS idea (process/craft, cross-programme)
```

**Distribution over 4 weeks (12 posts):**
- Aftensmad: 4 posts (33%) — highest revenue
- Frokost: 3 posts (25%) — highest volume
- Brunch: 3 posts (25%) — weekend signature
- Cocktails: 2 posts (17%) — distinctive but lower priority
- Non-programme: 0 posts (vibe/BTS can reference any programme)

---

## Solution Architecture

### Phase 1: Programme Coverage Tracker

**File:** `supabase/functions/get-weekly-strategy/context-interpreters.ts`

**New function:**
```typescript
interface ProgrammeCoverage {
  programme: string
  last_posted: string | null  // ISO date
  posts_last_4_weeks: number
  priority_score: number      // 1-100 (revenue × volume × recency)
}

function calculateProgrammePriorities(
  programmes: string[],
  recentPosts: any[],          // Last 4 weeks
  revenueWeights?: Record<string, number>  // Optional: from business settings
): ProgrammeCoverage[] {
  // 1. Count posts per programme from recentPosts
  // 2. Calculate recency penalty (longer since last post = higher priority)
  // 3. Apply revenue weights if available
  // 4. Return sorted by priority_score (descending)
}
```

**Integration point:**
```typescript
// In get-weekly-strategy/index.ts
const programmePriorities = calculateProgrammePriorities(
  servicePeriods,
  previousPlans.flatMap(p => p.posts),
  businessProfile.revenue_weights  // Optional
)

// Pass to AI prompt:
const underrepresentedProgrammes = programmePriorities
  .filter(p => p.posts_last_4_weeks < expectedCoverage)
  .map(p => p.programme)
```

---

### Phase 2: Calendar Context Heuristics

**File:** `supabase/functions/get-weekly-strategy/context-interpreters.ts`

**New function:**
```typescript
interface CalendarContext {
  week_of_month: 1 | 2 | 3 | 4 | 5
  is_first_weekend: boolean
  is_payday_week: boolean      // Last week of month
  seasonal_event?: string      // e.g., "påske", "jul", "sommer-start"
}

function deriveCalendarContext(weekStart: Date): CalendarContext {
  const weekOfMonth = Math.ceil(weekStart.getDate() / 7)
  const isFirstWeekend = weekOfMonth === 1
  const isPaydayWeek = weekOfMonth >= 4  // Approximation
  
  return {
    week_of_month: weekOfMonth,
    is_first_weekend: isFirstWeekend,
    is_payday_week: isPaydayWeek,
    seasonal_event: detectSeasonalEvent(weekStart)
  }
}
```

**Programme mapping:**
```typescript
// In weekly strategy prompt
if (calendarContext.is_first_weekend && programmes.includes('Cocktails')) {
  ideaSuggestions.push({
    programme: 'Cocktails',
    day: 'Friday',
    rationale: 'First weekend of month — socializing/going-out peak'
  })
}

if (calendarContext.is_payday_week && programmes.includes('Aftensmad')) {
  ideaSuggestions.push({
    programme: 'Aftensmad',
    day: 'Thursday/Friday',
    rationale: 'Payday week — higher-ticket dinner interest'
  })
}
```

---

### Phase 3: Dagens Forslag Coverage Check

**File:** `supabase/functions/get-quick-suggestions/index.ts`

**Current logic:**
```typescript
const activeServicePeriod = deriveCurrentServicePeriod(now, servicePeriods)
// Uses current time → morning suggests brunch, evening suggests dinner
```

**Add coverage awareness:**
```typescript
// After deriving activeServicePeriod:
const recentPosts = await fetchRecentPosts(businessId, 7)  // Last 7 days
const postedProgrammes = recentPosts.map(p => p.programme).filter(Boolean)

// If current programme was posted yesterday, suggest alternative
if (postedProgrammes.includes(activeServicePeriod)) {
  const alternativeProgrammes = Object.keys(servicePeriods)
    .filter(p => !postedProgrammes.includes(p))
  
  if (alternativeProgrammes.length > 0) {
    activeServicePeriod = alternativeProgrammes[0]
    console.log(`📊 Coverage check: ${activeServicePeriod} recently posted, switching to ${alternativeProgrammes[0]}`)
  }
}
```

---

## Implementation Checklist

### ✅ Phase 1: Core Coverage Tracking (COMPLETED 2025-01-20)
- ✅ Add `calculateProgrammePriorities()` function (context-interpreters.ts)
- ✅ Fetch last 4 weeks of posts in `get-weekly-strategy` (added to parallel fetch at line 749-775)
- ✅ Count posts per programme (logic in calculateProgrammePriorities)
- ✅ Calculate recency-weighted priority scores (recency 0-50 + frequency 0-30 + revenue 0-20)
- ✅ Pass underrepresented programmes to AI prompt (via weekContext.programme_coverage)
- ⏳ Test with Café Faust (should see rotation over 4 weeks) — **PENDING USER TEST**

### ✅ Phase 2: Calendar Context (COMPLETED 2025-01-20)
- ✅ Add `deriveCalendarContext()` function (context-interpreters.ts)
- ✅ Map first weekend → social programmes (is_first_weekend flag set)
- ✅ Map payday week → premium programmes (is_payday_week flag set)
- ✅ Pass calendar context to weekly strategy (via weekContext.calendar_context)
- ⏳ Test with different week-of-month scenarios — **PENDING USER TEST**

### ✅ Phase 3: Dagens Forslag Awareness (COMPLETED 2025-01-20)
- ✅ Fetch recent posts (last 7 days) in `get-quick-suggestions` (added after time slot matching)
- ✅ Check if suggested programme was posted recently (checks last 3 posts)
- ✅ Suggest alternative programme if needed (switches to unused programme)
- ✅ Log coverage decisions for transparency (console.log rotation switch)
- ⏳ Test with daily suggestions over 7-day period — **PENDING USER TEST**

### 🔜 Phase 4: Optional Revenue Weighting (NOT STARTED)
- [ ] Add `revenue_weights` to `business_operations` table (JSON)
- [ ] UI for setting programme priorities (Admin → Settings)
- [ ] Apply revenue weights in priority calculation (placeholder exists in code)
- [ ] Default weights: equal distribution if not set

---

## Implementation Details (Completed 2025-01-20)

### Files Modified:

1. **supabase/functions/get-weekly-strategy/context-interpreters.ts**
   - Added `calculateProgrammePriorities()` function (~70 lines)
   - Added `deriveCalendarContext()` function (~25 lines)
   - Both functions exported and imported by get-weekly-strategy/index.ts

2. **supabase/functions/get-weekly-strategy/index.ts**
   - Added generated_posts fetch to parallel query (Step 6, line 749-775)
   - Added programme coverage calculation (Step 6d, after Step 6c)
   - Added calendar context derivation
   - Added programme_coverage and calendar_context to weekContext object
   - Updated import statement to include new functions

3. **supabase/functions/get-quick-suggestions/index.ts**
   - Replaced legacy time period matching (morgen/frokost/etc.) with programme-based matching
   - Added programme hour range detection (brunch 7-12, frokost 11-16, etc.)
   - Added recent posts fetch (last 7 days, 10 posts)
   - Added coverage check: switches programme if used in last 3 posts
   - Logs rotation decisions to console

### Key Design Decisions:

1. **4-week lookback window** for programme coverage (balance between recency and statistical significance)
2. **Priority scoring algorithm:**
   - Recency: 50 points max (exponential decay from 28 days ago)
   - Frequency: 30 points max (inverse of post count, capped at 4 posts)
   - Revenue: 20 points max (optional, defaults to 0 if not set)
3. **Coverage threshold:** Programmes with <2 posts in 4 weeks flagged as underrepresented
4. **Dagens Forslag rotation:** Only checks last 3 posts to avoid stale data

### Phase 4: Optional Revenue Weighting
- [ ] Add `revenue_weights` to `business_operations` table (JSON)
- [ ] UI for setting programme priorities (Admin → Settings)
- [ ] Apply revenue weights in priority calculation
- [ ] Default weights: equal distribution if not set

---

## Multi-Location Context Issue

**Additional complexity identified:** Café Faust has **two location contexts**:
1. **Waterfront (turistområde)** — Score: 100
2. **City Centre** — Score: 65

**Current problem:** System treats these as independent, but they **combine** to create unique audience dynamics:

- **Waterfront alone** → tourists + destination visitors
- **City Centre alone** → office workers + shopping-pause
- **Waterfront + City Centre** → locals who use waterfront as neighborhood feature + tourists + business lunch crowd

**Implication for programme distribution:**
- **Frokost** should leverage BOTH contexts (office workers from city centre + shopping-pause from waterfront foot traffic)
- **Brunch** should emphasize local weekend use (waterfront as neighborhood amenity, not tourist destination)
- **Aftensmad** should target date night (locals) + destination dining (visitors)
- **Cocktails** should emphasize late-night city centre nightlife

**Solution needed:** Location context combinations should influence audience interpretation, not just scores.

---

## Success Metrics

**Before implementation:**
- Café Faust gets 3 posts/week, cocktails mentioned 2× (67% of posts)
- Dinner (highest revenue) gets 0-1 mentions per week
- No systematic rotation visible over 4 weeks

**After implementation:**
- Over 4 weeks (12 posts), distribution matches revenue/volume priorities
- Underrepresented programmes get coverage boost
- Calendar context influences programme selection (first weekend → cocktails)
- Dagens Forslag varies programme based on recent posting history

**Validation:**
- Run 4 consecutive weeks for Café Faust
- Count programme mentions
- Verify distribution: Dinner 33%, Lunch 25%, Brunch 25%, Cocktails 17%
- Verify no programme goes >2 weeks without mention

---

## Notes for Implementation

1. **Don't hardcode Café Faust logic** — use signals (programme count, time slots, audiences)
2. **Default to equal distribution** if no revenue data available
3. **Log rotation decisions** so users can see why specific programmes were chosen
4. **Test with edge cases:**
   - Single-programme venue (no rotation needed)
   - Two-programme venue (breakfast + dinner → simpler rotation)
   - Five-programme venue (very rare, but should handle gracefully)

4. **Consider adding UI for programme priorities** in business settings:
   ```
   Programme Priorities (optional — affects content rotation):
   ☐ Brunch: [Priority: Medium ▼] [Revenue weight: 20%]
   ☐ Frokost: [Priority: High ▼] [Revenue weight: 35%]
   ☐ Aftensmad: [Priority: High ▼] [Revenue weight: 40%]
   ☐ Cocktails: [Priority: Low ▼] [Revenue weight: 5%]
   
   💡 Higher priority programmes get more content ideas over time.
   ```
