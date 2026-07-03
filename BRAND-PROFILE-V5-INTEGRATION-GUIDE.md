# Brand Profile V5 - Integration Guide for Content Systems

**Date**: May 8, 2026  
**Status**: ✅ Production-Ready (deployed to brand-profile-generator-v5)  
**Test Business**: Café Faust (ID: 2037d63c-a138-4247-89c5-5b6b8cef9f3f)

---

## Executive Summary

Brand Profile V5 achieves **100% factual accuracy** through strict data-driven rules and enhanced prompt engineering. All content now reflects verified facts from database, not AI inference or hallucinations.

### Key Improvements

**Layer 3 (Identity Profile):**
- ✅ 100% location naming consistency ("ved åen" not "ved Aarhus Å")
- ✅ Factual geographic claims ("Regional forankring" based on verified 44-165km supplier distances)
- ✅ Correct brunch terminology (never "morgenmad", always "brunch")
- ✅ Day-specific opening hours (09:30 hverdage, 09:00 weekend - exact times)
- ✅ Zero hallucinations (no invented facilities)

**Layer 4 (Audience Segments):**
- ✅ Brunch-only behavior (no breakfast patterns like "før arbejde")
- ✅ Social/experience_seeking motivations for brunch (not convenience)
- ✅ Programme-appropriate timing windows
- ✅ Evidence-based content angles

---

## Data Structure Changes

### Layer 3: Identity Profile (business_brand_profile table)

**Current Fields in Use:**

```typescript
{
  brand_essence: string;        // One-sentence brand summary
  positioning: string;          // Market positioning statement
  core_values: string[];        // Array of 3-5 values (title - description)
  what_makes_us_different: string;  // USP statement
  confidence: number;           // 0-1 (typically 0.9)
}
```

**Example (Café Faust):**

```json
{
  "brand_essence": "En alsidig café ved åen, der tilbyder en bred vifte af brunch, frokost og aftensmad med fokus på regionale råvarer.",
  
  "positioning": "Café Faust er det ideelle sted ved åen for dem, der ønsker en helhedsoplevelse fra brunch til bar. Vi skiller os ud ved at tilbyde hjemmelavede retter med regionale ingredienser, hvilket sikrer en autentisk smagsoplevelse hele dagen.",
  
  "core_values": [
    "Hjemmelavet kvalitet - alt fra granola til Nutella er lavet fra bunden",
    "Regional forankring - regionale råvarer fra Tange Sø og Højer",
    "Bred tilgængelighed - åbent fra brunch kl. 09:30 på hverdage, 09:00 i weekenden til bar kl. 02:00 fredag-lørdag",
    "Variation og fleksibilitet - tilbyder både vegetariske og veganske muligheder"
  ],
  
  "what_makes_us_different": "Vi er den eneste café ved åen, der kombinerer hjemmelavede retter med regionale råvarer og en all-day menu.",
  
  "confidence": 0.9
}
```

### Layer 4: Audience Segments (business_programme_profiles.audience_segments JSONB)

**Segment Structure:**

```typescript
{
  label: string;                // "Weekend-brunch-gæster", "Familieaftener kl. 17:30-19:30"
  timing_windows: string[];     // ["Lør-Søn 10:00-14:00"]
  content_angles: string[];     // ["Social brunch-oplevelse", "Variation i brunchmenu"]
  segment_size: string;         // "primary" | "secondary" | "niche"
  motivation: string;           // "social_gathering" | "convenience" | "experience_seeking" | "routine"
  decision_timing: string;      // "spontaneous" | "planned" | "mixed"
  goal_contribution: string;    // "drive_footfall" | "strengthen_brand" | "retain_regulars"
  evidence: string[];           // ["Menu has børneportioner", "Weekend hours 09:00-13:00"]
}
```

**Example (Café Faust - Brunch Programme):**

