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
  cleaned = cleaned.replace(/\baktivt\s+valgt\w*\s+destination\w*\b/gi, 'planlagte besøg');
  cleaned = cleaned.replace(/\bdriftsprogramm\w*\b(?:\s*:)?/gi, m => m.trimEnd().endsWith(':') ? '' : 'dagsdels-spændet');
  cleaned = cleaned.replace(/\bstandardformat\w*\b/gi, 'det gennemsnitlige tilbud');

  return cleaned;
}

// ============================================================
// FULL OUTPUT POST-PROCESSOR
// ============================================================

export function postProcessConsultantSpeak(raw: any): any {
  if (raw.narrative) {
    if (raw.narrative.overview) {
      raw.narrative.overview = cleanTextForConsultantSpeak(raw.narrative.overview);
    }
    if (raw.narrative.headline) {
      raw.narrative.headline = cleanTextForConsultantSpeak(raw.narrative.headline);
    }
    if (raw.narrative.detailed_sections) {
      Object.keys(raw.narrative.detailed_sections).forEach(section => {
        const value = raw.narrative.detailed_sections[section];
        if (typeof value === 'string') {
          raw.narrative.detailed_sections[section] = cleanTextForConsultantSpeak(value);
        }
      });
    }
  }

  if (raw.strategic_priorities) {
    raw.strategic_priorities.forEach((priority: any) => {
      if (priority.rationale) {
        priority.rationale = cleanTextForConsultantSpeak(priority.rationale);
      }
    });
  }

  if (raw.post_ideas) {
    raw.post_ideas.forEach((idea: any) => {
      if (idea.title) {
        idea.title = cleanTextForConsultantSpeak(idea.title);
      }
      if (idea.rationale) {
        idea.rationale = cleanTextForConsultantSpeak(idea.rationale);
      }
    });
  }

  return raw;
}
