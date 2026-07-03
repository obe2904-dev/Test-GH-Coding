// prompt-components.ts
// Shared prompt building blocks used across all content types
// Separated from type-specific builders for clarity and reusability
//
// ⚠️ CLEANED VERSION - Phase 2 Token Optimization
// Removed 3 unused functions: buildVoiceBlock, buildAvoidBlock, buildSystemInstruction
// Savings: ~71 lines, ~2.5KB

import type { PromptOptions } from './types.ts'

// ══════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS — Used by all content type builders
// ══════════════════════════════════════════════════════════════════════════

/**
 * Build opening hours block with smart routing
 * Menu/food posts → kitchen hours
 * Bar/atmosphere posts → venue hours
 * Occasion posts → service period hours
 */
export function buildHoursBlock(opts: PromptOptions, contentType: string): string {
  const { todayOpenTime, todayCloseTime, kitchenCloseTime, language } = opts
  const lang = language || 'da'

  const isMenuPost = ['menu_item', 'product_menu', 'craving_visual'].includes(contentType)
  const isBehindScenes = contentType === 'behind_scenes'

  // For menu posts: use kitchen hours if available and different from venue hours
  if (isMenuPost && kitchenCloseTime && todayCloseTime && kitchenCloseTime !== todayCloseTime) {
    const range = todayOpenTime ? `${todayOpenTime}–${kitchenCloseTime}` : `til kl. ${kitchenCloseTime}`
    return lang === 'da'
      ? `\n⏰ KØKKEN ÅBENT: ${range}\n⚠️ Nævn KØKKEN-lukketid hvis relevant — ikke bar/venue-lukketid.\n`
      : `\n⏰ KITCHEN HOURS: ${range}\n⚠️ Mention KITCHEN closing time if relevant — not bar/venue hours.\n`
  }

  // For behind_scenes: context matters — is it kitchen prep or bar service?
  // This is handled by the caller passing the right todayCloseTime
  
  // For all types: show available hours, but make usage conditional
  const openCloseRange = todayOpenTime && todayCloseTime
    ? `${todayOpenTime}–${todayCloseTime}`
    : todayOpenTime
      ? `fra kl. ${todayOpenTime}`
      : todayCloseTime
        ? `til kl. ${todayCloseTime}`
        : ''

  if (!openCloseRange) {
    return lang === 'da'
      ? '\n⚠️ Du har INGEN information om åbningstider — nævn IKKE klokkeslæt, "åbent til", eller tidspunkter for hvornår stedet åbner/lukker. Opfind dem IKKE.\n'
      : '\n⚠️ You have NO information about opening hours — do NOT mention times, "open until", or when the venue opens/closes. Do NOT invent them.\n'
  }

  return lang === 'da'
    ? `\nℹ️ Vi er åbne ${openCloseRange} — inkluder KUN åbningstider hvis det passer naturligt; nævn IKKE klokkeslæt som primær CTA for dette opslag.\n`
    : `\nℹ️ We are open ${openCloseRange} — include opening hours ONLY if it fits naturally; do NOT mention times as the primary CTA for this post.\n`
}

/**
 * Build audience segment block from V5 Brand Profile
 * Shows who we're talking to right now based on time of day
 */
export function buildAudienceBlock(opts: PromptOptions): string {
  void opts
  return ''
}

/**
 * Build content anchors block from V5 Brand Profile
 * What the venue actually offers (prevents hallucination)
 */
export function buildContentAnchorsBlock(opts: PromptOptions): string {
  const { contentAnchors } = opts

  if (!contentAnchors || contentAnchors.length === 0) {
    return ''
  }

  return `\n──── HVAD VI FAKTISK TILBYDER ────\nDisse ting er verificeret — du må IKKE opfinde andre:\n${contentAnchors.map(a => `- ${a}`).join('\n')}\n`
}

/**
 * Build enhanced system instruction with immutable rules
 * CRITICAL: System message has higher priority than user message in OpenAI models
 * Put non-negotiable constraints here (structural rules, banned patterns, register)
 */
