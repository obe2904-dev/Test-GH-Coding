/**
 * Unit tests for location enrichment module
 * 
 * Run with: deno test location-enrichment.test.ts
 */

import { test, expect } from 'vitest'
import {
  computeLocationEnrichment,
  classifyCityTier,
  createDefaultLocationEnrichment,
  type LocationInput
} from './location-enrichment.ts'

// ============================================
// City Tier Classification Tests
// ============================================

test('classifyCityTier - Danish capital', () => {
  expect(classifyCityTier('København', 'Denmark')).toEqual('capital')
  expect(classifyCityTier('Copenhagen', 'Denmark')).toEqual('capital')
})

test('classifyCityTier - Danish major cities', () => {
  expect(classifyCityTier('Aarhus', 'Denmark')).toEqual('major_city')
  expect(classifyCityTier('Odense', 'Denmark')).toEqual('major_city')
  expect(classifyCityTier('Aalborg', 'Denmark')).toEqual('major_city')
})

test('classifyCityTier - Danish mid-tier cities', () => {
  expect(classifyCityTier('Esbjerg', 'Denmark')).toEqual('mid_city')
  expect(classifyCityTier('Randers', 'Denmark')).toEqual('mid_city')
  expect(classifyCityTier('Kolding', 'Denmark')).toEqual('mid_city')
})

test('classifyCityTier - Danish small town (unlisted)', () => {
  expect(classifyCityTier('Skagen', 'Denmark')).toEqual('small_town')
  expect(classifyCityTier('Ribe', 'Denmark')).toEqual('small_town')
})

test('classifyCityTier - German cities', () => {
  expect(classifyCityTier('Berlin', 'Germany')).toEqual('capital')
  expect(classifyCityTier('Hamburg', 'Germany')).toEqual('major_city')
  expect(classifyCityTier('München', 'Germany')).toEqual('major_city')
  expect(classifyCityTier('Leipzig', 'Germany')).toEqual('mid_city')
})

test('classifyCityTier - Swedish cities', () => {
  expect(classifyCityTier('Stockholm', 'Sweden')).toEqual('capital')
  expect(classifyCityTier('Göteborg', 'Sweden')).toEqual('major_city')
  expect(classifyCityTier('Malmö', 'Sweden')).toEqual('major_city')
  expect(classifyCityTier('Västerås', 'Sweden')).toEqual('mid_city')
})

// ============================================
// Area Type Detection Tests
// ============================================

test('computeLocationEnrichment - waterfront location (Danish)', () => {
  const input: LocationInput = {
    address_line1: 'Åboulevarden 23',
    city: 'Aarhus',
    country: 'Denmark'
  }
  
  const result = computeLocationEnrichment(input)
  
  expect(result.micro.area_type).toEqual('waterfront')
  expect(result.macro.city).toEqual('Aarhus')
  expect(result.macro.city_tier).toEqual('major_city')
  expect(result.micro.confidence).toEqual('medium')
})

test('computeLocationEnrichment - transit hub', () => {
  const input: LocationInput = {
    address_line1: 'Ved Banegården 15',
    city: 'København',
    country: 'Denmark'
  }
  
  const result = computeLocationEnrichment(input)
  
  expect(result.micro.area_type).toEqual('transit_hub')
  expect(result.macro.city_tier).toEqual('capital')
})

test('computeLocationEnrichment - shopping district', () => {
  const input: LocationInput = {
    address_line1: 'Strøget 42',
    city: 'København',
    country: 'Denmark'
  }
  
  const result = computeLocationEnrichment(input)
  
  expect(result.micro.area_type).toEqual('shopping_street')
})

test('computeLocationEnrichment - tourist zone', () => {
  const input: LocationInput = {
    address_line1: 'Nyhavn 17',
    city: 'København',
    country: 'Denmark'
  }
  
  const result = computeLocationEnrichment(input)
  
  expect(result.micro.area_type).toEqual('tourist_zone')
})

test('computeLocationEnrichment - campus area', () => {
  const input: LocationInput = {
    address_line1: 'Campus Vej 55',
    city: 'Aarhus',
    country: 'Denmark'
  }
  
  const result = computeLocationEnrichment(input)
  
  expect(result.micro.area_type).toEqual('campus')
})

