// supabase/functions/_shared/crawling/website-scraper.ts
// Website scraping utilities with simple HTTP fetch

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
  // Options reserved for future use
}

export interface ScrapeResult {
  html: string
  usedAdvancedScraping: boolean
  scraperType: 'simple-fetch'
}

/**
 * Main scraping function using simple HTTP fetch
 */
export async function scrapeWebsite(
  url: string,
  options: ScrapeOptions = {}
): Promise<ScrapeResult> {
  console.log('🌐 Fetching homepage:', url)
  console.log('📄 Using simple fetch')
  
  const controller = new AbortController()
  const timeoutMs = 15000  // 15s timeout
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  
  try {
    const response = await fetch(url, {
      headers: USER_AGENT_HEADERS,
      signal: controller.signal
    })
    
    console.log('📡 Homepage response status:', response.status)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch website: ${response.status} ${response.statusText}`)
    }
    
    const html = await response.text()
    console.log('📄 Homepage HTML length:', html.length)
    
    clearTimeout(timeoutId)
    
    return {
      html,
      usedAdvancedScraping: false,
      scraperType: 'simple-fetch'
    }
    
  } catch (error: any) {
    clearTimeout(timeoutId)
    
    if (error.name === 'AbortError') {
      throw new Error(`Website took too long to respond (timeout after ${timeoutMs / 1000} seconds)`)
    }
    
    throw error
  }
}
