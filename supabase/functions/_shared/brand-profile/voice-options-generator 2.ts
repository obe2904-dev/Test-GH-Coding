/**
 * Voice Options Generator — v2
 *
 * Generates two explicitly-sourced voice profiles for a business:
 *
 *   Option A  "website"     — A faithful analysis of what the business
 *                             actually communicates on its homepage today.
 *
 *   Option B  "ai_enriched" — What social-media tone would work best,
 *                             derived from menu, location, audience and
 *                             positioning signals.
 *
 * Both options are generated in parallel — no extra latency vs old version.
 * The owner chooses one; switching reads from stored voice_options — no new
 * AI call ever needed after initial generation.
 */

import { fetchOpenAIWithRetry, parseOpenAIJson } from './openai-client.ts'
import { silentCorrect } from '../utils/silent-correct.ts'

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoiceSource = 'website' | 'ai_enriched'

export interface VoiceOption {
  source: VoiceSource
  source_label: string
  label: string
  tagline: string
  voice_rationale: string
  tone_model: {
    primary_keywords: string[]
    writing_rules: string[]
    good_examples: string[]
    avoid_examples: string[]
    formality: 'formal' | 'informal' | 'mixed'
    emoji_level: 'none' | 'minimal' | 'moderate' | 'frequent'
  }
  things_to_avoid: {
    language_constraints: string[]
    factual_constraints: string[]
  }
  voice_constraints: string
  example_posts: string[]
}

export interface VoiceOptions {
  recommended: VoiceSource
  recommended_reason: string
  options: {
    website: VoiceOption
    ai_enriched: VoiceOption
  }
  generated_at: string
}

// ─── Secondary signals for Pipeline B calibration ────────────────────────────

export interface SecondarySignals {
  priceRange: { min: number | null; max: number | null }
  hasKidsMenu: boolean
  categoryLabels: string[]
  menuNamingSample: string[]
  namingStyleHint: string        // e.g. "Kortfattet + rent dansk" — pre-classified by TypeScript
  secondaryTextFragments: string[]
  websiteRegisterHint: string
  dayArcProgrammes: string[]    // e.g. ["Brunch", "Frokost", "Aften", "Cocktails"]
  audienceProfile: string       // e.g. "tourist, waterfront, city-centre" derived from demographic_proximity + category_scores
  openingHoursHint: string      // e.g. "Man-søn 09:00-22:00" or "Tor-lør 17:00-23:00"
  acceptsReservations: boolean | null  // null = could not determine
  hybridTypeHint: string        // e.g. "café + cocktailbar (dag + sen aftendrift)" or "" if single-type
}

// ─── Per-source JSON schemas ─────────────────────────────────────────────────

// Schema A — website analysis. Label MUST describe the actual tone found.
const WEBSITE_SCHEMA = `{
  "label": "<2-4 Danish words describing the ACTUAL tone you found — e.g. 'Kortfattet og faktuel', 'Varm og uformel', 'Neutral og servicepræget'. Must be descriptive, never a brand name or archetype name.>",
  "tagline": "<one-line Danish description of the homepage communication style, max 8 words>",
  "voice_rationale": "<Start with a concrete observation: 'Hjemmesiden bruger...' or '[BusinessName] kommunikerer...'. 2-3 sentences describing what the text actually does. If content was sparse, say so honestly.>",
  "tone_model": {
    "primary_keywords": ["<2-4 tone keywords derived directly from the text>"],
    "writing_rules": ["<3-5 rules that faithfully replicate the homepage style on social media. MANDATORY: at least one rule must explicitly enforce short-form social format — e.g. 'Start with a maximum 6-word opening fragment or statement' or 'Prefer imperative fragments over full sentences'. Never generate rules that encourage full marketing sentences.>"],
    "good_examples": ["<2-3 phrases matching the homepage style>"],
    "avoid_examples": ["<2-3 phrases that break the homepage style>"],
    "formality": "informal",
    "emoji_level": "none"
  },
  "things_to_avoid": {
    "language_constraints": ["<2-4 linguistic prohibitions>"],
    "factual_constraints": ["<2-3 factual guardrails>"]
  },
  "voice_constraints": "<1 sentence: the single most important constraint to stay faithful to the homepage tone>",
  "example_posts": ["<social post that mimics homepage style — concrete details, no embellishment>", "<second post>"]
}`

