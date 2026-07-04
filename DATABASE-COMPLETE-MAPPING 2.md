# DATABASE COMPLETE MAPPING
**Complete database schema with all ID relationships and data linkages**  
_Generated: 5. maj 2026 (VERIFIED AGAINST MIGRATIONS)_  
_Scope: All 26 production tables with complete columns, types, constraints, and foreign key relationships_

---

## ⚠️ VERIFICATION STATUS
- **Source:** Extracted from Supabase migration files (supabase/migrations/)
- **Base Schema:** fresh_install_schema.sql
- **Modifications Tracked:** 26 ADD COLUMN + 17 DROP COLUMN operations across migrations
- **Accuracy:** ✅ Verified against actual migration files
- **Note:** `brand_profile_generation_locks` was removed from production (empty table, deleted May 5, 2026)
- **Live Supabase Verification:** ✅ Re-checked against linked remote project (`kvqdkohdpvmdylqgujpn`) via `supabase db dump --linked --schema public` on 5. maj 2026

### Runtime Alignment Check (Weekly Strategy + Weekly Plan)
- **Status:** ✅ Re-verified on 5. maj 2026 against strategy/plan Edge function code paths
- **Updated in this revision:**
  - `weekly_strategies.status` now includes `pending` and `error`
  - `weekly_strategies` includes `strategic_brief`, `strategic_brief_raw`, `strategy_version`
  - `weekly_content_plans` includes `strategy_id` FK to `weekly_strategies.id`
  - `contextual_calendar` includes `commercial_weight` and `lead_days`
  - `businesses` includes `archetype` and `country_code`

---

