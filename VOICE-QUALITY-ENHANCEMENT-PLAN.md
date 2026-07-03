# Voice Quality Enhancement Plan
**Version:** 2.1 — Sensory Detail Framework Revised  
**Status:** Issue 1 Complete ✅ | Issues 2 & 3 Planning Complete (Sensory Details Corrected)  
**Goal:** Improve voice from 8/10 to 9/10 by adding warmth, authenticity, location-aware variation, and sensory grounding

**⚠️ REVISION NOTE (v2.1):**  
Corrected unrealistic sensory detail assumptions. **You cannot hear calm rivers or lakes** — water sounds only work for sea/coast. Calm rivers (å), lakes (sø) are VISUAL only. Active harbors have boat motor/seagull sounds, NOT water sounds. All examples updated to reflect physical reality.

## Status Overview
- ✅ **Issue 1: Waterfront Term Injection** — COMPLETED & TESTED
  - "ved åen" appearing correctly instead of generic "ved vandet"
  - Specific terms detected from city/address/business name
  - Fallback strategy working as designed
  
- ⏳ **Issue 2: Voice Quality Enhancement** — PLANNING COMPLETE, READY TO IMPLEMENT
  - Voice quality layer, sensory grounding, emotional positioning designed
  - Estimated: 5 hours implementation
  - Priority: HIGH (affects all venues)
  
- ⏳ **Issue 3: Location Personality Variation** — PLANNING COMPLETE, READY TO IMPLEMENT
  - Location-aware voice modifiers (Denmark vs USA, Copenhagen vs Aarhus)
  - Estimated: 5.5 hours implementation  
  - Priority: MEDIUM (refinement layer after Issue 2)

## Quick Reference: What's Changing?

### Current Voice Quality (8/10)
❌ "Café med terrasse ved vandet der serverer brunch og cocktails"  
❌ "Fokusér på skiftet mellem dag og aften"  
❌ "Dynamisk atmosfære gennem hele dagen"

### Target Voice Quality (9/10)  
✅ "Det velfortjente stop ved åen — kaffe om morgenen, drinks når du skal have det godt"  
✅ "Støjen stiger kl. 19 når after-work gæsterne kommer"  
✅ "Udsigt til åen når du sidder ude, folk der går tur langs vandet"

**Key Improvements:**
1. **Specific location terms** ("ved åen" not "ved vandet")
2. **Guest perspective** ("du skal have det godt" not "vi tilbyder")
3. **Sensory grounding** ("udsigt til åen" not "dynamisk atmosfære")
4. **Emotional positioning** ("det velfortjente stop" not "pause i en travl dag")
5. **Location personality** (Aarhus calm-river voice ≠ Copenhagen harbor voice)

---

## Core Principles

### ✅ What We Will Do
- **Pattern-based guidance**: Show AI good vs. bad writing patterns
- **Systematic rules**: Principles that work for ANY venue type
- **AI-helping examples**: Generic scenarios that illustrate tone/style
- **Specific waterfront terms**: Inject actual location context (åen, fjorden, søen)
- **Sensory grounding**: Require concrete, observable details

### ❌ What We Will Avoid
- **Business-specific hardcoding**: No "Café Faust should say..."
- **Menu item examples**: No "mention Hangover Burgeren when..."
- **Location-specific rules**: No "venues in Aarhus should..."
- **Venue type assumptions**: No "cafés always..." or "restaurants must..."
- **Generic waterfront pollution**: No vague "ved vandet" when we know it's "ved åen"

---

## Issue 1: Generic "Waterfront" Term Pollution

### Current Problem
Location enrichment uses generic `area_type="waterfront"`, which gets injected into prompts as:
- "waterfront location"
- "ved vandet"
- "havnefront"

This is too vague and doesn't match authentic Danish location language.

### Actual Danish Waterfront Terms
Different venues are located by:
- **åen** (river) - e.g., Aarhus Å, Odense Å
- **fjorden** (fjord) - e.g., Roskilde Fjord, Limfjorden
- **søen** (lake) - e.g., Søndersø, Furesøen
- **bugten** (bay) - e.g., Aarhus Bugt
- **havnen** (harbor) - e.g., Nyhavn, Aarhus Havn
- **kanalen** (canal) - e.g., Christianshavns Kanal

### Solution: Location Intelligence Enhancement

**Step 1: Detect Specific Waterfront Type**
- Add function to `location-helpers.ts` (or create new file)
- Input: latitude, longitude, city name
- Logic:
  ```
  if city contains known river name → return "åen"
  if coastal coordinates near fjord → return "fjorden"
  if coordinates indicate harbor area → return "havnen"
  if coordinates near lake → return "søen"
  fallback → return "vandet" (generic water)
  ```

**Step 2: Enhance LocationEnrichment Type**
```typescript
interface LocationEnrichment {
  area_type: string;
  waterfront_term?: string;  // NEW: "åen" | "fjorden" | "søen" | "bugten" | "havnen" | "kanalen" | "vandet"
  waterfront_specificity?: number;  // NEW: 1-10 confidence score
}
```

