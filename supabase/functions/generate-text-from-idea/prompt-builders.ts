// prompt-builders.ts
// All prompt-building functions for generate-text-from-idea.
// Exports: buildWeeklyPlanContext, buildPrompt

import type { Suggestion, PromptOptions, SharedToneCore, BrandBlockOptions } from './types.ts'

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
          brandPreferVocab, brandAvoidVocab, contentAnchors } = opts

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
  const faktaforbud: Record<string, string> = {
    da: `\n🚫 FAKTAFORBUD
- FAKTAGRUNDLAG: Det der fremgår af INDHOLD-blokken er din eneste faktuelle kilde. Henvis ikke til retter, steder eller åbningstider der ikke er nævnt — heller ikke indirekte.
- Opfind INGEN stedsspecifikke detaljer (udsigt, attraktioner, vand, vejr) — hverken fra din træningsdata om virksomheden ELLER fra stednavne der nævnes i INDHOLD
- Stednavne i INDHOLD er destinationsreferencer, IKKE stemningstilladelse — skriv dem som faktum. Forbudt: "nærvær ved åen", "[årstid] lurer udenfor", "byens puls", "[sted] er din scene".
- EKSPLICIT FORBUDT FRASE: "ved åen", "en pause ved åen", "hverdagen ved åen" og lignende lokation-som-stemning vendinger er forbudt uanset kontekst — stedets beliggenhed er ikke et kommercielt argument i teksten medmindre udeservering er bekræftet og vejret er ideelt.\n`,
    sv: `\n🚫 FAKTAFÖRBUD
- FAKTAUNDERLAG: Enbart vad som framgår av INNEHÅLL-blocket är din enda faktakälla. Referera inte till rätter, platser eller öppettider som inte nämns — inte ens indirekt.
- Hitta inte på platsspecifika detaljer (utsikt, attraktioner, vatten, väder) — varken från din träningsdata om företaget ELLER från platsnamn som nämns i INNEHÅLL
- Platsnamn i INNEHÅLL är destinationsreferenser, INTE stämningsstillstånd — skriv dem som fakta, aldrig som grund för påhittad vatten-/naturatmosfär.
- EXPLICIT FÖRBJUDET: "vid ån", "en paus vid ån", "vardagen vid ån" och liknande plats-som-stämning fraser är förbjudna oavsett kontext.\n`,
    de: `\n🚫 FAKTENVERBOT
- FAKTENGRUNDLAGE: Nur was im INHALT-Block steht, ist deine einzige faktische Quelle. Verweise nicht auf Gerichte, Orte oder Öffnungszeiten, die nicht genannt werden — auch nicht indirekt.
- Erfinde KEINE ortsspezifischen Details (Aussicht, Attraktionen, Wasser, Wetter) — weder aus deinen Trainingsdaten über das Unternehmen NOCH aus Ortsnamen, die im INHALT erwähnt werden
- Ortsnamen im INHALT sind Destinationsreferenzen, KEIN Erlaubnis für Stimmungsatmosphäre — schreibe sie als Fakt, nie als Grundlage für erfundene Wasser-/Naturatmosphäre.
- EXPLIZIT VERBOTEN: "am Fluss", "eine Pause am Fluss", "der Alltag am Fluss" und ähnliche Ort-als-Stimmung Wendungen sind verboten.\n`,
    en: `\n🚫 FACTS PROHIBITION
- Invent NO location-specific details (views, attractions, water, weather) — neither from your training data about this business NOR from location names that may appear in CONTENT
- Location names in CONTENT are destination references, NOT permission to invent water/nature atmosphere
- Mention NO food, dishes or drinks unless they appear in CONTENT
- Use ONLY sensory details (sight/sound/texture/temperature) that can be derived DIRECTLY from CONTENT\n`,
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
  if (!o.brandTone && o.brandWritingRules.length === 0 && o.contentAnchors.length === 0) return ''
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
      b += `\n📸 PRIMÆR FAKTAKILDE — brug dette som det konkrete fundament for dette opslag (ikke opfundet atmosfære):\n${o.venueIdentity}`
    } else {
      b += `\n⚠️ Ingen fotobeskrivelse er tilgængelig. Opfind IKKE visuel atmosfære eller interiørdetaljer. Basér det konkrete element udelukkende på konceptankre og stedsidentitet nedenfor.`
    }
  }

  if (o.contentAnchors.length)      b += `\nKonceptankre (hvad dette sted faktisk tilbyder): ${o.contentAnchors.join(', ')}`
  if (o.businessCharacter)          b += `\nHvad dette sted er: ${o.businessCharacter}`
  if (o.identityKeywords?.length)   b += `\nStedsidentitet: ${o.identityKeywords.join(', ')}`
  if (o.brandTone)                  b += `\n${o.brandTone}`
  if (o.voiceConstraints)           b += `\nPrincip: ${o.voiceConstraints}`
  if (o.brandWritingRules.length)   b += `\nSkriveregler:\n${o.brandWritingRules.map(r => `- ${r}`).join('\n')}`
  if (o.brandGoodExamples.length) {
    const exLabel = o.isSceneMoodPost
      ? 'Stemmeeksempler (disse er menu/produktindlæg — brug KUN sprogtone og rytme som reference, IKKE indholdet):'
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
  } = opts

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

  // sceneMoodOpeningHint — for behind_scenes/atmosphere/team_people: reinforce brand rule
  // that openings must be anchored in a concrete moment, not abstract mood.
  // Also handles the no-venueIdentity case: when photos haven't been analyzed,
  // direct the model to businessCharacter/contentAnchors instead of inventing atmosphere.
  const sceneMoodOpeningHintMap: Record<string, string> = {
    da: `⚠️ ÅBNINGSREGEL FOR DETTE OPSLAG: Brandets egne skriveregler foreskriver konkrete åbninger — IKKE abstrakt stemning. Forbudt som første sætning: stemningsord som åbner ("hygge", "varme", "ro", "stilhed", "hverdagen", "torsdag sætter stemningen", "[ugedag] er perfekt til X"). Åbn i stedet med ét konkret element: en handling der foregår, en genstand i rummet, et faktum om stedet, en direkte sætning med et specifikt tilbud. Hvis Interiørmærker er tilgængelige ovenfor — brug dem som faktuelt fundament.${!opts.venueIdentity ? ' Interiørmærker er ikke tilgængelige — brug BRANDSTEMME-blokkens konceptankre og stedsidentitet som det konkrete fundament i stedet.' : ''}
`,
    sv: `⚠️ ÖPPNINGSREGEL FÖR DETTA INLÄGG: Varumärkets egna skrivinstruktioner föreskriver konkreta öppningar — INTE abstrakt stämning. Förbjudet som första mening: stämningsord som öppning ("mysighet", "värme", "ro", "stillhet", "vardagen", "[veckodag] är perfekt för X"). Öppna istället med ett konkret element: en handling som sker, ett föremål i rummet, ett faktum om stället, en direkt mening med ett specifikt erbjudande.${!opts.venueIdentity ? ' Interiörmärken är inte tillgängliga — använd VARUMÄRKESRÖST-blockets konceptankare och platsidentitet som det konkreta fundamentet istället.' : ''}
`,
    de: `⚠️ ERÖFFNUNGSREGEL FÜR DIESEN BEITRAG: Die eigenen Schreibregeln der Marke schreiben konkrete Eröffnungen vor — KEINE abstrakte Stimmung. Verboten als erster Satz: Stimmungswörter als Eröffnung ("Gemütlichkeit", "Wärme", "Ruhe", "Stille", "der Alltag", "[Wochentag] ist perfekt für X"). Öffne stattdessen mit einem konkreten Element: eine Handlung die stattfindet, ein Gegenstand im Raum, eine Tatsache über den Ort, ein direkter Satz mit einem spezifischen Angebot.${!opts.venueIdentity ? ' Interiormerkmale sind nicht verfügbar — nutze die Konzeptanker und Ortsidentität aus dem MARKENSTIMME-Block als konkretes Fundament.' : ''}
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
    ? `- Skriv IKKE dette som åbningssætning ordret: "${hook.slice(0, 80)}" — åbn med et konkret element fra INDHOLD\n`
    : ''
  const forbiddenOpenerSV = hook.trim().length > 10
    ? `- Skriv INTE detta som öppningsmening ordagrant: "${hook.slice(0, 80)}" — öppna med ett konkret element från INNEHÅLL\n`
    : ''
  const forbiddenOpenerDE = hook.trim().length > 10
    ? `- Schreibe NICHT diesen Satz wörtlich als Eröffnungssatz: "${hook.slice(0, 80)}" — öffne stattdessen mit einem konkreten Element aus dem INHALT\n`
    : ''
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
    brandSignaturePhrases: aiSigPhrases,
    contentAnchors: aiContentAnchors,
    thingsToAvoid: opts.thingsToAvoid,
    goalMode,
    isSceneMoodPost,
    voiceRationale,
    venueIdentity,
    businessCharacter,
    identityKeywords,
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
${brandBlock}${hoursBlock}${faktaforbud.da}${sceneMoodOpeningHint}${forbiddenOpener.da}${dishProtagonistHint}
${ctaHeader.da}
"${selectedCta}"
KRAV TIL TEKSTEN
1) Længde: 300-450 tegn INKL. emojis og CTA
${startRules.da}
${sensoryRules.da}
${dishRules.da}
${anledningRule.da}
6) Naturligt dansk — skriv som en dansker skriver. Undgå: "lækker", "hyggelig", "autentisk", "unik", "svip" (dateret), "nyd" som imperativ åbning
7) Aldrig " - " eller " – " som bindeled mellem sætningsled ("god mad – hyggelig stemning – book nu").
8) ${emojiInstruction}
   ☕ MÅ KUN bruges, hvis kaffe, espresso, latte eller cappuccino er eksplicit nævnt som en drik i selve teksten — "Café" i virksomhedsnavnet tæller IKKE.
9) ${ctaRule8.da}${qualityNote}

OUTPUT
Returner KUN dette JSON på én linje (ingen markdown, ingen forklaring):
{"text":"<selve teksten>","keyword":"<ét PascalCase ord der bedst beskriver dette indhold>"}`,

    sv: `UPPGIFT
Skriv EN social media-text till ${businessName} i ${city}.
${goalDirectiveLine}${readerOutcomeLine}${writingPostureLine}${activationLine}${contentTypeHint}${atmosphereHint}
INNEHÅLL (skriv om BARA detta):
${contentBlock}
${brandBlock}${hoursBlock}${faktaforbud.sv}${sceneMoodOpeningHint}${forbiddenOpener.sv}${dishProtagonistHint}
${ctaHeader.sv}
"${selectedCta}"
KRAV
1) Längd: 300-450 tecken INKL. emojis och CTA
${startRules.sv}
${sensoryRules.sv}
${dishRules.sv}
${anledningRule.sv}
6) Naturlig svenska — undvik: "läcker", "mysig", "autentisk", "unik"
7) Aldrig " - " eller " – " som bindeled mellan meningsled.
8) ${emojiInstruction}
   ☕ FÅR BARA användas om kaffe, espresso, latte eller cappuccino uttryckligen nämns som en dryck i texten — "Café" i företagsnamnet räknas INTE.
9) ${ctaRule8.sv}

OUTPUT
Returnera KUN detta JSON på en rad (ingen markdown, ingen förklaring):
{"text":"<själva texten>","keyword":"<ett PascalCase-ord som bäst beskriver detta innehåll>"}`,

    de: `AUFGABE
Schreibe EINEN Social-Media-Text für ${businessName} in ${city}.
${goalDirectiveLine}${readerOutcomeLine}${writingPostureLine}${activationLine}${contentTypeHint}${atmosphereHint}
INHALT (schreibe NUR über dieses):
${contentBlock}
${brandBlock}${hoursBlock}${faktaforbud.de}${sceneMoodOpeningHint}${forbiddenOpener.de}${dishProtagonistHint}
${ctaHeader.de}
"${selectedCta}"
ANFORDERUNGEN
1) Länge: 300-450 Zeichen INKL. Emojis und CTA
${startRules.de}
${sensoryRules.de}
${dishRules.de}
${anledningRule.de}
6) Natürliches Deutsch — vermeide: "lecker", "gemütlich", "authentisch", "einzigartig"
7) Niemals " - " oder " – " als Bindeglied zwischen Satzteilen.
8) ${emojiInstruction}
   ☕ DARF NUR genutzt werden, wenn Kaffee, Espresso, Latte oder Cappuccino ausdrücklich als Getränk im Text erwähnt wird — "Café" im Firmennamen zählt NICHT.
9) ${ctaRule8.de}


OUTPUT
Gib NUR dieses JSON auf einer Zeile zurück (kein Markdown, keine Erklärung):
{"text":"<der eigentliche Text>","keyword":"<ein PascalCase-Wort das diesen Inhalt am besten beschreibt>"}`,
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
  } = opts

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

  const brandBlock = buildBrandBlock({
    brandTone, voiceConstraints,
    brandWritingRules: cappedWritingRules,
    brandGoodExamples: wpGoodExamples,
    brandAvoidExamples: wpAvoidExamples,
    brandPreferVocab: wpPreferVocab,
    brandAvoidVocab: wpAvoidVocab,
    brandSignaturePhrases: brandSignaturePhrases.slice(0, 3),
    contentAnchors: wpContentAnchors,
    thingsToAvoid: opts.thingsToAvoid,
    goalMode,
    isSceneMoodPost,
    voiceRationale,
    venueIdentity,
    businessCharacter,
    identityKeywords,
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

  const templates: Record<string, string> = {
    da: `OPGAVE
Skriv ÉN social media-tekst til ${businessName} i ${city}.
${goalDirectiveLine}${weeklyPlanContext}${weeklyRoleFrame}
INDHOLD (skriv om KUN dette):
${contentBlock}
${brandBlock}${hoursBlock}${faktaforbud.da}${wpSceneMoodOpeningHint}
${ctaHeader.da}
"${selectedCta}"
KRAV TIL TEKSTEN
1) Længde: 300-450 tegn INKL. emojis og CTA
${startRules.da}
${sensoryRules.da}
${dishRules.da}
5) Naturligt dansk — skriv som en dansker skriver. Undgå: "lækker", "hyggelig", "autentisk", "unik", "svip" (dateret), "nyd" som imperativ åbning
6) Aldrig " - " eller " – " som bindeled mellem sætningsled ("god mad – hyggelig stemning – book nu").
7) ${emojiInstruction}
   ☕ MÅ KUN bruges, hvis kaffe, espresso, latte eller cappuccino er eksplicit nævnt som en drik i selve teksten — "Café" i virksomhedsnavnet tæller IKKE.
8) ${ctaRule8.da}${qualityNote}
9) Sætninger med kun subjekt + intransitivt verbum er forbudt overalt — "X venter", "X kalder", "X lokker" er scenefylde.

OUTPUT
Returner KUN dette JSON på én linje (ingen markdown, ingen forklaring):
{"text":"<selve teksten>","keyword":"<ét PascalCase ord der bedst beskriver dette indhold>"}`,

    sv: `UPPGIFT
Skriv EN social media-text till ${businessName} i ${city}.
${goalDirectiveLine}${weeklyPlanContext}${weeklyRoleFrame}
INNEHÅLL (skriv om BARA detta):
${contentBlock}
${brandBlock}${hoursBlock}${faktaforbud.sv}${wpSceneMoodOpeningHint}
${ctaHeader.sv}
"${selectedCta}"
KRAV
1) Längd: 300-450 tecken INKL. emojis och CTA
${startRules.sv}
${sensoryRules.sv}
${dishRules.sv}
5) Naturlig svenska — undvik: "läcker", "mysig", "autentisk", "unik"
6) Aldrig " - " eller " – " som bindeled mellan meningsled.
7) ${emojiInstruction}
   ☕ FÅR BARA användas om kaffe, espresso, latte eller cappuccino uttryckligen nämns som en dryck i texten — "Café" i företagsnamnet räknas INTE.
8) ${ctaRule8.sv}
9) Meningar med bara subjekt + intransitivt verb är förbjudna genomgående — "X väntar", "X kallar", "X lockar" är scenfyllnad.

OUTPUT
Returnera KUN detta JSON på en rad (ingen markdown, ingen förklaring):
{"text":"<själva texten>","keyword":"<ett PascalCase-ord som bäst beskriver detta innehåll>"}`,

    de: `AUFGABE
Schreibe EINEN Social-Media-Text für ${businessName} in ${city}.
${goalDirectiveLine}${weeklyPlanContext}${weeklyRoleFrame}
INHALT (schreibe NUR über dieses):
${contentBlock}
${brandBlock}${hoursBlock}${faktaforbud.de}${wpSceneMoodOpeningHint}
${ctaHeader.de}
"${selectedCta}"
ANFORDERUNGEN
1) Länge: 300-450 Zeichen INKL. Emojis und CTA
${startRules.de}
${sensoryRules.de}
${dishRules.de}
5) Natürliches Deutsch — vermeide: "lecker", "gemütlich", "authentisch", "einzigartig"
6) Niemals " - " oder " – " als Bindeglied zwischen Satzteilen.
7) ${emojiInstruction}
   ☕ DARF NUR genutzt werden, wenn Kaffee, Espresso, Latte oder Cappuccino ausdrücklich als Getränk im Text erwähnt wird — "Café" im Firmennamen zählt NICHT.
8) ${ctaRule8.de}
9) Sätze nur mit Subjekt + intransitivem Verb sind durchgehend verboten — "X wartet", "X ruft", "X lockt" sind Szenenerfüllung.

OUTPUT
Gib NUR dieses JSON auf einer Zeile zurück (kein Markdown, keine Erklärung):
{"text":"<der eigentliche Text>","keyword":"<ein PascalCase-Wort das diesen Inhalt am besten beschreibt>"}`,
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
