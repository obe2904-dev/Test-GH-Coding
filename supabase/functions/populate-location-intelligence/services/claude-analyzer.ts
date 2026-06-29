/**
 * AI Analyzer Service
 * Uses GPT-4o + Brave Search to analyze location intelligence
 * 
 * CHANGES (2026-06-28):
 * - buildLocationPrompt() rewritten in Danish with Danish geographic vocabulary
 * - extractJSON() helper replaces raw JSON.parse() — handles preamble text + markdown fences
 * - Waterfront detection: recognises 'å', 'sø', 'kanal', 'fjord' in addition to 'havn'
 * - Danish waterfront terms mapping: ensures correct terminology (ved åen vs ved floden)
 * - Student/tourist score validation: caps scores for non-university/non-tourist cities
 * - Neighborhood character city-size validation: prevents "pulserende" for small cities
 * - Waterfront score floor: enforces minimum score when address contains water signals
 * - synthesizeNeighborhoodFromAreaType: waterfront now maps to correct Danish terms contextually
 */

// Danish university cities for student score validation
const DANISH_UNIVERSITY_CITIES = [
  'København', 'Aarhus', 'Odense', 'Aalborg', 'Roskilde', 'Kolding', 'Esbjerg'
];

// Major Danish tourist destinations for tourist score validation
const MAJOR_TOURIST_DESTINATIONS = [
  'København', 'Aarhus', 'Odense', 'Aalborg', 'Skagen', 'Ribe', 
  'Ebeltoft', 'Billund', 'Ærøskøbing', 'Dragør', 'Møn', 'Bornholm'
];

// Danish city sizes for neighborhood_character language validation
const DANISH_CITY_SIZES: Record<string, 'large' | 'medium' | 'small'> = {
  'København': 'large',  // 600k+
  'Aarhus': 'large',     // 280k
  'Odense': 'medium',    // 180k
  'Aalborg': 'medium',   // 120k
  'Esbjerg': 'medium',   // 72k
  'Silkeborg': 'medium', // 50k
  'Horsens': 'medium',   // 60k
  'Viborg': 'small',     // 40k
  'Randers': 'medium',   // 62k
  'Kolding': 'medium',   // 60k
  'Vejle': 'medium',     // 60k
  'Herning': 'medium',   // 50k
  'Fredericia': 'small', // 40k
  'Næstved': 'small',    // 43k
};

// Prohibited phrases by city size (prevents "pulsating city life" in small towns)
const PROHIBITED_PHRASES_BY_SIZE: Record<string, string[]> = {
  'medium': ['pulserende', 'urban energi', 'kosmopolit', 'byens puls', 'storby'],
  'small':  ['pulserende', 'urban energi', 'kosmopolit', 'byens puls', 'storby', 'byliv', 'metropol']
};

// Danish waterfront vocabulary — street/area name fragments that signal water proximity.
// Used to boost waterfront scoring and select correct Danish terminology.
const DANISH_WATERFRONT_SIGNALS = [
  'å',          // river/stream (Åboulevarden, Åen)
  'boulevard',  // often waterside in DK cities
  'havn',       // harbour (Aarhus Havn, Nordhavn)
  'kanal',      // canal (Christianshavn, Nyhavn)
  'fjord',      // fjord (Roskilde Fjord)
  'sø',         // lake (Silkeborg Søerne, Bagsværd Sø)
  'strand',     // beach/shore
  'kyst',       // coast
  'bred',       // riverbank
  'mole',       // pier/jetty
];

// Danish waterfront terminology by water type — used in neighborhood_character
const DANISH_WATERFRONT_TERMS: Record<string, string> = {
  'å':        'ved åen',
  'kanal':    'ved kanalen',
  'havn':     'ved havnen',
  'fjord':    'ved fjorden',
  'sø':       'ved søen',
  'strand':   'ved stranden',
  'kyst':     'ved kysten',
  'bred':     'langs bredden',
  'mole':     'ved molen',
  'default':  'ved vandet',
};

// NEW: Location Context Input - streamlined for scoring
export interface LocationContextInput {
  formatted_address: string;
  neighborhood: string | null;
  landmarks: Array<{ name: string; type: string }>;
  business_category: string;
  website_about?: string;
  local_location_reference?: string | null;  // Owner's own location language
  area_type?: string | null;
  hospitality_count?: number;
}

// NEW: Location Analysis Output - scores + character
export interface LocationAnalysis {
  category_scores: Record<string, number>;
  demographic_proximity: Record<string, number>;
  area_type: string;
  rich_neighborhood_character: string;
}

// DEPRECATED: Old interfaces kept for backward compatibility
export interface ClaudeAnalysisInput {
  formatted_address: string;
  neighborhood: string | null;
  landmarks: Array<{
    name: string;
    type: string;
    walking_distance_minutes: number;
  }>;
  business_category: string;
  website_about?: string;
  area_type: string | null;
  opening_hours?: any;
  late_night_hours?: boolean;
  hospitality_count?: number;
}

export interface ClaudeAnalysisOutput {
  rich_neighborhood_character: string;
  local_terminology: string[];
  unique_visual_landmarks: string[];
  positioning_angles: string[];
  content_triggers: Array<{
    trigger_type: 'weather' | 'time_of_day' | 'event' | 'seasonal';
    suggestion: string;
  }>;
  category_scores?: Record<string, number>;
  demographic_proximity?: Record<string, number>;
  area_type?: string;
}

export interface MenuCategory {
  name: string;
  timeRange?: string | null;
  items: Array<{
    name: string;
    description?: string;
    price?: string | number;
  }>;
}

export interface BusinessInput {
  name?: string;
  type: string;
  about?: string;
  website_url?: string;
  offerings?: string[];  // Legacy - kept for backwards compatibility
  menu_data?: {
    categories: MenuCategory[];
    menuTitle?: string;
    availabilityTime?: string;
  };
  opening_hours?: any;
  price_positioning?: string;
  review_snippets?: Array<{ text: string; rating: number; source: string }>;
}

export interface LocationInput {
  area_name: string;
  vibe_description: string;
  anchors: string[];
  area_type?: string | null;
}

export interface CompetitiveVenueDetails {
  place_id: string;
  name: string;
  types: string[];
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  opening_hours?: {
    weekday_text?: string[];
    periods?: any[];
  };
  reviews?: Array<{
    text: string;
    rating: number;
    author_name: string;
  }>;
  distance_meters: number;
}

export interface WhoWhenWhyInput {
  business: BusinessInput;
  location: LocationInput;
  competitive_context?: CompetitiveVenueDetails[];
}

