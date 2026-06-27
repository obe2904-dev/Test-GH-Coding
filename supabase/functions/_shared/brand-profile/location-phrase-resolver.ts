/**
 * Location Phrase Resolver
 * 
 * Centralized utility for resolving location phrases with proper priority hierarchy.
 * Ensures businesses.local_location_reference is respected as the single source of truth.
 * 
 * Priority Order:
 * 1. businesses.local_location_reference (operator-set, highest priority)
 * 2. business_location_intelligence.local_location_reference (paid tier extraction)
 * 3. location_intelligence.waterfront_term (specific detected term)
 * 4. Semantic fallback based on area_type + locale
 * 5. City-level default from locale.preferredPhrasing
 */

import type { DataSources } from './types.ts'
import type { LocaleConfig } from './locales.ts'
import { getWaterfrontSubtype } from './geographic-context.ts'

export interface LocationPhraseResult {
  phrase: string                    // Resolved phrase (e.g., "ved åen")
  source: 'business' | 'location_intelligence' | 'enrichment' | 'semantic' | 'locale' | 'default'
  includesPreposition: boolean      // True if phrase starts with "ved", "i", "på", etc.
}

/**
 * Resolve location phrase with proper priority hierarchy.
 * 
 * @param dataSources - Full data sources object from brand profile generation
 * @param locale - Locale configuration for fallbacks
 * @param options - Optional configuration
 * @returns Resolved phrase with metadata
 */
export function resolveLocationPhrase(
  dataSources: DataSources,
  locale: LocaleConfig,
  options: {
    includePreposition?: boolean  // Whether to include "ved", "i", etc. (default: true)
    context?: 'waterfront' | 'transit' | 'shopping' | 'generic'  // Context hint for fallback
  } = {}
): LocationPhraseResult {
  const { includePreposition = true, context } = options
  
  // Extract data from sources
  const business = dataSources.business as any
  const locationIntelligence = dataSources.locationIntelligenceRow as any
  const location = dataSources.location as any
  
  // Priority 1: businesses.local_location_reference (operator-set)
  if (business?.local_location_reference) {
    const phrase = business.local_location_reference.trim()
    const hasPreposition = /^(ved|i|på|langs|nær|tæt på)\s/i.test(phrase)
    
    if (includePreposition || !hasPreposition) {
      return {
        phrase,
        source: 'business',
        includesPreposition: hasPreposition
      }
    } else if (hasPreposition) {
      // Strip preposition if requested
      const withoutPrep = phrase.replace(/^(ved|i|på|langs|nær|tæt på)\s+/i, '')
      return {
        phrase: withoutPrep,
        source: 'business',
        includesPreposition: false
      }
    }
  }
  
  // Priority 2: business_location_intelligence.local_location_reference
  if (locationIntelligence?.local_location_reference) {
    const phrase = locationIntelligence.local_location_reference.trim()
    const hasPreposition = /^(ved|i|på|langs|nær|tæt på)\s/i.test(phrase)
    
    if (includePreposition || !hasPreposition) {
      return {
        phrase,
        source: 'location_intelligence',
        includesPreposition: hasPreposition
      }
    } else if (hasPreposition) {
      const withoutPrep = phrase.replace(/^(ved|i|på|langs|nær|tæt på)\s+/i, '')
      return {
        phrase: withoutPrep,
        source: 'location_intelligence',
        includesPreposition: false
      }
    }
  }
  
  // Priority 3: location.enrichment.micro.waterfront_term
  if (location?.enrichment?.micro?.waterfront_term) {
    const term = location.enrichment.micro.waterfront_term.trim()
    const hasPreposition = /^(ved|i|på|langs|nær|tæt på)\s/i.test(term)
    
    if (includePreposition || !hasPreposition) {
      return {
        phrase: term,
        source: 'enrichment',
        includesPreposition: hasPreposition
      }
    } else if (hasPreposition) {
      const withoutPrep = term.replace(/^(ved|i|på|langs|nær|tæt på)\s+/i, '')
      return {
        phrase: withoutPrep,
        source: 'enrichment',
        includesPreposition: false
      }
    }
  }
  
  // Priority 4: Semantic fallback based on area_type + locale
  const areaType = location?.enrichment?.micro?.area_type
  
  if (areaType === 'waterfront' || context === 'waterfront') {
    // Use waterfront subtype detection to distinguish river vs open water
    const city = location?.city || business?.city || ''
    const waterfrontSubtype = getWaterfrontSubtype(
      business?.local_location_reference || 
      locationIntelligence?.local_location_reference || 
      location?.enrichment?.micro?.waterfront_term || 
      '',
      city
    )
    
    let phrase: string
    
    if (waterfrontSubtype === 'river') {
      // River waterfront - use "ved åen" for Danish
      phrase = locale.preferredPhrasing?.['location_waterfront_river'] || 
               locale.preferredPhrasing?.['location_waterfront'] || 
               'ved åen'
    } else if (waterfrontSubtype === 'open_water') {
      // Open water - "ved vandet" is acceptable for sea/harbor
      phrase = locale.preferredPhrasing?.['location_waterfront_open'] || 
               'ved havnen'
    } else {
      // Unknown - use conservative default (river is safer for Danish)
      phrase = locale.preferredPhrasing?.['location_waterfront'] || 'ved åen'
    }
    
    if (!includePreposition && phrase.startsWith('ved ')) {
      return {
        phrase: phrase.replace(/^ved\s+/, ''),
        source: 'semantic',
        includesPreposition: false
      }
    }
    
    return {
      phrase,
      source: 'semantic',
      includesPreposition: phrase.includes(' ')
    }
  }
  
  if (areaType === 'transit_hub' || context === 'transit') {
    const phrase = locale.preferredPhrasing?.['location_transit'] || 'ved stationen'
    return {
      phrase: includePreposition ? phrase : phrase.replace(/^ved\s+/, ''),
      source: 'semantic',
      includesPreposition: includePreposition
    }
  }
  
  if (areaType === 'shopping_street' || context === 'shopping') {
    const phrase = locale.preferredPhrasing?.['location_shopping'] || 'på gågaden'
    return {
      phrase: includePreposition ? phrase : phrase.replace(/^på\s+/, ''),
      source: 'semantic',
      includesPreposition: includePreposition
    }
  }
  
  // Priority 5: City-level default from locale
  const city = location?.city || business?.city || ''
  if (city && locale.preferredPhrasing?.['location_city']) {
    const phrase = locale.preferredPhrasing['location_city']
    return {
      phrase: includePreposition ? phrase : phrase.replace(/^i\s+/, ''),
      source: 'locale',
      includesPreposition: phrase.startsWith('i ')
    }
  }
  
  // Final fallback: generic city reference
  if (city) {
    const phrase = `i ${city}`
    return {
      phrase: includePreposition ? phrase : city,
      source: 'default',
      includesPreposition: includePreposition
    }
  }
  
  // No location data available
  return {
    phrase: '',
    source: 'default',
    includesPreposition: false
  }
}

/**
 * Get just the phrase without metadata (convenience function).
 */
export function getLocationPhrase(
  dataSources: DataSources,
  locale: LocaleConfig,
  includePreposition: boolean = true
): string {
  return resolveLocationPhrase(dataSources, locale, { includePreposition }).phrase
}
