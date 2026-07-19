// =====================================================
// Menu Detection Function
// =====================================================
// Purpose: Lightweight wrapper to detect menu URLs via Cloud Run scraper
// Used by: /dashboard/menu page (Step 1: "Find menusider")
// Flow: Frontend → detect-menus → Cloud Run → returns menu_all array

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DetectMenusRequest {
  url: string
  businessId?: string  // Optional, for logging only
}

interface MenuUrl {
  url: string
  confidence: number
  evidence: string
  detection_method: string
  label?: string
}

// =====================================================
// Helper: Simple HTML to text conversion
// =====================================================
function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

// =====================================================
// Helper: Detect if page is a landing page (not actual menu content)
// =====================================================
function isLandingPage(html: string, text: string, url?: string): boolean {
  // Check URL pattern - paths like /menu, /da/menu, /en/menu are typically navigation pages
  if (url) {
    const path = new URL(url).pathname.toLowerCase()
    if (/^\/(da|en|de|se|no)?\/?menu\/?$/i.test(path)) {
      console.log(`  → Landing page: URL path matches navigation pattern: ${path}`)
      return true
    }
  }
  
  // Very short content suggests navigation page
  if (text.length < 500) {
    console.log(`  → Landing page: text only ${text.length} chars`)
    return true
  }
  
  // Has menu navigation keywords but no actual menu items (prices, etc)
  const hasMenuNav = /menu|frokost|aften|lunch|dinner|brunch|morgenmad|cocktail|bar/i.test(text)
  const hasMenuItems = /kr\.|,-|\d+\s*kr|price|pris|\d+\s*dkk/i.test(text)
  
  if (hasMenuNav && !hasMenuItems && text.length < 2000) {
    console.log('  → Landing page: has navigation but no menu items')
    return true
  }
  
  return false
}

// =====================================================
// Helper: Normalize URL for deduplication
// =====================================================
function normalizeUrlForDedup(url: string): string {
  try {
    const parsed = new URL(url)
    // Remove query params that might differ (width, size, etc) but keep essential ones
    const essential = ['page']
    const newParams = new URLSearchParams()
    essential.forEach(key => {
      const value = parsed.searchParams.get(key)
      if (value) newParams.set(key, value)
    })
    parsed.search = newParams.toString()
    return parsed.href
  } catch (e) {
    return url
  }
}

// =====================================================
// Helper: Check if URL is a false positive (privacy, contact, etc)
// =====================================================
function isFalsePositiveUrl(url: string): boolean {
  const urlLower = url.toLowerCase()
  const falsePositives = [
    'privacy', 'privatlivs', 'cookie', 'kontakt', 'contact',
    'om-os', 'about', 'terms', 'betingelser', 'gdpr'
  ]
  return falsePositives.some(term => urlLower.includes(term))
}

