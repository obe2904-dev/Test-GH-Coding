/**
 * BusinessType Helper Functions
 * 
 * Provides backwards-compatible handling of string vs object businessType
 * 
 * Migration Strategy:
 * - OLD: businessType was a simple string ('cafe', 'restaurant', 'bar')
 * - NEW: businessType can be an object with primary/secondary/hybridLabel
 * - These helpers ensure existing code continues to work with both formats
 * 
 * Usage:
 * ```typescript
 * import { getPrimaryType, getBusinessTypeLabel, isHybridType } from './business-type-helpers.ts'
 * 
 * // Old code that expects string:
 * const type = getPrimaryType(businessType)  // Always returns string
 * 
 * // New code that supports hybrid:
 * const label = getBusinessTypeLabel(businessType)  // Returns "Kaffebar & Vinbar" for hybrids
 * ```
 */

/**
 * Legacy format: simple string
 */
export type LegacyBusinessType = string

/**
 * New hybrid format: structured object
 */
export interface HybridBusinessType {
  primary: 'cafe' | 'restaurant' | 'bar' | 'hotel' | 'bakery' | 'coffee_shop' | 'retail' | 'service' | string
  secondary?: string[]
  hybridLabel?: string
  cuisineType?: string
  conceptTags?: string[]
}

/**
 * Union type: supports both old and new formats
 */
export type BusinessType = LegacyBusinessType | HybridBusinessType

/**
 * Get primary type as simple string (for existing logic)
 * 
 * Examples:
 * - getPrimaryType('cafe') → 'cafe'
 * - getPrimaryType({ primary: 'cafe', secondary: ['vinbar'] }) → 'cafe'
 * - getPrimaryType(null) → ''
 * 
 * @param type - BusinessType in any format
 * @returns Primary type as string (empty string if null/undefined)
 */
export function getPrimaryType(type: BusinessType | null | undefined): string {
  if (!type) return ''
  if (typeof type === 'string') return type
  return type.primary || ''
}

/**
 * Get display label (supports hybrid labels)
 * 
 * Examples:
 * - getBusinessTypeLabel('cafe') → 'cafe'
 * - getBusinessTypeLabel({ primary: 'cafe', hybridLabel: 'Kaffebar & Vinbar' }) → 'Kaffebar & Vinbar'
 * - getBusinessTypeLabel({ primary: 'cafe', secondary: ['vinbar'] }) → 'cafe' (no hybridLabel defined)
 * 
 * @param type - BusinessType in any format
 * @returns Display label (hybridLabel if available, otherwise primary type)
 */
export function getBusinessTypeLabel(type: BusinessType | null | undefined): string {
  if (!type) return ''
  if (typeof type === 'string') return type
  return type.hybridLabel || type.primary || ''
}

/**
 * Check if type is hybrid (has secondary types)
 * 
 * Examples:
 * - isHybridType('cafe') → false
 * - isHybridType({ primary: 'cafe', secondary: ['vinbar'] }) → true
 * - isHybridType({ primary: 'cafe' }) → false
 * 
 * @param type - BusinessType in any format
 * @returns True if hybrid structure with secondary types
 */
export function isHybridType(type: BusinessType | null | undefined): boolean {
  if (!type || typeof type === 'string') return false
  return !!(type.secondary && type.secondary.length > 0)
}

/**
 * Extract all types (primary + secondary)
 * 
 * Examples:
 * - getAllTypes('cafe') → ['cafe']
 * - getAllTypes({ primary: 'cafe', secondary: ['vinbar', 'cocktailbar'] }) → ['cafe', 'vinbar', 'cocktailbar']
 * 
 * @param type - BusinessType in any format
 * @returns Array of all types (primary first, then secondary)
 */
export function getAllTypes(type: BusinessType | null | undefined): string[] {
  if (!type) return []
  if (typeof type === 'string') return [type]
  
  const types = [type.primary]
  if (type.secondary) {
    types.push(...type.secondary)
  }
  return types.filter(Boolean)
}

