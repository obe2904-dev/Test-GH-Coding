# Setup Data Sources for Layer 0 Strategy Generation

This document outlines **all** data sources available under **Setup** that feed into the Layer 0 weekly strategy generator.

## Quick Reference

### Critical Fields for Strategy Quality:
1. **Brand Profile V5** → Tone, signature phrases, brand essence, humor level
2. **Menu Items** → 5+ signature dishes marked
3. **Location** → City, coordinates, location_type (waterfront/city_center/etc.)
4. **Booking URL** → For Facebook booking CTAs
5. **Outdoor Seating** → Enables/prevents weather-dependent outdoor posts

### Setup Categories:
- **Brand Voice (V5):** 14 fields including tone, signature phrases, humor level
- **Business Profile:** Descriptions, target audience, pricing, booking URL
- **Business Info:** Name, category, tier, language, logo
- **Location & Contact:** Address, city, phone, email, maps
- **Operations:** Service type, periods, amenities (8 amenity flags)
- **Menu:** Dishes, service periods, signature marking
- **Opening Hours:** Days/times, valid scheduling days
- **Platforms:** Facebook/Instagram selection

---

## 1. Brand Profile (V5 Schema)

**Database Table:** `business_brand_profile`

**Purpose:** Defines your business's unique voice, positioning, and communication style.

### Available Fields:

#### Core Brand Identity
- **`brand_essence`** (string)
  - Your business's core identity/personality
  - Mapped to `voice_style` in strategy context
  - Example: "Kvalitetsbevidst hygge ved åen"

- **`core_offerings`** (string)
  - Key products/services you offer
  - Used for competitive positioning
  - Example: "Fra brunch til 3-retters menu"

#### Tone of Voice (JSON)
- **`tone_of_voice`** (object)
  ```json
  {
    "primary_tone": "Varm, indbydende og kvalitetsbevidst",
    "attributes": ["Hyggelig", "Ærlig", "Serviceorienteret", "Autentisk", "By-nær"],
    "formality_level": "casual"
  }
  ```
  - **Primary Tone:** Main voice characteristic
  - **Attributes:** 5 keywords describing your tone
  - **Formality Level:** casual, semi-formal, or formal

#### Content Strategy (JSON)
- **`content_focus`** (array/object)
  - Content themes/pillars to emphasize
  - Mapped to `content_pillars` in strategy context
  - Example: ["café-kultur", "aftenliv", "sociale sammenkomster", "kvalitetsmad"]

- **`things_to_avoid`** (array/object)
  - Words, phrases, or topics to never use
  - Mapped to `do_not_say` in strategy context
  - Example: {"words": ["billig", "fastfood"], "themes": ["hastværk"]}

#### Target Audience (JSON)
- **`target_audience`** (object)
  ```json
  {
    "primary": "40+ lokale der værdsætter kvalitet",
    "characteristics": ["kvalitetsbevidste", "hyggeelskende", "lokale"]
  }
  ```

#### Competitive Positioning (JSON)
- **`communication_goal`** (object)
  - How you differentiate from competitors
  - Key advantages and unique selling points

#### V5 Enrichment Fields
- **`signature_phrases`** (array)
  - Specific phrases unique to your brand
  - Example: ["ved åen i Aarhus", "fra brunch til 3-retters", "lækkert mad"]
  - **USED IN STRATEGIC REASONING:** AI incorporates these into angles

- **`never_say`** (array)
  - Specific words/phrases to avoid
  - Example: ["billig", "hurtig", "fastfood"]

- **`typical_openings`** (array)
  - Common ways you start posts
  - Example: ["God morgen fra åen", "Velkommen til en ny uge hos Faust"]

- **`typical_closings`** (array)
  - Common ways you end posts
  - Example: ["Vi ses 💙", "Kom forbi"]

- **`humor_level`** (string: "none", "subtle", "moderate", "playful")
  - How much humor to use
  - Example: "subtle"
  - **USED IN STRATEGIC REASONING:** Influences tone in content direction

- **`sample_posts`** (JSON array)
  - Example posts that demonstrate your style
  - Used for learning your communication patterns

---

## 2. Menu Data

**Database Table:** `menu_results_v2`

**Purpose:** Lists all dishes/items available for content creation.

### Available Fields:

- **`structured_data`** (JSON)
  - Menu items organized by category
  - Names, descriptions, prices
  
- **`service_periods`** (array)
  - When items are available: `["brunch", "lunch", "dinner"]`
  - Used to suggest time-appropriate posts

