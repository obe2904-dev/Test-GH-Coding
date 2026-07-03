# Database Schema Overview
_Last updated: 22 April 2026 — reflects all migrations through `20260422000001` + hospitality density feature_

---

## Core Business Entity

### `businesses`
The root table. One row per business account.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `owner_id` | uuid | FK → auth.users |
| `name` | text | |
| `business_type_hybrid` | jsonb | `{ primary, secondary[], hybridLabel, cuisineType?, conceptTags[] }` |
| `website_url` | text | |
| `logo_url` | text | |
| `primary_language` | text | `da`, `en`, etc. |
| `subscription_tier` | text | `free`, `starter`, `growth`, `pro` |
| `plan` | text | Legacy alias for tier |
| `subpage_urls` | jsonb | Detected sub-pages from website crawl |
| `ai_generations_today/this_month` | int | Quota counters |
| `pdf_uploads_today/this_month` | int | Quota counters |
| `website_analysis_today/this_month` | int | Quota counters |
| `scheduled_posts_this_month` | int | Quota counter |
| `last_daily_reset` / `last_monthly_reset` | timestamptz | Quota reset timestamps |
| `quick_suggestions_today` | int | Dagens Forslag daily quota counter (FREE: 5/day, PAID: 100/day) |
| `last_quick_suggestions_reset` | date | Date of last Dagens Forslag quota reset |

---

## Business Profile Group
_One-to-one with `businesses`. Each table covers a different dimension of the business._

### `business_profile`
Human-written and AI-generated descriptive text.

| Column | Type | Notes |
|--------|------|-------|
| `business_id` | uuid PK/FK | |
| `short_description` | text | |
| `long_description` | text | |
| `menu_description` | text | |
| `menu_structure` | jsonb | Structured menu overview |
| `founded_year` | int | |
| `ai_brand_context` | text | AI-generated context paragraph |
| `ai_brand_context_approved` | bool | Owner has reviewed it |
| `ai_brand_context_generated_at` | timestamptz | |
| `detected_menu_urls` | text[] | URLs found on website |
| `menu_signal` | jsonb | AI-analysed menu signal; `.programmes` = service period roles |

---

### `business_brand_profile`
Brand voice, tone, and identity. The primary input for all AI content generation.

| Column | Type | Notes |
|--------|------|-------|
| `business_id` | uuid PK/FK | |
| `brand_essence` | text | One-line brand soul |
| `brand_essence_elaboration` | text | Extended elaboration |
| `tone_of_voice` | text | Narrative description |
| `tone_keywords` | text[] | Quick-reference tone tags |
| `tone_model` | jsonb | Structured tone model (primary_keywords, writing_rules, good/avoid examples, formality, emoji_level) |
| `target_audience` | text | Who the brand speaks to |
| `core_offerings` | text | What the business sells |
| `content_focus` | text | What content should highlight |
| `communication_goal` | text | What each post should achieve |
| `image_preferences` | text | Visual style preferences |
| `social_style` | jsonb | Platform-specific tone nuances |
| `voice_examples` | jsonb | Good and bad example sentences |
| `voice_constraints` | text | Hard rules (never say X) |
| `things_to_avoid` | text | What to avoid in content |
| `do_not_say` | jsonb | Banned words/phrases (structured: `.words` array). **Currently NULL for all live rows — never populated in production.** |
| `never_say` | text[] | Banned words/phrases array. **The only live source of banned words data.** Merged with `do_not_say.words` in prompt generation (both feed the same never-say list). Note: documented as `text` in older docs — the actual column type is `text[]`. |
| `what_makes_us_different` | text | Owner-stated competitive differentiator; injected into Slot C confirmed facts bank in Dagens Forslag |
| `values` | text[] | Core brand values |
| `certifications` | text[] | Quality/ethical certifications |
| `identity_keywords` | text[] | V2 brand identity tags |
| `booking_link` | text | Link used in CTAs |
| `cta_preference` | text | Preferred call-to-action style |
| `quality_status` | text | `pending`, `ready`, `stale` |
| `version_hash` | text | For change detection |
| `generation_errors` | jsonb | Last generation error log |
| `visual_character` | text | AI-analyzed interior/photo style |
| `venue_scene` | text | Scene description (busy, cosy, etc.) |
| `venue_energy` | text | Energy level description |
| `recognizable_interior_identity` | text | Whether venue has distinctive interior |
| `emotional_promise` | text | Emotional value proposition (April 2026) |
| `content_exclusions` | text | Topics/themes to never touch |
| `content_strategy_confirmed` | bool | Owner has confirmed strategy |
| `owner_document` | text | Free-text from owner onboarding doc |
| `voice_rationale` | text | Why this tone was chosen |
| `sample_posts` | jsonb | Existing posts as Tier 1 tone signal for regeneration |
| `typical_openings` | text[] | Extracted `Eksempel:` lines from `tone_of_voice` |
| `posting_occasions` | jsonb | Selected posting occasions from occasion library |
| `posting_occasions_hash` | text | Hash for change detection on occasions |
| `business_character` | text | AI plain-text descriptor of what the business IS; consumed by post generation |
| `content_strategy` | jsonb | AI strategy: goal_mode split, content_category_weights, brand_anchors. **Write-once** (never overwritten on regen) |
| `signature_phrases` | text[] | Brand-specific phrases to weave into generated text naturally (v5 brand profile) |
| `humor_level` | text | Voice register: `none`, `subtle`, `moderate`, `high` |
| `brand_context` | jsonb | Origin story, unique differentiator, local landmarks: `{ origin_story?, unique_differentiator?, local_landmarks? }` (§16.8) |
| `voice_options` | jsonb | Two bespoke voice archetypes generated for this business (recommended + alternative) |
| `voice_archetype` | text | Active archetype key; defaults to recommended on first generation |
| `core_offerings_jsonb` | jsonb | Structured JSONB for `core_offerings`: meal_anchors, experience_service_anchors, unknowns |
| `image_preferences_jsonb` | jsonb | JSONB source of truth for image_preferences (legacy TEXT column kept for backwards compatibility) |
| `things_to_avoid_jsonb` | jsonb | JSONB source of truth for things_to_avoid (legacy TEXT column kept for backwards compatibility) |
| `location_intelligence` | jsonb | Denormalised snapshot from `business_location_intelligence` written during brand profile generation |

