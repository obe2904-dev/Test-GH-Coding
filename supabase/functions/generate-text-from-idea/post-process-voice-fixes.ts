// post-process-voice-fixes.ts
// Targeted voice violation fixes to avoid full regeneration
// Applies quick fixes for common violations (banned vocabulary, forbidden phrases)

interface VoiceViolation {
  type: string
  severity: 'critical' | 'warning' | 'info'
  text: string
  suggestion?: string
  rule: string
}

interface BrandProfile {
  voice?: {
    vocabulary?: {
      avoid?: string[]
      prefer?: string[]
    }
    tone_dna?: {
      tone_dont_list?: string[]
    }
  }
  guardrails?: {
    things_to_avoid?: string[]
  }
}

/**
 * Apply targeted voice fixes to text based on violations
 * Returns fixed text and list of fixes applied
 * Much faster than full regeneration for minor violations
 */
export function applyTargetedVoiceFixes(
  text: string,
  violations: VoiceViolation[],
  brandProfile: BrandProfile
): { text: string; fixesApplied: string[]; unfixable: VoiceViolation[] } {
  let fixed = text
  const fixesApplied: string[] = []
  const unfixable: VoiceViolation[] = []
  
  // ═══ FIX 1: Replace banned vocabulary with preferred alternatives ═══
  const bannedVocab = brandProfile.voice?.vocabulary?.avoid || []
  const preferVocab = brandProfile.voice?.vocabulary?.prefer || []
  
  // These are parallel arrays - banned[i] should be replaced with prefer[i]
  for (let i = 0; i < Math.min(bannedVocab.length, preferVocab.length); i++) {
    const banned = bannedVocab[i]
    const prefer = preferVocab[i]
    
    if (!prefer || !banned) continue
    
    // Case-insensitive replacement preserving original case
    const regex = new RegExp(`\\b${escapeRegex(banned)}\\b`, 'gi')
    if (regex.test(fixed)) {
      fixed = fixed.replace(regex, (match) => {
        // Preserve case of original
        if (match[0] === match[0].toUpperCase()) {
          return prefer.charAt(0).toUpperCase() + prefer.slice(1)
        }
        return prefer
      })
      fixesApplied.push(`"${banned}" → "${prefer}"`)
      console.log(`✅ [VoiceFix] Replaced banned vocab: "${banned}" → "${prefer}"`)
    }
  }
  
  // ═══ FIX 2: Replace forbidden phrases from violations with suggestions ═══
  violations
    .filter(v => v.suggestion && v.text && v.severity === 'critical')
    .forEach(v => {
      if (fixed.includes(v.text)) {
        fixed = fixed.replace(v.text, v.suggestion!)
        fixesApplied.push(`"${v.text}" → "${v.suggestion}"`)
        console.log(`✅ [VoiceFix] Applied violation suggestion: "${v.text}" → "${v.suggestion}"`)
      } else {
        // Violation text not found - might be structural issue
        unfixable.push(v)
      }
    })
  
  // ═══ FIX 3: Handle structural violations that can be fixed ═══
  violations
    .filter(v => v.severity === 'critical' && !v.suggestion)
    .forEach(v => {
      // Structural violations without suggestions are unfixable via replacement
      unfixable.push(v)
    })
  
  const totalViolations = violations.filter(v => v.severity === 'critical').length
  const successRate = totalViolations > 0 
    ? Math.round((fixesApplied.length / totalViolations) * 100) 
    : 0
  
  console.log(`[VoiceFix] Fixed ${fixesApplied.length}/${totalViolations} critical violations (${successRate}%)`)
  if (unfixable.length > 0) {
    console.warn(`[VoiceFix] ${unfixable.length} violations require regeneration:`)
    unfixable.forEach(v => console.warn(`  - ${v.type}: ${v.rule}`))
  }
  
  return { text: fixed, fixesApplied, unfixable }
}

/**
 * Escape special regex characters in string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Pre-validate text before sending to AI
 * Checks for common violations that can be prevented
 */
export function preValidatePrompt(
  promptText: string,
  brandProfile: BrandProfile
): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = []
  
  // Check prompt isn't asking AI to violate its own rules
  const bannedVocab = brandProfile.voice?.vocabulary?.avoid || []
  const foundBanned = bannedVocab.filter(banned => 
    promptText.toLowerCase().includes(banned.toLowerCase())
  )
  
  if (foundBanned.length > 0) {
    warnings.push(`Prompt contains banned vocabulary: ${foundBanned.join(', ')}`)
  }
  
  // Check prompt size (rough estimate - 4 chars per token)
  const estimatedTokens = Math.ceil(promptText.length / 4)
  if (estimatedTokens > 2500) {
    warnings.push(`Prompt very large (${estimatedTokens} tokens) - may cause truncation`)
  }
  
  return {
    isValid: warnings.length === 0,
    warnings
  }
}