test('computeLocationEnrichment - business district', () => {
  const input: LocationInput = {
    address_line1: 'Vesterbrogade 1A',
    city: 'København',
    country: 'Denmark'
  }
  
  const result = computeLocationEnrichment(input)
  
  expect(result.micro.area_type).toEqual('business_district')
})

// ============================================
// Confidence Scoring Tests
// ============================================

test('computeLocationEnrichment - high confidence (geo + specific area)', () => {
  const input: LocationInput = {
    address_line1: 'Åboulevarden 23',
    city: 'Aarhus',
    country: 'Denmark',
    latitude: 56.1629,
    longitude: 10.2039
  }
  
  const result = computeLocationEnrichment(input)
  
  expect(result.micro.confidence).toEqual('high')
  expect(result.geo?.lat).toEqual(56.1629)
  expect(result.geo?.lng).toEqual(10.2039)
  expect(result.geo?.accuracy).toEqual('high')
})

test('computeLocationEnrichment - medium confidence (no geo, specific area)', () => {
  const input: LocationInput = {
    address_line1: 'Ved Havnen 10',
    city: 'Esbjerg',
    country: 'Denmark'
  }
  
  const result = computeLocationEnrichment(input)
  
  expect(result.micro.confidence).toEqual('medium')
  expect(result.geo).toBeUndefined()
})

test('computeLocationEnrichment - low confidence (no signals)', () => {
  const input: LocationInput = {
    address_line1: 'Hovedgaden 12',
    city: 'Skagen',
    country: 'Denmark'
  }
  
  const result = computeLocationEnrichment(input)
  
  expect(result.micro.confidence).toEqual('low')
  expect(result.micro.area_type).toEqual('unknown')
})

// ============================================
// Nearby Signals Tests
// ============================================

test('computeLocationEnrichment - waterfront signals', () => {
  const input: LocationInput = {
    address_line1: 'Havnegade 15',
    city: 'Aarhus',
    country: 'Denmark'
  }
  
  const result = computeLocationEnrichment(input)
  
  // Should have waterfront-specific behavioral signals
  const hasWaterfrontSignals = result.micro.nearby_signals.some(s => 
    s.includes('waterfront') || s.includes('scenic') || s.includes('evening foot traffic')
  )
  expect(hasWaterfrontSignals).toBe(true)
  
  // Should have max 6 signals
  expect(result.micro.nearby_signals.length <= 6).toBe(true)
})

test('computeLocationEnrichment - business district signals', () => {
  const input: LocationInput = {
    address_line1: 'Business Park 5',
    city: 'København',
    country: 'Denmark'
  }
  
  const result = computeLocationEnrichment(input)
  
  expect(result.micro.area_type).toEqual('business_district')
  
  // Should have business-specific signals
  const hasBusinessSignals = result.micro.nearby_signals.some(s => 
    s.includes('weekday lunch') || s.includes('after-work') || s.includes('business')
  )
  expect(hasBusinessSignals).toBe(true)
})

// ============================================
// Version and Structure Tests
// ============================================

test('computeLocationEnrichment - structure validation', () => {
  const input: LocationInput = {
    address_line1: 'Åboulevarden 23',
    city: 'Aarhus',
    country: 'Denmark',
    latitude: 56.1629,
    longitude: 10.2039
  }
  
  const result = computeLocationEnrichment(input)
  
  // Version
  expect(result.version).toEqual('1.0')
  
  // Macro structure
  expect(typeof result.macro.country).toEqual('string')
  expect(typeof result.macro.city).toEqual('string')
  expect(result.macro.city_tier !== undefined).toBe(true)
  
  // Micro structure
  expect(typeof result.micro.area_type).toEqual('string')
  expect(Array.isArray(result.micro.nearby_signals)).toBe(true)
  expect(['high', 'medium', 'low'].includes(result.micro.confidence)).toBe(true)
  
  // Geo structure (optional)
  if (result.geo) {
    expect(typeof result.geo.lat).toEqual('number')
    expect(typeof result.geo.lng).toEqual('number')
    expect(['high', 'medium', 'low'].includes(result.geo.accuracy)).toBe(true)
  }
})

// ============================================
// Edge Cases and Defaults
// ============================================

