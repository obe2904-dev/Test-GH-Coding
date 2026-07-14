// =====================================================
// Distribute Scrape Data
// =====================================================
// Purpose: Take scraped website data and distribute to appropriate database tables
// Called after web scraping completes to populate business profile fields

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DistributeRequest {
  scrape_job_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { scrape_job_id }: DistributeRequest = await req.json();

    if (!scrape_job_id) {
      throw new Error('scrape_job_id is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract user from Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid or expired token');
    }

    console.log('Distributing scrape data for job:', scrape_job_id, 'user:', user.id);

    // Fetch scrape result
    const { data: scrapeResult, error: fetchError } = await supabase
      .from('website_scrape_results')
      .select('business_id, payload')
      .eq('id', scrape_job_id)
      .single();

    if (fetchError || !scrapeResult) {
      throw new Error(`Scrape job not found: ${scrape_job_id}`);
    }

    const { business_id, payload } = scrapeResult;
    const extraction = payload.extraction;

    if (!extraction) {
      throw new Error('No extraction data in payload');
    }

    console.log('Extraction quality:', extraction.quality?.rating, 'Fields found:', extraction.quality?.fields_found);

    // =========================================
    // 1. Update businesses table
    // =========================================
    const businessUpdates: any = {};
    
    if (extraction.business?.name?.value) {
      businessUpdates.name = extraction.business.name.value;
    }

    if (Object.keys(businessUpdates).length > 0) {
      const { error: bizError } = await supabase
        .from('businesses')
        .update(businessUpdates)
        .eq('id', business_id);

      if (bizError) {
        console.error('Failed to update businesses:', bizError);
        throw bizError;
      }
      console.log('Updated businesses table:', Object.keys(businessUpdates));
    }

    // =========================================
    // 2. Update business_profile table
    // =========================================
    const profileUpdates: any = {};

    if (extraction.business?.description?.value) {
      profileUpdates.user_about_text = extraction.business.description.value;
      profileUpdates.long_description = extraction.business.description.value;
    }

    if (extraction.services?.booking?.url) {
      profileUpdates.booking_url = extraction.services.booking.url;
    }

    if (extraction.services?.takeaway?.url) {
      profileUpdates.takeaway_url = extraction.services.takeaway.url;
    }

    if (extraction.services?.google_maps?.url) {
      profileUpdates.google_maps_url = extraction.services.google_maps.url;
    }

    if (extraction.services?.food_inspection?.url) {
      profileUpdates.food_inspection_url = extraction.services.food_inspection.url;
    }

    if (extraction.services?.social_profiles && extraction.services.social_profiles.length > 0) {
      profileUpdates.social_profiles = extraction.services.social_profiles;
    }

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await supabase
        .from('business_profile')
        .update(profileUpdates)
        .eq('business_id', business_id);

      if (profileError) {
        console.error('Failed to update business_profile:', profileError);
        throw profileError;
      }
      console.log('Updated business_profile table:', Object.keys(profileUpdates));
    }

    // =========================================
    // 3. Update profiles table (contact info)
    // =========================================
    const contactUpdates: any = {};

    if (extraction.contact?.emails && extraction.contact.emails.length > 0) {
      contactUpdates.business_email = extraction.contact.emails[0].value;
    }

    if (extraction.contact?.phones && extraction.contact.phones.length > 0) {
      contactUpdates.phone = extraction.contact.phones[0].value;
    }

    if (extraction.contact?.addresses && extraction.contact.addresses.length > 0) {
      contactUpdates.address = extraction.contact.addresses[0].value;
    }

    if (Object.keys(contactUpdates).length > 0) {
      const { error: profilesError } = await supabase
        .from('profiles')
        .update(contactUpdates)
        .eq('id', user.id);

      if (profilesError) {
        console.error('Failed to update profiles:', profilesError);
        throw profilesError;
      }
      console.log('Updated profiles table:', Object.keys(contactUpdates));
    }

    // =========================================
    // 4. Parse and insert opening_hours
    // =========================================
    if (extraction.opening_hours?.candidates && extraction.opening_hours.candidates.length > 0) {
      const openingHoursRows = parseOpeningHours(extraction.opening_hours.candidates, business_id);
      
      if (openingHoursRows.length > 0) {
        // Delete existing opening hours
        await supabase
          .from('opening_hours')
          .delete()
          .eq('business_id', business_id);

        // Insert new opening hours
        const { error: hoursError } = await supabase
          .from('opening_hours')
          .insert(openingHoursRows);

        if (hoursError) {
          console.error('Failed to insert opening_hours:', hoursError);
          throw hoursError;
        }
        console.log('Inserted', openingHoursRows.length, 'opening_hours rows');
      }
    }

    // =========================================
    // 5. Create menu_sources entry
    // =========================================
    if (extraction.services?.menu?.url) {
      // Check if menu source already exists
      const { data: existing } = await supabase
        .from('menu_sources')
        .select('id')
        .eq('business_id', business_id)
        .eq('source_url', extraction.services.menu.url)
        .single();

      if (!existing) {
        const { error: menuError } = await supabase
          .from('menu_sources')
          .insert({
            business_id: business_id,
            source_url: extraction.services.menu.url,
            source_type: 'url',
            menu_type: 'standard',
            source_origin: 'ai_detected',
            status: 'detected',
            created_by: user.id,
            label: 'Menukort'
          });

        if (menuError) {
          console.error('Failed to create menu_sources:', menuError);
          throw menuError;
        }
        console.log('Created menu_sources entry for:', extraction.services.menu.url);
      } else {
        console.log('Menu source already exists, skipping');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Scrape data distributed successfully',
        updated_tables: {
          businesses: Object.keys(businessUpdates).length > 0,
          business_profile: Object.keys(profileUpdates).length > 0,
          profiles: Object.keys(contactUpdates).length > 0,
          opening_hours: extraction.opening_hours?.candidates?.length > 0,
          menu_sources: !!extraction.services?.menu?.url
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in distribute-scrape-data:', error);
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

/**
 * Parse opening hours candidates into database rows
 * Handles day ranges like "Mandag - Torsdag" by expanding into individual days
 */
function parseOpeningHours(candidates: any[], business_id: string) {
  const rows: any[] = [];
  const dayMap: Record<string, string> = {
    'mandag': 'monday',
    'monday': 'monday',
    'tirsdag': 'tuesday',
    'tuesday': 'tuesday',
    'onsdag': 'wednesday',
    'wednesday': 'wednesday',
    'torsdag': 'thursday',
    'thursday': 'thursday',
    'fredag': 'friday',
    'friday': 'friday',
    'lørdag': 'saturday',
    'saturday': 'saturday',
    'søndag': 'sunday',
    'sunday': 'sunday'
  };

  for (const candidate of candidates) {
    const dayText = candidate.day_text.toLowerCase().trim();
    const timeText = candidate.time_text.trim();

    // Parse time - format like "11.30 - 23.30" or "11:30 - 00:00"
    const timeMatch = timeText.match(/(\d{1,2})[.:](\d{2})\s*-\s*(\d{1,2})[.:](\d{2})/);
    if (!timeMatch) {
      console.warn('Could not parse time:', timeText);
      continue;
    }

    const openHour = timeMatch[1].padStart(2, '0');
    const openMin = timeMatch[2];
    let closeHour = timeMatch[3].padStart(2, '0');
    const closeMin = timeMatch[4];

    // Normalize 24:00 to 00:00 (midnight end-of-day)
    if (closeHour === '24') {
      closeHour = '00';
    }

    const open_time = `${openHour}:${openMin}:00`;
    const close_time = `${closeHour}:${closeMin}:00`;

    // Check if it's a day range (e.g., "Mandag - Torsdag")
    const rangeMatch = dayText.match(/(.+?)\s*-\s*(.+)/);
    
    if (rangeMatch) {
      const startDay = rangeMatch[1].trim();
      const endDay = rangeMatch[2].trim();
      
      const startDayEn = dayMap[startDay];
      const endDayEn = dayMap[endDay];

      if (!startDayEn || !endDayEn) {
        console.warn('Could not map day range:', dayText);
        continue;
      }

      // Expand range
      const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const startIdx = daysOfWeek.indexOf(startDayEn);
      const endIdx = daysOfWeek.indexOf(endDayEn);

      if (startIdx === -1 || endIdx === -1) {
        console.warn('Invalid day range:', dayText);
        continue;
      }

      for (let i = startIdx; i <= endIdx; i++) {
        rows.push({
          business_id,
          weekday: daysOfWeek[i],
          open_time,
          close_time,
          closed: false,
          kind: 'normal'
        });
      }
    } else {
      // Single day
      const weekday = dayMap[dayText];
      if (!weekday) {
        console.warn('Could not map day:', dayText);
        continue;
      }

      rows.push({
        business_id,
        weekday,
        open_time,
        close_time,
        closed: false,
        kind: 'normal'
      });
    }
  }

  return rows;
}
