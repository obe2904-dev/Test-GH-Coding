# Brand Dashboard Database Mapping
**URL:** `http://localhost:3000/dashboard/brand` (redirects to `/dashboard/brand-v5`)  
**Component:** `src/pages/dashboard/BrandProfilePageV5.tsx`  
**Display Component:** `src/components/brandProfile/BrandProfileDisplay.tsx`  
**Generated:** 5. maj 2026

---

## Overview

This document maps all information displayed on the `/dashboard/brand` page to its corresponding database storage locations.

**Primary Database Table:** `business_brand_profile`  
**Relationship:** One-to-one with `businesses` table via `business_id`

---

## UI Sections & Database Mapping

### 🎯 **Section 1: "Din Brandprofil" (Your Brand Profile)**
*Owner-facing summary of the brand - shown at the top of the page*

| UI Element | Database Location | Column Type | Notes |
|------------|------------------|-------------|-------|
| **Brand Essence** (pull-quote) | `business_brand_profile.brand_essence` | TEXT | Primary brand identity statement (fallback: `owner_document.brand_feel`) |
| **Stemme** (Voice sentence) | `business_brand_profile.owner_document → tone_sentence` | JSONB | How the brand speaks |
| **Hvad I tilbyder** (USPs) | `business_brand_profile.owner_document → usps[]` | JSONB array | Unique selling points list |
| **Jeres gæster** - Segment cards | `business_brand_profile.audience_segments → segments[]` | JSONB | Structured audience segments (Stage B5) |
| Segment: Label | `audience_segments → segments[].label` | JSONB | Display name |
| Segment: Priority badge | `audience_segments → segments[].priority` | JSONB | 'primary', 'secondary', 'niche' |
| Segment: Strategic value | `audience_segments → segments[].strategic_value` | JSONB | 'high', 'medium', 'low' |
| Segment: Timing | `audience_segments → segments[].timing[]` | JSONB | `{day, hour_start, hour_end}` |
| Segment: Description | `audience_segments → segments[].mindset_description` or `.who` | JSONB | Who they are |
| Segment: Motivation | `audience_segments → segments[].motivation` | JSONB | Why they visit |
| **Primary mindset** (italic text) | `business_brand_profile.audience_segments → primary_mindset` | JSONB | Overall audience mindset |
| *Fallback: Occasions* | `owner_document → audience.occasions[]` | JSONB | Used if audience_segments not available |

---

### 📌 **Section 2: Gruppe 1 — Identitet (Identity)**
*Core brand identity - always visible*

| UI Element | Database Location | Column Type | Notes |
|------------|------------------|-------------|-------|
| **Badge label** | Hardcoded: "Gruppe 1 — Identitet" | - | i18n key: `brand.display.group1Badge` |
| **Brand essence** (large text) | `business_brand_profile.brand_essence` | TEXT | Core identity statement |
| **Business type** icon + label | `business_brand_profile.business_character` | TEXT | AI-generated business descriptor (e.g., "Casual industriel café") |

**Expandable Details** (click "Vis positionering"):

| UI Element | Database Location | Column Type | Notes |
|------------|------------------|-------------|-------|
| **Gæstegrundlag** (audience chips) | `business_brand_profile.audience_framework → primaryAudiences[]` | JSONB array | Primary audience types |
| **Variation over dagen** - Time slot cards | `audience_framework → timeSlots[]` | JSONB | Programme-based time slots |
| Time slot: Icon + label | Derived from `timeSlots[].programmes[]` | JSONB | Auto-generated from programme names |
| Time slot: Programmes | `timeSlots[].programmes[]` | JSONB | e.g., "Brunch, Morgenmad" |
| Time slot: Location contexts | Matched from `audience_framework → locationContexts[]` | JSONB | Matched by audience overlap |
| Time slot: Audiences | `timeSlots[].audiences[]` | JSONB | Who visits during this time |
| **Programme Revenue Weights** | `business_brand_profile.programme_revenue_weights` | JSONB | `{"Brunch": 25, "Frokost": 30, ...}` |
| *Fallback text* | `brand_essence_elaboration` | TEXT | Used if audience_framework not available |

---

### 🎤 **Section 3: Gruppe 2 — Stemme (Voice)**
*How the brand communicates*

#### **Modern View** (when `voice_options` exists):

