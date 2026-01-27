/**
 * Contract Validators
 * 
 * Functions that validate Prompt A output contracts (distinctive hooks, evidence, sources).
 * Ensures AI follows instructions and provides traceable evidence for all claims.
 */

export const DISTINCTIVE_HOOK_SOURCES = new Set([
  'website_analysis',
  'business_profile',
  'menu_data',
  'location_data',
  'images',
  'social_accounts',
  'menu_structure',
  'business_name',
  'business_description',
  'location_enrichment',
  'website_text',
  'menu_items',
  'menu_categories',
])

export const DISTINCTIVE_HOOK_CONFIDENCE = new Set(['high', 'medium', 'low'])

export function normalizeForContainmentCheck(input: string): string {
  return input.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function buildEvidenceCorpus(dataSources: any): string {
  const { business, profile, menu, images, websiteAnalysis, socialAccounts } = dataSources

  // Import needed helpers
  const extractStructuredWebsiteData = (ws: any, b: any) => {
    // Simplified extraction - in real code this would import from data-gatherer
    return {
      metaTitles: [],
      metaDescriptions: [],
      headers: [],
      heroTexts: [],
      aboutSnippets: [],
      imageAltSignals: [],
      imageCaptions: [],
      uniqueNounCues: [],
      ctaTexts: [],
      valuePhrases: [],
      menuCategoriesMentioned: [],
      aboutTone: '',
      rawExcerpt: ''
    }
  }

  const buildMenuSummary = (items: any[], limit: number) => {
    return items.slice(0, limit).map((item: any) => {
      let line = `- ${item.name || item.title || item.item_name || ''}`
      if (item.description) line += `: ${item.description}`
      if (item.price) line += ` (${item.price})`
      return line
    }).join('\n')
  }

  const buildImagesSummary = (imgs: any[], limit: number) => {
    return imgs.slice(0, limit).map((img: any) => img.alt_text || img.caption || '').filter(Boolean).join('\n')
  }

  const buildSocialSummary = (accounts: any[]) => {
    return accounts.map((acc: any) => `${acc.platform}: ${acc.bio || ''}`).join('\n')
  }

  const structuredWebsite = extractStructuredWebsiteData(websiteAnalysis, business)
  const menuSummary = buildMenuSummary(menu || [], 50)
  const imagesSummary = buildImagesSummary(images || [], 20)
  const socialSummary = buildSocialSummary(socialAccounts || [])

  const profileText = [
    profile?.short_description,
    profile?.long_description,
    profile?.target_audience,
    profile?.price_level
  ].filter(Boolean).join('\n')

  const businessText = [
    business?.business_name,
    business?.name,
    business?.business_category,
    business?.city,
    business?.address,
    business?.country
  ].filter(Boolean).join('\n')

  const websiteText = [
    ...(structuredWebsite.metaTitles || []),
    ...(structuredWebsite.metaDescriptions || []),
    ...(structuredWebsite.headers || []),
    ...(structuredWebsite.heroTexts || []),
    ...(structuredWebsite.aboutSnippets || []),
    ...(structuredWebsite.imageAltSignals || []),
    ...(structuredWebsite.imageCaptions || []),
    ...(structuredWebsite.uniqueNounCues || []),
    ...(structuredWebsite.ctaTexts || []),
    ...(structuredWebsite.valuePhrases || []),
    ...(structuredWebsite.menuCategoriesMentioned || []),
    structuredWebsite.aboutTone,
    structuredWebsite.rawExcerpt
  ].filter(Boolean).join('\n')

  return [
    businessText,
    profileText,
    'MENU:',
    menuSummary,
    'IMAGES:',
    imagesSummary,
    'SOCIAL:',
    socialSummary,
    'WEBSITE:',
    websiteText
  ].filter(Boolean).join('\n\n')
}

export function validateDistinctiveHooksContract(analysis: any, dataSources: any): string[] {
  const errors: string[] = []

  const corpus = normalizeForContainmentCheck(buildEvidenceCorpus(dataSources))
  const hasEvidence = (evidence: unknown): boolean => {
    if (typeof evidence !== 'string') return false
    const trimmed = evidence.trim()
    if (trimmed.length < 6) return false
    const normalized = normalizeForContainmentCheck(trimmed)
    return normalized.length >= 6 && corpus.includes(normalized)
  }

  const requireArray = (key: string) => {
    if (!analysis || !Array.isArray(analysis[key])) {
      errors.push(`Missing or invalid "${key}" (must be an array)`)
      return []
    }
    return analysis[key] as any[]
  }

  const validateItems = (
    key: string,
    itemLabelKey: string,
    evidenceKey: string,
    sourceKey: string,
    confidenceKey: string
  ) => {
    const arr = requireArray(key)
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i]
      if (!item || typeof item !== 'object') {
        errors.push(`Invalid item in "${key}" at index ${i} (must be object)`)
        continue
      }

      const labelVal = (item as any)[itemLabelKey]
      if (typeof labelVal !== 'string' || !labelVal.trim()) {
        errors.push(`Missing "${itemLabelKey}" in "${key}" at index ${i}`)
      }

      const evidenceVal = (item as any)[evidenceKey]
      if (!hasEvidence(evidenceVal)) {
        errors.push(`"${key}" index ${i} has missing/invalid evidence (must be exact snippet from input)`)
      }

      const sourceVal = (item as any)[sourceKey]
      if (typeof sourceVal !== 'string' || !sourceVal.trim()) {
        errors.push(`"${key}" index ${i} has missing source`)
      } else {
        const s = sourceVal.trim()
        const looksLikeProvenance = s.includes('|') && /^[a-z0-9_\-|]+$/i.test(s) && s.length <= 120
        if (!DISTINCTIVE_HOOK_SOURCES.has(s) && !looksLikeProvenance) {
          errors.push(`"${key}" index ${i} has invalid source (use known label or provenance string like website_analysis|homepage|h2)`)
        }
      }

      const confVal = (item as any)[confidenceKey]
      const validString = typeof confVal === 'string' && DISTINCTIVE_HOOK_CONFIDENCE.has(confVal)
      const validNumber = typeof confVal === 'number' && !Number.isNaN(confVal) && confVal >= 0 && confVal <= 1 // Legacy format
      if (!validString && !validNumber) {
        errors.push(`"${key}" index ${i} has invalid confidence (must be "high"|"medium"|"low" string enum, numeric format deprecated)`)
      }
    }
  }

  validateItems('distinctive_hooks', 'hook', 'evidence', 'source', 'confidence')
  validateItems('physical_space_cues', 'cue', 'evidence', 'source', 'confidence')
  validateItems('rituals_and_moments', 'moment', 'evidence', 'source', 'confidence')
  validateItems('local_identity_cues', 'cue', 'evidence', 'source', 'confidence')
  validateItems('copy_patterns', 'pattern', 'evidence', 'source', 'confidence')

  return errors
}

