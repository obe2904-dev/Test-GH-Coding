-- =====================================================
-- LAYER 2: STRATEGIC BASELINES - COMPLETE RULES
-- =====================================================
-- Codifies the content strategy framework into queryable rules
-- Based on business type, defines:
-- - Weekly post volume
-- - Content type distribution ratios
-- - Platform assignment rules

-- =====================================================
-- DECISION A: Weekly Post Volume
-- =====================================================
-- Already handled in business_type_defaults (created in Layer 1)
-- But let's ensure the ratios match your framework

UPDATE business_type_defaults SET
  min_posts_per_week = 4,
  max_posts_per_week = 5,
  ideal_posts_per_week = 4
WHERE business_type = 'FSE';

UPDATE business_type_defaults SET
  min_posts_per_week = 4,
  max_posts_per_week = 5,
  ideal_posts_per_week = 4
WHERE business_type = 'SBO';

UPDATE business_type_defaults SET
  min_posts_per_week = 5,
  max_posts_per_week = 7,
  ideal_posts_per_week = 6
WHERE business_type = 'MFV';

UPDATE business_type_defaults SET
  min_posts_per_week = 2,
  max_posts_per_week = 3,
  ideal_posts_per_week = 2
WHERE business_type = 'MFD';

UPDATE business_type_defaults SET
  min_posts_per_week = 3,
  max_posts_per_week = 4,
  ideal_posts_per_week = 3
WHERE business_type = 'QSR';

-- =====================================================
-- DECISION B: Post Type Distribution Baseline
-- =====================================================
-- Define content types and their characteristics

