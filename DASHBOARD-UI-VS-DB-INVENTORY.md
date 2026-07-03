# Dashboard UI vs. Database — Complete Data Inventory

> **Purpose:** Complete mapping of what information is shown to the user on each dashboard page versus what is stored in the Supabase database. Fields marked with ⚠️ are stored in the database but **not currently exposed** to the user in the UI.
>
> **Last reviewed:** April 2026  
> **Pages covered:** `/dashboard/profile`, `/dashboard/menu`, `/dashboard/location`, `/dashboard/brand`

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Shown and editable by user |
| 👁️ | Displayed read-only (not editable) |
| 🤖 | AI-generated, stored in DB, shown read-only |
| ⚠️ | Stored in DB — **not shown** to the user on this page |
| 🔒 | Paid tier (Smart/Pro) only |

---

## 1. `/dashboard/profile` — Business Profile

**Component:** `BusinessProfilePage.tsx`  
**Primary DB tables:** `businesses`, `business_profile`, `business_brand_profile`, `business_locations`, `business_operations`, `opening_hours`

---

### 1.1 Business Basics

| Field | UI Status | DB Table | DB Column |
|-------|-----------|----------|-----------|
| Business name | ✅ | `businesses` | `name` |
| Website URL | ✅ | `businesses` | `website_url` |
| Industry / sector (Hospitality, Beauty, Wellness, Retail) | ✅ 🔒 | `businesses` | `vertical` |
| Business category (cafe, restaurant, bar, etc.) | ✅ 🔒 | `businesses` | `vertical` |
| Logo URL | ✅ 🔒 | `businesses` | `logo_url` |
| Tagline / short description | ✅ | `business_profile` | `short_description` |
| About / long description | ✅ | `business_profile` | `long_description` |
| Normalized URL | ⚠️ | `businesses` | `normalized_url` |
| Primary language | ⚠️ | `businesses` | `primary_language` |
| Subscription tier | ⚠️ | `businesses` | `subscription_tier`, `plan` |
| Service model (full_service / limited_service / counter / delivery) | ⚠️ | `businesses` | `service_model` |
| Menu types array (food, drinks, coffee) | ⚠️ | `businesses` | `menus` |
| Capabilities/tags | ⚠️ | `businesses` | `capabilities` |

---

### 1.2 Business Character & Differentiator

| Field | UI Status | DB Table | DB Column |
|-------|-----------|----------|-----------|
| Business character (AI-generated, editable) | ✅ 🔒 🤖 | `business_brand_profile` | `business_character` |
| Competitive differentiator ("what makes us different") | ✅ 🔒 | `business_brand_profile` | `what_makes_us_different` |
| Brand essence | ⚠️ | `business_brand_profile` | `brand_essence` |
| Tone of voice | ⚠️ | `business_brand_profile` | `tone_of_voice` |
| Target audience | ⚠️ | `business_brand_profile` | `target_audience` |
| Core offerings | ⚠️ | `business_brand_profile` | `core_offerings` |
| Content focus | ⚠️ | `business_brand_profile` | `content_focus` |
| Communication goal | ⚠️ | `business_brand_profile` | `communication_goal` |
| CTA style | ⚠️ | `business_brand_profile` | `cta_style` |
| Image preferences | ⚠️ | `business_brand_profile` | `image_preferences` |
| Things to avoid | ⚠️ | `business_brand_profile` | `things_to_avoid` |
| Emotional promise | ⚠️ | `business_brand_profile` | `emotional_promise` |
| Content exclusions | ⚠️ | `business_brand_profile` | `content_exclusions` |
| Tone keywords | ⚠️ | `business_brand_profile` | `tone_keywords` |
| Values | ⚠️ | `business_brand_profile` | `values` |
| Certifications | ⚠️ | `business_brand_profile` | `certifications` |
| Identity keywords | ⚠️ | `business_brand_profile` | `identity_keywords` |
| Brand essence elaboration | ⚠️ | `business_brand_profile` | `brand_essence_elaboration` |
| Emotional core | ⚠️ | `business_brand_profile` | `emotional_core` |
| Voice constraints | ⚠️ | `business_brand_profile` | `voice_constraints` |
| Brand strategy | ⚠️ | `business_brand_profile` | `brand_strategy` |
| Who/When/Why matrix | ⚠️ | `business_brand_profile` | `who_when_why` |
| Owner document summary (brand_feel, tone, USPs, audience, caption examples) | ⚠️ | `business_brand_profile` | `owner_document` |
| Quality status | ⚠️ | `business_brand_profile` | `quality_status` |

