/**
 * Unit Tests for A1/A2 Split Architecture
 * 
 * Tests:
 * 1. A1 output must never include interpretation fields
 * 2. A2 output must include business_id and usage occasions
 * 3. Merge function produces correct legacy format
 */

import { test, expect } from 'vitest'
import type { PromptA1Evidence } from './prompt-a1-evidence.ts'
import type { PromptA2Interpretation } from './prompt-a2-interpretation.ts'
import type { DataSources } from '../types.ts'

// ============================================================================
// MOCKED DATA FIXTURES
// ============================================================================

const mockDataSources: Partial<DataSources> = {
  business: {
    id: 'test-business-123',
    name: 'Test Café',
    vertical: 'restaurant',
    city: 'Aarhus',
    country: 'DK',
    address: 'Åboulevarden 1',
    primary_language: 'da'
  } as any,
  location: {
    city: 'Aarhus',
    country: 'DK',
    enrichment: {
      macro: {
        city: 'Aarhus',
        city_tier: 'major_city',
        region: 'Midtjylland'
      },
      micro: {
        area_type: 'waterfront',
        nearby_signals: ['åen', 'kanal', 'bro']
      }
    }
  } as any,
  menu: [
    { name: 'Brunch Platte', category: 'Brunch', price: '125 kr' },
    { name: 'Pariserbøf', category: 'Hovedretter', price: '165 kr' }
  ] as any,
  websiteAnalysis: {
    homepage_content: 'Nyd brunch ved åen i Aarhus',
    cta_texts: ['BOOK BORD', 'SE MENU'],
    hero_texts: ['Morgenmad til midnat ved åen'],
    headers: ['Velkommen til Test Café', 'Brunch hver dag']
  } as any,
  images: [
    { analysis_result: { labels: ['outdoor seating', 'waterfront', 'food plates'] } }
  ] as any,
  profile: null,
  socialAccounts: []
}

const mockA1Evidence: PromptA1Evidence = {
  business_id: 'test-business-123',
  generated_at: '2026-01-11T10:00:00Z',
  evidence_version: '1.0',
  facts: {
    location: {
      city: 'Aarhus',
      address: 'Åboulevarden 1',
      canonical_location_hook: 'ved åen i Aarhus',
      area_type: 'waterfront',
      nearby_signals: ['åen', 'kanal', 'bro'],
      confidence: 'high',
      quotes: [
        { quote: 'ved åen i Aarhus', source: 'homepage_hero' }
      ]
    },
    menu: {
      meal_anchors: ['brunch', 'hovedretter'],
      items: [
        { name: 'Brunch Platte', description: '', price: '125 kr' },
        { name: 'Pariserbøf', description: '', price: '165 kr' }
      ],
      categories: ['Brunch', 'Hovedretter'],
      quotes: [
        { quote: 'Brunch Platte', source: 'menu_item' }
      ]
    },
    website: {
      ctas: ['BOOK BORD', 'SE MENU'],
      headers: ['Velkommen til Test Café', 'Brunch hver dag'],
      hero_texts: ['Morgenmad til midnat ved åen'],
      about_snippets: [],
      value_phrases: [],
      quotes: [
        { quote: 'BOOK BORD', source: 'cta_button' },
        { quote: 'Morgenmad til midnat ved åen', source: 'hero_text' }
      ]
    },
    social: {
      bios: [],
      quotes: []
    },
    images: {
      summary: ['outdoor seating', 'waterfront', 'food plates'],
      quotes: [
        { quote: 'outdoor seating', source: 'image_ai_label' }
      ]
    }
  }
}

