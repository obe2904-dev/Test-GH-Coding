/**
 * Integration Tests for Location Phrase Resolution System
 * 
 * End-to-end tests that verify the location phrase resolution works correctly
 * across all fallback builders and brand profile generation components.
 */

import { test, expect, describe } from 'vitest'
import { resolveLocationPhrase } from '../location-phrase-resolver.ts'
import { buildFallbackSignatureShot, buildFallbackBrandEssence } from '../repair/fallback-builders.ts'
import { buildContentPillarsFallback } from '../repair/deterministic-repairs.ts'
import { validateLocationPhrase } from '../validate-location-consistency.ts'
import type { LocaleConfig } from '../locales.ts'
import type { DataSources, LanguageConfig } from '../types.ts'

// Mock configurations
const mockDanishLocale: LocaleConfig = {
  code: 'da-DK-aarhus',
  language: 'da',
  country: 'DK',
  city: 'aarhus',
  name: 'Danish (Aarhus)',
  nativeName: 'Dansk (Aarhus)',
  currency: 'DKK',
  dateFormat: 'DD-MM-YYYY',
  numberFormat: { decimal: ',', thousands: '.' },
  venueTypes: {
    cafe: 'Café',
    restaurant: 'Restaurant',
    bar: 'Bar'
  },
  bannedWords: [],
  preferredPhrasing: {
    location_waterfront: 'ved åen',
    location_transit: 'ved stationen',
    location_shopping: 'på gågaden'
  },
  formalityLevel: 'informal',
  ctaStyle: 'imperative'
}

const mockDanishLanguage: LanguageConfig = {
  code: 'da-DK',
  language: 'da',
  name: 'Danish',
  nativeName: 'Dansk',
  systemPromptA: '',
  instructionsPromptA: '',
  countryMappings: ['DK'],
  translations: {
    clarificationsNeeded: 'Afklaringer nødvendige',
    internalNotes: 'Interne noter',
    insufficientData: 'Utilstrækkelige data',
    inferred: 'Udledt',
    lowConfidence: 'Lav tillid'
  }
}

describe('Integration: Aarhus "åen" Case - User Reported Issue', () => {
  const testDataSources: Partial<DataSources> = {
    business: {
      id: 'test-123',
      name: 'Test Café',
      local_location_reference: 'ved åen', // Explicitly set by user/system
      city: 'Aarhus',
      vertical: 'cafe'
    },
    location: {
      city: 'Aarhus',
      country: 'DK',
      enrichment: {
        micro: {
          area_type: 'waterfront'
        },
        macro: {
          city: 'Aarhus'
        }
      }
    },
    profile: {
      business_name: 'Test Café'
    },
    menu: [],
    images: [],
    websiteAnalysis: {},
    socialAccounts: [],
    menuSignalProgrammes: [
      { role: 'brunch', timeContext: 'morning', items: ['eggs', 'coffee'] }
    ]
  } as any

  test('Resolver returns correct phrase for Aarhus river location', () => {
    const result = resolveLocationPhrase(testDataSources as DataSources, mockDanishLocale)

    expect(result.phrase).toBe('ved åen')
    expect(result.source).toBe('business')
    expect(result.phrase).not.toContain('vandet')
  })

  test('Fallback signature shot uses correct location phrase', () => {
    const signatureShot = buildFallbackSignatureShot(
      testDataSources as DataSources,
      {},
      mockDanishLanguage
    )

    // Should contain "ved åen", not "vandet"
    expect(signatureShot).toContain('ved')
    expect(signatureShot).not.toContain('vandet')
    
    // Validate it passes our validation
    const validation = validateLocationPhrase(signatureShot, 'ved åen', 'da')
    expect(validation.valid).toBe(true)
  })

  test('Fallback brand essence uses correct location phrase', () => {
    const brandEssence = buildFallbackBrandEssence(
      testDataSources as DataSources,
      {},
      mockDanishLanguage
    )

    // Should not use generic "vandet"
    expect(brandEssence).not.toContain('ved vandet')
    
    // Validate it passes our validation
    const validation = validateLocationPhrase(brandEssence, 'ved åen', 'da')
    expect(validation.valid).toBe(true)
  })

  test('Content pillars use correct location phrase in notes', () => {
    const pillars = buildContentPillarsFallback(
      testDataSources as DataSources,
      {},
      undefined,
      mockDanishLocale
    )

    // Check Vibe pillar notes specifically (waterfront locations)
    const vibePillar = pillars.find(p => p.pillar === 'Vibe')
    if (vibePillar && vibePillar.encouraged) {
      expect(vibePillar.notes).not.toContain('ved vandet')
      
      // Validate notes pass validation
      const validation = validateLocationPhrase(vibePillar.notes, 'ved åen', 'da')
      expect(validation.errorCount).toBe(0)
    }
  })
})

describe('Integration: Copenhagen Harbor Case - Open Water', () => {
  const harborDataSources: Partial<DataSources> = {
    business: {
      id: 'test-456',
      name: 'Harbor Restaurant',
      local_location_reference: 'ved havnen',
      city: 'København',
      vertical: 'restaurant'
    },
    location: {
      city: 'København',
      country: 'DK',
      enrichment: {
        micro: {
          area_type: 'waterfront'
        },
        macro: {
          city: 'København'
        }
      }
    },
    profile: {
      business_name: 'Harbor Restaurant'
    },
    menu: [],
    images: [],
    websiteAnalysis: {},
    socialAccounts: []
  } as any

  test('Resolver returns harbor phrase correctly', () => {
    const result = resolveLocationPhrase(harborDataSources as DataSources, mockDanishLocale)

    expect(result.phrase).toBe('ved havnen')
    expect(result.source).toBe('business')
  })

  test('Fallbacks respect harbor location', () => {
    const signatureShot = buildFallbackSignatureShot(
      harborDataSources as DataSources,
      {},
      mockDanishLanguage
    )

    expect(signatureShot).toContain('havnen')
    
    const validation = validateLocationPhrase(signatureShot, 'ved havnen', 'da')
    expect(validation.valid).toBe(true)
  })
})