---

### 1.3 Location

| Field | UI Status | DB Table | DB Column |
|-------|-----------|----------|-----------|
| Address line 1 | ✅ | `business_locations` | `address_line1` |
| Postal code | ✅ | `business_locations` | `postal_code` |
| City | 👁️ (auto-filled) | `business_locations` | `city` |
| Country | 👁️ (auto-filled) | `business_locations` | `country` |
| Address line 2 | ⚠️ | `business_locations` | `address_line2` |
| Google Maps URL | ⚠️ | `business_locations` | `maps_url` |
| Location label | ⚠️ | `business_locations` | `label` |
| Geo coordinates (lat/lng) | ⚠️ | `business_locations` | `enrichment` (JSONB) |
| Area enrichment (macro/micro context, area type) | ⚠️ | `business_locations` | `enrichment` (JSONB) |

---

### 1.4 Contact

| Field | UI Status | DB Table | DB Column |
|-------|-----------|----------|-----------|
| Phone | ✅ 🔒 | `business_locations` | `phone` |
| Email | ✅ 🔒 | `business_locations` | `email` |
| Booking link | ✅ 🔒 | `business_brand_profile` | `booking_link` |
| Booking URL (alternate field) | ⚠️ | `business_profile` | `booking_url` |
| Target audience (profile level) | ⚠️ | `business_profile` | `target_audience` |
| Founded year | ⚠️ | `business_profile` | `founded_year` |
| Price level (profile level) | ⚠️ | `business_profile` | `price_level` |

---

### 1.5 Opening Hours

| Field | UI Status | DB Table | DB Column |
|-------|-----------|----------|-----------|
| Open time per weekday (Mon–Sun) | ✅ | `opening_hours` | `open_time` (per weekday row) |
| Close time per weekday | ✅ | `opening_hours` | `close_time` |
| Closed flag per weekday | ✅ | `opening_hours` | `closed` |
| Kitchen close time (HH:MM) | ✅ 🔒 | `business_operations` | `kitchen_close_time` |
| Hour kind (normal / kitchen / holiday) | ⚠️ | `opening_hours` | `kind` |
| Service periods array | ⚠️ | `business_operations` | `service_periods` |
| Primary service period | ⚠️ | `business_operations` | `primary_service_period` |
| Optimal posting time windows | ⚠️ | `business_operations` | `posting_time_windows` |
| Typical busy periods | ⚠️ | `business_operations` | `typical_busy_periods` |
| Typical slow periods | ⚠️ | `business_operations` | `typical_slow_periods` |

---

### 1.6 Service Model / Amenities

| Field | UI Status | DB Table | DB Column |
|-------|-----------|----------|-----------|
| Table service | ✅ | `business_operations` | `has_table_service` |
| Takeaway | ✅ | `business_operations` | `has_takeaway` |
| Delivery | ✅ | `business_operations` | `has_delivery` |
| Outdoor seating | ✅ | `business_operations` | `has_outdoor_seating` |
| WiFi | ✅ | `business_operations` | `has_wifi` |
| Power outlets | ✅ | `business_operations` | `has_power_outlets` |
| Parking | ✅ | `business_operations` | `has_parking` |
| Reservation required | ✅ | `business_operations` | `reservation_required` |
| Kids menu | ✅ | `business_operations` | `has_kids_menu` |
| Accepts walk-ins | ⚠️ | `business_operations` | `accepts_walk_ins` |
| Indoor seating capacity | ⚠️ | `business_operations` | `seating_capacity_indoor` |
| Outdoor seating capacity | ⚠️ | `business_operations` | `seating_capacity_outdoor` |
| Establishment type (FSE / SBO) | ⚠️ | `business_operations` | `establishment_type` |

---

### 1.7 Weekly Programme

| Field | UI Status | DB Table | DB Column |
|-------|-----------|----------|-----------|
| Weekly programme (recurring events: happy hour, quiz night, DJ, live music) | ✅ 🔒 | `business_operations` | `weekly_programme` |

---

### 1.8 Tables related to Profile — not shown on any page

| Table | What it stores |
|-------|---------------|
| `business_staff` | Staff with name, role, bio, specialties, certifications, years experience, photo |
| `media_assets` | Photos, logos, PDFs with AI-assigned category tags and labels |

