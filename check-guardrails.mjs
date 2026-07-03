/**
 * Check current brand profile guardrails structure
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const { data, error } = await supabase
  .from('business_brand_profile')
  .select('brand_profile_v5')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .single();

if (error) {
  console.error('Error:', error);
  process.exit(1);
}

console.log('Current guardrails structure:\n');
console.log(JSON.stringify(data.brand_profile_v5?.guardrails, null, 2));
