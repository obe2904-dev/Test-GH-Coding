# Weekly Plan Day Allocation — Gap Analysis

**Date**: 2026-06-07  
**Status**: Discovery / Documentation  
**Purpose**: Document current behavior vs intended business-first system

---

## Executive Summary

**Current State**: Weekly Plan assigns posts to days using **calendar-first templates** (Mon/Wed/Fri-Sat + spread algorithm)

**Problem**: This creates front-loaded weeks (Mon-Wed) that miss critical revenue moments (Thu-Fri-Sat dinner)

**Root Cause**: The slot system uses **fixed timing windows** instead of analyzing **when guests decide** and **when business needs traffic**

**Impact**: 
- Week 23 (Grundlovsdag Fri): Posts on Mon/Tue/Wed/Thu, **missing Friday itself**
- Week 24 (Normal week): Posts on Mon/Tue/Wed/Sat, **missing Thu-Fri dinner drivers**

---

## Current Behavior (As Implemented)

### Slot System Architecture

**Location**: `supabase/functions/_shared/post-helpers/strategy/phase1.ts:704-740`

```typescript
const BASE_SLOTS: SlotTemplate[] = [
  { slot_id: 'A', goal_mode: 'drive_footfall', timing_window: 'Fri-Sat 14:00' },
  { slot_id: 'B', goal_mode: 'drive_footfall', timing_window: 'Wed-Thu 11:00' },
  { slot_id: 'C', goal_mode: 'build_brand',    timing_window: 'Mon 09:00' },
  { slot_id: 'D', goal_mode: 'retain_loyalty', timing_window: 'any' },
];
```

**For N=4 posts, default distribution**:
- 2 drive_footfall (Slots A + B)
- 1 build_brand (Slot C)
- 1 retain_loyalty (Slot D)

### Day Assignment Algorithm

**Location**: `supabase/functions/_shared/post-helpers/strategy/phase2/phase2a.ts:88-285`

**Order of assignment** (greedy calendar allocation):

1. **Fixed windows first** (slots sorted by calendar position):
   - Slot C → Monday 09:00
   - Slot B → Wed-Thu window (picks Wed or Thu)
   - Slot A → Fri-Sat window (picks Fri or Sat)

2. **Event pins** (high-priority holidays/commercial events):
   - Applies to drive_footfall slots only
   - Posts 1-2 days BEFORE the event
   - Example: Grundlovsdag Friday → pin to Wed or Thu

3. **Flexible slots (D)** with `timing_window='any'`:
   - Uses "spread algorithm" to maximize calendar distance from assigned days
   - Picks day that maximizes `minGap` from already-assigned posts
   - Tie-broken by goal_mode DOW preference:
     - `drive_footfall`: Wed, Thu, Fri, Sat, Mon, Tue, Sun
     - `build_brand`: Mon, Tue, Sun, Sat, Fri, Wed, Thu
     - `retain_loyalty`: Tue, Mon, Sun, Sat, Fri, Wed, Thu

4. **Consecutive guard**:
   - Never more than 2 consecutive calendar days
   - Breaks runs of ≥3 days by moving flexible slots

### Example Outputs (Observed)

**Week 23**: Grundlovsdag (holiday) on Friday June 5
- **Generated posts**: Mon, Tue, Wed, Thu
- **Strategy narrative**: "Frokost på Grundlovsdag" + indoor rainy weather
- **Missing**: Friday (the actual holiday), Saturday, Sunday
- **Analysis**: 
  - Event pin pushed Slot A to Wed/Thu (lead-up)
  - Slot D used spread → picked Tue
  - Result: All posts BEFORE the event, none ON or AFTER

**Week 24**: Normal week, no special events
- **Generated posts**: Mon 10:00, Tue 13:00, Wed 16:00, Sat 10:00
- **Strategy narrative**: "Frokostbesøg i hverdage" + rainy weather
- **Missing**: Thursday, Friday, Sunday
- **Analysis**:
  - Slot C → Mon
  - Slot B → Tue (Wed-Thu window, picked Tue)
  - Slot D → Wed (spread from Mon/Tue)
  - Slot A → Sat (Fri-Sat window, picked Sat for brunch)
  - Result: Front-loaded Mon-Wed, then Sat brunch, **no Thu-Fri dinner drivers**

