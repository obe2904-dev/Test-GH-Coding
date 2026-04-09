# Sidebar Sub-Pages Field Documentation

**Last Updated:** January 14, 2026  
**Document Purpose:** Complete field reference for all sidebar sub-pages

---

## 1. Virksomhedsprofil (Business Profile)

**Route:** `/dashboard/profile`  
**Access:** All Tiers (with feature gating)  
**Page Component:** `BusinessProfilePage.tsx`

### Basic Business Information

| Field | Type | Access | Description |
|-------|------|--------|-------------|
| **businessName** | Text | All Tiers | Business name / restaurant name |
| **businessSector** | Select | All Tiers | Business vertical (restaurant, cafe, bar, retail, etc.) |
| **businessCategory** | Text | All Tiers | Specific category/subcategory |
| **phone** | Text | All Tiers | Contact phone number |
| **email** | Email | All Tiers | Contact email address |
| **address** | Text | All Tiers | Street address |
| **postalCode** | Text | All Tiers | Postal/ZIP code (auto-lookup for Denmark) |
| **city** | Text | All Tiers | City name (auto-populated from postal code) |
| **country** | Text | All Tiers | Country (default: Danmark) |

### Online Presence (Smart/Pro Only)

| Field | Type | Access | Description |
|-------|------|--------|-------------|
| **websiteUrl** | URL | Smart/Pro | Business website URL |
| **bookingLink** | URL | Smart/Pro | Online booking/reservation link |
| **aboutUsUrl** | URL | Smart/Pro | About Us page URL (detected from website) |
| **openingHoursUrl** | URL | Smart/Pro | Opening hours page URL (detected) |
| **detectedMenuUrls** | Array[URL] | Smart/Pro | Auto-detected menu page URLs from website |
| **hasBookingButton** | Boolean | Smart/Pro | Whether website has booking functionality |

### Business Description (Smart/Pro Only)

| Field | Type | Access | Description |
|-------|------|--------|-------------|
| **aboutText** | Textarea | Smart/Pro | Business description / about text |
| **brandVoice** | Textarea | Smart/Pro | Brand voice description |
| **targetAudience** | Textarea | Smart/Pro | Target audience description |
| **menuDescription** | Textarea | Smart/Pro | Menu overview description |
| **ctaPreference** | Text | Smart/Pro | Preferred call-to-action style |

### Opening Hours (Smart/Pro Only)

| Field | Type | Access | Description |
|-------|------|--------|-------------|
| **openingHours** | WeekSchedule | Smart/Pro | Weekly opening hours schedule |
| - monday | DaySchedule | Smart/Pro | Monday hours (opens, closes, is_closed) |
| - tuesday | DaySchedule | Smart/Pro | Tuesday hours |
| - wednesday | DaySchedule | Smart/Pro | Wednesday hours |
| - thursday | DaySchedule | Smart/Pro | Thursday hours |
| - friday | DaySchedule | Smart/Pro | Friday hours |
| - saturday | DaySchedule | Smart/Pro | Saturday hours |
| - sunday | DaySchedule | Smart/Pro | Sunday hours |

### Keywords & Offerings (Smart/Pro Only)

| Field | Type | Access | Description |
|-------|------|--------|-------------|
| **keywords** | Array[String] | Smart/Pro | Business keywords/tags for AI context |
| **businessOfferings** | JSON | Smart/Pro | Structured menu/offerings by category |
| - categories | Array[Category] | Smart/Pro | List of offering categories |
| - category.name | String | Smart/Pro | Category name (e.g., "Breakfast", "Drinks") |
| - category.items | Array[Item] | Smart/Pro | Items within category |
| - item.name | String | Smart/Pro | Item name |
| - item.description | String | Smart/Pro | Item description |
| - item.price | Number | Smart/Pro | Item price |

### Features

- **Website Analysis:** AI-powered analysis button to extract business info from website
- **Postal Code Lookup:** Auto-populate city from Danish postal codes
- **Unsaved Changes Warning:** Prompts user before leaving with unsaved changes
- **Auto-save Indicator:** Shows save status and timestamp

---

## 2. Drift (Operations Page)

**Route:** `/dashboard/operations`  
**Access:** Pro Only (Smart can view read-only)  
**Page Component:** `OperationsPage.tsx`

