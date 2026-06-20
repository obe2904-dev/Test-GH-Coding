# Content Generation Systems: Complete Data Flow Analysis
**Dagens Forslag & Weekly Plan — Persona Integration, Data Mapping, and Gap Assessment**

> **Purpose**: Comprehensive review of both content generation systems showing what data flows where, how persona/audience frameworks are used, what works well, and what's missing or contradictory.

> **📋 DOCUMENT STATUS (1. maj 2026)**:
> - **Original Analysis**: Created to identify gaps and plan improvements
> - **Verification Completed**: 1. maj 2026 (comprehensive code review)
> - **Major Discovery**: Most "critical gaps" were already implemented in earlier work
> - **Updated Status**: All gap claims verified against actual code; document updated with accurate implementation status
> - **Final Implementation**: ✅ COMPLETE (1. maj 2026) - All Priority 2 tasks implemented
> - **See Also**: 
>   - [PRIORITY-2-IMPLEMENTATION-RESULTS.md](PRIORITY-2-IMPLEMENTATION-RESULTS.md) for verification summary
>   - [PRIORITY-2-FINAL-IMPLEMENTATION-SUMMARY.md](PRIORITY-2-FINAL-IMPLEMENTATION-SUMMARY.md) for final implementation details

---

## Executive Summary

### System Comparison

| Aspect | Weekly Plan (Strategic) | Dagens Forslag (Tactical) |
|--------|-------------------------|---------------------------|
| **Primary Goal** | 7-day content calendar with brand consistency | 3 quick daily suggestions for immediate use |
| **Tier Access** | Smart + Pro | All tiers (Free, Smart, Pro) |
| **Data Depth** | Full brand profile, 6-week history, economic timing | Lightweight brand context, same-day focus |
| **Persona Usage** | ✅ Full audience_framework with timeSlots | ✅ Full audience_framework with timeSlots (fallback to segments) |
| **Programme Rotation** | ✅ Tracked (4-week lookback) | ✅ Tracked (7-day lookback) |
| **Menu Data** | Full structured menu (20+ sources) | Tier-based (Free: 5 items, Paid: full menu) |
| **Weather Integration** | 7-day forecast, pattern detection | Current + 24h forecast only |
| **Historical Context** | 14 days dish dedup, 6 weeks strategy patterns | 10 recent posts for programme rotation |
| **AI Complexity** | Multi-phase (Phase 0, 1, 2a-c) | Single-phase generation |

### Key Findings

**✅ Strengths**:
1. Both systems successfully use programme rotation to balance content across time slots
2. Weather integration works consistently (outdoor seating gates)
3. Menu data flows cleanly from extraction to generation
4. Brand voice consistency enforced through tone_of_voice and never_say lists
5. Persona schema unified across both systems (audience_framework.timeSlots)
6. Business character, location intelligence, and price formality all integrated

**⚠️ Remaining Gaps** (as of 1. maj 2026 - PRIORITY 2 COMPLETE):
1. **Kitchen Close Time**: ✅ Dagens Forslag (implemented) | ✅ Weekly Plan scheduling (IMPLEMENTED - phase2b.ts lines 369-386)
2. **Post Length Guidelines**: ✅ Extracted in both systems | ✅ Weekly Plan prompt injection (IMPLEMENTED - phase1.ts line 370-377, phase2b.ts lines 451-461, 893)
3. **Programme Revenue Weights**: UI and integration not yet built
4. **Social Lead Menu Flag**: Collected but not used for prioritization
5. **Seasonal Audience Modeling**: Not yet implemented

**✅ Resolved Contradictions** (as of 1. maj 2026):
1. ~~Programme sources differ~~ → **RESOLVED**: Both systems now use `audience_framework.timeSlots` as primary source
2. ~~Audience interpretation differs~~ → **RESOLVED**: Both systems use timeSlot-specific contexts with identical fallback chains
3. ~~Post length not standardized~~ → **RESOLVED**: Both systems use `post_length_guidelines` for consistent length targeting

**⚠️ Minor Implementation Differences** (Not Contradictions):
- **Time Matching**: Weekly Plan uses programme names directly, Dagens Forslag maps programme names to hour ranges (awaiting schema enhancement 3.1)
- **Use Case Alignment**: Weekly Plan generates longer strategic narratives (appropriate for 7-day planning), Dagens Forslag generates concise daily suggestions (appropriate for immediate use)
- Both differences are intentional design choices, not inconsistencies

---

## Part 1: Weekly Plan (get-weekly-strategy)

### Complete Data Flow Map