// Schema B — AI-enriched recommendation. Label is a social-media voice name.
const ENRICHED_SCHEMA = `{
  "label": "<2-4 danske ord der beskriver stemmen — KUN ord der er sande for DENNE virksomhed men ikke for en tilfældig café to gader væk. Brug ALDRIG 'alsidig', 'mangfoldig', 'varieret', 'nærværende', 'indbydende', 'autentisk', 'hyggelig'. Find i stedet ord der peger på stedet konkret: beliggenhed, specifikke retter, åbningstider, koncept.>",
  "tagline": "<én dansk sætning: hvad er det mest specifikke ved denne virksomheds sociale stemme — maks 8 ord>",
  "voice_rationale": "<Skriv til ejeren som en venlig social medie-rådgiver. 2-3 sætninger i naturligt hverdagsdansk. Forklar hvad der kendetegner STEDET — ikke hvad 'signalerne indikerer'. Brug stedets konkrete træk (retter, beliggenhed, dagsdele, åbningstider). FORBUDTE ORD: perfekt, ideel, ideelle, alsidig, mangfoldig, unik, speciel, fantastisk, navngivningsstil, dagsbue, ejerstemme, aspirationsniveau. Slut med to sætninger: (1) 'Derfor anbefaler vi en [X]-stemme fremfor en [Y]-stemme.' — [X] skal være ét konkret adjektiv der peger på stedets tone, fx: 'kontant og stedstro', 'varm og uformel', 'direkte og jordnær'. (2) En adfærdssætning der forklarer hvad stemmen GØR: hvilke situationer, tidspunkter eller handlinger den taler til — fx: 'Det betyder at teksten taler direkte til gæsten om hvad der sker, hvornår og hvad de kan gøre.' — IKKE en gentagelse af label-ordene.>",
  "tone_model": {
    "primary_keywords": ["<2-4 nøgleord udledt fra de konkrete signaler — ikke fra kategorien>"],
    "writing_rules": ["<3-5 konkrete skrivehandlinger udledt UDELUKKENDE fra signalerne i analysen — verb-baserede instruktioner. Krav: (1) Mindst én regel skal adressere FORMAT — men formatet SKAL udledes fra virksomhedens faktiske signaler: sen åbningstid (efter kl. 23) → en regel om aftens- og natregistret; dominerende brunch/morgenprofil → en regel om morgenstemning og uformelt nærvær; højt prisniveau → en regel om tone-kontrol og selvsikker korthed. (2) Mindst én regel skal adressere TIMING eller SERVICE-ARC — den dagsdel, det serviceprogram eller den anledning som virksomheden faktisk er bygget til. (3) DIFFERENTIERINGSTEST (OBLIGATORISK): Stil spørgsmålet 'Kan en tilfældig café to gader væk bruge denne regel om sig selv?' — hvis ja, er reglen for generisk, omskriv den med et konkret signal fra analysen som anker. (4) FORBUDT: Regler der er identiske med skrivereglerne i website-archetypet; generiske social medie-anbefalinger uden signal-forankring ('vær autentisk', 'brug korte sætninger'); regler der blot gentager kategoritype uden at pege på noget stedsspecifikt.>"],
    "good_examples": ["<2-3 korte fraser der UDELUKKENDE demonstrerer stemme-register og rytme — ingen retter, ingen stedsnavn, ingen CTA. Brug KUN gæst eller person som sætningssubjekt — ALDRIG sted, natur eller inventar som sætningssubjekt. Mindst én fraser skal vise registret i en ikke-menubaseret kontekst (fx en situation, et tidspunkt eller en person). En fremmed skal ikke kunne identificere virksomheden ud fra disse fraser alene>"],
    "avoid_examples": ["<2-3 fraser der ville underminere stemmen>"],
    "formality": "<'informal' | 'semi-formal' | 'formal' — udledt fra ejerstemme-fragmenter og prisniveau>",
    "emoji_level": "<'none' | 'minimal' | 'moderate' — udledt fra erhvervstype og prisniveau>"
  },
  "things_to_avoid": {
    "language_constraints": ["<2-4 sproglige forbud specifikt for denne virksomhed>"],
    "factual_constraints": ["<2-3 faktuelle grænser>"],
    "post_structure_constraints": ["<1-2 sætningsstruktur-regler udledt fra recommended_post_mode i analysen — ikke generiske forbud>"]
  },
  "voice_constraints": "<1 sætning: den vigtigste begrænsning specifik for denne virksomhed>",
  "example_posts": ["<opslag med konkrete navne fra analysen — ingen generiske sætningsstrukturer>", "<andet opslag>"],
  "aspiration_level": "local_institution | neighbourhood_favourite | destination_dining | premium_restaurant"
}`

