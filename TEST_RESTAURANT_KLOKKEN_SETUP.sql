-- ============================================================================
-- RESTAURANT KLOKKEN (FSE - Fine Dining) - Complete Test Setup
-- ============================================================================
-- Business: Restaurant Klokken
-- Website: https://restaurantklokken.dk
-- City: Aarhus (8000)
-- Type: FSE (Fine Service Establishment)
-- Purpose: Test V17 + Phase 0/2b fixes on fine dining restaurant
-- ============================================================================

-- Get user ID from existing Café Faust business
DO $$
DECLARE
  v_user_id UUID;
  v_business_id UUID;
  v_brand_profile_id UUID;
BEGIN
  -- Get user ID from Café Faust
  SELECT owner_id INTO v_user_id
  FROM businesses
  WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Could not find user from Café Faust business';
  END IF;

  RAISE NOTICE 'Using user ID: %', v_user_id;

  -- ============================================================================
  -- 1. CREATE BUSINESS
  -- ============================================================================
  
  INSERT INTO businesses (
    id,
    owner_id,
    name,
    vertical,
    website_url,
    primary_language,
    city,
    country,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    'Restaurant Klokken',
    'FSE',  -- Fine Service Establishment
    'https://restaurantklokken.dk',
    'da',
    'Aarhus',
    'Denmark',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_business_id;

  RAISE NOTICE 'Created business: % (%)', 'Restaurant Klokken', v_business_id;

  -- ============================================================================
  -- 2. BUSINESS PROFILE
  -- ============================================================================
  
  INSERT INTO business_profile (
    business_id,
    short_description,
    long_description,
    price_level,
    target_audience,
    founded_year,
    created_at,
    updated_at
  ) VALUES (
    v_business_id,
    'Moderne nordisk gastronomi i hjertet af Aarhus',
    'Restaurant Klokken tilbyder en unik madoplevelse med fokus på sæsonbetonede råvarer og nordisk håndværk. Vores menu er inspireret af de klassiske franskinspirerede teknikker kombineret med moderne nordiske smagsnuancer.',
    'high',
    'Madentusiaster, særlige lejligheder, gourmets',
    2018,
    NOW(),
    NOW()
  );

  -- ============================================================================
  -- 3. BRAND PROFILE (with never_say words)
  -- ============================================================================
  
  INSERT INTO business_brand_profile (
    business_id,
    tone_keywords,
    voice_style,
    values,
    certifications,
    never_say,
    signature_phrases,
    typical_openings,
    typical_closings,
    humor_level,
    formality_level,
    created_at,
    updated_at
  ) VALUES (
    v_business_id,
    ARRAY['Raffineret', 'Passioneret', 'Autentisk', 'Nordisk', 'Håndværk'],
    'Sofistikeret men tilgængeligt, professionelt uden at være distanceret',
    ARRAY['Bæredygtighed', 'Råvarekvalitet', 'Håndværk', 'Innovation'],
    ARRAY['Ny Nordisk Mad'],
    -- Same 107 banned words as Café Faust
    ARRAY[
      'kom forbi', 'nyd', 'nyder', 'nydes', 'oplev', 'oplevelse', 'autentisk', 
      'unik', 'unikke', 'skøn', 'dejlig', 'dejligt', 'lækker', 'lækkert', 
      'hyggelig', 'hyggeligt', 'perfekt', 'perfekte', 'fantastisk', 'fantastiske',
      'fortryllende', 'smagfuld', 'smagfuldt', 'vidunderlig', 'vidunderligt',
      'ekstraordinær', 'udsøgt', 'sublim', 'eventyrlig', 'magisk', 'tryllebindende',
      'fænomenal', 'outstanding', 'fængende', 'forførende', 'lokkende',
      'bedøvende', 'himlens', 'episk', 'ægte', 'æggest', 'rigtig', 'helt',
      'super', 'mega', 'ultra', 'ekstra', 'special', 'speciel', 'specielle',
      'uovertruffet', 'uovertruffen', 'usædvanlig', 'enestående', 'uslagelig',
      'umistelig', 'uundværlig', 'uforglemmelig', 'ikonisk', 'legendarisk',
      'klassisk', 'tidløs', 'ren', 'fresh', 'crispy', 'creamy', 'velsmag',
      'velsmagende', 'smagsoplevelse', 'gastronomisk', 'kulinarisk',
      'gourmet', 'fusion', 'next level', 'game changer', 'must have',
      'must try', 'spot on', 'on point', 'top notch', 'first class',
      'premium', 'exclusive', 'luksuriøs', 'overdådig', 'prangende',
      'majestætisk', 'royal', 'kongelig', 'exceptionel', 'usædvanligt',
      'bemærkelsesværdig', 'imponerende', 'forbløffende', 'overvældende',
      'formidabel', 'monumental', 'spektakulær', 'grandios', 'gloriøs',
      'strålende', 'brilliant', 'genial'
    ],
    ARRAY[
      'Vores 3-retters menu',
      'Sæsonens råvarer fra lokale producenter',
      'Nordisk gastronomi med moderne twist',
      'Vinmenu kurateret af vores sommelier'
    ],
    ARRAY[
      'Denne uge på Restaurant Klokken',
      'Vores køkken',
      'I vores seneste menu'
    ],
    ARRAY[
      'Book dit bord',
      'Reservér via vores hjemmeside',
      'Vi ses til middag'
    ],
    'subtle',
    'professional',
    NOW(),
    NOW()
  );

  -- ============================================================================
  -- 4. LOCATION
  -- ============================================================================
  
  INSERT INTO business_locations (
    business_id,
    label,
    address_line1,
    address_line2,
    postal_code,
    city,
    country,
    is_primary,
    created_at
  ) VALUES (
    v_business_id,
    'Hovedlokation',
    'M.P. Bruuns Gade 31',
    NULL,
    '8000',
    'Aarhus',
    'Denmark',
    TRUE,
    NOW()
  );

  -- ============================================================================
  -- 5. OPENING HOURS (Fine dining - typical evening focus)
  -- ============================================================================
  
  INSERT INTO opening_hours (business_id, weekday, open_time, close_time, closed, kind)
  VALUES
    -- Tuesday-Saturday: Dinner service
    (v_business_id, 'tuesday', '17:30', '22:00', FALSE, 'normal'),
    (v_business_id, 'wednesday', '17:30', '22:00', FALSE, 'normal'),
    (v_business_id, 'thursday', '17:30', '22:00', FALSE, 'normal'),
    (v_business_id, 'friday', '17:30', '23:00', FALSE, 'normal'),
    (v_business_id, 'saturday', '17:30', '23:00', FALSE, 'normal'),
    
    -- Closed Sunday-Monday (typical for fine dining)
    (v_business_id, 'sunday', NULL, NULL, TRUE, 'normal'),
    (v_business_id, 'monday', NULL, NULL, TRUE, 'normal');

  -- ============================================================================
  -- 6. OPERATIONS DATA
  -- ============================================================================
  
  INSERT INTO business_operations (
    business_id,
    seating_capacity_indoor,
    seating_capacity_outdoor,
    has_booking_system,
    has_takeaway,
    has_delivery,
    has_outdoor_seating,
    establishment_type,
    preferred_posts_per_week,
    created_at,
    updated_at
  ) VALUES (
    v_business_id,
    65,
    0,  -- No outdoor seating (typical for fine dining)
    TRUE,
    FALSE,
    FALSE,
    FALSE,
    'restaurant',
    4,  -- FSE typically wants fewer, high-quality posts
    NOW(),
    NOW()
  );

  -- ============================================================================
  -- 7. MENU ITEMS (Fine Dining - Elegant dishes)
  -- ============================================================================
  
  -- Create menu result entry first
  INSERT INTO menu_results (
    id,
    business_id,
    source_kind,
    source_url,
    extracted_data,
    created_at
  ) VALUES (
    gen_random_uuid(),
    v_business_id,
    'manual',
    'https://restaurantklokken.dk',
    jsonb_build_object(
      'menuTitle', 'Restaurant Klokken Menu',
      'categories', jsonb_build_array(
        jsonb_build_object(
          'name', 'Forretter',
          'items', jsonb_build_array(
            jsonb_build_object('name', 'Tartare af Dansk Okse med Trøffel', 'price', '145', 'description', 'Rogn, syltede grøntsager og trøffel'),
            jsonb_build_object('name', 'Kammusling fra Limfjorden', 'price', '165', 'description', 'Pastinak, hasselnød og citrus'),
            jsonb_build_object('name', 'Stenbiderrogn med Brioche', 'price', '125', 'description', 'Crème fraîche og urter')
          )
        ),
        jsonb_build_object(
          'name', 'Hovedretter',
          'items', jsonb_build_array(
            jsonb_build_object('name', 'Helstegt Pigeon', 'price', '325', 'description', 'Rodfrugter, bærjus og vilde svampe'),
            jsonb_build_object('name', 'Torsk fra Skagerrak', 'price', '295', 'description', 'Hvid asparges, perlekorn og hummersauce'),
            jsonb_build_object('name', 'Lammeryg fra Fanø', 'price', '335', 'description', 'Ramsløg, violkartofler og røget marv')
          )
        ),
        jsonb_build_object(
          'name', 'Desserter',
          'items', jsonb_build_array(
            jsonb_build_object('name', 'Rabarber og Jordbær', 'price', '105', 'description', 'Vaniljeis og mandel'),
            jsonb_build_object('name', 'Chokoladefondant', 'price', '115', 'description', 'Saltet karamel og havsalt'),
            jsonb_build_object('name', 'Oste fra Danmark', 'price', '125', 'description', 'Frugtbrød og honning')
          )
        )
      )
    ),
    NOW()
  );

  -- Add signature items to menu_item_metadata
  INSERT INTO menu_item_metadata (
    business_id,
    item_name,
    item_category,
    item_section,
    is_signature,
    is_seasonal,
    is_limited_time,
    dish_temp_category,
    seasonal_ingredients,
    item_added_date
  ) VALUES
    (v_business_id, 'Tartare af Dansk Okse med Trøffel', 'Forretter', 'dinner', TRUE, FALSE, FALSE, 'cold', ARRAY['trøffel'], NOW()),
    (v_business_id, 'Kammusling fra Limfjorden', 'Forretter', 'dinner', TRUE, TRUE, FALSE, 'warm', ARRAY['kammusling', 'pastinak'], NOW()),
    (v_business_id, 'Helstegt Pigeon', 'Hovedretter', 'dinner', TRUE, TRUE, FALSE, 'hot', ARRAY['svampe', 'rodfrugter'], NOW()),
    (v_business_id, 'Torsk fra Skagerrak', 'Hovedretter', 'dinner', TRUE, TRUE, FALSE, 'hot', ARRAY['asparges', 'torsk'], NOW()),
    (v_business_id, 'Lammeryg fra Fanø', 'Hovedretter', 'dinner', TRUE, TRUE, FALSE, 'hot', ARRAY['lam', 'ramsløg'], NOW()),
    (v_business_id, 'Rabarber og Jordbær', 'Desserter', 'dinner', FALSE, TRUE, FALSE, 'cold', ARRAY['rabarber', 'jordbær'], NOW()),
    (v_business_id, 'Chokoladefondant', 'Desserter', 'dinner', TRUE, FALSE, FALSE, 'warm', ARRAY['chokolade'], NOW()),
    (v_business_id, 'Oste fra Danmark', 'Desserter', 'dinner', FALSE, FALSE, FALSE, 'neutral', ARRAY['ost'], NOW());

  -- ============================================================================
  -- SUMMARY
  -- ============================================================================
  
  RAISE NOTICE '✅ Restaurant Klokken setup complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'Business ID: %', v_business_id;
  RAISE NOTICE 'Type: FSE (Fine Service Establishment)';
  RAISE NOTICE 'City: Aarhus';
  RAISE NOTICE 'Menu Items: 9 (3 appetizers, 3 mains, 3 desserts)';
  RAISE NOTICE 'Opening: Tuesday-Saturday, 17:30-22:00';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Next steps:';
  RAISE NOTICE '1. Copy the Business ID above';
  RAISE NOTICE '2. Run: curl get-weekly-strategy with this business_id';
  RAISE NOTICE '3. Compare FSE output vs SBO (Café Faust)';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Testing focus:';
  RAISE NOTICE '   - Fine dining tone (sophisticated, refined)';
  RAISE NOTICE '   - Seasonal ingredient focus';
  RAISE NOTICE '   - Wine pairing suggestions';
  RAISE NOTICE '   - Special occasion messaging';
  RAISE NOTICE '   - Banned word avoidance (same 107 as Café Faust)';

END $$;