```
┌──────────────────────────────────────────────────────────────────┐
│ INPUT LAYER: Database & External APIs                            │
└──────────────────────────────────────────────────────────────────┘
         │
         ├─→ [BUSINESS DATA] 9 parallel queries
         │   ├─ businesses (tier, subscription)
         │   ├─ business_locations (city, country, coordinates)
         │   ├─ business_location_intelligence (category_scores, area_type)
         │   ├─ business_operations (outdoor_seating, price_level)
         │   ├─ opening_hours (weekday schedules)
         │   ├─ business_brand_profile (25 fields)
         │   ├─ business_profile (menu_signal fallback)
         │   ├─ menu_results_v2 (structured menu, limit 20)
         │   └─ profiles (selected_platforms)
         │
         ├─→ [EXTERNAL APIS]
         │   ├─ OpenWeatherMap (7-day forecast via lat/lng)
         │   └─ Contextual calendar (events, 14-day lookahead)
         │
         └─→ [HISTORICAL DATA] 3 queries
             ├─ weekly_content_plans (last 14 days) → dish deduplication
             ├─ weekly_strategies (last 6 weeks) → pattern analysis
             └─ generated_posts (last 4 weeks) → programme rotation tracking

┌──────────────────────────────────────────────────────────────────┐
│ PROCESSING LAYER: Context Building                               │
└──────────────────────────────────────────────────────────────────┘

Step 1: ECONOMIC TIMING
  Input: Week start date
  Output: payday_week, month_position, relative_purchasing_power
  Logic: Week 3-4 = payday, early month = high purchasing power

Step 2: SEASON CONTEXT
  Input: Week start date, country
  Output: current season, transition_state, strategic_themes
  Logic: Month-based season mapping (DK: Dec-Feb = vinter, etc.)

Step 3: LOCATION INTELLIGENCE
  Input: category_scores, area_type, neighborhood
  Output: primary_type, matched_motivations, tourist_context
  Logic: buildLocationIntelligence() derives location character

Step 4: WEATHER AGGREGATION
  Input: 7-day forecast from API
  Output: pattern, avg_temp, outdoor_days, notable_conditions
  Logic: detectWeatherPattern() identifies trends (sunny_week, cold_snap)

Step 5: MENU PROCESSING
  Input: menu_results_v2.structured_data (up to 20 sources)
  Output: categorized dishes, signature items, drink/food split
  Logic: 
    - Category blocklist: børnemenu, tilvalg, ekstra, kids menu
    - Dish blocklist: surcharges, add-ons, side orders
    - Separation: drinks vs food, signature flag prioritization

Step 6a: PROGRAMME EXTRACTION
  Input: audience_framework.timeSlots[].programmes
  Output: unique programmes[] (Brunch, Frokost, Aftensmad, Cocktails)
  Logic: Flatten timeSlots, deduplicate programme names

Step 6b: PROGRAMME ROTATION ANALYSIS
  Input: generated_posts (last 4 weeks), programmes[]
  Output: programme_coverage[] with priority scores
  Function: calculateProgrammePriorities(programmes, recentPosts, revenueWeights)
  Scoring:
    - Recency: 0-50 points (days since last post, max penalty at 28 days)
    - Frequency: 0-30 points (inverse of post count in 4 weeks)
    - Revenue: 0-20 points (future feature, currently disabled)
  Output per programme:
    - last_mentioned_days_ago
    - times_posted_4weeks
    - priority_score (0-100, higher = more needed)
    - needs_coverage (true if >14 days or priority >70)

Step 6c: CALENDAR CONTEXT
  Input: Week start date
  Output: week_of_month, is_first_weekend, is_payday_week
  Function: deriveCalendarContext(weekStartDate)
  Logic: Calendar math for monthly patterns

Step 7: DISH DEDUPLICATION
  Input: weekly_content_plans (last 14 days)
  Output: posted_menu_items[] (dish names to avoid)
  Logic: Extract all menuItemName and dish from last 2 weeks

Step 8: HISTORICAL STRATEGY PATTERNS
  Input: weekly_strategies (last 6 weeks)
  Output: past_narratives[], past_approaches[], engagement_proxy
  Logic: Extract strategy_rationale, narrative themes for variety
  Engagement proxy: Count of weeks where ideas were selected

┌──────────────────────────────────────────────────────────────────┐
│ CONTEXT OBJECT: WeekContext                                      │
└──────────────────────────────────────────────────────────────────┘

{
  business_name: string,
  business_id: string,
  tier: 'smart' | 'pro',
  
  // TIMING CONTEXT
  week_start: Date,
  week_number: number,
  available_days: string[],  // Only open days
  payday_week: boolean,
  month_position: 'early' | 'mid' | 'late',
  season: { current: string, transition: string, themes: string[] },
  
  // LOCATION CONTEXT
  location: {
    city: string,
    country: string,
    neighborhood: string,
    primary_type: 'waterfront' | 'city_centre' | 'tourist' | 'local' | ...,
    has_outdoor_seating: boolean,
    matched_motivations: string[],  // e.g., ["seaside dining", "destination lunch"]
    marketing_focus: string,        // e.g., "Leverage waterfront appeal"
    tourist_context: boolean,
    location_categories: string[],  // Multi-dimensional types
  },
  
  // WEATHER CONTEXT
  weather: {
    pattern: 'sunny_week' | 'rainy_period' | 'cold_snap' | 'warm_spell' | 'mixed',
    avg_temp: number,
    outdoor_days: number,           // Count of suitable outdoor days
    notable_conditions: string[],
    daily: [
      { date: string, temp_high: number, condition: string, outdoor_suitable: boolean }
    ]
  },
  
  // EVENTS CONTEXT
  events: [
    {
      event_name: string,
      event_type: 'holiday' | 'occasion' | 'season_change' | 'local',
      date_start: Date,
      days_away: number,
      in_week: boolean,
      content_angle: string,
      marketing_hook: string,
      commercial_weight: number,
      lead_days: number
    }
  ],
  
  // BRAND VOICE CONTEXT
  brand_voice: {
    tone_of_voice: string | { primary_tone, attributes, formality_level },
    tone_keywords: string[],
    voice_style: string,           // brand_essence
    business_character: string,    // ✅ NEW (e.g., "café-bar hybrid")
    do_not_say: string[] | object,
    content_pillars: string[] | object,
    signature_phrases: string[],
    never_say: string[],
    humor_level: 'none' | 'subtle' | 'playful' | 'bold',
    formality: 'casual' | 'balanced' | 'refined',
    content_strategy: {
      goal_blend: { build_awareness, drive_visits, build_brand },
      content_category_weights: { offering, guest_moment, brand_behind },
      tone_balance: { informative, engaging, inspiring },
      week_goal_blend: object,          // Modulated per week
      week_content_category_weights: object,
      week_strategic_rationale: string
    },
    voice_archetype: string,
    voice_constraints: string[],
    voice_rationale: string,
    brand_context: {
      origin_story: string,
      what_makes_us_different: string,
      local_landmarks: string[]
    },
    posting_occasions: string[],   // Content type preferences
    // PERSONA FRAMEWORK (Multi-dimensional)
    audience_framework: {
      primaryAudiences: string[],  // e.g., ["Lokalbefolkning", "Turister"]
      timeSlots: [
        {
          programmes: string[],    // e.g., ["Brunch", "Morgenkaffe"]
          audiences: string[],     // e.g., ["Morgengæster", "Kaffe-to-go"]
          contexts: string[]       // e.g., ["Weekend-brunch", "Quick caffeine fix"]
        }
      ],
      locationContexts: [
        {
          type: 'waterfront_tourist' | 'downtown_business' | 'residential_local',
          audiences: string[],
          priority: 'primary' | 'secondary'
        }
      ]
    },
    // LEGACY AUDIENCE (Fallback if audience_framework missing)
    target_audience: { primary: string, characteristics: string[] },
    audience_segments: [
      {
        label: string,
        priority: 'primary' | 'secondary' | 'niche',
        who: string,
        motivation: string,
        timing: [{ day: string, hour_start: number, hour_end: number }]
      }
    ]
  },
  
  // MENU CONTEXT
  menu: {
    signature_dishes: [{ name: string, description: string, category: string }],
    seasonal_items: [{ name: string, description: string }],
    drinks: [{ name: string, description: string }],
    price_level: 'budget' | 'mid' | 'premium',
    cuisine_style: string,
    menu_summary: string,          // AI-generated helicopter view
    service_periods: string[]      // Detected programmes from menu
  },
  
  // HISTORICAL CONTEXT
  history: {
    posted_menu_items: string[],   // Last 14 days
    past_strategies: [
      { narrative: string, approach: string, week_number: number }
    ],
    engagement_proxy: number       // Weeks with selected ideas / total weeks
  },
  
  // PROGRAMME ROTATION (NEW)
  programme_coverage: [
    {
      programme: string,
      last_mentioned_days_ago: number,
      times_posted_4weeks: number,
      priority_score: number,       // 0-100
      needs_coverage: boolean
    }
  ],
  calendar_context: {
    week_of_month: number,
    is_first_weekend: boolean,
    is_payday_week: boolean
  },
  
  // PLATFORM CONTEXT
  platforms: ['facebook', 'instagram']
}
```

### AI Generation Flow (Multi-Phase)

**Phase 0: Posting Occasion Selection**
- Input: WeekContext
- Model: GPT-4 (temperature 0.7)
- Output: Selected posting occasions from allowed list
- Purpose: Strategic content type filtering based on business type, menu, season

**Phase 1: Strategic Brief**
- Input: WeekContext + selected occasions
- Model: GPT-4 (temperature 0.7)
- Output: 7-day narrative, strategic rationale, engagement angle
- Purpose: High-level strategy before tactical execution