---

### `business_operations`
Operational facts used as content anchors.

| Column | Type | Notes |
|--------|------|-------|
| `business_id` | uuid PK/FK | |
| `price_level` | int | Numeric scale: `1`=budget, `2`=afslappet/casual, `3`=middelklasse, `4`=premium/fine-dining. Mapped to label string in edge functions. |
| `establishment_type` | text | `restaurant`, `café`, `bar`, etc. |
| `seating_capacity_indoor` / `outdoor` | int | |
| `has_outdoor_seating` | bool | |
| `has_table_service` | bool | |
| `has_takeaway` | bool | |
| `has_delivery` | bool | |
| `has_kids_menu` | bool | |
| `has_english_menu` | bool | Whether the business offers an English-language menu |
| `accepts_walk_ins` | bool | |
| `reservation_required` | bool | |
| `opening_hours` | jsonb | Legacy structured hours (use `opening_hours` table for current) |
| `weekly_programme` | text | Recurring events: happy hour, quiz night, DJ, etc. |
| `kitchen_close_time` | text | Separate kitchen closing time |
| `posting_occasions` | jsonb | Structured recurring posting hooks |

> ⚠️ `average_check_per_person` and `currency` were dropped in migration `20260420000008`. Currency follows country config (`denmark.ts` → `DKK`).

---

### `business_locations`
Physical address(es) of the business.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `business_id` | uuid FK | |
| `label` | text | e.g. "Main entrance" |
| `address_line1/2` | text | |
| `postal_code` | text | |
| `city` | text | |
| `country` | text | ISO 3166-1 alpha-2 |
| `maps_url` | text | Google Maps link |
| `phone` | text | |
| `email` | text | |
| `is_primary` | bool | |
| `enrichment` | jsonb | Location enrichment blob: area_type, nearby_signals, city_tier. Note: lat/lon coordinates are **not** direct columns here — they live on `business_location_intelligence` |

---

### `business_location_intelligence`
AI-generated location analysis. Powers location-aware content strategy.

