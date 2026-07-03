// ============================================================================
// AI-GENERATED CITY CONTEXT WITH CACHING
// ============================================================================
// HYBRID Persona Approach: Generate city context on-demand for ANY city
// Replaces hardcoded city lists with AI generation + 90-day cache
// Supports international expansion (Denmark, Germany, Sweden, etc.)
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import OpenAI from 'https://deno.land/x/openai@v4.28.0/mod.ts';

export type CitySize = 'small_town' | 'medium_city' | 'major_city' | 'capital';

export interface CityContext {
  city: string;
  country: string;
  population: number;
  city_size: CitySize;
  cultural_context: string; // AI-generated, 20-30 words max
  tone: string;
  characteristics: string[];
  cached_until: string;
  ai_generated: boolean;
}

// ============================================================================
// GET CITY CONTEXT (with caching)
// ============================================================================

export async function getCityContext(
  city: string,
  country: string = 'Denmark',
  supabaseClient: ReturnType<typeof createClient>,
  openaiClient: OpenAI
): Promise<CityContext | null> {
  if (!city) return null;

  // 1. Check cache first
  const cached = await getCachedCityContext(city, country, supabaseClient);
  if (cached) {
    console.log(`[City Context] Cache HIT: ${city}, ${country}`);
    return cached;
  }

  // 2. Cache MISS - Generate with AI
  console.log(`[City Context] Cache MISS: ${city}, ${country} - Generating with AI`);
  const generated = await generateCityContextWithAI(city, country, openaiClient);
  
  if (!generated) {
    console.error(`[City Context] AI generation FAILED for ${city}, ${country}`);
    return null;
  }

  // 3. Store in cache (90-day expiry)
  const stored = await storeCityContext(generated, supabaseClient);
  
  return stored;
}

// ============================================================================
// CHECK CACHE
// ============================================================================

async function getCachedCityContext(
  city: string,
  country: string,
  supabaseClient: ReturnType<typeof createClient>
): Promise<CityContext | null> {
  const { data, error } = await supabaseClient
    .from('city_context_cache')
    .select('*')
    .eq('city', city)
    .eq('country', country)
    .gt('cached_until', new Date().toISOString()) // Only non-expired
    .single();

  if (error || !data) {
    return null;
  }

  // Type assertion since DB types not auto-generated
  const row = data as any;

  return {
    city: row.city,
    country: row.country,
    population: row.population,
    city_size: row.city_size as CitySize,
    cultural_context: row.cultural_context,
    tone: row.tone,
    characteristics: row.characteristics || [],
    cached_until: row.cached_until,
    ai_generated: row.ai_generated
  };
}

// ============================================================================
// AI GENERATION
// ============================================================================

async function generateCityContextWithAI(
  city: string,
  country: string,
  openaiClient: OpenAI
): Promise<CityContext | null> {
  try {
    const prompt = `Generate city context for business persona creation.

City: ${city}
Country: ${country}

Provide:
1. Population (approximate, integer)
2. City size category: "small_town" (< 50k), "medium_city" (50k-200k), "major_city" (200k-500k), or "capital" (capital city or > 500k)
3. Cultural context: ONE sentence, 20-30 words max, in Danish. Example: "350k city, universitetsby, voksende kulturscene"
4. Tone suggestion: Brief guidance for business voice in this city. Example: "Casual og tilgængelig"
5. Characteristics: 3-5 brief keywords

Respond ONLY with valid JSON:
{
  "population": 350000,
  "city_size": "major_city",
  "cultural_context": "Danmarks næststørste by, stor studiepopulation, voksende kulturscene",
  "tone": "Casual og tilgængelig",
  "characteristics": ["university_town", "second_city", "cultural_hub"]
}`;

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a geographic intelligence assistant. Generate accurate, concise city context for business marketing personas. Respond ONLY with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 300
    });

    const responseText = completion.choices[0].message.content?.trim();
    if (!responseText) {
      throw new Error('Empty AI response');
    }

    // Parse JSON response
    const parsed = JSON.parse(responseText);

    // Validate
    if (!parsed.population || !parsed.city_size || !parsed.cultural_context || !parsed.tone || !parsed.characteristics) {
      throw new Error('Incomplete AI response');
    }

    // Validate city_size enum
    const validSizes: CitySize[] = ['small_town', 'medium_city', 'major_city', 'capital'];
    if (!validSizes.includes(parsed.city_size)) {
      throw new Error(`Invalid city_size: ${parsed.city_size}`);
    }

    return {
      city,
      country,
      population: parsed.population,
      city_size: parsed.city_size,
      cultural_context: parsed.cultural_context,
      tone: parsed.tone,
      characteristics: parsed.characteristics,
      cached_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
      ai_generated: true
    };

  } catch (error) {
    console.error('[City Context] AI generation error:', error);
    return null;
  }
}

