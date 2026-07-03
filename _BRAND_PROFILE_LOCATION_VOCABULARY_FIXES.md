# Brand Profile Location Vocabulary Fixes
**Status**: 🔴 In Analysis  
**Priority**: High (affects published content authenticity)  
**Created**: 2026-06-22  
**Last Updated**: 2026-06-22

---

## Executive Summary

The brand profile generator (`brand-profile-generator-v5`) produces culturally inappropriate location vocabulary by applying generic water-related terms without considering:
1. **Water body type taxonomy** (river vs. sea vs. lake)
2. **Cultural-linguistic appropriateness** (Danish semantic associations)
3. **Positioning-vocabulary alignment** (casual vs. premium language)

**Impact**: Published content feels "off" and doesn't authentically represent businesses.

---

## Critical Issues Identified

### Issue 1: "ved vandet" (by the water) — Semantic Mismatch

**Problem**: Generic "ved vandet" used for urban river location (Aarhus Å)

**Why it fails**:
- In Danish, "ved vandet" → fjorden, havet, bugten, Øresund (sea/coastal)
- River contexts → "ved åen", "langs åen", "ved Aarhus Å"
- "Vandet" suggests expansive water (swimming, boats, horizon)
- "Åen" = intimate, urban, flowing water (different semantic field)

**Current problematic output**:
```json
"natural_vocabulary": [
  "ved åen", ✅
  "på Åboulevarden", ✅
  "i hjertet af Aarhus", ✅
  "ved vandet", ❌ WRONG FOR RIVER
  "udsigt", ❌ TOO GRAND
  "udeservering" ✅
]
```

**Should be**:
```json
"natural_vocabulary": [
  "ved åen",
  "langs åen",
  "på Åboulevarden",
  "i hjertet af Aarhus",
  "ved Aarhus Å",
  "udeservering"
]
```

**Affected business**: Café Faust (36e24a84-c32d-4123-910a-1bb2e64d34af)

---

### Issue 2: "udsigten" (the view) — Over-Promising

**Problem**: Standalone "udsigten" implies panoramic nature vista

**Why it fails**:
- "Udsigten" = panoramic perspective (mountain, hilltop, coastal cliff)
- Implies tourist attraction quality
- Åboulevarden is street-level, not elevated
- Oversells urban river view
- Clashes with casual positioning

**More appropriate alternatives**:
- ✅ "udsigt til åen" (specific, modest)
- ✅ "ved åen" (proximity-focused, not view-focused)
- ❌ Standalone "udsigten" (too grand for casual café)

---

### Issue 3: Demographic Segment Logic — Context vs. Target

**Problem**: Student/tourist segments assigned based on location context, not business appropriateness

**Example contradiction**:
- Michelin restaurant in student town → students are **context**, NOT target
- But current logic might add "students" because location = student area

**Should be**:
```
IF location_context.includes_students = true
  AND price_positioning IN (budget, value, mid-range)
  AND formality ≤ casual
  → student segment APPROPRIATE

IF location_context.includes_students = true
  AND price_positioning = premium/fine-dining
  AND formality = formal
  → student segment NOT APPROPRIATE
```

**Current Café Faust output**:
```json
"demographic_implications": [
  "Student-tilgængelighed",  // ✅ Correct (casual + value pricing)
  "Turist-visual appeal"     // ❓ Needs validation
]
```

---

## Root Cause Analysis

### 1. Missing Water Body Taxonomy

Generator lacks structured water type classification:

```
waterfront:
  - coastal:
      types: [fjord, sea, bay, ocean]
      danish_terms: ["ved vandet", "ved havet", "ved fjorden"]
  - river:
      types: [å, flod]
      danish_terms: ["ved åen", "langs åen", "ved floden"]
  - lake:
      types: [sø]
      danish_terms: ["ved søen", "ved vandkanten"]
```

### 2. No Cultural Vocabulary Validation

- No language-specific vocabulary rules
- No cultural appropriateness checks
- Generic English "waterfront" → Danish mapping is too broad

### 3. Positioning-Vocabulary Alignment Missing

Generator doesn't validate vocabulary against tone:
- "Udsigten" = premium/tourist positioning language
- Casual café by urban river = understated language ("ved åen")

### 4. **CRITICAL: Translation Contamination in Upstream Prompts**

**The fundamental architectural flaw**: Location terminology may be captured through **English-language prompts** processing **Danish content**, causing semantic drift.

**Translation contamination chain**:
```
Danish website: "ved åen i Aarhus"
     ↓
English prompt in analyze-website/populate-location-intelligence
     ↓
Internal translation: "by the river in Aarhus"
     ↓
Stored as: generic "waterfront" or "river"
     ↓
brand-profile-generator-v5 generates Danish content
     ↓
Output: "ved floden" ❌ WRONG
Should be: "ved åen" ✅ CORRECT
```

**Why this is catastrophic for Danish**:
- **"Åen"** = small river, stream, urban watercourse (intimate, specific, local)
  - "Aarhus Å", "ved åen", "langs åen"
  - ALWAYS used locally, never "floden"
  
- **"Floden"** = THE river (large, formal, generic, dramatic)
  - Used for major rivers: "floden Rhinen", "floden Seinen"
  - NEVER used for Aarhus Å
  
