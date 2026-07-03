// prompt-builders-typed.ts
// Content-type-specific prompt builders
// Each builder assembles prompts optimized for its content type

import type { PromptOptions, PromptResult, BrandBlockOptions } from './types.ts'
import {
  buildHoursBlock,
  buildAudienceBlock,
  buildContentAnchorsBlock,
  buildEnhancedSystemInstruction,
  buildBaseContext,
  buildOutputRequirements,
  getQualityNote,
} from './prompt-components.ts'
import { buildBrandBlock } from './prompt-builders.ts'
import {
  PATH_TEMPLATE_MENU,
  PATH_TEMPLATE_SCENE,
  PATH_TEMPLATE_ATMOSPHERE,
} from './lang-strings.ts'

// ══════════════════════════════════════════════════════════════════════════
// MENU POST BUILDER (menu_item, product_menu, craving_visual)
// ══════════════════════════════════════════════════════════════════════════

export function buildMenuPrompt(opts: PromptOptions): PromptResult {
  const {
    menuItemName,
    menuItemDescription,
    contentBlock,
    selectedCta,
    ctaStyle,
    bookingLink,
    language,
    weeklyPlanContext,
    brandSignaturePhrases,
    emojiInstruction,
  } = opts

  const lang = language || 'da'
  const hasCTA = !!selectedCta

  // System instruction
  const system = buildEnhancedSystemInstruction(opts)

  // Build content block
  let contentSection = contentBlock || ''
  
  // If no content block provided, build from menu item
  if (!contentSection && menuItemName) {
    const descPart = menuItemDescription ? `\n${menuItemDescription}` : ''
    contentSection = `RET: ${menuItemName}${descPart}`
  }
  
  // CRITICAL: Always append menu description when available, even if user provided an idea
  // This prevents AI from hallucinating ingredients (e.g. adding avocado when it's not in the dish)
  if (menuItemDescription && menuItemName && contentSection && !contentSection.includes(menuItemDescription)) {
    contentSection += `\n\nINGREDIENSER (brug KUN disse — opfind INGEN andre):\n${menuItemDescription}`
  }

  // Build user prompt
  const brandBlock = buildBrandBlock(opts as any)
  const hoursBlock = buildHoursBlock(opts, 'menu_item')
  const audienceBlock = buildAudienceBlock(opts)
  const anchorsBlock = buildContentAnchorsBlock(opts)

  // CTA block (optional for menu posts)
  const ctaBlock = hasCTA
    ? `\n${lang === 'da' ? 'AFSLUTNING' : 'ENDING'} — ${ctaStyle === 'strict' ? 'fast CTA (ordret)' : 'integrer naturligt'}:\n"${selectedCta}"${
        ctaStyle === 'strict' && bookingLink
          ? '\n(Booking tilgængeligt — opfordre til reservering. Inkludér IKKE URL i teksten)'
          : ''
      }\n`
    : ''

  // Signature phrases
  const signatureBlock =
    brandSignaturePhrases && brandSignaturePhrases.length > 0
      ? `\nBRANDFRASER (brug naturligt hvis relevant):\n${brandSignaturePhrases.map(p => `- ${p}`).join('\n')}\n`
      : ''

  // Path instruction (menu-specific writing guidance)
  const pathInstruction = PATH_TEMPLATE_MENU[lang] || PATH_TEMPLATE_MENU.da

  // Dish rule
  const dishRule = menuItemName
    ? 'Nævn KUN den nævnte ret/drik — ingen andre, ingen add-ons'
    : 'Nævn INGEN mad/drik medmindre eksplicit i INDHOLD'

  // CTA rule
  const ctaRule = hasCTA
    ? (ctaStyle === 'strict' ? 'Slut altid med CTA-linjen' : 'Afslut med CTA-teksten — intentionen og emojis bevares, let omformulering tilladt')
    : undefined

  // Output requirements
  const requirements = buildOutputRequirements({
    contentType: 'menu_item',
    hasCTA,
    dishRule,
    emojiInstruction: emojiInstruction || 'Brug emojis naturligt (1-3 stk.)',
    ctaRule,
    qualityNote: getQualityNote(opts.isPaid),
  })

  const user = `OPGAVE
Du skriver som ${buildBaseContext(opts)}s stemme — indefra, ikke udefra.
Skriv ÉN social media-tekst om denne ret.
${weeklyPlanContext || ''}
INDHOLD (skriv om KUN dette):
${contentSection}
${hoursBlock}${brandBlock}${audienceBlock}${anchorsBlock}${signatureBlock}
${pathInstruction}
${ctaBlock}${requirements}

OUTPUT
Returner KUN dette JSON på én linje (ingen markdown, ingen forklaring):
{"text":"<selve teksten>","keyword":"<ét PascalCase ord>"}`

  return { system, user }
}

