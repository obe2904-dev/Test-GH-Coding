// @ts-ignore - Deno import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno ESM import with specific version
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { parseMenuPeriods } from '../_shared/menuPeriodParser.ts'
import { validatePublicUrl, looksLikeLoginPage } from '../_shared/url-security.ts'
import { normalizeProgrammeName } from '../_shared/content-planning/service-period-detector.ts'

// @ts-ignore - Deno global
declare const Deno: any

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const FETCH_TIMEOUT_MS = 12_000
const MAX_HTML_BYTES = 1_200_000
const MAX_EDGE_LLM_CHARS = 60_000
const MAX_PDF_BYTES = 5_000_000 // 5 MB — fast path PDFs only; larger files fall back to Cloud Run

function _stripContentType(ct: string | null): string {
  if (!ct) return ''
  return ct.split(';')[0]?.trim().toLowerCase() || ''
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  // Safe enough here because we only encode small payloads (JWT header/body/signature).
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlEncodeJson(obj: unknown): string {
  const json = JSON.stringify(obj)
  return base64UrlEncodeBytes(new TextEncoder().encode(json))
}

function pemToPkcs8Bytes(pem: string): Uint8Array {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '')
  return base64ToBytes(cleaned)
}

async function signJwtRs256(privateKeyPem: string, payload: Record<string, unknown>): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' }
  const encHeader = base64UrlEncodeJson(header)
  const encPayload = base64UrlEncodeJson(payload)
  const signingInput = `${encHeader}.${encPayload}`

  const keyBytes = pemToPkcs8Bytes(privateKeyPem)
  const keyBuf = new Uint8Array(keyBytes).buffer
  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyBuf,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const sig = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(signingInput)
  )
  const encSig = base64UrlEncodeBytes(new Uint8Array(sig))
  return `${signingInput}.${encSig}`
}

async function mintGoogleIdToken(params: {
  serviceAccountJson: string
  audience: string
}): Promise<string> {
  const raw = params.serviceAccountJson.trim()
  const jsonText = raw.startsWith('{')
    ? raw
    : new TextDecoder().decode(base64ToBytes(raw))

  const sa = JSON.parse(jsonText)
  const clientEmail = String(sa.client_email || '')
  const privateKey = String(sa.private_key || '')
  if (!clientEmail || !privateKey) throw new Error('Invalid service account JSON (missing client_email/private_key)')

  const now = Math.floor(Date.now() / 1000)
  const assertion = await signJwtRs256(privateKey, {
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 60 * 60,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
  })

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  })
  if (!tokenResp.ok) {
    throw new Error(`Google token exchange failed: ${tokenResp.status}`)
  }

  const tokenJson = await tokenResp.json().catch(() => ({}))
  const accessToken = String((tokenJson as any).access_token || '')
  if (!accessToken) throw new Error('Google token exchange returned no access_token')

  const iamResp = await fetch(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(clientEmail)}:generateIdToken`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        audience: params.audience,
        includeEmail: true,
      }),
    }
  )
  if (!iamResp.ok) {
    throw new Error(`generateIdToken failed: ${iamResp.status}`)
  }
  const iamJson = await iamResp.json().catch(() => ({}))
  const idToken = String((iamJson as any).token || '')
  if (!idToken) throw new Error('generateIdToken returned no token')
  return idToken
}

async function readAtMostBytes(resp: Response, maxBytes: number): Promise<Uint8Array> {
  const reader = resp.body?.getReader()
  if (!reader) return new Uint8Array(await resp.arrayBuffer())

  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    if (!value) continue

    const remaining = maxBytes - total
    if (remaining <= 0) break

    if (value.byteLength > remaining) {
      chunks.push(value.subarray(0, remaining))
      total += remaining
      break
    }

    chunks.push(value)
    total += value.byteLength
    if (total >= maxBytes) break
  }

  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

function looksLikePdf(bytes: Uint8Array): boolean {
  if (!bytes || bytes.length < 4) return false
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 // %PDF
}

function looksLikeImage(bytes: Uint8Array): boolean {
  if (!bytes || bytes.length < 3) return false

  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (isJpeg) return true

  if (bytes.length >= 8) {
    const isPng =
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    if (isPng) return true
  }

  if (bytes.length >= 6) {
    const header = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5])
    if (header === 'GIF87a' || header === 'GIF89a') return true
  }

  if (bytes.length >= 12) {
    const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])
    const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])
    if (riff === 'RIFF' && webp === 'WEBP') return true
  }

  return false
}

/**
 * Extract text from image using Google Cloud Vision API
 */
async function extractTextFromImageWithVision(imageBytes: Uint8Array): Promise<string> {
  const visionApiKey = Deno.env.get('GOOGLE_VISION_API_KEY')
  if (!visionApiKey) {
    throw new Error('GOOGLE_VISION_API_KEY environment variable not set')
  }

  // Parse service account JSON
  let serviceAccountJson: any
  try {
    const raw = visionApiKey.trim()
    const jsonText = raw.startsWith('{') ? raw : new TextDecoder().decode(base64ToBytes(raw))
    serviceAccountJson = JSON.parse(jsonText)
  } catch (err) {
    throw new Error(`Failed to parse GOOGLE_VISION_API_KEY: ${err}`)
  }

  const projectId = serviceAccountJson.project_id
  if (!projectId) {
    throw new Error('Service account JSON missing project_id')
  }

  // Get OAuth2 access token for Vision API
  const clientEmail = String(serviceAccountJson.client_email || '')
  const privateKey = String(serviceAccountJson.private_key || '')
  if (!clientEmail || !privateKey) {
    throw new Error('Invalid service account JSON (missing client_email/private_key)')
  }

  const now = Math.floor(Date.now() / 1000)
  const assertion = await signJwtRs256(privateKey, {
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 60 * 60,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
  })

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  })

  if (!tokenResp.ok) {
    const errorText = await tokenResp.text()
    throw new Error(`Google token exchange failed: ${tokenResp.status} ${errorText}`)
  }

  const tokenJson = await tokenResp.json()
  const accessToken = String((tokenJson as any).access_token || '')
  if (!accessToken) {
    throw new Error('Google token exchange returned no access_token')
  }

  // Convert image bytes to base64
  const base64Image = bytesToBase64(imageBytes)

  // Call Vision API for text detection
  const visionResp = await fetch(
    `https://vision.googleapis.com/v1/images:annotate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: base64Image,
            },
            features: [
              {
                type: 'DOCUMENT_TEXT_DETECTION',
                maxResults: 1,
              },
            ],
          },
        ],
      }),
    }
  )

  if (!visionResp.ok) {
    const errorText = await visionResp.text()
    throw new Error(`Vision API request failed: ${visionResp.status} ${errorText}`)
  }

  const visionJson = await visionResp.json()
  const responses = visionJson.responses || []
  if (responses.length === 0) {
    throw new Error('Vision API returned no responses')
  }

  const textAnnotation = responses[0].fullTextAnnotation
  if (!textAnnotation || !textAnnotation.text) {
    throw new Error('No text found in image')
  }

  console.log(`✅ Vision API extracted ${textAnnotation.text.length} characters from image`)
  return textAnnotation.text
}

/**
 * Classify establishment type based on menu structure
 * FSE = Full-Service Establishment (restaurants with meal courses)
 * SBO = Specialized Beverage Outlet (cafes, coffee shops, bars)
 */
function classifyEstablishmentType(menuStructure: any): 'FSE' | 'SBO' | null {
  if (!menuStructure?.categories || menuStructure.categories.length === 0) {
    return null
  }

  const categories = menuStructure.categories
  const categoryNames = categories.map((c: any) => (c.name || '').toLowerCase()).join(' ')
  
  let fseScore = 0
  let sboScore = 0

  // FSE indicators (restaurants)
  const fseKeywords = ['appetizer', 'starter', 'forretter', 'main', 'hovedret', 'mains', 'dessert', 'desserter']
  for (const keyword of fseKeywords) {
    if (categoryNames.includes(keyword)) fseScore += 3
  }

  // SBO indicators (cafes, coffee shops)
  const sboKeywords = ['cocktail', 'kaffe', 'coffee', 'espresso', 'drinks', 'bar', 'øl', 'beer', 'wine', 'vin']
  for (const keyword of sboKeywords) {
    if (categoryNames.includes(keyword)) sboScore += 3
  }

  // Beverage-heavy menu suggests SBO
  const beverageCategories = categories.filter((c: any) => {
    const name = (c.name || '').toLowerCase()
    return name.includes('drink') || name.includes('coffee') || name.includes('kaffe') || 
           name.includes('cocktail') || name.includes('beer') || name.includes('øl') ||
           name.includes('wine') || name.includes('vin')
  })
  if (beverageCategories.length > categories.length * 0.5) {
    sboScore += 3
  }

  console.log('🏢 Establishment classification - FSE:', fseScore, 'SBO:', sboScore)

  if (fseScore === 0 && sboScore === 0) return null
  if (fseScore > sboScore) {
    console.log('✅ Classified as FSE (Full-Service Establishment)')
    return 'FSE'
  } else if (sboScore > fseScore) {
    console.log('✅ Classified as SBO (Specialized Beverage Outlet)')
    return 'SBO'
  }
  return null
}

/**
 * Extract menu items from JavaScript gallery widgets (e.g., WordPress filter plugins)
 * These widgets render items as links with href="javascrpit:void(0)" and often duplicate
 * names with image references (wPT_Dish Name vs Dish Name). This pre-processor extracts
 * clean item lists before the generic HTML-to-text conversion muddies the signal.
 */