- **Cultural impact**: Using "floden" for "Aarhus Å" sounds absurd to locals
- **Similar issues**:
  - "Søerne" (the Lakes - specific Copenhagen location) ≠ "søen" (a lake)
  - "Nyhavn" (proper noun) ≠ "den nye havn" (the new harbor)

**Root cause**: Prompts are in English, assume English → Danish translation is 1:1

---

## Upstream Source Functions (Where Location Data Originates)

### 1. `analyze-website` (Free Tier) — **PRIMARY SOURCE OF TRUTH**
**Function**: `https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/analyze-website`

**Purpose**: 
- Scrape website for business information
- Extract: address, opening hours, menu items, location mentions
- **PRIMARY ROLE**: Capture how business talks about their location (verbatim)
- **Current weakness**: Not strong at picking up location markers like "åen i Aarhus", "Nyhavn", "søerne"

**Why homepage is best source**:
- ✅ Businesses already use correct local terminology
- ✅ They know what locals say ("ved åen", "Aarhus Ø", "bugten")
- ✅ Authentic language that represents their brand
- ⚠️ May need to analyze subpages too (location info often on "About" pages)

**Real examples from actual websites**:

**Café Faust** (`cafefaust.dk`):
```
Homepage: "Velkommen til Café Faust — lækker mad og oplevelser ved åen i Aarhus"
Extract: "ved åen" ✅ (perfect - this is what locals say)
```

**Restaurant Havnær** (`havnaer.dk`):
```
Homepage: "Du finder RESTAURANT Havnær på kanten af Århus Ø"
Extract: "Aarhus Ø" ✅ (location marker)
Extract: "på kanten" ⚠️ (awkward phrasing - may not want to reuse)

Subpage (/naer.htm): "Du finder Havnær på kanten af Aarhus Ø, i bygningen SHIP, 
                      med en fantastisk udsigt ud over Aarhus Bugten."
Extract: "Aarhus Bugten" ✅ (specific water body name)
Extract: "bugten" ✅ (what locals call it)
Extract: "udsigt ud over [water body]" ✅ (natural view phrasing)

Subpage: "Med vores placering ved vandet..."
Extract: "ved vandet" ✅ (OK for bay/large water, business chose this)
```

**Key insight**: Businesses already know the right local terms! We just need to:
1. **Extract** them from homepage AND subpages
2. **Preserve** them exactly as written
3. **Use** them in generated content

**What needs strengthening**:
- [ ] Analyze subpages (not just homepage) for location mentions
- [ ] Extract specific location markers: "ved åen", "Aarhus Ø", "Aarhus Bugten"
- [ ] Capture view mentions: "udsigt over [water body]"
- [ ] Distinguish between useful phrases ("ved åen") and awkward ones ("på kanten")
- [ ] Store verbatim in Danish, no translation layer

**Language risk**:
- ❓ Are prompts in English processing Danish content?
- ❓ Does it preserve original Danish location terminology?
- ❓ Or does it translate "åen" → "river" → stored in English?

### 2. `populate-location-intelligence` (Paid Tier) — **ENHANCEMENT LAYER**
**Function**: `https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/populate-location-intelligence`

**Purpose**:
- Structured assessment of location types
- Categories: city_centre, waterfront, transportation_hub, shopping_district
- Provides location scores and characteristics
- **ROLE**: Add marketing angles the business hasn't thought of (paid = marketing manager)

**Key principle**: 
- **Input**: Local terms extracted by `analyze-website` (e.g., "ved åen", "Aarhus Bugten")
- **Output**: Enhanced location strategy WHILE PRESERVING original local terms
- **Add value**: Suggest additional angles ("udsigt over bugten" if business only said "ved vandet")
- **Never replace**: Don't override business's local terms with generic alternatives

**Example flow for Restaurant Havnær**:
```
FROM analyze-website:
  - "Aarhus Ø" (location marker)
  - "Aarhus Bugten" (water body)
  - "ved vandet" (business's phrasing)
  - "udsigt ud over Aarhus Bugten" (view mention)

populate-location-intelligence ADDS:
  - Location type: waterfront (bay)
  - Score: 95 (exceptional water views)
  - Additional angles: "solnedgang over bugten", "udeservering ved bugten"
  - PRESERVES: "Aarhus Bugten", "ved vandet" (from business)
  - ENHANCES: Suggests "bugten" shorthand, validates "ved vandet" is appropriate for bay
```

**What it should NOT do**:
- ❌ Translate "bugten" to English "bay" and back to generic "fjorden"
- ❌ Override business's "ved vandet" with category-based "ved havet"
- ❌ Replace specific "Aarhus Bugten" with generic "vandet"

**Language risk**:
- ❓ Does it use English prompts to categorize Danish locations?
- ❓ When identifying "waterfront", does it preserve "åen" vs "floden" vs "bugten" distinction?
- ❓ Is vocabulary generated in English and then translated?
- ❓ Does it receive local terms from analyze-website or start from scratch?

---

## Solution Architecture (DRAFT)

### Principle: Language-First Location Capture

**Core requirement**: Location terminology MUST be captured and stored in the business's native language, with NO English intermediate steps.

### Option A: Language-Aware Prompts (RECOMMENDED)

**Approach**: All prompts that process business content must be in the business's language.