**Phase 2a: Post Idea Generation (Slot A - Offering)**
- Input: Strategic brief + WeekContext
- Model: Gemini 1.5 (temperature 0.8)
- Output: 3-7 offering posts (menu items, seasonal dishes, specials)
- Focus: Signature dishes, seasonal items, NOT recently posted

**Phase 2b: Post Idea Generation (Slot B - Guest Moment)**
- Input: Strategic brief + WeekContext
- Model: Gemini 1.5 (temperature 0.8)
- Output: 3-7 guest moment posts (scenes, experiences, occasions)
- Focus: Audience scenarios, time-specific contexts (brunch crowd, afterwork, weekend)

**Phase 2c: Post Idea Generation (Slot C - Brand Behind)**
- Input: Strategic brief + WeekContext
- Model: Gemini 1.5 (temperature 0.8)
- Output: 3-7 behind-the-scenes posts (craft, process, team)
- Focus: Brand storytelling, values, differentiators

### Persona Integration in Weekly Plan

**Source**: `audience_framework` (primary) → `audience_segments` (fallback) → `target_audience` (legacy)

**How timeSlots Are Used**:

1. **Programme Extraction**:
   ```
   timeSlots: [
     { programmes: ["Brunch", "Morgenkaffe"], audiences: [...] },
     { programmes: ["Frokost"], audiences: [...] },
     { programmes: ["Aftensmad", "Cocktails"], audiences: [...] }
   ]
   → Extracted programmes: ["Brunch", "Morgenkaffe", "Frokost", "Aftensmad", "Cocktails"]
   ```

2. **Audience Context per Time Slot**:
   - Phase 2b (Guest Moment) matches posting occasions to time slots
   - Example: "brunch_moment" → timeSlots with "Brunch" programme → audiences for that slot
   - Prompt includes: "Target audiences for this slot: Morgengæster, Weekend-familien, Kaffe-to-go"

3. **Location Context Layering**:
   - `locationContexts` maps location types to audiences
   - Example: Waterfront location → "Turister søger destination dining" + "Lokalbefolkning søger seaside-oplevelser"
   - Overlays with timeSlot audiences for nuanced targeting

4. **Programme Rotation Priority**:
   - `programme_coverage[]` scores each programme
   - Underrepresented programmes boosted in Phase 2a/2b selection
   - Example: Cocktails not mentioned in 21 days → priority_score 85 → AI instructed to prioritize evening/bar content

**What Works Well**:
✅ Multi-dimensional persona model (time + location + audience mindset)
✅ Programme-specific audience matching prevents generic messaging
✅ Rotation tracking ensures balanced coverage across all service periods
✅ Location context adds geographic nuance (waterfront vs city centre audiences differ)

**What's Missing**:
❌ Revenue weights not yet implemented (would prioritize high-revenue programmes)
❌ Seasonal audience shifts not explicitly modeled (summer tourists vs winter locals)
❌ No explicit "avoid this audience" filtering (e.g., office lunch crowd irrelevant for weekend)
❌ Audience segment priority not used to weight content distribution (primary vs secondary segments)

**Contradictions**:
⚠️ `primaryAudiences` at framework level vs `audiences` per timeSlot — unclear hierarchy
⚠️ `posting_occasions` selected in Phase 0 but timeSlot contexts applied in Phase 2b — potential mismatch
⚠️ Business character describes hybrid verticals but audience framework doesn't adapt per vertical (café-bar should have different café audiences vs bar audiences)

---

## Part 2: Dagens Forslag (get-quick-suggestions)

### Complete Data Flow Map

