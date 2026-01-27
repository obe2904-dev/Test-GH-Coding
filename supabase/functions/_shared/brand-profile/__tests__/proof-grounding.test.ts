/**
 * Unit Tests for Proof Grounding (v4.9.0 Phase 2 Task D)
 * 
 * Tests the proof grounding system that validates proof[] arrays
 * against ALLOWED_PROOF_TOKENS and reference numbers.
 */

import { test, expect } from 'vitest'
import { cleanProofArray, applyProofGrounding } from '../proof-grounding.ts'
import { buildAllowedProofTokens, buildNormalizedRefs } from '../validators.ts'

test('Proof Grounding: cleanProofArray removes ungrounded proofs', () => {
  const proof = [
    'Based on menu anchor "brunch"', // Should keep (matches token)
    'Based on generic concept', // Should remove (no token match)
    'Based on location "ved åen i Aarhus"', // Should keep (matches token)
  ]

  const allowedTokens = ['brunch', 'ved åen i aarhus', 'pariserbøf']
  const normalizedRefs: string[] = []

  const result = cleanProofArray(proof, allowedTokens, normalizedRefs)

  expect(result.cleanedProof.length).toEqual(2)
  expect(result.removedLines.length).toEqual(1)
  expect(result.isGrounded).toBe(true)
  expect(result.cleanedProof[0]).toEqual('Based on menu anchor "brunch"')
  expect(result.cleanedProof[1]).toEqual('Based on location "ved åen i Aarhus"')
})

test('Proof Grounding: cleanProofArray handles reference numbers', () => {
  const proof = [
    'Based on #1 from Prompt A', // Should keep (matches ref)
    'Based on #5 from Prompt A', // Should keep (matches ref)
    'Based on generic statement', // Should remove (no match)
  ]

  const allowedTokens: string[] = []
  const normalizedRefs = ['#1', '#2', '#3', '#4', '#5']

  const result = cleanProofArray(proof, allowedTokens, normalizedRefs)

  expect(result.cleanedProof.length).toEqual(2)
  expect(result.removedLines.length).toEqual(1)
})

test('Proof Grounding: cleanProofArray handles case-insensitive matching', () => {
  const proof = [
    'Based on menu anchor "BRUNCH"', // Uppercase in proof
    'Based on menu anchor "Pariserbøf"', // Mixed case
    'Based on location "VED ÅEN"', // Uppercase location
  ]

  const allowedTokens = ['brunch', 'pariserbøf', 'ved åen'] // Lowercase tokens

  const result = cleanProofArray(proof, allowedTokens, [])

  expect(result.cleanedProof.length).toEqual(3)
  expect(result.removedLines.length).toEqual(0)
})

test('Proof Grounding: cleanProofArray returns #1 fallback when all removed', () => {
  const proof = [
    'Generic statement 1',
    'Generic statement 2',
    'Generic statement 3',
  ]

  const allowedTokens = ['brunch']
  const normalizedRefs: string[] = []

  const result = cleanProofArray(proof, allowedTokens, normalizedRefs)

  expect(result.cleanedProof.length).toEqual(0)
  expect(result.removedLines.length).toEqual(3)
  expect(result.isGrounded).toBe(false)
})

test('Proof Grounding: cleanProofArray handles empty proof array', () => {
  const proof: string[] = []
  const allowedTokens = ['brunch']

  const result = cleanProofArray(proof, allowedTokens, [])

  expect(result.cleanedProof.length).toEqual(0)
  expect(result.removedLines.length).toEqual(0)
  expect(result.isGrounded).toBe(false)
  expect(result.warnings.length).toEqual(1)
})

test('Proof Grounding: applyProofGrounding processes multiple sections', () => {
  const sections = {
    brand_essence: {
      value: 'Test',
      proof: ['Based on brunch menu', 'Generic statement'],
    },
    tone_of_voice: {
      value: 'Test',
      proof: ['Based on ved åen location', 'Another generic'],
    },
    core_offerings: {
      value: 'Test',
      proof: ['Based on pariserbøf menu item'],
    },
  }

  const allowedTokens = ['brunch', 'ved åen', 'pariserbøf']

  const result = applyProofGrounding(sections, allowedTokens, [])

  expect(result.sectionsModified).toBe(true)
  expect(result.totalRemoved).toEqual(2)
  expect(sections.brand_essence.proof.length).toEqual(1)
  expect(sections.tone_of_voice.proof.length).toEqual(1)
  expect(sections.core_offerings.proof.length).toEqual(1)
})

test('Proof Grounding: buildAllowedProofTokens extracts menu items', () => {
  const analysis = {
    signals: {
      core_offerings: {
        must_use_phrases: ['BRUNCH', 'COCKTAILS', 'PARISERBØF'],
      },
    },
  }

  const dataSources = {
    menu: [
      { name: 'Æggekage', price: 85 },
      { name: 'Bøf & Bearnaise', price: 145 },
      { name: 'Herregårdsbøf', price: 165 },
    ],
    location: {
      enrichment: {
        micro: { area_type: 'waterfront' },
        macro: { city: 'Aarhus' },
      },
    },
    websiteAnalysis: {
      cta_texts: ['LINK TO FACEBOOK', 'SE MENU'],
    },
  }

  const tokens = buildAllowedProofTokens(analysis, dataSources as any)

  // Should include: location hook, CTA, must_use_phrases, menu items, location parts
  expect(tokens.find(t => t === 'ved åen i aarhus')).toBeDefined()
  expect(tokens.find(t => t === 'brunch')).toBeDefined()
  expect(tokens.find(t => t === 'cocktails')).toBeDefined()
  expect(tokens.find(t => t === 'pariserbøf')).toBeDefined()
  expect(tokens.find(t => t === 'æggekage')).toBeDefined()
  expect(tokens.find(t => t === 'link to facebook')).toBeDefined()
})

test('Proof Grounding: buildAllowedProofTokens handles missing data gracefully', () => {
  const analysis = {
    signals: {}, // No signals
  }

  const dataSources = {
    location: null,
    menu: [],
    websiteAnalysis: null,
  }

  const tokens = buildAllowedProofTokens(analysis, dataSources as any)

  expect(tokens.length > 0).toBe(true)
  expect(Array.isArray(tokens)).toBe(true)
})

test('Proof Grounding: buildNormalizedRefs extracts reference numbers', () => {
  const analysis = {
    distinctive_hooks: [
      { hook: 'ved åen', reference: '#1' },
      { hook: 'waterfront location', reference: '#2' },
    ],
    content_triggers: [
      { trigger: 'Brunch ved vandet', reference: '#3' },
    ],
  }

  const refs = buildNormalizedRefs(analysis)

  expect(refs.includes('#1')).toBe(true)
  expect(refs.includes('#2')).toBe(true)
  expect(refs.includes('#3')).toBe(true)
  expect(refs.length >= 3).toBe(true)
})

test('Proof Grounding: Token normalization works correctly', () => {
  const proof = [
    'Based on "BRUNCH   menu"', // Extra spaces
    'Based on\t"ved   åen"', // Tabs and spaces
    'Based  on  "pariserbøf"', // Multiple spaces
  ]

  const allowedTokens = ['brunch', 'ved åen', 'pariserbøf']

  const result = cleanProofArray(proof, allowedTokens, [])

  expect(result.cleanedProof.length).toEqual(3)
  expect(result.removedLines.length).toEqual(0)
})

console.log('✅ All Proof Grounding tests passed!')