describe('Integration: No Stored Reference - Semantic Fallback', () => {
  const noReferenceDataSources: Partial<DataSources> = {
    business: {
      id: 'test-789',
      name: 'Waterfront Café',
      city: 'Aarhus',
      vertical: 'cafe'
    },
    location: {
      city: 'Aarhus',
      country: 'DK',
      enrichment: {
        micro: {
          area_type: 'waterfront'
        },
        macro: {
          city: 'Aarhus'
        }
      }
    },
    profile: {
      business_name: 'Waterfront Café'
    },
    menu: [],
    images: [],
    websiteAnalysis: {},
    socialAccounts: []
  } as any

  test('Falls back to safe default (river for Aarhus)', () => {
    const result = resolveLocationPhrase(noReferenceDataSources as DataSources, mockDanishLocale)

    // Without explicit reference, should use safe "ved åen" for Danish waterfront
    expect(result.phrase).toBe('ved åen')
    expect(result.source).toBe('semantic')
  })

  test('Fallbacks use semantic default consistently', () => {
    const signatureShot = buildFallbackSignatureShot(
      noReferenceDataSources as DataSources,
      {},
      mockDanishLanguage
    )

    // Should use the semantic fallback from locale
    expect(signatureShot).not.toContain('vandet')
  })
})

describe('Integration: Transit Hub Location', () => {
  const transitDataSources: Partial<DataSources> = {
    business: {
      id: 'test-transit',
      name: 'Station Café',
      local_location_reference: 'ved stationen',
      city: 'Aarhus',
      vertical: 'cafe'
    },
    location: {
      city: 'Aarhus',
      country: 'DK',
      enrichment: {
        micro: {
          area_type: 'transit_hub'
        },
        macro: {
          city: 'Aarhus'
        }
      }
    },
    profile: {
      business_name: 'Station Café'
    },
    menu: [],
    images: [],
    websiteAnalysis: {},
    socialAccounts: []
  } as any

  test('Resolver handles transit location correctly', () => {
    const result = resolveLocationPhrase(transitDataSources as DataSources, mockDanishLocale)

    expect(result.phrase).toBe('ved stationen')
    expect(result.source).toBe('business')
  })

  test('Fallbacks use correct transit phrase', () => {
    const brandEssence = buildFallbackBrandEssence(
      transitDataSources as DataSources,
      {},
      mockDanishLanguage
    )

    expect(brandEssence).toContain('station')
  })
})

describe('Integration: Priority Hierarchy Enforcement', () => {
  test('Business reference overrides enrichment term', () => {
    const conflictingData: Partial<DataSources> = {
      business: {
        local_location_reference: 'ved fjorden', // Priority 1
        city: 'Vejle'
      },
      location: {
        enrichment: {
          micro: {
            waterfront_term: 'ved søen', // Priority 3 - should be ignored
            area_type: 'waterfront'
          }
        },
        city: 'Vejle'
      }
    } as any

    const result = resolveLocationPhrase(conflictingData as DataSources, mockDanishLocale)

    // Must use business reference, not enrichment term
    expect(result.phrase).toBe('ved fjorden')
    expect(result.source).toBe('business')
    expect(result.phrase).not.toContain('søen')
  })

  test('Location intelligence overrides enrichment when business missing', () => {
    const locationIntelData: Partial<DataSources> = {
      business: {
        city: 'Kolding'
      },
      locationIntelligenceRow: {
        local_location_reference: 'ved bugten' // Priority 2
      },
      location: {
        enrichment: {
          micro: {
            waterfront_term: 'ved vandet', // Priority 3 - should be ignored
            area_type: 'waterfront'
          }
        }
      }
    } as any

    const result = resolveLocationPhrase(locationIntelData as DataSources, mockDanishLocale)

    expect(result.phrase).toBe('ved bugten')
    expect(result.source).toBe('location_intelligence')
  })
})

describe('Integration: End-to-End Validation Flow', () => {
  test('Full flow prevents semantic errors', () => {
    const dataSources: Partial<DataSources> = {
      business: {
        local_location_reference: 'ved åen',
        city: 'Aarhus'
      },
      location: {
        enrichment: {
          micro: {
            area_type: 'waterfront'
          }
        },
        city: 'Aarhus'
      }
    } as any

    // 1. Resolve phrase
    const resolved = resolveLocationPhrase(dataSources as DataSources, mockDanishLocale)
    expect(resolved.phrase).toBe('ved åen')

    // 2. Generate fallback content
    const signatureShot = buildFallbackSignatureShot(
      dataSources as DataSources,
      {},
      mockDanishLanguage
    )

    // 3. Validate generated content
    const validation = validateLocationPhrase(signatureShot, 'ved åen', 'da')
    
    // Must pass validation with no errors
    expect(validation.valid).toBe(true)
    expect(validation.errorCount).toBe(0)
    expect(signatureShot).not.toContain('vandet')
  })

  test('Detects and reports violations in generated content', () => {
    // Simulate old behavior that would generate wrong content
    const badContent = 'Hyggelig café ved vandet i Aarhus med brunch.'
    const storedReference = 'ved åen'

    const validation = validateLocationPhrase(badContent, storedReference, 'da')

    expect(validation.valid).toBe(false)
    expect(validation.errorCount).toBeGreaterThan(0)
    
    const error = validation.violations.find(v => v.type === 'semantic_mismatch')
    expect(error?.severity).toBe('high')
  })
})
