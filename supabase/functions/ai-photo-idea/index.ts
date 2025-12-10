/// <reference path="./deno.d.ts" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// System prompt for photo suggestions
const PHOTO_SYSTEM_PROMPT = `You are Post2Grow AI.
Your job is to suggest one practical, slightly insightful photo idea that feels personal and helpful.
Write as if you're speaking directly to the user, using "du" (you).

Format: "Tag et billede af [specific item], [reason why this helps the post work better]"

Example structure:
"Tag et billede af den ret fra julemenuen, som flest kunder vil genkende — så forstår de hurtigt, hvad opslaget handler om."

You may use:
- the dish/product/service mentioned
- the business category
- basic business info

Your suggestion must include one small practical insight, such as:
- "så forstår de hurtigt, hvad opslaget handler om"
- "så ser kunderne med det samme, hvad der er nyt"
- "så genkender de det, de kender fra sidst"
- "så kan de se forskellen med det samme"
- "så får de lyst til at vide mere"

You must NOT:
- invent menu items
- add atmosphere or style
- describe lighting or mood
- mention people
- be creative or promotional
- describe props, colors, decorations

Always start with "Tag et billede af..." and keep it warm and personal in Danish.`

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get request data
    const { 
      text,
      headline = '',
      businessCategory = '',
      businessName = '',
      language = 'da'
    } = await req.json()

    // Validate input
    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: text' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Generating photo idea for text:', text)

    // Build context
    let businessContext = ''
    if (businessName) {
      businessContext += `Business: ${businessName}\n`
    }
    if (businessCategory) {
      businessContext += `Category: ${businessCategory}\n`
    }

    // Build user message
    const userMessage = `${businessContext ? businessContext + '\n' : ''}${headline ? 'Headline: ' + headline + '\n' : ''}Text: ${text}

Suggest one practical photo idea that fits this post.
Write it in a warm, personal tone using "Tag et billede af..." format.
Include a practical reason why this specific photo will help the post work better.
Keep it simple and helpful in Danish.`

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: PHOTO_SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.3,
        max_tokens: 80
      })
    })

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json()
      console.error('OpenAI API error:', errorData)
      throw new Error('Failed to generate photo idea')
    }

    const openaiData = await openaiResponse.json()
    const photoIdea = openaiData.choices[0]?.message?.content?.trim()

    if (!photoIdea) {
      throw new Error('No photo idea generated')
    }

    console.log('Generated photo idea:', photoIdea)

    return new Response(
      JSON.stringify({ photoIdea }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