- **`is_signature`** (boolean)
  - Marks items as signature/popular dishes
  - High-priority for weekly strategies

### How Menu Data is Used:

**Phase 1 (Strategic Brief):**
- Menu analyzed into **capabilities categories**:
  ```
  - Signatur-retter: 10 items — Højt genkendelighed, proven performance
  - Varme retter: 6 items — Passer til koldt vejr, comfort-content
  ```
- NO specific items mentioned in Phase 1 (only categories)

**Phase 2 (Content Plan):**
- Specific menu items matched to strategic angles
- Posts suggest actual dishes: "PARISERBØF", "FAUST GRYDE", etc.
- **Menu Validation:** AI must ONLY use items from your menu (no invention)

### Current Extraction for Café Faust:
```
Total menu items: 62
Signature items: 51 marked items
Examples: PARISERBØF, ÆGGEKAGE, BØF & BEARNAISE, FAUST GRYDE, 
         KLASSISK CAESAR, VARMRØGET LAKS, CLUB SANDWICH ALA FAUST
```

---

## 3. Business Information

**Database Table:** `businesses`

**Purpose:** Core business data and operational settings.

### Available Fields:

#### Basic Info
- **`name`** (string)
  - Business name: "Café Faust"
  
- **`category`** (string)
  - Business type: "cafe", "restaurant", "bar", "frisør", etc.
  - Maps to business type framework for strategic guidance

- **`vertical`** (string)
  - Industry vertical (e.g., "hospitality", "food_service")

- **`subscription_tier`** (string)
  - "free", "smart", "pro"
  - Determines preferred post count: 3, 5, or 7 posts/week

- **`website_url`** (string)
  - Primary website URL
  - Used as fallback for booking URLs

- **`logo_url`** (string)
  - URL to business logo image

- **`primary_language`** (string)
  - Default: "da" (Danish)
  - Used for content generation language

- **`subpage_urls`** (JSON array)
  - Links to specific pages (menu, about, events)
  - Example: `[{"type": "menu", "url": "..."}, {"type": "about", "url": "..."}]`

### Business Profile (from `business_profile`)

**Purpose:** Detailed descriptions and positioning.

- **`short_description`** (text)
  - Brief 1-2 sentence business description
  - Used in AI prompts for context

- **`long_description`** (text)
  - Detailed business description (2-3 paragraphs)
  - Full story, history, values

- **`menu_description`** (text)
  - Quick overview of menu/offerings
  - Example: "Dansk café-mad fra morgenbord til aftenmenu"
  - Used in strategic context

- **`target_audience`** (text)
  - Who your customers are
  - Example: "40+ lokale der værdsætter kvalitet"

- **`price_level`** (string: "low", "medium", "high")
  - Price positioning
  - Used for economic timing strategy

- **`founded_year`** (integer)
  - When business was established
  - Can be used in heritage marketing

- **`booking_url`** (text)
  - Reservation/booking link
  - **CRITICAL:** Added to Facebook posts with booking intent
  - Example: "https://bordbestilling.dk/cafe-faust"

- **`detected_menu_urls`** (array of strings)
  - Menu URLs/PDFs found during website analysis
  - User confirms before menu extraction

- **`about_us_url`** (text)
  - Link to About Us page

- **`opening_hours_url`** (text)
  - Link to opening hours page

### Location Data (from `business_locations`)

**Purpose:** Physical location and contact info.

- **`address_line1`** (string): Street address
- **`address_line2`** (string): Additional address info
- **`postal_code`** (string): Zip/postal code
- **`city`** (string): "Aarhus"
- **`country`** (string): "DK" (Denmark)
- **`is_primary`** (boolean): If multiple locations, which is main

#### Contact Information
- **`phone`** (string)
  - Business phone number
  - Can be used in posts for direct contact

- **`email`** (string)
  - Business email address

- **`maps_url`** (string)
  - Google Maps or other map link
  - Used in "find us" CTAs

#### Derived Location Intelligence
- **`latitude`** / **`longitude`** (numbers)
  - Coordinates for weather API calls
  - Example: `56.1556007, 10.2096834`

- **`location_type`** (derived from business_location_intelligence)
  - "waterfront", "city_center", "residential", "tourist_area", etc.
  - **Café Faust = "waterfront"** (ved åen)
  - **USED IN STRATEGIC REASONING:** Unique competitive advantage

### Operations Data (from `business_operations`)

**Purpose:** Service details and amenities.

