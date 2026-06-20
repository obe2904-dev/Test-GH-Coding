/**
 * Layer 3: Identity Profile Generation
 * 
 * Purpose: Generate business-level brand identity
 * Scope: Business-level (constant across all programmes)
 * Model: gpt-4o (temperature 0.3, max_tokens 1000)
 * 
 * V5.1 UPDATE: Uses professional persona throughout
 * 
 * Output:
 * - brand_essence: 1-2 sentence soul of the business
 * - positioning: 2-3 sentence competitive differentiation
 * - core_values: 3-5 guiding principles
 * - what_makes_us_different: One sentence USP
 * - identity_confidence: 0-1 score
 * - identity_reasoning: Why these values chosen
 * - identity_sources: Array of evidence sources
 */

import type { V5Identity } from './types-v5.ts'
import { getV5Prompt } from './v5-prompts.ts'
import type { ProfessionalPersona } from './professional-persona.ts'
import type { GeographicContext } from './geographic-context.ts'
import type { BusinessTypeDetection } from './business-type-detection.ts'

export interface IdentityProfileInput {
  business: {
    business_name: string;
    business_category: string;
    establishment_type?: string;
    city: string;
    country?: string;
  };
  menu?: {
    items: Array<{
      name: string;
      description?: string;
      category?: string;
      price?: number;
    }>;
  };
  programmes?: Array<{
    programme_type: string;
    programme_name: string;
    time_window: string;
  }>;
  location?: {
    area_type?: string;
    tourist_context?: string;
    neighborhood?: string;
    local_location_reference?: string;  // How locals refer to location (e.g., "ved åen")
    supplier_analysis?: {
      geographic_scope: 'local' | 'regional' | 'national';
      local_count: number;
      regional_count: number;
      national_count: number;
      suppliers?: Array<{
        name: string;
        distance_km: number;
        mentioned_in: string[];
      }>;
    };
  };
  profile?: {
    short_description?: string;
    long_description?: string;
    target_audience?: string;
  };
  opening_hours?: Array<{
    weekday: string;
    open_time: string;
    close_time: string;
    closed: boolean;
  }>;
  // NEW V5.1: Professional persona and context
  professionalPersona?: ProfessionalPersona;
  geographicContext?: GeographicContext;
  businessTypeDetection?: BusinessTypeDetection;
}

export interface IdentityProfileOutput {
  brand_essence: string;
  positioning: string;
  core_values: string[];
  what_makes_us_different: string;
  location_identity?: {                 // Structured location proximity data
    water_proximity?: string;           // Specific water body term
    landmark_proximity?: string;        // Specific landmark term
    full_reference?: string;            // Complete local reference
  };
  identity_confidence: number;
  identity_reasoning: string;
  identity_sources: string[];
}

// System prompt loaded from v5-prompts.ts at runtime via getV5Prompt('identity', language)

