import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('VITE_SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const BUSINESS_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';
const WEEK_NUMBER = 20;

console.log(`📅 Week ${WEEK_NUMBER} Post Schedule\n`);

const { data } = await supabase
  .from('weekly_strategies')
  .select('post_ideas, week_start, week_end')
  .eq('business_id', BUSINESS_ID)
  .eq('week_number', WEEK_NUMBER)
  .order('generated_at', { ascending: false })
  .limit(1)
  .single();

console.log(`Week start: ${data.week_start}`);
console.log(`Week end: ${data.week_end}\n`);

const dayNames: Record<number, string> = {
  0: 'Søndag', 1: 'Mandag', 2: 'Tirsdag', 3: 'Onsdag', 
  4: 'Torsdag', 5: 'Fredag', 6: 'Lørdag',
};

const sorted = (data.post_ideas || []).sort((a: any, b: any) => 
  a.suggested_day.localeCompare(b.suggested_day)
);

for (const post of sorted) {
  const date = new Date(post.suggested_day + 'T12:00:00');
  const dow = date.getDay();
  const dayName = dayNames[dow];
  const dateStr = date.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
  
  const isHoliday = post.suggested_day === '2026-05-14';
  
  console.log(`${isHoliday ? '🎯' : '📌'} ${dayName} ${dateStr}${isHoliday ? ' (Kr. Himmelfartsdag)' : ''}`);
  console.log(`   Title: ${post.title || 'Untitled'}`);
  console.log(`   Category: ${post.content_category || 'N/A'}`);
  console.log(`   Goal: ${post.goal_mode || 'N/A'}`);
  console.log('');
}
