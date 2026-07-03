import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getUserIdFromAuth, getUserQuota, incrementQuota } from '../_shared/quota-utils.ts'
import { buildEditInstructions, buildEditPrompt, EditSuggestion } from './prompts.ts'
import { resizeForGemini } from '../_shared/resize-image.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EditPhotoRequest {
  imageUrl: string
  selectedSuggestions: {
    id: string
    category: 'cropping' | 'cleaning' | 'color'
    title: string
    reason: string
    location: string  // Plain text description of where the issue is
    action: string
  }[]
  language?: string
}

// ── Gemini image-editing helper ──────────────────────────────────────────────
// Sends one batch of editing suggestions to Gemini and returns the result image.
// Separating clean/color from crop allows each pass to use the right temperature:
//   cleaning → 0.3  (needs creative fill for removed areas)
//   cropping  → 0.05 (geometric, must not hallucinate anything)
async function callGeminiEdit(
  imgBase64: string,
  imgMimeType: string,
  suggestions: EditSuggestion[],
  aspectRatio: string | undefined,
  apiKey: string,
  lang: string
): Promise<{ base64: string; mimeType: string }> {
  const instructions = buildEditInstructions(suggestions)
  const { systemPrompt, userPrompt } = buildEditPrompt(lang, instructions)

  const isCropOnly = suggestions.every(s => s.category === 'cropping')
  const temperature = isCropOnly ? 0.05 : 0.3
  const topK        = isCropOnly ? 10   : 40
  const topP        = isCropOnly ? 0.7  : 0.9

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: `${systemPrompt}\n\n${userPrompt}` },
            { inline_data: { mime_type: imgMimeType, data: imgBase64 } }
          ]
        }],
        generationConfig: {
          temperature,
          topK,
          topP,
          responseModalities: ['IMAGE', 'TEXT'],
          ...(aspectRatio ? { imageConfig: { aspectRatio } } : {})
        }
      })
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API request failed: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const candidate = data.candidates?.[0]
  if (!candidate) {
    const blockReason = data.promptFeedback?.blockReason
    throw new Error(`Gemini returned no candidate${blockReason ? `: ${blockReason}` : ''}`)
  }

  // Gemini may return inline_data (snake_case REST) or inlineData (camelCase SDK)
  const imagePart = candidate.content?.parts?.find((p: any) => p.inline_data || p.inlineData)
  if (!imagePart) {
    const textPart = candidate.content?.parts?.find((p: any) => p.text)
    const hint = textPart?.text ? ` Model said: "${textPart.text.slice(0, 200)}"` : ''
    throw new Error(`No edited image returned from Gemini.${hint}`)
  }

  const imageData = imagePart.inline_data || imagePart.inlineData
  if (!imageData?.data) throw new Error('Empty image data in Gemini response')

  return {
    base64:   imageData.data,
    mimeType: imageData.mime_type || imageData.mimeType || imgMimeType
  }
}

