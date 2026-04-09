import type { BusinessTypeCode } from '../types/strategy-types.ts';

export interface BusinessTypeFramework {
  code: BusinessTypeCode;
  label_dk: string;
  strategic_focus_areas: string[];
  weather_lens: string;        // How weather affects THIS business type
  event_lens: string;          // How events affect THIS business type
  tone: string;
  cta_style: string;
  post_themes: string[];       // Recurring content themes
  avoid: string[];             // What NOT to focus on
}

export const BUSINESS_TYPE_FRAMEWORKS: Record<string, BusinessTypeFramework> = {

  FSE: {
    code: 'FSE',
    label_dk: 'Finere Restaurant',
    strategic_focus_areas: [
      'Sæsonbetonede råvarer og tilberedningsmetoder',
      'Særlige lejligheder og reservationer',
      'Håndværk og teknik',
      'Vin- og menuparinger',
    ],
    weather_lens: 'Koldt vejr fremhæver rige saucer, braiserede retter og sæsonens rodfrugter. Varmt vejr fremhæver lette, raffinerede sommerretter og rosévine.',
    event_lens: 'Helligdage og mærkedage er muligheder for særlige menuer og reservationspakker (fx Valentines menu for to, julefrokost).',
    tone: 'Sofistikeret, raffineret og eksklusivt - men aldrig arrogant.',
    cta_style: 'Reservér bord / Book oplevelse',
    post_themes: ['Sæsonmenu highlights', 'Råvare-spotlight', 'Vinkælder', 'Kokketeknik', 'Gæsteoplevelse'],
    avoid: ['Deals og tilbud', 'Hurtig/takeaway', 'Uformelt sprog'],
  },

  SBO: {
    code: 'SBO',
    label_dk: 'Specialforretning (Bar/Café)',
    strategic_focus_areas: [
      'Dagligt ritual og fællesskab',
      'Atmosfære og stemning',
      'Håndværk og kvalitet',
      'Sæsonbestemte produkter',
    ],
    weather_lens: 'Koldt vejr = varme drikke, hyggeligt indendørs. Varmt vejr = kolde drikke, udeservering, luftig stemning.',
    event_lens: 'Weekender = socialt samvær. Helligdage = specielle produkter. Hverdage = dagligt ritual.',
    tone: 'Varmt, velkomment og autentisk. Tilgængeligt og passioneret.',
    cta_style: 'Kom forbi / Find dit hjørne',
    post_themes: ['Dagens produkt', 'Atmosfære', 'Håndværk', 'Fællesskab', 'Sæsonspecialitet'],
    avoid: ['Masseproduktion', 'Fine dining sprog', 'Overdrevet kommercielt'],
  },

  SBO_wine: {
    code: 'SBO_wine',
    label_dk: 'Vinbar / Vinhandel',
    strategic_focus_areas: [
      'Vinuddannelse og opdagelse (regioner, druesorter)',
      'Mad- og vinparinger',
      'Sæsonbestemte vine (lette sommerrosé vs. fyldige vintervine)',
      'Atmosfære og vinkulturelt fællesskab',
    ],
    weather_lens: 'Koldt vejr = fyldige rødvine, Barolo, Rhône, Bourgogne. Varmt vejr = crispy hvidvine, rosé, naturvine. Regn = hyggeligt indendørs med et glas.',
    event_lens: 'Valentines = romantisk pairing for to. Høstsæson = ny årgang. Jul = gavevine og festmenuer. Vinterferie = afslapning med et glas.',
    tone: 'Vidende og passioneret, men tilgængeligt. Nørdet uden at være snobbet.',
    cta_style: 'Kom og opdag / Book vinsmagning',
    post_themes: ['Ugens vin', 'Regionspotlight', 'Pairing-tips', 'Producent-historier', 'Ny flaske er ankommet'],
    avoid: ['Spirits og cocktails (medmindre hybrid)', 'Fast food associations', 'Overdrevet tilbudsmarketing'],
  },

  SBO_coffee: {
    code: 'SBO_coffee',
    label_dk: 'Kaffebar / Café',
    strategic_focus_areas: [
      'Dagligt ritual og fællesskab',
      'Morgenmad og energi (AM focus)',
      'Sæsondrikkevarer (PSL, iced coffee)',
      'Arbejdsvenlighed og third place-kultur',
    ],
    weather_lens: 'Koldt vejr = speciallattes, varm kakao, hyggehjørne med tæppe. Varmt vejr = iced coffee, cold brew, udeservering. Regn = "Kom ind i varmen".',
    event_lens: 'Valentines = coffee date packages. Eksamenstid = studievenlig. Jul = julekrydderier i kaffen. Sommer = iced-serien.',
    tone: 'Varmt, velkomment og energigivende. Folkeligt og tilgængeligt.',
    cta_style: 'Kom forbi / Find dit hjørne',
    post_themes: ['Dagens bryg', 'Sæsondrink', 'Vores hyggehjørne', 'Kaffebønne-spotlight', 'Fællesskab og stamgæster'],
    avoid: ['Alkohol (medmindre hybrid)', 'Fine dining associationer', 'Alt for teknisk kaffesprog'],
  },

  SBO_cocktail: {
    code: 'SBO_cocktail',
    label_dk: 'Cocktailbar / Bar',
    strategic_focus_areas: [
      'Håndværk og kreativitet i mixologi',
      'Aftenunderholdning og stemning',
      'Sæsoncocktails og signaturdrinks',
      'Social oplevelse og events',
    ],
    weather_lens: 'Koldt vejr = varm cocktails (Hot Toddy, Irish Coffee), intime indendørsstemning. Varmt vejr = rooftop/terasse, spritzers, sommerdrinks.',
    event_lens: 'Valentines = romantiske cocktails for to, særlig menu. Weekend = fredagsbar, lørdagsspecialer. Nytår = champagne og fejring.',
    tone: 'Kreativt, stilfuldt og socialt. Indbydende til eventyrlyste gæster.',
    cta_style: 'Book bord / Se denne uges menu',
    post_themes: ['Cocktail of the week', 'Bartender-teknik', 'Aftenatmosfære', 'Ny sæsondrink', 'Weekend highlights'],
    avoid: ['Morgenmad og dagtidsassociationer (medmindre hybrid)', 'Familievenligt sprog', 'Alkoholfri fokus'],
  },

  MFV: {
    code: 'MFV',
    label_dk: 'Flere Formater',
    strategic_focus_areas: [
      'Bred menu og mangfoldighed',
      'Forskellige målgrupper gennem dagen',
      'Fleksibilitet og tilpasningsevne',
      'Fælles atmosfære på tværs af koncepter',
    ],
    weather_lens: 'Tilpas til dominerende format - fx brunch ved godt vejr, aften-menu ved dårligt vejr.',
    event_lens: 'Fleksibel tilgang - forskellige events passer forskellige formater.',
    tone: 'Versatil og inkluderende. Tilpasningsdygtig.',
    cta_style: 'Besøg os / Se hvad vi har',
    post_themes: ['Dagens highlight', 'Mangfoldighed', 'For enhver smag', 'Stemning gennem dagen'],
    avoid: ['For bredt fokus - vælg specifikt format per post'],
  },

  MFD: {
    code: 'MFD',
    label_dk: 'Flere Serviseringer Per Dag',
    strategic_focus_areas: [
      'Brunch, frokost og middag highlights',
      'Tid-specifikt indhold',
      'Dagligt flow og rytme',
      'Service-periode excellence',
    ],
    weather_lens: 'Forskellige serviseringer påvirkes forskelligt - brunch ved sol, middag ved kulde.',
    event_lens: 'Fokus på den serviceperiode der passer eventet - fx valentinsmiddag, ikke brunch.',
    tone: 'Professionel og serviceorienteret. Indbydende gennem dagen.',
    cta_style: 'Book til brunch/frokost/middag',
    post_themes: ['Dagens serviseringer', 'Tid-specifikt indhold', 'Service highlights', 'Fra morgen til aften'],
    avoid: ['Forvirring om serviceperioder - vær specifik'],
  },

  QSR: {
    code: 'QSR',
    label_dk: 'Hurtigservicerestaurant',
    strategic_focus_areas: [
      'Cravings og umiddelbar tilfredsstillelse',
      'Bekvemmelighed og hurtig service',
      'Værdi og tilbud',
      'Gruppe- og familiemåltider',
    ],
    weather_lens: 'Koldt vejr = comfort food, varme burgere, pommes frites. Varmt vejr = lettere options, kolde drikke, takeaway til parken.',
    event_lens: 'Sportsbegivenheder = gruppe-orders, delivery. Valentines = par-deals. Sommer = festival-season tilstedeværelse.',
    tone: 'Sjovt, uformelt og ligetil. Craveworthy.',
    cta_style: 'Bestil nu / Kom forbi',
    post_themes: ['Signatur-burger/ret', 'Dagens tilbud', 'Gruppe-meal deals', 'Bag om køkkenet', 'Kundehistorier'],
    avoid: ['Fine dining sprog', 'Langsomme madlavningsprocesser', 'Eksklusivitet'],
  },

  FOOD_TRUCK: {
    code: 'FOOD_TRUCK',
    label_dk: 'Food Truck',
    strategic_focus_areas: [
      'Daglig lokation og tilgængelighed',
      'Spontan og eventyrlysten madoplevelse',
      'Lokal tilstedeværelse ved events',
      'Hurtigt, portabelt og velsmagende',
    ],
    weather_lens: 'Koldt vejr = hot grab-and-go, varme retter, overvejer indendørs markeder. Regn = alternative lokationer. Varmt vejr = parker, strande, udendørs events.',
    event_lens: 'Festivaler = "Find os ved X". Markeder = "Vi er her i dag". Sommer = event-sæson peak.',
    tone: 'Eventyrlysten, fleksibel og street-smart. Autentisk og nærværende.',
    cta_style: 'Find os i dag / Se lokation',
    post_themes: ['Dagens lokation', 'Dagens menu', 'Event-tilstedeværelse', 'Behind-the-truck', 'Stamkunder'],
    avoid: ['Reservationer og bookinger', 'Fine dining', 'Stabilitet og rutine (modsat friheden)'],
  },

  // HYBRID is handled dynamically - placeholder only
  HYBRID: {
    code: 'HYBRID',
    label_dk: 'Hybrid (blandet)',
    strategic_focus_areas: [],
    weather_lens: '',
    event_lens: '',
    tone: '',
    cta_style: '',
    post_themes: [],
    avoid: [],
  },
};

