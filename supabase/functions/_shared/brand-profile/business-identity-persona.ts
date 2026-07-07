// ============================================================================
// BUSINESS IDENTITY PERSONA - ENHANCED FACTS APPROACH
// ============================================================================
// Generates business-specific persona as COMPREHENSIVE FACTS (~150 words)
// 
// STRUCTURE:
// - "Du er Marketing ekspert for [Business Name]."
// - FORRETNING: [business_character restructured with specific facts]
// - LOKATION: [Multi-dimensional location intelligence with scores]
// - TILBUD: [Programmes with time windows]
// - KULINARISK KARAKTER: [Fusion patterns, signature themes, specialties]
// 
// PURPOSE:
// - Serves as comprehensive business intelligence for ALL tasks
// - Same persona used across: Brand Profile, Weekly Plan, Ideas, Texts
// - Task-specific instructions added separately when calling AI
// 
// NOT INCLUDED:
// - No role instruction (added per task)
// - No competition context (belongs in Layer 2 differentiation)
// - No målgrupper (loaded separately per programme/task)
// - No marketing strategy or voice rules (that's in Brand Profile layers)
// ============================================================================

import OpenAI from 'https://deno.land/x/openai@v4.28.0/mod.ts';
import type { CityContext } from './city-context-ai.ts';
import { sanitizeString } from './fallbacks.ts';

export interface BusinessData {
  name: string;
  local_location_reference?: string | null; // "ved åen", "i Nyhavn", etc.
  city: string;
  postal_code?: string | null;
  address?: string | null;
  
  // Location Intelligence (NEW - multi-dimensional positioning)
  location_intelligence?: {
    neighborhood?: string;
    neighborhood_character?: string;
    area_type?: string;
    category_scores?: {
      waterfront?: number;
      city_centre?: number;
      tourist?: number;
      student?: number;
      residential?: number;
    };
    location_marketing_hooks?: string[];
    is_strategy_driver?: string; // Which location type drives strategy
  };
  
  // Menu Intelligence (NEW - cross-menu synthesis)
  menu_overview_summary?: {
    cross_menu_summary?: string;  // AI-generated fusion patterns
    signature_themes?: string[];   // AI-generated theme labels
    gastronomic_profile?: string;  // 95-word strategic essence
  };
  
  // NOTE (June 2026): strategic_audience_segments removed from persona
  // Active segments now injected dynamically at runtime from business_programme_profiles
  
  // Programmes (brunch, frokost, bar, etc.) with time windows
  programmes: Array<{
    type: string;
    label: string;
    time_windows?: string[];  // ["07:00-11:00"]
    operating_days?: string[]; // ["monday", "tuesday", ...]
  }>;
  
  // Menu summaries (AI-generated per service period - legacy, kept for compatibility)
  menu_summaries: Array<{
    summary: string;
    service_period: string;
  }>;
  
  // Opening hours (for key hours extraction)
  opening_hours: Array<{
    day_of_week: string;
    opens_at: string;
    closes_at: string;
  }>;
  
  // Kitchen close time (separate from bar close time)
  kitchen_close_time?: string | null;
  
  // Features
  features?: {
    outdoor_seating?: boolean;
    kids_menu?: boolean;
    takeaway?: boolean;
    delivery?: boolean;
    reservations?: boolean;
    live_music?: boolean;
    wifi?: boolean;
  };
}

export interface BusinessIdentityPersona {
  system_persona: string;  // The actual persona text (~150 words Danish)
  metadata: {
    word_count: number;
    generated_at: string;
    om_os_length: number;
    has_location_intelligence: boolean;
    has_menu_overview: boolean;
    location_dimensions: number; // How many location types scored high
    signature_themes_count: number;
  };
}

// ============================================================================
// GENERATE BUSINESS IDENTITY PERSONA (PURE FACTS APPROACH)
// ============================================================================

