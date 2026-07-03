


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."business_archetype_enum" AS ENUM (
    'fine_dining',
    'casual_dining',
    'cafe_bistro',
    'cafe_bar',
    'restaurant_bar',
    'wine_bar',
    'coffee_shop',
    'quick_service',
    'bakery',
    'morning_cafe',
    'brunch_cafe',
    'all_day_cafe',
    'lunch_restaurant',
    'dinner_restaurant',
    'full_service_restaurant',
    'evening_bar',
    'late_night_bar',
    'nightlife_bar',
    'brunch_specialist',
    'fast_casual'
);


ALTER TYPE "public"."business_archetype_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."backfill_menu_normalization"("p_limit" integer DEFAULT NULL::integer) RETURNS TABLE("menu_result_id" "uuid", "business_id" "uuid", "items_normalized" integer, "status" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_result RECORD;
  v_items_before INTEGER;
  v_items_after INTEGER;
BEGIN
  FOR v_result IN 
    SELECT mr.id, mr.business_id, mr.structured_data, mr.sha256
    FROM menu_results_v2 mr
    WHERE mr.status = 'done'
      AND mr.structured_data IS NOT NULL
      AND mr.structured_data->'categories' IS NOT NULL
    ORDER BY mr.completed_at DESC
    LIMIT COALESCE(p_limit, 999999)
  LOOP
    BEGIN
      -- Count items before
      SELECT COUNT(*) INTO v_items_before
      FROM menu_items_normalized min
      WHERE min.menu_result_id = v_result.id;
      
      -- Force trigger execution by cycling status
      -- Step 1: Change status away from 'done'
      UPDATE menu_results_v2 
      SET status = 'processing'
      WHERE id = v_result.id;
      
      -- Step 2: Change status back to 'done' to trigger normalization
      UPDATE menu_results_v2 
      SET status = 'done'
      WHERE id = v_result.id;
      
      -- Count items after
      SELECT COUNT(*) INTO v_items_after
      FROM menu_items_normalized min
      WHERE min.menu_result_id = v_result.id;
      
      RETURN QUERY SELECT 
        v_result.id,
        v_result.business_id,
        v_items_after,
        'success'::TEXT;
        
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT 
        v_result.id,
        v_result.business_id,
        0,
        FORMAT('error: %s', SQLERRM)::TEXT;
    END;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."backfill_menu_normalization"("p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."backfill_menu_normalization"("p_limit" integer) IS 'Backfill normalization for existing menu_results_v2 rows. Usage: SELECT * FROM backfill_menu_normalization(10);';



CREATE OR REPLACE FUNCTION "public"."check_ai_generation_quota"("user_id" "uuid") RETURNS TABLE("allowed" boolean, "current_daily" integer, "current_monthly" integer, "tier" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_plan TEXT;
  daily_count INTEGER;
  monthly_count INTEGER;
BEGIN
  -- Get user's current usage and plan
  SELECT plan, ai_generations_today, ai_generations_this_month
  INTO user_plan, daily_count, monthly_count
  FROM public.profiles
  WHERE id = user_id;
  
  -- Return quota check result
  -- (Limits enforced in Edge Functions using quotas.ts)
  RETURN QUERY SELECT 
    TRUE as allowed,  -- Edge Functions will enforce actual limits
    daily_count as current_daily,
    monthly_count as current_monthly,
    user_plan as tier;
END;
$$;


ALTER FUNCTION "public"."check_ai_generation_quota"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_ai_generation_quota_business"("business_uuid" "uuid") RETURNS TABLE("allowed" boolean, "current_daily" integer, "current_monthly" integer, "tier" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  business_plan TEXT;
  daily_count INTEGER;
  monthly_count INTEGER;
BEGIN
  -- Get business usage and plan
  SELECT plan, ai_generations_today, ai_generations_this_month
  INTO business_plan, daily_count, monthly_count
  FROM public.businesses
  WHERE id = business_uuid;
  
  -- Return quota check result
  RETURN QUERY SELECT 
    TRUE as allowed,  -- Edge Functions will enforce actual limits
    daily_count as current_daily,
    monthly_count as current_monthly,
    COALESCE(business_plan, 'free') as tier;
END;
$$;


ALTER FUNCTION "public"."check_ai_generation_quota_business"("business_uuid" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."menu_results_v2" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "source_kind" "text" DEFAULT 'url'::"text" NOT NULL,
    "source_url" "text",
    "source_content_type" "text",
    "storage_bucket" "text",
    "storage_path" "text",
    "sha256" "text",
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "language_code" "text" DEFAULT 'da'::"text",
    "attempts" integer DEFAULT 0 NOT NULL,
    "claimed_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "extraction_method" "text",
    "raw_text" "text",
    "structured_data" "jsonb",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "source_id" "uuid",
    "service_periods" "text"[],
    "service_period_name" "text",
    "is_signature" boolean DEFAULT false,
    "ai_summary" "text",
    "representative_dishes" "jsonb",
    "menu_type" "text",
    "time_start" "text",
    "time_end" "text",
    "time_source" "text",
    "time_confirmed" boolean DEFAULT false,
    CONSTRAINT "menu_results_v2_source_kind_check" CHECK (("source_kind" = ANY (ARRAY['url'::"text", 'storage'::"text"]))),
    CONSTRAINT "menu_results_v2_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'processing'::"text", 'done'::"text", 'error'::"text"]))),
    CONSTRAINT "menu_results_v2_storage_ref_check" CHECK ((("source_kind" <> 'storage'::"text") OR (("storage_bucket" IS NOT NULL) AND ("storage_path" IS NOT NULL)))),
    CONSTRAINT "menu_results_v2_url_ref_check" CHECK ((("source_kind" <> 'url'::"text") OR ("source_url" IS NOT NULL))),
    CONSTRAINT "time_end_format" CHECK ((("time_end" ~ '^([0-1][0-9]|2[0-3]):[0-5][0-9]$'::"text") OR ("time_end" IS NULL))),
    CONSTRAINT "time_start_format" CHECK ((("time_start" ~ '^([0-1][0-9]|2[0-3]):[0-5][0-9]$'::"text") OR ("time_start" IS NULL)))
);


ALTER TABLE "public"."menu_results_v2" OWNER TO "postgres";


COMMENT ON COLUMN "public"."menu_results_v2"."source_id" IS 'References menu_sources.id - which menu source this extraction result belongs to';



COMMENT ON COLUMN "public"."menu_results_v2"."service_periods" IS 'Array of service periods when this menu is available: brunch, lunch, dinner';



COMMENT ON COLUMN "public"."menu_results_v2"."service_period_name" IS 'Primary service period name for this menu (single value)';



COMMENT ON COLUMN "public"."menu_results_v2"."is_signature" IS 'Whether this menu contains signature/featured dishes';



COMMENT ON COLUMN "public"."menu_results_v2"."ai_summary" IS 'AI-generated 5-bullet helicopter summary of this menu, used in Phase 0 strategy prompts. Generated once after extraction completes.';



COMMENT ON COLUMN "public"."menu_results_v2"."representative_dishes" IS 'AI-selected 1-3 representative dishes from this menu. Used by voice profile generation. Structure: {"dishes": [{"name": "...", "description": "...", "category": "...", "price": 123, "currency": "DKK", "selection_reason": "signature|main_course|identity"}]}';



COMMENT ON COLUMN "public"."menu_results_v2"."menu_type" IS 'Canonical menu type: lunch|brunch|dinner|all_day|coffee|wine|cocktail|beer|bakery|bar_snacks|drinks|other';



COMMENT ON COLUMN "public"."menu_results_v2"."time_start" IS 'When this menu starts being served (HH:MM format). From menu text or opening hours.';



COMMENT ON COLUMN "public"."menu_results_v2"."time_end" IS 'When this menu stops being served (HH:MM format). From menu text or opening hours.';



COMMENT ON COLUMN "public"."menu_results_v2"."time_source" IS 'Timing source: menu_text | opening_hours_fallback | user_override';



COMMENT ON COLUMN "public"."menu_results_v2"."time_confirmed" IS 'True when user has verified or manually edited timing.';



CREATE OR REPLACE FUNCTION "public"."claim_menu_result_v2"() RETURNS "public"."menu_results_v2"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  claimed public.menu_results_v2;
BEGIN
  WITH next_job AS (
    SELECT id
    FROM public.menu_results_v2
    WHERE status = 'queued'
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE public.menu_results_v2 mr
  SET
    status = 'processing',
    claimed_at = now(),
    attempts = mr.attempts + 1
  WHERE mr.id IN (SELECT id FROM next_job)
  RETURNING mr.* INTO claimed;

  RETURN claimed;
END;
$$;


ALTER FUNCTION "public"."claim_menu_result_v2"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."classify_category_type"("category_name" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  category_name := LOWER(category_name);
  
  -- Kids menu
  IF category_name LIKE '%børnemenu%' OR category_name LIKE '%kids%' OR category_name LIKE '%children%' THEN
    RETURN 'kids_menu';
  END IF;
  
  -- Desserts
  IF category_name LIKE '%dessert%' OR category_name LIKE '%desserter%' OR category_name LIKE '%kage%' OR category_name LIKE '%cake%' THEN
    RETURN 'dessert';
  END IF;
  
  -- Appetizers
  IF category_name LIKE '%forretter%' OR category_name LIKE '%appetizer%' OR category_name LIKE '%starter%' THEN
    RETURN 'appetizer';
  END IF;
  
  -- Sides/extras
  IF category_name LIKE '%tilbehør%' OR category_name LIKE '%sides%' OR category_name LIKE '%ekstra%' OR category_name LIKE '%tilvalg%' THEN
    RETURN 'sides';
  END IF;
  
  -- Default: main course
  RETURN 'main';
END;
$$;


ALTER FUNCTION "public"."classify_category_type"("category_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."classify_category_type"("category_name" "text") IS 'Automatically classify menu category type from name for filtering';



CREATE OR REPLACE FUNCTION "public"."classify_media_category"("category_name" "text", "item_name" "text", "item_description" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  v_text TEXT := LOWER(CONCAT_WS(' ', category_name, item_name, item_description));
  v_category_lower TEXT := LOWER(COALESCE(category_name, ''));
  v_normalized_text TEXT := ' ' || regexp_replace(v_text, '[^[:alnum:]]+', ' ', 'g') || ' ';
  v_drink_categories TEXT[] := ARRAY[
    'cocktail', 'mocktail', 'drink', 'beverage', 'apéritif', 'aperitif', 'bar', 'spirits'
  ];
  v_food_categories TEXT[] := ARRAY[
    'brunch', 'lunch', 'dinner', 'breakfast', 'main', 'forretter', 'appetizer', 'starter',
    'dessert', 'salad', 'classic', 'smørrebrød'
  ];
  v_drink_phrases TEXT[] := ARRAY[
    'still water', 'sparkling water', 'mineral water', 'draft beer', 'draught beer',
    'tap beer', 'cold brew', 'iced coffee', 'hot chocolate', 'non alcoholic'
  ];
  v_drink_keywords TEXT[] := ARRAY[
    'beer', 'wine', 'cocktail', 'mocktail', 'spirits', 'liquor', 'gin', 'vodka', 'rum', 'whisky', 'whiskey',
    'tequila', 'aperitif', 'aperitivo', 'prosecco', 'champagne', 'cider', 'ale', 'lager', 'stout', 'ipa', 'espresso',
    'coffee', 'cappuccino', 'latte', 'americano', 'macchiato', 'tea', 'matcha', 'juice', 'smoothie', 'milkshake',
    'shake', 'soda', 'cola', 'lemonade', 'tonic', 'kombucha', 'chai', 'spritz', 'martini', 'negroni', 'mojito',
    'margarita', 'bloody mary'
  ];
BEGIN
  IF v_text IS NULL OR TRIM(v_text) = '' THEN
    RETURN NULL;
  END IF;

  -- Check if category is a drink category
  IF EXISTS (
    SELECT 1
    FROM unnest(v_drink_categories) AS cat
    WHERE v_category_lower LIKE '%' || cat || '%'
  ) THEN
    RETURN 'DRINK';
  END IF;

  -- Check if category is a food category
  IF EXISTS (
    SELECT 1
    FROM unnest(v_food_categories) AS cat
    WHERE v_category_lower LIKE '%' || cat || '%'
  ) THEN
    RETURN 'FOOD';
  END IF;

  -- Fall back to keyword matching
  IF EXISTS (
    SELECT 1
    FROM unnest(v_drink_phrases) AS phrase
    WHERE v_normalized_text LIKE '% ' || phrase || ' %'
  ) THEN
    RETURN 'DRINK';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_drink_keywords) AS keyword
    WHERE v_normalized_text LIKE '% ' || keyword || ' %'
  ) THEN
    RETURN 'DRINK';
  END IF;

  RETURN 'FOOD';
END;
$$;


ALTER FUNCTION "public"."classify_media_category"("category_name" "text", "item_name" "text", "item_description" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."classify_media_category"("category_name" "text", "item_name" "text", "item_description" "text") IS 'Classify a menu item as FOOD or DRINK when the signal is clear; otherwise return NULL';



CREATE OR REPLACE FUNCTION "public"."cleanup_expired_weather_cache"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM weather_cache WHERE expires_at < NOW();
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_weather_cache"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_archived_posts"("days_old" integer DEFAULT 90) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.suggested_posts
  WHERE status = 'archived'
    AND updated_at < NOW() - (days_old || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_archived_posts"("days_old" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_daily_suggestions"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM daily_suggestions
  WHERE suggestion_date < CURRENT_DATE - INTERVAL '7 days';
END;
$$;


ALTER FUNCTION "public"."cleanup_old_daily_suggestions"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_old_daily_suggestions"() IS 'Deletes daily_suggestions older than 7 days. Run daily via cron.';



CREATE OR REPLACE FUNCTION "public"."create_business_onboarding"("p_user_id" "uuid", "p_business_name" "text", "p_selected_platforms" "text"[]) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_business_id UUID;
BEGIN
  -- Create business record with minimal fields
  INSERT INTO public.businesses (
    owner_id,
    name,
    primary_language,
    plan,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    COALESCE(NULLIF(p_business_name, ''), 'My Business'),
    'da', -- Danish default
    'free', -- Free tier by default
    NOW(),
    NOW()
  )
  RETURNING id INTO v_business_id;

  -- Store selected platforms in profiles
  UPDATE public.profiles
  SET
    selected_platforms = to_jsonb(COALESCE(NULLIF(p_selected_platforms, ARRAY[]::TEXT[]), ARRAY['facebook'])),
    onboarding_completed = TRUE,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN v_business_id;
END;
$$;


ALTER FUNCTION "public"."create_business_onboarding"("p_user_id" "uuid", "p_business_name" "text", "p_selected_platforms" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deactivate_old_suggestions"("p_business_id" "uuid", "p_date" "date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RAISE NOTICE 'deactivate_old_suggestions is deprecated and now a no-op for business % on %', p_business_id, p_date;
END;
$$;


ALTER FUNCTION "public"."deactivate_old_suggestions"("p_business_id" "uuid", "p_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."deactivate_old_suggestions"("p_business_id" "uuid", "p_date" "date") IS 'Deactivates suggestions for a business/date and deletes associated post_drafts. Published/scheduled posts are unaffected since they live in published_posts table.';



CREATE OR REPLACE FUNCTION "public"."deduplicate_menu_items"("p_business_id" "uuid") RETURNS TABLE("item_name" "text", "old_ids" "uuid"[], "canonical_id" "uuid", "suggestions_updated" integer, "posts_updated" integer)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_duplicate RECORD;
  v_canonical_id UUID;
  v_old_ids UUID[];
  v_suggestions_updated INT;
  v_posts_updated INT;
BEGIN
  -- Find all duplicates for this business
  FOR v_duplicate IN
    SELECT 
      UPPER(TRIM(min.item_name)) as normalized_name,
      ARRAY_AGG(min.id ORDER BY min.created_at DESC) as ids
    FROM menu_items_normalized min
    WHERE min.business_id = p_business_id
    GROUP BY UPPER(TRIM(min.item_name))
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the most recent (first in array), delete the rest
    v_canonical_id := v_duplicate.ids[1];
    v_old_ids := v_duplicate.ids[2:array_length(v_duplicate.ids, 1)];
    
    -- Update daily_suggestions to use canonical ID
    UPDATE daily_suggestions
    SET menu_item_id = v_canonical_id
    WHERE business_id = p_business_id
      AND menu_item_id = ANY(v_old_ids);
    GET DIAGNOSTICS v_suggestions_updated = ROW_COUNT;
    
    -- Update published_posts to use canonical ID
    UPDATE published_posts
    SET menu_item_id = v_canonical_id
    WHERE business_id = p_business_id
      AND menu_item_id = ANY(v_old_ids);
    GET DIAGNOSTICS v_posts_updated = ROW_COUNT;
    
    -- Delete old duplicate entries
    DELETE FROM menu_items_normalized
    WHERE id = ANY(v_old_ids);
    
    -- Return result row
    item_name := v_duplicate.normalized_name;
    old_ids := v_old_ids;
    canonical_id := v_canonical_id;
    suggestions_updated := v_suggestions_updated;
    posts_updated := v_posts_updated;
    RETURN NEXT;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."deduplicate_menu_items"("p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_user_account"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  user_id_to_delete uuid;
  request_id bigint;
BEGIN
  -- Get the current user's ID
  user_id_to_delete := auth.uid();
  
  -- Check if user is authenticated
  IF user_id_to_delete IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete user's data from all tables
  -- Add your table deletions here as needed
  DELETE FROM public.profiles WHERE id = user_id_to_delete;
  
  -- Note: Deleting from auth.users requires service_role privileges
  -- This must be done via an Edge Function or admin API
  -- For now, we'll use the admin deleteUser method from the client
  
  RETURN json_build_object(
    'success', true, 
    'message', 'User data deleted successfully',
    'user_id', user_id_to_delete
  );
END;
$$;


ALTER FUNCTION "public"."delete_user_account"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_user_account"() IS 'Allows authenticated users to delete their own account and all associated data';



CREATE OR REPLACE FUNCTION "public"."exec_sql"("query" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  EXECUTE query;
END;
$$;


ALTER FUNCTION "public"."exec_sql"("query" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_daily_usage_stats"("p_business_id" "uuid", "p_date" "date" DEFAULT CURRENT_DATE) RETURNS TABLE("regenerations_used" integer, "regenerations_limit" integer, "suggestions_count" integer, "suggestions_selected" integer, "texts_generated" integer, "tier" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_daily_usage_stats"("p_business_id" "uuid", "p_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_daily_usage_stats"("p_business_id" "uuid", "p_date" "date") IS 'Get daily usage statistics with automatic midnight reset. TESTING MODE: All tiers = 100.';



CREATE OR REPLACE FUNCTION "public"."get_user_business_id"("user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  business_uuid UUID;
BEGIN
  -- Get business ID (as owner)
  SELECT id INTO business_uuid
  FROM public.businesses
  WHERE owner_id = user_id;
  
  -- If not owner, check if they're a team member
  IF business_uuid IS NULL THEN
    SELECT b.id INTO business_uuid
    FROM public.businesses b
    JOIN public.business_team_members btm ON b.id = btm.business_id
    WHERE btm.user_id = user_id
    AND btm.accepted_at IS NOT NULL;
  END IF;
  
  RETURN business_uuid;
END;
$$;


ALTER FUNCTION "public"."get_user_business_id"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_business_tier"("user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  business_tier TEXT;
BEGIN
  -- Get tier from user's business (as owner)
  SELECT plan INTO business_tier
  FROM public.businesses
  WHERE owner_id = user_id;
  
  -- If not owner, check if they're a team member
  IF business_tier IS NULL THEN
    SELECT b.plan INTO business_tier
    FROM public.businesses b
    JOIN public.business_team_members btm ON b.id = btm.business_id
    WHERE btm.user_id = user_id
    AND btm.accepted_at IS NOT NULL;
  END IF;
  
  -- Default to free if no business found
  RETURN COALESCE(business_tier, 'free');
END;
$$;


ALTER FUNCTION "public"."get_user_business_tier"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_business_access"("business_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    public.is_business_owner(business_uuid)
    OR public.is_team_member(business_uuid)
  );
END;
$$;


ALTER FUNCTION "public"."has_business_access"("business_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_ai_generation"("user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Reset if needed
  PERFORM reset_daily_quotas();
  PERFORM reset_monthly_quotas();
  
  -- Increment counters
  UPDATE public.profiles
  SET 
    ai_generations_today = ai_generations_today + 1,
    ai_generations_this_month = ai_generations_this_month + 1
  WHERE id = user_id;
END;
$$;


ALTER FUNCTION "public"."increment_ai_generation"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_ai_generation_business"("business_uuid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Reset if needed (business-level)
  UPDATE public.businesses
  SET 
    ai_generations_today = 0,
    pdf_uploads_today = 0,
    website_analysis_today = 0,
    last_daily_reset = CURRENT_DATE
  WHERE id = business_uuid AND last_daily_reset < CURRENT_DATE;
  
  UPDATE public.businesses
  SET 
    ai_generations_this_month = 0,
    pdf_uploads_this_month = 0,
    website_analysis_this_month = 0,
    scheduled_posts_this_month = 0,
    last_monthly_reset = DATE_TRUNC('month', CURRENT_DATE)
  WHERE id = business_uuid AND last_monthly_reset < DATE_TRUNC('month', CURRENT_DATE);
  
  -- Increment counters
  UPDATE public.businesses
  SET 
    ai_generations_today = ai_generations_today + 1,
    ai_generations_this_month = ai_generations_this_month + 1
  WHERE id = business_uuid;
END;
$$;


ALTER FUNCTION "public"."increment_ai_generation_business"("business_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_media_usage"("media_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE media_library
  SET 
    usage_count = usage_count + 1,
    last_used_date = NOW(),
    updated_at = NOW()
  WHERE id = media_id;
END;
$$;


ALTER FUNCTION "public"."increment_media_usage"("media_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_business_owner"("business_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.businesses
    WHERE id = business_uuid
    AND owner_id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."is_business_owner"("business_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_team_member"("business_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.business_team_members
    WHERE business_id = business_uuid
    AND user_id = auth.uid()
    AND accepted_at IS NOT NULL
  );
END;
$$;


ALTER FUNCTION "public"."is_team_member"("business_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_text_generation"("p_suggestion_id" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE daily_suggestions
  SET 
    text_generated_count = COALESCE(text_generated_count, 0) + 1,
    first_text_generated_at = COALESCE(first_text_generated_at, NOW()),
    last_text_generated_at = NOW()
  WHERE id = p_suggestion_id;
END;
$$;


ALTER FUNCTION "public"."record_text_generation"("p_suggestion_id" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."record_text_generation"("p_suggestion_id" integer) IS 'Record when text is generated from a suggestion, increments counter and updates timestamps';



CREATE OR REPLACE FUNCTION "public"."requeue_stale_menu_results_v2"("max_age_minutes" integer DEFAULT 10) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.menu_results_v2
  SET
    status = 'queued',
    claimed_at = NULL,
    -- Keep attempts as-is; it is incremented on the next successful claim
    extraction_method = COALESCE(extraction_method, 'stale_requeue')
  WHERE status = 'processing'
    AND claimed_at IS NOT NULL
    AND claimed_at < (now() - make_interval(mins => GREATEST(max_age_minutes, 1)));

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;


ALTER FUNCTION "public"."requeue_stale_menu_results_v2"("max_age_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_daily_quotas"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.profiles
  SET 
    ai_generations_today = 0,
    pdf_uploads_today = 0,
    website_analysis_today = 0,
    last_daily_reset = CURRENT_DATE
  WHERE last_daily_reset < CURRENT_DATE;
END;
$$;


ALTER FUNCTION "public"."reset_daily_quotas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_monthly_quotas"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.profiles
  SET 
    ai_generations_this_month = 0,
    pdf_uploads_this_month = 0,
    website_analysis_this_month = 0,
    scheduled_posts_this_month = 0,
    last_monthly_reset = DATE_TRUNC('month', CURRENT_DATE)
  WHERE last_monthly_reset < DATE_TRUNC('month', CURRENT_DATE);
END;
$$;


ALTER FUNCTION "public"."reset_monthly_quotas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_menu_items_normalized"("p_business_id" "uuid" DEFAULT NULL::"uuid", "p_menu_result_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("synced_count" integer, "deleted_count" integer, "business_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_synced_count INTEGER := 0;
  v_deleted_count INTEGER := 0;
  v_business_count INTEGER := 0;
  v_menu_record RECORD;
  v_category JSONB;
  v_item JSONB;
  v_category_name TEXT;
  v_category_type TEXT;
BEGIN
  -- Track unique businesses processed
  CREATE TEMP TABLE IF NOT EXISTS processed_businesses (business_id UUID);
  
  -- Loop through menu_results_v2 records
  FOR v_menu_record IN
    SELECT 
      mr.id as menu_result_id,
      mr.business_id,
      mr.structured_data,
      mr.service_periods,
      mr.service_period_name,
      mr.is_signature,
      mr.source_url as menu_url,
      mr.sha256,
      mr.completed_at
    FROM menu_results_v2 mr
    WHERE mr.structured_data IS NOT NULL
      AND (p_business_id IS NULL OR mr.business_id = p_business_id)
      AND (p_menu_result_id IS NULL OR mr.id = p_menu_result_id)
      AND mr.status IN ('completed', 'done')
  LOOP
    -- Track business
    INSERT INTO processed_businesses (business_id) 
    VALUES (v_menu_record.business_id) 
    ON CONFLICT DO NOTHING;
    
    -- Delete existing items for this menu (allows clean re-sync)
    DELETE FROM menu_items_normalized 
    WHERE menu_result_id = v_menu_record.menu_result_id;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    -- Extract categories and items from JSONB
    IF v_menu_record.structured_data ? 'categories' THEN
      FOR v_category IN 
        SELECT * FROM jsonb_array_elements(v_menu_record.structured_data->'categories')
      LOOP
        v_category_name := v_category->>'name';
        
        -- Infer category type from name
        v_category_type := CASE
          WHEN v_category_name ILIKE '%børn%' OR v_category_name ILIKE '%kids%' THEN 'kids_menu'
          WHEN v_category_name ILIKE '%dessert%' OR v_category_name ILIKE '%kage%' THEN 'dessert'
          WHEN v_category_name ILIKE '%forret%' OR v_category_name ILIKE '%starter%' THEN 'appetizer'
          WHEN v_category_name ILIKE '%tilbehør%' OR v_category_name ILIKE '%sides%' THEN 'sides'
          ELSE 'main'
        END;
        
        -- Extract items from category
        IF v_category ? 'items' THEN
          FOR v_item IN 
            SELECT * FROM jsonb_array_elements(v_category->'items')
          LOOP
            -- Only insert items with a name
            IF v_item ? 'name' AND (v_item->>'name') IS NOT NULL THEN
              INSERT INTO menu_items_normalized (
                business_id,
                menu_result_id,
                item_name,
                item_description,
                item_price,
                category_name,
                category_type,
                service_periods,
                service_period_name,
                menu_url,
                is_signature,
                source_sha256,
                synced_at
              ) VALUES (
                v_menu_record.business_id,
                v_menu_record.menu_result_id,
                v_item->>'name',
                v_item->>'description',
                v_item->>'price',
                v_category_name,
                v_category_type,
                COALESCE(v_menu_record.service_periods, ARRAY[]::TEXT[]),
                v_menu_record.service_period_name,
                v_menu_record.menu_url,
                COALESCE(v_menu_record.is_signature, false),
                v_menu_record.sha256,
                NOW()
              )
              ON CONFLICT (menu_result_id, item_name, category_name) 
              DO UPDATE SET
                item_description = EXCLUDED.item_description,
                item_price = EXCLUDED.item_price,
                service_periods = EXCLUDED.service_periods,
                service_period_name = EXCLUDED.service_period_name,
                is_signature = EXCLUDED.is_signature,
                source_sha256 = EXCLUDED.source_sha256,
                synced_at = NOW(),
                updated_at = NOW();
              
              v_synced_count := v_synced_count + 1;
            END IF;
          END LOOP;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
  
  -- Count unique businesses
  SELECT COUNT(*) INTO v_business_count FROM processed_businesses;
  
  -- Clean up temp table
  DROP TABLE IF EXISTS processed_businesses;
  
  RETURN QUERY SELECT v_synced_count, v_deleted_count, v_business_count;
END;
$$;


ALTER FUNCTION "public"."sync_menu_items_normalized"("p_business_id" "uuid", "p_menu_result_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_menu_items_normalized"("p_business_id" "uuid", "p_menu_result_id" "uuid") IS 'Syncs menu items from menu_results_v2.structured_data to menu_items_normalized table. 
  Call with no params to sync all businesses, or specify business_id/menu_result_id to sync specific records.
  Returns (synced_count, deleted_count, business_count).';



CREATE OR REPLACE FUNCTION "public"."sync_menu_items_to_normalized"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_category JSONB;
  v_item JSONB;
  v_category_name TEXT;
  v_category_type TEXT;
  v_service_periods TEXT[];
  v_menu_title TEXT;
  v_item_count INTEGER := 0;
  v_error_context TEXT;
BEGIN
  -- Only process when status changes to 'done' and we have structured data
  IF NEW.status != 'done' OR NEW.structured_data IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if already normalized (idempotent - check by source SHA)
  IF EXISTS (
    SELECT 1 FROM menu_items_normalized 
    WHERE menu_result_id = NEW.id 
      AND source_sha256 = NEW.sha256
    LIMIT 1
  ) THEN
    RAISE NOTICE 'Menu result % already normalized (SHA: %)', NEW.id, NEW.sha256;
    RETURN NEW;
  END IF;

  -- Soft-delete old normalized items from this URL (handles re-extraction)
  -- When restaurant updates their menu (same URL, new content), we need to deactivate old items
  UPDATE menu_items_normalized 
  SET is_active = false 
  WHERE menu_url = NEW.source_url 
    AND is_active = true;
  
  -- Extract menu title from structured data
  v_menu_title := NEW.structured_data->>'menuTitle';
  
  -- Build service_periods array from multiple sources (priority order)
  v_service_periods := ARRAY[]::TEXT[];
  
  -- Priority 1: Use parent menu_results_v2.service_periods (already parsed by parseMenuPeriods)
  IF NEW.service_periods IS NOT NULL AND ARRAY_LENGTH(NEW.service_periods, 1) > 0 THEN
    v_service_periods := NEW.service_periods;
  END IF;
  
  -- Priority 2: Infer from menu title pattern matching (fallback only)
  IF v_service_periods IS NULL OR ARRAY_LENGTH(v_service_periods, 1) IS NULL THEN
    IF v_menu_title IS NOT NULL THEN
      CASE 
        WHEN LOWER(v_menu_title) LIKE '%brunch%' THEN v_service_periods := ARRAY['brunch'];
        WHEN LOWER(v_menu_title) LIKE '%morgenmad%' OR LOWER(v_menu_title) LIKE '%breakfast%' THEN v_service_periods := ARRAY['breakfast'];
        WHEN LOWER(v_menu_title) LIKE '%frokost%' OR LOWER(v_menu_title) LIKE '%lunch%' THEN v_service_periods := ARRAY['lunch'];
        WHEN LOWER(v_menu_title) LIKE '%aften%' OR LOWER(v_menu_title) LIKE '%dinner%' THEN v_service_periods := ARRAY['dinner'];
        WHEN LOWER(v_menu_title) LIKE '%bar%' OR LOWER(v_menu_title) LIKE '%cocktail%' THEN v_service_periods := ARRAY['bar'];
        ELSE v_service_periods := ARRAY[]::TEXT[];
      END CASE;
    ELSE
      v_service_periods := ARRAY[]::TEXT[];
    END IF;
  END IF;
  
  -- Default to empty array if still null
  IF v_service_periods IS NULL THEN
    v_service_periods := ARRAY[]::TEXT[];
  END IF;

  -- Iterate through categories and items
  IF NEW.structured_data->'categories' IS NOT NULL THEN
    FOR v_category IN SELECT * FROM JSONB_ARRAY_ELEMENTS(NEW.structured_data->'categories')
    LOOP
      BEGIN
        v_category_name := v_category->>'name';
        
        -- Skip if category has no name
        IF v_category_name IS NULL OR TRIM(v_category_name) = '' THEN
          CONTINUE;
        END IF;
        
        -- Classify category type using existing function
        v_category_type := classify_category_type(v_category_name);
        
        -- Iterate through items in this category
        IF v_category->'items' IS NOT NULL THEN
          FOR v_item IN SELECT * FROM JSONB_ARRAY_ELEMENTS(v_category->'items')
          LOOP
            BEGIN
              -- Skip items without a name
              IF v_item->>'name' IS NULL OR TRIM(v_item->>'name') = '' THEN
                CONTINUE;
              END IF;
              
              INSERT INTO menu_items_normalized (
                business_id,
                menu_result_id,
                item_name,
                item_description,
                item_price,
                category_name,
                category_type,
                service_periods,
                service_period_name,
                menu_title,
                menu_url,
                is_signature,
                is_seasonal,
                is_limited_time,
                dish_temp_category,
                source_sha256,
                synced_at
              ) VALUES (
                NEW.business_id,
                NEW.id,
                TRIM(v_item->>'name'),
                TRIM(v_item->>'description'),
                v_item->>'price',
                v_category_name,
                v_category_type,
                v_service_periods,
                NEW.service_period_name,
                v_menu_title,
                NEW.source_url,
                COALESCE((v_item->>'isSignature')::BOOLEAN, false),
                COALESCE((v_item->>'isSeasonal')::BOOLEAN, false),
                COALESCE((v_item->>'isLimitedTime')::BOOLEAN, false),
                COALESCE(v_item->>'dishTempCategory', NULL),
                NEW.sha256,
                NOW()
              );
              
              v_item_count := v_item_count + 1;
              
            EXCEPTION
              WHEN OTHERS THEN
                v_error_context := format('Item: %s in category: %s', v_item->>'name', v_category_name);
                RAISE WARNING 'Failed to normalize item: %. Error: %', v_error_context, SQLERRM;
                CONTINUE;
            END;
          END LOOP;
        END IF;
        
      EXCEPTION
        WHEN OTHERS THEN
          v_error_context := format('Category: %s', v_category_name);
          RAISE WARNING 'Failed to process category: %. Error: %', v_error_context, SQLERRM;
          CONTINUE;
      END;
    END LOOP;
  END IF;

  RAISE NOTICE 'Normalized % items from menu result %', v_item_count, NEW.id;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_menu_items_to_normalized"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_menu_items_to_normalized"() IS 'Automatically flattens menu_results_v2.structured_data into menu_items_normalized rows when extraction completes';



CREATE OR REPLACE FUNCTION "public"."update_business_programme_profiles_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_business_programme_profiles_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_menu_results_v2_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_menu_results_v2_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_post_drafts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_post_drafts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_posts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_posts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_profile_onboarding"("p_user_id" "uuid", "p_business_name" "text", "p_business_category" "text", "p_address" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.profiles
  SET 
    business_name = p_business_name,
    business_category = p_business_category,
    address = p_address,
    onboarding_completed = true,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."update_profile_onboarding"("p_user_id" "uuid", "p_business_name" "text", "p_business_category" "text", "p_address" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_profile_onboarding"("p_user_id" "uuid", "p_business_name" "text", "p_business_category" "text", "p_address" "text", "p_selected_platforms" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.profiles
  SET 
    business_name = p_business_name,
    business_category = p_business_category,
    address = p_address,
    selected_platforms = p_selected_platforms,
    onboarding_completed = true,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."update_profile_onboarding"("p_user_id" "uuid", "p_business_name" "text", "p_business_category" "text", "p_address" "text", "p_selected_platforms" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_suggested_posts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_suggested_posts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_brand_profile" (
    "business_id" "uuid" NOT NULL,
    "tone_keywords" "text"[],
    "certifications" "text"[],
    "do_not_say" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "booking_link" "text",
    "cta_preference" "text",
    "primary_copy_hook" "text",
    "business_character" "text",
    "brand_profile_v5" "jsonb",
    "brand_profile_v5_generated_at" timestamp with time zone,
    "brand_profile_v5_version" "text" DEFAULT '5.0'::"text",
    "brand_essence" "text",
    "positioning" "text",
    "core_values" "text"[],
    "what_makes_us_different" "text",
    "identity_confidence" numeric(3,2),
    "identity_reasoning" "text",
    "menu_overview_summary" "jsonb",
    "gastronomic_profile" "text",
    "signature_themes" "text"[],
    "core_offerings" "text"[],
    "target_type_mix" "jsonb" DEFAULT '{"product": 0.35, "occasion": 0.25, "retention": 0.10, "experience": 0.30}'::"jsonb",
    "revenue_drivers" "jsonb",
    "posting_strategy" "jsonb",
    "busy_pattern" "jsonb",
    "tone_of_voice" "text",
    "content_focus" "text",
    "communication_goal" "text",
    "target_audience" "text",
    "content_pillars" "text",
    "things_to_avoid" "text",
    "image_preferences" "text",
    "identity_keywords" "text",
    "voice_constraints" "text",
    "voice_rationale" "text",
    "audience_framework" "jsonb",
    "voice_system" "jsonb",
    "content_strategy" "jsonb",
    "posting_occasions" "jsonb",
    "posting_occasions_hash" "text",
    "things_to_avoid_jsonb" "jsonb",
    "image_preferences_jsonb" "jsonb",
    "core_offerings_jsonb" "jsonb",
    "social_style" "jsonb",
    "voice_examples" "jsonb",
    "tone_model" "jsonb",
    "generation_errors" "jsonb",
    "version_hash" "text",
    "location_intelligence" "jsonb",
    "typical_openings" "text"[],
    "commercial_baseline_mode" "text",
    "trigger_configuration" "jsonb",
    "trigger_updated_by" "text",
    "trigger_updated_at" timestamp with time zone,
    "audience_segments" "jsonb",
    "business_archetype" "public"."business_archetype_enum",
    "enhanced_social_examples" "jsonb" DEFAULT '[]'::"jsonb",
    "enhanced_avoid_examples" "jsonb" DEFAULT '[]'::"jsonb",
    "social_writing_examples" "jsonb" DEFAULT '[]'::"jsonb",
    "voice_guardrails" "jsonb" DEFAULT '{}'::"jsonb",
    "business_identity_persona" "text",
    "strategic_audience_segments" "jsonb",
    "recognizable_interior_identity" "text",
    "last_edited_by" "text",
    "last_edited_at" timestamp with time zone,
    "execution_profile" "jsonb",
    "marketing_manager_brief" "text",
    "location_strategy" "jsonb",
    "generation_status" "jsonb",
    "data_sources_used" "jsonb",
    "strategic_coverage" "jsonb",
    CONSTRAINT "check_core_offerings_max_3" CHECK ((("core_offerings" IS NULL) OR ("array_length"("core_offerings", 1) IS NULL) OR ("array_length"("core_offerings", 1) <= 3))),
    CONSTRAINT "check_enhanced_avoid_examples_is_array" CHECK (("jsonb_typeof"("enhanced_avoid_examples") = 'array'::"text")),
    CONSTRAINT "check_enhanced_social_examples_is_array" CHECK (("jsonb_typeof"("enhanced_social_examples") = 'array'::"text")),
    CONSTRAINT "check_social_writing_examples_is_array" CHECK (("jsonb_typeof"("social_writing_examples") = 'array'::"text")),
    CONSTRAINT "check_strategic_audience_segments_is_object" CHECK ((("strategic_audience_segments" IS NULL) OR ("jsonb_typeof"("strategic_audience_segments") = 'object'::"text"))),
    CONSTRAINT "check_v5_has_version" CHECK ((("brand_profile_v5" IS NULL) OR (("brand_profile_v5" ->> 'version'::"text") IS NOT NULL))),
    CONSTRAINT "check_voice_guardrails_is_object" CHECK (("jsonb_typeof"("voice_guardrails") = 'object'::"text")),
    CONSTRAINT "tone_model_valid_structure_v2" CHECK ((("tone_model" IS NULL) OR (("jsonb_typeof"("tone_model") = 'object'::"text") AND ("tone_model" ? 'primary_keywords'::"text") AND ("tone_model" ? 'writing_rules'::"text") AND ("tone_model" ? 'good_examples'::"text") AND ("tone_model" ? 'avoid_examples'::"text") AND ("tone_model" ? 'formality'::"text") AND ("tone_model" ? 'emoji_level'::"text") AND ("tone_model" ? 'version'::"text") AND ("tone_model" ? 'language'::"text") AND ("tone_model" ? 'generated_at'::"text") AND ("tone_model" ? 'source'::"text") AND ("tone_model" ? 'confidence'::"text") AND ("jsonb_typeof"(("tone_model" -> 'primary_keywords'::"text")) = 'array'::"text") AND ("jsonb_typeof"(("tone_model" -> 'writing_rules'::"text")) = 'array'::"text") AND ("jsonb_typeof"(("tone_model" -> 'good_examples'::"text")) = 'array'::"text") AND ("jsonb_typeof"(("tone_model" -> 'avoid_examples'::"text")) = 'array'::"text") AND (("jsonb_array_length"(("tone_model" -> 'primary_keywords'::"text")) >= 2) AND ("jsonb_array_length"(("tone_model" -> 'primary_keywords'::"text")) <= 6)) AND (("jsonb_array_length"(("tone_model" -> 'writing_rules'::"text")) >= 3) AND ("jsonb_array_length"(("tone_model" -> 'writing_rules'::"text")) <= 8)) AND (("jsonb_array_length"(("tone_model" -> 'good_examples'::"text")) >= 2) AND ("jsonb_array_length"(("tone_model" -> 'good_examples'::"text")) <= 6)) AND (("jsonb_array_length"(("tone_model" -> 'avoid_examples'::"text")) >= 2) AND ("jsonb_array_length"(("tone_model" -> 'avoid_examples'::"text")) <= 6)) AND (("tone_model" ->> 'formality'::"text") = ANY (ARRAY['formal'::"text", 'informal'::"text", 'mixed'::"text"])) AND (("tone_model" ->> 'emoji_level'::"text") = ANY (ARRAY['none'::"text", 'minimal'::"text", 'moderate'::"text", 'frequent'::"text"])) AND (("tone_model" ->> 'source'::"text") = ANY (ARRAY['website'::"text", 'manual'::"text", 'hybrid'::"text"])) AND (("tone_model" ->> 'confidence'::"text") = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"])) AND ("length"(("tone_model" ->> 'version'::"text")) <= 10) AND (("length"(("tone_model" ->> 'language'::"text")) >= 2) AND ("length"(("tone_model" ->> 'language'::"text")) <= 5)) AND ("length"(("tone_model" ->> 'generated_at'::"text")) <= 30) AND ("length"(("tone_model" ->> 'notes'::"text")) <= 500))))
);


ALTER TABLE "public"."business_brand_profile" OWNER TO "postgres";


COMMENT ON TABLE "public"."business_brand_profile" IS 'Brand voice, tone, and communication preferences';



COMMENT ON COLUMN "public"."business_brand_profile"."booking_link" IS 'URL for booking/reservation system';



COMMENT ON COLUMN "public"."business_brand_profile"."cta_preference" IS 'Preferred call-to-action text/style';



COMMENT ON COLUMN "public"."business_brand_profile"."primary_copy_hook" IS 'Stage B0: Primary marketing hook (product | location | programme | identity)';



COMMENT ON COLUMN "public"."business_brand_profile"."business_character" IS 'AI-generated description of what the business is (prevents hallucination)';



COMMENT ON COLUMN "public"."business_brand_profile"."brand_profile_v5" IS 'V5 Brand Profile - Complete 5-layer structure in JSONB. Single source of truth.
   
   Structure:
   {
     "version": "5.0",
     "generated_at": "2026-05-09T10:00:00Z",
     "programmes": [{...}],        // Layer 1-2-4: Programme detection, commercial orientation, audience segments
     "identity": {...},            // Layer 3: Brand essence, positioning, core values
     "voice": {...},               // Layer 5a: Tone rules, personality traits, formality
     "writing_examples": {...},    // Layer 5b: Typical openings/closings, signature phrases
     "guardrails": {...}           // Layer 5c: Never say, content exclusions, factual constraints
   }
   
   REPLACES: business_programme_profiles table + individual legacy columns
   CONSUMERS: V5 Profile Reader service → Weekly Plan, Content Generation, Post Helpers';



COMMENT ON COLUMN "public"."business_brand_profile"."brand_profile_v5_generated_at" IS 'Timestamp when brand_profile_v5 was last generated. NULL if never generated.';



COMMENT ON COLUMN "public"."business_brand_profile"."brand_profile_v5_version" IS 'V5 schema version (e.g., "5.0", "5.1"). Used for forward compatibility when schema evolves.';



COMMENT ON COLUMN "public"."business_brand_profile"."brand_essence" IS 'Core brand identity - what makes the brand unique (5-star priority)';



COMMENT ON COLUMN "public"."business_brand_profile"."positioning" IS 'Layer 3: Business-level competitive differentiation (2-3 sentences)';



COMMENT ON COLUMN "public"."business_brand_profile"."core_values" IS 'Layer 3: AI-generated core values array';



COMMENT ON COLUMN "public"."business_brand_profile"."what_makes_us_different" IS 'Layer 3: AI-generated differentiation statement';



COMMENT ON COLUMN "public"."business_brand_profile"."identity_confidence" IS 'Layer 3: AI confidence score 0.00-1.00';



COMMENT ON COLUMN "public"."business_brand_profile"."identity_reasoning" IS 'Layer 3: AI reasoning for identity decisions';



COMMENT ON COLUMN "public"."business_brand_profile"."menu_overview_summary" IS 'Cross-menu summary generated by menu-overview-summary Edge Function. Contains: cross_menu_summary (text), total_items (int), total_menus (int), overall_avg_price (int), menu_breakdown (array), signature_themes (array), generated_at (timestamp)';



COMMENT ON COLUMN "public"."business_brand_profile"."gastronomic_profile" IS 'Ultra-short 1-2 sentence gastronomic identity profile (price level + style). Generated by menu-overview-summary Edge Function.';



COMMENT ON COLUMN "public"."business_brand_profile"."signature_themes" IS 'Array of extracted signature themes from menu analysis (e.g., ["Dansk tradition", "Bar-program", "All-day dining"]). Generated by menu-overview-summary Edge Function.';



COMMENT ON COLUMN "public"."business_brand_profile"."core_offerings" IS 'Primary products/services AI can reference (4-star priority)';



COMMENT ON COLUMN "public"."business_brand_profile"."target_type_mix" IS 'Target distribution of content types across all posts over time. Used for drift correction.';



COMMENT ON COLUMN "public"."business_brand_profile"."revenue_drivers" IS 'AI-analyzed revenue moments from business_about. Contains primary/secondary revenue moments, decision windows, posting strategies. Used by Weekly Plan Business Rules Engine.';



COMMENT ON COLUMN "public"."business_brand_profile"."tone_of_voice" IS 'Communication style - how AI should speak for the brand (5-star priority)';



COMMENT ON COLUMN "public"."business_brand_profile"."content_focus" IS 'Content themes and topics to emphasize (4-star priority)';



COMMENT ON COLUMN "public"."business_brand_profile"."communication_goal" IS 'Overall communication objective (4-star priority)';



COMMENT ON COLUMN "public"."business_brand_profile"."things_to_avoid" IS 'Guardrails - words, phrases, or topics AI should never use (5-star priority)';



COMMENT ON COLUMN "public"."business_brand_profile"."image_preferences" IS 'Visual style and image preferences (3-star priority)';



COMMENT ON COLUMN "public"."business_brand_profile"."content_strategy" IS 'Two-dimensional content framework:
{
  "tactical_capabilities": { "booking": boolean, "footfall": boolean },
  "tactical_focus": "drive_bookings" | "drive_footfall",
  "content_balance": { "performance_driven": 0-100, "brand_building": 0-100 },
  "brand_maturity": "new" | "growing" | "established" | "premium",
  "market_position": "leader" | "challenger" | "specialist",
  "content_category_weights": { ... existing ... },
  "goal_blend": { ... } -- DEPRECATED - kept for rollback safety
}';



COMMENT ON COLUMN "public"."business_brand_profile"."tone_model" IS 'Structured tone model v2 for AI generation with metadata. Schema: {
  -- Core tone data
  primary_keywords: string[] (2-6 core adjectives),
  writing_rules: string[] (3-8 actionable style rules),
  good_examples: string[] (2-6 positive example phrases),
  avoid_examples: string[] (2-6 negative examples with reasons),
  formality: "formal" | "informal" | "mixed",
  emoji_level: "none" | "minimal" | "moderate" | "frequent",
  
  -- Metadata (v2)
  version: string (schema version, e.g., "2.0"),
  language: string (ISO 639-1 code, e.g., "da", "en"),
  generated_at: string (ISO 8601 timestamp),
  source: "website" | "manual" | "hybrid",
  confidence: "high" | "medium" | "low",
  notes: string (optional debug info)
}';



COMMENT ON COLUMN "public"."business_brand_profile"."generation_errors" IS 'Detailed error log from generation (category, severity, message, phase)';



COMMENT ON COLUMN "public"."business_brand_profile"."version_hash" IS 'Version hash at the time this Brand Profile was generated. Links to brand_profile_sources_state.';



COMMENT ON COLUMN "public"."business_brand_profile"."business_archetype" IS 'Explicit validated business archetype - determines content strategy defaults and timing recommendations. Auto-detected during brand profile generation from service_periods, opening hours, and menu programmes. Stored persistently to ensure consistent strategy week-to-week.';



COMMENT ON COLUMN "public"."business_brand_profile"."enhanced_social_examples" IS 'Enhanced social media examples with reasoning and strategic context.
   
   Structure: Array of objects with text, why_it_works, tone_elements_demonstrated
   Example: [
     {
       "text": "Start din dag med brunch ved åen 🌅",
       "content_type": "menu_item",
       "why_it_works": ["Direct waterfront reference", "Concrete menu anchor"],
       "tone_elements_demonstrated": ["location_driver", "owner_voice"]
     }
   ]
   
   Fallback chain: enhanced_social_examples → social_writing_examples → []
   Used by: generate-text-from-idea (paid tier), ai-enhance, adjust-text';



COMMENT ON COLUMN "public"."business_brand_profile"."enhanced_avoid_examples" IS 'Enhanced avoid examples showing what NOT to write, with reasoning.
   
   Structure: Array of objects with text, why_it_fails, violates_dna_elements
   Example: [
     {
       "text": "Oplev en uforglemmelig kulinarisk rejse",
       "why_it_fails": ["Misses waterfront USP", "Hype language clashes with owner voice"],
       "violates_dna_elements": ["location_driver", "owner_voice_register"]
     }
   ]
   
   Used by: Voice validation, text generation guardrails';



COMMENT ON COLUMN "public"."business_brand_profile"."social_writing_examples" IS 'Simple social media writing examples (strings only) used as fallback.
   
   Structure: Array of strings
   Example: ["Kom forbi til brunch ved åen", "Nyd en afslappet middag"]
   
   Purpose: Lightweight fallback when enhanced_social_examples is empty
   Populated from: voice_profile.social_writing_examples during V5 generation';



COMMENT ON COLUMN "public"."business_brand_profile"."recognizable_interior_identity" IS 'CONDITIONAL FIELD: Only populated when explicit visual evidence exists (interior photos, labeled images, distinctive decor). Examples: murals, wall art, iconic figures/themes. Empty if no verified evidence. Do NOT infer or use local knowledge.';



COMMENT ON COLUMN "public"."business_brand_profile"."last_edited_by" IS 'Tracks edit source: "ai" for AI-generated content, "user" for manual edits';



COMMENT ON COLUMN "public"."business_brand_profile"."last_edited_at" IS 'Timestamp of last edit - used for lifecycle rules and regeneration logic';



COMMENT ON COLUMN "public"."business_brand_profile"."execution_profile" IS 'AI-optimized execution profile: structured brand data for post-idea generation (locale_context, micro_location_context, usage_occasions, offerings_allowlist, cta_policy, forbidden_terms, photo_rules)';



COMMENT ON COLUMN "public"."business_brand_profile"."marketing_manager_brief" IS 'V5.3: Synthesized Danish marketing manager role instruction (~200 words)';



COMMENT ON COLUMN "public"."business_brand_profile"."location_strategy" IS 'V5 location-based marketing strategy including reachable demographics and positioning. Generated by brand-profile-generator-v5.';



COMMENT ON COLUMN "public"."business_brand_profile"."generation_status" IS 'Generation status flags for graceful degradation: menu_status, location_status, brand_profile_status, missing_components, fallback_mode, warnings. Used by UI to highlight incomplete data.';



COMMENT ON COLUMN "public"."business_brand_profile"."data_sources_used" IS 'Tracks which data sources were available during generation: menu_data, location_intelligence, business_profile, operations. Used for debugging and quality monitoring.';



COMMENT ON COLUMN "public"."business_brand_profile"."strategic_coverage" IS 'V5 strategic coverage map used for gap-time handling and content planning';



CREATE TABLE IF NOT EXISTS "public"."businesses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "website_url" "text",
    "primary_language" "text" DEFAULT 'da'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "plan" "text" DEFAULT 'free'::"text",
    "ai_generations_today" integer DEFAULT 0,
    "ai_generations_this_month" integer DEFAULT 0,
    "pdf_uploads_today" integer DEFAULT 0,
    "pdf_uploads_this_month" integer DEFAULT 0,
    "website_analysis_today" integer DEFAULT 0,
    "website_analysis_this_month" integer DEFAULT 0,
    "scheduled_posts_this_month" integer DEFAULT 0,
    "last_daily_reset" "date" DEFAULT CURRENT_DATE,
    "last_monthly_reset" "date" DEFAULT "date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone),
    "subpage_urls" "jsonb" DEFAULT '[]'::"jsonb",
    "logo_url" "text",
    "quick_suggestions_today" smallint DEFAULT 0 NOT NULL,
    "last_quick_suggestions_reset" "date",
    "country" "text" DEFAULT 'Denmark'::"text" NOT NULL,
    "local_location_reference" "text",
    "postal_code" "text",
    "business_type_hybrid" "jsonb",
    CONSTRAINT "businesses_plan_check" CHECK (("plan" = ANY (ARRAY['free'::"text", 'standardplus'::"text", 'premium'::"text"])))
);


ALTER TABLE "public"."businesses" OWNER TO "postgres";


COMMENT ON COLUMN "public"."businesses"."logo_url" IS 'URL to business logo image';



COMMENT ON COLUMN "public"."businesses"."quick_suggestions_today" IS 'Count of AI suggestion regenerations today (Free tier). Resets daily.';



COMMENT ON COLUMN "public"."businesses"."last_quick_suggestions_reset" IS 'Date of last quota counter reset. Used to reset quick_suggestions_today at midnight.';



COMMENT ON COLUMN "public"."businesses"."country" IS 'Business country (e.g. Denmark, Norway, Sweden). Used for language detection and contextual calendar events.';



COMMENT ON COLUMN "public"."businesses"."local_location_reference" IS 'Human-friendly location reference in local language (e.g., "ved åen", "i centrum"). Used for contextual content generation.';



COMMENT ON COLUMN "public"."businesses"."postal_code" IS 'Danish postal code (postnummer) - most reliable city identifier';



COMMENT ON COLUMN "public"."businesses"."business_type_hybrid" IS 'Hybrid business type classification: {primary: string, secondary: string[], hybridLabel?: string, cuisineType?: string, conceptTags?: string[]}';



CREATE OR REPLACE VIEW "public"."brand_examples_with_fallback" AS
 SELECT "bbp"."business_id",
    "b"."name" AS "business_name",
    COALESCE(NULLIF("bbp"."enhanced_social_examples", '[]'::"jsonb"), NULLIF("bbp"."social_writing_examples", '[]'::"jsonb"), '[]'::"jsonb") AS "effective_social_examples",
    COALESCE(NULLIF("bbp"."enhanced_avoid_examples", '[]'::"jsonb"), '[]'::"jsonb") AS "effective_avoid_examples",
    "jsonb_array_length"("bbp"."enhanced_social_examples") AS "enhanced_count",
    "jsonb_array_length"("bbp"."social_writing_examples") AS "simple_count",
        CASE
            WHEN ("jsonb_array_length"("bbp"."enhanced_social_examples") > 0) THEN 'enhanced'::"text"
            WHEN ("jsonb_array_length"("bbp"."social_writing_examples") > 0) THEN 'simple'::"text"
            ELSE 'empty'::"text"
        END AS "example_tier"
   FROM ("public"."business_brand_profile" "bbp"
     LEFT JOIN "public"."businesses" "b" ON (("bbp"."business_id" = "b"."id")));


ALTER VIEW "public"."brand_examples_with_fallback" OWNER TO "postgres";


COMMENT ON VIEW "public"."brand_examples_with_fallback" IS 'Simplifies example queries with automatic fallback logic.
   
   Usage:
   SELECT effective_social_examples 
   FROM brand_examples_with_fallback 
   WHERE business_id = $1;
   
   Returns enhanced examples if available, falls back to simple, then empty array.';



CREATE TABLE IF NOT EXISTS "public"."brand_profile_sources_state" (
    "business_id" "uuid" NOT NULL,
    "business_snapshot_hash" "text",
    "business_snapshot_changed_at" timestamp with time zone,
    "profile_hash" "text",
    "profile_changed_at" timestamp with time zone,
    "website_hash" "text",
    "website_changed_at" timestamp with time zone,
    "location_hash" "text",
    "location_changed_at" timestamp with time zone,
    "images_hash" "text",
    "images_changed_at" timestamp with time zone,
    "menu_hash" "text",
    "menu_changed_at" timestamp with time zone,
    "version_hash" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."brand_profile_sources_state" OWNER TO "postgres";


COMMENT ON TABLE "public"."brand_profile_sources_state" IS 'Tracks content hashes for Brand Profile source data. Used to detect changes and avoid unnecessary AI regenerations.';



COMMENT ON COLUMN "public"."brand_profile_sources_state"."version_hash" IS 'Combined hash of all source hashes. Changes when any source changes.';



CREATE TABLE IF NOT EXISTS "public"."business_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "extracted_text" "text",
    "file_size" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "extracted_json" "jsonb",
    CONSTRAINT "business_documents_document_type_check" CHECK (("document_type" = ANY (ARRAY['menu'::"text", 'wine_list'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."business_documents" OWNER TO "postgres";


COMMENT ON COLUMN "public"."business_documents"."extracted_json" IS 'Structured menu data extracted from PDF, containing categories and menu items with prices';



CREATE TABLE IF NOT EXISTS "public"."business_location_intelligence" (
    "business_id" "uuid" NOT NULL,
    "neighborhood" "text",
    "neighborhood_character" "text",
    "area_type" "text",
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "landmarks_nearby" "jsonb" DEFAULT '[]'::"jsonb",
    "public_transport" "jsonb" DEFAULT '{}'::"jsonb",
    "has_view" boolean DEFAULT false,
    "view_type" "text"[],
    "outdoor_space_type" "text",
    "location_marketing_hooks" "text"[],
    "is_hidden_gem" boolean DEFAULT false,
    "street_visibility" "text",
    "last_updated_by_ai" timestamp with time zone,
    "user_confirmed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "category_scores" "jsonb" DEFAULT '{}'::"jsonb",
    "location_type_matches" "jsonb" DEFAULT '{}'::"jsonb",
    "concept_fit_by_category" "jsonb" DEFAULT '{}'::"jsonb",
    "concept_fit_analyzed_at" timestamp with time zone,
    "nearby_hospitality" "jsonb" DEFAULT '{"breakdown": {"bar": 0, "cafe": 0, "restaurant": 0}, "fetched_at": null, "total_count": 0, "density_label": "low", "radius_meters": 300}'::"jsonb",
    "who_analysis" "jsonb",
    "when_analysis" "jsonb",
    "why_analysis" "jsonb",
    "who_analysis_internal" "jsonb",
    "when_analysis_internal" "jsonb",
    "why_analysis_internal" "jsonb",
    "category_modifiers" "jsonb" DEFAULT '{}'::"jsonb",
    "local_location_reference" "text",
    "demographic_proximity" "jsonb" DEFAULT '{}'::"jsonb",
    "location_architecture_version" integer DEFAULT 3,
    "physical_context" "jsonb",
    "raw_competitive_venues" "jsonb",
    "schema_version" integer DEFAULT 1,
    "who" "jsonb",
    "traffic_rhythm" "jsonb"
);


ALTER TABLE "public"."business_location_intelligence" OWNER TO "postgres";


COMMENT ON TABLE "public"."business_location_intelligence" IS 'AI-powered location context for marketing content generation';



COMMENT ON COLUMN "public"."business_location_intelligence"."landmarks_nearby" IS 'Nearby landmarks for location-based content hooks';



COMMENT ON COLUMN "public"."business_location_intelligence"."location_marketing_hooks" IS 'AI-generated location selling points';



COMMENT ON COLUMN "public"."business_location_intelligence"."category_modifiers" IS 'Qualifiers for location categories. Example: {"city_centre": ["shopping"]} indicates city centre with strong shopping context';



COMMENT ON COLUMN "public"."business_location_intelligence"."demographic_proximity" IS 'JSONB storing demographic proximity data (WHO is nearby): university_proximity, tourist_flow, office_worker_density, residential_density.';



COMMENT ON COLUMN "public"."business_location_intelligence"."location_architecture_version" IS 'Architecture version: 1 = old (student/tourist in category_scores), 2 = demographics in demographic_proximity, 3 = who + traffic_rhythm (Physical Anchor Taxonomy v3)';



COMMENT ON COLUMN "public"."business_location_intelligence"."physical_context" IS 'Objective physical environment facts: pedestrian_flow, transit_within_150m, nearest_transit, parking_within_300m, street_level. Used by Brand Profile for strategy generation.';



COMMENT ON COLUMN "public"."business_location_intelligence"."raw_competitive_venues" IS 'Raw competitor venue data from Google Places (no AI interpretation). Array of: {name, distance_meters, rating, user_ratings_total, price_level, place_id, types}. Used by Brand Profile for competitive positioning.';



COMMENT ON COLUMN "public"."business_location_intelligence"."schema_version" IS 'Schema version: 1=legacy (student/tourist in category_scores), 2=split (category_scores=geographic, demographic_proximity=separate)';



COMMENT ON COLUMN "public"."business_location_intelligence"."who" IS 'WHO is physically in this area. Structure: {primary: WhoType[], secondary: WhoType[], notes?: string}. Valid WhoType: local_resident, office_worker, student, shopper, tourist, commuter, leisure_walker, family, medical_staff, hospital_visitor, event_visitor.';



COMMENT ON COLUMN "public"."business_location_intelligence"."traffic_rhythm" IS 'WHEN does this location generate traffic. Structure: {peak_days, peak_hours, dead_periods, seasonal_pattern, seasonal_note?}. Used for time-aware content strategy.';



CREATE TABLE IF NOT EXISTS "public"."business_location_intelligence_backup_20260701" (
    "business_id" "uuid",
    "neighborhood" "text",
    "neighborhood_character" "text",
    "area_type" "text",
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "landmarks_nearby" "jsonb",
    "public_transport" "jsonb",
    "has_view" boolean,
    "view_type" "text"[],
    "outdoor_space_type" "text",
    "location_marketing_hooks" "text"[],
    "is_hidden_gem" boolean,
    "street_visibility" "text",
    "last_updated_by_ai" timestamp with time zone,
    "user_confirmed_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "category_scores" "jsonb",
    "location_type_matches" "jsonb",
    "concept_fit_by_category" "jsonb",
    "concept_fit_analyzed_at" timestamp with time zone,
    "nearby_hospitality" "jsonb",
    "who_analysis" "jsonb",
    "when_analysis" "jsonb",
    "why_analysis" "jsonb",
    "who_analysis_internal" "jsonb",
    "when_analysis_internal" "jsonb",
    "why_analysis_internal" "jsonb",
    "category_modifiers" "jsonb",
    "local_location_reference" "text",
    "demographic_proximity" "jsonb",
    "location_architecture_version" integer,
    "physical_context" "jsonb",
    "raw_competitive_venues" "jsonb",
    "schema_version" integer,
    "who" "jsonb",
    "traffic_rhythm" "jsonb"
);


ALTER TABLE "public"."business_location_intelligence_backup_20260701" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "label" "text",
    "address_line1" "text",
    "address_line2" "text",
    "postal_code" "text",
    "city" "text",
    "country" "text" DEFAULT 'Denmark'::"text",
    "maps_url" "text",
    "phone" "text",
    "email" "text",
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "enrichment" "jsonb"
);


ALTER TABLE "public"."business_locations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."business_locations"."enrichment" IS 'Location enrichment data: macro context (country/region/city/city_tier), micro context (area_type/nearby_signals), and geo coordinates';



CREATE TABLE IF NOT EXISTS "public"."business_operations" (
    "business_id" "uuid" NOT NULL,
    "typical_busy_periods" "jsonb" DEFAULT '[]'::"jsonb",
    "typical_slow_periods" "jsonb" DEFAULT '[]'::"jsonb",
    "seating_capacity_indoor" integer,
    "seating_capacity_outdoor" integer,
    "price_level" "text",
    "average_check_per_person" integer,
    "currency" "text" DEFAULT 'DKK'::"text",
    "has_table_service" boolean DEFAULT true,
    "has_takeaway" boolean DEFAULT false,
    "has_delivery" boolean DEFAULT false,
    "reservation_required" boolean DEFAULT false,
    "accepts_walk_ins" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "has_kids_menu" boolean DEFAULT false,
    "has_outdoor_seating" boolean DEFAULT false,
    "has_wifi" boolean DEFAULT false,
    "has_power_outlets" boolean DEFAULT false,
    "has_parking" boolean DEFAULT false,
    "kitchen_close_time" time without time zone,
    "weekly_programme" "text",
    "establishment_type" character varying(10),
    "enabled_menu_languages" "text"[],
    CONSTRAINT "business_operations_price_level_check" CHECK (("price_level" = ANY (ARRAY['budget'::"text", 'moderate'::"text", 'upscale'::"text", 'fine_dining'::"text"]))),
    CONSTRAINT "establishment_type_check" CHECK ((("establishment_type" IS NULL) OR (("establishment_type")::"text" = ANY ((ARRAY['FSE'::character varying, 'SBO'::character varying])::"text"[]))))
);


ALTER TABLE "public"."business_operations" OWNER TO "postgres";


COMMENT ON TABLE "public"."business_operations" IS 'Operational details for capacity-based content generation';



COMMENT ON COLUMN "public"."business_operations"."typical_slow_periods" IS 'Identifies opportunities for fill-gap marketing';



COMMENT ON COLUMN "public"."business_operations"."has_kids_menu" IS 'Whether business offers kids menu/children-friendly options';



COMMENT ON COLUMN "public"."business_operations"."has_outdoor_seating" IS 'Whether business has outdoor seating available';



COMMENT ON COLUMN "public"."business_operations"."has_wifi" IS 'Whether business offers WiFi';



COMMENT ON COLUMN "public"."business_operations"."has_power_outlets" IS 'Whether business has power outlets for customers';



COMMENT ON COLUMN "public"."business_operations"."has_parking" IS 'Whether business has parking available';



COMMENT ON COLUMN "public"."business_operations"."kitchen_close_time" IS 'Time when kitchen closes (can be different from closing time)';



COMMENT ON COLUMN "public"."business_operations"."weekly_programme" IS 'Weekly recurring programme/schedule text';



COMMENT ON COLUMN "public"."business_operations"."establishment_type" IS 'AI-detected classification: FSE (Full-Service Establishment) or SBO (Specialized Beverage Outlet). Used internally for content strategy.';



CREATE TABLE IF NOT EXISTS "public"."business_profile" (
    "business_id" "uuid" NOT NULL,
    "long_description" "text",
    "price_level" "text",
    "target_audience" "text",
    "founded_year" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "menu_description" "text",
    "menu_structure" "jsonb",
    "ai_brand_context" "text",
    "ai_brand_context_generated_at" timestamp with time zone,
    "ai_brand_context_approved" boolean DEFAULT false,
    "detected_menu_urls" "text"[] DEFAULT '{}'::"text"[],
    "booking_url" "text",
    "menu_signal" "jsonb" DEFAULT '{}'::"jsonb",
    "key_offerings" "text",
    "keywords" "text"[],
    "user_about_text" "text",
    "ai_place_synopsis" "text",
    CONSTRAINT "business_profile_founded_year_check" CHECK ((("founded_year" >= 1800) AND (("founded_year")::numeric <= EXTRACT(year FROM "now"())))),
    CONSTRAINT "business_profile_price_level_check" CHECK (("price_level" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"])))
);


ALTER TABLE "public"."business_profile" OWNER TO "postgres";


COMMENT ON TABLE "public"."business_profile" IS 'Business descriptions and target audience';



COMMENT ON COLUMN "public"."business_profile"."menu_description" IS 'Quick overview of menu/offerings for AI context';



COMMENT ON COLUMN "public"."business_profile"."menu_structure" IS 'Full structured menu data with categories, items, prices, and ingredients (JSON format)';



COMMENT ON COLUMN "public"."business_profile"."ai_brand_context" IS 'AI-generated brand context prompt used for content creation. Includes tone of voice, audience, menu highlights, and content guidelines.';



COMMENT ON COLUMN "public"."business_profile"."ai_brand_context_generated_at" IS 'Timestamp when the brand context was last generated';



COMMENT ON COLUMN "public"."business_profile"."ai_brand_context_approved" IS 'Whether the user has reviewed and approved the brand context';



COMMENT ON COLUMN "public"."business_profile"."detected_menu_urls" IS 'Menu URLs and PDF links detected by AI during website analysis, to be confirmed/edited by user before menu extraction';



COMMENT ON COLUMN "public"."business_profile"."booking_url" IS 'Booking/reservation URL for CTA buttons (e.g., DinnerBooking, OpenTable links)';



COMMENT ON COLUMN "public"."business_profile"."menu_signal" IS 'Detected menu signals from website analysis (hasMenu, confidence, etc.)';



COMMENT ON COLUMN "public"."business_profile"."key_offerings" IS 'Newline-separated list of 5-7 main products/dishes (names only). Used by AI for Free tier suggestion generation. Example: "Kaffe\nSmørrebrød\nSalater\nKage\nSmoothies"';



COMMENT ON COLUMN "public"."business_profile"."keywords" IS 'Business keywords for content generation';



CREATE TABLE IF NOT EXISTS "public"."business_programme_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "programme_type" "text" NOT NULL,
    "programme_name" "text" NOT NULL,
    "time_windows" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "operating_days" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "menu_evidence" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "confidence" numeric,
    "baseline_goal_split" "jsonb",
    "decision_timing" "text",
    "content_type_affinity" "jsonb",
    "audience_segments" "jsonb",
    "segment_confidence" numeric,
    "segment_reasoning" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "version_hash" "text",
    "generation_errors" "jsonb",
    "commercial_reasoning" "text",
    "accepts_reservations" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "price_positioning" "jsonb",
    "meal_periods" "text"[] DEFAULT '{}'::"text"[],
    "day_pattern" "text",
    "menu_results_v2_id" "uuid",
    "draw_type" "text",
    "reachable_guest_profile" "text",
    "permitted_who_types" "jsonb"
);


ALTER TABLE "public"."business_programme_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."business_programme_profiles" IS 'Programme-level brand profile data (Layers 1, 2, 4)';



COMMENT ON COLUMN "public"."business_programme_profiles"."programme_type" IS 'Type of dining programme (brunch, lunch, dinner, bar)';



COMMENT ON COLUMN "public"."business_programme_profiles"."baseline_goal_split" IS 'Layer 2: % split between drive_footfall, strengthen_brand, retain_regulars';



COMMENT ON COLUMN "public"."business_programme_profiles"."audience_segments" IS 'Layer 4: Array of audience segments specific to this programme';



COMMENT ON COLUMN "public"."business_programme_profiles"."commercial_reasoning" IS 'Layer 2: AI explanation of why this commercial orientation was chosen for this programme';



COMMENT ON COLUMN "public"."business_programme_profiles"."accepts_reservations" IS 'Whether this programme accepts table reservations in addition to walk-ins.';



COMMENT ON COLUMN "public"."business_programme_profiles"."is_active" IS 'Whether this programme is currently active and should appear in content generation.';



COMMENT ON COLUMN "public"."business_programme_profiles"."price_positioning" IS 'V5.3: Programme-specific price positioning for content tone calibration. 
Structure: {tier: "budget|value|moderate|upscale|premium", min: number, max: number, avg: number, spread: number, sample_count: number}';



COMMENT ON COLUMN "public"."business_programme_profiles"."meal_periods" IS 'Meal periods this programme covers based on time window overlap (60-min minimum). Values: morgenmad, brunch, frokost, eftermiddag, aftensmad, natbar. Derived automatically from time_windows.';



COMMENT ON COLUMN "public"."business_programme_profiles"."day_pattern" IS 'Operating day pattern derived from operating_days. Values: all_week, weekday, weekend, weekend_heavy. Used for audience segmentation.';



COMMENT ON COLUMN "public"."business_programme_profiles"."draw_type" IS 'Commercial draw type: passing_trade | local_draw | destination_draw - describes how guests reach this programme';



COMMENT ON COLUMN "public"."business_programme_profiles"."reachable_guest_profile" IS '1-2 sentence Danish description of who actually visits this programme (filtered by price/hours, not just who lives nearby)';



COMMENT ON COLUMN "public"."business_programme_profiles"."permitted_who_types" IS 'WhoType[] after price+hours filtering. E.g. ["local_resident", "office_worker", "shopper"]. Computed at brand profile generation time from location.who + menu prices.';



CREATE TABLE IF NOT EXISTS "public"."business_staff" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "role" "text",
    "bio" "text",
    "specialties" "text"[],
    "certifications" "text"[],
    "years_experience" integer,
    "photo_url" "text",
    "accepts_bookings" boolean DEFAULT true,
    "booking_url" "text",
    "display_order" integer DEFAULT 0,
    "is_featured" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "instagram_handle" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."business_staff" OWNER TO "postgres";


COMMENT ON TABLE "public"."business_staff" IS 'Team members, stylists, trainers, and professionals';



CREATE TABLE IF NOT EXISTS "public"."business_team_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "invited_at" timestamp with time zone DEFAULT "now"(),
    "accepted_at" timestamp with time zone
);


ALTER TABLE "public"."business_team_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."city_context_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "city" "text" NOT NULL,
    "country" "text" DEFAULT 'Denmark'::"text" NOT NULL,
    "postal_code" "text",
    "population" integer,
    "city_size" "text" NOT NULL,
    "cultural_context" "text" NOT NULL,
    "tone" "text",
    "characteristics" "jsonb",
    "ai_generated" boolean DEFAULT true,
    "cached_at" timestamp with time zone DEFAULT "now"(),
    "cached_until" timestamp with time zone NOT NULL,
    "generation_model" "text" DEFAULT 'gpt-4o-mini'::"text",
    CONSTRAINT "city_context_cache_city_size_check" CHECK (("city_size" = ANY (ARRAY['small_town'::"text", 'medium_city'::"text", 'major_city'::"text", 'capital'::"text"]))),
    CONSTRAINT "valid_cache_duration" CHECK (("cached_until" > "cached_at"))
);


ALTER TABLE "public"."city_context_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contextual_calendar" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "country" "text" NOT NULL,
    "region" "text",
    "event_type" "text" NOT NULL,
    "event_name" "text" NOT NULL,
    "date_start" "date" NOT NULL,
    "date_end" "date",
    "recurrence" "text",
    "recurrence_rule" "text",
    "relevance_tags" "text"[],
    "content_angle" "text",
    "marketing_hook" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "commercial_weight" smallint DEFAULT 2 NOT NULL,
    "lead_days" smallint DEFAULT 3 NOT NULL,
    CONSTRAINT "contextual_calendar_commercial_weight_check" CHECK ((("commercial_weight" >= 1) AND ("commercial_weight" <= 10))),
    CONSTRAINT "contextual_calendar_event_type_check" CHECK (("event_type" = ANY (ARRAY['holiday'::"text", 'school_vacation'::"text", 'season'::"text", 'cultural'::"text", 'business_rhythm'::"text"]))),
    CONSTRAINT "contextual_calendar_recurrence_check" CHECK (("recurrence" = ANY (ARRAY['annual'::"text", 'seasonal'::"text", 'monthly'::"text", 'weekly'::"text", NULL::"text"])))
);


ALTER TABLE "public"."contextual_calendar" OWNER TO "postgres";


COMMENT ON TABLE "public"."contextual_calendar" IS 'Country-specific calendar events for AI content suggestions';



COMMENT ON COLUMN "public"."contextual_calendar"."commercial_weight" IS '1=minor, 2-3=low, 4-6=moderate, 7-8=high, 9-10=critical. Controls how aggressively Phase 1 allocates post capacity to this event.';



COMMENT ON COLUMN "public"."contextual_calendar"."lead_days" IS 'Recommended days before event to start posting lead-up content. 0 = day-of only.';



CREATE TABLE IF NOT EXISTS "public"."daily_suggestions" (
    "id" integer NOT NULL,
    "business_id" "uuid" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "position" smallint NOT NULL,
    "title" "text" NOT NULL,
    "rationale" "text",
    "why_explanation" "text",
    "menu_item_name" "text",
    "menu_item_description" "text",
    "content_type" "text" DEFAULT 'menu_item'::"text" NOT NULL,
    "caption_base" "text",
    "cta_intent" "text" DEFAULT 'visit'::"text",
    "photo_idea" "text",
    "media_suggestion" "jsonb",
    "suggested_time" time without time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "generation_batch_id" "uuid",
    "weather_forecast" "jsonb",
    "text_generated_count" integer DEFAULT 0,
    "first_text_generated_at" timestamp with time zone,
    "last_text_generated_at" timestamp with time zone,
    "media_items" "jsonb",
    "uploaded_photo_url" "text",
    "photo_analysis" "jsonb",
    "text_generation_version" integer,
    "generated_text" "text",
    "generated_hashtags" "jsonb",
    "generated_platform_content" "jsonb",
    "generated_at" timestamp with time zone,
    "platforms_generated" "text"[],
    "planner_rationale" "text",
    "source" "text" DEFAULT 'quick_suggestions'::"text" NOT NULL,
    "menu_item_id" "uuid",
    "service_period" "text",
    "content_angle" "text",
    "selected" boolean DEFAULT false,
    "occasion_context" "text",
    "inferred_content_type" "text",
    "validation_result" "jsonb",
    "status" "text" DEFAULT 'available'::"text" NOT NULL,
    "selected_at" timestamp with time zone,
    "consumed_at" timestamp with time zone,
    "published_at" timestamp with time zone,
    CONSTRAINT "daily_sugg_content_type_required" CHECK (("content_type" IS NOT NULL)),
    CONSTRAINT "daily_sugg_product_needs_menu" CHECK ((("content_type" <> ALL (ARRAY['product'::"text", 'occasion'::"text"])) OR ("menu_item_name" IS NOT NULL))),
    CONSTRAINT "daily_sugg_valid_content_types" CHECK (("content_type" = ANY (ARRAY['product'::"text", 'experience'::"text", 'occasion'::"text", 'atmosphere'::"text", 'retention'::"text", 'team'::"text"]))),
    CONSTRAINT "daily_suggestions_position_check" CHECK ((("position" >= 1) AND ("position" <= 3))),
    CONSTRAINT "daily_suggestions_source_check" CHECK (("source" = ANY (ARRAY['quick_suggestions'::"text", 'weekly_plan'::"text"]))),
    CONSTRAINT "daily_suggestions_status_check" CHECK (("status" = ANY (ARRAY['available'::"text", 'selected'::"text", 'consumed'::"text", 'published'::"text"])))
);


ALTER TABLE "public"."daily_suggestions" OWNER TO "postgres";


COMMENT ON TABLE "public"."daily_suggestions" IS 'Caches AI-generated post suggestions for Free tier. One business gets 3 suggestions per day (positions 1-3). Upserted on regenerate.';



COMMENT ON COLUMN "public"."daily_suggestions"."menu_item_name" IS 'Denormalized dish name for rotation tracking (avoids JOIN in hot path)';



COMMENT ON COLUMN "public"."daily_suggestions"."content_type" IS 'Type of content: product, experience, atmosphere, retention, occasion, team';



COMMENT ON COLUMN "public"."daily_suggestions"."is_active" IS 'FALSE when a new batch is generated (prevents showing stale suggestions). TRUE for current batch.';



COMMENT ON COLUMN "public"."daily_suggestions"."generation_batch_id" IS 'UUID linking all 3 suggestions from the same generation request. Used for batch deactivation.';



COMMENT ON COLUMN "public"."daily_suggestions"."weather_forecast" IS 'Weather data snapshot when suggestion was generated. Used for regeneration context.';



COMMENT ON COLUMN "public"."daily_suggestions"."text_generated_count" IS 'Number of times "Generer tekst" was clicked for this suggestion';



COMMENT ON COLUMN "public"."daily_suggestions"."first_text_generated_at" IS 'First time text was generated from this suggestion';



COMMENT ON COLUMN "public"."daily_suggestions"."last_text_generated_at" IS 'Most recent time text was generated from this suggestion';



COMMENT ON COLUMN "public"."daily_suggestions"."media_items" IS 'Array of uploaded media items (photos/videos) with URLs and adjustments';



COMMENT ON COLUMN "public"."daily_suggestions"."uploaded_photo_url" IS 'URL of the actual uploaded photo for this suggestion';



COMMENT ON COLUMN "public"."daily_suggestions"."photo_analysis" IS 'AI analysis result from Gemini (feedback, tips, categories)';



COMMENT ON COLUMN "public"."daily_suggestions"."text_generation_version" IS 'Version number of text generation prompt that created this content (e.g., 8 = V5.5 Tone DNA)';



COMMENT ON COLUMN "public"."daily_suggestions"."generated_text" IS 'Shared/Facebook text generated from this idea';



COMMENT ON COLUMN "public"."daily_suggestions"."generated_hashtags" IS 'Array of hashtag objects with platforms: [{tag: "#food", platforms: ["facebook", "instagram"], enabled: true}]';



COMMENT ON COLUMN "public"."daily_suggestions"."generated_platform_content" IS 'Platform-specific content variants: {facebook: {text, hashtags}, instagram: {text, hashtags}}';



COMMENT ON COLUMN "public"."daily_suggestions"."generated_at" IS 'Timestamp when text was generated (for cache invalidation)';



COMMENT ON COLUMN "public"."daily_suggestions"."platforms_generated" IS 'Which platforms this content was generated for: ["facebook", "instagram"]';



COMMENT ON COLUMN "public"."daily_suggestions"."planner_rationale" IS 'Strategic timing context for this suggestion set (e.g., "Lørdag eftermiddag — gæster planlægger aftenens valg")';



COMMENT ON COLUMN "public"."daily_suggestions"."source" IS 'Origin system: quick_suggestions (AI Ideas for today) or weekly_plan (strategic week planning). Allows both systems to coexist without overwrites.';



COMMENT ON COLUMN "public"."daily_suggestions"."menu_item_id" IS 'FK to menu_items_normalized.id - links suggestion to specific menu item';



COMMENT ON COLUMN "public"."daily_suggestions"."service_period" IS 'Which service period this suggestion is for: brunch, lunch, dinner, all_day';



COMMENT ON COLUMN "public"."daily_suggestions"."content_angle" IS 'Strategic angle for this post, e.g. "Rainy-day comfort classic"';



COMMENT ON COLUMN "public"."daily_suggestions"."selected" IS 'Tracks which suggestion the user selected to create a post from';



COMMENT ON COLUMN "public"."daily_suggestions"."occasion_context" IS 'Creative occasion brief for Stage 2 copy generation (1 sentence). Describes the moment/occasion/situation to write about. Example: "Frokostpause ved åen midt på dagen" or "Weekend brunch når solen rammer bordet". Used by generate-text-from-idea as LEJLIGHED/KONTEKST context.';



COMMENT ON COLUMN "public"."daily_suggestions"."status" IS 'Lifecycle state for a suggestion row: available, selected, consumed, or published.';



COMMENT ON CONSTRAINT "daily_sugg_content_type_required" ON "public"."daily_suggestions" IS 'All suggestions must have a content_type for consistent categorization';



COMMENT ON CONSTRAINT "daily_sugg_product_needs_menu" ON "public"."daily_suggestions" IS 'Product and occasion suggestions must reference a menu item';



CREATE SEQUENCE IF NOT EXISTS "public"."daily_suggestions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."daily_suggestions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."daily_suggestions_id_seq" OWNED BY "public"."daily_suggestions"."id";



CREATE TABLE IF NOT EXISTS "public"."media_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "url" "text" NOT NULL,
    "type" "text",
    "category_tags" "text"[],
    "ai_labels" "jsonb",
    "is_hero" boolean DEFAULT false,
    "is_interior" boolean DEFAULT false,
    "is_exterior" boolean DEFAULT false,
    "is_team" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "media_assets_type_check" CHECK (("type" = ANY (ARRAY['photo'::"text", 'logo'::"text", 'menu_pdf'::"text", 'video'::"text"])))
);


ALTER TABLE "public"."media_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media_library" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "business_id" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "storage_bucket" "text" DEFAULT 'user-media'::"text" NOT NULL,
    "thumbnail_path" "text",
    "filename" "text" NOT NULL,
    "original_filename" "text" NOT NULL,
    "file_size" integer NOT NULL,
    "mime_type" "text" NOT NULL,
    "media_type" "text" NOT NULL,
    "width" integer,
    "height" integer,
    "aspect_ratio" numeric(5,3),
    "duration" integer,
    "video_thumbnail_path" "text",
    "post_type" "text",
    "dish_name" "text",
    "tags" "text"[] DEFAULT ARRAY[]::"text"[],
    "alt_text" "text",
    "upload_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_date" timestamp with time zone,
    "usage_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "menu_item_id" "uuid",
    CONSTRAINT "media_library_media_type_check" CHECK (("media_type" = ANY (ARRAY['image'::"text", 'video'::"text"]))),
    CONSTRAINT "media_library_post_type_check" CHECK ((("post_type" IS NULL) OR ("post_type" = ANY (ARRAY['food'::"text", 'drinks'::"text", 'atmosphere'::"text", 'other'::"text"]))))
);


ALTER TABLE "public"."media_library" OWNER TO "postgres";


COMMENT ON TABLE "public"."media_library" IS 'Persistent storage for user-uploaded photos and videos with metadata for organization and reuse across posts';



COMMENT ON COLUMN "public"."media_library"."storage_path" IS 'Path in Supabase Storage bucket (e.g., business123/originals/timestamp_random.jpg)';



COMMENT ON COLUMN "public"."media_library"."thumbnail_path" IS 'Path to 150x150 thumbnail for fast gallery display';



COMMENT ON COLUMN "public"."media_library"."post_type" IS 'Media category: food, drinks, atmosphere, other';



COMMENT ON COLUMN "public"."media_library"."usage_count" IS 'Number of times this media has been selected for posts (incremented via increment_media_usage function)';



COMMENT ON COLUMN "public"."media_library"."deleted_at" IS 'Soft delete timestamp - NULL = active, timestamp = deleted (preserves media referenced in scheduled posts)';



COMMENT ON COLUMN "public"."media_library"."menu_item_id" IS 'Reference to menu_items_normalized - when set, category is derived from menu item media_category (FOOD/DRINK)';



CREATE TABLE IF NOT EXISTS "public"."menu_items_normalized" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "menu_result_id" "uuid" NOT NULL,
    "item_name" "text" NOT NULL,
    "item_description" "text",
    "item_price" "text",
    "category_name" "text" NOT NULL,
    "category_type" "text" NOT NULL,
    "service_periods" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "service_period_name" "text",
    "menu_title" "text",
    "menu_url" "text",
    "is_signature" boolean DEFAULT false,
    "is_seasonal" boolean DEFAULT false,
    "is_limited_time" boolean DEFAULT false,
    "dish_temp_category" "text",
    "seasonal_ingredients" "text"[] DEFAULT '{}'::"text"[],
    "location_tags" "text"[] DEFAULT '{}'::"text"[],
    "total_times_posted" integer DEFAULT 0,
    "avg_engagement_rate" numeric(5,2) DEFAULT 0.0,
    "last_posted_date" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"(),
    "source_sha256" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true NOT NULL,
    "media_category" "text",
    "menu_language" "text" DEFAULT 'da'::"text",
    CONSTRAINT "menu_items_normalized_media_category_check" CHECK ((("media_category" IS NULL) OR ("media_category" = ANY (ARRAY['FOOD'::"text", 'DRINK'::"text"]))))
);


ALTER TABLE "public"."menu_items_normalized" OWNER TO "postgres";


COMMENT ON TABLE "public"."menu_items_normalized" IS 'Normalized menu items extracted from menu_results_v2.structured_data, enriched with metadata. Used for content generation and scoring.';



COMMENT ON COLUMN "public"."menu_items_normalized"."category_type" IS 'Classification of category: main (adult dishes), kids_menu (børnemenu), dessert, appetizer, sides';



COMMENT ON COLUMN "public"."menu_items_normalized"."service_periods" IS 'Array of service periods when item is available: brunch, lunch, dinner';



COMMENT ON COLUMN "public"."menu_items_normalized"."dish_temp_category" IS 'Temperature category for seasonal matching: hot, cold, warm, neutral';



COMMENT ON COLUMN "public"."menu_items_normalized"."source_sha256" IS 'SHA256 hash of parent menu_results_v2 record for change detection';



COMMENT ON COLUMN "public"."menu_items_normalized"."media_category" IS 'Nullable media classification: FOOD or DRINK; NULL when the item is ambiguous.';



CREATE OR REPLACE VIEW "public"."media_library_with_category" AS
 SELECT "ml"."id",
    "ml"."user_id",
    "ml"."business_id",
    "ml"."storage_path",
    "ml"."storage_bucket",
    "ml"."thumbnail_path",
    "ml"."filename",
    "ml"."original_filename",
    "ml"."file_size",
    "ml"."mime_type",
    "ml"."media_type",
    "ml"."width",
    "ml"."height",
    "ml"."aspect_ratio",
    "ml"."duration",
    "ml"."video_thumbnail_path",
    "ml"."post_type",
    "ml"."dish_name",
    "ml"."tags",
    "ml"."alt_text",
    "ml"."upload_date",
    "ml"."last_used_date",
    "ml"."usage_count",
    "ml"."created_at",
    "ml"."updated_at",
    "ml"."deleted_at",
    "ml"."menu_item_id",
        CASE
            WHEN (("ml"."menu_item_id" IS NOT NULL) AND ("min"."media_category" IS NOT NULL)) THEN "lower"("min"."media_category")
            ELSE "ml"."post_type"
        END AS "resolved_category",
    "min"."item_name" AS "menu_item_name",
    "min"."media_category" AS "menu_media_category"
   FROM ("public"."media_library" "ml"
     LEFT JOIN "public"."menu_items_normalized" "min" ON (("ml"."menu_item_id" = "min"."id")))
  WHERE ("ml"."deleted_at" IS NULL);


ALTER VIEW "public"."media_library_with_category" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."menu_items_normalized_stats" AS
 SELECT "business_id",
    "count"(*) AS "total_items",
    "count"(*) FILTER (WHERE ("category_type" = 'main'::"text")) AS "main_items",
    "count"(*) FILTER (WHERE ("category_type" = 'kids_menu'::"text")) AS "kids_items",
    "count"(*) FILTER (WHERE ("category_type" = 'dessert'::"text")) AS "dessert_items",
    "count"(*) FILTER (WHERE ('brunch'::"text" = ANY ("service_periods"))) AS "brunch_items",
    "count"(*) FILTER (WHERE ('lunch'::"text" = ANY ("service_periods"))) AS "lunch_items",
    "count"(*) FILTER (WHERE ('dinner'::"text" = ANY ("service_periods"))) AS "dinner_items",
    "count"(*) FILTER (WHERE "is_signature") AS "signature_items",
    "max"("synced_at") AS "last_sync"
   FROM "public"."menu_items_normalized"
  GROUP BY "business_id";


ALTER VIEW "public"."menu_items_normalized_stats" OWNER TO "postgres";


COMMENT ON VIEW "public"."menu_items_normalized_stats" IS 'Statistics view for monitoring normalized menu items per business';



CREATE OR REPLACE VIEW "public"."menu_normalization_stats" AS
 SELECT "mr"."business_id",
    "count"(DISTINCT "mr"."id") AS "total_menus",
    "count"(DISTINCT "mr"."id") FILTER (WHERE ("mr"."status" = 'done'::"text")) AS "completed_menus",
    "count"(DISTINCT "min"."menu_result_id") AS "normalized_menus",
    "count"("min"."id") AS "total_normalized_items",
    "round"("avg"("items_per_menu"."item_count"), 1) AS "avg_items_per_menu",
    "max"("min"."synced_at") AS "last_sync"
   FROM (("public"."menu_results_v2" "mr"
     LEFT JOIN ( SELECT "menu_items_normalized"."menu_result_id",
            "count"(*) AS "item_count"
           FROM "public"."menu_items_normalized"
          GROUP BY "menu_items_normalized"."menu_result_id") "items_per_menu" ON (("items_per_menu"."menu_result_id" = "mr"."id")))
     LEFT JOIN "public"."menu_items_normalized" "min" ON (("min"."menu_result_id" = "mr"."id")))
  WHERE ("mr"."status" = 'done'::"text")
  GROUP BY "mr"."business_id";


ALTER VIEW "public"."menu_normalization_stats" OWNER TO "postgres";


COMMENT ON VIEW "public"."menu_normalization_stats" IS 'Monitoring view for menu normalization pipeline health';



CREATE TABLE IF NOT EXISTS "public"."menu_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "source_url" "text" NOT NULL,
    "source_type" "text" NOT NULL,
    "file_name" "text",
    "menu_type" "text" DEFAULT 'standard'::"text" NOT NULL,
    "source_origin" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "label" "text",
    CONSTRAINT "menu_sources_menu_type_check" CHECK (("menu_type" = ANY (ARRAY['standard'::"text", 'special'::"text"]))),
    CONSTRAINT "menu_sources_source_origin_check" CHECK (("source_origin" = ANY (ARRAY['ai_detected'::"text", 'manual_added'::"text"]))),
    CONSTRAINT "menu_sources_source_type_check" CHECK (("source_type" = ANY (ARRAY['url'::"text", 'pdf'::"text"]))),
    CONSTRAINT "menu_sources_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'extracting'::"text", 'extracted'::"text", 'ignored'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."menu_sources" OWNER TO "postgres";


COMMENT ON TABLE "public"."menu_sources" IS 'Tracks individual menu sources (URLs, uploaded PDFs) for each business. Used for menu extraction workflows.';



COMMENT ON COLUMN "public"."menu_sources"."source_url" IS 'The URL link or file path/identifier for PDF sources';



COMMENT ON COLUMN "public"."menu_sources"."source_type" IS 'Type of source: url (web link) or pdf (uploaded file)';



COMMENT ON COLUMN "public"."menu_sources"."file_name" IS 'Original filename for PDF uploads';



COMMENT ON COLUMN "public"."menu_sources"."menu_type" IS 'Menu classification: standard (main menu) or special (temporary/seasonal)';



COMMENT ON COLUMN "public"."menu_sources"."source_origin" IS 'How the source was added: ai_detected (AI found on website) or manual_added (user added)';



COMMENT ON COLUMN "public"."menu_sources"."status" IS 'Current extraction status: pending, extracting, extracted, ignored, error';



COMMENT ON COLUMN "public"."menu_sources"."created_at" IS 'Timestamp when source was added';



COMMENT ON COLUMN "public"."menu_sources"."updated_at" IS 'Timestamp of last update (menu type change, status change, etc)';



COMMENT ON COLUMN "public"."menu_sources"."label" IS 'Descriptive label for the menu (e.g., Cocktails, Frokost, Aftenmenu). Auto-detected from URL patterns.';



CREATE TABLE IF NOT EXISTS "public"."opening_hours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "weekday" "text" NOT NULL,
    "open_time" time without time zone,
    "close_time" time without time zone,
    "closed" boolean DEFAULT false,
    "kind" "text" DEFAULT 'normal'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "opening_hours_kind_check" CHECK (("kind" = ANY (ARRAY['normal'::"text", 'kitchen'::"text", 'holiday'::"text"]))),
    CONSTRAINT "opening_hours_weekday_check" CHECK (("weekday" = ANY (ARRAY['monday'::"text", 'tuesday'::"text", 'wednesday'::"text", 'thursday'::"text", 'friday'::"text", 'saturday'::"text", 'sunday'::"text"])))
);


ALTER TABLE "public"."opening_hours" OWNER TO "postgres";


COMMENT ON TABLE "public"."opening_hours" IS 'Weekly opening hours schedule';



CREATE TABLE IF NOT EXISTS "public"."platform_intelligence" (
    "id" integer DEFAULT 1 NOT NULL,
    "instagram_algorithm" "jsonb" DEFAULT '{}'::"jsonb",
    "facebook_algorithm" "jsonb" DEFAULT '{}'::"jsonb",
    "google_my_business" "jsonb" DEFAULT '{}'::"jsonb",
    "industry_benchmarks" "jsonb" DEFAULT '{}'::"jsonb",
    "last_updated" timestamp with time zone DEFAULT "now"(),
    "version" integer DEFAULT 1,
    CONSTRAINT "single_row" CHECK (("id" = 1))
);


ALTER TABLE "public"."platform_intelligence" OWNER TO "postgres";


COMMENT ON TABLE "public"."platform_intelligence" IS 'Global platform algorithm knowledge for optimal content strategy';



COMMENT ON COLUMN "public"."platform_intelligence"."instagram_algorithm" IS 'Current Instagram algorithm best practices';



CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "platform" "text",
    "platforms" "text"[] DEFAULT '{}'::"text"[],
    "platforms_generated" "text"[] DEFAULT '{}'::"text"[],
    "idea_source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "source" "text" DEFAULT 'manual_copy_paste'::"text",
    "suggestion_id" integer,
    "weekly_plan_id" "uuid",
    "weekly_plan_idea_id" integer,
    "weekly_plan_slot_date" "date",
    "weekly_plan_slot_index" integer,
    "menu_item_id" "uuid",
    "menu_item_name" "text",
    "menu_item_description" "text",
    "content_type" "text",
    "content_angle" "text",
    "service_period" "text",
    "title" "text",
    "post_text" "text",
    "generated_text" "text",
    "caption_base" "text",
    "generated_hashtags" "jsonb" DEFAULT '[]'::"jsonb",
    "generated_platform_content" "jsonb" DEFAULT '{}'::"jsonb",
    "photo_url" "text",
    "uploaded_photo_url" "text",
    "photo_idea" "text",
    "media_suggestion" "jsonb",
    "media_metadata" "jsonb",
    "photo_analysis" "jsonb",
    "media_items" "jsonb",
    "cta_intent" "text",
    "text_generated_count" integer DEFAULT 0,
    "text_generation_version" integer,
    "first_text_generated_at" timestamp with time zone,
    "last_text_generated_at" timestamp with time zone,
    "generated_at" timestamp with time zone,
    "rationale" "text",
    "why_explanation" "text",
    "planner_rationale" "text",
    "occasion_context" "text",
    "weather_forecast" "jsonb",
    "date" "date",
    "suggested_time" "text",
    "suggested_post_datetime" timestamp with time zone,
    "scheduled_for" timestamp with time zone,
    "posted_at" timestamp with time zone,
    "published_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "selected" boolean DEFAULT false,
    "selected_at" timestamp with time zone,
    "consumed_at" timestamp with time zone,
    "posting_error" "text",
    "generation_batch_id" "uuid",
    "validation_result" "jsonb",
    "content_json" "jsonb",
    "caption_data" "jsonb",
    "idea_data" "jsonb" DEFAULT '{}'::"jsonb",
    "media_analysis" "jsonb",
    "phase" "text" DEFAULT 'publish'::"text",
    "strategy_id" "uuid",
    "idea_index" integer DEFAULT 0,
    "position" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "content_style" "text",
    CONSTRAINT "posts_content_style_check" CHECK ((("content_style" IS NULL) OR ("content_style" = ANY (ARRAY['performance_driven'::"text", 'brand_building'::"text", 'balanced'::"text"])))),
    CONSTRAINT "posts_idea_source_check" CHECK (("idea_source" = ANY (ARRAY['manual'::"text", 'quick_suggestions'::"text", 'weekly_plan'::"text", 'write'::"text"]))),
    CONSTRAINT "posts_platform_check" CHECK ((("platform" IS NULL) OR ("platform" = ANY (ARRAY['facebook'::"text", 'instagram'::"text"])))),
    CONSTRAINT "posts_source_check" CHECK (("source" = ANY (ARRAY['manual_copy_paste'::"text", 'auto'::"text"]))),
    CONSTRAINT "posts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'scheduled'::"text", 'published'::"text", 'archived'::"text", 'consumed'::"text"])))
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


COMMENT ON TABLE "public"."posts" IS 'Unified post storage: draft → scheduled → published → archived. Supports quick_suggestions, weekly_plan, and manual creation flows.';



COMMENT ON COLUMN "public"."posts"."status" IS 'Lifecycle: draft (being edited), scheduled (queued), published (posted), archived (hidden), consumed (used from daily_suggestions)';



COMMENT ON COLUMN "public"."posts"."idea_source" IS 'Where the post idea originated: manual, quick_suggestions, weekly_plan, write';



COMMENT ON COLUMN "public"."posts"."source" IS 'Publishing method: manual_copy_paste or auto';



COMMENT ON COLUMN "public"."posts"."generated_platform_content" IS 'Platform-specific content with text, hashtags, and CTA for each platform';



COMMENT ON COLUMN "public"."posts"."content_style" IS 'Content strategy dimension: 
- performance_driven: Product focus, urgency, specific offers, "book now" energy
- brand_building: Craft, values, team, process, emotional connection
- balanced: Hybrid approach blending product + story';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "business_type" "text",
    "onboarding_completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "plan" "text" DEFAULT 'free'::"text",
    "ai_generations_today" integer DEFAULT 0,
    "ai_generations_this_month" integer DEFAULT 0,
    "pdf_uploads_today" integer DEFAULT 0,
    "pdf_uploads_this_month" integer DEFAULT 0,
    "website_analysis_today" integer DEFAULT 0,
    "website_analysis_this_month" integer DEFAULT 0,
    "scheduled_posts_this_month" integer DEFAULT 0,
    "last_daily_reset" "date" DEFAULT CURRENT_DATE,
    "last_monthly_reset" "date" DEFAULT "date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone),
    "selected_platforms" "jsonb" DEFAULT '[]'::"jsonb",
    "business_name" "text",
    "address" "text",
    "country" "text" DEFAULT 'Danmark'::"text",
    "phone" "text",
    "business_email" "text",
    "about_text" "text",
    "business_category" "text",
    "website_url" "text",
    "opening_hours" "jsonb" DEFAULT '{"fre": {"open": "", "close": ""}, "man": {"open": "", "close": ""}, "ons": {"open": "", "close": ""}, "tir": {"open": "", "close": ""}, "tor": {"open": "", "close": ""}, "lør": {"open": "", "close": ""}, "søn": {"open": "", "close": ""}}'::"jsonb",
    "keywords" "text"[] DEFAULT '{}'::"text"[],
    "has_booking_button" boolean DEFAULT false,
    "profile_completed" boolean DEFAULT false,
    "social_platforms" "text"[] DEFAULT '{}'::"text"[],
    "logo_url" "text",
    CONSTRAINT "profiles_plan_check" CHECK (("plan" = ANY (ARRAY['free'::"text", 'standardplus'::"text", 'premium'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."plan" IS 'User tier: free, standardplus (Smart), or premium (Pro)';



COMMENT ON COLUMN "public"."profiles"."ai_generations_today" IS 'Count of AI generations used today';



COMMENT ON COLUMN "public"."profiles"."ai_generations_this_month" IS 'Count of AI generations used this month';



COMMENT ON COLUMN "public"."profiles"."last_daily_reset" IS 'Date when daily quotas were last reset';



COMMENT ON COLUMN "public"."profiles"."last_monthly_reset" IS 'Date when monthly quotas were last reset';



COMMENT ON COLUMN "public"."profiles"."selected_platforms" IS 'Array of platform names selected by user (e.g., ["facebook", "instagram"])';



COMMENT ON COLUMN "public"."profiles"."opening_hours" IS 'JSON object with Danish day names (man, tir, ons, tor, fre, lør, søn) each containing open and close times';



COMMENT ON COLUMN "public"."profiles"."keywords" IS 'Array of keywords describing the business (e.g., brunch, kaffe, herreklip)';



COMMENT ON COLUMN "public"."profiles"."social_platforms" IS 'Array of enabled social media platforms (e.g., facebook, instagram)';



COMMENT ON COLUMN "public"."profiles"."logo_url" IS 'URL to business logo image (extracted from website or manually entered)';



CREATE TABLE IF NOT EXISTS "public"."social_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "handle" "text",
    "profile_url" "text",
    "is_connected" boolean DEFAULT false,
    "access_token_encrypted" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "social_accounts_platform_check" CHECK (("platform" = ANY (ARRAY['facebook'::"text", 'instagram'::"text", 'tiktok'::"text", 'linkedin'::"text", 'twitter'::"text"])))
);


ALTER TABLE "public"."social_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suggested_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "business_id" "uuid",
    "post_content" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "idea_source" "text",
    "slot_id" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "scheduled_at" timestamp with time zone,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "suggested_posts_platform_check" CHECK (("platform" = ANY (ARRAY['facebook'::"text", 'instagram'::"text", 'linkedin'::"text", 'twitter'::"text", 'tiktok'::"text"]))),
    CONSTRAINT "suggested_posts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'scheduled'::"text", 'published'::"text", 'failed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."suggested_posts" OWNER TO "postgres";


COMMENT ON TABLE "public"."suggested_posts" IS 'Stores AI-generated post suggestions and their publishing status';



COMMENT ON COLUMN "public"."suggested_posts"."post_content" IS 'The actual post text/caption';



COMMENT ON COLUMN "public"."suggested_posts"."idea_source" IS 'What triggered this post idea (menu, vibe, occasion, etc)';



COMMENT ON COLUMN "public"."suggested_posts"."status" IS 'Lifecycle status: draft -> scheduled -> published/failed -> archived';



CREATE TABLE IF NOT EXISTS "public"."third_party_evidence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "google_maps_data" "jsonb",
    "instagram_data" "jsonb",
    "source_type" "text",
    "fetched_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "third_party_evidence_source_type_check" CHECK (("source_type" = ANY (ARRAY['google_maps'::"text", 'instagram'::"text", 'combined'::"text"])))
);


ALTER TABLE "public"."third_party_evidence" OWNER TO "postgres";


COMMENT ON TABLE "public"."third_party_evidence" IS 'Read-only third-party evidence from Google Maps and Instagram. Used to confirm interior visuals and recurring guest descriptors. Lower priority than first-party data. Never used for sentiment inflation.';



COMMENT ON COLUMN "public"."third_party_evidence"."google_maps_data" IS 'Google Maps photos (owner/customer) and recurring review patterns (3+ mentions). Used for visual confirmation and identifying strong repeated descriptors.';



COMMENT ON COLUMN "public"."third_party_evidence"."instagram_data" IS 'Business-owned Instagram content only (no customer posts). Used to confirm visual style and messaging patterns.';



CREATE OR REPLACE VIEW "public"."v5_profile_summary" AS
 SELECT "bbp"."business_id",
    "b"."name" AS "business_name",
    ("bbp"."brand_profile_v5" ->> 'version'::"text") AS "v5_version",
    "bbp"."brand_profile_v5_generated_at",
    "jsonb_array_length"(("bbp"."brand_profile_v5" -> 'programmes'::"text")) AS "programme_count",
    (("bbp"."brand_profile_v5" -> 'identity'::"text") ->> 'brand_essence'::"text") AS "brand_essence",
    "jsonb_array_length"((("bbp"."brand_profile_v5" -> 'voice'::"text") -> 'tone_rules'::"text")) AS "tone_rules_count",
    "jsonb_array_length"((("bbp"."brand_profile_v5" -> 'writing_examples'::"text") -> 'typical_openings'::"text")) AS "typical_openings_count",
    "jsonb_array_length"((("bbp"."brand_profile_v5" -> 'guardrails'::"text") -> 'never_say'::"text")) AS "never_say_count",
        CASE
            WHEN ("bbp"."brand_profile_v5" IS NULL) THEN 'Not Generated'::"text"
            WHEN (("bbp"."brand_profile_v5" -> 'voice'::"text") IS NULL) THEN 'Partial (Layers 1-4 only)'::"text"
            ELSE 'Complete (All 5 layers)'::"text"
        END AS "completeness_status"
   FROM ("public"."business_brand_profile" "bbp"
     LEFT JOIN "public"."businesses" "b" ON (("bbp"."business_id" = "b"."id")));


ALTER VIEW "public"."v5_profile_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."v5_profile_summary" IS 'Summary view of V5 profile status across all businesses. Useful for monitoring migration progress.';



CREATE TABLE IF NOT EXISTS "public"."weather_cache" (
    "city" "text" NOT NULL,
    "forecast" "jsonb" NOT NULL,
    "fetched_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."weather_cache" OWNER TO "postgres";


COMMENT ON TABLE "public"."weather_cache" IS 'Caches OpenWeatherMap 7-day forecasts to reduce API calls (TTL: 1 hour)';



COMMENT ON COLUMN "public"."weather_cache"."city" IS 'City name (lowercase, used as cache key)';



COMMENT ON COLUMN "public"."weather_cache"."forecast" IS 'Array of WeatherForecast objects from OpenWeatherMap API';



COMMENT ON COLUMN "public"."weather_cache"."fetched_at" IS 'Timestamp when forecast was fetched';



COMMENT ON COLUMN "public"."weather_cache"."expires_at" IS 'Timestamp when cache expires (fetched_at + 1 hour)';



CREATE TABLE IF NOT EXISTS "public"."website_analyses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "source_url" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "last_run_at" timestamp with time zone,
    "raw_result" "jsonb",
    "error_message" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "raw_html" "text",
    "cta_texts" "text"[],
    "headers" "text"[],
    "nav_items" "text"[],
    "hero_texts" "text"[],
    "homepage_content" "text",
    "about_content" "text",
    "detected_links" "jsonb",
    "about_block" "text",
    "keywords" "text"[],
    "menu_structure" "jsonb",
    CONSTRAINT "website_analyses_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'success'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."website_analyses" OWNER TO "postgres";


COMMENT ON COLUMN "public"."website_analyses"."raw_html" IS 'Truncated raw HTML of homepage (best-effort, for debugging/rehydration)';



COMMENT ON COLUMN "public"."website_analyses"."cta_texts" IS 'Extracted button/link CTA texts from HTML';



COMMENT ON COLUMN "public"."website_analyses"."headers" IS 'Extracted H1/H2 texts from HTML';



COMMENT ON COLUMN "public"."website_analyses"."nav_items" IS 'Extracted navigation item texts from HTML';



COMMENT ON COLUMN "public"."website_analyses"."hero_texts" IS 'Extracted hero/banner text snippets from HTML';



COMMENT ON COLUMN "public"."website_analyses"."homepage_content" IS 'Clean text extracted from homepage for AI processing';



COMMENT ON COLUMN "public"."website_analyses"."about_content" IS 'Clean text from About page if crawled';



COMMENT ON COLUMN "public"."website_analyses"."detected_links" IS 'Detected URLs: {menu_urls:[], booking_url:"", contact_url:""}';



COMMENT ON COLUMN "public"."website_analyses"."about_block" IS 'Pre-extracted about/welcome text from homepage';



COMMENT ON COLUMN "public"."website_analyses"."keywords" IS 'AI-extracted keywords about the business';



COMMENT ON COLUMN "public"."website_analyses"."menu_structure" IS 'Structured menu data: [{name, timeRange, items}]';



CREATE TABLE IF NOT EXISTS "public"."weekly_content_plans" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "business_id" "uuid" NOT NULL,
    "week_number" integer NOT NULL,
    "week_start" "date" NOT NULL,
    "week_end" "date" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"(),
    "posts" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "summary" "jsonb" DEFAULT '{}'::"jsonb",
    "learning_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "strategy_id" "uuid"
);


ALTER TABLE "public"."weekly_content_plans" OWNER TO "postgres";


COMMENT ON TABLE "public"."weekly_content_plans" IS 'Stores AI-generated weekly content plans with 4-7 post specifications';



COMMENT ON COLUMN "public"."weekly_content_plans"."strategy_id" IS 'Link to Layer 0 strategy that drove this plan. NULL for legacy plans generated without Layer 0.';



CREATE TABLE IF NOT EXISTS "public"."weekly_strategies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "week_number" integer NOT NULL,
    "week_start" "date" NOT NULL,
    "week_end" "date" NOT NULL,
    "is_current_week" boolean DEFAULT false,
    "narrative" "jsonb" NOT NULL,
    "strategic_priorities" "jsonb" NOT NULL,
    "post_ideas" "jsonb" NOT NULL,
    "selected_idea_ids" integer[],
    "week_context_snapshot" "jsonb",
    "business_type" "text" NOT NULL,
    "country" "text" DEFAULT 'DK'::"text",
    "generated_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'generated'::"text",
    "platforms" "text"[] DEFAULT ARRAY['facebook'::"text", 'instagram'::"text"],
    "subscription_tier" "text" DEFAULT 'smart'::"text",
    "target_post_count" integer DEFAULT 5,
    "strategy_version" "text" DEFAULT 'v2_two_phase'::"text",
    "strategy_rationale" "text",
    "strategic_brief" "jsonb",
    "strategic_brief_raw" "text",
    CONSTRAINT "weekly_strategies_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'generated'::"text", 'ideas_selected'::"text", 'posts_created'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."weekly_strategies" OWNER TO "postgres";


COMMENT ON TABLE "public"."weekly_strategies" IS 'Layer 0 strategic analysis output. Stores 7 post ideas per week, user selection, and full context snapshot.';



COMMENT ON COLUMN "public"."weekly_strategies"."selected_idea_ids" IS 'Array of idea IDs (1-7) that user selected to proceed with. NULL until user makes selection.';



COMMENT ON COLUMN "public"."weekly_strategies"."week_context_snapshot" IS 'Full WeekContext JSON used to generate strategy. Useful for debugging and future ML training.';



COMMENT ON COLUMN "public"."weekly_strategies"."status" IS 'Workflow status: pending → generated → ideas_selected → posts_created | error';



COMMENT ON COLUMN "public"."weekly_strategies"."platforms" IS 'Active social media platforms for this strategy';



COMMENT ON COLUMN "public"."weekly_strategies"."subscription_tier" IS 'Subscription tier (smart or pro) at time of generation';



COMMENT ON COLUMN "public"."weekly_strategies"."target_post_count" IS 'Number of post ideas generated based on preferred_posts_per_week';



COMMENT ON COLUMN "public"."weekly_strategies"."strategy_version" IS 'Strategy generation version/architecture. Used to separate analytics across major changes.
- v1_single_phase: Original single-pass generation
- v2_two_phase: Current architecture (Phase 1 strategic brief → Phase 2 content plan)
- v2.1_brand_v5: V5 brand profile integration';



COMMENT ON COLUMN "public"."weekly_strategies"."strategy_rationale" IS 'Weekly modulation rationale from strategy-modulator.ts. 1-2 sentences in Danish explaining why this week goal_blend / content_category_weights deviate from the brand baseline. NULL or contains "Ingen markante" when baseline was used unchanged.';



COMMENT ON COLUMN "public"."weekly_strategies"."strategic_brief" IS 'Phase 1 strategic analysis output: angles, competitive advantage, content types, week summary. Used by Phase 2/3 for post generation.';



COMMENT ON COLUMN "public"."weekly_strategies"."strategic_brief_raw" IS 'Raw AI response text before JSON parsing (for debugging and quality monitoring).';



CREATE TABLE IF NOT EXISTS "public"."write_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "business_id" "uuid" NOT NULL,
    "content" "jsonb",
    "photo_content" "jsonb",
    "selected_platforms" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."write_drafts" OWNER TO "postgres";


COMMENT ON TABLE "public"."write_drafts" IS 'Single live draft per user+business for Skriv Selv mode. Deleted when user clears content or moves to Udgiv stage.';



ALTER TABLE ONLY "public"."daily_suggestions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."daily_suggestions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."brand_profile_sources_state"
    ADD CONSTRAINT "brand_profile_sources_state_pkey" PRIMARY KEY ("business_id");



ALTER TABLE ONLY "public"."business_brand_profile"
    ADD CONSTRAINT "business_brand_profile_pkey" PRIMARY KEY ("business_id");



ALTER TABLE ONLY "public"."business_documents"
    ADD CONSTRAINT "business_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_documents"
    ADD CONSTRAINT "business_documents_storage_path_key" UNIQUE ("storage_path");



ALTER TABLE ONLY "public"."business_location_intelligence"
    ADD CONSTRAINT "business_location_intelligence_pkey" PRIMARY KEY ("business_id");



ALTER TABLE ONLY "public"."business_locations"
    ADD CONSTRAINT "business_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_operations"
    ADD CONSTRAINT "business_operations_pkey" PRIMARY KEY ("business_id");



ALTER TABLE ONLY "public"."business_profile"
    ADD CONSTRAINT "business_profile_pkey" PRIMARY KEY ("business_id");



ALTER TABLE ONLY "public"."business_programme_profiles"
    ADD CONSTRAINT "business_programme_profiles_business_id_programme_type_key" UNIQUE ("business_id", "programme_type");



ALTER TABLE ONLY "public"."business_programme_profiles"
    ADD CONSTRAINT "business_programme_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_staff"
    ADD CONSTRAINT "business_staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_team_members"
    ADD CONSTRAINT "business_team_members_business_id_user_id_key" UNIQUE ("business_id", "user_id");



ALTER TABLE ONLY "public"."business_team_members"
    ADD CONSTRAINT "business_team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_owner_id_key" UNIQUE ("owner_id");



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."city_context_cache"
    ADD CONSTRAINT "city_context_cache_city_country_key" UNIQUE ("city", "country");



ALTER TABLE ONLY "public"."city_context_cache"
    ADD CONSTRAINT "city_context_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contextual_calendar"
    ADD CONSTRAINT "contextual_calendar_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_suggestions"
    ADD CONSTRAINT "daily_suggestions_business_date_position_source_key" UNIQUE ("business_id", "date", "position", "source");



COMMENT ON CONSTRAINT "daily_suggestions_business_date_position_source_key" ON "public"."daily_suggestions" IS 'Allows Weekly Plan and Quick Suggestions to coexist: same business can have 3 suggestions from each system per day.';



ALTER TABLE ONLY "public"."daily_suggestions"
    ADD CONSTRAINT "daily_suggestions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media_assets"
    ADD CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media_library"
    ADD CONSTRAINT "media_library_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media_library"
    ADD CONSTRAINT "media_library_storage_path_key" UNIQUE ("storage_path");



ALTER TABLE ONLY "public"."menu_items_normalized"
    ADD CONSTRAINT "menu_items_normalized_menu_result_id_item_name_category_nam_key" UNIQUE ("menu_result_id", "item_name", "category_name");



ALTER TABLE ONLY "public"."menu_items_normalized"
    ADD CONSTRAINT "menu_items_normalized_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_results_v2"
    ADD CONSTRAINT "menu_results_v2_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_sources"
    ADD CONSTRAINT "menu_sources_business_id_source_url_key" UNIQUE ("business_id", "source_url");



ALTER TABLE ONLY "public"."menu_sources"
    ADD CONSTRAINT "menu_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."opening_hours"
    ADD CONSTRAINT "opening_hours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_intelligence"
    ADD CONSTRAINT "platform_intelligence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_accounts"
    ADD CONSTRAINT "social_accounts_business_id_platform_key" UNIQUE ("business_id", "platform");



ALTER TABLE ONLY "public"."social_accounts"
    ADD CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suggested_posts"
    ADD CONSTRAINT "suggested_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."third_party_evidence"
    ADD CONSTRAINT "third_party_evidence_business_unique" UNIQUE ("business_id");



ALTER TABLE ONLY "public"."third_party_evidence"
    ADD CONSTRAINT "third_party_evidence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weather_cache"
    ADD CONSTRAINT "weather_cache_pkey" PRIMARY KEY ("city");



ALTER TABLE ONLY "public"."website_analyses"
    ADD CONSTRAINT "website_analyses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_content_plans"
    ADD CONSTRAINT "weekly_content_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_strategies"
    ADD CONSTRAINT "weekly_strategies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."write_drafts"
    ADD CONSTRAINT "write_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."write_drafts"
    ADD CONSTRAINT "write_drafts_user_business_unique" UNIQUE ("user_id", "business_id");



CREATE INDEX "idx_brand_profile_archetype" ON "public"."business_brand_profile" USING "btree" ("business_archetype") WHERE ("business_archetype" IS NOT NULL);



CREATE INDEX "idx_brand_profile_gastronomic_profile" ON "public"."business_brand_profile" USING "btree" ("business_id") WHERE ("gastronomic_profile" IS NOT NULL);



CREATE INDEX "idx_brand_profile_signature_themes" ON "public"."business_brand_profile" USING "gin" ("signature_themes");



CREATE INDEX "idx_brand_profile_sources_state_version_hash" ON "public"."brand_profile_sources_state" USING "btree" ("version_hash");



CREATE INDEX "idx_brand_profile_v5_generated_at" ON "public"."business_brand_profile" USING "btree" ("brand_profile_v5_generated_at" DESC);



CREATE INDEX "idx_brand_profile_v5_version" ON "public"."business_brand_profile" USING "btree" ((("brand_profile_v5" ->> 'version'::"text")));



CREATE INDEX "idx_business_brand_profile_execution_profile" ON "public"."business_brand_profile" USING "gin" ("execution_profile");



CREATE INDEX "idx_business_brand_profile_has_menu_overview" ON "public"."business_brand_profile" USING "btree" ((("menu_overview_summary" IS NOT NULL)));



CREATE INDEX "idx_business_brand_profile_location_strategy" ON "public"."business_brand_profile" USING "gin" ("location_strategy") WHERE ("location_strategy" IS NOT NULL);



CREATE INDEX "idx_business_brand_profile_revenue_drivers" ON "public"."business_brand_profile" USING "gin" ("revenue_drivers");



COMMENT ON INDEX "public"."idx_business_brand_profile_revenue_drivers" IS 'Performance index for querying revenue_drivers JSONB fields (e.g., primary_revenue_moment, normal_week_strategy)';



CREATE INDEX "idx_business_brand_profile_version_hash" ON "public"."business_brand_profile" USING "btree" ("version_hash");



CREATE INDEX "idx_business_documents_business_id" ON "public"."business_documents" USING "btree" ("business_id");



CREATE INDEX "idx_business_documents_json" ON "public"."business_documents" USING "gin" ("extracted_json");



CREATE INDEX "idx_business_documents_type" ON "public"."business_documents" USING "btree" ("business_id", "document_type");



CREATE INDEX "idx_business_identity_persona" ON "public"."business_brand_profile" USING "btree" ("business_identity_persona");



CREATE INDEX "idx_business_location_coordinates" ON "public"."business_location_intelligence" USING "btree" ("latitude", "longitude");



CREATE INDEX "idx_business_locations_enrichment" ON "public"."business_locations" USING "gin" ("enrichment");



CREATE INDEX "idx_business_operations_price_level" ON "public"."business_operations" USING "btree" ("price_level");



CREATE INDEX "idx_business_profile_brand_context_generated" ON "public"."business_profile" USING "btree" ("ai_brand_context_generated_at") WHERE ("ai_brand_context" IS NOT NULL);



CREATE INDEX "idx_business_profile_menu_structure" ON "public"."business_profile" USING "gin" ("menu_structure");



CREATE INDEX "idx_business_programme_profiles_business_id" ON "public"."business_programme_profiles" USING "btree" ("business_id");



CREATE INDEX "idx_business_programme_profiles_menu_results_v2_id" ON "public"."business_programme_profiles" USING "btree" ("menu_results_v2_id");



CREATE INDEX "idx_business_programme_profiles_programme_type" ON "public"."business_programme_profiles" USING "btree" ("programme_type");



CREATE INDEX "idx_business_programme_profiles_updated_at" ON "public"."business_programme_profiles" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_business_staff_business_id" ON "public"."business_staff" USING "btree" ("business_id");



CREATE INDEX "idx_businesses_local_location_reference" ON "public"."businesses" USING "btree" ("local_location_reference") WHERE ("local_location_reference" IS NOT NULL);



CREATE INDEX "idx_businesses_plan" ON "public"."businesses" USING "btree" ("plan");



CREATE INDEX "idx_city_context_cache_cached_until" ON "public"."city_context_cache" USING "btree" ("cached_until");



CREATE INDEX "idx_city_context_cache_city_country" ON "public"."city_context_cache" USING "btree" ("city", "country");



CREATE INDEX "idx_contextual_calendar_country" ON "public"."contextual_calendar" USING "btree" ("country");



CREATE INDEX "idx_contextual_calendar_dates" ON "public"."contextual_calendar" USING "btree" ("date_start", "date_end");



CREATE INDEX "idx_contextual_calendar_tags" ON "public"."contextual_calendar" USING "gin" ("relevance_tags");



CREATE INDEX "idx_contextual_calendar_type" ON "public"."contextual_calendar" USING "btree" ("event_type");



CREATE INDEX "idx_daily_suggestions_active" ON "public"."daily_suggestions" USING "btree" ("business_id", "date", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_daily_suggestions_available" ON "public"."daily_suggestions" USING "btree" ("business_id", "date") WHERE ("status" = 'available'::"text");



CREATE INDEX "idx_daily_suggestions_business_date" ON "public"."daily_suggestions" USING "btree" ("business_id", "date");



CREATE INDEX "idx_daily_suggestions_business_date_status" ON "public"."daily_suggestions" USING "btree" ("business_id", "date", "status");



CREATE INDEX "idx_daily_suggestions_content_type" ON "public"."daily_suggestions" USING "btree" ("inferred_content_type") WHERE ("inferred_content_type" IS NOT NULL);



CREATE INDEX "idx_daily_suggestions_date" ON "public"."daily_suggestions" USING "btree" ("date");



CREATE INDEX "idx_daily_suggestions_generation_cache" ON "public"."daily_suggestions" USING "btree" ("text_generation_version", "generated_at") WHERE ("generated_at" IS NOT NULL);



CREATE INDEX "idx_daily_suggestions_media" ON "public"."daily_suggestions" USING "gin" ("media_items") WHERE ("media_items" IS NOT NULL);



CREATE INDEX "idx_daily_suggestions_menu_item" ON "public"."daily_suggestions" USING "btree" ("business_id", "menu_item_name", "created_at" DESC) WHERE ("menu_item_name" IS NOT NULL);



COMMENT ON INDEX "public"."idx_daily_suggestions_menu_item" IS 'Fast lookup: which dishes were recently suggested (avoid re-suggesting)';



CREATE INDEX "idx_daily_suggestions_occasion" ON "public"."daily_suggestions" USING "btree" ("business_id", "date") WHERE ("occasion_context" IS NOT NULL);



CREATE INDEX "idx_daily_suggestions_photo" ON "public"."daily_suggestions" USING "btree" ("uploaded_photo_url") WHERE ("uploaded_photo_url" IS NOT NULL);



CREATE INDEX "idx_daily_suggestions_selected" ON "public"."daily_suggestions" USING "btree" ("business_id", "selected") WHERE ("selected" = true);



CREATE INDEX "idx_daily_suggestions_service_period" ON "public"."daily_suggestions" USING "btree" ("business_id", "service_period", "created_at" DESC) WHERE ("service_period" IS NOT NULL);



COMMENT ON INDEX "public"."idx_daily_suggestions_service_period" IS 'Fast lookup: get suggestions for current service period (brunch/lunch/dinner)';



CREATE INDEX "idx_daily_suggestions_source" ON "public"."daily_suggestions" USING "btree" ("business_id", "source", "date");



COMMENT ON INDEX "public"."idx_daily_suggestions_source" IS 'Performance index for querying suggestions by system source (weekly_plan vs quick_suggestions)';



CREATE UNIQUE INDEX "idx_daily_suggestions_unique_state" ON "public"."daily_suggestions" USING "btree" ("business_id", "date", "position", "source", "status");



CREATE INDEX "idx_daily_suggestions_validation" ON "public"."daily_suggestions" USING "gin" ("validation_result") WHERE ("validation_result" IS NOT NULL);



CREATE INDEX "idx_enhanced_avoid_examples" ON "public"."business_brand_profile" USING "gin" ("enhanced_avoid_examples");



CREATE INDEX "idx_enhanced_social_examples" ON "public"."business_brand_profile" USING "gin" ("enhanced_social_examples");



CREATE INDEX "idx_location_demographic_proximity" ON "public"."business_location_intelligence" USING "gin" ("demographic_proximity");



CREATE INDEX "idx_location_traffic_rhythm" ON "public"."business_location_intelligence" USING "gin" ("traffic_rhythm");



CREATE INDEX "idx_location_who" ON "public"."business_location_intelligence" USING "gin" ("who");



CREATE INDEX "idx_media_library_business_id" ON "public"."media_library" USING "btree" ("business_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_media_library_media_type" ON "public"."media_library" USING "btree" ("media_type") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_media_library_menu_item_id" ON "public"."media_library" USING "btree" ("menu_item_id") WHERE (("deleted_at" IS NULL) AND ("menu_item_id" IS NOT NULL));



CREATE INDEX "idx_media_library_post_type" ON "public"."media_library" USING "btree" ("post_type") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_media_library_tags" ON "public"."media_library" USING "gin" ("tags") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_media_library_upload_date" ON "public"."media_library" USING "btree" ("upload_date" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_media_library_usage_count" ON "public"."media_library" USING "btree" ("usage_count" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_media_library_user_id" ON "public"."media_library" USING "btree" ("user_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_menu_items_active" ON "public"."menu_items_normalized" USING "btree" ("business_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_menu_items_normalized_business" ON "public"."menu_items_normalized" USING "btree" ("business_id");



CREATE INDEX "idx_menu_items_normalized_category_type" ON "public"."menu_items_normalized" USING "btree" ("category_type");



CREATE INDEX "idx_menu_items_normalized_language" ON "public"."menu_items_normalized" USING "btree" ("business_id", "menu_language") WHERE ("menu_language" IS NOT NULL);



CREATE INDEX "idx_menu_items_normalized_menu_result" ON "public"."menu_items_normalized" USING "btree" ("menu_result_id");



CREATE INDEX "idx_menu_items_normalized_service_periods" ON "public"."menu_items_normalized" USING "gin" ("service_periods");



CREATE INDEX "idx_menu_items_normalized_signature" ON "public"."menu_items_normalized" USING "btree" ("is_signature") WHERE ("is_signature" = true);



CREATE INDEX "idx_menu_items_normalized_temp_category" ON "public"."menu_items_normalized" USING "btree" ("dish_temp_category");



CREATE INDEX "idx_menu_results_v2_business_status" ON "public"."menu_results_v2" USING "btree" ("business_id", "status");



CREATE INDEX "idx_menu_results_v2_claimed_at" ON "public"."menu_results_v2" USING "btree" ("claimed_at");



CREATE INDEX "idx_menu_results_v2_representative_dishes" ON "public"."menu_results_v2" USING "gin" ("representative_dishes");



CREATE INDEX "idx_menu_results_v2_service_periods" ON "public"."menu_results_v2" USING "gin" ("service_periods");



CREATE INDEX "idx_menu_results_v2_sha" ON "public"."menu_results_v2" USING "btree" ("sha256");



CREATE INDEX "idx_menu_results_v2_signature" ON "public"."menu_results_v2" USING "btree" ("business_id", "is_signature") WHERE ("is_signature" = true);



CREATE INDEX "idx_menu_results_v2_source_id" ON "public"."menu_results_v2" USING "btree" ("source_id");



CREATE INDEX "idx_menu_results_v2_status_created_at" ON "public"."menu_results_v2" USING "btree" ("status", "created_at");



CREATE INDEX "idx_menu_sources_business_id" ON "public"."menu_sources" USING "btree" ("business_id");



CREATE INDEX "idx_menu_sources_status" ON "public"."menu_sources" USING "btree" ("business_id", "status");



CREATE INDEX "idx_posts_business_status" ON "public"."posts" USING "btree" ("business_id", "status", "created_at" DESC);



CREATE INDEX "idx_posts_content_style" ON "public"."posts" USING "btree" ("business_id", "content_style") WHERE ("content_style" IS NOT NULL);



CREATE INDEX "idx_posts_date" ON "public"."posts" USING "btree" ("business_id", "date" DESC) WHERE ("date" IS NOT NULL);



CREATE INDEX "idx_posts_drafts" ON "public"."posts" USING "btree" ("business_id", "updated_at" DESC) WHERE ("status" = 'draft'::"text");



CREATE INDEX "idx_posts_published" ON "public"."posts" USING "btree" ("business_id", "posted_at" DESC) WHERE ("status" = 'published'::"text");



CREATE INDEX "idx_posts_scheduled" ON "public"."posts" USING "btree" ("business_id", "scheduled_for") WHERE ("status" = 'scheduled'::"text");



CREATE INDEX "idx_posts_suggestion" ON "public"."posts" USING "btree" ("business_id", "suggestion_id", "status") WHERE ("suggestion_id" IS NOT NULL);



CREATE INDEX "idx_posts_user" ON "public"."posts" USING "btree" ("user_id", "created_at" DESC) WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_posts_weekly_plan_slot" ON "public"."posts" USING "btree" ("business_id", "weekly_plan_slot_date", "status") WHERE ("weekly_plan_slot_date" IS NOT NULL);



CREATE INDEX "idx_profiles_business_name" ON "public"."profiles" USING "btree" ("business_name");



CREATE INDEX "idx_profiles_plan" ON "public"."profiles" USING "btree" ("plan");



CREATE INDEX "idx_profiles_social_platforms" ON "public"."profiles" USING "gin" ("social_platforms");



CREATE INDEX "idx_profiles_website_url" ON "public"."profiles" USING "btree" ("website_url");



CREATE INDEX "idx_programme_price_tier" ON "public"."business_programme_profiles" USING "btree" ((("price_positioning" ->> 'tier'::"text")));



CREATE INDEX "idx_social_writing_examples" ON "public"."business_brand_profile" USING "gin" ("social_writing_examples");



CREATE INDEX "idx_strategic_audience_segments" ON "public"."business_brand_profile" USING "gin" ("strategic_audience_segments");



CREATE INDEX "idx_suggested_posts_business_id" ON "public"."suggested_posts" USING "btree" ("business_id");



CREATE INDEX "idx_suggested_posts_created_at" ON "public"."suggested_posts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_suggested_posts_platform" ON "public"."suggested_posts" USING "btree" ("platform");



CREATE INDEX "idx_suggested_posts_published_lookup" ON "public"."suggested_posts" USING "btree" ("user_id", "status", "created_at" DESC) WHERE ("status" = 'published'::"text");



CREATE INDEX "idx_suggested_posts_status" ON "public"."suggested_posts" USING "btree" ("status");



CREATE INDEX "idx_suggested_posts_user_id" ON "public"."suggested_posts" USING "btree" ("user_id");



CREATE INDEX "idx_third_party_evidence_business_id" ON "public"."third_party_evidence" USING "btree" ("business_id");



CREATE INDEX "idx_third_party_evidence_updated_at" ON "public"."third_party_evidence" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_tone_model_confidence" ON "public"."business_brand_profile" USING "btree" ((("tone_model" ->> 'confidence'::"text"))) WHERE ("tone_model" IS NOT NULL);



CREATE INDEX "idx_tone_model_keywords_lang" ON "public"."business_brand_profile" USING "gin" ((("tone_model" -> 'primary_keywords'::"text")), (("tone_model" -> 'language'::"text")));



CREATE INDEX "idx_voice_guardrails" ON "public"."business_brand_profile" USING "gin" ("voice_guardrails");



CREATE INDEX "idx_weather_cache_expires" ON "public"."weather_cache" USING "btree" ("expires_at");



CREATE INDEX "idx_weekly_content_plans_strategy_id" ON "public"."weekly_content_plans" USING "btree" ("strategy_id") WHERE ("strategy_id" IS NOT NULL);



CREATE INDEX "idx_weekly_plans_business" ON "public"."weekly_content_plans" USING "btree" ("business_id");



CREATE INDEX "idx_weekly_plans_user" ON "public"."weekly_content_plans" USING "btree" ("user_id");



CREATE INDEX "idx_weekly_plans_user_week" ON "public"."weekly_content_plans" USING "btree" ("user_id", "week_start");



CREATE INDEX "idx_weekly_plans_week_start" ON "public"."weekly_content_plans" USING "btree" ("week_start");



CREATE INDEX "idx_weekly_strategies_business_id" ON "public"."weekly_strategies" USING "btree" ("business_id");



CREATE INDEX "idx_weekly_strategies_status" ON "public"."weekly_strategies" USING "btree" ("business_id", "status");



CREATE INDEX "idx_weekly_strategies_strategic_brief_gin" ON "public"."weekly_strategies" USING "gin" ("strategic_brief");



CREATE UNIQUE INDEX "idx_weekly_strategies_unique_week" ON "public"."weekly_strategies" USING "btree" ("business_id", "week_start");



CREATE INDEX "idx_weekly_strategies_version" ON "public"."weekly_strategies" USING "btree" ("business_id", "strategy_version");



CREATE INDEX "idx_weekly_strategies_week_start" ON "public"."weekly_strategies" USING "btree" ("business_id", "week_start");



CREATE INDEX "write_drafts_user_business_idx" ON "public"."write_drafts" USING "btree" ("user_id", "business_id");



CREATE OR REPLACE TRIGGER "media_library_updated_at" BEFORE UPDATE ON "public"."media_library" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "menu_results_v2_updated_at" BEFORE UPDATE ON "public"."menu_results_v2" FOR EACH ROW EXECUTE FUNCTION "public"."update_menu_results_v2_updated_at"();



CREATE OR REPLACE TRIGGER "on_profile_updated" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "posts_updated_at" BEFORE UPDATE ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_posts_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_sync_menu_items_on_extraction" AFTER UPDATE OF "status" ON "public"."menu_results_v2" FOR EACH ROW WHEN ((("new"."status" = 'done'::"text") AND (("old"."status" IS NULL) OR ("old"."status" <> 'done'::"text")))) EXECUTE FUNCTION "public"."sync_menu_items_to_normalized"();



COMMENT ON TRIGGER "trigger_sync_menu_items_on_extraction" ON "public"."menu_results_v2" IS 'Triggers menu item normalization when extraction completes (status changes to done)';



CREATE OR REPLACE TRIGGER "trigger_update_suggested_posts_updated_at" BEFORE UPDATE ON "public"."suggested_posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_suggested_posts_updated_at"();



CREATE OR REPLACE TRIGGER "update_business_location_intelligence_updated_at" BEFORE UPDATE ON "public"."business_location_intelligence" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_business_operations_updated_at" BEFORE UPDATE ON "public"."business_operations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_business_programme_profiles_updated_at" BEFORE UPDATE ON "public"."business_programme_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_business_programme_profiles_updated_at"();



CREATE OR REPLACE TRIGGER "update_business_staff_updated_at" BEFORE UPDATE ON "public"."business_staff" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."brand_profile_sources_state"
    ADD CONSTRAINT "brand_profile_sources_state_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_brand_profile"
    ADD CONSTRAINT "business_brand_profile_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_documents"
    ADD CONSTRAINT "business_documents_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_location_intelligence"
    ADD CONSTRAINT "business_location_intelligence_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_locations"
    ADD CONSTRAINT "business_locations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_operations"
    ADD CONSTRAINT "business_operations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_profile"
    ADD CONSTRAINT "business_profile_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_programme_profiles"
    ADD CONSTRAINT "business_programme_profiles_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_programme_profiles"
    ADD CONSTRAINT "business_programme_profiles_menu_results_v2_id_fkey" FOREIGN KEY ("menu_results_v2_id") REFERENCES "public"."menu_results_v2"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_staff"
    ADD CONSTRAINT "business_staff_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_team_members"
    ADD CONSTRAINT "business_team_members_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_team_members"
    ADD CONSTRAINT "business_team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_suggestions"
    ADD CONSTRAINT "daily_suggestions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media_assets"
    ADD CONSTRAINT "media_assets_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media_library"
    ADD CONSTRAINT "media_library_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items_normalized"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."media_library"
    ADD CONSTRAINT "media_library_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_items_normalized"
    ADD CONSTRAINT "menu_items_normalized_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_items_normalized"
    ADD CONSTRAINT "menu_items_normalized_menu_result_id_fkey" FOREIGN KEY ("menu_result_id") REFERENCES "public"."menu_results_v2"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_results_v2"
    ADD CONSTRAINT "menu_results_v2_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_results_v2"
    ADD CONSTRAINT "menu_results_v2_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."menu_sources"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_sources"
    ADD CONSTRAINT "menu_sources_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_sources"
    ADD CONSTRAINT "menu_sources_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."opening_hours"
    ADD CONSTRAINT "opening_hours_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_strategy_id_fkey" FOREIGN KEY ("strategy_id") REFERENCES "public"."weekly_content_plans"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_suggestion_id_fkey" FOREIGN KEY ("suggestion_id") REFERENCES "public"."daily_suggestions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_weekly_plan_id_fkey" FOREIGN KEY ("weekly_plan_id") REFERENCES "public"."weekly_content_plans"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."social_accounts"
    ADD CONSTRAINT "social_accounts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."suggested_posts"
    ADD CONSTRAINT "suggested_posts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."suggested_posts"
    ADD CONSTRAINT "suggested_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."third_party_evidence"
    ADD CONSTRAINT "third_party_evidence_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."website_analyses"
    ADD CONSTRAINT "website_analyses_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weekly_content_plans"
    ADD CONSTRAINT "weekly_content_plans_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weekly_content_plans"
    ADD CONSTRAINT "weekly_content_plans_strategy_id_fkey" FOREIGN KEY ("strategy_id") REFERENCES "public"."weekly_strategies"("id");



ALTER TABLE ONLY "public"."weekly_content_plans"
    ADD CONSTRAINT "weekly_content_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weekly_strategies"
    ADD CONSTRAINT "weekly_strategies_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."write_drafts"
    ADD CONSTRAINT "write_drafts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."write_drafts"
    ADD CONSTRAINT "write_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow delete for service role" ON "public"."menu_items_normalized" FOR DELETE TO "service_role" USING (true);



CREATE POLICY "Allow insert for service role" ON "public"."menu_items_normalized" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Allow read access for authenticated users" ON "public"."menu_items_normalized" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow update for service role" ON "public"."menu_items_normalized" FOR UPDATE TO "service_role" USING (true);



CREATE POLICY "Authenticated users can read platform intelligence" ON "public"."platform_intelligence" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "City context is publicly readable" ON "public"."city_context_cache" FOR SELECT USING (true);



CREATE POLICY "Service role can insert city context" ON "public"."city_context_cache" FOR INSERT WITH CHECK (true);



CREATE POLICY "Service role can insert third-party evidence" ON "public"."third_party_evidence" FOR INSERT WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage platform intelligence" ON "public"."platform_intelligence" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can read brand profiles" ON "public"."business_brand_profile" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Service role can update city context" ON "public"."city_context_cache" FOR UPDATE USING (true);



CREATE POLICY "Service role can update third-party evidence" ON "public"."third_party_evidence" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Staff are viewable by everyone" ON "public"."business_staff" FOR SELECT USING (true);



CREATE POLICY "System can manage sources state" ON "public"."brand_profile_sources_state" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Team members can view brand profile" ON "public"."business_brand_profile" FOR SELECT USING (("business_id" IN ( SELECT "business_team_members"."business_id"
   FROM "public"."business_team_members"
  WHERE (("business_team_members"."user_id" = "auth"."uid"()) AND ("business_team_members"."accepted_at" IS NOT NULL)))));



CREATE POLICY "Team members can view business locations" ON "public"."business_locations" FOR SELECT USING (("business_id" IN ( SELECT "business_team_members"."business_id"
   FROM "public"."business_team_members"
  WHERE (("business_team_members"."user_id" = "auth"."uid"()) AND ("business_team_members"."accepted_at" IS NOT NULL)))));



CREATE POLICY "Team members can view business profile" ON "public"."business_profile" FOR SELECT USING (("business_id" IN ( SELECT "business_team_members"."business_id"
   FROM "public"."business_team_members"
  WHERE (("business_team_members"."user_id" = "auth"."uid"()) AND ("business_team_members"."accepted_at" IS NOT NULL)))));



CREATE POLICY "Team members can view opening hours" ON "public"."opening_hours" FOR SELECT USING (("business_id" IN ( SELECT "business_team_members"."business_id"
   FROM "public"."business_team_members"
  WHERE (("business_team_members"."user_id" = "auth"."uid"()) AND ("business_team_members"."accepted_at" IS NOT NULL)))));



CREATE POLICY "Users can create their own weekly plans" ON "public"."weekly_content_plans" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete opening hours" ON "public"."opening_hours" FOR DELETE USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own business posts" ON "public"."posts" FOR DELETE USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own drafts" ON "public"."write_drafts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their business locations" ON "public"."business_locations" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."businesses"
  WHERE (("businesses"."id" = "business_locations"."business_id") AND ("businesses"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete their business menu results v2" ON "public"."menu_results_v2" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "menu_results_v2"."business_id") AND ("b"."owner_id" = "auth"."uid"())))));



COMMENT ON POLICY "Users can delete their business menu results v2" ON "public"."menu_results_v2" IS 'Allows business owners to delete menu extraction results for their own businesses';



CREATE POLICY "Users can delete their business operations" ON "public"."business_operations" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."businesses"
  WHERE (("businesses"."id" = "business_operations"."business_id") AND ("businesses"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete their business profile" ON "public"."business_profile" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."businesses"
  WHERE (("businesses"."id" = "business_profile"."business_id") AND ("businesses"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete their business strategies" ON "public"."weekly_strategies" FOR DELETE TO "authenticated" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete their own business documents" ON "public"."business_documents" FOR DELETE USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete their own business menu sources" ON "public"."menu_sources" FOR DELETE USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete their own businesses" ON "public"."businesses" FOR DELETE USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own daily suggestions" ON "public"."daily_suggestions" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."businesses"
  WHERE (("businesses"."id" = "daily_suggestions"."business_id") AND ("businesses"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete their own posts" ON "public"."suggested_posts" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own weekly plans" ON "public"."weekly_content_plans" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert brand profile" ON "public"."business_brand_profile" FOR INSERT WITH CHECK (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert business profile" ON "public"."business_profile" FOR INSERT WITH CHECK (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert documents for their businesses" ON "public"."business_documents" FOR INSERT WITH CHECK (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert menu sources for their business" ON "public"."menu_sources" FOR INSERT WITH CHECK (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



COMMENT ON POLICY "Users can insert menu sources for their business" ON "public"."menu_sources" IS 'Allows users to insert menu sources for businesses they own. created_by check removed to allow Edge Functions to insert on behalf of users.';



CREATE POLICY "Users can insert opening hours" ON "public"."opening_hours" FOR INSERT WITH CHECK (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own business posts" ON "public"."posts" FOR INSERT WITH CHECK (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own drafts" ON "public"."write_drafts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own media" ON "public"."media_library" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert their business location data" ON "public"."business_location_intelligence" FOR INSERT TO "authenticated" WITH CHECK (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert their business locations" ON "public"."business_locations" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."businesses"
  WHERE (("businesses"."id" = "business_locations"."business_id") AND ("businesses"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert their business operations" ON "public"."business_operations" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."businesses"
  WHERE (("businesses"."id" = "business_operations"."business_id") AND ("businesses"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert their business profile" ON "public"."business_profile" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."businesses"
  WHERE (("businesses"."id" = "business_profile"."business_id") AND ("businesses"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert their business strategies" ON "public"."weekly_strategies" FOR INSERT TO "authenticated" WITH CHECK (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert their own businesses" ON "public"."businesses" FOR INSERT WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own daily suggestions" ON "public"."daily_suggestions" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."businesses"
  WHERE (("businesses"."id" = "daily_suggestions"."business_id") AND ("businesses"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert their own posts" ON "public"."suggested_posts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert website analyses for their business" ON "public"."website_analyses" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "website_analyses"."business_id") AND ("b"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage their brand profile" ON "public"."business_brand_profile" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can manage their business staff" ON "public"."business_staff" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can manage their opening hours" ON "public"."opening_hours" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can manage their own programme profiles" ON "public"."business_programme_profiles" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can read own business posts" ON "public"."posts" FOR SELECT USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can read own business sources state" ON "public"."brand_profile_sources_state" FOR SELECT TO "authenticated" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can read their business location data" ON "public"."business_location_intelligence" FOR SELECT TO "authenticated" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can select their business locations" ON "public"."business_locations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."businesses"
  WHERE (("businesses"."id" = "business_locations"."business_id") AND ("businesses"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can select their business operations" ON "public"."business_operations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."businesses"
  WHERE (("businesses"."id" = "business_operations"."business_id") AND ("businesses"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can select their business profile" ON "public"."business_profile" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."businesses"
  WHERE (("businesses"."id" = "business_profile"."business_id") AND ("businesses"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can select their own businesses" ON "public"."businesses" FOR SELECT USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "Users can select their own daily suggestions" ON "public"."daily_suggestions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."businesses"
  WHERE (("businesses"."id" = "daily_suggestions"."business_id") AND ("businesses"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can update brand profile" ON "public"."business_brand_profile" FOR UPDATE USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can update business profile" ON "public"."business_profile" FOR UPDATE USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can update opening hours" ON "public"."opening_hours" FOR UPDATE USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own business posts" ON "public"."posts" FOR UPDATE USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own drafts" ON "public"."write_drafts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own media" ON "public"."media_library" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their business location data" ON "public"."business_location_intelligence" FOR UPDATE TO "authenticated" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"())))) WITH CHECK (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can update their business locations" ON "public"."business_locations" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."businesses"
  WHERE (("businesses"."id" = "business_locations"."business_id") AND ("businesses"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can update their business menu results v2" ON "public"."menu_results_v2" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "menu_results_v2"."business_id") AND ("b"."owner_id" = "auth"."uid"())))));



COMMENT ON POLICY "Users can update their business menu results v2" ON "public"."menu_results_v2" IS 'Allows business owners to update menu extraction results for their own businesses (for editing extracted menus)';



CREATE POLICY "Users can update their business operations" ON "public"."business_operations" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."businesses"
  WHERE (("businesses"."id" = "business_operations"."business_id") AND ("businesses"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can update their business profile" ON "public"."business_profile" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."businesses"
  WHERE (("businesses"."id" = "business_profile"."business_id") AND ("businesses"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can update their business strategies" ON "public"."weekly_strategies" FOR UPDATE TO "authenticated" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can update their business website analyses" ON "public"."website_analyses" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "website_analyses"."business_id") AND ("b"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can update their own business documents" ON "public"."business_documents" FOR UPDATE USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can update their own business menu sources" ON "public"."menu_sources" FOR UPDATE USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"())))) WITH CHECK (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can update their own businesses" ON "public"."businesses" FOR UPDATE USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own daily suggestions" ON "public"."daily_suggestions" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."businesses"
  WHERE (("businesses"."id" = "daily_suggestions"."business_id") AND ("businesses"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can update their own posts" ON "public"."suggested_posts" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own weekly plans" ON "public"."weekly_content_plans" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own drafts" ON "public"."write_drafts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own media" ON "public"."media_library" FOR SELECT USING ((("auth"."uid"() = "user_id") AND ("deleted_at" IS NULL)));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their brand profile" ON "public"."business_brand_profile" FOR SELECT USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their business locations" ON "public"."business_locations" FOR SELECT USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their business menu results v2" ON "public"."menu_results_v2" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "menu_results_v2"."business_id") AND ("b"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."business_team_members" "btm"
  WHERE (("btm"."business_id" = "menu_results_v2"."business_id") AND ("btm"."user_id" = "auth"."uid"()) AND ("btm"."accepted_at" IS NOT NULL))))));



CREATE POLICY "Users can view their business profile" ON "public"."business_profile" FOR SELECT USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their business strategies" ON "public"."weekly_strategies" FOR SELECT TO "authenticated" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their business third-party evidence" ON "public"."third_party_evidence" FOR SELECT USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their business website analyses" ON "public"."website_analyses" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "website_analyses"."business_id") AND (("b"."owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."business_team_members" "btm"
          WHERE (("btm"."business_id" = "b"."id") AND ("btm"."user_id" = "auth"."uid"()) AND ("btm"."accepted_at" IS NOT NULL)))))))));



CREATE POLICY "Users can view their opening hours" ON "public"."opening_hours" FOR SELECT USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own business documents" ON "public"."business_documents" FOR SELECT USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own business menu sources" ON "public"."menu_sources" FOR SELECT USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own posts" ON "public"."suggested_posts" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own programme profiles" ON "public"."business_programme_profiles" FOR SELECT USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own weekly plans" ON "public"."weekly_content_plans" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."brand_profile_sources_state" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "btm_manage_owner" ON "public"."business_team_members" TO "authenticated" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"())))) WITH CHECK (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "btm_select_own" ON "public"."business_team_members" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "btm_select_owner" ON "public"."business_team_members" FOR SELECT TO "authenticated" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



ALTER TABLE "public"."business_brand_profile" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_location_intelligence" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_operations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_profile" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_programme_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_team_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."businesses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."city_context_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_suggestions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."media_library" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."menu_items_normalized" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."menu_results_v2" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."menu_sources" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mrv2_delete" ON "public"."menu_results_v2" FOR DELETE TO "authenticated" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "mrv2_insert" ON "public"."menu_results_v2" FOR INSERT TO "authenticated" WITH CHECK (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "mrv2_select" ON "public"."menu_results_v2" FOR SELECT TO "authenticated" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "mrv2_update" ON "public"."menu_results_v2" FOR UPDATE TO "authenticated" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"())))) WITH CHECK (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



ALTER TABLE "public"."opening_hours" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_intelligence" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."social_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suggested_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."third_party_evidence" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."website_analyses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weekly_content_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weekly_strategies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."write_drafts" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."backfill_menu_normalization"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."backfill_menu_normalization"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."backfill_menu_normalization"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_ai_generation_quota"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_ai_generation_quota"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_ai_generation_quota"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_ai_generation_quota_business"("business_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_ai_generation_quota_business"("business_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_ai_generation_quota_business"("business_uuid" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."menu_results_v2" TO "anon";
GRANT ALL ON TABLE "public"."menu_results_v2" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_results_v2" TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_menu_result_v2"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_menu_result_v2"() TO "service_role";



GRANT ALL ON FUNCTION "public"."classify_category_type"("category_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."classify_category_type"("category_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."classify_category_type"("category_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."classify_media_category"("category_name" "text", "item_name" "text", "item_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."classify_media_category"("category_name" "text", "item_name" "text", "item_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."classify_media_category"("category_name" "text", "item_name" "text", "item_description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_weather_cache"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_weather_cache"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_weather_cache"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_archived_posts"("days_old" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_archived_posts"("days_old" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_archived_posts"("days_old" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_daily_suggestions"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_daily_suggestions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_daily_suggestions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_business_onboarding"("p_user_id" "uuid", "p_business_name" "text", "p_selected_platforms" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."create_business_onboarding"("p_user_id" "uuid", "p_business_name" "text", "p_selected_platforms" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_business_onboarding"("p_user_id" "uuid", "p_business_name" "text", "p_selected_platforms" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."deactivate_old_suggestions"("p_business_id" "uuid", "p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."deactivate_old_suggestions"("p_business_id" "uuid", "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."deactivate_old_suggestions"("p_business_id" "uuid", "p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."deduplicate_menu_items"("p_business_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."deduplicate_menu_items"("p_business_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."deduplicate_menu_items"("p_business_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_user_account"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user_account"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_account"() TO "service_role";



GRANT ALL ON FUNCTION "public"."exec_sql"("query" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."exec_sql"("query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."exec_sql"("query" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_daily_usage_stats"("p_business_id" "uuid", "p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_daily_usage_stats"("p_business_id" "uuid", "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_daily_usage_stats"("p_business_id" "uuid", "p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_business_id"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_business_id"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_business_id"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_business_tier"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_business_tier"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_business_tier"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_business_access"("business_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_business_access"("business_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_business_access"("business_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_ai_generation"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_ai_generation"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_ai_generation"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_ai_generation_business"("business_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_ai_generation_business"("business_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_ai_generation_business"("business_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_media_usage"("media_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_media_usage"("media_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_media_usage"("media_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_business_owner"("business_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_business_owner"("business_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_business_owner"("business_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_team_member"("business_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_team_member"("business_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_team_member"("business_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_text_generation"("p_suggestion_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."record_text_generation"("p_suggestion_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_text_generation"("p_suggestion_id" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."requeue_stale_menu_results_v2"("max_age_minutes" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."requeue_stale_menu_results_v2"("max_age_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_daily_quotas"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_daily_quotas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_daily_quotas"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_monthly_quotas"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_monthly_quotas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_monthly_quotas"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_menu_items_normalized"("p_business_id" "uuid", "p_menu_result_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_menu_items_normalized"("p_business_id" "uuid", "p_menu_result_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_menu_items_normalized"("p_business_id" "uuid", "p_menu_result_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_menu_items_to_normalized"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_menu_items_to_normalized"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_menu_items_to_normalized"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_business_programme_profiles_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_business_programme_profiles_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_business_programme_profiles_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_menu_results_v2_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_menu_results_v2_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_menu_results_v2_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_post_drafts_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_post_drafts_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_post_drafts_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_posts_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_posts_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_posts_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_profile_onboarding"("p_user_id" "uuid", "p_business_name" "text", "p_business_category" "text", "p_address" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_profile_onboarding"("p_user_id" "uuid", "p_business_name" "text", "p_business_category" "text", "p_address" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_profile_onboarding"("p_user_id" "uuid", "p_business_name" "text", "p_business_category" "text", "p_address" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_profile_onboarding"("p_user_id" "uuid", "p_business_name" "text", "p_business_category" "text", "p_address" "text", "p_selected_platforms" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_profile_onboarding"("p_user_id" "uuid", "p_business_name" "text", "p_business_category" "text", "p_address" "text", "p_selected_platforms" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_profile_onboarding"("p_user_id" "uuid", "p_business_name" "text", "p_business_category" "text", "p_address" "text", "p_selected_platforms" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_suggested_posts_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_suggested_posts_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_suggested_posts_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."business_brand_profile" TO "anon";
GRANT ALL ON TABLE "public"."business_brand_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."business_brand_profile" TO "service_role";



GRANT ALL ON TABLE "public"."businesses" TO "anon";
GRANT ALL ON TABLE "public"."businesses" TO "authenticated";
GRANT ALL ON TABLE "public"."businesses" TO "service_role";



GRANT ALL ON TABLE "public"."brand_examples_with_fallback" TO "anon";
GRANT ALL ON TABLE "public"."brand_examples_with_fallback" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_examples_with_fallback" TO "service_role";



GRANT ALL ON TABLE "public"."brand_profile_sources_state" TO "anon";
GRANT ALL ON TABLE "public"."brand_profile_sources_state" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_profile_sources_state" TO "service_role";



GRANT ALL ON TABLE "public"."business_documents" TO "anon";
GRANT ALL ON TABLE "public"."business_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."business_documents" TO "service_role";



GRANT ALL ON TABLE "public"."business_location_intelligence" TO "anon";
GRANT ALL ON TABLE "public"."business_location_intelligence" TO "authenticated";
GRANT ALL ON TABLE "public"."business_location_intelligence" TO "service_role";



GRANT ALL ON TABLE "public"."business_location_intelligence_backup_20260701" TO "anon";
GRANT ALL ON TABLE "public"."business_location_intelligence_backup_20260701" TO "authenticated";
GRANT ALL ON TABLE "public"."business_location_intelligence_backup_20260701" TO "service_role";



GRANT ALL ON TABLE "public"."business_locations" TO "anon";
GRANT ALL ON TABLE "public"."business_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."business_locations" TO "service_role";



GRANT ALL ON TABLE "public"."business_operations" TO "anon";
GRANT ALL ON TABLE "public"."business_operations" TO "authenticated";
GRANT ALL ON TABLE "public"."business_operations" TO "service_role";



GRANT ALL ON TABLE "public"."business_profile" TO "anon";
GRANT ALL ON TABLE "public"."business_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."business_profile" TO "service_role";



GRANT ALL ON TABLE "public"."business_programme_profiles" TO "anon";
GRANT ALL ON TABLE "public"."business_programme_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."business_programme_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."business_staff" TO "anon";
GRANT ALL ON TABLE "public"."business_staff" TO "authenticated";
GRANT ALL ON TABLE "public"."business_staff" TO "service_role";



GRANT ALL ON TABLE "public"."business_team_members" TO "anon";
GRANT ALL ON TABLE "public"."business_team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."business_team_members" TO "service_role";



GRANT ALL ON TABLE "public"."city_context_cache" TO "anon";
GRANT ALL ON TABLE "public"."city_context_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."city_context_cache" TO "service_role";



GRANT ALL ON TABLE "public"."contextual_calendar" TO "anon";
GRANT ALL ON TABLE "public"."contextual_calendar" TO "authenticated";
GRANT ALL ON TABLE "public"."contextual_calendar" TO "service_role";



GRANT ALL ON TABLE "public"."daily_suggestions" TO "anon";
GRANT ALL ON TABLE "public"."daily_suggestions" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_suggestions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."daily_suggestions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."daily_suggestions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."daily_suggestions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."media_assets" TO "anon";
GRANT ALL ON TABLE "public"."media_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."media_assets" TO "service_role";



GRANT ALL ON TABLE "public"."media_library" TO "anon";
GRANT ALL ON TABLE "public"."media_library" TO "authenticated";
GRANT ALL ON TABLE "public"."media_library" TO "service_role";



GRANT ALL ON TABLE "public"."menu_items_normalized" TO "anon";
GRANT ALL ON TABLE "public"."menu_items_normalized" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_items_normalized" TO "service_role";



GRANT ALL ON TABLE "public"."media_library_with_category" TO "anon";
GRANT ALL ON TABLE "public"."media_library_with_category" TO "authenticated";
GRANT ALL ON TABLE "public"."media_library_with_category" TO "service_role";



GRANT ALL ON TABLE "public"."menu_items_normalized_stats" TO "anon";
GRANT ALL ON TABLE "public"."menu_items_normalized_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_items_normalized_stats" TO "service_role";



GRANT ALL ON TABLE "public"."menu_normalization_stats" TO "anon";
GRANT ALL ON TABLE "public"."menu_normalization_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_normalization_stats" TO "service_role";



GRANT ALL ON TABLE "public"."menu_sources" TO "anon";
GRANT ALL ON TABLE "public"."menu_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_sources" TO "service_role";



GRANT ALL ON TABLE "public"."opening_hours" TO "anon";
GRANT ALL ON TABLE "public"."opening_hours" TO "authenticated";
GRANT ALL ON TABLE "public"."opening_hours" TO "service_role";



GRANT ALL ON TABLE "public"."platform_intelligence" TO "anon";
GRANT ALL ON TABLE "public"."platform_intelligence" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_intelligence" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."social_accounts" TO "anon";
GRANT ALL ON TABLE "public"."social_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."social_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."suggested_posts" TO "anon";
GRANT ALL ON TABLE "public"."suggested_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."suggested_posts" TO "service_role";



GRANT ALL ON TABLE "public"."third_party_evidence" TO "anon";
GRANT ALL ON TABLE "public"."third_party_evidence" TO "authenticated";
GRANT ALL ON TABLE "public"."third_party_evidence" TO "service_role";



GRANT ALL ON TABLE "public"."v5_profile_summary" TO "anon";
GRANT ALL ON TABLE "public"."v5_profile_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v5_profile_summary" TO "service_role";



GRANT ALL ON TABLE "public"."weather_cache" TO "anon";
GRANT ALL ON TABLE "public"."weather_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."weather_cache" TO "service_role";



GRANT ALL ON TABLE "public"."website_analyses" TO "anon";
GRANT ALL ON TABLE "public"."website_analyses" TO "authenticated";
GRANT ALL ON TABLE "public"."website_analyses" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_content_plans" TO "anon";
GRANT ALL ON TABLE "public"."weekly_content_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_content_plans" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_strategies" TO "anon";
GRANT ALL ON TABLE "public"."weekly_strategies" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_strategies" TO "service_role";



GRANT ALL ON TABLE "public"."write_drafts" TO "anon";
GRANT ALL ON TABLE "public"."write_drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."write_drafts" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







