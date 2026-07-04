# Content-Timing Rules Strategy: Solving the Scheduling Problem at Scale

**Date**: May 2, 2026  
**Context**: Response to Weekly Plan scheduling bug (drinks Sunday 9:00)  
**Question**: How do we implement content-timing rules across diverse businesses and countries?

---

## The Core Challenge

**Simple Solution**: Hardcode "drinks = Thursday-Saturday 14:00-18:00"

**Problem**: This fails for:
- **Nightclubs**: Drinks posts should be Friday-Sunday 18:00-22:00 (later audience)
- **Wine bars**: Drinks posts might work Tuesday-Saturday 15:00-19:00 (weekday clientele)
- **Hotel bars**: Drinks posts could be any day 16:00-20:00 (tourist audience, not local weekend pattern)
- **Brunch cafes**: No drinks programme, this rule is irrelevant
- **Spanish restaurants**: Dinner is 21:00-23:00, not 18:00-20:00 (cultural timing)
- **British pubs**: Lunch posts work 11:00-13:00, Danish restaurants lunch is dead
- **Asian restaurants**: Family dinners Sunday 17:00-19:00 (opposite of Western "Sunday is dead")

**The Question**: Where do these rules come from, and how specific should they be?

---

## Three Strategic Approaches

### Approach 1: Business Archetype Rules (Recommended)

**Concept**: Define 8-12 business archetypes with archetype-specific content-timing rules.

**Business Archetypes** (examples):
1. **Casual Dining** (Cafe Faust, neighborhood restaurants)
   - Drinks: Thu-Sat 14:00-18:00
   - Brunch: Sat-Sun 07:00-11:00
   - Lunch: Tue-Fri 10:00-13:00
   - Dinner: Wed-Sat 15:00-19:00

2. **Fine Dining** (high-end, reservation-heavy)
   - Drinks: Tue-Sat 12:00-17:00 (longer planning window)
   - Dinner: Tue-Sat 14:00-18:00 (reservation-focused)
   - Special events: 5-7 days before (longer booking window)

