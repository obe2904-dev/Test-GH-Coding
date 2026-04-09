import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getUserIdFromAuth, getUserQuota, incrementQuota } from '../_shared/quota-utils.ts'
import { buildSimplePrompt, buildCall1Prompt, buildCall2Prompt } from './prompts.ts'
import { SUPPORTED_AI_EDIT_ACTIONS } from '../_shared/ai-actions.ts'
import { resizeForGemini } from '../_shared/resize-image.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AnalyzePhotoRequest {
  imageUrl: string
  postText?: string
  businessType?: string
  language?: string
  mediaType?: 'image' | 'video' // Type of media being analyzed
  duration?: number // Video duration in seconds (for videos only)
  imageWidth?: number  // Client-detected pixel width (more reliable than server-side JPEG parsing)
  imageHeight?: number // Client-detected pixel height
}

type SuggestionCategory = 'cleaning' | 'color'
type SuggestionAction =
  | 'remove_object'
  | 'reduce_clutter'
  | 'reduce_smudge'
  | 'adjust_temperature_warm'
  | 'adjust_temperature_cool'
  | 'fix_exposure'

interface Suggestion {
  id: string
  category: SuggestionCategory
  title: string
  reason: string
  location: string  // Plain text description of where the issue is
  action: SuggestionAction
}

interface HumanSuggestion {
  text: string  // A short "consider next time" note about a named item/ingredient mismatch
}

interface AnalysisResultPaid {
  contentMatch: {
    rating: 'excellent' | 'good' | 'fair' | 'poor'
    feedback: string
    rewriteSuggestion?: string | null
    reshootGuidance?: string | null
    actionNeeded?: 'none' | 'rewrite' | 'choice'
  }
  emojiMatch: string | null
  whatWorks: string[]
  generalFeedback: string
  suggestions: Suggestion[]  // Up to 6; empty array = image is good, no improvements needed
  humanSuggestions: HumanSuggestion[]  // Named item/ingredient mismatches; empty = no mismatch
  recommendation: 'post-it' | 'good-enough' | 'quick-fix' | 'retake'
  recommendationText: string
  platformNote?: string
}

type AnalysisResult = AnalysisResultPaid

// Extract pixel dimensions from a JPEG or PNG buffer (no external library needed)
function getImageDimensions(buffer: ArrayBuffer): { width: number; height: number } | null {
  const b = new Uint8Array(buffer)
  // PNG: magic 89 50 4E 47, IHDR width at bytes 16-19, height at 20-23
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 && b.length >= 24) {
    const w = ((b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]) >>> 0
    const h = ((b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]) >>> 0
    return { width: w, height: h }
  }
  // JPEG: scan for SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2) markers
  // Must handle 0xFF padding bytes and all segment types robustly
  if (b[0] === 0xFF && b[1] === 0xD8) {
    let i = 2
    while (i < b.length - 8) {
      // Skip any 0xFF padding bytes
      while (i < b.length && b[i] === 0xFF) i++
      if (i >= b.length) break
      const marker = b[i]
      i++
      // SOI / EOI / RST markers have no length field
      if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) continue
      if (i + 2 > b.length) break
      const segLen = ((b[i] << 8) | b[i + 1]) >>> 0
      if (segLen < 2) break
      // SOF0, SOF1, SOF2 contain dimensions
      if ((marker === 0xC0 || marker === 0xC1 || marker === 0xC2) && segLen >= 9) {
        const h = ((b[i + 3] << 8) | b[i + 4]) >>> 0
        const w = ((b[i + 5] << 8) | b[i + 6]) >>> 0
        if (w > 0 && h > 0) return { width: w, height: h }
      }
      i += segLen
    }
  }
  return null
}

// ─── Structured result from Call 1 (assessment only) ────────────────────────
interface Call1Result {
  contentMatch: AnalysisResultPaid['contentMatch']
  emojiMatch: string | null
  whatWorks: string[]
  generalFeedback: string
  humanSuggestions: HumanSuggestion[]
  recommendation: AnalysisResultPaid['recommendation']
  recommendationText: string
}