| Column | Type | Notes |
|--------|------|-------|
| `business_id` | uuid PK/FK | |
| `area_type` | text | Primary type: `city_centre`, `waterfront`, `residential`, etc. |
| `category_scores` | jsonb | Score per area_type (0–1) |
| `concept_fit_by_category` | jsonb | Full concept fit analysis per category |
| `concept_fit_analyzed_at` | timestamptz | |
| `neighborhood` | text | Area name |
| `neighborhood_character` | text | Description of the area |
| `latitude` / `longitude` | float | |
| `landmarks_nearby` | jsonb | Named landmarks + distance |
| `location_marketing_hooks` | text[] | AI-generated hooks for this location |
| `who_analysis` / `who_analysis_internal` | jsonb | Customer type analysis |
| `when_analysis` / `when_analysis_internal` | jsonb | Peak time analysis |
| `public_transport` | jsonb | Nearby transit |
| `street_visibility` | text | `high`, `medium`, `low` |
| `has_view` | bool | |
| `view_type` | text[] | `harbour`, `park`, `cityscape`, etc. |
| `is_hidden_gem` | bool | |
| `outdoor_space_type` | text | |
| `matched_motivations` | jsonb | Customer motivation matching |
| `proximity_anchor` | text | Nearest strong landmark for content |
| `user_confirmed_at` | timestamptz | Owner confirmed the analysis |
| `last_updated_by_ai` | timestamptz | |
| `nearby_hospitality` | jsonb | Hospitality density within 300m: `{ radius_meters, total_count, breakdown: { restaurant, cafe, bar }, density_label: "low"\|"medium"\|"high", fetched_at }`. Populated by `populate-location-intelligence`. Injected into Slot C confirmed facts bank in `get-quick-suggestions` and as competitive context in `generate-text-from-idea` for atmosphere/BTS posts. |

---

## People & Access

### `profiles`
Auth user profiles (synced from auth.users).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | Matches auth.users.id |
| `email` | text | |
| `onboarding_completed` | bool | |
| `plan` / `business_type` | text | Legacy fields |
| `selected_platforms` | jsonb | |
| `ai_generations_today/this_month` | int | Legacy quota (use businesses table) |
| `business_offerings` | jsonb | Legacy menu/offerings fallback (filled during onboarding setup) |

---

### `business_team_members`
Permissions for team access to a business.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `business_id` | uuid FK | |
| `user_id` | uuid FK | |
| `role` | text | `owner`, `admin`, `member` |
| `invited_at` | timestamptz | |
| `accepted_at` | timestamptz | |

---

### `social_accounts`
Connected social media platforms.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `business_id` | uuid FK | |
| `platform` | text | `instagram`, `facebook`, `tiktok`, `linkedin`, `twitter` |
| `handle` | text | |
| `profile_url` | text | |
| `is_connected` | bool | |
| `access_token_encrypted` | text | |

---

## Content Planning

### `weekly_strategies`
AI-generated weekly content strategy. One per business per week.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `business_id` | uuid FK | |
| `week_number` | int | ISO week number |
| `week_start` / `week_end` | date | Monday–Sunday |
| `is_current_week` | bool | Computed from dates, not passed by caller |
| `status` | text | `pending`, `ready`, `error` |
| `narrative` | jsonb | Weekly story arc |
| `strategic_priorities` | jsonb | Top 3 focus areas |
| `post_ideas` | jsonb | Array of idea objects |
| `selected_idea_ids` | int[] | Which ideas were chosen |
| `week_context_snapshot` | jsonb | Calendar/weather context at generation time |
| `strategic_brief` | jsonb | Structured brief |
| `strategic_brief_raw` | text | Raw LLM output |
| `strategy_rationale` | text | Why this strategy was chosen |
| `strategy_version` | text | Version identifier |
| `business_type` / `country` | text | Snapshot at generation time |
| `platforms` | text[] | Target platforms |
| `subscription_tier` | text | Tier at generation time |
| `target_post_count` | int | |
| `generated_at` | timestamptz | |

---

### `weekly_content_plans`
The actual post schedule generated from a strategy.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `business_id` / `user_id` | uuid FK | |
| `strategy_id` | uuid FK → `weekly_strategies` | |
| `week_number` | int | |
| `week_start` / `week_end` | date | ISO dates `YYYY-MM-DD` |
| `posts` | jsonb | Array of `PostSpecification` objects |
| `summary` | jsonb | High-level week summary |
| `learning_data` | jsonb | Performance feedback loop |
| `generated_at` | timestamptz | |

---

