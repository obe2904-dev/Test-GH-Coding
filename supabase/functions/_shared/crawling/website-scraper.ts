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
  scraperWorkerUrl?: string
  workerToken?: string
  forceAdvancedScraping?: boolean
}

export interface ScrapeResult {
  html: string
  usedAdvancedScraping: boolean
}

/**
 * Fetch HTML using advanced browser-based scraping (Playwright worker)
 */
async function fetchWithAdvancedScraper(
  url: string,
  scraperWorkerUrl: string,
  workerToken: string,
  signal?: AbortSignal
): Promise<string> {
  console.log('🚀 Using advanced browser scraping (detected JavaScript/SPA)')
  
  const scraperResp = await fetch(`${scraperWorkerUrl}/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-worker-token': workerToken
    },
    body: JSON.stringify({
      url: url,
      useBrowser: true,
      timeout: 25000
    }),
    signal
  })
  
  if (!scraperResp.ok) {
    throw new Error('Scraper worker failed')
  }
  
  const scraperData = await scraperResp.json()
  console.log('✅ Advanced scraping successful:', scraperData.html.length, 'chars')
  
  return scraperData.html
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
 */
export async function scrapeWebsite(
  url: string,
  options: ScrapeOptions = {}
): Promise<ScrapeResult> {
  const { scraperWorkerUrl, workerToken = '', forceAdvancedScraping = false } = options
  
  console.log('🌐 Fetching homepage:', url)
  
  // Check if we should use advanced browser-based scraping
  const useAdvancedScraper = forceAdvancedScraping || needsAdvancedScraping(url)
  
  // Create abort controller for timeout
  const controller = new AbortController()
  const timeoutMs = useAdvancedScraper ? 30000 : 15000
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  
  let html = ''
  let usedAdvancedScraping = false
  
  try {
    // Try advanced scraping if conditions are met
    if (useAdvancedScraper && scraperWorkerUrl) {
      try {
        html = await fetchWithAdvancedScraper(url, scraperWorkerUrl, workerToken, controller.signal)
        usedAdvancedScraping = true
        clearTimeout(timeoutId)
      } catch (scraperError) {
        console.log('⚠️ Advanced scraper failed, falling back to simple fetch')
        clearTimeout(timeoutId)
        
        // Fallback to simple fetch
        const newController = new AbortController()
        const newTimeoutId = setTimeout(() => newController.abort(), 15000)
        
        try {
          html = await fetchWithSimpleRequest(url, newController.signal)
          clearTimeout(newTimeoutId)
        } catch (fallbackError) {
          clearTimeout(newTimeoutId)
          throw fallbackError
        }
      }
    } else {
      // Use simple fetch
      if (useAdvancedScraper && !scraperWorkerUrl) {
        console.log('⚠️ Advanced scraping recommended but SCRAPER_WORKER_URL not configured')
      }
      
      html = await fetchWithSimpleRequest(url, controller.signal)
      clearTimeout(timeoutId)
      
      // Check if we should retry with advanced scraping based on HTML content
      if (!useAdvancedScraper && scraperWorkerUrl && needsAdvancedScraping(url, html)) {
        console.log('🔄 Detected SPA after initial fetch, retrying with browser scraping')
        
        try {
          html = await fetchWithAdvancedScraper(url, scraperWorkerUrl, workerToken)
          usedAdvancedScraping = true
        } catch (retryError) {
          console.log('⚠️ Retry with advanced scraping failed, using initial content')
        }
      }
    }
    
    return { html, usedAdvancedScraping }
    
  } catch (fetchError: any) {
    clearTimeout(timeoutId)
    
    // Provide more specific error messages
    if (fetchError.name === 'AbortError') {
      throw new Error(`Website took too long to respond (timeout after ${timeoutMs / 1000} seconds)`)
    }
    
    // Handle connection errors with helpful messages
    const errorMsg = fetchError.message || String(fetchError)
    
    // If scraper worker failed and we haven't tried simple fetch yet, try it now
    if (errorMsg.includes('Scraper worker failed')) {
      console.log('🔄 Falling back to simple fetch after scraper failure')
      
      try {
        html = await fetchWithSimpleRequest(url)
        console.log('📄 Fallback fetch succeeded:', html.length, 'chars')
        return { html, usedAdvancedScraping: false }
      } catch (fallbackError: any) {
        const fallbackMsg = fallbackError.message || String(fallbackError)
        throw new Error(provideFriendlyErrorMessage(fallbackMsg))
      }
    }
    
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
