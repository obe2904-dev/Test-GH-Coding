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

const MIN_TEXT_CHARS_FOR_AI = 200; // below this, skip Tier 3

const WEEKDAYS = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
] as const;

const DANISH_TO_WEEKDAY: Record<string, typeof WEEKDAYS[number]> = {
  mandag:   'monday',   man: 'monday',
  tirsdag:  'tuesday',  tir: 'tuesday',
  onsdag:   'wednesday',ons: 'wednesday',
  torsdag:  'thursday', tor: 'thursday',
  fredag:   'friday',   fre: 'friday',
  lørdag:   'saturday', lør: 'saturday',
  søndag:   'sunday',   søn: 'sunday',
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

    // ── Content quality gate ─────────────────────────────────────────────────
    const qualityRating  = payload.quality?.rating          
                        ?? payload.extraction?.quality?.rating  
                        ?? 'unknown';
    const textCharCount  = payload.quality?.business_text_characters
                        ?? payload.extraction?.quality?.business_text_characters
                        ?? 0;
    const aiAllowed      = qualityRating !== 'poor' && textCharCount >= MIN_TEXT_CHARS_FOR_AI;

    console.log('🔍 Quality check:', {
      root_quality:         payload.quality,
      nested_quality:       payload.extraction?.quality,
      qualityRating_used:   qualityRating,
      textCharCount_used:   textCharCount,
      aiAllowed:            aiAllowed,
    });

    console.log('✅ Payload received:', {
      scrape_id:    scrapeResult.id,
      business_id,
      quality:      qualityRating,
      text_chars:   textCharCount,
      ai_allowed:   aiAllowed,
    });

    // ── Build content text for Tier 2 + Tier 3 ──────────────────────────────
    const contentText = buildContentText(payload);

    // ── Run all three tiers ──────────────────────────────────────────────────
    const summary: ExtractionSummary = { found: [], not_found: [], saved: [], errors: [] };

    const tier1 = extractTier1(payload);
    const tier2 = extractTier2(contentText);
    const tier3 = aiAllowed
      ? await extractTier3(contentText, payload)
      : {};

    // ── Merge results into table buckets ─────────────────────────────────────
    const businessLocations  = buildBusinessLocations(tier1);
    const businessOperations = buildBusinessOperations(tier1, tier2, tier3);
    const businessProfile    = buildBusinessProfile(tier1, tier3);
    const openingHoursRows   = buildOpeningHoursRows(payload, business_id);

    // ── Write to database ────────────────────────────────────────────────────
    await writeBusinessLocations(supabase, business_id, businessLocations, summary);
    await writeBusinessOperations(supabase, business_id, businessOperations, summary);
    await writeBusinessProfile(supabase, business_id, businessProfile, summary);
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
// TIER 1 — Structural extraction from payload paths
// ═════════════════════════════════════════════════════════════════════════════

function extractTier1(payload: any): Record<string, FieldResult> {
  const r: Record<string, FieldResult> = {};

  const t1 = (key: string, value: unknown, source: string) => {
    if (value !== null && value !== undefined && value !== '') {
      r[key] = { value, tier: 1, source };
    }
  };

  // Contact
  t1('email',    payload.extraction?.contact?.emails?.[0]?.value,    'contact.emails[0]');
  t1('phone',    payload.extraction?.contact?.phones?.[0]?.value,    'contact.phones[0]');

  // Address split
  const rawAddress = payload.extraction?.contact?.addresses?.[0]?.value ?? null;
  if (rawAddress) {
    const { address_line1, postal_code } = splitDanishAddress(rawAddress);
    t1('address_line1', address_line1, 'contact.addresses[0] split');
    t1('postal_code',   postal_code,   'contact.addresses[0] split');
  }

  // Services — URLs
  t1('booking_url',        payload.services?.booking?.url,          'services.booking');
  t1('takeaway_url',       payload.services?.takeaway?.url,         'services.takeaway');
  t1('google_maps_url',    payload.services?.google_maps?.url,      'services.google_maps');
  t1('food_inspection_url',payload.services?.food_inspection?.url,  'services.food_inspection');
  t1('smiley_url',         payload.services?.food_inspection?.url,  'services.food_inspection');

  // has_takeaway: presence of takeaway URL means true
  if (payload.services?.takeaway?.url) {
    r['has_takeaway'] = { value: true, tier: 1, source: 'services.takeaway url present' };
  }

  // Business text
  t1('long_description', payload.business?.description?.value, 'business.description');

  // user_about_text: largest content section by text length
  const sections = payload.content_sections ?? [];
  const bestSection = sections
    .filter((s: any) => s.text && s.text.length > 50)
    .sort((a: any, b: any) => b.text.length - a.text.length)[0] ?? null;
  if (bestSection) {
    t1('user_about_text', bestSection.text, 'content_sections[largest]');
  }

  // kitchen_close_time: most common close time across opening hours candidates
  const candidates = payload.opening_hours?.candidates ?? [];
  const kitchenClose = deriveKitchenCloseTime(candidates);
  if (kitchenClose) {
    r['kitchen_close_time'] = { value: kitchenClose, tier: 1, source: 'opening_hours.candidates' };
  }

  return r;
}

// ═════════════════════════════════════════════════════════════════════════════
// TIER 2 — Keyword scan over content text
// ═════════════════════════════════════════════════════════════════════════════

function extractTier2(text: string): Record<string, FieldResult> {
  const r: Record<string, FieldResult> = {};
  const t = text.toLowerCase();

  const flag = (key: string, result: boolean, source: string) => {
    r[key] = { value: result, tier: 2, source };
  };

  // has_delivery
  flag('has_delivery',
    /wolt|just\s*eat|foodora|levering|udbring|delivery/.test(t),
    'keyword: delivery platforms + levering/udbring'
  );

  // has_table_service
  flag('has_table_service',
    /bordbetjening|table\s*service|servering ved bordet|vi serverer/.test(t) ||
    /restaurant|café|cafe/.test(t), // assumed true for FSE venues
    'keyword: table service signals'
  );

  // reservation_required
  const reservRequired =
    /reservation\s*påkrævet|kun med reservation|reservation\s*required|booking\s*required/.test(t);
  flag('reservation_required', reservRequired, 'keyword: reservation required signals');

  // accepts_walk_ins
  flag('accepts_walk_ins',
    !reservRequired ||
    /walk.?in|uden reservation|drop.?in|kom som du er/.test(t),
    'keyword: walk-in signals + inverse of reservation_required'
  );

  // has_outdoor_seating
  flag('has_outdoor_seating',
    /udeservering|ude\s*servering|terrasse|outdoor\s*seating|haveplads|gårdhave|patio|al\s*fresco|udenfor/.test(t),
    'keyword: outdoor seating signals'
  );

  // has_wifi
  flag('has_wifi',
    /wifi|wi-fi|trådløst\s*internet|gratis\s*internet|free\s*wi.?fi/.test(t),
    'keyword: wifi signals'
  );

  // has_parking
  flag('has_parking',
    /parkering|parkeringsplads|p-plads|parking/.test(t),
    'keyword: parking signals'
  );

  return r;
}

// ═════════════════════════════════════════════════════════════════════════════
// TIER 3 — Single Gemini call for AI-only fields
// ═════════════════════════════════════════════════════════════════════════════

async function extractTier3(
  contentText: string,
  payload: any,
): Promise<Record<string, FieldResult>> {

  if (!GEMINI_API_KEY) {
    console.warn('⚠️ No GEMINI_API_KEY — skipping Tier 3');
    return {};
  }

  const prompt = `
You are extracting structured information about a Danish hospitality business
(restaurant, café, or bar) from its website content.

Return ONLY a JSON object with exactly these keys. Use null for any field you
cannot determine with reasonable confidence. Do NOT fabricate information.
Do NOT guess if the content does not support it.

CONTENT:
${contentText.slice(0, 4000)}

BUSINESS NAME (hint): ${payload.business?.name?.value ?? 'unknown'}

Return this JSON structure (nothing else, no markdown):
{
  "weekly_programme": "Free text describing recurring weekly events, live music, DJ nights, themed evenings etc. Null if none found. Danish preferred.",
  "menu_description": "1-2 sentence Danish summary of the menu concept and key categories. Null if insufficient menu info.",
  "key_offerings": "Newline-separated list of 5-7 main dishes or products (names only, Danish). Null if insufficient.",
  "ai_place_synopsis": "2-3 sentence Danish synopsis of the business: type, location feel, cuisine/concept, who it is for.",
  "menu_signal": {
    "hasMenu": true or false,
    "menuCategories": ["category1", "category2"] or null,
    "signatureItems": ["item1", "item2"] or null,
    "menuDescription": "short description" or null,
    "programmes": "lunch/dinner/brunch etc." or null,
    "placeSynopsis": "one sentence" or null,
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
          generationConfig: { temperature: 0.1, maxOutputTokens: 1000 },
        }),
      }
    );

    if (!response.ok) {
      console.error('❌ Gemini API error:', response.status, await response.text());
      return {};
    }

    const geminiData = await response.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // Strip markdown fences if present
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const parsed  = JSON.parse(cleaned);

    const r: Record<string, FieldResult> = {};

    const t3 = (key: string, value: unknown) => {
      if (value !== null && value !== undefined) {
        r[key] = { value, tier: 3, source: 'gemini' };
      }
    };

    t3('weekly_programme', parsed.weekly_programme);
    t3('menu_description', parsed.menu_description);
    t3('key_offerings',    parsed.key_offerings);
    t3('ai_place_synopsis',parsed.ai_place_synopsis);
    t3('menu_signal',
      typeof parsed.menu_signal === 'object'
        ? JSON.stringify(parsed.menu_signal)
        : parsed.menu_signal
    );

    console.log('✅ Tier 3 Gemini extraction complete, fields:', Object.keys(r));
    return r;

  } catch (err) {
    console.error('❌ Tier 3 extraction failed:', err);
    return {};
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// TABLE BUILDERS
// ═════════════════════════════════════════════════════════════════════════════

function buildBusinessLocations(t1: Record<string, FieldResult>) {
  return {
    email:        t1.email?.value        ?? null,
    phone:        t1.phone?.value        ?? null,
    address_line1:t1.address_line1?.value ?? null,
    postal_code:  t1.postal_code?.value  ?? null,
  };
}

function buildBusinessOperations(
  t1: Record<string, FieldResult>,
  t2: Record<string, FieldResult>,
  t3: Record<string, FieldResult>,
) {
  // Tier 1 takes precedence over Tier 2 for overlapping keys
  const get = (key: string) => (t1[key] ?? t2[key] ?? t3[key])?.value ?? null;

  return {
    has_takeaway:         get('has_takeaway'),
    has_delivery:         get('has_delivery'),
    has_table_service:    get('has_table_service'),
    reservation_required: get('reservation_required'),
    accepts_walk_ins:     get('accepts_walk_ins'),
    has_outdoor_seating:  get('has_outdoor_seating'),
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
    long_description:   get('long_description'),
    user_about_text:    get('user_about_text'),
    booking_url:        get('booking_url'),
    takeaway_url:       get('takeaway_url'),
    google_maps_url:    get('google_maps_url'),
    food_inspection_url:get('food_inspection_url'),
    menu_signal:        get('menu_signal'),
    menu_description:   get('menu_description'),
    key_offerings:      get('key_offerings'),
    ai_place_synopsis:  get('ai_place_synopsis'),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// OPENING HOURS BUILDER
// ═════════════════════════════════════════════════════════════════════════════

function buildOpeningHoursRows(payload: any, business_id: string) {
  const candidates: { day_text: string; time_text: string }[] =
    payload.opening_hours?.candidates ?? [];

  // Parse found candidates
  const found = new Map<string, { open_time: string | null; close_time: string | null; closed: boolean }>();

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

  // Build one row per weekday — missing days = closed
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
// Each writer does one upsert per table and records to summary.
// ═════════════════════════════════════════════════════════════════════════════

async function writeBusinessLocations(
  supabase: any,
  business_id: string,
  data: Record<string, unknown>,
  summary: ExtractionSummary,
) {
  // Only write non-null fields
  const payload = filterNulls(data);
  if (Object.keys(payload).length === 0) return;

  try {
    const { error, count } = await supabase
      .from('business_locations')
      .update(payload)
      .eq('business_id', business_id)
      .select('business_id', { count: 'exact', head: true });

    if (error) throw error;
    if (count === 0) throw new Error(`No business_locations row for ${business_id}`);

    Object.keys(payload).forEach(k => summary.saved.push(`locations.${k}`));
    console.log('✅ business_locations saved:', Object.keys(payload));
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
  const payload = filterNulls(data);
  if (Object.keys(payload).length === 0) return;

  try {
    const { error } = await supabase
      .from('business_operations')
      .upsert({ business_id, ...payload }, { onConflict: 'business_id' });

    if (error) throw error;

    Object.keys(payload).forEach(k => summary.saved.push(`operations.${k}`));
    console.log('✅ business_operations saved:', Object.keys(payload));
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
  const payload = filterNulls(data);
  if (Object.keys(payload).length === 0) return;

  try {
    const { error } = await supabase
      .from('business_profile')
      .upsert({ business_id, ...payload }, { onConflict: 'business_id' });

    if (error) throw error;

    Object.keys(payload).forEach(k => summary.saved.push(`profile.${k}`));
    console.log('✅ business_profile saved:', Object.keys(payload));
  } catch (err) {
    summary.errors.push(`business_profile: ${err.message}`);
    console.error('❌ business_profile write failed:', err);
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
    // Delete existing rows for this business first, then insert fresh
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
    console.log(`✅ opening_hours saved: ${openCount} open days, ${closedCount} closed days`);
  } catch (err) {
    summary.errors.push(`opening_hours: ${err.message}`);
    console.error('❌ opening_hours write failed:', err);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Split a Danish address string into street+number and postal code.
 * "Åboulevarden 32 8000 Aarhus C, Danmark" →
 *   address_line1: "Åboulevarden 32"
 *   postal_code:   "8000"
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
 * The scraper now always outputs this normalised format.
 */
function parseTimeRange(text: string): { open: string; close: string } | null {
  // Normalize dots to colons (e.g., "11.30 - 23.30" → "11:30 - 23:30")
  const normalized = text.replace(/(\d{2})\.(\d{2})/g, '$1:$2');
  
  // Match HH:MM - HH:MM format
  const match = normalized.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
  if (!match) return null;
  
  return {
    open:  `${match[1]}:00`,
    close: `${match[2]}:00`,
  };
}

/**
 * Derive kitchen close time as the most common close time across open days.
 * Returns "HH:MM:SS" or null.
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

  const [mostCommon] = [...closeCounts.entries()]
    .sort((a, b) => b[1] - a[1])[0];

  return mostCommon; // already "HH:MM:SS" from parseTimeRange
}

/**
 * Build a single content string from payload sections for Tier 2 + Tier 3.
 */
function buildContentText(payload: any): string {
  const parts: string[] = [];

  if (payload.business?.description?.value) {
    parts.push(payload.business.description.value);
  }

  const sections = payload.content_sections ?? [];
  for (const s of sections) {
    if (s.text && s.text.length > 30) parts.push(s.text);
  }

  return parts.join('\n\n');
}

/**
 * Remove null/undefined values from an object before DB write.
 */
function filterNulls(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined)
  );
}

/**
 * Helper to return a JSON response with cors headers.
 */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
