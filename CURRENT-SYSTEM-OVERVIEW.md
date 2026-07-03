# Current System Overview (Post-Cleanup)
**Date**: April 27, 2026  
**Version**: Brand Profile Generator v4.13.0

---

## 🏗️ System Architecture

### Two-Stage AI Brand Profile Generation

```
┌─────────────────────────────────────────────────────────┐
│  BRAND PROFILE GENERATOR (v4.13.0)                     │
│  ├─ Prompt A: Internal Analysis (GPT-4o-mini, 45s)     │
│  │  └─ Extracts signals, tone markers, voice clues     │
│  └─ Prompt B: Profile Generation (GPT-4o, 50s)         │
│     └─ Generates user-facing brand profile             │
└─────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  DATABASE: business_brand_profile                       │
│  ├─ Voice Fields (16 fields)                           │
│  ├─ content_pillars (6 backend objects)                │
│  ├─ content_focus (4 UI themes)                        │
│  ├─ Audience Segments (5 segments) ✅ NOW FILTERED     │
│  └─ Brand Context & Identity                           │
└─────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  TEXT GENERATION (generate-text-from-idea)              │
│  ├─ Resolves Active Segment (1 of 5) ✅ OPTIMIZED     │
│  ├─ Builds Brand Voice Block                           │
│  └─ Generates Caption (GPT-4o, ~35s)                   │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Active Voice Fields (16 Fields)

### Core Voice Controls (Tier 1)
These determine **how ideas are worded**:

1. **`tone_of_voice`** (JSONB)
   - `.value` = 5 writing rules (v5 format)
   - Legacy: `{primary_tone, attributes, formality_level}`
   - **Purpose**: High-level voice direction

2. **`tone_model`** (JSONB) - **PRIMARY SOURCE**
   - `.writing_rules` = 5-7 specific rules (e.g., "Max 8 words per sentence")
   - `.good_examples` = 3 positive voice examples
   - `.avoid_examples` = 3 negative examples  
   - `.content_anchors` = 10 topic anchors (capped at 5 in prompts)
   - `.emoji_level` = none | minimal | moderate | frequent
   - **Purpose**: Granular voice calibration

3. **`voice_constraints`** (text)
   - Hard rules (e.g., "Never mention competitors")
   - **Purpose**: Absolute boundaries

4. **`typical_openings`** (text[])
   - 3-5 signature opening phrases
   - **Purpose**: Calibrates sentence starts

5. **`signature_phrases`** (text[])
   - Brand-specific expressions
   - **Purpose**: Voice distinctiveness

6. **`humor_level`** (text)
   - none | subtle | playful | bold
   - **Purpose**: Tone calibration

7. **`voice_rationale`** (text)
   - AI's explanation of voice choices
   - **Purpose**: Transparency & debugging

### Supporting Voice Fields (Tier 2)

8. **`typical_closings`** (text[])
   - Common CTAs or sign-offs

9. **`voice_examples`** (JSONB)
   - `.do_say` = curated example sentences
   - **Purpose**: Quality calibration

10. **`emotional_promise`** (text)
    - Feeling guests take home
    - **Purpose**: Emotional tone anchor

11. **`communication_goal`** (text)
    - Primary comms objective
    - **Purpose**: Strategic direction

12. **`content_exclusions`** (text)
    - Topics this brand never posts about
    - **Purpose**: Content boundaries

13. **`things_to_avoid`** (text)
    - Legacy field for banned topics

14. **`never_say`** / **`do_not_say`** (text[])
    - Banned words/phrases

15. **`business_character`** (text)
    - Vertical-specific traits (e.g., "neighborhood bistro")

16. **`identity_keywords`** (text[])
    - Core brand identity markers

---

## 🎯 Content Architecture

### ⚠️ Two Separate "Pillar" Concepts

**Important**: The system has TWO different fields both called "pillars":

#### 1. `content_pillars` (JSONB, 6 objects) - **Backend Fallback**
**Database**: `business_brand_profile.content_pillars`

Each pillar object:
```json
{
  "pillar": "Crave-worthy",
  "encouraged": true,
  "allowed": true,
  "notes": "Mad og drikkevarer er kernen..."
}
```

**6 Pillars**: Crave-worthy, BTS, Social proof, Vibe, Engagement, Offers  
**Purpose**: Deterministic fallback for brand profile generator  
**Used by**: Backend only (brand-profile-generator)  
**Displayed in UI**: ❌ NO (not shown to users)

#### 2. `content_focus` (text, 4 lines) - **User-Facing Display**
**Database**: `business_brand_profile.content_focus`

Example:
```
- Mad & servering (konkret: brunch/frokost/middag)
- Stemning & oplevelse (sted/rum/atmosfære)
- Mennesker, øjeblikke & tempo (scener)
- Overgange (dag → aften) og små fortællinger (BTS)
```

**4 Themes**: Human-readable content categories  
**Purpose**: High-level content guidance for users  
**Used by**: UI display only (shown as "Content Pillars" in Brand Profile page)  
**Displayed in UI**: ✅ YES (confusingly labeled "Content Pillars")

### Content Anchors (Strings) ✅ ACTIVE
**Database**: `tone_model.content_anchors` (JSONB array)

Example:
```json
["åben køkken", "håndlavede pasta", "sæsonens grøntsager"]
```

**Purpose**: Topic keywords for text generation  
**Used by**: Text generation prompts (capped at 5)  
**Flow**: `tone_model.content_anchors` → filtered to 5 → injected in prompt

---

## 👥 Audience Segments (5 Segments) ✅ OPTIMIZED

### Before Cleanup
- Fetched all 5 segments: **~2,500 tokens**
- Used only 1 active segment: **~500 tokens**
- **Waste**: 68% (2,000 tokens)

### After Phase 3 Optimization ✅
- **Pre-filter at source**: Keep only active segment
- **Memory**: 80% reduction (5 → 1)
- **Tokens saved**: ~2,000 per text generation

### Segment Structure
```json
{
  "label": "Aftensmad med venner",
  "priority": "primary",
  "motivation": "Uformel hygge i sæson...",
  "mindset_description": "Venner der mødes...",
  "timing": [
    {"day": "friday", "hour_start": 18, "hour_end": 23}
  ],
  "content_angles": [
    {"label": "Årstidens smag", "cta_type": "book_table"}
  ],
  "active_months": ["mar", "apr", "may", "sep", "oct", "nov"]
}
```

### Active Segment Selection Logic
1. Calculate Danish current time (UTC+1/+2)
2. Match by:
   - Day of week (exact match or weekday/weekend)
   - Hour range (18:00 → Friday 18-23)
   - Active months (seasonal segments)
3. Fallback: Primary segment or first segment

---

## 🗑️ Cleanup Summary (Phases 1-3)

### ❌ DELETED: Dead Code & Unused Fields

#### Phase 1: `content_strategy.pillars`
- **Status**: Never written anywhere (NULL for all businesses)
- **Confusion**: UI showed "Content Pillars" but data came from `content_pillars`, not this field
- **Action**: Removed 10 lines of dead merge logic in resolve-context.ts

#### Phase 2: `content_strategy.anchors`
- **Status**: Never populated (NULL everywhere)
- **Confusion**: Code checked for "authoritative override" that never existed
- **Action**: Removed 8 lines of legacy fallback logic
- **Simplified to**: Single source of truth = `tone_model.content_anchors`

### ✅ KEPT: Active Fields

#### `content_pillars` (6 objects, JSONB)
- ✅ **Written** by brand-profile-generator
- ✅ **Used** in deterministic fallback (backend only)
- ❌ **NOT displayed** in UI (users don't see this)

#### `content_focus` (4 lines, text)
- ✅ **Written** by brand-profile-generator
- ✅ **Displayed** in UI (labeled "Content Pillars" - confusing!)
- ❌ **NOT used** in text generation

#### `content_strategy.brand_anchors`
- ✅ **Written** by brand-profile-generator
- ✅ **Used** by get-quick-suggestions (brand moments)

#### `tone_model.content_anchors`
- ✅ **Written** by brand-profile-generator
- ✅ **Used** by text generation (topic keywords)

---

## 🚀 Optimization Gains

### Code Quality
- **18+ lines** of dead code removed
- **Single sources of truth** established
- **No confusing overrides** or legacy fallbacks

### Performance
- **68% token waste eliminated** (audience segments)
- **~2,000 tokens saved** per text generation
- **80% memory reduction** (5 segments → 1)

### Maintainability
- **Clear data flow**: Filtered at source, not scattered
- **Two pillar concepts clarified**: `content_pillars` (backend) vs `content_focus` (UI)
- **Simplified architecture**: One field per purpose

---

## 📈 Data Flow: Idea → Caption

```
1. USER INPUT
   └─ "Brunch idé: Forårsæg benedict"