**Implementation**:
1. **`analyze-website`**:
   - Detect business language FIRST (from website)
   - Use **Danish prompts** for Danish businesses
   - Extract location terms verbatim: "åen", "Nyhavn", "søerne"
   - Store in original language

2. **`populate-location-intelligence`**:
   - Receive business language as input
   - Use **language-specific prompts** for classification
   - Include water body taxonomy IN TARGET LANGUAGE:
     ```
     Danish:
       Waterfront types:
       - "åen" (urban stream): ["ved åen", "langs åen"]
       - "floden" (major river): ["ved floden"]
       - "havnen" (harbor): ["i havnen", "ved kajen"]
       - "fjorden" (fjord): ["ved fjorden", "ved vandet"]
       - "havet" (sea): ["ved havet", "ved vandet"]
       - "søerne" (the lakes - specific): ["ved søerne"]
       - "søen" (a lake - generic): ["ved søen"]
     ```

3. **`brand-profile-generator-v5`**:
   - Receive language-specific location data
   - Use **Danish prompts** to generate Danish vocabulary
   - No translation step

**Pros**:
- Preserves cultural terminology perfectly
- No semantic drift
- Scalable to other languages

**Cons**:
- Requires maintaining prompts in multiple languages
- More complex prompt management

---

### Option B: Structured Metadata with Language Tags

**Approach**: Store location data as structured metadata with language tags, never as free text.

**Implementation**:
```json
"location_intelligence": {
  "language": "da",
  "location_types": [
    {
      "type": "waterfront",
      "subtype": "urban_stream",
      "local_term": "åen",
      "proper_noun": "Aarhus Å",
      "natural_references": ["ved åen", "langs åen", "ved Aarhus Å"]
    },
    {
      "type": "city_centre",
      "subtype": "pedestrian_street",
      "local_term": "gågaden",
      "proper_noun": "Åboulevarden",
      "natural_references": ["på Åboulevarden", "i hjertet af Aarhus"]
    }
  ]
}
```

**Pros**:
- Language-agnostic data structure
- Clear taxonomy
- Easy to validate

**Cons**:
- Requires more structured schema
- Complex to populate from free-text website analysis

---

### Option C: Hybrid Approach (MOST PRAGMATIC) — **RECOMMENDED BASED ON REAL EXAMPLES**

**Approach**: Combine both strategies + **capture actual local terminology from business websites**.

**Why this is the best approach**: Real-world testing shows businesses already use correct local terms on their websites!
- Café Faust homepage: "ved åen i Aarhus" ✅
- Havnær subpage: "udsigt ud over Aarhus Bugten" ✅  
- **Solution**: Extract and preserve these terms, don't generate from categories

