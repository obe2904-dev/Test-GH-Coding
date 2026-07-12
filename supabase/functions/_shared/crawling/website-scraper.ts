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
 * Extract visible text (strips scripts, styles, tags, CSS imports)
 * This detects JS-heavy SPAs that have large HTML but minimal visible content
 */
function extractVisibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    // Remove CSS @import statements and comments that appear in HTML
    .replace(/@import\s+url\([^)]+\);?/gi, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Count navigation links in HTML
 * SPAs typically have 0-2 links in raw HTML (everything else is rendered by JS)
 */
function countLinks(html: string): number {
  return (html.match(/<a\s+[^>]*href=/gi) || []).length
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
    
    // Multi-signal SPA detection: check BOTH visible text AND navigation links
    // SPAs have minimal visible text AND few/no links in raw HTML (everything renders via JS)
    const visibleText = extractVisibleText(html)
    const visibleTextLength = visibleText.length
    const linkCount = countLinks(html)
    
    console.log(`📝 Visible text: ${visibleTextLength} chars, ${linkCount} links (raw HTML: ${html.length} chars)`)
    
    // Log first 800 chars to diagnose what content we're actually seeing
    if (visibleTextLength > 0) {
      console.log('📄 Visible text sample (first 800 chars):')
      console.log(visibleText.slice(0, 800))
    }
    
    // Compound check: Need BOTH sufficient text AND navigation links
    const hasSufficientText = visibleTextLength >= 800
    const hasNavigation = linkCount >= 3
    const isSufficient = hasSufficientText && hasNavigation
    
    // Zero links = auto-escalate (no legit business site has zero navigation)
    if (linkCount === 0) {
      console.log('🚨 Zero navigation links detected → SPA confirmed, escalating to Puppeteer')
      const puppeteerResult = await scrapeWithPuppeteer(url)
      if (puppeteerResult) return puppeteerResult
      console.log('⚠️ Puppeteer unavailable, using simple fetch result anyway')
    }
    // Suspiciously few links for large HTML
    else if (linkCount < 3 && html.length > 500000) {
      console.log(`⚠️ Large HTML (${Math.round(html.length / 1000)}KB) but only ${linkCount} links → likely SPA, escalating to Puppeteer`)
      const puppeteerResult = await scrapeWithPuppeteer(url)
      if (puppeteerResult) return puppeteerResult
      console.log('⚠️ Puppeteer unavailable, using simple fetch result anyway')
    }
    // Insufficient text or navigation
    else if (!isSufficient) {
      console.log(`⚠️ Insufficient content (text: ${visibleTextLength} < 800 or links: ${linkCount} < 3) → escalating to Puppeteer`)
      const puppeteerResult = await scrapeWithPuppeteer(url)
      if (puppeteerResult) return puppeteerResult
      console.log('⚠️ Puppeteer unavailable, using simple fetch result anyway')
    } 
    else {
      console.log(`✅ Sufficient content (${visibleTextLength} chars, ${linkCount} links) — using simple fetch`)
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
