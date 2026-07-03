-- Migration: Transform existing demographic_proximity to who + traffic_rhythm
-- Date: 2026-07-01
-- Purpose: Migrate data from v2 to v3 Physical Anchor Taxonomy

-- STEP 1: Create backup
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'business_location_intelligence_backup_20260701') THEN
    EXECUTE 'CREATE TABLE business_location_intelligence_backup_20260701 AS SELECT * FROM business_location_intelligence';
    RAISE NOTICE 'Backup table created: business_location_intelligence_backup_20260701';
  END IF;
END $$;

-- STEP 2: Transform demographic_proximity to who field
-- Map old demographic keys to new WhoType values
UPDATE business_location_intelligence
SET who = jsonb_build_object(
  'primary', (
    SELECT jsonb_agg(DISTINCT who_type) 
    FROM (
      SELECT 
        CASE 
          WHEN key = 'office_worker' AND value::int >= 70 THEN 'office_worker'
          WHEN key = 'business_professional' AND value::int >= 70 THEN 'office_worker'
          WHEN key = 'local_resident' AND value::int >= 70 THEN 'local_resident'
          WHEN key = 'tourist' AND value::int >= 70 THEN 'tourist'
          WHEN key = 'student' AND value::int >= 70 THEN 'student'
          WHEN key = 'family' AND value::int >= 70 THEN 'family'
          WHEN key = 'shopper' AND value::int >= 70 THEN 'shopper'
        END as who_type
      FROM jsonb_each_text(COALESCE(demographic_proximity, '{}'::jsonb))
      WHERE value::int >= 70
    ) primary_types
    WHERE who_type IS NOT NULL
  ),
  'secondary', (
    SELECT jsonb_agg(DISTINCT who_type) 
    FROM (
      SELECT 
        CASE 
          WHEN key = 'office_worker' AND value::int >= 40 AND value::int < 70 THEN 'office_worker'
          WHEN key = 'business_professional' AND value::int >= 40 AND value::int < 70 THEN 'office_worker'
          WHEN key = 'local_resident' AND value::int >= 40 AND value::int < 70 THEN 'local_resident'
          WHEN key = 'tourist' AND value::int >= 40 AND value::int < 70 THEN 'tourist'
          WHEN key = 'student' AND value::int >= 40 AND value::int < 70 THEN 'student'
          WHEN key = 'family' AND value::int >= 40 AND value::int < 70 THEN 'family'
          WHEN key = 'shopper' AND value::int >= 40 AND value::int < 70 THEN 'shopper'
        END as who_type
      FROM jsonb_each_text(COALESCE(demographic_proximity, '{}'::jsonb))
      WHERE value::int >= 40 AND value::int < 70
    ) secondary_types
    WHERE who_type IS NOT NULL
  )
)
WHERE demographic_proximity IS NOT NULL 
  AND demographic_proximity != '{}'::jsonb
  AND location_architecture_version <= 2;

-- STEP 3: Synthesize traffic_rhythm from area_type + category_scores
-- Default patterns based on dominant location type
UPDATE business_location_intelligence
SET traffic_rhythm = 
  CASE area_type
    -- City centre: consistent weekday + explosive Saturday pattern
    WHEN 'city_centre' THEN jsonb_build_object(
      'peak_days', 'both',
      'peak_hours', '10:00–22:00',
      'dead_periods', 'søndag efter 17:00',
      'seasonal_pattern', 'stable'
    )
    -- Waterfront: afternoon/evening heavy, massive summer peak
    WHEN 'waterfront' THEN jsonb_build_object(
      'peak_days', 'weekend',
      'peak_hours', '12:00–22:00',
      'dead_periods', 'hverdage 08:00–11:00',
      'seasonal_pattern', 'summer_peak',
      'seasonal_note', 'Vinter: 50% af sommertrafik'
    )
    -- Office: weekday lunch crunch, dead weekends
    WHEN 'office' THEN jsonb_build_object(
      'peak_days', 'weekday',
      'peak_hours', '08:00–09:30 og 11:30–13:30',
      'dead_periods', 'efter 17:00 og weekender',
      'seasonal_pattern', 'stable',
      'seasonal_note', 'Sommerferie: -40%'
    )
    -- Transport hub: violent peaks at shift times
    WHEN 'transport_hub' THEN jsonb_build_object(
      'peak_days', 'weekday',
      'peak_hours', '07:00–09:00 og 16:00–18:00',
      'dead_periods', 'weekend middage',
      'seasonal_pattern', 'stable'
    )
    -- Shopping district: Saturday massive, slow Mon-Tue
    WHEN 'shopping_district' THEN jsonb_build_object(
      'peak_days', 'weekend',
      'peak_hours', '10:00–19:00',
      'dead_periods', 'mandag–tirsdag',
      'seasonal_pattern', 'retail_calendar',
      'seasonal_note', 'Jul: +50%, januar: -30%'
    )
    -- Residential: weekend brunch peak, steady baseline
    WHEN 'residential' THEN jsonb_build_object(
      'peak_days', 'both',
      'peak_hours', '07:30–09:00 og 17:30–21:00',
      'dead_periods', 'hverdage 10:00–16:00',
      'seasonal_pattern', 'stable'
    )
    -- Nature park: summer peak, afternoon heavy
    WHEN 'nature_park' THEN jsonb_build_object(
      'peak_days', 'weekend',
      'peak_hours', '12:00–18:00',
      'dead_periods', 'hverdage og vinter',
      'seasonal_pattern', 'summer_peak',
      'seasonal_note', 'Vinter: 55% af sommertrafik'
    )
    -- Tourist destination: midday peak, strong summer
    WHEN 'tourist_destination' THEN jsonb_build_object(
      'peak_days', 'both',
      'peak_hours', '10:00–20:00',
      'dead_periods', 'tidlig morgen',
      'seasonal_pattern', 'summer_peak',
      'seasonal_note', 'Sommergæster dominerer'
    )
    -- Fallback: stable pattern
    ELSE jsonb_build_object(
      'peak_days', 'both',
      'peak_hours', '11:00–21:00',
      'dead_periods', 'ikke identificeret',
      'seasonal_pattern', 'stable'
    )
  END
WHERE traffic_rhythm IS NULL
  AND area_type IS NOT NULL;

-- STEP 4: Update schema version for migrated records
UPDATE business_location_intelligence
SET location_architecture_version = 3
WHERE location_architecture_version < 3
  AND (who IS NOT NULL OR traffic_rhythm IS NOT NULL);

-- STEP 5: Report migration statistics
DO $$
DECLARE
  total_count INTEGER;
  who_migrated INTEGER;
  rhythm_migrated INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM business_location_intelligence;
  SELECT COUNT(*) INTO who_migrated FROM business_location_intelligence WHERE who IS NOT NULL;
  SELECT COUNT(*) INTO rhythm_migrated FROM business_location_intelligence WHERE traffic_rhythm IS NOT NULL;
  
  RAISE NOTICE '📊 Migration Statistics:';
  RAISE NOTICE '   Total records: %', total_count;
  RAISE NOTICE '   WHO migrated: % (%.0f%%)', who_migrated, (who_migrated::float / NULLIF(total_count, 0) * 100);
  RAISE NOTICE '   TRAFFIC_RHYTHM migrated: % (%.0f%%)', rhythm_migrated, (rhythm_migrated::float / NULLIF(total_count, 0) * 100);
  RAISE NOTICE '✅ Data migration to Physical Anchor Taxonomy v3 complete';
END $$;