// ── No-op detection ────────────────────────────────────────────
// A meaningful edit changes compressed image size by more than 0.5%.
// An unchanged or barely-touched image stays within that band.
function isNoOp(editedBase64: string, originalBase64: string): boolean {
  const ratio = Math.abs(editedBase64.length - originalBase64.length) / Math.max(originalBase64.length, 1)
  return ratio < 0.005
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    
    // 🔐 SERVER-SIDE AUTHENTICATION & QUOTA CHECK
    const authHeader = req.headers.get('authorization')
    
    const userId = getUserIdFromAuth(authHeader)
    
    if (!userId) {
      console.error('❌ No user ID - returning 401')
      return new Response(
        JSON.stringify({ error: 'Unauthorized - valid token required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check daily quota (photo editing counts as AI generation)
    const dailyQuota = await getUserQuota(userId, 'aiGenerations', 'daily')
    
    if (!dailyQuota.allowed) {
      console.error('❌ Quota exceeded - returning 429')
      return new Response(
        JSON.stringify({ 
          error: 'Daily quota exceeded',
          tier: dailyQuota.tier,
          current: dailyQuota.current,
          limit: dailyQuota.limit,
          message: dailyQuota.reason
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Only allow Standard Plus (Smart) and Premium (Pro) tiers
    if (dailyQuota.tier === 'free') {
      console.error('❌ FREE tier detected - returning 403')
      return new Response(
        JSON.stringify({ 
          error: 'AI photo editing requires Smart or Pro plan',
          tier: dailyQuota.tier,
          message: 'Upgrade to Smart or Pro to use AI-powered photo editing'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    

    const { imageUrl, selectedSuggestions, language = 'da' }: EditPhotoRequest = await req.json()

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'imageUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!selectedSuggestions || selectedSuggestions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one suggestion must be selected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    
    if (!GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY not configured in environment')
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✏️ Editing photo:', { imageUrl, suggestionCount: selectedSuggestions.length })

    // Fetch original image
    const imageResponse = await fetch(imageUrl)
    
    if (!imageResponse.ok) {
      console.error('❌ Failed to fetch image:', imageResponse.status, imageResponse.statusText)
      throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`)
    }
    
    const rawImageBuffer = await imageResponse.arrayBuffer()
    const imageSizeKB = Math.round(rawImageBuffer.byteLength / 1024)
    
    // Check if image is too large (4MB limit for original)
    if (rawImageBuffer.byteLength > 4 * 1024 * 1024) {
      console.error('❌ Image too large:', imageSizeKB + 'KB (max 4MB)')
      const errorMsg = language === 'da'
        ? `Billedet er for stort (${imageSizeKB}KB). Upload venligst et billede under 4MB.`
        : `Image too large (${imageSizeKB}KB). Please upload an image under 4MB.`
      throw new Error(errorMsg)
    }

    // Determine MIME type from Content-Type header (most reliable for signed URLs)
    const contentTypeHeader = imageResponse.headers.get('content-type') || ''
    let mimeType = contentTypeHeader.split(';')[0].trim()
    if (!mimeType) mimeType = 'image/jpeg'

    // Resize large images to ≤1024px before sending to Gemini (cuts token cost up to 12×)
    const { buffer: imageBuffer, mimeType: resizedMimeType } = await resizeForGemini(rawImageBuffer, mimeType)
    mimeType = resizedMimeType
    
    // Convert to base64
    const bytes = new Uint8Array(imageBuffer)
    let binary = ''
    const chunkSize = 0x8000
    
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
      binary += String.fromCharCode.apply(null, Array.from(chunk))
    }
    
    const base64Image = btoa(binary)

    console.log(`📦 Image prepared: ${Math.round(imageBuffer.byteLength / 1024)}KB, MIME: ${mimeType}`)

    // All crop actions are handled client-side (canvas) and never reach this endpoint.
    // Cleaning and color run as separate passes so each gets the right temperature.
    const cleaningSuggestions = (selectedSuggestions as EditSuggestion[]).filter(s => s.category === 'cleaning')
    const colorSuggestions    = (selectedSuggestions as EditSuggestion[]).filter(s => s.category === 'color')

    console.log('✏️ Applying edits:', { cleaning: cleaningSuggestions.map(s => s.action), color: colorSuggestions.map(s => s.action) })

    let currentBase64   = base64Image
    let currentMimeType = mimeType
    let appliedCount    = 0

    // ── Pass 1: cleaning ───────────────────────────────────────────
    if (cleaningSuggestions.length > 0) {
      console.log('✏️ Pass 1 — cleaning:', cleaningSuggestions.map(s => s.action))
      try {
        const cleaned = await callGeminiEdit(currentBase64, currentMimeType, cleaningSuggestions, 'cleaning', GEMINI_API_KEY!, language)
        if (!isNoOp(cleaned.base64, currentBase64)) {
          currentBase64   = cleaned.base64
          currentMimeType = cleaned.mimeType
          appliedCount += cleaningSuggestions.length
          console.log('✅ Pass 1 applied')
        } else {
          console.warn('⚠️ Pass 1 no-op — retrying with first suggestion only')
          const retry = await callGeminiEdit(currentBase64, currentMimeType, [cleaningSuggestions[0]], 'cleaning', GEMINI_API_KEY!, language, 0.4)
          if (!isNoOp(retry.base64, currentBase64)) {
            currentBase64   = retry.base64
            currentMimeType = retry.mimeType
            appliedCount += 1
            console.log('✅ Pass 1 retry applied')
          } else {
            console.warn('⚠️ Pass 1 retry also no-op — skipping cleaning pass')
          }
        }
      } catch (err) {
        console.error('❌ Pass 1 failed:', err)
        try {
          console.warn('⚠️ Retrying Pass 1 with first suggestion only')
          const retry = await callGeminiEdit(currentBase64, currentMimeType, [cleaningSuggestions[0]], 'cleaning', GEMINI_API_KEY!, language, 0.4)
          if (!isNoOp(retry.base64, currentBase64)) {
            currentBase64   = retry.base64
            currentMimeType = retry.mimeType
            appliedCount += 1
            console.log('✅ Pass 1 retry applied')
          }
        } catch (retryErr) {
          console.error('❌ Pass 1 retry also failed — continuing without cleaning:', retryErr)
        }
      }
    }

    // ── Pass 2: color ────────────────────────────────────────────
    if (colorSuggestions.length > 0) {
      console.log('✏️ Pass 2 — color:', colorSuggestions.map(s => s.action))
      try {
        const colored = await callGeminiEdit(currentBase64, currentMimeType, colorSuggestions, 'color', GEMINI_API_KEY!, language)
        if (!isNoOp(colored.base64, currentBase64)) {
          currentBase64   = colored.base64
          currentMimeType = colored.mimeType
          appliedCount += colorSuggestions.length
          console.log('✅ Pass 2 applied')
        } else {
          console.warn('⚠️ Pass 2 no-op — retrying with first suggestion only')
          const retry = await callGeminiEdit(currentBase64, currentMimeType, [colorSuggestions[0]], 'color', GEMINI_API_KEY!, language, 0.2)
          if (!isNoOp(retry.base64, currentBase64)) {
            currentBase64   = retry.base64
            currentMimeType = retry.mimeType
            appliedCount += 1
            console.log('✅ Pass 2 retry applied')
          } else {
            console.warn('⚠️ Pass 2 retry also no-op — skipping color pass')
          }
        }
      } catch (err) {
        console.error('❌ Pass 2 failed:', err)
        try {
          console.warn('⚠️ Retrying Pass 2 with first suggestion only')
          const retry = await callGeminiEdit(currentBase64, currentMimeType, [colorSuggestions[0]], 'color', GEMINI_API_KEY!, language, 0.2)
          if (!isNoOp(retry.base64, currentBase64)) {
            currentBase64   = retry.base64
            currentMimeType = retry.mimeType
            appliedCount += 1
            console.log('✅ Pass 2 retry applied')
          }
        } catch (retryErr) {
          console.error('❌ Pass 2 retry also failed — continuing without color:', retryErr)
        }
      }
    }

    const editedImageBase64   = currentBase64
    const editedImageMimeType = currentMimeType

    console.log('✅ Final edited image:', editedImageMimeType, 'size:', Math.round(editedImageBase64.length * 0.75 / 1024) + 'KB', 'applied:', appliedCount)

    // ✅ INCREMENT USAGE AFTER SUCCESSFUL EDIT
    await incrementQuota(userId, 'aiGenerations')
    
    console.log(`✅ Photo editing complete for user ${userId}`)

    // Return the edited image as base64 data URL
    return new Response(
      JSON.stringify({
        success: true,
        editedImage: `data:${editedImageMimeType};base64,${editedImageBase64}`,
        appliedEdits: appliedCount,
        message: language === 'da'
          ? `${appliedCount} forbedring(er) anvendt`
          : `${appliedCount} improvement(s) applied`
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Error editing photo:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to edit photo'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