---

## Gap Analysis: Calendar-First vs Business-First

### What's Missing

#### 1. **Customer Decision Journey Modeling**

**Current**: Slot system knows "Fri-Sat 14:00" but not WHY  
**Missing**: Understanding when guests decide vs when they visit

**Example for restaurant dinner**:
- **Decision window**: Thursday 14:00 - Friday 17:00 (booking for weekend)
- **Visit window**: Friday 19:00 - Saturday 21:00 (actual dining)
- **Post timing**: Thursday 14:00 post drives Friday/Saturday dinner bookings
- **Current behavior**: Slot A "Fri-Sat 14:00" sometimes picks Saturday 10:00 (wrong timing!)

**What AI should analyze** (Phase 0):
```
"Weekend dinner decision-making peaks Thu afternoon (45% of Fri-Sat bookings made Thu 14-18) 
and Friday morning (30% made Fri 09-13). Posts must appear in these windows to capture intent."
```

**What the system should do**:
- Slot A should be "Thu 14:00 post for Fri-Sat dinner" (not "Fri-Sat 14:00 post")
- AI decides the business moment ("weekend dinner reservations")
- Deterministic rules map to posting time ("Thursday afternoon")

---

#### 2. **Business-Specific "Normal Week" Definition**

**Current**: Hardcoded slots (Mon/Wed/Fri-Sat) for all businesses  
**Missing**: Brand Profile definition of "what drives revenue this business"

**Should exist in Brand Profile** (currently partial):
```json
{
  "service_periods": ["breakfast", "lunch", "dinner"],
  "revenue_drivers": {
    "primary": {
      "moment": "weekend_dinner",
      "days": ["Friday", "Saturday"],
      "decision_window": "Thursday 14:00 - Friday 17:00",
      "post_timing": "Thursday 14:00, Friday 14:00"
    },
    "secondary": {
      "moment": "weekday_lunch",
      "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "decision_window": "Same day 08:00 - 11:00",
      "post_timing": "08:00 - 10:00 day-of"
    },
    "tertiary": {
      "moment": "weekend_brunch",
      "days": ["Saturday", "Sunday"],
      "decision_window": "Same day 08:00 - 10:00",
      "post_timing": "Saturday 08:00, Sunday 08:00"
    }
  },
  "normal_week_post_distribution": {
    "minimum_coverage": {
      "weekend_driver": 1,  // Thu or Fri post for weekend dinner
      "weekday_lunch": 1,   // Mon-Wed post for lunch traffic
      "brand_builder": 1    // Mon-Tue for awareness
    },
    "preferred_days": ["Monday", "Wednesday", "Thursday", "Saturday"]
  }
}
```

**What AI should do**:
- Phase 0 analyzes "this week is normal/quiet" → use brand profile normal_week pattern
- Phase 0 identifies "this week has Valentines" → adjust pattern for event
- Phase 1 receives "use weekend_driver + weekday_lunch + brand_builder mix"
- Phase 2a maps to actual days using decision_window rules

**What's currently missing**:
- No `revenue_drivers` in brand profile
- No `normal_week_post_distribution`
- AI generates angles without knowing business-specific revenue patterns

---

#### 3. **Event Week Logic**

**Current**: Event pin moves posts BEFORE events (lead-up only)  
**Missing**: Understanding event TYPE and appropriate timing

**Event types and posting strategy**:

| Event Type | Example | Post Timing Strategy | Current Behavior | Gap |
|------------|---------|---------------------|------------------|-----|
| **Advance-booking holiday** | Valentines, Mors Dag | 3-5 days before (drive reservations) | ✅ Event pin works | ✅ Correct |
| **Same-day holiday** | Grundlovsdag, Easter Monday | Day-of + day-before | ⚠️ Only day-before | ❌ Missing day-of post |
| **Multi-day period** | Easter weekend, Christmas week | Span across period | ⚠️ One lead-up post | ❌ Missing coverage |
| **Weather-driven** | First warm day, rainy weekend | Day-of reaction | ❌ No mechanism | ❌ Missing reactive posts |
| **School vacation start** | Summer break begins Friday | Thu lead-up + Fri day-of | ⚠️ Only Thu | ❌ Missing Fri |

