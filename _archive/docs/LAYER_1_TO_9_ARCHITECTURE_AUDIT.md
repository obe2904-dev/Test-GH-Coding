# 9-Layer Architecture Audit - Complete System Review

**Date**: February 9, 2026  
**Purpose**: Comprehensive audit of all 9 layers to verify integration of 17 new brand profile enrichment fields  
**Context**: Brand voice enrichment schema deployed - verifying utilization across content generation pipeline

---

## Executive Summary

### Architecture Overview

The content generation system uses a **9-layer architecture** that transforms raw business data into production-ready social media posts:

```
Layer 1: Information Foundation (Data Extraction)
    ↓
Layer 2: Historical Performance Analysis (SQL Aggregations)
    ↓
Layer 3: Temporal Context (Weather + Events + Seasonality)
    ↓
Layer 4: Previous Content Analysis (Recency Filtering)
    ↓
Layer 5: Opportunity Selection (Menu Scoring)
    ↓
Layer 6: Post Slot Optimization (Day/Time Assignment)
    ↓
Layer 7: Media Format Selection (Photo/Carousel/Reel)
    ↓
Layer 8: AI Caption Generation (GPT-4o-mini) ⭐ PRIMARY AI LAYER
    ↓
Layer 9: Weekly Plan Assembly (Orchestration)
```

### AI Usage Summary

| Layer | AI Models Used | Purpose |
|-------|---------------|---------|
| Layers 1-7 | ❌ None | Rule-based processing, statistical analysis |
| **Layer 8** | ✅ **OpenAI GPT-4o-mini** | Caption generation with brand voice |
| Layer 9 | ❌ None | Orchestration and assembly |

**Key Finding**: Only Layer 8 uses AI, making it the critical integration point for brand voice enrichment.

### Brand Profile Enrichment Integration Status

**17 New Fields Added** (via `20260204120000_add_voice_enrichment_columns.sql`):

| Field | Type | Layer 1 | Layer 8 | Layer 9 | Status |
|-------|------|---------|---------|---------|--------|
| `signature_phrases` | text[] | ✅ Fetched | ✅ Used | ⚠️ Not passed | Partial |
| `never_say` | text[] | ✅ Fetched | ✅ Used | ⚠️ Not passed | Partial |
| `typical_openings` | text[] | ✅ Fetched | ⚠️ Weak | ⚠️ Not passed | Weak |
| `typical_closings` | text[] | ✅ Fetched | ❌ Missing | ⚠️ Not passed | **GAP** |
| `humor_level` | enum | ✅ Fetched | ✅ Used | ⚠️ Not passed | Partial |
| `formality` | enum | ✅ Fetched | ✅ Used | ⚠️ Not passed | Partial |
| `storytelling_style` | enum | ✅ Fetched | ✅ Used | ⚠️ Not passed | Partial |
| `emoji_style` | enum | ✅ Fetched | ✅ Used | ⚠️ Not passed | Partial |
| `punctuation_style` | text | ✅ Fetched | ❌ Missing | ⚠️ Not passed | **GAP** |
| `brand_origin_story` | text | ✅ Fetched | ❌ Missing | ⚠️ Not passed | **GAP** |
| `what_makes_us_different` | text | ✅ Fetched | ❌ Missing | ⚠️ Not passed | **GAP** |
| `signature_approach` | text | ✅ Fetched | ❌ Missing | ⚠️ Not passed | **GAP** |
| `owner_perspective` | text | ✅ Fetched | ❌ Missing | ⚠️ Not passed | **GAP** |
| `founded_year` | integer | ✅ Fetched | ❌ Missing | ⚠️ Not passed | **GAP** |
| `sample_posts` | jsonb | ✅ Fetched | ✅ Used | ⚠️ Not passed | Partial |
| `voice_extraction_source` | text | ✅ Fetched | N/A | N/A | Metadata |
| `voice_extracted_at` | timestamp | ✅ Fetched | N/A | N/A | Metadata |
| `voice_confidence_score` | integer | ✅ Fetched | N/A | N/A | Metadata |

**Integration Score**: 7/15 active fields used (47%) - **8 fields not utilized**

---

## Layer-by-Layer Analysis

## Layer 1: Information Foundation ✅

**Purpose**: Extract and assemble all business data needed for content generation  
**File**: `generate-weekly-plan/index.ts` (Edge Function)  
**AI Models**: ❌ None

### Data Sources (8+ Tables)

1. **business_brand_profile** - Brand voice, service periods, enrichment fields
2. **businesses** - Core business info
3. **business_profile** - Business type, category
4. **business_operations** - Hours, services, amenities
5. **business_locations** - Location intelligence
6. **menu_items_normalized** - Pre-processed menu data
7. **profiles** - User settings, selected platforms
8. **weekly_content_plans** - Historical plans

### Brand Profile Integration

**Lines 64-68**: Fetches brand profile with `SELECT *`
```typescript
const { data: brandProfile } = await supabaseClient
  .from('business_brand_profile')
  .select('*')  // ✅ Includes ALL 17 new enrichment fields
  .eq('business_id', businessId)
  .single()
```

**Lines 227-244**: Assembles GenerationInput object
```typescript
const generationInput: GenerationInput = {
  userId,
  businessId,
  weekStart,
  businessType,
  brandProfile,        // ✅ All fields included
  businessProfile,
  businessOps,
  locationIntel,
  menuItems,
  platforms,
  previousPlans
}
```

### Status
✅ **COMPLETE** - All 17 enrichment fields automatically fetched via SELECT *

