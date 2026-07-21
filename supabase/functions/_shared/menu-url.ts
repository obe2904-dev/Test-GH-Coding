/**
 * Shared menu URL normalization helpers for edge functions.
 */

export function decodeHtmlUrl(url: string): string {
  return url
    .replace(/&amp;/g, '&')
    .replace(/&#38;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
}

export function sanitizeMenuUrl(rawUrl: string): string {
  try {
    const url = new URL(decodeHtmlUrl(rawUrl))

    for (const [key, value] of Array.from(url.searchParams.entries())) {
      if (
        value === 'NaN' ||
        value === 'null' ||
        value === 'undefined' ||
        value === ''
      ) {
        url.searchParams.delete(key)
      }
    }

    url.hash = ''
    url.pathname = url.pathname
      .replace(/\/{2,}/g, '/')
      .replace(/\/$/, '')

    if (!url.pathname) {
      url.pathname = '/'
    }

    return url.toString()
  } catch {
    return rawUrl
  }
}

export function normalizeMenuUrl(rawUrl: string): string {
  try {
    const url = new URL(sanitizeMenuUrl(rawUrl))

    const removableParams = [
      'w', 'h', 'auto', 'q', 'fit', 'crop', 'ar', 'fp-x', 'fp-y', 'dpr',
      'width', 'height', 'quality', 'format',
      'page', 'p', 'offset', 'limit',
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'mc_cid', 'mc_eid',
      '_', 't', 'v', 'nocache', 'refresh',
    ]

    removableParams.forEach((param) => {
      url.searchParams.delete(param)
    })

    const sortedParams = Array.from(url.searchParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))

    url.search = ''
    sortedParams.forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })

    return url.toString().toLowerCase()
  } catch {
    return sanitizeMenuUrl(rawUrl).toLowerCase()
  }
}

export function isPdfUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.pathname.toLowerCase().endsWith('.pdf')
  } catch {
    return url.toLowerCase().endsWith('.pdf')
  }
}
