import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUSINESS_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'; // Café Faust
const WEEK_NUMBER = 19;
const YEAR = 2026;

console.log(`🔄 Regenerating Week ${WEEK_NUMBER} ${YEAR} for Café Faust...\n`);

// Call edge function to regenerate (with regenerate flag)
console.log('⏳ Calling get-weekly-strategy with regenerate=true...\n');

const response = await fetch(`${supabaseUrl}/functions/v1/get-weekly-strategy`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabaseServiceKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    business_id: BUSINESS_ID,
    week_number: WEEK_NUMBER,
    year: YEAR,
    regenerate: true,
  }),
});

const result = await response.json();

if (!response.ok) {
  console.error('❌ Error generating strategy:', result);
  Deno.exit(1);
}

console.log('✅ Strategy regenerated!\n');
console.log('📊 Post Ideas Count:', result.post_ideas?.length || 0);
console.log('\n📅 Post Schedule:');
for (const idea of result.post_ideas || []) {
  const date = new Date(idea.target_post_date);
  const dayName = date.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'short' });
  console.log(`  • ${dayName}: ${idea.title} (${idea.content_category}, ${idea.goal_mode})`);
}

console.log('\n🎯 Strategic Brief Slots:');
if (result.strategic_brief?.angles) {
  for (const angle of result.strategic_brief.angles) {
    console.log(`  • Slot ${angle.slot_id}: ${angle.timing_window || 'N/A'} - ${angle.focus}`);
  }
}