// Schema for Call 1 — Signal Analysis intermediate object
const ANALYSIS_SCHEMA = `{
  "most_differentiating_signal": "<det ene signal der adskiller denne virksomhed mest fra en typisk virksomhed i samme kategori — vær konkret, fx '4 serviceprogrammer fra brunch til cocktails' eller 'prisspænd 69-495 kr. tillige med børnemenu'>",
  "what_it_says": "<hvad dette signal fortæller om aspirationsniveau og identitet — 1-2 sætninger>",
  "naming_style_observation": "<hvad navngivningsstilen afslører om ejerpersonlighed — fx 'rent dansk, kortfattet og uden adjektiver = upretentiøs' eller 'kreative engelske navne = konceptbevidst'>",
  "ownership_register": "<beskriv ejerens stemme ud fra ejerstemme-fragmenter, eller 'ikke tilgængeligt' hvis sektion D er tom>",
  "aspiration_level": "local_institution | neighbourhood_favourite | destination_dining | premium_restaurant",
  "recommended_post_mode": "assumed_familiarity | broadcast_invitation | formal_welcome",
  "differentiating_detail_1": "<konkret faktum fra inputdata brugbart i et eksempel-opslag fx 'Pariserbøf serveret fra kl. 9'>",
  "differentiating_detail_2": "<andet konkret faktum på samme måde>"
}`

// ─── Pipeline A — Website Analysis ───────────────────────────────────────────

async function generateWebsiteVoiceOption(
  apiKey: string,
  websiteText: string,
  businessName: string,
  requestId: string
): Promise<Omit<VoiceOption, 'source' | 'source_label'> | null> {
  const hasContent = websiteText && websiteText.trim().length > 30

  const systemPrompt = `Du er en ekspert i tone-of-voice analyse for danske virksomheder.
Din opgave er UDELUKKENDE at beskrive den stemme der faktisk FINDES i teksten.
Du må IKKE opfinde en stemme, give den et arketype-navn eller kreativt fortolke — kun observere.
Hvis teksten er kortfattet og funktionel, er "label" fx "Kortfattet og funktionel" — ikke "Energisk" eller "Fortæller".
Output ONLY valid JSON — no markdown, no commentary outside JSON.`

  const userPrompt = hasContent
    ? `Analyser og beskriv den FAKTISKE tone-of-voice i nedenstående hjemmesidetekst fra ${businessName}.

KRAV TIL "label": Skal beskrive tonen DU FANDT — 2-4 adjektiver der passer til teksten.
Eksempler på korrekte labels: "Kortfattet og faktuel", "Varm og uformel", "Informativ og servicepræget"
Eksempler på FORKERTE labels: "Energisk", "Fortæller", "Curated" — disse er kreative navne, ikke observationer.

KRAV TIL "voice_rationale": Start præcis med "${businessName}s hjemmeside..." og beskriv hvad teksten gør.

HJEMMESIDETEKST:
"""
${websiteText.substring(0, 1200)}
"""

OUTPUT JSON (ét objekt — ingen wrapper):
${WEBSITE_SCHEMA}`
    : `Der er begrænset tekstindhold fra ${businessName}s hjemmeside.

KRAV TIL "label": Brug "Begrænset hjemmesideindhold" eller "Minimal og funktionel" — beskriv situationen ærligt.
KRAV TIL "voice_rationale": Start med "${businessName}s hjemmeside har begrænset tekstindhold..." og forklar hvad det betyder.

OUTPUT JSON (ét objekt — ingen wrapper):
${WEBSITE_SCHEMA}`

  try {
    const response = await fetchOpenAIWithRetry(
      apiKey,
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 1200,
        response_format: { type: 'json_object' }
      },
      requestId,
      'Voice Pipeline A (website)',
      { timeout: 20000, maxRetries: 1, retryDelayMs: 500, retryStatusCodes: [429, 503] }
    )
    const content = response.choices[0]?.message?.content
    return content ? parseOpenAIJson<any>(content) : null
  } catch (err: any) {
    console.warn(`[${requestId}] Voice Pipeline A failed:`, err?.message ?? err)
    return null
  }
}

