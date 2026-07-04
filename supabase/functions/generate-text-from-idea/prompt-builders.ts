// prompt-builders.ts
// All prompt-building functions for generate-text-from-idea.
// Exports: buildWeeklyPlanContext, buildPrompt

import type { Suggestion, PromptOptions, SharedToneCore, BrandBlockOptions } from './types.ts'

// ══════════════════════════════════════════════════════════════════════════
// FIX 3: LOCATION CONTEXT HELPERS — Prevent city-size hallucination
// ══════════════════════════════════════════════════════════════════════════

/**
 * Classify city size for vocabulary scaling.
 * Prevents small/medium cities from receiving large-city vocabulary.
 * FIX 2a from location vocabulary hallucination fix.
 */
function classifyCitySize(
  population: number | null | undefined,
  cityName: string
): 'large' | 'medium' | 'small' {
  // Known Danish cities — hardcoded to avoid relying on AI population estimates
  const LARGE_CITIES = ['København', 'Aarhus'];         // 200k+
  const MEDIUM_CITIES = [                                // 50k–200k
    'Odense', 'Aalborg', 'Esbjerg', 'Randers', 'Kolding',
    'Horsens', 'Vejle', 'Roskilde', 'Herning', 'Silkeborg',
    'Næstved', 'Fredericia', 'Viborg', 'Køge', 'Holstebro',
  ];

  if (LARGE_CITIES.some(c => cityName.toLowerCase().includes(c.toLowerCase()))) return 'large';
  if (MEDIUM_CITIES.some(c => cityName.toLowerCase().includes(c.toLowerCase()))) return 'medium';
  if (population && population >= 200000) return 'large';
  if (population && population >= 40000)  return 'medium';
  return 'small';
}

/**
 * Build the location context string for the generation prompt.
 *
 * Priority:
 * 1. neighborhood_character — factual AI-generated description (best)
 * 2. local_location_reference — manually set specific reference (e.g. "ved Åen")
 * 3. neighborhood — district name (e.g. "Silkeborg centrum")
 * 4. city name only — safe, factual, never embellished
 *
 * NEVER: use area_type as a source for copy language.
 * area_type is a classification signal ('city_centre', 'waterfront') — it is
 * not copy-ready language and must not be interpolated into marketing text.
 * 
 * FIX 3a from location vocabulary hallucination fix.
 */
function buildLocationContext(params: {
  neighborhood_character: string | null | undefined;
  local_location_reference: string | null | undefined;
  neighborhood: string | null | undefined;
  city: string | null | undefined;
  area_type: string | null | undefined;  // Classification only — never used as copy language
}): string {
  if (params.neighborhood_character) {
    return params.neighborhood_character;
  }
  if (params.local_location_reference) {
    return params.local_location_reference;
  }
  if (params.neighborhood) {
    return params.neighborhood;
  }
  if (params.city) {
    return params.city;
  }
  return ''; // No location context — better than hallucinated context
}

/**
 * Determine which fallback level was used for location context.
 * Used for logging to help detect when populate-location-intelligence needs to run.
 * FIX 3c from location vocabulary hallucination fix.
 */
function getLocationFallbackLevel(params: {
  neighborhood_character: string | null | undefined;
  local_location_reference: string | null | undefined;
  neighborhood: string | null | undefined;
  city: string | null | undefined;
}): 'neighborhood_character' | 'local_location_reference' | 'neighborhood' | 'city_only' | 'none' {
  if (params.neighborhood_character) return 'neighborhood_character';
  if (params.local_location_reference) return 'local_location_reference';
  if (params.neighborhood) return 'neighborhood';
  if (params.city) return 'city_only';
  return 'none';
}

// ══════════════════════════════════════════════════════════════════════════
// FIX 05: CONTENT-TYPE EMOJI OVERRIDE
// ══════════════════════════════════════════════════════════════════════════

/**
 * Apply content-type specific emoji overrides.
 * For atmosphere, team, and event posts, restrict emoji domain to prevent
 * food/drink emojis on non-food content types.
 * FIX 05: World-class emoji system (principle-based, not cuisine-hardcoded)
 */
function applyContentTypeEmojiOverride(
  baseInstruction: string,
  contentType: string | null,
  language: string
): string {
  // These content types should never produce food/drink emojis
  const overrides: Record<string, Record<string, string>> = {
    atmosphere: {
      da: 'EMOJI-REGLER: Brug ét emoji der afspejler stemningen i teksten — f.eks. ✨🌅🌆🌃🌊. Ingen mad- eller drikke-emojis på stemningsposts. Placer det til sidst.',
      en: 'EMOJI RULES: Use one emoji reflecting the mood — e.g. ✨🌅🌆🌃🌊. No food or drink emojis on atmosphere posts. Place at the end.',
    },
    team_people: {
      da: 'EMOJI-REGLER: Brug ét emoji der afspejler menneskene eller arbejdet i teksten — f.eks. 🧑‍🍳🙌🤝. Ingen mad-emojis på team-posts. Placer det til sidst.',
      en: 'EMOJI RULES: Use one emoji reflecting the people or work described — e.g. 🧑‍🍳🙌🤝. No food emojis on team posts. Place at the end.',
    },
    behind_scenes: {
      da: 'EMOJI-REGLER: Brug ét emoji der afspejler menneskene eller arbejdet i teksten — f.eks. 🧑‍🍳🙌🤝. Ingen mad-emojis på team-posts. Placer det til sidst.',
      en: 'EMOJI RULES: Use one emoji reflecting the people or work described — e.g. 🧑‍🍳🙌🤝. No food emojis on team posts. Place at the end.',
    },
    event: {
      da: 'EMOJI-REGLER: Brug ét emoji der afspejler begivenheden i teksten — f.eks. 🎉🗓️🎶. Ingen mad-emojis medmindre begivenheden handler om en ret. Placer det til sidst.',
      en: 'EMOJI RULES: Use one emoji reflecting the event described — e.g. 🎉🗓️🎶. No food emojis unless the event is about a dish. Place at the end.',
    },
  }

  const lang = language === 'da' ? 'da' : 'en'
  return overrides[contentType ?? '']?.[lang] ?? baseInstruction
}

// ══════════════════════════════════════════════════════════════════════════

// ── sanitizeGuestMoment ────────────────────────────────────────────────────
// Strip Danish strategy-reasoning clauses from guest moment strings.
// Source data sometimes appends why-this-dish rationale after the actual
// occasion description — we keep only the occasion part.
function sanitizeGuestMoment(raw: string): string {
  // Phase 1: truncate at mid-sentence strategy signals
  const markers = [
    /,?\s*selvom\b/i,
    /,?\s*trods\b/i,
    /,?\s+da\s+/i,
    /,?\s*fordi\b/i,
    /\bbudgettet\b/i,
    /\blønning\b/i,
    /\bprisniveau\b/i,
    /\bprisbevidstheden\b/i,
  ]
  let result = raw
  for (const marker of markers) {
    const match = marker.exec(result)
    if (match?.index !== undefined) result = result.slice(0, match.index)
  }
  result = result.replace(/[,;—\s]+$/, '').trim()

  // Phase 2: drop entire sentences that are pure strategy framing
  const strategyPhrasePatterns = [
    /\b(perfekte?|ideelle?)\s+(måde|tidspunkt|lejlighed)\b/i,
    /\bfejre\s+(ugens|dagens|månedens)\b/i,
    /\b(ugens|dagens)\s+afslutning\b/i,
    /\bbrandloyalitet\b/i,
    /\bfastholdelse\b/i,
    /\bgæsteloyalitet\b/i,
    /\bkonverteringsrate\b/i,
    /\bstrategisk\b/i,
  ]
  const sentences = result.split(/(?<=[.!?])\s+/)
  const cleaned = sentences.filter(s => !strategyPhrasePatterns.some(p => p.test(s)))
  return cleaned.join(' ').trim()
}

// ── buildWeeklyPlanContext ─────────────────────────────────────────────────
// Builds the UGEPLANKONTEKST block for Weekly Plan posts.
// Only lines where the value is non-empty are included.
export function buildWeeklyPlanContext(s: Suggestion, captionFirstLineUsedAsHook = false): string {
  const lines: string[] = []
  
  // Strategic Slot Context — Phase 1's strategic framing for this post
  if (s.slotId || s.strategicIntent) {
    const slotLabel = s.slotId ? `#${s.slotId}` : ''
    const intent = s.strategicIntent || ''
    if (slotLabel || intent) {
      lines.push(`STRATEGISK SLOT ${slotLabel}: ${intent}`.trim())
    }
  }
  if (s.slotReasoning) {
    lines.push(`HVORFOR DENNE VINKEL: ${s.slotReasoning}`)
  }
  
  if (s.guestMoment) {
    const cleanMoment = sanitizeGuestMoment(s.guestMoment)
    if (cleanMoment) lines.push(`GÆSTEMOMENT: ${cleanMoment}`)
  }
  if (s.timingDay || s.timingTime) {
    const timePart = s.timingTime ? ` kl. ${s.timingTime}` : ''
    const rationale = s.timingRationale ? ` — ${s.timingRationale}` : ''
    lines.push(`TIMING: ${s.timingDay || ''}${timePart}${rationale}`)
  }
  if (s.visualSubject) {
    const parts = [s.visualSubject, s.visualAngle, s.visualSetting ? `(${s.visualSetting})` : ''].filter(Boolean)
    lines.push(`VISUEL RETNING: ${parts.join(' — ')}`)
  } else if (s.photoIdea) {
    // AI Ideas path: no structured visualDirection, but Gemini generated a mobile-photo instruction
    lines.push(`VISUEL RETNING: ${s.photoIdea}`)
  }
  if (s.platformFormat) lines.push(`FORMAT: ${s.platformFormat}`)
  // captionFirstLine is omitted when it was already promoted to the hook position (non-menu posts)
  if (s.captionFirstLine && !captionFirstLineUsedAsHook) lines.push(`FORSLÅET ÅBNINGSLINJE (reformuler i brandets stemme): "${s.captionFirstLine}"`)
  if (s.selectionRationale) {
    const cleanRationale = sanitizeGuestMoment(s.selectionRationale)
    if (cleanRationale) lines.push(`POSTENS ROLLE I UGEN: ${cleanRationale}`)
  }
  if (s.holidayContext) {
    lines.push(`⚠️ HELLIGDAG: ${s.holidayContext} — AL framing SKAL afspejle denne helligdag. Generisk framing er ugyldig.`)
  }
  
  // NEW: Segment Coverage Context (June 27, 2026)
  // Distinguishes strategic segment posts from gap-time capacity posts
  if (s.segmentCoverage) {
    if (s.segmentCoverage.mode === 'strategic_segment' && s.segmentCoverage.matchedSegment) {
      const seg = s.segmentCoverage.matchedSegment
      lines.push(`\n🎯 SEGMENT-MATCH: ${seg.people_type} (${seg.timing})`)
      if (seg.situation) {
        lines.push(`MÅLGRUPPE: ${seg.situation}`)
      }
      lines.push(`FRAMING-KRAV: Brug denne segments personas, occasions og motivationer. Undgå generisk framing — skriv specifikt til segmentets situation.`)
    } else if (s.segmentCoverage.mode === 'gap_capacity') {
      lines.push(`\n⚡ GAP-KAPACITET: Ingen segment-match for dette tidspunkt`)
      lines.push(`FRAMING-TILGANG: Brug formatstyrker (AYCE, beliggenhed, variation, spontan interesse) + brand voice. Undgå at tvinge segment-personas (date night, vennegrupper, familier) ind i indholdet. Fokus på universelle appeals og format-driven værdi.`)
      if (s.segmentCoverage.gapRationale) {
        lines.push(`KONTEKST: ${s.segmentCoverage.gapRationale}`)
      }
    }
  }
  
  if (lines.length === 0) return ''
  return `\nUGEPLANKONTEKST:\n${lines.join('\n')}\n`
}