// ══════════════════════════════════════════════════════════════════════════
// BEHIND-THE-SCENES BUILDER (behind_scenes)
// NO CTA — craft speaks for itself
// ══════════════════════════════════════════════════════════════════════════

export function buildBehindScenesPrompt(opts: PromptOptions): PromptResult {
  const {
    contentBlock,
    language,
    weeklyPlanContext,
    emojiInstruction,
    brandSignaturePhrases,
  } = opts

  const lang = language || 'da'

  // System instruction (with immutable rules from brand profile)
  const system = buildEnhancedSystemInstruction(opts)

  // Build blocks
  const brandBlock = buildBrandBlock(opts as any)
  const hoursBlock = buildHoursBlock(opts, 'behind_scenes')
  const audienceBlock = buildAudienceBlock(opts)
  const anchorsBlock = buildContentAnchorsBlock(opts)

  // Signature phrases
  const signatureBlock =
    brandSignaturePhrases && brandSignaturePhrases.length > 0
      ? `\nBRANDFRASER (brug naturligt hvis relevant):\n${brandSignaturePhrases.map(p => `- ${p}`).join('\n')}\n`
      : ''

  // Path instruction (BTS-specific guidance)
  const pathInstruction = PATH_TEMPLATE_SCENE[lang] || PATH_TEMPLATE_SCENE.da

  // Scene-specific rules
  const sceneRules = lang === 'da'
    ? `\n──── BAG-FACADEN-REGLER ────
→ VIS MENNESKENE bag oplevelsen — teamet, en specifik medarbejder, en service-praksis der skaber tillid
→ TITLEN skal handle om en PERSON, en RELATION eller en HANDLING — aldrig om et rum eller en ting
→ FORBUDT TITELFORMAT:
  ❌ "Vi + [klargøre/stå/forberede] + [sted/lokation]"
  ❌ "[Sted/rum/møbel] gøres klar / klargøres"
  ❌ Handlingen er rettet mod rummet, ikke mod gæsten
→ FORMAT-EKSEMPLER:
  ✅ "Samme ansigt bag baren hver onsdag"
  ✅ "Line kender din ordre inden du sætter dig"
  ✅ "Brødet bagt fra bunden — gæsterne mærker det"
→ ALDRIG: "klargøring", "møbler", "stole", "træborde", generisk teamsprog
→ INGEN CTA — håndværket taler for sig selv`
    : '\n──── BEHIND-THE-SCENES RULES ────\nShow the PEOPLE behind the experience. Focus on person, relation, or action. NO CTA — the craft speaks for itself.'

  // Output requirements (no CTA)
  const requirements = buildOutputRequirements({
    contentType: 'behind_scenes',
    hasCTA: false,
    emojiInstruction: emojiInstruction || 'Brug emojis sparsomt (0-2 stk.)',
    sceneFormatRules: sceneRules,
    qualityNote: getQualityNote(opts.isPaid),
  })

  const user = `OPGAVE
Du skriver som ${buildBaseContext(opts)}s stemme — indefra, ikke udefra.
Skriv ÉN social media-tekst om bag-facaden hos os.
${weeklyPlanContext || ''}
INDHOLD (skriv om KUN dette):
${contentBlock}
${hoursBlock}${brandBlock}${audienceBlock}${anchorsBlock}${signatureBlock}${sceneRules}

${pathInstruction}

${requirements}

OUTPUT
Returner KUN dette JSON på én linje (ingen markdown, ingen forklaring):
{"text":"<selve teksten>","keyword":"<ét PascalCase ord>"}`

  return { system, user }
}

