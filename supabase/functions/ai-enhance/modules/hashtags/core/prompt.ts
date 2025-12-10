import { sanitizeForHashtagValue, type HashtagPlan } from '../../../tone-cards.ts'
import { PROMPT_EXCLUDED_HASHTAG_KEYS } from '../constants.ts'
import { normalizeHashtag } from '../utils.ts'
import type { EnhancedContent } from './types.ts'

export interface BuildHashtagPromptOptions {
  plan: HashtagPlan
  businessProfile: any
  languageLabel: string
  platforms: string[]
  enhancedContent: EnhancedContent
  topicKeywords: string[]
  topicKeywordDisplays: string[]
  hashtagGuidance: string
  season?: string
  activeEvents?: string[]
}

function filterPlanTags(values: string[]): string[] {
  const seen = new Set<string>()
  const filtered: string[] = []

  values.forEach((tag) => {
    const key = sanitizeForHashtagValue(tag)
    if (!key) {
      return
    }
    if (PROMPT_EXCLUDED_HASHTAG_KEYS.has(key)) {
      return
    }
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    filtered.push(tag)
  })

  return filtered
}

function buildPlanSummary(plan: HashtagPlan): string {
  const shared = filterPlanTags(plan.shared)
  const instagramOnly = filterPlanTags(plan.instagramOnly)
  const seasonal = filterPlanTags(plan.seasonal)

  const parts: string[] = []
  if (shared.length > 0) {
    parts.push(`Shared essentials: ${shared.join(', ')}`)
  }
  if (instagramOnly.length > 0) {
    parts.push(`Instagram-focused: ${instagramOnly.join(', ')}`)
  }
  if (seasonal.length > 0) {
    parts.push(`Seasonal ideas: ${seasonal.join(', ')}`)
  }
  if (plan.branded) {
    parts.push(`Branded template: ${plan.branded}`)
  }

  return parts.join('\n')
}

function buildBusinessContext(profile: any): string {
  if (!profile) {
    return ''
  }

  const pieces: string[] = []
  if (profile.business_name) {
    pieces.push(`Business name: ${profile.business_name}`)
  }
  if (profile.business_category) {
    pieces.push(`Category: ${profile.business_category}`)
  }
  if (profile.city || profile.region) {
    pieces.push(`Location: ${[profile.city, profile.region].filter(Boolean).join(', ')}`)
  }
  if (profile.keywords && profile.keywords.length > 0) {
    const keywords = Array.isArray(profile.keywords)
      ? profile.keywords.join(', ')
      : profile.keywords
    pieces.push(`Keywords: ${keywords}`)
  }

  return pieces.join('\n')
}

function buildLocationHints(profile: any): string[] {
  const hints: string[] = []
  if (typeof profile?.city === 'string' && profile.city.trim()) {
    hints.push(profile.city.trim())
  }
  if (typeof profile?.region === 'string' && profile.region.trim()) {
    hints.push(profile.region.trim())
  }
  return hints
}

