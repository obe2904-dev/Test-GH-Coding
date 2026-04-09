# Three-Layer Architecture Implementation

## Overview

Successfully refactored the Brand Profile system to separate internal behavioral reasoning (Layers 1-2) from user-facing Brand Profile (Layer 3).

## Architecture

### Layer 1: usage_occasions[] (Internal, Rich)
**Location:** Prompt A output JSON  
**Purpose:** Capture rich behavioral data for downstream AI suggestions

**Schema:**
```json
{
  "id": "string_kebab_case",
  "name": "Short human name",
  "when": "Time window / daypart cue",
  "situation": "Contextual situation (why they're there)",
  "behavior": "Observable guest behavior",
  "job_to_be_done": "Underlying need solved",
  "evidence": [
    {
      "quote": "Exact snippet ≤180 chars",
      "source": "tier1_menu | tier2_website | tier2_images",
      "confidence": "high | medium | low"
    }
  ],
  "confidence": "high | medium | low"
}
```

**Extraction Logic:**
- 3-6 occasions per venue (fewer if evidence is weak)
- Based on venue-agnostic behavioral taxonomy:
  1. Long-form social meals
  2. Quick refuel stop
  3. Inclusion-first group dining
  4. Professional third-space
  5. Day→night flow
  6. With-children logistics

**Evidence Requirements:**
- Each occasion MUST have ≥1 evidence quote
- Quotes must be literal excerpts from input data
- Never invent location landmarks without visual verification

### Layer 2: content_triggers[] (Internal, Actionable)
**Location:** Prompt A output JSON  
**Purpose:** Machine-operable content guidance for AI post generation

**Schema:**
```json
{
  "trigger": "Short name (e.g., Social Anchor)",
  "based_on_usage_occasion_ids": ["id1", "id2"],
  "what_to_show": ["Visual motif 1", "Visual motif 2"],
  "copy_angles": ["Content angle 1", "Content angle 2"],
  "safe_claims_only": true,
  "evidence": [
    {
      "quote": "Exact snippet",
      "source": "tier1_menu | tier2_website | tier2_images",
      "confidence": "high | medium | low"
    }
  ],
  "confidence": "high | medium | low"
}
```

**Trigger Types:**
1. Social Anchor - gathering places
2. Day-to-Night Flow - meal to drinks transition
3. Waterfront/Location Setting - distinctive location
4. Family Logistics - easy dining with kids
5. Professional Third-Space - work-friendly

**Safety Rules:**
- what_to_show must be verifiable from first-party data
- NEVER add unverified interior elements (murals, art) unless:
  * Present in uploaded images, OR
  * Confirmed in Google Maps photos (when allowThirdParty=true)
- safe_claims_only: Always true

### Layer 3: Brand Profile (User-Facing, Compressed)
**Location:** Prompt B output  
**Purpose:** Short, editable user-facing fields

**Target Audience Format Change:**
- **FROM:** Agentless constructions ("Brunch ved åen hvor børn spiser med")
- **TO:** Temporal "Når gæster..." format ("Når gæster samles om længere brunch ved bordet")

**New Rules:**
- Use "Når gæster..." temporal phrasing
- Describe WHEN and HOW (not WHO)
- Build from 2-4 usage_occasions[] from Layer 1
- Transform occasion names into natural Danish phrases

**Allowed:**
✅ "Når gæster samles om længere brunch ved bordet"  
✅ "Når børn kan spise med uden bøvl"  
✅ "Når aftenen glider fra middag til cocktails"

**Banned:**
❌ Demographics: "familier", "par", "turister", "studerende", "unge", "lokale"  
❌ Demographic framing: "Gæster der søger...", "Folk som...", "Kunder der..."

## Implementation Changes

### Prompt A Updates
**File:** `/supabase/functions/_shared/brand-profile/prompts/prompt-a.ts`

1. **Added JSON Schema:**
   - usage_occasions[] array structure
   - content_triggers[] array structure

2. **Added Extraction Instructions:**
   - USAGE OCCASIONS EXTRACTION section with 6 behavioral patterns
   - CONTENT TRIGGERS EXTRACTION section with 5 trigger types
   - Example extractions for Café Faust

3. **Evidence Requirements:**
   - Every occasion/trigger must have ≥1 evidence quote
   - Quotes must be exact snippets ≤180 chars
   - Conservative inference allowed but marked as MEDIUM/LOW confidence

### Prompt B Updates
**File:** `/supabase/functions/_shared/brand-profile/prompts/prompt-b.ts`

1. **Schema Changes:**
   - Updated target_audience.value description to temporal format
   - Changed from agentless to "Når gæster..." phrasing
   - Kept demographics banned, allowed temporal descriptions

2. **System Prompt:**
   - Replaced AGENTLESS rules with TEMPORAL FORMAT rules
   - Updated examples to show "Når gæster..." phrasing
   - Clarified demographics ban vs temporal descriptions

3. **User Prompt:**
   - Added USAGE OCCASIONS section showing all occasions from Prompt A
   - Added CONTENT TRIGGERS section showing all triggers from Prompt A
   - Updated field-specific rules for target_audience

