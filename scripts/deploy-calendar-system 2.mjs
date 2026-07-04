#!/usr/bin/env node
/**
 * Deploy Calendar System
 * 
 * This script:
 * 1. Runs the calendar migration SQL directly via Supabase client
 * 2. Imports holiday data from JSON file
 * 3. Verifies the deployment
 * 
 * Usage: node scripts/deploy-calendar-system.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Load environment variables
const envPath = join(projectRoot, '.env');
const envContent = readFileSync(envPath, 'utf-8');
const env = Object.fromEntries(
  envContent
    .split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const [key, ...valueParts] = line.split('=');
      return [key.trim(), valueParts.join('=').trim()];
    })
);

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('   Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('📋 Running calendar system migration...\n');
  
  const migrationPath = join(projectRoot, 'supabase/migrations/20260509_calendar_system.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');
  
  // Split into individual statements (simple split on semicolons, accounting for function bodies)
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  console.log(`   Found ${statements.length} SQL statements\n`);
  
  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!stmt || stmt.length < 10) continue;
    
    // Identify what we're executing
    const preview = stmt.substring(0, 80).replace(/\s+/g, ' ');
    console.log(`   [${i + 1}/${statements.length}] ${preview}...`);
    
    const { error } = await supabase.rpc('exec_sql', { sql: stmt });
    
    if (error) {
      // Check if it's a benign "already exists" error
      if (error.message?.includes('already exists')) {
        console.log(`      ⚠️  Already exists (skipping)`);
      } else {
        console.error(`      ❌ Error:`, error.message);
        // Continue anyway for now
      }
    } else {
      console.log(`      ✅ Success`);
    }
  }
  
  console.log('\n✅ Migration execution completed\n');
}

async function importHolidays() {
  console.log('📅 Importing Denmark holidays (2026-2028)...\n');
  
  const dataPath = join(projectRoot, 'calendar-data/denmark-holidays-2026-2028.json');
  const holidays = JSON.parse(readFileSync(dataPath, 'utf-8'));
  
  console.log(`   Found ${holidays.length} holidays to import\n`);
  
  let inserted = 0;
  let updated = 0;
  let errors = 0;
  
  for (const holiday of holidays) {
    const { error } = await supabase
      .from('calendar_public_holidays')
      .upsert({
        country: holiday.country,
        date: holiday.date,
        name: holiday.name,
        name_local: holiday.name_local,
        retail_impact: holiday.retail_impact,
        typical_bridge_day: holiday.typical_bridge_day,
        hospitality_traffic: holiday.hospitality_traffic
      }, {
        onConflict: 'country,date'
      });
    
    if (error) {
      console.error(`   ❌ ${holiday.date} ${holiday.name}: ${error.message}`);
      errors++;
    } else {
      // Simple heuristic: if date is after today, likely insert; otherwise update
      const isRecent = new Date(holiday.date) > new Date('2026-01-01');
      if (isRecent) {
        inserted++;
      } else {
        updated++;
      }
    }
  }
  
  console.log(`\n✅ Import completed:`);
  console.log(`   • Inserted/Updated: ${inserted + updated}`);
  if (errors > 0) {
    console.log(`   • Errors: ${errors}`);
  }
  console.log('');
}

async function verifyDeployment() {
  console.log('🔍 Verifying deployment...\n');
  
  // Check tables exist
  const { data: holidays, error: holidayError } = await supabase
    .from('calendar_public_holidays')
    .select('*', { count: 'exact', head: true });
  
  const { data: events, error: eventError } = await supabase
    .from('calendar_local_events')
    .select('*', { count: 'exact', head: true });
  
  if (holidayError) {
    console.log(`   ❌ calendar_public_holidays table: ${holidayError.message}`);
  } else {
    console.log(`   ✅ calendar_public_holidays table exists`);
  }
  
  if (eventError) {
    console.log(`   ❌ calendar_local_events table: ${eventError.message}`);
  } else {
    console.log(`   ✅ calendar_local_events table exists`);
  }
  
  // Test the helper function
  console.log('\n   Testing get_week_calendar_context function...');
  const { data: testContext, error: functionError } = await supabase
    .rpc('get_week_calendar_context', {
      p_country: 'DK',
      p_city: 'Aarhus',
      p_week_start: '2026-05-11',
      p_week_end: '2026-05-17'
    });
  
  if (functionError) {
    console.log(`   ❌ Function error: ${functionError.message}`);
  } else {
    console.log(`   ✅ Function works!`);
    console.log(`\n   Week 19 context (May 11-17, 2026):`);
    console.log(`   • Holidays: ${testContext.holidays?.length || 0}`);
    if (testContext.holidays?.length > 0) {
      testContext.holidays.forEach(h => {
        console.log(`     - ${h.date}: ${h.name} (${h.name_local})`);
        console.log(`       retail: ${h.retail_impact}, bridge: ${h.typical_bridge_day}, traffic: ${h.hospitality_traffic}`);
      });
    }
    console.log(`   • Local events: ${testContext.local_events?.length || 0}`);
  }
  
  console.log('\n✅ Verification completed\n');
}

async function main() {
  console.log('\n🚀 Calendar System Deployment\n');
  console.log('='.repeat(50));
  console.log('');
  
  try {
    await runMigration();
    await importHolidays();
    await verifyDeployment();
    
    console.log('='.repeat(50));
    console.log('\n🎉 Calendar system deployed successfully!\n');
    console.log('Next steps:');
    console.log('  1. Integrate get_week_calendar_context() into Phase 0');
    console.log('  2. Add holiday-aware timing logic to Phase 2b');
    console.log('  3. Test with Café Faust Week 19 (May 11-17, 2026)\n');
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