test('computeLocationEnrichment - minimal input', () => {
  const input: LocationInput = {
    city: 'Aarhus'
  }
  
  const result = computeLocationEnrichment(input)
  
  expect(result.macro.country).toEqual('Denmark') // Default
  expect(result.macro.city).toEqual('Aarhus')
  expect(result.micro.area_type).toEqual('unknown')
  expect(result.micro.confidence).toEqual('low')
})

test('createDefaultLocationEnrichment', () => {
  const result = createDefaultLocationEnrichment('København', 'Denmark')
  
  expect(result.version).toEqual('1.0')
  expect(result.macro.city).toEqual('København')
  expect(result.macro.city_tier).toEqual('capital')
  expect(result.micro.area_type).toEqual('unknown')
  expect(result.micro.nearby_signals.length).toEqual(0)
  expect(result.micro.confidence).toEqual('low')
})

// ============================================
// Real-World Examples
// ============================================

test('Real example - Café Faust (waterfront, Aarhus)', () => {
  const input: LocationInput = {
    address_line1: 'Vester Allé 15',
    city: 'Aarhus',
    postal_code: '8000',
    country: 'Denmark',
    // Note: No explicit waterfront in address, but "Vester Allé" near "å" in city context
  }
  
  const result = computeLocationEnrichment(input)
  
  expect(result.macro.city).toEqual('Aarhus')
  expect(result.macro.city_tier).toEqual('major_city')
  // Area type might be unknown without explicit waterfront keyword in address
  // This demonstrates the need for more context or manual override
})

test('Real example - Restaurant at main station', () => {
  const input: LocationInput = {
    address_line1: 'Banegårdspladsen 7',
    city: 'København',
    country: 'Denmark',
    latitude: 55.6761,
    longitude: 12.5683
  }
  
  const result = computeLocationEnrichment(input)
  
  expect(result.macro.city_tier).toEqual('capital')
  expect(result.micro.area_type).toEqual('transit_hub')
  expect(result.micro.confidence).toEqual('high') // Has geo + specific area
  
  // Should have transit-related signals
  const hasTransitSignals = result.micro.nearby_signals.some(s => 
    s.includes('commuter') || s.includes('transit') || s.includes('rush')
  )
  expect(hasTransitSignals).toBe(true)
})

test('Real example - Strøget shopping district', () => {
  const input: LocationInput = {
    address_line1: 'Strøget 45',
    city: 'København',
    country: 'Denmark'
  }
  
  const result = computeLocationEnrichment(input)
  
  expect(result.micro.area_type).toEqual('shopping_street')
  expect(result.macro.city_tier).toEqual('capital')
  
  // Strøget is also tourist zone, but shopping takes precedence in detection order
})

// ============================================
// Multi-Language Support Tests
// ============================================

test('German location - Hamburg harbor', () => {
  const input: LocationInput = {
    address_line1: 'Hafenstraße 12',
    city: 'Hamburg',
    country: 'Germany'
  }
  
  const result = computeLocationEnrichment(input)
  
  expect(result.macro.city_tier).toEqual('major_city')
  expect(result.micro.area_type).toEqual('waterfront')
})

test('Swedish location - Stockholm old town', () => {
  const input: LocationInput = {
    address_line1: 'Gamla Stan 8',
    city: 'Stockholm',
    country: 'Sweden'
  }
  
  const result = computeLocationEnrichment(input)
  
  expect(result.macro.city_tier).toEqual('capital')
  expect(result.micro.area_type).toEqual('tourist_zone')
})

// ============================================
// Country Code Normalization Tests
// ============================================

test('Country variants - Denmark', () => {
  const inputs = ['Denmark', 'Danmark', 'dk', 'DK']
  
  for (const country of inputs) {
    const result = computeLocationEnrichment({
      city: 'Aarhus',
      country
    })
    expect(result.macro.country).toEqual(country) // Preserves input
    expect(result.macro.city_tier).toEqual('major_city') // But uses DK logic
  }
})

test('Country variants - Germany', () => {
  const inputs = ['Germany', 'Deutschland', 'de', 'DE']
  
  for (const country of inputs) {
    const result = computeLocationEnrichment({
      city: 'Berlin',
      country
    })
    expect(result.macro.city_tier).toEqual('capital')
  }
})
