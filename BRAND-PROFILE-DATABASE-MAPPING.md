# Brand Profile & Persona - Database Mapping

**Last Updated:** 23. maj 2026  
**Business:** Café Faust (f4679fa9-3120-4a59-9506-d059b010c34a)

---

## 📊 **Database Tables Overview**

### **1. `business_brand_profile` Table**

| Column | Type | Status | Data Source | Notes |
|--------|------|--------|-------------|-------|
| `business_id` | UUID | ✅ Active | Primary Key | - |
| **V5 JSONB (Single Source of Truth)** |
| `brand_profile_v5` | JSONB | ✅ Active | `brand-profile-generator-v5` | Complete V5 structure |
| `brand_profile_v5_generated_at` | TIMESTAMP | ✅ Active | Generated timestamp | - |
| `brand_profile_v5_version` | TEXT | ✅ Active | "5.2.0" | - |
| **Menu Intelligence (Separate Function)** |
| `menu_overview_summary` | JSONB | ✅ Active | `menu-overview-summary` | Cross-menu summary |
| `signature_themes` | TEXT[] | ✅ Active | `menu-overview-summary` | 7 themes for Café Faust |
| `gastronomic_profile` | TEXT | ✅ Active | `menu-overview-summary` | Concise culinary positioning |
| **DEPRECATED Identity Fields** |
| `brand_essence` | TEXT | ❌ NULL | DEPRECATED | Removed - use `signature_themes` |
| `positioning` | TEXT | ❌ NULL | DEPRECATED | Removed - use `signature_themes` |
| `core_values` | TEXT[] | ❌ NULL | DEPRECATED | Removed |
| `what_makes_us_different` | TEXT | ❌ NULL | DEPRECATED | Removed |
| `identity_confidence` | NUMERIC | ❌ NULL | DEPRECATED | Removed |
| `identity_reasoning` | TEXT | ❌ NULL | DEPRECATED | Removed |
| **Metadata** |
| `created_at` | TIMESTAMP | ✅ Active | Auto | - |
| `updated_at` | TIMESTAMP | ✅ Active | Auto | - |

---

## 🏗️ **`brand_profile_v5` JSONB Structure**

### **Layer 0: Business Intelligence** (`layer_0_intelligence`)

```typescript
{
  // Business Type Detection (AI)
  business_type: {
    detected_type: "hybrid_cafe",           // AI-detected
    professional_domain: "all-day dining",  // AI-detected
    confidence: 0.90,                       // AI confidence
    reasoning: "..."                        // AI explanation
  },
  
  // Business Identity Persona (AI - WHO the business IS)
  business_identity: {
    system_persona: "Cafe Faust er en hybrid cafe...", // ~150 words
    metadata: {
      culinary_character: "...",
      service_model: "all-day",
      price_positioning: "mid-range",
      atmosphere_keywords: ["..."]
    }
  },
  
  // Cross-Menu Summary (from menu-overview-summary)
  menu_overview: {
    cross_menu_summary: "Dansk madkultur møder international...",
    total_items: 195,
    total_menus: 6,
    overall_avg_price: 136,
    menu_breakdown: [...],
    signature_themes: [
      "Dansk og International Fusion",
      "Amerikansk Diner-stil",
      "Hjemmelavet og Lokal Identitet",
      "Sundhed og Diætbevidsthed",
      "Eksklusivitet og Autenticitet",
      "Cocktail Innovation",
      "All-day Dining med Brunch-fokus"
    ],
    generated_at: "2026-05-23T..."
  },
  
  // AI-Generated City Context (90-day cache)
  city_context_ai: {
    city: "Aarhus",
    country: "Denmark",
    population: 285000,
    city_size: "major_city",
    cultural_context: "Danmarks næststørste by, stor studiepopu...",
    tone: ["studiebykultur", "Aarhus Å", "kulturel mangfoldighed"],
    characteristics: [...],
    cached_until: "2026-08-21T...",
    ai_generated: true
  },
  
  // Geographic Context
  geographic_context: {
    postal_code: "8000",
    city: "Aarhus",
    population_size: "major_city",
    population: 285000,
    location_type: "waterfront",
    signature_reference: "ved åen",
    city_profile_description: {...},
    location_advantages: [...],
    narrative: "..."
  },
  
  // Professional Persona (LEGACY - being phased out)
  professional_persona: {
    expertise_areas: ["all-day dining", "casual waterfront", "..."],
    content_focus: ["menu variety", "location USP", "..."],
    formality: "casual",
    sentence_style: "conversational",
    emoji_usage: "moderate",
    system_prompt_preview: "..."
  },
  
  // Voice Archetype
  voice_archetype: {
    archetype_id: "versatile_casual_waterfront",
    base_rules: ["...", "..."],
    base_rules_count: 5,
    formality_level: "casual",
    sentence_structure: "short_punchy",
    location_context_weight: 0.75,
    content_priorities: [...]
  }
}
```

