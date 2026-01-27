# AI System Architecture
**Post2Go AI Content Generation System**

Last Updated: January 8, 2026  
Version: Brand Profile v4.7.1, Post Generator v1.0

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Core Components](#core-components)
3. [Brand Profile System](#brand-profile-system)
4. [Post Generation System](#post-generation-system)
5. [Shared Infrastructure](#shared-infrastructure)
6. [Data Flow](#data-flow)
7. [Performance & Optimization](#performance--optimization)
8. [Roadmap](#roadmap)

---

## System Overview

### Architecture Philosophy

**Stable Core + Dynamic Context**

The system is built on two fundamental principles:

1. **Brand Profile** = Stable, expensive-to-generate "DNA" that understands the business
   - Generated once, cached, rarely regenerated
   - Hash-based change detection (skip regeneration if source data unchanged)
   - ~80-90% cost savings through intelligent caching

2. **Runtime Generation** = Fast, context-aware content creation using Brand Profile
   - In-memory Brand Profile caching (1 hour TTL)
   - Dynamic context: time, season, weather, events
   - ~1.5-3s response time for post ideas, enhancements, shot suggestions

### Key Metrics

| Component | Generation Time | Cost per Call | Cache Hit Rate | Status |
|-----------|----------------|---------------|----------------|--------|
| Brand Profile (cold) | ~130s (2 prompts) | ~$0.10 | n/a | ✅ v4.7.1 |
| Brand Profile (skip) | ~200ms | ~$0.00 | 80-90% | ✅ v4.7.1 |
| Post Ideas | ~1.5-2.5s | ~$0.01 | 90%+ (cached profile) | ✅ v1.0 |
| Text Enhancement | ~1.5-2s | ~$0.01 | 90%+ (cached profile) | 🔜 Planned |
| Shot Ideas | ~2-3s | ~$0.01 | 90%+ (cached profile) | 🔜 Planned |

---

## Core Components

### 1. Brand Profile Generator
**Path:** `supabase/functions/brand-profile-generator/`

**Purpose:** Generate comprehensive brand identity DNA from business data

**Input Sources:**
- Business profile (name, description, category)
- Website analysis (scraped content, copy patterns)
- Menu items (categories + signature items only)
- Location enrichment (area type, city characteristics)
- Images (uploaded photos)

**Output:**
```typescript
{
  brand_essence: string,           // "Café ved åen i Aarhus hvor pariserbøf kan nydes..."
  tone_of_voice: string,            // Structured rules + examples
  content_focus: {
    primary_themes: string[],       // ["mad og drikke", "stemning"]
    usage_occasions: string[],      // ["brunch", "frokost", "aften"]
    content_triggers: string[]      // ["weekend", "solskin", "kold dag"]
  },
  voice_examples: {
    must_use_phrases: string[],     // ["BOOK DIT BORD", "Café Faust"]
    things_to_avoid: string[],      // ["generic marketing-sprog"]
    hook_patterns: string[]         // ["Start med brunch, bliv til aften"]
  },
  image_preferences: {
    signature_shot: string,         // Core visual identity
    signature_shot_reasoning: string
  },
  social_style: {
    caption_style: string,
    must_use_phrases: string[]      // Platform-specific CTAs
  }
}
```

**Version:** v4.7.1
- Menu data optimized (business type summary only)
- Timeout increased to 60s
- Quality status tracking (green/yellow/red)
- Template fallback system for missing fields

**Performance:**
- First generation: ~130s (Prompt A + Prompt B)
- Subsequent unchanged: ~200ms (hash-based skip)
- Success rate: >95% (after v4.7.1 timeout fix)

---

### 2. Hash-Based Change Detection
**Path:** `supabase/functions/_shared/brand-profile/hashing.ts`

**Purpose:** Skip expensive Brand Profile regeneration when source data unchanged

**How It Works:**
1. Compute SHA-256 hash for each source:
   - `business_snapshot_hash` (name, description, category, offerings)
   - `website_hash` (content, copy patterns, CTAs)
   - `menu_hash` (structure: categories + items, NO prices)
   - `location_hash` (address, city, enrichment data)
   - `images_hash` (uploaded image URLs)

2. Combine into single `version_hash`

3. Compare with stored hash:
   - Match → Skip regeneration (~200ms response)
   - Changed → Full regeneration (~130s)

**Database:**
```sql
-- Table: brand_profile_sources_state
business_id UUID PRIMARY KEY
business_snapshot_hash TEXT
website_hash TEXT
menu_hash TEXT
location_hash TEXT
images_hash TEXT
version_hash TEXT NOT NULL  -- Combined hash
updated_at TIMESTAMPTZ
```

**Example Log:**
```
🔐 Computing content hashes...
🔍 Checking if regeneration needed...
✅ Brand Profile unchanged (version_hash match), skipping regeneration
```

---

### 3. Post Idea Generator
**Path:** `supabase/functions/post-idea-generator/`

**Purpose:** Generate contextual post ideas using cached Brand Profile + dynamic context

**Status:** ✅ Deployed v1.0 (132kB)  
**Maturity:** ⚠️ Early stage, needs refinement

**Input:**
```typescript
{
  businessId: string,
  userInput?: string  // Optional context ("fokus på brunch", "solskin i dag")
}
```

**Output:**
```typescript
{
  ideas: [
    {
      hook: string,              // "Start med brunch, bliv til middag"
      caption: string,           // Full caption with CTA
      photoSuggestion: {
        scene: string,
        timing: string,          // "Golden hour (16:00-18:00)"
        action: string
      },
      suggestedPostTime: string  // "I dag kl. 11:00-13:00"
    }
    // ... 3 ideas total (configurable)
  ],
  context: {
    timeOfDay: string,    // "afternoon"
    season: string,       // "winter"
    isWeekend: boolean,
    weather: null         // ⚠️ NOT IMPLEMENTED YET
  }
}
```

**Architecture:**
```typescript
// In-memory Brand Profile cache (1 hour TTL)
const brandProfileCache = new Map<string, CachedProfile>()

// Load flow:
1. Check cache → Hit: ~50ms, Miss: ~200ms
2. Gather dynamic context (time, season, weekend)
3. Build prompt combining Brand Profile + context
4. Generate 3 post ideas via GPT-4o (~1.5s)
5. Return structured output
```

**Performance:**
- Cached profile: ~1.5-2.0s total
- Uncached profile: ~2.0-2.5s total
- Cache hit rate: 90%+ (1 hour TTL)

**Current Limitations:**
- No weather integration (placeholder exists)
- Only 3 ideas per call (not configurable yet)
- No reel/video-specific ideas
- No historical performance data used

---

### 4. Shared Infrastructure

#### OpenAI Client
**Path:** `supabase/functions/_shared/brand-profile/openai-client.ts`

**Configuration:**
```typescript
{
  model: "gpt-4o-2024-11-20",
  timeout: 60000,              // 60 seconds (increased from 45s in v4.7.1)
  maxRetries: 3,
  retryDelayMs: 1000,          // Exponential backoff
  retryStatusCodes: [429, 500, 502, 503, 504]
}
```

**Features:**
- Automatic retry with exponential backoff
- Timeout protection (AbortController)
- JSON mode for structured output
- Request/response logging

#### Data Gatherer
**Path:** `supabase/functions/_shared/brand-profile/data-gatherer.ts`

**Functions:**
- `gatherBusinessData()` - Load business profile
- `gatherWebsiteData()` - Load website analysis
- `gatherMenuData()` - Load menu (optimized)
- `gatherLocationData()` - Load + enrich location
- `gatherImageData()` - Load uploaded images

**Menu Optimization (v4.7.1):**
```typescript
// OLD: Send 15 full items with descriptions + prices
buildMenuSummary(menu, 15)

// NEW: Business type summary only
buildMenuTypeSummary(menu)
// Output: "Categories: Morgenmad, Frokost, Aften | 
//          Total: 77 items | 
//          Signature: PARISERBØF, HERREGÅRDSBØF, BØF & BEARNAISE"
```

**Rationale:** Menu structure rarely changes; prices/descriptions shouldn't trigger Brand Profile regeneration.

#### Locale System
**Path:** `supabase/functions/_shared/brand-profile/locale/`

**Structure:**
```
locale/
├── index.ts           // resolveLocale(country, city, language)
├── da-DK.ts           // Danish fallback templates
├── da-DK-aarhus.ts    // Aarhus-specific phrases
└── da-DK-copenhagen.ts
```

**Features:**
- City-specific locale detection (`da-DK-aarhus`)
- Fallback templates for missing AI output
- Generic phrase library ("ved åen", "i hjertet af", "få minutters gang")
- Pure Danish output (no English mixing)

**Example:**
```typescript
resolveLocale("Danmark", "Aarhus", "da")
// Returns: { code: "da-DK-aarhus", fallback: "da-DK", city: "aarhus" }
```

---

## Brand Profile System

### Generation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. GATHER DATA                                                  │
│    - Business profile, website, menu, location, images         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. COMPUTE HASHES                                               │
│    - SHA-256 per source → version_hash                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. CHECK IF REGENERATION NEEDED                                 │
│    - Compare version_hash with stored hash                      │
│    - Match? → Return existing profile (~200ms)                  │
│    - Changed? → Continue to generation                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. PROMPT A - INTERNAL ANALYSIS (~45-55s)                       │
│    - Extract hooks, patterns, must-use phrases                  │
│    - Evidence-based extraction (must quote source)              │
│    - Repair if contract violations                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. FALLBACK FILL                                                │
│    - Fill empty must_use_phrases with concrete anchors          │
│    - Ensure all sections have minimum required data             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. PROMPT B - BRAND PROFILE GENERATION (~15-20s)                │
│    - Generate tone_of_voice, brand_essence, etc.                │
│    - Use Prompt A output as input                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. VALIDATION & REPAIR                                          │
│    - Check all required fields                                  │
│    - Apply template fallbacks if missing/invalid                │
│    - Calculate quality status (green/yellow/red)                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. SAVE TO DATABASE                                             │
│    - business_brand_profile (with version_hash)                 │
│    - brand_profile_sources_state (all hashes)                   │
│    - quality_status + generation_errors                         │
└─────────────────────────────────────────────────────────────────┘
```

### Quality Status System

**Green (✅ Klar):**
- 0 critical errors
- 0 high errors
- 0-2 medium errors
- Any number of low errors

**Yellow (⚠️ Kan forbedres):**
- 0 critical errors
- 0 high errors
- 3+ medium errors

**Red (❌ Kræver handling):**
- 1+ critical errors OR 1+ high errors

**Stored in Database:**
```typescript
{
  quality_status: "green" | "yellow" | "red",
  generation_errors: {
    critical: [],
    high: [],
    medium: [
      "tone_of_voice missing distinctive hook",
      "brand_essence must include location cue"
    ],
    low: []
  }
}
```

### Validation Rules

**Critical Errors:**
- Missing required fields (brand_essence, tone_of_voice)
- Invalid JSON structure
- Locale resolution failure

**High Errors:**
- Generic language without distinctive hooks
- No must-use phrases filled
- Content too narrow (< 3 focus areas)

**Medium Errors:**
- Missing location cue in brand_essence
- Missing hook in tone_of_voice
- Signature shot missing action/location

**Low Errors:**
- Differentiation warnings (ignored if flag set)
- Optional field recommendations

---

## Post Generation System

### Architecture

```
┌───────────────────────────────────────────────────────────────┐
│ CLIENT REQUEST                                                │
│ POST /functions/v1/post-idea-generator                        │
│ { businessId, userInput? }                                    │
└───────────────────────────────────────────────────────────────┘
                            ↓
┌───────────────────────────────────────────────────────────────┐
│ 1. LOAD BRAND PROFILE (cached)                                │
│    Cache hit: ~50ms | Cache miss: ~200ms                      │
│    TTL: 1 hour                                                │
└───────────────────────────────────────────────────────────────┘
                            ↓
┌───────────────────────────────────────────────────────────────┐
│ 2. GATHER DYNAMIC CONTEXT                                     │
│    - Time of day: morning/afternoon/evening/night             │
│    - Season: spring/summer/autumn/winter                      │
│    - Weekend: boolean                                         │
│    - Weather: ⚠️ NOT IMPLEMENTED (returns null)               │
└───────────────────────────────────────────────────────────────┘
                            ↓
┌───────────────────────────────────────────────────────────────┐
│ 3. BUILD POST GENERATION PROMPT                               │
│    Combines:                                                  │
│    - Brand Profile (tone, style, must-use phrases)            │
│    - Dynamic context (time, season, weather)                  │
│    - User input (optional focus/angle)                        │
│    - Usage occasions from Brand Profile                       │
└───────────────────────────────────────────────────────────────┘
                            ↓
┌───────────────────────────────────────────────────────────────┐
│ 4. GENERATE POST IDEAS (GPT-4o)                               │
│    ~1.5s for 3 ideas                                          │
│    JSON mode: structured output                               │
└───────────────────────────────────────────────────────────────┘
                            ↓
┌───────────────────────────────────────────────────────────────┐
│ 5. RETURN STRUCTURED IDEAS                                    │
│    - 3 post ideas with hook, caption, photo, timing           │
│    - Context metadata                                         │
│    - Total time: ~1.5-2.5s                                    │
└───────────────────────────────────────────────────────────────┘
```

### Dynamic Context

**Currently Implemented:**

```typescript
{
  timeOfDay: "morning" | "afternoon" | "evening" | "night",
  season: "spring" | "summer" | "autumn" | "winter",
  isWeekend: boolean,
  
  // Contextual angles based on time/season
  contextualAngles: [
    "brunch angle",      // morning + weekend
    "outdoor seating",   // sunny + summer
    "cozy evening"       // evening + autumn/winter
  ]
}
```

**Not Implemented:**
- ⚠️ Weather API (high priority)
- ⚠️ Local events
- ⚠️ Historical performance data
- ⚠️ Recent posts analysis (avoid repetition)

---

## Data Flow

### Brand Profile Generation Data Flow

```
business_profile (table)
website_analysis (table)
menu_extractions (table)
business_locations (table)
business_images (table)
         ↓
    [Data Gatherer]
         ↓
    [Hash Computer] → brand_profile_sources_state (table)
         ↓
    [Skip Check] ←─── version_hash comparison
         ↓
    [Prompt A: Analysis]
         ↓
    [Fallback Fill]
         ↓
    [Prompt B: Generation]
         ↓
    [Validation + Repair]
         ↓
business_brand_profile (table) + quality_status
```

### Post Generation Data Flow

```
POST /post-idea-generator
         ↓
    [Cache Check] ←─── brandProfileCache (in-memory)
         ↓
business_brand_profile (table)
         ↓
    [Context Gatherer]
    - Time/season from system
    - Weather from API ⚠️ (planned)
         ↓
    [Prompt Builder]
    - Brand Profile DNA
    - Dynamic context
    - User input
         ↓
    [GPT-4o Generation]
         ↓
    [Return 3 Ideas]
```

---

## Performance & Optimization

### Optimization Strategies

**1. Hash-Based Skip Logic (v4.7)**
- **Problem:** Every API call regenerated Brand Profile (~$0.10, 130s)
- **Solution:** SHA-256 hashing of all sources, skip if unchanged
- **Result:** 80-90% cost reduction, ~200ms for unchanged profiles

**2. Menu Data Optimization (v4.7.1)**
- **Problem:** 77 menu items with descriptions caused Prompt A timeouts (2/3 attempts)
- **Solution:** Reduce to business type summary (categories + 5 signature items)
- **Result:** ~40% smaller Prompt A input, single-attempt success

**3. Timeout Increase (v4.7.1)**
- **Problem:** 45s timeout too tight (legitimate responses took 43s)
- **Solution:** Increase to 60s
- **Result:** No timeouts, ~33% more buffer

**4. In-Memory Profile Caching (v1.0)**
- **Problem:** Every post generation call loaded profile from DB (~200ms)
- **Solution:** In-memory Map with 1hr TTL
- **Result:** ~50ms cached loads, 90%+ hit rate

### Performance Metrics

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Brand Profile (unchanged) | 130s | 0.2s | 650x faster |
| Brand Profile (changed) | 130s | 130s | Same (necessary) |
| Prompt A timeout rate | 67% | 0% | Fixed |
| Post generation (cached) | 2.2s | 1.5s | 1.5x faster |

### Cost Analysis

**Brand Profile Generation:**
- Prompt A: ~$0.06 (input: 5K tokens, output: 2K tokens)
- Prompt B: ~$0.04 (input: 3K tokens, output: 1.5K tokens)
- Total per generation: ~$0.10

**With 80% skip rate:**
- 100 API calls: 20 generations × $0.10 = $2.00
- Without hashing: 100 generations × $0.10 = $10.00
- **Savings: $8.00 per 100 calls (80%)**

**Post Generation:**
- Per call: ~$0.01 (input: 2K tokens, output: 500 tokens)
- 1000 calls/month: ~$10.00

---

## Roadmap

### ✅ Completed

**v4.2-v4.6: Foundation**
- Language consistency fixes (pure Danish)
- Quality status tracking (green/yellow/red)
- Template fallback system
- Locale system with city-specific phrases

**v4.7: Hash System**
- SHA-256 content hashing per source
- version_hash for single source of truth
- Skip regeneration logic
- brand_profile_sources_state table

**v4.7.1: Performance Optimization**
- Menu data reduced to business type summary
- Timeout increased 45s → 60s
- Prompt A timeout fix (0% failure rate)

**v1.0: Post Idea Generator**
- In-memory Brand Profile caching
- Dynamic context (time/season/weekend)
- 3 post ideas with photo suggestions
- Deployed and functional

### 🔄 Current Priority

**Weather API Integration** 🔴 HIGH PRIORITY
- **Scope:** Not just same-day, but up to 1 week ahead
- **Use cases:**
  - Post ideas: "☀️ Solskin på fredag → plan udeservering post"
  - Shot ideas: "Regn i morgen → cozy interior shots"
  - Best time: "Varmt weekend → post torsdag for weekend booking"
- **API:** OpenWeatherMap (free tier: 1000 calls/day, 7-day forecast)
- **Implementation:** `_shared/post-helpers/weather.ts`
- **Caching:** 1 hour (weather doesn't change fast)

**Post Idea Generator Refinement** 🟡 MEDIUM PRIORITY
- Currently "not at the stage where it should be"
- Areas for improvement:
  - More sophisticated prompt engineering
  - Better contextual angle detection
  - Reel/video-specific ideas
  - Configurable number of ideas (currently hardcoded to 3)
  - Better photo suggestions (more specific to Brand Profile)

### 🔜 Planned

**Phase 2.1: Core Content Tools**
1. **Weather Integration** (started above)
   - 7-day forecast support
   - Weather-based content triggers
   - Integration with post ideas + shot ideas

2. **Post Idea Generator v1.1**
   - Incorporate weather forecasts
   - Configurable idea count (3-15)
   - Reel/video-specific generation
   - Better photo suggestions

3. **Shot Ideas Generator**
   - Photo/Reel/Video shot suggestions
   - Based on Brand Profile signature_shot
   - Weather-aware (sunny → outdoor, rainy → interior)
   - Time-of-day lighting suggestions
   - Runtime generation (no schema changes)

**Phase 2.2: Timing & Performance**
4. **Best Time to Post (Rule-Based)**
   - Simple heuristics by business type
   - Platform-specific timing (Instagram vs Facebook)
   - Weekend vs weekday
   - Weather-aware (sunny → post morning before, rainy → post day-of)

5. **Performance Tracking Table**
   - Start collecting data for ML later
   - Track: posted_at, platform, engagement_score, reach
   - Enable data-driven timing in Phase 3

**Phase 2.3: Enhancement Tools**
6. **Enhance Post Text**
   - Input: user draft + platform + goal
   - Output: 1-3 improved variants
   - Uses Brand Profile tone rules + banned words
   - Compliance check (no banned words, consistent Danish)

### 🔮 Future (Phase 3+)

**Data-Driven Timing**
- ML-based best time to post
- Historical performance analysis
- A/B testing system

**Advanced Context**
- Local events integration
- Recent posts analysis (avoid repetition)
- Competitor activity awareness

**Video/Reel Optimization**
- Brand Profile schema extension
- Video-specific tone guidance
- Reel hooks + patterns library

**Multi-Platform Optimization**
- Instagram: Short, emoji-heavy, hashtags
- Facebook: Longer storytelling, community questions
- LinkedIn: Professional tone, business insights

---

## Database Schema

### Core Tables

**business_brand_profile**
```sql
business_id UUID PRIMARY KEY
brand_essence TEXT
tone_of_voice TEXT
content_focus JSONB
voice_examples JSONB
image_preferences JSONB
social_style JSONB
quality_status TEXT  -- "green" | "yellow" | "red"
generation_errors JSONB
version_hash TEXT    -- Current content hash
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

**brand_profile_sources_state**
```sql
business_id UUID PRIMARY KEY
business_snapshot_hash TEXT
website_hash TEXT
location_hash TEXT
images_hash TEXT
menu_hash TEXT
version_hash TEXT NOT NULL  -- Combined hash
updated_at TIMESTAMPTZ
```

### Planned Tables

**post_performance** (Phase 2.2)
```sql
id UUID PRIMARY KEY
business_id UUID REFERENCES businesses(id)
platform TEXT NOT NULL
posted_at TIMESTAMPTZ NOT NULL
post_type TEXT  -- "photo" | "reel" | "video" | "text"
caption_length INTEGER
engagement_score NUMERIC  -- (likes * 1) + (comments * 2) + (shares * 3)
reach INTEGER
weather_condition TEXT  -- "sunny" | "rainy" | "cloudy"
created_at TIMESTAMPTZ
```

**weather_cache** (Phase 2.1)
```sql
city TEXT PRIMARY KEY
forecast JSONB  -- 7-day forecast from API
fetched_at TIMESTAMPTZ
expires_at TIMESTAMPTZ  -- fetched_at + 1 hour
```

---

## Edge Functions

### Deployed Functions

| Function | Version | Size | Purpose | Status |
|----------|---------|------|---------|--------|
| `brand-profile-generator` | v4.7.1 | ~2.5MB | Generate Brand Profile | ✅ Production |
| `post-idea-generator` | v1.0 | 132kB | Generate post ideas | ✅ Production (early) |
| `ai-generate-v2` | - | - | Legacy/other AI generation | ✅ Production |

### Planned Functions

| Function | Priority | Size Est. | Purpose |
|----------|----------|-----------|---------|
| `weather-service` | 🔴 High | ~50kB | Weather API integration + caching |
| `shot-ideas-generator` | 🟡 Medium | ~100kB | Photo/Reel/Video shot suggestions |
| `enhance-post-text` | 🟢 Low | ~100kB | Improve user draft text (on hold) |
| `best-time-to-post` | 🟢 Low | ~80kB | Rule-based posting time suggestions |

---

## Development Notes

### Local Development

**Test Brand Profile Generation:**
```bash
cd /Users/olebaek/Test\ P2G\ 1
export VIGGO_BIZ_ID="82f7b70d-0a72-4888-8ba7-6dc1d34e8db8"

curl -X POST 'https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator' \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"businessId":"'$VIGGO_BIZ_ID'"}'
```

**Test Post Idea Generator:**
```bash
curl -X POST 'https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/post-idea-generator' \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"businessId":"'$VIGGO_BIZ_ID'","userInput":"fokus på brunch"}'
```

**Deploy Function:**
```bash
cd /Users/olebaek/Test\ P2G\ 1
npx supabase functions deploy <function-name>
```

### Monitoring

**Check Supabase Logs:**
- Go to Supabase Dashboard → Edge Functions → Logs
- Filter by function name
- Look for: timeouts, errors, performance metrics

**Key Log Patterns:**
```
✅ Brand Profile unchanged (version_hash match), skipping regeneration
🔄 Regeneration needed: Sources changed: website, menu
⏱️ Prompt A (Internal Analysis) timeout after 60000ms
✅ Complete in 130868ms
```

### Common Issues

**Prompt A Timeouts:**
- ✅ Fixed in v4.7.1 (menu optimization + 60s timeout)
- If recurring: Check menu data size, consider further reduction

**Generic Anchors Warning:**
```
⚠️ generic_anchor_risk=true (must_use_phrases are generic)
```
- Means must_use_phrases filled with fallbacks (business name only)
- Acceptable if no distinctive menu items found
- Yellow quality status (not critical)

**Hash System Not Skipping:**
- Check if source data actually changed (expected behavior)
- Verify version_hash exists in brand_profile_sources_state
- Look for "First time generation" log (no existing hash state)

---

## API Reference

### POST /brand-profile-generator

**Input:**
```json
{
  "businessId": "uuid"
}
```

**Output:**
```json
{
  "success": true,
  "message": "Brand profile generated successfully",
  "profileId": "uuid",
  "qualityStatus": "green",
  "generationTime": 130868,
  "cacheHit": false,
  "errors": []
}
```

**Status Codes:**
- 200: Success
- 400: Invalid businessId
- 500: Generation error

### POST /post-idea-generator

**Input:**
```json
{
  "businessId": "uuid",
  "userInput": "fokus på weekend brunch"  // Optional
}
```

**Output:**
```json
{
  "ideas": [
    {
      "hook": "Start med brunch, bliv til middag",
      "caption": "Nyd en rolig weekend ved åen i Aarhus. BOOK DIT BORD.",
      "photoSuggestion": {
        "scene": "Pariserbøf on table by window",
        "timing": "Golden hour (16:00-18:00)",
        "action": "Guest cutting into steak"
      },
      "suggestedPostTime": "I dag kl. 11:00-13:00"
    }
    // ... 2 more ideas
  ],
  "context": {
    "timeOfDay": "afternoon",
    "season": "winter",
    "isWeekend": true,
    "weather": null
  }
}
```

**Status Codes:**
- 200: Success
- 400: Invalid businessId
- 404: Brand Profile not found
- 500: Generation error

---

## Questions for Discussion

1. **Post Idea Generator Maturity**
   - What specific areas need improvement?
   - What's missing from current output?
   - Should we increase default idea count from 3 to 5?

2. **Weather API Integration**
   - Preference: OpenWeatherMap, WeatherAPI, or other?
   - How far ahead should we fetch? (current: up to 7 days)
   - What weather conditions matter most? (sunny, rainy, temperature, wind?)

3. **Shot Ideas Priority**
   - Should this come before or after weather integration?
   - Photo-only first, or include Reel/Video from start?

4. **Performance Tracking**
   - When should we start collecting post performance data?
   - What engagement metrics matter most? (likes, comments, shares, saves?)
   - Should we track manual vs AI-generated posts separately?

---

## Version History

**v4.7.1** (January 8, 2026)
- Menu data reduced to business type summary
- Timeout increased 45s → 60s
- Prompt A timeout fix (0% failure rate)

**v4.7** (January 7, 2026)
- Hash-based change detection system
- version_hash tracking
- brand_profile_sources_state table
- 80-90% cost reduction through skip logic

**v1.0 Post Generator** (January 7, 2026)
- Initial post idea generator deployed
- In-memory Brand Profile caching
- Dynamic context (time/season/weekend)
- 3 post ideas per call

**v4.6** (January 6, 2026)
- Quality status tracking (green/yellow/red)
- generation_errors JSONB field
- UI-ready error visibility

**v4.2-v4.5** (January 4-5, 2026)
- Language consistency fixes
- Country normalization
- Template fallback system
- Locale system with city-specific phrases

---

*Last Updated: January 8, 2026 by Ole Baek*
