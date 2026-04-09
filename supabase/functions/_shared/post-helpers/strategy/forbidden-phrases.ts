/**
 * SHARED FORBIDDEN PHRASES
 *
 * Single source of truth for banned words/phrases across all prompt phases.
 * Phase 1 and Phase 2b import this so updates are consistent everywhere.
 *
 * Usage in prompts:
 *   import { buildForbiddenBlock } from './forbidden-phrases.ts';
 *   ...
 *   ${buildForbiddenBlock()}
 *
 * Phase 1 usage (brief/strategy text):
 *   ${buildForbiddenBlock('brief')}
 *
 * Phase 2b usage (post title/rationale/captions/hashtags):
 *   ${buildForbiddenBlock('post')}
 *
 * The 'brief' variant adds hygge exception (brand profile) and DB-word block.
 * The 'post' variant adds hashtag and caption-specific bans.
 * Calling without argument returns the shared core block only.
 */

const CORE_BANNED_PHRASES = [
  // Cliché sentiment / lifestyle
  '"foråret er på vej"',
  '"folk vil forkæle sig selv"',
  '"forkælelse"',
  '"hyggelige rammer"',
  '"den perfekte ramme"',
  '"noget for enhver"',
  '"noget for alle"',
  '"indbydende atmosfære"',
  '"autentisk oplevelse"',
  '"lokal perle"',
  '"socialt samvær"',
  '"godt selskab"',
  '"giv dig selv lov"',
  '"tag chancen"',
  // Hygge cluster
  '"hygge"',
  '"hyggelig"',
  '"hyggelige"',
  '"hyggefølelse"',
  '"hyggepause"',
  '"#hygge"',
  '"#fredagshygge"',
  '"#WeekendVibes"',
  // Indoor refuge / shelter framing
  '"fristed fra vejret"',
  '"fristed"',
  '"oase"',
  '"indendørs oase"',
  '"trækker folk ind"',
  '"pusterum"',
  '"i læ for vejret"',
  '"i ly for vejret"',
  '"læ mod vejret"',
  // Abstract occasion language
  '"oplagt valg"',
  '"er et oplagt valg"',
  '"oplagt udflugtsmål"',
  '"oplagt destination"',
  '"inviterer til"',
  '"aktivt valg"',
  '"aktivt destinationsvalg"',
  '"anledningsbesøg"',
  '"destinationsbesøg"',
  '"destination for"',
  // Generic ambience
  '"afslappet aften"',
  '"afslappet stemning"',
  '"skøn aften"',
  '"skønt selskab"',
  // Brand-speak / dedikation
  '"det viser vores dedikation"',
  '"viser vores dedikation"',
  '"den ægte start"',
  '"god oplevelse fra morgenstunden"',
  '"starter ugen rigtigt"',
];

const DB_TECH_WORDS_BLOCK = `TEKNISKE DATABASE-ORD (må ALDRIG optræde i output — omsæt til konkret dansk ejervendt sprog i stedet):
  "hybrid" · "hybridformat" · "hybridmodel" · "day-to-evening" · "day-to-evening format" · "treat-oplevelse"
  Brug i stedet det konkrete dagsdels-span fra Driftsprogrammer, fx "fra brunch og frokost til aftensmenu" eller "fra formiddag til aften"
Hvis en sætning bruger disse ord uden at knytte dem direkte til et konkret faktum fra brand profile eller kontekst, er den ugyldig.`;

const FIRST_PERSON_RULE = `PERSPEKTIV-REGEL (gælder title, rationale og captions): Skriv OM forretningen og dens gæster — ikke SOM forretningen.
  FORBUDT første-person i alle felter: "vi" · "vores" · "os" — brug i stedet "[Forretningsnavn]", "stedet", "køkkenet", "menuen", eller passiv konstruktion.`;

const LOCATION_FRAMING_RULE = `LOCATION-FRAMING (gælder title, rationale og captions):
  ✗ FORBUDT som dekorativt suffix: "frokostpause ved [sted]", "beliggenhed ved [sted]", "stunder ved [sted]", "aften ved åen", "brunch ved åen" — stedsnavnet som lukkeformel uden argumentation
  ✗ FORBUDT som shelter-framing: "i læ for vejret", "i ly for vejret", "læ mod vejret"
  ✓ KORREKT brug: bring lokationen kun frem når det er det konkrete valg-argument — "placeringen ved [sted] giver et møde- og destinationsargument" — ellers udelad det helt`;

/**
 * Returns the shared forbidden-phrase block for use in prompts.
 *
 * @param variant  'brief' — for Phase 1 (includes hygge brand-profile exception + DB-word block)
 *                 'post'  — for Phase 2b (includes hashtags/caption bans + location/first-person rules)
 *                 omit    — core list only
 */
export function buildForbiddenBlock(variant?: 'brief' | 'post'): string {
  const phraseLines = CORE_BANNED_PHRASES.join(' · ');

  if (variant === 'brief') {
    return `FORBUDTE VENDINGER (må ALDRIG forekomme i noget felt — ikke engang delvist):
  ${phraseLines}
  "hygge" · "hyggelig" · "hyggelige" · "hyggefølelse" · "hyggepause" (med mindre ordet optræder i virksomhedens egen brand profile)
  "friske sæsoningredienser" (med mindre ingredienserne fremgår af Menustøttede sæsonråvarer)
${DB_TECH_WORDS_BLOCK}`;
  }

  if (variant === 'post') {
    return `FORBUDTE VENDINGER (må ALDRIG optræde i noget felt — hverken title, rationale, captions eller hashtags):
  ${phraseLines}
${FIRST_PERSON_RULE}
${LOCATION_FRAMING_RULE}`;
  }

  // Core only
  return `FORBUDTE VENDINGER:\n  ${phraseLines}`;
}
