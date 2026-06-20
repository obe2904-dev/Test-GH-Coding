const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 Fixing seasonal_notes contradiction\n');

const response = await fetch(`${SUPABASE_URL}/rest/v1/business_brand_profile?select=business_id,brand_profile_v5`, {
  headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` }
});

const profiles = await response.json();
console.log(`Found ${profiles.length} profiles\n`);

for (const profile of profiles) {
  const guardrails = profile.brand_profile_v5?.guardrails;
  if (!guardrails?.seasonal_notes) continue;
  
  const original = guardrails.seasonal_notes;
  const fixed = original.map(note => 
    note === "Fremhæv hygge indendørs i vinterperioden" 
      ? "Fremhæv indendørs atmosfære i vinterperioden"
      : note
  );
  
  if (JSON.stringify(original) !== JSON.stringify(fixed)) {
    const updated = {
      ...profile.brand_profile_v5,
      guardrails: { ...guardrails, seasonal_notes: fixed }
    };
    
    await fetch(`${SUPABASE_URL}/rest/v1/business_brand_profile?business_id=eq.${profile.business_id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ brand_profile_v5: updated })
    });
    
    console.log(`✅ Fixed ${profile.business_id}`);
    console.log(`   Before: "${original[1]}"`);
    console.log(`   After:  "${fixed[1]}"\n`);
  }
}

console.log('✅ Done');
