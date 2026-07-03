# Brand Profile System - Complete Overview

**Date:** May 6, 2026  
**Endpoint:** `https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator`  
**Dashboard:** `http://localhost:3000/dashboard/brand`  
**Version:** v4.14.0 (Sprint 1 - Complexity Reduction)

---

## What is the Brand Profile?

The Brand Profile is the **AI-powered voice and identity engine** for the entire content generation system. It automatically generates 9+ canonical brand voice variables that define how a business should communicate on social media.

Think of it as the **strategic foundation** that ensures all AI-generated content sounds authentic and consistent with the business's actual identity.

---

## Core Purpose

**Input:** Raw business data (website, menu, location, operations)  
**Output:** Structured brand voice profile (tone, audience, content strategy, voice rules)  
**Used by:** 
- Weekly content strategy generation (Phase 1)
- Individual post generation
- Dagens Forslag (quick suggestions)
- All AI content generation

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     DATA GATHERING                          │
│  • Business snapshot (name, category, location)             │
│  • User profile (descriptions, audience)                    │
│  • Menu data (structured items, programmes)                 │
│  • Website analysis (tone, themes, content)                 │
│  • Location intelligence (area type, tourist context)       │
│  • Images (metadata - not yet active)                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              STAGE B0: Business Model Classification        │
│  Model: gpt-4o-mini (~5s)                                   │
│  Output: business_model_type, audience_breadth, copy_hook   │
│  Purpose: Fast structural classification before full        │
│           analysis (reduces B5 prompt by ~30%)              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│         STAGE A: Internal Analysis (Heavy Processing)       │
│  Model: gpt-4o                                              │
│  Budget: 30s (max_tokens: 1800)                             │
│  Output: Structured insights extraction                     │
│  • Brand identity (values, attributes, positioning)         │
│  • Audience insights (demographics, needs, language)        │
│  • Offering analysis (products, service style)              │
│  • Communication patterns (tone, phrases, avoidances)       │
│  • Confidence scoring (data quality, signal sources)        │
│  Status: Hidden from user - internal processing only        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│      STAGE B: Brand Profile Generation (User-Facing)        │
│  Model: gpt-4o-mini                                         │
│  Budget: 50s (max_tokens: 3000)                             │
│  Language: Danish (2nd person: "I", "jeres")                │
│  Output: 9 core brand variables + enrichment                │
│                                                              │
│  CORE VARIABLES:                                            │
│  1. brand_essence - The soul of the brand                   │
│  2. tone_of_voice - Communication style rules               │
│  3. target_audience - Who they speak to                     │
│  4. core_offerings - What they sell                         │
│  5. content_focus - What content highlights                 │
│  6. communication_goal - What each post achieves            │
│  7. image_preferences - Visual style                        │
│  8. things_to_avoid - What to never say                     │
│  9. brand_essence_elaboration - Extended strategic anchor   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│   ✂️ STAGE B1 REMOVED (Sprint 1 - Complexity Reduction)     │
│  Voice archetype generation eliminated (~15s saved)         │
│  Owner gets ONE voice (opinionated, not optional)           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              STAGE B2: Tone Model Structuring               │
│  Purpose: Convert narrative tone_of_voice to structured     │
│           writing rules                                     │
│  Output: tone_model JSONB                                   │
│  • primary_keywords (3-5 adjectives)                        │
│  • writing_rules (bullet list)                              │
│  • good_examples (2-3 sentences)                            │
│  • avoid_examples (2-3 anti-patterns)                       │
│  • formality_level                                          │
│  • emoji_level                                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│         STAGE B3: Emotional Promise & Content Exclusions    │
│  Output:                                                    │
│  • emotional_promise - Emotional value proposition          │
│  • content_exclusions - Topics/themes to never touch        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              STAGE B4: Owner Document Processing            │
│  Input: Free-text owner onboarding document                 │
│  Output: Structured owner_document JSONB                    │
│  • Extracted key facts from owner's own words               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│         STAGE B5: Audience Segment Intelligence             │
│  Model: gpt-4o (non-blocking, non-fatal)                    │
│  Input: Brand profile + location + operations + B0          │
│  Output: 3-6 named audience segments                        │
│  Each segment:                                              │
│  • label (e.g., "Morgengæster", "Weekend-familier")         │
│  • timing_windows (when they visit)                         │
│  • content_angles (what resonates with them)                │
│  • metadata (size, importance, motivation)                  │
│  Saved to: audience_segments JSONB column                   │
│  Used by: get-quick-suggestions + owner UI                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│         STAGE CS: Commercial Strategy Generation            │
│  Model: gpt-4o-mini                                         │
│  Input: All brand data + location + menu + tourist context  │
│  Output: Commercial strategy reasoning                      │
│  • Determines baseline goal_mode split                      │
│  • Maps content categories to business strengths            │
│  • Generates content_strategy JSONB                         │
│    - goal_split (footfall vs brand vs loyalty %)            │
│    - content_category_weights                               │
│    - brand_anchors (what to emphasize)                      │
│  Write-once: Never overwritten on regeneration              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              VALIDATION & QUALITY SCORING                   │
│  • Validate all outputs against schema                      │
│  • Calculate confidence scores (0-1) per variable           │
│  • Map to quality_status: green/yellow/red                  │
│  • Detect banned words                                      │
│  • Apply fallbacks for weak signals                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              SAVE TO DATABASE                               │
│  Table: business_brand_profile                              │
│  74 columns total (reduced from 77 in Sprint 1)             │
│  Upsert: Updates existing profile or creates new            │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Sources (Priority Tiers)

