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

function normalizeLanguageCode(input: unknown): string {
  if (typeof input !== 'string') return 'da'
  const trimmed = input.trim()
  if (!trimmed) return 'da'

  // Accept a few common variants
  if (trimmed.toLowerCase() === 'da' || trimmed.toLowerCase().startsWith('da-')) return 'da'
  if (trimmed.toLowerCase() === 'en' || trimmed.toLowerCase() === 'en-us' || trimmed.toLowerCase() === 'en_us') return 'en-US'

  // Default: pass-through for future languages but keep short
  return trimmed
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

    const languageCode = normalizeLanguageCode(form.get('languageCode'))

    const file = form.get('file')
    if (!(file instanceof File)) throw new Error('Missing file')

    const originalName = typeof form.get('fileName') === 'string' ? String(form.get('fileName')) : file.name
    const safeName = (originalName || 'menu.pdf').replace(/[^a-zA-Z0-9._-]/g, '_')

    const pdfBytes = new Uint8Array(await file.arrayBuffer())
    if (pdfBytes.length === 0) throw new Error('Empty file')

    // Store PDF so menus are retained (requirement)
    const storagePath = `${businessId}/menu/${crypto.randomUUID()}_${safeName}`

    const { data: uploadData, error: uploadError } = await supabaseService.storage
      .from('business-documents')
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

    const { data: urlData } = supabaseService.storage
      .from('business-documents')
      .getPublicUrl(storagePath)

    // Insert (or update) the business document record as the canonical stored menu
    // Note: storage_path is UNIQUE, so this is safe.
    await supabaseService
      .from('business_documents')
      .upsert({
        business_id: businessId,
        document_type: 'menu',
        file_name: safeName,
        storage_path: storagePath,
        public_url: urlData.publicUrl,
        extracted_text: null,
        extracted_json: null,
        file_size: pdfBytes.length,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'storage_path',
      })

    // Enqueue async extraction job
    const { data: resultData, error: resultError } = await supabaseService
      .from('menu_results')
      .insert({
        business_id: businessId,
        pdf_url: urlData.publicUrl, // kept for backwards compatibility
        status: 'queued',
        source_type: 'storage',
        pdf_bucket: 'business-documents',
        pdf_path: storagePath,
        language_code: languageCode,
      })
      .select('id')
      .single()

    if (resultError) throw new Error('Failed to create extraction job')

    return new Response(
      JSON.stringify({
        success: true,
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
