# Layer 1 Refactor Implementation Plan
**From "Programme Detection" to "Programme Reader"**

Date: May 7, 2026  
Status: Implementation Planning  
Complexity: MAJOR (Core architecture change)

---

## Executive Summary

**Current Problem:**
- Layer 1 reads flattened `menu_items_normalized` and tries to detect programmes via keyword matching
- Ignores structured programme data in `menu_results_v2.structured_data` (menuTitle, availabilityTime)
- Shows wrong time windows (hardcoded vs actual)
- Misses programmes when keyword matching fails

**Solution:**
- Refactor Layer 1 to read `menu_results_v2` directly as primary source
- Each `menu_result` row = 1 programme
- Use `structured_data` fields for all metadata (name, time, days)
- Fall back to keyword detection only when no menu extractions exist

**Expected Outcomes:**
- ✅ Accurate time windows (use extracted availabilityTime, not hardcoded)
- ✅ All programmes detected (4/4 instead of 2/4 for Café Faust)
- ✅ Consistent with frontend (both read same source)
- ✅ Simpler logic (read > reconstruct)
- ✅ More reliable (structured data > pattern matching)

---

## Architecture Changes

### Current Flow (WRONG)
```
menu_results_v2.structured_data
    ↓
menu_items_normalized (flattened, loses metadata)
    ↓
detectProgrammes(normalizedItems, openingHours)
    ↓
keyword matching → hardcoded time windows
    ↓
programmes (incomplete, inaccurate)
```

### New Flow (CORRECT)
```
menu_results_v2.structured_data
    ↓
detectProgrammesV2(menuResults, openingHours, business)
    ↓
read structured_data → parse availabilityTime
    ↓
programmes (complete, accurate)

ALSO (parallel):
menu_results_v2.structured_data
    ↓
menu_items_normalized (for item-level search only)
```

### Key Differences

| Aspect | Current (V1) | New (V2) |
|--------|-------------|----------|
| **Primary Source** | menu_items_normalized | menu_results_v2 |
| **Detection Method** | Keyword matching | Structure reading |
| **Time Windows** | Hardcoded constants | Extracted availabilityTime |
| **Programme Name** | Inferred from keywords | menuTitle from extraction |
| **Days** | All days (default) | availabilityDays from extraction |
| **Fallback** | None (detection fails) | URL parsing, then keyword detection |
| **Confidence** | Pattern match quality | Data source (extraction > URL > pattern) |

---

## Implementation Steps

### Phase 1: Create New Detection Function (Parallel Implementation)

**Goal:** Build new system alongside old one, no breaking changes yet

**Files to Create:**
1. `supabase/functions/_shared/brand-profile/programme-detection-v2.ts`

**New Types:**
```typescript
// Menu extraction result from database
interface MenuResult {
  id: string
  business_id: string
  source_url: string
  status: string
  structured_data: {
    menuTitle?: string
    menuSubtitle?: string
    availabilityTime?: string    // "17.30-21.30"
    availabilityDays?: string    // "dagligt", "mandag-fredag"
    categories: Array<{
      name: string
      items: Array<{
        name: string
        description?: string
        price?: string
      }>
    }>
  }
  completed_at: string
}

// URL-based classification
interface URLEvidence {
  url: string
  programmeType: ProgrammeType | null
  confidence: 'high' | 'medium' | 'low'
  keywords: string[]
}
```

**Core Functions:**

1. **`detectProgrammesV2()`** - Main entry point
```typescript
export function detectProgrammesV2(
  menuResults: MenuResult[],
  openingHours: OpeningHoursRow[],
  business: Business
): ProgrammeDetectionResult
```

2. **`menuResultToProgramme()`** - Convert menu_result to Programme
```typescript
function menuResultToProgramme(
  menuResult: MenuResult,
  openingHours: OpeningHoursRow[]
): Programme
```

3. **`parseTimeWindow()`** - Parse availabilityTime string
```typescript
function parseTimeWindow(
  availabilityTime: string | undefined
): { start: string, end: string } | null

// Examples:
// "17.30-21.30" → {start: "17:30", end: "21:30"}
// "11:00-15:00" → {start: "11:00", end: "15:00"}
// "Serveres kl. 12-16" → {start: "12:00", end: "16:00"}
```