### Tier 1 - Authoritative (Always Trust)
✅ **Business snapshot** (`businesses` table)
- `business_name`, `business_category`, `city`, `country`

✅ **User profile** (`business_profiles` table)
- `short_description`, `long_description`, `target_audience`
- **Weight**: +0.4 confidence if populated

✅ **Menu data** (`menu_items` table)
- Structured menu with names, descriptions, prices
- **Weight**: +0.2 confidence

### Tier 2 - Supporting (Read-Only, Cautious)
📖 **Website analysis** (`website_analyses` table)
- Homepage content, About page, detected tone, key themes
- **Weight**: +0.2 for tone, +0.1 for themes
- **Used for**: Tone signals, NOT source of truth

📖 **Location intelligence** (`business_location_intelligence` table)
- Area type, tourist context, nearby landmarks
- Customer motivation matching

### Tier 3 - Do NOT Use (For Now)
❌ Reviews (Google, TripAdvisor)  
❌ Ratings  
❌ Engagement metrics  
❌ Third-party articles

**Golden Rule:** If a claim is not stated by the business itself, do not promote it into brand truth.

---

## The 9 Core Brand Variables

### 1. `brand_essence`
**Type:** Text (1-2 sentences)  
**Purpose:** The soul of the brand - what makes it unique  
**Example:** "En hyggelig kvartercafé hvor nabolaget mødes over hjemmelavet brunch og god kaffe"

### 2. `tone_of_voice`
**Type:** Text (narrative rules) + JSONB (structured tone_model)  
**Purpose:** How the business communicates  
**Format (narrative):**
```
STEMME-MEKANIK:
- Brug hverdagssprog - "kom forbi" ikke "besøg os"
- Konkrete detaljer - "nybagte kanelsnegle kl 8" ikke "friske bagværker"

STEMME-IDENTITET:
- Lokal og nærværende - "I kvarteret", "hos os"
- Indbydende uden at presse - "Klar til en kop kaffe?"

Eksempel: "Morgensolen skinner ind over frokosten. Vi har åbent til kl 16 i dag."
```

**Format (structured tone_model JSONB):**
```json
{
  "primary_keywords": ["venlig", "afslappet", "nærværende"],
  "writing_rules": [
    "Brug hverdagssprog",
    "Konkrete detaljer, ikke abstrakte påstande"
  ],
  "good_examples": [
    "Frisk brunch klar kl 10. Kom forbi!"
  ],
  "avoid_examples": [
    "Vi tilbyder en eksklusiv gastronomi oplevelse"
  ],
  "formality_level": "casual",
  "emoji_level": "moderate"
}
```

### 3. `target_audience`
**Type:** Text  
**Purpose:** Who the brand speaks to  
**Example:** "Lokale beboere i alderen 30-55, familier i weekenden, og freelancere på hverdage"

### 4. `core_offerings`
**Type:** Text (also `core_offerings_jsonb` for structured data)  
**Purpose:** What the business sells  
**Example:** "Brunch, frokost, kaffe & kage, take-away"

### 5. `content_focus`
**Type:** Text (also extracted to `content_hooks` array)  
**Purpose:** What content should emphasize  
**Example:** "Dagens retter, sæsonens råvarer, hyggelige stemninger, lokale events"

### 6. `communication_goal`
**Type:** Text  
**Purpose:** What each post should achieve  
**Example:** "Gør gæsterne nysgerrige på dagens menu og skab lyst til at besøge caféen"

### 7. `image_preferences`
**Type:** Text + JSONB  
**Purpose:** Visual style preferences  
**Example:** "Naturligt lys, close-ups af mad, gæster i baggrunden, Instagram-venlig æstetik"

### 8. `things_to_avoid`
**Type:** Text + JSONB (also `never_say` array)  
**Purpose:** What to never say or do  
**Example:** "Undgå overdrevne påstande, fancy foodie-sprog, eller påtrængende salg"

### 9. `brand_essence_elaboration`
**Type:** Text (2-3 sentences)  
**Purpose:** Extended strategic anchor  
**Injected into:** Weekly plan AI (PERSONALITY ANCHOR block on every Phase 1 run)  
**Example:** "En café i hjertet af Vesterbro hvor nabolaget mødes. Vi serverer brunch og frokost lavet med danske råvarer. Vores gæster er lokale familier, freelancere, og venner der mødes over kaffe."

---

## Additional Enrichment Fields

### Voice Enrichment
- `signature_phrases` - Brand-specific phrases to weave into content
- `typical_openings` - Extracted "Eksempel:" lines from tone_of_voice
- `typical_closings` - Common ending patterns
- `humor_level` - none/subtle/moderate/high
- `formality` - casual/professional/formal
- `emoji_style` - none/minimal/moderate/frequent

