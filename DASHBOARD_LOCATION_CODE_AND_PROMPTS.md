# Dashboard Location Page - Code & Prompts Reference

## Overview
This document contains all code and prompts for `http://localhost:3000/dashboard/location` - the Location Intelligence feature.

---

## 📍 Routing Configuration

**Location:** [src/App.tsx](src/App.tsx)

```tsx
// Lazy loaded component
const LocationIntelligencePage = lazy(() =>
  import('./pages/dashboard/LocationIntelligencePage').then((module) => ({ default: module.default }))
);

// Route definition
<Route path="location" element={<LocationIntelligencePage />} />
```

**Full URL:** `http://localhost:3000/dashboard/location`

---

## 🎯 Main Page Component

**File:** [src/pages/dashboard/LocationIntelligencePage.tsx](src/pages/dashboard/LocationIntelligencePage.tsx)

### Key Responsibilities:
1. **Display address** from business profile (read-only)
2. **Run location analysis** using Google Maps via Supabase Edge Function
3. **Execute 2-step analysis:**
   - **STEP 1:** Location Type Matching (independent of business)
   - **STEP 2:** Concept Fit Analysis (how business fits each location type)
4. **Auto-save results** to `business_location_intelligence` table
5. **Show location intelligence cards** with category scores and concept fit

### Main Functions:

#### `handleAnalyze()` - Main Analysis Orchestrator
```tsx
const handleAnalyze = async () => {
  // 1. Call Edge Function for location intelligence
  const analysis = await analyzeLocation(address, {
    useSupabaseFunction: true,
    businessId: businessId,
    forceRefresh: forceRefresh  // Bypass 90-day cache
  });
  
  // 2. STEP 1: Location Type Matching
  const locationTypeMatches = analyzeLocationTypes(locationContext, countryCode);
  
  // 3. STEP 2: Concept Fit Analysis (per category)
  for (const category of eligibleCategories) {
    const { data } = await supabase.functions.invoke('analyze-concept-fit', {
      body: {
        businessId: businessId,
        locationType: category.categoryId,
        language: i18n.language
      }
    });
    fitResults[category.categoryId] = data.conceptFit;
  }
  
  // 4. Auto-save
  await saveLocationProfile(analysis, fitResults, locationTypeMatches);
}
```

---

## 🔧 Core Analyzer Logic

### Location Analyzer
**File:** [src/lib/location/core/analyzer.ts](src/lib/location/core/analyzer.ts)

**Main function:**
```tsx
export async function analyzeLocation(
  address: string,
  options: AnalyzeOptions = {}
): Promise<LocationAnalysis>
```

**Flow:**
1. Calls Supabase Edge Function: `populate-location-intelligence`
2. Gets real Google Maps data (geocoding, POI counts, landmarks)
3. Transforms to locale-aware format
4. Returns `LocationAnalysis` object with category matches

### Concept Fit Analyzer
**File:** [src/lib/location/conceptFitAnalyzer.ts](src/lib/location/conceptFitAnalyzer.ts)

**Purpose:** Evaluate how well business concept fits each location category

**Dimensions evaluated:**
1. **Hours Fit:** Opening hours coverage vs. area demand windows
2. **Price Fit:** Price level vs. area sensitivity
3. **Service Fit:** Service model vs. area expectations

---

## 🚀 Edge Functions (Supabase)

### 1. populate-location-intelligence

**File:** `supabase/functions/populate-location-intelligence/index.ts`

**Purpose:** Fetch real Google Maps data and analyze location context

**Services:**
- **google-maps.ts:** Geocoding, POI detection, landmark discovery
- **claude-analyzer.ts:** AI enhancement with cultural context (GPT-4o)
- **location-analyzer.ts:** Scoring and categorization
- **database-saver.ts:** Save to `business_location_intelligence`

---

### 2. analyze-concept-fit

**File:** [supabase/functions/analyze-concept-fit/index.ts](supabase/functions/analyze-concept-fit/index.ts)

**Purpose:** AI-powered analysis of how well business fits a specific location type

