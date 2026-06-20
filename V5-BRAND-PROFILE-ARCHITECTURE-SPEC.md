# V5 Brand Profile Architecture - Complete Implementation Specification

**Version:** 2.0  
**Date:** 20. maj 2026  
**Status:** Ready for Implementation  

---

## 🎯 EXECUTIVE SUMMARY

### **Problem Statement**
Current V5 brand profile generation produces contradictory outputs where voice rules (e.g., "korte, klare sætninger") conflict with generated examples (e.g., flowery hospitality language). Free tier produces better quality than Smart tier.

### **Root Cause**
Generic AI generates profile without domain expertise or geographic context. Same AI that creates contradictions is trusted to use the profile for content generation.

### **Solution Architecture**
Professional persona-driven system where domain expert (specialized in business type + geographic context) generates entire profile and uses it for content. Danish language prompts for authentic cultural understanding.

### **Expected Outcome**
Consistent, professional brand profiles with validated examples that demonstrate rules. "Red thread" across all content even for complex hybrid businesses.

---

## 🏗️ ARCHITECTURAL PRINCIPLES

### **1. Professional Persona Throughout**
Same expert generates profile (Layers 2-5) AND uses profile for content (ai-enhance, generate-text-from-idea).

**Not:** Generic AI makes profile → Professional uses it  
**Yes:** Professional makes profile → Professional uses own profile

### **2. Geographic Intelligence from Start**
City context + location type informs ALL layers, not added as afterthought.

**Business type × Geographic context = Professional voice prescription**

### **3. Danish Language for Danish Expertise**
Professional persona thinks in Danish for Danish businesses (Swedish for Sweden, etc.).

Authentic cultural understanding > Translation from English thinking.

### **4. Examples Must Reflect Rules**
Non-negotiable validation ensures generated examples demonstrate voice rules exactly.

If validation fails → extract violations → regenerate with banned patterns.

### **5. Facts Over Marketing Jargon**
Layers extract business facts, not abstract "brand essence" paragraphs.

Professional expertise applied to facts, not amateur interpretations repackaged.

---

## 📐 SYSTEM ARCHITECTURE

```
┌────────────────────────────────────────────────────────────────┐
│ LAYER 0: BUSINESS INTELLIGENCE (Pre-Profile Generation)       │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│ INPUT: Business data from database                             │
│   ├─ Programmes (Layer 1: existing)                            │
│   ├─ Menu items                                                │
│   ├─ City, local_location_reference                            │
│   └─ Establishment type, category                              │
│                                                                 │
│ PROCESS:                                                        │
│   1. Business Type Detection                                   │
│      └─ Output: hybrid_cafe | restaurant | fine_dining | etc.  │
│                                                                 │
│   2. Geographic Context Enrichment                             │
│      ├─ City profile (size, characteristics, tone guidance)    │
│      └─ Location type (waterfront, downtown, neighborhood)     │
│                                                                 │
│   3. Professional Persona Assignment                           │
│      └─ "Du er specialist i [domain] i [city context]"         │
│                                                                 │
│ OUTPUT: Professional persona + geographic context              │
│         (Used by ALL subsequent layers)                        │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ LAYERS 2-5: PROFILE GENERATION (By Professional Persona)      │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Layer 2: Commercial Orientation                                │
│   System: {professionalPersona} + {geographicContext}          │
│   Language: Danish (for Danish businesses)                     │
│   Task: Analyser kommerciel strategi AS DOMAIN EXPERT          │
│                                                                 │
│ Layer 3: Identity Profile                                      │
│   System: {professionalPersona} + {geographicContext}          │
│   Language: Danish                                             │
│   Task: Definer brand identity (FACTS, ikke marketing-sprog)   │
│                                                                 │
│ Layer 4: Audience Segmentation                                 │
│   System: {professionalPersona} + {geographicContext}          │
│   Language: Danish                                             │
│   Task: Segmenter målgruppe AS DOMAIN EXPERT                   │
│                                                                 │
│ Layer 5a: Voice Profile                                        │
│   System: {professionalPersona} + {voiceArchetype}             │
│   Language: Danish                                             │
│   Process:                                                      │
│     1. Get voice archetype (professional best practices)       │
│     2. AI refines for specific business                        │
│   Output: 3-4 konkrete, målbare voice rules                    │
│                                                                 │
│ Layer 5b: Writing Examples                                     │
│   System: {professionalPersona} + {geographicContext}          │
│   Language: Danish                                             │
│   Process:                                                      │
│     1. Generate examples with full context                     │
│     2. VALIDATE against voice rules                            │
│     3. If fails → extract violations → regenerate              │
│     4. If still fails → fallback templates                     │
│   Output: 3 validerede professional captions                   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
                              ↓
                    Brand Profile v5 Saved
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ CONTENT GENERATION (Same Professional Persona)                │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ai-enhance: Professional persona bruger EGEN profil            │
│ generate-text-from-idea: Professional persona bruger EGEN      │
│ weekly-plan: Professional persona bruger EGEN profil           │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 🧩 COMPONENT SPECIFICATIONS

### **Component 1: Geographic Intelligence**

**File:** `supabase/functions/_shared/brand-profile/geographic-context.ts`

**Purpose:** Enrich business data with city profile and location type intelligence

**Danish City Profiles:**

```typescript
const DANISH_CITY_PROFILES: Record<string, CityProfile> = {
  'København': {
    city: 'København',
    country: 'Danmark',
    size_category: 'capital',
    population: 800000,
    characteristics: [
      'cosmopolitan',
      'trendy', 
      'competitive_market',
      'foodie_culture',
      'international'
    ],
    tone_guidance: 'Sofistikeret, Instagram-optimeret, differentiation kritisk. Publikum forventer høj kvalitet og æstetisk indhold.',
    competition_level: 'high',
    cultural_context: 'Hovedstad med international påvirkning, unge professionelle, høje forventninger til dining'
  },
  
  'Aarhus': {
    city: 'Aarhus',
    country: 'Danmark',
    size_category: 'medium_city',
    population: 350000,
    characteristics: [
      'university_town',
      'cultural_hub',
      'second_city',
      'younger_demographic',
      'growing_food_scene'
    ],
    tone_guidance: 'Casual men kvalitetsbevidst. Universitetsby = yngre publikum accepterer uformel tone. Balance autenticitet med professionalisme.',
    competition_level: 'medium',
    cultural_context: 'Danmarks næststørste by, universitets-påvirkning giver yngre demografy, voksende kulturscene'
  },
  
  'Varde': {
    city: 'Varde',
    country: 'Danmark',
    size_category: 'small_town',
    population: 8000,
    characteristics: [
      'west_jutland',
      'local_community',
      'seasonal_tourism',
      'family_oriented',
      'nature_gateway'
    ],
    tone_guidance: 'Personlig og imødekommende. Lille by = community-feeling, nævn lokale tilknytninger. Seasonal turister om sommeren.',
    competition_level: 'low',
    cultural_context: 'Lille vestjysk by, tæt-knyttet community, indgang til vestkystens natur'
  },
  
  'Odense': {
    city: 'Odense',
    country: 'Danmark',
    size_category: 'medium_city',
    population: 180000,
    characteristics: [
      'university_town',
      'family_oriented',
      'growing_city',
      'cultural_heritage'
    ],
    tone_guidance: 'Venlig og tilgængelig. Mix af studerende og familier. Balance casual og imødekommende.',
    competition_level: 'medium',
    cultural_context: 'Danmarks tredjestørste by, familie-venlig, H.C. Andersen arv'
  },
  
  'Aalborg': {
    city: 'Aalborg',
    country: 'Danmark',
    size_category: 'medium_city',
    population: 120000,
    characteristics: [
      'university_town',
      'northern_denmark',
      'nightlife_culture',
      'younger_demographic'
    ],
    tone_guidance: 'Energisk og casual. Stærk studerende-tilstedeværelse og natteliv. Uformel tone fungerer godt.',
    competition_level: 'medium',
    cultural_context: 'Nordjyllands centrum, universitetsby med aktivt natteliv'
  }
}
```

**Location Type Inference:**

```typescript
type LocationType = 
  | 'waterfront_leisure'      // ved åen, ved havnen, ved stranden
  | 'downtown_commercial'     // i centrum, på hovedgaden
  | 'tourist_destination'     // i Nyhavn, på Strøget
  | 'urban_neighborhood'      // på Nørrebro, i Vesterbro
  | 'suburban_local'          // i [suburb]
  | 'nature_gateway'          // ved skoven, ved stranden
  | 'transport_hub'           // ved stationen
  | 'unknown'