CREATE TABLE IF NOT EXISTS content_types (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  
  -- Visual characteristics
  requires_high_quality_photo BOOLEAN DEFAULT FALSE,
  typical_photo_style TEXT, -- 'beauty_shot', 'action', 'lifestyle', 'product'
  
  -- Platform affinity
  instagram_priority INTEGER DEFAULT 5 CHECK (instagram_priority BETWEEN 1 AND 10),
  facebook_priority INTEGER DEFAULT 5 CHECK (facebook_priority BETWEEN 1 AND 10),
  
  -- Content characteristics
  is_promotional BOOLEAN DEFAULT FALSE,
  is_time_sensitive BOOLEAN DEFAULT FALSE,
  requires_user_permission BOOLEAN DEFAULT FALSE, -- for customer photos
  
  -- Universal rules
  max_frequency_per_week INTEGER, -- NULL = no limit
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert content type definitions
INSERT INTO content_types (id, display_name, description, requires_high_quality_photo, typical_photo_style, instagram_priority, facebook_priority, is_promotional, is_time_sensitive) VALUES
  ('menu_highlight', 'Menu Highlight', 'Signature dishes, seasonal specials, hero products', TRUE, 'beauty_shot', 9, 6, FALSE, FALSE),
  ('atmosphere_experience', 'Atmosphere/Experience', 'Dining room ambiance, table settings, the experience', TRUE, 'lifestyle', 9, 5, FALSE, FALSE),
  ('behind_scenes', 'Behind the Scenes', 'Kitchen prep, chef at work, ingredient sourcing', TRUE, 'action', 8, 6, FALSE, FALSE),
  ('events_promotions', 'Events/Promotions', 'Special events, wine dinners, holiday menus, deals', FALSE, 'product', 6, 9, TRUE, TRUE),
  ('product_beauty', 'Product Beauty Shot', 'Latte art, wine pours, signature drinks', TRUE, 'beauty_shot', 10, 5, FALSE, FALSE),
  ('lifestyle_ambiance', 'Lifestyle/Ambiance', 'Cozy corners, customers enjoying, the vibe', TRUE, 'lifestyle', 9, 7, FALSE, FALSE),
  ('educational', 'Educational Content', 'Bean origins, tasting notes, brewing tips, wine regions', FALSE, 'lifestyle', 7, 8, FALSE, FALSE),
  ('community_events', 'Community/Events', 'Open mic nights, wine tastings, local artist features', FALSE, 'lifestyle', 6, 9, FALSE, TRUE),
  ('location_announcement', 'Location Announcement', 'Where we are today, tomorrow, weekly schedule', FALSE, 'product', 8, 8, FALSE, TRUE),
  ('action_shots', 'Action Shots', 'Cooking on truck, prep, line of customers', TRUE, 'action', 9, 6, FALSE, FALSE),
  ('customer_love', 'Customer Love', 'Repost customer photos, testimonials, community', FALSE, 'lifestyle', 8, 9, FALSE, FALSE),
  ('product_focus', 'Product Focus', 'What you offer, packaging, convenience angle', TRUE, 'product', 7, 7, FALSE, FALSE),
  ('locations_served', 'Locations Served', 'Where to find you, service area updates', FALSE, 'product', 5, 8, FALSE, FALSE),
  ('value_convenience', 'Value/Convenience', 'Why choose pre-packaged, safety, speed', FALSE, 'product', 5, 8, TRUE, FALSE),
  ('promotional_offers', 'Promotional Offers', 'Deals, combo meals, limited-time offers', FALSE, 'product', 6, 10, TRUE, TRUE),
  ('speed_convenience', 'Speed/Convenience', 'Quick service, mobile ordering, drive-thru', FALSE, 'product', 6, 8, TRUE, FALSE),
  ('community_fun', 'Community/Fun', 'Local sponsorships, team highlights, lighthearted content', FALSE, 'lifestyle', 7, 9, FALSE, FALSE);

-- =====================================================
-- Content Type Distribution per Business Type
-- =====================================================
CREATE TABLE IF NOT EXISTS content_distribution_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_type TEXT NOT NULL REFERENCES business_type_defaults(business_type),
  content_type_id TEXT NOT NULL REFERENCES content_types(id),
  
  -- Distribution rules
  baseline_percentage DECIMAL(4,1) NOT NULL CHECK (baseline_percentage >= 0 AND baseline_percentage <= 100),
  posts_per_week DECIMAL(3,1), -- Can be fractional (e.g., 0.5 = every other week)
  
  -- Priority and constraints
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10), -- Higher = more important
  min_days_between INTEGER DEFAULT 0, -- Minimum days before repeating this type
  
  -- Strategy notes
  rationale TEXT,
  examples TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE (business_type, content_type_id)
);

-- =====================================================
-- FSE (Full-Service Establishments) - 4-5 posts/week
-- =====================================================
INSERT INTO content_distribution_rules (business_type, content_type_id, baseline_percentage, posts_per_week, priority, min_days_between, rationale, examples) VALUES
  ('FSE', 'menu_highlight', 40.0, 2.0, 10, 2, 
   'Signature dishes, seasonal specials, chef recommendations - the hero content',
   ARRAY['Pan-seared salmon with seasonal vegetables', 'Chef''s special: Wild mushroom risotto', 'Weekend brunch favorite: Eggs Benedict']),
  
  ('FSE', 'atmosphere_experience', 25.0, 1.0, 8, 3,
   'Dining room ambiance, table settings, the experience - justifies the price point',
   ARRAY['Candlelit corner table for two', 'Our newly renovated dining room', 'The perfect setting for your celebration']),
  
  ('FSE', 'behind_scenes', 20.0, 1.0, 7, 5,
   'Kitchen prep, chef at work, ingredient sourcing - builds trust and interest',
   ARRAY['Chef preparing today''s special', 'Fresh ingredients from local market', 'Behind the scenes: Our pasta-making process']),
  
  ('FSE', 'events_promotions', 15.0, 0.5, 6, 7,
   'Special events, wine dinners, holiday menus - creates urgency',
   ARRAY['Valentine''s Day 3-course menu', 'Wine pairing dinner next Friday', 'New summer menu launches Monday']);