export async function generateBusinessIdentityPersona(
  businessData: BusinessData,
  cityContext: CityContext | null,
  businessCharacter: string,
  openaiClient: OpenAI
): Promise<BusinessIdentityPersona> {
  
  // 1. Build comprehensive prompt with location + menu intelligence
  const prompt = buildEnhancedFactsPrompt(businessData, businessCharacter);
  
  // 2. Generate persona with AI
  const rawPersona = await generatePersonaWithAI(prompt, openaiClient);
  
  // 3. SANITIZE BANNED WORDS to prevent seed contamination
  // Business character text may contain "lækker", "hyggelig" etc. - these must not propagate
  // to downstream text generation as positive examples
  const persona = sanitizeString(rawPersona);
  
  if (persona !== rawPersona) {
    console.log('[Persona] ⚠️  Sanitized banned words from generated persona');
  }
  
  // 4. Calculate metadata
  const locationDimensions = businessData.location_intelligence?.category_scores 
    ? Object.entries(businessData.location_intelligence.category_scores)
        .filter(([_, score]) => score && score >= 50)
        .sort(([_, a], [__, b]) => (b || 0) - (a || 0))
        .slice(0, 3).length
    : 0;
  
  const signatureThemesCount = businessData.menu_overview_summary?.signature_themes?.length || 0;
  
  // 5. Return with metadata
  return {
    system_persona: persona,
    metadata: {
      word_count: persona.split(/\s+/).length,
      generated_at: new Date().toISOString(),
      om_os_length: businessCharacter.length,
      has_location_intelligence: !!businessData.location_intelligence,
      has_menu_overview: !!businessData.menu_overview_summary,
      location_dimensions: locationDimensions,
      signature_themes_count: signatureThemesCount
    }
  };
}

// ============================================================================
// DANISH TRANSLATION MAPPINGS
// ============================================================================

const LOCATION_CATEGORY_DANISH: Record<string, string> = {
  waterfront: 'vandkant',
  city_centre: 'bymidte',
  tourist: 'turister',
  student: 'studerende',
  residential: 'boligområde',
  transport_hub: 'transportknudepunkt',
  shopping_district: 'shoppingområde',
  office: 'kontorområde',
  destination: 'destination',
  nature_park: 'naturpark',
  mixed_use: 'blandet område'
};

// ============================================================================
// BUILD ENHANCED FACTS PROMPT
// ============================================================================