**Key Insight**: Layer 1 correctly fetches all data. The issue is downstream layers not using it.

---

## Layer 2: Historical Performance Analysis ✅

**Purpose**: Analyze past content performance to optimize distribution  
**File**: Embedded in `opportunity-selector.ts`  
**AI Models**: ❌ None (SQL aggregations)

### Algorithm

1. **Query Performance Data**:
   ```sql
   SELECT content_type, AVG(engagement_rate) 
   FROM content_performance_log
   WHERE business_id = ? AND posted_at > NOW() - INTERVAL '90 days'
   GROUP BY content_type
   ```

2. **Calculate Optimal Distribution**:
   - High performers → More slots
   - Low performers → Fewer slots
   - New content types → Baseline allocation

3. **Apply Adjustments**:
   - Platform-specific performance (Instagram vs Facebook)
   - Time-of-day patterns
   - Day-of-week patterns

### Data Sources
- `content_performance_log` - Post engagement history
- `content_type_baselines` - Performance baselines per content type

### Uses Enrichment Fields?
❌ **NO** - Statistical analysis doesn't need brand voice personality traits

**Status**: ✅ Working as designed - No integration needed

---

## Layer 3: Temporal Context ✅

**Purpose**: Add weather, seasonality, events, and compound opportunities  
**Files**: 
- `compound-opportunities.ts` (890 lines)
- `weather.ts` (293 lines)
**AI Models**: ❌ None

### Components

#### 3.1 Weather Integration
- **API**: OpenWeatherMap 7-day forecast
- **Cache**: 1-hour TTL in-memory
- **Output**: Simplified conditions (sunny, rainy, cold, hot)

#### 3.2 Seasonal Context
```typescript
const SEASONAL_INGREDIENTS = {
  winter: ['kål', 'rodfrugter', 'vildsvine'],
  spring: ['asparges', 'rabarber', 'nye kartofler'],
  summer: ['jordbær', 'tomater', 'basilikum'],
  fall: ['svampe', 'græskar', 'æbler']
}
```

Queries `seasonal_ingredients_calendar` table for country-specific seasonality.

#### 3.3 Event Detection
- Queries `contextual_calendar` table
- Detects holidays, local events, seasonal themes
- Returns event name, type, and marketing angle

#### 3.4 Compound Opportunities (5 Patterns)

1. **Outdoor + Weather**: "Sunny day + outdoor seating"
2. **Waterfront + Weather**: "Clear view + waterfront location"
3. **Weather Contrast**: "Rainy → cozy indoor"
4. **Seasonal + Event**: "Harvest season + fall festival"
5. **Event-Driven**: "Valentine's Day → romantic atmosphere"

### Data Sources
- OpenWeatherMap API (external)
- `seasonal_ingredients_calendar` - Country-specific produce
- `contextual_calendar` - Events and holidays
- `business_locations` - Location features (outdoor, waterfront)

### Uses Enrichment Fields?
❌ **NO** - Weather and events are factual context, not brand voice

**Status**: ✅ Working as designed - No integration needed

---

## Layer 4: Previous Content Analysis ✅

**Purpose**: Filter out recently posted content to ensure variety  
**File**: `variety-filter.ts` (558 lines)  
**AI Models**: ❌ None

### Algorithm - 5 Variety Checks

1. **Dish Repetition** (14-day lookback):
   - Blocks exact dish name matches
   - Example: If "Beef Stroganoff" posted 10 days ago → skip

2. **Content Type Sequence**:
   - No more than 2 consecutive posts of same type
   - Example: menu → menu → atmosphere (force switch)

3. **Platform Balance**:
   - Maintains 60/40 Instagram/Facebook split
   - No more than 3 consecutive posts to same platform

4. **Visual Variety**:
   - Tracks format distribution (photo/carousel/reel)
   - Ensures mix of formats

5. **Location Hook Repetition**:
   - Prevents overuse of same location angle
   - Example: "by the waterfront" used too often

### Scoring System
```typescript
Priority Score = Base Score - Recency Penalties
- Posted < 7 days ago:  -50 points
- Posted < 14 days ago: -30 points
- Posted < 30 days ago: -15 points
```

### Data Sources
- `content_performance_log` - Recent posts (14-30 day window)
- `weekly_content_plans` - Historical plans

### Uses Enrichment Fields?
❌ **NO** - Variety checking is pattern-based, not voice-related

**Potential Enhancement**: Could use `sample_posts` to identify "hero dishes" that deserve more frequent posting

**Status**: ✅ Working as designed - Minor enhancement opportunity

---

## Layer 5: Opportunity Selection & Menu Scoring ✅

**Purpose**: Score and rank all menu items to select best content opportunities  
**Files**:
- `opportunity-selector.ts` (1274 lines) - Orchestrator
- `menu-scorer.ts` (955 lines) - Scoring engine  
**AI Models**: ❌ None

### 7-Factor Scoring Algorithm

**File**: `menu-scorer.ts` lines 150-600

```typescript
Final Score = Base Score 
            + Seasonal Bonus (0-50 points)
            + Weather Bonus (0-30 points)
            + Location Bonus (0-40 points)
            + Performance Bonus (0-60 points)
            + Newness Bonus (0-20 points)
            - Recency Penalty (0-100 points)
```

#### 1. Base Score (50-100 points)
- Menu item popularity
- Item category (appetizer/main/dessert)
- Price point positioning
- Description richness

#### 2. Seasonal Bonus (0-50 points)
```typescript
if (ingredientsMatchSeason) {
  score += 50  // Perfect seasonal match
} else if (partialMatch) {
  score += 25  // Some seasonal ingredients
}
```