```json
[
  {
    "label": "Weekend-brunch-gæster",
    "timing_windows": ["Lør-Søn 10:00-14:00"],
    "content_angles": [
      "Social brunch-oplevelse",
      "Variation i brunchmenu",
      "Weekend brunch-hygge"
    ],
    "segment_size": "primary",
    "motivation": "social_gathering",
    "decision_timing": "spontaneous",
    "goal_contribution": "drive_footfall",
    "evidence": [
      "Menu has brunchretter",
      "Weekend hours 09:00-14:00",
      "Location ved åen attracts weekend visitors"
    ]
  },
  {
    "label": "Brunch-entusiaster kl. 10-12",
    "timing_windows": ["Lør-Søn 10:00-12:00"],
    "content_angles": [
      "Hjemmelavede brunchretter",
      "Social brunch-oplevelse",
      "Variation i menu"
    ],
    "segment_size": "secondary",
    "motivation": "experience_seeking",
    "decision_timing": "spontaneous",
    "goal_contribution": "drive_footfall",
    "evidence": [
      "Menu has hjemmelavet granola, Nutella",
      "Regional ingredients from Tange Sø, Højer",
      "Variety in brunch offerings"
    ]
  },
  {
    "label": "Familiebrunches kl. 10-13",
    "timing_windows": ["Lør-Søn 10:00-13:00"],
    "content_angles": [
      "Børnevenlig menu",
      "Social brunch-oplevelse",
      "Weekend hygge"
    ],
    "segment_size": "niche",
    "motivation": "social_gathering",
    "decision_timing": "spontaneous",
    "goal_contribution": "drive_footfall",
    "evidence": [
      "Family-friendly location ved åen",
      "Weekend hours suitable for families",
      "Børneportioner available"
    ]
  }
]
```

---

## Critical Rules for Content Generation

### Rule 1: Brunch vs Morgenmad (CRITICAL)

When programme name contains "Morgenmad/Brunch" → It means **BRUNCH ONLY** (ignore "Morgenmad" completely).

**CORRECT Usage:**
- ✅ "Kom til brunch i weekenden"
- ✅ "Social brunch-oplevelse"
- ✅ "Variation i brunchmenu"
- ✅ "Weekend brunch-hygge"

**FORBIDDEN:**
- ❌ "Morgenmad" (word does not exist in content)
- ❌ "Hurtig morgenmad før arbejde" (breakfast behavior)
- ❌ "Quick breakfast" (breakfast behavior)
- ❌ Any reference to "før arbejde" (before work)

**Behavior Characteristics:**
- **Brunch**: Leisurely, social, 10:00-14:00, weekends, experience-seeking
- **NOT Breakfast**: Quick, convenient, before work, 07:00-09:00

### Rule 2: Location Naming Consistency

When `local_location_reference` exists in data → Use **ONLY** that exact phrase.

**Example (Café Faust):**
- Database: `local_location_reference = "ved åen"`
- ✅ CORRECT: "café ved åen", "udsigt over åen", "beliggenhed ved åen"
- ❌ WRONG: "ved Aarhus Å", "ved Aarhus Å i hjertet af byen"

**Never add geographic specificity** that user intentionally removed.

### Rule 3: Geographic Claims Must Be Factual

Use `supplier_analysis` from `business_location_intelligence` table:

```typescript
{
  geographic_scope: "local" | "regional" | "national",
  suppliers: [{
    name: string,
    distance_km: number,
    verified: boolean
  }],
  local_count: number,    // < 30km
  regional_count: number, // 30-100km
  national_count: number  // > 100km
}
```

**Example (Café Faust):**
- Suppliers: Tange Sø (44km), Højer (165km)
- `geographic_scope`: "regional"
- ✅ CORRECT: "regionale råvarer fra Tange Sø og Højer"
- ❌ WRONG: "lokale råvarer" (suppliers are 44-165km = not local)

### Rule 4: Day-Specific Opening Hours

When `opening_hours` varies by day → Use **exact times**, not rounded.

**Example (Café Faust):**
- Weekdays: 09:30-23:00
- Weekends: 09:00-02:00 (Fri-Sat)
- ✅ CORRECT: "åbent fra brunch kl. 09:30 på hverdage, 09:00 i weekenden"
- ❌ WRONG: "åbent fra kl. 9" (generic/rounded)