**Step 3: Inject into Prompt Context**
- Replace all generic "waterfront" references with `{waterfront_term}`
- Use in business_character when location is a differentiator
- Maintain seasonal awareness (waterfront still seasonal, just more specific)

**Step 4: Fallback Strategy**
- If no specific term detected → use "vandet" (generic but Danish)
- If business_character already mentions generic "waterfront" → prefer specific term
- Never use English "waterfront" in Danish content

**Implementation Estimate:** 1.5 hours
- 30min: Location detection logic
- 30min: Type updates and integration
- 30min: Prompt injection and testing

---

## Issue 2: Voice Lacks Warmth and Authenticity

### Current State Analysis

**What Works (8/10):**
- ✅ Structure is sound (all fields populated)
- ✅ Information flow logical
- ✅ No banned words or problematic language
- ✅ Feature diversity improved (43% repetition)

**What Needs Improvement:**
- ❌ Sounds like "tourist brochure" not "friendly host"
- ❌ Too structural ("Fokusér på skiftet" = process instruction)
- ❌ Abstract language ("dynamisk atmosfære", "fleksibel stemning")
- ❌ Missing emotional positioning ("det velfortjente stop")
- ❌ No sensory grounding (what do you see/hear/taste?)

### User's Desired Voice Quality Keywords
- **varm** (warm)
- **lokal** (local, authentic)
- **smilende** (friendly, welcoming)
- **afslappet** (relaxed)
- **stemningsfuld** (atmospheric, with mood)

### Root Cause
Current prompt gives AI:
1. What to include (menu, hours, features)
2. What to avoid (banned words, clichés)
3. How to structure (priority hierarchies)

Missing:
1. How to sound (voice tone, emotional register)
2. Whose perspective (guest experience, not café offering)
3. What makes it feel real (sensory details, concrete moments)

---

## Enhancement Strategy

### Phase 1: Voice Quality Layer (2 hours)

**Add 🎭 STEMME-KVALITET section to Prompt B (before field instructions)**

#### 1A: Core Positioning Principles
```
🎭 STEMME-KVALITET

Denne brandprofil skal FØLES som:
- En lokal ven der anbefaler et sted de elsker
- En varm, afslappet stemme der smiler når de taler
- Autentisk dansk sprog uden tourist-brochure tone

IKKE som:
- En brochure fra VisitDenmark
- En procesbeskrivelse af hvad stedet gør
- En liste af features og services
```

**Why this works:**
- No business-specific examples
- Sets emotional register (varm, afslappet, smilende)
- Contrasts with anti-pattern (tourist brochure)
- Works for ANY venue type

#### 1B: Perspective Rule
```
PERSPEKTIV-REGEL:
- Skriv fra GÆSTENS oplevelse, ikke stedets udbud
- Fokusér på HVORFOR nogen vælger dette sted (emotional need)
- Brug konkrete detaljer der FØLES, ikke abstrakte påstande

❌ "Vi tilbyder en dynamisk atmosfære fra dag til aften"
   → Café's offering, abstract claim

✅ "Støjen stiger kl. 19 når after-work gæsterne kommer"
   → Guest observation, concrete detail
```

**Why this works:**
- Pattern-based (❌ vs ✅ examples)
- No specific business mentioned
- Teaches perspective shift (offering → experience)
- Illustrates with transferable scenario

#### 1C: Sensory Grounding Requirements
```
KRÆV SENSORISKE DETALJER:

Hvert felt skal indeholde mindst ÉN konkret, observerbar detalje.

🎯 SENSORY HIERARCHY (safest to most risky):

1. VISUAL (always safe, prioritize first):
   - "udsigt til åen", "solen der rammer bordet kl. 11"
   - "lys fra gaden", "folk der går forbi vinduet"
   - Observable movement, colors, light, reflections

2. TEMPORAL (always safe, very concrete):
   - "kl. 11 når solen rammer bordet", "efter kl. 19 når arbejdsdagen er slut"
   - Clock time, day of week, season

3. SPATIAL/TEMPERATURE (usually safe if verifiable):
   - "varmen fra de andre gæster", "kølig luft fra åen"
   - "åben himmel", "grønt lige udenfor"

4. MOVEMENT/ACTIVITY (safe if observable):
   - "folk der skifter fra kaffe til vin kl. 17"
   - "løbere langs åen om morgenen", "cykler der passerer"

5. SOUND (DANGEROUS — only for specific contexts):
   - ✅ SEA/COAST ONLY: "lyden af bølger", "vinden fra havet"
   - ✅ ACTIVE HARBOR: "båd-motorer", "måger", "aktivitet på kajen" (NOT water sounds)
   - ❌ CALM RIVERS (å): NO water sounds — too calm to hear
   - ❌ LAKES (sø): NO water sounds — still surface, silent
   - ✅ URBAN: "støj fra gaden", "samtaler", "musik"

6. SMELL (VERY DANGEROUS — avoid except very specific contexts):
   - ✅ FOOD/COFFEE: "duften af nybagt brød", "kaffe fra baren"
   - ⚠️ SEA: "salt luft" (okay but cliché risk)
   - ❌ GENERAL WATERFRONT: Avoid smell references

⚠️ PHYSICAL REALITY CHECK:
- You CANNOT hear calm rivers (å) or lakes (sø) — water too calm
- You CAN hear sea/ocean (waves, wind) and urban noise (traffic, people)
- Active harbors have boat motors, seagulls, activity — NOT water sounds
- When in doubt: USE VISUAL DETAILS (safest, always verifiable)

❌ FORBUDTE ABSTRAKTIONER:
- "dynamisk atmosfære" → brug konkret skift (hvornår? hvordan?)
- "fleksibel stemning" → brug specifik transition (fra hvad til hvad?)
- "afslappet vibe" → brug observerbar adfærd (folk der tier, ler?)
- "autentisk oplevelse" → brug konkret detalje (hvad gør det autentisk?)
- "lyden af åen/søen" → WRONG! Use "udsigt til åen" instead (visual)
```

