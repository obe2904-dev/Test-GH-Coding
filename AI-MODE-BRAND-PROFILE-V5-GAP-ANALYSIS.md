# AI Mode (`/dashboard/create?mode=ai`) - Brand Profile V5 Gap Analysis

**Date**: May 23, 2026  
**Scope**: Assessment of current AI mode implementation vs. new Brand Profile V5 + Business Identity Persona  
**Purpose**: Identify where to incorporate new Brand Profile fields to achieve 100% business-specific content

---

## Executive Summary

**Current Status**: ✅ **V5-INTEGRATED** (as of May 2026)

The AI mode (`/dashboard/create?mode=ai`) has been successfully migrated to Brand Profile V5 through multiple phases:
- ✅ Phase 3: `generate-text-from-idea` (100% critical fields)
- ✅ Dagens Forslag: `get-quick-suggestions` (88% coverage)
- ✅ All AI systems now read from `brand_profile_v5` JSONB

**Key Finding**: The new **Business Identity Persona** (`layer_0_intelligence.business_identity.system_persona`) from Brand Profile V5 is **NOT YET USED** in the AI mode prompts despite being available in the V5 structure.

**Recommendation**: ADD business identity persona to content generation prompts to further enhance business-specific understanding and reduce generic content.

---

## Current Architecture

### 1. Data Flow for `/dashboard/create?mode=ai`

```
User clicks "Dagens Forslag" (AI Ideas)
        ↓
  ┌──────────────────────────────────┐
  │  get-quick-suggestions           │
  │  (Gemini 2.5 Flash)              │
  │  Generates 3 suggestion cards    │
  └──────────────┬───────────────────┘
                 ↓
         Saves to daily_suggestions table
                 ↓
         User selects a suggestion
                 ↓
  ┌──────────────────────────────────┐
  │  generate-text-from-idea         │
  │  (GPT-4o / GPT-4o-mini)          │
  │  Generates final caption text    │
  └──────────────────────────────────┘
```

### 2. Brand Profile V5 Integration Status

| Component | V5 Integration | Coverage | Deployment |
|-----------|---------------|----------|------------|
| `get-quick-suggestions` | ✅ Integrated | 88% (14/16 fields) | 176.9kB |
| `generate-text-from-idea` | ✅ Integrated | 100% critical | 172.8kB |
| UI: `CreatePostPage.tsx` | ✅ Using V5 data | - | - |

---

## Brand Profile V5 Structure Overview

### Layer 0: Business Intelligence

```typescript
{
  layer_0_intelligence: {
    // Business Type (AI-detected)
    business_type: {
      detected_type: "hybrid_cafe",
      professional_domain: "all-day dining",
      confidence: 0.90,
      reasoning: "..."
    },
    
    // ⭐ NEW: Business Identity Persona (WHO the business IS)
    business_identity: {
      system_persona: "Cafe Faust er en hybrid cafe i Aarhus, der kombinerer all-day dining med en bred menu af dansk og international mad. Med 195 retter fordelt over 6 menukort tilbyder stedet alt fra morgenmad til cocktails sent om aftenen..." (~150 words),
      metadata: {
        culinary_character: "...",
        service_model: "all-day",
        price_positioning: "mid-range",
        atmosphere_keywords: ["..."]
      }
    },
    
    // Cross-Menu Summary
    menu_overview: {
      cross_menu_summary: "...",
      signature_themes: [
        "Dansk og International Fusion",
        "Amerikansk Diner-stil",
        "Hjemmelavet og Lokal Identitet",
        "Sundhed og Diætbevidsthed",
        "Eksklusivitet og Autenticitet",
        "Cocktail Innovation",
        "All-day Dining med Brunch-fokus"
      ],
      gastronomic_profile: "..."
    },
    
    // City Context (AI-generated, 90-day cache)
    city_context_ai: {
      city: "Aarhus",
      cultural_context: "Danmarks næststørste by, stor studiepopu...",
      characteristics: [...]
    },
    
    // Geographic Context
    geographic_context: {
      postal_code: "8000",
      location_type: "waterfront",
      signature_reference: "ved åen",
      narrative: "..."
    }
  }
}
```

