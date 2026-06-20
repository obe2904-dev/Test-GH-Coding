# Content Generation Data Architecture
**Complete Mapping: Weekly Plan & Dagens Forslag**

> **Documentation Purpose**: This document maps the complete data architecture for our two content generation systems, showing how database information and dynamic data flow into AI-generated content. **NO CODE** — pure analysis and mapping.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Weekly Plan (get-weekly-strategy)](#weekly-plan-get-weekly-strategy)
3. [Dagens Forslag (get-quick-suggestions)](#dagens-forslag-get-quick-suggestions)
4. [Database Tables Reference](#database-tables-reference)
5. [Dynamic Data Sources](#dynamic-data-sources)
6. [Data Flow Comparison](#data-flow-comparison)

---

## System Overview

### Two Content Generation Systems

| System | Function | Trigger | Output | Tier |
|--------|----------|---------|--------|------|
| **Weekly Plan** | Strategic 7-day content calendar | User initiates weekly planning | 3-7 post ideas with scheduling | Smart + Pro |
| **Dagens Forslag** | Quick daily suggestions | User opens dashboard | 3 single-day suggestions | Free + Smart + Pro |

### Key Differences

**Weekly Plan**:
- Comprehensive 7-day strategic planning
- Full brand profile context
- Multi-phase AI generation (Phase 0, 1, 2a, 2b, 2c)
- Historical pattern analysis (6 weeks back)
- Programme rotation tracking (4 weeks)
- Economic timing calculations

**Dagens Forslag**:
- Single-day tactical suggestions
- Lightweight context (top 5 menu items for Free, full menu for Paid)
- Single-phase generation
- Daily quota limits (5 for Free, 100 for Paid)
- Real-time weather integration
- Time-aware service period matching

---

## Weekly Plan (get-weekly-strategy)

### Data Collection Flow

#### **STEP 1: Core Business Data** (Parallel Fetch - 9 queries)

All fetched simultaneously to minimize latency:

1. **business_locations** (`city`, `country`)
   - Purpose: Geographic context for weather and events
   - Filter: `is_primary = true`
   - Usage: Weather API city lookup, contextual calendar country filter

2. **business_location_intelligence** (`neighborhood`, `area_type`, `category_scores`, `location_marketing_hooks`, `latitude`, `longitude`)
   - Purpose: Derived location intelligence (tourist vs local, waterfront vs city centre)
   - Usage: Audience interpretation, location motivation matching
   - Processing: `buildLocationIntelligence()` derives primary_type, matched_motivations, tourist_context

3. **business_operations** (`has_outdoor_seating`, `establishment_type`, `preferred_posts_per_week`, `price_level`)
   - Purpose: Operational constraints and preferences
   - Usage: Outdoor seating weather gate, post count defaults, price register calibration

4. **opening_hours** (`weekday`, `closed`, `open_time`, `close_time`)
   - Purpose: Filter posting days (never suggest closed days), time constraints
   - Filter: `kind = 'normal'`
   - Usage: Builds `availableDays[]` (only open days), `dailyOpenTime{}`, `dailyCloseTime{}` maps

5. **business_brand_profile** (25 fields - full context)
   - Fields: `brand_essence`, `tone_of_voice`, `content_focus`, `target_audience`, `signature_phrases`, `never_say`, `humor_level`, `content_strategy`, `voice_rationale`, `venue_scene`, `visual_character`, `posting_occasions`, `brand_context`, `audience_segments`, etc.
   - Purpose: Complete brand voice and strategic framework
   - Usage: AI prompt context, voice archetype, audience framework (timeSlots with programmes), posting occasions

6. **business_profile** (`menu_signal`)
   - Purpose: Quick menu overview from website analysis
   - Usage: Fallback when menu_results_v2 is unavailable

7. **menu_results_v2** (`structured_data`, `service_periods`, `is_signature`, `ai_summary`, `source_url`)
   - Purpose: Structured menu data with categorization
   - Filter: `status = 'done'`, limit 20
   - Usage: Dish extraction with descriptions, service period detection, AI summary helicopter view
   - Processing: Category-level blocklist (børnemenu, tilvalg), dish-level blocklist (ekstra bacon, surcharges), drink category separation

8. **profiles** (`selected_platforms`)
   - Purpose: Active social media platforms (Facebook, Instagram)
   - Usage: Platform-specific content adaptation
   - Fallback: Both platforms if not set

9. **businesses** (`subscription_tier`)
   - Purpose: Feature gating (Smart vs Pro)
   - Usage: Post count limits (Smart = 3, Pro = 1-7 user-selected)

#### **STEP 2: Economic Timing** (Pure Date Logic)

Function: `calculateEconomicTiming(weekStartDate)`

**Inputs**: Week start date

**Calculations**:
- `payday_week`: Boolean (week 3 or 4 of month)
- `month_position`: String ("early", "mid", "late")
- `days_until_payday`: Number (approximate days to end of month)
- `relative_purchasing_power`: String ("high", "medium", "low")

**Purpose**: Adjust content strategy based on monthly spending cycles
- Early month: Premium offers, higher-ticket items
- Late month: Budget-friendly, value messaging

#### **STEP 3: Contextual Calendar Events**

Source: **contextual_calendar** table

**Query Parameters**:
- `country`: Normalized to ISO-2 code (Danmark → DK)
- `date_start`: Week start to 2 weeks ahead (14-day lookahead)
- Ordered by: `commercial_weight DESC`, `date_start ASC`

**Fields Retrieved**:
- `event_type`: holiday | occasion | season_change | local | school_vacation | cultural
- `event_name`: "Valentinsdag", "Mors Dag", "Pinse"
- `date_start`, `date_end`: Event date range
- `relevance_tags`: Business type matching (cafe, restaurant, bar)
- `content_angle`: Strategic framing ("familie-samvær", "romantisk date")
- `marketing_hook`: Suggested messaging angle
- `commercial_weight`: Priority score (0-100)
- `lead_days`: Recommended prep time before event

**Processing**:
- Filters past events (days_away >= 0)
- Flags `in_week` (event falls within Mon-Sun range)
- Calculates `days_away` from today

**Purpose**: Strategic event awareness (Valentine's Day prep, Mother's Day promotions, holiday adjustments)

#### **STEP 4: Weather Forecast**

Source: **OpenWeatherMap API** (via coordinates from business_location_intelligence)

**Endpoint**: 7-day daily forecast (`onecall` API)

**Data Retrieved** (per day):
- `date`: ISO date string
- `temp_high`, `temp_low`: Daily temperature range (°C)
- `temp_avg`: Average temperature
- `condition`: Weather condition code ("Clear", "Rain", "Clouds", "Snow")
- `condition_da`: Danish translation ("Sol", "Regn", "Skyet", "Sne")
- `precipitation_mm`: Rain/snow amount
- `wind_speed`: Wind speed (m/s)
- `description`: Human-readable Danish description
- `outdoor_suitable`: Boolean (temp ≥ 15°C, wind < 8 m/s, no rain, outdoor seating available)

**Aggregation** (week-level):
- `pattern`: Detected pattern ("sunny_week", "rainy_period", "cold_snap", "warm_spell", "mixed")
- `avg_temp`: Week average temperature
- `outdoor_days`: Count of outdoor-suitable days
- `notable_conditions[]`: Extreme weather flags

**Fallback**: Seasonal weather generator if coordinates missing or API fails
- Winter: 2-8°C, mostly clouds/rain
- Spring: 8-15°C, mixed conditions
- Summer: 18-25°C, mostly sunny
- Autumn: 10-16°C, variable

**Purpose**: Weather-adaptive content (outdoor seating, seasonal dishes, shelter/comfort messaging)

#### **STEP 5: Season Context**

Function: `getRealSeasonContext(weekStartDate, country)`

**Inputs**: Week start date, country code

**Danish Season Mapping** (month-based):
- **Vinter**: December, January, February (focus: comfort food, cozy atmosphere, hearty dishes)
- **Forår**: March, April, May (focus: fresh ingredients, light dishes, renewal themes)
- **Sommer**: June, July, August (focus: outdoor, cold drinks, seasonal produce)
- **Efterår**: September, October, November (focus: harvest, warming dishes, transition)

**Output**:
- `current`: Season name ("vinter", "forår", "sommer", "efterår")
- `transition_state`: "early" | "mid" | "late" (week position within season)
- `strategic_themes[]`: Relevant messaging themes for the season

**Purpose**: Seasonal content alignment, menu item relevance, atmosphere messaging

#### **STEP 6: Historical Data** (Parallel Fetch - 3 queries)

1. **weekly_content_plans** (last 14 days)
   - Fields: `posts`, `generated_at`
   - Purpose: Menu item deduplication (avoid repeating dishes from last 2 weeks)
   - Processing: Extracts `contentSubject.menuItemName`, `contentSubject.dish`, builds `posted_menu_items[]`

2. **weekly_strategies** (last 6 weeks)
   - Fields: `post_ideas`, `selected_idea_ids`, `strategy_rationale`, `narrative`, `strategic_brief`, `week_start`, `week_number`
   - Purpose: Historical pattern analysis for rotation and engagement proxy
   - Processing:
     - Selection patterns: Which goal_mode was selected most (engagement proxy)
     - Previous angle focuses: Strategic themes from last 2 weeks (avoid repetition)
     - Flexible slot DOWs: Which days were used for Slot D (rotate to fresh days)
     - Previous slot content types: Slot-to-category mapping (rotate build_brand vs retain_loyalty)

3. **generated_posts** (last 4 weeks)
   - Fields: `created_at`, `metadata`
   - Purpose: Programme rotation tracking for multi-programme venues
   - Processing: Counts posts per programme, calculates days since last mention

#### **STEP 6d: Programme Rotation** (NEW - 2025-01-20)

Function: `calculateProgrammePriorities(programmes[], recentPosts[], revenueWeights?)`

**Inputs**:
- `programmes[]`: Extracted from `audience_framework.timeSlots[].programmes` in brand profile
- `recentPosts[]`: Last 4 weeks from generated_posts table
- `revenueWeights`: Optional revenue priority per programme (future feature)

**Priority Scoring Algorithm**:
- **Recency weight (0-50 points)**: Exponential decay from days since last mention (28 day cap)
- **Frequency weight (0-30 points)**: Inverse of post count in 4 weeks (cap at 4 posts)
- **Revenue weight (0-20 points)**: Optional revenue-based priority (not yet implemented)

**Output** (ProgrammeCoverage[]):
```
{
  programme: "Frokost",
  posts_last_4_weeks: 2,
  days_since_last_post: 12,
  last_mentioned_date: "2026-04-18",
  priority_score: 68,
  is_underrepresented: false
}
```

**Underrepresented Threshold**: <2 posts in 4 weeks

**Purpose**: Balanced programme coverage for hybrid venues (e.g., Café Faust with Brunch, Frokost, Aftensmad, Cocktails)

**Calendar Context**: `deriveCalendarContext(weekStartDate)`
- `week_of_month`: 1-5
- `is_first_weekend`: Boolean (payday week awareness)
- `is_payday_week`: Boolean (last week of month)

#### **STEP 7: Menu Extraction & Processing**

**Data Sources** (priority order):
1. **menu_results_v2.structured_data** (preferred - full structure)
2. **menu_results_v2.ai_summary** (fallback - helicopter view)
3. **business_profile.menu_signal** (fallback - quick overview)

**Extraction Logic**:

**Category-level Blocklist** (entire categories excluded):
- `børnemenu` / `børn` / `kids` (kids menu)
- `tilvalg` / `ekstra` (add-ons, supplements)
- `snacks` (nachos section, not main dishes)

**Dish-level Blocklist** (individual items excluded):
- `^ekstra\s` (extras like "Ekstra fritter")
- `^hertil\s` (supplement lines)
- `ad libitum` (package deals, not dishes)
- `drikkevarer` / `vinmenu` (drink packages)
- `^glutenfri pasta$` / `^bacon$` (surcharge items)
- Items with no description AND price < 50 DKK (category headers, add-ons)

**Drink Category Diversion** (separate array):
- `drikkevarer` / `drinks` / `cocktails` / `vinkort` / `wine` / `beer` / `øl` / `spiritus` / `bar menu`
- Stored in `drinkItems[]` for optional pairing suggestions

**Name Normalization**:
- ALL-CAPS dish names converted to proper case
- Danish lowercase words preserved: `og`, `med`, `på`, `af`, `i`, `fra`, `til`, etc.
- Example: "KYLLING MED RIS" → "Kylling med ris"

**Enrichment** (from menu_items_normalized table):
- `is_signature`: Item-level signature flag (more granular than menu-level)
- `is_seasonal`: Dish available only in specific season (boost priority in that season)
- `is_limited_time`: Time-bounded offer (always prioritize)

**Final Menu Arrays**:
- `allMenuItems[]`: All parsed dishes with descriptions
- `signatureItems[]`: Items marked as signature
- `drinkItems[]`: Separated drink menu
- `aiSummaryFallback[]`: Name-only entries from AI summary (when structured data unavailable)
- `menuSummaries[]`: Helicopter view summaries per service period
- `menuIntelligenceFacts[]`: Extracted facts (dietary options, drink programs, kids menu availability)

**No Capping**: All dishes flow through (Phase 2b handles per-week deduplication)

---

### WeekContext Object Assembly

All collected data assembled into `WeekContext` object passed to AI generation phases:

#### Business Identity
- `business_id`, `business_name`, `business_type`
- `location`: `{ city, country, postal_code, type, categories[] }`
- `location_intelligence`: `{ primary_type, matched_motivations, tourist_context }`

#### Menu & Service
- `signature_items[]`: All menu items with descriptions, categories, prices
- `drink_items[]`: Separated drink menu
- `menu_summaries[]`: AI-generated overviews per service period
- `service_periods[]`: Detected from menu (Brunch, Frokost, Aftensmad, etc.)
- `has_outdoor_seating`, `has_kids_menu`, `has_takeaway`

#### Opening Hours
- `available_days[]`: ISO dates of open days only
- `daily_open_time{}`: Map of date → opening time
- `daily_close_time{}`: Map of date → closing time

#### Brand Profile
- `brand_voice`: Complete brand profile object
  - `brand_essence`, `tone_of_voice`, `content_focus`
  - `signature_phrases`, `never_say`, `typical_openings`, `typical_closings`
  - `humor_level`, `content_strategy`, `voice_rationale`
  - `venue_scene`, `visual_character`, `brand_context`
  - `audience_framework`: `{ primaryAudiences[], locationContexts[], timeSlots[], seasonalVariation }`
  - `voice_system`: `{ primaryArchetype, programmeSpecific{}, complexity }`
- `posting_occasions[]`: Selected posting types from brand profile

#### Platform & Subscription
- `platforms[]`: Active platforms (facebook, instagram)
- `subscription_tier`: "smart" | "pro"
- `preferred_posts_per_week`: User preference (resolves to 3 for Smart, 1-7 for Pro)
- `owner_note`: Optional user text ("anything special this week?")

#### Contextual Intelligence
- `economic`: Economic timing object (payday_week, month_position, purchasing_power)
- `events[]`: Contextual calendar events (with in_week flag, days_away, strategic_angle)
- `weather`: WeekWeather object (days[], pattern, avg_temp, outdoor_days)
- `season`: Season context (current, transition_state, strategic_themes)

#### Historical Context
- `previous_week`:
  - `posted_menu_items[]`: Dishes from last 2 weeks (deduplication)
  - `posted_content_types[]`: Content categories used
  - `selection_patterns`: Historical engagement proxy (goal_mode preferences)
  - `previous_angle_focuses[]`: Strategic themes from last 2 weeks
  - `previous_flexible_dows[]`: Days used for Slot D (rotate to fresh days)
  - `previous_slot_content_types[]`: Slot-to-category mapping

#### Programme Rotation (NEW)
- `programme_coverage[]`: Priority scores per programme (Brunch, Frokost, etc.)
- `calendar_context`: Week-of-month context (is_first_weekend, is_payday_week)

---

### Strategy Generation Phases

#### **Phase 0: Occasion Resolution**
- Input: `posting_occasions[]` from brand profile, `business_archetype`, `week_mode`
- Logic: Filters posting occasions by archetype (neighborhood_staple vs destination_experience)
- Output: Resolved occasions for the week (e.g., "brunch_moments", "afterwork_drinks")

#### **Phase 1: Strategic Brief**
- Input: Full WeekContext
- AI Model: GPT-4 or Gemini
- Output: Strategic brief with 3-4 content angles, each with:
  - `focus`: Strategic theme label
  - `rationale`: Why this angle matters this week
  - `suggested_days[]`: Recommended posting days
  - `content_direction`: Guidance for content creation

#### **Phase 2a: Slot Assignment**
- Input: Strategic brief, posting occasions, available days
- Logic: Maps angles to specific days, assigns content categories (build_brand, retain_loyalty, drive_footfall)
- Output: Slot metadata for each post (day, slot_id, goal_mode, content_category)

#### **Phase 2b: Idea Generation**
- Input: Slot metadata, menu items, weather, events
- AI Model: Gemini or GPT-4
- Processing:
  - Menu item rotation (avoids dishes from last 2 weeks)
  - Weather adaptation (outdoor vs indoor focus)
  - Event awareness (Valentine's prep, Mother's Day promotion)
  - Programme balance (ensures underrepresented programmes get coverage)
- Output: Detailed post ideas with:
  - `title`, `rationale`, `menu_item_used`, `dish_description`
  - `photo_idea`, `why_explanation`, `cta_intent`
  - `suggested_day`, `suggested_time` (within opening hours)
  - `slot_id`, `goal_mode`, `content_category`, `programme`

#### **Phase 2c: Caption Generation**
- Input: Selected ideas, brand voice, platform
- AI Model: GPT-4 or Gemini
- Output: Final captions (150-300 characters for Facebook, 100-200 for Instagram)

---

## Dagens Forslag (get-quick-suggestions)

### Data Collection Flow

#### **Tier-Based Logic**

**Free Tier**:
- Daily limit: 5 suggestions
- Menu source: `menu_signal` (top 5 signature items, name-only)
- No AI summary or descriptions
- Weather: Current + 24h forecast
- Cache: 24 hours

**Smart/Pro Tiers**:
- Daily limit: 100 suggestions
- Menu source: `menu_results_v2` (full structured menu with descriptions)
- AI summary helicopter view
- Weather: Current + 24h forecast
- Cache: 24 hours

#### **Database Queries** (Parallel Fetch)

1. **businesses** (`name`, `vertical`, `website_url`, `country`)
   - Purpose: Business identity and vertical detection

2. **business_operations** (`has_outdoor_seating`, `has_kids_menu`, `has_takeaway`, `has_table_service`, `kitchen_close_time`, `weekly_programme`, `price_level`)
   - Purpose: Operational constraints and service model

3. **opening_hours** (today's hours only)
   - Query: Filter by current day-of-week
   - Fields: `open_time`, `close_time`, `closed`
   - Purpose: Time-slot calculations, never suggest before opening

4. **business_locations** (`postal_code`, `city`, `country`)
   - Filter: `is_primary = true`
   - Purpose: Weather API city lookup

5. **menu_results_v2** (Smart/Pro only)
   - Fields: `structured_data`, `ai_summary`, `service_periods`, `cuisine_style`
   - Filter: `status = 'done'`
   - Processing: Same blocklist logic as Weekly Plan
   - Output: Categorized menu with descriptions

6. **business_profile** (`menu_signal`)
   - Free tier primary source
   - Fields: `signatureItems[]`, `cuisineStyle`
   - Fallback for Smart/Pro when menu_results_v2 unavailable

7. **business_brand_profile** (40+ fields - FULL CONTEXT)
   - All brand voice fields (same as Weekly Plan)
   - Audience framework with timeSlots/programmes
   - Voice system with archetypes
   - Never-say lists, signature phrases
   - Purpose: Brand-consistent suggestion generation

8. **generated_posts** (last 7 days - NEW 2025-01-20)
   - Fields: `metadata.programme`
   - Purpose: Programme rotation awareness (avoid repeating same programme 3 days in row)
   - Processing: Checks if current time slot's programme was used in last 3 posts

#### **Weather Integration**

**Current Weather** (OpenWeatherMap `weather` endpoint):
- Query: By city name + country code
- Fields: `temp` (°C), `wind.speed` (m/s), `weather[0].id` (condition code), `weather[0].description`
- Processing:
  - `isSunny`: Weather ID 800-801 (clear/few clouds)
  - `currentTemp`: Rounded temperature
  - `windSpeedMs`: Wind speed

**24-Hour Forecast** (OpenWeatherMap `forecast` endpoint):
- Query: 8 x 3-hour intervals (24 hours)
- Fields: `main.temp`, `weather[0].main`
- Aggregation:
  - `maxTemp`, `minTemp`: Temperature range
  - `conditions`: Unique weather types (Clear, Clouds, Rain, Snow)
  - Translation: English → Danish ("rain" → "regn", "clouds" → "skyet")

**Outdoor Suitability Gate**:
- Required: `has_outdoor_seating = true`
- Weather criteria: `temp ≥ 15°C` AND `wind < 5 m/s` AND `isSunny = true`
- If unsuitable: Hard prohibition added to AI prompt ("FORBUDT I DAG: Forslå IKKE udeservering")

**Weather Forecast Object**:
```json
{
  "city": "København",
  "until": "i dag og i morgen",
  "temperature": "12°C til 18°C",
  "conditions": "sol, skyet"
}
```

#### **Contextual Calendar Events**

Source: **contextual_calendar** table

**Query**:
- Date range: Today to +7 days
- Country match: Business country
- Ordered by: `commercial_weight DESC`

**Filtering Logic**:
- Family events suppressed if `has_kids_menu = false`
- Outdoor events suppressed if outdoor unsuitable (weather gate)

**Output**: `calendarEventFacts[]` - String array of formatted events
- Format: "Valentinsdag (14. februar, om 5 dage): romantisk date - marketing: præsenter kærlighedsmenu"

#### **Service Period & Audience Matching**

**Time-Aware Slot Detection**:
- Current hour determines active programme
- Programme-to-hour mapping (heuristic):
  - `brunch|morgenmad|breakfast`: 7-12
  - `frokost|lunch`: 11-16
  - `kaffe|kage|eftermiddag`: 14-18
  - `aften|middag|dinner`: 17-23
  - `cocktail|bar|drink`: 20-3 (wraparound)

**Programme Rotation Check** (NEW - 2025-01-20):
- Fetches last 10 posts from `generated_posts`
- Extracts `metadata.programme` from each
- If current programme used in last 3 posts → switch to alternative programme
- Logs rotation decision: `"Programme rotation: switching from [Cocktails] to [Frokost]"`

**Audience Segment Matching**:
- Audience framework: timeSlots with programmes and audiences
- Matches current time to slot
- Extracts `audiences[]` from matching slot
- Fallback: Primary audiences if no time match

**Day Behavior Context**:
- Maps day-of-week to behavioral state
- Sunday: "Søndagsrolig" (brunch focus, afslapning)
- Monday: "Mandags-restart" (energisk, frokostpause)
- Tuesday/Wednesday: "Rolig hverdag" (hverdagsrutine)
- Thursday: "Pre-weekend" (afterwork, socialt)
- Friday: "Fredagsvibes" (festlig, weekend starter)
- Saturday: "Weekendpeak" (brunch, frokost, gæster med tid)

#### **Content-Aware Time Suggestion**

Function: `getContentAwareTime(contentType, title, todayOpenTime, todayCloseTime)`

**Logic**:
- Menu item with "brunch|morgen": 09:00
- Menu item with "frokost|sandwich": 11:00
- Menu item with "aftensmad|bøf": 17:00
- Atmosphere/BTS with "brunch": 10:00 (during service, not after)
- Default: 14:00 (afternoon safe slot)

**Constraints**:
- Lower bound: Never before `open_time + 30 min`
- Upper bound: Never within 60 min of `close_time`
- Midpoint fallback if slot invalid

**Purpose**: Ensures suggestions align with service hours (brunch post at 10:00, not 17:00)

---

### Suggestion Generation

#### **Slot Structure** (3 suggestions always)

**Slot A: Offering** (Menu Item Focus)
- Content type: `menu_item`
- Purpose: Showcase signature dish
- Selection: Prioritizes seasonal, limited-time, signature flags
- Weather adaptation: Outdoor items if suitable, comfort food if cold/rainy
- Time: Content-aware (brunch at 09:00, dinner at 17:00)

**Slot B: Guest Moment** (Experience Focus)
- Content type: Varies (menu_item, atmosphere, behind_scenes)
- Purpose: Emotional connection, day-specific moments
- Day-specific defaults:
  - Sunday: `brunch_moment`
  - Monday-Wednesday: `lunch_moment`
  - Thursday-Friday: `afterwork_moment`
  - Saturday: `brunch_moment`
- Event awareness: Adapts to calendar events (Valentine's, Mother's Day)

**Slot C: Brand Behind** (Behind-the-Scenes)
- Content type: `behind_scenes` or `atmosphere`
- Purpose: Humanize brand, show craft
- BTS Activity Window: Time-aware activity description
  - >2h before open: "Tidlig forberedelse: mise en place, saucer"
  - <2h before open: "Klargøring til service: bordklargøring, den stille time"
  - Just after open: "De første bestillinger, morgenopstart"
  - Near close: "Slutfase: oprydning, klargøring til i morgen"
- Vertical-specific vocabulary (bar: garnisher, sirupper; bakery: deje, ovnopstart)

#### **AI Generation Prompt Structure**

**Context Blocks**:
1. Business identity (name, type, city)
2. Menu overview (signature items or full menu depending on tier)
3. Weather forecast (current + 24h)
4. Season context
5. Outdoor suitability (with hard prohibition if unsuitable)
6. Calendar events (filtered by kids menu, outdoor suitability)
7. Day behavior (Søndagsrolig, Fredagsvibes, etc.)
8. Brand voice (tone, never-say, signature phrases)
9. Target audience (time-aware from audience framework)
10. Service context (open hours, today's active programme)

**Constraints**:
- Never suggest outdoor if weather unsuitable
- Never suggest kids content if no kids menu
- Avoid imperative language in `why_explanation` (factual only)
- Time suggestions within open hours
- Programme rotation awareness (avoid recent programmes)

**Output Format** (per suggestion):
```json
{
  "title": "Morning name",
  "rationale": "Why this idea fits",
  "why_explanation": "Factual reasoning (NOT promotional copy)",
  "photo_idea": "Specific visual direction",
  "media_suggestion": "Photo or video",
  "content_type": "menu_item | atmosphere | behind_scenes",
  "suggested_time": "HH:MM",
  "menu_item_name": "Dish name (if menu_item)",
  "menu_item_description": "Dish description",
  "caption_base": "Draft caption text",
  "cta_intent": "visit | book | explore"
}
```

---

## Database Tables Reference

### Core Business Tables

| Table | Key Fields | Purpose | Used By |
|-------|-----------|---------|---------|
| **businesses** | `id`, `name`, `category`, `vertical`, `country`, `subscription_tier`, `ai_generations_today` | Business identity and tier | Both |
| **business_locations** | `city`, `country`, `postal_code`, `is_primary`, `latitude`, `longitude` | Geographic context | Both |
| **business_location_intelligence** | `neighborhood`, `area_type`, `category_scores`, `location_marketing_hooks`, `latitude`, `longitude` | Derived location insights | Weekly Plan |
| **business_operations** | `has_outdoor_seating`, `has_kids_menu`, `has_takeaway`, `establishment_type`, `preferred_posts_per_week`, `price_level`, `kitchen_close_time`, `weekly_programme` | Operational constraints | Both |
| **opening_hours** | `weekday`, `open_time`, `close_time`, `closed`, `kind` | Service hours | Both |

### Menu & Content Tables

| Table | Key Fields | Purpose | Used By |
|-------|-----------|---------|---------|
| **menu_results_v2** | `structured_data`, `service_periods`, `is_signature`, `ai_summary`, `source_url`, `cuisine_style`, `status` | Structured menu data | Both |
| **menu_items_normalized** | `item_name`, `is_signature`, `is_seasonal`, `is_limited_time` | Item-level flags | Weekly Plan |
| **business_profile** | `menu_signal`, `website_analysis_data` | Quick menu overview | Both (fallback) |

### Brand Profile

| Table | Key Fields | Purpose | Used By |
|-------|-----------|---------|---------|
| **business_brand_profile** | `brand_essence`, `tone_of_voice`, `content_focus`, `target_audience`, `signature_phrases`, `never_say`, `typical_openings`, `typical_closings`, `humor_level`, `content_strategy`, `voice_rationale`, `venue_scene`, `visual_character`, `posting_occasions`, `brand_context`, `audience_segments`, `audience_framework`, `voice_system` | Complete brand identity | Both |

### Historical & Generation Tables

| Table | Key Fields | Purpose | Used By |
|-------|-----------|---------|---------|
| **weekly_content_plans** | `posts`, `generated_at`, `business_id` | Generated weekly plans | Weekly Plan |
| **weekly_strategies** | `post_ideas`, `selected_idea_ids`, `strategy_rationale`, `narrative`, `strategic_brief`, `week_start`, `week_number` | Strategic planning history | Weekly Plan |
| **generated_posts** | `created_at`, `metadata`, `business_id` | Historical post records | Both |
| **daily_suggestions** | `title`, `rationale`, `why_explanation`, `photo_idea`, `media_suggestion`, `content_type`, `suggested_time`, `date`, `is_active`, `weather_forecast` | Dagens Forslag cache | Dagens Forslag |

### Contextual Data

| Table | Key Fields | Purpose | Used By |
|-------|-----------|---------|---------|
| **contextual_calendar** | `event_name`, `event_type`, `date_start`, `date_end`, `country`, `relevance_tags`, `content_angle`, `marketing_hook`, `commercial_weight`, `lead_days` | Seasonal events & holidays | Both |
| **profiles** | `selected_platforms` | User platform preferences | Weekly Plan |

---

## Dynamic Data Sources

### OpenWeatherMap API

**Endpoints Used**:

1. **Current Weather** (`/weather`)
   - Used by: Dagens Forslag
   - Query: `q={city},{country_code}&units=metric&lang=da`
   - Returns: Current temp, conditions, wind speed
   - Purpose: Real-time outdoor suitability, weather-adaptive suggestions

2. **7-Day Forecast** (`/onecall` or `/forecast`)
   - Used by: Weekly Plan
   - Query: `lat={lat}&lon={lon}&units=metric&lang=da`
   - Returns: Daily forecasts with temp range, conditions, precipitation, wind
   - Purpose: Week-long weather pattern detection, strategic outdoor planning

3. **24-Hour Forecast** (`/forecast`)
   - Used by: Dagens Forslag
   - Query: `q={city},{country_code}&cnt=8&units=metric&lang=da`
   - Returns: 8 x 3-hour intervals
   - Purpose: Today + tomorrow conditions for suggestion context

**API Key**: Environment variable `OPENWEATHER_API_KEY`

**Fallback Strategy**: Seasonal weather patterns if API unavailable or coordinates missing

### Coordinate Resolution

**Source**: `business_location_intelligence` table (`latitude`, `longitude`)

**Fallback**: City name geocoding (less precise)

---

## Data Flow Comparison

### Weekly Plan Data Flow

```
USER REQUEST (week_start, business_id)
    ↓
[PARALLEL FETCH - 9 queries]
    • businesses, business_locations, business_location_intelligence
    • business_operations, opening_hours, business_brand_profile
    • business_profile, menu_results_v2, profiles
    ↓
[ECONOMIC TIMING] (pure date logic)
    ↓
[CONTEXTUAL CALENDAR] (events for next 2 weeks)
    ↓
[WEATHER API] (7-day forecast from coordinates)
    ↓
[SEASON CONTEXT] (month-based Danish seasons)
    ↓
[PARALLEL FETCH - 3 queries]
    • weekly_content_plans (last 14 days)
    • weekly_strategies (last 6 weeks)
    • generated_posts (last 4 weeks)
    ↓
[PROGRAMME ROTATION] (calculate coverage priorities)
    ↓
[MENU EXTRACTION] (structured_data → parsed items)
    ↓
[WEEKCONTEXT ASSEMBLY] (all data combined)
    ↓
[PHASE 0] Occasion Resolution
    ↓
[PHASE 1] Strategic Brief (AI)
    ↓
[PHASE 2a] Slot Assignment
    ↓
[PHASE 2b] Idea Generation (AI)
    ↓
[PHASE 2c] Caption Generation (AI)
    ↓
SAVE TO weekly_strategies table
    ↓
RETURN strategy_id + post_ideas
```

### Dagens Forslag Data Flow

```
USER REQUEST (business_id, regenerate?)
    ↓
[QUOTA CHECK] (daily limit: 5 Free, 100 Paid)
    ↓
[CACHE CHECK] (daily_suggestions table, <24h)
    ↓ (if cache hit)
RETURN cached suggestions + weather_forecast
    ↓ (if cache miss or expired)
[PARALLEL FETCH - 8 queries]
    • businesses, business_operations, opening_hours
    • business_locations, menu_results_v2/business_profile
    • business_brand_profile, generated_posts (last 7 days)
    ↓
[TIER-BASED MENU LOAD]
    • Free: menu_signal (top 5, names only)
    • Paid: menu_results_v2 (full structure + descriptions)
    ↓
[WEATHER API - PARALLEL]
    • Current weather (/weather endpoint)
    • 24h forecast (/forecast endpoint, 8 intervals)
    ↓
[OUTDOOR SUITABILITY GATE]
    • temp ≥ 15°C AND wind < 5 m/s AND sunny
    • Hard prohibition if unsuitable
    ↓
[CONTEXTUAL CALENDAR] (events next 7 days, filtered)
    ↓
[TIME-BASED CONTEXT]
    • Current hour → service period (brunch/frokost/aften)
    • Day behavior (Søndagsrolig, Fredagsvibes, etc.)
    • BTS activity window (prep/service/close)
    ↓
[PROGRAMME ROTATION CHECK] (NEW)
    • Check last 3 posts for programme
    • Switch to alternative if recently used
    ↓
[AUDIENCE MATCHING]
    • audience_framework → timeSlots → match current hour
    • Extract audiences for current slot
    ↓
[CONTEXT ASSEMBLY]
    • Business + menu + weather + events + audience + brand voice
    ↓
[AI GENERATION] (single-phase, 3 suggestions)
    • Slot A: Menu item
    • Slot B: Guest moment (day-specific)
    • Slot C: Behind-the-scenes (time-aware)
    ↓
[TIME VALIDATION]
    • Clamp to open_time + 30 min
    • Clamp to close_time - 60 min
    ↓
SAVE TO daily_suggestions table
    ↓
INCREMENT ai_generations_today counter
    ↓
RETURN suggestions + weather_forecast + plannerRationale
```

---

## Key Differences Summary

| Aspect | Weekly Plan | Dagens Forslag |
|--------|------------|----------------|
| **Scope** | 7-day strategic planning | Single-day tactical suggestions |
| **Menu Data** | Full menu (all items, descriptions) | Top 5 (Free) or full menu (Paid) |
| **Historical Depth** | 6 weeks strategies, 14 days plans, 4 weeks posts | 7 days posts (programme rotation only) |
| **Weather** | 7-day forecast, pattern detection | Current + 24h forecast |
| **Events** | 14-day lookahead | 7-day lookahead |
| **Programme Rotation** | Full priority scoring (4 weeks) | Simple recent-use check (last 3 posts) |
| **AI Phases** | Multi-phase (0, 1, 2a, 2b, 2c) | Single-phase generation |
| **Caching** | No cache (regenerate on demand) | 24-hour cache |
| **Quota** | No limit | 5 Free, 100 Paid |
| **Output** | 3-7 scheduled post ideas | 3 unscheduled suggestions |

---

## Programme Rotation Integration (NEW - 2025-01-20)

### Weekly Plan Programme Tracking

**Problem Solved**: Multi-programme venues (e.g., Café Faust with Brunch, Frokost, Aftensmad, Cocktails) were over-emphasizing single programmes, leading to unbalanced coverage.

**Data Flow**:
1. Extract programmes from `audience_framework.timeSlots[].programmes`
2. Fetch `generated_posts` (last 4 weeks)
3. Count posts per programme
4. Calculate priority scores:
   - Recency: Days since last mention (0-50 points)
   - Frequency: Inverse of post count (0-30 points)
   - Revenue: Optional weighting (0-20 points, not yet implemented)
5. Flag underrepresented programmes (<2 posts in 4 weeks)
6. Add to `weekContext.programme_coverage[]`
7. AI uses this in Phase 1/2b to balance programme coverage

### Dagens Forslag Programme Awareness

**Problem Solved**: Quick suggestions were repeating same programme 3 days in a row.

**Data Flow**:
1. Determine current programme from time-of-day
2. Fetch last 10 `generated_posts`
3. Check if current programme in last 3 posts
4. If yes: Switch to alternative programme not recently used
5. Log rotation decision
6. Use alternative programme's audiences for suggestion

**Example**:
```
Current time: 20:30 → Cocktails programme
Last 3 posts: [Cocktails, Cocktails, Aftensmad]
→ Cocktails used 2/3 recent posts
→ Switch to Frokost (not in recent 3)
→ Log: "Programme rotation: switching from [Cocktails] to [Frokost]"
```

---

## End of Document

This mapping represents the complete data architecture as of **2025-01-20** with programme rotation integration.

**Last Updated**: 1. maj 2026
**Maintained By**: System Architecture Team