-- =====================================================
-- SBO/LSR (Wine Bars, Coffee Shops) - 4-5 posts/week
-- =====================================================
INSERT INTO content_distribution_rules (business_type, content_type_id, baseline_percentage, posts_per_week, priority, min_days_between, rationale, examples) VALUES
  ('SBO', 'product_beauty', 45.0, 2.0, 10, 2,
   'Latte art, wine pours, signature drinks - Instagram-native aesthetics',
   ARRAY['Perfect rosetta latte art', 'Our signature cappuccino', 'Wine pour at golden hour']),
  
  ('SBO', 'lifestyle_ambiance', 30.0, 1.5, 9, 3,
   'Cozy corners, the vibe, third-place atmosphere - lifestyle content',
   ARRAY['Afternoon reading nook', 'Your new favorite corner', 'Morning light in our café']),
  
  ('SBO', 'educational', 15.0, 1.0, 6, 5,
   'Bean origins, tasting notes, brewing tips - adds value beyond product',
   ARRAY['Meet our Ethiopian Yirgacheffe', 'What makes cold brew different?', 'Tasting notes: Chocolate, caramel, citrus']),
  
  ('SBO', 'community_events', 10.0, 0.5, 5, 7,
   'Open mic nights, wine tastings, local artists - builds community',
   ARRAY['Open mic night this Friday', 'Local artist showcase this month', 'Wine tasting with sommelier next week']);

-- =====================================================
-- MFV (Food Trucks) - 5-7 posts/week
-- =====================================================
INSERT INTO content_distribution_rules (business_type, content_type_id, baseline_percentage, posts_per_week, priority, min_days_between, rationale, examples) VALUES
  ('MFV', 'location_announcement', 35.0, 2.5, 10, 1,
   'Where/when - functional communication is priority #1 for mobile businesses',
   ARRAY['Today: Downtown plaza 11-2pm', 'Tomorrow: Park location', 'This week''s schedule 📍']),
  
  ('MFV', 'menu_highlight', 30.0, 2.0, 9, 2,
   'Daily specials, signature items, limited offers - creates FOMO',
   ARRAY['Today''s special: Korean BBQ tacos', 'Friday favorite: Loaded fries', 'Last chance: Pumpkin spice churros']),
  
  ('MFV', 'action_shots', 20.0, 1.0, 7, 4,
   'Cooking on truck, prep, customer line - builds excitement and social proof',
   ARRAY['Fresh off the grill', 'The lunch rush is on!', 'Prepping your favorites']),
  
  ('MFV', 'customer_love', 15.0, 1.0, 6, 5,
   'Repost customer photos, testimonials - user-generated content builds trust',
   ARRAY['Repost: @customer loving our tacos', 'Your photos make us smile', 'Customer spotlight']);

-- =====================================================
-- MFD (Mobile Food Dispensers) - 2-3 posts/week
-- =====================================================
INSERT INTO content_distribution_rules (business_type, content_type_id, baseline_percentage, posts_per_week, priority, min_days_between, rationale, examples) VALUES
  ('MFD', 'product_focus', 50.0, 1.5, 10, 3,
   'What you offer, packaging, convenience - core value proposition',
   ARRAY['Healthy snacks, pre-packaged', 'Grab-and-go breakfast options', 'Safe, sealed, convenient']),
  
  ('MFD', 'locations_served', 30.0, 1.0, 8, 5,
   'Where to find you, service area - functional info',
   ARRAY['Now serving downtown offices', 'Find us at these locations', 'New stops added this week']),
  
  ('MFD', 'value_convenience', 20.0, 0.5, 6, 7,
   'Why choose pre-packaged - safety, speed, convenience angle',
   ARRAY['No waiting in line', '2-minute breakfast solution', 'Fresh, safe, convenient']);

