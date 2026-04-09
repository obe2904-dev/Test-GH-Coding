# AI Features – Models & Data Flow

> Reference document mapping which AI models and Setup data are used in each AI feature.

---

## 1. AI Models per Tier

| Feature | Free | Smart (`standardplus`) | Pro (`premium`) |
|---|---|---|---|
| **Hurtigt opslag – AI Ideer** | `gpt-4o-mini` | `gpt-4o` | `gpt-4o` |
| **AI Ugentlig Plan** | `gpt-4o-mini` | `gpt-4o-mini` | `gpt-4o-mini` |

**Notes:**
- Hurtigt opslag model selection is defined in two places: `src/config/ai-models.ts` (frontend) and `supabase/functions/ai-generate-v2/generators/smart-generator.ts` (line 21, edge function).
- AI Ugentlig Plan does **not** differentiate by tier — always uses `gpt-4o-mini` regardless of subscription level (`weekly-strategy-generator.ts` lines 509 + 516).
- Free tier is additionally limited to max 3 ideas in `ai-generate-v2/index.ts` (line 77).

---

## 2. Setup Data Used in Each Feature

### Tab → Table mapping

| Setup Tab | Table(s) |
|---|---|
| Profile | `businesses`, `business_profile`, `business_locations` (contact/address), `opening_hours`, `business_operations` |
| Menu | `menu_results_v2` |
| Location | `business_locations`, `business_location_intelligence` |
| Brand Profile | `business_brand_profile` |

---

### Profile tab — full field mapping

The Profile tab saves data across **five tables**. Here is every field, where it goes, and what the AI features do with it.

| UI Field | Saved to | Hurtigt opslag | AI Ugentlig Plan |
|---|---|---|---|
| **Business name** | `businesses.name` | ✅ Used (business identity in prompt) | ✅ Used (business identity) |
| **Business type / category** | `businesses.vertical` | ✅ Used (vertical label in prompt) | ✅ Used (business type code) |
| **Website URL** | `businesses.website_url` | ✅ Used (included in profile data) | ✅ Used (passed in business object) |
| **About text** | `business_profile.long_description` | ✅ Used (profile description in prompt) | ✅ Used (general business context) |
| **Phone** | `business_locations.phone` | ❌ Not fetched | ❌ Not fetched |
| **Email** | `business_locations.email` | ❌ Not fetched | ❌ Not fetched |
| **Address** | `business_locations.address_line1` | ❌ Not fetched | ❌ Not fetched |
| **Postal code** | `business_locations.postal_code` | ❌ Not fetched | ❌ Not fetched |
| **City** | `business_locations.city` | ✅ Used (location context) | ✅ Used (location/city context) |
| **Country** | `business_locations.country` | ✅ Used (language/locale context) | ✅ Used |
| **Booking link** | `business_brand_profile.booking_link` | ✅ Used — mandatory: must appear in ≥1 idea | ⚠️ Fetched but not directly injected into AI prompt |
| **Logo** | `businesses.logo_url` | ❌ Not used | ❌ Not used |
| **Opening hours** | `opening_hours` table | ❌ Not used | ✅ Used — passed as context; helps determine what days/slots to schedule posts |
| **Table service** (`has_table_service`) | `business_operations` | ❌ Not used | ⚠️ Passed in `businessOps` but not individually referenced in prompt |
| **Takeaway** (`has_takeaway`) | `business_operations` | ❌ Not used | ⚠️ Passed in `businessOps` but not individually referenced in prompt |
| **Delivery** (`has_delivery`) | `business_operations` | ❌ Not used | ⚠️ Passed in `businessOps` |
| **Outdoor seating** (`has_outdoor_seating`) | `business_operations` | ❌ Not used | ✅ Used — actively drives weather-related strategy angles and special outdoor seating rules in the prompt |
| **WiFi** (`has_wifi`) | `business_operations` | ❌ Not used | ⚠️ Passed in `businessOps` but not individually used |
| **Parking** (`has_parking`) | `business_operations` | ❌ Not used | ⚠️ Passed in `businessOps` but not individually used |
| **Reservation required** (`reservation_required`) | `business_operations` | ❌ Not used | ⚠️ Passed in `businessOps` |
| **Kids menu** (`has_kids_menu`) | `business_operations` | ❌ Not used | ⚠️ Passed in `businessOps` |

