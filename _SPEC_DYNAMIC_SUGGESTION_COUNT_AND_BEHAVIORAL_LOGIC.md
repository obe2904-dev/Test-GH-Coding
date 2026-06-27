# Dynamic Suggestion Count & Behavioral Logic Specification

**Version**: 1.0  
**Date**: 2026-06-22  
**Applies to**: Quick Suggestions (Same-Day Posting) - Paid Tier Only  
**Function**: `get-quick-suggestions`

---

## Executive Summary

Quick-suggestions generates **1-3 content ideas** for same-day posting based on:
1. **Available time window** (how much of the business day remains)
2. **Business operational status** (open/closed, programmes active)
3. **Behavioral context** (what audience segments are active, when they decide)

The system combines **structural logic** (how many ideas, when to post, what type) with **behavioral logic** (which offering, why now, how to frame it) to create contextually relevant, timely suggestions.

---

## Core Concepts

### Structural Logic (WHEN & WHAT TYPE)
- Determines number of suggestions (1-3)
- Calculates optimal posting times
- Decides content type: OFFERING vs. ATMOSPHERE

### Behavioral Logic (WHICH & WHY)
- Selects which dish/programme to promote
- Identifies active audience segments
- Frames rationale based on real decision patterns
- Applies cultural and temporal context

### Content Types

**OFFERING** = Product/Menu promotion
- Specific dish from menu_items_normalized
- Programme promotion (brunch, lunch, dinner)
- Drink/cocktail feature
- **Goal**: Drive immediate or near-term footfall

**ATMOSPHERE** = Non-product content
- Location/ambiance (waterfront views, interior)
- Behind-the-scenes (kitchen prep, staff stories)
- Social proof (busy tables, happy guests)
- Anticipatory ("Opening soon", "Evening service starts...")
- Cultural (local references, Aarhus events, seasonal)
- Retention (thank you messages, regular appreciation)
- **Goal**: Strengthen brand, build connection

---

## Timing Constants

```javascript
const TIMING_RULES = {
  MIN_SPACING: 180,              // 180 min (3 hours) between suggestions
  IMMEDIATE_WINDOW: [30, 60],    // 30-60 min from generation for Idea 1
  CLOSING_BUFFER: 180,           // 180 min before closing (no offering posts)
  FINAL_POST_BUFFER: 60,         // 60 min before closing (last atmosphere post)
  OPTIMAL_IDEA2_START: 360,      // 6 hours from now (earliest for Idea 2 offering)
};
```

---

## Decision Tree: Suggestion Count & Timing

### Preliminary Calculations

```javascript
// INPUT DATA
const now = getCurrentTime();                    // e.g., 07:00
const todayWeekday = getCurrentWeekday();        // e.g., "monday"
const openingTime = getOpeningTime(todayWeekday); // from opening_hours table
const closingTime = getEffectiveClosingTime();   // See Refinement 1 below

// DERIVED VALUES
const isClosedToday = !hasHoursForDay(todayWeekday);
const isBeforeOpening = now < openingTime;
const isCurrentlyOpen = now >= openingTime && now < closingTime;
const isAfterClosing = now >= closingTime;
const minutesUntilClose = closingTime - now;
```

### IDEA 1 Logic (Always Generated)

**Posting Time**: `now + 30-60 minutes`

