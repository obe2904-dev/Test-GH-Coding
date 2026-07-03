/**
 * Unit Tests for Location Phrase Validation
 * 
 * Tests the validation system that detects semantic mismatches between
 * stored location references and generated text.
 */

import { test, expect, describe } from 'vitest'
import { 
  validateLocationPhrase, 
  isLocationPhraseValid, 
  getValidationReport,
  type ValidationResult 
} from '../validate-location-consistency.ts'

describe('Location Phrase Validation - Critical Semantic Errors', () => {
  test('Detects "vandet" when business is at "åen" (high severity)', () => {
    const generatedText = 'Kom forbi ved vandet og nyd en dejlig brunch.'
    const storedReference = 'ved åen'

    const result = validateLocationPhrase(generatedText, storedReference, 'da')

    expect(result.valid).toBe(false)
    expect(result.errorCount).toBeGreaterThan(0)
    expect(result.violations.length).toBeGreaterThan(0)
    
    const semanticError = result.violations.find(v => v.type === 'semantic_mismatch')
    expect(semanticError).toBeDefined()
    expect(semanticError?.severity).toBe('high')
    expect(semanticError?.description).toContain('vandet')
    expect(semanticError?.description).toContain('åen')
  })

  test('Detects "havnen" when business is at "åen"', () => {
    const generatedText = 'Besøg os ved havnen i Aarhus.'
    const storedReference = 'ved åen'

    const result = validateLocationPhrase(generatedText, storedReference, 'da')

    expect(result.valid).toBe(false)
    const semanticError = result.violations.find(v => 
      v.type === 'semantic_mismatch' && v.foundPhrase.includes('havnen')
    )
    expect(semanticError).toBeDefined()
    expect(semanticError?.severity).toBe('high')
  })

  test('Detects "stranden" when business is at "åen"', () => {
    const generatedText = 'Tag på tur til stranden og smag vores menu.'
    const storedReference = 'ved åen'

    const result = validateLocationPhrase(generatedText, storedReference, 'da')

    expect(result.valid).toBe(false)
    const semanticError = result.violations.find(v => v.foundPhrase.includes('stranden'))
    expect(semanticError).toBeDefined()
  })
})

describe('Location Phrase Validation - Acceptable Cases', () => {
  test('Passes when using correct stored reference', () => {
    const generatedText = 'Besøg os ved åen i Aarhus og nyd brunch.'
    const storedReference = 'ved åen'

    const result = validateLocationPhrase(generatedText, storedReference, 'da')

    expect(result.valid).toBe(true)
    expect(result.errorCount).toBe(0)
  })

  test('Passes when "vandet" is used for open water location', () => {
    const generatedText = 'Kom ned til vandet og nyd udsigten.'
    const storedReference = 'ved vandet' // Explicitly stored as open water

    const result = validateLocationPhrase(generatedText, storedReference, 'da')

    expect(result.valid).toBe(true)
  })

  test('Passes when "havnen" is used for harbor location', () => {
    const generatedText = 'Besøg os ved havnen i København.'
    const storedReference = 'ved havnen'

    const result = validateLocationPhrase(generatedText, storedReference, 'da')

    expect(result.valid).toBe(true)
  })

  test('Allows "vandet er" (water IS) - not location reference', () => {
    const generatedText = 'Vandet er rent og klart fra kilden.'
    const storedReference = 'ved åen'

    const result = validateLocationPhrase(generatedText, storedReference, 'da')

    // Should not flag "vandet er" as a location violation
    const semanticErrors = result.violations.filter(v => v.type === 'semantic_mismatch')
    expect(semanticErrors.length).toBe(0)
  })
})

describe('Location Phrase Validation - Missing Reference Warnings', () => {
  test('Warns when stored reference not found in text', () => {
    const generatedText = 'Besøg vores café i byen.'
    const storedReference = 'ved åen'

    const result = validateLocationPhrase(generatedText, storedReference, 'da')

    const missingWarning = result.violations.find(v => v.type === 'missing_reference')
    expect(missingWarning).toBeDefined()
    expect(missingWarning?.severity).toBe('medium')
  })

  test('No warning when reference is present', () => {
    const generatedText = 'Kom forbi ved åen og nyd vores menu.'
    const storedReference = 'ved åen'

    const result = validateLocationPhrase(generatedText, storedReference, 'da')

    const missingWarning = result.violations.find(v => v.type === 'missing_reference')
    expect(missingWarning).toBeUndefined()
  })
})

describe('Location Phrase Validation - Generic Fallback Detection', () => {
  test('Warns about generic "ved vandet" when no stored reference', () => {
    const generatedText = 'Besøg os ved vandet i Aarhus.'
    const storedReference = null

    const result = validateLocationPhrase(generatedText, storedReference, 'da')

    const genericWarning = result.violations.find(v => v.type === 'generic_fallback')
    expect(genericWarning).toBeDefined()
    expect(genericWarning?.severity).toBe('low')
  })

  test('Warns when generic used instead of specific reference', () => {
    const generatedText = 'Kom ned til ved vandet og nyd brunch.'
    const storedReference = 'ved fjorden'

    const result = validateLocationPhrase(generatedText, storedReference, 'da')

    // Should have warning about generic fallback when specific reference exists
    const violations = result.violations.filter(v => 
      v.type === 'generic_fallback' || v.type === 'missing_reference'
    )
    expect(violations.length).toBeGreaterThan(0)
  })
})