// ══════════════════════════════════════════════════════════════════════════
// SHARED TONE CORE
// Single source of truth for all invariant prompt constraints.
// Both buildAIIdeasPrompt() and buildWeeklyPlanPrompt() consume this.
// ══════════════════════════════════════════════════════════════════════════
function buildSharedToneCore(opts: PromptOptions): SharedToneCore {
  const { menuItemName, menuItemDescription, contentType, isPaid,
          brandWritingRules, brandGoodExamples, brandAvoidExamples,
          brandPreferVocab, brandAvoidVocab, locationVocabulary, contentAnchors } = opts

  // ── Dish rules ─────────────────────────────────────────────────────────
  const dishRules: Record<string, string> = {
    da: menuItemName
      ? '4. Nævn KUN den ret der er nævnt i INDHOLD — ingen andre retter, ingen add-ons'
      : '4. Nævn INGEN mad, retter eller drikkevarer medmindre de er eksplicit nævnt i INDHOLD',
    sv: menuItemName
      ? '4. Nämn BARA den rätt som anges i INNEHÅLL — inga andra rätter, inga tillägg'
      : '4. Nämn INGEN mat, rätter eller drycker om de inte uttryckligen anges i INNEHÅLL',
    de: menuItemName
      ? '4. Erwähne NUR das Gericht, das im INHALT angegeben ist — keine anderen Gerichte, keine Add-ons'
      : '4. Erwähne KEINE Speisen, Gerichte oder Getränke, die nicht ausdrücklich im INHALT stehen',
    en: menuItemName
      ? '4. Mention ONLY the dish named in CONTENT — no other dishes, no add-ons'
      : '4. Mention NO food, dishes or drinks unless they are explicitly stated in CONTENT',
  }

  // ── Sensory rules ──────────────────────────────────────────────────────
  const isMenuPost = contentType === 'menu_item' || contentType === 'product_menu' || contentType === 'craving_visual'
  const hasQualifiedDescription = menuItemDescription.length >= 30
  const hasDishNameOnly = isMenuPost && !!menuItemName && !hasQualifiedDescription
  const sensoryRules: Record<string, string> = {
    da: hasQualifiedDescription
      ? '3. INDHOLD indeholder en beskrivelse — brug PRÆCIS de ingredienser, egenskaber og smagselementer der er angivet der. Byg 1-2 sansedetaljer (syn/tekstur/temperatur/duft) direkte på dem. Opfind IKKE ingredienser eller teksturer der ikke fremgår af INDHOLD. Dediker mindst én fuld sætning til at vi kan SMAGE eller SE retten baseret på det der faktisk står.'
      : hasDishNameOnly
        ? '3. INDHOLD har kun rettens navn — ingen fakta fra andre kilder må bruges. Brug 1-2 sanseelementer der er UNIVERSELT SANDE for denne rettetype (hvad retten faktisk ser ud og smager som — fx gryde: dampende, tyk sauce, kraftig kødaromatik; bøf: mørk stegeskorpe, saftigt indre; salat: sprødhed, friskhed; æggekage: gyldenbrun, blød midte). ÉN fuld sætning dedikeret til rettens faktiske fremtræden. ABSOLUT FORBUDT når kun navn foreligger: lokation, udsigt ("åen", "udsigten", "vandet"), vejr, atmosfære, stedsbeskrivelse, "verden af smag", "sanser der danser", "varme og dybde" — disse er filler, IKKE beskrivelse. Filler = fejl.'
        : '3. 1 konkret sansedetalje (syn/lyd/tekstur/temperatur) som kan udledes direkte fra INDHOLD',
    sv: hasQualifiedDescription
      ? '3. Bygg 1-2 konkreta sinnesdetaljer (syn/textur/temperatur/doft) direkt på ingredienserna i INNEHÅLL — rättens namn räknas INTE som beskrivning. Dedikera minst en hel mening till att vi kan SMAKA eller SE rätten'
      : hasDishNameOnly
        ? '3. INNEHÅLL har bara rättens namn — inga fakta från andra källor får användas. Använd 1-2 sinnenselement som är UNIVERSELLT SANNA för denna rättstyp. EN hel mening dedikerad till rättens faktiska utseende och smak. ABSOLUT FÖRBJUDET: plats, utsikt, atmosfär, väder — det är utfyllnad, INTE beskrivning.'
        : '3. 1 konkret sinnesdetalj från INNEHÅLL',
    de: hasQualifiedDescription
      ? '3. Baue 1-2 konkrete Sinnesdetails (Sehen/Textur/Temperatur/Duft) direkt auf die Zutaten im INHALT auf — der Gerichtsname allein zählt NICHT als Beschreibung. Widme mindst einen ganzen Satz dafür, dass man das Gericht SCHMECKEN oder SEHEN kann'
      : hasDishNameOnly
        ? '3. INHALT hat nur den Gerichtsnamen — keine Fakten aus anderen Quellen. Verwende 1-2 Sinnesmerkmale die UNIVERSELL WAHR sind für diesen Gerichtstyp. EIN ganzer Satz der Beschreibung des Aussehens/Geschmacks. ABSOLUT VERBOTEN: Ort, Aussicht, Atmosphäre, Wetter — das ist Füller, KEINE Beschreibung.'
        : '3. 1 konkretes Sinnesdetail aus dem INHALT',
  }

  // ── FAKTAFORBUD — single source, never duplicated ──────────────────────
  // Principle-based, not phrase-based. Banning specific phrases is whack-a-mole
  // and grows unbounded. Instead: establish that every claim must be traceable
  // to a line in this prompt. This works for any language and any venue type.
  const faktaforbud: Record<string, string> = {
    da: `\n🚫 KILDEKRAV — gælder for ENHVER detalje i teksten
Denne tekst er journalistik, ikke kreativ fiktion. Du må KUN skrive om det der er dokumenteret i denne prompt.
- Hvert konkret substantiv, rekvisit, sansedetalje og lokationselement i din tekst skal kunne peges direkte tilbage til en linje i INDHOLD, 📍 FAKTISKE LOKATIONSREFERENCER eller 📸 PRIMÆR FAKTAKILDE.
- Kan du IKKE pege på kilden → slet elementet.
- Stednavne i INDHOLD angiver lokation — de er IKKE tilladelse til at opfinde udsigt, natur, vejr eller interiør fra din generelle viden om det sted.
- BRANDSTEMME-blokken er en TONEKILDE, ikke en faktakilde. Konkrete omgivelser, rekvisitter og lokaliteter nævnt i brandeksempler er scenedetaljer fra de eksempler — de er IKKE facts om det aktuelle opslag og må IKKE overføres.
- 📍 FAKTISKE LOKATIONSREFERENCER er gyldige facts om DENNE virksomheds placering — brug disse når relevant.
- Hvis 📸 PRIMÆR FAKTAKILDE beskriver rummet som lyst, kan du IKKE skrive dæmpet lys. Faktakilden er autoritativ og tilsidesætter enhver stemningsimpression fra andre steder.
- Din træningsdata om virksomheden er IKKE en gyldig kilde — brug KUN det der fremgår af denne prompt.\n`,

    sv: `\n🚫 KÄLLKRAV — gäller för VARJE detalj i texten
Den här texten är journalistik, inte kreativ fiktion. Du får BARA skriva om det som är dokumenterat i den här prompten.
- Varje konkret substantiv, rekvisita, sinnesdetalj och platselement i din text måste kunna spåras direkt till en rad i INNEHÅLL, 📍 FAKTISKA PLATSREFERENSER eller 📸 PRIMÄR FAKTAKÄLLA.
- Kan du INTE peka på källan → ta bort elementet.
- Platsnamn i INNEHÅLL anger lokation — de är INTE tillstånd att uppfinna utsikt, natur, väder eller interiör från din allmänna kunskap om platsen.
- VARUMÄRKESRÖST-blocket är en TONKÄLLA, inte en faktakälla. Konkreta miljöer, rekvisita och platser nämnda i varumärkesexempel är scenedetaljer från dessa exempel — de är INTE fakta om det aktuella inlägget och får INTE överföras.
- 📍 FAKTISKA PLATSREFERENSER är giltiga fakta om DETTA företags plats — använd dessa när relevant.
- Om 📸 PRIMÄR FAKTAKÄLLA beskriver lokalen som ljus kan du INTE skriva dämpad belysning. Faktakällan är auktoritativ.
- Din träningsdata om företaget är INTE en giltig källa — använd KUN det som framgår av den här prompten.\n`,

    de: `\n🚫 QUELLENGEBOT — gilt für JEDES Detail im Text
Dieser Text ist Journalismus, keine kreative Fiktion. Du darfst NUR über das schreiben, was in diesem Prompt dokumentiert ist.
- Jedes konkrete Substantiv, Requisit, Sinnesdetail und Standortelement in deinem Text muss direkt auf eine Zeile in INHALT oder 📸 PRIMÄRE FAKTENQUELLE zurückgeführt werden können.
- Kannst du die Quelle NICHT benennen → streiche das Element.
- Ortsnamen im INHALT geben den Standort an — sie sind KEINE Erlaubnis, aus deinem Allgemeinwissen über diesen Ort Aussicht, Natur, Wetter oder Interieur zu erfinden.
- Der MARKENSTIMME-Block ist eine TONQUELLE, keine Faktenquelle. Konkrete Umgebungen, Requisiten und Orte in Markenbeispielen (z.B. "am Fluss", "Aussicht", "das Wasser") sind Szenendetails dieser Beispiele — sie sind KEINE Fakten über den aktuellen Beitrag und dürfen NICHT übertragen werden.
- Wenn 📸 PRIMÄRE FAKTENQUELLE den Raum als hell beschreibt, kannst du KEIN gedämpftes Licht schreiben. Die Faktenquelle ist autoritativ.
- Deine Trainingsdaten über das Unternehmen sind KEINE gültige Quelle — nutze NUR was aus diesem Prompt hervorgeht.\n`,

    en: `\n🚫 SOURCE REQUIREMENT — applies to EVERY detail in the text
This text is journalism, not creative fiction. You may ONLY write about what is documented in this prompt.
- Every concrete noun, prop, sensory detail and location element in your text must be traceable directly to a line in CONTENT, 📍 FACTUAL LOCATION REFERENCES or 📸 PRIMARY FACT SOURCE.
- Cannot point to the source → remove the element.
- Location names in CONTENT indicate location — they are NOT permission to invent views, nature, weather or interior from your general knowledge of that place.
- The BRAND VOICE block is a TONE SOURCE, not a fact source. Concrete settings, props and locations mentioned in brand examples are scene details from those examples — they are NOT facts about the current post and must NOT be transferred.
- 📍 FACTUAL LOCATION REFERENCES are valid facts about THIS business's location — use these when relevant.
- If 📸 PRIMARY FACT SOURCE describes the space as bright, you cannot write dim lighting. The fact source is authoritative.
- Your training data about the business is NOT a valid source — use ONLY what appears in this prompt.\n`,

  }

  // ── Brand block caps ───────────────────────────────────────────────────
  const cappedWritingRules = brandWritingRules
    .flatMap(r => {
      const parts = r.split(' — ')
      return parts.length === 2 && parts[0].trim().length > 5 && parts[1].trim().length > 5
        ? [parts[0].trim(), parts[1].trim()]
        : [r]
    })
    .slice(0, 5)
  const cappedGoodExamples   = brandGoodExamples.slice(0, 3)
  const cappedAvoidExamples  = brandAvoidExamples.slice(0, 3)
  const cappedPreferVocab    = brandPreferVocab.slice(0, 4)
  const cappedAvoidVocab     = brandAvoidVocab.slice(0, 4)
  const cappedContentAnchors = contentAnchors.slice(0, 10)

  const isSceneMoodPost = contentType === 'behind_scenes' || contentType === 'atmosphere' || contentType === 'team_people'
  const qualityNote = isPaid ? '\nTeksten skal føles poleret og personlig — ikke generisk.' : ''

  return {
    faktaforbud, dishRules, sensoryRules,
    cappedWritingRules, cappedGoodExamples, cappedAvoidExamples,
    cappedPreferVocab, cappedAvoidVocab, cappedContentAnchors,
    isSceneMoodPost, qualityNote,
  }
}