### Opening Hours & Service Periods

| Field | Type | Access | Description |
|-------|------|--------|-------------|
| **opening_hours** | JSON | Pro | Detailed weekly opening hours |
| **service_periods** | JSON | Pro | Breakfast/lunch/dinner service times |
| **typical_busy_periods** | Array[String] | Pro | Times when business is typically busy |
| **typical_slow_periods** | Array[String] | Pro | Times when business is typically slow |

### Seating Capacity

| Field | Type | Access | Description |
|-------|------|--------|-------------|
| **seating_capacity_indoor** | Number | Pro | Number of indoor seats |
| **seating_capacity_outdoor** | Number | Pro | Number of outdoor seats (optional) |

### Pricing Information

| Field | Type | Access | Description |
|-------|------|--------|-------------|
| **price_level** | Select | Pro | Price range (budget/moderate/upscale/luxury) |
| **average_check_per_person** | Number | Pro | Average spending per person |
| **currency** | Text | Pro | Currency code (default: DKK) |

### Service Model

| Field | Type | Access | Description |
|-------|------|--------|-------------|
| **has_table_service** | Boolean | Pro | Offers table service |
| **has_takeaway** | Boolean | Pro | Offers takeaway/to-go |
| **has_delivery** | Boolean | Pro | Offers delivery service |
| **reservation_required** | Boolean | Pro | Whether reservations are required |

### Capacity Patterns

| Field | Type | Access | Description |
|-------|------|--------|-------------|
| **capacity_patterns** | Array[Pattern] | Pro | Detailed capacity patterns by time/day |
| - day_of_week | String | Pro | Day of week |
| - time_slot | String | Pro | Time period |
| - typical_capacity_pct | Number | Pro | Typical capacity percentage |
| - notes | String | Pro | Additional notes |

### Features

- **Auto-Save:** Automatically saves changes after edits
- **Last Saved Indicator:** Shows timestamp of last save
- **Read-Only Mode:** Smart tier can view but not edit (shows upgrade prompt)

---

## 3. Mål (Goals Page)

**Route:** `/dashboard/goals`  
**Access:** Smart (max 3 goals) / Pro (unlimited)  
**Page Component:** `GoalsPage.tsx`

### Goal Overview

| Field | Type | Access | Description |
|-------|------|--------|-------------|
| **id** | UUID | Smart/Pro | Unique goal identifier |
| **business_id** | UUID | Smart/Pro | Associated business ID |
| **description** | Text | Smart/Pro | Goal description/title |
| **goal_type** | Select | Smart/Pro | Goal type (revenue/followers/engagement/capacity) |
| **priority** | Select | Smart/Pro | Priority level (critical/high/medium/low) |
| **status** | Select | Smart/Pro | Goal status (not_started/in_progress/achieved/paused) |
| **progress_pct** | Number | Smart/Pro | Progress percentage (0-100) |
| **created_at** | Timestamp | Smart/Pro | Goal creation date |
| **updated_at** | Timestamp | Smart/Pro | Last update date |

### Target Metrics

| Field | Type | Access | Description |
|-------|------|--------|-------------|
| **target_metric** | JSON | Smart/Pro | Target metric object |
| - metric | String | Smart/Pro | Metric name (e.g., "customers", "DKK", "followers") |
| - current_value | Number | Smart/Pro | Starting/current value |
| - target_value | Number | Smart/Pro | Target value to achieve |
| - target_date | Date | Smart/Pro | Target deadline (optional) |

### Time Constraints

| Field | Type | Access | Description |
|-------|------|--------|-------------|
| **time_constraints** | JSON | Smart/Pro | Time-based constraints object |
| - target_days | Array[String] | Smart/Pro | Target days of week (e.g., ["monday", "wednesday"]) |
| - target_periods | Array[String] | Smart/Pro | Target periods (e.g., ["breakfast", "lunch", "dinner"]) |
| - seasonal | Boolean | Smart/Pro | Whether goal is seasonal |
| - season | String | Smart/Pro | Season if seasonal (summer/winter/etc.) |

### Features

