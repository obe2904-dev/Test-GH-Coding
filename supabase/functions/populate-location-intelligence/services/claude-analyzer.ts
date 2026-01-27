/**
 * AI Analyzer Service
 * Uses GPT-4o to enhance location intelligence with cultural context
 */

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
   * Analyze location with GPT-4o to extract deep cultural context
   */
  async analyzeLocationContext(input: ClaudeAnalysisInput): Promise<ClaudeAnalysisOutput> {
    const prompt = this.buildPrompt(input);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 1500,
          temperature: 0.7,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: 'You are a location analysis assistant. Always respond with valid JSON matching the requested structure.',
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
        console.error('OpenAI API error response:', errorText);
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      // Parse the structured JSON response
      const analysis = JSON.parse(content);

      // STEP 2: Proofread the Danish text with GPT-4o
      console.log('📝 Proofreading Danish text...');
      const proofreadText = await this.proofreadDanishText(analysis.rich_neighborhood_character);
      analysis.rich_neighborhood_character = proofreadText;

      return analysis;
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      
      // Return fallback if OpenAI fails (don't break the entire flow)
      return this.createFallbackAnalysis(input);
    }
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
