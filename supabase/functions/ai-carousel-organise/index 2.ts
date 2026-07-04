import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getUserIdFromAuth } from '../_shared/quota-utils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MediaItemInput {
  id: string
  url: string
  originalUrl?: string
  type: 'image' | 'video'
}

interface OrganiseRequest {
  mediaItems: MediaItemInput[]
  theme?: string
  goal?: string
  language?: string
}

interface OrganiseResponse {
  suggestedOrder: number[]
  coverIndex: number
  flaggedSkipIndices: number[]
  flaggedReasons: string[]
  rationale: string
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate auth
    const userId = await getUserIdFromAuth(req)
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Ikke autoriseret' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body: OrganiseRequest = await req.json()
    const { mediaItems, theme, goal, language = 'da' } = body

    if (!mediaItems || mediaItems.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Mindst 2 billeder kræves' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    // Build image parts for Gemini — only images (skip video entries)
    const imageParts: { inlineData?: { mimeType: string; data: string }; text?: string }[] = []
    const validIndices: number[] = []

    for (let i = 0; i < mediaItems.length; i++) {
      const item = mediaItems[i]
      if (item.type === 'video') {
        imageParts.push({ text: `[Foto ${i + 1}: Video — kan ikke analyseres visuelt]` })
        validIndices.push(i)
        continue
      }

      const imageUrl = item.originalUrl || item.url
      try {
        const response = await fetch(imageUrl)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const buffer = await response.arrayBuffer()
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
        const contentType = response.headers.get('content-type') || 'image/jpeg'
        const mimeType = contentType.split(';')[0].trim()
        imageParts.push({ text: `[Foto ${i + 1}]` })
        imageParts.push({ inlineData: { mimeType, data: base64 } })
        validIndices.push(i)
      } catch {
        imageParts.push({ text: `[Foto ${i + 1}: Kunne ikke indlæses]` })
        validIndices.push(i)
      }
    }

    const themeLabel = theme ? `Tema: ${theme}` : 'Intet specifikt tema'
    const goalLabel = goal ? `Mål: ${goal}` : 'Intet specifikt mål'
    const isEnglish = language.startsWith('en')

    const systemPrompt = isEnglish
      ? `You are an expert social media visual storyteller for restaurants and food businesses.
Your task: organise a set of carousel photos into the most compelling order for an Instagram/Facebook carousel post.`
      : `Du er ekspert i visuel storytelling på sociale medier for restauranter og fødevarevirksomheder.
Din opgave: Organiser et sæt karrusel-fotos i den mest overbevisende rækkefølge til et Instagram/Facebook karrusel-opslag.`

    const userPrompt = isEnglish
      ? `Theme: ${themeLabel}
Goal: ${goalLabel}

I have ${mediaItems.length} photos (numbered 1–${mediaItems.length}). Analyse each image and suggest:
1. The best order to show them (first photo is the hook — makes people swipe)
2. Which photo should be the cover (index in the suggested order, 0-based)
3. Which photos (if any) should be skipped (poor quality, irrelevant, duplicate) — list by ORIGINAL index (0-based)
4. A brief reason for each flagged photo
5. A 1-sentence rationale for the suggested order

Respond ONLY with valid JSON matching this schema:
{
  "suggestedOrder": [0, 2, 1, 3],   // original indices in display order
  "coverIndex": 0,                   // index IN suggestedOrder (0-based)
  "flaggedSkipIndices": [],          // original indices to skip (may be empty)
  "flaggedReasons": [],              // one reason string per flagged index
  "rationale": "..."
}`
      : `Tema: ${themeLabel}
Mål: ${goalLabel}

Jeg har ${mediaItems.length} fotos (nummereret 1–${mediaItems.length}). Analysér hvert billede og foreslå:
1. Den bedste rækkefølge at vise dem (første foto er krogen — får folk til at swipe)
2. Hvilket foto der skal være cover (indeks i den foreslåede rækkefølge, 0-baseret)
3. Hvilke fotos (hvis nogen) der bør springes over (dårlig kvalitet, irrelevante, duplikater) — angiv som ORIGINAL indeks (0-baseret)
4. En kort begrundelse for hvert markeret foto
5. En 1-sætnings begrundelse for den foreslåede rækkefølge

Svar KUN med gyldig JSON svarende til dette skema:
{
  "suggestedOrder": [0, 2, 1, 3],   // originale indekser i visningsrækkefølge
  "coverIndex": 0,                   // indeks I suggestedOrder (0-baseret)
  "flaggedSkipIndices": [],          // originale indekser der bør springes (kan være tom)
  "flaggedReasons": [],              // én begrundelse pr. markeret indeks
  "rationale": "..."
}`

    const geminiPayload = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt + '\n\n' + userPrompt },
            ...imageParts,
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 512,
        responseMimeType: 'application/json',
      },
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload),
      }
    )

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      throw new Error(`Gemini error: ${geminiRes.status} — ${errText}`)
    }

    const geminiData = await geminiRes.json()
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    let parsed: OrganiseResponse
    try {
      parsed = JSON.parse(rawText)
    } catch {
      // Attempt to extract JSON from markdown fences
      const match = rawText.match(/```(?:json)?\s*([\s\S]+?)```/)
      parsed = match ? JSON.parse(match[1]) : { suggestedOrder: validIndices, coverIndex: 0, flaggedSkipIndices: [], flaggedReasons: [], rationale: '' }
    }

    // Validate and clamp indices
    const n = mediaItems.length
    const safeOrder = Array.isArray(parsed.suggestedOrder) && parsed.suggestedOrder.length === n
      ? parsed.suggestedOrder.map((i: number) => Math.max(0, Math.min(n - 1, i)))
      : validIndices
    const safeCover = typeof parsed.coverIndex === 'number'
      ? Math.max(0, Math.min(safeOrder.length - 1, parsed.coverIndex))
      : 0
    const safeSkip = Array.isArray(parsed.flaggedSkipIndices)
      ? parsed.flaggedSkipIndices.filter((i: number) => i >= 0 && i < n)
      : []
    const safeReasons = Array.isArray(parsed.flaggedReasons)
      ? parsed.flaggedReasons.slice(0, safeSkip.length)
      : []

    const result: OrganiseResponse = {
      suggestedOrder: safeOrder,
      coverIndex: safeCover,
      flaggedSkipIndices: safeSkip,
      flaggedReasons: safeReasons,
      rationale: typeof parsed.rationale === 'string' ? parsed.rationale : '',
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('ai-carousel-organise error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Ukendt fejl' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