export function buildHashtagPrompt(options: BuildHashtagPromptOptions): string {
  const {
    plan,
    businessProfile,
    languageLabel,
    platforms,
    enhancedContent,
    topicKeywords,
    topicKeywordDisplays,
    hashtagGuidance,
  } = options

  const planSummary = buildPlanSummary(plan)
  const hashtagBusinessContext = buildBusinessContext(businessProfile)
  const locationHints = buildLocationHints(businessProfile)

  const topicKeywordList = topicKeywordDisplays.join(', ')
  const hasTopicKeywords = topicKeywords.length > 0

  const topicInstruction = hasTopicKeywords
    ? `\n- PRIORITÉR disse nøgleord fra teksten: ${topicKeywordList}`
    : ''

  const ingredientInstruction = hasTopicKeywords
    ? `\n- Lav hashtags baseret på de vigtigste retter eller ingredienser fra teksten: ${topicKeywordList}`
    : ''

  const locationInstruction = locationHints.length > 0
    ? `\n- Medtag mindst ét lokalt hashtag med: ${locationHints.join(', ')}`
    : ''

  const businessCategory = typeof businessProfile?.business_category === 'string'
    ? businessProfile.business_category
    : 'cafe'

  const authenticityInstruction = `\n- KRITISK: Brug KUN hashtags for elementer der er DIREKTE nævnt i teksten eller business profilen
- Generiske kategori-hashtags som #${businessCategory} er OK selv uden omtale
- Tilføj IKKE hashtags for ting der ikke nævnes (fx ikke #brunch hvis der ikke står noget om brunch)`

  const seasonInstruction = `\n- Sæson-hashtags kun når teksten eller konteksten klart refererer til sæsonen`

  const brandedExample = typeof businessProfile?.business_name === 'string'
    ? normalizeHashtag(businessProfile.business_name)
    : null

  const brandedInstruction = brandedExample
    ? `\n- Inkluder branded hashtag: ${brandedExample}`
    : ''

  const platformList = platforms.join(', ')

  const businessType = typeof businessProfile?.business_category === 'string'
    ? businessProfile.business_category
    : 'virksomhed'

  const planGuidance = planSummary ? `\n- Overvej disse kategori-hashtags: ${planSummary}` : ''
  const extraGuidance = hashtagGuidance ? `\n- Vejledning: ${hashtagGuidance}` : ''
  const businessContextBlock = hashtagBusinessContext ? `\n\nForretningsinfo:\n${hashtagBusinessContext}` : ''

  // Build business context header
  const businessName = businessProfile?.business_name || 'virksomhed'
  const businessCity = businessProfile?.city || ''
  const businessCountry = businessProfile?.country || ''
  const businessLocation = [businessCity, businessCountry].filter(Boolean).join(', ')
  
  const seasonInfo = options.season ? ` | Sæson: ${options.season}` : ''
  const eventsInfo = options.activeEvents && options.activeEvents.length > 0 
    ? ` | Arrangementer: ${options.activeEvents.join(', ')}` 
    : ''
  
  const contextHeader = businessLocation 
    ? `Virksomhed: ${businessName} (${businessLocation})${seasonInfo}${eventsInfo}`
    : `Virksomhed: ${businessName}${seasonInfo}${eventsInfo}`

  const finalPrompt = `Lav relevante hashtags til ${contextHeader} med denne tekst:\n\n${enhancedContent.text}\n\nKrav:\n- Returner hashtags på ${languageLabel} til platforme: ${platformList}\n- Brug kun relevante, konkrete hashtags (ingen fyld eller spam).\n- Hvis platforme inkluderer "Facebook":\n  • Hashtags skal være brede, enkle og ikke for niche.\n  • Fokusér på brand, lokation og sæson/stemning (ikke specifikke retter/ingredienser).\n  • Facebook bør primært bruge hashtags fra "primary" og "local".\n- Hvis platforme inkluderer "Instagram":\n  • Det er OK at bruge mere specifikke hashtags om retter, sæson, stemning og mad/drikke.\n  • Samlet antal hashtags (alle arrays til sammen) bør typisk være 3–7.\n  • "foodie" og "extras" er primært tiltænkt Instagram.\n\n- Kategoriser i fire arrays med # foran:\n  • primary: 1–3 essentielle hashtags, der er brede nok til brand/lokation/stemning og kan bruges på alle angivne platforme.\n  • local: 1–2 lokale/geo-relaterede hashtags (by, område, kvarter, region).\n  • foodie: 0–4 mad/drikke-relaterede hashtags (brug kun hvis teksten nævner mad eller drikke; særligt relevante for Instagram).\n  • extras: 0–3 sæson-/stemnings-hashtags (f.eks. jul, hygge, vinter, brunchstemning).\n\n- Undgå spammy eller for brede hashtags som: #love, #happy, #photo, #follow4follow, #instagood, #food.\n- Fokusér på FAKTISKE elementer fra teksten${authenticityInstruction}${brandedInstruction}${seasonInstruction}${topicInstruction}${ingredientInstruction}${locationInstruction}${planGuidance}${extraGuidance}${businessContextBlock}\n\nReturner KUN JSON (ingen forklaring, ingen ekstra tekst):\n{\n  "primary": ["#example"],\n  "local": ["#city"],\n  "foodie": ["#food"],\n  "extras": ["#optional"]\n}`
  
  console.log(`🏷️  Hashtag prompt language: "${languageLabel}"`)
  return finalPrompt
}