4. **`classifyProgrammeFromURL()`** - Extract type from URL path
```typescript
function classifyProgrammeFromURL(url: string): URLEvidence

// Examples:
// "/menukort/morgenmad/" → {type: 'morning', confidence: 'high', keywords: ['morgenmad']}
// "/menukort/frokost/" → {type: 'lunch', confidence: 'high', keywords: ['frokost']}
// "/menukort/aften/" → {type: 'dinner', confidence: 'high', keywords: ['aften']}
// "/menu/brunch" → {type: 'morning', confidence: 'high', keywords: ['brunch']}
```

5. **`classifyProgrammeFromTitle()`** - Classify from menuTitle
```typescript
function classifyProgrammeFromTitle(
  title: string | undefined
): ProgrammeType | null

// Examples:
// "AFTEN" → 'dinner'
// "FROKOST MENU" → 'lunch'
// "BRUNCH" → 'morning'
```

6. **`parseDays()`** - Parse availabilityDays string
```typescript
function parseDays(
  availabilityDays: string | undefined
): string[]

// Examples:
// "dagligt" → ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
// "mandag-fredag" → ['monday','tuesday','wednesday','thursday','friday']
// "weekender" → ['saturday','sunday']
// "onsdag-lørdag" → ['wednesday','thursday','friday','saturday']
```

**Detection Logic:**
```typescript
export function detectProgrammesV2(
  menuResults: MenuResult[],
  openingHours: OpeningHoursRow[],
  business: Business
): ProgrammeDetectionResult {
  
  const programmes: Programme[] = []
  
  // Filter completed menu extractions only
  const completedMenus = menuResults.filter(r => r.status === 'done')
  
  if (completedMenus.length > 0) {
    // PRIMARY PATH: Read structured extractions
    console.log(`✅ Using extraction-based detection (${completedMenus.length} menus)`)
    
    completedMenus.forEach(menuResult => {
      const programme = menuResultToProgramme(menuResult, openingHours)
      programmes.push(programme)
    })
    
    return {
      programmes,
      totalProgrammes: programmes.length,
      detectionMethod: 'extraction',
      rawData: {
        menuResults: completedMenus,
        openingHours
      }
    }
  } else {
    // FALLBACK PATH: Use old keyword detection
    console.log(`⚠️ No menu extractions found, falling back to keyword detection`)
    
    // Import old function
    const legacyResult = detectProgrammes(openingHours, [], business)
    
    return {
      ...legacyResult,
      detectionMethod: 'legacy_fallback'
    }
  }
}

function menuResultToProgramme(
  menuResult: MenuResult,
  openingHours: OpeningHoursRow[]
): Programme {
  
  const data = menuResult.structured_data
  
  // Step 1: Determine programme name
  const programmeName = data.menuTitle || 
                       extractTitleFromURL(menuResult.source_url) ||
                       'Menu'
  
  // Step 2: Classify programme type
  const programmeType = 
    classifyProgrammeFromTitle(data.menuTitle) ||
    classifyProgrammeFromURL(menuResult.source_url).programmeType ||
    'dinner' // default
  
  // Step 3: Parse time window
  let timeWindow = parseTimeWindow(data.availabilityTime)
  
  if (!timeWindow) {
    // Fallback to type-specific defaults, adjusted to opening hours
    const defaults = PROGRAMME_TIME_WINDOWS[programmeType]
    timeWindow = adjustTimeWindowToOpeningHours(
      defaults.start,
      defaults.end,
      openingHours
    )
  }
  
  // Step 4: Parse operating days
  const daysOfWeek = parseDays(data.availabilityDays) ||
                     getAllOperatingDays(openingHours)
  
  // Step 5: Count items
  const itemCount = data.categories.reduce(
    (sum, cat) => sum + cat.items.length,
    0
  )
  
  // Step 6: Build evidence array
  const menuEvidence = [
    `Extracted from ${menuResult.source_url}`,
    `${itemCount} items across ${data.categories.length} categories`
  ]
  
  if (data.availabilityTime) {
    menuEvidence.push(`Time window: ${data.availabilityTime}`)
  }
  
  // Step 7: Determine confidence
  const confidence = calculateConfidence(data, menuResult)
  
  return {
    type: programmeType,
    label: PROGRAMME_TIME_WINDOWS[programmeType].label,
    timeWindow,
    daysOfWeek,
    menuEvidence,
    confidence,
    metadata: {
      source: 'extraction',
      menuResultId: menuResult.id,
      menuTitle: data.menuTitle,
      url: menuResult.source_url,
      itemCount,
      categoryCount: data.categories.length
    }
  }
}

function calculateConfidence(
  data: MenuResult['structured_data'],
  menuResult: MenuResult
): 'high' | 'medium' | 'low' {
  
  // High confidence: Has menuTitle + availabilityTime + items
  if (data.menuTitle && data.availabilityTime && data.categories.length > 0) {
    return 'high'
  }
  
  // Medium confidence: Has menuTitle OR time, plus items
  if ((data.menuTitle || data.availabilityTime) && data.categories.length > 0) {
    return 'medium'
  }
  
  // Medium confidence: URL contains clear keywords
  const urlEvidence = classifyProgrammeFromURL(menuResult.source_url)
  if (urlEvidence.confidence === 'high' && data.categories.length > 0) {
    return 'medium'
  }
  
  // Low confidence: Only items, no metadata
  return 'low'
}
```