function extractJsGalleryMenuItems(html: string): string | null {
  // Detect wPT_ pattern (common in WordPress gallery/filter plugins) or javascript:void links
  if (!html.includes('wPT_') && !html.includes('javascript:void(0)')) return null

  const seenItems = new Set<string>()
  const seenCats = new Set<string>()
  const lines: string[] = []
  
  // Extract filter category labels (these become section headers)
  // They appear as button/tab text before the item grids, often in elements with "filter" class
  const categoryPattern = /class="[^"]*filter[^"]*"[^>]*>([^<]+)</gi
  let catMatch
  while ((catMatch = categoryPattern.exec(html)) !== null) {
    const cat = catMatch[1].trim()
    if (cat && cat !== 'All' && cat !== 'all' && cat.length > 1 && cat.length < 50 && !seenCats.has(cat)) {
      seenCats.add(cat)
    }
  }

  // Strategy 1: Extract from image alt attributes (common WordPress gallery pattern)
  // Images have alt="wPT_Dish Name" which we can extract and clean
  const imgAltPattern = /<img[^>]+alt=["']wPT_([^"']+)["'][^>]*>/gi
  let match
  while ((match = imgAltPattern.exec(html)) !== null) {
    const name = match[1].trim().replace(/-/g, ' ') // Convert "Tempura-rejer" to "Tempura rejer"
    if (name.length > 1 && name.length < 150 && !seenItems.has(name) && !seenCats.has(name)) {
      seenItems.add(name)
      lines.push(`- ${name}`)
    }
  }
  
  // Strategy 2: Extract from links - handles both javascript:void(0) and real URLs
  // Look for duplicate link patterns (wPT_Name + Name pointing to same URL)
  const linkPattern = /<a\s+[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/gi
  const urlToNames = new Map<string, string[]>()
  
  while ((match = linkPattern.exec(html)) !== null) {
    const url = match[1]
    const name = match[2].trim()
    
    // Skip navigation links, social media, etc.
    if (name.length < 2 || name.length > 150) continue
    if (name.startsWith('wPT_')) continue
    if (/^(all|menu|om os|kontakt|book bord|reservér bord|reserver bord|se menu|allergener|facebook|instagram|tiktok|home|info|åbningstider|fødevarekontrol|videre til indhold|k-bbq silkeborg)$/i.test(name)) continue
    
    // Only consider links pointing to potential menu item URLs (contain product/dish path segments)
    if (!url || url === '#' || url.startsWith('mailto:') || url.startsWith('tel:')) continue
    if (!url.includes('/')) continue // Must have path
    
    // Track names pointing to same URL
    if (!urlToNames.has(url)) urlToNames.set(url, [])
    urlToNames.get(url)!.push(name)
  }
  
  // Extract items where we found duplicate links to same URL (gallery widget signature)
  for (const [url, names] of urlToNames.entries()) {
    // If URL has multiple names pointing to it, extract the clean one
    if (names.length >= 2) {
      const cleanName = names.find(n => !n.startsWith('wPT_')) || names[0]
      if (!seenItems.has(cleanName) && !seenCats.has(cleanName)) {
        seenItems.add(cleanName)
        lines.push(`- ${cleanName}`)
      }
    } else if (names.length === 1) {
      // Single link - only include if URL looks like menu item path
      const name = names[0]
      if ((url.includes('/menu/') || url.includes('/dish') || url.includes('/sushi') || url.includes('/bbq') || url.includes('koreanan')) &&
          !seenItems.has(name) && !seenCats.has(name)) {
        seenItems.add(name)
        lines.push(`- ${name}`)
      }
    }
  }

  if (lines.length === 0) return null
  
  const catList = seenCats.size > 0 ? `\n\nDETECTED CATEGORIES: ${Array.from(seenCats).join(', ')}` : ''
  return `JS GALLERY MENU ITEMS (extracted from filter widget):\n${lines.join('\n')}${catList}\n\n`
}

function htmlToText(html: string): string {
  // Preserve some structure before stripping tags.
  let s = html
  s = s.replace(/<\s*br\s*\/?\s*>/gi, '\n')
  s = s.replace(/<\s*li\b[^>]*>/gi, '- ')
  s = s.replace(/<\/(p|div|li|tr|h[1-6])\s*>/gi, '\n')
  s = s.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
  s = s.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
  s = s.replace(/<[^>]+>/g, ' ')
  s = s.replace(/&nbsp;/gi, ' ')
  s = s.replace(/&amp;/gi, '&')
  s = s.replace(/&quot;/gi, '"')
  s = s.replace(/&#39;/gi, "'")
  s = s.replace(/[ \t\f\v]+/g, ' ')
  s = s.replace(/\n{3,}/g, '\n\n')
  return s.trim()
}

function cleanHtmlTextForLlm(text: string, maxChars: number): string {
  if (!text) return ''
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  const priceRe = /(\b\d{1,4}\s*(?:[\.,]\d{1,2})?\s*(?:kr\b|kroner\b|dkk\b)\b|\b\d{1,4}\s*[-–—]?\s*[\.,]-(?=\s|$)|\b\d{1,4}\s*[\.,]-(?=\s|$))/i
  const keepAlways = (ln: string) => ln.startsWith('-') || priceRe.test(ln)
  const dropRe = /(cookie|privacy|privatliv|persondata|gdpr|terms|vilkår|scroll to top|facebook|instagram|tiktok|youtube|newsletter|copyright|all rights reserved)/i

  const cleaned: string[] = []
  for (const ln of lines) {
    if (keepAlways(ln)) {
      cleaned.push(ln)
      continue
    }
    if (dropRe.test(ln)) continue
    if (ln.length <= 2) continue
    cleaned.push(ln)
  }

  const finalLines = cleaned.length < 20 ? lines : cleaned
  const seen = new Map<string, number>()
  const outLines: string[] = []
  for (const ln of finalLines) {
    const key = ln.toLowerCase()
    const count = seen.get(key) ?? 0
    
    // Category/section headers (short ALL-CAPS lines) may legitimately appear in both
    // site navigation and in the menu content body. Allow up to 2 occurrences so the
    // actual section header is never silently dropped.
    const isLikelyHeader = ln.length <= 40 && ln === ln.toUpperCase() && /[A-ZÆØÅ]/.test(ln)
    
    // Price-only lines (e.g. "125,-", "95 kr", "109 DKK") are contextually unique —
    // each occurrence belongs to the item immediately above it. Deduplicating them
    // would silently drop prices for items that share the same price value. Never cap them.
    const isPriceOnly = priceRe.test(ln) && ln.replace(priceRe, '').trim() === ''
    
    // Navigation noise - common site elements that appear in menus but aren't food
    const isNavNoise = /^(all|menu|om os|kontakt|book bord|reservér bord|reserver bord|videre til indhold|søndergade|cvr|allergener|se menu|åbningstider|fødevarekontrol)$/i.test(ln)
    
    // Dish names (short text, 2-120 chars, mixed case, looks like food) appear multiple times
    // in JavaScript gallery widgets across different filter tabs. NEVER deduplicate these —
    // the gallery widget legitimately renders "Tempura rejer" once under "All", once under
    // "Korean BBQ", once under each subcategory tab. Let the LLM see all occurrences and
    // deduplicate intelligently during JSON extraction. 120 char limit accommodates long
    // Danish dish names with qualifiers (e.g., "Langtidsstegt oksebryst med grillede rodfrugter").
    const isLikelyDishName = !isLikelyHeader && !isPriceOnly && !isNavNoise && ln.length <= 120
    
    const maxOccurrences = isPriceOnly ? 999 : isLikelyHeader ? 2 : isNavNoise ? 1 : isLikelyDishName ? 999 : 1
    
    if (count >= maxOccurrences) continue
    seen.set(key, count + 1)
    outLines.push(ln)
  }

  const out = outLines.join('\n')
  return out.length > maxChars ? out.slice(0, maxChars) : out
}

/**
 * DEPRECATED: No longer used for HTML extraction decision logic
 * We now always try Edge extraction for HTML pages instead of pre-filtering
 * Kept for reference - may be useful for future optimizations
 */
function hasMenuSignal(text: string): boolean {
  if (!text) return false
  const lower = text.toLowerCase()
  const keywords = [
    'menu', 'menukort', 'a la carte', 'à la carte', 'forret', 'hovedret', 'dessert',
    'drikke', 'cocktail', 'vin', 'øl', 'snacks', 'frokost', 'middag', 'brunch',
    'retter', 'tilbehør', 'sides', 'burger', 'salat', 'pasta', 'pizza', 'sandwich',
    'morgenmad', 'kaffe', 'te', 'smoothie', 'juice',
  ]
  const keywordHits = keywords.reduce((acc, k) => acc + (lower.includes(k) ? 1 : 0), 0)
  const priceHits = (text.match(/(\b\d{1,4}\s*(?:[\.,]\d{1,2})?\s*(?:kr|kroner|dkk)\b|\b\d{1,4}\s*[\.,]-\b)/gi) || []).length
  
  // More lenient: accept shorter text OR fewer price hits to process more menus on Edge
  const hasEnoughText = text.length >= 1000 // Reduced from 2500
  const hasStrongSignal = (priceHits >= 2 || keywordHits >= 2) // Reduced price requirement from 3 to 2

  return hasEnoughText && hasStrongSignal
}

async function triggerMenuWorkerOnce(): Promise<void> {
  // When Cloud Scheduler is configured to call Cloud Run with OIDC, we don't
  // need to trigger the worker from Edge on every enqueue. This avoids
  // unnecessary latency + 403 noise in orgs that block unauthenticated invocations.
  const triggerOnEnqueue = (Deno.env.get('MENU_OCR_WORKER_TRIGGER_ON_ENQUEUE') ?? '').trim().toLowerCase()
  const triggerEnabled = triggerOnEnqueue === '1' || triggerOnEnqueue === 'true' || triggerOnEnqueue === 'yes'
  if (!triggerEnabled) return

  const baseUrl = (Deno.env.get('MENU_OCR_WORKER_URL') ?? '').trim()
  if (!baseUrl) return

  const token = (Deno.env.get('MENU_OCR_WORKER_TOKEN') ?? '').trim()
  const saJsonOrB64 = (Deno.env.get('MENU_OCR_WORKER_GCP_SA_JSON') ?? '').trim()
  const audience = (Deno.env.get('MENU_OCR_WORKER_GCP_AUDIENCE') ?? baseUrl).trim().replace(/\/$/, '')
  const url = `${baseUrl.replace(/\/$/, '')}/run-once`

  const headers: Record<string, string> = {}
  if (token) headers['x-worker-token'] = token

  // Cloud Run in many orgs forbids unauthenticated invocations (allUsers). If a
  // service-account key is provided, mint an ID token and call authenticated.
  if (saJsonOrB64) {
    try {
      const idToken = await mintGoogleIdToken({
        serviceAccountJson: saJsonOrB64,
        audience,
      })
      headers['Authorization'] = `Bearer ${idToken}`
    } catch (e) {
      console.warn('⚠️ Failed to mint Google ID token for worker trigger:', e)
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 4500)
  try {
    await fetch(url, {
      method: 'POST',
      headers,
      signal: controller.signal,
    })
  } catch (e) {
    console.warn('⚠️ Failed to trigger worker /run-once:', e)
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Resolve when a menu is served using a strict priority chain.
 *
 * Priority:
 * 1. Times parsed directly from menu text (structured.startTime / endTime)
 * 1.5. Parse menuSubtitle for timing phrases (e.g. "Serveres til kl. 14.00")
 * 2. Times parsed from structured.availabilityTime string
 * 3. Business opening hours — used when menu has no timing signal at all
 * 4. null / null — only if opening hours are also missing
 *
 * Sentinel detection: If extracted times are wildly outside business hours (>1hr), treat as false.
 */
function resolveMenuTiming(
  structured: any,
  businessHours: { open: string; close: string } | undefined,
): { timeStart: string | null; timeEnd: string | null; timeSource: string } {
  // Import helper from menuPeriodParser - timeToMinutes is already available from import
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
  }

  // Parse time range helper (basic version - menuPeriodParser has more robust one)
  const parseTimeRange = (text: string): { start: string; end: string } | null => {
    // Match patterns like "11:00-15:00", "kl. 12-16", "til kl. 14.00"
    const untilMatch = text.match(/til\s+kl\.?\s*(\d{1,2})[.:,]?(\d{2})?/i)
    if (untilMatch) {
      const hour = untilMatch[1].padStart(2, '0')
      const min = untilMatch[2] || '00'
      return { start: '09:00', end: `${hour}:${min}` }
    }

    const rangeMatch = text.match(/(\d{1,2})[.:,](\d{2})?\s*[-–]\s*(\d{1,2})[.:,](\d{2})?/)
    if (rangeMatch) {
      const startHour = rangeMatch[1].padStart(2, '0')
      const startMin = rangeMatch[2] || '00'
      const endHour = rangeMatch[3].padStart(2, '0')
      const endMin = rangeMatch[4] || '00'
      return { start: `${startHour}:${startMin}`, end: `${endHour}:${endMin}` }
    }

    return null
  }

  // --- Priority 1: Direct extracted times from menu text ---
  let start: string | null = structured.startTime ?? null
  let end: string | null   = structured.endTime   ?? null

  // Reject sentinel PAIR + validate against business hours
  if (start === '00:00' && end === '23:59') {
    start = null
    end   = null
  } else if (businessHours && start && end) {
    // Sentinel detection: if extracted times are wildly outside opening hours, treat as false
    const outsideHours = (
      timeToMinutes(start) < timeToMinutes(businessHours.open) - 60 ||  // More than 1hr before
      timeToMinutes(end)   > timeToMinutes(businessHours.close) + 60    // More than 1hr after
    )
    if (outsideHours) {
      console.log(`⚠️ Extracted ${start}-${end} outside business hours ${businessHours.open}-${businessHours.close} → treating as sentinel`)
      start = null
      end   = null
    }
  }

  // --- Priority 1.5: Parse menuSubtitle (handles "Serveres til kl. 14.00") ---
  if ((!start || !end) && structured.menuSubtitle) {
    const parsed = parseTimeRange(structured.menuSubtitle)
    if (parsed) {
      start = start ?? parsed.start ?? null
      end   = end   ?? parsed.end   ?? null
    }
  }

  // --- Priority 2: Parse availabilityTime string ---
  if ((!start || !end) && structured.availabilityTime) {
    const parsed = parseTimeRange(structured.availabilityTime)
    if (parsed) {
      start = start ?? parsed.start ?? null
      end   = end   ?? parsed.end   ?? null
    }
  }

  // We have extracted timing from menu text
  if (start || end) {
    // Fill missing bound from opening hours
    if (!start && businessHours) start = businessHours.open
    if (!end   && businessHours) end   = businessHours.close
    
    return { timeStart: start, timeEnd: end, timeSource: 'menu_text' }
  }

  // --- Priority 3: No timing in menu → opening hours ARE the answer (coffee, wine, bakery) ---
  if (businessHours) {
    return {
      timeStart: businessHours.open,
      timeEnd:   businessHours.close,
      timeSource: 'opening_hours_fallback',
    }
  }

  // --- Priority 4: Nothing available ---
  return { timeStart: null, timeEnd: null, timeSource: 'menu_text' }
}

async function parseMenuWithOpenAI(extractedText: string, languageCode: string): Promise<any> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) throw new Error('OPENAI_API_KEY environment variable not set')

  const lang = (languageCode || 'da').toLowerCase().startsWith('da') ? 'DANISH' : 'the page language'

  const prompt = `You are parsing a restaurant menu. The menu is in ${lang}.

CRITICAL RULES:
1) **EXTRACT MENU TITLE** - Look for the main menu heading (e.g., "Frokost Menu", "Brunch Menu", "Aften Menu"). Set as "menuTitle".
2) **EXTRACT MENU SUBTITLE/DESCRIPTION** - Look for any subtitle or description text under the menu title (e.g., "Friske råvarer dagligt", "Klassiske retter"). Set as "menuSubtitle".
3) **EXTRACT AVAILABILITY TIME** - Look for time ranges like "11:00-15:00", "Serveres kl. 12-16", "Tilgængelig 10:00-14:00". Set as "availabilityTime".
4) **EXTRACT AVAILABILITY DAYS** - Look for day-specific information (e.g., "Mandag-Fredag", "Kun weekender", "Dagligt"). Set as "availabilityDays".
5) **DETECT ALL CATEGORY HEADERS** - Look for section titles like: FORRETTER, HOVEDRETTER, DESSERTER, BURGERE, SALATER, PASTA, BØRNEMENU, KLASSIKERE, etc.
6) **Each category can have a timeRange** - If a category has specific hours (e.g., "FROKOST 11-15"), extract the time as "timeRange".
7) **Each category can have a description** - Text below the category header describing the section. Set as "categoryDescription".
8) **Each category is a separate section** - Do not lump all items into one category.
9) ONLY extract items explicitly written. Do not invent.
10) Preserve original dish names (æ, ø, å).
11) **ALWAYS include full descriptions** - Text between dish name and price is the description.

JAVASCRIPT GALLERY WIDGETS - SPECIAL EXTRACTION:
- Some menus use JavaScript-rendered filterable gallery widgets for menu items
- Dish names appear as link text, often with href="javascript:void(0)" or misspelled "javascrpit:void(0)"
- **EXTRACT ALL LINK TEXT** as menu items, even if they appear in unconventional markup
- Look for filter tab labels or section headings to group items (e.g., "Korean BBQ", "Sushi", "Drikkevarer", "Hosomaki", "Nigiri")
- **DEDUPLICATE** - gallery widgets often render each item twice (thumbnail view + list view)
- If you see repeated dish names, include each unique dish ONLY ONCE
- Group items by their nearest preceding heading or category marker
12) **Capture ALL prices AND currency** - Danish formats: 95,- | 95 kr | 95,00 kr | 95 DKK
    - Extract numeric price (e.g., "95", "95.00", "12.5")
    - Detect currency: kr/DKK = "DKK", € = "EUR", $ = "USD", £ = "GBP", etc.
    - If currency is implied (e.g., "95,-" in Denmark), set to "DKK"
13) **Multi-line items**: Name → Description → Price = ONE item
14) **Extras/Add-ons**: Lines like "Ekstra X +20,-" or "Tilvalg Y +15,-" are separate items
15) **Kids menu**: "BØRNEMENU" or similar = always its own top-level category. Even if it appears as a single line item inside another section, hoist it out as its own category. Item names containing "børnemenu", "børnemad", "kids menu", "children" should trigger this.
16) **Day-restricted sections**: If a category header is followed by text like "fra onsdag til lørdag", "kun weekender", "mandag-fredag", "hverdage" etc., capture that in the category's "availabilityDays" field. Examples: "TAPAS / FRA ONSDAG TIL LØRDAG" → availabilityDays: "onsdag-lørdag". "FROKOST (hverdage)" → availabilityDays: "mandag-fredag".
17) **Fixed-price packages**: Lines like "3 RETTERS MENU 395,-", "VINMENU 3 glas 150,-", "AD LIBITUM øl, vin og vand 2 timer 295,-" are menu packages/deals. Create a category called "PAKKER" (or "FAST MENU" if that label is present) and capture each package as an item with its price.
18) **PRICE ALWAYS BELONGS TO THE ITEM ABOVE IT** - A line containing ONLY a number with ",-", "kr" or "DKK" (e.g. "125,-", "109 DKK", "189 kr") is ALWAYS the price of the immediately preceding item. It is NEVER the start of a new item. Even if there is a blank line between the item description and the price, the price still belongs to that item.
19) **Items without a visible price** - If an item has no price line following it before the next item name or category header begins, set price to null. Do NOT borrow a price from a neighbouring item.
20) **TAPAS section with component list + single price** - A TAPAS section (or similar sharing board) may list many individual ingredients as bullet points, followed by a single price for the entire board. In that case, create ONE item named "TAPAS" (or the section name) with a description listing all components and the single board price.
21) **Variant items (UDEN/MED, WITH/WITHOUT)** - Lines like "UDEN KYLLING" or "MED KYLLING" following a dish description are separate price variants of the same dish. Create separate items for each variant, each with its own price from the line immediately following it.
22) **AD LIBITUM PRICING TIERS** - When a category name is "FROKOST K-BBQ & SUSHI AD LIBITUM", "AFTEN K-BBQ & SUSHI AD LIBITUM", or similar, and the items below it are just price variants by day/time (Man. – Tors. / Fre – Søn og Helligdage), create separate items for EACH day variant:
    - Item name: "Man. – Tors." (or the exact day text), price: "198", currency: "DKK"
    - Item name: "Fre – Søn og Helligdage", price: "208", currency: "DKK"
    - Do NOT repeat the category name as the item name
    - Do NOT create a single item with the category name - split by day/time variants
23) **ITEMS WITHOUT INDIVIDUAL PRICES** - When you encounter flat lists of dish or drink names under a section header with NO individual prices, extract EACH name as a separate item with price: null. Do NOT collapse them into a single combined item or omit them — they are real menu items whose price is set at the category or concept level (buffet, set menu, fixed-price, shared board, etc.). Filter/tab UI labels that appear immediately before item lists (e.g. subcategory names like "Hosomaki", "Uramaki", "Rød vin", "Hvid vin", "All") are structural navigation headers, not menu items — use them as category or subcategory context rather than extracting them as items. Within a single category, if the same item name appears more than once due to filter widget rendering, include it only once.
24) **AD LIBITUM / ALL-YOU-CAN-EAT MENUS** - Some restaurants use an "all you can eat" buffet model where:
    - Individual dishes have NO per-item prices (set price: null for all items)
    - Pricing appears as separate "package" or "time period" tiers (e.g., "FROKOST 198 kr", "AFTEN 238 kr", "AD LIBITUM MED DRIKKE 399 kr")
    - Extract the dish items normally under their category headings (KOREAN BBQ, SUSHI, DRIKKEVARER, etc.)
    - Extract the pricing tiers as separate items under a category called "PRISER" or "PAKKER" with tier name as item name and tier price as price
    - **BØRNE PRISER** (children's pricing) should be its own category with age-based pricing tiers as items

EXAMPLE INPUT:
"BRUNCH MENU
Friske råvarer fra markedet
Serveres dagligt 10:00-15:00

BURGERE
Vores signature burgere med pommes frites
FAUSTBURGER
med Angus hakkebøf, ost...
199 kr

HANGOVER BURGER
med 2 x Angus...
239 DKK

CONFITERET GRIS
Confiteret nakkefilet af gris, tomat kompot, syltede løg

TAPAS
FRA ONSDAG TIL LØRDAG / min. 2 pers.
Serrano skinke reserva
Oliven
Paté med cornichoner
Aioli
199,-

NACHOS / SNACKS
Sprøde majschips med salsa, guacamole, creme fraiche
UDEN KYLLING
125,-

MED KYLLING
149,-"

EXPECTED OUTPUT:
{
  "menuTitle": "BRUNCH MENU",
  "menuSubtitle": "Friske råvarer fra markedet",
  "availabilityTime": "10:00-15:00",
  "availabilityDays": "dagligt",
  "categories": [
    {
      "name": "BURGERE",
      "categoryDescription": "Vores signature burgere med pommes frites",
      "timeRange": null,
      "availabilityDays": null,
      "items": [
        {"name": "FAUSTBURGER", "description": "med Angus hakkebøf, ost...", "price": "199", "currency": "DKK"},
        {"name": "HANGOVER BURGER", "description": "med 2 x Angus...", "price": "239", "currency": "DKK"},
        {"name": "CONFITERET GRIS", "description": "Confiteret nakkefilet af gris, tomat kompot, syltede løg", "price": null, "currency": null}
      ]
    },
    {
      "name": "TAPAS",
      "categoryDescription": "FRA ONSDAG TIL LØRDAG / min. 2 pers.",
      "timeRange": null,
      "availabilityDays": "onsdag-lørdag",
      "items": [
        {"name": "TAPAS", "description": "Serrano skinke reserva, Oliven, Paté med cornichoner, Aioli", "price": "199", "currency": "DKK", "productSegment": "sharing_food"}
      ]
    },
    {
      "name": "NACHOS / SNACKS",
      "categoryDescription": "Sprøde majschips med salsa, guacamole, creme fraiche",
      "timeRange": null,
      "availabilityDays": null,
      "items": [
        {"name": "NACHOS UDEN KYLLING", "description": "Sprøde majschips med salsa, guacamole, creme fraiche", "price": "125", "currency": "DKK", "productSegment": "snacks"},
        {"name": "NACHOS MED KYLLING", "description": "Sprøde majschips med salsa, guacamole, creme fraiche", "price": "149", "currency": "DKK", "productSegment": "snacks"}
      ]
    }
  ]
}

LANGUAGE DETECTION (REQUIRED):
You MUST detect and return the primary language of the menu content:
- Analyze DESCRIPTIVE TEXT (descriptions, category names, instructions)
- IGNORE international dish names ("Club Sandwich", "Burger", "Moules Mariniers")
- Return ISO 639-1 code in "detected_language" field
- Examples:
  * "Serveret med pommes frites og aioli" → "da" (Danish words)
  * "Served with french fries and aioli" → "en" (English words)
  * "Dampede blåmuslinger" vs "Steamed mussels" → check descriptions!

MENU TYPE CLASSIFICATION (REQUIRED):
Classify what this menu primarily serves based on category names and content — NOT the business name.

Return one value in "menu_type":
- "coffee"     → Categories include: ESPRESSO, FILTER, LATTE, AMERICANO, COLD BREW, KAGE, TOAST, KAFFE
- "wine"       → Categories include: RØDVIN, HVIDVIN, ROSÉ, NATURVIN, VINLISTE, WINE LIST, GLAS, FLASKE
- "cocktail"   → Categories include: COCKTAILS, SIGNATURE DRINKS, CLASSICS, MOCKTAILS, SPIRITS, DRINKS
- "beer"       → Categories include: ØL, FADØL, FLASKEØL, CRAFT BEER, TAPROOM, BEER
- "bakery"     → Categories include: BRØD, WIENERBRØD, CROISSANT, KAGE, BAGERI (minimal hot food)
- "bar_snacks" → Primarily snacks/tapas that accompany drinks (no full meal structure)
- "drinks"     → Generic beverage menu not fitting the above (mixed drinks)
- "brunch"     → Categories include: BRUNCH, MORGENMAD, BREAKFAST, or availability window is morning
- "lunch"      → Categories include: FROKOST, SMØRREBRØD, LUNCH, or time signal is 11:00–17:00
- "dinner"     → Categories include: AFTENSMAD, AFTENMENU, DINNER, or time signal is from 17:00+
- "all_day"    → Single menu covering full opening hours, no meal-period distinction
- "other"      → Cannot determine from content

PRODUCT SEGMENT CLASSIFICATION (REQUIRED FOR EACH ITEM):
Classify each menu item into exactly ONE product segment based on its name, description, and category:
- "drinks" → All beverages: coffee, tea, wine, beer, cocktails, soft drinks, juices, etc.
- "snacks" → Small bites, appetizers, tapas (individual), chips, nuts, olives, bread baskets
- "main_meals" → Full meals, main courses, entrées, mains, burgers, pasta, steaks, fish dishes
- "sharing_food" → Platters, sharing boards, tapas boards, mixed grills, family-style dishes
- "desserts" → Desserts, sweets, cakes, ice cream, pastries
- "specials" → Chef specials, seasonal dishes, dagens ret, dagens tilbud, limited-time offers
- "takeaway_items" → Items explicitly marked as takeaway/to-go or in takeaway section
- "gifting_and_addons" → Gift cards, merchandise, extras (e.g., "ekstra bacon +20")

Return ONLY valid JSON in this schema:
{
  "detected_language": "da" | "en" | "de" | "fr" | "es",  ← REQUIRED FIELD
  "menu_type": "lunch" | "brunch" | "dinner" | "all_day" | "coffee" | "wine" | "cocktail" | "beer" | "bakery" | "bar_snacks" | "drinks" | "other",  ← REQUIRED FIELD
  "menuTitle": "string|null",
  "menuSubtitle": "string|null",
  "availabilityTime": "string|null",
  "availabilityDays": "string|null",
  "categories": [
    {
      "name": "string",
      "categoryDescription": "string|null",
      "timeRange": "string|null",
      "availabilityDays": "string|null",
      "items": [
        {
          "name": "string",
          "description": "string|null",
          "price": "string|null",
          "currency": "string|null",
          "productSegment": "drinks" | "snacks" | "main_meals" | "sharing_food" | "desserts" | "specials" | "takeaway_items" | "gifting_and_addons"  ← REQUIRED FIELD
        }
      ]
    }
  ]
}

If no menu title, subtitle, availability time/days, or category description is found, set them to null.
If no category-specific timeRange or availabilityDays is found, set to null.
If no currency is detected, attempt to infer from context (DKK for Denmark, EUR for Europe, etc.) or set to null.

Content to analyze:
${extractedText}`

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.0,
      max_tokens: 12000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a precise menu extraction expert. Return only valid JSON. If no clear menu is found, return {"categories": []}.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}))
    console.error('❌ OpenAI API error:', resp.status, errorData)
    throw new Error(`OpenAI API failed: ${resp.status}`)
  }

  const data = await resp.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI returned empty response')
  return JSON.parse(content)
}