**Example: Grundlovsdag (same-day holiday lunch)**

**What SHOULD happen**:
- **Wednesday 10:00**: Brand/atmosphere post ("Velkommen til en hyggelig Grundlovsdag hos os")
- **Thursday 14:00**: Drive-footfall post ("Book bord til Grundlovsdag frokost – vi har åbent som normalt")
- **Friday 09:00**: Day-of reminder ("Velkommen til Grundlovsdag – vi serverer til kl. 15:00")

**What CURRENTLY happens**:
- Mon/Tue/Wed/Thu posts (lead-up)
- **Missing Friday entirely**

**Root cause**: Event pin assumes all events are advance-booking (like Valentines), not same-day (like Grundlovsdag)

---

#### 4. **Temporal Context Awareness**

**Current**: AI sees "rainy weather" and "no events" but doesn't adjust day strategy  
**Missing**: Connecting context to day allocation

**Week 24 example**:
- **Context**: "Regnvejrsuge — 7 ud af 7 dage med regn"
- **Strategy**: "Regnvejr i weekenden øger spontane indendørs-besøg"
- **Post days**: Mon, Tue, Wed, Sat (Sat is good! But missing Thu-Fri)

**What's missing**: 
```
IF weather="rainy weekend" AND business="indoor dining"
THEN priority_days=["Thursday 17:00 (drive Fri dinner)", "Saturday 10:00 (drive Sat lunch)"]
NOT Mon-Tue-Wed front-loading
```

**AI SHOULD identify** (Phase 0):
```json
{
  "unique_factors_this_week": [
    {
      "factor": "7-day rain period with weekend peak",
      "customer_behavior_enabled": "Spontaneous indoor dining seeks on rainy weekend",
      "time_windows_activated": ["Friday 17:00-22:00", "Saturday 11:00-22:00"],
      "post_timing_strategy": "Thursday 14:00 post to prime weekend intent, Saturday 08:00 for day-of lunch"
    }
  ]
}
```

**System SHOULD map** (Phase 2a):
- AI says "Friday 17:00-22:00 dining opportunity"
- Phase 2a assigns: "Thursday 14:00 post" (decision window before visit)
- AI says "Saturday 11:00-22:00 dining opportunity"
- Phase 2a assigns: "Saturday 08:00 post" (day-of reminder)

**Current behavior**: AI identifies the opportunity, but Phase 2a ignores it and uses template slots

---

## Root Cause Summary

### 1. **AI Role Confusion**

**AI is good at**:
- Analyzing context (weather, events, season)
- Identifying opportunities ("rainy weekend = indoor dining surge")
- Creating compelling angles ("Show warm interior on cold day")

**AI is NOT good at**:
- Deterministic business logic ("Thu post drives Fri bookings")
- Day allocation strategy ("restaurant needs Thu-Fri-Sat coverage")
- Template consistency (sometimes picks wrong days)

**Current mistake**: AI is asked to output `timing_window` (Wed-Thu 11:00) but this is:
- Too specific for AI (hallucination risk)
- Not business-logic-driven (ignores revenue drivers)
- Overridden by Phase 2a anyway (so why ask AI?)

**Better split**:
- **AI (Phase 1)**: "This week's opportunity is weekend indoor dining due to rain (Fri-Sat evenings)"
- **System (Phase 2a)**: "Weekend dinner opportunity → assign Thu 14:00 post + Sat 08:00 post (per brand profile revenue_drivers)"

---

### 2. **Template Over-Reliance**

**BASE_SLOTS defines**:
- Slot A = Fri-Sat 14:00
- Slot B = Wed-Thu 11:00
- Slot C = Mon 09:00
- Slot D = any

**Problems**:
- Works for some businesses (café with even daily traffic)
- Fails for restaurants (weekend dinner revenue needs Thu-Fri-Sat focus)
- Fails for event weeks (Grundlovsdag needs day-of coverage)
- Fails for seasonal patterns (summer weekday lunch vs winter weekend dinner)

**Should be**: Brand Profile defines normal_week pattern, AI adjusts for context