**Why this works:**
- Systematic requirements (ONE sensory detail per field)
- Pattern-based anti-examples (not business-specific)
- Generic sensory categories (time, sound, temperature, movement, taste)
- Works for café, restaurant, bar, any venue type

#### 1D: Emotional Positioning (Not Operational Description)
```
EMOTIONEL POSITIONERING:

Identificér stedets EMOTIONELLE ROLLE i gæstens liv:
- "Det velfortjente stop" (not "pause i en travl dag")
- "Stedet du får lyst til når X" (not "tilbyder Y service")
- "Følelsen af..." (not "konceptet er...")

PRIORITERING:
1. Emotional need (hvorfor kommer folk følelsesmæssigt?)
2. Temporal context (hvilken tid på dagen/ugen/året?)
3. Menu specificity (kun hvis stabilt og emotionelt ankret)
4. Physical features (SIDST, kun hvis differentierender >7/10)

❌ "Café med terrasse ved åen der serverer brunch og cocktails"
   → Operational description, physical-first

✅ "Det velfortjente stop ved åen — kaffe om morgenen, drinks når du skal have det godt"
   → Emotional role, temporal transitions, menu as mood anchor
```

**Why this works:**
- No business-specific examples (generic café scenario)
- Teaches priority order (emotional → temporal → menu → physical)
- Pattern-based contrast (❌ vs ✅)
- Works for any venue with emotional positioning

---

### Phase 2: Concrete Situation Templates (1.5 hours)

**Replace abstract occasion templates with feeling-based scenarios**

#### Current Problem (in target_audience occasions)
```
"Brunch i weekenden" → Demographics (who)
"Frokost i hverdagen" → Time slot (when)
"Drinks om aftenen" → Service category (what)
```

These are structural, not emotional.

#### New Approach: Feeling-Based Scenarios
```
ANLEDNINGS-SKABELONER (Situation Templates):

Brug FØLELSESMÆSSIGE SCENARIER, ikke demografiske kategorier:

VELFORTJENT PAUSE-kategorier:
1. "Når du skal have en pause fra..." (escape need)
2. "Det første sted når du..." (transition moment)
3. "Stedet du tager [person] til når..." (social context)

TIDSMÆSSIGE ANKRE (ikke "hele dagen"):
- Kl. 10-12: "Når kaffen er vigtigere end frokosten"
- Kl. 14-17: "Efter-lunch pausestedet"
- Kl. 17-19: "Første stop efter arbejde"
- Kl. 20-24: "Når du vil blive lidt længere"

MENU SOM STEMNINGSANKER (ikke liste):
- Stabilt menupunkt → emotionel kontekst
- ❌ "Vi serverer Hangover Burgeren"
- ✅ "Når du skal have det godt igen efter i går" (menu implies mood)
```

**Why this works:**
- Feeling-based (not demographics)
- Temporal specificity (clock time, not vague "hele dagen")
- Menu as mood anchor (emotional context, not item list)
- No business-specific examples
- Transferable pattern for any venue

---

### Phase 3: Menu Specificity Permission (45 min)

**Give AI explicit permission to use stable menu items emotionally**

#### Current Problem
AI doesn't know WHEN it's okay to mention specific menu items.

#### Solution: Usage Rules
```
MENU-SPECIFICITETS-REGLER:

Du MÅ nævne specifikke menupunkter når:
1. Det er STABILT (ikke sæsonbestemte specials)
2. Navnet er STEMNINGSFULDT (ikke "Menu 1" eller "Ret A")
3. Det bruges som EMOTIONEL ANKER (ikke som liste)

TILLADT:
✅ "Hangover Burgeren når du skal have det godt igen"
   → Emotional context, menu name implies mood

✅ "Brunch når du har hele formiddagen"
   → Temporal anchor, menu category as time marker

FORBUDT:
❌ "Vi serverer Hangover Burger, Caesar Salad, og Margherita Pizza"
   → List of items, no emotional context

❌ "Vores specialiteter inkluderer..."
   → Generic restaurant language

❌ Nævne sæsonbestemte retter i brand_essence eller business_character
   → Not year-round stable
```

