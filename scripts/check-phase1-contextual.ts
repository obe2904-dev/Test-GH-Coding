import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUSINESS_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';

const { data: strategies, error } = await supabase
  .from('weekly_strategies')
  .select('strategic_brief_raw')
  .eq('business_id', BUSINESS_ID)
  .gte('week_start', '2026-05-11')
  .lte('week_start', '2026-05-11')
  .limit(1);

if (error || !strategies || strategies.length === 0) {
  console.log('Error or no data');
  Deno.exit(1);
}

const brief = JSON.parse(strategies[0].strategic_brief_raw);
if (brief.contextual_analysis) {
  console.log('✅ contextual_analysis FOUND in Phase 1 output!');
  console.log(JSON.stringify(brief.contextual_analysis, null, 2));
} else {
  console.log('❌ contextual_analysis MISSING from Phase 1 output');
  console.log('Fields present:', Object.keys(brief));
}