## TABLE OF CONTENTS
1. [Core Business Entity](#core-business-entity)
2. [Business Profile Group](#business-profile-group)
3. [User Profiles](#user-profiles)
4. [Content Planning](#content-planning)
5. [Menu System](#menu-system)
6. [Calendar & Context](#calendar--context)
7. [Configuration & Rules](#configuration--rules)
8. [ID Relationship Map](#id-relationship-map)

---

## CORE BUSINESS ENTITY

### `businesses`
**Primary Key:** `id` (uuid)  
**Source:** fresh_install_schema.sql + PHASE1_ESSENTIAL_SCHEMA.sql + 20260503_add_content_timing_support.sql  
**Links To:** All business-related tables via `business_id` foreign key

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| **`id`** | uuid | PK, DEFAULT gen_random_uuid() | **Root business entity ID** |
| `owner_id` | uuid | NOT NULL, FK→auth.users(id) | Business owner |
| `name` | text | NOT NULL | Business name |
| `vertical` | text | NOT NULL | Industry vertical |
| `website_url` | text | - | Main website URL |
| `primary_language` | text | DEFAULT 'da' | ISO language code |
| `created_at` | timestamptz | DEFAULT NOW() | - |
| `updated_at` | timestamptz | DEFAULT NOW() | - |
| `plan` | text | DEFAULT 'free', CHECK IN ('free', 'standardplus', 'premium') | Subscription plan |
| `ai_generations_today` | integer | DEFAULT 0 | Daily quota counter |
| `ai_generations_this_month` | integer | DEFAULT 0 | Monthly quota counter |
| `pdf_uploads_today` | integer | DEFAULT 0 | Daily PDF upload count |
| `pdf_uploads_this_month` | integer | DEFAULT 0 | Monthly PDF upload count |
| `website_analysis_today` | integer | DEFAULT 0 | Daily website analysis count |
| `website_analysis_this_month` | integer | DEFAULT 0 | Monthly website analysis count |
| `scheduled_posts_this_month` | integer | DEFAULT 0 | Monthly scheduled posts count |
| `last_daily_reset` | date | DEFAULT CURRENT_DATE | Last daily quota reset |
| `last_monthly_reset` | date | DEFAULT date_trunc('month', now()) | Last monthly quota reset |
| `category` | text | - | Business category/subcategory |
| `logo_url` | text | - | Logo URL |
| `subscription_tier` | text | DEFAULT 'free' | Legacy subscription tier field |
| `subpage_urls` | jsonb | DEFAULT '[]' | Detected subpage URLs from website crawl |
| `selected_platforms` | jsonb | DEFAULT '["instagram", "facebook"]' | Array of selected platforms |
| `country` | text | NOT NULL DEFAULT 'DK' | ISO 3166-1 alpha-2 country code |
| `quick_suggestions_today` | integer | DEFAULT 0 | Quick suggestions usage counter |
| `last_quick_suggestions_reset` | date | DEFAULT CURRENT_DATE | Last quick suggestions reset date |
| `video_uploads_this_week` | integer | DEFAULT 0 | Weekly video upload counter |
| `archetype` | text | DEFAULT 'casual_dining' | Business archetype used by content timing and strategy interpretation |
| `country_code` | text | DEFAULT 'DK' | ISO 3166-1 alpha-2 (runtime strategy source) |

**Implementation Note:**
- Runtime strategy code currently reads `businesses.country_code` and `businesses.archetype`.
- `businesses.country` is still present and used as fallback in some paths.

**Foreign Keys:**
- `owner_id` → `auth.users(id)` ON DELETE CASCADE

**Referenced By:** 18 tables via `business_id`

---

## BUSINESS PROFILE GROUP
_Tables with one-to-one or one-to-many relationships to `businesses.id`_

### `business_profile`
**Primary Key:** `business_id` (uuid)  
**Source:** fresh_install_schema.sql + multiple ALTER TABLE migrations  
**Relationship:** One-to-one with businesses

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| **`business_id`** | uuid | PK, FK→businesses(id) ON DELETE CASCADE | - |
| `short_description` | text | - | Brief business description |
| `long_description` | text | - | Extended business description |
| `created_at` | timestamptz | DEFAULT NOW() | - |
| `updated_at` | timestamptz | DEFAULT NOW() | - |
| `menu_description` | text | - | Quick menu overview for AI |
| `menu_structure` | jsonb | - | Full structured menu data (Added 20251223100000) |
| `ai_brand_context` | text | - | AI-generated brand context prompt |
| `ai_brand_context_generated_at` | timestamptz | - | When AI context was generated |
| `ai_brand_context_approved` | boolean | DEFAULT FALSE | Owner approved AI context |
| `detected_menu_urls` | text[] | DEFAULT '{}' | URLs found during website crawl |
| `keywords` | text[] | - | AI-extracted keywords (Added 20251223100000) |

**Removed Columns:**
- `target_audience` (Dropped 20260419000001)
- `booking_url` (Dropped 20260419000001)  
- `price_level` (Dropped 20260419000001)

---

### `business_brand_profile`
**Primary Key:** `business_id` (uuid)  
**Source:** fresh_install_schema.sql + multiple modifications  
**Relationship:** One-to-one with businesses  
**Note:** 77 columns total (extensive brand voice/tone data)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| **`business_id`** | uuid | PK, FK→businesses(id) ON DELETE CASCADE | - |
| `tone_keywords` | text[] | - | Quick-reference tone tags |
| `values` | text[] | - | Core brand values |
| `certifications` | text[] | - | Quality/ethical certifications |
| `do_not_say` | jsonb | - | Prohibited terms/phrases |
| `created_at` | timestamptz | DEFAULT NOW() | - |
| `updated_at` | timestamptz | DEFAULT NOW() | - |
| `offerings_full` | jsonb | - | All core offering candidates with scores and evidence |
| `booking_link` | text | - | URL for booking/reservations |
| `cta_preference` | text | - | Preferred call-to-action text/style |
| `business_voice` | text | CHECK IN ('formal', 'professional', 'friendly', 'casual'), DEFAULT 'friendly' | Voice/tone setting |
| `atmosphere_confidence_level` | text | CHECK IN ('none', 'building', 'high'), DEFAULT 'none' | Photo atmosphere synthesis confidence (Added 20260423000001) |

**Strategy/Plan Runtime-Critical Columns (used directly by weekly strategy generation):**
- `tone_of_voice`
- `brand_essence`
- `brand_essence_elaboration`
- `business_character`
- `content_strategy`
- `voice_constraints`
- `identity_keywords`
- `audience_segments`
- `audience_framework`
- `signature_phrases`, `never_say`, `typical_openings`, `typical_closings`
- `voice_rationale`, `recognizable_interior_identity`, `venue_scene`, `visual_character`

**Live Schema Gap Note (5. maj 2026):**
- `post_length_guidelines` is referenced in strategy code paths but is **not present** as a column in the live `business_brand_profile` table dump.

**Removed Columns:**
- `voice_style` (Dropped 20260420000006)
- `content_pillars_jsonb` (Dropped 20260420000004)
- `cta_style` (Dropped 20260420000003)

---

### `business_operations`
**Primary Key:** `business_id` (uuid)  
**Source:** fresh_install_schema.sql + multiple ALTER TABLE migrations  
**Relationship:** One-to-one with businesses

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| **`business_id`** | uuid | PK, FK→businesses(id) ON DELETE CASCADE | - |
| `opening_hours` | jsonb | DEFAULT '{}' | Legacy field (use opening_hours table instead) |
| `seating_capacity_indoor` | integer | - | Indoor seating capacity |
| `seating_capacity_outdoor` | integer | - | Outdoor seating capacity |
| `price_level` | text | CHECK IN ('budget', 'moderate', 'upscale', 'fine_dining') | Price tier |
| `average_check_per_person` | integer | - | Average spend per person |
| `currency` | text | DEFAULT 'DKK' | Currency code |
| `has_table_service` | boolean | DEFAULT TRUE | Table service available |
| `has_takeaway` | boolean | DEFAULT FALSE | Takeaway service available |
| `has_delivery` | boolean | DEFAULT FALSE | Delivery service available |
| `reservation_required` | boolean | DEFAULT FALSE | Reservation required |
| `accepts_walk_ins` | boolean | DEFAULT TRUE | Walk-ins accepted |
| `created_at` | timestamptz | DEFAULT NOW() | - |
| `updated_at` | timestamptz | DEFAULT NOW() | - |
| `has_kids_menu` | boolean | DEFAULT FALSE | Kids menu available (Added 20260118000001) |
| `has_outdoor_seating` | boolean | DEFAULT FALSE | Outdoor seating available |
| `establishment_type` | varchar(10) | CHECK IN ('FSE', 'SBO', 'MFV', 'MFD', 'QSR') | Establishment type code |
| `has_wifi` | boolean | DEFAULT FALSE | WiFi available |
| `has_power_outlets` | boolean | DEFAULT FALSE | Power outlets available |
| `has_parking` | boolean | DEFAULT FALSE | Parking available |
| `primary_service_period` | text | CHECK IN ('breakfast', 'brunch', 'lunch', 'dinner', 'all_day', 'evening_only') | Primary service focus |
| `preferred_posts_per_week` | integer | DEFAULT 5, CHECK (1-10) | User-controlled posting frequency (Added 20260211000000) |

**Removed Columns:**
- `service_periods` (Dropped 20260420000002)
- `posting_time_windows` (Dropped 20260419000002)
- `typical_busy_periods` (Dropped 20260419000002)
- `typical_slow_periods` (Dropped 20260419000002)

---

### `business_locations`
**Primary Key:** `id` (uuid)  
**Source:** fresh_install_schema.sql  
**Relationship:** One-to-many with businesses (can have multiple locations)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| **`id`** | uuid | PK, DEFAULT gen_random_uuid() | Location ID |
| `business_id` | uuid | FK→businesses(id) ON DELETE CASCADE | - |
| `label` | text | - | Location label (e.g., "Main entrance") |
| `address_line1` | text | - | Address line 1 |
| `address_line2` | text | - | Address line 2 |
| `postal_code` | text | - | Postal code |
| `city` | text | - | City |
| `country` | text | DEFAULT 'Denmark' | Country name |
| `maps_url` | text | - | Google Maps link |
| `phone` | text | - | Phone number |
| `email` | text | - | Email address |
| `is_primary` | boolean | DEFAULT FALSE | Primary location flag |
| `created_at` | timestamptz | DEFAULT NOW() | - |

---

### `business_location_intelligence`
**Primary Key:** `business_id` (uuid)  
**Source:** fresh_install_schema.sql  
**Relationship:** One-to-one with businesses

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| **`business_id`** | uuid | PK, FK→businesses(id) ON DELETE CASCADE | - |
| `neighborhood` | text | - | Neighborhood/area name |
| `neighborhood_character` | text | - | Area description/character |
| `area_type` | text | - | Area classification |
| `latitude` | numeric(10,8) | - | Latitude coordinate |
| `longitude` | numeric(11,8) | - | Longitude coordinate |
| `landmarks_nearby` | jsonb | DEFAULT '[]' | Nearby landmarks |
| `public_transport` | jsonb | DEFAULT '{}' | Public transport access |
| `has_view` | boolean | DEFAULT FALSE | Has notable view |
| `view_type` | text[] | - | Types of views (harbor, park, etc.) |
| `outdoor_space_type` | text | - | Type of outdoor space |
| `location_marketing_hooks` | text[] | - | AI-generated marketing hooks |
| `is_hidden_gem` | boolean | DEFAULT FALSE | Hidden gem flag |
| `street_visibility` | text | - | Street visibility level |
| `last_updated_by_ai` | timestamptz | - | Last AI update timestamp |
| `user_confirmed_at` | timestamptz | - | User confirmation timestamp |
| `created_at` | timestamptz | DEFAULT NOW() | - |
| `updated_at` | timestamptz | DEFAULT NOW() | - |
| `category_scores` | jsonb | DEFAULT '{}' | Location category scores (0-100) |
| `who_analysis_internal` | jsonb | DEFAULT '[]' | Internal customer analysis |
| `when_analysis_internal` | jsonb | DEFAULT '[]' | Internal timing analysis |
| `why_analysis_internal` | jsonb | DEFAULT '[]' | Internal motivation analysis |
| `who_analysis` | jsonb | DEFAULT '[]' | Public customer analysis |
| `when_analysis` | jsonb | DEFAULT '[]' | Public timing analysis |
| `why_analysis` | jsonb | DEFAULT '[]' | Public motivation analysis |
| `concept_fit_analyzed_at` | timestamptz | - | When concept fit was analyzed |
| `concept_fit_by_category` | jsonb | DEFAULT '{}' | Concept fit per location category |
| `location_type_matches` | jsonb | DEFAULT '{}' | Which location types match this physical location |

---

### `business_concept_fit`
**Primary Key:** `business_id` (uuid)  
**Source:** fresh_install_schema.sql + column removals  
**Relationship:** One-to-one with businesses

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| **`business_id`** | uuid | PK, FK→businesses(id) ON DELETE CASCADE | - |
| `overall_fit_level` | text | NOT NULL, CHECK IN ('strong', 'moderate', 'challenging') | Overall fit assessment |
| `overall_fit_score` | numeric(3,2) | CHECK (0-1) | Overall fit score |
| `overall_fit_confidence` | numeric(3,2) | CHECK (0-1) | Confidence in assessment |
| `customer_fit` | text | CHECK IN ('good', 'moderate', 'poor') | Customer segment fit |
| `motivation_fit` | text | CHECK IN ('good', 'moderate', 'poor') | Motivation alignment |
| `pace_fit` | text | CHECK IN ('good', 'moderate', 'poor') | Pace/rhythm fit |
| `price_fit` | text | CHECK IN ('good', 'moderate', 'poor') | Price point fit |
| `winning_angles_fit` | text | CHECK IN ('good', 'moderate', 'poor') | Marketing angles fit |
| `fit_reasons` | jsonb | - | Reasons for good fit |
| `mismatch_reasons` | jsonb | - | Reasons for poor fit |
| `strengths` | jsonb | - | Business strengths |
| `weaknesses` | jsonb | - | Business weaknesses |
| `strategy_approach` | text | NOT NULL, CHECK IN ('amplify', 'adapt', 'contrarian') | Strategic approach |
| `emphasis` | jsonb | - | What to emphasize |
| `avoid` | jsonb | - | What to avoid |
| `analyzed_for_location_type` | text | - | Location type ID used for analysis |
| `analyzed_at` | timestamp | DEFAULT NOW() | Analysis timestamp |
| `updated_at` | timestamp | DEFAULT NOW() | Last update timestamp |

**Removed Columns:**
- `strategy_positioning` (Dropped 20260420000001)
- `detected_motivations` (Dropped 20260420000001)
- `weather_sensitivity` (Dropped 20260420000001)
- `seasonality_pattern` (Dropped 20260420000001)
- `seasonal_weights` (Dropped 20260420000001)
- `cta_style` (Dropped 20260420000001)

---

### `brand_profile_sources_state`
**Primary Key:** `business_id` (uuid)  
**Source:** 20260108100000_add_brand_profile_sources_state.sql  
**Relationship:** One-to-one with businesses  
**Purpose:** Track changes to brand profile source data

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| **`business_id`** | uuid | PK, FK→businesses(id) ON DELETE CASCADE | - |
| `business_snapshot_hash` | text | - | SHA-256 hash of canonical business snapshot JSON |
| `business_snapshot_changed_at` | timestamptz | - | Last change to business snapshot |
| `profile_hash` | text | - | Hash of business_profile data |
| `profile_changed_at` | timestamptz | - | Last change to profile |
| `website_hash` | text | - | Hash of website_analyses data |
| `website_changed_at` | timestamptz | - | Last change to website data |
| `location_hash` | text | - | Hash of location data |
| `location_changed_at` | timestamptz | - | Last change to location |
| `images_hash` | text | - | Hash of image data |
| `images_changed_at` | timestamptz | - | Last change to images |
| `menu_hash` | text | - | Hash of menu data |
| `menu_changed_at` | timestamptz | - | Last change to menu |
| `version_hash` | text | NOT NULL | Combined hash of all source hashes |
| `created_at` | timestamptz | DEFAULT NOW() | - |
| `updated_at` | timestamptz | DEFAULT NOW() | - |

**Indexes:**
- `idx_brand_profile_sources_state_version_hash` ON version_hash

**RLS:** Enabled

---

## USER PROFILES

### `profiles`
**Primary Key:** `id` (uuid)  
**Source:** fresh_install_schema.sql  
**Relationship:** One-to-one with auth.users

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| **`id`** | uuid | PK, FK→auth.users(id) | Matches auth user ID |
| `email` | text | NOT NULL | User email |
| `business_type` | text | - | Legacy field |
| `onboarding_completed` | boolean | DEFAULT FALSE | Onboarding status |
| `created_at` | timestamptz | DEFAULT NOW() | - |
| `updated_at` | timestamptz | DEFAULT NOW() | - |
| `plan` | text | DEFAULT 'free', CHECK IN ('free', 'standardplus', 'premium') | User subscription plan (legacy) |
| `ai_generations_today` | integer | DEFAULT 0 | Legacy quota counter |
| `ai_generations_this_month` | integer | DEFAULT 0 | Legacy quota counter |
| `pdf_uploads_today` | integer | DEFAULT 0 | Legacy quota counter |
| `pdf_uploads_this_month` | integer | DEFAULT 0 | Legacy quota counter |
| `website_analysis_today` | integer | DEFAULT 0 | Legacy quota counter |
| `website_analysis_this_month` | integer | DEFAULT 0 | Legacy quota counter |
| `scheduled_posts_this_month` | integer | DEFAULT 0 | Legacy quota counter |
| `last_daily_reset` | date | DEFAULT CURRENT_DATE | Legacy quota reset |
| `last_monthly_reset` | date | DEFAULT date_trunc('month', now()) | Legacy quota reset |
| `selected_platforms` | jsonb | DEFAULT '[]' | Legacy platform selection |
| `business_offerings` | jsonb | - | Legacy business offerings data |

**Note:** Most profile data has been migrated to the `businesses` table

---

## CONTENT PLANNING

### `weekly_strategies`
**Primary Key:** `id` (uuid)  
**Source:** 20260210110000_create_weekly_strategies.sql + 20260212000000_add_strategic_brief_storage.sql + 20260315000000_add_pending_status_to_weekly_strategies.sql + multiple ALTER TABLE migrations  
**Relationship:** One-to-many with businesses

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| **`id`** | uuid | PK, DEFAULT gen_random_uuid() | Strategy ID |
| `business_id` | uuid | NOT NULL, FK→businesses(id) ON DELETE CASCADE | - |
| `week_number` | integer | NOT NULL | ISO week number |
| `week_start` | date | NOT NULL | Monday of the week |
| `week_end` | date | NOT NULL | Sunday of the week |
| `is_current_week` | boolean | DEFAULT FALSE | Whether this is the current week |
| `narrative` | jsonb | NOT NULL | {headline, overview, detailed_sections} |
| `strategic_priorities` | jsonb | NOT NULL | Array of {focus, weight, rationale} |
| `post_ideas` | jsonb | NOT NULL | Array of PostIdea objects (count varies by tier/context; typically 3-7) |
| `selected_idea_ids` | integer[] | - | User-selected idea IDs (e.g., [1,3,5,6]) |
| `strategic_brief` | jsonb | - | Phase 1 strategic brief object |
| `strategic_brief_raw` | text | - | Raw model output before brief parsing |
| `strategy_version` | text | DEFAULT 'v2_two_phase' | Strategy generation architecture version |
| `content_strategy_snapshot` | jsonb | - | Snapshot of brand profile content strategy used for slot assignment |
| `week_context_snapshot` | jsonb | - | Full WeekContext used to generate |
| `business_type` | text | NOT NULL | Business type at generation |
| `country` | text | DEFAULT 'DK' | Country at generation |
| `generated_at` | timestamptz | DEFAULT NOW() | When strategy was generated |
| `status` | text | DEFAULT 'generated', CHECK IN ('pending', 'generated', 'ideas_selected', 'posts_created', 'error') | Workflow status |
| `strategy_rationale` | text | - | Weekly modulation rationale (Added 20260310000000) |
| `platforms` | text[] | DEFAULT ARRAY['facebook', 'instagram'] | Target platforms (Added 20260211000000) |
| `subscription_tier` | text | DEFAULT 'smart' | Subscription tier (Added 20260211000000) |
| `target_post_count` | integer | DEFAULT 5 | Target number of posts (Added 20260211000000) |

**Indexes:**
- `idx_weekly_strategies_business_id` ON business_id
- `idx_weekly_strategies_week_start` ON business_id, week_start
- `idx_weekly_strategies_status` ON business_id, status
- `idx_weekly_strategies_unique_week` UNIQUE(business_id, week_start)
- `idx_weekly_strategies_strategic_brief_gin` (GIN) ON strategic_brief
- `idx_weekly_strategies_version` ON business_id, strategy_version

**RLS:** Enabled

### `weekly_content_plans`
**Primary Key:** `id` (uuid)  
**Source:** fresh_install_schema.sql + 20260211000003_add_strategy_id_to_content_plans.sql  
**Relationship:** One-to-many with businesses and users

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| **`id`** | uuid | PK, DEFAULT uuid_generate_v4() | Plan ID |
| `user_id` | uuid | NOT NULL, FK→auth.users(id) ON DELETE CASCADE | Plan owner |
| `business_id` | uuid | NOT NULL, FK→businesses(id) ON DELETE CASCADE | Business |
| `week_number` | integer | NOT NULL | ISO week number |
| `week_start` | date | NOT NULL | Monday of the week |
| `week_end` | date | NOT NULL | Sunday of the week |
| `generated_at` | timestamptz | DEFAULT NOW() | When plan was generated |
| `strategy_id` | uuid | FK→weekly_strategies(id) | Link to source Layer 0 strategy (NULL for legacy plans) |
| `posts` | jsonb | NOT NULL DEFAULT '[]' | Array of complete post specifications |
| `summary` | jsonb | DEFAULT '{}' | Platform distribution, format distribution |
| `learning_data` | jsonb | DEFAULT '{}' | User edit patterns for learning |
| `created_at` | timestamptz | DEFAULT NOW() | - |
| `updated_at` | timestamptz | DEFAULT NOW() | - |

**Indexes:**
- `idx_weekly_plans_business` ON business_id
- `idx_weekly_plans_user` ON user_id
- `idx_weekly_plans_user_week` ON user_id, week_start
- `idx_weekly_plans_week_start` ON week_start
- `idx_weekly_content_plans_strategy_id` ON strategy_id WHERE strategy_id IS NOT NULL

**RLS:** Enabled

---

### `daily_suggestions`
**Primary Key:** `id` (serial)  
**Source:** 20260218130000_create_daily_suggestions.sql + subsequent ALTER TABLE migrations (live schema verified)  
**Relationship:** One-to-many with businesses

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| **`id`** | serial | PK | Suggestion ID |
| `business_id` | uuid | FK→businesses(id) ON DELETE CASCADE | - |
| `title` | text | NOT NULL | 3-7 word post title |
| `rationale` | text | NOT NULL | Strategic reasoning |
| `content_type` | text | NOT NULL, CHECK IN ('menu_item', 'atmosphere', 'behind_scenes', 'seasonal', 'event') | Content type |
| `suggested_time` | text | - | e.g., "12:00", "Evening" |
| `date` | date | NOT NULL DEFAULT CURRENT_DATE | Which day suggestions are for |
| `position` | integer | CHECK (position >= 1 AND position <= 3) | Position in day list (live DB still enforces 1-3) |
| `is_active` | boolean | DEFAULT TRUE | FALSE when user dismisses |
| `selected` | boolean | DEFAULT FALSE | TRUE when user selects |
| `created_at` | timestamptz | DEFAULT NOW() | - |
| `updated_at` | timestamptz | DEFAULT NOW() | - |
| `why_explanation` | text | - | Social Media Expert explanation (Added 20260219120000) |
| `photo_idea` | text | - | Concrete photo suggestion (Added 20260219120000) |
| `uploaded_photo_url` | text | - | URL of uploaded photo (Added 20260220210000) |
| `photo_analysis` | jsonb | - | AI analysis from Gemini (Added 20260220210000) |
| `weather_forecast` | jsonb | - | Weather context at generation (Added 20260220000001) |
| `generated_text` | text | - | Generated text for post (Added 20260220000002) |
| `generated_hashtags` | jsonb | - | Array of hashtag objects (Added 20260220000002) |
| `generated_platform_content` | jsonb | - | Platform-specific variants (Added 20260220000002) |
| `generated_at` | timestamptz | - | When content was generated (Added 20260220000002) |
| `platforms_generated` | text[] | - | Which platforms content was generated for (Added 20260220000002) |
| `media_items` | jsonb | - | Array of uploaded media items (Added 20260221000000) |
| `menu_item_name` | text | NOT NULL DEFAULT '' | Exact selected menu item name (menu posts) |
| `menu_item_description` | text | NOT NULL DEFAULT '' | Menu item description snapshot |
| `caption_base` | text | NOT NULL DEFAULT '' | Seed text passed to text generation |
| `cta_intent` | text | NOT NULL DEFAULT 'visit' | CTA intent for downstream text generation |
| `text_generation_version` | integer | NOT NULL DEFAULT 0 | Regeneration/version counter for text |
| `media_suggestion` | jsonb | - | Structured media recommendation payload |
| `cover_url` | text | - | Public URL of user-chosen Reel cover (Added 20260413000000) |
| `thumbs_up` | boolean | DEFAULT FALSE | Owner positive feedback signal |
| `validation_result` | jsonb | - | Stored timing validation result |
| `inferred_content_type` | text | - | Inferred canonical content timing type |

**Constraints:**
- UNIQUE(business_id, date, position)

**Live Verification Note:**
- Even though a migration exists to increase `position` to 5, the linked live project currently enforces `position <= 3`.

**Indexes:**
- `idx_daily_suggestions_business_date` ON business_id, date
- `idx_daily_suggestions_created` ON created_at
- `idx_daily_suggestions_photo` WHERE uploaded_photo_url IS NOT NULL
- `idx_daily_suggestions_media` (GIN) WHERE media_items IS NOT NULL

**RLS:** Enabled

---

## MENU SYSTEM

### `menu_sources`
**Primary Key:** `id` (uuid)  
**Source:** fresh_install_schema.sql  
**Relationship:** One-to-many with businesses

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| **`id`** | uuid | PK, DEFAULT gen_random_uuid() | Source ID |
| `business_id` | uuid | NOT NULL, FK→businesses(id) ON DELETE CASCADE | - |
| `source_url` | text | NOT NULL | URL or file path identifier |
| `source_type` | text | NOT NULL, CHECK IN ('url', 'pdf') | Source type |
| `file_name` | text | - | Original filename for PDFs |
| `menu_type` | text | NOT NULL DEFAULT 'standard', CHECK IN ('standard', 'special') | Menu type |
| `source_origin` | text | NOT NULL, CHECK IN ('ai_detected', 'manual_added') | Origin of source |
| `status` | text | NOT NULL DEFAULT 'pending', CHECK IN ('pending', 'extracting', 'extracted', 'ignored', 'error') | Processing status |
| `error_message` | text | - | Error details |
| `label` | text | - | Human-readable label (Added 20250704130000) |
| `created_at` | timestamptz | DEFAULT NOW() | - |
| `updated_at` | timestamptz | DEFAULT NOW() | - |
| `created_by` | uuid | FK→auth.users(id) | User who created source |

---

### `menu_results_v2`
**Primary Key:** `id` (uuid)  
**Source:** fresh_install_schema.sql + ALTER TABLE  
**Relationship:** One-to-many with businesses and menu_sources

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| **`id`** | uuid | PK, DEFAULT gen_random_uuid() | Result ID |
| `business_id` | uuid | NOT NULL, FK→businesses(id) | - |
| `source_kind` | text | NOT NULL DEFAULT 'url', CHECK IN ('url', 'storage') | Source kind |
| `source_url` | text | - | Source URL |
| `source_content_type` | text | - | MIME content type |
| `storage_bucket` | text | - | Storage bucket name |
| `storage_path` | text | - | Storage path |
| `sha256` | text | - | Content hash for deduplication |
| `status` | text | NOT NULL DEFAULT 'queued', CHECK IN ('queued', 'processing', 'done', 'error') | Processing status |
| `language_code` | text | DEFAULT 'da' | Detected language |
| `attempts` | integer | DEFAULT 0 NOT NULL | Retry count |
| `claimed_at` | timestamptz | - | Queue management timestamp |
| `completed_at` | timestamptz | - | Completion timestamp |
| `extraction_method` | text | - | Extraction method used |
| `raw_text` | text | - | Extracted raw text |
| `structured_data` | jsonb | - | Parsed menu structure |
| `error_message` | text | - | Error details |
| `created_at` | timestamptz | DEFAULT NOW() | - |
| `updated_at` | timestamptz | DEFAULT NOW() | - |
| `source_id` | uuid | FK→menu_sources(id) | Reference to menu source |
| `service_periods` | text[] | - | Array: brunch, lunch, dinner |
| `service_period_name` | text | - | Single value primary service period |
| `is_signature` | boolean | DEFAULT FALSE | Contains signature dishes |
| `dish_temp_category` | text | - | Hot or cold dishes |
| `ai_summary` | text | - | AI-generated 5-bullet summary (Added 20260222000000) |

---

### `menu_items_normalized`
**Primary Key:** `id` (uuid)  
**Source:** fresh_install_schema.sql + column removals  
**Relationship:** One-to-many with businesses and menu_results_v2

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| **`id`** | uuid | PK, DEFAULT gen_random_uuid() | Item ID |
| `business_id` | uuid | NOT NULL, FK→businesses(id) | - |
| `menu_result_id` | uuid | NOT NULL, FK→menu_results_v2(id) | - |
| `item_name` | text | NOT NULL | Item name |
| `item_description` | text | - | Item description |
| `item_price` | text | - | Price as text |
| `category_name` | text | NOT NULL | Category name |
| `category_type` | text | NOT NULL | Category type |
| `service_periods` | text[] | DEFAULT '{}' NOT NULL | Service periods |
| `service_period_name` | text | - | Primary service period |
| `menu_title` | text | - | Menu title (e.g., FROKOST, AFTEN) |
| `menu_url` | text | - | Source menu URL |
| `is_signature` | boolean | DEFAULT FALSE | Signature dish flag |
| `is_seasonal` | boolean | DEFAULT FALSE | Seasonal dish flag |
| `is_limited_time` | boolean | DEFAULT FALSE | Limited time offer flag |
| `dish_temp_category` | text | - | Hot, cold, warm, neutral |
| `seasonal_ingredients` | text[] | DEFAULT '{}' | Seasonal ingredients |
| `location_tags` | text[] | DEFAULT '{}' | Location tags |
| `synced_at` | timestamptz | DEFAULT NOW() | Last sync timestamp |
| `source_sha256` | text | - | Source content hash |
| `created_at` | timestamptz | DEFAULT NOW() | - |
| `updated_at` | timestamptz | DEFAULT NOW() | - |

**Removed Columns:**
- `total_times_posted` (Dropped 20260419000002)
- `avg_engagement_rate` (Dropped 20260419000002)
- `last_posted_date` (Dropped 20260419000002)

---

### `menu_item_metadata`
**Primary Key:** `id` (uuid)  
**Source:** fresh_install_schema.sql  
**Relationship:** One-to-many with businesses

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| **`id`** | uuid | PK, DEFAULT gen_random_uuid() | Metadata ID |
| `business_id` | uuid | NOT NULL, FK→businesses(id) | - |
| `item_name` | text | NOT NULL | Item name |
| `item_category` | text | - | Item category |
| `item_section` | text | - | Menu section |
| `is_signature` | boolean | DEFAULT FALSE | Signature item (base score 100) |
| `is_seasonal` | boolean | DEFAULT FALSE | Seasonal item (base score 75) |
| `is_limited_time` | boolean | DEFAULT FALSE | Limited time (base score 85) |
| `dish_temp_category` | text | CHECK IN ('cold', 'hot', 'warm', 'neutral') | Temperature category for weather matching |
| `item_added_date` | timestamptz | DEFAULT NOW() | When item was added |
| `item_available_from` | date | - | Availability start date |
| `item_available_to` | date | - | Availability end date |
| `last_posted_date` | timestamptz | - | Last posted timestamp |
| `location_tags` | text[] | - | Location tags |
| `seasonal_ingredients` | jsonb | DEFAULT '[]' | Seasonal ingredients |
| `total_times_posted` | integer | DEFAULT 0 | Total times posted |
| `avg_engagement_rate` | numeric(5,2) | DEFAULT 0 | Average engagement rate |
| `last_engagement_rate` | numeric(5,2) | - | Last engagement rate |
| `created_at` | timestamptz | DEFAULT NOW() | - |
| `updated_at` | timestamptz | DEFAULT NOW() | - |

---

## CALENDAR & CONTEXT

### `contextual_calendar`
**Primary Key:** `id` (uuid)  
**Source:** fresh_install_schema.sql + 20260328000001_calendar_commercial_weight_and_occasions.sql + 20260329000001_fix_contextual_events_security.sql  
**Relationship:** Standalone reference table (no foreign keys)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| **`id`** | uuid | PK, DEFAULT uuid_generate_v4() | Event ID |
| `country` | text | NOT NULL | ISO 3166-1 alpha-2 code |
| `region` | text | - | Optional regional subdivision |
| `event_type` | text | NOT NULL, CHECK IN ('holiday', 'school_vacation', 'season', 'cultural', 'business_rhythm') | Event type |
| `event_name` | text | NOT NULL | Event name |
| `date_start` | date | NOT NULL | Start date |
| `date_end` | date | - | End date (optional for single-day events) |
| `recurrence` | text | CHECK IN ('annual', 'seasonal', 'monthly', 'weekly', NULL) | Recurrence pattern |
| `recurrence_rule` | text | - | Human-readable recurrence description |
| `relevance_tags` | text[] | - | Filter by business concept (e.g., 'families', 'outdoor') |
| `content_angle` | text | - | AI guidance for strategy |
| `marketing_hook` | text | - | Promotional opportunities |
| `commercial_weight` | smallint | NOT NULL DEFAULT 2, CHECK (1-5) | Commercial priority used by weekly strategy weighting |
| `lead_days` | smallint | NOT NULL DEFAULT 3 | Recommended lead-up days before event |
| `created_at` | timestamptz | DEFAULT NOW() | - |
| `updated_at` | timestamptz | DEFAULT NOW() | - |

**Note:** Includes seed data for Denmark 2026 (holidays, school vacations)

---

### `seasonal_ingredients`
**Primary Key:** `id` (uuid)  
**Source:** fresh_install_schema.sql  
**Relationship:** Standalone reference table (no foreign keys)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| **`id`** | uuid | PK, DEFAULT gen_random_uuid() | Ingredient ID |
| `ingredient_name` | text | NOT NULL | Ingredient name |
| `country_code` | text | DEFAULT 'DK' | ISO 3166-1 alpha-2 code |
| `season` | text | NOT NULL, CHECK IN ('spring', 'summer', 'autumn', 'winter') | Season |
| `peak_months` | integer[] | NOT NULL | Array of months (1-12) |
| `bonus_points` | integer | DEFAULT 50 | Scoring bonus for seasonal matching |
| `created_at` | timestamptz | DEFAULT NOW() | - |

---

### `photo_atmosphere_log`
**Primary Key:** `id` (uuid)  
**Source:** 20260423000001_create_photo_atmosphere_log.sql  
**Relationship:** One-to-many with businesses  
**Purpose:** Track photo atmosphere analysis for silent brand profile enrichment

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| **`id`** | uuid | PK, DEFAULT gen_random_uuid() | Log entry ID |
| `business_id` | uuid | NOT NULL, FK→businesses(id) ON DELETE CASCADE | - |
| `photo_url_hash` | text | NOT NULL | SHA-256 hex of storage URL (prevents re-analysis) |
| `content_type` | text | NOT NULL, CHECK IN ('interior', 'atmosphere', 'behind_the_scenes') | Content type |
| `venue_scene` | text | NOT NULL | Perceptual atmosphere description (no object names) |
| `visual_character` | text | - | Short concept label (e.g., "Casual moderne café") |
| `created_at` | timestamptz | NOT NULL DEFAULT NOW() | - |

**Indexes:**
- `photo_atmosphere_log_business_photo_key` UNIQUE(business_id, photo_url_hash)
- `photo_atmosphere_log_business_created_idx` ON business_id, created_at DESC

**RLS:** Enabled (business owner can read own photo atmosphere log)

---

### `business_documents`
**Primary Key:** `id` (uuid)  
**Source:** fresh_install_schema.sql  
**Relationship:** One-to-many with businesses

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| **`id`** | uuid | PK, DEFAULT gen_random_uuid() | Document ID |
| `business_id` | uuid | FK→businesses(id) ON DELETE CASCADE | - |
| `document_type` | text | NOT NULL, CHECK IN ('menu', 'wine_list', 'other') | Document type |
| `file_name` | text | NOT NULL | Original filename |
| `storage_path` | text | NOT NULL | Storage path |
| `public_url` | text | NOT NULL | Public URL |
| `extracted_text` | text | - | Extracted text content |
| `file_size` | integer | - | File size in bytes |
| `created_at` | timestamptz | DEFAULT NOW() | - |
| `updated_at` | timestamptz | DEFAULT NOW() | - |
| `extracted_json` | jsonb | - | Structured menu data from PDF |

---

## CONFIGURATION & RULES

### `business_type_defaults`
**Primary Key:** `business_type` (text)  
**Source:** fresh_install_schema.sql  
**Relationship:** Standalone configuration table (no foreign keys)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| **`business_type`** | text | PK, CHECK IN ('FSE', 'SBO', 'MFV', 'MFD', 'QSR') | Business type code |
| `min_posts_per_week` | integer | NOT NULL | Minimum posts per week |
| `max_posts_per_week` | integer | NOT NULL | Maximum posts per week |
| `ideal_posts_per_week` | integer | NOT NULL | Ideal posts per week |
| `instagram_weight` | numeric(3,2) | DEFAULT 0.50 | Priority weight 0.0-1.0 |
| `facebook_weight` | numeric(3,2) | DEFAULT 0.50 | Priority weight 0.0-1.0 |
| `menu_highlight_ratio` | numeric(3,2) | DEFAULT 0.30 | Ratio of posts featuring menu |
| `location_story_ratio` | numeric(3,2) | DEFAULT 0.20 | Ratio of posts about location |
| `behind_scenes_ratio` | numeric(3,2) | DEFAULT 0.15 | Ratio of behind-the-scenes posts |
| `event_promotion_ratio` | numeric(3,2) | DEFAULT 0.20 | Ratio of event promotion posts |
| `engagement_ratio` | numeric(3,2) | DEFAULT 0.15 | Ratio of engagement posts |
| `default_tone` | text | CHECK IN ('casual', 'refined', 'playful', 'professional') | Default tone |
| `emoji_frequency` | text | CHECK IN ('none', 'minimal', 'moderate', 'frequent') | Emoji usage |
| `caption_length` | text | CHECK IN ('short', 'medium', 'long') | Caption length preference |
| `created_at` | timestamptz | DEFAULT NOW() | - |
| `updated_at` | timestamptz | DEFAULT NOW() | - |

---

### `content_types`
**Primary Key:** `id` (text)  
**Source:** fresh_install_schema.sql  
**Relationship:** Standalone reference table (referenced by rules tables)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| **`id`** | text | PK | Content type ID |
| `display_name` | text | NOT NULL | Display name |
| `description` | text | - | Description |
| `requires_high_quality_photo` | boolean | DEFAULT FALSE | Photo quality requirement |
| `typical_photo_style` | text | - | Photo style guidance |
| `instagram_priority` | integer | DEFAULT 5, CHECK (1-10) | Instagram priority |
| `facebook_priority` | integer | DEFAULT 5, CHECK (1-10) | Facebook priority |
| `is_promotional` | boolean | DEFAULT FALSE | Promotional content flag |
| `is_time_sensitive` | boolean | DEFAULT FALSE | Time-sensitive flag |
| `requires_user_permission` | boolean | DEFAULT FALSE | User permission required |
| `max_frequency_per_week` | integer | - | Maximum posts per week |
| `created_at` | timestamptz | DEFAULT NOW() | - |

---

### `content_distribution_rules`
**Primary Key:** `id` (uuid)  
**Source:** fresh_install_schema.sql  
**Relationship:** References content_types

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| **`id`** | uuid | PK, DEFAULT gen_random_uuid() | Rule ID |
| `business_type` | text | NOT NULL, FK→business_type_defaults(business_type) | Business type |
| `content_type_id` | text | NOT NULL | Content type (references content_types.id) |
| `baseline_percentage` | numeric(4,1) | NOT NULL, CHECK (0-100) | Strategic baseline ratio |
| `posts_per_week` | numeric(3,1) | - | Suggested posts per week |
| `priority` | integer | DEFAULT 5, CHECK (1-10) | Priority level |
| `min_days_between` | integer | DEFAULT 0 | Minimum days between posts of this type |
| `rationale` | text | - | Reasoning for this distribution |
| `examples` | text[] | - | Example post ideas |
| `created_at` | timestamptz | DEFAULT NOW() | - |

---

### `platform_assignment_rules`
**Primary Key:** `id` (uuid)  
**Source:** fresh_install_schema.sql  
**Relationship:** References content_types

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| **`id`** | uuid | PK, DEFAULT gen_random_uuid() | Rule ID |
| `content_type_id` | text | NOT NULL | Content type (references content_types.id) |
| `primary_platform` | text | NOT NULL, CHECK IN ('instagram', 'facebook', 'both') | Primary platform |
| `secondary_platform` | text | CHECK IN ('instagram', 'facebook', 'none') | Secondary platform |
| `rule_description` | text | NOT NULL | Rule description |
| `why` | text | - | Reasoning |
| `created_at` | timestamptz | DEFAULT NOW() | - |

---

### `opening_hours`
**Primary Key:** `id` (uuid)  
**Source:** fresh_install_schema.sql  
**Relationship:** One-to-many with businesses

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| **`id`** | uuid | PK, DEFAULT gen_random_uuid() | Hours ID |
| `business_id` | uuid | NOT NULL, FK→businesses(id) | - |
| `weekday` | text | NOT NULL, CHECK IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday') | Weekday |
| `open_time` | time | - | Opening time (HH:MM) |
| `close_time` | time | - | Closing time (HH:MM) |
| `closed` | boolean | DEFAULT FALSE | Closed on this day |
| `kind` | text | DEFAULT 'normal', CHECK IN ('normal', 'kitchen', 'holiday') | Type of hours |
| `created_at` | timestamptz | DEFAULT NOW() | - |

---

### `website_analyses`
**Primary Key:** `id` (uuid)  
**Source:** fresh_install_schema.sql + ALTER TABLE  
**Relationship:** One-to-many with businesses

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| **`id`** | uuid | PK, DEFAULT gen_random_uuid() | Analysis ID |
| `business_id` | uuid | NOT NULL, FK→businesses(id) | - |
| `source_url` | text | NOT NULL | URL analyzed |
| `status` | text | DEFAULT 'pending', CHECK IN ('pending', 'processing', 'success', 'error') | Processing status |
| `last_run_at` | timestamptz | - | Last run timestamp |
| `raw_result` | jsonb | - | Full crawl output |
| `error_message` | text | - | Error details |
| `notes` | text | - | Analysis notes |
| `created_at` | timestamptz | DEFAULT NOW() | - |
| `homepage_content` | text | - | Clean text from homepage (Added 20251223100000) |
| `about_content` | text | - | Clean text from About page (Added 20251223100000) |
| `detected_links` | jsonb | - | {menu_urls:[], booking_url:"", contact_url:""} (Added 20251223100000) |
| `about_block` | text | - | Pre-extracted about/welcome text (Added 20251223100000) |
| `keywords` | text[] | - | AI-extracted keywords (Added 20251223100000) |
| `menu_structure` | jsonb | - | [{name, timeRange, items}] (Added 20251223100000) |

---

## ID RELATIONSHIP MAP

### HIERARCHY OF IDS

```
auth.users.id (uuid) — Root authentication identity
│
├─> profiles.id (PK/FK) — One-to-one user profile
│
├─> businesses.owner_id (FK) — User owns businesses
│   │
│   └─> businesses.id (uuid) *** ROOT BUSINESS ENTITY ***
│       │
│       ├─> business_profile.business_id (PK/FK) — One-to-one profile
│       ├─> business_brand_profile.business_id (PK/FK) — One-to-one brand profile
│       ├─> business_operations.business_id (PK/FK) — One-to-one operations
│       ├─> business_location_intelligence.business_id (PK/FK) — One-to-one location intelligence
│       ├─> business_concept_fit.business_id (PK/FK) — One-to-one concept fit
│       ├─> brand_profile_sources_state.business_id (PK/FK) — One-to-one hash tracking
│       │
│       ├─> business_locations.business_id (FK) — One-to-many locations
│       ├─> business_documents.business_id (FK) — One-to-many documents
│       ├─> opening_hours.business_id (FK) — One-to-many hours
│       ├─> website_analyses.business_id (FK) — One-to-many analyses
│       ├─> photo_atmosphere_log.business_id (FK) — One-to-many photo logs
│       │
│       ├─> weekly_strategies.business_id (FK) — One-to-many strategies
│       │   └─> weekly_strategies.id (uuid)
│       │       └─> (referenced by weekly_content_plans.strategy_id)
│       │
│       ├─> weekly_content_plans.business_id (FK) — One-to-many content plans
│       ├─> daily_suggestions.business_id (FK) — One-to-many suggestions
│       │
│       ├─> menu_sources.business_id (FK) — One-to-many menu sources
│       │   └─> menu_sources.id (uuid)
│       │       └─> menu_results_v2.source_id (FK) — One-to-many results
│       │
│       ├─> menu_results_v2.business_id (FK) — One-to-many results
│       │   └─> menu_results_v2.id (uuid)
│       │       └─> menu_items_normalized.menu_result_id (FK) — One-to-many items
│       │
│       ├─> menu_items_normalized.business_id (FK) — One-to-many items
│       └─> menu_item_metadata.business_id (FK) — One-to-many metadata
│
├─> weekly_content_plans.user_id (FK) — User creates content plans
└─> menu_sources.created_by (FK) — User creates menu sources

STANDALONE REFERENCE TABLES (no foreign keys to businesses):
├─> contextual_calendar.id (uuid) — Seasonal/calendar events
├─> seasonal_ingredients.id (uuid) — Seasonal ingredient data
├─> content_types.id (text) — Content type definitions
├─> business_type_defaults.business_type (text) — Business type configs
├─> content_distribution_rules.id (uuid) — Distribution rules
└─> platform_assignment_rules.id (uuid) — Platform assignment rules
```

### KEY ID PATTERNS

| Pattern | Description | Tables Count | Tables |
|---------|-------------|--------------|--------|
| **`business_id` as PK/FK** | One-to-one with businesses | 6 | business_profile, business_brand_profile, business_operations, business_location_intelligence, business_concept_fit, brand_profile_sources_state |
| **`business_id` as FK only** | One-to-many with businesses | 12 | business_locations, weekly_strategies, weekly_content_plans, daily_suggestions, menu_sources, menu_results_v2, menu_items_normalized, menu_item_metadata, photo_atmosphere_log, business_documents, website_analyses, opening_hours |
| **Chained Parent-Child IDs** | Hierarchical relationships | 3 chains | weekly_strategies.id → weekly_content_plans.strategy_id<br>menu_sources.id → menu_results_v2.source_id<br>menu_results_v2.id → menu_items_normalized.menu_result_id |
| **User ownership** | Direct user links | 2 | weekly_content_plans.user_id, menu_sources.created_by |
| **Standalone reference** | No business linkage | 6 | contextual_calendar, seasonal_ingredients, content_types, business_type_defaults, content_distribution_rules, platform_assignment_rules |

### CRITICAL DATA FLOW PATHS

**1. Content Generation Flow:**
```
businesses.id 
  → business_brand_profile (voice/tone)
  → menu_items_normalized (content source)
  → daily_suggestions (output)
  + contextual_calendar (seasonal context, no FK)
```

**2. Menu Data Flow:**
```
menu_sources.id 
  → menu_results_v2.source_id 
  → menu_results_v2.id 
  → menu_items_normalized.menu_result_id
  + menu_item_metadata (performance tracking by business_id)
```

**3. Weekly Strategy Flow:**
```
weekly_strategies.id 
  → weekly_content_plans.strategy_id
weekly_content_plans.user_id → auth.users.id
weekly_content_plans.business_id → businesses.id
```

**4. Location Intelligence Flow:**
```
business_locations.business_id 
  → business_location_intelligence.business_id
  → denormalized into business_brand_profile.location_intelligence
```

**5. Brand Profile Generation:**
```
brand_profile_sources_state (tracks content hashes by business_id)
  → triggers regeneration when version_hash changes
  → updates business_brand_profile.business_id
```

---

## SUMMARY STATISTICS

| Metric | Count | Details |
|--------|-------|---------|
| **Total Tables** | **26** | All production tables in public schema |
| **Total Columns** | **~450+** | Across all tables |
| **Tables Linked to `businesses.id`** | 18 | Via business_id foreign key |
| **One-to-one with businesses** | 6 | Using business_id as PK/FK |
| **One-to-many with businesses** | 12 | Using business_id as FK only |
| **Standalone reference tables** | 6 | No business linkage |
| **User profile tables** | 1 | profiles |
| **Chained relationships** | 3 | Parent-child ID chains |
| **Tables with ALTER TABLE modifications** | 12 | Column additions/removals |
| **Total ADD COLUMN operations** | 26 | Across migrations |
| **Total DROP COLUMN operations** | 17 | Cleanup in April 2026 |
| **Tables with RLS enabled** | 10+ | Row-level security |
| **Primary Key Types** | | |
| └─ UUID | 24 | gen_random_uuid() or uuid_generate_v4() |
| └─ TEXT | 1 | content_types |
| └─ SERIAL | 1 | daily_suggestions |

### MAJOR SCHEMA CHANGES (Latest Migrations)

**Tables with Significant Additions:**
- `daily_suggestions`: +12 columns (content generation workflow)
- `weekly_strategies`: +4 columns (metadata tracking)
- `photo_atmosphere_log`: NEW table (silent brand enrichment, May 2026)
- `business_operations`: +1 column (preferred_posts_per_week for user control)
- `website_analyses`: +6 columns (crawl data persistence)

**Tables with Column Removals (April 2026 Cleanup):**
- `business_concept_fit`: -6 columns
- `business_brand_profile`: -3 columns
- `business_profile`: -3 columns
- `menu_items_normalized`: -3 columns
- `business_operations`: -4 columns

**Removed from Production:**
- `brand_profile_generation_locks`: Deleted May 5, 2026 (empty table)

---

**END OF DATABASE MAPPING**  
**Last Updated:** 5. maj 2026  
**Verification Method:** Extracted from Supabase migration files  
**Accuracy:** ✅ Verified against source of truth (migration SQL files)