// ─── Pipeline B — Call 1: Signal Analysis ────────────────────────────────────

interface SignalAnalysis {
  most_differentiating_signal: string
  what_it_says: string
  naming_style_observation: string
  ownership_register: string
  aspiration_level: string
  recommended_post_mode: 'assumed_familiarity' | 'broadcast_invitation' | 'formal_welcome'
  differentiating_detail_1: string
  differentiating_detail_2: string
}

async function analyseVoiceSignals(
  apiKey: string,
  businessName: string,
  businessType: string,
  location: string,
  secondarySignals: SecondarySignals,
  anchorSample: string,
  menuSample: string,
  requestId: string
): Promise<SignalAnalysis | null> {
  const s = secondarySignals

  const priceBlock = s.priceRange.min !== null && s.priceRange.max !== null
    ? `- Prisspænd: ${s.priceRange.min}–${s.priceRange.max} kr.`
    : '- Prisinformation: ikke tilgængeligt'

  const fragmentsBlock = s.secondaryTextFragments.length > 0
    ? `Direkte citater fra ejerstemmematerialet:\n${s.secondaryTextFragments.map(t => `"${t}"`).join('\n')}`
    : 'Ingen ejerstemme-fragmenter tilgængelige'

  const namingSample = s.menuNamingSample.length > 0
    ? s.menuNamingSample.join(', ')
    : anchorSample || menuSample || 'ikke tilgængeligt'

  const dayArcBlock = s.dayArcProgrammes.length > 0
    ? `Serviceprogrammer: ${s.dayArcProgrammes.join(', ')}${s.openingHoursHint ? ` — Åbningstider: ${s.openingHoursHint}` : ''}`
    : (s.openingHoursHint ? `Åbningstider: ${s.openingHoursHint}` : 'Ingen program/åbningstidsdata')

  const reservationLine = s.acceptsReservations === true
    ? '- Tager reservationer: Ja (bord kan bookes)'
    : s.acceptsReservations === false
      ? '- Tager reservationer: Nej (walk-in)'
      : '- Tager reservationer: ukendt'

  const systemPrompt = `Du er ekspert i at analysere forretningsdata og aflede tone-of-voice signaler.
Din opgave er UDELUKKENDE at analysere de signaler du modtager og returnere en struktureret analyse.
Du må IKKE anbefale en stemme endnu — kun analysere hvad signalerne siger.
Vær specifik: undgå generiske genrebeskrivelser. Find det der er særligt for DENNE virksomhed.
Output ONLY valid JSON — no markdown, no commentary outside JSON.`

  const userPrompt = `Analysér signalerne for ${businessName} og identificér hvad der adskiller denne virksomhed.

── A. IDENTITET ───────────────────────────────────────────────────────────────
- Forretningstype: ${businessType}${s.hybridTypeHint ? `\n- Hybridprofil: ${s.hybridTypeHint} (VIGTIGT: denne virksomhed er IKKE en enkelt kategori — beskriv begge dimensioner i analysen)` : ''}
- Lokation: ${location}

── B. PRISARKITEKTUR ────────────────────────────────────────────────────────
${priceBlock}
- Børnemenu: ${s.hasKidsMenu ? 'Ja' : 'Nej'}
${reservationLine}

── C. MENUNAVN-STIL ─────────────────────────────────────────────────────────
- TypeScript-klassificering: ${s.namingStyleHint}
- Sektioner: ${s.categoryLabels.join(', ') || 'ikke tilgængeligt'}
- Navneprøve: ${namingSample}

── D. EJERSTEMME-SIGNALER ────────────────────────────────────────────────────
${fragmentsBlock}

── E. HJEMMESIDE-REGISTER ───────────────────────────────────────────────────
Hjemmesiden fremstår: ${s.websiteRegisterHint}

── F. SERVICEPROGRAMMER OG ÅBNINGSTIDER ─────────────────────────────────────
${dayArcBlock}

── G. MÅLGRUPPE-SIGNALER ────────────────────────────────────────────────────
${s.audienceProfile ? `Lokationsprofil: ${s.audienceProfile}` : 'Ikke tilgængeligt'}

── ANALYSEOPGAVE ────────────────────────────────────────────────────────────
Identificér:
1. Det ene signal der adskiller denne virksomhed mest — ikke genren, men det specifikke
2. Hvad navngivningsstilen afslører om ejerpersonlighed
3. Hvad kombinationen af signaler siger om aspirationsniveauet
4. Om opslag bør skrives med antaget kendskab (etableret stamsted), broadcast-invitation (ny/event-drevet) eller formel velkomst
5. To konkrete faktum fra inputdata direkte brugbare i eksempel-opslag

OUTPUT JSON (ét objekt):
${ANALYSIS_SCHEMA}`

  try {
    const response = await fetchOpenAIWithRetry(
      apiKey,
      {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 600,
        response_format: { type: 'json_object' }
      },
      requestId,
      'Voice Pipeline B Call 1 (signal analysis)',
      { timeout: 18000, maxRetries: 1, retryDelayMs: 500, retryStatusCodes: [429, 503] }
    )
    const content = response.choices[0]?.message?.content
    return content ? parseOpenAIJson<SignalAnalysis>(content) : null
  } catch (err: any) {
    console.warn(`[${requestId}] Voice Pipeline B Call 1 failed:`, err?.message ?? err)
    return null
  }
}