```
┌──────────────────────────────────────────────────────────────────┐
│ INPUT LAYER: Database & External APIs                            │
└──────────────────────────────────────────────────────────────────┘
         │
         ├─→ [BUSINESS DATA] 8 parallel queries
         │   ├─ businesses (tier, vertical, business_character)
         │   ├─ business_locations (city, postal_code, country)
         │   ├─ business_operations (outdoor_seating, price_level, kitchen_close_time)
         │   ├─ opening_hours (today's hours only)
         │   ├─ business_brand_profile (compact: 13 fields)
         │   ├─ business_profile (menu_signal)
         │   ├─ menu_results_v2 (tier-gated: Free=top 5, Paid=full menu)
         │   └─ profiles (selected_platforms)
         │
         ├─→ [EXTERNAL API]
         │   └─ OpenWeatherMap (current + 24h forecast only)
         │
         └─→ [HISTORICAL DATA] 2 queries
             ├─ quick_suggestions (today's quota check)
             └─ generated_posts (last 10 for programme rotation)

┌──────────────────────────────────────────────────────────────────┐
│ PROCESSING LAYER: Context Building                               │
└──────────────────────────────────────────────────────────────────┘

Step 1: QUOTA CHECK
  Input: quick_suggestions (created today)
  Output: remaining_quota
  Logic: Free tier = 5/day max, Paid = 100/day max
  Gate: Return cached suggestions if quota exceeded

Step 2: TIER-BASED MENU LOADING
  Input: tier, menu_results_v2
  Output: menu items with descriptions
  Logic:
    - Free tier: Top 5 items from menu_signal OR first 5 from structured_data
    - Paid tier: Full menu from all sources (category blocklist applied)
    - Signature flag prioritization
    - Dish-level blocklist (surcharges, add-ons)
    - Separation: drinks vs food

Step 3: WEATHER SNAPSHOT
  Input: OpenWeatherMap API (current + 24h)
  Output: current_temp, current_condition, next_24h_forecast, outdoor_suitable
  Logic: Same outdoor gate (temp ≥ 15°C, wind < 5 m/s, outdoor seating available)

Step 4: TODAY'S HOURS & KITCHEN CLOSE
  Input: opening_hours (today's weekday)
  Output: todayOpenTime, todayCloseTime, kitchenCloseTime
  Logic: ✅ NEW kitchen_close_time gate (prevents food suggestions within 30 min)

Step 5: HYBRID VERTICAL DETECTION
  Input: business.vertical, business_character, identity_keywords
  Output: hybridVerticals[], effectiveVertical
  Function: detectHybridVerticals() + resolveActiveVertical()
  Logic:
    - Detects café-bar, bakery-café hybrids from text analysis
    - Resolves to active vertical based on current hour
      - Bakery: first 2h after open
      - Coffee+Bar: <14h = coffee, ≥14h = bar
      - Bar+Café: <17h = café, ≥17h = bar
  Purpose: Service period matching for content type selection

Step 6: PROGRAMME DETECTION
  Input: hybridVerticals, todayOpenTime, todayCloseTime, current hour
  Output: active_service_period
  Function: deriveServicePeriod()
  Logic: Hour-based programme matching
    - 6-10: Brunch/Morgenmad
    - 10-14: Frokost
    - 14-17: Eftermiddagskaffe
    - 17-22: Aftensmad
    - 20-3: Cocktails/Bar
  ⚠️ DIFFERENT from Weekly Plan (which uses audience_framework.timeSlots.programmes)

Step 7: PROGRAMME ROTATION CHECK
  Input: generated_posts (last 10), active_service_period
  Output: recently_used_programmes[]
  Logic: Check if current programme appears in last 3 posts
  Gate: If yes, switch to alternative programme from same time slot

Step 8: DAY BEHAVIOR
  Input: Current day of week
  Output: mode, emphasis, offering_tone, default slots
  Function: getDayBehavior()
  Logic: Behavioral patterns per weekday
    - Sunday: slow, brunch emphasis, cozy
    - Monday: restart, lunch, energetic
    - Tuesday-Wednesday: midweek quiet, routine
    - Thursday: pre-weekend, afterwork
    - Friday: weekend kickoff, social, festive
    - Saturday: peak weekend, outdoor, families

Step 9: PERSONA LOADING
  Input: business_brand_profile.audience_framework (primary) OR audience_segments (fallback)
  Output: audienceDescriptions[]
  Logic: ✅ Uses audience_framework.timeSlots (primary), audience_segments (fallback)
  Implementation: Lines 1446-1532 in get-quick-suggestions/index.ts
  Format (audience_framework):
    ```
    timeSlots: [
      {
        programmes: ["Brunch", "Morgenkaffe"],
        audiences: ["Morgengæster", "Kaffe-to-go", "Weekend-familien"],
        contexts: ["Weekend-brunch", "Quick caffeine fix"]
      }
    ]
    → Matches current hour to programme hour range
    → Extracts audiences for matched time slot
    → Checks programme rotation (last 3 posts)
    → Switches to alternative slot if recently used
    ```
  Fallback Format (audience_segments):
    ```
    [
      {
        label: "Morgengæster",
        priority: "primary",
        who: "Lokale på vej til arbejde + weekend-familier",
        motivation: "Quick caffeine fix eller rolig weekend-brunch",
        timing: [{ day: "weekday", hour_start: 7, hour_end: 10 }]
      }
    ]
    ```
  Matching: Programme-based (primary) or Time-based filtering (fallback)

Step 10: BTS ACTIVITY WINDOW
  Input: todayOpenTime, todayCloseTime, effectiveVertical
  Output: bts_window description
  Function: getBTSActivityWindow()
  Logic: Time-relative behind-the-scenes phases
    - Pre-opening: "Forberedelse: mise en place, morgenrutine"
    - Early service: "Tidlig service: første gæster, opstart"
    - Closing: "Slutfase: oprydning, klargøring til i morgen"
  Purpose: Slot C (brand_behind) time-appropriate content

┌──────────────────────────────────────────────────────────────────┐
│ CONTEXT OBJECT: DagensContext (Streamlined)                      │
└──────────────────────────────────────────────────────────────────┘

{
  business_name: string,
  business_id: string,
  tier: 'free' | 'smart' | 'pro',
  
  // TIMING
  today: Date,
  day_of_week: string,
  day_behavior: {
    mode: string,
    emphasis: string,
    offering_tone: string,
    slot_b_default: string,
    slot_c_default: string
  },
  todayOpenTime: string,
  todayCloseTime: string,
  kitchenCloseTime: string | null,  // ✅ NEW
  
  // VERTICAL & SERVICE PERIOD
  effectiveVertical: 'cafe' | 'restaurant' | 'bar' | 'bakery' | 'coffee_shop',
  isHybridBusiness: boolean,
  active_service_period: string,   // Detected from hour
  
  // LOCATION (Minimal)
  city: string,
  country: string,
  
  // WEATHER (Today only)
  weather: {
    current_temp: number,
    current_condition: string,
    next_24h_forecast: string,
    outdoor_suitable: boolean
  },
  
  // BRAND VOICE (Compact)
  brand: {
    brand_essence: string,
    tone_of_voice: string | object,
    tone_keywords: string[],
    business_character: string | null,  // ⚠️ NOT YET IN PROMPTS
    never_say: string[],
    content_strategy: object | null,
    humor_level: string,
    voice_archetype: string,
    typical_openings: string[],
    location_intelligence: string | null,
    posting_occasions: string[]
  },
  
  // PERSONA (audience_segments format)
  personas: [
    {
      label: string,
      priority: 'primary' | 'secondary' | 'niche',
      who: string,
      motivation: string,
      timing: [{ day: string, hour_start: number, hour_end: number }],
      matched: boolean         // Time-filtered to current hour
    }
  ],
  
  // MENU (Tier-gated)
  menu: {
    items: [{ name: string, description: string, category: string, is_signature: boolean }],
    drinks: [{ name: string, description: string }],
    price_level: 'budget' | 'mid' | 'premium'
  },
  
  // PROGRAMME ROTATION
  recently_used_programmes: string[],   // From last 3 posts
  alternative_programme: string | null, // If rotation needed
  
  // BTS CONTEXT
  bts_activity_window: string,
  
  // PLATFORMS
  platforms: ['facebook', 'instagram']
}
```

### AI Generation Flow (Single-Phase)

**Prompt Structure**:
1. **System Instructions**: Role, output format, constraints
2. **Brand Voice Block**: Tone rules, never say, signature phrases
3. **Menu Intelligence**: Available items (tier-gated), signatures, drinks
4. **Time & Weather**: Current hour, service period, outdoor suitability
5. **Audience Context**: Matched personas (time-filtered), motivations
6. **Slot Specifications**: 3 slots (A: offering, B: guest_moment, C: brand_behind)
7. **Programme Rotation**: Recently used programmes, alternative suggestions
8. **Day Behavior**: Weekday patterns, emphasis, tone

**Model**: Google Gemini 1.5 (temperature 0.85, high creativity)

**Output**: 3 suggestions (one per slot) with:
- title
- rationale
- content_type (menu_item | guest_moment | brand_behind)
- dish/menu_item (if applicable)
- photo_idea
- suggested_time (content-aware, kitchen-close gated)

### Persona Integration in Dagens Forslag

**Source**: `audience_framework.timeSlots` (primary) → `audience_segments` (fallback) → `target_audience` (legacy)

**✅ VERIFIED IMPLEMENTATION** (Lines 1446-1532 in get-quick-suggestions/index.ts)

**How audience_framework.timeSlots Are Used**:

**How audience_framework.timeSlots Are Used**:

1. **Programme Hour Mapping** (Lines 1456-1463):
   ```typescript
   const getProgrammeHourRange = (programmes: string[]): [number, number] | null => {
     const progStr = programmes.join(' ').toLowerCase()
     if (/brunch|morgenmad|breakfast|morgenkaffe/.test(progStr)) return [7, 12]
     if (/frokost|lunch/.test(progStr)) return [11, 16]
     if (/kaffe|kage|cake|eftermiddag/.test(progStr)) return [14, 18]
     if (/aften|middag|dinner/.test(progStr)) return [17, 23]
     if (/cocktail|bar|drink|nat/.test(progStr)) return [20, 3]
     return null
   }
   ```
   Maps programme names to typical service hours

2. **Time Slot Matching** (Lines 1467-1478):
   ```typescript
   let matchingSlot = audienceFramework.timeSlots.find((slot: any) => {
     const programmes = Array.isArray(slot.programmes) ? slot.programmes : []
     const range = getProgrammeHourRange(programmes)
     if (!range) return false
     const [start, end] = range
     if (start <= end) {
       return currentHour >= start && currentHour < end
     } else {
       // Handles wraparound (e.g., cocktails 20-3)
       return currentHour >= start || currentHour < end
     }
   })
   ```
   Finds time slot where current hour matches programme service time