/**
 * Upload a PDF to OpenAI Files API, then extract the menu via Chat Completions.
 * The file is deleted from OpenAI after parsing (fire-and-forget cleanup).
 * Throws if the upload fails, the API returns an error, or no categories are found.
 */
async function parsePdfMenuWithOpenAI(pdfBytes: Uint8Array, languageCode: string): Promise<any> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) throw new Error('OPENAI_API_KEY environment variable not set')

  // --- 1. Upload PDF to OpenAI Files API ---
  const formData = new FormData()
  formData.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), 'menu.pdf')
  formData.append('purpose', 'user_data')

  const uploadResp = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
  })

  if (!uploadResp.ok) {
    const errorData = await uploadResp.json().catch(() => ({}))
    console.error('❌ OpenAI Files API upload error:', uploadResp.status, errorData)
    throw new Error(`OpenAI file upload failed: ${uploadResp.status}`)
  }

  const uploadData = await uploadResp.json()
  const fileId: string = uploadData.id
  if (!fileId) throw new Error('OpenAI returned no file id after upload')
  console.log(`📤 Uploaded PDF to OpenAI Files API: ${fileId}`)

  // --- 2. Call Chat Completions with the file reference ---
  const lang = (languageCode || 'da').toLowerCase().startsWith('da') ? 'DANISH' : 'the document language'

  const instructionText = `You are parsing a restaurant menu PDF. The menu is in ${lang}.

CRITICAL RULES:
1) EXTRACT MENU TITLE - Look for the main menu heading. Set as "menuTitle".
2) EXTRACT MENU SUBTITLE/DESCRIPTION - Text under the title. Set as "menuSubtitle".
3) EXTRACT AVAILABILITY TIME - Time ranges like "11:00-15:00". Set as "availabilityTime".
4) EXTRACT AVAILABILITY DAYS - Day info like "Mandag-Fredag". Set as "availabilityDays".
5) DETECT ALL CATEGORY HEADERS - FORRETTER, HOVEDRETTER, DESSERTER, BURGERE, SALATER, etc.
6) Each category can have a "timeRange" if it specifies hours.
7) Each category can have a "categoryDescription".
8) ONLY extract items explicitly written. Do NOT invent.
9) Preserve original dish names (æ, ø, å).
10) ALWAYS include full descriptions.
11) Capture ALL prices AND currency. Danish: 95,- | 95 kr | 95 DKK → price "95", currency "DKK"
12) Multi-line items: Name → Description → Price = ONE item.
13) Extras/Add-ons (e.g. "Ekstra X +20,-") are separate items.
14) Kids menu: "BØRNEMENU", "børnemad", "kids menu", "children" = always a separate category. If it appears as a line item inside another section, still hoist it out as its own category.
15) Day-restricted sections: If a category header is followed by text like "fra onsdag til lørdag", "kun weekender", "mandag-fredag", "hverdage" etc., capture that in the category's "availabilityDays" field. Example: "TAPAS / FRA ONSDAG TIL LØRDAG" → availabilityDays: "onsdag-lørdag".
16) Fixed-price packages: Lines like "3 RETTERS MENU 395,-", "VINMENU 3 glas 150,-", "AD LIBITUM øl, vin og vand 2 timer 295,-" are menu packages. Create a category called "PAKKER" and capture each package as an item with its price.
17) PRICE ALWAYS BELONGS TO THE ITEM ABOVE IT - A line containing ONLY a number with ",-", "kr" or "DKK" is ALWAYS the price of the immediately preceding item. Even if there is a blank line between description and price, the price still belongs to that item.
18) Items without a visible price - If no price line follows before the next item name or category header, set price to null.
19) TAPAS section with component list + single price - A TAPAS section may list many individual ingredients followed by a single price for the entire board. Create ONE item with a description listing all components and that single price.
20) Variant items (UDEN/MED) - Lines like "UDEN KYLLING" or "MED KYLLING" following a dish description are separate price variants. Create separate items for each variant with the price from the line immediately following.

MENU TYPE CLASSIFICATION (REQUIRED):
Classify what this menu primarily serves based on category names and content — NOT the business name.
Return one value in "menu_type": coffee | wine | cocktail | beer | bakery | bar_snacks | drinks | brunch | lunch | dinner | all_day | other

PRODUCT SEGMENT CLASSIFICATION (REQUIRED FOR EACH ITEM):
Classify each menu item into exactly ONE product segment based on its name, description, and category:
- "drinks" → All beverages: coffee, tea, wine, beer, cocktails, soft drinks, juices, etc.
- "snacks" → Small bites, appetizers, tapas (individual), chips, nuts, olives, bread baskets
- "main_meals" → Full meals, main courses, entrées, mains, burgers, pasta, steaks, fish dishes
- "sharing_food" → Platters, sharing boards, tapas boards, mixed grills, family-style dishes
- "desserts" → Desserts, sweets, cakes, ice cream, pastries
- "specials" → Chef specials, seasonal dishes, dagens ret, dagens tilbud, limited-time offers
- "takeaway_items" → Items explicitly marked as takeaway/to-go or in takeaway section
- "gifting_and_addons" → Gift cards, merchandise, extras (e.g., "ekstra bacon +20")

Return ONLY valid JSON in this schema:
{
  "menu_type": "lunch" | "brunch" | "dinner" | "all_day" | "coffee" | "wine" | "cocktail" | "beer" | "bakery" | "bar_snacks" | "drinks" | "other",
  "menuTitle": "string|null",
  "menuSubtitle": "string|null",
  "availabilityTime": "string|null",
  "availabilityDays": "string|null",
  "categories": [
    {
      "name": "string",
      "categoryDescription": "string|null",
      "timeRange": "string|null",
      "availabilityDays": "string|null",
      "items": [
        {
          "name": "string",
          "description": "string|null",
          "price": "string|null",
          "currency": "string|null",
          "productSegment": "drinks" | "snacks" | "main_meals" | "sharing_food" | "desserts" | "specials" | "takeaway_items" | "gifting_and_addons"  ← REQUIRED FIELD
        }
      ]
    }
  ]
}

If a field is not present in the PDF, set it to null.
If no categories can be found, return {"categories": []}.`

  let chatResp: Response
  try {
    chatResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 12000,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are a precise menu extraction expert. Return only valid JSON.',
          },
          {
            role: 'user',
            content: [
              { type: 'file', file: { file_id: fileId } },
              { type: 'text', text: instructionText },
            ],
          },
        ],
      }),
    })
  } finally {
    // --- 3. Clean up: delete file from OpenAI (fire-and-forget) ---
    fetch(`https://api.openai.com/v1/files/${fileId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${apiKey}` },
    }).catch((e) => console.warn('⚠️ Failed to delete OpenAI file:', e))
  }

  if (!chatResp!.ok) {
    const errorData = await chatResp!.json().catch(() => ({}))
    console.error('❌ OpenAI Chat API error (PDF):', chatResp!.status, errorData)
    throw new Error(`OpenAI Chat API failed: ${chatResp!.status}`)
  }

  const data = await chatResp!.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI returned empty response for PDF')

  const parsed = JSON.parse(content)

  // Require at least one category with at least one item — otherwise treat as unreadable.
  const totalItems = (parsed?.categories ?? []).reduce(
    (sum: number, cat: any) => sum + (cat?.items?.length ?? 0),
    0,
  )
  if (totalItems === 0) throw new Error('PDF fast-path: no menu items found in PDF')

  return parsed
}

