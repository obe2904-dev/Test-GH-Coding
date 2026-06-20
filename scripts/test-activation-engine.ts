/**
 * Test activation engine with Week 20 (Kr. Himmelfartsdag)
 */

const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CAFE_FAUST_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';
const WEEK_20_START = '2026-05-11'; // Monday May 11, 2026

console.log('Testing Activation Engine with Week 20 (Kr. Himmelfartsdag)');
console.log('═══════════════════════════════════════════════════════════════');
console.log('Business: Café Faust (hybrid café/restaurant/bar)');
console.log('Week: 20 (May 11-17, 2026)');
console.log('Holiday: Kr. Himmelfartsdag Thursday May 14 (typical_bridge_day)');
console.log();

const response = await fetch(
  `${SUPABASE_URL}/functions/v1/get-weekly-strategy`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      business_id: CAFE_FAUST_ID,
      week_start: WEEK_20_START,
      regenerate: true, // Force fresh generation
    }),
  }
);

const data = await response.json();

console.log('Response Status:', response.status);
console.log();

if (data.success) {
  console.log('✅ Request submitted successfully');
  console.log('Strategy ID:', data.strategy_id);
  console.log('Status:', data.status);
  
  if (data.status === 'pending') {
    console.log();
    console.log('Generation is running in background...');
    console.log('Polling for completion...');
    
    // Poll for completion
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
      attempts++;
      
      const { data: strategy, error } = await supabase
        .from('weekly_strategies')
        .select('status, strategic_brief, post_ideas')
        .eq('id', data.strategy_id)
        .single();
      
      if (error) {
        console.error('Error checking status:', error);
        break;
      }
      
      console.log(`Attempt ${attempts}/${maxAttempts}: Status = ${strategy.status}`);
      
      if (strategy.status === 'generated') {
        console.log();
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('✅ GENERATION COMPLETE');
        console.log('═══════════════════════════════════════════════════════════════');
        
        if (strategy.strategic_brief) {
          const brief = strategy.strategic_brief as any;
          console.log();
          console.log('STRATEGIC BRIEF:');
          console.log('Week Summary:', brief.week_summary?.substring(0, 200) + '...');
          console.log();
          console.log('Angles Generated:', brief.angles?.length || 0);
          console.log();
          
          if (brief.angles) {
            brief.angles.forEach((angle: any, idx: number) => {
              console.log(`${idx + 1}. ${angle.focus}`);
              console.log(`   Timing: ${angle.timing_window}`);
              console.log(`   Goal: ${angle.goal_mode}`);
              console.log(`   Reasoning: ${angle.reasoning?.substring(0, 150)}...`);
              console.log();
            });
          }
        }
        
        if (strategy.post_ideas) {
          const posts = strategy.post_ideas as any[];
          console.log('═══════════════════════════════════════════════════════════════');
          console.log('POST IDEAS:');
          console.log('═══════════════════════════════════════════════════════════════');
          console.log();
          
          posts.forEach((post: any) => {
            const date = new Date(post.suggested_day);
            const dayName = date.toLocaleDateString('da-DK', { weekday: 'long' });
            console.log(`📅 ${dayName} ${post.suggested_time}`);
            console.log(`   Title: ${post.title}`);
            console.log(`   Focus: ${post.focus || post.rationale?.substring(0, 100)}`);
            console.log();
          });
        }
        
        break;
      } else if (strategy.status === 'error') {
        console.error('❌ Generation failed');
        break;
      }
    }
    
    if (attempts >= maxAttempts) {
      console.log('⏱️ Timeout reached - check dashboard for final status');
    }
  }
} else {
  console.error('❌ Request failed:', data.error);
}
