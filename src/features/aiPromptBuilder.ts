import { Database } from '../types/database'
import { type UserTier } from '../config/ai-models'
import { getAIModelForTier as getAIModelFromConfig } from '../config/ai-models'
import type { EnhancedAIContext } from '../services/enhancedAIContext'
import { formatOfferingsForPrompt, formatOpeningHoursForPrompt } from '../services/enhancedAIContext'
import { getPromptI18n, normalizePromptLanguage, withMarker } from './promptI18n'

type Business = Database['public']['Tables']['businesses']['Row']

/**
 * Helper to build consistent prompt sections with clear headers.
 * Headers can be localized; backend parsing supports both English + Danish variants.
 */
const section = (title: string, body: string): string => {
  const trimmed = body.trim()
  if (!trimmed) return ''
  return `\n\n=== ${title} ===\n${trimmed}\n`
}

const sectionWithMarker = (
  marker: string,
  localizedLabel: string,
  lang: 'da' | 'en',
  body: string
): string => section(withMarker(marker, localizedLabel, lang), body)

const extractQuotedPhrases = (text: string): string[] => {
  const out: string[] = []
  if (!text) return out

  const patterns = [
    /'([^']{3,200})'/g,
    /"([^"]{3,200})"/g,
  ]

  for (const re of patterns) {
    let match: RegExpExecArray | null
    while ((match = re.exec(text)) !== null) {
      const phrase = match[1].trim()
      if (phrase && !out.includes(phrase)) out.push(phrase)
    }
  }

  return out
}

type EvidenceItem = { sourceUrl?: string | null; quote?: string | null }
type VenueHook = {
  text?: string | null
  hook?: string | null
  confidence?: number | null
  evidence?: EvidenceItem[] | null
}
type VenueHooksPayload = {
  uniqueHooks?: VenueHook[] | null
  positioning?: {
    vibeKeywords?: string[] | null
    avoidKeywords?: string[] | null
    evidence?: EvidenceItem[] | null
  } | null
}

type ExperiencePillar = {
  type?: string | null
  title?: string | null
  why?: string | null
  confidence?: number | null
  evidence?: EvidenceItem[] | null
}

type ExperiencePillarsPayload = {
  recommendedPillars?: ExperiencePillar[] | null
  supportedAssets?: Record<string, boolean> | null
}

// ============================================================================
// BEHAVIORAL DRIVERS (Internal Layer - Not UI-facing)
// ============================================================================

/**
 * Behavioral Driver: WHY people choose this place (not WHO they are)
 * Evidence-anchored, inferred from existing signals
 */
export interface BehavioralDriver {
  id: string
  behavior: string           // What they do (e.g., "Come for brunch, stay for hours")
  tension: string            // What problem/need drives this (e.g., "Need a place where slow pace is OK")
  desiredOutcome: string     // What they want to achieve (e.g., "Relax without feeling rushed")
  confidence: number         // 0-1 (based on evidence strength)
  proof: string[]            // 1-3 short evidence lines
}

/**
 * Content Trigger: Converts behavioral driver into AI instruction
 */
export interface ContentTrigger {
  trigger: string            // Behavioral hook (e.g., "dag→aften flow")
  instruction: string        // How to use it in content (e.g., "Suggest staying from lunch into evening")
  proof: string[]            // Supporting evidence
  confidence: number         // 0-1
}