function inferLocationType(reference: string | null): LocationContext {
  // Waterfront
  if (ref.match(/ved åen|ved havnen|ved vandet|ved stranden/)) {
    return {
      type: 'waterfront_leisure',
      advantages: ['scenic location', 'outdoor seating', 'walking destination'],
      target_audience_hints: ['weekend visitors', 'walkers', 'families'],
      tone_implications: 'Fremhæv location kraftigt - det er jeres USP. Casual leisure tone, nævn outdoor/terrasse, sæson/vejr relevant'
    }
  }
  
  // Tourist destinations
  if (ref.match(/nyhavn|strøget|tivoli|christiania/i)) {
    return {
      type: 'tourist_destination',
      advantages: ['high visibility', 'tourist traffic', 'iconic location'],
      target_audience_hints: ['tourists', 'international visitors', 'Instagram users'],
      tone_implications: 'Multi-sprog overvejelse. Ikonisk location = premium positioning. Visuelt/æstetisk fokus.'
    }
  }
  
  // Urban neighborhoods
  if (ref.match(/vesterbro|nørrebro|østerbro|frederiksberg/i)) {
    return {
      type: 'urban_neighborhood',
      advantages: ['neighborhood identity', 'local community', 'urban culture'],
      target_audience_hints: ['locals', 'young professionals', 'neighborhood regulars'],
      tone_implications: 'Neighborhood-stolthed. Casual urban tone. Community/stamkunde-fokus.'
    }
  }
  
  // Downtown
  if (ref.match(/centrum|hovedgaden|i midten|downtown/i)) {
    return {
      type: 'downtown_commercial',
      advantages: ['central location', 'high foot traffic', 'accessibility'],
      target_audience_hints: ['office workers', 'shoppers', 'lunch crowd'],
      tone_implications: 'Convenience-messaging. Quick service fremhævelse. Frokost/takeaway fokus.'
    }
  }
  
  return { type: 'unknown', advantages: [], target_audience_hints: [], tone_implications: '' }
}
```

**Geographic Context Narrative (Danish):**

```typescript
function generateContextNarrative(
  city_profile: CityProfile,
  location_context: LocationContext
): string {
  let narrative = `GEOGRAFISK CONTEXT:\n\n`
  
  narrative += `By: ${city_profile.city} (${city_profile.size_category}, ${city_profile.population.toLocaleString()} indbyggere)\n`
  narrative += `Karakteristika: ${city_profile.characteristics.join(', ')}\n`
  narrative += `Konkurrenceniveau: ${city_profile.competition_level}\n`
  narrative += `Kulturel context: ${city_profile.cultural_context}\n`
  narrative += `Tone-guidance: ${city_profile.tone_guidance}\n\n`
  
  if (location_context.signature) {
    narrative += `Specifik location: ${location_context.signature} (${location_context.type})\n`
    narrative += `Location-fordele: ${location_context.advantages.join(', ')}\n`
    narrative += `Målgruppe-hints: ${location_context.target_audience_hints.join(', ')}\n`
    narrative += `Tone-implikationer: ${location_context.tone_implications}\n`
  }
  
  return narrative
}
```

---

### **Component 2: Business Type Detection**

**File:** `supabase/functions/_shared/brand-profile/business-type-detection.ts`

**Business Type Classification:**

```typescript
type BusinessType = 
  | 'hybrid_cafe'        // morgenmad + frokost + bar
  | 'restaurant'         // frokost/middag fokus
  | 'fine_dining'        // upscale middag
  | 'coffee_bar'         // specialty kaffe fokus
  | 'wine_bar'           // vin-fokuseret bar
  | 'cocktail_bar'       // cocktail/aften bar
  | 'bakery_cafe'        // bageri med café-service
  | 'casual_dining'      // casual restaurant
  | 'bistro'             // fransk-stil bistro
  | 'pub'                // dansk pub/bar med mad

