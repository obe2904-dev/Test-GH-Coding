/**
 * Test Historical Analysis Integration
 * 
 * Validates 3-week historical content analysis in Weekly Strategy
 */

import fs from 'node:fs';
import path from 'node:path';

function parseDotEnv(contents) {
  const out = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
    const eq = normalized.indexOf('=');
    if (eq === -1) continue;
    const key = normalized.slice(0, eq).trim();
    let value = normalized.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

function loadEnvFromFiles() {
  const cwd = process.cwd();
  for (const filename of ['.env.local', '.env']) {
    const fullPath = path.join(cwd, filename);
    if (!fs.existsSync(fullPath)) continue;
    try {
      const parsed = parseDotEnv(fs.readFileSync(fullPath, 'utf8'));
      for (const [k, v] of Object.entries(parsed)) {
        if (!process.env[k]) process.env[k] = v;
      }
    } catch (err) {
      console.error(`Failed to load ${filename}:`, err);
    }
  }
}

loadEnvFromFiles();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUSINESS_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'; // Café Faust

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing environment variables');
  process.exit(1);
}

async function testHistoricalAnalysis() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         TESTING HISTORICAL ANALYSIS INTEGRATION             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  console.log('Business: Café Faust');
  console.log('Week: 22 (May 26, 2026)\n');
  
  // Call get-weekly-strategy with regenerate flag
  const url = `${SUPABASE_URL}/functions/v1/get-weekly-strategy`;
  
  console.log('Calling get-weekly-strategy...\n');
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      business_id: BUSINESS_ID,
      week_start: '2026-05-26', // Week 22
      regenerate: true, // Force fresh generation
    }),
  });
  
  if (!response.ok) {
    console.error('❌ API Error:', response.status, response.statusText);
    const text = await response.text();
    console.error(text);
    process.exit(1);
  }
  
  const data = await response.json();
  
  if (!data.success) {
    console.error('❌ Generation failed:', data.error);
    process.exit(1);
  }
  
  console.log('✅ Strategy generation started\n');
  console.log(`Strategy ID: ${data.strategy_id}`);
  console.log(`Status: ${data.status}\n`);
  
  // Poll for completion if status is pending
  if (data.status === 'pending') {
    console.log('Waiting for generation to complete...');
    let attempts = 0;
    let strategyData = null;
    
    while (attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      // Fetch strategy from database
      const strategyUrl = `${SUPABASE_URL}/rest/v1/weekly_strategies?id=eq.${data.strategy_id}&select=*`;
      const strategyResponse = await fetch(strategyUrl, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY,
        },
      });
      
      const strategies = await strategyResponse.json();
      if (strategies && strategies.length > 0) {
        strategyData = strategies[0];
        if (strategyData.status === 'generated' || strategyData.status === 'completed') {
          console.log(`✅ Generation complete after ${(attempts + 1) * 2} seconds\n`);
          break;
        }
      }
      
      attempts++;
      process.stdout.write('.');
    }
    
    if (!strategyData || (strategyData.status !== 'generated' && strategyData.status !== 'completed')) {
      console.error('\n❌ Timeout waiting for generation');
      process.exit(1);
    }
    
    // Use the fetched strategy data
    data.week_context_snapshot = strategyData.week_context_snapshot;
    data.post_ideas = strategyData.post_ideas;
    data.narrative = strategyData.narrative;
  }
  
  // Debug: show what we got
  console.log('DEBUG: Has week_context_snapshot?', !!data.week_context_snapshot);
  if (data.week_context_snapshot) {
    console.log('DEBUG: week_context_snapshot keys:', Object.keys(data.week_context_snapshot).slice(0, 20));
    console.log('DEBUG: Has historical_context?', !!data.week_context_snapshot.historical_context);
  }
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('HISTORICAL ANALYSIS RESULTS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Check if historical context was included in week_context_snapshot
  if (data.week_context_snapshot?.historical_context) {
    const hist = data.week_context_snapshot.historical_context;
    
    console.log('📊 Analysis Summary:');
    console.log(`   Weeks analyzed: ${hist.weeks_analyzed}`);
    console.log(`   Total posts: ${hist.total_posts_analyzed}`);
    console.log(`   Programmes tracked: ${Object.keys(hist.programme_patterns || {}).length}\n`);
    
    if (hist.programme_patterns && Object.keys(hist.programme_patterns).length > 0) {
      console.log('📈 Programme Patterns:');
      for (const [progName, pattern] of Object.entries(hist.programme_patterns)) {
        console.log(`\n   ${progName}:`);
        console.log(`   - Total posts: ${pattern.total_posts}`);
        
        if (pattern.content_categories && Object.keys(pattern.content_categories).length > 0) {
          console.log('   - Content categories:');
          for (const [cat, count] of Object.entries(pattern.content_categories)) {
            console.log(`     • ${cat}: ${count}x`);
          }
        }
        
        if (pattern.goal_modes && Object.keys(pattern.goal_modes).length > 0) {
          console.log('   - Goal modes:');
          for (const [mode, count] of Object.entries(pattern.goal_modes)) {
            console.log(`     • ${mode}: ${count}x`);
          }
        }
        
        if (pattern.menu_items && pattern.menu_items.length > 0) {
          console.log(`   - Menu items (${pattern.menu_items.length}):`, pattern.menu_items.slice(0, 5).join(', '));
        }
      }
    }
    
    if (hist.overuse_warnings && hist.overuse_warnings.length > 0) {
      console.log('\n\n⚠️  Overuse Warnings:');
      hist.overuse_warnings.forEach(warning => console.log(`   - ${warning}`));
    }
    
    if (hist.underuse_opportunities && hist.underuse_opportunities.length > 0) {
      console.log('\n\n💡 Underuse Opportunities:');
      hist.underuse_opportunities.forEach(opp => console.log(`   - ${opp}`));
    }
    
    if (hist.recent_dishes && hist.recent_dishes.length > 0) {
      console.log(`\n\n🍽️  Recent Dishes (${hist.recent_dishes.length}):`, hist.recent_dishes.join(', '));
    }
    
    console.log('\n\n═══════════════════════════════════════════════════════════════');
    console.log('VALIDATION');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    // Validate structure
    const checks = [
      { name: 'Weeks analyzed ≥ 1', pass: hist.weeks_analyzed >= 1 },
      { name: 'Programme patterns exist', pass: hist.programme_patterns && Object.keys(hist.programme_patterns).length > 0 },
      { name: 'Array fields are arrays', pass: Array.isArray(hist.overuse_warnings) && Array.isArray(hist.underuse_opportunities) },
    ];
    
    checks.forEach(check => {
      console.log(`${check.pass ? '✅' : '❌'} ${check.name}`);
    });
    
    const allPassed = checks.every(c => c.pass);
    
    console.log('\n' + '═'.repeat(63));
    console.log(allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED');
    console.log('═'.repeat(63) + '\n');
    
  } else {
    console.log('⚠️  No historical context found in week_context_snapshot\n');
    console.log('This could mean:');
    console.log('1. Business has no previous weekly strategies');
    console.log('2. Historical analysis returned empty results');
    console.log('3. Integration did not store historical_context\n');
  }
  
  // Show generated post ideas to verify anti-repetition
  if (data.post_ideas && data.post_ideas.length > 0) {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('GENERATED POST IDEAS');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    data.post_ideas.forEach((idea, idx) => {
      console.log(`${idx + 1}. ${idea.title || '(no title)'}`);
      console.log(`   Programme: ${idea.programme || 'N/A'}`);
      console.log(`   Category: ${idea.content_category}`);
      console.log(`   Goal: ${idea.goal_mode}`);
      console.log(`   Menu item: ${idea.menu_item_used || 'N/A'}\n`);
    });
  }
  
  console.log('\n✨ Test complete!\n');
}

testHistoricalAnalysis().catch(console.error);
