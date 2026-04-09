# LAYER 6: POST SPECIFICATION ENGINE

**Status:** 🚧 In Development  
**Date:** January 29, 2026  
**Dependencies:** Layer 5 (Content Opportunity Matching)  
**Feeds Into:** Layer 7 (Media Format Selection)

---

## Overview

Layer 6 takes Layer 5's scored opportunities and weekly slot assignments, then applies sophisticated day-of-week and time-of-day optimization to create a precise posting schedule.

**Core Principle:** "The right content at the right time."

---

## Architecture

### Input (from Layer 5)
```typescript
interface WeeklyPlan {
  businessId: string
  weekStartDate: Date
  slots: PostSlot[]
}

interface PostSlot {
  contentType: string           // menu_highlight, location_story, etc.
  opportunity: Opportunity       // The specific content to post
  score: number                  // 0-300+ points from Layer 5
  platform: string              // instagram, facebook
  dayOfWeek: number             // 0-6 (basic from Layer 5)
  hour: number                  // Basic hour from Layer 5
}
```

### Processing: Two-Phase Optimization

#### Phase 1: Day Selection Refinement
Applies content-type-specific day patterns:

```typescript
const DAY_PATTERNS = {
  menu_highlight: [1, 3, 5],        // Mon, Wed, Fri (decision days)
  location_story: [4, 5],            // Thu, Fri (weekend momentum)
  behind_scenes: [0, 6],             // Sat, Sun (engaged audience)
  event_promotion: [1, 4, 5],        // Mon, Thu, Fri (early week + weekend)
  engagement: [2, 4],                // Tue, Thu (mid-week engagement)
  // MFV specific:
  location_announcement: [-1, 0]     // Day before, morning of
}
```

#### Phase 2: Time Optimization
Applies meal-period and context-aware timing:

```typescript
const TIME_RULES = {
  // Content type → Optimal hours
  breakfast_menu: [7, 8, 9],         // Morning awareness
  lunch_menu: [11, 12],              // Immediate lunch decision
  dinner_menu: [14, 15, 16, 17],     // Dinner planning window
  atmosphere_fomo: [17, 18, 19],     // "Wish I was there"
  behind_scenes: [9, 10, 11],        // Flexible, morning for weekend
  location_story: [18, 19],          // Evening engagement
  engagement: [12, 18],              // Lunch or evening
}
```

### Output (to Layer 7)
```typescript
interface OptimizedWeeklyPlan {
  businessId: string
  weekStartDate: Date
  slots: OptimizedPostSlot[]
}

interface OptimizedPostSlot {
  // Original from Layer 5
  contentType: string
  opportunity: Opportunity
  score: number
  platform: string
  
  // Enhanced by Layer 6
  scheduledDate: Date              // Exact date/time
  dayOfWeek: number                // Optimized day (0-6)
  hour: number                     // Optimized hour (0-23)
  optimizationReason: string       // Why this time? (for transparency)
}
```

---

## Day Selection Logic

### Base Patterns (Danish Dining Culture)

**Monday (Fresh Start):**
- ✅ Menu highlights (weekly menu introduction)
- ✅ Event promotions (week-long events)
- ❌ Behind-scenes (low engagement start of week)

**Tuesday (Mid-week Low):**
- ✅ Engagement posts (polls, questions)
- ⚠️ Menu highlights (acceptable but not ideal)
- ❌ Major announcements

**Wednesday (Decision Day):**
- ✅ Menu highlights (mid-week menu boost)
- ✅ Special offers (triggers mid-week visits)
- ⚠️ Location stories

**Thursday (Weekend Prep):**
- ✅ Atmosphere posts (building FOMO for weekend)
- ✅ Weekend event promotions
- ✅ Engagement posts

**Friday (Peak Interest):**
- ✅ Menu highlights (weekend dining decisions)
- ✅ Atmosphere/FOMO posts
- ✅ Weekend specials

**Saturday (High Engagement):**
- ✅ Behind-scenes (time to engage deeply)
- ✅ Real-time location updates (MFV)
- ⚠️ Menu highlights (people already decided)

**Sunday (Relaxed Engagement):**
- ✅ Behind-scenes (storytelling)
- ✅ Next-week teasers
- ❌ Immediate action posts (too late for week)

### Business Type Modifications

**FSE (Fine Service Establishment):**
- Favor Wed-Fri for menu (dinner planning window)
- Weekend for ambiance/experience posts

**SBO (Service-Based Operation):**
- Even distribution (service-oriented, less meal-pattern dependent)
- Early week for announcements