### Voice Structure

```typescript
{
  voice: {
    tone_rules: [
      "Brug korte, præcise sætninger...",
      "Inddrag lokale referencer, fx 'ved åen'...",
      "Vær direkte og personlig...",
      "Fremhæv menuens alsidighed...",
      "Brug let humor og legende vendinger..."
    ],
    personality_traits: ["direkte", "venlig", "lokal", "legende"],
    formality_level: "informal",
    humor_style: "playful",
    sentence_structure: "conversational",
    voice_confidence: 0.8,
    voice_reasoning: "AI-genereret stemmeprofil baseret på omfattende business intelligence...",
    enforcement_level: "moderate",
    sentence_length_max: 15
  }
}
```

### Writing Examples

```typescript
{
  writing_examples: {
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
}
```

### Guardrails

```typescript
{
  guardrails: {
    never_say: [
      { wrong: "billig", right: "god værdi" },
      { wrong: "lækkert", right: "sprød eller cremet" },
      { wrong: "fantastisk", right: "(fjern ordet)" },
      { wrong: "unik", right: "noget du ikke finder ved åen" },
      { wrong: "perfekt", right: "lige som mor laver det" }
    ],
    content_exclusions: [
      "Undgå at diskutere følsomme sundhedsemner...",
      "Ingen omtale af alkohol eller rusmidler på en måde der opfordrer til overforbrug",
      "Undgå at inkludere negativ eller stødende sprogbrug..."
    ],
    factual_constraints: [
      "Opfind aldrig events, tilbud, musik eller arrangementer",
      "Bekræft åbningstider før nævnelse",
      "Ingen påstande om \"bedst\", \"første\" eller superlatives uden dokumentation",
      "Verificer menupunkter eksisterer før omtale"
    ]
  }
}
```

---

## Current Implementation Mapping

### A. `get-quick-suggestions` (Idea Generation)

**File**: `supabase/functions/get-quick-suggestions/index.ts`

**Brand Profile Fields Currently Used**:

| V5 Field Path | Legacy Fallback | Usage | Status |
|--------------|-----------------|-------|--------|
| `v5.voice.tone_rules` | `tone_model.writing_rules` → `tone_of_voice` | Writing style | ✅ V5-first |
| `v5.guardrails.never_say` | `never_say` | Word bans | ✅ V5-first |
| `v5.voice.personality_traits` | `tone_keywords` | Tone attributes | ✅ V5-first |
| `v5.voice.content_anchors` | `tone_model.content_anchors` | Natural moments | ✅ V5-first |
| `v5.identity.brand_essence` | `brand_essence` | Brand identity | ✅ V5-first |
| `v5.identity.business_description` | `business_character` | What the place is | ✅ V5-first |
| `v5.voice.humor_style` | `humor_level` | Humor register | ✅ V5-first |
| `v5.writing_examples.typical_openings` | `typical_openings` | Opening phrases | ✅ V5-first |
| - | `menu_overview_summary` | Menu intelligence | ✅ Separate column |
| - | `signature_themes` | 7 themes | ✅ Separate column |

**NOT Currently Used**:
- ❌ `layer_0_intelligence.business_identity.system_persona` ← **NEW FIELD**
- ❌ `layer_0_intelligence.business_identity.metadata.culinary_character`
- ❌ `layer_0_intelligence.menu_overview.gastronomic_profile`
- ❌ `layer_0_intelligence.city_context_ai.cultural_context`
- ❌ `voice.voice_reasoning` (detailed reasoning for voice decisions)
- ❌ `guardrails.factual_constraints` (fact-checking rules)

### B. `generate-text-from-idea` (Caption Generation)

**File**: `supabase/functions/generate-text-from-idea/prompt-builders.ts`

**Brand Profile Fields Currently Used**:

| V5 Field Path | Legacy Fallback | Prompt Section | Status |
|--------------|-----------------|----------------|--------|
| `v5.voice.tone_rules` | `tone_model.writing_rules` | BRANDSTEMME | ✅ V5-first |
| `v5.voice.emoji_level` | `tone_model.emoji_level` | Emoji instruction | ✅ V5-first |
| `v5.writing_examples.good_examples` | `tone_model.good_examples` | Good examples | ✅ V5-first |
| `v5.writing_examples.prefer_vocabulary` | `voice_examples.vocabulary.prefer` | Preferred words | ✅ V5-first |
| `v5.writing_examples.avoid_vocabulary` | `voice_examples.vocabulary.avoid` | Banned words | ✅ V5-first |
| `v5.writing_examples.signature_phrases` | `signature_phrases` | Brand phrases | ✅ V5-first |
| `v5.voice.avoid_examples` | `things_to_avoid` | Avoid patterns | ✅ V5-first |
| `v5.voice.register_guidance` | `voice_constraints` | Voice principles | ✅ V5-first |
| `v5.identity.business_description` | `business_character` | Business context | ✅ V5-first |
| `v5.writing_examples.typical_openings` | - | Opening register | ✅ V5-first |

**NOT Currently Used**:
- ❌ `layer_0_intelligence.business_identity.system_persona` ← **NEW FIELD**
- ❌ `layer_0_intelligence.business_identity.metadata.culinary_character`
- ❌ `layer_0_intelligence.menu_overview.gastronomic_profile`
- ❌ `layer_0_intelligence.city_context_ai.cultural_context`
- ❌ `voice.voice_reasoning` (context for why voice is structured this way)
- ❌ `guardrails.factual_constraints` (fact-checking enforcement)

---

## Gap Analysis: What's Missing

### 🆕 1. Business Identity Persona (system_persona)

**Location**: `brand_profile_v5.layer_0_intelligence.business_identity.system_persona`

**Example Value** (Café Faust):
```
"Cafe Faust er en hybrid cafe i Aarhus, der kombinerer all-day dining med 
en bred menu af dansk og international mad. Med 195 retter fordelt over 6 
menukort tilbyder stedet alt fra morgenmad til cocktails sent om aftenen. 
Menuen spænder fra klassisk dansk smørrebrød og pariserbøf til internationale 
favoritter som falafel, eggs benedict og moules frites. KULINARISK KARAKTER: 
Stedet kendetegnes ved en fusion af madtraditioner med hjemmelavede komponenter 
som FAUST dressing, hjemmelavet nutella og salmon rillettes..."
```

**Purpose**: 
- Provides AI with comprehensive business understanding in ~150 words
- Prevents product hallucination (specific dish names mentioned)
- Contextualizes the business type, service model, and culinary positioning
- Generated by GPT-4o with temp 0.3 specifically for AI consumption

**Current Gaps**:
1. ❌ Not included in `get-quick-suggestions` context block
2. ❌ Not included in `generate-text-from-idea` system message
3. ❌ AI must currently infer business understanding from fragmented fields

**Where to Use**:
- **Idea Generation**: Add to context block BEFORE menu items (sets expectations)
- **Text Generation**: Add to system message BEFORE brand voice (anchors factual understanding)

**Impact**: **HIGH** - This is the most comprehensive business description designed specifically for AI; using it would significantly reduce generic suggestions

---

### 🆕 2. Gastronomic Profile

**Location**: `business_brand_profile.gastronomic_profile` (separate column, also in menu_overview)

**Example Value** (Café Faust):
```
"Dansk madkultur møder international fusion med hjemmelavede signaturer."
```

**Purpose**:
- Concise 2-3 sentence culinary positioning
- Higher-level than individual signature themes
- Perfect for framing menu posts without listing all 7 themes

**Current Gap**:
- ✅ Already stored in database
- ❌ Not used in prompts despite being more concise than listing all signature_themes

**Where to Use**:
- **Idea Generation**: Replace verbose theme lists with this concise statement
- **Text Generation**: Use as culinary anchor in BRANDSTEMME block

**Impact**: **MEDIUM** - Provides cleaner, more focused culinary framing

---

### 🆕 3. City Cultural Context

**Location**: `brand_profile_v5.layer_0_intelligence.city_context_ai.cultural_context`