```
┌─────────────────────────────────────────────────────────────┐
│ IDEA 1: IMMEDIATE POSTING (30-60 min from generation)      │
└─────────────────────────────────────────────────────────────┘

Q1: Is business CLOSED today?
    Check: opening_hours for current weekday

    ├─ YES (closed = true)
    │   └─ Generate 1 ATMOSPHERE idea
    │       Content: "We're closed today - see you [next_open_day]"
    │       STOP (total: 1 idea)
    │
    └─ NO (business operates today)
        → Continue to Q2

Q2: What's the current time status?

    ├─ BEFORE OPENING (now < opening_time)
    │   └─ Generate 1 OFFERING idea (anticipatory)
    │       Audience: Early planners for later consumption
    │       Frame: "Opening soon", "Plan your [meal]"
    │       → Continue to IDEA 2 Logic
    │
    ├─ CURRENTLY OPEN (opening_time ≤ now < closing_time)
    │   │
    │   Q2a: Is closing imminent?
    │        Check: (closing_time - now) < 180 min
    │   │
    │   ├─ YES (closing soon, < 3 hours left)
    │   │   └─ Generate 1 ATMOSPHERE idea
    │   │       Reason: Too late for offering conversion
    │   │       Content: Evening mood, next-day preview, gratitude
    │   │       → Continue to IDEA 2 Logic
    │   │
    │   └─ NO (3+ hours until close)
    │       └─ Generate 1 OFFERING idea
    │           Match: Active programme + audience segment
    │           → Continue to IDEA 2 Logic
    │
    └─ AFTER CLOSING (now ≥ closing_time)
        └─ Generate 1 ATMOSPHERE idea
            Content: Next-day preview, appreciation, behind-scenes
            STOP (total: 1 idea)
```

### IDEA 2 Logic (Conditional)

**Posting Time**: `now + 180 minutes` (3 hours after Idea 1)

```
┌─────────────────────────────────────────────────────────────┐
│ IDEA 2: MID-DAY FOLLOW-UP (3 hours after Idea 1)           │
└─────────────────────────────────────────────────────────────┘

Q3: Is there runway for a later offering?
    Check: (closing_time - (now + 180)) ≥ 180
    
    Translation: After Idea 2 posts (+3h), are there still 3+ hours 
                 until closing? (Total 6+ hours from now)

    ├─ YES (6+ hours remaining)
    │   └─ Generate 1 OFFERING idea
    │       Timing Window: [now + 360 min, closing_time - 180 min]
    │       Strategy: Select optimal time within window based on:
    │                 - Programme peak hours
    │                 - Audience segment timing_windows
    │                 - Decision timing patterns
    │       → Continue to IDEA 3 Logic
    │
    └─ NO (< 6 hours remaining)
        └─ Generate 1 ATMOSPHERE idea
            Posting: now + 180 min
            Fallback: If too close to closing, SKIP Idea 2
            → Continue to IDEA 3 Logic
```

### IDEA 3 Logic (Conditional)

**Posting Time**: Variable, but `≤ closing_time - 60 minutes`

```
┌─────────────────────────────────────────────────────────────┐
│ IDEA 3: CLOSING ATMOSPHERE (Final touch)                   │
└─────────────────────────────────────────────────────────────┘

Q4: Is there time for a third idea?
    Check: Is there ≥ 60 min before closing after Idea 2 timing?
    
    If Idea 2 was at (now + 180), can we post Idea 3 at 
    (now + 360) or later, while staying ≤ (closing - 60)?

    ├─ YES (sufficient time before closing)
    │   └─ Generate 1 ATMOSPHERE idea
    │       Timing: ≤ closing_time - 60 min
    │       Content: Evening wrap-up, sunset views, next-day teaser
    │       STOP (total: 3 ideas)
    │
    └─ NO (insufficient time)
        └─ STOP (total: 2 ideas)
```

---

## Behavioral Logic Integration

### Phase 1: Temporal-Behavioral Context

**Before selecting content, understand the moment:**

```javascript
// 1. What's happening RIGHT NOW?
const currentBehavioralContext = {
  time: now,
  weekday: todayWeekday,
  timeOfDay: getTimeOfDay(now), // morning, midday, afternoon, evening, night
  
  // What are people actually doing?
  behavioralPattern: getBehavioralPattern(weekday, timeOfDay),
  // Examples:
  // - Monday 07:00 = "commute", "coffee", "work_prep"
  // - Monday 11:30 = "lunch_decision_peak"
  // - Monday 17:30 = "dinner_thoughts_emerge"
  // - Saturday 10:00 = "brunch_decision_time"
};

// 2. Which programmes are active or upcoming?
const activeProgrammes = getProgrammesAtTime(now, todayWeekday);
const upcomingProgrammes = getProgrammesAtTime(now + 120, todayWeekday);

// 3. Which audience segments are making decisions at this moment?
const activeSegments = getActiveSegments({
  currentTime: now,
  programmes: [...activeProgrammes, ...upcomingProgrammes],
  weekday: todayWeekday
});
```