/**
 * Parse PDF menu using Docling for extraction + OpenAI for structuring
 * Replaces parsePdfMenuWithOpenAI for better PDF extraction quality
 */
async function parsePdfMenuWithDocling(pdfUrl: string, languageCode: string): Promise<any> {
  const doclingUrl = Deno.env.get('DOCLING_SERVICE_URL')
  if (!doclingUrl) {
    console.warn('⚠️ DOCLING_SERVICE_URL not set, falling back to OpenAI direct parsing')
    throw new Error('Docling service URL not configured')
  }

  console.log(`🔧 Extracting PDF with Docling: ${pdfUrl}`)

  // Step 1: Call Docling service to extract text/markdown
  const doclingResp = await fetch(`${doclingUrl}/extract-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: pdfUrl }),
  })

  if (!doclingResp.ok) {
    const errorText = await doclingResp.text().catch(() => 'unknown error')
    console.error('❌ Docling extraction failed:', doclingResp.status, errorText)
    throw new Error(`Docling extraction failed: ${doclingResp.status}`)
  }

  const doclingData = await doclingResp.json()
  
  if (!doclingData.success || !doclingData.text) {
    console.error('❌ Docling returned no text:', doclingData)
    throw new Error(doclingData.error || 'Docling extraction returned no text')
  }

  const extractedText = doclingData.text
  const extractedMarkdown = doclingData.markdown || extractedText
  console.log(`✅ Docling extracted ${extractedText.length} characters from PDF`)

  // Step 2: Use OpenAI to structure the extracted text into menu format
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) throw new Error('OPENAI_API_KEY environment variable not set')

  const lang = (languageCode || 'da').toLowerCase().startsWith('da') ? 'DANISH' : 'the document language'

  const instructionText = `You are parsing a restaurant menu. The menu is in ${lang}.

The following text was extracted from a PDF menu:

${extractedText.slice(0, 40000)}

CRITICAL RULES:
1) EXTRACT MENU TITLE - Look for the main menu heading. Set as "menuTitle".
2) EXTRACT MENU SUBTITLE/DESCRIPTION - Text under the title. Set as "menuSubtitle".
3) EXTRACT AVAILABILITY TIME - Time ranges like "11:00-15:00". Set as "availabilityTime".
4) EXTRACT AVAILABILITY DAYS - Day info like "Mandag-Fredag". Set as "availabilityDays".
5) DETECT ALL CATEGORY HEADERS - FORRETTER, HOVEDRETTER, DESSERTER, BURGERE, SALATER, etc.
6) Each category can have a "timeRange" if it specifies hours.
7) Each category can have a "categoryDescription".
8) ONLY extract items explicitly written. Do NOT invent.
9) Preserve original dish names (æ, ø, å).
10) ALWAYS include full descriptions.
11) Capture ALL prices AND currency. Danish: 95,- | 95 kr | 95 DKK → price "95", currency "DKK"
12) Multi-line items: Name → Description → Price = ONE item.
13) Extras/Add-ons (e.g. "Ekstra X +20,-") are separate items.
14) Kids menu: "BØRNEMENU", "børnemad", "kids menu", "children" = always a separate category. If it appears as a line item inside another section, still hoist it out as its own category.
15) Day-restricted sections: If a category header is followed by text like "fra onsdag til lørdag", "kun weekender", "mandag-fredag", "hverdage" etc., capture that in the category's "availabilityDays" field. Example: "TAPAS / FRA ONSDAG TIL LØRDAG" → availabilityDays: "onsdag-lørdag".
16) Fixed-price packages: Lines like "3 RETTERS MENU 395,-", "VINMENU 3 glas 150,-", "AD LIBITUM øl, vin og vand 2 timer 295,-" are menu packages. Create a category called "PAKKER" and capture each package as an item with its price.
17) PRICE ALWAYS BELONGS TO THE ITEM ABOVE IT - A line containing ONLY a number with ",-", "kr" or "DKK" is ALWAYS the price of the immediately preceding item. Even if there is a blank line between description and price, the price still belongs to that item.
18) Items without a visible price - If no price line follows before the next item name or category header, set price to null.
19) TAPAS section with component list + single price - A TAPAS section may list many individual ingredients followed by a single price for the entire board. Create ONE item with a description listing all components and that single price.
20) Variant items (UDEN/MED) - Lines like "UDEN KYLLING" or "MED KYLLING" following a dish description are separate price variants. Create separate items for each variant with the price from the line immediately following.

MENU TYPE CLASSIFICATION (REQUIRED):
Classify what this menu primarily serves based on category names and content — NOT the business name.
Return one value in "menu_type": coffee | wine | cocktail | beer | bakery | bar_snacks | drinks | brunch | lunch | dinner | all_day | other

PRODUCT SEGMENT CLASSIFICATION (REQUIRED FOR EACH ITEM):
Classify each menu item into exactly ONE product segment based on its name, description, and category:
- "drinks" → All beverages: coffee, tea, wine, beer, cocktails, soft drinks, juices, etc.
- "snacks" → Small bites, appetizers, tapas (individual), chips, nuts, olives, bread baskets
- "main_meals" → Full meals, main courses, entrées, mains, burgers, pasta, steaks, fish dishes
- "sharing_food" → Platters, sharing boards, tapas boards, mixed grills, family-style dishes
- "desserts" → Desserts, sweets, cakes, ice cream, pastries
- "specials" → Chef specials, seasonal dishes, dagens ret, dagens tilbud, limited-time offers
- "takeaway_items" → Items explicitly marked as takeaway/to-go or in takeaway section
- "gifting_and_addons" → Gift cards, merchandise, extras (e.g., "ekstra bacon +20")

Return ONLY valid JSON in this schema:
{
  "menu_type": "lunch" | "brunch" | "dinner" | "all_day" | "coffee" | "wine" | "cocktail" | "beer" | "bakery" | "bar_snacks" | "drinks" | "other",
  "menuTitle": "string|null",
  "menuSubtitle": "string|null",
  "availabilityTime": "string|null",
  "availabilityDays": "string|null",
  "categories": [
    {
      "name": "string",
      "categoryDescription": "string|null",
      "timeRange": "string|null",
      "availabilityDays": "string|null",
      "items": [
        {
          "name": "string",
          "description": "string|null",
          "price": "string|null",
          "currency": "string|null",
          "productSegment": "drinks" | "snacks" | "main_meals" | "sharing_food" | "desserts" | "specials" | "takeaway_items" | "gifting_and_addons"
        }
      ]
    }
  ]
}

