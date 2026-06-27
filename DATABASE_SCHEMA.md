# Database Schema Reference - Test P2G 1
Last updated: 2026-05-26
- Session 1: Added menu_items_normalized, text_generation_version  
- Session 2: Added weekly_strategies (21 columns), contextual_calendar, weekly_content_plans, businesses.category, brand_essence_elaboration, strategy_rationale, commercial_weight, core_offerings, strategic_brief, strategic_brief_raw, weekly_content_plans.strategy_id

## Core Tables

### businesses
Main business entity table
- `id` (uuid, PK)
- `name`, `city`, `business_type`
- `business_type_hybrid` (JSONB) - Hybrid business type structure: `{ primary: string, secondary: string[], hybridLabel: string, cuisineType?: string, conceptTags?: string[] }`
- **`category`** (text) ← Legacy field; migrating to business_type_hybrid for richer context
- `price_level` (1-4)

### business_brand_profile
Brand voice and tone DNA (V5.5 architecture)
- `business_id` (uuid, FK)
- **`business_character`** (text) ← AI-generated description of what business is (prevents hallucination)
- **`brand_essence_elaboration`** (text) ← 2-3 sentence strategic anchor (location, offerings, audience)
- **`core_offerings`** (text[]) ← Top 3 identity patterns (max 3 items, defines WHAT business is)
- `brand_profile_v5` (JSONB) - Contains:
  - `identity.business_character`
  - `voice.tone_dna` (4 pillars: location_driver, culinary_character, owner_voice, market_context)
  - `voice.enhanced_social_examples` (with reasoning)
  - `voice.enhanced_avoid_examples` (with failure modes)
  - `voice.writing_rules`, `voice.vocabulary_preferences`

### daily_suggestions
AI-generated content ideas for each day
- `id` (integer, PK)
- `business_id` (uuid, FK)
- `date` (date)
- `position` (1-3, three suggestions per day)
- `title`, `rationale`, `why_explanation`
- **`menu_item_name`** (text) ← Name of dish for menu posts
- **`menu_item_description`** (text) ← Description for AI prompt
- `content_type` (menu_item, atmosphere, behind_scenes, etc.)
- `caption_base`, `cta_intent`, `photo_idea`
- `media_suggestion` (JSONB)
- `generated_text`, `generated_hashtags`, `generated_platform_content` (cache)
- **`text_generation_version`** (integer) ← Tracks prompt version

### weekly_strategies ✅ ACTIVE
Weekly strategic analysis and post ideas (Layer 0 output)
- `id` (uuid, PK)
- `business_id` (uuid, FK)
- `week_number`, `week_start`, `week_end`
- **`narrative`** (JSONB) - Strategic overview and headline
- **`strategic_priorities`** (JSONB) - Array of focus areas
- **`strategic_brief`** (JSONB) ← Phase 1 strategic analysis: angles, competitive advantage, content types, week summary
- **`strategic_brief_raw`** (text) ← Raw AI response before JSON parsing (debugging)
- **`strategy_version`** (text) ← Version tracking (v2_two_phase, v2.1_brand_v5, etc.)
- **`strategy_rationale`** (text) ← Weekly modulation rationale explaining content mix deviations
- **`post_ideas`** (JSONB) - Array of 7 PostIdea objects
- **`selected_idea_ids`** (integer[]) - User's selection (e.g., [1,3,5,6])
- `week_context_snapshot` (JSONB) - Full context for debugging
- `status` - 'pending' → 'generated' → 'ideas_selected' → 'posts_created' | 'error'
- `platforms` (text[]) - Active platforms
- `subscription_tier` - 'smart' or 'pro'
- `target_post_count` - Number of ideas generated

### menu_results_v2
Menu extraction and analysis
- `id` (uuid, PK)
- `business_id` (uuid, FK)
- `language_code` (text) - Menu language (da, en, etc.)
- `status` (text) - 'done' when extraction complete
- **`structured_data`** (JSONB) - Menu structure:
  ```json
  {
    "categories": [
      {
        "name": "Frokost",
        "items": [
          {
            "name": "Pariserbøf",
            "description": "Sprød ristet brød...",
            "price": "105,-"
          }
        ]
      }
    ]
  }
  ```