### Phase 2: Environmental Context

```javascript
// 4. Weather conditions
const weather = await getWeatherForToday(city);
const weatherContext = {
  current: weather.currentCondition,
  evolution: getWeatherEvolution(weather), // "warming up to 24°C later"
  outdoorViability: assessOutdoorSeating(weather),
  contentOpportunities: getWeatherAngles(weather),
  // e.g., "sunshine returning this afternoon", "cozy indoor weather"
};

// 5. Location advantage timing
const locationContext = {
  primaryUSP: businessLocationIntelligence.location_type_matches.waterfront,
  optimalTimes: getLocationOptimalTimes({
    locationScore: 95,
    dimension: "waterfront",
    weather: weatherContext,
    timeOfDay: getTimeOfDay(targetPostingTime)
  }),
  // e.g., evening = "sunset views", morning = "rolig morgenstemning ved åen"
};
```

### Phase 3: Strategic Content Selection

```javascript
// 6. Match content_type to programme goals
const targetProgramme = selectOptimalProgramme({
  activeProgrammes,
  targetTime: suggestedPostingTime,
  goals: {
    drive_footfall: 0.6,
    retain_regulars: 0.2,
    strengthen_brand: 0.2
  }
});

// 7. Select dish matching audience segment motivation
const targetAudience = selectPrimaryAudience({
  activeSegments,
  programme: targetProgramme,
  timeOfDay: getTimeOfDay(suggestedPostingTime),
  decisionTiming: getDecisionWindow(now, suggestedPostingTime)
});

const selectedDish = selectDish({
  programme: targetProgramme,
  audience: targetAudience,
  motivation: targetAudience.motivation, // convenience, social_gathering, experience_seeking
  situations: targetAudience.situations,
  rotationQueue: getMenuRotationQueue(),
  weather: weatherContext
});

// 8. Ensure programme timing alignment
const isValidMatch = validateProgrammeTiming({
  dish: selectedDish,
  servicePeriod: targetProgramme.programme_type,
  postingTime: suggestedPostingTime,
  kitchenOpen: kitchenOpenTime,
  kitchenClose: kitchenCloseTime
});
```

### Phase 4: Recency & Rotation

```javascript
// 9. Check rotation queue for last usage
const dishHistory = await getDishHistory(selectedDish.id);
const recencyInfo = {
  lastPosted: dishHistory.last_posted_date,
  daysSincePosted: calculateDaysSince(dishHistory.last_posted_date),
  totalTimesPosted: dishHistory.total_times_posted,
  avgEngagement: dishHistory.avg_engagement_rate
};

// 10. Use recency as SUPPORTING evidence, not primary driver
// ✅ GOOD: Lead with context, support with recency
// "Mandag ved åen passer perfekt til Club Sandwich - sidst promoveret for 3 uger siden"

// ❌ BAD: Lead with novelty
// "Club Sandwich aldrig fremhævet endnu - lad os vise den!"

// If never posted before: DON'T MENTION IT
// Focus entirely on contextual relevance
```

### Phase 5: Rationale Assembly

