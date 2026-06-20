# Tone DNA for Multi-Programme Hybrid Businesses

## The Challenge: Café Faust Case Study

**Business Model:** Hybrid cafe/restaurant/bar with 4 distinct programmes
- **09:00-14:00 Brunch**: Families, Weekend-brunch-gæster, Brunch-entusiaster
- **12:00-15:00 Frokost**: Frokost-pendlere, Weekend-brunch-gæster, Frokost-venner
- **17:30-21:30 Aften**: Date Night par, Vennegrupper
- **16:00-23:00 Bar/Menukort**: Weekend nightlife, Efterarbejde drinks

**The Tone Problem:**
- Same brand needs to appeal to families at 10:00 AND nightlife seekers at 22:00
- One tone of voice must work for hurried office workers (frokost) AND leisurely date night couples (aften)

---

## How Tone DNA Solves This

### 1. Two Layers of Demographics

**Layer A: Location Demographics** (from `business_location_intelligence.category_scores`)
```
student: 88    → Location attracts students (affects PRICING + FORMALITY)
tourist: XX    → Location attracts tourists (affects REFERENCES + LANGUAGE)
```

These are **environmental factors** that influence the overall business positioning:
- Student presence → Casual tone, accessible pricing, no pretention
- Tourist presence → Visual hooks, location references, international-friendly

**Layer B: Programme Segments** (from `business_programme_profiles.audienceSegments`)
```
Brunch:
  - Weekend-brunch-gæster (social_gathering, spontaneous)
  - Brunch-entusiaster (experience_seeking, spontaneous)
  - Familier (social_gathering, spontaneous)

Frokost:
  - Frokost-pendlere (convenience, spontaneous)
  - Weekend-brunch-gæster (social_gathering, spontaneous)
  - Frokost-venner (social_gathering, spontaneous)

Aften:
  - Date Night par (social_gathering, planned)
  - Vennegruppe til middag (social_gathering, planned)

Bar/Menukort:
  - Weekend-gæster på jagt efter natteliv (social_gathering, mixed)
  - Efterarbejde-gæster (social_gathering, mixed)
```

These are **use case specific** - WHO comes WHEN for WHAT.

---

### 2. The Common Thread Strategy

**For multi-programme businesses, the tone DNA identifies the COMMON THREAD across all segments:**

**Café Faust Example:**

**Common Thread = Waterfront Position (95 score)**

```
TONE DNA OUTPUT:
{
  "recommended_tone": {
    "tone_positioning": "Casual-warm med waterfront-fokus",
    "strategic_analysis": "Waterfront position (95 score) is the PRIMARY USP that works across ALL dayparts. Brunch families want 'ved åen' hygge, frokost pendlere want quick lunch med udsigt, date night couples want romantic waterfront dinner, nightlife seekers want cocktails by the water. The location is the constant - tone must anchor here while remaining VERSATILE enough for diverse segments.",
    "key_factors": [
      "Waterfront 95 score works for ALL programmes (families → couples → nightlife)",
      "Moderate price + casual register works for student-demografi AND date night",
      "Owner's concrete style ('lækker, solid') unifies dayparts"
    ]
  },
  
  "location_driver": {
    "primary_dimension": "waterfront",
    "score": 95,
    "versatility_note": "Location USP works equally for brunch families (outdoor hygge), frokost pendlere (fresh air lunch break), date night couples (romantic waterfront), nightlife (cocktails ved åen). This is WHY it's the common thread.",
    "tone_implications": [
      "ALWAYS reference location across all content (ved åen, udsigt, vandkant)",
      "Visual language works for ALL segments (outdoor appeal universal)",
      "Location hook is the ONE THING that unifies diverse dayparts"
    ]
  },
  
  "versatility_requirements": {
    "why_needed": "Hybrid business serves radically different audiences (families at 10:00, nightlife at 22:00)",
    "common_denominators": [
      "Waterfront position (works for everyone)",
      "Casual register (accessible to students, appropriate for date night)",
      "Concrete descriptors (owner voice matches both brunch and bar content)",
      "Quality focus (moderate pricing signals effort across all programmes)"
    ],
    "flexibility_zones": [
      "Formality can shift slightly (more playful for bar, more warm for brunch)",
      "Vocabulary adjusts (brunch → 'hygge', bar → 'cocktails', aften → 'romantisk')",
      "Energy level varies (calm brunch vs lively nightlife)"
    ],
    "non-negotiables": [
      "Location reference in 80%+ of content",
      "Owner voice register (casual, concrete - never formal or abstract)",
      "Inclusive accessibility (student-demografi prevents exclusive tone)"
    ]
  }
}
```

---

### 3. Enhanced Examples: Programme Coverage

**The AI generates 12-15 examples that MUST cover all programmes:**

