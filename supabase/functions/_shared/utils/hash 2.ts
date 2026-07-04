/**
 * Hash Utilities
 * 
 * Provides stable JSON hashing for change detection.
 * Used to compare JSONB columns and avoid unnecessary database writes.
 */

/**
 * Generate a stable string representation of a JSON object.
 * 
 * Uses sorted keys to ensure deterministic output regardless of key order.
 * Fast string comparison alternative to cryptographic hashing.
 * 
 * @param obj - Any JSON-serializable object
 * @returns Stable JSON string
 * 
 * @example
 * const obj1 = { a: 1, b: 2, c: 3 }
 * const obj2 = { c: 3, a: 1, b: 2 }
 * stableJsonString(obj1) === stableJsonString(obj2) // true
 */
export function stableJsonString(obj: any): string {
  if (obj === null || obj === undefined) {
    return JSON.stringify(obj)
  }
  
  // Sort keys recursively for deterministic output
  const sortedObj = sortKeys(obj)
  return JSON.stringify(sortedObj)
}

/**
 * Recursively sort object keys for deterministic JSON serialization.
 * 
 * @param obj - Any value (object, array, primitive)
 * @returns Sorted version of the object
 */
function sortKeys(obj: any): any {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sortKeys)
  }
  
  const sorted: Record<string, any> = {}
  const keys = Object.keys(obj).sort()
  
  for (const key of keys) {
    sorted[key] = sortKeys(obj[key])
  }
  
  return sorted
}

/**
 * Generate a SHA-256 hash of a JSON object (async version).
 * 
 * Uses sorted keys to ensure deterministic hashing regardless of key order.
 * Cryptographically secure hash with zero collision risk.
 * 
 * @param obj - Any JSON-serializable object
 * @returns Promise<string> - SHA-256 hash (64-character hex string)
 * 
 * @example
 * const hash = await stableJsonHashAsync({ city: 'Aarhus', area: 'waterfront' })
 * console.log(hash) // 'a3f8b2c1...' (64 chars)
 */
export async function stableJsonHashAsync(obj: any): Promise<string> {
  const normalized = stableJsonString(obj)
  const encoder = new TextEncoder()
  const data = encoder.encode(normalized)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Compare two JSON objects for equality using stable string comparison.
 * 
 * Faster than hashing for simple equality checks.
 * 
 * @param obj1 - First object
 * @param obj2 - Second object
 * @returns true if objects are equal (deep comparison)
 * 
 * @example
 * const obj1 = { a: 1, b: { c: 2 } }
 * const obj2 = { b: { c: 2 }, a: 1 }
 * jsonEquals(obj1, obj2) // true
 */
export function jsonEquals(obj1: any, obj2: any): boolean {
  return stableJsonString(obj1) === stableJsonString(obj2)
}
