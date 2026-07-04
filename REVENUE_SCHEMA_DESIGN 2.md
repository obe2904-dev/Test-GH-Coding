# Revenue Schema Design — AI-Inferred from Business Description

**Date**: 2026-06-07  
**Status**: Design Proposal  
**Principle**: AI analyzes business description → infers revenue moments → deterministic rules map to posting strategy

---

## Design Philosophy

### ❌ **Don't Do This** (Fixed Templates)
```typescript
if (business_type === 'cafe') {
  return CAFE_TEMPLATE; // Fails for "cafe with cocktail bar"
}
```

### ✅ **Do This** (AI-Inferred Revenue Moments)
```typescript
// AI reads: "Café... frokostservering fra kl. 9.00 til 17.30... Bar med cocktails og åbent til kl. 02 i weekenden"
const revenueDrivers = await analyzeBusinessDescription(business.about);
// Returns: [weekday_lunch, weekend_brunch, weekend_cocktail_bar, late_night_weekend]
```

**Why**: Handles hybrids (coffee & wine bar, bakery cafe, brunch restaurant with evening service, etc.)

---

## Revenue Schema Structure

### Stored in `business_brand_profile.revenue_drivers` (JSONB)

```typescript
interface RevenueDrivers {
  analyzed_at: string;              // ISO timestamp
  analyzed_from: string;            // Source: "business_about" or "service_periods" or "ai_inference"
  confidence_score: number;         // 0-100 (AI confidence in analysis)
  
  primary_revenue_moment: RevenueMoment;
  secondary_revenue_moments: RevenueMoment[];
  
  normal_week_strategy: {
    minimum_coverage: DayDistribution;
    preferred_days: string[];        // ["Monday", "Wednesday", "Thursday", "Saturday"]
    rationale: string;               // AI explanation
  };
}

interface RevenueMoment {
  moment_id: string;                 // "weekend_dinner" | "weekday_lunch" | "weekend_brunch" | "weekend_cocktails" | etc.
  label: string;                     // Human-readable: "Weekend aftensmad"
  importance: 'primary' | 'secondary' | 'tertiary';
  
  // Business context
  service_type: string;              // "brunch" | "lunch" | "dinner" | "cocktails" | "coffee" | "takeaway"
  days: string[];                    // ["Friday", "Saturday"]
  time_range: string;                // "19:00-22:00"
  
  // Customer behavior
  decision_pattern: 'advance_booking' | 'same_day_morning' | 'same_day_afternoon' | 'spontaneous';
  decision_windows: DecisionWindow[];
  typical_lead_time: string;         // "2-48 hours" | "same day" | "spontaneous"
  
  // Posting strategy
  post_timing_rules: PostTimingRule[];
  content_focus: string[];           // ["menu_items", "atmosphere", "reservation_cta"]
}

interface DecisionWindow {
  description: string;               // "Thursday afternoon browsing for weekend plans"
  days: string[];                    // ["Thursday", "Friday"]
  hours: string;                     // "14:00-18:00"
  conversion_strength: 'high' | 'medium' | 'low';
}

interface PostTimingRule {
  timing: string;                    // "Thursday 14:00" | "same_day 08:00" | "1_day_before 17:00"
  purpose: string;                   // "Drive weekend bookings" | "Day-of reminder"
  priority: 'required' | 'recommended' | 'optional';
}

interface DayDistribution {
  weekend_driver_posts: number;      // Min 1 Thu-Fri-Sat post for restaurants
  weekday_presence_posts: number;    // Min 1 Mon-Wed post
  brand_builder_posts: number;       // Min 1 Mon-Tue post
}
```

---

## Example 1: Cafe Faust (Hybrid Cafe + Bar)

### Business Description (Input)
```
"Café beliggende ved åen i Aarhus, der tilbyder brunch, frokost og 3-retters menuer. 
Frokostservering fra kl. 9.00 til 17.30 med retter som pariserbøf, bøf & bearnaise og falafelsalat. 
Bar med cocktails og åbent til kl. 02 i weekenden. 
Der er udendørs siddepladser og mulighed for takeaway."
```