**Utility Functions:**

```typescript
function parseTimeWindow(
  availabilityTime: string | undefined
): { start: string, end: string } | null {
  
  if (!availabilityTime) return null
  
  // Pattern: "17.30-21.30" or "11:00-15:00" or "kl. 12-16"
  const patterns = [
    /(\d{1,2})[:.](\\d{2})\s*-\s*(\d{1,2})[:.](\\d{2})/, // 17.30-21.30 or 11:00-15:00
    /(\d{1,2})\s*-\s*(\d{1,2})/,                          // 12-16
    /kl\.\s*(\d{1,2})\s*-\s*(\d{1,2})/                   // kl. 12-16
  ]
  
  for (const pattern of patterns) {
    const match = availabilityTime.match(pattern)
    if (match) {
      // Extract hours and minutes
      let startHour, startMin, endHour, endMin
      
      if (match.length === 5) {
        // Format: HH:MM-HH:MM
        [, startHour, startMin, endHour, endMin] = match
      } else {
        // Format: HH-HH
        [, startHour, endHour] = match
        startMin = '00'
        endMin = '00'
      }
      
      // Normalize to HH:MM format
      const start = `${startHour.padStart(2, '0')}:${startMin.padStart(2, '0')}`
      const end = `${endHour.padStart(2, '0')}:${endMin.padStart(2, '0')}`
      
      return { start, end }
    }
  }
  
  return null
}

function classifyProgrammeFromURL(url: string): URLEvidence {
  const urlLower = url.toLowerCase()
  
  // Check path segments
  const pathSegments = urlLower.split('/').filter(s => s.length > 0)
  
  // Morning/Brunch keywords
  if (pathSegments.some(s => 
    s.includes('morgenmad') || 
    s.includes('brunch') || 
    s.includes('breakfast')
  )) {
    return {
      url,
      programmeType: 'morning',
      confidence: 'high',
      keywords: pathSegments.filter(s => 
        s.includes('morgenmad') || s.includes('brunch') || s.includes('breakfast')
      )
    }
  }
  
  // Lunch keywords
  if (pathSegments.some(s => 
    s.includes('frokost') || 
    s.includes('lunch')
  )) {
    return {
      url,
      programmeType: 'lunch',
      confidence: 'high',
      keywords: pathSegments.filter(s => 
        s.includes('frokost') || s.includes('lunch')
      )
    }
  }
  
  // Dinner keywords
  if (pathSegments.some(s => 
    s.includes('aften') || 
    s.includes('aftensmad') || 
    s.includes('dinner')
  )) {
    return {
      url,
      programmeType: 'dinner',
      confidence: 'high',
      keywords: pathSegments.filter(s => 
        s.includes('aften') || s.includes('aftensmad') || s.includes('dinner')
      )
    }
  }
  
  // Bar keywords
  if (pathSegments.some(s => 
    s.includes('bar') || 
    s.includes('drinks') || 
    s.includes('cocktail')
  )) {
    return {
      url,
      programmeType: 'bar',
      confidence: 'high',
      keywords: pathSegments.filter(s => 
        s.includes('bar') || s.includes('drinks') || s.includes('cocktail')
      )
    }
  }
  
  return {
    url,
    programmeType: null,
    confidence: 'low',
    keywords: []
  }
}

function classifyProgrammeFromTitle(
  title: string | undefined
): ProgrammeType | null {
  
  if (!title) return null
  
  const titleLower = title.toLowerCase()
  
  // Check keywords (same as URL classification)
  if (titleLower.includes('brunch') || 
      titleLower.includes('morgenmad') || 
      titleLower.includes('breakfast')) {
    return 'morning'
  }
  
  if (titleLower.includes('frokost') || 
      titleLower.includes('lunch')) {
    return 'lunch'
  }
  
  if (titleLower.includes('aften') || 
      titleLower.includes('aftensmad') || 
      titleLower.includes('dinner')) {
    return 'dinner'
  }
  
  if (titleLower.includes('bar') || 
      titleLower.includes('drinks') || 
      titleLower.includes('cocktail')) {
    return 'bar'
  }
  
  return null
}

function parseDays(
  availabilityDays: string | undefined
): string[] | null {
  
  if (!availabilityDays) return null
  
  const daysLower = availabilityDays.toLowerCase()
  
  // Pattern: "dagligt" / "daily"
  if (daysLower.includes('dagligt') || daysLower.includes('daily') || daysLower.includes('alle dage')) {
    return ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
  }
  
  // Pattern: "weekender" / "kun weekend"
  if (daysLower.includes('weekend') || daysLower.includes('lørdag og søndag')) {
    return ['saturday','sunday']
  }
  
  // Pattern: "hverdage" / "weekdays" / "mandag-fredag"
  if (daysLower.includes('hverdag') || 
      daysLower.includes('weekday') || 
      (daysLower.includes('mandag') && daysLower.includes('fredag'))) {
    return ['monday','tuesday','wednesday','thursday','friday']
  }
  
  // Pattern: "onsdag-lørdag" / "wednesday-saturday"
  const dayMap = {
    'mandag': 'monday', 'monday': 'monday',
    'tirsdag': 'tuesday', 'tuesday': 'tuesday',
    'onsdag': 'wednesday', 'wednesday': 'wednesday',
    'torsdag': 'thursday', 'thursday': 'thursday',
    'fredag': 'friday', 'friday': 'friday',
    'lørdag': 'saturday', 'saturday': 'saturday',
    'søndag': 'sunday', 'sunday': 'sunday'
  }
  
  // Try to match "day1-day2" pattern
  const rangeMatch = daysLower.match(/(\w+)\s*-\s*(\w+)/)
  if (rangeMatch) {
    const [, startDay, endDay] = rangeMatch
    const startMapped = dayMap[startDay as keyof typeof dayMap]
    const endMapped = dayMap[endDay as keyof typeof dayMap]
    
    if (startMapped && endMapped) {
      const allDays = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
      const startIdx = allDays.indexOf(startMapped)
      const endIdx = allDays.indexOf(endMapped)
      
      if (startIdx >= 0 && endIdx >= 0 && endIdx >= startIdx) {
        return allDays.slice(startIdx, endIdx + 1)
      }
    }
  }
  
  return null
}

function extractTitleFromURL(url: string): string | null {
  const segments = url.split('/').filter(s => s.length > 0)
  
  // Look for menu-related segments
  for (const segment of segments) {
    const lower = segment.toLowerCase()
    if (lower.includes('morgenmad')) return 'Morgenmad'
    if (lower.includes('brunch')) return 'Brunch'
    if (lower.includes('frokost')) return 'Frokost'
    if (lower.includes('lunch')) return 'Lunch'
    if (lower.includes('aften')) return 'Aften'
    if (lower.includes('dinner')) return 'Dinner'
    if (lower.includes('bar')) return 'Bar'
  }
  
  return null
}
```

