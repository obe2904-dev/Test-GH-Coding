# Weekly Plan Full Architecture - Implementation Plan

**Date:** 2026-06-08  
**Status:** In Progress  
**Estimated Time:** 4-6 hours  
**Complexity:** ★★★★★ (Very High)

---

## Context

**Completed:**
- ✅ Phase 0: Database migrations (metadata columns added)
- ✅ Phase 1: TypeScript utilities (rotation queue, service period detector)
- ✅ Option A: Rotation queue integrated into Quick Suggestions

**Goal:**
Transform Weekly Plan from calendar-first templates to business-first revenue-driven day allocation system.

---

## Problem Statement

### Current Behavior (Calendar-First)
```typescript
// Hardcoded slots in phase1.ts
const BASE_SLOTS = [
  { slot_id: 'A', timing_window: 'Fri-Sat 14:00' },  // ← Calendar position
  { slot_id: 'B', timing_window: 'Wed-Thu 11:00' },
  { slot_id: 'C', timing_window: 'Mon 09:00' },
  { slot_id: 'D', timing_window: 'any' }
];
```

**Result:** Week 24 posts on Mon/Tue/Wed/Sat → **Misses Thu-Fri dinner drivers**

### Desired Behavior (Business-First)
```typescript
// Revenue drivers from brand profile
const revenueDrivers = {
  primary: {
    moment: 'weekend_dinner',
    decision_window: 'Thu 14:00 - Fri 17:00',  // ← When guests decide
    post_timing: 'Thu 14:00, Fri 14:00'        // ← When to post
  }
};
```

**Result:** Posts on Thu/Fri to drive weekend dinner bookings

---

## Architecture Overview

### Three-Layer System

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Brand Profile (Data Schema)                       │
│ - revenue_drivers: Define business moments                 │
│ - normal_week_post_distribution: Default patterns          │
│ - decision_windows: When customers decide vs visit         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Business Rules Engine (Deterministic Logic)       │
│ - Event type classifier (advance-booking vs same-day)      │
│ - Decision window calculator                               │
│ - Day allocation mapper (business moment → post timing)    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Phase 2a Content Planner (Execution)              │
│ - Receives revenue-driven slots from Phase 1               │
│ - Uses business rules to assign days                       │
│ - Event-aware posting (day-of + lead-up)                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase A: Schema & Data Model (1-1.5 hours)

#### A1. Revenue Drivers Schema Design

**File:** Create `_SCHEMA_revenue_drivers.sql`

**Schema:**
```sql
-- Add to brand_profile_v5.revenue_drivers JSONB
{
  "primary": {
    "moment": "weekend_dinner",
    "description": "Friday-Saturday evening dining (19:00-22:00)",
    "days": ["Friday", "Saturday"],
    "service_periods": ["dinner"],
    "decision_window": {
      "type": "advance_booking",
      "starts": "Thursday 14:00",
      "ends": "Friday 17:00",
      "peak_hours": ["Thursday 16:00-18:00", "Friday 10:00-13:00"]
    },
    "post_timing": {
      "recommended_posts": [
        { "day": "Thursday", "time": "14:00", "angle": "weekend_preview" },
        { "day": "Friday", "time": "14:00", "angle": "tonight_reminder" }
      ],
      "minimum_posts": 1,
      "maximum_posts": 2
    },
    "commercial_weight": 0.45
  },
  "secondary": {
    "moment": "weekday_lunch",
    "description": "Monday-Friday lunch service (12:00-15:00)",
    "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "service_periods": ["lunch"],
    "decision_window": {
      "type": "same_day",
      "starts": "Same day 08:00",
      "ends": "Same day 11:30",
      "peak_hours": ["09:30-10:30"]
    },
    "post_timing": {
      "recommended_posts": [
        { "day": "Monday", "time": "09:00", "angle": "today_menu" },
        { "day": "Wednesday", "time": "09:00", "angle": "midweek_break" }
      ],
      "minimum_posts": 1,
      "maximum_posts": 2
    },
    "commercial_weight": 0.30
  },
  "tertiary": {
    "moment": "weekend_brunch",
    "description": "Saturday-Sunday morning brunch (09:00-14:00)",
    "days": ["Saturday", "Sunday"],
    "service_periods": ["brunch"],
    "decision_window": {
      "type": "same_day",
      "starts": "Same day 08:00",
      "ends": "Same day 10:00",
      "peak_hours": ["08:30-09:30"]
    },
    "post_timing": {
      "recommended_posts": [
        { "day": "Saturday", "time": "08:00", "angle": "weekend_start" }
      ],
      "minimum_posts": 0,
      "maximum_posts": 1
    },
    "commercial_weight": 0.25
  },
  "normal_week_strategy": {
    "minimum_coverage": {
      "weekend_driver": 1,
      "weekday_presence": 1,
      "brand_builder": 1
    },
    "preferred_day_pattern": ["Monday", "Thursday", "Friday", "Saturday"],
    "avoid_patterns": {
      "consecutive_days": 2,
      "weekend_gap": false
    }
  }
}
```