const truncate = (s: string, max: number): string => (s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…')

const formatEvidence = (evidence: EvidenceItem[] | null | undefined, max: number): string => {
  const items = (evidence || [])
    .map((e) => ({
      quote: String(e?.quote || '').trim(),
      url: String(e?.sourceUrl || '').trim(),
    }))
    .filter((e) => e.quote && e.url)
    .slice(0, max)

  if (items.length === 0) return ''

  return items
    .map((e) => `  - “${truncate(e.quote, 160)}”\n    Kilde: ${e.url}`)
    .join('\n')
}

const formatVenueHooksForPrompt = (payload: unknown, lang: 'da' | 'en'): string => {
  const p = payload as VenueHooksPayload
  const hooks = (p?.uniqueHooks || [])
    .map((h) => ({
      text: String(h?.text || h?.hook || '').trim(),
      confidence: typeof h?.confidence === 'number' ? h.confidence : null,
      evidence: h?.evidence || [],
    }))
    .filter((h) => h.text)

  const pos = p?.positioning || null
  const vibe = (pos?.vibeKeywords || []).map((s) => String(s).trim()).filter(Boolean)
  const avoid = (pos?.avoidKeywords || []).map((s) => String(s).trim()).filter(Boolean)
  const posEvidence = formatEvidence(pos?.evidence || [], 2)

  if (hooks.length === 0 && vibe.length === 0 && avoid.length === 0) return ''

  const title = lang === 'da' ? 'VENUE HOOKS (EVIDENS)' : 'VENUE HOOKS (EVIDENCE)'
  const rule =
    lang === 'da'
      ? 'REGLER: Brug kun hooks/claims der er støttet af citaterne her. Hvis evidensen mangler, så lad være med at nævne det.'
      : 'RULES: Only use hooks/claims that are supported by the quotes below. If evidence is missing, do not mention it.'

  const lines: string[] = [title, rule]

  if (hooks.length > 0) {
    lines.push(lang === 'da' ? 'Unikke fysiske/placering/oplevelse-hooks:' : 'Distinct physical/place/experience hooks:')
    for (const h of hooks.slice(0, 6)) {
      const ev = formatEvidence(h.evidence, 1)
      lines.push(`- ${h.text}${h.confidence != null ? ` (confidence ${h.confidence.toFixed(2)})` : ''}`)
      if (ev) lines.push(ev)
    }
  }

  if (vibe.length > 0 || avoid.length > 0) {
    lines.push(lang === 'da' ? 'Positionering / vibe:' : 'Positioning / vibe:')
    if (vibe.length > 0) lines.push(`${lang === 'da' ? 'Vibe-ord' : 'Vibe keywords'}: ${vibe.join(', ')}`)
    if (avoid.length > 0) lines.push(`${lang === 'da' ? 'Undgå-ord' : 'Avoid keywords'}: ${avoid.join(', ')}`)
    if (posEvidence) lines.push(posEvidence)
  }

  return lines.join('\n')
}

const formatExperiencePillarsForPrompt = (payload: unknown, lang: 'da' | 'en'): string => {
  const p = payload as ExperiencePillarsPayload
  const pillars = (p?.recommendedPillars || [])
    .map((x) => ({
      type: String(x?.type || '').trim(),
      title: String(x?.title || '').trim(),
      why: String(x?.why || '').trim(),
      confidence: typeof x?.confidence === 'number' ? x.confidence : null,
      evidence: x?.evidence || [],
    }))
    .filter((x) => x.type)

  const assets = p?.supportedAssets || null
  const assetPairs = assets
    ? Object.entries(assets)
        .filter(([, v]) => v === true)
        .map(([k]) => k)
    : []

  if (pillars.length === 0 && assetPairs.length === 0) return ''

  const title = lang === 'da' ? 'OPLEVELSESPILLER (EVIDENS)' : 'EXPERIENCE PILLARS (EVIDENCE)'
  const rule =
    lang === 'da'
      ? 'REGLER: Brug disse som “vinkel-kort” til de 3 ideer. Vælg de mest oplagte ud fra evidens og daypart (fx brunch/cocktails/aften). Opfind ikke events/tilbud.'
      : 'RULES: Use these as the “angle map” for the 3 ideas. Pick the most supported pillars based on evidence and daypart (e.g. brunch/cocktails/evening). Do not invent events/offers.'

  const lines: string[] = [title, rule]

  if (assetPairs.length > 0) {
    lines.push(`${lang === 'da' ? 'Understøttede assets' : 'Supported assets'}: ${assetPairs.join(', ')}`)
  }

  if (pillars.length > 0) {
    lines.push(lang === 'da' ? 'Anbefalede content-piller:' : 'Recommended content pillars:')
    for (const p of pillars.slice(0, 6)) {
      const label = p.title ? `${p.type} — ${p.title}` : p.type
      lines.push(`- ${label}${p.confidence != null ? ` (confidence ${p.confidence.toFixed(2)})` : ''}${p.why ? `\n  Hvorfor: ${truncate(p.why, 180)}` : ''}`)
      const ev = formatEvidence(p.evidence, 1)
      if (ev) lines.push(ev)
    }
  }

  return lines.join('\n')
}

/**
 * Extract a flat list of menu items (one per line) for strict AI compliance.
 * Returns empty string if no items found.
 */
const extractMenuItemsList = (offerings: any): string => {
  if (!offerings) return ''

  let parsed = offerings
  if (typeof offerings === 'string') {
    try {
      parsed = JSON.parse(offerings)
    } catch {
      return ''
    }
  }

  // Normalize to categories array
  let categories: any[] = []
  if (Array.isArray(parsed)) {
    categories = parsed
  } else if (parsed?.categories && Array.isArray(parsed.categories)) {
    categories = parsed.categories
  } else if (parsed?.menuStructure && Array.isArray(parsed.menuStructure)) {
    categories = parsed.menuStructure
  }

  if (categories.length === 0) return ''

  const allItems: string[] = []
  for (const category of categories) {
    const items = category.items || []
    const categoryName = category.name || 'Øvrigt'
    for (const item of items) {
      const name = typeof item === 'string' ? item : item?.name
      if (name && typeof name === 'string') {
        allItems.push(`${name.trim()} (${categoryName})`)
      }
    }
  }

  return allItems.join('\n')
}

/**
 * Extract a flat list of menu items from menu_results_v2 rows (one per line).
 * Returns empty string if no items found.
 * This is the authoritative source — prefer over extractMenuItemsList when available.
 */
const extractMenuItemsFromV2 = (menuItems: MenuItemV2[]): string => {
  if (!menuItems || menuItems.length === 0) return ''
  return menuItems
    .map(item => {
      const suffix = item.category_name ? ` (${item.category_name})` : ''
      return `${item.item_name.trim()}${suffix}`
    })
    .join('\n')
}

// ============================================================================
// BEHAVIORAL DRIVERS DERIVATION (Evidence-Anchored)
// ============================================================================

/**
 * Derives behavioral drivers from existing signals (no hallucination)
 * Uses only what we already have: services, hours, menu, booking, location
 */
function deriveBehavioralDrivers(analysisData: any, profileData: any, business: any): BehavioralDriver[] {
  const drivers: BehavioralDriver[] = []
  
  if (!analysisData) return drivers

  // Parse raw_result for structured signals
  const services = analysisData.services || []
  const menuUrls = analysisData.detectedMenuUrls || []
  const menuHighlights = analysisData.menu_highlights || []
  const openingHours = profileData?.opening_hours
  const bookingUrl = profileData?.booking_url
  const locationText = business?.city || business?.address || ''

  // DRIVER 1: Brunch → Extended Stay Behavior
  const hasBrunch = services.some((s: string) => /brunch/i.test(s)) || 
                    menuUrls.some((u: string) => /brunch/i.test(u))
  if (hasBrunch) {
    const proof = []
    if (services.includes('Brunch')) proof.push('Service listed: Brunch')
    if (menuUrls.some((u: string) => /brunch/i.test(u))) proof.push('Dedicated brunch menu page exists')
    
    drivers.push({
      id: 'stay-for-hours',
      behavior: 'Kommer til brunch, bliver siddende i flere timer',
      tension: 'Behov for et sted hvor langsomt tempo er OK',
      desiredOutcome: 'Slappe af uden at føle sig presset til at gå',
      confidence: 0.7,
      proof: proof.slice(0, 3)
    })
  }

  // DRIVER 2: Day→Evening Flow (cocktails + evening service)
  const hasCocktails = services.some((s: string) => /cocktail/i.test(s)) ||
                       menuHighlights.some((h: string) => /cocktail/i.test(h))
  const hasLateHours = openingHours && JSON.stringify(openingHours).includes('22:') || 
                       JSON.stringify(openingHours).includes('23:')
  
  if (hasCocktails && hasLateHours) {
    const proof = []
    if (services.includes('Cocktails')) proof.push('Service: Cocktails available')
    if (hasLateHours) proof.push('Opening hours: Late evening service (22:00+)')
    
    drivers.push({
      id: 'day-to-evening',
      behavior: 'Starter med mad, ender med drinks',
      tension: 'Vil ikke skulle skifte location for at fortsætte aftenen',
      desiredOutcome: 'Samme sted kan dække hele aftenen (mad → drinks)',
      confidence: 0.8,
      proof: proof.slice(0, 3)
    })
  }

  // DRIVER 3: Kids Menu → Easy Family Meals
  const hasKidsMenu = services.some((s: string) => /børn|kids|child/i.test(s)) ||
                      menuUrls.some((u: string) => /born|kids|child/i.test(u))
  if (hasKidsMenu) {
    drivers.push({
      id: 'easy-with-kids',
      behavior: 'Måltider hvor børn kan spise med uden stress',
      tension: 'Usikkerhed om stedet passer til børn',
      desiredOutcome: 'Nemt at vælge, børnene er tilfredse',
      confidence: 0.9,
      proof: ['Kids menu detected in services or menu URLs']
    })
  }

  // DRIVER 4: Booking → Secure Your Spot Behavior
  if (bookingUrl) {
    const proof = ['Booking URL present']
    if (hasLateHours) proof.push('Evening hours suggest higher demand')
    
    drivers.push({
      id: 'secure-spot',
      behavior: 'Booker bord for at være sikker på plads',
      tension: 'Bekymring for at møde op og ikke få plads',
      desiredOutcome: 'Sikkerhed for at aftenen går som planlagt',
      confidence: 0.7,
      proof: proof.slice(0, 3)
    })
  }

  // DRIVER 5: City Center / Location Context
  const isCityCenter = /center|centrum|midtby|downtown/i.test(locationText)
  if (isCityCenter) {
    drivers.push({
      id: 'quick-pause',
      behavior: 'Hurtig pause midt i byen (frokost/kaffe)',
      tension: 'Begrænset tid, men vil have kvalitet',
      desiredOutcome: 'God pause uden at bruge for lang tid',
      confidence: 0.6,
      proof: [`Location: ${locationText} (city center context)`]
    })
  }

  // DRIVER 6: Riverside / Nature Context
  const byWater = /ved åen|by the river|riverside|waterfront/i.test(JSON.stringify(analysisData)) ||
                  /ved åen|by the river/i.test(locationText)
  if (byWater) {
    drivers.push({
      id: 'nature-escape',
      behavior: 'Spiser/drikker med udsigt til vand/natur',
      tension: 'Vil væk fra byens stress',
      desiredOutcome: 'Ro og natur som en del af oplevelsen',
      confidence: 0.7,
      proof: ['Location or context mentions river/water/nature']
    })
  }

  return drivers.filter(d => d.proof.length > 0 && d.confidence >= 0.6)
}

/**
 * Converts behavioral drivers into content triggers (AI instructions)
 */
function deriveContentTriggers(drivers: BehavioralDriver[]): ContentTrigger[] {
  const triggers: ContentTrigger[] = []

  for (const driver of drivers) {
    let instruction = ''
    
    switch (driver.id) {
      case 'stay-for-hours':
        instruction = 'Frame brunch as "tag hele morgenen", "bliv siddende", "nyd langsomt tempo". Suggest multi-course or extended stays.'
        break
      case 'day-to-evening':
        instruction = 'Show flow: "Start med [meal], bliv til [drinks]". Highlight same-location convenience for full evening.'
        break
      case 'easy-with-kids':
        instruction = 'Mention kids menu casually ("der er børnemenu, så alle er med"). Focus on ease, not family-centric language.'
        break
      case 'secure-spot':
        instruction = 'Encourage booking for popular times (weekends, evenings). Use "book bord" CTA naturally.'
        break
      case 'quick-pause':
        instruction = 'Frame lunch/coffee as "hurtig pause", "midt i byen". Emphasize quality despite quick visit.'
        break
      case 'nature-escape':
        instruction = 'Mention view/location ("ved åen", "udsigt") as part of experience. Suggest outdoor seating when relevant.'
        break
    }

    if (instruction) {
      triggers.push({
        trigger: driver.behavior,
        instruction,
        proof: driver.proof,
        confidence: driver.confidence
      })
    }
  }

  return triggers
}

/**
 * Formats behavioral drivers for AI prompt (internal use only)
 */
function formatBehavioralDriversForPrompt(drivers: BehavioralDriver[], lang: 'da' | 'en'): string {
  if (drivers.length === 0) return ''

  const title = lang === 'da'
    ? 'ADFÆRDSDRIVERE (INFERERET, EVIDENS-BOUND)'
    : 'BEHAVIORAL DRIVERS (INFERRED, EVIDENCE-BOUND)'

  const rules = lang === 'da'
    ? 'REGLER: Dette er adfærdslogik (ikke fakta-claims). Brug det til vinkel og hook. Opfind ikke konkrete features.'
    : 'RULES: This is behavioral intent (not factual claims). Use it for angles/hooks. Do not invent concrete features.'

  const lines = [title, '', rules, '']
  
  drivers.slice(0, 5).forEach(d => {
    lines.push(`- ${d.behavior}`)
    lines.push(`  Tension: ${d.tension}`)
    lines.push(`  Desired Outcome: ${d.desiredOutcome}`)
    lines.push(`  Proof: ${d.proof.join(' | ')}`)
    lines.push('')
  })

  return lines.join('\n')
}

/**
 * Formats content triggers for AI prompt (how to use drivers)
 */
function formatContentTriggersForPrompt(triggers: ContentTrigger[], lang: 'da' | 'en'): string {
  if (triggers.length === 0) return ''

  const title = lang === 'da'
    ? 'AI CONTENT TRIGGERS (SÅDAN BRUGES ADFÆRDSDRIVERE)'
    : 'AI CONTENT TRIGGERS (HOW TO USE BEHAVIORAL DRIVERS)'

  const rules = lang === 'da'
    ? 'REGLER: Brug mindst 1 trigger i hver idé. Triggers er creative guidance, ikke facts.'
    : 'RULES: Use at least 1 trigger in each idea. Triggers are creative guidance, not facts.'

  const lines = [title, '', rules, '']
  
  triggers.slice(0, 6).forEach(t => {
    lines.push(`- Trigger: ${t.trigger}`)
    lines.push(`  Instruction: ${t.instruction}`)
    lines.push('')
  })

  return lines.join('\n')
}

type BusinessProfile = Database['public']['Tables']['business_profile']['Row']
type BusinessLocation = Database['public']['Tables']['business_locations']['Row']
type WebsiteAnalysis = Database['public']['Tables']['website_analyses']['Row']

/**
 * Brand Profile data structure for AI prompt generation.
 * This is the #1 priority signal for generating personalized content.
 */
export interface BrandProfileForAI {
  brandEssence?: string
  // V2 identity fields
  identityKeywords?: string[] | null
  voiceConstraints?: string | null
  toneOfVoice?: string
  /** @deprecated Use voiceConstraints instead (v2). Kept for legacy profiles. */
  thingsToAvoid?: string
  targetAudience?: string
  coreOfferings?: string[] | string
  contentFocus?: string
  ctaStyle?: string
  communicationGoal?: string
  imagePreferences?: string
  // Richer structured fields (populated when brand profile has been fully generated)
  toneModel?: {
    emoji_level?: string
    formality?: string
    writing_rules?: string[]
    good_examples?: string[]
    avoid_examples?: string[]
    primary_keywords?: string[]
  } | null
  contentPillars?: string[] | null
  socialStyle?: {
    emojiUsage?: string
    hashtagStrategy?: string
    captionLength?: string
    postingVoice?: string
  } | null
  voiceExamples?: {
    headlines?: string[]
    phrases?: string[]
    captions?: string[]
  } | null
  locationIntelligence?: {
    primary_type?: string
    matched_motivations?: string[]
    marketing_focus?: string | null
    secondary_types?: string[]
    tourist_context?: boolean
  } | null
  // Brand-specific phrases to weave into post text naturally
  signaturePhrases?: string[] | null
}

export interface MenuItemV2 {
  item_name: string
  category_name?: string | null
  is_signature?: boolean | null
}

export interface BusinessContext {
  business: Business | null
  profile: BusinessProfile | null
  location: BusinessLocation | null
  websiteAnalysis: WebsiteAnalysis | null
  brandProfile?: BrandProfileForAI | null
  enhancedContext?: EnhancedAIContext
  profileData?: {
    opening_hours?: any
    business_offerings?: any
    booking_url?: string | null
    /** Authoritative menu rows from menu_results_v2. When present and non-empty, used
     *  instead of business_offerings for MENUPUNKTER — always more current. */
    menu_items_v2?: MenuItemV2[]
  }
}

export type AITier = UserTier

export interface AIPromptOptions {
  mode: 'custom' | 'ai'
  userTopic?: string
  userTier: AITier
  language: string
  targetPlatforms?: string[]
}

export function buildPostIdeaPrompt(context: BusinessContext, options: AIPromptOptions): string {
  const { business, profile, location, websiteAnalysis, brandProfile, enhancedContext, profileData } = context
  const { mode, userTopic, userTier, language, targetPlatforms } = options

  const promptLang = normalizePromptLanguage(language)
  const i18n = getPromptI18n(promptLang)
  const isPaidTier = userTier !== 'free'

  const debugEnabled = ['1', 'true', 'yes', 'on'].includes(
    String(import.meta.env.VITE_AI_PROMPT_DEBUG || '').toLowerCase()
  )

  if (!business) {
    throw new Error('Business information is required. Please complete your business profile.')
  }

  const hasBrandProfile = !!brandProfile && Object.values(brandProfile).some((v) => v)
  const hasWebsiteData = websiteAnalysis?.raw_result !== null

  const parseRawResult = (raw: any): any | null => {
    if (!raw) return null
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw)
      } catch {
        return null
      }
    }
    return raw
  }

  // Build NON-NEGOTIABLE RULES + BRAND PROFILE (highest priority)
  let nonNegotiableRulesSection = ''
  let brandProfileSection = ''
  let toneAnchorsSection = ''
  let toneConstraintsSection = ''

  if (hasBrandProfile && brandProfile) {
    nonNegotiableRulesSection =
      promptLang === 'da'
        ? `
- Følg BRAND PROFILE helt stramt.
- Brug IKKE noget fra "Ting at undgå".
- Prioritér konkrete, specifikke detaljer frem for generiske tillægsord.
- Foto-forslag SKAL følge Billedpræferencer.
- Hvis instruktioner konflikter, så følg denne prioritering:
  1) NON-NEGOTIABLE RULES
  2) BRAND PROFILE
  3) OPERATIONAL CONTENT RULES
  4) BUSINESS CONTEXT
  5) OPTIONAL CONTEXT
`.trim()
        : `
- Follow the BRAND PROFILE strictly.
- Do NOT use anything listed in "Things to Avoid".
- Prefer concrete, specific experiences over generic adjectives.
- Photo suggestions MUST follow Image Preferences.
- If any instructions conflict, follow this priority order:
  1) NON-NEGOTIABLE RULES
  2) BRAND PROFILE
  3) OPERATIONAL CONTENT RULES
  4) BUSINESS CONTEXT
  5) OPTIONAL CONTEXT
`.trim()

    brandProfileSection =
      promptLang === 'da'
        ? `
Brandessens:
${brandProfile.brandEssence || ''}
${brandProfile.identityKeywords?.length ? `🔑 Identitet: ${brandProfile.identityKeywords.join(' · ')}` : ''}

Tone:
${brandProfile.toneOfVoice || ''}

${brandProfile.voiceConstraints ? `⚠️ Skriveprincip:
${brandProfile.voiceConstraints}` : `Ting at undgå:
${brandProfile.thingsToAvoid || ''}`}

Målgruppe:
${brandProfile.targetAudience || ''}

Kerneydelser:
${Array.isArray(brandProfile.coreOfferings) ? brandProfile.coreOfferings.join(', ') : (brandProfile.coreOfferings || '')}

Fokus for indhold:
${brandProfile.contentFocus || ''}

CTA-stil:
${brandProfile.ctaStyle || ''}

Kommunikationsmål:
${brandProfile.communicationGoal || ''}

Billedpræferencer:
${brandProfile.imagePreferences || ''}
${brandProfile.contentPillars?.length ? `\nIndholdsøjler:\n${brandProfile.contentPillars.map((p) => `- ${p}`).join('\n')}` : ''}
${brandProfile.toneModel?.emoji_level ? `Emoji-niveau: ${brandProfile.toneModel.emoji_level}` : ''}
${brandProfile.toneModel?.writing_rules?.length ? `Skriveregler: ${brandProfile.toneModel.writing_rules.join(' | ')}` : ''}
${brandProfile.toneModel?.avoid_examples?.length ? `Undgå disse formuleringer: ${brandProfile.toneModel.avoid_examples.slice(0, 4).join(', ')}` : ''}
${brandProfile.locationIntelligence?.primary_type ? `\nLokalitetstype: ${brandProfile.locationIntelligence.primary_type}${brandProfile.locationIntelligence.tourist_context ? ' (turistzone)' : ''}\nMarkedsføringsfokus: ${brandProfile.locationIntelligence.marketing_focus || brandProfile.locationIntelligence.matched_motivations?.join(', ') || ''}` : ''}
${brandProfile.locationIntelligence?.secondary_types?.length ? `Sekundære lokationstyper: ${brandProfile.locationIntelligence.secondary_types.join(', ')} — tilpas tone og indhold til dette brede publikum` : ''}
${brandProfile.signaturePhrases?.length ? `\nBrandets egne fraser (vævs ind hvis passende): ${brandProfile.signaturePhrases.join(' · ')}` : ''}
`.trim()
        : `
Brand Essence:
${brandProfile.brandEssence || ''}
${brandProfile.identityKeywords?.length ? `🔑 Identity: ${brandProfile.identityKeywords.join(' · ')}` : ''}

Tone of Voice:
${brandProfile.toneOfVoice || ''}

${brandProfile.voiceConstraints ? `⚠️ Writing Principle:\n${brandProfile.voiceConstraints}` : `Things to Avoid:\n${brandProfile.thingsToAvoid || ''}`}

Target Audience:
${brandProfile.targetAudience || ''}

Core Offerings:
${Array.isArray(brandProfile.coreOfferings) ? brandProfile.coreOfferings.join(', ') : (brandProfile.coreOfferings || '')}

Content Focus:
${brandProfile.contentFocus || ''}

CTA Style:
${brandProfile.ctaStyle || ''}

Communication Goal:
${brandProfile.communicationGoal || ''}

Image Preferences:
${brandProfile.imagePreferences || ''}
${brandProfile.contentPillars?.length ? `\nContent Pillars:\n${brandProfile.contentPillars.map((p) => `- ${p}`).join('\n')}` : ''}
${brandProfile.toneModel?.emoji_level ? `Emoji Level: ${brandProfile.toneModel.emoji_level}` : ''}
${brandProfile.toneModel?.writing_rules?.length ? `Writing Rules: ${brandProfile.toneModel.writing_rules.join(' | ')}` : ''}
${brandProfile.toneModel?.avoid_examples?.length ? `Avoid These Formulations: ${brandProfile.toneModel.avoid_examples.slice(0, 4).join(', ')}` : ''}
${brandProfile.locationIntelligence?.primary_type ? `\nLocation Type: ${brandProfile.locationIntelligence.primary_type}${brandProfile.locationIntelligence.tourist_context ? ' (tourist zone)' : ''}\nMarketing Focus: ${brandProfile.locationIntelligence.marketing_focus || brandProfile.locationIntelligence.matched_motivations?.join(', ') || ''}` : ''}
${brandProfile.locationIntelligence?.secondary_types?.length ? `Secondary Location Types: ${brandProfile.locationIntelligence.secondary_types.join(', ')} — adapt ideas and tone for this broad multi-audience location` : ''}
${brandProfile.signaturePhrases?.length ? `\nBrand Phrases (weave in naturally where fitting): ${brandProfile.signaturePhrases.join(' · ')}` : ''}
`.trim()

    const toneText = String(brandProfile.toneOfVoice || '')
    const ctaText = String(brandProfile.ctaStyle || '')
    const anchors = Array.from(new Set([...extractQuotedPhrases(toneText), ...extractQuotedPhrases(ctaText)]))
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6)

    if (anchors.length > 0) {
      toneAnchorsSection = section(
        withMarker('TONE ANCHORS', 'TONEANKRE (OBLIGATORISK)', promptLang),
        `${
          promptLang === 'da'
            ? 'Brug Brand Profile-tonen.'
            : 'Use the Brand Profile tone.'
        }

${
  promptLang === 'da'
    ? 'Mindst 1 af de 3 ideer SKAL indeholde ÉN af disse eksakte fraser (tegn-for-tegn) et sted i post-teksten:'
    : 'At least 1 of the 3 ideas MUST include ONE of these exact phrases (character-for-character) somewhere in the post text:'
}
${anchors.map((a) => `- ${a}`).join('\n')}`
      )
    }

    toneConstraintsSection = section(
      withMarker('TONE CONSTRAINTS', 'TONERAMMER (OBLIGATORISK)', promptLang),
      promptLang === 'da'
        ? `Hold tonen venlig, rolig og jordnær (ikke over-the-top).

Undgå:
- FOMO/pressætninger som "du ikke vil gå glip af"
- Poetiske metaforer som "varmer sjælen"
- Overdrevne løfter eller hype
- For meget begejstring

Stilregler:
- Max 1 udråbstegn (!) pr. idé
- Vælg enkle, konkrete beskrivelser frem for superlativer`
        : `Keep the tone friendly, calm, and grounded (not over-the-top).

Avoid:
- FOMO / pressure phrases like "you don't want to miss"
- Poetic metaphors like "warms the soul"
- Overpromising or exaggerated claims
- Excessive enthusiasm

Style rules:
- Max 1 exclamation mark (!) per idea
- Prefer simple, concrete descriptions over hype`
    )
  }

  // BUSINESS CONTEXT
  let businessContextSection = ''
  const debugLines: string[] = []
  
  // BEHAVIORAL DRIVERS & CONTENT TRIGGERS (new layer)
  let behavioralDriversSection = ''
  let contentTriggersSection = ''

  if (hasWebsiteData && websiteAnalysis?.raw_result) {
    const rawResultAny = websiteAnalysis.raw_result as any
    const rawResult = parseRawResult(rawResultAny)
    const analysisData = rawResult?.analysis || rawResult?.extracted || rawResult || {}

    // Derive behavioral drivers from existing evidence
    const drivers = deriveBehavioralDrivers(analysisData, profileData, business)
    const triggers = deriveContentTriggers(drivers)
    
    if (drivers.length > 0) {
      behavioralDriversSection = formatBehavioralDriversForPrompt(drivers, promptLang)
    }
    if (triggers.length > 0) {
      contentTriggersSection = formatContentTriggersForPrompt(triggers, promptLang)
    }

    const desc =
      analysisData.shortDescription ||
      analysisData.description ||
      analysisData.summary ||
      profile?.long_description ||
      profile?.short_description ||
      i18n.businessContext.notSpecified

    const businessName = analysisData.businessName || analysisData.name || business.name
    const businessType = analysisData.businessType || analysisData.type || analysisData.category || business.vertical
    const keywords = analysisData.keywords || analysisData.tags || []
    const menuUrls = analysisData.detectedMenuUrls || analysisData.menuUrls || []

    const venueHooks = analysisData.venueHooks || analysisData.venue_hooks || null
    const experiencePillars = analysisData.experiencePillars || analysisData.experience_pillars || null
    const venueHooksText = formatVenueHooksForPrompt(venueHooks, promptLang)
    const experiencePillarsText = formatExperiencePillarsForPrompt(experiencePillars, promptLang)

    if (debugEnabled) {
      const uniqueHooksCount = Array.isArray((venueHooks as any)?.uniqueHooks)
        ? Number((venueHooks as any).uniqueHooks.length)
        : 0
      const pillarsCount = Array.isArray((experiencePillars as any)?.recommendedPillars)
        ? Number((experiencePillars as any).recommendedPillars.length)
        : 0

      debugLines.push('IGNORE THIS SECTION: debug metadata only')
      debugLines.push(`hasWebsiteData=${String(hasWebsiteData)}`)
      debugLines.push(`rawResultType=${typeof rawResultAny}`)
      debugLines.push(`parsedOk=${String(!!rawResult)}`)
      debugLines.push(`analysisDataKeys=${Object.keys(analysisData || {}).slice(0, 20).join(', ')}`)
      debugLines.push(`venueHooks.present=${String(!!venueHooks)}`)
      debugLines.push(`venueHooks.uniqueHooks.count=${String(uniqueHooksCount)}`)
      debugLines.push(`venueHooks.formattedIncluded=${String(!!venueHooksText)}`)
      debugLines.push(`experiencePillars.present=${String(!!experiencePillars)}`)
      debugLines.push(`experiencePillars.recommendedPillars.count=${String(pillarsCount)}`)
      debugLines.push(`experiencePillars.formattedIncluded=${String(!!experiencePillarsText)}`)
    }

    businessContextSection = `
${i18n.businessContext.name}: ${businessName}
${i18n.businessContext.type}: ${businessType}
${i18n.businessContext.location}: ${location?.city || i18n.businessContext.notSpecified}
${i18n.businessContext.description}: ${desc}
${i18n.businessContext.website}: ${business.website_url}
${keywords?.length ? `${i18n.businessContext.keywords}: ${Array.isArray(keywords) ? keywords.join(', ') : keywords}` : ''}
${menuUrls?.length ? `${i18n.businessContext.hasMenuPage}: Ja` : ''}
  ${venueHooksText ? `\n\n${venueHooksText}` : ''}
  ${experiencePillarsText ? `\n\n${experiencePillarsText}` : ''}
`.trim()
  } else {
    if (debugEnabled) {
      debugLines.push('IGNORE THIS SECTION: debug metadata only')
      debugLines.push(`hasWebsiteData=${String(hasWebsiteData)}`)
      debugLines.push('venueHooks.present=false')
      debugLines.push('experiencePillars.present=false')
    }

    businessContextSection = `
${i18n.businessContext.name}: ${business.name}
${i18n.businessContext.type}: ${business.vertical}
${i18n.businessContext.location}: ${location?.city || i18n.businessContext.notSpecified}
${profile?.short_description ? `${i18n.businessContext.description}: ${profile.short_description}` : ''}
${!hasBrandProfile && profile?.target_audience ? `${i18n.businessContext.targetAudience}: ${profile.target_audience}` : ''}
`.trim()
  }

  const debugPromptSection =
    debugEnabled && debugLines.length > 0
      ? sectionWithMarker('DEBUG (IGNORE)', 'DEBUG (IGNORE)', promptLang, debugLines.join('\n'))
      : ''

  // OPTIONAL CONTEXT (paid tiers only)
  let optionalContextBody = ''
  if (isPaidTier && enhancedContext?.formattedContext) {
    optionalContextBody += enhancedContext.formattedContext.trim() + '\n'
  }

  // Add menu context as soft context (not for enforcement)
  // Prefer menu_items_v2 (authoritative) — skip verbose formatOfferingsForPrompt when v2 rows are present
  const hasMenuV2 = !!(profileData?.menu_items_v2 && profileData.menu_items_v2.length > 0)
  const menuContextText = hasMenuV2
    ? '' // strict MENUPUNKTER section below handles menu_items_v2 — skip duplicate soft block
    : (profileData?.business_offerings ? formatOfferingsForPrompt(profileData.business_offerings) || '' : '')
  if (menuContextText) {
    optionalContextBody += `\n${i18n.optionalContext.menuContextTitle} ${i18n.optionalContext.menuContextHint}:\n` + menuContextText.trim() + '\n'
  }

  const optionalContextSection = optionalContextBody
    ? sectionWithMarker('OPTIONAL CONTEXT', i18n.optionalContext.sectionTitle, promptLang, optionalContextBody)
    : ''

  // OPERATIONAL CONTENT RULES (menu + scheduling + hours + booking)
  const hasOpeningHours = !!profileData?.opening_hours
  const hasBookingUrl = !!profileData?.booking_url

  let menuItemsList = ''
  if (profileData?.menu_items_v2 && profileData.menu_items_v2.length > 0) {
    // Authoritative source: fresh rows from menu_results_v2
    menuItemsList = extractMenuItemsFromV2(profileData.menu_items_v2).trim()
  } else if (profileData?.business_offerings) {
    // Fallback: website-scraped snapshot from business_profile
    menuItemsList = extractMenuItemsList(profileData.business_offerings).trim()
  }
  const hasMenuItems = !!menuItemsList
  const sampleMenuItem = hasMenuItems ? (menuItemsList.split('\n')[0] || 'MENU_ITEM_FROM_LIST') : ''

  let operationalRulesBody = ''
  if (hasMenuItems) {
    operationalRulesBody +=
      promptLang === 'da'
        ? `
MENUPUNKTER (kopiér PRÆCIS, én pr. linje):
${menuItemsList}

REGLER FOR MENUPUNKTER (OBLIGATORISK):
- Mindst 1 idé SKAL være menu-baseret og bruge PRÆCIS ÉT menupunkt fra listen ovenfor.
- 1–2 ideer MÅ gerne være ikke-menu-baserede (storytelling, vibe, location, daypart osv.).
  - For en ikke-menu-idé: sæt "menuItemUsed" til "" (tom streng).
- For en ikke-menu-idé: Nævn IKKE konkrete retter/drikke/produkter med navn, medmindre det navn står i MENUPUNKTER-listen.
  - Brug i stedet generiske kategorier som “brunch”, “frokost”, “middag”, “varm drik”, “terrassen ved åen”.
- For en menu-idé: sæt det valgte menupunkt i feltet "menuItemUsed" (eksakt match).
- VIGTIGT: Menupunkter kan indeholde kategori i parentes, fx "RET (KATEGORI)".
  - Når du bruger et menupunkt: I kundevendt tekst må du KUN bruge selve retten UDEN kategorien.
  - Eksempel: hvis menuItemUsed er "PARISERBØF (FROKOST)", skal teksten indeholde "PARISERBØF" (ikke "(FROKOST)").
- Opfind aldrig retter eller drikkevarer, oversæt aldrig retter/drikkevarer, og omformuler aldrig rettenavnet.
`.trim()
        : `
MENU ITEMS (copy EXACTLY, one per line):
${menuItemsList}

MENU RULES (MANDATORY):
- At least 1 idea MUST be menu-based and use EXACTLY ONE menu item from the list above.
- 1–2 ideas MAY be non-menu ideas (storytelling, vibe, location, daypart, etc.).
  - For a non-menu idea: set "menuItemUsed" to "" (empty string).
- For a non-menu idea: Do NOT name specific dishes/drinks/products unless the exact name appears in the MENU ITEMS list.
  - Use generic categories instead (e.g., “brunch”, “lunch”, “dinner”, “hot drink”, “by the river terrace”).
- For a menu-based idea: output the chosen item in the field "menuItemUsed" (exact match).
- IMPORTANT: Menu items include category labels in parentheses like "DISH (CATEGORY)".
  - When you use a menu item: in customer-facing text, include ONLY the dish name WITHOUT the category suffix.
  - Example: if menuItemUsed is "PARISERBØF (FROKOST)", the text must include "PARISERBØF".
- Do NOT invent items (including drinks), do NOT translate, do NOT paraphrase.
`.trim()
  } else {
    operationalRulesBody += `
${i18n.operational.noMenuItemsProvidedTitle}:
${i18n.operational.noMenuItemsProvidedRules}
`.trim()
  }

  operationalRulesBody +=
    promptLang === 'da'
      ? `

${i18n.schedulingImpact.title} (OBLIGATORISK):
- For HVER idé: Sæt "bestTimeToPost" til en kort én-linjers anbefaling med ugedag + tidsvindue.
  - Vælg helst et tidspunkt hvor virksomheden har ÅBENT (brug ÅBNINGSTIDER hvis de er angivet).
  - Brug kategorien i menuItemUsed til at vælge et relevant tidspunkt.
- For HVER idé: Sæt "impact" til én af: low | medium | high.
  - high: timing matcher kategori + åbningstider tydeligt
  - medium: ok timing, men mindre specifik
  - low: mere niche/mindre ideel timing (stadig gyldig)
`.trim()
      : `

${i18n.schedulingImpact.title} (MANDATORY):
- For EACH idea, set "bestTimeToPost" to a short, single-line suggestion with day + time window.
  - Prefer a time when the business is OPEN (use OPENING HOURS if provided).
  - Use the menu category from menuItemUsed to pick a relevant time.
- For EACH idea, set "impact" to one of: low | medium | high.
  - high: timing strongly matches category + opening hours
  - medium: decent timing but less specific
  - low: niche/less ideal timing (still valid)
`.trim()

  if (hasOpeningHours) {
    const hoursText = formatOpeningHoursForPrompt(profileData?.opening_hours)
    if (hoursText) {
      operationalRulesBody += `

${i18n.openingHours.title}:
${hoursText}

${i18n.openingHours.rulesTitle}:
${i18n.openingHours.mustReferenceAtLeastOne}
`.trim()
    }
  }

  if (hasBookingUrl && profileData?.booking_url) {
    operationalRulesBody += `

${i18n.booking.title}:
${profileData.booking_url}

${i18n.booking.rulesTitle}:
${i18n.booking.ctaMustInclude}
${i18n.booking.urlOnOwnLine}
${i18n.booking.formatExactly}
  "Book bord her 👇
  ${profileData.booking_url}"
`.trim()
  }

  const operationalContentRulesSection = operationalRulesBody
    ? sectionWithMarker('OPERATIONAL CONTENT RULES', 'DRIFTSREGLER FOR INDHOLD', promptLang, operationalRulesBody)
    : ''

  // TASK
  let taskBody = ''
  if (mode === 'custom' && userTopic) {
    taskBody =
      promptLang === 'da'
        ? `Generér 3 post-ideer om: "${userTopic}"

IDE-TYPER (skal være forskellige):
- Idé 1: Praktisk tip / viden
- Idé 2: Tilbud / produkt / ret-spotlight
- Idé 3: Story / behind-the-scenes / oplevelse

Hver idé skal:
- Følge Brandprofil
- Have en klar hook
- Have en CTA i brandets stil
- Have et foto-forslag i tråd med Billedpræferencer`
        : `Generate 3 post ideas about: "${userTopic}"

IDEA TYPES (must be different):
- Idea 1: Practical tip / educational
- Idea 2: Offer / product / dish spotlight
- Idea 3: Story / behind-the-scenes / experience

Each idea must:
- Follow Brand Profile
- Include a clear hook
- Include a CTA in brand style
- Include a photo suggestion aligned with Image Preferences`
  } else {
    taskBody = `${i18n.task.aiIdeasIntro}

${i18n.task.aiIdeasBullets}`.trim()
  }

  const taskSection = sectionWithMarker('TASK', 'OPGAVE', promptLang, taskBody)

  // Tier instructions
  const tierBody = userTier === 'free' ? i18n.tier.free : i18n.tier.paid

  // Language instruction (machine readable + human readable)
  const languageInstruction = `${i18n.meta.promptLanguageLine(promptLang)}\n\n${i18n.language.instruction}`

  // Platform instruction
  let platformBody = ''
  if (targetPlatforms && targetPlatforms.length > 0) {
    platformBody = `${i18n.platforms.platformsLabel}: ${targetPlatforms.join(', ')}\n${i18n.platforms.noHashtagsRule}`
  }

  // Output schema (strict)
  const bestTimeExample = promptLang === 'da'
    ? 'fx. Torsdag 17:00–19:00'
    : 'e.g. Thursday 17:00–19:00'
  const outputSchema = `{
  "ideas": [
    {
      "id": "idea-1",
      "title": "${i18n.output.schemaDaHints.title}",
      "headline": "${i18n.output.schemaDaHints.headline}",
      "text": "${i18n.output.schemaDaHints.text}",
      "photoSuggestion": "${i18n.output.schemaDaHints.photoSuggestion}",
      "menuItemUsed": "${sampleMenuItem}",
      "bestTimeToPost": "${bestTimeExample}",
      "impact": "low | medium | high"
    },
    { "id": "idea-2", ... },
    { "id": "idea-3", ... }
  ]
}

${
  promptLang === 'da'
    ? `OUTPUT-REGLER:
- Returnér KUN gyldig JSON
- Ingen markdown, ingen forklaringer, ingen afsluttende kommaer
- "text" skal være 20-150 ord
- "menuItemUsed" skal være PRÆCIS én linje fra MENUPUNKTER (menu-idé), eller "" for en ikke-menu-idé
- "bestTimeToPost" skal være en kort én-linjers tekst (dag + tidsvindue)
- "impact" skal være præcis én af: low | medium | high
- Når et menupunkt bruges:
  - Hvis det er "RET (KATEGORI)", så brug kun "RET" i teksten (ingen kategori)
  - menuItemUsed skal være FORSKELLIG på tværs af menu-idéer`
    : `OUTPUT RULES:
- Return ONLY valid JSON
- No markdown, no commentary, no trailing commas
- "text" must be 20-150 words
- "menuItemUsed" must be EXACTLY one line from MENU ITEMS (menu-based idea), or "" for a non-menu idea
- "bestTimeToPost" must be a short single-line string (day + time window)
- "impact" must be exactly one of: low | medium | high
- When a menu item is used:
  - If it is "DISH (CATEGORY)", include only "DISH" in text (no category suffix)
  - menuItemUsed values must be DIFFERENT across menu-based ideas`
}`;

  const finalPrompt = [
    sectionWithMarker('LANGUAGE', 'SPROG', promptLang, languageInstruction),
    nonNegotiableRulesSection
      ? sectionWithMarker('NON-NEGOTIABLE RULES', 'UFRAVIGELIGE REGLER', promptLang, nonNegotiableRulesSection)
      : '',
    brandProfileSection
      ? sectionWithMarker('BRAND PROFILE', 'BRANDPROFIL', promptLang, brandProfileSection)
      : '',
    toneAnchorsSection,
    toneConstraintsSection,
    sectionWithMarker('BUSINESS CONTEXT', 'VIRKSOMHEDSKONTEKST', promptLang, businessContextSection),
    behavioralDriversSection ? section('=== BEHAVIORAL DRIVERS (INTERNAL, EVIDENCE-ANCHORED) ===', behavioralDriversSection) : '',
    contentTriggersSection ? section('=== AI CONTENT TRIGGERS (HOW TO USE DRIVERS) ===', contentTriggersSection) : '',
    debugPromptSection,
    operationalContentRulesSection,
    optionalContextSection,
    taskSection,
    sectionWithMarker('TIER INSTRUCTIONS', i18n.tier.title, promptLang, tierBody),
    platformBody ? sectionWithMarker('TARGET PLATFORMS', 'PLATFORME', promptLang, platformBody) : '',
    sectionWithMarker('OUTPUT FORMAT', i18n.output.title, promptLang, outputSchema)
  ]
    .filter(Boolean)
    .join('\n')
    .trim()

  if (debugEnabled) {
    console.log('[AI Prompt] ===== FULL PROMPT =====')
    console.log(finalPrompt.slice(0, 2000) + '...')
    console.log('[AI Prompt] ===== END PROMPT =====')
  }

  return finalPrompt
}

/**
 * Determines which AI model to use based on user tier
 * Now uses centralized configuration from /src/config/features.ts
 * 
 * @param tier - User's subscription tier
 * @param _mode - Legacy parameter, no longer used (kept for backward compatibility)
 */
export function getAIModelForTier(tier: AITier, _mode?: 'custom' | 'ai'): string {
  // Use centralized configuration - no longer varies by mode
  return getAIModelFromConfig(tier)
}

/**
 * Checks if user can use AI Ideas mode (requires website analysis)
 */
export function canUseAIIdeasMode(hasWebsiteAnalysis: boolean): {
  allowed: boolean
  reason?: string
} {
  if (!hasWebsiteAnalysis) {
    return {
      allowed: false,
      reason: 'Please analyze your website in Business Profile first'
    }
  }
  
  return { allowed: true }
}

/**
 * Gets quota limits for free tier users
 */
export function getFreeTierLimits() {
  return {
    customIdeasPerWeek: 10,
    aiIdeasPerWeek: 3,
    ideasVisibleAtOnce: 3,
  }
}