**Legend:** ✅ Actively used in AI output · ⚠️ Fetched/passed but not explicitly referenced in the AI prompt · ❌ Not fetched at all

---

### Key gaps identified

| Field | Status | Note |
|---|---|---|
| Phone / Email / Address / Postal code | ❌ Never read by AI | Saved to DB but no edge function fetches them |
| Logo | ❌ Never read by AI | Stored but ignored |
| `has_table_service`, `has_wifi`, `has_parking`, etc. | ⚠️ Passed but dormant | `businessOps` object flows through but only `has_outdoor_seating` has explicit prompt logic |
| `business_profile.short_description` | ⚠️ Schema exists, but UI saves to `long_description` only | `short_description` column exists but the Profile page only writes `long_description` |

---

### Hurtigt opslag – AI Ideer (full)

| Data | Fields Used |
|---|---|
| **Profile** | `businesses.name`, `businesses.vertical`, `businesses.website_url` · `business_profile.long_description` · `business_locations.city`, `business_locations.country` |
| **Menu** | Menu items (names, categories) — for content ideas and post-generation validation |
| **Location** | `business_locations.city`, `business_locations.country` |
| **Brand Profile** | `business_brand_profile`: `tone_keywords`, `voice_style`, `business_voice` → `TONE ANCHORS` (mandatory), `HARD_CONSTRAINTS_JSON` (banned words), `booking_link` (`BOOKING_URL`) |

**Source files:**
- `supabase/functions/ai-generate/index.ts` — legacy path
- `supabase/functions/ai-generate-v2/generators/smart-generator.ts` + `prompt-builder.ts` — current path
- `supabase/functions/ai-generate-v2/data-sources/business-profile.ts` — data fetching

---

### AI Ugentlig Plan (full)

| Data | Fields Used |
|---|---|
| **Profile** | `businesses` (name, vertical, city) · `business_profile.long_description` · `opening_hours` (schedule context) · `business_operations.has_outdoor_seating` (drives weather strategy) |
| **Menu** | `menu_results_v2`: `service_periods` (brunch/lunch/dinner), `is_signature` flags — weekly post slots + signature item rotation · `ai_summary` (Phase 0: per-menu helicopter summary used to route strategy to the right menu) |
| **Location** | `business_location_intelligence`: `location_type` (waterfront/city_center/historic/residential/suburban), `location_amplifiers`, `area_type` |
| **Brand Profile** | `business_brand_profile`: `tone_keywords`, `voice_style`, `tone_of_voice`, `content_pillars`, `signature_phrases`, `humor_level`, `emoji_frequency` |

**Source files:**
- `supabase/functions/generate-weekly-plan/index.ts` — entry point + data fetching
- `supabase/functions/_shared/post-helpers/weekly-strategy-generator.ts` — Phase 0 (strategy) + Phase 2b (captions)
- `supabase/functions/_shared/post-helpers/weekly-plan-generator.ts` — assembly + location/brand voice applied

---

## 3. Key Observations

1. **Tier gap in AI Ugentlig Plan:** Smart and Pro subscribers get the same `gpt-4o-mini` model as Free. Upgrading to `gpt-4o` for paid tiers in `weekly-strategy-generator.ts` would be consistent with the Hurtigt opslag approach.

2. **Brand Profile is the richest input for AI Ugentlig Plan:** `tone_keywords`, `content_pillars`, `signature_phrases`, and `humor_level` all feed directly into strategy and caption generation.

3. **Location Intelligence has outsized impact:** `location_type` (e.g., `waterfront`) and `location_amplifiers` are used to shape both strategy angles and captions — businesses without Location Intelligence data receive generic output.

4. **Menu service periods drive weekly structure:** The weekly plan uses `service_periods` to decide which day/meal slot gets which content type (brunch post vs. dinner post), making accurate menu data critical.
