# Layer 4 Implementation: Audience Segmentation

**Date:** May 6, 2026  
**Status:** ✅ Complete - 3/3 tests passing  
**Model:** gpt-4o-mini (temperature 0.3, max_tokens 1500)  
**Budget:** ~15s per programme

---

## Purpose

Generate programme-specific audience segments that answer:
- **WHO** visits this programme (role, motivation)
- **WHEN** they visit (timing_windows within programme hours)
- **WHAT** resonates with them (content_angles for social posts)

**Scope:** Programme-level (different segments per programme, not business-level)

---

## Strategic Principles (User-Approved)

### 1. AI Complexity Detector (2-4 segments per programme)

AI dynamically determines segment count based on:
- **Menu variety:** 5-10 items → 2 segments, 10-20 → 3, 20+ → 4
- **Hours span:** 2-3 hours → 2 segments, 4-6 → 3, 6+ → 4
- **Location type:** Suburban → 2, Urban → 3, Tourist → 4
- **Programme type:** Bar/late_night → 2, Brunch/all_day → 3-4

**Result:** Simple programmes get 2 segments, complex programmes get 3-4.

### 2. Overlapping Across Programmes, Exclusive Within Programme

- **Across programmes:** Same person can be "Weekend-familie" at brunch AND "Date Night par" at dinner (role-based targeting)
- **Within programme:** Each visit is ONE role with ONE motivation (either family mode OR foodie mode, not both)

### 3. Replace Stage B5 (Programme-Level is Source of Truth)

- **Old system:** Business-level audience_segments in brand-profile-generator (Stage B5)
- **New system:** Programme-level audience_segments in Layer 4 (business_programme_profiles table)
- **Migration:** Weekly Plan will consume Layer 4 programme segments instead of Stage B5 business segments

### 4. Must Align With Layer 2 Commercial Orientation

**Validation rule:** Primary segment must match Layer 2:
- If Layer 2 says `decision_timing: "spontaneous"` → Primary segment must be `decision_timing: "spontaneous"`
- If Layer 2 says `baseline_goal_split: { drive_footfall: 60% }` → Primary segment must be `goal_contribution: "drive_footfall"`

**Purpose:** Coherence between commercial strategy (Layer 2) and audience targeting (Layer 4) → content strategy (Weekly Plan)

### 5. Evidence Field Required

**Format:**
```typescript
evidence: [
  "Menu has børneportioner",
  "Weekend hours 09:00-13:00",
  "Family-safe suburban area"
]
```

**Purpose:**
- Transparency: Owner sees WHY AI chose this segment
- Quality gating: If evidence empty/weak → low confidence, may be hallucinated
- Trust: Verifiable claims only

---

## Input Context

Layer 4 consumes outputs from all previous layers:

### Layer 1: Programme Detection
- `programme_type`: "brunch", "lunch", "dinner", etc.
- `programme_name`: Display name
- `time_windows`: Operating hours (e.g., "Lør-Søn 09:00-14:00")
- `operating_days`: Days of week
- `menu_evidence`: Menu items linked to programme

### Layer 2: Commercial Orientation
- `decision_timing`: "spontaneous" | "planned" | "mixed"
- `baseline_goal_split`: { drive_footfall: 60, strengthen_brand: 30, retain_regulars: 10 }
- `content_type_affinity`: Weights for product_menu, atmosphere, etc.

### Layer 3: Identity Profile
- `brand_essence`: Business soul
- `positioning`: Competitive differentiation
- `core_values`: 3-5 values with evidence
- `what_makes_us_different`: USP

### Additional Context
- **Menu data:** 15 menu items with descriptions and prices
- **Location data:** neighborhood, area_type, tourist_context, landmarks
- **Business data:** name, category, city, establishment_type

---

## Output Structure

```typescript
{
  programme_type: "brunch",
  programme_name: "Brunch",
  audience_segments: [
    {
      label: "Weekend-familier",                // Specific role + context
      timing_windows: ["Lør-Søn 10:00-13:00"],  // When they visit
      content_angles: [                         // What resonates
        "Børnevenlig menu",
        "Hyggelige weekender",
        "Plads til barnevogne"
      ],
      segment_size: "primary",                  // primary | secondary | niche
      motivation: "social_gathering",           // Why they come
      decision_timing: "planned",               // When they decide
      goal_contribution: "strengthen_brand",    // What business gains
      evidence: [                               // Proof from data
        "Menu has børneportioner",
        "Weekend hours 09:00-13:00",
        "Family-safe area"
      ]
    }
  ],
  segment_confidence: 0.90,                     // 0-1
  segment_reasoning: "Brunch programme med..."  // Why these segments
}
```

