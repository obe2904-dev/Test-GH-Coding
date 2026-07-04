# Implementation Plan: V1 Refactor + Cuisine Intelligence + Photo Guidance

**Date**: 2026-06-24  
**Status**: Ready for Implementation  
**Decision**: Path 1 - Refactor V1 (not build on V2)  
**Target**: 1,940 lines (from 3,171) = 39% reduction  

---

## Executive Summary

### What We're Building

Refactored `get-quick-suggestions` (V1) with:

1. ✅ **Unified AI calls** (2 calls instead of 4)
2. ✅ **No repair logic** (800 lines removed)
3. ✅ **Simplified response** (10 essential fields)
4. ✅ **Cuisine intelligence** from existing `menu_results_v2.ai_summary` (+270 lines)
5. ✅ **Simplified photo guidance** (150 lines instead of 400)
6. ✅ **All operational logic preserved** (gaps, dead zones, kitchen close, hybrid venues)

### Key Discoveries

1. **Photo guidance is valuable UX** - users need it BEFORE committing to an idea
2. **Cuisine data already exists** - in `menu_results_v2.ai_summary` (no new AI calls needed)
3. **Text generator is flexible** - accepts both snake_case and camelCase fields
4. **V2 cannot replace V1** - missing 1,650 lines of operational intelligence

---

## Phase Overview

| Phase | Component | Lines Changed | Effort | Priority |
|-------|-----------|---------------|--------|----------|
| 0 | Cuisine Integration Setup | +270 | 5 hours | **P0 (First)** |
| 1 | Unify AI Calls | -600 | 2 days | P0 |
| 2 | Remove Repair Logic | -800 | 2 days | P1 |
| 3 | Simplify Response | -150 | 1 day | P1 |
| 4 | Simplify Photo Guidance | -250 | 4 hours | P1 |
| 5 | Defer Detailed Voice | -300 | 1 day | P2 |
| 6 | Testing & Validation | 0 | 2 days | P0 |

**Total Effort**: 8-9 days  
**Net Change**: -1,830 lines → 1,341 lines remaining (58% reduction)  
**Note**: Adding cuisine (+270) offsets some reduction → final 1,940 lines (39% reduction)

---

## PHASE 0: Cuisine Integration Setup (DO THIS FIRST)

**Why First**: All subsequent phases depend on cuisine context being available.

### Step 0.1: Enhance Rotation Queue with Cuisine JOIN

**File**: `src/lib/shared/content-planning/index.ts`  
**Function**: `getMenuRotationQueue()`  
**Lines**: ~50

**Current Code** (approximate location):
```typescript
export async function getMenuRotationQueue(
  supabase: SupabaseClient,
  businessId: string,
  serviceContext: string
) {
  const { data: menuItems } = await supabase
    .from('menu_items_normalized')
    .select('id, item_name, item_description, service_period_name, ...')
    .eq('business_id', businessId)
    .eq('is_active', true)
  
  return menuItems
}
```

**New Code**:
```typescript
export async function getMenuRotationQueue(
  supabase: SupabaseClient,
  businessId: string,
  serviceContext: string
) {
  const { data: menuItems, error } = await supabase
    .from('menu_items_normalized')
    .select(`
      id,
      item_name,
      item_description,
      service_period_name,
      menu_result_id,
      category_name,
      media_category,
      synced_at,
      menu_results_v2!inner (
        ai_summary,
        service_period_name
      )
    `)
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('synced_at', { ascending: false })
  
  if (error) {
    console.error('❌ Failed to fetch menu rotation queue:', error)
    return []
  }

  // Parse cuisine context from ai_summary
  const queueWithCuisine = (menuItems || []).map(item => ({
    ...item,
    cuisine_context: parseCuisineFromSummary(
      item.menu_results_v2?.ai_summary || null
    ),
    ai_summary_raw: item.menu_results_v2?.ai_summary || null
  }))

  return queueWithCuisine
}
```

**What Changed**:
- ✅ Added JOIN to `menu_results_v2` via `menu_result_id`
- ✅ Selected `ai_summary` field
- ✅ Parse cuisine context for each item
- ✅ Attach to queue item for downstream use

---

### Step 0.2: Create Cuisine Parser

**File**: `src/lib/shared/content-planning/cuisine-parser.ts` (NEW FILE)  
**Lines**: ~120