### `daily_suggestions`
Quick AI-generated content ideas shown on the dashboard. Up to 3 per business per day.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `business_id` | uuid FK | |
| `date` | date | Which day |
| `position` | int | 1, 2, or 3 |
| `slot` | text | Fixed slot identity: `offering` (pos 1), `guest_moment` (pos 2), `brand_behind` (pos 3) |
| `title` | text | 3–7 word post title |
| `rationale` | text | Why this idea now (legacy field; same content as `why_explanation`) |
| `why_explanation` | text | Strategic timing reasoning shown to owner in "💡 Hvorfor dette opslag?" — must not be promotional copy |
| `content_type` | text | `menu_item`, `atmosphere`, `behind_scenes` — clamped per slot position after Gemini response |
| `menu_item_name` | text | Exact dish name chosen by Gemini (Slot A / `offering` only) |
| `menu_item_description` | text | Ingredient brief (`dish_text_brief`) or raw DB description (Slot A only) |
| `caption_base` | text | **Bridge to text generator.** For menu posts: ingredient brief (drives sensory detail). For other slots: `concrete_anchor` (confirmed venue/service fact injected as `ANKER:` in `resolve-context`) |
| `cta_intent` | text | `visit` (Slot A), `social` (Slot B), `engagement` (Slot C) — slot-derived |
| `photo_idea` | text | `media_suggestion.primary.instruction` from Gemini — 3-step photography guide (flat text; kept for backwards compatibility) |
| `media_suggestion` | jsonb | Full Gemini media object: `{ primary: { type, instruction }, alternatives: [] }`. Persisted so cached suggestions retain photography alternatives, not just the instruction string |
| `suggested_time` | text | Time-aware scheduling respecting open/close hours (e.g. `"12:00"`, `"18:30"`) |
| `is_active` | bool | False when dismissed by owner |
| `selected` | bool | True when owner picks this idea to turn into a post |
| `generated_content` | jsonb | Pre-generated caption (if any) |
| `weather_forecast` | jsonb | 24h weather forecast snapshot at generation time |
| `cover_url` | text | Optional image for the card |
| `thumbs_up` | bool | Owner explicitly liked this suggestion (positive signal store, independent of `selected`) |

---

### `post_ideas`
Saved post ideas library (from weekly strategy or manual).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `business_id` | uuid FK | |
| `caption` | text | |
| `hashtags` | text[] | |
| `platform` | text | `instagram`, `facebook`, `both` |
| `content_type` | text | `signature_dish`, `location_highlight`, etc. |
| `visual_suggestions` | jsonb | Photography tips |
| `status` | text | `draft`, `approved`, `scheduled`, `posted`, `rejected` |
| `suggested_post_time` | timestamptz | |
| `actual_post_time` / `posted_at` | timestamptz | |
| `reach` / `engagement` / `clicks` | int | Future analytics |

---

### `post_drafts`
In-progress post drafts (one per user session).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `post_content` | jsonb | |
| `photo_content` | jsonb | |
| `photo_idea` | text | |
| `selected_platforms` | text[] | |
| `idea_source` | text | Where the idea came from |
| `idea_data` | jsonb | Source idea details |
| `media_analysis` | jsonb | AI analysis of attached photos |
| `caption_data` | jsonb | Generated caption with metadata |
| `phase` | text | UI phase in creation flow |
| `strategy_id` | uuid FK → `weekly_strategies` | |
| `idea_index` | int | Which idea in the strategy |

---

## Menu System

### `menu_sources`
Registered source documents (PDFs, URLs) for a business's menu.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `business_id` | uuid FK | |
| `source_type` | text | `url`, `pdf` |
| `source_origin` | text | `ai_detected`, `manual_added` |
| `source_url` | text | |
| `file_name` | text | |
| `label` | text | e.g. "Lunch menu" |
| `menu_type` | text | `standard`, `special` |
| `status` | text | `pending`, `extracting`, `extracted`, `ignored`, `error` |
| `error_message` | text | |
| `created_by` | uuid | FK → auth.users |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `is_social_lead` | boolean | Owner marks this source as the one to lead with socially (only one active at a time; drives sort order + note injection in `get-quick-suggestions`) |

---

### `menu_results_v2`
OCR/extraction pipeline results. Primary menu extraction table.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `business_id` | uuid FK | |
| `source_kind` | text | `pdf`, `url`, `image` |
| `source_url` | text | |
| `storage_bucket` / `storage_path` | text | If uploaded |
| `sha256` | text | For deduplication |
| `status` | text | `queued`, `claimed`, `done`, `error` |
| `attempts` | int | Retry count |
| `raw_text` | text | Extracted text |
| `structured_data` | jsonb | Parsed menu structure |
| `extraction_method` | text | `ocr`, `html`, `pdf_parse` |
| `language_code` | text | Detected language |
| `claimed_at` / `completed_at` | timestamptz | Queue management |
| `service_period_name` | text | Human-readable label for the service period (e.g. "Frokost", "Aften") |
| `start_time` | text | Service start time in HH:MM format (e.g. `"09:00"`). NULL if not on the menu. |
| `end_time` | text | Service end time in HH:MM format (e.g. `"17:30"`). NULL if not on the menu. |
| `availability_days` | text | Days menu is served (e.g. `"dagligt"`, `"onsdag-lørdag"`). NULL if not specified. |
| `ai_summary` | text | AI helicopter summary paragraph for the whole menu |
| `cuisine_style` | text | Detected cuisine style (e.g. `Nordic`, `Italian`); used in Dagens Forslag prompt framing |

