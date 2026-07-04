/**
 * Business Type Helpers (Frontend Version)
 * 
 * Mirrors the edge function helpers for consistent handling across frontend/backend
 * Location: src/lib/businessTypeHelpers.ts
 * 
 * Provides backwards-compatible handling of string vs object businessType
 */

export type LegacyBusinessType = string

export interface HybridBusinessType {
  primary: string
  secondary?: string[]
  hybridLabel?: string
  cuisineType?: string
  conceptTags?: string[]
}

export type BusinessType = LegacyBusinessType | HybridBusinessType

/**
 * Get primary type as simple string (for existing logic)
 */
export function getPrimaryType(type: BusinessType | null | undefined): string {
  if (!type) return ''
  if (typeof type === 'string') return type
  return type.primary || ''
}

/**
 * Get display label (supports hybrid labels)
 */
export function getBusinessTypeLabel(type: BusinessType | null | undefined): string {
  if (!type) return ''
  if (typeof type === 'string') return type
  return type.hybridLabel || type.primary || ''
}

/**
 * Check if type is hybrid (has secondary types)
 */
export function isHybridType(type: BusinessType | null | undefined): boolean {
  if (!type || typeof type === 'string') return false
  return !!(type.secondary && type.secondary.length > 0)
}

/**
 * Extract all types (primary + secondary)
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
 */
export function matchesAnyType(
  type: BusinessType | null | undefined,
  targetTypes: string[]
): boolean {
  const allTypes = getAllTypes(type)
  return allTypes.some(t => targetTypes.includes(t))
}