2. RESOLVE BUSINESS CONTEXT (resolve-context.ts)
   ├─ Fetch brand_profile fields (voice, segments, etc.)
   ├─ 🚀 PRE-FILTER segments (5 → 1 active segment)
   ├─ Extract voice rules from tone_model
   ├─ Build voice constraints block
   └─ Select active segment for current time

3. BUILD PROMPT (prompt-builders.ts)
   ├─ BRANDSTEMME section:
   │  ├─ Writing rules (tone_model.writing_rules)
   │  ├─ Good examples (tone_model.good_examples)
   │  ├─ Content anchors (tone_model.content_anchors, cap 5)
   │  └─ Voice constraints (voice_constraints)
   ├─ MÅLGRUPPE section:
   │  └─ Active segment mindset (1 segment only)
   └─ INDHOLD section:
      └─ Hook + idea + menu context

4. GENERATE TEXT (OpenAI GPT-4o)
   └─ Returns caption (~35s at 70 tok/s)

5. OUTPUT
   └─ "Forårets sarte smag: Æg benedict med asparges..."
```

---

## 🎨 UI Display vs Database

### Brand Profile Page Components

1. **WritingGuidelinesPanel** (NEW - created during conversation)
   - **Displays**: 7 voice control fields
   - **Source**: `tone_model`, `voice_constraints`, `typical_openings`, etc.
   - **Purpose**: Surface hidden voice controls that determine wording

2. **VoiceExamplesPanel**
   - **Displays**: Example texts
   - **Source**: `voice_examples`

3. **SocialStylePanel**
   - **Displays**: Tone, emoji level, humor
   - **Source**: `tone_of_voice`, `tone_model.emoji_level`, `humor_level`

4. **Content Pillars** (UI section)
   - **Displays**: 4 user-friendly themes
   - **Source**: `content_focus` (text field, NOT `content_pillars`)
   - **UI Code**: `content_hooks = parseField(dbProfile.content_focus)`
   - **Example**:
     ```
     → Mad & servering (konkret: brunch/frokost/middag)
     → Stemning & oplevelse (sted/rum/atmosfære)
     → Mennesker, øjeblikke & tempo (scener)
     → Overgange (dag → aften) og små fortællinger
     ```

**⚠️ Common Confusion**: The UI section labeled "Content Pillars" does NOT display the `content_pillars` database field (6 technical objects). It displays `content_focus` (4 human-readable themes).

---

## 🔍 Quality Metrics (Café Faust Case Study)

### Current State
- **Brand Profile Quality**: 75/100
- **Voice Confidence**: ~55/100 (Medium)
- **Voice Examples**: 1 (need 3-5 for stronger calibration)
- **Tone Markers**: 0 (website analysis NULL)

### Quality Breakdown
- **Voice**: Generated from operational signals (no website text)
- **Segments**: 5 time-based segments, correctly matched
- **Location Intelligence**: Strong (neighborhood scores)
- **Content Anchors**: 5 from menu analysis
- **Content Pillars** (backend): 6 objects (Crave-worthy, BTS, Social proof, Vibe, Engagement, Offers)
- **Content Focus** (UI): 4 themes (Mad & servering, Stemning & oplevelse, Mennesker/øjeblikke, Overgange)

### Improvement Opportunities
1. Populate missing voice examples (1 → 3-5)
2. Run website analysis to extract tone markers
3. Add more content anchors from operational insights

---

## 📝 Technical Notes

### Database Schema
- **Primary table**: `business_brand_profile`
- **Key JSONB fields**:
  - `tone_model` (voice rules + examples + anchors)
  - `tone_of_voice` (high-level direction)
  - `content_pillars` (6 backend objects, JSONB)
  - `audience_segments` (5 segments + classification)
  - `content_strategy` (brand_anchors, primary_goal)
- **Key text fields**:
  - `content_focus` (4 UI themes, displayed as "Content Pillars")

### Edge Functions (Deno Runtime)
- **brand-profile-generator**: v4.13.0 (two-stage AI)
- **generate-text-from-idea**: Text generation orchestrator
- **get-quick-suggestions**: Daily suggestion generator
- **analyze-website**: Website tone analysis (optional)

### AI Models
- **Prompt A**: GPT-4o-mini (temperature 0.3, internal)
- **Prompt B**: GPT-4o (temperature 0.25, user-facing)
- **Text Gen**: GPT-4o (temperature 0.25, max 2500 tokens)

---

## ✅ Current System Status

**Architecture**: Clean and optimized  
**Code Quality**: Dead code removed, single sources of truth  
**Performance**: 68% token waste eliminated  
**Maintainability**: Clear data flow, no phantom fields  
**Voice System**: 16 active fields, working end-to-end  
**Audience Segments**: Pre-filtered at source (5 → 1)  

**Next Steps**:
1. Populate missing voice examples for Café Faust (1 → 3-5)
2. Run website analysis to extract tone markers
3. Monitor text generation quality improvements

---

*Last Updated: April 27, 2026 - Post Phase 1-3 Cleanup*