---

### `menu_items_normalized`
Flattened individual menu items. Populated by `menu-sync` edge function from `menu_results_v2`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `business_id` / `menu_result_id` | uuid FK | |
| `item_name` / `item_description` | text | |
| `item_price` | text | |
| `category_name` / `category_type` | text | `main`, `dessert`, `sides`, etc. |
| `menu_title` | text | e.g. `FROKOST`, `AFTEN`, `Brunch` |
| `service_periods` | text[] | `lunch`, `dinner`, `brunch` |
| `is_signature` / `is_seasonal` / `is_limited_time` | bool | |
| `dish_temp_category` | text | `hot`, `cold`, `warm`, `neutral` |
| `seasonal_ingredients` / `location_tags` | text[] | |
| `category_availability_days` | text | Day restriction for this category (e.g. `"onsdag-lørdag"` for TAPAS). NULL = same as parent menu. |
| `category_time_range` | text | Time range if category differs from menu (e.g. `"17:30-21:30"`). NULL = inherits from menu. |
| `total_times_posted` / `avg_engagement_rate` | int/decimal | Performance tracking |
| `last_posted_date` | timestamptz | |
| `source_sha256` | text | Change detection |

---

### `menu_extractions`
Structured extractions from `menu_sources` (legacy pipeline alongside v2).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `business_id` / `menu_source_id` | uuid FK | |
| `menu_name` | text | |
| `menu_type` | text | `standard`, `special` |
| `extracted_data` | jsonb | Full structured menu |
| `extracted_at` | timestamptz | |

---

### `menu_results`
Legacy OCR results (v1 pipeline). Still exists but superseded by `menu_results_v2`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `business_id` | uuid FK | |
| `pdf_url` | text | |
| `status` | text | |
| `raw_text` | text | |
| `structured_data` | jsonb | |
| `ocr_engine` | text | |
| `confidence_score` | float | |

---

## Calendar & Context

### `contextual_calendar`
Country-specific events, holidays, and seasonal context. Shared (not per-business).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `country` | text | ISO `DK`, `SE`, `NO`, etc. |
| `region` | text | Optional region |
| `event_type` | text | `holiday`, `school_vacation`, `season`, `cultural`, `business_rhythm` |
| `event_name` | text | |
| `date_start` / `date_end` | date | |
| `recurrence` | text | `annual`, `seasonal`, `monthly`, `weekly` |
| `recurrence_rule` | text | Human description |
| `relevance_tags` | text[] | `families`, `couples`, `outdoor`, `shopping`, etc. |
| `content_angle` | text | AI guidance note |
| `marketing_hook` | text | Promotional suggestion |
| `commercial_weight` | numeric | Importance weight (April 2026) |

---

## Media

### `media_assets`
Business photos and media files.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `business_id` | uuid FK | |
| `url` | text | Storage URL |
| `type` | text | `photo`, `video` |
| `is_hero` / `is_interior` / `is_exterior` / `is_team` | bool | Classification flags |
| `ai_labels` | jsonb | AI-detected labels |
| `category_tags` | text[] | Manual/AI tags |

---

## Supplementary Tables

### `business_documents`
Uploaded PDF/document files (menus, price lists, owner docs).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `business_id` | uuid FK | |
| `document_type` | text | `menu`, `price_list`, `owner_document`, etc. |
| `file_name` / `storage_path` / `public_url` | text | |
| `file_size` | int | Bytes |
| `extracted_text` | text | Raw OCR/parse output |
| `extracted_json` | jsonb | Structured extraction |

---

### `offerings`
Product and service catalogue (non-menu items: experiences, rooms, etc.).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `business_id` | uuid FK | |
| `name` | text | |
| `type` | text | e.g. `dish`, `experience`, `accommodation` |
| `category` | text | |
| `description` | text | |
| `price_min` / `price_max` | decimal | |
| `tags` / `dietary_tags` | text[] | |
| `is_signature` / `is_seasonal` | bool | |
| `season_label` | text | |
| `metadata` | jsonb | |
| `active` | bool | |