/**
 * Check if type matches any of the given types (supports hybrid matching)
 * 
 * Examples:
 * - matchesAnyType('cafe', ['cafe', 'restaurant']) → true
 * - matchesAnyType({ primary: 'cafe', secondary: ['vinbar'] }, ['bar', 'vinbar']) → true
 * 
 * @param type - BusinessType to check
 * @param targetTypes - Array of type strings to match against
 * @returns True if type matches any of the target types
 */
export function matchesAnyType(
  type: BusinessType | null | undefined,
  targetTypes: string[]
): boolean {
  const allTypes = getAllTypes(type)
  return allTypes.some(t => targetTypes.includes(t))
}

/**
 * Normalize businessType to legacy string format (for database compatibility)
 * 
 * Use when saving to legacy columns that expect simple string
 * 
 * @param type - BusinessType in any format
 * @returns Simple string representation
 */
export function toLegacyString(type: BusinessType | null | undefined): string {
  if (!type) return ''
  if (typeof type === 'string') return type
  
  // For hybrids, return combined label if available, otherwise primary
  if (isHybridType(type) && type.hybridLabel) {
    return type.hybridLabel
  }
  
  return type.primary || ''
}

/**
 * Convert legacy string to new hybrid format
 * 
 * Use when migrating old data to new structure
 * 
 * @param legacyType - Old string format
 * @returns New hybrid format with primary field
 */
export function fromLegacyString(legacyType: string): HybridBusinessType {
  return {
    primary: legacyType,
    secondary: [],
    hybridLabel: legacyType
  }
}

/**
 * Determine if businessType value is in new format
 * 
 * @param type - Any value
 * @returns True if object with primary field
 */
export function isHybridFormat(type: any): type is HybridBusinessType {
  return !!(
    type &&
    typeof type === 'object' &&
    'primary' in type &&
    typeof type.primary === 'string'
  )
}

/**
 * Safe parse of businessType from unknown source (API, database, etc.)
 * 
 * Handles:
 * - String values
 * - Object values
 * - JSON strings
 * - Null/undefined
 * 
 * @param value - Unknown value
 * @returns Normalized BusinessType or null
 */
export function parseBusinessType(value: any): BusinessType | null {
  // Null/undefined
  if (!value) return null
  
  // Already correct format
  if (typeof value === 'string') return value
  if (isHybridFormat(value)) return value
  
  // Try parse JSON string
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (isHybridFormat(parsed)) return parsed
    } catch {
      // Not JSON, return as string
      return value
    }
  }
  
  // Unknown format
  console.warn('⚠️ Unknown businessType format:', value)
  return null
}

/**
 * Detect the effective operational vertical from all available identity signals.
 *
 * `businesses.vertical` is a signup enum that is often imprecise for crossover concepts
 * (e.g. a café-bar registered as 'cafe', a florist-café registered as 'florist').
 * Brand Profile fields — `business_character` and `identity_keywords` — are richer
 * free-text descriptions written or confirmed by the owner and are the authoritative source.
 *
 * This function scans all three together so crossovers are classified correctly.
 * For overlapping signals, bar > bakery > coffee > default so the most commercially
 * differentiating axis wins for content-rule purposes.
 *
 * Returns one of: 'bar' | 'bakery' | 'coffee_shop' | the raw vertical string (fallback)
 *
 * Examples:
 * - vertical='cafe', businessCharacter='cocktailbar og naturvin' → 'bar'
 * - vertical='florist', businessCharacter='blomsterbutik med integreret kaffebar' → 'coffee_shop'
 * - vertical='restaurant', identityKeywords='tapas, deleborde, drinks' → 'bar'
 * - vertical='cafe', businessCharacter='dansk bageri med kaffe' → 'bakery'
 * - vertical='restaurant', businessCharacter='' → 'restaurant'
 */