---

### Phase 2: Update Brand Profile Generator V5

**Goal:** Wire new detection function into V5 generation pipeline

**File:** `supabase/functions/brand-profile-generator-v5/index.ts`

**Changes:**

1. Add menu_results_v2 query
```typescript
// After fetching menu_items_normalized (around line 103)

// Fetch menu extraction results
const { data: menuResults } = await supabaseClient
  .from('menu_results_v2')
  .select('id, business_id, source_url, status, structured_data, completed_at, language_code')
  .eq('business_id', businessId)
  .eq('status', 'done')
  .order('completed_at', { ascending: false })

console.log(`[${requestId}] ✅ Menu extractions: ${menuResults?.length || 0} completed`)
```

2. Import new detection function
```typescript
import { detectProgrammesV2 } from '../_shared/brand-profile/programme-detection-v2.ts'
```

3. Replace detection call (around line 145)
```typescript
// OLD:
const programmeDetectionResult = detectProgrammes(
  openingHours || [],
  normalizedMenuItems || [],
  business
)

// NEW:
const programmeDetectionResult = detectProgrammesV2(
  menuResults || [],
  openingHours || [],
  business
)
```

4. Add detection method logging
```typescript
console.log(`[${requestId}] ✅ Detection method: ${programmeDetectionResult.detectionMethod}`)
```