// ══════════════════════════════════════════════════════════════════════════
// GOAL DIRECTIVE MAP (Weekly Plan only)
// ══════════════════════════════════════════════════════════════════════════
const GOAL_DIRECTIVE_MAP: Record<string, Record<string, string>> = {
  drive_footfall: {
    da: 'Formål: Skab lyst til at besøge stedet nu eller inden for de næste dage — teksten skal føles som en konkret, oprigtig invitation.\nSkrivestil: Tidsforankret (i dag, i aften, denne uge) · konkret og handlingsrettet · fortæl hvad der er nu, ikke hvad der måske er engang — ingen abstrakt stemning, ingen generisk ros af stedet.',
    sv: 'Syfte: Skapa lust att besöka stället nu eller inom de närmaste dagarna — texten ska kännas som en konkret, uppriktig inbjudan.\nSkrivsätt: Tidsförankrad (idag, ikväll, den här veckan) · konkret och handlingsinriktad · berätta vad som händer nu, inte vad som möjligtvis händer en gång.',
    de: 'Zweck: Lust wecken, den Ort jetzt oder in den nächsten Tagen zu besuchen — der Text soll wie eine konkrete, aufrichtige Einladung wirken.\nSchreibstil: Zeitverankert (heute, heute Abend, diese Woche) · konkret und handlungsorientiert · erzähle was jetzt da ist — keine abstrakte Stimmung, kein generisches Lob des Ortes.',
  },
  build_brand: {
    da: 'Formål: Styrk stedets identitet og udtryk — ikke sælg et besøg, men fortæl hvem dette sted er. Brandstemmen er pointen med dette opslag.\nSkrivestil: Identitetsbærende · ét billede eller én kvalitet er nok — gå i dybden frem for i bredden · ingen visit-energi, ingen booking-pres — lad stedet tale om sig selv.',
    sv: 'Syfte: Stärk platsens identitet och uttryck — sälj inte ett besök, berätta vem detta ställe är. Varumärkesstemman är poängen med det här inlägget.\nSkrivsätt: Identitetsbärande · en bild eller en kvalitet räcker — gå på djupet snarare än på bredden · ingen visit-energi, inget bokningtryck — låt platsen tala för sig själv.',
    de: 'Zweck: Stärke die Identität und den Ausdruck des Ortes — verkaufe keinen Besuch, erzähle, wer dieser Ort ist. Die Markenstimme ist der Kern dieses Beitrags.\nSchreibstil: Identitätstragend · ein Bild oder eine Eigenschaft reicht — Tiefe statt Breite · keine Besuchsenergie, kein Buchungsdruck — lass den Ort für sich sprechen.',
  },
  retain_loyalty: {
    da: 'Formål: Tal direkte til faste gæster — skriv som om du taler til nogen der allerede kender stedet og føler sig hjemme her.\nSkrivestil: Insider-register · antag fælles kontekst, forklar ikke det åbenlyse · kontinuitet snarere end nyhed — det der altid er godt, eller det der er tilbage igen · ingen præsentation af stedet, ingen intro-sætninger.',
    sv: 'Syfte: Tala direkt till stamgäster — skriv som om du talar till någon som redan känner stället och känner sig hemma där.\nSkrivsätt: Insider-register · anta gemensam kontext, förklara inte det uppenbara · kontinuitet snarare än nyhet — det som alltid är bra, eller det som är tillbaka igen.',
    de: 'Zweck: Sprich direkt zu Stammgästen — schreibe, als würden du mit jemandem sprechen, der den Ort bereits kennt und sich dort zu Hause fühlt.\nSchreibstil: Insider-Register · nehme gemeinsamen Kontext an, erkläre nicht das Offensichtliche · Kontinuität statt Neuheit — was immer gut ist, oder was wieder da ist.',
  },
}

// ══════════════════════════════════════════════════════════════════════════
// buildBrandBlock — shared across all language templates
// ══════════════════════════════════════════════════════════════════════════
function buildBrandBlock(o: BrandBlockOptions): string {
  if (!o.brandTone && o.brandWritingRules.length === 0 && o.contentAnchors.length === 0 && !o.keyOfferings) return ''
  const brandBlockHeader = o.goalMode === 'build_brand'
    ? 'BRANDSTEMME (dette er ikke bare skrivestil — brandstemmen ER pointen med dette opslag):'
    : o.goalMode === 'drive_footfall'
    ? 'BRANDSTEMME (brug brandets stemme til at gøre invitationen konkret og stedsspecifik — ikke generisk):'
    : o.goalMode === 'retain_loyalty'
    ? 'BRANDSTEMME (skriv i brandets stemme som om du taler til nogen der allerede kender stedet):'
    : 'BRANDSTEMME (følg denne — stil, ikke fakta):'
  let b = brandBlockHeader

  // For atmosphere/behind_scenes/team_people: photo analysis is the PRIMARY factual anchor.
  // It goes first so the model treats it as the concrete foundation, not an afterthought.
  if (o.isSceneMoodPost) {
    if (o.venueIdentity) {
      b += `\n📸 PRIMÆR FAKTAKILDE — eneste gyldige kilde til rumlig og visuel beskrivelse. Tilsidesætter enhver impression fra brandeksempler. Brug UDELUKKENDE det der er beskrevet her:\n${o.venueIdentity}`
    } else {
      b += `\n⚠️ Ingen fotobeskrivelse er tilgængelig. Opfind IKKE visuel atmosfære eller interiørdetaljer. Basér det konkrete element udelukkende på konceptankre og stedsidentitet nedenfor.`
    }
  }

  if (o.contentAnchors.length)      b += `\nKonceptankre (hvad dette sted faktisk tilbyder): ${o.contentAnchors.join(', ')}`
  if (o.keyOfferings) {
    const offeringLines = o.keyOfferings
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .slice(0, 10)
    if (offeringLines.length) {
      b += `\nHusets navne (kun navne, især vigtigt for free-tier): ${offeringLines.join(', ')}`
    }
  }
  if (o.businessCharacter)          b += `\nHvad dette sted er: ${o.businessCharacter}`
  
  // Location vocabulary BEFORE tone/examples — establishes these as PRIMARY FACTS
  if (o.locationVocabulary.length)  {
    b += `\n📍 FAKTISKE LOKATIONSREFERENCER — dokumenterede stedsbeskrivelser for DENNE virksomhed:\n${o.locationVocabulary.map(term => `  • ${term}`).join('\n')}`
    b += `\nNår du refererer til lokation: brug PRÆCIST disse termer (ikke generiske alternativer).`
  }
  
  // FIX 01: FACTUAL CONSTRAINT FOR ATMOSPHERE/AVAILABILITY POSTS (no verified interior description)
  // When contentType is atmosphere or availability AND no venue identity is available, the model
  // must be explicitly constrained from inventing interior/window/light details.
  const isAtmosphereOrAvailability = o.contentType === 'atmosphere' || o.contentType === 'availability'
  if (isAtmosphereOrAvailability && !o.venueIdentity && !o.venueScene) {
    const locationVocabForPrompt = o.locationVocabulary.length > 0 
      ? o.locationVocabulary.join(', ') 
      : 'ved åen, på Åboulevarden'  // Fallback for Café Faust context
    
    const outdoorSeatingNote = o.hasOutdoorSeating === true 
      ? 'udeservering (verificeret)' 
      : o.hasOutdoorSeating === false 
        ? '' 
        : 'udeservering (kun hvis verificeret)'
    const factualAnchors = ['åbningstider', outdoorSeatingNote, 'konkrete retter fra menuen']
      .filter(x => x)
      .join(', ')
    b += `\n\n🚫 FAKTUEL BEGRÆNSNING — ATMOSFÆREPOST UDEN VERIFICERET INDRETNINGSBESKRIVELSE:
- Du har INGEN verificeret beskrivelse af indretningen, vinduerne, lyset eller interiøret.
- Du MÅ IKKE opfinde sanselige detaljer om interiøret (vinduer, lys, gulv, indretning, stemning inde).
- Brug KUN verificerede lokationsreferencer: ${locationVocabForPrompt}.
- Faktuelle ankerpunkter du KAN bruge: ${factualAnchors}.
${o.hasOutdoorSeating === false ? '- 🚫 NÆVN IKKE udeservering, terrasse eller udendørs spisning — virksomheden har IKKE udendørs pladser.\n' : ''}- Hvis intet konkret at sige: skriv én sætning om location + én om hvad der serveres nu. Stop.`
  }
  
  if (o.brandTone)                  b += `\n${o.brandTone}`

  if (o.brandWritingRules.length)   b += `\nSkriveregler:\n${o.brandWritingRules.map(r => `- ${r}`).join('\n')}`
  if (o.brandGoodExamples.length) {
    const exLabel = o.isSceneMoodPost
      ? 'Stemmeeksempler — KUN sprogtone og rytme. Konkrete omgivelser, lokaliteter og rekvisitter i disse eksempler (fx "ved åen", "udsigt", "vandet") tilhører EKSEMPLETS scene — de er IKKE facts om dette opslag:'
      : 'Gode eksempler (stil, ikke indhold):'
    b += `\n${exLabel}\n${o.brandGoodExamples.map(e => `- "${e}"`).join('\n')}`
  }
  if (o.brandAvoidExamples.length)  b += `\nUndgå disse mønstre:\n${o.brandAvoidExamples.map(e => `- ${e}`).join('\n')}`
  if (o.brandPreferVocab.length)    b += `\nForetrukket ordforråd: ${o.brandPreferVocab.join(', ')}`
  if (o.brandAvoidVocab.length)     b += `\n🚫 Undgå ordforråd: ${o.brandAvoidVocab.join(', ')}`
  if (o.brandSignaturePhrases.length) b += `\nBrandets fraser — brug KUN hvis frasen direkte passer til INDHOLD og idéens stemning, ellers spring over: ${o.brandSignaturePhrases.join(' · ')}`
  if (o.thingsToAvoid)              b += `\n🚫 Undgå altid: ${o.thingsToAvoid}`
  if (o.voiceRationale && o.isSceneMoodPost) b += `\n🚫 REGISTERVAGT\n${o.voiceRationale}`
  return `\n${b}\n`
}

