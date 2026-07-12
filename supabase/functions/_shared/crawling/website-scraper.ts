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
  scraperType: 'simple-fetch' | 'cloud-run-puppeteer' | 'puppeteer-vercel'
}

/**
 * Extract visible text length (strips scripts, styles, tags, CSS imports)
 * This detects JS-heavy SPAs that have large HTML but minimal visible content
 */
function extractVisibleTextLength(html: string): number {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    // Remove CSS @import statements and comments that appear in HTML
    .replace(/@import\s+url\([^)]+\);?/gi, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length
}

/**
 * Scrape using Puppeteer service (Vercel or Cloud Run)
 * Checks Vercel first, then falls back to Cloud Run
 */
export async function scrapeWithPuppeteer(url: string): Promise<ScrapeResult | null> {
  // Try Vercel scraper first
  const vercelUrl = Deno.env.get('VERCEL_SCRAPER_URL')
  const vercelApiKey = Deno.env.get('VERCEL_SCRAPER_API_KEY')
  
  if (vercelUrl && vercelApiKey) {
    console.log('🚀 Attempting Vercel Puppeteer scraper')
    
    try {
      const response = await fetch(vercelUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': vercelApiKey
        },
        body: JSON.stringify({ url })
      })
      
      if (!response.ok) {
        console.error('❌ Vercel scraper HTTP error:', response.status)
        const text = await response.text()
        console.error('   Response:', text)
      } else {
        const data = await response.json()
        
        if (!data.html) {
          console.error('❌ Vercel scraper returned no HTML:', data.error || 'unknown error')
        } else {
          console.log(`✅ Vercel Puppeteer succeeded, HTML length:`, data.html.length)
          
          return {
            html: data.html,
            usedAdvancedScraping: true,
            scraperType: 'puppeteer-vercel'
          }
        }
      }
    } catch (error: any) {
      console.error('❌ Vercel scraper error:', error.message)
    }
    
    console.log('⚠️ Vercel scraper failed, trying Cloud Run fallback...')
  }
  
  // Fall back to Cloud Run scraper
  const cloudRunUrl = Deno.env.get('CLOUD_RUN_SCRAPER_URL')
  const cloudRunApiKey = Deno.env.get('CLOUD_RUN_API_KEY')
  
  if (!cloudRunUrl || !cloudRunApiKey) {
    console.log('⚠️ No Puppeteer scraper configured (checked both Vercel and Cloud Run)')
    return null
  }
  
  console.log('🚀 Attempting Cloud Run Puppeteer scraper')
  
  try {
    const response = await fetch(cloudRunUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cloudRunApiKey
      },
      body: JSON.stringify({ url })
    })
    
    if (!response.ok) {
      console.error('❌ Cloud Run scraper HTTP error:', response.status)
      return null
    }
    
    const data = await response.json()
    
    if (!data.html) {
      console.error('❌ Cloud Run scraper returned no HTML:', data.error || 'unknown error')
      return null
    }
    
    console.log(`✅ Cloud Run Puppeteer succeeded, HTML length:`, data.html.length)
    
    return {
      html: data.html,
      usedAdvancedScraping: true,
      scraperType: 'cloud-run-puppeteer'
    }
    
  } catch (error: any) {
    console.error('❌ Cloud Run scraper error:', error.message)
    return null
  }
}

/**
 * Main scraping function with Cloud Run fallback
 */
export async function scrapeWebsite(
  url: string,
  options: ScrapeOptions = {}
): Promise<ScrapeResult> {
  console.log('🌐 Fetching homepage:', url)
  console.log('📄 Trying simple fetch first')
  
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
    
    // Check visible text content (not raw HTML bytes) to detect JS-heavy SPAs
    const visibleTextLength = extractVisibleTextLength(html)
    console.log(`📝 Visible text: ${visibleTextLength} chars (raw HTML: ${html.length} chars)`)
    
    // If visible text is too thin, this is likely a JS-heavy SPA that needs rendering
    // Threshold: 2000 chars (CSS imports/comments can easily be 500-1000 chars)
    if (visibleTextLength < 2000) {
      console.log('⚠️ Visible text too thin (< 2000 chars) — likely JS-heavy SPA, escalating to Puppeteer')
      const puppeteerResult = await scrapeWithPuppeteer(url)
      if (puppeteerResult) {
        return puppeteerResult
      }
      console.log('⚠️ Puppeteer unavailable, using simple fetch result anyway')
    } else {
      console.log(`✅ Sufficient visible text (${visibleTextLength} chars >= 2000 threshold) — using simple fetch`)
    }
    
    return {
      html,
      usedAdvancedScraping: false,
      scraperType: 'simple-fetch'
    }
    
  } catch (error: any) {
    clearTimeout(timeoutId)
    
    console.error('❌ Simple fetch failed:', error.message)
    
    // Try Puppeteer as fallback
    const puppeteerResult = await scrapeWithPuppeteer(url)
    if (puppeteerResult) {
      return puppeteerResult
    }
    
    // Both failed, throw original error
    if (error.name === 'AbortError') {
      throw new Error(`Website took too long to respond (timeout after ${timeoutMs / 1000} seconds)`)
    }
    
    throw error
  }
}