---

## 2. `/dashboard/menu` — Menu

**Component:** `MenuPage.tsx`  
**Primary DB tables:** `menu_sources`, `menu_results_v2`, `menu_items_normalized`, `business_operations`

> Free tier users see an upgrade prompt only. Full menu management requires Smart/Pro.

---

### 2.1 Menu Source Management

| Field | UI Status | DB Table | DB Column |
|-------|-----------|----------|-----------|
| Source URL | ✅ (add) / 👁️ (display) | `menu_sources` | `source_url` |
| Source type (url / pdf) | 👁️ | `menu_sources` | `source_type` |
| Source origin (ai_detected / manual_added) | 👁️ | `menu_sources` | `source_origin` |
| Extraction status (pending / extracting / extracted / error) | 👁️ | `menu_sources` | `status` |
| Error message | 👁️ | `menu_sources` | `error_message` |
| PDF file name | 👁️ | `menu_sources` | `file_name` |
| Menu type (standard / special) | ⚠️ | `menu_sources` | `menu_type` |
| Source label | ⚠️ | `menu_sources` | `label` |

---

### 2.2 Extracted Menu Data

| Field | UI Status | DB Table | DB Column |
|-------|-----------|----------|-----------|
| Menu title | 👁️ 🤖 | `menu_results_v2` | `structured_data → menuTitle` |
| Menu subtitle | 👁️ 🤖 | `menu_results_v2` | `structured_data → menuSubtitle` |
| AI summary (5-bullet) | 👁️ 🤖 | `menu_results_v2` | `ai_summary` |
| Availability time badge | 👁️ | `menu_results_v2` | `structured_data → availabilityTime` |
| Availability days badge | 👁️ | `menu_results_v2` | `structured_data → availabilityDays` |
| Item count (calculated from categories) | 👁️ | Calculated client-side | — |
| Average price (calculated from items) | 👁️ | Calculated client-side | — |
| Service period | 👁️ | `menu_results_v2` | `service_period` |
| Raw extracted text | ⚠️ | `menu_results_v2` | `raw_text` |
| Extraction method | ⚠️ | `menu_results_v2` | `extraction_method` |
| Content hash (dedup) | ⚠️ | `menu_results_v2` | `sha256` |
| Detected language | ⚠️ | `menu_results_v2` | `language_code` |
| Worker attempt count | ⚠️ | `menu_results_v2` | `attempts` |

---

### 2.3 Menu Item Detail (expanded view, inline edit mode)

| Field | UI Status | DB Table | DB Column |
|-------|-----------|----------|-----------|
| Item name | ✅ (edit mode) / 👁️ | `menu_items_normalized` | `item_name` |
| Item description | ✅ (edit mode) / 👁️ | `menu_items_normalized` | `item_description` |
| Item price | ✅ (edit mode) / 👁️ | `menu_items_normalized` | `item_price` |
| Category name | 👁️ | `menu_items_normalized` | `category_name` |
| Category type (main / kids / dessert / etc.) | ⚠️ | `menu_items_normalized` | `category_type` |
| Service periods (brunch / lunch / dinner) | ⚠️ | `menu_items_normalized` | `service_periods` |
| Service period name | ⚠️ | `menu_items_normalized` | `service_period_name` |
| Menu title (section header) | ⚠️ | `menu_items_normalized` | `menu_title` |
| Signature item flag | ⚠️ | `menu_items_normalized` | `is_signature` |
| Seasonal flag | ⚠️ | `menu_items_normalized` | `is_seasonal` |
| Limited time flag | ⚠️ | `menu_items_normalized` | `is_limited_time` |
| Dish temperature category | ⚠️ | `menu_items_normalized` | `dish_temp_category` |
| Seasonal ingredients | ⚠️ | `menu_items_normalized` | `seasonal_ingredients` |
| Location tags | ⚠️ | `menu_items_normalized` | `location_tags` |
| Total times posted | ⚠️ | `menu_items_normalized` | `total_times_posted` |
| Average engagement rate | ⚠️ | `menu_items_normalized` | `avg_engagement_rate` |
| Last posted date | ⚠️ | `menu_items_normalized` | `last_posted_date` |

---

### 2.4 Pricing Context

