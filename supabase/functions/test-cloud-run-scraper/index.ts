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
  
  // Append /scrape-v2 endpoint to the Cloud Run URL (preprocessed structured data)
  const scrapeEndpoint = `${cloudRunUrl}/scrape-v2`
  
  console.log('🚀 Calling Cloud Run Puppeteer scraper v2:', scrapeEndpoint)
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
    
    const response = await fetch(scrapeEndpoint, {
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
    
    // V2 endpoint returns structured payload instead of raw HTML
    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Cloud Run scraper failed',
        timing
      }
    }
    
    console.log(`✅ Cloud Run v2 succeeded - content quality: ${data.content_quality}, menu source: ${data.menu_source}`)
    console.log(`   Payload size: ${JSON.stringify(data).length} bytes, reduction: ${data.scraper_metadata?.reduction_ratio}`)
    
    return {
      success: true,
      payload: data, // Return the entire v2 structured payload
      timing,
      metadata: {
        contentQuality: data.content_quality,
        menuSource: data.menu_source,
        payloadSize: JSON.stringify(data).length,
        reduction: data.scraper_metadata?.reduction_ratio
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
    // First: Extract Schema.org JSON-LD data (before cleaning HTML)
    const schemaMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis) || []
    
    // Create clean HTML without scripts and styles for pattern matching
    const cleanHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
    
    // Extract about sections (h1, h2, meta description)
    const h1Matches = cleanHtml.match(/<h1[^>]*>(.*?)<\/h1>/gi) || []
    h1Matches.forEach(match => {
      const text = match.replace(/<[^>]+>/g, '').trim()
      if (text && text.length > 10 && text.length < 200) result.about.push(text)
    })

    const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    if (metaDesc && metaDesc[1]) result.about.push(metaDesc[1])

    // Extract addresses (Schema.org, meta tags, and patterns)
    // 1. Schema.org JSON-LD
    schemaMatches.forEach(scriptTag => {
      try {
        const jsonMatch = scriptTag.match(/>(.+)<\/script>/is)
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[1])
          const extractAddress = (obj: any): void => {
            if (obj.address) {
              if (typeof obj.address === 'string') {
                result.address.push(obj.address)
              } else if (obj.address.streetAddress || obj.address.addressLocality) {
                const parts = [
                  obj.address.streetAddress,
                  obj.address.postalCode,
                  obj.address.addressLocality,
                  obj.address.addressCountry
                ].filter(Boolean)
                if (parts.length > 0) result.address.push(parts.join(', '))
              }
            }
          }
          if (Array.isArray(data)) {
            data.forEach(extractAddress)
          } else {
            extractAddress(data)
          }
        }
      } catch (e) {
        // Skip invalid JSON
      }
    })

    // 2. Meta tags with address
    const metaAddress = html.match(/<meta[^>]*(?:property|name)=["'](?:og:street-address|business:contact_data:street_address)["'][^>]*content=["']([^"']+)["']/i)
    if (metaAddress && metaAddress[1]) result.address.push(metaAddress[1])

    // 3. Common address patterns (use cleanHtml to avoid matching JSON)
    const addressPatterns = [
      // Multi-line address with postal code (Åboulevarden 32\n8000 Aarhus C)
      /([A-ZÆØÅa-zæøå][A-ZÆØÅa-zæøå\s.]+\s+\d+[A-Za-z]?)\s*[\n\r]+\s*(\d{4}\s+[A-ZÆØÅa-zæøå][A-ZÆØÅa-zæøå\s,]+)/g,
      // Single-line address (Street 15, 8000 City)
      /\b([A-ZÆØÅa-zæøå][A-ZÆØÅa-zæøå\s.]+\s+\d+[A-Za-z]?,?\s+\d{4}\s+[A-ZÆØÅa-zæøå][A-ZÆØÅa-zæøå\s,]+)/g,
      // Just postal + city
      /\b(\d{4}\s+[A-ZÆØÅa-zæøå][A-ZÆØÅa-zæøå\s]+(?:,\s*[A-Za-z]+)?)/g
    ]
    addressPatterns.forEach(pattern => {
      const matches = cleanHtml.match(pattern) || []
      matches.forEach(match => {
        const cleaned = match
          .replace(/<[^>]+>/g, '') // Remove any HTML tags
          .replace(/[\n\r]+/g, ', ') // Convert newlines to comma-space
          .replace(/,\s*,/g, ',') // Remove double commas
          .replace(/^\w+[:\s]+/i, '') // Remove label prefixes
          .trim()
        if (cleaned.length >= 10 && /\d{4}/.test(cleaned)) { // Must have postal code
          result.address.push(cleaned)
        }
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

    // Extract opening hours (Schema.org, tables, and patterns)
    // 1. Schema.org openingHoursSpecification
    schemaMatches.forEach(scriptTag => {
      try {
        const jsonMatch = scriptTag.match(/>(.+)<\/script>/is)
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[1])
          const extractHours = (obj: any): void => {
            // openingHours simple string
            if (obj.openingHours) {
              if (typeof obj.openingHours === 'string') {
                result.openingHours.push(obj.openingHours)
              } else if (Array.isArray(obj.openingHours)) {
                result.openingHours.push(...obj.openingHours)
              }
            }
            // openingHoursSpecification detailed format
            if (obj.openingHoursSpecification) {
              const specs = Array.isArray(obj.openingHoursSpecification) 
                ? obj.openingHoursSpecification 
                : [obj.openingHoursSpecification]
              specs.forEach((spec: any) => {
                const days = spec.dayOfWeek ? (Array.isArray(spec.dayOfWeek) ? spec.dayOfWeek.join(', ') : spec.dayOfWeek) : ''
                const opens = spec.opens || ''
                const closes = spec.closes || ''
                if (days && opens && closes) {
                  result.openingHours.push(`${days}: ${opens}-${closes}`)
                }
              })
            }
          }
          if (Array.isArray(data)) {
            data.forEach(extractHours)
          } else {
            extractHours(data)
          }
        }
      } catch (e) {
        // Skip invalid JSON
      }
    })

    // 2. Common text patterns for opening hours (use cleanHtml)
    const hourPatterns = [
      // Danish day names with times - flexible whitespace/newlines
      /((?:mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag)(?:\s*-\s*(?:mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag))?)\s*[:;\n\r\s]*(\d{1,2}[.:]\d{2}\s*[-–—]\s*\d{1,2}[.:]\d{2})/gi,
      // English day names with times
      /((?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)(?:\s*-\s*(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun))?)\s*[:;\n\r\s]*(\d{1,2}[.:]\d{2}\s*(?:am|pm)?\s*[-–—]\s*\d{1,2}[.:]\d{2}\s*(?:am|pm)?)/gi,
      // Generic hours with label
      /(?:åbningstid|opening hours?|öffnungszeit|hours?)[:\s]*([^\n<]{10,200})/gi
    ]
    hourPatterns.forEach(pattern => {
      const matches = [...cleanHtml.matchAll(pattern)]
      matches.forEach(match => {
        let text = match[0].replace(/<[^>]+>/g, '').trim()
        // Clean up extra whitespace and newlines
        text = text.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ')
        // Capitalize first letter for consistency
        text = text.charAt(0).toUpperCase() + text.slice(1)
        if (text.length > 5 && text.length < 200 && /\d/.test(text)) {
          result.openingHours.push(text)
        }
      })
    })

    // 3. Look for time tables (table with days and hours) - use cleanHtml
    const tableMatches = cleanHtml.match(/<table[^>]*>[\s\S]*?<\/table>/gi) || []
    tableMatches.forEach(table => {
      const hasDay = /(mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)/i.test(table)
      const hasTime = /\d{1,2}[:.\s]?\d{0,2}\s*[-–—]\s*\d{1,2}[:.\s]?\d{0,2}/.test(table)
      if (hasDay && hasTime) {
        const rows = table.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []
        rows.forEach(row => {
          const text = row.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          if (text.length > 5 && text.length < 150 && /\d/.test(text)) {
            result.openingHours.push(text)
          }
        })
      }
    })

    // Deduplicate and limit results with better cleaning
    result.about = [...new Set(result.about)].slice(0, 5)
    
    // Address: Remove duplicates and sort by length (longer = more detailed)
    const uniqueAddresses = [...new Set(result.address.map(a => a.trim()))]
      .filter(a => a.length >= 10) // Minimum viable address length
      .sort((a, b) => b.length - a.length) // Longer addresses first
    result.address = uniqueAddresses.slice(0, 8)
    
    result.bookingLinks = [...new Set(result.bookingLinks)].slice(0, 10)
    result.menuLinks = [...new Set(result.menuLinks)].slice(0, 10)
    
    // Opening hours: Remove duplicates and clean up
    const uniqueHours = [...new Set(result.openingHours.map(h => h.trim()))]
      .filter(h => h.length >= 5 && h.length <= 200) // Reasonable length
      .filter(h => /\d/.test(h)) // Must contain at least one digit
    result.openingHours = uniqueHours.slice(0, 15)

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

    // Call Cloud Run scraper v2
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

    // V2 endpoint returns pre-processed structured data - no need to extract
    const payload = scrapeResult.payload

    // Return v2 structured results
    return new Response(
      JSON.stringify({
        success: true,
        url,
        timing: scrapeResult.timing,
        ...payload, // Spread the v2 payload (meta, contact, links, menu_text, about_text, etc.)
        metadata: {
          ...scrapeResult.metadata,
          cloudRunVersion: 'v2'
        }
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
