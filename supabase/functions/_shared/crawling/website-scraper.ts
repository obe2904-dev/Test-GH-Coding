// supabase/functions/_shared/crawling/website-scraper.ts
// Website scraping utilities with advanced browser support

import { needsAdvancedScraping } from './html-helpers.ts'

const USER_AGENT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'da,en-US;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Cache-Control': 'max-age=0'
}

export interface ScrapeOptions {
  forceAdvancedScraping?: boolean
  vercelScraperUrl?: string
  vercelScraperApiKey?: string
}

export interface ScrapeResult {
  html: string
  usedAdvancedScraping: boolean
  scraperType?: 'vercel-playwright' | 'simple-fetch'
}

/**
 * Fetch HTML using Vercel Playwright serverless function
 * PRIMARY SCRAPER - Free on Vercel Pro, 60s timeout, full JS rendering
 */
async function fetchWithVercelPlaywright(
  url: string,
  vercelScraperUrl: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<{ html: string; meta: any }> {
  console.log('🎭 Using Vercel Playwright (Primary scraper)')
  
  const response = await fetch(vercelScraperUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url }),
    signal
  })
  
  console.log('📡 Vercel response status:', response.status)
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ Vercel Playwright error:', errorText)
    throw new Error(`Vercel Playwright failed: ${response.status} - ${errorText}`)
  }
  
  const result = await response.json()
  
  if (!result.success || !result.data) {
    throw new Error('Vercel Playwright returned invalid response')
  }
  
  const { html, text, links, headings } = result.data
  
  console.log('✅ Vercel scraping successful:', html.length, 'chars HTML,', text.length, 'chars text')
  console.log('📊 Extracted:', links?.length || 0, 'links,', headings?.length || 0, 'headings')
  
  return { 
    html, 
    meta: { 
      links, 
      headings, 
      text,
      structuredData: result.data.structuredData,
      durationMs: result.meta?.durationMs 
    } 
  }
}

/**
 * Fetch HTML using simple HTTP request with browser headers
 */
async function fetchWithSimpleRequest(
  url: string,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch(url, {
    headers: USER_AGENT_HEADERS,
    signal
  })
  
  console.log('📡 Homepage response status:', response.status)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch website: ${response.status} ${response.statusText}`)
  }
  
  const html = await response.text()
  console.log('📄 Homepage HTML length:', html.length)
  
  return html
}

/**
 * Main scraping function with automatic fallback and retry logic
 * Priority: Vercel Playwright (primary) → Simple Fetch (fallback)
 */
export async function scrapeWebsite(
  url: string,
  options: ScrapeOptions = {}
): Promise<ScrapeResult> {
  const { 
    forceAdvancedScraping = false,
    vercelScraperUrl,
    vercelScraperApiKey
  } = options
  
  console.log('🌐 Fetching homepage:', url)
  
  // Check if we should use advanced browser-based scraping
  const useAdvancedScraper = forceAdvancedScraping || needsAdvancedScraping(url)
  
  let html = ''
  let usedAdvancedScraping = false
  let scraperType: 'vercel-playwright' | 'simple-fetch' = 'simple-fetch'
  
  // PRIORITY 1: Try Vercel Playwright (if configured)
  if (useAdvancedScraper && vercelScraperUrl && vercelScraperApiKey) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 70000)  // 70s (Vercel has 60s limit + buffer)
    
    try {
      console.log('🎯 Attempting primary scraper: Vercel Playwright')
      const result = await fetchWithVercelPlaywright(url, vercelScraperUrl, vercelScraperApiKey, controller.signal)
      html = result.html
      usedAdvancedScraping = true
      scraperType = 'vercel-playwright'
      clearTimeout(timeoutId)
      
      console.log('✅ Vercel Playwright succeeded')
      return { html, usedAdvancedScraping, scraperType }
      
    } catch (vercelError) {
      clearTimeout(timeoutId)
      console.log('⚠️ Vercel Playwright failed:', vercelError)
      console.log('🔄 Falling back to simple fetch...')
      // Continue to fallback below
    }
  } else if (useAdvancedScraper && !vercelScraperUrl) {
    console.log('⚠️ Vercel scraper not configured (missing VERCEL_SCRAPER_URL or API_KEY)')
  }
  
  // PRIORITY 2: Use simple fetch (fallback)
  const controller = new AbortController()
  const timeoutMs = 15000  // 15s for simple fetch
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  
  try {
    if (useAdvancedScraper && !vercelScraperUrl) {
      console.log('⚠️ Advanced scraping recommended but Vercel scraper not configured')
    }
    
    console.log('📄 Using simple fetch')
    html = await fetchWithSimpleRequest(url, controller.signal)
    scraperType = 'simple-fetch'
    clearTimeout(timeoutId)
    
    // Check if we should retry with Vercel based on HTML content
    if (!useAdvancedScraper && needsAdvancedScraping(url, html)) {
      console.log('🔄 Detected SPA after initial fetch')
      
      // Try Vercel Playwright retry
      if (vercelScraperUrl && vercelScraperApiKey) {
        try {
          console.log('🎭 Retrying with Vercel Playwright...')
          const result = await fetchWithVercelPlaywright(url, vercelScraperUrl, vercelScraperApiKey)
          html = result.html
          usedAdvancedScraping = true
          scraperType = 'vercel-playwright'
          console.log('✅ Retry with Vercel succeeded')
          return { html, usedAdvancedScraping, scraperType }
        } catch (retryError) {
          console.log('⚠️ Retry with Vercel failed, using initial content')
        }
      }
    }
    
    return { html, usedAdvancedScraping, scraperType }
    
  } catch (fetchError: any) {
    clearTimeout(timeoutId)
    
    // Provide more specific error messages
    if (fetchError.name === 'AbortError') {
      throw new Error(`Website took too long to respond (timeout after ${timeoutMs / 1000} seconds)`)
    }
    
    // Handle connection errors with helpful messages
    const errorMsg = fetchError.message || String(fetchError)
    
    // Provide friendly error message
    throw new Error(provideFriendlyErrorMessage(errorMsg))
  }
}

/**
 * Convert technical errors to friendly user messages
 */
function provideFriendlyErrorMessage(errorMsg: string): string {
  if (errorMsg.includes('Connection reset') || errorMsg.includes('ECONNRESET')) {
    return 'Website refused connection. The site may be blocking automated requests or temporarily unavailable.'
  }
  if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('timeout')) {
    return 'Website connection timed out. The site may be slow or temporarily unavailable.'
  }
  if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
    return 'Website not found. Please check the URL is correct.'
  }
  if (errorMsg.includes('Failed to fetch website:')) {
    return errorMsg // Already friendly
  }
  
  // Generic fallback
  return `Failed to access website: ${errorMsg}`
}