interface BusinessTypeDetection {
  type: BusinessType
  confidence: number
  reasoning: string
  professional_domain: string  // Danish: "all-day dining koncepter"
}
```

**Detection Logic Examples:**

```typescript
// Hybrid cafe
if (programmes.includes('breakfast') && 
    programmes.includes('lunch') && 
    (programmes.includes('bar') || programmes.includes('dinner'))) {
  return {
    type: 'hybrid_cafe',
    confidence: 0.9,
    reasoning: 'Flere programmer der spænder over hele dagen (morgenmad, frokost, bar/middag)',
    professional_domain: 'all-day dining koncepter'
  }
}

// Specialty coffee bar
if (programmes.includes('breakfast') &&
    menu_text.match(/espresso|flat white|cortado|pour over|filter coffee/)) {
  return {
    type: 'coffee_bar',
    confidence: 0.85,
    reasoning: 'Specialty coffee terminologi i menu',
    professional_domain: 'specialty coffee og moderne kaffebarer'
  }
}

// Fine dining
if (establishment_type === 'fine_dining' || 
    menu_text.match(/tasting menu|chef.*table|michelin/)) {
  return {
    type: 'fine_dining',
    confidence: 0.95,
    reasoning: 'Fine dining indikatorer i type eller menu',
    professional_domain: 'fine dining og gastronomi'
  }
}
```

---

### **Component 3: Professional Persona System (Danish)**

**File:** `supabase/functions/_shared/brand-profile/professional-persona.ts`

**Hybrid Cafe Persona (Danish):**

```typescript
if (business_type === 'hybrid_cafe') {
  const basePersona = `Du er en professionel social media manager specialiseret i all-day dining koncepter i Danmark.

Du har 10+ års erfaring med hybrid cafe/restaurant marketing på danske sociale medier.

Din ekspertise i all-day dining omfatter:
- Hybrid cafe/restaurant marketing (morgenmad til aften)
- Versatil messaging til forskellige målgrupper gennem dagen
- Multi-programme positioning (brunch, frokost, drinks)
- Time-segment marketing (breakfast crowd vs bar crowd)

Du ved at for et hybrid cafe-koncept:
- Location-fordele skal fremhæves tydeligt
- Versatilitet kræver klar time-segmentering i messaging
- Forskellige målgrupper til forskellige tider kræver fleksibel tone
- "Rød tråd" på tværs af alle programmer er kritisk

Din styrke er at kommunikere alsidighed uden at virke usammenhængende - du skaber konsistent brand voice på tværs af morgenmad, frokost og bar.`

  // Adjust for city context
  if (city_profile.size_category === 'capital') {
    basePersona += `\n\nYDERLIGERE CONTEXT FOR ${city_profile.city.toUpperCase()}:
Du opererer i ${city_profile.city} - en ${city_profile.size_category} med ${city_profile.competition_level} konkurrence.
Det betyder: ${city_profile.tone_guidance}
Differentiation er kritisk. Content skal være Instagram-optimeret og skille sig ud.`
  }
  
  if (city_profile.size_category === 'small_town') {
    basePersona += `\n\nYDERLIGERE CONTEXT FOR ${city_profile.city.toUpperCase()}:
Du opererer i ${city_profile.city} - en ${city_profile.size_category} (${city_profile.population} indbyggere).
Det betyder: ${city_profile.tone_guidance}
Personlighed og lokal tilknytning er vigtig. Community-feeling skal skinne igennem.`
  }
  
  if (city_profile.characteristics.includes('university_town')) {
    basePersona += `\n\nUNIVERSITETSBY CONTEXT:
${city_profile.city} har stor studiepopulation. Yngre demografy accepterer mere casual tone og emoji-brug.
Fokus på value, social gathering, studerende-venlige tilbud.`
  }
  
  return {
    system_persona: basePersona,
    expertise_areas: [
      'all-day dining marketing',
      'time-segment targeting',
      'versatile menu kommunikation',
      'multi-audience messaging'
    ],
    content_focus: [
      'time-specific offers (kl. 10-14 brunch, kl. 17-22 bar)',
      'menu-variation gennem dagen',
      'location-fordele',
      'versatilitet som salgsargument'
    ],
    tone_defaults: {
      formality: 'casual_friend',
      sentence_style: 'short_declarative',
      emoji_usage: 'moderate'
    }
  }
}
```

**Fine Dining Persona (Danish):**

```typescript
if (business_type === 'fine_dining') {
  return {
    system_persona: `Du er en professionel social media manager specialiseret i fine dining og gastronomi i Danmark.

Du har ekspertise i:
- Fine dining og gastronomisk marketing
- Ingredient storytelling og teknik-kommunikation
- Premium dining positioning
- Oplevelses-baseret content (sanselig beskrivelse af mad)
- Chef-dreven narrativ

Du ved at for fine dining:
- Ingrediens-provenance og teknik skal fremhæves
- Balance mellem elegance og tilgængelighed er kritisk
- Visual storytelling er essentielt
- Seasonal menus og chef's vision driver content

Din styrke er at kommunikere kvalitet og oplevelse uden at virke snobbet - elegance med tilgængelighed.

${city_profile.size_category === 'small_town' 
  ? `I en lille by som ${city_profile.city}: Fremhæv lokal tilknytning og community. Fine dining skal være "elevated local" ikke "upscale distant".`
  : `I en storby som ${city_profile.city}: Konkurrencen er høj. Differentiation gennem chef-reputation, unique concept, eller specifik gastronomisk angle er kritisk.`
}`,
    
    content_focus: [
      'ingredients and provenance',
      'preparation techniques',
      'tasting experiences',
      'chef creativity',
      'seasonal menus'
    ],
    
    tone_defaults: {
      formality: 'sophisticated_warm',
      sentence_style: 'descriptive_flowing',
      emoji_usage: 'minimal'
    }
  }
}
```

**Coffee Bar Persona (Danish):**

```typescript
if (business_type === 'coffee_bar') {
  return {
    system_persona: `Du er en professionel social media manager specialiseret i specialty coffee og moderne kaffebarer i Danmark.

Du har ekspertise i:
- Specialty coffee marketing og kaffe-kultur
- Brewing method kommunikation (filter, espresso, pour over)
- Bean origin og roast profile storytelling
- Kaffe-håndværk positioning
- Quick-service café marketing

Du ved at for en specialty coffee bar:
- Coffee passion skal kommunikeres tilgængeligt (nørderi med bredde)
- Brewing methods og bean origin interesserer nogle, andre vil bare have "en god kaffe"
- Daily routine positioning ("din daglige flat white")
- Takeaway convenience og quick service er vigtig
- Community-feeling (stamkunder, barista-relationer)

Din styrke er at kommunikere coffee passion til både kaffenørder og almindelige gæster - expertise med tilgængelighed.`,
    
    content_focus: [
      'coffee quality and sourcing',
      'brewing techniques',
      'daily coffee culture',
      'takeaway convenience',
      'morning routine positioning'
    ],
    
    tone_defaults: {
      formality: 'casual_enthusiast',
      sentence_style: 'conversational',
      emoji_usage: 'moderate'
    }
  }
}
```

---

### **Component 4: Voice Archetype System (Danish)**

**File:** `supabase/functions/_shared/brand-profile/voice-archetypes.ts`

**Voice Archetype Examples:**

```typescript
// Hybrid cafe + waterfront leisure
if (business_type === 'hybrid_cafe' && location_context.type === 'waterfront_leisure') {
  return {
    archetype_name: 'versatile_casual_waterfront',
    base_rules: [
      `Max 15 ord per sætning - start med hovedsagen (tid, ret, eller sted)`,
      `Nævn "${location_context.signature}" når lokation er relevant (det er jeres USP)`,
      `Brug konkrete tider (kl. 10-14, kl. 17-22) ikke vage tidsangivelser`,
      `Nævn konkrete retter fra menu - ikke kategorier ("avocadotoast" ikke "lækker brunch")`
    ],
    formality_level: 'casual_friend',
    sentence_structure: 'short_declarative',
    professional_standards: 'concrete_over_abstract',
    location_context_weight: 'high',
    content_priorities: [
      'location advantage (waterfront USP)',
      'time-specific offers',
      'menu variety',
      'outdoor/seasonal appeal'
    ]
  }
}