### Content Strategy (Stage CS Output)
- `content_strategy` - JSONB with:
  - `goal_split` - % footfall vs brand vs loyalty
  - `content_category_weights` - Which categories fit the business
  - `brand_anchors` - What to emphasize
- `commercial_baseline_mode` - balanced/aggressive/conservative
- `trigger_configuration` - Commercial triggers (seasonal, weather, events)
- `commercial_strategy_reasoning` - Why this strategy was chosen

### Audience Intelligence (Stage B5 Output)
- `audience_segments` - JSONB array of 3-6 segments
  - Each: {label, timing_windows, content_angles, metadata}
- ~~`audience_framework`~~ - REMOVED (Sprint 1 - consolidation to segments)

### Voice Archetypes
- ~~`voice_options`~~ - REMOVED (Sprint 1)
- ~~`voice_archetype`~~ - REMOVED (Sprint 1)
- **Change:** Owner gets ONE voice (no archetype selection)

### Metadata
- `quality_status` - green/yellow/red (based on confidence scores)
- `version_hash` - For change detection (skip regeneration if unchanged)
- `generation_errors` - JSONB error log from last generation
- `updated_at` - Timestamp of last profile update

---

## Database Schema

**Table:** `business_brand_profile`  
**Primary Key:** `business_id` (uuid, FK to `businesses.id`)  
**Total Columns:** 74 (reduced from 77 in Sprint 1)  
**Relationship:** One-to-one with businesses

### Key Columns Used by Content Generation

**Voice & Tone:**
- `tone_of_voice` (text) - Narrative rules
- `tone_model` (jsonb) - Structured tone rules
- `tone_keywords` (text[]) - Quick-reference tags
- `voice_constraints` (text) - Hard rules
- `never_say` (text[]) - Banned words/phrases ⚠️ **LIVE SOURCE**
- `do_not_say` (jsonb) - Banned words (structured) ⚠️ **NULL FOR ALL ROWS - NEVER POPULATED**

**Brand Identity:**
- `brand_essence` (text) - One-line soul
- `brand_essence_elaboration` (text) - Extended anchor
- `business_character` (text) - Plain-text descriptor
- `identity_keywords` (text[]) - V2 brand tags

**Audience:**
- `target_audience` (text) - Who they speak to
- `audience_segments` (jsonb) - Stage B5 segments
- ~~`audience_framework` (jsonb)~~ - REMOVED (Sprint 1)

**Content:**
- `content_strategy` (jsonb) - Stage CS output (write-once)
- `content_focus` (text) - What to emphasize
- `core_offerings` (text) - What they sell
- `signature_phrases` (text[]) - Brand-specific phrases
- `typical_openings` (text[]) - Opening patterns
- `typical_closings` (text[]) - Closing patterns

**Visual:**
- `image_preferences` (text) - Visual style
- `image_preferences_jsonb` (jsonb) - Structured visual rules
- `visual_character` (text) - AI-analyzed interior style
- `venue_scene` (text) - Scene description
- `recognizable_interior_identity` (text) - Distinctive interior flag

**Quality & Metadata:**
- `quality_status` (text) - green/yellow/red
- `version_hash` (text) - Change detection
- `generation_errors` (jsonb) - Error log
- `updated_at` (timestamptz) - Last update

---

## Frontend Dashboard

**File:** `src/pages/dashboard/BrandProfilePageV5.tsx`  
**Route:** `/dashboard/brand`

### Features

1. **View Brand Profile**
   - Displays all 9 core variables
   - Shows confidence scores per variable
   - Quality status indicator (green/yellow/red)
   - Last updated timestamp

2. **Generate/Regenerate Profile**
   - Button: "Generate Brand Profile" (first time)
   - Button: "Regenerate" (updates existing)
   - Shows progress during generation
   - Auto-refreshes after completion

3. **Edit Capabilities**
   - Manual overrides for any variable
   - Saves to database immediately
   - Preserves AI-generated fields unless explicitly changed

4. **Data Display Transformations**
   - Parses JSONB fields (tone_model, content_strategy, etc.)
   - Handles legacy formats (old tone_of_voice as JSONB object)
   - Converts arrays to bullet lists for display
   - Shows voice archetype if selected

---

## How It Integrates With Content Generation

### Weekly Strategy (Phase 1)

The brand profile is **the foundation** for weekly content strategy generation.

**File:** `supabase/functions/_shared/post-helpers/strategy/phase1.ts`

**Inputs to Phase 1:**
- `brand_essence_elaboration` - Strategic anchor (PERSONALITY ANCHOR block)
- `tone_of_voice` - Writing rules
- `content_strategy` - Goal split, category weights
- `audience_segments` - Who to target
- `signature_phrases` - Brand-specific language
- `never_say` - Banned words

**Phase 1 Output:**
- `week_summary` - Strategic narrative for the week
- `competitive_advantage` - Why this week matters
- `angles` - 3-7 strategic angles (each with weight, reasoning, content_direction)

**Slot System (overlays on angles):**
- Slot A: Footfall driver (Thu-Fri 14:00)
- Slot B: Footfall support (Wed-Thu 11:00)
- Slot C: Brand builder (Mon 09:00)
- Slot D: Flexible (varies by context)