- **Create Goal:** Form to create new business goals
- **Edit Progress:** Update progress percentage and status
- **Delete Goal:** Remove goals
- **Priority Color Coding:** Visual indicators for critical/high/medium/low priority
- **Progress Bars:** Visual progress tracking (0-100%)
- **Empty State:** Helpful onboarding when no goals exist
- **Tier Limits:** Smart tier max 3 goals, Pro unlimited

---

## 4. Menukort (Menu Page)

**Route:** `/dashboard/menu`  
**Access:** Smart & Pro Only  
**Page Component:** `MenuPage.tsx`

### Menu Description

| Field | Type | Access | Description |
|-------|------|--------|-------------|
| **menuDescription** | Textarea | Smart/Pro | Text description of menu offerings |

### Detected Menu URLs

| Field | Type | Access | Description |
|-------|------|--------|-------------|
| **detectedMenuUrls** | Array[URL] | Smart/Pro | Auto-detected menu page URLs from website analysis |

### Menu Structure (Business Offerings)

| Field | Type | Access | Description |
|-------|------|--------|-------------|
| **businessOfferings** | JSON | Smart/Pro | Structured menu data |
| **categories** | Array[Category] | Smart/Pro | List of menu categories |

### Category Object

| Field | Type | Access | Description |
|-------|------|--------|-------------|
| **name** | String | Smart/Pro | Category name (e.g., "Breakfast", "Appetizers", "Main Courses") |
| **items** | Array[Item] | Smart/Pro | Items within this category |
| **description** | String | Smart/Pro | Category description (optional) |

### Menu Item Object

| Field | Type | Access | Description |
|-------|------|--------|-------------|
| **name** | String | Smart/Pro | Item name |
| **description** | String | Smart/Pro | Item description |
| **price** | Number | Smart/Pro | Item price |
| **currency** | String | Smart/Pro | Currency (default: DKK) |
| **allergens** | Array[String] | Smart/Pro | Allergen information (optional) |
| **dietary_tags** | Array[String] | Smart/Pro | Dietary tags (vegan/vegetarian/gluten-free, etc.) |
| **available_periods** | Array[String] | Smart/Pro | When item is available (breakfast/lunch/dinner) |

### Features

- **Save Menu:** Save menu structure to database
- **Default Offerings:** Pre-populated categories based on business sector
- **URL Detection:** Auto-detect menu URLs from website
- **Menu Analysis:** AI-powered menu extraction from URLs (future)

---

## 5. Brand Profil (Brand Profile Page)

**Route:** `/dashboard/brand`  
**Access:** Smart (view/generate), Pro (edit)  
**Page Component:** `BrandProfilePage.tsx`

### Voice Style

| Field | Type | Access | Description |
|-------|------|--------|-------------|
| **voice_style** | Textarea | Smart/Pro | Brand voice description (friendly/professional/casual/sophisticated) |

### Target Audience

| Field | Type | Access | Description |
|-------|------|--------|-------------|
| **targetAudience** | Textarea | Smart/Pro | Target audience demographics and psychographics |

### CTA Preference

| Field | Type | Access | Description |
|-------|------|--------|-------------|
| **ctaPreference** | Text | Smart/Pro | Preferred call-to-action style and phrases |

### Social Style

| Field | Type | Access | Description |
|-------|------|--------|-------------|
| **social_style** | JSON | Smart/Pro | Social media style preferences |
| - emoji_usage | Select | Smart/Pro | Emoji usage level (none/minimal/moderate/expressive) |
| - emoji_examples | Array[String] | Smart/Pro | Example emojis to use |
| - hashtag_strategy | JSON | Smart/Pro | Hashtag strategy object |

### Hashtag Strategy Object