function buildIdentityPrompt(input: IdentityProfileInput): string {
  const parts: string[] = [];

  // Business Context
  parts.push(`BUSINESS: ${input.business.business_name}`);
  parts.push(`CATEGORY: ${input.business.business_category || 'restaurant'}`);
  parts.push(`LOCATION: ${input.business.city}, ${input.business.country || 'Danmark'}`);

  if (input.location?.neighborhood) {
    parts.push(`NEIGHBORHOOD: ${input.location.neighborhood}`);
  }

  // Use local_location_reference as single source of truth for location naming
  if (input.location?.local_location_reference) {
    parts.push(`LOCAL REFERENCE: ${input.location.local_location_reference}`);
    parts.push(`CRITICAL: Use EXACTLY "${input.location.local_location_reference}" for location.`);
    parts.push(`Do NOT add city/neighborhood context. Do NOT expand or modify this phrase.`);
  } else if (input.location?.area_type) {
    parts.push(`AREA TYPE: ${input.location.area_type}`);
  }

  if (input.location?.tourist_context) {
    parts.push(`TOURIST CONTEXT: ${input.location.tourist_context}`);
  }

  // Supplier Analysis (verified geographic data)
  if (input.location?.supplier_analysis) {
    const analysis = input.location.supplier_analysis;
    parts.push('');
    parts.push('SUPPLIER ANALYSIS (verified distances):');
    parts.push(`  Geographic Scope: ${analysis.geographic_scope.toUpperCase()}`);
    parts.push(`  Local suppliers (<30km): ${analysis.local_count}`);
    parts.push(`  Regional suppliers (30-100km): ${analysis.regional_count}`);
    parts.push(`  National suppliers (>100km): ${analysis.national_count}`);
    
    if (analysis.suppliers && analysis.suppliers.length > 0) {
      parts.push('  Verified suppliers:');
      analysis.suppliers.forEach(supplier => {
        parts.push(`    - ${supplier.name} (${supplier.distance_km} km)`);
      });
    }
    
    parts.push('');
    parts.push(`IMPORTANT: Use geographic_scope="${analysis.geographic_scope}" for accuracy.`);
    if (analysis.geographic_scope === 'local') {
      parts.push('→ OK to use: "Lokal forankring" + "lokale produkter"');
    } else if (analysis.geographic_scope === 'regional') {
      parts.push('→ Use: "Regional forankring" or "Dansk kvalitet" + "regionale/danske råvarer"');
    } else {
      parts.push('→ Use: "Dansk kvalitet" + "danske råvarer"');
    }
  }

  parts.push('');

  // User Profile (if exists - Tier 1 data)
  if (input.profile?.short_description) {
    parts.push(`OWNER DESCRIPTION: ${input.profile.short_description}`);
  }

  if (input.profile?.long_description) {
    parts.push(`EXTENDED DESCRIPTION: ${input.profile.long_description}`);
  }

  if (input.profile?.target_audience) {
    parts.push(`TARGET AUDIENCE: ${input.profile.target_audience}`);
  }

  if (input.profile) {
    parts.push('');
  }

  // Programmes Context (Layer 1 output)
  if (input.programmes && input.programmes.length > 0) {
    parts.push(`PROGRAMMES (${input.programmes.length}):`);
    input.programmes.forEach(prog => {
      parts.push(`  - ${prog.programme_name} (${prog.time_window})`);
    });
    parts.push('');

    // Interpret programme count
    if (input.programmes.length >= 4) {
      parts.push('INTERPRETATION: All-day café/restaurant (bred tilgængelighed)');
    } else if (input.programmes.length === 1) {
      const progType = input.programmes[0].programme_type;
      if (progType === 'dinner') {
        parts.push('INTERPRETATION: Aftenrestaurant (fokuseret dining)');
      } else if (progType === 'lunch') {
        parts.push('INTERPRETATION: Frokoststed (dagtimested)');
      }
    } else if (input.programmes.length === 2) {
      parts.push('INTERPRETATION: Dagtimested eller niche-fokuseret');
    }
    parts.push('');
  }

  // Opening Hours (day-specific times)
  if (input.opening_hours && input.opening_hours.length > 0) {
    parts.push('OPENING HOURS (day-specific):');
    
    // Group by similar times
    const weekdayHours = input.opening_hours.filter(h => 
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(h.weekday) && !h.closed
    );
    const weekendHours = input.opening_hours.filter(h => 
      ['saturday', 'sunday'].includes(h.weekday) && !h.closed
    );
    
    // Show all days for precision
    input.opening_hours.forEach(h => {
      if (h.closed) {
        parts.push(`  ${h.weekday}: CLOSED`);
      } else {
        // Format time as HH:MM
        const openTime = h.open_time.substring(0, 5);  // "09:30:00" -> "09:30"
        const closeTime = h.close_time.substring(0, 5);
        parts.push(`  ${h.weekday}: ${openTime} - ${closeTime}`);
      }
    });
    
    parts.push('');
    parts.push('IMPORTANT: Use day-specific times, NOT generic "kl. 9" or "kl. 23"');
    parts.push('Example: "Åbent 09:30 på hverdage, 09:00 i weekenden" (if times differ)');
    parts.push('');
  }

  // Menu Context (first 15 items for identity signals)
  if (input.menu?.items && input.menu.items.length > 0) {
    parts.push(`MENU (${input.menu.items.length} items):`);
    const menuSample = input.menu.items.slice(0, 15);
    menuSample.forEach(item => {
      const desc = item.description ? ` - ${item.description}` : '';
      const price = item.price ? ` (${item.price} kr)` : '';
      parts.push(`  - ${item.name}${desc}${price}`);
    });
    if (input.menu.items.length > 15) {
      parts.push(`  ... og ${input.menu.items.length - 15} flere retter`);
    }
    parts.push('');
  }

  parts.push('OPGAVE: Generer business-level brand identity baseret på ovenstående data.');
  parts.push('Husk: Faktuel over aspirationel, specifik over generisk, beviser for alle værdier.');

  return parts.join('\n');
}

/**
 * Extract structured location identity from business inputs
 * Priority: Business descriptions > Menu items > local_location_reference
 * Detects how the business actually describes its location
 */
