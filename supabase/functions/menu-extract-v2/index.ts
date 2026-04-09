// @ts-ignore - Deno import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno ESM import with specific version
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { parseMenuPeriods } from '../_shared/menuPeriodParser.ts'

// @ts-ignore - Deno global
declare const Deno: any

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const FETCH_TIMEOUT_MS = 12_000
const MAX_HTML_BYTES = 1_200_000
const MAX_EDGE_LLM_CHARS = 22_000
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

  const priceRe = /(\b\d{1,4}\s*(?:[\.,]\d{1,2})?\s*(?:kr\b|kroner\b|dkk\b)\b|\b\d{1,4}\s*[-–—]?\s*[\.,]-\b|\b\d{1,4}\s*[\.,]-\b)/i
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
  const seen = new Set<string>()
  const outLines: string[] = []
  for (const ln of finalLines) {
    const key = ln.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    outLines.push(ln)
  }

  const out = outLines.join('\n')
  return out.length > maxChars ? out.slice(0, maxChars) : out
}

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
12) **Capture ALL prices AND currency** - Danish formats: 95,- | 95 kr | 95,00 kr | 95 DKK
    - Extract numeric price (e.g., "95", "95.00", "12.5")
    - Detect currency: kr/DKK = "DKK", € = "EUR", $ = "USD", £ = "GBP", etc.
    - If currency is implied (e.g., "95,-" in Denmark), set to "DKK"
13) **Multi-line items**: Name → Description → Price = ONE item
14) **Extras/Add-ons**: Lines like "Ekstra X +20,-" or "Tilvalg Y +15,-" are separate items
15) **Kids menu**: "BØRNEMENU" or similar = separate category

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
239 DKK"

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
      "items": [
        {"name": "FAUSTBURGER", "description": "med Angus hakkebøf, ost...", "price": "199", "currency": "DKK"},
        {"name": "HANGOVER BURGER", "description": "med 2 x Angus...", "price": "239", "currency": "DKK"}
      ]
    }
  ]
}

Return ONLY valid JSON in this schema:
{
  "menuTitle": "string|null",
  "menuSubtitle": "string|null",
  "availabilityTime": "string|null",
  "availabilityDays": "string|null",
  "categories": [
    {
      "name": "string",
      "categoryDescription": "string|null",
      "timeRange": "string|null",
      "items": [
        {
          "name": "string",
          "description": "string|null",
          "price": "string|null",
          "currency": "string|null"
        }
      ]
    }
  ]
}

If no menu title, subtitle, availability time/days, or category description is found, set them to null.
If no category-specific timeRange is found, set to null.
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
      max_tokens: 8000,
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
14) Kids menu: "BØRNEMENU" or similar = separate category.

