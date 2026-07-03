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

// Prohibited outdoor space terms — use neutral "udendørsservering" unless we have factual data
const PROHIBITED_OUTDOOR_TERMS = [
  'terrasse',
  'terrasser',
  'veranda',
  'balkon',
  'gårdhave',
  'altan',
  'tagterrasse'
];

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

// NEW: Location Analysis Output - Physical Anchor Taxonomy v3
export interface LocationAnalysis {
  category_scores: Record<string, number>;  // 9 location types (0-100 scores)
  who: {
    primary: string[];      // Primary WHO types (70%+ presence)
    secondary: string[];    // Secondary WHO types (30-70% presence)
    notes?: string;         // Optional clarifying notes with proximity evidence
  };
  traffic_rhythm: {
    weekly_pattern: 'monday_friday_even' | 'friday_saturday_peak' | 'saturday_dominant' | 'weekend_peak' | 'weekday_lunch_only' | 'all_week_even' | 'semester_only';
    peak_hours: string;     // Danish format with en-dash
    dead_periods: string;   // When is it empty
    seasonal_pattern: 'stable' | 'summer_peak' | 'winter_peak' | 'semester_only' | 'retail_calendar';
    seasonal_note?: string; // Optional seasonal details
  };
  area_type: string;        // Best single descriptor from the 9 types
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
        
        // FIX 2a: WHO field validation - student proximity gate
        if (result.who?.primary?.includes('student') || result.who?.secondary?.includes('student')) {
          const isUniversityCity = DANISH_UNIVERSITY_CITIES.some(uc => 
            city.toLowerCase().includes(uc.toLowerCase())
          );
          
          if (!isUniversityCity) {
            console.warn(
              `⚠️ Student WHO type rejected: ${city} is not a university city. ` +
              `Removing student from who.primary and who.secondary.`
            );
            if (result.who.primary) {
              result.who.primary = result.who.primary.filter(w => w !== 'student');
            }
            if (result.who.secondary) {
              result.who.secondary = result.who.secondary.filter(w => w !== 'student');
            }
          }
        }
        
        // FIX 2b: WHO field validation - tourist proximity validation
        if (result.who?.primary?.includes('tourist') || result.who?.secondary?.includes('tourist')) {
          const isTouristDestination = MAJOR_TOURIST_DESTINATIONS.some(td => 
            city.toLowerCase().includes(td.toLowerCase())
          );
          
          if (!isTouristDestination) {
            console.warn(
              `⚠️ Tourist WHO type demoted: ${city} is not a major tourist destination. ` +
              `Moving tourist from primary to secondary if present.`
            );
            if (result.who.primary?.includes('tourist')) {
              result.who.primary = result.who.primary.filter(w => w !== 'tourist');
              if (!result.who.secondary) result.who.secondary = [];
              if (!result.who.secondary.includes('tourist')) {
                result.who.secondary.push('tourist');
              }
            }
          }
        }
        
        // FIX 4: Neighborhood character city-size validation
        if (result.neighborhood_character) {
          const citySize = DANISH_CITY_SIZES[city] || 'small';
          const prohibited = PROHIBITED_PHRASES_BY_SIZE[citySize] || PROHIBITED_PHRASES_BY_SIZE['small'];
          
          const hasProhibited = prohibited.some(phrase => 
            result.neighborhood_character.toLowerCase().includes(phrase)
          );
          
          // FIX 5: Outdoor space terminology validation
          const hasProhibitedOutdoorTerms = PROHIBITED_OUTDOOR_TERMS.some(term =>
            result.neighborhood_character.toLowerCase().includes(term)
          );
          
          if (hasProhibited || hasProhibitedOutdoorTerms) {
            if (hasProhibited) {
              console.warn(
                `⚠️ neighborhood_character bruger upassende sprog for ${citySize} by (${city}). ` +
                `Falder tilbage til faktuel tekst...`
              );
            }
            if (hasProhibitedOutdoorTerms) {
              console.warn(
                `⚠️ neighborhood_character bruger specifik udendørs terminologi uden faktuelle data. ` +
                `Brug neutral term "udendørsservering". Falder tilbage til faktuel tekst...`
              );
            }
            
            // Fallback to richer factual synthesis
            const areaLabel = waterfrontContext.isWaterfront
              ? waterfrontContext.term
              : this.areaTypeToLabel(result.area_type);
            const hospitalityNote = hospitalityPlaces.length > 8
              ? ` Høj tæthed af spisesteder i området (${hospitalityPlaces.length} inden for 300m).`
              : '';
            const waterfrontNote = (result.category_scores?.waterfront || 0) > 60
              ? ` Beliggende ${waterfrontContext.term}.`
              : '';
            result.neighborhood_character = `${city} ${areaLabel}.${waterfrontNote}${hospitalityNote}`;
            console.log(`🔧 Syntetiseret neighborhood_character: "${result.neighborhood_character}"`);
          }
        }
        
