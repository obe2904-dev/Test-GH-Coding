/**
 * Experience Pillars Extractor
 *
 * Maps the business into reliable content categories (“pillars”) the AI can create posts for,
 * based on explicit evidence in website content.
 */

import { AI_TASKS, CONTENT_LIMITS, getLanguageCode, type LanguageCode } from '../ai-config.ts'

export type ExperiencePillarType =
  | 'crave_worthy'
  | 'bts_human'
  | 'social_proof'
  | 'ambiance_vibe'
  | 'after_dark'
  | 'engagement'

export interface RecommendedPillar {
  type: ExperiencePillarType
  why: string
  confidence: number
}

export interface SupportedAssets {
  hasBrunch: boolean
  hasCocktails: boolean
  hasTerrace: boolean
  hasEvents: boolean
}

export interface ExperiencePillarsExtraction {
  recommendedPillars: RecommendedPillar[]
  supportedAssets: SupportedAssets
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n))

const normalizePillarType = (value: unknown): ExperiencePillarType => {
  const v = String(value || '').toLowerCase()
  if (v === 'crave_worthy') return 'crave_worthy'
  if (v === 'bts_human') return 'bts_human'
  if (v === 'social_proof') return 'social_proof'
  if (v === 'ambiance_vibe') return 'ambiance_vibe'
  if (v === 'after_dark') return 'after_dark'
  return 'engagement'
}

const cleanText = (s: unknown): string => String(s ?? '').replace(/\s+/g, ' ').trim()

const LANGUAGE_SYSTEM: Record<LanguageCode, string> = {
  da: 'Du er en streng JSON-API. Din opgave er at anbefale indholdspiller baseret på EKSPLICIT evidens i websiteindhold. Returnér KUN gyldig JSON. Skriv "why" på dansk.',
  no: 'Du er en streng JSON-API. Anbefal innholdspilarer basert på EKSPLISITT evidens i nettstedinnholdet. Returner KUN gyldig JSON. Skriv "why" på norsk.',
  sv: 'Du är ett strikt JSON-API. Rekommendera innehållspelare baserat på EXPLICIT evidens i webbplatsinnehåll. Returnera ENDAST giltig JSON. Skriv "why" på svenska.',
  de: 'Sie sind eine strikte JSON-API. Empfehlen Sie Content-Pillars basierend auf EXPLIZITER Evidenz im Website-Inhalt. Geben Sie NUR gültiges JSON zurück. Schreiben Sie "why" auf Deutsch.',
  en: 'You are a strict JSON API. Recommend content pillars based on EXPLICIT evidence in website content. Return ONLY valid JSON. Write "why" in English.',
}

export async function extractExperiencePillars(
  content: string,
  openaiApiKey: string,
  hints?: {
    businessName?: string | null
    businessType?: string | null
    languageHint?: string | null
  }
): Promise<ExperiencePillarsExtraction> {
  const taskConfig = AI_TASKS.experiencePillars
  const langCode = getLanguageCode(hints?.languageHint, 'da')

  const prompt = `Recommend content pillars for social posts this business can reliably create.

Business name: ${hints?.businessName || 'unknown'}
Business type: ${hints?.businessType || 'unknown'}
Language: ${langCode}

RULES (MUST FOLLOW):
1) Evidence-based: Only recommend a pillar if the content includes explicit signals that support it.
2) Do NOT invent: events, giveaways, reviews, partnerships, seasonal specials.
3) "social_proof" is only recommended if there is explicit UGC/review/testimonial context.
4) Supported assets booleans must be true ONLY if explicitly supported by content.

PILLARS:
- crave_worthy: food/drink visuals, signature items, menu mentions, photo/video-friendly products.
- bts_human: team/chef/barista, craft/process, behind-the-scenes.
- social_proof: testimonials, reviews, UGC, quotes from customers.
- ambiance_vibe: interior, decor, atmosphere, work-from-cafe, golden hour.
- after_dark: cocktails, bar vibe, late opening, evening/night concept.
- engagement: polls/questions/this-or-that prompts grounded in actual offerings.

Return ONLY valid JSON in this exact schema:
{
  "recommendedPillars": [
    {
      "type": "crave_worthy|bts_human|social_proof|ambiance_vibe|after_dark|engagement",
      "why": "short evidence-based reason",
      "confidence": 0.0
    }
  ],
  "supportedAssets": {
    "hasBrunch": false,
    "hasCocktails": false,
    "hasTerrace": false,
    "hasEvents": false
  }
}

CONTENT:
${content.slice(0, CONTENT_LIMITS.experiencePillars)}
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
          { role: 'system', content: LANGUAGE_SYSTEM[langCode] || LANGUAGE_SYSTEM.en },
          { role: 'user', content: prompt },
        ],
        temperature: taskConfig.temperature,
        max_tokens: taskConfig.maxTokens,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      console.error('❌ Experience pillars extraction failed:', response.status)
      return {
        recommendedPillars: [],
        supportedAssets: { hasBrunch: false, hasCocktails: false, hasTerrace: false, hasEvents: false },
      }
    }

    const data = await response.json()
    const parsed = JSON.parse(data.choices[0].message.content)

    const recommendedRaw: any[] = Array.isArray(parsed?.recommendedPillars) ? parsed.recommendedPillars : []
    const supportedRaw: any = parsed?.supportedAssets || {}

    // Normalize and de-duplicate by type (keep highest confidence)
    const byType = new Map<ExperiencePillarType, RecommendedPillar>()
    for (const item of recommendedRaw) {
      const type = normalizePillarType(item?.type)
      const why = cleanText(item?.why)
      if (!why) continue
      const confidence = clamp01(Number(item?.confidence ?? 0))

      const prev = byType.get(type)
      if (!prev || confidence > prev.confidence) {
        byType.set(type, { type, why, confidence })
      }
    }

    const recommendedPillars = Array.from(byType.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 6)

    const supportedAssets: SupportedAssets = {
      hasBrunch: Boolean(supportedRaw?.hasBrunch),
      hasCocktails: Boolean(supportedRaw?.hasCocktails),
      hasTerrace: Boolean(supportedRaw?.hasTerrace),
      hasEvents: Boolean(supportedRaw?.hasEvents),
    }

    console.log('✅ Experience pillars extracted:', recommendedPillars.length)

    return { recommendedPillars, supportedAssets }
  } catch (error) {
    console.error('❌ Error in experience pillars extraction:', error)
    return {
      recommendedPillars: [],
      supportedAssets: { hasBrunch: false, hasCocktails: false, hasTerrace: false, hasEvents: false },
    }
  }
}