---

### **Programmes** (`programmes[]`)

```typescript
[
  {
    type: "morning",
    name: "Morgenmad/Brunch",
    timeWindow: { start: "07:00", end: "11:00" },
    daysOfWeek: ["man", "tir", "ons", "tor", "fre", "lør", "søn"],
    confidence: "high",
    menuEvidence: ["BRUNCH", "FROKOST"],
    
    // Commercial Orientation (Layer 2 - AI per programme)
    commercialOrientation: {
      decision_timing: "spontaneous_walk_in",
      baseline_goal_split: {
        drive_footfall: 0.70,
        strengthen_brand: 0.20,
        retain_guests: 0.10
      },
      content_type_affinity: {
        product: 0.60,
        place: 0.25,
        experience: 0.15
      },
      reasoning: "Café Faust ligger i et område med høj konkurrence..."
    },
    
    // Audience Segments (Layer 4 - AI per programme)
    audienceSegments: [
      {
        segment_name: "Spontane brunch-gæster",
        motivation: "social_gathering",
        timing_preference: "Lør-Søn 10:00-14:00",
        content_angle: "Social brunch-oplevelse ved åen",
        confidence: 0.9
      },
      // ... more segments
    ]
  },
  // ... 3 more programmes (lunch, dinner, bar)
]
```

---

### **DEPRECATED: Identity** (`identity`)

```typescript
// ❌ REMOVED - This entire section no longer generated
// Use signature_themes + gastronomic_profile instead
identity: undefined  // Not included in V5 profile anymore
```

**Rationale:**
- Generic summaries ("alsidig all-day dining destination")
- Redundant with more specific menu intelligence
- Less actionable than signature themes

---

### **Voice** (`voice`)

```typescript
{
  tone_rules: [
    "Brug korte, præcise sætninger for at formidle budskaber klart.",
    "Inddrag lokale referencer, fx 'ved åen', for at skabe forbindelse til Aarhus.",
    "Vær direkte og personlig i kommunikationen — tal til gæsten som en ven.",
    "Fremhæv menuens alsidighed og fusionstemaer med appetitvækkende beskrivelser.",
    "Brug let humor og legende vendinger for at matche den afslappede caféstemning."
  ],
  structural_rules: [...],
  style_rules: [...],
  personality_traits: ["direkte", "venlig", "lokal", "legende"],
  formality_level: "informal",
  humor_style: "playful",
  sentence_structure: "conversational",
  content_anchors: [],
  avoid_examples: [],
  voice_confidence: 0.8,
  voice_reasoning: "AI-genereret stemmeprofil baseret på omfattende business intelligence.\n\nKontekst-faktorer analyseret:\n• kulturel kontekst (...)\n• målgrupper (waterfront (95 score), city_centre (85 score))\n• prisniveau (mid-range)\n• område (Ikonisk gade langs Aarhus Å...)\n• arketype: versatile_casual_waterfront\n\nVigtigste påvirkninger:\n• Menu-temaer: Dansk og International Fusion, Amerikansk Diner-stil, Hjemmelavet og Lokal Identitet\n• Tone: uformel med \"direkte, venlig, lokal\" personlighed\n• Geografisk tilpasning: Aarhus",
  enforcement_level: "moderate",
  sentence_length_max: 15
}
```

**Voice Input Sources:**
- ✅ `signature_themes` (Menu Intelligence)
- ✅ `city_context_ai.cultural_context` (City Context)
- ✅ `location.category_scores` filtered (waterfront, city_centre only)
- ✅ `menu_overview.overall_avg_price` (Price tier)
- ✅ `location.neighborhood_character` (Area character)
- ❌ ~~`identity.brand_essence`~~ (REMOVED)
- ❌ ~~`identity.core_values`~~ (REMOVED)

