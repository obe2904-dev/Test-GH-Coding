// @ts-ignore - Deno import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno ESM import (VS Code doesn't recognize esm.sh)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// @ts-ignore - Deno global
declare const Deno: any;

// Apache Tika Cloud Run endpoint for PDF text extraction
const TIKA_ENDPOINT = 'https://tika-processor-361705281766.europe-west1.run.app/tika'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface PDFUploadRequest {
  pdfUrl?: string          // URL to fetch PDF from
  pdfBase64?: string       // Base64-encoded PDF data (for manual uploads)
  fileName: string         // Name for the stored file
  businessId: string       // Business ID to associate PDF with
  pdfType: 'menu' | 'wine_list' | 'other'  // Type of PDF
  userTier?: string        // User's subscription tier (free, standardplus, premium)
}

/**
 * Extract text from PDF using Apache Tika (handles both text-based and image-based PDFs)
 * Hosted on Google Cloud Run
 * Includes retry logic with exponential backoff
 */
async function extractWithTika(pdfBuffer: Uint8Array, maxRetries = 3): Promise<string> {
  console.log('🔍 Sending PDF to Apache Tika for text extraction...')
  console.log(`📄 PDF size: ${pdfBuffer.length} bytes`)
  
  // Validate PDF size (warn if very large)
  const maxRecommendedSize = 10 * 1024 * 1024 // 10MB
  if (pdfBuffer.length > maxRecommendedSize) {
    console.warn(`⚠️ Large PDF detected: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)}MB - may take longer to process`)
  }
  
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Tika extraction attempt ${attempt}/${maxRetries}...`)
      
      const tikaResponse = await fetch(TIKA_ENDPOINT, {
        method: 'PUT',
        headers: {
          'Accept': 'text/plain'
        },
        body: pdfBuffer as any // TypeScript workaround for Deno fetch body type
      })

      if (!tikaResponse.ok) {
        const errorText = await tikaResponse.text()
        console.error(`❌ Tika returned error status ${tikaResponse.status}:`, errorText)
        
        // Don't retry on client errors (4xx)
        if (tikaResponse.status >= 400 && tikaResponse.status < 500) {
          throw new Error(`Tika client error: ${tikaResponse.status} - ${errorText}`)
        }
        
        // Retry on server errors (5xx)
        lastError = new Error(`Tika server error: ${tikaResponse.status} - ${errorText}`)
        if (attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 1000 // 2s, 4s, 8s
          console.log(`⏳ Retrying in ${backoffMs}ms...`)
          await new Promise(resolve => setTimeout(resolve, backoffMs))
          continue
        }
        throw lastError
      }

      const extractedText = await tikaResponse.text()
      console.log(`✅ Tika extraction successful: ${extractedText.length} characters extracted`)
      
      if (extractedText.length === 0) {
        console.warn('⚠️ Tika returned empty text - PDF might be blank, corrupted, or contain only images without text')
      } else if (extractedText.length < 50) {
        console.warn(`⚠️ Very short text extracted (${extractedText.length} chars) - PDF might have minimal content`)
      }
      
      return extractedText
      
    } catch (error) {
      lastError = error as Error
      
      // Don't retry on network timeouts or Deno errors
      if (error instanceof TypeError) {
        console.error('❌ Network error contacting Tika:', error.message)
        throw new Error(`Network error: ${error.message}`)
      }
      
      if (attempt < maxRetries) {
        console.warn(`⚠️ Attempt ${attempt} failed, retrying...`)
        const backoffMs = Math.pow(2, attempt) * 1000
        await new Promise(resolve => setTimeout(resolve, backoffMs))
        continue
      }
      
      console.error('❌ All Tika extraction attempts failed:', error)
      throw error
    }
  }
  
  throw lastError || new Error('Tika extraction failed after all retries')
}

/**
 * Correct common Danish character OCR errors
 * Tika/Tesseract often misreads Æ, Ø, Å as E, O, A
 */
function correctDanishCharacters(text: string): string {
  // Common Danish food/menu words that get misread
  const corrections: Record<string, string> = {
    // Æ corrections
    'AEg': 'Æg',
    'LAEG': 'LÆG',
    'Laeg': 'Læg',
    'laeg': 'læg',
    'Kraes': 'Kræs',
    'kraes': 'kræs',
    'baer': 'bær',
    'Baer': 'Bær',
    'BAER': 'BÆR',
    'graes': 'græs',
    'Graes': 'Græs',
    'slaegt': 'slægt',
    'Slaegt': 'Slægt',
    'flaesk': 'flæsk',
    'Flaesk': 'Flæsk',
    'kaeld': 'kæld',
    'Kaeld': 'Kæld',
    
    // Ø corrections
    'rod': 'rød',
    'Rod': 'Rød',
    'ROD': 'RØD',
    'gron': 'grøn',
    'Gron': 'Grøn',
    'GRON': 'GRØN',
    'morbraed': 'mørbræd',
    'Morbraed': 'Mørbræd',
    'kobenhavn': 'københavn',
    'Kobenhavn': 'København',
    'KOBENHAVN': 'KØBENHAVN',
    'sod': 'sød',
    'Sod': 'Sød',
    'stegt': 'stegt', // keep as is
    'stodt': 'stødt',
    'Stodt': 'Stødt',
    
    // Å corrections  
    'Aar': 'År',
    'aar': 'år',
    'AAR': 'ÅR',
    'Aal': 'Ål',
    'aal': 'ål',
    'AAL': 'ÅL'
  }
  
  let correctedText = text
  
  // Apply direct replacements
  for (const [wrong, correct] of Object.entries(corrections)) {
    const regex = new RegExp(`\\b${wrong}\\b`, 'g')
    correctedText = correctedText.replace(regex, correct)
  }
  
  // Pattern-based corrections for context-dependent cases
  // Example: "O" at start of Danish words often should be "Ø"
  correctedText = correctedText.replace(/\bOl(?=[a-z])/g, 'Øl')  // Øl (beer)
  correctedText = correctedText.replace(/\bOsters/g, 'Østers')  // Østers (oysters)
  
  return correctedText
}

/**
 * Get AI model based on user tier
 */
function getAIModelForTier(userTier?: string): string {
  // Map tier to AI model (centralized configuration)
  const tierModelMap: Record<string, string> = {
    'free': 'gpt-4o-mini',
    'standardplus': 'gpt-4o-mini',
    'premium': 'gpt-4o',
  }
  
  return tierModelMap[userTier || 'free'] || 'gpt-4o-mini'
}

/**
 * Parse extracted text into structured JSON menu format
 */
async function parseMenuToJSON(extractedText: string, pdfType: string, userTier?: string): Promise<any> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  const aiModel = getAIModelForTier(userTier)
  console.log(`🍽️ Parsing menu text to structured JSON using ${aiModel}...`)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: aiModel,
      messages: [
        {
          role: 'system',
          content: `You are a menu parser for Danish restaurants. Extract menu items from text and return structured JSON.

IMPORTANT - Danish Language Handling:
- This text is from a Danish restaurant menu
- Danish uses special characters: Æ/æ, Ø/ø, Å/å
- OCR may have misread these as: E/e, O/o, A/a
- Correct common OCR errors in your output (e.g., "gron" → "grøn", "rod" → "rød")
- Common Danish menu words: grøn (green), rød (red), ål (eel), øl (beer), kød (meat), brød (bread)

For each item, extract:
- name: Item name (corrected with proper Danish characters)
- description: Brief description (if available, with correct Danish spelling)
- price: Numeric price (extract number only, no currency symbols)
- currency: Currency symbol/code (e.g., "kr", "€", "$")
- category: Menu category/section (e.g., "Forretter", "Hovedretter", "Desserter")
- dietary: Dietary info if mentioned (e.g., "vegetarian", "vegan", "glutenfri")

Return a JSON object with this structure:
{
  "restaurant_name": "Name if found in text",
  "menu_type": "food_menu" | "wine_list" | "drinks_menu",
  "categories": [
    {
      "name": "Category name (in Danish if available)",
      "items": [
        {
          "name": "Item name (with correct Æ, Ø, Å characters)",
          "description": "Description or null (with correct Danish spelling)",
          "price": 89.0,
          "currency": "kr",
          "dietary": ["vegetarian"] or []
        }
      ]
    }
  ]
}

Examples of corrections:
- "Morbraed" → "Mørbræd"
- "Gront salat" → "Grønt salat"
- "Rodkal" → "Rødkål"
- "Aal" → "Ål"`
        },
        {
          role: 'user',
          content: `Parse this ${pdfType} menu:\n\n${extractedText}`
        }
      ],
      max_tokens: 4096,
      temperature: 0.1,
      response_format: { type: 'json_object' }
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('❌ Menu parsing failed:', error)
    return null
  }

  const data = await response.json()
  const menuJSON = JSON.parse(data.choices[0]?.message?.content || '{}')
  
  console.log('✅ Menu parsed to JSON, found', menuJSON.categories?.length || 0, 'categories')
  return menuJSON
}

serve(async (req: any) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: PDFUploadRequest = await req.json()
    console.log('📥 PDF upload request:', { fileName: body.fileName, businessId: body.businessId, pdfType: body.pdfType, userTier: body.userTier })

    const { pdfUrl, pdfBase64, fileName, businessId, pdfType, userTier } = body

    if (!fileName || !businessId || !pdfType) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: fileName, businessId, pdfType' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!pdfUrl && !pdfBase64) {
      return new Response(
        JSON.stringify({ error: 'Must provide either pdfUrl or pdfBase64' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let pdfBuffer: Uint8Array

    // Fetch PDF from URL or decode from base64
    if (pdfUrl) {
      console.log('📄 Fetching PDF from URL:', pdfUrl)
      const resp = await fetch(pdfUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BusinessProfileBot/1.0)',
        },
      })

      if (!resp.ok) {
        throw new Error(`Failed to fetch PDF: ${resp.status}`)
      }

      const arrayBuffer = await resp.arrayBuffer()
      pdfBuffer = new Uint8Array(arrayBuffer)
      console.log('✅ Fetched PDF, size:', pdfBuffer.length, 'bytes')
    } else {
      console.log('📄 Decoding PDF from base64')
      // Remove data:application/pdf;base64, prefix if present
      const base64Data = pdfBase64!.replace(/^data:application\/pdf;base64,/, '')
      const binaryString = atob(base64Data)
      pdfBuffer = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        pdfBuffer[i] = binaryString.charCodeAt(i)
      }
      console.log('✅ Decoded PDF, size:', pdfBuffer.length, 'bytes')
    }

    // Validate PDF buffer
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Invalid PDF: buffer is empty')
    }
    
    // Check PDF magic bytes (PDF files start with %PDF-)
    const pdfHeader = String.fromCharCode(...Array.from(pdfBuffer.slice(0, 5)))
    if (!pdfHeader.startsWith('%PDF-')) {
      console.warn('⚠️ File does not start with PDF magic bytes:', pdfHeader)
      console.warn('⚠️ Attempting to process anyway...')
    }
    
    // Extract text from PDF using Apache Tika (works for all PDF types)
    console.log('📝 Extracting text from PDF with Apache Tika...')
    let extractedText = ''
    let extractionError: string | null = null
    
    try {
      extractedText = await extractWithTika(pdfBuffer)
      console.log(`✅ Extracted text length: ${extractedText.length} characters`)
      
      // Log first 200 chars for debugging
      if (extractedText.length > 0) {
        console.log('📄 Text preview:', extractedText.substring(0, 200))
      } else {
        extractionError = 'PDF appears to be blank or contains no extractable text'
        console.warn('⚠️ WARNING:', extractionError)
      }
    } catch (extractError) {
      const errorMessage = extractError instanceof Error ? extractError.message : String(extractError)
      extractionError = errorMessage
      
      console.error('❌ Tika text extraction failed:', extractError)
      console.error('Error details:', errorMessage)
      console.log('📄 Will store PDF without extracted text')
      
      // Provide helpful error context
      if (errorMessage.includes('Network error')) {
        console.error('💡 Suggestion: Check if Tika Cloud Run service is running and accessible')
      } else if (errorMessage.includes('timeout')) {
        console.error('💡 Suggestion: PDF might be too large or complex. Consider increasing Cloud Run timeout.')
      } else if (errorMessage.includes('client error')) {
        console.error('💡 Suggestion: PDF format might be corrupted or unsupported')
      }
      
      // Continue with upload even if extraction fails
    }

    // Apply Danish character corrections to OCR text
    if (extractedText && extractedText.length > 0) {
      const originalLength = extractedText.length
      const correctedText = correctDanishCharacters(extractedText)
      
      if (correctedText !== extractedText) {
        console.log('🇩🇰 Applied Danish character corrections')
        console.log('📝 Text preview after corrections:', correctedText.substring(0, 200))
        extractedText = correctedText
      }
    }
    
    // Parse extracted text to structured JSON (for all tiers)
    let menuJSON = null
    if (extractedText && extractedText.length > 50) {
      console.log('🍽️ Starting menu parsing, text length:', extractedText.length)
      try {
        menuJSON = await parseMenuToJSON(extractedText, pdfType, userTier)
        if (menuJSON) {
          console.log('✅ Menu parsing successful')
          console.log('📊 Categories found:', menuJSON.categories?.length || 0)
        } else {
          console.log('⚠️ Menu parsing returned null')
        }
      } catch (parseError) {
        console.error('❌ Menu parsing failed:', parseError)
        // Continue without JSON - text extraction is still valuable
      }
    } else {
      console.log('⚠️ Skipping menu parsing - text too short or empty:', extractedText?.length || 0)
    }

    // Upload PDF to Supabase Storage
    const storagePath = `${businessId}/${pdfType}/${fileName}`
    console.log('☁️ Uploading to Supabase Storage:', storagePath)

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('business-documents')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true, // Replace if already exists
      })

    if (uploadError) {
      console.error('❌ Upload failed:', uploadError)
      throw new Error(`Upload failed: ${uploadError.message}`)
    }

    console.log('✅ Uploaded successfully:', uploadData.path)

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('business-documents')
      .getPublicUrl(storagePath)

    // Store metadata in database
    const { data: dbData, error: dbError } = await supabase
      .from('business_documents')
      .insert({
        business_id: businessId,
        document_type: pdfType,
        file_name: fileName,
        storage_path: storagePath,
        public_url: urlData.publicUrl,
        extracted_text: extractedText || null,
        extracted_json: menuJSON || null,
        file_size: pdfBuffer.length,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (dbError) {
      console.error('⚠️ Database insert failed:', dbError)
      // Don't fail the request - file is already uploaded
    }

    console.log('✅ PDF upload complete')

    const itemCount = menuJSON?.categories?.reduce((sum: number, cat: any) => sum + (cat.items?.length || 0), 0) || 0
    
    // Determine processing status
    const hasText = extractedText && extractedText.length > 0
    const hasJSON = !!menuJSON
    const processingStatus = hasJSON ? 'complete' : hasText ? 'partial' : 'stored_only'
    
    console.log('📤 Returning response:', {
      status: processingStatus,
      hasText,
      textLength: extractedText?.length || 0,
      hasJSON,
      itemCount,
      pdfSize: pdfBuffer.length,
      extractionError: extractionError || null
    })
    
    // Build response with helpful messages
    const response: any = {
      success: true,
      processingStatus,
      storagePath: uploadData.path,
      publicUrl: urlData.publicUrl,
      extractedText: extractedText || null,
      extractedJSON: menuJSON,
      textLength: extractedText?.length || 0,
      fileSize: pdfBuffer.length,
      documentId: dbData?.id || null,
      menuItemsCount: itemCount
    }
    
    // Add warnings/suggestions based on results
    if (!hasText && extractionError) {
      response.warning = 'Text extraction failed'
      response.errorDetails = extractionError
      response.suggestion = 'The PDF was stored but text could not be extracted. You may need to manually enter the menu items or try a different PDF file.'
    } else if (hasText && !hasJSON) {
      response.warning = 'Menu parsing incomplete'
      response.suggestion = 'Text was extracted but could not be parsed into structured menu format. The raw text is available for manual review.'
    } else if (itemCount === 0 && hasJSON) {
      response.warning = 'No menu items found'
      response.suggestion = 'The PDF was processed but no menu items were detected. Please verify the PDF contains a menu.'
    }
    
    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Error in upload-pdf function:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