#### Service Settings
- **`establishment_type`** (string: "FSE", "SBO", "MFV", "MFD", "QSR")
  - FSE: Full-Service Establishment (fine dining)
  - SBO: Service-Based Operation (cafes, small restaurants)
  - MFV: Mobile Food Vendor (food trucks)
  - MFD: Multi-location/Multi-per-Day (chains)
  - QSR: Quick Service Restaurant (fast food)

- **`primary_service_period`** (string)
  - Options: "breakfast", "brunch", "lunch", "dinner", "all_day", "evening_only"
  - Determines optimal posting times

- **`service_periods`** (JSON array)
  - All periods offered: `["breakfast", "lunch", "dinner"]`
  - Used to match posts to service times

- **`has_table_service`** (boolean)
  - Sit-down dining vs counter service
  - Default: true

- **`has_takeaway`** (boolean)
  - Offers takeaway/to-go orders
  - Enables takeaway-focused content

- **`has_delivery`** (boolean)
  - Delivery service available
  - Can mention delivery in posts

- **`reservation_required`** (boolean)
  - Booking necessary vs walk-ins
  - Affects CTA urgency

- **`accepts_walk_ins`** (boolean)
  - Walk-in customers welcome
  - Default: true

#### Capacity & Pricing
- **`seating_capacity_indoor`** (integer)
  - Number of indoor seats
  - Can mention capacity in posts

- **`seating_capacity_outdoor`** (integer)
  - Number of outdoor seats

- **`price_level`** (string: "budget", "moderate", "upscale", "fine_dining")
  - Price tier classification
  - Used for targeting strategy

- **`average_check_per_person`** (integer)
  - Typical spend per customer
  - Used for economic alignment

- **`currency`** (string)
  - Default: "DKK"

#### Amenities
- **`has_outdoor_seating`** (boolean)
  - Whether business has outdoor area
  - **CRITICAL:** Prevents AI from mentioning outdoor when false
  - Weather-dependent posts only suggested if `true`

- **`has_kids_menu`** (boolean)
  - Kids/children menu available
  - Enables family-focused content

- **`has_wifi`** (boolean)
  - WiFi available for customers
  - Can attract work-from-café crowd

- **`has_power_outlets`** (boolean)
  - Power outlets available
  - Appeals to remote workers

- **`has_parking`** (boolean)
  - Parking available
  - Important for suburban locations

#### Timing Data
- **`typical_busy_periods`** (JSON array)
  - Busy times/days
  - Example: `[{"day": "saturday", "period": "evening"}]`

- **`typical_slow_periods`** (JSON array)
  - Quiet times
  - Used to boost slow periods

- **`posting_time_windows`** (JSON array)
  - Optimal posting times based on service
  - Example: `[{"period": "lunch", "post_at": "10:30"}]`

- **`preferred_posts_per_week`** (integer)
  - User's desired posting frequency
  - Overrides subscription tier default if set
  - Example: 5 posts/week

### CTA Configuration (from `business_profile.cta_config`)

**Purpose:** Customize call-to-action preferences.

**Note:** This is an optional advanced feature that may not be in all deployments.

- **`cta_config`** (JSON object)
  ```json
  {
    "default_style": "soft" | "booking",
    "custom_ctas": {
      "book": "Book dit bord nu",
      "visit": "Kom forbi i dag",
      "menu": "Se vores menu",
      "engage": "Del med os"
    },
    "use_emojis": true | false
  }
  ```
  - Allows businesses to override default CTA text
  - Can set CTA style preference (soft vs direct)
  - Control emoji usage in CTAs

---

## 4. Opening Hours

**Database Table:** `business_opening_hours`

**Purpose:** Determines valid days for post scheduling.

### Available Fields:

- **`weekday`** (string): "monday" through "sunday"
- **`closed`** (boolean): If true, that day is skipped
- **`kind`** (string): "normal", "holiday", "special"

### How It's Used:

- Generates `available_days` array: days you're open
- Posts only scheduled for open days
- **Validation:** AI cannot suggest posts for closed days

**Example for Café Faust:**
```javascript
available_days: [
  "monday", "tuesday", "wednesday", "thursday", 
  "friday", "saturday", "sunday"
]
// Open all 7 days
```

---

## 5. Platform Settings

**Database Table:** `profiles` (user table)

**Purpose:** Which social media platforms are active.

### Available Fields:

- **`selected_platforms`** (array)
  - Options: `["facebook", "instagram"]` or either one
  - **Café Faust:** Both Facebook + Instagram

### How It's Used:

