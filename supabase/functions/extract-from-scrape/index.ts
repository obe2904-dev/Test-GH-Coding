// =====================================================
// Step 2: AI Extraction from stored scrape data
// =====================================================
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Import OLD proven AI extractors
import { extractBasicInfo } from '../_shared/ai-extractors/basic-info-extractor.ts';
import { extractContact } from '../_shared/ai-extractors/contact-extractor.ts';
import { extractMenuSignal } from '../_shared/ai-extractors/menu-signal-extractor.ts';
import { getCityFromPostalCode } from '../_shared/brand-profile/city-context-ai.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
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
    
    // Debug: Check if kitchen_close_time is in tier1
    if (tier1['kitchen_close_time']) {
      console.log(`🍳 [DEBUG] kitchen_close_time in tier1:`, tier1['kitchen_close_time']);
    } else {
      console.log(`🍳 [DEBUG] kitchen_close_time NOT in tier1`);
    }
    
    // ── AI Extraction using OLD proven extractors ────────────────────────────
    const labeledContent = buildLabeledContent(extraction);
    const aiExtracted = aiAllowed
      ? await extractUsingAIExtractors(extraction, labeledContent)
      : {};

    // ── Merge into table buckets ─────────────────────────────────────────────
    const businessLocations  = buildBusinessLocations(tier1, aiExtracted);
    const businessOperations = buildBusinessOperations(tier1, tier2, aiExtracted);
    
    // Debug: Check if kitchen_close_time made it to businessOperations
    console.log(`🍳 [DEBUG] businessOperations object:`, JSON.stringify(businessOperations, null, 2));
    if (businessOperations.kitchen_close_time) {
      console.log(`🍳 [DEBUG] kitchen_close_time in businessOperations:`, businessOperations.kitchen_close_time);
    } else {
      console.log(`🍳 [DEBUG] kitchen_close_time NOT in businessOperations`);
    }
    
    const businessProfile    = buildBusinessProfile(tier1, aiExtracted);
    const businesses         = buildBusinesses(aiExtracted);
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
// CONTENT TRANSFORMATION — Convert scraper JSON to labeled text format
// This mimics the OLD system's HTML→text conversion for AI extractors
// ═════════════════════════════════════════════════════════════════════════════