function decodeHtmlUrl(url: string): string {
  return url
    .replace(/&amp;/g, '&')
    .replace(/&#38;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
}

// =====================================================
// Helper: Extract menu URLs from HTML
// =====================================================
function extractMenuUrlsFromHtml(html: string, baseUrl: string): MenuUrl[] {
  const urls: MenuUrl[] = []
  const seen = new Set<string>()
  
  // Extract from <source srcset="...">
  const srcsetRegex = /<source[^>]+srcset=["']([^"']+)["'][^>]*>/gi
  let match
  while ((match = srcsetRegex.exec(html)) !== null) {
    const srcsetValue = match[0]
    const urlMatch = decodeHtmlUrl(match[1].split(',')[0].trim().split(' ')[0]) // Take first URL from srcset
    
    try {
      const absoluteUrl = new URL(urlMatch, baseUrl).href
      const normalizedUrl = normalizeUrlForDedup(absoluteUrl)
      
      // Skip false positives
      if (isFalsePositiveUrl(absoluteUrl)) continue
      
      // Check if this looks like a menu image
      const altMatch = srcsetValue.match(/alt=["']([^"']+)["']/i)
      const altText = altMatch ? altMatch[1].toLowerCase() : ''
      
      if (altText.includes('menu') || altText.includes('frokost') || altText.includes('aften') || 
          altText.includes('lunch') || altText.includes('dinner')) {
        
        if (!seen.has(normalizedUrl)) {
          seen.add(normalizedUrl)
          
          // Extract label from alt text
          const label = altText
            .replace(/souk\s*/i, '')
            .replace(/menu\s*/i, '')
            .replace(/summer|winter|forår|efterår/i, '')
            .trim()
          
          urls.push({
            url: absoluteUrl,
            confidence: 0.85,
            evidence: altMatch ? altMatch[1] : 'Menu image',
            detection_method: 'landing_page_srcset',
            label: label || undefined
          })
        }
      }
    } catch (e) {
      // Skip invalid URLs
    }
  }
  
  // Extract from <img src="...">
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  while ((match = imgRegex.exec(html)) !== null) {
    const imgTag = match[0]
    const urlMatch = decodeHtmlUrl(match[1])
    
    try {
      const absoluteUrl = new URL(urlMatch, baseUrl).href
      const normalizedUrl = normalizeUrlForDedup(absoluteUrl)
      
      // Skip false positives
      if (isFalsePositiveUrl(absoluteUrl)) continue
      
      // Check alt text for menu keywords
      const altMatch = imgTag.match(/alt=["']([^"']+)["']/i)
      const altText = altMatch ? altMatch[1].toLowerCase() : ''
      
      if (altText.includes('menu') || altText.includes('frokost') || altText.includes('aften')) {
        if (!seen.has(normalizedUrl)) {
          seen.add(normalizedUrl)
          
          const label = altText
            .replace(/souk\s*/i, '')
            .replace(/menu\s*/i, '')
            .trim()
          
          urls.push({
            url: absoluteUrl,
            confidence: 0.8,
            evidence: altMatch ? altMatch[1] : 'Menu image',
            detection_method: 'landing_page_img',
            label: label || undefined
          })
        }
      }
    } catch (e) {
      // Skip invalid URLs
    }
  }
  
  // Extract from <a href="...pdf"> or <a href="...jpg">
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi
  while ((match = linkRegex.exec(html)) !== null) {
    const urlMatch = decodeHtmlUrl(match[1])
    const linkTag = match[0]
    
    // Skip false positives early
    if (isFalsePositiveUrl(urlMatch)) continue
    
    // Check if URL looks like menu file
    if (/\.(pdf|jpg|jpeg|png|webp)/i.test(urlMatch) || /menu|frokost|aften/i.test(urlMatch)) {
      try {
        const absoluteUrl = new URL(urlMatch, baseUrl).href
        const normalizedUrl = normalizeUrlForDedup(absoluteUrl)
        
        if (!seen.has(normalizedUrl)) {
          seen.add(normalizedUrl)
          
          // Try to extract label from link text
          const textMatch = linkTag.match(/>([^<]+)</i)
          const label = textMatch ? textMatch[1].trim() : undefined
          
          urls.push({
            url: absoluteUrl,
            confidence: 0.75,
            evidence: 'Link to menu file',
            detection_method: 'landing_page_link',
            label
          })
        }
      } catch (e) {
        // Skip invalid URLs
      }
    }
  }
  
  console.log(`  → Extracted ${urls.length} menu URL(s) from landing page`)
  return urls
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const startTime = Date.now()
    const { url, businessId }: DetectMenusRequest = await req.json()

    if (!url) {
      throw new Error('url is required')
    }

    console.log('🔍 Detecting menus for:', url, businessId ? `(business: ${businessId})` : '')

    // ==========================================
    // AUTHENTICATION
    // ==========================================
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Invalid or expired token')
    }

    console.log('✅ User authenticated:', user.id)

    // ==========================================
    // TIER CHECK - Menu detection is paid-only
    // ==========================================
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .maybeSingle()

    const plan = profile?.plan || 'free'
    const isPaid = ['standardplus', 'premium'].includes(plan)

    if (!isPaid) {
      return new Response(
        JSON.stringify({
          error: 'Menu detection requires a paid subscription (Standard Plus or Premium)',
          plan,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('✅ Tier check passed:', plan)

    // ==========================================
    // CALL CLOUD RUN SCRAPER
    // ==========================================
    const cloudRunUrl = Deno.env.get('CLOUD_RUN_SCRAPER_URL') || 
                       'https://scraper-831683741713.europe-west1.run.app'
    const apiKey = Deno.env.get('CLOUD_RUN_API_KEY')
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

    console.log('📡 Calling Cloud Run scraper...')

    const scrapeResponse = await fetch(`${cloudRunUrl}/scrape-v3`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey || '',
      },
      body: JSON.stringify({ 
        url,
        business_id: businessId,
        openai_api_key: openaiApiKey,  // For AI Tier 2 classification
      }),
      signal: AbortSignal.timeout(65000),  // 65s timeout
    })

    if (!scrapeResponse.ok) {
      const errorText = await scrapeResponse.text()
      console.error('❌ Scraper failed:', scrapeResponse.status, errorText)
      throw new Error(`Scraper failed: ${scrapeResponse.status} ${errorText}`)
    }

    const payload = await scrapeResponse.json()
    console.log('✅ Scrape complete')

    // ==========================================
    // EXTRACT MENU URLs
    // ==========================================
    const menuAll = payload.extraction?.services?.menu_all || []
    
    console.log(`📋 Cloud Run detected ${menuAll.length} initial URL(s)`)
    
    // ==========================================
    // EXPAND LANDING PAGES
    // ==========================================
    // For each detected URL, check if it's a landing page that needs expansion
    const expandedUrls: MenuUrl[] = []
    const expandedLandingPages = new Set<string>()  // Track which landing pages were expanded
    
    for (const item of menuAll) {
      const menuUrl = item.url
      console.log(`\n🔍 Checking: ${menuUrl}`)
      
      try {
        // Fetch the URL to check if it's a landing page
        const urlResponse = await fetch(menuUrl, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MenuDetectorBot/1.0)',
            'Accept': 'text/html,*/*;q=0.8',
          },
          signal: AbortSignal.timeout(8000),  // 8s timeout per URL
        })
        
        if (!urlResponse.ok) {
          console.log(`  ⚠️ HTTP ${urlResponse.status} - keeping original URL`)
          expandedUrls.push({
            url: menuUrl,
            confidence: item.confidence || 0.9,
            evidence: item.evidence || 'Menu',
            detection_method: item.detection_method || 'keyword',
          })
          continue
        }
        
        const contentType = urlResponse.headers.get('content-type') || ''
        
        // If it's not HTML, keep as-is (PDF, image, etc)
        if (!contentType.includes('html')) {
          console.log(`  ✅ Direct file (${contentType}) - keeping original URL`)
          expandedUrls.push({
            url: menuUrl,
            confidence: item.confidence || 0.9,
            evidence: item.evidence || 'Menu',
            detection_method: item.detection_method || 'keyword',
          })
          continue
        }
        
        // It's HTML - check if landing page
        const html = await urlResponse.text()
        const text = htmlToText(html)
        
        if (isLandingPage(html, text, menuUrl)) {
          console.log('  🔄 Landing page detected - extracting child URLs')
          const childUrls = extractMenuUrlsFromHtml(html, menuUrl)
          
          if (childUrls.length > 0) {
            console.log(`  ✅ Expanded to ${childUrls.length} menu URL(s) - NOT including landing page itself`)
            expandedUrls.push(...childUrls)
            expandedLandingPages.add(normalizeUrlForDedup(menuUrl))  // Track that this was expanded
          } else {
            console.log('  ⚠️ Landing page with no extractable children - SKIPPING entirely')
            // Do NOT add landing page to results if we can't find children
            // It's better to skip it than to include a URL that will fail extraction
          }
        } else {
          console.log(`  ✅ Has menu content (${text.length} chars) - keeping original URL`)
          expandedUrls.push({
            url: menuUrl,
            confidence: item.confidence || 0.9,
            evidence: item.evidence || 'Menu',
            detection_method: item.detection_method || 'keyword',
          })
        }
        
      } catch (error: any) {
        console.log(`  ⚠️ Fetch failed: ${error.message} - keeping original URL`)
        expandedUrls.push({
          url: menuUrl,
          confidence: item.confidence || 0.9,
          evidence: item.evidence || 'Menu',
          detection_method: item.detection_method || 'keyword',
        })
      }
    }
    
    // ==========================================
    // DEDUPLICATE FINAL RESULTS
    // ==========================================
    // Use normalized URLs to remove duplicates and expanded landing pages
    const finalUrls: MenuUrl[] = []
    const finalSeen = new Set<string>()
    
    for (const item of expandedUrls) {
      const normalized = normalizeUrlForDedup(item.url)
      
      // Skip if this is a landing page that was expanded
      if (expandedLandingPages.has(normalized)) {
        console.log(`  🗑️ Removing expanded landing page: ${item.url}`)
        continue
      }
      
      if (!finalSeen.has(normalized)) {
        finalSeen.add(normalized)
        finalUrls.push(item)
      } else {
        console.log(`  🗑️ Removing duplicate: ${item.url}`)
      }
    }
    
    const detectedMenuUrls = finalUrls.map(item => item.url)
    console.log(`\n✅ Final result: ${detectedMenuUrls.length} menu URL(s) (after dedup)`)
    
    // Count detection methods
    const detectionMethods = {
      keyword: 0,
      ai_verified: 0,
      iframe_platform: 0,
      landing_page_srcset: 0,
      landing_page_img: 0,
      landing_page_link: 0,
    }
    
    finalUrls.forEach((item) => {
      const method = item.detection_method || 'keyword'
      if (method in detectionMethods) {
        detectionMethods[method as keyof typeof detectionMethods]++
      }
    })

    // ==========================================
    // RESPONSE
    // ==========================================
    const duration = Date.now() - startTime
    
    return new Response(
      JSON.stringify({
        success: true,
        detectedMenuUrls,
        metadata: {
          totalFound: detectedMenuUrls.length,
          detectionMethods,
          duration_ms: duration,
          scraper_version: 'cloud-run-v3',
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    
    return new Response(
      JSON.stringify({
        error: error.message || 'Menu detection failed',
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
