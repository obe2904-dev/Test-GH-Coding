import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('VITE_SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const { data } = await supabase
  .from('weekly_strategies')
  .select('strategic_brief_raw')
  .eq('id', '45c96e67-1c07-464e-a8ab-0fdb0415f00e')
  .single();

const raw = data.strategic_brief_raw;

// Search for calendar-related text
const calendarIndex = raw.indexOf('HELLIGDAGE');
if (calendarIndex > -1) {
  console.log('✅ Found calendar section at position:', calendarIndex);
  console.log('\nCalendar guidance section:\n');
  console.log(raw.substring(calendarIndex, calendarIndex + 2000));
} else {
  console.log('❌ No calendar guidance found in prompt!');
  console.log('\nSearching for "Kr. Himmelfartsdag"...');
  const himIndex = raw.indexOf('Kr. Himmelfartsdag') || raw.indexOf('Himmelfartsdag');
  if (himIndex > -1) {
    console.log(`Found at position ${himIndex}:`);
    console.log(raw.substring(Math.max(0, himIndex - 200), himIndex + 500));
  }
}