function buildEnhancedFactsPrompt(
  businessData: BusinessData,
  businessCharacter: string
): string {
  
  const parts: string[] = [];
  
  parts.push(`You are creating a comprehensive business intelligence persona for AI content generation.`);
  parts.push(``);
  parts.push(`Business: ${businessData.name}`);
  parts.push(`City: ${businessData.city}`);
  if (businessData.local_location_reference) {
    parts.push(`Local Reference: ${businessData.local_location_reference}`);
  }
  if (businessData.address) {
    parts.push(`Address: ${businessData.address}`);
  }
  parts.push(``);
  
  // === LOCATION INTELLIGENCE ===
  if (businessData.location_intelligence) {
    parts.push(`=== LOCATION INTELLIGENCE ===`);
    
    // Fallback chain: local_location_reference > neighborhood > city
    const locationContext = businessData.location_intelligence.local_location_reference || 
                           businessData.location_intelligence.neighborhood || 
                           businessData.city;
    if (locationContext) {
      parts.push(`Neighborhood: ${locationContext}`);
    }
    
    if (businessData.location_intelligence.neighborhood_character) {
      parts.push(`Character: ${businessData.location_intelligence.neighborhood_character}`);
    }
    
    if (businessData.location_intelligence.area_type) {
      parts.push(`Area Type: ${businessData.location_intelligence.area_type}`);
    }
    
    // Strategic Audience Segments (NEW - June 12, 2026)
    // Use business-specific segments instead of generic location category_scores
    if (businessData.location_intelligence.location_marketing_hooks && businessData.location_intelligence.location_marketing_hooks.length > 0) {
      parts.push(`Marketing Hooks: ${businessData.location_intelligence.location_marketing_hooks.join(', ')}`);
    }
    
    parts.push(``);
  }
  
  // === PROGRAMMES ===
  if (businessData.programmes && businessData.programmes.length > 0) {
    parts.push(`=== PROGRAMMES ===`);
    businessData.programmes.forEach(prog => {
      const timeWindow = prog.time_windows && prog.time_windows.length > 0 
        ? ` (${prog.time_windows.join(', ')})` 
        : '';
      // Don't show operating_days - they're internal English field names
      parts.push(`- ${prog.label}${timeWindow}`);
    });
    parts.push(``);
  }
  
  // === MENU INTELLIGENCE ===
  if (businessData.menu_overview_summary) {
    parts.push(`=== MENU INTELLIGENCE ===`);
    
    if (businessData.menu_overview_summary.signature_themes && businessData.menu_overview_summary.signature_themes.length > 0) {
      parts.push(`Signatur-temaer: ${businessData.menu_overview_summary.signature_themes.join(', ')}`);
      parts.push(``);
    }
    
    if (businessData.menu_overview_summary.cross_menu_summary) {
      parts.push(`Tværgående menu-analyse:`);
      parts.push(businessData.menu_overview_summary.cross_menu_summary);
      parts.push(``);
    }
    
    if (businessData.menu_overview_summary.gastronomic_profile) {
      parts.push(`Gastronomisk profil: ${businessData.menu_overview_summary.gastronomic_profile}`);
      parts.push(``);
    }
  }
  
  // === BUSINESS CHARACTER (FACTUAL DESCRIPTION) ===
  parts.push(`=== BUSINESS CHARACTER ===`);
  parts.push(businessCharacter || 'Not provided');
  parts.push(``);
  
  // === INSTRUCTIONS ===
  parts.push(`=== GENERATION INSTRUCTIONS ===`);
  parts.push(`Create a comprehensive business intelligence persona (~200 words) with this structure:`);
  parts.push(``);
  parts.push(`Du er Marketing ekspert for ${businessData.name}.`);
  parts.push(``);
  parts.push(`FORRETNING:`);
  parts.push(`[Restructure BUSINESS CHARACTER text into concise, factual sentences]`);
  parts.push(`[Include: location, service offerings, specific hours, specific dishes, facilities]`);
  parts.push(`[Format: Short declarative sentences, no marketing language]`);
  parts.push(``);
  parts.push(`LOKATION:`);
  parts.push(`- [Adresse + lokal reference]`);
  parts.push(`- [Top 3 flerdimensionel positionering med scores (kun hvis ≥50) - BRUG DANSKE NAVNE]`);
  parts.push(`- [Unik lokationskarakter og -kendetegn]`);
  parts.push(``);
  parts.push(`TILBUD:`);
  parts.push(`- [Liste programmer med tidsvindue - INGEN dage]`);
  parts.push(``);
  parts.push(`KULINARISK KARAKTER:`);
  parts.push(`- [KONKRETE fusionsmønstre fra signatur-temaer - NOT generic]`);
  parts.push(`- [SPECIFIKKE hjemmelavede specialiteter - brug faktiske temanavne]`);
  parts.push(`- [All-day positionering hvis relevant]`);
  parts.push(``);
  parts.push(`KRITISKE REGLER:`);
  parts.push(`1. FORRETNING: Restructure BUSINESS CHARACTER into concise facts - location, offerings, hours, dishes, facilities`);
  parts.push(`   - Use specific dish names if provided (pariserbøf, bøf & bearnaise, etc.)`);
  parts.push(`   - Use exact hours if provided (09:00-17:30)`);
  parts.push(`   - NO marketing language ("perfekte", "fantastisk", "lækker", "hyggelig")`);
  parts.push(`2. LOKATION: Vis top 3 flerdimensionel positionering (kun scores ≥50) - OVERSATTE kategorier`);
  parts.push(`3. KULINARISK: Træk KONKRETE detaljer fra signatur-temaer og tværgående analyse`);
  parts.push(`   - List specific dishes and ingredients from menu intelligence`);
  parts.push(`   - Include fusion patterns ("Europæisk og amerikansk fusion med fransk fokus")`);
  parts.push(`4. Skriv på DANSK (undtagen bruger-indhold som menupunkter)`);
  parts.push(`5. Total ~200 ord (FORRETNING longer now with details)`);
  parts.push(`6. INGEN konkurrencekontext (det hører til Layer 2)`);
  parts.push(`7. INGEN marketingstrategi eller stemme-regler`);
  parts.push(`8. KUN RENE BUSINESS INTELLIGENCE FAKTA`);
  parts.push(`9. KOMPLET KULINARISK KARAKTER afsnit - må IKKE afbrydes eller forkortes`);
  
  return parts.join('\n');
}

// ============================================================================
// GENERATE WITH AI
// ============================================================================