**Steps:**
1. Fetch location intelligence from `business_location_intelligence`
2. Load location expectations for the category
3. Fetch business data (operations, profile, brand, menu)
4. Analyze 5 factors:
   - Customer Match
   - Motivation Match (AI-powered)
   - Pace Match
   - Price Match
   - Winning Angles Match
5. Generate strategy guidance (AI-powered)
6. Return comprehensive concept fit analysis

**Output structure:**
```typescript
{
  overall_fit_level: 'strong' | 'moderate' | 'challenging',
  overall_fit_score: number,
  customer_fit: 'good' | 'moderate' | 'poor',
  motivation_fit: 'good' | 'moderate' | 'poor',
  pace_fit: 'good' | 'moderate' | 'poor',
  price_fit: 'good' | 'moderate' | 'poor',
  winning_angles_fit: 'good' | 'moderate' | 'poor',
  fit_reasons: string[],
  mismatch_reasons: string[],
  strategy_positioning: string,
  emphasis: string[],
  avoid: string[],
  cta_style: string
}
```

---

## 🤖 AI Prompts

### Prompt 1: Location Context Analysis (GPT-4o)

**File:** [supabase/functions/populate-location-intelligence/services/claude-analyzer.ts](supabase/functions/populate-location-intelligence/services/claude-analyzer.ts)

**Method:** `buildPrompt()`

**Purpose:** Extract deep cultural context from location data

**Full Prompt (Danish):**

```
Du er en lokal guide med opdateret viden om steder, venues og locations.
Din opgave er at identificere og beskrive de mest relevante steder inden for gåafstand.

### DIN ROLLE:
- Tænk som en lokal guide der kender områdets geografi, bygninger og steder
- Identificér ALLE relevante locations inden for 1 km gåafstand
- Fokuser på 5 kategorier:

**1. KULTURELLE VENUES** (Højeste prioritet for pre-show positioning):
- Museer, teatre, koncertsale, biografer, kunstgallerier
- Historiske landemærker (domkirker, vikinge-sites, arkitektur)
- Kulturhuse, biblioteker, designcentre

**2. SHOPPING & BUTIKKER**:
- Department stores (stormagasiner)
- Lokale butikker, design-shops, specialforretninger
- Shoppinggader og handelstorve
- Beskriv TYPER af butikker, ikke specifikke navne

**3. NATUR & GRØNNE RUM**:
- Parker, botaniske haver, vandløb (fx Åen)
- Sceniske spots, strandpromenader
- Grønne byrum

**4. SPISESTEDER & CAFÉER** (Valgfrit - kun ikoniske steder):
- Populære eller unikke lokale spisesteder
- Kendte caféer med særligt præg
- KUN steder der er lokalt kendte eller særlige

**5. BEMÆRKELSESVÆRDIGE LANDEMÆRKER**:
- Kirker, torve, byarkitektur
- Ikoniske bygninger eller strukturer

### STRENGT FORBUDT - UNDGÅ DISSE FORMULERINGER:
❌ "hvor man kan..." (beskriver menneskers adfærd)
❌ "hyggelige caféer" (subjektiv vurdering)
❌ "levende område" (generisk)
❌ "tiltrækker besøgende/lokale" (demografi)
❌ "nyde en drink/måltid" (menneskers aktiviteter)
❌ "bred vifte af butikker" (generisk markedsføring)
❌ "fantastisk udsigt", "imponerende facade", "smuk arkitektur" (subjektive vurderinger)
❌ "tilbyder", "præsenterer", "byder på" (humanisering af bygninger)
❌ "vest", "øst", "nord", "syd" (retninger - upræcis data)
❌ "overfor", "på modsatte side af gaden" (præcis placering)
❌ "ved siden af", "lige ved", "naboer til" (præcise relative positioner)

**KORREKT TILGANG - BRUG DISSE FORMULERINGER:**
✅ "2 min gang fra ARoS Kunstmuseum med regnbuepanorama"
✅ "Området omfatter Aarhus Teater og Musikhuset"
✅ "Tæt på Aarhus Domkirkes gotiske facade"
✅ "Stormagasiner og mindre butikker i gågaden" (INGEN specifikke navne)
✅ "Området består af..." (ALDRIG "giver", "tilbyder")

### OUTPUT FORMAT:
1. **rich_neighborhood_character** (5-6 fyldige sætninger på dansk):
   - START: Nævn nærmeste museum/teater med præcis gåafstand (OBLIGATORISK)
   - FORTSÆT: Beskriv 3-4 andre nøgle-venues
   - PLACERING: Brug "tæt på", "ved", "i nærheden"
   - INKLUDER: Arkitektoniske detaljer (bygningsstile, facader)
   - TILFØJ: Geografiske elementer (åen, gader, pladser)
   - SHOPPING: Beskriv TYPER (stormagasiner, designbutikker) - ALDRIG navne
   - TONE: Faktuel, objektiv - som arkitekturguide, IKKE turistguide

2. **local_terminology** (liste af danske termer):
   - Kvartersnavne som lokale bruger (fx "Latinerkvarteret", "Åen")

3. **unique_visual_landmarks** (liste på dansk):
   - Instagram-spots relateret til kultur

4. **positioning_angles** (liste på dansk):
   - Pre-show/post-show positioning
   - Museum-adjacent positioning

5. **content_triggers** (liste med type + dansk forslag):
   - weather, time_of_day, event, seasonal triggers
```

