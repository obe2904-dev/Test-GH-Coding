/**
 * Venue Hooks Extractor
 *
 * Extracts unique, concrete, venue-specific hooks that can be used in social posts.
 *
 * Key constraint: Only extract claims with explicit evidence in the provided content.
 */

import { AI_TASKS, CONTENT_LIMITS } from '../ai-config.ts'

export type VenueHookCategory = 'visual' | 'location' | 'interior' | 'ritual' | 'experience'

export interface VenueHookEvidence {
  sourceUrl: string
  quote: string
}

export interface VenueHook {
  hook: string
  category: VenueHookCategory
  confidence: number // 0–1
  evidence: VenueHookEvidence[]
}

export interface VenuePositioning {
  vibeKeywords: string[]
  avoidKeywords: string[]
  evidence: VenueHookEvidence[]
}

export interface VenueHooksExtraction {
  uniqueHooks: VenueHook[]
  positioning: VenuePositioning
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n))

const normalizeCategory = (value: unknown): VenueHookCategory => {
  const v = String(value || '').toLowerCase()
  if (v === 'visual') return 'visual'
  if (v === 'location') return 'location'
  if (v === 'interior') return 'interior'
  if (v === 'ritual') return 'ritual'
  return 'experience'
}

const cleanText = (s: unknown): string => String(s ?? '').replace(/\s+/g, ' ').trim()

export async function extractVenueHooks(
  content: string,
  openaiApiKey: string,
  hints?: {
    businessName?: string | null
    businessType?: string | null
    languageHint?: string | null
  }
): Promise<VenueHooksExtraction> {
  const taskConfig = AI_TASKS.venueHooks

  const prompt = `Extract venue-specific hooks from this website content.

Business name: ${hints?.businessName || 'unknown'}
Business type: ${hints?.businessType || 'unknown'}
Language hint: ${hints?.languageHint || 'unknown'}

CRITICAL EXTRACTION RULES (MUST FOLLOW):
1) Only extract claims with explicit textual or structural evidence in the content.
2) Every hook MUST include at least one evidence item with:
   - sourceUrl: the page URL where the evidence appears
   - quote: an exact quote from that page text (copy it verbatim)
3) Prefer concrete nouns and distinctive details over vague adjectives.
4) Allowed evidence sources include:
   - hero sections / headings
   - about/story sections
   - captions/sliders text (if present)
   - structured page text and metadata included in the content
   - image alt text and filenames IF present in the content
5) Do NOT invent: partnerships, awards, reviews, events, giveaways, seasonal specials.

Examples of good hooks:
- "Terrasse ved Åen" (location)
- "Håndmalede vægmalerier med Aarhus-motiver" (interior)
- "Cocktails + åbent sent tor–lør" (experience)

Return ONLY valid JSON in this exact schema:
{
  "uniqueHooks": [
    {
      "hook": "exact phrase",
      "category": "visual|location|interior|ritual|experience",
      "confidence": 0.0,
      "evidence": [
        { "sourceUrl": "https://...", "quote": "exact quote from the page" }
      ]
    }
  ],
  "positioning": {
    "vibeKeywords": ["klassisk", "uhøjtidelig"],
    "avoidKeywords": ["fine dining", "snobbet"],
    "evidence": [
      { "sourceUrl": "https://...", "quote": "exact quote" }
    ]
  }
}

CONTENT (may include multiple pages with headers like "=== Page: <url> | Type: ... ==="):
${content.slice(0, CONTENT_LIMITS.venueHooks)}
`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: taskConfig.model,
        messages: [
          {
            role: 'system',
            content:
              'You are a strict JSON API. Only extract claims with evidence. Return only valid JSON (no markdown, no explanations).',
          },
          { role: 'user', content: prompt },
        ],
        temperature: taskConfig.temperature,
        max_tokens: taskConfig.maxTokens,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      console.error('❌ Venue hooks extraction failed:', response.status)
      return {
        uniqueHooks: [],
        positioning: { vibeKeywords: [], avoidKeywords: [], evidence: [] },
      }
    }

    const data = await response.json()
    const parsed = JSON.parse(data.choices[0].message.content)

    const uniqueHooksRaw: any[] = Array.isArray(parsed?.uniqueHooks) ? parsed.uniqueHooks : []
    const positioningRaw: any = parsed?.positioning || {}

    const uniqueHooks: VenueHook[] = uniqueHooksRaw
      .map((h) => {
        const evidenceRaw: any[] = Array.isArray(h?.evidence) ? h.evidence : []
        const evidence: VenueHookEvidence[] = evidenceRaw
          .map((e) => ({
            sourceUrl: cleanText(e?.sourceUrl),
            quote: cleanText(e?.quote),
          }))
          .filter((e) => e.sourceUrl && e.quote)
          .slice(0, 5)

        return {
          hook: cleanText(h?.hook),
          category: normalizeCategory(h?.category),
          confidence: clamp01(Number(h?.confidence ?? 0)),
          evidence,
        }
      })
      .filter((h) => h.hook.length >= 6)
      .filter((h) => h.evidence.length > 0)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 12)

    const positioningEvidenceRaw: any[] = Array.isArray(positioningRaw?.evidence)
      ? positioningRaw.evidence
      : []

    const positioning: VenuePositioning = {
      vibeKeywords: Array.isArray(positioningRaw?.vibeKeywords)
        ? positioningRaw.vibeKeywords.map(cleanText).filter(Boolean).slice(0, 10)
        : [],
      avoidKeywords: Array.isArray(positioningRaw?.avoidKeywords)
        ? positioningRaw.avoidKeywords.map(cleanText).filter(Boolean).slice(0, 10)
        : [],
      evidence: positioningEvidenceRaw
        .map((e) => ({ sourceUrl: cleanText(e?.sourceUrl), quote: cleanText(e?.quote) }))
        .filter((e) => e.sourceUrl && e.quote)
        .slice(0, 6),
    }

    console.log('✅ Venue hooks extracted:', uniqueHooks.length)

    return { uniqueHooks, positioning }
  } catch (error) {
    console.error('❌ Error in venue hooks extraction:', error)
    return {
      uniqueHooks: [],
      positioning: { vibeKeywords: [], avoidKeywords: [], evidence: [] },
    }
  }
}
