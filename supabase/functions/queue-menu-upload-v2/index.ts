// =====================================================
// queue-menu-upload-v2/index.ts
// =====================================================
// Purpose: Accept a PDF/JPEG/PNG menu upload, store it, register it as a
//          menu_source, and delegate extraction to menu-extract-v2.
// Flow:    MenuPage upload → this fn → menu-files bucket → business_documents
//          → menu_sources → menu-extract-v2 (synchronous) → menu_results_v2
// The Cloud Run worker is NOT part of this path.
// =====================================================

// @ts-ignore
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-ignore
declare const Deno: any

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB — matches UI validation

// =====================================================
// File type detection from magic bytes
// =====================================================

type FileKind = 'pdf' | 'jpeg' | 'png'

function detectFileKind(bytes: Uint8Array): FileKind | null {
  if (bytes.length < 8) return null
  // %PDF
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'pdf'
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg'
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'png'
  }
  return null
}

const CONTENT_TYPES: Record<FileKind, string> = {
  pdf: 'application/pdf',
  jpeg: 'image/jpeg',
  png: 'image/png',
}

const EXTENSIONS: Record<FileKind, string> = {
  pdf: '.pdf',
  jpeg: '.jpg',
  png: '.png',
}

// =====================================================
// Helpers
// =====================================================