// Fine dining + small town
if (business_type === 'fine_dining' && city_profile.size_category === 'small_town') {
  return {
    archetype_name: 'elevated_local_authentic',
    base_rules: [
      `Fokus på ingredienser og deres oprindelse - nævn producent når relevant`,
      `Beskriv teknik og håndværk uden at være teknisk`,
      `Fremhæv lokal tilknytning og community (lille by = personligt)`,
      `Balance elegance med tilgængelighed - sofistikeret men ikke snobbet`
    ],
    formality_level: 'sophisticated_warm',
    sentence_structure: 'descriptive_flowing',
    professional_standards: 'quality_craftsmanship_focus',
    location_context_weight: 'medium',
    content_priorities: [
      'ingredient quality',
      'local sourcing',
      'chef craftsmanship',
      'community connection'
    ]
  }
}

// Coffee bar (any location)
if (business_type === 'coffee_bar') {
  return {
    archetype_name: 'coffee_enthusiast_accessible',
    base_rules: [
      `Nævn coffee specifics (bean origin, brewing method) men hold det tilgængeligt`,
      `Balance coffee nørderi med casual everyday appeal`,
      `Fokus på håndværk uden at være elitær`,
      `Quick visit messaging - takeaway, "kom og få en hurtig flat white"`
    ],
    formality_level: 'casual_enthusiast',
    sentence_structure: 'conversational',
    professional_standards: 'quality_accessibility_balance',
    location_context_weight: 'low',
    content_priorities: [
      'coffee quality',
      'daily routine',
      'craftsmanship',
      'accessibility'
    ]
  }
}
```

---

### **Component 5: Validation System**

**File:** `supabase/functions/_shared/brand-profile/validation.ts`

**Danish Hospitality Clichés (Banned Patterns):**

```typescript
const DANISH_HOSPITALITY_CLICHES = [
  'uforglemmelig',
  'passion',
  'kærlighed',
  'emmer af',
  'forføre',
  'smagsløg',
  'smagsprøve på vores passion',
  'med kærlighed',
  'forbereder.*med kærlighed',
  'lad.*smagsløg.*danse',
  'forkæle dig',
  'forkæl dig selv',
  'vidunderlig oplevelse',
  'magisk atmosfære',
  'fantastisk oplevelse',
  'utrolig stemning'
]
```

**Validation Checks:**

```typescript
interface ValidationResult {
  passes: boolean
  score: number  // 0-1
  violations: Violation[]
}

