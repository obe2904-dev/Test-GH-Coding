import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlscWd1anBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk0NDA5MzYsImV4cCI6MjA1NTAxNjkzNn0.RhObOuNwOBK3r1GVbZOj4Cza_UiBPFcIEBW1ghtlhyk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPhaseC() {
  const { data, error } = await supabase
    .from('weekly_strategies')
    .select('*')
    .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
    .eq('week_start', '2026-06-08')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('❌ Error fetching strategy:', error.message);
    return;
  }

  if (!data) {
    console.log('❌ No strategy found');
    return;
  }

  console.log('\n📊 STRATEGY STATUS:', data.status);
  console.log('📅 Generated at:', data.created_at);
  console.log('\n🎯 POST IDEAS:');
  
  if (data.post_ideas && Array.isArray(data.post_ideas)) {
    data.post_ideas.forEach((post, i) => {
      const contentType = post.content_type || 'NO TYPE';
      const contentCategory = post.content_category || 'NO CATEGORY';
      const typeRationale = post.type_rationale || '';
      const goalMode = post.goal_mode || '';
      
      console.log(`\nPost ${i + 1}:`);
      console.log(`  Content Type: ${contentType}`);
      console.log(`  Content Category: ${contentCategory}`);
      console.log(`  Goal Mode: ${goalMode}`);
      if (typeRationale) {
        console.log(`  Type Rationale: ${typeRationale}`);
      }
      console.log(`  Title: ${post.title || 'N/A'}`);
    });
    
    // Count distribution
    const typeCounts = {};
    const categoryCounts = {};
    data.post_ideas.forEach(post => {
      const type = post.content_type || 'UNKNOWN';
      const category = post.content_category || 'UNKNOWN';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });
    
    console.log('\n📈 TYPE DISTRIBUTION:');
    Object.entries(typeCounts).forEach(([type, count]) => {
      const pct = ((count / data.post_ideas.length) * 100).toFixed(1);
      console.log(`  ${type}: ${count}/${data.post_ideas.length} (${pct}%)`);
    });
    
    console.log('\n📈 CATEGORY DISTRIBUTION:');
    Object.entries(categoryCounts).forEach(([category, count]) => {
      const pct = ((count / data.post_ideas.length) * 100).toFixed(1);
      console.log(`  ${category}: ${count}/${data.post_ideas.length} (${pct}%)`);
    });
    
    // Check if Phase C was active
    const hasContentTypes = data.post_ideas.some(p => p.content_type);
    const hasTypeRationale = data.post_ideas.some(p => p.type_rationale);
    
    console.log('\n✅ PHASE C STATUS:');
    console.log(`  Content Types Assigned: ${hasContentTypes ? 'YES ✅' : 'NO ❌'}`);
    console.log(`  Type Rationale Present: ${hasTypeRationale ? 'YES ✅' : 'NO ❌'}`);
    
    if (hasContentTypes && hasTypeRationale) {
      console.log('\n🎉 PHASE C IS ACTIVE! Programme × Type grid allocation working.');
    } else {
      console.log('\n⚠️ PHASE C MAY NOT BE ACTIVE - check logs for errors.');
    }
  } else {
    console.log('  No post_ideas found in strategy');
  }
}

checkPhaseC().catch(console.error);