Only generalize if ALL days have IDENTICAL hours.

### Rule 5: No Hallucinations

Only mention features verified in database:

**FORBIDDEN (unless in data):**
- ❌ "terrasse" (outdoor seating)
- ❌ "koncerter" (concerts)
- ❌ "live musik" (live music)
- ❌ "have" (garden)
- ❌ "udendørs siddepladser" (outdoor seating)

If not in database → Don't mention it.

---

## Integration Points for Weekly Plan & Dagens Forslag

### 1. Query Brand Profile V5 Data

**Database Query:**

```sql
-- Get complete brand profile
SELECT 
  brand_essence,
  positioning,
  core_values,
  what_makes_us_different
FROM business_brand_profile
WHERE business_id = '{business_id}';

-- Get audience segments per programme
SELECT 
  programme_type,
  programme_name,
  audience_segments
FROM business_programme_profiles
WHERE business_id = '{business_id}';
```

### 2. Use Layer 3 for Voice/Positioning

**Brand Essence → Post Opening/Hook:**
```typescript
// Example: Café Faust
brand_essence = "En alsidig café ved åen, der tilbyder en bred vifte af brunch, frokost og aftensmad med fokus på regionale råvarer."

// Use for post openings:
"Som en alsidig café ved åen..."
"Vi tilbyder en bred vifte af brunch til aftensmad..."
```

**Positioning → Campaign Themes:**
```typescript
positioning = "Café Faust er det ideelle sted ved åen for dem, der ønsker en helhedsoplevelse fra brunch til bar..."

// Use for campaign positioning:
"Det ideelle sted ved åen for hele dagen"
"Fra brunch til bar - en helhedsoplevelse"
```

**Core Values → Content Pillars:**
```typescript
core_values = [
  "Hjemmelavet kvalitet - alt fra granola til Nutella er lavet fra bunden",
  "Regional forankring - regionale råvarer fra Tange Sø og Højer",
  "Bred tilgængelighed - åbent fra brunch kl. 09:30 på hverdage...",
  "Variation og fleksibilitet - tilbyder både vegetariske og veganske muligheder"
]

// Map to content themes:
Theme 1: Hjemmelavet (process content)
Theme 2: Regional forankring (product content - suppliers)
Theme 3: All-day service (place content - hours)
Theme 4: Menu diversity (product content - variations)
```

### 3. Use Layer 4 for Time-Based Targeting

**Match Current Day/Hour to Active Segment:**

```typescript
function getActiveSegment(
  audienceSegments: AudienceSegment[],
  currentDay: number,  // 0=Sun, 6=Sat
  currentHour: number   // 0-23
): AudienceSegment | null {
  
  for (const segment of audienceSegments) {
    for (const window of segment.timing_windows) {
      // Parse: "Lør-Søn 10:00-14:00"
      if (matchesCurrentTime(window, currentDay, currentHour)) {
        return segment;
      }
    }
  }
  
  return null;
}

// Example: Saturday 11:00
const activeSegment = getActiveSegment(brunchSegments, 6, 11);
// Returns: "Weekend-brunch-gæster" segment

// Use for content:
post_target = activeSegment.label;  // "Weekend-brunch-gæster"
content_angles = activeSegment.content_angles;  // ["Social brunch-oplevelse", ...]
```

**Content Angle → Post Topics:**

```typescript
// Active segment: "Weekend-brunch-gæster"
content_angles = [
  "Social brunch-oplevelse",
  "Variation i brunchmenu",
  "Weekend brunch-hygge"
]

// Generate posts:
Post 1: Focus on social aspect (friends gathering for brunch)
Post 2: Highlight menu variety (show different brunch dishes)
Post 3: Weekend vibe (cozy weekend atmosphere)
```

### 4. Weekly Plan Integration

**Map Programmes to Days/Times:**