```typescript
/**
 * Extracts cuisine style from menu_results_v2.ai_summary field
 * 
 * ai_summary contains 3-5 bullet observations like:
 * • Dansk madkultur (smørrebrød, pariserbøf) møder café-retter (falafel, eggs benedict)
 * • Signatur-element: Traditionel dansk brunch med moderne twists
 * • Nordisk tilgang til lokalproducerede ingredienser
 * 
 * Returns: Primary cuisine style or null
 */

export interface CuisineContext {
  primary: string | null           // "Thai", "Italian", "French", etc.
  secondary: string | null          // For fusion: "Thai-French fusion"
  approach: string | null           // "Traditional", "Modern", "Fusion"
  photoGuidanceKey: string          // Maps to photo template
}

const CUISINE_PATTERNS: Record<string, RegExp> = {
  'Thai': /thai|thailandsk/i,
  'Italian': /italiensk|italian|pasta|pizza|risotto/i,
  'French': /fransk|french|bistro|brasserie/i,
  'Nordic': /nordisk|nordic|ny nordisk|new nordic/i,
  'Danish': /dansk madkultur|traditional danish|smørrebrød|frikadeller/i,
  'Japanese': /japansk|japanese|sushi|ramen|izakaya/i,
  'Mediterranean': /mediterran|mediterranean/i,
  'Mexican': /mexicansk|mexican|taco|burrito/i,
  'Indian': /indisk|indian|curry|tandoori/i,
  'Middle Eastern': /mellemøstlig|middle eastern|falafel|hummus|mezze/i,
  'Chinese': /kinesisk|chinese|dim sum|wok/i,
  'Spanish': /spansk|spanish|tapas|paella/i,
  'Greek': /græsk|greek|gyros|souvlaki/i,
  'Vietnamese': /vietnamesisk|vietnamese|pho|banh mi/i,
  'Korean': /koreansk|korean|bibimbap|kimchi/i,
}

const APPROACH_PATTERNS: Record<string, RegExp> = {
  'Traditional': /traditionel|klassisk|autentisk|traditional|classic|authentic/i,
  'Modern': /moderne|ny|contemporary|modern|new/i,
  'Fusion': /møder|meets|fusion|blanding|mix/i,
}

export function parseCuisineFromSummary(aiSummary: string | null): CuisineContext {
  if (!aiSummary || aiSummary.trim().length === 0) {
    return {
      primary: null,
      secondary: null,
      approach: null,
      photoGuidanceKey: 'default'
    }
  }

  const text = aiSummary.toLowerCase()
  
  // Detect primary cuisine
  let primary: string | null = null
  for (const [cuisine, pattern] of Object.entries(CUISINE_PATTERNS)) {
    if (pattern.test(text)) {
      primary = cuisine
      break
    }
  }

  // Detect approach
  let approach: string | null = null
  for (const [app, pattern] of Object.entries(APPROACH_PATTERNS)) {
    if (pattern.test(text)) {
      approach = app
      break
    }
  }

  // Detect fusion pattern: "X møder Y" or "X meets Y"
  let secondary: string | null = null
  const fusionMatch = text.match(/(\w+)\s+(?:møder|meets)\s+(\w+)/i)
  if (fusionMatch) {
    secondary = fusionMatch[2]
    approach = 'Fusion'
  }

  // Map to photo guidance key
  const photoGuidanceKey = primary || 'default'

  return {
    primary,
    secondary,
    approach,
    photoGuidanceKey
  }
}

/**
 * Generate human-readable cuisine description for prompt context
 */
export function formatCuisineForPrompt(context: CuisineContext): string | null {
  if (!context.primary) return null

  if (context.secondary && context.approach === 'Fusion') {
    return `${context.primary}-${context.secondary} fusion`
  }

  if (context.approach) {
    return `${context.approach} ${context.primary}`
  }

  return context.primary
}

/**
 * Example outputs:
 * - "Traditional Thai"
 * - "Modern Nordic"
 * - "Danish-French fusion"
 * - "Italian"
 */
```

**Testing Data**:
```typescript
// Test cases for validation
const testCases = [
  {
    input: "• Dansk madkultur (smørrebrød, pariserbøf) møder café-retter (falafel, eggs benedict)",
    expected: { primary: "Danish", secondary: "café", approach: "Fusion" }
  },
  {
    input: "• Traditionel italiensk pasta og pizza\n• Autentisk Napoli-stil",
    expected: { primary: "Italian", secondary: null, approach: "Traditional" }
  },
  {
    input: "• Moderne nordisk tilgang\n• Lokalproducerede råvarer",
    expected: { primary: "Nordic", secondary: null, approach: "Modern" }
  },
]
```

---

### Step 0.3: Create Photo Guidance Templates

**File**: `src/lib/shared/content-planning/photo-guidance.ts` (NEW FILE)  
**Lines**: ~150

