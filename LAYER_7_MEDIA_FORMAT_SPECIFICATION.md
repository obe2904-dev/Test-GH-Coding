# LAYER 7: MEDIA FORMAT & PLATFORM SPECIFICATION

**Status:** ✅ Implemented  
**Date:** January 29, 2026  
**Dependencies:** Layer 6 (Post Slot Optimization)  
**Feeds Into:** Layer 8 (Final Output & Brief Generation)

---

## Overview

Layer 7 determines the optimal media format (photo/carousel/reel/video) and finalizes platform assignment for each post, considering business capacity, historical performance, and platform availability.

**Core Principle:** "The right format on the right platform."

---

## Architecture

### Input (from Layer 6)

```typescript
interface OptimizedPostSlot {
  contentType: string
  opportunity: any
  score: number
  platform: string              // Preliminary assignment
  scheduledDate: Date
  dayOfWeek: number
  hour: number
  optimizationReason: string
}
```

### Processing: Two-Phase Specification

#### Phase 1: Format Selection
Determines photo vs carousel vs reel based on content type, historical performance, and business capacity.

#### Phase 2: Platform Finalization
Validates platform assignment against available platforms, applies balance enforcement.

### Output (to Layer 8)

```typescript
interface FinalPostSpecification {
  // From previous layers
  contentType: string
  opportunity: any
  score: number
  scheduledDate: Date
  dayOfWeek: number
  hour: number
  optimizationReason: string
  
  // Added by Layer 7
  format: 'photo' | 'carousel' | 'reel' | 'video'
  platform: string              // Finalized platform
  formatReason: string          // Why this format?
  platformReason: string        // Why this platform?
}
```

---

## Format Selection Matrix

### Photo (Single Image)

**Best For:**
- Single dish beauty shots
- Atmosphere scenes
- Simple behind-the-scenes moments
- Quick announcements

**Content Types:**
- `menu_highlight` (single dish)
- `location_story` (ambiance)
- `behind_scenes` (single moment)
- `engagement` (simple question/poll)

**Platforms:** All (Instagram, Facebook, TikTok as image, LinkedIn)

**Production Effort:** ⭐ Low (5 minutes)

**Example:**
- Danish Winter Stew hero shot
- Cozy corner table with candles
- Chef plating a dish

---

### Carousel (Multiple Images)

**Best For:**
- Menu variety (multiple dishes in theme)
- Step-by-step processes
- Before/after transformations
- Week-ahead previews
- Multiple angles of same subject

**Content Types:**
- `menu_highlight` (when showing variety)
- `event_promotion` (multiple event aspects)
- `behind_scenes` (process showing)

**Platforms:** Instagram (native), Facebook (supported), LinkedIn

**Production Effort:** ⭐⭐ Medium (10-15 minutes)

**Example:**
- "This Week's Specials" (3-5 dishes)
- "From Market to Plate" (4-step ingredient journey)
- "Weekend Brunch Menu" (5 brunch items)

**Carousel Rules:**
- Min 2 images, max 10 images
- All images should be thematically connected
- First image is most important (hook)

---

### Reel (Short Video)

**Best For:**
- Action and movement
- Cooking processes (sizzle, pour, flip)
- Atmosphere with sound (music, energy)
- Team energy and personality
- High engagement content

**Content Types:**
- `menu_highlight` (dynamic dishes - latte art, steak on grill)
- `atmosphere` (bustling venue, live music)
- `behind_scenes` (cooking action, team fun)
- `event_promotion` (event energy preview)

**Platforms:** Instagram Reels (priority), Facebook Reels, TikTok

**Production Effort:** ⭐⭐⭐ High (20-30 minutes)

**Requirements:**
- Must justify higher production effort
- Only when performance data supports it (+40% better engagement)
- Max 40% of total posts for small businesses (capacity constraint)

**Example:**
- Latte art pour in slow motion
- Steak sizzling on hot grill
- Friday night busy restaurant energy
- Bartender shaking cocktails

---

### Video (Standard Video)

