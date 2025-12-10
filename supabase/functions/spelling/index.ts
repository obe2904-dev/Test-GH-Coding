// @ts-ignore - Deno import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// @ts-ignore - Deno global
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: any) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text, language: languageInput = 'auto' } = await req.json()

    // Local heuristic language detector for 'auto' mode
    function detectLanguage(s: string): 'da' | 'en' {
      if (!s || typeof s !== 'string') return 'en'
      const sample = s.toLowerCase()
      if (/[æøåÆØÅ]/.test(sample)) return 'da'
      const danishWords = [' og ', ' det ', ' en ', ' der ', ' på ', ' til ', ' med ', ' ikke ', ' er ']
      let score = 0
      for (const w of danishWords) if (sample.includes(w)) score++
      if (score >= 2) return 'da'
      return 'en'
    }

    const language = (languageInput === 'auto') ? detectLanguage(text) : languageInput

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing required field: text' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const system = `You are a professional spelling and grammar assistant. Correct the user's text for spelling, grammar and punctuation while preserving meaning, intent and formatting. Do NOT return any code blocks or runnable code. Return ONLY the corrected text as plain text in the response message.`

    const userPrompt = `Please correct the following text${language && language !== 'auto' ? ` (language: ${language})` : ''} and return only the corrected text.\n\n---INPUT START---\n${text}\n---INPUT END---\n\nDo not add commentary or analysis.`

    const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Fast and cheap for spelling checks (tier-based upgrade planned)
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3, // Lower temperature for consistent spelling corrections
        max_completion_tokens: 1200
      })
    })

    if (!openaiResp.ok) {
      const err = await openaiResp.text()
      console.error('OpenAI error (spelling):', err)
      return new Response(
        JSON.stringify({ error: 'OpenAI API request failed' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await openaiResp.json()
    const content = data?.choices?.[0]?.message?.content

    if (!content || typeof content !== 'string') {
      return new Response(
        JSON.stringify({ error: 'OpenAI returned unexpected response' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ corrected: content.trim() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Error in spelling function:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