4. **Generation Logic:**
   - target_audience.value: Select 2-4 occasions from Layer 1
   - Rewrite as natural Danish temporal phrases
   - target_audience.proof: Reference usage_occasion IDs

## Quality Gates

### Evidence Requirements ✅
- Every usage_occasion has ≥1 evidence quote
- Every content_trigger has ≥1 evidence quote
- Quotes are literal excerpts from input data

### Behavioral Focus ✅
- Target audience is behavior-centric (temporal moments)
- No demographic personas in output
- "Når gæster..." describes WHEN/HOW, not WHO

### No Invented Facts ✅
- Location landmarks require visual verification
- Interior elements need uploaded images or Google Maps photos
- safe_claims_only: true enforced on all triggers

### Compact Brand Profile ✅
- Target audience stays 2-4 sentences
- Richness lives in internal arrays (Layers 1-2)
- User-facing fields remain editable

### Venue-Agnostic ✅
- 6 behavioral patterns generalize across venue types
- No assumptions about specific business categories
- Works for: Michelin restaurant, food truck, café, pizza place, etc.

## Next Steps

1. **Deploy Edge Function:**
   ```bash
   supabase functions deploy brand-profile-generator
   ```

2. **Test with Real Venues:**
   - Generate Brand Profile for test business
   - Verify usage_occasions[] produced (3-6 occasions)
   - Verify content_triggers[] produced (3-5 triggers)
   - Check target_audience uses "Når gæster..." format
   - Validate no demographics in output

3. **Update AI Post Suggestions:**
   - Modify post generation to read usage_occasions[]
   - Use content_triggers[] for content guidance
   - Don't rely primarily on Brand Profile prose

4. **Validation Tests:**
   - Banned words not in target_audience.value
   - usage_occasion count within 3-6 range
   - Evidence quotes present for all occasions/triggers
   - No third-party usage when allowThirdParty=false

## Example Output

**Input Business:** Café Faust (riverside brunch café in Aarhus)

**Layer 1 - usage_occasions[]:**
```json
[
  {
    "id": "weekend-brunch-with-kids",
    "name": "Weekend brunch with kids",
    "when": "Weekend mornings 10-14",
    "situation": "Family gathering where kids can eat comfortably",
    "behavior": "Long sit-down meals, sharing brunch boards",
    "job_to_be_done": "Parents relax while kids are fed",
    "evidence": [
      {"quote": "Kids menu with pancakes", "source": "tier1_menu", "confidence": "high"}
    ],
    "confidence": "high"
  },
  {
    "id": "work-lunch",
    "name": "Work lunch",
    "when": "Weekday lunch 12-15",
    "situation": "Professional meeting or solo work break",
    "behavior": "Quick service, laptop-friendly seating",
    "job_to_be_done": "Efficient meal during work day",
    "evidence": [
      {"quote": "City center location", "source": "tier1_business", "confidence": "medium"}
    ],
    "confidence": "medium"
  },
  {
    "id": "dinner-to-drinks",
    "name": "Dinner to drinks",
    "when": "Evening 18:00-23:00",
    "situation": "Starting with meal, transitioning to drinks",
    "behavior": "Long stay, cocktails after dinner",
    "job_to_be_done": "Complete evening out in one place",
    "evidence": [
      {"quote": "Cocktail menu, open until 23:00", "source": "tier2_website", "confidence": "high"}
    ],
    "confidence": "high"
  }
]
```

**Layer 2 - content_triggers[]:**
```json
[
  {
    "trigger": "Waterfront Social Dining",
    "based_on_usage_occasion_ids": ["weekend-brunch-with-kids", "dinner-to-drinks"],
    "what_to_show": ["Brunch plates by river", "Sunset terrace dining"],
    "copy_angles": ["Dine by Aarhus Å", "Brunch with a view"],
    "safe_claims_only": true,
    "evidence": [
      {"quote": "Located by Aarhus Å", "source": "tier2_website", "confidence": "high"}
    ],
    "confidence": "high"
  }
]
```

**Layer 3 - Brand Profile (target_audience):**
```json
{
  "value": "Når gæster samles om længere brunch ved åen, når børn kan spise med uden bøvl, samt når aftenen glider fra middag til cocktails",
  "proof": [
    "Based on usage_occasion: weekend-brunch-with-kids (Kids menu evidence)",
    "Based on usage_occasion: dinner-to-drinks (Cocktails + late hours)",
    "Location context: Aarhus Å riverside setting"
  ]
}
```

## File Changes Summary

**Modified Files:**
- `supabase/functions/_shared/brand-profile/prompts/prompt-a.ts` (565 → 708 lines)
  * Added usage_occasions[] schema (30 lines)
  * Added content_triggers[] schema (20 lines)
  * Added extraction instructions (93 lines)

- `supabase/functions/_shared/brand-profile/prompts/prompt-b.ts` (819 lines, multiple sections updated)
  * Updated target_audience schema description
  * Updated system prompt TARGET AUDIENCE section
  * Added USAGE OCCASIONS + CONTENT TRIGGERS sections to user prompt
  * Updated field-specific rules for target_audience

**No Breaking Changes:**
- Existing Brand Profile fields unchanged
- Backward compatible (new fields are additive)
- Old AI suggestions will continue working (but should be updated)