- **Dual-platform:** Content must work on both FB and IG
- **Instagram-only:** Prioritizes Reels, uses "link i bio" for CTAs
- **Facebook-only:** Allows direct links, longer text

---

## 6. Contextual Data (Auto-Generated)

These are NOT in Setup but are automatically fetched for each strategy generation:

### Weather Data
- **Source:** OpenWeatherMap API
- **Fields:** 7-day forecast with temp, conditions, reliability
- **Example:** `cold_week`, avg 2°C

### Seasonal Data
- **Source:** Month-based detection
- **Fields:** Current season, ingredients in season
- **Example:** "winter", ingredients: ["kål", "rod"]

### Economic Timing
- **Source:** Week-of-month calculation
- **Fields:** Week 1-4, pattern (salary_week, budget_conscious, etc.)
- **Example:** Week 3/4, "normal_spend"

### Events Calendar
- **Source:** `contextual_calendar` table
- **Fields:** Upcoming events with strategic angles
- **Example:** "Valentinsdag" → "Romantisk spisning for par"

### Previous Week Performance
- **Source:** `weekly_strategies` and `post_plans` tables
- **Fields:** Top performing post, posted menu items
- **Purpose:** Avoid repetition, learn from success

---

## How Data Flows into Strategy Generation

### Phase 1: Strategic Brief
```
Brand Profile (voice, essence, signature phrases)
    +
Menu Capabilities (categories, counts)
    +
Week Context (weather, events, timing, location)
    ↓
Custom Strategic Angles
(e.g., "Vinterens Hyggelige Anker ved Åen")
```

### Phase 2: Content Plan
```
Strategic Angles (from Phase 1)
    +
Specific Menu Items (from menu_results_v2)
    +
Available Days (from opening_hours)
    ↓
5 Concrete Post Ideas
(e.g., "Faust Gryde: Vinterens varme hjerte")
```

---

## Data Quality Requirements

### ✅ Required for Good Strategy:
1. **Brand Profile V5:** At least `tone_of_voice` and `brand_essence`
   - Without this: Generic strategies that could fit any business
   
2. **Menu Items:** 5+ signature items marked
   - Without this: Limited post variety

3. **Location Data:** City + coordinates
   - Without this: No weather context

4. **Booking URL:** For Facebook posts with booking intent
   - Without this: No clickable booking link in posts

### ⚠️ Optional but Recommended:
- **Signature Phrases:** Makes strategic reasoning business-specific
- **Never Say:** Prevents brand voice violations
- **Humor Level:** Influences tone precision
- **Outdoor Seating:** Enables weather-dependent outdoor posts
- **Amenities:** (WiFi, parking, kids menu) Enables targeted content
- **Contact Info:** (Phone, email) For direct response posts
- **Business Descriptions:** Enriches AI context
- **Service Periods:** Optimizes posting times
- **Establishment Type:** Refines strategic framework

### 🚫 Missing Data Fallbacks:
- No brand profile → Uses generic tone
- No menu → Cannot generate menu_item posts
- No location → Cannot fetch weather
- No opening hours → Assumes 7 days open
- No booking_url → No URL in Facebook booking CTAs
- No outdoor_seating → No weather-dependent outdoor posts
- No amenities → Misses targeting opportunities (e.g., WiFi for remote workers)

---

## Current Status for Café Faust

Based on logs from latest generation (12. februar 2026):

```javascript
✅ Brand Profile V5: FOUND
   - Brand Essence: "Kvalitetsbevidst hygge ved åen"
   - Core Offerings: "Fra brunch til 3-retters menu"
   - Tone: "Varm, indbydende og kvalitetsbevidst"
   - Attributes: ["Hyggelig", "Ærlig", "Serviceorienteret", "Autentisk", "By-nær"]
   - Content Focus: ["café-kultur", "aftenliv", "sociale sammenkomster", "kvalitetsmad"]
   - Signature Phrases: ["ved åen i Aarhus", "fra brunch til 3-retters", "lækkert mad"]
   - Humor Level: "subtle"

✅ Business Info:
   - Name: "Café Faust"
   - Category: "cafe"
   - Vertical: "hospitality"
   - Subscription Tier: "smart" (5 posts/week preferred)

✅ Location: 
   - City: Aarhus, Denmark
   - Location Type: waterfront (ved åen)
   - Coordinates: 56.1556007, 10.2096834
   - Contact: [phone/email if set]
   - Booking URL: [if set]

✅ Operations:
   - Establishment Type: SBO (Service-Based Operation)
   - Primary Service: all_day
   - Service Periods: [breakfast, brunch, lunch, dinner]
   - Has Outdoor Seating: Yes
   - Has Kids Menu: [check]
   - Has WiFi: [check]
   - Has Parking: [check]
   - Accepts Walk-ins: Yes
   - Has Takeaway: [check]

✅ Menu: 51 signature items available
   - Examples: PARISERBØF, ÆGGEKAGE, BØF & BEARNAISE, 
     FAUST GRYDE, KLASSISK CAESAR, VARMRØGET LAKS

✅ Platforms: Facebook + Instagram (both active)

✅ Opening Hours: Open all 7 days
   - Monday-Sunday: [times if set]
```