Each angle gets:
- `goal_mode` (drive_footfall / strengthen_brand / retain_regulars)
- `content_category` (product_menu / behind_scenes / atmosphere / etc.)

### Individual Post Generation

**Consumed Fields:**
- `tone_of_voice` - Writing style rules
- `signature_phrases` - Brand language to weave in
- `never_say` - Words to avoid
- `target_audience` - Voice targeting
- `business_character` - What the business IS (prevents hallucination)

### Dagens Forslag (Quick Suggestions)

**Consumed Fields:**
- `tone_of_voice` - Writing rules
- `content_strategy` - Slot system + category weights
- `audience_segments` - Segment-specific angles
- `what_makes_us_different` - Competitive differentiator (Slot C)
- `signature_phrases` - Brand language

---

## Time Budget & Performance

**Total Wall-Clock Budget:** ~135 seconds (reduced from ~150s in Sprint 1)

**Stage Breakdown:**
- Stage B0 (Business Classification): ~5s
- Stage A (Internal Analysis): ~30s (gpt-4o, 1800 tokens)
- Stage B (Brand Generation): ~50s (gpt-4o-mini, 3000 tokens)
- ~~Stage B1 (Voice Options): ~15s~~ REMOVED (Sprint 1)
- Stage B2 (Tone Model): ~10s
- Stage B5 (Audience Segments): ~46s (gpt-4o, non-blocking)
- Stage CS (Commercial Strategy): ~20s
- Validation + Save: ~5s

**Notes:**
- Stages run sequentially (B depends on A)
- No retries on timeouts (budget protection)
- JSON fixer removed in v4.12.4 (was adding 30-130s unpredictably)

---

## Fallback System

When AI output is weak or missing, deterministic fallbacks ensure the system never fails.

### Fallback Triggers

1. **Insufficient data quality** (confidence < 0.3)
2. **Generic output** (contains banned generic phrases like "god kvalitet")
3. **Empty/missing fields**
4. **Validation failures** (schema mismatch)

### Fallback Sources (in order)

1. **User profile** (`business_profiles` table)
   - `short_description`, `long_description`, `target_audience`

2. **Menu data** (`menu_items` table)
   - Extract offerings, price signals, service style

3. **Location intelligence**
   - Area type, tourist context, nearby landmarks

4. **Business operations**
   - Establishment type, price level, service periods

5. **Generic templates** (last resort)
   - Locale-specific defaults (Danish waterfront phrases, etc.)

### Example Fallbacks

**`brand_essence` fallback:**
```typescript
buildBrandEssenceFallback(dataSources, language) {
  const businessName = dataSources.business.business_name
  const category = dataSources.business.business_category || 'restaurant'
  const city = dataSources.business.city
  
  return `${businessName} er en ${category} i ${city} der serverer...`
}
```

**`tone_of_voice` fallback:**
```typescript
buildToneOfVoiceFallback(dataSources, analysis, language) {
  const formality = analysis.communicationPatterns.toneSignals.includes('formal') 
    ? 'professionel' 
    : 'venlig'
  
  return `Skriv i en ${formality} tone. Brug konkrete detaljer...`
}
```

---

## Validation & Error Handling

### Validation Layers

1. **Schema Validation** - All outputs match expected structure
2. **Content Validation** - No banned words, no generic phrases
3. **Confidence Scoring** - 0-1 score per variable based on signal strength
4. **Quality Gating** - Map to green/yellow/red status

### Error Handling Strategy

**Non-Fatal Errors (warn + continue):**
- Stage B0 fails → Continue without classification
- Stage B5 fails → Continue without segments
- Fallback generation fails → Use generic template

**Fatal Errors (return 422/500):**
- Cannot connect to database
- Cannot fetch data sources
- Stage A returns no response
- Stage B returns no response
- Database save fails

### Error Logging

All errors saved to `business_brand_profile.generation_errors` JSONB:
```json
{
  "timestamp": "2026-05-06T10:30:00Z",
  "stage": "Stage B5",
  "error": "Timeout after 46s",
  "severity": "warning",
  "recovered": true
}
```

---

## Version History Highlights

### v4.14.0 (Sprint 1 - Complexity Reduction - May 6, 2026)
- **REMOVED** Stage B1 (voice archetype generation) — saves 15s processing time
- **REMOVED** `voice_options`, `voice_archetype` DB columns
- **REMOVED** `audience_framework` DB column — consolidated to `audience_segments`
- **REMOVED** archetype selection UI from dashboard
- **UPDATED** content generation functions to use `audience_segments` only
- **RESULT:** 77 → 74 DB columns, ~150s → ~135s generation time
- See: SPRINT-1-IMPLEMENTATION-SUMMARY.md

### v4.13.0 (Cleanup - Mar 12, 2026)
- Removed A1/A2 split architecture (never activated in production)
- Removed assertNoForbidden (warn-only, no practical effect)
- Removed proof-grounding.ts (test file only)
- Moved full changelog to CHANGELOG.md

### v4.12.4 (Critical Fix)
- **REMOVED** JSON-fixer chain from Prompt B (was untimed, 30-130s extra)
- Reduced Prompt B menu injection from 80+ items to 12 (saves ~1500 tokens, 10-20s faster)

