# LAYER 0 NEW ARCHITECTURE - DETAILED PLAN
**Date:** 2026-05-20  
**Status:** Planning Phase - No Code Implementation Yet  
**Purpose:** Define business-specific persona architecture with critical analysis

---

## 🎯 CORE PRINCIPLE

> **"The AI should BECOME the business, not be a consultant FOR the business."**

This means:
- ❌ NOT: "Du er en professionel social media manager specialiseret i cafes..."
- ✅ YES: "Du er Café Faust. Ved åen i Aarhus. Du tilbyder..."

**The persona is the business's IDENTITY, not marketing expertise.**

---

## 🧠 FUNDAMENTAL QUESTION: WHAT IS THE PERSONA?

### Current (Wrong) Understanding:
Persona = "A marketing professional with expertise in [business type]"

### Correct Understanding:
Persona = "The business's own identity and voice"

**Analogy:**

**Wrong Approach (Consultant Model):**
```
Imagine you hired a consultant who says:
"Hi, I'm a professional cafe marketing expert. I specialize in all-day dining 
concepts in Denmark. I have expertise in hybrid cafe marketing, time-segment 
targeting, and versatile menu communication."

When they write content, they write ABOUT your business from an external perspective.
```

**Right Approach (Identity Model):**
```
Imagine you ARE the business:
"Hi, I'm Café Faust. We're located by the river in Aarhus. We serve brunch 
and lunch from 9am, with our signature pariserbøf and burgers. Our bar is 
open until 2am on weekends. We have outdoor seating by the water."

When you write content, you write AS the business from the inside.
```

**Which sounds more authentic?** Obviously the second one.

---

## 📊 CRITICAL ANALYSIS: PERSONA vs BRAND PROFILE

### What Belongs WHERE?

This is the most critical decision. We must clearly separate:
1. **PERSONA (Layer 0)** - WHO the business IS
2. **BRAND PROFILE (Layers 1-5)** - HOW the business communicates

| Element | Current Location | Should Be In | Reasoning |
|---------|------------------|--------------|-----------|
| **Business name** | Missing | ✅ PERSONA | Core identity |
| **Location signature** | Missing | ✅ PERSONA | Core identity ("ved åen") |
| **City + basic context** | Geographic context | ✅ PERSONA | Where the business exists |
| **Core programmes** | Programmes layer | ✅ PERSONA | What the business offers |
| **Signature menu items** | Missing | ✅ PERSONA | What defines the offering |
| **Key operating hours** | Missing | ✅ PERSONA | When the business is available |
| **Special features** | Missing | ✅ PERSONA | Physical attributes (outdoor, takeaway) |
| | | | |
| **"Expertise areas"** | Currently in persona | ❌ REMOVE | This is consultant knowledge, not business identity |
| **"Content focus"** | Currently in persona | ❌ REMOVE | This is WHAT to create, not WHO you are |
| **Tone defaults** | Currently in persona | ❌ MOVE to Voice Profile | This is HOW to communicate |
| **Marketing strategy** | Currently in persona | ❌ MOVE to Commercial Orientation | This is strategy, not identity |
| **Voice rules** | Voice Profile | ✅ KEEP in Brand Profile | Correct location |
| **Positioning** | Identity Profile | ✅ KEEP in Brand Profile | Correct location |
| **Audience segments** | Audience Profile | ✅ KEEP in Brand Profile | Correct location |

### The Clear Separation:

**PERSONA answers:**
- WHO am I? → Business name and identity
- WHERE am I? → Location and city context
- WHAT do I offer? → Programmes and signature items
- WHEN am I available? → Key hours and schedules

**BRAND PROFILE answers:**
- HOW do I communicate? → Voice, tone, style
- WHY should customers care? → Positioning, value proposition
- WHO do I target? → Audience segments
- WHAT do I emphasize? → Content focus, strategic priorities

**Example for Café Faust:**

**PERSONA (Identity Layer):**
```
Du er Café Faust.

Ved åen i Aarhus (350.000 indbyggere, Danmarks næststørste by)

Du tilbyder:
- Brunch & frokost (09:00-17:30): pariserbøf, æggekage, burger
- Aftensmad: 3-retters menuer
- Bar: cocktails (åbent til 02:00 i weekenden)

Kendetegn:
- Udendørs siddepladser ved vandet
- Takeaway muligheder
```

**BRAND PROFILE (Generated FROM persona):**