**Result:** High-quality, business-specific strategic angles like:
- "Vinterens Hyggelige Anker ved Åen" (uses location + brand voice + waterfront)
- "Hverdagens Kvalitetsritualer" (uses signature phrases + tone + all_day service)

**Data Completeness:** ~85%
- ✅ All critical data present (brand profile, menu, location, operations)
- ⚠️ Optional: Fill in amenities (WiFi, parking) for enhanced targeting
- ⚠️ Recommended: Add booking_url for direct Facebook booking CTAs

---

## Editing Setup Data

### Where to Update:

1. **Brand Profile (V5):** Setup → Brand Voice page
   - Edit tone, signature phrases, humor level
   - Add typical openings/closings
   - Define what to never say
   - Changes immediately affect next strategy generation

2. **Business Description:** Setup → Business Profile
   - Short/long descriptions
   - Target audience
   - Price level
   - Booking URL (**CRITICAL for Facebook CTAs**)
   - Menu description
   - Founded year

3. **Menu:** Setup → Menu page
   - Mark items as signature
   - Service periods (breakfast, lunch, dinner)
   - Changes immediately affect post suggestions

4. **Business Info:** Setup → Business Settings
   - Name, category, logo
   - Website URL
   - Primary language
   - Subscription tier

5. **Location & Contact:** Setup → Location page
   - Address, city, country
   - Phone, email
   - Ma
  brand_essence, core_offerings,
  tone_of_voice, content_focus, things_to_avoid,
  signature_phrases, never_say, 
  typical_openings, typical_closings,
  humor_level, sample_posts
FROM business_brand_profile
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Business Profile (descriptions, booking)
SELECT 
  short_description, long_description,
  menu_description, target_audience,
  price_level, founded_year,
  booking_url, detected_menu_urls,
  about_us_url, opening_hours_url
FROM business_profile
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Menu Items
SELECT structured_data, service_periods, is_signature
FROM menu_results_v2
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND status = 'done';

-- Business Info
SELECT 
  name, category, vertical,
  subscription_tier, website_url,
  logo_url, primary_language,
  subpage_urls, selected_platforms
FROM businesses
WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Location & Contact
SELECT 
  city, country, 
  address_line1, address_line2, postal_code,
  phone, email, maps_url,
  is_primary
FROM business_locations
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Location Intelligence (derived data)
SELECT 
  latitude, longitude, neighborhood, area_type,
  category_scores, location_type_matches
FROM business_location_intelligence
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Operations & Amenities
SELECT 
  establishment_type, primary_service_period,
  service_periods, posting_time_windows,
  has_outdoor_seating, has_kids_menu,
  has_wifi, has_power_outlets, has_parking,
  has_table_service, has_takeaway, has_delivery,
  reservation_required, accepts_walk_ins,
  seating_capacity_indoor, seating_capacity_outdoor,
  price_level, average_check_per_person, currency,
  typical_busy_periods, typical_slow_periods
FROM business_operations
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Opening Hours
SELECT weekday, closed, open_time, close_time, kind
FROM 
## Database References

For developers/technical reference:

```sql
-- Brand Profile V5
SELECT brand_essence, tone_of_voice, signature_phrases, humor_level
FROM business_brand_profile
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Menu Items
SELECT structured_data, service_periods, is_signature
FROM menu_results_v2
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND status = 'done';

-- Business Info
SELECT name, category, subscription_tier
FROM businesses
WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Location
SELECT city, country, latitude, longitude, location_type
FROM business_locations
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Opening Hours
SELECT weekday, closed
FROM business_opening_hours
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND kind = 'normal';
```

---

## API Integration Points

**File:** `/supabase/functions/get-weekly-strategy/index.ts`

**Lines 400-830:** Data fetching and WeekContext assembly

### Currently Integrated (Used in Strategy Generation):