/**
 * For hybrid businesses, blend two frameworks based on service period weights.
 * E.g. coffee 09:00-15:00 = weight 0.6, wine 16:00-23:00 = weight 0.4
 */
export function blendFrameworks(
  primaryType: BusinessTypeCode,
  secondaryType: BusinessTypeCode,
  primaryWeight: number
): Partial<BusinessTypeFramework> {
  const primary = BUSINESS_TYPE_FRAMEWORKS[primaryType];
  const secondary = BUSINESS_TYPE_FRAMEWORKS[secondaryType];
  
  if (!primary || !secondary) {
    console.warn(`[Framework] Unknown business type: ${primaryType} or ${secondaryType}`);
    return BUSINESS_TYPE_FRAMEWORKS['SBO'] || {};
  }
  
  const secondaryWeight = 1 - primaryWeight;

  return {
    code: 'HYBRID',
    label_dk: `${primary.label_dk} / ${secondary.label_dk}`,
    strategic_focus_areas: [
      ...primary.strategic_focus_areas.slice(0, Math.ceil(4 * primaryWeight)),
      ...secondary.strategic_focus_areas.slice(0, Math.ceil(4 * secondaryWeight)),
    ],
    weather_lens: `${primary.weather_lens}\n\nOm aftenen (${secondary.label_dk}): ${secondary.weather_lens}`,
    event_lens: `${primary.event_lens}\n\nOm aftenen: ${secondary.event_lens}`,
    tone: primaryWeight >= 0.5 ? primary.tone : secondary.tone,
    cta_style: `${primary.cta_style} / ${secondary.cta_style}`,
    post_themes: [
      ...primary.post_themes.slice(0, Math.ceil(5 * primaryWeight)),
      ...secondary.post_themes.slice(0, Math.ceil(5 * secondaryWeight)),
    ],
    avoid: primary.avoid.filter(a => !secondary.post_themes.includes(a)),
  };
}