### v4.12.3 (Model Fix)
- **CHANGED** Prompt A model: gpt-4o-mini → gpt-4o (mini was timing out at 47-60s)
- Budget: A(35s) + B(50s) = 85s

### v4.7.3 (Critical DB Fix)
- Added `sanitizeToneModelForDb()` to ensure DB-safe `tone_model`
- Fixed DB constraint violations (return 422, not 500)
- Added runtime tests for tone_model sanitizer

### v4.6.0 (Quality Status)
- Added `quality_status` computation and storage (green/yellow/red)

### v4.5.0 (Fallbacks)
- Added `tone_of_voice` + `content_focus` fallbacks
- Complete field overwrites in repair mode

---

## Key Design Principles

### 1. Trust Hierarchy
Only promote claims that come from the business itself (Tier 1 data).  
Website analysis is read-only supporting evidence, never source of truth.

### 2. Write Danish, Think Business
All user-facing text in 2nd person Danish ("I", "jeres").  
Content must be specific and grounded in actual business data.

### 3. Never Fail Silently
If AI generation fails, fallbacks ensure a usable (if basic) profile.  
Errors logged but don't block the system.

### 4. One Source of Truth
`business_brand_profile` table is the canonical source.  
All content generation reads from this table, not from raw data.

### 5. Change Detection
`version_hash` tracks source data changes.  
Skip regeneration if sources haven't changed (saves API costs).

### 6. Write-Once for Strategy
`content_strategy` is generated once and never overwritten.  
Preserves business-specific strategic decisions across regenerations.

---

## Testing the Endpoint

### cURL Example

```bash
curl -X POST "https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator" \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "YOUR_BUSINESS_UUID"
  }'
```

### Expected Response (Success)

```json
{
  "success": true,
  "profile": {
    "brand_essence": "...",
    "tone_of_voice": "...",
    "target_audience": "...",
    "core_offerings": "...",
    "content_focus": "...",
    "communication_goal": "...",
    "image_preferences": "...",
    "things_to_avoid": "...",
    "brand_essence_elaboration": "...",
    "quality_status": "green",
    "voice_confidence_score": 0.87
  },
  "metadata": {
    "version": "4.13.0",
    "generated_at": "2026-05-06T10:30:00Z",
    "stages_completed": ["B0", "A", "B", "B1", "B2", "B5", "CS"],
    "time_budget_used": "126s"
  }
}
```

### Expected Response (Error)

```json
{
  "success": false,
  "error": "Stage A timeout after 30s",
  "details": {
    "stage": "Prompt A (Internal Analysis)",
    "severity": "fatal",
    "recovery_attempted": false
  }
}
```

---

## Common Issues & Solutions

### Issue 1: Profile Generation Times Out
**Cause:** Large menu or website data  
**Solution:** Reduced menu injection to 12 items max (v4.12.4)

### Issue 2: tone_model DB Constraint Violation
**Cause:** AI returned malformed tone_model JSONB  
**Solution:** Added sanitizeToneModelForDb() (v4.7.3)

### Issue 3: Generic Brand Essence ("god kvalitet")
**Cause:** Insufficient Tier 1 data  
**Solution:** Fallback system kicks in + warning logged

### Issue 4: Profile Not Updating After Source Changes
**Cause:** version_hash unchanged  
**Solution:** Force regeneration by deleting existing profile or changing data

---

## Complexity Reduction Roadmap

**Status:** Proposed (May 6, 2026)  
**Goal:** Reduce system complexity by 40% while maintaining or improving output quality  
**Principle:** More fields ≠ Better quality. Ruthlessly cut to the minimal set that drives quality.

### Current State

**Complexity Metrics (After Sprint 1):**
- 74 database columns (reduced from 77)
- 13 voice-related fields (Sprint 2 will reduce to 5)
- 5 AI stages (B0, A, B, B2, B5, CS) — removed B1
- ~135s generation time (reduced from ~150s)
- 9 core variables + 18 enrichment fields

**Problem:** Additive complexity disease. Every quality problem resulted in adding a new field, not improving existing ones. Most enrichment fields are unused or create noise.

---

### Phase 1: Remove Pure Waste (Sprint 1) ✅ **COMPLETE**

**Impact:** -15s processing, -3 DB columns, simpler UX

#### 1.1 Cut Stage B1 (Voice Archetypes) ✅ **DEPLOYED**

**Current State:**
- Generates 2 bespoke archetypes (recommended + alternative)
- Adds 15s processing time
- Stores in `voice_options` JSONB, `voice_archetype` text
- Creates UX decision point: owner must choose between archetypes

**Problem:**
- "Recommended" archetype always wins (>95% selection rate)
- Owner doesn't understand the choice ("Authentic Storyteller" vs "Warm Community Builder")
- Owner should choose competitive position, not tone archetype
- If AI is good enough, there should be ONE correct voice

**Action:**
- ✅ Removed Stage B1 generation
- ✅ Removed `voice_options` column (JSONB)
- ✅ Removed `voice_archetype` column (text)
- ✅ Removed archetype selection UI
- ✅ Generate THE voice (opinionated, not optional)
- ✅ If owner dislikes it, they regenerate or manually edit

**Savings:** 15s, 2 columns, simpler onboarding

