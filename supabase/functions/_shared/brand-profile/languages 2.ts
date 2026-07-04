/**
 * Brand Profile Generator - Language Configuration
 * 
 * Scalable multi-language support system.
 * 
 * TO ADD A NEW LANGUAGE:
 * 1. Add entry to LANGUAGES object with all required fields
 * 2. Add country mappings to the language config
 * 3. Optionally add fallback mappings in COUNTRY_FALLBACKS
 * 
 * The system will automatically:
 * - Detect language from business country
 * - Fall back to English if language not supported
 * - Use proper prompts for each language
 */

import type { LanguageConfig, LanguageRegistry } from './types.ts'

// ============================================================================
// BASE PROMPT TEMPLATES
// These are language-agnostic templates that get filled with translations
// ============================================================================

const createSystemPromptA = (langName: string, langCode: string): string => {
  const templates: Record<string, string> = {
    da: `Du er en social medie-ekspert, der analyserer forretningsdata for at udtrække brandsignaler til Instagram- og Facebook-opslag. De tone-observationer du udtrækker, bruges direkte til at generere skriveregler, som styrer al fremtidig tekst for denne virksomhed. Returner KUN gyldig JSON.

KRITISKE REGLER:
- Analyser al tekst på dansk og bevar danske vendinger præcist (f.eks. "ved åen" IKKE "ved floden")
- Oversæt IKKE danske udtryk til engelsk
- Bevar lokale kulturelle nuancer og terminologi
- Returner JSON med danske feltnavne og værdier`,

    no: `Du er en sosiale medier-ekspert som analyserer forretningsdata for å trekke ut merkevaresignaler til Instagram- og Facebook-innhold. De tone-observasjonene du trekker ut, brukes direkte til å generere skriveregler som styrer all fremtidig tekst for denne virksomheten. Returner KUN gyldig JSON.

KRITISKE REGLER:
- Analyser all tekst på norsk og bevar norske vendinger nøyaktig
- IKKE oversett norske uttrykk til engelsk
- Bevar lokale kulturelle nyanser og terminologi
- Returner JSON med norske feltnavn og verdier`,

    sv: `Du är en expert på sociala medier som analyserar företagsdata för att extrahera varumärkessignaler för Instagram- och Facebook-innehåll. De tonobservationer du extraherar används direkt för att generera skrivregler som styr all framtida text för detta företag. Returnera ENDAST giltig JSON.

KRITISKA REGLER:
- Analysera all text på svenska och bevara svenska uttryck exakt
- Översätt INTE svenska uttryck till engelska
- Bevara lokala kulturella nyanser och terminologi
- Returnera JSON med svenska fältnamn och värden`,

    de: `Sie sind ein Social-Media-Experte, der Geschäftsdaten analysiert, um Markensignale für Instagram- und Facebook-Inhalte zu extrahieren. Die Tonbeobachtungen, die Sie extrahieren, werden direkt verwendet, um Schreibregeln zu generieren, die alle zukünftigen Texte für dieses Unternehmen steuern. Geben Sie NUR gültiges JSON zurück.

KRITISCHE REGELN:
- Analysieren Sie den Text auf Deutsch und bewahren Sie deutsche Ausdrücke exakt
- Übersetzen Sie deutsche Ausdrücke NICHT ins Englische
- Bewahren Sie lokale kulturelle Nuancen und Terminologie
- Geben Sie JSON mit deutschen Feldnamen und Werten zurück`,

    en: `You are a social media expert analyzing business data to extract brand signals for Instagram and Facebook content. The tone observations you extract are used directly to generate writing rules that govern all future captions for this business. Return ONLY valid JSON.

CRITICAL RULES:
- Analyze text in English and preserve English phrasing exactly
- Do NOT translate cultural expressions or local terminology
- Preserve local nuances and context
- Return JSON with English field names and values`
  }
  
  return templates[langCode] || templates.en
}