3. **Programme Rotation Awareness** (Lines 1481-1520):
   - Fetches last 10 generated_posts (7 days)
   - Checks if matched programme appears in last 3 posts
   - If yes, switches to alternative time slot not recently used
   - Logs rotation decisions for debugging

4. **Audience Extraction** (Lines 1523-1529):
   ```typescript
   if (matchingSlot?.audiences && Array.isArray(matchingSlot.audiences)) {
     targetAudienceText = matchingSlot.audiences.join(', ')
   } else if (audienceFramework.primaryAudiences && Array.isArray(audienceFramework.primaryAudiences)) {
     // Fallback to primary audiences if no time slot match
     targetAudienceText = audienceFramework.primaryAudiences.slice(0, 5).join(', ')
   }
   ```
   Extracts audiences from matched slot, or uses primaryAudiences as fallback

5. **Fallback to audience_segments** (Lines 1533-1563):
   - Only used if audience_framework.timeSlots not available
   - Time-based filtering (current hour matches timing.hour_start-hour_end)
   - Priority weighting (primary segments first)
   - Optimization: Pre-filters to active segment only (saves ~2,000 tokens)

**What Works Well**:
✅ Programme-based audience matching aligned with Weekly Plan architecture
✅ Time slot rotation prevents programme repetition (last 3 posts check)
✅ Fallback chain provides backward compatibility (framework → segments → target_audience)
✅ Hour range mapping handles programme service times intelligently
✅ Wraparound handling for late-night programmes (Cocktails 20:00-03:00)
✅ Coverage-aware rotation suggests alternative programmes when primary overused

**What's Missing**:
✅ ~~No `audience_framework.timeSlots` integration~~ **IMPLEMENTED** (lines 1446-1532)
✅ ~~No location context layering~~ **IMPLEMENTED** (lines 1648-1677, confirmedFacts)
✅ ~~Business character not in prompts~~ **IMPLEMENTED** (line 2380, confirmedFacts)
❌ No seasonal audience shifts (summer tourists vs winter locals)
❌ No "avoid this audience" logic (office lunch suggested on Sunday)
⚠️ Programme hour ranges are hardcoded approximations (should come from business data or timeSlots)

**Contradictions** (Resolved as of 1. maj 2026):
✅ ~~Programme source mismatch~~ **RESOLVED** - Both now use audience_framework.timeSlots
✅ ~~Audience format divergence~~ **RESOLVED** - Both use audience_framework (segments as fallback)
⚠️ Time slot boundaries still need alignment (programme names vs explicit hours)

---

## Part 3: Persona/Audience Framework Analysis

### Schema Evolution

**Stage 1: Legacy (target_audience)**
```json
{
  "primary": "Unge professionelle og turister",
  "characteristics": ["Værdsætter kvalitet", "Søger unikke oplevelser"]
}
```
- Simple text description
- No time dimension
- No priority weighting
- Used by: Old brand profiles only

**Stage 2: B5 Segments (audience_segments)**
```json
{
  "segments": [
    {
      "label": "Morgengæster",
      "priority": "primary",
      "who": "Lokale på vej til arbejde + weekend-familier",
      "motivation": "Quick caffeine fix eller rolig weekend-brunch",
      "timing": [
        { "day": "weekday", "hour_start": 7, "hour_end": 10 },
        { "day": "weekend", "hour_start": 8, "hour_end": 12 }
      ]
    }
  ]
}
```
- Time-specific segments
- Priority weighting
- Motivation-driven
- Used by: **Dagens Forslag** (current)

**Stage 3: Framework (audience_framework)**
```json
{
  "primaryAudiences": ["Lokalbefolkning", "Turister"],
  "timeSlots": [
    {
      "programmes": ["Brunch", "Morgenkaffe"],
      "audiences": ["Morgengæster", "Kaffe-to-go", "Weekend-familien"],
      "contexts": ["Weekend-brunch", "Quick caffeine fix"]
    }
  ],
  "locationContexts": [
    {
      "type": "waterfront_tourist",
      "audiences": ["Turister søger destination dining"],
      "priority": "primary"
    }
  ]
}
```
- Multi-dimensional (time + location + programme)
- Programme-audience mapping
- Location-specific audiences
- Used by: **Weekly Plan** (current)

### System Divergence (Status Updated 1. maj 2026)

| Aspect | Weekly Plan | Dagens Forslag | Status |
|--------|-------------|----------------|--------|
| **Persona Source** | audience_framework.timeSlots | audience_framework.timeSlots (fallback: segments) | ✅ **UNIFIED** |
| **Programme Source** | timeSlots.programmes | timeSlots.programmes (via hour mapping) | ✅ **UNIFIED** |
| **Location Context** | locationContexts layered | location_intelligence in confirmedFacts | ✅ **IMPLEMENTED** |
| **Time Matching** | Programme name (Brunch, Frokost) | Programme hour range mapping | ⚠️ **DIFFERENT APPROACH** |
| **Priority** | Implied by timeSlot order | audience_segments.priority field (fallback only) | ⚠️ **MINOR DIFFERENCE** |
| **Motivation** | contexts[] per timeSlot | Extracted from timeSlot audiences | ✅ **COMPATIBLE** |

**Why This Matters** (Updated Assessment):

1. ✅ ~~Data Duplication~~ **RESOLVED** - Both use same audience_framework source
2. ✅ ~~Update Burden~~ **ELIMINATED** - Single schema to maintain
3. ✅ ~~Consistency Risk~~ **ELIMINATED** - Single source of truth
4. ✅ ~~Feature Parity~~ **ACHIEVED** - Both have location context
5. ⚠️ **Remaining**: Hour range mapping should be data-driven, not hardcoded

**Recommendation**: ~~Unify on audience_framework~~ **COMPLETE** ✅  
**Next Step**: Add explicit hour ranges to audience_framework.timeSlots schema

---

## Part 4: What Works Well

### ✅ Strengths Across Both Systems

1. **Programme Rotation Tracking**
   - Weekly Plan: 4-week lookback with priority scoring
   - Dagens Forslag: 7-day lookback with last-3-posts switching
   - Result: Balanced content across all service periods (no more Cocktails overindexing)

2. **Weather Integration**
   - Consistent outdoor suitability gate (temp ≥ 15°C, wind < 5 m/s)
   - Weekly Plan: Pattern detection (sunny_week, cold_snap) for strategic planning
   - Dagens Forslag: Real-time current + 24h for immediate suggestions
   - Result: Weather-appropriate content (no outdoor posts in rain)

3. **Menu Data Flow**
   - Clean extraction: menu_results_v2 → structured_data → AI prompts
   - Category blocklist prevents junk (børnemenu, surcharges)
   - Signature flags prioritize hero dishes
   - Result: Quality menu item suggestions, not side orders or kids meals

4. **Brand Voice Consistency**
   - tone_of_voice rules applied in both systems
   - never_say list enforced (post-processing removes banned phrases)
   - signature_phrases boost brand vocabulary
   - Result: On-brand content across tactical and strategic generation