**Flow**:
1. **`analyze-website`** (language-specific prompts + **subpage analysis**):
   - Use Danish prompts for Danish sites
   - **Analyze homepage + relevant subpages** (About, Contact, Location pages - Havnær example shows key location info on subpages!)
   - Extract verbatim location mentions from actual websites:
     - Café Faust homepage: "ved åen i Aarhus" → extract "ved åen"
     - Havnær subpage: "udsigt ud over Aarhus Bugten" → extract "Aarhus Bugten", "bugten"
     - Havnær subpage: "placering ved vandet" → extract "ved vandet" (business's choice)
   - **Capture local water body names**: "åen", "bugten", "søerne" (what business actually says)
   - Store as: `location_mentions: ["ved åen i Aarhus", "Aarhus Ø", "udsigt ud over Aarhus Bugten", "ved vandet"]`
   - **No translation layer** - preserve exact Danish

2. **`populate-location-intelligence`** (structured + language-aware):
   - Receive `location_mentions` in original language
   - Use **Danish taxonomy** to classify TYPE (for context)
   - BUT: **Preserve original local terms** (don't replace with category defaults)
   - Output structured metadata WITH original terms preserved
   - Include proper nouns: "Aarhus Å" not "the river", "bugten" not "fjorden"

3. **`brand-profile-generator-v5`** (vocabulary from metadata):
   - Read structured location data
   - Use **actual local terms from metadata**, not category mappings
   - Add positioning-aware filtering (casual vs. premium)
   - Never override local terminology with "correct" alternatives

**Example for Café Faust** (based on ACTUAL website content):
```json
"location_intelligence": {
  "language": "da",
  "extracted_from_website": {
    "location_mentions": ["ved åen i Aarhus"],  // ← Homepage: "lækker mad og oplevelser ved åen i Aarhus"
    "source_pages": ["homepage"]
  },
  "primary_location": {
    "type": "waterfront",  // ← CATEGORY (for logic)
    "subtype": "urban_stream",  // ← CATEGORY (for logic)
    "water_body": "Aarhus Å",  // ← INFERRED (could also extract from context)
    "local_term": "åen",  // ← EXTRACTED FROM WEBSITE (use in content!)
    "vocabulary_set": {
      "proximity": ["ved åen", "ved åen i Aarhus"],  // ← FROM website extraction
      "view": ["udsigt til åen"],  // ← Enhancement (paid tier)
      "outdoor": ["udeservering ved åen"]  // ← Enhancement (paid tier)
    },
    "avoid_terms": ["ved vandet", "floden", "udsigten"]  // WRONG for urban stream
  },
  "secondary_location": {
    "type": "city_centre",
    "street": "Åboulevarden",
    "vocabulary_set": {
      "proximity": ["på Åboulevarden", "i hjertet af Aarhus"],
      "neighborhood": ["ved åen i Aarhus"]
    }
  }
}
```

**Example for Restaurant Havnær** (based on ACTUAL website content):
```json
"location_intelligence": {
  "language": "da",
  "extracted_from_website": {
    "location_mentions": [
      "på kanten af Aarhus Ø",  // Homepage
      "udsigt ud over Aarhus Bugten",  // Subpage /naer.htm ✅
      "placering ved vandet"  // Subpage ✅
    ],
    "source_pages": ["homepage", "naer.htm"]  // ← Subpage analysis critical!
  },
  "primary_location": {
    "type": "waterfront",  // ← CATEGORY
    "subtype": "bay",  // ← CATEGORY
    "water_body": "Aarhus Bugt",  // ← FROM WEBSITE
    "local_term": "bugten",  // ← EXTRACTED FROM "Aarhus Bugten"
    "vocabulary_set": {
      "proximity": ["ved bugten", "på Aarhus Ø"],  // ← From website
      "view": ["udsigt ud over Aarhus Bugten", "udsigt over bugten"],  // ← From website
      "outdoor": ["udeservering ved bugten"],  // ← Enhancement (paid tier)
      "generic": ["ved vandet"]  // ← Business uses this, appropriate for bay
    },
    "avoid_terms": ["fjorden", "havet", "åen"],  // Wrong for this location
    "filter_awkward": ["på kanten"]  // Grammatical but not ideal for reuse
  },
  "neighborhood": {
    "name": "Aarhus Ø",  // ← FROM WEBSITE (preserve exactly)
    "vocabulary_set": {
      "proximity": ["på Aarhus Ø", "ved Aarhus Ø"]
    }
  }
}
```

**Critical success factors**: 
1. The `local_term` and initial `vocabulary_set` must be **extracted from business website** (verified with real examples: Café Faust, Havnær)
2. **Subpage analysis is essential** - key location information often on About/Contact/Location pages, not homepage
3. **Preserve exact Danish phrasing** - no translation to English at any step
4. **Paid tier enhances, doesn't replace** - add marketing angles while respecting business's original terms

---

### Recommended Next Steps for Solution Design

1. **Audit current prompt languages**:
   - Check if `analyze-website` uses English prompts
   - Check if `populate-location-intelligence` uses English prompts
   - Check if `brand-profile-generator-v5` uses English prompts

2. **Document current data flow**:
   - Where is location data stored? (business table? separate table?)
   - What format? (free text? structured JSON?)
   - What language?
   - **Are local terms preserved or lost?**

3. **Design local terminology extraction**:
   - How to extract "åen", "bugten", "søerne" from sources?
   - Sources: website text, Google Maps data, business owner input?
   - How to validate extracted terms are actually used locally?

4. **Create Danish location taxonomy**:
   - Water bodies: åen, floden, fjorden, havet, søerne, søen, bugten, havnen
   - For each: appropriate vocabulary sets by positioning level
   - Include "avoid" lists for each type
   - **Emphasize**: Taxonomy is REFERENCE, not replacement for local terms

5. **Design migration strategy**:
   - How to fix existing incorrect data?
   - Can we re-run location intelligence with new prompts?
   - Or manual SQL fixes for known issues?
   - How to capture local terms for existing businesses?

---

## What Needs Review Across All Three Functions

### A. `analyze-website` — Initial Capture

**Questions to investigate**:
- [ ] What language are the prompts written in?
- [ ] Does it preserve original location terminology from website?
- [ ] How does it identify and store location markers?
- [ ] Is location data stored in Danish or English?

### B. `populate-location-intelligence` — Location Classification

**Questions to investigate**:
- [ ] What language are the prompts written in?
- [ ] How does it categorize "waterfront" subtypes?
- [ ] Does it distinguish water body types (å vs flod vs sø vs hav)?
- [ ] Is location terminology preserved in original language?
- [ ] What schema does it populate? (business table? separate location_intelligence table?)

### C. `brand-profile-generator-v5` — Vocabulary Generation

**Questions to investigate**:
- [ ] Does it distinguish water body types?
- [ ] Does it map water types to culturally-appropriate vocabulary?
- [ ] Does it validate vocabulary against location subtypes?
- [ ] Where does it source location data from?
- [ ] Are prompts in the business's language or English?

**Search locations**:
- Schema: `business_brand_profile.brand_profile_v5.voice.tone_dna.location_driver`

### B. Natural Vocabulary Selection

**Questions to investigate**:
- [ ] Is there a taxonomy of location → vocabulary mappings?
- [ ] Are there country/language-specific vocabulary rules?
- [ ] Is there validation against cultural norms?
- [ ] How is `natural_vocabulary` array populated?

### C. Demographic Segment Logic

**Questions to investigate**:
- [ ] Does it check price/formality/positioning before assigning segments?
- [ ] Does it distinguish between "demographic present in area" vs "target demographic"?
- [ ] Are there exclusion rules (e.g., fine-dining excludes students)?

**Schema location**: `tone_dna.market_context.demographic_implications`

---

## Action Items

### Phase 1: Investigation (CURRENT)
**PRIORITY FOCUS**: Strengthen `analyze-website` location extraction

**✅ COMPLETED** — Found all edge function implementations:
- ✅ `analyze-website`: `/supabase/functions/analyze-website/index.ts`
- ✅ `populate-location-intelligence`: `/supabase/functions/populate-location-intelligence/index.ts`
- ✅ `brand-profile-generator-v5`: `/supabase/functions/brand-profile-generator-v5/index.ts`
- ✅ Tone DNA generator: `/supabase/functions/_shared/brand-profile/tone-dna-generator.ts`
- ✅ Basic info extractor: `/supabase/functions/_shared/ai-extractors/basic-info-extractor.ts`

**✅ CRITICAL DISCOVERIES**:

1. **`localLocationReference` field EXISTS and works correctly!**
   - Extracted by `basic-info-extractor.ts` with language-specific prompts ✅
   - Saved to `businesses.local_location_reference` ✅
   - Enforced as FIRST entry in `natural_vocabulary` by tone-dna-generator ✅
   - Explicit protection against generic replacements ✅

2. **Language-aware prompts ARE implemented**:
   - HTML `lang` attribute detected: `htmlLang` ✅
   - Language-specific system prompts exist for: Danish, Norwegian, Swedish, German, English ✅
   - Danish prompt: "Du er en virksomhedsinformationsekstraktor" ✅
   - NO TRANSLATION LAYER in extraction ✅

3. **Extraction prompt asks for `localLocationReference`**:
   ```typescript
   "Extract EXACT local place name phrase if business describes its location
   (e.g., 'ved åen', 'i Nyhavn', 'ved stranden'). 
   ONLY extract if explicitly mentioned. Return null if not found.
   Look for patterns: 'ved [landmark]', 'i [area]', 'på [street/area]', 'beliggende [where]'."
   ```

4. **Protection against generic terms**:
   - Tone DNA prompt warns: "Aldrig erstattes af generiske alternativer ('ved vandet', 'havnefronten', 'waterfront', 'åen' alene osv.)"
   - Specifically mentions avoiding river→sea confusion: "Ikke parres med havbeskrivelser (bølger, hav, maritim) — det er en å, ikke et hav/fjord/strand"

5. **`populate-location-intelligence` uses Danish prompts**:
   - Claude analyzer has Danish instructions ✅
   - Explicitly says: "✅ 'Ved Åen' ELLER 'Langs Åen' (ALDRIG 'vestlige/østlige bred')"
   - Asks for `local_terminology` list ✅

**⚠️ REMAINING QUESTIONS**:
- [ ] Why does Café Faust still have "ved vandet" and "udsigten" in vocabulary?
- [ ] Is `localLocationReference` actually being extracted from cafefaust.dk?
- [ ] Is there a gap between website extraction and tone DNA generation?
- [ ] Does `populate-location-intelligence` add these problematic terms?
- [ ] When was Café Faust's brand profile last generated?

### Phase 2: Design Solution
- [ ] Choose solution architecture (Option A/B/C or hybrid)
- [ ] Design Danish location taxonomy (see draft below)
- [ ] Create water body classification system for Danish
- [ ] Define positioning-vocabulary validation rules
- [ ] Design demographic segment eligibility filters
- [ ] Review with stakeholder

### Phase 3: Implementation — Upstream Functions
**PRIMARY FOCUS**: Strengthen `analyze-website` extraction capabilities

- [ ] **`analyze-website`**: Enhance location extraction (PRIORITY)
  - [ ] Enable subpage analysis (About, Contact, Location pages)
  - [ ] Use Danish prompts for Danish websites
  - [ ] Extract location markers verbatim: "ved åen", "Aarhus Ø", "Aarhus Bugten"
  - [ ] Capture view mentions: "udsigt over [water body]"
  - [ ] Store in original language (no translation)
  - [ ] Filter useful phrases from awkward ones
  
- [ ] **`populate-location-intelligence`**: Enhancement layer
  - [ ] Receive local terms from analyze-website
  - [ ] Add Danish water body taxonomy (for categorization only)
  - [ ] Suggest additional vocabulary while preserving original terms
  - [ ] Never override business's local terminology
  
- [ ] Update location data schema if needed
- [ ] Add vocabulary validation logic
- [ ] Implement demographic segment filters

### Phase 4: Implementation — Brand Profile Generator
- [ ] **`brand-profile-generator-v5`**: Source location vocabulary from upstream metadata
- [ ] Add positioning-vocabulary alignment checks
- [ ] Remove generic "waterfront" → vocabulary mapping
- [ ] Use language-specific vocabulary sets

### Phase 5: Data Cleanup
- [ ] Identify all businesses with incorrect vocabulary
- [ ] Create SQL fixes similar to `_APPLY_BRAND_PROFILE_FIXES.sql`
- [ ] Test on Café Faust first
- [ ] Apply to all affected businesses

### Phase 6: Testing & Validation
- [ ] Regenerate Café Faust brand profile end-to-end
- [ ] Verify no translation contamination
- [ ] Verify vocabulary is culturally appropriate
- [ ] Check other water-adjacent businesses
- [ ] Validate tourist/student segment logic

---

## Immediate Next Steps

### Simplified Solution (Based on Real Examples)

**The good news**: Businesses already use correct local terminology on their websites!
- Café Faust says "ved åen" ✅
- Havnær says "Aarhus Bugten" ✅
- We just need to **extract and preserve** these terms

**Primary task**: Strengthen `analyze-website` to:
1. Analyze subpages (not just homepage) 
2. Extract location mentions verbatim
3. Preserve in original language
4. Pass to downstream functions without translation

**Secondary task**: Ensure downstream functions respect these terms:
- `populate-location-intelligence`: Add marketing angles, don't replace terms
- `brand-profile-generator-v5`: Use provided terms, don't generate generic ones

---

### Action Steps

1. **Strengthen `analyze-website` location extraction** (PRIORITY)
   - Enable subpage analysis (not just homepage)
   - Extract location markers verbatim ("ved åen", "Aarhus Ø", "Aarhus Bugten")
   - Capture view mentions ("udsigt over bugten")
   - Store in Danish with no translation layer
   
2. **Audit prompt languages** in all 3 edge functions
   - Identify where English prompts process Danish content
   - Find the translation contamination point
   
3. **Search codebase** for edge function implementations

4. **Document current location data flow** and schema

5. **Propose specific solution architecture** for stakeholder review

---

## Free vs Paid Tier Roles

### Free Tier (`analyze-website`)
**Role**: Extract and preserve business's authentic voice
- ✅ Capture what business says about location
- ✅ Preserve local terminology exactly ("ved åen", "bugten")
- ✅ Extract from homepage + relevant subpages
- ❌ Don't translate or categorize
- ❌ Don't enhance or add marketing angles

**Output**: Raw location mentions in original language

### Paid Tier (`populate-location-intelligence` + `brand-profile-generator-v5`)
**Role**: Marketing manager that elevates communication
- ✅ Receive local terms from analyze-website
- ✅ Add marketing angles business hasn't thought of
- ✅ Suggest additional vocabulary while preserving local terms
- ✅ Validate which terms are appropriate for positioning
- ❌ Never override business's local terminology with generic alternatives
- ❌ Never translate local terms to English and back

**Output**: Enhanced location strategy with preserved authentic local terms

**Example**:
```
Free tier extracts: "ved åen"
Paid tier adds: "udsigt til åen", "udeservering ved åen", "solnedgang over åen"
Paid tier preserves: "ved åen" (never changes to "ved vandet" or "ved floden")
```

---

## Danish Location Taxonomy (DRAFT)

### **CORE PRINCIPLE: Capture Exact Local Terminology**

**The fundamental requirement**: We must capture and preserve **the exact words locals use** to describe their location, not impose categorization-based vocabulary.

**Why this matters**:
- Locals say "ved åen" in Aarhus → we must use "ved åen" (NOT "ved floden", NOT "ved vandet")
- Locals say "bugten" in Aarhus Ø → we must use "bugten" (NOT "fjorden", NOT generic "vandet")
- Locals say "søerne" in Copenhagen → we must use "søerne" (NOT correct it to "søen")

**Implementation challenge**: 
- Can't rely on categorization alone ("waterfront" → vocabulary)
- Must **extract actual local terms** from source (website, Google Maps, local knowledge)
- Must preserve these terms verbatim through entire pipeline
- Translation/categorization in English = guaranteed failure

**Example - Aarhus Ø restaurant**:
```
Location marker: "Aarhus Ø" (neighborhood name)
Water body: "bugten" (what locals call it)
✅ Correct: "udsigt over bugten", "ved Aarhus Ø"
❌ Wrong: "udsigt over fjorden", "ved vandet" (too generic)
```

---

### Water Body Classification for Danish

**Note**: These are REFERENCE CATEGORIES to help understand Danish water terminology. The actual vocabulary must come from **local usage**, not category mapping.

#### Urban Streams ("Å")
**Examples**: Aarhus Å, Odense Å  
**Never use**: "floden", "ved vandet"

**Vocabulary by positioning**:
- **Casual/Value**: "ved åen", "langs åen"
- **Mid-range**: "ved åen", "ved [Proper Noun] Å"
- **Premium**: Would rarely use stream location as USP

**Context markers**:
- Urban, intimate, local
- Street-level proximity, not panoramic views
- Avoid: "udsigten" (too grand)
- OK: "udsigt til åen" (modest, specific)

---

#### Major Rivers ("Flod")
**Examples**: International rivers (Rhinen, Seinen, Donau)  
**Danish context**: Rare in Denmark, formal tone

**Vocabulary**:
- "ved floden [Name]"
- "langs floden"

**Never use for**: Danish urban streams (å)

---

#### Sea/Coastal ("Havet", "Fjorden", "Bugten")
**Examples**: Øresund, Limfjorden, Aarhus Bugt

**The critical principle**: Use the **specific local term** for the water body, not generic alternatives

**Vocabulary by water type**:
- **Fjord**: "ved fjorden", "ved [Fjord Name]", "ved vandet" ✅
- **Sea**: "ved havet", "ved vandet" ✅
- **Bay**: "ved bugten", "ved [Bay Name]", "ved vandet" ✅

**When "ved vandet" is appropriate**:
- Large water bodies (sea, fjord, bay)
- Swimming, boating, horizon views
- Coastal positioning
- **BUT**: If locals use a specific term ("bugten", "fjorden"), prefer that over generic "vandet"

**Real example - Aarhus Ø**:
- **Location marker**: "Aarhus Ø" (neighborhood name, preserve exactly)
- **Water body**: "Bugten" (NOT "fjorden" or generic "vandet" — locals say "bugten")
- **If water views exist**: "udsigt over bugten" ✅ | "over vandet" ⚠️ (less specific)
- **Critical**: Capture what locals actually call the water body

---

#### Harbor ("Havnen")
**Examples**: Nyhavn (Copenhagen), Aarhus Havn

**Vocabulary**:
- **Specific**: "i Nyhavn", "ved Nyhavn" (proper noun)
- **Generic**: "i havnen", "ved havnen", "ved kajen"

**Never translate**: "Nyhavn" → "the new harbor" (lose cultural reference)

---

#### Lakes ("Søerne" vs "Søen")
**The critical principle**: Use what **locals actually say**, not grammatical rules

**Examples**:
- **Multiple lakes (Copenhagen)**: "Søerne" (THE lakes, cultural landmark)
- **Single lake**: "Søen" (if that's the local term)
- **Specific named lake**: "ved [Lake Name]"

**Vocabulary**:
- **If locals say "søerne"**: "ved søerne" (preserve local usage)
- **If locals say "søen"**: "ved søen" (preserve local usage)
- **Never impose**: Don't "correct" local terminology to match grammar

**Critical distinction**: This is about **local usage**, not just plurality or proper nouns. Capture what locals actually say.

---

#### City Center Location Vocabulary

**Generic terms** (work for any city center):
- "i hjertet af [City]"
- "i centrum"
- "i byen"

**Specific landmarks** (preserve proper nouns):
- "på Åboulevarden" (NOT "on the boulevard")
- "på Strøget" (NOT "on the walking street")
- "ved Rådhuspladsen" (NOT "at the town hall square")

---

### Positioning-Level Vocabulary Filters

#### Casual/Value Positioning
**Use**: Simple, direct proximity terms
- ✅ "ved åen", "i hjertet af Aarhus"
- ❌ "udsigten", "panoramaudsigt", "beliggenhed"

#### Mid-Range Positioning  
**Use**: Specific location references
- ✅ "ved Aarhus Å", "på Åboulevarden"
- ⚠️ "udsigt til åen" (OK if true)
- ❌ "eksklusiv beliggenhed"

#### Premium/Fine-Dining
**Use**: Sophisticated location language
- ✅ "beliggende ved [Landmark]"
- ✅ "med udsigt over [Feature]"
- ❌ Casual terms like "tag en pause"

---

## Immediate Next Steps

1. **Search codebase** for `brand-profile-generator-v5` implementation
2. **Locate** where `natural_vocabulary` is populated
3. **Document** current logic in this file
4. **Propose** taxonomy structure for review

---

## Reference Data

### Café Faust Context
- **Business ID**: `36e24a84-c32d-4123-910a-1bb2e64d34af`
- **Website**: `cafefaust.dk`
- **Location**: Åboulevarden, Aarhus (urban river)
- **Water body**: Aarhus Å (river, not sea)
- **How they describe it**: "ved åen i Aarhus" ✅
- **Price positioning**: value/mid-range
- **Formality**: casual
- **Segments**: Students ✅, Urban professionals ✅

### Restaurant Havnær Context (Real-World Example)
- **Website**: `havnaer.dk`
- **Location**: Aarhus Ø (waterfront neighborhood)
- **Water body**: Aarhus Bugten (bay, not fjord)
- **How they describe it**:
  - Homepage: "på kanten af Aarhus Ø"
  - Subpage: "udsigt ud over Aarhus Bugten" ✅
  - Subpage: "placering ved vandet" ✅ (appropriate for bay)
- **Local terms extracted**: "Aarhus Ø", "Aarhus Bugten", "bugten", "ved vandet"
- **Note**: "Ved vandet" IS appropriate here (large water body), unlike for "åen"

### Current Problematic Vocabulary (Café Faust)
```json
"location_driver": {
  "score": 95,
  "primary_dimension": "waterfront",
  "natural_vocabulary": [
    "ved åen", ✅
    "på Åboulevarden", ✅
    "i hjertet af Aarhus", ✅
    "ved vandet", ❌ WRONG FOR RIVER
    "udsigt", ❌ TOO GRAND
    "udeservering" ✅
  ],
  "avoid_vocabulary": ["indendørs", "urban"]
}
```

**What should have been generated** (based on website analysis):
```json
"natural_vocabulary": [
  "ved åen", ✅ (from website)
  "ved åen i Aarhus", ✅ (from website)
  "på Åboulevarden", ✅ (from location)
  "i hjertet af Aarhus", ✅ (contextual)
  "udeservering ved åen" ✅ (if outdoor seating exists)
],
"avoid_vocabulary": [
  "ved vandet", ❌ (wrong for urban river)
  "ved floden", ❌ (wrong for å)
  "udsigten", ❌ (too grand for street-level casual)
]
```

---

## Related Files
- `_APPLY_BRAND_PROFILE_FIXES.sql` — Existing manual fixes for Café Faust
- Edge function: `https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator-v5`
- Schema: `business_brand_profile.brand_profile_v5`

---

## Notes & Observations

### 2026-06-22 Initial Analysis
- Issue discovered during brand profile review for Café Faust
- Affects content authenticity and cultural appropriateness
- Similar issues likely exist for other waterfront businesses
- Need systematic fix, not just manual corrections

### 2026-06-22 Translation Contamination Discovery
**CRITICAL INSIGHT**: The root cause is likely **English prompts processing Danish content**, causing:
- "Åen" → (translated to English: "river") → (back to Danish: "floden")
- This is semantically catastrophic: "åen" ≠ "floden" in Danish
- "Åen" = small urban stream (intimate, local, specific)
- "Floden" = major river (large, formal, generic)

**Two potential source points identified**:
1. **`analyze-website`** (Free tier): Web scraping, currently not strong at detecting location markers
2. **`populate-location-intelligence`** (Paid tier): Structured location type assessment

**Solution requirement**: All prompts must be in the business's native language, with no English intermediate steps. Location terminology must be captured and stored in original language.

**Architecture needed**:
- Language-aware prompts OR
- Structured metadata with language tags OR
- Hybrid approach (most pragmatic)

**Danish taxonomy required**: Water bodies (åen, floden, fjorden, havet, søerne, havnen) each need specific vocabulary sets by positioning level.

### 2026-06-22 Local Terminology Principle
**CRITICAL INSIGHT**: Cannot rely on categorization → vocabulary mapping. Must **capture exact local terms**.

**Examples that matter**:
- "Søerne" vs "søen": Not about grammar (plural vs singular), about **what locals say**
- Aarhus water: Locals say "åen" (NOT "floden"), say "bugten" in Aarhus Ø (NOT "fjorden")
- Can't impose "correct" terms: If locals say "søerne" for their lakes, that's what we use

**Implementation requirement**:
1. **Extract** actual local terminology from sources (website, reviews, local context)
2. **Preserve** these exact terms through entire pipeline (no translation, no "correction")
3. **Use** local terms in content, not category-based generic alternatives

**This makes the problem harder**: Can't just map "waterfront" → ["ved vandet", "udsigten"]. Must capture "what do locals call THIS specific waterfront?" and use those specific terms.

### 2026-06-22 Website as Source of Truth
**BREAKTHROUGH INSIGHT**: Businesses already use the correct local terminology on their websites!

**Real examples extracted**:
- **Café Faust**: "ved åen i Aarhus" (homepage)
- **Restaurant Havnær**: 
  - "Aarhus Ø" (homepage)
  - "udsigt ud over Aarhus Bugten" (subpage)
  - "placering ved vandet" (subpage - appropriate for bay)

**Key findings**:
1. ✅ Businesses know what locals say
2. ✅ They use authentic, culturally appropriate terms
3. ⚠️ Location info often on subpages, not just homepage
4. ⚠️ Some phrasings awkward ("på kanten") - need filtering
5. ✅ Best source of truth for local terminology

**Solution simplified**:
- **Primary task**: Strengthen `analyze-website` to extract these mentions
- **Preservation**: Store verbatim, no translation layer
- **Enhancement** (paid tier): Add marketing angles while preserving original terms
- **Don't need**: Complex external location databases or manual entry (for most cases)

**This changes the architecture**:
- Focus on **extraction** from website, not **generation** from categories
- Subpage analysis critical (many businesses detail location on About/Contact pages)
- Language-specific prompts essential (must understand Danish to extract correctly)
- Validation needed: Filter useful phrases ("ved åen") from awkward ones ("på kanten")

---

## Questions Pending Answer

### Critical Architecture Questions
1. **What language are prompts written in** for each function?
   - `analyze-website`: English or language-aware?
   - `populate-location-intelligence`: English or language-aware?
   - `brand-profile-generator-v5`: English or language-aware?

2. **Where does translation contamination occur?**
   - Is "åen" → "river" → "floden" happening?
   - At what step in the pipeline?

3. **Where is location data stored?**
   - business table? 
   - location_intelligence table?
   - Embedded in brand_profile_v5?

4. **What format is location data stored in?**
   - Free text (language-dependent)?
   - Structured JSON?
   - English keywords that get translated?

### Taxonomy Questions
5. Does location intelligence distinguish water body types or just "waterfront"?
6. Are proper nouns preserved (e.g., "Aarhus Å", "Nyhavn")?
7. Is there a vocabulary validation system anywhere in the pipeline?
8. **Does `analyze-website` extract location mentions from subpages?** (Critical - Havnær example shows key info on subpages)
9. **Does `analyze-website` capture location mentions verbatim or translate/categorize them?**
10. **What filtering exists for awkward phrasings?** (e.g., "på kanten" is grammatical but not ideal for reuse)

### Scope Questions
10. How many businesses are affected by incorrect water vocabulary?
11. Are there similar issues in other languages (Norwegian, Swedish)?
12. Should `natural_vocabulary` be editable post-generation or fully automated?
13. Should businesses be able to manually specify their local location terms?

### Demographic Logic Questions
14. How are segments like "students" and "tourists" currently assigned?
15. Is there price/formality filtering before segment assignment?
16. Are segments stored separately from demographic context data?

---

**Status Key**:
- 🔴 In Analysis
- 🟡 In Progress
- 🟢 Completed
- ⚪ Blocked
