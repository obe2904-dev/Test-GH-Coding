// @ts-ignore - Deno import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno ESM import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// @ts-ignore - Deno global
declare const Deno: any

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function detectUploadedFileType(bytes: Uint8Array, fallbackMimeType: string): { mimeType: string; extension: string } {
  if (bytes.length >= 4) {
    const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
    if (isPdf) return { mimeType: 'application/pdf', extension: 'pdf' }
  }

  if (bytes.length >= 3) {
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    if (isJpeg) return { mimeType: 'image/jpeg', extension: 'jpg' }
  }

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
    if (isPng) return { mimeType: 'image/png', extension: 'png' }
  }

  if (bytes.length >= 12) {
    const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])
    const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])
    if (riff === 'RIFF' && webp === 'WEBP') return { mimeType: 'image/webp', extension: 'webp' }
  }

  if (bytes.length >= 6) {
    const header = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5])
    if (header === 'GIF87a' || header === 'GIF89a') return { mimeType: 'image/gif', extension: 'gif' }
  }

  const normalizedFallback = fallbackMimeType.toLowerCase().split(';')[0].trim()
  if (normalizedFallback === 'application/pdf') return { mimeType: 'application/pdf', extension: 'pdf' }
  if (normalizedFallback === 'image/png') return { mimeType: 'image/png', extension: 'png' }
  if (normalizedFallback === 'image/webp') return { mimeType: 'image/webp', extension: 'webp' }
  if (normalizedFallback === 'image/gif') return { mimeType: 'image/gif', extension: 'gif' }

  return { mimeType: normalizedFallback || 'application/octet-stream', extension: 'bin' }
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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')

    const token = authHeader.replace('Bearer ', '')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) throw new Error('Unauthorized')

    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const form = await req.formData()
    const businessId = form.get('businessId')
    if (typeof businessId !== 'string' || !businessId) throw new Error('Missing businessId')

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

    const languageCode = normalizeLanguageCode(form.get('languageCode'))

    const file = form.get('file')
    if (!(file instanceof File)) throw new Error('Missing file')

    const originalName = typeof form.get('fileName') === 'string' ? String(form.get('fileName')) : file.name
    const safeBaseName = (originalName || 'menu')
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')

    // Optional: menu headline from user
    const menuHeadline = form.get('menuHeadline')
    const serviceHeadline = typeof menuHeadline === 'string' ? menuHeadline.trim() : null

    const uploadBytes = new Uint8Array(await file.arrayBuffer())
    if (uploadBytes.length === 0) throw new Error('Empty file')

    const detectedType = detectUploadedFileType(uploadBytes, file.type || 'application/octet-stream')
    const normalizedFileName = `${safeBaseName}.${detectedType.extension}`

    // Store PDF so menus are retained
    const storagePath = `${businessId}/menu/${crypto.randomUUID()}_${normalizedFileName}`

    const { data: uploadData, error: uploadError } = await supabaseService.storage
      .from('user-media')
      .upload(storagePath, uploadBytes, {
        contentType: detectedType.mimeType,
        upsert: false,
      })

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

    const { data: urlData } = supabaseService.storage
      .from('user-media')
      .getPublicUrl(storagePath)

    // Canonical stored menu
    await supabaseService
      .from('business_documents')
      .upsert({
        business_id: businessId,
        document_type: 'menu',
        file_name: normalizedFileName,
        storage_path: storagePath,
        public_url: urlData.publicUrl,
        extracted_text: null,
        extracted_json: null,
        file_size: uploadBytes.length,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'storage_path',
      })

    // Map file type to source_kind for menu_sources
    const sourceKind = detectedType.mimeType === 'application/pdf' ? 'pdf' : 'image'

    // Create menu_sources entry to unify with URL-based import flow
    const { data: sourceData, error: sourceError } = await supabaseService
      .from('menu_sources')
      .upsert({
        business_id: businessId,
        source_url: urlData.publicUrl,
        normalized_url: urlData.publicUrl,
        source_type: detectedType.mimeType === 'application/pdf' ? 'pdf' : 'image',
        source_origin: 'manual_added',
        status: 'pending',
        menu_type: 'standard',
        label: serviceHeadline || normalizedFileName,
        source_kind: sourceKind,
        file_name: normalizedFileName,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'business_id,normalized_url',
        ignoreDuplicates: false,
      })
      .select('id')
      .single()

    if (sourceError) {
      console.error('Failed to create menu_sources entry:', sourceError)
      throw new Error('Failed to register menu source')
    }

    // Enqueue v2 async extraction job linked to the source
    const insertPayload: any = {
      business_id: businessId,
      source_id: sourceData.id,
      source_kind: 'storage',
      source_url: urlData.publicUrl,
      storage_bucket: 'user-media',
      storage_path: storagePath,
      source_content_type: detectedType.mimeType,
      status: 'queued',
      language_code: languageCode,
    }

    // Add optional service period name if provided
    if (serviceHeadline) {
      insertPayload.service_period_name = serviceHeadline
    }

    const { data: resultData, error: resultError } = await supabaseService
      .from('menu_results_v2')
      .insert(insertPayload)
      .select('id')
      .single()

    if (resultError) throw new Error('Failed to create extraction job')

    // Best-effort: wake Cloud Run on demand (useful if service scales to zero).
    await triggerMenuWorkerOnce()

    return new Response(
      JSON.stringify({
        success: true,
        sourceId: sourceData.id,
        resultId: resultData.id,
        storagePath: uploadData.path,
        publicUrl: urlData.publicUrl,
        languageCode,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error?.message || 'Failed to upload and queue menu extraction',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
