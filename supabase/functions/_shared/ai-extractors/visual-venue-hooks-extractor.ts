/**
 * Visual Venue Hooks Extractor
 *
 * Uses image URLs (hero/gallery/og:image) to extract distinctive physical/visual hooks.
 * Output is evidence-backed: each hook must include at least one evidence item that
 * points to a specific image URL and a conservative caption ("quote").
 */

export type VisualHookCategory = 'visual' | 'interior' | 'exterior' | 'art' | 'entrance' | 'experience'

export interface VisualHookEvidence {
  sourceUrl: string
  quote: string
}

export interface VisualVenueHook {
  // Keep compatibility with downstream variants
  hook: string
  text?: string
  category: VisualHookCategory
  confidence: number // 0–1
  evidence: VisualHookEvidence[]
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n))
const cleanText = (s: unknown): string => String(s ?? '').replace(/\s+/g, ' ').trim()

const normalizeCategory = (value: unknown): VisualHookCategory => {
  const v = String(value || '').toLowerCase()
  if (v === 'visual') return 'visual'
  if (v === 'interior') return 'interior'
  if (v === 'exterior') return 'exterior'
  if (v === 'art') return 'art'
  if (v === 'entrance') return 'entrance'
  return 'experience'
}

/**
 * Extract visual hooks from a set of image URLs.
 *
 * IMPORTANT: We treat the model-produced caption as "visual evidence quote".
 * The prompt forces conservative, literal descriptions to reduce hallucination.
 */
export async function extractVisualVenueHooks(
  imageUrls: string[],
  openaiApiKey: string,
  hints?: {
    businessName?: string | null
    businessType?: string | null
    languageHint?: string | null
  }
): Promise<{ uniqueHooks: VisualVenueHook[] }> {
  const urls = (imageUrls || []).map((u) => cleanText(u)).filter(Boolean).slice(0, 6)
  if (urls.length === 0) return { uniqueHooks: [] }

  const system =
    'You are a strict JSON API. You ONLY describe what is clearly visible in images. ' +
    'If something is uncertain, omit it. No marketing hype, no guessing.'

  const userText = `Extract distinctive, venue-specific PHYSICAL/VISUAL hooks from these images.

Business name: ${hints?.businessName || 'unknown'}
Business type: ${hints?.businessType || 'unknown'}
Language hint: ${hints?.languageHint || 'unknown'}

Rules:
1) Only output hooks that are directly supported by a conservative caption of the image.
2) Each hook MUST include evidence with sourceUrl = the exact image URL and quote = a short, literal caption you derive from the image.
3) Prefer concrete nouns (murals, statues, neon signs, terrace by river, unique bar interior) over adjectives.
4) Do NOT infer: reviews, awards, events, celebrities, partnerships, locations not visible.
5) Output Danish hooks if languageHint suggests Danish; otherwise English is ok.

Return ONLY valid JSON in this schema:
{
  "uniqueHooks": [
    {
      "hook": "short hook phrase",
      "category": "visual|interior|exterior|art|entrance|experience",
      "confidence": 0.0,
      "evidence": [
        { "sourceUrl": "https://...", "quote": "literal caption from the image" }
      ]
    }
  ]
}
`

  const messages: any[] = [
    { role: 'system', content: system },
    {
      role: 'user',
      content: [
        { type: 'text', text: userText },
        ...urls.map((u) => ({ type: 'image_url', image_url: { url: u } })),
      ],
    },
  ]

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.2,
        max_tokens: 900,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      console.error('❌ Visual hooks extraction failed:', response.status)
      return { uniqueHooks: [] }
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content) return { uniqueHooks: [] }

    const parsed = JSON.parse(content)
    const raw: any[] = Array.isArray(parsed?.uniqueHooks) ? parsed.uniqueHooks : []

    const uniqueHooks: VisualVenueHook[] = raw
      .map((h) => {
        const evidenceRaw: any[] = Array.isArray(h?.evidence) ? h.evidence : []
        const evidence: VisualHookEvidence[] = evidenceRaw
          .map((e) => ({
            sourceUrl: cleanText(e?.sourceUrl),
            quote: cleanText(e?.quote),
          }))
          .filter((e) => e.sourceUrl && e.quote)
          .slice(0, 2)

        const hook = cleanText(h?.hook)

        return {
          hook,
          text: hook,
          category: normalizeCategory(h?.category),
          confidence: clamp01(Number(h?.confidence ?? 0)),
          evidence,
        }
      })
      .filter((h) => h.hook.length >= 6)
      .filter((h) => h.evidence.length > 0)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 8)

    return { uniqueHooks }
  } catch (error) {
    console.error('❌ Error in visual hooks extraction:', error)
    return { uniqueHooks: [] }
  }
}