---

### **Writing Examples** (`writing_examples`)

```typescript
{
  typical_openings: [
    "Vi er klar.",
    "Kom forbi.",
    "Se dagens menu.",
    "Book dit bord."
  ],
  typical_closings: [
    "Kom og smag verden ved åen!",
    "Book nu og nyd vores fusionfavoritter!",
    "Ses vi til en kaffe ved åen?",
    "Gem dette indlæg og del med en ven!"
  ],
  signature_phrases: [
    "ved åen",
    "hjemmelavet",
    "regionale råvarer",
    "frisk hver dag"
  ]
}
```

---

### **Guardrails** (`guardrails`)

```typescript
{
  never_say: [
    { wrong: "billig", right: "god værdi" },
    { wrong: "lækkert", right: "sprød eller cremet" },
    { wrong: "fantastisk", right: "(fjern ordet)" },
    { wrong: "dejlig", right: "(vær konkret)" },
    { wrong: "unik", right: "noget du ikke finder ved åen" },
    { wrong: "perfekt", right: "lige som mor laver det" },
    { wrong: "traditionel", right: "som vi gør det her i Aarhus" }
  ],
  content_exclusions: [
    "Undgå at diskutere følsomme sundhedsemner...",
    "Ingen omtale af alkohol eller rusmidler på en måde der opfordrer til overforbrug",
    "Undgå at inkludere negativ eller stødende sprogbrug...",
    "Ingen deling af personlige data...",
    "Undgå at fremhæve eller diskutere fødevareallergener...",
    "Ingen uautoriserede billeder eller omtaler af kendte personer"
  ],
  factual_constraints: [
    "Opfind aldrig events, tilbud, musik eller arrangementer",
    "Bekræft åbningstider før nævnelse",
    "Ingen påstande om \"bedst\", \"første\" eller superlatives uden dokumentation",
    "Verificer menupunkter eksisterer før omtale"
  ],
  avoid_patterns: {...},
  length_limits: {...}
}
```

---

## 🎯 **Persona Mapping**

### **"System Persona" (WHO the business IS)**

**Location in Database:**
```
business_brand_profile.brand_profile_v5
  -> layer_0_intelligence
  -> business_identity
  -> system_persona
```

**Example Value:**
```
"Cafe Faust er en hybrid cafe i Aarhus, der kombinerer all-day dining med 
en bred menu af dansk og international mad. Med 195 retter fordelt over 6 
menukort tilbyder stedet alt fra morgenmad til cocktails sent om aftenen. 
Menuen spænder fra klassisk dansk smørrebrød og pariserbøf til internationale 
favoritter som falafel, eggs benedict og moules frites. KULINARISK KARAKTER: 
Stedet kendetegnes ved en fusion af madtraditioner med hjemmelavede komponenter 
som FAUST dressing, hjemmelavet nutella og salmon rillettes..."
```

**Generated By:** `business-identity-persona.ts` (GPT-4o, temp 0.3)

**Used For:**
- AI content generation context
- Professional domain understanding
- Preventing product hallucination

---

### **"Professional Persona" (LEGACY - being phased out)**

**Location in Database:**
```
business_brand_profile.brand_profile_v5
  -> layer_0_intelligence
  -> professional_persona
```

**Status:** Kept for backward compatibility, being replaced by `business_identity`

---

## 📍 **Location Intelligence Mapping**

### **Table: `business_location_intelligence`**

| Field | Current Value (Café Faust) | Status | Notes |
|-------|----------------------------|--------|-------|
| `category_scores` | `{waterfront: 95, student: 88, city_centre: 85, tourist: 82, transport_hub: 60, shopping_district: 55, residential: 20}` | ⚠️ v1 (mixed) | Contains demographics + geographic |
| `neighborhood_character` | "Ikonisk gade langs Aarhus Å med caféliv..." | ✅ Active | - |
| `area_type` | "urban_waterfront" | ✅ Active | - |
| `concept_fit_by_category` | {...} | ✅ Active | Marketing implications per category |