describe('Location Phrase Validation - Edge Cases', () => {
  test('Handles empty generated text', () => {
    const result = validateLocationPhrase('', 'ved åen', 'da')

    expect(result.valid).toBe(true)
    expect(result.violations.length).toBe(0)
  })

  test('Handles null stored reference', () => {
    const result = validateLocationPhrase('Besøg vores café.', null, 'da')

    // Should not crash, may have warnings but no errors
    expect(result.errorCount).toBe(0)
  })

  test('Case-insensitive matching', () => {
    const generatedText = 'Kom ned til VED VANDET og nyd solnedgangen.'
    const storedReference = 'ved åen'

    const result = validateLocationPhrase(generatedText, storedReference, 'da')

    expect(result.valid).toBe(false)
    const error = result.violations.find(v => v.type === 'semantic_mismatch')
    expect(error).toBeDefined()
  })

  test('Handles multiline text', () => {
    const generatedText = `
      Besøg vores café ved vandet.
      Vi tilbyder brunch hver dag.
      Book dit bord nu.
    `
    const storedReference = 'ved åen'

    const result = validateLocationPhrase(generatedText, storedReference, 'da')

    expect(result.valid).toBe(false)
  })
})

describe('isLocationPhraseValid - Quick Check Function', () => {
  test('Returns true for valid text', () => {
    const isValid = isLocationPhraseValid('Kom forbi ved åen.', 'ved åen', 'da')
    expect(isValid).toBe(true)
  })

  test('Returns false for semantic mismatch', () => {
    const isValid = isLocationPhraseValid('Kom forbi ved vandet.', 'ved åen', 'da')
    expect(isValid).toBe(false)
  })

  test('Returns true when only warnings (no errors)', () => {
    const isValid = isLocationPhraseValid('Besøg vores café.', 'ved åen', 'da')
    // Missing reference is a warning, not an error
    expect(isValid).toBe(true)
  })
})

describe('getValidationReport - Human-Readable Output', () => {
  test('Returns success message for valid text', () => {
    const result = validateLocationPhrase('Ved åen i Aarhus.', 'ved åen', 'da')
    const report = getValidationReport(result)

    expect(report).toContain('✅')
    expect(report).toContain('passed')
  })

  test('Returns error report for semantic mismatch', () => {
    const result = validateLocationPhrase('Ved vandet i Aarhus.', 'ved åen', 'da')
    const report = getValidationReport(result)

    expect(report).toContain('❌')
    expect(report).toContain('error')
    expect(report).toContain('Expected')
    expect(report).toContain('Found')
  })

  test('Returns warning report', () => {
    const result = validateLocationPhrase('Besøg vores café.', 'ved åen', 'da')
    const report = getValidationReport(result)

    if (result.warningCount > 0) {
      expect(report).toContain('⚠️')
      expect(report).toContain('warning')
    }
  })

  test('Includes violation details in report', () => {
    const result = validateLocationPhrase('Ved vandet og havnen.', 'ved åen', 'da')
    const report = getValidationReport(result)

    expect(report).toContain('ved åen')
    expect(report).toContain('vandet')
  })
})

describe('Validation - Language Support', () => {
  test('Danish validation rules apply for da language', () => {
    const result = validateLocationPhrase('Ved vandet.', 'ved åen', 'da')
    expect(result.valid).toBe(false)
  })

  test('Defaults to Danish when language not specified', () => {
    const result = validateLocationPhrase('Ved vandet.', 'ved åen')
    // Default is 'da', so should apply Danish rules
    expect(result.valid).toBe(false)
  })

  test('Gracefully handles unsupported languages', () => {
    const result = validateLocationPhrase('By the water.', 'by the river', 'en')
    // Should not crash, may not have language-specific rules
    expect(result).toBeDefined()
    expect(result.violations).toBeDefined()
  })
})

describe('Real-World Validation Scenarios', () => {
  test('User reported issue: Aarhus café generating "vandet" text', () => {
    // Exact scenario from user report
    const brandEssence = 'Hyggelig café ved vandet i Aarhus med focus på brunch.'
    const storedReference = 'ved åen'

    const result = validateLocationPhrase(brandEssence, storedReference, 'da')

    expect(result.valid).toBe(false)
    expect(result.errorCount).toBeGreaterThan(0)
    
    const error = result.violations.find(v => v.type === 'semantic_mismatch')
    expect(error?.description.toLowerCase()).toContain('semantic error')
    expect(error?.description).toContain('river')
  })

  test('Signature shot with wrong water term', () => {
    const signatureShot = 'Et bord ved vandet i gyldent aftenlys, hvor man bliver siddende længe.'
    const storedReference = 'ved åen'

    const result = validateLocationPhrase(signatureShot, storedReference, 'da')

    expect(result.valid).toBe(false)
    expect(result.violations.some(v => 
      v.type === 'semantic_mismatch' && v.severity === 'high'
    )).toBe(true)
  })

  test('Content pillar notes with correct reference', () => {
    const pillarNotes = 'Stedet ligger direkte ved åen — atmosfærebilleder af lyset ved terrassen.'
    const storedReference = 'ved åen'

    const result = validateLocationPhrase(pillarNotes, storedReference, 'da')

    expect(result.valid).toBe(true)
    expect(result.errorCount).toBe(0)
  })
})
