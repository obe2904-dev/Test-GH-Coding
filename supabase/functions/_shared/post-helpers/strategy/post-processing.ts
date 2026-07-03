/**
 * POST-PROCESSING: Remove consultant-speak from AI-generated text.
 * Safety net for when prompts don't fully prevent jargon.
 */

// ============================================================
// SINGLE STRING CLEANER
// ============================================================

export function cleanTextForConsultantSpeak(text: string): string {
  const consultantPhrases: Record<string, string> = {
    // === FALSE PERFORMANCE CLAIMS ===
    'performer konsekvent godt i koldt vejr': 'passer godt til koldt vejr',
    'performer bedst i koldt vejr': 'passer godt til koldt vejr',
    'konsekvent driver salg': 'passer til vejret',
    'driver direkte salg': 'viser konkret tilbud',
    'dokumenteret høj konvertering': 'høj genkendelse',
    'dokumenteret performance': 'etableret på menuen',
    'proven performance': 'kendt på menuen',
    'høj gentagelseskøb': 'høj genkendelse',
    'performer godt': 'passer godt',

    // === META-FRAMEWORK LANGUAGE ===
    'vores content mix sikrer en balance mellem salgsdrivende produkt-posts og relationsbyggende oplevelses-posts': 'vi viser både konkrete retter og caféens stemning',
    'content mix sikrer balance mellem salgsdrivende produkt-posts og relationsbyggende oplevelses-posts': 'vi kombinerer menu-posts med stemnings-posts',
    'designet til at ramme vores content mix mål på': 'planlægger',
    'er designet til at ramme': 'kombinerer',
    'sikrer både konvertering og styrkelse af vores brandrelation': 'giver salg og bygger relation',
    'hvilket giver et ægte brand, der konverterer': '',
    'hvilket giver et ægte brand der konverterer': '',

    // === BAD ENGLISH→DANISH TRANSLATIONS ===
    'trøstende klassikere': 'varme klassikere',
    'trøstende populære retter': 'varme retter',
    'trøstende måltider': 'varme måltider',
    'trøstende retter': 'varme retter',
    'salgsdrivende produkt-posts': 'posts der driver salg',
    'salgsdrivende posts': 'posts der driver salg',
    'relationsbyggende oplevelses-posts': 'posts der bygger relation',
    'relationsbyggende indhold': 'indhold der bygger relation',
    'skræddersyet til at imødekomme': 'passer til',
    'er skræddersyet til': 'passer til',

    // === Phrases (longer patterns FIRST) ===
    'positionere sig som det ultimative sted': 'være det bedste sted',
    'positionere os som det ultimative sted': 'være det bedste sted',
    'positionere café faust som det ultimative sted': 'gøre Café Faust til det bedste sted',
    'går ud over blot at servere mad': 'mere end bare mad',
    'transformere vinterkulden til en autentisk og indbydende oplevelse': 'gøre kulden til en hyggelig oplevelse',
    'transformere kulden til en autentisk oplevelse': 'gøre kulden til hygge',
    'uovertruffen evne til at': 'virkelig god til at',
    'uovertruffen evne til': 'virkelig god til',
    'autentisk og indbydende oplevelse': 'hyggelig oplevelse',
    'autentisk oplevelse': 'ægte stemning',
    'indbydende oplevelse': 'hyggelig stemning',
    'vi skaber hyggelige indendørs oplevelser': 'hyggelig indendørs stemning',
    'skaber hyggelige indendørs oplevelser': 'hyggelig indendørs stemning',
    'inviterer indenfor til gode oplevelser': 'byder på hygge',
    'inviterer indenfor til': 'byder på',
    'gode oplevelser': 'hygge',
    'undslippe kulden': 'komme i varmen',
    'sociale spiseoplevelser': 'at spise sammen',
    'fokus vil være på at': 'vi',
    'lægger vægt på': 'fokuserer på',
    'fokuserer på at fremvise': 'viser',
    'driver efterspørgslen': 'passer godt',
    'driver efterspørgsel': 'passer godt',
    'appellerer til': 'passer til',
    'vores kerneydelser': 'det vi er bedst til',
    'vores faste tilbud': 'det vi er bedst til',
    'stærke kort': 'bedste retter',
    'er ideel til': 'er perfekt til',
    'er ideelt til': 'er perfekt til',
    'er afgørende i': 'er vigtig i',

    // === Verbs ===
    'transformere': 'gøre om til',
    'transformerer': 'gør om til',
    'positionere': 'vise',
    'positionerer': 'viser',
    'skaber': 'giver',
    'understøtter': 'passer til',
    'fremhæver': 'viser',
    'fremviser': 'viser',
    'fremvise': 'vise',
    'tiltrækker': 'lokker',
    'kommunikerer': 'siger',
    'understreger': 'viser',
    'faciliterer': 'gør det muligt',
    'facilitere': 'gøre muligt',
    'syntetiserer': 'blander',
    'syntetisere': 'blande',
    'eksekverer': 'laver',
    'eksekvere': 'lave',
    'maksimerer': 'får mest ud af',
    'maksimere': 'få mest ud af',
    'optimerer': 'forbedrer',
    'optimere': 'forbedre',

    // === Adjectives ===
    'uovertruffen': 'rigtig god',
    'uovertrufne': 'rigtig gode',
    'afgørende': 'vigtig',
    'essentiel': 'vigtig',
    'essentielt': 'vigtigt',
    'ideel': 'perfekt',
    'ideelt': 'perfekt',
    'ideelle': 'perfekte',
    'autentisk': 'ægte',
    'autentiske': 'ægte',
    'indbydende': 'hyggelig',
    'hjertevarmende': 'varm',
    'mættende': 'god',

    // === Nouns ===
    'kerneydelser': 'det vi er bedst til',
    'tilflugtssted': 'sted',
    'ritualfølelse': 'vane',
    'signaturretter': 'velkendte retter',

    // === First-person register (business voice) ===
    'gør os til en aktivt valgt destination': 'tiltrækker planlagte besøg',
    'gør os til et aktivt valgt sted': 'tiltrækker planlagte besøg',
    'gør os til den foretrukne destination': 'er den foretrukne destination',
    'gør os til': 'er',
    'giver os mulighed for': 'giver mulighed for',

    // === Input-label echo (field headers echoed into output) ===
    'driftsprogrammer:': '',
    'driftsprogram fra': 'åbent fra',
    'driftsprogrammet fra': 'åbent fra',
    'driftsprogrammet': 'dagsdels-spændet',
    'driftsprogrammer': 'dagsdels-spændet',
    'driftsprogram': 'dagsdels-spændet',

    // === Morphological ban-evasion (conjugated variants of banned phrases) ===
    'aktivt valgt destination': 'planlagte besøg',
    'aktivt valgte destination': 'planlagte besøg',
    'aktivt valg': 'planlagte besøg',
    'aktivt destinationsvalg': 'planlagte besøg',

    // === Invented consultant nouns ===
    'standardformatet': 'det gennemsnitlige tilbud',
    'standardformat': 'gennemsnitlig oplevelse',
  };

  const sortedEntries = Object.entries(consultantPhrases)
    .sort(([a], [b]) => b.length - a.length);

  let cleaned = text;
  sortedEntries.forEach(([bad, good]) => {
    cleaned = cleaned.replace(new RegExp(bad, 'gi'), good);
  });

  // Stem-level regex: catches conjugated/declined variants that evade exact-string matching
  // "salen" = theater/cinema vocabulary. In a hospitality context it should be "lokalet".
  // Exception: compound words like "selskabssalen" or "festsalen" are legitimate venue-specific names
  // and are preserved (the negative lookahead \w+ catches them).
  cleaned = cleaned.replace(/\b(?<!\w)salen\b(?!\w)/gi, 'lokalet');
  cleaned = cleaned.replace(/\baktivt\s+valgt\w*\s+destination\w*\b/gi, 'planlagte besøg');
  cleaned = cleaned.replace(/\bdriftsprogramm\w*\b(?:\s*:)?/gi, m => m.trimEnd().endsWith(':') ? '' : 'dagsdels-spændet');
  cleaned = cleaned.replace(/\bstandardformat\w*\b/gi, 'det gennemsnitlige tilbud');

  // Generic seasonal phrases: strip when no specific ingredient name appears in the same sentence.
  // "sæsonens grønt" without a concrete name is geographically unverifiable and often wrong.
  const SEASONAL_GENERIC_PATTERN = /sæsonens\s+grønt|sæsonens\s+råvarer|sæsonens\s+ingredienser|hvad\s+sæsonen\s+byder\s+på|friske\s+sæsoningredienser|sæsonens\s+bedste|sæsonens\s+friske|lokale\s+sæsonvarer/gi;
  // Split into sentences, strip the phrase from sentences that don't also contain a specific food noun
  const FOOD_NOUN_PATTERN = /\b(asparges|ramsløg|jordbær|hindbær|blåbær|tomater|agurk|spinat|ærter|majs|svampe|græskar|blommer|pærer|æbler|vildand|vildsvin|kål|rodfrugter|selleri|porrer|zucchini|figner|nye kartofler|blommetomater)\b/i;
  cleaned = cleaned.replace(/[^.!?]*[.!?]/g, sentence =>
    SEASONAL_GENERIC_PATTERN.test(sentence) && !FOOD_NOUN_PATTERN.test(sentence)
      ? sentence.replace(SEASONAL_GENERIC_PATTERN, '').replace(/\s{2,}/g, ' ').trim()
      : sentence
  );

  return cleaned;
}

