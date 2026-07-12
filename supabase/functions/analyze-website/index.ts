// @ts-ignore - Deno import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno import
import { createClient } from 'npm:@supabase/supabase-js@2.39.0'

// @ts-ignore - Deno global
declare const Deno: any;

// Import shared utilities
import { htmlToCleanText } from '../_shared/html-parser.ts'
import { extractStructuredData } from '../_shared/structured-data-extractor.ts'
import { extractOpeningHours, extractKitchenCloseTime } from '../_shared/opening-hours-extractor.ts'
import { extractMetadata } from '../_shared/metadata-extractor.ts'
import { extractTextFromPdf } from '../_shared/pdf-parser.ts'
import { validatePublicUrl, looksLikeLoginPage } from '../_shared/url-security.ts'

// Import AI extractors
import { extractBasicInfo } from '../_shared/ai-extractors/basic-info-extractor.ts'
import { extractContact } from '../_shared/ai-extractors/contact-extractor.ts'
import { extractKeywords } from '../_shared/ai-extractors/keywords-extractor.ts'
import { extractMenu } from '../_shared/ai-extractors/menu-extractor.ts'
import { extractVenueHooks } from '../_shared/ai-extractors/venue-hooks-extractor.ts'
import { extractExperiencePillars } from '../_shared/ai-extractors/experience-pillars-extractor.ts'
import { extractMenuSignal } from '../_shared/ai-extractors/menu-signal-extractor.ts'
import { extractToneOfVoice, formatToneAsText } from '../_shared/ai-extractors/tone-of-voice-extractor.ts'

// Import business type helpers
import { getPrimaryType, getBusinessTypeLabel } from '../_shared/business-type-helpers.ts'
import { getExtractorModel } from '../_shared/ai-config.ts'

// Import HTML helpers
import {
  extractImageSignals,
  isHospitalityBusiness,
  isVisualPageCandidate,
  extractHeroSignalsFromCleanText,
  extractAboutBlock,
  needsAdvancedScraping
} from '../_shared/crawling/html-helpers.ts'

// Import link classification
import { classifyAndExtractLinks } from '../_shared/crawling/link-classifier.ts'
import type { Link, ClassifiedLink } from '../_shared/crawling/link-classifier.ts'

// Import website scraping
import { scrapeWebsite } from '../_shared/crawling/website-scraper.ts'

// Import intelligent scraping system
import { detectContentSignature } from '../_shared/scraping/content-signature-detector.ts'
import { routeToOptimalScraper } from '../_shared/scraping/intelligent-scraper-router.ts'
import { 
  stage1ZeroCostExtraction, 
  stage2LowCostExtraction, 
  calculateCompleteness, 
  identifyFieldsForAI,
  type ExtractionCompleteness 
} from '../_shared/scraping/extraction-waterfall.ts'
import { validateExtractionQuality } from '../_shared/scraping/extraction-validator.ts'

// Import database persistence
import { saveWebsiteAnalysis } from '../_shared/persistence/website-analysis-saver.ts'