### Segment Size Categories

- **primary:** 40-60% of programme guests (largest group)
- **secondary:** 25-40% of guests (significant group)
- **niche:** 10-25% of guests (smaller but real group)

### Motivation Options

- **social_gathering:** Meet others (families, friends, dates)
- **convenience:** Quick solution (breakfast before work, quick lunch)
- **experience_seeking:** Experience hunt (foodie, Instagram, try something new)
- **routine:** Regular habit (regulars, daily coffee)

### Decision Timing Options

- **spontaneous:** Same-day decision (walk by, feel like coffee)
- **planned:** Book/plan ahead (weekend brunch, special occasion)
- **mixed:** Both (some book, some drop in)

### Goal Contribution Options

- **drive_footfall:** Fill location, increase revenue, attract new guests
- **strengthen_brand:** Build brand awareness, create content moments
- **retain_regulars:** Keep regulars, community building

---

## Label Rules (Critical Quality Control)

### ✅ GOOD Labels (role + context)

- "Weekend-familier" (role + timing)
- "Morgengæster kl. 7-9" (role + timing)
- "Brunch-entusiaster" (role + motivation)
- "Date Night par" (role + occasion)
- "Turister på frokost-jagt" (role + need)
- "Familier på brunch-jagt kl. 10-13" (role + need + timing)

### ❌ BAD Labels (generic demographics)

- "Familier" (too generic - add timing/context)
- "Locals" (forbidden word - use role not demography)
- "Turister" (too broad - add need/occasion)
- "Par" (too generic - add occasion/timing)
- "Unge mennesker" (demography not role)
- "Customers", "Guests", "People" (NEVER - no content)

**Validation:** Rejects labels containing standalone generic terms (customers, locals, people, guests, tourists, families, couples, visitors, patrons)

---

## AI Complexity Detector Logic

### Scoring System (0-8 points)

**Menu Variety (0-2 points):**
- 20+ items: +2
- 10-19 items: +1
- <10 items: 0

**Hours Span (0-2 points):**
- 6+ hours: +2
- 4-6 hours: +1
- <4 hours: 0

**Location Type (0-2 points):**
- tourist_area: +2
- urban_center: +1
- suburban: 0

**Programme Type (0-2 points):**
- brunch/lunch/all_day: +1
- bar/late_night: -1

### Segment Count Mapping

- **Score 6-8:** 4 segments (very complex)
- **Score 4-5:** 3 segments (complex)
- **Score 0-3:** 2 segments (simple)

---

## Test Results

### Test 1: Italian Restaurant Dinner (Simple Programme)

**Input:**
- Menu: 6 items (pasta, pizza, desserts)
- Hours: 17:00-22:00 (5 hours)
- Location: Suburban (Valby)
- Programme: Dinner only

**AI Complexity Detector:** 2 segments recommended

**Output:**
- ✅ 2 segments generated
- ✅ Confidence: 0.90
- ✅ Labels: "Familier på udespisning" (primary), "Date Night par" (secondary)
- ✅ Primary segment: planned + strengthen_brand (matches Layer 2)
- ✅ All segments have 2+ evidence items

**Quality Checks:**
- ✅ Segment count valid (2, expected 2)
- ✅ Primary segment found
- ✅ All segments have evidence
- ✅ All labels specific (no generic names)
- ✅ High confidence score (0.90)
- ✅ Reasoning provided (217 chars)

---

### Test 2: Café Faust Brunch (Complex Programme)

**Input:**
- Menu: 12 items (diverse brunch options, børnebrunch, champagne)
- Hours: Lør-Søn 09:00-14:00 (5 hours, weekend only)
- Location: Tourist area (Nyhavn)
- Programme: Brunch

**AI Complexity Detector:** 3 segments recommended

**Output:**
- ✅ 3 segments generated
- ✅ Confidence: 0.90
- ✅ Labels:
  - "Weekend-turister kl. 09-11" (primary)
  - "Brunch-entusiaster kl. 11-14" (secondary)
  - "Familier på brunch-jagt kl. 10-13" (niche)
- ✅ Primary segment: mixed + drive_footfall (matches Layer 2)
- ✅ All segments have timing_windows, content_angles, evidence

**Quality Checks:**
- ✅ Segment count valid (3, expected 3-4)
- ✅ Primary segment found
- ✅ All segments have evidence
- ✅ All labels specific (role + timing context)
- ✅ High confidence score (0.90)
- ✅ Reasoning provided (212 chars)