        return {
          category_scores: result.category_scores || {},
          who: result.who || { primary: [], secondary: [] },
          traffic_rhythm: result.traffic_rhythm || {
            weekly_pattern: 'friday_saturday_peak',
            peak_hours: '11:00–21:00',
            dead_periods: 'ikke identificeret',
            seasonal_pattern: 'stable'
          },
          area_type: result.area_type || 'city_centre',
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
Nærliggende steder (med distance i meter):
${input.landmarks?.slice(0, 6).map(l => {
  const dist = l.walking_distance_meters || l.distance_meters || 'ukendt';
  return `  • ${l.name} (${l.type}): ${dist}m`;
}).join('\n') || '  ingen'}
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

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHYSICAL ANCHOR TAXONOMY v3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Du analyserer BUSINESS-BLIND fysiske fakta om denne lokation.
Ignorer forretningens type. Fokuser på: HVOR er dette sted? HVEM er fysisk her? HVORNÅR?

Søg evt. efter kontekst om lokationen, og returner derefter:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. CATEGORY_SCORES — De 9 Fysiske Ankertyper (0–100)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

KRITISK: Score efter HVAD der tiltrækker fodgængere til området, ikke forretningens type.

city_centre (0–100)
  Høj (70+): Gågade, torv, aktiv handelskerne med tæt butiks/restaurantmix.
  Lav (0–25): I en by, men ikke dens kommercielle centrum.

transport_hub (0–100)
  Høj (70+): I eller umiddelbart ved togstation, busstation, færgeterminal, metro.
  Vigtigt: Kun IF der er FYSISK transitflow (folk skifter transport).
  Lav (0–25): Busstoppested i nærheden tæller IKKE.

shopping_district (0–100)
  Høj (70+): Inde i primær detailhandelszone (stormagasiner, butiksrække).
  Lav (0–25): Enkelte butikker i nærheden.

waterfront (0–100)
  Høj (70+): Vand er synligt og en del af stedets identitet (havnepromenade, åbred, kanalkant).
  SIGNAL: "Å" i adresse = næsten altid høj score (Åboulevarden = 75+).
  Lav (0–25): Vand findes i byen, men ikke ved stedet.

office (0–100)
  Høj (70+): Nærliggende kontorbyggeri genererer frokost/mødeflow.
  Lav (0–25): Kontorer eksisterer, men driver ikke fodgængerflow.

residential (0–100)
  Høj (70+): Betjener lokale beboere, lav transitstrøm.
  Lav (0–25): Området tiltrækker folk fra bredere opland.

university_campus (0–100) — NYT
  PROXIMITY GATE: Scorer 70+ KUN hvis universitet ligger 400–600m væk.
  KRITISK: Tjek de præcise distancer i "Nærliggende steder" listen ovenfor.
  Hvis intet universitet har distance ≤600m → score SKAL være ≤25.
  Høj (70+): Universitetsområde dominerer (studiehaller, bibliotek, kantiner synlige).
  Lav (0–25): Universitet i byen, men ikke ved stedet.
  BEMÆRK: Aarhus/København/Odense kan score højt. Silkeborg kan IKKE.
  
  EKSEMPLER:
  ✅ "Syddansk Universitet Kolding: 450m" → university_campus: 75
  ❌ "Syddansk Universitet Kolding: 726m" → university_campus: 15 (for langt væk)
  ❌ IBA/UC institutioner tæller KUN hvis de har "universitet" i navnet

hospital_campus (0–100) — NYT
  PROXIMITY GATE: Scorer 70+ KUN hvis hospital ligger 300–500m væk.
  KRITISK: Tjek de præcise distancer i "Nærliggende steder" listen ovenfor.
  Hvis intet hospital har distance ≤500m → score SKAL være ≤25.
  Høj (70+): Hospital/klinikområde med medicinsk personale og besøgende.
  Lav (0–25): Hospital i byen, men ikke ved stedet.

tourist_destination (0–100) — REDEFINERET
  Høj (70+): OMRÅDE-LEVEL turistzone (historisk kvarter, attraktionszone, ikonisk gade).
  IKKE single landmarks (Rundetårn alene = content hook, IKKE location type).
  Kræver: turiststrøm + flere attraktioner + turistinfrastruktur.
  Eksempler: Nyhavn (hele kvarter), Skagen centrum, Ribe gamle by.
  Lav (0–25): Enkelte attraktioner, men ingen turistzone-karakter.

nature_park (0–100)
  Høj (70+): I eller ved indgang til naturområde (skov, sø, strand, sti).
  Lav (0–25): Natur findes i byen, men stedet er ikke i det.

Kalibrering:
- Scores summerer IKKE til 100 (uafhængige dimensioner).
- De fleste steder: 1–2 høje (60+), resten lave (0–25).
- 60+ = kategorien FORMER hvorfor folk er her.
- Tænk faktisk gadebillede: hvad ser man fra døren?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KAUSAL RÆKKEFØLGE — OBLIGATORISK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Følg ALTID denne rækkefølge. Afvig aldrig:

  1. category_scores (LOKATIONSTYPE) → bestemmer traffic_rhythm
  2. traffic_rhythm → bestemmer hvornår folk er til stede
  3. who → bestemmer hvem der er til stede på disse tidspunkter

ALDRIG den omvendte vej:
  ❌ demographic scores → traffic_rhythm (FORKERT)
  ❌ "office_worker scorer højt → området er dødt om aftenen" (FORKERT)

Eksempel på korrekt rækkefølge:
  city_centre: 80 + waterfront: 75 → traffic_rhythm: peak_days "both",
  evening active, summer_peak → office_worker + leisure_walker + shopper
  er alle til stede på DERES respektive tidspunkter

Eksempel på fejl at undgå:
  office_worker: 90 → "døde perioder: efter 17:00 og weekender" (FORKERT)
  office_worker beskriver hvem der PASSERER FORBI til frokost,
  ikke hvornår OMRÅDET som helhed er aktivt.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. WHO — Hvem er fysisk i dette område?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Producér who-objektet i tre trin:

TRIN 1: Bestem primary og secondary fra category_scores
  Brug følgende mapping — scores er for category_scores, ikke demographic:

  city_centre ≥70 + waterfront ≥70 (kombineret):
    primary:   [leisure_walker, local_resident]
    secondary: [shopper (hvis shopping_district ≥50), tourist
                (hvis tourist_destination ≥50), office_worker (hvis office ≥60)]

    REGLER FOR DENNE KOMBINATION:
    - leisure_walker er ALTID primary når waterfront ≥70 — folk der
      går langs åen/havnen er det definerende træk ved waterfront
      lokationer, uanset om city_centre scorer højere
    - shopper er ALTID secondary, ALDRIG primary, når waterfront ≥70
      — shopping er et supplement til promenaden, ikke omvendt
    - office_worker er ALTID secondary i city_centre ≥70 lokationer,
      uanset office category_score:
      * Normal tilstedeværelse: september–juni (morgenkaffe + efter-arbejde)
      * Markant reduceret: juli (uge 28–32) og juleperioden (uge 52–1)
      * Denne sæsonvariation fremgår af traffic_rhythm.seasonal_pattern
        — det behøver ikke gentages i who.notes

  city_centre ≥70 UDEN waterfront (waterfront <60):
    primary:   [local_resident, shopper (hvis shopping_district ≥50),
                office_worker (hvis office ≥60)]
    secondary: [tourist (hvis tourist_destination ≥50), leisure_walker]

  waterfront ≥70 UDEN city_centre (city_centre <60):
    primary:   [leisure_walker, local_resident]
    secondary: [tourist (hvis tourist_destination ≥50)]
    — office_worker og shopper er ikke relevante for rene waterfront
      lokationer uden bymidte-karakter

  office ≥70 (og city_centre <60):
    primary: office_worker
    secondary: local_resident

  residential ≥70:
    primary: local_resident, family
    secondary: office_worker (hvis nogen kontorer nearby)

  shopping_district ≥70:
    primary: shopper
    secondary: local_resident, office_worker

  university_campus ≥70 OG campus inden for 600m (se trin 2):
    primary: student, office_worker (academic staff)
    secondary: local_resident
    
    PROXIMITY CHECK: Før du tildeler student som primary, SKAL du verificere
    at et universitet i "Nærliggende steder" har distance ≤600m.
    Hvis ingen universitet er ≤600m → student må IKKE være i primary eller secondary.

  hospital_campus ≥70 OG hospital inden for 500m:
    primary: medical_staff, hospital_visitor
    secondary: local_resident

  Vælg primary: 2-3 typer med stærkest tilstedeværelse
  Vælg secondary: 1-2 typer med moderat tilstedeværelse
  
  MANGLENDE TYPER ER FEJL:
  - shopping_district ≥50 → shopper SKAL være i secondary eller primary
  - waterfront ≥60 → leisure_walker SKAL være i secondary eller primary
  - tourist_destination ≥50 → tourist SKAL være i secondary

TRIN 2: Proximity gate for who.notes — fire absolutte regler

REGEL 1 — AFSTAND:
  who.notes må KUN indeholde referencer til landmarks der findes i
  "Nærliggende steder" listen ovenfor MED distance ≤ 600m (university)
  eller ≤ 500m (hospital).
  
  VIGTIGT: Brug de præcise distance-tal fra "Nærliggende steder" listen.
  Du må IKKE estimere eller gætte på distancer.
  
  Hvis intet qualifying landmark er inden for tærsklen:
    → sæt who.notes = null eksplicit
    → skriv IKKE en note om atmosfære, karakter eller nærliggende steder
  
  Tjek: er der et qualifying landmark i "Nærliggende steder" inden for tærsklen?
    JA → note er tilladt, brug den præcise distance fra listen
    NEJ → who.notes = null. Stop. Skriv ingen note.
  
  EKSEMPEL KORREKT:
  "Nærliggende steder" viser "Syddansk Universitet Kolding (education): 450m"
  → who.notes = "Syddansk Universitet Kolding 450m — studerende..."
  
  EKSEMPEL FORKERT:
  "Nærliggende steder" viser "Syddansk Universitet Kolding (education): 726m"
  → who.notes = null (fordi 726m > 600m threshold)

REGEL 2 — POI SIGNIFICANCE (gælder KUN for tourist grounding):
  who.notes må IKKE citere en enkelt POI som begrundelse for tourist-tilstedeværelse,
  medmindre POI'en er et genuint signifikant turistmål.
  
  SIGNIFIKANTE POIs (OK at citere):
  ✅ Nationale/internationale attraktioner (ARoS, Tivoli, Den Lille Havfrue)
  ✅ UNESCO sites (Kronborg, Jelling, Stevns Klint)
  ✅ Store kulturinstitutioner (Nationalmuseet, Louisiana)
  ✅ Ikoniske landmarks med stor besøgsvolume (Nyhavn, Skagen Grenen)
  
  IKKE-SIGNIFIKANTE POIs (brug IKKE som tourist-grounding):
  ❌ Almindelige kirker og domkirker (Aarhus Domkirke, Ribe Domkirke)
    → Disse er ofte i landmarks_nearby, men tiltrækker få turister
  ❌ Lokale museer uden national betydning
  ❌ Generiske tourist_attraction tags fra Google Places
  ❌ Monumenter, statuer, springvand uden ikonisk status
  
  HVIS tourist ER i who.secondary MEN ingen signifikant POI findes:
  → Sæt who.notes = null. Citer IKKE mindre lokale POIs som begrundelse.
  → Tourist-tilstedeværelse kan skyldes general citycentre-karakter, ikke en enkelt POI.
  
  Eksempler:
  ✅ "ARoS Kunstmuseum 200m — turister besøger museet og regnbuepanoramaet"
  ❌ "Aarhus Domkirke 162m — turister tiltrækkes af den historiske katedral"
     (domkirken er ikke et signifikant turistmål — brug IKKE)

REGEL 3 — SPROG:
  who.notes skal ALTID være på dansk.
  Engelsk er forbudt i who.notes, uanset om resten af AI-svaret er på engelsk.
  "Aarhus University is nearby" → UGYLDIG (engelsk)
  "Aarhus Universitetshospital 280m — hospitalspersonale..." → GYLDIG (dansk)

REGEL 4 — INDHOLD:
  who.notes må KUN indeholde:
  ✅ Institutionens navn + præcis afstand fra landmarks_nearby data
  ✅ Hvilke people-types dette genererer og hvornår
  ❌ ALDRIG: "bidrager til", "dynamisk atmosfære", "ungdommelig stemning"
  ❌ ALDRIG: subjektive vurderinger af områdets karakter
  ❌ ALDRIG: distancer du har beregnet eller estimeret selv

  Korrekt eksempel:
  "Aarhus Universitetshospital 280m — hospitalspersonale og besøgende
  til stede alle ugens dage, inkl. tidlige morgener fra 06:00"
  
  Forkert eksempel:
  "Aarhus University is nearby, contributing to a youthful and dynamic
  atmosphere." (engelsk + subjektiv + landmark uden for tærsklen)

TRIN 3: 11 VALID WHO TYPES (brug KUN disse):
  local_resident, office_worker, student, shopper, tourist, commuter,
  leisure_walker, family, medical_staff, hospital_visitor, event_visitor

SCORE KALIBRERING FOR SHOPPER:
  shopper må ALDRIG overstige 70 i demographic_proximity, selv hvis
  shopping_district category_score er høj.
  
  Begrundelse: shopping_district score beskriver lokationens
  shopping-karakter, ikke om folk primært shopper på netop denne
  gade. En restaurant på en boulevard tæt på et stormagasin har
  shopping-gæster, men de er et supplement — ikke lokationens
  dominerende funktion.
  
  Korrekt kalibrering:
  - shopping_district ≥70 + lokation er i/ved shoppingzone: shopper 60-70
  - shopping_district 50-69 + nærliggende stormagasin: shopper 45-60
  - shopping_district 50-69 + waterfront eller city_centre dominant: shopper 35-50

Output-struktur:
{
  "who": {
    "primary": ["office_worker", "local_resident", "shopper"],
    "secondary": ["leisure_walker", "tourist"],
    "notes": null
  }
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. TRAFFIC_RHYTHM — AFLЕД FRA category_scores, IKKE fra demographic scores
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bestem traffic_rhythm udelukkende fra de højest scorende category_scores
og nearby_hospitality data. Demographic scores (who) påvirker IKKE
traffic_rhythm — de beskriver hvem der er til stede, ikke hvornår.

REGLER FOR HVERT FELT:

weekly_pattern — det ugentlige trafikmønster (vælg ét):
  
  'monday_friday_even'    — jævn fordeling hele ugen (residential, hospital_campus)
  'friday_saturday_peak'  — fredag eftermiddag + lørdag er de kommercielle toppe
                            (city_centre F&B, waterfront, de fleste restauranter og caféer)
  'saturday_dominant'     — lørdag er klart den travleste dag (shopping_district)
  'weekend_peak'          — lørdag + søndag, ingen markant fredagsuplift
                            (nature_park, rene turist-lokationer)
  'weekday_lunch_only'    — kun hverdage, weekend næsten død (rent office-område)
  'all_week_even'         — konstant alle dage inkl. weekend (hospital_campus, transport_hub)
  'semester_only'         — aktiv i semestret, kollapser i sommerferien (university_campus)

VÆLG 'friday_saturday_peak' NÅR:
  - city_centre ≥70 OG waterfront ≥60
  - city_centre ≥70 OG shopping_district ≥50
  - city_centre ≥70 uden dominerende office-karakter (office <60)
  Dette gælder de fleste restauranter og caféer i dansk bymidteContext.

VÆLG IKKE 'monday_friday_even' for lokationer med city_centre ≥70 —
  jævn ugefordeling er kun korrekt for residential og hospital.

peak_hours REGLER:

city_centre ≥70 + waterfront ≥60 (f.eks. Åboulevarden, havnepromenader):
  Korrekt: "09:30–22:00" eller "09:30–23:00"
  FORKERT: "08:00–09:30 og 11:30–13:30"
  
  Begrundelse: En å-boulevard eller havnepromenade er ikke et
  transportknudepunkt. Morgenrush (08:00–09:30) foregår med cyklister
  og buspassagerer der PASSERER FORBI, ikke stopper. Reel handel
  starter når promenaden bliver en destination: ~09:30.
  
  Formiddagsdip er minimalt for waterfront-lokationer — folk kommer
  både til brunch, frokost, eftermiddag og aften.

office ≥70 + waterfront <50 (rent erhvervskvarter):
  Korrekt: "08:00–09:30 og 11:30–13:30"
  Dette er det eneste tilfælde hvor 08:00 er korrekt startpunkt.

transport_hub ≥60:
  Korrekt: "07:00–09:00 og 16:00–18:00"
  Kun transport_hub har ægte 07:00-traffic.

residential dominant:
  Korrekt: "07:30–09:00 og 17:30–21:00"
  Tidlig morgen er korrekt for residential — folk går hjemmefra.

Alle andre kombinationer:
  Kombiner signaler fra TOP 2 category_scores:
  - city_centre (uden waterfront): 08:00–09:30 (morgenkaffe) + 11:30–13:30 (frokost) + 17:00–22:00 (aften)
  - city_centre + waterfront: 09:30–22:00 (se regel ovenfor)
  - waterfront (alene): 12:00–22:00 (eftermiddag og aften)
  - office: 08:00–09:30 + 11:30–13:30 (kun hverdage)
  - shopping_district: 10:00–19:00
  - residential: 07:30–09:00 + 17:30–21:00
  Hvis TOP 2 giver overlappende mønstre → kombiner dem

dead_periods:
  ⚠️ KRITISK: dead_periods beskriver LOKATIONENS døde perioder,
  ikke den specifikke forretnings åbningstider.

  - city_centre ≥70: ingen åbenlyse døde perioder (altid "Tidlig morgen
    05:00–08:00" hvis noget)
  - city_centre ≥70 + waterfront ≥70: "Tidlig morgen 05:00–08:00" — 
    ALDRIG "efter 17:00" eller "weekender" for denne kombination
  - office dominant + city_centre <60: "efter 17:00 og weekender"
  - shopping_district: "mandag–tirsdag formiddag"
  
  REGEL: Hvis nearby_hospitality.density_label = "high" OG breakdown
  indeholder bars eller restauranter → området er IKKE dødt om aftenen
  eller weekenden, uanset hvad office_worker scoren er.
  16 spisesteder inden for 300m inkl. barer = aktiv aften og weekend.

seasonal_pattern:
  Vælg ÉT mønster baseret på TOP scoring kategori:
  - city_centre dominant + waterfront ≥60: "summer_peak"
  - city_centre dominant uden waterfront: "stable"
  - waterfront dominant: "summer_peak"
  - university_campus dominant (≥70 OG inden for 600m): "semester_only"
  - shopping_district dominant: "retail_calendar"
  - residential: "stable"
  - nature_park: "summer_peak"

  ⚠️ seasonal_note MÅ IKKE modsige seasonal_pattern:
  - "stable" + negativ sommernote = UGYLDIG KOMBINATION
  - "summer_peak" + positiv sommernote = korrekt
  - Hvis du skriver en note om sommerfald (-X%) → brug IKKE "stable"
  - University semester-fald hører til "semester_only" — brug det kun
    hvis university_campus scorer ≥70 OG campus er inden for 600m

Output-struktur:
{
  "traffic_rhythm": {
    "weekly_pattern": "friday_saturday_peak",
    "peak_hours": "09:30–22:00",
    "dead_periods": "Tidlig morgen 05:00–09:30",
    "seasonal_pattern": "summer_peak",
    "seasonal_note": "Sommer: +20–30% (åen og udeservering)"
  }
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. AREA_TYPE — Bedste enkeltbetegnelse
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Vælg ÉN af de 9 typer:
city_centre / transport_hub / shopping_district / waterfront / office /
residential / university_campus / hospital_campus / tourist_destination / nature_park

Logik: Tag den type med højeste score (hvis 60+). Ved tie (fx city_centre 80, waterfront 75),
vælg den mest definerende for stedets identitet.

5. neighborhood_character — 2–3 sætninger PÅ DANSK der beskriver området.

   MINIMUM: 2 sætninger. En enkelt sætning er IKKE acceptabelt.
   
   Hvad slags sted er dette? Hvad omgiver det? Hvad er atmosfæren?
   Nævn IKKE den specifikke virksomhed. Giv IKKE marketingråd.

   TILLADT (faktuel beskrivelse):
   ✅ "Åboulevarden ligger i Aarhus Centrum direkte langs Aarhus Å."
   ✅ "Området har høj tæthed af restauranter og caféer (16 inden for 300m)."
   ✅ "Aarhus Domkirke ligger 162m væk."
   ✅ "Mange steder tilbyder udendørsservering langs åen." (neutral term)
   
   UDENDØRS SERVERING — NEUTRAL TERMINOLOGI:
   Brug ALTID "udendørsservering" som neutral term.
   Brug ALDRIG specifikke termer som "terrasse", "veranda", "balkon", "gårdhave"
   medmindre du har faktuelle data der bekræfter den præcise type.
   Hvis data ikke specificerer typen → brug "udendørsservering".
   
   FORBUDT (marketing og subjektiv vurdering — uændret):
   ❌ "pulserende", "hyggelig", "fantastisk", "unik atmosfære"
   ❌ Menneskelige aktiviteter: "udforske", "nyde", "opleve"
   ❌ Retninger: "vest", "øst", "nord", "syd"
   ❌ Relative positioner: "ved siden af", "overfor"
   ❌ Specifikke udendørs typer uden data: "terrasser", "veranda", "balkon"
   
   Brug nearby_hospitality.total_count, landmarks_nearby navne og
   afstande, og waterfront/area_type karakteren som faktuelle ankre.

   Skalér sproget til byens faktiske størrelse:
   - Stor by (250k+): urban energi, mangfoldigt, dynamisk — passende referencer
   - Mellemstor by (50–200k): fokus på lokale landemærker, den specifikke gade eller plads,
     lokal fællesskabsfølelse, nærhed til natur eller vand hvis relevant
   - Lille by (<50k): lokal karakter, roligt tempo, kendte lokale steder

   Brug KORREKTE danske vandtermer:
   ✅ "ved åen", "langs åen", "ved Aarhus Å" — for å-lokationer
   ✅ "ved søen", "ved Silkeborg Søerne" — for søer
   ✅ "ved havnen", "i havnekvarteret" — for havne
   ❌ "ved floden", "ved riveren", "ved elven" — ALDRIG brug disse

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VALIDERINGSTJEK FØR OUTPUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Gennemfør disse tjek på din output FØR du returnerer JSON:

1. KAUSAL TJEK:
   Er traffic_rhythm.dead_periods afledt fra category_scores (korrekt)
   eller fra demographic_proximity scores (forkert)?
   Hvis fra demographic → omskriv fra category_scores.

2. SÆSON MODSIGELSE:
   Er seasonal_pattern = "stable" OG seasonal_note negativ (f.eks. "-40%")?
   → Skift seasonal_pattern til det korrekte mønster eller fjern noten.

3. PROXIMITY HALLUCINATION:
   Indeholder who.notes en distance (Xm, X minutters gang)?
   → Verificer at denne præcis distance eksisterer i landmarks_nearby data.
   Hvis du ikke kan finde den eksakte distance i data → fjern noten.

4. TOURIST GROUNDING SIGNIFICANCE:
   Indeholder who.notes en reference til en kirke, domkirke eller almindelig tourist_attraction?
   → Verificer at POI'en er genuint signifikant (ARoS, Tivoli, UNESCO site, etc.)
   Hvis POI'en er en almindelig kirke/domkirke → fjern noten, sæt who.notes = null
   Eksempel FEJL: "Aarhus Domkirke 162m — turister tiltrækkes af..." → FJERN
   Eksempel OK: "ARoS Kunstmuseum 200m — turister besøger museet..."

5. MANGLENDE WHO TYPER:
   - shopping_district score ≥50 OG shopper ikke i who → FEJL, tilføj
   - waterfront score ≥60 OG leisure_walker ikke i who → FEJL, tilføj
   - tourist_destination score ≥50 OG tourist ikke i who → FEJL, tilføj

6. OFFICE MØNSTER I IKKE-OFFICE LOKATION:
   Er dead_periods "efter 17:00" eller "weekender" OG city_centre ≥70?
   → FORKERT. City centres er ikke døde om aftenen. Omskriv.
   Er dead_periods "efter 17:00" OG nearby_hospitality inkl. barer?
   → FORKERT. Barer genererer aftentrafik. Omskriv.

7. WEEKLY_PATTERN TJEK:
   Er weekly_pattern = 'monday_friday_even' OG category_scores har
   city_centre ≥70? → FORKERT. City_centre F&B bruger 'friday_saturday_peak'.
   
   Er peak_hours starter kl. 08:00 OG location er city_centre + waterfront
   uden transport_hub ≥60? → FORKERT. Ret til 09:30.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT (Physical Anchor Taxonomy v3)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Returner KUN valid JSON uden markdown, uden forklaring, uden preamble:

{
  "category_scores": {
    "city_centre": 0-100,
    "transport_hub": 0-100,
    "shopping_district": 0-100,
    "waterfront": 0-100,
    "office": 0-100,
    "residential": 0-100,
    "university_campus": 0-100,
    "hospital_campus": 0-100,
    "tourist_destination": 0-100,
    "nature_park": 0-100
  },
  "who": {
    "primary": ["office_worker", "local_resident"],
    "secondary": ["tourist"],
    "notes": "Optional proximity/temporal clarification"
  },
  "traffic_rhythm": {
    "weekly_pattern": "friday_saturday_peak",
    "peak_hours": "09:30–22:00",
    "dead_periods": "Tidlig morgen 05:00–09:30",
    "seasonal_pattern": "summer_peak",
    "seasonal_note": "Optional seasonal details"
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