### AI Analysis Prompt
```
Analyze this business description and extract revenue moments:

BUSINESS: "{business_about}"

Identify:
1. Service types offered (brunch, lunch, dinner, bar, coffee, etc.)
2. Operating hours and days for each service
3. When customers likely DECIDE to visit for each service
4. Primary vs secondary revenue drivers

Output JSON with revenue moments ranked by business importance.
```

### AI-Inferred Revenue Schema (Output)
```json
{
  "analyzed_at": "2026-06-07T10:00:00Z",
  "analyzed_from": "business_about",
  "confidence_score": 92,
  
  "primary_revenue_moment": {
    "moment_id": "weekend_dinner_cocktails",
    "label": "Weekend aftensmad og cocktails",
    "importance": "primary",
    "service_type": "dinner_and_bar",
    "days": ["Friday", "Saturday"],
    "time_range": "17:30-02:00",
    "decision_pattern": "same_day_afternoon",
    "decision_windows": [
      {
        "description": "Thursday-Friday afternoon planning for weekend dining",
        "days": ["Thursday", "Friday"],
        "hours": "14:00-18:00",
        "conversion_strength": "high"
      },
      {
        "description": "Same-day evening spontaneous decisions",
        "days": ["Friday", "Saturday"],
        "hours": "17:00-20:00",
        "conversion_strength": "medium"
      }
    ],
    "typical_lead_time": "same day to 24 hours",
    "post_timing_rules": [
      {
        "timing": "Thursday 14:00",
        "purpose": "Prime weekend dinner intent for Fri-Sat",
        "priority": "required"
      },
      {
        "timing": "Friday 14:00",
        "purpose": "Drive Saturday bookings + Friday same-day",
        "priority": "required"
      },
      {
        "timing": "Saturday 08:00",
        "purpose": "Weekend brunch reminder + evening preview",
        "priority": "recommended"
      }
    ],
    "content_focus": ["menu_items", "cocktails", "riverside_atmosphere", "reservation_cta"]
  },
  
  "secondary_revenue_moments": [
    {
      "moment_id": "weekday_lunch",
      "label": "Frokost i hverdagene",
      "importance": "secondary",
      "service_type": "lunch",
      "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "time_range": "09:00-17:30",
      "decision_pattern": "same_day_morning",
      "decision_windows": [
        {
          "description": "Morning decision for lunch plans",
          "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          "hours": "08:00-11:00",
          "conversion_strength": "medium"
        }
      ],
      "typical_lead_time": "same day",
      "post_timing_rules": [
        {
          "timing": "same_day 08:00-10:00",
          "purpose": "Drive same-day lunch traffic",
          "priority": "recommended"
        }
      ],
      "content_focus": ["lunch_menu", "quick_service", "takeaway_option", "outdoor_seating"]
    },
    {
      "moment_id": "weekend_brunch",
      "label": "Weekend brunch ved åen",
      "importance": "secondary",
      "service_type": "brunch",
      "days": ["Saturday", "Sunday"],
      "time_range": "09:00-14:00",
      "decision_pattern": "same_day_morning",
      "decision_windows": [
        {
          "description": "Same-day morning brunch planning",
          "days": ["Saturday", "Sunday"],
          "hours": "08:00-10:30",
          "conversion_strength": "high"
        }
      ],
      "typical_lead_time": "same day",
      "post_timing_rules": [
        {
          "timing": "same_day 08:00",
          "purpose": "Capture morning brunch decisions",
          "priority": "recommended"
        }
      ],
      "content_focus": ["brunch_dishes", "riverside_view", "weekend_atmosphere"]
    },
    {
      "moment_id": "late_night_weekend_bar",
      "label": "Sen weekend bar (indtil kl. 02)",
      "importance": "tertiary",
      "service_type": "cocktail_bar",
      "days": ["Friday", "Saturday"],
      "time_range": "22:00-02:00",
      "decision_pattern": "spontaneous",
      "decision_windows": [
        {
          "description": "Evening spontaneous bar decisions",
          "days": ["Friday", "Saturday"],
          "hours": "20:00-23:00",
          "conversion_strength": "low"
        }
      ],
      "typical_lead_time": "spontaneous",
      "post_timing_rules": [
        {
          "timing": "Friday 18:00",
          "purpose": "Seed awareness for late-night option",
          "priority": "optional"
        }
      ],
      "content_focus": ["cocktails", "bar_atmosphere", "late_night_vibe"]
    }
  ],
  
  "normal_week_strategy": {
    "minimum_coverage": {
      "weekend_driver_posts": 2,
      "weekday_presence_posts": 1,
      "brand_builder_posts": 1
    },
    "preferred_days": ["Monday", "Wednesday", "Thursday", "Saturday"],
    "rationale": "Monday brand-builder (awareness start-of-week), Wednesday weekday lunch presence, Thursday weekend dinner driver (prime booking window), Saturday brunch + evening reminder. This covers primary revenue moment (weekend dinner/cocktails) while maintaining weekday lunch visibility."
  }
}
```

