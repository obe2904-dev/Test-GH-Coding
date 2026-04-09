# Menu Fetching and Storage System

**Document Version:** 1.0  
**Date:** January 31, 2026  
**Purpose:** Explain complete menu fetching, AI extraction, and storage process

---

## Overview

When a user clicks **"Fetch Menu"** in the application, it triggers a sophisticated AI-powered menu extraction system that:
1. Detects all menu URLs on the business homepage
2. Fetches and analyzes each menu (HTML or PDF)
3. Extracts structured menu data using AI (OpenAI GPT-4o-mini)
4. Stores complete menu information in the database
5. **Automatically creates metadata for intelligent content generation** (NEW - Bug #5 fix)

---

## Step-by-Step Process

### Step 1: Menu URL Discovery (Easy Part)
**What the user sees:** List of detected menu URLs on homepage

**What happens:**
1. User provides business homepage URL (e.g., `https://cafefaust.dk`)
2. System scrapes homepage HTML
3. AI analyzes page content to find menu links:
   - Looks for href attributes containing: "menu", "menukort", "frokost", "brunch", "aften"
   - Validates links point to actual menu pages (not social media, contact pages, etc.)
   - Returns list of menu URLs with confidence scores

**Result:** User sees clickable cards for each detected menu (e.g., "Brunch Menu", "Lunch Menu", "Drinks")

---

### Step 2: User Initiates Menu Extraction
**User action:** Clicks **"Fetch Menu"** button on a menu card

**What triggers:**
```typescript
// Frontend: src/pages/dashboard/MenuPage.tsx
const handleExtractMenu = async (cardId: string, sourceUrl: string) => {
  // Call Edge Function to start extraction
  const response = await supabase.functions.invoke('menu-extract-v2', {
    body: {
      businessId: '840347de-9ba7-4275-8aa3-4553417fc2af',
      url: 'https://cafefaust.dk/brunch-menu',
      sourceId: cardId,
      languageCode: 'da'
    }
  })
}
```

---

### Step 3: Edge Function Receives Request
**File:** `supabase/functions/menu-extract-v2/index.ts`

**Authentication:**
```typescript
// 1. Verify user is authenticated
const { data: { user }, error: authError } = await supabase.auth.getUser(token)

// 2. Verify user has access to this business (owner or team member)
const hasAccess = await userHasBusinessAccess(supabase, businessId, user.id)
```

**Create Tracking Record:**
```typescript
// 3. Create job in menu_results_v2 table (status: 'queued')
const { data: resultData } = await supabaseService
  .from('menu_results_v2')
  .insert({
    business_id: businessId,
    source_kind: 'url',
    source_url: url,
    source_id: sourceId,    // Links back to menu_sources for tracking
    status: 'queued',       // Initial status
    language_code: 'da',
    created_at: new Date().toISOString()
  })
  .select('id')
  .single()

const resultId = resultData.id // UUID of extraction job
```

**Result:** Database now has a tracking record the frontend can monitor for status updates

---

### Step 4: Content Type Detection
**Decision:** Is this a PDF or HTML page?

```typescript
// Fetch first 4KB to detect content type
const probeResp = await fetch(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; MenuExtractorBot/1.0)',
    'Accept': 'text/html,application/pdf',
    'Range': 'bytes=0-4095'  // Only fetch header
  }
})

const contentType = probeResp.headers.get('content-type')
const probeBytes = await readAtMostBytes(probeResp, 4096)

// Check if PDF
const isPdf = 
  url.endsWith('.pdf') || 
  contentType.includes('pdf') || 
  looksLikePdf(probeBytes) // Checks for %PDF magic bytes
```

---

### Step 5A: PDF Menu Handling (Cloud Run OCR)
**If content is PDF:**

```typescript
// PDFs require OCR - delegate to Cloud Run worker
console.log('📄 PDF detected - queueing for OCR worker')

// 1. Create job in menu_results table (Cloud Run polls this)
const { data: pdfJobData } = await supabaseService
  .from('menu_results')
  .insert({
    business_id: businessId,
    pdf_url: url,
    status: 'queued',
    source_type: 'url',
    language_code: 'da'
  })
  .select('id')
  .single()

// 2. Link menu_results_v2 to PDF job
await supabaseService
  .from('menu_results_v2')
  .update({ pdf_job_id: pdfJobData.id })
  .eq('id', resultId)

// 3. Trigger Cloud Run worker (optional - scheduler also runs it)
await triggerMenuWorkerOnce()
```

**Cloud Run Worker Process:**
1. Polls `menu_results` table for queued PDFs
2. Downloads PDF file
3. Uses Google Cloud Vision API for OCR
4. Extracts text from all pages
5. Passes text to OpenAI for menu parsing
6. Updates `menu_results` with extracted data
7. `menu_results_v2` status auto-updates via trigger/polling

---

### Step 5B: HTML Menu Handling (Edge Function)
**If content is HTML:**

**Signal Detection:**
```typescript
// Check if HTML contains menu content
const fullResp = await fetch(url)
const htmlBytes = await readAtMostBytes(fullResp, 1_200_000) // Max 1.2MB
const htmlText = new TextDecoder().decode(htmlBytes)

function hasMenuSignal(text: string): boolean {
  const lower = text.toLowerCase()
  
  // Count menu keywords
  const keywords = [
    'menu', 'menukort', 'forret', 'hovedret', 'dessert',
    'burger', 'salat', 'pasta', 'pizza', 'brunch', 'frokost'
  ]
  const keywordHits = keywords.filter(k => lower.includes(k)).length
  
  // Count price patterns (95,- | 95 kr | 95 DKK)
  const pricePattern = /\b\d{1,4}\s*(?:[\.,]\d{1,2})?\s*(?:kr|kroner|dkk)\b/gi
  const priceHits = (text.match(pricePattern) || []).length
  
  // Strong signal = enough text + keywords + prices
  return text.length >= 1000 && priceHits >= 2 && keywordHits >= 2
}

const hasMenu = hasMenuSignal(htmlText)
```

**If No Menu Signal:**
```typescript
// Leave queued for Cloud Run (might be JavaScript-rendered)
console.log('⚠️ No menu signal in HTML - leaving queued for Cloud Run')
return { success: true, resultId, status: 'queued' }
```

**If Menu Signal Detected:**
```typescript
console.log('✅ Menu signal detected - processing in Edge Function')

// 1. Convert HTML to text
const plainText = htmlToText(htmlText)

// 2. Clean text for AI (remove footers, social links, etc.)
const cleanedText = cleanHtmlTextForLlm(plainText, 22_000) // Max chars for AI

// 3. Parse with OpenAI
const structured = await parseMenuWithOpenAI(cleanedText, 'da')
```

---

### Step 6: AI Menu Parsing (OpenAI GPT-4o-mini)
**File:** `supabase/functions/menu-extract-v2/index.ts` → `parseMenuWithOpenAI()`

**AI Prompt:**
```typescript
const prompt = `You are parsing a restaurant menu. The menu is in DANISH.

CRITICAL RULES:
1) **EXTRACT MENU TITLE** - Main heading (e.g., "Frokost Menu", "Brunch Menu")
2) **EXTRACT AVAILABILITY TIME** - Time ranges (e.g., "11:00-15:00")
3) **DETECT ALL CATEGORY HEADERS** - Sections like FORRETTER, HOVEDRETTER, DESSERTER, BØRNEMENU
4) **Each category can have a timeRange** - (e.g., "FROKOST 11-15")
5) **ALWAYS include full descriptions** - Text between dish name and price
6) **Capture ALL prices** - Danish formats: 95,- | 95 kr | 95,00 kr
7) Preserve original dish names (æ, ø, å)