// ══════════════════════════════════════════════════════════════════════════
// ATMOSPHERE BUILDER (atmosphere, team_people)
// ══════════════════════════════════════════════════════════════════════════

export function buildAtmospherePrompt(opts: PromptOptions): PromptResult {
  const {
    contentBlock,
    selectedCta,
    ctaStyle,
    language,
    weeklyPlanContext,
    brandSignaturePhrases,
    emojiInstruction,
  } = opts

  const lang = language || 'da'
  const hasCTA = !!selectedCta

  // System instruction (with immutable rules from brand profile)
  const system = buildEnhancedSystemInstruction(opts)

  // Build blocks
  const brandBlock = buildBrandBlock(opts as any)
  const hoursBlock = buildHoursBlock(opts, 'atmosphere')
  const audienceBlock = buildAudienceBlock(opts)
  const anchorsBlock = buildContentAnchorsBlock(opts)

  // CTA block (optional)
  const ctaBlock = hasCTA
    ? `\n${lang === 'da' ? 'AFSLUTNING' : 'ENDING'} — ${ctaStyle === 'strict' ? 'fast CTA (ordret)' : 'integrer naturligt'}:\n"${selectedCta}"\n`
    : ''

  // Signature phrases
  const signatureBlock =
    brandSignaturePhrases && brandSignaturePhrases.length > 0
      ? `\nBRANDFRASER (brug naturligt hvis relevant):\n${brandSignaturePhrases.map(p => `- ${p}`).join('\n')}\n`
      : ''

  // Path instruction
  const pathInstruction = PATH_TEMPLATE_ATMOSPHERE[lang] || PATH_TEMPLATE_ATMOSPHERE.da

  // Atmosphere-specific rules
  const atmosphereRules = lang === 'da'
    ? `\n──── ATMOSFÆRE-REGLER ────
→ SOCIAL INVITATION: Hvilken anledning, social energi eller stemning gør dette sted til det rigtige valg NETOP NU?
→ Sælg oplevelsen som svar på en social situation — invitér, beskriv ikke
→ FORBUDT: passiv stedsbeskrivelse, ruminventar, lys og overflader som titelsubjekt
→ FØRSTE LINJE maks 7 ord — konkret øjeblik, handling eller fragment`
    : '\n──── ATMOSPHERE RULES ────\nSocial invitation — what makes this venue the right choice RIGHT NOW? Invite, don\'t describe. First line max 7 words.'

  // CTA rule
  const ctaRule = hasCTA
    ? (ctaStyle === 'strict' ? 'Slut altid med CTA-linjen' : 'Afslut med CTA-teksten — intentionen og emojis bevares, let omformulering tilladt')
    : undefined

  // Output requirements
  const requirements = buildOutputRequirements({
    contentType: 'atmosphere',
    hasCTA,
    emojiInstruction: emojiInstruction || 'Brug emojis naturligt (1-3 stk.)',
    ctaRule,
    sceneFormatRules: atmosphereRules,
    qualityNote: getQualityNote(opts.isPaid),
  })

  const user = `OPGAVE
Du skriver som ${buildBaseContext(opts)}s stemme — indefra, ikke udefra.
Skriv ÉN social media-tekst om stemningen hos os.
${weeklyPlanContext || ''}
INDHOLD (skriv om KUN dette):
${contentBlock}
${hoursBlock}${brandBlock}${audienceBlock}${anchorsBlock}${signatureBlock}

${pathInstruction}
${ctaBlock}${requirements}

OUTPUT
Returner KUN dette JSON på én linje (ingen markdown, ingen forklaring):
{"text":"<selve teksten>","keyword":"<ét PascalCase ord>"}`

  return { system, user }
}

