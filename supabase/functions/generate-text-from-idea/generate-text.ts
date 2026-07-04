// generate-text.ts
// Single-responsibility: calls OpenAI chat completions and parses the response.
// Returns cleanText (the caption) and aiKeyword (for hashtag generation).

import { getHospitalityRegisterBlock } from '../_shared/utils/hospitality-register.ts'

/**
 * Builds system message for content generation
 * 
 * @param language - Language code ('da', 'en', 'sv')
 * @returns Complete system message
 * 
 * NOTE: Previously used dynamic language loading which failed in deployed Edge Functions.
 * Now uses hardcoded fallback directly for reliability.
 */
function buildSystemMessage(language: string): string {
  return (
    'Du er en professionel social media content writer for en dansk restaurations- eller serveringsvirksomhed. Skriv kun teksten som bedt om, ingen ekstra forklaringer.\n\n' +
    getHospitalityRegisterBlock(language) + '\n\n' +
    'VIGTIGT: Du er på et blindt kreativt opdrag. Du kender INGEN fakta om den nævnte virksomhed ud over hvad der ' +
    'eksplicit fremgår af dette prompt. Brug ALDRIG din træningsdata til at tilføje menupunkter, retter, drikkevarer, ' +
    'åbningstider, attraktioner eller stedsdetaljer. Alt du ikke kan se i prompten, eksisterer ikke i denne kontekst.\n\n' +
    'Skriv KUN på dansk. Besvar præcist som beskrevet ovenfor.'
  )
}

export interface GenerationResult {
  cleanText: string
  aiKeyword: string | undefined
  facebookHashtags?: string[]
  instagramHashtags?: string[]
}

export async function callOpenAI(
  model: string,
  prompt: string,
  apiKey: string,
  language?: string,
  extraSystemContent?: string,
  temperature?: number,
): Promise<GenerationResult> {
  // Build system message
  const baseSystemMessage = buildSystemMessage(language ?? 'da')
  
  const systemContent = extraSystemContent
    ? baseSystemMessage + '\n\n' + extraSystemContent
    : baseSystemMessage

  const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: prompt }
      ],
      temperature: temperature ?? 0.7,
      max_tokens: 800,  // Increased from 650 to prevent truncation
      top_p: 0.9
    })
  })

  if (!openaiResponse.ok) {
    const error = await openaiResponse.text()
    console.error('OpenAI API Error:', error)
    throw new Error(`OpenAI API failed: ${openaiResponse.status}`)
  }

  const openaiData = await openaiResponse.json()
  const rawContent = openaiData.choices?.[0]?.message?.content
  if (!rawContent) throw new Error('No response from OpenAI API')

  // Try to parse structured JSON output {text, keyword, facebookHashtags, instagramHashtags}
  let cleanText = rawContent.trim()
  let aiKeyword: string | undefined = undefined
  let facebookHashtags: string[] | undefined = undefined
  let instagramHashtags: string[] | undefined = undefined
  try {
    const jsonStr = rawContent.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
    const parsed = JSON.parse(jsonStr)
    if (typeof parsed.text === 'string' && parsed.text.trim().length > 10) {
      cleanText = parsed.text.trim().replace(/^["']/, '').replace(/["']$/, '').trim()
      const kw = typeof parsed.keyword === 'string' ? parsed.keyword.trim() : ''
      if (kw.length > 1) aiKeyword = kw.charAt(0).toUpperCase() + kw.slice(1)
      
      // Extract hashtags if provided
      if (Array.isArray(parsed.facebookHashtags)) {
        facebookHashtags = parsed.facebookHashtags.filter((tag: any) => typeof tag === 'string' && tag.startsWith('#'))
      }
      if (Array.isArray(parsed.instagramHashtags)) {
        instagramHashtags = parsed.instagramHashtags.filter((tag: any) => typeof tag === 'string' && tag.startsWith('#'))
      }
    }
  } catch {
    // Not JSON — treat raw output as plain text (backward compat / model fallback)
    cleanText = rawContent.trim().replace(/^["']/, '').replace(/["']$/, '').trim()
  }

  console.log('✅ Generated:', cleanText.substring(0, 100), aiKeyword ? `(keyword: ${aiKeyword})` : '', facebookHashtags ? `FB: ${facebookHashtags.length} tags` : '', instagramHashtags ? `IG: ${instagramHashtags.length} tags` : '')
  return { cleanText, aiKeyword, facebookHashtags, instagramHashtags }
}
