import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('business_programme_profiles')
    .select('programme_name, decision_timing, audience_segments')
    .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
    .in('programme_name', ['AFTEN', 'FROKOST']);

  if (error) {
    return new Response(JSON.stringify({ error }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }

  const result = data.map(prog => ({
    programme: prog.programme_name,
    programme_timing: prog.decision_timing,
    raw_segments: prog.audience_segments
  }));

  return new Response(JSON.stringify(result, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
});