function normalizeLanguageCode(input: unknown): string {
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

function normalizeLanguageCode(input: unknown): string {
  if (typeof input !== 'string') return 'da'
  const low = input.trim().toLowerCase()
  if (!low) return 'da'
  if (low === 'da' || low.startsWith('da-')) return 'da'
  if (low === 'en' || low === 'en-us' || low === 'en_us') return 'en-US'
  return input.trim()
}

async function userHasBusinessAccess(
  supabaseAuthed: any,
  businessId: string,
  userId: string,
): Promise<boolean> {
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

// =====================================================
// Main handler
// =====================================================

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    // ---- Auth ----
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')
    const token = authHeader.replace('Bearer ', '')

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) throw new Error('Unauthorized')

    const supabaseService = createClient(supabaseUrl, supabaseServiceRoleKey)

    // ---- Parse form ----
    const form = await req.formData()

    const businessId = form.get('businessId')
    if (typeof businessId !== 'string' || !businessId) throw new Error('Missing businessId')

    const hasAccess = await userHasBusinessAccess(supabase, businessId, user.id)
    if (!hasAccess) {
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden: no access to business' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const languageCode = normalizeLanguageCode(form.get('languageCode'))
    const file = form.get('file')
    if (!(file instanceof File)) throw new Error('Missing file')

    const menuHeadline = form.get('menuHeadline')
    const label = typeof menuHeadline === 'string' && menuHeadline.trim()
      ? menuHeadline.trim()
      : null

    // ---- Validate file bytes ----
    const fileBytes = new Uint8Array(await file.arrayBuffer())
    if (fileBytes.length === 0) throw new Error('Empty file')
    if (fileBytes.length > MAX_FILE_BYTES) {
      throw new Error('File too large (max 10 MB)')
    }

    // Detect actual file kind from magic bytes — never trust the extension
    const fileKind = detectFileKind(fileBytes)
    if (!fileKind) {
      throw new Error('Unsupported file type. Upload a PDF, JPEG, or PNG.')
    }

    const contentType = CONTENT_TYPES[fileKind]
    const sourceKind: 'pdf' | 'image' = fileKind === 'pdf' ? 'pdf' : 'image'

    // ---- Build safe file name ----
    const rawName = typeof form.get('fileName') === 'string'
      ? String(form.get('fileName'))
      : file.name
    const baseName = (rawName || `menu${EXTENSIONS[fileKind]}`)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
    // Ensure the extension matches the detected type (Vision/Docling routing in
    // menu-extract-v2 uses the URL extension as one of its signals)
    const safeName = baseName.toLowerCase().endsWith(EXTENSIONS[fileKind])
      ? baseName
      : baseName.replace(/\.[a-z0-9]+$/i, '') + EXTENSIONS[fileKind]

    // ---- Store file in menu-files bucket ----
    const storagePath = `${businessId}/${crypto.randomUUID()}_${safeName}`

    const { error: uploadError } = await supabaseService.storage
      .from('menu-files')
      .upload(storagePath, fileBytes, { contentType, upsert: false })

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

    const { data: urlData } = supabaseService.storage
      .from('menu-files')
      .getPublicUrl(storagePath)

    const publicUrl = urlData.publicUrl
    console.log(`📁 Stored ${fileKind} at ${storagePath}`)

    // ---- Canonical file record ----
    const { error: docError } = await supabaseService
      .from('business_documents')
      .upsert({
        business_id: businessId,
        document_type: 'menu',
        file_name: safeName,
        storage_path: storagePath,
        public_url: publicUrl,
        extracted_text: null,
        extracted_json: null,
        file_size: fileBytes.length,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'storage_path' })

    if (docError) {
      console.warn('⚠ Failed to upsert business_documents:', docError.message)
      // Non-fatal — the file is stored and extraction can proceed
    }

    // ---- Register menu_sources row ----
    // normalized_url = the public URL itself; each upload gets a unique storage
    // path so re-uploads of the same file create distinct sources by design.
    const { data: sourceRow, error: sourceError } = await supabaseService
      .from('menu_sources')
      .upsert({
        business_id: businessId,
        source_url: publicUrl,
        normalized_url: publicUrl,
        source_type: sourceKind === 'pdf' ? 'pdf' : 'url', // legacy field constraint
        source_kind: sourceKind,                            // new classifier
        source_origin: 'manual_added',                      // use existing constraint-compliant value
        status: 'pending',
        menu_type: 'standard',                              // required field
        file_name: safeName,
        label,
        created_by: user.id,
      }, { onConflict: 'business_id,normalized_url' })
      .select('id')
      .single()

    if (sourceError || !sourceRow) {
      console.error('❌ Failed to upsert menu_sources:', sourceError)
      throw new Error('Failed to register menu source')
    }

    const sourceId = sourceRow.id as string
    console.log(`📋 Registered menu_source ${sourceId} (${sourceKind})`)

    // ---- Delegate to menu-extract-v2 ----
    // Use service role key for simplicity (menu-extract-v2 accepts both user and service role auth)
    const optionalFields: Record<string, unknown> = {}
    const servicePeriod = form.get('servicePeriod')
    if (typeof servicePeriod === 'string' && servicePeriod.trim()) {
      optionalFields.servicePeriod = servicePeriod.trim()
    }

    const extractResp = await fetch(`${supabaseUrl}/functions/v1/menu-extract-v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceRoleKey}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({
        businessId,
        sourceId,
        url: publicUrl,
        languageCode,
        ...optionalFields,
      }),
    })

    const extractJson = await extractResp.json().catch(() => ({}))

    if (!extractResp.ok || extractJson?.success === false) {
      // Extraction failed but the file IS stored and the source IS registered.
      // Mark the source so the UI shows the error state and a retry is possible.
      const errMsg = extractJson?.error || `menu-extract-v2 failed: ${extractResp.status}`
      console.error('❌ Extraction delegation failed:', errMsg)

      await supabaseService
        .from('menu_sources')
        .update({ status: 'error', error_message: errMsg })
        .eq('id', sourceId)

      return new Response(
        JSON.stringify({
          success: false,
          sourceId,
          resultId: extractJson?.resultId ?? null,
          storagePath,
          publicUrl,
          error: errMsg,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    console.log(`✅ Extraction started: result ${extractJson.resultId}`)

    return new Response(
      JSON.stringify({
        success: true,
        sourceId,
        resultId: extractJson.resultId,
        storagePath,
        publicUrl,
        sourceKind,
        languageCode,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error: any) {
    console.error('❌ queue-menu-upload-v2 error:', error)
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to upload and queue menu extraction' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
