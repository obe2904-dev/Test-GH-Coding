/**
 * Menu Metadata Analyzer Edge Function
 * Language-aware AI analysis of menu items
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { MenuAnalyzer } from './services/menu-analyzer.ts';
import { DatabaseSaver } from './services/database-saver.ts';
import { detectEffectiveVertical } from '../_shared/business-type-helpers.ts';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request
    const { business_id } = await req.json();

    if (!business_id) {
      return new Response(
        JSON.stringify({ error: 'business_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Initialize services
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const analyzer = new MenuAnalyzer(openaiApiKey);
    const saver = new DatabaseSaver(supabaseUrl, supabaseServiceKey);

    // Step 1: Fetch business context
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('name, vertical')
      .eq('id', business_id)
      .single();

    if (businessError) throw businessError;

    const { data: brandProfile } = await supabase
      .from('business_brand_profile')
      .select('business_character, business_identity_persona, identity_keywords, brand_profile_v5')
      .eq('business_id', business_id)
      .maybeSingle();

    const businessIdentityPersona =
      brandProfile?.brand_profile_v5?.layer_0_intelligence?.business_identity?.system_persona ||
      brandProfile?.business_identity_persona ||
      brandProfile?.business_character ||
      '';
    const identityKeywords = Array.isArray(brandProfile?.identity_keywords)
      ? brandProfile.identity_keywords
      : [];
    const effectiveBusinessType = detectEffectiveVertical(
      business.vertical || 'restaurant',
      businessIdentityPersona,
      identityKeywords,
    );

    // Step 2: Fetch menu items
    const { data: menuItems, error: menuError } = await supabase
      .from('menu_items')
      .select('name, description, price, category, is_signature')
      .eq('business_id', business_id);

    if (menuError) throw menuError;

    if (!menuItems || menuItems.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No menu items found. Please add menu items first.',
          success: false 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Get business location for context
    const { data: location } = await supabase
      .from('business_locations')
      .select('city')
      .eq('business_id', business_id)
      .single();

    const businessContext = {
      business_name: business.name,
      business_type: effectiveBusinessType,
      city: location?.city || 'Unknown',
    };

    // Step 4: Analyze menu with AI
    const metadata = await analyzer.analyzeMenu(menuItems, businessContext);

    // Step 5: Save to database
    await saver.saveMetadata(business_id, metadata);

    // Success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        metadata,
        items_analyzed: menuItems.length,
        detected_language: metadata.menu_language
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Menu analysis error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to analyze menu',
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