---

### Phase 3: Update Database Schema (If Needed)

**Goal:** Ensure menu_results_v2 schema supports all required fields

**Check Current Schema:**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'menu_results_v2'
ORDER BY ordinal_position;
```

**Required Fields:**
- ✅ `structured_data` (JSONB) - Already exists
- ✅ `source_url` (TEXT) - Already exists
- ✅ `status` (TEXT) - Already exists
- ✅ `completed_at` (TIMESTAMP) - Already exists
- ✅ `language_code` (TEXT) - Already exists

**No migration needed** - schema is already sufficient.

**Verify structured_data contains expected fields:**
```sql
-- Check what keys exist in structured_data
SELECT DISTINCT jsonb_object_keys(structured_data) as field
FROM menu_results_v2
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
  AND status = 'done';
```

Expected: menuTitle, menuSubtitle, availabilityTime, availabilityDays, categories

---

### Phase 4: Testing Strategy

**Goal:** Validate new detection works correctly before full rollout

**Test Cases:**

1. **Café Faust (4 programmes)**
   - Expected: All 4 programmes detected (morgenmad, frokost, aften, bar)
   - Time windows: Use extracted times (e.g., 17.30-21.30 for aften)
   - Confidence: HIGH (has menuTitle + availabilityTime + items)

2. **Business with no menu extractions**
   - Expected: Falls back to legacy keyword detection
   - Detection method: 'legacy_fallback'
   - No breaking changes

3. **Business with partial data (menuTitle but no availabilityTime)**
   - Expected: Programme detected with medium confidence
   - Time window: Fallback to adjusted defaults
   - Programme type: Classified from menuTitle

4. **Business with only URL data (no menuTitle)**
   - Expected: Programme detected from URL parsing
   - Time window: Fallback to defaults
   - Confidence: MEDIUM

**Test Script:**

Create `scripts/test-detection-v2.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'
import { detectProgrammesV2 } from '../supabase/functions/_shared/brand-profile/programme-detection-v2.ts'

const supabase = createClient(
  Deno.env.get('VITE_SUPABASE_URL')!,
  Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY')! // Use service role for full access
)

const CAFE_FAUST_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'