**Why this works:**
- Clear rules for WHEN menu specificity is allowed
- Pattern-based examples (not business-specific in the prompt)
- Emotional context requirement prevents listing
- Works for any venue with creative menu naming

---

### Phase 4: Enhanced Quality Checkpoint (1 hour)

**Add quality scan to existing diversity validator**

#### Extend `validateFeatureDiversity()` or create `validateVoiceQuality()`

**Detection Rules:**

1. **Forbidden Abstractions** (HIGH severity if found)
   - "dynamisk atmosfære/stemning/miljø"
   - "fleksibel stemning/koncept"
   - "autentisk oplevelse/vibe"
   - "unik/særlig atmosfære"
   - Generic "ved vandet/havnen" when specific term available

2. **Missing Sensory Details** (MEDIUM severity)
   - Scan each major field for at least ONE concrete, observable detail
   - Flag if 0 sensory markers found (time, sound, temperature, movement, taste)

3. **Wrong Perspective** (MEDIUM severity)
   - Detect café-voice patterns: "Vi tilbyder", "Vores koncept", "Vi serverer"
   - Should be guest-perspective: "Du kan", "Stedet hvor", "Når du"

4. **Generic Waterfront Usage** (HIGH severity if specific term available)
   - Flag if using "waterfront/ved vandet/havnen" when `waterfront_term` is "åen/fjorden/søen"

**Output:**
```typescript
warnings.push({
  type: 'voice_quality',
  field: 'brand_essence',
  severity: 'HIGH',
  message: 'Abstract language detected: "dynamisk atmosfære" - use concrete detail instead',
  hint: 'Replace with observable behavior or specific time/sound/movement'
});
```

---

## Implementation Timeline

### Phase 1: Waterfront Term Injection (1.5 hours)
1. Create location detection logic (30 min)
2. Update types and integration (30 min)
3. Inject into prompts and test (30 min)

**Expected Outcome:**
- "Café ved åen" instead of "café ved vandet"
- "Restaurant ved fjorden" instead of "waterfront restaurant"
- Higher authenticity, more specific location context

### Phase 2: Voice Quality Layer (2 hours)
1. Add 🎭 STEMME-KVALITET section to prompt-b.ts (1 hour)
2. Add perspective rule and examples (30 min)
3. Add sensory requirements and emotional positioning (30 min)

**Expected Outcome:**
- AI understands HOW to sound (not just WHAT to include)
- Guest perspective enforced
- Sensory grounding required

### Phase 3: Situation Templates (1.5 hours)
1. Replace occasion templates with feeling-based scenarios (45 min)
2. Add temporal anchors (30 min)
3. Add menu specificity permission rules (15 min)

**Expected Outcome:**
- "Når du skal have en pause" instead of "Brunch i weekenden"
- Clock-time specificity instead of "hele dagen"
- Menu items allowed emotionally, not as lists

### Phase 4: Quality Checkpoint (1 hour)
1. Add voice quality detection to validators.ts (45 min)
2. Test with Café Faust (15 min)

**Expected Outcome:**
- Automatic detection of abstract language
- Flags missing sensory details
- Catches wrong perspective (café voice vs guest voice)

---

## Testing Strategy

### Test 1: Waterfront Term Injection
**Business:** Café Faust (2037d63c-a138-4247-89c5-5b6b8cef9f3f)  
**Expected:** "ved åen" (not "ved vandet" or "waterfront")  
**Verify:** Check business_character, brand_essence, tone_of_voice

### Test 2: Voice Quality Improvement
**Business:** Café Faust  
**Expected:** Warmer tone, sensory details, guest perspective  
**Verify:** Check for ≥1 sensory detail per field, no abstract language

---

## Issue 3: Location-Based Voice Variation (NEW)

### User Insight
> "Denmark vs USA, Copenhagen Vesterbro vs Aarhus ved åen differences matter"

Different locations have different voice expectations. Current implementation treats all Danish locations identically, missing important cultural and geographic nuances.

### The Problem

**Geographic Variation Ignored:**
- Copenhagen Vesterbro (urban, international, fast-paced)
- Aarhus ved åen (relaxed, waterfront, university town)
- Aalborg (working-class authenticity, directness)
- Odense (provincial charm, H.C. Andersen heritage)

**Cultural Context Missing:**
- Denmark vs USA (understatement vs enthusiasm)
- Denmark vs Sweden/Norway (different emotional registers)
- Tourist areas vs local neighborhoods

**Current State:**
All Danish venues get identical voice guidance regardless of location personality.

---

## Solution: Location Personality Patterns

### Design Principles (NO HARDCODING)

✅ **Pattern-Based Approach:**
- Define location TYPES, not specific cities
- Use data signals to classify location personality
- Inject personality modifiers into voice guidance

❌ **What We WON'T Do:**
- "If city === 'Aarhus' then use relaxed tone" (hardcoded)
- "Copenhagen venues must mention metro" (location-specific rules)
- "Vesterbro cafés should say X" (neighborhood-specific templates)

### Location Personality Dimensions

#### 1. Urban Intensity (3-tier classification)

