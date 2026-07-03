## DATA FLOW CORRECTION: Location vs Demographics vs Programme Segments

### Issue Identified
The database has **THREE LAYERS of audience data** that were being mixed:

1. **Location Types** (from `business_location_intelligence.category_scores`):
   - waterfront, city_centre, residential, office, transport_hub, etc.
   - These describe the GEOGRAPHIC characteristics of the location

2. **Location Demographics** (also from `category_scores`):
   - student, tourist
   - These describe WHO the AREA attracts (not specific to programmes)

3. **Programme Segments** (from `business_programme_profiles.audienceSegments`):
   - Weekend-brunch-gæster, Frokost-pendlere, Date Night par, etc.
   - These describe WHO uses WHICH PROGRAMME WHEN for WHAT

**The bug:** Previous code mixed location types (waterfront) with demographics (student) in the same category.

---

## Café Faust Actual Data

### Layer 1: Location Intelligence
**From `business_location_intelligence.category_scores`:**

**Geographic Location Types:**
- **waterfront**: 95 score (PRIMARY - strategic driver)
- **city_centre**: 85 score (SECONDARY)

**Area Demographics:**
- **student**: 88 score (area attracts students - NOT a location type)
- **tourist**: XX score (area attracts tourists - NOT a location type)

**Correct Interpretation:**
```
LOCATION DRIVERS (where you are):
- Waterfront (95) → "Café ved åen" - this IS the location USP
- City Centre (85) → "Central café for shoppere og kulturfans"

AREA DEMOGRAPHICS (who the area attracts generally):
- Student (88) → Price-conscious market, casual accessibility needed
- Tourist (if present) → Visual appeal, location references needed
```

### Layer 2: Programme Segments
**From `business_programme_profiles` (user provided):**

**Brunch Programme:**
- Weekend-brunch-gæster (primary, social_gathering, spontaneous)
- Brunch-entusiaster (secondary, experience_seeking, spontaneous)
- Familier (secondary, social_gathering, spontaneous)

**Frokost Programme:**
- Frokost-pendlere (primary, convenience, spontaneous)
- Weekend-brunch-gæster (secondary, social_gathering, spontaneous)
- Frokost-venner (niche, social_gathering, spontaneous)

**Aften Programme:**
- Date Night par (primary, social_gathering, planned)
- Vennegruppe til middag (secondary, social_gathering, planned)

**Bar/Menukort Programme:**
- Weekend-gæster på jagt efter natteliv (primary, social_gathering, mixed)
- Efterarbejde-gæster (secondary, social_gathering, mixed)

**Key Insight:** Same business serves families at 10:00, office workers at 12:00, couples at 19:00, and nightlife seekers at 22:00. Tone must be VERSATILE.

### Layer 3: Menu Intelligence
**From `menu_overview_summary`:**
- Signature themes: (from actual menu analysis)
- Price range: 120-399 DKK
- Average price: ~180-200 DKK (moderate positioning)

### Layer 4: Owner Voice
**From `business_profiles.long_description`:**
"Café Faust tilbyder lækker brunch, solid frokost og delikate 3-retters menuer..."

**Linguistic Analysis:**
- Adjectives: "lækker", "solid", "delikate" (concrete, not hype)
- Register: Casual professional
- Structure: Simple, direct sentences

---

## Corrected Implementation

### 1. Data Separation (brand-profile-generator-v5/index.ts)

**BEFORE (Incorrect):**
```typescript
location_intelligence: {
  category_scores: location.category_scores  // Mixed location + demographics
}

demographic_signals: extractPrimaryDemographic(location.category_scores)  // Also mixed
```

**AFTER (Correct):**
```typescript
const LOCATION_TYPES = ['waterfront', 'city_centre', 'residential', 'office', 
                        'transport_hub', 'shopping_district', 'mixed_use', 
                        'destination', 'nature_park'];
const DEMOGRAPHIC_TYPES = ['student', 'tourist'];

const locationScores = Object.fromEntries(
  Object.entries(location.category_scores)
    .filter(([key]) => LOCATION_TYPES.includes(key))
);

const demographicScores = Object.fromEntries(
  Object.entries(location.category_scores)
    .filter(([key]) => DEMOGRAPHIC_TYPES.includes(key))
);

// Pass to tone DNA generation
location_intelligence: {
  category_scores: locationScores  // ONLY waterfront, city_centre
}

demographic_signals: extractPrimaryDemographic(demographicScores)  // ONLY student, tourist
```