**Example Value** (Café Faust - Aarhus):
```
"Danmarks næststørste by, stor studiepopulation, kulturel mangfoldighed, 
Aarhus Å som central reference"
```

**Purpose**:
- AI-generated city characteristics (90-day cache)
- Helps AI understand local context without manual configuration
- Enables location-specific language ("studiebyen", "ved åen")

**Current Gap**:
- ❌ Not used in prompts
- ❌ Currently relying on manual `local_location_reference` field only

**Where to Use**:
- **Text Generation**: Add to location context for atmosphere/behind-the-scenes posts

**Impact**: **LOW-MEDIUM** - Adds cultural nuance but not critical for basic functionality

---

### 🆕 4. Voice Reasoning

**Location**: `brand_profile_v5.voice.voice_reasoning`

**Example Value** (Café Faust):
```
"AI-genereret stemmeprofil baseret på omfattende business intelligence.

Kontekst-faktorer analyseret:
• kulturel kontekst (Aarhus, studieby, waterfront)
• målgrupper (waterfront (95 score), city_centre (85 score))
• prisniveau (mid-range)
• område (Ikonisk gade langs Aarhus Å...)
• arketype: versatile_casual_waterfront

Vigtigste påvirkninger:
• Menu-temaer: Dansk og International Fusion, Amerikansk Diner-stil, 
  Hjemmelavet og Lokal Identitet
• Tone: uformel med 'direkte, venlig, lokal' personlighed
• Geografisk tilpasning: Aarhus"
```

**Purpose**:
- Explains WHY the voice is structured the way it is
- Helps AI understand the rationale behind tone rules
- Provides transparency into voice generation process

**Current Gap**:
- ❌ Not used in prompts (design decision: could add noise vs. clarity)

**Where to Use**:
- ⚠️ **OPTIONAL**: Could add to system message for additional context
- ⚠️ **RISK**: May add token overhead without clear benefit

**Impact**: **LOW** - Nice-to-have but not critical; may add prompt bloat

---

### 🆕 5. Factual Constraints

**Location**: `brand_profile_v5.guardrails.factual_constraints`

**Example Value**:
```typescript
[
  "Opfind aldrig events, tilbud, musik eller arrangementer",
  "Bekræft åbningstider før nævnelse",
  "Ingen påstande om 'bedst', 'første' eller superlatives uden dokumentation",
  "Verificer menupunkter eksisterer før omtale"
]
```

**Purpose**:
- Hard constraints on factual accuracy
- Prevents AI from inventing events, dishes, or claims
- Critical for avoiding misinformation

**Current Status**:
- ✅ Stored in V5 structure
- ❌ Not explicitly injected into prompts (relying on general "don't invent" rules)

**Where to Use**:
- **Text Generation**: Add to KRITISKE REGLER section (Tier 1 constraints)
- **Idea Generation**: Add to suggestion validation rules

**Impact**: **MEDIUM-HIGH** - Reduces hallucination risk; should be explicitly enforced

---

### 🆕 6. Programme-Specific Data

**Location**: `brand_profile_v5.programmes[]`

**Example Structure**:
```typescript
{
  type: "morning",
  name: "Morgenmad/Brunch",
  timeWindow: { start: "07:00", end: "11:00" },
  commercialOrientation: {
    decision_timing: "spontaneous_walk_in",
    baseline_goal_split: {
      drive_footfall: 0.70,
      strengthen_brand: 0.20,
      retain_guests: 0.10
    }
  },
  audienceSegments: [
    {
      segment_name: "Spontane brunch-gæster",
      motivation: "social_gathering",
      timing_preference: "Lør-Søn 10:00-14:00",
      content_angle: "Social brunch-oplevelse ved åen",
      confidence: 0.9
    }
  ]
}
```

**Purpose**:
- Time-specific commercial strategy
- Audience segments per service period
- Content angles tailored to programme

**Current Status**:
- ✅ Stored in V5 structure
- ❌ Not used in AI mode (only used in Weekly Plan system)

