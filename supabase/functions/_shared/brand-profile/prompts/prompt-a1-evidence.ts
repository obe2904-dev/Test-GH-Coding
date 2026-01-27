/**
 * Prompt A1 - Evidence Extraction
 * 
 * ONLY extracts structured facts and evidence from data sources.
 * NO interpretation, NO usage occasions, NO tone inference.
 * Output: Small, stable JSON with only verifiable facts.
 * 
 * Design: Additive to existing buildPromptA (not a replacement yet)
 */

import type { DataSources, LanguageConfig } from '../types.ts'
import { extractStructuredWebsiteData } from '../signal-extractor.ts'
import { buildMenuTypeSummary, buildImagesSummary, buildSocialSummary } from '../data-gatherer.ts'
import { renderLocationPhrase } from './prompt-builder.ts'

/**
 * Quote with source attribution for traceability
 */
export interface Quote {
  quote: string    // Exact text extracted
  source: string   // Where it came from (e.g., "homepage_header", "menu_item", "image_label")
}

/**
 * Prompt A1 Evidence Output Schema
 * 
 * Fact-only JSON with exact phrases and quotes for traceability.
 * NO interpretation, NO usage occasions, NO tone inference.
 */
export type PromptA1Evidence = {
  business_id: string
  generated_at: string
  evidence_version: "1.0"
  facts: {
    location: {
      city: string
      address?: string
      canonical_location_hook?: string  // e.g. "ved åen i Aarhus"
      area_type?: string                // waterfront/transit_hub/shopping_street/tourist_area
      nearby_signals?: string[]         // From location enrichment
      confidence?: "high" | "medium" | "low"
      quotes: Quote[]                   // Location-related phrases from sources
    }
    menu: {
      meal_anchors: string[]            // e.g. ["brunch", "frokost", "middag", "aften"]
      items: Array<{                    // Max 12 items
        name: string
        description?: string
        price?: string
      }>
      categories: string[]              // Menu sections/categories
      quotes: Quote[]                   // Menu-related exact phrases
    }
    website: {
      ctas: string[]                    // Max 10 CTA button texts
      headers: string[]                 // Max 10 H1/H2/H3 texts
      hero_texts: string[]              // Max 6 above-fold texts
      about_snippets: string[]          // Max 6 about/description snippets
      value_phrases: string[]           // Key value propositions
      quotes: Quote[]                   // Website-related exact phrases
    }
    social: {
      bios: string[]                    // Social media bios/descriptions
      quotes: Quote[]                   // Social-related exact phrases
    }
    images: {
      summary: string[]                 // Max 10 AI vision labels
      quotes: Quote[]                   // Image-related phrases (AI labels)
    }
    third_party?: {
      google_business_description?: string
      review_recurring_terms?: string[]
      confidence_ceiling: "low"         // Always "low" for third-party
      quotes: Quote[]
    }
  }
}

// Legacy type alias for backwards compatibility
export type A1EvidenceOutput = PromptA1Evidence

/**
 * Build Prompt A1 - Evidence Extraction Only
 * 
 * This prompt extracts ONLY verifiable facts from data sources.
 * No interpretation or inference beyond basic categorization.
 */