5. **Tier-Based Feature Gating**
   - Free tier: 5 menu items, 5 daily suggestions
   - Smart: 3 weekly posts, full menu
   - Pro: 1-7 weekly posts (user-selected), full menu
   - Result: Clear value ladder, no feature leakage

6. **Dish Deduplication**
   - Weekly Plan: 14-day lookback prevents repetition
   - Dagens Forslag: Not implemented (but daily rotation provides variety)
   - Result: Fresh content without repeating same dishes weekly

7. **Historical Pattern Learning**
   - Weekly Plan: 6-week strategy analysis for variety
   - Engagement proxy (selection rate) suggests what resonates
   - Result: Adaptive strategy that learns from user preferences

### ✅ Recent Improvements (From Priority 1 Quick Wins)

1. **Kitchen Close Time Gate** (Dagens Forslag)
   - Now prevents food suggestions within 30 min of kitchen close
   - Enables bar/drinks content in gap between kitchen close and venue close
   - Result: Relevant suggestions for late-night bar service

2. **Business Character Injection** (Weekly Plan)
   - Hybrid type descriptor (e.g., "café-bar hybrid") now in brand_voice context
   - Adds nuance to voice interpretation
   - Result: Better hybrid business voice calibration

3. **Price Level Manual Override** (UI)
   - Users can now override derived price level (Budget/Mid/Premium)
   - Affects language formality in future prompt updates
   - Result: Brand positioning control independent of menu prices

4. **Post Length Guidelines Save** (UI)
   - Length targets now saved to database
   - Ready for future prompt integration
   - Result: Brand-specific length preferences captured

---

## Part 5: Gaps, Missing Elements & Contradictions

### ❌ Critical Gaps

**VERIFIED STATUS (1. maj 2026)**:

1. ✅ **Persona Schema Divergence** — **RESOLVED**
   - **Status**: ALREADY IMPLEMENTED (discovered during verification)
   - **Location**: Lines 1446-1532 in get-quick-suggestions/index.ts
   - **Implementation**: audience_framework.timeSlots with programme rotation, fallback to audience_segments
   - **Effort**: 0 hours (already complete)

2. ✅ **Business Character Not in Dagens Forslag Prompts** — **RESOLVED**
   - **Status**: ALREADY IMPLEMENTED (discovered during verification)
   - **Location**: Line 2380 (prompt injection), lines 1925-1927 (confirmedFacts)
   - **Implementation**: businessCharacterText injected into sharedCtx and confirmedFacts
   - **Effort**: 0 hours (already complete)

3. ✅ **Location Context Missing in Dagens Forslag** — **RESOLVED**
   - **Status**: ALREADY IMPLEMENTED (discovered during verification)
   - **Location**: Lines 1648-1677 in get-quick-suggestions/index.ts
   - **Implementation**: location_intelligence processed, matched_motivations and marketing_focus added to confirmedFacts
   - **Effort**: 0 hours (already complete)

4. ✅ **Price Level Not Used for Tone Calibration** — **NEWLY IMPLEMENTED**
   - **Status**: IMPLEMENTED (1. maj 2026)
   - **Location**: Lines 2374-2383 in get-quick-suggestions/index.ts
   - **Implementation**: Budget/Casual/Premium formality hints in priceLevelFormalityHint
   - **Effort**: 2 hours (complete)

5. **Social Lead Flag Not Read**
   - **Issue**: Menu sources can be marked `is_social_lead` but flag ignored
   - **Impact**: Primary menu (dinner) vs secondary (drinks) not prioritized
   - **Fix**: Boost item priority when menu is social lead
   - **Effort**: Medium (4 hours)

6. **Programme Revenue Weights Not Implemented**
   - **Issue**: `calculateProgrammePriorities()` has revenue parameter but always null
   - **Impact**: Cannot prioritize high-revenue programmes (Dinner > Cocktails)
   - **Fix**: Add UI for revenue weight input, backend integration
   - **Effort**: High (16 hours - UI + backend + rotation logic)

7. ⏳ **Kitchen Close Time Not in Weekly Plan** — **PARTIAL**
   - **Issue**: Dagens Forslag ✅ implemented, Weekly Plan scheduling ⏳ pending
   - **Impact**: Weekly Plan may schedule food posts after kitchen closes
   - **Fix**: Add kitchen close time to Phase 2 scheduling constraints
   - **Effort**: Low (2-3 hours remaining)

8. ⏳ **Post Length Guidelines Not in Prompts** — **PARTIAL**
   - **Status**: ✅ Dagens Forslag (lines 1710-1719), ✅ Weekly Plan context (line 1223), ⏳ Weekly Plan prompt injection pending
   - **Impact**: Dagens Forslag has length control, Weekly Plan needs prompt integration
   - **Fix**: Inject post_length_guidelines into Phase 1/2 prompts in Weekly Plan
   - **Effort**: Low (3-4 hours remaining)

9. **Seasonal Audience Shifts Not Modeled**
   - **Issue**: Summer tourists vs winter locals treated identically
   - **Impact**: Winter content may target summer audiences
   - **Fix**: Add seasonal_relevance to audience_segments or timeSlots
   - **Effort**: High (12 hours - schema + generation logic)

10. **No "Avoid This Audience" Logic**
    - **Issue**: Office lunch suggested on Sunday when offices closed
    - **Impact**: Irrelevant content for day/time
    - **Fix**: Add day_exclusions to audience timing rules
    - **Effort**: Medium (6 hours)

### ⚠️ Contradictions (Status Updated 1. maj 2026)

**✅ RESOLVED**:

1. ✅ **Programme Source Mismatch** — **RESOLVED**
   - ~~Weekly Plan: Extracts from audience_framework.timeSlots.programmes~~
   - ~~Dagens Forslag: Derives from hour + business_character text parsing~~
   - **Current state**: Both systems now use audience_framework.timeSlots as primary source
   - **Evidence**: Lines 1446-1532 in get-quick-suggestions/index.ts show programme extraction from timeSlots

2. ✅ **Business Character Usage** — **RESOLVED**
   - ~~Weekly Plan: In brand_voice.business_character (injected)~~
   - ~~Dagens Forslag: Loaded but NOT in prompts~~
   - **Current state**: Injected in both systems
   - **Evidence**: Line 2380 (prompt), lines 1925-1927 (confirmedFacts) in Dagens Forslag

3. ✅ **Location Context Layering** — **RESOLVED**
   - ~~Weekly Plan: Overlays locationContexts on timeSlot audiences~~
   - ~~Dagens Forslag: No location awareness~~
   - **Current state**: Dagens Forslag processes location_intelligence and injects into confirmedFacts
   - **Evidence**: Lines 1648-1677 in get-quick-suggestions/index.ts

**⚠️ REMAINING**:

**⚠️ REMAINING**:

1. **Audience Priority Weighting**
   - **audience_framework**: Implicit priority (timeSlot order, locationContext.priority)
   - **audience_segments**: Explicit priority field (primary/secondary/niche)
   - **Risk**: Same segment different priority in two schemas (if both populated)
   - **Fix**: Standardize on explicit priority field in audience_framework
   - **Impact**: Low (both systems handle fallback gracefully)