**Migration SQL:**
```sql
-- Add Cafe Faust revenue drivers
UPDATE brand_profile_v5
SET revenue_drivers = '{
  "primary": { ... },
  "secondary": { ... },
  "tertiary": { ... },
  "normal_week_strategy": { ... }
}'::jsonb
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
```

#### A2. Event Type Taxonomy

**File:** Create `supabase/functions/_shared/content-planning/event-classifier.ts`

**Event Types:**
```typescript
export type EventType = 
  | 'advance_booking'   // Valentines, Mors Dag (book 3-7 days ahead)
  | 'same_day'          // Grundlovsdag, Easter Monday (decide morning-of)
  | 'multi_day'         // Easter weekend, Christmas week (span period)
  | 'reactive'          // Weather, spontaneous (post day-of)
  | 'season_start';     // Summer break begins, school vacation

export interface EventClassification {
  event_name: string;
  event_type: EventType;
  event_date: string;
  posting_strategy: {
    lead_posts: number;          // How many days before
    day_of_post: boolean;        // Post on actual day?
    follow_up_post: boolean;     // Post day after?
    recommended_days: string[];  // Specific posting days
  };
}
```

**Classifier Logic:**
```typescript
export function classifyEvent(event: {
  name: string;
  date: string;
  category?: string;
}): EventClassification {
  // Commercial holidays (reservations)
  if (['valentines', 'mors_dag', 'fars_dag'].includes(event.name.toLowerCase())) {
    return {
      event_type: 'advance_booking',
      posting_strategy: {
        lead_posts: 5,
        day_of_post: false,
        recommended_days: ['-5', '-3', '-1'] // 5, 3, 1 days before
      }
    };
  }
  
  // National holidays (same-day decisions)
  if (['grundlovsdag', 'easter_monday'].includes(event.name.toLowerCase())) {
    return {
      event_type: 'same_day',
      posting_strategy: {
        lead_posts: 2,
        day_of_post: true,
        recommended_days: ['-1', '0'] // Day before + day of
      }
    };
  }
  
  // Multi-day periods
  if (['easter_weekend', 'christmas_week'].includes(event.name.toLowerCase())) {
    return {
      event_type: 'multi_day',
      posting_strategy: {
        lead_posts: 2,
        day_of_post: true,
        recommended_days: ['-2', '0', '+2'] // Before, during, after
      }
    };
  }
  
  // Default: same-day
  return {
    event_type: 'same_day',
    posting_strategy: {
      lead_posts: 1,
      day_of_post: true,
      recommended_days: ['-1', '0']
    }
  };
}
```

---

### Phase B: Business Rules Engine (1.5-2 hours)

#### B1. Decision Window Calculator

**File:** `supabase/functions/_shared/content-planning/decision-window-calculator.ts`

**Purpose:** Calculate when to post based on when customers decide

