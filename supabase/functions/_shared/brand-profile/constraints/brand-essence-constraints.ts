/**
 * v4.10.0 Phase 1: Constraint-First Brand Essence Generation
 * 
 * Instead of generating freely and then falling back to templates,
 * we guide the AI with pre-filled slots that MUST be used.
 * 
 * This ensures the output is:
 * - Always grounded in business data
 * - Structurally valid (no template fallback needed)
 * - Differentiated (uses actual business tokens, not generic descriptions)
 */

import type { DataSources } from '../types.ts'

export interface BrandEssenceConstraints {
  venueType: string // "Café", "Restaurant", etc.
  locationPhrase: string // "ved åen", "på gågaden", etc.
  city: string // "Aarhus", "København", etc.
  canonicalHook: string // "ved åen i Aarhus"
  menuAnchors: string[] // ["BRUNCH", "COCKTAILS", "PARISERBØF"]
  behavioralHints: string[] // ["i roligt tempo", "lang frokost", "bliver siddende"]
}

/**
 * Extract constraints from business data that MUST appear in brand_essence
 */
export function extractBrandEssenceConstraints(dataSources: DataSources): BrandEssenceConstraints {
  const business = dataSources?.business
  const location = dataSources?.location
  const menu = dataSources?.menu || []
  
  // 1. Venue type (from business vertical / profile category / name)
  const businessName = (business?.name || '').toLowerCase()
  const vertical = (business?.vertical || '').toLowerCase()
  const category = ((dataSources as any)?.profile?.business_category || '').toLowerCase()
  const combined = `${businessName} ${vertical} ${category}`
  const venueType = combined.includes('café') || combined.includes('cafe') ? 'Café'
    : combined.includes('restaurant') ? 'Restaurant'
    : combined.includes('bar') || combined.includes('bistro') ? 'Bar'
    : combined.includes('bakery') || combined.includes('bageri') ? 'Bageri'
    : combined.includes('butik') || combined.includes('retail') || vertical === 'retail' ? 'Butik'
    : vertical === 'hospitality' ? 'Restaurant'
    : 'Café'  // sensible default for food/hospitality businesses
  
  // 2. Location phrase (deterministic from enrichment)
  const areaType = location?.enrichment?.micro?.area_type
  const locationPhrase = areaType === 'waterfront' ? 'ved åen'
    : areaType === 'transit_hub' ? 'ved stationen'
    : areaType === 'shopping_street' ? 'på gågaden'
    : areaType === 'tourist_area' ? 'i turistområdet'
    : 'i kvarteret'
  
  // 3. City (from location enrichment or business)
  const city = location?.enrichment?.macro?.city || business?.city || 'byen'
  
  // 4. Canonical location hook
  const canonicalHook = `${locationPhrase} i ${city}`
  
  // 5. Menu anchors (top 3-5 signature items, normalized)
  const menuAnchors = menu
    .filter(item => item.name && item.name.length > 3)
    .slice(0, 5)
    .map(item => item.name.toLowerCase())
  
  // 6. Behavioral hints (time-based, duration-based, flow-based)
  // Derive from menu occasions if available
  const hasBrunch = menuAnchors.some(a => /brunch/i.test(a))
  const hasCocktails = menuAnchors.some(a => /cocktail|drink|bar/i.test(a))
  const hasMultiCourse = menuAnchors.some(a => /retters|course|menu/i.test(a))
  
  const behavioralHints: string[] = []
  if (hasBrunch && hasCocktails) {
    behavioralHints.push('i eget tempo', 'glide fra brunch til aften')
  } else if (hasBrunch) {
    behavioralHints.push('i roligt tempo', 'lang frokost')
  } else if (hasMultiCourse) {
    behavioralHints.push('bliver siddende længe', 'aftenstemning')
  } else {
    behavioralHints.push('i roligt tempo') // Generic fallback
  }
  
  return {
    venueType,
    locationPhrase,
    city,
    canonicalHook,
    menuAnchors,
    behavioralHints,
  }
}

/**
 * Build constraint-aware instruction for brand_essence generation
 * 
 * Instead of: "Generate brand_essence (the AI figures it out)"
 * We say: "Fill these slots with business data: [Café] [ved åen i Aarhus] [brunch + cocktails] [i eget tempo]"
 */