**Best For:**
- Longer explanations
- Interviews
- Event coverage
- Tutorials

**Platforms:** TikTok (primary), Facebook, Instagram (as Reel)

**Production Effort:** ⭐⭐⭐ High

**Note:** For Instagram/Facebook, treat as Reel. TikTok native format.

---

## Format Decision Algorithm

### Step 1: Check Content Fit

```typescript
function getContentFormatPreference(contentType: string): string[] {
  const preferences = {
    menu_highlight: ['photo', 'reel', 'carousel'],
    location_story: ['photo', 'reel'],
    atmosphere: ['reel', 'photo'],
    behind_scenes: ['reel', 'carousel', 'photo'],
    engagement: ['photo', 'carousel'],
    event_promotion: ['carousel', 'photo', 'reel'],
  }
  return preferences[contentType] || ['photo']
}
```

### Step 2: Check Historical Performance

```typescript
function shouldIncreaseReels(performanceData: any): boolean {
  if (!performanceData || !performanceData.format_performance) {
    return false
  }
  
  const reelEngagement = performanceData.format_performance.reel?.avg_engagement
  const photoEngagement = performanceData.format_performance.photo?.avg_engagement
  
  if (!reelEngagement || !photoEngagement) {
    return false
  }
  
  // If Reels perform +40% better, increase frequency
  return reelEngagement > photoEngagement * 1.4
}
```

### Step 3: Apply Capacity Constraints

```typescript
function respectCapacityConstraints(
  proposedFormat: string,
  recentFormats: string[],
  businessType: string
): string {
  if (proposedFormat !== 'reel') {
    return proposedFormat
  }
  
  // Count recent Reels (last 10 posts)
  const reelCount = recentFormats.filter(f => f === 'reel').length
  const reelPercentage = reelCount / recentFormats.length
  
  // Max 40% Reels for small businesses (FSE, SBO)
  const maxReelPercentage = ['FSE', 'SBO'].includes(businessType) ? 0.4 : 0.5
  
  if (reelPercentage >= maxReelPercentage) {
    return 'photo' // Fallback to photo
  }
  
  return proposedFormat
}
```

### Step 4: Default to Photo

When uncertain or constraints block other formats, default to photo (fastest, safest).

---

## Platform Finalization

### Step 1: Fetch Available Platforms

```typescript
async function getAvailablePlatforms(userId: string): Promise<string[]> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('selected_platforms')
    .eq('id', userId)
    .single()
  
  return profile?.selected_platforms || ['instagram'] // Default to Instagram
}
```

### Step 2: Platform-Format Compatibility

```typescript
const PLATFORM_FORMATS: Record<string, string[]> = {
  instagram: ['photo', 'carousel', 'reel'],
  facebook: ['photo', 'carousel', 'reel'],
  tiktok: ['video', 'reel'],
  linkedin: ['photo', 'carousel'],
}

function isPlatformCompatible(platform: string, format: string): boolean {
  const supportedFormats = PLATFORM_FORMATS[platform] || ['photo']
  return supportedFormats.includes(format)
}
```

### Step 3: Content Type → Platform Affinity

```typescript
const PLATFORM_AFFINITY = {
  instagram: ['menu_highlight', 'atmosphere', 'behind_scenes', 'reel_content'],
  facebook: ['event_promotion', 'engagement', 'functional_info'],
  tiktok: ['reel_content', 'behind_scenes', 'atmosphere'],
  linkedin: ['event_promotion', 'professional_content'],
}
```

### Step 4: Balance Enforcement

```typescript
function enforceBalancing(
  proposedPlatform: string,
  recentPlatforms: string[],
  availablePlatforms: string[]
): string {
  if (availablePlatforms.length === 1) {
    return availablePlatforms[0] // Single platform - no balancing needed
  }
  
  // Rule 1: Last 3 posts all same platform?
  const last3 = recentPlatforms.slice(-3)
  if (last3.length === 3 && last3.every(p => p === last3[0])) {
    // Force switch to different platform
    const otherPlatforms = availablePlatforms.filter(p => p !== last3[0])
    return otherPlatforms[0] || proposedPlatform
  }
  
  // Rule 2: Platform neglected (0 posts in last 7)?
  const last7 = recentPlatforms.slice(-7)
  for (const platform of availablePlatforms) {
    if (!last7.includes(platform)) {
      // This platform hasn't been used in 7 posts
      return platform
    }
  }
  
  return proposedPlatform
}
```

