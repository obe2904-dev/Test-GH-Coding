/**
 * POLL STRATEGY RESULTS
 * 
 * Polls database for strategy completion and displays results.
 * Usage: deno run --allow-net --allow-env scripts/poll-strategy.ts <strategy_id>
 */

const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('VITE_SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables');
  Deno.exit(1);
}

const strategyId = Deno.args[0] || '9149cfbc-53e0-4243-88e3-a78239396662'; // Default to Week 22

console.log(`🔍 Polling for strategy: ${strategyId}`);
console.log('═══════════════════════════════════════════════════════════════\n');

let attempts = 0;
const MAX_ATTEMPTS = 60;

while (attempts < MAX_ATTEMPTS) {
  await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
  attempts++;
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/weekly_strategies?id=eq.${strategyId}&select=*`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    console.error(`❌ Query failed: ${response.status}`);
    console.error(await response.text());
    Deno.exit(1);
  }
  
  const strategies = await response.json();
  const strategy = strategies[0];
  
  if (!strategy) {
    console.error(`❌ Strategy not found: ${strategyId}`);
    Deno.exit(1);
  }
  
  if (attempts % 3 === 0) {
    console.log(`⏳ Attempt ${attempts}/${MAX_ATTEMPTS}: Status = ${strategy.status}`);
  }
  
  if (strategy.status === 'generated') {
    console.log(`\n✅ GENERATION COMPLETE (${attempts * 5}s)\n`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('STRATEGIC BRIEF:');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    const brief = strategy.strategic_brief;
    console.log(`Week Summary: ${brief.week_summary?.substring(0, 200)}...\n`);
    console.log(`Angles Generated: ${brief.angles?.length || 0}\n`);
    
    if (brief.angles) {
      brief.angles.forEach((angle: any, i: number) => {
        console.log(`${i + 1}. ${angle.focus}`);
        console.log(`   Timing: ${angle.timing_window || 'any'}`);
        console.log(`   Goal: ${angle.goal_mode || 'N/A'}`);
        console.log(`   Reasoning: ${angle.reasoning?.substring(0, 150)}...\n`);
      });
    }
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('POST IDEAS:');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    const postIdeas = strategy.post_ideas || [];
    postIdeas.forEach((post: any) => {
      const date = new Date(post.suggested_day + 'T12:00:00');
      const dayName = date.toLocaleDateString('da-DK', { weekday: 'long' });
      console.log(`📅 ${dayName} ${post.suggested_time}`);
      console.log(`   Title: ${post.title}`);
      console.log(`   Focus: ${post.angle_focus?.substring(0, 80)}...\n`);
    });
    
    console.log('═══════════════════════════════════════════════════════════════');
    
    Deno.exit(0);
  } else if (strategy.status === 'error') {
    console.error(`\n❌ GENERATION FAILED`);
    console.error(`Error: ${strategy.error_message}`);
    Deno.exit(1);
  }
}

console.error(`\n❌ Timeout after ${MAX_ATTEMPTS * 5}s`);
Deno.exit(1);