// ══════════════════════════════════════════════════════════════════════════
// PATH BUILDER: AI IDEER (Quick Ideas)
// source === 'ai_ideas'. No goal directive, no UGEPLANKONTEKST.
// ══════════════════════════════════════════════════════════════════════════
function buildAIIdeasPrompt(opts: PromptOptions): string {
  const {
    hook, contentBlock, menuItemName, contentType,
    brandTone, brandSignaturePhrases,
    voiceConstraints, emojiInstruction,
    todayOpenTime, selectedCta, businessName, city, language, ctaStyle, goalMode,
    voiceRationale, venueIdentity, businessCharacter, identityKeywords,
    isPaid, neighborhoodCharacter, locationMarketingHooks, signatureThemes,
  } = opts

  // FIX 05: Apply content-type emoji override before using emojiInstruction in prompts
  const finalEmojiInstruction = applyContentTypeEmojiOverride(
    emojiInstruction,
    contentType,
    language
  )

  // FIX 3: Build location context with strict fallback priority
  const locationContext = buildLocationContext({
    neighborhood_character: opts.neighborhoodCharacter,
    local_location_reference: opts.localLocationReference,
    neighborhood: opts.neighborhood,
    city: opts.city,
    area_type: opts.areaType,
  });

  const fallbackLevel = getLocationFallbackLevel({
    neighborhood_character: opts.neighborhoodCharacter,
    local_location_reference: opts.localLocationReference,
    neighborhood: opts.neighborhood,
    city: opts.city,
  });

  console.log(`📍 [AI Ideas] Location context source: ${fallbackLevel}`, {
    value: locationContext?.substring(0, 80) || 'empty',
  });

  if (fallbackLevel === 'city_only' || fallbackLevel === 'none') {
    console.warn(
      `⚠️ [AI Ideas] Location context is weak (${fallbackLevel}). ` +
      `Run populate-location-intelligence with force_refresh=true ` +
      `to generate neighborhood_character.`
    );
  }

  // FIX 3b: Add city-size guard for medium/small cities
  const citySize = classifyCitySize(undefined, city || '');
  const citySizeGuard = citySize !== 'large' && city
    ? `\nVIGTIGT: Undgå storby-sprog. ${city} er ikke en storby. ` +
      `Skriv IKKE: "pulserende byliv", "byens puls", "urban energi", "storbyatmosfære". ` +
      `Brug i stedet konkrete, faktuelle referencer til ${city}.`
    : '';

  console.log(`📍 [AI Ideas] City size classification: ${citySize} (${city})`, {
    city_size_guard_active: citySize !== 'large',
  });

  const core = buildSharedToneCore(opts)
  const {
    faktaforbud, dishRules, sensoryRules,
    cappedWritingRules, cappedGoodExamples, cappedAvoidExamples,
    cappedPreferVocab, cappedAvoidVocab, cappedContentAnchors,
    isSceneMoodPost, qualityNote,
  } = core

  const hoursBlock = todayOpenTime
    ? `\n⏰ ÅBNINGSTID I DAG (kun hvis relevant og kun hvis sandt): ${todayOpenTime} — nævn IKKE tidspunkter der antyder åbning tidligere end dette.\n`
    : ''

  // Activation line — makes brand voice an active instrument, not a style layer.
  const hasBrandVoice = !!(brandTone || cappedWritingRules.length > 0 || cappedContentAnchors.length > 0)
  const activationMap: Record<string, string> = {
    da: 'Brug brandets stemme til at gøre netop denne idé til en naturlig, konkret ytring fra denne virksomhed — ikke et generisk AI-opslag der kunne komme fra hvem som helst.',
    sv: 'Använd varumärkets röst för att göra just den här idén till ett naturligt, konkret uttryck från detta företag — inte ett generiskt AI-inlägg som kunde komma från vem som helst.',
    de: 'Nutze die Markenstimme, um genau diese Idee zu einem natürlichen, konkreten Ausdruck dieses Unternehmens zu machen — kein generischer KI-Beitrag, der von jedem kommen könnte.',
  }
  const activationLine = hasBrandVoice
    ? `${activationMap[language] || activationMap.da}\n`
    : ''

  // behind_scenes perspective hint
  const behindScenesMap: Record<string, string> = {
    da: 'For dette behind-the-scenes opslag: skriv i første person fra teamets synspunkt — som om det er virksomheden der taler direkte, ikke en der fortæller om den.',
    sv: 'För det här behind-the-scenes-inlägget: skriv i första person från teamets synvinkel — som om det är företaget som talar direkt, inte någon som berättar om det.',
    de: 'Für diesen Behind-the-Scenes-Beitrag: schreibe in der Ersten Person aus der Perspektive des Teams — als würde das Unternehmen direkt sprechen, nicht als würde jemand darüber berichten.',
  }
  const contentTypeHint = contentType === 'behind_scenes' && hasBrandVoice
    ? `${behindScenesMap[language] || behindScenesMap.da}\n`
    : ''

  // dishProtagonistHint — menu/dish posts: force the dish to be described before location/ambience.
  const isMenuPost = contentType === 'menu_item' || contentType === 'product_menu' || contentType === 'craving_visual'
  const dishProtagonistMap: Record<string, string> = {
    da: 'RETTEN ER POINTEN: Dediker mindst én sætning til at beskrive rettens karakter (udseende, konsistens, smag) inden du nævner lokation eller stemning — lokation er kontekst, retten er indholdet. Navngivning alene ("Pariserbøf kalder") er ikke en beskrivelse.\n- Brug KUN egenskaber der er naturligt og universelt sande for DENNE rettetype ud fra INDHOLD — ingen opfundne ingredienser, tilbehør, saucer eller detaljer der ikke er nævnt eller naturligt underforstået\n- Skriv rettens beskrivelse I BRANDETS STEMME — brug de samme sproglige valg og den samme rytme som i BRANDSTEMME-blokken ovenfor',
    sv: 'RÄTTEN ÄR POÄNGEN: Dedikera minst en mening till att beskriva rättens karaktär (utseende, konsistens, smak) innan du nämner plats eller stämning — platsen är kontext, rätten är innehållet. Att bara nämna namnet är inte en beskrivning.\n- Använd KUN egenskaper som är naturligt och universellt sanna för DENNA rättstyp utifrån INNEHÅLL — inga påhittade ingredienser, tillbehör, såser eller detaljer\n- Skriv rättens beskrivning I VARUMÄRKETS RÖST — samma språkliga val och rytm som i VARUMÄRKESRÖST-blocket ovan',
    de: 'DAS GERICHT IST DER PUNKT: Widme mindestens einen Satz der Beschreibung des Gerichtscharakters (Aussehen, Konsistenz, Geschmack) bevor du Ort oder Stimmung erwähnst — der Ort ist Kontext, das Gericht ist der Inhalt. Den Namen zu nennen ist keine Beschreibung.\n- Verwende NUR Eigenschaften, die für DIESEN Gerichtstyp natürlich und universell zutreffend sind — keine erfundenen Zutaten, Beilagen oder Saucen\n- Schreibe die Gerichtsbeschreibung IN DER MARKENSTIMME — gleiche sprachliche Entscheidungen und Rhythmus wie im MARKENSTIMME-Block oben',
  }
  const dishProtagonistHint = isMenuPost
    ? `${dishProtagonistMap[language] || dishProtagonistMap.da}\n`
    : ''

  // sceneMoodOpeningHint — for behind_scenes/atmosphere/team_people: reinforce that
  // openings must come from a documented source, not abstract mood or training knowledge.
  const sceneMoodOpeningHintMap: Record<string, string> = {
    da: `⚠️ ÅBNINGSREGEL FOR DETTE OPSLAG: Brandets skriveregler kræver konkrete åbninger. Din første sætning SKAL være forankret i ét element du kan pege på i 📸 PRIMÆR FAKTAKILDE, INDHOLD eller BRANDSTEMME-blokken. Abstrakt stemning ("varmen spreder sig", "stilheden falder ind", "aftenen folder sig ud") er ikke en kilde — det er en generisk hallucination.${!opts.venueIdentity ? ' Ingen fotobeskrivelse er tilgængelig — brug konceptankre og stedsidentitet fra BRANDSTEMME-blokken som dit konkrete fundament.' : ''}
`,
    sv: `⚠️ ÖPPNINGSREGEL FÖR DETTA INLÄGG: Varumärkets skrivinstruktioner kräver konkreta öppningar. Din första mening MÅSTE vara förankrad i ett element du kan peka på i 📸 PRIMÄR FAKTAKÄLLA, INNEHÅLL eller VARUMÄRKESRÖST-blocket. Abstrakt stämning ("värmen sprider sig", "tystnaden infinner sig") är inte en källa — det är en generisk hallucination.${!opts.venueIdentity ? ' Ingen fotobeskrivning tillgänglig — använd konceptankare och platsidentitet från VARUMÄRKESRÖST-blocket som ditt konkreta fundament.' : ''}
`,
    de: `⚠️ ERÖFFNUNGSREGEL FÜR DIESEN BEITRAG: Die Schreibregeln der Marke erfordern konkrete Eröffnungen. Dein erster Satz MUSS in einem Element verankert sein, das du in 📸 PRIMÄRE FAKTENQUELLE, INHALT oder dem MARKENSTIMME-Block nachweisen kannst. Abstrakte Stimmung ("die Wärme breitet sich aus", "die Stille senkt sich herab") ist keine Quelle — das ist eine generische Halluzination.${!opts.venueIdentity ? ' Keine Fotobeschreibung verfügbar — nutze Konzeptanker und Ortsidentität aus dem MARKENSTIMME-Block als konkretes Fundament.' : ''}
`,
  }
  const sceneMoodOpeningHint = isSceneMoodPost
    ? (sceneMoodOpeningHintMap[language] || sceneMoodOpeningHintMap.da)
    : ''

  // atmosphereVoiceHint — atmosphere/seasonal posts with no dish anchor.
  const atmosphereHintMap: Record<string, string> = {
    da: 'STEMNINGSOPSLAG UDEN MENUINFORMATION: Opfind IKKE stedsatmosfære, location-fakta ELLER abstrakt stemning. Abstrakte stemningsord som "hygge", "varme", "ro", "hverdagen trænger til" er forbudt som åbner. Brug i stedet ét KONKRET element som ankerpunkt: en handling der sker i lokalet, en fysisk genstand, et tidspunkt eller et faktum om stedet. Reducer til: (1) konkret element fra INDHOLD eller BRANDSTEMME-blokken, (2) ét faktuelt tilbud fra ÅBNINGSTID hvis tilgængeligt, (3) CTA.',
    sv: 'STÄMNINGSINLÄGG UTAN MENYINFORMATION: Uppfinn INTE platsatmosphere, platsfakta ELLER abstrakt stämning. Abstrakta stämningsord som "mysighet", "värme", "ro", "vardagen behöver" är förbjudna som öppning. Använd istället ett KONKRET element som ankpunkt: en handling som sker i lokalen, ett fysiskt föremål, en tidpunkt eller ett faktum om stället. Reducera till: (1) konkret element från INNEHÅLL eller VARUMÄRKESRÖST-blocket, (2) ett faktabaserat erbjudande från ÖPPETTIDER om tillgängligt, (3) CTA.',
    de: 'STIMMUNGSBEITRAG OHNE MENÜINFORMATION: Erfinde KEINE Ortsatmosphäre, Ortsfakten ODER abstrakte Stimmung. Abstrakte Stimmungswörter wie "Gemütlichkeit", "Wärme", "Ruhe", "der Alltag braucht" sind als Eröffnung verboten. Verwende stattdessen ein KONKRETES Element als Ankerpunkt: eine Handlung im Lokal, ein physischer Gegenstand, eine Uhrzeit oder eine Tatsache über den Ort. Reduziere auf: (1) konkretes Element aus INHALT oder MARKENSTIMME-Block, (2) ein faktisches Angebot aus ÖFFNUNGSZEITEN wenn verfügbar, (3) CTA.',
  }
  const isAtmosphereNoMenu = (contentType === 'atmosphere' || contentType === 'seasonal') && !menuItemName
  const atmosphereHint = isAtmosphereNoMenu
    ? `${atmosphereHintMap[language] || atmosphereHintMap.da}\n`
    : ''

  // ── FAKTUEL FORANKRING — Consolidated factual anchoring (paid tier, Danish only) ──
  let factualAnchoringBlock = ''
  if (isPaid && language === 'da') {
    const anchoringLines: string[] = []

    // Part A: Location vocabulary gate
    const hasLocationHooks = Array.isArray(locationMarketingHooks) && locationMarketingHooks.length > 0
    if (neighborhoodCharacter && neighborhoodCharacter.trim().length > 10) {
      const locationHooksBlock = hasLocationHooks
        ? `\nGodkendte stedsformuleringer (ejer-valideret — må bruges direkte):\n${locationMarketingHooks.slice(0, 3).map((h: string) => `• "${h}"`).join('\n')}`
        : ''

      anchoringLines.push(`VERIFICERET STEDSBESKRIVELSE:\n"${neighborhoodCharacter.trim()}"${locationHooksBlock}\n\nStedreference-regler:\n• Al stedreference skal kunne spores til enten VERIFICERET STEDSBESKRIVELSE\n  eller GODKENDTE STEDSFORMULERINGER ovenfor — ikke til AI-træningsdata\n• Problemet er opfundet stedssprog, ikke poetisk stedssprog.\n  Hvis brand voice tilsiger poetisk tone OG locationMarketingHooks er tom,\n  brug VERIFICERET STEDSBESKRIVELSE uden poetisk omskrivning.\n  Poesi kræver ejer-validering — hvis ikke til stede, brug fakta.\n• Hvis posten naturligt kalder på en stedreference, brug verificeret sprog.\n  Hvis posten ikke kalder på det, udelad det — begge valg er gyldige\n  afhængigt af postens indhold og brand voice.`)
    }

    // Part B: Concept anchor requirement for non-menu posts
    const isNonMenuPost = ['behind_scenes', 'atmosphere', 'guest_moment', 'team_people']
      .includes(contentType || '')

    if (isNonMenuPost) {
      const conceptAnchors: string[] = []

      if (Array.isArray(signatureThemes) && signatureThemes.length > 0) {
        conceptAnchors.push(...signatureThemes.slice(0, 4))
      }

      if (conceptAnchors.length > 0) {
        anchoringLines.push(`KONCEPTANKER FOR DETTE OPSLAG:\nMindst ét af følgende specifikke elementer SKAL fremgå i teksten:\n${conceptAnchors.map(a => `• ${a}`).join('\n')}\n\nTest: Kan sætningen stå uændret i en tekst for en vilkårlig restaurant\ni samme kategori? Hvis ja — erstat med et specifikt konceptelement ovenfor.\n\nEKSEMPEL PÅ GENERISK (fejler testen):\n  "Vi tilbereder alt med friske råvarer og kærlighed til detaljen"\n  → Dette kunne stå hos enhver restaurant. ERSTAT MED konceptanker.\n\nEKSEMPEL PÅ SPECIFIKT (består testen):\n  "Vores bordgrill giver dig fuld kontrol over hver bid"\n  → Dette refererer til et specifikt konceptelement (bordgrill). OK.\n\nDette gælder ikke for tone eller stil — kun for faktuelle påstande om\nhvad stedet tilbyder eller er.`)
      } else {
        // No concept anchors available — log warning
        console.warn(`⚠️ [buildPrompt] No concept anchors found for non-menu post (${businessName}). Output may be generic.`)
      }
    }

    // Inject if we have anything
    if (anchoringLines.length > 0) {
      factualAnchoringBlock = `\n── FAKTUEL FORANKRING ──\n${anchoringLines.join('\n\n')}\n`
    }
  }

  // startRules — open with a concrete offer/dish/time, never the title verbatim.
  const startRuleDA = '2) Start: Din første sætning skal ENTEN beskrive noget konkret (sansekvalitet, udseende, smag, en situation læseren genkender) ELLER invitere til en handling ELLER stille læseren et spørgsmål. En sætning med kun subjekt + intransitivt udsagnsord er IKKE en åbning — det er scenefylde (fx forbudt overalt i teksten, ikke kun som åbning: „X venter.“, „X flyder.“, „X kalder.“, „X vågner.“, „X spejler.“). Rettens navn alene er ikke en åbning — beskriv den.'
  const startRuleSV = '2) Start: Din första mening måste ANTINGEN beskriva något konkret (sinneskvalitet, utseende, smak) ELLER inbjuda till handling ELLER ställa läsaren en fråga. En mening med bara subjekt + intransitivt verb är INTE en öppning — det är scenfyllnad (förbjudet överall i texten, inte bara som öppning: "X väntar.", "X flyder.", "X kallar."). Rättens namn ensamt är inte en öppning — beskriv den.'
  const startRuleDE = '2) Start: Dein erster Satz muss ENTWEDER etwas Konkretes beschreiben (Sinnesqualität, Aussehen, Geschmack) ODER zu einer Handlung einladen ODER dem Leser eine Frage stellen. Ein Satz mit nur Subjekt + intransitivem Verb ist KEINE Eröffnung — das ist Szenenerfüllung (verboten überall im Text, nicht nur als erster Satz: "X wartet.", "X fließt.", "X ruft."). Der Gerichtsname allein ist keine Eröffnung — beschreibe ihn.'
  const startRules: Record<string, string> = { da: startRuleDA, sv: startRuleSV, de: startRuleDE }

  // reader-outcome test — forces model to write toward appetite/action, not mood impression.
  const readerOutcomeMap: Record<string, string> = {
    da: 'Teksten er vellykket hvis læseren tænker: "det ser godt ud, jeg tager derned" — ikke: "smuk tekst". Skriv mod appetit og handling, ikke mod stemningsindtryk.',
    sv: 'Texten är lyckad om läsaren tänker: "det ser gott ut, jag åker dit" — inte: "vacker text". Skriv mot aptit och handling, inte mot stämningsintryck.',
    de: 'Der Text ist gelungen, wenn der Leser denkt: "das sieht gut aus, ich gehe hin" — nicht: "schöner Text". Schreibe auf Appetit und Handlung hin, nicht auf Stimmungseindruck.',
  }
  const readerOutcomeLine = `${readerOutcomeMap[language] || readerOutcomeMap.da}\n`

  // writing posture — names the expected style and the forbidden grammatical structure.
  const writingPostureMap: Record<string, string> = {
    da: 'Skrivestil: Konkret-først — hvad er der, hvad smager/ser det ud som, hvornår. FORBUDT som åbning: to sætninger hvor begge kun består af subjekt + intransitivt udsagnsord og ingen information om hvad læseren får eller kan gøre.',
    sv: 'Skrivstil: Konkret-först — vad finns där, hur smakar/ser det ut, när. FÖRBJUDET som öppning: två meningar där båda bara består av subjekt + intransitivt verb och ingen information om vad läsaren får eller kan göra.',
    de: 'Schreibstil: Konkret-zuerst — was ist da, wie schmeckt/sieht es aus, wann. VERBOTEN als Eröffnung: zwei Sätze, in denen beide nur aus Subjekt + intransitivem Verb bestehen und keine Information darüber, was der Leser bekommt oder tun kann.',
  }
  const writingPostureLine = `${writingPostureMap[language] || writingPostureMap.da}\n`

  // forbiddenOpener — prevents literal echo of the idea title as opening sentence.
  const forbiddenOpenerDA = hook.trim().length > 10
    ? `- Skriv IKKE dette som åbningssætning ordret: "${hook.slice(0, 80)}" — åbn med et konkret element fra INDHOLD\n- FORBUDT: Markdown overskrifter (#### eller andre # symboler) — skriv kun almindelig tekst\n`
    : '- FORBUDT: Markdown overskrifter (#### eller andre # symboler) — skriv kun almindelig tekst\n'
  const forbiddenOpenerSV = hook.trim().length > 10
    ? `- Skriv INTE detta som öppningsmening ordagrant: "${hook.slice(0, 80)}" — öppna med ett konkret element från INNEHÅLL\n- FÖRBJUDET: Markdown-rubriker (#### eller andra # symboler) — skriv bara vanlig text\n`
    : '- FÖRBJUDET: Markdown-rubriker (#### eller andra # symboler) — skriv bara vanlig text\n'
  const forbiddenOpenerDE = hook.trim().length > 10
    ? `- Schreibe NICHT diesen Satz wörtlich als Eröffnungssatz: "${hook.slice(0, 80)}" — öffne stattdessen mit einem konkreten Element aus dem INHALT\n- VERBOTEN: Markdown-Überschriften (#### oder andere # Symbole) — schreibe nur normalen Text\n`
    : '- VERBOTEN: Markdown-Überschriften (#### oder andere # Symbole) — schreibe nur normalen Text\n'
  const forbiddenOpener: Record<string, string> = { da: forbiddenOpenerDA, sv: forbiddenOpenerSV, de: forbiddenOpenerDE }

  // AI Ideas: lighter brand block — same source, trimmed at call site.
  const aiWritingRules   = cappedWritingRules.slice(0, 3)
  const aiGoodExamples   = isSceneMoodPost ? cappedGoodExamples.slice(0, 1) : []
  const aiPreferVocab    = cappedPreferVocab.slice(0, 5)
  const aiAvoidVocab     = cappedAvoidVocab.slice(0, 5)
  const aiSigPhrases     = brandSignaturePhrases.slice(0, 2)
  const aiContentAnchors = cappedContentAnchors.slice(0, 5)

  // Goal directive — same source as Weekly Plan; activates the shared GOAL_DIRECTIVE_MAP.
  // AI Ideas always has a resolvedGoalMode (drive_footfall for menu, build_brand for other).
  const resolvedAIDirective = goalMode && GOAL_DIRECTIVE_MAP[goalMode]
    ? (GOAL_DIRECTIVE_MAP[goalMode][language] || GOAL_DIRECTIVE_MAP[goalMode].da)
    : ''
  const goalDirectiveLine = resolvedAIDirective ? `${resolvedAIDirective}\n` : ''

  const brandBlock = buildBrandBlock({
    brandTone, voiceConstraints,
    brandWritingRules: aiWritingRules,
    brandGoodExamples: aiGoodExamples,
    brandAvoidExamples: [],
    brandPreferVocab: aiPreferVocab,
    brandAvoidVocab: aiAvoidVocab,
    locationVocabulary: opts.locationVocabulary,
    brandSignaturePhrases: aiSigPhrases,
    contentAnchors: aiContentAnchors,
    thingsToAvoid: opts.thingsToAvoid,
    goalMode,
    isSceneMoodPost,
    voiceRationale,
    venueIdentity,
    venueScene: opts.venueScene,  // FIX 01: Pass venueScene for atmosphere constraint check
    contentType,  // FIX 01: Pass contentType for atmosphere/availability constraint check
    businessCharacter,
    identityKeywords,
    formalityLevel: opts.formalityLevel,
    humorLevel: opts.humorLevel,
  })

  const ctaHeader = {
    da: ctaStyle === 'strict' ? 'FAST CTA (skal stå til sidst, ordret):' : 'AFSLUTNING — integrer naturligt i teksten:',
    sv: ctaStyle === 'strict' ? 'FAST CTA (ska stå sist, ordagrant):' : 'AVSLUTNING — integrera naturligt i texten:',
    de: ctaStyle === 'strict' ? 'FESTER CTA (muss am Ende stehen, wörtlich):' : 'ABSCHLUSS — integriere natürlich in den Text:',
  }
  const ctaRule8 = {
    da: ctaStyle === 'strict' ? 'Slut altid med CTA-linjen' : 'Afslut med teksten herover — intentionen og emojis bevares, let omformulering tilladt',
    sv: ctaStyle === 'strict' ? 'Avsluta alltid med CTA-raden' : 'Avsluta med texten ovan — intentionen och emojis bevaras, lätt omformulering tillåten',
    de: ctaStyle === 'strict' ? 'Beende immer mit der CTA-Zeile' : 'Beende mit dem Text oben — Intention und Emojis bleiben, leichte Umformulierung erlaubt',
  }
  
  // Build CTA section (only when selectedCta is not null)
  const ctaSection = selectedCta
    ? `${ctaHeader[language] || ctaHeader.da}\n"${selectedCta}"\n`
    : ''
  
  // FIX GAP B: Booking CTA instruction — tell AI NOT to include URL in caption
  const bookingCtaInstruction: Record<string, string> = {
    da: `\n⚠️ BOOKING-CTA REGEL: Afslut med booking-opfordringen ovenfor. Skriv IKKE booking-URL'en i teksten — den tilføjes automatisk efter din tekst på Facebook. På Instagram vises kun teksten uden URL, hvilket er korrekt.\n`,
    sv: `\n⚠️ BOOKING-CTA REGEL: Avsluta med booking-uppmaningen ovan. Skriv INTE booking-URL:en i texten — den läggs till automatiskt efter din text på Facebook. På Instagram visas bara texten utan URL, vilket är korrekt.\n`,
    de: `\n⚠️ BOOKING-CTA REGEL: Beende mit der Booking-Aufforderung oben. Schreibe NICHT die Booking-URL in den Text — sie wird automatisch nach deinem Text auf Facebook hinzugefügt. Auf Instagram erscheint nur der Text ohne URL, was korrekt ist.\n`,
  }
  const bookingCtaBlock = (opts.bookingLink && ctaStyle === 'strict')
    ? (bookingCtaInstruction[language] || bookingCtaInstruction.da)
    : ''
  
  // Nu-faktor (KRAV #5): model must anchor the post in a concrete "why now" signal.
  const anledningRule: Record<string, string> = {
    da: '5) Nu-faktor: teksten SKAL give ét konkret signal om HVORFOR dette er relevant NU — brug LEJLIGHED eller KONTEKST fra INDHOLD som vinkel hvis til stede ("perfekt til frokostpausen", "nu er sæsonen for det her"). Ingen tekst uden en grund til at handle i dag.',
    sv: '5) Nu-faktor: texten MÅSTE ge ett konkret signal om VARFÖR detta är relevant NU — använd LEJLIGHED eller KONTEKST från INNEHÅLL som vinkel om tillgängligt ("perfekt för lunchpausen", "nu är säsongen för det här"). Ingen text utan en anledning att agera idag.',
    de: '5) Jetzt-Faktor: Der Text MUSS ein konkretes Signal geben, WARUM das JETZT relevant ist — nutze LEJLIGHED oder KONTEKST aus dem INHALT als Blickwinkel wenn vorhanden ("perfekt für die Mittagspause", "jetzt ist die Saison dafür"). Kein Text ohne einen Grund, heute zu handeln.',
  }
  const templates: Record<string, string> = {
    da: `OPGAVE
Skriv ÉN social media-tekst til ${businessName} i ${city}.
${goalDirectiveLine}${readerOutcomeLine}${writingPostureLine}${activationLine}${contentTypeHint}${atmosphereHint}
INDHOLD (skriv om KUN dette):
${contentBlock}
${brandBlock}${hoursBlock}${faktaforbud.da}${citySizeGuard}${factualAnchoringBlock}${sceneMoodOpeningHint}${forbiddenOpener.da}${dishProtagonistHint}
${ctaSection}${bookingCtaBlock}KRAV TIL TEKSTEN
1) Længde: 300-450 tegn INKL. emojis og CTA
${startRules.da}
${sensoryRules.da}
${dishRules.da}
${anledningRule.da}
6) Naturligt dansk — skriv som en dansker skriver. Undgå: "lækker", "hyggelig", "autentisk", "unik", "svip" (dateret), "nyd" som imperativ åbning
7) Aldrig " - " eller " – " som bindeled mellem sætningsled ("god mad – hyggelig stemning – book nu").
8) ${finalEmojiInstruction}
   ☕ MÅ KUN bruges, hvis kaffe, espresso, latte eller cappuccino er eksplicit nævnt som en drik i selve teksten — "Café" i virksomhedsnavnet tæller IKKE.
9) ${selectedCta ? ctaRule8.da : 'Ingen CTA påkrævet for dette opslag — lad teksten tale for sig selv'}${qualityNote}

HASHTAGS (generer platformspecifikke hashtags på dansk):
- Facebook: 0-2 hashtags — fokus på lokal søgning (#${city}, #${city}Mad o.l.)
- Instagram: 3-5 hashtags — bred mix af lokation, ret-type, community
- Sprog: Brug DANSK for lifestyle/community tags (#MadElskere, #KaffeElskere)
- Menupunkter: Behold originalsproget (#Burger, #Sandwich, #VolAuVent — disse er internationale)
- Brug ALDRIG tags der ikke passer til indholdet i teksten

OUTPUT
Returner KUN dette JSON på én linje (ingen markdown, ingen forklaring):
{"text":"<selve teksten>","keyword":"<ét PascalCase ord der bedst beskriver dette indhold>","facebookHashtags":["#tag1","#tag2"],"instagramHashtags":["#tag1","#tag2","#tag3","#tag4","#tag5"]}`,

    sv: `UPPGIFT
Skriv EN social media-text till ${businessName} i ${city}.
${goalDirectiveLine}${readerOutcomeLine}${writingPostureLine}${activationLine}${contentTypeHint}${atmosphereHint}
INNEHÅLL (skriv om BARA detta):
${contentBlock}
${brandBlock}${hoursBlock}${faktaforbud.sv}${factualAnchoringBlock}${sceneMoodOpeningHint}${forbiddenOpener.sv}${dishProtagonistHint}
${ctaSection}${bookingCtaBlock}KRAV
1) Längd: 300-450 tecken INKL. emojis och CTA
${startRules.sv}
${sensoryRules.sv}
${dishRules.sv}
${anledningRule.sv}
6) Naturlig svenska — undvik: "läcker", "mysig", "autentisk", "unik"
7) Aldrig " - " eller " – " som bindeled mellan meningsled.
8) ${finalEmojiInstruction}
   ☕ FÅR BARA användas om kaffe, espresso, latte eller cappuccino uttryckligen nämns som en dryck i texten — "Café" i företagsnamnet räknas INTE.
9) ${selectedCta ? ctaRule8.sv : 'Ingen CTA krävs för detta inlägg — låt texten tala för sig själv'}

HASHTAGS (generera plattformspecifika hashtags på svenska):
- Facebook: 0-2 hashtags — fokus på lokal sökning (#${city}, #${city}Mat o.s.v.)
- Instagram: 3-5 hashtags — bred mix av plats, rätttyp, community
- Språk: Använd SVENSKA för lifestyle/community-taggar (#MatÄlskare, #KaffeÄlskare)
- Menyrätter: Behåll originalspråket (#Burger, #Sandwich — dessa är internationella)

OUTPUT
Returnera KUN detta JSON på en rad (ingen markdown, ingen förklaring):
{"text":"<själva texten>","keyword":"<ett PascalCase-ord som bäst beskriver detta innehåll>","facebookHashtags":["#tag1","#tag2"],"instagramHashtags":["#tag1","#tag2","#tag3","#tag4","#tag5"]}`,

    de: `AUFGABE
Schreibe EINEN Social-Media-Text für ${businessName} in ${city}.
${goalDirectiveLine}${readerOutcomeLine}${writingPostureLine}${activationLine}${contentTypeHint}${atmosphereHint}
INHALT (schreibe NUR über dieses):
${contentBlock}
${brandBlock}${hoursBlock}${faktaforbud.de}${factualAnchoringBlock}${sceneMoodOpeningHint}${forbiddenOpener.de}${dishProtagonistHint}
${ctaSection}${bookingCtaBlock}ANFORDERUNGEN
1) Länge: 300-450 Zeichen INKL. Emojis und CTA
${startRules.de}
${sensoryRules.de}
${dishRules.de}
${anledningRule.de}
6) Natürliches Deutsch — vermeide: "lecker", "gemütlich", "authentisch", "einzigartig"
7) Niemals " - " oder " – " als Bindeglied zwischen Satzteilen.
8) ${emojiInstruction}
   ☕ DARF NUR genutzt werden, wenn Kaffee, Espresso, Latte oder Cappuccino ausdrücklich als Getränk im Text erwähnt wird — "Café" im Firmennamen zählt NICHT.
9) ${selectedCta ? ctaRule8.de : 'Keine CTA erforderlich für diesen Beitrag — lass den Text für sich sprechen'}

HASHTAGS (generiere plattformspezifische Hashtags auf Deutsch):
- Facebook: 0-2 Hashtags — Fokus auf lokale Suche (#${city}, #${city}Essen usw.)
- Instagram: 3-5 Hashtags — breite Mischung aus Ort, Gerichttyp, Community
- Sprache: Verwende DEUTSCH für Lifestyle/Community-Tags (#EssenLiebhaber, #KaffeeLiebhaber)
- Menüpunkte: Behalte die Originalsprache (#Burger, #Sandwich — diese sind international)

OUTPUT
Gib NUR dieses JSON auf einer Zeile zurück (kein Markdown, keine Erklärung):
{"text":"<der eigentliche Text>","keyword":"<ein PascalCase-Wort das diesen Inhalt am besten beschreibt>","facebookHashtags":["#tag1","#tag2"],"instagramHashtags":["#tag1","#tag2","#tag3","#tag4","#tag5"]}`,
  }

  return templates[language] || templates.da
}