**HIGH URBAN** (Copenhagen city center, Aarhus Indre By)
- **Signals:** High population density, metro/public transport, >50% tourist traffic
- **Voice modifier:** Fast-paced, concise, international references allowed
- **Tone shift:** Less small-talk, more efficiency-focused
- **Example:** "Første kaffe kl. 7, sidste drink kl. 2" (clock precision matters)

**MEDIUM URBAN** (Suburbs, mid-size city centers)
- **Signals:** Medium density, bus lines, mixed tourist/local
- **Voice modifier:** Balanced pace, local references
- **Tone shift:** Neighborly but not provincial
- **Example:** "Morgenkaffe når du skal på arbejde, drinks når du kommer hjem"

**LOW URBAN** (Small towns, residential areas)
- **Signals:** Low density, car-dependent, <10% tourist traffic
- **Voice modifier:** Slower pace, community-focused, personal
- **Tone shift:** More intimate, assumes repeat visits
- **Example:** "Stedet du kender folk på" (community assumption)

#### 2. Waterfront Personality (4 types)

**ACTIVE HARBOR** (Copenhagen Nyhavn, Aarhus Dokk1)
- **Signals:** Commercial harbor, tourist boats, waterfront dining density
- **Voice modifier:** Dynamic, movement-focused, "watch the boats" energy
- **Sensory details:** VISUAL (boats, masts, movement) + SOUND (boat motors, måger, aktivitet) — NOT water sounds
- **Example:** "Udsigt til sejlbådene, lyden af båd-motorer og måger"
- **Physical reality:** Active harbors have boat/activity sounds, NOT water lapping sounds

**CALM RIVER/LAKE** (Aarhus Å, Silkeborg Søerne)
- **Signals:** Freshwater, path/park alongside, local exercise culture
- **Voice modifier:** Peaceful, nature-adjacent, "pause from city" vibe
- **Sensory details:** VISUAL ONLY (water reflection, greenery, people walking) — NO water sounds
- **Example:** "Udsigt til åen, folk der går tur langs vandet, grønt lige udenfor"
- **Physical reality:** ⚠️ You CANNOT hear calm rivers or lakes — too calm, use visual details only

**INDUSTRIAL WATERFRONT** (Aalborg havnefront, Esbjerg)
- **Signals:** Working harbor, shipping activity, less tourist-oriented
- **Voice modifier:** Authentic, working-class, less polished
- **Sensory details:** VISUAL (ships, cranes, industrial aesthetic) + SOUND (ship horns, machinery if present)
- **Example:** "Udsigt til havnen uden turistfilter, arbejdende havn"
- **Physical reality:** Industrial harbor has machinery/ship sounds, NOT water sounds

**BEACH/COAST** (Skagen, Bornholm)
- **Signals:** Ocean/sea proximity, seasonal tourism spike, beach culture
- **Voice modifier:** Seasonal awareness, wind/weather focus, outdoorsy
- **Sensory details:** VISUAL (horizon, sand, sky) + SOUND (waves, wind) + TEMPERATURE (wind chill, sun warmth)
- **Example:** "Når vinden ligger sig og solen kommer frem, lyden af bølger i baggrunden"
- **Physical reality:** ✅ ONLY waterfront type where water sounds work (waves audible)

#### 3. Tourist vs Local Balance (measured by data)

**TOURIST-HEAVY** (>40% foreign visitors)
- **Signals:** Multiple languages on website, international menu translations
- **Voice modifier:** More explanatory, less insider language
- **Cultural references:** Fewer Danish idioms, clearer descriptions
- **Example:** "Klassisk dansk smørrebrød — du vælger fyldet, vi bygger kunsten"

**MIXED AUDIENCE** (15-40% foreign visitors)
- **Signals:** Some English content, mix of local/tourist reviews
- **Voice modifier:** Balanced, code-switching allowed
- **Cultural references:** Danish idioms okay if context-clear
- **Example:** "Smørrebrød når du vil have det rigtigt" (Danish idiom, clear context)

**LOCAL-FOCUSED** (<15% foreign visitors)
- **Signals:** Danish-only website, neighborhood references, local partnerships
- **Voice modifier:** Insider language allowed, community shortcuts
- **Cultural references:** Full Danish cultural context
- **Example:** "Morgenmad på danske præmisser" (cultural assumption)

#### 4. Country-Level Cultural Modifiers

**DENMARK** (understatement culture)
- **Tone:** Afslappet, underspillet, anti-superlativ
- **Forbidden:** "Best in Denmark", "amazing", "incredible", "spectacular"
- **Required:** Konkret, jordbundet, "det er okay at være almindelig"
- **Example:** "God kaffe, intet hokuspokus" (Danish understatement)

**USA** (enthusiasm culture)
- **Tone:** Energisk, positiv, opløftende
- **Allowed:** "Best", "favorite", "love", "amazing" (expected, not banned)
- **Required:** Value proposition explicit, convenience highlighted
- **Example:** "Your new favorite coffee spot — right on your commute"

**SWEDEN** (lagom culture)
- **Tone:** Balanceret, harmoni, ikke-konfronterende
- **Required:** Inkludering, bæredygtighed, fællesskab
- **Example:** "Där alla är välkomna" (everyone welcome, Swedish core value)

