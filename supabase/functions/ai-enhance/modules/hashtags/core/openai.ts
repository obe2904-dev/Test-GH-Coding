const HASHTAG_ENDPOINT = 'https://api.openai.com/v1/chat/completions'
const SYSTEM_PROMPT = 'You are a social media strategist. Generate ONLY hashtags that directly relate to the content. Always respond with valid JSON.'

export interface HashtagModelRequestOptions {
  aiModel: string
  prompt: string
  apiKey?: string | null
  fetchImpl?: typeof fetch
}

export async function requestHashtagGroupPayload(
  options: HashtagModelRequestOptions,
): Promise<unknown | null> {
  const fetcher = options.fetchImpl ?? fetch
  const apiKey = options.apiKey ?? Deno.env.get('OPENAI_API_KEY')

  if (!apiKey) {
    console.error('OPENAI_API_KEY missing for hashtag generation request')
    return null
  }

  console.log('📤 Sending hashtag prompt to OpenAI:', options.prompt.substring(0, 200) + '...')
  
  try {
    const response = await fetcher(HASHTAG_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.aiModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: options.prompt },
        ],
        temperature: 0.5,
        max_tokens: 600,
      }),
    })

    if (!response.ok) {
      const message = await response.text().catch(() => '')
      console.error('Hashtag generation API error:', message || response.statusText)
      return null
    }

    const payload = await response.json().catch(() => null)
    if (!payload) {
      return null
    }

    const rawContent = payload?.choices?.[0]?.message?.content
    if (typeof rawContent !== 'string') {
      return null
    }

    const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    if (!cleaned) {
      return null
    }

    console.log('📥 Raw hashtag AI response:', cleaned.substring(0, 500))

    try {
      const parsed = JSON.parse(cleaned)
      console.log('✅ Parsed hashtag response:', JSON.stringify(parsed, null, 2))
      return parsed
    } catch (error) {
      console.error('Failed to parse hashtag model response JSON', error)
      return null
    }
  } catch (error) {
    console.error('Hashtag generation API call failed', error)
    return null
  }
}