| UI Element | Database Location | Column Type | Notes |
|------------|------------------|-------------|-------|
| **Voice Archetype Selector** | `business_brand_profile.voice_options` | JSONB | Contains recommended + alternative archetypes |
| Active archetype | `business_brand_profile.voice_archetype` | TEXT | Currently selected archetype key |
| Archetype: Label | `voice_options → options[key].label` | JSONB | e.g., "Lokal vært" |
| Archetype: Tagline | `voice_options → options[key].tagline` | JSONB | Short description |
| Archetype: Tone keywords | `voice_options → options[key].tone_model.primary_keywords[]` | JSONB | Tone chips |
| Archetype: Writing rules | `voice_options → options[key].tone_model.writing_rules[]` | JSONB | How to write |
| Archetype: Good examples | `voice_options → options[key].tone_model.good_examples[]` | JSONB | Example phrases |
| Archetype: Avoid examples | `voice_options → options[key].tone_model.avoid_examples[]` | JSONB | What not to say |
| Archetype: Formality | `voice_options → options[key].tone_model.formality` | JSONB | Formality level |
| Archetype: Example posts | `voice_options → options[key].example_posts[]` | JSONB | Sample captions |

#### **Legacy View** (when `voice_options` does NOT exist):

| UI Element | Database Location | Column Type | Notes |
|------------|------------------|-------------|-------|
| **Tone keyword chips** | `business_brand_profile.tone_model → primary_keywords[]` | JSONB | Tone descriptors |
| **Rules text** (code block) | `business_brand_profile.tone_of_voice` | TEXT | Writing rules (new format) |
| *Legacy primary tone* | `tone_of_voice → primary_tone` | JSONB | Old format (before text rules) |
| **Voice rationale** (collapsible) | `business_brand_profile.voice_rationale` | TEXT | How voice rules were derived |
| **Typical opening** | `business_brand_profile.typical_openings[0]` | TEXT[] | First opening phrase |
| **Humor label** | `business_brand_profile.humor_level` | TEXT | 'none', 'subtle', 'playful' |

#### **Post Length Guidelines** (editable subsection):

| UI Element | Database Location | Column Type | Notes |
|------------|------------------|-------------|-------|
| Guidelines cards | `business_brand_profile.post_length_guidelines[]` | JSONB | Array of content type guidelines |
| Content type | `post_length_guidelines[].content_type` | JSONB | e.g., "menu_item" |
| Sentence count | `post_length_guidelines[].sentences` | JSONB | e.g., "2-3" |
| Character range | `post_length_guidelines[].characters` | JSONB | e.g., "120-180" |
| Structure | `post_length_guidelines[].structure` | JSONB | Post structure guide |
| Rationale | `post_length_guidelines[].rationale` | JSONB | Why this length |

**Note:** `post_length_guidelines` column may not exist in live schema (referenced but not migrated as of 5. maj 2026).

---

### 🎯 **Section 4: Gruppe 3 — Content Pillars**
*What content themes to emphasize*

| UI Element | Database Location | Column Type | Notes |
|------------|------------------|-------------|-------|
| **Content pillar cards** | `business_brand_profile.content_focus` | TEXT | Parsed to array in component |
| Pillar: Hook text | `content_hooks[].hook` | Derived | Main theme |
| Pillar: Usage note | `content_hooks[].usage` | Derived | Optional usage guidance |

**Transform Logic:**
- Database stores: TEXT (legacy) or JSONB array
- Component parses TEXT as newline-separated list
- Removes leading `-` from each line
- Wraps in `{hook: string, usage?: string}` objects

---

### 🚫 **Section 5: Gruppe 4 — Grænser (Boundaries)**
*What to emphasize and avoid*

| UI Element | Database Location | Column Type | Notes |
|------------|------------------|-------------|-------|
| **💡 Brandfølelse** (Emotional promise) | `business_brand_profile.emotional_promise` | TEXT | Feeling guests take home |
| **🚫 Aldrig i opslag** (Never post about) | `business_brand_profile.content_exclusions` | TEXT | Content exclusions (menu posts excepted) |
| **Voice constraints** | `business_brand_profile.voice_constraints` | TEXT | Hard communication rules |
| **Avoid examples** | `business_brand_profile.tone_model → avoid_examples[]` | JSONB | Phrases to never use |
| **Signature phrases** (clickable chips) | `business_brand_profile.signature_phrases[]` | TEXT[] | First 5 phrases shown |

---

### 📊 **Section 6: Post Strategi (Content Strategy)**
*Shown conditionally when `content_strategy` exists*

