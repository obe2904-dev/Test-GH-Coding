// =====================================================
// detect-menus/index.ts (v2)
// =====================================================
// Purpose: Detect menu URLs from a business website via Cloud Run scraper,
//          classify each URL's source_kind, and return both the legacy
//          string[] and the richer detectedSources payload.
// Used by: /dashboard/menu page — Step 1 "Find menusider"
//
// Classification kinds:
//   'mealo'           — *.mealo.dk (dedicated JSON-API extraction path planned)
//   'iframe_platform' — other third-party booking/menu SPAs
//   'pdf'             — .pdf extension or application/pdf content-type
//   'image'           — image extension or image/* content-type
//   'html'            — everything else
// =====================================================

// @ts-ignore
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
// @ts-ignore
declare const Deno: any

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// =====================================================
// Types
// =====================================================

interface DetectMenusRequest {
  url: string
  businessId?: string
}

interface RawMenuUrl {
  url: string
  confidence?: number
  evidence?: string
  detection_method?: string
  label?: string
}

type SourceKind = 'html' | 'pdf' | 'image' | 'mealo' | 'iframe_platform'

interface SourceResult {
  url: string
  source_kind: SourceKind
  confidence: number
  evidence: string
  detection_method: string
  label?: string
}

/** Internal working item: raw URL + content-type learned during expansion (if any) */
interface WorkItem extends RawMenuUrl {
  /** content-type observed when we fetched this URL, '' if never fetched */
  observedContentType: string
}

// =====================================================
// Constants
// =====================================================

/**
 * Third-party SPA platforms that render menus client-side.
 * NOTE: mealo.dk is intentionally NOT in this list — Mealo gets its own
 * source_kind because it has a known underlying JSON API and will receive
 * a dedicated extraction path. Add new generic platforms here.
 */
const IFRAME_PLATFORM_HOSTS = [
  'dinnerbooking.com',
  'ordersystem.dk',
  'tablemanager.io',
  'restablo.dk',
  'zenchef.com',
  'webflow.io',  // Webflow sites load content dynamically
]

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i
const PDF_EXTENSION = /\.pdf(\?|$)/i

const HEAD_TIMEOUT_MS = 4000
const EXPANSION_FETCH_TIMEOUT_MS = 8000

// =====================================================
// Helper: classify source_kind
// =====================================================

function classifySourceKind(
  url: string,
  contentType: string,
  detectionMethod: string,
): SourceKind {
  const urlLower = url.toLowerCase()
  const ct = (contentType || '').toLowerCase()

  // 1. Mealo — checked FIRST, before generic platforms.
  //    Pattern: restaurantname.mealo.dk or mealo.dk itself.
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host === 'mealo.dk' || host.endsWith('.mealo.dk')) {
      return 'mealo'
    }
    // 2. Other iframe/SPA platforms
    if (IFRAME_PLATFORM_HOSTS.some((p) => host === p || host.endsWith('.' + p))) {
      return 'iframe_platform'
    }
  } catch {
    // unparseable URL — fall through to extension checks
  }

  // 3. PDF — content-type wins over extension when present
  if (ct.includes('pdf') || PDF_EXTENSION.test(urlLower)) return 'pdf'

  // 4. Image
  if (ct.startsWith('image/') || IMAGE_EXTENSIONS.test(urlLower)) return 'image'

  // 5. Landing-page image extractions without a content-type
  if (
    detectionMethod === 'landing_page_srcset' ||
    detectionMethod === 'landing_page_img'
  ) {
    return 'image'
  }

  // 6. Default
  return 'html'
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
// Helper: Detect landing/navigation pages
// =====================================================