// ============================================================
// FULL OUTPUT POST-PROCESSOR
//
// Recursive deep-clean: traverses the entire output object and applies
// cleanTextForConsultantSpeak to every string that is narrative prose.
//
// Structural keys (IDs, codes, URLs, enums) and non-prose values are
// preserved as-is. This means any field added to the output schema in
// the future is automatically covered without touching this function.
// ============================================================

// Keys whose values are always structural (identifiers, codes, enums, URLs).
// Only structural semantics here — not content words. This list should barely grow.
const STRUCTURAL_KEY_RE = /^(id|slug|url|href|date|time|version|type|status|country|platform|_)/i;

function isStructuralValue(value: string): boolean {
  // ISO date (2026-04-20) or ISO datetime
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return true;
  // All-uppercase alphanumeric (enum tokens like 'HIGH', 'DK', 'drive_footfall' is lowercase so safe)
  if (/^[A-Z0-9_]+$/.test(value) && value.length <= 30) return true;
  // Too short to be prose, or single-word (no space)
  if (value.length < 12 || !value.includes(' ')) return true;
  return false;
}

function deepClean(value: unknown, key?: string): unknown {
  if (typeof value === 'string') {
    if (key && STRUCTURAL_KEY_RE.test(key)) return value;
    if (isStructuralValue(value)) return value;
    return cleanTextForConsultantSpeak(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepClean(item, key));
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = deepClean(v, k);
    }
    return result;
  }
  return value;
}