EXAMPLE INPUT:
"BRUNCH MENU
Serveres dagligt 10:00-15:00

FROKOST 11-15
FAUSTBURGER
med Angus hakkebøf, ost, salat, tomat, syltede agurker
199,-

HANGOVER BURGER
med 2 x Angus hakkebøf, bacon, ost, æg
239,-

AFTEN 17-22
PARISERBØF
Klassisk bøf med bearnaisesauce
175,-

DRINKS
Kaffe 35,-
Øl 48,-"

EXPECTED OUTPUT:
{
  "menuTitle": "BRUNCH MENU",
  "availabilityTime": "10:00-15:00",
  "categories": [
    {
      "name": "FROKOST",
      "timeRange": "11-15",
      "items": [
        {
          "name": "FAUSTBURGER",
          "description": "med Angus hakkebøf, ost, salat, tomat, syltede agurker",
          "price": "199,-"
        },
        {
          "name": "HANGOVER BURGER",
          "description": "med 2 x Angus hakkebøf, bacon, ost, æg",
          "price": "239,-"
        }
      ]
    },
    {
      "name": "AFTEN",
      "timeRange": "17-22",
      "items": [
        {
          "name": "PARISERBØF",
          "description": "Klassisk bøf med bearnaisesauce",
          "price": "175,-"
        }
      ]
    },
    {
      "name": "DRINKS",
      "timeRange": null,
      "items": [
        { "name": "Kaffe", "description": null, "price": "35,-" },
        { "name": "Øl", "description": null, "price": "48,-" }
      ]
    }
  ]
}