- `representative_dishes` (JSONB) - Signature dishes
- `service_periods` (ARRAY) - e.g., ['lunch', 'dinner']
- `ai_summary` (text)

### menu_items_normalized ✅ ACTIVE
Normalized menu items for fast querying (synced from menu_results_v2)
- `id` (uuid, PK)
- `business_id` (uuid, FK)
- `menu_result_id` (uuid, FK to menu_results_v2)
- **`item_name`** (text) - e.g., "PARISERBØF"
- **`item_description`** (text) - Full prose description
- `item_price` (text)
- `category_name` (text) - e.g., "KLASSIKERE"
- `category_type` (text) - main, kids_menu, dessert, appetizer, sides
- `service_periods` (text[])
- **Synced**: 178 items for Café Faust
- **Sync Function**: `sync_menu_items_normalized(business_id)` - Call after menu updates

### business_location_intelligence
Location context and drivers
- `business_id` (uuid, FK)
- `location_scores` (JSONB) - Scoring for waterfront, historic, etc.
- `signature_themes` (JSONB)
- `motivation_hooks` (JSONB)

### contextual_calendar ✅ ACTIVE
Country-specific events, holidays, vacations for AI content suggestions
- `id` (uuid, PK)
- `country` (text) - ISO country code (DK, SE, NO, etc.)
- `event_type` - holiday | school_vacation | season | cultural | business_rhythm
- `event_name` (text) - e.g., "Sommerferie", "Grundlovsdag"
- `date_start`, `date_end` (date)
- `recurrence` - annual | seasonal | monthly | weekly
- **`commercial_weight`** (smallint, 1-10) ← Commercial importance (1=minor, 4-6=moderate, 9-10=critical)
- **`lead_days`** (smallint) ← Days before event to start posting (default 3)
- `relevance_tags` (text[]) - families, outdoor, cozy_indoor, romantic, etc.
- `content_angle` (text) - AI guidance for content strategy
- `marketing_hook` (text) - Promotional opportunities
- **Seeded**: 9 Denmark holidays/vacations for 2026

### weekly_content_plans ✅ ACTIVE
AI-generated weekly content plans with post specifications
- `id` (uuid, PK)
- `user_id` (uuid, FK)
- `business_id` (uuid, FK)
- `week_number`, `week_start`, `week_end`
- **`posts`** (JSONB) - Array of complete post specifications (timing, platform, caption, visual)
- `summary` (JSONB) - Aggregated statistics (platform/format distribution)
- `learning_data` (JSONB) - User edit patterns for AI feedback loop
- `generated_at`, `created_at`, `updated_at`
- **RLS enabled**: Users can only access their own plans
- `daily_suggestions.menu_item_name` + `menu_item_description` (pre-populated for suggestions)

## How Menu Data Flows to AI Prompt

1. Suggestion created → `menu_item_name` populated (e.g., "PARISERBØF")
2. Suggestion MAY have `menu_item_description` (often just ingredient list)
3. generate-text-from-idea function → receives suggestion
4. resolve-context.ts → Looks up in `menu_items_normalized` ✅
5. Gets full description: "af 350 g. oksekød, med rødbeder, kapers, løg, peberrod, pickles og æggeblomme"
6. Passes to prompt builder → `RET: ${menuItemName}\n${menuItemDescription}`
7. AI generates text with proper context

**Data Quality:**
- menu_items_normalized: ✅ 91-104 char prose descriptions
- daily_suggestions: ⚠️ Often 66 char ingredient lists (filtered out, uses normalized table instead)

## Sync Process
```sql
-- Sync all businesses
SELECT * FROM sync_menu_items_normalized();

-- Sync specific business
SELECT * FROM sync_menu_items_normalized('business-uuid-here');

-- Check sync status
SELECT COUNT(*), business_id 
FROM menu_items_normalized 
GROUP BY business_id;
```

## To Check Schema Yourself
```sql
-- List all tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' ORDER BY table_name;

-- Get columns for a table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'YOUR_TABLE_NAME'
ORDER BY ordinal_position;
```
