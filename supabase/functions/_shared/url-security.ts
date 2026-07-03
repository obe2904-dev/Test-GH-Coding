/**
 * URL Security Validation Utilities
 * 
 * Shared security functions for validating URLs before fetching external content.
 * Prevents SSRF attacks, protects internal networks, and validates public accessibility.
 * 
 * Used by: menu-extract-v2, analyze-website, and other crawling/fetching functions
 */

/**
 * Validates that a URL is safe to fetch - blocks internal networks, private IPs, and non-HTTP protocols.
 * Prevents SSRF attacks and protects users' internal systems from unintended access.
 * 
 * @throws Error if URL is not safe to fetch
 */
export function validatePublicUrl(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid URL format')
  }

  // Only allow HTTP and HTTPS protocols
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Unsupported protocol: ${parsed.protocol}. Only HTTP/HTTPS allowed.`)
  }

  // Block localhost and private IP ranges
  const hostname = parsed.hostname.toLowerCase()
  
  // Localhost variants
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    throw new Error('Cannot fetch from localhost')
  }

  // Private IPv4 ranges (RFC 1918)
  if (hostname.startsWith('192.168.') || 
      hostname.startsWith('10.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) {
    throw new Error('Cannot fetch from private IP addresses')
  }

  // Link-local addresses
  if (hostname.startsWith('169.254.') || hostname.startsWith('fe80:')) {
    throw new Error('Cannot fetch from link-local addresses')
  }

  // .local domains (commonly used for internal networks)
  if (hostname.endsWith('.local')) {
    throw new Error('Cannot fetch from .local domains')
  }

  // Internal/private domain patterns
  if (hostname === 'internal' || hostname.startsWith('internal.') ||
      hostname === 'admin' || hostname.startsWith('admin.') ||
      hostname.startsWith('staging.') || hostname.startsWith('dev.')) {
    throw new Error('Cannot fetch from internal/admin domains')
  }
}

/**
 * Detects if HTML content appears to be a login/authentication page.
 * Prevents accidentally extracting password fields or protected content.
 * 
 * Updated to allow business websites with customer login features (online ordering, reservations)
 * Only blocks PRIMARILY admin/login pages that lack business content.
 * 
 * @param html - HTML content to check
 * @param url - URL of the page (for path-based detection)
 * @returns true if page appears to be a login/auth page (not a business site with login features)
 */
export function looksLikeLoginPage(html: string, url: string): boolean {
  const htmlLower = html.toLowerCase()
  
  // Check URL path for admin/login indicators - only check the actual path, not the full URL
  try {
    const urlObj = new URL(url)
    const pathLower = urlObj.pathname.toLowerCase()
    const hostnameLower = urlObj.hostname.toLowerCase()
    
    // Block obvious admin paths (exact matches or path segments)
    if (pathLower === '/admin' || 
        pathLower === '/login' || 
        pathLower === '/wp-admin' ||
        pathLower === '/wp-login' ||
        pathLower === '/auth' ||
        pathLower.startsWith('/admin/') ||
        pathLower.startsWith('/login/') ||
        pathLower.startsWith('/wp-admin/') ||
        pathLower.startsWith('/wp-login/') ||
        pathLower.startsWith('/auth/')) {
      return true
    }
    
    // Block admin/auth subdomains
    if (hostnameLower.startsWith('admin.') || 
        hostnameLower.startsWith('auth.') ||
        hostnameLower.startsWith('login.')) {
      return true
    }
  } catch {
    // Invalid URL - let it fail elsewhere
    return false
  }

  // Check for password input fields
  const hasPasswordField = htmlLower.includes('<input type="password"') || 
                          htmlLower.includes('type=password') ||
                          htmlLower.includes('type="password"')
  
  if (!hasPasswordField) {
    return false // No password field = not a login page
  }

  // Has password field - check if it's a business site with customer login or an admin panel
  // Business sites often have login widgets for online ordering, table reservations, loyalty programs
  const businessKeywords = [
    'menu', 'bestil', 'book', 'reserve', 'order', 'åbningstider', 'opening',
    'restaurant', 'cafe', 'café', 'bar', 'hotel', 'mad', 'food', 'drikke', 'drink',
    'kontakt', 'contact', 'lokation', 'location', 'adresse', 'address',
    'takeaway', 'take-away', 'delivery', 'levering', 'catering',
    'bord', 'table', 'reservation', 'bordbestilling'
  ]
  
  const adminKeywords = [
    'dashboard', 'admin panel', 'wp-admin', 'wordpress', 'control panel',
    'administrator', 'backend', 'cms', 'content management', 'administration'
  ]
  
  const businessMatches = businessKeywords.filter(kw => htmlLower.includes(kw)).length
  const adminMatches = adminKeywords.filter(kw => htmlLower.includes(kw)).length
  
  // Allow if business content is dominant (even with password field for customer login)
  if (businessMatches >= 3) {
    return false // Business site with customer login features (e.g., online ordering)
  }
  
  // Block if clear admin panel indicators
  if (adminMatches >= 2) {
    return true // Admin panel
  }
  
  // Edge case: password field but no clear business or admin indicators
  // Check if it's a standalone login page (minimal content, just login form)
  const hasLogin = htmlLower.includes('log ind') || htmlLower.includes('login') || htmlLower.includes('sign in')
  const hasPasswordText = htmlLower.includes('password') || htmlLower.includes('adgangskode') || htmlLower.includes('kodeord')
  
  // Only block if both login AND password text present AND lacking business content
  // This allows business homepages with login widgets to pass through
  return hasLogin && hasPasswordText && businessMatches < 2
}

/**
 * Validates HTTP response status and throws appropriate errors for auth/not-found pages.
 * 
 * @param response - Fetch Response object to validate
 * @param url - URL that was fetched (for error messages)
 * @throws Error if response indicates auth required or not found
 */
export function validateHttpStatus(response: Response, url: string): void {
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('URL requires authentication - cannot access')
    }
    if (response.status === 404) {
      throw new Error('URL not found (404)')
    }
    throw new Error(`HTTP ${response.status} error`)
  }
}