**Key Validation:** Labels like "Weekend-turister kl. 09-11" passed validation because context ("kl. 09-11") makes it specific, not generic "Tourists"

---

### Test 3: Café Faust Lunch (Medium Complexity)

**Input:**
- Menu: 8 items (smørrebrød, dagens ret, salads, take-away)
- Hours: Man-Fre 11:30-15:00 (3.5 hours, weekday)
- Location: Tourist area (Nyhavn)
- Programme: Lunch

**AI Complexity Detector:** 2 segments recommended

**Output:**
- ✅ 2 segments generated
- ✅ Confidence: 0.90
- ✅ Labels:
  - "Turister på frokost-jagt" (primary)
  - "Lunchturister med take-away behov" (secondary)
- ✅ Primary segment: spontaneous + drive_footfall (matches Layer 2)
- ✅ Evidence: Menu items (smørrebrød, frisk fisk, take-away), hours, location

**Quality Checks:**
- ✅ Segment count valid (2, expected 2-3)
- ✅ Primary segment found
- ✅ All segments have evidence
- ✅ All labels specific (role + need context)
- ✅ High confidence score (0.90)
- ✅ Reasoning provided (156 chars)

---

## Validation Criteria

### 1. Segment Count (2-4)
- Minimum: 2 segments
- Maximum: 4 segments
- Must match AI complexity detector recommendation

### 2. Primary Segment Exists
- Exactly one segment with `segment_size: "primary"`

### 3. Layer 2 Alignment (Critical)
- Primary segment `decision_timing` MUST match Layer 2 `decision_timing`
- Primary segment `goal_contribution` MUST match Layer 2 primary goal (highest % in baseline_goal_split)

### 4. All Segments Complete
- `label`: Non-empty, ≥3 chars, no forbidden generic terms
- `timing_windows`: Non-empty array
- `content_angles`: ≥2 items
- `evidence`: ≥2 items
- `segment_size`: "primary" | "secondary" | "niche"
- `motivation`: Valid enum value
- `decision_timing`: Valid enum value
- `goal_contribution`: Valid enum value

### 5. Label Specificity
- No standalone generic terms: customers, locals, people, guests, tourists, families, couples, visitors, patrons
- Must include role + context (timing, occasion, need, motivation)

### 6. Confidence & Reasoning
- `segment_confidence`: 0-1 range
- `segment_reasoning`: ≥20 chars explaining segment choices

---

## Example: Programme-Specific Segmentation

**Same Business (Café Faust), Different Programmes:**

### Brunch Programme (Weekend 09:00-14:00)
1. "Weekend-turister kl. 09-11" (primary)
   - Timing: Lør-Søn 09:00-11:00
   - Motivation: social_gathering
   - Decision: mixed
   - Goal: drive_footfall

2. "Brunch-entusiaster kl. 11-14" (secondary)
   - Timing: Lør-Søn 11:00-14:00
   - Motivation: experience_seeking
   - Decision: mixed
   - Goal: drive_footfall

3. "Familier på brunch-jagt kl. 10-13" (niche)
   - Timing: Lør-Søn 10:00-13:00
   - Motivation: social_gathering
   - Decision: mixed
   - Goal: drive_footfall

### Lunch Programme (Weekday 11:30-15:00)
1. "Turister på frokost-jagt" (primary)
   - Timing: Man-Fre 11:30-15:00
   - Motivation: social_gathering
   - Decision: spontaneous
   - Goal: drive_footfall

2. "Lunchturister med take-away behov" (secondary)
   - Timing: Man-Fre 11:30-15:00
   - Motivation: convenience
   - Decision: spontaneous
   - Goal: drive_footfall

**Key Insight:** Same business, different programmes → different segments. Overlapping roles (tourists appear in both) but different contexts (brunch experience-seekers vs lunch convenience-seekers).

---

## Database Schema

**Table:** `business_programme_profiles`  
**Column:** `audience_segments` (JSONB)  
**Relationship:** One row per (business_id, programme_type) combination

