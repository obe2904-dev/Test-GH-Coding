/**
 * Unit Tests for Location Phrase Resolver
 * 
 * Tests the centralized location phrase resolution with proper priority hierarchy.
 * Ensures businesses.local_location_reference is always respected as the single source of truth.
 */

import { test, expect, describe } from 'vitest'
import { resolveLocationPhrase, getLocationPhrase } from '../location-phrase-resolver.ts'
import type { LocaleConfig } from '../locales.ts'
import type { DataSources } from '../types.ts'

// Mock Danish locale
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
    restaurant: 'Restaurant'
  },
  bannedWords: ['bedste', 'lokale'],
  preferredPhrasing: {
    location_waterfront: 'ved åen',
    location_waterfront_river: 'ved åen',
    location_waterfront_open: 'ved havnen',
    location_transit: 'ved stationen',
    location_shopping: 'på gågaden',
    location_city: 'i Aarhus'
  },
  formalityLevel: 'informal',
  ctaStyle: 'imperative'
}

describe('Location Phrase Resolver - Priority Hierarchy', () => {
  test('Priority 1: Uses businesses.local_location_reference when present', () => {
    const dataSources: Partial<DataSources> = {
      business: {
        local_location_reference: 'ved åen',
        city: 'Aarhus'
      },
      location: {
        enrichment: {
          micro: {
            waterfront_term: 'ved havnen', // Should be ignored
            area_type: 'waterfront'
          }
        },
        city: 'Aarhus'
      }
    } as any

    const result = resolveLocationPhrase(dataSources as DataSources, mockDanishLocale)

    expect(result.phrase).toBe('ved åen')
    expect(result.source).toBe('business')
    expect(result.includesPreposition).toBe(true)
  })

  test('Priority 2: Falls back to locationIntelligenceRow when business reference missing', () => {
    const dataSources: Partial<DataSources> = {
      business: {
        city: 'Aarhus'
      },
      locationIntelligenceRow: {
        local_location_reference: 'ved fjorden'
      },
      location: {
        enrichment: {
          micro: {
            waterfront_term: 'ved vandet', // Should be ignored
            area_type: 'waterfront'
          }
        }
      }
    } as any

    const result = resolveLocationPhrase(dataSources as DataSources, mockDanishLocale)

    expect(result.phrase).toBe('ved fjorden')
    expect(result.source).toBe('location_intelligence')
  })

  test('Priority 3: Falls back to enrichment.waterfront_term when higher priorities missing', () => {
    const dataSources: Partial<DataSources> = {
      business: {
        city: 'Aarhus'
      },
      location: {
        enrichment: {
          micro: {
            waterfront_term: 'ved søen',
            area_type: 'waterfront'
          }
        }
      }
    } as any

    const result = resolveLocationPhrase(dataSources as DataSources, mockDanishLocale)

    expect(result.phrase).toBe('ved søen')
    expect(result.source).toBe('enrichment')
  })

  test('Priority 4: Uses semantic fallback based on area_type', () => {
    const dataSources: Partial<DataSources> = {
      business: {
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

    const result = resolveLocationPhrase(dataSources as DataSources, mockDanishLocale)

    expect(result.phrase).toBe('ved åen') // Conservative river default for Danish
    expect(result.source).toBe('semantic')
  })

  test('Priority 5: Falls back to city-level locale default', () => {
    const dataSources: Partial<DataSources> = {
      business: {
        city: 'Aarhus'
      },
      location: {
        city: 'Aarhus'
      }
    } as any

    const result = resolveLocationPhrase(dataSources as DataSources, mockDanishLocale)

    expect(result.phrase).toBe('i Aarhus')
    expect(result.source).toBe('locale')
  })
})

describe('Location Phrase Resolver - Semantic Correctness', () => {
  test('Prevents "vandet" for river waterfront (Aarhus "åen" case)', () => {
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

    const result = resolveLocationPhrase(dataSources as DataSources, mockDanishLocale)

    // CRITICAL: Should never return "vandet" for river location
    expect(result.phrase).not.toContain('vandet')
    expect(result.phrase).toBe('ved åen')
  })

  test('Allows specific water body terms for open water', () => {
    const dataSources: Partial<DataSources> = {
      business: {
        local_location_reference: 'ved havnen',
        city: 'København'
      },
      location: {
        enrichment: {
          micro: {
            area_type: 'waterfront'
          }
        },
        city: 'København'
      }
    } as any

    const result = resolveLocationPhrase(dataSources as DataSources, mockDanishLocale)

    expect(result.phrase).toBe('ved havnen')
    expect(result.source).toBe('business')
  })

  test('Handles transit_hub context correctly', () => {
    const dataSources: Partial<DataSources> = {
      business: {
        city: 'Aarhus'
      },
      location: {
        enrichment: {
          micro: {
            area_type: 'transit_hub'
          }
        }
      }
    } as any

    const result = resolveLocationPhrase(dataSources as DataSources, mockDanishLocale, { context: 'transit' })

    expect(result.phrase).toBe('ved stationen')
    expect(result.source).toBe('semantic')
  })

  test('Handles shopping_street context correctly', () => {
    const dataSources: Partial<DataSources> = {
      business: {
        city: 'Aarhus'
      },
      location: {
        enrichment: {
          micro: {
            area_type: 'shopping_street'
          }
        }
      }
    } as any

    const result = resolveLocationPhrase(dataSources as DataSources, mockDanishLocale, { context: 'shopping' })

    expect(result.phrase).toBe('på gågaden')
    expect(result.source).toBe('semantic')
  })
})

describe('Location Phrase Resolver - Preposition Handling', () => {
  test('Includes preposition by default', () => {
    const dataSources: Partial<DataSources> = {
      business: {
        local_location_reference: 'ved åen',
        city: 'Aarhus'
      }
    } as any

    const result = resolveLocationPhrase(dataSources as DataSources, mockDanishLocale)

    expect(result.phrase).toBe('ved åen')
    expect(result.includesPreposition).toBe(true)
  })

  test('Strips preposition when requested', () => {
    const dataSources: Partial<DataSources> = {
      business: {
        local_location_reference: 'ved åen',
        city: 'Aarhus'
      }
    } as any

    const result = resolveLocationPhrase(dataSources as DataSources, mockDanishLocale, { includePreposition: false })

    expect(result.phrase).toBe('åen')
    expect(result.includesPreposition).toBe(false)
  })

  test('Handles phrases without preposition correctly', () => {
    const dataSources: Partial<DataSources> = {
      business: {
        local_location_reference: 'Nyhavn',
        city: 'København'
      }
    } as any

    const result = resolveLocationPhrase(dataSources as DataSources, mockDanishLocale)

    expect(result.phrase).toBe('Nyhavn')
    expect(result.includesPreposition).toBe(false)
  })

  test('Recognizes various Danish prepositions', () => {
    const prepositions = ['ved', 'i', 'på', 'langs', 'nær', 'tæt på']
    
    prepositions.forEach(prep => {
      const dataSources: Partial<DataSources> = {
        business: {
          local_location_reference: `${prep} stedet`,
          city: 'Aarhus'
        }
      } as any

      const result = resolveLocationPhrase(dataSources as DataSources, mockDanishLocale)
      expect(result.includesPreposition).toBe(true)
    })
  })
})

describe('Location Phrase Resolver - Edge Cases', () => {
  test('Handles empty dataSources gracefully', () => {
    const dataSources: Partial<DataSources> = {} as any

    const result = resolveLocationPhrase(dataSources as DataSources, mockDanishLocale)

    expect(result.phrase).toBe('')
    expect(result.source).toBe('default')
  })

  test('Handles null/undefined local_location_reference', () => {
    const dataSources: Partial<DataSources> = {
      business: {
        local_location_reference: null,
        city: 'Aarhus'
      },
      location: {
        city: 'Aarhus'
      }
    } as any

    const result = resolveLocationPhrase(dataSources as DataSources, mockDanishLocale)

    expect(result.source).not.toBe('business')
    expect(result.phrase).toBeTruthy() // Should fall back to something
  })

  test('Trims whitespace from stored references', () => {
    const dataSources: Partial<DataSources> = {
      business: {
        local_location_reference: '  ved åen  ',
        city: 'Aarhus'
      }
    } as any

    const result = resolveLocationPhrase(dataSources as DataSources, mockDanishLocale)

    expect(result.phrase).toBe('ved åen')
    expect(result.phrase).not.toContain('  ')
  })

  test('Handles empty string local_location_reference', () => {
    const dataSources: Partial<DataSources> = {
      business: {
        local_location_reference: '',
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

    const result = resolveLocationPhrase(dataSources as DataSources, mockDanishLocale)

    // Should skip empty string and use semantic fallback
    expect(result.source).toBe('semantic')
    expect(result.phrase).toBe('ved åen')
  })
})

describe('getLocationPhrase - Convenience Function', () => {
  test('Returns just the phrase string', () => {
    const dataSources: Partial<DataSources> = {
      business: {
        local_location_reference: 'ved åen',
        city: 'Aarhus'
      }
    } as any

    const phrase = getLocationPhrase(dataSources as DataSources, mockDanishLocale)

    expect(typeof phrase).toBe('string')
    expect(phrase).toBe('ved åen')
  })

  test('Respects includePreposition parameter', () => {
    const dataSources: Partial<DataSources> = {
      business: {
        local_location_reference: 'ved åen',
        city: 'Aarhus'
      }
    } as any

    const withPrep = getLocationPhrase(dataSources as DataSources, mockDanishLocale, true)
    const withoutPrep = getLocationPhrase(dataSources as DataSources, mockDanishLocale, false)

    expect(withPrep).toBe('ved åen')
    expect(withoutPrep).toBe('åen')
  })
})

describe('Real-world Test Cases', () => {
  test('Aarhus café at "åen" - User reported issue', () => {
    // This is the exact scenario reported by the user
    const dataSources: Partial<DataSources> = {
      business: {
        local_location_reference: 'ved åen',
        city: 'Aarhus',
        name: 'Test Café'
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

    const result = resolveLocationPhrase(dataSources as DataSources, mockDanishLocale)

    // CRITICAL: Must return "ved åen", NOT "ved vandet"
    expect(result.phrase).toBe('ved åen')
    expect(result.phrase).not.toContain('vandet')
    expect(result.source).toBe('business')
  })

  test('Copenhagen harbor restaurant - Open water is acceptable', () => {
    const dataSources: Partial<DataSources> = {
      business: {
        local_location_reference: 'ved havnen',
        city: 'København'
      },
      location: {
        enrichment: {
          micro: {
            area_type: 'waterfront'
          }
        },
        city: 'København'
      }
    } as any

    const result = resolveLocationPhrase(dataSources as DataSources, mockDanishLocale)

    expect(result.phrase).toBe('ved havnen')
    expect(result.source).toBe('business')
  })
})