```javascript
// 11. Start with time-audience fit
const rationaleComponents = {
  timeContext: `${weekdayName} kl. ${time}`,
  audienceFit: `${targetAudience.label} ${targetAudience.behavior_at_this_time}`,
  
  // 12. Layer in environmental context
  environmentalFit: weatherContext.relevance 
    ? `${weather.condition} gør ${selectedDish.name} til et godt valg`
    : null,
  
  // 13. Mention dish features (if product post)
  dishFeatures: contentType === 'OFFERING'
    ? `${selectedDish.name} ${getDishFeatureHighlight(selectedDish)}`
    : null,
  
  // 14. Optional recency support
  recencySupport: recencyInfo.daysSincePosted >= 21
    ? `Sidst promoveret for ${Math.floor(recencyInfo.daysSincePosted / 7)} uger siden`
    : null
};

// 15. Apply voice guardrails (remove AI-tells)
const finalRationale = assembleRationale(rationaleComponents)
  .replace(/således|ydermere|derudover/g, '')
  .replace(/perfekt|fantastisk|unik/g, '')
  .limitSentenceLength(15);
```

---

## Refinements

### Refinement 1: Smart Closing Time Detection

```javascript
/**
 * Use the EARLIEST of:
 * - kitchen_close_time (from business_operations)
 * - Last active programme end time
 * 
 * This prevents suggesting food posts after kitchen actually closes
 * even if the bar remains open.
 */
function getEffectiveClosingTime() {
  const kitchenClose = businessOperations.kitchen_close_time; // "23:00:00"
  
  const programmeEndTimes = businessProgrammeProfiles
    .filter(p => p.is_active && p.operating_days.includes(todayWeekday))
    .map(p => {
      const timeWindow = p.time_windows[0]; // "17:30-21:30"
      return timeWindow.split('-')[1]; // "21:30"
    });
  
  const lastProgrammeEnd = Math.max(...programmeEndTimes.map(parseTime));
  const kitchenCloseTime = parseTime(kitchenClose);
  
  return Math.min(kitchenCloseTime, lastProgrammeEnd);
}

// Example: Café Faust
// kitchen_close_time = "23:00"
// AFTEN programme = "17:30-21:30"
// effectiveClosing = 21:30 (use this for offering posts)
```

### Refinement 2: Programme-Aware Offering Selection

```javascript
/**
 * When generating OFFERING ideas, check which programmes are active
 * at the TARGET posting time (not just generation time)
 */
function getActiveProgrammesForTarget(targetPostingTime, weekday) {
  return businessProgrammeProfiles.filter(programme => {
    // Check if programme operates on this weekday
    if (!programme.operating_days.includes(weekday)) return false;
    
    // Check if target time falls within programme windows
    return programme.time_windows.some(window => {
      const [start, end] = window.split('-').map(parseTime);
      return targetPostingTime >= start && targetPostingTime <= end;
    });
  });
}

// Example usage:
// Generation time: 07:00
// Idea 1 posting time: 07:45 (for immediate posting)
// Target consumption time: 11:30 (when audience actually eats)

const programmes = getActiveProgrammesForTarget('11:30', 'monday');
// Returns: [BRUNCH, FROKOST] (both active at 11:30)

// Select dish from intersection of both menus or prioritize FROKOST
```

### Refinement 3: Atmosphere Content Type Selection