**Status:** ✅ DEPLOYED (May 6, 2026)

---

#### 1.2 Consolidate Audience Intelligence ✅ **DEPLOYED**

**Previous State:**
- `audience_segments` (Stage B5) - 3-6 segments with timing_windows + content_angles
- `audience_framework` - Abstract multi-dimensional representation
- Both stored in separate JSONB columns
- Neither fully informs Phase 1 weekly strategy

**Problem:**
- Two structures solving the same problem
- `audience_framework` is unused in content generation
- `audience_segments` has actionable data (timing, angles) but underutilized
- Confusing dual representation

**Action:**
- ✅ Kept `audience_segments` (has timing_windows, content_angles)
- ✅ Removed `audience_framework` column
- ✅ Updated get-quick-suggestions to use segments only
- ✅ Updated get-weekly-strategy to extract programmes from segments
- ✅ Updated generate-weekly-plan to remove framework from snapshots

**Savings:** 1 column, clearer data model

**Status:** ✅ DEPLOYED (May 6, 2026)

**Note:** Phase 1 (weekly strategy) already consumed `audience_segments`. The framework was redundant abstract representation.

---

### Phase 2: Voice Enrichment Reduction (Sprint 2)

**Impact:** -20s processing, -8 DB columns, -500 prompt tokens

#### 2.1 The Voice Field Audit

**Current State (13 voice constructs):**

| Field | Type | Used By | Status |
|-------|------|---------|--------|
| `tone_of_voice` | text | Phase 1, captions, Dagens Forslag | ✅ **KEEP** |
| `tone_model.good_examples` | jsonb | Caption generation | ✅ **KEEP** |
| `never_say` | text[] | All content generation | ✅ **KEEP** |
| `voice_constraints` | text | Phase 1, captions | ✅ **KEEP** |
| `signature_phrases` | text[] | All content generation | ✅ **KEEP** |
| `voice_rationale` | text | **Owner UI, transparency, quality review** | ✅ **KEEP** |
| `typical_openings` | text[] | Unused | ❌ **CUT** |
| `typical_closings` | text[] | Unused | ❌ **CUT** |
| `voice_examples` | jsonb | Duplicates tone_model | ❌ **CUT** |
| `tone_keywords` | text[] | Unused | ❌ **CUT** |
| `recognizable_interior_identity` | text | Image preferences, not voice | ❌ **CUT** |
| `venue_scene` | text | Image preferences, not voice | ❌ **CUT** |
| `visual_character` | text | Image preferences, not voice | ❌ **CUT** |

**Action:**
- ✅ Keep 6 core voice fields (tone_of_voice, tone_model.good_examples, never_say, voice_constraints, signature_phrases, voice_rationale)
- ❌ Cut 7 redundant/unused fields
- ✅ Move `recognizable_interior_identity`, `venue_scene`, `visual_character` to image_preferences context (or cut entirely)

**Result:** 13 → 6 voice fields (54% reduction)

**Rationale Change:** Initially planned to cut `voice_rationale` as "metadata only", but transparency requires AI to explain WHY it made voice decisions. Owner needs to understand reasoning to trust and refine the profile.

---

#### 2.2 Why These 6?

**1. `tone_of_voice` (narrative rules)**
- **Used by:** Phase 1, caption generation, Dagens Forslag
- **Value:** Provides human-readable writing rules
- **Format:** STEMME-MEKANIK + STEMME-IDENTITET + Eksempel
- **Cannot be replaced by:** Other fields lack narrative context

**2. `tone_model.good_examples` (style anchor)**
- **Used by:** Caption generation
- **Value:** Concrete examples of correct voice
- **Format:** 2-3 sentences showing the voice in action
- **Cannot be replaced by:** Rules without examples = abstract, examples without rules = inconsistent

**3. `never_say` (constraint)**
- **Used by:** All content generation
- **Value:** Hard constraints prevent brand-damaging language
- **Format:** Array of banned words/phrases
- **Cannot be replaced by:** Negative examples don't create hard blocks

**4. `voice_constraints` (principle)**
- **Used by:** Phase 1, caption generation
- **Value:** Explicit rules (e.g., "never use emojis", "always include price")
- **Format:** Bullet list of must/never rules
- **Cannot be replaced by:** Tone rules are stylistic, constraints are absolute

**5. `signature_phrases` (brand differentiation)**
- **Used by:** All content generation
- **Value:** Brand-specific language that creates consistency (e.g., "hos os i kvarteret")
- **Format:** Array of phrases to weave in naturally
- **Cannot be replaced by:** Without this, all businesses sound generic

**6. `voice_rationale` (transparency & quality)**
- **Used by:** Owner UI, manual review, quality debugging
- **Value:** AI explains WHY it chose this voice (grounding evidence)
- **Format:** 2-3 sentences explaining voice derivation
- **Example:** "Tone er afslappet baseret på website-sprog ('kom forbi', 'hyggelig') og menukort-stil (ingen fine dining-termer). Nærværende fordi café ligger i boligkvarter."
- **Cannot be replaced by:** Without reasoning, owner can't evaluate if AI understood the business correctly
- **Critical for:** Trust, manual refinement, debugging hallucinations