// ============================================================
// COMPETITIVE ADVANTAGE VALIDATOR
//
// Checks that competitive_advantage contains at least one token
// that actually varies week-to-week: a digit (temperature, %),
// a specific day name, or an economic signal word.
// Prompt-level TEST 3 is insufficient alone because models wrap
// static claims in temporal markers ("netop denne uges rytme")
// that satisfy the spirit-reading of the test without containing
// any variable data. This is a structural post-generation check.
// ============================================================
const DK_DAY_NAMES = /\b(mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag|weekenden|hverdagene)\b/i;
const VARIABLE_TOKEN_RE = /\d|%|°|DK_DAY_NAMES|\b(lønningsuge|løndag|payday)\b/i;
const BANNED_TEMPORAL_MARKERS = /\b(netop denne uges rytme|matcher ugens profil|passer til denne uge|matcher denne uges|netop denne uge er relevant)\b/i;

function hasVariableToken(text: string): boolean {
  return /\d/.test(text) || /%/.test(text) || /°/.test(text) ||
    DK_DAY_NAMES.test(text) ||
    /\b(lønningsuge|løndag|payday)\b/i.test(text);
}

export function validateCompetitiveAdvantage(brief: any): void {
  const ca: string = brief?.competitive_advantage ?? '';
  if (!ca) return;
  if (BANNED_TEMPORAL_MARKERS.test(ca)) {
    console.warn(
      `[PostProcess] competitive_advantage contains banned temporal marker (static claim wrapped in temporal language): "${ca.substring(0, 120)}"`
    );
  }
  if (!hasVariableToken(ca)) {
    console.warn(
      `[PostProcess] competitive_advantage has no variable token (digit/°/%/day name/lønningsuge). ` +
      `Sentence is likely week-invariant: "${ca.substring(0, 120)}"`
    );
  }
}

export function postProcessConsultantSpeak(raw: any): any {
  const cleaned = deepClean(raw) as any;
  // Validate Phase 1 output if it contains a strategic_brief
  if (cleaned?.competitive_advantage) validateCompetitiveAdvantage(cleaned);
  if (cleaned?.strategic_brief?.competitive_advantage) validateCompetitiveAdvantage(cleaned.strategic_brief);
  return cleaned;
}