export function buildEnhancedSystemInstruction(opts: PromptOptions): string {
  const { businessName, language, isPaid, keyOfferings, menuItemName } = opts
  const lang = language || 'da'

  // Free tier: OBSERVER persona - strict boundaries, no hallucination
  if (!isPaid) {
    if (lang === 'da') {
      let instruction = `DU ER OBSERVATØR — ikke historiefortæller.

ROLLE: Du beskriver præcist hvad der ER verificerbart for ${businessName}.
GRÆNSE: Du har KUN rettens navn og evt. brugerens beskrivelse. Du har INGEN detaljeret menudata.
KONSEKVENS: Hvis du ikke kan verificere det i data, eksisterer det ikke.`

      // Add known menu names if available (helps AI verify dish exists)
      if (keyOfferings && keyOfferings.trim()) {
        const menuNames = keyOfferings.split('\n').map(n => n.trim()).filter(n => n.length > 0)
        if (menuNames.length > 0) {
          instruction += `\n\nVERIFICERBARE MENUPUNKTER (kun navne — INGEN detaljer):\n${menuNames.map(name => `- ${name}`).join('\n')}`
          if (menuItemName) {
            const matchingDish = menuNames.find(n => 
              n.toLowerCase().includes(menuItemName.toLowerCase()) || 
              menuItemName.toLowerCase().includes(n.toLowerCase())
            )
            if (matchingDish) {
              instruction += `\n\n✅ "${menuItemName}" findes på menuen som "${matchingDish}".\nDu ved KUN navnet — ikke ingredienser, tilberedning eller præsentation.`
            }
          }
        }
      }

      instruction += `\n\nREGLER:
1. Skriv KUN hvad du kan verificere:
   - Rettens navn ✅
   - Detaljer fra brugerens titel (hvis de skrev dem) ✅
   - At retten serveres her ✅
2. OPFIND ALDRIG:
   - Ingredienser der ikke står i titel ❌
   - Tilberedningsmetoder ❌
   - Brødtyper, sovse, garniturer ❌
   - Tekstur-beskrivelser ("sprød", "saftig") ❌

EKSEMPEL PÅ GRÆNSEN:
- Titel: "Faustburger med sprød bacon"
- Du skriver: "Faustburger med bacon serveres" ✅
- Du skriver IKKE: "briochebolle", "chilimayo", "syltede rødløg" ❌ (opfundet)

Beskriv hvad der ER, ikke hvad der kunne være.`

      return instruction
    }
    return `YOU ARE AN OBSERVER — not a storyteller.

ROLE: You describe precisely what IS verifiable for ${businessName}.
BOUNDARY: You have ONLY the dish name and possibly the user's description. You have NO detailed menu data.
CONSEQUENCE: If you cannot verify it in data, it does not exist.

RULES:
1. Write ONLY what you can verify:
   - Dish name ✅
   - Details from user's title (if they wrote them) ✅
   - That the dish is served here ✅
2. NEVER INVENT:
   - Ingredients not in title ❌
   - Preparation methods ❌
   - Bread types, sauces, garnishes ❌
   - Texture descriptions ("crispy", "juicy") ❌

BOUNDARY EXAMPLE:
- Title: "Faustburger with crispy bacon"
- You write: "Faustburger with bacon is served" ✅
- You do NOT write: "brioche bun", "chipotle mayo", "pickled onions" ❌ (invented)

Describe what IS, not what could be.`
  }

  // Paid tier: Enhanced instruction with immutable constraints from brand profile
  if (lang === 'da') {
    let instruction = `Du er copywriter for ${businessName} — du skriver indefra stedet, ikke som ekstern observatør.

DIN EKSPERTISE: Autentiske social media-tekster der afspejler stedet uden reklamesalg.
ALDRIG: Imperativ-tone, generiske fraser, marketing-sprog.`

    // Extract and inject IMMUTABLE structural rules from brand profile
    const structuralRules = extractStructuralRules(opts.brandWritingRules || [])
    const bannedPatterns = extractBannedPatterns(opts)
    if (structuralRules.length > 0) {
      instruction += `\n\n═══ IMMUTABLE STRUCTURAL RULES ═══
Disse regler KAN IKKE overtrædes — de har højeste prioritet:

${structuralRules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}`
    }

    if (bannedPatterns.length > 0) {
      instruction += `\n\n🚫 FORBIDDEN PATTERNS (brug ALDRIG):
${bannedPatterns.slice(0, 8).map(p => `• ${p}`).join('\n')}`
    }

    instruction += `\n\n═══ PRIORITY HIERARCHY ═══
1. STRUCTURAL RULES (ovenstående) — kan ALDRIG brydes
2. Brand voice (i user message) — følg tonen
3. Content requirements (i user message) — fleksibel implementation

Hvis der er konflikt mellem instruktioner, følg ovenstående prioritet.`

    return instruction
  }

  // English paid tier
  return `You are copywriter for ${businessName} — writing from inside the venue, not as external observer.

YOUR EXPERTISE: Authentic social media copy that reflects the venue without advertising language.
NEVER: Imperative tone, generic phrases, marketing speak.

${extractStructuralRules(opts.brandWritingRules || []).length > 0 ? `
═══ IMMUTABLE STRUCTURAL RULES ═══
These rules CANNOT be violated — highest priority:

${extractStructuralRules(opts.brandWritingRules || []).map((rule, i) => `${i + 1}. ${rule}`).join('\n')}` : ''}

${extractBannedPatterns(opts).length > 0 ? `
🚫 FORBIDDEN PATTERNS (NEVER use):
${extractBannedPatterns(opts).slice(0, 8).map(p => `• ${p}`).join('\n')}` : ''}

═══ PRIORITY HIERARCHY ═══
1. STRUCTURAL RULES (above) — CANNOT be broken
2. Brand voice (in user message) — follow the tone
3. Content requirements (in user message) — flexible implementation

If instructions conflict, follow this priority.`
}

/**
 * Helper: Extract structural rules (sentence structure, length, clause restrictions)
 */