// ─── Pipeline B — Call 2: Voice Generation ───────────────────────────────────

async function generateVoiceFromAnalysis(
  apiKey: string,
  businessName: string,
  businessType: string,
  location: string,
  analysis: SignalAnalysis,
  secondarySignals: SecondarySignals,
  requestId: string
): Promise<Omit<VoiceOption, 'source' | 'source_label'> | null> {
  // Conditional post-mode constraint — derived from Call 1, not hardcoded
  const postModeRule = analysis.recommended_post_mode === 'assumed_familiarity'
    ? 'Skriv til én person der allerede kender stedet. Antag kendskab: sig hvad der sker nu, ikke hvad stedet er. Undgå "vi"-broadcast og rekrutteringsverber som "besøg os", "kom og prøv".'
    : analysis.recommended_post_mode === 'broadcast_invitation'
      ? 'Adressér en potentiel førstegangsgæst direkte. Broadcast-invitationer som "besøg os" og "kom forbi" er passende.'
      : 'Hold en formel og imødekommende tone. Invitationsformuleringer er passende, men hold sproget præcist.'

  const systemPrompt = `Du er en ekspert i social medie-kommunikation for danske virksomheder.
Du modtager en færdig signalanalyse. Din opgave er at omsætte den til en konkret social medie-stemmeprofil.
Du finder den stemme der passer præcist til DENNE specifikke virksomhed — hverken højere eller lavere end analysen tilsiger.

REGLER FOR EXAMPLE_POSTS:
1. Skriv KUN adjektiver udledt af differentiating_detail_1/2 og naming_style_observation fra analysen. Aldrig generiske fyldeord.
2. Hold registret IDENTISK i begge opslag — kun emnet skifter. Ingen register-escalation.
3. Opfind ikke retter, steder eller stemninger der ikke fremgår af analysen.
4. Skriv sammenhængende sætninger. Brug aldrig " - " eller " – " som binding mellem led.
5. ${postModeRule}

Du genererer altid på dansk. Output ONLY valid JSON — no markdown, no commentary outside JSON.`

  const userPrompt = `Generér social medie-stemmeprofil for ${businessName}.

── SIGNALANALYSE (fra analyse-trin) ─────────────────────────────────────────
- Forretningstype: ${businessType}, ${location}
- Mest differentierende signal: ${analysis.most_differentiating_signal}
- Hvad det siger: ${analysis.what_it_says}
- Navngivningsstil: ${analysis.naming_style_observation}
- Ejerstemme: ${analysis.ownership_register}
- Aspirationsniveau: ${analysis.aspiration_level}
- Opslags-mode: ${analysis.recommended_post_mode}
- Konkret detalje 1: ${analysis.differentiating_detail_1}
- Konkret detalje 2: ${analysis.differentiating_detail_2}

── OPGAVE ────────────────────────────────────────────────────────────────────
Udled stemmen FRA analysen ovenfor. Begynd ikke med en kategori-stemme og find derefter bekræftende signaler.

KRAV TIL "label": 2-4 ord der KUN er sande for DENNE virksomhed.
Differentieringstest: Ville disse ord passe på en tilfældig café to gader væk? Hvis ja — find mere specifikke ord.
FORBUDTE labelord: "nærværende", "indbydende", "personlig", "atmosfærisk", "alsidig", "mangfoldig", "varieret", "moderne", "autentisk".
Brug i stedet ord der refererer til konkrete egenskaber: åbningstid, beliggenhed, menutype eller koncept.

KRAV TIL "tone_model.good_examples":
- Demonstrér KUN stemme-register og rytme — ingen retter, ingen stedsbeskrivelse, ingen CTA
- FORKERT: "Nyd brunch ved åen" (ret + sted), "Kom og prøv" (CTA), "Her er det en kunstform" (finedining-poetik)
- RIGTIGT: "Vi er klar." (register), "Det tager fem minutter." (rytme), "Han ved det." (tone)
- Mindst én af eksemplerne skal demonstrere registret i en situation UDEN mad — fx en person, et klokkeslæt eller en stemning beskrevet i én sætning
- En fremmed læser skal ikke kunne identificere virksomheden ud fra disse fraser alene

KRAV TIL "example_posts":
- Brug konkrete detaljer fra analysen (differentiating_detail_1 og _2)
- Kun adjektiver du kan pege på i analysen — ikke "lækker", "skøn", "saftig", "perfekt", "fantastisk"
- ${secondarySignals.dayArcProgrammes.length >= 2
    ? `Dæk hvert sit program fra: ${secondarySignals.dayArcProgrammes.join(', ')} — ét opslag per dagsdel`
    : 'Dæk to forskellige aspekter af virksomheden'}

OUTPUT JSON (ét objekt — ingen wrapper):
${ENRICHED_SCHEMA}`

  try {
    const response = await fetchOpenAIWithRetry(
      apiKey,
      {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.4,
        max_tokens: 1200,
        response_format: { type: 'json_object' }
      },
      requestId,
      'Voice Pipeline B Call 2 (voice generation)',
      { timeout: 20000, maxRetries: 1, retryDelayMs: 500, retryStatusCodes: [429, 503] }
    )
    const content = response.choices[0]?.message?.content
    if (!content) return null
    const parsed = parseOpenAIJson<any>(content)
    if (parsed?.tone_model?.good_examples) {
      parsed.tone_model.good_examples = sanitizeExamplePosts(parsed.tone_model.good_examples)
    }
    if (parsed?.example_posts) {
      parsed.example_posts = sanitizeExamplePosts(parsed.example_posts)
      // Layer 3: native-speaker naturalness pass — runs after regex sanitizer
      parsed.example_posts = await Promise.all(
        parsed.example_posts.map((p: string) => silentCorrect(p, 'da', '', apiKey))
      )
    }
    if (parsed?.voice_rationale) {
      parsed.voice_rationale = sanitizeBannedWords(parsed.voice_rationale)
    }
    return parsed
  } catch (err: any) {
    console.warn(`[${requestId}] Voice Pipeline B Call 2 failed:`, err?.message ?? err)
    return null
  }
}