// ══════════════════════════════════════════════════════════════════════════
// PATH BUILDER: WEEKLY PLAN
// source === 'weekly_plan'. Carries a goalMode and UGEPLANKONTEKST.
// ══════════════════════════════════════════════════════════════════════════
function buildWeeklyPlanPrompt(opts: PromptOptions): string {
  const {
    hook, contentBlock,
    brandTone, brandSignaturePhrases,
    voiceConstraints, emojiInstruction,
    todayOpenTime, selectedCta, businessName, city, language, ctaStyle,
    weeklyPlanContext, goalMode,
    voiceRationale, venueIdentity, businessCharacter, identityKeywords,
    tone_dna_summary, tone_do_list, tone_dont_list,
    location_natural_vocab, location_avoid_vocab, humor_style,
    locationIntelligenceNarrative, contentType,
    isPaid, neighborhoodCharacter, locationMarketingHooks, signatureThemes,
  } = opts

  // FIX 05: Apply content-type emoji override before using emojiInstruction in prompts
  const finalEmojiInstruction = applyContentTypeEmojiOverride(
    emojiInstruction,
    contentType,
    language
  )

  // FIX 3: Build location context with strict fallback priority
  const locationContext = buildLocationContext({
    neighborhood_character: opts.neighborhoodCharacter,
    local_location_reference: opts.localLocationReference,
    neighborhood: opts.neighborhood,
    city: opts.city,
    area_type: opts.areaType,
  });

  const fallbackLevel = getLocationFallbackLevel({
    neighborhood_character: opts.neighborhoodCharacter,
    local_location_reference: opts.localLocationReference,
    neighborhood: opts.neighborhood,
    city: opts.city,
  });

  console.log(`📍 Location context source: ${fallbackLevel}`, {
    value: locationContext?.substring(0, 80) || 'empty',
  });

  if (fallbackLevel === 'city_only' || fallbackLevel === 'none') {
    console.warn(
      `⚠️ Location context is weak (${fallbackLevel}). ` +
      `Run populate-location-intelligence with force_refresh=true ` +
      `to generate neighborhood_character.`
    );
  }

  // FIX 3b: Add city-size guard for medium/small cities
  const citySize = classifyCitySize(undefined, city || '');
  const citySizeGuard = citySize !== 'large' && city
    ? `\nVIGTIGT: Undgå storby-sprog. ${city} er ikke en storby. ` +
      `Skriv IKKE: "pulserende byliv", "byens puls", "urban energi", "storbyatmosfære". ` +
      `Brug i stedet konkrete, faktuelle referencer til ${city}.`
    : '';

  console.log(`📍 City size classification: ${citySize} (${city})`, {
    city_size_guard_active: citySize !== 'large',
  });

  const core = buildSharedToneCore(opts)
  const {
    faktaforbud, dishRules, sensoryRules,
    cappedWritingRules, cappedGoodExamples, cappedAvoidExamples,
    cappedPreferVocab, cappedAvoidVocab, cappedContentAnchors,
    isSceneMoodPost, qualityNote,
  } = core

  const hoursBlock = todayOpenTime
    ? `\n⏰ ÅBNINGSTID I DAG (kun hvis relevant og kun hvis sandt): ${todayOpenTime} — nævn IKKE tidspunkter der antyder åbning tidligere end dette.\n`
    : ''

  const resolvedDirective = goalMode && GOAL_DIRECTIVE_MAP[goalMode]
    ? (GOAL_DIRECTIVE_MAP[goalMode][language] || GOAL_DIRECTIVE_MAP[goalMode].da)
    : ''
  const goalDirectiveLine = resolvedDirective ? `${resolvedDirective}\n` : ''

  // FIX: declare hasWeeklyContext BEFORE weeklyRoleFrame uses it (was TDZ bug in original)
  const hasWeeklyContext = weeklyPlanContext.length > 0

  // weeklyRoleFrame — makes the post's specific weekly role decisive, not advisory.
  const roleFrameMap: Record<string, Record<string, string>> = {
    drive_footfall: {
      da: 'Teksten er vellykket hvis læseren tænker: "det gider jeg prøve nu" — og handler på det.',
      sv: 'Texten är lyckad om läsaren tänker: "det vill jag prova nu" — och agerar på det.',
      de: 'Der Text ist gelungen, wenn der Leser denkt: "das will ich jetzt ausprobieren" — und handelt.',
    },
    build_brand: {
      da: 'Teksten er vellykket hvis læseren genkender noget ægte og specifikt ved dette sted — ikke bare et velskrevet opslag.',
      sv: 'Texten är lyckad om läsaren känner igen något äkta och specifikt med det här stället — inte bara ett välskrivet inlägg.',
      de: 'Der Text ist gelungen, wenn der Leser etwas Echtes und Spezifisches an diesem Ort erkennt — nicht nur einen gut geschriebenen Beitrag.',
    },
    retain_loyalty: {
      da: 'Teksten er vellykket hvis en fast gæst nikker genkendende — og føler sig set, ikke solgt til.',
      sv: 'Texten är lyckad om en stamgäst nickar igenkännande — och känner sig sedd, inte säld till.',
      de: 'Der Text ist gelungen, wenn ein Stammgast zustimmend nickt — und sich gesehen, nicht angesprochen fühlt.',
    },
  }
  const driftGuardMap: Record<string, string> = {
    da: 'Undgå: generisk brandcopy der ikke er forankret i denne uges specifikke rolle og INDHOLD.',
    sv: 'Undvik: generisk varumärkescopy som inte är förankrad i den här veckans specifika roll och INNEHÅLL.',
    de: 'Vermeide: generische Markencopy, die nicht in der spezifischen Rolle dieser Woche und dem INHALT verankert ist.',
  }
  const brandBridgeMap: Record<string, string> = {
    da: '➡️ BRANDSTEMMEN HERUNDER er ikke et stillag — den er instrumentet for POSTENS ROLLE. Brug den aktivt.',
    sv: '➡️ VARUMÄRKESRÖSTEN NEDAN är inte ett stilfilter — den är instrumentet för INLÄGGETS ROLL. Använd den aktivt.',
    de: '➡️ DIE MARKENSTIMME UNTEN ist keine Stilschicht — sie ist das Instrument für die ROLLE DES BEITRAGS. Nutze sie aktiv.',
  }
  const lang = language || 'da'
  const roleSignal = goalMode ? (roleFrameMap[goalMode]?.[lang] || roleFrameMap[goalMode]?.da || '') : ''
  const driftGuard = driftGuardMap[lang] || driftGuardMap.da
  const brandBridge = brandBridgeMap[lang] || brandBridgeMap.da
  const weeklyRoleFrame = hasWeeklyContext && goalMode
    ? `\n${roleSignal}\n${brandBridge}\n`
    : ''

  // startRules — lead with guest moment, goal-mode-aware.
  const startRules: Record<string, string> = {
    da: hasWeeklyContext && goalMode === 'build_brand'
      ? '2) Start: Åbn med ét konkret element (et tidspunkt, en handling, en person, et sted) udtrykt i brandets eget register (følg skrivereglerne ovenfor) — gæstemomentet er baggrund, ikke overskrift. Ingen velkomst-intro, ingen opfordring til besøg. Forbudt: sætninger der kun beskriver atmosfære uden at forankre den i noget konkret.'
      : hasWeeklyContext
        ? '2) Start: Led med gæstemomentets situation forankret i tilbud, ret eller tidspunkt — retten er det konkrete element, ikke overskriften. Aldrig: "Din pause nu", "Forestil dig"'
        : '2) Start: Åbn med et tilbud, en ret eller et tidspunkt forankret i INDHOLD — ingen abstrakt stemningssætning.',
    sv: hasWeeklyContext && goalMode === 'build_brand'
      ? '2) Start: Öppna med ett konkret element (ett klockslag, en handling, en person, en plats) uttryckt i varumärkets eget register (följ skrivinstruktionerna ovan) — gästögonblicket är bakgrund, inte rubrik. Ingen välkomst-intro, ingen uppmaning till besök. Förbjudet: meningar som bara beskriver atmosfär utan att förankra den i något konkret.'
      : hasWeeklyContext
        ? '2) Start: Inled med gästögonblickets situation — rätten/produkten är det konkreta elementet, inte rubriken. Aldrig: "Föreställ dig"'
        : '2) Start: Öppna med ett konkret erbjudande eller rättens namn — ingen abstrakt stämning.',
    de: hasWeeklyContext && goalMode === 'build_brand'
      ? '2) Start: Öffne mit einem konkreten Element (eine Uhrzeit, eine Handlung, eine Person, ein Ort) ausgedrückt im eigenen Register der Marke (folge den Schreibregeln oben) — der Gästemoment ist Hintergrund, nicht Überschrift. Kein Willkommens-Intro, kein Besuchsaufruf. Verboten: Sätze, die nur Atmosphäre beschreiben ohne sie in etwas Konkretem zu verankern.'
      : hasWeeklyContext
        ? '2) Start: Beginne mit der Gästemoment-Situation — das Gericht/Produkt ist das konkrete Element, nicht die Überschrift. Niemals: "Stell dir vor"'
        : '2) Start: Öffne mit einem konkreten Angebot oder dem Namen des Gerichts — keine abstrakte Stimmung.',
  }

  // WP: fuller than AI Ideas, curated by goal mode.
  const wpGoodExamples   = goalMode === 'build_brand'
    ? cappedGoodExamples.slice(0, 2)
    : cappedGoodExamples.slice(0, 1)
  const wpAvoidExamples  = cappedAvoidExamples.slice(0, 1)
  const wpPreferVocab    = cappedPreferVocab.slice(0, 6)
  const wpAvoidVocab     = cappedAvoidVocab.slice(0, 6)
  const wpContentAnchors = cappedContentAnchors.slice(0, 7)

  // FORBIDDEN WORDS enforcement (extracted from voice_guardrails)
  const forbiddenWords = opts.forbidden_phrases || [];
  const forbiddenWordsBlock = forbiddenWords.length > 0
    ? `\n⛔ FORBUDTE ORD (brug ALDRIG disse — brug alternativer fra skrivereglerne):\n${forbiddenWords.slice(0, 8).map(w => `  • "${w}"`).join('\n')}\n`
    : '';

  const brandBlock = buildBrandBlock({
    brandTone, voiceConstraints,
    brandWritingRules: cappedWritingRules,
    brandGoodExamples: wpGoodExamples,
    brandAvoidExamples: wpAvoidExamples,
    brandPreferVocab: wpPreferVocab,
    brandAvoidVocab: wpAvoidVocab,
    locationVocabulary: opts.locationVocabulary,
    brandSignaturePhrases: brandSignaturePhrases.slice(0, 3),
    contentAnchors: wpContentAnchors,
    thingsToAvoid: opts.thingsToAvoid,
    goalMode,
    isSceneMoodPost,
    voiceRationale,
    venueIdentity,
    venueScene: opts.venueScene,  // FIX 01: Pass venueScene for atmosphere constraint check
    contentType,  // FIX 01: Pass contentType for atmosphere/availability constraint check
    businessCharacter,
    identityKeywords,
    formalityLevel: opts.formalityLevel,
    humorLevel: opts.humorLevel,
  })

  // ═══ TONE DNA BLOCK ═══
  const toneDNABlock: string[] = []

  if (tone_dna_summary) {
    toneDNABlock.push(`STRATEGISK TONE:\n${tone_dna_summary}`)
  }

  if (tone_do_list && tone_do_list.length > 0) {
    toneDNABlock.push(`TONE — GØR DETTE:\n${tone_do_list.map(r => `- ${r}`).join('\n')}`)
  }

  if (tone_dont_list && tone_dont_list.length > 0) {
    toneDNABlock.push(`TONE — UNDGÅ DETTE:\n${tone_dont_list.map(r => `- ${r}`).join('\n')}`)
  }

  if (location_natural_vocab && location_natural_vocab.length > 0) {
    toneDNABlock.push(`FORETRUKKET LOKATIONS-VOKABULAR — ROTER mellem disse (brug ikke samme hver gang):\n${location_natural_vocab.map((v, i) => `  ${i + 1}. "${v}"`).join('\n')}`)
  }

  if (location_avoid_vocab && location_avoid_vocab.length > 0) {
    toneDNABlock.push(`UNDGÅ DISSE ORD (clasher med lokation): ${location_avoid_vocab.join(', ')}`)
  }

  // V5.6: Use humor_character if available (richer guidance), otherwise fall back to humor_style
  const humor_character = (opts as any).humor_character
  if (humor_character && humor_character.permission_level !== 'none') {
    const parts = [`Niveau: ${humor_character.permission_level}`]
    if (humor_character.execution_style) {
      parts.push(`Stil: ${humor_character.execution_style}`)
    }
    if (humor_character.tone_descriptors && humor_character.tone_descriptors.length > 0) {
      parts.push(`Register: ${humor_character.tone_descriptors.join(', ')}`)
    }
    toneDNABlock.push(`HUMOR KARAKTER:\n  ${parts.join('\n  ')}`)
  } else if (humor_style && humor_style !== 'none') {
    // Legacy fallback
    const humorMap: Record<string, string> = {
      playful: 'Let og lidt selvironisk — aldrig på bekostning af maden eller stedet',
      dry: 'Tør og afdæmpet — brug sparsomt',
      warm: 'Varm og inkluderende — ingen jokes',
      none: ''
    }
    const humorInstruction = humorMap[humor_style] || humor_style
    if (humorInstruction) {
      toneDNABlock.push(`HUMOR: ${humorInstruction}`)
    }
  }

  const toneDNASection = toneDNABlock.length > 0
    ? `\n\n${toneDNABlock.join('\n\n')}`
    : ''

  // Fix 4: Geographic narrative — ONLY for atmosphere/location posts
  // For food posts, menu item is the anchor. For atmosphere posts, location IS the content.
  const isAtmospherePost = ['atmosphere', 'behind_scenes', 'team_people', 'general_invitation']
    .includes(contentType || '')
  
  const geoNarrativeBlock = locationIntelligenceNarrative && isAtmospherePost
    ? `\n\nLOKATIONSKONTEKST (gælder især for stemnings- og stedsposter):\n${locationIntelligenceNarrative}`
    : ''

  // ── FAKTUEL FORANKRING — Consolidated factual anchoring (paid tier, Danish only) ──
  let wpFactualAnchoringBlock = ''
  if (isPaid && language === 'da') {
    const anchoringLines: string[] = []

    // Part A: Location vocabulary gate
    const hasLocationHooks = Array.isArray(locationMarketingHooks) && locationMarketingHooks.length > 0
    if (neighborhoodCharacter && neighborhoodCharacter.trim().length > 10) {
      const locationHooksBlock = hasLocationHooks
        ? `\nGodkendte stedsformuleringer (ejer-valideret — må bruges direkte):\n${locationMarketingHooks.slice(0, 3).map((h: string) => `• "${h}"`).join('\n')}`
        : ''

      anchoringLines.push(`VERIFICERET STEDSBESKRIVELSE:\n"${neighborhoodCharacter.trim()}"${locationHooksBlock}\n\nStedreference-regler:\n• Al stedreference skal kunne spores til enten VERIFICERET STEDSBESKRIVELSE\n  eller GODKENDTE STEDSFORMULERINGER ovenfor — ikke til AI-træningsdata\n• Problemet er opfundet stedssprog, ikke poetisk stedssprog.\n  Hvis brand voice tilsiger poetisk tone OG locationMarketingHooks er tom,\n  brug VERIFICERET STEDSBESKRIVELSE uden poetisk omskrivning.\n  Poesi kræver ejer-validering — hvis ikke til stede, brug fakta.\n• Hvis posten naturligt kalder på en stedreference, brug verificeret sprog.\n  Hvis posten ikke kalder på det, udelad det — begge valg er gyldige\n  afhængigt af postens indhold og brand voice.`)
    }

    // Part B: Concept anchor requirement for non-menu posts
    const isNonMenuPost = ['behind_scenes', 'atmosphere', 'guest_moment', 'team_people']
      .includes(contentType || '')

    if (isNonMenuPost) {
      const conceptAnchors: string[] = []

      if (Array.isArray(signatureThemes) && signatureThemes.length > 0) {
        conceptAnchors.push(...signatureThemes.slice(0, 4))
      }

      if (conceptAnchors.length > 0) {
        anchoringLines.push(`KONCEPTANKER FOR DETTE OPSLAG:\nMindst ét af følgende specifikke elementer SKAL fremgå i teksten:\n${conceptAnchors.map(a => `• ${a}`).join('\n')}\n\nTest: Kan sætningen stå uændret i en tekst for en vilkårlig restaurant\ni samme kategori? Hvis ja — erstat med et specifikt konceptelement ovenfor.\n\nEKSEMPEL PÅ GENERISK (fejler testen):\n  "Vi tilbereder alt med friske råvarer og kærlighed til detaljen"\n  → Dette kunne stå hos enhver restaurant. ERSTAT MED konceptanker.\n\nEKSEMPEL PÅ SPECIFIKT (består testen):\n  "Vores bordgrill giver dig fuld kontrol over hver bid"\n  → Dette refererer til et specifikt konceptelement (bordgrill). OK.\n\nDette gælder ikke for tone eller stil — kun for faktuelle påstande om\nhvad stedet tilbyder eller er.`)
      } else {
        console.warn(`⚠️ [buildWeeklyPlanPrompt] No concept anchors found for non-menu post (${businessName}). Output may be generic.`)
      }
    }

    // Inject if we have anything
    if (anchoringLines.length > 0) {
      wpFactualAnchoringBlock = `\n── FAKTUEL FORANKRING ──\n${anchoringLines.join('\n\n')}\n`
    }
  }

  const ctaHeader = {
    da: ctaStyle === 'strict' ? 'FAST CTA (skal stå til sidst, ordret):' : 'AFSLUTNING — integrer naturligt i teksten:',
    sv: ctaStyle === 'strict' ? 'FAST CTA (ska stå sist, ordagrant):' : 'AVSLUTNING — integrera naturligt i texten:',
    de: ctaStyle === 'strict' ? 'FESTER CTA (muss am Ende stehen, wörtlich):' : 'ABSCHLUSS — integriere natürlich in den Text:',
  }
  const ctaRule8 = {
    da: ctaStyle === 'strict' ? 'Slut altid med CTA-linjen' : 'Afslut med teksten herover — intentionen og emojis bevares, let omformulering tilladt',
    sv: ctaStyle === 'strict' ? 'Avsluta alltid med CTA-raden' : 'Avsluta med texten ovan — intentionen och emojis bevaras, lätt omformulering tillåten',
    de: ctaStyle === 'strict' ? 'Beende immer mit der CTA-Zeile' : 'Beende mit dem Text oben — Intention und Emojis bleiben, leichte Umformulierung erlaubt',
  }
  
  // Conditionally include CTA section only when selectedCta is not null (Weekly Plan path)
  const wpCtaSection = selectedCta
    ? `${ctaHeader[language] || ctaHeader.da}\n"${selectedCta}"\n`
    : ''

  // FIX GAP B: Booking CTA instruction — tell AI NOT to include URL in caption
  const bookingCtaInstruction: Record<string, string> = {
    da: `\n⚠️ BOOKING-CTA REGEL: Afslut med booking-opfordringen ovenfor. Skriv IKKE booking-URL'en i teksten — den tilføjes automatisk efter din tekst på Facebook. På Instagram vises kun teksten uden URL, hvilket er korrekt.\n`,
    sv: `\n⚠️ BOOKING-CTA REGEL: Avsluta med booking-uppmaningen ovan. Skriv INTE booking-URL:en i texten — den läggs till automatiskt efter din text på Facebook. På Instagram visas bara texten utan URL, vilket är korrekt.\n`,
    de: `\n⚠️ BOOKING-CTA REGEL: Beende mit der Booking-Aufforderung oben. Schreibe NICHT die Booking-URL in den Text — sie wird automatisch nach deinem Text auf Facebook hinzugefügt. Auf Instagram erscheint nur der Text ohne URL, was korrekt ist.\n`,
  }
  const wpBookingCtaBlock = (opts.bookingLink && ctaStyle === 'strict')
    ? (bookingCtaInstruction[language] || bookingCtaInstruction.da)
    : ''

  // WP: same principle-based opening rule as AI Ideas path — mirrors sceneMoodOpeningHint.
  const wpSceneMoodOpeningHintMap: Record<string, string> = {
    da: `⚠️ ÅBNINGSREGEL FOR DETTE OPSLAG: Brandets skriveregler kræver konkrete åbninger. Din første sætning SKAL være forankret i ét element du kan pege på i 📸 PRIMÆR FAKTAKILDE, INDHOLD eller BRANDSTEMME-blokken. Abstrakt stemning ("varmen spreder sig", "stilheden falder ind", "aftenen folder sig ud") er ikke en kilde — det er en generisk hallucination.${!venueIdentity ? ' Ingen fotobeskrivelse er tilgængelig — brug konceptankre og stedsidentitet fra BRANDSTEMME-blokken som dit konkrete fundament.' : ''}
`,
    sv: `⚠️ ÖPPNINGSREGEL FÖR DETTA INLÄGG: Varumärkets skrivinstruktioner kräver konkreta öppningar. Din första mening MÅSTE vara förankrad i ett element du kan peka på i 📸 PRIMÄR FAKTAKÄLLA, INNEHÅLL eller VARUMÄRKESRÖST-blocket. Abstrakt stämning ("värmen sprider sig", "tystnaden infinner sig") är inte en källa — det är en generisk hallucination.${!venueIdentity ? ' Ingen fotobeskrivning tillgänglig — använd konceptankare och platsidentitet från VARUMÄRKESRÖST-blocket som ditt konkreta fundament.' : ''}
`,
    de: `⚠️ ERÖFFNUNGSREGEL FÜR DIESEN BEITRAG: Die Schreibregeln der Marke erfordern konkrete Eröffnungen. Dein erster Satz MUSS in einem Element verankert sein, das du in 📸 PRIMÄRE FAKTENQUELLE, INHALT oder dem MARKENSTIMME-Block nachweisen kannst. Abstrakte Stimmung ("die Wärme breitet sich aus", "die Stille senkt sich herab") ist keine Quelle — das ist eine generische Halluzination.${!venueIdentity ? ' Keine Fotobeschreibung verfügbar — nutze Konzeptanker und Ortsidentität aus dem MARKENSTIMME-Block als konkretes Fundament.' : ''}
`,
  }
  const wpSceneMoodOpeningHint = isSceneMoodPost
    ? (wpSceneMoodOpeningHintMap[lang] || wpSceneMoodOpeningHintMap.da)
    : ''

  const templates: Record<string, string> = {
    da: `OPGAVE
Skriv ÉN social media-tekst til ${businessName} i ${city}.
${goalDirectiveLine}${weeklyPlanContext}${weeklyRoleFrame}
INDHOLD (skriv om KUN dette):
${contentBlock}
${brandBlock}${toneDNASection}${geoNarrativeBlock}${forbiddenWordsBlock}${hoursBlock}${faktaforbud.da}${citySizeGuard}${wpFactualAnchoringBlock}${wpSceneMoodOpeningHint}
${wpCtaSection}${wpBookingCtaBlock}KRAV TIL TEKSTEN
1) Længde: 300-450 tegn INKL. emojis og CTA
${startRules.da}
${sensoryRules.da}
${dishRules.da}
5) SKRIVEREGLER — følg disse STRENGT:
   a) ÉN TANKE PR. SÆTNING — stop før du forklarer. Undgå sammensatte konstruktioner.
   b) TILBEREDNING & RÅVARER FØRST — beskriv hvordan maden er lavet (langsomt ovnbagt, præcist grillet, hjemmelavet), ikke bare hvordan den smager
   c) KONKRETE DETALJER — ingen vage metaforer ("som en varm omfavnelse", "en symfoni af")
   d) NATURLIGT DANSK — skriv som en dansker skriver. Undgå: "lækker", "hyggelig", "autentisk", "unik", "svip" (dateret), "nyd" som imperativ åbning
   e) VÆRDI-DEMONSTRATION (kun for all-inclusive menuer/set menus): Vis bredden af tilbudet — hvor mange retter/elementer er inkluderet? Hvad får gæsten for prisen?
6) Aldrig " - " eller " – " som bindeled mellem sætningsled ("god mad – hyggelig stemning – book nu").
7) ${finalEmojiInstruction}
   ☕ MÅ KUN bruges, hvis kaffe, espresso, latte eller cappuccino er eksplicit nævnt som en drik i selve teksten — "Café" i virksomhedsnavnet tæller IKKE.
8) ${selectedCta ? ctaRule8.da : 'Ingen CTA påkrævet for dette opslag — lad teksten tale for sig selv'}${qualityNote}
9) Sætninger med kun subjekt + intransitivt verbum er forbudt overalt — "X venter", "X kalder", "X lokker" er scenefylde.

HASHTAGS (generer platformspecifikke hashtags på dansk):
- Facebook: 0-2 hashtags — fokus på lokal søgning (#${city}, #${city}Mad o.l.)
- Instagram: 3-5 hashtags — bred mix af lokation, ret-type, community
- Sprog: Brug DANSK for lifestyle/community tags (#MadElskere, #KaffeElskere)
- Menupunkter: Behold originalsproget (#Burger, #Sandwich, #VolAuVent — disse er internationale)
- Brug ALDRIG tags der ikke passer til indholdet i teksten

OUTPUT
Returner KUN dette JSON på én linje (ingen markdown, ingen forklaring):
{"text":"<selve teksten>","keyword":"<ét PascalCase ord der bedst beskriver dette indhold>","facebookHashtags":["#tag1","#tag2"],"instagramHashtags":["#tag1","#tag2","#tag3","#tag4","#tag5"]}`,

    sv: `UPPGIFT
Skriv EN social media-text till ${businessName} i ${city}.
${goalDirectiveLine}${weeklyPlanContext}${weeklyRoleFrame}
INNEHÅLL (skriv om BARA detta):
${contentBlock}
${brandBlock}${hoursBlock}${faktaforbud.sv}${wpFactualAnchoringBlock}${wpSceneMoodOpeningHint}
${wpCtaSection}${wpBookingCtaBlock}KRAV
1) Längd: 300-450 tecken INKL. emojis och CTA
${startRules.sv}
${sensoryRules.sv}
${dishRules.sv}
5) Naturlig svenska — undvik: "läcker", "mysig", "autentisk", "unik"
6) Aldrig " - " eller " – " som bindeled mellan meningsled.
7) ${finalEmojiInstruction}
   ☕ FÅR BARA användas om kaffe, espresso, latte eller cappuccino uttryckligen nämns som en dryck i texten — "Café" i företagsnamnet räknas INTE.
8) ${selectedCta ? ctaRule8.sv : 'Ingen CTA krävs för detta inlägg — låt texten tala för sig själv'}
9) Meningar med bara subjekt + intransitivt verb är förbjudna genomgående — "X väntar", "X kallar", "X lockar" är scenfyllnad.

HASHTAGS (generera plattformspecifika hashtags på svenska):
- Facebook: 0-2 hashtags — fokus på lokal sökning (#${city}, #${city}Mat o.s.v.)
- Instagram: 3-5 hashtags — bred mix av plats, rätttyp, community
- Språk: Använd SVENSKA för lifestyle/community-taggar (#MatÄlskare, #KaffeÄlskare)
- Menyrätter: Behåll originalspråket (#Burger, #Sandwich — dessa är internationella)

OUTPUT
Returnera KUN detta JSON på en rad (ingen markdown, ingen förklaring):
{"text":"<själva texten>","keyword":"<ett PascalCase-ord som bäst beskriver detta innehåll>","facebookHashtags":["#tag1","#tag2"],"instagramHashtags":["#tag1","#tag2","#tag3","#tag4","#tag5"]}`,

    de: `AUFGABE
Schreibe EINEN Social-Media-Text für ${businessName} in ${city}.
${goalDirectiveLine}${weeklyPlanContext}${weeklyRoleFrame}
INHALT (schreibe NUR über dieses):
${contentBlock}
${brandBlock}${hoursBlock}${faktaforbud.de}${wpFactualAnchoringBlock}${wpSceneMoodOpeningHint}
${wpCtaSection}${wpBookingCtaBlock}ANFORDERUNGEN
1) Länge: 300-450 Zeichen INKL. Emojis und CTA
${startRules.de}
${sensoryRules.de}
${dishRules.de}
5) Natürliches Deutsch — vermeide: "lecker", "gemütlich", "authentisch", "einzigartig"
6) Niemals " - " oder " – " als Bindeglied zwischen Satzteilen.
7) ${finalEmojiInstruction}
   ☕ DARF NUR genutzt werden, wenn Kaffee, Espresso, Latte oder Cappuccino ausdrücklich als Getränk im Text erwähnt wird — "Café" im Firmennamen zählt NICHT.
8) ${selectedCta ? ctaRule8.de : 'Keine CTA erforderlich für diesen Beitrag — lass den Text für sich sprechen'}
9) Sätze nur mit Subjekt + intransitivem Verb sind durchgehend verboten — "X wartet", "X ruft", "X lockt" sind Szenenerfüllung.

HASHTAGS (generiere plattformspezifische Hashtags auf Deutsch):
- Facebook: 0-2 Hashtags — Fokus auf lokale Suche (#${city}, #${city}Essen usw.)
- Instagram: 3-5 Hashtags — breite Mischung aus Ort, Gerichttyp, Community
- Sprache: Verwende DEUTSCH für Lifestyle/Community-Tags (#EssenLiebhaber, #KaffeeLiebhaber)
- Menüpunkte: Behalte die Originalsprache (#Burger, #Sandwich — diese sind international)

OUTPUT
Gib NUR dieses JSON auf einer Zeile zurück (kein Markdown, keine Erklärung):
{"text":"<der eigentliche Text>","keyword":"<ein PascalCase-Wort das diesen Inhalt am besten beschreibt>","facebookHashtags":["#tag1","#tag2"],"instagramHashtags":["#tag1","#tag2","#tag3","#tag4","#tag5"]}`,
  }

  return templates[language] || templates.da
}

// ══════════════════════════════════════════════════════════════════════════
// DISPATCHER — routes to the correct path builder
// ══════════════════════════════════════════════════════════════════════════
export function buildPrompt(opts: PromptOptions): string {
  return opts.isWeeklyPlan
    ? buildWeeklyPlanPrompt(opts)
    : buildAIIdeasPrompt(opts)
}