---

## Example 2: Pure Coffee Shop

### Business Description
```
"Specialty coffee shop i København. Espresso bar med single-origin kaffe og hjemmebagt kage. 
Åbent 07:30-17:00 mandag-fredag, 09:00-16:00 lørdag. Fokus på morgenmøder og frokostpauser."
```

### AI-Inferred Revenue Schema
```json
{
  "primary_revenue_moment": {
    "moment_id": "weekday_morning_coffee",
    "label": "Morgenkaffe og møder",
    "service_type": "coffee",
    "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "time_range": "07:30-11:00",
    "decision_pattern": "same_day_morning",
    "post_timing_rules": [
      {
        "timing": "same_day 07:00-08:00",
        "purpose": "Capture morning routine decisions",
        "priority": "required"
      }
    ]
  },
  "secondary_revenue_moments": [
    {
      "moment_id": "weekday_lunch_break",
      "label": "Frokostpause med kaffe og kage",
      "service_type": "coffee_and_pastries",
      "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "time_range": "11:00-14:00",
      "decision_pattern": "spontaneous",
      "post_timing_rules": [
        {
          "timing": "same_day 10:30-11:30",
          "purpose": "Remind for lunch break option",
          "priority": "recommended"
        }
      ]
    }
  ],
  "normal_week_strategy": {
    "minimum_coverage": {
      "weekend_driver_posts": 0,
      "weekday_presence_posts": 3,
      "brand_builder_posts": 1
    },
    "preferred_days": ["Monday", "Tuesday", "Thursday", "Saturday"],
    "rationale": "Mon-Tue-Thu morning posts for weekday coffee routine, Saturday post for weekend visitors. No weekend drivers needed (primary revenue is weekday mornings)."
  }
}
```

---

## Example 3: Bakery with Cafe (Hybrid)

### Business Description
```
"Håndværksbageri med cafe-hjørne. Friskbagt brød fra kl. 06:00, cafe åbner kl. 08:00. 
Frokost-sandwiches 11:00-15:00. Populært weekend-brunch. Takeaway og catering tilgængeligt."
```

### AI-Inferred Revenue Schema
```json
{
  "primary_revenue_moment": {
    "moment_id": "morning_bakery_rush",
    "label": "Morgen-brød og kaffe",
    "service_type": "bakery_and_coffee",
    "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    "time_range": "06:00-09:00",
    "decision_pattern": "same_day_morning",
    "post_timing_rules": [
      {
        "timing": "same_day 06:00-07:00",
        "purpose": "Catch morning bakery run decisions",
        "priority": "required"
      }
    ],
    "content_focus": ["fresh_bread", "morning_pastries", "coffee"]
  },
  "secondary_revenue_moments": [
    {
      "moment_id": "weekend_brunch",
      "label": "Weekend brunch i cafe-hjørnet",
      "service_type": "brunch",
      "days": ["Saturday", "Sunday"],
      "time_range": "08:00-14:00",
      "decision_pattern": "same_day_morning",
      "post_timing_rules": [
        {
          "timing": "same_day 07:30",
          "purpose": "Weekend brunch decision capture",
          "priority": "required"
        }
      ],
      "content_focus": ["brunch_setup", "fresh_pastries", "cafe_atmosphere"]
    },
    {
      "moment_id": "weekday_lunch",
      "label": "Frokost-sandwiches",
      "service_type": "lunch",
      "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "time_range": "11:00-15:00",
      "decision_pattern": "same_day_morning",
      "post_timing_rules": [
        {
          "timing": "same_day 10:00-11:00",
          "purpose": "Lunch sandwich reminder",
          "priority": "recommended"
        }
      ],
      "content_focus": ["sandwich_menu", "takeaway"]
    }
  ],
  "normal_week_strategy": {
    "minimum_coverage": {
      "weekend_driver_posts": 1,
      "weekday_presence_posts": 2,
      "brand_builder_posts": 1
    },
    "preferred_days": ["Monday", "Wednesday", "Friday", "Saturday"],
    "rationale": "Daily morning presence critical (bakery), Sat brunch driver, weekday lunch reminders. Hybrid needs both daily bakery visibility AND weekend brunch focus."
  }
}
```