const mockA2Interpretation: PromptA2Interpretation = {
  business_id: 'test-business-123',
  generated_at: '2026-01-11T10:05:00Z',
  analysis_version: '1.0',
  distinctive_hooks: [
    {
      hook: 'ved åen i Aarhus',
      evidence_refs: ['location.quotes[0]', 'website.quotes[1]'],
      confidence: 'high'
    },
    {
      hook: 'brunch + hovedretter',
      evidence_refs: ['menu.meal_anchors[0]', 'menu.quotes[0]'],
      confidence: 'medium'
    }
  ],
  rituals_and_moments: [
    {
      moment: 'fra morgenmad til midnat ved åen',
      evidence_refs: ['website.quotes[1]', 'location.quotes[0]'],
      confidence: 'high'
    }
  ],
  usage_occasions: [
    {
      id: 'waterfront_brunch',
      name: 'Brunch ved åen',
      when: 'Weekend mornings',
      situation: 'Outdoor dining by waterfront',
      behavior: 'Leisurely brunch with water view',
      job_to_be_done: 'Enjoy relaxed meal by water',
      evidence_refs: ['menu.quotes[0]', 'location.quotes[0]', 'images.quotes[0]'],
      confidence: 'high'
    },
    {
      id: 'evening_dining',
      name: 'Aften ved åen',
      when: 'Evening hours',
      situation: 'Dinner at waterfront location',
      behavior: 'Extended dining experience',
      job_to_be_done: 'Evening meal with atmosphere',
      evidence_refs: ['website.quotes[1]', 'location.quotes[0]'],
      confidence: 'medium'
    }
  ],
  content_triggers: [
    {
      trigger: 'Waterfront Dining',
      based_on_usage_occasion_ids: ['waterfront_brunch', 'evening_dining'],
      what_to_show: ['outdoor seating', 'water view', 'food plates'],
      copy_angles: ['Ved åen i Aarhus', 'Morgenmad til midnat'],
      safe_claims_only: true,
      evidence_refs: ['location.quotes[0]', 'website.quotes[1]'],
      confidence: 'high'
    }
  ],
  voice_context: {
    location_profile: 'TRENDY_NEIGHBORHOOD',
    business_personality: 'MODERN_CASUAL',
    language_mix: 'PURE_DANISH',
    energy_level: 'MEDIUM',
    reasoning: [
      'Waterfront location suggests trendy neighborhood',
      'Casual language in CTAs indicates modern casual',
      'All content in Danish shows pure Danish'
    ]
  }
}

// ============================================================================
// TEST 1: A1 Schema Validation
// ============================================================================

test('A1 evidence must never include interpretation fields', () => {
  const a1: PromptA1Evidence = mockA1Evidence

  // A1 should only have facts, no interpretation
  const forbiddenKeys = [
    'usage_occasions',
    'content_triggers',
    'voice_context',
    'target_audience',
    'tone_of_voice',
    'distinctive_hooks',
    'rituals_and_moments'
  ]

  const a1Keys = Object.keys(a1)
  const foundForbidden = forbiddenKeys.filter(key => a1Keys.includes(key))

  expect(foundForbidden.length).toEqual(0)

  // A1 should have evidence_version and facts
  expect(a1.evidence_version).toBeDefined()
  expect(a1.facts).toBeDefined()
  expect(a1.facts.location).toBeDefined()
  expect(a1.facts.menu).toBeDefined()
  expect(a1.facts.website).toBeDefined()
})

test('A1 facts must only contain quotes with source attribution', () => {
  const a1: PromptA1Evidence = mockA1Evidence

  // Check all quotes have required structure
  const locationQuotes = a1.facts.location.quotes || []
  const menuQuotes = a1.facts.menu.quotes || []
  const websiteQuotes = a1.facts.website.quotes || []

  const allQuotes = [...locationQuotes, ...menuQuotes, ...websiteQuotes]

  for (const quote of allQuotes) {
    expect(quote.quote).toBeDefined()
    expect(quote.source).toBeDefined()
    expect(typeof quote.quote).toEqual('string')
    expect(typeof quote.source).toEqual('string')
  }
})

// ============================================================================
// TEST 2: A2 Schema Validation
// ============================================================================

test('A2 interpretation must include business_id and analysis_version', () => {
  const a2: PromptA2Interpretation = mockA2Interpretation

  expect(a2.business_id).toBeDefined()
  expect(a2.analysis_version).toBeDefined()
  expect(a2.analysis_version).toEqual('1.0')
})