export interface WhoWhenWhyOutput {
  who: Array<{
    title: string;
    description: string;
  }>;
  when: Array<{
    title: string;
    description: string;
  }>;
  why: Array<{
    title: string;
    description: string;
  }>;
  // Internal versions with competitor names for AI use
  who_internal?: Array<{
    title: string;
    description: string;
  }>;
  when_internal?: Array<{
    title: string;
    description: string;
  }>;
  why_internal?: Array<{
    title: string;
    description: string;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract JSON from AI response that may contain preamble text or markdown fences
 */
function extractJSON(text: string): any {
  // 1. Try markdown code fences first (```json ... ``` or ``` ... ```)
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    return JSON.parse(fenceMatch[1].trim());
  }

  // 2. Find the first { and last } to slice out the JSON object,
  //    skipping any preamble text before it.
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return JSON.parse(text.slice(firstBrace, lastBrace + 1));
  }

  // 3. Nothing worked — throw so the caller can trigger the POI fallback
  throw new Error(
    `No JSON found in AI response. Preview: "${text.substring(0, 120)}"`
  );
}

/**
 * Detects Danish waterfront context from address string.
 * Returns { isWaterfront: boolean, term: string } where term is the
 * locally-correct Danish phrase ("ved åen", "ved havnen", etc.)
 */
function detectDanishWaterfront(address: string): { isWaterfront: boolean; term: string } {
  const lower = address.toLowerCase();
  for (const signal of DANISH_WATERFRONT_SIGNALS) {
    if (lower.includes(signal)) {
      const term = DANISH_WATERFRONT_TERMS[signal] || DANISH_WATERFRONT_TERMS['default'];
      return { isWaterfront: true, term };
    }
  }
  return { isWaterfront: false, term: DANISH_WATERFRONT_TERMS['default'] };
}