Return ONLY valid JSON in this schema:
{
  "menuTitle": "string|null",
  "menuSubtitle": "string|null",
  "availabilityTime": "string|null",
  "availabilityDays": "string|null",
  "categories": [
    {
      "name": "string",
      "categoryDescription": "string|null",
      "timeRange": "string|null",
      "items": [
        { "name": "string", "description": "string|null", "price": "string|null", "currency": "string|null" }
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
        max_tokens: 8000,
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

function normalizeLanguageCode(input: unknown): string {
  if (typeof input !== 'string') return 'da'
  const trimmed = input.trim()
  if (!trimmed) return 'da'

  const low = trimmed.toLowerCase()
  if (low === 'da' || low.startsWith('da-')) return 'da'
  if (low === 'en' || low === 'en-us' || low === 'en_us') return 'en-US'
  return trimmed
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
      const names: string[] = ((cat.items || cat.dishes || []) as any[])
        .slice(0, 8)
        .map((i: any) => i.name || i.title)
        .filter(Boolean)
      if (names.length > 0) itemLines.push(`${catName}: ${names.join(', ')}`)
    }
    if (itemLines.length === 0) return null

    const langWord =
      languageCode === 'da' ? 'dansk' :
      languageCode === 'en' ? 'engelsk' :
      languageCode

    const prompt = `Du er ekspert i restaurantmarkedsføring.\nMenu: "${menuTitle}" (${sourceUrl})\nKategorier og eksempel-retter:\n${itemLines.join('\n')}\n\nLav en overordnet opsummering i max 5 korte bullet points.\nKrav:\n- Maks. 5 bullets\n- Beskriv menuen overordnet – hvad tilbyder den, hvem henvender den sig til\n- Nævn gerne 1-3 karakteristiske retter som eksempel\n- Ingen individuelle priser\n- Professionel formulering på ${langWord}\n- Brug • som bullet-tegn\nReturner KUN bullet-listen, intet andet.`

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 400,
      }),
    })
    if (!resp.ok) return null
    const data = await resp.json()
    return data.choices?.[0]?.message?.content?.trim() || null
  } catch {
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

      const probeCt = _stripContentType(probeResp.headers.get('content-type'))
      const probeBytes = await readAtMostBytes(probeResp, 4096)
      const urlLooksPdf = url.toLowerCase().split('?')[0].endsWith('.pdf')
      const isPdf = urlLooksPdf || probeCt.includes('pdf') || looksLikePdf(probeBytes)

      // Persist observed content type for observability.
      await supabaseService
        .from('menu_results_v2')
        .update({ source_content_type: probeCt || null })
        .eq('id', resultId)

      // Handle PDFs: try Edge fast-path first (≤5 MB), fall back to Cloud Run OCR worker
      if (isPdf) {
        console.log('📄 PDF detected')

        // --- Fast path: download full PDF and parse directly with OpenAI ---
        let usedFastPath = false
        if (probeBytes.length < MAX_PDF_BYTES) {
          try {
            console.log('⚡ Attempting PDF fast-path via OpenAI file input...')

            // Download full PDF (re-fetch; probe only fetched 4096 bytes)
            const pdfResp = await fetchWithTimeout(url, {
              method: 'GET',
              redirect: 'follow',
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MenuExtractorBot/1.0)' },
            }, FETCH_TIMEOUT_MS)

            const pdfBytes = await readAtMostBytes(pdfResp, MAX_PDF_BYTES)
            if (pdfBytes.length >= MAX_PDF_BYTES) {
              throw new Error('PDF exceeds fast-path size limit; routing to Cloud Run')
            }

            // Mark as processing so the Cloud Run worker won't claim the row
            await supabaseService
              .from('menu_results_v2')
              .update({
                status: 'processing',
                claimed_at: new Date().toISOString(),
                attempts: 1,
                extraction_method: 'edge_pdf',
              })
              .eq('id', resultId)

            const structured = await parsePdfMenuWithOpenAI(pdfBytes, languageCode)

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
            const enrichedStructured = { ...structured, menuPeriods }

            // Infer service periods from menu title
            const menuTitle = structured.menuTitle || structured.categories?.[0]?.name || ''
            const menuTitleLower = menuTitle.toLowerCase()
            let servicePeriods: string[]
            let servicePeriodName: string
            if (menuTitleLower.includes('brunch')) {
              servicePeriods = ['brunch']; servicePeriodName = 'brunch'
            } else if (menuTitleLower.includes('frokost') || menuTitleLower.includes('lunch')) {
              servicePeriods = ['lunch']; servicePeriodName = 'lunch'
            } else if (menuTitleLower.includes('aften') || menuTitleLower.includes('dinner') || menuTitleLower.includes('aftensmad')) {
              servicePeriods = ['dinner']; servicePeriodName = 'dinner'
            } else if (menuPeriods.length > 0) {
              const startHour = parseInt(menuPeriods[0].startTime?.split(':')[0] || '12')
              if (startHour < 11) { servicePeriods = ['brunch']; servicePeriodName = 'brunch' }
              else if (startHour >= 17) { servicePeriods = ['dinner']; servicePeriodName = 'dinner' }
              else { servicePeriods = ['lunch']; servicePeriodName = 'lunch' }
            } else {
              servicePeriods = ['lunch', 'dinner']; servicePeriodName = 'lunch'
            }

            const isSignature =
              menuTitleLower.includes('signatur') ||
              menuTitleLower.includes('specialit') ||
              menuTitleLower.includes('klassiker') ||
              structured.categories?.some((cat: any) =>
                cat.name?.toLowerCase().includes('signatur') ||
                cat.name?.toLowerCase().includes('klassiker') ||
                cat.name?.toLowerCase().includes('chef')
              ) || false

            const establishmentType = classifyEstablishmentType(structured)

            await supabaseService
              .from('menu_results_v2')
              .update({
                status: 'done',
                raw_text: null, // no raw text for PDFs in fast path
                structured_data: enrichedStructured,
                completed_at: new Date().toISOString(),
                source_content_type: probeCt || null,
                extraction_method: 'edge_pdf',
                service_periods: servicePeriods,
                service_period_name: servicePeriodName,
                is_signature: isSignature,
              })
              .eq('id', resultId)

            // Generate and store AI summary (non-blocking)
            try {
              const aiSummary = await generateMenuSummary(enrichedStructured, url, languageCode)
              if (aiSummary) {
                await supabaseService.from('menu_results_v2')
                  .update({ ai_summary: aiSummary }).eq('id', resultId)
                console.log('✅ Menu AI summary stored (PDF)')
              }
            } catch (summaryErr) {
              console.warn('⚠️ Menu summary skipped (PDF):', summaryErr)
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
            console.log('✅ PDF extracted on Edge fast-path')
            return new Response(
              JSON.stringify({ success: true, resultId, message: 'PDF menu extracted on Edge (v2)' }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            )
          } catch (pdfFastErr) {
            console.warn('⚠️ PDF fast-path failed; falling back to Cloud Run:', pdfFastErr)
            // Reset status so the Cloud Run worker can claim it
            await supabaseService
              .from('menu_results_v2')
              .update({ status: 'queued', claimed_at: null, extraction_method: 'cloudrun_pdf_ocr' })
              .eq('id', resultId)
          }
        }

        if (usedFastPath) return new Response('', { status: 200 }) // should never reach here

        // --- Slow path: queue PDF for Cloud Run OCR worker ---
        console.log('📄 Routing PDF to Cloud Run OCR worker')
        const { data: pdfJobData, error: pdfJobError } = await supabaseService
          .from('menu_results')
          .insert({
            business_id: businessId,
            pdf_url: url,
            status: 'queued',
            source_type: 'url',
            language_code: 'da',
          })
          .select('id')
          .single()

        if (pdfJobError) {
          console.error('Failed to create PDF queue job:', pdfJobError)
          await supabaseService
            .from('menu_results_v2')
            .update({
              status: 'error',
              error_message: 'Failed to queue PDF for processing',
              completed_at: new Date().toISOString(),
            })
            .eq('id', resultId)

          return new Response(
            JSON.stringify({ success: false, resultId, error: 'Failed to queue PDF for processing' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        await supabaseService
          .from('menu_results_v2')
          .update({ status: 'queued', extraction_method: 'cloudrun_pdf_ocr' })
          .eq('id', resultId)

        await triggerMenuWorkerOnce()
        console.log(`✅ PDF queued for Cloud Run OCR with job ID: ${pdfJobData.id}`)
        return new Response(
          JSON.stringify({
            success: true,
            resultId,
            pdfJobId: pdfJobData.id,
            message: 'PDF menu queued for OCR processing',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
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

        const htmlCt = _stripContentType(htmlResp.headers.get('content-type'))
        if (htmlCt.includes('html')) {
          const htmlBytes = await readAtMostBytes(htmlResp, MAX_HTML_BYTES)
          const html = new TextDecoder('utf-8').decode(htmlBytes)
          const rawText = htmlToText(html)
          const llmText = cleanHtmlTextForLlm(rawText, MAX_EDGE_LLM_CHARS)

          if (hasMenuSignal(llmText)) {
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
              if (structured?.categories && Array.isArray(structured.categories)) {
                // Use menu-level availabilityTime if present (e.g., "@ 17.30 – 21.30")
                const menuAvailabilityTime = structured.availabilityTime || null
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
                menuPeriods
              }

              // ✨ NEW: Determine service periods from menu title/structure
              const menuTitle = structured.menuTitle || structured.categories?.[0]?.name || ''
              let servicePeriods: string[] = []
              let servicePeriodName = 'lunch' // default
              
              // Map menu title to service period
              const menuTitleLower = menuTitle.toLowerCase()
              if (menuTitle === 'Brunch' || menuTitle === 'BRUNCH' || menuTitleLower.includes('brunch')) {
                servicePeriods = ['brunch']
                servicePeriodName = 'brunch'
              } else if (menuTitle === 'FROKOST' || menuTitle === 'Frokost' || menuTitle === 'LUNCH' || menuTitleLower.includes('frokost') || menuTitleLower.includes('lunch')) {
                servicePeriods = ['lunch']
                servicePeriodName = 'lunch'
              } else if (menuTitle === 'AFTEN' || menuTitle === 'Aften' || menuTitle === 'DINNER' || menuTitleLower.includes('aften') || menuTitleLower.includes('dinner') || menuTitleLower.includes('aftensmad')) {
                servicePeriods = ['dinner']
                servicePeriodName = 'dinner'
              } else if (menuPeriods && menuPeriods.length > 0) {
                // Use timing from parsed menu periods to infer service type
                const firstPeriod = menuPeriods[0]
                const startHour = parseInt(firstPeriod.startTime?.split(':')[0] || '12')
                if (startHour < 11) {
                  servicePeriods = ['brunch']
                  servicePeriodName = 'brunch'
                } else if (startHour >= 17) {
                  servicePeriods = ['dinner']
                  servicePeriodName = 'dinner'
                } else {
                  servicePeriods = ['lunch']
                  servicePeriodName = 'lunch'
                }
              } else {
                // Unknown - assume available for lunch and dinner
                servicePeriods = ['lunch', 'dinner']
                servicePeriodName = 'lunch'
              }

              // Detect signature dishes (look for special menu titles or categories)
              const isSignature = 
                menuTitleLower.includes('signatur') ||
                menuTitleLower.includes('specialit') ||
                menuTitleLower.includes('klassiker') ||
                structured.categories?.some((cat: any) => 
                  cat.name?.toLowerCase().includes('signatur') ||
                  cat.name?.toLowerCase().includes('klassiker') ||
                  cat.name?.toLowerCase().includes('chef')
                ) || false

              console.log(`🏷️ Tagged menu with service periods: ${servicePeriods.join(', ')} (primary: ${servicePeriodName})`, 
                isSignature ? '⭐ SIGNATURE' : '')

              // Classify establishment type based on menu structure
              const establishmentType = classifyEstablishmentType(structured)
              
              await supabaseService
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
                })
                .eq('id', resultId)

              // Generate and store AI summary (non-blocking)
              try {
                const aiSummary = await generateMenuSummary(enrichedStructured, url, languageCode)
                if (aiSummary) {
                  await supabaseService.from('menu_results_v2')
                    .update({ ai_summary: aiSummary }).eq('id', resultId)
                  console.log('✅ Menu AI summary stored (HTML)')
                }
              } catch (summaryErr) {
                console.warn('⚠️ Menu summary skipped (HTML):', summaryErr)
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
              console.error('❌ Edge fast-path parse failed; falling back to Cloud Run:', edgeErr)
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