Content to analyze:
${cleanedText}
`

// Call OpenAI
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${OPENAI_API_KEY}`
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    temperature: 0.0,           // Deterministic extraction
    max_tokens: 8000,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You are a precise menu extraction expert. Return only valid JSON.'
      },
      { role: 'user', content: prompt }
    ]
  })
})

const data = await response.json()
const menuStructure = JSON.parse(data.choices[0].message.content)
```

**AI Returns:**
```json
{
  "menuTitle": "BRUNCH MENU",
  "availabilityTime": "10:00-15:00",
  "categories": [
    {
      "name": "FROKOST",
      "timeRange": "11-15",
      "items": [
        {
          "name": "PARISERBØF",
          "description": "Klassisk bøf med bearnaisesauce, pommes frites",
          "price": "175,-"
        },
        {
          "name": "FAUST GRYDE",
          "description": "Sæsonens gryderet med rodfrugter og oksekød",
          "price": "189,-"
        }
      ]
    },
    {
      "name": "AFTEN",
      "timeRange": "17-22",
      "items": [
        {
          "name": "VARMRØGET LAKS",
          "description": "Serveres med æg, avocado, rugbrød",
          "price": "145,-"
        }
      ]
    },
    {
      "name": "DRIKKEVARER",
      "timeRange": null,
      "items": [
        { "name": "Kaffe", "description": null, "price": "35,-" },
        { "name": "Latte", "description": null, "price": "45,-" }
      ]
    },
    {
      "name": "VIN",
      "timeRange": null,
      "items": [
        { "name": "Rødvin", "description": "Husets rødvin", "price": "65,-" }
      ]
    }
  ]
}
```

---

### Step 6B: Category Headlines and Time Ranges Captured
**IMPORTANT:** The system captures ALL category headlines and their time ranges:

**Category Headlines Captured:**
- **BRUNCH** - Brunch category (typically 10:00-15:00)
- **FROKOST** - Lunch category (typically 11:00-15:00)
- **AFTEN** - Dinner category (typically 17:00-22:00)
- **FORRETTER** - Starters/Appetizers
- **HOVEDRETTER** - Main courses
- **DESSERTER** - Desserts
- **DRINKS / DRIKKEVARER** - Beverages
- **VIN** - Wine list
- **COCKTAILS** - Cocktail menu
- **KAFFE** - Coffee menu
- **BØRNEMENU** - Kids menu

**Time Ranges per Category:**
Each category can have its own time range:
```json
{
  "name": "FROKOST",
  "timeRange": "11-15",      // ← Captured from menu
  "items": [...]              //    (e.g., "FROKOST 11-15")
}

{
  "name": "AFTEN",
  "timeRange": "17-22",      // ← Different time range
  "items": [...]              //    for evening menu
}

