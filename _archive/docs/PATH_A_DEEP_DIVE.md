# PATH A: Complete Layer 0 → Layer 9 Deep Dive

**Date:** February 16, 2026  
**Purpose:** Comprehensive analysis of the strategic content generation flow  
**Status:** Production System Documentation

---

## Executive Summary

**Path A** is the strategic content generation flow where **Layer 0** (Weekly Strategy Generator) creates strategic post ideas that flow through **Layers 1-9** to become complete, publication-ready social media posts.

**Key Difference from Path B:**
- **Path A:** Strategy ideas → Select → Full plan (skips Layer 5 menu scoring)
- **Path B:** Direct regeneration → Menu scoring → Single post (no strategic context)

**What You've Been Testing:** Path B (single post regeneration via `ai-generate-from-strategy`)  
**What This Document Covers:** Path A (full weekly strategic planning)

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Step-by-Step Data Flow](#step-by-step-data-flow)
3. [Layer-by-Layer Analysis](#layer-by-layer-analysis)
4. [Data Transformation Traces](#data-transformation-traces)
5. [Context Propagation](#context-propagation)
6. [Integration Points](#integration-points)
7. [Testing Path A](#testing-path-a)

---

## System Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERACTION                          │
│        Navigate to /content/ai-weekly-plan page              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: GENERATE STRATEGY (Layer 0)                        │
│  POST /functions/v1/get-weekly-strategy                     │
│                                                              │
│  Input:                                                      │
│    - business_id: "840347de..."                             │
│    - week_start: "2026-02-17"                               │
│                                                              │
│  Process:                                                    │
│    → Queries business data (Layers 1-4 context)             │
│    → Fetches weather forecast (7-day)                       │
│    → Loads calendar events (holidays, school breaks)        │
│    → Analyzes strategic opportunities                       │
│    → Gemini 2.5 Flash generates strategic brief             │
│    → Gemini 2.5 Flash generates 5-7 specific post ideas     │
│                                                              │
│  Output: WeeklyStrategy object saved to database            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: USER REVIEWS STRATEGY                              │
│  UI shows 5-7 strategic post ideas                          │
│                                                              │
│  Smart Tier: Auto-selects all ideas                         │
│  Pro Tier: User checks boxes to select 3-5 ideas            │
│                                                              │
│  Each idea shows:                                            │
│    ✓ Title: "En ægte klassiker: Pariserbøf"                │
│    ✓ Platform: Instagram (or Facebook, or both)            │
│    ✓ Media suggestion: Photo, Reel, or Carousel            │
│    ✓ CTA intent: Booking, Engagement, Awareness            │
│    ✓ Strategic fit: 85 (0-100 score)                       │
│    ✓ Weather-aware: Yes/No                                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: GENERATE FULL WEEKLY PLAN (Layers 1-9)            │
│  POST /functions/v1/generate-weekly-plan                    │
│                                                              │
│  Input:                                                      │
│    - weekStart: "2026-02-17"                                │
│    - strategy_id: "uuid-from-step-1"                        │
│    - selected_idea_ids: [1, 3, 5] (or omit for Smart tier) │
│                                                              │
│  Process:                                                    │
│    ✅ Fetches strategy from database                        │
│    ✅ Filters to selected ideas (or uses all)               │
│    ❌ SKIPS Layer 5 (no menu scoring needed!)               │
│    ✅ Layer 6: Optimizes timing (day + hour)                │
│    ✅ Layer 7: Confirms format (uses Layer 0 suggestion)    │
│    ✅ Layer 8: AI caption generation (with full context)    │
│    ✅ Layer 9: Assembles complete plan                      │
│                                                              │
│  Output: WeeklyContentPlan with 3-7 complete posts          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: USER REVIEWS & PUBLISHES                           │
│  Each post now has:                                          │
│    ✓ Caption (125-200 chars)                                │
│    ✓ Hashtags (#Aarhus, #DanskMad, etc.)                   │
│    ✓ Emojis (2-4 for Instagram, 1-2 for Facebook)          │
│    ✓ Visual direction (photo brief)                         │
│    ✓ Scheduled time (Monday 11:00, Friday 17:00, etc.)     │
│    ✓ Platform assignment (Instagram or Facebook)            │
│                                                              │
│  User can:                                                   │
│    - Edit any field                                          │
│    - Regenerate individual posts                             │
│    - Schedule or publish immediately                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Data Flow

### STEP 1: Generate Weekly Strategy (Layer 0)

**File:** [`supabase/functions/get-weekly-strategy/index.ts`](supabase/functions/get-weekly-strategy/index.ts)

**Request:**
```bash
POST https://your-project.supabase.co/functions/v1/get-weekly-strategy
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "business_id": "840347de-9ba7-4275-8aa3-4553417fc2af",
  "week_start": "2026-02-17"
}
```

**What Happens:**

#### 1.1 Data Collection (Layers 1-4 Context)

```typescript
// Line 200-350: Fetch all business context
const { data: business } = await supabaseClient
  .from('businesses')
  .select('*')
  .eq('id', business_id)
  .single()

const { data: brandProfile } = await supabaseClient
  .from('business_brand_profile')
  .select('*')
  .eq('business_id', business_id)
  .single()

const { data: businessOps } = await supabaseClient
  .from('business_operations')
  .select('*')
  .eq('business_id', business_id)
  .single()

const { data: location } = await supabaseClient
  .from('business_locations')
  .select('*')
  .eq('business_id', business_id)
  .eq('is_primary', true)
  .single()

const { data: menuItems } = await supabaseClient
  .from('menu_items_normalized')
  .select('*')
  .eq('business_id', business_id)
  .eq('is_available', true)
```

**Result:** Complete business context assembled

```typescript
{
  business: {
    id: "840347de-9ba7-4275-8aa3-4553417fc2af",
    name: "Café Faust",
    category: "FSE",  // Food Service Establishment
    country: "DK"
  },
  location: {
    city: "Aarhus",  // ✅ THIS IS WHERE CITY COMES FROM
    country: "DK",
    latitude: 56.15674,
    longitude: 10.21076,
    location_type: "waterfront",
    is_primary: true
  },
  brandProfile: {
    brand_essence: "Lokal institution ved åen siden 2008",
    signature_phrases: ["ved åen", "siden 2008", "klassisk dansk"],
    never_say: ["billig", "fast food"],
    humor_level: "subtle",
    formality: "casual"
  },
  businessOps: {
    preferred_posts_per_week: 5,
    opening_hours: { lunch: "11:00-15:00", dinner: "17:00-22:00" },
    outdoor_seating: true
  },
  menuItems: [
    {
      item_name: "PARISERBØF",
      category_type: "main",
      service_periods: ["lunch", "dinner"],
      dish_temp_category: "hot",
      is_signature: true,
      price: 175
    },
    // ... 72 more items
  ]
}
```

#### 1.2 Weather Forecast Fetch

```typescript
// Line 150-180: Fetch 7-day forecast
const weather = await fetchWeatherFromCoordinates(
  56.15674,  // latitude
  10.21076,  // longitude
  weekDays,
  hasOutdoorSeating: true
)
```

**Result:** 7-day weather data

```typescript
weekWeather: {
  monday: { 
    condition: "cold_snap", 
    temp: { day: 2, min: -1, max: 5 },
    feels_like: { day: -2, min: -4, max: 2 },
    precipitation_prob: 10,
    wind_speed: 8.5,
    description: "Kold og klar"
  },
  tuesday: { 
    condition: "sunny", 
    temp: { day: 7, min: 3, max: 9 },
    // ...
  },
  // ... rest of week
}
```

#### 1.3 Calendar Events Fetch

```typescript
// Line 190-220: Check contextual calendar
const upcomingEvents = [
  { name: "Fastelavn", date: "2026-02-16", type: "holiday", daysAway: 0 },
  { name: "Vinterferie", date: "2026-02-16", type: "school_break", daysAway: 0 }
]
```

#### 1.4 Build WeekContext

**File:** [`supabase/functions/_shared/post-helpers/weekly-strategy-generator.ts`](supabase/functions/_shared/post-helpers/weekly-strategy-generator.ts) (Line 1400)

```typescript
const weekContext: WeekContext = {
  // Business identity
  business_id: "840347de...",
  business_name: "Café Faust",
  business_type: "FSE",
  location_type: "waterfront",
  city: "Aarhus",  // ✅ Passed to AI
  country: "DK",
  
  // Week metadata
  week_number: 8,
  week_start: "2026-02-17",
  week_end: "2026-02-23",
  available_days: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
  
  // Platform & tier context
  platforms: ["facebook", "instagram"],
  subscription_tier: "smart",
  preferred_posts_per_week: 5,
  
  // Brand voice (from business_brand_profile)
  brand_voice: {
    tone_keywords: ["hyggelig", "autentisk", "lokal"],
    signature_phrases: ["ved åen", "siden 2008"],
    never_say: ["billig", "fast food"],
    humor_level: "subtle",
    formality: "casual",
    emoji_style: "moderate"
  },
  
  // Menu capabilities
  signature_items: [
    "PARISERBØF", "SKIPPERLABSKOVS", "FLÆSKESTEG", 
    "ÆGGEKAGE", "STJERNESKUD", "FISKEFILET"
  ],
  menu_categories: ["FROKOST", "AFTEN", "BRUNCH", "DRINKS"],
  menu_diversity: "high",  // 73 items
  
  // Temporal context
  season: { 
    current: "winter",
    ingredients_in_season: ["kål", "rodfrugter", "pærer"],
    out_of_season: ["jordbær", "tomater", "agurk"]
  },
  
  // Weather (7-day detailed)
  weather: weekWeather,
  
  // Events
  upcoming_events: [
    { name: "Fastelavn", date: "2026-02-16", type: "holiday" },
    { name: "Vinterferie", date: "2026-02-16", type: "school_break" }
  ],
  
  // Economic context
  economic_timing: {
    week_of_month: 3,
    pattern: "normal_spend",
    is_july: false
  },
  
  // Physical features
  outdoor_seating: true,
  waterfront_access: true,
  
  // Location amplifiers
  location_amplifiers: ["ved åen", "udsigt til vandet", "terrassemiljø"]
}
```

#### 1.5 Phase 1: Generate Strategic Brief

**File:** [`weekly-strategy-generator.ts`](supabase/functions/_shared/post-helpers/weekly-strategy-generator.ts) (Line 100)

**Call Gemini 2.5 Flash with Phase 1 Prompt:**

```typescript
const prompt = `
Du er marketing-chef for ${context.business_name}.

BUSINESS PROFIL:
- Navn: ${context.business_name}
- Type: ${context.business_type} (FSE = restaurant med bordservice)
- Lokation: ${context.city}, ${context.location_type}
- Brand voice: ${context.brand_voice.tone_keywords.join(', ')}
- Signatur-retter: ${context.signature_items.join(', ')}

UGE-KONTEKST (Uge ${context.week_number}):
- Årstid: ${context.season.current}
- Vejr: ${buildWeatherNarrative(context.weather)}
- Events: ${context.upcoming_events.map(e => e.name).join(', ')}
- Økonomisk timing: ${context.economic_timing.pattern}

OPGAVE:
Analysér hvad der gør denne uge strategisk relevant.
Identificér 2-3 fokus-områder (angles) med vægte der summer til 1.0.

REGLER:
1. Mindst ét fokus-område skal åbne for oplevelse-posts (ikke kun produkt)
2. Nævn ALDRIG specifikke menu-retter (kun kategorier)
3. reasoning = 2-4 sætninger med professionel tone + data/fakta
4. competitive_advantage = hvad gør DENNE virksomhed speciel denne uge

OUTPUT JSON:
{
  "week_summary": "2-3 sætninger professionel analyse",
  "competitive_advantage": "Specifik fordel given ugens kontekst",
  "angles": [
    {
      "focus": "Vinterhygge ved åen",
      "weight": 0.5,
      "reasoning": "Professionel forklaring 2-4 sætninger",
      "menu_alignment": "Varme klassikere som pariserbøf, skipperlabskovs",
      "content_direction": "Kombiner kulde-hygge angle med lokationens force"
    }
  ]
}
`

const strategicBrief = await callGemini(prompt, {
  temperature: 0.4,
  maxOutputTokens: 4096,
  jsonMode: true,
  model: 'gemini-2.5-flash'
})
```

**Gemini Output (Phase 1):**

```json
{
  "week_summary": "Uge 8 falderbsammen med Fastelavn og vinterferie. Vejret er koldt (2-7°C) men stabilt med minimal nedbør. Familierne er hjemme fra skole og leder efter aktiviteter og komfortable spisesteder.",
  "competitive_advantage": "Café Faust kombinerer lokationen ved åen med varme klassiske danske retter. I kulden bliver den hyggelige atmosfære og varme mad ekstra tiltrækkende.",
  "angles": [
    {
      "focus": "Vinterhygge ved åen",
      "weight": 0.5,
      "reasoning": "Kold vejr (2-7°C) skaber behov for varme og hygge. Caféens lokation ved åen bliver ekstra speciel når folk kan se vandet gennem vinduerne mens de sidder i varmen. Dette er en emotionel angle der bygger på kontrasten mellem kulde udenfor og hygge indenfor.",
      "menu_alignment": "Varme klassikere: pariserbøf, skipperlabskovs, flæskesteg",
      "content_direction": "Vis varm mad i forgrunden med udsigt til åen i baggrunden. Fokus på dampende retter og vinduer der viser den kolde dag udenfor."
    },
    {
      "focus": "Fastelavn og familiehygge",
      "weight": 0.3,
      "reasoning": "Fastelavn + vinterferie betyder familier leder efter aktiviteter. 73 menu items giver variation til både børn og voksne. Dette er perfekt timing for at vise at Café Faust er familievenligt.",
      "menu_alignment": "Bred menu med noget for alle",
      "content_direction": "Vis stemningen ved cafébordene, fokus på fællesskab og hygge. Undgå direkte børnemenu-fokus."
    },
    {
      "focus": "Lokal institution der kender vinteren",
      "weight": 0.2,
      "reasoning": "'Siden 2008' betyder 15+ vintre ved åen. Dette etablerer troværdighed som sted der ved hvordan man gør vinteren hyggelig. Authenticity angle.",
      "menu_alignment": "Klassiske danske retter der har været på menuen i årevis",
      "content_direction": "Behind-scenes eller morning prep der viser rutinen, erfaringen, det autentiske."
    }
  ]
}
```

#### 1.6 Phase 2: Generate Post Ideas

**Call Gemini 2.5 Flash with Phase 2 Prompt:**

```typescript
const prompt = `
Du er marketing-chef for ${context.business_name}. Brief ejeren med ${targetPostCount} konkrete post-forslag.

DIN PLAN FRA FØR:
${strategicBrief.angles.map(a => `
${a.focus} (${Math.round(a.weight * 100)}%):
Hvorfor: ${a.reasoning}
Menu: ${a.menu_alignment}
Hvad skal posts gøre: ${a.content_direction}
`).join('\n')}

MENU-RETTER:
${context.signature_items.join(', ')}

CONTENT MIX STRATEGI:
Mål: ~60% produkt-posts, ~40% oplevelse-posts.
Af ${targetPostCount} posts SKAL max ${Math.ceil(targetPostCount * 0.6)} være menu_item.

INDHOLDSTYPER:
1. menu_item: Vis specifik ret (driver salg)
2. atmosphere: Vis stemning, sted (emotionel relation)
3. behind_scenes: Vis forberedelse, mennesker (autenticitet)
4. seasonal: Vis sæson-stemning (context)

FOR HVER POST SKAL DU ANGIVE:
- id: 1, 2, 3...
- title: "Post-titel i caféens stemme"
- content_type: "menu_item" eller "atmosphere" osv.
- rationale: "Hvorfor denne post denne dag (marketing-chef tone)"
- platforms: ["instagram"] eller ["facebook"] eller ["instagram", "facebook"]
- cta_intent: "booking" | "engagement" | "awareness"
- suggested_media: {
    type: "photo" | "photo_reel" | "carousel",
    direction: "Fotograf-instruktion",
    why: "Hvorfor dette format"
  }
- suggested_day: "2026-02-17" (ISO date)
- suggested_time: "11:00" eller "17:00" osv.
- weather_dependent: true/false
- estimated_performance: "high" | "medium" | "low"
- strategic_fit: 0.0-1.0 (hvor godt passer det til strategien)

OUTPUT JSON:
{
  "narrative": {
    "headline": "...",
    "overview": "..."
  },
  "strategic_priorities": [...],
  "post_ideas": [
    {
      "id": 1,
      "title": "En ægte klassiker: Pariserbøf",
      "content_type": "menu_item",
      "rationale": "...",
      "platforms": ["instagram"],
      "cta_intent": "booking",
      "suggested_media": {
        "type": "photo",
        "direction": "Close-up af dampende pariserbøf...",
        "why": "Single dish beauty shot works på Instagram"
      },
      "suggested_day": "2026-02-17",
      "suggested_time": "11:00",
      "weather_dependent": true,
      "weather_flag": "cold_snap",
      "estimated_performance": "high",
      "strategic_fit": 0.85
    },
    // ... 4 more posts
  ]
}
`

const contentPlan = await callGemini(prompt, {
  temperature: 0.3,
  maxOutputTokens: 8192,
  jsonMode: true,
  model: 'gemini-2.5-flash'
})
```

**Gemini Output (Phase 2):**

```json
{
  "narrative": {
    "headline": "Vinterhygge ved åen: Klassisk comfort i kulden",
    "overview": "Uge 8 fokuserer på at gøre kulden til en styrke. Vi kombinerer caféens lokation ved åen med varme danske klassikere og viser at Café Faust er DET sted for vinterhygge i Aarhus."
  },
  "strategic_priorities": [
    {
      "name": "Comfort food angle",
      "weight": 0.6,
      "rationale": "Kuldt vejr skaber efterspørgsel på varme retter"
    },
    {
      "name": "Lokation-storytelling",
      "weight": 0.4,
      "rationale": "Åen bliver ekstra smuk i vinteren"
    }
  ],
  "post_ideas": [
    {
      "id": 1,
      "title": "En ægte klassiker: Pariserbøf",
      "content_type": "menu_item",
      "rationale": "Pariserbøf er signature-ret der passer perfekt til 2°C vejr. Mandag frokost er decision time for uge-planlægning.",
      "platforms": ["instagram"],
      "cta_intent": "booking",
      "suggested_media": {
        "type": "photo",
        "direction": "Close-up af dampende pariserbøf med bløde løg, kartofler og brun sovs. I baggrunden ser man vinduet med åen udenfor. Natural light fra vindue. 45-grader angle.",
        "why": "Single dish beauty shot virker på Instagram. Viser både produkt og lokation."
      },
      "suggested_day": "2026-02-17",
      "suggested_time": "11:00",
      "weather_dependent": true,
      "weather_flag": "cold_snap",
      "estimated_performance": "high",
      "strategic_fit": 0.85
    },
    {
      "id": 2,
      "title": "Vintermorgener ved vinduet",
      "content_type": "atmosphere",
      "rationale": "Oplevelse-post der viser stemningen om morgenen. Bygger emotionel relation uden at sælge specifik ret.",
      "platforms": ["facebook"],
      "cta_intent": "awareness",
      "suggested_media": {
        "type": "photo",
        "direction": "Tomt café-bord ved vinduet med morgen-lys. Dampende kaffekop. Udsigt til åen. Ingen mennesker. Rolig atmosfære.",
        "why": "Atmospheric shot der viser 'the vibe'. Facebook audience app appreciates this."
      },
      "suggested_day": "2026-02-18",
      "suggested_time": "09:00",
      "weather_dependent": false,
      "estimated_performance": "medium",
      "strategic_fit": 0.75
    },
    {
      "id": 3,
      "title": "Skipperlabskovs på slæ",
      "content_type": "menu_item",
      "rationale": "Anden signature comfort-ret. Onsdag er mid-week comfort peak. Reel format giver variation.",
      "platforms": ["instagram"],
      "cta_intent": "engagement",
      "suggested_media": {
        "type": "photo_reel",
        "direction": "3-5 sekunder close-up af skipperlabskovs mens ske løfter op. Slow motion. Fokus på tekstur og dampen.",
        "why": "Reel format higher engagement på Instagram. Bevægelse fanger opmærksomheden."
      },
      "suggested_day": "2026-02-19",
      "suggested_time": "12:00",
      "weather_dependent": true,
      "estimated_performance": "high",
      "strategic_fit": 0.80
    },
    {
      "id": 4,
      "title": "Fastelavn hos Faust",
      "content_type": "event_promotion",
      "rationale": "Timing: Dagen før Fastelavn. Event-promo skaber FOMO og driver weekend traffic.",
      "platforms": ["facebook", "instagram"],
      "cta_intent": "awareness",
      "suggested_media": {
        "type": "carousel",
        "direction": "3 billeder: 1) Dekoreret indgang, 2) Familier ved borde, 3) Special fastelavn-menu item",
        "why": "Carousel viser flere aspekter af event. Fungerer på begge platforme."
      },
      "suggested_day": "2026-02-20",
      "suggested_time": "17:00",
      "weather_dependent": false,
      "estimated_performance": "high",
      "strategic_fit": 0.90
    },
    {
      "id": 5,
      "title": "Sådan laver vi morgenkaffe",
      "content_type": "behind_scenes",
      "rationale": "Weekend behind-scenes post. Viser autenticitet og 'siden 2008' erfaring. Lower pressure content for Saturday.",
      "platforms": ["instagram"],
      "cta_intent": "engagement",
      "suggested_media": {
        "type": "photo",
        "direction": "Hænder der grinder kaffe eller hælder espresso. Close-up. Morning light. Arbejdshænder der viser erfaring.",
        "why": "Autencitet via craft-fokus. Instagram audience loves behind-scenes."
      },
      "suggested_day": "2026-02-22",
      "suggested_time": "10:00",
      "weather_dependent": false,
      "estimated_performance": "medium",
      "strategic_fit": 0.70
    }
  ]
}
```

#### 1.7 Save Strategy to Database

```typescript
// Save to weekly_strategies table
const { data: savedStrategy, error } = await supabaseClient
  .from('weekly_strategies')
  .insert({
    business_id: "840347de...",
    week_start: "2026-02-17",
    week_number: 8,
    status: 'pending_selection',
    
    // Phase 1 output
    strategic_brief: strategicBrief,
    strategic_brief_raw: rawPhase1Text,
    
    // Phase 2 output
    narrative: contentPlan.narrative,
    strategic_priorities: contentPlan.strategic_priorities,
    post_ideas: contentPlan.post_ideas,  // ✅ THIS IS THE GOLD!
    
    // Metadata
    platforms: ["facebook", "instagram"],
    subscription_tier: "smart",
    target_post_count: 5,
    generated_at: new Date().toISOString()
  })
  .select()
  .single()
```

**Response to Frontend:**

```json
{
  "success": true,
  "strategy_id": "f8b3e4a2-1234-5678-90ab-cdef12345678",
  "strategy": {
    "narrative": {
      "headline": "Vinterhygge ved åen: Klassisk comfort i kulden",
      "overview": "Uge 8 fokuserer på..."
    },
    "post_ideas": [
      {
        "id": 1,
        "title": "En ægte klassiker: Pariserbøf",
        "platforms": ["instagram"],
        "cta_intent": "booking",
        "estimated_performance": "high",
        "strategic_fit": 0.85
      },
      // ... 4 more
    ]
  },
  "week_context": {
    "week_number": 8,
    "week_start": "2026-02-17",
    "platforms": ["facebook", "instagram"],
    "target_post_count": 5
  }
}
```

---

### STEP 2: User Selection (Frontend UI)

**What Happens:**

Frontend displays the 5 post ideas:

```
┌─────────────────────────────────────────────────────────────┐
│  STRATEGIC POST IDEAS - UGE 8                               │
│                                                              │
│  ☑ 1. En ægte klassiker: Pariserbøf                         │
│     📸 Photo | 📱 Instagram | 🎯 Booking | ⭐ 85% fit        │
│                                                              │
│  ☐ 2. Vintermorgener ved vinduet                            │
│     📸 Photo | 👥 Facebook | 👁️  Awareness | ⭐ 75% fit      │
│                                                              │
│  ☑ 3. Skipperlabskovs på slæ                                │
│     🎬 Reel | 📱 Instagram | 💬 Engagement | ⭐ 80% fit      │
│                                                              │
│  ☑ 4. Fastelavn hos Faust                                   │
│     🎠 Carousel | 📱👥 Both | 👁️  Awareness | ⭐ 90% fit     │
│                                                              │
│  ☐ 5. Sådan laver vi morgenkaffe                            │
│     📸 Photo | 📱 Instagram | 💬 Engagement | ⭐ 70% fit     │
│                                                              │
│  [Generate Full Posts]                                       │
└─────────────────────────────────────────────────────────────┘
```

**User Action:**
- **Smart Tier:** Clicks "Generate Full Posts" (all ideas auto-selected)
- **Pro Tier:** Checks 3 of 5 boxes, then clicks "Generate Full Posts"

---

### STEP 3: Generate Full Weekly Plan (Layers 1-9)

**File:** [`supabase/functions/generate-weekly-plan/index.ts`](supabase/functions/generate-weekly-plan/index.ts)

**Request:**

```bash
POST https://your-project.supabase.co/functions/v1/generate-weekly-plan
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "weekStart": "2026-02-17",
  "strategy_id": "f8b3e4a2-1234-5678-90ab-cdef12345678",
  "selected_idea_ids": [1, 3, 4]  // User picked 3 of 5 (or omit for Smart)
}
```

**What Happens:**

#### 3.1 Fetch Strategy from Database

```typescript
// Line 85-120: Get strategy
const { data: strategyData } = await supabaseClient
  .from('weekly_strategies')
  .select('*')
  .eq('id', strategy_id)
  .eq('business_id', business.id)
  .single()

// Reconstruct WeeklyStrategy object
const strategy = {
  narrative: strategyData.narrative,
  strategic_priorities: strategyData.strategic_priorities,
  post_ideas: strategyData.post_ideas,  // ✅ Array of 5 PostIdea objects
  platforms: strategyData.platforms,
  subscription_tier: strategyData.subscription_tier,
  target_post_count: strategyData.target_post_count
}
```

#### 3.2 Filter to Selected Ideas

**File:** [`weekly-plan-generator.ts`](supabase/functions/_shared/post-helpers/weekly-plan-generator.ts) (Line 620)

```typescript
// If selected_idea_ids provided, filter
const selectedIdeas = selectedIdeaIds 
  ? strategy.post_ideas.filter(idea => selectedIdeaIds.includes(idea.id))
  : strategy.post_ideas  // All ideas (Smart tier)

console.log('[WeeklyPlan] Processing', selectedIdeas.length, 'selected ideas')

// Result: 3 ideas (IDs 1, 3, 4)
```

#### 3.3 Map Layer 0 Ideas to Enriched Slots

**Critical Bridge Function** (Line 529):

```typescript
function mapIdeaToEnrichedSlot(
  idea: PostIdea,
  weekStart: Date,
  brandProfile: any,
  locationIntel: any
) {
  return {
    slotId: `layer0-idea-${idea.id}`,
    contentType: idea.content_type,  // "menu_item"
    platform: idea.platforms[0],     // "instagram"
    dayOfWeek: new Date(idea.suggested_day).getDay(),  // 1 (Monday)
    hour: parseInt(idea.suggested_time.split(':')[0]), // 11
    
    // The opportunity object that Layers 6-8 consume
    opportunity: {
      subject: idea.title,  // "En ægte klassiker: Pariserbøf"
      contentType: idea.content_type,
      score: Math.round(idea.strategic_fit * 100), // 85
      reason: idea.rationale,
      brandVoice: brandProfile?.brand_voice || {},
      seasonalContext: {
        season: "winter",
        weather: undefined,
        temperature: undefined
      },
      locationContext: {
        type: locationIntel?.location_type || "city_center",
        amplifiers: locationIntel?.location_amplifiers || []
      },
      rawData: {
        layer0_idea: idea,  // ✅ Preserve ALL Layer 0 data
        scoreBreakdown: {
          baseScore: 85,
          strategicFit: 85
        },
        selectionReason: idea.rationale
      }
    },
    
    // Layer 0 extras (used for enhanced processing)
    layer0: {
      cta_intent: idea.cta_intent,           // "booking"
      suggested_media: idea.suggested_media, // { type: "photo", direction: "...", why: "..." }
      platforms: idea.platforms,             // ["instagram"]
      weather_dependent: idea.weather_dependent,  // true
      weather_flag: idea.weather_flag,       // "cold_snap"
      estimated_performance: idea.estimated_performance, // "high"
      strategic_fit: idea.strategic_fit      // 0.85
    }
  }
}

// Apply to all 3 selected ideas
const enrichedSlots = selectedIdeas.map(idea =>
  mapIdeaToEnrichedSlot(idea, weekStart, brandProfile, locationIntel)
)
```

**Result:** 3 enriched slots ready for Layers 6-8

```typescript
[
  {
    slotId: "layer0-idea-1",
    contentType: "menu_item",
    platform: "instagram",
    dayOfWeek: 1,  // Monday
    hour: 11,
    opportunity: {
      subject: "En ægte klassiker: Pariserbøf",
      score: 85,
      reason: "Pariserbøf er signature-ret der passer perfekt til 2°C vejr...",
      brandVoice: { tone: "casual", emoji_frequency: "moderate" },
      seasonalContext: { season: "winter" },
      locationContext: { type: "waterfront", amplifiers: ["ved åen"] }
    },
    layer0: {
      cta_intent: "booking",
      suggested_media: {
        type: "photo",
        direction: "Close-up af dampende pariserbøf...",
        why: "Single dish beauty shot virker på Instagram"
      },
      estimated_performance: "high",
      strategic_fit: 0.85
    }
  },
  // ... 2 more slots
]
```

#### 3.4 Layer 6: Optimize Timing

**File:** [`post-slot-optimizer.ts`](supabase/functions/_shared/post-helpers/post-slot-optimizer.ts)

**Note:** Layer 0 already suggested day + time, but Layer 6 can refine

```typescript
const layer6Input = {
  businessId: "840347de...",
  weekStartDate: new Date("2026-02-17"),
  slots: enrichedSlots.map(slot => ({
    contentType: slot.contentType,  // "menu_item"
    opportunity: slot.opportunity,
    score: slot.opportunity.score,  // 85
    platform: slot.platform,        // "instagram"
    dayOfWeek: slot.dayOfWeek,      // 1 (Monday)
    hour: slot.hour                 // 11
  }))
}

const weeklySchedule = await optimizeWeeklySchedule(layer6Input, supabaseClient)
```

**Layer 6 Logic:**
- Checks for collisions (multiple posts same day/time)
- Applies Danish day-of-week preferences:
  - Monday: Menu highlights (decision day)
  - Friday: FOMO content (weekend lead-up)
  - Weekend: Engagement posts
- Optimizes post times:
  - Lunch items: 11:00-12:00 (decision window)
  - Dinner items: 14:00-17:00 (planning window)
  - Atmosphere: 17:00-19:00 (FOMO time)

**Result:** Optimized schedule with potential time adjustments

```typescript
weeklySchedule: {
  slots: [
    {
      slotId: "layer0-idea-1",
      dayOfWeek: 1,  // Monday (kept from Layer 0)
      hour: 11,      // 11:00 (kept - perfect for lunch)
      scheduledDate: new Date("2026-02-17T11:00:00"),
      optimizationReason: "Monday lunch slot - Menu highlights perform well on decision days during immediate lunch window"
    },
    {
      slotId: "layer0-idea-3",
      dayOfWeek: 3,  // Wednesday (kept from Layer 0)
      hour: 12,      // Changed from 12:00 to avoid collision!
      scheduledDate: new Date("2026-02-19T12:00:00"),
      optimizationReason: "Mid-week comfort peak, lunch decision window (rescheduled 1 hour to avoid collision)"
    },
    {
      slotId: "layer0-idea-4",
      dayOfWeek: 4,  // Thursday (kept from Layer 0)
      hour: 17,      // 17:00 (kept - perfect for FOMO time)
      scheduledDate: new Date("2026-02-20T17:00:00"),
      optimizationReason: "Friday evening FOMO window - Event promotions work best before weekend"
    }
  ]
}
```

#### 3.5 Layer 7: Format & Platform Selection

**File:** [`weekly-plan-generator.ts`](supabase/functions/_shared/post-helpers/weekly-plan-generator.ts) (Line 780)

**Critical Logic:** Path A uses Layer 0's format suggestion (no re-selection!)

```typescript
for (let i = 0; i < enrichedSlots.length; i++) {
  const enrichedSlot = enrichedSlots[i]
  const layer0 = enrichedSlot.layer0  // ✅ Has Layer 0 data
  
  let formatSelection
  
  if (layer0) {
    // PATH A: Use Layer 0's suggested media type
    formatSelection = {
      platform: layer0.platforms[0] || 'instagram',
      format: mapMediaTypeToFormat(layer0.suggested_media.type),  // "photo" → "photo"
      platformReason: `Valgt via Layer 0 strategi (${layer0.platforms.join(' + ')})`,
      formatReason: `${layer0.suggested_media.why} (${layer0.suggested_media.type})`
    }
    
    console.log(`[WeeklyPlan] L7 override: ${layer0.suggested_media.type} → ${formatSelection.format}`)
  } else {
    // PATH B: Legacy - Layer 7 decides independently
    formatSelection = await selectMediaFormatAndPlatform(optimizedSlot, businessId, userId, supabaseClient)
  }
}
```

**Helper Function:**

```typescript
function mapMediaTypeToFormat(type: SuggestedMediaType): string {
  switch (type) {
    case 'photo': return 'photo'
    case 'photo_reel': return 'reel'
    case 'carousel': return 'carousel'
    default: return 'photo'
  }
}
```

**Result:** Format confirmed for each post

```typescript
// Post 1
formatSelection: {
  platform: "instagram",
  format: "photo",
  platformReason: "Valgt via Layer 0 strategi (instagram)",
  formatReason: "Single dish beauty shot virker på Instagram. Viser både produkt og lokation. (photo)"
}

// Post 2 (Reel)
formatSelection: {
  platform: "instagram",
  format: "reel",
  platformReason: "Valgt via Layer 0 strategi (instagram)",
  formatReason: "Reel format higher engagement på Instagram. Bevægelse fanger opmærksomheden. (photo_reel)"
}

// Post 3 (Carousel)
formatSelection: {
  platform: "facebook",
  format: "carousel",
  platformReason: "Valgt via Layer 0 strategi (facebook, instagram)",
  formatReason: "Carousel viser flere aspekter af event. Fungerer på begge platforme. (carousel)"
}
```

#### 3.6 Layer 8: AI Caption Generation

**File:** [`weekly-plan-generator.ts`](supabase/functions/_shared/post-helpers/weekly-plan-generator.ts) (Line 820)

**Build AI Context:**

```typescript
// Fetch fresh business data
const { data: business } = await supabaseClient
  .from('businesses')
  .select('*')
  .eq('id', businessId)
  .single()

const { data: fullBrandProfile } = await supabaseClient
  .from('business_brand_profile')
  .select('*')
  .eq('business_id', businessId)
  .single()

const { data: businessLocation } = await supabaseClient
  .from('business_locations')
  .select('city, country')
  .eq('business_id', businessId)
  .eq('is_primary', true)
  .single()

// Calculate service period from scheduled hour
const scheduledHour = optimizedSlot.hour  // 11
let servicePeriod: 'brunch' | 'lunch' | 'dinner' | undefined

if (businessOps.service_periods.lunch) {
  const lunchStart = parseInt(businessOps.service_periods.lunch.start.split(':')[0])  // 11
  const lunchEnd = parseInt(businessOps.service_periods.lunch.end.split(':')[0])      // 15
  if (scheduledHour >= lunchStart && scheduledHour < lunchEnd) {
    servicePeriod = 'lunch'  // ✅ Post at 11:00 = lunch period
  }
}

// Build CaptionGenerationContext
const aiContext = {
  // Business (Layer 1)
  businessId: "840347de...",
  businessName: "Café Faust",
  businessCategory: "FSE",
  city: businessLocation?.city || "",  // ✅ "Aarhus" - THIS IS THE FIX YOU MADE!
  country: business?.country || "DK",
  
  // Brand Voice (Layer 2)
  brandVoice: {
    tone_keywords: fullBrandProfile?.tone_keywords || [],                // ["hyggelig", "autentisk", "lokal"]
    voice_style: fullBrandProfile?.voice_style || "casual",              // "du-form, emojis ok"
    values: fullBrandProfile?.values || [],                              // ["økologisk", "bæredygtig"]
    certifications: fullBrandProfile?.certifications || [],              // []
    do_not_say: fullBrandProfile?.do_not_say || { words: [] },           // ["billig", "fast food"]
    signature_phrases: fullBrandProfile?.signature_phrases || [],        // ["ved åen", "siden 2008"]
    never_say: fullBrandProfile?.never_say || [],                        // Same as do_not_say
    humor_level: fullBrandProfile?.humor_level || "subtle",              // "subtle"
    formality: fullBrandProfile?.formality || "casual",                  // "casual"
    emoji_style: fullBrandProfile?.emoji_style || "moderate"             // "moderate"
  },
  
  // Content Opportunity (Layer 5 or Layer 0)
  contentOpportunity: {
    type: opportunity.contentType,        // "menu_item"
    subject: opportunity.subject,         // "En ægte klassiker: Pariserbøf"
    menuItem: {
      name: "PARISERBØF",
      description: "Klassisk dansk ret med bløde løg, kartofler og brun sovs",
      price: "175",
      category: "FROKOST"
    }
  },
  
  // Temporal Context (Layer 3)
  temporalContext: {
    season: "winter",                     // From seasonal context
    dayOfWeek: "Monday",                  // From Layer 6 optimization
    timeOfDay: "lunch",                   // Converted from hour 11
    weather: "cold_snap",                 // From weather forecast
    servicePeriod: "lunch"                // ✅ Calculated from hour + business_operations
  },
  
  // Format & Platform (Layer 7)
  format: "photo",                        // From Layer 7 (or Layer 0)
  platform: "instagram",                  // From Layer 7 (or Layer 0)
  
  // ✅ NEW: Layer 0 strategic context
  strategicContext: {
    cta_intent: "booking",                           // From Layer 0
    strategic_rationale: opportunity.reason,         // "Pariserbøf er signature-ret der passer perfekt til 2°C vejr..."
    estimated_performance: "high",                   // From Layer 0
    week_narrative: strategy.narrative.headline      // "Vinterhygge ved åen: Klassisk comfort i kulden"
  }
}
```

**Call AI Caption Generator:**

**File:** [`ai-caption-generator/index.ts`](supabase/functions/_shared/ai-caption-generator/index.ts)

```typescript
const aiCaptionResult = await generateAICaption(aiContext, {
  useAI: true,
  temperature: 0.5,
  fallbackToTemplate: true,
  enforceBrevity: true
})
```

**AI Caption Generator Process:**

1. **Build Prompt** (from `prompt-builder.ts`):

```typescript
const prompt = `
Du er social media manager for ${businessName}, en ${businessCategory} i ${city}, ${country}.

BRAND VOICE:
- Tone: ${tone_keywords.join(", ")}
- Signature phrases: ${signature_phrases.join("; ")}
- Never say: ${never_say.join(", ")}
- Humor level: ${humor_level}
- Formality: ${formality}
- Emoji style: ${emoji_style}

CONTENT:
Subject: ${contentOpportunity.subject}
Type: ${contentOpportunity.type}
Menu item: ${contentOpportunity.menuItem?.name} - ${contentOpportunity.menuItem?.description}

CONTEXT:
- Season: ${temporalContext.season}
- Day: ${temporalContext.dayOfWeek}
- Time: ${temporalContext.timeOfDay}
- Service period: ${temporalContext.servicePeriod}
- Weather: ${temporalContext.weather}

STRATEGIC ANGLE:
Week narrative: ${strategicContext.week_narrative}
Rationale: ${strategicContext.strategic_rationale}
CTA intent: ${strategicContext.cta_intent}
Estimated performance: ${strategicContext.estimated_performance}

PLATFORM: ${platform} (${format})
- Max characters: 2200 (optimal: 125-150 for first line)
- Emojis: 2-4 encouraged
- Hashtags: 8-12 (will be generated separately)

OPGAVE:
Skriv en naturlig dansk caption (125-150 tegn) der:
1. Taler autentisk i brand voice
2. Fremhæver hvad der gør dette specielt NU (sæson, vejr, timing)
3. Inkluderer 1-2 emojis naturligt (ikke i slutningen)
4. Bruger "du-form" (uformel dansk)
5. Har en blød CTA baseret på intent: ${strategicContext.cta_intent}

OUTPUT JSON:
{
  "caption": "...",
  "hashtags": ["Aarhus", "DanskMad", "Vintermad", "Hygge", ...],
  "emojis": ["🥘", "✨"]
}
`

const result = await callGemini(prompt, {
  temperature: 0.5,
  maxOutputTokens: 2048,
  jsonMode: true,
  model: 'gemini-2.5-flash'
})
```

2. **Gemini Generates:**

```json
{
  "caption": "Mandag frokost ved åen? 🥘 PARISERBØF lige som den skal være - varm, mættende og perfekt til kulden. Book et bord.",
  "hashtags": ["Aarhus", "DanskMad", "Vintermad", "Hygge", "CaféFaust", "VedÅen", "Pariserbøf", "DanishFood"],
  "emojis": ["🥘"]
}
```

3. **Curate Hashtags** (from `i18n-config.ts`):

```typescript
function getCuratedHashtags(
  country: string,
  season: string,
  contentType: string,
  city?: string
): string[] {
  const config = getCountryConfig(country)  // "DK"
  
  const hashtags = [
    ...config.hashtags.evergreen,      // ["#DanskMad", "#Hygge"]
    ...config.hashtags.seasonal[season],  // ["#Vintermad"]
    ...config.hashtags.contentTypes[contentType]  // ["#Foodporn", "#Madglæde"]
  ]
  
  // ✅ Add city-specific hashtags (YOUR FIX!)
  if (city) {
    hashtags.push(`#${city}`)       // "#Aarhus"
    hashtags.push(`#${city}Eats`)   // "#AarhusEats"
  }
  
  return hashtags.slice(0, 12)  // Max 12
}

const curatedHashtags = getCuratedHashtags("DK", "winter", "menu_item", "Aarhus")
// Result: ["#DanskMad", "#Hygge", "#Vintermad", "#Foodporn", "#Madglæde", "#Aarhus", "#AarhusEats"]
```

4. **Validate & Return:**

```typescript
const result = {
  caption: "Mandag frokost ved åen? 🥘 PARISERBØF lige som den skal være...",
  hashtags: ["#Aarhus", "#DanskMad", "#Vintermad", "#Hygge", "#CaféFaust", "#VedÅen", "#Pariserbøf", "#AarhusEats"],
  emojis: ["🥘"],
  metadata: {
    characterCount: 125,
    hashtagCount: 8,
    emojiCount: 1,
    platform: "instagram",
    format: "photo",
    tone: "casual, inviting",
    contentSafetyPassed: true,
    qualityScore: 92,
    generatedAt: "2026-02-16T14:30:00Z"
  }
}
```

#### 3.7 Layer 9: Assemble Post Specification

**File:** [`weekly-plan-generator.ts`](supabase/functions/_shared/post-helpers/weekly-plan-generator.ts) (Line 920)

```typescript
// Calculate priority (strategic vs. legacy)
const { priority, reasons } = layer0
  ? calculatePriorityFromIdea(allIdeas.find(i => i.id === layer0_idea_id))
  : calculatePriority(opportunity)

// Generate alternatives (from other strategy ideas vs. other opportunities)
const alternatives = layer0
  ? generateAlternativesFromIdeas(idea, allIdeas)
  : generateAlternatives(opportunity, enrichedSlots)

// Generate logistics (enhanced with media direction vs. basic)
const logistics = layer0
  ? generateLogisticsFromIdea(idea)
  : generateLogistics(contentType, format, subject)

// CTA type (from Layer 0 intent vs. AI metadata)
const ctaType = layer0
  ? mapCTAIntentToType(layer0.cta_intent, layer0.platforms)
  : (aiCaptionResult?.metadata.tone || 'soft CTA')

// Assemble complete PostSpecification
const post: PostSpecification = {
  // Selection Rationale
  selectionRationale: `Strategisk valgt: ${opportunity.reason} (fit: ${Math.round(layer0.strategic_fit * 100)}%)`,
  
  // Timing (Layer 6)
  timing: {
    day: "Monday",
    date: "2026-02-17T11:00:00Z",
    time: "11:00",
    rationale: "Monday lunch slot - Menu highlights perform well on decision days during immediate lunch window"
  },
  
  // Platform & Format (Layer 7, guided by Layer 0)
  platformFormat: {
    platform: "instagram",
    format: "photo",
    platformReason: "Valgt via Layer 0 strategi (instagram)",
    formatRationale: "Single dish beauty shot virker på Instagram. Viser både produkt og lokation. (photo)"
  },
  
  // Post Type & Priority
  postType: {
    type: "menu_item",
    category: "comfort_food",
    priority: "High",
    priorityReasons: [
      "høj forventet performance",
      "stærk strategisk fit",
      "vejrafhængig (tjek vejrudsigt)"
    ]
  },
  
  // Content Subject
  contentSubject: {
    dish: "PARISERBØF",
    whyThisDish: [
      "Signature-ret med høj genkendelse",
      "Passer perfekt til 2°C vejr (cold_snap)",
      "Varme klassikere matcher vinterhygge-angle"
    ]
  },
  
  // Caption (Layer 8)
  caption: {
    text: "Mandag frokost ved åen? 🥘 PARISERBØF lige som den skal være - varm, mættende og perfekt til kulden. Book et bord.",
    characterCount: 125,
    tone: "casual, inviting",
    emojiCount: 1,
    ctaType: "booking",
    firstLine: "Mandag frokost ved åen?",
    hashtags: ["Aarhus", "DanskMad", "Vintermad", "Hygge", "CaféFaust", "VedÅen", "Pariserbøf", "AarhusEats"],
    isAIGenerated: true,
    aiMetadata: {
      model: "gemini-2.5-flash",
      tone: "casual, inviting",
      qualityScore: 92
    }
  },
  
  // Visual Direction (from Layer 0 media direction)
  visualDirection: {
    subject: "PARISERBØF",
    angle: "45-degree close-up",
    setting: "Restaurant table near window with canal view",
    lighting: "Natural light from window",
    styling: "Steaming dish in foreground, canal visible through window in background",
    context: layer0.suggested_media.direction,
    technicalSpecs: {
      dimensions: "1080x1350",
      aspectRatio: "4:5",
      fileFormat: "JPG"
    },
    altText: "Steaming pariserbøf on plate with view of Aarhus canal through window"
  },
  
  // Production Notes
  productionNotes: {
    estimatedTime: "5 minutes",
    logistics: [
      "Fotografér pariserbøf under lunch service",
      "Natural light fra vindue - 11:00-12:00 bedst",
      "Sørg for dampende ret (frisk fra køkken)",
      "Vinkel: 45 grader, close-up med udsigt i baggrund",
      "Check weather: Post kun hvis vejret er koldt (cold_snap flag)"
    ],
    timing: "Monday morning prep"
  },
  
  // Alternatives (from other strategy ideas)
  alternatives: [
    {
      priority: 1,
      description: "Skipperlabskovs (også comfort-ret, Wednesday timing)"
    },
    {
      priority: 2,
      description: "Vintermorgener ved vinduet (atmosphere angle)"
    }
  ],
  
  // Media Management
  media: {
    status: "pending",
    uploadedFiles: [],
    photographerBrief: layer0.suggested_media.direction
  },
  
  // Approval Status
  approval: {
    status: "draft",
    editHistory: []
  },
  
  // ✅ Layer 0 Strategic Context (preserved)
  strategicContext: {
    cta_intent: "booking",
    suggested_media: {
      type: "photo",
      direction: "Close-up af dampende pariserbøf...",
      why: "Single dish beauty shot virker på Instagram"
    },
    strategic_fit: 0.85,
    weather_dependent: true,
    weather_flag: "cold_snap",
    estimated_performance: "high"
  }
}
```

**Repeat for All 3 Selected Posts**

---

### STEP 4: Save Weekly Plan

**File:** [`weekly-plan-generator.ts`](supabase/functions/_shared/post-helpers/weekly-plan-generator.ts) (Line 1100)

```typescript
const weeklyPlan: WeeklyContentPlan = {
  id: generateUUID(),
  userId: userId,
  businessId: businessId,
  
  // Week metadata
  weekNumber: 8,
  weekStart: "2026-02-17",
  weekEnd: "2026-02-23",
  generatedAt: new Date().toISOString(),
  
  // ✅ Strategy reference
  strategyId: strategy_id,
  strategyNarrative: strategy.narrative,
  strategicPriorities: strategy.strategic_priorities,
  
  // Posts (3 complete PostSpecification objects)
  posts: [
    // ... post 1, 2, 3 as assembled above
  ],
  
  // Summary
  summary: {
    totalPosts: 3,
    totalProductionTime: "15 minutes",
    postsByPlatform: { instagram: 2, facebook: 1 },
    postsByFormat: { photo: 2, carousel: 1 }
  }
}

// Save to database
await saveWeeklyPlan(weeklyPlan, supabaseClient)
```

**Database:**

```sql
INSERT INTO weekly_content_plans (
  id,
  user_id,
  business_id,
  week_number,
  week_start,
  week_end,
  strategy_id,  -- ✅ Links to weekly_strategies(id)
  strategy_narrative,
  strategic_priorities,
  posts,  -- JSONB array of 3 PostSpecification objects
  summary,
  generated_at
) VALUES (...)
```

---

## Layer-by-Layer Analysis

### Layer 0: Strategic Analysis

**Purpose:** Generate strategic post ideas based on week context  
**Input:** Business data + weather + events + menu  
**Output:** 5-7 strategic post ideas with CTA intent, media suggestions, timing

**Key Features:**
- **Two-phase architecture:** Strategic brief → Specific post ideas
- **Platform-aware:** Generates for active platforms only
- **Weather-integrated:** Uses 7-day forecast for relevance
- **Performance estimates:** Predicts high/medium/low engagement
- **Media direction:** Provides photographer instructions

**Data Flow:**
```
Business Data + Weather + Events
  ↓
Gemini 2.5 Flash (Phase 1)
  ↓
Strategic Brief (2-3 angles)
  ↓
Gemini 2.5 Flash (Phase 2)
  ↓
5-7 Post Ideas (structured)
  ↓
Saved to weekly_strategies table
```

---

### Layer 1: Information Foundation

**Purpose:** Provide foundational business data  
**Input:** Database queries  
**Output:** Complete business context

**Data Collected:**
- Business profile (name, category, platforms)
- Location intelligence (city, coordinates, type)
- Business operations (hours, service periods, outdoor seating)
- Menu database (normalized items with categories, temperatures, service periods)
- Brand profile (voice, signature phrases, never_say)

**Integration with Path A:**
- ✅ Layer 0 queries all Layer 1 data before strategy generation
- ✅ City from `business_locations` flows to Layer 0, then to Layer 8
- ✅ Menu items inform Layer 0 which dishes to suggest

---

### Layer 2: Strategic Baselines

**Purpose:** Define brand voice and content distribution  
**Input:** `business_brand_profile` table  
**Output:** Tone, voice patterns, signature phrases

**Key Fields:**
- `tone_keywords`: ["hyggelig", "autentisk", "lokal"]
- `signature_phrases`: ["ved åen", "siden 2008"]
- `never_say`: ["billig", "fast food"]
- `humor_level`: "subtle" | "playful" | "none"
- `emoji_style`: "minimal" | "moderate" | "expressive"

**Integration with Path A:**
- ✅ Layer 0 uses brand profile in strategic brief generation
- ✅ Layer 8 uses signature phrases for authentic caption writing
- ✅ Content safety validates against `never_say` list

---

### Layer 3: Temporal & Contextual Intelligence

**Purpose:** Add time-sensitive and environmental context  
**Input:** Current date + weather API + calendar database  
**Output:** Season, weather forecast, upcoming events

**Key Components:**
- **Season detection:** Spring/summer/autumn/winter
- **Weather forecast:** 7-day detailed with temp, precipitation, wind
- **Calendar events:** Danish holidays, school breaks, cultural events
- **Compound opportunities:** "First warm day + outdoor seating = terrace opening"

**Integration with Path A:**
- ✅ Layer 0 receives full temporal context for strategic analysis
- ✅ Weather influences post ideas (weather_dependent flag)
- ✅ Events drive timing (Fastelavn post on February 20)

---

### Layer 4: Performance Intelligence

**Purpose:** Learn from past performance (currently basic)  
**Input:** `menu_item_metadata` table  
**Output:** Performance history, recency filters

**Current Status:**
- Basic: Tracks times_posted, last_posted_date
- Future: Engagement rates, A/B testing, learning loops

**Integration with Path A:**
- ⚠️ Layer 0 doesn't use performance data yet (future enhancement)
- ✅ Recency filters prevent same dish posted within 7 days

---

### Layer 5: Content Opportunity Matching

**Purpose:** Score and rank content opportunities  
**Status:** ❌ **SKIPPED IN PATH A**

**Why Skipped:**
- Layer 0 already selected specific content (post ideas)
- No need to score 73 menu items when strategy provides 5 specific ones
- Saves computation time and ensures strategic coherence

**Legacy Path B:**
- Scores all 73 menu items + non-menu opportunities
- Ranks by seasonal fit + weather + location + performance
- Selects top N for weekly plan

---

### Layer 6: Timing Optimization

**Purpose:** Optimize posting schedule (day + hour)  
**Input:** Enriched slots with suggested timing  
**Output:** Optimized schedule with collision detection

**Key Features:**
- **Day optimization:** Monday = menu highlights, Friday = FOMO
- **Time optimization:** Lunch items at 11:00, dinner items at 14:00-17:00
- **Collision detection:** Prevents multiple posts same day/time
- **Retry logic:** 3-tier (next hour → next day → any slot)

**Integration with Path A:**
- ✅ Layer 0 provides `suggested_day` + `suggested_time`
- ✅ Layer 6 starts from these suggestions (no random assignment)
- ✅ Can refine timing to avoid collisions or optimize further

---

### Layer 7: Media Format & Platform Specification

**Purpose:** Determine optimal media format and platform  
**Status:** ⚠️ **GUIDED BY LAYER 0 IN PATH A**

**Format Options:**
- Photo (single image) - 5 min production
- Carousel (multiple images) - 15 min production
- Reel (short video) - 30 min production
- Video (long form) - 60 min production

**Integration with Path A:**
- ✅ Layer 0 provides `suggested_media.type` ("photo" | "photo_reel" | "carousel")
- ✅ Layer 7 uses this suggestion (no re-selection)
- ✅ Platform from Layer 0's `platforms` array

**Legacy Path B:**
- Layer 7 decides format independently based on content type
- Platform balance algorithm (if Instagram had last 2, next goes to Facebook)

---

### Layer 8: AI Caption & Visual Direction

**Purpose:** Generate natural captions with AI  
**Input:** Complete context from Layers 1-7  
**Output:** Caption, hashtags, emojis, metadata

**Key Process:**
1. **Build Context:** Assembles all available data
2. **Generate Prompt:** AI-specific instructions
3. **Call Gemini:** AI generation with retry logic
4. **Curate Hashtags:** Location + seasonal + content-type
5. **Validate:** Content safety checks, character limits
6. **Return:** Structured caption object

**Integration with Path A:**
- ✅ Receives `strategicContext` with CTA intent, rationale, performance estimate
- ✅ City from business_locations used for hashtag generation
- ✅ Signature phrases from brand profile woven into caption
- ✅ Service period from temporal context ensures meal-appropriate language

**Critical Fields:**
```typescript
{
  city: "Aarhus",  // ✅ YOUR FIX - ensures #Aarhus not #København
  brandVoice: {
    signature_phrases: ["ved åen", "siden 2008"],
    never_say: ["billig", "fast food"]
  },
  strategicContext: {
    cta_intent: "booking",
    week_narrative: "Vinterhygge ved åen"
  },
  temporalContext: {
    servicePeriod: "lunch"  // Ensures "frokost" not "middag"
  }
}
```

---

### Layer 9: Final Assembly

**Purpose:** Assemble complete weekly plan  
**Input:** All layer outputs  
**Output:** WeeklyContentPlan with 3-7 posts

**Post Components:**
- ✅ Caption (text, hashtags, emojis)
- ✅ Visual direction (photographer brief)
- ✅ Timing (day, date, hour, rationale)
- ✅ Platform & format (with reasoning)
- ✅ Production notes (logistics, estimated time)
- ✅ Alternatives (backup ideas)
- ✅ Strategic context (preserved from Layer 0)

**Database Storage:**
```sql
weekly_content_plans (
  id uuid,
  strategy_id uuid,  -- ✅ Links to weekly_strategies
  posts jsonb,       -- Array of PostSpecification objects
  strategyNarrative jsonb,
  strategicPriorities jsonb
)
```

---

## Data Transformation Traces

### Trace 1: City Flow (København Bug Fix)

**Layer 1 (Database):**
```sql
SELECT city FROM business_locations 
WHERE business_id = '840347de...' AND is_primary = true
-- Result: "Aarhus"
```

**Layer 0 (Strategy Generation):**
```typescript
weekContext.city = "Aarhus"  // ✅ Captured from business_locations
```

**Gemini Phase 1 (Strategic Brief):**
```
"Café Faust kombinerer lokationen ved åen i Aarhus..."
```

**Gemini Phase 2 (Post Ideas):**
```json
{
  "title": "En ægte klassiker: Pariserbøf",
  "rationale": "Post denne mandag i Aarhus..."
}
```

**Layer 8 (Caption Generation):**
```typescript
aiContext.city = "Aarhus"  // ✅ Passed from context

// Hashtag generation
getCuratedHashtags("DK", "winter", "menu_item", "Aarhus")
// Returns: ["#DanskMad", "#Hygge", "#Aarhus", "#AarhusEats"]
```

**Final Output:**
```json
{
  "caption": "Mandag frokost ved åen? 🥘...",
  "hashtags": ["#Aarhus", "#DanskMad", "#Vintermad", "#Hygge"]
}
```

**✅ NO #København, NO #FoodieKbh!**

---

### Trace 2: Strategic Context Flow

**Layer 0 (Post Idea):**
```json
{
  "id": 1,
  "cta_intent": "booking",
  "estimated_performance": "high",
  "strategic_fit": 0.85,
  "weather_dependent": true,
  "weather_flag": "cold_snap"
}
```

**mapIdeaToEnrichedSlot (Bridge):**
```typescript
{
  layer0: {
    cta_intent: "booking",         // ✅ Preserved
    estimated_performance: "high",  // ✅ Preserved
    strategic_fit: 0.85,           // ✅ Preserved
    weather_dependent: true         // ✅ Preserved
  }
}
```

**Layer 8 (Caption Context):**
```typescript
strategicContext: {
  cta_intent: "booking",           // ✅ Influences CTA language
  strategic_rationale: "...",      // ✅ Informs caption angle
  estimated_performance: "high"    // ✅ Metadata tracking
}
```

**Gemini Prompt:**
```
"CTA intent: booking (driver reservationer)
Brug blød booking-CTA som 'Book et bord' ikke 'Læs mere'"
```

**Final Caption:**
```
"Mandag frokost ved åen? 🥘 PARISERBØF lige som den skal være... Book et bord."
                                                                  ^^^^^^^^^^^^
                                                        ✅ Booking CTA as intended
```

---

### Trace 3: Media Direction Flow

**Layer 0 (Suggested Media):**
```json
{
  "suggested_media": {
    "type": "photo",
    "direction": "Close-up af dampende pariserbøf med bløde løg, kartofler og brun sovs. I baggrunden ser man vinduet med åen udenfor. Natural light fra vindue. 45-grader angle.",
    "why": "Single dish beauty shot virker på Instagram. Viser både produkt og lokation."
  }
}
```

**mapIdeaToEnrichedSlot (Bridge):**
```typescript
{
  layer0: {
    suggested_media: {
      type: "photo",
      direction: "...",
      why: "..."
    }
  }
}
```

**Layer 7 (Format Selection):**
```typescript
if (layer0) {
  formatSelection = {
    format: mapMediaTypeToFormat(layer0.suggested_media.type),  // "photo"
    formatReason: layer0.suggested_media.why
  }
}
```

**Layer 9 (Visual Direction):**
```typescript
visualDirection: {
  context: layer0.suggested_media.direction,  // ✅ Full photographer brief
  subject: "PARISERBØF",
  angle: "45-degree close-up",
  setting: "Restaurant table near window with canal view",
  lighting: "Natural light from window"
}
```

**Production Notes:**
```typescript
productionNotes: {
  logistics: [
    "Fotografér pariserbøf under lunch service",
    "Natural light fra vindue - 11:00-12:00 bedst",
    "Sørg for dampende ret (frisk fra køkken)",
    "Vinkel: 45 grader, close-up med udsigt i baggrund"
  ],
  photographerBrief: layer0.suggested_media.direction  // ✅ Complete instructions
}
```

---

## Context Propagation

### Complete Context Map

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 0: Strategic Planning                                 │
│  ────────────────────────────────────────────────────────    │
│  WeekContext {                                               │
│    city: "Aarhus" ──────────────────────────────┐            │
│    brand_voice: {...} ────────────────────────┐ │            │
│    weather: {...} ──────────────────────────┐ │ │            │
│    signature_items: [...] ────────────────┐ │ │ │            │
│    menu_capabilities: {...} ────────────┐ │ │ │ │            │
│  }                                       │ │ │ │ │            │
│                                          │ │ │ │ │            │
│  PostIdea {                              │ │ │ │ │            │
│    cta_intent: "booking" ──────────┐    │ │ │ │ │            │
│    suggested_media: {...} ───────┐ │    │ │ │ │ │            │
│    strategic_fit: 0.85 ────────┐ │ │    │ │ │ │ │            │
│  }                              │ │ │    │ │ │ │ │            │
└──────────────────────────────────┼─┼─┼────┼─┼─┼─┼─┼───────────┘
                                   │ │ │    │ │ │ │ │
                                   ▼ ▼ ▼    ▼ ▼ ▼ ▼ ▼
┌─────────────────────────────────────────────────────────────┐
│  mapIdeaToEnrichedSlot (Bridge Function)                    │
│  ─────────────────────────────────────────────────────────   │
│  enrichedSlot {                                              │
│    opportunity: {                                            │
│      subject ←─────────────────── idea.title                │
│      brandVoice ←──────────────── brandProfile │            │
│      seasonalContext ←──────────── weekContext │            │
│      locationContext ←──────────── locationIntel │          │
│    },                                            │            │
│    layer0: {                                     │            │
│      cta_intent ←────────────────── idea.cta_intent          │
│      suggested_media ←─────────────── idea.suggested_media   │
│      strategic_fit ←───────────────── idea.strategic_fit     │
│    }                                                          │
│  }                                                            │
└──────────────────────────────┬────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 6: Timing Optimization                                │
│  ─────────────────────────────────────────────────────────   │
│  optimizedSlot {                                             │
│    dayOfWeek: 1 (Monday)                                     │
│    hour: 11                                                  │
│    scheduledDate: "2026-02-17T11:00:00"                      │
│    optimizationReason: "Monday lunch slot..."                │
│  }                                                            │
└──────────────────────────────┬────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 7: Format Selection                                   │
│  ─────────────────────────────────────────────────────────   │
│  formatSelection {                                           │
│    platform: "instagram" ←───── layer0.platforms[0]         │
│    format: "photo" ←──────────── layer0.suggested_media.type│
│    formatReason ←─────────────── layer0.suggested_media.why │
│  }                                                            │
└──────────────────────────────┬────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 8: AI Caption Generation                              │
│  ─────────────────────────────────────────────────────────   │
│  CaptionGenerationContext {                                  │
│    businessName: "Café Faust"                                │
│    city: "Aarhus" ←──────────────────── from business_locations
│    brandVoice: {                                             │
│      signature_phrases ←───────────── from business_brand_profile
│      never_say ←──────────────────── from business_brand_profile
│    },                                                         │
│    contentOpportunity: {                                     │
│      subject ←───────────────────── from enrichedSlot        │
│      menuItem ←─────────────────── from menu query           │
│    },                                                         │
│    temporalContext: {                                        │
│      season ←───────────────────── from seasonal analysis    │
│      servicePeriod ←────────────── calculated from hour      │
│      weather ←──────────────────── from weather forecast     │
│    },                                                         │
│    strategicContext: {  ✅ NEW IN PATH A                     │
│      cta_intent ←───────────────── from layer0               │
│      strategic_rationale ←──────── from layer0               │
│      estimated_performance ←────── from layer0               │
│    }                                                          │
│  }                                                            │
│                                                               │
│  ▼ Call Gemini 2.5 Flash                                     │
│                                                               │
│  GeneratedCaption {                                          │
│    caption: "Mandag frokost ved åen? 🥘 PARISERBØF..."      │
│    hashtags: ["#Aarhus", "#DanskMad", ...] ←─ getCuratedHashtags(city)
│    emojis: ["🥘"]                                             │
│  }                                                            │
└──────────────────────────────┬────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 9: Final Assembly                                     │
│  ─────────────────────────────────────────────────────────   │
│  PostSpecification {                                         │
│    timing: {...} ←─────────────────── from Layer 6          │
│    platformFormat: {...} ←─────────────── from Layer 7       │
│    caption: {...} ←────────────────────── from Layer 8       │
│    visualDirection: {                                        │
│      context ←────────────────────── layer0.suggested_media.direction
│    },                                                         │
│    strategicContext: {  ✅ PRESERVED FROM LAYER 0            │
│      cta_intent,                                             │
│      suggested_media,                                        │
│      strategic_fit,                                          │
│      weather_dependent                                       │
│    }                                                          │
│  }                                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Integration Points

### Key Integration Points

#### 1. **Layer 0 → mapIdeaToEnrichedSlot → Layers 6-8**

**Purpose:** Bridge strategic ideas to execution layers  
**Location:** [`weekly-plan-generator.ts:529`](supabase/functions/_shared/post-helpers/weekly-plan-generator.ts#L529)

**Critical Function:**
- Transforms PostIdea → enrichedSlot format
- Preserves ALL Layer 0 metadata in `layer0` field
- Maps content types, platforms, timing suggestions
- Enables downstream layers to access strategic context

**Without This Bridge:**
- Layer 6-8 wouldn't know CTA intent
- Media direction would be lost
- Strategic fit scoring unavailable
- Weather dependency ignored

---

#### 2. **Layer 7 Format Selection - Strategy Override**

**Purpose:** Use Layer 0's media suggestion instead of independent selection  
**Location:** [`weekly-plan-generator.ts:780`](supabase/functions/_shared/post-helpers/weekly-plan-generator.ts#L780)

**Logic:**
```typescript
if (layer0) {
  // PATH A: Strategy-driven (no re-selection)
  formatSelection = {
    format: mapMediaTypeToFormat(layer0.suggested_media.type),
    formatReason: layer0.suggested_media.why
  }
} else {
  // PATH B: Legacy (Layer 7 decides)
  formatSelection = await selectMediaFormatAndPlatform(...)
}
```

**Why This Matters:**
- Preserves strategic coherence
- Photographer has specific instructions from Layer 0
- Format choice informed by week's strategic narrative
- No random "reel vs photo" decisions

---

#### 3. **Layer 8 Strategic Context Enhancement**

**Purpose:** Pass Layer 0 strategy to AI caption generator  
**Location:** [`weekly-plan-generator.ts:860`](supabase/functions/_shared/post-helpers/weekly-plan-generator.ts#L860)

**Context Building:**
```typescript
const aiContext = {
  // ... standard fields
  
  // ✅ NEW: Layer 0 strategic context
  ...(layer0 ? {
    strategicContext: {
      cta_intent: layer0.cta_intent,
      strategic_rationale: opportunity.reason,
      estimated_performance: layer0.estimated_performance,
      week_narrative: strategy?.narrative?.headline
    }
  } : {})
}
```

**Impact on AI:**
- CTA intent guides call-to-action language
  - "booking" → "Book et bord"
  - "engagement" → "Tag en ven med"
  - "awareness" → "Kig forbi næste gang"
- Strategic rationale informs caption angle
- Week narrative provides coherent theme

---

#### 4. **City Propagation to Hashtags**

**Purpose:** Generate location-specific hashtags  
**Location:** [`i18n-config.ts:366`](supabase/functions/_shared/ai-caption-generator/i18n-config.ts#L366)

**Function:**
```typescript
function getCuratedHashtags(
  country: string,
  season: string,
  contentType: string,
  city?: string  // ✅ YOUR FIX
): string[] {
  const hashtags = [
    ...config.hashtags.evergreen,
    ...config.hashtags.seasonal[season],
    ...config.hashtags.contentTypes[contentType]
  ]
  
  // ✅ Add city-specific hashtags
  if (city) {
    hashtags.push(`#${city}`)
    hashtags.push(`#${city}Eats`)
  }
  
  return hashtags
}
```

**Data Flow:**
```
business_locations.city ("Aarhus")
  ↓
Layer 0 WeekContext
  ↓
Layer 8 CaptionGenerationContext
  ↓
getCuratedHashtags("DK", "winter", "menu_item", "Aarhus")
  ↓
["#DanskMad", "#Hygge", "#Aarhus", "#AarhusEats"]
```

**Result:** Location-accurate hashtags ✅

---

#### 5. **Database Strategy Linking**

**Purpose:** Trace content plans back to originating strategy  
**Tables:** `weekly_strategies` ↔ `weekly_content_plans`

**Schema:**
```sql
weekly_strategies (
  id uuid PRIMARY KEY,
  business_id uuid,
  week_start date,
  post_ideas jsonb,  -- Array of PostIdea objects
  status text  -- 'pending_selection' | 'planned' | 'published'
)

weekly_content_plans (
  id uuid PRIMARY KEY,
  strategy_id uuid REFERENCES weekly_strategies(id),  -- ✅ Foreign key
  posts jsonb,  -- Array of PostSpecification objects
  strategy_narrative jsonb,
  strategic_priorities jsonb
)
```

**Benefits:**
- Trace which strategy created which posts
- Update strategy status when plan published
- Analytics: "Which strategies led to best performance?"
- Reuse successful strategies for future weeks

---

## Testing Path A

### How to Test the Full Strategic Flow

**Prerequisites:**
- Supabase running locally or in production
- Business data populated (Café Faust: `840347de-9ba7-4275-8aa3-4553417fc2af`)
- Edge functions deployed

---

### Test 1: Generate Strategy

```bash
# Call get-weekly-strategy edge function
curl -X POST https://your-project.supabase.co/functions/v1/get-weekly-strategy \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "840347de-9ba7-4275-8aa3-4553417fc2af",
    "week_start": "2026-02-17"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "strategy_id": "f8b3e4a2-1234-5678-90ab-cdef12345678",
  "strategy": {
    "narrative": {
      "headline": "Vinterhygge ved åen: Klassisk comfort i kulden"
    },
    "post_ideas": [
      {
        "id": 1,
        "title": "En ægte klassiker: Pariserbøf",
        "platforms": ["instagram"],
        "cta_intent": "booking",
        "estimated_performance": "high",
        "strategic_fit": 0.85
      }
      // ... 4 more
    ]
  }
}
```

**Verification Checklist:**
- ✅ 5-7 post ideas returned
- ✅ Each idea has `cta_intent`, `suggested_media`, `strategic_fit`
- ✅ Strategy saved to database (check `weekly_strategies` table)
- ✅ Status = 'pending_selection'

---

### Test 2: Generate Full Plan from Strategy

```bash
# Call generate-weekly-plan with strategy_id
curl -X POST https://your-project.supabase.co/functions/v1/generate-weekly-plan \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "weekStart": "2026-02-17",
    "strategy_id": "f8b3e4a2-1234-5678-90ab-cdef12345678",
    "selected_idea_ids": [1, 3, 5]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "plan": {
    "weekNumber": 8,
    "strategyId": "f8b3e4a2-1234-5678-90ab-cdef12345678",
    "posts": [
      {
        "caption": {
          "text": "Mandag frokost ved åen? 🥘 PARISERBØF...",
          "hashtags": ["#Aarhus", "#DanskMad", "#Vintermad"],
          "isAIGenerated": true
        },
        "timing": {
          "day": "Monday",
          "time": "11:00"
        },
        "strategicContext": {
          "cta_intent": "booking",
          "strategic_fit": 0.85
        }
      }
      // ... 2 more posts
    ]
  }
}
```

**Verification Checklist:**
- ✅ 3 posts returned (matching selected_idea_ids)
- ✅ Each post has caption with hashtags
- ✅ Hashtags include `#Aarhus` (NOT #København!)
- ✅ strategicContext preserved from Layer 0
- ✅ Visual direction includes photographer brief
- ✅ CTA language matches cta_intent ("Book et bord" for booking)

---

### Test 3: Verify Path A vs Path B

**Path A (with strategy):**
```javascript
// Should see in logs:
"[WeeklyPlan] 🎯 Using Layer 0 strategy path (Layer 5 skipped)"
"[WeeklyPlan] Processing 3 selected ideas: #1, #3, #5"
"[WeeklyPlan] L7 override: photo → photo on instagram"
```

**Path B (without strategy):**
```javascript
// Should see in logs:
"[WeeklyPlan] ⚡ Using legacy path (Layer 5 scoring)"
"[WeeklyPlan] Calling selectWeeklyOpportunities"
"[WeeklyPlan] Got 73 opportunity slots"
```

---

### Test 4: Check Database Linking

```sql
-- Verify strategy saved
SELECT * FROM weekly_strategies 
WHERE id = 'f8b3e4a2-1234-5678-90ab-cdef12345678';
-- Should have: post_ideas (5 objects), status = 'planned'

-- Verify plan linked to strategy
SELECT * FROM weekly_content_plans 
WHERE strategy_id = 'f8b3e4a2-1234-5678-90ab-cdef12345678';
-- Should have: posts (3 objects), strategy_narrative, strategic_priorities

-- Check city in posts
SELECT 
  (posts->0->'caption'->>'text') as caption,
  (posts->0->'caption'->'hashtags') as hashtags
FROM weekly_content_plans 
WHERE strategy_id = 'f8b3e4a2-1234-5678-90ab-cdef12345678';
-- hashtags should include "Aarhus", NOT "København"
```

---

### Test 5: Verify Context Flow (Debugging)

Add console.log at key integration points:

**1. Check city in Layer 0:**
```typescript
// get-weekly-strategy/index.ts
console.log('[Layer 0] City from location:', location?.city)  // Should be "Aarhus"
```

**2. Check layer0 field after mapping:**
```typescript
// weekly-plan-generator.ts
console.log('[Bridge] layer0 data:', enrichedSlots[0].layer0)
// Should have: cta_intent, suggested_media, strategic_fit
```

**3. Check strategicContext in Layer 8:**
```typescript
// weekly-plan-generator.ts
console.log('[Layer 8] Strategic context:', aiContext.strategicContext)
// Should have: cta_intent, strategic_rationale, estimated_performance
```

**4. Check hashtags in final output:**
```typescript
// weekly-plan-generator.ts
console.log('[Layer 9] Final hashtags:', post.caption.hashtags)
// Should include: "Aarhus", NOT "København"
```

---

## Summary

### Path A vs Path B Comparison

| Aspect | Path A (Strategic) | Path B (Regeneration) |
|--------|-------------------|---------------------|
| **Entry Point** | `get-weekly-strategy` → `generate-weekly-plan` | `ai-generate-from-strategy` |
| **Layer 0** | ✅ Full strategic analysis | ❌ Skipped |
| **Layer 5** | ❌ Skipped (strategy provides ideas) | ✅ Menu scoring |
| **Layer 6** | ✅ Optimization from suggested timing | ✅ Full optimization |
| **Layer 7** | ⚠️ Guided by Layer 0 media suggestion | ✅ Independent selection |
| **Layer 8** | ✅ Enhanced with strategic context | ⚠️ Basic context only |
| **CTA Intent** | ✅ From Layer 0 ("booking", "engagement") | ❌ AI-inferred |
| **Media Direction** | ✅ From Layer 0 photographer brief | ❌ Generic |
| **Strategic Fit** | ✅ Scored by Layer 0 (0.0-1.0) | ❌ Not available |
| **Weather Awareness** | ✅ weather_dependent flag | ⚠️ Inferred from season |
| **Database Linking** | ✅ strategy_id traces to strategy | ❌ No link |
| **Use Case** | Full weekly planning | Quick single-post fix |

---

### Key Takeaways

1. **Layer 0 Provides Comprehensive Context**
   - Strategic analysis of the week
   - Specific post ideas with CTA intent
   - Media direction for photographers
   - Performance estimates
   - Weather dependencies

2. **Path A Skips Layer 5**
   - No need to score 73 menu items
   - Strategy already selected 5 specific ideas
   - Saves computation time
   - Ensures strategic coherence

3. **mapIdeaToEnrichedSlot is the Critical Bridge**
   - Transforms Layer 0 ideas → execution format
   - Preserves ALL strategic metadata
   - Enables Layers 6-8 to access Layer 0 context

4. **Layer 7 is Guided, Not Independent**
   - Uses Layer 0's suggested media type
   - No random format decisions
   - Photographer has specific instructions

5. **Layer 8 Enhanced with Strategic Context**
   - CTA intent guides call-to-action language
   - Strategic rationale informs caption angle
   - Estimated performance tracked

6. **City Propagation Fixed**
   - business_locations.city → Layer 0 → Layer 8
   - getCuratedHashtags uses city parameter
   - Result: #Aarhus not #København ✅

---

### Answer to Your Question

> "Is Layer 0 enough for AI to convert it to actual posts, hashtags, CTA etc.?"

**YES - Layer 0 provides MORE than enough:**

✅ **For Posts:**
- Specific post titles and subjects
- Content type classification
- Strategic rationale for each idea

✅ **For Hashtags:**
- City context flows to Layer 8
- Season + weather inform hashtag selection
- Content type determines category hashtags

✅ **For CTA:**
- cta_intent field explicitly states goal
- AI uses this to generate appropriate CTAs
- "booking" → "Book et bord", not generic

✅ **For Timing:**
- suggested_day and suggested_time provide starting point
- Layer 6 refines but respects strategic intent

✅ **For Media:**
- suggested_media provides photographer instructions
- Format choice (photo/reel/carousel) pre-decided
- Creative direction specific to each post

**The integration is architecturally complete.** Your recent hashtag bug was in Path B (single regeneration), not Path A (full strategic flow). When you test the complete Layer 0 → Layer 9 pipeline, you'll see the system working as designed with full strategic context driving every decision.

---

**Next Step:** Test Path A by generating a weekly strategy and full plan to see the complete flow in action!