async function generatePersonaWithAI(
  prompt: string,
  openaiClient: OpenAI
): Promise<string> {
  try {
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o',  // Use GPT-4o for high-quality persona generation
      messages: [
        { 
          role: 'system', 
          content: `You are a business intelligence expert. Generate comprehensive, factual business personas in Danish.

CRITICAL RULES:
1. Start with "Du er Marketing ekspert for [Business Name]."
2. Use exactly FOUR sections: "FORRETNING:", "LOKATION:", "TILBUD:", "KULINARISK KARAKTER:"
3. ~200 words total (FORRETNING section now longer with specific details)
4. State PURE FACTS only (no marketing strategy, no voice rules, no task instructions)
5. Write in Danish
6. In FORRETNING section: Restructure BUSINESS CHARACTER into concise factual sentences
   - Include: location, service offerings, specific hours if provided, specific dishes if available, facilities
   - NO marketing language: "perfekte", "fantastisk", "lækker", "hyggelig"
   - Format: "Café ved åen i Aarhus med brunch, frokost og aftenmenuer. Frokostservering kl. 09:00-17:30..."
7. In LOKATION section: Address, key location attributes, neighborhood character, primary USP if clear
8. In TILBUD section: List programmes with time windows in CAPS format (BRUNCH, FROKOST, AFTEN, BAR)
9. In KULINARISK KARAKTER section: Fusion patterns, signature themes, specialties from menu intelligence
   - List SPECIFIC dishes with names (Moules Mariniers, Club Sandwich ala Faust, etc.)
   - Include preparation methods (hjemmelavet, friskbagt)
   - Include local suppliers if known (brunchpølser fra Højer)
   - COMPLETE THIS SECTION FULLY - do NOT truncate
10. NEVER add role instruction at the end
11. NEVER include location scores or generic demographic data
12. NEVER include competition context (belongs in Layer 2)
13. Just provide comprehensive business intelligence facts for AI to use across different tasks

Eksempel format:
Du er Marketing ekspert for Café Faust.

FORRETNING:
Café ved åen i Aarhus med brunch, frokost og 3-retters aftenmenuer. Frokostservering kl. 09:00-17:30 med retter som pariserbøf, bøf & bearnaise og falafelsalat. Bar med cocktails åbent til kl. 02:00 i weekenden. Udeservering og takeaway.

LOKATION:
- Åboulevarden 38, 8000 Aarhus
- Ikonisk gade langs Aarhus Å med caféliv, restauranter og aftenliv
- Primær USP: beliggenhed direkte ved åen

TILBUD:
- BRUNCH (09:00-14:00)
- FROKOST (09:00-17:30)
- AFTEN (17:30-21:30)
- BAR (åbent til 02:00 i weekenden)

KULINARISK KARAKTER:
- Europæisk og amerikansk fusion med fransk og italiensk fokus — Moules Mariniers, Vol au Vent, Club Sandwich ala Faust
- Klassiske danske retter med moderne twist — pariserbøf, bøf & bearnaise, smørrebrød
- Vegetariske og veganske muligheder — Falafel Burger, Falafelsalat
- Hjemmelavede elementer: hjemmelavet dressing, friskbagt brød, hjemmelavet Nutella
- Lokale råvarer: brunchpølser fra Højer, oste fra Arla Unika
- Social spiseoplevelse: tapas, ost og charcuteri
- Bar-program med klassiske cocktails og moderne twists — Gin Hass, Amaretto Sour
- All-day dining fra morgenmad til sene drinks` 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,  // Lower temperature for factual accuracy
      max_tokens: 800    // ~200 words with detailed FORRETNING section
    });

    const persona = completion.choices[0].message.content?.trim();
    
    if (!persona) {
      throw new Error('Empty AI response for persona generation');
    }
    
    // Validate: Must start with "Du er Marketing ekspert"
    if (!persona.startsWith('Du er Marketing ekspert')) {
      console.warn('[Persona] AI response does not start correctly - attempting fix');
      // Try to extract business name from persona content
      const nameMatch = prompt.match(/Business: ([^\n]+)/);
      const businessName = nameMatch ? nameMatch[1] : 'virksomheden';
      return `Du er Marketing ekspert for ${businessName}.\n\n${persona}`;
    }
    
    return persona;
    
  } catch (error) {
    console.error('[Persona] AI generation error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to generate persona: ${errorMessage}`);
  }
}
