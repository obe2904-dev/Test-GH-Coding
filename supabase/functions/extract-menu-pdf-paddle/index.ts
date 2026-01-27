// @ts-ignore - Deno import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno ESM import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// @ts-ignore - Deno global
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * Extract text from PDF using Tesseract.js OCR
 * Better character recognition than Tika, especially for Danish (æ, ø, å)
 */
async function extractWithTesseract(pdfBuffer: Uint8Array, language: string = 'da'): Promise<string> {
  console.log(`📖 Sending PDF to Tesseract OCR for text extraction (language: ${language})...`)
  console.log(`📄 PDF size: ${pdfBuffer.length} bytes`)
  
  // Language mapping for Tesseract
  const tesseractLangMap: Record<string, string> = {
    'da': 'dan',      // Danish
    'sv': 'swe',      // Swedish
    'nl': 'nld',      // Dutch
    'en': 'eng',      // English
    'en-US': 'eng',   // English US
    'fr': 'fra',      // French
    'de': 'deu',      // German
    'it': 'ita',      // Italian
    'es': 'spa',      // Spanish
    'pt': 'por',      // Portuguese
  }
  
  const tesseractLang = tesseractLangMap[language] || 'dan' // Default to Danish
  
  // Convert PDF buffer to base64 for API
  const base64Pdf = btoa(String.fromCharCode.apply(null, Array.from(pdfBuffer)))
  
  // Call Tesseract OCR service (via pythonanywhere or similar hosted service)
  // Or use local Tesseract if available
  try {
    console.log(`🧠 Tesseract OCR language: ${tesseractLang}`)
    
    // Try using a cloud Tesseract API service
    const tesseractApiKey = Deno.env.get('TESSERACT_API_KEY')
    const tesseractApiUrl = Deno.env.get('TESSERACT_API_URL') || 'https://api.pythonanywhere.com/v1/ocr'
    
    const ocrResponse = await fetch(tesseractApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(tesseractApiKey ? { 'Authorization': `Bearer ${tesseractApiKey}` } : {})
      },
      body: JSON.stringify({
        pdf_base64: base64Pdf,
        language: tesseractLang,
        config: {
          preserve_layout: true,
          ocr_engine: 'tesseract',
        }
      })
    })
    
    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text()
      console.error(`❌ Tesseract API returned error ${ocrResponse.status}:`, errorText)
      throw new Error(`Tesseract extraction failed: ${ocrResponse.status}`)
    }
    
    const result = await ocrResponse.json()
    const extractedText = result.text || result.result || ''
    
    if (!extractedText) {
      throw new Error('No text in OCR response')
    }
    
    console.log(`✅ Tesseract extracted ${extractedText.length} characters`)
    return extractedText.trim()
    
  } catch (error) {
    console.error('❌ Tesseract OCR error:', error)
    throw error
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('📥 Extract menu PDF (Tesseract OCR) request received')

    let pdfBuffer: Uint8Array
    let fileName = 'menu.pdf'
    let language = 'da'  // Default to Danish

    // Check content type to determine if it's JSON (URL) or FormData (file upload)
    const contentType = req.headers.get('content-type') || ''
    
    if (contentType.includes('application/json')) {
      // Handle URL-based PDF extraction
      console.log('📡 Extracting from URL...')
      
      // Verify JWT token
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        throw new Error('Missing authorization header')
      }

      const token = authHeader.replace('Bearer ', '')
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      )

      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      if (authError || !user) {
        console.error('❌ Auth error:', authError)
        throw new Error('Unauthorized')
      }

      console.log('✅ Authenticated user:', user.id)

      const { url, languageCode } = await req.json()
      if (!url) {
        throw new Error('URL is required')
      }
      
      if (languageCode) {
        language = languageCode
      }

      console.log('🌐 Fetching PDF from:', url)
      
      // Fetch PDF from URL
      const pdfResponse = await fetch(url)
      if (!pdfResponse.ok) {
        throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`)
      }

      const arrayBuffer = await pdfResponse.arrayBuffer()
      pdfBuffer = new Uint8Array(arrayBuffer)
      fileName = url.split('/').pop() || 'menu.pdf'
      
    } else {
      // Handle file upload
      console.log('📤 Extracting from uploaded file...')
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      const languageCodeFormField = formData.get('languageCode') as string | null

      if (!file) {
        throw new Error('No file provided')
      }

      if (!file.type.includes('pdf')) {
        throw new Error('File must be a PDF')
      }

      fileName = file.name
      
      if (languageCodeFormField) {
        language = languageCodeFormField
      }
      
      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer()
      pdfBuffer = new Uint8Array(arrayBuffer)
    }

    console.log(`📄 Processing PDF: ${fileName} (${pdfBuffer.length} bytes)`)

    // Extract text using Tesseract OCR
    const extractedText = await extractWithTesseract(pdfBuffer, language)

    if (!extractedText || extractedText.length < 10) {
      throw new Error('Could not extract meaningful text from PDF')
    }

    console.log('✅ PDF text extraction successful with Tesseract OCR')

    return new Response(
      JSON.stringify({ 
        extractedText,
        fileName: fileName,
        extractedLength: extractedText.length,
        ocrMethod: 'Tesseract'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error: any) {
    console.error('❌ Extract menu PDF (Tesseract OCR) error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to extract PDF text with Tesseract OCR',
        details: error.toString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
