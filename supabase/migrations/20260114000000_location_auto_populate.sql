-- Auto-create empty knowledge records when business is created
-- This ensures all businesses have the knowledge structure ready

CREATE OR REPLACE FUNCTION auto_create_business_knowledge_records()
RETURNS TRIGGER AS $$
BEGIN
  -- Create empty location intelligence record
  INSERT INTO business_location_intelligence (business_id)
  VALUES (NEW.id)
  ON CONFLICT (business_id) DO NOTHING;

  -- Create empty operations record
  INSERT INTO business_operations (
    business_id,
    opening_hours,
    service_periods,
    typical_busy_periods,
    typical_slow_periods,
    currency,
    has_table_service
  )
  VALUES (
    NEW.id,
    '{}'::jsonb,
    '{}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    'DKK',
    true
  )
  ON CONFLICT (business_id) DO NOTHING;

  -- Create empty menu metadata record
  INSERT INTO business_menu_metadata (
    business_id,
    total_items_count,
    signature_items_count,
    organic_certified,
    has_specialty_coffee,
    has_full_bar,
    has_wine_list
  )
  VALUES (
    NEW.id,
    0,
    0,
    false,
    false,
    false,
    false
  )
  ON CONFLICT (business_id) DO NOTHING;

  -- Create empty visual identity record
  INSERT INTO business_visual_identity (
    business_id,
    photography_style,
    platform_visuals,
    signature_visual_elements,
    primary_colors
  )
  VALUES (
    NEW.id,
    '{}'::jsonb,
    '{}'::jsonb,
    ARRAY[]::text[],
    '[]'::jsonb
  )
  ON CONFLICT (business_id) DO NOTHING;

  -- Create empty audience profile record
  INSERT INTO business_audience_profile (
    business_id,
    customer_segments,
    social_media_audience,
    market_position,
    main_competitors
  )
  VALUES (
    NEW.id,
    '[]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    '[]'::jsonb
  )
  ON CONFLICT (business_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to run after business insert
DROP TRIGGER IF EXISTS trigger_auto_create_business_knowledge ON businesses;
CREATE TRIGGER trigger_auto_create_business_knowledge
  AFTER INSERT ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_business_knowledge_records();

-- Add comment for documentation
COMMENT ON FUNCTION auto_create_business_knowledge_records() IS 
'Automatically creates empty knowledge records (location, operations, menu, visual, audience) when a new business is created. This ensures the knowledge structure is always ready for AI population.';

-- Backfill existing businesses (run once)
DO $$
DECLARE
  business_record RECORD;
BEGIN
  FOR business_record IN SELECT id FROM businesses LOOP
    -- Create empty location intelligence record
    INSERT INTO business_location_intelligence (business_id)
    VALUES (business_record.id)
    ON CONFLICT (business_id) DO NOTHING;

    -- Create empty operations record
    INSERT INTO business_operations (
      business_id,
      opening_hours,
      service_periods,
      typical_busy_periods,
      typical_slow_periods,
      currency,
      has_table_service
    )
    VALUES (
      business_record.id,
      '{}'::jsonb,
      '{}'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      'DKK',
      true
    )
    ON CONFLICT (business_id) DO NOTHING;

    -- Create empty menu metadata record
    INSERT INTO business_menu_metadata (
      business_id,
      total_items_count,
      signature_items_count,
      organic_certified,
      has_specialty_coffee,
      has_full_bar,
      has_wine_list
    )
    VALUES (
      business_record.id,
      0,
      0,
      false,
      false,
      false,
      false
    )
    ON CONFLICT (business_id) DO NOTHING;

    -- Create empty visual identity record
    INSERT INTO business_visual_identity (
      business_id,
      photography_style,
      platform_visuals,
      signature_visual_elements,
      primary_colors
    )
    VALUES (
      business_record.id,
      '{}'::jsonb,
      '{}'::jsonb,
      ARRAY[]::text[],
      '[]'::jsonb
    )
    ON CONFLICT (business_id) DO NOTHING;

    -- Create empty audience profile record
    INSERT INTO business_audience_profile (
      business_id,
      customer_segments,
      social_media_audience,
      market_position,
      main_competitors
    )
    VALUES (
      business_record.id,
      '[]'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      '[]'::jsonb
    )
    ON CONFLICT (business_id) DO NOTHING;
  END LOOP;
END $$;