// ─── Pipeline B — Coordinator ─────────────────────────────────────────────────

async function generateEnrichedVoiceOption(
  apiKey: string,
  businessName: string,
  businessType: string,
  location: string,
  keyMenuItems: string[],
  targetAudience: string,
  brandAnchors: string[],
  secondarySignals: SecondarySignals,
  requestId: string
): Promise<Omit<VoiceOption, 'source' | 'source_label'> | null> {
  const menuSample = keyMenuItems.slice(0, 10).join(', ')
  const anchorSample = brandAnchors.slice(0, 4).join(', ')

  // Call 1: analyse signals → commit to derivation before any voice generation
  const analysis = await analyseVoiceSignals(
    apiKey, businessName, businessType, location,
    secondarySignals, anchorSample, menuSample, requestId
  )
  if (!analysis) {
    console.warn(`[${requestId}] Voice Pipeline B Call 1 returned null — skipping Call 2`)
    return null
  }
  console.log(`[${requestId}] 🔍 Signal analysis: differentiating="${analysis.most_differentiating_signal}", aspiration="${analysis.aspiration_level}", post_mode="${analysis.recommended_post_mode}"`)

  // Call 2: generate voice profile from the committed analysis
  return generateVoiceFromAnalysis(
    apiKey, businessName, businessType, location,
    analysis, secondarySignals, requestId
  )
}