#### 3. Weather Bonus (0-30 points)
```typescript
if (weather === 'cold' && item.category === 'soup') {
  score += 30  // Weather-appropriate
}
if (weather === 'hot' && item.category === 'salad') {
  score += 30
}
```

#### 4. Location Bonus (0-40 points)
- Waterfront + seafood: +40
- Tourist area + popular dishes: +30
- Historic + traditional: +25

#### 5. Performance Bonus (0-60 points)
Based on `content_type_baselines`:
```typescript
if (avgEngagement > 8%) score += 60  // Top performer
if (avgEngagement > 5%) score += 40  // Good performer
if (avgEngagement > 3%) score += 20  // Average
```

#### 6. Newness Bonus (0-20 points)
- New menu items get visibility boost
- Encourages showcasing fresh additions

#### 7. Recency Penalty (0-100 points)
- Posted < 7 days: -100 (effectively blocked)
- Posted < 14 days: -50
- Posted < 30 days: -25

### Hybrid Data Source Strategy

**Lines 150-250**: Dual approach for menu data
```typescript
// Priority 1: Use menu_items_normalized (pre-processed, fast)
const { data: normalizedItems } = await supabase
  .from('menu_items_normalized')
  .select('*')

// Fallback: Use menu_results_v2 (JSON, slower)
if (!normalizedItems || normalizedItems.length === 0) {
  const { data: jsonMenu } = await supabase
    .from('menu_results_v2')
    .select('menu_data')
}
```

### Platform Rotation

**File**: `opportunity-selector.ts` lines 600-650

```typescript
const PLATFORM_ROTATION = [
  'instagram', 'instagram',  // 60% Instagram
  'facebook',                // (4 posts)
  'instagram', 'instagram',  // 40% Facebook
  'facebook', 'facebook'     // (3 posts)
]
```

### Service Period Filtering

**Lines 680-710**: Filters menu items by brunch/lunch/dinner
```typescript
if (servicePeriod === 'brunch') {
  // Only include breakfast/brunch items
  menuItems = menuItems.filter(item => 
    item.service_periods?.includes('brunch')
  )
}
```

### Post-Worthiness Tiers

```typescript
Score 200+:    CRITICAL (must post)
Score 150-199: HIGH (strong candidate)
Score 100-149: MEDIUM (good option)
Score 50-99:   LOW (filler)
Score < 50:    BLOCKED (do not post)
```

### Uses Enrichment Fields?
❌ **NO** - Scoring is algorithmic based on menu attributes, seasonality, weather, and performance data

**Status**: ✅ Working as designed - No integration needed

---

## Layer 6: Post Slot Optimization ✅

**Purpose**: Assign optimal day-of-week and time-of-day to each post  
**Files**:
- `post-slot-optimizer.ts` (472 lines)
- `opportunity-selector.ts` (assignOptimalTiming function)  
**AI Models**: ❌ None

### Algorithm - 7 Steps

#### Step 1: Service Period Detection
**File**: `opportunity-selector.ts` lines 845-925

```typescript
const servicePeriods = businessProfile?.service_periods || {}
// Extract brunch: { start: "09:00", end: "13:00" }
// Extract lunch: { start: "11:00", end: "15:00" }
// Extract dinner: { start: "17:00", end: "22:00" }
```

#### Step 2: Default Optimal Hours
```typescript
const optimalHours = {
  menu_item: 11,              // Late morning for lunch inspiration
  atmosphere_experience: 17,   // Early evening for FOMO
  behind_the_scenes: 9,        // Morning engagement
  promotional: 14,             // Afternoon decision window
  event_announcement: 10       // Mid-morning awareness
}
```

#### Step 3: Service Period Overrides
```typescript
// Brunch posts → Use brunch start time
if (servicePeriods.brunch) {
  optimalHours.menu_item = parseInt(brunchStart)  // e.g., 9:00
}

// Dinner atmosphere → 2 hours before dinner
if (servicePeriods.dinner) {
  optimalHours.atmosphere_experience = dinnerStart - 2  // e.g., 15:00
}
```

**Result**: Posts now correctly say "brunch" at 9:00, "dinner atmosphere" at 15:00 ✅

#### Step 4: Day Assignment by Content Type
```typescript
const DAY_PATTERNS = {
  menu_item: [1, 3, 5, 2, 4],           // Mon, Wed, Fri, Tue, Thu
  atmosphere_experience: [4, 5, 6, 0],  // Thu, Fri, Sat, Sun
  behind_the_scenes: [1, 3, 6],         // Mon, Wed, Sat
  promotional: [2, 4, 5],               // Tue, Thu, Fri
  event_announcement: [1, 2]            // Mon, Tue
}
```

- Tracks used days to prevent collisions
- Falls back to any weekday if preferred days taken
- Uses Sunday only as last resort (7+ posts)

#### Step 5: Business Hours Constraints
**File**: `post-slot-optimizer.ts` lines 220-250

```typescript
// Respect opening hours
if (!businessOps.open_breakfast && hour < 10) {
  hour = 11  // Shift to lunch time
}
```

#### Step 6: Historical Performance Optimization
**Lines 260-320**: Adjust based on past engagement
```typescript
// Query content_type_baselines for optimal posting times
const performanceData = await supabase
  .from('content_type_baselines')
  .select('optimal_posting_times')

// Can shift time by max ±3 hours
if (performanceData.optimal_hour > proposedHour) {
  hour = Math.min(hour + 3, performanceData.optimal_hour)
}
```