```typescript
export interface BusinessMoment {
  moment: string;              // 'weekend_dinner'
  visit_days: string[];        // ['Friday', 'Saturday']
  decision_window: {
    type: 'advance_booking' | 'same_day' | 'impulse';
    starts: string;            // 'Thursday 14:00'
    ends: string;              // 'Friday 17:00'
  };
}

export interface PostingRecommendation {
  recommended_post_days: string[];  // ['Thursday', 'Friday']
  recommended_times: string[];      // ['14:00', '14:00']
  reasoning: string;
}

export function calculatePostTiming(
  moment: BusinessMoment,
  weekContext: { startDate: string; events?: any[] }
): PostingRecommendation {
  const { decision_window, visit_days } = moment;
  
  if (decision_window.type === 'advance_booking') {
    // Post during decision window, not visit window
    // Example: Thu 14:00 post drives Fri-Sat dinner
    return {
      recommended_post_days: extractDaysFromWindow(decision_window.starts),
      recommended_times: extractTimesFromWindow(decision_window.starts),
      reasoning: `Guests book ${moment.moment} during ${decision_window.starts} to ${decision_window.ends}`
    };
  }
  
  if (decision_window.type === 'same_day') {
    // Post morning-of for lunch/brunch
    return {
      recommended_post_days: visit_days,
      recommended_times: ['08:00', '09:00'],
      reasoning: `Same-day decisions for ${moment.moment} - post early on visit days`
    };
  }
  
  // Impulse (walk-in traffic)
  return {
    recommended_post_days: visit_days,
    recommended_times: ['10:00'],
    reasoning: `Walk-in traffic for ${moment.moment} - post mid-morning`
  };
}
```

#### B2. Revenue-Driven Slot Generator

**File:** Update `supabase/functions/_shared/post-helpers/strategy/phase1.ts`

**Replace BASE_SLOTS_FALLBACK with:**
```typescript
export function generateSlotsFromRevenueDrivers(
  revenueDrivers: RevenueDrivers,
  postCount: number
): SlotTemplate[] {
  const slots: SlotTemplate[] = [];
  
  const { primary, secondary, tertiary, normal_week_strategy } = revenueDrivers;
  
  // Slot A: Primary revenue driver
  if (primary && postCount >= 1) {
    const timing = primary.post_timing.recommended_posts[0];
    slots.push({
      slot_id: 'A',
      goal_mode: 'drive_footfall',
      timing_window: `${timing.day} ${timing.time}`,
      content_angle: timing.angle,
      revenue_moment: primary.moment,
      commercial_weight: primary.commercial_weight
    });
  }
  
  // Slot B: Secondary revenue driver OR brand builder
  if (postCount >= 2) {
    if (secondary) {
      const timing = secondary.post_timing.recommended_posts[0];
      slots.push({
        slot_id: 'B',
        goal_mode: 'drive_footfall',
        timing_window: `${timing.day} ${timing.time}`,
        content_angle: timing.angle,
        revenue_moment: secondary.moment,
        commercial_weight: secondary.commercial_weight
      });
    } else {
      slots.push({
        slot_id: 'B',
        goal_mode: 'build_brand',
        timing_window: 'Monday 09:00',
        commercial_weight: 0.2
      });
    }
  }
  
  // Slot C: Third driver OR flexible
  if (postCount >= 3) {
    const preferredDays = normal_week_strategy?.preferred_day_pattern || ['Monday'];
    slots.push({
      slot_id: 'C',
      goal_mode: 'build_brand',
      timing_window: `${preferredDays[0]} 09:00`,
      commercial_weight: 0.15
    });
  }
  
  // Slot D+: Flexible retention/engagement
  for (let i = 3; i < postCount; i++) {
    slots.push({
      slot_id: String.fromCharCode(68 + i - 3), // D, E, F...
      goal_mode: 'retain_loyalty',
      timing_window: 'any',
      commercial_weight: 0.1
    });
  }
  
  return slots;
}
```

#### B3. Business Rules Engine Core

**File:** `supabase/functions/_shared/content-planning/business-rules-engine.ts`

