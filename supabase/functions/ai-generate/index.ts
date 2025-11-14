import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get request data
    const { 
      topic, 
      businessType, 
      platforms,
      includeEmojis = true,
      includeHashtags = true,
      includeCTA = true,
      tone = 'objective', // Free users always get objective
      length = 'medium'   // Free users always get medium
    } = await req.json()

    // Validate input
    if (!topic || !businessType || !platforms) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: topic, businessType, platforms' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Generating content for:', { topic, businessType, platforms, includeEmojis, includeHashtags, includeCTA })

    // Build platform-specific instructions
    const platformInstructions = platforms.map(platform => {
      if (platform === 'instagram') {
        return `
- Instagram: 50-125 characters, ${includeEmojis ? '5-8 emojis' : 'no emojis'}, ${includeHashtags ? '10-15 hashtags' : 'no hashtags'}`
      } else if (platform === 'facebook') {
        return `
- Facebook: 150-250 characters, ${includeEmojis ? '2-3 emojis' : 'no emojis'}, ${includeHashtags ? '2-3 hashtags' : 'no hashtags'}`
      }
      return ''
    }).join('\n')

    // Tone mapping
    const toneDescriptions = {
      'objective': 'Objective, neutral, and informative',
      'warm': 'Warm, welcoming, and friendly',
      'passionate': 'Passionate, enthusiastic, and energetic'
    }

    // Call OpenAI API directly
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional social media copywriter for Danish small businesses. You write in a ${toneDescriptions[tone]} tone. You create engaging posts optimized for each platform.`
          },
          {
            role: 'user',
            content: `Create ONE social media post about: ${topic}

Business type: ${businessType}
Target platforms: ${platforms.join(', ')}
Tone: ${toneDescriptions[tone]}

Platform-specific requirements:
${platformInstructions}

Additional requirements:
- Write in Danish
${includeEmojis ? '- Include emojis as specified per platform' : '- DO NOT include any emojis'}
${includeHashtags ? '- Add hashtags as specified per platform' : '- DO NOT include any hashtags'}
${includeCTA ? '- Include a clear call-to-action' : '- No call-to-action needed'}

IMPORTANT: Create separate optimized versions for each platform.

Return ONLY valid JSON in this exact format:
{
  "variations": [
    {
      "id": 1,
      "platform": "facebook",
      "headline": "Engaging headline",
      "text": "Full post text optimized for Facebook (150-250 chars)",
      "hashtags": "${includeHashtags ? '#hashtag1 #hashtag2' : ''}",
      "cta": "${includeCTA ? 'Clear call to action' : ''}",
      "tone": "${tone}"
    },
    {
      "id": 2,
      "platform": "instagram", 
      "headline": "Catchy headline",
      "text": "Shorter post text for Instagram (50-125 chars)",
      "hashtags": "${includeHashtags ? '#hashtag1 #hashtag2 ... (10-15 hashtags)' : ''}",
      "cta": "${includeCTA ? 'Clear call to action' : ''}",
      "tone": "${tone}"
    }
  ]
}

Only include variations for the selected platforms: ${platforms.join(', ')}`
          }
        ],
        temperature: 0.8,
        max_tokens: 1500,
        response_format: { type: 'json_object' }
      })
    })

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text()
      console.error('OpenAI API error:', error)
      return new Response(
        JSON.stringify({ error: 'OpenAI API request failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await openaiResponse.json()
    const content = data.choices[0].message.content

    console.log('OpenAI response received')

    // Parse and return the variations
    const variations = JSON.parse(content)

    return new Response(
      JSON.stringify(variations),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in ai-generate function:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