// Import OpenAI for tone of voice extraction
import OpenAI from 'https://esm.sh/openai@4.68.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: any) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Log authorization header for debugging
    const authHeader = req.headers.get('Authorization')
    console.log('🔐 Auth header present:', !!authHeader)

    const body = await req.json()
    console.log('📥 Received request:', body)
    
    const { url, businessName, businessType, tier, debugMode, businessId, forceRefresh } = body

    if (!url || typeof url !== 'string') {
      console.error('❌ Missing URL in request')
      return new Response(
        JSON.stringify({ error: 'Missing required field: url' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Validate URL safety BEFORE any fetching - protect against SSRF and internal networks
    try {
      validatePublicUrl(url)
    } catch (urlError) {
      console.error('❌ URL validation failed:', urlError)
      return new Response(
        JSON.stringify({
          error: `URL blocked: ${urlError instanceof Error ? urlError.message : 'Invalid URL'}`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Debug mode: return raw AI extraction without structuring
    if (debugMode) {
      console.log('🔍 DEBUG MODE ENABLED - Will return raw AI response')
    }
    
    // Determine AI model based on subscription tier (centralized configuration)
    const getAIModel = (userTier: string | undefined): string => {
      const tierModelMap: Record<string, string> = {
        'free': 'gpt-4o-mini', // Cost optimization: ~90% cheaper than gpt-4o
        'standardplus': 'gpt-4o',
        'standard_plus': 'gpt-4o', // Handle underscore variant
        'premium': 'gpt-4o',
      }
      
      return tierModelMap[userTier || 'free'] || 'gpt-4o-mini'
    }
    
    const aiModel = getAIModel(tier)
    console.log('🤖 Using AI model:', aiModel, '(tier:', tier || 'free', ')')
    
    // Tier-based analysis configuration
    const getTierConfig = (userTier: string | undefined) => {
      const normalizedTier = (userTier || 'free').toLowerCase().replace('_', '')
      
      const configs: Record<string, {
        maxPriorityPages: number
        maxContentChars: number
        allowPdfParsing: boolean
        allowAiLinkClassification: boolean
        description: string
      }> = {
        'free': {
          maxPriorityPages: 3, // Homepage + About + Menu + Contact for comprehensive free analysis
          maxContentChars: 180000, // Homepage (120KB) + 3 pages (20KB each)
          allowPdfParsing: false,
          allowAiLinkClassification: false,
          description: 'Homepage + About + Menu + Contact (3 priority pages)'
        },
        'standardplus': {
          maxPriorityPages: 3,
          maxContentChars: 150000, // Homepage (80KB) + 3 pages (20KB each) + buffer
          allowPdfParsing: true, // Menu PDFs only
          allowAiLinkClassification: true,
          description: 'Homepage + 3 pages, AI link classification, menu PDF parsing'
        },
        'premium': {
          maxPriorityPages: 5,
          maxContentChars: 200000, // Homepage (80KB) + 5 pages (20KB each) + buffer
          allowPdfParsing: true, // All PDFs
          allowAiLinkClassification: true,
          description: 'Full analysis with all PDFs'
        }
      }
      
      return configs[normalizedTier] || configs['free']
    }
    
    const tierConfig = getTierConfig(tier)
    console.log('='['repeat'](50))
    console.log('🚨 PDF PARSING ENABLED:', tierConfig.allowPdfParsing, '| TIER:', tier || 'free')
    console.log('='['repeat'](50))
    console.log('🎯 Tier configuration:', tierConfig.description)
    console.log('🌐 Analyzing URL:', url)

    // Crawl the website (homepage + depth 1)
    console.log('🕷️ Starting website crawl...')
    
    interface PageData {
      url: string
      html: string
      links: { href: string; text: string }[]
      type?: 'HOMEPAGE' | 'MENU' | 'BOOKING' | 'CONTACT' | 'ABOUT' | 'OTHER'
      linkText?: string
    }

    type PageType = NonNullable<PageData['type']>

    const normalizePageType = (value: unknown): PageType => {
      const s = String(value || '').toUpperCase()
      if (s === 'MENU') return 'MENU'
      if (s === 'BOOKING') return 'BOOKING'
      if (s === 'CONTACT') return 'CONTACT'
      if (s === 'ABOUT') return 'ABOUT'
      if (s === 'HOMEPAGE') return 'HOMEPAGE'
      return 'OTHER'
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // DATA STRUCTURES - State variables for crawl results
    // ═══════════════════════════════════════════════════════════════════════════
    
    const crawledPages: PageData[] = []
    let websiteContent = ''
    let menuUrl: string | null = null
    let allMenuUrls: string[] = [] // Declare in outer scope
    let bookingUrl: string | null = null
    let logoUrl = '' // Declare in outer scope so it's accessible later
    const detectedPDFs: Array<{url: string; type: string; name: string}> = []
    let structuredData: any[] = [] // Declare in outer scope for prompt access
    let metadata: { description?: string; title?: string; image?: string } = {} // Declare in outer scope
    let extractedHours: any = null // Declare in outer scope
    let openingHoursReviewRequired = false
    let openingHoursReviewReasons: string[] = []
    let kitchenCloseTime: string | null = null // Declare in outer scope for later persistence/debug output
    let homepageAboutCandidate = '' // Declare in outer scope for persistence
    let htmlLang: string | null = null // Detected from <html lang="..."> for language-aware extraction
    let classifiedLinks: Array<{type: string; href: string; text: string; ariaLabel: string; title: string; hostname: string; isInternal: boolean}> = [] // Declare in outer scope for persistence
    let menuExtraction: { menuStructure?: any[]; dietaryOptions?: string[]; takeaway?: boolean | null; establishmentType?: 'FSE' | 'SBO' | null } | null = null // Declare in outer scope
    let baseDomainForCrawl = ''
    
    try {
      // Normalize URL
      const baseUrl = new URL(url)
      const baseDomain = baseUrl.hostname
      baseDomainForCrawl = baseDomain
      
      // ══════════════════════════════════════════════════════════════════════════════
    // STEP 1: Fetch homepage HTML (with cache + Vercel Playwright integration)
    // ══════════════════════════════════════════════════════════════════════════════
    
    // Initialize Supabase client for cache operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseKey = supabaseServiceKey || supabaseAnonKey
    
    const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    }) : null
    
    // Check cache first (24-hour TTL) - unless forceRefresh is true
    let homepageHtml = ''
    let cacheHit = false
    
    if (supabase && !forceRefresh) {
      const cacheCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      
      try {
        const { data: cachedResult } = await supabase
          .from('scraped_cache')
          .select('raw_html, scraped_at, scraper_type')
          .eq('url', url)
          .gt('scraped_at', cacheCutoff)
          .eq('status', 'success')
          .maybeSingle()
        
        if (cachedResult?.raw_html) {
          homepageHtml = cachedResult.raw_html
          cacheHit = true
          console.log('✅ Cache HIT - Using cached content from', cachedResult.scraped_at)
          console.log('🎯 Original scraper:', cachedResult.scraper_type)
          
          // ALWAYS re-scrape if cached content is from simple-fetch (to upgrade to Puppeteer)
          if (cachedResult.scraper_type === 'simple-fetch') {
            console.log('⚠️ Cached from simple-fetch, upgrading to Puppeteer scraper')
            try {
              const scrapeResult = await scrapeWebsite(url)
              if (scrapeResult.scraperType === 'cloud-run-puppeteer' || scrapeResult.scraperType === 'puppeteer-vercel') {
                console.log(`✅ Puppeteer re-scrape successful (${scrapeResult.scraperType}), using new content`)
                homepageHtml = scrapeResult.html
                cacheHit = false // Mark as fresh scrape to update cache
                
                // Update cache with new Puppeteer result
                await supabase
                  .from('scraped_cache')
                  .upsert({
                    url,
                    raw_html: scrapeResult.html,
                    raw_text: scrapeResult.html.replace(/<[^>]*>/g, '').trim(),
                    scraper_type: scrapeResult.scraperType,
                    status: 'success',
                    scraped_at: new Date().toISOString()
                  }, {
                    onConflict: 'url'
                  })
              }
            } catch (rescrapeError) {
              console.log('⚠️ Puppeteer re-scrape failed, using cached content:', rescrapeError)
            }
          }
        } else {
          console.log('❌ Cache MISS - Will scrape fresh content')
        }
      } catch (cacheError) {
        console.log('⚠️ Cache check failed:', cacheError)
        // Continue to scraping
      }
    } else if (forceRefresh) {
      console.log('🔄 Force refresh requested - bypassing cache')
    }
    
    // Scrape if not cached - with intelligent routing
    let scraperType = 'unknown'
    let contentSignature: any = null
    let scrapingMetrics: any = null
    
    if (!homepageHtml) {
      // Phase 1: Detect content signature (pre-flight analysis)
      console.log('═══════════════════════════════════════════════════════════')
      console.log('🚀 INTELLIGENT SCRAPING SYSTEM ACTIVATED')
      console.log('═══════════════════════════════════════════════════════════')
      console.log('🔍 Phase 1: Detecting content signature...')
      try {
        contentSignature = await detectContentSignature(url)
        console.log('📊 Content signature:', contentSignature.classification, 'confidence:', contentSignature.confidence)
        console.log('   Recommended scraper:', contentSignature.recommendedScraper)
        console.log('   Evidence:', JSON.stringify(contentSignature.evidence))
      } catch (signatureError) {
        console.warn('⚠️ Content signature detection failed, using default routing:', signatureError)
        // Fallback to old scraping if signature detection fails
        const scrapeResult = await scrapeWebsite(url)
        homepageHtml = scrapeResult.html
        scraperType = scrapeResult.scraperType
      }
      
      // Phase 2: Route to optimal scraper
      if (contentSignature) {
        console.log('🚀 Phase 2: Routing to optimal scraper...')
        try {
          const routingResult = await routeToOptimalScraper(url, contentSignature)
          homepageHtml = routingResult.html
          scraperType = routingResult.scraperUsed.toLowerCase().replace('_', '-')
          
          // Log metrics
          scrapingMetrics = {
            classification: contentSignature.classification,
            confidence: contentSignature.confidence,
            scraperUsed: routingResult.scraperUsed,
            attemptsMade: routingResult.attemptsMade,
            upgradedFrom: routingResult.upgradedFrom,
            validationQuality: routingResult.validation.quality,
            executionTime: routingResult.executionTime,
            estimatedCost: routingResult.estimatedCost
          }
          
          console.log('📊 Scraping metrics:', scrapingMetrics)
          
          // Warn if validation failed
          if (!routingResult.validation.isValid) {
            console.warn('⚠️ Scraper validation failed:', routingResult.validation.issues)
          }
          
        } catch (routingError) {
          console.error('❌ Intelligent routing failed, falling back to legacy scraper:', routingError)
          const scrapeResult = await scrapeWebsite(url)
          homepageHtml = scrapeResult.html
          scraperType = scrapeResult.scraperType
        }
      }
      
      console.log('🎯 Final scraper used:', scraperType)
      
      // Save to cache
      if (supabase && homepageHtml) {
        try {
          const { error: cacheError } = await supabase
            .from('scraped_cache')
            .upsert({
              url,
              raw_html: homepageHtml,
              raw_text: homepageHtml.replace(/<[^>]*>/g, '').trim(),
              scraper_type: scraperType,
              status: 'success',
              scraped_at: new Date().toISOString()
            }, {
              onConflict: 'url'
            })
          
          if (cacheError) {
            console.log('⚠️ Failed to save to cache:', cacheError)
          } else {
            console.log('✅ Saved to cache for future requests')
          }
        } catch (saveError) {
          console.log('⚠️ Cache save error:', saveError)
        }
      }
    }
      // Detect login/authentication pages - prevent extracting password forms
      if (looksLikeLoginPage(homepageHtml, url)) {
        console.error('❌ Homepage appears to be a login/admin page')
        return new Response(
          JSON.stringify({
            error: 'URL appears to be a login or admin page - not a public business website',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Extract HTML lang attribute for language detection (before truncation)
      const langMatch = homepageHtml.match(/<html[^>]*\slang=["']([a-zA-Z-]+)["']/i)
      if (langMatch) {
        htmlLang = langMatch[1].toLowerCase().split('-')[0] // Get base language (e.g., "da" from "da-DK")
        console.log('🌍 Detected HTML lang attribute:', htmlLang)
      }
      
      // Safety: Limit HTML size to prevent processing issues (1MB max)
      const MAX_HTML_SIZE = 1024 * 1024
      if (homepageHtml.length > MAX_HTML_SIZE) {
        console.log('⚠️ Homepage too large, truncating:', homepageHtml.length, 'chars')
        homepageHtml = homepageHtml.slice(0, MAX_HTML_SIZE)
      }
      
      // Extract structured data FIRST
      structuredData = extractStructuredData(homepageHtml)
      console.log('📊 Found structured data blocks:', structuredData.length)

      // Extract metadata
      metadata = extractMetadata(homepageHtml)

      // Build a richer homepage summary so Om os can use the homepage even when
      // there is no explicit about section.
      const cleanHomepageText = htmlToCleanText(homepageHtml, true)
      const heroSignals = extractHeroSignalsFromCleanText(cleanHomepageText)

      const structuredDataHighlights = structuredData
        .flatMap((entry) => {
          const highlights: string[] = []
          const name = typeof entry?.name === 'string' ? entry.name.trim() : ''
          const headline = typeof entry?.headline === 'string' ? entry.headline.trim() : ''
          const description = typeof entry?.description === 'string' ? entry.description.trim() : ''
          if (name) highlights.push(`name: ${name}`)
          if (headline) highlights.push(`headline: ${headline}`)
          if (description) highlights.push(`description: ${description}`)
          return highlights
        })
        .slice(0, 6)

      const homepageSummaryParts: string[] = []

      // Add homepage hero signals so the AI can synthesize a better summary.
      if (heroSignals) {
        homepageSummaryParts.push(`HERO SIGNALS:\n${heroSignals}`)
        console.log('📝 Pre-extracted hero signals available')
      }

      // Add metadata signals for fallback synthesis.
      const metadataSignals: string[] = []
      if (metadata.title) metadataSignals.push(`title: ${metadata.title}`)
      if (metadata.description) metadataSignals.push(`description: ${metadata.description}`)
      if (metadata.image) metadataSignals.push(`image: ${metadata.image}`)
      if (metadataSignals.length > 0) {
        homepageSummaryParts.push(`META:\n${metadataSignals.join('\n')}`)
      }

      if (structuredDataHighlights.length > 0) {
        homepageSummaryParts.push(`STRUCTURED DATA:\n${structuredDataHighlights.map((line) => `- ${line}`).join('\n')}`)
      }

      // Preserve the explicit about block if it exists, but keep it secondary so
      // the AI also weighs the rest of the homepage.
      homepageAboutCandidate = extractAboutBlock(homepageHtml)
      if (homepageAboutCandidate) {
        homepageSummaryParts.push(`ABOUT BLOCK:\n${homepageAboutCandidate}`)
        console.log('📝 Pre-extracted about block:', homepageAboutCandidate.slice(0, 100) + '...')
      }

      homepageAboutCandidate = homepageSummaryParts.join('\n\n').trim()

      // Try to extract opening hours before AI processing
      const openingHoursExtraction = extractOpeningHours(homepageHtml, structuredData)
      extractedHours = openingHoursExtraction.openingHours
      openingHoursReviewRequired = openingHoursExtraction.reviewRequired
      openingHoursReviewReasons = openingHoursExtraction.reviewReasons
      if (extractedHours) {
        console.log('✅ Pre-extracted opening hours:', Object.keys(extractedHours))
      }
      if (openingHoursReviewRequired) {
        console.log('⚠️ Opening hours require manual review:', openingHoursReviewReasons)
      }

      kitchenCloseTime = extractKitchenCloseTime(homepageHtml)

      // Only derive kitchen close time from opening hours if not already extracted
      if (!kitchenCloseTime && extractedHours) {
        const closeCounts = new Map<string, number>()
        for (const dayHours of Object.values(extractedHours)) {
          if (dayHours?.closed || !dayHours?.close) continue
          closeCounts.set(dayHours.close, (closeCounts.get(dayHours.close) || 0) + 1)
        }

        if (closeCounts.size > 0) {
          const [mostCommonCloseTime] = [...closeCounts.entries()].sort((a, b) => b[1] - a[1])[0]
          if (mostCommonCloseTime) {
            kitchenCloseTime = mostCommonCloseTime
            console.log('🍳 Derived kitchen close time from opening hours (fallback):', kitchenCloseTime)
          }
        }
      }

      if (kitchenCloseTime) {
        console.log('🍳 Pre-extracted kitchen close time:', kitchenCloseTime)
      }
      
      // Extract logo from HTML
      
      // Try multiple methods to find logo
      // 1. Look for <link rel="icon" or "apple-touch-icon">
      const iconMatch = homepageHtml.match(/<link[^>]+rel=["'](icon|apple-touch-icon|shortcut icon)["'][^>]+href=["']([^"']+)["']/i)
      if (iconMatch && !logoUrl) {
        logoUrl = new URL(iconMatch[2], url).href
        console.log('🎨 Found logo via link icon:', logoUrl)
      }
      
      // 2. Look for og:image meta tag
      const ogImageMatch = homepageHtml.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      if (ogImageMatch && !logoUrl) {
        logoUrl = new URL(ogImageMatch[1], url).href
        console.log('🎨 Found logo via og:image:', logoUrl)
      }
      
      // 3. Look for <img> tags with "logo" in src, alt, or class
      const imgMatches = homepageHtml.matchAll(/<img[^>]+>/gi)
      if (!logoUrl) {
        for (const imgMatch of imgMatches) {
          const imgTag = imgMatch[0]
          const srcMatch = imgTag.match(/src=["']([^"']+)["']/)
          const altMatch = imgTag.match(/alt=["']([^"']*logo[^"']*)["']/i)
          const classMatch = imgTag.match(/class=["']([^"']*logo[^"']*)["']/i)
          
          if ((altMatch || classMatch) && srcMatch) {
            const imgSrc = srcMatch[1]
            // Prefer .png, .svg, .jpg files
            if (imgSrc.match(/\.(png|svg|jpg|jpeg|webp)$/i)) {
              logoUrl = new URL(imgSrc, url).href
              console.log('🎨 Found logo via img tag:', logoUrl)
              break
            }
          }
        }
      }
      
      // 4. Look for <img> with "brand" in attributes
      if (!logoUrl) {
        for (const imgMatch of imgMatches) {
          const imgTag = imgMatch[0]
          const srcMatch = imgTag.match(/src=["']([^"']+)["']/)
          const altMatch = imgTag.match(/alt=["']([^"']*brand[^"']*)["']/i)
          const classMatch = imgTag.match(/class=["']([^"']*brand[^"']*)["']/i)
          
          if ((altMatch || classMatch) && srcMatch) {
            const imgSrc = srcMatch[1]
            if (imgSrc.match(/\.(png|svg|jpg|jpeg|webp)$/i)) {
              logoUrl = new URL(imgSrc, url).href
              console.log('🎨 Found logo via brand img:', logoUrl)
              break
            }
          }
        }
      }
      
      console.log('🎨 Final extracted logo URL:', logoUrl || 'none found')
      
      // Helper to strip HTML tags from anchor content
      const stripTags = (html: string): string => {
        return html
          .replace(/<[^>]*>/g, ' ')  // Replace tags with spaces
          .replace(/\s+/g, ' ')       // Collapse multiple spaces
          .trim()
      }
      
      // Extract links from homepage (improved regex captures nested content)
      const linkMatches = homepageHtml.matchAll(/<a\s+([^>]*)>([\s\S]*?)<\/a>/gi)
      const links: { href: string; text: string; ariaLabel: string; title: string; hostname: string; isInternal: boolean }[] = []
      
      for (const match of linkMatches) {
        const tagAttrs = match[1]
        const rawContent = match[2]
        
        // Extract href from tag attributes
        const hrefMatch = tagAttrs.match(/href=["']([^"']+)["']/i)
        if (!hrefMatch) continue
        const href = hrefMatch[1]
        
        // Extract aria-label, title, and data-* from the <a> tag itself
        const ariaLabelMatch = tagAttrs.match(/aria-label=["']([^"']+)["']/i)
        const titleMatch = tagAttrs.match(/title=["']([^"']+)["']/i)
        const dataTextMatch = tagAttrs.match(/data-(?:text|label|title|name)=["']([^"']+)["']/i)
        
        const ariaLabel = ariaLabelMatch?.[1] || ''
        const title = titleMatch?.[1] || dataTextMatch?.[1] || ''
        
        // Strip nested tags to get clean text (handles <span>, <img alt=...>, etc.)
        let text = stripTags(rawContent)
        
        // If no text found, try to extract from nested img alt or aria-label
        if (!text) {
          const altMatch = rawContent.match(/alt=["']([^"']+)["']/i)
          const nestedAriaMatch = rawContent.match(/aria-label=["']([^"']+)["']/i)
          const nestedTitleMatch = rawContent.match(/title=["']([^"']+)["']/i)
          text = altMatch?.[1] || nestedAriaMatch?.[1] || nestedTitleMatch?.[1] || ''
        }
        
        text = text.trim()
        
        // Skip anchors, mailto, tel, javascript
        if (
          href.startsWith('#') ||
          href.startsWith('mailto:') ||
          href.startsWith('tel:') ||
          href.startsWith('javascript:')
        ) {
          continue
        }
        
        try {
          const linkUrl = new URL(href, url)
          const isInternal = linkUrl.hostname === baseDomain
          
          // Optional: still skip homepage itself
          if (isInternal && linkUrl.pathname === baseUrl.pathname) continue
          
          // IMPORTANT: For sites with multiple businesses (e.g., /viggo/, /romer/, etc.)
          // Only follow links that stay within the same path prefix
          // Example: If analyzing /viggo/, ignore links to /romer/ or parent domain
          if (isInternal && baseUrl.pathname.length > 1) {
            const basePath = baseUrl.pathname.split('/').filter(p => p)[0] // Get first path segment (e.g., "viggo")
            const linkPath = linkUrl.pathname.split('/').filter(p => p)[0]
            
            // Skip if link goes to different section or parent domain
            if (basePath && linkPath !== basePath && linkUrl.pathname !== '/') {
              console.log(`  ⏭️ Skipping cross-section link: ${linkUrl.pathname} (staying in /${basePath}/)`)
              continue
            }
          }
          
          links.push({
            href: linkUrl.href,
            text,
            ariaLabel,
            title,
            hostname: linkUrl.hostname,
            isInternal,
          })
        } catch {
          // invalid URL, skip
        }
      }
      
      console.log('🔗 Found links (internal + external):', links.length)
      
      // ══════════════════════════════════════════════════════════════════════════════
      // STEP 4: Classify links and extract special URLs
      // ══════════════════════════════════════════════════════════════════════════════
      
      const linkClassificationResult = await classifyAndExtractLinks(links as Link[], {
        allowAiClassification: tierConfig.allowAiLinkClassification,
        aiModel,
        openaiApiKey: Deno.env.get('OPENAI_API_KEY')
      })
      
      classifiedLinks = linkClassificationResult.classifiedLinks as typeof classifiedLinks
      allMenuUrls = linkClassificationResult.menuUrls
      menuUrl = allMenuUrls[0] || null // Keep first one for backward compatibility
      bookingUrl = linkClassificationResult.bookingUrl
      detectedPDFs.push(...linkClassificationResult.detectedPDFs as typeof detectedPDFs)
      
      console.log('🎯 Final detected URLs:', { menuUrl, bookingUrl, detectedPDFs: detectedPDFs.length })
      
      // Store homepage
      const internalLinks = links.filter(l => l.isInternal)
      crawledPages.push({
        url: url,
        html: homepageHtml,
        links: internalLinks
        ,
        type: 'HOMEPAGE'
      })
      
      // Fetch priority pages (menu, booking, contact, about - tier-based limit)
      let priorityLinks = classifiedLinks
        .filter(l => ['MENU', 'BOOKING', 'CONTACT', 'ABOUT'].includes(l.type))

      // Hospitality boost: include a gallery/"kig indenfor" page if found.
      // This helps visual/ambience hooks show up in venueHooks/experiencePillars.
      const hospitalityBoost = isHospitalityBusiness(businessType) || isHospitalityBusiness(businessName)
      if (hospitalityBoost) {
        const visualCandidates = classifiedLinks
          .filter((l) => l.isInternal)
          .filter((l) => isVisualPageCandidate(l.href, l.text, l.ariaLabel, l.title))
          .slice(0, 2)

        for (const c of visualCandidates) {
          priorityLinks.push({ ...c, type: 'ABOUT' })
        }
      }

      // Prefer the most useful pages first.
      // Free tier benefits most from ABOUT/CONTACT for better description & contact extraction.
      // Paid tiers also need MENU early for extraction.
      const typePriority: Record<string, number> = (tierConfig.maxPriorityPages >= 3)
        ? { 'MENU': 0, 'ABOUT': 1, 'CONTACT': 2, 'BOOKING': 3 }
        : { 'ABOUT': 0, 'CONTACT': 1, 'MENU': 2, 'BOOKING': 3 }

      // De-duplicate by href while keeping the best (lowest priority score) occurrence.
      const bestByHref = new Map<string, any>()
      for (const link of priorityLinks) {
        const prev = bestByHref.get(link.href)
        if (!prev) {
          bestByHref.set(link.href, link)
          continue
        }
        const prevScore = typePriority[String(prev.type)] ?? 99
        const nextScore = typePriority[String(link.type)] ?? 99
        if (nextScore < prevScore) bestByHref.set(link.href, link)
      }

      priorityLinks = Array.from(bestByHref.values()).sort((a, b) => {
        const sa = typePriority[String(a.type)] ?? 99
        const sb = typePriority[String(b.type)] ?? 99
        if (sa !== sb) return sa - sb
        // Stable-ish tie-breaker: shorter URLs first
        return String(a.href).length - String(b.href).length
      })
      
      // Ensure all detected PDFs are in priorityLinks for extraction
      for (const pdf of detectedPDFs) {
        if (!priorityLinks.some(l => l.href === pdf.url)) {
          priorityLinks.push({
            href: pdf.url,
            text: pdf.name,
            ariaLabel: '',
            title: '',
            hostname: baseDomain,
            isInternal: true,
            type: pdf.type as any
          })
          console.log('📄 Added detected PDF to priority links:', pdf.url)
        }
      }
      
      // After initial link classification, add deeper menu crawling
      const menuLinks = classifiedLinks.filter(l => l.type === 'MENU')

      if (menuLinks.length > 0 && tierConfig.maxPriorityPages > 1) {
        console.log('🍽️ Found menu pages, crawling deeper for sub-menus...')
        
        for (const menuLink of menuLinks.slice(0, 2)) {  // Check first 2 menu pages
          try {
            const menuResp = await fetch(menuLink.href, {
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BusinessProfileBot/1.0)' }
            })
            
            if (menuResp.ok) {
              const menuHtml = await menuResp.text()
              
              // Find sub-menu links (food menu, drinks menu, etc.)
              const subMenuLinks = menuHtml.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*(?:menu|mad|drikke|drinks|food|brunch|frokost|aftensmad)[^<]*)<\/a>/gi)
              
              for (const subMatch of Array.from(subMenuLinks).slice(0, 3)) {
                try {
                  const subUrl = new URL(subMatch[1], menuLink.href)
                  if (subUrl.hostname === baseDomain) {
                    priorityLinks.push({
                      href: subUrl.href,
                      text: subMatch[2].trim(),
                      ariaLabel: '',
                      title: '',
                      hostname: baseDomain,
                      isInternal: true,
                      type: 'MENU'
                    })
                    console.log('  🍽️ Found sub-menu:', subUrl.href)
                  }
                } catch {}
              }
            }
          } catch (e) {
            console.log('  ⚠️ Error fetching menu page:', menuLink.href)
          }
        }
      }
      
      // NOW apply the tier limit after sub-menus have been added
      priorityLinks = priorityLinks.slice(0, tierConfig.maxPriorityPages)
      
      console.log('📥 Fetching priority pages (HTML + MENU PDFs only):', priorityLinks.length, `(tier limit: ${tierConfig.maxPriorityPages})`)
      
      for (const link of priorityLinks) {
        try {
          console.log('  → Fetching:', link.href)
          
          // Validate URL safety before fetching
          try {
            validatePublicUrl(link.href)
          } catch (urlError) {
            console.log('  ⚠️ Skipping unsafe URL:', link.href, '-', urlError)
            continue
          }

          const hrefLower = link.href.toLowerCase()
          const isPdf = hrefLower.endsWith('.pdf')

          if (isPdf && link.type === 'MENU' && tierConfig.allowPdfParsing) {
            // ✅ MENU PDF → parse as menu (tier allows PDF parsing)
            // Try unpdf first (fast), fallback to Tika OCR if no text
            let pdfText = await extractTextFromPdf(link.href)
            
            // If unpdf got nothing, try Tika OCR (handles image-based PDFs)
            if (!pdfText || pdfText.length === 0) {
              console.log('  📄 Trying Tika OCR for image-based PDF...')
              try {
                const tikaUrl = 'https://tika-processor-361705281766.europe-west1.run.app/tika'
                const pdfResp = await fetch(link.href)
                const pdfBuffer = await pdfResp.arrayBuffer()
                
                const tikaResp = await fetch(tikaUrl, {
                  method: 'PUT',
                  body: pdfBuffer,
                  headers: { 'Content-Type': 'application/pdf' }
                })
                
                if (tikaResp.ok) {
                  pdfText = await tikaResp.text()
                  console.log('  ✅ Tika OCR extracted:', pdfText.length, 'chars')
                } else {
                  console.log('  ⚠️ Tika OCR failed:', tikaResp.status)
                }
              } catch (err) {
                console.log('  ⚠️ Tika OCR error:', err)
              }
            }
            
            if (pdfText) {
              // We don't need HTML for PDFs, just mark that we saw it
              crawledPages.push({
                url: link.href,
                html: '', // no HTML
                links: []
              })

              // Add parsed menu text directly into websiteContent
              const pdfSnippet = pdfText.slice(0, 5000)
              websiteContent += `\n\n=== PDF Menu (MENU link): ${link.href} ===\n${pdfSnippet}`
              console.log('  ✅ Parsed MENU PDF:', link.href, `(${pdfText.length} chars, using ${pdfSnippet.length})`)
              console.log('  📄 PDF Preview (first 300 chars):', pdfSnippet.substring(0, 300))
            } else {
              console.log('  ⚠️ No text extracted from MENU PDF:', link.href)
            }

          } else if (isPdf) {
            // ❌ Non-MENU PDF → skip parsing (could be terms, booking docs, etc.)
            console.log('  ⚠️ Skipping non-MENU PDF:', link.href)
            // Optionally: still store minimal info if you want
            crawledPages.push({
              url: link.href,
              html: '',
              links: []
            })

          } else {
            // 🌐 Normal HTML page (MENU/BOOKING/CONTACT/ABOUT)
            const pageResp = await fetch(link.href, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; BusinessProfileBot/1.0)'
              }
            })

            if (pageResp.ok) {
              const pageHtml = await pageResp.text()
              
              // Safety: Limit HTML size to prevent processing issues (1MB max)
              const MAX_HTML_SIZE = 1024 * 1024
              if (pageHtml.length > MAX_HTML_SIZE) {
                console.log('  ⚠️ Page too large, truncating:', link.href, `(${pageHtml.length} chars)`)
                crawledPages.push({
                  url: link.href,
                  html: pageHtml.slice(0, MAX_HTML_SIZE),
                  links: [],
                  type: normalizePageType((link as any).type),
                  linkText: (link.text || '').trim() || undefined
                })
              } else {
                crawledPages.push({
                  url: link.href,
                  html: pageHtml,
                  links: [],
                  type: normalizePageType((link as any).type),
                  linkText: (link.text || '').trim() || undefined
                })
                console.log('  ✅ Fetched HTML page:', link.href, `(${pageHtml.length} chars)`)
              }
            } else {
              console.log('  ❌ Failed to fetch HTML page:', link.href, pageResp.status)
            }
          }

        } catch (e) {
          console.log('  ❌ Error fetching priority link:', link.href, e)
        }
      }
      
      console.log('📊 Total pages crawled:', crawledPages.length)
      
      // Combine all page content for AI analysis
      // Add a small high-signal header to reduce ambiguity for downstream extractors.
      websiteContent += `\n\n=== CONTEXT ===\nBase URL: ${url}\nTier: ${tier || 'free'}\n` +
        `${businessName ? `Input businessName hint: ${businessName}\n` : ''}` +
        `${businessType ? `Input businessType hint: ${businessType}\n` : ''}` +
        `${htmlLang ? `HTML lang: ${htmlLang}\n` : ''}` +
        `${metadata?.title ? `Page title: ${metadata.title}\n` : ''}` +
        `${metadata?.description ? `Meta description: ${metadata.description}\n` : ''}`

      for (const page of crawledPages) {
        // Skip PDFs and empty html
        if (!page.html || page.url.toLowerCase().endsWith('.pdf')) continue

        try {
          const isHomepage = page.url === url
          const imageSignals = extractImageSignals(page.html, page.url)
          const pageText = htmlToCleanText(page.html, isHomepage)

          const heroSignals = extractHeroSignalsFromCleanText(pageText)

          const typeLabel = page.type ? ` | Type: ${page.type}` : ''
          const linkLabel = page.linkText ? `\nLink text: "${page.linkText}"` : ''

          const imageBlock = imageSignals.length > 0
            ? `\n\nIMAGE SIGNALS (from <img> tags; use as evidence if relevant):\n${imageSignals.join('\n')}`
            : ''

          const heroBlock = heroSignals
            ? `\n\n${heroSignals}`
            : ''

          websiteContent += `\n\n=== Page: ${page.url}${typeLabel} ===${linkLabel}${imageBlock}${heroBlock}\n${pageText}`
          
          console.log(`📄 ${isHomepage ? 'Homepage' : 'Page'} content:`, pageText.length, 'chars')
        } catch (err) {
          console.warn('⚠️ Error processing page HTML:', page.url, err)
          continue
        }
      }
      
      // Limit total content based on tier
      websiteContent = websiteContent.slice(0, tierConfig.maxContentChars)
      console.log('📊 Content limited to', tierConfig.maxContentChars, 'chars for tier:', tier || 'free')
      
      console.log('✂️ Total processed content length:', websiteContent.length)
      
    } catch (fetchError) {
      console.error('Error crawling website:', fetchError)
      return new Response(
        JSON.stringify({ error: `Could not crawl website: ${(fetchError as Error).message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    console.log('🔑 API Key present:', !!openaiApiKey)
    
    if (!openaiApiKey) {
      console.error('❌ No OPENAI_API_KEY found')
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // PHASE 2: Intelligent Extraction Waterfall
    console.log('🚀 Phase 3: Starting extraction waterfall (zero-cost → low-cost → AI)...')
    
    let extractionCompleteness: ExtractionCompleteness | null = null
    let fieldsRequiringAI: string[] = []
    
    try {
      // Stage 1: Zero-cost extraction (JSON-LD + Meta tags)
      const stage1Result = await stage1ZeroCostExtraction(homepageHtml, metadata)
      
      // Stage 2: Low-cost extraction (Regex + HTML semantic)
      const stage2Result = await stage2LowCostExtraction(homepageHtml, url, stage1Result)
      
      // Calculate completeness
      extractionCompleteness = calculateCompleteness(stage2Result)
      
      console.log(`📊 Extraction completeness: ${extractionCompleteness.overallScore}/100`)
      console.log(`   Missing critical fields: ${extractionCompleteness.missingCriticalFields.join(', ') || 'none'}`)
      
      // Determine which fields need AI
      fieldsRequiringAI = identifyFieldsForAI(extractionCompleteness)
      
      // Short-circuit if we have everything we need (90%+ complete)
      if (extractionCompleteness.overallScore >= 90 && extractionCompleteness.missingCriticalFields.length === 0) {
        console.log('✅ Extraction waterfall complete - no AI needed (90%+ complete)')
      } else {
        console.log(`🤖 AI extraction required for ${fieldsRequiringAI.length} fields`)
      }
      
    } catch (waterfallError) {
      console.error('❌ Extraction waterfall failed:', waterfallError)
      // Continue with old AI extraction as fallback
    }
    
    // PHASE 2 (continued): Parallel AI Extraction with specialized extractors
    console.log('🚀 Starting parallel AI extraction with specialized models...')
    
    let analysisResult: any = {}
    let menuSignal: any = null
    let toneOfVoice: any = null
    
    try {
      // Run 3 extractors in parallel (basic, contact, keywords use cheap model)
      // Menu extractor runs separately as it needs the business type from basic info
      // Create OpenAI client for tone extraction
      const openaiClient = new OpenAI({ apiKey: openaiApiKey })
      const isPaidTier = tier === 'standardplus' || tier === 'premium'

      const [basicInfo, contactInfo, keywords, venueHooksRaw, experiencePillars, extractedMenuSignal, extractedToneOfVoice] = await Promise.all([
        extractBasicInfo(
          websiteContent,
          metadata,
          logoUrl,
          { businessName, businessType, homepageAboutCandidate, languageHint: htmlLang },
          openaiApiKey
        ),
        extractContact(
          websiteContent,
          structuredData,
          openaiApiKey,
          htmlLang // Pass language hint for country-specific extraction
        ),
        extractKeywords(
          websiteContent,
          businessName || null,
          businessType || null,
          openaiApiKey,
          htmlLang // Pass language hint for native keywords
        ),
        extractVenueHooks(
          websiteContent,
          openaiApiKey,
          { businessName: businessName || null, businessType: businessType || null, languageHint: htmlLang || null }
        ),
        extractExperiencePillars(
          websiteContent,
          openaiApiKey,
          { businessName: businessName || null, businessType: businessType || null, languageHint: htmlLang || null }
        ),
        // NEW: Menu signal extraction (Gemini 2.5 Flash - all tiers)
        extractMenuSignal(
          websiteContent,
          { 
            businessName: businessName || null, 
            businessType: getPrimaryType(businessType),
            languageHint: htmlLang || null
          }
        ),
        // NEW: Tone of voice extraction (GPT-4o-mini for Free, GPT-4o for Paid)
        extractToneOfVoice(
          websiteContent,
          getExtractorModel('toneOfVoice', tier || 'free'),
          openaiClient,
          { 
            businessName: businessName || null, 
            businessType: getPrimaryType(businessType),
            languageHint: htmlLang || null
          }
        )
      ])

      // Assign to outer scope variables so they're accessible outside try block
      menuSignal = extractedMenuSignal
      toneOfVoice = extractedToneOfVoice

      console.log('✅ Parallel extraction complete (7/7 extractors)')
      console.log('🍽️ Menu signal extracted:', JSON.stringify(menuSignal, null, 2))
      console.log('🎤 Tone of voice extracted:', toneOfVoice ? '✅' : '❌')

      // Phase 4: Validate extraction quality & detect misclassifications
      console.log('═══════════════════════════════════════════════════════════')
      console.log('🔍 Phase 4: Validating extraction quality...')
      console.log('═══════════════════════════════════════════════════════════')
      
      try {
        // Update completeness with AI results if available
        if (extractionCompleteness && basicInfo) {
          if (basicInfo.businessName) {
            extractionCompleteness.businessName = {
              value: basicInfo.businessName,
              status: 'FOUND',
              source: 'AI_CHEAP',
              confidence: 0.8
            }
          }
          
          if (basicInfo.businessType) {
            extractionCompleteness.businessType = {
              value: basicInfo.businessType,
              status: 'FOUND',
              source: 'AI_CHEAP',
              confidence: 0.8
            }
          }
          
          if (basicInfo.description) {
            extractionCompleteness.description = {
              value: basicInfo.description,
              status: 'FOUND',
              source: 'AI_CHEAP',
              confidence: 0.75
            }
          }
          
          if (contactInfo?.phone) {
            extractionCompleteness.phone = {
              value: contactInfo.phone,
              status: 'FOUND',
              source: 'AI_CHEAP',
              confidence: 0.7
            }
          }
          
          if (contactInfo?.email) {
            extractionCompleteness.email = {
              value: contactInfo.email,
              status: 'FOUND',
              source: 'AI_CHEAP',
              confidence: 0.7
            }
          }
          
          if (contactInfo?.address) {
            extractionCompleteness.address = {
              value: contactInfo.address,
              status: 'FOUND',
              source: 'AI_CHEAP',
              confidence: 0.7
            }
          }
        }
        
        // Detect hospitality indicators
        const hasMenuUrl = allMenuUrls.length > 0
        const hasBookingUrl = /book|reserv|bord/i.test(websiteContent)
        const jsonLdType = structuredData.length > 0 ? structuredData[0]['@type'] : null
        
        // Run validation
        if (extractionCompleteness) {
          const qualityReport = validateExtractionQuality(extractionCompleteness, {
            hasMenuUrl,
            hasBookingUrl,
            websiteContent: websiteContent.substring(0, 5000), // First 5KB for validation
            jsonLdType,
            metaDescription: metadata?.description || null
          })
          
          console.log(`📊 Quality report: ${qualityReport.overallQuality}`)
          console.log(`   Requires manual review: ${qualityReport.requiresManualReview}`)
          
          // Log auto-corrections
          if (qualityReport.autoCorrections.length > 0) {
            console.log('═══════════════════════════════════════════════════════════')
            console.log(`🔧 AUTO-CORRECTION APPLIED: ${qualityReport.autoCorrections.length} fix(es)`)
            console.log('═══════════════════════════════════════════════════════════')
            for (const correction of qualityReport.autoCorrections) {
              console.log(`   ⚠️ ${correction.field}:`)
              console.log(`      FROM: "${correction.from}"`)
              console.log(`      TO:   "${correction.to}"`)
              console.log(`      REASON: ${correction.reason}`)
              
              // Apply corrections to basicInfo
              if (correction.field === 'businessType' && basicInfo) {
                basicInfo.businessType = correction.to
                console.log(`   ✅ Applied correction to basicInfo.businessType`)
              }
            }
            console.log('═══════════════════════════════════════════════════════════')
          }
          
          // Log critical issues
          if (qualityReport.criticalIssues.length > 0) {
            console.error('❌ Critical quality issues detected:')
            for (const issue of qualityReport.criticalIssues) {
              console.error(`   - ${issue}`)
            }
          }
          
          // Log warnings
          for (const validation of qualityReport.validations) {
            if (validation.warnings.length > 0) {
              console.warn(`⚠️ ${validation.field} warnings:`, validation.warnings)
            }
          }
        }
        
      } catch (validationError) {
        console.error('❌ Validation failed:', validationError)
        // Continue without validation
      }

      // Normalize + merge venue hooks so downstream can rely on `.text`
      const normalizeVenueHooks = (payload: any): any => {
        const p = payload && typeof payload === 'object' ? payload : { uniqueHooks: [], positioning: { vibeKeywords: [], avoidKeywords: [], evidence: [] } }
        const uniqueHooksRaw: any[] = Array.isArray(p.uniqueHooks) ? p.uniqueHooks : []

        const uniqueHooks = uniqueHooksRaw
          .map((h) => {
            const hook = String(h?.hook || '').trim()
            const text = String(h?.text || h?.hook || '').trim()
            const confidence = (typeof h?.confidence === 'number') ? h.confidence : null
            const category = h?.category
            const evidence = Array.isArray(h?.evidence) ? h.evidence : []
            return {
              ...h,
              hook: hook || text,
              text: text || hook,
              confidence,
              category,
              evidence,
            }
          })
          .filter((h) => String(h?.text || '').trim().length >= 3)

        const positioning = p.positioning && typeof p.positioning === 'object' ? p.positioning : { vibeKeywords: [], avoidKeywords: [], evidence: [] }
        return { ...p, uniqueHooks, positioning }
      }

      const venueHooks = normalizeVenueHooks(venueHooksRaw)

      // Extract local_location_reference from venue hooks (location category)
      // This is the owner's own language for where they are — "ved åen", "på havnen" etc.
      // Stored on businesses table, used downstream in location intelligence + brand profile.
      const locationHooks = venueHooks.uniqueHooks
        .filter((h: any) => h.category === 'location' && h.confidence >= 0.6)
        .sort((a: any, b: any) => b.confidence - a.confidence)

      // Also scan metadata title/description for waterfront/location signals
      // e.g. "Lækker mad og oplevelser ved åen i Aarhus" → "ved åen"
      const DANISH_LOCATION_PATTERNS = [
        /\bved\s+åen\b/i,
        /\bved\s+havnen\b/i,
        /\bpå\s+havnen\b/i,
        /\bved\s+søen\b/i,
        /\bi\s+gågaden\b/i,
        /\bpå\s+strøget\b/i,
        /\bved\s+kanalen\b/i,
        /\bved\s+stranden\b/i,
        /\bved\s+fjorden\b/i,
        /\bi\s+havnekvarteret\b/i,
        /\bi\s+latinerkvarteret\b/i,
        /\bi\s+centrum\b/i,
        /\bpå\s+torvet\b/i,
      ]

      let localLocationReference: string | null = null

      // Priority 1: venue hook with location category + high confidence
      if (locationHooks.length > 0) {
        const hookText = locationHooks[0].hook

        // Try to extract a short location phrase from the hook text
        // e.g. "lækker mad og oplevelser ved åen i Aarhus" → "ved åen"
        let extracted: string | null = null
        for (const pattern of DANISH_LOCATION_PATTERNS) {
          const match = hookText.match(pattern)
          if (match) {
            extracted = match[0].trim().toLowerCase()
            break
          }
        }

        localLocationReference = extracted || hookText
        console.log('📍 local_location_reference from venue hook:', localLocationReference, '(source:', hookText, ')')
      }

      // Priority 2: pattern match from metadata title/description
      if (!localLocationReference) {
        const metaText = [metadata?.title, metadata?.description].filter(Boolean).join(' ')
        for (const pattern of DANISH_LOCATION_PATTERNS) {
          const match = metaText.match(pattern)
          if (match) {
            localLocationReference = match[0].trim().toLowerCase()
            console.log('📍 local_location_reference from metadata pattern:', localLocationReference)
            break
          }
        }
      }

      // Collect detected menu URLs (for Menukort tab to confirm/edit before extraction)
      const detectedMenuUrls: string[] = []
      
      // Add all detected menu URLs (not just the first one)
      allMenuUrls.forEach(url => {
        if (!detectedMenuUrls.includes(url)) {
          detectedMenuUrls.push(url)
        }
      })
      
      // Add menu PDFs
      for (const pdf of detectedPDFs) {
        if (!detectedMenuUrls.includes(pdf.url)) {
          detectedMenuUrls.push(pdf.url)
        }
      }
      console.log('📋 Detected menu URLs for user confirmation:', detectedMenuUrls.length)

      // DISABLED: Menu extraction now happens on-demand via menu-extract-v2
      // Users manually click "Hent" on each detected menu URL in the Menukort tab
      // This prevents automatic extraction of redundant/unwanted menus
      
      // // Run menu extraction for paid tiers (standardplus/premium) when menu content exists
      // const hasMenuContent = detectedMenuUrls.length > 0 || websiteContent.includes('=== PDF Menu')
      // if (hasMenuContent && paidTier) {
      //   console.log('🍽️ Running menu extraction for paid tier...')
      //   const extractedBusinessType = basicInfo.businessType || businessType || null
      //   menuExtraction = await extractMenu(
      //     websiteContent,
      //     menuUrl,
      //     extractedBusinessType,
      //     openaiApiKey
      //   )
      //   console.log('🍽️ Menu extraction complete:', menuExtraction.menuStructure?.length || 0, 'categories')
      // } else {
      //   console.log('⏭️ Skipping menu extraction:', hasMenuContent ? 'free tier' : 'no menu content detected')
      // }

      // Combine all extracted data into final result
      
      // Extract service model from website content with smart prioritization
      const contentLower = websiteContent.toLowerCase()
      const businessTypeDetected = basicInfo.businessType || businessType || ''
      // Use getPrimaryType to handle both string and hybrid businessType
      const businessTypeString = getPrimaryType(businessTypeDetected)
      const isRestaurant = businessTypeString.toLowerCase().includes('restaurant') || 
                          businessTypeString.toLowerCase().includes('cafe')
      
      // For restaurants/cafes, assume table service unless explicitly stated otherwise
      let hasTableService = isRestaurant || 
                           contentLower.includes('bordbetjening') || 
                           contentLower.includes('servering') ||
                           contentLower.includes('table service') ||
                           contentLower.includes('book') || 
                           contentLower.includes('reserver')
      
      // Detect takeaway/delivery as additional services (not replacements)
      const hasTakeaway = contentLower.includes('takeaway') || 
                         contentLower.includes('take-away') || 
                         contentLower.includes('take away') || 
                         contentLower.includes('afhent') || 
                         contentLower.includes('medbring') || 
                         contentLower.includes('to-go') || 
                         contentLower.includes('to go')
      
      const hasDelivery = contentLower.includes('delivery') || 
                         contentLower.includes('levering') || 
                         contentLower.includes('udbring') || 
                         contentLower.includes('just eat') || 
                         contentLower.includes('wolt') || 
                         contentLower.includes('foodora')
      
      const reservationRequired = contentLower.includes('reservation påkrævet') || 
                                 contentLower.includes('kun med reservation') || 
                                 contentLower.includes('reservation required') || 
                                 contentLower.includes('booking required')
      
      // Detect outdoor seating/serving
      const hasOutdoorSeating = contentLower.includes('ude servering') || 
                               contentLower.includes('udeservering') || 
                               contentLower.includes('outdoor seating') || 
                               contentLower.includes('terrace') || 
                               contentLower.includes('terrasse') || 
                               contentLower.includes('udenfor') || 
                               contentLower.includes('gårdhave') || 
                               contentLower.includes('haven') || 
                               contentLower.includes('patio') || 
                               contentLower.includes('outside') ||
                               contentLower.includes('al fresco')

      // Detect wifi
      const hasWifi = contentLower.includes('wifi') ||
                     contentLower.includes('wi-fi') ||
                     contentLower.includes('gratis internet') ||
                     contentLower.includes('free wifi') ||
                     contentLower.includes('free wi-fi') ||
                     contentLower.includes('trådløst internet')

      // Detect power outlets
      const hasPowerOutlets = contentLower.includes('stikkontakt') ||
                             contentLower.includes('strøm') && contentLower.includes('laptop') ||
                             contentLower.includes('power outlet') ||
                             contentLower.includes('power socket') ||
                             contentLower.includes('charging') ||
                             contentLower.includes('oplad')

      // Detect parking
      const hasParking = contentLower.includes('parkering') ||
                        contentLower.includes('parkeringsplads') ||
                        contentLower.includes('parking') ||
                        contentLower.includes('p-plads') ||
                        contentLower.includes('free parking') ||
                        contentLower.includes('gratis parkering')

      // Detect kids menu
      const hasKidsMenu = contentLower.includes('børnemenu') ||
                         contentLower.includes('børn') && contentLower.includes('menu') ||
                         contentLower.includes('kids menu') ||
                         contentLower.includes('children') && contentLower.includes('menu') ||
                         contentLower.includes('barnmenu') ||
                         contentLower.includes('familievenlig')

      const serviceModel = {
        takeaway: hasTakeaway,
        delivery: hasDelivery,
        hasTableService: hasTableService,
        reservationRequired: reservationRequired,
        outdoorSeating: hasOutdoorSeating,
        wifi: hasWifi,
        powerOutlets: hasPowerOutlets,
        parking: hasParking,
        kidsMenu: hasKidsMenu
      }
      console.log('🍽️ Service model detected (restaurant=', isRestaurant, '):', serviceModel)

      analysisResult = {
        // Basic info
        businessName: basicInfo.businessName,
        businessType: basicInfo.businessType, // Now supports hybrid structure
        businessTypeLabel: getBusinessTypeLabel(basicInfo.businessType), // Display label for UI
        shortDescription: (() => {
          // Terrasse guard: only keep "terrasse" in the description if the scraped content
          // literally confirms it. AI can hallucinate it from general knowledge.
          let desc: string | null = basicInfo.description
          if (desc && /terrasse/i.test(desc) && !contentLower.includes('terrasse')) {
            desc = desc
              .replace(/\budendørs\s+terrasse\b/gi, 'udeservering')
              .replace(/\bterrasse\b/gi, 'udeservering')
            console.log('⚠️ short_description terrasse guard: replaced "terrasse" (not confirmed in scrape)')
          }
          return desc
        })(), // Homepage "about" text for Om forretningen tab
        logoUrl: basicInfo.logoUrl,
        
        // Contact info
        contact: contactInfo,
        
        // Detected menu URLs (not extracted yet - for Menukort tab)
        detectedMenuUrls: detectedMenuUrls,
        
        // Menu structure (for paid tiers with menu content)
        offerings: menuExtraction ? {
          menuStructure: menuExtraction.menuStructure,
          dietaryOptions: menuExtraction.dietaryOptions,
        } : undefined,
        takeaway: serviceModel.takeaway || menuExtraction?.takeaway || null,
        outdoorSeating: serviceModel.outdoorSeating || null,
        delivery: serviceModel.delivery || menuExtraction?.delivery || null,
        hasTableService: serviceModel.hasTableService || menuExtraction?.hasTableService || null,
        reservationRequired: serviceModel.reservationRequired || menuExtraction?.reservationRequired || null,
        wifi: serviceModel.wifi || null,
        powerOutlets: serviceModel.powerOutlets || null,
        parking: serviceModel.parking || null,
        kidsMenu: serviceModel.kidsMenu || null,
        establishmentType: menuExtraction?.establishmentType || null,  // FSE or SBO classification
        
        // Keywords
        keywords: keywords,

        // Venue hooks (concrete differentiators + positioning)
        venueHooks: venueHooks,

        // Experience pillars (reliable content categories + supported assets)
        experiencePillars: experiencePillars,
        
        // Opening hours (pre-extracted)
        openingHours: extractedHours || {},

        // Manual review hint when the homepage exposes conflicting hours blocks
        openingHoursReviewRequired,
        openingHoursReviewReasons,

        // Kitchen close time (pre-extracted)
        kitchenCloseTime: kitchenCloseTime || null,

        // NEW: Menu signal (lightweight menu overview - all tiers)
        menuSignal: menuSignal || null,

        // NEW: Tone of voice (brand voice analysis - all tiers)
        toneOfVoice: toneOfVoice || null,

        // Local location reference (owner's language for where they are)
        localLocationReference: localLocationReference || null
      }

      // DEBUG MODE: Return comprehensive extraction data
      if (debugMode) {
        console.log('🔍 DEBUG MODE: Returning extraction breakdown')
        const hasMenuContent = detectedMenuUrls.length > 0 || websiteContent.includes('=== PDF Menu')
        
        const debugResult = {
          _debugMode: true,
          _timestamp: new Date().toISOString(),
          
          // 1. Pre-extracted data (before AI)
          preExtracted: {
            structuredData: structuredData,
            metadata: metadata,
            openingHours: extractedHours,
            openingHoursReviewRequired,
            openingHoursReviewReasons,
            logoUrl: logoUrl,
            menuUrl: menuUrl,
            bookingUrl: bookingUrl,
            kitchenCloseTime: kitchenCloseTime,
            detectedPDFs: detectedPDFs
          },
          
          // 2. AI extractor results (Phase 2)
          aiExtractors: {
            basicInfo: basicInfo,
            contactInfo: contactInfo,
            keywords: keywords,
            venueHooks: venueHooks,
            experiencePillars: experiencePillars,
            menuExtraction: menuExtraction
          },
          
          // 3. Content statistics
          contentStats: {
            totalContentLength: websiteContent.length,
            pagesCrawled: crawledPages.length,
            tier: tier || 'free',
            hasMenuContent: hasMenuContent,
            menuExtractionRan: !!menuExtraction,
            extractionMethod: menuExtraction 
              ? 'Full extraction: Basic + Contact + Keywords + Menu'
              : 'Business Info Only: Basic + Contact + Keywords (no menu extraction)'
          },
          
          // 4. Content preview (first 2000 chars)
          contentPreview: websiteContent.slice(0, 2000),
          
          // 5. What would be returned in normal mode
          normalizedResult: {
            ...analysisResult,
            url: url,
            menuUrl: menuUrl,
            bookingUrl: bookingUrl,
            detectedPDFs: detectedPDFs.length > 0 ? detectedPDFs : undefined
          }
        }
        
        return new Response(
          JSON.stringify(debugResult, null, 2),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('✅ Business info extraction complete (no menu extraction)')
      
    } catch (extractionError) {
      console.error('❌ AI extraction failed:', extractionError)
      return new Response(
        JSON.stringify({ 
          error: 'AI extraction failed',
          details: (extractionError as Error).message
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Add the original URL to the result
    analysisResult.url = url
    
    // Use detected URLs if AI didn't find them
    if (!analysisResult.menuUrl && menuUrl) {
      analysisResult.menuUrl = menuUrl
    }
    if (!analysisResult.bookingUrl && bookingUrl) {
      analysisResult.bookingUrl = bookingUrl
    }
    
    // Use extracted logo if AI didn't find one
    if (!analysisResult.logoUrl && logoUrl) {
      analysisResult.logoUrl = logoUrl
      console.log('🎨 Using extracted logo URL:', logoUrl)
    }
    
    // Add detected PDFs to response if any found
    if (detectedPDFs.length > 0) {
      analysisResult.detectedPDFs = detectedPDFs
      console.log('📄 Detected PDFs for potential storage:', detectedPDFs.length)
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DATABASE PERSISTENCE - Save analysis results to database
    // ═══════════════════════════════════════════════════════════════════════════

    let persistenceMeta: {
      attempted: boolean
      businessId?: string
      lastRunAt?: string
      updated?: boolean
      inserted?: boolean
      error?: string
      note?: string
      success?: boolean
    } = {
      attempted: false,
      updated: false,
      inserted: false,
    }
    
    if (businessId) {
      console.log('💾 Persisting analysis to database for business:', businessId)
      persistenceMeta.attempted = true
      persistenceMeta.businessId = businessId
      
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
        const authHeader = req.headers.get('Authorization')
        const supabaseKey = supabaseServiceKey || supabaseAnonKey

        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey, {
            global: {
              headers: authHeader ? { Authorization: authHeader } : {},
            },
          })

          // Use new persistence module
          const result = await saveWebsiteAnalysis({
            businessId,
            url,
            analysisResult,
            bookingUrl,
            menuExtraction,
            menuSignal,
            toneOfVoice,
            supabase,
            authHeader
          })

          // Merge results into persistenceMeta
          Object.assign(persistenceMeta, result)
        } else {
          console.warn('⚠️ Skipping persistence: missing SUPABASE_URL or SUPABASE key')
          persistenceMeta.error = 'missing_supabase_env: SUPABASE_URL or SUPABASE key not configured'
        }
      } catch (dbError) {
        console.error('❌ Database persistence failed:', dbError)
        persistenceMeta.error = dbError instanceof Error ? dbError.message : String(dbError)
      }
    } else {
      persistenceMeta.note = 'not_persisted: missing businessId in request'
    }

    // Always attach meta so the client can verify persistence happened.
    analysisResult._persistence = persistenceMeta
    
    console.log('✅ Analysis complete, returning:', analysisResult)

    return new Response(
      JSON.stringify(analysisResult),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Error in analyze-website function:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