```javascript
/**
 * When content type is ATMOSPHERE, select the most contextually
 * relevant non-offering type based on timing and situation
 */
function selectAtmosphereType(context) {
  const { timeOfDay, minutesUntilClose, isBeforeOpening, weather } = context;
  
  // CLOSED TODAY - Informational
  if (context.isClosedToday) {
    return {
      type: 'informational',
      angle: 'next_open_day',
      content: 'Vi holder lukket i dag - ses [next_opening]'
    };
  }
  
  // BEFORE OPENING - Anticipatory
  if (isBeforeOpening && minutesUntilOpening < 120) {
    return {
      type: 'anticipatory',
      angle: 'opening_soon',
      content: 'Åbner om [X] minutter - morgenkaffeen står klar'
    };
  }
  
  // CLOSING SOON - Evening mood/Next day preview
  if (minutesUntilClose < 180 && minutesUntilClose > 60) {
    return {
      type: 'evening_ambiance',
      angle: timeOfDay === 'evening' ? 'sunset_views' : 'winding_down',
      content: 'Solnedgang ved åen - sidste chance for et aftenbord i dag'
    };
  }
  
  // AFTER CLOSING - Next day teaser
  if (context.isAfterClosing) {
    return {
      type: 'next_day_preview',
      angle: 'tomorrow_invitation',
      content: 'Tak for i dag - vi er klar til brunch i morgen kl. 09:30'
    };
  }
  
  // LOCATION HIGHLIGHT - Peak times for USP
  if (context.locationScore >= 90 && timeOfDay === 'evening') {
    return {
      type: 'location_ambiance',
      angle: 'waterfront_sunset',
      content: 'Aftenstemning ved åen - book dit bord nu'
    };
  }
  
  // BEHIND THE SCENES - Mid-day filler
  if (timeOfDay === 'midday' || timeOfDay === 'afternoon') {
    return {
      type: 'behind_scenes',
      angle: 'kitchen_prep',
      content: 'Dagens forberedelser - alt hjemmelavet fra scratch'
    };
  }
  
  // CULTURAL/SEASONAL - Default fallback
  return {
    type: 'cultural',
    angle: 'local_connection',
    content: getSeasonalOrLocalAngle(context)
  };
}
```

---

## Complete Example: Café Faust, Monday 07:00

### Input Data

```javascript
const context = {
  generationTime: '07:00',
  weekday: 'monday',
  businessData: {
    openingTime: '09:30',
    closingTime: '23:00',
    effectiveClosing: '21:30', // Last programme (AFTEN) ends
    programmes: [
      { type: 'morning', name: 'BRUNCH', windows: ['09:00-14:00'] },
      { type: 'lunch', name: 'FROKOST', windows: ['09:00-17:30'] },
      { type: 'dinner', name: 'AFTEN', windows: ['17:30-21:30'] }
    ]
  },
  weather: {
    condition: 'cloudy',
    temp_min: 12,
    temp_max: 24,
    evolution: 'warming up through the day'
  },
  location: {
    primaryUSP: 'waterfront',
    score: 95
  }
};
```

### Calculation Steps

```javascript
// PRELIMINARY
now = 07:00 (420 minutes)
opening = 09:30 (570 minutes)
closing = 21:30 (1290 minutes)
minutesUntilClose = 1290 - 420 = 870 minutes (14.5 hours)

isBeforeOpening = true
isCurrentlyOpen = false
isAfterClosing = false
```

### Decision Flow

```
IDEA 1:
├─ Q1: Closed today? → NO (Monday has hours)
└─ Q2: Time status? → BEFORE OPENING
    └─ Generate OFFERING (anticipatory)
        ├─ Posting time: 07:45
        ├─ Target consumption: 11:30 (lunch decision peak)
        ├─ Active programmes at 11:30: [BRUNCH, FROKOST]
        ├─ Active audience: "Frokost-pendlere" (timing: 11:30-13:30)
        ├─ Behavioral pattern: "Planning lunch while commuting"
        ├─ Decision timing: Spontaneous (same-day decision)
        └─ Continue to IDEA 2

IDEA 2:
└─ Q3: Runway check
    ├─ Now + 180 = 10:00
    ├─ Closing - (now + 180) = 21:30 - 10:00 = 690 min (11.5 hours)
    ├─ Is 690 ≥ 180? → YES
    └─ Generate OFFERING
        ├─ Posting time: 10:30
        ├─ Timing window: [13:00, 18:30]
        │   └─ Optimal: 13:00 (lunch peak for business guests)
        ├─ Active programmes at 13:00: [FROKOST]
        ├─ Active audience: "Forretningsfrokost-gæster"
        ├─ Decision timing: Mixed (some planned, some spontaneous)
        └─ Continue to IDEA 3

IDEA 3:
└─ Q4: Time check
    ├─ Idea 2 posts at 10:30
    ├─ Earliest Idea 3: 10:30 + 180 = 13:30
    ├─ Latest allowed: 21:30 - 60 = 20:30
    ├─ Is there ≥ 60 min buffer? → YES (7 hours available)
    └─ Generate ATMOSPHERE
        ├─ Posting time: 15:00 (afternoon lull)
        ├─ Content type: Evening anticipation + location
        ├─ Target: "Par på date night" (timing: 17:30-21:30)
        └─ STOP (total: 3 ideas)
```

