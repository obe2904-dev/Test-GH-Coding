/**
 * AI Analyzer Service
 * Uses GPT-4o + Brave Search to analyze location intelligence
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

// NEW: Location Context Input - streamlined for scoring
export interface LocationContextInput {
  formatted_address: string;
  neighborhood: string | null;
  landmarks: Array<{ name: string; type: string }>;
  business_category: string;
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
    const messages: any[] = [
      { role: 'user', content: this.buildLocationPrompt(input) }
    ];

    const tools = [{
      type: 'function',
      function: {
        name: 'web_search',
        description: 'Search for information about a location, city, or neighbourhood',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' }
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
        if (!content) throw new Error('Empty response from AI');
        
        // Strip markdown code fences if present (AI sometimes wraps JSON in ```json ... ```)
        const cleanContent = content.trim().replace(/^```json\s*\n?/i, '').replace(/\n?```$/, '');
        
        const result = JSON.parse(cleanContent);
        
        // ===== POST-PROCESSING VALIDATION =====
        // Extract city from address for validation
        const city = input.formatted_address.split(',')[1]?.trim() || '';
        
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
              `⚠️ Neighborhood character uses inappropriate language for ${citySize} city (${city}). ` +
              `Regenerating with factual fallback...`
            );
            
            // Fallback to simple factual synthesis
            const areaTypeLabels: Record<string, string> = {
              city_centre:        'centrum',
              waterfront:         'ved havnen',
              residential:        'i et boligkvarter',
              office:             'i erhvervsområdet',
              shopping_district:  'i shoppingområdet',
              transport_hub:      'ved stationen',
              destination:        'som destinationssted',
              nature_park:        'ved naturområdet',
            };
            const areaLabel = areaTypeLabels[result.area_type] || 'i byen';
            result.neighborhood_character = `${city} ${areaLabel}.`;
            console.log(`🔧 Synthesized factual neighborhood_character: "${result.neighborhood_character}"`);
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

    throw new Error('AI did not return location analysis after 3 iterations');
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
   * Build the analysis prompt for GPT-4o
   */
  private buildLocationPrompt(input: LocationContextInput): string {
    return `You are a location analyst for a restaurant marketing platform.

Analyze the character and demographics of this location using web search if needed.
Return a JSON object with scores and a description.

LOCATION:
Address: ${input.formatted_address}
Area: ${input.neighborhood || 'Unknown neighbourhood'}
Hospitality venues within 300m: ${input.hospitality_count || 0}
Nearby landmarks: ${input.landmarks?.slice(0, 6).map(l => l.name).join(', ') || 'none'}

TASK:
Search for context about this location and area if needed, then return:

1. Location Category Scores (0–100)

These scores answer ONE question per category:
"To what degree is THIS category the primary reason customers are in this area?"

Score based on CUSTOMER DRAW, not geographic proximity.

RULE: A category scores high only if a customer would specifically
seek out this location TYPE to visit this business.
Nearby presence of that environment does NOT justify a high score.

Category definitions:

city_centre (0–100)
  High: The venue sits in the active flow of urban life — pedestrian zone,
  main square, dense mix of retail and restaurants. Customers are here
  because it is a busy city hub.
  Low: The venue is in a city but not in its commercial core.

waterfront (0–100)
  High: Water is a direct feature of the location experience — harbour
  promenade, lakeside terrace, canal-side seating, sea views from the venue.
  Low: Water exists nearby but is not part of why customers choose this spot.

nature_park (0–100)
  High: The venue is physically embedded in or at the entrance of a natural
  area — forest, lake, beach, or trail. Customers come here because of nature.
  Low: A natural area exists in the same city, within view, or within walking
  distance but the venue itself is not in that natural setting.

residential (0–100)
  High: The venue primarily serves a local catchment — people arrive on foot
  from surrounding homes. Low visitor or transit footfall from outsiders.
  Low: The area attracts people from beyond the immediate neighbourhood.

office (0–100)
  High: Nearby workplaces generate the dominant customer flow —
  lunchtime crowds, after-work visits, business meetings.
  Low: Offices exist nearby but are not the primary driver of footfall.

shopping_district (0–100)
  High: The venue is inside or directly adjacent to a primary retail zone
  and captures shoppers as its main audience.
  Low: Some shops exist nearby but retail is not the area's defining character.

transport_hub (0–100)
  High: The venue is in or immediately next to a major transit node —
  train station concourse, ferry terminal, bus interchange. Customers
  pass through rather than come specifically to this area.
  Low: A bus stop or station exists within walking distance.

tourist_destination (0–100)
  High: The location itself draws visitors — historic quarter, major
  attraction, well-known landmark. Tourists form a significant share
  of passers-by.
  Low: The city has tourist attractions but this specific area does not
  function as a tourist zone.

Calibration:
- Scores are independent. They do NOT need to sum to 100.
- Most venues will have 1–2 high scores (60+) and the rest low (0–25).
- A score above 60 means that category genuinely shapes why customers
  are here. Do not inflate secondary categories because they are
  "somewhat relevant."
- When in doubt, score lower. Over-scoring creates false signals
  downstream in content generation.

2. demographic_proximity (who PASSES BY this area, 0-100):
   - local_resident: do locals use this area daily?
   - tourist: do tourists visit this area?
   - student: is this a student area (university-dominant)?
   - business_professional: office workers in the area?
   - family: family-oriented area (schools, parks)?

   IMPORTANT: Base demographic scores on actual area character,
   not just proximity to one institution. A single university campus
   in a non-student city should score LOW (10-25), not high.
   Aarhus is a student city. Silkeborg is not.

3. area_type: the single best description from:
   city_centre / waterfront / residential / office / transport_hub /
   shopping_district / tourist_destination / nature_park / mixed_use

4. neighborhood_character: 2-3 sentences in Danish describing the area.
   What kind of place is this? What surrounds it? What is the atmosphere?
   Do NOT mention the specific business. Do NOT give marketing advice.
   
   FIX 1b: Generate neighborhood_character as a factual, city-accurate description.
   Scale the language to the actual city size:
   - Large city (500k+): urban energy, vibrant, cosmopolitan references are appropriate
   - Medium city (50k–200k): focus on local landmarks, the specific street or square,
     community feel, proximity to nature or water if relevant
   - Small town (<50k): local character, slower pace, specific known landmarks
   
   For cities like Silkeborg, Horsens, Viborg (medium-sized Danish cities):
   Reference specific local features (e.g., Silkeborg Søerne, gågaden, Torvet) or
   the natural surroundings — NOT "pulserende byliv" or "byens puls".
   These phrases do not match a city of 50k-100k people.
   
   neighborhood_character must be a factual sentence, not marketing language.
   Example good output for Silkeborg: "Centralt i Silkeborg med gågaden og Torvet
   inden for gangafstand, tæt på Silkeborg Søerne og naturstier."
   Example bad output: "I hjertet af Silkeborgs pulserende byliv med konstant
   aktivitet og urban energi."

Return ONLY valid JSON:
{
  "category_scores": { "city_centre": 0-100, "waterfront": 0-100, ... },
  "demographic_proximity": { "local_resident": 0-100, "tourist": 0-100, ... },
  "area_type": "city_centre",
  "neighborhood_character": "dansk tekst..."
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