---

## Event Type Taxonomy

### Categories with Posting Strategies

```typescript
interface EventType {
  category: 'advance_booking' | 'same_day' | 'multi_day' | 'reactive';
  posting_strategy: PostingStrategy;
}

const EVENT_TAXONOMY = {
  // 1. ADVANCE-BOOKING EVENTS (reservations made days/weeks ahead)
  advance_booking: {
    examples: [
      "Valentines Day",
      "Mors Dag",
      "Fars Dag", 
      "Nytårsaften",
      "Private events (birthdays, anniversaries)"
    ],
    customer_behavior: "Plans 3-7 days ahead, books table in advance",
    posting_strategy: {
      lead_time: "5-7 days before",
      post_sequence: [
        { timing: "-7 days 10:00", purpose: "Announce availability", priority: "recommended" },
        { timing: "-5 days 14:00", purpose: "Drive reservations", priority: "required" },
        { timing: "-3 days 17:00", purpose: "Last call for bookings", priority: "required" },
        { timing: "-1 day 10:00", purpose: "Final reminder + walk-in option", priority: "optional" }
      ],
      content_focus: ["special_menu", "atmosphere", "reservation_cta", "limited_availability"]
    }
  },
  
  // 2. SAME-DAY EVENTS (holiday dining, decide morning-of)
  same_day: {
    examples: [
      "Grundlovsdag",
      "Kristi Himmelfartsdag", 
      "Pinsedag",
      "1. juledag",
      "Easter Monday"
    ],
    customer_behavior: "Decides same morning or day-before evening",
    posting_strategy: {
      lead_time: "1 day before + same day",
      post_sequence: [
        { timing: "-1 day 14:00", purpose: "Prime intent for holiday lunch/dinner", priority: "required" },
        { timing: "same_day 08:00", purpose: "Day-of availability reminder", priority: "required" },
        { timing: "same_day 11:00", purpose: "Last-minute walk-in invitation", priority: "optional" }
      ],
      content_focus: ["holiday_menu", "opening_hours", "walk_in_welcome", "festive_atmosphere"]
    }
  },
  
  // 3. MULTI-DAY PERIODS (span several days)
  multi_day: {
    examples: [
      "Easter weekend (Thu-Mon)",
      "Christmas period (Dec 23-26)",
      "School vacation weeks",
      "Long weekend (bridge days)"
    ],
    customer_behavior: "Multiple visit opportunities across period",
    posting_strategy: {
      lead_time: "Start 2 days before, post throughout",
      post_sequence: [
        { timing: "-2 days 14:00", purpose: "Announce period availability", priority: "required" },
        { timing: "day_1 08:00", purpose: "Period start reminder", priority: "required" },
        { timing: "day_3 10:00", purpose: "Mid-period presence", priority: "recommended" },
        { timing: "day_5 08:00", purpose: "Final days reminder", priority: "optional" }
      ],
      content_focus: ["period_menu", "daily_specials", "extended_hours", "vacation_atmosphere"]
    }
  },
  
  // 4. REACTIVE EVENTS (weather, sports, breaking context)
  reactive: {
    examples: [
      "First warm day (>20°C after cold spell)",
      "Sudden rainy weekend",
      "Major sports event (Denmark match, Olympics)",
      "Breaking local event"
    ],
    customer_behavior: "Spontaneous, reacts to immediate context",
    posting_strategy: {
      lead_time: "Same day, fast reaction",
      post_sequence: [
        { timing: "as_soon_as_detected", purpose: "Capitalize on moment", priority: "required" },
        { timing: "peak_window -2 hours", purpose: "Drive immediate action", priority: "required" }
      ],
      content_focus: ["context_relevant", "immediate_availability", "spontaneous_invitation"]
    }
  }
};
```