| UI Element | Database Location | Column Type | Notes |
|------------|------------------|-------------|-------|
| **Primary goal label** | `business_brand_profile.content_strategy → primary_goal` | JSONB | 'drive_footfall', 'build_brand', 'retain_loyalty' |
| **Goal blend chart** | `content_strategy → goal_blend` | JSONB | `{drive_footfall: 60, build_brand: 25, retain_loyalty: 15}` |
| **Footfall signals** | `content_strategy → footfall_signals[]` | JSONB | Drive-traffic content themes |
| **Brand anchors** | `content_strategy → brand_anchors[]` | JSONB | Brand-building themes |
| **Loyalty hooks** | `content_strategy → loyalty_hooks[]` | JSONB | Retention themes |
| **Content category weights** | `content_strategy → content_category_weights` | JSONB | `{product_menu: 40, craving_visual: 30, ...}` |
| **Natural moments** | `content_strategy → anchors[]` | JSONB | Slot B/C content anchors |

---

### 💼 **Section 7: Commercial Strategy**
*Business-specific trigger configuration*

| UI Element | Database Location | Column Type | Notes |
|------------|------------------|-------------|-------|
| **Baseline mode** | `business_brand_profile.commercial_baseline_mode` | TEXT | 'booking_push', 'footfall_push', 'balanced' |
| **Trigger configuration** | `business_brand_profile.trigger_configuration` | JSONB | Business-specific trigger policies |
| **Strategy reasoning** | `business_brand_profile.commercial_strategy_reasoning` | TEXT | AI explanation of recommendations |
| **Last updated timestamp** | `business_brand_profile.trigger_last_updated` | TIMESTAMPTZ | When config was last modified |
| **Updated by** | `business_brand_profile.trigger_updated_by` | TEXT | 'ai' or user ID |

---

## Data Not Shown on Dashboard (Stored but Hidden)

The following fields exist in `business_brand_profile` but are **not displayed** on `/dashboard/brand`:

### **Used Internally by AI** (not user-facing):
- `target_audience` (old format - superseded by `audience_segments`)
- `communication_goal` (old format - superseded by `content_strategy`)
- `competitive_positioning` (deprecated)
- `banned_words` (legacy - replaced by `things_to_avoid_jsonb`)
- `brand_positioning` (legacy)
- `tone_keywords[]` (legacy - replaced by `tone_model`)
- `values[]` (brand values - not displayed)
- `certifications[]` (certifications - not displayed)
- `do_not_say` (JSONB - superseded by structured fields)