function extractStructuralRules(brandWritingRules: string[]): string[] {
  const structuralPatterns = [
    /\ben tanke\b/i,                    // "én tanke pr. sætning"
    /\bstop før\b/i,                    // "stop før du forklarer"
    /\bledsætning/i,                    // subordinate clause restrictions
    /\bmens\b.*\bfordi\b/i,             // "mens", "fordi" restrictions
    /\bselvom\b/i,                      // "selvom" restrictions
    /\bkort/i,                          // "korte sætninger"
    /\blængde/i,                        // length restrictions
    /\bsætning/i,                       // sentence structure rules
  ]
  
  return brandWritingRules.filter(rule => 
    structuralPatterns.some(p => p.test(rule))
  )
}

/**
 * Helper: Extract banned patterns from multiple sources
 */
function extractBannedPatterns(opts: PromptOptions): string[] {
  const patterns: string[] = []
  
  // From avoid vocabulary
  if (opts.brandAvoidVocab && opts.brandAvoidVocab.length > 0) {
    patterns.push(...opts.brandAvoidVocab)
  }
  
  // From things to avoid
  if (opts.thingsToAvoid && opts.thingsToAvoid.length > 0) {
    patterns.push(...opts.thingsToAvoid)
  }
  
  // Deduplicate
  return [...new Set(patterns)]
}

/**
 * Build base context block (business facts)
 */
export function buildBaseContext(opts: PromptOptions): string {
  const { businessName, city, effectiveVertical } = opts
  return `${businessName} i ${city} (${effectiveVertical})`
}

/**
 * Build length requirement based on content type
 */
export function getLengthRequirement(contentType: string, hasCTA: boolean): string {
  const isBTS = contentType === 'behind_scenes'
  const isAtmosphere = ['atmosphere', 'team_people'].includes(contentType)
  
  // Behind-the-scenes and atmosphere: shorter, punchier
  if (isBTS || isAtmosphere) {
    return hasCTA ? '180-300 tegn inkl. emojis og CTA' : '150-280 tegn inkl. emojis'
  }
  
  // Menu and occasion posts: more detailed
  return hasCTA ? '300-450 tegn inkl. emojis og CTA' : '280-420 tegn inkl. emojis'
}

/**
 * Build quality note based on tier
 * Free tier: explicit anti-poetic constraints
 * Paid tier: polish and personality
 */
export function getQualityNote(isPaid: boolean): string {
  return isPaid 
    ? 'Teksten skal føles poleret og personlig.' 
    : 'FORBUDT SPROG: Metaforer om rejser, dans, omfavnelser, sanser der "vækkes"/"kommer til live", ting der "svømmer"/"svæver"/"omfavner"/"kysser". Beskriv KUN hvad gæsten faktisk ser, smager og får. Brug konkrete, simple sætninger uden billedsprog.'
}

/**
 * Build output format requirements
 */
export function buildOutputRequirements(opts: {
  contentType: string
  hasCTA: boolean
  dishRule?: string
  emojiInstruction: string
  ctaRule?: string
  sceneFormatRules?: string
  qualityNote?: string
}): string {
  const { contentType, hasCTA, dishRule, emojiInstruction, ctaRule, sceneFormatRules, qualityNote } = opts
  
  const isSceneMoodPost = ['behind_scenes', 'atmosphere', 'team_people'].includes(contentType)
  const lengthReq = getLengthRequirement(contentType, hasCTA)

  const requirements: string[] = []
  requirements.push(`1) Længde: ${lengthReq}`)
  
  if (dishRule) {
    requirements.push(`2) ${dishRule}`)
  }
  
  requirements.push(`${dishRule ? '3' : '2'}) ${emojiInstruction}`)
  requirements.push(`   ☕ KUN hvis kaffe/espresso/latte er nævnt som drik i teksten — "Café" i navnet tæller IKKE.`)
  
  if (hasCTA && ctaRule) {
    requirements.push(`${dishRule ? '4' : '3'}) ${ctaRule}`)
  }
  
  const nextNum = (dishRule ? 4 : 3) + (hasCTA ? 1 : 0) + 1
  requirements.push(`${nextNum}) INKLUDÉR ALDRIG fotoinstruktioner, opfordringer til at fotografere eller dele billeder (fx '📸 Fang...', 'Del dit billede...', 'Tag et foto...') i selve teksten`)
  
  if (isSceneMoodPost) {
    requirements.push(`${nextNum + 1}) FØRSTE LINJE er maks 7 ord — tæl ordene i din første sætning FØR du skriver resten. Brug et konkret øjeblik, en handling eller et fragment. INGEN ledsætning der starter med "Når", "Mens", "Fordi", "Der er". FORBUDT åbning: "Vores [rum/lys/indretning]...". ALDRIG rum, lys eller møbel som grammatisk subjekt.`)
  }
  
  if (sceneFormatRules) {
    requirements.push(sceneFormatRules)
  }
  
  if (qualityNote) {
    requirements.push(qualityNote)
  }

  return `\nKRAV\n${requirements.join('\n')}`
}
