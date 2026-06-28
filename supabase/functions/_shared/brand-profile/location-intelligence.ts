/**
 * Location Intelligence Builder
 *
 * Derives a structured LocationIntelligence object from the business_locations row.
 * Consumes two data sources:
 *   - location.category_scores  (set by populate-location-intelligence, Google Places)
 *   - location.location_marketing_hooks (set by populate-location-intelligence)
 *   - location.enrichment.micro.area_type (set by brand-profile-generator, lightweight)
 *
 * All logic is deterministic — zero AI latency, zero tokens.
 */

import type { LocationIntelligence } from './types.ts'

// ─────────────────────────────────────────────────────────────────────────────
// Motivation map  (area-type key → Danish copy-hook tokens)
// ─────────────────────────────────────────────────────────────────────────────
const MOTIVATION_MAP: Record<string, string[]> = {
  waterfront:        ['destinationsbesøg', 'romantisk_stemning', 'belønning_forkælelse', 'familieudflug'],
  tourist:           ['destinationsbesøg', 'sightseeing', 'familieudflug', 'frokostpause'],
  destination:       ['destinationsbesøg', 'familieudflug', 'belønning_forkælelse', 'weekend_udflugt'],
  city_centre:       ['hverdagskaffe', 'forretningsfrokost', 'social_møde', 'frokostpause'],
  shopping_district: ['shoppedag', 'belønning_forkælelse', 'hverdagskaffe', 'social_møde'],
  office:            ['forretningsfrokost', 'hverdagskaffe', 'arbejdsdag_boost'],
  student:           ['studie', 'hverdagskaffe', 'social_møde', 'frokostpause'],
  transport_hub:     ['forbipasserende', 'hurtig_bid', 'pendler'],
  residential:       ['nærbutik', 'hverdagskaffe', 'familieudflug', 'lokal_stamkunde'],
  mixed_use:         ['hverdagskaffe', 'social_møde', 'frokostpause'],
}

// ─────────────────────────────────────────────────────────────────────────────
// Tourist-context area types (bilingual awareness trigger)
// ─────────────────────────────────────────────────────────────────────────────
const TOURIST_TYPES = new Set(['tourist', 'destination', 'waterfront', 'tourist_zone'])

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the top N entries from a Record<string,number> sorted by score descending.
 */
function topEntries(
  scores: Record<string, number>,
  n: number
): Array<[string, number]> {
  return Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
}

/**
 * Derive matched motivations from the top area-type categories.
 * Deduplicates and caps at 4 motivations.
 */
function deriveMotivations(primaryType: string, secondaryTypes: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const type of [primaryType, ...secondaryTypes]) {
    for (const m of (MOTIVATION_MAP[type] || [])) {
      if (!seen.has(m) && result.length < 4) {
        seen.add(m)
        result.push(m)
      }
    }
  }

  // Fallback to lightweight enrichment type if nothing resolved
  if (result.length === 0) {
    for (const m of (MOTIVATION_MAP['mixed_use'] || [])) {
      result.push(m)
      if (result.length >= 2) break
    }
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Main builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a LocationIntelligence object from the business_locations row.
 * Returns null if no useful data is available.
 *
 * @param location - The full business_locations row from DataSources
 */
export function buildLocationIntelligence(location: any): LocationIntelligence | null {
  if (!location) return null

  const categoryScores: Record<string, number> = location.category_scores || {}
  const marketingHooks: Array<{ text: string }> = location.location_marketing_hooks || []
  // Fallback area type from lightweight enrichment
  const lightweightAreaType: string | undefined = location.enrichment?.micro?.area_type

  // Resolve primary type
  const hasRichData = Object.keys(categoryScores).length > 0

  let primaryType: string
  let secondaryTypes: string[]

  if (hasRichData) {
    const entries = topEntries(categoryScores, 3)
    primaryType = entries[0]?.[0] ?? lightweightAreaType ?? 'unknown'
    secondaryTypes = entries.slice(1).map(([k]) => k)
  } else if (lightweightAreaType && lightweightAreaType !== 'unknown') {
    primaryType = lightweightAreaType
    secondaryTypes = []
  } else {
    return null // Not enough data — omit the field entirely
  }

  const matchedMotivations = deriveMotivations(primaryType, secondaryTypes)

  // Tourist context: triggered by area type OR high tourist / destination score
  // Schema v2: read tourist from demographic_proximity (who passes by), not category_scores (where business is)
  const touristContext =
    TOURIST_TYPES.has(primaryType) ||
    TOURIST_TYPES.has(lightweightAreaType ?? '') ||
    (location.demographic_proximity?.tourist ?? 0) >= 50 ||
    (categoryScores['destination'] ?? 0) >= 50

  const marketingFocus = marketingHooks[0]?.text ?? null

  return {
    primary_type: primaryType,
    matched_motivations: matchedMotivations,
    marketing_focus: marketingFocus,
    secondary_types: secondaryTypes,
    tourist_context: touristContext,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt A block builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the rich geo_context block for Prompt A.
 * Returns an empty string if no intelligence is available.
 */
export function buildGeoContextBlock(
  location: any,
  city: string,
  areaTypeFromEnrichment: string | undefined,
  canonicalLocationPhrase: string
): string {
  const intel = buildLocationIntelligence(location)
  if (!intel) return ''

  const lines = [
    `GEO_CONTEXT (structured):`,
    `- city: ${city || '—'}`,
    `- area_type: ${areaTypeFromEnrichment ?? intel.primary_type}`,
    `- primary_location_type: ${intel.primary_type}`,
    `- matched_motivations: [${intel.matched_motivations.join(', ')}]`,
    intel.marketing_focus ? `- marketing_focus: "${intel.marketing_focus}"` : null,
    intel.secondary_types.length > 0
      ? `- secondary_types: [${intel.secondary_types.join(', ')}]`
      : null,
    `- tourist_context: ${intel.tourist_context}`,
    canonicalLocationPhrase ? `- canonical_location_phrase: ${canonicalLocationPhrase}` : null,
  ]

  return '\n' + lines.filter(Boolean).join('\n')
}
