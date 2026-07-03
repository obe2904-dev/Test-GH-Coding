/**
 * Behind-the-Scenes Content Examples by Business Type
 *
 * Purpose: Provide concrete, positive examples for BTS post generation.
 * These examples guide the AI toward natural, authentic content instead of
 * relying on proscriptive rules ("don't do X") that often produce awkward output.
 *
 * Philosophy: BTS works best when it shows process, not perfection.
 * The failed recipe attempt, the sold-out board, the imperfect scoop —
 * these perform better than polished content because they feel real.
 *
 * Timing: BTS is brand-building, not footfall-driving.
 * Mid-morning (09:30–10:30) on weekdays works well — coffee-break browsing.
 */

import type { BusinessTypeCode } from '../types/strategy-types.ts';

export interface BTSExample {
  scene: string;           // What's happening (the action)
  tone_hint: string;       // How to write about it
  good_opening: string;    // Example of a natural caption opening
}

export interface BTSExamplesSet {
  code: BusinessTypeCode;
  label_dk: string;
  categories: {
    name: string;
    examples: BTSExample[];
  }[];
  tone_guidance: string;   // Overall tone for this business type's BTS content
}

export const BTS_EXAMPLES: Record<string, BTSExamplesSet> = {

  // ═══════════════════════════════════════════════════════════════════════════
  // FULL-SERVICE CAFÉ & RESTAURANT
  // ═══════════════════════════════════════════════════════════════════════════
  FSE: {
    code: 'FSE',
    label_dk: 'Finere Restaurant',
    tone_guidance: 'Varm og inviterende bag facaden. Vis håndværket uden at skryde.',
    categories: [
      {
        name: 'Køkken',
        examples: [
          {
            scene: 'Kokken tilbereder dagens ret inden service',
            tone_hint: 'Roligt, koncentreret fokus',
            good_opening: 'Kl. 15 begynder forberedelserne til aftenens menu.',
          },
          {
            scene: 'Sauce bliver lavet fra bunden',
            tone_hint: 'Proces og tålmodighed',
            good_opening: 'Tre timer. Det tager tre timer at reducere denne sauce.',
          },
          {
            scene: 'Ugens leverance af friske råvarer ankommer',
            tone_hint: 'Glæde ved kvalitet',
            good_opening: 'Leverancen er lige landet. Asparges fra Lammefjord.',
          },
        ],
      },
      {
        name: 'Team',
        examples: [
          {
            scene: 'Personalet gør klar inden åbning',
            tone_hint: 'Teamwork og rutine',
            good_opening: 'Bordene er dækket, glassene poleret. Vi åbner om ti minutter.',
          },
          {
            scene: 'Fælles morgenmad inden skiftet',
            tone_hint: 'Menneskeligt og varmt',
            good_opening: 'Dagens første opgave: Kaffe til holdet.',
          },
          {
            scene: 'Lukkeritualet — aftørring, stole op',
            tone_hint: 'Ro efter en travl aften',
            good_opening: 'Sidste gæst er gået. Nu er der ro i køkkenet.',
          },
        ],
      },
      {
        name: 'Rum & sæson',
        examples: [
          {
            scene: 'Terrassen bliver sat op den første varme dag',
            tone_hint: 'Forventning og sæsonskifte',
            good_opening: 'Stolene er ude. Det må være forår.',
          },
          {
            scene: 'Julepynten kommer op',
            tone_hint: 'Tradition og hygge',
            good_opening: 'December starter med lysene tændt.',
          },
          {
            scene: 'Tomt lokale lige inden døren åbner',
            tone_hint: 'Stilheden før gæsterne',
            good_opening: 'Kl. 17:58. Alt er klar.',
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // KAFFEBAR / CAFÉ
  // ═══════════════════════════════════════════════════════════════════════════
  SBO_coffee: {
    code: 'SBO_coffee',
    label_dk: 'Kaffebar / Café',
    tone_guidance: 'Personlig, nærværende og håndværksstolt. Som om du fortæller en ven.',
    categories: [
      {
        name: 'Håndværk & proces',
        examples: [
          {
            scene: 'Baristyen indstiller kværnen ved åbning',
            tone_hint: 'Koncentration og precision',
            good_opening: 'Første shot af dagen. Vi justerer til den rammer perfekt.',
          },
          {
            scene: 'Den første espresso trækkes',
            tone_hint: 'Ritual og stolthed',
            good_opening: 'Kl. 7:02. Første espresso er i koppen.',
          },
          {
            scene: 'Mælk dampes — nærbillede af teksturen',
            tone_hint: 'Sanselig og håndværksmæssig',
            good_opening: 'Mikroskummet skal være silkeagtigt. Hver gang.',
          },
          {
            scene: 'Ny pose bønner åbnes og duftes til',
            tone_hint: 'Glæde og nysgerrighed',
            good_opening: 'Ny ankomst fra Guatemala. Det dufter af chokolade og citrus.',
          },
        ],
      },
      {
        name: 'Oprindelse & sourcing',
        examples: [
          {
            scene: 'Ny risteri eller oprindelse introduceres',
            tone_hint: 'Uddannende men tilgængeligt',
            good_opening: 'Denne uge: Single origin fra Etiopien, Yirgacheffe.',
          },
          {
            scene: 'Smagsnoten skrives på tavlen',
            tone_hint: 'Autentisk og konkret',
            good_opening: 'Citrus, blomster, let krop. Det står på tavlen fra i dag.',
          },
          {
            scene: 'Cupping-session med teamet',
            tone_hint: 'Fagligt og fællesskabsorienteret',
            good_opening: 'Vi smager tre nye bønner i dag. Favorit skal findes.',
          },
        ],
      },
      {
        name: 'Rytme & rum',
        examples: [
          {
            scene: 'Det stille øjeblik inden morgenrushet',
            tone_hint: 'Roligt og meditativt',
            good_opening: 'Kl. 7:30. Om lidt kommer alle. Lige nu er der stille.',
          },
          {
            scene: 'Stamkundens ordre laves uden at spørge',
            tone_hint: 'Varmt og anerkendende',
            good_opening: 'Dobbelt flat white. Ingen ord nødvendige.',
          },
          {
            scene: 'Dagens wienerbrød ankommer tidligt om morgenen',
            tone_hint: 'Friskhed og tradition',
            good_opening: 'Bagerens bil kom kl. 6. Nu er disken fuld.',
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VINBAR
  // ═══════════════════════════════════════════════════════════════════════════
  SBO_wine: {
    code: 'SBO_wine',
    label_dk: 'Vinbar',
    tone_guidance: 'Vidende og passioneret, men aldrig snobbet. Del opdagelsesglæden.',
    categories: [
      {
        name: 'Kælder & sourcing',
        examples: [
          {
            scene: 'Ny leverance pakkes ud og logges',
            tone_hint: 'Nysgerrighed og kvalitetsfokus',
            good_opening: 'Pakker fra Bourgogne. Tre kasser, alle nye for os.',
          },
          {
            scene: 'Flasker lægges ned i kælderen',
            tone_hint: 'Omhu og langsigtethed',
            good_opening: 'Denne skal ligge lidt. Vi åbner den om et år.',
          },
          {
            scene: 'Ejeren smager på en netop åbnet flaske',
            tone_hint: 'Ærlighed og personlig vurdering',
            good_opening: 'Første glas fra den nye Riesling. Mineraler og citron.',
          },
          {
            scene: 'En vin der ikke kom med på kortet — og hvorfor',
            tone_hint: 'Ærligt og lærerigt',
            good_opening: 'Denne var tæt på at komme med. Men syre manglede balance.',
          },
        ],
      },
      {
        name: 'Viden & kuratering',
        examples: [
          {
            scene: 'Glaskortet til ugen sammensættes',
            tone_hint: 'Kreativitet og overvejelse',
            good_opening: 'Tre hvide, to røde, en orange. Ugens glas er klar.',
          },
          {
            scene: 'Pairing af vin med en ret på menuen',
            tone_hint: 'Sanselig og konkret',
            good_opening: 'Gruyère og denne Jura-vin. Det er en match.',
          },
          {
            scene: 'Historien bag en lille naturvinsproducent',
            tone_hint: 'Fortællende og personlig',
            good_opening: 'Sophie driver vingården alene. 2 hektar, ingen maskiner.',
          },
        ],
      },
      {
        name: 'Atmosfære',
        examples: [
          {
            scene: 'Glas poleres inden åbning',
            tone_hint: 'Forberedelse og kvalitet',
            good_opening: 'Glassene skal være plettfrie. Det tager tyve minutter.',
          },
          {
            scene: 'Stearinlys tændes, musik sættes på — fem minutter før gæster',
            tone_hint: 'Stemning og forventning',
            good_opening: 'Musik på, lys tændt. Første gæst er på vej.',
          },
          {
            scene: 'En rolig tirsdag med to stamgæster ved baren',
            tone_hint: 'Intimitet og fællesskab',
            good_opening: 'Tirsdag aften. To gæster, tre glas, god snak.',
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BAGERI / KONDITORI
  // ═══════════════════════════════════════════════════════════════════════════
  BAKERY: {
    code: 'BAKERY',
    label_dk: 'Bageri / Konditori',
    tone_guidance: 'Tidligt oppe, hårdt arbejde, stolthed over håndværk. Varmt og autentisk.',
    categories: [
      {
        name: 'Tidlig morgen-bagning',
        examples: [
          {
            scene: 'Dej formes kl. 05:00',
            tone_hint: 'Ægte og arbejdsomt',
            good_opening: 'Kl. 5. Dejen er klar til at blive formet.',
          },
          {
            scene: 'Ovndør åbner — damp og gylden skorpe',
            tone_hint: 'Sanselig og appetitlig',
            good_opening: 'Ud af ovnen. Den duft kan ikke beskrives.',
          },
          {
            scene: 'Bakker med kanelsnegle køler af på stativet',
            tone_hint: 'Tilfredsstillende og indbydende',
            good_opening: 'Tredive kanelsnegle. Alle perfekte. Næsten.',
          },
          {
            scene: 'Bagerens hænder melet',
            tone_hint: 'Autentisk håndværk',
            good_opening: 'Mel på hænderne, dej under neglene. Sådan ser det ud.',
          },
        ],
      },
      {
        name: 'Håndværk & teknik',
        examples: [
          {
            scene: 'Croissantdej lamineres — foldesekvensen',
            tone_hint: 'Teknisk og imponerende',
            good_opening: '27 lag smør. Det er forskellen på en croissant og en bolle.',
          },
          {
            scene: 'Creme sprøjtes på lagkage',
            tone_hint: 'Præcision og skønhed',
            good_opening: 'Sidste lag creme. Så er den klar.',
          },
          {
            scene: 'Scoring af brød inden ovn',
            tone_hint: 'Rituelt og fagligt',
            good_opening: 'Et snit med kniven. Det afgør hvordan brødet åbner sig.',
          },
          {
            scene: 'Test af ny opskrift — første forsøg vs. endelig version',
            tone_hint: 'Ærligt om processen',
            good_opening: 'Første forsøg til venstre. Sjette forsøg til højre. Nu er den god.',
          },
        ],
      },
      {
        name: 'Sæson & særligt',
        examples: [
          {
            scene: 'Årets første fastelavnsboller laves',
            tone_hint: 'Tradition og sæson',
            good_opening: 'Fastelavnsbollerne er i gang. Det er næsten for tidligt. Næsten.',
          },
          {
            scene: 'Jordbærtærte samles i juni',
            tone_hint: 'Sæsonglæde',
            good_opening: 'Danske jordbær. Vi har ventet på dem.',
          },
          {
            scene: 'Udsolgt-skiltet sættes op — og hvad der solgte først',
            tone_hint: 'Popularitet og ægthed',
            good_opening: 'Udsolgt kl. 10. Rugbrødene gik først.',
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COCKTAILBAR
  // ═══════════════════════════════════════════════════════════════════════════
  SBO_cocktail: {
    code: 'SBO_cocktail',
    label_dk: 'Cocktailbar',
    tone_guidance: 'Kreativt, sanselig og ærligt om håndværket. Vis fejlene også.',
    categories: [
      {
        name: 'Bar-håndværk',
        examples: [
          {
            scene: 'Bartender bygger en ny cocktail — iterationer',
            tone_hint: 'Eksperimenterende og ærligt',
            good_opening: 'Tredje forsøg. Denne gang med mindre lime.',
          },
          {
            scene: 'Hjemmelavet sirup eller shrub tilberedes',
            tone_hint: 'Håndværk og tid',
            good_opening: 'Hindbærsirup. Fire timer. Værd at vente på.',
          },
          {
            scene: 'Is skæres og formes i hånden',
            tone_hint: 'Præcision og kvalitet',
            good_opening: 'En isblok, en kniv. Ti minutter for én perfekt terning.',
          },
          {
            scene: 'Garniture-prep — dehydreret citrus, brændt sukker',
            tone_hint: 'Detaljer og omsorg',
            good_opening: 'Citrusskiver i ovnen i fire timer. Garniture kræver tålmodighed.',
          },
          {
            scene: 'Et fejlet opskriftsforsøg — ærligt og sjovt',
            tone_hint: 'Selvironisk og menneskelig',
            good_opening: 'Denne virkede ikke. For meget røg. Tilbage til tegnebrættet.',
          },
        ],
      },
      {
        name: 'Ingredienser & sourcing',
        examples: [
          {
            scene: 'Ny spiritus ankommer — næse og førstehåndsindtryk',
            tone_hint: 'Nysgerrig og sanselig',
            good_opening: 'Ny mezcal fra Oaxaca. Røg og frugt. Vi tester den i aften.',
          },
          {
            scene: 'Lokal sanket ingrediens inkorporeres',
            tone_hint: 'Kreativt og lokalt',
            good_opening: 'Hyldeblomsterne kom i går. Nu bliver de til sirup.',
          },
          {
            scene: 'To brands sammenlignes til en ny signaturdrink',
            tone_hint: 'Fagligt og nysgerrigt',
            good_opening: 'Gin A eller Gin B? Vi smager os frem.',
          },
        ],
      },
      {
        name: 'Mennesker & ritual',
        examples: [
          {
            scene: 'Bar-setup ritual — mise en place til aftenen',
            tone_hint: 'Forberedelse og fokus',
            good_opening: 'Hver ting på sin plads. Sådan starter aftenen.',
          },
          {
            scene: 'Teamet smager den nye menu inden lancering',
            tone_hint: 'Deling og teamwork',
            good_opening: 'Ny menu i morgen. I aften smager vi den sammen.',
          },
          {
            scene: 'Stamkundens ordre laves uden at spørge',
            tone_hint: 'Genkendelse og varme',
            good_opening: 'Negroni, stor is, ekstra bitter. Han behøvede ikke sige noget.',
          },
          {
            scene: 'Sidste drink en sen lørdag nat',
            tone_hint: 'Afslutning og ro',
            good_opening: 'Kl. 01:47. Sidste drink går ud. God aften derude.',
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TAKEAWAY & FAST CASUAL
  // ═══════════════════════════════════════════════════════════════════════════
  QSR: {
    code: 'QSR',
    label_dk: 'Takeaway & Fast Casual',
    tone_guidance: 'Energisk, ærlig og stolt af volumen og hastighed. Real talk.',
    categories: [
      {
        name: 'Fart & volumen',
        examples: [
          {
            scene: 'Prep-teamet bygger 50 portioner inden kl. 11',
            tone_hint: 'Imponerende og effektiv',
            good_opening: 'Kl. 10:30. Halvtreds portioner klar. Vi er klar til rush.',
          },
          {
            scene: 'Frokostrushet set fra bag disken',
            tone_hint: 'Energi og stolthed',
            good_opening: 'Køen går ud på gaden. Vi holder tempoet.',
          },
          {
            scene: 'Pakning af ordre — effektivt og tilfredsstillende',
            tone_hint: 'Rutine og præcision',
            good_opening: 'Tre ordrer på to minutter. Systemet virker.',
          },
        ],
      },
      {
        name: 'Ingredienser',
        examples: [
          {
            scene: 'Friske råvarer ankommer og prepes',
            tone_hint: 'Kvalitet bag hastigheden',
            good_opening: 'Salatbladene kom for en time siden. Friskere bliver det ikke.',
          },
          {
            scene: 'Sauce lavet in-house — ikke fra krukke',
            tone_hint: 'Stolthed over kvalitet',
            good_opening: 'Saucen? Hjemmelavet. Hver dag. Ingen undtagelser.',
          },
          {
            scene: 'Hvad der går i signatur-retten — dekonstrueret',
            tone_hint: 'Transparent og indbydende',
            good_opening: 'Syv ingredienser. Alle friske. Det er vores signature.',
          },
        ],
      },
      {
        name: 'Mennesker',
        examples: [
          {
            scene: 'Teamet spiser deres egen mad i pausen',
            tone_hint: 'Ærligt og menneskeligt',
            good_opening: 'Pausetid. Vi spiser det samme som I gør.',
          },
          {
            scene: 'Ejeren laver mad sammen med teamet på en travl dag',
            tone_hint: 'Hands-on og fællesskab',
            good_opening: 'Fuld fart i dag. Så står chefen også ved grillen.',
          },
          {
            scene: 'Fredag eftermiddag efter en hel uge',
            tone_hint: 'Ro og tilfredsstillelse',
            good_opening: 'Fredag kl. 16. Ugen er overstået. Vi nåede det.',
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FOOD TRUCK
  // ═══════════════════════════════════════════════════════════════════════════
  FOOD_TRUCK: {
    code: 'FOOD_TRUCK',
    label_dk: 'Food Truck',
    tone_guidance: 'Eventyrlysten, fleksibel og stolt af friheden. Street-smart og ægte.',
    categories: [
      {
        name: 'On the road',
        examples: [
          {
            scene: 'Trucken køres til dagens spot',
            tone_hint: 'Eventyr og forventning',
            good_opening: 'Motoren starter. I dag: Aarhus Havn kl. 11.',
          },
          {
            scene: 'Setup på ny lokation',
            tone_hint: 'Rutine og effektivitet',
            good_opening: 'Ti minutter til vi er klar. Disken er åben.',
          },
          {
            scene: 'Udsigt fra trucken til køen',
            tone_hint: 'Stolthed og energi',
            good_opening: 'Kø til hjørnet. Sådan ser det ud fra vores side.',
          },
        ],
      },
      {
        name: 'Håndværk i det små',
        examples: [
          {
            scene: 'Prep i et lille køkken — pladsmangel som udfordring',
            tone_hint: 'Kreativitet under begrænsninger',
            good_opening: 'Fire kvadratmeter køkken. Alt hvad vi behøver.',
          },
          {
            scene: 'Signatur-retten samles fra start til slut',
            tone_hint: 'Stolthed over produktet',
            good_opening: 'Ti sekunder fra grill til kunde. Friskere kan det ikke blive.',
          },
        ],
      },
      {
        name: 'Fællesskab & events',
        examples: [
          {
            scene: 'Stamkunden der finder trucken på ny lokation',
            tone_hint: 'Varmt og anerkendende',
            good_opening: 'Han fandt os igen. Tredje lokation denne uge.',
          },
          {
            scene: 'Dagen efter et marked eller festival',
            tone_hint: 'Træt men tilfreds',
            good_opening: '400 portioner i går. I dag: Hvile.',
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MULTI-FORMAT / HYBRID (used for café+restaurant+bar like Cafe Faust)
  // ═══════════════════════════════════════════════════════════════════════════
  MFV: {
    code: 'MFV',
    label_dk: 'Café, Restaurant & Bar',
    tone_guidance: 'Varm og inkluderende. Vis overgangene mellem dagens faser.',
    categories: [
      {
        name: 'Overgange',
        examples: [
          {
            scene: 'Brunch-setup der skifter til frokost',
            tone_hint: 'Flydende og naturligt',
            good_opening: 'Brunch er slut. Frokostmenuen overtager.',
          },
          {
            scene: 'Eftermiddagen skifter til aften-stemning',
            tone_hint: 'Forandring og atmosfære',
            good_opening: 'Kl. 17. Lysene dæmpes. Vi gør klar til aften.',
          },
          {
            scene: 'Første cocktail efter middagen',
            tone_hint: 'Feststemning begynder',
            good_opening: 'Desserten er spist. Nu starter baren.',
          },
        ],
      },
      {
        name: 'Køkken',
        examples: [
          {
            scene: 'Brunch-forberedelse tidligt om morgenen',
            tone_hint: 'Energi og forventning',
            good_opening: 'Kl. 7. Æggene koges, avocadoen skæres. Brunch-holdet er i gang.',
          },
          {
            scene: 'Skifte mellem frokost- og aftenmenuen',
            tone_hint: 'Professionelt og organiseret',
            good_opening: 'Kl. 15. Frokostkortet ned, aftenkortet op.',
          },
        ],
      },
      {
        name: 'Rum & mennesker',
        examples: [
          {
            scene: 'Morgensol på terrassen',
            tone_hint: 'Frisk og indbydende',
            good_opening: 'Morgensol på bordene. Brunch-gæsterne begynder at komme.',
          },
          {
            scene: 'Baren gøres klar efter lukketid for køkkenet',
            tone_hint: 'Afslappet og socialt',
            good_opening: 'Køkkenet er lukket. Baren har åbent til sent.',
          },
          {
            scene: 'Stamgæst der kender alle skift',
            tone_hint: 'Varmt og anerkendende',
            good_opening: 'Hun starter med brunch og slutter med et glas. Hun kender rytmen.',
          },
        ],
      },
    ],
  },

  // Alias for SBO (general specialty)
  SBO: {
    code: 'SBO',
    label_dk: 'Specialforretning',
    tone_guidance: 'Passion og håndværk. Del entusiasmen uden at virke snobbet.',
    categories: [
      {
        name: 'Håndværk',
        examples: [
          {
            scene: 'Forberedelse til dagens service',
            tone_hint: 'Fokus og rutine',
            good_opening: 'Alt er på plads. Vi er klar til at åbne.',
          },
          {
            scene: 'Ny vare eller produkt pakkes ud',
            tone_hint: 'Glæde og nysgerrighed',
            good_opening: 'Leverancen er her. Der er noget nyt i kassen.',
          },
        ],
      },
      {
        name: 'Atmosfære',
        examples: [
          {
            scene: 'Det stille øjeblik inden gæsterne kommer',
            tone_hint: 'Ro og forventning',
            good_opening: 'Om fem minutter åbner vi. Lige nu er der stille.',
          },
          {
            scene: 'Stamkunde ankommer',
            tone_hint: 'Genkendelse og varme',
            good_opening: 'Han kommer hver dag. Vi ved hvad han vil have.',
          },
        ],
      },
    ],
  },
};

/**
 * Get BTS examples for a business type, with fallback to generic SBO
 */
export function getBTSExamples(businessType: string): BTSExamplesSet {
  return BTS_EXAMPLES[businessType] || BTS_EXAMPLES['SBO'];
}

/**
 * Get random examples from a specific category for prompt injection
 */
export function getRandomBTSExamples(
  businessType: string,
  count: number = 3
): BTSExample[] {
  const set = getBTSExamples(businessType);
  const allExamples = set.categories.flatMap(cat => cat.examples);
  
  // Shuffle and take first N
  const shuffled = allExamples.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Build a prompt segment with BTS examples for the AI
 */
export function buildBTSExamplesPrompt(businessType: string): string {
  const set = getBTSExamples(businessType);
  const examples = getRandomBTSExamples(businessType, 4);
  
  const exampleLines = examples.map(ex => 
    `• Scene: "${ex.scene}" → Åbning: "${ex.good_opening}"`
  ).join('\n');
  
  return `
═══════════════════════════════════════════════════════════════════════════
📸 BEHIND-THE-SCENES EKSEMPLER (${set.label_dk})
═══════════════════════════════════════════════════════════════════════════
TONE: ${set.tone_guidance}

KONKRETE EKSEMPLER PÅ GODE ÅBNINGER:
${exampleLines}

VIGTIGE PRINCIPPER:
• BTS viser PROCES, ikke perfektion — det ufærdige og ægte performer bedst
• Start med en KONKRET handling eller tidspunkt — aldrig abstrakt stemning
• Personalet og arbejdet er i fokus — ikke møbler eller inventar
• Brug korte, direkte sætninger — som om du fortæller en ven

FORBUDT:
• "Vi glæder os til..." (reklame-sprog)
• At lade fysiske ting være sætningssubjekt ("Vinduerne bader rummet i lys")
• Abstrakte stemningsord uden forankring ("atmosfære", "oplevelse", "magi")
`.trim();
}