**Voice Profile:**
```
Tone: Casual og afslappet med urban cool
Formality: Casual friend (du-form, personlig)
Sentence style: Kort og deklarativ (max 15 ord)
Location context weight: High (fremhæv vandkanten)
Rules: "Nævn location når relevant", "Brug konkrete tider"...
```

**Commercial Orientation:**
```
Brunch: Weekend-familie fokus, leisure timing
Frokost: Lokal arbejdsstyrke, hurtig service
Bar: Unge voksne, weekend socializing
```

**Positioning:**
```
"All-day destination ved åen - fra morgenmad til midnat"
Unique selling point: Vandkantslokation + versatilitet
Competition: Differentier på location + åbningstider
```

**See the difference?**
- Persona = FACTS about the business (identity)
- Brand Profile = STRATEGY for the business (communication)

---

## 🔍 COMPLEXITY ANALYSIS: HOW MUCH INFORMATION?

### The Goldilocks Problem:

**Too Little Information:**
```
Du er Café Faust i Aarhus.
```
→ AI doesn't know what the business offers, can't write authentic content

**Too Much Information:**
```
Du er Café Faust, grundlagt i 2015, beliggende ved åen i Aarhus som er 
Danmarks næststørste by med 350.000 indbyggere fordelt på en befolkning 
med 28% studerende fra Aarhus Universitet, karakteriseret ved en voksende 
foodscene med over 500 restauranter og høj konkurrence på casual dining 
segmentet. Du tilbyder brunch hver dag fra præcis kl. 09:00 til 14:00 med 
retter som avocado toast (125 kr), eggs benedict (135 kr), pancakes (95 kr), 
smoothie bowls (105 kr)... [continues for 500 more words]
```
→ AI gets overwhelmed, loses focus, can't extract key identity

**Just Right:**
```
Du er Café Faust.

LOCATION:
Ved åen i Aarhus (350.000 indbyggere, Danmarks næststørste by)
Udendørs siddepladser | Takeaway

TILBUD:
Brunch & Frokost (09:00-17:30): pariserbøf, æggekage, burger
Aftensmad: 3-retters menuer
Bar: cocktails (åbent til 02:00 i weekenden)

GÆSTER:
Brunch weekend-crowd | Lokal frokost | Aftens-dining | Bar-scene
```
→ Concise, structured, clear identity

### Optimal Length Target:

**100-150 words total**

**Why this length?**
1. ✅ Fits in AI's attention span without overwhelming
2. ✅ Enough detail to be specific, not generic
3. ✅ Forces prioritization (only the most important info)
4. ✅ Leaves room for brand profile details later
5. ✅ Easy to scan and understand quickly

### Information Hierarchy (What to Prioritize):

**Tier 1 (MUST HAVE - Always include):**
1. Business name
2. Location signature ("ved åen")
3. City + size (basic context)
4. Core programmes (3-5 max)

**Tier 2 (SHOULD HAVE - Include if available):**
5. Signature menu items (3-5 items max, not full menu)
6. Key hours (lunch end time, bar closing - not full schedule)
7. Special features (outdoor, takeaway, etc.)

**Tier 3 (NICE TO HAVE - Only if space permits):**
8. Basic audience types (who comes when)
9. Notable characteristics (historic building, view, etc.)

