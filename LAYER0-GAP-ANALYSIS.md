# LAYER 0 PERSONA - GAP ANALYSIS & TIMING ASSESSMENT
**Date:** 2025-05-20  
**Purpose:** Assess coverage gaps and timing of persona population  
**Status:** Critical Issues Identified - Action Plan Needed

---

## 🚨 ISSUE 1: MISSING CITIES (Critical Gap)

### Currently Defined Cities (Only 5)

| City | Population | Size Category | Coverage |
|------|------------|---------------|----------|
| København | 800,000 | capital | ✅ |
| Aarhus | 350,000 | medium_city | ✅ |
| Odense | 180,000 | medium_city | ✅ |
| Aalborg | 120,000 | medium_city | ✅ |
| Varde | 8,000 | small_town | ✅ |

**Total Coverage:** 5 cities

---

### Missing Major Cities (Critical)

**Medium Cities (50,000-200,000):**
- ❌ Kolding (95,000)
- ❌ Esbjerg (72,000)
- ❌ Randers (64,000)
- ❌ Horsens (62,000)
- ❌ Vejle (60,000)
- ❌ Roskilde (52,000)
- ❌ Herning (51,000)
- ❌ Silkeborg (50,000)
- ❌ Næstved (44,000)
- ❌ Fredericia (42,000)

**Copenhagen Suburbs (Important for market):**
- ❌ Frederiksberg (105,000) - technically part of Copenhagen but distinct
- ❌ Gentofte (75,000)
- ❌ Gladsaxe (70,000)
- ❌ Lyngby-Taarbæk (58,000)
- ❌ Hvidovre (53,000)

**Tourist/Cultural Cities:**
- ❌ Helsingør (63,000) - Hamlet's castle, tourist heavy
- ❌ Hillerød (36,000)
- ❌ Svendborg (27,000)
- ❌ Ribe (8,200) - Denmark's oldest town

**Small Towns (10,000-40,000):**
- ❌ Skagen
- ❌ Ebeltoft
- ❌ Tønder
- ❌ Ringkøbing
- ❌ Fanø

---

### What Happens for Missing Cities?

**Fallback Behavior:**
```typescript
// If city not found in DANISH_CITY_PROFILES
return {
  city: determinedCity || 'Unknown',  // e.g., "Kolding"
  country: 'Danmark',
  size_category: 'medium_city',       // ← GENERIC
  population: 0,                      // ← NO DATA
  characteristics: [],                 // ← EMPTY
  tone_guidance: 'Standard professional tone',  // ← GENERIC
  competition_level: 'medium',        // ← GUESS
  cultural_context: 'No specific city context available'  // ← USELESS
}
```

**Example: Kolding (95,000 inhabitants)**
```
CURRENT OUTPUT (Generic):
─────────────────────────
City: Kolding
Population: 0
Tone guidance: "Standard professional tone"
Cultural context: "No specific city context available"

SHOULD BE (If defined):
───────────────────────
City: Kolding
Population: 95,000
Tone guidance: "Sydvestjysk by med erhvervsliv og familie-fokus. Balance mellem professionel og personlig. Regional stolthed."
Cultural context: "Sydvestjyllands centrum, erhvervsby med familiefokus, tæt på Vejle og grænsen"
```

---

### Impact Assessment

**Severity:** 🔴 HIGH

