# Seasonal Audience Data Flow Analysis
**Analysis Date**: 1. maj 2026  
**Analyst**: GitHub Copilot  
**Scope**: Complete trace of seasonal data through content generation pipeline

---

## Executive Summary

This analysis reveals that **seasonal data exists in the system but is NOT currently used** in content generation. The `seasonalVariation` field is:
- ✅ **Defined** in schema (April 2026)
- ✅ **Populated** by brand profile generator for qualifying businesses
- ✅ **Stored** in database
- ✅ **Retrieved** by content systems
- ❌ **NOT USED** in audience matching or content generation logic

**Key Finding**: Seasonal filtering infrastructure is **ready for integration** but requires implementation in the persona-matcher and content prompt builders.

---

## 1. Current Seasonal Data Structure

### 1.1 Schema Definition

**Location**: `business_brand_profile.audience_framework` JSONB column

**Migration**: [20260430000001_add_audience_voice_framework.sql](supabase/migrations/20260430000001_add_audience_voice_framework.sql)

**TypeScript Interface**:
```typescript
interface AudienceFramework {
  primaryAudiences: string[]
  locationContexts: LocationContext[]
  timeSlots: TimeSlot[]
  seasonalVariation: {
    summer: { 
      audiences: string[]
      emphasis: string 
    }
    winter: { 
      audiences: string[]
      emphasis: string 
    }
  } | null  // Can be null if business doesn't need seasonal variation
  complexity: 'simple' | 'moderate' | 'complex'
}
```

### 1.2 Structure Details

**Summer Object**:
- `audiences`: Array of audience labels (e.g., `["turister", "destinationsbesøgende", "familier", "par"]`)
- `emphasis`: String describing seasonal context (e.g., `"udendørs oplevelse, vandfront-atmosphære"`)

**Winter Object**:
- `audiences`: Array of audience labels (e.g., `["lokale", "stamgæster", "hverdagsgæster"]`)
- `emphasis`: String describing seasonal context (e.g., `"hyggelig indendørs stemning"`)

**Null Condition**:
Returns `null` when business doesn't meet seasonal criteria:
- No outdoor seating AND
- No seasonal location context (not waterfront/tourist area)

### 1.3 Example Data Structure

```json
{
  "primaryAudiences": ["destinationsbesøgende", "familier", "kontoransatte", "turister", "par"],
  "locationContexts": [
    {
      "type": "waterfront_tourist",
      "score": 85,
      "audiences": ["destinationsbesøgende", "turister", "par", "familier"],
      "seasonal": true
    }
  ],
  "timeSlots": [
    {
      "programmes": ["brunch"],
      "audiences": ["weekendgæster", "par"],
      "contexts": ["weekend-brunch"],
      "hourRange": { "start": 7, "end": 12 }
    }
  ],
  "seasonalVariation": {
    "summer": {
      "audiences": ["turister", "destinationsbesøgende", "familier", "par"],
      "emphasis": "udendørs oplevelse, vandfront-atmosphære"
    },
    "winter": {
      "audiences": ["lokale", "stamgæster", "hverdagsgæster"],
      "emphasis": "hyggelig indendørs stemning"
    }
  },
  "complexity": "complex"
}
```

### 1.4 Businesses with Seasonal Data