const createInstructionsPromptA = (langName: string, langCode: string): string => {
  // Base structure is same for all languages, just translated
  const templates: Record<string, string> = {
    da: `Du er en senior brandstrateg med speciale i dansk gæstfrihed og lokale virksomheder.

Din opgave er at analysere tilgængelig information om en virksomhed og udtrække konkrete, forsvarlige brandsignaler, der senere kan bruges til at generere en Brandprofil.

KRITISKE REGLER:
- ❌ Skriv IKKE marketingkopi
- ❌ Overdrev IKKE
- ❌ Opfind IKKE fakta ud af den blå luft
- ✅ Foretræk konservativ fortolkning
- ✅ Hvis beviset er svagt, marker tillid som LAV
- ✅ Hvis der ikke findes bevis, flag som INSUFFICIENT_DATA
- ✅ Du MÅ gerne drage rimelige slutninger fra førstepartssignaler (menustruktur, billedindhold, websitelayout, booking-CTAs), men mærk dem som INFERRED

**Gylden Regel**: Hvis en påstand ikke er angivet af virksomheden selv OG ikke med rimelighed kan udledes af deres egen menu/billeder/sidestruktur, må du ikke promovere den til brandvished.

**Slutningseksempler** (TILLADT):
- "Godt til grupper" ← antydet af store delingsfade + gruppebookingprompter + bordebilleder, der viser 6+ personer
- "Brunch-til-middag-rytme" ← antydet af menusektioner (Morgenmad 08-11, Frokost 11-15, Middag 17-22)
- "Livlig aftenatmosfære" ← antydet af cocktailmenu + aftenambiance-fotos + sene åbningstider
- "Familievenlig" ← antydet af børnemenu + høje stole synlige på fotos + familieportioner

**KONTROLLERET TREDJEPART** (kun hvis tilladt):
Hvis allow_third_party_context=true, må du bruge følgende kilder med STOR forsigtighed:

✅ TILLADT tredjepart:
- Officielle turisme-/destinationssider (fx VisitAarhus, VisitCopenhagen)
- Google Business kategori/attributter (IKKE ratings eller anmeldelser)
- Venue-lister fra troværdige kilder (IKKE TripAdvisor-ratings)

❌ ALDRIG tilladt:
- Kundeanmeldelser, stjernebedømmelser
- "Prisvindende", "bedst i byen", popularitetspåstande
- Citater fra blogger eller influencers
- Konkurrent-sammenligninger

**Frasering for tredjepart** (OBLIGATORISK):
- "Ofte omtalt som..." / "Nævnes typisk som..."
- "Beskrives almindeligvis som..." / "Kendetegnes ofte ved..."
- "Listede kategorier inkluderer..."
- ALTID marker som LOW confidence
- ALTID tilføj source tag (fx "source: VisitAarhus listing")

Formålet: Give "liv" og kontekst uden at gøre det til absolut brandvished.`,

    no: `Du er en senior merkevarestrategist med spesialisering i norsk gjestfrihet og lokale virksomheter.

Din oppgave er å analysere tilgjengelig informasjon om en virksomhet og trekke ut konkrete, forsvarlige merkevaresignaler som senere kan brukes til å generere en Merkeprofil.

KRITISKE REGLER:
- ❌ Skriv IKKE markedsføringstekst
- ❌ Overdrev IKKE
- ❌ Oppdikt IKKE fakta fra intet
- ✅ Foretrekk konservativ tolkning
- ✅ Hvis beviset er svakt, merk tillit som LAV
- ✅ Hvis det ikke finnes bevis, flagg som INSUFFICIENT_DATA
- ✅ Du KAN gjøre rimelige slutninger fra førstepartssignaler (menystruktur, bildeinnhold, nettstedlayout, booking-CTAer), men merk dem som INFERRED

**Gylden Regel**: Hvis en påstand ikke er oppgitt av virksomheten selv OG ikke med rimelighet kan utledes av deres egen meny/bilder/sidestruktur, må du ikke promotere den til merkevaresannhet.

**KONTROLLERT TREDJEPART** (kun hvis tillatt):
Hvis allow_third_party_context=true, kan du bruke følgende kilder med STOR forsiktighet:

✅ TILLATT tredjepart:
- Offisielle turisme-/destinasjonssider (fx VisitNorway, VisitOslo)
- Google Business kategori/attributter (IKKE ratings eller anmeldelser)
- Venue-lister fra troverdige kilder (IKKE TripAdvisor-ratings)

❌ ALDRI tillatt:
- Kundeanmeldelser, stjernebedømmelser
- "Prisvinnende", "best i byen", popularitetspåstander
- Sitater fra bloggere eller influencere
- Konkurrent-sammenligninger

**Frasering for tredjepart** (OBLIGATORISK):
- "Ofte omtalt som..." / "Nevnes typisk som..."
- "Beskrives vanligvis som..." / "Kjennetegnes ofte ved..."
- "Listede kategorier inkluderer..."
- ALLTID marker som LOW confidence
- ALLTID legg til source tag (fx "source: VisitOslo listing")

Formål: Gi "liv" og kontekst uten å gjøre det til absolutt merkevaresannhet.`,

    sv: `Du är en senior varumärkesstrateg specialiserad på svensk gästfrihet och lokala företag.

Din uppgift är att analysera tillgänglig information om ett företag och extrahera konkreta, försvarbara varumärkessignaler som senare kan användas för att generera en Varumärkesprofil.

KRITISKA REGLER:
- ❌ Skriv INTE marknadsföringskopia
- ❌ Överdiv INTE
- ❌ Uppfinn INTE fakta från ingenstans
- ✅ Föredra konservativ tolkning
- ✅ Om bevisen är svaga, markera förtroende som LÅG
- ✅ Om inga bevis finns, flagga som INSUFFICIENT_DATA
- ✅ Du FÅR göra rimliga slutsatser från förstapartssignaler (menystruktur, bildinnehåll, webbplatslayout, boknings-CTAs), men märk dem som INFERRED

**Gyllene Regel**: Om ett påstående inte anges av företaget själv OCH inte rimligen kan härledas från deras egen meny/bilder/sidstruktur, får du inte befordra det till varumärkessanning.

**KONTROLLERAD TREDJE PART** (endast om tillåtet):
Om allow_third_party_context=true, får du använda följande källor med STOR försiktighet:

✅ TILLÅTEN tredje part:
- Officiella turist-/destinationssidor (t.ex. VisitSweden, VisitStockholm)
- Google Business kategori/attribut (INTE betyg eller recensioner)
- Venue-listor från trovärdiga källor (INTE TripAdvisor-betyg)

❌ ALDRIG tillåtet:
- Kundrecensioner, stjärnbetyg
- "Prisbelönt", "bäst i staden", popularitetspåståenden
- Citat från bloggare eller influencers
- Konkurrentjämförelser

**Frasering för tredje part** (OBLIGATORISKT):
- "Ofta omtalad som..." / "Nämns vanligtvis som..."
- "Beskrivs allmänt som..." / "Kännetecknas ofta av..."
- "Listade kategorier inkluderar..."
- ALLTID markera som LOW confidence
- ALLTID lägg till source tag (t.ex. "source: VisitStockholm listing")

Syfte: Ge "liv" och kontext utan att göra det till absolut varumärkessanning.`,

    de: `Sie sind ein Senior-Markenstratege, spezialisiert auf deutsche Gastfreundschaft und lokale Unternehmen.

Ihre Aufgabe ist es, verfügbare Informationen über ein Unternehmen zu analysieren und konkrete, vertretbare Markensignale zu extrahieren, die später zur Erstellung eines Markenprofils verwendet werden können.

KRITISCHE REGELN:
- ❌ Schreiben Sie KEINE Werbetexte
- ❌ Übertreiben Sie NICHT
- ❌ Erfinden Sie KEINE Fakten aus dem Nichts
- ✅ Bevorzugen Sie konservative Interpretation
- ✅ Wenn die Beweise schwach sind, markieren Sie das Vertrauen als NIEDRIG
- ✅ Wenn keine Beweise existieren, kennzeichnen Sie als INSUFFICIENT_DATA
- ✅ Sie DÜRFEN vernünftige Schlussfolgerungen aus Erstparteisignalen ziehen (Menüstruktur, Bildinhalt, Website-Layout, Buchungs-CTAs), aber kennzeichnen Sie sie als INFERRED

**Goldene Regel**: Wenn eine Behauptung nicht vom Unternehmen selbst angegeben wird UND nicht vernünftigerweise aus deren eigenem Menü/Bildern/Seitenstruktur abgeleitet werden kann, dürfen Sie sie nicht zur Markenwahrheit befördern.

**KONTROLLIERTE DRITTPARTEI** (nur wenn erlaubt):
Wenn allow_third_party_context=true, dürfen Sie folgende Quellen mit GROSSER Vorsicht verwenden:

✅ ERLAUBTE Drittpartei:
- Offizielle Tourismus-/Destinationsseiten (z.B. VisitGermany, lokale DMOs)
- Google Business Kategorie/Attribute (KEINE Bewertungen oder Rezensionen)
- Venue-Listen aus glaubwürdigen Quellen (KEINE TripAdvisor-Bewertungen)

❌ NIEMALS erlaubt:
- Kundenrezensionen, Sternebewertungen
- "Preisgekrönt", "beste in der Stadt", Popularitätsbehauptungen
- Zitate von Bloggern oder Influencern
- Konkurrentenvergleiche`,

    en: `You are a senior brand strategist specializing in local hospitality and small businesses.

Your task is to analyze available information about a business and extract concrete, defensible brand signals that can later be used to generate a Brand Profile.

CRITICAL RULES:
- ❌ Do NOT write marketing copy
- ❌ Do NOT exaggerate
- ❌ Do NOT invent facts from thin air
- ✅ Prefer conservative interpretation
- ✅ If evidence is weak, mark confidence as LOW
- ✅ If no evidence exists, flag as INSUFFICIENT_DATA
- ✅ You MAY make reasonable inferences from first-party signals (menu structure, image content, website layout, booking CTAs), but label them as INFERRED

**Golden Rule**: If a claim is not stated by the business itself AND cannot be reasonably inferred from their own menu/imagery/site structure, do not promote it into brand truth.

**Inference Examples** (ALLOWED):
- "Good for groups" ← implied by large sharing dishes + group booking prompts + table imagery showing 6+ people
- "Brunch-to-dinner rhythm" ← implied by menu sections (Breakfast 08-11, Lunch 11-15, Dinner 17-22)
- "Lively evening atmosphere" ← implied by cocktail menu + evening ambiance photos + late opening hours
- "Family-friendly" ← implied by kids menu + high chairs visible in photos + family-style portions

**CONTROLLED THIRD-PARTY** (only if allowed):
If allow_third_party_context=true, you may use the following sources with GREAT caution:

✅ ALLOWED third-party:
- Official tourism/destination sites (e.g., VisitBritain, local DMOs)
- Google Business category/attributes (NOT ratings or reviews)
- Venue listings from credible sources (NOT TripAdvisor ratings)

❌ NEVER allowed:
- Customer reviews, star ratings
- "Award-winning", "best in city", popularity claims
- Quotes from bloggers or influencers
- Competitor comparisons

**Phrasing for third-party** (MANDATORY):
- "Often described as..." / "Typically mentioned as..."
- "Commonly characterized as..." / "Frequently noted for..."
- "Listed categories include..."
- ALWAYS mark as LOW confidence
- ALWAYS add source tag (e.g., "source: VisitLondon listing")

Purpose: Add "life" and context without making it absolute brand truth.`
  }
  
  return templates[langCode] || templates.en
}