```json
{
  "social_examples": [
    // BRUNCH (3 eksempler)
    {
      "text": "Weekend brunch ved åen ☀️ Friskbagt croissant, cremet scrambled eggs og udsigt til vandet",
      "why_it_works": [
        "Waterfront reference (ved åen, udsigt til vandet) - location driver",
        "Konkrete menu items (croissant, scrambled eggs) - owner voice",
        "Casual warm tone (weekend hygge) - passer familier + entusiaster",
        "Visual appeal (☀️ emoji) - turistvenlighed"
      ],
      "tone_elements_demonstrated": ["location_driver_waterfront", "owner_voice_concrete", "versatility_casual_warm"],
      "content_type": "menu_item",
      "programme": "brunch"
    },
    
    // FROKOST (3 eksempler)
    {
      "text": "Hurtig frokost ved åen? Frisk salat, sandwich og kaffe to-go – perfekt til din pause 🥗",
      "why_it_works": [
        "Speedfokus (hurtig, to-go) matcher frokost-pendlere convenience-motivation",
        "Waterfront hook (ved åen) giver outdoor lunch appeal",
        "Konkrete items (salat, sandwich, kaffe) - no-fuss",
        "Casual register passer student-demografi"
      ],
      "tone_elements_demonstrated": ["location_driver_waterfront", "demographic_student_casual", "programme_frokost_convenience"],
      "content_type": "menu_item",
      "programme": "frokost"
    },
    
    // AFTEN (3 eksempler)
    {
      "text": "Date night ved åen 💕 3-retters menu, cocktails og romantisk udsigt – book dit bord nu",
      "why_it_works": [
        "Romantisk framing (date night, 💕) matcher aften-segment",
        "Waterfront USP (ved åen, romantisk udsigt) er date night-selling point",
        "Planlagt framing (book dit bord) matcher planned decision-timing",
        "Forbliver casual-warm (ikke fine-dining pretention)"
      ],
      "tone_elements_demonstrated": ["location_driver_waterfront", "programme_aften_date_night", "versatility_romantic_casual"],
      "content_type": "invitation",
      "programme": "aften"
    },
    
    // BAR/MENUKORT (3 eksempler)
    {
      "text": "Efter-arbejde drinks ved åen 🍹 Kom forbi kl. 16-18 for cocktails og solnedgang",
      "why_it_works": [
        "Targeterer efterarbejde-segment specifikt",
        "Waterfront + timing (solnedgang) giver visual appeal",
        "Cocktail-fokus matcher bar programme",
        "Casual invitation (kom forbi) passer mixed decision-timing"
      ],
      "tone_elements_demonstrated": ["location_driver_waterfront", "programme_bar_afterwork", "versatility_social_casual"],
      "content_type": "event",
      "programme": "bar"
    }
    
    // ... 12-15 total examples covering ALL programmes
  ]
}
```

---

## Implementation Details

### Data Flow

**Step 1: Separate Location from Segments** (brand-profile-generator-v5/index.ts)
```typescript
const LOCATION_TYPES = ['waterfront', 'city_centre', 'residential', 'office'];
const DEMOGRAPHIC_TYPES = ['student', 'tourist'];

const locationScores = filter category_scores by LOCATION_TYPES;
const demographicScores = filter category_scores by DEMOGRAPHIC_TYPES;

// Pass separately
location_intelligence: { category_scores: locationScores }
demographic_signals: extractPrimaryDemographic(demographicScores)
```

**Step 2: Pass Programme Info to Examples Generator** (tone-dna-generator.ts)
```typescript
export async function generateEnhancedExamples(
  toneDNA: V5ToneDNA,
  businessIdentityPersona: string,
  openaiClient: OpenAI,
  language: string = 'da',
  programmes?: Array<{ type, name, audienceSegments }>  // NEW
) {
  // Build programme context
  let programmeContext = '\n\nPROGRAMMES (dæk alle i eksemplerne):\n';
  programmes.forEach(prog => {
    programmeContext += `- ${prog.name} → ${prog.audienceSegments.map(s => s.segment_name).join(', ')}\n`;
  });
  
  // Add to prompt
  prompt = prompt.replace(/{business_identity_persona}/g, 
    businessIdentityPersona + programmeContext);
}
```

**Step 3: AI Generates Programme-Diverse Examples**

Prompt instructs:
```
VARIERER PROGRAMMES (hvis multi-programme business)
Hvis forretningen har brunch + frokost + aften + bar:
→ Dæk ALLE programmes i eksemplerne
→ Vær VERSATIL: samme tone skal fungere for brunch-familier, frokost-pendlere, date night par
→ Location driver (waterfront) er FÆLLES TRÅD på tværs af dayparts

Eksempel fordeling for 4-programme hybrid:
- Brunch: 3 eksempler (families, weekend hygge)
- Frokost: 3 eksempler (hurtig frokost, social lunch)
- Aften: 3 eksempler (date night, vennegrupper)
- Bar: 3 eksempler (afterwork, weekend natteliv)
```

---

## Validation: Does Tone Work Across Segments?

**Test each example against the full spectrum:**

❌ **FAILS versatility test:**
```
"Join us for a sophisticated culinary journey"
→ Works for date night couples
→ FAILS for brunch families (too formal)
→ FAILS for frokost pendlere (too slow)
→ FAILS for student-demografi (too exclusive)
```

✅ **PASSES versatility test:**
```
"Kom forbi til lækker mad ved åen"
→ Works for brunch families (casual, welcoming)
→ Works for frokost pendlere (quick, accessible)
→ Works for date night couples (warm, waterfront romance)
→ Works for bar nightlife (casual, inviting)
→ Waterfront hook universal, tone inclusive, owner voice authentic
```

---

## Summary: Multi-Programme Tone DNA Strategy

**For hybrid businesses:**

1. **Identify the common thread** (usually location driver, sometimes price positioning)
2. **Define versatility requirements** (tone must work for ALL segments)
3. **Set non-negotiables** (what NEVER changes across programmes)
4. **Allow flexibility zones** (what CAN shift between dayparts)
5. **Generate programme-diverse examples** (prove tone works across all use cases)

**The result:** ONE unified brand voice that's versatile enough for families at brunch AND nightlife seekers at the bar, anchored by the common thread that works for everyone (waterfront ved åen).
