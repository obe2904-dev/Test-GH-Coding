# Implementation Plan: Refactor to Use OLD AI Extractors

## Problem Statement
Current two-step system (scraper → extract-from-scrape) has issues:
1. Text repetition not handled properly
2. Menu extraction empty/broken
3. Address extraction picking up artifacts ("S" prefix)
4. Business description not extracted correctly
5. Local location reference ("ved åen") lost

## Root Cause
We built NEW extraction logic instead of reusing the PROVEN OLD extractors from `analyze-website`.

## Solution Architecture

### High-Level Flow
```
User clicks "Analysér hjemmeside"
  ↓
analyze-and-distribute-website (orchestrator)
  ↓
Cloud Run Scraper → JSON payload
  {
    content_sections: [...],
    contact: {...},
    services: {...},
    opening_hours: {...}
  }
  ↓
extract-from-scrape (NEW APPROACH)
  ├─ buildLabeledContent() → Convert JSON to labeled text
  ├─ Tier 1: Direct mapping (hours, URLs, contact fields)
  └─ AI Extractors (parallel, like OLD system):
      ├─ extractBasicInfo → name, type, description, localLocationReference
      ├─ extractContact → phone, email, address (AI fallback)
      ├─ extractMenuSignal → dishes (signatureItems)
      ├─ extractKeywords → services
      ├─ extractVenueHooks → what makes it special
      └─ extractExperiencePillars → vibe/atmosphere
  ↓
Merge & Save to Database
```

### Key Design Decisions

#### 1. Content Transformation
**Function:** `buildLabeledContent(scraperPayload)`

**Input:** Scraper JSON
```json
{
  "content_sections": [
    { "heading": "Velkommen til Café Faust", "text": "..." },
    { "heading": "Kontakt", "text": "..." }
  ]
}
```

**Output:** Labeled text (like OLD system)
```
=== Velkommen til Café Faust ===
Velkommen til Café Faust lækker mad og oplevelser ved åen i Aarhus...

=== Kontakt ===
Café Faust A/S
Åboulevarden 38
8000 Aarhus C
Tlf.: 86 19 07 06
```

#### 2. What to Keep from Current System

**KEEP (works well):**
- Opening hours parsing from `extraction.opening_hours.candidates`
- Service URL mapping: `extraction.services.booking.url`, `menu.url`
- Direct contact fields: `extraction.contact.phones[0]`, `emails[0]`, `addresses[0]`
- Database save functions

**REMOVE (not working):**
- Custom `extractTier3()` with big Gemini prompt
- Custom `extractMenuOfferings()` function
- Manual field extraction logic

#### 3. AI Extractor Integration

**Extractors to Use (from `_shared/ai-extractors/`):**

1. **extractBasicInfo**
   - Input: content (string), metadata, logoUrl, hints
   - Returns: `{ businessName, businessType, description, localLocationReference }`
   - KEY: Has `localLocationReference` for "ved åen" extraction!

2. **extractContact**
   - Input: content (string), structuredData[], apiKey, languageHint
   - Returns: `{ phone, email, address: {street, city, postalCode, country} }`
   - Use as fallback if scraper.contact is empty

3. **extractMenuSignal**
   - Input: content (string), context: {businessName, businessType, languageHint}
   - Returns: `{ hasMenu, menuDescription, signatureItems[], programmes[] }`
   - KEY: `signatureItems` is the dish list!

4. **extractKeywords**
   - Input: content, businessName, businessType, apiKey, languageHint
   - Returns: `{ keywords: string[] }`

5. **extractVenueHooks**
   - Input: content, apiKey, context
   - Returns: `{ venueHooks: string[] }`

6. **extractExperiencePillars**
   - Input: content, apiKey, context
   - Returns: `{ experiencePillars: {category, items}[] }`

**Parallel Execution:**
```typescript
const [basicInfo, contactInfo, menuSignal, keywords, venueHooks, pillars] = 
  await Promise.all([
    extractBasicInfo(labeledContent, ...),
    extractContact(labeledContent, ...),
    extractMenuSignal(labeledContent, ...),
    extractKeywords(labeledContent, ...),
    extractVenueHooks(labeledContent, ...),
    extractExperiencePillars(labeledContent, ...)
  ])
```

#### 4. Data Merging Strategy

**Priority:**
1. **Tier 1** (Scraper direct fields) - highest confidence
2. **AI Extractors** (OLD proven extractors) - medium confidence
3. **Fallback** - null

**Example - Phone Number:**
```typescript
const phone = 
  tier1.phone?.value ||           // From scraper.contact.phones[0]
  contactInfo.phone ||             // From AI extractor fallback
  null
```

**Example - Business Description:**
```typescript
const user_about_text = 
  basicInfo.description ||         // From AI extractor (always use this!)
  tier1.long_description?.value || // Fallback to scraper
  null
```

**Example - Key Offerings (Dishes):**
```typescript
const key_offerings = 
  menuSignal.signatureItems?.join('\n') ||  // From AI extractor!
  null
```