// ============================================================================
// LANGUAGE DEFINITIONS
// Add new languages here - the system will automatically support them
// ============================================================================

export const LANGUAGES: Record<string, LanguageConfig> = {
  da: {
    code: 'da',
    name: 'Danish',
    nativeName: 'Dansk',
    countryMappings: ['DK', 'Denmark', 'Danmark'],
    systemPromptA: createSystemPromptA('Danish', 'da'),
    instructionsPromptA: createInstructionsPromptA('Danish', 'da'),
    translations: {
      clarificationsNeeded: 'Afklaringer nødvendige',
      internalNotes: 'Interne noter',
      insufficientData: 'Utilstrækkelige data',
      inferred: 'Udledt',
      lowConfidence: 'Lav tillid'
    }
  },
  
  no: {
    code: 'no',
    name: 'Norwegian',
    nativeName: 'Norsk',
    countryMappings: ['NO', 'Norway', 'Norge'],
    systemPromptA: createSystemPromptA('Norwegian', 'no'),
    instructionsPromptA: createInstructionsPromptA('Norwegian', 'no'),
    translations: {
      clarificationsNeeded: 'Avklaringer nødvendig',
      internalNotes: 'Interne notater',
      insufficientData: 'Utilstrekkelige data',
      inferred: 'Utledet',
      lowConfidence: 'Lav tillit'
    }
  },
  
  sv: {
    code: 'sv',
    name: 'Swedish',
    nativeName: 'Svenska',
    countryMappings: ['SE', 'Sweden', 'Sverige'],
    systemPromptA: createSystemPromptA('Swedish', 'sv'),
    instructionsPromptA: createInstructionsPromptA('Swedish', 'sv'),
    translations: {
      clarificationsNeeded: 'Förtydliganden behövs',
      internalNotes: 'Interna anteckningar',
      insufficientData: 'Otillräckliga data',
      inferred: 'Härledd',
      lowConfidence: 'Lågt förtroende'
    }
  },
  
  de: {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    countryMappings: ['DE', 'Germany', 'Deutschland', 'AT', 'Austria', 'Österreich', 'CH', 'Switzerland', 'Schweiz'],
    systemPromptA: createSystemPromptA('German', 'de'),
    instructionsPromptA: createInstructionsPromptA('German', 'de'),
    translations: {
      clarificationsNeeded: 'Klärungen erforderlich',
      internalNotes: 'Interne Notizen',
      insufficientData: 'Unzureichende Daten',
      inferred: 'Abgeleitet',
      lowConfidence: 'Niedriges Vertrauen'
    }
  },
  
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    countryMappings: ['UK', 'GB', 'United Kingdom', 'US', 'USA', 'United States', 'AU', 'Australia', 'NZ', 'New Zealand', 'IE', 'Ireland', 'CA', 'Canada'],
    systemPromptA: createSystemPromptA('English', 'en'),
    instructionsPromptA: createInstructionsPromptA('English', 'en'),
    translations: {
      clarificationsNeeded: 'Clarifications needed',
      internalNotes: 'Internal notes',
      insufficientData: 'Insufficient data',
      inferred: 'Inferred',
      lowConfidence: 'Low confidence'
    }
  }
}