### Generated Suggestions

#### IDEA 1: OFFERING (07:45 posting)

**Content Type**: Product (menu_item)  
**Dish**: Club Sandwich ala Faust  
**Programme**: FROKOST  
**Posting Time**: 07:45  
**Target Time**: 11:30

**Post Copy**:
```
Mandag frokost ved åen 🌿
Club Sandwich klar fra kl. 11:30 - kylling, bacon og friskbagt brød.
Book dit bord nu → [link]
```

**Rationale** (internal):
```
Mandag morgen kl. 07:45 og frokost-pendlere begynder at overveje 
dagens frokost. Club Sandwich tilbyder en klassisk, velsmagende 
løsning for dem der vil sikre sig et godt måltid ved åen. 

Passer til spontan frokost-beslutning som typisk træffes mellem 
kl. 11:30-13:30 for denne målgruppe. Beliggenheden ved åen tilføjer 
værdi til frokostpausen.
```

**Why this works**:
- ✅ Acknowledges behavioral reality (planning lunch at 7:45, not eating)
- ✅ Targets correct audience segment with right timing
- ✅ No "never featured" language - pure contextual relevance
- ✅ Waterfront USP included naturally
- ✅ Clear CTA aligned with decision timing (book now for later)

---

#### IDEA 2: OFFERING (10:30 posting)

**Content Type**: Product (menu_item)  
**Dish**: Moules Mariniers  
**Programme**: FROKOST  
**Posting Time**: 10:30  
**Target Time**: 13:00

**Post Copy**:
```
Forretningsfrokost ved åen 🍽️
Moules Mariniers serveres fra kl. 12:00 - perfekt til dagens møde.
Bord ledigt kl. 13:00 → [link]
```

**Rationale** (internal):
```
Klokken 10:30 træffes beslutninger om forretningsfrokost. Moules 
Mariniers appellerer til professionelle med en klassisk europæisk 
ret der inviterer til god samtale ved bordet. 

Waterfront lokation tilføjer professionel værdi til forretningsmødet. 
Målgruppen "Forretningsfrokost-gæster" booker typisk bord mellem 
12:00-14:00 med blandet beslutnings-mønster (nogle planlægger, 
nogle er spontane).
```

**Why this works**:
- ✅ Timing matches business lunch booking behavior (10:30 for 13:00)
- ✅ Dish selection matches audience sophistication level
- ✅ Location value-add is framed for business context
- ✅ Mixed decision timing reflected in "bord ledigt" (availability hint)

---

#### IDEA 3: ATMOSPHERE (15:00 posting)

**Content Type**: Atmosphere (location + anticipatory)  
**Programme**: N/A (brand-building)  
**Posting Time**: 15:00  
**Target Time**: Evening ambiance

**Post Copy**:
```
Aftenstemning ved åen starter snart 🌅
Solnedgang og AFTEN-menu fra kl. 17:30.
Book dit aftenbord nu → [link]
```

**Rationale** (internal):
```
Eftermiddag kl. 15:00 er planlægningstid for aftensmad. Dette opslag 
minder om waterfront USP (solnedgang ved åen) og tilgængeligheden 
af AFTEN-programmet fra kl. 17:30-21:30.

Målgruppen "Par på date night" planlægger deres aften og værdsætter 
både atmosfære og bookingmulighed. Fokus på beliggenhed frem for 
specifik ret styrker brand og differentiere fra konkurrenter.
```