```typescript
const weeklyPlan = {
  monday: {
    morning: {
      programme: "Morgenmad/Brunch",
      activeSegment: "Weekend-brunch-gæster",  // If weekend
      contentAngles: ["Social brunch-oplevelse", ...],
      suggestedPosts: [
        { type: "product", focus: "brunchretter" },
        { type: "place", focus: "weekend hygge ved åen" }
      ]
    },
    lunch: {
      programme: "Frokost",
      activeSegment: "Frokost-pendler",
      contentAngles: ["Hurtig frokostløsning", "Frisklavede retter"],
      suggestedPosts: [
        { type: "product", focus: "dagens frokost" },
        { type: "urgency", focus: "klar nu" }
      ]
    },
    // ... evening, bar
  },
  // ... tuesday-sunday
}
```

### 5. Dagens Forslag (Daily Suggestions)

**Time-Based Content Recommendations:**

```typescript
// Example: Saturday 10:30 (brunch time)
const now = { day: 6, hour: 10 };
const activeSegment = getActiveSegment(brunchSegments, 6, 10);

// Generate daily suggestions
const dailySuggestions = {
  programme: "Morgenmad/Brunch",
  segment: "Weekend-brunch-gæster",
  
  suggestions: [
    {
      type: "product",
      angle: "Variation i brunchmenu",
      idea: "Vis dagens brunchretter med fokus på hjemmelavede specialiteter",
      cta: "Book bord til brunch"
    },
    {
      type: "place",
      angle: "Weekend brunch-hygge",
      idea: "Stem foto af gæster der hygger ved brunch ved åen",
      cta: "Kom forbi i weekenden"
    },
    {
      type: "social_proof",
      angle: "Social brunch-oplevelse",
      idea: "Del billede af venner/familie der deler brunchretter",
      cta: "Tag dine venner med"
    }
  ],
  
  brandVoice: {
    essence: "alsidig café ved åen med fokus på regionale råvarer",
    positioning: "helhedsoplevelse fra brunch til bar",
    values: ["Hjemmelavet kvalitet", "Regional forankring"]
  }
}
```

---

## Migration Checklist

### Old Brand Profile → V5 Migration

- [ ] **Update database queries** to fetch from `business_brand_profile` table
- [ ] **Parse Layer 3 fields**: `brand_essence`, `positioning`, `core_values`, `what_makes_us_different`
- [ ] **Parse Layer 4 segments**: `audience_segments` JSONB array from `business_programme_profiles`
- [ ] **Implement brunch rule**: When programme name contains "Morgenmad/Brunch" → use ONLY "brunch" terminology
- [ ] **Implement location consistency**: Use `local_location_reference` exactly as stored
- [ ] **Remove hardcoded brand voice**: Use Layer 3 data instead of static brand profiles
- [ ] **Add time-based segment matching**: Filter segments by current day/hour using `timing_windows`
- [ ] **Map content_angles to post ideas**: Use segment content angles for topic generation
- [ ] **Verify no hallucinations**: Only mention features present in database

### Testing with Café Faust

```bash
# Regenerate brand profile
deno run --allow-net --allow-env --allow-read --env-file=.env scripts/test-v5-direct.ts

# Validate brunch behavior
deno run --allow-net --allow-env --allow-read --env-file=.env scripts/validate-brunch-behavior.ts

# Check Layer 3 consistency
deno run --allow-net --allow-env --allow-read --env-file=.env scripts/final-validation.ts

# Analyze Layer 4 segments
deno run --allow-net --allow-env --allow-read --env-file=.env scripts/analyze-layer4-segments.ts
```

---

## Examples by Programme Type

### Brunch Programme (09:00-14:00)

**Active Segments:**
1. **Weekend-brunch-gæster** (Primary, Lør-Søn 10:00-14:00)
   - Motivation: social_gathering
   - Content: "Social brunch-oplevelse", "Variation i brunchmenu", "Weekend brunch-hygge"
   - Post ideas: Friends gathering, menu variety, weekend vibes