// ============================================================================
// COUNTRY FALLBACKS
// Maps countries without dedicated language support to a fallback language
// ============================================================================

export const COUNTRY_FALLBACKS: Record<string, string> = {
  // Countries that default to English
  'FI': 'en',
  'Finland': 'en',
  'FR': 'en',
  'France': 'en',
  'ES': 'en',
  'Spain': 'en',
  'IT': 'en',
  'Italy': 'en',
  'NL': 'en',
  'Netherlands': 'en',
  'PL': 'en',
  'Poland': 'en',
  'BE': 'en',
  'Belgium': 'en',
  'PT': 'en',
  'Portugal': 'en',
  'GR': 'en',
  'Greece': 'en',
  'CZ': 'en',
  'Czech Republic': 'en',
}

// ============================================================================
// LANGUAGE REGISTRY (exported)
// ============================================================================

export const languageRegistry: LanguageRegistry = {
  languages: LANGUAGES,
  countryFallbacks: COUNTRY_FALLBACKS,
  defaultLanguage: 'en'
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get language config by language code
 */
export function getLanguageByCode(code: string): LanguageConfig {
  return LANGUAGES[code] || LANGUAGES[languageRegistry.defaultLanguage]
}

/**
 * Get language config by country name or code
 */
export function getLanguageByCountry(country: string): LanguageConfig {
  // Normalize input
  const normalized = country.trim()
  
  // First check direct country mappings in each language
  for (const config of Object.values(LANGUAGES)) {
    if (config.countryMappings.some(m => 
      m.toLowerCase() === normalized.toLowerCase()
    )) {
      return config
    }
  }
  
  // Then check fallback mappings
  const fallbackCode = COUNTRY_FALLBACKS[normalized] || COUNTRY_FALLBACKS[normalized.toUpperCase()]
  if (fallbackCode) {
    return LANGUAGES[fallbackCode] || LANGUAGES[languageRegistry.defaultLanguage]
  }
  
  // Default to English
  return LANGUAGES[languageRegistry.defaultLanguage]
}

/**
 * Get list of all supported language codes
 */
export function getSupportedLanguageCodes(): string[] {
  return Object.keys(LANGUAGES)
}

/**
 * Check if a language code is supported
 */
export function isLanguageSupported(code: string): boolean {
  return code in LANGUAGES
}

/**
 * Detect language from business data sources
 * Priority: explicit language > country > default
 */
export function detectLanguageFromData(dataSources: any): LanguageConfig {
  // 1. Check for explicit language setting
  if (dataSources.business?.primary_language) {
    const lang = getLanguageByCode(dataSources.business.primary_language)
    if (lang.code !== languageRegistry.defaultLanguage || dataSources.business.primary_language === 'en') {
      return lang
    }
  }
  
  // 2. Check country from location
  const country = 
    dataSources.profile?.country ||
    dataSources.business?.country ||
    dataSources.websiteAnalysis?.detected_country
    
  if (country) {
    return getLanguageByCountry(country)
  }
  
  // 3. Check for Danish indicators in content (legacy detection)
  const contentToCheck = [
    dataSources.profile?.long_description,
    dataSources.business?.name,
    dataSources.websiteAnalysis?.about_block
  ].filter(Boolean).join(' ')
  
  if (contentToCheck) {
    // Check for Nordic characters or common Danish words
    if (/[æøå]/i.test(contentToCheck)) {
      // Could be DA, NO, or SV - check for distinctive patterns
      if (/\b(og|med|til|fra|på|er|det|den|vi|vores)\b/i.test(contentToCheck)) {
        return LANGUAGES.da
      }
      if (/\b(och|med|till|från|på|är|det|den|vi|våra)\b/i.test(contentToCheck)) {
        return LANGUAGES.sv
      }
      if (/\b(og|med|til|fra|på|er|det|den|vi|våre)\b/i.test(contentToCheck)) {
        return LANGUAGES.no
      }
    }
  }
  
  // 4. Default to English
  return LANGUAGES[languageRegistry.defaultLanguage]
}