**From `businesses` table (lines 404-410):**
- ✅ `name` - Business name
- ✅ `category` - Business type for framework selection
- ✅ `subscription_tier` - Determines post count

**From `business_locations` table (lines 422-428):**
- ✅ `city` - Used in narratives and weather context
- ✅ `country` - Language and cultural context

**From `business_location_intelligence` table (lines 430-436):**
- ✅ `latitude`, `longitude` - Weather API calls
- ✅ `area_type` / derived `location_type` - Strategic positioning

**From `business_operations` table (lines 438-445):**
- ✅ `has_outdoor_seating` - Weather-dependent content
- ✅ `establishment_type` - Business type framework
- ✅ `preferred_posts_per_week` - Post count override

**From `business_brand_profile` table (lines 450-478):**
- ✅ `brand_essence` → voice_style
- ✅ `tone_of_voice` → tone keywords and attributes
- ✅ `content_focus` → content_pillars
- ✅ `things_to_avoid` → do_not_say
- ✅ `signature_phrases` - Used in strategic reasoning
- ✅ `never_say` - Used in strategic reasoning
- ✅ `humor_level` - Influences content direction
- ✅ `typical_openings`, `typical_closings` - Fetched but not yet used in prompts

**From `menu_results_v2` table (lines 480-520):**
- ✅ `structured_data` - Menu items for posts
- ✅ `is_signature` - Priority items
- ⚠️ `service_periods` - Fetched but not deeply integrated

**From `profiles` table (lines 522-528):**
- ✅ `selected_platforms` - Facebook/Instagram targeting

**From `opening_hours` table (lines 550-560):**
- ✅ `weekday`, `closed` - Valid posting days

### Available But NOT Yet Integrated:

**Contact & Booking (could enhance CTAs):**
- ⏳ `phone` (business_locations) - Could add "Ring til os" CTAs
- ⏳ `email` (business_locations) - Could add email CTAs
- ⏳ `booking_url` (business_profile) - Available but needs Layer 0 integration
- ⏳ `maps_url` (business_locations) - Could add "Find vej" CTAs

**Descriptions (could enrich context):**
- ⏳ `short_description` (business_profile) - Quick context
- ⏳ `long_description` (business_profile) - Full story
- ⏳ `menu_description` (business_profile) - Menu overview

**Amenities (could enable targeted content):**
- ⏳ `has_kids_menu` - Family-focused posts
- ⏳ `has_wifi` - "Work from here" posts
- ⏳ `has_power_outlets` - Remote worker targeting
- ⏳ `has_parking` - Convenience messaging
- ⏳ `has_takeaway` - Takeaway-specific posts
- ⏳ `has_delivery` - Delivery promotions

**Service Details (could optimize timing):**
- ⏳ `primary_service_period` - Posting time optimization
- ⏳ `posting_time_windows` - Automated scheduling
- ⏳ `typical_busy_periods` - Strategic timing
- ⏳ `typical_slow_periods` - Boost slow times

**Pricing & Capacity (could refine targeting):**
- ⏳ `price_level` (business_profile/operations)
- ⏳ `target_audience` (business_profile)
- ⏳ `average_check_per_person` - Economic alignment
- ⏳ `seating_capacity_indoor/outdoor` - Capacity messaging

**Branding (could enhance visuals):**
- ⏳ `logo_url` - Could be used in graphics
- ⏳ `founded_year` - Heritage messaging

### Integration Priority Recommendations:

**High Priority (Quick Wins):**
1. `booking_url` - Add to Facebook booking CTAs (clear user request)
2. `has_kids_menu`, `has_wifi`, `has_parking` - Enable amenity-based strategic angles
3. `short_description` - Enrich AI context with business summary
4. `target_audience` - Refine strategic positioning

**Medium Priority (Enhanced Strategy):**
5. `primary_service_period` - Optimize post timing suggestions
6. `has_takeaway`, `has_delivery` - Enable service-specific content angles
7. `typical_busy_periods/slow_periods` - Strategic timing recommendations
8. `phone`, `email` - Add contact CTAs

**Low Priority (Nice to Have):**
9. `posting_time_windows` - Automated scheduling (needs Layer 6+ integration)
10. `price_level`, `average_check_per_person` - Economic targeting refinement
11. `founded_year` - Heritage storytelling opportunities
12. `logo_url` - Visual integration (needs media generation update)

---

**Last Updated:** 12. februar 2026
**For:** Café Faust (business_id: 840347de-9ba7-4275-8aa3-4553417fc2af)
