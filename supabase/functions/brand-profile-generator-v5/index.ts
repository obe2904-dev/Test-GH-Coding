/**
 * Brand Profile Generator V5
 * Main handler - orchestrates the generation process
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { gatherBusinessKnowledge } from './services/data-gatherer.ts';
import { buildBrandProfilePrompt } from './services/prompt-builder.ts';
import { generateBrandProfile } from './services/ai-generator.ts';
import { validateBrandProfile } from './services/validator.ts';
import { saveBrandProfile } from './services/saver.ts';
import { handleError } from './utils/error-handler.ts';
import type { BrandProfileGenerationRequest } from './types.ts';

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request
    const { business_id } = await req.json() as BrandProfileGenerationRequest;

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

    // Create Supabase client (using service role to bypass RLS for this operation)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[1/5] Gathering business knowledge for ${business_id}...`);
    const knowledge = await gatherBusinessKnowledge(business_id, supabase);

    console.log(`[2/5] Building AI prompt...`);
    const prompt = buildBrandProfilePrompt(knowledge);

    console.log(`[3/5] Generating brand profile with GPT-4o...`);
    const brandProfile = await generateBrandProfile(prompt, openaiApiKey);

    console.log(`[4/5] Validating brand profile...`);
    validateBrandProfile(brandProfile);

    console.log(`[5/5] Saving to database...`);
    await saveBrandProfile(business_id, brandProfile, supabase);

    console.log('✅ Brand profile generation complete!');

    return new Response(
      JSON.stringify({
        success: true,
        brand_profile: brandProfile,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return handleError(error, 'main');
  }
});