// Matches base form + common Danish inflections (e, ede, ere, est, este)
const BANNED_PATTERN = /\b(lækker[et]?e?|skønne?t?|saftige?t?|perfekte?t?|fantastiske?t?|uforglemmelige?t?|delikate?t?|alsidige?t?|mangfoldige?t?|ideell?e?t?|unikke?|speciel(?:le)?|vidunderlig[et]?e?)\b/gi

function sanitizeBannedWords(text: string): string {
  return text
    .replace(BANNED_PATTERN, '')
    .replace(/  +/g, ' ')
    .replace(/ ([,.])/g, '$1')
    .trim()
}

function sanitizeExamplePosts(posts: string[]): string[] {
  return posts.map(post =>
    post
      .replace(/ [–—] /g, '. ')
      .replace(/ - /g, '. ')
      .replace(/\.\s([a-zæøå])/g, (_, ch) => '. ' + ch.toUpperCase())
      .replace(/\.\.\.+/g, '.')
      .replace(BANNED_PATTERN, '')
      .replace(/  +/g, ' ')
      .replace(/ \./g, '.')
      .trim()
  )
}

// ─── Fallbacks ────────────────────────────────────────────────────────────────

function buildWebsiteFallback(businessName: string): Omit<VoiceOption, 'source' | 'source_label'> {
  return {
    label: 'Hjemmeside-stemme',
    tagline: 'Informativ og direkte',
    voice_rationale: `Stemmen afspejler ${businessName}s hjemmesidestil — neutral, informativ og faktabaseret.`,
    tone_model: { primary_keywords: ['informativ', 'direkte', 'neutral'], writing_rules: ['Brug korte sætninger', 'Tal direkte til læseren', 'Fokus på fakta'], good_examples: ['Vi åbner kl. 10.', 'Book dit bord her.'], avoid_examples: ['Oplev det utrolige…'], formality: 'informal', emoji_level: 'none' },
    things_to_avoid: { language_constraints: ['Undgå overdreven begejstring'], factual_constraints: ['Brug kun bekræftede detaljer'] },
    voice_constraints: 'Hold stilen tæt på hjemmesidens eksisterende kommunikation.',
    example_posts: ['Vi er klar til dig i dag.', 'Kom forbi og se hvad vi har.']
  }
}

