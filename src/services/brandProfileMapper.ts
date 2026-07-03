/**
 * Brand Profile Mapper
 * 
 * Handles all parsing and formatting between database structures and UI representations.
 * Supports multiple legacy formats for backward compatibility.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ImagePreferencesJsonb {
  dos: string[]
  donts: string[]
  signature_shot: string
}

export interface ThingsToAvoidJsonb {
  language_constraints: string[]
  factual_constraints: string[]
}

export interface CoreOfferingsJsonb {
  meal_anchors: string[]
  experience_service_anchors: string[]
  unknowns?: string[]
  raw_text?: string
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Safely parse JSON with type checking
 */
export function tryParseJson<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null
  try {
    return JSON.parse(trimmed) as T
  } catch {
    return null
  }
}

/**
 * Format array items as bullet list
 */
export function formatBullets(items: string[]): string {
  return items.map(i => `- ${i}`).join('\n')
}

/**
 * Parse bullet list from text
 */
export function parseBullets(block: string): string[] {
  return block
    .split(/\r?\n/)
    .map(l => l.trim().replace(/^[-•]\s*/, ''))
    .filter(Boolean)
    .filter(l => l !== 'Ingen eksplicitte begrænsninger')
}

/**
 * Convert database value to safe string for storage
 */
export function toDbString(value: any): string | null {
  if (!value) return null
  if (typeof value === 'string') return value.trim() || null
  return JSON.stringify(value)
}

// ============================================================================
// IMAGE PREFERENCES MAPPERS
// ============================================================================

/**
 * Format image preferences from database to UI text
 */
export function formatImagePreferencesForUI(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value !== 'object') return String(value)

  const v = value as any
  const dos = Array.isArray(v.dos) ? v.dos.filter(Boolean) : []
  const donts = Array.isArray(v.donts) ? v.donts.filter(Boolean) : []
  const signature = typeof v.signature_shot === 'string' ? v.signature_shot.trim() : ''

  const parts: string[] = []
  if (dos.length) parts.push(`DO:\n${formatBullets(dos)}`)
  if (donts.length) parts.push(`DON'T:\n${formatBullets(donts)}`)
  if (signature) parts.push(`SIGNATURE SHOT:\n- ${signature}`)
  return parts.join('\n\n')
}

/**
 * Parse image preferences from UI text to JSONB structure
 */
export function parseImagePreferencesToJsonb(text: string): ImagePreferencesJsonb | null {
  const parsed = tryParseJson<ImagePreferencesJsonb>(text)
  if (parsed && typeof parsed === 'object') return parsed

  const m = text.match(/DO:\s*\n([\s\S]*?)\n\nDON'T:\s*\n([\s\S]*?)\n\nSIGNATURE SHOT:\s*\n-\s*([\s\S]*)$/)
  if (!m) return null
  
  const dos = m[1].split(/\r?\n/).map(l => l.trim().replace(/^[-•]\s*/, '')).filter(Boolean)
  const donts = m[2].split(/\r?\n/).map(l => l.trim().replace(/^[-•]\s*/, '')).filter(Boolean)
  const signature_shot = (m[3] || '').trim()
  
  return { dos, donts, signature_shot }
}

// ============================================================================
// THINGS TO AVOID MAPPERS
// ============================================================================

/**
 * Format things to avoid from database to UI text
 * Supports multiple legacy formats
 */
export function formatThingsToAvoidForUI(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value !== 'object') return String(value)

  const v = value as any
  const language = Array.isArray(v.language_constraints)
    ? v.language_constraints.filter(Boolean)
    : Array.isArray(v.hard_constraints)
      ? v.hard_constraints.filter(Boolean)
      : []
  const factual = Array.isArray(v.factual_constraints)
    ? v.factual_constraints.filter(Boolean)
    : Array.isArray(v.soft_suggestions)
      ? v.soft_suggestions.filter(Boolean)
      : []

  const parts: string[] = []
  
  // Use new format if we have the new field names
  if (Array.isArray(v.language_constraints) || Array.isArray(v.factual_constraints)) {
    if (language.length) parts.push(`Undgå (sprog):\n${formatBullets(language)}`)
    if (factual.length) parts.push(`Må ikke opfinde (fakta):\n${formatBullets(factual)}`)
  } else {
    // Legacy format
    if (language.length) parts.push(`Undgå (konkret):\n${formatBullets(language)}`)
    if (factual.length) parts.push(`Gode råd:\n${formatBullets(factual)}`)
  }
  
  return parts.join('\n\n')
}