interface Violation {
  type: 'sentence_length' | 'missing_location' | 'professional_quality' | 'concreteness' | 'rule_mismatch'
  severity: 'critical' | 'warning'
  violation: string
  example_snippet: string
  suggestion?: string
}

async function validateExamples(
  examples: string[],
  voice_rules: string[],
  business_context: {
    location_signature?: string
    location_context_weight?: string
    sentence_structure?: string
  }
): Promise<ValidationResult> {
  
  const violations: Violation[] = []
  let totalScore = 1.0
  
  // 1. SENTENCE LENGTH
  if (voice_rules.some(r => r.includes('Max')) || 
      business_context.sentence_structure === 'short_declarative') {
    
    const maxWords = extractMaxWords(voice_rules) || 15
    const avgWords = calculateAvgSentenceLength(example)
    
    if (avgWords > maxWords * 1.2) {
      violations.push({
        type: 'sentence_length',
        severity: 'critical',
        violation: `Gennemsnitlig sætningslængde ${Math.round(avgWords)} ord, regel siger max ${maxWords}`,
        suggestion: `Opdel lange sætninger. Mål: max ${maxWords} ord per sætning.`
      })
      totalScore -= 0.2
    }
  }
  
  // 2. LOCATION MENTION
  if (business_context.location_signature && 
      business_context.location_context_weight === 'high') {
    
    if (!example.toLowerCase().includes(business_context.location_signature.toLowerCase())) {
      violations.push({
        type: 'missing_location',
        severity: 'critical',
        violation: `Mangler location reference "${business_context.location_signature}"`,
        suggestion: `Indsæt "${business_context.location_signature}" naturligt`
      })
      totalScore -= 0.25
    }
  }
  
  // 3. CLICHÉ DETECTION
  for (const cliche of DANISH_HOSPITALITY_CLICHES) {
    if (new RegExp(cliche, 'i').test(example)) {
      violations.push({
        type: 'professional_quality',
        severity: 'critical',
        violation: `Indeholder hospitality cliché: "${cliche}"`,
        suggestion: `Erstat med konkret beskrivelse eller specifik detalje`
      })
      totalScore -= 0.3
    }
  }
  
  // 4. CONCRETENESS
  const concreteScore = calculateConcreteness(example)
  if (concreteScore < 0.6) {
    violations.push({
      type: 'concreteness',
      severity: 'warning',
      violation: `For abstrakt (${Math.round(concreteScore * 100)}% konkret)`,
      suggestion: `Tilføj konkrete detaljer: retnavn, tid, pris, eller sted`
    })
    totalScore -= 0.15
  }
  
  return {
    passes: violations.filter(v => v.severity === 'critical').length === 0,
    score: Math.max(0, totalScore),
    violations
  }
}

