/**
 * Audience Segmentation Prompt (Stage B5)
 *
 * Generates visitor segments based on visit patterns, occasions, and motivations.
 * Uses business model classification to determine segment count and priority.
 */

import type { DataSources, SecondarySignals } from '../types.ts'

export interface SegmentAudiencePromptParams {
  // Business context
  businessCharacter: string
  identityKeywords: string[]
  city: string
  neighborhood: string
  areaType: string
  establishmentType: string
  
  // Location intelligence
  touristContext: boolean
  locationMotivations: string[]
  proximityAnchor: string
  
  // Menu and offerings
  menuAnchors: string
  
  // Facilities
  hasOutdoor: boolean
  hasTakeaway: boolean
  reservationRequired: boolean
  
  // Price positioning
  priceLevelLabel: string
  priceRange: { min: number | null; max: number | null }
  
  // Owner signals
  whatMakesUsDifferent: string
  ownerDocSummary: string
  
  // Third party
  googleMapsSummary: string
  
  // Secondary signals
  secondarySignals: SecondarySignals
  
  // Pre-classification (optional)
  b0Classification?: {
    business_model_type: string
    primary_copy_hook: string
    audience_breadth: string
    classification_rationale: string
  } | null
  
  // Language
  languageCode: string
}

export function buildSegmentAudienceSystemPrompt(languageLabel: string): string {
  return `Du er en erfaren strategisk marketing-rådgiver specialiseret i F&B.
Du analyserer besøgsmønstre og gæsteadfærd for restauranter og caféer.
Du tænker i BESØGSMODUS — ikke demografiske kasser. En café har ikke én målgruppe. Den har 5 forskellige gæster på 5 forskellige tidspunkter, der besøger stedet med forskellig motivation og i forskelligt humør.
Du skriver udelukkende på ${languageLabel}.
Output ONLY valid JSON — no markdown, no commentary outside JSON.`
}

function buildClassificationBlock(
  b0Classification: SegmentAudiencePromptParams['b0Classification']
): string {
  if (b0Classification) {
    return `── PRE-KLASSIFICERET FORRETNINGSMODEL (Stage B0) ────────────────────────────
business_model_type: ${b0Classification.business_model_type}
primary_copy_hook: ${b0Classification.primary_copy_hook}
audience_breadth: ${b0Classification.audience_breadth}
Rationale: ${b0Classification.classification_rationale}

INSTRUKTION: Brug disse præ-klassificerede værdier direkte i output JSON. Spring selvstændig TRIN 1-analyse over.
VIGTIGT OM KLASSIFIKATIONENS ROLLE: Klassifikationen definerer IKKE hvem segmenterne er. Den bruges KUN til:
  (1) ANTAL: lad de konkrete datasignaler bestemme — serviceperioder, tourist_factor, sociale formater (solo/gruppe/familie). offer_led → maks 2–3. Maks 7 segmenter i alt.
  (2) RANGORDNING: hvilken besøgstype er primær — dvs. mest kommercielt vigtig
  (3) COPY-SIGNAL: primary_copy_hook styrer hvad der fremhæves i markedsføringen
  (4) PRIMARY-CAP (priority="primary"): "narrow" → præcis ét; "mixed" → maks to; "broad" eller "offer_led" → ét eller nul
Segmenternes IDENTITET defineres af de reelle besøgsscenarier i TRIN 2 — hvem sidder her faktisk, hvornår og med hvilken motivation.`
  }
  
  return `── TRIN 1 — KLASSIFICÉR FORRETNINGSMODELLEN ────────────────────────────────
Vælg den primære drivkraft for besøg (kombinationer er tilladt, fx "destination_led+occasion_led"):
• offer_led — besøget drives af HVAD de sælger. Alle vil bare have produktet (kaffebar, pølsevogn, bager). Segmentering giver næsten ingen mening.
• occasion_led — besøget drives af HVORNÅR. Serviceprogrammerne (morgenmad, frokost, aftensmad, cocktailtime) er det stærkeste argument.
• destination_led — besøget drives af STEDET. Beliggenhed og sæson er det stærkeste argument (vandkantscafé, rooftop, parkbar).
• audience_led — besøget drives af HVEM der kommer. Segmentidentiteten differentierer reelt (sportsbar, studenterbar, erhvervsfrokoststed).

Vælg primary_copy_hook — det stærkeste enkeltord for dette steds kopisprog:
• "product" — produktet er det stærkeste argument
• "location" — beliggenhed er det stærkeste argument
• "programme" — serviceprogrammet (dag-bue) er det stærkeste argument
• "identity" — gæsteidentitet er det stærkeste argument

Vælg audience_breadth:
• "narrow" — stedet henvender sig tydeligt til 1–2 klart adskilte besøgstyper (maks 3 segmenter)
• "mixed" — bred appel med klart adskilte besøgsanledninger (3–6 segmenter)
• "broad" — alle besøger stedet — ingen segmentering giver meningsfuld differentiering → producér 0–2 segmenter maks (kun ved klart adskilte tidsvinduer, fx morgen vs. aften)`
}