**Where to Use**:
- **Idea Generation**: Match current time to programme → use relevant audience segments
- **Text Generation**: Inject programme-specific commercial orientation

**Impact**: **MEDIUM** - Would enable time-aware suggestions (brunch posts in morning, dinner posts in evening)

---

## Recommended Implementation Plan

### Priority 1: Add Business Identity Persona (HIGH Impact, LOW Effort)

**Files to Modify**:
1. `supabase/functions/get-quick-suggestions/index.ts`
2. `supabase/functions/generate-text-from-idea/resolve-context.ts`
3. `supabase/functions/generate-text-from-idea/prompt-builders.ts`

**Changes Required**:

#### A. `get-quick-suggestions/index.ts`

**Current Context Block** (~line 1400):
```typescript
// Build context block
const contextParts = []
if (brandProfile.business_character) {
  contextParts.push(`Business character: ${brandProfile.business_character}`)
}
```

**ADD BEFORE business_character**:
```typescript
// V5-first: business_identity.system_persona → business_character fallback
const businessPersona = v5?.layer_0_intelligence?.business_identity?.system_persona
  ?? brandProfile.business_character
  ?? ''

if (businessPersona) {
  contextParts.push(`\nHVAD DETTE STED ER (komplet beskrivelse):\n${businessPersona}\n`)
}
```

#### B. `generate-text-from-idea/resolve-context.ts`

**Current Code** (~line 400):
```typescript
businessCharacter: brandProfile.business_character || '',
```

**REPLACE WITH**:
```typescript
// V5-first: system_persona provides richer context than business_character
businessPersona: v5?.layer_0_intelligence?.business_identity?.system_persona
  ?? brandProfile.business_character
  ?? '',
businessCharacter: brandProfile.business_character || '',  // Keep for backward compat
```

#### C. `generate-text-from-idea/prompt-builders.ts`

**Current Brand Block** (~line 180):
```typescript
if (o.businessCharacter) b += `\nHvad dette sted er: ${o.businessCharacter}`
```

**REPLACE WITH**:
```typescript
// Prefer system_persona (150-word AI-optimized description) over short business_character
if ((o as any).businessPersona) {
  b += `\n\n📍 HVAD DETTE STED ER (brug dette som faktuel forståelsesramme — IKKE som copy-materiale at citere):\n${(o as any).businessPersona}`
} else if (o.businessCharacter) {
  b += `\nHvad dette sted er: ${o.businessCharacter}`
}
```

**Effort**: 2-3 hours  
**Risk**: LOW (fallback chain ensures backward compatibility)  
**Expected Improvement**: 20-30% reduction in generic suggestions; better dish-specific ideas

---

### Priority 2: Add Gastronomic Profile (MEDIUM Impact, LOW Effort)

**Files to Modify**:
1. `supabase/functions/get-quick-suggestions/index.ts`
2. `supabase/functions/generate-text-from-idea/prompt-builders.ts`

**Changes Required**:

#### A. `get-quick-suggestions/index.ts`

**Current Menu Block** (~line 1500):
```typescript
// Signature themes (7 themes from menu intelligence)
if (brandProfile.signature_themes?.length) {
  menuParts.push(`Signature themes: ${brandProfile.signature_themes.join(', ')}`)
}
```

**ADD BEFORE signature_themes**:
```typescript
// V5-first: gastronomic_profile (concise) → signature_themes (detailed) fallback
const gastronomicProfile = brandProfile.gastronomic_profile
  ?? (brandProfile.signature_themes?.length 
    ? brandProfile.signature_themes.join(', ') 
    : '')

if (gastronomicProfile) {
  menuParts.push(`\nKULINARISK PROFIL: ${gastronomicProfile}`)
}
```

#### B. `generate-text-from-idea/prompt-builders.ts`

**Current Brand Block**:
```typescript
if (o.contentAnchors.length) b += `\nKonceptankre (hvad dette sted faktisk tilbyder): ${o.contentAnchors.join(', ')}`
```

**ADD AFTER contentAnchors**:
```typescript
if ((o as any).gastronomicProfile) {
  b += `\nKulinarisk identitet: ${(o as any).gastronomicProfile}`
}
```

