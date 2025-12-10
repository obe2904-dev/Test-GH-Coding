import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getToneDescription, getHashtagGuidance } from './tone-cards.ts'
import { generateHashtags, applyPostProcessing } from './modules/hashtags.ts'
import { resolveEmojiPolicy, enforceEmojiPolicy } from './modules/emojis.ts'
import { resolveLocaleConfig } from './modules/locales.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Centralized AI model configuration
const AI_MODELS = {
  enhancement: {
    'free': 'gpt-4o-mini',
    'standardplus': 'gpt-4o',
    'premium': 'gpt-4o',
  }
} as const

function getAIModelForTier(userTier?: string): string {
  return AI_MODELS.enhancement[userTier as keyof typeof AI_MODELS.enhancement] || 'gpt-4o-mini'
}

// System prompts by tier
const SYSTEM_PROMPTS = {
  free: `You are Post2Grow AI: a helpful assistant for small local businesses (cafés, restaurants, salons, clinics, shops).
Your job is to improve the user's text so it becomes clearer, more engaging, and naturally phrased — while keeping it simple and authentic.

IMPORTANT: If the user's text is gibberish, random characters, or has no clear meaning, return an error message: "error:meaningless_input"
Do NOT create new content when the input is nonsensical. Do NOT generate placeholder text.
Only improve text that has actual meaning and intent.

CRITICAL SPELLING RULES:
1. FIX typos and misspellings (e.g., "juhemeneu" → "julemenu", "resturant" → "restaurant")
2. PRESERVE correctly spelled words exactly as written
3. Common Danish words to watch for: julemenu, restaurant, café, brunch, cocktail
4. If a word looks like a typo of a common word, fix it
5. If unsure whether it's a typo or intentional, fix common misspellings

You may:
- Make the text clearer and more natural
- Fix ALL grammar and spelling errors (this is critical!)
- Adjust tone to fit the business category (e.g., cafés: warm and inviting, restaurants: appealing and calm)
- Make the text slightly more engaging while keeping it authentic
- Use the business's basic information only to ensure accuracy

Do NOT:
- Change correctly spelled words into typos
- Invent new details, menu items, or services not mentioned by the user
- Add aggressive sales language or "come by" calls-to-action
- Create exaggerated descriptions or hype
- Make promotional claims the user didn't write

Keep it: friendly, simple, authentic, and appropriate for a small local business.`,
  standardplus: `You are Post2Grow AI: an expert social media copywriter for small local businesses.
Your job is to enhance posts with compelling storytelling, emotional hooks, and persuasive language while maintaining authenticity.

IMPORTANT RULES:
- Respect the user's input length: if they write 1-2 sentences, keep it 2-3 sentences maximum
- If they write 2-5 words, expand to 1-2 engaging sentences, NOT a full paragraph
- Make it engaging and emotional, but keep it concise and scannable
- Add storytelling elements, but don't go overboard with flowery language
- Use persuasive language, but keep it authentic and relatable

Example transformations:
- "ny menu" → 2-3 sentences about the new menu being ready with enticing details
- "åben i dag" → 1-2 sentences creating excitement about being open
- Short paragraph → Enhance it to 1-2 paragraphs maximum

Do NOT write essay-length content. Social media posts should be concise and impactful.`,
  premium: `You are Post2Grow AI: a pro social media strategist. Create highly engaging, conversion-optimized content with sophisticated storytelling, psychological triggers, and brand voice consistency.`
}

interface EnhancementInstructionSet {
  text: string
}

