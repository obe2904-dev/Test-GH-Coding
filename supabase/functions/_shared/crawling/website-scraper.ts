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

export interface NavigationElement {
  type: 'link' | 'button' | 'clickable'
  href?: string
  text: string
  onClick?: boolean
  role?: string
  ariaLabel?: string
}

export interface NavigationData {
  totalElements: number
  elements: NavigationElement[]
}

export interface ScrapeResult {
  html: string
  navigationData?: NavigationData
  usedAdvancedScraping: boolean
  scraperType: 'simple-fetch' | 'cloud-run-puppeteer'
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
 * Get Google Cloud identity token for invoking authenticated Cloud Run services
 * Uses service account credentials stored in environment variable
 */
async function getCloudRunIdentityToken(audience: string): Promise<string | null> {
  try {
    const serviceAccountJson = Deno.env.get('GCP_SERVICE_ACCOUNT_KEY')
    
    if (!serviceAccountJson) {
      console.warn('⚠️ GCP_SERVICE_ACCOUNT_KEY not set, skipping IAM authentication')
      return null
    }

    const serviceAccount = JSON.parse(serviceAccountJson)
    const { client_email, private_key } = serviceAccount

    if (!client_email || !private_key) {
      console.error('❌ Invalid service account JSON')
      return null
    }

    // Create JWT for Google OAuth token endpoint
    const now = Math.floor(Date.now() / 1000)
    const jwtHeader = { alg: 'RS256', typ: 'JWT' }
    const jwtPayload = {
      iss: client_email,
      sub: client_email,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
      target_audience: audience
    }

    // Import the private key
    const pemHeader = '-----BEGIN PRIVATE KEY-----'
    const pemFooter = '-----END PRIVATE KEY-----'
    const pemContents = private_key.replace(/\\n/g, '\n').replace(pemHeader, '').replace(pemFooter, '').trim()
    
    const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))
    
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    )

    // Sign the JWT
    const encoder = new TextEncoder()
    const headerB64 = btoa(JSON.stringify(jwtHeader)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    const payloadB64 = btoa(JSON.stringify(jwtPayload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    const unsignedToken = `${headerB64}.${payloadB64}`
    
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      encoder.encode(unsignedToken)
    )
    
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
    
    const jwt = `${unsignedToken}.${signatureB64}`

    // Exchange JWT for identity token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    })

    if (!tokenResponse.ok) {
      console.error('❌ Failed to get identity token:', tokenResponse.status)
      return null
    }

    const tokenData = await tokenResponse.json()
    return tokenData.id_token || null

  } catch (error: any) {
    console.error('❌ Error getting Cloud Run identity token:', error.message)
    return null
  }
}

/**
 * Scrape using Cloud Run Puppeteer service
 */
export async function scrapeWithPuppeteer(url: string): Promise<ScrapeResult | null> {
  const cloudRunUrl = Deno.env.get('CLOUD_RUN_SCRAPER_URL')
  const cloudRunApiKey = Deno.env.get('CLOUD_RUN_API_KEY')
  
  if (!cloudRunUrl || !cloudRunApiKey) {
    console.log('⚠️ Cloud Run Puppeteer scraper not configured')
    return null
  }
  
  console.log('🚀 Using Cloud Run Puppeteer scraper')
  
  try {
    // Get Google Cloud identity token for authenticated Cloud Run invocation
    const idToken = await getCloudRunIdentityToken(cloudRunUrl)
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': cloudRunApiKey
    }
    
    // Add Authorization header if we have an identity token
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`
      console.log('🔐 Using Cloud Run IAM authentication')
    }
    
    const response = await fetch(cloudRunUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url })
    })
    
    if (!response.ok) {
      console.error('❌ Cloud Run scraper HTTP error:', response.status)
      const errorText = await response.text()
      console.error('   Response:', errorText)
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