export function buildPromptA1Evidence(
  dataSources: DataSources,
  language: LanguageConfig,
  allowThirdParty: boolean = false
): string {
  const { business, location } = dataSources

  // Build data summaries using existing functions
  const structuredWebsite = extractStructuredWebsiteData(dataSources)
  const menuSummary = buildMenuTypeSummary(dataSources.menu || [])
  const imagesSummary = buildImagesSummary(dataSources.images || [])
  const waterfrontHook = renderLocationPhrase('waterfront', language.code, location?.enrichment?.micro?.nearby_signals?.[0]) || 'ved åen i [city]'
  const waterfrontSample = waterfrontHook.replace('[city]', business?.city || 'Aarhus')

  return `${language.instructionsPromptA}

---

TASK: Extract ONLY verifiable facts from the provided business data. No interpretation.

OUTPUT FORMAT: Strict JSON matching PromptA1Evidence schema:

{
  "business_id": "${business?.id || 'unknown'}",
  "generated_at": "${new Date().toISOString()}",
  "evidence_version": "1.0",
  "facts": {
    "location": {
      "city": "string",
      "address": "string (optional)",
      "canonical_location_hook": "e.g. '${waterfrontSample}'",
      "area_type": "waterfront|transit_hub|shopping_street|tourist_area",
      "nearby_signals": ["signal1", "signal2"],
      "confidence": "high|medium|low",
      "quotes": [
        {"quote": "exact phrase from source", "source": "homepage_header|menu_description|image_label"}
      ]
    },
    "menu": {
      "meal_anchors": ["brunch", "frokost", "middag", "aften"],
      "items": [
        {"name": "Item Name", "description": "optional", "price": "95 kr"}
      ],
      "categories": ["Brunch", "Hovedretter", "Drikkevarer"],
      "quotes": [
        {"quote": "exact menu phrase", "source": "menu_item|menu_description"}
      ]
    },
    "website": {
      "ctas": ["BOOK BORD", "SE MENU", "KONTAKT OS"],
      "headers": ["H1/H2/H3 texts"],
      "hero_texts": ["Above-fold text"],
      "about_snippets": ["About/description excerpts"],
      "value_phrases": ["Key value propositions"],
      "quotes": [
        {"quote": "exact website phrase", "source": "hero_text|cta|header"}
      ]
    },
    "social": {
      "bios": ["Social media bio texts"],
      "quotes": [
        {"quote": "exact social phrase", "source": "facebook_bio|instagram_bio"}
      ]
    },
    "images": {
      "summary": ["AI vision labels"],
      "quotes": [
        {"quote": "detected label", "source": "image_ai_label"}
      ]
    }${allowThirdParty ? `,
    "third_party": {
      "google_business_description": "Google Business Profile text (optional)",
      "review_recurring_terms": ["terms appearing 3+ times in reviews"],
      "confidence_ceiling": "low",
      "quotes": [
        {"quote": "exact third-party phrase", "source": "google_business|review"}
      ]
    }` : ''}
  }
}

---

INPUT DATA:

Business Snapshot:
- Name: ${business?.name || 'Unknown'}
- Type: ${business?.vertical || 'Unknown'}
- Location: ${business?.city || 'Unknown'}${business?.address ? `, ${business.address}` : ''}
- Country: ${business?.country || 'Unknown'}

${location?.enrichment ? `Deterministic Location Context:
- City: ${location.enrichment.macro.city} (${location.enrichment.macro.city_tier})
- Area type: ${location.enrichment.micro.area_type}
- Nearby signals: ${location.enrichment.micro.nearby_signals.slice(0, 6).join(', ')}
` : ''}

Menu Data:
${menuSummary}

Images Summary:
${imagesSummary}

Website Data:
${JSON.stringify(structuredWebsite, null, 2)}

---

TIER-BASED EXTRACTION:

**TIER 1: Internal Data (Authoritative - Always Trust)**
- Business name, type, location from business snapshot
- Menu items, categories, prices from menu data
- Image AI labels from uploaded images
- Confidence: "high" for tier 1 data

**TIER 2: External Data (Supporting - Use Cautiously)**
- Website: headers, CTAs, hero texts, about snippets
- Social: bios, post excerpts
- Confidence: "medium" for tier 2 data

**TIER 3: Third-Party (Only if allowThirdParty=true)**
- Google Business Profile descriptions
- Review recurring terms (3+ mentions)
- Confidence: ALWAYS "low" for tier 3 data
- Include ONLY if allowThirdParty=true

---

FIELD EXTRACTION RULES:

**1. location (facts.location)**
- city: From business snapshot (deterministic)
- address: Full address if available
- canonical_location_hook: Combine area_type phrase + city
  * waterfront → "${waterfrontHook}"
  * transit_hub → "ved stationen i [city]"
  * shopping_street → "på gågaden i [city]"
  * tourist_area → "i [tourist_landmark] i [city]"
- area_type: From location enrichment (if available)
- nearby_signals: From location enrichment (max 6)
- confidence: "high" if enrichment available, else "medium"
- quotes: Location phrases from website/menu (with source attribution)

**2. menu (facts.menu)**
- meal_anchors: Lowercase meal categories ["brunch", "frokost", "middag", "aften", "dessert"]
- items: Top 12 menu items with name, optional description, optional price
- categories: Menu section names as shown (e.g., "Hovedretter", "Drikkevarer")
- quotes: Exact menu phrases (item names, descriptions) with source="menu_item" or "menu_description"

**3. website (facts.website)** - MAX ARRAY LIMITS
- ctas: Max 10 CTA button texts (exact text, e.g., "BOOK DIT BORD")
- headers: Max 10 H1/H2/H3 texts (exact text)
- hero_texts: Max 6 above-fold text blocks
- about_snippets: Max 6 about/description excerpts
- value_phrases: Key value propositions
- quotes: Exact website phrases with source attribution

**4. social (facts.social)**
- bios: Social media profile descriptions
- quotes: Exact phrases from social posts with source attribution

**5. images (facts.images)**
- summary: Max 10 AI vision labels (most relevant detected items)
- quotes: AI labels as quotes with source="image_ai_label"

**6. third_party (facts.third_party)** - ONLY IF allowThirdParty=true
- google_business_description: Google Business Profile text (if available)
- review_recurring_terms: Terms appearing 3+ times across reviews
- confidence_ceiling: ALWAYS "low"
- quotes: Third-party phrases with source attribution

---

QUOTE FORMAT:
Every quote must have:
- quote: Exact text extracted (verbatim, preserve casing)
- source: Where it came from (e.g., "homepage_header", "menu_item", "cta_button", "image_ai_label")

Examples:
{"quote": "Nyd brunch ved åen i Aarhus", "source": "hero_text"}
{"quote": "BOOK DIT BORD", "source": "cta_button"}
{"quote": "PARISERBØF MED BEARNAISE", "source": "menu_item"}
{"quote": "outdoor seating, waterfront view", "source": "image_ai_label"}

---

⚠️ CRITICAL RULES:
1. Extract ONLY what's explicitly present (no interpretation)
2. Respect array limits (ctas≤10, headers≤10, hero_texts≤6, about_snippets≤6, menu.items≤12, images.summary≤10)
3. Always include source attribution in quotes
4. Use lowercase for meal_anchors
5. Preserve exact casing for quotes (except meal_anchors)
6. Third-party data ONLY if allowThirdParty=true
7. All third-party confidence = "low"
8. Do NOT infer: usage occasions, tone, audience, hooks, behavioral patterns

Return ONLY the JSON object. No commentary, no markdown wrapper, no explanation.`
}