### Event Classification Rules

```typescript
function classifyEvent(event: CalendarEvent): EventType {
  // Check event metadata first
  if (event.advance_booking_typical) return 'advance_booking';
  if (event.type === 'weather_trigger') return 'reactive';
  
  // Use commercial_weight + type
  if (event.type === 'holiday') {
    // High-ceremony holidays = advance booking (Valentines, NYE)
    if (event.name.includes('Valentin') || event.name.includes('Nytår') || event.name.includes('Mor') || event.name.includes('Far')) {
      return 'advance_booking';
    }
    // Public holidays = same-day (Grundlovsdag, Pinse, etc.)
    return 'same_day';
  }
  
  // Multi-day vacation periods
  if (event.type === 'school_vacation' || (event.date_end && daysBetween(event.date, event.date_end) >= 3)) {
    return 'multi_day';
  }
  
  // Bridge days (single holiday creating long weekend)
  if (event.typical_bridge_day) {
    return 'multi_day'; // Treat as mini-period
  }
  
  return 'same_day'; // Safe default
}
```

---

## Business Rules Engine Architecture

### Layer Between Phase 1 (AI) and Phase 2a (Day Allocation)

```typescript
interface BusinessRulesEngine {
  // INPUT: AI-generated strategic angles from Phase 1
  analyzeAngles(angles: StrategicAngle[], context: WeekContext): DayAllocationPlan;
}

interface DayAllocationPlan {
  posts: PlannedPost[];
  rationale: string;
  adjustments_from_normal: Adjustment[];
}

interface PlannedPost {
  angle_id: number;              // Links back to Phase 1 angle
  revenue_moment: string;        // "weekend_dinner" | "weekday_lunch" etc.
  target_day: string;            // "Thursday" | "same_day" | "1_day_before_event"
  target_time: string;           // "14:00" | "08:00-10:00" (window)
  purpose: string;               // "Drive weekend dinner bookings"
  priority: 'required' | 'recommended' | 'optional';
}

interface Adjustment {
  from: string;                  // "normal_week Monday brand-builder"
  to: string;                    // "Thursday event lead-up"
  reason: string;                // "Grundlovsdag Friday requires Thu lead-up post"
}
```

### Engine Logic Flow