**Effort**: 1 hour  
**Risk**: VERY LOW  
**Expected Improvement**: More focused culinary framing; cleaner than listing all themes

---

### Priority 3: Add Factual Constraints to Tier 1 Rules (MEDIUM-HIGH Impact, LOW Effort)

**Files to Modify**:
1. `supabase/functions/generate-text-from-idea/prompt-builders.ts`

**Changes Required**:

**Current Tier 1 Block** (~line 150):
```typescript
let constraints = '═══ KRITISKE REGLER (obligatorisk overholdelse) ═══\n'

// Structural rules...
// Banned patterns...
// Voice rationale...
```

**ADD BEFORE validation checkpoint**:
```typescript
// Factual constraints from V5 guardrails
const factualConstraints = (o as any).brandProfileV5?.guardrails?.factual_constraints
if (factualConstraints?.length) {
  constraints += '\n🚨 FAKTA-FORBUD (brud på disse regler gør indholdet ubrugeligt):\n'
  factualConstraints.forEach((rule: string) => {
    constraints += `• ${rule}\n`
  })
}
```

**Effort**: 30 minutes  
**Risk**: VERY LOW  
**Expected Improvement**: Explicit enforcement of fact-checking rules; reduced hallucination

---

### Priority 4: Programme-Aware Suggestions (MEDIUM Impact, MEDIUM Effort)

**Files to Modify**:
1. `supabase/functions/get-quick-suggestions/index.ts`

**Changes Required**:

**Current Time Detection** (~line 800):
```typescript
const now = new Date()
const hourOfDay = now.getHours()
```

**ADD Programme Matching**:
```typescript
// Match current hour to programme
const programmes = v5?.programmes ?? []
const activeProgramme = programmes.find(p => {
  const start = parseInt(p.timeWindow?.start?.split(':')[0] ?? '0')
  const end = parseInt(p.timeWindow?.end?.split(':')[0] ?? '24')
  return hourOfDay >= start && hourOfDay < end
})

// Use programme-specific audience segments if available
const audienceSegments = activeProgramme?.audienceSegments ?? []
if (audienceSegments.length > 0) {
  contextParts.push(`\nAKTIVT PROGRAM: ${activeProgramme.name}`)
  const primarySegment = audienceSegments.find(s => s.confidence > 0.8) ?? audienceSegments[0]
  if (primarySegment) {
    contextParts.push(`MÅLGRUPPE (${activeProgramme.name}): ${primarySegment.segment_name} — ${primarySegment.motivation}`)
    if (primarySegment.content_angle) {
      contextParts.push(`CONTENT ANGLE: ${primarySegment.content_angle}`)
    }
  }
}
```

**Effort**: 3-4 hours (includes testing across different times of day)  
**Risk**: LOW-MEDIUM (requires testing to ensure correct programme matching)  
**Expected Improvement**: Time-appropriate suggestions (brunch posts in morning, dinner in evening)

---

## Where to Leave As-Is

### 1. Voice Reasoning (`voice.voice_reasoning`)
**Decision**: ❌ Do NOT add to prompts  
**Rationale**: 
- Adds significant token overhead (200-300 words)
- AI already has voice rules directly; reasoning is meta-commentary
- Risk of confusing the model with "why" when "what" is clear
- Better used for human review/debugging than AI consumption

### 2. City Cultural Context (`city_context_ai.cultural_context`)
**Decision**: ⏸️ DEFER (optional enhancement)  
**Rationale**:
- `local_location_reference` already provides key location anchor ("ved åen")
- Cultural context is nice-to-have but not critical for basic functionality
- Risk of adding too much location framing at expense of product focus
- Consider for Phase 2 if location-based posts need more depth

### 3. Legacy Venue Fields (`venue_scene`, `venue_identity`)
**Decision**: ✅ Keep as-is  
**Rationale**:
- These are already correctly positioned for atmosphere/behind-the-scenes posts
- NOT part of layer_0_intelligence (separate venue analysis)
- Current implementation is working well
- No changes needed

