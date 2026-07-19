// @ts-ignore - Deno import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno ESM import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

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

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const { businessId, sourceId, sourceUrl, languageCode } = await req.json()

    if (!businessId || !sourceUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: businessId, sourceUrl',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Create Supabase client with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Verify business exists
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', businessId)
      .maybeSingle()

    if (businessError) {
      console.error('[menu-enqueue] Business query failed:', businessError)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to verify business',
          errorCode: 'business_query_failed',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!business) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Business not found',
          errorCode: 'business_not_found',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check for existing queued/processing job for this source
    if (sourceId) {
      const { data: existingJobs } = await supabase
        .from('menu_results_v2')
        .select('id, status')
        .eq('source_id', sourceId)
        .in('status', ['queued', 'processing'])
        .limit(1)

      if (existingJobs && existingJobs.length > 0) {
        console.log(`[menu-enqueue] Reusing existing job: ${existingJobs[0].id}`)
        return new Response(
          JSON.stringify({
            success: true,
            resultId: existingJobs[0].id,
            status: existingJobs[0].status,
            reused: true,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
    }

    // Insert queued job
    const { data: resultRow, error: insertError } = await supabase
      .from('menu_results_v2')
      .insert({
        business_id: businessId,
        source_id: sourceId || null,
        source_kind: 'url',
        source_url: sourceUrl,
        status: 'queued',
        language_code: languageCode || 'da',
        attempts: 0,
      })
      .select('id, status')
      .single()

    if (insertError) {
      console.error('[menu-enqueue] Insert failed:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
      })

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to create menu extraction job',
          errorCode: 'job_insert_failed',
          details: insertError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!resultRow?.id || resultRow.status !== 'queued') {
      console.error('[menu-enqueue] Insert returned invalid result:', resultRow)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Menu job insert returned an invalid result',
          errorCode: 'invalid_insert_result',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`[menu-enqueue] Created job ${resultRow.id} for business ${businessId}`)

    // Best-effort wake-up so queued URL jobs do not wait for the next poll cycle.
    await triggerMenuWorkerOnce()

    return new Response(
      JSON.stringify({
        success: true,
        resultId: resultRow.id,
        status: resultRow.status,
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('[menu-enqueue] Unexpected error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        errorCode: 'internal_error',
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