function buildLabeledContent(scraperPayload: any): string {
  const contentSections = scraperPayload.content_sections || [];
  
  // Separate navigation sections from body sections
  const navigationSections: any[] = [];
  const bodySections: any[] = [];
  
  for (const section of contentSections) {
    const heading = section.heading || '';
    // Navigation keywords are SIGNAL, not noise — separate them for explicit labeling
    if (/MENUKORT|BRUNCH|FROKOST|KONTAKT|BOOK DIT BORD|MENU|DRINKS|AFTEN/i.test(heading)) {
      navigationSections.push(section);
    } else {
      bodySections.push(section);
    }
  }
  
  // Score body sections only (no negative penalty for nav headings)
  const scoredSections = bodySections
    .map((section: any) => {
      const heading = section.heading || null;
      const text = section.text || '';
      
      let score = 0;
      
      // Has meaningful heading
      if (heading && heading.length > 3) {
        score += 20;
      }
      
      // Text length (optimal: 100-2000 chars)
      if (text.length >= 100 && text.length <= 2000) {
        score += 30;
      } else if (text.length > 50 && text.length < 5000) {
        score += 10;
      }
      
      // Low link density
      const linkCount = (text.match(/Link to|href|http|www\./gi) || []).length;
      const wordCount = text.split(/\s+/).length;
      const linkDensity = wordCount > 0 ? linkCount / wordCount : 0;
      
      if (linkDensity < 0.1) {
        score += 30;
      } else if (linkDensity > 0.3) {
        score -= 20;
      }
      
      // Business-relevant words
      if (/velkommen|welcome|om os|about|cafe|restaurant|mad|food|oplevelse|experience/i.test(text)) {
        score += 20;
      }
      
      return { section, heading, text, score };
    })
    .filter(item => item.score > 0 && item.text.length >= 50)
    .sort((a, b) => b.score - a.score);
  
  console.log(`🔍 Section scoring: ${scoredSections.length} body sections (${navigationSections.length} navigation sections separated)`);
  
  // Build body content
  const sections: string[] = [];
  for (const item of scoredSections) {
    const heading = item.heading || 'Section';
    sections.push(`=== ${heading} ===\n${item.text}`);
  }
  
  // Add contact information
  if (scraperPayload.contact) {
    const contactParts: string[] = [];
    if (scraperPayload.contact.phones?.[0]?.value) {
      contactParts.push(`Phone: ${scraperPayload.contact.phones[0].value}`);
    }
    if (scraperPayload.contact.emails?.[0]?.value) {
      contactParts.push(`Email: ${scraperPayload.contact.emails[0].value}`);
    }
    if (scraperPayload.contact.addresses?.[0]?.value) {
      contactParts.push(`Address: ${scraperPayload.contact.addresses[0].value}`);
    }
    if (contactParts.length > 0) {
      sections.push(`=== Contact Information ===\n${contactParts.join('\n')}`);
    }
  }
  
  const bodyText = sections.join('\n\n');
  
  // Navigation labels passed explicitly as offerings signal (like OLD system did by accident)
  const navText = navigationSections
    .map(s => s.heading || s.text || '')
    .filter(Boolean)
    .join(' | ');
  
  const navBlock = navText
    ? `NAVIGATION LABELS (use these for key_offerings / Det i tilbyder):\n${navText}\n\n---\n\n`
    : '';
  
  const labeledContent = `${navBlock}${bodyText}`;
  
  console.log(`📝 Built labeled content: ${labeledContent.length} chars (${navigationSections.length} nav labels + ${scoredSections.length} body sections)`);
  
  return labeledContent;
}

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
    const { address_line1, postal_code, city } = splitDanishAddress(rawAddress);
    t1('address_line1', address_line1, 'contact.addresses[0] split');
    t1('postal_code',   postal_code,   'contact.addresses[0] split');
    t1('city',          city,          'contact.addresses[0] split');
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

  // user_about_text: REMOVED - let AI extractors handle this with quality filtering
  // Old logic selected largest section which often picked navigation menus
  // AI extractors use quality-filtered content and understand business descriptions

  // kitchen_close_time: Prefer explicit extraction from scraper, fall back to derived from opening hours
  let kitchenClose = payload.kitchen_close_time; // Explicit from scraper (e.g., "Køkkenet er åbent frem til kl. 21")
  if (!kitchenClose) {
    const candidates = payload.opening_hours?.candidates ?? [];
    kitchenClose = deriveKitchenCloseTime(candidates); // Fallback: most common close time
  }
  if (kitchenClose) {
    r['kitchen_close_time'] = { 
      value: kitchenClose, 
      tier: 1, 
      source: payload.kitchen_close_time ? 'scraper.kitchen_close_time' : 'opening_hours.candidates' 
    };
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

  const hasAny = (...patterns: Array<string | RegExp>) =>
    patterns.some((pattern) =>
      typeof pattern === 'string'
        ? t.includes(pattern)
        : pattern.test(t)
    );

  const detectServicePeriods = () => {
    const periods = new Set<string>();

    if (hasAny('brunch', 'morgenmad', /breakfast/)) periods.add('breakfast');
    if (hasAny('frokost', 'lunch', 'midt på dagen', 'dagtid')) periods.add('lunch');
    if (hasAny('aften', 'middag', 'dinner', 'evening', 'aftensmad')) periods.add('dinner');
    if (hasAny('bar', 'drikke', 'drikkevarer', 'cocktail', 'wine', 'vin', 'øl', 'beer', 'kaffe', 'coffee')) periods.add('drinks');
    if (hasAny('særarrangement', 'event', 'arrangement', 'fest', 'selskab', 'party')) periods.add('special_events');

    return Array.from(periods);
  };

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

  // has_outdoor_seating — include terrace/patio language as well as udeservering
  flag('has_outdoor_seating',
    /udeservering|udendørs\s+servering|terrasse|overdækket\s+terrasse|patio|gårdhave|courtyard|outdoor\s+seating/.test(t),
    'keyword: outdoor seating signals'
  );

  // reservation_required — explicit booking / reservation language only
  flag('reservation_required',
    /reservation\s*påkrævet|kun\s+reservation|bordreservation\s+påkrævet|reservering\s+nødvendig/.test(t),
    'keyword: explicit reservation requirement'
  );

  // accepts_walk_ins — explicit walk-in friendly language only
  flag('accepts_walk_ins',
    /walk[-\s]?ins?|drop[-\s]?in|kom\s+bare\s+ind|uden\s+bordreservation|uden\s+booking/.test(t),
    'keyword: explicit walk-in language'
  );

  const servicePeriods = detectServicePeriods();
  if (servicePeriods.length > 0) {
    r['service_periods'] = { value: servicePeriods, tier: 2, source: 'keyword: homepage service language' };
  }

  return r;
}

