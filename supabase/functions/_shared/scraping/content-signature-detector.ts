/**
 * Content Signature Detection System
 * 
 * Purpose: Analyze website architecture BEFORE committing to scraping strategy
 * Detects: Static HTML, JS-heavy SPAs, Hybrid SSR, API availability
 * 
 * This enables intelligent routing to optimal extraction tools based on content type.
 */

export type ContentClassification = 
  | 'STATIC_RICH'      // JSON-LD + minimal JS → Simple fetch
  | 'STATIC_SIMPLE'    // Basic HTML, no JSON-LD → Simple fetch
  | 'DYNAMIC_SPA'      // Heavy JS, minimal SSR → Puppeteer required
  | 'HYBRID'           // Server-rendered + client hydration → Puppeteer or fetch
  | 'API_AVAILABLE'    // Public API endpoints → Direct HTTP

export type RecommendedScraper = 
  | 'SIMPLE_FETCH' 
  | 'PUPPETEER' 
  | 'DIRECT_API'

export type EstimatedCost = 'LOW' | 'MEDIUM' | 'HIGH'

export interface ContentSignature {
  classification: ContentClassification
  confidence: number  // 0-1
  evidence: {
    hasJsonLd: boolean
    scriptTagCount: number
    frameworkDetected: string | null
    apiEndpoints: string[]
    contentLength: number
    renderingHints: string[]
    seoMetaQuality: 'HIGH' | 'MEDIUM' | 'LOW'
  }
  recommendedScraper: RecommendedScraper
  estimatedCost: EstimatedCost
  detectionTime: number  // milliseconds
}

interface HeadAnalysis {
  contentType: string
  contentLength: number | null
  renderingHints: string[]
}

interface HtmlPeekAnalysis {
  hasJsonLd: boolean
  scriptTagCount: number
  frameworkDetected: string | null
  apiEndpoints: string[]
  seoMetaQuality: 'HIGH' | 'MEDIUM' | 'LOW'
}

/**
 * Step 1: Analyze HTTP headers (lightweight, 2s timeout)
 */
async function analyzeHeaders(url: string): Promise<HeadAnalysis> {
  const startTime = Date.now()
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BusinessProfileBot/1.0)'
      }
    })
    
    clearTimeout(timeoutId)
    
    const contentType = response.headers.get('content-type') || ''
    const contentLengthStr = response.headers.get('content-length')
    const contentLength = contentLengthStr ? parseInt(contentLengthStr, 10) : null
    
    const renderingHints: string[] = []
    
    // Detect server-side rendering hints
    const poweredBy = response.headers.get('x-powered-by')
    if (poweredBy) {
      renderingHints.push(`x-powered-by: ${poweredBy}`)
      if (poweredBy.toLowerCase().includes('next')) renderingHints.push('next.js')
      if (poweredBy.toLowerCase().includes('nuxt')) renderingHints.push('nuxt')
    }
    
    const renderedBy = response.headers.get('x-rendered-by')
    if (renderedBy) {
      renderingHints.push(`x-rendered-by: ${renderedBy}`)
    }
    
    const server = response.headers.get('server')
    if (server?.toLowerCase().includes('netlify')) renderingHints.push('netlify')
    if (server?.toLowerCase().includes('vercel')) renderingHints.push('vercel')
    
    console.log(`📊 HEAD analysis (${Date.now() - startTime}ms):`, {
      contentType,
      contentLength,
      renderingHints
    })
    
    return { contentType, contentLength, renderingHints }
    
  } catch (error) {
    console.log('⚠️ HEAD request failed, using defaults:', error)
    return {
      contentType: 'text/html',
      contentLength: null,
      renderingHints: []
    }
  }
}

/**
 * Step 2: Peek at first 10KB of HTML (quick content analysis)
 */
