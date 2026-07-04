# Content Pages — Data & AI Flow Analysis

> **Purpose:** Complete mapping of what data is used by the three content creation pages — what is read from the database, what is passed to AI models, and how the user flows through each page.
>
> **Last reviewed:** April 2026  
> **Pages covered:**
> - `/dashboard/create?mode=write` — manual post creation
> - `/dashboard/create?mode=ai` — AI idea-based post creation (Dagens Forslag)
> - `/dashboard/ai-weekly-plan` — AI weekly content plan

---

## Legend

| Symbol | Meaning |
|--------|---------|
| 📖 | Read from database |
| 🤖 | Passed into an AI model prompt |
| 🔄 | Written back to database |
| 🌐 | External API call |
| 🧠 | Derived / calculated client-side (no DB) |
| 🔒 | Paid tier (Smart/Pro) only |

---

## 1. `/dashboard/create?mode=write` — Manual Post Creation

**Component:** `CreatePostPage.tsx` with `activePath = 'write'`  
**No edge functions are called. No AI is involved.**

---

### 1.1 Data Sources

| Source | Fields used | When |
|--------|-------------|------|
| `useConnectionsStore` | `enabledPlatforms` (loaded from `profiles.selected_platforms`) 📖 | On mount |
| `useTierStore` | `currentTier` 🧠 | Always |
| `localStorage` (`p2g_draft_manual`) | Saved post text + photo media stubs | On mount (auto-restore draft) |

---

### 1.2 User Flow

1. **Write step** — blank text editor. Auto-restores any previous draft from localStorage.
2. User types post text manually. Auto-save to localStorage fires on every keystroke (debounced).
3. **Design step** — platform preview. User uploads photo(s), adjusts crop/colour filter, selects platforms.
4. **Publish step** — user picks "now" or a schedule date/time. Manual copy-to-clipboard for posting, or (Pro) direct scheduling.

No database reads or writes beyond loading the enabled platforms on mount.

---

## 2. `/dashboard/create?mode=ai` — AI Ideas (Dagens Forslag)

**Component:** `CreatePostPage.tsx` with `activePath = 'ai-ideas'`  
**Edge functions called:** `get-quick-suggestions`, `generate-text-from-idea`

---

### 2.1 Step 1 — Suggestion Generation (`get-quick-suggestions`)

This edge function runs **Gemini 2.5 Flash** and produces 3 suggestion cards (titles + metadata only — not the final post text).

#### DB tables queried