### 4. Menu Intelligence Fields (`signature_themes`, `menu_overview_summary`)
**Decision**: ✅ Keep separate columns  
**Rationale**:
- These are stored as separate columns (not just in JSONB) for query performance
- `signature_themes` is working well as array field
- `menu_overview_summary` provides detailed menu intelligence
- Current architecture is optimal

---

## Summary of Recommendations

### ✅ Implement Now (High ROI, Low Risk)

| Enhancement | Files | Effort | Impact | Risk |
|------------|-------|--------|--------|------|
| 1. Business Identity Persona | 3 files | 2-3 hrs | **HIGH** | LOW |
| 2. Gastronomic Profile | 2 files | 1 hr | MEDIUM | VERY LOW |
| 3. Factual Constraints | 1 file | 30 min | MEDIUM-HIGH | VERY LOW |

**Total Effort**: ~4 hours  
**Expected Impact**: **30-40% improvement in business-specific content quality**

### ⏸️ Consider for Phase 2 (Medium ROI, Medium Risk)

| Enhancement | Effort | Impact | Risk | Notes |
|------------|--------|--------|------|-------|
| 4. Programme-Aware Suggestions | 3-4 hrs | MEDIUM | LOW-MED | Requires time-based testing |
| 5. City Cultural Context | 1-2 hrs | LOW-MED | LOW | Nice-to-have for location posts |

### ❌ Do NOT Implement (Low ROI or High Risk)

| Field | Reason |
|-------|--------|
| Voice Reasoning | Token overhead, meta-commentary not actionable |
| Legacy venue fields | Already correctly implemented |
| Menu separate columns | Current architecture optimal |

---

## Expected Outcomes

### Before Enhancements
**Example AI Suggestion** (Generic):
```
TITLE: "Smag vores lækre brunch-menu"
WHY: "Perfekt start på weekenden med friske retter"
PHOTO: "Tæt på brunch-tallerken med farverige ingredienser"
```

**Issues**:
- Generic ("lækre", "perfekt")
- No business-specific context
- Could apply to any cafe

### After Enhancements (Priority 1-3)
**Example AI Suggestion** (Business-Specific):
```
TITLE: "Fusion-brunch ved åen – fra smørrebrød til eggs benedict"
WHY: "Café Faust kombinerer dansk madtradition med internationale klassikere. Vores brunch-menu spænder fra FAUST smørrebrød med salmon rillettes til eggs benedict med hjemmelavet hollandaise"
PHOTO: "Nærbillede af FAUST smørrebrød med salmon rillettes, friske krydderurter og rugbrød – bord ved vinduet med udsigt til åen"
```

**Improvements**:
- ✅ Mentions actual menu items (FAUST smørrebrød, salmon rillettes, eggs benedict)
- ✅ Uses location reference ("ved åen")
- ✅ References business-specific elements (fusion, hjemmelavet)
- ✅ Specific enough that users recognize "this is OUR business"

---

## Testing Plan

### 1. Unit Testing (Per Enhancement)

**For each priority 1-3 change**:
- [ ] Verify V5 field extraction works
- [ ] Verify fallback to legacy field works
- [ ] Verify empty/null handling works
- [ ] Check prompt token count (ensure < 10% increase)

### 2. Integration Testing (Complete Flow)

**Test with Café Faust**:
- [ ] Generate 3 AI suggestions
- [ ] Verify business_identity persona appears in context
- [ ] Verify gastronomic_profile used instead of full theme list
- [ ] Verify factual_constraints appear in Tier 1 rules
- [ ] Generate text from suggestion
- [ ] Verify final caption is business-specific

**Test with Free Tier Business** (no V5 profile):
- [ ] Generate 3 AI suggestions
- [ ] Verify fallback to legacy fields works
- [ ] Verify no errors from missing V5 data
- [ ] Generate text from suggestion
- [ ] Verify basic functionality maintained

### 3. Quality Assessment

