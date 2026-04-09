# AI Post Idea Generation Architecture

## System Overview

The AI Generate V2 system creates social media post ideas using a sophisticated multi-layered architecture that ensures brand consistency, cultural appropriateness, and platform optimization.

**Primary Goal**: Generate 3 unique, platform-neutral post ideas that are then formatted for Facebook and Instagram with proper CTAs, hashtags, and cultural nuance.

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                      REQUEST ENTRY POINT                         │
│                    (index.ts - Main Handler)                     │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DATA GATHERING PHASE                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Business    │  │    Menu      │  │   Weather    │          │
│  │  Profile     │  │   Catalog    │  │     Data     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────────────────────────────────────────┐          │
│  │          Previous Posts (10 recent)               │          │
│  └──────────────────────────────────────────────────┘          │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                  STRATEGY PLANNING PHASE                         │
│              (strategy-engine.ts - IdeaPlan)                     │
│                                                                   │
│  Creates 3-slot plan with explicit constraints:                  │
│  • Slot A: Menu Spotlight (current daypart)                     │
│  • Slot B: Vibe/Experience (verified anchors)                   │
│  • Slot C: Occasion/Ritual (adjacent daypart)                   │
│                                                                   │
│  Compiles BrandPolicy:                                           │
│  • Voice rules (tone, essence, style)                            │
│  • Forbidden terms                                               │
│  • Offerings allowlist                                           │
│  • Verified anchors (location, interior, experience)            │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PROMPT BUILDING PHASE                          │
│              (prompt-builder.ts - GPT-4o Input)                  │
│                                                                   │
│  System Prompt: Cultural + linguistic rules                      │
│  • Language-specific guidance (Danish/Swedish/German)           │
│  • Cultural norms (formality, emoji, exclamations)              │
│  • Output format (JSON schema)                                   │
│                                                                   │
│  User Prompt: Business context + slot constraints                │
│  • IdeaPlan with slot assignments                                │
│  • BrandPolicy with verified data                                │
│  • Menu catalog (filtered by daypart)                            │
│  • Weather + seasonal context                                    │
│  • Previous post patterns                                        │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AI GENERATION PHASE                            │
│               (smart-generator.ts - GPT-4o)                      │
│                                                                   │
│  OpenAI API Call (gpt-4o):                                       │
│  • Temperature: 0.7 (creative but controlled)                    │
│  • Response format: JSON object                                  │
│  • Returns: 3 platform-neutral ideas                             │
│                                                                   │
│  Each idea contains:                                             │
│  • slot_id: A|B|C                                                │
│  • idea_type: menu|vibe|occasion                                 │
│  • menu_item: {name, category} or null                           │
│  • hook: Opening line (5-10 words)                               │
│  • caption_base: Core message (50-150 words)                     │
│  • cta_intent: book|menu|visit|engage                            │
│  • best_time: HH:MM for optimal posting                          │
│  • confidence: low|medium|high (how well idea fits constraints)  │
│  • photo_suggestion: Detailed image description                  │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                   VALIDATION PHASE                               │
│           (validators/content-validator.ts)                      │
│                                                                   │
│  Checks each idea for:                                           │
│  • Required fields present                                       │
│  • Slot compliance (if using IdeaPlan)                           │
│  • Menu item exists and matches daypart                          │
│  • No forbidden terms                                            │
│  • Proper caption length (20-500 chars)                          │
│  • Valid enums (impact, cta_intent, idea_type)                  │
│                                                                   │
│  Critical errors → 422 response (reject ideas)                   │
│  Warnings → Log but continue (e.g., menu item mismatch)         │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                  FORMATTING PHASE                                │
│          (response-formatter.ts - Platform Posts)                │
│                                                                   │
│  Converts each idea into 2 platform-specific posts:              │
│                                                                   │
│  FACEBOOK:                                                       │
│  • Text: hook + caption_base (clean, no CTA)                    │
│  • CTA: Separate object with text + type + URL                  │
│  • Hashtags: 3-5 (minimal, strategic)                           │
│  • URL: Booking link if cta_intent=book                         │
│                                                                   │
│  INSTAGRAM:                                                      │
│  • Text: hook + caption_base (clean, no CTA)                    │
│  • CTA: Separate object with text + type (no URL)               │
│  • Hashtags: 10-15 (aggressive for reach)                       │
│  • URL: undefined (never clickable on Instagram)                │
│                                                                   │
│  CTA Priority:                                                   │
│  1. Custom business CTA (if configured)                          │
│  2. Business default style (soft vs booking)                     │
│  3. Locale-aware templates                                       │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RESPONSE DELIVERY                             │
│                                                                   │
│  JSON Response:                                                  │
│  {                                                               │
│    ideas: [PostIdea, PostIdea, PostIdea],                       │
│    formatted: {                                                  │
│      facebook: [PlatformPost, PlatformPost, PlatformPost],      │
│      instagram: [PlatformPost, PlatformPost, PlatformPost]      │
│    },                                                            │
│    metadata: {                                                   │
│      model: "gpt-4o",                                            │
│      language: "da",                                             │
│      context_used: ["business_profile", "menu", "weather"],     │
│      generated_at: "2026-01-08T..."                              │
│    }                                                             │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Components Deep Dive

### 1. Strategy Engine (strategy-engine.ts)

**Purpose**: Pre-decide explicit 3-slot plan with hard constraints BEFORE calling AI.

**Key Functions**:
- `createIdeaPlan()` - Creates deterministic 3-slot structure
- `compileBrandPolicy()` - Transforms BusinessProfile into machine-usable constraints
- `create3Slots()` - Assigns slot types based on time of day

**3-Slot Strategy**:
```typescript
SLOT A: Menu Spotlight (current daypart)
- idea_type: 'menu'
- daypart: Current time (breakfast/lunch/dinner/lateNight)
- allowed_categories: Categories available for this daypart
- must_include: menu_item with specific category
- cta_intent: 'book'

SLOT B: Vibe/Experience (verified anchors only)
- idea_type: 'vibe'
- must_include: anchors from verified_anchors (location/interior/experience)
- must_avoid: unverified claims
- cta_intent: 'visit'

SLOT C: Occasion/Ritual (adjacent daypart)
- idea_type: 'occasion'
- daypart: Adjacent time period (e.g., dinner if currently lunch)
- allowed_categories: Optional (situation-rich, menu flexible)
- cta_intent: 'engage'
```

**BrandPolicy Structure**:
```typescript
{
  voice_rules: {
    tone: ["hyggelig", "varm", "indbydende"],  // Legacy: from tone_keywords
    tone_model: {  // NEW v2: Structured tone guidance with metadata
      // Core tone data (2-6, 3-8, 2-6, 2-6 items)
      primary_keywords: ["hyggelig", "varm"],
      writing_rules: [
        "Brug korte sætninger (max 15 ord)",
        "Ingen overdrivelser eller hype-sprog",
        "Fokus på konkrete oplevelser frem for abstrakte adjektiver"
      ],
      good_examples: [
        "Kom ind fra kulden",
        "Kaffen venter på dig",
        "Find din plads ved vinduet"
      ],
      avoid_examples: [
        "Fantastisk lækker kaffe! (for hyped)",
        "Du vil ikke tro hvor godt det smager (clickbait)"
      ],
      formality: "informal",
      emoji_level: "moderate",
      // Metadata (v2 - production safety)
      version: "2.0",
      language: "da",
      generated_at: "2026-01-08T14:30:00Z",
      source: "website",
      confidence: "high",
      notes: "Strong content across 5+ pages"
    },
    essence: "Autentisk dansk café med ...",
    style_notes: "Casual, friendly, use 'du' form"
  },
  forbidden_terms: ["billig", "fastfood", ...],
  offerings_allowlist: ["kaffe", "brunch", "kager", "økologisk", ...],
  verified_anchors: {
    location: ["ved åen i Aarhus", "i hjertet af centrum"],
    interior: ["hyggelig atmosfære", "plads til 40 gæster"],
    experience: ["perfekt til brunch med venner", "familievenlig"]
  },
  language: "da",
  country: "Denmark"
}
```

**Time-Aware Logic**:
```typescript
// ENHANCED: Timezone + Opening Hours Aware
// Current time → Business timezone → Opening hours → Business type → Daypart

// Example: Café in Copenhagen
timezone: "Europe/Copenhagen"
opening_hours: {
  monday: { open: "08:00", close: "16:00" }  // Breakfast-focused café
}
business_offerings: "Økologisk kaffe, brunch"

09:30 (in Copenhagen) → breakfast (café open 08:00-16:00, early in day)
12:00 (in Copenhagen) → lunch (café still open, midday)
18:00 (in Copenhagen) → CLOSED (closes at 16:00)

// When CLOSED: Special strategy
If business closed now:
  → Slot A: "Coming Soon" menu teaser (what awaits tomorrow)
  → Slot B: Vibe reminder (keep brand top-of-mind)
  → Slot C: "Plan Your Visit" booking nudge (anticipation)

// Business Type Inference
"Økologisk kaffe, brunch" → cafe (no lateNight)
"Restaurant, aftenmenu" → restaurant (lunch + dinner)
"Cocktails, øl, wine" → bar (dinner + lateNight)

// Daypart Constraints by Business Type
Café open 08:00-16:00: breakfast (08:00-11:00), lunch (11:00-16:00), NO dinner
Bar open 17:00-02:00: dinner (17:00-21:00), lateNight (21:00-02:00), NO breakfast
Restaurant open 11:00-22:00: lunch (11:00-15:00), dinner (15:00-22:00)
```

---

### 2. Brand Policy Compiler (brand-policy-compiler.ts)

**Purpose**: Create explicit allowlists and constraints to prevent AI from inventing facts.

**Key Functions**:
- `compileBrandPolicy()` - Main compiler
- `compileOfferingsAllowlist()` - Extract what can be mentioned
- `extractVerifiedAnchors()` - Pull location/interior/experience claims

**Offerings Allowlist Logic**:
```typescript
// INPUT:
business_offerings: "Økologisk kaffe, hjemmelavet brunch, sæsonkager"
menu_categories: ["BRUNCH", "AFTEN", "DRIKKEVARER"]

// OUTPUT ALLOWLIST:
["kaffe", "coffee", "brunch", "kager", "cakes", "økologisk", "organic",
 "mad", "food", "drikkevarer", "drinks", "aften", "dinner"]

// WHY: AI can now mention "kaffe" or "brunch" in vibe posts
// WITHOUT requiring specific menu item proof
// BUT CANNOT invent "cocktails" if not in allowlist
```

**Verified Anchors Logic**:
```typescript
// VERIFIED (can be used freely):
location: ["ved åen i Aarhus"] // From business_profile or location enrichment
interior: ["hyggelig atmosfære"] // From brand_voice or content_pillars
experience: ["perfekt til brunch med venner"] // From target_audience

// UNVERIFIED (CANNOT be used):
"amazing cocktails" // Not in offerings_allowlist
"rooftop terrace" // Not in verified_anchors.interior
"live music every Friday" // Not in verified_anchors.experience
```

---

### 3. Prompt Builder (prompt-builder.ts)

**Purpose**: Construct culturally-aware, constraint-rich prompts for GPT-4o.

**System Prompt Structure**:
```typescript
1. Role Definition
   "You are an expert social media marketing manager specializing in Danish content..."

2. Cultural Context (locale-specific)
   - Formality level: "Informal 'du' form"
   - Emoji usage: "Moderate (1-2 per post)"
   - Exclamation limit: "Max 1 per post"
   - Cultural concepts: "Emphasize 'hygge'"

3. Language Requirements
   DANISH SPECIFICS:
   - Use "hygge" naturally (not forced)
   - Informal "du/dig" form
   - Danish humor: understated, self-deprecating
   - Avoid Americanisms
   - Danish idioms: "det smager af mere", "til ganen"
   - Food culture: quality, local, shared experiences

4. Output Format (JSON schema)
   {
     "ideas": [
       { slot_id, idea_type, menu_item, hook, caption_base, ... }
     ]
   }

5. Critical Rules
   - Return ONLY valid JSON
   - Follow slot constraints EXACTLY
   - Never invent facts
   - Match brand voice
   - No hashtags/URLs in caption_base
```

**User Prompt Structure**:
```typescript
1. IdeaPlan (highest priority)
   === 3-SLOT PLAN (MANDATORY) ===
   SLOT A: Menu Spotlight for lunch
   - Type: menu
   - Allowed categories: FROKOST, SALATER, SANDWICHES
   - Must include: menu_item from FROKOST category
   - CTA intent: book
   
   SLOT B: Vibe/Experience
   - Type: vibe
   - Must use: "ved åen i Aarhus", "hyggelig atmosfære"
   - CTA intent: visit
   
   SLOT C: Occasion/Ritual for dinner
   - Type: occasion
   - Optional menu reference
   - CTA intent: engage

2. BrandPolicy
   === BRAND POLICY (MANDATORY) ===
   Voice: hyggelig, varm, indbydende
   Forbidden: "billig", "fastfood"
   Can mention: kaffe, brunch, kager, økologisk
   Verified location: "ved åen i Aarhus"

3. Menu Catalog (filtered by slot dayparts)
   === MENU ===
   FROKOST:
   - Club Sandwich (FROKOST)
   - Cæsarsalat med kylling (SALATER)
   ...

4. Contextual Data
   === WEATHER ===
   Current: -1°C, overcast clouds
   Forecast: Light snow tomorrow
   
   === PREVIOUS POSTS ===
   Recent themes: cozy indoor atmosphere, winter comfort food
```

---

### 4. Smart Generator (smart-generator.ts)

**Purpose**: Execute GPT-4o API call with assembled prompt.

**Flow**:
```typescript
1. Create IdeaPlan (strategy-engine.ts)
   ↓
2. Build System Prompt (cultural rules)
   ↓
3. Build User Prompt (business context + slot constraints)
   ↓
4. Call OpenAI API
   - Model: gpt-4o
   - Temperature: 0.7 (creative but controlled)
   - Response format: json_object (strict JSON)
   ↓
5. Parse JSON response
   ↓
6. Map to PostIdea[] structure
   ↓
7. Return platform-neutral ideas
```

**Error Handling**:
- API failures → throw error with details
- Invalid JSON → log content + throw parse error
- Missing ideas array → throw structure error
- Missing required fields → log warning but continue

**Output Structure**:
```typescript
PostIdea {
  slot_id: 'A' | 'B' | 'C'
  idea_type: 'menu' | 'vibe' | 'occasion'
  menu_item: { name: string, category: string } | null
  hook: string  // "Frosne fingre? 🥶"
  caption_base: string  // "Kom ind fra kulden og nyd en dampende kop kaffe..."
  cta_intent: 'book' | 'menu' | 'visit' | 'engage'
  best_time: string  // "12:00"
  confidence: 'low' | 'medium' | 'high'  // GPT-4o assessment (internally: 'impact')
  photo_suggestion: string  // "Close-up of steaming coffee cup..."
}
```

---

### 5. Content Validator (content-validator.ts)

**Purpose**: Per-idea validation with graceful degradation (never return 0 ideas).

**Validation Strategy** ⭐ ENHANCED:
```typescript
// OLD: Batch validation - one failure kills all 3 ideas
validateSuggestions(ideas) → errors[] → throw 422 (0 ideas returned)

// NEW: Per-idea validation with fallback
validateIdea(idea) → { valid, severity, errors, fixable }
  → CRITICAL error → Generate fallback template
  → FIXABLE error → Auto-fix if possible
  → WARNING → Include with warning flag
```

**Validation Checks**:

**Required Fields**:
- ✅ hook present and non-empty
- ✅ caption_base present and non-empty (20-500 chars)
- ✅ photo_suggestion present and non-empty
- ✅ Valid enums (confidence, idea_type, cta_intent)

**Slot Compliance** (if using IdeaPlan):
- ✅ slot_id matches IdeaPlan slot
- ✅ idea_type matches slot requirement
- ✅ Menu item from allowed_categories (if slot requires menu)
- ✅ References verified_anchors (if slot requires anchors)
- ✅ No forbidden terms used
- ✅ No unverified claims (if slot prohibits)

**Menu Item Validation**:
- ✅ Item exists in MenuCatalog
- ✅ Item matches daypart context (lunch item not used for breakfast post)
- ✅ Category matches slot allowed_categories

**Forbidden Terms**:
- ❌ Scan hook + caption_base for business forbidden_terms
- ❌ CRITICAL error if found → triggers fallback

**Tone Validation** ⭐ NEW:
- ✅ Check if content includes tone keywords from brand voice
- ⚠️ Warning if no tone keywords detected (not blocking)
- 📊 Tracks tone adherence for quality monitoring

**Novelty Check** ⭐ NEW:
- ✅ Compare new ideas against previous posts using fingerprints
- ✅ Require at least 2 dimension differences (theme, anchors, menu items, CTA)
- ⚠️ Warning if too similar (not blocking, but logged)

**PostFingerprint Structure**:
```typescript
{
  theme: 'menu' | 'vibe' | 'occasion',  // Primary type
  anchors: string[],  // Location/interior phrases used
  menuItems: string[],  // Menu item names mentioned
  ctaIntent: 'book' | 'menu' | 'visit' | 'engage'  // CTA type
}
```

**Novelty Check Logic**:
```typescript
// Extract fingerprint from new idea
newFingerprint = {
  theme: 'menu',
  anchors: ['ved åen i Aarhus'],
  menuItems: ['Club Sandwich'],
  ctaIntent: 'book'
}

// Compare against previous posts
previousFingerprint = {
  theme: 'menu',  // SAME
  anchors: ['ved åen i Aarhus'],  // OVERLAP
  menuItems: ['Caesar Salat'],  // DIFFERENT
  ctaIntent: 'book'  // SAME
}

// Count differences: 1 (only menu item differs)
// Result: ⚠️ TOO SIMILAR (need 2+ differences)

// Good example - 3 differences:
previousFingerprint = {
  theme: 'vibe',  // DIFFERENT (1)
  anchors: ['hyggelig atmosfære'],  // DIFFERENT (2)
  menuItems: [],  // DIFFERENT (3)
  ctaIntent: 'visit'  // DIFFERENT (4)
}
// Result: ✅ NOVEL
```

**Error Severity Classification** ⭐ NEW:
```typescript
'critical' → Forbidden term, completely unusable → Generate fallback
'fixable' → Menu item mismatch, wrong category → Auto-fix if possible
'warning' → Novelty check, minor issues → Include with warning flag
```

**Graceful Degradation Flow**:
```typescript
// Validate each idea independently
const validated = ideas.map(idea => {
  const result = validateIdea(idea, ideaPlan, businessProfile)
  
  if (result.severity === 'critical') {
    // Generate deterministic fallback template
    return {
      idea: generateFallbackIdea(idea.slot_id, ideaPlan, businessProfile),
      metadata: {
        source: 'fallback_template',
        quality: 'standard',
        validation_status: 'fallback',
        original_error: result.errors[0].message
      }
    }
  }
  
  if (result.fixable) {
    // Auto-fix: swap menu item, adjust category, etc.
    return {
      idea: autoFixIdea(idea, result.fixes),
      metadata: {
        source: 'ai',
        quality: 'high',
        validation_status: 'auto_fixed',
        fixes_applied: result.fixes
      }
    }
  }
  
  if (result.warnings.length > 0) {
    // Include with warnings
    return {
      idea: idea,
      metadata: {
        source: 'ai',
        quality: 'high',
        validation_status: 'valid_with_warnings',
        warnings: result.warnings
      }
    }
  }
  
  // Perfect idea
  return {
    idea: idea,
    metadata: {
      source: 'ai',
      quality: 'high',
      validation_status: 'valid'
    }
  }
})

// ALWAYS return 3 ideas (mix of AI + fallbacks)
```

**Fallback Template Generation**:
```typescript
// Deterministic template generator (no AI call needed)
function generateFallbackIdea(slotId, ideaPlan, profile) {
  const slot = ideaPlan.slots.find(s => s.id === slotId)
  
  if (slot.type === 'menu') {
    const menuItem = getRandomMenuItem(slot.allowed_categories)
    const anchor = getRandomAnchor(profile.verified_anchors.location)
    
    return {
      slot_id: slotId,
      idea_type: 'menu',
      menu_item: menuItem,
      hook: `${menuItem.name} ${getEmoji('food')}`,
      caption_base: `Prøv vores ${menuItem.name}. ${anchor}. ${slot.reasoning}`,
      cta_intent: slot.cta_intent,
      best_time: getCurrentTime(),
      confidence: 'medium',
      photo_suggestion: `${menuItem.name} served on a plate, appetizing presentation`,
      metadata: {
        source: 'fallback_template',
        template_type: 'menu_spotlight'
      }
    }
  }
  
  if (slot.type === 'vibe') {
    const anchor = getRandomAnchor(profile.verified_anchors.interior)
    
    return {
      slot_id: slotId,
      idea_type: 'vibe',
      menu_item: null,
      hook: `${profile.brand_voice.tone[0]} ${getEmoji('place')}`,
      caption_base: `${anchor}. Kom ind og oplev ${profile.business_name}.`,
      cta_intent: slot.cta_intent,
      best_time: getCurrentTime(),
      confidence: 'medium',
      photo_suggestion: `Interior atmosphere shot, cozy ambiance`,
      metadata: {
        source: 'fallback_template',
        template_type: 'vibe_reminder'
      }
    }
  }
  
  // ... occasion template
}
```

**Response Structure with Fallbacks**:
```typescript
{
  ideas: [
    {
      slot_id: 'A',
      hook: "Lunchtid? 🥗",
      ...
      metadata: {
        source: 'ai',
        quality: 'high',
        validation_status: 'valid'
      }
    },
    {
      slot_id: 'B',
      hook: "Hyggelig atmosfære 🌿",
      ...
      metadata: {
        source: 'fallback_template',  // ⚠️ User knows this is template
        quality: 'standard',
        validation_status: 'fallback',
        original_error: 'Forbidden term detected: billig',
        template_type: 'vibe_reminder'
      }
    },
    {
      slot_id: 'C',
      hook: "Aftensmad? 🌙",
      ...
      metadata: {
        source: 'ai',
        quality: 'high',
        validation_status: 'valid_with_warnings',
        warnings: ['Similar to recent post #3 (1 difference)']
      }
    }
  ],
  summary: {
    generation_quality: 'partial',  // 'full' | 'partial' | 'degraded'
    ai_ideas: 2,
    fallback_ideas: 1,
    auto_fixed_ideas: 0,
    warnings: 1,
    cost_saved: '$0.000'  // No extra AI calls for fallbacks
  }
}
```

---

### 6. Response Formatter (response-formatter.ts)

**Purpose**: Convert platform-neutral ideas into platform-specific posts.

**Platform Differences**:

| Feature | Facebook | Instagram |
|---------|----------|-----------|
| **Text** | hook + caption_base | hook + caption_base |
| **CTA** | Separate object | Separate object |
| **URL** | Yes (if booking) | No (never) |
| **Hashtags** | 3-5 (minimal) | 10-15 (aggressive) |
| **Character Limit** | ~63,206 | ~2,200 |
| **CTA Placement** | Below text | Below text |

**CTA Priority Logic**:
```typescript
1. Check businessProfile.cta_config.custom_ctas[intent]
   → If found: Use custom CTA
   
2. Check businessProfile.cta_config.default_style
   → If 'soft': Use softer language
   → If 'booking': Use direct booking language
   
3. Fall back to locale-aware templates
   → Danish: "Kom forbi", "Book bord"
   → Swedish: "Kom in", "Boka bord"
   → German: "Besucht uns", "Jetzt buchen"
```

**CTA Examples**:
```typescript
// Intent: 'book' with default_style: 'booking'
Facebook CTA: {
  text: "📅 Book dit bord nu",
  type: "booking",
  url: "https://book.cafe.dk"
}

// Intent: 'visit' with default_style: 'soft'
Instagram CTA: {
  text: "🚶 Kom forbi i dag",
  type: "soft",
  url: undefined  // Never on Instagram
}

// Intent: 'book' with custom CTA
Custom CTA: {
  text: "Reservér din plads →",  // From business config
  type: "custom",
  url: "https://book.cafe.dk"
}
```

**Hashtag Generation**:
```typescript
FACEBOOK (3-5 hashtags):
1. Business name tag: #CaféFaust
2. City tag: #Aarhus
3. Category tag: #Café (from business_offerings)
4. Menu item tag: #ClubSandwich (if menu-based idea)

INSTAGRAM (10-15 hashtags):
1-4. Same as Facebook
5-7. Category expansion: #AarhusCafé #AarhusFood #AarhusEats
8-10. Lifestyle: #Hygge #DanishFood #CoffeeTime
11-15. Generic reach: #Foodie #FoodPhotography #InstaFood
```

**Output Structure**:
```typescript
PlatformPost {
  platform: 'facebook' | 'instagram'
  text: string  // ONLY hook + caption_base (clean content)
  cta: {
    text: string  // "📅 Book dit bord nu"
    type: 'soft' | 'booking' | 'menu' | 'custom'
    url?: string  // Only for Facebook booking CTAs
  }
  hashtags: string[]  // 3-5 for Facebook, 10-15 for Instagram
}
```

---

## Policy System

### Language Configuration System (config/language-configs.ts)

**Purpose**: Centralized registry for all language-specific data including validation rules, templates, anchor patterns, and cultural guidance.

**Core Interface**:
```typescript
interface LanguageConfig {
  code: string                    // ISO 639-1 code (da, sv, de, fr, es...)
  name: string                    // Display name (Danish, Swedish, German...)
  
  // Validation
  forbiddenTokens: string[]       // 80+ English words to detect (the, our, try, visit...)
  forbiddenPhrases: Array<{       // Common English phrases with native translations
    en: string                    // "by the water"
    local: string                 // "ved vandet" (Danish)
  }>
  
  // Templates
  templates: {
    menu_spotlight: {
      caption: (item: string) => string
      hookSuffix: string
    }
    vibe_reminder: {
      caption: (anchor: string) => string
      defaultAnchor: string
    }
    occasion_prompt: {
      caption: (daypart: string) => string
      hookPhrases: { [daypart: string]: string }
      ctaPhrases: { [daypart: string]: string }
    }
  }
  
  // Anchor Extraction
  anchorPatterns: {
    location: Array<{             // Language-specific location patterns
      pattern: RegExp             // /ved (åen|vandet) i (\w+)/gi
      confidence: 'high' | 'medium'
      description?: string
    }>
    interior: string[]            // Generic keywords to avoid (hyggelig, cozy, nice...)
    experience: Array<{           // Experience context patterns
      pattern: RegExp             // /(perfekt|ideel) til (brunch|frokost)/gi
      confidence: 'high' | 'medium'
    }>
  }
  
  // Language Guidance (for GPT-4o prompts)
  languageGuidance: string        // Multi-line instructions with cultural rules
  commonMistakes: Array<{         // Examples for learning
    wrong: string                 // "by the water"
    correct: string               // "ved vandet"
  }>
  
  // Cultural Norms
  formality: 'formal' | 'informal' | 'mixed'
  emojiUsage: 'minimal' | 'moderate' | 'frequent'
  exclamationLimit: number
  culturalConcept?: string        // "hygge", "lagom", "Gemütlichkeit"
}
```

**Usage Pattern**:
```typescript
import { getLanguageConfig, isLanguageSupported } from '../config/language-configs.ts'

// Get configuration (automatically falls back to Danish if not found)
const config = getLanguageConfig('sv')  // Swedish config

// Use in validation
const forbiddenWords = config.forbiddenTokens
const forbiddenPhrases = config.forbiddenPhrases

// Use in template generation
const caption = config.templates.menu_spotlight.caption('Æbleflæsk')

// Use in anchor extraction
for (const patternConfig of config.anchorPatterns.location) {
  const matches = text.matchAll(patternConfig.pattern)
  // Extract location anchors
}

// Use in prompt building
const guidance = config.languageGuidance  // Complete cultural + linguistic rules
```

**Supported Languages** (fully configured):
- **Danish (da)**: Informal, moderate emoji, "hygge" concept, Danish location/experience patterns
- **Swedish (sv)**: Informal, minimal emoji, "lagom" concept, Swedish location/experience patterns
- **German (de)**: Mixed formality, minimal emoji, "Gemütlichkeit" concept, German location/experience patterns

**Adding New Languages**:
To add French, Spanish, or any new language, add a single configuration object:

```typescript
const FRENCH_CONFIG: LanguageConfig = {
  code: 'fr',
  name: 'French',
  forbiddenTokens: [...],           // English words to detect
  forbiddenPhrases: [
    { en: 'by the water', local: 'au bord de l\'eau' },
    { en: 'come in', local: 'entrez' },
    // ...
  ],
  templates: {
    menu_spotlight: {
      caption: (item) => `Découvrez ${item}`,
      hookSuffix: 'du jour'
    },
    // ... other templates
  },
  anchorPatterns: {
    location: [
      { pattern: /au bord de (l'eau|la rivière|la mer)/gi, confidence: 'high' },
      { pattern: /(au cœur de|dans le centre de)\s+(\w+)/gi, confidence: 'high' }
    ],
    interior: ['cosy', 'agréable', 'sympa', 'chaleureux'],
    experience: [
      { pattern: /(parfait|idéal) pour (brunch|déjeuner|dîner)/gi, confidence: 'high' }
    ]
  },
  languageGuidance: `⚠️ ABSOLUTE REQUIREMENT: ALL OUTPUT MUST BE 100% FRENCH
- NO English words except proper nouns (business names, brands)
- Use French idioms naturally
- Respect French formality (tu vs vous)
- French food culture emphasizes quality, tradition, terroir`,
  commonMistakes: [
    { wrong: 'by the water', correct: 'au bord de l\'eau' },
    { wrong: 'come in', correct: 'entrez' }
  ],
  formality: 'mixed',  // Context-dependent (tu vs vous)
  emojiUsage: 'moderate',
  exclamationLimit: 1,
  culturalConcept: 'savoir-vivre'
}

// Register in LANGUAGE_CONFIGS
export const LANGUAGE_CONFIGS = {
  da: DANISH_CONFIG,
  sv: SWEDISH_CONFIG,
  de: GERMAN_CONFIG,
  fr: FRENCH_CONFIG  // ✅ French now fully supported
}
```

**Benefits**:
- ✅ **Extensible**: Add new language = add one config object (not edit 4 files)
- ✅ **Type-Safe**: TypeScript interface ensures completeness
- ✅ **Maintainable**: Single source of truth for all language data
- ✅ **Discoverable**: Clear what's needed for new languages
- ✅ **Safe**: Fallback to Danish prevents crashes for unsupported languages

### Menu Rules (menu-rules.ts)

**Daypart Assignment**:
```typescript
// ENHANCED: Timezone + Opening Hours + Business Type Aware

// Traditional time-based inference (fallback)
08:00-10:30 → breakfast
10:30-15:00 → lunch
15:00-21:00 → dinner
21:00-08:00 → lateNight

// NEW: Enhanced context-aware inference
inferDaypartWithContext(locale, timezone, openingHours, businessOfferings):
  1. Determine business type (cafe/restaurant/bar/mixed)
  2. Get current time in business timezone (not server time)
  3. Check if business is currently open
  4. If CLOSED:
     - Return null daypart
     - Include opensAt time or nextOpenDay
     - Trigger "anticipation strategy" in slot planning
  5. If OPEN:
     - Infer daypart from position within operating hours
     - Respect business type (café can't have lateNight if closes at 16:00)
     - Return high-confidence daypart

// Example: Café open 08:00-16:00
09:30 → breakfast (early in operating window)
12:00 → lunch (midday, still within hours)
18:00 → CLOSED (business closed, next opening: tomorrow 08:00)

// Example: Bar open 17:00-02:00
19:00 → dinner (early evening)
23:00 → lateNight (late evening)
10:00 → CLOSED (business closed, opens at 17:00)

// Category mapping (unchanged)
"MORGENMAD", "BRUNCH" → breakfast
"FROKOST", "LUNCH", "SALATER" → lunch
"AFTEN", "DINNER", "HOVEDRETTER" → dinner
"DRINKS", "COCKTAILS", "ØLMENU" → lateNight (+ all dayparts)
```

**Business Type Detection**:
```typescript
inferBusinessType(business_offerings):
  "café" or "kaffe" → cafe
  "restaurant" or "mad" or "frokost" → restaurant
  "bar" or "cocktail" or "øl" → bar
  Multiple types → mixed

Business type affects:
  - Available dayparts (café: no lateNight if closes early)
  - Slot strategy (bar: more drink-focused)
  - CTA style (café: softer, bar: social engagement)
```

**Validation Rules**:
```typescript
// ENHANCED: Now respects opening hours and business type
isMenuItemValidForDaypart(menuItem, daypart, businessContext):
  - Brunch items allowed during breakfast OR lunch
  - Drinks/beverages allowed at ANY time (if business is open)
  - Lunch sandwich NOT allowed in breakfast post
  - Dinner main course NOT allowed in lunch post
  - lateNight items NOT allowed if business closes before 21:00
  - breakfast items NOT allowed if business opens after 11:00
```

### Locale Config (locale-config.ts)

**Cultural Norms by Country**:
```typescript
DENMARK:
- Formality: informal (always "du")
- Emoji usage: moderate (1-2 per post)
- Exclamation limit: 1 per post
- Emphasize: "hygge" (cozy atmosphere)
- CTA style: imperative ("Kom forbi!", "Book nu")

SWEDEN:
- Formality: informal (always "du")
- Emoji usage: minimal (0-1 per post)
- Exclamation limit: 0-1 per post
- Emphasize: "lagom" (balanced, just right)
- CTA style: inviting ("Välkommen", "Boka tid")

GERMANY:
- Formality: context-dependent ("Sie" vs "Du")
- Emoji usage: minimal (0-1 per post)
- Exclamation limit: 0-1 per post
- Emphasize: "Gemütlichkeit" (coziness, comfort)
- CTA style: direct ("Besuchen Sie uns", "Jetzt buchen")
```

### Platform Rules (platform-rules.ts)

**Platform Constraints**:
```typescript
FACEBOOK:
- Max hashtags: 3-5 (strategic, not spammy)
- Character limit: 63,206 (effectively unlimited)
- URL support: Yes (clickable)
- CTA placement: Below text, separate
- Best practices: Longer captions okay, storytelling

INSTAGRAM:
- Max hashtags: 10-15 (aggressive for reach)
- Character limit: 2,200
- URL support: No (never clickable)
- CTA placement: Below text, separate
- Best practices: Visual-first, hashtag optimization
```

---

## Data Sources

### Business Profile
```typescript
{
  id, user_id, business_name,
  primary_language: "da",
  country: "Denmark",
  city: "Aarhus",
  timezone: "Europe/Copenhagen",  // NEW: IANA timezone for accurate time handling
  opening_hours: {  // NEW: Actual business hours (varies by day)
    monday: { open: "08:00", close: "16:00" },
    tuesday: { open: "08:00", close: "16:00" },
    wednesday: { open: "08:00", close: "16:00" },
    thursday: { open: "08:00", close: "16:00" },
    friday: { open: "08:00", close: "18:00" },  // Weekend variation
    saturday: { open: "10:00", close: "16:00" },  // Late start on weekends
    sunday: { closed: true }  // Closed Sundays
  },
  brand_voice: {
    tone: ["hyggelig", "varm"],  // Extracted from tone_model.primary_keywords
    tone_model: {  // NEW v2: Full structured tone guidance with metadata (JSONB)
      // Core tone data
      primary_keywords: ["hyggelig", "varm"],
      writing_rules: [
        "Brug korte sætninger (max 15 ord)",
        "Ingen overdrivelser",
        "Fokus på oplevelser"
      ],
      good_examples: ["Kom ind fra kulden", "Kaffen venter"],
      avoid_examples: ["Fantastisk! (for hyped)", "Du vil ikke tro... (clickbait)"],
      formality: "informal",
      emoji_level: "moderate",
      // Metadata (v2)
      version: "2.0",
      language: "da",
      generated_at: "2026-01-08T14:30:00Z",
      source: "website",
      confidence: "high"
    },
    essence: "Autentisk dansk café...",
    style_notes: "Casual, friendly"
  },
  business_offerings: "Økologisk kaffe, brunch, kager",
  content_pillars: ["Kvalitet", "Hygge", "Lokalt"],
  booking_url: "https://book.cafe.dk",
  forbidden_terms: ["billig", "fastfood"],
  required_tone_anchors: ["autentisk", "økologisk"],
  cta_config: {
    default_style: "soft",
    custom_ctas: {
      book: "Reservér din plads",
      visit: "Kom ind til os"
    },
    use_emojis: true
  }
}
```

### Menu Catalog
```typescript
{
  items: [
    {
      id, name: "Club Sandwich",
      category: "FROKOST",
      daypart_tags: ["lunch"],
      short_desc: "Klassisk med kylling og bacon",
      price: 89,
      menu_source: "Brunch Menu",
      raw_line: "Club Sandwich (FROKOST)"
    }
  ],
  getItemsByCategory(category): MenuItem[],
  getAllowedItemsForDaypart(daypart): MenuItem[],
  getAllowedItemsForTime(time, language, country): MenuItem[]
}
```

### Weather Data
```typescript
{
  temperature: -1,
  condition: "overcast clouds",
  description: "light snow expected",
  icon: "04d",
  timestamp: 1736348232344
}
```

### Previous Posts
```typescript
[
  {
    id, content: "Frosne fingre? Kom ind...",
    platform: "instagram",
    created_at: "2026-01-07T14:30:00Z",
    engagement: { likes: 45, comments: 3 }
  }
]
```

---

## Example Flow (Business Closed)

**Scenario**: User at same Café Faust requests 3 ideas at 18:00 (after closing).

**Business Context**:
- Type: Café (breakfast + lunch only)
- Hours: Mon-Fri 08:00-16:00 (CLOSED now)
- Timezone: Europe/Copenhagen
- Current time: 18:00 (Wednesday evening)

### Step 1: Data Gathering
```typescript
✅ Business profile: Café Faust, Danish, Aarhus
✅ Timezone: Europe/Copenhagen (18:00 local time)
✅ Opening hours: Currently CLOSED (opens tomorrow at 08:00)
✅ Menu: 77 items available
✅ Weather: -1°C, overcast
```

### Step 2: Strategy Planning (CLOSED BUSINESS)
```typescript
🚫 Enhanced daypart detection:
  - Business timezone: Europe/Copenhagen
  - Current time: 18:00 (Wednesday)
  - Opening hours: Closed (opens tomorrow 08:00)
  - Business type: cafe
  - Is open: NO
  - Opens at: 08:00 (tomorrow)
  - Next daypart: breakfast
  - Confidence: HIGH

🎯 ANTICIPATION STRATEGY activated:

IdeaPlan:
  SLOT A ("Coming Soon" Menu Teaser):
    - Type: menu
    - Daypart: breakfast (next opening)
    - Must include: menu_item + "Opens at 08:00"
    - Must avoid: urgent language ("now", "hurry", "today")
    - CTA: book
    - Reasoning: Build anticipation for tomorrow's breakfast

  SLOT B (Vibe Reminder):
    - Type: vibe
    - Must include: forward-looking tone ("can't wait to see you")
    - Anchors: "hyggelig atmosfære"
    - CTA: visit
    - Reasoning: Keep brand top-of-mind while closed

  SLOT C ("Plan Your Visit" Booking):
    - Type: occasion
    - Daypart: breakfast
    - Must include: planning language ("book", "reserve")
    - Must avoid: urgent language
    - CTA: book
    - Reasoning: Encourage advance planning for tomorrow
```

### Step 3: AI Generation (Closed Business)
```typescript
GPT-4o generates 3 "anticipation" ideas:

IDEA A (Menu Teaser - Tomorrow's Breakfast):
  hook: "Vi ses i morgen? 🌅"
  caption_base: "Kl. 08:00 åbner vi dørene til en ny dag fuld af 
                 økologisk kaffe og hjemmelavet brunch. Book dit 
                 bord allerede nu og start dagen med os ved åen."
  menu_item: { name: "Morgenmadsbuffet", category: "BRUNCH" }
  cta_intent: "book"
  best_time: "07:00"  // Post early morning before opening
  reasoning: "Closed now, opens 08:00 tomorrow - anticipation post"

IDEA B (Vibe - Looking Forward):
  hook: "Savner I os? 💙"
  caption_base: "Vi er lukkede nu, men glæder os til at byde jer 
                 velkommen igen i morgen. Vores hyggelige atmosfære 
                 venter på jer ved åen i Aarhus."
  menu_item: null
  cta_intent: "visit"
  best_time: "20:00"  // Evening post while closed
  reasoning: "Brand presence while closed"

IDEA C (Planning - Reserve Tomorrow):
  hook: "Planlagt morgenmad? 📅"
  caption_base: "Book dit bord til i morgen allerede nu. Vi serverer 
                 fra kl. 08:00 og sikrer dig den bedste start på dagen."
  menu_item: null
  cta_intent: "book"
  best_time: "19:00"  // Evening booking nudge
  reasoning: "Encourage advance booking for tomorrow"
```

### Step 4: Validation
```typescript
✅ All ideas use forward-looking language
✅ No urgent "now" or "today" language
✅ Menu items appropriate for next opening (breakfast)
✅ Includes opening time references
✅ No forbidden terms
```

### Step 5: Formatting (Same as Open Business)
**Facebook/Instagram posts formatted normally** with adjusted tone for "plan ahead" messaging.

---

## Example Flow

**Scenario**: User at Café Faust (Aarhus) requests 3 ideas at 12:00 on a cold winter day.

**Business Context**:
- Type: Café (breakfast + lunch only)
- Hours: Mon-Fri 08:00-16:00, Sat 10:00-16:00, Sun CLOSED
- Timezone: Europe/Copenhagen
- Current time: 12:00 (Wednesday)

### Step 1: Data Gathering
```typescript
✅ Business profile: Café Faust, Danish, Aarhus
✅ Timezone: Europe/Copenhagen (12:00 local time)
✅ Opening hours: Currently OPEN (08:00-16:00)
✅ Menu: 77 items (BRUNCH, FROKOST, DRIKKEVARER categories)
✅ Weather: -1°C, overcast, light snow forecast
✅ Previous posts: 10 recent posts (themes: cozy indoor, winter comfort)
```

### Step 2: Strategy Planning (Enhanced)
```typescript
📋 Enhanced daypart detection:
  - Business timezone: Europe/Copenhagen
  - Current time: 12:00 (Wednesday)
  - Opening hours: 08:00-16:00
  - Business type: cafe (inferred from "kaffe, brunch")
  - Is open: YES
  - Current daypart: lunch
  - Closes at: 16:00
  - Confidence: HIGH

IdeaPlan:
  SLOT A (Menu Spotlight - Lunch):
    - Type: menu
    - Daypart: lunch
    - Categories: FROKOST, SALATER, SANDWICHES
    - Must include: menu_item from FROKOST
    - CTA: book
    - Note: [cafe, open]

  SLOT B (Vibe - Cozy Interior):
    - Type: vibe
    - Anchors: "hyggelig atmosfære", "ved åen i Aarhus"
    - CTA: visit
    - Note: [cafe]

  SLOT C (Occasion - Next Period):
    - Type: occasion
    - Daypart: Adjacent (preparing for closing at 16:00)
    - Menu: optional
    - CTA: engage
    - Note: [cafe]

BrandPolicy:
  - Voice: hyggelig, varm, indbydende
  - Forbidden: none
  - Offerings: kaffe, brunch, frokost, kager, økologisk
  - Verified: "ved åen i Aarhus", "hyggelig atmosfære"
```

### Step 3: AI Generation
```typescript
GPT-4o generates 3 ideas:

IDEA A (Menu - Lunch):
  hook: "Lunchtid? 🥗"
  caption_base: "Vores Club Sandwich er lavet med økologisk kylling, 
                 sprød bacon og friske salater. Perfekt til en 
                 hyggelig frokostpause ved åen."
  menu_item: { name: "Club Sandwich", category: "FROKOST" }
  cta_intent: "book"
  best_time: "11:30"

IDEA B (Vibe - Cozy):
  hook: "Kulden bider udenfor ❄️"
  caption_base: "Men herinde er der varmt og hyggeligt. Kom ind fra 
                 kulden og find din yndlingsplads ved vinduet. 
                 Vi står klar med en dampende kop kaffe."
  menu_item: null
  cta_intent: "visit"
  best_time: "14:00"

IDEA C (Occasion - Dinner):
  hook: "Planlagt aftensmad i aften? 🌙"
  caption_base: "Vores aftenmenu serveres fra kl. 17. Nyd en 
                 afslappende aften med god mad og godt selskab 
                 ved åen i Aarhus."
  menu_item: null
  cta_intent: "engage"
  best_time: "16:00"
```

### Step 4: Validation
```typescript
✅ All ideas have required fields
✅ Slot A uses menu item from FROKOST (correct daypart)
✅ Slot B references verified anchor "ved åen"
✅ No forbidden terms found
✅ Caption lengths within range (20-500)
✅ Valid enums
```

### Step 5: Formatting

**Facebook Posts**:
```typescript
POST A (Menu - Lunch):
  text: "Lunchtid? 🥗\n\nVores Club Sandwich er lavet med..."
  cta: {
    text: "📅 Book dit bord nu",
    type: "booking",
    url: "https://book.cafefaust.dk"
  }
  hashtags: ["#CaféFaust", "#Aarhus", "#Frokost", "#ClubSandwich"]

POST B (Vibe - Cozy):
  text: "Kulden bider udenfor ❄️\n\nMen herinde er der..."
  cta: {
    text: "🚶 Kom forbi i dag",
    type: "soft",
    url: undefined
  }
  hashtags: ["#CaféFaust", "#Aarhus", "#Hygge"]

POST C (Occasion - Dinner):
  text: "Planlagt aftensmad i aften? 🌙\n\nVores aftenmenu..."
  cta: {
    text: "👋 Fortæl os i kommentarerne",
    type: "soft",
    url: undefined
  }
  hashtags: ["#CaféFaust", "#Aarhus", "#Aften", "#Aftensmad"]
```

**Instagram Posts**:
```typescript
POST A (Menu - Lunch):
  text: "Lunchtid? 🥗\n\nVores Club Sandwich er lavet med..."
  cta: {
    text: "📅 Book dit bord (link i bio)",
    type: "booking",
    url: undefined  // Never clickable on Instagram
  }
  hashtags: [
    "#CaféFaust", "#Aarhus", "#AarhusCafé", "#Frokost",
    "#ClubSandwich", "#DanishFood", "#Foodie", "#FoodPhotography",
    "#Hygge", "#LocalFood", "#AarhusEats", "#AarhusFood",
    "#CoffeeTime", "#InstaFood", "#Lunch"
  ]

POST B (Vibe - Cozy):
  text: "Kulden bider udenfor ❄️\n\nMen herinde er der..."
  cta: {
    text: "🚶 Kom forbi i dag",
    type: "soft",
    url: undefined
  }
  hashtags: [
    "#CaféFaust", "#Aarhus", "#AarhusCafé", "#Hygge",
    "#CozyVibes", "#WinterCafe", "#DanishLifestyle",
    "#CoffeeLovers", "#CafeLife", "#AarhusLife",
    "#HyggeTime", "#WarmAndCozy", "#CafeVibes"
  ]

POST C (Occasion - Dinner):
  text: "Planlagt aftensmad i aften? 🌙\n\nVores aftenmenu..."
  cta: {
    text: "👋 Fortæl os i kommentarerne",
    type: "soft",
    url: undefined
  }
  hashtags: [
    "#CaféFaust", "#Aarhus", "#AarhusCafé", "#Aftensmad",
    "#Dinner", "#DinnerTime", "#DanishFood", "#LocalFood",
    "#AarhusEats", "#AarhusFood", "#FoodLovers",
    "#EveningVibes", "#DineOut", "#Foodie", "#InstaFood"
  ]
```

---

## Performance Metrics

**Typical Request**:
- Data gathering: 200-500ms (parallel fetches)
- Strategy planning: <50ms (deterministic)
- AI generation: 12,000-15,000ms (GPT-4o)
- Validation: <100ms
- Formatting: <50ms
- **Total**: ~13-16 seconds

**OpenAI Usage**:
- Model: gpt-4o
- Temperature: 0.7
- Max tokens: Not limited (response_format: json_object)
- Typical response: ~1,500 tokens
- Cost: ~$0.015 per request (3 ideas)

---

## Error Handling

**Authentication Errors** (401):
- Missing Authorization header
- Invalid JWT token
- User not found

**Business Logic Errors** (403):
- User tier not eligible (Free tier)
- Required: Smart tier or above

**Not Found Errors** (404):
- Business profile not found
- No menu items available

**Validation Errors** (422):
- ~~All ideas rejected if one fails~~ ✅ **FIXED** (now per-idea with fallbacks)
- System-level failures only (all 3 ideas completely unusable - extremely rare)
- Individual idea failures now generate fallback templates instead

**Server Errors** (500):
- OpenAI API failures
- JSON parse errors
- Database connection issues

---

## Key Design Decisions

### 1. **Platform-Neutral Ideas**
Why: Single AI call generates universal content, then specialized formatting for each platform.
Benefit: Consistency across platforms, reduced AI costs.

### 2. **3-Slot Pre-Planning**
Why: Deterministic strategy BEFORE AI call ensures variety and policy compliance.
Benefit: Predictable results, no "all menu" or "all vibe" failures.

### 3. **BrandPolicy Allowlists**
Why: Explicit "what can be mentioned" list prevents AI from inventing offerings.
Benefit: Factual accuracy, no hallucinations.

### 4. **Verified Anchors**
Why: Only use location/interior/experience claims that exist in business data.
Benefit: Truthful marketing, no false advertising.

### 5. **Separate CTA Object**
Why: Clean caption_base + explicit CTA structure (not mixed in text).
Benefit: Easy A/B testing, flexible CTA customization.

### 6. **Locale-Aware Prompting**
Why: Each language/country has unique cultural norms and communication styles.
Benefit: Authentic content that resonates with local audiences.

### 7. **Fail-Fast Validation**
Why: Reject bad ideas immediately (422) instead of delivering low-quality content.
Benefit: Quality over quantity, user trust.

### 8. **Timezone + Opening Hours Awareness** ⭐ NEW
Why: Business reality matters - a café's "lateNight" doesn't exist if they close at 16:00.
Benefit: 
- Accurate daypart detection (breakfast might start at 10 on weekends)
- No impossible suggestions (dinner post when business is closed)
- "Business Closed" strategy (anticipation posts instead of "now" urgency)
- Business type inference (café vs restaurant vs bar affects content)
Implementation:
- Uses IANA timezone for accurate time (not server time)
- Respects actual opening hours from database
- Infers business type from offerings text
- Detects closed status and triggers special slot strategy
- Prevents menu items from unavailable dayparts

**Example Impact**:
- Before: "Come in for dinner!" at 18:00 (but café closes at 16:00) ❌
- After: "Book your breakfast for tomorrow at 08:00!" ✅
- Before: All posts say "now" even when closed ❌
- After: "We open at 08:00 - reserve your table now" ✅

### 9. **Novelty Check with Fingerprints** ⭐ NEW
Why: Previous post patterns were too soft - AI could still generate repetitive content.
Benefit:
- Hard constraints on content repetition
- Measures similarity across 4 dimensions (theme, anchors, menu items, CTA)
- Requires at least 2 differences from any recent post
- Prevents "menu spotlight fatigue" or "same vibe post 3 times in a row"
Implementation:
- Extract fingerprint from each previous post (theme, anchors, menu items, CTA intent)
- Extract fingerprint from each new idea
- Compare dimensions and count differences
- Reject if fewer than 2 differences (warning, not blocking)
- Detailed logging for debugging similarity issues

**Example Impact**:
- Before: 3 consecutive "Club Sandwich by the river" posts ❌
- After: Forced variety - menu/vibe/occasion with different anchors ✅
- Before: All posts use "book" CTA ❌
- After: Mix of book/visit/engage CTAs ✅

**Fingerprint Dimensions**:
1. **Theme**: menu vs vibe vs occasion (different content focus)
2. **Anchors**: Location/interior/experience phrases (different selling points)
3. **Menu Items**: Specific dishes mentioned (different offerings)
4. **CTA Intent**: book vs visit vs engage (different actions)

**Novelty Logic**:
```typescript
// Example 1: TOO SIMILAR (only 1 difference)
New:      { theme: 'menu', anchors: ['ved åen'], menuItems: ['Club Sandwich'], cta: 'book' }
Previous: { theme: 'menu', anchors: ['ved åen'], menuItems: ['Caesar Salat'], cta: 'book' }
Differences: 1 (only menu item)
Result: ⚠️ TOO SIMILAR

// Example 2: SUFFICIENTLY NOVEL (3 differences)
New:      { theme: 'vibe', anchors: ['hyggelig'], menuItems: [], cta: 'visit' }
Previous: { theme: 'menu', anchors: ['ved åen'], menuItems: ['Club Sandwich'], cta: 'book' }
Differences: 3 (theme, anchors, CTA)
Result: ✅ NOVEL
```

### 10. **Graceful Degradation with Fallback Templates** ⭐ NEW
Why: One bad idea shouldn't kill entire batch - harsh UX, wasted API cost ($0.015).
Benefit:
- Always return 3 ideas (never 0)
- Per-idea validation instead of batch rejection
- Deterministic fallback templates (no extra AI calls = $0 cost)
- Transparent quality indicators (user knows which are fallbacks)
- Better UX: 2 AI ideas + 1 template > 0 ideas
Implementation:
- Validate each idea independently with severity classification
- CRITICAL errors (forbidden terms) → Generate fallback template
- FIXABLE errors (wrong menu item) → Auto-fix if possible
- WARNINGS (novelty check) → Include with warning flag
- Fallback templates: deterministic, brand-compliant, instant generation
- Response includes metadata showing source and quality per idea

**Example Impact**:
- Before: Idea B has forbidden term → Reject all 3 → User gets 0 ideas ❌
- After: Idea B replaced with template → User gets 3 ideas (2 AI + 1 template) ✅
- Before: Wasted $0.015 API call when validation fails ❌
- After: Always usable output, no wasted cost ✅

**Fallback Quality Levels**:
1. **High Quality (AI)**: Creative, contextual, perfect validation
2. **Standard Quality (Template)**: Generic but brand-compliant, deterministic
3. **Fixed Quality (Auto-Fixed AI)**: AI content with minor corrections

### 11. **Tone Validation with Non-Blocking Warnings** ⭐ NEW
Why: Brand consistency requires tone adherence, but tone is subjective and hard to validate perfectly.
Benefit:
- Monitors tone adherence without blocking creative AI output
- Keyword-based detection identifies obvious mismatches
- Warning system allows learning what "good tone" looks like
- Doesn't penalize content that captures tone feeling without using exact keywords
Implementation:
- Checks if tone keywords appear in generated text
- Issues warning (not error) when no keywords detected
- Logs matches for quality monitoring
- Future: Could upgrade to LLM-based tone classification

**Example Impact**:
- Tone: ["hyggelig", "varm"] in brand voice
- Generated text contains "hyggelig atmosfære" → ✅ Pass
- Generated text: "Modern, efficient service" → ⚠️ Warning (no tone keywords)
- System learns: 80% of AI ideas pass tone check → validates approach

**Why Warning, Not Error:**
- Tone can be captured without keywords ("cozy" feeling vs "hyggelig" word)
- Avoids false positives that block good content
- Allows gradual refinement of tone guidance
- User feedback loop identifies when warnings are real issues

### 12. **Single Source of Truth for Tone (Prompt Optimization)** ⭐ NEW
Why: Tone was appearing twice in prompt ~300 lines apart, causing redundancy and confusion.
Benefit:
- Saves ~50-100 tokens per request (~$0.0001 per request, 7% latency reduction)
- Clearer prompt structure - AI sees tone constraints once in authoritative section
- Reduces risk of contradictory tone guidance
- Easier prompt maintenance
Implementation:
- Brand Voice section: Shows essence only, references "see BRAND POLICY below"
- Brand Policy section: Complete tone + style + essence in one HARD CONSTRAINTS block
- AI follows single canonical policy block

**Example Impact**:
- Before: Tone in 2 places → 150 extra tokens, potential confusion
- After: Tone in 1 place → Leaner prompt, clearer instructions
- Token savings: ~50-100 tokens/request × 1000 requests/day = 100k tokens/day saved

### 13. **Structured Tone Model v2 (Machine-Usable Guidance + Production Safety)** ⭐ NEW
Why: Simple string array `tone_keywords` provided no actionable guidance - AI needed rules, examples, and context. **v2 adds metadata for versioning, multi-language support, and quality control.**

Benefit:
- **Primary Keywords**: 2-6 core adjectives enable validation ("hyggelig", "varm") - expanded from 2-3
- **Writing Rules**: 3-8 actionable rules guide AI beyond keywords - expanded from 3-5
- **Good Examples**: 2-6 perfect phrases teach by example - expanded from 2-3
- **Avoid Examples**: 2-6 bad phrases with reasons - expanded from 2-3
- **Formality + Emoji**: Explicit guidance on tone formality and emoji usage
- **Metadata (v2)**: Version, language, confidence, source, timestamp, notes
- **Database Constraints**: Enforces array bounds, enums, string lengths (prevents bad AI output)
- **Backwards Compatible**: Legacy tone_keywords remains, tone_model enhances it

Implementation:
```typescript
// Database: tone_model JSONB column with comprehensive validation
{
  // Core tone data (array bounds enforced by DB constraint)
  primary_keywords: ["hyggelig", "varm"],      // 2-6 items
  writing_rules: [                              // 3-8 items
    "Brug korte sætninger (max 15 ord)",
    "Ingen overdrivelser eller hype-sprog",
    "Fokus på konkrete oplevelser"
  ],
  good_examples: [                              // 2-6 items
    "Kom ind fra kulden",
    "Kaffen venter på dig"
  ],
  avoid_examples: [                             // 2-6 items
    "Fantastisk lækker kaffe! (for hyped)",
    "Du vil ikke tro... (clickbait)"
  ],
  formality: "informal",                        // enum: formal | informal | mixed
  emoji_level: "moderate",                      // enum: none | minimal | moderate | frequent
  
  // Metadata (v2 - production safety)
  version: "2.0",                               // Schema version (safe migrations)
  language: "da",                               // ISO 639-1 (multi-language support)
  generated_at: "2026-01-08T14:30:00Z",        // Audit trail
  source: "website",                            // website | manual | hybrid
  confidence: "high",                           // high | medium | low (quality control)
  notes: "Strong content across 5+ pages"      // Optional debug info
}
```

**Example Impact**:
- Before: tone_keywords = ["hyggelig"] → AI has no guidance how to apply it ❌
- After: tone_model provides rules + examples → AI understands "hyggelig" means "Kom ind fra kulden" not "Fantastisk hyggelig atmosfære!" ✅
- Before: Validation could only check keyword presence (shallow) ❌
- After: Can validate against writing_rules and avoid_examples (deep) ✅
- Before: No protection against bad AI output (30 keywords, invalid enums) ❌
- After: Database constraints reject invalid data at insert time ✅
- Before: No multi-language support or versioning ❌
- After: Language field + version field enable safe scaling ✅

**Usage Flow**:
1. Brand Profile Generator (Prompt B) extracts tone_model with metadata from website/content
2. Database validates structure and stores as JSONB (structured, queryable)
3. AI Generate V2 reads primary_keywords for validation
4. **Confidence-based enforcement**: Only validate tone on high-confidence profiles
5. **Language-aware**: Can filter by language for multi-language businesses
6. Future: Use writing_rules + examples for richer prompt guidance
7. Future: Upgrade validation from keyword-matching to rule-compliance

**Graceful Degradation Flow**:
```typescript
// Scenario: AI generates 3 ideas, one has forbidden term

IDEA A (Menu) → Validates perfectly
  → Status: 'valid'
  → Source: 'ai'
  → Quality: 'high'

IDEA B (Vibe) → Contains forbidden term "billig" 🚫
  → Status: 'fallback'
  → Source: 'fallback_template'
  → Quality: 'standard'
  → Original Error: "Forbidden term detected"
  → Fallback Generated: "Hyggelig atmosfære 🌿\n\nKom ind og oplev [business_name]. [verified_anchor]."

IDEA C (Occasion) → Validates with warning (similar to recent post)
  → Status: 'valid_with_warnings'
  → Source: 'ai'
  → Quality: 'high'
  → Warnings: ['Similar to recent post #3']

// Result: User receives 3 usable ideas
// Cost: Same $0.015 (no extra AI call for fallback)
// UX: Transparent about quality, better than 0 ideas
```

**Template Structures**:
```typescript
// Menu Spotlight Template
{
  hook: "[MenuItem] [food_emoji]",
  caption_base: "Prøv vores [MenuItem]. [location_anchor]. [slot_reasoning]",
  menu_item: { random from allowed_categories },
  template_type: 'menu_spotlight'
}

// Vibe Reminder Template
{
  hook: "[tone_word] [place_emoji]",
  caption_base: "[interior_anchor]. Kom ind og oplev [business_name].",
  menu_item: null,
  template_type: 'vibe_reminder'
}

// Occasion Prompt Template
{
  hook: "[occasion_phrase] [time_emoji]",
  caption_base: "[occasion_anchor]. [cta_phrase] [business_name].",
  menu_item: null,
  template_type: 'occasion_prompt'
}
```

**User Transparency**:
```json
{
  "summary": {
    "generation_quality": "partial",
    "ai_ideas": 2,
    "fallback_ideas": 1,
    "auto_fixed_ideas": 0,
    "warnings": 1,
    "total_cost": "$0.015",
    "cost_saved": "$0.000 (no retry needed)"
  }
}
```



## Future Improvements

### Planned Enhancements:
1. **A/B Testing Framework** - Test CTA variations
2. **Image Generation** - Auto-generate images based on photo_suggestion
3. **Multi-Language Support** - Expand beyond Danish/Swedish/German
4. **Seasonal Templates** - Holiday-specific slot strategies
5. **Performance Caching** - Cache BrandPolicy + IdeaPlan for repeat requests
6. **User Feedback Loop** - Learn from engagement metrics to improve ideas
7. ~~**Timezone + Opening Hours Awareness**~~ ✅ **IMPLEMENTED**
8. **Weekend vs Weekday Strategy** - Different approaches for Sat/Sun
9. **Special Events Integration** - Detect and adapt to local events/holidays
10. ~~**Novelty Check with Fingerprints**~~ ✅ **IMPLEMENTED**
11. ~~**Graceful Degradation with Fallbacks**~~ ✅ **IMPLEMENTED**
12. **Three-Tier Offerings Structure** - exact/generic/forbidden for better hallucination prevention
13. **Slot-Level Retry** - Regenerate only failed slots (if templates insufficient)
14. **Smart Auto-Fix** - Automatically correct fixable validation errors (wrong menu items, etc.)
15. ~~**Tone Validation**~~ ✅ **IMPLEMENTED** (keyword-based warning system)
16. ~~**Prompt Optimization (Remove Redundancy)**~~ ✅ **IMPLEMENTED**
17. **LLM-Based Tone Classification** - Upgrade from keyword matching to semantic tone analysis
18. ~~**Structured Tone Model v2**~~ ✅ **IMPLEMENTED** (primary_keywords + writing_rules + examples + formality + metadata + validation)

### Current Limitations:
- Only 3 ideas per request (could support 1-10)
- No image generation (only suggestions)
- Weather data limited to current conditions
- Previous post analysis limited to 10 recent posts
- No sentiment analysis on user comments
- Fallback templates are generic (less creative than AI)
- Tone validation is keyword-based (could be more sophisticated with LLM-based tone analysis, but now has writing_rules + examples for guidance)
- ~~Opening hours not considered in daypart logic~~ ✅ **FIXED**
- ~~No "business closed" handling~~ ✅ **FIXED**
- ~~Previous post avoidance too soft (pattern-based)~~ ✅ **FIXED** (now fingerprint-based)
- ~~Batch validation rejects all ideas if one fails~~ ✅ **FIXED** (now per-idea with fallbacks)
- ~~No tone validation~~ ✅ **FIXED** (keyword-based warning system)
- ~~Tone appears twice in prompt (redundant)~~ ✅ **FIXED** (single source in Brand Policy)



## Conclusion

The AI Generate V2 system is a sophisticated, multi-layered architecture that:
- ✅ Generates culturally-appropriate content
- ✅ Respects brand voice and constraints
- ✅ Prevents factual hallucinations
- ✅ Optimizes for platform-specific best practices
- ✅ Provides consistent, high-quality post ideas

**Core Philosophy**: Deterministic constraints + creative AI = Reliable, authentic, engaging content.