**Example - Local Location Reference:**
```typescript
const local_location_reference = 
  basicInfo.localLocationReference ||  // From AI extractor (ONLY source!)
  null
```

### Implementation Steps

#### Step 1: Create Content Builder Function
```typescript
function buildLabeledContent(scraperPayload: any): string {
  const sections: string[] = []
  
  // Add each content section with label
  for (const section of scraperPayload.content_sections || []) {
    const heading = section.heading || 'Section'
    const text = section.text || ''
    
    if (text.length >= 50) {
      sections.push(`=== ${heading} ===\n${text}`)
    }
  }
  
  return sections.join('\n\n')
}
```

#### Step 2: Copy/Import AI Extractors
Options:
- **A)** Import from `_shared/ai-extractors/` (if Deno imports work)
- **B)** Copy extractor code inline (more reliable for Deno edge functions)

Decision: Try A first, fallback to B if imports fail.

#### Step 3: Refactor Main Extraction Flow
```typescript
// Stage 1: Direct mapping from scraper (Tier 1)
const tier1 = extractTier1(extraction)  // Keep this! (hours, URLs)

// Stage 2: Build labeled content for AI
const labeledContent = buildLabeledContent(extraction)
const metadata = { title: extraction.business?.name?.value }
const languageHint = extraction.meta?.detected_language

// Stage 3: Run AI extractors in parallel
const [basicInfo, contactAI, menuSignal, keywords, hooks, pillars] = 
  await Promise.all([...])

// Stage 4: Merge with priority (Tier 1 > AI > null)
const businessProfile = buildBusinessProfile(tier1, basicInfo, menuSignal)
const businessLocations = buildBusinessLocations(tier1, contactAI)
```

#### Step 4: Update Database Save Functions
Ensure these fields are saved:
- `business_profile.user_about_text` ← `basicInfo.description`
- `business_profile.key_offerings` ← `menuSignal.signatureItems.join('\n')`
- `businesses.local_location_reference` ← `basicInfo.localLocationReference`
- `business_locations.address_line1` ← `tier1 OR contactAI.address.street`

### Testing Strategy

1. **Unit Test:** Content builder
   - Input: Sample scraper JSON
   - Expected: Properly labeled text

2. **Integration Test:** Single extractor
   - Input: Labeled content
   - Expected: Valid extraction result

3. **End-to-End Test:** Full pipeline
   - Trigger: POST to analyze-and-distribute-website
   - URL: https://cafefaust.dk
   - Verify in database:
     - ✅ `user_about_text` has clean description (not menu HTML)
     - ✅ `key_offerings` has 5-7 dish names
     - ✅ `local_location_reference` = "ved åen"
     - ✅ `address_line1` = "Åboulevarden 38" (no "S")

### Rollout Plan

1. **Create new version:** `extract-from-scrape-v2` (test in isolation)
2. **Test thoroughly:** All test cases pass
3. **Switch orchestrator:** Update `analyze-and-distribute-website` to call v2
4. **Monitor:** Check logs for errors
5. **Deprecate old:** Once stable, remove old extraction logic

### Success Criteria

✅ All Café Faust fields populate correctly:
- Business name preserved (Souk → should stay Souk, not overwrite)
- Description clean (no HTML dump)
- Dishes extracted (5-7 names)
- Location reference extracted ("ved åen")
- Address clean (no "S" prefix)

✅ Code quality:
- Type safety
- Error handling
- Clear function separation
- Proper logging

✅ Performance:
- Parallel AI execution
- Similar cost to OLD system
- Complete in <30 seconds

## File Changes Required

1. **supabase/functions/extract-from-scrape/index.ts**
   - Add `buildLabeledContent()` function
   - Import/copy AI extractors
   - Refactor main extraction flow
   - Update merge logic

2. **supabase/functions/analyze-and-distribute-website/index.ts**
   - NO CHANGES (orchestrator stays same)

3. **cloud-run-scraper/index.js**
   - NO CHANGES (scraper output format is good)

## Risks & Mitigation

**Risk:** AI extractors don't work in Deno edge function environment
**Mitigation:** Copy code inline instead of importing

**Risk:** Gemini API key not available
**Mitigation:** Existing code already checks for this

**Risk:** Breaking existing functionality
**Mitigation:** Create v2, test thoroughly before switching

**Risk:** Cost increase from multiple AI calls
**Mitigation:** OLD system already does this, proven cost structure

## Timeline

1. **Phase 1:** Copy extractors, build content transformer (1-2 hours)
2. **Phase 2:** Refactor extraction logic (2-3 hours)
3. **Phase 3:** Testing and debugging (1-2 hours)
4. **Phase 4:** Deploy and verify (30 min)

**Total:** 4-7 hours

## Open Questions

1. ✅ Do we need ALL extractors or just critical ones?
   → Start with: basicInfo, contact, menuSignal (core functionality)
   → Add keywords, hooks, pillars later if needed

2. ✅ What about business name overwriting (Souk → Café Faust)?
   → Don't update business_name if it already exists
   → Only extract for NEW businesses

3. ✅ Should we keep any Tier 3 logic?
   → NO. Replace entirely with AI extractors.