```typescript
/**
 * Cuisine-aware photo guidance templates
 * 
 * Generates amateur-friendly photography hints (80-120 chars):
 * - Camera angle
 * - Lighting suggestion
 * - Context/props
 */

export interface PhotoTemplate {
  angle: string
  lighting: string
  context: string
}

const CUISINE_PHOTO_TEMPLATES: Record<string, PhotoTemplate> = {
  'Thai': {
    angle: 'Overhead 90°',
    lighting: 'Bright daylight',
    context: 'Fresh herbs and lime visible, vibrant colors, chopsticks entering frame'
  },
  'Italian': {
    angle: 'Overhead 45°',
    lighting: 'Natural bright',
    context: 'Garnish visible, contrasting plate color, rustic texture'
  },
  'French': {
    angle: '45° table height',
    lighting: 'Warm ambient',
    context: 'Rustic ceramic dish, crusty bread or wine glass in background'
  },
  'Nordic': {
    angle: 'Eye level',
    lighting: 'Soft diffused',
    context: 'Minimal plating, ingredient textures visible, neutral tones'
  },
  'Danish': {
    angle: '45° table height',
    lighting: 'Natural bright',
    context: 'Rye bread or butter in background, simple Nordic aesthetic'
  },
  'Japanese': {
    angle: 'Overhead 90°',
    lighting: 'Soft natural',
    context: 'Minimalist plating, chopsticks parallel, negative space visible'
  },
  'Mediterranean': {
    angle: 'Overhead 60°',
    lighting: 'Bright natural',
    context: 'Olive oil bottle, fresh herbs, terracotta or white ceramic'
  },
  'Mexican': {
    angle: 'Overhead 75°',
    lighting: 'Bright daylight',
    context: 'Lime wedges, cilantro, colorful salsas, rustic presentation'
  },
  'Indian': {
    angle: '45° table height',
    lighting: 'Warm natural',
    context: 'Multiple small bowls, naan bread, vibrant curry colors'
  },
  'Middle Eastern': {
    angle: 'Overhead 60°',
    lighting: 'Natural bright',
    context: 'Pita bread, hummus swirl, olive oil drizzle, herbs scattered'
  },
  'Chinese': {
    angle: 'Overhead 45°',
    lighting: 'Bright natural',
    context: 'Multiple dishes sharing, chopsticks, steam visible if hot'
  },
  'Spanish': {
    angle: '45° table height',
    lighting: 'Warm ambient',
    context: 'Tapas-style small plate, wine glass, rustic ceramic'
  },
  'Greek': {
    angle: 'Overhead 60°',
    lighting: 'Bright natural',
    context: 'White plate, feta cheese visible, olive oil, Mediterranean colors'
  },
  'Vietnamese': {
    angle: 'Overhead 75°',
    lighting: 'Natural bright',
    context: 'Fresh herbs, lime, rice paper visible, clean presentation'
  },
  'Korean': {
    angle: 'Overhead 60°',
    lighting: 'Natural bright',
    context: 'Multiple banchan dishes, chopsticks, vibrant fermented colors'
  },
  'default': {
    angle: 'Overhead 45°',
    lighting: 'Natural bright',
    context: 'Dish centered, garnish visible, contrasting background'
  }
}

// Content-type specific adjustments
const CONTENT_TYPE_ADJUSTMENTS: Record<string, Partial<PhotoTemplate>> = {
  'drink': {
    angle: 'Eye level',
    context: 'Condensation or garnish visible, bar background softly blurred'
  },
  'atmosphere': {
    angle: '45° room height',
    context: 'Natural guest activity, warm lighting, depth of field'
  },
  'behind_scenes': {
    angle: 'Eye level or slight low',
    context: 'Action in progress, authentic moment, kitchen tools visible'
  }
}

export function generatePhotoGuidance(
  cuisineContext: string | null,
  contentType: string
): string {
  // Get base template from cuisine
  const baseTemplate = cuisineContext && CUISINE_PHOTO_TEMPLATES[cuisineContext]
    ? CUISINE_PHOTO_TEMPLATES[cuisineContext]
    : CUISINE_PHOTO_TEMPLATES['default']

  // Apply content-type adjustments
  const adjustment = CONTENT_TYPE_ADJUSTMENTS[contentType] || {}
  const template = { ...baseTemplate, ...adjustment }

  // Format as single string (80-120 chars target)
  return `${template.angle}, ${template.lighting}, ${template.context}`
}

/**
 * Examples:
 * 
 * Thai menu_item:
 * → "Overhead 90°, bright daylight, fresh herbs and lime visible, vibrant colors, chopsticks entering frame"
 * 
 * French menu_item:
 * → "45° table height, warm ambient, rustic ceramic dish, crusty bread or wine glass in background"
 * 
 * Italian drink:
 * → "Eye level, natural bright, condensation or garnish visible, bar background softly blurred"
 * 
 * Unknown cuisine atmosphere:
 * → "45° room height, natural bright, natural guest activity, warm lighting, depth of field"
 */

/**
 * Lightweight version for non-menu content (atmosphere, behind-scenes)
 */
export function generateNonMenuPhotoGuidance(contentType: string): string {
  if (contentType === 'atmosphere') {
    return '45° room height, natural lighting, guests in natural poses, warm ambiance visible'
  }
  
  if (contentType === 'behind_scenes') {
    return 'Eye level, natural bright, authentic action in progress, kitchen tools or ingredients visible'
  }

  if (contentType === 'drink') {
    return 'Eye level, natural bright, garnish or condensation visible, bar context softly blurred'
  }

  return 'Natural angle, good lighting, subject clearly visible, context appropriate'
}
```