| Field | UI Status | DB Table | DB Column |
|-------|-----------|----------|-----------|
| Price level (budget / moderate / upscale / fine_dining) | ✅ | `business_operations` | `price_level` |
| Average check per person (DKK) | ✅ | `business_operations` | `average_check_per_person` |
| Currency | ⚠️ | `business_operations` | `currency` |

---

### 2.5 Tables related to Menu — not shown on any page

| Table | What it stores |
|-------|---------------|
| `business_documents` | Uploaded PDF documents with OCR results and storage paths |

---

## 3. `/dashboard/location` — Location Intelligence

**Component:** `LocationIntelligencePage.tsx`  
**Primary DB tables:** `business_location_intelligence`, `business_concept_fit`, `business_concept_fit_multi`, `business_locations`

> This page is **almost entirely read-only**. The only user action is triggering the AI analysis.

---

### 3.1 Address Display (input)

| Field | UI Status | DB Table | DB Column |
|-------|-----------|----------|-----------|
| Address + city (read-only display) | 👁️ | `business_locations` | `address_line1`, `city` |

---

### 3.2 Concept Fit Results — shown per location type scoring ≥ 60%

| Field | UI Status | DB Table | DB Column |
|-------|-----------|----------|-----------|
| Location type / category name | 🤖 👁️ | `business_concept_fit_multi` | `location_type_id` |
| Strategy driver badge | 🤖 👁️ | `business_concept_fit_multi` | `is_primary_strategy` |
| One-liner summary | 🤖 👁️ | `business_concept_fit_multi` | fit JSONB |
| Fit strengths list | 🤖 👁️ | `business_concept_fit_multi` | `fit_reasons` (JSONB) |
| Marketing content emphasis | 🤖 👁️ | `business_concept_fit_multi` | `emphasis` (JSONB) |
| Best marketing angle | 🤖 👁️ | `business_concept_fit_multi` | fit JSONB |

---

### 3.3 Stored but not shown to user

| Field | DB Table | DB Column |
|-------|----------|-----------|
| Overall fit level (strong / moderate / challenging) | `business_concept_fit` | `overall_fit_level` |
| Overall fit score (0–1) | `business_concept_fit` | `overall_fit_score` |
| Confidence score | `business_concept_fit` | `confidence` |
| Customer fit rating | `business_concept_fit` | `customer_fit` |
| Motivation fit rating | `business_concept_fit` | `motivation_fit` |
| Pace fit rating | `business_concept_fit` | `pace_fit` |
| Price fit rating | `business_concept_fit` | `price_fit` |
| Winning angles fit | `business_concept_fit` | `winning_angles_fit` |
| Mismatch reasons | `business_concept_fit` | `mismatch_reasons` |
| Weaknesses | `business_concept_fit` | `weaknesses` |
| Recommended strategy approach (amplify / adapt / contrarian) | `business_concept_fit` | `strategy_approach` |
| Strategy positioning statement | `business_concept_fit` | `strategy_positioning` |
| Content angles to avoid | `business_concept_fit` | `avoid` |
| CTA style recommendation | `business_concept_fit` | `cta_style` |
| Detected customer motivations | `business_concept_fit` | `detected_motivations` |
| Weather sensitivity (low / medium / high) | `business_concept_fit` | `weather_sensitivity` |
| Seasonality pattern | `business_concept_fit` | `seasonality_pattern` |
| Seasonal weights | `business_concept_fit` | `seasonal_weights` |
| Individual fit score per location type | `business_concept_fit_multi` | `fit_score`, `location_type_score` |
| Neighborhood name | `business_location_intelligence` | `neighborhood` |
| Neighborhood character description | `business_location_intelligence` | `neighborhood_character` |
| Area type (old_town / harbor_front / residential / business_district) | `business_location_intelligence` | `area_type` |
| GPS coordinates | `business_location_intelligence` | `latitude`, `longitude` |
| Nearby landmarks (name, type, walking distance, marketing angle) | `business_location_intelligence` | `landmarks_nearby` (JSONB) |
| Public transport info | `business_location_intelligence` | `public_transport` (JSONB) |
| Has view | `business_location_intelligence` | `has_view` |
| View type (water / courtyard / street / garden) | `business_location_intelligence` | `view_type` |
| Outdoor space type (terrace / courtyard / sidewalk / rooftop / garden) | `business_location_intelligence` | `outdoor_space_type` |
| Location marketing hooks (AI-generated selling points) | `business_location_intelligence` | `location_marketing_hooks` |
| Hidden gem flag | `business_location_intelligence` | `is_hidden_gem` |
| Street visibility (high / medium / low / hidden) | `business_location_intelligence` | `street_visibility` |