**Metrics to Track**:
- [ ] % of suggestions mentioning actual menu items (target: >60%)
- [ ] % of suggestions using location reference (target: >40%)
- [ ] % of suggestions using business-specific language (target: >50%)
- [ ] User selection rate of AI suggestions (baseline vs. after changes)
- [ ] Text generation token usage (ensure < 10% increase)

---

## Migration Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| V5 field not populated for all businesses | MEDIUM | HIGH | ✅ Fallback chains to legacy fields |
| Prompt token count exceeds limits | LOW | MEDIUM | Monitor token usage; adjust field lengths |
| Business persona too verbose for prompts | LOW | LOW | Already designed for AI consumption (~150 words) |
| Breaking changes to existing suggestions | VERY LOW | HIGH | ✅ Incremental rollout; A/B testing |
| Free tier businesses missing V5 data | CERTAIN | MEDIUM | ✅ Fallback chains ensure functionality |

---

## Deployment Checklist

### Phase 1: Priority 1-3 Enhancements

- [ ] 1. Review and approve implementation plan
- [ ] 2. Create feature branch: `feature/ai-mode-persona-integration`
- [ ] 3. Implement Priority 1: Business Identity Persona (3 files)
- [ ] 4. Implement Priority 2: Gastronomic Profile (2 files)
- [ ] 5. Implement Priority 3: Factual Constraints (1 file)
- [ ] 6. Run unit tests (per enhancement)
- [ ] 7. Run integration tests (Café Faust + Free tier business)
- [ ] 8. Deploy to staging environment
- [ ] 9. QA testing (3 suggestion cycles, 5 text generations)
- [ ] 10. A/B test with 10% of users (track selection rate)
- [ ] 11. Full production deployment
- [ ] 12. Monitor for 48 hours (error rates, token usage, quality metrics)
- [ ] 13. Document changes in BRAND-PROFILE-V5-INTEGRATION-LOG.md

### Phase 2: Optional Enhancements (If Needed)

- [ ] 14. Evaluate Phase 1 results
- [ ] 15. Decide on Priority 4: Programme-Aware Suggestions
- [ ] 16. Decide on Priority 5: City Cultural Context
- [ ] 17. Implement selected enhancements
- [ ] 18. Repeat testing and deployment process

---

## Files to Modify

### Priority 1-3 Changes

| File | Lines | Changes | Testing |
|------|-------|---------|---------|
| `supabase/functions/get-quick-suggestions/index.ts` | ~1400-1600 | Add persona, gastronomic_profile | Unit + Integration |
| `supabase/functions/generate-text-from-idea/resolve-context.ts` | ~400-450 | Add persona to BusinessContext | Unit |
| `supabase/functions/generate-text-from-idea/prompt-builders.ts` | ~150-250 | Add persona, gastronomic_profile, factual_constraints | Unit + Integration |

### Documentation Updates

| File | Updates |
|------|---------|
| `BRAND-PROFILE-V5-INTEGRATION-LOG.md` | Add AI mode integration notes |
| `CONTENT-PAGES-DATA-FLOW.md` | Update with new V5 fields used |
| `AI-ENHANCE-V5-MIGRATION-COMPLETE.md` | Add reference to AI mode updates |

---

## Conclusion

**Current State**: AI mode is already V5-integrated with 88-100% coverage of existing fields.

**Gap**: The new **Business Identity Persona** field (`system_persona`) is available but not yet used in prompts.

**Recommendation**: Implement **Priority 1-3 enhancements** (~4 hours effort) to leverage the business identity persona, gastronomic profile, and factual constraints. This will deliver **30-40% improvement in business-specific content quality** with **low risk** due to fallback chains.

**Next Steps**:
1. Review and approve this analysis
2. Implement Priority 1-3 in feature branch
3. Test with Café Faust and free tier business
4. Deploy with monitoring
5. Evaluate results before considering Phase 2 enhancements

**Key Success Metric**: Users should recognize "this suggestion is 100% tailored to MY business" rather than "this could apply to any restaurant."

---

**Document Status**: ✅ COMPLETE - Ready for review and implementation planning  
**Author**: Analysis based on codebase review (May 23, 2026)  
**Next Review**: After Phase 1 implementation