#### Step 7: Collision Detection & Resolution
**Lines 380-420**: Prevent scheduling conflicts
```typescript
while (usedSlots.has(`${day}-${hour}`)) {
  // Strategy 1: Try next hour (up to +3 hours)
  if (attempts <= 3) hour++
  
  // Strategy 2: Try next day with same hour
  else if (attempts <= 6) day = (day + 1) % 7
  
  // Strategy 3: Try any available slot
  else { hour += 2; day = (day + 1) % 7 }
}
```

### Data Sources
- `business_operations` - Opening hours
- `content_type_baselines` - Performance data
- `business_brand_profile` - Service periods

### Uses Enrichment Fields?
❌ **NO** - Timing optimization is rule-based, not voice-related

**Status**: ✅ Working correctly with service period awareness

---

## Layer 7: Media Format & Platform Selection ✅

**Purpose**: Determine optimal format (photo/carousel/reel) and finalize platform  
**File**: `media-format-selector.ts` (421 lines)  
**AI Models**: ❌ None

### Phase 1: Format Selection (3 Steps)

#### Step 1: Content Type Preferences
```typescript
const FORMAT_PREFERENCES = {
  menu_highlight: ['photo', 'reel', 'carousel'],
  atmosphere: ['reel', 'photo'],
  behind_scenes: ['reel', 'carousel', 'photo'],
  engagement: ['photo', 'carousel'],
  event_promotion: ['carousel', 'photo', 'reel']
}
```

#### Step 2: Performance-Driven Override
**Lines 108-124**: Check if Reels outperform
```typescript
// Query content_type_baselines.format_performance
const reelEngagement = performanceData.reel?.avg_engagement
const photoEngagement = performanceData.photo?.avg_engagement

// If Reels perform +40% better → prioritize Reels
if (reelEngagement > photoEngagement * 1.4) {
  selectedFormat = 'reel'
}
```

#### Step 3: Capacity Constraints
**Lines 130-158**: Enforce production limits
```typescript
// Fetch last 10 posts
const recentFormats = await supabase
  .from('content_performance_log')
  .select('format')
  .limit(10)

const reelPercentage = recentFormats.filter(f => f === 'reel').length / 10

// FSE/SBO businesses: Max 40% Reels
// Larger businesses: Max 50% Reels
const maxReelPercentage = ['FSE', 'SBO'].includes(businessType) ? 0.4 : 0.5

if (reelPercentage >= maxReelPercentage) {
  return 'photo'  // Fallback - Reels require more production time
}
```

### Phase 2: Platform Finalization (3 Steps)

#### Step 1: Platform Availability
**Lines 165-175**: Validate against user settings
```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('selected_platforms')

const availablePlatforms = profile?.selected_platforms || ['instagram']
```

#### Step 2: Format-Platform Compatibility
```typescript
const PLATFORM_FORMATS = {
  instagram: ['photo', 'carousel', 'reel'],
  facebook: ['photo', 'carousel', 'reel'],
  tiktok: ['video', 'reel'],
  linkedin: ['photo', 'carousel']
}

// If incompatible → find compatible platform or fallback to photo
```

#### Step 3: Balance Enforcement
**Lines 185-220**: Prevent platform monopoly
```typescript
// Rule 1: No more than 3 consecutive posts to same platform
if (last3Posts.every(p => p === 'instagram')) {
  platform = 'facebook'  // Force switch
}

// Rule 2: No platform neglected for >7 posts
if (!last7Posts.includes('facebook') && last7Posts.length >= 7) {
  platform = 'facebook'  // Reactivate neglected platform
}
```

### Output
```typescript
{
  format: 'photo' | 'carousel' | 'reel' | 'video',
  platform: 'instagram' | 'facebook',
  formatReason: 'Single image for quick production and clear focus',
  platformReason: 'Instagram optimized for visual content'
}
```

### Data Sources
- `content_performance_log` - Recent formats/platforms
- `content_type_baselines` - Format performance
- `profiles` - selected_platforms
- `business_profile` - business_type

### Uses Enrichment Fields?
❌ **NO** - Format selection is technical, not voice-related

**Status**: ✅ Working as designed - No integration needed

---

## Layer 8: AI Caption Generation ⭐ CRITICAL LAYER

**Purpose**: Generate production-ready captions using AI with brand voice  
**Files**:
- `ai-caption-generator/index.ts` (333 lines) - Main orchestrator
- `ai-caption-generator/prompt-builder.ts` (525 lines) - Prompt construction
- `ai-caption-generator/types.ts` (181 lines) - Type definitions
- `ai-caption-generator/ai-provider.ts` (250 lines) - AI provider abstraction  
**AI Models**: ✅ **OpenAI GPT-4o-mini**

### Configuration
**File**: `ai-provider.ts` lines 30-32
```typescript
const FEATURE_AI_CONFIG = {
  'caption': {
    provider: 'openai',
    model: 'gpt-4o-mini'  // Fast and cost-effective
  }
}
```

### Current Brand Voice Integration

**File**: `types.ts` lines 20-50 - CaptionGenerationContext interface

#### ✅ ALREADY USING (5 Legacy Fields)
```typescript
brandVoice: {
  tone_keywords: string[]      // ["hyggelig", "uformel"]
  voice_style: string           // "du-form, emojis ok"
  values: string[]              // ["økologisk", "bæredygtig"]
  certifications: string[]      // ["Ø-mærket"]
  do_not_say: { words: string[] }  // Banned words
}
```