export class AIAnalyzer {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Analyze location with GPT-4o + Brave Search
   * Returns ALL scores (geographic + demographic) + neighborhood character
   */
  async analyzeLocationContext(input: LocationContextInput): Promise<LocationAnalysis> {
    // Pre-detect waterfront from address so the prompt can reference it explicitly
    const waterfrontContext = detectDanishWaterfront(input.formatted_address);

    const messages: any[] = [
      { role: 'user', content: this.buildLocationPrompt(input, waterfrontContext) }
    ];

    const tools = [{
      type: 'function',
      function: {
        name: 'web_search',
        description: 'Søg efter information om en lokation, by eller kvarter i Danmark',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Søgeforespørgsel' }
          },
          required: ['query']
        }
      }
    }];

    // Loop: AI may call web_search multiple times before returning JSON
    for (let i = 0; i < 3; i++) {  // max 3 iterations
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages,
          tools,
          tool_choice: 'auto',
          temperature: 0.2,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error response:', errorText);
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const message = data.choices[0].message;
      messages.push(message);

      // No tool calls → AI is done, parse the JSON response
      if (!message.tool_calls || message.tool_calls.length === 0) {
        const content = message.content;
        if (!content) throw new Error('Tom respons fra AI');

        // Use extractJSON() instead of raw JSON.parse() — handles preamble + fences
        const result = extractJSON(content);
        
        // ===== POST-PROCESSING VALIDATION =====
        const city = input.formatted_address.split(',')[1]?.trim() || '';

        // Waterfront score floor: if address signals waterfront, enforce minimum score of 60
        if (waterfrontContext.isWaterfront) {
          const currentScore = result.category_scores?.waterfront || 0;
          if (currentScore < 60) {
            console.log(
              `🌊 Waterfront floor applied: score ${currentScore} → 65 ` +
              `(address "${input.formatted_address}" contains waterfront signal, ` +
              `term: "${waterfrontContext.term}")`
            );
            result.category_scores = result.category_scores || {};
            result.category_scores.waterfront = 65;

            // Ensure area_type reflects waterfront if it was the dominant signal
            // but only if no other category is clearly dominant (score > 80)
            const otherMax = Math.max(
              ...Object.entries(result.category_scores)
                .filter(([k]) => k !== 'waterfront')
                .map(([, v]) => v as number)
            );
            if (otherMax <= 80 && result.area_type === 'mixed_use') {
              result.area_type = 'waterfront';
              console.log('🌊 area_type updated to waterfront (no dominant category > 80)');
            }
          }
        }
        
        // FIX 2a: Student score validation - cap at 25 if not a university city
        if (result.demographic_proximity?.student > 25) {
          const isUniversityCity = DANISH_UNIVERSITY_CITIES.some(uc => 
            city.toLowerCase().includes(uc.toLowerCase())
          );
          
          if (!isUniversityCity) {
            console.warn(
              `⚠️ Student score capped: ${result.demographic_proximity.student} → 25 ` +
              `(${city} is not a university city)`
            );
            result.demographic_proximity.student = Math.min(25, result.demographic_proximity.student);
          }
        }
        
        // FIX 2b: Tourist score validation - cap at 30 if not a major tourist destination
        if (result.demographic_proximity?.tourist > 30) {
          const isTouristDestination = MAJOR_TOURIST_DESTINATIONS.some(td => 
            city.toLowerCase().includes(td.toLowerCase())
          );
          
          if (!isTouristDestination) {
            console.warn(
              `⚠️ Tourist score capped: ${result.demographic_proximity.tourist} → 30 ` +
              `(${city} is not a major tourist destination)`
            );
            result.demographic_proximity.tourist = Math.min(30, result.demographic_proximity.tourist);
          }
        }
        
        // FIX 4: Neighborhood character city-size validation
        if (result.neighborhood_character) {
          const citySize = DANISH_CITY_SIZES[city] || 'small';
          const prohibited = PROHIBITED_PHRASES_BY_SIZE[citySize] || PROHIBITED_PHRASES_BY_SIZE['small'];
          
          const hasProhibited = prohibited.some(phrase => 
            result.neighborhood_character.toLowerCase().includes(phrase)
          );
          
          if (hasProhibited) {
            console.warn(
              `⚠️ neighborhood_character bruger upassende sprog for ${citySize} by (${city}). ` +
              `Falder tilbage til faktuel tekst...`
            );
            
            // Fallback to simple factual synthesis
            const areaLabel = waterfrontContext.isWaterfront
              ? waterfrontContext.term
              : this.areaTypeToLabel(result.area_type);
            result.neighborhood_character = `${city} ${areaLabel}.`;
            console.log(`🔧 Syntetiseret neighborhood_character: "${result.neighborhood_character}"`);
          }
        }
        
        return {
          category_scores: result.category_scores || {},
          demographic_proximity: result.demographic_proximity || {},
          area_type: result.area_type || 'mixed_use',
          rich_neighborhood_character: result.neighborhood_character || '',
        };
      }

      // Handle each tool call
      for (const toolCall of message.tool_calls) {
        if (toolCall.function.name === 'web_search') {
          const args = JSON.parse(toolCall.function.arguments);
          
          let searchResult: string;
          try {
            searchResult = await this.performWebSearch(args.query);
          } catch (err) {
            searchResult = 'Search failed — use available data only';
            console.warn('Web search failed:', err);
          }

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: searchResult,
          });
        }
      }
    }

    throw new Error('AI returnerede ikke lokationsanalyse efter 3 iterationer');
  }

  /**
   * Map area_type to Danish location label — used in fallback neighborhood_character
   */
  private areaTypeToLabel(areaType: string): string {
    const labels: Record<string, string> = {
      city_centre:        'centrum',
      waterfront:         'ved vandet',
      residential:        'i et boligkvarter',
      office:             'i erhvervsområdet',
      shopping_district:  'i shoppingområdet',
      transport_hub:      'ved stationen',
      destination:        'som destinationssted',
      nature_park:        'ved naturområdet',
      mixed_use:          'i byen',
    };
    return labels[areaType] || 'i byen';
  }

  /**
   * Perform web search using Brave Search API
   */
  private async performWebSearch(query: string): Promise<string> {
    const braveApiKey = Deno.env.get('BRAVE_SEARCH_API_KEY');
    if (!braveApiKey) {
      throw new Error('BRAVE_SEARCH_API_KEY not configured');
    }

    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&text_decorations=false`,
      { headers: { 'X-Subscription-Token': braveApiKey } }
    );
    
    if (!response.ok) {
      throw new Error(`Brave search failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract top 3 results as context
    const results = data.web?.results?.slice(0, 3) || [];
    return results.map((r: any) => 
      `${r.title}\n${r.description}`
    ).join('\n\n') || 'No results found';
  }

  /**
   * Build the location analysis prompt — written in Danish with Danish geographic vocabulary.
   *
   * WHY DANISH:
   * An English prompt causes translation loss for Danish-specific geography:
   * - "å" → AI reads as "river" → writes "ved floden" (wrong — DK has ingen floder, only åer)
   * - "havn" context gets merged with international harbour concepts
   * - City-size calibration fails because the AI lacks Danish population context
   * - Local terminology (gågade, torv, å, sø) is better understood in Danish
   *
   * The market parameter prepares for expansion: da / no / sv / nl / de
   */
  private buildLocationPrompt(
    input: LocationContextInput,
    waterfrontContext: { isWaterfront: boolean; term: string }
  ): string {
    const waterfrontHint = waterfrontContext.isWaterfront
      ? `\nVIGTIGT: Adressen indeholder et dansk vandrelateret signal ("${input.formatted_address}"). ` +
        `Vandfront (waterfront) er sandsynligvis en primær kategori. ` +
        `Brug den korrekte danske betegnelse: "${waterfrontContext.term}" — IKKE "ved floden" eller "ved riveren". ` +
        `Danmark har åer og søer, ikke floder. Vand scorer HØJT (60+) når stedet faktisk ligger VED vandet.`
      : '';

    return `Du er lokationsanalytiker for en dansk restaurantmarketingplatform. Markedet er: Danmark (da).

Analysér karakteren og demografien for denne lokation. Brug websøgning hvis du mangler kontekst om stedet.
Returner et JSON-objekt med scores og en beskrivelse.

LOKATION:
Adresse: ${input.formatted_address}
Kvarter/område: ${input.neighborhood || 'Ukendt'}
Spisesteder inden for 300m: ${input.hospitality_count || 0}
Nærliggende steder: ${input.landmarks?.slice(0, 6).map(l => l.name).join(', ') || 'ingen'}
${input.local_location_reference
  ? `\nEJERENS EGEN STEDSBESKRIVELSE: "${input.local_location_reference}"
Dette er virksomhedens egne ord for sin beliggenhed — brug denne terminologi
direkte i neighborhood_character og respekter den som primær kilde.
Eksempel: "ved åen" skal bruges præcist som "ved åen", IKKE "ved floden" eller "ved vandet".`
  : ''}
${waterfrontHint}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DANSK GEOGRAFISK ORDBOG (obligatorisk viden)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Disse begreber er centrale i dansk bygeografi. Brug dem præcist:

• å / åen — en mindre vandløb der løber gennem byen (fx Aarhus Å langs Åboulevarden).
  ALDRIG kald det "floden" eller "riveren". Danmark har ingen store floder — kun åer og søer.
  En café ved åen er et stærkt waterfront-signal.

• sø / søerne — sø i eller ved byen (fx Silkeborg Søerne, Bagsværd Sø).
  Sø-nærhed er waterfront-kontekst, ikke nature_park.

• havn / havnen — havn (fx Aarhus Havn, Nordhavn i København).
  Moderne havnekvarterer (Aarhus Ø, Nordhavn) er city_centre + waterfront.

• kanal / kanalen — kanal (fx Nyhavn, Christianshavn i København).

• gågade / strøget — fodgængerzone i bycentrum. Stærkt shopping_district signal.

• torv / torvet — byens centrale plads (Aarhus Rådhusplads, Silkeborg Torv).
  Torv = city_centre.

• boulevard — ofte en bred vej langs vand eller park i danske byer.
  "Åboulevarden" = boulevard langs åen → waterfront + city_centre.

• latin kvarter / latinerkvarteret — ældre bydelsnavne med kulturel identitet.

Bystørrelser i Danmark (kalibrér sproget herefter):
• Stor by (250k+): København, Aarhus — urban, dynamisk, mangfoldig
• Mellemstor by (50–200k): Odense, Aalborg, Horsens, Silkeborg, Randers, Kolding
• Lille by (<50k): Viborg, Fredericia, Næstved, Ribe og lignende

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPGAVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Søg evt. efter kontekst om lokationen, og returner derefter:

1. category_scores — geografiske lokationstyper (0–100)

Scorerne besvarer ét spørgsmål pr. kategori:
"I hvilken grad er DENNE kategori den primære grund til, at kunder befinder sig i dette område?"

Score efter KUNDERNES TILTRÆKNINGSKRAFT, ikke geografisk nærhed.

REGEL: En kategori scorer højt KUN hvis en kunde specifikt ville opsøge
denne lokationstype for at besøge stedet.
At noget befinder sig i nærheden retfærdiggør IKKE en høj score alene.

Kategoridefinitioner:

city_centre (0–100)
  Høj: Stedet ligger i den aktive bykerne — gågade, torv, tæt mix af butikker og
  restauranter. Kunder er her fordi det er et travlt byknudepunkt.
  Lav: Stedet er i en by, men ikke i dens kommercielle centrum.

waterfront (0–100)
  Høj: Vand er en direkte del af lokationsoplevelsen — havnepromenade, søbred,
  kanalside, terrasse langs å, udsigt til vand fra stedet.
  En café på Åboulevarden ved Aarhus Å scorer HØJT (70+) — åen er synlig og
  udgør en central del af stedets identitet.
  Lav: Vand eksisterer i nærheden men er ikke en del af grunden til at kunder vælger stedet.

  VIGTIGT: "Å" i en adresse er næsten altid et stærkt waterfront-signal i Danmark.
  Åboulevarden, Åen, Ådalen, Ågade → alle signalerer vandnærhed.

nature_park (0–100)
  Høj: Stedet er fysisk placeret i eller ved indgangen til et naturområde —
  skov, sø, strand eller sti. Kunder kommer her på grund af naturen.
  Lav: Et naturområde eksisterer i samme by, men stedet selv er ikke i det.

residential (0–100)
  Høj: Stedet betjener primært et lokalt opland — folk ankommer til fods fra
  nærliggende boliger. Lav besøgs- eller transitstrøm fra andre områder.
  Lav: Området tiltrækker folk fra et bredere opland.

office (0–100)
  Høj: Nærliggende arbejdspladser genererer den dominerende kundestrøm —
  frokosttrængsel, eftermiddagsbesøg, forretningsmøder.
  Lav: Der er kontorer i nærheden, men de er ikke den primære driver af fodgængerflow.

shopping_district (0–100)
  Høj: Stedet er inde i eller direkte op til en primær detailhandelszone
  og fanger shoppere som sin primære målgruppe.
  Lav: Der er butikker i nærheden, men detailhandel er ikke områdets dominerende karakter.

transport_hub (0–100)
  Høj: Stedet er i eller umiddelbart ved et større transitknudepunkt —
  togstationshal, færgeterminal, busstation. Kunder passerer igennem.
  Lav: Et busstoppested eller station er inden for gåafstand.

tourist_destination (0–100)
  Høj: Lokationen i sig selv tiltrækker besøgende — historisk kvarter, større
  attraktion, velkendt landemærke. Turister udgør en betydelig del af forbipasserende.
  Lav: Byen har turistattraktioner, men dette specifikke område fungerer ikke som turistzone.

Kalibrering:
- Scores er uafhængige. De behøver IKKE summere til 100.
- De fleste steder vil have 1–2 høje scores (60+) og resten lave (0–25).
- En score over 60 betyder at kategorien reelt former, hvorfor kunder er her.
  Undgå at oppuste sekundære kategorier fordi de er "lidt relevante".
- Tænk i det faktiske gadebillede: hvad ser man fra indgangen?

2. demographic_proximity — hvem PASSERER FORBI dette område (0–100):
   - local_resident: bruger lokale dette område dagligt?
   - tourist: besøger turister dette område?
   - student: er dette et studenterdomineret område?
   - business_professional: er der kontorfolk i området?
   - family: er det et familieorienteret område (skoler, parker)?

   VIGTIGT: Basér demografiske scores på områdets faktiske karakter,
   ikke blot nærhed til én institution.
   Et enkelt universitetscampus i en ikke-studenterdomineret by scorer LAVT (10–25).
   Aarhus er en studenterby. Silkeborg er ikke.
   Turister scores HØJT i kystbyer, historiske bykerner og kendte attraktionssteder.

3. area_type — den bedste enkeltbetegnelse fra:
   city_centre / waterfront / residential / office / transport_hub /
   shopping_district / tourist_destination / nature_park / mixed_use

   Vælg den kategori der bedst forklarer HVAD der primært tiltrækker kunder til dette sted.
   Et sted kan have to høje scores (fx city_centre: 85, waterfront: 70) —
   vælg den der er mest definerende for stedets identitet.

4. neighborhood_character — 2–3 sætninger PÅ DANSK der beskriver området.
   Hvad slags sted er dette? Hvad omgiver det? Hvad er atmosfæren?
   Nævn IKKE den specifikke virksomhed. Giv IKKE marketingråd.

   Skalér sproget til byens faktiske størrelse:
   - Stor by (250k+): urban energi, mangfoldigt, dynamisk — passende referencer
   - Mellemstor by (50–200k): fokus på lokale landemærker, den specifikke gade eller plads,
     lokal fællesskabsfølelse, nærhed til natur eller vand hvis relevant
   - Lille by (<50k): lokal karakter, roligt tempo, kendte lokale steder

   For mellemstore danske byer (Silkeborg, Horsens, Viborg):
   Nævn specifikke lokale kendetegn (fx Silkeborg Søerne, gågaden, Torvet) —
   IKKE "pulserende byliv" eller "byens puls".

   Brug KORREKTE danske vandtermer:
   ✅ "ved åen", "langs åen", "ved Aarhus Å" — for å-lokationer
   ✅ "ved søen", "ved Silkeborg Søerne" — for søer
   ✅ "ved havnen", "i havnekvarteret" — for havne
   ❌ "ved floden", "ved riveren", "ved elven" — ALDRIG brug disse

   Eksempel god output for Åboulevarden, Aarhus:
   "Åboulevarden ligger centralt i Aarhus Centrum, direkte ved Aarhus Å der løber
   gennem bykernen. Gaden er omgivet af restauranter og caféer med terrasser langs åen,
   og ARoS Kunstmuseum er inden for få minutters gang."

   Eksempel god output for Silkeborg:
   "Centralt i Silkeborg med gågaden og Torvet inden for gangafstand,
   tæt på Silkeborg Søerne og naturstier."

   Eksempel DÅRLIG output (upassende for dansk mellemstor by):
   "I hjertet af Silkeborgs pulserende byliv med konstant urban energi og kosmopolitisk stemning."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Returner KUN valid JSON uden markdown, uden forklaring, uden preamble:

{
  "category_scores": {
    "city_centre": 0-100,
    "waterfront": 0-100,
    "nature_park": 0-100,
    "residential": 0-100,
    "office": 0-100,
    "shopping_district": 0-100,
    "transport_hub": 0-100,
    "tourist_destination": 0-100
  },
  "demographic_proximity": {
    "local_resident": 0-100,
    "tourist": 0-100,
    "student": 0-100,
    "business_professional": 0-100,
    "family": 0-100
  },
  "area_type": "city_centre",
  "neighborhood_character": "dansk tekst her..."
}`;
  }

  /**
   * Build the analysis prompt for GPT-4o
   */
  private buildPrompt(input: ClaudeAnalysisInput): string {
    const landmarksList = input.landmarks
      .slice(0, 5)
      .map(l => `- ${l.name} (${l.walking_distance_minutes} min gang)`)
      .join('\n');

    return `Du er en lokal guide med opdateret viden om steder, venues og locations.
Din opgave er at identificere og beskrive de mest relevante steder inden for gåafstand.

### DIN ROLLE:
- Tænk som en lokal guide der kender områdets geografi, bygninger og steder
- Identificer ALLE relevante locations inden for 1 km gåafstand
- Fokuser på 5 kategorier:

**1. KULTURELLE VENUES** (Højeste prioritet for pre-show positioning):
- Museer, teatre, koncertsale, biografer, kunstgallerier
- Historiske landemærker (domkirker, vikinge-sites, arkitektur)
- Kulturhuse, biblioteker, designcentre

**2. SHOPPING & BUTIKKER**:
- Department stores (stormagasiner)
- Lokale butikker, design-shops, specialforretninger
- Shoppinggader og handelstorve
- Beskriv TYPER af butikker, ikke specifikke navne ("stormagasiner og specialbutikker" frem for navne)

**3. NATUR & GRØNNE RUM**:
- Parker, botaniske haver, vandløb (fx Åen)
- Sceniske spots, strandpromenader
- Grønne byrum

**4. SPISESTEDER & CAFÉER** (Valgfrit - kun ikoniske steder):
- Populære eller unikke lokale spisesteder
- Kendte caféer med særligt præg
- KUN steder der er lokalt kendte eller særlige

**5. BEMÆRKELSESVÆRDIGE LANDEMÆRKER**:
- Kirker, torve, byarkitektur
- Ikoniske bygninger eller strukturer

### OUTPUT SPROG:
- Al beskrivende tekst SKAL være på DANSK
- JSON keys forbliver på engelsk

FORRETNINGSDATA:
- Adresse: ${input.formatted_address}
- Kvarter: ${input.neighborhood || 'Ukendt'}
- Type: ${input.business_category}
- Områdetype: ${input.area_type || 'Blandet'}
${input.website_about ? `- Om virksomheden: ${input.website_about.substring(0, 500)}` : ''}

NÆRLIGGENDE LANDEMÆRKER:
${landmarksList}

### ANALYSÉR GEOGRAFISK KONTEKST:

**ABSOLUT PRIORITERET RÆKKEFØLGE** (nævn i denne rækkefølge):
1. **FØRST**: Museer (ARoS, kunstmuseer, historiske museer)
2. **DEREFTER**: Teatre & koncertsale (Aarhus Teater, Musikhuset, koncertvenues)
3. **SÅ**: Historiske bygninger & arkitektur (domkirker, rådhuse)
4. **DEREFTER**: Naturen (Åen, parker, vandområder)
5. **SIDST**: Shopping (kun hvis plads)

**STRENGT FORBUDT - UNDGÅ DISSE FORMULERINGER**:
❌ "hvor man kan..." (beskriver menneskers adfærd)
❌ "hyggelige caféer" (subjektiv vurdering)
❌ "levende område" (generisk)
❌ "tiltrækker besøgende/lokale" (demografi)
❌ "nyde en drink/måltid" (menneskers aktiviteter)
❌ "bred vifte af butikker" (generisk markedsføring)
❌ "fantastisk udsigt", "imponerende facade", "smuk arkitektur" (subjektive vurderinger)
❌ "tilbyder", "præsenterer", "byder på" (humanisering af bygninger)
❌ "vest", "øst", "nord", "syd", "nordlige", "vestlige" (retninger - upræcis data)
❌ "overfor", "på modsatte side af gaden" (præcis placering - brug i stedet "tæt på", "ved")
❌ "mulighed for at", "oplevelse", "udforske" (menneskelige aktiviteter)
❌ "særlig atmosfære", "giver området" (subjektiv vurdering)
❌ "ved siden af", "lige ved", "naboer til" (præcise relative positioner mellem venues - data upræcist)
❌ Specifikke butiksnavn (Magasin du Nord, etc.) - BESKRIV I STEDET typer: "stormagasiner", "mindre butikker", "boghandlere"

**KORREKT TILGANG - BRUG DISSE FORMULERINGER**:
✅ "2 min gang fra ARoS Kunstmuseum med regnbuepanorama"
✅ "Området omfatter Aarhus Teater og Musikhuset" (ALDRIG "ved siden af hinanden")
✅ "Tæt på ligger både X og Y" (ALDRIG antag direkte naboskab)
✅ "Ved Åen" ELLER "Langs Åen" (ALDRIG "vestlige/østlige bred")
✅ "Tæt på Aarhus Domkirkes gotiske facade"
✅ "Stormagasiner og mindre butikker i gågaden" (INGEN specifikke navne)
✅ "Shoppingområde med designbutikker og specialforretninger" (beskriv typer bredt, ikke navne)
✅ "Området består af..." (ALDRIG "giver", "tilbyder")

**KRITISKE REGLER**:
- **ALDRIG** beskriv hvem der bruger stedet eller hvad de gør der
- **KUN** fysiske locations, bygninger, gadenavne, geografiske positioner
- **ALTID** start med MUSEER og TEATRE hvis de findes i listen
- **ALDRIG** generiske beskrivelser som "levende", "pulserende", "hyggelig"
- **ALDRIG** retningsangivelser: vest, øst, nord, syd (data er upræcis)
- **BRUG I STEDET**: "tæt på", "ved", "i nærheden", "mellem", "langs"

1. **rich_neighborhood_character** (5-6 fyldige sætninger på dansk):
   - **STRUKTUR**: Byg en rig, detaljeret geografisk beskrivelse af området
   - **START**: Nævn nærmeste museum/teater med præcis gåafstand (OBLIGATORISK)
   - **FORTSÆT**: Beskriv 3-4 andre nøgle-venues - LIST dem individuelt, ALDRIG antag deres indbyrdes placering
   - **PLACERING**: Brug "tæt på", "ved", "i nærheden", "området omfatter" - ALDRIG "ved siden af X ligger Y"
   - **INKLUDER**: Arkitektoniske detaljer (bygningsstile, facader, strukturer) - men UDEN subjektive ord som "smuk", "imponerende"
   - **TILFØJ**: Geografiske elementer (åen, gader, pladser, parker) - men UDEN retninger
   - **BESKRIV**: Områdets karakter gennem fysiske elementer (gamle/nye bygninger, brostensbelagte gader, vandløb)
   - **SHOPPING**: Beskriv TYPER af shopping (stormagasiner, mindre butikker, boghandlere, designbutikker) - ALDRIG specifikke butiksnavn
   - **AFSLUT**: Med kontekst om gader, torve eller arkitektur
   - **TONE**: Faktuel, objektiv, geografisk præcis - som en nøgtern arkitekturguide, IKKE turistguide
   - **LÆNGDE**: Minimum 5 sætninger, gerne 6, for at give fuld kontekst
   - **UNDGÅ HELT**: "fantastisk", "imponerende", "smuk", "storslået", "levende", "hyggelig", "tilbyder", "præsenterer", "vest", "øst", "nord", "syd", "overfor", "ved siden af"

2. **local_terminology** (liste af danske termer):
   - Kvartersnavne som lokale bruger (fx "Latinerkvarteret", "Åen", "Domkirkekvateret")
   - Culturelle venue-kælenavne (fx "Musikhuset", "Teatret")
   - Lokale mødesteder og gadenavne

3. **unique_visual_landmarks** (liste på dansk):
   - Prioriter kulturelle landmarks: Teaterfacader, museum-arkitektur, historiske bygninger
   - Instagram-spots relateret til kultur (fx "ARoS regnbuepanorama", "Domkirken bagfra")
   - Kendte samlingssteder før/efter kulturelle events

4. **positioning_angles** (liste på dansk):
   - **Prioritet 1**: Pre-show/post-show positioning (fx "Aperitif før forestilling", "Midnatsmad efter koncert")
   - **Prioritet 2**: Museum-adjacent (fx "Kunstpause mellem udstillinger")
   - **Prioritet 3**: Kulturelt hub (fx "Mødested for kulturinteresserede")
   - Konkrete use cases baseret på faktiske venues i området

5. **content_triggers** (liste med type + dansk forslag):
   - **weather**: Vejr-baseret content (fx "Solen skinner → udeserverings-post")
   - **time_of_day**: Tidspunkt på dagen (fx "Fredagsbar-stemning", "Søndag brunch")
   - **event**: Events i nærområdet (festivaler, markeder, koncerter)
   - **seasonal**: Sæson-baseret (sommer, efterår, jul)

### KRITISK: DANSK SPROGKONTROL
Før du returnerer JSON, udfør følgende tjek på "rich_neighborhood_character":

**OBLIGATORISK OMSKRIVNING - DISSE ORD/FRASER MÅ IKKE FOREKOMME**:
❌ "finder man sig" → ✅ "finder man" eller "ligger"
❌ "hyggelig", "stemningsfuldt", "charmerende" → ✅ Beskriv KUN fysiske elementer uden følelser
❌ "interessant", "spændende", "unik" → ✅ Beskriv faktuelt hvad der ER, ikke hvordan det opleves
❌ "byder på", "tilbyder", "præsenterer" → ✅ "består af", "omfatter", "rummer"
❌ "Det er et område, hvor" → ✅ Start sætninger med fakta, ikke generiske vendinger
❌ "gør det nemt/let at", "mulighed for at" → ✅ FJERN alle referencer til menneskelig aktivitet
❌ "venues" → ✅ Brug navnene direkte eller "spillesteder"
❌ "twist", "vibe", "feel" → ✅ Dansk ord som "præg", "karakter"
❌ "mødes", "skaber", "danner" (om bygninger) → ✅ "Området består af X og Y"

**KORREKT STRUKTUR - BRUG DISSE FORMULERINGER**:
✅ "2 min gang fra ARoS Kunstmuseum med regnbuepanorama"
✅ "Området omfatter Aarhus Teater og Musikhuset"
✅ "Aarhus Domkirke med gotisk facade ligger tæt på"
✅ "Langs Åen findes brostensbelagte gader og moderne bygninger"
✅ "Shoppingområdet består af stormagasiner, designbutikker og boghandlere"
✅ "Området har både gamle bygninger fra [periode] og nyere arkitektur"

**SIDSTE TJEK**:
1. Læs teksten højt - lyder den som en nøgtern arkitekturguide eller en turistbrochure?
2. Hvis turistbrochure → omskriv til ren fakta
3. Fjern ALLE subjektive vurderinger (hyggelig, spændende, unik, interessant)
4. Fjern ALLE menneskelige aktiviteter (udforske, nyde, opleve)

### OUTPUT FORMAT:
Returner KUN valid JSON (ingen markdown, ingen forklaring):

{
  "rich_neighborhood_character": "3-4 sætninger med lokal kontekst på dansk...",
  "local_terminology": ["dansk term1", "dansk term2"],
  "unique_visual_landmarks": ["dansk landmark1", "dansk landmark2"],
  "positioning_angles": ["dansk angle1", "dansk angle2"],
  "content_triggers": [
    {
      "trigger_type": "weather",
      "suggestion": "dansk forslag til content..."
    },
    {
      "trigger_type": "time_of_day",
      "suggestion": "dansk forslag..."
    }
  ]
}`;
  }

  /**
   * Proofread Danish text with GPT-4o to fix grammar, spelling, and style issues
   */
  private async proofreadDanishText(text: string): Promise<string> {
    const proofreadPrompt = `Du er en professionel dansk korrekturlæser. Din opgave er at korrekturlæse følgende tekst og rette:

1. **Grammatik**: Ret fejl som "finder man sig" til "finder man" eller "ligger"
2. **Subjektive ord**: Fjern ord som "hyggelig", "stemningsfuldt", "interessant", "spændende", "unik", "charmerende"
3. **Humanisering**: Omskriv "byder på", "tilbyder", "præsenterer", "mødes", "skaber", "danner" til "består af", "omfatter", "rummer"
4. **Menneskers aktiviteter**: Fjern "gør det nemt at", "mulighed for at", "udforske", "nyde", "opleve"
5. **Engelske ord**: Erstat "venues" med danske navne, "twist" med "præg"
6. **Generiske vendinger**: Undgå "Det er et område, hvor..." - brug konkrete fakta
7. **Tone**: Teksten skal lyde som en nøgtern arkitekturguide, IKKE en turistbrochure

ORIGINAL TEKST:
${text}

Returner KUN den korrigerede tekst (ingen forklaring, ingen markdown).`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 500,
          temperature: 0.3, // Lower temperature for more consistent corrections
          messages: [
            {
              role: 'system',
              content: 'Du er en professionel dansk korrekturlæser der retter tekster til at være faktuelle og objektive.',
            },
            {
              role: 'user',
              content: proofreadPrompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        console.error('Proofreading failed, using original text');
        return text;
      }

      const data = await response.json();
      const correctedText = data.choices[0].message.content.trim();
      
      console.log('✅ Proofreading completed');
      return correctedText;
    } catch (error) {
      console.error('Error during proofreading:', error);
      return text; // Return original if proofreading fails
    }
  }

  /**
   * Analyze WHO, WHEN, WHY with GPT-4o
   */
  async analyzeWhoWhenWhy(input: WhoWhenWhyInput): Promise<WhoWhenWhyOutput> {
    // Build context from all available data
    const websiteUrl = input.business.website_url || 'Not provided';
    const priceLevel = input.business.price_positioning || 'Not specified';
    const locationInfo = `${input.location.area_name} - ${input.location.vibe_description}`;
    const nearbyLandmarks = input.location.anchors.join(', ');
    const aboutText = input.business.about || 'Not provided';
    
    // Format comprehensive menu data with prices, descriptions, and serving times
    let menuSection = '';
    if (input.business.menu_data?.categories && input.business.menu_data.categories.length > 0) {
      const menuLines: string[] = ['\n**Menu & Offerings:**'];
      
      // Add menu title/availability if present
      if (input.business.menu_data.menuTitle) {
        menuLines.push(`Menu: ${input.business.menu_data.menuTitle}`);
      }
      if (input.business.menu_data.availabilityTime) {
        menuLines.push(`Available: ${input.business.menu_data.availabilityTime}`);
      }
      
      // Process each category with time ranges, items, prices, and descriptions
      for (const category of input.business.menu_data.categories) {
        const categoryHeader = category.timeRange 
          ? `${category.name} (${category.timeRange})`
          : category.name;
        menuLines.push(`\n${categoryHeader}:`);
        
        // Get up to 8 items per category to show variety
        const items = category.items.slice(0, 8);
        for (const item of items) {
          let itemLine = `  • ${item.name}`;
          if (item.price) {
            itemLine += ` - ${item.price} kr`;
          }
          if (item.description) {
            itemLine += ` (${item.description})`;
          }
          menuLines.push(itemLine);
        }
        
        if (category.items.length > 8) {
          menuLines.push(`  ... and ${category.items.length - 8} more items`);
        }
      }
      
      menuSection = menuLines.join('\n');
    } else if (input.business.offerings && input.business.offerings.length > 0) {
      // Fallback to legacy offerings format
      menuSection = '\n**Menu items:** ' + input.business.offerings.join(', ');
    }
    
    // Format reviews if available
    let reviewsSection = '';
    if (input.business.review_snippets && input.business.review_snippets.length > 0) {
      reviewsSection = '\n\n**Customer Reviews (Google):**\n' + 
        input.business.review_snippets.map(r => 
          `- ${r.rating}/5: "${r.text}"`
        ).join('\n');
    }
    
    // Format competitive context if available
    let competitiveSection = '';
    if (input.competitive_context && input.competitive_context.length > 0) {
      competitiveSection = '\n\n**Competitive Landscape (500m radius):**\n\n';
      competitiveSection += 'Similar venues nearby:\n';
      
      for (const comp of input.competitive_context) {
        const distance = Math.round(comp.distance_meters);
        const rating = comp.rating ? `${comp.rating}★` : 'No rating';
        const reviewCount = comp.user_ratings_total ? `(${comp.user_ratings_total} reviews)` : '';
        const priceSymbol = comp.price_level ? '€'.repeat(comp.price_level) : '€€';
        
        competitiveSection += `\n• **${comp.name}** - ${distance}m away\n`;
        competitiveSection += `  ${rating} ${reviewCount}, ${priceSymbol}\n`;
        
        // Add hours summary if available
        if (comp.opening_hours?.weekday_text) {
          const hours = comp.opening_hours.weekday_text[0]; // Show Monday as example
          competitiveSection += `  Hours: ${hours}\n`;
        }
        
        // Extract review themes/patterns
        if (comp.reviews && comp.reviews.length > 0) {
          const reviewTexts = comp.reviews.map(r => r.text.toLowerCase()).join(' ');
          const themes: string[] = [];
          
          // Detect common patterns
          if (reviewTexts.includes('laptop') || reviewTexts.includes('work') || reviewTexts.includes('wifi')) {
            themes.push('laptop-friendly');
          }
          if (reviewTexts.includes('brunch') || reviewTexts.includes('breakfast')) {
            themes.push('brunch spot');
          }
          if (reviewTexts.includes('date') || reviewTexts.includes('romantic') || reviewTexts.includes('anniversary')) {
            themes.push('date night');
          }
          if (reviewTexts.includes('tourist') || reviewTexts.includes('visiting')) {
            themes.push('tourist exposure');
          }
          if (reviewTexts.includes('takeaway') || reviewTexts.includes('take away') || reviewTexts.includes('to go')) {
            themes.push('takeaway');
          }
          if (reviewTexts.includes('family') || reviewTexts.includes('kids') || reviewTexts.includes('children')) {
            themes.push('family-friendly');
          }
          
          if (themes.length > 0) {
            competitiveSection += `  Review themes: ${themes.join(', ')}\n`;
          }
        }
      }
      
      // Add market observations
      competitiveSection += '\n**Market observations:**\n';
      
      // Price positioning analysis
      const priceLevels = input.competitive_context
        .map(c => c.price_level)
        .filter(p => p !== undefined) as number[];
      
      if (priceLevels.length > 0) {
        const avgPrice = priceLevels.reduce((a, b) => a + b, 0) / priceLevels.length;
        const businessPrice = input.business.price_positioning?.toLowerCase();
        let positioning = 'Similar price point to competitors';
        
        if (businessPrice === 'high' && avgPrice < 3) {
          positioning = 'Premium positioning vs. market average';
        } else if (businessPrice === 'low' && avgPrice > 2) {
          positioning = 'Budget positioning vs. market average';
        }
        
        competitiveSection += `- Price positioning: ${positioning}\n`;
      }
      
      // Daypart coverage analysis
      const hasEarlyHours = input.competitive_context.some(c => 
        c.opening_hours?.weekday_text?.some(h => h.includes('7:') || h.includes('8:'))
      );
      const hasLateHours = input.competitive_context.some(c =>
        c.opening_hours?.weekday_text?.some(h => h.includes('22:') || h.includes('23:'))
      );
      
      if (hasEarlyHours && hasLateHours) {
        competitiveSection += '- Daypart coverage: Competitors serve both morning and evening crowds\n';
      } else if (hasEarlyHours) {
        competitiveSection += '- Daypart coverage: Morning/daytime focus in the area\n';
      } else if (hasLateHours) {
        competitiveSection += '- Daypart coverage: Evening/night focus in the area\n';
      }
      
      // Dominant segments from reviews
      const allReviewTexts = input.competitive_context
        .flatMap(c => c.reviews?.map(r => r.text.toLowerCase()) || [])
        .join(' ');
      
      const segments: string[] = [];
      if (allReviewTexts.includes('tourist') || allReviewTexts.includes('visiting copenhagen')) {
        segments.push('tourists');
      }
      if (allReviewTexts.includes('local') || allReviewTexts.includes('regular')) {
        segments.push('locals/regulars');
      }
      if (allReviewTexts.includes('business') || allReviewTexts.includes('meeting')) {
        segments.push('business crowd');
      }
      if (allReviewTexts.includes('student')) {
        segments.push('students');
      }
      
      if (segments.length > 0) {
        competitiveSection += `- Dominant customer segments: ${segments.join(', ')}\n`;
      }
    }
    
    const prompt = `You are a professional marketing manager. Your task is to create a structured WHO / WHEN / WHY profile that will be used as input for downstream AI content generation.

Analyze the business ONLY using the evidence provided below:
- Opening hours
- Menu/offerings (including categories + timeRange if present)
- Location context (area description + nearby landmarks/anchors)
- Customer reviews (if provided)
- Competitive landscape (if provided)

IMPORTANT: Do not invent facts. If information is missing, write cautiously and base conclusions on what IS present.

BUSINESS INPUT:
Website: ${websiteUrl}

About:
${aboutText}
${menuSection}

Price level: ${priceLevel}

Opening hours: ${JSON.stringify(input.business.opening_hours || 'Not specified')}

Location:
Area name: ${input.location.area_name}
Area description: ${input.location.vibe_description}
Nearby anchors: ${nearbyLandmarks}

Reviews:
${reviewsSection || 'No reviews provided'}

Competitive context:
${competitiveSection || 'No competitor data provided'}

---

## TASK — WHO / WHEN / WHY (for AI content generation)

You must return ONLY valid JSON with the requested structure.

### LANGUAGE + STYLE RULES
- Output language: Danish (or the language the business uses)
- Tone: professional, concrete, evidence-based
- Avoid subjective/marketing adjectives unless clearly supported by reviews
  (avoid words like: "hyggelig", "fantastisk", "unik atmosfære", "naturskøn", "perfekt")

### COMPETITOR RULES
If competitor data exists:
- You MUST produce two versions:
  1) Public version (who/when/why): use generic wording (no competitor names)
  2) Internal version (who_internal/when_internal/why_internal): include competitor names and direct comparisons

If no competitor data exists:
- Output ONLY who/when/why (omit internal fields)

---

## 1) WHO — Target Segments (occasion-based) 🎯

Goal: Identify customer segments as "visit reasons / occasions" derived primarily from offerings and opening hours.

CRITICAL RULES:
- Segments MUST be occasion-based (based on what the business serves and when), not demographic personas.
  ✅ Good: "🥐 Brunch-gæster", "💼 Hverdagsfrokost", "🍽️ Aftenspisere", "🥡 Takeaway", "💇 Klippekunder", "🏋️ Træningshold"
  ❌ Avoid: "unge", "familier", "studerende" unless clearly supported by menu/reviews
- Every segment MUST reference a specific offering, menu category, or timeRange if available.
- Describe what they come for + what they value (speed, convenience, experience, consistency, location, quality).
- Keep it realistic: do not add segments unless supported by evidence.

---

## 2) WHEN — Time Patterns (incl. growth windows) ⏰

Goal: Map visits across the week/day using opening hours and offering time windows.

CRITICAL RULES:
- Use opening hours as boundaries (do not describe times the business is closed).
- If menu categories include timeRange, use those time windows as the foundation for your WHEN patterns.
- Split patterns into:
  - Weekdays
  - Weekend daytime/afternoon
  - Weekend evenings / Friday-Saturday evening (only if relevant and the business is open)

MANDATORY: Include Growth Opportunity Windows
- You MUST include at least 1–2 entries that are explicitly marked as growth opportunities.
- Label them clearly in the title: "📈 Vækstmulighed: ..."
- Growth windows must be realistic based on opening hours + offerings.
- Do NOT invent campaigns/discounts.
- For each growth window, explain:
  - which WHO segment can be activated
  - why this time window is influenceable (lower habit/less competition for attention/easier decision)
  - what guests typically need at that moment (quick choice, convenience, pause, social plan, etc.)

Decision moments:
- For each WHEN entry, include a short "decision moment" explanation:
  (e.g., lunch decisions earlier the same day, dinner decisions late afternoon, weekend plans same morning/day before)

---

## 3) WHY — Positioning Angles (reusable value angles) ✨

Goal: Describe why people choose this business, in a way that can later become content themes.

CRITICAL RULES:
- WHY must be grounded in:
  - Location + anchors
  - Offerings/menu structure (including special categories, breadth, time-based service)
  - Price positioning (if known)
  - Review patterns (if provided)
- Each WHY angle should be reusable as a "content theme".
- Tie each WHY to at least one WHO segment (and preferably also one WHEN window).
- Avoid vague claims. Prefer concrete value like:
  "central beliggenhed", "servering i tidsrum X", "børnevenlige valg", "3-retters menu", "hurtig frokostformat", etc.

Competitor requirement:
- If competitor data exists:
  - Public version: generic "andre steder i området"
  - Internal version: explicit competitor names + clear differentiation

---

## OUTPUT FORMAT (STRICT)
Return ONLY valid JSON. No markdown. No headings. No extra text.

JSON schema:

{
  "who": [{ "title": "...", "description": "..." }],
  "who_internal": [{ "title": "...", "description": "..." }],
  "when": [{ "title": "...", "description": "..." }],
  "when_internal": [{ "title": "...", "description": "..." }],
  "why": [{ "title": "...", "description": "..." }],
  "why_internal": [{ "title": "...", "description": "..." }]
}

If competitor data is missing, omit the *_internal fields entirely.`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 2500,
          temperature: 0.4,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: 'You are a professional marketing manager helping businesses with social media communication. Always respond with valid JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error for WHO/WHEN/WHY:', errorText);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      const analysis = JSON.parse(content);

      console.log('✅ WHO/WHEN/WHY analysis completed');
      return analysis;
    } catch (error) {
      console.error('Error analyzing WHO/WHEN/WHY:', error);
      
      // Return empty structure if fails
      return {
        who: [],
        when: [],
        why: []
      };
    }
  }

  /**
   * Create fallback analysis if OpenAI API fails
   */
  private createFallbackAnalysis(input: ClaudeAnalysisInput): ClaudeAnalysisOutput {
    const neighborhood = input.neighborhood || 'området';
    const topLandmark = input.landmarks[0]?.name || 'lokale seværdigheder';

    return {
      rich_neighborhood_character: `Beliggende i ${neighborhood}, tæt på ${topLandmark}. Området tiltrækker både lokale og besøgende. Aktivitet gennem dagen med varierende intensitet.`,
      local_terminology: [neighborhood],
      unique_visual_landmarks: [],
      positioning_angles: [`Tæt på ${topLandmark}`],
      content_triggers: [
        {
          trigger_type: 'time_of_day',
          suggestion: 'Post om morgenmad/frokost/aften baseret på tidspunkt',
        },
      ],
    };
  }
}