If a field is not present in the PDF, set it to null.
If no categories can be found, return {"categories": []}.`

  const chatResp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 12000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a precise menu extraction expert. Return only valid JSON.',
        },
        {
          role: 'user',
          content: instructionText,
        },
      ],
    }),
  })

  if (!chatResp.ok) {
    const errorData = await chatResp.json().catch(() => ({}))
    console.error('❌ OpenAI Chat API error (Docling):', chatResp.status, errorData)
    throw new Error(`OpenAI Chat API failed: ${chatResp.status}`)
  }

  const data = await chatResp.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI returned empty response for Docling-extracted text')

  const parsed = JSON.parse(content)

  // Require at least one category with at least one item
  const totalItems = (parsed?.categories ?? []).reduce(
    (sum: number, cat: any) => sum + (cat?.items?.length ?? 0),
    0,
  )
  if (totalItems === 0) throw new Error('Docling path: no menu items found in PDF')

  return parsed
}

function normalizeLanguageCode(input: unknown): string {
  if (typeof input !== 'string') return 'da'
  const trimmed = input.trim()
  if (!trimmed) return 'da'

  const low = trimmed.toLowerCase()
  if (low === 'da' || low.startsWith('da-')) return 'da'
  if (low === 'en' || low === 'en-us' || low === 'en_us') return 'en-US'
  return trimmed
}

/**
 * Fallback language detection based on URL patterns + keyword analysis
 * Used when AI doesn't return detected_language field
 */
function detectLanguageFromText(structured: any, sourceUrl?: string): string {
  // STRATEGY 1: Check URL path (strongest signal)
  if (sourceUrl) {
    if (sourceUrl.includes('/english-menu/') || sourceUrl.includes('/en/')) {
      console.log(`🔍 Language detected from URL: English (${sourceUrl})`)
      return 'en'
    }
    if (sourceUrl.includes('/da/') || sourceUrl.includes('/dansk/')) {
      console.log(`🔍 Language detected from URL: Danish (${sourceUrl})`)
      return 'da'
    }
  }
  
  // STRATEGY 2: Keyword analysis
  // Collect text from descriptions and category names
  const textSamples: string[] = []
  
  if (structured.menuTitle) textSamples.push(structured.menuTitle)
  if (structured.menuSubtitle) textSamples.push(structured.menuSubtitle)
  
  if (structured.categories && Array.isArray(structured.categories)) {
    structured.categories.forEach((cat: any) => {
      if (cat.name) textSamples.push(cat.name)
      if (cat.categoryDescription) textSamples.push(cat.categoryDescription)
      if (cat.items && Array.isArray(cat.items)) {
        cat.items.forEach((item: any) => {
          if (item.description) textSamples.push(item.description)
        })
      }
    })
  }
  
  const combinedText = textSamples.join(' ').toLowerCase()
  
  // Check for cocktail menu (international names are normal, doesn't indicate English)
  const isCocktailMenu = (structured.menuTitle || '').toLowerCase().includes('cocktail') ||
                         (structured.categories || []).some((cat: any) => 
                           (cat.name || '').toLowerCase().includes('cocktail'))
  
  // Danish patterns (focus on sentence structure, not single words)
  const danishPatterns = [
    'serveret med', 'serveres med', 'tilberedt med', ' og ', ' af ', ' på ',
    'hjemmelavet', 'grillet ', 'stegt ', 'kogt ', 'dampet ', 'ovnbagt'
  ]
  
  // English patterns (focus on sentence structure)
  const englishPatterns = [
    'served with', 'served in', ' with ', ' and ', 'fresh baked',
    'fried egg', 'scrambled egg', 'boiled potatoes', 'grilled lemon',
    'homemade ', 'topped with', 'garnished with'
  ]
  
  let danishScore = 0
  let englishScore = 0
  
  danishPatterns.forEach(pattern => {
    if (combinedText.includes(pattern)) danishScore++
  })
  
  englishPatterns.forEach(pattern => {
    if (combinedText.includes(pattern)) englishScore++
  })
  
  console.log(`🔍 Language pattern scores: Danish=${danishScore}, English=${englishScore}, isCocktailMenu=${isCocktailMenu}`)
  
  // If cocktail menu, default to Danish (international names don't mean English)
  if (isCocktailMenu && englishScore <= danishScore + 2) {
    console.log(`🔍 Detected cocktail menu with similar scores → defaulting to Danish`)
    return 'da'
  }
  
  // If English score is clearly higher, it's English
  if (englishScore > danishScore + 3) {
    console.log(`🔍 English patterns dominate → English`)
    return 'en'
  }
  
  // Default to Danish (Denmark-based business)
  console.log(`🔍 No clear signal → defaulting to Danish`)
  return 'da'
}

async function userHasBusinessAccess(
  supabaseAuthed: any,
  businessId: string,
  userId: string,
): Promise<boolean> {
  // Owners
  const { data: ownerRow, error: ownerError } = await supabaseAuthed
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .eq('owner_id', userId)
    .maybeSingle()

  if (ownerError) {
    console.error('❌ Failed to verify owner business access:', ownerError)
    throw new Error('Failed to verify business access')
  }
  if (ownerRow) return true

  // Accepted team members
  const { data: teamRow, error: teamError } = await supabaseAuthed
    .from('business_team_members')
    .select('id')
    .eq('business_id', businessId)
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
    .maybeSingle()

  if (teamError) {
    console.error('❌ Failed to verify team business access:', teamError)
    throw new Error('Failed to verify business access')
  }

  return Boolean(teamRow)
}

// ---------------------------------------------------------------------------
// generateMenuSummary — generates a 5-bullet helicopter summary via GPT-4o-mini
// Called once at extraction time; result stored in menu_results_v2.ai_summary
// ---------------------------------------------------------------------------
async function generateMenuSummary(
  structuredData: any,
  sourceUrl: string,
  languageCode: string,
): Promise<string | null> {
  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) return null

    const menuTitle =
      structuredData?.menuTitle ||
      sourceUrl.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') ||
      'Menu'

    const categories: any[] =
      structuredData?.categories || structuredData?.menuStructure || []
    if (categories.length === 0) return null

    const itemLines: string[] = []
    for (const cat of categories) {
      const catName: string = cat.name || 'Øvrigt'
      const items = ((cat.items || cat.dishes || []) as any[]).slice(0, 15)
      
      for (const item of items) {
        const name = item.name || item.title
        const desc = item.description
        if (name) {
          // Include description if available to show actual dishes
          if (desc && desc.trim().length > 0) {
            itemLines.push(`${name}: ${desc}`)
          } else {
            itemLines.push(name)
          }
        }
      }
    }
    if (itemLines.length === 0) return null

    const langWord =
      languageCode === 'da' ? 'dansk' :
      languageCode === 'en' ? 'engelsk' :
      languageCode

    const systemPrompt = languageCode === 'da'
      ? `Du er gastronomisk konsulent med indsigt i kulinariske trends og menupositionering.

OPGAVE: Beskriv menuens kulinariske karakter og identitet.

Identificer:
- Hvilke madkulturer eller stile kombineres?
- Hvilke signatur-elementer eller unikke tilbud?
- Traditionel eller moderne tilgang?

Illustrer ALTID med konkrete retnavne i parentes (ikke ingredienser).

GODT: "Dansk madkultur (smørrebrød, pariserbøf) møder café-retter (falafel, eggs benedict)"
DÅRLIGT: "Moderne brunch med klassiske elementer (bacon, avocado)"

REGLER:
- Faktuel analyse - ingen subjektive ord
- Konkrete retnavne (smørrebrød, eggs benedict) - IKKE ingredienser (bacon, avocado)
- Returner 3-5 naturlige observationer som bullet-liste med •
- Start DIREKTE med første bullet - ingen introduktion eller forklaring`
      : `You are a gastronomic consultant with insight into culinary trends and menu positioning.

TASK: Describe the menu's culinary character and identity.

Identify:
- Which food cultures or styles are combined?
- What signature elements or unique offerings?
- Traditional or modern approach?

ALWAYS illustrate with concrete dish names in parentheses (not ingredients).

GOOD: "Danish cuisine (smørrebrød, traditional mains) meets café dishes (falafel, eggs benedict)"
BAD: "Modern brunch with classic elements (bacon, avocado)"

RULES:
- Factual analysis - no subjective words
- Concrete dish names (smørrebrød, eggs benedict) - NOT ingredients (bacon, avocado)
- Return 3-5 natural observations as bullet list with •
- Start DIRECTLY with first bullet - no introduction or explanation`

    const userPrompt = languageCode === 'da'
      ? `Menu: "${menuTitle}"
${itemLines.join('\n')}

Beskriv kulinarisk karakter.`
      : `Menu: "${menuTitle}"
${itemLines.join('\n')}

Describe culinary character.`

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 400,
      }),
    })
    
    if (!resp.ok) {
      const errorText = await resp.text()
      console.error('GPT-4o API error:', resp.status, errorText)
      return null
    }
    
    const data = await resp.json()
    const text = data.choices?.[0]?.message?.content?.trim()
    return text || null
  } catch (err) {
    console.error('Menu summary generation error:', err)
    return null
  }
}

// selectRepresentativeDishes — selects 1-3 representative dishes via GPT-4o
// Called once at extraction time; result stored in menu_results_v2.representative_dishes
// Enhancement 2: Pre-select signature/main dishes for voice profile generation
// ---------------------------------------------------------------------------
async function selectRepresentativeDishes(
  structuredData: any,
  languageCode: string,
): Promise<any | null> {
  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) return null

    const categories: any[] =
      structuredData?.categories || structuredData?.menuStructure || []
    if (categories.length === 0) return null

    // Build item list with category context
    const itemsWithContext: Array<{name: string; description: string; category: string; price: string | null}> = []
    for (const cat of categories) {
      const catName: string = cat.name || 'Øvrigt'
      const items = (cat.items || cat.dishes || []) as any[]
      
      for (const item of items) {
        const name = item.name || item.title
        const desc = item.description || ''
        const price = item.price || null
        if (name && name.trim().length > 0) {
          itemsWithContext.push({
            name: name.trim(),
            description: desc.trim(),
            category: catName,
            price: price
          })
        }
      }
    }

    if (itemsWithContext.length === 0) return null

    const systemPrompt = languageCode === 'da'
      ? `Du er menukonsulent med ekspertise i gastronomisk positionering.

OPGAVE: Vælg 1-3 repræsentative retter fra denne menu.

PRIORITET (vælg i denne rækkefølge):
1. SIGNATUR-RETTER - Unikke, karakteristiske retter der definerer stedet
2. HOVEDRETTER - Main courses (IKKE tilbehør, drikkevarer, eller sides)
3. IDENTITETS-RETTER - Retter der viser menuens kulinariske karakter (fusion, klassisk, etc.)

REGLER:
- Vælg 1-3 retter (hellere færre gode end mange gennemsnitlige)
- UNDGÅ: Drikkevarer, tilbehør (pommes frites), børnemenu, pakker/deals
- Prioriter retter med gode beskrivelser
- Søg variation i kategori hvis muligt

RETURNER JSON:
{
  "dishes": [
    {
      "name": "Ret-navn (præcis som i menu)",
      "description": "Original beskrivelse fra menu",
      "category": "Kategori-navn",
      "price": 199,
      "currency": "DKK",
      "selection_reason": "signature" | "main_course" | "identity"
    }
  ]
}

Hvis ingen egnede retter findes, returner {"dishes": []}.`
      : `You are a menu consultant with expertise in gastronomic positioning.

TASK: Select 1-3 representative dishes from this menu.

PRIORITY (select in this order):
1. SIGNATURE DISHES - Unique, characteristic dishes that define the place
2. MAIN COURSES - Main dishes (NOT sides, drinks, or add-ons)
3. IDENTITY DISHES - Dishes showing the menu's culinary character (fusion, classic, etc.)

RULES:
- Select 1-3 dishes (prefer fewer good ones over many average)
- AVOID: Beverages, sides (french fries), kids menu, packages/deals
- Prioritize dishes with good descriptions
- Seek variety in category if possible

RETURN JSON:
{
  "dishes": [
    {
      "name": "Dish name (exact as in menu)",
      "description": "Original description from menu",
      "category": "Category name",
      "price": 199,
      "currency": "DKK",
      "selection_reason": "signature" | "main_course" | "identity"
    }
  ]
}