---

## Implementation

### Core Function

```typescript
export async function selectMediaFormatAndPlatform(
  optimizedSlot: OptimizedPostSlot,
  businessId: string,
  userId: string,
  supabaseClient: any
): Promise<FinalPostSpecification> {
  
  // Fetch business context
  const { data: profile } = await supabaseClient
    .from('business_profile')
    .select('business_type')
    .eq('business_id', businessId)
    .single()
  
  const businessType = profile?.business_type || 'FSE'
  
  // Fetch available platforms
  const availablePlatforms = await getAvailablePlatforms(userId)
  
  // Fetch performance data
  const { data: performanceData } = await supabaseClient
    .from('content_performance_log')
    .select('format_performance, recent_formats, recent_platforms')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(10)
  
  const recentFormats = performanceData?.map(p => p.format) || []
  const recentPlatforms = performanceData?.map(p => p.platform) || []
  
  // PHASE 1: Format Selection
  
  // Step 1: Get content type preferences
  const formatPreferences = getContentFormatPreference(optimizedSlot.contentType)
  
  // Step 2: Check if Reels should be prioritized
  const shouldPrioritizeReels = shouldIncreaseReels(performanceData?.[0])
  
  let selectedFormat = formatPreferences[0] // Default to first preference
  
  if (shouldPrioritizeReels && formatPreferences.includes('reel')) {
    selectedFormat = 'reel'
  }
  
  // Step 3: Apply capacity constraints
  selectedFormat = respectCapacityConstraints(
    selectedFormat,
    recentFormats,
    businessType
  )
  
  // PHASE 2: Platform Finalization
  
  // Step 1: Check format compatibility with proposed platform
  let finalPlatform = optimizedSlot.platform
  
  if (!availablePlatforms.includes(finalPlatform)) {
    finalPlatform = availablePlatforms[0] // Use first available
  }
  
  if (!isPlatformCompatible(finalPlatform, selectedFormat)) {
    // Find compatible platform
    finalPlatform = availablePlatforms.find(p => 
      isPlatformCompatible(p, selectedFormat)
    ) || availablePlatforms[0]
  }
  
  // Step 2: Apply balance enforcement
  finalPlatform = enforceBalancing(
    finalPlatform,
    recentPlatforms,
    availablePlatforms
  )
  
  // Generate reasons
  const formatReason = generateFormatReason(
    selectedFormat,
    optimizedSlot.contentType,
    shouldPrioritizeReels
  )
  
  const platformReason = generatePlatformReason(
    finalPlatform,
    selectedFormat,
    optimizedSlot.contentType
  )
  
  return {
    ...optimizedSlot,
    format: selectedFormat,
    platform: finalPlatform,
    formatReason,
    platformReason,
  }
}
```

---

## Example: FSE Weekly Plan Format & Platform Assignment

### Input from Layer 6:
```
1. Monday 16:00: Danish Winter Stew (dinner_menu, Instagram)
2. Thursday 18:00: Weekend Brunch Special (breakfast_menu, Instagram)
3. Friday 18:00: Riverside Ambiance (location_story, Instagram)
4. Saturday 10:00: Kitchen Prep Story (behind_scenes, Facebook)
```

### Layer 7 Processing:

**Post 1: Danish Winter Stew**
- Content: Single dish, beauty shot
- Format preference: photo > reel > carousel
- Historical: Reels +50% better engagement
- Decision: **Photo** (single dish, simple and fast)
- Platform: Instagram (visual priority, compatible)
- Reason: "Single dish beauty shot, Instagram feed optimal"