### **Voice Enrichment** (consumed by AI, not shown in UI):
- `never_say[]` (avoid list)
- `typical_closings[]` (closing phrases)
- `formality` (formality level)
- `storytelling_style` (storytelling preference)
- `emoji_style` (emoji usage preference)
- `punctuation_style` (punctuation preference)
- `brand_origin_story` (brand history)
- `signature_approach` (unique methodology)
- `owner_perspective` (owner's view)
- `founded_year` (founding year)

### **Visual & Atmosphere** (used in content generation, not shown):
- `recognizable_interior_identity` (photo-based atmosphere)
- `visual_character` (concept label)
- `venue_scene` (visual description)
- `venue_energy` (energy descriptor)
- `guest_situation_type` (guest activity in photos)

### **Strategy Metadata** (internal tracking):
- `offerings_full` (all offering candidates - **DROPPED**)
- `offerings_weights` (offering scoring)
- `offerings_reasoning[]` (offering rationale)
- `offerings_confidence` (confidence level)
- `target_audience_primary[]` (primary audiences - old format)
- `target_audience_seasonal` (seasonal modifiers)
- `audience_reasoning[]` (audience rationale)
- `audience_confidence` (confidence level)
- `goal_reasoning[]` (goal rationale)
- `goal_confidence` (confidence level)
- `strategy_version` (strategy model version)
- `approved_by_user` (user approval flag)

### **Quality & Generation**:
- `quality_status` ('green', 'yellow', 'red')
- `generation_errors` (error log JSONB)
- `last_edited_by` ('ai' or 'user')
- `last_edited_at` (edit timestamp)
- `voice_extraction_source` (extraction method)
- `voice_extracted_at` (extraction timestamp)
- `voice_confidence_score` (0-100 confidence)

### **Location Intelligence**:
- `location_intelligence` (denormalized snapshot from `business_location_intelligence`)

### **Posting Schedule**:
- `posting_occasions` (AI-selected schedule JSONB)
- `posting_occasions_hash` (staleness detection)

### **JSONB Source of Truth** (replaced legacy TEXT columns):
- `things_to_avoid_jsonb`
- `image_preferences_jsonb`
- `core_offerings_jsonb`

### **Business Classification** (Stage B0):
- `business_model_type` ('offer_led', 'occasion_led', 'destination_led', 'audience_led')
- `primary_copy_hook` ('product', 'location', 'programme', 'identity')
- `audience_breadth` ('narrow', 'mixed', 'broad')
- `classification_rationale` (classification explanation)

### **Settings**:
- `booking_link` (reservation URL - shown in other contexts)
- `cta_preference` (CTA style)
- `business_voice` (legacy voice setting)
- `content_strategy_confirmed` (owner confirmation flag)
- `atmosphere_confidence_level` ('none', 'building', 'high')

### **Dropped Columns** (no longer in schema):
- `voice_style` (dropped)
- `cta_style` (dropped)
- `content_pillars_jsonb` (dropped)
- `personality` (dropped)
- `voice_execution` (dropped)
- `execution_profile` (dropped)
- `sample_posts` (dropped)
- `what_makes_us_different` (dropped)

---

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────┐
│  USER VIEWS: /dashboard/brand                           │
│  Component: BrandProfilePageV5.tsx                      │
└─────────────────────────┬───────────────────────────────┘
                          │
                          │ Fetch via Supabase client
                          ↓
┌─────────────────────────────────────────────────────────┐
│  DATABASE: business_brand_profile                       │
│  • One row per business (PK: business_id)               │
│  • ~96 columns total                                    │
│  • ~40 columns displayed on dashboard                   │
│  • ~56 columns used internally by AI                    │
└─────────────────────────┬───────────────────────────────┘
                          │
                          │ Transform via transformProfile()
                          ↓
┌─────────────────────────────────────────────────────────┐
│  DISPLAY COMPONENT: BrandProfileDisplay.tsx             │
│  • Sections: Din Brandprofil, Identitet, Stemme,        │
│              Content Pillars, Grænser, Post Strategi    │
│  • Conditionally renders based on data availability     │
└─────────────────────────────────────────────────────────┘
```

---

## Key Transform Functions

### `transformProfile(dbProfile)` 
**Location:** `src/pages/dashboard/BrandProfilePageV5.tsx`

Converts database format to display format:
- Parses JSON fields stored as strings
- Handles legacy vs. new tone format
- Wraps content_focus TEXT into array of `{hook, usage}` objects
- Ensures target_audience and competitive_positioning have expected structure
- Maps all JSONB fields to typed objects

---

## Regeneration Flow

**Trigger:** User clicks "🔄 Regenerér" button  
**Handler:** `handleRegenerate()` in `BrandProfilePageV5.tsx`

1. Calls `brand-profile-generator` Edge Function (POST request)
2. Edge function writes directly to `business_brand_profile` table
3. Component calls `refetch()` to reload data
4. Display updates with new brand profile

**Edge Function:** `supabase/functions/brand-profile-generator/index.ts`  
**Database Write:** Uses `saveBrandProfile()` helper to upsert `business_brand_profile` row

---

## Authentication & Access Control

- **User must be logged in** to view `/dashboard/brand`
- Redirects to `/login` if not authenticated
- Component fetches `businesses.id` based on `auth.users.id` (owner_id)
- Only shows brand profile for businesses owned by logged-in user

---

## Tier-Based Features

- **Free Tier:** Shows upgrade prompt instead of brand profile
- **Smart/Standard Plus & Premium:** Full brand profile functionality
- Tier check happens in component before rendering

---

## Technical Notes

1. **One-to-One Relationship:** Each business has exactly one `business_brand_profile` row
2. **JSONB Columns:** Most structured data stored as JSONB for flexibility
3. **Array Columns:** Some fields use `TEXT[]` for simple lists
4. **Legacy Compatibility:** Old format columns kept alongside new JSONB columns during migration
5. **Missing Column:** `post_length_guidelines` referenced in code but not in live schema (needs migration)
6. **Dropped Columns:** 10+ columns have been removed over time (see "Dropped Columns" section)

---

## Related Tables

While the brand dashboard primarily uses `business_brand_profile`, it references:

- **`businesses`** - for `business_id`, owner verification
- **`business_profile`** - legacy fallback for some fields (e.g., `ai_brand_context`)
- **`business_location_intelligence`** - denormalized into `location_intelligence` JSONB

---

## Last Updated
5. maj 2026 — Complete schema mapping verified against live database and component code.
