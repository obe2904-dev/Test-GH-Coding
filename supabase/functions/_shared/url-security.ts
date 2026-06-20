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
 * @param html - HTML content to check
 * @param url - URL of the page (for path-based detection)
 * @returns true if page appears to be a login/auth page
 */
export function looksLikeLoginPage(html: string, url: string): boolean {
  const htmlLower = html.toLowerCase()
  
  // Check for password input fields
  if (htmlLower.includes('<input type="password"') || 
      htmlLower.includes('type=password') ||
      htmlLower.includes('type="password"')) {
    return true
  }

  // Check for common login/auth keywords in combination
  const hasLogin = htmlLower.includes('login') || htmlLower.includes('log ind') || htmlLower.includes('sign in')
  const hasPassword = htmlLower.includes('password') || htmlLower.includes('adgangskode') || htmlLower.includes('kodeord')
  
  if (hasLogin && hasPassword) {
    return true
  }

  // Check URL path for admin/login indicators
  const pathLower = url.toLowerCase()
  if (pathLower.includes('/admin') || 
      pathLower.includes('/login') || 
      pathLower.includes('/wp-admin') ||
      pathLower.includes('/wp-login') ||
      pathLower.includes('/auth')) {
    return true
  }

  return false
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
