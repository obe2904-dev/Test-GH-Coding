/**
 * HTML parsing and extraction utilities for website analysis
 * Provides reusable functions for extracting signals from HTML content
 */

/**
 * Extract image alt text, filenames, and URLs from HTML
 * Returns structured "signals" for AI analysis
 */
export function extractImageSignals(html: string, pageUrl: string): string[] {
  if (!html) return []

  const tags = html.match(/<img\b[^>]*>/gi) || []
  const lines: string[] = []

  for (const tag of tags.slice(0, 80)) {
    const attrs: Record<string, string> = {}
    const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(["'])(.*?)\2/g
    let m: RegExpExecArray | null
    while ((m = attrRe.exec(tag)) !== null) {
      attrs[m[1].toLowerCase()] = (m[3] || '').trim()
    }

    const alt = (attrs['alt'] || '').trim()
    const title = (attrs['title'] || '').trim()
    const aria = (attrs['aria-label'] || '').trim()

    const srcRaw = (attrs['src'] || attrs['data-src'] || attrs['data-original'] || '').trim()
    if (!alt && !title && !aria && !srcRaw) continue
    if (srcRaw.startsWith('data:')) continue

    let absSrc = srcRaw
    try {
      if (srcRaw) absSrc = new URL(srcRaw, pageUrl).toString()
    } catch {
      // keep raw
    }

    let fileName = ''
    try {
      const u = new URL(absSrc)
      const last = u.pathname.split('/').pop() || ''
      fileName = decodeURIComponent(last)
    } catch {
      const last = absSrc.split('/').pop() || ''
      fileName = last.split('?')[0] || ''
    }

    // Prefer concrete signals: alt/aria/title and filename.
    const label = alt || aria || title
    const normalizedFile = (fileName || '').replace(/\s+/g, ' ').trim()
    const normalizedLabel = (label || '').replace(/\s+/g, ' ').trim()

    const parts: string[] = []
    if (normalizedLabel) parts.push(`alt: "${normalizedLabel}"`)
    if (normalizedFile) parts.push(`file: "${normalizedFile}"`)
    if (!normalizedLabel && absSrc) parts.push(`src: "${absSrc}"`)

    if (parts.length === 0) continue
    const line = `- IMG ${parts.join(' | ')}`
    if (!lines.includes(line)) lines.push(line)
    if (lines.length >= 25) break
  }

  return lines
}

/**
 * Extract absolute image URLs from HTML
 * Includes OpenGraph/Twitter meta images and img tags
 */
export function extractImageUrls(html: string, pageUrl: string): string[] {
  if (!html) return []

  const urls: string[] = []

  // 1) OpenGraph/Twitter images
  const metaMatches = html.matchAll(
    /<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/gi
  )
  for (const m of Array.from(metaMatches).slice(0, 3)) {
    const raw = (m[1] || '').trim()
    if (!raw) continue
    try {
      urls.push(new URL(raw, pageUrl).toString())
    } catch {
      urls.push(raw)
    }
  }

  const twitterMatches = html.matchAll(
    /<meta\s+[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*>/gi
  )
  for (const m of Array.from(twitterMatches).slice(0, 2)) {
    const raw = (m[1] || '').trim()
    if (!raw) continue
    try {
      urls.push(new URL(raw, pageUrl).toString())
    } catch {
      urls.push(raw)
    }
  }

  // 2) <img> src/data-src
  const tags = html.match(/<img\b[^>]*>/gi) || []
  for (const tag of tags.slice(0, 60)) {
    const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(["'])(.*?)\2/g
    const attrs: Record<string, string> = {}
    let m: RegExpExecArray | null
    while ((m = attrRe.exec(tag)) !== null) {
      attrs[m[1].toLowerCase()] = (m[3] || '').trim()
    }
    const srcRaw = (attrs['src'] || attrs['data-src'] || attrs['data-original'] || '').trim()
    if (!srcRaw || srcRaw.startsWith('data:')) continue

    let abs = srcRaw
    try {
      abs = new URL(srcRaw, pageUrl).toString()
    } catch {
      // keep raw
    }
    urls.push(abs)
  }

  // De-dupe while preserving order
  const seen = new Set<string>()
  const out: string[] = []
  for (const u of urls) {
    const s = String(u || '').trim()
    if (!s) continue
    if (seen.has(s)) continue
    seen.add(s)
    out.push(s)
    if (out.length >= 20) break
  }
  return out
}

/**
 * Check if business type indicates hospitality industry
 */
export function isHospitalityBusiness(value: unknown): boolean {
  const s = String(value || '').toLowerCase()
  return [
    'restaurant',
    'cafe',
    'café',
    'bar',
    'bistro',
    'brasserie',
    'cocktail',
    'vinbar',
    'wine',
    'pizza',
    'burger',
    'brunch',
  ].some((k) => s.includes(k))
}

/**
 * Check if a link is likely a visual/gallery page
 * Useful for hospitality businesses to extract ambiance photos
 */
export function isVisualPageCandidate(
  href: string,
  text: string,
  ariaLabel: string,
  title: string
): boolean {
  const lower = [href, text, ariaLabel, title].join(' ').toLowerCase()
  const patterns = [
    'kig-indenfor',
    'kig indenfor',
    'indenfor',
    'galleri',
    'gallery',
    'foto',
    'fotos',
    'billeder',
    'stemning',
    'interiør',
    'interior',
    'our space',
  ]
  return patterns.some((p) => lower.includes(p))
}

/**
 * Extract "hero signals" from cleaned page text
 * Prioritizes H1-H3 headings with surrounding context
 */
export function extractHeroSignalsFromCleanText(pageText: string): string {
  if (!pageText) return ''
  const lines = pageText.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return ''

  // Prefer the first few semantic heading markers and a couple lines after each.
  const collected: string[] = []
  const maxHeadings = 3
  let headingsSeen = 0

  for (let i = 0; i < lines.length && headingsSeen < maxHeadings; i++) {
    const line = lines[i]
    const isHeading =
      line.startsWith('### H1:') ||
      line.startsWith('## H2:') ||
      line.startsWith('# H3:')

    if (!isHeading) continue

    headingsSeen++
    if (!collected.includes(line)) collected.push(line)

    // Add up to 2 following non-heading lines as context.
    let added = 0
    for (let j = i + 1; j < lines.length && added < 2; j++) {
      const next = lines[j]
      if (next.startsWith('### H1:') || next.startsWith('## H2:') || next.startsWith('# H3:')) break
      if (next.length < 3) continue
      const snippet = next.length > 180 ? next.slice(0, 180) + '…' : next
      collected.push(`  ${snippet}`)
      added++
    }
  }

  if (collected.length === 0) {
    // Fallback: first 3 meaningful lines
    const fallback = lines.slice(0, 3).map((l) => (l.length > 180 ? l.slice(0, 180) + '…' : l))
    return fallback.length > 0 ? `HERO SIGNALS:\n${fallback.map((l) => `- ${l}`).join('\n')}` : ''
  }

  return `HERO SIGNALS:\n${collected.map((l) => `- ${l}`).join('\n')}`
}

/**
 * Extract "about" text block from homepage HTML
 * Prioritizes Danish content over English
 */
export function extractAboutBlock(html: string): string {
  // Danish keywords (prioritized) - check these first
  const danishKeywords = [
    'velkommen', 'om os', 'vores', 'vi er', 'hos os',
    'restaurant', 'café', 'køkken', 'brunch', 'frokost',
    'historie', 'tradition', 'passion', 'filosofi',
    'åbent', 'beliggende', 'serverer', 'tilbyder'
  ]

  // English keywords (fallback)
  const englishKeywords = [
    'welcome', 'about us', 'about', 'our', 'we are', 'at our',
    'kitchen', 'story', 'philosophy', 'offers', 'serves'
  ]

  // Combined for matching
  const aboutKeywords = [...danishKeywords, ...englishKeywords]

  // Helper to check if text is likely Danish (contains æ, ø, å or common Danish words)
  const isDanish = (text: string): boolean => {
    const lower = text.toLowerCase()
    return /[æøå]/.test(lower) ||
           danishKeywords.some(kw => lower.includes(kw)) ||
           /\b(og|til|med|fra|den|det|er|på|i)\b/.test(lower)
  }

  const candidates: Array<{text: string; isDanish: boolean}> = []

  // Try to find content after H1/H2 headings
  const headingBlocks = html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>([\s\S]{0,1500}?)(?=<h[12]|<footer|<nav|$)/gi)
  for (const match of headingBlocks) {
    const headingText = match[1].replace(/<[^>]*>/g, '').toLowerCase()
    const followingContent = match[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

    // Check if heading or content contains about keywords
    const combined = (headingText + ' ' + followingContent).toLowerCase()
    if (aboutKeywords.some(kw => combined.includes(kw)) && followingContent.length > 50) {
      // Return first 2-3 sentences (up to 500 chars)
      const sentences = followingContent.match(/[^.!?]+[.!?]+/g) || []
      const result = sentences.slice(0, 3).join(' ').slice(0, 500).trim()
      if (result.length > 50) {
        candidates.push({ text: result, isDanish: isDanish(result) })
      }
    }
  }

  // Fallback: Look for paragraphs containing about keywords
  const paragraphs = html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)
  for (const match of paragraphs) {
    const text = match[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    if (text.length > 80 && text.length < 800) {
      const lower = text.toLowerCase()
      if (aboutKeywords.some(kw => lower.includes(kw))) {
        // Return first 2-3 sentences
        const sentences = text.match(/[^.!?]+[.!?]+/g) || []
        const result = sentences.slice(0, 3).join(' ').slice(0, 500).trim()
        if (result.length > 50) {
          candidates.push({ text: result, isDanish: isDanish(result) })
        }
      }
    }
  }

  // Prioritize Danish content over English
  const danishCandidate = candidates.find(c => c.isDanish)
  if (danishCandidate) {
    console.log('📝 Found Danish about text (prioritized)')
    return danishCandidate.text
  }

  // Fallback to first candidate (even if English)
  if (candidates.length > 0) {
    console.log('📝 Using first about text candidate (no Danish found)')
    return candidates[0].text
  }

  // Last fallback: empty string (caller can use meta description)
  return ''
}

/**
 * Detect if a website likely needs advanced browser-based scraping
 * (JavaScript rendering, SPA frameworks, etc.)
 */
export function needsAdvancedScraping(url: string, html?: string): boolean {
  // Check URL patterns that typically indicate JavaScript-heavy sites
  const jsHeavyDomains = [
    'wolt.com', 'nemlig.com', 'hungry.dk', 'just-eat.dk',
    'ubereats.com', 'deliveroo.', 'foodora.', 'bolt.eu',
    'soukaarhus.dk'  // SPA with cookie consent blocking
  ]

  if (jsHeavyDomains.some(domain => url.includes(domain))) {
    return true
  }

  // If we have HTML, check for SPA framework indicators
  if (html) {
    const spaIndicators = [
      /<div[^>]*id=["']root["']/i,           // React root
      /<div[^>]*id=["']app["']/i,            // Vue/general SPA
      /ng-app|ng-controller|ng-version/i,    // Angular
      /<script[^>]*src=["'][^"']*react/i,    // React bundle
      /<script[^>]*src=["'][^"']*vue/i,      // Vue bundle
      /<script[^>]*src=["'][^"']*angular/i,  // Angular bundle
      /__NEXT_DATA__|_next\//i,              // Next.js
      /__NUXT__|_nuxt\//i,                   // Nuxt.js
    ]

    const hasMinimalContent = html.replace(/<[^>]*>/g, '').trim().length < 500
    const hasSpaIndicators = spaIndicators.some(pattern => pattern.test(html))

    if (hasMinimalContent && hasSpaIndicators) {
      return true
    }
  }

  return false
}
