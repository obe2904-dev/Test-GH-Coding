import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const dataClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a'

    // Test the exact query that get-weekly-strategy uses
    const { data: brandProfile, error: brandProfileError } = await dataClient
      .from('business_brand_profile')
      .select(`
        brand_profile_v5,
        brand_essence,
        business_character,
        target_type_mix,
        revenue_drivers
      `)
      .eq('business_id', businessId)
      .maybeSingle()

    return new Response(JSON.stringify({
      success: !brandProfileError,
      hasError: !!brandProfileError,
      error: brandProfileError,
      hasData: !!brandProfile,
      dataKeys: brandProfile ? Object.keys(brandProfile) : [],
      brandProfile: brandProfile,
      has_revenue_drivers: !!brandProfile?.revenue_drivers,
      revenue_drivers_type: typeof brandProfile?.revenue_drivers,
      revenue_drivers: brandProfile?.revenue_drivers
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
