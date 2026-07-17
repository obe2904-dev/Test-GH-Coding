// =====================================================
// Step 2: AI Extraction from stored scrape data
// =====================================================
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL   = 'gemini-2.5-flash';

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_TEXT_CHARS_FOR_AI = 200;

const WEEKDAYS = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
] as const;

const DANISH_TO_WEEKDAY: Record<string, typeof WEEKDAYS[number]> = {
  mandag:   'monday',    man: 'monday',
  tirsdag:  'tuesday',   tir: 'tuesday',
  onsdag:   'wednesday', ons: 'wednesday',
  torsdag:  'thursday',  tor: 'thursday',
  fredag:   'friday',    fre: 'friday',
  lørdag:   'saturday',  lør: 'saturday',
  søndag:   'sunday',    søn: 'sunday',
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExtractionRequest {
  business_id: string;
}

interface FieldResult {
  value: unknown;
  tier: 1 | 2 | 3;
  source: string;
}

interface ExtractionSummary {
  found:     string[];
  not_found: string[];
  saved:     string[];
  errors:    string[];
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { business_id }: ExtractionRequest = await req.json();
    if (!business_id) throw new Error('business_id is required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // ── Fetch latest scrape result ───────────────────────────────────────────
    const { data: scrapeResult, error: fetchError } = await supabase
      .from('website_scrape_results')
      .select('*')
      .eq('business_id', business_id)
      .order('scraped_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !scrapeResult) {
      throw new Error('No scrape result found for this business');
    }

    const payload = scrapeResult.payload;

    if (!payload || Object.keys(payload).length === 0) {
      return jsonResponse({ success: false, error: 'Payload is empty', scrape_id: scrapeResult.id }, 400);
    }

    // ── Normalize payload structure ──────────────────────────────────────────
    // Cloud Run scraper nests data under 'extraction' key
    const extraction = payload.extraction || payload;

    // ── Content quality gate ─────────────────────────────────────────────────
    const qualityRating = extraction.quality?.rating ?? 'unknown';
    const textCharCount = extraction.quality?.business_text_characters ?? 0;
    const aiAllowed     = qualityRating !== 'poor' && textCharCount >= MIN_TEXT_CHARS_FOR_AI;

    console.log('✅ Payload received:', {
      scrape_id:  scrapeResult.id,
      business_id,
      quality:    qualityRating,
      text_chars: textCharCount,
      ai_allowed: aiAllowed,
    });

    // ── Run extraction tiers ─────────────────────────────────────────────────
    const summary: ExtractionSummary = { found: [], not_found: [], saved: [], errors: [] };

    const tier1 = extractTier1(extraction);
    const tier2 = extractTier2(extraction);
    const tier3 = aiAllowed
      ? await extractTier3(extraction)
      : {};

    // ── Menu extraction (separate focused extraction) ────────────────────────
    const menuExtraction = aiAllowed
      ? await extractMenuOfferings(extraction)
      : {};

    // Merge menu extraction into tier3 (menu extraction takes precedence)
    const tier3WithMenu = { ...tier3, ...menuExtraction };

    // ── Merge into table buckets ─────────────────────────────────────────────
    const businessLocations  = buildBusinessLocations(tier1);
    const businessOperations = buildBusinessOperations(tier1, tier2, tier3WithMenu);
    const businessProfile    = buildBusinessProfile(tier1, tier3WithMenu);
    const businesses         = buildBusinesses(tier3WithMenu);
    const openingHoursRows   = buildOpeningHoursRows(extraction, business_id);

    // ── Write to database ────────────────────────────────────────────────────
    await writeBusinessLocations(supabase, business_id, businessLocations, summary);
    await writeBusinessOperations(supabase, business_id, businessOperations, summary);
    await writeBusinessProfile(supabase, business_id, businessProfile, summary);
    await writeBusinesses(supabase, business_id, businesses, summary);
    await writeOpeningHours(supabase, business_id, openingHoursRows, summary);

    console.log('📊 Extraction complete:', summary);

    return jsonResponse({
      success:    true,
      scrape_id:  scrapeResult.id,
      business_id,
      scraped_at: scrapeResult.scraped_at,
      ai_used:    aiAllowed,
      quality:    qualityRating,
      extraction: summary,
    });

  } catch (error) {
    console.error('Error in extract-from-scrape:', error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// TIER 1 — Structural paths from payload JSON
// Zero cost. Always runs. Direct field access only — no inference.
// ═════════════════════════════════════════════════════════════════════════════

function extractTier1(payload: any): Record<string, FieldResult> {
  const r: Record<string, FieldResult> = {};

  const t1 = (key: string, value: unknown, source: string) => {
    if (value !== null && value !== undefined && value !== '') {
      r[key] = { value, tier: 1, source };
    }
  };

  // Contact
  t1('email',         payload.contact?.emails?.[0]?.value,   'contact.emails[0]');
  t1('phone',         payload.contact?.phones?.[0]?.value,   'contact.phones[0]');

  // Address — split Danish format "Street Number PostalCode City"
  const rawAddress = payload.contact?.addresses?.[0]?.value ?? null;
  if (rawAddress) {
    const { address_line1, postal_code } = splitDanishAddress(rawAddress);
    t1('address_line1', address_line1, 'contact.addresses[0] split');
    t1('postal_code',   postal_code,   'contact.addresses[0] split');
  }

  // Fallback: Parse phone and address from content_sections if not in contact
  if (!r['phone'] || !r['address_line1']) {
    const sections = payload.content_sections ?? [];
    const contactSection = sections.find((s: any) => 
      s.heading?.toLowerCase().includes('kontakt') || 
      s.heading?.toLowerCase().includes('contact')
    );
    
    if (contactSection?.text) {
      const text = contactSection.text;
      
      // Parse Danish phone (8-digit, possibly with spaces: "86 19 07 06" or "86190706")
      if (!r['phone']) {
        const phoneMatch = text.match(/(?:tlf\.?:?\s*)?(\d{2}\s?\d{2}\s?\d{2}\s?\d{2})/i);
        if (phoneMatch) {
          const cleanPhone = phoneMatch[1].replace(/\s/g, '');
          t1('phone', cleanPhone, 'content_sections[Kontakt] phone regex');
        }
      }
      
      // Parse Danish address: "Street Number PostalCode City"
      if (!r['address_line1']) {
        // Match Danish street address: Street name (starts with capital, min 3 chars) + number
        // More strict to avoid matching fragments like "S Åboulevarden"
        const addressMatch = text.match(/\b([A-ZÆØÅ][a-zæøå]{2,}[a-zæøå\s]+\d+[A-Za-z]?)\s+(\d{4})\s+([A-ZÆØÅ][a-zæøå\s]+)/);
        if (addressMatch) {
          t1('address_line1', addressMatch[1].trim(), 'content_sections[Kontakt] address regex');
          t1('postal_code', addressMatch[2], 'content_sections[Kontakt] postal code regex');
        }
      }
    }
  }

  // Service URLs
  t1('booking_url',         payload.services?.booking?.url,         'services.booking');
  t1('takeaway_url',        payload.services?.takeaway?.url,        'services.takeaway');
  t1('google_maps_url',     payload.services?.google_maps?.url,     'services.google_maps');
  t1('food_inspection_url', payload.services?.food_inspection?.url, 'services.food_inspection');
  t1('smiley_url',          payload.services?.food_inspection?.url, 'services.food_inspection');

  // Definitive boolean signals from structural presence
  if (payload.services?.takeaway?.url) {
    r['has_takeaway'] = { value: true, tier: 1, source: 'services.takeaway url present' };
  }
  if (payload.services?.booking?.url) {
    // Booking URL = customers book a table = table service confirmed
    r['has_table_service'] = { value: true, tier: 1, source: 'services.booking url present' };
  }

  // Business text
  t1('long_description', payload.business?.description?.value, 'business.description');

  // user_about_text: largest content section
  const sections = payload.content_sections ?? [];
  const bestSection = sections
    .filter((s: any) => s.text?.length > 50)
    .sort((a: any, b: any) => b.text.length - a.text.length)[0] ?? null;
  if (bestSection) {
    t1('user_about_text', bestSection.text, 'content_sections[largest]');
  }

  // kitchen_close_time: most common close time across open days
  const candidates = payload.opening_hours?.candidates ?? [];
  const kitchenClose = deriveKitchenCloseTime(candidates);
  if (kitchenClose) {
    r['kitchen_close_time'] = { value: kitchenClose, tier: 1, source: 'opening_hours.candidates' };
  }

  return r;
}

// ═════════════════════════════════════════════════════════════════════════════
// TIER 2 — Keyword scan
// Only for closed-vocabulary fields where regex is unambiguous.
// DO NOT add fields here that require reading intent or context.
// ═════════════════════════════════════════════════════════════════════════════

function extractTier2(payload: any): Record<string, FieldResult> {
  const r: Record<string, FieldResult> = {};

  // Build content text from all sections
  const sections = payload.content_sections ?? [];
  const t = sections
    .map((s: any) => s.text ?? '')
    .join('\n')
    .toLowerCase();

  const flag = (key: string, result: boolean, source: string) => {
    r[key] = { value: result, tier: 2, source };
  };

  // has_delivery — delivery platform names are unambiguous closed vocabulary
  flag('has_delivery',
    /wolt|just\s*eat|foodora|levering|udbring|delivery/.test(t),
    'keyword: delivery platform names'
  );

  // has_wifi — closed vocabulary, no ambiguity
  flag('has_wifi',
    /wifi|wi-fi|trådløst\s*internet|gratis\s*internet|free\s*wi.?fi/.test(t),
    'keyword: wifi signals'
  );

  // has_parking — closed vocabulary
  flag('has_parking',
    /parkering|parkeringsplads|p-plads|parking/.test(t),
    'keyword: parking signals'
  );

  return r;
}

// ═════════════════════════════════════════════════════════════════════════════
// TIER 3 — Single Gemini call
// Handles all fields requiring inference, context, or interpretation.
// One call returns all fields as structured JSON.
// ═════════════════════════════════════════════════════════════════════════════

async function extractTier3(payload: any): Promise<Record<string, FieldResult>> {
  if (!GEMINI_API_KEY) {
    console.warn('⚠️ No GEMINI_API_KEY — skipping Tier 3');
    return {};
  }

  const geminiInput = buildGeminiInput(payload);

  const prompt = `
Du er ekspert i at analysere danske restauranter, caféer og barer ud fra deres hjemmesideindhold.

Analyser nedenstående indhold og returner præcist denne JSON-struktur.
Brug null for felter du ikke kan fastslå med rimelig sikkerhed.
Fabrikér IKKE information. Gæt IKKE hvis indholdet ikke understøtter det.
Svar KUN med JSON — ingen markdown, ingen forklaringer.

${geminiInput}

Returner denne JSON (intet andet):
{
  "has_table_service": true or false or null,
  "reservation_required": true or false or null,
  "accepts_walk_ins": true or false or null,
  "has_outdoor_seating": true or false or null,
  "outdoor_seating_term": "Det præcise danske ord virksomheden bruger for udeservering — typisk 'terrasse', 'overdækket terrasse', 'udeservering', 'haveplads', 'gårdhave'. Null hvis ingen udeservering nævnes.",
  "weekly_programme": "Fritekst der beskriver tilbagevendende ugentlige begivenheder: live musik, DJ-aftener, temaftener, brunch-dage osv. Null hvis intet nævnes. På dansk.",
  "menu_description": "1-2 sætninger der opsummerer menukoncept og hovedkategorier. Null hvis utilstrækkelig menuinfo.",
  "ai_place_synopsis": "2-3 sætninger der beskriver stedet: type, stemning/atmosfære, køkken/koncept, hvem det henvender sig til. På dansk.",
  "local_location_reference": "Den korte sætning virksomheden selv bruger til at beskrive hvor de ligger. Skal være et konkret lokationsankerpunkt — et vartegn, gade, vandfront, torv, kvarter eller karakteristisk omgivelse. Eksempler: 'ved åen', 'på Rådhuspladsen', 'i skyggen af Koldinghus', 'i Nyhavn', 'på havnen', 'i Latinerkvarteret', 'ved stranden'. Inkludér IKKE bynavnet alene. Null hvis ingen specifik lokationsreference findes.",
  "menu_signal": {
    "hasMenu": true or false,
    "menuCategories": ["kategori1", "kategori2"] or null,
    "signatureItems": ["ret1", "ret2"] or null,
    "menuDescription": "kort beskrivelse" or null,
    "programmes": "frokost/aften/brunch osv." or null,
    "placeSynopsis": "én sætning" or null,
    "rawExtract": null
  }
}
`.trim();

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature:     0.1,
            maxOutputTokens: 3000,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('❌ Gemini API error:', response.status, await response.text());
      return {};
    }

    const geminiData = await response.json();
    const rawText    = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    
    console.log('🤖 Raw Gemini response (first 500 chars):', rawText.slice(0, 500));
    
    if (!rawText || rawText.length < 10) {
      console.error('❌ Gemini returned empty or very short response');
      return {};
    }
    
    const cleaned    = rawText.replace(/```json|```/g, '').trim();
    console.log('🧹 Cleaned JSON (first 500 chars):', cleaned.slice(0, 500));
    
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('❌ JSON parse failed:', parseError.message);
      console.error('   Raw text length:', rawText.length);
      console.error('   Cleaned text:', cleaned.slice(0, 1000));
      return {};
    }

    const r: Record<string, FieldResult> = {};

    const t3 = (key: string, value: unknown) => {
      if (value !== null && value !== undefined) {
        r[key] = { value, tier: 3, source: 'gemini' };
      }
    };

    // Boolean operation fields
    t3('has_table_service',    parsed.has_table_service);
    t3('reservation_required', parsed.reservation_required);
    t3('accepts_walk_ins',     parsed.accepts_walk_ins);
    t3('has_outdoor_seating',  parsed.has_outdoor_seating);
    t3('outdoor_seating_term', parsed.outdoor_seating_term);

    // Programme and content
    t3('weekly_programme',  parsed.weekly_programme);
    t3('menu_description',  parsed.menu_description);
    t3('ai_place_synopsis', parsed.ai_place_synopsis);

    // Location reference — written to businesses table
    t3('local_location_reference', parsed.local_location_reference);

    // Menu signal — stored as JSON string
    t3('menu_signal',
      parsed.menu_signal && typeof parsed.menu_signal === 'object'
        ? JSON.stringify(parsed.menu_signal)
        : parsed.menu_signal
    );

    console.log('✅ Tier 3 complete, fields extracted:', Object.keys(r));
    return r;

  } catch (err) {
    console.error('❌ Tier 3 extraction failed:', err);
    return {};
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// MENU EXTRACTION — Separate focused extraction for dish names
// Fetches menu page if URL exists, sends to Gemini with focused prompt
// ═════════════════════════════════════════════════════════════════════════════

async function extractMenuOfferings(payload: any): Promise<Record<string, FieldResult>> {
  const r: Record<string, FieldResult> = {};
  
  const menuUrl = payload.services?.menu?.url;
  console.log(`🔍 [MENU] Checking for menu URL... services=${!!payload.services}, menu=${!!payload.services?.menu}, url=${menuUrl}`);
  
  if (!menuUrl) {
    console.log('⏭️  [MENU] No menu URL detected, skipping menu extraction');
    return r;
  }

  if (!GEMINI_API_KEY) {
    console.warn('⚠️  [MENU] No GEMINI_API_KEY — skipping menu extraction');
    return r;
  }

  console.log(`🍽️  [MENU] Menu URL detected: ${menuUrl}, fetching menu for dish extraction...`);

  try {
    // Fetch menu page HTML
    const response = await fetch(menuUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`⚠️  [MENU] Failed to fetch menu page: HTTP ${response.status}`);
      return r;
    }

    const menuHtml = await response.text();
    console.log(`✅ [MENU] Menu HTML fetched: ${menuHtml.length} bytes`);

    // Clean HTML: remove scripts, styles, tags
    const cleanMenuText = menuHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000); // Limit to 8000 chars for Gemini

    console.log(`🧹 [MENU] Cleaned menu text: ${cleanMenuText.length} chars`);

    if (cleanMenuText.length < 200) {
      console.warn(`⚠️  [MENU] Menu content too short (${cleanMenuText.length} chars), skipping`);
      return r;
    }

    console.log(`🔍 [MENU] Sending to Gemini... (first 200 chars: ${cleanMenuText.slice(0, 200)})`);

    // Focused prompt: ONLY extract dish names
    const prompt = `
Du er ekspert i at udtrække retnavne fra restaurantmenuer.

Analyser nedenstående menuindhold og udtræk 5-7 hovedretter eller signaturretter.
Returner KUN retnavne — ingen priser, ingen beskrivelser, ingen kategorier.
Prioritér specifikke retter fremfor generiske kategorier (f.eks. "Smørrebrød med laks" fremfor "Smørrebrød").
Returner navnene på dansk, ét pr. linje.

MENUINDHOLD:
${cleanMenuText}

Returner PRÆCIST denne JSON-struktur (intet andet):
{
  "key_offerings": "Retnavn 1\\nRetnavn 2\\nRetnavn 3\\nRetnavn 4\\nRetnavn 5"
}

Eksempel output:
{
  "key_offerings": "Smørrebrød med laks\\nBøf Bearnaise\\nFisk & Chips\\nCaesar Salat\\nPasta Carbonara"
}
`.trim();

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 500,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('❌ [MENU] Gemini API error:', geminiResponse.status, errorText.slice(0, 200));
      return r;
    }

    const geminiData = await geminiResponse.json();
    console.log(`📦 [MENU] Gemini response received:`, JSON.stringify(geminiData).slice(0, 300));
    
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!rawText) {
      console.warn('⚠️  [MENU] Empty response from Gemini menu extraction');
      return r;
    }

    console.log(`📝 [MENU] Raw Gemini text (first 200 chars): ${rawText.slice(0, 200)}`);

    // Parse JSON response
    const cleanJson = rawText.replace(/^```json\s*|\s*```$/g, '').trim();
    console.log(`🔧 [MENU] Cleaned JSON: ${cleanJson.slice(0, 200)}`);
    
    const parsed = JSON.parse(cleanJson);
    console.log(`✅ [MENU] Parsed result:`, parsed);

    if (parsed.key_offerings) {
      r['key_offerings'] = {
        value: parsed.key_offerings,
        tier: 3,
        source: 'gemini_menu_extraction',
      };
      console.log('🎉 [MENU] Menu extraction complete:', parsed.key_offerings.split('\n').length, 'dishes');
      console.log('📋 [MENU] Dishes:', parsed.key_offerings);
    } else {
      console.warn('⚠️  [MENU] No key_offerings in parsed response');
    }

    return r;

  } catch (err) {
    console.error('❌ [MENU] Menu extraction failed:', err.message, err.stack);
    return r;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// GEMINI INPUT BUILDER
// Structured labelled sections so the model understands context.
// Not a raw text dump — each section is labelled and meaningful.
// ═════════════════════════════════════════════════════════════════════════════

function buildGeminiInput(payload: any): string {
  const parts: string[] = [];

  // Business identity
  const name = payload.business?.name?.value ?? null;
  const url  = payload.meta?.final_url ?? null;
  if (name) parts.push(`VIRKSOMHED: ${name}`);
  if (url)  parts.push(`URL: ${url}`);

  // Services detected (gives AI context about what was found structurally)
  const serviceLines: string[] = [];
  if (payload.services?.booking?.url) {
    serviceLines.push(`- Online bordbooking til stede (${payload.services.booking.evidence ?? 'booking url'})`);
  }
  if (payload.services?.takeaway?.url) {
    serviceLines.push(`- Takeaway til stede (${payload.services.takeaway.evidence ?? 'takeaway url'})`);
  }
  if (payload.services?.menu?.url) {
    serviceLines.push(`- Menuside til stede: ${payload.services.menu.url}`);
  }
  if (payload.services?.food_inspection?.url) {
    serviceLines.push(`- Fødevarekontrol (Smiley): ${payload.services.food_inspection.url}`);
  }
  const socialProfiles = payload.services?.social_profiles ?? [];
  for (const sp of socialProfiles) {
    serviceLines.push(`- Social: ${sp.platform} (${sp.url})`);
  }
  if (serviceLines.length > 0) {
    parts.push(`DETEKTEREDE SERVICES:\n${serviceLines.join('\n')}`);
  }

  // Opening hours (gives context for table service / reservation inference)
  const ohValue = payload.opening_hours?.value ?? null;
  if (ohValue) {
    parts.push(`ÅBNINGSTIDER:\n${ohValue}`);
  }

  // Business description
  const desc = payload.business?.description?.value ?? null;
  if (desc) {
    parts.push(`BESKRIVELSE:\n${desc}`);
  }

  // All content sections — labelled with their heading
  const sections = payload.content_sections ?? [];
  for (const section of sections) {
    if (!section.text || section.text.length < 30) continue;
    const heading = section.heading ? `SEKTION: ${section.heading}` : 'SEKTION:';
    parts.push(`${heading}\n${section.text}`);
  }

  // Contact (useful for synopsis and location inference)
  const address = payload.contact?.addresses?.[0]?.value ?? null;
  if (address) parts.push(`ADRESSE: ${address}`);

  const fullText = parts.join('\n\n');

  // Cap at 6,000 chars — enough for rich multi-section sites
  return fullText.slice(0, 6000);
}

// ═════════════════════════════════════════════════════════════════════════════
// TABLE BUILDERS
// Priority: Tier 1 > Tier 2 > Tier 3 per field.
// Tier 1 always wins (structural facts beat inference).
// ═════════════════════════════════════════════════════════════════════════════

function buildBusinessLocations(t1: Record<string, FieldResult>) {
  return {
    email:         t1.email?.value         ?? null,
    phone:         t1.phone?.value         ?? null,
    address_line1: t1.address_line1?.value ?? null,
    postal_code:   t1.postal_code?.value   ?? null,
  };
}

function buildBusinessOperations(
  t1: Record<string, FieldResult>,
  t2: Record<string, FieldResult>,
  t3: Record<string, FieldResult>,
) {
  // Tier 1 wins over Tier 3 wins over Tier 2 for overlapping keys
  const get = (key: string) =>
    (t1[key] ?? t3[key] ?? t2[key])?.value ?? null;

  return {
    has_takeaway:         get('has_takeaway'),
    has_delivery:         get('has_delivery'),
    has_table_service:    get('has_table_service'),
    reservation_required: get('reservation_required'),
    accepts_walk_ins:     get('accepts_walk_ins'),
    has_outdoor_seating:  get('has_outdoor_seating'),
    outdoor_seating_term: get('outdoor_seating_term'),
    has_wifi:             get('has_wifi'),
    has_parking:          get('has_parking'),
    kitchen_close_time:   get('kitchen_close_time'),
    smiley_url:           get('smiley_url'),
    weekly_programme:     get('weekly_programme'),
  };
}

function buildBusinessProfile(
  t1: Record<string, FieldResult>,
  t3: Record<string, FieldResult>,
) {
  const get = (key: string) => (t1[key] ?? t3[key])?.value ?? null;

  return {
    long_description:    get('long_description'),
    user_about_text:     get('user_about_text'),
    booking_url:         get('booking_url'),
    takeaway_url:        get('takeaway_url'),
    google_maps_url:     get('google_maps_url'),
    food_inspection_url: get('food_inspection_url'),
    menu_signal:         get('menu_signal'),
    menu_description:    get('menu_description'),
    key_offerings:       get('key_offerings'),
    ai_place_synopsis:   get('ai_place_synopsis'),
  };
}

function buildBusinesses(t3: Record<string, FieldResult>) {
  return {
    // Only local_location_reference is managed here.
    // All other businesses fields are owned by other pipeline steps.
    local_location_reference: t3.local_location_reference?.value ?? null,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// OPENING HOURS BUILDER
// One row per weekday. Missing days = closed: true.
// ═════════════════════════════════════════════════════════════════════════════

function buildOpeningHoursRows(payload: any, business_id: string) {
  const candidates: { day_text: string; time_text: string }[] =
    payload.opening_hours?.candidates ?? [];

  const found = new Map<string, {
    open_time:  string | null;
    close_time: string | null;
    closed:     boolean;
  }>();

  for (const c of candidates) {
    const weekday = resolveDanishDay(c.day_text);
    if (!weekday) {
      console.warn('⚠️ Unrecognised day:', c.day_text);
      continue;
    }
    if (c.time_text === 'Lukket') {
      found.set(weekday, { open_time: null, close_time: null, closed: true });
      continue;
    }
    const times = parseTimeRange(c.time_text);
    if (times) {
      found.set(weekday, { open_time: times.open, close_time: times.close, closed: false });
    }
  }

  return WEEKDAYS.map(weekday => ({
    business_id,
    weekday,
    open_time:  found.get(weekday)?.open_time  ?? null,
    close_time: found.get(weekday)?.close_time ?? null,
    closed:     found.get(weekday)?.closed     ?? true,
    kind:       'normal',
  }));
}

// ═════════════════════════════════════════════════════════════════════════════
// DATABASE WRITERS
// One upsert/update per table. Null values OVERWRITE existing data.
// If extraction returns null, the database field is cleared.
// ═════════════════════════════════════════════════════════════════════════════

async function writeBusinessLocations(
  supabase: any,
  business_id: string,
  data: Record<string, unknown>,
  summary: ExtractionSummary,
) {
  if (Object.keys(data).length === 0) return;

  try {
    const { error, count } = await supabase
      .from('business_locations')
      .update(data)
      .eq('business_id', business_id)
      .select('business_id', { count: 'exact', head: true });

    if (error) throw error;
    if (count === 0) throw new Error(`No business_locations row for ${business_id}`);

    Object.keys(data).forEach(k => summary.saved.push(`locations.${k}`));
    console.log('✅ business_locations saved:', Object.keys(data));
  } catch (err) {
    summary.errors.push(`business_locations: ${err.message}`);
    console.error('❌ business_locations write failed:', err);
  }
}

async function writeBusinessOperations(
  supabase: any,
  business_id: string,
  data: Record<string, unknown>,
  summary: ExtractionSummary,
) {
  if (Object.keys(data).length === 0) return;

  try {
    const { error } = await supabase
      .from('business_operations')
      .upsert({ business_id, ...data }, { onConflict: 'business_id' });

    if (error) throw error;

    Object.keys(data).forEach(k => summary.saved.push(`operations.${k}`));
    console.log('✅ business_operations saved:', Object.keys(data));
  } catch (err) {
    summary.errors.push(`business_operations: ${err.message}`);
    console.error('❌ business_operations write failed:', err);
  }
}

async function writeBusinessProfile(
  supabase: any,
  business_id: string,
  data: Record<string, unknown>,
  summary: ExtractionSummary,
) {
  if (Object.keys(data).length === 0) return;

  try {
    const { error } = await supabase
      .from('business_profile')
      .upsert({ business_id, ...data }, { onConflict: 'business_id' });

    if (error) throw error;

    Object.keys(data).forEach(k => summary.saved.push(`profile.${k}`));
    console.log('✅ business_profile saved:', Object.keys(data));
  } catch (err) {
    summary.errors.push(`business_profile: ${err.message}`);
    console.error('❌ business_profile write failed:', err);
  }
}

async function writeBusinesses(
  supabase: any,
  business_id: string,
  data: Record<string, unknown>,
  summary: ExtractionSummary,
) {
  if (Object.keys(data).length === 0) return;

  try {
    const { error, count } = await supabase
      .from('businesses')
      .update(data)
      .eq('id', business_id)
      .select('id', { count: 'exact', head: true });

    if (error) throw error;
    if (count === 0) throw new Error(`No businesses row for id ${business_id}`);

    Object.keys(data).forEach(k => summary.saved.push(`businesses.${k}`));
    console.log('✅ businesses saved:', Object.keys(data));
  } catch (err) {
    summary.errors.push(`businesses: ${err.message}`);
    console.error('❌ businesses write failed:', err);
  }
}

async function writeOpeningHours(
  supabase: any,
  business_id: string,
  rows: any[],
  summary: ExtractionSummary,
) {
  if (rows.length === 0) return;

  try {
    const { error: deleteError } = await supabase
      .from('opening_hours')
      .delete()
      .eq('business_id', business_id);

    if (deleteError) throw deleteError;

    const { error: insertError } = await supabase
      .from('opening_hours')
      .insert(rows);

    if (insertError) throw insertError;

    const openCount   = rows.filter(r => !r.closed).length;
    const closedCount = rows.filter(r => r.closed).length;
    summary.saved.push(`opening_hours (${openCount} open, ${closedCount} closed)`);
    console.log(`✅ opening_hours: ${openCount} open, ${closedCount} closed`);
  } catch (err) {
    summary.errors.push(`opening_hours: ${err.message}`);
    console.error('❌ opening_hours write failed:', err);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Split Danish address into street+number and 4-digit postal code.
 * "Åboulevarden 32 8000 Aarhus C, Danmark"
 *   → address_line1: "Åboulevarden 32"
 *   → postal_code:   "8000"
 */
function splitDanishAddress(raw: string): {
  address_line1: string | null;
  postal_code:   string | null;
} {
  const match = raw.match(/^(.+?)\s+(\d{4})\b/);
  if (!match) return { address_line1: null, postal_code: null };
  return {
    address_line1: match[1].trim(),
    postal_code:   match[2],
  };
}

/**
 * Resolve Danish day name or abbreviation to English weekday key.
 */
function resolveDanishDay(raw: string): typeof WEEKDAYS[number] | null {
  const key = raw.toLowerCase().trim();
  return DANISH_TO_WEEKDAY[key] ?? null;
}

/**
 * Parse "HH:MM - HH:MM" into { open, close } as "HH:MM:SS".
 * Scraper outputs normalised HH:MM format after the opening hours fix.
 */
function parseTimeRange(text: string): { open: string; close: string } | null {
  // Match both regular hyphen (-) and en dash (–) for time ranges
  const match = text.match(/(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})/);
  if (!match) return null;
  return {
    open:  `${match[1]}:00`,
    close: `${match[2]}:00`,
  };
}

/**
 * Derive kitchen close time as the most common close time across open days.
 */
function deriveKitchenCloseTime(
  candidates: { day_text: string; time_text: string }[]
): string | null {
  const closeCounts = new Map<string, number>();

  for (const c of candidates) {
    if (c.time_text === 'Lukket') continue;
    const times = parseTimeRange(c.time_text);
    if (times?.close) {
      closeCounts.set(times.close, (closeCounts.get(times.close) ?? 0) + 1);
    }
  }

  if (closeCounts.size === 0) return null;
  const [mostCommon] = [...closeCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  return mostCommon;
}

/**
 * Remove null/undefined values before DB write so existing values
 * are never overwritten with null on re-runs.
 */
function filterNulls(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined)
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
