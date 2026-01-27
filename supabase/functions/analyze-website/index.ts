// @ts-ignore - Deno import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno import
import { createClient } from 'npm:@supabase/supabase-js@2.39.0'

// @ts-ignore - Deno global
declare const Deno: any;

// Import shared utilities
import { htmlToCleanText } from '../_shared/html-parser.ts'
import { extractStructuredData } from '../_shared/structured-data-extractor.ts'
import { extractOpeningHours } from '../_shared/opening-hours-extractor.ts'
import { extractMetadata } from '../_shared/metadata-extractor.ts'
import { extractTextFromPdf } from '../_shared/pdf-parser.ts'

// Import AI extractors
import { extractBasicInfo } from '../_shared/ai-extractors/basic-info-extractor.ts'
import { extractContact } from '../_shared/ai-extractors/contact-extractor.ts'
import { extractKeywords } from '../_shared/ai-extractors/keywords-extractor.ts'
import { extractMenu } from '../_shared/ai-extractors/menu-extractor.ts'
import { extractVenueHooks } from '../_shared/ai-extractors/venue-hooks-extractor.ts'
import { extractExperiencePillars } from '../_shared/ai-extractors/experience-pillars-extractor.ts'
import { extractVisualVenueHooks } from '../_shared/ai-extractors/visual-venue-hooks-extractor.ts'

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
    
    const { url, businessName, businessType, tier, debugMode, businessId } = body

    if (!url || typeof url !== 'string') {
      console.error('❌ Missing URL in request')
      return new Response(
        JSON.stringify({ error: 'Missing required field: url' }),
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
        'free': 'gpt-4o', // Upgraded from mini for better extraction
        'standardplus': 'gpt-4o', // Upgraded from mini for better extraction
        'standard_plus': 'gpt-4o', // Handle underscore variant
        'premium': 'gpt-4o',
      }
      
      return tierModelMap[userTier || 'free'] || 'gpt-4o'
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
          maxPriorityPages: 1, // Homepage + 1 priority page (ABOUT or MENU)
          maxContentChars: 140000, // Homepage (120KB) + 1 page (20KB)
          allowPdfParsing: false,
          allowAiLinkClassification: false,
          description: 'Homepage + 1 priority page for better context'
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

    const extractImageSignals = (html: string, pageUrl: string): string[] => {
      if (!html) return []

      const tags = html.match(/<img\b[^>]*>/gi) || []
      const lines: string[] = []

      for (const tag of tags.slice(0, 80)) {
        const attrs: Record<string, string> = {}
        const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(["'])(.*?)\2/g
        let m: RegExpExecArray | null
        while ((m = attrRe.exec(tag)) !== null) {
          attrs[m[1].toLowerCase()] = (m[3] || '').trim()
        }

        const alt = (attrs['alt'] || '').trim()
        const title = (attrs['title'] || '').trim()
        const aria = (attrs['aria-label'] || '').trim()

        const srcRaw = (attrs['src'] || attrs['data-src'] || attrs['data-original'] || '').trim()
        if (!alt && !title && !aria && !srcRaw) continue
        if (srcRaw.startsWith('data:')) continue

        let absSrc = srcRaw
        try {
          if (srcRaw) absSrc = new URL(srcRaw, pageUrl).toString()
        } catch {
          // keep raw
        }

        let fileName = ''
        try {
          const u = new URL(absSrc)
          const last = u.pathname.split('/').pop() || ''
          fileName = decodeURIComponent(last)
        } catch {
          const last = absSrc.split('/').pop() || ''
          fileName = last.split('?')[0] || ''
        }

        // Prefer concrete signals: alt/aria/title and filename.
        const label = alt || aria || title
        const normalizedFile = (fileName || '').replace(/\s+/g, ' ').trim()
        const normalizedLabel = (label || '').replace(/\s+/g, ' ').trim()

        const parts: string[] = []
        if (normalizedLabel) parts.push(`alt: "${normalizedLabel}"`)
        if (normalizedFile) parts.push(`file: "${normalizedFile}"`)
        if (!normalizedLabel && absSrc) parts.push(`src: "${absSrc}"`)

        if (parts.length === 0) continue
        const line = `- IMG ${parts.join(' | ')}`
        if (!lines.includes(line)) lines.push(line)
        if (lines.length >= 25) break
      }

      return lines
    }

    const extractImageUrls = (html: string, pageUrl: string): string[] => {
      if (!html) return []

      const urls: string[] = []

      // 1) OpenGraph/Twitter images
      const metaMatches = html.matchAll(
        /<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/gi
      )
      for (const m of Array.from(metaMatches).slice(0, 3)) {
        const raw = (m[1] || '').trim()
        if (!raw) continue
        try {
          urls.push(new URL(raw, pageUrl).toString())
        } catch {
          urls.push(raw)
        }
      }

      const twitterMatches = html.matchAll(
        /<meta\s+[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*>/gi
      )
      for (const m of Array.from(twitterMatches).slice(0, 2)) {
        const raw = (m[1] || '').trim()
        if (!raw) continue
        try {
          urls.push(new URL(raw, pageUrl).toString())
        } catch {
          urls.push(raw)
        }
      }

      // 2) <img> src/data-src
      const tags = html.match(/<img\b[^>]*>/gi) || []
      for (const tag of tags.slice(0, 60)) {
        const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(["'])(.*?)\2/g
        const attrs: Record<string, string> = {}
        let m: RegExpExecArray | null
        while ((m = attrRe.exec(tag)) !== null) {
          attrs[m[1].toLowerCase()] = (m[3] || '').trim()
        }
        const srcRaw = (attrs['src'] || attrs['data-src'] || attrs['data-original'] || '').trim()
        if (!srcRaw || srcRaw.startsWith('data:')) continue

        let abs = srcRaw
        try {
          abs = new URL(srcRaw, pageUrl).toString()
        } catch {
          // keep raw
        }
        urls.push(abs)
      }

      // De-dupe while preserving order
      const seen = new Set<string>()
      const out: string[] = []
      for (const u of urls) {
        const s = String(u || '').trim()
        if (!s) continue
        if (seen.has(s)) continue
        seen.add(s)
        out.push(s)
        if (out.length >= 20) break
      }
      return out
    }

    const isHospitalityBusiness = (value: unknown): boolean => {
      const s = String(value || '').toLowerCase()
      return [
        'restaurant',
        'cafe',
        'café',
        'bar',
        'bistro',
        'brasserie',
        'cocktail',
        'vinbar',
        'wine',
        'pizza',
        'burger',
        'brunch',
      ].some((k) => s.includes(k))
    }

    const isVisualPageCandidate = (href: string, text: string, ariaLabel: string, title: string): boolean => {
      const lower = [href, text, ariaLabel, title].join(' ').toLowerCase()
      const patterns = [
        'kig-indenfor',
        'kig indenfor',
        'indenfor',
        'galleri',
        'gallery',
        'foto',
        'fotos',
        'billeder',
        'stemning',
        'interiør',
        'interior',
        'our space',
      ]
      return patterns.some((p) => lower.includes(p))
    }

    const extractHeroSignalsFromCleanText = (pageText: string): string => {
      if (!pageText) return ''
      const lines = pageText.split('\n').map((l) => l.trim()).filter(Boolean)
      if (lines.length === 0) return ''

      // Prefer the first few semantic heading markers and a couple lines after each.
      const collected: string[] = []
      const maxHeadings = 3
      let headingsSeen = 0

      for (let i = 0; i < lines.length && headingsSeen < maxHeadings; i++) {
        const line = lines[i]
        const isHeading =
          line.startsWith('### H1:') ||
          line.startsWith('## H2:') ||
          line.startsWith('# H3:')

        if (!isHeading) continue

        headingsSeen++
        if (!collected.includes(line)) collected.push(line)

        // Add up to 2 following non-heading lines as context.
        let added = 0
        for (let j = i + 1; j < lines.length && added < 2; j++) {
          const next = lines[j]
          if (next.startsWith('### H1:') || next.startsWith('## H2:') || next.startsWith('# H3:')) break
          if (next.length < 3) continue
          const snippet = next.length > 180 ? next.slice(0, 180) + '…' : next
          collected.push(`  ${snippet}`)
          added++
        }
      }

      if (collected.length === 0) {
        // Fallback: first 3 meaningful lines
        const fallback = lines.slice(0, 3).map((l) => (l.length > 180 ? l.slice(0, 180) + '…' : l))
        return fallback.length > 0 ? `HERO SIGNALS:\n${fallback.map((l) => `- ${l}`).join('\n')}` : ''
      }

      return `HERO SIGNALS:\n${collected.map((l) => `- ${l}`).join('\n')}`
    }
    
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
      
      console.log('🌐 Fetching homepage:', url)
      
      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout
      
      let homepageResp
      try {
        // Fetch homepage (depth 0) with more complete headers
        homepageResp = await fetch(url, {
          headers: {
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
          },
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
      
        console.log('📡 Homepage response status:', homepageResp.status)
        
        if (!homepageResp.ok) {
          throw new Error(`Failed to fetch website: ${homepageResp.status} ${homepageResp.statusText}`)
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        
        // Provide more specific error messages
        if (fetchError.name === 'AbortError') {
          throw new Error(`Website took too long to respond (timeout after 15 seconds)`)
        }
        
        // Handle connection errors with helpful messages
        const errorMsg = fetchError.message || String(fetchError)
        if (errorMsg.includes('Connection reset') || errorMsg.includes('ECONNRESET')) {
          throw new Error(`Website refused connection. The site may be blocking automated requests or temporarily unavailable.`)
        }
        if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('timeout')) {
          throw new Error(`Website connection timed out. The site may be slow or temporarily unavailable.`)
        }
        if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
          throw new Error(`Website not found. Please check the URL is correct.`)
        }
        
        throw new Error(`Could not connect to website: ${errorMsg}`)
      }
      
      let homepageHtml = await homepageResp.text()
      console.log('📄 Homepage HTML length:', homepageHtml.length)
      
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

      // Extract "about block" candidate from homepage for better description
      const extractAboutBlock = (html: string): string => {
        // Danish keywords (prioritized) - check these first
        const danishKeywords = [
          'velkommen', 'om os', 'vores', 'vi er', 'hos os',
          'restaurant', 'café', 'køkken', 'brunch', 'frokost',
          'historie', 'tradition', 'passion', 'filosofi',
          'åbent', 'beliggende', 'serverer', 'tilbyder'
        ]
        
        // English keywords (fallback)
        const englishKeywords = [
          'welcome', 'about us', 'about', 'our', 'we are', 'at our',
          'kitchen', 'story', 'philosophy', 'offers', 'serves'
        ]
        
        // Combined for matching
        const aboutKeywords = [...danishKeywords, ...englishKeywords]
        
        // Helper to check if text is likely Danish (contains æ, ø, å or common Danish words)
        const isDanish = (text: string): boolean => {
          const lower = text.toLowerCase()
          return /[æøå]/.test(lower) || 
                 danishKeywords.some(kw => lower.includes(kw)) ||
                 /\b(og|til|med|fra|den|det|er|på|i)\b/.test(lower)
        }
        
        const candidates: Array<{text: string; isDanish: boolean}> = []
        
        // Try to find content after H1/H2 headings
        const headingBlocks = html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>([\s\S]{0,1500}?)(?=<h[12]|<footer|<nav|$)/gi)
        for (const match of headingBlocks) {
          const headingText = match[1].replace(/<[^>]*>/g, '').toLowerCase()
          const followingContent = match[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
          
          // Check if heading or content contains about keywords
          const combined = (headingText + ' ' + followingContent).toLowerCase()
          if (aboutKeywords.some(kw => combined.includes(kw)) && followingContent.length > 50) {
            // Return first 2-3 sentences (up to 500 chars)
            const sentences = followingContent.match(/[^.!?]+[.!?]+/g) || []
            const result = sentences.slice(0, 3).join(' ').slice(0, 500).trim()
            if (result.length > 50) {
              candidates.push({ text: result, isDanish: isDanish(result) })
            }
          }
        }
        
        // Fallback: Look for paragraphs containing about keywords
        const paragraphs = html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)
        for (const match of paragraphs) {
          const text = match[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
          if (text.length > 80 && text.length < 800) {
            const lower = text.toLowerCase()
            if (aboutKeywords.some(kw => lower.includes(kw))) {
              // Return first 2-3 sentences
              const sentences = text.match(/[^.!?]+[.!?]+/g) || []
              const result = sentences.slice(0, 3).join(' ').slice(0, 500).trim()
              if (result.length > 50) {
                candidates.push({ text: result, isDanish: isDanish(result) })
              }
            }
          }
        }
        
        // Prioritize Danish content over English
        const danishCandidate = candidates.find(c => c.isDanish)
        if (danishCandidate) {
          console.log('📝 Found Danish about text (prioritized)')
          return danishCandidate.text
        }
        
        // Fallback to first candidate (even if English)
        if (candidates.length > 0) {
          console.log('📝 Using first about text candidate (no Danish found)')
          return candidates[0].text
        }
        
        // Last fallback: Use meta description if available
        return ''
      }
      
      homepageAboutCandidate = extractAboutBlock(homepageHtml)
      if (homepageAboutCandidate) {
        console.log('📝 Pre-extracted about block:', homepageAboutCandidate.slice(0, 100) + '...')
      }

      // Try to extract opening hours before AI processing
      extractedHours = extractOpeningHours(homepageHtml, structuredData)
      if (extractedHours) {
        console.log('✅ Pre-extracted opening hours:', Object.keys(extractedHours))
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
      
      // Known booking platform domains (for external booking links)
      const bookingPlatformDomains = [
        'dinnerbooking.com',
        'thefork.com',
        'quandoo.dk',
        'quandoo.com',
        'opentable.com',
        'eatapp.co',
        'resmio.com',
        'menoo.dk',
        'bordbooking.dk',
        'tableonline.dk',
        'resengo.com',
        'bookatable.dk',
        'superbexperience.com',  // SuperB booking platform
        'booksy.com',            // Popular for beauty/wellness
        'fresha.com',            // Beauty/wellness booking
        'treatwell.com',         // Beauty/wellness booking
      ]
      
      // Classify links using all available signals
      const classifyLink = (href: string, text: string, ariaLabel: string = '', title: string = '') => {
        // Combine all signals for better classification
        const lower = [href, text, ariaLabel, title].join(' ').toLowerCase()
        
        // 1) Explicit cancel/afbestilling detection
        const cancelPatterns = ['afbestilling', 'aflys', 'cancel', 'cancellation']
        if (cancelPatterns.some(p => lower.includes(p))) {
          return 'CANCEL'
        }
        
        // 2) Ignore junk pages
        const ignorePatterns = [
          'cookie',
          'privacy',
          'persondata',
          'gdpr',
          'terms',
          'vilkår',
          'betingelser',
          'faq',
          'jobs',
          'karriere',
          'job',
          'career',
        ]
        if (ignorePatterns.some(p => lower.includes(p))) {
          return 'IGNORE'
        }
        
        // 3) Booking pages – check BEFORE menu to avoid "dinnerbooking" matching "dinner"
        const bookingRegexes = [
          /\bbook\b/i,
          /\bbooking\b/i,
          /\breservation\b/i,
          /\breserver\b/i,
          /\bbestil bord\b/i,
          /\bbook bord\b/i,
          /\bbestil tid\b/i,
          /dinnerbooking/i,  // Explicit booking platform
        ]
        
        if (bookingRegexes.some(re => re.test(lower))) {
          return 'BOOKING'
        }
        
        // 4) Menu pages - expanded Danish patterns (checked AFTER booking)
        const menuPatterns = [
          'menu', 'menukort', 'mad', 'drikke', 'food', 'drinks', 'spise', 'eat',
          'cocktail', 'vin', 'wine', 'øl', 'beer', 'brunch', 'frokost', 'aften',
          'julefrokost', 'julemenu', 'morgenmad', 'breakfast', 'lunch',
          'dessert', 'snack', 'tapas', 'smørrebrød', 'buffet'
        ]
        // Use word boundary for 'dinner' to avoid matching 'dinnerbooking'
        const isDinnerMenu = /\bdinner\b/i.test(lower) && !lower.includes('booking')
        
        if (menuPatterns.some(p => lower.includes(p)) || isDinnerMenu) {
          return 'MENU'
        }
        
        // 5) Contact pages
        const contactPatterns = ['contact', 'kontakt', 'find', 'location', 'adresse', 'address']
        if (contactPatterns.some(p => lower.includes(p))) {
          return 'CONTACT'
        }
        
        // 6) About pages
        const aboutPatterns = ['about', 'om', 'story', 'historie', 'who', 'hvem']
        if (aboutPatterns.some(p => lower.includes(p))) {
          return 'ABOUT'
        }
        
        return 'OTHER'
      }
      
      // Classify internal links + external booking platform links
      const internalLinks = links.filter(l => l.isInternal)
      const externalBookingLinks = links.filter(l => 
        !l.isInternal && bookingPlatformDomains.some(domain => l.href.includes(domain))
      )
      
      // Combine for classification
      const linksToClassify = [...internalLinks, ...externalBookingLinks]
      
      classifiedLinks = linksToClassify.map(link => ({
        ...link,
        type: classifyLink(link.href, link.text, link.ariaLabel, link.title)
      }))
      
      console.log('📋 Link classification:', {
        menu: classifiedLinks.filter(l => l.type === 'MENU').length,
        booking: classifiedLinks.filter(l => l.type === 'BOOKING').length,
        cancel: classifiedLinks.filter(l => l.type === 'CANCEL').length,
        contact: classifiedLinks.filter(l => l.type === 'CONTACT').length,
        about: classifiedLinks.filter(l => l.type === 'ABOUT').length,
        other: classifiedLinks.filter(l => l.type === 'OTHER').length,
        ignored: classifiedLinks.filter(l => l.type === 'IGNORE').length
      })
      
      // AI classification for unclear links (type === 'OTHER')
      const unclearLinks = classifiedLinks.filter(l => l.type === 'OTHER')
      
      if (unclearLinks.length > 0 && tierConfig.allowAiLinkClassification) {
        console.log('🤔 Found unclear links:', unclearLinks.length, '- calling AI for classification...')
        
        try {
          const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
          if (openaiApiKey) {
            const linkClassificationPrompt = `Classify these website links into categories: MENU, BOOKING, CONTACT, ABOUT, or IGNORE.

Links to classify:
${unclearLinks.map((l, idx) => `${idx + 1}. URL: ${l.href}\n   Text: "${l.text}"`).join('\n')}

Return a JSON array with the same order:
[
  {"index": 0, "type": "MENU|BOOKING|CONTACT|ABOUT|IGNORE"},
  {"index": 1, "type": "..."}
]

Categories:
- MENU: Menu, food/drink listings
- BOOKING: Reservations, table booking, appointments
- CONTACT: Contact info, location, map
- ABOUT: About us, history, team
- IGNORE: Not relevant (privacy, terms, social media links, etc.)`

            const aiClassifyResp = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiApiKey}`
              },
              body: JSON.stringify({
                model: aiModel,
                messages: [
                  { role: 'system', content: 'You are a link classifier. Return only valid JSON.' },
                  { role: 'user', content: linkClassificationPrompt }
                ],
                temperature: 0.1,
                max_tokens: 500,
                response_format: { type: 'json_object' }
              })
            })

            if (aiClassifyResp.ok) {
              const aiData = await aiClassifyResp.json()
              const aiContent = aiData?.choices?.[0]?.message?.content
              
              if (aiContent) {
                const cleanedContent = aiContent
                  .replace(/```json\n?/g, '')
                  .replace(/```\n?/g, '')
                  .trim()
                
                const classifications = JSON.parse(cleanedContent)
                const classArray = Array.isArray(classifications) ? classifications : (classifications.classifications || [])
                
                console.log('🤖 AI classified:', classArray.length, 'links')
                
                // Update classifications
                classArray.forEach((item: any) => {
                  const idx = item.index
                  if (idx >= 0 && idx < unclearLinks.length) {
                    const link = unclearLinks[idx]
                    const originalIdx = classifiedLinks.findIndex(l => l.href === link.href)
                    if (originalIdx >= 0 && item.type !== 'IGNORE') {
                      classifiedLinks[originalIdx].type = item.type
                      console.log(`  ✨ Reclassified: ${link.href} → ${item.type}`)
                    }
                  }
                })
              }
            }
          }
        } catch (aiError) {
          console.log('⚠️ AI classification failed, using pattern-only results:', aiError)
        }
      }
      
      // Extract special URLs (after AI reclassification)
      // Collect ALL menu URLs (not just the first one) - deduplicated
      const uniqueMenuUrls = new Set(
        classifiedLinks
          .filter(l => l.type === 'MENU')
          .map(l => l.href)
      )
      
      allMenuUrls = Array.from(uniqueMenuUrls)
        .sort((a, b) => {
          // Deprioritize URLs containing 'english' - put them at the end
          const aIsEnglish = a.toLowerCase().includes('english')
          const bIsEnglish = b.toLowerCase().includes('english')
          if (aIsEnglish && !bIsEnglish) return 1  // a goes after b
          if (!aIsEnglish && bIsEnglish) return -1 // a goes before b
          return 0 // maintain original order
        })
      
      menuUrl = allMenuUrls[0] || null // Keep first one for backward compatibility
      
      console.log('🍽️ Found menu URLs:', allMenuUrls.length, allMenuUrls)
      
      const bookingCandidates = classifiedLinks.filter(l => l.type === 'BOOKING')
      
      console.log('🔖 Booking candidates found:', bookingCandidates.length, bookingCandidates.map(c => ({ href: c.href, text: c.text })))
      
      // Prefer external booking providers first (already included in classifiedLinks)
      const externalBooking = bookingCandidates.find(l =>
        bookingPlatformDomains.some(domain => l.href.includes(domain))
      )
      
      // Fallback: any booking candidate
      bookingUrl = externalBooking?.href || bookingCandidates[0]?.href || null
      
      // Collect detected PDF files for consent workflow
      for (const link of classifiedLinks) {
        if (link.href.toLowerCase().endsWith('.pdf') && ['MENU', 'ABOUT'].includes(link.type)) {
          const urlParts = link.href.split('/')
          const fileName = urlParts[urlParts.length - 1] || 'document.pdf'
          detectedPDFs.push({
            url: link.href,
            type: link.type,
            name: fileName
          })
        }
      }
      
      console.log('🎯 Final detected URLs:', { menuUrl, bookingUrl, detectedPDFs: detectedPDFs.length })
      
      // Store homepage
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

    // PHASE 2: Parallel AI Extraction with specialized extractors
    console.log('🚀 Starting parallel AI extraction with specialized models...')
    
    let analysisResult: any = {}
    
    try {
      // Run 3 extractors in parallel (basic, contact, keywords use cheap model)
      // Menu extractor runs separately as it needs the business type from basic info
      const paidTier = tierConfig.maxPriorityPages >= 3 // standardplus or premium
      const hospitalityBoost = isHospitalityBusiness(businessType) || isHospitalityBusiness(businessName)

      // Collect a small set of image URLs across crawled pages for optional vision extraction.
      // We do this only for hospitality + paid tiers to control cost.
      let imageUrlsForVision: string[] = []
      if (paidTier && hospitalityBoost) {
        const all: string[] = []
        for (const p of crawledPages) {
          if (!p.html) continue
          all.push(...extractImageUrls(p.html, p.url))
          if (all.length >= 30) break
        }
        // Prefer same-origin images first; then keep a few extras.
        const sameOrigin: string[] = []
        const other: string[] = []
        for (const u of all) {
          try {
            const host = new URL(u).hostname
            if (host === baseDomainForCrawl) sameOrigin.push(u)
            else other.push(u)
          } catch {
            other.push(u)
          }
        }
        imageUrlsForVision = [...sameOrigin, ...other].slice(0, tierConfig.maxPriorityPages >= 5 ? 6 : 4)
        console.log('🖼️ Vision image candidates:', imageUrlsForVision.length)
      }

      const [basicInfo, contactInfo, keywords, venueHooksRaw, experiencePillars, visualVenueHooks] = await Promise.all([
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
        (paidTier && hospitalityBoost && imageUrlsForVision.length > 0)
          ? extractVisualVenueHooks(
              imageUrlsForVision,
              openaiApiKey,
              { businessName: businessName || null, businessType: businessType || null, languageHint: htmlLang || null }
            )
          : Promise.resolve({ uniqueHooks: [] })
      ])

      console.log('✅ Parallel extraction complete (6/6 extractors)')

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

      if (visualVenueHooks?.uniqueHooks?.length) {
        const existing: any[] = Array.isArray(venueHooks.uniqueHooks) ? venueHooks.uniqueHooks : []
        const merged = [...existing]

        const seen = new Set<string>(existing.map((h) => String(h?.text || h?.hook || '').toLowerCase().trim()).filter(Boolean))
        for (const vh of visualVenueHooks.uniqueHooks) {
          const key = String((vh as any)?.text || (vh as any)?.hook || '').toLowerCase().trim()
          if (!key || seen.has(key)) continue
          seen.add(key)
          merged.push({
            ...vh,
            // ensure both keys exist
            hook: String((vh as any)?.hook || (vh as any)?.text || '').trim(),
            text: String((vh as any)?.text || (vh as any)?.hook || '').trim(),
          })
        }

        venueHooks.uniqueHooks = merged.slice(0, 12)
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
      const isRestaurant = businessTypeDetected.toLowerCase().includes('restaurant') || 
                          businessTypeDetected.toLowerCase().includes('cafe')
      
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
      
      const serviceModel = {
        takeaway: hasTakeaway,
        delivery: hasDelivery,
        hasTableService: hasTableService,
        reservationRequired: reservationRequired,
        outdoorSeating: hasOutdoorSeating
      }
      console.log('🍽️ Service model detected (restaurant=', isRestaurant, '):', serviceModel)
      
      analysisResult = {
        // Basic info
        businessName: basicInfo.businessName,
        businessType: basicInfo.businessType,
        shortDescription: basicInfo.description, // Homepage "about" text for Om forretningen tab
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
        establishmentType: menuExtraction?.establishmentType || null,  // FSE or SBO classification
        
        // Keywords
        keywords: keywords,

        // Venue hooks (concrete differentiators + positioning)
        venueHooks: venueHooks,

        // Experience pillars (reliable content categories + supported assets)
        experiencePillars: experiencePillars,
        
        // Opening hours (pre-extracted)
        openingHours: extractedHours || {}
      }

      // DEBUG MODE: Return comprehensive extraction data
      if (debugMode) {
        console.log('🔍 DEBUG MODE: Returning extraction breakdown')
        
        const debugResult = {
          _debugMode: true,
          _timestamp: new Date().toISOString(),
          
          // 1. Pre-extracted data (before AI)
          preExtracted: {
            structuredData: structuredData,
            metadata: metadata,
            openingHours: extractedHours,
            logoUrl: logoUrl,
            menuUrl: menuUrl,
            bookingUrl: bookingUrl,
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

    const persistenceMeta: {
      attempted: boolean
      businessId?: string
      lastRunAt?: string
      updated: boolean
      inserted: boolean
      error?: string
      note?: string
    } = {
      attempted: false,
      updated: false,
      inserted: false,
    }
    
    // PERSIST TO DATABASE (if businessId provided)
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

          if (supabaseServiceKey) {
            console.log('🔑 Persisting with service role key')
          } else {
            console.log('🔑 Persisting with anon key (caller auth header present:', !!authHeader, ')')
          }

          // Merge into existing raw_result (if any) so we don't clobber older shapes.
          let mergedRawResult: Record<string, any> = {
            analysis: { ...analysisResult },
          }

          const { data: existingWA, error: existingWAError } = await supabase
            .from('website_analyses')
            .select('raw_result')
            .eq('business_id', businessId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (existingWAError) {
            console.warn('⚠️ Could not read existing website_analyses.raw_result (will overwrite analysis only):', existingWAError.message)
          } else if (existingWA?.raw_result && typeof existingWA.raw_result === 'object') {
            const existingRawResult = existingWA.raw_result as Record<string, any>
            const existingAnalysis = (existingRawResult.analysis && typeof existingRawResult.analysis === 'object')
              ? (existingRawResult.analysis as Record<string, any>)
              : {}

            mergedRawResult = {
              ...existingRawResult,
              analysis: {
                ...existingAnalysis,
                ...analysisResult,
              },
            }
          }
          
          // 1. Save to website_analyses (update latest by business_id; insert if missing)
          const runAt = new Date().toISOString()
          const websiteAnalysisUpdate = {
            source_url: url,
            status: 'success',
            last_run_at: runAt,
            raw_result: mergedRawResult,
          }
          persistenceMeta.lastRunAt = runAt

          const { data: updatedRows, error: waUpdateError } = await supabase
            .from('website_analyses')
            .update(websiteAnalysisUpdate)
            .eq('business_id', businessId)
            .select('id')

          if (waUpdateError) {
            console.warn('⚠️ Failed to update website_analyses:', waUpdateError.message)
            persistenceMeta.error = `update_failed: ${waUpdateError.message}`
          }

          if (!waUpdateError && updatedRows && updatedRows.length > 0) {
            console.log('✅ Updated website_analyses')
            persistenceMeta.updated = true
          } else {
            const { error: waInsertError } = await supabase
              .from('website_analyses')
              .insert({
                business_id: businessId,
                ...websiteAnalysisUpdate,
              })

            if (waInsertError) {
              console.warn('⚠️ Failed to insert website_analyses:', waInsertError.message)
              persistenceMeta.error = `insert_failed: ${waInsertError.message}`
            } else {
              console.log('✅ Inserted website_analyses')
              persistenceMeta.inserted = true
            }
          }

          // 2. Upsert to business_profile (short_description, keywords, menu_structure, booking_url)
          const profileData: Record<string, any> = {
            business_id: businessId,
            updated_at: new Date().toISOString()
          }
          
          if (analysisResult.shortDescription) {
            profileData.short_description = analysisResult.shortDescription
          }
          if (analysisResult.keywords?.length > 0) {
            profileData.keywords = analysisResult.keywords
          }
          if (menuExtraction && menuExtraction.menuStructure && menuExtraction.menuStructure.length > 0) {
            profileData.menu_structure = menuExtraction.menuStructure
          }
          // Add booking URL if detected (for CTA buttons)
          if (bookingUrl) {
            profileData.booking_url = bookingUrl
            console.log('🎫 Saving booking URL to profile:', bookingUrl)
          }
          
          const { error: bpError } = await supabase
            .from('business_profile')
            .upsert(profileData, { onConflict: 'business_id' })
          
          if (bpError) {
            console.warn('⚠️ Failed to save business_profile:', bpError.message)
          } else {
            console.log('✅ Saved to business_profile')
          }
          
          // 3. Update contact in business_locations (if contact info extracted)
          if (analysisResult.contact) {
            const contact = analysisResult.contact
            const locationUpdateData: Record<string, any> = {}
            
            if (contact.phone) locationUpdateData.phone = contact.phone
            if (contact.email) locationUpdateData.email = contact.email
            if (contact.address) {
              if (typeof contact.address === 'string') {
                locationUpdateData.address_line1 = contact.address
              } else {
                if (contact.address.street) locationUpdateData.address_line1 = contact.address.street
                if (contact.address.city) locationUpdateData.city = contact.address.city
                if (contact.address.postalCode) locationUpdateData.postal_code = contact.address.postalCode
                if (contact.address.country) locationUpdateData.country = contact.address.country
              }
            }
            
            // Only update if we have some contact data
            if (Object.keys(locationUpdateData).length > 0) {
              // First check if primary location exists
              const { data: existingLoc } = await supabase
                .from('business_locations')
                .select('id')
                .eq('business_id', businessId)
                .eq('is_primary', true)
                .maybeSingle()
              
              let locError
              if (existingLoc) {
                // Update existing primary location
                const result = await supabase
                  .from('business_locations')
                  .update(locationUpdateData)
                  .eq('business_id', businessId)
                  .eq('is_primary', true)
                locError = result.error
              } else {
                // Insert new primary location
                const result = await supabase
                  .from('business_locations')
                  .insert({
                    business_id: businessId,
                    is_primary: true,
                    country: 'Denmark',
                    ...locationUpdateData
                  })
                locError = result.error
              }
              
              if (locError) {
                console.warn('⚠️ Failed to save business_locations:', locError.message)
              } else {
                console.log('✅ Saved to business_locations')
              }
            }
          }
          
          // 4. Upsert opening hours (if extracted)
          if (analysisResult.openingHours && Object.keys(analysisResult.openingHours).length > 0) {
            const hoursToInsert = Object.entries(analysisResult.openingHours).map(([day, hours]: [string, any]) => ({
              business_id: businessId,
              weekday: day.toLowerCase(),
              open_time: hours.closed ? null : hours.open,
              close_time: hours.closed ? null : hours.close,
              closed: hours.closed || false,
              kind: 'normal'
            }))
            
            // Delete existing hours first, then insert new ones
            await supabase.from('opening_hours').delete().eq('business_id', businessId)
            
            const { error: ohError } = await supabase
              .from('opening_hours')
              .insert(hoursToInsert)
            
            if (ohError) {
              console.warn('⚠️ Failed to save opening_hours:', ohError.message)
            } else {
              console.log('✅ Saved', hoursToInsert.length, 'opening_hours entries')
            }
          }
          
          // 5. Save establishment type to business_operations (if classified)
          if (analysisResult.establishmentType) {
            console.log('🏢 Saving establishment type:', analysisResult.establishmentType)
            const { error: opsError } = await supabase
              .from('business_operations')
              .upsert({
                business_id: businessId,
                establishment_type: analysisResult.establishmentType,
                updated_at: new Date().toISOString()
              }, { onConflict: 'business_id' })
            
            if (opsError) {
              console.warn('⚠️ Failed to save establishment_type to business_operations:', opsError.message)
            } else {
              console.log('✅ Saved establishment_type to business_operations:', analysisResult.establishmentType)
            }
          } else {
            console.log('ℹ️ No establishment type classified (menu structure may be empty)')
          }
          
        } else {
          console.warn('⚠️ Skipping persistence: missing SUPABASE_URL or SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY')
          persistenceMeta.error = 'missing_supabase_env: SUPABASE_URL or SUPABASE key not configured'
        }
      } catch (dbError) {
        console.error('❌ Database persistence failed:', dbError)
        // Don't fail the whole request, just log the error
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
