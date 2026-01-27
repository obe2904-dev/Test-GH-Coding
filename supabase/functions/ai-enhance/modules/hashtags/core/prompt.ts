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

  // Get current month to determine appropriate seasonal examples
  const currentMonth = new Date().getUTCMonth() // 0 = January, 11 = December
  const currentDay = new Date().getUTCDate()
  
  // Determine season-appropriate examples
  let moodExample = '#Hygge'
  let foodieExamples = '#Kaffe, #Kage'
  let extrasExamples = '#Hygge, #AarhusFood'
  let forbiddenFoodExamples = '#Kaffe, #Vin, #Cocktails, #Retter'
  let forbiddenMoodExamples = '#CosyCafe'
  let allowedMoodExamples = '#Hygge (OK - bred)'
  let specificFoodExamples = '#Brunch, #Cocktails, #Kaffe'
  let specificMoodExamples = '#CosyCafe, #Hygge'
  
  // December: Christmas examples
  if (currentMonth === 11) {
    moodExample = '#Julehygge'
    foodieExamples = '#Gløgg, #Æbleskiver'
    extrasExamples = '#Julehygge, #AarhusFood'
    forbiddenMoodExamples = '#CosyCafe, #JulehyggeCafe'
    allowedMoodExamples = '#Julehygge (OK - bred)\n- #Jul (OK - bred)'
    specificFoodExamples = '#Gløgg, #Æbleskiver, #Brunch, #Cocktails'
    specificMoodExamples = '#CosyCafe, #JulehyggeCafe, #Hygge'
  }
  // January-February: Winter examples (no Christmas)
  else if (currentMonth === 0 || currentMonth === 1) {
    moodExample = '#Vinterhygge'
    foodieExamples = '#VarmKakao, #Suppe'
    extrasExamples = '#Vinterhygge, #AarhusFood'
    forbiddenMoodExamples = '#CosyCafe'
    allowedMoodExamples = '#Vinterhygge (OK - bred)\n- #Vinter (OK - bred)'
    specificFoodExamples = '#Brunch, #Cocktails, #VarmDrik'
    specificMoodExamples = '#CosyCafe, #Vinterhygge, #Hygge'
  }
  // March-May: Spring examples
  else if (currentMonth >= 2 && currentMonth <= 4) {
    moodExample = '#Forårshygge'
    foodieExamples = '#Brunch, #Påske'
    extrasExamples = '#Forårshygge, #AarhusFood'
    allowedMoodExamples = '#Forårshygge (OK - bred)\n- #Forår (OK - bred)'
    specificFoodExamples = '#Brunch, #Påskefrokost, #Kaffe'
    specificMoodExamples = '#CosyCafe, #Forårshygge, #Hygge'
  }
  // June-August: Summer examples
  else if (currentMonth >= 5 && currentMonth <= 7) {
    moodExample = '#Sommerhygge'
    foodieExamples = '#Iskaffe, #Cocktails'
    extrasExamples = '#Sommerhygge, #AarhusFood'
    forbiddenFoodExamples = '#VarmKakao, #Gløgg, #Suppe'
    allowedMoodExamples = '#Sommerhygge (OK - bred)\n- #Sommer (OK - bred)'
    specificFoodExamples = '#Iskaffe, #Cocktails, #Brunch'
    specificMoodExamples = '#CosyCafe, #Sommerhygge, #Hygge'
  }
  // September-November: Autumn examples
  else {
    moodExample = '#Efterårshygge'
    foodieExamples = '#VarmKakao, #Æbletærte'
    extrasExamples = '#Efterårshygge, #AarhusFood'
    allowedMoodExamples = '#Efterårshygge (OK - bred)\n- #Efterår (OK - bred)'
    specificFoodExamples = '#Brunch, #VarmDrik, #Æbletærte'
    specificMoodExamples = '#CosyCafe, #Efterårshygge, #Hygge'
  }

  const finalPrompt = `Lav relevante hashtags til ${contextHeader} med denne tekst:\n\n${enhancedContent.text}\n\n🎯 DU GENERERER TO SEPARATE HASHTAG-SÆT:\n\n═══════════════════════════════════════\n📘 FACEBOOK HASHTAGS (2-3 hashtags MAX)\n═══════════════════════════════════════\nFacebook users don't browse via hashtags - keep it SIMPLE!\n\n"facebook": {\n  "brand": ["#${normalizeHashtag(businessName)}"] (virksomhedens navn - INTET andet)\n  "location": ["#${businessCity || 'Aarhus'}"] (KUN by-navn - INGEN kombinationer)\n  "mood": ["${moodExample}"] (VALGFRIT - kun bred sæson/stemning)\n}\n\n⛔ STRENGT FORBUDT i Facebook:\n❌ Mad/drikke hashtags: INGEN ${forbiddenFoodExamples}\n❌ Kombinerede location: INGEN #AarhusFood, #VisitAarhus, #CopenhagenEats\n❌ Niche områder: INGEN #Latinkvarteret, #Nørrebro, #Vesterbro\n❌ Specifikke stemninger: INGEN ${forbiddenMoodExamples}\n\n✅ KORREKT Facebook location: Bare by-navnet\n- #Aarhus (IKKE #AarhusFood)\n- #København (IKKE #CopenhagenFood eller #VisitCopenhagen)\n- #Odense (IKKE #OdenseEats)\n\n✅ KORREKT Facebook mood: Bred sæson kun\n- ${allowedMoodExamples}\n\n═══════════════════════════════════════\n📸 INSTAGRAM-SPECIFIKKE HASHTAGS (4-6 hashtags)\n═══════════════════════════════════════\nInstagram users BROWSE via hashtags - vær specifik!\nDisse hashtags er I TILLÆG til Facebook-hashtags.\n\n"instagram": {\n  "foodie": 2-4 specifikke mad/drikke tags (f.eks. ${foodieExamples})\n  "extras": 1-3 detaljerede tags (f.eks. ${extrasExamples})\n}\n\n✅ Instagram KAN have:\n- Specifikke retter: ${specificFoodExamples}\n- Kombinerede location: #AarhusFood, #CopenhagenEats, #VisitAarhus\n- Niche områder: #Latinkvarteret, #Nørrebro (hvis relevant)\n- Specifikke stemninger: ${specificMoodExamples}\n\n⚠️ UNDGÅ at gentage Facebook-hashtags\n⚠️ UNDGÅ generiske tags (#food, #love, #instagood)\n\n${seasonInstruction}${topicInstruction}${ingredientInstruction}${locationInstruction}${planGuidance}${extraGuidance}${businessContextBlock}\n\n🎯 VIGTIGT:\n- Facebook-hashtags bruges ALTID alene på Facebook\n- Instagram viser: Facebook-hashtags + Instagram-specifikke hashtags\n- Total til Instagram: 6-10 hashtags\n\nReturner på ${languageLabel} som JSON:\n{\n  "facebook": {\n    "brand": ["#${businessName.replace(/\s+/g, '')}"],\n    "location": ["#${businessCity || 'Aarhus'}"],\n    "mood": ["${moodExample}"]\n  },\n  "instagram": {\n    "foodie": [${foodieExamples.split(', ').map(t => `"${t}"`).join(', ')}],\n    "extras": [${extrasExamples.split(', ').map(t => `"${t}"`).join(', ')}]\n  }\n}`
  
  console.log(`🏷️  Hashtag prompt language: "${languageLabel}", season examples: ${moodExample}`)
  return finalPrompt
}
