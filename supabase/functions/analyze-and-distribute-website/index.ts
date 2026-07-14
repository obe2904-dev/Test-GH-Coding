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
const GEMINI_MODEL = 'gemini-2.0-flash-exp';
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
        .select('id, scraped_at, payload, content_quality')
        .eq('url', url)
        .gte('scraped_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('scraped_at', { ascending: false })
        .limit(1)
        .single();

      if (cached) {
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
    await distributeStructuredData(supabase, business_id, payload);

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
  const textContent = sections
    .filter((s: any) => s.section_heading && s.text_content)
    .map((s: any) => `${s.section_heading}:\n${s.text_content}`)
    .join('\n\n');

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
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                     responseText.match(/```\n([\s\S]*?)\n```/) ||
                     [null, responseText];
    
    const extractedData = JSON.parse(jsonMatch[1]);
    console.log('✅ AI extraction complete:', {
      confidence: extractedData.confidence_score,
      tone: extractedData.tone_of_voice,
    });

    // Write AI data to business_profile
    const profileUpdates: any = {};
    
    if (extractedData.about) {
      profileUpdates.ai_place_synopsis = extractedData.about;
    }
    
    if (extractedData.description) {
      profileUpdates.long_description = extractedData.description;
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
async function distributeStructuredData(supabase: any, businessId: string, payload: any) {
  const extraction = payload.extraction || payload;
  const business = extraction.business || {};
  const contact = extraction.contact || {};
  const services = extraction.services || {};
  const openingHours = extraction.opening_hours || {};
  const social = extraction.social || {};

  console.log('📝 Distributing structured data...');

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

  // ===== UPDATE profiles TABLE =====
  const profileContactUpdates: any = {};

  if (contact.emails?.length > 0 && contact.emails[0].confidence >= 0.7) {
    profileContactUpdates.business_email = contact.emails[0].value;
  }

  if (contact.phones?.length > 0 && contact.phones[0].confidence >= 0.7) {
    profileContactUpdates.phone = contact.phones[0].value;
  }

  if (contact.addresses?.length > 0 && contact.addresses[0].confidence >= 0.7) {
    profileContactUpdates.address = contact.addresses[0].value;
  }

  if (Object.keys(profileContactUpdates).length > 0) {
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', businessId)
      .single();

    if (existingProfile) {
      await supabase
        .from('profiles')
        .update(profileContactUpdates)
        .eq('id', businessId);
    }
    console.log('  ✓ Contact info updated:', Object.keys(profileContactUpdates).join(', '));
  }

  // ===== UPDATE opening_hours TABLE =====
  if (openingHours.candidates?.length > 0) {
    // Parse opening hours
    const parsedHours = parseOpeningHours(openingHours.candidates);
    
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