// ============================================================================
// STORE IN CACHE
// ============================================================================

async function storeCityContext(
  context: CityContext,
  supabaseClient: ReturnType<typeof createClient>
): Promise<CityContext> {
  const { error } = await supabaseClient
    .from('city_context_cache')
    .upsert({
      city: context.city,
      country: context.country,
      population: context.population,
      city_size: context.city_size,
      cultural_context: context.cultural_context,
      tone: context.tone,
      characteristics: context.characteristics,
      ai_generated: context.ai_generated,
      cached_at: new Date().toISOString(),
      cached_until: context.cached_until,
      generation_model: 'gpt-4o-mini'
    } as any, {  // Type assertion since DB types not auto-generated
      onConflict: 'city,country'
    });

  if (error) {
    console.error('[City Context] Cache storage error:', error);
    // Continue anyway, return generated context even if cache storage failed
  }

  return context;
}

// ============================================================================
// FALLBACK: Get city from postal code (Denmark only)
// ============================================================================

export function getCityFromPostalCode(postalCode: string | null): string | null {
  if (!postalCode) return null;
  
  const code = parseInt(postalCode);
  if (isNaN(code)) return null;
  
  // København (Capital Region): 1000-2999
  if (code >= 1000 && code <= 2999) return 'København';
  
  // Aarhus: 8000-8270
  if (code >= 8000 && code <= 8270) return 'Aarhus';
  
  // Odense: 5000-5999
  if (code >= 5000 && code <= 5999) return 'Odense';
  
  // Aalborg: 9000-9999
  if (code >= 9000 && code <= 9999) return 'Aalborg';
  
  // Esbjerg: 6700-6799
  if (code >= 6700 && code <= 6799) return 'Esbjerg';
  
  // Randers: 8900-8999
  if (code >= 8900 && code <= 8999) return 'Randers';
  
  // Kolding: 6000-6099
  if (code >= 6000 && code <= 6099) return 'Kolding';
  
  // Horsens: 8700-8799
  if (code >= 8700 && code <= 8799) return 'Horsens';
  
  // Vejle: 7100-7199
  if (code >= 7100 && code <= 7199) return 'Vejle';
  
  // Roskilde: 4000-4099
  if (code >= 4000 && code <= 4099) return 'Roskilde';
  
  // Herning: 7400-7499
  if (code >= 7400 && code <= 7499) return 'Herning';
  
  // Helsingør: 3000-3099
  if (code >= 3000 && code <= 3099) return 'Helsingør';
  
  // Silkeborg: 8600-8699
  if (code >= 8600 && code <= 8699) return 'Silkeborg';
  
  // Næstved: 4700-4799
  if (code >= 4700 && code <= 4799) return 'Næstved';
  
  // Fredericia: 7000-7099
  if (code >= 7000 && code <= 7099) return 'Fredericia';
  
  // Viborg: 8800-8899
  if (code >= 8800 && code <= 8899) return 'Viborg';
  
  // Køge: 4600-4699
  if (code >= 4600 && code <= 4699) return 'Køge';
  
  // Holstebro: 7500-7599
  if (code >= 7500 && code <= 7599) return 'Holstebro';
  
  // Taastrup: 2630
  if (code === 2630) return 'Taastrup';
  
  // Slagelse: 4200-4299
  if (code >= 4200 && code <= 4299) return 'Slagelse';
  
  // Hillerød: 3400-3499
  if (code >= 3400 && code <= 3499) return 'Hillerød';
  
  // Sønderborg: 6400-6499
  if (code >= 6400 && code <= 6499) return 'Sønderborg';
  
  // Svendborg: 5700-5799
  if (code >= 5700 && code <= 5799) return 'Svendborg';
  
  // Hjørring: 9800-9899
  if (code >= 9800 && code <= 9899) return 'Hjørring';
  
  // Frederikshavn: 9900-9999 (overlaps with Aalborg, prioritize Frederikshavn if in range)
  if (code >= 9900 && code <= 9999) return 'Frederikshavn';
  
  // Varde: 6800
  if (code === 6800) return 'Varde';
  
  return null;
}