**Problems:**
1. ❌ Most Danish cities get generic, useless tone guidance
2. ❌ No population data (can't assess market size)
3. ❌ No competition level (can't guide strategy)
4. ❌ No cultural context (can't tailor messaging)
5. ❌ Persona quality degrades significantly outside 5 major cities

**Example Businesses Affected:**
- Restaurant in Kolding → Generic "medium_city" persona
- Cafe in Helsingør → No tourist-heavy context
- Bakery in Skagen → No seasonal/tourist guidance
- Wine bar in Roskilde → No university town context

---

### Recommendation: URGENT EXPANSION NEEDED

**Priority 1 (Add immediately):**
1. Kolding (95k) - Sydvestjylland's business hub
2. Esbjerg (72k) - West coast, offshore industry
3. Randers (64k) - East Jutland
4. Horsens (62k) - Festival city, younger demographic
5. Vejle (60k) - Triangle region hub
6. Roskilde (52k) - University town, cultural heritage
7. Helsingør (63k) - Tourist heavy, castle town
8. Frederiksberg (105k) - Copenhagen but distinct culture

**Priority 2 (Add next):**
- Remaining cities 30k-50k
- Key tourist destinations
- Copenhagen suburbs

**Priority 3 (Long term):**
- Small towns with distinct character
- Generic fallbacks by region (Jylland, Fyn, Sjælland)

---

## 🚨 ISSUE 2: MISSING BUSINESS TYPES (Moderate Gap)

### Currently Defined Types (Only 10)

| Business Type | Coverage |
|---------------|----------|
| hybrid_cafe | ✅ |
| restaurant | ✅ (generic) |
| fine_dining | ✅ |
| coffee_bar | ✅ |
| wine_bar | ✅ |
| cocktail_bar | ✅ |
| bakery_cafe | ✅ |
| casual_dining | ✅ |
| bistro | ✅ |
| pub | ✅ |

**Total Coverage:** 10 types

---

### Missing Business Types (Important)

**Cuisine-Specific (High Priority):**
- ❌ italian_restaurant (pizza, pasta, trattoria)
- ❌ sushi_restaurant
- ❌ asian_fusion
- ❌ thai_restaurant
- ❌ chinese_restaurant
- ❌ burger_bar (not casual dining - specialized)
- ❌ steakhouse
- ❌ tapas_bar (Spanish small plates)
- ❌ greek_restaurant
- ❌ indian_restaurant

**Hybrid Concepts:**
- ❌ coffee_and_wine_bar (your specific example!)
- ❌ cafe_bar (coffee by day, drinks by night)
- ❌ brunch_specialist
- ❌ breakfast_cafe (not full cafe)

**Specialized:**
- ❌ vegan_cafe / vegetarian_restaurant
- ❌ organic_restaurant
- ❌ food_truck
- ❌ pop_up_restaurant
- ❌ catering_kitchen
- ❌ deli_shop_with_cafe

**Fast Casual:**
- ❌ sandwich_shop
- ❌ salad_bar
- ❌ poke_bowl_bar
- ❌ smoothie_bar

---

### What Happens for Missing Types?

**Fallback Behavior:**

**Example: Italian Restaurant**
```
DETECTION LOGIC:
─────────────────
Menu has: "pizza", "pasta", "carbonara", "tiramisu"
Programmes: lunch, dinner
Establishment type: not set

CURRENT RESULT:
───────────────
Type: casual_dining  // ← GENERIC
Confidence: 0.7
Reasoning: "Frokost/middag program uden morgenmad"
Professional domain: "casual dining og everyday restaurants"

PERSONA ASSIGNED:
─────────────────
"Du er en professionel social media manager specialiseret i casual dining..."
// ← NOT specialized in Italian cuisine marketing!

SHOULD BE:
──────────
Type: italian_restaurant
Confidence: 0.9
Reasoning: "Italian menu items (pizza, pasta, carbonara) throughout menu"
Professional domain: "italiensk køkken og autentisk italiensk dining"

PERSONA:
────────
"Du er en professionel social media manager specialiseret i italiensk restaurantmarketing.

Du har ekspertise i:
- Italian cuisine storytelling (pasta-håndværk, pizza-tradition)
- Authenticity vs accessibility balance
- Regional Italian cuisine differentiation
- Italian dining culture communication

Du ved at for italiensk restaurant:
- Authenticity skal kommunikeres (fresh pasta, Italian ingredients)
- Men ikke alienere danske gæster (tilgængelighed)
- Italian food culture (slow food, family-style, passion)
- Menu storytelling (regional dishes, nonna's recipes)"
```

---

### Impact Assessment

**Severity:** 🟡 MEDIUM-HIGH

**Problems:**
1. ⚠️ Cuisine-specific restaurants get generic persona
2. ⚠️ No specialized expertise (Italian food culture, sushi presentation, etc.)
3. ⚠️ Voice rules not tailored (Italian warmth vs Japanese precision)
4. ⚠️ Content focus misses key opportunities (pasta-making, sushi craftsmanship)

**Example Businesses Affected:**
- Italian restaurant in Aarhus → Gets "casual dining" not "Italian specialist"
- Coffee & wine bar → Doesn't fit any category, falls to "restaurant"
- Sushi restaurant → No Japanese aesthetic guidance
- Burger bar → Lumped with "casual dining" not burger specialist

---

### Recommendation: EXPAND BUSINESS TYPES

**Priority 1 (Add immediately):**
1. italian_restaurant - Very common in Denmark
2. coffee_and_wine_bar - Hybrid concept growing
3. sushi_restaurant - Distinct presentation style
4. burger_bar - Not generic casual dining
5. asian_fusion - Common in cities

**Priority 2 (Add next):**
- thai_restaurant
- steakhouse
- tapas_bar
- vegan_cafe
- breakfast_cafe

**Priority 3 (Long term):**
- All remaining cuisine types
- Specialized concepts
- Food trucks and pop-ups

---

## ⏰ ISSUE 3: WHEN DOES PERSONA GET POPULATED?

### Current Flow Analysis

```
BRAND PROFILE GENERATION V5 - COMPLETE SEQUENCE
════════════════════════════════════════════════

STEP 0: Request Received
─────────────────────────
Input: { businessId, forceRegenerate }
↓

STEP 1: Data Fetch (Lines 90-240)
──────────────────────────────────
Fetch from database:
- ✅ Business data (businesses table)
- ✅ Location data (business_locations - postal_code, city)
- ✅ Menu items (menu_items_normalized)
- ✅ Menu extractions (menu_results_v2)
- ✅ Location intelligence (business_location_intelligence)
- ✅ Opening hours (opening_hours)
- ✅ Legacy voice data (business_brand_profile)

Output: All raw business data loaded
↓

STEP 2: Programme Detection (Lines 240-268)
────────────────────────────────────────────
Detect programmes from:
- Opening hours patterns
- Menu item analysis
- Menu extraction results

Output: programmes[] = [breakfast, lunch, dinner, bar...]
↓

STEP 2.5: LAYER 0 - BUSINESS INTELLIGENCE ← PERSONA POPULATED HERE
───────────────────────────────────────────────────────────────────
(Lines 269-322)

SUB-STEP 2.5.1: Detect Business Type
───────────────────────
Input:  programmes[], menu_text, establishment_type
Logic:  detectBusinessType()
Output: businessTypeDetection = {
          type: "casual_dining",
          confidence: 0.7,
          reasoning: "Frokost/middag program..."
        }

SUB-STEP 2.5.2: Enrich Geographic Context
────────────────────────────────────
Input:  postalCode, city, local_location_reference
Logic:  enrichGeographicContext()
Output: geographicContext = {
          city_profile: { city, population, tone_guidance... },
          location_context: { type, signature, advantages... },
          narrative: "GEOGRAFISK CONTEXT: By: Aarhus..."
        }

SUB-STEP 2.5.3: Assign Professional Persona  ← THIS IS THE PERSONA
──────────────────────────────────────────
Input:  businessType, city_profile
Logic:  getProfessionalPersona()
Output: professionalPersona = {
          system_persona: "Du er en professionel...",
          expertise_areas: [...],
          tone_defaults: { formality, sentence_style, emoji }
        }

SUB-STEP 2.5.4: Get Voice Archetype
──────────────────────────────
Input:  businessType, location_type, city_size
Logic:  getVoiceArchetype()
Output: voiceArchetype = {
          archetype_name: "restaurant_approachable",
          base_rules: [6 Danish rules],
          formality_level: "casual_friend"
        }

LAYER 0 COMPLETE ✅
Persona now exists in memory (not yet stored)
↓

STEP 3: Commercial Orientation (Lines 323-450)
───────────────────────────────────────────────
For each programme:
- Generate commercial orientation (AI call)
- Uses businessType from Layer 0
- Uses geographicContext from Layer 0

Input from Layer 0: businessType, geographicContext
Output: commercialOrientation per programme
↓

STEP 4: Identity Profile (Lines 451-520)
─────────────────────────────────────────
Generate business identity (AI call)
- Menu analysis
- Atmosphere description
- Value proposition

Input from Layer 0: NOT USED (should be!)
Output: identityProfile
↓

STEP 5: Audience Segments (Lines 521-590)
──────────────────────────────────────────
For each programme:
- Generate audience profile (AI call)

Input from Layer 0: businessType, geographicContext
Output: audienceProfile per programme
↓

STEP 6: Voice Profile (Lines 591-650)
──────────────────────────────────────
Generate voice guidelines (AI call)

Input from Layer 0: voiceArchetype, professionalPersona
Output: voiceProfile with structural/style/tone rules
↓

STEP 7: Writing Examples (Lines 651-670)
─────────────────────────────────────────
Generate example content (AI call)

Input from Layer 0: professionalPersona, voiceArchetype
Output: 3 writing examples
↓

STEP 8: Guardrails (Lines 671-690)
───────────────────────────────────
Generate content guardrails (AI call)

Input from Layer 0: voiceArchetype
Output: do's and don'ts
↓

STEP 9: STORE EVERYTHING (Lines 691-850)
─────────────────────────────────────────
Save to database:
- business_brand_profile table:
  - brand_profile_v5 (includes Layer 0 intelligence) ← PERSONA STORED HERE
  - positioning (identity profile)
  - brand_profile_v5_generated_at
  
- business_programme_profiles table:
  - One row per programme
  - commercial_orientation
  - audience_profile

LAYER 0 NOW IN DATABASE ✅
↓

STEP 10: Response
─────────────────
Return success message
```

---

### When Persona Gets Populated - Detailed Timeline

| Step | What Happens | Persona Status | Line # |
|------|-------------|----------------|--------|
| **0. Request** | Function called with businessId | ❌ Not created | 47 |
| **1. Data Fetch** | Load business, menu, location data | ❌ Not created | 90-240 |
| **2. Programme Detection** | Detect breakfast/lunch/dinner/bar | ❌ Not created | 240-268 |
| **2.5.1 Business Type** | detectBusinessType() | 🟡 Type detected | 271-280 |
| **2.5.2 Geographic Context** | enrichGeographicContext() | 🟡 Geography ready | 283-298 |
| **2.5.3 Persona** | getProfessionalPersona() | ✅ **CREATED IN MEMORY** | 301-310 |
| **2.5.4 Voice Archetype** | getVoiceArchetype() | ✅ Voice rules ready | 313-322 |
| **3. Commercial** | Generate commercial orientation | ✅ Uses persona | 323-450 |
| **4. Identity** | Generate identity profile | ⚠️ Should use, doesn't | 451-520 |
| **5. Audience** | Generate audience profiles | ✅ Uses persona | 521-590 |
| **6. Voice** | Generate voice profile | ✅ Uses persona | 591-650 |
| **7. Examples** | Generate writing examples | ✅ Uses persona | 651-670 |
| **8. Guardrails** | Generate guardrails | ✅ Uses persona | 671-690 |
| **9. Store** | Save to database | ✅ **STORED IN DB** | 691-850 |

---

### Your Assessment vs Reality

**Your Opinion:**
> "It should in my opinion be just before Brand Profile is generated, but after profile, menu and location."

**Current Reality:**
✅ **YOU ARE CORRECT - That's exactly where it is!**

**Timeline:**
```
AFTER:
├─ Business data loaded ✅
├─ Menu data loaded ✅
├─ Location data loaded ✅
└─ Programme detection ✅

[PERSONA CREATED HERE] ← Step 2.5

BEFORE:
├─ Commercial orientation generation
├─ Identity profile generation
├─ Audience profile generation
├─ Voice profile generation
└─ Final brand profile assembly
```

**However, there's a semantic confusion:**

**"Brand Profile Generation" could mean:**
1. ✅ The entire function (brand-profile-generator-v5)
2. ✅ Generating brand profile content (Steps 3-8)
3. ❌ Only Step 4 "Identity Profile" generation

**Persona is created:**
- ✅ AFTER all data is fetched (Step 1)
- ✅ AFTER programmes are detected (Step 2)
- ✅ BEFORE brand content is generated (Steps 3-8)
- ✅ BEFORE final storage (Step 9)

**Your intuition is correct!** ✅

---

### Potential Improvement: Earlier Usage

**Current Issue:**
Persona is created at Step 2.5 but some later steps don't use it fully.

**Example - Step 4 (Identity Profile):**
```typescript
// CURRENT: Step 4 - Identity Profile Generation
// Does NOT use professionalPersona in the AI prompt
// Uses generic identity profile prompt instead

// SHOULD DO:
const identityPrompt = `
${professionalPersona.system_persona}

CURRENT TASK: Analyze menu and generate identity profile...
`
```

**Recommendation:**
Once persona is created (Step 2.5), ALL subsequent AI calls (Steps 3-8) should include it in their system prompts.

---

## 📊 OVERALL ASSESSMENT

### Severity Matrix

| Issue | Severity | Impact | Urgency |
|-------|----------|--------|---------|
| **Missing Cities** | 🔴 HIGH | Most businesses get generic tone | URGENT |
| **Missing Business Types** | 🟡 MEDIUM | Some businesses get wrong specialty | HIGH |
| **Persona Timing** | 🟢 LOW | Already correct, minor improvements | LOW |

---

### Gap Summary

**Cities:**
- ✅ Defined: 5 cities
- ❌ Missing: ~30+ important Danish cities
- 🔴 Impact: 80%+ of Danish businesses get generic fallback

**Business Types:**
- ✅ Defined: 10 types
- ❌ Missing: ~25+ common types (Italian, sushi, coffee+wine, etc.)
- 🟡 Impact: 40%+ of businesses get wrong specialty

**Timing:**
- ✅ Persona created at correct time (after data, before generation)
- ✅ Used in most AI calls
- 🟡 Improvement: Use in ALL AI calls consistently

---

## 📋 ACTION PLAN

### Phase 1: CRITICAL (Do This Week)

**1. Add Top 10 Missing Cities**
```
Priority Cities to Add:
1. Kolding (95k)
2. Esbjerg (72k)  
3. Randers (64k)
4. Horsens (62k)
5. Vejle (60k)
6. Roskilde (52k)
7. Helsingør (63k)
8. Frederiksberg (105k)
9. Herning (51k)
10. Silkeborg (50k)
```

**Effort:** 2-3 hours (research + write profiles)
**Impact:** Covers additional 600k+ population

---

**2. Add Top 5 Missing Business Types**
```
Priority Types to Add:
1. italian_restaurant
2. coffee_and_wine_bar (your example!)
3. sushi_restaurant
4. burger_bar
5. asian_fusion
```

**Effort:** 3-4 hours (write personas + detection logic)
**Impact:** Covers most common specialty types

---

### Phase 2: IMPORTANT (Do Next Week)

**3. Add Next 15 Cities**
- All cities 40k-90k population
- Key tourist destinations
- Copenhagen suburbs

**4. Add Next 10 Business Types**
- Thai, steakhouse, tapas, vegan
- Breakfast cafe, brunch specialist
- Fast casual types

**5. Improve Persona Usage**
- Ensure ALL AI calls (Steps 3-8) use professionalPersona
- Add persona to Identity Profile generation (Step 4)
- Consistency check across all prompts

---

### Phase 3: COMPREHENSIVE (Do This Month)

**6. Regional Fallbacks**
Instead of generic "medium_city", create regional fallbacks:
- Jylland (West, East, South, North)
- Fyn
- Sjælland (excluding Copenhagen)
- Bornholm

**7. Size-Based Fallbacks**
If city not found, use population size:
- 100k-300k: "Larger regional city" profile
- 40k-100k: "Medium regional city" profile
- 10k-40k: "Small town" profile
- <10k: "Village/rural" profile

**8. Complete Business Type Coverage**
Add all remaining types and create detection logic for:
- All major cuisines
- All hybrid concepts
- All specialized formats

---

## ✅ ANSWERS TO YOUR QUESTIONS

### 1. What if the town is Kolding, Aalborg, Helsingør etc.?

**Current State:**
- ✅ Aalborg is defined (120k population)
- ❌ Kolding gets generic fallback (population: 0, tone: "Standard professional tone")
- ❌ Helsingør gets generic fallback (no tourist-heavy context)

**Impact:**
- Business in Kolding gets useless geographic persona
- Business in Helsingør misses tourist/cultural context

**Solution:**
Add these cities to DANISH_CITY_PROFILES in geographic-context.ts

**Example for Kolding:**
```typescript
'Kolding': {
  city: 'Kolding',
  population: 95000,
  size_category: 'medium_city',
  characteristics: ['business_hub', 'south_jutland', 'family_oriented'],
  tone_guidance: 'Professionel men tilgængelig. Erhvervsby med familiefokus. Balance mellem business og casual.',
  competition_level: 'medium',
  cultural_context: 'Sydvestjyllands største by, erhvervscentrum, tæt på grænsen'
}
```

---

### 2. What if it is coffee bar, Italian restaurant, coffee and wine bar?

**Current State:**
- ✅ Coffee bar is defined (type: 'coffee_bar')
- ❌ Italian restaurant gets generic 'casual_dining' or 'restaurant'
- ❌ Coffee and wine bar doesn't fit any type, falls to generic

**Impact:**
- Italian restaurant gets wrong persona (no Italian cuisine expertise)
- Coffee & wine bar gets wrong persona (not hybrid concept)

**Solution:**
Add new business types to business-type-detection.ts

**Example Detection for Italian:**
```typescript
// In detectBusinessType()
if (
  menuLower.match(/pizza|pasta|carbonara|tiramisu|parmigiana|bruschetta|risotto/) &&
  (programmes.includes('lunch') || programmes.includes('dinner'))
) {
  return {
    type: 'italian_restaurant',
    confidence: 0.85,
    reasoning: 'Italian menu items (pizza, pasta) throughout menu',
    professional_domain: 'italiensk køkken og autentisk italiensk dining'
  }
}
```

**Example for Coffee & Wine Bar:**
```typescript
if (
  menuLower.match(/espresso|flat white|cortado/) &&
  menuLower.match(/vin|wine|rosé/) &&
  programmes.includes('breakfast') &&
  programmes.includes('bar')
) {
  return {
    type: 'coffee_and_wine_bar',
    confidence: 0.8,
    reasoning: 'Both coffee specialties and wine program - hybrid concept',
    professional_domain: 'hybrid kaffe og vin koncepter'
  }
}
```

---

### 3. Where does the persona sit/being populated?

**Answer:**
Persona is created in **STEP 2.5 (Layer 0 - Business Intelligence)**

**Location in code:**
`brand-profile-generator-v5/index.ts` Lines 269-322

**Timeline:**
```
STEP 1: Data Fetch (lines 90-240)
        ↓
STEP 2: Programme Detection (lines 240-268)
        ↓
STEP 2.5: LAYER 0 - BUSINESS INTELLIGENCE (lines 269-322)
          ├─ Detect business type
          ├─ Enrich geographic context
          ├─ GET PROFESSIONAL PERSONA ← HERE
          └─ Get voice archetype
        ↓
STEP 3+: Use persona in content generation
```

---

### 3.1. Should it be after profile, menu, location?

**Answer:**
✅ **YES, and that's exactly where it is!**

**Current sequence:**
```
✅ Fetch business profile (Step 1)
✅ Fetch menu data (Step 1)
✅ Fetch location data (Step 1)
✅ Detect programmes from data (Step 2)
   ↓
✅ CREATE PERSONA HERE (Step 2.5)
   ↓
✅ Use persona for brand profile content generation (Steps 3-8)
```

**Your intuition is correct!** The persona needs:
- Business data (to understand type)
- Menu data (to detect cuisine/offering)
- Location data (to get geographic context)

And it gets all of that in Step 1 before being created in Step 2.5.

**Minor improvement opportunity:**
Ensure ALL subsequent steps (3-8) use the persona consistently in their AI prompts. Currently some steps use it, others don't fully integrate it.

---

## 🎯 RECOMMENDATIONS

### Immediate Actions (This Week)

1. **Add 10 Priority Cities** (2-3 hours)
   - Write city profiles for Kolding, Esbjerg, Randers, etc.
   - Test with real businesses in these cities
   - Verify tone guidance quality

2. **Add 5 Priority Business Types** (3-4 hours)
   - italian_restaurant
   - coffee_and_wine_bar
   - sushi_restaurant
   - burger_bar
   - asian_fusion
   - Write personas for each
   - Update detection logic

3. **Document Gap** (DONE)
   - This document serves as gap analysis ✅
   - Share with team for review
   - Prioritize expansion roadmap

---

### Strategic Improvements (This Month)

1. **City Coverage Target: 30+ cities**
   - Cover 90% of Danish population
   - Include all cities > 40k
   - Include key tourist destinations

2. **Business Type Coverage Target: 30+ types**
   - All major cuisines
   - All hybrid concepts
   - All specialized formats

3. **Fallback System**
   - Regional profiles (Jylland, Fyn, Sjælland)
   - Size-based profiles (if city unknown)
   - Better than current generic fallback

4. **Quality Validation**
   - Run validation queries (VALIDATE-LAYER0-QUALITY.sql)
   - Test persona quality across all types
   - Ensure consistency

---

## 📚 RELATED FILES

- **[PERSONA-ARCHITECTURE.md](PERSONA-ARCHITECTURE.md)** - How persona system works
- **[LAYER0-LANGUAGE-AUDIT.md](LAYER0-LANGUAGE-AUDIT.md)** - Language consistency
- **[USER-CONCERNS-ADDRESSED.md](USER-CONCERNS-ADDRESSED.md)** - Previous Q&A
- **[README-LAYER0.md](README-LAYER0.md)** - Overview

**Code Files to Update:**
- `supabase/functions/_shared/brand-profile/geographic-context.ts` - Add cities
- `supabase/functions/_shared/brand-profile/business-type-detection.ts` - Add types
- `supabase/functions/_shared/brand-profile/professional-persona.ts` - Add personas
- `supabase/functions/_shared/brand-profile/voice-archetypes.ts` - Add voice rules

---

**SUMMARY:**
1. ❌ Cities: Only 5 defined, need 30+ (URGENT)
2. ❌ Business Types: Only 10 defined, need 30+ (HIGH PRIORITY)
3. ✅ Timing: Already correct, persona created at right time (GOOD)

**NEXT:** Review this gap analysis and decide on expansion priority ✅