-- =====================================================
-- QSR (Quick Service) - 3-4 posts/week
-- =====================================================
INSERT INTO content_distribution_rules (business_type, content_type_id, baseline_percentage, posts_per_week, priority, min_days_between, rationale, examples) VALUES
  ('QSR', 'promotional_offers', 40.0, 1.5, 10, 2,
   'Deals, combo meals, limited-time offers - value-driven content',
   ARRAY['2-for-1 Tuesday', 'New combo meal $9.99', 'Limited time: Spicy chicken sandwich']),
  
  ('QSR', 'menu_highlight', 35.0, 1.0, 9, 3,
   'Hero products, new items, craveable close-ups - makes food look irresistible',
   ARRAY['Our famous burger', 'New: Crispy chicken tenders', 'Loaded fries close-up']),
  
  ('QSR', 'speed_convenience', 15.0, 0.5, 6, 7,
   'Quick service, mobile ordering, drive-thru - functional benefits',
   ARRAY['Order ahead, skip the line', 'Drive-thru open late', 'Mobile ordering now available']),
  
  ('QSR', 'community_fun', 10.0, 0.5, 5, 7,
   'Local sponsorships, team highlights, lighthearted - human element',
   ARRAY['Meet the team: Carlos', 'Proud sponsor of local little league', 'Friday vibes at our location']);

-- =====================================================
-- DECISION C: Platform Distribution Rules
-- =====================================================
-- Already encoded in content_types table via instagram_priority and facebook_priority
-- But let's add explicit platform assignment rules

CREATE TABLE IF NOT EXISTS platform_assignment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type_id TEXT NOT NULL REFERENCES content_types(id),
  
  -- Platform assignment
  primary_platform TEXT NOT NULL CHECK (primary_platform IN ('instagram', 'facebook', 'both')),
  secondary_platform TEXT CHECK (secondary_platform IN ('instagram', 'facebook', 'none')),
  
  -- Rules
  rule_description TEXT NOT NULL,
  why TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE (content_type_id)
);