async function testDetection(businessId: string, businessName: string) {
  console.log(`\\n${'='.repeat(60)}`)
  console.log(`Testing: ${businessName}`)
  console.log('='.repeat(60))
  
  // Fetch data
  const { data: menuResults } = await supabase
    .from('menu_results_v2')
    .select('*')
    .eq('business_id', businessId)
    .eq('status', 'done')
  
  const { data: openingHours } = await supabase
    .from('opening_hours')
    .select('*')
    .eq('business_id', businessId)
  
  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single()
  
  console.log(`\\nInput Data:`)
  console.log(`- Menu extractions: ${menuResults?.length || 0}`)
  console.log(`- Opening hours: ${openingHours?.length || 0} entries`)
  
  if (menuResults && menuResults.length > 0) {
    console.log(`\\nMenu Extractions:`)
    menuResults.forEach((mr, idx) => {
      console.log(`  ${idx + 1}. ${mr.source_url}`)
      console.log(`     menuTitle: ${mr.structured_data?.menuTitle || '(none)'}`)
      console.log(`     availabilityTime: ${mr.structured_data?.availabilityTime || '(none)'}`)
      console.log(`     items: ${mr.structured_data?.categories?.reduce((sum, cat) => sum + cat.items.length, 0) || 0}`)
    })
  }
  
  // Run detection
  const result = detectProgrammesV2(
    menuResults || [],
    openingHours || [],
    business
  )
  
  console.log(`\\nDetection Results:`)
  console.log(`- Method: ${result.detectionMethod}`)
  console.log(`- Programmes detected: ${result.totalProgrammes}`)
  
  result.programmes.forEach((prog, idx) => {
    console.log(`\\n  ${idx + 1}. ${prog.label} (${prog.type})`)
    console.log(`     Time: ${prog.timeWindow.start}-${prog.timeWindow.end}`)
    console.log(`     Days: ${prog.daysOfWeek.join(', ')}`)
    console.log(`     Confidence: ${prog.confidence}`)
    console.log(`     Evidence:`)
    prog.menuEvidence.forEach(ev => console.log(`       - ${ev}`))
    if (prog.metadata) {
      console.log(`     Source: ${prog.metadata.source}`)
      if (prog.metadata.menuTitle) console.log(`     Menu Title: ${prog.metadata.menuTitle}`)
      if (prog.metadata.url) console.log(`     URL: ${prog.metadata.url}`)
    }
  })
}

// Run tests
await testDetection(CAFE_FAUST_ID, 'Café Faust')

