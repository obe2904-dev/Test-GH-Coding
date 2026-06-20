#!/usr/bin/env node

/**
 * Apply quota update to database
 * Updates get_daily_usage_stats to return 100 for all tiers (testing mode)
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import { config } from 'npm:dotenv@16'

// Load environment variables
config()

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  Deno.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const sql = `
CREATE OR REPLACE FUNCTION get_daily_usage_stats(
  p_business_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  regenerations_used INTEGER,
  regenerations_limit INTEGER,
  suggestions_count INTEGER,
  suggestions_selected INTEGER,
  texts_generated INTEGER,
  tier TEXT
) AS $$
DECLARE
  v_plan TEXT;
  v_regen_count INTEGER;
  v_regen_limit INTEGER;
  v_last_reset DATE;
  v_needs_reset BOOLEAN;
BEGIN
  -- Get business plan, regeneration count, and last reset date
  SELECT 
    COALESCE(plan, 'free'),
    COALESCE(quick_suggestions_today, 0),
    last_quick_suggestions_reset
  INTO v_plan, v_regen_count, v_last_reset
  FROM businesses
  WHERE id = p_business_id;
  
  -- Check if counter needs to be reset for new day
  v_needs_reset := v_last_reset IS NULL OR v_last_reset < CURRENT_DATE;
  
  -- Reset counter if it's a new day
  IF v_needs_reset THEN
    UPDATE businesses 
    SET 
      quick_suggestions_today = 0,
      last_quick_suggestions_reset = CURRENT_DATE
    WHERE id = p_business_id;
    
    v_regen_count := 0;
    
    RAISE LOG 'Reset daily counter for business % (was %, now 0)', p_business_id, v_regen_count;
  END IF;
  
  -- TESTING MODE: All tiers get 100 regenerations/day
  -- Calculate tier-based regeneration limit
  v_regen_limit := CASE v_plan
    WHEN 'standardplus' THEN 100  -- TESTING: 100 (Production: 3)
    WHEN 'premium' THEN 100  -- TESTING: 100 (Production: 5)
    ELSE 100  -- TESTING: Free tier 100 (Production: 3)
  END;
  
  -- Return stats for today's suggestions
  RETURN QUERY
  SELECT 
    v_regen_count AS regenerations_used,
    v_regen_limit AS regenerations_limit,
    COUNT(*)::INTEGER AS suggestions_count,
    COUNT(*) FILTER (WHERE text_generated_count > 0)::INTEGER AS suggestions_selected,
    COALESCE(SUM(text_generated_count), 0)::INTEGER AS texts_generated,
    v_plan AS tier
  FROM daily_suggestions
  WHERE business_id = p_business_id
    AND date = p_date
    AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`

console.log('🔄 Updating get_daily_usage_stats function to TESTING MODE (all tiers = 100)...')

const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

if (error) {
  console.error('❌ Error:', error)
  Deno.exit(1)
}

console.log('✅ Database function updated successfully!')
console.log('📊 All tiers now have 100 regenerations/day limit')
console.log('⚠️  Remember to restore production values (3/3/5) before going live!')