#### ✅ PARTIALLY INTEGRATED (7 Enrichment Fields)
Type definitions include these fields, but usage varies:

```typescript
// ENRICHED FIELDS (preferred if available)
signature_phrases?: string[]   // ✅ Used in prompt (line 124)
never_say?: string[]           // ✅ Used in prompt (line 131)
typical_openings?: string[]    // ⚠️ Weak - only "suggestions" (line 159)
typical_closings?: string[]    // ❌ NOT USED AT ALL
sample_posts?: Array<{         // ✅ Used in prompt (line 164)
  post_text: string
  why_this_works: string
}>

// ENRICHED PERSONALITY
humor_level?: 'none' | 'subtle' | 'playful'  // ✅ Used (line 139)
formality?: 'professional' | 'casual' | 'friendly'  // ✅ Used (line 139)
storytelling_style?: 'facts_only' | 'some_context' | 'rich_stories'  // ✅ Used (line 141)
emoji_style?: 'minimal' | 'moderate' | 'expressive'  // ✅ Used (lines 335-350)

// ENRICHED BRAND STORY
brand_origin_story?: string        // ❌ NOT USED
what_makes_us_different?: string   // ❌ NOT USED
signature_approach?: string        // ❌ NOT USED
```

#### ❌ NOT USED AT ALL (5 Enrichment Fields)
- `punctuation_style` - Could guide exclamation marks, ellipses
- `brand_origin_story` - Could enrich authenticity
- `what_makes_us_different` - Could emphasize uniqueness
- `signature_approach` - Could mention methodology
- `owner_perspective` - Optional depth
- `founded_year` - Heritage mentions

### Prompt Builder Integration

**File**: `prompt-builder.ts` lines 119-170 - buildBrandVoiceGuidelines()

```typescript
function buildBrandVoiceGuidelines(context, config) {
  const voice = context.brandVoice;
  const hasEnriched = voice.signature_phrases?.length || voice.never_say?.length;
  
  // Log which path we're using
  if (hasEnriched) {
    console.log('[Prompt Builder] Using ENRICHED voice fields');
  } else {
    console.log('[Prompt Builder] Using LEGACY fallback');
  }
  
  let section = `BRAND VOICE:\n`;
  
  // ✅ ENRICHED: Signature phrases (line 124)
  if (voice.signature_phrases?.length) {
    section += `- Brug disse fraser naturligt: ${voice.signature_phrases.slice(0, 5).join(', ')}\n`;
  }
  
  // ✅ ENRICHED: Never say (line 131)
  const bannedWords = voice.never_say?.length 
    ? voice.never_say 
    : voice.do_not_say?.words;
  if (bannedWords?.length) {
    section += `- ⚠️ UNDGÅ DISSE ORD: ${bannedWords.slice(0, 8).join(', ')}\n`;
  }
  
  // ✅ ENRICHED: Personality traits (line 139)
  if (voice.humor_level || voice.formality) {
    const traits = [];
    if (voice.humor_level) traits.push(`humor: ${voice.humor_level}`);
    if (voice.formality) traits.push(`formalitet: ${voice.formality}`);
    if (voice.storytelling_style) traits.push(`historiefortælling: ${voice.storytelling_style}`);
    if (voice.emoji_style) traits.push(`emojis: ${voice.emoji_style}`);
    section += `- Personlighed: ${traits.join(' | ')}\n`;
  } else if (voice.tone_keywords?.length) {
    // Fallback to legacy tone_keywords
    section += `- Tone: ${voice.tone_keywords.join(', ')}\n`;
  }
  
  // ⚠️ WEAK: Typical openings (line 159) - only "exercise suggestions"
  if (voice.typical_openings?.length) {
    section += `- Åbninger (øvelsesforslag): ${voice.typical_openings.slice(0, 3).join(' | ')}\n`;
  }
  
  // ✅ ENRICHED: Sample posts (line 164)
  if (voice.sample_posts?.length) {
    section += `- Eksempel på deres stemme: "${voice.sample_posts[0].post_text.substring(0, 80)}..."\n`;
  }
  
  // ❌ MISSING: typical_closings - not used at all
  // ❌ MISSING: brand_origin_story, what_makes_us_different, signature_approach
  
  return section;
}
```

### Emoji Style Integration

**File**: `prompt-builder.ts` lines 335-350 - getEmojiGuidance()

```typescript
function getEmojiGuidance(context, platformConfig) {
  const emojiStyle = context.brandVoice?.emoji_style;
  
  if (emojiStyle === 'minimal') {
    return '0-1 stk (minimal stil)';
  } else if (emojiStyle === 'expressive') {
    return `${platformConfig.maxEmojis} stk (expressive - brug gerne max)`;
  } else if (emojiStyle === 'moderate') {
    const midpoint = Math.floor((platformConfig.minEmojis + platformConfig.maxEmojis) / 2);
    return `${platformConfig.minEmojis}-${midpoint} stk (moderate stil)`;
  }
  
  // Fallback to platform defaults
  return `${platformConfig.minEmojis}-${platformConfig.maxEmojis} stk`;
}
```

### Service Period Integration

**File**: `prompt-builder.ts` lines 210-230 - buildContextWeaving()

