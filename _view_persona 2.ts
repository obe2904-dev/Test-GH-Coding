import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  'https://kvqdkohdpvmdylqgujpn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ3VqcG4iLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcyMTA0OTA0MywiZXhwIjoyMDM2NjI1MDQzfQ.X7cqhIqVykPLkCK2VW9T-9PdQpkN9wY9ycQoUrvfZnI'
);

const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a';

const { data, error } = await supabase
  .from('business_brand_profile')
  .select('business_id, brand_profile_v5')
  .eq('business_id', businessId)
  .single();

if (error) {
  console.error('Error:', error);
} else {
  const persona = data.brand_profile_v5?.layer_0_intelligence?.business_identity;
  console.log('\n=== PURE FACTS PERSONA ===\n');
  console.log(persona.system_persona);
  console.log('\n=== METADATA ===');
  console.log('Word count:', persona.metadata.word_count);
  console.log('Om Os length:', persona.metadata.om_os_length);
  console.log('Menu summaries:', persona.metadata.menu_summaries_count);
  console.log('Extracted facts:', persona.metadata.extracted_facts_count);
  console.log('\n');
}