### 2. Price Positioning Correction

**BEFORE:**
```typescript
if (avgPrice < 120) return 'value';      // 120 DKK = value
if (avgPrice < 180) return 'moderate';   // 180 DKK = moderate
```

**AFTER (Danish Market 2026):**
```typescript
if (avgPrice < 100) return 'budget';     // < 100 DKK
if (avgPrice < 150) return 'value';      // 100-150 DKK
if (avgPrice < 220) return 'moderate';   // 150-220 DKK ← Café Faust ~180-200
if (avgPrice < 350) return 'upscale';    // 220-350 DKK
return 'premium';                        // > 350 DKK
```

**For Café Faust (avg ~180-200 DKK):**
→ Price positioning: **moderate** (correct for quality casual dining)

---

## Expected Tone DNA Output for Café Faust

When you regenerate the brand profile, here's what the tone DNA SHOULD say:

### Strategic Recommendation for Multi-Programme Hybrid

**The Challenge:** One tone must work for:
- 09:00 Families with kids (Brunch)
- 12:00 Rushed office workers (Frokost pendlere)
- 19:00 Date night couples (Aften)
- 22:00 Weekend nightlife seekers (Bar)

**The Solution:** Identify the COMMON THREAD that works for ALL segments

```json
{
  "recommended_tone": {
    "tone_positioning": "Casual-warm med waterfront-fokus",
    "strategic_analysis": "Given waterfront position (95 score - strategic driver), casual dining identity (moderate price 180-200 DKK), student demographic appeal (88 area score), multi-programme hybrid model (brunch → frokost → aften → bar), and owner's concrete communication style ('lækker, solid, delikate'), the optimal tone is casual-warm with WATERFRONT EMPHASIS as common thread. This location USP works equally for brunch families (outdoor hygge), frokost pendlere (fresh air break), date night couples (romantic waterfront), and nightlife seekers (cocktails ved åen). Tone must be VERSATILE enough to span family-friendly at 10:00 and nightlife-vibrant at 22:00, anchored by consistent waterfront references.",
    "confidence": 90,
    "key_factors": [
      "Waterfront 95 score works for ALL programme segments (families → couples → nightlife)",
      "Moderate prisniveau (180-200 DKK) bridges brunch families and date night couples",
      "Student-demografi (88 area score) ensures accessible tone across all dayparts",
      "Ejerens register ('lækker, solid') unifies diverse content without pretention",
      "Multi-programme model requires VERSATILE tone with NON-NEGOTIABLE anchors"
    ],
    "versatility_requirement": "CRITICAL - same tone must work for brunch families AND bar nightlife"
  },
  
  "location_driver": {
    "primary_dimension": "waterfront",
    "score": 95,
    "strategic_importance": "critical",
    "tone_implications": [
      "Location er jeres primære USP - reference kraftigt i al kommunikation",
      "Visual language passer waterfront position (udsigt, åen, udeservering)",
      "Outdoor/seasonal framing naturlig for waterfront destination",
      "Bymidte (85) giver accessibility-angle for shoppere og kulturfans"
    ],
    "natural_vocabulary": [
      "ved åen",
      "udsigt",
      "udeservering",
      "vandkant",
      "central placering",
      "i hjertet af byen"
    ],
    "avoid_vocabulary": [
      "hyggelig indretning" (interior focus clasher med waterfront USP),
      "roligt kvarter" (I er central, ikke suburban)
    ]
  },
  
  "culinary_character": {
    "price_positioning": "moderate",
    "culinary_identity": "Casual dining med kvalitetsfokus",
    "signature_themes": ["Hjemmelavede specialiteter", "Europæisk-Amerikansk fusion"],
    "fusion_patterns": ["Fransk & Moderne Café", "Italiensk indflydelse"],
    "craft_signals": ["Hjemmelavet Nutella", "Egen granola", "Rillettes"],
    "tone_implications": [
      "Moderate price (180-200 DKK) = accessible quality, ikke budget eller premium",
      "Hjemmelavede specialiteter = craft-fokus uden pretention",
      "Fusion identity = eclectic references naturlige (ikke kulinarisk purisme)",
      "Casual dining = afslappet tone, men kvalitetsbevidst"
    ],
    "natural_vocabulary": [
      "lækker",
      "solid",
      "delikate",
      "hjemmelavet",
      "frisk",
      "kvalitet"
    ],
    "formality_requirement": "casual"
  },
  
  "owner_voice": {
    "register_level": "casual",
    "adjective_pattern": "Concrete quality descriptors (lækker, solid, delikate)",
    "sentence_structure": "Simple, direct - ingen komplekse sammensætninger",
    "example_phrases_from_om_os": [
      "lækker brunch",
      "solid frokost",
      "delikate 3-retters menuer",
      "fantastisk beliggenhed ved åen"
    ],
    "tone_implications": [
      "Ejerens natural register er casual-approachable, ikke formal eller literary",
      "Konkrete adjektiver (lækker, solid) ikke abstrakte (sublim, eksquisit, uforglemmelig)",
      "Direct framing - 'tilbyder X' ikke 'inviterer til en rejse gennem Y'",
      "Location pride ('fantastisk beliggenhed') viser awareness af USP"
    ],
    "voice_authenticity_note": "Brand voice SKAL matche ejerens naturlige register. Hvis ejer skriver 'lækker brunch', må AI IKKE upgrader til 'sublime morgenmadsoplevelse'. Autenticitet > marketing-teori."
  },
  
  "market_context": {
    "country": "Danmark",
    "cultural_norms": [
      "Jantelov-bevidsthed: Undgå superlatives og self-aggrandizing claims",
      "Konkret > abstrakt: Danske forbrugere foretrækker faktiske detaljer over poetisk sprog",
      "Ærlig kommunikation: 'Lækker brunch' slår 'kulinarisk oplevelse'"
    ],
    "competition_level": "high",
    "demographic_signals": {
      "primary_demographic": "student",
      "score": 88,
      "tone_implications": [
        "Prisbevidst målgruppe kræver tilgængelig tone (ikke exclusive)",
        "Casual, no-fuss kommunikation (ingen pretention)",
        "Værdifokus over premium-positionering"
      ]
    },
    "market_maturity": "mature",
    "strategic_positioning_need": "Differentiation through authentic waterfront positioning + craft focus"
  },
  
  "strategic_summary": "Given waterfront position (95 score - critical USP), moderate price positioning (180-200 DKK), casual dining identity with craft signals, student demographic appeal (88 score), and owner's concrete communication style, the optimal tone is casual-warm with strong waterfront emphasis. Lead with location visual references, match owner's unpretentious register ('lækker, solid'), and maintain accessible communication that respects student price-consciousness while highlighting quality and craft.",
  
  "tone_do_list": [
    "Reference waterfront position visuelt i al kommunikation (ved åen, udsigt, udeservering)",
    "Match ejerens konkrete stil: brug 'lækker, solid, delikate' - IKKE 'sublime, eksquisit, uforglemmelig'",
    "Casual register passer student-demografi (88 score) og moderate prisniveau",
    "Fremhæv håndværk (hjemmelavet Nutella, egen granola) uden fine-dining pretention",
    "Simpel, direkte sætningsstruktur (som ejerens 'tilbyder lækker brunch')",
    "Inkluderende sprog - waterfront appeal ≠ exclusive positioning",
    "Bymidte-accessibility for shoppere og kulturfans (sekundær location dimension)"
  ],
  
  "tone_dont_list": [
    "Undgå formal/fine-dining tone (clasher med casual positioning og moderate price)",
    "Undgå abstrakt/poetisk sprog ('kulinarisk rejse', 'gastronomisk oplevelse')",
    "Undgå hype-adjektiver der bryder owner voice ('fantastisk mad' → 'lækker mad')",
    "Undgå interior-fokus (furniture descriptions clasher med waterfront USP)",
    "Undgå exclusive framing (student-demografi kræver accessibility)"
  ],
  
  "confidence_score": 90,
  "expert_reasoning": "High confidence recommendation based on clear strategic hierarchy: waterfront position (95) is undeniable USP and must drive tone; moderate price + student area demo creates accessible-quality positioning; multi-programme hybrid model (brunch/frokost/aften/bar) requires VERSATILE tone with waterfront as common thread; owner voice provides authentic register benchmark ('lækker, solid'); Danish cultural norms support concrete over abstract. All dimensions align toward casual-warm waterfront-focused VERSATILE tone that works for families AND nightlife."
}
```