**NORWAY** (nature-first culture)
- **Tone:** Udendørs-fokus, værelyst, råvare-stolthed
- **Required:** Natur-forbindelse, lokal oprindelse
- **Example:** "Med råvarer fra fjellene" (mountain sourcing, Norwegian pride)

---

## Implementation Strategy: Location Personality Injection

### Step 1: Classify Location Personality (Deterministic)

**Create:** `location-personality.ts` (alongside `location-enrichment.ts`)

```typescript
interface LocationPersonality {
  urban_intensity: 'high' | 'medium' | 'low';
  waterfront_type?: 'active_harbor' | 'calm_river' | 'industrial' | 'beach' | null;
  tourist_balance: 'tourist_heavy' | 'mixed' | 'local_focused';
  cultural_modifier: 'denmark_understatement' | 'usa_enthusiasm' | 'sweden_lagom' | 'norway_nature';
}

function computeLocationPersonality(
  location: LocationInput,
  country: string,
  touristContext: boolean,
  areaType: string
): LocationPersonality {
  // Urban intensity: derive from city tier + area type
  const urbanIntensity = determineUrbanIntensity(location.city, areaType);
  
  // Waterfront type: if area_type=waterfront, classify which kind
  const waterfrontType = areaType === 'waterfront' 
    ? classifyWaterfrontType(location, waterfrontTerm)
    : null;
  
  // Tourist balance: use existing tourist_context data
  const touristBalance = touristContext 
    ? 'tourist_heavy' 
    : (/* check website language signals */) 
      ? 'mixed' 
      : 'local_focused';
  
  // Cultural modifier: from country code
  const culturalModifier = getCulturalModifier(country);
  
  return { urbanIntensity, waterfrontType, touristBalance, culturalModifier };
}
```

**Data Sources (all existing):**
- Urban intensity: `city_tier` from location enrichment
- Waterfront type: `waterfront_term` + coordinates
- Tourist balance: `tourist_context` from location intelligence
- Cultural modifier: `country` from business data

### Step 2: Inject into Prompt Context

**Add to Prompt B (location context section):**

```typescript
LOCATION PERSONALITY (use these voice modifiers):

Urban Intensity: ${personality.urbanIntensity}
${personality.urbanIntensity === 'high' 
  ? '→ Fast-paced voice, clock precision, less small-talk'
  : personality.urbanIntensity === 'low'
    ? '→ Community-focused voice, assumes repeat visits, intimate tone'
    : '→ Balanced pace, neighborly tone'}

${personality.waterfrontType ? `
Waterfront Type: ${personality.waterfrontType}
${personality.waterfrontType === 'calm_river' 
  ? '→ Peaceful voice, nature-adjacent sensory details (running water, birds)'
  : personality.waterfrontType === 'active_harbor'
    ? '→ Dynamic voice, movement sensory details (boats, seagulls, masts)'
    : '→ Authentic voice, industrial sensory details'}
` : ''}

Tourist Balance: ${personality.touristBalance}
${personality.touristBalance === 'local_focused'
  ? '→ Insider language allowed, Danish cultural shortcuts okay'
  : personality.touristBalance === 'tourist_heavy'
    ? '→ Explanatory voice, fewer Danish idioms, clearer context'
    : '→ Balanced voice, code-switching allowed'}

Cultural Voice Modifier: ${personality.culturalModifier}
${personality.culturalModifier === 'denmark_understatement'
  ? '→ DANISH UNDERSTATEMENT: Afslappet tone, anti-superlative, "det er okay at være almindelig". FORBIDDEN: "best", "amazing", "incredible"'
  : personality.culturalModifier === 'usa_enthusiasm'
    ? '→ USA ENTHUSIASM: Energetic tone, value proposition explicit, convenience highlighted. ALLOWED: "best", "favorite", "amazing"'
    : /* other cultural modifiers */}
```

**Key Design Features:**
- ✅ NO hardcoded city names in voice guidance
- ✅ Pattern-based modifiers derived from data signals
- ✅ Conditional injection (waterfront only if relevant)
- ✅ Explicit voice rules for each dimension
- ✅ Cultural context from country, not assumptions

### Step 3: Sensory Detail Banks (Location-Aware)

**Create:** Sensory suggestion lists based on location personality

