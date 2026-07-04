/**
 * Location Phrase Validation
 * 
 * Detects semantic inconsistencies between stored location references
 * and generated text, preventing cultural/semantic errors.
 * 
 * Primary use case: Prevent "vandet" (open water/sea) when business
 * is at "åen" (river/stream) - semantically wrong in Danish.
 */

export interface LocationViolation {
  type: 'semantic_mismatch' | 'missing_reference' | 'generic_fallback'
  severity: 'high' | 'medium' | 'low'
  description: string
  expectedPhrase: string
  foundPhrase: string
  position?: number  // Character position in text where violation occurs
}

export interface ValidationResult {
  valid: boolean
  violations: LocationViolation[]
  warningCount: number
  errorCount: number
}

/**
 * Validate that generated text respects stored location references.
 * 
 * @param generatedText - Text to validate
 * @param storedReference - Stored local_location_reference (from businesses or location_intelligence)
 * @param language - Language code for language-specific rules (default: 'da')
 * @returns Validation result with any violations found
 */
export function validateLocationPhrase(
  generatedText: string,
  storedReference: string | null,
  language: string = 'da'
): ValidationResult {
  const violations: LocationViolation[] = []
  
  if (!generatedText) {
    return {
      valid: true,
      violations: [],
      warningCount: 0,
      errorCount: 0
    }
  }
  
  if (!storedReference) {
    // No stored reference - check for generic fallbacks that might be wrong
    if (language === 'da') {
      const genericMatch = generatedText.match(/\bved vandet\b/i)
      if (genericMatch) {
        violations.push({
          type: 'generic_fallback',
          severity: 'low',
          description: 'Generic "ved vandet" used without stored reference - may be incorrect for river locations',
          expectedPhrase: '[specific water body reference]',
          foundPhrase: 'ved vandet',
          position: genericMatch.index
        })
      }
    }
  } else {
    // We have a stored reference - validate consistency
    const ref = storedReference.toLowerCase().trim()
    const text = generatedText.toLowerCase()
    
    // Extract the core water body term from reference
    const riverTerms = ['åen', 'å', 'bækken', 'bæk', 'kanalen', 'kanal', 'strømmen']
    const openWaterTerms = ['havnen', 'havn', 'stranden', 'strand', 'søen', 'sø', 'vandet', 'havet', 'hav', 'fjorden', 'fjord']
    
    const hasRiverReference = riverTerms.some(term => ref.includes(term))
    const hasOpenWaterReference = openWaterTerms.some(term => ref.includes(term))
    
    // Danish-specific validation
    if (language === 'da') {
      // Critical error: "vandet" used when reference specifies river
      if (hasRiverReference) {
        const vandetMatch = text.match(/\bved vandet\b|\bpå vandet\b|\bvandet\b(?! er)/i)
        if (vandetMatch) {
          violations.push({
            type: 'semantic_mismatch',
            severity: 'high',
            description: `Semantic error: "vandet" (open water/sea) used when business is at "${storedReference}" (river/stream). In Danish, "vandet" implies sea/harbor, not river.`,
            expectedPhrase: storedReference,
            foundPhrase: vandetMatch[0],
            position: vandetMatch.index
          })
        }
        
        // Also check for other open water terms that don't match
        const wrongTerms = ['havnen', 'stranden', 'søen', 'havet', 'kysten']
        wrongTerms.forEach(wrongTerm => {
          if (text.includes(wrongTerm) && !ref.includes(wrongTerm)) {
            const match = text.indexOf(wrongTerm)
            violations.push({
              type: 'semantic_mismatch',
              severity: 'high',
              description: `Wrong water body: "${wrongTerm}" used when business is at "${storedReference}"`,
              expectedPhrase: storedReference,
              foundPhrase: wrongTerm,
              position: match
            })
          }
        })
      }
      
      // Medium warning: Generic term when specific reference exists
      if (text.includes('ved vandet') && !ref.includes('vandet')) {
        const match = text.indexOf('ved vandet')
        violations.push({
          type: 'generic_fallback',
          severity: 'medium',
          description: `Generic "ved vandet" used instead of specific reference "${storedReference}"`,
          expectedPhrase: storedReference,
          foundPhrase: 'ved vandet',
          position: match
        })
      }
      
      // Check if stored reference appears in text at all
      const refCore = ref.replace(/^(ved|i|på|langs|nær|tæt på)\s+/, '')
      if (!text.includes(refCore)) {
        violations.push({
          type: 'missing_reference',
          severity: 'medium',
          description: `Stored location reference "${storedReference}" not found in generated text`,
          expectedPhrase: storedReference,
          foundPhrase: '[not found]'
        })
      }
    }
  }
  
  const errorCount = violations.filter(v => v.severity === 'high').length
  const warningCount = violations.filter(v => v.severity === 'medium' || v.severity === 'low').length
  
  return {
    valid: errorCount === 0,
    violations,
    warningCount,
    errorCount
  }
}

/**
 * Quick check - returns true if validation passes (no high-severity violations).
 */
export function isLocationPhraseValid(
  generatedText: string,
  storedReference: string | null,
  language: string = 'da'
): boolean {
  const result = validateLocationPhrase(generatedText, storedReference, language)
  return result.valid
}

/**
 * Get human-readable validation report.
 */
export function getValidationReport(result: ValidationResult): string {
  if (result.valid && result.violations.length === 0) {
    return '✅ Location phrase validation passed'
  }
  
  const lines: string[] = []
  
  if (result.errorCount > 0) {
    lines.push(`❌ ${result.errorCount} critical error(s) found:`)
    result.violations
      .filter(v => v.severity === 'high')
      .forEach(v => {
        lines.push(`  - ${v.description}`)
        lines.push(`    Expected: "${v.expectedPhrase}"`)
        lines.push(`    Found: "${v.foundPhrase}"`)
      })
  }
  
  if (result.warningCount > 0) {
    lines.push(`⚠️  ${result.warningCount} warning(s):`)
    result.violations
      .filter(v => v.severity !== 'high')
      .forEach(v => {
        lines.push(`  - ${v.description}`)
      })
  }
  
  return lines.join('\n')
}