```typescript
export interface DayAllocationRule {
  business_moment: string;
  visit_days: string[];
  post_days: string[];
  post_times: string[];
  priority: number;
}

export class BusinessRulesEngine {
  constructor(private revenueDrivers: RevenueDrivers) {}
  
  /**
   * Generate day allocation rules for a week
   */
  generateWeeklyAllocationRules(
    weekContext: {
      startDate: string;
      events: any[];
      isNormalWeek: boolean;
    }
  ): DayAllocationRule[] {
    const rules: DayAllocationRule[] = [];
    
    // 1. Primary revenue driver (highest priority)
    if (this.revenueDrivers.primary) {
      rules.push(this.createRuleFromDriver(
        this.revenueDrivers.primary,
        weekContext,
        1 // priority
      ));
    }
    
    // 2. Secondary revenue driver
    if (this.revenueDrivers.secondary) {
      rules.push(this.createRuleFromDriver(
        this.revenueDrivers.secondary,
        weekContext,
        2
      ));
    }
    
    // 3. Event-specific rules (if event week)
    if (!weekContext.isNormalWeek && weekContext.events.length > 0) {
      for (const event of weekContext.events) {
        const eventRule = this.createEventRule(event, weekContext);
        rules.push(eventRule);
      }
    }
    
    return rules.sort((a, b) => a.priority - b.priority);
  }
  
  private createRuleFromDriver(
    driver: RevenueDriver,
    context: any,
    priority: number
  ): DayAllocationRule {
    const postTiming = calculatePostTiming(driver, context);
    
    return {
      business_moment: driver.moment,
      visit_days: driver.days,
      post_days: postTiming.recommended_post_days,
      post_times: postTiming.recommended_times,
      priority
    };
  }
  
  private createEventRule(
    event: any,
    context: any
  ): DayAllocationRule {
    const classification = classifyEvent(event);
    
    return {
      business_moment: `event_${event.name}`,
      visit_days: [event.date],
      post_days: classification.posting_strategy.recommended_days,
      post_times: this.getEventPostTimes(classification),
      priority: 0.5 // Higher than normal drivers
    };
  }
}
```

---

### Phase C: Phase 2a Content Planner Overhaul (1.5-2 hours)

#### C1. Update Phase 2a Day Assignment

**File:** `supabase/functions/_shared/post-helpers/strategy/phase2/phase2a.ts`

**Current Logic (lines 88-285):** Calendar-first greedy allocation

**New Logic:** Business-rules-driven allocation

```typescript
import { BusinessRulesEngine } from '../../content-planning/business-rules-engine.ts';

export async function phase2a_contentPlanner(
  strategicBrief: StrategicBrief,
  context: Phase2Context
): Promise<ContentPlan> {
  
  // 1. Generate allocation rules from revenue drivers
  const rulesEngine = new BusinessRulesEngine(context.revenueDrivers);
  const allocationRules = rulesEngine.generateWeeklyAllocationRules({
    startDate: context.weekStartDate,
    events: context.events || [],
    isNormalWeek: context.weekType === 'normal'
  });
  
  // 2. Assign days based on rules (not templates)
  const postShells: PostShell[] = [];
  
  for (let i = 0; i < strategicBrief.angles.length; i++) {
    const angle = strategicBrief.angles[i];
    const slot = strategicBrief.slots[i];
    
    // Match slot to allocation rule
    const matchingRule = allocationRules.find(
      rule => rule.business_moment === slot.revenue_moment
    );
    
    if (matchingRule) {
      // Use business rule for day assignment
      const postDay = matchingRule.post_days[0]; // Pick first recommended day
      const postTime = matchingRule.post_times[0];
      
      postShells.push({
        slot_id: slot.slot_id,
        angle: angle,
        assigned_day: postDay,
        assigned_time: postTime,
        reasoning: `Business rule: ${matchingRule.business_moment} posts on ${postDay} at ${postTime}`
      });
    } else {
      // Fallback to flexible allocation
      const availableDay = findBestAvailableDay(
        postShells.map(p => p.assigned_day),
        context.availableDays
      );
      
      postShells.push({
        slot_id: slot.slot_id,
        angle: angle,
        assigned_day: availableDay,
        assigned_time: getDefaultTime(slot.goal_mode),
        reasoning: `Flexible slot: spread algorithm`
      });
    }
  }
  
  return {
    post_shells: postShells,
    week_narrative: await generateWeekNarrative(postShells, context)
  };
}
```

#### C2. Event-Aware Posting Logic

**Add to phase2a.ts:**
```typescript
function applyEventAwarePosting(
  postShells: PostShell[],
  events: any[],
  weekContext: any
): PostShell[] {
  for (const event of events) {
    const classification = classifyEvent(event);
    
    if (classification.posting_strategy.day_of_post) {
      // Ensure we have a post ON the event day (not just before)
      const hasEventDayPost = postShells.some(
        shell => shell.assigned_day === event.date
      );
      
      if (!hasEventDayPost) {
        // Find a flexible slot and move it to event day
        const flexibleSlot = postShells.find(
          shell => shell.slot.timing_window === 'any'
        );
        
        if (flexibleSlot) {
          flexibleSlot.assigned_day = event.date;
          flexibleSlot.assigned_time = '09:00';
          flexibleSlot.reasoning = `Event day-of post: ${event.name}`;
        }
      }
    }
  }
  
  return postShells;
}
```