function calculateConcreteness(text: string): number {
  const words = text.toLowerCase().split(/\s+/)
  
  // Concrete indicators
  const concretePatterns = [
    /\d+/,  // Numbers
    /kl\./,  // Times
    /kr\./,  // Prices
    /[a-zæøå]+(toast|burger|salat|kaffe|vin|øl|pizza|pasta)/,  // Food
    /(mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag)/,  // Days
  ]
  
  // Abstract words
  const abstractWords = [
    'oplevelse', 'stemning', 'atmosfære', 'følelse', 
    'passion', 'kærlighed', 'magisk', 'vidunderlig'
  ]
  
  let concreteCount = 0
  let abstractCount = 0
  
  for (const word of words) {
    if (concretePatterns.some(p => p.test(word))) concreteCount++
    if (abstractWords.includes(word)) abstractCount++
  }
  
  const totalRelevant = concreteCount + abstractCount
  return totalRelevant === 0 ? 0.5 : concreteCount / totalRelevant
}
```

---

## 🔧 LAYER INTEGRATION SPECIFICATIONS

### **Layer 2: Commercial Orientation (Danish Prompts)**

**System Prompt Template:**

```typescript
const systemPrompt = `${professionalPersona.system_persona}

${geographicContext.combined_context}

OPGAVE: Analyser kommerciel strategi for ${programme_type} programme.

Som specialist i ${businessType.professional_domain} ved du præcis:
- Hvordan DENNE type virksomhed skal positioneres i ${city_profile.city}
- Hvad der virker i en ${city_profile.size_category} med ${city_profile.competition_level} konkurrence
- Hvem der realistisk besøger et ${location_context.type} sted til ${programme_type}

BASERET PÅ DIN PROFESSIONELLE EKSPERTISE:
Hvad er den kommercielle strategi for ${programme_type} programme på dette sted?`
```

**User Prompt:**

```typescript
const userPrompt = `Analyser ${programme_type} programme:

MENU-BEVISER:
${menuEvidence.join(', ')}

LOCATION CONTEXT:
${location_context.signature} (${location_context.type})
${location_context.target_audience_hints.join(', ')}

BY CONTEXT:
${city_profile.city} - ${city_profile.cultural_context}

SPØRGSMÅL:
1. Hvem er primær målgruppe for ${programme_type} på DENNE location i DENNE by?
2. Hvad er kommerciel positioning?
3. Hvad er competitive angle?`
```

---

### **Layer 3: Identity Profile (Danish, Facts-Focused)**

**System Prompt:**

```typescript
const systemPrompt = `${professionalPersona.system_persona}

${geographicContext.combined_context}

OPGAVE: Definer brand identity for ${business_name}.

Som ${businessType.professional_domain} specialist ved du:
- Hvad der virker for DENNE business type i ${city_profile.city}
- Hvilke identity-elementer der resonerer i en ${city_profile.size_category}
- Hvordan man differentierer i ${city_profile.competition_level} konkurrence

VIGTIGT: 
- Fokus på FAKTA og KONKRETE differentiators
- IKKE abstrakt marketing-sprog eller lange paragraffer
- IKKE "brand essence" jargon
- VEL konkrete forretnings-facts og unique elements`
```

**Expected Output Structure (Factual):**

```typescript
{
  business_type: "hybrid_cafe",
  programmes: ["breakfast", "lunch", "bar"],
  market_position: "Waterfront all-day dining destination",
  key_differentiators: [
    "Waterfront location (primary USP)",
    "Breakfast to bar versatility",
    "Casual leisure atmosphere"
  ],
  geographic_advantage: "Ved åen positioning in university town",
  unique_elements: ["waterfront", "all_day_service", "outdoor_seating"]
}
```

---

### **Layer 5a: Voice Profile (Danish, Archetype-Based)**

**System Prompt:**

```typescript
const systemPrompt = `${professionalPersona.system_persona}

OPGAVE: Raffinér voice archetype "${voiceArchetype.archetype_name}" for ${business_name}.

Du har BASE RULES fra professional best practices for ${business_type} i ${location_context.type} location.

BASE RULES (professionelle guidelines):
${voiceArchetype.base_rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

DENNE SPECIFIKKE VIRKSOMHED:
- Navn: ${business_name}
- Location: ${location_signature || 'Ingen specifik'}
- City context: ${city_profile.city} (${city_profile.size_category})
- Menu highlights: ${menu_highlights?.slice(0, 3).join(', ')}

DIN OPGAVE:
1. BEHOLD base rules struktur (det er professional best practices)
2. TILPAS detaljer til denne business:
   - Indsæt faktisk location reference hvor relevant
   - Tilpas eksempler til deres faktiske menu
3. TILFØJ max 1 business-specific regel hvis noget unikt kræver det

KRAV:
- Alle regler skal være KONKRETE og MÅLBARE
- Ingen generiske råd ("vær positiv", "brug god tone")
- Fokus på ACTIONABLE guidelines

Returner JSON med 3-4 tilpassede rules.`
```

---

### **Layer 5b: Writing Examples (Danish, Validated)**

**System Prompt:**

```typescript
const systemPrompt = `${professionalPersona.system_persona}

${geographicContext.combined_context}

VIGTIGT - PROFESSIONEL KVALITET:
❌ ALDRIG brug: ${DANISH_HOSPITALITY_CLICHES.slice(0, 10).join(', ')}
❌ ALDRIG: Metaforer om mad eller smagsoplevelser
❌ ALDRIG: Generisk hospitality-sprog

✅ ALTID: Konkrete retter, tider, priser, steder
✅ ALTID: Specifikke detaljer frem for abstrakte stemninger
✅ ALTID: Professionel marketing kvalitet

Din opgave er at skrive PROFESSIONELLE eksempel-captions - ikke amatør-kopier.
Dette er eksempler der skal vise ejeren "sådan skal det se ud".`
```

**User Prompt:**

```typescript
const userPrompt = `Skriv 3 PROFESSIONELLE eksempel-captions for ${business_name}.

BUSINESS PROFIL:
- Type og archetype: ${voiceArchetype.archetype_name}
- Location USP: ${location_signature || 'Ikke specifik location'}
- Menu highlights: ${menu_highlights?.slice(0, 5).join(', ') || 'Ingen menu-data'}

${geographicContext.combined_context}

PROFESSIONAL VOICE ARCHETYPE: ${voiceArchetype.archetype_name}

KONKRETE SKRIVEREGLER (FØLG PRÆCIST):
${voice_rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

CONTENT PRIORITIES (prioriter disse emner):
${voiceArchetype.content_priorities.map((p, i) => `${i + 1}. ${p}`).join('\n')}

FORBUDTE ORD/MØNSTRE (UNDGÅ DISSE):
${[...neverSay, ...DANISH_HOSPITALITY_CLICHES.slice(0, 8)].join(', ')}

OPGAVE - Skriv 3 forskellige captions:
1. ${voiceArchetype.content_priorities[0]} post
2. ${voiceArchetype.content_priorities[1] || 'Menu highlight'} post
3. ${voiceArchetype.content_priorities[2] || 'Atmosphere'} post

HVER CAPTION SKAL:
- Følge ALLE skriveregler bogstaveligt
- Reflektere ${city_profile.city} context (${city_profile.size_category})
- Nævne konkrete facts (tid/ret/sted) ikke abstrakt stemning
- Være ${voice.formality_level} i tone
- Max ${voice.sentence_structure === 'short_declarative' ? '3-4' : '4-6'} sætninger
- Professional marketing kvalitet - ikke generisk hospitality-sprog

Returner JSON array med 3 strings.`
```

**Validation & Retry Logic:**

```typescript
// 1. Generate examples
const examples = await aiGenerateGoodExamples(...)

// 2. Validate
const validation = await validateExamples(examples, voice_rules, context)

console.log(`Validation score: ${Math.round(validation.score * 100)}%`)