function extractLocationIdentity(input: IdentityProfileInput): {
  water_proximity?: string;
  landmark_proximity?: string;
  full_reference?: string;
} | undefined {
  
  // Collect all text sources (prioritize business's own language)
  const textSources: string[] = [];
  
  // Priority 1: Business profile descriptions (owner's voice)
  if (input.profile?.short_description) textSources.push(input.profile.short_description);
  if (input.profile?.long_description) textSources.push(input.profile.long_description);
  
  // Priority 2: Menu item descriptions (product copy mentions location)
  if (input.menu?.items) {
    input.menu.items.slice(0, 30).forEach(item => {
      if (item.description) textSources.push(item.description);
    });
  }
  
  // Priority 3: Location intelligence reference
  if (input.location?.local_location_reference) {
    textSources.push(input.location.local_location_reference);
  }
  
  if (textSources.length === 0) return undefined;

  const combinedText = textSources.join(' ').toLowerCase();

  const locationIdentity: {
    water_proximity?: string;
    landmark_proximity?: string;
    full_reference?: string;
  } = {};

  // Water body patterns (Danish, Swedish, German)
  // Matches: "ved åen", "i åen", "ved havet", etc.
  const waterPatterns = [
    { pattern: /\b(?:ved|i|vid|am|langs|nær)\s+(åen|ån)\b/i, term: 'åen' },
    { pattern: /\b(?:ved|i|vid|am|langs|nær)\s+(bugten|viken)\b/i, term: 'bugten' },
    { pattern: /\b(?:ved|i|vid|am|langs|nær)\s+(havet|Meer)\b/i, term: 'havet' },
    { pattern: /\b(?:ved|i|vid|am|langs|nær)\s+(søen|sjön|See)\b/i, term: 'søen' },
    { pattern: /\b(?:ved|i|vid|am|langs|nær)\s+(fjorden|Fjord)\b/i, term: 'fjorden' },
    { pattern: /\b(?:ved|i|vid|am|langs|nær)\s+(kanalen|Kanal)\b/i, term: 'kanalen' },
    { pattern: /\b(?:ved|i|vid|am|langs|nær)\s+(havnen|hamnen|Hafen)\b/i, term: 'havnen' },
    { pattern: /\b(?:ved|i|vid|am|langs|nær)\s+(stranden|kusten|Strand)\b/i, term: 'stranden' },
    { pattern: /\b(?:ved|i|vid|am|langs|nær)\s+(kysten)\b/i, term: 'kysten' },
    { pattern: /\b(?:ved|i|vid|am|langs|nær)\s+(vigen)\b/i, term: 'vigen' },
    { pattern: /\b(?:ved|i|vid|am|langs|nær)\s+(Bach)\b/i, term: 'Bach' },
  ];

  for (const { pattern, term } of waterPatterns) {
    const match = combinedText.match(pattern);
    if (match) {
      locationIdentity.water_proximity = term;
      // Extract the full phrase (e.g., "ved åen")
      const fullMatch = match[0].trim();
      locationIdentity.full_reference = fullMatch;
      break;
    }
  }

  // Landmark/District patterns (specific named locations)
  // Matches: "i Nyhavn", "ved Nyhavn", "i Indre By", "ved domkirken", etc.
  const landmarkPatterns = [
    // Famous Copenhagen districts/landmarks
    { pattern: /\b(?:i|ved|på)\s+(Nyhavn)\b/i, term: 'Nyhavn' },
    { pattern: /\b(?:i|ved|på)\s+(Indre By)\b/i, term: 'Indre By' },
    { pattern: /\b(?:i|ved|på)\s+(Vesterbro)\b/i, term: 'Vesterbro' },
    { pattern: /\b(?:i|ved|på)\s+(Nørrebro)\b/i, term: 'Nørrebro' },
    { pattern: /\b(?:i|ved|på)\s+(Frederiksberg)\b/i, term: 'Frederiksberg' },
    { pattern: /\b(?:i|ved|på)\s+(Christianshavn)\b/i, term: 'Christianshavn' },
    // Generic landmarks
    { pattern: /\bved\s+(domkirken|kirken)\b/i, term: 'domkirken' },
    { pattern: /\bved\s+(slottet|rådhuset)\b/i, term: 'slottet' },
    { pattern: /\bved\s+(torvet|pladsen)\b/i, term: 'torvet' },
    { pattern: /\bved\s+(stationen)\b/i, term: 'stationen' },
    { pattern: /\bved\s+(parken)\b/i, term: 'parken' },
  ];

  // Only detect landmark if NO water body found (water takes priority)
  if (!locationIdentity.water_proximity) {
    for (const { pattern, term } of landmarkPatterns) {
      const match = combinedText.match(pattern);
      if (match) {
        locationIdentity.landmark_proximity = term;
        const fullMatch = match[0].trim();
        locationIdentity.full_reference = fullMatch;
        break;
      }
    }
  }

  // Only return if we found something meaningful
  if (locationIdentity.water_proximity || locationIdentity.landmark_proximity) {
    return locationIdentity;
  }

  return undefined;
}