3. **Nightlife/Bar** (cocktail bars, wine bars, nightclubs)
   - Drinks: Thu-Sun 16:00-22:00 (later audience)
   - Events: Wed-Sat 14:00-20:00 (weekend party planning)
   - No brunch/lunch (doesn't apply)

4. **Brunch Specialist** (weekend-focused cafes)
   - Brunch: Thu-Sat 09:00-14:00 (weekend planning window)
   - Coffee/pastries: Mon-Fri 07:00-10:00 (weekday morning)
   - Lunch: Tue-Fri 10:00-13:00

5. **Fast Casual** (quick service, high turnover)
   - Lunch: Mon-Fri 09:00-11:30 (same-day lunch decision)
   - Dinner: Mon-Fri 14:00-17:00 (same-day evening decision)
   - Weekend: Sat-Sun 10:00-13:00 (spontaneous visits)

6. **Hotel Restaurant** (tourist-oriented)
   - Dinner: Any day 13:00-18:00 (tourists plan differently)
   - Brunch: Fri-Sun 09:00-13:00 (weekend + tourist)
   - Drinks: Any day 14:00-19:00 (tourist spontaneity)

7. **Ethnic/Cultural Specialist** (Italian, Asian, etc.)
   - Varies by cuisine culture (see Cultural Adaptations below)
   - Family dinners: Include Sunday (Asian, Mediterranean cultures)
   - Late dining: 17:00-21:00 posts for 21:00-23:00 dining cultures

8. **Bakery/Cafe** (morning-focused)
   - Pastries: Every day 07:00-09:00 (morning routine)
   - Lunch: Mon-Fri 10:00-12:00 (quick lunch segment)
   - Coffee: Mon-Fri 06:00-08:00 (commuter audience)

**Where Archetype Is Stored**: `brand_profile.business_archetype`

**Example**:
```typescript
brand_profile.business_archetype = "casual_dining"
// OR
brand_profile.business_archetype = "nightlife_bar"
```

**How It Works**:
1. Business onboarding: Owner selects archetype (dropdown, 8-12 options)
2. System loads archetype-specific content-timing rules
3. Phase 1 uses archetype rules to constrain timing_window
4. Phase 2a uses archetype rules to validate day assignment
5. Validation layer checks against archetype rules

**Advantages**:
- ✅ Covers 90% of businesses with 8-12 archetypes
- ✅ Easy to maintain (update archetype, affects all businesses in that category)
- ✅ Owner-understandable (they recognize their archetype)
- ✅ Scalable (new business = pick existing archetype)
- ✅ Flexible (can add new archetypes as needed)

**Disadvantages**:
- ❌ Doesn't capture unique business models (but see hybrid below)
- ❌ Requires initial archetype classification work
- ❌ Edge cases fall between archetypes

---

### Approach 2: AI-Inferred Rules from Brand Profile

**Concept**: AI analyzes Brand Profile and infers content-timing rules dynamically.

**How It Works**:
1. **Phase 0.5** (new mini-phase before Phase 1): Analyze Brand Profile
2. AI reads:
   - `business_description`: "Neighborhood cafe with evening wine bar"
   - `opening_hours`: {Mon-Fri: 08:00-23:00, Sat-Sun: 09:00-01:00}
   - `service_periods`: [breakfast, lunch, dinner, late_night]
   - `target_audience`: "local professionals 25-45, weekend social diners"
   - `programmes`: [{name: "Signature Cocktails", category: "drinks", ...}, ...]
3. AI generates content-timing rules:
   ```json
   {
     "drinks_posts": {
       "optimal_days": ["Thursday", "Friday", "Saturday"],
       "optimal_times": ["14:00-18:00"],
       "rationale": "Target audience is local professionals who plan weekend evenings Thu-Sat afternoons"
     },
     "brunch_posts": {
       "optimal_days": ["Saturday", "Sunday"],
       "optimal_times": ["08:00-11:00"],
       "rationale": "Weekend brunch planning happens morning-of or night-before"
     }
   }
   ```
4. Phase 1 uses AI-generated rules as constraints
5. Rules cached for the week (regenerate weekly or when Brand Profile changes)

**Advantages**:
- ✅ Perfectly tailored to each business (no archetype compromise)
- ✅ Adapts automatically when Brand Profile changes
- ✅ Can handle unique business models (e.g., "brunch cafe with Thursday jazz nights")
- ✅ No manual archetype classification needed
- ✅ Explains reasoning (rationale field helps owner understand)

**Disadvantages**:
- ❌ AI might infer wrong rules (garbage in, garbage out)
- ❌ Adds AI cost (~$0.01-0.02 per week per business)
- ❌ Less predictable (different AI run might generate different rules)
- ❌ Harder to debug (why did AI decide drinks = Sunday?)
- ❌ Requires robust Brand Profile (if description is vague, rules will be vague)

**Mitigation**:
- Validate AI-generated rules against sanity checks (e.g., drinks posts can't be Monday 9:00)
- Cache rules for consistency (don't regenerate every week unless Brand Profile changes)
- Show generated rules to owner for approval (one-time review)

---

### Approach 3: Per-Business Custom Rules (Owner-Configured)

**Concept**: Owners manually configure content-timing rules in Brand Profile.

**Brand Profile Extension**:
```typescript
brand_profile.content_timing_rules = {
  "Signature Cocktails": {
    optimal_days: ["Thursday", "Friday", "Saturday"],
    optimal_times: ["14:00", "15:00", "16:00", "17:00", "18:00"],
    avoid_days: ["Sunday", "Monday", "Tuesday"]
  },
  "Weekend Brunch": {
    optimal_days: ["Saturday", "Sunday"],
    optimal_times: ["08:00", "09:00", "10:00", "11:00"],
    avoid_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  },
  // ... per programme
}
```

**How It Works**:
1. Owner onboarding: For each programme, owner sets optimal days/times
2. System uses exact owner specifications (no AI interpretation)
3. Owner can update rules anytime (immediate effect)

**Advantages**:
- ✅ Perfect accuracy (owner knows their business best)
- ✅ Owner has full control (no AI surprises)
- ✅ Handles any edge case (unique business models)
- ✅ Transparent (owner sees exactly what rules are being used)

**Disadvantages**:
- ❌ **High owner burden**: Must configure 10-20 programmes × 2-3 rules each = 30-60 inputs
- ❌ **Low adoption**: Owners won't complete configuration (too much work)
- ❌ **Maintenance burden**: Owner must update when business changes
- ❌ **Complexity**: Most owners don't think in "optimal_days" terms
- ❌ **Inconsistent quality**: Some owners configure well, others poorly

**Reality Check**: This approach requires too much owner expertise and effort. Would work for 5% of sophisticated owners, fail for 95%.

---

## Recommended Hybrid Approach

**Best Solution**: **Archetype Rules (primary) + AI Refinement (secondary) + Owner Override (tertiary)**

### Layer 1: Archetype Rules (Foundation)

**Implementation**:
1. Define 8-12 business archetypes with tested content-timing rules
2. Owner selects archetype during onboarding (required, dropdown)
3. System loads archetype-specific rules as baseline

**Example Archetype Configuration** (system-level):
```typescript
const ARCHETYPE_RULES = {
  casual_dining: {
    drinks: {
      primary_days: ["Thursday", "Friday", "Saturday"],
      secondary_days: ["Wednesday"],
      optimal_times: ["14:00-18:00"],
      avoid: ["Sunday 00:00-14:00", "Monday", "Tuesday"]
    },
    brunch: {
      primary_days: ["Saturday", "Sunday"],
      optimal_times: ["07:00-11:00"],
      avoid: ["Monday-Friday"]
    },
    lunch: {
      primary_days: ["Tuesday", "Wednesday", "Thursday", "Friday"],
      optimal_times: ["10:00-13:00"],
      avoid: ["Saturday", "Sunday"]
    },
    dinner: {
      primary_days: ["Wednesday", "Thursday", "Friday", "Saturday"],
      optimal_times: ["14:00-19:00"],
      avoid: ["Sunday evening", "Monday"]
    }
  },
  
  nightlife_bar: {
    drinks: {
      primary_days: ["Thursday", "Friday", "Saturday"],
      secondary_days: ["Sunday"],
      optimal_times: ["16:00-22:00"],  // Later audience
      avoid: ["Monday", "Tuesday", "Wednesday morning"]
    },
    events: {
      primary_days: ["Wednesday", "Thursday", "Friday", "Saturday"],
      optimal_times: ["14:00-20:00"],
      avoid: ["Sunday", "Monday", "Tuesday"]
    }
    // No brunch/lunch (doesn't apply to nightlife)
  },
  
  brunch_specialist: {
    brunch: {
      primary_days: ["Saturday", "Sunday"],
      secondary_days: ["Friday"],  // Friday brunch audience exists
      optimal_times: ["07:00-11:00"],
      avoid: ["Monday-Thursday"]
    },
    coffee: {
      primary_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      optimal_times: ["07:00-10:00"],
      avoid: ["Saturday", "Sunday"]  // Weekend is for brunch content
    }
  },
  
  fine_dining: {
    dinner: {
      primary_days: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      optimal_times: ["12:00-17:00"],  // Longer booking window
      avoid: ["Sunday", "Monday"]
    },
    wine: {
      primary_days: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      optimal_times: ["13:00-18:00"],
      avoid: ["Sunday", "Monday"]
    },
    special_events: {
      lead_time_days: 7,  // Post 7 days before event (vs 1-2 days for casual)
      optimal_times: ["10:00-15:00"],
      avoid: []
    }
  },
  
  fast_casual: {
    lunch: {
      primary_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      optimal_times: ["09:00-11:30"],  // Same-day decision
      avoid: ["Saturday", "Sunday"]
    },
    dinner: {
      primary_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      optimal_times: ["14:00-17:00"],  // Same-day decision
      avoid: []
    }
  },
  
  hotel_restaurant: {
    dinner: {
      primary_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],  // Tourists any day
      optimal_times: ["13:00-18:00"],
      avoid: []
    },
    brunch: {
      primary_days: ["Friday", "Saturday", "Sunday"],
      optimal_times: ["09:00-13:00"],
      avoid: []
    }
  }
}
```

**Benefits**:
- Covers 80-90% of businesses accurately
- Zero owner configuration burden
- Easy to maintain and improve
- Predictable, testable behavior

---

### Layer 2: AI Refinement (Context-Aware Adjustments)

**Implementation**:
1. Phase 0 (or new Phase 0.5) reads archetype rules + Brand Profile context
2. AI makes minor adjustments based on:
   - `opening_hours`: If closed Mondays, remove Monday from all rules
   - `service_periods`: If no "late_night", remove post-20:00 times
   - `target_audience`: If "tourists", relax day-of-week restrictions (tourists don't follow local patterns)
   - `location`: If "city_center", extend evening times (urban late dining)
   - `business_description`: If mentions "jazz Thursdays", add Thursday evening exception

**Example**:
```typescript
// Archetype rule (baseline):
casual_dining.drinks = {
  primary_days: ["Thursday", "Friday", "Saturday"],
  optimal_times: ["14:00-18:00"]
}

// AI refinement (context-aware):
// Brand Profile says: opening_hours.Sunday = null (closed Sundays)
//                     business_description = "... live jazz every Thursday night"

// AI-refined rule:
drinks_refined = {
  primary_days: ["Thursday", "Friday", "Saturday"],  // Same
  optimal_times: ["14:00-18:00", "20:00-22:00 (Thursday only)"],  // Added Thursday late
  avoid: ["Sunday (closed)", "Monday", "Tuesday"]  // Added closed-day constraint
}
```

**Benefits**:
- Handles business-specific nuances without manual configuration
- Adapts archetype rules to actual business reality (e.g., closed days)
- Catches special cases (e.g., Thursday jazz night exception)

**Safeguards**:
- AI can only make **minor adjustments** (±1 day, ±2 hours)
- Cannot violate archetype core logic (e.g., cannot move brunch to Monday)
- Log all AI refinements for owner review

---

### Layer 3: Owner Override (Optional Precision)

**Implementation**:
1. Owner can optionally override specific rules in Brand Profile
2. **Lightweight UI**: "Does this look right? [Drinks posts Thu-Sat 14:00-18:00] [Yes] [Edit]"
3. If owner edits, store override in `brand_profile.content_timing_overrides`
4. Overrides take precedence over archetype + AI refinement

**Example**:
```typescript
// Owner override (in Brand Profile):
brand_profile.content_timing_overrides = {
  "Signature Cocktails": {
    optimal_days: ["Wednesday", "Thursday", "Friday", "Saturday"],  // Added Wednesday
    optimal_times: ["15:00-19:00"]  // Shifted one hour later
  }
}
```

**Benefits**:
- Owner has ultimate control (builds trust)
- Handles true edge cases archetype + AI can't predict
- Optional (doesn't burden 95% of owners who are happy with defaults)

**UI/UX**:
- Show generated rules during onboarding: "We'll post drinks content Thu-Sat afternoons. Sound good?"
- Owner clicks "Yes" (90% case) or "Let me adjust" (10% case)
- No complex configuration UI needed (simple day/time picker)

---

## Cultural and Geographic Adaptations

### The Cultural Timing Problem

**Example**: Spanish restaurant in Copenhagen

- **Spanish dining culture**: Dinner 21:00-23:00, lunch 14:00-16:00
- **Danish dining culture**: Dinner 18:00-20:00, lunch 12:00-13:00
- **Question**: Should Spanish restaurant post at Spanish times or Danish times?

**Answer**: **Depends on target audience**

**Case 1: Spanish Restaurant Serving Danes**
- Post at **Danish decision-making times** (14:00-18:00 for evening dining)
- Content can reference Spanish late dining ("Authentic Spanish dinner, starting at 20:00")
- Timing = when Danes make dining decisions, not when Spaniards eat

**Case 2: Spanish Restaurant Serving Spanish Expats/Tourists**
- Post at **Spanish decision-making times** (17:00-21:00 for late dinner)
- Content emphasizes authenticity ("Late dining like home, 22:00 reservations available")
- Timing = when target audience makes decisions

**Implementation**:
```typescript
brand_profile.cultural_context = {
  cuisine_culture: "spanish",        // What culture does food represent?
  audience_culture: "danish",        // What culture is target audience?
  posting_strategy: "audience_time"  // Post when audience decides (not when they eat)
}
```

**Rule**:
- Default: `posting_strategy = "audience_time"` (post when local audience makes decisions)
- Exception: `posting_strategy = "cuisine_time"` (post when cultural audience makes decisions, e.g., Spanish expat community)

**Archetype Rules by Country/Region**:
```typescript
const REGIONAL_ADJUSTMENTS = {
  "DK": {  // Denmark
    casual_dining: {
      dinner_decision_window: "14:00-19:00",
      dinner_time: "18:00-20:00",
      brunch_decision_window: "07:00-11:00"
    }
  },
  
  "ES": {  // Spain
    casual_dining: {
      dinner_decision_window: "17:00-21:00",  // Later decisions
      dinner_time: "21:00-23:00",
      lunch_decision_window: "11:00-14:00",
      lunch_time: "14:00-16:00"  // Much later lunch
    }
  },
  
  "US": {  // United States
    casual_dining: {
      dinner_decision_window: "13:00-18:00",
      dinner_time: "17:00-20:00",  // Earlier than EU
      brunch_decision_window: "08:00-12:00"  // Bigger brunch culture
    }
  },
  
  "UK": {  // United Kingdom
    casual_dining: {
      lunch_decision_window: "10:00-12:30",
      pub_lunch: "11:00-14:00",  // Pub lunch is a thing
      dinner_decision_window: "14:00-18:00"
    },
    pub: {  // UK-specific archetype
      lunch: "11:00-14:00",
      after_work: "Thursday-Friday 15:00-18:00",
      weekend: "Friday-Sunday 12:00-16:00"
    }
  },
  
  "CN": {  // China
    casual_dining: {
      family_dinner_days: ["Friday", "Saturday", "Sunday"],  // Family dinners include Sunday
      dinner_decision_window: "12:00-17:00",
      dinner_time: "18:00-20:00",
      avoid_days: []  // No "Sunday is dead" rule
    }
  }
}
```

**How It Works**:
1. Business sets `brand_profile.country_code = "DK"`
2. System loads archetype rules + regional adjustments
3. Example: `casual_dining` archetype in Denmark gets `dinner_decision_window = "14:00-19:00"`
4. Same archetype in Spain gets `dinner_decision_window = "17:00-21:00"`

**Benefits**:
- Same archetype adapts to local culture automatically
- No owner configuration needed (country code enough)
- Can expand to 50+ countries without code changes (just add regional config)

---

### Multi-Country Businesses

**Example**: Hotel chain with restaurants in 10 countries

**Implementation**:
```typescript
brand_profile.country_code = "DK"  // Per business location

// System loads:
archetype_rules["hotel_restaurant"]  // Base archetype
+ REGIONAL_ADJUSTMENTS["DK"]         // Denmark-specific timings
```

**Effect**: Hotel in Copenhagen posts at Danish times, hotel in Barcelona posts at Spanish times, same archetype logic.

---

## Validation Layer: The Safety Net

**Critical Component**: Even with perfect archetype + AI refinement + owner overrides, add validation layer to catch impossible combinations.

### Validation Rules (Universal, No Exceptions)

**Rule 1: Semantic Content-Time Coherence**
```typescript
if (title includes ["evening", "night", "aften", "drinks", "cocktails", "wine bar"]) {
  assert(time >= 14:00, "Evening content cannot post before 14:00")
}

if (title includes ["morning", "breakfast", "morgen", "coffee", "pastries"]) {
  assert(time <= 11:00, "Morning content cannot post after 11:00")
}

if (title includes ["brunch"]) {
  assert(time >= 07:00 && time <= 11:00, "Brunch content must post 07:00-11:00")
  assert(day in ["Saturday", "Sunday"], "Brunch content must be weekends")
}

if (title includes ["lunch", "frokost"]) {
  assert(time >= 10:00 && time <= 14:00, "Lunch content must post 10:00-14:00")
}
```

**Rule 2: Rationale-Execution Coherence**
```typescript
if (rationale mentions "Friday-Saturday visits") {
  assert(day <= "Saturday", "Cannot drive Friday-Saturday visits from Sunday or later")
}

if (rationale mentions "weekend") {
  assert(day in ["Wednesday", "Thursday", "Friday", "Saturday"], "Weekend promotion must be Wed-Sat")
}

if (rationale mentions "evening destination") {
  assert(time >= 14:00, "Evening destination content needs afternoon/evening timing")
}
```

**Rule 3: Goal-Content Alignment**
```typescript
if (goal === "drive_footfall" && content_type === "evening/drinks") {
  assert(day in archetype_rules.drinks.primary_days + archetype_rules.drinks.secondary_days,
    "Footfall drinks posts must be on optimal days per archetype")
  assert(time in archetype_rules.drinks.optimal_times,
    "Footfall drinks posts must be in optimal time windows")
}
```

**Rule 4: Event-Timing Logic**
```typescript
if (rationale mentions event_name && event_date) {
  assert(post_date <= event_date, "Cannot promote event after it has passed")
  
  if (goal === "drive_footfall") {
    assert(event_date - post_date <= 3 days, "Footfall event posts should be 1-3 days before")
  }
}
```

**On Validation Failure**:
1. **Log error** with specific rule violation
2. **Attempt regeneration** with explicit constraint (e.g., "You violated rule: evening content at 9:00 AM. Regenerate with time >= 14:00")
3. **If regeneration fails**: Skip post with owner notification ("Week plan has 3 posts instead of 4 - one post violated timing rules")
4. **Track failures**: If archetype rules cause frequent failures, adjust archetype config

---

## Implementation Roadmap

### Phase 1: Archetype Rules Foundation (Week 1-2)

**Tasks**:
1. Define 8 core archetypes:
   - casual_dining
   - fine_dining
   - nightlife_bar
   - brunch_specialist
   - fast_casual
   - hotel_restaurant
   - bakery_cafe
   - ethnic_specialist

2. Define content-timing rules for each archetype (based on hospitality best practices)

3. Add `business_archetype` field to Brand Profile (required during onboarding)

4. Create archetype rules config file (easy to update without code changes)

5. Integrate archetype rules into Phase 1 (timing_window generation) and Phase 2a (day assignment validation)

**Deliverable**: 90% of businesses get correct content-timing from archetype alone.

---

### Phase 2: Validation Layer (Week 2-3)

**Tasks**:
1. Implement 20-30 validation rules (semantic, rationale-execution, goal-content, event-timing)

2. Add post-generation validation step before saving weekly plan

3. Create regeneration logic (on validation failure, retry with explicit constraint)

4. Add owner notification system (if post skipped due to validation failure)

5. Create validation error dashboard (track which rules fail most often → improve archetype config)

**Deliverable**: Impossible combinations (evening 9:00 AM) are automatically caught and prevented.

---

### Phase 3: Regional Adjustments (Week 3-4)

**Tasks**:
1. Define regional adjustments for Denmark, Sweden, Norway (Nordic region first)

2. Add `country_code` field to Brand Profile (inferred from address, or owner-specified)

3. Integrate regional adjustments into archetype rule loading

4. Test with businesses in different countries (ensure Spanish restaurant in Copenhagen works correctly)

**Deliverable**: Same archetype adapts to local cultural timing (dinner 18:00 in DK, 21:00 in ES).

---

### Phase 4: AI Refinement (Week 4-5)

**Tasks**:
1. Create Phase 0.5 (or enhance Phase 0): AI analyzes Brand Profile + archetype rules + regional adjustments

2. AI makes minor adjustments:
   - Remove closed days from optimal_days
   - Add special event days (e.g., Thursday jazz night → drinks posts Thursday evening OK)
   - Adjust times based on opening_hours (if open until 01:00, can post later)
   - Tourist-focused businesses → relax day-of-week restrictions

3. Log all AI refinements (for owner transparency and debugging)

4. Add owner review UI: "We'll post drinks Thu-Sat 14:00-18:00 based on your archetype. Sound good? [Yes] [Adjust]"

**Deliverable**: AI handles business-specific nuances without owner configuration burden.

---

### Phase 5: Owner Override (Week 5-6, Optional)

**Tasks**:
1. Add `content_timing_overrides` to Brand Profile (optional field)

2. Create simple UI for owner to adjust rules:
   - "Drinks posts: [Thu] [Fri] [Sat] at [14:00-18:00]"
   - Checkbox interface, not complex configuration

3. Override logic: owner override > AI refinement > archetype rules

4. Track override adoption (if <5% of owners use it, consider removing to reduce complexity)

**Deliverable**: Sophisticated owners can fine-tune rules, 95% of owners never need to touch it.

---

### Phase 6: Continuous Improvement (Ongoing)

**Tasks**:
1. Track validation failures (which rules fail most? → improve archetype config)

2. Owner feedback loop: "Was this week's post timing good? [Yes] [No - suggest improvement]"

3. Add new archetypes as business diversity grows (e.g., "food_truck", "ghost_kitchen", "catering_service")

4. Expand regional adjustments to new countries (50+ countries over time)

5. A/B test: archetype rules vs AI-only rules (measure which produces better engagement)

**Deliverable**: System improves automatically based on real-world feedback.

---

## Example: How This Solves Cafe Faust's Problem

### Current State (Broken)

**Cafe Faust**:
- No archetype defined
- Phase 1 generates vague `timing_window = "any"` for drinks post
- Phase 2a assigns Sunday (spread algorithm, no constraint)
- Phase 2b assigns 9:00 (goal_mode default, promoted_moment not set)
- No validation catches the error
- Result: **Sunday 9:00 drinks post** ❌

---

### Future State (Fixed with Hybrid Approach)

**Onboarding**:
- Owner (or AI during Business Profile creation) selects: `business_archetype = "casual_dining"`
- System loads `casual_dining` archetype rules:
  ```typescript
  casual_dining.drinks = {
    primary_days: ["Thursday", "Friday", "Saturday"],
    secondary_days: ["Wednesday"],
    optimal_times: ["14:00-18:00"],
    avoid: ["Sunday 00:00-14:00", "Monday", "Tuesday"]
  }
  ```

**Week Generation (May 5-11, 2026)**:

**Phase 0**: Contextual analysis (same as current)

**Phase 0.5** (new): AI refinement
- Reads archetype rules + Brand Profile
- Sees `opening_hours.Sunday = 10:00-22:00` (open Sundays)
- Sees `target_audience = "local professionals + weekend social diners"`
- AI refinement: Keep archetype rules as-is (no special adjustments needed)

**Phase 1**: Strategic brief generation
- AI generates drink angle
- **Uses archetype rules to constrain timing_window**:
  ```typescript
  angle = {
    content_category: "craving_visual",
    programme_name: "Signature Cocktails",
    timing_window: "Thu-Sat 14:00-18:00",  // ← Explicit from archetype
    promoted_moment: "dinner",              // ← Set correctly
    goal_mode: "drive_footfall"
  }
  ```

**Phase 2a**: Day assignment
- Sees `timing_window = "Thu-Sat 14:00-18:00"`
- **Validation**: Can only assign Thursday, Friday, or Saturday
- Thursday already has burger post
- **Assigns Friday 14:00** (within optimal window) ✅

**Phase 2b**: Post detail generation
- Timing cascade:
  1. Priority 1: `timing_window = "Thu-Sat 14:00-18:00"` → extracts 14:00
  2. Priority 2: `promoted_moment = "dinner"` → would give 17:00 (but Priority 1 already decided)
  3. Priority 3: Not reached
- **Result: Friday 14:00** ✅

**Validation Layer**:
- Check 1: Evening content at 14:00 → ✅ Pass (>= 14:00)
- Check 2: Drinks post on Friday → ✅ Pass (in primary_days)
- Check 3: Footfall drinks goal on Friday 14:00 → ✅ Pass (optimal day + time)
- Check 4: Rationale mentions "weekend visits" from Friday post → ✅ Pass (Friday is before weekend)

**Final Weekly Plan**:

| Day | Time | Title | Goal | Result |
|-----|------|-------|------|--------|
| Tue May 6 | 10:00 | Mors Dag: Familietraditioner | Brand | ✅ |
| Thu May 7 | 14:00 | Faustburger — dinner | Footfall | ✅ |
| **Fri May 8** | **14:00** | **Aftenstemning (Signature Cocktails)** | **Footfall** | ✅ **FIXED** |
| Sat May 9 | 9:00 | Favoritten — brunch | Footfall | ✅ |

**Impact**:
- Drinks post now on Friday 14:00 (optimal day + time)
- Reaches audience during peak evening-planning window
- Rationale can legitimately claim "perfect timing for weekend visits" (Friday → Sat/Sun)
- No Sunday 9:00 morning drinks disaster

---

## Decision Matrix: Which Approach for Your System?

| Criterion | Archetype Only | AI-Inferred Only | Per-Business Config | **Hybrid (Recommended)** |
|-----------|----------------|------------------|---------------------|--------------------------|
| **Owner Burden** | ✅ Zero (pick archetype) | ✅ Zero (automatic) | ❌ High (30-60 inputs) | ✅ Zero (with optional override) |
| **Accuracy** | 🟡 80-90% | 🟡 70-85% (depends on Brand Profile quality) | ✅ 95%+ (owner knows best) | ✅ 90-95% (archetype + AI nuance) |
| **Scalability** | ✅ 8-12 archetypes cover thousands of businesses | ✅ Scales infinitely | ❌ Each business needs config | ✅ Scales infinitely |
| **Maintenance** | ✅ Update archetype, affects all | 🟡 AI might drift over time | ❌ Owner must update | ✅ Update archetype, AI adapts |
| **Edge Cases** | ❌ Falls between archetypes | 🟡 AI might hallucinate | ✅ Owner handles any case | ✅ AI refinement + owner override |
| **Predictability** | ✅ Deterministic | ❌ AI non-deterministic | ✅ Deterministic | 🟡 Mostly deterministic (archetype + logged AI adjustments) |
| **Cost** | ✅ Zero AI cost | ❌ $0.01-0.02 per week | ✅ Zero ongoing cost | 🟡 ~$0.005 per week (small AI refinement) |
| **Owner Trust** | ✅ Transparent (archetype rules visible) | 🟡 Black box (why did AI decide?) | ✅ Owner set it | ✅ Transparent with explanation |
| **Handles Cultural Differences** | ✅ Regional adjustments per archetype | ✅ AI can infer | ❌ Owner must know cultural norms | ✅ Regional adjustments + AI adaptation |

**Conclusion**: Hybrid approach combines best of all worlds - archetype foundation (80-90% coverage) + AI refinement (business nuances) + owner override (ultimate control).

---

## Final Recommendation

### Implement Hybrid Approach in 3 Phases

**Phase 1 (Critical - Fixes Immediate Bug)**:
- Archetype rules foundation
- Validation layer
- Covers 90% of cases, prevents "Sunday 9:00 drinks" disasters

**Phase 2 (Enhancement)**:
- Regional adjustments for cultural timing differences
- Expands global reach (Spain, US, UK, China, etc.)

**Phase 3 (Polish)**:
- AI refinement for business-specific nuances
- Owner override UI for 5% edge cases
- Continuous improvement loop

**Timeline**: 4-6 weeks total, but Phase 1 (2-3 weeks) solves 90% of problem.

**Cost**: Minimal ($0.005/week AI refinement cost if Phase 3 implemented)

**Risk**: Low (archetype rules are deterministic, testable, transparent)

**Owner Impact**: Zero burden for 95% of owners (pick archetype, done)

This solves the drinks-on-Sunday problem while scaling to thousands of diverse businesses across multiple countries. The key insight: **Don't try to be perfect for every business, be 90% accurate for 95% of businesses, then let AI and owner handle the 5% edge cases.**