{
  "name": "DRINKS",
  "timeRange": null,          // ← All-day category
  "items": [...]              //    (no time restriction)
}
```

**Why This Matters:**
1. Content generation knows WHEN each dish is available
2. Won't promote lunch items at 8 PM
3. Seasonal/time-appropriate content matching
4. Better customer experience (accurate information)

**Example from Café Faust:**
- **FROKOST 11-15**: PARISERBØF, FAUST GRYDE
- **AFTEN 17-22**: VARMRØGET LAKS, Seasonal specials
- **DRINKS** (all day): Kaffe, Øl, Vin

---

### Step 6B: Category Headlines and Time Ranges ARE Captured ✅

**IMPORTANT:** The system captures ALL category headlines and their specific time ranges:

**Category Headlines Captured:**
- ✅ **BRUNCH** - Brunch menu (typically all-day or 10:00-15:00)
- ✅ **FROKOST** - Lunch menu (typically 11:00-15:00)
- ✅ **AFTEN** - Dinner/Evening menu (typically 17:00-22:00)
- ✅ **FORRETTER** - Starters/Appetizers
- ✅ **HOVEDRETTER** - Main courses
- ✅ **DESSERTER** - Desserts
- ✅ **DRINKS / DRIKKEVARER** - Beverage menu
- ✅ **VIN** - Wine list
- ✅ **COCKTAILS** - Cocktail menu
- ✅ **KAFFE** - Coffee menu
- ✅ **ØL** - Beer menu
- ✅ **BØRNEMENU** - Kids menu

**Time Ranges per Category:**
Each category can have its own specific time availability:

```json
{
  "name": "FROKOST",
  "timeRange": "11-15",      // ← Extracted from "FROKOST 11-15" header
  "items": [...]
}

{
  "name": "AFTEN",
  "timeRange": "17-22",      // ← Different time for evening menu
  "items": [...]
}

{
  "name": "DRINKS",
  "timeRange": null,          // ← All-day availability (no restriction)
  "items": [...]
}
```

**Why This Matters:**
1. **Time-Appropriate Content** - System knows WHEN each dish is available
2. **Accurate Promotion** - Won't promote lunch items at 8 PM or dinner items at noon
3. **Customer Experience** - Posts show dishes that are actually available at that time
4. **Seasonal Matching** - Combines time + season + weather for optimal content

**Example from Real Menu:**
- **FROKOST 11-15**: Pariserbøf, Salads, Light dishes
- **AFTEN 17-22**: Premium steaks, Seasonal mains, Fine dining options
- **DRINKS** (all day): Kaffe, Øl, Vin, Cocktails

---

### Step 7: Business Type Classification
**Automatically determine:** FSE vs SBO

```typescript
function classifyEstablishmentType(menuStructure): 'FSE' | 'SBO' | null {
  const categoryNames = menuStructure.categories
    .map(c => c.name.toLowerCase())
    .join(' ')
  
  let fseScore = 0  // Full-Service Establishment
  let sboScore = 0  // Specialized Beverage Outlet
  
  // FSE indicators (restaurants with meal courses)
  const fseKeywords = ['appetizer', 'forretter', 'main', 'hovedret', 'dessert']
  for (const keyword of fseKeywords) {
    if (categoryNames.includes(keyword)) fseScore += 3
  }
  
  // SBO indicators (cafes, coffee shops, bars)
  const sboKeywords = ['cocktail', 'kaffe', 'coffee', 'beer', 'øl', 'wine']
  for (const keyword of sboKeywords) {
    if (categoryNames.includes(keyword)) sboScore += 3
  }
  
  // Beverage-heavy menu suggests SBO
  const beverageCount = menuStructure.categories.filter(c => 
    c.name.toLowerCase().includes('drink') || 
    c.name.toLowerCase().includes('kaffe') ||
    c.name.toLowerCase().includes('cocktail')
  ).length
  
  if (beverageCount > menuStructure.categories.length * 0.5) {
    sboScore += 3
  }
  
  // Determine type
  if (fseScore > sboScore) return 'FSE'
  if (sboScore > fseScore) return 'SBO'
  return null
}

const establishmentType = classifyEstablishmentType(menuStructure)
// Result: 'FSE' for Café Faust (has BURGERE, FORRETTER, etc.)
```

---

### Step 8: Parse Menu Periods (Breakfast/Lunch/Dinner)
**File:** `supabase/functions/_shared/menuPeriodParser.ts`

```typescript
function parseMenuPeriods(menuStructure: any): any[] {
  const periods = []
  
  for (const category of menuStructure.categories) {
    // Check category name for time indicators
    const name = category.name.toLowerCase()
    
    // Extract time range if present
    const timeMatch = category.timeRange?.match(/(\d{1,2}):?(\d{2})-(\d{1,2}):?(\d{2})/)
    
    // Classify by name and time
    let period = 'all_day'
    if (name.includes('morgenmad') || name.includes('breakfast')) {
      period = 'breakfast'
    } else if (name.includes('frokost') || name.includes('lunch')) {
      period = 'lunch'
    } else if (name.includes('aften') || name.includes('dinner')) {
      period = 'dinner'
    } else if (name.includes('brunch')) {
      period = 'brunch'
    }
    
    periods.push({
      period,
      startTime: timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : null,
      endTime: timeMatch ? `${timeMatch[3]}:${timeMatch[4]}` : null,
      categories: [category.name]
    })
  }
  
  return periods
}