```typescript
async function businessRulesEngine(
  angles: StrategicAngle[],
  context: WeekContext,
  revenueDrivers: RevenueDrivers
): Promise<DayAllocationPlan> {
  
  const plan: PlannedPost[] = [];
  const adjustments: Adjustment[] = [];
  
  // STEP 1: Check for events and classify
  const events = context.events || [];
  const eventTypes = events.map(e => ({
    event: e,
    type: classifyEvent(e),
    taxonomy: EVENT_TAXONOMY[classifyEvent(e)]
  }));
  
  // STEP 2: Determine if this is event week or normal week
  const isEventWeek = eventTypes.some(et => 
    et.type === 'advance_booking' || 
    et.type === 'same_day' || 
    et.type === 'multi_day'
  );
  
  if (isEventWeek) {
    // EVENT WEEK: Build plan from event posting strategies
    for (const { event, type, taxonomy } of eventTypes) {
      const eventPlan = buildEventPostingPlan(event, type, taxonomy, angles, context);
      plan.push(...eventPlan.posts);
      adjustments.push(...eventPlan.adjustments);
    }
    
    // Fill remaining slots with normal_week secondary moments
    const remainingSlots = context.target_post_count - plan.length;
    if (remainingSlots > 0) {
      const fillerPosts = selectSecondaryMoments(
        revenueDrivers.secondary_revenue_moments,
        remainingSlots,
        plan // avoid conflicts
      );
      plan.push(...fillerPosts);
    }
    
  } else {
    // NORMAL WEEK: Use brand profile normal_week_strategy
    const normalStrategy = revenueDrivers.normal_week_strategy;
    
    // Primary revenue moment gets priority
    const primaryPosts = buildRevenueMomentPlan(
      revenueDrivers.primary_revenue_moment,
      normalStrategy.minimum_coverage.weekend_driver_posts,
      angles,
      context
    );
    plan.push(...primaryPosts);
    
    // Secondary moments fill remaining slots
    const secondarySlots = context.target_post_count - plan.length;
    const secondaryPosts = distributeSecondaryMoments(
      revenueDrivers.secondary_revenue_moments,
      secondarySlots,
      normalStrategy,
      angles,
      context
    );
    plan.push(...secondaryPosts);
  }
  
  // STEP 3: Validate coverage (weekend driver, weekday presence, brand builder)
  const validation = validateCoverage(plan, revenueDrivers.normal_week_strategy.minimum_coverage);
  if (!validation.passed) {
    // Auto-correct: add missing coverage posts
    plan.push(...validation.required_additions);
    adjustments.push(...validation.adjustments);
  }
  
  // STEP 4: Apply contextual modifiers (weather, season)
  if (context.weather?.pattern === 'rainy_weekend') {
    // Boost weekend driver posts (indoor dining opportunity)
    adjustWeatherSensitivePosts(plan, 'boost_weekend', adjustments);
  }
  
  return {
    posts: plan,
    rationale: generateRationale(plan, isEventWeek, eventTypes),
    adjustments_from_normal: adjustments
  };
}
```

### Example: Event Week (Grundlovsdag)

**Input**:
- Event: Grundlovsdag Friday June 5
- Event type: `same_day`
- Angles from Phase 1: ["Weekend indoor dining", "Brunch opportunity", "Brand builder"]

**Business Rules Engine Output**:
```typescript
{
  posts: [
    {
      angle_id: 1,
      revenue_moment: "weekend_dinner",
      target_day: "Thursday",          // -1 day from event
      target_time: "14:00",
      purpose: "Prime Grundlovsdag lunch intent",
      priority: "required"
    },
    {
      angle_id: 1,
      revenue_moment: "weekend_dinner",
      target_day: "Friday",            // Same day
      target_time: "08:00",
      purpose: "Day-of Grundlovsdag reminder",
      priority: "required"
    },
    {
      angle_id: 2,
      revenue_moment: "weekend_brunch",
      target_day: "Saturday",
      target_time: "08:00",
      purpose: "Weekend brunch presence",
      priority: "recommended"
    },
    {
      angle_id: 3,
      revenue_moment: "brand_builder",
      target_day: "Monday",
      target_time: "09:00",
      purpose: "Start-of-week brand awareness",
      priority: "optional"
    }
  ],
  rationale: "Grundlovsdag Friday (same-day holiday) requires Thursday lead-up + Friday day-of posts. Added Saturday brunch and Monday brand-builder for full week coverage.",
  adjustments_from_normal: [
    {
      from: "Normal week: Monday + Wednesday + Thursday + Saturday",
      to: "Event week: Monday + Thursday + Friday + Saturday",
      reason: "Grundlovsdag same-day event strategy: add Friday day-of post, drop Wednesday"
    }
  ]
}
```

**Phase 2a receives**: Clear day targets (Mon, Thu, Fri, Sat) with times and purposes

---

## AI Revenue Driver Analyzer

### Prompt Template for Analyzing Business Description

```typescript
const REVENUE_ANALYSIS_PROMPT = `
Analyze this business description and extract revenue moments.

BUSINESS DESCRIPTION:
{business_about}

SERVICE PERIODS (from profile):
{service_periods}

OPERATING HOURS (if known):
{opening_hours}