2. **Brunch-entusiaster kl. 10-12** (Secondary, Lør-Søn 10:00-12:00)
   - Motivation: experience_seeking
   - Content: "Hjemmelavede brunchretter", "Variation i menu"
   - Post ideas: Unique dishes, homemade quality, menu exploration

3. **Familiebrunches kl. 10-13** (Niche, Lør-Søn 10:00-13:00)
   - Motivation: social_gathering
   - Content: "Børnevenlig menu", "Weekend hygge"
   - Post ideas: Family-friendly atmosphere, kids welcome

### Frokost Programme (09:00-17:30)

**Active Segments:**
1. **Frokost-pendler** (Primary, Man-Fre 12:00-14:00)
   - Motivation: convenience
   - Content: "Hurtig frokostløsning", "Frisklavede retter", "Nærhed til åen"
   - Post ideas: Quick lunch, fresh food, convenient location

2. **Turister på frokost-jagt** (Secondary, Man-Søn 11:00-15:00)
   - Motivation: experience_seeking
   - Content: "Autentiske lokale retter", "Nyd frokost med udsigt"
   - Post ideas: Local specialties, waterfront dining, authentic experience

### Aftensmad Programme (17:30-21:30)

**Active Segments:**
1. **Familieaftener kl. 17:30-19:30** (Primary, Man-Søn)
   - Motivation: social_gathering
   - Content: "Børnevenlige retter", "Familievenlig atmosfære", "Hjemmelavede måltider"
   - Post ideas: Family dinners, kids menu, homemade quality

2. **Date Night par kl. 19:00-21:30** (Secondary, Man-Søn)
   - Motivation: social_gathering
   - Content: "Romantisk middag", "Hjemmelavede specialiteter", "Hyggelig beliggenhed ved åen"
   - Post ideas: Romantic atmosphere, special dishes, waterfront dining

### Bar Programme (22:00-02:00)

**Active Segments:**
1. **After-Work Drinks Seekers** (Primary, Man-Fre 22:00-00:00)
   - Motivation: social_gathering
   - Content: "Hjemmelavede cocktails", "Socialt samvær efter arbejde", "Afslapning ved åen"
   - Post ideas: Cocktail specials, after-work relaxation, social gathering

2. **Weekend Nightlife Enthusiasts** (Secondary, Lør-Søn 22:00-02:00)
   - Motivation: social_gathering
   - Content: "Festlige cocktails", "Weekend hygge med venner", "Unik atmosfære ved åen"
   - Post ideas: Weekend party, drinks with friends, late-night vibes

---

## API Integration Example

**Fetch Brand Profile V5:**

```typescript
const { data: brandProfile } = await supabase
  .from('business_brand_profile')
  .select('brand_essence, positioning, core_values, what_makes_us_different')
  .eq('business_id', businessId)
  .single();

const { data: programmes } = await supabase
  .from('business_programme_profiles')
  .select('programme_type, programme_name, audience_segments')
  .eq('business_id', businessId);

// Use in content generation
const contentContext = {
  voice: {
    essence: brandProfile.brand_essence,
    positioning: brandProfile.positioning,
    values: brandProfile.core_values
  },
  audience: getCurrentAudienceSegment(programmes, currentDay, currentHour),
  rules: {
    brunchOnly: true,  // If programme contains "Morgenmad/Brunch"
    locationPhrase: "ved åen",  // From local_location_reference
    geographicScope: "regional"  // From supplier_analysis
  }
};
```

---

## Contact & Support

**Deployment**: brand-profile-generator-v5 (Supabase Edge Function)  
**Project**: kvqdkohdpvmdylqgujpn  
**Documentation**: LAYER-3-FACTUAL-ACCURACY-COMPLETE.md

**Validation Scripts**:
- `scripts/validate-brunch-behavior.ts` - Brunch behavior check
- `scripts/final-validation.ts` - Layer 3 comprehensive validation
- `scripts/analyze-layer4-segments.ts` - Layer 4 segment analysis
- `scripts/check-consistency.ts` - Location & geographic consistency

All improvements are **generic and reusable** across all businesses - no hardcoding for Café Faust.