export function detectEffectiveVertical(
  vertical: string,
  businessCharacter: string,
  identityKeywords: string | string[],
): string {
  const keywordsStr = Array.isArray(identityKeywords)
    ? identityKeywords.join(' ')
    : (identityKeywords || '')

  const combined = [vertical, businessCharacter, keywordsStr].join(' ').toLowerCase()

  const isBar     = /\bbar\b|cocktailbar|cocktail.?bar|vinbar|wine.?bar|tapasbar|tapas\b|drinksmenu|drinksbar|natklub|nightclub/.test(combined)
  const isBakery  = /\bbageri\b|\bbakery\b|patisserie|konditori|brød.?bagning|artisan.?ba(k|g)/.test(combined)
  const isCoffee  = /\bkaffebar\b|coffee.?shop|coffeeshop|\bespresso\b|specialkaffe|kafferi\b|coffee.?bar/.test(combined)

  if (isBar)    return 'bar'
  if (isBakery) return 'bakery'
  if (isCoffee) return 'coffee_shop'
  return vertical || '' // No hardcoded default - empty if not detected
}

/**
 * Detect ALL matched verticals for hybrid business time-of-day resolution.
 * Unlike detectEffectiveVertical(), returns ALL matches rather than the first one.
 * Used by resolveActiveVertical() to pick the right vertical for the current hour.
 */
export function detectHybridVerticals(
  vertical: string,
  businessCharacter: string,
  identityKeywords: string | string[],
): string[] {
  const keywordsStr = Array.isArray(identityKeywords)
    ? identityKeywords.join(' ')
    : (identityKeywords || '')
  const combined = [vertical, businessCharacter, keywordsStr].join(' ').toLowerCase()

  const matched: string[] = []
  if (/\bbar\b|cocktailbar|cocktail.?bar|vinbar|wine.?bar|tapasbar|tapas\b|drinksmenu|drinksbar|natklub|nightclub/.test(combined)) matched.push('bar')
  if (/\bbageri\b|\bbakery\b|patisserie|konditori|brød.?bagning|artisan.?ba(k|g)/.test(combined)) matched.push('bakery')
  if (/\bkaffebar\b|coffee.?shop|coffeeshop|\bespresso\b|specialkaffe|kafferi\b|coffee.?bar/.test(combined)) matched.push('coffee_shop')

  // Include the base vertical unless it's already covered by a more specific match
  const base = vertical || ''
  if (base && !matched.includes(base)) matched.push(base)

  return matched.length > 0 ? matched : [] // Return empty array if no detection
}

/**
 * Resolve the active vertical for a hybrid business based on time of day.
 * For single-vertical businesses returns the same value as detectEffectiveVertical().
 *
 * Resolution rules:
 * - Bakery + anything → bakery in the first 2h after open, otherwise the non-bakery type
 * - Coffee shop + bar → coffee_shop before 14:00, bar from 14:00
 * - Bar + cafe/restaurant (the core hybrid) → cafe before 14:00, transition 14–17, bar from 17:00
 * - Single vertical → returned unchanged
 */
export function resolveActiveVertical(
  hybrids: string[],
  nowHour: number,
  openTime: string | null,
  closeTime: string | null,
): string {
  if (hybrids.length <= 1) return hybrids[0] || '' // No hardcoded default

  const hasBar    = hybrids.includes('bar')
  const hasCafe   = hybrids.includes('cafe') || hybrids.includes('restaurant')
  const hasCoffee = hybrids.includes('coffee_shop')
  const hasBakery = hybrids.includes('bakery')

  // Bakery + anything: bakery mode for first 2h after open, then switch
  if (hasBakery) {
    if (openTime) {
      const [openH] = openTime.split(':').map(Number)
      if (nowHour < openH + 2) return 'bakery'
    } else if (nowHour < 10) {
      return 'bakery'
    }
    const nonBakery = hybrids.find(v => v !== 'bakery')
    return nonBakery || 'bakery'
  }

  // Coffee shop + bar (coffee-and-wine-bar hybrid)
  if (hasCoffee && hasBar) {
    return nowHour < 14 ? 'coffee_shop' : 'bar'
  }

  // Bar + café/restaurant (the core hybrid: morning coffee service + evening bar)
  if (hasBar && hasCafe) {
    if (nowHour < 14) return 'cafe'
    if (nowHour < 17) return hasCafe ? 'cafe' : 'restaurant'
    return 'bar'
  }

  // Default: first match (preserves existing priority order)
  return hybrids[0]
}
