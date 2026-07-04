import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const client = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a';

  // Test 1: Query with all three columns
  const { data: test1, error: error1 } = await client
    .from('business_brand_profile')
    .select('business_character, revenue_drivers, brand_profile_v5')
    .eq('business_id', businessId)
    .maybeSingle();

  // Test 2: Query ONLY revenue_drivers
  const { data: test2, error: error2 } = await client
    .from('business_brand_profile')
    .select('revenue_drivers')
    .eq('business_id', businessId)
    .maybeSingle();

  // Test 3: Query with wildcard
  const { data: test3, error: error3 } = await client
    .from('business_brand_profile')
    .select('*')
    .eq('business_id', businessId)
    .maybeSingle();

  const result = {
    test1_all_columns: {
      hasData: !!test1,
      hasError: !!error1,
      errorMessage: error1?.message,
      keys: test1 ? Object.keys(test1) : [],
      revenue_drivers_exists: test1 && 'revenue_drivers' in test1,
      revenue_drivers_type: test1?.revenue_drivers ? typeof test1.revenue_drivers : 'undefined',
      revenue_drivers_is_null: test1?.revenue_drivers === null,
      revenue_drivers_preview: test1?.revenue_drivers ? JSON.stringify(test1.revenue_drivers).substring(0, 100) : 'N/A',
    },
    test2_only_revenue_drivers: {
      hasData: !!test2,
      hasError: !!error2,
      errorMessage: error2?.message,
      keys: test2 ? Object.keys(test2) : [],
      revenue_drivers_exists: test2 && 'revenue_drivers' in test2,
      revenue_drivers_type: test2?.revenue_drivers ? typeof test2.revenue_drivers : 'undefined',
      revenue_drivers_preview: test2?.revenue_drivers ? JSON.stringify(test2.revenue_drivers).substring(0, 100) : 'N/A',
    },
    test3_wildcard: {
      hasData: !!test3,
      hasError: !!error3,
      errorMessage: error3?.message,
      keys: test3 ? Object.keys(test3) : [],
      revenue_drivers_exists: test3 && 'revenue_drivers' in test3,
      revenue_drivers_type: test3?.revenue_drivers ? typeof test3.revenue_drivers : 'undefined',
    }
  };

  return new Response(JSON.stringify(result, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
});