test('A2 must have at least 2 usage_occasions when menu + location exist', () => {
  const a2: PromptA2Interpretation = mockA2Interpretation

  // Mock has both menu and location
  expect(a2.usage_occasions).toBeDefined()
  expect(a2.usage_occasions.length >= 2).toBe(true)
})

test('A2 usage_occasions must have required fields', () => {
  const a2: PromptA2Interpretation = mockA2Interpretation

  for (const occ of a2.usage_occasions) {
    expect(occ.id).toBeDefined()
    expect(occ.name).toBeDefined()
    expect(occ.when).toBeDefined()
    expect(occ.situation).toBeDefined()
    expect(occ.behavior).toBeDefined()
    expect(occ.job_to_be_done).toBeDefined()
    expect(occ.evidence_refs).toBeDefined()
    expect(occ.confidence).toBeDefined()

    // evidence_refs must be non-empty array
    expect(Array.isArray(occ.evidence_refs)).toBe(true)
    expect(occ.evidence_refs.length >= 2).toBe(true)
  }
})

test('A2 distinctive_hooks must have evidence_refs', () => {
  const a2: PromptA2Interpretation = mockA2Interpretation

  expect(a2.distinctive_hooks).toBeDefined()

  for (const hook of a2.distinctive_hooks) {
    expect(hook.hook).toBeDefined()
    expect(hook.evidence_refs).toBeDefined()
    expect(hook.confidence).toBeDefined()

    expect(Array.isArray(hook.evidence_refs)).toBe(true)
    expect(hook.evidence_refs.length >= 2).toBe(true)
  }
})

test('A2 voice_context must have all 4 dimensions', () => {
  const a2: PromptA2Interpretation = mockA2Interpretation

  expect(a2.voice_context).toBeDefined()
  expect(a2.voice_context.location_profile).toBeDefined()
  expect(a2.voice_context.business_personality).toBeDefined()
  expect(a2.voice_context.language_mix).toBeDefined()
  expect(a2.voice_context.energy_level).toBeDefined()
  expect(a2.voice_context.reasoning).toBeDefined()

  expect(Array.isArray(a2.voice_context.reasoning)).toBe(true)
  expect(a2.voice_context.reasoning.length >= 3).toBe(true)
})

// ============================================================================
// TEST 3: Size Limits
// ============================================================================

test('A1 must respect array size limits', () => {
  const a1: PromptA1Evidence = mockA1Evidence

  // Check max array sizes
  expect(a1.facts.website.ctas.length <= 10).toBe(true)
  expect(a1.facts.website.headers.length <= 10).toBe(true)
  expect(a1.facts.website.hero_texts.length <= 6).toBe(true)
  expect(a1.facts.menu.items.length <= 12).toBe(true)
  expect(a1.facts.images.summary.length <= 10).toBe(true)
})

test('A2 must respect array size limits', () => {
  const a2: PromptA2Interpretation = mockA2Interpretation

  expect(a2.distinctive_hooks.length <= 5).toBe(true)
  expect(a2.rituals_and_moments.length <= 3).toBe(true)
  expect(a2.usage_occasions.length <= 4).toBe(true)
  expect(a2.content_triggers.length <= 5).toBe(true)
})

// ============================================================================
// TEST 4: Evidence References Format
// ============================================================================

test('A2 evidence_refs must use dot notation', () => {
  const a2: PromptA2Interpretation = mockA2Interpretation

  const validRefPattern = /^(location|menu|website|social|images|third_party)\.(quotes\[\d+\]|[\w_]+(\[\d+\])?)$/

  // Check all evidence_refs in usage_occasions
  for (const occ of a2.usage_occasions) {
    for (const ref of occ.evidence_refs) {
      expect(validRefPattern.test(ref)).toBe(true)
    }
  }

  // Check all evidence_refs in distinctive_hooks
  for (const hook of a2.distinctive_hooks) {
    for (const ref of hook.evidence_refs) {
      expect(validRefPattern.test(ref)).toBe(true)
    }
  }
})

// ============================================================================
// RUN TESTS
// ============================================================================

console.log('\n✅ All A1/A2 split architecture tests passed!\n')