**Why this works**:
- ✅ Non-offering content balances the day's mix
- ✅ Leverages location USP at optimal time (evening approach)
- ✅ Targets evening audience with advance planning window
- ✅ Creates anticipation without product fatigue

---

## Edge Cases & Handling

### Edge Case 1: Closed All Day

**Scenario**: Public holiday, special closure  
**Detection**: `opening_hours.closed = true` for weekday

**Behavior**:
```
Generate 1 ATMOSPHERE idea only
Content: "Vi holder lukket i dag - ses [next_open_day]"
STOP (total: 1 idea)
```

---

### Edge Case 2: Split Programmes (Gap in Service)

**Scenario**: Brunch ends 14:00, dinner starts 17:30 (3.5 hour gap)  
**Detection**: No active programme during window

**Behavior**:
```javascript
// When calculating Idea 2
if (noActiveProgrammeInWindow(targetTime)) {
  // Option A: Push target time to next programme start
  targetTime = nextProgramme.startTime - 60; // Post 1h before dinner
  
  // Option B: Generate ATMOSPHERE for the gap
  contentType = 'ATMOSPHERE';
  angle = 'anticipatory';
  content = 'Aftenmenu starter kl. 17:30 - book nu';
}
```

---

### Edge Case 3: Late Night Bar (Kitchen Closes, Bar Continues)

**Scenario**:  
- Kitchen: 09:30 - 23:00
- AFTEN programme: 17:30 - 21:30  
- BAR: Open until 02:00

**Detection**: `effectiveClosing` vs `business closing_time`

**Behavior**:
```javascript
effectiveClosing = 21:30; // Last food programme

// After 21:30, only generate ATMOSPHERE content
if (now > effectiveClosing) {
  contentType = 'ATMOSPHERE';
  angle = 'bar_scene';
  content = 'Bar åben til kl. 02:00 - cocktails serveres';
}

// Do NOT suggest food offerings after 21:30
```

---

### Edge Case 4: Early Closing Day

**Scenario**: Restaurant closes at 15:00 on Sundays  
**Detection**: Different `close_time` for specific weekday

**Behavior**:
```javascript
// Generation at 12:00, closing at 15:00
minutesUntilClose = 180; // Exactly 3 hours

// IDEA 1: 
if (minutesUntilClose <= CLOSING_BUFFER) {
  // Even though normally would be OFFERING,
  // too close to closing - use ATMOSPHERE
  contentType = 'ATMOSPHERE';
}

// IDEA 2: 
// Check: closing - (now + 180) = 15:00 - 15:00 = 0
// Less than 180 min → SKIP or ATMOSPHERE only
```

---

### Edge Case 5: Late Generation (22:00 for 23:00 closing)

**Scenario**: User generates at 22:00, kitchen closes 23:00  
**Detection**: `minutesUntilClose < 180`

**Behavior**:
```
IDEA 1: 
├─ Q2a: Closing soon? → YES (60 min left)
└─ Generate ATMOSPHERE
    ├─ Content: "Tak for i dag - ses i morgen"
    └─ STOP (total: 1 idea)

No Idea 2 or Idea 3 (insufficient time)
```

---

### Edge Case 6: Dinner-Only Restaurant

**Scenario**: Opens at 17:30, closes at 23:00  
**Generation**: 07:00 (morning)

**Behavior**:
```
IDEA 1:
├─ Q2: BEFORE OPENING → Generate OFFERING (anticipatory)
    ├─ Posting: 07:45
    ├─ Content: "Aftensbord i aften? Book nu - åbner kl. 17:30"
    ├─ Audience: "Par på date night" (planning dinner)
    └─ Continue

IDEA 2:
├─ Q3: Runway check (9.5 hours until close from 10:00)
└─ Generate OFFERING
    ├─ Posting: 10:30
    ├─ Target: 19:00 (dinner peak)
    └─ Continue

IDEA 3:
└─ Generate ATMOSPHERE
    ├─ Posting: 15:00
    ├─ Content: Evening mood-setter
    └─ STOP (total: 3 ideas)
```