---

## Expected Enhanced Social Examples

The AI should generate 12-15 examples covering ALL programmes:

### BRUNCH Examples (3-4 stk)

```json
{
  "text": "Weekend brunch ved åen ☀️ Friskbagt croissant, cremet scrambled eggs og udsigt til vandet",
  "why_it_works": [
    "Waterfront reference (ved åen, udsigt) - common thread across all programmes",
    "Konkrete menu items (croissant, scrambled eggs) matcher owner voice",
    "Casual warm tone (weekend) passer familier + brunch-entusiaster",
    "Visual emoji (☀️) appellerer til tourist-demografi uden at ekskludere"
  ],
  "tone_elements_demonstrated": [
    "location_driver_waterfront",
    "owner_voice_concrete",
    "versatility_casual_warm",
    "programme_brunch"
  ],
  "content_type": "menu_item"
}
```

### FROKOST Examples (3-4 stk)

```json
{
  "text": "Hurtig frokost ved åen? 🥗 Frisk salat, sandwich og kaffe to-go – perfekt pause midt i dagen",
  "why_it_works": [
    "Speed focus (hurtig, to-go) matcher frokost-pendlere convenience motivation",
    "Waterfront hook (ved åen) giver outdoor lunch appeal",
    "Konkrete items (salat, sandwich) - no-fuss communication",
    "Casual register passer student area demografi OG office workers"
  ],
  "tone_elements_demonstrated": [
    "location_driver_waterfront",
    "programme_frokost_convenience",
    "demographic_student_accessible",
    "versatility_quick_casual"
  ],
  "content_type": "menu_item"
}
```