```typescript
// In prompt, add location-aware sensory suggestions

SENSORY DETAIL SUGGESTIONS (choose what fits this location):

${personality.waterfrontType === 'calm_river' ? `
Waterfront (calm river) sensory bank:
⚠️ VISUAL ONLY — you cannot hear calm rivers/lakes
- "udsigt til åen" (what you see)
- "når solen rammer vandet" (visual, temporal)
- "folk der går tur langs åen" (movement, observable activity)
- "grønt lige udenfor" (visual, spatial)
- "kølig luft fra åen" (temperature, if verifiable)
- ❌ NO "lyden af åen" — water too calm to hear
` : ''}

${personality.waterfrontType === 'active_harbor' ? `
Waterfront (active harbor) sensory bank:
VISUAL + ACTIVITY sounds (NOT water sounds)
- "udsigt til sejlbådene" (visual)
- "både der kommer og går" (movement)
- "lyden af båd-motorer" (activity sound, okay)
- "måger" (animal sound, okay)
- "aktivitet på kajen" (observable movement)
- ❌ NO "lyden af vandet" — use boat/activity sounds instead
` : ''}

${personality.waterfrontType === 'beach' ? `
Waterfront (sea/coast) sensory bank:
✅ ONLY waterfront type where water sounds work
- "udsigt til havet" (visual)
- "lyden af bølger" (sound — SEA ONLY)
- "vinden fra havet" (sound + temperature)
- "når solen rammer sandet" (visual, temporal)
- "salt luft" (smell, but cliché risk)
` : ''}

${personality.urbanIntensity === 'high' ? `
Urban intensity (high) sensory bank:
- "støjen fra gaden" (sound — urban okay)
- "folk der kommer og går" (movement)
- "kl. 7-morgen travlhed, kl. 14 ro" (temporal transitions)
- "lys fra trafikken udenfor" (visual)
` : ''}

NOTE: These are EXAMPLES only — use location's actual features, not templates.
PRIORITY: Visual details (safest) → Temporal → Movement → Sound (only if appropriate)
```

**Why this works:**
- Examples are location-TYPE specific, not business-specific
- Banks are conditional (only shown if relevant)
- Explicit note that these are inspiration, not templates
- AI can mix/match with actual venue features

---

## Implementation Estimate: Location Personality System

### Time Breakdown

**Step 1: Location Personality Classification (2 hours)**
- 1 hour: Create `location-personality.ts` with classification logic
- 30 min: Integrate with existing location enrichment
- 30 min: Add to data-gatherer pipeline

**Step 2: Prompt Injection (1.5 hours)**
- 1 hour: Add personality sections to prompt-b.ts
- 30 min: Test conditional rendering

**Step 3: Sensory Detail Banks (1 hour)**
- 45 min: Create location-aware sensory suggestion banks
- 15 min: Add to prompt context

**Step 4: Cultural Modifier System (1 hour)**
- 30 min: Define cultural voice rules (Denmark, USA, Sweden, Norway)
- 30 min: Inject based on country code

**Total:** 5.5 hours (separate from other voice quality work)

---

## Testing: Location Personality Variation

### Test Case 1: Aarhus ved åen (Calm River, Local-Focused)
**Business:** Café Faust  
**Expected Personality:**
- Urban intensity: medium (second-tier city)
- Waterfront type: calm_river (Aarhus Å)
- Tourist balance: local_focused
- Cultural modifier: denmark_understatement

**Expected Voice:**
- ✅ "Udsigt til åen når du sidder ude" (VISUAL — calm river sensory, NO sound)
- ✅ "Folk der går tur langs åen" (MOVEMENT — observable activity)
- ✅ "Når du skal have en pause" (Danish understatement)
- ✅ Insider language okay (local-focused)
- ❌ NO "Lyden af åen" (calm rivers too quiet — use visual details)
- ❌ NO "Best café in Aarhus" (anti-superlative)
- ❌ NO generic "ved vandet" (specific "ved åen")

### Test Case 2: Copenhagen Nyhavn (Active Harbor, Tourist-Heavy)
**Expected Personality:**
- Urban intensity: high
- Waterfront type: active_harbor
- Tourist balance: tourist_heavy
- Cultural modifier: denmark_understatement (but moderated for tourists)

**Expected Voice:**
- ✅ "Udsigt til sejlbådene" (VISUAL — active harbor)
- ✅ "Lyden af båd-motorer og måger" (ACTIVITY SOUNDS — not water sounds)
- ✅ Explanatory language (tourist audience)
- ✅ Less Danish idioms, clearer context
- ✅ Fast-paced, efficient voice
- ❌ NO "lyden af vandet/havet" (use boat/activity sounds instead)
- ❌ NO insider shortcuts (tourist-heavy)

### Test Case 3: USA Location (if supported)
**Expected Personality:**
- Cultural modifier: usa_enthusiasm

**Expected Voice:**
- ✅ "Your favorite morning coffee spot"
- ✅ Value proposition explicit
- ✅ Convenience highlighted
- ✅ Allowed to use "best", "amazing", "love"
- ❌ NO Danish understatement

---

## Success Criteria (Updated)

### Waterfront Term Injection (Issue 1) ✅
- [x] Café Faust uses "ved åen" not "ved vandet"
- [x] Term detected from city/address/business name
- [x] Injected into business_character, brand_essence
- [x] Fallback to "ved vandet" only when detection fails

### Voice Quality (Issue 2) ⏳
- [ ] ≥1 sensory detail per major field
- [ ] 0 abstract language ("dynamisk atmosfære", "fleksibel stemning")
- [ ] Guest perspective enforced (no "Vi tilbyder", "Vores koncept")
- [ ] Emotional positioning present ("det velfortjente stop")
- [ ] Quality validator catches violations

