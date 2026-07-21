function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&#38;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
}

function normalizeString(value: string): string {
  return decodeHtmlEntities(value).replace(/\s+/g, ' ').trim()
}

function normalizeValue(value: any, key?: string): any {
  if (typeof value === 'string') {
    const normalized = normalizeString(value)
    if (key === 'currency') {
      return normalized.toUpperCase()
    }
    return normalized
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeValue(entry, key))
      .filter((entry) => entry !== null && entry !== undefined && entry !== '')
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  const normalizedObject: Record<string, any> = {}
  for (const [childKey, childValue] of Object.entries(value)) {
    normalizedObject[childKey] = normalizeValue(childValue, childKey)
  }

  if (Array.isArray(normalizedObject.prices)) {
    normalizedObject.prices = normalizedObject.prices.filter((price: any) => price && typeof price === 'object')
  }

  return normalizedObject
}

/**
 * Normalize the extracted structured menu so every source kind converges on
 * the same trimmed, whitespace-collapsed shape before persistence.
 */
export function normalizeStructuredMenu<T>(menu: T): T {
  return normalizeValue(menu) as T
}