**Model:** GPT-4o  
**Temperature:** 0.7  
**Max Tokens:** 1500

**Additional step:** Proofreading with GPT-4o (temperature 0.3) to fix Danish grammar

---

### Prompt 2: Motivation Fit Analysis (GPT-4o)

**File:** [supabase/functions/analyze-concept-fit/index.ts](supabase/functions/analyze-concept-fit/index.ts)

**Function:** `buildMotivationDetectionPrompt()`

**Purpose:** Detect which customer motivations the business serves

**Prompt structure:**

```typescript
`Du er ekspert i dansk restaurantbranchen og skal analysere hvilke kundemotivations denne forretning primært serverer.

FORRETNINGSDATA:

Åbningstider: ${JSON.stringify(operations?.opening_hours)}
Prisleje: ${operations?.price_level}
Etableringstype: ${operations?.establishment_type}

Service:
- Bordservice: ${operations?.has_table_service ? 'Ja' : 'Nej'}
- Takeaway: ${operations?.has_takeaway ? 'Ja' : 'Nej'}
- Levering: ${operations?.has_delivery ? 'Ja' : 'Nej'}

${shoppingContext}  // If location has shopping modifier

Om forretningen: ${profile?.long_description}

Menu oversigt: ${menuSummary}

OMRÅDETS TYPISKE MOTIVATIONER:
${expectedMotivations.map(m => `- ${m.name}: ${m.description}`).join('\n')}

OPGAVE:
1. Analysér forretningsdata
2. Identificér de 3-5 primære kundemotivationer forretningen serverer
3. Sammenlign med områdets typiske motivationer
4. Vurdér fit-niveau (good/moderate/poor)

Output JSON:
{
  "detected_motivations": [
    {
      "motivation": "navn",
      "confidence": 0.0-1.0,
      "evidence": "bevis fra data"
    }
  ],
  "overlap_with_location": {
    "matching": ["motivation1", "motivation2"],
    "missing": ["motivation3"]
  },
  "fit_level": "good" | "moderate" | "poor",
  "reasoning": "forklaring på dansk"
}`
```

**Model:** GPT-4o  
**Temperature:** 0.3  
**Max Tokens:** 3000

---

### Prompt 3: Strategy Generation (GPT-4o)

**File:** [supabase/functions/analyze-concept-fit/index.ts](supabase/functions/analyze-concept-fit/index.ts)

**Function:** `generateStrategy()`

**Purpose:** Generate marketing strategy based on concept fit analysis

**Called after all factor evaluations complete**

**Key inputs:**
- Fit level (strong/moderate/challenging)
- Strategy approach (amplify/adapt/contrarian)
- All factor results (customer, motivation, pace, price, winning angles)
- Menu summary

**Output:**
- Strategy positioning (one-liner)
- Content emphasis (3-5 bullets)
- What to avoid (2-3 bullets)
- CTA style (Friendly invite / Direct action / Community style)

---