### Location Personality Variation (Issue 3) ⏳
- [ ] Aarhus venues get calm_river sensory (if ved åen)
- [ ] Copenhagen venues get urban intensity modifiers
- [ ] Tourist-heavy locations use explanatory language
- [ ] Local-focused locations can use Danish idioms
- [ ] Cultural modifiers apply correctly (Denmark understatement)
- [ ] NO hardcoded city names in voice rules

---

## Priority & Sequencing

### Completed ✅
**Issue 1: Waterfront Term Injection** (1.5 hours)
- Implemented and tested successfully
- "ved åen" appearing correctly in Café Faust output

### Next Priority: Voice Quality (Issue 2)
**Rationale:** Core voice improvement affects ALL venues
**Estimated:** 5 hours
**Impact:** Medium-High (fixes abstract language, adds warmth)
**Dependencies:** None (can implement immediately)

### Later: Location Personality (Issue 3)
**Rationale:** Refinement layer on top of base voice quality
**Estimated:** 5.5 hours
**Impact:** Medium (adds location-specific nuance)
**Dependencies:** Should implement after Issue 2 (voice quality base layer)

### Total Remaining Work
- Issue 2: 5 hours
- Issue 3: 5.5 hours
- **Total:** 10.5 hours

---

## Final Notes

### Why Location Personality Matters
User insight: "Denmark vs USA, Copenhagen Vesterbro vs Aarhus ved åen differences matter"

Current implementation treats all Danish venues identically. But:
- A Vesterbro café near Central Station needs fast-paced, international voice
- An Aarhus ved åen café can use more intimate, river-focused language
- Tourist areas need less insider language than neighborhood spots

Location personality isn't about hardcoding rules—it's about deriving voice modifiers from **data signals we already have:**
- City tier → urban intensity
- Waterfront term + coordinates → waterfront personality
- Tourist context → audience balance
- Country code → cultural voice modifier

### Implementation Philosophy
Every enhancement follows the same pattern:
1. ✅ Derive from existing data (no new data gathering)
2. ✅ Pattern-based rules (no business-specific hardcoding)
3. ✅ Conditional injection (only show what's relevant)
4. ✅ Explicit voice guidance (tell AI HOW, not just WHAT)
5. ✅ Quality validation (catch violations automatically)

This ensures the system remains:
- **Scalable** (works for ANY venue type, ANY location)
- **Maintainable** (no hardcoded examples to update)
- **Testable** (deterministic outputs from data signals)
- **Authentic** (voice matches actual location personality)
**Before:** "Café, restaurant og bar med stor udendørs terrasse ved åen..."  
**After:** "Det velfortjente stop ved åen — kaffe om morgenen, drinks når du skal have det godt"  
**Metrics:**
- Sensory details: 0 → ≥1 per major field
- Abstract language: 2-3 instances → 0
- Perspective: Mixed → Guest-only

### Test 3: Diversity Still Controlled
**Business:** Café Faust  
**Metric:** Feature repetition still <43% (preferably <30%)  
**Verify:** "ved åen" not in >40% of fields

---

## Success Criteria

### Quantitative
- ✅ Specific waterfront term used (not generic "waterfront")
- ✅ ≥1 sensory detail per major field
- ✅ 0 forbidden abstractions detected
- ✅ Feature repetition <30%
- ✅ No café-perspective language ("Vi tilbyder")

### Qualitative
- ✅ Voice sounds warm, not clinical
- ✅ Feels like friend recommendation, not brochure
- ✅ Emotional positioning clear ("det velfortjente stop")
- ✅ Concrete details make it feel real
- ✅ Local language authenticity (åen not waterfront)

### Overall Goal
**Voice Quality: 8/10 → 9/10**
- Structure: Maintained at 8/10 ✅
- Warmth: 5/10 → 9/10 ⬆️
- Authenticity: 6/10 → 9/10 ⬆️
- Sensory grounding: 3/10 → 8/10 ⬆️

---

## Risk Mitigation

### Risk 1: AI Doesn't Follow New Instructions
**Mitigation:** Quality checkpoint catches violations and surfaces warnings

### Risk 2: Voice Quality Improvements Break Diversity Control
**Mitigation:** Keep existing diversity validator, test both metrics

### Risk 3: Waterfront Term Detection Fails
**Mitigation:** Fallback to "vandet" (generic but Danish), never English "waterfront"

### Risk 4: Too Much Menu Specificity
**Mitigation:** Clear rules (emotional anchor only, not lists), validator detects violations

---

## Questions for Approval

1. **Waterfront term injection approach** - Should we build full location intelligence (1.5hr) or start with simple city-name mapping (30min)?

2. **Voice quality examples** - Are the pattern-based examples (❌ vs ✅) clear enough as "AI-helping" without being "business-specific"?

3. **Sensory detail requirement** - Is "≥1 per major field" the right threshold, or should we require more?

4. **Menu specificity permission** - Should we allow specific menu items at all, or keep it generic to categories (brunch, frokost, cocktails)?

5. **Implementation order** - Should we do waterfront injection first (quick win) or voice quality layer first (bigger impact)?

---

**Next Step:** Await approval and answers to questions, then proceed with implementation.