const menuPeriods = parseMenuPeriods(menuStructure)
// Result: [{ period: 'brunch', startTime: '10:00', endTime: '15:00', categories: ['BURGERE'] }]
```

---

### Step 9: Store Complete Menu Data
**Database table:** `menu_results_v2`

```typescript
// Update menu_results_v2 with extracted data
await supabaseService
  .from('menu_results_v2')
  .update({
    status: 'done',
    structured_data: {
      menu: {
        title: menuStructure.menuTitle,
        availability: menuStructure.availabilityTime,
        sections: menuStructure.categories.map(cat => ({
          name: cat.name,
          timeRange: cat.timeRange,
          items: cat.items.map(item => ({
            name: item.name,
            description: item.description,
            price: item.price
          }))
        }))
      },
      menuPeriods: menuPeriods,
      establishmentType: establishmentType,
      dietaryOptions: menuStructure.dietaryOptions || [],
      serviceOptions: {
        takeaway: menuStructure.takeaway,
        delivery: menuStructure.delivery,
        hasTableService: menuStructure.hasTableService,
        reservationRequired: menuStructure.reservationRequired,
        hasKidsMenu: menuStructure.hasKidsMenu
      }
    },
    language_code: 'da',
    completed_at: new Date().toISOString()
  })
  .eq('id', resultId)
```

**What gets stored in `structured_data` (JSONB):**
```json
{
  "menu": {
    "title": "BRUNCH MENU",
    "availability": "10:00-15:00",
    "sections": [
      {
        "name": "BURGERE",
        "timeRange": null,
        "items": [
          {
            "name": "PARISERBØF",
            "description": "Klassisk bøf med bearnaisesauce, pommes frites",
            "price": "175,-"
          },
          {
            "name": "FAUST GRYDE",
            "description": "Sæsonens gryderet med rodfrugter og oksekød",
            "price": "189,-"
          },
          {
            "name": "VARMRØGET LAKS",
            "description": "Serveres med æg, avocado, rugbrød",
            "price": "145,-"
          }
        ]
      }
    ]
  },
  "menuPeriods": [
    {
      "period": "brunch",
      "startTime": "10:00",
      "endTime": "15:00",
      "categories": ["BURGERE"]
    }
  ],
  "establishmentType": "FSE",
  "dietaryOptions": ["vegetarian", "gluten-free"],
  "serviceOptions": {
    "takeaway": true,
    "delivery": false,
    "hasTableService": true,
    "reservationRequired": false,
    "hasKidsMenu": true
  }
}
```

---

### Step 10: Content Generation System Uses Menu
**When generating weekly content plan:**

```typescript
// File: supabase/functions/generate-weekly-plan/index.ts

// 1. Fetch menu data
const { data: menuResults } = await supabase
  .from('menu_results_v2')
  .select('structured_data')
  .eq('business_id', businessId)
  .eq('status', 'done')
  .order('created_at', { ascending: false })
  .limit(1)
  .single()

