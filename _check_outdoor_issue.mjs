#!/usr/bin/env node
/**
 * Check outdoor seating issue for business 69fabd28-83cd-4b60-859e-b1f80c387df9
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { load } from 'jsr:@std/dotenv';

// Load environment variables
let env = {};
try {
  env = await load({ envPath: '.env.local', export: false });
} catch {
  console.log('No .env.local found, trying .env...');
  try {
    env = await load({ envPath: '.env', export: false });
  } catch {
    console.log('No .env found either');
  }
}

const SUPABASE_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || 'https://kvqdkohdpvmdylqgujpn.supabase.co';
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;

console.log('Using URL:', SUPABASE_URL);
console.log('Has key:', !!SUPABASE_KEY);

if (!SUPABASE_KEY) {
  console.error('No Supabase key found in environment');
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const businessId = '69fabd28-83cd-4b60-859e-b1f80c387df9';

// Check business operations
console.log('\n=== BUSINESS OPERATIONS ===');
const { data: ops, error: opsError } = await supabase
  .from('business_operations')
  .select('has_outdoor_seating, establishment_type')
  .eq('business_id', businessId)
  .single();

if (opsError) {
  console.error('Error:', opsError);
} else {
  console.log('has_outdoor_seating:', ops?.has_outdoor_seating);
  console.log('Type:', typeof ops?.has_outdoor_seating);
  console.log('Is NULL:', ops?.has_outdoor_seating === null);
  console.log('Is TRUE:', ops?.has_outdoor_seating === true);
  console.log('Is FALSE:', ops?.has_outdoor_seating === false);
  console.log('With || false:', ops?.has_outdoor_seating || false);
}

// Check recent weekly strategy
console.log('\n=== RECENT WEEKLY STRATEGY ===');
const { data: strategies, error: stratError } = await supabase
  .from('weekly_strategies')
  .select('id, week_start, week_number, ideas, week_context_snapshot')
  .eq('business_id', businessId)
  .order('created_at', { ascending: false })
  .limit(1);

if (stratError) {
  console.error('Error:', stratError);
} else if (strategies && strategies[0]) {
  const strat = strategies[0];
  console.log('Week:', strat.week_number, 'Start:', strat.week_start);
  
  const weather = strat.week_context_snapshot?.weather;
  console.log('\nWeather has_outdoor_seating:', weather?.has_outdoor_seating);
  
  const location = strat.week_context_snapshot?.location;
  console.log('Location has_outdoor_seating:', location?.has_outdoor_seating);
  
  console.log('\n=== IDEAS ===');
  if (Array.isArray(strat.ideas)) {
    strat.ideas.forEach((idea, idx) => {
      const outdoorMention = 
        /outdoor|udendørs|terrasse|udeservering|udeområde/i.test(idea.title || '') ||
        /outdoor|udendørs|terrasse|udeservering|udeområde/i.test(idea.rationale || '');
      
      if (outdoorMention) {
        console.log(`\n[${idx + 1}] ${idea.title}`);
        console.log(`    Category: ${idea.content_category}`);
        console.log(`    Rationale: ${idea.rationale}`);
        console.log(`    ⚠️  OUTDOOR MENTION DETECTED`);
      }
    });
  }
}
