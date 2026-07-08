// hospitality-register.ts
// Language-keyed registry of professional register instructions for all AI text-generation prompts.
//
// PROBLEM SOLVED: LLMs default to domestic vocabulary ("spisestuen", "haven", "familien") even
// when writing for commercial hospitality venues. This registry provides a per-language instruction
// block that reframes the model as a hospitality professional, replacing the ban-list pattern with
// a positive register framing + 3 concrete contrast pairs.
//
// ── Adding a new language ─────────────────────────────────────────────────────────────────────
// 1. Add the ISO 639-1 code to the `SupportedLangCode` union type below.
// 2. Add a fully translated entry to `HOSPITALITY_REGISTER`.
//    TypeScript will surface a compile error if any required field is missing.
// 3. If needed, add an ISO 3166-1 alpha-2 → lang mapping in `countryToLangCode`.
// 4. Deploy all text-generation functions:
//    npx supabase functions deploy get-quick-suggestions get-weekly-strategy generate-weekly-plan \
//      generate-text-from-idea ai-enhance --project-ref kvqdkohdpvmdylqgujpn
// ─────────────────────────────────────────────────────────────────────────────────────────────

// ── Type contract ─────────────────────────────────────────────────────────────────────────────
// Every supported language MUST implement this shape. TypeScript enforces completeness.
interface HospitalityRegisterEntry {
  /** Returns the full register instruction paragraph, ready to embed directly in a prompt.
   *  @param vertical  Optional business type (e.g. 'café', 'bar', 'bakery').
   *                   Defaults to a generic hospitality term in each language.
   */
  block(vertical?: string): string
}

export type SupportedLangCode = 'da' | 'no' | 'sv' | 'de' | 'en'

type HospitalityRegisterMap = Record<SupportedLangCode, HospitalityRegisterEntry>

// ── Registry ──────────────────────────────────────────────────────────────────────────────────

const HOSPITALITY_REGISTER: HospitalityRegisterMap = {

  // ── Danish (canonical template — all other languages mirror this structure) ─────────────────
  da: {
    block: (vertical = 'serveringssted') => `\
FAGLIG REGISTER: Du skriver om et kommercielt ${vertical}-sted. Tænk og skriv som en professionel i restaurationsbranchen: brug den naturlige faglige jargon en erfaren vært eller køkkenchef ville bruge. Konkrete eksempler på korrekt register (princippet gælder ALLE lignende tilfælde; generaliser selv):
  Rum/lokale → brug: stedets navn, "restauranten", "lokalet", "baren", "udeservering" (IKKE "spisestuen", "stuen", "haven" - det er rum i private hjem; IKKE "salen" - det er teater- og biografsprog; brug "lokalet" med mindre stedet selv kalder det "salen")
  Udendørsareal → brug: "udeserveringen" som STANDARD. Brug kun "terrassen" hvis det er stedets EKSPLICITTE betegnelse fra deres egen beskrivelse. Brug "haven/gårdhaven" kun hvis det er stedets faktiske navn (IKKE "have" som generisk ord)
  Besøgende → brug: "gæster" (IKKE "familien", "vennerne", "selskabet" med mindre det er en faktuel anledning som firmafest)
Disse 3 eksempler illustrerer princippet: anvend erhvervssprog konsekvent i alle rum, relationer og situationer. VIGTIGT: Brug aldrig "terrasse" med mindre stedet selv kalder det det - brug altid "udeservering" som standard.`,
  },

  // ── Norwegian ─────────────────────────────────────────────────────────────────────────────
  no: {
    block: (vertical = 'serveringssted') => `\
FAGLIG REGISTER: Du skriver om et kommersielt ${vertical}-sted. Tenk og skriv som en profesjonell i restaurantbransjen: bruk den naturlige faglige sjargongen en erfaren vert eller kjøkkensjef ville brukt. Konkrete eksempler på korrekt register (prinsippet gjelder ALLE lignende tilfeller; generaliser selv):
  Rom/lokale → bruk: stedets navn, "restauranten", "lokalet", "baren", "uteservering" (IKKE "spisestuen", "stuen", "hagen" - det er rom i private hjem; IKKE "salen" - det er teater- og kinospeak; bruk "lokalet" med mindre stedet selv kaller det "salen")
  Utendørsareal → bruk: "uteserveringen", "utendørs servering" som STANDARD. Bruk kun "terrassen" hvis det er stedets EKSPLISITTE betegnelse fra deres egen beskrivelse. Bruk "hagen/gårdhagen" kun hvis det er stedets faktiske navn (IKKE "hage" som generisk ord)
  Besøkende → bruk: "gjester" (IKKE "familien", "vennene", "selskapet" med mindre det er en faktisk anledning som firmafest)
Disse 3 eksemplene illustrerer prinsippet: bruk fagspråk konsekvent i alle rom, relasjoner og situasjoner. VIKTIG: Bruk aldri "terrasse" med mindre stedet selv kaller det det - bruk alltid "utendørs servering" eller "uteservering" som standard.`,
  },

  // ── Swedish ───────────────────────────────────────────────────────────────────────────────
  sv: {
    block: (vertical = 'serveringsställe') => `\
YRKESREGISTER: Du skriver om ett kommersiellt ${vertical}-ställe. Tänk och skriv som en professionell inom restaurangbranschen: använd den naturliga branschterminologi en erfaren värd eller kökschef skulle använda. Konkreta exempel på korrekt register (principen gäller ALLA liknande fall; generalisera själv):
  Rum/lokal → använd: ställets namn, "restaurangen", "matsalen", "baren", "uteservering" (INTE "vardagsrummet", "köket" i hushållsbetydelse, "trädgården" - det är rum i privata hem)
  Utomhusyta → använd: "uteserveringen", "utomhusservering" som STANDARD. Använd endast "terrassen" om det är ställets EXPLICITA beteckning från deras egen beskrivning. Använd "gårdsplanen" endast om det är ställets faktiska namn (INTE "trädgård" som generiskt ord)
  Besökande → använd: "gäster" (INTE "familjen", "vännerna", "sällskapet" om det inte är ett faktiskt tillfälle som företagsfest)
Dessa 3 exempel illustrerar principen: använd branschspråk konsekvent i alla rum, relationer och situationer. VIKTIGT: Använd aldrig "terrass" om inte stället själv kallar det så - använd alltid "utomhusservering" eller "uteservering" som standard.`,
  },

  // ── German ────────────────────────────────────────────────────────────────────────────────
  de: {
    block: (vertical = 'Gastronomiebetrieb') => `\
FACHREGISTER: Du schreibst über einen kommerziellen ${vertical}. Denke und schreibe wie ein Profi in der Gastronomiebranche: verwende den natürlichen Fachjargon, den ein erfahrener Gastgeber oder Küchenchef nutzen würde. Konkrete Beispiele für korrektes Register (das Prinzip gilt für ALLE ähnlichen Fälle; verallgemeinere selbst):
  Räumlichkeiten → verwende: Name des Betriebs, "das Restaurant", "der Saal", "die Bar", "Außenbereich" (NICHT "Esszimmer", "Wohnzimmer", "Garten" - das sind Räume in Privathaushalten)
  Außenbereich → verwende: "der Außenbereich", "Außenbestuhlung" als STANDARD. Verwende nur "die Terrasse" wenn dies die EXPLIZITE Bezeichnung des Betriebs aus ihrer eigenen Beschreibung ist. Verwende "der Biergarten" nur falls das der tatsächliche Name ist (NICHT "Garten" als generisches Wort)
  Besucher → verwende: "Gäste" (NICHT "die Familie", "die Freunde", "die Gesellschaft" außer bei einem konkreten Anlass wie einer Firmenfeier)
Diese 3 Beispiele veranschaulichen das Prinzip: Fachsprache konsequent in allen Räumen, Beziehungen und Situationen verwenden. WICHTIG: Verwende niemals "Terrasse" es sei denn, der Betrieb nennt es so - verwende immer "Außenbereich" als Standard.`,
  },

  // ── English ───────────────────────────────────────────────────────────────────────────────
  en: {
    block: (vertical = 'venue') => `\
PROFESSIONAL REGISTER: You are writing about a commercial ${vertical}. Think and write as a hospitality professional: use the natural trade language an experienced host or head chef would use. Concrete examples of correct register (the principle applies to ALL similar cases; generalise yourself):
  Spaces/rooms → use: venue name, "the restaurant", "the dining room", "the bar", "the terrace", "outdoor seating" (NOT "the living room", "the garden" in a domestic sense - those are rooms in private homes)
  Outdoor area → use: "the terrace", "the outdoor seating area", "the courtyard" if that is the venue's actual name (NOT "garden" as a generic word)
  Visitors → use: "guests" (NOT "the family", "the friends", "the group" unless it is an actual private occasion such as a company event)
These 3 examples illustrate the principle: use professional hospitality language consistently across all spaces, relationships, and contexts.`,
  },
}