// 3. If fails, retry once
if (!validation.passes && validation.score < 0.7) {
  console.log(`❌ Validation failed (${validation.violations.length} issues)`)
  
  // Extract clichés to ban
  const extractedCliches = validation.violations
    .filter(v => v.type === 'professional_quality')
    .map(v => v.violation.match(/cliché: "([^"]+)"/)?.[1])
    .filter(Boolean)
  
  console.log(`🚫 Adding to banned: ${extractedCliches.join(', ')}`)
  
  // Regenerate with violations banned
  const retriedExamples = await aiGenerateGoodExamples(
    ...,
    [...neverSay, ...extractedCliches]
  )
  
  const retryValidation = await validateExamples(retriedExamples, ...)
  
  if (retryValidation.passes || retryValidation.score > validation.score) {
    console.log(`✅ Retry improved: ${Math.round(retryValidation.score * 100)}%`)
    return retriedExamples
  } else {
    console.log(`⚠️ Retry failed. Using fallback.`)
    return generateFallbackExamples(business, voiceArchetype)
  }
}

console.log(`✅ Examples passed validation`)
return examples
```

---

## 📊 EXPECTED OUTCOMES

### **Cafe Faust - Before vs After**

**BEFORE (Current Generic AI):**

```json
{
  "voice": {
    "tone_rules": [
      "Brug korte, klare sætninger",
      "Brug en afslappet tone",
      "Brug positive og indbydende ord"
    ]
  },
  "writing_examples": {
    "good_examples": [
      "Glæd dig til at se, hvordan vi forbereder vores retter med kærlighed. Bag kulisserne bruger vi kun de bedste regionale råvarer..."
    ]
  }
}
```

**Issues:**
- ❌ Generic rules ("positive ord")
- ❌ Flowery example contradicts "korte sætninger"
- ❌ No location mention ("ved åen")
- ❌ Hospitality clichés ("med kærlighed")

---

**AFTER (Professional Persona with Danish Prompts):**

```json
{
  "business_intelligence": {
    "business_type": "hybrid_cafe",
    "professional_domain": "all-day dining koncepter",
    "city_profile": {
      "city": "Aarhus",
      "size_category": "medium_city",
      "characteristics": ["university_town", "cultural_hub"]
    },
    "location_context": {
      "signature": "ved åen",
      "type": "waterfront_leisure",
      "location_context_weight": "high"
    }
  },
  
  "professional_persona": "Specialist i all-day dining koncepter i Danmark, ekspert i waterfront venues i medium byer",
  
  "voice": {
    "archetype_name": "versatile_casual_waterfront",
    "tone_rules": [
      "Max 15 ord per sætning - start med tid, ret, eller sted",
      "Nævn 'ved åen' når lokation er relevant (det er jeres USP)",
      "Brug konkrete tider (kl. 10-14) ikke vage tidsangivelser",
      "Nævn konkrete retter fra menu - ikke kategorier"
    ],
    "formality_level": "casual_friend",
    "sentence_structure": "short_declarative"
  },
  
  "writing_examples": {
    "good_examples": [
      "Brunch ved åen kl. 10-14 🌊 Prøv vores avocadotoast med pocheret æg og hjemmelavet aioli. Få den bedste plads på terrassen mens der er sol! Book bord nu ☀️",
      
      "Fredagsbar ved åen starter kl. 17 🍹 Kom ned til os med venner og nyd aften ved vandet. Aperol spritz til 65 kr hele aften. Vi ses på terrassen! 🌅",
      
      "Perfekt frokost-spot ved åen 🥗 Vi har åbent 11-17 med friske salater, burgers og dagens ret. Book bord online eller kom forbi - der er altid plads ved vandet!"
    ]
  },
  
  "validation": {
    "passes": true,
    "score": 0.95,
    "checks": {
      "sentence_length": "✅ Avg 13 ord (max 15)",
      "location_mention": "✅ 'ved åen' i alle 3 eksempler",
      "cliches": "✅ Ingen hospitality clichéer",
      "concreteness": "✅ 87% konkrete detaljer"
    }
  }
}
```

**Improvements:**
- ✅ Concrete rules (max 15 words, specific times)
- ✅ Examples demonstrate rules exactly
- ✅ Location USP emphasized ("ved åen" in all)
- ✅ Professional quality (no clichés)
- ✅ Validated and consistent

---

## 🎯 IMPLEMENTATION CHECKLIST

### **Phase 1: Build New Modules**

- [ ] `geographic-context.ts`
  - [ ] Danish city profiles (København, Aarhus, Odense, Aalborg, Varde)
  - [ ] Location type inference
  - [ ] Context narrative generation (Danish)

- [ ] `business-type-detection.ts`
  - [ ] Business type classification
  - [ ] Professional domain assignment (Danish)
  - [ ] Detection logic for all types

- [ ] `professional-persona.ts`
  - [ ] Danish persona templates for each business type
  - [ ] City context adjustment logic
  - [ ] Multi-language support structure

- [ ] `voice-archetypes.ts`
  - [ ] Danish voice archetype definitions
  - [ ] Business type × location mapping
  - [ ] Professional standards per archetype

- [ ] `validation.ts`
  - [ ] Danish hospitality cliché list
  - [ ] Validation checks (length, location, clichés, concreteness)
  - [ ] Danish error messages

### **Phase 2: Modify Existing Layers**

- [ ] Layer 2 (`commercial-orientation.ts`)
  - [ ] Add professionalPersona parameter
  - [ ] Add geographicContext parameter
  - [ ] Convert prompts to Danish
  - [ ] Update function signature

- [ ] Layer 3 (`identity-profile.ts`)
  - [ ] Add professionalPersona parameter
  - [ ] Add geographicContext parameter
  - [ ] Convert prompts to Danish
  - [ ] Refactor output structure (facts, not jargon)

- [ ] Layer 4 (`audience-profile.ts`)
  - [ ] Add professionalPersona parameter
  - [ ] Add geographicContext parameter
  - [ ] Convert prompts to Danish

- [ ] Layer 5a (`voice-profile.ts`)
  - [ ] Add professionalPersona parameter
  - [ ] Add geographicContext parameter
  - [ ] Integrate voice archetype system
  - [ ] Convert prompts to Danish
  - [ ] Implement refinement flow

- [ ] Layer 5b (`writing-examples.ts`)
  - [ ] Add professionalPersona parameter
  - [ ] Add geographicContext + voiceArchetype parameters
  - [ ] Convert prompts to Danish
  - [ ] Implement validation loop
  - [ ] Add retry logic with banned patterns
  - [ ] Add fallback templates

### **Phase 3: Main Orchestrator**

- [ ] `brand-profile-generator-v5/index.ts`
  - [ ] Add business intelligence step (after Layer 1)
  - [ ] Detect business type
  - [ ] Enrich geographic context
  - [ ] Assign professional persona
  - [ ] Pass persona to all layers
  - [ ] Update all function calls
  - [ ] Add comprehensive logging

### **Phase 4: Testing**

- [ ] Test Cafe Faust regeneration
  - [ ] Verify business type: hybrid_cafe
  - [ ] Verify location: waterfront_leisure
  - [ ] Verify persona assignment
  - [ ] Verify Danish prompts used
  - [ ] Verify validation passes
  - [ ] Compare quality to current profile

- [ ] Test edge cases
  - [ ] Business without local_location_reference
  - [ ] City not in profile database (fallback)
  - [ ] Different business types
  - [ ] Validation failures (retry logic)

---

## 🚀 DEPLOYMENT STRATEGY

### **Phase 1: Test in Isolation**
Build and test new modules independently without affecting production.

### **Phase 2: Shadow Mode**
Run new system alongside old, compare outputs, don't save to database.

### **Phase 3: Pilot**
Enable for single test business (Cafe Faust), validate quality improvement.

### **Phase 4: Gradual Rollout**
Enable for new profile generations, keep existing profiles unchanged.

### **Phase 5: Migration**
Offer existing businesses option to regenerate with new system.

---

## 📈 SUCCESS METRICS

### **Quality Metrics:**
- ✅ Validation pass rate > 90%
- ✅ Average validation score > 0.85
- ✅ Zero hospitality clichés in generated examples
- ✅ Location mention rate = 100% (when location_context_weight = high)
- ✅ Sentence length compliance > 95%

### **Consistency Metrics:**
- ✅ Voice rules and examples alignment score > 0.9
- ✅ Same business regenerated = consistent archetype
- ✅ Red thread across all examples (same tone/style)

### **Business Metrics:**
- ✅ User satisfaction with Smart tier quality
- ✅ Smart tier outperforms Free tier (should be opposite of current)
- ✅ Reduced manual editing of AI-generated content
- ✅ Increased engagement on Smart tier posts vs Free tier

---

## 🔮 FUTURE ENHANCEMENTS

### **Geographic Expansion:**
- Swedish city profiles + Swedish persona templates
- Norwegian city profiles + Norwegian persona templates
- German city profiles + German persona templates

### **Voice Archetype Library:**
- Expand to 20+ archetypes
- Industry-specific archetypes (bakery, pizzeria, sushi, etc.)
- Seasonal variations

### **Advanced Validation:**
- Emoji appropriateness check
- Hashtag relevance validation
- CTA effectiveness scoring
- Engagement prediction

### **Learning Loop:**
- Track which examples perform best
- Feed performance data back to archetype refinement
- A/B test voice variations

---

## 📚 TECHNICAL NOTES

### **Language Parameter Standardization:**
All functions use ISO 639-1 language codes:
- `'da'` = Danish (default for Denmark)
- `'sv'` = Swedish
- `'no'` = Norwegian
- `'de'` = German
- `'en'` = English (fallback)

### **Error Handling:**
- Unknown city → use DEFAULT_CITY_PROFILE
- Unknown business type → fallback to 'restaurant'
- Validation fails twice → use template fallbacks
- AI API errors → log + use fallbacks

### **Performance:**
- City profiles: In-memory lookup (fast)
- Business type detection: Deterministic (< 10ms)
- Professional persona: String composition (< 5ms)
- Voice archetype: Rule-based lookup (< 10ms)
- Validation: Regex + calculations (< 50ms per example)

**Total overhead: < 100ms**
**AI calls: Same as current (4-5 OpenAI calls)**

### **Backward Compatibility:**
- New fields added to existing structures
- Old profiles remain valid
- Migration path: Optional regeneration

---

## ✅ APPROVAL CHECKLIST

**Architecture Review:**
- [x] Professional persona throughout (not just content generation)
- [x] Geographic intelligence from start (not afterthought)
- [x] Danish language prompts (authentic cultural understanding)
- [x] Examples must reflect rules (validated, not assumed)
- [x] Facts over marketing jargon (concrete over abstract)

**Implementation Readiness:**
- [x] All components specified
- [x] Danish prompt templates written
- [x] Validation logic defined
- [x] Integration points identified
- [x] Testing strategy defined
- [x] Deployment plan outlined

**Business Alignment:**
- [x] Solves Smart tier quality issue
- [x] Maintains "red thread" for complex businesses
- [x] Enables geographic expansion (Sweden, Norway, Germany)
- [x] Professional quality from small business owners
- [x] No hard-coded business-specific logic

---

**This specification is complete and ready for implementation.**

**Next Step:** Begin Phase 1 (Build New Modules) or request clarification on any component.