export function ensureDistinctiveHooksMinimum(analysis: any): any {
  const hooks = Array.isArray(analysis?.distinctive_hooks) ? analysis.distinctive_hooks : []

  // Step 5 hard truth: treat generic/low-information hooks as "missing" so we nudge the user
  // instead of forcing the system into generic/hallucination-prone outputs.
  const disallowedWords = new Set<string>()
  if (analysis?.signals) {
    Object.values(analysis.signals).forEach((signal: any) => {
      if (Array.isArray(signal?.disallowed_generic_words)) {
        signal.disallowed_generic_words.forEach((word: any) => {
          const w = String(word || '').toLowerCase().trim()
          if (w) disallowedWords.add(w)
        })
      }
    })
  }
  const domainAllowlist = new Set<string>([
    'mad', 'menu', 'retter', 'drikke', 'drikkevarer', 'kaffe', 'brunch', 'frokost', 'aften', 'vin', 'øl', 'cocktails'
  ])
  const isAllowedDisallowedWord = (word: string): boolean => {
    const w = word.toLowerCase().trim()
    if (!w) return true
    if (w.length < 5) return true
    if (domainAllowlist.has(w)) return true
    return false
  }
  const isLowQualityHookText = (hookText: string): boolean => {
    const t = hookText.toLowerCase().replace(/\s+/g, ' ').trim()
    if (t.length < 10) return true
    // Common generic hook patterns (Danish/English)
    if (/\b(perfekt\s+til|unikke\s+oplevelser|kulinariske\s+oplevelser|lækker\s+mad|lækkert\s+mad|good\s+vibes|culinary\s+experiences)\b/i.test(t)) return true
    let hit = false
    disallowedWords.forEach((w) => {
      if (hit) return
      if (isAllowedDisallowedWord(w)) return
      if (t.includes(w)) hit = true
    })
    return hit
  }
  const usableHooks = hooks.filter((h: any) => {
    const ht = typeof h?.hook === 'string' ? h.hook.trim() : ''
    if (!ht) return false
    return !isLowQualityHookText(ht)
  })

  if (usableHooks.length >= 2) return analysis

  return {
    ...analysis,
    distinctive_hooks: [],
    evidence: {
      ...(analysis?.evidence || {}),
      generic_anchor_risk: true,
      distinctive_hooks_missing: true
    }
  }
}

export function computeDifferentiationConfidence(analysis: any): { score: number; level: 'high' | 'medium' | 'low'; hooksCount: number } {
  const hooks: any[] = Array.isArray(analysis?.distinctive_hooks) ? analysis.distinctive_hooks : []
  const hooksCount = hooks.length

  // Map confidence to numeric score for internal calculations
  // Accepts both string enum (preferred, from Prompt A) and legacy numeric format
  const mapConfidence = (v: unknown): number => {
    // Preferred: string enum from Prompt A ("high", "medium", "low")
    if (typeof v === 'string') {
      const s = v.toLowerCase().trim()
      if (s === 'high') return 0.85
      if (s === 'medium') return 0.6
      if (s === 'low') return 0.35
    }
    // Legacy: numeric confidence (0.0-1.0) - for backward compatibility only
    if (typeof v === 'number' && !Number.isNaN(v)) return Math.max(0, Math.min(1, v))
    // Default: medium confidence
    return 0.5
  }

  // Base: hooks are the strongest signal for differentiation
  let score = 0.5

  if (hooksCount < 2) {
    score = 0.2
  } else {
    const avg = hooks.slice(0, 4).map(h => mapConfidence(h?.confidence)).reduce((a, b) => a + b, 0) / Math.min(hooksCount, 4)
    score = 0.45 + 0.55 * avg
  }

  // Penalize known genericness risk
  if (analysis?.evidence?.generic_anchor_risk) score -= 0.15

  // Clamp
  score = Math.max(0.05, Math.min(1, score))

  const level = score >= 0.75 ? 'high' : score >= 0.5 ? 'medium' : 'low'
  return { score, level, hooksCount }
}