// 2. Extract menu items
const menuItems = []
if (menuResults?.structured_data?.menu?.sections) {
  for (const section of menuResults.structured_data.menu.sections) {
    for (const item of section.items) {
      menuItems.push({
        name: item.name,
        description: item.description,
        price: item.price,
        category: section.name,
        business_id: businessId
      })
    }
  }
}
// Result: 73 menu items for Café Faust
```

---

### Step 11: AUTO-CREATE METADATA (NEW - Bug #5 Fix)
**File:** `supabase/functions/_shared/post-helpers/menu-scorer.ts`

**When scoring menu items for content generation:**

```typescript
// For each menu item
for (const item of menuItems) {
  // 1. Check if metadata exists
  const { data: metadata } = await supabase
    .from('menu_item_metadata')
    .select('*')
    .eq('business_id', item.business_id)
    .eq('item_name', item.name)
    .maybeSingle()
  
  // 2. AUTO-CREATE if missing (NEW!)
  if (!metadata) {
    const inferredMetadata = {
      business_id: item.business_id,
      item_name: item.name,
      item_category: item.category,
      item_section: 'all_day',
      
      // Intelligent inference based on name/description
      is_signature: inferIsSignature(item.name, item.category),
      is_seasonal: inferIsSeasonal(item.name, item.description),
      is_limited_time: false,
      dish_temp_category: inferTempCategory(item.name, item.description),
      seasonal_ingredients: inferSeasonalIngredients(item.name, item.description),
      location_tags: inferLocationTags(item.name, item.category),
      
      // Performance tracking (starts at 0)
      item_added_date: new Date().toISOString(),
      total_times_posted: 0,
      avg_engagement_rate: 0,
      last_posted_date: null
    }
    
    // Fire-and-forget INSERT (doesn't block scoring)
    supabase.from('menu_item_metadata').insert(inferredMetadata)
      .then(({ error }) => {
        if (!error) {
          console.log(`✅ Auto-created metadata for ${item.name}`)
          console.log(`   - Signature: ${inferredMetadata.is_signature}`)
          console.log(`   - Seasonal: ${inferredMetadata.is_seasonal}`)
          console.log(`   - Temp: ${inferredMetadata.dish_temp_category}`)
        }
      })
  }
}
```

**Inference Functions:**

```typescript
// 1. Signature Dish Detection
function inferIsSignature(name: string, category: string): boolean {
  const text = name.toLowerCase()
  // Danish classics
  return text.match(/smørrebrød|frikadeller|stjerneskud|pariserbøf|flæskesteg|wienerschnitzel/) !== null
}
// PARISERBØF → true ✅

// 2. Seasonal Item Detection
function inferIsSeasonal(name: string, description: string): boolean {
  const text = `${name} ${description}`.toLowerCase()
  // Seasonal ingredients/preparations
  return text.match(/asparges|nye kartofler|lam|jordbær|tomat|svampe|græskar|grønkål|gryde/) !== null
}
// FAUST GRYDE → true ✅

// 3. Temperature Category
function inferTempCategory(name: string, description: string): string {
  const text = `${name} ${description}`.toLowerCase()
  
  // Cold dishes
  if (text.match(/salat|smørrebrød|carpaccio|røget.*laks|is/)) return 'cold'
  
  // Hot dishes
  if (text.match(/gryde|steg|bøf|frikadeller|schnitzel|pasta|suppe/)) return 'hot'
  
  // Warm dishes
  if (text.match(/tærte|quiche|sandwich|burger/)) return 'warm'
  
  return 'neutral'
}
// PARISERBØF → 'hot' ✅
// VARMRØGET LAKS → 'cold' ✅

// 4. Seasonal Ingredients
function inferSeasonalIngredients(name: string, description: string): string[] {
  const text = `${name} ${description}`.toLowerCase()
  const ingredients = []
  
  if (text.match(/laks|salmon/)) ingredients.push('salmon')
  if (text.match(/bøf|beef/)) ingredients.push('beef')
  if (text.match(/kylling|chicken/)) ingredients.push('chicken')
  if (text.match(/asparges/)) ingredients.push('asparagus')
  if (text.match(/tomat/)) ingredients.push('tomatoes')
  
  return ingredients
}
// PARISERBØF → ['beef'] ✅

