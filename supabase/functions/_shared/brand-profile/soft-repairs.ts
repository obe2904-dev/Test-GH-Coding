/**
 * Soft Validation and Deterministic Repairs
 * 
 * Phase 1, Task B: Soft validation with auto-repair (v4.9.0)
 * 
 * Separates "hard" errors (must block save) from "soft" errors (auto-repair and continue).
 * Implements deterministic repairs for common quality issues.
 */

import type { BrandProfile } from './types.ts'

export interface RepairResult {
  repaired: boolean
  repairs: string[]
  warnings: string[]
}

/**
 * Classifies an error as "hard" (must block) or "soft" (can repair).
 * 
 * Hard errors:
 * - Type mismatches
 * - Missing required fields
 * - Enum violations
 * - DB constraint risks
 * - Unparseable JSON
 * - Security/compliance issues
 * 
 * Soft errors:
 * - Empty notes/optional strings
 * - Word choices/banned generic words
 * - Minor structural issues
 */
export function isHardError(error: string): boolean {
  const hardPatterns = [
    // Type mismatches
    /must be (an? )?(string|number|boolean|array|object)/i,
    /expected.*but got/i,
    /wrong type/i,
    /invalid type/i,
    
    // Missing required fields
    /missing required/i,
    /field.*required/i,
    /(^|")(\w+)" is required/i,
    
    // Enum violations (unless we have mapping)
    /invalid enum/i,
    /not in allowed set/i,
    /must be one of:/i,
    
    // DB constraints
    /violates.*constraint/i,
    /db.*error/i,
    /unique constraint/i,
    
    // Unparseable
    /invalid json/i,
    /parse error/i,
    /malformed/i,
    
    // Critical structural issues
    /missing "value"/i,
    /missing "proof"/i,
    /must be an object.*value.*proof/i
  ]
  
  return hardPatterns.some(pattern => pattern.test(error))
}

/**
 * Attempts to deterministically repair soft errors in the brand profile.
 * 
 * Returns updated profile and list of repairs made.
 */
export function applySoftRepairs(
  profile: BrandProfile,
  errors: string[]
): RepairResult {
  const repairs: string[] = []
  const warnings: string[] = []
  let repaired = false
  
  const softErrors = errors.filter(e => !isHardError(e))
  
  if (softErrors.length === 0) {
    return { repaired: false, repairs: [], warnings: [] }
  }
  
  // Repair 1: Empty content_pillars notes
  if (profile.content_pillars && Array.isArray(profile.content_pillars)) {
    profile.content_pillars.forEach((pillar, idx) => {
      if (pillar && typeof pillar === 'object' && 'notes' in pillar) {
        if (!pillar.notes || pillar.notes.trim() === '') {
          pillar.notes = 'Neutral pillar: allowed but not a priority for this business.'
          repairs.push(`content_pillars[${idx}].notes: filled empty notes with neutral default`)
          repaired = true
        }
      }
    })
  }
  
  // Repair 2: Replace "gæster" in communication_goal and other fields
  const replaceGaester = (text: string | undefined): string | undefined => {
    if (!text) return text
    const before = text
    // Replace "gæster" with "folk" or remove subject
    const after = text
      .replace(/\bgæster\b/gi, 'folk')
      .replace(/\bguests\b/gi, 'people')
    return before !== after ? after : text
  }
  
  // Apply to communication_goal
  if (profile.communication_goal && typeof profile.communication_goal === 'object' && 'value' in profile.communication_goal) {
    const before = profile.communication_goal.value
    profile.communication_goal.value = replaceGaester(profile.communication_goal.value)
    if (profile.communication_goal.value !== before) {
      repairs.push('communication_goal: replaced "gæster" with "folk"')
      repaired = true
    }
  }
  
  // Apply to target_audience
  if (profile.target_audience && typeof profile.target_audience === 'object' && 'value' in profile.target_audience) {
    const before = profile.target_audience.value
    profile.target_audience.value = replaceGaester(profile.target_audience.value)
    if (profile.target_audience.value !== before) {
      repairs.push('target_audience: replaced "gæster" with "folk"')
      repaired = true
    }
  }
  
  // Apply to core_offerings
  if (profile.core_offerings && typeof profile.core_offerings === 'object' && 'value' in profile.core_offerings) {
    const before = profile.core_offerings.value
    profile.core_offerings.value = replaceGaester(profile.core_offerings.value)
    if (profile.core_offerings.value !== before) {
      repairs.push('core_offerings: replaced "gæster" with "folk"')
      repaired = true
    }
  }
  
  // Repair 3: Empty clarifications_needed array
  if (!profile.clarifications_needed || !Array.isArray(profile.clarifications_needed)) {
    profile.clarifications_needed = []
    repairs.push('clarifications_needed: initialized empty array')
    repaired = true
  }
  
  // Repair 4: Fix social_style.emoji_usage enum issues
  if (profile.social_style && typeof profile.social_style === 'object') {
    if (profile.social_style.emoji_usage) {
      const emojiMap: Record<string, string> = {
        'none': 'none',
        'minimal': 'minimal',
        'moderate': 'moderate',
        'expressive': 'expressive',
        // Common mistakes
        'low': 'minimal',
        'medium': 'moderate',
        'high': 'expressive',
        'heavy': 'expressive',
        'light': 'minimal'
      }
      
      const normalized = String(profile.social_style.emoji_usage).toLowerCase()
      if (normalized in emojiMap && emojiMap[normalized] !== profile.social_style.emoji_usage) {
        const before = profile.social_style.emoji_usage
        profile.social_style.emoji_usage = emojiMap[normalized] as any
        repairs.push(`social_style.emoji_usage: normalized "${before}" to "${emojiMap[normalized]}"`)
        repaired = true
      }
    }
  }
  
  // Repair 5: Trim whitespace from all string values
  const trimStringsInObject = (obj: any, path: string = 'root') => {
    if (!obj || typeof obj !== 'object') return
    
    for (const key in obj) {
      const fullPath = `${path}.${key}`
      const value = obj[key]
      
      if (typeof value === 'string') {
        const trimmed = value.trim()
        if (trimmed !== value) {
          obj[key] = trimmed
          repairs.push(`${fullPath}: trimmed whitespace`)
          repaired = true
        }
      } else if (typeof value === 'object' && value !== null) {
        trimStringsInObject(value, fullPath)
      }
    }
  }
  
  trimStringsInObject(profile, 'profile')
  
  // Add warnings for soft errors we couldn't auto-fix
  const unfixedSoftErrors = softErrors.filter(err => {
    // Check if this error was addressed by our repairs
    const addressedPatterns = [
      /content_pillars.*notes.*empty/i,
      /gæster/i,
      /emoji_usage/i,
      /whitespace/i
    ]
    return !addressedPatterns.some(p => p.test(err))
  })
  
  warnings.push(...unfixedSoftErrors.map(err => `Soft error (not auto-fixed): ${err}`))
  
  return { repaired, repairs, warnings }
}

/**
 * Separates errors into hard and soft categories.
 */
export function categorizeErrors(errors: string[]): {
  hardErrors: string[]
  softErrors: string[]
} {
  const hardErrors: string[] = []
  const softErrors: string[] = []
  
  errors.forEach(error => {
    if (isHardError(error)) {
      hardErrors.push(error)
    } else {
      softErrors.push(error)
    }
  })
  
  return { hardErrors, softErrors }
}

/**
 * Logs repair results in a human-readable format.
 */
export function logRepairResults(result: RepairResult): void {
  if (result.repaired) {
    console.log(`🔧 Soft Repairs Applied (${result.repairs.length}):`)
    result.repairs.forEach(repair => console.log(`   ✓ ${repair}`))
  }
  
  if (result.warnings.length > 0) {
    console.log(`⚠️  Soft Warnings (${result.warnings.length}):`)
    result.warnings.forEach(warning => console.log(`   - ${warning}`))
  }
}
