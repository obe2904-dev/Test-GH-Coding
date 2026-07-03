#!/usr/bin/env node
/**
 * Apply content-timing schema changes manually
 * Adds archetype, country_code, and other columns needed for Phase 1
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zzauefccejjkdguuyapl.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6YXVlZmNjZWpqa2RndXV5YXBsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMDYzMzg5MywiZXhwIjoyMDQ2MjA5ODkzfQ.TQUiW_RWcoezW8PQlF6RaQrNBV7g5_zrAc3ZnFIeH04';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'public' }
});

async function applyMigration() {
  console.log('[Migration] Starting content-timing support migration...\n');
  
  try {
    // Check if businesses table exists and has archetype column
    const { data: businesses, error: checkError } = await supabase
      .from('businesses')
      .select('id')
      .limit(1);
    
    if (checkError) {
      console.error('[Migration] Error checking businesses table:', checkError);
      return;
    }
    
    console.log('[Migration] ✅ businesses table exists');
    
    // For now, let's just verify the system can connect and query
    // The actual schema changes need to be run through SQL editor
    const { count, error: countError } = await supabase
      .from('businesses')
      .select('*', { count: 'exact', head: true });
    
    if (!countError) {
      console.log(`[Migration] Found ${count} businesses in database`);
    }
    
    console.log('\n[Migration] Schema changes need to be applied through Supabase SQL Editor:');
    console.log('1. Go to: https://supabase.com/dashboard/project/zzauefccejjkdguuyapl/sql');
    console.log('2. Copy the contents of: supabase/migrations/20260503_add_content_timing_support.sql');
    console.log('3. Paste and execute in the SQL editor');
    console.log('\nAlternatively, run these key statements:');
    console.log(`
-- Add archetype column to businesses
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS archetype TEXT DEFAULT 'casual_dining';

-- Add country code
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'DK';

-- Add programme archetype
ALTER TABLE programmes 
ADD COLUMN IF NOT EXISTS programme_archetype TEXT;

-- Add temporal relevance
ALTER TABLE programmes 
ADD COLUMN IF NOT EXISTS temporal_relevance JSONB DEFAULT '{}'::jsonb;

-- Add validation tracking to posts
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS validation_result JSONB;

ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS inferred_content_type TEXT;
    `);
    
    console.log('\n[Migration] For testing, setting Cafe Faust archetype...');
    
    // Try to update Cafe Faust if it exists
    const { data: cafeFaust } = await supabase
      .from('businesses')
      .select('id, name')
      .ilike('name', '%faust%')
      .limit(1)
      .single();
    
    if (cafeFaust) {
      console.log('[Migration] Found Cafe Faust:', cafeFaust.name);
      console.log('[Migration] Note: Archetype update requires schema changes first');
    } else {
      console.log('[Migration] Cafe Faust not found in database');
    }
    
  } catch (error) {
    console.error('[Migration] Error:', error);
  }
}

applyMigration();