---

### 3. **Missing Business Logic Layer**

**Currently**:
- Phase 0 (AI): Analyzes context
- Phase 1 (AI): Creates angles with timing_window
- Phase 2a (Algorithm): Assigns days using template + spread

**Missing layer**: **Business Rules Engine** between Phase 1 and Phase 2a

```
Phase 1 (AI): "Weekend indoor dining opportunity (Fri-Sat evenings)"
     ↓
[MISSING: Business Rules Engine]
- Looks up brand profile revenue_drivers
- Finds "weekend_dinner" has decision_window="Thu 14:00 - Fri 17:00"
- Outputs: "Assign 1 post Thu 14:00, 1 post Fri 14:00"
     ↓
Phase 2a (Day Allocator): Assigns Thu + Fri from available days
```

**Current**: Phase 2a tries to do BOTH business logic AND day allocation, using templates that don't understand business

---

## What Users See (Impact)

### Cafe Faust Week 24 (Current Output)

**Generated Strategy**: ✅ Good analysis
> "Frokostbesøg i hverdage... Regnvejr i weekenden øger spontane indendørs-besøg"

**Post Distribution**: ❌ Doesn't match strategy
- **Mon 10:00**: Omelet (breakfast/brunch)
- **Tue 13:00**: Eftermiddagskaffe (afternoon coffee)
- **Wed 16:00**: Bøf & bearnaise (dinner teaser)
- **Sat 10:00**: Brunch med æg (brunch)

**What's missing**:
- Thu 14:00: Weekend dinner driver ("Book bord til fredag/lørdag")
- Fri 17:00: Same-day dinner reminder ("Vi har ledige borde i aften")
- No posts Thu-Fri despite strategy saying "regnvejr i weekenden"

**User confusion**:
> "Strategy says focus on weekend indoor dining, but posts are Mon-Tue-Wed 🤔"

---

## Desired Behavior (Business-First)

### Phase 0: AI Analyzes Context

```json
{
  "unique_factors_this_week": [
    {
      "factor": "7-day rain period with coldest weekend (14-16°C)",
      "customer_behavior_enabled": "Rainy weekend drives spontaneous indoor dining decisions same-day morning + evening-before",
      "time_windows_activated": ["Friday 17:00-22:00", "Saturday 11:00-22:00"],
      "audience_segments": ["Couples seeking cozy dinner", "Families with weekend plans"]
    }
  ],
  "business_opportunities": [
    {
      "opportunity": "weekend_indoor_dining",
      "priority": "high",
      "revenue_moment": "Friday dinner + Saturday lunch/dinner",
      "decision_windows": ["Thursday 14:00-18:00", "Friday 09:00-13:00", "Saturday 08:00-11:00"]
    }
  ]
}
```

---

### Brand Profile: Defines Normal Week

```json
{
  "business_id": "cafe-faust",
  "revenue_drivers": {
    "weekend_dinner": {
      "importance": "primary",
      "days": ["Friday", "Saturday"],
      "decision_windows": ["Thursday 14:00-18:00", "Friday 09:00-17:00"],
      "post_timing_rules": "1 post Thu afternoon, 1 post Fri afternoon"
    },
    "weekday_lunch": {
      "importance": "secondary", 
      "days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
      "decision_windows": ["Same day 08:00-11:00"],
      "post_timing_rules": "1-2 posts Mon-Wed mornings"
    },
    "weekend_brunch": {
      "importance": "tertiary",
      "days": ["Saturday", "Sunday"],
      "decision_windows": ["Same day 08:00-10:00"],
      "post_timing_rules": "1 post Sat morning"
    }
  },
  "normal_week_distribution": {
    "4_posts": ["Monday 09:00", "Wednesday 10:00", "Thursday 14:00", "Saturday 08:00"],
    "rationale": "Mon brand-builder, Wed weekday lunch, Thu weekend driver, Sat brunch"
  }
}
```

---

### Business Rules Engine: Maps Opportunities to Days

**Input from Phase 1**:
```json
{
  "angles": [
    {
      "focus": "Weekend indoor dining (rainy weather)",
      "goal_mode": "drive_footfall",
      "opportunity_ref": "weekend_indoor_dining"
    }
  ]
}
```

