/**
 * Proof Grounding Consistency (v4.9.0 Phase 2 Task D)
 * 
 * Ensures proof[] arrays only reference ALLOWED_PROOF_TOKENS or real evidence from Prompt A.
 * Removes vague/generic proof lines that don't cite specific hooks, menu items, or location phrases.
 * 
 * Problem: AI sometimes writes proof like "Based on the waterfront location" instead of citing
 * the actual token "ved åen i Aarhus". This makes proof[] less grounded and harder to verify.
 * 
 * Solution: Post-pass filter that validates each proof line contains at least one allowed token.
 */

interface ProofGroundingResult {
  originalProof: string[]
  cleanedProof: string[]
  removedLines: string[]
  warnings: string[]
  isGrounded: boolean
}

const normalize = (s: string): string => s.toLowerCase().trim().replace(/\s+/g, ' ')

/**
 * Check if a proof line references at least one allowed token
 * 
 * Note: allowedTokens and normalizedRefs are already normalized by caller
 */
function isProofLineGrounded(
  line: string,
  allowedTokens: string[],
  normalizedRefs: string[]
): boolean {
  const normalizedLine = normalize(line)
  
  // Check against allowed tokens (already normalized, don't normalize again)
  const hasAllowedToken = allowedTokens.some(token => 
    normalizedLine.includes(token)
  )
  
  // Check against Prompt A reference numbers (already normalized)
  const hasRefNumber = normalizedRefs.some(ref => 
    normalizedLine.includes(ref)
  )
  
  // Debug logging for failed matches
  if (!hasAllowedToken && !hasRefNumber) {
    console.log('🔍 Proof grounding DEBUG - Ungrounded line:', {
      originalLine: line,
      normalizedLine,
      allowedTokensSample: allowedTokens.slice(0, 5),
      normalizedRefsSample: normalizedRefs.slice(0, 5)
    })
  }
  
  return hasAllowedToken || hasRefNumber
}

/**
 * Clean a proof array by removing ungrounded lines
 * 
 * v4.10.0 Phase 1: Ensures at least 1 evidence line remains per field
 */
export function cleanProofArray(
  proof: string[],
  allowedTokens: string[],
  normalizedRefs: string[],
  fieldName?: string
): ProofGroundingResult {
  const warnings: string[] = []
  const removedLines: string[] = []
  const cleanedProof: string[] = []
  
  if (!Array.isArray(proof) || proof.length === 0) {
    return {
      originalProof: proof || [],
      cleanedProof: [],
      removedLines: [],
      warnings: ['Proof array is empty or invalid'],
      isGrounded: false
    }
  }
  
  for (const line of proof) {
    if (typeof line !== 'string' || line.trim().length === 0) {
      removedLines.push(line)
      warnings.push('Removed empty or non-string proof line')
      continue
    }
    
    if (isProofLineGrounded(line, allowedTokens, normalizedRefs)) {
      cleanedProof.push(line)
    } else {
      removedLines.push(line)
      warnings.push(`Removed ungrounded proof: "${line.slice(0, 60)}${line.length > 60 ? '...' : ''}"`)
    }
  }
  
  // v4.10.0 Phase 1: Ensure at least 1 evidence line remains per field
  if (cleanedProof.length === 0 && allowedTokens.length > 0 && fieldName) {
    const bestToken = allowedTokens[0]
    const evidenceLine = `Evidence: "${bestToken}" (source: business data)`
    cleanedProof.push(evidenceLine)
    warnings.push(`Added minimal evidence line for ${fieldName} (all proofs removed)`)
  }
  
  return {
    originalProof: proof,
    cleanedProof,
    removedLines,
    warnings,
    isGrounded: cleanedProof.length > 0
  }
}

/**
 * Apply proof grounding to all sections in brand profile
 */
export function applyProofGrounding(
  sections: any,
  allowedTokens: string[],
  normalizedRefs: string[]
): {
  sectionsModified: boolean
  totalRemoved: number
  fieldResults: Record<string, ProofGroundingResult>
} {
  const fieldsWithProof = [
    'brand_essence',
    'tone_of_voice',
    'things_to_avoid',
    'target_audience',
    'core_offerings',
    'content_focus',
    'cta_style',
    'communication_goal'
  ]
  
  let totalRemoved = 0
  let sectionsModified = false
  const fieldResults: Record<string, ProofGroundingResult> = {}
  
  for (const field of fieldsWithProof) {
    const section = sections?.[field]
    if (!section || typeof section !== 'object') continue
    
    const proof = section.proof
    if (!Array.isArray(proof) || proof.length === 0) continue
    
    const result = cleanProofArray(proof, allowedTokens, normalizedRefs)
    fieldResults[field] = result
    
    if (result.removedLines.length > 0) {
      // Update section with cleaned proof
      sections[field] = {
        ...section,
        proof: result.cleanedProof.length > 0 
          ? result.cleanedProof 
          : ['#1'] // Fallback to generic reference if all removed
      }
      totalRemoved += result.removedLines.length
      sectionsModified = true
    }
  }
  
  return {
    sectionsModified,
    totalRemoved,
    fieldResults
  }
}

/**
 * Log proof grounding results
 */
export function logProofGroundingResults(
  results: {
    sectionsModified: boolean
    totalRemoved: number
    fieldResults: Record<string, ProofGroundingResult>
  },
  requestId: string
): void {
  if (!results.sectionsModified) {
    console.log(`[${requestId}] ✅ Proof grounding: All proofs are well-grounded`)
    return
  }
  
  console.log(`[${requestId}] 🧹 Proof grounding: Cleaned ${results.totalRemoved} ungrounded proof lines`)
  
  for (const [field, result] of Object.entries(results.fieldResults)) {
    if (result.removedLines.length === 0) continue
    
    console.log(`  • ${field}: ${result.originalProof.length} → ${result.cleanedProof.length} lines`)
    result.warnings.forEach(warning => {
      console.log(`    ⚠️ ${warning}`)
    })
  }
}

/**
 * Check if brand_essence dish keywords match proof citations
 * 
 * Example: If brand_essence mentions "pariserbøf", proof should cite "PARISERBØF" from allowed tokens.
 */
export function validateDishKeywordsInProof(
  brandEssence: { value: string; proof: string[] },
  allowedTokens: string[]
): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = []
  const essenceValue = normalize(brandEssence.value || '')
  const proofText = normalize(brandEssence.proof?.join(' ') || '')
  
  // Extract dish-related keywords from allowed tokens (uppercase items are usually menu items)
  const dishTokens = allowedTokens.filter(token => 
    token === token.toUpperCase() && token.length > 3 && !token.startsWith('BOOK')
  )
  
  for (const dishToken of dishTokens) {
    const normalizedDish = normalize(dishToken)
    
    // If brand_essence mentions this dish, proof should cite it
    if (essenceValue.includes(normalizedDish) && !proofText.includes(normalizedDish)) {
      warnings.push(
        `brand_essence mentions "${dishToken}" but proof doesn't cite it from allowed tokens`
      )
    }
  }
  
  return {
    isValid: warnings.length === 0,
    warnings
  }
}