**Example stored value:**
```json
[
  {
    "label": "Weekend-familier",
    "timing_windows": ["Lør-Søn 10:00-13:00"],
    "content_angles": ["Børnevenlig menu", "Hyggelige weekender"],
    "segment_size": "primary",
    "motivation": "social_gathering",
    "decision_timing": "planned",
    "goal_contribution": "strengthen_brand",
    "evidence": ["Menu has børneportioner", "Weekend hours"]
  },
  {
    "label": "Brunch-entusiaster",
    "timing_windows": ["Lør-Søn 11:00-14:00"],
    "content_angles": ["Eggs Benedict", "Instagram-oplevelser"],
    "segment_size": "secondary",
    "motivation": "experience_seeking",
    "decision_timing": "mixed",
    "goal_contribution": "drive_footfall",
    "evidence": ["Premium brunch items", "Tourist location"]
  }
]
```

**Migration:** Already created in `20260506_create_business_programme_profiles.sql`

---

## Integration With Weekly Plan

### Current State (Stage B5)
```typescript
// Brand profile generator creates business-level segments
const businessSegments = [
  { label: "Locals", timing: "all-day", ... },
  { label: "Tourists", timing: "lunch-dinner", ... }
];
```

### Future State (Layer 4)
```typescript
// Layer 4 creates programme-level segments
const brunchSegments = [
  { label: "Weekend-familier", timing_windows: ["Lør-Søn 10:00-13:00"], ... },
  { label: "Brunch-entusiaster", timing_windows: ["Lør-Søn 11:00-14:00"], ... }
];

const lunchSegments = [
  { label: "Turister på frokost-jagt", timing_windows: ["Man-Fre 11:30-15:00"], ... },
  { label: "Lunchturister med take-away", timing_windows: ["Man-Fre 11:30-15:00"], ... }
];
```

**Migration Plan:**
1. Update `get-weekly-strategy` to consume Layer 4 programme segments
2. Update `get-quick-suggestions` to use programme segments for angle selection
3. Deprecate Stage B5 business-level audience_segments
4. Remove audience_segments from brand-profile-generator output

---

## File Locations

**AI Module:**  
`supabase/functions/_shared/brand-profile/audience-profile.ts`

**Test Suite:**  
`scripts/test-audience-profile.ts`

**Migration:**  
`supabase/migrations/20260506_create_business_programme_profiles.sql` (already created in Layer 2)

**Documentation:**  
`LAYER-4-IMPLEMENTATION.md` (this file)

---

## Next Steps

### ✅ Layer 4 Complete
- ✅ AI module created (audience-profile.ts)
- ✅ Test suite created (test-audience-profile.ts)
- ✅ 3/3 tests passing (0.90 confidence)
- ✅ Validation criteria enforced
- ✅ Database schema ready (audience_segments JSONB column)
- ✅ Documentation complete

### 🔜 Layer 5: Voice (Business-Level)
- Extract tone_of_voice, signature_phrases, never_say from existing data
- Business-level (constant across programmes)
- Deterministic or light AI extraction

### 🔜 System Orchestration
- Create orchestration function consuming Layers 1-5
- Update Weekly Plan to consume Layer 4 programme segments
- Deprecate Stage B5 business-level segments

### 🔜 Database Migration Deployment
- Deploy Layer 2 schema (business_programme_profiles)
- Deploy Layer 3 schema (positioning column)
- Verify JSONB structure for audience_segments

---

## Key Learnings

### 1. AI Complexity Detector Works
- Simple programme (6 menu items, 5h, suburban) → 2 segments ✅
- Complex programme (12 items, 5h, tourist area) → 3 segments ✅
- Medium programme (8 items, 3.5h, tourist area) → 2 segments ✅

### 2. Label Quality Matters
- First attempt: "Weekend Locals" (generic - FAILED validation)
- Second attempt: "Weekend-turister kl. 09-11" (role + timing - PASSED)
- Solution: Explicit GOOD vs BAD examples in prompt + stricter validation regex

### 3. Layer 2 Alignment Validated
- Test 1: planned + strengthen_brand → Primary segment matches ✅
- Test 2: mixed + drive_footfall → Primary segment matches ✅
- Test 3: spontaneous + drive_footfall → Primary segment matches ✅

### 4. Evidence Grounding Works
- All segments cite menu items, operating hours, location context
- No hallucinated segments (all verifiable from input data)
- Transparency enables owner trust and quality review

### 5. Programme-Specific Segmentation Validated
- Same business (Café Faust), different programmes → different segments
- Brunch: Weekend-turister, Brunch-entusiaster, Familier
- Lunch: Turister på frokost-jagt, Lunchturister med take-away
- Overlapping roles but different contexts ✅

---

**Status:** ✅ Layer 4 Complete (May 6, 2026)  
**Test Results:** 3/3 passing (0.90 confidence)  
**Next:** Layer 5 (Voice) → System Orchestration → Weekly Plan Integration