// ═════════════════════════════════════════════════════════════════════════════
// AI EXTRACTION — Use OLD proven extractors (parallel execution)
// Replaces old extractTier3 + extractMenuOfferings with proven AI extractors
// ═════════════════════════════════════════════════════════════════════════════

async function extractUsingAIExtractors(
  payload: any,
  labeledContent: string
): Promise<Record<string, FieldResult>> {
  const r: Record<string, FieldResult> = {};

  if (!GEMINI_API_KEY || !OPENAI_API_KEY) {
    console.warn('⚠️  Missing API keys (GEMINI or OPENAI) — skipping AI extraction');
    return r;
  }

  if (labeledContent.length < 200) {
    console.log('⏭️  Labeled content too short for AI extraction');
    return r;
  }

  const t3 = (key: string, value: unknown, source: string) => {
    if (value !== null && value !== undefined && value !== '') {
      r[key] = { value, tier: 3, source };
    }
  };

  try {
    // Prepare context hints for extractors
    const metadata = {
      title: payload.business?.name?.value || payload.meta?.title,
      description: payload.meta?.description,
    };
    
    const hints = {
      businessName: payload.business?.name?.value || null,
      businessType: payload.business?.type?.value || null,
      languageHint: payload.meta?.detected_language || 'da',
    };

    console.log(`🤖 Running AI extractors in parallel...`);

    // Run extractors in parallel (like OLD system)
    const [basicInfo, contactInfo, menuSignal] = await Promise.all([
      extractBasicInfo(labeledContent, metadata, null, hints, OPENAI_API_KEY),
      extractContact(labeledContent, [], OPENAI_API_KEY, hints.languageHint),
      extractMenuSignal(labeledContent, {
        businessName: hints.businessName,
        businessType: hints.businessType,
        languageHint: hints.languageHint,
      }),
    ]);

    console.log(`✅ AI extractors complete`);
    console.log(`   - basicInfo:`, Object.keys(basicInfo));
    console.log(`   - contactInfo:`, Object.keys(contactInfo));
    console.log(`   - menuSignal:`, Object.keys(menuSignal));

    // Map basicInfo results
    t3('business_name', basicInfo.businessName, 'ai_basic_info');
    t3('local_location_reference', basicInfo.localLocationReference, 'ai_basic_info');
    
    // user_about_text: Capture how business brands itself + what they offer
    // basicInfo.description is designed to extract brand identity from actual website content
    // If it's short (< 100 chars), enhance with menuDescription for richer detail
    let aboutText = basicInfo.description || menuSignal.placeSynopsis || '';
    
    if (aboutText && aboutText.length < 100 && menuSignal.menuDescription) {
      // Short brand statement + detailed offerings = comprehensive description
      aboutText = `${aboutText}\n\n${menuSignal.menuDescription}`;
      t3('user_about_text', aboutText, 'ai_combined');
    } else if (aboutText) {
      // Rich description already captures brand + offerings
      const source = basicInfo.description ? 'ai_basic_info' : 'ai_menu_signal';
      t3('user_about_text', aboutText, source);
    }
    
    // ai_place_synopsis: Use menu-signal's focused synthesis for backwards compatibility
    if (menuSignal.placeSynopsis) {
      t3('ai_place_synopsis', menuSignal.placeSynopsis, 'ai_menu_signal');
    }

    // Map contactInfo results (as fallback - Tier 1 takes priority in merge)
    if (contactInfo.phone) {
      t3('phone', contactInfo.phone, 'ai_contact');
    }
    if (contactInfo.email) {
      t3('email', contactInfo.email, 'ai_contact');
    }
    if (contactInfo.address) {
      t3('address_line1', contactInfo.address.street, 'ai_contact');
      t3('postal_code', contactInfo.address.postalCode, 'ai_contact');
    }

    // Map menuSignal results
    if (menuSignal.signatureItems && menuSignal.signatureItems.length > 0) {
      t3('key_offerings', menuSignal.signatureItems.join('\n'), 'ai_menu_signal');
    }
    if (menuSignal.menuDescription) {
      t3('menu_description', menuSignal.menuDescription, 'ai_menu_signal');
    }
    if (menuSignal.placeSynopsis) {
      t3('place_synopsis', menuSignal.placeSynopsis, 'ai_menu_signal');
    }

    // Store full menu signal as JSON for backwards compatibility
    t3('menu_signal', JSON.stringify(menuSignal), 'ai_menu_signal');

    console.log(`✅ AI extraction complete, fields extracted:`, Object.keys(r));
    return r;

  } catch (err) {
    console.error('❌ AI extraction failed:', err);
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
// Priority: Tier 1 > AI Extractors > Tier 2 per field.
// Tier 1 always wins (structural facts beat inference).
// ═════════════════════════════════════════════════════════════════════════════

function buildBusinessLocations(
  t1: Record<string, FieldResult>,
  ai: Record<string, FieldResult>
) {
  // Tier 1 (scraper direct) takes priority, AI extractors as fallback
  const postalCode = (t1.postal_code ?? ai.postal_code)?.value ?? null;
  const derivedCity = getCityFromPostalCode(typeof postalCode === 'string' ? postalCode : null);

  return {
    email:         (t1.email ?? ai.email)?.value                 ?? null,
    phone:         (t1.phone ?? ai.phone)?.value                 ?? null,
    address_line1: (t1.address_line1 ?? ai.address_line1)?.value ?? null,
    postal_code:   postalCode,
    city:          derivedCity ?? (t1.city ?? ai.city)?.value     ?? null,
  };
}

function buildBusinessOperations(
  t1: Record<string, FieldResult>,
  t2: Record<string, FieldResult>,
  ai: Record<string, FieldResult>,
) {
  // Tier 1 wins over AI wins over Tier 2 for overlapping keys
  const get = (key: string) =>
    (t1[key] ?? ai[key] ?? t2[key])?.value ?? null;

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
    service_periods:      get('service_periods'),
  };
}

function buildBusinessProfile(
  t1: Record<string, FieldResult>,
  ai: Record<string, FieldResult>,
) {
  // Tier 1 > AI for overlapping keys
  const get = (key: string) => (t1[key] ?? ai[key])?.value ?? null;

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

function buildBusinesses(ai: Record<string, FieldResult>) {
  return {
    // Update business name from website (corrects typos, handles rebranding)
    name: ai.business_name?.value ?? null,
    // Update local location reference (e.g., "ved åen")
    local_location_reference: ai.local_location_reference?.value ?? null,
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
    // Check if a location row exists for this business
    const { data: existing, error: fetchError } = await supabase
      .from('business_locations')
      .select('id')
      .eq('business_id', business_id)
      .limit(1)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existing) {
      // Update existing row, ensure is_primary is true
      const { error: updateError } = await supabase
        .from('business_locations')
        .update({ 
          is_primary: true,
          country: 'Denmark',
          ...data 
        })
        .eq('id', existing.id);
      
      if (updateError) throw updateError;
    } else {
      // Insert new row as primary location
      const { error: insertError } = await supabase
        .from('business_locations')
        .insert({ 
          business_id, 
          is_primary: true,
          country: 'Denmark', 
          ...data 
        });
      
      if (insertError) throw insertError;
    }

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
  city:          string | null;
} {
  // Match: "Street Number PostalCode City"
  const match = raw.match(/^(.+?)\s+(\d{4})\s+(.+)$/);
  if (!match) return { address_line1: null, postal_code: null, city: null };
  return {
    address_line1: match[1].trim(),
    postal_code:   match[2],
    city:          match[3].trim(),
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