2. **Time Slot Boundaries**
   - **timeSlots**: Programme-defined (Brunch = "Brunch", no explicit hours)
   - **audience_segments**: Hour-defined (timing.hour_start/hour_end)
   - **Risk**: Brunch timing ambiguous (8-12? 9-14? 10-15?)
   - **Current workaround**: getProgrammeHourRange() maps programme names to hour ranges (lines 1456-1463)
   - **Fix**: Add explicit hour ranges to audience_framework.timeSlots schema
   - **Impact**: Medium (affects time matching accuracy)

3. **Post Length Targets**
   - **No standardization** across systems yet
   - Weekly Plan: Longer strategic narratives (250-350 chars typical)
   - Dagens Forslag: Variable (150-250 chars typical) + ✅ NOW has length guidelines
   - **Status**: Dagens Forslag ✅ using post_length_guidelines, Weekly Plan ⏳ pending
   - **Fix**: Complete Weekly Plan prompt integration (3-4 hours)
   - **Impact**: Low (both systems functional, standardization improves consistency)

### 🔧 Data Quality Issues

1. **Menu Highlights Fallback Cascade**
   - 3 extraction paths: signatureItems → menuCategories → menu_structure
   - Indicates inconsistent data source reliability
   - Fix: Standardize on menu_results_v2.structured_data as single source

2. **Opening Hours Duplication**
   - Stored in opening_hours table
   - Cached in UI state (BusinessProfilePage)
   - Risk: Sync issues if database updated outside UI
   - Fix: Always read from database, no client-side caching

3. **Price Level Derivation**
   - Auto-calculated from menu average
   - Now manually overrideable (✅ implemented)
   - Risk: User override forgotten after menu re-extraction
   - Fix: Persist override flag, don't auto-recalculate if manually set

4. **Programme Name Normalization**
   - No standard vocabulary (Brunch vs Morgenmad vs Breakfast)
   - Different sources use different terms
   - Risk: Rotation tracking misses variations
   - Fix: Canonical programme name mapping (normalize to Danish standard terms)

5. **Location Intelligence Re-runs**
   - Expensive Google Maps API calls
   - No cache invalidation logic
   - Risk: Unnecessary API costs on every page load
   - Fix: Cache with explicit "Re-analyze" button trigger

---

## Part 6: Recommendations

### Immediate (Priority 1) — ✅ ALL COMPLETE

1. ✅ Post Length Guidelines save handler
2. ✅ Price Level manual override
3. ✅ Business Character in Weekly Plan prompts
4. ✅ Kitchen Close Time gate in Dagens Forslag

### Priority 2 Implementation Results (1. maj 2026) — 5 of 6 COMPLETE

5. ✅ **Unify Persona Schema** — **ALREADY IMPLEMENTED**
   - Status: Discovered existing implementation during verification
   - Location: Lines 1446-1532 in get-quick-suggestions/index.ts
   - Actual effort: 0 hours (already complete)

6. ✅ **Inject Missing Context into Dagens Forslag** — **COMPLETE**
   - ✅ business_character in prompts (line 2380 + confirmedFacts)
   - ✅ location_intelligence in prompts (lines 1648-1677)
   - ✅ price_level → formality mapping (lines 2374-2383)
   - Actual effort: 2 hours (only formality mapping was new work)

7. ⏳ **Kitchen Close Time in Weekly Plan Scheduling** — **PENDING**
   - Status: Data loaded into WeekContext (line 1075)
   - Remaining: Integrate into Phase 2 scheduling logic
   - Remaining effort: 2-3 hours

8. ⏳ **Post Length Guidelines in Prompts** — **PARTIAL**
   - ✅ Dagens Forslag: Extracted and injected (lines 1710-1719)
   - ✅ Weekly Plan: Loaded into context (line 1223)
   - ⏳ Weekly Plan: Prompt integration pending
   - Remaining effort: 3-4 hours

### Next Quarter (Priority 3)

9. **Programme Revenue Weights UI**
   - Build slider interface for revenue priority per programme
   - Integrate with `calculateProgrammePriorities()`
   - Effort: 16 hours

10. **Social Lead Flag Integration**
    - Boost item priority when menu is marked social lead
    - Effort: 4 hours

11. **Seasonal Audience Modeling**
    - Add seasonal_relevance to audience framework
    - Model summer tourists vs winter locals
    - Effort: 12 hours

12. **Avoid-Audience Logic**
    - Add day_exclusions to timing rules
    - Gate office lunch on weekends
    - Effort: 6 hours

### Long-Term (Priority 4)

13. **Programme Name Canonicalization**
    - Standardize on Danish vocabulary
    - Map variations to canonical terms
    - Effort: 8 hours

14. **Location Intelligence Caching**
    - Cache analysis results
    - Explicit "Re-analyze" trigger
    - Effort: 6 hours

15. **Menu Data Source Unification**
    - Single extraction path (menu_results_v2)
    - Remove fallback cascade complexity
    - Effort: 8 hours

---

## Part 7: Implementation Status & Verification (1. maj 2026)

### 🔍 Code Verification Results

During Priority 2 implementation sprint, comprehensive code analysis revealed significant discrepancies between perceived gaps and actual implementation status:

#### ✅ Gaps That Were Already Implemented