**What gets cut:**
- `typical_openings`/`typical_closings` — Cache duplication of tone_of_voice examples (auto-extracted from tone_of_voice "Eksempel:" lines)
- `voice_examples` — Duplicates tone_model.good_examples
- `tone_keywords` — Unused quick-reference tags
- `recognizable_interior_identity`/`venue_scene`/`visual_character` — Image context, not voice

**Why keep voice_rationale (reversal from initial plan):**
- **Problem:** Owner sees AI-generated voice but has no idea WHY AI chose it
- **Risk:** If AI misunderstood the business, owner can't detect it without reasoning
- **Solution:** voice_rationale surfaces AI's evidence trail ("I chose casual tone because website uses 'kom forbi' not 'besøg os'")
- **Quality gate:** If rationale is weak/generic, it signals voice may be wrong
- **Owner trust:** Transparency builds confidence in AI decisions

---

### Phase 3: Strategic Anchor Reliability (Sprint 3)

**Impact:** -10s processing, +reliability, -hallucination risk

#### 3.1 Make brand_essence_elaboration Deterministic

**Current State:**
- AI-generated 2-3 sentence strategic anchor
- Injected into EVERY Phase 1 run as PERSONALITY ANCHOR block
- Auto-generated, auto-injected, never verified by owner
- When wrong or generic, poisons all downstream content

**The Café Faust Problem:**
```
AI-generated (abstract):
"En café der skaber hygge og samvær i hjertet af Nyhavn. 
Vi tilbyder autentiske oplevelser i en varm atmosfære."

Result: Generic weekly strategies → generic captions
```

**Problem:**
- This field is too critical to weekly strategy quality to be unverified
- AI hallucinations at this level cascade through all content
- No owner review before it becomes "source of truth"

**Options:**

**Option A: Remove from Phase 1 entirely**
- Pro: Can't poison output
- Con: Weekly strategy loses anchor → different kind of generic
- Risk: HIGH

**Option B: Make optional/supplementary**
- Pro: Safer fallback
- Con: When to use vs. not use? Unclear decision logic
- Risk: MEDIUM

**Option C: Gate behind owner approval** ⚠️
- Pro: Only verified data enters Phase 1
- Con: Adds onboarding friction
- Risk: LOW but may reduce activation

**Option D: Make deterministic (template-based)** ⭐ **RECOMMENDED**
- Pro: Predictable, grounded, never hallucinates
- Con: Less eloquent, more mechanical
- Risk: LOW — quality floor rises, ceiling falls

**Recommended Action (Option D):**

Replace AI generation with deterministic template:

```typescript
function buildBrandEssenceElaboration(business, profile, location, offerings) {
  const parts = []
  
  // Part 1: What + Where (factual anchor)
  parts.push(
    `${business.business_name} er en ${business.establishment_type} ` +
    `i ${location.neighborhood || location.city}.`
  )
  
  // Part 2: Offerings (menu-grounded)
  if (offerings.meal_anchors?.length > 0) {
    parts.push(`Vi serverer ${offerings.meal_anchors.join(', ')}.`)
  }
  
  // Part 3: Audience (profile-grounded)
  if (profile.target_audience) {
    parts.push(`Vores gæster er ${profile.target_audience}.`)
  }
  
  return parts.join(' ')
}
```

**Example Output:**
```
"Café Faust er en café i Nyhavn, København. 
Vi serverer brunch, frokost, og kaffe. 
Vores gæster er lokale beboere og turister der søger autentisk stemning."
```

**Characteristics:**
- ✅ Boring but accurate
- ✅ Never hallucinates
- ✅ Grounded in Tier 1 data
- ✅ Owner can manually edit if they want more personality
- ❌ Less eloquent than good AI output
- ❌ More mechanical than bad AI output

**Trade-off:** Quality ceiling drops (loses eloquence), quality floor rises (never generic/wrong).

**Impact:** Removes 1 AI call (~10s), eliminates hallucination risk, predictable output.

---

### Phase 4: Future Considerations

#### 4.1 Content Strategy Write-Once Protection

**Current State:**
- `content_strategy` is write-once (never overwritten on regen)
- Preserves business-specific strategic decisions
- But if initial decisions are bad, they're permanently frozen

**Question:** Should there be a way to regenerate strategy while preserving voice?

**Options:**
- Add `regenerate_strategy` flag (recompute goal_split, category_weights)
- Add strategy version tracking (allow rollback)
- Add owner approval before write-once lock

**Status:** Not included in current roadmap, but worth discussing.

---

#### 4.2 Commercial Strategy Complexity

**Not mentioned in original proposal, but worth reviewing:**

**Current State:**
- Stage CS generates commercial strategy
- Outputs: `content_strategy` JSONB, `commercial_baseline_mode`, `trigger_configuration`, `commercial_strategy_reasoning`
- Determines goal_mode split (footfall/brand/loyalty %)

**Questions:**
1. Is `content_strategy` actually consumed coherently in Phase 1?
2. Is `trigger_configuration` used in content generation?
3. Is `commercial_strategy_reasoning` just metadata?
4. Can this be simplified or made deterministic?

**Status:** Needs separate audit. Not cutting yet, but flagged for review.

---

### Summary: The Reduced System

**After all phases:**