### AFTEN Examples (3-4 stk)

```json
{
  "text": "Date night ved åen 💕 3-retters menu, cocktails og romantisk udsigt – book dit bord",
  "why_it_works": [
    "Romantisk framing (date night, 💕) matcher aften date night par segment",
    "Waterfront USP (ved åen, romantisk udsigt) er date night selling point",
    "Planlagt framing (book dit bord) matcher planned decision-timing",
    "Forbliver casual-warm (ikke fine-dining pretention) - passer moderate price"
  ],
  "tone_elements_demonstrated": [
    "location_driver_waterfront",
    "programme_aften_date_night",
    "versatility_romantic_casual",
    "price_moderate_quality"
  ],
  "content_type": "invitation"
}
```

### BAR/MENUKORT Examples (3-4 stk)

```json
{
  "text": "Efter-arbejde drinks ved åen 🍹 Kom forbi kl. 16-18 for cocktails og solnedgang",
  "why_it_works": [
    "Targeterer efterarbejde-gæster segment specifikt",
    "Waterfront + timing (solnedgang) giver visual appeal",
    "Cocktail-fokus matcher bar/menukort programme",
    "Casual invitation (kom forbi) passer mixed decision-timing OG student accessibility"
  ],
  "tone_elements_demonstrated": [
    "location_driver_waterfront",
    "programme_bar_afterwork",
    "versatility_social_casual",
    "demographic_accessible"
  ],
  "content_type": "event"
},

{
  "text": "Weekend vibes ved åen 🌙 Cocktails, musik og natteliv – dine lørdag aftener starter her",
  "why_it_works": [
    "Targeterer weekend-gæster på jagt efter natteliv (primary bar segment)",
    "Waterfront reference (ved åen) selv i nightlife content - common thread",
    "Energetic tone (vibes, musik, natteliv) matcher nightlife motivation",
    "Forbliver inkluderende (ikke exclusive VIP framing) - student area demografi"
  ],
  "tone_elements_demonstrated": [
    "location_driver_waterfront",
    "programme_bar_nightlife",
    "versatility_energetic_inclusive",
    "market_context_danish_casual"
  ],
  "content_type": "atmosphere"
}
```

