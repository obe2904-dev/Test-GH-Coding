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

// ============================================================================
// Menu URL Normalization
// ============================================================================

/**
 * Decode HTML-escaped URLs
 * Fixes: &amp; → &, &#38; → &
 */
export function decodeHtmlUrl(url: string): string {
  return url
    .replace(/&amp;/g, '&')
    .replace(/&#38;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

/**
 * Sanitize URL by removing invalid parameters and fixing structure
 * Removes: NaN, null, undefined, empty string values
 */
export function sanitizeMenuUrl(rawUrl: string): string {
  try {
    const url = new URL(decodeHtmlUrl(rawUrl));
    
    // Remove invalid query parameter values
    for (const [key, value] of Array.from(url.searchParams.entries())) {
      if (
        value === 'NaN' ||
        value === 'null' ||
        value === 'undefined' ||
        value === ''
      ) {
        url.searchParams.delete(key);
      }
    }
    
    // Remove fragment/hash (not part of identity)
    url.hash = '';
    
    // Normalize pathname: remove duplicate slashes, trailing slashes
    url.pathname = url.pathname
      .replace(/\/{2,}/g, '/') // Multiple slashes → single slash
      .replace(/\/$/, '');       // Remove trailing slash (except root)
    
    if (!url.pathname) {
      url.pathname = '/';
    }
    
    return url.toString();
  } catch (error) {
    console.warn('Failed to sanitize URL:', rawUrl, error);
    return rawUrl;
  }
}

/**
 * Normalize URL for database identity and deduplication
 * 
 * Removes presentation-only parameters:
 * - Image delivery: w, h, auto, q, fit, crop, ar, fp-x, fp-y, dpr
 * - Pagination: page, p
 * - Tracking: utm_*, fbclid, gclid
 * 
 * Returns: Lowercase, normalized URL suitable as unique key
 */
export function normalizeMenuUrl(rawUrl: string): string {
  try {
    const url = new URL(sanitizeMenuUrl(rawUrl));
    
    // Parameters to remove (order-independent)
    const removableParams = [
      // Image delivery parameters
      'w', 'h', 'auto', 'q', 'fit', 'crop', 'ar', 'fp-x', 'fp-y', 'dpr',
      'width', 'height', 'quality', 'format',
      
      // Pagination
      'page', 'p', 'offset', 'limit',
      
      // Tracking
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'mc_cid', 'mc_eid',
      
      // Session/cache busting
      '_', 't', 'v', 'nocache', 'refresh',
    ];
    
    removableParams.forEach(param => {
      url.searchParams.delete(param);
    });
    
    // Sort remaining parameters for consistency
    const sortedParams = Array.from(url.searchParams.entries())
      .sort(([a], [b]) => a.localeCompare(b));
    
    url.search = '';
    sortedParams.forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
    
    // Return lowercase for case-insensitive matching
    return url.toString().toLowerCase();
  } catch (error) {
    console.warn('Failed to normalize URL:', rawUrl, error);
    return sanitizeMenuUrl(rawUrl).toLowerCase();
  }
}

/**
 * Check if a URL is a PDF
 */
export function isPdfUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return url.toLowerCase().endsWith('.pdf');
  }
}

/**
 * For PDFs, prefer the original PDF URL without image-transformation parameters
 */
export function normalizePdfUrl(rawUrl: string): string {
  if (!isPdfUrl(rawUrl)) {
    return normalizeMenuUrl(rawUrl);
  }
  
  try {
    const url = new URL(sanitizeMenuUrl(rawUrl));
    url.search = ''; // Remove ALL query parameters for PDFs
    return url.toString().toLowerCase();
  } catch (error) {
    console.warn('Failed to normalize PDF URL:', rawUrl, error);
    return sanitizeMenuUrl(rawUrl).toLowerCase();
  }
}

/**
 * Create a stable queue key for deduplication
 * Format: business_id + normalized_url
 */
export function createMenuQueueKey(businessId: string, url: string): string {
  return `${businessId}:${normalizeMenuUrl(url)}`;
}

/**
 * Extract domain from URL for grouping/display
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
