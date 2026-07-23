export type DetectedMenuSourceKind =
  | 'html'
  | 'pdf'
  | 'image'
  | 'mealo'
  | 'iframe_platform'

const IFRAME_PLATFORM_HOSTS = [
  'dinnerbooking.com',
  'ordersystem.dk',
  'tablemanager.io',
  'restablo.dk',
  'zenchef.com',
]

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i
const PDF_EXTENSION = /\.pdf(\?|$)/i

export function classifyDetectedMenuSource(
  url: string,
  contentType: string,
  detectionMethod: string,
): DetectedMenuSourceKind {
  const urlLower = url.toLowerCase()
  const ct = (contentType || '').toLowerCase()

  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host === 'mealo.dk' || host.endsWith('.mealo.dk')) return 'mealo'
    if (IFRAME_PLATFORM_HOSTS.some((p) => host === p || host.endsWith(`.${p}`))) {
      return 'iframe_platform'
    }
  } catch {
    // Extension and content-type checks below provide the fallback.
  }

  // An asset renderer may keep ".pdf" in the path while returning a JPEG.
  // A concrete response MIME type is therefore authoritative.
  if (ct.startsWith('image/')) return 'image'
  if (ct.includes('pdf')) return 'pdf'
  if (PDF_EXTENSION.test(urlLower)) return 'pdf'
  if (IMAGE_EXTENSIONS.test(urlLower)) return 'image'

  if (
    detectionMethod === 'landing_page_srcset' ||
    detectionMethod === 'landing_page_img' ||
    detectionMethod === 'browser_discovery_image'
  ) {
    return 'image'
  }

  return 'html'
}

export function normalizeMenuDiscoveryUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const removableParams = new Set([
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'mc_cid', 'mc_eid',
      'w', 'h', 'width', 'height', 'quality', 'format', 'fit', 'crop', 'dpr',
    ])
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (removableParams.has(key.toLowerCase())) parsed.searchParams.delete(key)
    }
    const sortedParams = Array.from(parsed.searchParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
    parsed.search = ''
    for (const [key, value] of sortedParams) parsed.searchParams.append(key, value)
    parsed.hash = ''
    return parsed.href
  } catch {
    return url
  }
}

export function isFalsePositiveMenuUrl(url: string, label = ''): boolean {
  const combined = `${url} ${label}`.toLowerCase()
  if (
    /privacy|privatlivs|cookie|kontakt|contact|om-os|about|terms|betingelser|gdpr/
      .test(combined)
  ) {
    return true
  }

  if (/tripadvisor.*reviews?|localpoireviews|google\s+reviews?|anmeldelser/.test(combined)) {
    return true
  }

  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
    if (
      host === 'google.com' &&
      parsed.pathname === '/search' &&
      (
        parsed.searchParams.get('tbm') === 'lcl' ||
        parsed.searchParams.has('rldimm') ||
        parsed.hash.toLowerCase().includes('localpoireviews')
      )
    ) {
      return true
    }
  } catch {
    return true
  }

  return false
}

export function extractCanonicalMenuUrl(html: string, baseUrl: string): string | null {
  const linkTags = html.match(/<link\b[^>]*>/gi) || []
  for (const tag of linkTags) {
    const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1] || ''
    if (!rel.split(/\s+/).some((value) => value.toLowerCase() === 'canonical')) continue
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1]
    if (!href) continue
    try {
      const canonical = new URL(href, baseUrl)
      if (canonical.protocol === 'http:' || canonical.protocol === 'https:') {
        canonical.hash = ''
        return canonical.href
      }
    } catch {
      // Ignore malformed canonical metadata.
    }
  }
  return null
}

export function isLikelyMenuSitemapUrl(url: string): boolean {
  try {
    const path = decodeURIComponent(new URL(url).pathname).toLowerCase()
    if (/kontakt|contact|galleri|gallery|om-os|\/om\/|privacy|cookie|booking|gavekort/.test(path)) {
      return false
    }
    return /menu|menukort|madkort|frokost|aften|brunch|morgenmad|drikkevarer|drikkekort|cocktail|food|lunch|dinner|breakfast|drinks/.test(
      path,
    )
  } catch {
    return false
  }
}