| Field | Type | Access | Description |
|-------|------|--------|-------------|
| **branded** | Array[String] | Smart/Pro | Branded hashtags (e.g., #YourBusinessName) |
| **category** | Array[String] | Smart/Pro | Category hashtags (e.g., #FoodPhotography, #CoffeeLovers) |
| **local** | Array[String] | Smart/Pro | Local hashtags (e.g., #CopenhagenEats, #København) |

### Voice Examples

| Field | Type | Access | Description |
|-------|------|--------|-------------|
| **voice_examples** | JSON | Smart/Pro | Voice examples object |
| - do_say | Array[String] | Smart/Pro | Phrases to use in brand voice |
| - dont_say | Array[String] | Smart/Pro | Phrases to avoid |
| - vocabulary | JSON | Smart/Pro | Vocabulary preferences |

### Vocabulary Object

| Field | Type | Access | Description |
|-------|------|--------|-------------|
| **prefer** | Array[String] | Smart/Pro | Preferred words/phrases |
| **avoid** | Array[String] | Smart/Pro | Words/phrases to avoid |

### AI Brand Context

| Field | Type | Access | Description |
|-------|------|--------|-------------|
| **ai_brand_context** | Text (Large) | Smart/Pro | AI-generated comprehensive brand narrative |
| **ai_brand_context_generated_at** | Timestamp | Smart/Pro | When brand context was generated |
| **ai_brand_context_approved** | Boolean | Smart/Pro | Whether user has approved the generated context |

### Features

- **Generate Brand Context:** AI-powered brand narrative generation from business data
- **Approval Workflow:** User can approve/regenerate brand context
- **Smart Tier:** Can view and generate initial brand profile (read-only after generation)
- **Pro Tier:** Can edit and regenerate brand profile unlimited times
- **Structured Guidelines:** Social style, voice examples, and vocabulary provide clear AI content guidelines

---

## Data Flow & Integration

### How Pages Connect

1. **Business Profile** → Foundation data for all AI features
2. **Operations** → Informs capacity-based post suggestions and timing
3. **Goals** → Drives AI content generation aligned with business objectives
4. **Menu** → Provides product/service context for promotional content
5. **Brand Profile** → Ensures consistent voice across all AI-generated content

### AI Content Generation Pipeline

```
Business Profile + Operations + Goals + Menu + Brand Profile
                        ↓
              AI Content Generator
                        ↓
        Goal-Aligned, Voice-Consistent Posts
                        ↓
              Post Ideas Page
                        ↓
         Approve → Calendar → Publish
```

---

## Database Schema Mapping

### Tables Referenced

| Page | Primary Table | Related Tables |
|------|--------------|----------------|
| **Virksomhedsprofil** | `businesses` | `business_profile`, `opening_hours`, `business_locations` |
| **Drift** | `business_operations` | `businesses` |
| **Mål** | `business_goals` | `businesses` |
| **Menukort** | `business_profile` | `businesses` |
| **Brand Profil** | `business_brand_profile` | `business_profile`, `businesses` |

---

## Validation Rules

### Virksomhedsprofil
- Email must be valid format
- Phone number required for Smart/Pro tiers
- Postal code auto-lookup only works for Denmark
- Website URL must be valid format (http/https)

### Drift (Operations)
- Seating capacity must be positive numbers
- Price level must be one of: budget/moderate/upscale/luxury
- Average check must be positive number
- At least one service model must be selected

### Mål (Goals)
- Description required (min 10 characters)
- Target value must be greater than current value
- Progress percentage: 0-100
- Smart tier: Maximum 3 active goals
- Pro tier: Unlimited goals

### Menukort (Menu)
- Category name required
- Item name required
- Price must be positive number (if specified)

### Brand Profil
- Voice style recommended (min 50 characters)
- Emoji usage must be: none/minimal/moderate/expressive
- At least 3 hashtags recommended per category

---

## Future Field Additions

### Planned Enhancements

**Business Profile:**
- Multi-location support
- Multiple languages
- Business hours exceptions (holidays)

**Operations:**
- Staff scheduling integration
- Inventory tracking
- POS system integration

**Goals:**
- Sub-goals / milestones
- Goal templates
- Automated progress tracking from analytics

**Menu:**
- Seasonal menu variants
- Menu item images
- Nutritional information
- Real-time pricing updates

**Brand Profile:**
- Tone model analysis scores
- Competitor analysis
- Brand asset library (logos, colors, fonts)
- Multi-brand support (agencies)

---

## Conclusion

This comprehensive field documentation provides a complete reference for all data captured across the five main sidebar sub-pages. Each field supports the AI-powered content generation system, ensuring personalized, goal-aligned, and brand-consistent social media content.

**Key Integration Points:**
- All fields feed into the AI content generation pipeline
- Tier-based access controls limit feature availability
- Auto-save and validation ensure data integrity
- Structured data enables sophisticated AI reasoning