Your task:
1. Identify ALL distinct revenue moments (e.g., "weekend dinner", "weekday lunch", "morning coffee", "late-night bar")
2. For EACH moment, determine:
   - What service type? (brunch/lunch/dinner/coffee/cocktails/bakery/etc.)
   - Which days? (specific days or weekday/weekend pattern)
   - What time range?
   - When do customers DECIDE to visit? (advance, same-day morning, same-day afternoon, spontaneous)
   - What's the typical lead time? (days ahead, same day, hours ahead)
3. Rank moments by business importance (primary/secondary/tertiary)
4. For the PRIMARY moment, define posting rules:
   - When should posts appear to capture customer decision windows?
   - Required vs recommended timing

Output JSON following RevenueDrivers schema.

CRITICAL FOR HYBRIDS:
- If business offers BOTH coffee and cocktails → identify as separate revenue moments
- If "bakery with cafe" → identify morning bakery rush + cafe lunch as distinct moments
- If "brunch and dinner" → identify weekend brunch + weekend dinner as separate moments

Example: "Cafe with cocktail bar open until 2am weekends"
→ Extract: weekday_lunch (secondary) + weekend_dinner_cocktails (primary) + late_night_bar (tertiary)

Be specific about decision windows. "Weekend dinner" typically has Thu 14-18 and Fri 09-17 decision windows.
`;
```

### When to Run Analysis

1. **Initial setup**: When business_about is first added
2. **On profile update**: When business_about or service_periods change
3. **Quarterly refresh**: Re-analyze to catch seasonal changes
4. **Manual trigger**: User can request re-analysis

### Confidence Score

AI outputs `confidence_score: 0-100`:
- **90-100**: Clear description, multiple service periods mentioned, hours specified
- **70-89**: Good description, some ambiguity
- **50-69**: Sparse description, inferred from service_periods only
- **<50**: Insufficient data, fall back to manual input or generic template

---

## Integration with Existing System

### Changes Required

1. **Database Schema**:
```sql
ALTER TABLE business_brand_profile 
ADD COLUMN revenue_drivers JSONB;

CREATE INDEX idx_business_brand_profile_revenue_drivers 
ON business_brand_profile USING GIN (revenue_drivers);
```

2. **AI Analysis Function** (new):
```typescript
// supabase/functions/analyze-revenue-drivers/index.ts
export async function analyzeRevenueDrivers(
  business_id: string,
  business_about: string,
  service_periods: string[]
): Promise<RevenueDrivers>
```

3. **Business Rules Engine** (new layer):
```typescript
// supabase/functions/_shared/post-helpers/business-rules-engine.ts
export function businessRulesEngine(
  angles: StrategicAngle[],
  context: WeekContext,
  revenueDrivers: RevenueDrivers
): Promise<DayAllocationPlan>
```

4. **Phase 2a Modified**:
```typescript
// Instead of BASE_SLOTS template, receives DayAllocationPlan
const plan = await businessRulesEngine(strategicBrief.angles, context, revenueDrivers);
const enrichedPlan = assignSpecificDates(plan, context.available_days);
```

---

## Next Steps

1. **Validate Schema**: Does this structure capture all hybrid cases?
2. **Build AI Analyzer**: Implement revenue driver analysis prompt
3. **Build Rules Engine**: Implement business rules logic
4. **Test with Real Businesses**:
   - Pure cafe (simple case)
   - Cafe Faust (hybrid cafe + bar)
   - Bakery with cafe (hybrid)
   - Coffee & wine bar (hybrid)
   - Brunch restaurant with dinner service (hybrid)

---

## Questions

1. Should `revenue_drivers` be **auto-generated once and stored**, or **re-analyzed each week**?
   - Recommendation: Generate once, store, re-analyze on profile updates or quarterly

2. Should users be able to **manually edit** AI-generated revenue drivers?
   - Recommendation: Yes, with UI to review and adjust (AI can be wrong)

3. For **seasonal businesses** (summer terrace, winter comfort food), should we have **seasonal revenue drivers**?
   - Recommendation: Yes, store `revenue_drivers_summer` and `revenue_drivers_winter` if business indicates seasonal shifts

4. Should **event taxonomy** be stored in database or remain code-only?
   - Recommendation: Code-only (consistent logic), but event metadata can include `posting_strategy_override`