**Tier 4 (DON'T INCLUDE - Belongs elsewhere):**
❌ Full menu
❌ Exact prices
❌ Full opening hours schedule
❌ Detailed city demographics
❌ Marketing strategy
❌ Voice/tone rules
❌ Content examples

---

## 📋 DATA SOURCE MAPPING

### Where Does Each Piece Come From?

| Information | Primary Source | Fallback Source | AI Generation? |
|-------------|----------------|-----------------|----------------|
| **Business name** | `businesses.name` | - | No |
| **Location signature** | `businesses.local_location_reference` | - | No |
| **City** | `business_locations.city` | Postal code lookup | No |
| **Postal code** | `business_locations.postal_code` | - | No |
| **City size** | - | - | ✅ Yes (AI) |
| **City population** | - | - | ✅ Yes (AI) |
| **City characteristics** | - | - | ✅ Yes (AI) |
| **Programmes** | `business_programme_profiles.programme_type` | Programme detection | No |
| **Programme labels** | `business_programme_profiles.label` | - | No |
| **Signature menu items** | `menu_items_normalized` (top 3-5) | - | Maybe (AI ranking) |
| **Key hours** | `opening_hours` | - | Maybe (AI summary) |
| **Special features** | `business_location_intelligence` | Business data | Maybe (AI detection) |
| **Audience types** | - | - | ✅ Yes (AI inference) |

### Data Extraction Logic:

**For Signature Menu Items:**
```
Option 1 (Simple): Take first 3-5 items from menu
Option 2 (Smart): AI ranks menu items by "signature-ness"
  - Criteria: Unique, popular, defines the concept
  - Example: pariserbøf > "salat" (more distinctive)
```

**For Key Hours:**
```
Option 1 (Simple): Extract lunch end time + bar closing
Option 2 (Smart): AI summarizes to most relevant hours
  - Lunch: 09:00-17:30
  - Bar: til 02:00 i weekenden
  - Don't include: "Mandag 09:00-22:00, Tirsdag 09:00-22:00..."
```

**For Special Features:**
```
Option 1: Extract from business_location_intelligence
  - outdoor_seating, takeaway_available, etc.
Option 2: AI detects from business description/location data
  - "ved åen" → likely outdoor seating
  - Menu has "take away" → takeaway available
```

---

## 🏗️ TWO-STAGE ARCHITECTURE

### Why Two Stages?

**Problem with Single-Stage:**
If we try to generate BOTH persona AND brand profile in one prompt, we get:
- ❌ Overwhelming complexity
- ❌ Mixed concerns (identity + strategy)
- ❌ Harder to debug
- ❌ Can't reuse persona across different contexts

**Solution: Two Clear Stages:**

### Stage 1: Generate Business-Specific Persona (AI Call #1)

**Input Data:**
- Business name
- Location signature
- City + postal code
- Programmes (detected)
- Menu items (raw)
- Opening hours (raw)
- Business features (raw)

**AI Prompt:**
```
Generate a concise business identity persona (100-150 words max).

BUSINESS DATA:
Name: Café Faust
Location: ved åen, Aarhus 8000
Programmes: breakfast, lunch, dinner, bar
Sample Menu: [list of 20 items]
Opening Hours: [schedule]
Features: outdoor seating, takeaway

TASK:
Create a Danish identity statement that:
1. Makes the AI BECOME this business (not consult for it)
2. Includes: name, location, city context, core offerings, signature items (3-5), key hours, features
3. Structured format (LOCATION, TILBUD, KENDETEGN)
4. Max 150 words
5. Focus on FACTS, not strategy

Format:
Du er [Business Name].

LOCATION:
[Location signature] i [City] ([population], [context])
[Features]

TILBUD:
[Programme 1]: [signature items] ([key hours])
[Programme 2]: [offering]
...

Output ONLY the persona text, nothing else.
```

**Output (Stored in Layer 0):**
```json
{
  "system_persona": "Du er Café Faust.\n\nLOCATION:\nVed åen i Aarhus (350.000 indbyggere, Danmarks næststørste by)\nUdendørs siddepladser | Takeaway\n\nTILBUD:\nBrunch & Frokost (09:00-17:30): pariserbøf, æggekage, burger\nAftensmad: 3-retters menuer\nBar: cocktails (åbent til 02:00 i weekenden)",
  "business_name": "Café Faust",
  "location_signature": "ved åen i Aarhus",
  "core_programmes": ["breakfast", "lunch", "dinner", "bar"],
  "signature_items": ["pariserbøf", "æggekage", "burger"]
}
```

**Benefits:**
- ✅ Focused on identity only
- ✅ AI optimizes for conciseness
- ✅ Reusable across all content generation
- ✅ Can be validated independently

---

### Stage 2: Generate Brand Profile (AI Calls #2-6)

**Input:**
- **Persona (from Stage 1)** ← The identity foundation
- Additional context (menu, location intelligence, etc.)

**Each subsequent AI call uses the persona:**

**Example - Commercial Orientation Generation:**
```
SYSTEM CONTEXT:
{persona.system_persona}

TASK:
Generate commercial orientation for the BREAKFAST programme.
Remember: You ARE Café Faust, write as the business itself.

Based on your identity (brunch/frokost ved åen), what is the commercial 
reasoning for breakfast service?
```

**Example - Voice Profile Generation:**
```
SYSTEM CONTEXT:
{persona.system_persona}

TASK:
Generate voice guidelines that match YOUR identity.
You are a waterfront all-day venue in Aarhus's second city.

What tone, formality, and style fits YOUR brand?
Output: structural rules, style guidelines, tone guidance
```

**Benefits:**
- ✅ All AI calls start from the same identity foundation
- ✅ Consistent business voice across all layers
- ✅ Clear separation: persona = WHO, brand profile = HOW
- ✅ Each layer can reference the persona

---

## 🌍 AI-GENERATED CITY CONTEXT

### Problem: Hardcoded Cities Don't Scale

**Current approach:**
```typescript
const DANISH_CITY_PROFILES = {
  'København': { population: 800000, ... },
  'Aarhus': { population: 350000, ... },
  // Only 5 cities!
}
```

**Issues:**
- ❌ Only 5 Danish cities defined
- ❌ 30+ cities get generic fallback
- ❌ Germany? Impossible.
- ❌ Developer must research every city

### Solution: AI Generation with Caching

**Approach:**
```typescript
async function getCityContext(city: string, country: string) {
  // 1. Check cache
  const cached = await db.query(`
    SELECT * FROM city_context_cache 
    WHERE city = $1 AND country = $2 
    AND generated_at > NOW() - INTERVAL '90 days'
  `);
  
  if (cached) return cached;
  
  // 2. Generate with AI
  const prompt = `Analyze ${city}, ${country} for restaurant context.

REQUIRED OUTPUT (JSON):
{
  "population": <number>,
  "size_category": "small_town|medium_city|large_city|capital",
  "basic_context": "<1-2 sentence description in Danish>",
  "characteristics": ["<3-5 key traits>"]
}

Keep basic_context under 30 words.
Focus on: size, character, dining scene relevance.
Danish output for Danmark, local language otherwise.`;

  const cityContext = await callOpenAI(prompt);
  
  // 3. Cache for 90 days
  await db.query(`
    INSERT INTO city_context_cache (city, country, context, generated_at)
    VALUES ($1, $2, $3, NOW())
  `);
  
  return cityContext;
}
```

**Benefits:**
- ✅ Works for ANY city in ANY country
- ✅ No manual maintenance
- ✅ Cache prevents repeated API calls
- ✅ Can regenerate if city changes (population growth, etc.)
- ✅ Scalable to international expansion

**Complexity Control:**
- Keep city context to **20-30 words max**
- Only include: population, size category, 1-2 sentence description
- Don't generate full demographics/competitor analysis (too much)

**Example Output:**
```
Aarhus (350.000 indbyggere, Danmarks næststørste by)
```

Not:
```
Aarhus er Danmarks næststørste by med en befolkning på 350.000 indbyggere, 
hvoraf 28% er studerende fra Aarhus Universitet. Byen har en voksende 
foodscene med over 500 restauranter og høj konkurrence på casual dining 
segmentet... [continues]
```

---

## 🎨 PERSONA FORMAT DESIGN

### Format Requirements:

1. **Structured** - Easy to scan
2. **Concise** - Max 150 words
3. **Hierarchical** - Clear sections
4. **Factual** - No marketing language
5. **Danish** - For Danish businesses

### Proposed Format:

```
Du er [Business Name].

LOCATION:
[Location signature] i [City] ([population], [size context])
[Key features separated by |]

TILBUD:
[Programme 1] ([hours]): [signature items]
[Programme 2]: [offering description]
[Programme 3] ([hours]): [signature items]

[Optional: KENDETEGN section if space permits]
[Feature 1] | [Feature 2] | [Feature 3]
```

### Format Variations by Business Type:

**All-Day Venue (like Café Faust):**
```
Du er [Name].

LOCATION:
[Where] i [City] ([population], [context])
[Features]

TILBUD:
Brunch & Frokost ([hours]): [signature items]
Aftensmad: [style]
Bar ([hours]): [offerings]
```

**Single-Programme (e.g., Fine Dining):**
```
Du er [Name].

LOCATION:
[Where] i [City] ([population], [context])

TILBUD:
Aftensmad: [cuisine style], [menu structure]
Signatur-retter: [3-5 items]
[Special features]
```

**Casual Cafe:**
```
Du er [Name].

LOCATION:
[Where] i [City] ([population], [context])

TILBUD:
Kaffe & Brunch ([hours]): [specialty + signature items]
[Additional offerings]
```

**Adaptability:** Format adjusts based on:
- Number of programmes (1-4)
- Available information
- Business type complexity

---

## 🔄 INFORMATION FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│                    RAW DATA SOURCES                          │
├─────────────────────────────────────────────────────────────┤
│ businesses                 │ name, local_location_reference  │
│ business_locations         │ city, postal_code, is_primary   │
│ business_programme_profiles│ programme_type, label           │
│ menu_items_normalized      │ item_name, category, price      │
│ opening_hours              │ day, opens_at, closes_at        │
│ business_location_intelligence │ features, outdoor_seating   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│               DATA AGGREGATION & PREPARATION                 │
├─────────────────────────────────────────────────────────────┤
│ • Fetch business + primary location (JOIN)                  │
│ • Get programmes (already detected in V5)                   │
│ • Extract top 3-5 menu items (by prominence/category)       │
│ • Summarize key hours (lunch service, bar closing)          │
│ • Collect features (outdoor, takeaway, etc.)                │
│ • Generate city context (AI call with caching)              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│           STAGE 1: GENERATE PERSONA (AI Call #1)            │
├─────────────────────────────────────────────────────────────┤
│ AI PROMPT:                                                   │
│ "Generate business identity persona (max 150 words)          │
│  Input: {name, location, city, programmes, menu, hours}      │
│  Format: Structured Danish identity statement               │
│  Focus: FACTS about business, not marketing strategy"       │
│                                                              │
│ AI GENERATES:                                                │
│ "Du er Café Faust.                                          │
│  LOCATION: Ved åen i Aarhus (350k, næststørste by)         │
│  TILBUD: Brunch & Frokost (09-17:30): pariserbøf..."       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              STORE IN LAYER 0 (Database)                     │
├─────────────────────────────────────────────────────────────┤
│ brand_profile_v5.layer_0_intelligence = {                   │
│   "business_identity": {                                     │
│     "system_persona": "Du er Café Faust...",                │
│     "business_name": "Café Faust",                          │
│     "location_signature": "ved åen i Aarhus",               │
│     "city_context": {                                        │
│       "city": "Aarhus",                                      │
│       "population": 350000,                                  │
│       "size_category": "medium_city",                        │
│       "basic_context": "Danmarks næststørste by"            │
│     },                                                       │
│     "core_programmes": ["breakfast", "lunch", "dinner"],    │
│     "signature_items": ["pariserbøf", "æggekage", "burger"],│
│     "key_hours": {                                           │
│       "lunch_service": "09:00-17:30",                       │
│       "bar_closing": "02:00 (weekend)"                      │
│     },                                                       │
│     "features": ["outdoor_seating", "takeaway"]             │
│   }                                                          │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│         STAGE 2: GENERATE BRAND PROFILE                      │
│              (Multiple AI Calls #2-6)                        │
├─────────────────────────────────────────────────────────────┤
│ Each AI call INCLUDES persona as context:                   │
│                                                              │
│ AI Call #2: Commercial Orientation                          │
│   CONTEXT: {persona.system_persona}                         │
│   TASK: Generate commercial reasoning per programme         │
│                                                              │
│ AI Call #3: Identity Profile                                │
│   CONTEXT: {persona.system_persona}                         │
│   TASK: Generate positioning & values                       │
│                                                              │
│ AI Call #4: Audience Segments                               │
│   CONTEXT: {persona.system_persona}                         │
│   TASK: Define audience per programme                       │
│                                                              │
│ AI Call #5: Voice Profile                                   │
│   CONTEXT: {persona.system_persona}                         │
│   TASK: Generate tone, formality, voice rules               │
│                                                              │
│ AI Call #6: Writing Examples                                │
│   CONTEXT: {persona.system_persona}                         │
│   TASK: Generate example content                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│            CONTENT GENERATION (Later Usage)                  │
├─────────────────────────────────────────────────────────────┤
│ Text Generation:                                             │
│   SYSTEM: {persona.system_persona}                          │
│   + Voice rules from brand profile                          │
│   TASK: Write social media post about [topic]               │
│                                                              │
│ Quick Suggestions:                                           │
│   SYSTEM: {persona.system_persona}                          │
│   + Audience segments from brand profile                    │
│   TASK: Generate 3 timely content ideas                     │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚖️ CRITICAL TRADEOFFS & DECISIONS

### Decision #1: How Much Business Detail in Persona?

**Option A: Minimal (50 words)**
```
Du er Café Faust ved åen i Aarhus.
Du tilbyder brunch, frokost, aftensmad, og bar.
```
- ✅ Very concise
- ❌ Not specific enough, could be any cafe

**Option B: Moderate (100-150 words) ← RECOMMENDED**
```
Du er Café Faust.

LOCATION:
Ved åen i Aarhus (350.000 indbyggere)
Udendørs siddepladser | Takeaway

TILBUD:
Brunch & Frokost (09:00-17:30): pariserbøf, æggekage, burger
Aftensmad: 3-retters menuer
Bar: cocktails (til 02:00 i weekenden)
```
- ✅ Specific enough to be authentic
- ✅ Concise enough to stay focused
- ✅ Includes signature details

**Option C: Detailed (300+ words)**
```
Du er Café Faust, beliggende ved åen i Aarhus som er Danmarks næststørste 
by med 350.000 indbyggere... [continues with extensive detail about every 
menu item, full schedule, complete features list, etc.]
```
- ✅ Very comprehensive
- ❌ Too long, AI loses focus
- ❌ Mixes identity with detailed catalog

**RECOMMENDATION: Option B (100-150 words)**

---

### Decision #2: Generic Business Type Knowledge?

**Question:** Should persona include business type expertise?

**Current approach includes:**
```
"Du har ekspertise i:
- All-day dining marketing
- Time-segment targeting
- Versatile menu communication"
```

**Analysis:**

**REMOVE THIS. Here's why:**

1. **It's consultant knowledge, not business identity**
   - A cafe doesn't have "expertise in cafe marketing"
   - A cafe HAS brunch, lunch, and bar programs
   - The marketing expertise comes from the BRAND PROFILE, not the business

2. **It creates confused voice**
   - "I'm an expert in marketing cafes" (consultant)
   - vs "I'm a cafe by the river" (business)
   - These are fundamentally different voices

3. **The AI doesn't need it**
   - If persona says "Du er Café Faust med brunch og bar"
   - AI already knows it's all-day dining (from context)
   - Explicit "expertise" statements are redundant

**RECOMMENDATION: Remove all "expertise" and "marketing" language from persona**

**Instead:**
- ❌ "Du har ekspertise i all-day dining marketing"
- ✅ "Du tilbyder brunch, frokost, og bar" (just state the facts)

---

### Decision #3: AI-Generated vs Extracted Menu Items?

**Question:** How do we pick the 3-5 "signature" menu items?

**Option A: Simple Extraction**
```typescript
// Take first 5 items from menu
const signatureItems = menuItems.slice(0, 5).map(m => m.name);
```
- ✅ Fast, no AI call needed
- ❌ Might not pick the most representative items

**Option B: AI Ranking (Additional AI call)**
```typescript
const prompt = `From this menu, identify 3-5 signature items that best define 
the restaurant's offering. Pick items that are:
- Distinctive (not generic "salad")
- Popular/featured
- Representative of the concept

Menu: ${menuItems.map(m => m.name).join(', ')}

Output: Just the 3-5 item names, comma-separated.`;
```
- ✅ Picks most representative items
- ❌ Requires additional AI call (cost + latency)

**Option C: Hybrid (Smart Extraction)**
```typescript
// Pick items from different categories
// Prioritize items with detailed descriptions
// Include one item per major programme
const signatureItems = smartPickMenuItems(menuItems, programmes);
```
- ✅ Better than random
- ✅ No AI call
- ❌ Might still miss best items

**RECOMMENDATION: Start with Option A (simple), upgrade to C if needed**

Reasoning:
- Keep persona generation fast
- Menu items are illustrative, not critical
- Can improve later if quality issues arise

---

### Decision #4: Store Structured Data or Just Text?

**Question:** Should Layer 0 store BOTH formatted text AND structured data?

**Option A: Text Only**
```json
{
  "layer_0_intelligence": {
    "system_persona": "Du er Café Faust.\n\nLOCATION:\nVed åen..."
  }
}
```
- ✅ Simple
- ❌ Hard to query/analyze structured elements

**Option B: Structured Only**
```json
{
  "layer_0_intelligence": {
    "business_name": "Café Faust",
    "location_signature": "ved åen i Aarhus",
    "programmes": [...],
    "signature_items": [...]
  }
}
```
- ✅ Queryable
- ❌ Need to reconstruct formatted text every time

**Option C: Both (Hybrid) ← RECOMMENDED**
```json
{
  "layer_0_intelligence": {
    "business_identity": {
      "system_persona": "Du er Café Faust...",  // ← Formatted text
      "business_name": "Café Faust",             // ← Structured
      "location_signature": "ved åen i Aarhus",  // ← Structured
      "city_context": {                          // ← Structured
        "city": "Aarhus",
        "population": 350000,
        "size_category": "medium_city"
      },
      "core_programmes": [...],                  // ← Structured
      "signature_items": [...]                   // ← Structured
    }
  }
}
```
- ✅ Formatted text ready for AI prompts
- ✅ Structured data for queries/analytics
- ❌ Slight redundancy (acceptable)

**RECOMMENDATION: Option C (both)**

Benefits:
- `system_persona` field = ready to use in AI prompts
- Structured fields = easy to query, display in UI, validate
- Small redundancy is acceptable for flexibility

---

## 🧪 VALIDATION CRITERIA

### How Do We Know the Persona Is Good?

**Quality Checklist:**

**✅ Identity Test:**
- [ ] Uses "Du er [Business Name]" (not "Du er en...")
- [ ] Includes specific business name
- [ ] Includes specific location signature
- [ ] Sounds like the business talking, not a consultant

**✅ Completeness Test:**
- [ ] Includes city + basic context
- [ ] Includes core programmes (3-5 max)
- [ ] Includes signature items (3-5 max)
- [ ] Includes key hours (not full schedule)
- [ ] Includes special features (if applicable)

**✅ Conciseness Test:**
- [ ] Total length 100-150 words
- [ ] No redundant information
- [ ] No marketing jargon
- [ ] Structured format (scannable)

**✅ Separation Test:**
- [ ] Does NOT include marketing expertise
- [ ] Does NOT include content strategy
- [ ] Does NOT include voice/tone rules
- [ ] Does NOT include positioning statements

**✅ Authenticity Test:**
- [ ] Could a human business owner read this and say "yes, that's us"
- [ ] Specific enough that it couldn't apply to other businesses
- [ ] Factual, not aspirational or marketing-speak

**Red Flags (Reject if present):**
- ❌ "Du er en professionel..." (consultant voice)
- ❌ "Du har ekspertise i..." (expertise statements)
- ❌ Over 200 words (too long)
- ❌ Generic enough to apply to multiple businesses
- ❌ Marketing language ("leading", "premium", "best")

---

## 📐 EXAMPLE: CAFÉ FAUST PERSONA (IDEAL)

### Complete Generated Persona:

```
Du er Café Faust.

LOCATION:
Ved åen i Aarhus (350.000 indbyggere, Danmarks næststørste by)
Udendørs siddepladser ved vandet | Takeaway muligheder

TILBUD:
Brunch & Frokost (09:00-17:30): pariserbøf, æggekage, burger
Aftensmad: 3-retters menuer
Bar: cocktails og drinks (åbent til kl. 02:00 i weekenden)

GÆSTER:
Brunch weekend-crowd | Lokal frokost-trafik | Aftens-dining | Sen bar-scene
```

**Word count:** 67 words ✅  
**Format:** Structured ✅  
**Identity voice:** "Du er Café Faust" ✅  
**Specific details:** Location, items, hours ✅  
**No marketing jargon:** ✅  

### Stored JSON:

```json
{
  "layer_0_intelligence": {
    "business_identity": {
      "system_persona": "Du er Café Faust.\n\nLOCATION:\nVed åen i Aarhus (350.000 indbyggere, Danmarks næststørste by)\nUdendørs siddepladser ved vandet | Takeaway muligheder\n\nTILBUD:\nBrunch & Frokost (09:00-17:30): pariserbøf, æggekage, burger\nAftensmad: 3-retters menuer\nBar: cocktails og drinks (åbent til kl. 02:00 i weekenden)\n\nGÆSTER:\nBrunch weekend-crowd | Lokal frokost-trafik | Aftens-dining | Sen bar-scene",
      "business_name": "Café Faust",
      "location_signature": "ved åen i Aarhus",
      "city_context": {
        "city": "Aarhus",
        "population": 350000,
        "size_category": "medium_city",
        "basic_context": "Danmarks næststørste by"
      },
      "core_programmes": [
        "breakfast",
        "lunch",
        "dinner",
        "bar"
      ],
      "signature_items": [
        "pariserbøf",
        "æggekage",
        "burger"
      ],
      "key_hours": {
        "lunch_service": "09:00-17:30",
        "bar_closing": "02:00 (weekends)"
      },
      "features": [
        "outdoor_seating_waterfront",
        "takeaway"
      ]
    }
  }
}
```

---

## 🚀 IMPLEMENTATION PHASES

### Phase 1: Core Persona Generation (Week 1)

**Deliverables:**
1. AI prompt for persona generation
2. Data aggregation logic (fetch business + location + programmes + menu)
3. City context generation with caching
4. Storage in layer_0_intelligence.business_identity
5. Validation tests

**Success Criteria:**
- Generates personas for test businesses (Cafe Faust, etc.)
- Passes quality checklist
- 100-150 word range
- Structured format

---

### Phase 2: Brand Profile Integration (Week 2)

**Deliverables:**
1. Update brand profile generation to USE persona as context
2. Include persona in commercial orientation prompts
3. Include persona in identity profile prompts
4. Include persona in voice profile prompts
5. Validate that brand profile builds ON persona

**Success Criteria:**
- All brand profile AI calls include persona
- Voice/tone generated matches business identity
- Positioning references business specifics
- Consistency across layers

---

### Phase 3: Content Generation Integration (Week 3)

**Deliverables:**
1. Update text generation to load persona
2. Update quick suggestions to use persona
3. Remove old generic prompts
4. Test content quality with new persona

**Success Criteria:**
- Generated content sounds like the BUSINESS wrote it
- Not like a consultant writing FOR the business
- Specific references to location, offerings, etc.

---

### Phase 4: Validation & Refinement (Week 4)

**Deliverables:**
1. Run validation queries across all businesses
2. Collect quality metrics (word count, structure, specificity)
3. Refine AI prompts based on results
4. Document best practices

---

## 📊 METRICS & MONITORING

### Quality Metrics:

**Persona Quality:**
- Average word count (target: 100-150)
- % with business name included (target: 100%)
- % with location signature (target: 100%)
- % with signature menu items (target: 90%+)
- % passing identity test (target: 95%+)

**Content Quality (After Integration):**
- User rating of generated content
- Specificity score (references to business details)
- Authenticity score (sounds like business vs consultant)

**System Performance:**
- Persona generation time (target: <3 seconds)
- Cache hit rate for city context (target: 80%+)
- API cost per persona (target: <$0.10)

---

## ⚠️ RISKS & MITIGATION

### Risk #1: Persona Too Generic

**Risk:** AI generates generic persona despite specific input

**Example:**
```
Du er et dansk restaurant ved vandet. Du serverer mad og drinks.
```
Instead of:
```
Du er Café Faust. Ved åen i Aarhus...
```

**Mitigation:**
- Include specific business name in prompt
- Require inclusion of signature menu items
- Validation check for specificity
- Reject and regenerate if too generic

---

### Risk #2: Persona Too Long

**Risk:** AI generates 300+ word persona despite 150 word limit

**Mitigation:**
- Explicit word count limit in prompt
- Truncation with warning if over limit
- Post-generation validation
- Iterative refinement if consistently over

---

### Risk #3: City Context Inaccurate

**Risk:** AI hallucinates city population or characteristics

**Example:** "Varde (150.000 indbyggere)" when it's actually 8,000

**Mitigation:**
- Use web search for city facts (optional)
- Manual validation for major cities
- Cache with 90-day expiry (allows corrections)
- User feedback mechanism to report errors

---

### Risk #4: Missing Business Data

**Risk:** Business has no menu items, no location signature, etc.

**Mitigation:**
- Graceful degradation (use what's available)
- Minimum viable persona: name + city
- Flag incomplete businesses for review
- Improve data quality over time

---

## 🎯 SUCCESS DEFINITION

**The new persona architecture is successful if:**

1. ✅ **Identity Test:**
   Generated content sounds like it's FROM the business, not ABOUT the business

2. ✅ **Specificity Test:**
   Persona includes business-specific details (name, location, signature items)

3. ✅ **Conciseness Test:**
   Persona stays within 100-150 words without losing essential information

4. ✅ **Scalability Test:**
   Works for any business in any city/country (via AI city generation)

5. ✅ **Consistency Test:**
   All brand profile layers build on the same persona foundation

6. ✅ **Quality Test:**
   Generated content quality improves measurably vs current generic approach

---

## 📋 NEXT STEPS

**Immediate (Before Coding):**
1. ✅ Review this plan with user
2. ✅ Validate architecture decisions
3. ✅ Confirm information hierarchy
4. ✅ Approve complexity constraints

**Implementation (After Approval):**
1. Build persona generation AI prompt
2. Build data aggregation logic
3. Build city context generation with caching
4. Test with Cafe Faust and other businesses
5. Validate quality against checklist
6. Integrate into brand profile generation
7. Integrate into content generation

---

**This plan defines WHAT to build and WHY, not HOW (that's code).**

**Ready for user review and approval before implementation.**
