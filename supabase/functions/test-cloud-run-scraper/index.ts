// @ts-ignore - Deno import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// @ts-ignore - Deno global
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * TEST CLOUD RUN SCRAPER
 * 
 * This is a simplified test function that ONLY uses Cloud Run Puppeteer scraping.
 * No cache, no simple fetch, no fallbacks - pure Cloud Run testing.
 */

/**
 * Get Google Cloud identity token for invoking authenticated Cloud Run services
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

    // Base64url encode
    const base64UrlEncode = (obj: any) =>
      btoa(JSON.stringify(obj))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')

    const headerEncoded = base64UrlEncode(jwtHeader)
    const payloadEncoded = base64UrlEncode(jwtPayload)
    const signatureInput = `${headerEncoded}.${payloadEncoded}`

    // Import the private key and sign
    const encoder = new TextEncoder()
    const keyData = encoder.encode(private_key)
    
    // Extract key content between BEGIN/END markers
    const pemContent = private_key
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s/g, '')
    
    const binaryKey = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0))
    
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signatureBuffer = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      encoder.encode(signatureInput)
    )

    const signatureArray = new Uint8Array(signatureBuffer)
    const signatureBase64 = btoa(String.fromCharCode(...signatureArray))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')

    const jwt = `${signatureInput}.${signatureBase64}`

    // Exchange JWT for identity token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ Token exchange failed:', errorText)
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
 * Call Cloud Run Puppeteer scraper directly
 */
async function callCloudRunScraper(url: string): Promise<{
  success: boolean
  html?: string
  error?: string
  timing: number
  metadata?: any
}> {
  const startTime = Date.now()
  const cloudRunUrl = Deno.env.get('CLOUD_RUN_SCRAPER_URL')
  const cloudRunApiKey = Deno.env.get('CLOUD_RUN_API_KEY')
  
  if (!cloudRunUrl || !cloudRunApiKey) {
    return {
      success: false,
      error: 'Cloud Run not configured. Missing CLOUD_RUN_SCRAPER_URL or CLOUD_RUN_API_KEY',
      timing: Date.now() - startTime
    }
  }
  
  console.log('🚀 Calling Cloud Run Puppeteer scraper:', cloudRunUrl)
  console.log('📍 Target URL:', url)
  
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
    
    const timing = Date.now() - startTime
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Cloud Run HTTP error:', response.status)
      console.error('   Response:', errorText)
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        timing
      }
    }
    
    const data = await response.json()
    
    if (!data.html) {
      return {
        success: false,
        error: data.error || 'No HTML returned from Cloud Run',
        timing
      }
    }
    
    console.log(`✅ Cloud Run succeeded - HTML length: ${data.html.length}`)
    
    return {
      success: true,
      html: data.html,
      timing,
      metadata: {
        htmlLength: data.html.length,
        finalUrl: data.finalUrl || url
      }
    }
    
  } catch (error: any) {
    return {
      success: false,
      error: `Cloud Run error: ${error.message}`,
      timing: Date.now() - startTime
    }
  }
}

/**
 * Extract basic structured data from HTML
 */
function extractStructuredData(html: string): {
  about: string[]
  address: string[]
  bookingLinks: string[]
  menuLinks: string[]
  openingHours: string[]
} {
  const result = {
    about: [] as string[],
    address: [] as string[],
    bookingLinks: [] as string[],
    menuLinks: [] as string[],
    openingHours: [] as string[]
  }

  try {
    // Extract about sections (h1, h2, meta description)
    const h1Matches = html.match(/<h1[^>]*>(.*?)<\/h1>/gi) || []
    h1Matches.forEach(match => {
      const text = match.replace(/<[^>]+>/g, '').trim()
      if (text && text.length > 10) result.about.push(text)
    })

    const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    if (metaDesc && metaDesc[1]) result.about.push(metaDesc[1])

    // Extract addresses (look for common patterns)
    const addressPatterns = [
      /\d{4}\s+[A-Za-zÆØÅæøå\s]+/g, // Danish postal codes
      /(?:adresse|address|location)[:\s]*([^<\n]{10,100})/gi
    ]
    addressPatterns.forEach(pattern => {
      const matches = html.match(pattern) || []
      matches.forEach(match => {
        const cleaned = match.replace(/<[^>]+>/g, '').trim()
        if (cleaned.length > 5) result.address.push(cleaned)
      })
    })

    // Extract booking links
    const bookingLinkPatterns = [
      /href=["']([^"']*(?:book|reserv|bord|bestill)[^"']*)["']/gi,
      /href=["'](https?:\/\/[^"']*(?:resdiary|bookatable|opentable|dinerbooking)[^"']*)["']/gi
    ]
    bookingLinkPatterns.forEach(pattern => {
      const matches = [...html.matchAll(pattern)]
      matches.forEach(match => {
        if (match[1] && !result.bookingLinks.includes(match[1])) {
          result.bookingLinks.push(match[1])
        }
      })
    })

    // Extract menu links
    const menuLinkPatterns = [
      /href=["']([^"']*(?:menu|menukort|carte|spis)[^"']*)["']/gi
    ]
    menuLinkPatterns.forEach(pattern => {
      const matches = [...html.matchAll(pattern)]
      matches.forEach(match => {
        if (match[1] && !result.menuLinks.includes(match[1])) {
          result.menuLinks.push(match[1])
        }
      })
    })

    // Extract opening hours
    const hourPatterns = [
      /(?:åbningstid|opening hours?|öffnungszeit)[^<]*?(\d{1,2}[:\.]?\d{0,2}[\s-]+\d{1,2}[:\.]?\d{0,2})/gi,
      /(mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag|mon|tue|wed|thu|fri|sat|sun)[^<\n]*?(\d{1,2}[:\.]?\d{0,2}[\s-]+\d{1,2}[:\.]?\d{0,2})/gi
    ]
    hourPatterns.forEach(pattern => {
      const matches = [...html.matchAll(pattern)]
      matches.forEach(match => {
        const text = match[0].replace(/<[^>]+>/g, '').trim()
        if (text.length < 150) result.openingHours.push(text)
      })
    })

    // Deduplicate and limit results
    result.about = [...new Set(result.about)].slice(0, 5)
    result.address = [...new Set(result.address)].slice(0, 5)
    result.bookingLinks = [...new Set(result.bookingLinks)].slice(0, 10)
    result.menuLinks = [...new Set(result.menuLinks)].slice(0, 10)
    result.openingHours = [...new Set(result.openingHours)].slice(0, 10)

  } catch (error: any) {
    console.error('Error extracting structured data:', error.message)
  }

  return result
}

serve(async (req: any) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log('📥 Test Cloud Run request:', body)
    
    const { url } = body

    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing required field: url' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call Cloud Run scraper
    const scrapeResult = await callCloudRunScraper(url)

    if (!scrapeResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: scrapeResult.error,
          timing: scrapeResult.timing,
          cloudRunUrl: Deno.env.get('CLOUD_RUN_SCRAPER_URL'),
          hasApiKey: !!Deno.env.get('CLOUD_RUN_API_KEY'),
          hasServiceAccount: !!Deno.env.get('GCP_SERVICE_ACCOUNT_KEY')
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Extract structured data
    const structured = extractStructuredData(scrapeResult.html!)

    // Return results
    return new Response(
      JSON.stringify({
        success: true,
        url,
        timing: scrapeResult.timing,
        html: scrapeResult.html,
        htmlLength: scrapeResult.html!.length,
        structured,
        metadata: scrapeResult.metadata
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: any) {
    console.error('❌ Test Cloud Run error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error',
        stack: error.stack
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