---

### Step 0.4: Update Type Definitions

**File**: `supabase/functions/get-quick-suggestions/types.ts`  
**Add to existing types**:

```typescript
export interface MenuItemWithCuisine {
  id: string
  item_name: string
  item_description: string | null
  service_period_name: string | null
  menu_result_id: string
  cuisine_context: string | null      // ← NEW
  ai_summary_raw: string | null       // ← NEW
  // ... existing fields
}

export interface SuggestionOutput {
  // Core fields (keep)
  id?: number
  content_type: string
  menu_item_name?: string | null
  menu_item_description?: string | null
  why_explanation: string
  occasion_context?: string | null
  suggested_time: string
  
  // Photo guidance (simplified)
  photo_idea: string                  // ← Simplified to 80-120 chars
  
  // Cuisine metadata (optional)
  cuisine_context?: string | null     // ← NEW (optional, for analytics)
  
  // Removed fields (moved to text generator):
  // - title (generated in text flow)
  // - caption_base (generated in text flow)
  // - rationale (consolidated into why_explanation)
}
```

---

### Step 0.5: Integration Test Script

**File**: `_test_cuisine_integration.mjs` (NEW FILE)  
**Purpose**: Validate cuisine parsing before full integration

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function testCuisineIntegration() {
  console.log('🧪 Testing Cuisine Integration\n')

  // Test 1: Fetch menu items with ai_summary
  const { data: menuItems, error } = await supabase
    .from('menu_items_normalized')
    .select(`
      id,
      item_name,
      menu_result_id,
      menu_results_v2!inner (
        ai_summary
      )
    `)
    .limit(10)

  if (error) {
    console.error('❌ Query failed:', error)
    return
  }

  console.log(`✅ Fetched ${menuItems.length} menu items with ai_summary\n`)

  // Test 2: Parse cuisine from each
  for (const item of menuItems) {
    const aiSummary = item.menu_results_v2?.ai_summary
    console.log(`\n📋 Item: ${item.item_name}`)
    console.log(`📄 ai_summary:\n${aiSummary?.substring(0, 200)}...`)
    
    // Parse cuisine (simulate parser function)
    const cuisines = []
    if (aiSummary) {
      if (/thai|thailandsk/i.test(aiSummary)) cuisines.push('Thai')
      if (/italiensk|italian/i.test(aiSummary)) cuisines.push('Italian')
      if (/fransk|french/i.test(aiSummary)) cuisines.push('French')
      if (/nordisk|nordic/i.test(aiSummary)) cuisines.push('Nordic')
      if (/dansk madkultur/i.test(aiSummary)) cuisines.push('Danish')
    }
    
    console.log(`🍽️  Detected cuisines: ${cuisines.join(', ') || 'None detected'}`)
  }

  console.log('\n✅ Test complete')
}

testCuisineIntegration()
```

**Run**:
```bash
node _test_cuisine_integration.mjs
```

**Expected Output**:
```
🧪 Testing Cuisine Integration

✅ Fetched 10 menu items with ai_summary

📋 Item: Pad Thai
📄 ai_summary:
• Thailandsk streetfood-klassiker med autentiske syrlige noter
• Moderne café-tolkning af traditionel thaimat
• Vegetarisk option tilgængelig
🍽️  Detected cuisines: Thai

📋 Item: Spaghetti Carbonara
📄 ai_summary:
• Italiensk pasta-tradition møder moderne café-køkken
• Klassisk romersk opskrift
🍽️  Detected cuisines: Italian

✅ Test complete
```

---

## PHASE 1: Unify AI Calls

**Goal**: Reduce from 4 AI calls to 2 (planner + unified suggestions)

**Current Flow**:
```
1. buildPlannerPrompt() → AI call → slot types determined
2. buildSlotAPrompt() → AI call → suggestion 1
3. buildSlotBPrompt() → AI call → suggestion 2
4. buildSlotCPrompt() → AI call → suggestion 3
```

**New Flow**:
```
1. buildPlannerPrompt() → AI call → slot types determined
2. buildUnifiedPrompt(slotA, slotB, slotC) → AI call → all 3 suggestions
```

### Step 1.1: Create Unified Prompt Builder

**File**: `supabase/functions/get-quick-suggestions/prompt-builder.ts`  
**Function**: `buildUnifiedPrompt()` (NEW)

```typescript
import { formatCuisineForPrompt } from './cuisine-parser.ts'