**Criteria for Population** ([fallback-builders.ts:1392-1410](supabase/functions/_shared/brand-profile/repair/fallback-builders.ts#L1392-L1410)):
```typescript
function buildSeasonalProfiles(dataSources, locationContexts) {
  const ops = dataSources?.operations || {}
  
  // Only create seasonal variation if there's a seasonal context
  const hasSeasonalContext = locationContexts.some(c => c.seasonal)
  
  if (!hasSeasonalContext && !ops.has_outdoor_seating) {
    return null  // No seasonal variation for indoor-only, non-tourist businesses
  }
  
  return {
    summer: {
      audiences: ['turister', 'destinationsbesøgende', 'familier', 'par'],
      emphasis: 'udendørs oplevelse, vandfront-atmosphære'
    },
    winter: {
      audiences: ['lokale', 'stamgæster', 'hverdagsgæster'],
      emphasis: 'hyggelig indendørs stemning'
    }
  }
}
```

**Qualifying Businesses**:
1. **Waterfront/tourist venues** with `locationContexts` containing `seasonal: true`
2. **Outdoor seating venues** (`operations.has_outdoor_seating = true`)

**Examples**:
- ✅ Café Faust (waterfront, outdoor seating) → HAS seasonal data
- ✅ Beach café (tourist area, outdoor) → HAS seasonal data
- ❌ Downtown café (indoor only, no tourist context) → NO seasonal data
- ❌ City center restaurant (no outdoor seating) → NO seasonal data

---

## 2. Audience Matching Flow

### 2.1 Complete Call Chain

**User Request** → **get-quick-suggestions** → **persona-matcher** → **Audience Selection**

#### Step 1: get-quick-suggestions Retrieves Data
**File**: [get-quick-suggestions/index.ts:1221-1222](supabase/functions/get-quick-suggestions/index.ts#L1221-L1222)
```typescript
const { data: brandProfile } = await supabase
  .from('business_brand_profile')
  .select('brand_essence, tone_of_voice, ..., audience_framework, ...')
  .eq('business_id', businessId)
```

**Result**: Retrieves `audience_framework` (including `seasonalVariation`)

#### Step 2: Extract Framework
**File**: [get-quick-suggestions/index.ts:1358](supabase/functions/get-quick-suggestions/index.ts#L1358)
```typescript
const audienceFramework = (brandProfile as any).audience_framework
const rawAudienceSegments = (brandProfile as any).audience_segments
```

**Result**: Extracts framework with seasonal data intact

#### Step 3: Call Persona Matcher
**File**: [get-quick-suggestions/index.ts:1386-1393](supabase/functions/get-quick-suggestions/index.ts#L1386-L1393)
```typescript
const now = new Date()
const personaMatch: PersonaMatchResult = await matchPersonaToCurrentHour(
  audienceFramework,
  rawAudienceSegments,
  now.getHours(),      // 0-23
  now.getDay(),        // 0-6 (Sunday-Saturday)
  supabase,
  businessId
)

targetAudienceText = personaMatch.audienceText
```

**Result**: Calls matcher with current time but **NO MONTH/SEASON parameter**

#### Step 4: Persona Matcher Logic
**File**: [persona-matcher.ts:238-390](supabase/functions/_shared/persona-matcher.ts#L238-L390)

**Priority Order**:
1. **Primary**: `audience_framework.timeSlots` (programme-based, time-aware)
2. **Fallback**: `audience_framework.primaryAudiences` (generic top-level)
3. **Legacy**: `audience_segments` (B5 format, time-filtered)

**Current Matching Logic**:
```typescript
// Find matching time slot based on programmes
let matchingSlot = audienceFramework.timeSlots.find((slot) => {
  // Check if current hour matches programme hour range
  const programmes = slot.programmes
  
  // If hourRange explicitly set, use it
  if (slot.hourRange) {
    return isHourInRange(currentHour, slot.hourRange.start, slot.hourRange.end)
  }
  
  // Otherwise, use hardcoded programme hour mapping
  const range = getProgrammeHourRange(programmes)  // e.g., "brunch" → [7, 12]
  return isHourInRange(currentHour, start, end)
})

// Extract audiences from matched slot
if (matchingSlot?.audiences) {
  return {
    audienceText: matchingSlot.audiences.join(', '),  // ← RETURNED AUDIENCES
    programmes: matchingSlot.programmes,
    source: 'timeSlots'
  }
}
```

**❌ NO SEASONAL FILTERING**: 
- Function receives `currentHour` and `currentDayOfWeek`
- Does NOT receive `currentMonth` or `currentSeason`
- Does NOT check `seasonalVariation` at any point
- Returns audiences from `timeSlots` without seasonal adjustment

### 2.2 Parameters Influencing Audience Selection

**Current Parameters**:
1. ✅ **Current Hour** (0-23) → Maps to programme via `getProgrammeHourRange()`
2. ✅ **Day of Week** (0-6) → Used for day exclusions (Task 4.4)
3. ✅ **Recent Posts** → Programme rotation to prevent repetition
4. ❌ **Month/Season** → NOT USED

**Missing Parameters**:
- Current month (0-11)
- Current season (summer/winter/spring/autumn)

### 2.3 Example Audience Selection Flows

#### Scenario A: Waterfront Café, 10:00 on Tuesday in July
**Input**:
- `currentHour = 10`
- `currentDayOfWeek = 2` (Tuesday)
- `audienceFramework.seasonalVariation.summer.audiences = ["turister", "destinationsbesøgende"]`
- `audienceFramework.timeSlots[0].programmes = ["brunch"]`
- `audienceFramework.timeSlots[0].audiences = ["weekendgæster", "par", "lokale"]`

**Current Behavior**:
1. Hour 10 → matches "brunch" slot (7-12)
2. Returns: `"weekendgæster, par, lokale"` ← Generic audiences
3. ❌ Does NOT use summer tourists from `seasonalVariation`

**Expected Behavior** (with seasonal filtering):
1. Hour 10 → matches "brunch" slot
2. Month = July → summer season
3. Returns: `"turister, destinationsbesøgende, par"` ← Summer-appropriate audiences

#### Scenario B: Same Café, 10:00 on Tuesday in January
**Input**:
- `currentHour = 10`
- `currentDayOfWeek = 2` (Tuesday)
- `audienceFramework.seasonalVariation.winter.audiences = ["lokale", "stamgæster"]`

**Current Behavior**:
- Returns: `"weekendgæster, par, lokale"` ← Same as summer!

**Expected Behavior** (with seasonal filtering):
- Returns: `"lokale, stamgæster"` ← Winter-appropriate audiences

---

## 3. Current Gaps

### 3.1 Is seasonalVariation Used ANYWHERE?

**Search Results**: Searched entire codebase for `seasonalVariation` usage

**Findings**:
1. ✅ **Defined** in schema ([20260430000001_add_audience_voice_framework.sql](supabase/migrations/20260430000001_add_audience_voice_framework.sql))
2. ✅ **Built** by brand profile generator ([fallback-builders.ts:1392-1410](supabase/functions/_shared/brand-profile/repair/fallback-builders.ts#L1392-L1410))
3. ✅ **Retrieved** by get-weekly-strategy ([get-weekly-strategy/index.ts:1224](supabase/functions/get-weekly-strategy/index.ts#L1224))
4. ✅ **Retrieved** by get-quick-suggestions (via `audience_framework` select)
5. ❌ **NOT FILTERED** in persona-matcher.ts
6. ❌ **NOT USED** in content prompts
7. ❌ **NOT DISPLAYED** in UI

**Conclusion**: Data exists, is stored, is retrieved, but **never applied** to content decisions.

### 3.2 Are There Any Seasonal Adjustments Now?

**Month-Based Filtering** ([generate-text-from-idea/resolve-context.ts:93-100](supabase/functions/generate-text-from-idea/resolve-context.ts#L93-L100)):

```typescript
// ── segmentActiveInMonth ─────────────────────────────────────────────────
// Returns true when the segment is active in the given month (0-based).
// Segments with active_months = null / empty array are treated as year-round.
function segmentActiveInMonth(seg: { active_months?: string[] | null }, monthOfYear: number): boolean {
  const am = seg.active_months
  if (!am || !Array.isArray(am) || am.length === 0) return true
  const MONTH_ABBR = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
  return am.includes(MONTH_ABBR[monthOfYear])
}
```

**Usage**: This is used in `generate-text-from-idea` (post text generation) for **legacy audience_segments**, NOT for the modern `audience_framework.seasonalVariation`.

**Seasonal Context Signal** ([resolve-context.ts:224-276](supabase/functions/generate-text-from-idea/resolve-context.ts#L224-L276)):

```typescript
function computeSeasonalContextSignal(
  now: Date,
  categoryScores: Record<string, number>,
  _language: string
): string {
  const month = now.getMonth() // 0-based: 0=Jan, 11=Dec
  const dow = now.getDay()
  const isWeekend = dow === 0 || dow === 5 || dow === 6

  // Find top location category by score
  const topCategory = Object.entries(categoryScores)
    .filter(([, v]) => typeof v === 'number')
    .sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'city_centre'

  const SEASONAL_PATTERN_MAP: Record<string, string> = {
    waterfront: 'summer_peak', 
    tourist: 'summer_peak', 
    nature_park: 'summer_peak',
    student: 'semester_only', 
    office: 'weekday_only',
  }
  const pattern = SEASONAL_PATTERN_MAP[topCategory] ?? 'year_round'

  // Month → season label (Danish)
  const monthSeason = month >= 5 && month <= 7 ? 'sommer'
    : month >= 3 && month <= 4 ? 'forår'
    : month >= 8 && month <= 9 ? 'efterår'
    : month === 11 ? 'december'
    : 'vinter'

  const dayType = isWeekend ? 'weekend' : 'hverdag'
  const parts = [`${monthSeason}, ${dayType}`]

  if (pattern === 'summer_peak') {
    const isPeak = month >= 5 && month <= 7
    const isLow = month <= 2 || month === 10 || month === 11
    parts.push(isPeak ? 'højsæson for vandkant/turistbesøg'
      : isLow ? 'lavsæson — primært lokale stamgæster'
      : 'skuldersæson for vandkant/turistbesøg')
  }
  
  return parts.join(' — ')
}
```

**Usage**: This creates a **narrative signal for prompts** (e.g., "sommer, weekend — højsæson for vandkant/turistbesøg") but does NOT filter audiences.

**Conclusion**: 
- ✅ Month-based filtering EXISTS for legacy segments
- ✅ Seasonal context signal EXISTS for prompt enhancement
- ❌ Seasonal audience filtering does NOT exist for modern `audience_framework`

### 3.3 What Happens in Different Months/Seasons Currently?

**Waterfront Café Example**:

| Month | Current Behavior | Audience Returned | Issue |
|-------|------------------|-------------------|-------|
| January (winter) | Matches "brunch" slot (10:00) | "weekendgæster, par, lokale" | ❌ Ignores that tourists are rare in winter |
| July (summer) | Matches "brunch" slot (10:00) | "weekendgæster, par, lokale" | ❌ Ignores that tourists are primary audience |
| April (spring) | Matches "brunch" slot (10:00) | "weekendgæster, par, lokale" | ❌ Same generic audiences year-round |

**Content Generation Impact**:
- Posts in summer target same audiences as winter
- Miss opportunity to emphasize tourist appeal in peak season
- Miss opportunity to emphasize local loyalty in off-season
- `seasonalContextSignal` provides narrative hint but doesn't change audience focus

**Example Posts** (same café, same hour, different months):
- **January Post**: "Weekendgæster, par, lokale — kom til brunch ved åen" ← Targets tourists when none are present
- **July Post**: "Weekendgæster, par, lokale — kom til brunch ved åen" ← Misses primary summer audience (tourists)

---

## 4. Integration Points for Seasonal Filtering

### 4.1 Where to Add Seasonal Logic

#### Option A: Extend persona-matcher.ts (RECOMMENDED)

**File**: [persona-matcher.ts:238-390](supabase/functions/_shared/persona-matcher.ts#L238-L390)

**Current Function Signature**:
```typescript
export async function matchPersonaToCurrentHour(
  audienceFramework: AudienceFramework | null,
  audienceSegments: AudienceSegment[] | null,
  currentHour: number,
  currentDayOfWeek: number,
  supabase?: SupabaseClient,
  businessId?: string
): Promise<PersonaMatchResult>
```

**Proposed Enhancement**:
```typescript
export async function matchPersonaToCurrentHour(
  audienceFramework: AudienceFramework | null,
  audienceSegments: AudienceSegment[] | null,
  currentHour: number,
  currentDayOfWeek: number,
  currentMonth: number,  // ← NEW: 0-11 (January-December)
  supabase?: SupabaseClient,
  businessId?: string
): Promise<PersonaMatchResult>
```

**Integration Logic**:
```typescript
// After matching time slot...
if (matchingSlot?.audiences) {
  let finalAudiences = matchingSlot.audiences
  
  // SEASONAL FILTERING (NEW)
  if (audienceFramework?.seasonalVariation && currentMonth !== undefined) {
    const season = getSeasonFromMonth(currentMonth)  // 'summer' | 'winter'
    const seasonalData = audienceFramework.seasonalVariation[season]
    
    if (seasonalData?.audiences && seasonalData.audiences.length > 0) {
      // Blend seasonal audiences with time slot audiences
      // Prioritize seasonal audiences but keep 1-2 time-specific ones
      finalAudiences = [
        ...seasonalData.audiences.slice(0, 3),  // Top 3 seasonal
        ...matchingSlot.audiences.slice(0, 1)   // 1 time-specific
      ]
    }
  }
  
  return {
    audienceText: finalAudiences.join(', '),
    programmes: matchingSlot.programmes,
    source: 'timeSlots',
    metadata: {
      seasonalAdjustment: seasonalData ? true : false
    }
  }
}
```

**Pros**:
- ✅ Centralized logic (used by both Weekly Plan and Dagens Forslag)
- ✅ Minimal changes to calling code
- ✅ Backward compatible (month parameter optional)
- ✅ Testable in isolation

**Cons**:
- ⚠️ Requires updating all callers to pass `currentMonth`

#### Option B: Post-process in get-quick-suggestions

**File**: [get-quick-suggestions/index.ts:1386-1395](supabase/functions/get-quick-suggestions/index.ts#L1386-L1395)

**Implementation**:
```typescript
const personaMatch = await matchPersonaToCurrentHour(...)
let targetAudienceText = personaMatch.audienceText

// SEASONAL OVERRIDE (NEW)
if (audienceFramework?.seasonalVariation) {
  const month = new Date().getMonth()
  const season = month >= 4 && month <= 9 ? 'summer' : 'winter'
  const seasonalData = audienceFramework.seasonalVariation[season]
  
  if (seasonalData?.audiences && seasonalData.audiences.length > 0) {
    // Replace with seasonal audiences
    targetAudienceText = seasonalData.audiences.slice(0, 3).join(', ')
  }
}
```

**Pros**:
- ✅ Minimal changes to persona-matcher
- ✅ Quick implementation

**Cons**:
- ❌ Duplicates logic if Weekly Plan needs same filtering
- ❌ Harder to test (buried in 2700-line file)
- ❌ Less maintainable

**Recommendation**: **Option A** (extend persona-matcher)

### 4.2 Functions/Methods Requiring Modification

**Required Changes**:

1. **persona-matcher.ts** (Core Logic)
   - Add `currentMonth` parameter to `matchPersonaToCurrentHour()`
   - Add `getSeasonFromMonth()` helper function
   - Integrate seasonal filtering after time slot matching
   - Update `PersonaMatchResult` metadata to include seasonal flag

2. **get-quick-suggestions/index.ts** (Dagens Forslag)
   - Line 1390: Update `matchPersonaToCurrentHour()` call to pass `now.getMonth()`
   
3. **get-weekly-strategy/index.ts** (Weekly Plan)
   - Find existing `matchPersonaToCurrentHour()` call (if any)
   - Update to pass current month

4. **Helper Functions** (NEW)
   ```typescript
   function getSeasonFromMonth(month: number): 'summer' | 'winter' {
     // April-September = summer (months 3-8)
     // October-March = winter (months 9-11, 0-2)
     return (month >= 3 && month <= 8) ? 'summer' : 'winter'
   }
   ```

### 4.3 Call Chain with Seasonal Integration

**Updated Flow**:

```
User Request
  ↓
get-quick-suggestions/index.ts
  ↓ calls (with month parameter)
persona-matcher.ts::matchPersonaToCurrentHour()
  ↓ uses
1. currentHour → match time slot (e.g., "brunch" 7-12)
2. currentDayOfWeek → check day exclusions
3. currentMonth → determine season (summer/winter)  ← NEW
  ↓ returns
{ 
  audienceText: "turister, destinationsbesøgende, par",  ← Seasonal blend
  programmes: ["brunch"],
  seasonalAdjustment: true  ← NEW metadata
}
  ↓
Content generation uses seasonal audiences
```

---

## 5. Existing Season Detection

### 5.1 Current Date/Month Logic

**Month Extraction** ([resolve-context.ts:82-90](supabase/functions/generate-text-from-idea/resolve-context.ts#L82-L90)):
```typescript
function getDanishNow(): Date {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('da', {
    timeZone: 'Europe/Copenhagen',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(now)
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value ?? '0', 10)
  return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
}
```

**Usage**: Already used in `generate-text-from-idea` for timezone-aware date handling.

**Season Mapping** ([resolve-context.ts:248-254](supabase/functions/generate-text-from-idea/resolve-context.ts#L248-L254)):
```typescript
// Month → season label (Danish)
const monthSeason = month >= 5 && month <= 7 ? 'sommer'
  : month >= 3 && month <= 4 ? 'forår'
  : month >= 8 && month <= 9 ? 'efterår'
  : month === 11 ? 'december'
  : 'vinter'
```

**Current Mapping**:
- **Summer** (sommer): June-August (months 5-7)
- **Spring** (forår): April-May (months 3-4)
- **Autumn** (efterår): September-October (months 8-9)
- **December** (december): December (month 11)
- **Winter** (vinter): January-March (months 0-2)

### 5.2 Proposed Season Detection for Audience Filtering

**Simplified Binary Mapping** (matches `seasonalVariation` schema):
```typescript
function getSeasonFromMonth(month: number): 'summer' | 'winter' {
  // Danish tourism season: April-September
  // Off-season: October-March
  return (month >= 3 && month <= 8) ? 'summer' : 'winter'
}
```

**Rationale**:
- Aligns with current `seasonalVariation` structure (only 2 seasons)
- April-September = outdoor season, tourist peak
- October-March = indoor season, local focus
- Simple binary logic (no need for 4-season granularity)

### 5.3 Country-Specific Seasonal Definitions

**Current State**: System is Denmark-focused (Danish month labels, Copenhagen timezone)

**Future Enhancement** (if expanding to other countries):
```typescript
function getSeasonFromMonth(month: number, country: string): 'summer' | 'winter' {
  // Northern Hemisphere (Denmark, Sweden, Germany)
  if (['Denmark', 'Sweden', 'Germany'].includes(country)) {
    return (month >= 3 && month <= 8) ? 'summer' : 'winter'
  }
  
  // Southern Hemisphere (future: Australia, New Zealand)
  if (['Australia', 'New Zealand'].includes(country)) {
    return (month >= 9 || month <= 2) ? 'summer' : 'winter'  // Inverted
  }
  
  // Year-round tropical (future: Southeast Asia)
  if (['Thailand', 'Singapore'].includes(country)) {
    return 'summer'  // No winter season
  }
  
  // Default: Northern Hemisphere
  return (month >= 3 && month <= 8) ? 'summer' : 'winter'
}
```

**Current Recommendation**: Hardcode Danish seasons (simplicity), add country parameter later if needed.

---

## 6. Code Snippets & File Paths

### 6.1 seasonalVariation Population

**File**: [fallback-builders.ts:1392-1410](supabase/functions/_shared/brand-profile/repair/fallback-builders.ts#L1392-L1410)

```typescript
/**
 * Build seasonal audience profiles.
 * Only relevant for outdoor venues or tourist areas.
 */
function buildSeasonalProfiles(
  dataSources: DataSources, 
  locationContexts: LocationContext[]
): AudienceFramework['seasonalVariation'] {
  const ops = (dataSources as any)?.operations || {}
  
  // Only create seasonal variation if there's a seasonal context
  const hasSeasonalContext = locationContexts.some(c => c.seasonal)
  
  if (!hasSeasonalContext && !ops.has_outdoor_seating) {
    return null
  }
  
  return {
    summer: {
      audiences: ['turister', 'destinationsbesøgende', 'familier', 'par'],
      emphasis: 'udendørs oplevelse, vandfront-atmosphære'
    },
    winter: {
      audiences: ['lokale', 'stamgæster', 'hverdagsgæster'],
      emphasis: 'hyggelig indendørs stemning'
    }
  }
}

// Called from:
export function buildAudienceFrameworkDeterministic(dataSources, language) {
  const locationContexts = detectLocationContexts(dataSources)
  const seasonalVariation = buildSeasonalProfiles(dataSources, locationContexts)
  
  return {
    primaryAudiences,
    locationContexts,
    timeSlots,
    seasonalVariation,  // ← Populated here
    complexity
  }
}
```

**Line Numbers**: 1392-1447

### 6.2 Audience Filtering/Selection

**File**: [persona-matcher.ts:238-390](supabase/functions/_shared/persona-matcher.ts#L238-L390)

**Current Logic** (NO seasonal filtering):
```typescript
export async function matchPersonaToCurrentHour(
  audienceFramework: AudienceFramework | null,
  audienceSegments: AudienceSegment[] | null,
  currentHour: number,
  currentDayOfWeek: number,
  supabase?: SupabaseClient,
  businessId?: string
): Promise<PersonaMatchResult> {
  // PATH 1: audience_framework.timeSlots (Primary)
  if (audienceFramework?.timeSlots && Array.isArray(audienceFramework.timeSlots)) {
    // Find matching time slot based on programmes
    let matchingSlot = audienceFramework.timeSlots.find((slot) => {
      const programmes = Array.isArray(slot.programmes) ? slot.programmes : []
      
      // If hourRange explicitly set, use it
      if (slot.hourRange) {
        return isHourInRange(currentHour, slot.hourRange.start, slot.hourRange.end)
      }
      
      // Otherwise, use hardcoded programme hour mapping
      const range = getProgrammeHourRange(programmes)
      if (!range) return false
      const [start, end] = range
      return isHourInRange(currentHour, start, end)
    })
    
    // Programme rotation logic (checks recent posts)
    if (matchingSlot && supabase && businessId) {
      // ... rotation code ...
    }
    
    // AUDIENCE EXTRACTION (NO SEASONAL FILTERING)
    if (matchingSlot?.audiences && Array.isArray(matchingSlot.audiences)) {
      return {
        audienceText: matchingSlot.audiences.join(', '),  // ← Generic audiences
        programmes: Array.isArray(matchingSlot.programmes) ? matchingSlot.programmes : [],
        source: 'timeSlots'
      }
    }
  }
  
  // PATH 2: audience_framework.primaryAudiences (Fallback)
  if (audienceFramework?.primaryAudiences) {
    return {
      audienceText: audienceFramework.primaryAudiences.slice(0, 5).join(', '),
      programmes: [],
      source: 'primaryAudiences'
    }
  }
  
  // PATH 3: audience_segments (Legacy)
  // ... segments logic ...
}
```

**Integration Point for Seasonal Filtering**:
- **Line 352-360**: After `matchingSlot` found, before returning `audienceText`
- Add seasonal blending logic here

### 6.3 Potential Integration Points

#### Integration Point 1: persona-matcher.ts (Line 352-360)
**Purpose**: Blend seasonal audiences with time slot audiences

**Proposed Code**:
```typescript
// AUDIENCE EXTRACTION WITH SEASONAL FILTERING
if (matchingSlot?.audiences && Array.isArray(matchingSlot.audiences)) {
  let finalAudiences = matchingSlot.audiences
  
  // SEASONAL BLENDING (NEW)
  if (audienceFramework?.seasonalVariation && currentMonth !== undefined) {
    const season = getSeasonFromMonth(currentMonth)
    const seasonalData = audienceFramework.seasonalVariation[season]
    
    if (seasonalData?.audiences && seasonalData.audiences.length > 0) {
      // Strategy 1: Replace entirely (most aggressive)
      // finalAudiences = seasonalData.audiences
      
      // Strategy 2: Blend (RECOMMENDED - balanced approach)
      // Take 60% seasonal + 40% time-based
      finalAudiences = [
        ...seasonalData.audiences.slice(0, 3),     // Top 3 seasonal
        ...matchingSlot.audiences.slice(0, 2)      // Top 2 time-specific
      ].slice(0, 4)  // Max 4 total audiences
      
      // Strategy 3: Intersect (most conservative)
      // Only use audiences that appear in BOTH seasonal and time slot
      // const intersection = matchingSlot.audiences.filter(a => 
      //   seasonalData.audiences.includes(a)
      // )
      // if (intersection.length > 0) finalAudiences = intersection
    }
  }
  
  return {
    audienceText: finalAudiences.join(', '),
    programmes: Array.isArray(matchingSlot.programmes) ? matchingSlot.programmes : [],
    source: 'timeSlots',
    metadata: {
      currentHour,
      seasonalAdjustment: seasonalData ? true : false,
      season: seasonalData ? season : undefined
    }
  }
}
```

#### Integration Point 2: get-quick-suggestions/index.ts (Line 1390)
**Purpose**: Pass current month to persona matcher

**Current Code**:
```typescript
const now = new Date()
const personaMatch: PersonaMatchResult = await matchPersonaToCurrentHour(
  audienceFramework,
  rawAudienceSegments,
  now.getHours(),
  now.getDay(),
  supabase,
  businessId
)
```

**Proposed Change**:
```typescript
const now = new Date()
const personaMatch: PersonaMatchResult = await matchPersonaToCurrentHour(
  audienceFramework,
  rawAudienceSegments,
  now.getHours(),
  now.getDay(),
  now.getMonth(),  // ← ADD THIS
  supabase,
  businessId
)
```

### 6.4 Existing Date/Season Handling Code

**File**: [resolve-context.ts:224-276](supabase/functions/generate-text-from-idea/resolve-context.ts#L224-L276)

```typescript
function computeSeasonalContextSignal(
  now: Date,
  categoryScores: Record<string, number>,
  _language: string
): string {
  const month = now.getMonth() // 0-based: 0=Jan, 11=Dec
  
  // Month → season label (Danish)
  const monthSeason = month >= 5 && month <= 7 ? 'sommer'
    : month >= 3 && month <= 4 ? 'forår'
    : month >= 8 && month <= 9 ? 'efterår'
    : month === 11 ? 'december'
    : 'vinter'

  const dayType = isWeekend ? 'weekend' : 'hverdag'
  const parts = [`${monthSeason}, ${dayType}`]

  // Seasonal pattern detection
  const SEASONAL_PATTERN_MAP: Record<string, string> = {
    waterfront: 'summer_peak', 
    tourist: 'summer_peak',
    student: 'semester_only'
  }
  
  const pattern = SEASONAL_PATTERN_MAP[topCategory] ?? 'year_round'

  if (pattern === 'summer_peak') {
    const isPeak = month >= 5 && month <= 7
    const isLow = month <= 2 || month === 10 || month === 11
    parts.push(isPeak ? 'højsæson for vandkant/turistbesøg'
      : isLow ? 'lavsæson — primært lokale stamgæster'
      : 'skuldersæson for vandkant/turistbesøg')
  }
  
  return parts.join(' — ')
}
```

**Usage**: Creates narrative context for prompts but doesn't filter audiences.

**Reusable Logic**:
- `month >= 5 && month <= 7` → summer
- Month classification can be extracted into shared helper

---

## 7. Recommendations

### 7.1 Immediate Next Steps

1. **Create Season Detection Helper** (15 minutes)
   ```typescript
   // supabase/functions/_shared/season-utils.ts
   export function getSeasonFromMonth(month: number): 'summer' | 'winter' {
     // April-September = summer (months 3-8)
     return (month >= 3 && month <= 8) ? 'summer' : 'winter'
   }
   ```

2. **Extend persona-matcher Signature** (30 minutes)
   - Add `currentMonth?: number` parameter
   - Make it optional for backward compatibility
   - Default to `undefined` if not provided

3. **Implement Seasonal Blending Logic** (2 hours)
   - Add blending strategy after time slot matching
   - Use 60/40 split (3 seasonal + 2 time-based)
   - Add metadata flag for debugging

4. **Update Callers** (1 hour)
   - get-quick-suggestions/index.ts: Pass `now.getMonth()`
   - get-weekly-strategy/index.ts: Pass `now.getMonth()`

5. **Test with Real Business** (2 hours)
   - Use Café Faust (has seasonal data)
   - Test in different months (mock date)
   - Verify audience blending works correctly

### 7.2 Testing Strategy

**Unit Tests**:
```typescript
// Test getSeasonFromMonth()
expect(getSeasonFromMonth(0)).toBe('winter')  // January
expect(getSeasonFromMonth(6)).toBe('summer')  // July
expect(getSeasonFromMonth(3)).toBe('summer')  // April (edge case)

// Test persona matcher with seasonal data
const framework = {
  timeSlots: [{
    programmes: ['brunch'],
    audiences: ['weekendgæster', 'par', 'lokale']
  }],
  seasonalVariation: {
    summer: { audiences: ['turister', 'destinationsbesøgende'] },
    winter: { audiences: ['lokale', 'stamgæster'] }
  }
}

// Summer test (month = 6 = July)
const result = await matchPersonaToCurrentHour(framework, null, 10, 2, 6)
expect(result.audienceText).toContain('turister')
expect(result.metadata.seasonalAdjustment).toBe(true)

// Winter test (month = 1 = February)
const resultWinter = await matchPersonaToCurrentHour(framework, null, 10, 2, 1)
expect(resultWinter.audienceText).toContain('lokale')
expect(resultWinter.audienceText).not.toContain('turister')
```

**Integration Tests**:
- Generate suggestions for waterfront café in July → verify tourist emphasis
- Generate suggestions for same café in January → verify local emphasis
- Verify businesses without seasonal data still work (null handling)

### 7.3 Rollout Plan

**Phase 1: Foundation** (1 week)
- ✅ Create season detection helpers
- ✅ Extend persona-matcher with month parameter
- ✅ Add unit tests

**Phase 2: Integration** (1 week)
- ✅ Update get-quick-suggestions to pass month
- ✅ Update get-weekly-strategy to pass month
- ✅ Test with real businesses

**Phase 3: Validation** (1 week)
- ✅ Monitor generated content quality
- ✅ Verify seasonal audiences are appropriate
- ✅ Adjust blending ratio if needed (60/40 vs 50/50)

**Phase 4: Enhancement** (future)
- ⏳ Add UI to view/edit seasonal audiences
- ⏳ Add 4-season support (spring/autumn)
- ⏳ Country-specific season definitions

### 7.4 Risk Mitigation

**Risk 1**: Seasonal audiences too generic (all tourists in summer)
- **Mitigation**: Blend with time slot audiences (60/40 split)
- **Validation**: Review generated posts for variety

**Risk 2**: Breaking changes for businesses without seasonal data
- **Mitigation**: Make month parameter optional, gracefully handle null
- **Validation**: Test with non-seasonal businesses

**Risk 3**: Wrong season mapping (southern hemisphere, edge cases)
- **Mitigation**: Start with simple binary mapping (summer/winter)
- **Future**: Add country-specific logic when expanding

---

## 8. Summary

### What We Found

✅ **Data Exists**:
- `seasonalVariation` is defined in schema
- Populated for outdoor/waterfront venues
- Retrieved by content systems

❌ **Data NOT Used**:
- Persona matcher ignores seasonal data
- Audiences are same in summer and winter
- `seasonalContextSignal` provides narrative but doesn't filter

### Key Insight

The infrastructure is **ready** — adding seasonal filtering requires:
1. ✅ Helper function (15 min)
2. ✅ Parameter addition (30 min)
3. ✅ Blending logic (2 hours)
4. ✅ Caller updates (1 hour)

**Total Effort**: ~4 hours of development + 2 hours testing

### Value Proposition

**Before Seasonal Filtering**:
- Waterfront café targets "weekendgæster, par, lokale" year-round
- Same audiences in July (tourist peak) and January (local off-season)

**After Seasonal Filtering**:
- July: "turister, destinationsbesøgende, par, weekendgæster"
- January: "lokale, stamgæster, par"
- Content aligns with actual customer mix

**Business Impact**:
- More relevant content
- Better ROI on seasonal campaigns
- Accurate audience targeting

---

**End of Analysis**
