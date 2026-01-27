// Smart generator using GPT-4o with IdeaPlan
import { GenerationContext, PostIdea } from '../types.ts'
import { buildSystemPrompt, buildUserPrompt } from './prompt-builder.ts'
import { createIdeaPlan } from './strategy-engine.ts'

export async function generateSuggestions(
  context: GenerationContext,
  count: number = 3
): Promise<PostIdea[]> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  // STEP 1: Create IdeaPlan with BrandPolicy BEFORE calling AI
  console.log(`📋 Creating 3-slot idea plan...`)
  const ideaPlan = createIdeaPlan(context)

  console.log(`🤖 Generating ${count} suggestions with GPT-4o`)

  const systemPrompt = buildSystemPrompt(context.language)
  const userPrompt = buildUserPrompt(context, ideaPlan)  // Pass IdeaPlan to prompt builder

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]

  const requestBody = {
    model: 'gpt-4o',
    messages: messages,
    temperature: 0.7,
    response_format: { type: 'json_object' }
  }

  console.log('📤 Sending request to OpenAI...')
  
  const startTime = Date.now()
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify(requestBody)
  })

  const elapsed = Date.now() - startTime
  console.log(`⏱️ OpenAI response received in ${elapsed}ms`)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ OpenAI API error:', response.status, errorText)
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    console.error('❌ Invalid OpenAI response structure:', JSON.stringify(data))
    throw new Error('Invalid OpenAI response structure')
  }

  const content = data.choices[0].message.content

  let parsed: any
  try {
    parsed = JSON.parse(content)
  } catch (error) {
    console.error('❌ Failed to parse OpenAI response as JSON:', content.substring(0, 200))
    throw new Error('Failed to parse AI response as JSON')
  }

  if (!parsed.ideas || !Array.isArray(parsed.ideas)) {
    console.error('❌ Response missing ideas array:', JSON.stringify(parsed))
    throw new Error('Response missing ideas array')
  }

  console.log(`📋 AI returned ${parsed.ideas.length} ideas`)

  const ideas: PostIdea[] = parsed.ideas.map((idea: any, idx: number) => {
    // Validate required fields
    if (!idea.hook || !idea.caption_base || !idea.cta_intent || !idea.best_time || !idea.impact) {
      console.warn(`⚠️ Idea ${idx + 1} missing required fields:`, idea)
    }

    // Parse menu_item if present
    let menuItem: PostIdea['menu_item'] = null
    if (idea.menu_item && typeof idea.menu_item === 'object') {
      menuItem = {
        name: String(idea.menu_item.name || ''),
        category: String(idea.menu_item.category || '')
      }
    }

    return {
      idea_type: (idea.idea_type === 'menu' || idea.idea_type === 'vibe' || idea.idea_type === 'occasion' || idea.idea_type === 'moment')
        ? idea.idea_type
        : 'vibe',
      menu_item: menuItem,
      hook: String(idea.hook || ''),
      caption_base: String(idea.caption_base || ''),
      cta_intent: (idea.cta_intent === 'book' || idea.cta_intent === 'menu' || idea.cta_intent === 'visit' || idea.cta_intent === 'engage')
        ? idea.cta_intent
        : 'engage',
      best_time: String(idea.best_time || '12:00'),
      impact: (idea.impact === 'low' || idea.impact === 'medium' || idea.impact === 'high')
        ? idea.impact
        : 'medium',
      photo_suggestion: String(idea.photo_suggestion || ''),
      reasoning: idea.reasoning || undefined,
      slot_id: idea.slot_id || undefined  // Include slot_id from AI response
    }
  })

  console.log(`✅ Generated ${ideas.length} ideas`)

  return ideas.slice(0, count)
}