const ENHANCEMENT_INSTRUCTIONS: Record<string, EnhancementInstructionSet> = {
  free: {
    text: `- Keep the post to 1–2 concise sentences that clarify the user's idea.
- Use a warm, trustworthy tone that sounds like a local business owner.
- Add concrete details pulled from the user text; never invent offers or menu items.
- Do not add sales-heavy CTAs or any hashtags.
- Absolutely avoid emojis so the copy reads clean and professional.`
  },
  standardplus: {
    text: `- Expand short prompts into 2–3 vivid sentences that highlight benefits or atmosphere.
- Keep the language conversational and on-brand for the business category.
- Weave in sensory or service details when they help the story.
- Maintain authenticity—no exaggerated promises or aggressive sales language.`
  },
  premium: {
    text: `- Craft 2–3 sentences with narrative momentum, leading to a soft value-driven CTA when natural.
- Mirror the requested tone and brand cues while keeping copy scannable.
- Highlight differentiators, sensory cues, or social proof that drive conversions.
- Stay factual—never fabricate offers, prices, or availability.`
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get request data
    const { 
      text,
      headline,
      platforms = ['facebook'],
      includeEmojis = true,
      includeHashtags = true,
      userTier = 'free',
      language = 'da',
      businessProfile = null,
      skipClarification = false, // When true, skip clarification check
      hasPhoto = false, // Photo provides context
      clarificationContext = null // Additional context from clarification prompt
    } = await req.json()

    // Validate input
    if (!text) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: text' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Enhancing content for tier:', userTier, 'platforms:', platforms)

    if (
      includeHashtags &&
      (
        !businessProfile ||
        typeof businessProfile.country !== 'string' ||
        businessProfile.country.trim().length === 0
      )
    ) {
      return new Response(
        JSON.stringify({
          error: 'missing_country',
          message: 'Business profile country is required to localize hashtags. Update the profile and try again.'
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      )
    }

    // Check if we need clarification (store for later, but continue with enhancement)
    let clarificationQuestion = null
    if (!skipClarification && !hasPhoto && !clarificationContext) {
      const wordCount = text.trim().split(/\s+/).length
      
      // Check if text needs clarification (≤3 words)
      if (wordCount <= 3) {
        // Use AI to detect if text is vague (no concrete nouns or modifiers)
        const clarificationCheckPrompt = `Analyze this Danish text for a social media post: "${text}"

Does this text contain:
1. Concrete nouns (specific things, places, products)?
2. Modifiers (numbers, adjectives, details like "10 retter", "ny", "speciel")?

If it has BOTH concrete nouns AND modifiers, it's specific enough.
If it's missing one or both, generate a friendly clarification question in Danish asking for ONE specific detail to make the post better.

If the input looks like gibberish, random characters, or a word that isn't meaningful in Danish nor English (examples: "fikesmeuben", "asdklj"), flag it as meaningless and ask the user to briefly describe what they want to post about.

${businessProfile?.business_category ? `Business type: ${businessProfile.business_category}` : ''}

Return ONLY valid JSON:
{
  "needs_clarification": true/false,
  "question": "friendly question in Danish" or null,
  "meaningless_input": true/false
}

Examples:
- "julemenu" → needs_clarification: true, question: "Hvad gør din julemenu speciel? (fx antal retter, tema eller pris)"
- "åbent i dag" → needs_clarification: true, question: "Hvad kan gæsterne opleve hos jer i dag? (fx særlige tilbud eller events)"
- "ny menu med 10 retter" → needs_clarification: false, question: null
- "fikesmeuben" → needs_clarification: true, meaningless_input: true, question: "Kan du kort beskrive, hvad du gerne vil fortælle dine kunder i dag?"`

        const clarificationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
                content: 'You are a helpful assistant that analyzes text for clarity. Always return valid JSON.'
              },
              {
                role: 'user',
                content: clarificationCheckPrompt
              }
            ],
            temperature: 0.3,
            max_tokens: 200,
          }),
        })

        if (clarificationResponse.ok) {
          const clarificationData = await clarificationResponse.json()
          const content = clarificationData.choices[0].message.content.trim()
          
          try {
            const parsed = JSON.parse(content)

            if (parsed.meaningless_input) {
              const fallbackQuestion = parsed.question || 'Kan du kort beskrive, hvad du gerne vil fortælle dine kunder i dag?'
              return new Response(
                JSON.stringify({
                  text: 'error:meaningless_input',
                  needs_clarification: true,
                  question: fallbackQuestion
                }),
                {
                  status: 200,
                  headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                  }
                }
              )
            }

            if (parsed.needs_clarification && parsed.question) {
              // Store question to include in response later
              clarificationQuestion = parsed.question
            }
          } catch (e) {
            console.error('Failed to parse clarification response:', e)
            // Continue with normal enhancement if parsing fails
          }
        }
      }
    }

    // Get tier-specific settings
    const systemPrompt = SYSTEM_PROMPTS[userTier as keyof typeof SYSTEM_PROMPTS] || SYSTEM_PROMPTS.free
    const instructions = ENHANCEMENT_INSTRUCTIONS[userTier] || ENHANCEMENT_INSTRUCTIONS.free
    const emojiPolicy = resolveEmojiPolicy({ includeEmojis, userTier })
    const aiModel = getAIModelForTier(userTier)
    const locale = resolveLocaleConfig({
      language,
      country: businessProfile?.country ?? null
    })

    console.log('🤖 Using AI model:', aiModel, '(tier:', userTier, ')')

    // Build business context for all tiers
    let businessContext = ''
    let toneGuidance = ''
    
    if (businessProfile) {
      const contextParts = []
      if (businessProfile.business_name) contextParts.push(`Business name: ${businessProfile.business_name}`)
      if (businessProfile.business_category) {
        contextParts.push(`Category: ${businessProfile.business_category}`)
        // Get tone guidance for this category (language-aware)
        const categoryTone = getToneDescription(businessProfile.business_category, locale.languageCode)
        if (categoryTone) {
          toneGuidance = `\n\n${categoryTone}`
        }
      }
      if (businessProfile.address) contextParts.push(`Address: ${businessProfile.address}`)
      if (businessProfile.opening_hours) {
        const hours = typeof businessProfile.opening_hours === 'string' 
          ? JSON.parse(businessProfile.opening_hours) 
          : businessProfile.opening_hours
        const hoursText = Object.entries(hours)
          .filter(([_, v]: [string, any]) => !v.closed)
          .map(([day, v]: [string, any]) => `${day}: ${v.open}-${v.close}`)
          .join(', ')
        if (hoursText) contextParts.push(`Opening hours: ${hoursText}`)
      }
      if (businessProfile.keywords && businessProfile.keywords.length > 0) {
        contextParts.push(`Keywords: ${businessProfile.keywords.join(', ')}`)
      }
      
      if (contextParts.length > 0) {
        businessContext = `\n\nBUSINESS INFORMATION (use only to avoid mistakes):\n${contextParts.join('\n')}${toneGuidance}`
      }
    }

    // Build platform-specific instructions
    const platformList = platforms.join(', ')
    
    console.log('🔍 Platform detection:', { userTier, platforms, platformsLength: platforms.length })
    console.log('🏷️  includeHashtags flag:', includeHashtags)
    
    const hasInstagram = platforms.some((p: string) => p.toLowerCase() === 'instagram')
    const hasFacebook = platforms.some((p: string) => p.toLowerCase() === 'facebook')

    let hashtagGuidance = ''
    if (includeHashtags && businessProfile?.business_category) {
      hashtagGuidance = getHashtagGuidance(businessProfile.business_category, locale.languageCode, businessProfile)
      console.log('📋 Hashtag guidance generated')
    } else {
      console.log('⚠️  No hashtag guidance:', { includeHashtags, hasCategory: !!businessProfile?.business_category })
    }

    // Build the enhancement prompt
    const enhancementPrompt = `Enhance this social media post for ${platformList}.

${headline ? `HEADLINE: ${headline}\n` : 'NO HEADLINE PROVIDED - Please create a short, attention-grabbing headline based on the text.\n'}TEXT: ${text}${clarificationContext ? `\n\nADDITIONAL CONTEXT: ${clarificationContext}\n(The user provided this additional detail to clarify their post. Incorporate it naturally into the enhanced text.)` : ''}${businessContext}

Business category: ${businessProfile?.business_category || 'local business'}
Primary language: ${locale.languageLabel}

Instructions:
${instructions.text}

EMOJIS: ${emojiPolicy.directive}

HASHTAGS: Do not generate hashtags. They will be generated in a separate step.${hashtagGuidance ? `\n\n(Hashtag guidance for later reference:\n${hashtagGuidance})` : ''}

HEADLINE REQUIREMENTS:
${headline ? '- Enhance the existing headline to make it clear and engaging' : '- Create a short headline (3-8 words) that captures the main point of the post'}
- Keep it simple and direct
- Make it attention-grabbing but not clickbait
- Use natural, conversational language

IMPORTANT:
- Write in ${locale.languageLabel}
- Return ONLY valid JSON with this structure:
{
  "headline": "enhanced or generated headline text (ALWAYS provide a headline)",
  "text": "enhanced main text",
  "hashtags": ["tag1", "tag2", "tag3"] or empty array if includeHashtags is false,
  "emojis_used": true/false
}

- Do NOT include markdown code blocks or any other formatting
- Return raw JSON only`

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: enhancementPrompt
          }
        ],
        temperature: userTier === 'free' ? 0.3 : 0.7, // More conservative for free tier
        max_tokens: userTier === 'free' ? 500 : 1000,
      }),
    })

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text()
      console.error('OpenAI API error:', errorData)
      throw new Error('OpenAI API request failed')
    }

    const openaiData = await openaiResponse.json()
    const aiResponse = openaiData.choices[0]?.message?.content

    if (!aiResponse) {
      throw new Error('No response from AI')
    }

    console.log('Raw AI response:', aiResponse)

    // Parse the JSON response
    let enhancedContent
    try {
      // Remove markdown code blocks if present
      const cleanedResponse = aiResponse
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      
      enhancedContent = JSON.parse(cleanedResponse)
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse)
      throw new Error('Invalid JSON response from AI')
    }

    // Validate response structure
    if (!enhancedContent.text) {
      throw new Error('AI response missing required text field')
    }

    console.log('✅ Enhanced content:', {
      headline: enhancedContent.headline ? 'updated' : 'none',
      text: enhancedContent.text.substring(0, 50) + '...',
      hashtags: enhancedContent.hashtags?.length || 0,
      clarification: clarificationQuestion ? 'yes' : 'no'
    })

    console.log('🏷️  About to generate hashtags:', { includeHashtags, hasBusinessProfile: !!businessProfile })
    
    if (includeHashtags) {
      console.log('✅ Generating hashtags...')
      const hashtagResult = await generateHashtags({
        includeHashtags,
        platforms,
        businessProfile,
        language,
        userTier,
        aiModel,
        enhancedContent,
        originalText: text,
      })

      enhancedContent.hashtags = hashtagResult.hashtags
      enhancedContent.hashtag_groups = hashtagResult.hashtagGroups
      
      console.log('🏷️  Generated hashtags:', { count: hashtagResult.hashtags.length, hashtags: hashtagResult.hashtags.slice(0, 5) })

      if (!hashtagGuidance) {
        hashtagGuidance = hashtagResult.hashtagGuidance
      }
    } else {
      console.log('⚠️  Skipping hashtag generation - includeHashtags is false')
      enhancedContent.hashtags = []
      enhancedContent.hashtag_groups = {
        primary: [],
        local: [],
        foodie: [],
        extras: [],
      }
    }

    const businessName = typeof businessProfile?.business_name === 'string' ? businessProfile.business_name : undefined

    applyPostProcessing(enhancedContent, businessName)
    enforceEmojiPolicy(enhancedContent, emojiPolicy)

    // Add clarification to response if present
    const finalResponse = {
      ...enhancedContent,
      ...(clarificationQuestion && {
        needs_clarification: true,
        question: clarificationQuestion
      })
    }

    return new Response(
      JSON.stringify(finalResponse),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error in ai-enhance function:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})