// ─── Shared Gemini helpers ───────────────────────────────────────────────────
async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  base64Image: string,
  mimeType: string
): Promise<string> {
  let response: Response
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { text: `${systemPrompt}\n\n${userPrompt}` },
              { inline_data: { mime_type: mimeType, data: base64Image } }
            ]
          }],
          generationConfig: {
            temperature: 0.4,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 4000,
            responseMimeType: 'application/json'
          }
        })
      }
    )
  } catch (fetchError) {
    throw new Error(`Failed to connect to Gemini API: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`)
  }
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API request failed: ${response.status} - ${errorText}`)
  }
  const data = await response.json()
  const parts = data.candidates?.[0]?.content?.parts
  const text = Array.isArray(parts) ? parts.map((p: any) => p?.text ?? '').join('') : undefined
  if (!text) throw new Error('No response from Gemini')
  return text
}

function extractJson(text: string): any {
  let jsonString = text.trim()
  const codeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (codeBlockMatch) jsonString = codeBlockMatch[1].trim()
  const jsonStart = jsonString.indexOf('{')
  const jsonEnd = jsonString.lastIndexOf('}')
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    jsonString = jsonString.substring(jsonStart, jsonEnd + 1)
  }
  return JSON.parse(jsonString)
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
      return new Response(
        JSON.stringify({ error: 'Unauthorized - valid token required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check daily quota (photo analysis counts as AI generation)
    const dailyQuota = await getUserQuota(userId, 'aiGenerations', 'daily')
    if (!dailyQuota.allowed) {
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

    const { imageUrl, postText, businessType, language = 'da', mediaType = 'image', duration, imageWidth: clientWidth, imageHeight: clientHeight }: AnalyzePhotoRequest = await req.json()
    const tier = dailyQuota.tier

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'imageUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // SSRF protection: only allow HTTPS URLs pointing to Supabase storage
    try {
      const parsedUrl = new URL(imageUrl)
      if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname.endsWith('.supabase.co')) {
        return new Response(
          JSON.stringify({ error: 'Invalid image URL: only Supabase storage URLs are permitted' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid image URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate video duration for analysis
    if (mediaType === 'video' && duration && duration > 30) {
      return new Response(
        JSON.stringify({ 
          error: 'Video too long for analysis',
          message: language === 'da' 
            ? `Video er ${Math.round(duration)}s lang. AI-analyse er kun tilgængelig for videoer på maks 30 sekunder. Du kan stadig uploade og poste videoen.`
            : `Video is ${Math.round(duration)}s long. AI analysis is only available for videos up to 30 seconds. You can still upload and post the video.`,
          canUpload: true
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    
    if (!GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY not configured in environment')
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured. Please add GEMINI_API_KEY to your Supabase project secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('📸 Analyzing photo:', { imageUrl, tier })

    // Fetch image
    const imageResponse = await fetch(imageUrl)
    
    if (!imageResponse.ok) {
      console.error('❌ Failed to fetch image:', imageResponse.status, imageResponse.statusText)
      throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`)
    }
    
    const rawImageBuffer = await imageResponse.arrayBuffer()

    // Determine MIME type from Content-Type header (most reliable for signed URLs)
    const contentTypeHeader = imageResponse.headers.get('content-type') || ''
    let mimeType = contentTypeHeader.split(';')[0].trim()
    if (!mimeType) {
      mimeType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg'
    }

    // Resize large images to ≤1024px before sending to Gemini (cuts token cost up to 12×)
    const { buffer: imageBuffer, mimeType: resizedMimeType } = await resizeForGemini(rawImageBuffer, mimeType)
    mimeType = resizedMimeType

    const imageSizeKB = Math.round(imageBuffer.byteLength / 1024)
    // Prefer client-supplied dimensions (browser Image element is always accurate).
    // Fall back to server-side JPEG/PNG binary parsing.
    const parsedDimensions = getImageDimensions(imageBuffer)
    const imageDimensions = (clientWidth && clientHeight)
      ? { width: clientWidth, height: clientHeight }
      : parsedDimensions
    console.log('📐 Image dimensions:', imageDimensions, clientWidth ? '(from client)' : '(from binary parser)')
    
    // Check if media is too large for API payload
    const maxSizeBytes = mediaType === 'video' ? 10 * 1024 * 1024 : 4 * 1024 * 1024 // 10MB for videos, 4MB for images
    if (imageBuffer.byteLength > maxSizeBytes) {
      const maxLabel = mediaType === 'video' ? '10MB' : '4MB'
      console.error(`❌ ${mediaType} too large: ${imageSizeKB}KB (max ${maxLabel})`)
      return new Response(
        JSON.stringify({
          error: 'Media too large',
          message: language === 'da'
            ? `${mediaType === 'video' ? 'Videoen' : 'Billedet'} er for stort (${imageSizeKB}KB). Upload venligst ${mediaType === 'video' ? 'en video under 10MB' : 'et billede under 4MB'}.`
            : `${mediaType === 'video' ? 'Video' : 'Image'} too large (${imageSizeKB}KB). Please upload ${mediaType === 'video' ? 'a video under 10MB' : 'an image under 4MB'}.`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Convert to base64
    const bytes = new Uint8Array(imageBuffer)
    let binary = ''
    const chunkSize = 0x8000
    
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
      binary += String.fromCharCode.apply(null, Array.from(chunk))
    }
    
    const base64Image = btoa(binary)

    console.log(`📦 Media prepared: ${imageSizeKB}KB, MIME: ${mimeType}`)

    // Derive analysis level from tier:
    //   basic (Free)     → simple prompt, max 2 suggestions  (cost-efficient)
    //   advanced (Smart) → two-call split, max 3 suggestions
    //   premium (Pro)    → two-call split, max 6 suggestions
    const analysisLevel = tier === 'free' ? 'basic' : tier === 'premium' ? 'premium' : 'advanced'
    const suggestionCap = analysisLevel === 'basic' ? 2 : analysisLevel === 'premium' ? 6 : 3
    // PROMPT_VERSION=simple env var overrides for testing (set in Supabase dashboard, no redeploy needed)
    const promptVersion = Deno.env.get('PROMPT_VERSION') // 'simple' | undefined
    const useSimple = promptVersion === 'simple' || analysisLevel === 'basic'
    console.log('🔧 Analysis level:', analysisLevel, '— prompt:', useSimple ? 'simple' : 'two-call', '— cap:', suggestionCap)
    const model = 'gemini-2.5-flash'
    const promptParams = { postText, businessType, imageWidth: imageDimensions?.width, imageHeight: imageDimensions?.height, mediaType }

    // ── Simple / free path: single call (unchanged behaviour) ────────────────
    let rawParsed: any
    let call1Suggestions: Suggestion[] = []

    if (useSimple) {
      const { systemPrompt, userPrompt } = buildSimplePrompt(language, promptParams)
      const responseText = await callGemini(GEMINI_API_KEY, model, systemPrompt, userPrompt, base64Image, mimeType)
      console.log(`🔍 Simple response (first 300 chars):`, responseText.substring(0, 300))
      rawParsed = extractJson(responseText)
      const suggestionsRaw = Array.isArray(rawParsed.suggestions) ? rawParsed.suggestions : []
      call1Suggestions = suggestionsRaw
        .filter((s: any) => s && typeof s === 'object')
        .map((s: any) => ({
          id: String(s.id ?? crypto.randomUUID()),
          category: s.category,
          title: String(s.title ?? '').slice(0, 60),
          reason: String(s.reason ?? '').slice(0, 120),
          location: String(s.location ?? '').slice(0, 200),
          action: s.action,
        }))
        .filter((s: Suggestion) =>
          ['cleaning', 'color'].includes(s.category) &&
          (SUPPORTED_AI_EDIT_ACTIONS as readonly string[]).includes(s.action)
        )
        .slice(0, suggestionCap)
    } else {
      // ── Paid path: CALL 1 — Assessment ──────────────────────────────────────
      const { systemPrompt: sys1, userPrompt: user1 } = buildCall1Prompt(language, promptParams)
      const call1Text = await callGemini(GEMINI_API_KEY, model, sys1, user1, base64Image, mimeType)
      console.log(`🔍 Call 1 response (first 300 chars):`, call1Text.substring(0, 300))
      rawParsed = extractJson(call1Text)

      // ── Early-exit gates: skip Call 2 when AI edits are structurally impossible
      const skipCall2 =
        rawParsed.recommendation === 'retake' || // retake → suggestions must be []
        mediaType === 'video'                     // video → AI edits not applicable

      if (!skipCall2) {
        // ── Paid path: CALL 2 — AI Suggestion Prescription ────────────────────
        const call1Assessment = {
          recommendation: rawParsed.recommendation ?? 'good-enough',
          whatWorks: Array.isArray(rawParsed.whatWorks) ? rawParsed.whatWorks : [],
          generalFeedback: rawParsed.generalFeedback ?? '',
        }
        const { systemPrompt: sys2, userPrompt: user2 } = buildCall2Prompt(language, {
          ...promptParams,
          call1Assessment,
        })
        try {
          const call2Text = await callGemini(GEMINI_API_KEY, model, sys2, user2, base64Image, mimeType)
          console.log(`🔍 Call 2 response (first 300 chars):`, call2Text.substring(0, 300))
          const call2Parsed = extractJson(call2Text)
          const suggestionsRaw = Array.isArray(call2Parsed.suggestions) ? call2Parsed.suggestions : []
          call1Suggestions = suggestionsRaw
            .filter((s: any) => s && typeof s === 'object')
            .map((s: any) => ({
              id: String(s.id ?? crypto.randomUUID()),
              category: s.category,
              title: String(s.title ?? '').slice(0, 60),
              reason: String(s.reason ?? '').slice(0, 120),
              location: String(s.location ?? '').slice(0, 200),
              action: s.action,
            }))
            .filter((s: Suggestion) =>
              ['cleaning', 'color'].includes(s.category) &&
              (SUPPORTED_AI_EDIT_ACTIONS as readonly string[]).includes(s.action)
            )
            .slice(0, suggestionCap)
        } catch (call2Error) {
          // Graceful degradation: Call 1 result is still returned; suggestions are empty
          console.error('❌ Call 2 failed — proceeding with empty suggestions:', call2Error)
        }
      }
    }

    // ── Merge + normalise (shared by both paths) ─────────────────────────────
    let analysisResult: AnalysisResult

    try {
      const parsed = rawParsed
      const primarySuggestions = call1Suggestions

      // Normalize recommendation:
      // 1. quick-fix → good-enough if all suggestions were filtered out
      // 2. retake → good-enough ONLY if model self-contradicts:
      //    - whatWorks has 2+ entries with food-quality positive language, AND
      //    - generalFeedback does NOT itself justify retake with strong negatives
      //    (prevents override on dark/wrong-subject photos where even food words appear)
      const rawRec = parsed.recommendation ?? (primarySuggestions.length ? 'quick-fix' : 'post-it')
      const parsedWhatWorks: string[] = Array.isArray(parsed.whatWorks) ? parsed.whatWorks : []
      const whatWorksText = parsedWhatWorks.join(' ')
      const hasFoodPositive = /saftig|lækker|appetit|indbydende|tydeli|skarp|frisk|veltilberedt|appetitvækkende|appetising|juicy|delicious|inviting|clearly\s+visible|well.prepared|appealing/i.test(whatWorksText)
      const rawFeedback: string = parsed.generalFeedback ?? ''
      const feedbackJustifiesRetake = /nødvendigt\s+med\s+et\s+nyt|tag\s+et\s+nyt\s+foto|nyt\s+billede|for\s+mørkt|for\s+rodet|uidentificerbar|for\s+dark|for\s+cluttered|unidentifiable|needs\s+a\s+new|requires\s+a\s+new/i.test(rawFeedback)
      // Contamination guard: retake + poor/fair contentMatch = model used text mismatch to justify retake.
      // A technically good photo with wrong caption must never be retake — max quick-fix.
      const contentMatchRating = typeof parsed.contentMatch?.rating === 'string' ? parsed.contentMatch.rating : ''
      const retakeContaminatedByTextMismatch =
        rawRec === 'retake' && (contentMatchRating === 'poor' || contentMatchRating === 'fair')
      const retakeOverridden =
        retakeContaminatedByTextMismatch ||
        (rawRec === 'retake' && parsedWhatWorks.length >= 2 && hasFoodPositive && !feedbackJustifiesRetake)
      const normalizedRec =
        rawRec === 'quick-fix' && primarySuggestions.length === 0 ? 'good-enough' :
        retakeContaminatedByTextMismatch ? (primarySuggestions.length ? 'quick-fix' : 'good-enough') :
        retakeOverridden ? 'good-enough' :
        rawRec

      // Clean up generalFeedback:
      // - overridden retake: synthesize from whatWorks (model's text was retake-justification, discard it)
      // - genuine retake: strip sentences that leak contentMatch info (text/image mismatch)
      let generalFeedback = rawFeedback || (language === 'da' ? 'Billedet er ægte og indbydende.' : 'The image is authentic and inviting.')
      if (retakeOverridden) {
        const highlight = parsedWhatWorks[0] ?? ''
        const extra = parsedWhatWorks[1] ? ' ' + parsedWhatWorks[1] + '.' : '.'
        generalFeedback = language === 'da'
          ? `${highlight}.${extra} Stemningen og motivet er stærkt nok til et opslag.`
          : `${highlight}.${extra} The atmosphere and subject are strong enough to post.`
      } else if (normalizedRec === 'retake') {
        const sentences = generalFeedback.split(/(?<=[.!?])\s+/)
        const cleaned = sentences
          .filter(s => !/(slet ikke overens|stemmer ikke overens|stemmer .* ikke|teksten|does not match|doesn't match|text says|caption|post text)/i.test(s))
          .join(' ').trim()
        generalFeedback = cleaned || (language === 'da'
          ? 'Billedet er taget med engagement og omtanke.'
          : 'The image shows care and intention.')
      }

      const fallbackRecommendationText = primarySuggestions.length
        ? 'Små fixes gør det markant skarpere.'
        : 'Post det! Det ser lækkert ud.'
      const recommendationText = retakeOverridden
        ? (language === 'da' ? 'Et troværdigt billede klar til opslag.' : 'A usable shot ready to post.')
        : (parsed.recommendationText ?? fallbackRecommendationText)

      analysisResult = {
        contentMatch: (() => {
          const cm = parsed.contentMatch ?? { rating: 'good', feedback: language === 'da' ? 'Billedet matcher teksten rimeligt godt.' : 'The image matches the text reasonably well.' }
          // Server-side fallback: derive actionNeeded if model omitted it
          const rating = cm.rating ?? 'good'
          const actionNeeded = cm.actionNeeded ?? (rating === 'poor' ? 'choice' : rating === 'fair' ? 'rewrite' : 'none')
          return {
            rating,
            feedback: cm.feedback ?? '',
            rewriteSuggestion: actionNeeded !== 'none' ? (cm.rewriteSuggestion ?? null) : null,
            reshootGuidance: actionNeeded === 'choice' ? (cm.reshootGuidance ?? null) : null,
            actionNeeded,
          }
        })(),
        emojiMatch: parsed.emojiMatch ?? null,
        whatWorks: parsedWhatWorks.length ? parsedWhatWorks : ['God stemning', 'Autentisk øjeblik'],
        generalFeedback,
        suggestions: primarySuggestions,
        humanSuggestions: Array.isArray(parsed.humanSuggestions) ? parsed.humanSuggestions : [],
        recommendation: normalizedRec,
        recommendationText,
        platformNote: parsed.platformNote,
      } satisfies AnalysisResultPaid

      // ✅ INCREMENT USAGE AFTER SUCCESSFUL ANALYSIS (not on parse failure)
      await incrementQuota(userId, 'aiGenerations')

    } catch (parseError) {
      console.error('❌ Failed to parse/normalise analysis result:', parseError)
      analysisResult = {
        contentMatch: { rating: 'good', feedback: language === 'da' ? 'AI analysen fejlede. Prøv igen.' : 'AI analysis failed. Please try again.', rewriteSuggestion: null, reshootGuidance: null, actionNeeded: 'none' },
        emojiMatch: null,
        whatWorks: [],
        generalFeedback: 'Der skete en fejl i analysen. Prøv venligst igen.',
        suggestions: [],
        humanSuggestions: [],
        recommendation: 'good-enough',
        recommendationText: 'Prøv igen om et øjeblik.',
      }
    }

    console.log(`✅ Photo analysis complete for user ${userId} (tier: ${tier})`)

    return new Response(
      JSON.stringify(analysisResult),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Error analyzing photo:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to analyze photo'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