---

### `opening_hours`
Structured weekly hours. Preferred over `business_operations.opening_hours` jsonb.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `business_id` | uuid FK | |
| `weekday` | text | `monday`…`sunday` |
| `open_time` / `close_time` | time | `HH:MM` |
| `closed` | bool | |
| `kind` | text | `normal`, `kitchen`, `holiday` |

---

### `specials`
Promotions, events, and limited offers.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `business_id` | uuid FK | |
| `title` | text | |
| `type` | text | `promotion`, `event`, `seasonal`, etc. |
| `description` | text | |
| `price_info` | text | |
| `start_date` / `end_date` | date | |
| `link_url` | text | |
| `recurrence_rule` | text | iCal-style |
| `active` | bool | |

---

### `website_analyses`
Results from website crawl/analysis runs.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `business_id` | uuid FK | |
| `source_url` | text | |
| `status` | text | `pending`, `running`, `done`, `error` |
| `raw_result` | jsonb | Full crawl output |
| `notes` | text | |
| `last_run_at` | timestamptz | |

---

## Dropped Columns & Tables (April 2026)

**Dropped columns from `business_brand_profile`** (migration `20260420000003`–`20260420000006`):

| Column | Dropped in | Notes |
|--------|-----------|-------|
| `cta_style` | `20260420000003` | Replaced by `cta_preference` (which already existed) |
| `content_pillars_jsonb` | `20260420000004` | Legacy jsonb; code uses TEXT `content_pillars` |
| `voice_style` | `20260420000006` | Replaced by structured `tone_model` |
| `personality` | `20260420000005` | Consolidated into other fields |
| `voice_execution` | `20260420000005` | ↑ |
| `execution_profile` | `20260420000005` | ↑ |
| `emotional_core` | `20260420000005` | ↑ |
| `brand_strategy` | `20260420000005` | ↑ |
| `who_when_why` / `who_when_why_internal` | `20260420000005` | Moved into `business_location_intelligence` |
| `offerings_full` | `20260420000005` | Superseded by `core_offerings_jsonb` |

**Dropped tables** (migration `20260420000007`). Do not reference these in new code.

| Table | What it held | Where data moved to |
|-------|-------------|---------------------|
| `business_visual_identity` | Photography style, colours, photo types to avoid | `business_brand_profile` (`visual_character`, `venue_scene`, `venue_energy`) |
| `business_concept_fit` | Per-business concept fit score | `business_location_intelligence.concept_fit_by_category` |
| `business_menu_metadata` | AI-analysed menu summary stats | Dropped — data available via `menu_items_normalized` |
| `business_audience_profile` | Target audience description | `business_brand_profile.target_audience` |
| `business_staff` | Staff profiles | No live replacement |
| `business_concept_fit_multi` | Multi-category concept fit (experimental) | Merged into `business_location_intelligence.concept_fit_by_category` |

---

## Internal & System Tables

### `third_party_evidence`
External data fetched from Google Maps, Instagram, etc. Used as brand profile input signals.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `business_id` | uuid FK | |
| `google_maps_data` | jsonb | Reviews, photos, ratings, description from Google Maps |
| `instagram_data` | jsonb | Recent post data from Instagram |
| `source_type` | text | e.g. `google_maps`, `instagram` |
| `fetched_at` | timestamptz | |
| `created_at` / `updated_at` | timestamptz | |

---

### `brand_profile_sources_state`
Per-source hashes for the brand profile change-detection system. Drives skip-regeneration logic.

| Column | Type | Notes |
|--------|------|-------|
| `business_id` | uuid PK/FK | |
| `business_snapshot_hash` | text | Hash of business table fields |
| `profile_hash` | text | Hash of brand profile row |
| `website_hash` | text | Hash of website analysis |
| `location_hash` | text | Hash of location intelligence |
| `images_hash` | text | Hash of media assets |
| `menu_hash` | text | Hash of menu results |
| `*_changed_at` | timestamptz | When each source last changed |
| `version_hash` | text | Combined hash; if unchanged → skip regeneration |
| `created_at` / `updated_at` | timestamptz | |

---

### `brand_profile_generation_locks`
Single-flight lock preventing concurrent brand profile generation for the same business.

| Column | Type | Notes |
|--------|------|-------|
| `business_id` | uuid | |
| `request_id` | text | Unique ID per generation attempt |
| `started_at` | timestamptz | Lock expires after 3 minutes |