console.log(`\\n${'='.repeat(60)}`)
console.log('Tests complete!')
console.log('='.repeat(60)\\n')
```

**Run:**
```bash
deno run --allow-net --allow-env --allow-read --env-file=.env scripts/test-detection-v2.ts
```

**Expected Output for Café Faust:**
```
Testing: Café Faust
============================================================

Input Data:
- Menu extractions: 4
- Opening hours: 7 entries

Menu Extractions:
  1. https://cafefaust.dk/menukort/morgenmad/
     menuTitle: MORGENMAD
     availabilityTime: 09:00-11:30
     items: 18
  2. https://cafefaust.dk/menukort/frokost/
     menuTitle: FROKOST
     availabilityTime: 11:00-15:00
     items: 24
  3. https://cafefaust.dk/menukort/aften/
     menuTitle: AFTEN
     availabilityTime: 17.30-21.30
     items: 36
  4. https://cafefaust.dk/menukort/bar/
     menuTitle: BAR
     availabilityTime: 20:00-23:00
     items: 65

Detection Results:
- Method: extraction
- Programmes detected: 4

  1. Morgenmad/Brunch (morning)
     Time: 09:00-11:30
     Days: monday, tuesday, wednesday, thursday, friday, saturday, sunday
     Confidence: high
     Evidence:
       - Extracted from https://cafefaust.dk/menukort/morgenmad/
       - 18 items across 3 categories
       - Time window: 09:00-11:30
     Source: extraction
     Menu Title: MORGENMAD
     URL: https://cafefaust.dk/menukort/morgenmad/

  2. Frokost (lunch)
     Time: 11:00-15:00
     Days: monday, tuesday, wednesday, thursday, friday, saturday, sunday
     Confidence: high
     Evidence:
       - Extracted from https://cafefaust.dk/menukort/frokost/
       - 24 items across 4 categories
       - Time window: 11:00-15:00
     Source: extraction
     Menu Title: FROKOST
     URL: https://cafefaust.dk/menukort/frokost/

  3. Aftensmad (dinner)
     Time: 17:30-21:30
     Days: monday, tuesday, wednesday, thursday, friday, saturday, sunday
     Confidence: high
     Evidence:
       - Extracted from https://cafefaust.dk/menukort/aften/
       - 36 items across 5 categories
       - Time window: 17.30-21.30
     Source: extraction
     Menu Title: AFTEN
     URL: https://cafefaust.dk/menukort/aften/

  4. Bar/Drinks (bar)
     Time: 20:00-23:00
     Days: monday, tuesday, wednesday, thursday, friday, saturday, sunday
     Confidence: high
     Evidence:
       - Extracted from https://cafefaust.dk/menukort/bar/
       - 65 items across 8 categories
       - Time window: 20:00-23:00
     Source: extraction
     Menu Title: BAR
     URL: https://cafefaust.dk/menukort/bar/
```

---

### Phase 5: Migration & Rollout

**Goal:** Deploy with zero downtime, easy rollback

**Approach: Feature Flag**

1. Add environment variable to control which version to use:
```typescript
// In brand-profile-generator-v5/index.ts

const USE_DETECTION_V2 = Deno.env.get('USE_DETECTION_V2') === 'true'

if (USE_DETECTION_V2) {
  console.log(`[${requestId}] 🆕 Using Detection V2 (extraction-based)`)
  programmeDetectionResult = detectProgrammesV2(
    menuResults || [],
    openingHours || [],
    business
  )
} else {
  console.log(`[${requestId}] 📊 Using Detection V1 (keyword-based)`)
  programmeDetectionResult = detectProgrammes(
    openingHours || [],
    normalizedMenuItems || [],
    business
  )
}
```

2. Deploy with V2 disabled:
```bash
# Set in Supabase Edge Function secrets
supabase secrets set USE_DETECTION_V2=false

# Deploy function
supabase functions deploy brand-profile-generator-v5 --project-ref kvqdkohdpvmdylqgujpn
```

3. Test V2 manually:
```bash
# Enable for testing
supabase secrets set USE_DETECTION_V2=true

# Regenerate profile for Café Faust
# Check frontend: Should show 4/4 programmes with correct times

# If issues found, immediately disable
supabase secrets set USE_DETECTION_V2=false
```

4. Gradual rollout:
```
Day 1: Enable for 1 business (Café Faust), monitor
Day 2: Enable for 5-10 businesses, compare V1 vs V2 results
Day 3: Enable for all businesses with menu extractions
Day 7: Make V2 default, remove V1 code
```

**Rollback Plan:**
- Set `USE_DETECTION_V2=false`
- Redeploy function
- All businesses revert to keyword detection
- Zero data loss (both methods write same schema)

---

### Phase 6: Cleanup (After V2 Proven Stable)

**Goal:** Remove legacy code, simplify codebase

**Files to Update:**

1. **Remove old detection function**
   - Delete or deprecate `programme-detection.ts` (V1)
   - Keep only `programme-detection-v2.ts`

2. **Remove feature flag**
   - Always use V2
   - Remove conditional logic

3. **Update imports**
   - Rename `programme-detection-v2.ts` → `programme-detection.ts`
   - Update all imports

4. **Documentation**
   - Update architecture docs
   - Add migration notes

---

## Success Metrics

**Before (Current State):**
- Café Faust: 2/4 programmes detected
- Time windows: Hardcoded (07:00-11:00, 17:00-22:00, 22:00-02:00)
- Detection method: Keyword matching
- Confidence: Medium (pattern-based)

**After (V2 Deployed):**
- Café Faust: 4/4 programmes detected ✅
- Time windows: Extracted (09:00-11:30, 11:00-15:00, 17:30-21:30, 20:00-23:00) ✅
- Detection method: Structure reading ✅
- Confidence: High (extraction-based) ✅

**KPIs:**
- Programme detection rate: 50% → 100% for Café Faust
- Time accuracy: Hardcoded → Actual from menu
- Detection confidence: Medium → High
- Frontend consistency: Mismatched → Aligned

---

## Risk Assessment

### High Risk Items

**1. Breaking Changes to Programme Schema**
- **Risk:** V2 might return different Programme structure
- **Mitigation:** Keep same interface, only change data source
- **Rollback:** Feature flag allows instant revert

**2. Businesses Without Menu Extractions**
- **Risk:** V2 fails if no menu_results exist
- **Mitigation:** Built-in fallback to V1 keyword detection
- **Impact:** Zero - behaves exactly like V1 for these businesses

**3. Performance Degradation**
- **Risk:** Reading menu_results_v2 might be slower than normalized items
- **Mitigation:** Add query to existing waterfall, parallel fetch
- **Monitoring:** Log query times before/after

### Medium Risk Items

**1. Unexpected structured_data Formats**
- **Risk:** GPT-4o might return structured_data in different formats
- **Mitigation:** Defensive parsing with fallbacks at each step
- **Testing:** Test with multiple real extractions

**2. Time Parsing Edge Cases**
- **Risk:** availabilityTime might have unexpected formats
- **Mitigation:** Multiple regex patterns, fallback to defaults
- **Validation:** Test script covers known formats

### Low Risk Items

**1. URL Parsing False Positives**
- **Risk:** URL contains keyword but isn't that programme type
- **Mitigation:** Only use as fallback, prioritize menuTitle
- **Impact:** Low - worst case is wrong classification, not missing programme

---

## Timeline

**Week 1 (Implementation)**
- Day 1-2: Create detection-v2.ts with all utility functions
- Day 3: Wire into brand-profile-generator-v5 with feature flag
- Day 4: Create test script and validate
- Day 5: Deploy with flag disabled, test manually

**Week 2 (Rollout)**
- Day 1: Enable for Café Faust only, monitor 24h
- Day 2-3: Enable for 10 businesses, compare results
- Day 4-5: Gradual rollout to all with extractions

**Week 3 (Stabilization)**
- Monitor error rates
- Collect feedback
- Fix edge cases

**Week 4 (Cleanup)**
- Make V2 default
- Remove V1 code
- Update documentation

---

## Open Questions

1. **What if menu_result has no categories?**
   - Should we still create a programme?
   - Or skip empty extractions?
   - **Recommendation:** Skip if categories.length === 0

2. **How to handle overlapping time windows?**
   - E.g., Brunch (09:00-15:00) overlaps Lunch (11:00-15:00)
   - Should we merge them?
   - Or keep as separate programmes?
   - **Recommendation:** Keep separate - restaurant intentionally has multiple menus

3. **What if URL and menuTitle disagree?**
   - URL: /menukort/frokost/
   - menuTitle: "DINNER MENU"
   - Which to trust?
   - **Recommendation:** Trust menuTitle (GPT-4o read actual page content)

4. **How to version detection logic?**
   - Store `detection_version` in database?
   - Or just log in Edge Function?
   - **Recommendation:** Add to programme metadata for debugging

---

## Summary

**This refactor transforms Layer 1 from:**
- ❌ "Programme Detector" (keyword inference)
- ❌ Reads flattened items, loses structure
- ❌ Uses hardcoded time windows
- ❌ Misses programmes when patterns fail

**To:**
- ✅ "Programme Reader" (structure reading)
- ✅ Reads extraction results directly
- ✅ Uses extracted time windows
- ✅ Reliable detection (data already structured)

**The user's intuition was correct:**
> "Let me look at the available information. Ohh it is all there."

Layer 1 should just read what GPT-4o already extracted, not try to reconstruct it from scattered items.

**Implementation is low risk:**
- Feature flag for safe rollout
- Fallback to V1 for businesses without extractions
- Same output schema (no breaking changes)
- Instant rollback capability

**Expected outcomes:**
- All programmes detected (4/4 not 2/4)
- Accurate time windows (17:30-21:30 not 17:00-22:00)
- Higher confidence scores
- Frontend/backend consistency