1. **Persona Schema Unification** (Gap #1 - Marked "Critical")
   - **Document stated**: "Weekly Plan uses audience_framework, Dagens Forslag uses audience_segments"
   - **Reality**: Dagens Forslag ALREADY uses audience_framework.timeSlots as primary source
   - **Evidence**: Lines 1446-1532 in get-quick-suggestions/index.ts
   - **Implementation includes**:
     - Programme-based time slot matching with hour ranges
     - Programme rotation awareness (checks last 3 posts)
     - Fallback chain: audience_framework → audience_segments → target_audience
     - Coverage-based rotation to alternative programmes
   - **Original effort estimate**: 12 hours → **Actual**: 0 hours (already complete)

2. **Business Character in Dagens Forslag** (Gap #2)
   - **Document stated**: "business_character loaded but NOT yet in Dagens Forslag prompts"
   - **Reality**: ALREADY injected in multiple locations
   - **Evidence**:
     - Line 2380: Injected into sharedCtx prompt block (`Type: ${effectiveVertical}${businessCharacterText ? ` — ${businessCharacterText}` : ''}`)
     - Lines 1925-1927: Added to confirmedFacts (`Stedet er: ${businessCharacterText}`)
     - Line 2446: Used in rationale construction
   - **Original effort estimate**: 2 hours → **Actual**: 0 hours (already complete)

3. **Location Intelligence in Dagens Forslag** (Gap #3)
   - **Document stated**: "location_intelligence, matched_motivations, marketing_focus not used"
   - **Reality**: ALREADY processed and injected
   - **Evidence**: Lines 1648-1677 in get-quick-suggestions/index.ts
   - **Implementation includes**:
     - matched_motivations extracted and formatted (top 3)
     - primary_type added to confirmedFacts ("Beliggenheds-type: waterfront")
     - marketing_focus added to confirmedFacts ("Beliggenheds-hook: ...")
     - tourist_context detection for English dish handling
   - **Original effort estimate**: 2 hours → **Actual**: 0 hours (already complete)

#### ✅ Gaps Newly Resolved (1. maj 2026)

4. **Price Level Formality Calibration** (Gap #4)
   - **Document stated**: "price_level collected but no explicit formality instruction"
   - **Status**: NEWLY IMPLEMENTED during Priority 2 sprint
   - **Evidence**: Lines 2374-2383 in get-quick-suggestions/index.ts
   - **Implementation**:
     - Budget (level 1): "Hold sproget afslappet, direkte, nærværende"
     - Casual/Mid (level 2-3): "Balance mellem tilgængeligt og kvalitetsbevidst"
     - Premium (level 4): "Tillad et mere raffineret sprog"
   - **Actual effort**: 2 hours

5. **Post Length Guidelines Extraction** (Gap #8 - partial)
   - **Document stated**: "Saved to database but not yet used in generation"
   - **Status**: NEWLY IMPLEMENTED in Dagens Forslag, PARTIAL in Weekly Plan
   - **Evidence**:
     - Lines 1710-1719 (Dagens Forslag): Extracted and formatted ("menu_item: 180 tegn")
     - Line 1223 (Weekly Plan): Loaded into brand_voice context
   - **Remaining**: Integration into Weekly Plan Phase 1/2 prompts
   - **Actual effort**: 2 hours (extraction) + 3-4 hours remaining (prompt injection)

6. **kitchen_close_time in WeekContext** (Gap #7 - partial)
   - **Document stated**: "Dagens Forslag uses kitchen_close_time gate, Weekly Plan doesn't"
   - **Status**: NEWLY ADDED to WeekContext, scheduling integration pending
   - **Evidence**: Line 1075 in get-weekly-strategy/index.ts
   - **Remaining**: Phase 2 scheduling constraint logic
   - **Actual effort**: 1 hour (context addition) + 2-3 hours remaining (scheduling)

### 📊 Revised Effort Analysis

**Original Analysis Estimate**: 65 hours (8 working days)

**Actual Breakdown**:
- Already implemented (discovered): ~16 hours of perceived work (gaps 1-3)
- Newly implemented (this sprint): ~5 hours (gaps 4-6 partial)
- Remaining work: ~5 hours (gaps 7-8 completion)
- Priority 3-4 work: ~40 hours (unchanged)

**Total Remaining to Close All Gaps**: ~45 hours (vs 65 original estimate)

### 🎯 Why Gaps Were Missed in Original Analysis

1. **Analysis Method Limitation**
   - Original analysis traced database SELECT statements and major prompt construction blocks
   - Did NOT follow variable assignments through intermediate processing
   - Example: `businessCharacterText` loaded at line 1423, but injection at line 2380 was not traced

2. **Implementation Timing**
   - Some features may have been implemented between analysis creation and review
   - No version control timestamps in analysis to track when gaps were assessed

3. **Code Complexity**
   - get-quick-suggestions/index.ts is ~2700 lines with many nested conditionals
   - Variable usage scattered across large file makes tracing difficult
   - Multiple code paths (tier-based, hybrid vertical detection, etc.)

### ✅ Verification Methodology

To ensure accuracy, each gap claim was verified by:

1. **Direct code reading** at specific line numbers
2. **Grep search** for variable usage across file
3. **Context tracing** from database query → variable → prompt injection
4. **Runtime behavior** confirmation (logging statements)

**All verifications completed**: 1. maj 2026

---

## Conclusion

**Overall Assessment**: ✅ **Excellent Foundation — Most Gaps Already Resolved**

### Strengths
- Both systems successfully balance content across programmes (rotation works)
- Weather integration consistent and reliable
- Menu data flow clean with quality gates
- Brand voice consistency maintained across systems
- **Persona schema unified** (audience_framework.timeSlots in both systems)
- **Business character, location intelligence, price formality** all integrated
- Recent quick wins closed critical gaps (kitchen close, formality calibration, length guidelines)

### Critical Gaps (Revised Status - 1. maj 2026)
1. ✅ **Persona schema divergence** — **ALREADY RESOLVED** (discovered during verification)
2. ✅ **Feature parity** — **ALREADY RESOLVED** (location context in both systems)
3. ✅ **Business character usage** — **ALREADY RESOLVED** (in both systems)
4. ✅ **Price level tone calibration** — **NEWLY RESOLVED** (formality mapping added)
5. ⏳ **Programme revenue weights** — Pending (scoring system ready, no UI for weights)
6. ⏳ **Kitchen close time in Weekly Plan** — Pending (data available, scheduling integration needed)
7. ⏳ **Post length in Weekly Plan prompts** — Pending (data available, prompt injection needed)

### Recommended Path Forward (Updated)

**Phase 1 (This Week)**: Complete remaining Priority 2 tasks
- ✅ ~~Inject missing context~~ (already complete - discovered during verification)
- ⏳ Add kitchen_close_time to Weekly Plan Phase 2 scheduling
- ⏳ Inject post_length_guidelines into Weekly Plan Phase 1/2 prompts
- **Impact**: Full feature parity across both systems
- **Effort**: 5-7 hours remaining

**Phase 2 (Next Month)**: Data quality improvements
- Standardize programme name vocabulary (canonical mapping)
- Add explicit hour ranges to audience_framework.timeSlots
- Cache location intelligence results
- **Impact**: Cleaner data flows, reduced API costs
- **Effort**: 15 hours

**Phase 3 (Next Quarter)**: Revenue-driven rotation
- Build revenue weights UI
- Integrate with programme priority scoring
- Add seasonal audience modeling
- Add "avoid this audience" day exclusions
- **Impact**: Business-aligned content distribution
- **Effort**: 30 hours

**Total Estimated Effort**: ~~65 hours~~ → **15 hours remaining** (most gaps already implemented)

**Implementation Discovery (1. maj 2026)**:
During Priority 2 implementation sprint, code verification revealed that most "critical gaps" were already implemented in earlier work:
- Persona schema unification: ✅ Already complete
- Business character in Dagens Forslag: ✅ Already complete  
- Location intelligence in Dagens Forslag: ✅ Already complete
- Price formality calibration: ✅ Newly added (2 hours)
- Post length guidelines extraction: ✅ Newly added (2 hours)

**Final Implementation (1. maj 2026) - PRIORITY 2 COMPLETE**:
- Kitchen close time in Weekly Plan scheduling: ✅ COMPLETE (phase2b.ts lines 369-386, ~45 min)
- Post length guidelines in Weekly Plan prompts: ✅ COMPLETE (phase1.ts lines 370-377, phase2b.ts lines 451-461/893, ~60 min)
- Total Priority 2 implementation time: ~2 hours (vs. estimated 5-7 hours)

**Remaining Work**:
- Priority 3-4 tasks: ~40 hours

**Last Updated**: 1. maj 2026 (Priority 2 implementation complete)  
**Last Reviewed**: 1. maj 2026 (final verification)  
**Next Review**: After Priority 3 task #1 completion

**See Also**: 
- [PRIORITY-2-IMPLEMENTATION-RESULTS.md](PRIORITY-2-IMPLEMENTATION-RESULTS.md) for verification summary
- [PRIORITY-2-FINAL-IMPLEMENTATION-SUMMARY.md](PRIORITY-2-FINAL-IMPLEMENTATION-SUMMARY.md) for final implementation details