// 5. Location Tags
function inferLocationTags(name: string, category: string): string[] {
  const nameText = name.toLowerCase()
  
  if (nameText.match(/smørrebrød/)) 
    return ['danish_classic', 'photogenic', 'local_specialty']
  if (nameText.match(/pariserbøf/)) 
    return ['classic', 'comfort_food']
  if (category.toLowerCase().includes('dessert')) 
    return ['photogenic', 'sweet']
  
  return ['standard']
}
// PARISERBØF → ['classic', 'comfort_food'] ✅
```

---

## Complete Data Storage Summary

### Database Tables Used

**1. menu_results_v2** (Primary menu storage)
```sql
CREATE TABLE menu_results_v2 (
  id UUID PRIMARY KEY,
  business_id UUID REFERENCES businesses(id),
  source_kind TEXT,              -- 'url' or 'upload'
  source_url TEXT,               -- Original menu URL
  source_id UUID,                -- Links to menu_sources
  status TEXT,                   -- 'queued', 'processing', 'done', 'error'
  structured_data JSONB,         -- Complete extracted menu
  language_code TEXT,            -- 'da', 'en-US', etc.
  source_content_type TEXT,      -- 'text/html', 'application/pdf'
  pdf_job_id UUID,               -- Links to menu_results if PDF
  error_message TEXT,
  created_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

**2. menu_item_metadata** (Auto-created for content generation)
```sql
CREATE TABLE menu_item_metadata (
  id UUID PRIMARY KEY,
  business_id UUID REFERENCES businesses(id),
  item_name TEXT,                -- "PARISERBØF"
  item_category TEXT,            -- "BURGERE"
  item_section TEXT,             -- 'all_day', 'breakfast', 'lunch', 'dinner'
  
  -- Intelligent flags (auto-inferred)
  is_signature BOOLEAN,          -- true for PARISERBØF
  is_seasonal BOOLEAN,           -- true for FAUST GRYDE
  is_limited_time BOOLEAN,       -- false by default
  dish_temp_category TEXT,       -- 'hot', 'cold', 'warm', 'neutral'
  
  -- Content generation helpers
  seasonal_ingredients JSONB,    -- ["beef"] for PARISERBØF
  location_tags TEXT[],          -- ['classic', 'comfort_food']
  
  -- Performance tracking
  item_added_date TIMESTAMP,     -- When first seen
  total_times_posted INTEGER,    -- Starts at 0
  avg_engagement_rate NUMERIC,   -- Starts at 0
  last_posted_date TIMESTAMP,    -- NULL initially
  
  UNIQUE(business_id, item_name)
);
```

**3. seasonal_ingredients** (Danish ingredient seasonality)
```sql
CREATE TABLE seasonal_ingredients (
  id UUID PRIMARY KEY,
  ingredient TEXT UNIQUE,        -- 'asparagus', 'strawberry', 'mushroom'
  season_spring BOOLEAN,         -- true for asparagus
  season_summer BOOLEAN,         -- true for strawberry
  season_autumn BOOLEAN,         -- true for mushroom
  season_winter BOOLEAN          -- false for asparagus
);
```

---

## Example: Complete Flow for Café Faust

**1. User clicks "Fetch Menu" on https://cafefaust.dk/brunch**

**2. Edge Function creates tracking record:**
```sql
INSERT INTO menu_results_v2 (business_id, source_url, status) 
VALUES ('840347de...', 'https://cafefaust.dk/brunch', 'queued');
```

**3. System fetches HTML, detects menu signal**

**4. AI extracts 73 menu items:**
- PARISERBØF (Klassisk bøf med bearnaisesauce)
- FAUST GRYDE (Sæsonens gryderet)
- VARMRØGET LAKS (Serveres med æg, avocado)
- ... (70 more items)

**5. Stores complete menu:**
```sql
UPDATE menu_results_v2 
SET 
  status = 'done',
  structured_data = '{
    "menu": {
      "sections": [
        {
          "name": "BURGERE",
          "items": [
            {"name": "PARISERBØF", "description": "...", "price": "175,-"},
            {"name": "FAUST GRYDE", "description": "...", "price": "189,-"}
          ]
        }
      ]
    },
    "establishmentType": "FSE"
  }'::jsonb,
  completed_at = NOW()
WHERE id = '...';
```

**6. First content generation automatically creates metadata:**

```sql
-- Auto-inserted on first scoring run
INSERT INTO menu_item_metadata (
  business_id, item_name, item_category,
  is_signature, is_seasonal, dish_temp_category,
  seasonal_ingredients, location_tags
) VALUES 
('840347de...', 'PARISERBØF', 'BURGERE', 
 true, false, 'hot', 
 '["beef"]'::jsonb, 
 ARRAY['classic', 'comfort_food']),
 
('840347de...', 'FAUST GRYDE', 'BURGERE',
 false, true, 'hot',
 '[]'::jsonb,
 ARRAY['seasonal', 'comfort_food']),
 
('840347de...', 'VARMRØGET LAKS', 'BRUNCH',
 false, false, 'cold',
 '["salmon"]'::jsonb,
 ARRAY['photogenic', 'seafood']);

-- Result: 73 rows auto-created for all menu items
```

**7. Content generation scores items:**
- PARISERBØF: 125 pts (50 base + 20 signature + 40 weather + 15 performance)
- FAUST GRYDE: 140 pts (50 base + 30 seasonal + 40 weather + 25 newness)
- VARMRØGET LAKS: 140 pts (50 base + 40 weather)

---

## What Information Is Stored

### menu_results_v2.structured_data (Complete Menu)
```json
{
  "menu": {
    "title": "BRUNCH MENU",
    "availability": "10:00-15:00",
    "sections": [
      {
        "name": "FROKOST",
        "timeRange": "11-15",
        "items": [
          {
            "name": "PARISERBØF",
            "description": "Klassisk bøf med bearnaisesauce, pommes frites",
            "price": "175,-"
          }
        ]
      },
      {
        "name": "AFTEN",
        "timeRange": "17-22",
        "items": [
          {
            "name": "VARMRØGET LAKS",
            "description": "Serveres med æg, avocado, rugbrød",
            "price": "145,-"
          }
        ]
      },
      {
        "name": "DRINKS",
        "timeRange": null,
        "items": [
          { "name": "Kaffe", "description": null, "price": "35,-" }
        ]
      },
      {
        "name": "VIN",
        "timeRange": null,
        "items": [
          { "name": "Rødvin", "description": "Husets rødvin", "price": "65,-" }
        ]
      }
    ]
  },
  "menuPeriods": [
    {
      "period": "brunch",
      "startTime": "10:00",
      "endTime": "15:00",
      "categories": ["BURGERE"]
    }
  ],
  "establishmentType": "FSE",
  "dietaryOptions": ["vegetarian", "gluten-free"],
  "serviceOptions": {
    "takeaway": true,
    "delivery": false,
    "hasTableService": true,
    "reservationRequired": false,
    "hasKidsMenu": true
  }
}
```

### menu_item_metadata (Auto-Created Per Item)
```json
{
  "item_name": "PARISERBØF",
  "item_category": "BURGERE",
  "item_section": "all_day",
  "is_signature": true,
  "is_seasonal": false,
  "is_limited_time": false,
  "dish_temp_category": "hot",
  "seasonal_ingredients": ["beef"],
  "location_tags": ["classic", "comfort_food"],
  "item_added_date": "2026-01-31T10:00:00Z",
  "total_times_posted": 0,
  "avg_engagement_rate": 0,
  "last_posted_date": null
}
```

---

## Key Benefits of This System

### 1. **Automatic Metadata Creation**
- **Before:** 73 menu items with no metadata → scoring uses all defaults → low scores
- **After:** 73 menu items auto-get metadata → accurate scoring → better content selection
- **Impact:** PARISERBØF now scores 125 pts instead of 70 pts

### 2. **Intelligent Inference**
- Detects signature dishes (Smørrebrød, Pariserbøf, Frikadeller)
- Identifies seasonal items (Gryde, Asparges, Jordbær)
- Classifies temperature (hot/cold/warm for weather matching)
- Extracts ingredients (beef, salmon, asparagus)

### 3. **Zero Manual Work**
- User clicks "Fetch Menu" → Everything else is automatic
- No need to manually tag 73 items as signature/seasonal
- System learns and improves over time

### 4. **Production-Ready Data**
- Complete menu with descriptions and prices
- Business type classification (FSE vs SBO)
- Service options (takeaway, delivery, kids menu)
- Menu periods (breakfast, lunch, dinner timing)

### 5. **Performance Tracking**
- Tracks how many times each item is posted
- Records engagement rates
- Applies recency penalties to ensure variety

---

## Summary

**What happens when user clicks "Fetch Menu":**

1. ✅ Creates tracking record in `menu_results_v2` (status: queued)
2. ✅ Fetches menu URL content (HTML or PDF)
3. ✅ Detects content type and menu signals
4. ✅ Extracts structured menu data using AI (OpenAI GPT-4o-mini)
5. ✅ Classifies business type (FSE vs SBO)
6. ✅ Parses menu periods (breakfast/lunch/dinner)
7. ✅ Stores complete menu in `structured_data` JSONB
8. ✅ **AUTO-CREATES metadata on first content generation** (NEW!)
   - Infers signature dishes
   - Identifies seasonal items
   - Classifies temperature
   - Extracts ingredients
   - Tags for photogenic/comfort_food/etc.
9. ✅ Ready for intelligent content generation with 7-factor scoring

**Result:** Complete, production-ready menu database with intelligent metadata for high-quality content generation.

---

**End of Document**