**Filtering Applied:**
- **UI Display:** Client-side filter to score >= 60 (shows waterfront 95, city_centre 85)
- **Voice Generation:** Server-side filter removes `student`, `tourist` before passing to AI
- **Planned v2:** Separate `demographic_proximity` field (not yet migrated)

---

## 🔄 **Data Flow**

### **Step 1: Menu Overview Summary**
```
menu-overview-summary Edge Function
  ↓
Reads: menu_results_v2.structured_data (195 items from 6 menus)
  ↓
Generates:
  - cross_menu_summary (bullets)
  - signature_themes (7 themes)
  - gastronomic_profile (2-3 sentences)
  ↓
Saves to: business_brand_profile
  - menu_overview_summary (JSONB)
  - signature_themes (TEXT[])
  - gastronomic_profile (TEXT)
```

### **Step 2: Brand Profile V5**
```
brand-profile-generator-v5 Edge Function
  ↓
Reads:
  - business table (name, category, location)
  - menu_results_v2 (menu data)
  - business_location_intelligence (location scores)
  - business_brand_profile.menu_overview_summary (from Step 1)
  ↓
Generates (AI):
  - Layer 0: Business type, identity persona, city context
  - Layer 1: Programme detection (deterministic)
  - Layer 2: Commercial orientation per programme (GPT-4o-mini)
  - Layer 4: Audience segments per programme (GPT-4o-mini)
  - Layer 5: Voice, writing examples, guardrails (GPT-4o)
  ↓
Saves to: business_brand_profile
  - brand_profile_v5 (JSONB - complete structure)
  - brand_profile_v5_generated_at
  - brand_profile_v5_version ("5.2.0")
  ↓
Also saves to: business_programme_profiles
  - 4 programme records (morning, lunch, dinner, bar)
```

---

## 📱 **UI Display Mapping**

### **BrandProfilePageV5.tsx**

| UI Section | Data Source | Database Path |
|------------|-------------|---------------|
| **Menu Intelligence** | `signature_themes`, `gastronomic_profile`, `menu_overview_summary` | `business_brand_profile.signature_themes`<br>`business_brand_profile.gastronomic_profile`<br>`business_brand_profile.menu_overview_summary` |
| **Programmes** | `brand_profile_v5.programmes[]` | `business_brand_profile.brand_profile_v5 -> programmes` |
| **Commercial Strategy** | `brand_profile_v5.programmes[].commercialOrientation` | `...programmes[].commercialOrientation` |
| **Audience Segments** | `brand_profile_v5.programmes[].audienceSegments` | `...programmes[].audienceSegments` |
| **~~Identity~~** (REMOVED) | ~~`brand_essence`, `positioning`~~ | ❌ Deprecated section removed from UI |
| **Voice** | `brand_profile_v5.voice` | `...voice.tone_rules`, `...voice.personality_traits` |
| **Writing Examples** | `brand_profile_v5.writing_examples` | `...writing_examples` |
| **Guardrails** | `brand_profile_v5.guardrails` | `...guardrails` |

---

## ✅ **What's Working (23. maj 2026)**

- ✅ Menu intelligence (195 items, 7 signature themes, gastronomic profile)
- ✅ Business type detection (hybrid_cafe, 90% confidence)
- ✅ Voice using signature themes instead of generic brand essence
- ✅ Location filtering (waterfront + city_centre only in voice)
- ✅ Programme-specific commercial strategy and audiences
- ✅ Identity section removed from UI (cleaner)
- ✅ No 500 errors, successful generation in ~60s

## ⚠️ **Pending Work**

- ⏳ Full location architecture v2 migration (separate demographics)
- 🔍 Student audience price logic (max vs avg price consideration)
- 📝 Documentation in `LOCATION-DATA-CONSUMER-GUIDE.md`

---

## 📊 **Summary Statistics (Café Faust)**

| Metric | Value |
|--------|-------|
| Total Menu Items | 195 |
| Total Menus | 6 |
| Average Price | 136 DKK |
| Max Price | 229 DKK |
| Signature Themes | 7 |
| Programmes Detected | 4 (morning, lunch, dinner, bar) |
| Voice Tone Rules | 5 |
| Voice Confidence | 80% |
| Business Type | hybrid_cafe (90% confidence) |
| Location Scores Displayed | 2 (waterfront 95, city_centre 85) |