| Table | Columns read 📖 | Purpose |
|-------|-----------------|---------|
| `businesses` | `quick_suggestions_today, last_quick_suggestions_reset, plan, name, vertical, website_url, country` | Quota check + business identity |
| `daily_suggestions` | `id, title, rationale, why_explanation, photo_idea, content_type, suggested_time, position, menu_item_name, menu_item_description, caption_base, cta_intent, weather_forecast, created_at` | Cache check (re-use today's suggestions if fresh) |
| `business_operations` | `has_outdoor_seating, has_kids_menu, has_takeaway, has_table_service, kitchen_close_time, weekly_programme` | Service model facts |
| `opening_hours` | `open_time, close_time, closed` (today's weekday only) | Today's hours |
| `business_locations` | `postal_code, city, country` | Location for weather lookup |
| `menu_results_v2` | `structured_data, ai_summary, service_period_name, cuisine_style` 🔒 | Full extracted menu |
| `business_profile` | `menu_signal` (signature items) | Free tier / fallback menu |
| `contextual_calendar` | `event_name, event_type, content_angle, marketing_hook, relevance_tags` | Next 7 days of holidays/events |
| `business_brand_profile` | `brand_essence, tone_of_voice, tone_keywords, tone_model, things_to_avoid, content_strategy, content_strategy_confirmed, communication_goal, target_audience, identity_keywords, business_character, what_makes_us_different, humor_level, voice_rationale, recognizable_interior_identity, emotional_promise, content_exclusions, typical_openings, location_intelligence` 🔒 | Full brand profile |
| `business_brand_profile` | `visual_character` 🔒 | Visual tone register |
| `business_brand_profile` | `venue_scene, venue_energy` 🔒 | Scene/atmosphere data |
| `daily_suggestions` | `title, content_type, photo_idea` (last 9) | Anti-repetition history |
| `daily_suggestions` | `menu_item_name, created_at` (last 5 Slot A) | Dish dedup (avoid repeating dishes) |
| `daily_suggestions` | `content_type, slot, selected` (last 30 days) | Selection bias tracking |

#### External APIs

| API | Data fetched 🌐 | Purpose |
|-----|-----------------|---------|
| OpenWeatherMap `/weather` | Current temperature, description, wind speed | Today's weather signal |
| OpenWeatherMap `/forecast` | 24-hour temperature range + conditions | Short-term forecast |

#### What is assembled into the AI prompt (Gemini)

**Context block:**
- Business name, city, effective vertical (`businesses.vertical`)
- Service period hint (derived from opening hours)
- Business character text (`business_character`)
- Cuisine style (`menu_results_v2.cuisine_style` or `menu_signal.cuisineStyle`)
- Weather (temp, description, wind)
- Season (derived from current month)
- Day-of-week name + behaviour model (engagement mode, offering tone)
- Outdoor seating flag + weather suitability
- Kids menu flag, takeaway flag
- Up to 3 calendar events with marketing hooks

**Menu block (Slot A):**
- Full structured categories + items (`menu_results_v2.structured_data`) 🔒
- OR signature items from `menu_signal` (free tier)
- Service period hint + day offering tone
- Recent Slot A dish names to avoid (from `daily_suggestions`)
- AI summaries (`menu_results_v2.ai_summary`) with quoted dish names, dietary options, drink programmes

**Confirmed facts banks (used for Slot B and Slot C):**
- Opening hours, outdoor seating, kids menu, takeaway
- Kitchen-to-close gap (`kitchen_close_time`)
- Today's lines from `weekly_programme`
- For Slot C also: `venue_scene`, `business_character`, `recognizable_interior_identity`, `what_makes_us_different`, `location_intelligence.primary_type + marketing_focus`

**Brand block 🔒:**
- `brand_essence` (anchor)
- `content_strategy.anchors` (up to 3 natural moments; labelled "confirmed" vs "AI-proposed" based on `content_strategy_confirmed` flag)
- `things_to_avoid` + `tone_model.avoid_examples`
- `tone_model.writing_rules` or `tone_of_voice.value` or `tone_keywords` (in that priority order)
- `business_character`, `what_makes_us_different`, `target_audience`, `communication_goal`, `identity_keywords`
- `visual_character`, `venue_scene`, `venue_energy`, `recognizable_interior_identity`
- `voice_rationale` → "🚫 REGISTERVAGT" (for atmosphere/behind-the-scenes ideas)
- `emotional_promise` → "💡 BRANDFØLELSE" (for atmosphere/behind-the-scenes ideas)
- `content_exclusions` → "🚫 ALDRIG I DETTE OPSLAG" (for atmosphere/behind-the-scenes ideas)
- `location_intelligence.matched_motivations` (up to 3, for atmosphere/behind-the-scenes)

**Anti-repetition block:**
- Last 9 suggestion titles + types (exact avoid list)
- Last 30-day content-type selection rates (to break structural bias)
- `buildNeverSayList()` — vertical + country-specific forbidden words (up to 25)

#### Output written to DB 🔄

| Table | Fields written |
|-------|---------------|
| `daily_suggestions` | `id, business_id, date, position, title, rationale, why_explanation, photo_idea, content_type, suggested_time, menu_item_name, menu_item_description, caption_base, cta_intent, slot, is_active=true` |
| `businesses` | `quick_suggestions_today` (quota counter incremented) |

#### Output returned to UI

```
3 suggestion objects:
  title (3–7 word post concept)
  why_explanation (2–3 sentence strategic rationale)
  photo_idea / media_suggestion (3-sentence camera guide)
  content_type (menu_item | atmosphere | behind_scenes)
  suggested_time (HH:MM)
  slot (offering | guest_moment | brand_behind)
  menu_item_name, menu_item_description, caption_base, cta_intent
```

---

### 2.2 Step 2 — Selecting a Suggestion

User sees 3 suggestion cards. Clicks one → `selectedSuggestionData` is stored in Zustand (`usePostCreationStore`).

No DB calls at this point.

---

### 2.3 Step 3 — Text Generation (`generate-text-from-idea`)

Triggered when the user clicks "Brug dette opslag →". **Uses GPT-4o (paid) or GPT-4o-mini (free).**

Cache resolution order before calling the edge function:
1. localStorage draft for this suggestion ID with text already set → restore instantly
2. `daily_suggestions.generated_text` present + platforms match + `text_generation_version >= 8` → use cached
3. Otherwise → call `generate-text-from-idea`

#### DB tables queried (inside the edge function)

| Table | Columns read 📖 | Tier |
|-------|-----------------|------|
| `businesses` | `name, vertical` | All |
| `business_locations` | `city, country` (primary) | All |
| `business_brand_profile` | `brand_essence, tone_of_voice, tone_model, content_strategy, things_to_avoid, voice_constraints, typical_closings, voice_examples, signature_phrases, booking_link, voice_rationale, recognizable_interior_identity, business_character, identity_keywords, humor_level, target_audience, communication_goal, emotional_promise, content_exclusions, typical_openings, location_intelligence` | 🔒 Paid |
| `business_brand_profile` | `visual_character` | 🔒 Paid |
| `business_brand_profile` | `venue_scene` | 🔒 Paid |
| `business_brand_profile` | `booking_link` | Free only |
| `opening_hours` | `open_time, close_time, closed` (today) | All |
| `menu_items_normalized` | `item_name, item_description` (text search on dish name) | All |
| `menu_results_v2` | `structured_data` (top 5) | All (fallback) |

#### What is assembled into the AI prompt (GPT-4o)

**System message:**

| Block | Data source |
|-------|-------------|
| Role definition | Static ("professionel social media content writer for dansk restaurant...") |
| Hospitality register rules | Static (vocabulary enforcement: "restauranten" not "spisestuen") |
| Knowledge fence | Static ("Du kender INGEN fakta ud over hvad der eksplicit fremgår...") |
| `venueCharacter` | `visual_character` — first in brand block, sets tone register |
| `venueIdentity` | `recognizable_interior_identity` — behind_scenes posts only |
| `venueScene` | `venue_scene` — behind_scenes spatial register |
| `contentAnchors` | `content_strategy.anchors` → `.pillars` → `tone_model.content_anchors` (up to 5) |
| `communicationGoal` | `communication_goal` |
| `businessCharacter` | `business_character` |
| `targetAudience` | `target_audience.primary` + segments |
| `identityKeywords` | `identity_keywords` (up to 5) |
| `brandTone` | `tone_of_voice.value` (nulled if ≥3 writing rules present, to avoid duplication) |
| `voiceConstraints` | `voice_constraints.value` |
| `humorLevel` | `humor_level` (only injected if not "moderate") |
| `brandWritingRules` | `tone_model.writing_rules` (capped to 3) |
| `brandGoodExamples` | `tone_model.good_examples` (1–2, interior-fixture words filtered) |
| `brandPreferVocab` | `voice_examples.vocabulary.prefer` (up to 5) |
| `brandAvoidVocab` | `voice_examples.vocabulary.avoid` (up to 5) |
| `brandSignaturePhrases` | `signature_phrases` (up to 2) |
| `thingsToAvoid` | `things_to_avoid` (language, banned phrases, tone constraints) |
| `voiceRationale` | `voice_rationale` → "🚫 REGISTERVAGT" (scene/mood posts only) |
| `emotionalPromise` | `emotional_promise` → "💡 BRANDFØLELSE" (scene/mood posts only) |
| `contentExclusions` | `content_exclusions` → "🚫 ALDRIG I DETTE OPSLAG" (scene/mood posts only) |
| `typicalOpenings[0]` | `typical_openings` — voice rhythm example (scene/mood only) |
| `locationMotivations` | `location_intelligence.matched_motivations` (up to 3; scene/mood only) |
| Gold examples | Static per content path (menu/scene/atmosphere) |
| Five principles | Static (`FAKTAFORBUD` + 5 writing rules) |

**User message ("OPGAVE" block):**

| Block | Data source |
|-------|-------------|
| Business + city + vertical | `businesses.name`, `business_locations.city`, derived vertical |
| Goal directive | `goalMode` (from suggestion metadata) |
| Weekly role frame | `goalMode` + `isWeeklyPlan` flag |
| Hours block | `opening_hours.open_time / close_time` (drive_footfall posts only) |
| INDHOLD block | `menuItemName` + `menuItemDescription` (menu posts); `captionBase` / `whyExplanation` (non-menu) |
| Content-path instructions | Static sensory/structural rules per path |
| CTA | `selectedCta` (from `select-cta.ts`, which uses `ctaIntent` + booking link) |
| Length + format requirements | Static |

**Output format:** `{ "text": "...", "keyword": "..." }` → post-processed, then shaped into:
- `facebook.text`, `facebook.hashtags`, `facebook.cta`
- `instagram.text`, `instagram.hashtags`, `instagram.cta`
- Optional `warnings`

#### Output written to DB 🔄

| Table | Fields written |
|-------|---------------|
| `daily_suggestions` | `generated_text, generated_hashtags, generated_platform_content, generated_at, platforms_generated, text_generation_version` |

---

### 2.4 Steps 4–5 — Design and Publish

Same as write mode. No AI. User uploads/edits photo, selects platforms, then publishes or schedules.

---

## 3. `/dashboard/ai-weekly-plan` — AI Weekly Content Plan

**Component:** `src/app/content/ai-weekly-plan/page.tsx`  
**Edge functions called:** `get-weekly-strategy`, `generate-weekly-plan`

---

### 3.1 Page Load — Existing Plan

On mount the page queries `weekly_content_plans` for this user's most recent plan for the target week.

| Table | Columns read 📖 | Condition |
|-------|-----------------|-----------|
| `weekly_content_plans` | `*` | `user_id + week_start`, latest, limit 1 |
| `weekly_strategies` | `narrative, week_context_snapshot` | Matched `strategy_id` from plan |
| `contextual_calendar` | `event_name, event_type, date_start, date_end, commercial_weight` | Country=DK, date range = plan week |

If a plan exists it is shown immediately. If not, a "Generate" button and an optional owner note textarea are displayed.

**Auto weather refresh** (Thu–Sun only, once per session):

| Source | Data fetched 🌐 |
|--------|-----------------|
| `business_location_intelligence` | `latitude, longitude` 📖 |
| Open-Meteo API (external) | 7-day forecast: `weathercode, temperature_2m_max/min, apparent_temperature_mean, precipitation_probability_max, windspeed_10m_max` |

Weather is only applied in-memory to flag impacted posts (outdoor or weather-dependent keyword detection). Not written to DB.

---

### 3.2 Plan Generation — Phase A: `get-weekly-strategy`

This function produces the strategic layer: a `weekly_strategies` row with `post_ideas` (slot assignments and content directions), `narrative`, and a `week_context_snapshot` (snapshot of all context data, used to avoid re-fetching in the next phase).

#### Trigger
User clicks "Generate new plan". `POST /get-weekly-strategy` with `{ business_id, week_start, regenerate, owner_note }`. Returns HTTP 202 immediately; client polls `weekly_strategies.status` every 3–12 seconds (adaptive backoff, up to 8 minutes).

#### DB tables queried — all in parallel on start

| Table | Columns read 📖 |
|-------|-----------------|
| `business_locations` | `city, country` (primary) |
| `business_location_intelligence` | `neighborhood, area_type, category_scores, location_marketing_hooks, latitude, longitude` |
| `business_operations` | `has_outdoor_seating, establishment_type, preferred_posts_per_week` |
| `opening_hours` | `weekday, closed, open_time, close_time` |
| `business_brand_profile` | `brand_essence, brand_essence_elaboration, core_offerings, tone_of_voice, content_focus, things_to_avoid, target_audience, communication_goal, signature_phrases, never_say, typical_openings, typical_closings, sample_posts, humor_level, booking_link, business_character, content_strategy, tone_model, voice_constraints, identity_keywords, voice_rationale, recognizable_interior_identity, venue_scene, visual_character, posting_occasions` |
| `business_profile` | `menu_signal` |
| `menu_results_v2` | `structured_data, service_periods, is_signature, ai_summary, source_url` (status=done, limit 20) |
| `profiles` | `selected_platforms` |
| `businesses` | `subscription_tier` |

#### Additional queries

| Step | Table | Columns read 📖 | Purpose |
|------|-------|-----------------|---------|
| Step 3 | `contextual_calendar` | `event_type, event_name, date_start, date_end, relevance_tags, content_angle, marketing_hook, commercial_weight, lead_days` | Events/holidays 2 weeks ahead |
| Step 4 | OpenWeatherMap API 🌐 | Full forecast | 7-day weather by coordinates |
| Step 6 | `weekly_content_plans` | `posts, generated_at` | Last 2 plans — dish/type deduplication (14-day ban) |
| Step 6 | `weekly_strategies` | `post_ideas, selected_idea_ids, strategy_rationale, narrative, strategic_brief, week_start, week_number` | Last 4 strategies — selection patterns, angle focus, day-of-week history |

#### What is assembled into the AI pipeline (multi-phase, GPT-4o)

**The entire `weekContext` object is the AI input. Key contents:**

| Category | Fields |
|----------|--------|
| **Brand identity** | `brand_essence`, `brand_essence_elaboration`, `identity_keywords`, `visual_character`, `venue_scene`, `recognizable_interior_identity`, `content_strategy` (anchors), `tone_model`, `things_to_avoid`, `never_say`, `voice_constraints`, `voice_rationale`, `signature_phrases`, `typical_openings`, `typical_closings`, `humor_level`, `booking_link`, `business_character` |
| **Menu** | All `menu_results_v2` items (structured categories, prices, descriptions, service periods, signature flag), drink items, filtered to remove price-surcharge items and kids/snacks categories |
| **Operations** | `opening_hours` (all 7 days), derived `servicePeriods` (brunch/lunch/dinner), `primaryServicePeriod`, `establishment_type`, `has_outdoor_seating` |
| **Location** | `area_type`, `neighborhood`, `matched_motivations`, `location_marketing_hooks`, tourist context |
| **Weather** | 7-day forecast + interpreted signals: `weather_is_differentiator`, `weather_effect_on_daypart`, outdoor opportunity |
| **Calendar events** | All upcoming occasions/holidays with `content_angle`, `marketing_hook` |
| **Economic timing** | Salary week detection, payday period (calculated in TypeScript) |
| **History** | Last 14 days' posted menu items (dedup ban list), content types, selection patterns (goal mode rates, preferred category), previous angle focuses, previous slot day-of-week usage |
| **Business archetype** | Derived from `businesses.vertical` + location type combination |
| **Owner note** | Free-text input from the user (if provided) |
| **Tier + platforms** | `subscription_tier`, `selected_platforms`, `targetPostCount` |

#### AI pipeline phases (all async background, GPT-4o)

| Phase | What it does |
|-------|-------------|
| **Phase 0 — Modulation** | 1 LLM call: adjusts `week_goal_blend` + `week_content_category_weights` for this specific week based on weather/events/season. E.g. shifts weight toward "atmosphere" in sunny weather. |
| **Phase 1 — Strategic brief** | 1 LLM call: produces goal_mode + content_category per slot (3–5 posts). Inputs: brand, location, events, weather, history, tier, owner note. |
| **Phase 2a — Day assignment** | 1 LLM call: assigns day-of-week to each slot based on day behaviour, calendar events, operating hours. |
| **Phase 2b — Content selection** | 1 LLM call per slot: selects specific menu item (or scene), writes visual direction, CTA type, `selectionRationale`, optional drink pairing, `sceneSpec`, `strategyBrief`. |
| **Phase 2c — Caption seeds** | 1 LLM call: writes first-line caption seeds for each post. |

#### Output written to DB 🔄

| Table | Fields written |
|-------|---------------|
| `weekly_strategies` | `narrative, strategic_priorities, post_ideas, week_context_snapshot, strategy_version, strategy_rationale, status='generated'` |

The `week_context_snapshot` stores the entire assembled `weekContext` — so `generate-weekly-plan` can skip re-fetching all 9 business tables.

---

### 3.3 Plan Generation — Phase B: `generate-weekly-plan`

Takes the `weekly_strategies` row and generates the final `WeeklyContentPlan` — a set of `PostSpecification` objects with full timing, visual direction, caption seed, CTA, and media direction.

#### Trigger
Called by the page after `weekly_strategies.status = 'generated'`. Returns HTTP 202; client polls `weekly_strategies.status = 'posts_created'` (or `weekly_content_plans` directly as fallback).

#### DB tables queried

| Table | Columns read 📖 |
|-------|-----------------|
| `businesses` | `*` (ownership check) |
| `weekly_strategies` | `id, narrative, strategic_priorities, strategic_brief, post_ideas, generated_at, week_number, business_type, platforms, subscription_tier, target_post_count, week_context_snapshot` |
| `weekly_content_plans` | `posts, week_start, generated_at` (last 3, for dedup) |
| `weekly_content_plans` | `*` (cache check when `regenerate=false`) |
| Path B only (no snapshot): same 6 tables as `get-weekly-strategy` Step 1 | | |

#### What is assembled into the AI prompt (GPT-4o)

Built from `week_context_snapshot` (if available) or re-fetched data. The same `weekContext` used in strategy generation, plus:

- `post_ideas` from `weekly_strategies` (slot assignments, content types, caption seeds)
- `narrative` + `strategic_priorities` + `strategic_brief`
- Previous plan post `{dish, contentType}` pairs (dedup, last 3 plans)
- Weather forecast (from snapshot)

#### Output written to DB 🔄

| Table | Fields written |
|-------|---------------|
| `weekly_content_plans` | Full `posts` array (array of `PostSpecification` objects), `week_start`, `week_number`, `generated_at`, `summary`, `strategy_id` |
| `weekly_strategies` | `status = 'posts_created'`, `selected_idea_ids` |

---

### 3.4 Post Creation from Weekly Plan

When the user clicks "Opret opslag" on a plan post:

1. The plan page sets in Zustand store: `weeklyPlanPost`, `weeklyContentPlan`, `weeklyPlanPostIndex`, `activePath='weekly-plan'`, `weeklyPlanStep='generate'`
2. Navigates to `/dashboard/create`
3. `CreatePostPage` mounts in `weekly-plan` mode

#### Text generation for a weekly plan post

Same `generate-text-from-idea` edge function is called, but the suggestion payload includes extra weekly plan fields:

| Extra field passed | Source |
|--------------------|--------|
| `guestMoment` | `PostSpecification.guestMoment` |
| `timingDay` | `PostSpecification.timing.day` |
| `timingTime` | `PostSpecification.timing.time` |
| `timingRationale` | `PostSpecification.timing.rationale` |
| `visualSubject` | `PostSpecification.visualDirection.subject` |
| `visualAngle` | `PostSpecification.visualDirection.angle` |
| `visualSetting` | `PostSpecification.visualDirection.setting` |
| `platformFormat` | `PostSpecification.format` |
| `selectionRationale` | `PostSpecification.selectionRationale` |
| `captionFirstLine` | `PostSpecification.captionSeed` |
| `holidayContext` | `PostSpecification.holidayContext` (if present) |
| `drinkPairing` | `PostSpecification.drinkPairing` (if present) |
| `strategyBrief` | `PostSpecification.strategyBrief` |
| `mediaDirection` | `PostSpecification.mediaDirection` |
| `sceneSpec` | `PostSpecification.sceneSpec` (if present) |

The **Publish step** auto-pre-populates date and time from `PostSpecification.timing.date` and `.time`.

---

## 4. Cross-Feature Data Map

This table maps each database field to which content features use it.

| DB Field | Suggestions (`get-quick-suggestions`) | Text generation (`generate-text-from-idea`) | Weekly strategy (`get-weekly-strategy`) | Weekly plan (`generate-weekly-plan`) |
|----------|--------------------------------------|----------------------------------------------|----------------------------------------|---------------------------------------|
| `businesses.name` | 🤖 context | 🤖 user prompt | — | — |
| `businesses.vertical` | 🤖 vertical detection | 🤖 effectiveVertical | 📖 business archetype | 📖 (via snapshot) |
| `business_locations.city` | 🤖 weather + context | 🤖 user prompt | 📖 weather API input | — |
| `opening_hours` | 🤖 timing + confirmed facts | 🤖 hoursBlock (footfall posts) | 🤖 service period derivation | 🤖 (via snapshot) |
| `business_operations.has_outdoor_seating` | 🤖 confirmed facts | — | 🤖 weather sensitivity | 🤖 (via snapshot) |
| `business_operations.kitchen_close_time` | 🤖 confirmed facts | — | — | — |
| `business_operations.weekly_programme` | 🤖 confirmed facts (Slot B/C) | — | — | — |
| `menu_results_v2.structured_data` | 🤖 full menu (paid) | 🤖 dish + description (INDHOLD) | 🤖 full menu | 🤖 (via snapshot) |
| `menu_results_v2.ai_summary` | 🤖 menu intelligence | — | — | — |
| `menu_items_normalized.item_description` | — | 🤖 dish description (INDHOLD) | — | — |
| `business_brand_profile.business_character` | 🤖 context + Slot C facts | 🤖 system message | 🤖 brand block | 🤖 (via snapshot) |
| `business_brand_profile.visual_character` | 🤖 tone context | 🤖 first in brand block | 🤖 brand block | 🤖 (via snapshot) |
| `business_brand_profile.venue_scene` | 🤖 Slot C facts | 🤖 system (behind_scenes) | 🤖 brand block | 🤖 (via snapshot) |
| `business_brand_profile.recognizable_interior_identity` | 🤖 Slot C confirmed facts | 🤖 system (behind_scenes only) | 🤖 brand block | 🤖 (via snapshot) |
| `business_brand_profile.tone_model` | 🤖 writing rules | 🤖 brandWritingRules (system) | 🤖 brand block | 🤖 (via snapshot) |
| `business_brand_profile.content_strategy` | 🤖 natural moments filter | 🤖 contentAnchors (system) | 🤖 brand block | 🤖 (via snapshot) |
| `business_brand_profile.content_strategy_confirmed` | 🤖 labels anchors as confirmed/AI | — | — | — |
| `business_brand_profile.things_to_avoid` | 🤖 idea avoidance | 🤖 thingsToAvoid (system) | 🤖 brand block | 🤖 (via snapshot) |
| `business_brand_profile.voice_constraints` | — | 🤖 voiceConstraints (system) | 🤖 brand block | 🤖 (via snapshot) |
| `business_brand_profile.voice_rationale` | 🤖 REGISTERVAGT (atmo/BTS) | 🤖 REGISTERVAGT (system, scene/mood) | 🤖 brand block | 🤖 (via snapshot) |
| `business_brand_profile.emotional_promise` | 🤖 BRANDFØLELSE (atmo/BTS) | 🤖 BRANDFØLELSE (system, scene/mood) | — | — |
| `business_brand_profile.content_exclusions` | 🤖 ALDRIG I DETTE OPSLAG | 🤖 ALDRIG I DETTE OPSLAG (system, scene/mood) | — | — |
| `business_brand_profile.location_intelligence` | 🤖 motivations + proximity (Slot C) | 🤖 motivations (system, scene/mood) | — | — |
| `business_brand_profile.posting_occasions` | — | — | 🤖 brand block | 🤖 (via snapshot) |
| `business_brand_profile.typical_openings` | — | 🤖 rhythm example (scene/mood only) | 🤖 brand block | 🤖 (via snapshot) |
| `business_brand_profile.signature_phrases` | — | 🤖 brandSignaturePhrases (system) | 🤖 brand block | 🤖 (via snapshot) |
| `business_brand_profile.never_say` | — | — | 🤖 brand block | 🤖 (via snapshot) |
| `business_brand_profile.humor_level` | — | 🤖 humorLevel (system) | 🤖 brand block | 🤖 (via snapshot) |
| `business_location_intelligence.area_type` | — | — | 🤖 location block | 🤖 (via snapshot) |
| `business_location_intelligence.location_marketing_hooks` | — | — | 🤖 location block | 🤖 (via snapshot) |
| `contextual_calendar` | 🤖 event facts (up to 3) | — | 🤖 full events block | 🤖 (via snapshot) |
| `weekly_strategies` (history) | — | — | 🤖 selection patterns + angle focus + DOW history | 🤖 input |
| `weekly_content_plans` (history) | — | — | 🤖 dish dedup (14-day ban) | 🤖 dish dedup (3-plan window) |
| `daily_suggestions` (history) | 🤖 last 9 titles + last 5 dishes | — | — | — |
| OpenWeatherMap 🌐 | 🤖 today's weather | — | 🤖 7-day forecast + signal interpretation | 🤖 (via snapshot) |
| Open-Meteo 🌐 | — | — | — | 🤖 (weekly plan page, in-memory only) |

---

## 5. Fields Collected on Setup Pages — Not Used in Any AI Feature

Cross-referencing [DASHBOARD-UI-VS-DB-INVENTORY.md](DASHBOARD-UI-VS-DB-INVENTORY.md) with the data flows above, the following fields are collected on the setup pages but reach no AI model in any of the three content pages:

| Field | DB Location | Status |
|-------|-------------|--------|
| Business name | `businesses.name` | 🤖 Used only in `generate-text-from-idea` user prompt — not in suggestions or weekly strategy |
| Website URL | `businesses.website_url` | Not used in any AI prompt |
| Logo URL | `businesses.logo_url` | Not used |
| Tagline / short description | `business_profile.short_description` | Not used in any AI prompt |
| About / long description | `business_profile.long_description` | Not used in any AI prompt |
| Phone | `business_locations.phone` | Not used |
| Email | `business_locations.email` | Not used |
| Booking link | `business_brand_profile.booking_link` | 🤖 Used in CTA selection within `generate-text-from-idea` only |
| Address line 2 | `business_locations.address_line2` | Not used |
| Google Maps URL | `business_locations.maps_url` | Not used |
| Country | `business_locations.country` | 🤖 Used only as OpenWeather API parameter — not in prompt text |
| Price level | `business_operations.price_level` | Not used in any AI prompt |
| Average check per person | `business_operations.average_check_per_person` | Not used |
| Accepts walk-ins | `business_operations.accepts_walk_ins` | Not used |
| Indoor/outdoor seating capacity | `business_operations.seating_capacity_indoor/outdoor` | Not used |
| Establishment type (FSE/SBO) | `business_operations.establishment_type` | 🤖 Used in `get-weekly-strategy` archetype derivation only |
| Has WiFi / power outlets / parking | `business_operations.has_wifi/power_outlets/parking` | Not used |
| Has delivery | `business_operations.has_delivery` | Not used |
| Reservation required | `business_operations.reservation_required` | Not used |
| Has kids menu | `business_operations.has_kids_menu` | 🤖 Used in `get-quick-suggestions` confirmed facts only |
| Has takeaway | `business_operations.has_takeaway` | 🤖 Used in `get-quick-suggestions` confirmed facts only |
| Has table service | `business_operations.has_table_service` | 🤖 Used in `get-quick-suggestions` confirmed facts only |
| Brand essence (structured column) | `business_brand_profile.brand_essence` | 🤖 Used in `get-quick-suggestions` and `get-weekly-strategy` only |
| Target audience | `business_brand_profile.target_audience` | 🤖 Used in `get-quick-suggestions` and `generate-text-from-idea` |
| Values | `business_brand_profile.values` | Not used in any AI prompt |
| Tone keywords | `business_brand_profile.tone_keywords` | 🤖 Used as fallback in `get-quick-suggestions` only (3rd priority after tone_model and tone_of_voice) |
| Certifications | `business_brand_profile.certifications` | Not used in any AI prompt |
| Do-not-say list (user-entered) | `business_brand_profile.do_not_say` | Not used in any AI prompt |
| Voice style | `business_brand_profile.voice_style` | Not used in any AI prompt |
| CTA preference / cta_style | `business_brand_profile.cta_style` | Not used in any AI prompt |
| Who/When/Why matrix | `business_brand_profile.who_when_why` | Not used in any AI prompt |
| Content pillars | `business_brand_profile.content_pillars_jsonb` | Not used (content_strategy is used instead) |
| Brand strategy | `business_brand_profile.brand_strategy` | Not used in any AI prompt |
| Execution profile | `business_brand_profile.execution_profile` | Not used in any AI prompt |
| All offering candidates | `business_brand_profile.offerings_full` | Not used in any AI prompt |
| Personality calibration | `business_brand_profile.personality` | Not used in any AI prompt |
| Brand context (origin story, differentiator, local landmarks) | `business_brand_profile.brand_context` | Not used in any AI prompt |
| Voice execution (signature patterns) | `business_brand_profile.voice_execution` | Not used in any AI prompt |
| Venue energy | `business_brand_profile.venue_energy` | 🤖 Used in `get-quick-suggestions` context only |
| Social style / hashtags | `business_brand_profile.social_style` | Not used in any AI prompt |
| Voice examples (do/don't say) | `business_brand_profile.voice_examples` | 🤖 Only `vocabulary.prefer/avoid` used in `generate-text-from-idea` |
| Owner document summary | `business_brand_profile.owner_document` | Not used in any AI prompt |
| What makes us different | `business_brand_profile.what_makes_us_different` | 🤖 Used in `get-quick-suggestions` Slot C only |
| Competitive differentiator (profile page) | `business_brand_profile.what_makes_us_different` | 🤖 Same field — Slot C only |
| GPS coordinates | `business_location_intelligence.latitude/longitude` | 🤖 Used as weather API input; not injected into text prompts |
| Neighborhood name + character | `business_location_intelligence.neighborhood/neighborhood_character` | 🤖 Neighborhood used in `get-weekly-strategy`; character not used |
| Nearby landmarks | `business_location_intelligence.landmarks_nearby` | Not used in any AI prompt |
| Public transport | `business_location_intelligence.public_transport` | Not used in any AI prompt |
| Has view / view type | `business_location_intelligence.has_view/view_type` | Not used in any AI prompt |
| Street visibility | `business_location_intelligence.street_visibility` | Not used in any AI prompt |
| Hidden gem flag | `business_location_intelligence.is_hidden_gem` | Not used in any AI prompt |
| Item flags (signature, seasonal, limited) | `menu_items_normalized.is_signature/is_seasonal/is_limited_time` | 🤖 Only `is_signature` used in `get-weekly-strategy` |
| Item engagement history | `menu_items_normalized.total_times_posted/avg_engagement_rate/last_posted_date` | Not used in any AI prompt |
| Dish temperature category | `menu_items_normalized.dish_temp_category` | Not used |
| Full concept fit scores and detail | `business_concept_fit.*` | Not used in any AI prompt |
| Business audience profile | `business_audience_profile.*` | Not used in any AI prompt |
| Business visual identity | `business_visual_identity.*` | Not used in any AI prompt |
| Business menu metadata | `business_menu_metadata.*` | Not used in any AI prompt |
| Specials | `specials.*` | Not used in any AI prompt |
| Business goals | `business_goals.*` | Not used in any AI prompt |