async function peekHtml(url: string): Promise<HtmlPeekAnalysis> {
  const startTime = Date.now()
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BusinessProfileBot/1.0)',
        'Range': 'bytes=0-10239'  // First 10KB only
      }
    })
    
    clearTimeout(timeoutId)
    
    let htmlPeek = await response.text()
    
    // If Range not supported, truncate the response
    if (htmlPeek.length > 10240) {
      htmlPeek = htmlPeek.slice(0, 10240)
    }
    
    // Detect JSON-LD structured data
    const hasJsonLd = /<script[^>]+type=["']application\/ld\+json["']/i.test(htmlPeek)
    
    // Count script tags (indicator of JS-heavy site)
    const scriptMatches = htmlPeek.match(/<script/gi)
    const scriptTagCount = scriptMatches ? scriptMatches.length : 0
    
    // Detect frameworks
    let frameworkDetected: string | null = null
    if (htmlPeek.includes('__NEXT_DATA__')) frameworkDetected = 'Next.js'
    else if (htmlPeek.includes('window.__NUXT__')) frameworkDetected = 'Nuxt.js'
    else if (htmlPeek.includes('___gatsby')) frameworkDetected = 'Gatsby'
    else if (htmlPeek.includes('data-reactroot') || htmlPeek.includes('<div id="root"')) frameworkDetected = 'React'
    else if (htmlPeek.includes('<div id="app"') || htmlPeek.includes('v-bind') || htmlPeek.includes('v-if')) frameworkDetected = 'Vue.js'
    else if (htmlPeek.includes('wp-content') || htmlPeek.includes('wp-includes')) frameworkDetected = 'WordPress'
    
    // Detect API endpoints
    const apiEndpoints: string[] = []
    const linkMatches = htmlPeek.matchAll(/<link[^>]+rel=["']alternate["'][^>]+type=["']application\/json["'][^>]+href=["']([^"']+)["']/gi)
    for (const match of linkMatches) {
      apiEndpoints.push(match[1])
    }
    
    // Common API patterns
    if (htmlPeek.includes('/api/menu') || htmlPeek.includes('"/api/')) {
      apiEndpoints.push('/api/*')
    }
    if (htmlPeek.includes('/wp-json/')) {
      apiEndpoints.push('/wp-json/*')
    }
    if (htmlPeek.includes('/.netlify/functions/')) {
      apiEndpoints.push('/.netlify/functions/*')
    }
    
    // Assess SEO meta quality (indicates static vs dynamic)
    let seoMetaQuality: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW'
    const hasTitle = /<title>[^<]{10,}<\/title>/i.test(htmlPeek)
    const hasMetaDesc = /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{30,}["']/i.test(htmlPeek)
    const hasOgTags = /<meta[^>]+property=["']og:/i.test(htmlPeek)
    
    if (hasTitle && hasMetaDesc && hasOgTags) seoMetaQuality = 'HIGH'
    else if (hasTitle && (hasMetaDesc || hasOgTags)) seoMetaQuality = 'MEDIUM'
    
    console.log(`🔍 HTML peek analysis (${Date.now() - startTime}ms):`, {
      hasJsonLd,
      scriptTagCount,
      frameworkDetected,
      apiEndpointCount: apiEndpoints.length,
      seoMetaQuality
    })
    
    return {
      hasJsonLd,
      scriptTagCount,
      frameworkDetected,
      apiEndpoints,
      seoMetaQuality
    }
    
  } catch (error) {
    console.log('⚠️ HTML peek failed, using defaults:', error)
    return {
      hasJsonLd: false,
      scriptTagCount: 0,
      frameworkDetected: null,
      apiEndpoints: [],
      seoMetaQuality: 'LOW'
    }
  }
}

/**
 * Step 3: Classify content and recommend scraping strategy
 */
function classifyContent(
  headAnalysis: HeadAnalysis,
  htmlAnalysis: HtmlPeekAnalysis
): ContentSignature {
  const evidence = {
    hasJsonLd: htmlAnalysis.hasJsonLd,
    scriptTagCount: htmlAnalysis.scriptTagCount,
    frameworkDetected: htmlAnalysis.frameworkDetected,
    apiEndpoints: htmlAnalysis.apiEndpoints,
    contentLength: headAnalysis.contentLength || 0,
    renderingHints: headAnalysis.renderingHints,
    seoMetaQuality: htmlAnalysis.seoMetaQuality
  }
  
  // Decision logic
  let classification: ContentClassification
  let confidence: number
  let recommendedScraper: RecommendedScraper
  let estimatedCost: EstimatedCost
  
  // Priority 1: API available
  if (htmlAnalysis.apiEndpoints.length > 0) {
    classification = 'API_AVAILABLE'
    confidence = 0.7
    recommendedScraper = 'DIRECT_API'
    estimatedCost = 'LOW'
  }
  // Priority 2: Rich static content (JSON-LD + minimal JS)
  else if (htmlAnalysis.hasJsonLd && htmlAnalysis.scriptTagCount < 5 && htmlAnalysis.seoMetaQuality === 'HIGH') {
    classification = 'STATIC_RICH'
    confidence = 0.9
    recommendedScraper = 'SIMPLE_FETCH'
    estimatedCost = 'LOW'
  }
  // Priority 3: Dynamic SPA (heavy JS, small HTML, no SEO)
  else if (htmlAnalysis.scriptTagCount > 10 && headAnalysis.contentLength && headAnalysis.contentLength < 5000) {
    classification = 'DYNAMIC_SPA'
    confidence = 0.85
    recommendedScraper = 'PUPPETEER'
    estimatedCost = 'HIGH'
  }
  // Priority 4: Hybrid (framework detected with server rendering)
  else if (
    htmlAnalysis.frameworkDetected && 
    (htmlAnalysis.frameworkDetected === 'Next.js' || htmlAnalysis.frameworkDetected === 'Nuxt.js' || htmlAnalysis.seoMetaQuality === 'HIGH')
  ) {
    classification = 'HYBRID'
    confidence = 0.75
    // Hybrid can often work with fetch if SEO is good
    recommendedScraper = htmlAnalysis.seoMetaQuality === 'HIGH' ? 'SIMPLE_FETCH' : 'PUPPETEER'
    estimatedCost = recommendedScraper === 'SIMPLE_FETCH' ? 'LOW' : 'MEDIUM'
  }
  // Priority 5: Simple static (no JSON-LD but decent SEO)
  else if (htmlAnalysis.scriptTagCount < 8 && htmlAnalysis.seoMetaQuality !== 'LOW') {
    classification = 'STATIC_SIMPLE'
    confidence = 0.7
    recommendedScraper = 'SIMPLE_FETCH'
    estimatedCost = 'LOW'
  }
  // Default: Assume needs Puppeteer (safest fallback)
  else {
    classification = 'DYNAMIC_SPA'
    confidence = 0.5  // Low confidence in ambiguous cases
    recommendedScraper = 'PUPPETEER'
    estimatedCost = 'MEDIUM'
  }
  
  console.log(`🎯 Content classification: ${classification} (confidence: ${confidence}, scraper: ${recommendedScraper})`)
  
  return {
    classification,
    confidence,
    evidence,
    recommendedScraper,
    estimatedCost,
    detectionTime: 0  // Will be set by caller
  }
}

/**
 * Main function: Detect content signature before scraping
 * 
 * @param url - Website URL to analyze
 * @returns Content signature with scraping recommendations
 */
export async function detectContentSignature(url: string): Promise<ContentSignature> {
  const startTime = Date.now()
  
  console.log('🔍 Starting content signature detection for:', url)
  
  try {
    // Run HEAD and HTML peek in parallel for speed
    const [headAnalysis, htmlAnalysis] = await Promise.all([
      analyzeHeaders(url),
      peekHtml(url)
    ])
    
    const signature = classifyContent(headAnalysis, htmlAnalysis)
    signature.detectionTime = Date.now() - startTime
    
    console.log(`✅ Content signature detected in ${signature.detectionTime}ms`)
    
    return signature
    
  } catch (error) {
    console.error('❌ Content signature detection failed:', error)
    
    // Fallback to safe defaults
    return {
      classification: 'DYNAMIC_SPA',  // Safest assumption
      confidence: 0.3,  // Low confidence
      evidence: {
        hasJsonLd: false,
        scriptTagCount: 0,
        frameworkDetected: null,
        apiEndpoints: [],
        contentLength: 0,
        renderingHints: [],
        seoMetaQuality: 'LOW'
      },
      recommendedScraper: 'PUPPETEER',
      estimatedCost: 'MEDIUM',
      detectionTime: Date.now() - startTime
    }
  }
}

/**
 * Helper: Cache content signatures to avoid repeated detection
 * (7-day cache for stable sites)
 */
export function getCacheKey(url: string): string {
  // Normalize URL to use as cache key
  try {
    const urlObj = new URL(url)
    return `content-sig:${urlObj.hostname}${urlObj.pathname}`
  } catch {
    return `content-sig:${url}`
  }
}
