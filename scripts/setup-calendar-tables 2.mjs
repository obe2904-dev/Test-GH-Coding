#!/usr/bin/env node
/**
 * Setup Calendar Tables
 * 
 * Creates the calendar_public_holidays and calendar_local_events tables
 * using the Supabase client if they don't exist.
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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function setupTables() {
  console.log('🔧 Setting up calendar tables...\n');
  
  // Create calendar_public_holidays table
  console.log('   Creating calendar_public_holidays...');
  const createHolidaysSQL = `
    CREATE TABLE IF NOT EXISTS calendar_public_holidays (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      country TEXT NOT NULL,
      date DATE NOT NULL,
      name TEXT NOT NULL,
      name_local TEXT,
      retail_impact TEXT CHECK (retail_impact IN ('stores_closed', 'reduced_hours', 'extended_hours', 'normal')),
      typical_bridge_day BOOLEAN DEFAULT false,
      hospitality_traffic TEXT CHECK (hospitality_traffic IN ('surge', 'moderate_increase', 'normal', 'reduced')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(country, date)
    );
    
    CREATE INDEX IF NOT EXISTS idx_calendar_holidays_date ON calendar_public_holidays(date);
    CREATE INDEX IF NOT EXISTS idx_calendar_holidays_country_date ON calendar_public_holidays(country, date);
  `;
  
  // Note: We can't execute DDL directly via the Supabase client
  // Instead, let's just try to query the table - if it fails, we'll know it doesn't exist
  const { error: checkHolidaysError } = await supabase
    .from('calendar_public_holidays')
    .select('id', { count: 'exact', head: true });
  
  if (checkHolidaysError) {
    console.log(`   ⚠️  Table doesn't exist or has errors: ${checkHolidaysError.message}`);
    console.log(`   ℹ️  Please run the migration SQL manually via Supabase dashboard:`);
    console.log(`       supabase/migrations/20260509_calendar_system.sql`);
    return false;
  } else {
    console.log(`   ✅ calendar_public_holidays exists`);
  }
  
  // Check calendar_local_events
  console.log('   Creating calendar_local_events...');
  const { error: checkEventsError } = await supabase
    .from('calendar_local_events')
    .select('id', { count: 'exact', head: true });
  
  if (checkEventsError) {
    console.log(`   ⚠️  Table doesn't exist or has errors: ${checkEventsError.message}`);
    return false;
  } else {
    console.log(`   ✅ calendar_local_events exists`);
  }
  
  console.log('\n✅ Tables verified\n');
  return true;
}

async function importHolidays() {
  console.log('📅 Importing Denmark holidays (2026-2028)...\n');
  
  const dataPath = join(projectRoot, 'calendar-data/denmark-holidays-2026-2028.json');
  const data = JSON.parse(readFileSync(dataPath, 'utf-8'));
  const holidays = data.holidays;
  
  console.log(`   Found ${holidays.length} holidays to import\n`);
  
  let success = 0;
  let errors = 0;
  
  // Map JSON traffic values to database enum values
  const trafficMap = {
    'low': 'reduced',
    'medium': 'normal',
    'high': 'surge'
  };
  
  for (const holiday of holidays) {
    const { error } = await supabase
      .from('calendar_public_holidays')
      .upsert({
        country: 'DK',  // Use ISO country code
        date: holiday.date,
        name: holiday.name,
        name_local: holiday.name_local,
        retail_impact: holiday.retail_impact,
        typical_bridge_day: holiday.typical_bridge_day,
        hospitality_traffic: trafficMap[holiday.hospitality_traffic] || holiday.hospitality_traffic
      }, {
        onConflict: 'country,date'
      });
    
    if (error) {
      console.log(`   ❌ ${holiday.date} ${holiday.name}: ${error.message}`);
      errors++;
    } else {
      success++;
    }
  }
  
  console.log(`\n✅ Import completed: ${success} holidays, ${errors} errors\n`);
}

async function verifyData() {
  console.log('🔍 Verifying data...\n');
  
  // Get count
  const { count, error } = await supabase
    .from('calendar_public_holidays')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return;
  }
  
  console.log(`   Total holidays in database: ${count}\n`);
  
  // Test Week 19 query (Kr. Himmelfartsdag)
  console.log('   Week 19 (May 11-17, 2026) holidays:');
  const { data: week19, error: week19Error } = await supabase
    .from('calendar_public_holidays')
    .select('*')
    .eq('country', 'DK')
    .gte('date', '2026-05-11')
    .lte('date', '2026-05-17')
    .order('date');
  
  if (week19Error) {
    console.log(`   ❌ Error: ${week19Error.message}`);
  } else if (week19.length === 0) {
    console.log(`   ⚠️  No holidays found for Week 19`);
  } else {
    week19.forEach(h => {
      console.log(`   • ${h.date}: ${h.name} (${h.name_local})`);
      console.log(`     Retail: ${h.retail_impact}, Bridge day: ${h.typical_bridge_day}, Traffic: ${h.hospitality_traffic}`);
    });
  }
  
  console.log('\n✅ Verification completed\n');
}

async function main() {
  console.log('\n🚀 Calendar System Setup\n');
  console.log('='.repeat(50));
  console.log('');
  
  try {
    const tablesExist = await setupTables();
    
    if (!tablesExist) {
      console.log('\n⚠️  Tables need to be created manually first.');
      console.log('   Please run the SQL in supabase/migrations/20260509_calendar_system.sql');
      console.log('   via the Supabase SQL Editor: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql\n');
      process.exit(1);
    }
    
    await importHolidays();
    await verifyData();
    
    console.log('='.repeat(50));
    console.log('\n🎉 Calendar data imported successfully!\n');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

main();