**Key Validation:** 
- ✅ All 4 programmes covered (Brunch, Frokost, Aften, Bar)
- ✅ Waterfront referenced in EVERY example (common thread)
- ✅ Tone shifts appropriately (warm for brunch → quick for frokost → romantic for aften → energetic for bar)
- ✅ All maintain casual register (never formal, never exclusive)
- ✅ Owner voice consistency (concrete descriptors across all)

---

## Implementation Summary

### Code Changes

**1. Data Separation** (brand-profile-generator-v5/index.ts lines ~800-850)
```typescript
const LOCATION_TYPES = ['waterfront', 'city_centre', 'residential', 'office', 
                        'transport_hub', 'shopping_district', 'mixed_use', 
                        'destination', 'nature_park'];
const DEMOGRAPHIC_TYPES = ['student', 'tourist'];

const locationScores = Object.fromEntries(
  Object.entries(location.category_scores)
    .filter(([key]) => LOCATION_TYPES.includes(key))
);

const demographicScores = Object.fromEntries(
  Object.entries(location.category_scores)
    .filter(([key]) => DEMOGRAPHIC_TYPES.includes(key))
);

// Pass to tone DNA with programme info for multi-programme coverage
toneDNA = await generateToneDNA({
  location_intelligence: { category_scores: locationScores },  // ONLY waterfront, city_centre
  demographic_signals: extractPrimaryDemographic(demographicScores),  // ONLY student, tourist
  // ... other inputs
});

// Pass programmes to examples generator
enhancedExamples = await generateEnhancedExamples(
  toneDNA,
  businessIdentityPersona,
  openai,
  language,
  programmeInfo  // NEW - ensures examples cover all dayparts
);
```

**2. Programme-Aware Examples** (tone-dna-generator.ts)
```typescript
export async function generateEnhancedExamples(
  toneDNA: V5ToneDNA,
  businessIdentityPersona: string,
  openaiClient: OpenAI,
  language: string = 'da',
  programmes?: Array<{ type, name, audienceSegments }>  // NEW PARAMETER
) {
  // Build programme context
  let programmeContext = '\n\nPROGRAMMES (dæk alle i eksemplerne):\n';
  programmes?.forEach(prog => {
    programmeContext += `- ${prog.name} → ${prog.audienceSegments.map(s => s.segment_name).join(', ')}\n`;
  });
  
  // Add to prompt so AI knows to cover all programmes
  prompt = prompt.replace(/{business_identity_persona}/g, 
    businessIdentityPersona + programmeContext);
}
```

**3. Prompt Updates** (v5-prompts.ts)
```
2. **VARIERER PROGRAMMES** (hvis multi-programme business)
   Hvis forretningen har brunch + frokost + aften + bar/menukort:
   → Dæk ALLE programmes i eksemplerne
   → Vær VERSATIL: samme tone skal fungere for brunch-familier, frokost-pendlere, date night par, nightlife-gæster
   → Location driver (waterfront) er FÆLLES TRÅD på tværs af dayparts
   
   Eksempel fordeling for 4-programme hybrid:
   - Brunch: 3 eksempler (families, weekend hygge, smagsoplevelser)
   - Frokost: 3 eksempler (hurtig frokost, social lunch, take-away)
   - Aften: 3 eksempler (date night, vennegrupper, cocktails)
   - Bar/Drinks: 3 eksempler (afterwork, weekend natteliv, cocktail focus)
```

---

## Validation Checklist

Run `_verify_cafe_faust_data_for_tone_dna.sql` to confirm:

- [ ] `category_scores` has waterfront ~95, city_centre ~85
- [ ] `category_scores` has student ~88 (demographic)
- [ ] `overall_avg_price` is in 180-200 DKK range
- [ ] `long_description` (Om Os) contains "lækker brunch, solid frokost"
- [ ] `signature_themes` includes actual menu themes
- [ ] `local_location_reference` is "ved åen"

Then regenerate brand profile and verify tone DNA matches expected output above.