If no suitable dishes found, return {"dishes": []}.`

    const itemsText = itemsWithContext.map((item, i) => {
      const parts = [`${i + 1}. ${item.name}`]
      if (item.description) parts.push(`   Beskrivelse: ${item.description}`)
      parts.push(`   Kategori: ${item.category}`)
      if (item.price) parts.push(`   Pris: ${item.price} DKK`)
      return parts.join('\n')
    }).join('\n\n')

    const userPrompt = languageCode === 'da'
      ? `Vælg 1-3 repræsentative retter:\n\n${itemsText}`
      : `Select 1-3 representative dishes:\n\n${itemsText}`

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      }),
    })

    if (!resp.ok) {
      const errorText = await resp.text()
      console.error('GPT-4o-mini API error (dish selection):', resp.status, errorText)
      return null
    }

    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) return null

    const parsed = JSON.parse(content)
    return parsed.dishes && parsed.dishes.length > 0 ? parsed : null
  } catch (err) {
    console.error('Representative dish selection error:', err)
    return null
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl) throw new Error('Missing SUPABASE_URL')
    if (!supabaseAnonKey) throw new Error('Missing SUPABASE_ANON_KEY')
    if (!supabaseServiceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')

    const token = authHeader.replace('Bearer ', '')

    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) throw new Error('Unauthorized')

    const supabaseService = createClient(supabaseUrl, supabaseServiceRoleKey)

    const body = await req.json()
    const businessId = body?.businessId
    const url = body?.url
    const sourceId = body?.sourceId // menu_sources.id - for tracking which source this extraction belongs to
    const languageCode = normalizeLanguageCode(body?.languageCode)

    if (typeof businessId !== 'string' || !businessId) throw new Error('Missing businessId')
    if (typeof url !== 'string' || !url) throw new Error('Missing url')

    const hasAccess = await userHasBusinessAccess(supabase, businessId, user.id)
    if (!hasAccess) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Forbidden: no access to business',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create job row first so frontend can subscribe to updates.
    const { data: resultData, error: resultError } = await supabaseService
      .from('menu_results_v2')
      .insert({
        business_id: businessId,
        source_kind: 'url',
        source_url: url,
        source_id: sourceId, // Link back to menu_sources for safe deletion/retry
        status: 'queued',
        language_code: languageCode,
      })
      .select('id')
      .single()

    if (resultError) {
      console.error('❌ Failed to insert into menu_results_v2:', resultError)
      throw new Error(`Failed to create extraction job: ${resultError.message}`)
    }

    const resultId = resultData.id as string

    // Validate URL safety BEFORE fetching - protect against SSRF and internal networks
    try {
      validatePublicUrl(url)
    } catch (urlError) {
      console.error('❌ URL validation failed:', urlError)
      await supabaseService
        .from('menu_results_v2')
        .update({
          status: 'error',
          error_message: `URL blocked: ${urlError instanceof Error ? urlError.message : 'Invalid URL'}`,
          completed_at: new Date().toISOString(),
        })
        .eq('id', resultId)
      
      return new Response(
        JSON.stringify({
          success: false,
          resultId,
          error: `URL blocked: ${urlError instanceof Error ? urlError.message : 'Invalid URL'}`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Decision rule:
    // - If URL resolves to a PDF: leave queued for Cloud Run.
    // - If HTML contains strong "menu signal": parse directly in Edge and mark done.
    // - Otherwise: leave queued for Cloud Run.
    try {
      const probeResp = await fetchWithTimeout(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MenuExtractorBot/1.0)',
          'Accept': 'text/html,application/pdf;q=0.9,*/*;q=0.8',
          'Range': 'bytes=0-4095',
        },
      }, FETCH_TIMEOUT_MS)

      // Validate HTTP status - reject auth-required or not-found pages
      if (!probeResp.ok) {
        const statusError = probeResp.status === 401 || probeResp.status === 403
          ? 'Menu URL requires authentication - cannot access'
          : probeResp.status === 404
          ? 'Menu URL not found (404)'
          : `Failed to fetch menu: HTTP ${probeResp.status}`
        
        console.error('❌ HTTP status error:', statusError)
        await supabaseService
          .from('menu_results_v2')
          .update({
            status: 'error',
            error_message: statusError,
            completed_at: new Date().toISOString(),
          })
          .eq('id', resultId)
        
        return new Response(
          JSON.stringify({ success: false, resultId, error: statusError }),
          { status: probeResp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const probeCt = _stripContentType(probeResp.headers.get('content-type'))
      const probeBytes = await readAtMostBytes(probeResp, 4096)
      const urlLooksPdf = url.toLowerCase().split('?')[0].endsWith('.pdf')
      const urlLower = url.toLowerCase().split('?')[0]
      const urlLooksImage = urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg') ||
                            urlLower.endsWith('.png') || urlLower.endsWith('.gif') ||
                            urlLower.endsWith('.webp')
      const probeLooksImage = looksLikeImage(probeBytes)
      const isImageUrl = urlLooksImage || probeCt.includes('image/') || probeLooksImage
      const isPdf = !isImageUrl && (urlLooksPdf || probeCt.includes('pdf') || looksLikePdf(probeBytes))

      // Check if URL is an image file (early detection to avoid unnecessary processing)
      if (isImageUrl) {
        console.log('🖼️ Image detected - attempting OCR extraction with Google Vision API')
        
        try {
          // Mark as processing
          await supabaseService
            .from('menu_results_v2')
            .update({
              status: 'processing',
              claimed_at: new Date().toISOString(),
              attempts: 1,
              extraction_method: 'edge_ocr',
              source_content_type: probeCt || 'image/*',
            })
            .eq('id', resultId)

          // Download the full image
          const imageResp = await fetchWithTimeout(url, {
            method: 'GET',
            redirect: 'follow',
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MenuExtractorBot/1.0)' },
          }, FETCH_TIMEOUT_MS)

          if (!imageResp.ok) {
            throw new Error(`Failed to download image: ${imageResp.status}`)
          }

          const imageBytes = new Uint8Array(await imageResp.arrayBuffer())
          console.log(`📥 Downloaded image: ${imageBytes.length} bytes`)

          // Extract text using Vision API
          const extractedText = await extractTextFromImageWithVision(imageBytes)
          
          if (!extractedText || extractedText.trim().length < 10) {
            throw new Error('Vision API extracted insufficient text from image')
          }

          console.log(`📝 Extracted ${extractedText.length} characters, parsing menu...`)

          // Parse the extracted text with OpenAI
          const menuStructure = await parseMenuWithOpenAI(extractedText, languageCode)
          
          // Classify establishment type
          const establishmentType = classifyEstablishmentType(menuStructure)

          // Mark as completed
          await supabaseService
            .from('menu_results_v2')
            .update({
              status: 'done',
              structured_data: menuStructure,
              raw_text: extractedText,
              establishment_type: establishmentType,
              completed_at: new Date().toISOString(),
              source_content_type: probeCt || 'image/*',
              extraction_method: 'edge_ocr',
            })
            .eq('id', resultId)

          console.log('✅ Image OCR extraction completed successfully')

          return new Response(
            JSON.stringify({
              success: true,
              resultId,
              message: 'Image OCR extraction completed',
              menuStructure,
              establishmentType,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } catch (ocrError: any) {
          console.error('❌ Image OCR extraction failed:', ocrError)
          await supabaseService
            .from('menu_results_v2')
            .update({
              status: 'error',
              error_message: `OCR fejlede: ${ocrError.message || 'Ukendt fejl'}`,
              completed_at: new Date().toISOString(),
            })
            .eq('id', resultId)
          
          return new Response(
            JSON.stringify({
              success: false,
              resultId,
              error: ocrError.message || 'OCR extraction failed',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      // Persist observed content type for observability.
      await supabaseService
        .from('menu_results_v2')
        .update({ source_content_type: probeCt || null })
        .eq('id', resultId)

      // Handle PDFs: try Edge fast-path first (≤5 MB), fall back to Cloud Run OCR worker
      if (isPdf) {
        console.log('📄 PDF detected')

        // --- Fast path: extract with Docling + structure with OpenAI ---
        let usedFastPath = false
        if (probeBytes.length < MAX_PDF_BYTES) {
          try {
            console.log('⚡ Attempting PDF fast-path via Docling extraction...')

            // Mark as processing so the Cloud Run worker won't claim the row
            await supabaseService
              .from('menu_results_v2')
              .update({
                status: 'processing',
                claimed_at: new Date().toISOString(),
                attempts: 1,
                extraction_method: 'edge_docling',
              })
              .eq('id', resultId)

            const structured = await parsePdfMenuWithDocling(url, languageCode)

            // Fetch business opening hours (same as HTML fast path)
            const { data: businessData } = await supabaseService
              .from('businesses')
              .select('opening_hours')
              .eq('id', businessId)
              .single()

            let businessHours: { open: string; close: string } | undefined
            if (businessData?.opening_hours) {
              const hours = businessData.opening_hours
              const allOpen: string[] = []
              const allClose: string[] = []
              for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) {
                if (hours[day]?.open) allOpen.push(hours[day].open)
                if (hours[day]?.close) allClose.push(hours[day].close)
              }
              if (allOpen.length > 0 && allClose.length > 0) {
                allOpen.sort(); allClose.sort()
                businessHours = { open: allOpen[0], close: allClose[allClose.length - 1] }
                console.log(`🏢 Business hours: ${businessHours.open}-${businessHours.close}`)
              }
            }

            // Parse menu periods
            let menuPeriods: any[] = []
            const menuAvailabilityTime = structured?.availabilityTime || null
            if (structured?.categories && Array.isArray(structured.categories)) {
              menuPeriods = parseMenuPeriods(structured.categories, businessHours, menuAvailabilityTime)
            }
            const menuStartTime = menuAvailabilityTime ? (menuPeriods[0]?.startTime ?? null) : null
            const menuEndTime = menuAvailabilityTime ? (menuPeriods[menuPeriods.length - 1]?.endTime ?? null) : null
            const enrichedStructured = { ...structured, menuPeriods, startTime: menuStartTime, endTime: menuEndTime }

            // Collect all service periods explicitly named in category headers.
            // This handles pages that cover multiple service periods (e.g. lunch + dinner).
            const explicitPeriods: string[] = []
            for (const cat of structured.categories || []) {
              const n = (cat.name || '').toLowerCase()
              if ((n.includes('frokost') || n.includes('lunch')) && !explicitPeriods.includes('lunch'))
                explicitPeriods.push('lunch')
              if ((n.includes('aften') || n.includes('dinner') || n.includes('aftensmad')) && !explicitPeriods.includes('dinner'))
                explicitPeriods.push('dinner')
              if ((n.includes('brunch') || n.includes('morgenmad')) && !explicitPeriods.includes('brunch'))
                explicitPeriods.push('brunch')
              if ((n.includes('bar') || n.includes('cocktail')) && !explicitPeriods.includes('bar'))
                explicitPeriods.push('bar')
            }

            const menuTitle = structured.menuTitle || structured.categories?.[0]?.name || ''
            let rawPeriodName: string

            if (explicitPeriods.length > 0) {
              // Use the first detected period as the primary label
              rawPeriodName = explicitPeriods[0]
            } else {
              // Existing fallback: infer from menuTitle, then from parsed menuPeriods timing
              if (menuTitle.toLowerCase().includes('brunch') || menuTitle.toLowerCase().includes('morgenmad')) {
                rawPeriodName = 'brunch'
              } else if (menuTitle.toLowerCase().includes('frokost') || menuTitle.toLowerCase().includes('lunch')) {
                rawPeriodName = 'frokost'
              } else if (menuTitle.toLowerCase().includes('aften') || menuTitle.toLowerCase().includes('dinner') || menuTitle.toLowerCase().includes('aftensmad')) {
                rawPeriodName = 'aften'
              } else if (menuTitle.toLowerCase().includes('bar') || menuTitle.toLowerCase().includes('cocktail') || menuTitle.toLowerCase().includes('drink')) {
                rawPeriodName = 'bar'
              } else if (menuPeriods.length > 0) {
                // Check if this is an all-day menu (00:00-23:59 or similar)
                const firstPeriod = menuPeriods[0]
                const isAllDay = (firstPeriod.startTime === '00:00' && firstPeriod.endTime === '23:59') ||
                                 firstPeriod.type === 'all_day' ||
                                 firstPeriod.type === 'other'
                
                if (isAllDay) {
                  rawPeriodName = 'all_day'
                } else {
                  // Infer from time for specific service periods
                  const startHour = parseInt(firstPeriod.startTime?.split(':')[0] || '12')
                  if (startHour < 11) rawPeriodName = 'brunch'
                  else if (startHour >= 17) rawPeriodName = 'dinner'
                  else rawPeriodName = 'lunch'
                }
              } else {
                rawPeriodName = 'lunch'
              }
            }
            
            // Normalize all detected periods to canonical taxonomy and store as array
            // service_period_name holds the primary (first) period for backward compatibility
            const servicePeriods = explicitPeriods.length > 0
              ? explicitPeriods.map(p => normalizeProgrammeName(p))
              : [normalizeProgrammeName(rawPeriodName)]
            
            const servicePeriodName = servicePeriods[0]
            
            console.log(`📅 Service period${servicePeriods.length > 1 ? 's' : ''}: "${rawPeriodName}" → ${servicePeriods.join(', ')} (primary: ${servicePeriodName})`)

            const isSignature =
              menuTitle.toLowerCase().includes('signatur') ||
              menuTitle.toLowerCase().includes('specialit') ||
              menuTitle.toLowerCase().includes('klassiker') ||
              structured.categories?.some((cat: any) =>
                cat.name?.toLowerCase().includes('signatur') ||
                cat.name?.toLowerCase().includes('klassiker') ||
                cat.name?.toLowerCase().includes('chef')
              ) || false

            const establishmentType = classifyEstablishmentType(structured)

            // Extract detected language from AI response (Enhancement 1)
            // Validate that AI actually detected language - if not, analyze text manually
            let detectedLanguage = structured.detected_language
            if (!detectedLanguage || detectedLanguage.trim() === '') {
              console.warn(`⚠️ AI did not return detected_language, analyzing text manually...`)
              detectedLanguage = detectLanguageFromText(structured, url)
            }
            console.log(`🌐 Language detected: ${detectedLanguage} (AI: ${structured.detected_language || 'not detected, used fallback'})`)

            // Resolve menu type and timing
            const menuType = (structured.menu_type as string | undefined)
              ?? servicePeriodName
              ?? 'other'

            const { timeStart, timeEnd, timeSource } = resolveMenuTiming(
              enrichedStructured,
              businessHours,
            )

            console.log(`⏱️ Menu timing: ${menuType} ${timeStart ?? '?'}–${timeEnd ?? '?'} (source: ${timeSource})`)

            const { error: updateError } = await supabaseService
              .from('menu_results_v2')
              .update({
                status: 'done',
                raw_text: null, // no raw text for PDFs in fast path
                structured_data: enrichedStructured,
                completed_at: new Date().toISOString(),
                source_content_type: probeCt || null,
                extraction_method: 'edge_docling',
                service_periods: servicePeriods,
                service_period_name: servicePeriodName,
                is_signature: isSignature,
                language_code: detectedLanguage, // ✨ NEW: AI-detected language
                menu_type: menuType, // ✨ NEW: Menu type classification
                time_start: timeStart, // ✨ NEW: Menu start time
                time_end: timeEnd, // ✨ NEW: Menu end time
                time_source: timeSource, // ✨ NEW: Timing source
                time_confirmed: false, // ✨ NEW: User must verify
              })
              .eq('id', resultId)
            
            if (updateError) {
              console.error('❌ Failed to update menu_results_v2 to done (PDF):', updateError)
              throw new Error(`Failed to mark extraction as done: ${updateError.message}`)
            }
            console.log('✅ Menu extraction marked as done (PDF)')

            // Generate and store AI summary (non-blocking)
            try {
              const aiSummary = await generateMenuSummary(enrichedStructured, url, detectedLanguage)
              if (aiSummary) {
                await supabaseService.from('menu_results_v2')
                  .update({ ai_summary: aiSummary }).eq('id', resultId)
                console.log('✅ Menu AI summary stored (PDF)')
              }
            } catch (summaryErr) {
              console.warn('⚠️ Menu summary skipped (PDF):', summaryErr)
            }

            // ✨ Enhancement 2: Select representative dishes for voice generation
            try {
              const representativeDishes = await selectRepresentativeDishes(enrichedStructured, detectedLanguage)
              if (representativeDishes && representativeDishes.dishes?.length > 0) {
                await supabaseService.from('menu_results_v2')
                  .update({ representative_dishes: representativeDishes }).eq('id', resultId)
                console.log(`✅ Representative dishes selected (PDF): ${representativeDishes.dishes.map((d: any) => d.name).join(', ')}`)
              } else {
                console.log('⚠️ No representative dishes selected (PDF)')
              }
            } catch (dishErr) {
              console.warn('⚠️ Dish selection skipped (PDF):', dishErr)
            }

            if (establishmentType && businessId) {
              const { error: opsError } = await supabaseService
                .from('business_operations')
                .upsert({
                  business_id: businessId,
                  establishment_type: establishmentType,
                  has_kids_menu: enrichedStructured.hasKidsMenu ?? null,
                  updated_at: new Date().toISOString(),
                }, { onConflict: 'business_id' })
              if (opsError) console.warn('⚠️ Failed to save establishment_type:', opsError.message)
            }

            usedFastPath = true
            console.log('✅ PDF extracted with Docling on Edge fast-path')
            return new Response(
              JSON.stringify({ success: true, resultId, message: 'PDF menu extracted with Docling on Edge (v2)' }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            )
          } catch (pdfFastErr) {
            console.warn('⚠️ PDF fast-path with Docling failed; will try slow path:', pdfFastErr)
            // Reset status so the slow path can handle it
            await supabaseService
              .from('menu_results_v2')
              .update({ status: 'queued', claimed_at: null, extraction_method: 'docling_direct' })
              .eq('id', resultId)
          }
        }

        if (usedFastPath) return new Response('', { status: 200 }) // should never reach here

        // --- Slow path: extract directly with Docling service (no queue) ---
        console.log('📄 Extracting large PDF with Docling service')
        
        try {
          await supabaseService
            .from('menu_results_v2')
            .update({
              status: 'processing',
              claimed_at: new Date().toISOString(),
              extraction_method: 'docling_direct',
            })
            .eq('id', resultId)

          const structured = await parsePdfMenuWithDocling(url, languageCode)

          // Fetch business opening hours
          const { data: businessData } = await supabaseService
            .from('businesses')
            .select('opening_hours')
            .eq('id', businessId)
            .single()

          let businessHours: { open: string; close: string } | undefined
          if (businessData?.opening_hours) {
            const hours = businessData.opening_hours
            const allOpen: string[] = []
            const allClose: string[] = []
            for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) {
              if (hours[day]?.open) allOpen.push(hours[day].open)
              if (hours[day]?.close) allClose.push(hours[day].close)
            }
            if (allOpen.length > 0 && allClose.length > 0) {
              allOpen.sort(); allClose.sort()
              businessHours = { open: allOpen[0], close: allClose[allClose.length - 1] }
              console.log(`🏢 Business hours: ${businessHours.open}-${businessHours.close}`)
            }
          }

          // Parse menu periods
          let menuPeriods: any[] = []
          const menuAvailabilityTime = structured?.availabilityTime || null
          if (structured?.categories && Array.isArray(structured.categories)) {
            menuPeriods = parseMenuPeriods(structured.categories, businessHours, menuAvailabilityTime)
          }
          const menuStartTime = menuAvailabilityTime ? (menuPeriods[0]?.startTime ?? null) : null
          const menuEndTime = menuAvailabilityTime ? (menuPeriods[menuPeriods.length - 1]?.endTime ?? null) : null
          const enrichedStructured = { ...structured, menuPeriods, startTime: menuStartTime, endTime: menuEndTime }

          // Collect explicit service periods from category headers
          const explicitPeriods: string[] = []
          for (const cat of structured.categories || []) {
            const n = (cat.name || '').toLowerCase()
            if ((n.includes('frokost') || n.includes('lunch')) && !explicitPeriods.includes('lunch'))
              explicitPeriods.push('lunch')
            if ((n.includes('aften') || n.includes('dinner') || n.includes('aftensmad')) && !explicitPeriods.includes('dinner'))
              explicitPeriods.push('dinner')
            if ((n.includes('brunch') || n.includes('morgenmad')) && !explicitPeriods.includes('brunch'))
              explicitPeriods.push('brunch')
            if ((n.includes('bar') || n.includes('cocktail')) && !explicitPeriods.includes('bar'))
              explicitPeriods.push('bar')
          }

          const menuTitle = structured.menuTitle || structured.categories?.[0]?.name || ''
          let rawPeriodName: string

          if (explicitPeriods.length > 0) {
            rawPeriodName = explicitPeriods[0]
          } else {
            // Existing fallback logic
            if (menuTitle.toLowerCase().includes('brunch') || menuTitle.toLowerCase().includes('morgenmad')) {
              rawPeriodName = 'brunch'
            } else if (menuTitle.toLowerCase().includes('frokost') || menuTitle.toLowerCase().includes('lunch')) {
              rawPeriodName = 'frokost'
            } else if (menuTitle.toLowerCase().includes('aften') || menuTitle.toLowerCase().includes('dinner') || menuTitle.toLowerCase().includes('aftensmad')) {
              rawPeriodName = 'aften'
            } else if (menuTitle.toLowerCase().includes('bar') || menuTitle.toLowerCase().includes('cocktail') || menuTitle.toLowerCase().includes('drink')) {
              rawPeriodName = 'bar'
            } else if (menuPeriods.length > 0) {
              const firstPeriod = menuPeriods[0]
              const isAllDay = (firstPeriod.startTime === '00:00' && firstPeriod.endTime === '23:59') ||
                               firstPeriod.type === 'all_day' ||
                               firstPeriod.type === 'other'
              
              if (isAllDay) {
                rawPeriodName = 'all_day'
              } else {
                const startHour = parseInt(firstPeriod.startTime?.split(':')[0] || '12')
                if (startHour < 11) rawPeriodName = 'brunch'
                else if (startHour >= 17) rawPeriodName = 'dinner'
                else rawPeriodName = 'lunch'
              }
            } else {
              rawPeriodName = 'lunch'
            }
          }
          
          const servicePeriods = explicitPeriods.length > 0
            ? explicitPeriods.map(p => normalizeProgrammeName(p))
            : [normalizeProgrammeName(rawPeriodName)]
          
          const servicePeriodName = servicePeriods[0]
          console.log(`📅 Service period${servicePeriods.length > 1 ? 's' : ''}: "${rawPeriodName}" → ${servicePeriods.join(', ')} (primary: ${servicePeriodName})`)

          const isSignature =
            menuTitle.toLowerCase().includes('signatur') ||
            menuTitle.toLowerCase().includes('specialit') ||
            menuTitle.toLowerCase().includes('klassiker') ||
            structured.categories?.some((cat: any) =>
              cat.name?.toLowerCase().includes('signatur') ||
              cat.name?.toLowerCase().includes('klassiker') ||
              cat.name?.toLowerCase().includes('chef')
            ) || false

          const establishmentType = classifyEstablishmentType(structured)

          // Extract detected language
          let detectedLanguage = structured.detected_language
          if (!detectedLanguage || detectedLanguage.trim() === '') {
            console.warn(`⚠️ AI did not return detected_language, analyzing text manually...`)
            detectedLanguage = detectLanguageFromText(structured, url)
          }
          console.log(`🌐 Language detected: ${detectedLanguage}`)

          // Resolve menu type and timing
          const menuType = (structured.menu_type as string | undefined) ?? servicePeriodName ?? 'other'
          const { timeStart, timeEnd, timeSource } = resolveMenuTiming(enrichedStructured, businessHours)
          console.log(`⏱️ Menu timing: ${menuType} ${timeStart ?? '?'}–${timeEnd ?? '?'} (source: ${timeSource})`)

          await supabaseService
            .from('menu_results_v2')
            .update({
              status: 'done',
              raw_text: null,
              structured_data: enrichedStructured,
              completed_at: new Date().toISOString(),
              source_content_type: probeCt || null,
              extraction_method: 'docling_direct',
              service_periods: servicePeriods,
              service_period_name: servicePeriodName,
              is_signature: isSignature,
              language_code: detectedLanguage,
              menu_type: menuType,
              time_start: timeStart,
              time_end: timeEnd,
              time_source: timeSource,
              time_confirmed: false,
            })
            .eq('id', resultId)
          
          console.log('✅ Menu extraction marked as done (Docling slow path)')

          // Generate AI summary (non-blocking)
          try {
            const aiSummary = await generateMenuSummary(enrichedStructured, url, detectedLanguage)
            if (aiSummary) {
              await supabaseService.from('menu_results_v2')
                .update({ ai_summary: aiSummary }).eq('id', resultId)
              console.log('✅ Menu AI summary stored')
            }
          } catch (summaryErr) {
            console.warn('⚠️ Menu summary skipped:', summaryErr)
          }

          // Select representative dishes
          try {
            const representativeDishes = await selectRepresentativeDishes(enrichedStructured, detectedLanguage)
            if (representativeDishes && representativeDishes.dishes?.length > 0) {
              await supabaseService.from('menu_results_v2')
                .update({ representative_dishes: representativeDishes }).eq('id', resultId)
              console.log(`✅ Representative dishes selected: ${representativeDishes.dishes.map((d: any) => d.name).join(', ')}`)
            }
          } catch (dishErr) {
            console.warn('⚠️ Dish selection skipped:', dishErr)
          }

          if (establishmentType && businessId) {
            await supabaseService
              .from('business_operations')
              .upsert({
                business_id: businessId,
                establishment_type: establishmentType,
                has_kids_menu: enrichedStructured.hasKidsMenu ?? null,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'business_id' })
          }

          console.log('✅ Large PDF extracted with Docling')
          return new Response(
            JSON.stringify({ success: true, resultId, message: 'PDF menu extracted with Docling (v2)' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        } catch (doclingErr) {
          console.error('❌ Docling slow path failed:', doclingErr)
          await supabaseService
            .from('menu_results_v2')
            .update({
              status: 'error',
              error_message: `Docling extraction failed: ${doclingErr.message}`,
              completed_at: new Date().toISOString(),
            })
            .eq('id', resultId)

          return new Response(
            JSON.stringify({ success: false, resultId, error: 'PDF extraction with Docling failed' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }


      // Handle HTML menus
      if (true) {
        // Fetch full HTML (bounded) and attempt Edge fast-path.
        const htmlResp = await fetchWithTimeout(url, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MenuExtractorBot/1.0)',
            'Accept': 'text/html,*/*;q=0.8',
          },
        }, FETCH_TIMEOUT_MS)

        // Validate HTML fetch succeeded
        if (!htmlResp.ok) {
          const statusError = htmlResp.status === 401 || htmlResp.status === 403
            ? 'Menu URL requires authentication - cannot access'
            : htmlResp.status === 404
            ? 'Menu URL not found (404)'
            : `Failed to fetch menu: HTTP ${htmlResp.status}`
          
          console.error('❌ HTML fetch failed:', statusError)
          await supabaseService
            .from('menu_results_v2')
            .update({
              status: 'error',
              error_message: statusError,
              completed_at: new Date().toISOString(),
            })
            .eq('id', resultId)
          
          return new Response(
            JSON.stringify({ success: false, resultId, error: statusError }),
            { status: htmlResp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const htmlCt = _stripContentType(htmlResp.headers.get('content-type'))
        
        // Check if URL is an image file
        const urlLower = url.toLowerCase().split('?')[0]
        const isImageUrl = urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg') || 
                          urlLower.endsWith('.png') || urlLower.endsWith('.gif') || 
                          urlLower.endsWith('.webp')
        const isImageContentType = htmlCt.includes('image/')
        
        if (isImageUrl || isImageContentType) {
          console.error('❌ URL is a menu image - OCR extraction not yet supported')
          await supabaseService
            .from('menu_results_v2')
            .update({
              status: 'error',
              error_message: 'Vi kan desværre ikke udtrække tekst automatisk fra menubilleder. Upload billedet manuelt eller brug menukort-siden i stedet.',
              source_content_type: htmlCt || 'image/*',
              completed_at: new Date().toISOString(),
            })
            .eq('id', resultId)
          
          return new Response(
            JSON.stringify({
              success: true,
              resultId,
              message: 'Image detected - extraction skipped',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        if (htmlCt.includes('html')) {
          const htmlBytes = await readAtMostBytes(htmlResp, MAX_HTML_BYTES)
          const html = new TextDecoder('utf-8').decode(htmlBytes)
          
          // Detect login/authentication pages - prevent extracting password forms
          if (looksLikeLoginPage(html, url)) {
            console.error('❌ URL appears to be a login/admin page')
            await supabaseService
              .from('menu_results_v2')
              .update({
                status: 'error',
                error_message: 'URL appears to be a login or admin page - not a public menu',
                completed_at: new Date().toISOString(),
              })
              .eq('id', resultId)
            
            return new Response(
              JSON.stringify({
                success: false,
                resultId,
                error: 'URL appears to be a login or admin page - not a public menu',
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          
          // Extract JS gallery widget items first (before generic HTML-to-text muddies the signal)
          const galleryExtract = extractJsGalleryMenuItems(html)
          const rawText = galleryExtract 
            ? galleryExtract + htmlToText(html)
            : htmlToText(html)
          const llmText = cleanHtmlTextForLlm(rawText, MAX_EDGE_LLM_CHARS)

          // ALWAYS try Edge parsing for HTML (removed signal check)
          // GPT-4o-mini is cheap and fast - better to try and fail than pre-filter
          console.log(`🔍 Attempting Edge extraction for HTML (${llmText.length} chars)`)
          if (galleryExtract) console.log(`✨ Detected JS gallery widget with ${galleryExtract.split('\n').length - 3} items`)
          console.log(`📄 First 1500 chars of text sent to AI:\n${llmText.substring(0, 1500)}`)
          
          // Mark processing so Cloud Run won't claim it.
          await supabaseService
            .from('menu_results_v2')
            .update({
              status: 'processing',
              claimed_at: new Date().toISOString(),
              attempts: 1,
              extraction_method: 'edge_html',
            })
            .eq('id', resultId)

          try {
            const structured = await parseMenuWithOpenAI(llmText, languageCode)
            
            // Validate that we actually got menu data
            if (!structured?.categories || structured.categories.length === 0) {
              throw new Error('No menu categories extracted from HTML')
            }
            
            console.log(`✅ Extracted ${structured.categories.length} categories from HTML`)

            // Fetch business opening hours to constrain menu periods
            const { data: businessData } = await supabaseService
                .from('businesses')
                .select('opening_hours')
                .eq('id', businessId)
                .single()
              
              // Extract earliest open and latest close times across all days
              let businessHours: { open: string; close: string } | undefined
              if (businessData?.opening_hours) {
                const hours = businessData.opening_hours
                const allOpen: string[] = []
                const allClose: string[] = []
                
                // Collect all opening/closing times
                for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) {
                  if (hours[day]?.open) allOpen.push(hours[day].open)
                  if (hours[day]?.close) allClose.push(hours[day].close)
                }
                
                if (allOpen.length > 0 && allClose.length > 0) {
                  // Find earliest open and latest close
                  allOpen.sort()
                  allClose.sort()
                  businessHours = {
                    open: allOpen[0],
                    close: allClose[allClose.length - 1]
                  }
                  console.log(`🏢 Business hours: ${businessHours.open}-${businessHours.close}`)
                }
              }

              // Parse menu periods from extracted categories
              let menuPeriods = []
              const menuAvailabilityTime = structured?.availabilityTime || null
              if (structured?.categories && Array.isArray(structured.categories)) {
                // Use menu-level availabilityTime if present (e.g., "@ 17.30 – 21.30")
                if (menuAvailabilityTime) {
                  console.log(`📋 Menu has availability time: ${menuAvailabilityTime}`)
                }
                
                menuPeriods = parseMenuPeriods(structured.categories, businessHours, menuAvailabilityTime)
                console.log(`📅 Parsed ${menuPeriods.length} menu periods with timing:`, 
                  menuPeriods.map(p => `${p.name} (${p.startTime}-${p.endTime})`).join(', '))
              }

              // Add menuPeriods to structured data
              const enrichedStructured = {
                ...structured,
                menuPeriods,
                startTime: menuAvailabilityTime ? (menuPeriods[0]?.startTime ?? null) : null,
                endTime: menuAvailabilityTime ? (menuPeriods[menuPeriods.length - 1]?.endTime ?? null) : null,
              }

              // Collect all service periods explicitly named in category headers.
              // This handles pages that cover multiple service periods (e.g. lunch + dinner).
              const explicitPeriods: string[] = []
              for (const cat of structured.categories || []) {
                const n = (cat.name || '').toLowerCase()
                if ((n.includes('frokost') || n.includes('lunch')) && !explicitPeriods.includes('lunch'))
                  explicitPeriods.push('lunch')
                if ((n.includes('aften') || n.includes('dinner') || n.includes('aftensmad')) && !explicitPeriods.includes('dinner'))
                  explicitPeriods.push('dinner')
                if ((n.includes('brunch') || n.includes('morgenmad')) && !explicitPeriods.includes('brunch'))
                  explicitPeriods.push('brunch')
                if ((n.includes('bar') || n.includes('cocktail')) && !explicitPeriods.includes('bar'))
                  explicitPeriods.push('bar')
              }

              const menuTitle = structured.menuTitle || structured.categories?.[0]?.name || ''
              let rawPeriodName: string

              if (explicitPeriods.length > 0) {
                // Use the first detected period as the primary label
                rawPeriodName = explicitPeriods[0]
              } else {
                // Existing fallback: infer from menuTitle, then from parsed menuPeriods timing
                if (menuTitle.toLowerCase().includes('brunch') || menuTitle.toLowerCase().includes('morgenmad')) {
                  rawPeriodName = 'brunch'
                } else if (menuTitle.toLowerCase().includes('frokost') || menuTitle.toLowerCase().includes('lunch')) {
                  rawPeriodName = 'frokost'
                } else if (menuTitle.toLowerCase().includes('aften') || menuTitle.toLowerCase().includes('dinner') || menuTitle.toLowerCase().includes('aftensmad')) {
                  rawPeriodName = 'aften'
                } else if (menuTitle.toLowerCase().includes('bar') || menuTitle.toLowerCase().includes('cocktail') || menuTitle.toLowerCase().includes('drink')) {
                  rawPeriodName = 'bar'
                } else if (menuPeriods && menuPeriods.length > 0) {
                  // Check if this is an all-day menu (00:00-23:59 or similar)
                  const firstPeriod = menuPeriods[0]
                  const isAllDay = (firstPeriod.startTime === '00:00' && firstPeriod.endTime === '23:59') ||
                                   firstPeriod.type === 'all_day' ||
                                   firstPeriod.type === 'other'
                  
                  if (isAllDay) {
                    rawPeriodName = 'all_day'
                  } else {
                    // Use timing from parsed menu periods to infer service type
                    const startHour = parseInt(firstPeriod.startTime?.split(':')[0] || '12')
                    if (startHour < 11) {
                      rawPeriodName = 'brunch'
                    } else if (startHour >= 17) {
                      rawPeriodName = 'dinner'
                    } else {
                      rawPeriodName = 'lunch'
                    }
                  }
                } else {
                  rawPeriodName = 'lunch'
                }
              }
              
              // Normalize all detected periods to canonical taxonomy and store as array
              // service_period_name holds the primary (first) period for backward compatibility
              const servicePeriods = explicitPeriods.length > 0
                ? explicitPeriods.map(p => normalizeProgrammeName(p))
                : [normalizeProgrammeName(rawPeriodName)]
              
              const servicePeriodName = servicePeriods[0]
              
              console.log(`📅 Service period${servicePeriods.length > 1 ? 's' : ''} (worker): "${rawPeriodName}" → ${servicePeriods.join(', ')} (primary: ${servicePeriodName})`)

              // Detect signature dishes (look for special menu titles or categories)
              const isSignature = 
                menuTitle.toLowerCase().includes('signatur') ||
                menuTitle.toLowerCase().includes('specialit') ||
                menuTitle.toLowerCase().includes('klassiker') ||
                structured.categories?.some((cat: any) => 
                  cat.name?.toLowerCase().includes('signatur') ||
                  cat.name?.toLowerCase().includes('klassiker') ||
                  cat.name?.toLowerCase().includes('chef')
                ) || false

              console.log(`🏷️ Tagged menu with service periods: ${servicePeriods.join(', ')} (primary: ${servicePeriodName})`, 
                isSignature ? '⭐ SIGNATURE' : '')

              // Extract detected language from AI response (Enhancement 1)
              // Validate that AI actually detected language - if not, analyze text manually
              let detectedLanguage = structured.detected_language
              if (!detectedLanguage || detectedLanguage.trim() === '') {
                console.warn(`⚠️ AI did not return detected_language, analyzing text manually...`)
                detectedLanguage = detectLanguageFromText(structured, url)
              }
              console.log(`🌐 Language detected: ${detectedLanguage} (AI: ${structured.detected_language || 'not detected, used fallback'})`)

              // Classify establishment type based on menu structure
              const establishmentType = classifyEstablishmentType(structured)
              
              // Resolve menu type and timing
              const menuType = (structured.menu_type as string | undefined)
                ?? servicePeriodName
                ?? 'other'

              const { timeStart, timeEnd, timeSource } = resolveMenuTiming(
                enrichedStructured,
                businessHours,
              )

              console.log(`⏱️ Menu timing: ${menuType} ${timeStart ?? '?'}–${timeEnd ?? '?'} (source: ${timeSource})`)
              
              const { error: updateError } = await supabaseService
                .from('menu_results_v2')
                .update({
                  status: 'done',
                  raw_text: rawText,
                  structured_data: enrichedStructured,
                  completed_at: new Date().toISOString(),
                  source_content_type: htmlCt || probeCt || null,
                  extraction_method: 'edge_html',
                  service_periods: servicePeriods, // ✨ NEW
                  service_period_name: servicePeriodName, // ✨ NEW
                  is_signature: isSignature, // ✨ NEW
                  language_code: detectedLanguage, // ✨ NEW: AI-detected language
                  menu_type: menuType, // ✨ NEW: Menu type classification
                  time_start: timeStart, // ✨ NEW: Menu start time
                  time_end: timeEnd, // ✨ NEW: Menu end time
                  time_source: timeSource, // ✨ NEW: Timing source
                  time_confirmed: false, // ✨ NEW: User must verify
                })
                .eq('id', resultId)
              
              if (updateError) {
                console.error('❌ Failed to update menu_results_v2 to done (HTML):', updateError)
                throw new Error(`Failed to mark extraction as done: ${updateError.message}`)
              }
              console.log('✅ Menu extraction marked as done (HTML)')

              // Generate and store AI summary (non-blocking)
              try {
                const aiSummary = await generateMenuSummary(enrichedStructured, url, detectedLanguage)
                if (aiSummary) {
                  await supabaseService.from('menu_results_v2')
                    .update({ ai_summary: aiSummary }).eq('id', resultId)
                  console.log('✅ Menu AI summary stored (HTML)')
                }
              } catch (summaryErr) {
                console.warn('⚠️ Menu summary skipped (HTML):', summaryErr)
              }

              // ✨ Enhancement 2: Select representative dishes for voice generation
              try {
                const representativeDishes = await selectRepresentativeDishes(enrichedStructured, detectedLanguage)
                if (representativeDishes && representativeDishes.dishes?.length > 0) {
                  await supabaseService.from('menu_results_v2')
                    .update({ representative_dishes: representativeDishes }).eq('id', resultId)
                  console.log(`✅ Representative dishes selected (HTML): ${representativeDishes.dishes.map((d: any) => d.name).join(', ')}`)
                } else {
                  console.log('⚠️ No representative dishes selected (HTML)')
                }
              } catch (dishErr) {
                console.warn('⚠️ Dish selection skipped (HTML):', dishErr)
              }

              // Save establishment type to business_operations if classified
              if (establishmentType && businessId) {
                console.log('🏢 Saving establishment type to business_operations:', establishmentType)
                const { error: opsError } = await supabaseService
                  .from('business_operations')
                  .upsert({
                    business_id: businessId,
                    establishment_type: establishmentType,
                    has_kids_menu: enrichedStructured.hasKidsMenu ?? null,
                    updated_at: new Date().toISOString()
                  }, { onConflict: 'business_id' })
                
                if (opsError) {
                  console.warn('⚠️ Failed to save establishment_type:', opsError.message)
                } else {
                  console.log('✅ Saved establishment_type to business_operations:', establishmentType)
                  if (enrichedStructured.hasKidsMenu !== null) {
                    console.log('✅ Saved has_kids_menu:', enrichedStructured.hasKidsMenu)
                  }
                }
              }

              return new Response(
                JSON.stringify({
                  success: true,
                  resultId,
                  message: 'Menu extracted on Edge (v2)',
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            } catch (edgeErr) {
              console.error('❌ Edge HTML extraction failed:', edgeErr)
              
              // Check if it's truly unreadable or just no menu content
              const errorMsg = (edgeErr as Error).message || 'Unknown error'
              const isNoMenuFound = errorMsg.includes('No menu categories')
              
              if (isNoMenuFound) {
                // Mark as error - no menu content found
                await supabaseService
                  .from('menu_results_v2')
                  .update({
                    status: 'error',
                    error_message: 'No menu content found on this page',
                    completed_at: new Date().toISOString(),
                  })
                  .eq('id', resultId)
                
                console.log('⚠️ No menu found - marked as error')
                
                return new Response(
                  JSON.stringify({
                    success: false,
                    resultId,
                    error: 'No menu content found on this page',
                  }),
                  { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
              } else {
                // Parsing error or API issue - fall back to Cloud Run as last resort
                console.error('Edge parsing error; falling back to Cloud Run:', edgeErr)
                await supabaseService
                  .from('menu_results_v2')
                  .update({
                    status: 'queued',
                    claimed_at: null,
                    extraction_method: 'cloudrun_fallback',
                  })
                  .eq('id', resultId)
              }
            }
        } else {
          // Not HTML, not PDF, not image - unsupported content type
          console.error(`❌ Unsupported content type: ${htmlCt}`)
          await supabaseService
            .from('menu_results_v2')
            .update({
              status: 'error',
              error_message: `Unsupported content type: ${htmlCt || 'unknown'}. Please provide an HTML page or PDF menu.`,
              source_content_type: htmlCt || null,
              completed_at: new Date().toISOString(),
            })
            .eq('id', resultId)
          
          return new Response(
            JSON.stringify({
              success: false,
              resultId,
              error: `Unsupported content type. Please provide an HTML page or PDF menu.`,
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    } catch (e) {
      console.error('⚠️ Edge fast-path failed; falling back to Cloud Run:', e)
      // Fall back to queued job; worker will process.
    }

    // Best-effort: wake Cloud Run on demand (useful if service scales to zero).
    await triggerMenuWorkerOnce()

    return new Response(
      JSON.stringify({
        success: true,
        resultId,
        message: 'Menu extraction queued (v2) - processing will start shortly',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('❌ menu-extract-v2 error:', error)
    return new Response(
      JSON.stringify({
        error: error?.message || 'Failed to queue menu extraction',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