## 📊 Data Flow

```
User clicks "Analysér" button
    ↓
LocationIntelligencePage.handleAnalyze()
    ↓
1. analyzeLocation() → Edge Function: populate-location-intelligence
   ├── Google Maps API (geocoding, POIs, landmarks)
   ├── GPT-4o (location context analysis)
   └── Returns LocationAnalysis with category matches
    ↓
2. analyzeLocationTypes() → Client-side location type matching
    ↓
3. For each eligible category (score ≥ 60%):
   └── Edge Function: analyze-concept-fit
       ├── Load location expectations
       ├── Fetch business data (ops, profile, brand, menu)
       ├── Evaluate 5 factors (rule-based + AI)
       ├── GPT-4o: Motivation detection
       ├── GPT-4o: Strategy generation
       └── Return ConceptFitOutput
    ↓
4. saveLocationProfile()
   └── Upsert to business_location_intelligence
       ├── category_scores
       ├── location_type_matches
       ├── concept_fit_by_category
       └── landmarks, neighborhood_character, etc.
```

---

## 🗄️ Database Schema

**Table:** `business_location_intelligence`

**Key columns:**
- `business_id` (FK)
- `neighborhood` (city/area name)
- `neighborhood_character` (AI-generated description)
- `area_type` (primary location category)
- `category_scores` (JSONB - all category scores)
- `location_type_matches` (JSONB - STEP 1 results)
- `concept_fit_by_category` (JSONB - STEP 2 results per category)
- `latitude`, `longitude`
- `landmarks_nearby` (array of objects)
- `location_marketing_hooks` (array of strings)
- `last_updated_by_ai` (timestamp)

---

## 🎨 UI Components

### Location Intelligence Cards
**Component:** `LocationIntelligenceCard.tsx`

Displays for each location category:
- Category icon and name
- Match score (0-100%)
- Concept fit level (Strong/Moderate/Challenging)
- One-liner positioning
- Fit reasons (expandable)
- Marketing emphasis
- What to avoid

---

## 🔑 Key Files Summary

| File | Purpose |
|------|---------|
| [src/pages/dashboard/LocationIntelligencePage.tsx](src/pages/dashboard/LocationIntelligencePage.tsx) | Main page component |
| [src/lib/location/core/analyzer.ts](src/lib/location/core/analyzer.ts) | Location analysis orchestrator |
| [src/lib/location/conceptFitAnalyzer.ts](src/lib/location/conceptFitAnalyzer.ts) | Concept fit evaluation logic |
| [supabase/functions/populate-location-intelligence/](supabase/functions/populate-location-intelligence/) | Edge Function: Google Maps + AI analysis |
| [supabase/functions/analyze-concept-fit/index.ts](supabase/functions/analyze-concept-fit/index.ts) | Edge Function: Concept fit analysis |
| [supabase/functions/populate-location-intelligence/services/claude-analyzer.ts](supabase/functions/populate-location-intelligence/services/claude-analyzer.ts) | GPT-4o location context prompts |

---

## 🧪 AI Models Used

1. **GPT-4o** for location context analysis (rich_neighborhood_character)
2. **GPT-4o** for motivation detection
3. **GPT-4o** for strategy generation
4. **GPT-4o** for Danish text proofreading

All use OpenAI API via `callAI()` helper function.

---

## 🔄 Caching Strategy

- Analysis results cached in `business_location_intelligence`
- Default cache: 7 days (configurable)
- User can force refresh via checkbox
- `last_updated_by_ai` timestamp tracks freshness

---

## 🌍 Localization

- Supports Danish (da-DK) and English (en-US)
- Category names localized via `getLocaleConfig()`
- AI prompts in Danish for Danish businesses
- UI strings via `react-i18next`

---

## 📝 Notes

- **Client-side fallback:** If Edge Functions fail, uses mock/client-side analysis
- **POI data:** Prefers Google Maps POI counts over landmark extraction
- **Category scoring:** Uses both Google Maps data + client-side detectors
- **Concept fit:** Only analyzes categories with ≥60% location score
- **Strategy driver:** First category (highest score) is strategy driver

---

**Last Updated:** May 22, 2026
