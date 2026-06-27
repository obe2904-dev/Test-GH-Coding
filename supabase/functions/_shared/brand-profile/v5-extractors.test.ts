/**
 * Unit Tests for V5 Extractors
 * 
 * Test coverage:
 * - V5 data extraction (preferred path)
 * - Legacy fallback (when V5 missing)
 * - Mixed data (some V5, some legacy)
 * - Edge cases (null, malformed, empty)
 * - Type validation
 * 
 * Run: deno test v5-extractors.test.ts
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import {
  extractBrandEssence,
  extractPositioning,
  extractCoreValues,
  extractUSP,
  extractToneRules,
  extractVoiceRationale,
  extractFormalityLevel,
  extractEmojiUsage,
  extractGoodExamples,
  extractVoiceGuardrails,
  extractLocationNarrative,
  extractAudienceSegments,
  extractIdentityConfiguration,
  extractVoiceConfiguration,
  hasV5Data,
  hasV5Identity,
  hasV5Voice,
  getV5DiagnosticReport
} from './v5-extractors.ts'

// ============================================================================
// MOCK DATA FIXTURES
// ============================================================================

const mockV5Profile = {
  business_id: 'test-v5-business',
  brand_profile_v5: {
    identity: {
      brand_essence: 'V5 Brand Essence: Authentic neighborhood café',
      positioning: 'V5 Positioning: Local coffee destination',
      core_values: ['Quality', 'Community', 'Sustainability'],
      what_makes_us_different: 'V5 USP: House-roasted beans',
      identity_reasoning: 'V5 identity based on menu and location'
    },
    voice: {
      tone_rules: [
        'V5 Rule: Use warm, welcoming language',
        'V5 Rule: Keep it conversational'
      ],
      voice_reasoning: 'V5 Voice: Friendly neighborhood tone',
      formality_level: 'casual',
      emoji_usage: 'minimal',
      sentence_structure: 'short'
    },
    writing_examples: {
      good_examples: [
        'V5 Example: Kaffen er lige brygget ☕',
        'V5 Example: Vi ses i morgen!'
      ],
      avoid_examples: [
        'V5 Avoid: Discount!',
        'V5 Avoid: Buy now!'
      ]
    },
    guardrails: {
      forbidden_phrases: ['Ingen Black Friday', 'Ingen discount-talk'],
      forbidden_topics: ['Politik'],
      seasonal_notes: ['Undgå jul i oktober']
    },
    layer_0_intelligence: {
      geographic_context: {
        city: 'Copenhagen',
        area_type: 'urban_center',
        narrative: 'V5 Location: Vibrant Vesterbro neighborhood'
      }
    },
    layer_4_audiences: [
      { segment: 'V5 Morning Commuters', priority: 'high' }
    ]
  },
  // Legacy columns (should be ignored when V5 exists)
  brand_essence: 'Legacy Brand Essence',
  positioning: 'Legacy Positioning',
  core_values: ['Legacy Value 1'],
  voice_rationale: 'Legacy Voice Rationale'
}

const mockLegacyProfile = {
  business_id: 'test-legacy-business',
  brand_profile_v5: null, // No V5 data
  
  // JSONB legacy format
  brand_essence: { value: 'Legacy JSONB Brand Essence' },
  positioning: { value: 'Legacy JSONB Positioning' },
  core_values: { value: ['Legacy Quality', 'Legacy Service'] },
  
  // Tone model format
  tone_model: {
    writing_rules: [
      'Legacy Rule: Be professional',
      'Legacy Rule: Stay on brand'
    ],
    good_examples: [
      'Legacy Example: Good morning!',
      'Legacy Example: See you soon'
    ]
  },
  
  voice_rationale: { value: 'Legacy voice explanation' },
  
  // Array formats
  things_to_avoid: ['Legacy avoid 1', 'Legacy avoid 2'],
  voice_constraints: ['Legacy constraint 1'],
  
  audience_segments: [
    { segment: 'Legacy Lunch Crowd', priority: 'medium' }
  ]
}

const mockMixedProfile = {
  business_id: 'test-mixed-business',
  brand_profile_v5: {
    identity: {
      brand_essence: 'V5 Mixed Essence',
      // positioning missing in V5
      core_values: ['V5 Mixed Value']
    },
    voice: {
      tone_rules: ['V5 Mixed Rule']
      // voice_reasoning missing
    }
  },
  
  // Legacy fallbacks
  positioning: 'Legacy Mixed Positioning',
  voice_rationale: 'Legacy Mixed Rationale',
  core_values: ['Legacy Mixed Value']
}

const mockEmptyProfile = {
  business_id: 'test-empty-business',
  brand_profile_v5: null,
  brand_essence: null,
  positioning: null,
  core_values: null
}

const mockFlattenedV5Profile = {
  business_id: 'test-flattened-business',
  brand_profile_v5: {
    identity: { brand_essence: 'V5 Essence' }
  },
  
  // Flattened V5 columns (should be preferred for these)
  enhanced_social_examples: [
    'Flattened Example 1',
    'Flattened Example 2'
  ],
  voice_guardrails: [
    'Flattened Guardrail 1',
    'Flattened Guardrail 2'
  ],
  strategic_audience_segments: [
    { segment: 'Flattened Audience', priority: 'high' }
  ]
}

// ============================================================================
// TYPE GUARD TESTS
// ============================================================================

Deno.test('hasV5Data - detects V5 presence', () => {
  assertEquals(hasV5Data(mockV5Profile), true)
  assertEquals(hasV5Data(mockLegacyProfile), false)
  assertEquals(hasV5Data(mockEmptyProfile), false)
  assertEquals(hasV5Data(null), false)
  assertEquals(hasV5Data({}), false)
})

Deno.test('hasV5Identity - detects V5 identity layer', () => {
  assertEquals(hasV5Identity(mockV5Profile), true)
  assertEquals(hasV5Identity(mockLegacyProfile), false)
  assertEquals(hasV5Identity(mockMixedProfile), true)
})

Deno.test('hasV5Voice - detects V5 voice layer', () => {
  assertEquals(hasV5Voice(mockV5Profile), true)
  assertEquals(hasV5Voice(mockLegacyProfile), false)
  assertEquals(hasV5Voice(mockMixedProfile), true)
})

// ============================================================================
// IDENTITY FIELD EXTRACTION TESTS
// ============================================================================

Deno.test('extractBrandEssence - V5 preferred', () => {
  const result = extractBrandEssence(mockV5Profile)
  assertEquals(result, 'V5 Brand Essence: Authentic neighborhood café')
})

Deno.test('extractBrandEssence - legacy JSONB fallback', () => {
  const result = extractBrandEssence(mockLegacyProfile)
  assertEquals(result, 'Legacy JSONB Brand Essence')
})

Deno.test('extractBrandEssence - empty returns empty string', () => {
  const result = extractBrandEssence(mockEmptyProfile)
  assertEquals(result, '')
})

Deno.test('extractPositioning - V5 preferred', () => {
  const result = extractPositioning(mockV5Profile)
  assertEquals(result, 'V5 Positioning: Local coffee destination')
})

Deno.test('extractPositioning - legacy fallback', () => {
  const result = extractPositioning(mockLegacyProfile)
  assertEquals(result, 'Legacy JSONB Positioning')
})

Deno.test('extractPositioning - falls back to brand_essence if missing', () => {
  const profile = {
    brand_profile_v5: {
      identity: {
        brand_essence: 'Essence used as positioning'
        // positioning missing
      }
    }
  }
  const result = extractPositioning(profile)
  assertEquals(result, 'Essence used as positioning')
})

Deno.test('extractCoreValues - V5 preferred', () => {
  const result = extractCoreValues(mockV5Profile)
  assertEquals(result, ['Quality', 'Community', 'Sustainability'])
})

Deno.test('extractCoreValues - legacy JSONB fallback', () => {
  const result = extractCoreValues(mockLegacyProfile)
  assertEquals(result, ['Legacy Quality', 'Legacy Service'])
})

Deno.test('extractCoreValues - returns empty array if missing', () => {
  const result = extractCoreValues(mockEmptyProfile)
  assertEquals(result, [])
})

Deno.test('extractCoreValues - filters out non-string values', () => {
  const profile = {
    brand_profile_v5: {
      identity: {
        core_values: ['Valid', '', null, 'Also Valid', 123]
      }
    }
  }
  const result = extractCoreValues(profile)
  assertEquals(result, ['Valid', 'Also Valid'])
})

Deno.test('extractUSP - V5 preferred', () => {
  const result = extractUSP(mockV5Profile)
  assertEquals(result, 'V5 USP: House-roasted beans')
})

// ============================================================================
// VOICE FIELD EXTRACTION TESTS
// ============================================================================

Deno.test('extractToneRules - V5 preferred', () => {
  const result = extractToneRules(mockV5Profile)
  assertEquals(result.length, 2)
  assertEquals(result[0], 'V5 Rule: Use warm, welcoming language')
})

Deno.test('extractToneRules - legacy tone_model fallback', () => {
  const result = extractToneRules(mockLegacyProfile)
  assertEquals(result.length, 2)
  assertEquals(result[0], 'Legacy Rule: Be professional')
})

Deno.test('extractVoiceRationale - V5 preferred', () => {
  const result = extractVoiceRationale(mockV5Profile)
  assertEquals(result, 'V5 Voice: Friendly neighborhood tone')
})

Deno.test('extractVoiceRationale - legacy fallback', () => {
  const result = extractVoiceRationale(mockLegacyProfile)
  assertEquals(result, 'Legacy voice explanation')
})

Deno.test('extractFormalityLevel - V5 extraction', () => {
  const result = extractFormalityLevel(mockV5Profile)
  assertEquals(result, 'casual')
})

Deno.test('extractFormalityLevel - default when missing', () => {
  const result = extractFormalityLevel(mockLegacyProfile)
  assertEquals(result, 'casual')
})

Deno.test('extractEmojiUsage - V5 extraction', () => {
  const result = extractEmojiUsage(mockV5Profile)
  assertEquals(result, 'minimal')
})

Deno.test('extractGoodExamples - flattened column preferred', () => {
  const result = extractGoodExamples(mockFlattenedV5Profile)
  assertEquals(result.length, 2)
  assertEquals(result[0], 'Flattened Example 1')
})

Deno.test('extractGoodExamples - V5 fallback when no flattened', () => {
  const result = extractGoodExamples(mockV5Profile)
  assertEquals(result.length, 2)
  assertEquals(result[0], 'V5 Example: Kaffen er lige brygget ☕')
})

Deno.test('extractGoodExamples - legacy tone_model fallback', () => {
  const result = extractGoodExamples(mockLegacyProfile)
  assertEquals(result.length, 2)
  assertEquals(result[0], 'Legacy Example: Good morning!')
})

// ============================================================================
// GUARDRAILS EXTRACTION TESTS
// ============================================================================

Deno.test('extractVoiceGuardrails - flattened preferred', () => {
  const result = extractVoiceGuardrails(mockFlattenedV5Profile)
  assertEquals(result.length, 2)
  assertEquals(result[0], 'Flattened Guardrail 1')
})

Deno.test('extractVoiceGuardrails - V5 combined guardrails', () => {
  const result = extractVoiceGuardrails(mockV5Profile)
  // Should combine forbidden_phrases + forbidden_topics + seasonal_notes
  assertEquals(result.length >= 4, true)
  assertEquals(result.includes('Ingen Black Friday'), true)
  assertEquals(result.includes('Politik'), true)
})

Deno.test('extractVoiceGuardrails - legacy arrays combined', () => {
  const result = extractVoiceGuardrails(mockLegacyProfile)
  // Should combine things_to_avoid + voice_constraints
  assertEquals(result.length, 3)
  assertEquals(result.includes('Legacy avoid 1'), true)
  assertEquals(result.includes('Legacy constraint 1'), true)
})

// ============================================================================
// LOCATION EXTRACTION TESTS
// ============================================================================

Deno.test('extractLocationNarrative - V5 preferred', () => {
  const result = extractLocationNarrative(mockV5Profile)
  assertEquals(result, 'V5 Location: Vibrant Vesterbro neighborhood')
})

// ============================================================================
// AUDIENCE EXTRACTION TESTS
// ============================================================================

Deno.test('extractAudienceSegments - flattened preferred', () => {
  const result = extractAudienceSegments(mockFlattenedV5Profile)
  assertEquals(result.length, 1)
  assertEquals(result[0].segment, 'Flattened Audience')
})

Deno.test('extractAudienceSegments - V5 fallback', () => {
  const result = extractAudienceSegments(mockV5Profile)
  assertEquals(result.length, 1)
  assertEquals(result[0].segment, 'V5 Morning Commuters')
})

Deno.test('extractAudienceSegments - legacy fallback', () => {
  const result = extractAudienceSegments(mockLegacyProfile)
  assertEquals(result.length, 1)
  assertEquals(result[0].segment, 'Legacy Lunch Crowd')
})

// ============================================================================
// COMBINED EXTRACTOR TESTS
// ============================================================================

Deno.test('extractIdentityConfiguration - returns complete object', () => {
  const result = extractIdentityConfiguration(mockV5Profile)
  
  assertExists(result.brand_essence)
  assertExists(result.positioning)
  assertEquals(Array.isArray(result.core_values), true)
  assertExists(result.usp)
  
  assertEquals(result.brand_essence, 'V5 Brand Essence: Authentic neighborhood café')
  assertEquals(result.core_values.length, 3)
})

Deno.test('extractVoiceConfiguration - returns complete object', () => {
  const result = extractVoiceConfiguration(mockV5Profile)
  
  assertEquals(Array.isArray(result.tone_rules), true)
  assertExists(result.formality_level)
  assertExists(result.emoji_usage)
  assertEquals(Array.isArray(result.good_examples), true)
  assertEquals(Array.isArray(result.guardrails), true)
  
  assertEquals(result.tone_rules.length, 2)
  assertEquals(result.formality_level, 'casual')
})

// ============================================================================
// MIXED DATA TESTS (V5 + Legacy)
// ============================================================================

Deno.test('Mixed profile - uses V5 when available', () => {
  const essence = extractBrandEssence(mockMixedProfile)
  assertEquals(essence, 'V5 Mixed Essence')
})

Deno.test('Mixed profile - falls back to legacy when V5 missing', () => {
  const positioning = extractPositioning(mockMixedProfile)
  assertEquals(positioning, 'Legacy Mixed Positioning')
})

Deno.test('Mixed profile - tone_rules from V5, rationale from legacy', () => {
  const rules = extractToneRules(mockMixedProfile)
  const rationale = extractVoiceRationale(mockMixedProfile)
  
  assertEquals(rules[0], 'V5 Mixed Rule')
  assertEquals(rationale, 'Legacy Mixed Rationale')
})

// ============================================================================
// DIAGNOSTIC REPORT TESTS
// ============================================================================

Deno.test('getV5DiagnosticReport - V5 profile', () => {
  const report = getV5DiagnosticReport(mockV5Profile)
  
  assertEquals(report.has_v5_data, true)
  assertEquals(report.has_v5_identity, true)
  assertEquals(report.has_v5_voice, true)
  assertEquals(report.extraction_sources.brand_essence, 'V5')
  assertEquals(report.extraction_sources.positioning, 'V5')
})

Deno.test('getV5DiagnosticReport - legacy profile', () => {
  const report = getV5DiagnosticReport(mockLegacyProfile)
  
  assertEquals(report.has_v5_data, false)
  assertEquals(report.has_v5_identity, false)
  assertEquals(report.extraction_sources.brand_essence, 'LEGACY')
  assertEquals(report.extraction_sources.tone_rules, 'LEGACY')
})

Deno.test('getV5DiagnosticReport - empty profile', () => {
  const report = getV5DiagnosticReport(mockEmptyProfile)
  
  assertEquals(report.has_v5_data, false)
  assertEquals(report.extraction_sources.brand_essence, 'NONE')
  assertEquals(report.extraction_sources.positioning, 'NONE')
})

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

Deno.test('Edge case - null profile', () => {
  const essence = extractBrandEssence(null)
  assertEquals(essence, '')
})

Deno.test('Edge case - undefined profile', () => {
  const essence = extractBrandEssence(undefined)
  assertEquals(essence, '')
})

Deno.test('Edge case - empty object', () => {
  const essence = extractBrandEssence({})
  assertEquals(essence, '')
})

Deno.test('Edge case - malformed V5 structure', () => {
  const profile = {
    brand_profile_v5: {
      identity: 'not an object' // malformed
    }
  }
  const essence = extractBrandEssence(profile)
  assertEquals(essence, '')
})

Deno.test('Edge case - array contains empty strings', () => {
  const profile = {
    brand_profile_v5: {
      voice: {
        tone_rules: ['Valid rule', '', '  ', 'Another valid rule', null]
      }
    }
  }
  const rules = extractToneRules(profile)
  assertEquals(rules.length, 2)
  assertEquals(rules[0], 'Valid rule')
  assertEquals(rules[1], 'Another valid rule')
})

// ============================================================================
// BACKWARD COMPATIBILITY TESTS
// ============================================================================

Deno.test('Backward compatibility - old JSONB {value: "..."} format', () => {
  const profile = {
    brand_essence: { value: 'Old JSONB format' },
    positioning: { value: 'Also old format' }
  }
  
  const essence = extractBrandEssence(profile)
  const positioning = extractPositioning(profile)
  
  assertEquals(essence, 'Old JSONB format')
  assertEquals(positioning, 'Also old format')
})

Deno.test('Backward compatibility - plain text columns', () => {
  const profile = {
    brand_essence: 'Plain text essence',
    positioning: 'Plain text positioning'
  }
  
  const essence = extractBrandEssence(profile)
  const positioning = extractPositioning(profile)
  
  assertEquals(essence, 'Plain text essence')
  assertEquals(positioning, 'Plain text positioning')
})

console.log('✅ All V5 extractor tests defined')