```typescript
// ✨ Service period guidance (CRITICAL for meal context)
if (tc.servicePeriod) {
  if (tc.servicePeriod === 'brunch') {
    parts.push('- 🥐 VIGTIGT: Dette er BRUNCH content (ikke "frokost"!) - brug ord som "brunch", "morgenmad", "morgenkaffe"');
  } else if (tc.servicePeriod === 'lunch') {
    parts.push('- 🍽️ Dette er frokost - brug "frokost", "lunch", "middag"');
  } else if (tc.servicePeriod === 'dinner') {
    parts.push('- 🌆 Dette er AFTEN/DINNER content - brug "aften", "aftensmad", "dinner", skab FOMO for aften ud');
  }
}
```

### Integration Score

| Field Category | Fields | Used | Status |
|---------------|--------|------|--------|
| Phrase Arrays | 4 | 2 | 50% |
| Personality Traits | 5 | 4 | 80% |
| Brand Story | 4 | 0 | 0% |
| Sample Posts | 1 | 1 | 100% |
| **TOTAL** | **14** | **7** | **50%** |

### Gap Analysis

**HIGH PRIORITY** (Should be added):
1. ❌ `typical_closings` - Completely unused, should guide CTAs
2. ⚠️ `typical_openings` - Weakly used ("suggestions"), should be enforced preference
3. ❌ `punctuation_style` - Could guide exclamation marks, ellipses, formality

**MEDIUM PRIORITY** (Would enhance quality):
4. ❌ `what_makes_us_different` - Emphasize uniqueness in captions
5. ❌ `brand_origin_story` - Add authenticity and depth
6. ❌ `signature_approach` - Mention methodology or philosophy

**LOW PRIORITY** (Optional enhancements):
7. ❌ `owner_perspective` - Personal touch (only if relevant)
8. ❌ `founded_year` - Heritage mentions (only for established brands)

**Status**: ⚠️ **PARTIAL INTEGRATION** - 7/14 fields used (50%)

---

## Layer 9: Weekly Plan Assembly ⚠️ DATA PASS GAP

**Purpose**: Orchestrate Layers 5-8 to assemble complete weekly plans  
**File**: `weekly-plan-generator.ts` (903 lines)  
**AI Models**: ❌ None (orchestration only)

### Algorithm - 6 Phases

#### Phase 1: Determine Post Count
**Lines 200-210**:
```typescript
const POST_COUNT_BY_TYPE = {
  FSE: 4,  // Fine Dining
  SBO: 4,  // Small Business
  MFV: 5,  // Multiple Locations
  MFD: 6,  // Multiple per Day
  QSR: 7   // Quick Service
}
```

#### Phase 2: Layer 5 Integration - Content Selection
**Lines 420-450**: Calls opportunity selector
```typescript
const weeklyPlan = await selectWeeklyOpportunities(
  businessId,
  weekStart,
  {
    minimumScore: 60,
    businessProfile,      // ✅ service_periods
    businessOps,          // ✅ outdoor_seating
    locationIntel,        // ✅ waterfront, category_scores
    platforms,            // ✅ selected platforms
    menuItems,            // ✅ pre-fetched menu
    brandProfile          // ✅ brand voice (all fields)
  }
)
```

#### Phase 3: Layer 6 Integration - Timing Optimization
**Lines 475-495**: Optimize schedule
```typescript
const weeklySchedule = await optimizeWeeklySchedule({
  businessId,
  weekStartDate: weekStart,
  slots: enrichedSlots.map(slot => ({
    contentType: slot.contentType,
    opportunity: slot.opportunity,
    score: slot.opportunity.score,
    platform: slot.platform,
    dayOfWeek: slot.dayOfWeek,
    hour: slot.hour
  }))
}, supabaseClient)
```

#### Phase 4: Layer 7 Integration - Format Selection
**Lines 510-530**: Select media format
```typescript
const formatSelection = await selectMediaFormatAndPlatform(
  optimizedSlot,
  businessId,
  userId,
  supabaseClient
)
```

#### Phase 5: Layer 8 Integration - AI Caption Generation
**Lines 540-650**: **⚠️ CRITICAL GAP IDENTIFIED**

```typescript
// ✅ Fetch full brand profile (line 540)
const { data: fullBrandProfile } = await supabaseClient
  .from('business_brand_profile')
  .select('*')  // ✅ Includes ALL 17 enrichment fields
  .eq('business_id', businessId)
  .single()

// ⚠️ Service Period Detection (lines 545-572)
const servicePeriods = businessProfile?.service_periods || {}
let servicePeriod: 'brunch' | 'lunch' | 'dinner' | undefined

if (scheduledHour >= brunchStart && scheduledHour < brunchEnd) {
  servicePeriod = 'brunch'
}
// ... lunch and dinner detection

// ❌ GAP: Only passes 5 LEGACY fields (lines 580-600)
const aiContext = {
  businessName, businessCategory, city, country,
  brandVoice: {
    tone_keywords: fullBrandProfile?.tone_keywords || [],
    voice_style: fullBrandProfile?.voice_style || 'casual',
    values: fullBrandProfile?.values || [],
    certifications: fullBrandProfile?.certifications || [],
    do_not_say: fullBrandProfile?.do_not_say || { words: [] }
  },
  // ❌ MISSING: 17 enrichment fields are NOT passed!
  contentOpportunity: { ... },
  temporalContext: {
    servicePeriod: servicePeriod  // ✅ NEW: Correctly passed
  },
  format, platform
}

// Call AI caption generator
aiCaptionResult = await generateAICaption(aiContext, {
  useAI: true,
  temperature: 0.5,
  fallbackToTemplate: true,
  enforceBrevity: true
})
```