**MFV (Mobile Food Vendor):**
- Day-of/morning-of for location announcements
- Real-time flexibility crucial

**MFD (Multi-location Full Service Dining):**
- Early week for chain-wide promotions
- Location-specific posts scattered

**QSR (Quick Service Restaurant):**
- Any day works (convenience-driven)
- Lunch focus Mon-Fri

---

## Time Selection Logic

### Meal Period Patterns

**Breakfast Content (7-9am):**
- Purpose: Awareness building
- Target: Morning scrollers planning their day
- Best for: Breakfast menu items, early opening announcements
- Avoid: If business doesn't serve breakfast

**Lunch Content (11am-12pm):**
- Purpose: Immediate action trigger
- Target: "Where should I eat lunch RIGHT NOW?"
- Best for: Lunch specials, quick service items
- Avoid: If business doesn't serve lunch or opens after 2pm

**Dinner Planning (2-5pm):**
- Purpose: Dinner decision window
- Target: People planning evening meals
- Best for: Dinner menu highlights, reservations
- Peak: 4-5pm (optimal)

**Evening FOMO (5-7pm):**
- Purpose: "Wish I was there" engagement
- Target: People finishing work, scrolling
- Best for: Atmosphere, ambiance, live music, busy venue shots
- Peak: 6-7pm

**Late Evening (8-10pm):**
- Purpose: Next-day awareness
- Target: Evening relaxation scrolling
- Best for: Tomorrow's specials, behind-scenes prep
- Lower priority

### Platform Differences

**Instagram:**
- Peak: 6-7pm, 11am-1pm, 7-9pm
- Favor visual storytelling hours (golden hour 5-7pm)
- Weekend: More flexible (10am-8pm)

**Facebook:**
- Peak: 12-1pm, 7-9pm
- Favor informational posts during lunch/evening
- Older demographic: Earlier posting (9am-7pm)

### Business Hours Integration

```typescript
function respectOpeningHours(
  proposedHour: number,
  businessHours: OpeningHours
): number {
  // Don't post lunch specials if closed during lunch
  if (proposedHour === 11 && !businessHours.open_lunch) {
    return 16 // Move to dinner planning
  }
  
  // Don't post breakfast if not serving breakfast
  if (proposedHour === 8 && !businessHours.open_breakfast) {
    return 11 // Move to lunch
  }
  
  // Don't post dinner menu after closing time
  if (proposedHour === 17 && businessHours.close_hour < 19) {
    return 14 // Earlier dinner planning
  }
  
  return proposedHour
}
```

### Historical Performance Override

```typescript
function applyPerformanceOptimization(
  contentType: string,
  defaultHour: number,
  historicalData: PerformanceData
): number {
  // If this business's posts perform better at different times, use those
  const bestHour = historicalData.optimal_posting_times?.[contentType]
  
  if (bestHour && Math.abs(bestHour - defaultHour) <= 3) {
    // Only shift by max 3 hours from default
    return bestHour
  }
  
  return defaultHour
}
```

---

## Implementation

### Core Function

```typescript
export async function optimizeWeeklySchedule(
  weeklyPlan: WeeklyPlan,
  businessId: string
): Promise<OptimizedWeeklyPlan> {
  
  // Fetch business context
  const businessHours = await getBusinessHours(businessId)
  const performanceData = await getPerformanceData(businessId)
  const businessType = await getBusinessType(businessId)
  
  // Optimize each slot
  const optimizedSlots = weeklyPlan.slots.map(slot => {
    // Phase 1: Refine day selection
    const optimalDay = selectOptimalDay(
      slot.contentType,
      businessType,
      slot.dayOfWeek // Layer 5's basic assignment
    )
    
    // Phase 2: Optimize time
    let optimalHour = selectOptimalHour(
      slot.contentType,
      slot.platform
    )
    
    // Apply business hours constraints
    optimalHour = respectOpeningHours(optimalHour, businessHours)
    
    // Apply historical performance optimization
    optimalHour = applyPerformanceOptimization(
      slot.contentType,
      optimalHour,
      performanceData
    )
    
    // Calculate exact scheduled date
    const scheduledDate = new Date(weeklyPlan.weekStartDate)
    scheduledDate.setDate(scheduledDate.getDate() + optimalDay)
    scheduledDate.setHours(optimalHour, 0, 0, 0)
    
    return {
      ...slot,
      dayOfWeek: optimalDay,
      hour: optimalHour,
      scheduledDate,
      optimizationReason: generateOptimizationReason(
        slot.contentType,
        optimalDay,
        optimalHour
      )
    }
  })
  
  return {
    businessId,
    weekStartDate: weeklyPlan.weekStartDate,
    slots: optimizedSlots
  }
}
```