/**
 * Parse things to avoid from UI text to JSONB structure
 * Supports multiple legacy formats for backward compatibility
 */
export function parseThingsToAvoidToJsonb(text: string): ThingsToAvoidJsonb | null {
  const parsed = tryParseJson<any>(text)
  if (parsed && typeof parsed === 'object') {
    const v = parsed as any
    
    // Already in new format
    if (Array.isArray(v.language_constraints) || Array.isArray(v.factual_constraints)) {
      return v as ThingsToAvoidJsonb
    }
    
    // Convert from legacy format
    if (Array.isArray(v.hard_constraints) || Array.isArray(v.soft_suggestions)) {
      return {
        language_constraints: Array.isArray(v.hard_constraints) ? v.hard_constraints.filter(Boolean) : [],
        factual_constraints: Array.isArray(v.soft_suggestions) ? v.soft_suggestions.filter(Boolean) : []
      }
    }
    
    return v
  }

  // Parse from text - try multiple formats

  // Format 1: New UI headings
  const mNew = text.match(/Undgå \(sprog\):\s*\n([\s\S]*?)(?:\n\nMå ikke opfinde \(fakta\):\s*\n([\s\S]*))?$/i)
  if (mNew) {
    return {
      language_constraints: parseBullets(mNew[1] || ''),
      factual_constraints: parseBullets(mNew[2] || '')
    }
  }

  // Format 2: Legacy Danish headings
  const mDkLegacy = text.match(/Undgå \(konkret\):\s*\n([\s\S]*?)(?:\n\nGode råd:\s*\n([\s\S]*))?$/i)
  if (mDkLegacy) {
    return {
      language_constraints: parseBullets(mDkLegacy[1] || ''),
      factual_constraints: parseBullets(mDkLegacy[2] || '')
    }
  }

  // Format 3: Legacy English headings
  const mEnLegacy = text.match(/Avoid \(explicit\):\s*\n([\s\S]*?)(?:\n\nAvoid \(best practice\):\s*\n([\s\S]*))?$/i)
  if (mEnLegacy) {
    return {
      language_constraints: parseBullets(mEnLegacy[1] || ''),
      factual_constraints: parseBullets(mEnLegacy[2] || '')
    }
  }

  // Format 4: Legacy all-caps
  const mCaps = text.match(/HARD CONSTRAINTS:\s*\n([\s\S]*?)\n\nSOFT SUGGESTIONS:\s*\n([\s\S]*)$/i)
  if (mCaps) {
    return {
      language_constraints: parseBullets(mCaps[1] || ''),
      factual_constraints: parseBullets(mCaps[2] || '')
    }
  }

  return null
}

// ============================================================================
// CORE OFFERINGS MAPPERS
// ============================================================================

/**
 * Format core offerings from database to UI text
 */
export function formatCoreOfferingsForUI(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value !== 'object') return String(value)

  const v = value as any
  const meal = Array.isArray(v.meal_anchors) ? v.meal_anchors.filter(Boolean) : []
  const exp = Array.isArray(v.experience_service_anchors) ? v.experience_service_anchors.filter(Boolean) : []
  const unknowns = Array.isArray(v.unknowns) ? v.unknowns.filter(Boolean) : []

  const lines: string[] = []
  for (const i of meal) lines.push(`- ${i}`)
  for (const i of exp) lines.push(`- ${i}`)
  for (const i of unknowns) lines.push(`- ${i}`)
  
  return lines.join('\n')
}

/**
 * Parse core offerings from UI text to JSONB structure
 */
export function parseCoreOfferingsToJsonb(text: string): CoreOfferingsJsonb | null {
  const parsed = tryParseJson<CoreOfferingsJsonb>(text)
  if (parsed && typeof parsed === 'object') return parsed

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)

  const bullets = lines
    .filter(l => l.startsWith('- ') || l.startsWith('• '))
    .map(l => l.replace(/^[-•]\s+/, '').trim())
    .filter(Boolean)

  if (!bullets.length) return null

  const unknowns: string[] = []
  const anchors: string[] = []
  
  for (const b of bullets) {
    if (/^uklart om\b/i.test(b) || /^unclear\b/i.test(b)) {
      unknowns.push(b)
    } else {
      anchors.push(b)
    }
  }

  return {
    meal_anchors: anchors.slice(0, 3),
    experience_service_anchors: anchors.slice(3, 5),
    unknowns,
    raw_text: text
  }
}