**Business Rules Engine**:
```javascript
// Lookup opportunity in brand profile
const opportunity = brandProfile.revenue_drivers["weekend_dinner"];

// Apply posting rules
if (weekContext.weather.includes("rainy weekend")) {
  // Boost weekend driver: add extra Fri post
  return {
    posts: [
      { day: "Thursday", time: "14:00", purpose: "Drive Fri-Sat bookings" },
      { day: "Friday", time: "14:00", purpose: "Drive Sat bookings + same-day Fri" },
      { day: "Saturday", time: "08:00", purpose: "Day-of brunch/lunch reminder" }
    ]
  };
}
```

**Output**: `["Thu 14:00", "Fri 14:00", "Sat 08:00"]` + 1 Mon/Tue brand-builder

---

### Phase 2a: Assigns Specific Days

**Input**: Business rules say ["Thu 14:00", "Fri 14:00", "Sat 08:00", "Mon 09:00"]  
**Available days**: Mon, Tue, Wed, Thu, Fri, Sat, Sun  
**Output**: 
```json
[
  { "id": 1, "day": "2026-06-09", "time": "09:00", "purpose": "build_brand" },
  { "id": 2, "day": "2026-06-12", "time": "14:00", "purpose": "drive_footfall_weekend" },
  { "id": 3, "day": "2026-06-13", "time": "14:00", "purpose": "drive_footfall_weekend" },
  { "id": 4, "day": "2026-06-14", "time": "08:00", "purpose": "drive_footfall_brunch" }
]
```

**Result**: Mon 09:00, Thu 14:00, Fri 14:00, Sat 08:00  
**Coverage**: ✅ Brand-builder, ✅ Weekend drivers, ✅ Brunch, ✅ Matches strategy

---

## Comparison: Current vs Desired

| Aspect | Current (Calendar-First) | Desired (Business-First) |
|--------|-------------------------|-------------------------|
| **Day Selection** | Template slots (Mon/Wed/Fri-Sat) | Brand profile revenue_drivers |
| **AI Role** | Outputs timing_window (specific) | Analyzes opportunities (strategic) |
| **Business Logic** | Implicit in slot templates | Explicit in brand profile + rules engine |
| **Event Handling** | Lead-up pin only | Event-type-specific (before/during/after) |
| **Flexibility** | Spread algorithm (arbitrary) | Context-aware adjustment |
| **Result Week 24** | Mon/Tue/Wed/Sat | Mon/Thu/Fri/Sat |

---

## Recommendations

### 1. **Document Business Rules First** (This file)
- [x] Map current behavior
- [x] Identify gaps
- [ ] Define desired business logic per business type

### 2. **Design Business Rules Engine**
- [ ] Define brand profile schema for `revenue_drivers`
- [ ] Define event type taxonomy (advance-booking vs same-day vs multi-day)
- [ ] Design mapping layer: AI opportunity → business rules → day assignments

### 3. **Refactor AI Role**
- [ ] Phase 0: Context analysis only (NO timing_window output)
- [ ] Phase 1: Strategic opportunities only (NO specific days)
- [ ] Business Rules: Deterministic day allocation logic
- [ ] Phase 2a: Execute day assignments from business rules

### 4. **Test with Real Weeks**
- [ ] Week 23 (Grundlovsdag): Should have Thu lead-up + Fri day-of
- [ ] Week 24 (Rainy normal): Should have Thu-Fri-Sat coverage
- [ ] Week with Valentines: Should have 3-5 day advance posts
- [ ] Summer week: Should adjust for seasonal patterns

---

## Next Steps

**User Decision Required**:
1. Should we proceed with **Brand Profile schema design** for revenue_drivers?
2. Should we create **Event Type Taxonomy** (advance vs same-day vs multi-day)?
3. Should we design **Business Rules Engine** architecture?
4. What business types need different normal_week patterns? (Restaurant, Cafe, Bar, Retail, etc.)

**No coding until**:
- Business logic is fully documented
- Brand profile schema is designed
- Rules engine architecture is agreed upon

This ensures AI is used for what it's good at (analysis) and deterministic logic handles what it's bad at (day allocation).