function buildPricePositioningGuidance(priceRange: { min: number | null; max: number | null }): string {
  const top = priceRange.max ?? priceRange.min ?? 0
  if (top >= 300) {
    return '→ Premium (300+ kr): Segmenter skal afspejle eksklusivitet, særlige lejligheder, oplevelsessøgende gæster.\n   Typisk: Fine dining-par, forretningsmøder, jubilaeer, gourmandgæster.\n   Undgå: Hurtig frokost, casual drop-in, studerende, budget-bevidste.'
  }
  if (top >= 150) {
    return '→ Mid-range (150-300 kr): Balance mellem kvalitet og tilgængelighed.\n   Typisk: Værdisøgende par/grupper, weekendbrunch, hyggemiddage, lokale stamgæster.\n   Inkludér bred vifte: både casual og planlagte besøg.'
  }
  return '→ Budget-friendly (<150 kr): Fokus på tilgængelighed, daglige besøg, casual anledninger.\n   Typisk: Studerende, hurtig frokost, drop-in kaffe, hverdagsbesøg.\n   Undgå: Eksklusivitet, særlige lejligheder, forventning om reservation.'
}

export function buildSegmentAudienceUserPrompt(params: SegmentAudiencePromptParams): string {
  const {
    businessCharacter,
    identityKeywords,
    city,
    neighborhood,
    areaType,
    establishmentType,
    touristContext,
    locationMotivations,
    proximityAnchor,
    menuAnchors,
    hasOutdoor,
    hasTakeaway,
    reservationRequired,
    priceLevelLabel,
    priceRange,
    whatMakesUsDifferent,
    ownerDocSummary,
    googleMapsSummary,
    secondarySignals,
    b0Classification,
    languageCode
  } = params

  const langLabels: Record<string, string> = {
    da: 'dansk', sv: 'svensk', de: 'tysk', nb: 'norsk', fi: 'finsk', en: 'engelsk'
  }
  const outputLanguageLabel = langLabels[languageCode] ?? 'dansk'

  const trin1Block = buildClassificationBlock(b0Classification)
  const pricePositioning = buildPricePositioningGuidance(priceRange)

  const introText = b0Classification
    ? 'Forretningsmodellen er præ-klassificeret (se nedenfor). Brug klassifikationen som rangeringssignal — producér segmenter baseret på hvem der FAKTISK besøger stedet, ikke på klassifikationskategorien.'
    : 'Klassificér først forretningsmodellen (TRIN 1), og producér derefter gæstesegmenter i overensstemmelse med klassifikationen (TRIN 2).'

  return `Analyser følgende data. ${introText}

Startpunktet er HVAD DE TILBYDER og HVORNÅR — det er udbuddet og åbningstiderne der skaber besøgsanledningerne. Kobl derefter til lokation og faciliteter.

── HVAD DE TILBYDER ──────────────────────────────────────────────────────────
${menuAnchors ? `Menu:\n${menuAnchors}` : 'Menu: ikke tilgængeligt'}
Åbningstider: ${secondarySignals.openingHoursHint || 'ikke tilgængeligt'}
Serviceprogrammer: ${secondarySignals.dayArcProgrammes.join(', ') || 'ikke tilgængeligt'}
── PRISNIVEAU OG POSITIONERING ───────────────────────────────────────────────
Prisniveau: ${priceLevelLabel}

POSITIONERING BASERET PÅ PRIS:
${pricePositioning}
── FACILITETER ───────────────────────────────────────────────────────────────
Udendørs siddeplads: ${hasOutdoor ? 'Ja' : 'Nej'}
Takeaway: ${hasTakeaway ? 'Ja' : 'Nej'}
Reservation nødvendig: ${reservationRequired ? 'Ja' : 'Nej — walk-in muligt'}
Børnemenu: ${secondarySignals.hasKidsMenu ? 'Ja' : 'Nej'}
── LOKATION OG BESØGSMOTIVATION ──────────────────────────────────────────────
Etableringstype: ${establishmentType || 'café/restaurant'}
By: ${city || 'ikke tilgængeligt'}${neighborhood ? ` — ${neighborhood}` : ''}
Områdetype: ${areaType || 'ikke tilgængeligt'}${areaType === 'waterfront' ? ' (CRITICAL: use specific waterway term "ved åen", "ved fjorden", "ved søen", "ved havnen" — NEVER generic "ved vandet")' : ''}${proximityAnchor ? ` (${proximityAnchor})` : ''}
Turister: ${touristContext ? 'Ja — stedet tiltrækker turister' : 'Primært lokale gæster'}
${locationMotivations.length > 0 ? `Besøgsmotivationer (brug som scenarie-frø til segmentproduktion): ${locationMotivations.join(', ')}` : ''}
${secondarySignals.audienceProfile ? `Stedsprofil: ${secondarySignals.audienceProfile}` : ''}
${whatMakesUsDifferent ? `── EJERENS EGNE ORD ──────────────────────────────────────────────────────────\n${whatMakesUsDifferent}` : ''}
${googleMapsSummary ? `── GÆSTEANMELDELSER (tredjepartssignal) ──────────────────────────────────────\n${googleMapsSummary}` : ''}
── BAGGRUNDSSIGNAL (brug ikke til at bestemme segmenter — kun til tone) ──────
Karakter: ${businessCharacter || 'ikke tilgængeligt'}
Identitet: ${identityKeywords.join(', ') || 'ikke tilgængeligt'}${ownerDocSummary ? `\nStemme-tone: ${ownerDocSummary}` : ''}
${trin1Block}
── TRIN 2 — PRODUCÉR SEGMENTER ────────────────────────────────────────────
STARTSPØRGSMÅL: Hvem sidder her reelt kl. 9? Kl. 12? Kl. 16? Kl. 20? — og hvad er de kommet for?
Brug besøgsmotivationerne og serviceprogrammerne fra data ovenfor som konkrete scenarie-frø til segmentidentitet.
Klassifikationen styrer RANGORDNING og PRIMARY-CAP — ikke hvad segmenterne hedder eller hvem de er.
ANTAL SEGMENTER — datadrevet (audience_breadth er loft, ikke skabelon):
Lad disse faktiske datasignaler bestemme antallet:
- Antal distinkter serviceprogrammer (morgenmad/brunch/frokost/aftensmad/cocktail) → ét segment pr. program der er i menudata
- tourist_factor = "seasonal" eller "year_round" → +1 segment for turistbesøgstype
- Sociale formater stedet understøtter (solo, par/gruppe, familie) → ét pr. distinkt format, kun hvis faciliteter understøtter det
Maks 7 segmenter i alt. offer_led → maks 2–3 uanset andre signaler.
Max 2 segmenter må have strategic_value = "high".
Segment-navne (label): korte, beskrivende, på ${outputLanguageLabel}, 2–4 ord.

OBLIGATORISKE BESØGSTYPER — dækkes KUN hvis data + audience_breadth understøtter det:
1. Solo-gæst: den der kommer alene — til arbejde, til kaffe, til en rolig frokost, til en øl ved baren. Solo-besøg er en selvstændig besøgsanladning, ikke et fravalg af selskab.
2. Gruppe-social: venner, kolleger, par eller familie der samles over et måltid eller en drink.
3. Turistgæst / første gang: besøger stedet for første gang, evt. fordi de er i området — motivation er opdagelse og det specifikke sted, ikke vane.
   VIGTIGT: inkludér kun hvis turistContext=true ELLER lokation er vandkant/destination/city_centre.
4. Familie: gæster med børn. Inkludér kun hvis hasKidsMenu=true eller data ellers peger på familiepublikum.
5. Aftensmad-segment: OBLIGATORISK hvis menudata viser aftensmadretter (forretter, hovedretter, dessert, à la carte aftensmenu) — timing 18:00–22:00, adskilt fra bar/cocktail-segment.
6. Cocktail/sen-aften-segment: OBLIGATORISK hvis stedet har cocktailmenu OG åbner til 22:00 eller senere — timing 21:00–02:00 i weekenden (fredag og lørdag minimum), adskilt fra aftensmadretten.

TIMING-REGEL (KRITISK):
Hvert segment skal dække ALLE relevante dage — ikke blot én eksempeldag. Brug maksimalt 3 timing-entries pr. segment ved at GRUPPERE dage:
- Brug day: "weekday" for mandag–fredag (ét objekt dækker alle 5 hverdage)
- Brug day: "weekend" for lørdag+søndag (ét objekt dækker begge weekenddage)
- Brug individuelle dage KUN hvis timing varierer pr. dag
Eksempler:
  Brunchentusiaster (lør+søn): [{"day": "weekend", "hour_start": 10, "hour_end": 14}]
  Turistgæster (alle dage): [{"day": "weekday", ...}, {"day": "weekend", ...}]
  Cocktailgæster (fre+lør sen aften): [{"day": "friday", ...}, {"day": "saturday", ...}]
ACTIVE_MONTHS-REGEL:
Brug "active_months" på segmentet (IKKE inde i timing-objekterne) når segmentet er tydeligt sæsonbestæmt:
- Værdier: 3-bogstavs engelske månedsforkortelsr ("jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec")
- Eksempel sommertourist: ["may","jun","jul","aug","sep"]
- OBLIGATORISK: Hvis tourist_factor = "seasonal" → turistgæste-segmentet SKAL have active_months sat (typisk ["apr","may","jun","jul","aug","sep"] for dansk by/vandkant)
- Udfyld ellers KUN hvis segmentet klart falder væk udenfor de nævnte måneder (fx sommertourister, julemarkeds-gæster, studenter i eksamenstid)
- For helårlige segmenter: sæt active_months = null
PRIORITET-REGEL — priority = "primary" begrænses af audience_breadth:
- "narrow" → præcis ét segment med priority = "primary"
- "mixed" → maks to segmenter med priority = "primary" (de to mest kommercielt vigtige)
- "broad" → ét segment (det mest omsætningsskabende helårs-segment), eller ingen
- offer_led → nul eller ét primary (tilbuddets stærke signal er primær — ikke gæstetype)
Øvrige segmenter: "secondary" eller "niche".

Her er eksempler på stærke mindset_descriptions — KUN til brug som stilistisk forbillede. Skriv ALDRIG indholdet fra disse eksempler ind i outputtet. Alle mindset_descriptions skal skrives fra bunden baseret på DATA for DETTE specifikke sted:

"Mandag morgen 7:45. På vej til stationen. Har 4 minutter. Tager det samme som sidst — en croissant og en stor kaffe. Betaler kontaktløst og er væk."

"Fredag aften. To par der ikke har set hinanden siden januar. Har booket bord til 19:30. Bruger tre timer. Bestiller ind ad kortet — dessert og en flaske til er ikke diskutabelt."

"Torsdag frokost. Kontorfolk der har lavet aftale om at mødes et sted der ikke er kantinen. Har en time. Bestiller noget fra frokostkortet og en øl til."

"Lørdag kl. 8:30. Tre kilometer bag sig. Sveden sidder stadig. Vil have noget ordentligt. Tager en stor kaffe og et æg benedict — det er en af de lørdage."

VIGTIGT — om "motivation"-feltet:
- Motivation SKAL beskrive DETTE SPECIFIKKE STED — ikke generisk F&B-sprog.
- Beskriv hvad der gør netop dette sted til det rigtige valg til denne anledning: lokationen (fx åen, havnen, torvet), det konkrete tilbud (fx cocktailbar, brunchprogram, udesiddeplads), stemningen eller tilgængeligheden (walk-in, ingen reservation).
- FORBUDT motivation: "at samles til en hyggelig oplevelse", "god mad og godt selskab", "en god oplevelse", "den unikke beliggenhed ved åen", "den maleriske beliggenhed", "det unikke sted" — disse er tomme fraser der ikke siger noget specifikt.
- OBLIGATORISK: motivation skal nævne noget konkret — et tidspunkt, en ret, en facilitet, et programme, en stemning eller en adgangsbetingelse der er æklusiv for dette sted.
- EKSEMPEL PÅ GOD MOTIVATION (stil-ref, skriv ikke dette): "Stedet er det eneste sted i kvarteret der serverer cocktails til kl. 02 — og man behøver ikke have reserveret."

VIGTIGT — om demografiske etiketter:
- Undgå demografiske kategorier som primær segmenteringsenhed ("studerende", "pensionister").
- Det er TILLADT at nævne besøgstype ("solo-gæst", "to veninder", "familie med børn") i mindset_description — det er adfærd, ikke demografi.

OUTPUT JSON:
{
  "business_model_type": "offer_led | occasion_led | destination_led | audience_led (kombinationer tilladt, fx destination_led+occasion_led)",
  "primary_copy_hook": "product | location | programme | identity",
  "audience_breadth": "narrow | mixed | broad",
  "segments_rationale": "<én sætning: hvorfor dette antal segmenter og denne bredde for netop dette sted>",
  "primary_mindset": "<én sætning om hvem stedet samlet set taler til>",
  "primary_segment_id": "<id på vigtigste segment — tom streng hvis ingen segmenter>",
  "tourist_factor": "none | seasonal | year_round",
  "deduced_from": ["<datakilder der vejede tungest>"],
  "segments": [
    {
      "id": "snake_case_id",
      "label": "Kort dansk navn",
      "priority": "primary | secondary | niche",
      "strategic_value": "high | medium | low",
      "mindset_description": "<konkret situation og beslutning — se eksempler ovenfor>",
      "timing": [
        {"day": "monday", "hour_start": 7, "hour_end": 9}
      ],
      "active_months": null,
      "visit_pattern": {
        "service_period": "morning | lunch | afternoon | evening | late_night"
      },
      "motivation": "<hvad driver besøget — én sætning>",
      "content_angles": [
        {
          "label": "<indholdsvinkel>",
          "cta_type": "walk_in | book_table | impulse_visit | engagement",
          "post_timing": "<f.eks. friday_16:30>",
          "tone_note": "<én sætning om hvordan teksten skal ramme dette segment>"
        }
      ]
    }
  ]
}`
}
