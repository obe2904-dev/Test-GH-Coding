import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getUserIdFromAuth, getUserQuota, incrementQuota } from '../_shared/quota-utils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AnalyzePhotoRequest {
  imageUrl: string
  postText?: string
  businessType?: string
  language?: string
  tier?: 'free' | 'standardplus' | 'premium'
}

interface AnalysisResultPaid {
  contentMatch: {
    score: number
    rating: 'excellent' | 'good' | 'fair' | 'poor'
    feedback: string
  }
  suggestions: {
    composition: string[]
    lighting: string[]
    styling: string[]
    subject: string[]
  }
  improvements: {
    category: 'crop' | 'lighting' | 'color' | 'cleanup'
    title: string
    description: string
    impact: 'high' | 'medium' | 'low'
  }[]
  overallScore: number
}

interface AnalysisResultFree {
  overallFeedback: string
  quickTips: string[]
  improvementCategories?: ('lighting' | 'composition' | 'background' | 'contrast')[]
}

type AnalysisResult = AnalysisResultPaid | AnalysisResultFree

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

    const { imageUrl, postText, businessType, language = 'da', tier = dailyQuota.tier }: AnalyzePhotoRequest = await req.json()

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'imageUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('📸 Analyzing photo:', { imageUrl, postText: postText?.substring(0, 50), businessType, language, tier })

    // Fetch the image and convert to base64
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      throw new Error('Failed to fetch image')
    }
    const imageBuffer = await imageResponse.arrayBuffer()
    
    // Convert to base64 without causing stack overflow for large images
    const bytes = new Uint8Array(imageBuffer)
    let binary = ''
    const chunkSize = 0x8000 // 32KB chunks to avoid stack overflow
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize)
      binary += String.fromCharCode.apply(null, Array.from(chunk))
    }
    const base64Image = btoa(binary)

    // Build the analysis prompt based on tier
    let systemPrompt: string
    let userPrompt: string

    if (tier === 'free') {
      // Simplified analysis for Free tier - two-part feedback
      systemPrompt = language === 'da'
        ? `Du er en professionel fotograf der analyserer billeder til social media.

VIGTIGE REGLER:
- Du beskriver KUN billedet og mulige forbedringer – du REDIGERER ikke billedet.
- Du må ALDRIG skrive, at billedet allerede er redigeret eller ændret.
- Brug formuleringer som "du kan...", "det vil hjælpe at..." – ikke "vi har..." eller "billedet bliver...".
- Dine forslag skal være nænsomme og realistiske (små justeringer af lys, beskæring, baggrunds-rod osv.) – ikke kunstige effekter eller store manipulationer. Ingen genererede elementer.

- Dit svar skal ALTID starte med bulletpoint 1 (positiv vurdering)
- Dit svar skal ALTID have bulletpoint 2 (forbedringsforslag)
- Dit svar skal KUN have bulletpoint 3 hvis billedet IKKE matcher teksten

BULLETPOINT 1 - DETALJERET POSITIV VURDERING OM SELVE BILLEDET (obligatorisk, mindst 2-3 sætninger):
Start med "• " (vigtigt: bulletpoint + mellemrum) efterfulgt af en DETALJERET positiv vurdering af BILLEDETS VISUELLE KVALITETER. Beskriv FLERE aspekter:
- Komposition og billedopbygning
- Lysforhold og stemning
- Farvepalette og kontrast
- Hvad der gør billedet visuelt tiltalende
- Følelsen eller atmosfæren det skaber
Giv en fyldig, substantiel beskrivelse - ikke bare "fine farver".
VIGTIGT: Fokuser KUN på billedet som foto - ikke på match med teksten.

BULLETPOINT 2 - TEKNISKE FORBEDRINGSFORSLAG (obligatorisk):
Start på ny linje med "• " (bulletpoint + mellemrum) efterfulgt af 1-3 konkrete TEKNISKE forslag til hvordan billedet kan forbedres (bedre lys, beskæring, vinkel, baggrund, etc.).
VIGTIGT: Fokuser KUN på forbedringer af selve BILLEDET - nævn IKKE om det matcher eller ikke matcher teksten her.

BULLETPOINT 3 - MISMATCH NOTE (kun hvis billedet IKKE matcher teksten):
Start på ny linje med "• " (bulletpoint + mellemrum) efterfulgt af PRÆCIS denne formulering: "Billedet viser [hvad du ser], mens teksten handler om [tekstens emne]. Overvej et billede der matcher bedre."
VIGTIGT: Denne bulletpoint handler KUN om match mellem billede og tekst - ikke tekniske forbedringer.
UDELAD HELT denne bulletpoint hvis billedet matcher teksten godt.`
        : `You are a professional photographer analyzing images for social media.

IMPORTANT RULES:
- You ONLY describe the image and possible improvements – you do NOT edit the image.
- You must NEVER write that the image has already been edited or changed.
- Use phrasing like "you can...", "it would help to..." – not "we have..." or "the image will be...".
- Your suggestions must be gentle and realistic (small adjustments to lighting, cropping, background clutter, etc.) – not artificial effects or major manipulations. No generated elements.

- Your response must ALWAYS start with bullet point 1 (positive assessment)
- Your response must ALWAYS have bullet point 2 (improvement suggestions)
- Your response should ONLY have bullet point 3 if the image does NOT match the text

BULLET POINT 1 - DETAILED POSITIVE ASSESSMENT (mandatory, at least 2-3 sentences):
Start with "•" followed by a DETAILED positive assessment of the photo. Describe MULTIPLE aspects:
- Composition and image structure
- Lighting conditions and mood
- Color palette and contrast
- What makes the image visually appealing
- The feeling or atmosphere it creates
Give a substantial, rich description - not just "nice colors".

BULLET POINT 2 - IMPROVEMENT SUGGESTIONS (mandatory):
Start with "•" followed by 1-3 concrete suggestions for how the photo can be improved for social media (better lighting, cropping, angle, etc.).

BULLET POINT 3 - MISMATCH NOTE (only if relevant):
Start with "•" followed by: "The image shows [what you see], while the text is about [text topic]. Consider an image that matches better."
SKIP THIS if the image matches the text well.`

      userPrompt = language === 'da'
        ? `Analyser dette billede til et social media opslag.`
        : `Analyze this image for a social media post.`

      if (postText) {
        userPrompt += language === 'da'
          ? `\n\nTeksten siger: "${postText}"\n\nKRITISK: Følg NØJAGTIGT denne struktur:
1. Start med "• " (bulletpoint + mellemrum) efterfulgt af detaljeret positiv vurdering af BILLEDET
2. Ny linje, derefter "• " (bulletpoint + mellemrum) efterfulgt af forbedringsforslag
3. KUN hvis mismatch: Ny linje, derefter "• " (bulletpoint + mellemrum) efterfulgt af mismatch note

FORKERT eksempel (mangler bulletpoint):
"Billedet matcher ikke teksten..."

KORREKT eksempel:
"• Billedet har..."`
          : `\n\nThe text says: "${postText}"\n\nCRITICAL: Follow this structure EXACTLY:
1. Start with "• " (bullet point + space) followed by detailed positive assessment of the PHOTO
2. New line, then "• " (bullet point + space) followed by improvement suggestions
3. ONLY if mismatch: New line, then "• " (bullet point + space) followed by mismatch note

WRONG example (missing bullet point):
"The image doesn't match the text..."

CORRECT example:
"• The image has..."`
      } else {
        userPrompt += language === 'da'
          ? `\n\nIngen tekst inkluderet. Giv præcis 2 bulletpoints:
1. "• " efterfulgt af detaljeret positiv vurdering
2. "• " efterfulgt af forbedringsforslag`
          : `\n\nNo text included. Give exactly 2 bullet points:
1. "• " followed by detailed positive assessment
2. "• " followed by improvement suggestions`
      }

      userPrompt += language === 'da'
        ? `\n\nUd over "overallFeedback" skal du også udfylde:
- "quickTips": en liste (2-4) helt korte, konkrete tips i stil med "Gå tættere på motivet", "Drej retten lidt mod lyset".
- "improvementCategories": en liste over de vigtigste områder der kan forbedres. Vælg kun mellem: "lighting", "composition", "background", "contrast".

Giv din analyse i dette JSON format (brug \\n for linjeskift mellem bulletpoints):
{
  "overallFeedback": "• [DETALJERET positiv vurdering - mindst 2-3 sætninger]\\n• [Forbedringsforslag]\\n• [Kun hvis mismatch] Note om mismatch",
  "quickTips": ["kort tip 1", "kort tip 2"],
  "improvementCategories": ["lighting", "composition"]
}

EKSEMPEL PÅ GOD OUTPUT (når billede matcher tekst):
"• Billedet har en varm og indbydende komposition med rig farvekontrast mellem de gyldne toner i baggrunden og de friske grønne detaljer. Belysningen skaber dybde og fremhæver teksturerne effektivt, hvilket giver en appetitlig følelse. Den centrale placering af motivet trækker blikket naturligt, og den bløde fokus i baggrunden skaber en professionel og indbydende stemning der fungerer godt på sociale medier.\\n• Prøv at komme lidt tættere på for at vise detaljerne endnu tydeligere, og overvej at justere vinklen en smule for at undgå refleksioner."

EKSEMPEL PÅ GOD OUTPUT (når billede IKKE matcher tekst):
"• Billedet har en elegant og ren komposition med bløde pastellfarver der skaber en rolig og indbydende atmosfære. Den naturlige belysning fra siden giver dybde og fremhæver teksturerne smukt. Farverne harmonerer godt og skaber en behagelig visuel oplevelse, og den simple styling gør billedet let at opfatte på en mobil skærm.\\n• Beskær billedet tættere på hovedmotivet for at fjerne distraherende elementer i baggrunden, og overvej at justere hvidbalancen en smule for varmere toner.\\n• Billedet viser en dessert, mens teksten handler om burger og fritter. Overvej et billede der matcher bedre."

FORKERT OUTPUT (nævner mismatch i bulletpoint 2):
"• Billedet har flotte farver.\\n• Billedet viser ikke en burger som beskrevet i teksten. Beskær tættere."
HVORFOR FORKERT: Bulletpoint 2 må IKKE nævne tekstmatch - det hører til bulletpoint 3.`
        : `\n\nIn addition to "overallFeedback" you must also fill:
- "quickTips": a list (2-4) of very short, concrete tips like "Move closer to the subject", "Turn the plate slightly towards the light".
- "improvementCategories": a list of the most relevant areas to improve. Only choose from: "lighting", "composition", "background", "contrast".

Provide your analysis in this JSON format (use \\n for line breaks between bullet points):
{
  "overallFeedback": "• [DETAILED positive assessment - at least 2-3 sentences]\\n• [Improvement suggestions]\\n• [Only if mismatch] Mismatch note",
  "quickTips": ["short tip 1", "short tip 2"],
  "improvementCategories": ["lighting", "composition"]
}

EXAMPLE OF GOOD OUTPUT (when image matches text):
"• The image has a warm and inviting composition with rich color contrast between the golden tones in the background and fresh green details. The lighting creates depth and effectively highlights the textures, giving an appetizing feeling. The central placement of the subject naturally draws the eye, and the soft background focus creates a professional and inviting mood that works well on social media.\\n• Try getting a bit closer to show the details even more clearly, and consider adjusting the angle slightly to avoid reflections."

EXAMPLE OF GOOD OUTPUT (when image does NOT match text):
"• The image has an elegant and clean composition with soft pastel colors that create a calm and inviting atmosphere. The natural side lighting gives depth and beautifully highlights the textures. The colors harmonize well and create a pleasant visual experience, and the simple styling makes the image easy to perceive on a mobile screen.\\n• The lighting could be slightly more even to avoid harsh shadows on the right, and consider adjusting the white balance slightly for warmer tones.\\n• The image shows a dessert, while the text is about burgers and fries. Consider an image that matches better."`
    } else {
      // Detailed analysis for Smart/Pro tiers
      systemPrompt = language === 'da' 
        ? `Du er en professionel social media billedekspert. Analyser dette billede og giv konstruktiv feedback om hvordan det kan forbedres til social media opslag.`
        : `You are a professional social media image expert. Analyze this image and provide constructive feedback on how it can be improved for social media posts.`

      userPrompt = language === 'da'
        ? `Analyser dette billede til et social media opslag.`
        : `Analyze this image for a social media post.`

      if (postText) {
        userPrompt += language === 'da'
          ? `\n\nOpslaget handler om: "${postText}"\n\nVurder hvor godt billedet matcher indholdet.`
          : `\n\nThe post is about: "${postText}"\n\nEvaluate how well the image matches the content.`
      }

      if (businessType) {
        userPrompt += language === 'da'
          ? `\nVirksomhedstype: ${businessType}`
          : `\nBusiness type: ${businessType}`
      }

      userPrompt += language === 'da'
        ? `\n\nGiv din analyse i dette JSON format:
{
  "contentMatch": {
    "score": <0-100>,
    "rating": "excellent|good|fair|poor",
    "feedback": "Kort forklaring"
  },
  "suggestions": {
    "composition": ["forslag 1", "forslag 2"],
    "lighting": ["forslag 1", "forslag 2"],
    "styling": ["forslag 1"],
    "subject": ["forslag 1"]
  },
  "improvements": [
    {
      "category": "crop|lighting|color|cleanup",
      "title": "Kort titel",
      "description": "Beskrivelse af forbedring",
      "impact": "high|medium|low"
    }
  ],
  "overallScore": <0-100>
}`
      : `\n\nProvide your analysis in this JSON format:
{
  "contentMatch": {
    "score": <0-100>,
    "rating": "excellent|good|fair|poor",
    "feedback": "Brief explanation"
  },
  "suggestions": {
    "composition": ["suggestion 1", "suggestion 2"],
    "lighting": ["suggestion 1", "suggestion 2"],
    "styling": ["suggestion 1"],
    "subject": ["suggestion 1"]
  },
  "improvements": [
    {
      "category": "crop|lighting|color|cleanup",
      "title": "Short title",
      "description": "Description of improvement",
      "impact": "high|medium|low"
    }
  ],
  "overallScore": <0-100>
}`
    }

    // Call Gemini 2.0 Flash API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `${systemPrompt}\n\n${userPrompt}`
                },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: base64Image
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          }
        })
      }
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('Gemini API error:', errorText)
      throw new Error(`Gemini API request failed: ${geminiResponse.status}`)
    }

    const geminiData = await geminiResponse.json()
    console.log('Gemini response:', JSON.stringify(geminiData, null, 2))

    // Extract the text response
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
    if (!responseText) {
      throw new Error('No response from Gemini')
    }

    // Parse JSON from response (handle markdown code blocks if present)
    let analysisResult: AnalysisResult
    try {
      const jsonMatch = responseText.match(/```json\s*(\{[\s\S]*\})\s*```/) || responseText.match(/(\{[\s\S]*\})/)
      const jsonString = jsonMatch ? jsonMatch[1] : responseText
      analysisResult = JSON.parse(jsonString)
    } catch (parseError) {
      console.error('Failed to parse Gemini response as JSON:', responseText)
      throw new Error('Failed to parse analysis result')
    }

    console.log('✅ Analysis complete:', analysisResult)

    // ✅ INCREMENT USAGE AFTER SUCCESSFUL ANALYSIS
    await incrementQuota(userId, 'aiGenerations')
    
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