function isLandingPage(html: string, text: string, url?: string): boolean {
  if (url) {
    try {
      const path = new URL(url).pathname.toLowerCase()
      if (/^\/(da|en|de|se|no)?\/?menu\/?$/i.test(path)) {
        console.log(`  → Landing page: URL path matches navigation pattern: ${path}`)
        return true
      }
    } catch { /* ignore */ }
  }

  if (text.length < 500) {
    console.log(`  → Landing page: text only ${text.length} chars`)
    return true
  }

  const hasMenuNav = /menu|frokost|aften|lunch|dinner|brunch|morgenmad|cocktail|bar/i.test(text)
  const hasMenuItems = /kr\.|,-|\d+\s*kr|price|pris|\d+\s*dkk/i.test(text)

  if (hasMenuNav && !hasMenuItems && text.length < 2000) {
    console.log('  → Landing page: has navigation but no menu items')
    return true
  }

  return false
}

// =====================================================
// Helper: URL normalisation for deduplication
// =====================================================

function normalizeUrlForDedup(url: string): string {
  try {
    const parsed = new URL(url)
    const newParams = new URLSearchParams()
    const keep = parsed.searchParams.get('page')
    if (keep) newParams.set('page', keep)
    // Mealo: restaurantid query param IS the identity — preserve it
    const restaurantId = parsed.searchParams.get('restaurantid')
    if (restaurantId) newParams.set('restaurantid', restaurantId)
    parsed.search = newParams.toString()
    return parsed.href
  } catch {
    return url
  }
}

// =====================================================
// Helper: False-positive filter
// =====================================================

function isFalsePositiveUrl(url: string): boolean {
  const u = url.toLowerCase()
  return [
    'privacy', 'privatlivs', 'cookie', 'kontakt', 'contact',
    'om-os', 'about', 'terms', 'betingelser', 'gdpr',
  ].some((t) => u.includes(t))
}

// =====================================================
// Helper: Extract child menu URLs from a landing page
// =====================================================

function extractMenuUrlsFromHtml(html: string, baseUrl: string): RawMenuUrl[] {
  const urls: RawMenuUrl[] = []
  const seen = new Set<string>()

  const add = (
    rawUrl: string,
    method: string,
    evidence: string,
    label?: string,
    confidence = 0.8,
  ) => {
    try {
      const abs = new URL(rawUrl, baseUrl).href
      const norm = normalizeUrlForDedup(abs)
      if (isFalsePositiveUrl(abs)) return
      if (seen.has(norm)) return
      seen.add(norm)
      urls.push({ url: abs, confidence, evidence, detection_method: method, label })
    } catch { /* skip invalid URLs */ }
  }

  // <source srcset="...">
  for (const m of html.matchAll(/<source[^>]+srcset=["']([^"']+)["'][^>]*>/gi)) {
    const srcUrl = m[1].split(',')[0].trim().split(' ')[0]
    const alt = (m[0].match(/alt=["']([^"']+)["']/i) || [])[1] || ''
    if (/menu|frokost|aften|lunch|dinner/i.test(alt)) {
      const label = alt.replace(/souk|menu|summer|winter|forår|efterår/gi, '').trim()
      add(srcUrl, 'landing_page_srcset', alt, label || undefined, 0.85)
    }
  }

  // <img src="...">
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)) {
    const alt = (m[0].match(/alt=["']([^"']+)["']/i) || [])[1] || ''
    if (/menu|frokost|aften/i.test(alt)) {
      const label = alt.replace(/souk|menu/gi, '').trim()
      add(m[1], 'landing_page_img', alt, label || undefined, 0.8)
    }
  }

  // <a href="...">
  for (const m of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)) {
    const href = m[1]
    if (isFalsePositiveUrl(href)) continue
    if (/\.(pdf|jpg|jpeg|png|webp)/i.test(href) || /menu|frokost|aften/i.test(href)) {
      const text = (m[0].match(/>([^<]+)</i) || [])[1]?.trim()
      add(href, 'landing_page_link', 'Link to menu file', text, 0.75)
    }
  }

  console.log(`  → Extracted ${urls.length} child URL(s) from landing page`)
  return urls
}