---

## Implementation Checklist

### Data Requirements

- ✅ `opening_hours` with weekday-specific hours and `closed` flag
- ✅ `business_programme_profiles` with `time_windows`, `operating_days`, `audience_segments`
- ✅ `business_operations.kitchen_close_time`
- ✅ `menu_items_normalized.service_periods`, `last_posted_date`
- ✅ `business_brand_profile.voice_guardrails`, `audience_segments`
- ✅ `business_location_intelligence.category_scores`
- ✅ Weather API integration
- ✅ Published posts history (for recency tracking)

### Function Components

**1. Timing Calculator**
```javascript
calculateSuggestionTiming(now, openingTime, closingTime, effectiveClosing)
  → Returns: { idea1Time, idea2Time, idea3Time, count }
```

**2. Content Type Selector**
```javascript
selectContentType(timing, programmeStatus, minutesUntilClose)
  → Returns: 'OFFERING' | 'ATMOSPHERE'
```

**3. Behavioral Context Analyzer**
```javascript
analyzeBehavioralContext(time, weekday, weather, location)
  → Returns: { audienceSegment, decisionPattern, environmentalFit }
```

**4. Offering Selector**
```javascript
selectOptimalOffering(programme, audience, weather, rotationQueue)
  → Returns: { dish, rationale, targetTime }
```

**5. Atmosphere Content Generator**
```javascript
generateAtmosphereContent(atmosphereType, context)
  → Returns: { copy, rationale, timing }
```

**6. Rationale Assembler**
```javascript
assembleRationale(components, voiceGuardrails)
  → Returns: cleanedRationaleString
```

---

## Testing Scenarios

### Test 1: Full Day Coverage (Café Faust)
- Generation: Monday 07:00
- Expected: 3 ideas (OFFERING, OFFERING, ATMOSPHERE)

### Test 2: Late Morning (Café Faust)
- Generation: Monday 11:00
- Expected: 2-3 ideas (OFFERING, OFFERING/ATMOSPHERE, maybe ATMOSPHERE)

### Test 3: Evening Only (Dinner Restaurant)
- Generation: Tuesday 08:00
- Expected: 3 ideas (all anticipatory/ATMOSPHERE until 17:30)

### Test 4: Closed Day
- Generation: Monday (but closed that day)
- Expected: 1 ATMOSPHERE idea only

### Test 5: Late Night
- Generation: Saturday 22:00
- Expected: 1 ATMOSPHERE idea only

### Test 6: Early Closing
- Generation: Sunday 12:00 (closes 15:00)
- Expected: 1-2 ideas (limited time window)

---

## Success Metrics

**Structural Accuracy**:
- ✅ Correct number of ideas generated (1-3)
- ✅ Appropriate spacing (180 min minimum)
- ✅ Posting times honor business hours
- ✅ No food offerings when kitchen closed

**Behavioral Relevance**:
- ✅ Rationales reflect real decision patterns
- ✅ Audience segment selection matches timing
- ✅ Content type appropriate for time of day
- ✅ No "never featured" as primary driver

**Content Quality**:
- ✅ Voice guardrails applied
- ✅ Location USP included when relevant
- ✅ Clear CTA aligned with decision timing
- ✅ Weather context integrated naturally

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-06-22 | Initial specification combining dynamic count logic + behavioral analysis |

---

## Next Steps

1. **Review & Approve**: Stakeholder sign-off on logic flow
2. **Implement Core Calculator**: Build timing decision tree
3. **Integrate Behavioral Layer**: Add audience/context analysis
4. **Build Content Generators**: OFFERING and ATMOSPHERE selectors
5. **Test Edge Cases**: Validate all scenarios in testing section
6. **Deploy to Staging**: Test with real business data
7. **Monitor & Iterate**: Collect feedback, refine rationale quality