**Database Columns:** 77 → 67 (-10 columns, -13%)

**Voice Fields:** 13 → 6 (-7 fields, -54%)

**AI Stages:** 6 → 5 (removed B1) ✅ COMPLETE

**Generation Time:** ~150s → ~90s (-60s, -40%)

**Current Progress (Sprint 1 Complete):**
- Database Columns: 77 → 74 (-3, -4%)
- AI Stages: 6 → 5 (-1, -17%)
- Generation Time: ~150s → ~135s (-15s, -10%)

**Prompt Complexity:** -30% tokens

**Failure Modes:** -40% (fewer AI calls, fewer fields to validate)

**Core Variables:** Still 9 (unchanged)

**Quality Impact:**
- Voice: Same or better (cuts noise, keeps signal)
- Strategy: Higher floor, lower ceiling (deterministic anchor = reliable but mechanical)
- Audience: Same (segments still generated, framework removed)
- UX: Simpler (no archetype choice)

---

### Implementation Order

**Sprint 1 (Low Risk, High Impact) ✅ COMPLETE:**
1. ✅ Cut Stage B1 (voice archetypes)
2. ✅ Remove `audience_framework`
3. ✅ Remove `voice_options`, `voice_archetype` columns
4. ✅ Update UI to remove archetype selection
5. ✅ Database migration deployed
6. ✅ Documentation updated

**Sprint 2 (Medium Risk, High Impact):**
1. Cut 8 voice enrichment fields
2. Update content generation to use only 5 core voice fields
3. Test caption quality doesn't degrade
4. Remove unused columns from DB

**Sprint 3 (Careful Testing Required):**
1. Replace AI-generated `brand_essence_elaboration` with deterministic template
2. Test Phase 1 quality with mechanical anchor vs AI anchor
3. Add owner edit capability for manual refinement
4. Monitor for quality regression

**Sprint 4 (Audit & Review):**
1. Audit `content_strategy` usage in Phase 1
2. Review `trigger_configuration` consumption
3. Consider strategy regeneration mechanism
4. Document any remaining complexity that's justified

---

### Success Metrics

**Performance:**
- [ ] Generation time < 100s (currently ~150s)
- [ ] Timeout rate < 2% (currently ~5%)
- [ ] Fallback trigger rate < 10%

**Quality:**
- [ ] Caption specificity score unchanged or improved
- [ ] Generic phrase detection rate unchanged or lower
- [ ] Owner satisfaction score ≥ current baseline

**Reliability:**
- [ ] DB constraint violations = 0
- [ ] Fatal error rate < 1%
- [ ] Hallucination rate lower (esp. brand_essence_elaboration)

**Simplicity:**
- [ ] DB columns reduced by 10+
- [ ] Voice fields reduced to ≤ 6 (with reasoning transparency)
- [ ] Owner onboarding steps reduced by 1 (no archetype choice)

**Transparency:**
- [ ] voice_rationale populated for 100% of profiles
- [ ] Rationale explains voice derivation evidence (website signals, menu style, location context)
- [ ] Owner can verify AI understood business correctly

---

## Next Steps / Roadmap

### Complexity Reduction (Prioritized)
- [x] **Sprint 1:** Cut Stage B1 + consolidate audience ✅ DEPLOYED (May 6, 2026)
- [ ] **Sprint 2:** Voice enrichment reduction (2 weeks) — 🔜 NEXT
- [ ] **Sprint 3:** Deterministic brand_essence_elaboration (2 weeks + testing)
- [ ] **Sprint 4:** Content strategy audit (1 week)

### Future Features (Post-Reduction)
- [ ] Image analysis integration (Tier 1 data from uploaded photos)
- [ ] Social post scraping (Tier 2 supporting evidence)
- [ ] Multi-language support (English, Swedish, Norwegian)
- [ ] Owner review/approval workflow
- [ ] ~~A/B testing for voice archetypes~~ (CANCELLED - removing archetypes entirely)

### Known Limitations
- `do_not_say` JSONB column never populated (use `never_say` array instead)
- `post_length_guidelines` referenced in code but missing in DB schema
- Social post analysis not yet active
- Image content analysis not yet active
- **NEW:** `content_strategy` write-once protection may freeze bad initial decisions

---

## Related Documentation

- [BRAND-PROFILE-REFACTORING-2025-01.md](BRAND-PROFILE-REFACTORING-2025-01.md) - Refactoring history
- [AI-COMMERCIAL-STRATEGY-IMPLEMENTATION.md](AI-COMMERCIAL-STRATEGY-IMPLEMENTATION.md) - Stage CS details
- [AUDIENCE-VOICE-IMPLEMENTATION-SUMMARY.md](AUDIENCE-VOICE-IMPLEMENTATION-SUMMARY.md) - Voice system
- [DATABASE-COMPLETE-MAPPING.md](DATABASE-COMPLETE-MAPPING.md) - Full DB schema
- [PHASE1-DEPLOYMENT-GUIDE.md](PHASE1-DEPLOYMENT-GUIDE.md) - Weekly strategy integration

---

## Support & Contact

**Function:** `brand-profile-generator`  
**Version:** v4.13.0  
**Last Updated:** May 6, 2026  
**Maintained by:** Post2Go AI Team