export function buildUnifiedPrompt(
  slots: Array<{
    position: number,
    content_type: string,
    eligible_items?: Array<{ item_name: string, cuisine_context: string | null }>
  }>,
  baseContext: any
): string {
  const promptParts = []

  promptParts.push(`OPGAVE: Generer 3 post-idéer til dagens sociale medie indhold.

KONTEKST:
- Tidspunkt: ${baseContext.timeContext}
- Vejr: ${baseContext.weather || 'Normal'}
- Service periode: ${baseContext.serviceContext}

SLOTS TIL DAGENS INDHOLD:`)

  for (const slot of slots) {
    promptParts.push(`\n--- SLOT ${slot.position} ---`)
    promptParts.push(`Type: ${slot.content_type}`)

    if (slot.content_type === 'menu_item' && slot.eligible_items) {
      // Add cuisine context for menu items
      const itemsWithCuisine = slot.eligible_items.map(item => {
        const cuisineTag = item.cuisine_context 
          ? ` [${item.cuisine_context}]` 
          : ''
        return `- ${item.item_name}${cuisineTag}`
      }).join('\n')

      promptParts.push(`\nVælg én ret:\n${itemsWithCuisine}`)
      
      // Add cuisine-aware framing if present
      const firstCuisine = slot.eligible_items[0]?.cuisine_context
      if (firstCuisine) {
        promptParts.push(`\nKulinarisk ramme: ${formatCuisineForPrompt({ primary: firstCuisine, secondary: null, approach: null, photoGuidanceKey: firstCuisine })}`)
      }
    } else {
      promptParts.push(`\nGenerer ${slot.content_type} idé (atmosfære, bag-scenen, osv.)`)
    }
  }

  promptParts.push(`\n\nRETURNER JSON ARRAY med 3 objekter:
[
  {
    "position": 1,
    "content_type": "menu_item",
    "menu_item_name": "Exact menu item name",
    "why_explanation": "Why this dish now (time, weather, occasion)",
    "suggested_time": "HH:MM"
  },
  // ... slots 2 and 3
]`)

  return promptParts.join('\n')
}
```

---

### Step 1.2: Update Main Serve Handler

**File**: `supabase/functions/get-quick-suggestions/index.ts`  
**Function**: `serve()`

**Change from**:
```typescript
// Old: 3 separate AI calls
const suggestion1 = await callGeminiForSlot(slotAPrompt)
const suggestion2 = await callGeminiForSlot(slotBPrompt)
const suggestion3 = await callGeminiForSlot(slotCPrompt)
```

**To**:
```typescript
// New: 1 unified AI call
const unifiedPrompt = buildUnifiedPrompt(
  [
    { position: 1, content_type: slotTypes.slotA, eligible_items: menuQueueForSlotA },
    { position: 2, content_type: slotTypes.slotB, eligible_items: menuQueueForSlotB },
    { position: 3, content_type: slotTypes.slotC, eligible_items: menuQueueForSlotC }
  ],
  baseContext
)

const allSuggestions = await callGeminiForUnifiedSlots(unifiedPrompt)
// Returns: [{position: 1, ...}, {position: 2, ...}, {position: 3, ...}]
```

**Lines Removed**: ~600 (3 separate prompt builders + orchestration)

---

## PHASE 2: Remove Repair Logic

**Goal**: Delete 800 lines of validateAndRepair() logic

### Step 2.1: Simple Validation Only

**File**: `supabase/functions/get-quick-suggestions/index.ts`

**Replace**:
```typescript
// Old: 800 lines of repair logic
const validated = await validateAndRepair(suggestions, menuQueue, ...)
```

**With**:
```typescript
// New: Simple validation (~50 lines)
function simpleValidate(suggestion: any, menuQueue: any[]): boolean {
  // Check 1: Menu item exists (case-insensitive)
  if (suggestion.content_type === 'menu_item') {
    const menuItemName = suggestion.menu_item_name?.toLowerCase()
    const exists = menuQueue.some(item => 
      item.item_name.toLowerCase() === menuItemName
    )
    
    if (!exists) {
      console.warn(`⚠️ Menu item not found: ${suggestion.menu_item_name}`)
      return false
    }
  }

  // Check 2: Required fields present
  if (!suggestion.why_explanation || !suggestion.suggested_time) {
    console.warn(`⚠️ Missing required fields in suggestion`)
    return false
  }

  return true
}