// ══════════════════════════════════════════════════════════════════════════
// OCCASION MOMENTS BUILDER (lunch_moment, brunch_moment, afterwork_moment)
// ══════════════════════════════════════════════════════════════════════════

export function buildOccasionPrompt(opts: PromptOptions): PromptResult {
  const {
    contentBlock,
    selectedCta,
    ctaStyle,
    bookingLink,
    language,
    weeklyPlanContext,
    brandSignaturePhrases,
    emojiInstruction,
    contentType,
  } = opts

  const lang = language || 'da'
  const hasCTA = !!selectedCta

  // System instruction (with immutable rules from brand profile)
  const system = buildEnhancedSystemInstruction(opts)

  // Build blocks
  const brandBlock = buildBrandBlock(opts as any)
  const hoursBlock = buildHoursBlock(opts, contentType || 'lunch_moment')
  const audienceBlock = buildAudienceBlock(opts)
  const anchorsBlock = buildContentAnchorsBlock(opts)

  // CTA block (optional but recommended for occasions)
  const ctaBlock = hasCTA
    ? `\n${lang === 'da' ? 'AFSLUTNING' : 'ENDING'} — ${ctaStyle === 'strict' ? 'fast CTA (ordret)' : 'integrer naturligt'}:\n"${selectedCta}"${
        ctaStyle === 'strict' && bookingLink
          ? '\n(Booking tilgængeligt — opfordre til reservering)'
          : ''
      }\n`
    : ''

  // Signature phrases
  const signatureBlock =
    brandSignaturePhrases && brandSignaturePhrases.length > 0
      ? `\nBRANDFRASER (brug naturligt hvis relevant):\n${brandSignaturePhrases.map(p => `- ${p}`).join('\n')}\n`
      : ''

  // Path instruction (use menu template as occasion posts often reference food)
  const pathInstruction = PATH_TEMPLATE_MENU[lang] || PATH_TEMPLATE_MENU.da

  // Occasion-specific rules
  const occasionRules = lang === 'da'
    ? `\n──── ANLEDNINGS-REGLER ────
→ Match gæstens NUTIDIGE situation — hvad sker der lige NU der bringer dem hertil?
→ Nævn eksplicit service-periode ("frokost klar fra kl. 12", "aftensmad fra kl. 17:30")
→ Kombiner timing med hvem der kommer (segment) eller hvad situationen er
→ Kan inkludere menu-anker hvis relevant for anledningen`
    : '\n──── OCCASION RULES ────\nMatch guest\'s CURRENT situation. Mention service period explicitly. Can include menu anchor if relevant.'

  // CTA rule
  const ctaRule = hasCTA
    ? (ctaStyle === 'strict' ? 'Slut altid med CTA-linjen' : 'Afslut med CTA-teksten — intentionen og emojis bevares, let omformulering tilladt')
    : undefined

  // Output requirements
  const requirements = buildOutputRequirements({
    contentType: contentType || 'lunch_moment',
    hasCTA,
    emojiInstruction: emojiInstruction || 'Brug emojis naturligt (1-3 stk.)',
    ctaRule,
    sceneFormatRules: occasionRules,
    qualityNote: getQualityNote(opts.isPaid),
  })

  const user = `OPGAVE
Du skriver som ${buildBaseContext(opts)}s stemme — indefra, ikke udefra.
Skriv ÉN social media-tekst om denne anledning.
${weeklyPlanContext || ''}
INDHOLD (skriv om KUN dette):
${contentBlock}
${hoursBlock}${brandBlock}${audienceBlock}${anchorsBlock}${signatureBlock}${occasionRules}

${pathInstruction}
${ctaBlock}${requirements}

OUTPUT
Returner KUN dette JSON på én linje (ingen markdown, ingen forklaring):
{"text":"<selve teksten>","keyword":"<ét PascalCase ord>"}`

  return { system, user }
}
