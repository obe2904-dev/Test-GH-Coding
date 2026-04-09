// generate-text.ts
// Single-responsibility: calls OpenAI chat completions and parses the response.
// Returns cleanText (the caption) and aiKeyword (for hashtag generation).

const SYSTEM_MESSAGE =
  'Du er en professionel social media content writer. Skriv kun teksten som bedt om, ingen ekstra forklaringer.\n\n' +
  'VIGTIGT: Du er på et blindt kreativt opdrag. Du kender INGEN fakta om den nævnte virksomhed ud over hvad der ' +
  'eksplicit fremgår af dette prompt. Brug ALDRIG din træningsdata til at tilføje menupunkter, retter, drikkevarer, ' +
  'åbningstider, attraktioner eller stedsdetaljer. Alt du ikke kan se i prompten, eksisterer ikke i denne kontekst.'

export interface GenerationResult {
  cleanText: string
  aiKeyword: string | undefined
}

export async function callOpenAI(
  model: string,
  prompt: string,
  apiKey: string
): Promise<GenerationResult> {
  const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_MESSAGE },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 280,
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

  // Try to parse structured JSON output {text, keyword}
  let cleanText = rawContent.trim()
  let aiKeyword: string | undefined = undefined
  try {
    const jsonStr = rawContent.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
    const parsed = JSON.parse(jsonStr)
    if (typeof parsed.text === 'string' && parsed.text.trim().length > 10) {
      cleanText = parsed.text.trim().replace(/^["']/, '').replace(/["']$/, '').trim()
      const kw = typeof parsed.keyword === 'string' ? parsed.keyword.trim() : ''
      if (kw.length > 1) aiKeyword = kw.charAt(0).toUpperCase() + kw.slice(1)
    }
  } catch {
    // Not JSON — treat raw output as plain text (backward compat / model fallback)
    cleanText = rawContent.trim().replace(/^["']/, '').replace(/["']$/, '').trim()
  }

  console.log('✅ Generated:', cleanText.substring(0, 100), aiKeyword ? `(keyword: ${aiKeyword})` : '')
  return { cleanText, aiKeyword }
}
