/**
 * Normalize a URL for consistent business identification
 * Removes protocol, www, trailing slashes, and converts to lowercase
 * 
 * Examples:
 * - https://www.restaurant.com/ -> restaurant.com
 * - http://Restaurant.com/menu -> restaurant.com
 * - www.cafe.dk -> cafe.dk
 */
export function normalizeUrl(url: string | null | undefined): string | null {
  if (!url || url.trim() === '') {
    return null
  }

  try {
    let normalized = url.trim().toLowerCase()

    // Remove protocol (http://, https://)
    normalized = normalized.replace(/^https?:\/\//, '')

    // Remove www. prefix
    normalized = normalized.replace(/^www\./, '')

    // Remove trailing slash and path (keep only domain)
    // This ensures restaurant.com/menu and restaurant.com are the same
    const domainMatch = normalized.match(/^([^\/]+)/)
    if (domainMatch) {
      normalized = domainMatch[1]
    }

    // Remove port numbers if present (restaurant.com:3000 -> restaurant.com)
    normalized = normalized.replace(/:\d+$/, '')

    // Validate it looks like a domain
    if (!normalized.includes('.') || normalized.length < 3) {
      return null // Invalid domain
    }

    return normalized
  } catch (error) {
    console.error('URL normalization error:', error)
    return null
  }
}

/**
 * Check if a URL is valid and can be normalized
 */
export function isValidUrl(url: string | null | undefined): boolean {
  return normalizeUrl(url) !== null
}

/**
 * Examples and tests
 */
export const URL_NORMALIZATION_EXAMPLES = {
  'https://www.restaurant-x.com/': 'restaurant-x.com',
  'http://Restaurant-X.com/menu': 'restaurant-x.com',
  'www.cafe.dk': 'cafe.dk',
  'CAFE.DK': 'cafe.dk',
  'https://bistro.co.uk:8080/about': 'bistro.co.uk',
  'invalid': null,
  '': null,
  'notadomain': null,
}