#### Phase 6: Final Assembly
**Lines 680-850**: Build complete post specifications
```typescript
const post: PostSpecification = {
  selectionRationale,
  timing: { day, date, time, rationale },
  platformFormat: { platform, format, reasons },
  postType: { type, category, priority },
  contentSubject: { dish, whyThisDish },
  opportunity: { finalScore, scoreBreakdown },
  caption: {
    text: aiCaptionResult.caption,
    hashtags: aiCaptionResult.hashtags,
    isAIGenerated: true,
    aiMetadata: { model, tone, qualityScore }
  },
  visualDirection: { ... },
  productionNotes: { ... },
  alternatives: [ ... ],
  media: { status: 'pending' },
  approval: { status: 'draft' }
}
```

### Critical Gap Identified 🔴

**Issue**: Layer 9 fetches all 17 enrichment fields but only passes 5 legacy fields to Layer 8

**Location**: `weekly-plan-generator.ts` lines 580-600

**Impact**: 
- Type definitions in Layer 8 support all fields ✅
- Prompt builder in Layer 8 can use enrichment fields ✅
- But Layer 9 doesn't pass them in aiContext.brandVoice ❌

**Fix Required**:
```typescript
// CURRENT (lines 580-600)
brandVoice: {
  tone_keywords: fullBrandProfile?.tone_keywords || [],
  voice_style: fullBrandProfile?.voice_style || 'casual',
  values: fullBrandProfile?.values || [],
  certifications: fullBrandProfile?.certifications || [],
  do_not_say: fullBrandProfile?.do_not_say || { words: [] }
}

// SHOULD BE
brandVoice: {
  // Legacy fields
  tone_keywords: fullBrandProfile?.tone_keywords || [],
  voice_style: fullBrandProfile?.voice_style || 'casual',
  values: fullBrandProfile?.values || [],
  certifications: fullBrandProfile?.certifications || [],
  do_not_say: fullBrandProfile?.do_not_say || { words: [] },
  
  // ✨ NEW: Add enrichment fields
  signature_phrases: fullBrandProfile?.signature_phrases || [],
  never_say: fullBrandProfile?.never_say || [],
  typical_openings: fullBrandProfile?.typical_openings || [],
  typical_closings: fullBrandProfile?.typical_closings || [],
  humor_level: fullBrandProfile?.humor_level,
  formality: fullBrandProfile?.formality,
  storytelling_style: fullBrandProfile?.storytelling_style,
  emoji_style: fullBrandProfile?.emoji_style,
  punctuation_style: fullBrandProfile?.punctuation_style,
  brand_origin_story: fullBrandProfile?.brand_origin_story,
  what_makes_us_different: fullBrandProfile?.what_makes_us_different,
  signature_approach: fullBrandProfile?.signature_approach,
  owner_perspective: fullBrandProfile?.owner_perspective,
  founded_year: fullBrandProfile?.founded_year,
  sample_posts: fullBrandProfile?.sample_posts || []
}
```

**Status**: ❌ **CRITICAL GAP** - Fetches data but doesn't pass it forward

---

## Critical Integration Gaps Summary

### Gap 1: Layer 9 → Layer 8 Data Pass 🔴 **HIGH PRIORITY**

**File**: `weekly-plan-generator.ts` lines 580-600  
**Issue**: Only passes 5 legacy fields, missing 12 enrichment fields  
**Impact**: Layer 8 can't use enrichment even though it's designed to  
**Fix Complexity**: Simple - just add fields to brandVoice object  
**Lines to Change**: ~20 lines

### Gap 2: Layer 8 Prompt Builder Usage ⚠️ **MEDIUM PRIORITY**

**File**: `prompt-builder.ts` lines 119-170  
**Issue**: Uses only 7/14 enrichment fields, missing:
- `typical_closings` (completely unused)
- `typical_openings` (weak usage - only "suggestions")
- `punctuation_style`
- `brand_origin_story`
- `what_makes_us_different`
- `signature_approach`
- `owner_perspective` (optional)
- `founded_year` (optional)

**Impact**: AI captions lack full brand voice richness  
**Fix Complexity**: Moderate - requires prompt engineering  
**Lines to Change**: ~50 lines

---

## Integration Recommendations

### Priority 1: Fix Layer 9 → Layer 8 Data Pass (1 hour)

**File**: `supabase/functions/_shared/post-helpers/weekly-plan-generator.ts`

**Change Required**: Lines 580-600
```typescript
// Add 12 enrichment fields to brandVoice object passed to generateAICaption()
```

**Verification**:
1. Check console logs: `[Prompt Builder] Using ENRICHED voice fields`
2. Verify AI captions include signature phrases
3. Test with business that has enrichment data

### Priority 2: Enhance Layer 8 Prompt Builder (3-4 hours)

**File**: `supabase/functions/_shared/ai-caption-generator/prompt-builder.ts`

**Changes Required**:

#### 2.1 Add `typical_closings` Integration (lines 170-180)
```typescript
// After typical_openings section
if (voice.typical_closings?.length) {
  section += `- Afslutninger (BRUG EN AF DISSE som CTA): ${voice.typical_closings.join(' | ')}\n`;
}
```

#### 2.2 Strengthen `typical_openings` (line 159)
```typescript
// Change from "øvelsesforslag" to "BRUG EN AF DISSE"
if (voice.typical_openings?.length) {
  section += `- Åbninger (VÆLG EN AF DISSE): ${voice.typical_openings.slice(0, 3).join(' | ')}\n`;
}
```

#### 2.3 Add `punctuation_style` (after line 170)
```typescript
if (voice.punctuation_style) {
  section += `- Tegnsætning: ${voice.punctuation_style}\n`;
}
```