---

## 4. `/dashboard/brand` — Brand Profile

**Component:** `BrandProfilePage.tsx`  
**Primary DB tables:** `business_brand_profile`, `business_profile`

> Free tier: upgrade prompt only. Full functionality requires Smart/Pro.

---

### 4.1 AI Brand Context Document

| Field | UI Status | DB Table | DB Column |
|-------|-----------|----------|-----------|
| Full brand context text | ✅ (editable in edit mode) | `business_profile` | `ai_brand_context` |
| Generated timestamp | 👁️ | `business_profile` | `ai_brand_context_generated_at` |
| Approved status | 👁️ | `business_profile` | `ai_brand_context_approved` |

---

### 4.2 Brand Context — parsed sections shown as cards (read-only)

| Section key | Label shown | UI Status | DB Source |
|-------------|-------------|-----------|-----------|
| `essence` | Hvem I er | 🤖 👁️ | parsed from `ai_brand_context` |
| `tone` | Sådan taler I | 🤖 👁️ | parsed from `ai_brand_context` |
| `audience` | Hvem I taler til | 🤖 👁️ | parsed from `ai_brand_context` |
| `menu` | Det I tilbyder | 🤖 👁️ | parsed from `ai_brand_context` |
| `focus` | Hvad I typisk deler | 🤖 👁️ | parsed from `ai_brand_context` |
| `images` | Billeder & stemning | 🤖 👁️ | parsed from `ai_brand_context` |
| `avoid` | Undgå dette | 🤖 👁️ | parsed from `ai_brand_context` |
| `location` | Lokal forankring | 🤖 👁️ | parsed from `ai_brand_context` |
| `hours` | Åbningstider (kort) | 🤖 👁️ | parsed from `ai_brand_context` |
| `goal` | Formålet med jeres opslag | 🤖 👁️ | parsed from `ai_brand_context` |

---

### 4.3 AI Reasoning Debug Panel (read-only toggles)

| Panel | UI Status | DB Source |
|-------|-----------|-----------|
| Hvad I er kendt for — reasoning + evidence | 👁️ | `business_brand_profile` (generation metadata JSONB) |
| Hvem I henvender jer til — reasoning + evidence | 👁️ | `business_brand_profile` (generation metadata JSONB) |
| Jeres kommunikationsmål — reasoning + evidence | 👁️ | `business_brand_profile` (generation metadata JSONB) |

---

### 4.4 Social Style Panel (read-only)

| Field | UI Status | DB Table | DB Column |
|-------|-----------|----------|-----------|
| Emoji usage level (none / minimal / moderate / expressive) | 🤖 👁️ | `business_brand_profile` | `social_style` (JSONB) |
| Emoji usage description | 🤖 👁️ | `business_brand_profile` | `social_style` (JSONB) |
| Emoji examples | 🤖 👁️ | `business_brand_profile` | `social_style` (JSONB) |
| Branded hashtags | 🤖 👁️ | `business_brand_profile` | `social_style → hashtag_strategy.branded` |
| Category hashtags | 🤖 👁️ | `business_brand_profile` | `social_style → hashtag_strategy.category` |
| Local hashtags | 🤖 👁️ | `business_brand_profile` | `social_style → hashtag_strategy.local` |

---

### 4.5 Voice Examples Panel (read-only)

| Field | UI Status | DB Table | DB Column |
|-------|-----------|----------|-----------|
| "Do say" example phrases | 🤖 👁️ | `business_brand_profile` | `voice_examples → do_say` |
| "Don't say" phrases | 🤖 👁️ | `business_brand_profile` | `voice_examples → dont_say` |
| Preferred vocabulary | 🤖 👁️ | `business_brand_profile` | `voice_examples → vocabulary.prefer` |
| Avoid vocabulary | 🤖 👁️ | `business_brand_profile` | `voice_examples → vocabulary.avoid` |

---

### 4.6 Brand fields saved to DB but not shown on this page