function buildEnrichedFallback(businessName: string): Omit<VoiceOption, 'source' | 'source_label'> {
  return {
    label: 'Social stemme',
    tagline: 'Varm og inviterende',
    voice_rationale: `En social medie-stemme der inviterer gæster ind i oplevelsen hos ${businessName}.`,
    tone_model: { primary_keywords: ['indbydende', 'atmosfærisk', 'personlig'], writing_rules: ['Sæt scenen med et enkelt billede', 'Brug aktive verber', 'Invitér frem for at annoncere'], good_examples: ['Sollyset rammer bordet.', 'I dag smager det ekstra godt.'], avoid_examples: ['Book nu!'], formality: 'informal', emoji_level: 'minimal' },
    things_to_avoid: { language_constraints: ['Undgå aggressivt salgssprog'], factual_constraints: ['Nævn kun reelle retter'] },
    voice_constraints: 'Skab nærhed og lyst — undgå at lyde som en reklame.',
    example_posts: ['Fra morgen til aften — vi har plads til dig.', 'En stol ved vinduet og tid til at nyde det.']
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generates two voice options: "website" (faithful) and "ai_enriched" (social).
 * Always returns a valid VoiceOptions object — never throws or returns null.
 */
export async function generateVoiceOptions(
  apiKey: string,
  businessName: string,
  businessType: string,
  location: string,
  keyMenuItems: string[],
  websiteText: string,
  targetAudience: string,
  brandAnchors: string[],
  secondarySignals: SecondarySignals,
  requestId: string
): Promise<VoiceOptions> {
  const [websiteRaw, enrichedRaw] = await Promise.all([
    generateWebsiteVoiceOption(apiKey, websiteText, businessName, requestId),
    generateEnrichedVoiceOption(apiKey, businessName, businessType, location, keyMenuItems, targetAudience, brandAnchors, secondarySignals, requestId)
  ])

  const websiteOption: VoiceOption = {
    source: 'website',
    source_label: 'Analyseret fra din hjemmeside',
    ...(websiteRaw ?? buildWebsiteFallback(businessName))
  }

  const enrichedOption: VoiceOption = {
    source: 'ai_enriched',
    source_label: 'Baseret på menu, location og kundeoplevelse',
    ...(enrichedRaw ?? buildEnrichedFallback(businessName))
  }

  const result: VoiceOptions = {
    recommended: 'ai_enriched',
    recommended_reason: enrichedOption.voice_rationale,
    options: {
      website: websiteOption,
      ai_enriched: enrichedOption
    },
    generated_at: new Date().toISOString()
  }

  console.log(`[${requestId}] Voice options: website="${websiteOption.label}", ai_enriched="${enrichedOption.label}"`)

  // Divergence check: if both archetypes share the same first writing rule, the enriched
  // archetype has failed to derive signal-specific rules. Log a warning for monitoring.
  const websiteFirstRule: string = (websiteOption as any).tone_model?.writing_rules?.[0] ?? ''
  const enrichedFirstRule: string = (enrichedOption as any).tone_model?.writing_rules?.[0] ?? ''
  if (websiteFirstRule && enrichedFirstRule && websiteFirstRule === enrichedFirstRule) {
    console.warn(`[${requestId}] ⚠️ Voice archetype convergence detected: both options share identical first writing rule: "${websiteFirstRule.slice(0, 80)}..."`)
  }

  return result
}