// Filter suggestions
const validSuggestions = allSuggestions.filter(s => simpleValidate(s, menuQueue))

if (validSuggestions.length < 3) {
  console.warn(`⚠️ Only ${validSuggestions.length}/3 suggestions valid - returning what we have`)
}
```

**Lines Removed**: ~800  
**Lines Added**: ~50  
**Net**: -750

---

## PHASE 3: Simplify Response Structure

**Goal**: Remove pre-written copy fields, keep idea essentials

### Step 3.1: Update Output Interface

**File**: `supabase/functions/get-quick-suggestions/types.ts`

**OLD Response** (15+ fields):
```typescript
{
  id, title, rationale, why_explanation, occasion_context,
  photo_idea, menu_item_name, content_type, suggested_time,
  caption_base, cta_intent, menu_item_description, 
  service_period, weather_context, ...
}
```

**NEW Response** (10 fields):
```typescript
{
  content_type: string,              // "menu_item", "drink", "atmosphere"
  menu_item_name?: string,           // If menu_item or drink
  menu_item_description?: string,    // From menu_items_normalized
  why_explanation: string,           // Why this content now (100-150 chars)
  occasion_context?: string,         // Optional: "frokost rush", "aften hygge"
  suggested_time: string,            // "11:30", "17:00"
  photo_idea: string,                // Simplified 80-120 char guidance
  service_period?: string,           // "lunch", "dinner"
  cuisine_context?: string,          // Optional: "Thai", "Italian" (for analytics)
  date: string                       // "2026-06-24"
}
```

**Fields REMOVED** (moved to text generator):
- ❌ `title` → generated in `generate-text-from-idea`
- ❌ `caption_base` → generated in `generate-text-from-idea`
- ❌ `rationale` → consolidated into `why_explanation`
- ❌ `cta_intent` → inferred in text generator from content_type

**Lines Removed**: ~200

---

### Step 3.2: Update Prompt to Match New Output

**File**: `supabase/functions/get-quick-suggestions/prompt-builder.ts`

**OLD Prompt**:
```
Returner:
- title (catchy headline)
- caption_base (pre-written copy with hooks)
- rationale (strategic reasoning)
- why_explanation (customer-facing why)
- photo_idea (detailed 300-500 char instructions)
```

**NEW Prompt**:
```
Returner:
- why_explanation (why this content now - 100-150 chars)
- occasion_context (optional situational framing)
- suggested_time (HH:MM)

Photo guidance og detailed copy kommer senere - fokuser på idéens essens.
```

---

## PHASE 4: Simplify Photo Guidance

**Goal**: Reduce from 400 lines (detailed instructions) to 150 lines (cuisine-aware templates)

### Step 4.1: Generate Photo Hints in Suggestion Persister

**File**: `supabase/functions/get-quick-suggestions/suggestion-persister.ts`

**After AI suggestion received**:
```typescript
import { generatePhotoGuidance, generateNonMenuPhotoGuidance } from './photo-guidance.ts'

