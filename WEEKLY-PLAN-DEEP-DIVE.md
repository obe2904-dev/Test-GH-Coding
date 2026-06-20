# Weekly Plan - Deep Dive: Content Ideas & Scheduling Logic

**Version:** 1.0  
**Date:** 2. maj 2026  
**System Version:** v3.0.0 (Three-Phase Architecture)

---

## Executive Summary

Weekly Plan is your **strategic content planning engine** that answers two critical questions every week:

1. **WHAT should we post about?** (Content ideas)
2. **WHEN should we post it?** (Day & time scheduling)

The system uses a **sophisticated three-phase AI pipeline** combined with **deterministic scheduling algorithms** to generate 2-7 contextually relevant posts per week. Unlike simpler content calendars, Weekly Plan doesn't just rotate through menu items—it actively **reads the week's context** (weather, events, season, economic patterns) and **strategically positions** your business to maximize relevance and engagement.

**Key Innovation:** The system separates **strategic thinking** (AI-driven angles) from **execution mechanics** (deterministic scheduling), ensuring both creativity and consistency.

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Phase 0: Contextual Analysis](#2-phase-0-contextual-analysis)
3. [Phase 1: Strategic Brief](#3-phase-1-strategic-brief)
4. [Phase 2: Content Planning](#4-phase-2-content-planning)
5. [How Content Ideas Are Decided](#5-how-content-ideas-are-decided)
6. [How Scheduling Works](#6-how-scheduling-works)
7. [Programme Rotation Logic](#7-programme-rotation-logic)
8. [Time-of-Day Determination](#8-time-of-day-determination)
9. [The Slot System](#9-the-slot-system)
10. [Influence Factors](#10-influence-factors)
11. [AI Models & Costs](#11-ai-models--costs)
12. [Examples & Scenarios](#12-examples--scenarios)

---

## 1. System Architecture

### Three-Phase Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│ PRE-PROCESSING: Data Gathering (deterministic, zero AI cost)       │
│ • Business profile, brand voice, menu items                        │
│ • Location intelligence, opening hours, programmes                 │
│ • Weather forecast (7-day), calendar events                        │
│ • Previous 4 weeks' posts (programme rotation, diversity)          │
│ • Economic timing pattern (salary week, budget week, etc.)         │
│ • Seasonal context (summer/winter audiences)                       │
└──────────────────────┬──────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 0: Contextual Analysis (GPT-4o, ~8s)                         │
│ • Analyzes weekly context (weather + events + season + economic)   │
│ • Identifies key behavioral factors                                │
│ • Determines primary guest motivations this week                   │
│ • No content ideas yet—pure analysis                               │
│ Output: key_factors[] with behavioral insights                     │
└──────────────────────┬──────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 1: Strategic Brief (GPT-4o, ~35s)                            │
│ • Generates 2-7 strategic angles (one per post)                    │
│ • Each angle has: focus, reasoning, content_direction              │
│ • Assigns goal_mode (footfall/brand/loyalty) per angle             │
│ • Assigns content_category (menu/behind_scenes/team/etc.)          │
│ • Determines timing_window (Mon, Wed-Thu, Fri-Sat, etc.)           │
│ • Uses Phase 0 analysis as foundation                              │
│ Output: Strategic angles with execution metadata                   │
└──────────────────────┬──────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 2a: Content Planner (deterministic, 0ms)                     │
│ • Assigns calendar dates to each angle using day algorithm         │
│ • Considers event pins (holidays anchor posts 1-2 days before)     │
│ • Maximizes spread (avoid consecutive days)                        │
│ • Respects timing_window preferences (Wed-Thu for Slot B, etc.)    │
│ Output: Post plan with suggested_day per angle                     │
└──────────────────────┬──────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 2b: Content Detailer (GPT-4o, ~35s × post_count)             │
│ • Generates title, rationale, media_direction per post             │
│ • Sequential (not parallel) to avoid rate limits                   │
│ • Routes to template based on content_category:                    │
│   - product_menu: dish + description + footfall CTA                │
│   - craving_visual: sensory dish visual (no operational detail)    │
│   - behind_scenes: specific scene + time/role anchor               │
│   - team_people: human role + specific fact, soft CTA              │
│ • Deduplicates menu items across posts (tracks used dishes)        │
│ • Enforces timing constraints (no "torsdag" in Monday post)        │
│ Output: Full post details with title, rationale, menu_item_used    │
└──────────────────────┬──────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 2c: Narrative Generator (Gemini 2.5 Flash, ~15s)             │
│ • Synthesizes weekly narrative connecting all posts                │
│ • Explains why this week's plan makes strategic sense              │
│ • Builds context_summary and strategy_reasoning (UI elements)      │
│ Output: Narrative + strategic_priorities summary                   │
└──────────────────────┬──────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────────┐
│ POST-PROCESSING: Validation & Storage                              │
│ • Validates output structure (all required fields present)         │
│ • Cleans "consultant-speak" (removes generic business jargon)      │
│ • Saves to weekly_strategies table                                 │
│ • Returns to frontend for user review/selection                    │
└─────────────────────────────────────────────────────────────────────┘

Total Duration: ~150-200s for 4 posts (varies by post count)
Success Rate: ~98% (validation catches rare AI failures)
```

### Key Design Principles

1. **Separation of Concerns**
   - AI decides **what** (strategic angles, content direction)
   - Deterministic logic decides **when** (calendar dates, times)
   - Result: Predictable scheduling with creative variation

2. **Context-First Strategy**
   - Phase 0 runs BEFORE angle generation
   - Ensures strategic angles are grounded in real behavioral insights
   - Prevents generic "post a dish" recommendations

3. **Sequential Detailing**
   - Phase 2b processes posts one-by-one (not parallel)
   - Each post tracks what previous posts used (menu items, themes)
   - Natural diversity without explicit deduplication prompts

4. **Non-Blocking Architecture**
   - Returns HTTP 202 immediately (~2s)
   - Generation runs in background (EdgeRuntime.waitUntil)
   - Frontend polls for completion
   - No more 504 timeout errors

---

## 2. Phase 0: Contextual Analysis

### Purpose

Analyze the **behavioral context** of the upcoming week without generating content ideas yet. This creates a foundation for Phase 1 to make **grounded strategic decisions** rather than generic recommendations.

### Input Data

```typescript
{
  weather: {
    forecast_7day: [
      { date: "2026-05-05", temp_high: 18, condition: "partly_cloudy", rain: 20 },
      // ...6 more days
    ],
    weekly_average_temp: 16,
    weekly_rain_probability: 30,
    predominant_condition: "partly_cloudy"
  },
  events: [
    { name: "Kristi Himmelfart", date: "2026-05-14", type: "holiday", days_away: 2 },
    { name: "Mors Dag", date: "2026-05-10", type: "special_day", commercial_weight: 5 }
  ],
  season: {
    current: "spring",
    seasonal_mood: "renewal_optimism",
    menu_seasonal_signals: ["rhubarb", "new_potatoes", "outdoor_dining"]
  },
  economic: {
    pattern: "salary_week",  // or "budget_conscious", "december_high", etc.
    timing_this_week: "payday_friday"
  },
  location: {
    area_type: "waterfront",
    tourist_context: "medium",
    commuter_flow: "high_morning"
  },
  business_character: "Moderne frokostbar med fokus på sæsonens grøntsager"
}
```

### AI Task

**Model:** GPT-4o  
**Prompt Length:** ~2,500 tokens  
**Output:** Structured JSON (~1,200 tokens)

The AI identifies **3-5 key behavioral factors** that will influence guest behavior this week:

```json
{
  "key_factors": [
    {
      "type": "weather",
      "factor": "mild_spring_weather",
      "impact": "high",
      "behavioral_insight": "Gæster søger udendørs oplevelser — terrassen bliver primær attraktion.",
      "phase0_factors_used": ["weather:mild_conditions", "seasonal:spring_renewal"]
    },
    {
      "type": "event",
      "factor": "mothers_day_weekend",
      "impact": "high",
      "behavioral_insight": "Familieorienterede reservationer — premium oplevelse med genkendelighed.",
      "phase0_factors_used": ["event:mothers_day"]
    },
    {
      "type": "economic",
      "factor": "salary_week_confidence",
      "impact": "medium",
      "behavioral_insight": "Forbrugstillid er høj — gæster åbne for premium-valg og impulskøb.",
      "phase0_factors_used": ["economic:salary_week"]
    }
  ],
  "week_summary": "En uge hvor mild vejr, Mors Dag og lønningsuge skaber høj gæstetillid og fokus på udeservering.",
  "primary_opportunity": "outdoor_dining_family_occasions",
  "recommended_dayparts": ["lunch", "early_evening"]
}
```

### What Phase 0 Does NOT Do

- ❌ Generate post titles or content ideas
- ❌ Select specific menu items
- ❌ Assign calendar dates
- ❌ Write rationales or media directions

**It ONLY analyzes behavioral context** so Phase 1 can make informed strategic choices.

---

## 3. Phase 1: Strategic Brief

### Purpose

Generate **strategic angles** (one per post) that connect the business's strengths to this week's behavioral context. Each angle is a complete **strategic direction** with execution metadata.

### The Slot System (Core Innovation)

Phase 1 doesn't just generate generic "post about X" recommendations. It uses a **4-slot framework** derived from your Brand Profile's `content_strategy`:

```typescript
{
  content_strategy: {
    goal_blend: { build_brand: 25, drive_footfall: 60, retain_loyalty: 15 },
    content_category_weights: {
      product_menu: 50,
      behind_scenes: 20,
      craving_visual: 15,
      team_people: 10,
      location_atmosphere: 5
    }
  }
}
```

#### Slot Definitions

**Slot A — Primary Footfall Driver**
- `goal_mode`: drive_footfall
- `content_category`: product_menu (or craving_visual if visual-first)
- `timing_window`: Thu-Fri 14:00 (captures dinner decision-making window)
- **Purpose:** Peak commercial post — drives reservations/walk-ins for the weekend

**Slot B — Supporting Footfall**
- `goal_mode`: drive_footfall
- `content_category`: product_menu
- `timing_window`: Wed-Thu 11:00 (mid-week momentum)
- **Purpose:** Maintains footfall cadence, showcases menu variety

**Slot C — Brand Builder**
- `goal_mode`: build_brand
- `content_category`: behind_scenes (or team_people)
- `timing_window`: Mon 09:00 (start-of-week awareness)
- **Purpose:** Builds emotional connection, shareability, no hard CTA

**Slot D — Flexible**
- `goal_mode`: Varies by week context (footfall OR loyalty)
- `content_category`: Varies (event-driven, season-driven)
- `timing_window`: any (uses spread algorithm)
- **Purpose:** Adapts to weekly context (events, weather, gaps in coverage)

### AI Output Structure

```json
{
  "angles": [
    {
      "slot_id": "A",
      "focus": "Weekend-rhubarb special til Mors Dag",
      "weight": 30,
      "goal_mode": "drive_footfall",
      "content_category": "product_menu",
      "timing_window": "Fri-Sat 14:00",
      "promoted_moment": "dinner",
      "reasoning": "Mors Dag søndag → fredag/lørdag er booking-vinduet. Rabarber er i sæson og skaber visuel tiltrækning.",
      "content_direction": "Fremhæv rabarber-dessert med sæsonens friskhed — vis terrasse-stemning — nævn booking-mulighed kl. 14:00 fredag",
      "menu_alignment": "Rabarber-crumble, forårsalat med jordbær",
      "phase0_factors_used": ["event:mothers_day", "seasonal:spring_renewal", "weather:mild_conditions"]
    },
    {
      "slot_id": "C",
      "focus": "Morgenbagning — køkkenets stille ritual",
      "weight": 15,
      "goal_mode": "build_brand",
      "content_category": "behind_scenes",
      "timing_window": "Mon 09:00",
      "promoted_moment": null,
      "reasoning": "Start-of-week brand-building — ingen salgspres, fokus på autenticitet og håndværk.",
      "content_direction": "Vis bageren kl. 06:00, dej på hænder, frisk duft — ingen produkt-push, kun stemning",
      "menu_alignment": null,
      "phase0_factors_used": ["business:craft_focus"]
    },
    // ... 2-5 more angles depending on target_post_count
  ],
  "week_summary": "En uge hvor sæsonens friskhed møder Mors Dag — balance mellem kommerciel relevans og brand-autenticitet.",
  "competitive_advantage": "Netop denne uge er fordelen, at vores rabarber-fokus rammer præcis når gæster planlægger familiemåltider."
}
```

### Key Fields Explained

| Field | Purpose | Example |
|-------|---------|---------|
| `slot_id` | Links to slot system (A/B/C/D) | "A" |
| `focus` | One-line angle description | "Weekend-rhubarb special til Mors Dag" |
| `weight` | Strategic importance (0-50) | 30 |
| `goal_mode` | Post objective | drive_footfall / build_brand / retain_loyalty |
| `content_category` | Content template selector | product_menu / behind_scenes / team_people |
| `timing_window` | Day preference + time | "Fri-Sat 14:00" / "Mon 09:00" / "any" |
| `promoted_moment` | Service period promoted | dinner / lunch / breakfast |
| `reasoning` | Why this angle this week | "Mors Dag søndag → fredag/lørdag er booking-vinduet" |
| `content_direction` | 3-part execution guide | "Fremhæv X — vis Y — nævn Z" |
| `menu_alignment` | Suggested dishes | "Rabarber-crumble, forårsalat" |
| `phase0_factors_used` | Links to Phase 0 insights | ["event:mothers_day", "seasonal:spring_renewal"] |

### How Angles Are Generated

The AI receives a **detailed strategic prompt** (~4,500 tokens) including:

1. **Brand Foundation**
   - Brand essence, tone of voice, target audience
   - Content strategy (goal_blend, category_weights)
   - Voice constraints ("never say X", "always mention Y")

2. **Weekly Context (from Phase 0)**
   - Key behavioral factors (weather, events, economic)
   - Primary guest motivations this week
   - Recommended dayparts

3. **Business Capabilities**
   - Menu items (grouped by service period: breakfast, lunch, dinner)
   - Programme coverage (which programmes need rotation)
   - Opening hours (to avoid scheduling outside service times)

4. **Constraints & History**
   - Previous 2 weeks' angle focuses (avoid repetition)
   - Previous 4 weeks' posted menu items (rotation diversity)
   - Posted days last week (prefer fresh days for Slot D)

5. **Slot Framework**
   - 4-slot definitions (A/B/C/D) with goal_mode and timing_window
   - Content category weights from Brand Profile
   - Goal blend percentages

**The AI's job:** For each slot (up to `target_post_count`), generate a strategic angle that:
- Connects a business strength to a weekly behavioral insight
- Fits the slot's goal_mode and content_category
- Has clear content_direction for Phase 2b to execute
- References specific Phase 0 factors (traceability)

---

## 4. Phase 2: Content Planning

Phase 2 is split into **three sequential sub-phases**: 2a (planning), 2b (detailing), 2c (narrative).

### Phase 2a: Content Planner (Deterministic)

**Duration:** <50ms (pure TypeScript, no AI)  
**Purpose:** Assign calendar dates to each angle using sophisticated day-assignment algorithm

#### Input

```typescript
{
  angles: [
    { slot_id: "A", timing_window: "Fri-Sat 14:00", goal_mode: "drive_footfall" },
    { slot_id: "B", timing_window: "Wed-Thu 11:00", goal_mode: "drive_footfall" },
    { slot_id: "C", timing_window: "Mon 09:00", goal_mode: "build_brand" },
    { slot_id: "D", timing_window: "any", goal_mode: "retain_loyalty" }
  ],
  available_days: ["2026-05-05", "2026-05-06", "2026-05-07", "2026-05-08", "2026-05-09"],
  events: [
    { name: "Mors Dag", date: "2026-05-10", days_away: 5, commercial_weight: 5 }
  ],
  previous_flexible_dows: [2, 4]  // Slot D used Tue & Thu in last 2 weeks
}
```

#### Day Assignment Algorithm

**Step 1: Event Pinning**

High-priority events (holidays, commercial_weight ≥ 4) anchor footfall posts 1-2 days before:

```typescript
// Mors Dag on Sunday May 10
// → Pin a footfall post to Saturday May 9 (1 day before)
// → Ensures lead-up post captures booking window
eventPinDates = ["2026-05-09"]
```

**Step 2: Calendar Sort**

Sort angles by timing_window preference:
- Fixed-day slots (Mon, Wed, Thu) sort by their day number
- Flexible slots (any) sort by goal_mode:
  - brand/loyalty → 1.5 (prefers Tue before footfall slots claim it)
  - footfall → 4.5 (prefers Thu-Fri)

**Step 3: Greedy Assignment**

Process angles in sorted order:

```typescript
// Slot A (Fri-Sat 14:00, footfall) — processes first in Fri-Sat group
// • Event pin exists on Sat May 9 → prefer Sat
// • Check if Sat is unused → YES
// • Assign: suggested_day = "2026-05-09"

// Slot B (Wed-Thu 11:00, footfall) — processes after Mon, before other Thu
// • Preferred DOWs: [3, 4] (Wed, Thu)
// • Wed May 6 unused → assign
// • Assign: suggested_day = "2026-05-06"

// Slot C (Mon 09:00, brand) — processes first (Mon = 1)
// • Preferred DOW: [1] (Mon only)
// • Mon May 5 unused → assign
// • Assign: suggested_day = "2026-05-05"

// Slot D (any, loyalty) — processes last
// • Preferred DOWs: [2, 1, 0, 6, 5, 3, 4] (Tue, Mon, Sun, Sat, Fri, Wed, Thu)
// • Used days: {May 5, May 6, May 9}
// • Unused: [May 7 (Thu), May 8 (Fri)]
// • Apply spread algorithm:
//   - May 7: min gap from used = 1 day
//   - May 8: min gap from used = 1 day
//   - Both tied → use goal_mode DOW preference
//   - Tue preferred for loyalty → but Tue not available
//   - Next preference: Mon (used), Sun (not in available_days)
//   - Fall back to Thu May 7 (better than Fri for loyalty tone)
// • Penalty: Thu in previous_flexible_dows → small -0.5 score
// • Assign: suggested_day = "2026-05-08" (Fri wins despite penalty)
```

**Step 4: Sort by Date**

Final plan sorted chronologically:

```json
[
  { "id": 3, "slot_id": "C", "suggested_day": "2026-05-05", "type": "behind_scenes" },
  { "id": 2, "slot_id": "B", "suggested_day": "2026-05-06", "type": "menu_item" },
  { "id": 4, "slot_id": "D", "suggested_day": "2026-05-08", "type": "atmosphere" },
  { "id": 1, "slot_id": "A", "suggested_day": "2026-05-09", "type": "menu_item" }
]
```

#### Key Algorithm Features

1. **Event Anchoring**
   - Holidays/high-commercial events pin footfall posts 1-2 days before
   - Prevents posting about Mors Dag ON Mors Dag (too late)
   - Mon/Tue events use 2-day lead (avoids weekend posting for weekday events)

2. **Spread Maximization**
   - Flexible slots (timing_window=any) prefer days farthest from assigned posts
   - Avoids Mon-Tue-Wed clustering
   - Ensures even distribution across the week

3. **Consecutive-Day Guard**
   - Algorithm naturally prevents consecutive days
   - Spread scoring penalizes adjacent days
   - Only overridden by explicit fixed-window slots

4. **DOW Variety (Slot D)**
   - Tracks which DOWs were used by flexible slot in last 2 weeks
   - Small penalty (-0.5) for repeating same DOW
   - Encourages weekly variety (not always Thursday)

5. **Goal-Mode Alignment**
   - Footfall posts prefer Wed-Fri (decision-making window)
   - Brand posts prefer Mon-Tue (awareness, no urgency)
   - Loyalty posts prefer Tue (mid-week touchpoint)

---

### Phase 2b: Content Detailer (AI-Powered)

**Model:** GPT-4o  
**Duration:** ~35s per post (sequential processing)  
**Purpose:** Generate title, rationale, media_direction for each post

#### Template Routing

Phase 2b routes each post to a **content template** based on `content_category`:

| Content Category | Template | Menu Items Provided? | CTA Style |
|------------------|----------|---------------------|-----------|
| `product_menu` | Dish + description + footfall CTA | ✅ YES | Hard (time, booking) |
| `craving_visual` | Sensory dish visual, no operational | ✅ YES | Minimal (implicit desire) |
| `behind_scenes` | Specific scene + time/role anchor | ❌ NO | None / soft |
| `team_people` | Human role + specific fact | ❌ NO | Soft (awareness) |

**Critical Design Decision:** Only menu-category posts receive menu items. This prevents Phase 2b from hallucinating dishes in behind-scenes posts ("our chef preparing the croissants" when you don't serve croissants).

#### Sequential Processing

Posts are processed **one at a time** (not parallel) with 800ms delay between each:

```typescript
for (let i = 0; i < contentPlan.length; i++) {
  const slot = contentPlan[i];
  const detail = await generatePostDetail(slot, context, ...);
  postDetails.push(detail);
  
  // Track what this post used
  if (detail.menu_item_used) usedMenuItems.push(detail.menu_item_used);
  if (detail.rationale) usedRationaleThemes.push(detail.rationale.split(/[.,]/)[0]);
  
  // Wait before next post (rate limit protection)
  if (i < contentPlan.length - 1) {
    await sleep(800);
  }
}
```

**Why sequential?**
1. Avoid OpenAI rate limits (4 parallel requests could trigger 429)
2. Enable natural deduplication (each post knows what previous posts used)
3. Force rationale diversity (each post must use a different Phase 0 insight)

#### Prompt Structure (Per Post)

**Length:** ~3,500 tokens  
**Components:**

1. **Timing Block** (prevents day mismatches)
```
═══════════════════════════════════════════════════════════════════════════
📅 DETTE OPSLAG ER TIL: Fredag 9. maj kl. 14:00
═══════════════════════════════════════════════════════════════════════════
⚠️ TIMING-REGEL: Hvis du nævner en ugedag, SKAL det være "fredag".
   FORBUDT: mandag, tirsdag, onsdag, torsdag, lørdag, søndag
```

2. **Template Instructions**
- product_menu: "Start title with dish name. Include description + footfall CTA with time/booking."
- behind_scenes: "Scene + time anchor. NO menu items. NO operational detail. Show atmosphere."

3. **Strategic Context**
- Angle focus from Phase 1
- Phase 0 behavioral insights
- Week summary

4. **CTA Guidance** (modulated by economic timing + voice constraints)
- Salary week: Hard CTA with booking link
- Budget week: Soft invitation, no pricing pressure
- Anti-promotional voice: No urgency words, light invitation only

5. **Menu Items** (if applicable)
- Filtered by service period (promoted_moment = dinner → only dinner dishes)
- Excludes items used in previous posts this week
- Excludes items posted in last 4 weeks

6. **Deduplication Constraints**
```
ALLEREDE BRUGT DENNE UGE:
Menu items: Rabarber-crumble, Forårsalat
Themes: "Mors Dag", "Sæsonens friskhed"

DU SKAL:
- Vælg en ANDEN ret fra menuen
- Led med et ANDET Phase 0-indsigt (weather / location / economic)
```

#### Output Structure

```json
{
  "title": "Rabarber-crumble med vaniljeis — weekendens smagsoplevelse",
  "rationale": "Mild vejr gør terrassen til weekendens hovedattraktion — gæster søger sæsonens friskhed i en afslappet stemning.",
  "media_direction": "Nærbillede af rabarber-crumble på tallerken, vaniljeis smelter let, terrasseborde i baggrunden med solnedgang, varmt lys.",
  "cta_style": "hard_traffic",
  "cta_reasoning": "Fredag 14:00 + Mors Dag søndag = booking-vindue. Lønningsuge = forbrugstillid høj.",
  "menu_item_used": "Rabarber-crumble",
  "service_period_promoted": "dinner",
  "content_type": "menu_item",
  "suggested_day": "2026-05-09",
  "suggested_time": "14:00",
  "angle_focus": "Weekend-rhubarb special til Mors Dag",
  "goal_mode": "drive_footfall",
  "content_category": "product_menu"
}
```

#### Quality Safeguards

1. **Timing Validation**
   - Post for Friday cannot mention "torsdag" or "lørdag"
   - Enforced via timing block + post-processing check

2. **Menu Item Deduplication**
   - Tracks `usedMenuItems[]` across sequential processing
   - Each new post receives updated exclusion list

3. **Rationale Theme Diversity**
   - Extracts first clause of each rationale
   - Forces next post to lead with different Phase 0 insight
   - Prevents "Mild vejr gør..." appearing in all 4 posts

4. **Service Period Alignment**
   - promoted_moment = "dinner" → only dinner menu items provided
   - Prevents "fredag kl. 14:00 — kom til morgenmad" mismatch

5. **CTA Strength Modulation**
   - Anti-promotional voice → softens CTA automatically
   - Budget-conscious week → removes pricing pressure
   - Weekend dinner post → enables "book now" urgency

---

### Phase 2c: Narrative Generator (AI-Powered)

**Model:** Gemini 2.5 Flash  
**Duration:** ~15s  
**Purpose:** Synthesize weekly narrative explaining the strategic plan

#### Input

```json
{
  "post_summary": [
    { "type": "behind_scenes", "title": "Morgenbagning — køkkenets stille ritual", "suggested_day": "2026-05-05" },
    { "type": "menu_item", "title": "Forårsalat med nye kartofler", "suggested_day": "2026-05-06" },
    { "type": "atmosphere", "title": "Terrassen vågner til live — første solaften", "suggested_day": "2026-05-08" },
    { "type": "menu_item", "title": "Rabarber-crumble med vaniljeis", "suggested_day": "2026-05-09" }
  ],
  "week_summary": "En uge hvor mild vejr, Mors Dag og lønningsuge skaber høj gæstetillid",
  "angles": [...] // from Phase 1
}
```

#### Output

```markdown
## Denne uges strategi

**Målet:** Balance mellem autenticitet (brand-building) og kommerciel relevans (Mors Dag + weekend-footfall).

**Hvorfor dette mix?**

- **Mandag** starter stille med morgenbagning — ingen salgspres, fokus på håndværk og følelse.
- **Onsdag** introducerer forårets råvarer (nye kartofler, grønt) — mid-week momentum uden urgency.
- **Torsdag** åbner terrassen — Mors Dag-weekend starter her, destination-stemning.
- **Fredag** rammer booking-vinduet med rabarber-special — familier planlægger søndagsmåltid NU.

**Hvorfor virker det?**

Mild vejr + lønningsuge = gæster søger udeservering + har forbrugstillid. Rabarber er sæsonens hook. Mors Dag giver en deadline som driver handling.

**Undgå:**
- At nævne "Mors Dag" før fredag (for tidligt = generic)
- At pushe salg mandag (ødelægger brand-stemning)
```

---

## 5. How Content Ideas Are Decided

### Decision Hierarchy

```
1. Brand Profile content_strategy (baseline)
   ↓
2. Weekly context signals (Phase 0)
   ↓
3. Programme rotation priority
   ↓
4. Menu item availability (filtered by service period)
   ↓
5. Deduplication constraints (last 4 weeks)
   ↓
6. Slot system enforcement (goal_mode + category)
   ↓
7. Final angle selection (Phase 1 AI)
```

### Example Decision Flow

**Scenario:** Week of May 5, 2026

**Step 1: Brand Profile**
```typescript
content_strategy: {
  goal_blend: { drive_footfall: 60, build_brand: 25, retain_loyalty: 15 },
  content_category_weights: { product_menu: 50, behind_scenes: 20, craving_visual: 15 }
}
// → 4 posts: 2-3 footfall, 1 brand, 0-1 loyalty
```

**Step 2: Phase 0 Analysis**
```json
{
  "key_factors": [
    { "type": "weather", "factor": "mild_spring", "impact": "high" },
    { "type": "event", "factor": "mothers_day", "impact": "high" },
    { "type": "economic", "factor": "salary_week", "impact": "medium" }
  ],
  "primary_opportunity": "outdoor_dining_family_occasions"
}
```

**Step 3: Programme Coverage**
```typescript
programmePriorities: [
  { programme: "Desserts", priority_score: 75 },  // 14 days since last post
  { programme: "Frokost", priority_score: 60 },   // 7 days, underposted
  { programme: "Aftensmad", priority_score: 45 }  // Posted 3 days ago
]
// → Prioritize Desserts, then Frokost
```

**Step 4: Slot Assignment (Phase 1)**

**Slot A (primary footfall, Fri-Sat 14:00):**
- Context: Mors Dag Sunday, salary week, mild weather
- Programme: Desserts (highest priority)
- Angle: "Weekend rabarber-special til Mors Dag"
- **Decision:** Menu post featuring Rabarber-crumble (dessert programme, family occasion, seasonal hook)

**Slot B (supporting footfall, Wed-Thu 11:00):**
- Context: Mid-week, spring renewal
- Programme: Frokost (2nd priority)
- Angle: "Forårsalat med nye kartofler"
- **Decision:** Menu post featuring lunch (Frokost programme, seasonal ingredients, mid-week footfall)

**Slot C (brand, Mon 09:00):**
- Context: Start-of-week, no sales pressure
- Category: behind_scenes (20% weight)
- Angle: "Morgenbagning — køkkenets stille ritual"
- **Decision:** Behind-scenes post (NO menu items, pure atmosphere)

**Slot D (flexible, any timing):**
- Context: First warm week, outdoor dining opportunity
- Category: location_atmosphere (5% weight, but contextually relevant)
- Angle: "Terrassen vågner — første solaften"
- **Decision:** Atmosphere post (leverages weather + location, no hard CTA)

**Step 5: Deduplication**

Phase 2b receives:
- Slot A: Menu items = [Rabarber-crumble, Chokoladekage, Æblekage] ← Desserts, filtered by previous posts
- Slot B: Menu items = [Forårsalat, Rugbrødssandwich, Quiche] ← Frokost, excludes items from last 4 weeks
- Slot C: Menu items = [] ← Behind-scenes gets NO menu (prevents hallucination)
- Slot D: Menu items = [] ← Atmosphere gets NO menu

After Slot A uses Rabarber-crumble:
- Slot B must not use Rabarber-crumble (already tracked in usedMenuItems)

---

## 6. How Scheduling Works

### Day Selection Algorithm (Phase 2a)

Already covered in detail in Section 4. Summary:

```
Priority Order:
1. Event pins (holidays → footfall posts 1-2 days before)
2. Fixed-window slots (Mon, Wed-Thu, Fri-Sat)
3. Flexible slots (any → spread algorithm + goal-mode DOW preference)

Constraints:
• No consecutive days (spread scoring)
• Respect timing_window from Phase 1
• Maximize distance between posts
• Prefer fresh DOWs for flexible slots (avoid repeating last week's pattern)
```

### Time Selection (Phase 2b)

**Source of Truth:** `timing_window` from Phase 1 angle

**Examples:**
- `"Mon 09:00"` → suggested_time = "09:00"
- `"Wed-Thu 11:00"` → suggested_time = "11:00"
- `"Fri-Sat 14:00"` → suggested_time = "14:00"
- `"any"` → Falls back to promoted_moment logic

**Promoted Moment Logic (for timing_window=any):**

```typescript
if (promoted_moment === "breakfast") → 07:00 (or opening time if later)
if (promoted_moment === "lunch") → 11:00
if (promoted_moment === "dinner") → 17:00 (or 2h before dinner service starts)
if (promoted_moment === null) {
  if (goal_mode === "drive_footfall") → 11:00 (default footfall time)
  if (goal_mode === "build_brand") → 09:00 (awareness time)
  if (goal_mode === "retain_loyalty") → 10:00 (mid-morning touchpoint)
}
```

**Opening Hours Constraint:**

```typescript
// Footfall posts can publish up to 2 hours before opening
// (gives time for post to gain reach before service starts)
const minPostTime = openTime - (goal_mode === "drive_footfall" ? 2 : 1) hours;
const maxPostTime = closeTime;

if (suggested_time < minPostTime) suggested_time = minPostTime;
if (suggested_time > maxPostTime) suggested_time = "11:00"; // safe default
```

**Example:**
- Restaurant opens at 12:00 for lunch
- Slot A (footfall, Fri 14:00) → 14:00 is valid (within 12:00-22:00 operating hours)
- Slot C (brand, Mon 09:00) → 09:00 BEFORE opening BUT allowed (brand posts can publish anytime, not tied to service)
- Hypothetical footfall at 08:00 → adjusted to 10:00 (12:00 - 2h early window)

---

## 7. Programme Rotation Logic

### Purpose

Ensure multi-programme venues (e.g., breakfast + lunch + dinner) **rotate coverage** so no programme is neglected for weeks.

### Scoring System

**Formula:** `priority_score = recency (0-50) + frequency (0-30) + revenue (0-20)`

#### Recency Factor (0-50 points)

```typescript
days_since_last_post = today - lastPosted
recencyScore = Math.min(50, (days_since_last_post / 14) * 50)

// Examples:
// 0 days (posted today) → 0 points
// 7 days → 25 points
// 14 days → 50 points
// 21 days → 50 points (capped)
```

**Why 14-day window?** Posts older than 2 weeks are considered "stale" — immediate rotation priority.

#### Frequency Factor (0-30 points)

```typescript
expected_posts_per_4_weeks = 3  // balanced coverage
actual_posts = count of posts in last 4 weeks
frequencyGap = Math.max(0, expected_posts - actual_posts)
frequencyScore = Math.min(30, frequencyGap * 10)

// Examples:
// 3 posts (balanced) → gap=0 → 0 points
// 2 posts (under) → gap=1 → 10 points
// 1 post (severely under) → gap=2 → 20 points
// 0 posts (neglected) → gap=3 → 30 points
```

#### Revenue Weight (0-20 points)

**Optional** (only if business owner sets revenue weights in settings)

```typescript
revenueWeights = { "Aftensmad": 60, "Frokost": 30, "Morgenmad": 10 }
revenueScore = Math.min(20, (weight / 100) * 20)

// Examples:
// Aftensmad (60% revenue) → 12 points
// Frokost (30% revenue) → 6 points
// Morgenmad (10% revenue) → 2 points
```

**If no weights set:** Default = 10 points (equal priority)

### Example Calculation

**Scenario:** Café with 3 programmes, last 4 weeks:

| Programme | Last Posted | Posts (4w) | Days Since | Revenue % | Score Breakdown | Total |
|-----------|------------|-----------|------------|-----------|-----------------|-------|
| Morgenmad | 21 days ago | 0 | 21 | 10% | 50 + 30 + 2 = | **82** |
| Frokost | 7 days ago | 2 | 7 | 30% | 25 + 10 + 6 = | **41** |
| Aftensmad | 3 days ago | 4 | 3 | 60% | 11 + 0 + 12 = | **23** |

**Priority Order:** Morgenmad (82) → Frokost (41) → Aftensmad (23)

**Phase 1 Impact:**
- Slot A (footfall, Fri-Sat 14:00) → likely Aftensmad (dinner slot timing)
- Slot B (footfall, Wed-Thu 11:00) → likely Frokost (lunch slot timing, 2nd priority)
- Slot C (brand, Mon 09:00) → could feature Morgenmad (highest priority, morning timing)
- Slot D (flexible) → fills gap (likely Morgenmad if not covered by Slot C)

**Result:** Balanced coverage across all programmes over 1-2 weeks.

### Canonicalization (Task 3.2)

**Problem:** Programme names can vary ("Aftensmad", "Dinner", "Aften-menu")  
**Solution:** Canonical mapping reduces tracking fragmentation

```typescript
PROGRAMME_VARIATIONS = {
  "Morgenmad": ["breakfast", "morgen", "morgenmad", "morning"],
  "Frokost": ["lunch", "frokost", "middagsmenu"],
  "Aftensmad": ["dinner", "aftensmad", "aften", "evening menu", "dining"],
  "Bar": ["bar", "drinks", "cocktails", "natmenu"],
  "Brunch": ["brunch", "weekend brunch"]
}

// Posted programme: "Dinner" → canonical: "Aftensmad"
// Scored programme: "Aftensmad" → matches correctly
```

---

## 8. Time-of-Day Determination

### Three-Layer System

```
Layer 1: timing_window (from Phase 1 angle)
   ↓ (if timing_window is explicit)
Layer 2: promoted_moment (service period to promote)
   ↓ (if timing_window = "any")
Layer 3: goal_mode default (fallback)
```

### Layer 1: Timing Window (Primary)

**Fixed-window slots have explicit times:**

| Slot | Timing Window | Time Extracted |
|------|--------------|----------------|
| A | "Fri-Sat 14:00" | 14:00 |
| B | "Wed-Thu 11:00" | 11:00 |
| C | "Mon 09:00" | 09:00 |
| D | "any" | → proceed to Layer 2 |

**Parsing logic:**
```typescript
const match = timing_window.match(/(\d{1,2}):(\d{2})/);
if (match) {
  suggested_time = `${match[1].padStart(2, '0')}:${match[2]}`;
}
```

### Layer 2: Promoted Moment (Service Period)

**For timing_window="any"**, Phase 1 provides `promoted_moment`:

```typescript
if (promoted_moment === "breakfast") → 07:00
if (promoted_moment === "lunch") → 11:00
if (promoted_moment === "afternoon") → 14:00
if (promoted_moment === "dinner") → 17:00
if (promoted_moment === "late_evening") → 19:00
```

**Why these times?**
- **07:00:** Breakfast crowd checks social media early morning
- **11:00:** Lunch posts catch 11:00-11:30 decision-making window
- **14:00:** Afternoon coffee/cake crowd (not too early, not dinner)
- **17:00:** Dinner posts publish 2-3h before service (gives reach time)
- **19:00:** Late evening/bar posts for spontaneous plans

### Layer 3: Goal-Mode Default (Fallback)

**If both timing_window="any" AND promoted_moment=null:**

```typescript
if (goal_mode === "drive_footfall") → 11:00  // safe lunch window
if (goal_mode === "build_brand") → 09:00     // early awareness
if (goal_mode === "retain_loyalty") → 10:00  // mid-morning touchpoint
```

### Opening Hours Constraint (All Layers)

**Final validation:**

```typescript
const openTime = getOpeningTime(suggested_day);
const closeTime = getClosingTime(suggested_day);

// Footfall posts: can publish up to 2h before opening
if (goal_mode === "drive_footfall") {
  const earliestTime = subtractHours(openTime, 2);
  suggested_time = Math.max(suggested_time, earliestTime);
}

// Brand posts: no constraint (can publish anytime)
// Loyalty posts: prefer during operating hours but not strict

// Never after closing
suggested_time = Math.min(suggested_time, closeTime);
```

**Example:**
```
Restaurant opens: 12:00
Footfall post timing_window: "Wed 11:00"

Calculation:
• timing_window says 11:00
• Opening is 12:00
• Footfall allows 2h early → earliest = 10:00
• 11:00 >= 10:00 → VALID
• Final: 11:00
```

### Day-of-Week Adjustments

**Weekend vs Weekday:**

```typescript
const dow = getDayOfWeek(suggested_day);
const isWeekend = (dow === 0 || dow === 6); // Sun or Sat

// Weekend dinner posts: later timing preferred
if (isWeekend && goal_mode === "drive_footfall" && promoted_moment === "dinner") {
  // 17:00 → 18:00 (weekend diners plan later)
  suggested_time = "18:00";
}

// Monday brand posts: early to catch work-commute scroll
if (dow === 1 && goal_mode === "build_brand") {
  suggested_time = "09:00"; // start-of-week awareness
}
```

---

## 9. The Slot System

### Why Slots Exist

**Problem:** AI-only content planning produces inconsistent goal distribution week-to-week.

**Example (without slots):**
- Week 1: 3 footfall posts, 1 brand
- Week 2: 4 footfall posts, 0 brand
- Week 3: 2 footfall, 2 loyalty
- Week 4: 3 brand posts, 1 footfall ← no commercial drive

**Result:** Erratic strategy, brand-building neglected for weeks, then over-indexed.

**Solution:** **Deterministic slot framework** overlays AI creativity with consistent structure.

### Slot Definitions (4-Slot Standard)

```typescript
SLOT_FRAMEWORK = {
  A: {
    priority: 1,
    goal_mode: "drive_footfall",
    content_category: "product_menu",  // or craving_visual if visual-first
    timing_window: "Thu-Fri 14:00",
    rationale: "Peak commercial slot — captures weekend dinner/activity decision window"
  },
  B: {
    priority: 2,
    goal_mode: "drive_footfall",
    content_category: "product_menu",
    timing_window: "Wed-Thu 11:00",
    rationale: "Supporting footfall — maintains mid-week momentum, showcases menu variety"
  },
  C: {
    priority: 3,
    goal_mode: "build_brand",
    content_category: "behind_scenes",  // or team_people
    timing_window: "Mon 09:00",
    rationale: "Start-of-week brand-building — emotional connection, no sales pressure"
  },
  D: {
    priority: 4,
    goal_mode: "flexible",  // adapts to context
    content_category: "flexible",
    timing_window: "any",
    rationale: "Context-responsive — fills strategic gaps, adapts to events/weather/season"
  }
}
```

### How Slots Override AI

**Without Slots (Phase 1 only):**
AI generates 4 angles with varying goal_modes:
```json
[
  { "focus": "Rabarber special", "goal_mode": "drive_footfall" },  // AI chose footfall
  { "focus": "Terrassen åbner", "goal_mode": "build_brand" },      // AI chose brand
  { "focus": "Chef's story", "goal_mode": "retain_loyalty" },      // AI chose loyalty
  { "focus": "Weekend brunch", "goal_mode": "drive_footfall" }      // AI chose footfall
]
// Result: 2 footfall, 1 brand, 1 loyalty (could vary wildly week to week)
```

**With Slots (Current System):**
```json
[
  { "slot_id": "A", "focus": "Rabarber special", "goal_mode": "drive_footfall" },    // SLOT A enforced
  { "slot_id": "B", "focus": "Weekend brunch", "goal_mode": "drive_footfall" },      // SLOT B enforced
  { "slot_id": "C", "focus": "Chef's story", "goal_mode": "build_brand" },           // SLOT C enforced
  { "slot_id": "D", "focus": "Terrassen åbner", "goal_mode": "retain_loyalty" }      // SLOT D flexible
]
// Result: 2 footfall, 1 brand, 1 loyalty (consistent structure)
```

**Key Insight:** AI **chooses the angle focus** (what story to tell), slots **enforce the goal** (why we're telling it).

### Slot D: The Flexible Slot

**Adapts to weekly context:**

**Scenario 1: Event Week (Mors Dag)**
```json
{
  "slot_id": "D",
  "goal_mode": "drive_footfall",  // event creates commercial opportunity
  "content_category": "product_menu",
  "timing_window": "Sat 15:00",  // pinned to event lead-up day
  "focus": "Mors Dag-menu med champagne"
}
```

**Scenario 2: Quiet Week (no events)**
```json
{
  "slot_id": "D",
  "goal_mode": "retain_loyalty",  // no urgency, maintain relationship
  "content_category": "team_people",
  "timing_window": "any",  // uses spread algorithm
  "focus": "Vores bartender anbefaler: årstidscocktail"
}
```

**Scenario 3: Weather Week (first warm week)**
```json
{
  "slot_id": "D",
  "goal_mode": "build_brand",  // leverage unexpected weather signal
  "content_category": "location_atmosphere",
  "timing_window": "any",
  "focus": "Terrassen vågner — første solaften"
}
```

### Slot System + Brand Profile Integration

**Brand Profile's content_strategy feeds slot framework:**

```typescript
// From Brand Profile
content_strategy: {
  goal_blend: { build_brand: 40, drive_footfall: 40, retain_loyalty: 20 },
  content_category_weights: {
    product_menu: 30,
    behind_scenes: 25,
    craving_visual: 20,
    team_people: 15,
    location_atmosphere: 10
  }
}

// Slot Framework Adaptation
// 4 posts/week → distribute to match 40/40/20 blend:
// Slots A+B: drive_footfall (2 posts = 50% ≈ 40%)
// Slot C: build_brand (1 post = 25% ≈ 40% underfilled → Slot D helps)
// Slot D: flexible → can be brand OR loyalty (fills to match blend)

// Category weights influence Slot D routing:
// If behind_scenes: 25% → Slot D prefers behind_scenes when goal=brand
// If craving_visual: 20% → Slot A/B can use craving instead of product_menu
```

### Multi-Post Scenarios

**2 posts/week (minimum):**
- Slots A + C (1 footfall + 1 brand)

**3 posts/week:**
- Slots A + B + C (2 footfall + 1 brand) OR
- Slots A + C + D (1 footfall + 1 brand + 1 flexible)

**4 posts/week (Smart tier standard):**
- Slots A + B + C + D (full framework)

**5-7 posts/week (Pro tier):**
- Core slots (A+B+C+D) + additional footfall/loyalty slots
- Additional slots follow same timing_window + goal_mode logic
- E: drive_footfall, Tue 17:00 (dinner supplement)
- F: retain_loyalty, Sat 10:00 (weekend touchpoint)
- G: drive_footfall, Sun 16:00 (weekend dinner)

---

## 10. Influence Factors

### What Influences Content Ideas?

**Ranked by Impact:**

| Factor | Impact | Example |
|--------|--------|---------|
| **Brand Profile** | Critical | content_strategy, brand_essence, tone_of_voice |
| **Slot System** | Critical | goal_mode, content_category, timing_window |
| **Events (holidays)** | High | Mors Dag → family-occasion angle, lead-up timing |
| **Weather** | High | First warm week → outdoor dining, terrace |
| **Season** | Medium-High | Spring → seasonal ingredients (rabarber, nye kartofler) |
| **Economic Pattern** | Medium | Salary week → premium offerings, hard CTA |
| **Programme Rotation** | Medium | Neglected programme gets priority |
| **Previous Posts** | Medium | Deduplication, theme diversity |
| **Location Intelligence** | Low-Medium | Waterfront → mention view, tourist context |
| **Owner Note** | High (when present) | "Vi har tilbud fredag" → injects extra Friday post |

### How Weather Influences Ideas

**Phase 0 Weather Interpretation:**

```typescript
// Input: 7-day forecast
forecast: [
  { temp_high: 22, condition: "sunny", rain: 10 },
  { temp_high: 20, condition: "sunny", rain: 5 },
  // ... 5 more days
]

// Phase 0 Output:
{
  "weather_pattern": "consistently_warm",
  "behavioral_insight": "Gæster søger udendørs oplevelser — terrassen bliver primær attraktion",
  "recommendation": "Prioritize outdoor seating, terrace atmosphere, al fresco dining mentions"
}
```

**Phase 1 Response:**

```json
{
  "slot_id": "D",
  "focus": "Terrassen vågner — første solaften",
  "content_category": "location_atmosphere",
  "phase0_factors_used": ["weather:consistently_warm"],
  "content_direction": "Vis terrasseborde i solnedgangslys — nævn 'første varme aften' — ingen menu-push, kun stemning"
}
```

**Cold/Rain Weather:**

```json
{
  "slot_id": "D",
  "focus": "Hygge indendørs — comfort food til regnvejr",
  "content_category": "product_menu",
  "phase0_factors_used": ["weather:rainy_week"],
  "menu_alignment": "Beef stew, hot chocolate, comfort desserts"
}
```

### How Events Influence Ideas

**Event Types:**

| Type | Commercial Weight | Angle Impact | Timing Impact |
|------|------------------|--------------|---------------|
| holiday | 5 | Family occasion, tradition | Pin 1-2 days before |
| special_day | 3-5 | Gift/celebration opportunity | Pin 1-2 days before |
| school_vacation | 3 | Family-friendly, daytime | Boost weekday lunch |
| cultural_event | 1-2 | Awareness mention | No pin |

**Example: Mors Dag (Mothers Day)**

```typescript
// Event Data
{
  name: "Mors Dag",
  date: "2026-05-10",  // Sunday
  type: "special_day",
  commercial_weight: 5,
  days_away: 5
}

// Phase 0 Analysis
{
  "key_factor": "mothers_day_weekend",
  "behavioral_insight": "Familier planlægger søndagsmåltider — reservationer sker fredag/lørdag",
  "recommendation": "Premium menu items, family-size portions, booking CTA"
}

// Phase 1 Angle (Slot A)
{
  "slot_id": "A",
  "timing_window": "Sat 14:00",  // ← EVENT PIN (1 day before Sunday)
  "focus": "Mors Dag-menu: 3-retters med champagne",
  "goal_mode": "drive_footfall",
  "cta_reasoning": "Booking-vindue er NU — søndagsborde fyldes op fredag/lørdag"
}

// Phase 2a Day Assignment
// → Sat May 9 (1 day before event, within Fri-Sat window)
```

**Event Pin Override:**

Even if Slot A normally prefers Friday, **high-priority event on Sunday pins to Saturday** (1 day before).

### How Season Influences Ideas

**Seasonal Audience Blending (Task 4.3):**

```typescript
// May (month 4) → summer season
seasonalAudiences = {
  summer: ["outdoor_diners", "terrace_seekers", "al_fresco_lunch"],
  winter: [] // not active
}

// Blending: 60% seasonal + 40% time-based
activeAudiences = [
  ...seasonalAudiences.summer × 0.6,
  ...timeBasedAudiences × 0.4
]

// Phase 0 sees:
primary_audience: "outdoor_diners"  // summer audience won
secondary_audience: "weekday_lunch_professionals"  // time-based
```

**Seasonal Menu Signals:**

```typescript
// Brand Profile → menu_seasonal_signals
menu_seasonal_signals: ["rabarber", "nye kartofler", "jordbær", "udendørs"]

// Phase 1 receives:
"Available seasonal hooks: rabarber (spring), nye kartofler (spring)"

// Angle uses it:
{
  "focus": "Forårets friskhed: Nye kartofler med urter",
  "menu_alignment": "Nye kartofler-salat, Rabarber-dessert"
}
```

### How Economic Pattern Influences CTA

**Economic Patterns:**

| Pattern | Spending Confidence | CTA Style | Example |
|---------|-------------------|-----------|---------|
| salary_week | High | Hard (booking, premium) | "Book dit bord — champagne-menu til Mors Dag" |
| december_high | Very High | Hard (urgency) | "Sidste borde til julefrokosten — ring nu" |
| budget_conscious | Low | Soft (value, no pressure) | "Kom forbi til frokost — dagens ret fra 95 kr" |
| normal_spend | Medium | Medium (inviting) | "Vi holder åbent til kl. 22 — drop ind" |
| july_vacation | Low-Medium | Soft (casual) | "Slap af på terrassen — ingen booking nødvendig" |

**Phase 2b CTA Modulation:**

```typescript
// Salary week + footfall post
buildFootfallCta():
  "HARD CTA: Nævn pris af premium-ret, booking-link, urgency (tables fill up)"

// Budget week + footfall post
buildFootfallCta():
  "SOFT CTA: Nævn åbningstider, casual invitation, NO pricing pressure"
```

---

## 11. AI Models & Costs

### Model Usage by Phase

| Phase | Model | Purpose | Duration | Tokens In/Out | Cost/Run |
|-------|-------|---------|----------|---------------|----------|
| Phase 0 | GPT-4o | Contextual analysis | ~8s | 2,500 / 1,200 | $0.018 |
| Phase 1 | GPT-4o | Strategic brief | ~35s | 4,500 / 2,800 | $0.039 |
| Phase 2a | None | Day assignment (TS) | <50ms | 0 / 0 | $0.000 |
| Phase 2b | GPT-4o | Post detail (×4) | ~35s each | 3,500 / 800 | $0.017 each |
| Phase 2c | Gemini Flash | Narrative | ~15s | 2,000 / 600 | $0.001 |

**Total Cost (4-post week):**
- Phase 0: $0.018
- Phase 1: $0.039
- Phase 2b: $0.017 × 4 = $0.068
- Phase 2c: $0.001
- **TOTAL: ~$0.126 per week**

**Monthly Cost (100 businesses, 4 weeks):**
- 100 businesses × 4 weeks × $0.126 = **$50.40/month**

**Compared to Other Systems:**
- Brand Profile: $4/month (one-time per business)
- Dagens Forslag: $36/month (daily 3-slot generation)
- Weekly Plan: $50/month ← **2nd most expensive recurring cost**

### Why GPT-4o for Phases 0, 1, 2b?

**Phase 0 (Contextual Analysis):**
- Requires **multi-hop reasoning** (weather + events + economic → behavioral insight)
- **Abstract pattern recognition** ("warm May + Mors Dag + salary week = outdoor family dining")
- GPT-4o-mini: 60-70% quality (misses second-order effects, generic insights)

**Phase 1 (Strategic Brief):**
- **Strategic thinking** (connect business strengths to weekly context)
- **Danish cultural fluency** (Mors Dag positioning, hygge vs festive tone)
- **Structural coherence** (3-part content_direction, Phase 0 factor linkage)
- GPT-4o-mini: 50-60% quality (falls back to "post a dish" recommendations)

**Phase 2b (Content Detailer):**
- **Creative synthesis** (title + rationale + media_direction)
- **User-facing Danish text** (shown in dashboard, must be polished)
- **Subtle CTA modulation** (economic timing, voice constraints)
- GPT-4o-mini: 70-75% quality (functional but less inspired titles, weaker rationales)

**Phase 2c (Narrative):**
- Uses **Gemini 2.5 Flash** (cost optimization, narrative is secondary to post details)
- Quality: 85-90% vs GPT-4o (acceptable trade-off for $0.014 savings)

### Optimization Opportunities

**Potential (not recommended):**

1. **Switch Phase 2c to GPT-4o-mini** (already using Gemini Flash, can't optimize further)
2. **Switch Phase 0 to GPT-4o-mini** (same as Weekly Plan Phase 0 in AI-MODEL-ASSESSMENT.md)
   - Savings: $0.015 × 4 weeks × 100 = $6/month
   - Risk: Lower behavioral insight quality → weaker Phase 1 angles
3. **Batch Phase 2b posts (parallel processing)**
   - Savings: $0 (same token cost)
   - Risk: Lose natural deduplication, higher rate-limit risk
   - Benefit: Faster generation (150s → 100s)

**Recommended:**
- Keep current model distribution
- Weekly Plan cost ($50/month) is justified by strategic value
- Phase 1 strategic brief quality directly impacts 2,000+ posts/month (100 businesses × 20 posts)

---

## 12. Examples & Scenarios

### Scenario 1: Normal Week (No Events)

**Context:**
- Week of May 5, 2026
- Weather: Mild, partly cloudy, 16-18°C
- No holidays, no school vacation
- Economic: normal_spend
- Business: Casual lunch café with terrace

**Phase 0 Output:**
```json
{
  "key_factors": [
    { "type": "weather", "factor": "mild_spring_weather" },
    { "type": "seasonal", "factor": "spring_renewal" }
  ],
  "primary_opportunity": "outdoor_lunch"
}
```

**Phase 1 Angles (4 posts):**

| Slot | Focus | Goal | Category | Day/Time |
|------|-------|------|----------|----------|
| A | "Fredags-special: Dagens fisk på terrassen" | footfall | product_menu | Fri 14:00 |
| B | "Forårsalat med nye kartofler" | footfall | product_menu | Wed 11:00 |
| C | "Morgenbagning kl. 06:00 — duft af friskbagt" | brand | behind_scenes | Mon 09:00 |
| D | "Terrassen i eftermiddagssolen" | loyalty | location_atmosphere | Thu 15:00 |

**Result:** Balanced week, no urgency, natural rotation.

---

### Scenario 2: Holiday Week (Mors Dag)

**Context:**
- Week of May 5, 2026
- Mors Dag: Sunday May 10
- Weather: Warm, 20-22°C
- Economic: salary_week
- Business: Fine-dining restaurant

**Phase 0 Output:**
```json
{
  "key_factors": [
    { "type": "event", "factor": "mothers_day_weekend" },
    { "type": "economic", "factor": "salary_week_confidence" },
    { "type": "weather", "factor": "warm_weekend" }
  ],
  "primary_opportunity": "family_celebration_dining"
}
```

**Phase 1 Angles (5 posts - event boosts count):**

| Slot | Focus | Goal | Category | Day/Time | Special |
|------|-------|------|----------|----------|---------|
| A | "Mors Dag-menu: 3-retters med champagne" | footfall | product_menu | **Sat 14:00** | **Event pin** |
| B | "Book dit bord til Mors Dag — torsdag deadline" | footfall | product_menu | Thu 11:00 | Booking urgency |
| C | "Køkkenchefen om søndagens menu" | brand | behind_scenes | Mon 09:00 | Pre-event hype |
| D | "Vores signatur-dessert: Perfect til Mors Dag" | footfall | craving_visual | Wed 17:00 | Visual hook |
| E | "Tak for en smuk weekend — vi ses igen snart" | loyalty | team_people | Mon 10:00 (next week) | Post-event |

**Key Points:**
- Event pinning: Slot A moved to Saturday (1 day before Sunday)
- Post count: 4 → 5 (event week boost)
- CTA strength: Hard (salary week + high-commercial event)
- Slot D adapted: craving_visual (supports Slot A commercial push)

---

### Scenario 3: Multi-Programme Venue (Neglected Programme)

**Context:**
- Week of May 12, 2026
- Café with Breakfast + Lunch + Dinner programmes
- Breakfast: 21 days since last post (neglected)
- Lunch: 7 days since last post
- Dinner: 3 days since last post

**Programme Priority Scores:**
- Breakfast: 82 (recency 50 + frequency 30 + revenue 2)
- Lunch: 41
- Dinner: 23

**Phase 1 Response:**

| Slot | Focus | Programme | Reasoning |
|------|-------|-----------|-----------|
| A | "Weekend brunch-buffet" | **Breakfast** | Highest priority (82), fits Fri-Sat timing with "brunch" framing |
| B | "Dagens suppe + rugbrød" | Lunch | 2nd priority, Wed-Thu lunch timing |
| C | "Bagerens morgenritual kl. 06:00" | **Breakfast** | Still highest priority, behind-scenes reinforces breakfast capability |
| D | "Aftensmenu: Sæsonens hovedret" | Dinner | Lowest priority but needs footprint, flexible slot fills gap |

**Result:** Breakfast gets 2 posts (corrects 21-day gap), balanced coverage restored.

---

### Scenario 4: Owner Note Override

**Context:**
- Week of May 5, 2026
- Owner note: "Vi har seafood-tilbud fredag og lørdag"
- Normal 4-post plan

**Standard Phase 2a Output (before owner note):**
```json
[
  { "slot_id": "C", "suggested_day": "Mon May 5" },
  { "slot_id": "B", "suggested_day": "Wed May 7" },
  { "slot_id": "D", "suggested_day": "Thu May 8" },
  { "slot_id": "A", "suggested_day": "Sat May 9" }
]
// → Only Saturday covered (no Friday post)
```

**Owner Note Injection:**
```typescript
// Detect mentioned days: "fredag og lørdag"
mentionedDows = [5, 6]  // Friday, Saturday

// Check coverage:
coveredDays = ["Mon May 5", "Wed May 7", "Thu May 8", "Sat May 9"]
// → Friday NOT covered

// Inject extra post:
{
  "slot_id": "OWNER_NOTE",
  "suggested_day": "Fri May 8",  // ← NEW POST
  "type": "menu_item",
  "angle_focus": "Vi har seafood-tilbud fredag og lørdag",
  "goal_mode": "drive_footfall",
  "content_category": "product_menu"
}
```

**Final Plan (5 posts):**
```json
[
  { "slot_id": "C", "suggested_day": "Mon May 5" },
  { "slot_id": "B", "suggested_day": "Wed May 7" },
  { "slot_id": "D", "suggested_day": "Thu May 8" },
  { "slot_id": "OWNER_NOTE", "suggested_day": "Fri May 8" },  // ← ADDED
  { "slot_id": "A", "suggested_day": "Sat May 9" }
]
```

**Result:** Both Friday AND Saturday get posts mentioning seafood offer.

---

## Summary

### How Content Ideas Are Decided

1. **Brand Profile** sets baseline (goal_blend, category_weights, voice)
2. **Slot System** enforces consistent structure (A/B/C/D framework)
3. **Phase 0** analyzes weekly context (weather, events, economic, season)
4. **Programme Rotation** prioritizes neglected coverage
5. **Phase 1 AI** generates angles connecting #1-#4
6. **Deduplication** ensures variety (menu items, themes)

### How Scheduling Works

1. **Phase 1** assigns `timing_window` per angle (Mon, Wed-Thu, Fri-Sat, any)
2. **Phase 2a** deterministically assigns calendar dates:
   - Event pins (holidays → footfall posts 1-2 days before)
   - Fixed-window slots (Mon/Wed/Fri preferences)
   - Flexible slots (spread algorithm + goal-mode DOW preference)
3. **Phase 2b** extracts time from `timing_window` or falls back to `promoted_moment`
4. **Opening hours constraint** validates times (footfall can post 2h early)

### Key Innovations

- **Contextual-first:** Phase 0 runs BEFORE angle generation (grounded strategy)
- **Deterministic scheduling:** AI decides what, algorithm decides when (consistency)
- **Sequential detailing:** Natural deduplication through ordered processing
- **Slot framework:** Balances AI creativity with structural predictability
- **Event pinning:** High-priority events anchor posts to optimal lead-up days
- **Programme rotation:** Multi-programme venues get balanced coverage automatically

---

**Document End**