INSERT INTO platform_assignment_rules (content_type_id, primary_platform, secondary_platform, rule_description, why) VALUES
  ('menu_highlight', 'instagram', 'facebook', 'High-quality food photos → Instagram priority, cross-post to Facebook', 'Visual content performs best on Instagram'),
  ('atmosphere_experience', 'instagram', 'none', 'Aesthetic/lifestyle content → Instagram only', 'Instagram is the lifestyle platform'),
  ('behind_scenes', 'instagram', 'facebook', 'Stories and authenticity → Instagram priority, Facebook secondary', 'Instagram Stories native, Facebook appreciates authenticity'),
  ('events_promotions', 'facebook', 'instagram', 'Promotions/events → Facebook priority', 'Facebook users respond better to promotions and events'),
  ('product_beauty', 'instagram', 'none', 'Pure aesthetics → Instagram only', 'Instagram is built for beautiful product shots'),
  ('lifestyle_ambiance', 'instagram', 'facebook', 'Lifestyle content → Instagram priority, Facebook for community', 'Instagram aesthetics + Facebook community'),
  ('educational', 'both', 'none', 'Educational content works on both platforms equally', 'Value content transcends platform'),
  ('community_events', 'facebook', 'instagram', 'Community events → Facebook priority', 'Facebook better for local community organizing'),
  ('location_announcement', 'both', 'none', 'Functional info must reach everyone → Both platforms', 'Critical operational information'),
  ('action_shots', 'instagram', 'facebook', 'Dynamic action → Instagram priority (Stories)', 'Instagram Stories perfect for real-time action'),
  ('customer_love', 'both', 'none', 'User-generated content → Both platforms', 'Builds trust on all channels'),
  ('product_focus', 'both', 'none', 'Product info → Both platforms', 'Core business info needs wide reach'),
  ('locations_served', 'facebook', 'instagram', 'Service area info → Facebook priority (local targeting)', 'Facebook better for geographic targeting'),
  ('value_convenience', 'facebook', 'instagram', 'Value proposition → Facebook priority', 'Facebook users value-driven'),
  ('promotional_offers', 'facebook', 'instagram', 'Deals/offers → Facebook priority', 'Facebook users respond to promotions'),
  ('speed_convenience', 'facebook', 'instagram', 'Functional benefits → Facebook priority', 'Practical info performs better on Facebook'),
  ('community_fun', 'facebook', 'instagram', 'Community content → Facebook priority', 'Facebook builds local community better');

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Get content distribution for a business
CREATE OR REPLACE FUNCTION get_content_distribution(p_business_type TEXT)
RETURNS TABLE (
  content_type TEXT,
  display_name TEXT,
  baseline_percentage DECIMAL,
  posts_per_week DECIMAL,
  priority INTEGER,
  primary_platform TEXT,
  rationale TEXT,
  examples TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cdr.content_type_id,
    ct.display_name,
    cdr.baseline_percentage,
    cdr.posts_per_week,
    cdr.priority,
    par.primary_platform,
    cdr.rationale,
    cdr.examples
  FROM content_distribution_rules cdr
  JOIN content_types ct ON ct.id = cdr.content_type_id
  LEFT JOIN platform_assignment_rules par ON par.content_type_id = cdr.content_type_id
  WHERE cdr.business_type = p_business_type
  ORDER BY cdr.priority DESC, cdr.baseline_percentage DESC;
END;
$$ LANGUAGE plpgsql;

-- Get weekly post plan
CREATE OR REPLACE FUNCTION generate_weekly_post_slots(p_business_type TEXT)
RETURNS TABLE (
  slot_number INTEGER,
  content_type TEXT,
  display_name TEXT,
  suggested_platform TEXT,
  rationale TEXT
) AS $$
DECLARE
  total_posts INTEGER;
  slot_counter INTEGER := 1;
BEGIN
  -- Get ideal posts per week for this business type
  SELECT ideal_posts_per_week INTO total_posts
  FROM business_type_defaults
  WHERE business_type = p_business_type;
  
  -- Generate slots based on distribution rules
  -- This is a simplified version - production version would be more sophisticated
  FOR slot_number, content_type, display_name, suggested_platform, rationale IN
    SELECT 
      ROW_NUMBER() OVER (ORDER BY cdr.priority DESC) AS slot_num,
      cdr.content_type_id,
      ct.display_name,
      COALESCE(par.primary_platform, 'both'),
      cdr.rationale
    FROM content_distribution_rules cdr
    JOIN content_types ct ON ct.id = cdr.content_type_id
    LEFT JOIN platform_assignment_rules par ON par.content_type_id = cdr.content_type_id
    WHERE cdr.business_type = p_business_type
    AND cdr.posts_per_week >= 1.0
    ORDER BY cdr.priority DESC
    LIMIT total_posts
  LOOP
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE content_types IS 'Master list of content types with platform affinity and characteristics';
COMMENT ON TABLE content_distribution_rules IS 'Content type distribution ratios per business type - the strategic baseline';
COMMENT ON TABLE platform_assignment_rules IS 'Rules for assigning content types to Instagram vs Facebook';
COMMENT ON FUNCTION get_content_distribution IS 'Get the content strategy for a business type';
COMMENT ON FUNCTION generate_weekly_post_slots IS 'Generate a weekly post plan with suggested content types and platforms';

-- =====================================================
-- VALIDATION QUERY
-- =====================================================
-- Check that percentages sum to ~100% per business type
DO $$
DECLARE
  rec RECORD;
  total DECIMAL;
BEGIN
  FOR rec IN SELECT DISTINCT business_type FROM content_distribution_rules LOOP
    SELECT SUM(baseline_percentage) INTO total
    FROM content_distribution_rules
    WHERE business_type = rec.business_type;
    
    IF total < 95 OR total > 105 THEN
      RAISE WARNING 'Business type % percentages sum to % (should be ~100)', rec.business_type, total;
    ELSE
      RAISE NOTICE 'Business type % percentages validated: %', rec.business_type, total;
    END IF;
  END LOOP;
END $$;