// =====================================================
// Main handler
// =====================================================

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const startTime = Date.now()
    const { url, businessId }: DetectMenusRequest = await req.json()

    if (!url) throw new Error('url is required')

    console.log('🔍 Detecting menus for:', url, businessId ? `(business: ${businessId})` : '')

    // ---- Auth ----
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('authorization')
    if (!authHeader) throw new Error('Missing authorization header')

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) throw new Error('Invalid or expired token')

    console.log('✅ User authenticated:', user.id)

    // ---- Tier check ----
    // Adjust PAID_PLANS to match tierStore.ts canonical slugs
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .maybeSingle()

    const plan = profile?.plan || 'free'
    const PAID_PLANS = ['smart', 'pro', 'standardplus', 'premium']
    if (!PAID_PLANS.includes(plan)) {
      return new Response(
        JSON.stringify({
          error: 'Menu detection requires a paid subscription (Smart or Pro)',
          plan,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    console.log('✅ Tier check passed:', plan)

    // ---- Call Cloud Run scraper ----
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
        openai_api_key: openaiApiKey,
      }),
      signal: AbortSignal.timeout(65000),
    })

    if (!scrapeResponse.ok) {
      const errorText = await scrapeResponse.text()
      console.error('❌ Scraper failed:', scrapeResponse.status, errorText)
      throw new Error(`Scraper failed: ${scrapeResponse.status} ${errorText}`)
    }

    const payload = await scrapeResponse.json()
    console.log('✅ Scrape complete')

    // ---- Extract raw menu URLs from scraper payload ----
    const menuAll: RawMenuUrl[] = payload.extraction?.services?.menu_all || []
    console.log(`📋 Cloud Run detected ${menuAll.length} initial URL(s)`)

    // ---- Expand landing pages, CAPTURING content-type as we go ----
    // Every URL that passes through this loop either:
    //   (a) gets fetched → we record its content-type in observedContentType, or
    //   (b) fails to fetch → observedContentType stays '' and classification
    //       falls back to URL patterns (plus a parallel HEAD later if needed).
    // Landing-page CHILDREN are never fetched here → observedContentType = ''.
    const expanded: WorkItem[] = []
    const expandedLandingPages = new Set<string>()

    for (const item of menuAll) {
      const menuUrl = item.url
      console.log(`\n🔍 Checking: ${menuUrl}`)

      // Skip fetching for URLs classifiable from the hostname alone —
      // Mealo/SPA pages return a JS shell that tells us nothing anyway.
      const preClassified = classifySourceKind(menuUrl, '', item.detection_method || 'keyword')
      if (preClassified === 'mealo' || preClassified === 'iframe_platform') {
        console.log(`  ✅ Platform URL (${preClassified}) — no fetch needed`)
        expanded.push({ ...item, observedContentType: '' })
        continue
      }

      try {
        const urlResp = await fetch(menuUrl, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MenuDetectorBot/1.0)',
            'Accept': 'text/html,*/*;q=0.8',
          },
          signal: AbortSignal.timeout(EXPANSION_FETCH_TIMEOUT_MS),
        })

        if (!urlResp.ok) {
          console.log(`  ⚠️ HTTP ${urlResp.status} — keeping original`)
          expanded.push({ ...item, observedContentType: '' })
          continue
        }

        const contentType = urlResp.headers.get('content-type') || ''

        // Non-HTML: direct file, keep with its observed content-type
        if (!contentType.includes('html')) {
          console.log(`  ✅ Direct file (${contentType}) — keeping`)
          expanded.push({ ...item, observedContentType: contentType })
          continue
        }

        // HTML: landing-page check
        const html = await urlResp.text()
        const text = htmlToText(html)

        if (isLandingPage(html, text, menuUrl)) {
          const children = extractMenuUrlsFromHtml(html, menuUrl)
          if (children.length > 0) {
            console.log(`  ✅ Expanded landing page → ${children.length} child URL(s)`)
            expanded.push(
              ...children.map((c) => ({ ...c, observedContentType: '' })),
            )
            expandedLandingPages.add(normalizeUrlForDedup(menuUrl))
          } else {
            console.log('  ⚠️ Landing page with no extractable children — skipping')
          }
        } else {
          console.log(`  ✅ Has menu content (${text.length} chars) — keeping as HTML`)
          expanded.push({ ...item, observedContentType: contentType })
        }
      } catch (err: any) {
        console.log(`  ⚠️ Fetch failed: ${err.message} — keeping original`)
        expanded.push({ ...item, observedContentType: '' })
      }
    }

    // ---- Deduplicate ----
    const deduped: WorkItem[] = []
    const finalSeen = new Set<string>()

    for (const item of expanded) {
      const norm = normalizeUrlForDedup(item.url)
      if (expandedLandingPages.has(norm)) {
        console.log(`  🗑️ Removing expanded landing page: ${item.url}`)
        continue
      }
      if (finalSeen.has(norm)) {
        console.log(`  🗑️ Removing duplicate: ${item.url}`)
        continue
      }
      finalSeen.add(norm)
      deduped.push(item)
    }

    // ---- Parallel HEAD only for URLs we never fetched AND cannot classify
    //      confidently from the URL alone ----
    // Candidates: observedContentType === '' AND URL-pattern classification
    // returns 'html' (i.e. no extension, no platform host — genuinely unknown).
    // Runs in parallel; total added latency ≈ HEAD_TIMEOUT_MS worst case.
    const needsHead = deduped.filter((item) => {
      if (item.observedContentType) return false
      const kind = classifySourceKind(item.url, '', item.detection_method || 'keyword')
      return kind === 'html'
    })

    if (needsHead.length > 0) {
      console.log(`\n🔎 Parallel HEAD for ${needsHead.length} unclassified URL(s)`)
      const results = await Promise.allSettled(
        needsHead.map((item) =>
          fetch(item.url, {
            method: 'HEAD',
            redirect: 'follow',
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MenuDetectorBot/1.0)' },
            signal: AbortSignal.timeout(HEAD_TIMEOUT_MS),
          }).then((r) => ({ item, contentType: r.headers.get('content-type') || '' })),
        ),
      )
      for (const r of results) {
        if (r.status === 'fulfilled') {
          r.value.item.observedContentType = r.value.contentType
        }
        // rejected → observedContentType stays '', URL-pattern fallback applies
      }
    }

    // ---- Final classification ----
    const detectedSources: SourceResult[] = deduped.map((item) => {
      const source_kind = classifySourceKind(
        item.url,
        item.observedContentType,
        item.detection_method || 'keyword',
      )
      console.log(`  ✅ ${item.url} → ${source_kind}`)
      return {
        url: item.url,
        source_kind,
        confidence: item.confidence ?? 0.9,
        evidence: item.evidence ?? 'Menu',
        detection_method: item.detection_method ?? 'keyword',
        label: item.label,
      }
    })

    // ---- Response ----
    const detectedMenuUrls = detectedSources.map((s) => s.url)

    const detectionMethods: Record<string, number> = {}
    const sourceKinds: Record<string, number> = {}
    for (const s of detectedSources) {
      detectionMethods[s.detection_method] = (detectionMethods[s.detection_method] || 0) + 1
      sourceKinds[s.source_kind] = (sourceKinds[s.source_kind] || 0) + 1
    }

    const duration = Date.now() - startTime
    console.log(`\n✅ Final: ${detectedMenuUrls.length} URL(s) in ${duration}ms`, sourceKinds)

    return new Response(
      JSON.stringify({
        success: true,
        detectedMenuUrls,   // string[] — legacy contract, do not remove
        detectedSources,    // SourceResult[] — url + source_kind + metadata
        metadata: {
          totalFound: detectedMenuUrls.length,
          detectionMethods,
          sourceKinds,
          duration_ms: duration,
          scraper_version: 'cloud-run-v3',
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message || 'Menu detection failed', success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