#### 2.4 Add Brand Story Context (after values section)
```typescript
// Add after line 153
if (voice.what_makes_us_different) {
  section += `- Hvad gør os unikke: ${voice.what_makes_us_different}\n`;
}

if (voice.brand_origin_story && contentType === 'brand_story') {
  section += `- Vores historie: ${voice.brand_origin_story.substring(0, 120)}...\n`;
}

if (voice.signature_approach) {
  section += `- Vores tilgang: ${voice.signature_approach}\n`;
}
```

### Priority 3: Testing & Validation (2 hours)

1. **Unit Tests**: Test prompt builder with full enrichment data
2. **Integration Tests**: Generate captions for test businesses
3. **Quality Checks**: Compare captions before/after enrichment
4. **A/B Testing**: Monitor engagement with enriched vs legacy captions

---

## Implementation Checklist

### Phase 1: Data Pass Fix (Must Do)
- [ ] Update `weekly-plan-generator.ts` lines 580-600
- [ ] Add all 12 enrichment fields to `aiContext.brandVoice`
- [ ] Test with business that has enrichment data
- [ ] Verify console logs show "ENRICHED voice fields"
- [ ] Deploy to staging for testing

### Phase 2: Prompt Enhancement (Should Do)
- [ ] Add `typical_closings` to prompt (enforce CTA usage)
- [ ] Strengthen `typical_openings` (enforce opening usage)
- [ ] Add `punctuation_style` guidance
- [ ] Add `what_makes_us_different` emphasis
- [ ] Add conditional brand story sections
- [ ] Update prompt templates for new fields

### Phase 3: Quality Improvements (Nice to Have)
- [ ] Add `sample_posts` analysis (use multiple samples)
- [ ] Add `founded_year` heritage mentions (for old businesses)
- [ ] Add `owner_perspective` for personal touch
- [ ] Fine-tune emoji usage based on `emoji_style`
- [ ] Add validation for enrichment field quality

---

## Expected Outcomes

### Before Integration (Current State)
```typescript
// AI Prompt includes:
- 5 legacy fields (tone_keywords, voice_style, values, certifications, do_not_say)
- 7 enrichment fields (signature_phrases, never_say, humor_level, formality, 
  storytelling_style, emoji_style, sample_posts)
- Weak usage of typical_openings
- No usage of typical_closings, brand story fields

// Example Caption (Generic):
"Morgenhygge med vores lækre brunch buffet! 🥐☕
Book dit bord i dag → Link i bio
#brunch #københavn #hygge #morgenmad"
```

### After Integration (Enhanced)
```typescript
// AI Prompt includes:
- All 5 legacy fields ✅
- All 14 enrichment fields ✅
- Enforced typical_openings/closings
- Brand story context
- Punctuation style guidance

// Example Caption (Branded):
"Der er en grund til at vores brunch er blevet kult-klassiker siden 2008 ☕
Ved åen har vi serveret Danmarks måske bedste røræg – cremet, økologisk, 
og lavet med smør fra Fanø 🥐
Åbent i morgen 9-13. Vi ses!
#brunchevedåen #københavnbrunch #økologisk"

// Uses:
- typical_openings: "Der er en grund til..."
- signature_phrases: "ved åen", "siden 2008"
- what_makes_us_different: "Danmarks måske bedste røræg"
- typical_closings: "Vi ses!"
- formality: casual, friendly
- emoji_style: moderate (2 emojis)
```

---

## Architecture Health Report

### ✅ Strengths
1. **Clean Layer Separation**: Each layer has clear responsibility
2. **Rule-Based Efficiency**: Layers 1-7 don't need AI (fast, predictable)
3. **Single AI Integration Point**: Only Layer 8 uses AI (cost-effective)
4. **Service Period Integration**: Working correctly ✅
5. **Data Availability**: Layer 1 fetches everything needed

### ⚠️ Weaknesses
1. **Data Pass Gap**: Layer 9 doesn't forward enrichment fields
2. **Partial Prompt Usage**: Layer 8 only uses 50% of enrichment
3. **Type/Implementation Mismatch**: Types support fields that aren't used

### 🎯 Recommendations
1. **Immediate**: Fix Layer 9 data pass (1 hour, high impact)
2. **Short-term**: Enhance Layer 8 prompts (3-4 hours, medium impact)
3. **Long-term**: Add enrichment quality validation

---

## Files Requiring Changes

### Must Change
1. **weekly-plan-generator.ts** (lines 580-600)
   - Add 12 enrichment fields to aiContext.brandVoice

### Should Change
2. **prompt-builder.ts** (lines 119-170, 335-350)
   - Add typical_closings enforcement
   - Strengthen typical_openings usage
   - Add punctuation_style guidance
   - Add brand story sections

### Testing Files
3. Create integration tests for enrichment
4. Update test fixtures with enrichment data

---

## Conclusion

The 9-layer architecture is **fundamentally sound**, with clear separation of concerns and efficient processing. The brand voice enrichment schema is **properly deployed** and **automatically fetched** in Layer 1.

**The critical issue** is a simple data pass gap in Layer 9, where enrichment fields are fetched but not forwarded to Layer 8. This is a **high-impact, low-effort fix** that will immediately enable richer brand voice in AI captions.

**Integration Status**: 7/15 fields actively used (47%)  
**Effort to Fix**: 4-5 hours total  
**Expected Impact**: Significantly more branded, authentic captions

---

*Document generated: February 9, 2026*  
*Review completed: All 9 layers audited*  
*Status: Ready for implementation*
