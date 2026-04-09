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