| Field | DB Table | DB Column |
|-------|----------|-----------|
| Voice style (casual / professional / friendly / energetic) | `business_brand_profile` | `voice_style` |
| CTA preference | `business_brand_profile` | `cta_style` |
| Target audience text | `business_profile` | `target_audience` |
| Tone model (structured: keywords, writing rules, formality, emoji level) | `business_brand_profile` | `tone_model` |
| Do-not-say list (structured JSONB) | `business_brand_profile` | `do_not_say` |
| Content pillars | `business_brand_profile` | `content_pillars_jsonb` |
| Brand strategy | `business_brand_profile` | `brand_strategy` |
| Who/When/Why matrix | `business_brand_profile` | `who_when_why` |
| Voice execution (signature phrases, opening patterns, writing patterns) | `business_brand_profile` | `voice_execution` |
| Personality calibration (humor, formality, storytelling style) | `business_brand_profile` | `personality` |
| Brand context (origin story, differentiator, local landmarks) | `business_brand_profile` | `brand_context` |
| Recognizable interior identity (AI photo description) | `business_brand_profile` | `recognizable_interior_identity` |
| Visual character label (e.g. "Casual industriel café") | `business_brand_profile` | `visual_character` |
| Venue scene description | `business_brand_profile` | `venue_scene` |
| Venue energy descriptor (e.g. "hyggelig, livlig") | `business_brand_profile` | `venue_energy` |
| Posting occasions (AI-selected schedule) | `business_brand_profile` | `posting_occasions` |
| Content strategy confirmed flag | `business_brand_profile` | `content_strategy_confirmed` |
| Emotional promise (the feeling a guest takes home) | `business_brand_profile` | `emotional_promise` |
| Content exclusions (what this brand never posts about) | `business_brand_profile` | `content_exclusions` |
| AI execution profile (optimized for post-idea generation) | `business_brand_profile` | `execution_profile` |
| All offering candidates with scores and evidence | `business_brand_profile` | `offerings_full` |
| Owner document summary | `business_brand_profile` | `owner_document` |
| Brand quality status | `business_brand_profile` | `quality_status` |
| Version hash (change detection) | `business_brand_profile` | `version_hash` |
| Generation errors | `business_brand_profile` | `generation_errors` |

---

## 5. Global Tables — Not Accessible on Any Dashboard Page

The following tables exist in the database and are populated (manually or by AI) but have no corresponding UI page in the current dashboard setup section:

| Table | What it stores | Notes |
|-------|---------------|-------|
| `business_staff` | Team members: name, role, bio, specialties, certifications, experience, photo URL | No UI |
| `media_assets` | Photos, logos, PDFs with AI-assigned labels and category tags | No UI |
| `website_analyses` | Full website crawl results: page text, hero text, nav items, detected links, keywords | Results used during auto-fill only; no dedicated view |
| `contextual_calendar` | National holidays, school vacations, cultural events with content angles (per country) | Used internally by AI; never shown to user |
| `weather_cache` | 7-day weather forecast cache per city | Used internally by AI suggestions; not shown to user |
| `platform_intelligence` | Platform algorithm knowledge (Instagram, Facebook, GMB posting rules) | Internal AI reference; not shown to user |
| `social_accounts` | Connected social media accounts with OAuth status | Managed via `/dashboard/social-media` (separate page) |
| `business_team_members` | Team access roles (owner / admin / member), invited/accepted timestamps | Managed via `/dashboard/team` (separate page) |
| `profiles` | Legacy single-table user+business record (superseded by `businesses`) | Legacy; partially in use |

---

## 6. Summary

| Setup page | Editable fields shown | Read-only fields shown | Significant fields stored but not shown |
|------------|----------------------|------------------------|----------------------------------------|
| `/dashboard/profile` | ~20 | ~4 | ~30+ (brand intelligence, location enrichment, audience profile) |
| `/dashboard/menu` | ~5 (item edit + pricing) | ~10 (status, AI summary, counts) | ~15+ (item flags, engagement data, menu metadata) |
| `/dashboard/location` | 0 | ~6 (fit categories + one-liners) | ~25+ (full concept fit scores, location intelligence detail) |
| `/dashboard/brand` | 1 (brand context text) | ~25 (parsed cards, social style, voice examples, reasoning) | ~25+ (tone model, brand strategy, personality, posting occasions) |

> **Key observation:** The database contains substantially richer information than what is shown to the user. The AI systems (daily suggestions, weekly strategy, caption generator) use a subset of this stored data internally — much of which the user has no visibility into, cannot review, and cannot correct. The largest "invisible" data layers are: brand intelligence (`business_brand_profile`), full location/concept fit analysis, menu item metadata (flags, engagement, time bounds), and the audience/competitor profile.