function enrichSuggestionWithPhoto(
  suggestion: any,
  menuItemWithCuisine?: { cuisine_context: string | null }
): any {
  let photoIdea: string

  if (suggestion.content_type === 'menu_item' && menuItemWithCuisine) {
    // Use cuisine-aware template
    photoIdea = generatePhotoGuidance(
      menuItemWithCuisine.cuisine_context,
      'menu_item'
    )
  } else if (suggestion.content_type === 'drink') {
    photoIdea = generatePhotoGuidance(null, 'drink')
  } else {
    // Atmosphere, behind-scenes
    photoIdea = generateNonMenuPhotoGuidance(suggestion.content_type)
  }

  return {
    ...suggestion,
    photo_idea: photoIdea,
    cuisine_context: menuItemWithCuisine?.cuisine_context || null
  }
}
```

**Lines Removed**: ~250 (detailed prompt-based photo generation)  
**Lines Added**: ~150 (templates + mapping)  
**Net**: -100

---

## PHASE 5: Defer Detailed Voice to Text Generator

**Goal**: Remove brand voice details from idea prompt, keep essential framing only

### Step 5.1: Simplify Brand Context in Prompt

**File**: `supabase/functions/get-quick-suggestions/prompt-builder.ts`

**OLD** (included in every slot prompt):
```typescript
BRAND VOICE:
- Tone: ${brandProfile.tone_dna.primary_tone}
- Formality: ${brandProfile.voice_patterns.formality_level}
- Address form: ${brandProfile.voice_patterns.address_form}
- Sentence style: ${brandProfile.voice_patterns.sentence_style}
- Avoid: ${brandProfile.voice_guardrails.forbidden_words.join(', ')}
```

**NEW** (essential framing only):
```typescript
VENUE:
- Type: ${businessProfile.vertical} (${businessProfile.establishment_type})
- Cuisine: ${cuisineContext || 'Mixed'} ← FROM ai_summary
- Segment: ${programmeProfile.programme_name}
```

**Detailed voice** (tone DNA, formality, sentence style, guardrails) → **moved to generate-text-from-idea** where actual copy is written.

**Lines Removed**: ~300

---

## PHASE 6: Testing & Validation

### Test Plan

#### Test 1: Cuisine Detection Accuracy
**File**: `_test_cuisine_integration.mjs`

```javascript
// Sample 50 menu items from production
// Verify cuisine_context correctly parsed
// Expected: 80%+ detection rate
```

#### Test 2: Photo Guidance Quality
**Script**: Manual review

```javascript
// Generate 20 suggestions
// Review photo_idea output
// Criteria:
// - 80-120 chars ✓
// - Contains angle + lighting + context ✓
// - Cuisine-appropriate ✓
```

#### Test 3: Operational Intelligence Preserved
**Cases**:
- ✅ Gap detection (Italian lunch breaks)
- ✅ Dead zone handling (00:00-05:59 generates next day)
- ✅ Kitchen close logic (75-min buffer)
- ✅ Hybrid venue support (bar closing at 02:00)

#### Test 4: Content Diversity
**Script**: Generate 7 days of suggestions

```javascript
// Verify:
// - No duplicate menu items across 3 slots
// - Mix of menu/drink/atmosphere maintained
// - 3-tier rotation queue working
// - Time-appropriate slot assignments
```

#### Test 5: Text Generator Compatibility
**File**: `supabase/functions/generate-text-from-idea/index.ts`

```typescript
// Test simplified suggestion input
const testSuggestion = {
  content_type: "menu_item",
  menu_item_name: "Pad Thai",
  why_explanation: "Thailandsk streetfood...",
  photo_idea: "Overhead 90°, bright daylight...",
  suggested_time: "11:30",
  cuisine_context: "Thai"
}