export function buildBrandEssenceInstruction(constraints: BrandEssenceConstraints): string {
  const { venueType, canonicalHook, menuAnchors, behavioralHints } = constraints
  
  // Format menu anchors for instruction
  const menuList = menuAnchors.slice(0, 3).join(' + ')
  const behaviorHint = behavioralHints[0] || 'i roligt tempo'
  
  return `
🎯 BRAND ESSENCE MANDATORY STRUCTURE:

You MUST fill these slots (in this order):
1. [VENUE TYPE]: ${venueType}
2. [LOCATION HOOK]: ${canonicalHook}
3. [OFFERINGS]: Choose 1-2 from: ${menuList}
4. [BEHAVIORAL HOOK]: Choose 1 from: ${behavioralHints.join(', ')}

REQUIRED FORMAT:
"[VENUE TYPE] [LOCATION HOOK] hvor [OFFERINGS] [BEHAVIORAL HOOK]."

EXAMPLE OUTPUT (using these exact slots):
"${venueType} ${canonicalHook} hvor ${menuAnchors[0] || 'mad'} kan nydes ${behaviorHint}."

⚠️ CRITICAL RULES:
- You MUST use the exact venue type: "${venueType}"
- You MUST use the exact location hook: "${canonicalHook}"
- You MUST reference at least one menu anchor: ${menuList}
- You MUST include a behavioral hook (NOT a menu item, NOT location alone)
- BANNED WORDS: lækker, hyggelig, afslappet, autentisk, unik, charmerende

✅ VALID: "${venueType} ${canonicalHook} hvor ${menuAnchors[0] || 'brunch'} kan nydes i roligt tempo."
❌ INVALID: "Restaurant with great food and cozy atmosphere" (missing location, generic, English)
❌ INVALID: "Café hvor man kan spise godt" (missing location hook)
❌ INVALID: "Lækker café ved åen" (banned word "lækker")

NOW GENERATE brand_essence.value using the slots above:
`
}

/**
 * Validate that generated brand_essence matches constraints
 * Returns null if valid, error message if invalid
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateBrandEssence(
  value: string,
  constraints: BrandEssenceConstraints
): ValidationResult {
  const errors: string[] = []
  const normalized = value.toLowerCase()
  
  // Check 1: Contains canonical location hook
  if (!normalized.includes(constraints.canonicalHook.toLowerCase())) {
    errors.push(`Missing canonical location hook: "${constraints.canonicalHook}"`)
  }
  
  // Check 2: Contains at least one menu anchor
  const hasMenuAnchor = constraints.menuAnchors.some(anchor => 
    normalized.includes(anchor.toLowerCase())
  )
  if (!hasMenuAnchor && constraints.menuAnchors.length > 0) {
    errors.push(`Missing menu anchor (expected one of: ${constraints.menuAnchors.slice(0,3).join(', ')})`)
  }
  
  // Check 3: Contains behavioral hint
  const hasBehavioralHint = constraints.behavioralHints.some(hint =>
    normalized.includes(hint.toLowerCase())
  )
  if (!hasBehavioralHint) {
    errors.push(`Missing behavioral hook (expected one of: ${constraints.behavioralHints[0]})`)
  }
  
  // Check 4: No banned words (basic check - full check done elsewhere)
  const bannedWords = ['hyggelig', 'afslappet', 'autentisk', 'unik', 'charmerende']
  const foundBanned = bannedWords.find(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i')
    return regex.test(value)
  })
  if (foundBanned) {
    errors.push(`Contains banned word: "${foundBanned}"`)
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Build a deterministic brand_essence from constraints (last resort)
 * This is only used if AI fails validation multiple times
 */
export function buildConstrainedBrandEssence(constraints: BrandEssenceConstraints): string {
  const { venueType, canonicalHook, menuAnchors, behavioralHints } = constraints
  
  const offering = menuAnchors[0] || 'mad'
  const behavior = behavioralHints[0] || 'i roligt tempo'
  
  return `${venueType} ${canonicalHook} hvor ${offering} kan nydes ${behavior}.`
}
