/**
 * Analyze Visual Identity
 * Auto-populates visual identity from uploaded photos using GPT-4 Vision
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { PhotoAnalyzer } from './services/photo-analyzer.ts';
import { ColorExtractor } from './services/color-extractor.ts';
import { IdentityBuilder } from './services/identity-builder.ts';
import { DatabaseSaver } from './services/database-saver.ts';

interface AnalyzeVisualIdentityRequest {
  business_id: string;
  photo_paths: string[]; // Paths in storage bucket
  locale?: string; // e.g. 'da', 'en', 'nb', 'sv'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { business_id, photo_paths, locale = 'da' } = await req.json() as AnalyzeVisualIdentityRequest;

    if (!business_id || !photo_paths || photo_paths.length === 0) {
      return new Response(
        JSON.stringify({ error: 'business_id and photo_paths are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[1/5] Getting signed URLs for ${photo_paths.length} photos...`);
    // Get signed URLs for photos (valid for 1 hour)
    const photoUrls: string[] = [];
    for (const path of photo_paths) {
      const { data: { signedUrl }, error } = await supabase.storage
        .from('visual-identity')
        .createSignedUrl(path, 3600); // 1 hour

      if (error || !signedUrl) {
        console.warn(`Failed to get signed URL for ${path}:`, error);
        continue;
      }
      photoUrls.push(signedUrl);
    }

    if (photoUrls.length === 0) {
      throw new Error('No valid photo URLs could be generated');
    }

    console.log(`[2/5] Analyzing ${photoUrls.length} photos with GPT-4 Vision...`);
    const analyzer = new PhotoAnalyzer(openaiApiKey);
    const analysis = await analyzer.analyzePhotos(photoUrls, locale);

    console.log(`[3/5] Extracting color palette...`);
    const colorExtractor = new ColorExtractor();
    const colors = colorExtractor.parseColors(analysis.dominant_colors);

    console.log(`[4/5] Building visual identity object...`);
    const builder = new IdentityBuilder();
    const visualIdentity = builder.build(analysis, colors);

    console.log(`[5/5] Saving to database...`);

    // Always save recognizable_interior_identity to business_brand_profile —
    // this is what the caption pipeline reads. Do this first so the response
    // is still useful even if the secondary save fails.
    const interiorText = visualIdentity.recognizable_interior_identity;
    const venueCharacter = visualIdentity.venue_character;
    const venueScene = visualIdentity.venue_scene;
    const venueEnergy = (visualIdentity as any).venue_energy;
    const guestSituationType = (visualIdentity as any).guest_situation_type;
    if (interiorText && interiorText !== 'Not yet analyzed') {
      const upsertData: Record<string, string> = { business_id: business_id, recognizable_interior_identity: interiorText, venue_data_source: 'photo_analysis' };
      if (venueCharacter) upsertData['visual_character'] = venueCharacter;
      if (venueScene) upsertData['venue_scene'] = venueScene;
      if (venueEnergy) upsertData['venue_energy'] = venueEnergy;
      if (guestSituationType) upsertData['guest_situation_type'] = guestSituationType;
      const { error: brandProfileError } = await supabase
        .from('business_brand_profile')
        .upsert(upsertData, { onConflict: 'business_id' });
      if (brandProfileError) {
        console.warn('Could not save to business_brand_profile:', brandProfileError.message);
      }
    }

    // Also attempt to save full visual identity to business_visual_identity.
    // Wrapped in try-catch so a missing table does not break the response.
    try {
      const saver = new DatabaseSaver(supabase);
      await saver.saveVisualIdentity(business_id, visualIdentity);
    } catch (saveError) {
      console.warn('Could not save to business_visual_identity (table may not exist yet):', saveError);
    }

    console.log('✅ Visual identity analysis complete!');

    return new Response(
      JSON.stringify({
        success: true,
        visual_identity: visualIdentity,
        analysis_summary: {
          photos_analyzed: photoUrls.length,
          colors_extracted: colors.length,
          elements_identified: analysis.recognizable_elements.length,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error analyzing visual identity:', error);
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
