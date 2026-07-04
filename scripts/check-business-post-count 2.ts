import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('VITE_SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const { data: strategy } = await supabase
  .from('weekly_strategies')
  .select('subscription_tier, target_post_count')
  .eq('business_id', '2037d63c-a138-4247-89c5-5b6b8cef9f3f')
  .eq('week_number', 20)
  .single();

console.log('Strategy subscription tier:', strategy?.subscription_tier);
console.log('Strategy target_post_count:', strategy?.target_post_count);

// Map subscription tiers to post counts
const tierPostCounts: Record<string, number> = {
  'free': 2,
  'smart': 4,
  'premium': 5,
  'professional': 7
};

const expectedForTier = tierPostCounts[strategy?.subscription_tier || 'smart'];
console.log('\nExpected posts for', strategy?.subscription_tier, 'tier:', expectedForTier);

if (strategy?.target_post_count !== expectedForTier) {
  console.log('⚠️ MISMATCH: target_post_count should be', expectedForTier, 'but is', strategy?.target_post_count);
}
