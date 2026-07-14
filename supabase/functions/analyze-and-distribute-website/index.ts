// =====================================================
// Unified Website Analysis & Distribution
// =====================================================
// Purpose: One-click website analysis that orchestrates:
//   Phase 1: Web scraping (Cloud Run)
//   Phase 2: AI interpretation (Gemini)
//   Phase 3: Data distribution (Database writes)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = 'gemini-2.5-flash';
const EXTRACTION_PROMPT_VERSION = 'v3-unified';

interface AnalyzeRequest {
  url: string;
  force_refresh?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url, force_refresh = false }: AnalyzeRequest = await req.json();

    if (!url) {
      throw new Error('url is required');
    }

    const startTime = Date.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ==========================================
    // AUTHENTICATION & BUSINESS RESOLUTION
    // ==========================================
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid or expired token');
    }

    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, name, website_url')
      .eq('owner_id', user.id)
      .limit(1)
      .single();

    if (businessError || !business) {
      throw new Error('No business found for this user');
    }

    const business_id = business.id;
    console.log('🏢 Business:', business_id, 'User:', user.id);

    // ==========================================
    // PHASE 1: WEB SCRAPING
    // ==========================================
    console.log('📡 Phase 1: Web Scraping...');
    
    // Check cache unless forcing refresh
    if (!force_refresh) {
      const { data: cached } = await supabase
        .from('website_scrape_results')
        .select('id, scraped_at, payload, content_quality, extracted_data')
        .eq('url', url)
        .gte('scraped_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('scraped_at', { ascending: false })
        .limit(1)
        .single();

      // Don't use cache if extraction had errors
      if (cached) {
        const extractedData = cached.extracted_data;
        const hasError = extractedData && typeof extractedData === 'string' && extractedData.includes('"error"');
        
        if (hasError) {
          console.log('⚠️ Cached scrape has extraction error - forcing fresh scrape');
        } else {
          console.log('✅ Using cached scrape:', cached.id);
          const payload = cached.payload as any;
          
          // Still do AI + distribution on cached data
          const aiResult = await performAIAnalysis(supabase, business_id, payload);
          await distributeStructuredData(supabase, business_id, payload);
        
          return new Response(
            JSON.stringify({
              success: true,
              cached: true,
              scrape_id: cached.id,
              quality: cached.content_quality,
              ai_analysis: aiResult,
              duration_ms: Date.now() - startTime,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Call Cloud Run scraper
    const cloudRunUrl = Deno.env.get('CLOUD_RUN_SCRAPER_URL') || 
                       'https://scraper-831683741713.europe-west1.run.app';
    const apiKey = Deno.env.get('CLOUD_RUN_API_KEY');

    const scrapeResponse = await fetch(`${cloudRunUrl}/scrape-v3`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey || '',
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(65000),
    });

    if (!scrapeResponse.ok) {
      const errorText = await scrapeResponse.text();
      throw new Error(`Scraper failed: ${scrapeResponse.status} ${errorText}`);
    }

    const payload = await scrapeResponse.json();
    console.log('✅ Scrape complete:', {
      quality: payload.extraction?.quality?.rating,
      pages: payload.pages_crawled?.length,
    });

    // Map quality to enum
    const qualityRating = payload.extraction?.quality?.rating || 'unknown';
    const contentQuality = ['excellent', 'good'].includes(qualityRating) ? 'rich'
      : qualityRating === 'partial' ? 'thin'
      : 'shell';

    const menuSource = payload.extraction?.services?.menu?.url ? 'link'
      : payload.extraction?.menu?.inline ? 'inline'
      : 'none';

    // Store scrape result
    const { data: scrapeResult, error: insertError } = await supabase
      .from('website_scrape_results')
      .insert({
        business_id,
        url,
        scraped_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        scraper_version: 'cloud-run-v3',
        content_quality: contentQuality,
        menu_source: menuSource,
        payload,
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to store scrape: ${insertError.message}`);
    }

    console.log('💾 Stored scrape result:', scrapeResult.id);

    // ==========================================
    // PHASE 2: AI INTERPRETATION
    // ==========================================
    console.log('🤖 Phase 2: AI Analysis...');
    const aiResult = await performAIAnalysis(supabase, business_id, payload);
    
    // Update scrape result with AI data
    await supabase
      .from('website_scrape_results')
      .update({
        extracted_at: new Date().toISOString(),
        extracted_data: aiResult,
        extraction_model: GEMINI_MODEL,
      })
      .eq('id', scrapeResult.id);

    // ==========================================
    // PHASE 3: DATA DISTRIBUTION
    // ==========================================
    console.log('📊 Phase 3: Data Distribution...');
    const distributionSummary = await distributeStructuredData(supabase, business_id, payload, aiResult);

    // ==========================================
    // COMPLETE
    // ==========================================
    const totalDuration = Date.now() - startTime;
    console.log('✅ Complete:', totalDuration, 'ms');

    return new Response(
      JSON.stringify({
        success: true,
        scrape_id: scrapeResult.id,
        quality: contentQuality,
        ai_analysis: aiResult,
        distribution_summary: distributionSummary,
        duration_ms: totalDuration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// =====================================================
// PHASE 2: AI INTERPRETATION
// =====================================================
async function performAIAnalysis(supabase: any, businessId: string, payload: any) {
  const extraction = payload.extraction || payload;
  const contentQuality = extraction?.quality?.rating || 'poor';

  // Skip AI for shell content
  if (contentQuality === 'poor' || contentQuality === 'failed') {
    console.log('⏭️ Skipping AI (insufficient content)');
    return {
      about: null,
      description: null,
      venue_hooks: [],
      keywords: [],
      tone_of_voice: null,
      confidence_score: 0,
      skip_reason: 'insufficient_content',
    };
  }

  // Build prompt from content
  const business = extraction.business || {};
  const sections = extraction.content_sections || [];
  
  console.log('📄 Content sections found:', sections.length);
  if (sections.length > 0) {
    console.log('   First section:', {
      heading: sections[0].heading,
      textLength: sections[0].text?.length || 0,
    });
  }
  
  const textContent = sections
    .filter((s: any) => s.heading && s.text)
    .map((s: any) => `${s.heading}:\n${s.text}`)
    .join('\n\n');

  console.log('📝 Text content length:', textContent.length);

  if (!textContent || textContent.length < 100) {
    console.log('⏭️ Skipping AI (no meaningful text)');
    return {
      about: null,
      description: null,
      venue_hooks: [],
      keywords: [],
      tone_of_voice: null,
      confidence_score: 0,
      skip_reason: 'no_text_content',
    };
  }

  const prompt = `Analyze this business website content and extract key information.

Business Name: ${business.name?.value || 'Unknown'}

Website Content:
${textContent.slice(0, 5000)}

Extract the following in JSON format:
{
  "about": "A 2-3 sentence summary of what this business is and does",
  "description": "A compelling 1-sentence description highlighting what makes them unique",
  "venue_hooks": ["3-5 key selling points like 'rooftop terrace', 'live music', 'dog-friendly'"],
  "keywords": ["5-8 relevant keywords like 'craft beer', 'brunch', 'family-friendly'"],
  "tone_of_voice": "One word: professional/casual/warm/elegant/playful/sophisticated",
  "menu_highlights": ["3-10 standout menu items or food categories if mentioned"],
  "services": {
    "has_table_service": true/false,
    "has_takeaway": true/false,
    "has_delivery": true/false,
    "has_outdoor_seating": true/false
  },
  "confidence_score": 0.85
}`;

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    
    // Extract JSON from markdown code blocks if present
    let jsonText = responseText;
    
    // Try to extract from ```json ... ``` or ``` ... ```
    const jsonMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }
    
    const extractedData = JSON.parse(jsonText);
    console.log('✅ AI extraction complete:', {
      confidence: extractedData.confidence_score,
      tone: extractedData.tone_of_voice,
    });

    // Write AI data to business_profile
    const profileUpdates: any = {};
    
    if (extractedData.about) {
      profileUpdates.user_about_text = extractedData.about;
    }
    
    if (extractedData.description) {
      profileUpdates.long_description = extractedData.description;
    }

    // Store venue_hooks as key_offerings (what makes business unique)
    if (extractedData.venue_hooks && Array.isArray(extractedData.venue_hooks) && extractedData.venue_hooks.length > 0) {
      profileUpdates.key_offerings = extractedData.venue_hooks;
    }

    // Store menu highlights in menu_signal structure
    if (extractedData.menu_highlights && Array.isArray(extractedData.menu_highlights) && extractedData.menu_highlights.length > 0) {
      profileUpdates.menu_signal = {
        signatureItems: extractedData.menu_highlights,
        source: 'ai_website_analysis',
        confidence: extractedData.confidence_score || 0.8,
      };
    }

    // Store keywords and tone for future use
    if (extractedData.keywords && Array.isArray(extractedData.keywords)) {
      profileUpdates.business_keywords = extractedData.keywords;
    }

    if (extractedData.tone_of_voice) {
      profileUpdates.brand_tone = extractedData.tone_of_voice;
    }

    if (Object.keys(profileUpdates).length > 0) {
      await supabase
        .from('business_profile')
        .upsert({
          business_id: businessId,
          ...profileUpdates,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'business_id',
        });
      console.log('  ✓ AI data stored:', Object.keys(profileUpdates).join(', '));
    }

    // Store service model data in business_operations
    if (extractedData.services && typeof extractedData.services === 'object') {
      const operationsUpdates: any = {};
      
      if (typeof extractedData.services.has_table_service === 'boolean') {
        operationsUpdates.has_table_service = extractedData.services.has_table_service;
      }
      if (typeof extractedData.services.has_takeaway === 'boolean') {
        operationsUpdates.has_takeaway = extractedData.services.has_takeaway;
      }
      if (typeof extractedData.services.has_delivery === 'boolean') {
        operationsUpdates.has_delivery = extractedData.services.has_delivery;
      }
      if (typeof extractedData.services.has_outdoor_seating === 'boolean') {
        operationsUpdates.has_outdoor_seating = extractedData.services.has_outdoor_seating;
      }

      if (Object.keys(operationsUpdates).length > 0) {
        await supabase
          .from('business_operations')
          .upsert({
            business_id: businessId,
            ...operationsUpdates,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'business_id',
          });
        console.log('  ✓ Service model stored:', Object.keys(operationsUpdates).join(', '));
      }
    }

    return extractedData;

  } catch (error) {
    console.error('❌ AI analysis failed:', error);
    return {
      about: null,
      description: null,
      venue_hooks: [],
      keywords: [],
      tone_of_voice: null,
      confidence_score: 0,
      error: error.message,
    };
  }
}

// =====================================================
// PHASE 3: DATA DISTRIBUTION
// =====================================================
async function distributeStructuredData(supabase: any, businessId: string, payload: any, aiResult: any) {
  const extraction = payload.extraction || payload;
  const business = extraction.business || {};
  const contact = extraction.contact || {};
  const services = extraction.services || {};
  const openingHours = extraction.opening_hours || {};
  const social = extraction.social || {};

  console.log('📝 Distributing structured data...');

  // Track what gets distributed
  const summary: any = {
    tables_updated: [],
    fields_by_table: {},
    ai_fields: {},
    structured_data: {},
  };

  // ===== UPDATE businesses TABLE =====
  if (business.name?.value && business.name.confidence >= 0.7) {
    await supabase
      .from('businesses')
      .update({
        name: business.name.value,
        last_scraped_at: new Date().toISOString(),
      })
      .eq('id', businessId);
    console.log('  ✓ Business name updated');
    summary.tables_updated.push('businesses');
    summary.fields_by_table.businesses = ['name', 'last_scraped_at'];
    summary.structured_data.business_name = business.name.value;
  }

  // ===== UPDATE business_profile TABLE =====
  const profileUpdates: any = {};

  if (services.booking?.url && services.booking.confidence >= 0.7) {
    profileUpdates.booking_url = services.booking.url;
  }

  if (services.takeaway?.url && services.takeaway.confidence >= 0.7) {
    profileUpdates.takeaway_url = services.takeaway.url;
  }

  if (services.maps?.url && services.maps.confidence >= 0.7) {
    profileUpdates.google_maps_url = services.maps.url;
  }

  if (services.findsmiley?.url && services.findsmiley.confidence >= 0.7) {
    profileUpdates.food_inspection_url = services.findsmiley.url;
  }

  // Store social profiles as JSONB array
  const socialProfiles = [];
  if (social.facebook?.url) {
    socialProfiles.push({
      platform: 'facebook',
      url: social.facebook.url,
      confidence: social.facebook.confidence || 0.8,
    });
  }
  if (social.instagram?.url) {
    socialProfiles.push({
      platform: 'instagram',
      url: social.instagram.url,
      confidence: social.instagram.confidence || 0.8,
    });
  }
  if (social.linkedin?.url) {
    socialProfiles.push({
      platform: 'linkedin',
      url: social.linkedin.url,
      confidence: social.linkedin.confidence || 0.8,
    });
  }

  if (socialProfiles.length > 0) {
    profileUpdates.social_profiles = socialProfiles;
  }

  if (Object.keys(profileUpdates).length > 0) {
    await supabase
      .from('business_profile')
      .upsert({
        business_id: businessId,
        ...profileUpdates,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'business_id',
      });
    console.log('  ✓ Business profile updated:', Object.keys(profileUpdates).join(', '));
  }

  // ===== UPDATE business_locations TABLE =====
  const locationUpdates: any = {};

  if (contact.emails?.length > 0 && contact.emails[0].confidence >= 0.7) {
    locationUpdates.email = contact.emails[0].value;
  }

  if (contact.phones?.length > 0 && contact.phones[0].confidence >= 0.7) {
    locationUpdates.phone = contact.phones[0].value;
  }

  if (contact.addresses?.length > 0 && contact.addresses[0].confidence >= 0.7) {
    locationUpdates.address_line1 = contact.addresses[0].value;
  }

  if (Object.keys(locationUpdates).length > 0) {
    // Find the primary location for this business
    const { data: existingLocation } = await supabase
      .from('business_locations')
      .select('id')
      .eq('business_id', businessId)
      .eq('is_primary', true)
      .maybeSingle();

    if (existingLocation) {
      const { error: updateError } = await supabase
        .from('business_locations')
        .update({
          ...locationUpdates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingLocation.id);
      
      if (updateError) {
        console.error('❌ Failed to update business_locations:', updateError);
      } else {
        console.log('  ✓ Location contact info updated:', Object.keys(locationUpdates).join(', '));
      }
    } else {
      const { error: insertError } = await supabase
        .from('business_locations')
        .insert({
          business_id: businessId,
          is_primary: true,
          ...locationUpdates,
        });
      
      if (insertError) {
        console.error('❌ Failed to insert business_locations:', insertError);
      } else {
        console.log('  ✓ Primary location created with contact info');
      }
    }
  }

  // ===== UPDATE opening_hours TABLE =====
  console.log('🕐 Opening hours data:', {
    hasCandidates: !!openingHours.candidates,
    candidatesCount: openingHours.candidates?.length || 0,
    firstCandidate: openingHours.candidates?.[0] || null,
  });

  if (openingHours.candidates?.length > 0) {
    // Parse opening hours
    const parsedHours = parseOpeningHours(openingHours.candidates);
    console.log('  📊 Parsed hours:', parsedHours.length, 'days');
    
    if (parsedHours.length > 0) {
      // Delete existing opening hours
      await supabase
        .from('opening_hours')
        .delete()
        .eq('business_id', businessId)
        .eq('kind', 'normal');

      // Insert new opening hours
      const { error: insertError } = await supabase
        .from('opening_hours')
        .insert(parsedHours.map(h => ({
          business_id: businessId,
          kind: 'normal',
          weekday: h.weekday,
          open_time: h.open_time,
          close_time: h.close_time,
        })));

      if (!insertError) {
        console.log('  ✓ Opening hours updated:', parsedHours.length, 'days');
      } else {
        console.error('  ✗ Opening hours error:', insertError);
      }
    }
  }

  // ===== UPDATE social_accounts TABLE =====
  for (const profile of socialProfiles) {
    const handle = extractHandleFromUrl(profile.url, profile.platform);
    
    if (handle) {
      await supabase
        .from('social_accounts')
        .upsert({
          business_id: businessId,
          platform: profile.platform,
          handle,
          profile_url: profile.url,
          is_connected: false, // Scraper discovered, not OAuth connected
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'business_id,platform',
        });
    }
  }

  if (socialProfiles.length > 0) {
    console.log('  ✓ Social accounts updated:', socialProfiles.map(p => p.platform).join(', '));
  }

  // ===== CREATE menu_sources ENTRY =====
  if (services.menu?.url) {
    await supabase
      .from('menu_sources')
      .upsert({
        business_id: businessId,
        source_url: services.menu.url,
        source_type: services.menu.type || 'link',
        is_active: true,
        discovered_at: new Date().toISOString(),
      }, {
        onConflict: 'business_id,source_url',
      });
    console.log('  ✓ Menu source stored');
  }

  console.log('✅ Data distribution complete');

  // Build detailed summary of what was distributed
  if (aiResult && !aiResult.skip_reason) {
    summary.ai_fields = {
      user_about_text: aiResult.about || null,
      long_description: aiResult.description || null,
      key_offerings: aiResult.venue_hooks || [],
      menu_signal: aiResult.menu_highlights ? { signatureItems: aiResult.menu_highlights } : null,
      business_keywords: aiResult.keywords || [],
      brand_tone: aiResult.tone_of_voice || null,
      service_model: aiResult.services || null,
    };
  } else {
    summary.ai_skip_reason = aiResult?.skip_reason || 'unknown';
  }

  // Log comprehensive summary
  console.log('📋 Distribution Summary:');
  console.log('  Scraped Data:');
  if (summary.structured_data.business_name) console.log('    • Business name:', summary.structured_data.business_name);
  if (services.booking?.url) console.log('    • Booking URL:', services.booking.url);
  if (services.takeaway?.url) console.log('    • Takeaway URL:', services.takeaway.url);
  if (contact.emails?.[0]) console.log('    • Email:', contact.emails[0].value);
  if (contact.addresses?.[0]) console.log('    • Address:', contact.addresses[0].value);
  if (openingHours.candidates?.length > 0) console.log('    • Opening hours:', openingHours.candidates.length, 'days');
  if (socialProfiles.length > 0) console.log('    • Social accounts:', socialProfiles.map(p => p.platform).join(', '));
  if (services.menu?.url) console.log('    • Menu URL:', services.menu.url);
  
  console.log('  AI Extracted Data:');
  if (aiResult && !aiResult.skip_reason) {
    if (aiResult.about) console.log('    • About text:', aiResult.about.substring(0, 80) + '...');
    if (aiResult.venue_hooks?.length) console.log('    • Key offerings:', aiResult.venue_hooks.length, 'items');
    if (aiResult.menu_highlights?.length) console.log('    • Menu highlights:', aiResult.menu_highlights.length, 'items');
    if (aiResult.keywords?.length) console.log('    • Keywords:', aiResult.keywords.join(', '));
    if (aiResult.tone_of_voice) console.log('    • Tone:', aiResult.tone_of_voice);
  } else {
    console.log('    ⚠️ AI skipped:', aiResult?.skip_reason || 'unknown');
  }

  return summary;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function parseOpeningHours(candidates: any[]): Array<{weekday: string, open_time: string, close_time: string}> {
  const result: Array<{weekday: string, open_time: string, close_time: string}> = [];
  const weekdayMap: Record<string, string> = {
    'monday': 'monday', 'mon': 'monday', 'mandag': 'monday',
    'tuesday': 'tuesday', 'tue': 'tuesday', 'tirsdag': 'tuesday',
    'wednesday': 'wednesday', 'wed': 'wednesday', 'onsdag': 'wednesday',
    'thursday': 'thursday', 'thu': 'thursday', 'torsdag': 'thursday',
    'friday': 'friday', 'fri': 'friday', 'fredag': 'friday',
    'saturday': 'saturday', 'sat': 'saturday', 'lørdag': 'saturday',
    'sunday': 'sunday', 'sun': 'sunday', 'søndag': 'sunday',
  };

  for (const candidate of candidates) {
    // Handle both string and object formats
    let candidateStr: string;
    if (typeof candidate === 'object' && candidate !== null) {
      // Object format: {day: "monday", time: "09.30 - 23.00"}
      candidateStr = `${candidate.day}: ${candidate.time}`;
    } else {
      candidateStr = String(candidate);
    }
    
    const match = candidateStr.match(/^([a-zæøåä]+)[\s:]+(\d{1,2}[:.]\d{2})\s*[-–—til to]+\s*(\d{1,2}[:.]\d{2})/i);
    
    if (match) {
      const [, day, openTime, closeTime] = match;
      const weekday = weekdayMap[day.toLowerCase()];
      
      if (weekday) {
        // Normalize time format (HH:MM → HH:MM:SS)
        let normalizedOpen = openTime.replace('.', ':');
        let normalizedClose = closeTime.replace('.', ':');
        
        if (!normalizedOpen.includes(':')) normalizedOpen += ':00';
        if (!normalizedClose.includes(':')) normalizedClose += ':00';
        if (normalizedOpen.split(':').length === 2) normalizedOpen += ':00';
        if (normalizedClose.split(':').length === 2) normalizedClose += ':00';
        
        // Handle 24:00 → 00:00
        if (normalizedClose.startsWith('24:')) {
          normalizedClose = '00:' + normalizedClose.slice(3);
        }
        
        result.push({
          weekday,
          open_time: normalizedOpen,
          close_time: normalizedClose,
        });
      }
    }
  }
  
  return result;
}

function extractHandleFromUrl(url: string, platform: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    if (platform === 'facebook') {
      const match = pathname.match(/\/([^/?]+)\/?$/);
      return match ? match[1] : null;
    }
    
    if (platform === 'instagram') {
      const match = pathname.match(/\/([^/?]+)\/?$/);
      return match ? match[1] : null;
    }
    
    if (platform === 'linkedin') {
      const match = pathname.match(/\/company\/([^/?]+)/);
      return match ? match[1] : null;
    }
    
    return null;
  } catch {
    return null;
  }
}
