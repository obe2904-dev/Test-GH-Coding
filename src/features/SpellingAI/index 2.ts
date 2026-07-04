// Offline stub for spelling checks
// File: src/features/SpellingAI/index.ts
import type { GenerateContext } from '../shared/types'

type SpellOut = { corrected: string; suggestions?: string[] }

// Very small heuristic language detector: returns 'da' for Danish, otherwise 'en'.
function detectLanguage(text: string): 'da' | 'en' {
  if (!text || typeof text !== 'string') return 'en'
  const sample = text.toLowerCase()
  // Danish-specific letters
  if (/[æøåÆØÅ]/.test(sample)) return 'da'
  // common Danish words (simple heuristic)
  const danishWords = [' og ', ' det ', ' en ', ' der ', ' på ', ' til ', ' med ', ' ikke ', ' er ']
  let score = 0
  for (const w of danishWords) if (sample.includes(w)) score++
  if (score >= 2) return 'da'
  return 'en'
}

// Client-side implementation that calls the Supabase Edge Function '/functions/v1/spelling'
// Falls back to a small offline heuristic if the network call fails.
class SupabaseSpellingAI {
  private endpoint: string
  constructor(endpoint?: string) {
    this.endpoint = endpoint || (import.meta.env.VITE_SUPABASE_FUNCTION_SPELLING as string)
  }

  async analyze(_ctx: GenerateContext) {
    // lightweight placeholder — could extend with language detection etc.
    return { base: (_ctx.draftCaption || '').trim() }
  }

  async generate(ctx: GenerateContext): Promise<SpellOut> {
    const text = (ctx.draftCaption || '')

    // If no endpoint configured, fallback to local stub
    if (!this.endpoint) {
      return this.localFallback(text)
    }

    try {
      // If language is not provided or set to 'auto', attempt to detect it client-side
      const lang = (ctx.language || 'auto') === 'auto' ? detectLanguage(text) : ctx.language

      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: lang })
      })

      if (!res.ok) {
        console.warn('Spelling function returned non-OK, falling back', await res.text())
        return this.localFallback(text)
      }

      const data = await res.json()
      if (data?.corrected && typeof data.corrected === 'string') {
        return { corrected: data.corrected }
      }

      return this.localFallback(text)
    } catch (err) {
      console.error('Spelling AI call failed, falling back:', err)
      return this.localFallback(text)
    }
  }

  validate(_out: SpellOut) {
    return { ok: true as const }
  }

  private localFallback(text: string): SpellOut {
    const corrected = text
      .replace(/\s{2,}/g, ' ')
      .replace(/\bteh\b/gi, 'the')
      .trim()
    return { corrected }
  }
}

export function resolveSpellingFeature() {
  return new SupabaseSpellingAI()
}

export async function checkSpelling(ctx: GenerateContext): Promise<string> {
  const impl = resolveSpellingFeature()
  await impl.analyze(ctx)
  const out = await impl.generate(ctx)
  return out.corrected
}
