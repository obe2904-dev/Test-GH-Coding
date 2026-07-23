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
import { validatePublicUrl } from '../_shared/url-security.ts'
import {
  classifyDetectedMenuSource,
  extractCanonicalMenuUrl,
  isFalsePositiveMenuUrl,
  isLikelyMenuSitemapUrl,
  normalizeMenuDiscoveryUrl,
  type DetectedMenuSourceKind,
} from '../_shared/menu-detection-quality.ts'
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

type SourceKind = DetectedMenuSourceKind

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

const HEAD_TIMEOUT_MS = 4000
const EXPANSION_FETCH_TIMEOUT_MS = 8000
const MAX_DISCOVERY_CANDIDATES = 20
const MAX_EXPANSION_HTML_BYTES = 1_000_000
const SCRAPER_TIMEOUT_MS = 42_000
const SITEMAP_TIMEOUT_MS = 7_000

async function userHasBusinessAccess(
  supabase: any,
  businessId: string,
  userId: string,
): Promise<boolean> {
  const { data: ownedBusiness } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .eq('owner_id', userId)
    .maybeSingle()

  if (ownedBusiness) return true

  const { data: membership } = await supabase
    .from('business_team_members')
    .select('business_id')
    .eq('business_id', businessId)
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
    .maybeSingle()

  return Boolean(membership)
}

async function readResponseTextAtMost(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return ''

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  while (total < maxBytes) {
    const { value, done } = await reader.read()
    if (done || !value) break
    const remaining = maxBytes - total
    const chunk = value.byteLength > remaining ? value.slice(0, remaining) : value
    chunks.push(chunk)
    total += chunk.byteLength
    if (chunk.byteLength < value.byteLength) {
      await reader.cancel()
      break
    }
  }

  const combined = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(combined)
}

function extractDiscoveryCandidates(payload: any): RawMenuUrl[] {
  const discoveries = Array.isArray(payload?.menu_discovery) ? payload.menu_discovery : []
  const candidates: RawMenuUrl[] = []

  const addAssets = (
    values: unknown,
    detectionMethod: string,
    evidence: string,
    confidence: number,
  ) => {
    if (!Array.isArray(values)) return
    for (const value of values) {
      const url = typeof value === 'string'
        ? value
        : typeof (value as any)?.url === 'string'
          ? (value as any).url
          : ''
      if (!url) continue
      candidates.push({
        url,
        confidence,
        evidence,
        detection_method: detectionMethod,
        label: typeof (value as any)?.text === 'string'
          ? (value as any).text
          : typeof (value as any)?.alt === 'string'
            ? (value as any).alt
            : undefined,
      })
    }
  }

  for (const discovery of discoveries) {
    const assets = discovery?.assets || {}
    addAssets(assets.pdfLinks, 'browser_discovery_pdf', 'PDF discovered in rendered menu page', 0.9)
    addAssets(assets.imageLinks, 'browser_discovery_image', 'Image discovered in rendered menu page', 0.88)
    addAssets(assets.displayedImages, 'browser_discovery_image', 'Displayed menu image discovered in rendered page', 0.85)
    addAssets(assets.submenuLinks, 'browser_discovery_submenu', 'Submenu discovered in rendered menu page', 0.82)
  }

  return candidates
}

// =====================================================
// Helper: classify source_kind
// =====================================================

function classifySourceKind(
  url: string,
  contentType: string,
  detectionMethod: string,
): SourceKind {
  return classifyDetectedMenuSource(url, contentType, detectionMethod)
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
  return normalizeMenuDiscoveryUrl(url)
}

// =====================================================
// Helper: False-positive filter
// =====================================================

function isFalsePositiveUrl(url: string, label = ''): boolean {
  return isFalsePositiveMenuUrl(url, label)
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
}

function extractSitemapLocations(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi))
    .map((match) => decodeXmlText(match[1].trim()))
    .filter(Boolean)
}

async function fetchSitemapText(url: string): Promise<string> {
  validatePublicUrl(url)
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MenuDetectorBot/1.0)',
      'Accept': 'application/xml,text/xml,text/plain;q=0.9,*/*;q=0.5',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(SITEMAP_TIMEOUT_MS),
  })
  if (!response.ok) return ''
  return await readResponseTextAtMost(response, MAX_EXPANSION_HTML_BYTES)
}