---

## Example: FSE Weekly Plan Optimization

### Input from Layer 5:
```
FSE Business, 4 posts/week
- Slot 1: Menu highlight, Danish Winter Stew, 185 pts, Day 0 (Mon), 18:00
- Slot 2: Behind-scenes, Kitchen prep, 120 pts, Day 2 (Wed), 12:00
- Slot 3: Menu highlight, Weekend brunch, 140 pts, Day 4 (Fri), 18:00
- Slot 4: Location story, Riverside ambiance, 110 pts, Day 6 (Sun), 12:00
```

### Layer 6 Optimization:

**Slot 1: Danish Winter Stew**
- Content type: `dinner_menu`
- Layer 5: Monday 18:00
- Layer 6: **Monday 16:00** (dinner planning window, earlier for decision-making)
- Reason: "Dinner menu posted during peak planning window (4-5pm)"

**Slot 2: Kitchen Prep**
- Content type: `behind_scenes`
- Layer 5: Wednesday 12:00
- Layer 6: **Saturday 10:00** (weekend, engaged audience, morning storytelling)
- Reason: "Behind-scenes storytelling optimized for weekend engagement"

**Slot 3: Weekend Brunch**
- Content type: `breakfast_menu`
- Layer 5: Friday 18:00
- Layer 6: **Thursday 18:00** (same, building weekend anticipation)
- Reason: "Weekend brunch promoted Thu evening for weekend planning"

**Slot 4: Riverside Ambiance**
- Content type: `location_story`
- Layer 5: Sunday 12:00
- Layer 6: **Friday 18:00** (FOMO timing for weekend)
- Reason: "Ambiance post during evening FOMO window to drive weekend visits"

### Output to Layer 7:
```
Optimized Schedule:
- Monday 16:00: Danish Winter Stew (dinner menu)
- Thursday 18:00: Weekend Brunch Special (weekend promo)
- Friday 18:00: Riverside Ambiance (location FOMO)
- Saturday 10:00: Kitchen Prep Story (behind-scenes)
```

---

## Database Integration

### No New Tables Required

Layer 6 uses existing data:

**From `business_operations`:**
- `opening_hours` (service periods)
- `open_breakfast`, `open_lunch`, `open_dinner` flags

**From `content_performance_log`:**
- Historical posting times
- Engagement rates by hour

**From `content_type_baselines`:**
- `optimal_posting_times` (JSON: `{content_type: best_hour}`)

---

## Testing Strategy

### Unit Tests
1. Day selection rules (each content type)
2. Time selection rules (each meal period)
3. Opening hours constraints
4. Historical performance overrides

### Integration Tests
1. Full weekly plan optimization (FSE, SBO, MFV, MFD, QSR)
2. Edge cases (business closed for lunch, late night hours)
3. Performance data availability (with/without historical data)

### Expected Outputs
- All posts scheduled within business hours
- Content types distributed across optimal days
- Meal-period content posted at appropriate times
- FOMO content in evening windows
- Behind-scenes on weekends

---

## Success Metrics

**Optimization Effectiveness:**
- [ ] Menu posts during meal decision windows (2-5pm for dinner)
- [ ] FOMO posts during peak engagement (5-7pm)
- [ ] Behind-scenes on weekends (Sat/Sun)
- [ ] No lunch posts when business closed for lunch
- [ ] Historical top times used when available

**Business Feedback:**
- Does the schedule "feel right" for the business?
- Are posts timed with actual customer behavior?
- Does it respect operational constraints?

---

## Next: Layer 7

Layer 6 output feeds into Layer 7 (Media Format Selection):
- Takes optimized schedule with exact content + timing
- Determines media format (single image, carousel, video)
- Specifies visual requirements (what to photograph/create)
- Defines caption structure
- Ready for content creation

---

## Implementation Files

**Core Engine:**
- `supabase/functions/_shared/post-helpers/post-slot-optimizer.ts`

**Support Files:**
- `day-selection-rules.ts` (day patterns by content type)
- `time-optimization-rules.ts` (hour selection logic)
- `business-hours-constraints.ts` (opening hours integration)

**Migration:**
- None required (uses existing tables)

**Testing:**
- `test-layer6-optimization.ts` (comprehensive test suite)