// ── Public API ────────────────────────────────────────────────────────────────────────────────

/**
 * Returns the hospitality register instruction block for the given language.
 * Falls back to Danish ('da') for unsupported language codes.
 *
 * @param langCode  ISO 639-1 code — 'da', 'no', 'sv', 'de', 'en'
 * @param vertical  Optional business type to embed (e.g. 'café', 'bakery', 'bar').
 *                  When omitted each language uses its own sensible default.
 */
export function getHospitalityRegisterBlock(langCode: string, vertical?: string): string {
  const entry = HOSPITALITY_REGISTER[langCode as SupportedLangCode] ?? HOSPITALITY_REGISTER.da
  return entry.block(vertical)
}

/**
 * Maps a country identifier to an ISO 639-1 language code.
 * Accepts both ISO 3166-1 alpha-2 codes (e.g. 'DK') and full English names (e.g. 'Denmark').
 * Returns 'da' (Danish) as fallback for unrecognised values.
 */
export function countryToLangCode(country: string): string {
  const c = country?.trim() ?? ''

  // ISO 3166-1 alpha-2 codes (used by WeekContext.country)
  const isoMap: Record<string, string> = {
    DK: 'da', NO: 'no', SE: 'sv', DE: 'de',
    GB: 'en', US: 'en', AT: 'de', CH: 'de',
    NL: 'nl', FI: 'fi', FR: 'fr', ES: 'es',
  }
  const isoResult = isoMap[c.toUpperCase()]
  if (isoResult) return isoResult

  // Full English country names (used by businesses.country / resolve-context.ts)
  const fullMap: Record<string, string> = {
    Denmark: 'da', Norway: 'no', Sweden: 'sv', Germany: 'de',
    'United Kingdom': 'en', England: 'en', 'United States': 'en',
    Netherlands: 'nl', Finland: 'fi', France: 'fr', Spain: 'es',
    Austria: 'de', Switzerland: 'de',
  }
  return fullMap[c] ?? 'da'
}