async function discoverMenusFromSitemap(websiteUrl: string): Promise<RawMenuUrl[]> {
  const root = new URL(websiteUrl)
  const sitemapUrl = new URL('/sitemap.xml', root.origin).href
  const robotsUrl = new URL('/robots.txt', root.origin).href

  const [sitemapXml, robotsText] = await Promise.all([
    fetchSitemapText(sitemapUrl).catch(() => ''),
    fetchSitemapText(robotsUrl).catch(() => ''),
  ])

  const robotsSitemaps = Array.from(
    robotsText.matchAll(/^\s*Sitemap:\s*(\S+)\s*$/gim),
    (match) => match[1],
  )
  const initialLocations = extractSitemapLocations(sitemapXml)
  const nestedSitemaps = [...robotsSitemaps, ...initialLocations]
    .filter((candidate) => /sitemap.*\.xml(?:\?|$)/i.test(candidate))
    .slice(0, 5)
  const nestedXml = await Promise.all(
    nestedSitemaps.map((candidate) => fetchSitemapText(candidate).catch(() => '')),
  )

  const seen = new Set<string>()
  const candidates: RawMenuUrl[] = []
  for (const candidate of [...initialLocations, ...nestedXml.flatMap(extractSitemapLocations)]) {
    if (!isLikelyMenuSitemapUrl(candidate) || isFalsePositiveUrl(candidate)) continue
    try {
      validatePublicUrl(candidate)
      const normalized = normalizeUrlForDedup(candidate)
      if (seen.has(normalized)) continue
      seen.add(normalized)
      candidates.push({
        url: candidate,
        confidence: 0.76,
        evidence: 'Menu page discovered through public sitemap',
        detection_method: 'sitemap_fallback',
      })
    } catch {
      // Ignore malformed or non-public sitemap entries.
    }
  }
  return candidates.slice(0, MAX_DISCOVERY_CANDIDATES)
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
      if (isFalsePositiveUrl(abs, label || evidence)) return
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

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'url is required', success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    if (!businessId) {
      return new Response(
        JSON.stringify({ error: 'businessId is required', success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    try {
      validatePublicUrl(url)
    } catch (urlError) {
      return new Response(
        JSON.stringify({
          error: urlError instanceof Error ? urlError.message : 'Invalid public URL',
          success: false,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

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

    if (!await userHasBusinessAccess(supabase, businessId, user.id)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: no access to business', success: false }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

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

    console.log('📡 Calling Cloud Run scraper...')

    let payload: any
    let scraperWarning: string | null = null
    try {
      const scrapeResponse = await fetch(`${cloudRunUrl}/scrape-v3`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey || '',
        },
        body: JSON.stringify({
          url,
          business_id: businessId,
        }),
        signal: AbortSignal.timeout(SCRAPER_TIMEOUT_MS),
      })

      if (!scrapeResponse.ok) {
        const errorText = await scrapeResponse.text()
        throw new Error(`Scraper failed: ${scrapeResponse.status} ${errorText}`)
      }

      payload = await scrapeResponse.json()
      console.log('✅ Scrape complete')
    } catch (scraperError) {
      scraperWarning = scraperError instanceof Error ? scraperError.message : String(scraperError)
      console.warn('⚠️ Primary scraper unavailable; trying sitemap fallback:', scraperWarning)
      const sitemapCandidates = await discoverMenusFromSitemap(url)
      payload = {
        extraction: { services: { menu_all: sitemapCandidates } },
        menu_discovery: [],
      }
    }

    // ---- Extract raw menu URLs from scraper payload ----
    const menuAll: RawMenuUrl[] = payload.extraction?.services?.menu_all || []
    const browserDiscovered = extractDiscoveryCandidates(payload)
    const discoveryCandidates = [...menuAll, ...browserDiscovered]
      .filter((item) => !isFalsePositiveUrl(item.url, item.label || item.evidence || ''))
      .slice(0, MAX_DISCOVERY_CANDIDATES)
    console.log(
      `📋 Cloud Run detected ${menuAll.length} link(s) and ${browserDiscovered.length} rendered asset(s)`,
    )

    // ---- Expand landing pages, CAPTURING content-type as we go ----
    // Every URL that passes through this loop either:
    //   (a) gets fetched → we record its content-type in observedContentType, or
    //   (b) fails to fetch → observedContentType stays '' and classification
    //       falls back to URL patterns (plus a parallel HEAD later if needed).
    // Landing-page CHILDREN are never fetched here → observedContentType = ''.
    const expanded: WorkItem[] = []
    const expandedLandingPages = new Set<string>()

    const expansionResults = await Promise.all(discoveryCandidates.map(async (item) => {
      const menuUrl = item.url
      console.log(`\n🔍 Checking: ${menuUrl}`)

      try {
        validatePublicUrl(menuUrl)
      } catch (urlError) {
        console.warn(`  ⛔ Skipping unsafe discovered URL: ${menuUrl}`, urlError)
        return { items: [] as WorkItem[], expandedLandingPage: null as string | null }
      }

      const preClassified = classifySourceKind(menuUrl, '', item.detection_method || 'keyword')
      if (preClassified === 'mealo' || preClassified === 'iframe_platform') {
        console.log(`  ✅ Platform URL (${preClassified}) — no fetch needed`)
        return {
          items: [{ ...item, observedContentType: '' }],
          expandedLandingPage: null,
        }
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
          return {
            items: [{ ...item, observedContentType: '' }],
            expandedLandingPage: null,
          }
        }

        const contentType = urlResp.headers.get('content-type') || ''
        if (!contentType.includes('html')) {
          console.log(`  ✅ Direct file (${contentType}) — keeping`)
          return {
            items: [{ ...item, observedContentType: contentType }],
            expandedLandingPage: null,
          }
        }

        const html = await readResponseTextAtMost(urlResp, MAX_EXPANSION_HTML_BYTES)
        const text = htmlToText(html)
        const canonicalUrl = extractCanonicalMenuUrl(html, menuUrl)
        let preferredUrl = menuUrl
        if (canonicalUrl) {
          try {
            validatePublicUrl(canonicalUrl)
            preferredUrl = canonicalUrl
          } catch {
            console.warn(`  ⚠️ Ignoring unsafe canonical URL: ${canonicalUrl}`)
          }
        }

        if (isLandingPage(html, text, menuUrl)) {
          const children = extractMenuUrlsFromHtml(html, menuUrl)
          if (children.length > 0) {
            console.log(`  ✅ Expanded landing page → ${children.length} child URL(s)`)
            return {
              items: children.map((child) => ({ ...child, observedContentType: '' })),
              expandedLandingPage: normalizeUrlForDedup(menuUrl),
            }
          }
          console.log('  ⚠️ Landing page with no extractable children — keeping original')
        } else {
          console.log(`  ✅ Has menu content (${text.length} chars) — keeping as HTML`)
        }

        return {
          items: [{ ...item, url: preferredUrl, observedContentType: contentType }],
          expandedLandingPage: null,
        }
      } catch (err: any) {
        console.log(`  ⚠️ Fetch failed: ${err.message} — keeping original`)
        return {
          items: [{ ...item, observedContentType: '' }],
          expandedLandingPage: null,
        }
      }
    }))

    for (const result of expansionResults) {
      expanded.push(...result.items)
      if (result.expandedLandingPage) {
        expandedLandingPages.add(result.expandedLandingPage)
      }
    }

    // ---- Deduplicate ----
    const deduped: WorkItem[] = []
    const finalSeen = new Set<string>()

    for (const item of expanded) {
      if (isFalsePositiveUrl(item.url, item.label || item.evidence || '')) {
        console.log(`  🗑️ Removing false positive: ${item.url}`)
        continue
      }
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
          Promise.resolve().then(() => {
            validatePublicUrl(item.url)
            return fetch(item.url, {
              method: 'HEAD',
              redirect: 'follow',
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MenuDetectorBot/1.0)' },
              signal: AbortSignal.timeout(HEAD_TIMEOUT_MS),
            })
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
          scraper_warning: scraperWarning,
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