function validateIdentityProfile(output: any): IdentityProfileOutput {
  // Validate required fields
  if (!output.brand_essence || typeof output.brand_essence !== 'string') {
    throw new Error('Missing or invalid brand_essence');
  }

  if (!output.positioning || typeof output.positioning !== 'string') {
    throw new Error('Missing or invalid positioning');
  }

  if (!Array.isArray(output.core_values) || output.core_values.length < 3 || output.core_values.length > 5) {
    throw new Error('core_values must be array of 3-5 items');
  }

  if (!output.what_makes_us_different || typeof output.what_makes_us_different !== 'string') {
    throw new Error('Missing or invalid what_makes_us_different');
  }

  // Validate metadata
  const confidence = typeof output.identity_confidence === 'number' 
    ? output.identity_confidence 
    : 0.5;

  if (confidence < 0 || confidence > 1) {
    throw new Error('identity_confidence must be between 0 and 1');
  }

  // Check for generic phrases (quality gate)
  const genericPhrases = [
    'god kvalitet',
    'bedste oplevelse',
    'eksklusiv gastronomi',
    'unik atmosfære',
    'passion for mad',
  ];

  const combinedText = `${output.brand_essence} ${output.positioning} ${output.core_values.join(' ')} ${output.what_makes_us_different}`.toLowerCase();

  genericPhrases.forEach(phrase => {
    if (combinedText.includes(phrase)) {
      console.warn(`⚠️ Generic phrase detected: "${phrase}"`);
    }
  });

  return {
    brand_essence: output.brand_essence.trim(),
    positioning: output.positioning.trim(),
    core_values: output.core_values.map((v: string) => v.trim()),
    what_makes_us_different: output.what_makes_us_different.trim(),
    identity_confidence: confidence,
    identity_reasoning: output.identity_reasoning || '',
    identity_sources: Array.isArray(output.identity_sources) ? output.identity_sources : [],
  };
}

export async function generateIdentityProfile(
  input: IdentityProfileInput,
  openaiApiKey: string,
  language: string = 'da'  // Multi-language support (default Danish)
): Promise<IdentityProfileOutput> {
  
  // NEW V5.1: Use professional persona if available, otherwise generic system prompt
  const systemPrompt = input.professionalPersona 
    ? buildPersonaSystemPrompt(input.professionalPersona, input.geographicContext, language)
    : getV5Prompt('identity', language);

  if (input.professionalPersona) {
    console.log(`✅ Using professional persona: ${input.businessTypeDetection?.professional_domain || 'unknown domain'}`);
  }

  // Build user prompt with business data
  const userPrompt = buildIdentityPrompt(input);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(`Failed to parse AI response: ${content}`);
  }

  const validated = validateIdentityProfile(parsed);

  // Extract structured location identity from ALL business inputs
  // Priority: business descriptions > menu items > local_location_reference
  const locationIdentity = extractLocationIdentity(input);
  if (locationIdentity) {
    validated.location_identity = locationIdentity;
    console.log(`📍 Location detected: ${locationIdentity.full_reference} → water: ${locationIdentity.water_proximity || 'none'}, landmark: ${locationIdentity.landmark_proximity || 'none'}`);
  }

  console.log('✅ Identity Profile generated successfully');
  console.log(`   Confidence: ${validated.identity_confidence.toFixed(2)}`);
  console.log(`   Sources: ${validated.identity_sources.join(', ')}`);

  return validated;
}

/**
 * NEW V5.1: Build system prompt using professional persona
 */
function buildPersonaSystemPrompt(
  persona: ProfessionalPersona,
  geographicContext: GeographicContext | undefined,
  language: string
): string {
  let prompt = persona.system_persona;
  
  // Add geographic narrative if available
  if (geographicContext) {
    prompt += `\n\n${geographicContext.narrative}`;
  }
  
  // Add task-specific instruction for Layer 3
  prompt += `\n\nDIN OPGAVE (Layer 3: Identity Profile):
Generer business-level brand identity baseret på data nedenfor.

OUTPUT FORMAT (JSON):
{
  "brand_essence": "1-2 sætninger - businessens sjæl",
  "positioning": "2-3 sætninger - konkurrencemæssig differentiation",
  "core_values": ["værdi 1", "værdi 2", "værdi 3"],
  "what_makes_us_different": "Én sætning - USP",
  "identity_confidence": 0.8,
  "identity_reasoning": "Hvorfor disse værdier valgt",
  "identity_sources": ["kilde 1", "kilde 2"]
}

VIGTIGE KRAV:
- Faktuel over aspirationel (konkrete facts, ikke marketing-fluff)
- Specifik over generisk (brug business-specifikke detaljer)
- Beviser for alle værdier (reference til menu, location, programmes)
- UNDGÅ: "god kvalitet", "bedste oplevelse", "passion for mad"
- BRUG: Konkrete facts fra menu, location, supplier data`;
  
  return prompt;
}