---

### Phase D: Integration & Testing (1-1.5 hours)

#### D1. Update get-weekly-strategy/index.ts

**File:** `supabase/functions/get-weekly-strategy/index.ts`

**Changes:**
1. Fetch revenue_drivers from brand_profile_v5
2. Pass to Phase 1 for slot generation
3. Pass to Phase 2a for day allocation

```typescript
// Line ~259 (after brand profile fetch)
const revenueDrivers = businessBrandProfile?.revenue_drivers || null;

// Line ~600+ (before calling generateWeeklyStrategy)
const strategyResult = await generateWeeklyStrategy(supabase, {
  // ... existing params
  revenueDrivers: revenueDrivers,  // ← NEW
  weekType: determineWeekType(events), // ← NEW
});
```

#### D2. Create Test Suite

**File:** Create `_TEST_WEEKLY_PLAN_BUSINESS_RULES.sql`

**Tests:**
1. Revenue drivers exist in brand profile
2. Business rules engine generates correct allocation rules
3. Phase 2a assigns days based on business rules (not templates)
4. Event weeks have day-of posting
5. Normal weeks follow preferred day patterns
6. No more than 2 consecutive days (existing constraint)

```sql
-- Test 1: Revenue drivers loaded
SELECT 
  business_id,
  revenue_drivers->'primary'->>'moment' as primary_moment,
  revenue_drivers->'secondary'->>'moment' as secondary_moment
FROM brand_profile_v5
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Test 2: Generated slots use revenue drivers
-- (Check function logs for slot generation)

-- Test 3: Day allocation follows business rules
-- (Generate strategy and check assigned days match revenue driver post_timing)

-- Test 4: Event day-of posting
-- (Generate strategy for Grundlovsdag week, verify Friday post exists)

-- Test 5: Normal week pattern
-- (Generate strategy for normal week, verify days match preferred_day_pattern)
```

#### D3. Deployment Checklist

**File:** Create `_DEPLOYMENT_CHECKLIST_Weekly_Plan_Full.md`

**Pre-deployment:**
- [ ] Run Test Suite (all tests pass)
- [ ] Validate revenue_drivers schema
- [ ] Check event classifier logic
- [ ] Review business rules engine output

**Deployment:**
```bash
# 1. Apply schema migration
psql $DATABASE_URL -f _SCHEMA_revenue_drivers.sql

# 2. Deploy updated functions
supabase functions deploy get-weekly-strategy

# 3. Verify deployment
curl $FUNCTION_URL/get-weekly-strategy \
  -d '{"businessId": "f4679fa9...", "regenerate": true}'
```

**Post-deployment:**
- [ ] Generate strategy for normal week → verify Thu/Fri posts
- [ ] Generate strategy for event week → verify day-of post
- [ ] Check function logs for business rules execution
- [ ] Compare to previous calendar-first output

---

## Success Criteria

### Before (Calendar-First)
```
Week 24: Mon 10:00, Tue 13:00, Wed 16:00, Sat 10:00
Missing: Thu-Fri dinner drivers
```

### After (Business-First)
```
Week 24: Mon 09:00, Thu 14:00, Fri 14:00, Sat 08:00
Coverage: Brand builder + Weekend dinner drivers + Brunch
```

### Event Week (Grundlovsdag)
```
Before: Mon, Tue, Wed, Thu (all lead-up)
After: Wed 10:00 (brand), Thu 14:00 (drive), Fri 09:00 (day-of)
```

---

## Rollback Plan

If issues arise:
1. Revert to BASE_SLOTS_FALLBACK in phase1.ts
2. Comment out business rules engine calls
3. Keep revenue_drivers schema (no breaking changes)
4. Redeploy previous version

---

## Next Steps

1. **Create schema migration** (`_SCHEMA_revenue_drivers.sql`)
2. **Build event classifier** (`event-classifier.ts`)
3. **Build business rules engine** (`business-rules-engine.ts`)
4. **Update Phase 1** (slot generation)
5. **Overhaul Phase 2a** (day allocation)
6. **Create test suite**
7. **Deploy and validate**

**Estimated Total Time:** 4-6 hours  
**Risk Level:** Medium-High (complex system overhaul)  
**ROI:** High (fixes core Weekly Plan day allocation gap)