// Verify:
// - normalizeSuggestionInput() accepts new structure ✓
// - resolveContentContext() handles simplified fields ✓
// - Output caption quality maintained ✓
```

---

## Implementation Sequence

### Week 1: Foundation + Cuisine

**Day 1-2**: Phase 0 (Cuisine Integration)
- ✅ Create cuisine-parser.ts
- ✅ Create photo-guidance.ts
- ✅ Update getMenuRotationQueue() with JOIN
- ✅ Run integration test script
- ✅ Validate 80%+ cuisine detection rate

**Day 3-4**: Phase 1 (Unify AI Calls)
- ✅ Create buildUnifiedPrompt()
- ✅ Update serve() to use unified flow
- ✅ Test 2-call flow vs 4-call flow
- ✅ Verify output quality maintained

**Day 5**: Phase 2 (Remove Repair)
- ✅ Delete validateAndRepair() (~800 lines)
- ✅ Add simpleValidate() (~50 lines)
- ✅ Test validation catches bad menu items

### Week 2: Simplification + Testing

**Day 6**: Phase 3 (Simplify Response)
- ✅ Update types.ts interface
- ✅ Update prompt output format
- ✅ Update suggestion-persister.ts

**Day 7**: Phase 4 (Simplify Photo)
- ✅ Integrate photo-guidance.ts templates
- ✅ Update enrichSuggestionWithPhoto()
- ✅ Verify photo output quality

**Day 8**: Phase 5 (Defer Voice)
- ✅ Remove voice details from prompt
- ✅ Keep essential framing only
- ✅ Verify text generator still works

**Day 9-10**: Phase 6 (Testing)
- ✅ Run all 5 test suites
- ✅ Fix issues found
- ✅ Validate production parity

---

## Success Metrics

### Code Quality
- ✅ **Lines of code**: 1,940 (from 3,171) = 39% reduction
- ✅ **AI calls per request**: 2 (from 4) = 50% latency reduction
- ✅ **Token usage**: ~10,000 (from 20,000) = 50% cost reduction

### Functionality
- ✅ **Operational intelligence preserved**: 100%
- ✅ **Content diversity maintained**: 100%
- ✅ **Cuisine detection accuracy**: 80%+
- ✅ **Photo guidance quality**: Manual review pass

### User Experience
- ✅ **Response time**: <8s (from 12-15s)
- ✅ **Photo guidance usefulness**: User feedback positive
- ✅ **Text generator compatibility**: 100%

---

## Rollout Strategy

### Phase A: Development (Week 1-2)
- ✅ Build in feature branch: `refactor/v1-cuisine-photo`
- ✅ Test against production data (read-only)
- ✅ Validate all test cases pass

### Phase B: Staging (Week 3)
- ✅ Deploy to staging environment
- ✅ A/B test: 10% traffic to refactored V1
- ✅ Monitor: latency, cost, error rate, output quality
- ✅ Collect user feedback on photo guidance

### Phase C: Production Rollout (Week 4)
- ✅ 25% traffic → refactored V1
- ✅ 50% traffic → refactored V1
- ✅ 100% traffic → refactored V1
- ✅ Retire original V1 code

### Rollback Plan
- ✅ Keep original V1 code for 2 weeks post-100% rollout
- ✅ Feature flag: `USE_REFACTORED_V1=true/false`
- ✅ If issues: instant rollback to original V1

---

## Risk Mitigation

### Risk 1: Cuisine Detection Accuracy
**Mitigation**:
- Graceful fallback: If no cuisine detected → use 'default' photo template
- Monitor detection rate in production
- Iterate on CUISINE_PATTERNS regex if needed

### Risk 2: Unified Prompt Output Quality
**Mitigation**:
- A/B test unified vs sequential prompts
- If quality drops >10% → revert to 3 separate calls
- Compare suggestion diversity metrics

### Risk 3: Photo Guidance Too Generic
**Mitigation**:
- Collect user feedback via UI survey
- Iterate on templates based on feedback
- Option to A/B test: template-based vs prompt-based

### Risk 4: Text Generator Compatibility
**Mitigation**:
- Already validated: normalizeSuggestionInput() handles both formats
- Gradual rollout catches issues early
- Monitor text generation success rate

---

## Future Enhancements (Post-Launch)

### Enhancement 1: Dynamic Photo Templates
**Idea**: Learn from user photo uploads
- Track which dishes get photos uploaded
- Analyze uploaded photos (angle, lighting, composition)
- Refine templates based on actual usage patterns
**Effort**: 2-3 days

### Enhancement 2: Menu Item Cuisine Override
**Idea**: Store cuisine per menu item (not just per menu)
- Add `cuisine_style` column to `menu_items_normalized`
- Populate from item-level analysis (e.g., "Caesar Salad" = Italian even on Thai menu)
- More granular photo guidance
**Effort**: 1 day

### Enhancement 3: Seasonal Photo Guidance
**Idea**: Adjust templates by season/weather
- Summer: "Bright daylight" → "Golden hour (outdoor)"
- Winter: "Soft diffused" → "Cozy warm lighting"
**Effort**: 4 hours

### Enhancement 4: A/B Test Suggestion Quality
**Idea**: Measure downstream impact
- Track: Suggestion selection rate
- Track: Post publish rate
- Track: Post engagement (likes, comments)
- Correlate: Cuisine-aware suggestions vs generic
**Effort**: Ongoing

---

## Appendix: File Structure

```
supabase/functions/get-quick-suggestions/
├── index.ts                          # Main handler (refactored, ~400 lines)
├── types.ts                          # Interfaces (updated)
├── cache-manager.ts                  # Unchanged (~200 lines)
├── context-fetcher.ts                # Unchanged (~300 lines)
├── brand-context-builder.ts          # Simplified (-300 lines)
├── suggestion-persister.ts           # Updated (+50 lines)
├── ai-client.ts                      # Updated (unified call) (~150 lines)
├── prompt-builder.ts                 # Refactored (-600 lines)
├── cuisine-parser.ts                 # NEW (+120 lines)
└── photo-guidance.ts                 # NEW (+150 lines)

TOTAL: ~1,940 lines (from 3,171)
```

---

## Appendix: Database Changes

**No schema changes required!**

All data already exists:
- ✅ `menu_results_v2.ai_summary` (added 2026-02-22)
- ✅ `menu_items_normalized.menu_result_id` (FK exists)
- ✅ `daily_suggestions.photo_idea` (column exists)

**Optional enhancement** (future):
```sql
-- Add cuisine_context for analytics (optional)
ALTER TABLE daily_suggestions 
ADD COLUMN cuisine_context TEXT;

COMMENT ON COLUMN daily_suggestions.cuisine_context IS
  'Extracted cuisine style from menu_results_v2.ai_summary for analytics';
```

---

## Contact & Questions

**Implementation Lead**: [Your Name]  
**Technical Review**: [Reviewer Name]  
**Timeline**: 2 weeks (June 24 - July 5, 2026)  
**Next Checkpoint**: Phase 0 completion (June 26, 2026)

**Questions or blockers?**  
→ Document in `_IMPLEMENTATION_NOTES.md`  
→ Tag team in Slack #content-generation  

---

**Status**: ✅ Ready for Implementation  
**Last Updated**: 2026-06-24  
**Version**: 1.0