**Post 2: Weekend Brunch Special**
- Content: Promoting variety of brunch items
- Format preference: carousel > photo
- Historical: N/A
- Decision: **Carousel** (5 brunch dishes)
- Platform: Instagram (carousel native support)
- Reason: "Carousel showcasing brunch variety"

**Post 3: Riverside Ambiance**
- Content: Atmosphere with sound potential
- Format preference: reel > photo
- Historical: Reels +50% better
- Capacity: 0/4 reels so far (0% - under 40% limit)
- Decision: **Reel** (ambiance with sound, evening lights)
- Platform: Instagram Reels (format priority)
- Reason: "Atmospheric Reel with evening ambiance"

**Post 4: Kitchen Prep Story**
- Content: Cooking process, action
- Format preference: reel > carousel > photo
- Historical: Reels +50% better
- Capacity: 1/4 reels (25% - under limit)
- Balancing: Last 3 posts all Instagram → Force Facebook
- Decision: **Reel** (cooking action)
- Platform: **Facebook** (balance enforcement)
- Reason: "Behind-scenes Reel, balanced to Facebook"

### Output to Layer 8:
```
Final Specifications:
1. Mon 16:00: Danish Winter Stew | Photo | Instagram
2. Thu 18:00: Weekend Brunch | Carousel (5 images) | Instagram
3. Fri 18:00: Riverside Ambiance | Reel (15-30s) | Instagram
4. Sat 10:00: Kitchen Prep | Reel (15-30s) | Facebook

Format Mix: 25% Photo, 25% Carousel, 50% Reels
Platform Mix: 75% Instagram, 25% Facebook
```

---

## Database Integration

### Existing Tables Used

**`profiles.selected_platforms`:**
```sql
selected_platforms text[] -- ['instagram', 'facebook', 'tiktok']
```

**`content_performance_log`:**
- `format` (photo/carousel/reel)
- `platform` (instagram/facebook)
- `engagement_rate`
- `created_at`

**`content_type_baselines`:**
- `format_performance` (JSON: avg engagement by format)

### No New Tables Required

Layer 7 uses existing data structures.

---

## Testing Strategy

### Unit Tests
1. Format selection for each content type
2. Historical performance influence
3. Capacity constraints (40% Reel max)
4. Platform compatibility checking
5. Balance enforcement (last 3, 7-day neglect)

### Integration Tests
1. Single platform business (no balancing)
2. Multi-platform business (balancing active)
3. TikTok-only business (video format only)
4. Performance-driven Reel increase
5. Capacity constraint blocking Reels

### Expected Outputs
- Photos for simple content
- Carousels for variety/process
- Reels when performance justifies + capacity allows
- Platform switching enforced after 3 consecutive
- Format-platform compatibility respected

---

## Success Metrics

**Format Distribution:**
- [ ] Photo: 40-60% (baseline)
- [ ] Carousel: 20-30% (variety)
- [ ] Reel: 20-40% (when performance justifies)

**Platform Balance (2+ platforms):**
- [ ] No platform neglected >7 posts
- [ ] No more than 3 consecutive posts to same platform
- [ ] Balance respects Layer 2 weights (50/50, 70/30, etc.)

**Performance Correlation:**
- [ ] Reels increase when performing +40% better
- [ ] Capacity constraints prevent Reel overload

---

## Next: Layer 8

Layer 7 output feeds into Layer 8 (Final Output & Brief Generation):
- Takes final format + platform specifications
- Generates content brief (what to photograph/create)
- Specifies caption structure
- Provides visual requirements
- Ready for execution

---

## Implementation Files

**Core Engine:**
- `supabase/functions/_shared/post-helpers/media-format-selector.ts`

**Support Files:**
- `format-decision-rules.ts` (format selection logic)
- `platform-compatibility.ts` (format-platform validation)
- `balance-enforcement.ts` (platform balancing)

**Migration:**
- None required (uses existing tables)

**Testing:**
- `test-layer7-format-selection.ts` (comprehensive test suite)
