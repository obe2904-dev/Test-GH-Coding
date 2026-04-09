


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


CREATE SCHEMA IF NOT EXISTS "auth";


ALTER SCHEMA "auth" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE SCHEMA IF NOT EXISTS "storage";


ALTER SCHEMA "storage" OWNER TO "supabase_admin";


CREATE TYPE "auth"."aal_level" AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE "auth"."aal_level" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."code_challenge_method" AS ENUM (
    's256',
    'plain'
);


ALTER TYPE "auth"."code_challenge_method" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_status" AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE "auth"."factor_status" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_type" AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


ALTER TYPE "auth"."factor_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_authorization_status" AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


ALTER TYPE "auth"."oauth_authorization_status" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_client_type" AS ENUM (
    'public',
    'confidential'
);


ALTER TYPE "auth"."oauth_client_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_registration_type" AS ENUM (
    'dynamic',
    'manual'
);


ALTER TYPE "auth"."oauth_registration_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_response_type" AS ENUM (
    'code'
);


ALTER TYPE "auth"."oauth_response_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."one_time_token_type" AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE "auth"."one_time_token_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "storage"."buckettype" AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


ALTER TYPE "storage"."buckettype" OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "auth"."email"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


ALTER FUNCTION "auth"."email"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."email"() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';



CREATE OR REPLACE FUNCTION "auth"."jwt"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


ALTER FUNCTION "auth"."jwt"() OWNER TO "supabase_auth_admin";


CREATE OR REPLACE FUNCTION "auth"."role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


ALTER FUNCTION "auth"."role"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."role"() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';



CREATE OR REPLACE FUNCTION "auth"."uid"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


ALTER FUNCTION "auth"."uid"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."uid"() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';



CREATE OR REPLACE FUNCTION "public"."calculate_content_baselines"("p_business_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_overall_avg_engagement DECIMAL(5,2);
  v_overall_avg_reach INTEGER;
  v_total_posts INTEGER;
  v_baselines JSONB := '{}'::jsonb;
  v_platform_baselines JSONB := '{}'::jsonb;
  v_content_type TEXT;
  v_platform TEXT;
  v_sufficient_data BOOLEAN := FALSE;
BEGIN
  -- Get overall stats (last 90 days)
  SELECT 
    COALESCE(AVG(engagement_rate), 0),
    COALESCE(AVG(reach), 0)::INTEGER,
    COUNT(*)
  INTO v_overall_avg_engagement, v_overall_avg_reach, v_total_posts
  FROM content_performance_log
  WHERE business_id = p_business_id
    AND posted_at >= NOW() - INTERVAL '90 days';
  
  -- Check if we have sufficient data
  v_sufficient_data := v_total_posts >= 20;
  
  -- Calculate per content type baselines
  FOR v_content_type IN 
    SELECT DISTINCT content_type 
    FROM content_performance_log 
    WHERE business_id = p_business_id 
      AND content_type IS NOT NULL
      AND posted_at >= NOW() - INTERVAL '90 days'
  LOOP
    v_baselines := v_baselines || jsonb_build_object(
      v_content_type,
      (
        SELECT jsonb_build_object(
          'avg_engagement_rate', COALESCE(AVG(engagement_rate), 0),
          'avg_reach', COALESCE(AVG(reach), 0)::INTEGER,
          'sample_size', COUNT(*),
          'best_time', (
            SELECT post_time::TEXT
            FROM content_performance_log
            WHERE business_id = p_business_id 
              AND content_type = v_content_type
              AND post_time IS NOT NULL
            ORDER BY engagement_rate DESC
            LIMIT 1
          ),
          'best_day', (
            SELECT post_day_of_week
            FROM content_performance_log
            WHERE business_id = p_business_id 
              AND content_type = v_content_type
              AND post_day_of_week IS NOT NULL
            GROUP BY post_day_of_week
            ORDER BY AVG(engagement_rate) DESC
            LIMIT 1
          ),
          'top_performing_items', (
            SELECT COALESCE(jsonb_agg(DISTINCT item), '[]'::jsonb)
            FROM (
              SELECT unnest(menu_items_featured) AS item
              FROM content_performance_log
              WHERE business_id = p_business_id 
                AND content_type = v_content_type
                AND menu_items_featured IS NOT NULL
              ORDER BY engagement_rate DESC
              LIMIT 5
            ) items
          ),
          'variance', COALESCE(STDDEV(engagement_rate), 0)
        )
        FROM content_performance_log
        WHERE business_id = p_business_id 
          AND content_type = v_content_type
          AND posted_at >= NOW() - INTERVAL '90 days'
      )
    );
  END LOOP;
  
  -- Calculate per platform baselines
  FOR v_platform IN 
    SELECT DISTINCT platform 
    FROM content_performance_log 
    WHERE business_id = p_business_id
      AND posted_at >= NOW() - INTERVAL '90 days'
  LOOP
    v_platform_baselines := v_platform_baselines || jsonb_build_object(
      v_platform,
      (
        SELECT jsonb_build_object(
          'avg_engagement_rate', COALESCE(AVG(engagement_rate), 0),
          'avg_reach', COALESCE(AVG(reach), 0)::INTEGER,
          'sample_size', COUNT(*),
          'best_posting_times', (
            SELECT jsonb_agg(DISTINCT post_time::TEXT)
            FROM (
              SELECT post_time
              FROM content_performance_log
              WHERE business_id = p_business_id 
                AND platform = v_platform
                AND post_time IS NOT NULL
              ORDER BY engagement_rate DESC
              LIMIT 3
            ) times
          ),
          'best_days', (
            SELECT jsonb_agg(DISTINCT day)
            FROM (
              SELECT post_day_of_week AS day
              FROM content_performance_log
              WHERE business_id = p_business_id 
                AND platform = v_platform
                AND post_day_of_week IS NOT NULL
              GROUP BY post_day_of_week
              ORDER BY AVG(engagement_rate) DESC
              LIMIT 3
            ) days
          )
        )
        FROM content_performance_log
        WHERE business_id = p_business_id 
          AND platform = v_platform
          AND posted_at >= NOW() - INTERVAL '90 days'
      )
    );
  END LOOP;
  
  -- Upsert into baselines table
  INSERT INTO content_type_baselines (
    business_id,
    overall_avg_engagement_rate,
    overall_avg_reach,
    total_posts_analyzed,
    baselines,
    platform_baselines,
    sufficient_data,
    last_calculated
  )
  VALUES (
    p_business_id,
    v_overall_avg_engagement,
    v_overall_avg_reach,
    v_total_posts,
    v_baselines,
    v_platform_baselines,
    v_sufficient_data,
    NOW()
  )
  ON CONFLICT (business_id) 
  DO UPDATE SET
    overall_avg_engagement_rate = EXCLUDED.overall_avg_engagement_rate,
    overall_avg_reach = EXCLUDED.overall_avg_reach,
    total_posts_analyzed = EXCLUDED.total_posts_analyzed,
    baselines = EXCLUDED.baselines,
    platform_baselines = EXCLUDED.platform_baselines,
    sufficient_data = EXCLUDED.sufficient_data,
    last_calculated = EXCLUDED.last_calculated;
  
  -- Return calculated baselines for inspection
  RETURN jsonb_build_object(
    'overall_avg_engagement_rate', v_overall_avg_engagement,
    'overall_avg_reach', v_overall_avg_reach,
    'total_posts_analyzed', v_total_posts,
    'sufficient_data', v_sufficient_data,
    'baselines', v_baselines,
    'platform_baselines', v_platform_baselines
  );
END;
$$;


ALTER FUNCTION "public"."calculate_content_baselines"("p_business_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_content_baselines"("p_business_id" "uuid") IS 'Recalculates baselines from last 90 days of performance data - run after new data added';



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
    "dish_temp_category" "text",
    CONSTRAINT "menu_results_v2_source_kind_check" CHECK (("source_kind" = ANY (ARRAY['url'::"text", 'storage'::"text"]))),
    CONSTRAINT "menu_results_v2_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'processing'::"text", 'done'::"text", 'error'::"text"]))),
    CONSTRAINT "menu_results_v2_url_ref_check" CHECK ((("source_kind" <> 'url'::"text") OR ("source_url" IS NOT NULL)))
);


ALTER TABLE "public"."menu_results_v2" OWNER TO "postgres";


COMMENT ON COLUMN "public"."menu_results_v2"."source_id" IS 'References menu_sources.id - which menu source this extraction result belongs to';



COMMENT ON COLUMN "public"."menu_results_v2"."service_periods" IS 'Array of service periods when this menu is available: brunch, lunch, dinner';



COMMENT ON COLUMN "public"."menu_results_v2"."service_period_name" IS 'Primary service period name for this menu (single value)';



COMMENT ON COLUMN "public"."menu_results_v2"."is_signature" IS 'Whether this menu contains signature/featured dishes';



COMMENT ON COLUMN "public"."menu_results_v2"."dish_temp_category" IS 'Temperature category: hot or cold (for menu items)';



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
  IF category_name LIKE '%børnemenu%' OR category_name LIKE '%kids%' OR category_name LIKE '%children%' THEN RETURN 'kids_menu'; END IF;
  IF category_name LIKE '%dessert%' OR category_name LIKE '%desserter%' OR category_name LIKE '%kage%' OR category_name LIKE '%cake%' THEN RETURN 'dessert'; END IF;
  IF category_name LIKE '%forretter%' OR category_name LIKE '%appetizer%' OR category_name LIKE '%starter%' THEN RETURN 'appetizer'; END IF;
  IF category_name LIKE '%tilbehør%' OR category_name LIKE '%sides%' OR category_name LIKE '%ekstra%' OR category_name LIKE '%tilvalg%' THEN RETURN 'sides'; END IF;
  RETURN 'main';
END;
$$;


ALTER FUNCTION "public"."classify_category_type"("category_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_business_onboarding"("p_user_id" "uuid", "p_business_name" "text", "p_business_vertical" "text", "p_postal_code" "text", "p_city" "text", "p_country" "text", "p_selected_platforms" "text"[]) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_business_id UUID;
BEGIN
  -- Create business record
  INSERT INTO public.businesses (
    owner_id,
    name,
    vertical,
    primary_language,
    plan,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    p_business_name,
    p_business_vertical,
    'da', -- Danish default
    'free', -- Free tier by default
    NOW(),
    NOW()
  )
  RETURNING id INTO v_business_id;

  -- Create business location record
  INSERT INTO public.business_locations (
    business_id,
    postal_code,
    city,
    country,
    is_primary,
    created_at
  )
  VALUES (
    v_business_id,
    p_postal_code,
    p_city,
    p_country,
    TRUE, -- First location is primary
    NOW()
  );

  -- Store selected platforms in profiles for backward compatibility
  -- (Keep profiles table for auth metadata until full migration)
  UPDATE public.profiles
  SET
    selected_platforms = p_selected_platforms,
    onboarding_completed = TRUE,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN v_business_id;
END;
$$;


ALTER FUNCTION "public"."create_business_onboarding"("p_user_id" "uuid", "p_business_name" "text", "p_business_vertical" "text", "p_postal_code" "text", "p_city" "text", "p_country" "text", "p_selected_platforms" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."derive_service_periods"("business_id_param" "uuid") RETURNS TABLE("service_periods" "text"[], "primary_period" "text", "posting_windows" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  hours_data JSONB;
  menu_periods TEXT[];
  derived_periods TEXT[];
  primary_svc TEXT;
  windows JSONB;
BEGIN
  -- Get opening hours
  SELECT opening_hours INTO hours_data
  FROM business_profile
  WHERE id = business_id_param;
  
  -- Get menu periods from menu structure
  SELECT ARRAY_AGG(DISTINCT period) INTO menu_periods
  FROM (
    SELECT 
      CASE 
        WHEN LOWER(category->>'name') LIKE ANY(ARRAY['%breakfast%', '%morgenmad%']) THEN 'breakfast'
        WHEN LOWER(category->>'name') LIKE ANY(ARRAY['%brunch%']) THEN 'brunch'
        WHEN LOWER(category->>'name') LIKE ANY(ARRAY['%lunch%', '%frokost%']) THEN 'lunch'
        WHEN LOWER(category->>'name') LIKE ANY(ARRAY['%dinner%', '%aften%', '%middag%']) THEN 'dinner'
        ELSE NULL
      END AS period
    FROM menu_results_v2,
    LATERAL jsonb_array_elements(structured_data->'menuStructure') AS category
    WHERE business_id = business_id_param
    AND status = 'done'
  ) AS periods
  WHERE period IS NOT NULL;
  
  -- Determine primary period (simplified heuristic)
  IF 'all_day' = ANY(menu_periods) THEN
    primary_svc := 'all_day';
  ELSIF 'dinner' = ANY(menu_periods) AND NOT ('lunch' = ANY(menu_periods)) THEN
    primary_svc := 'dinner';
  ELSIF 'lunch' = ANY(menu_periods) AND NOT ('dinner' = ANY(menu_periods)) THEN
    primary_svc := 'lunch';
  ELSIF 'breakfast' = ANY(menu_periods) OR 'brunch' = ANY(menu_periods) THEN
    primary_svc := 'brunch';
  ELSE
    primary_svc := 'all_day';
  END IF;
  
  -- Build posting windows
  windows := jsonb_build_array(
    jsonb_build_object(
      'period', 'breakfast',
      'post_at', '07:30',
      'urgency_window', '07:00-10:30'
    ),
    jsonb_build_object(
      'period', 'lunch',
      'post_at', '10:30',
      'urgency_window', '11:30-14:00'
    ),
    jsonb_build_object(
      'period', 'dinner',
      'post_at', '15:00',
      'urgency_window', '17:00-21:00'
    )
  );
  
  derived_periods := COALESCE(menu_periods, ARRAY['all_day']::TEXT[]);
  
  RETURN QUERY SELECT derived_periods, primary_svc, windows;
END;
$$;


ALTER FUNCTION "public"."derive_service_periods"("business_id_param" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."derive_service_periods"("business_id_param" "uuid") IS 'Analyzes opening hours and menu to determine service periods and optimal posting times';



CREATE OR REPLACE FUNCTION "public"."generate_weekly_post_slots"("p_business_type" "text") RETURNS TABLE("slot_number" integer, "content_type" "text", "display_name" "text", "suggested_platform" "text", "rationale" "text")
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."generate_weekly_post_slots"("p_business_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_weekly_post_slots"("p_business_type" "text") IS 'Generate a weekly post plan with suggested content types and platforms';



CREATE OR REPLACE FUNCTION "public"."get_content_distribution"("p_business_type" "text") RETURNS TABLE("content_type" "text", "display_name" "text", "baseline_percentage" numeric, "posts_per_week" numeric, "priority" integer, "primary_platform" "text", "rationale" "text", "examples" "text"[])
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_content_distribution"("p_business_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_content_distribution"("p_business_type" "text") IS 'Get the content strategy for a business type';



CREATE OR REPLACE FUNCTION "public"."get_contextual_events"("p_country" "text", "p_start_date" "date", "p_end_date" "date", "p_tags" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("event_type" "text", "event_name" "text", "date_start" "date", "date_end" "date", "relevance_tags" "text"[], "content_angle" "text", "marketing_hook" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cc.event_type,
    cc.event_name,
    cc.date_start,
    cc.date_end,
    cc.relevance_tags,
    cc.content_angle,
    cc.marketing_hook
  FROM contextual_calendar cc
  WHERE 
    cc.country = p_country
    AND (
      -- Single-day events
      (cc.date_end IS NULL AND cc.date_start BETWEEN p_start_date AND p_end_date)
      OR
      -- Multi-day events (overlap with query range)
      (cc.date_end IS NOT NULL AND cc.date_start <= p_end_date AND cc.date_end >= p_start_date)
    )
    -- Optional tag filtering
    AND (p_tags IS NULL OR cc.relevance_tags && p_tags)
  ORDER BY cc.date_start, cc.event_type;
END;
$$;


ALTER FUNCTION "public"."get_contextual_events"("p_country" "text", "p_start_date" "date", "p_end_date" "date", "p_tags" "text"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_contextual_events"("p_country" "text", "p_start_date" "date", "p_end_date" "date", "p_tags" "text"[]) IS 'Fetch contextual calendar events for a country and date range, optionally filtered by relevance tags';



CREATE OR REPLACE FUNCTION "public"."get_performance_adjusted_distribution"("p_business_id" "uuid", "p_business_type" "text") RETURNS TABLE("content_type" "text", "baseline_percentage" numeric, "adjusted_percentage" numeric, "adjustment_reason" "text", "priority" integer)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_baselines RECORD;
  v_type_baseline JSONB;
  v_overall_avg DECIMAL;
  v_type_avg DECIMAL;
  v_variance DECIMAL;
  v_adjustment DECIMAL;
BEGIN
  -- Get baselines for this business
  SELECT * INTO v_baselines
  FROM content_type_baselines
  WHERE business_id = p_business_id;
  
  -- If no baselines yet (insufficient data), return Layer 2 defaults
  IF NOT FOUND OR NOT v_baselines.sufficient_data THEN
    RETURN QUERY
    SELECT 
      cdr.content_type_id,
      cdr.baseline_percentage,
      cdr.baseline_percentage AS adjusted_percentage,
      'Using default baseline (insufficient performance data)' AS adjustment_reason,
      cdr.priority
    FROM content_distribution_rules cdr
    WHERE cdr.business_type = p_business_type
    ORDER BY cdr.priority DESC;
    RETURN;
  END IF;
  
  v_overall_avg := v_baselines.overall_avg_engagement_rate;
  
  -- Return adjusted distribution for each content type
  RETURN QUERY
  SELECT 
    cdr.content_type_id,
    cdr.baseline_percentage,
    CASE
      -- If type performs well, increase by up to 20%
      WHEN (v_baselines.baselines->>cdr.content_type_id->'avg_engagement_rate')::DECIMAL > v_overall_avg * 1.3
        THEN LEAST(cdr.baseline_percentage * 1.2, 50.0)
      
      -- If type performs slightly above average, increase by 10%
      WHEN (v_baselines.baselines->>cdr.content_type_id->'avg_engagement_rate')::DECIMAL > v_overall_avg * 1.1
        THEN LEAST(cdr.baseline_percentage * 1.1, 45.0)
      
      -- If type performs slightly below average, decrease by 10%
      WHEN (v_baselines.baselines->>cdr.content_type_id->'avg_engagement_rate')::DECIMAL < v_overall_avg * 0.9
        THEN GREATEST(cdr.baseline_percentage * 0.9, 5.0)
      
      -- If type performs poorly, decrease by 20%
      WHEN (v_baselines.baselines->>cdr.content_type_id->'avg_engagement_rate')::DECIMAL < v_overall_avg * 0.7
        THEN GREATEST(cdr.baseline_percentage * 0.8, 5.0)
      
      -- Otherwise, keep baseline
      ELSE cdr.baseline_percentage
    END AS adjusted_percentage,
    
    CASE
      WHEN (v_baselines.baselines->>cdr.content_type_id->'avg_engagement_rate')::DECIMAL > v_overall_avg * 1.3
        THEN 'High performer (+30% above average) → Increased frequency'
      WHEN (v_baselines.baselines->>cdr.content_type_id->'avg_engagement_rate')::DECIMAL > v_overall_avg * 1.1
        THEN 'Above average performer → Increased frequency'
      WHEN (v_baselines.baselines->>cdr.content_type_id->'avg_engagement_rate')::DECIMAL < v_overall_avg * 0.7
        THEN 'Poor performer (-30% below average) → Decreased frequency'
      WHEN (v_baselines.baselines->>cdr.content_type_id->'avg_engagement_rate')::DECIMAL < v_overall_avg * 0.9
        THEN 'Below average performer → Decreased frequency'
      ELSE 'Performance within normal range → Baseline maintained'
    END AS adjustment_reason,
    
    cdr.priority
  FROM content_distribution_rules cdr
  WHERE cdr.business_type = p_business_type
  ORDER BY cdr.priority DESC;
END;
$$;


ALTER FUNCTION "public"."get_performance_adjusted_distribution"("p_business_id" "uuid", "p_business_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_performance_adjusted_distribution"("p_business_id" "uuid", "p_business_type" "text") IS 'Returns Layer 2 distribution adjusted by actual performance - replaces static baselines when data exists';



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


CREATE OR REPLACE FUNCTION "public"."log_post_performance"("p_business_id" "uuid", "p_post_idea_id" "uuid", "p_content_type" "text", "p_platform" "text", "p_posted_at" timestamp with time zone, "p_reach" integer, "p_engagement" integer, "p_likes" integer DEFAULT 0, "p_comments" integer DEFAULT 0, "p_shares" integer DEFAULT 0, "p_saves" integer DEFAULT 0, "p_clicks" integer DEFAULT 0) RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_log_id UUID;
  v_business_type TEXT;
BEGIN
  -- Get business type
  SELECT bo.establishment_type INTO v_business_type
  FROM business_operations bo
  WHERE bo.business_id = p_business_id;
  
  -- Insert performance log
  INSERT INTO content_performance_log (
    business_id,
    post_idea_id,
    content_type,
    business_type,
    platform,
    posted_at,
    post_time,
    post_day_of_week,
    reach,
    impressions,
    engagement_total,
    likes,
    comments,
    shares,
    saves,
    clicks
  )
  VALUES (
    p_business_id,
    p_post_idea_id,
    p_content_type,
    v_business_type,
    p_platform,
    p_posted_at,
    p_posted_at::TIME,
    EXTRACT(DOW FROM p_posted_at)::INTEGER,
    p_reach,
    p_reach, -- Use reach as proxy for impressions if not provided
    p_engagement,
    p_likes,
    p_comments,
    p_shares,
    p_saves,
    p_clicks
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;


ALTER FUNCTION "public"."log_post_performance"("p_business_id" "uuid", "p_post_idea_id" "uuid", "p_content_type" "text", "p_platform" "text", "p_posted_at" timestamp with time zone, "p_reach" integer, "p_engagement" integer, "p_likes" integer, "p_comments" integer, "p_shares" integer, "p_saves" integer, "p_clicks" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_post_performance"("p_business_id" "uuid", "p_post_idea_id" "uuid", "p_content_type" "text", "p_platform" "text", "p_posted_at" timestamp with time zone, "p_reach" integer, "p_engagement" integer, "p_likes" integer, "p_comments" integer, "p_shares" integer, "p_saves" integer, "p_clicks" integer) IS 'Insert performance metrics from API - called by Instagram/Facebook integration';



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


CREATE OR REPLACE FUNCTION "public"."track_opportunity_trigger"("p_business_id" "uuid", "p_opportunity_type" "text", "p_opportunity_subtype" "text" DEFAULT NULL::"text", "p_context" "jsonb" DEFAULT NULL::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO opportunity_tracking (
    business_id,
    opportunity_type,
    opportunity_subtype,
    last_triggered_date,
    context
  )
  VALUES (
    p_business_id,
    p_opportunity_type,
    p_opportunity_subtype,
    NOW(),
    p_context
  )
  ON CONFLICT (business_id, opportunity_type, opportunity_subtype)
  DO UPDATE SET
    last_triggered_date = NOW(),
    times_triggered = opportunity_tracking.times_triggered + 1,
    context = COALESCE(p_context, opportunity_tracking.context);
END;
$$;


ALTER FUNCTION "public"."track_opportunity_trigger"("p_business_id" "uuid", "p_opportunity_type" "text", "p_opportunity_subtype" "text", "p_context" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."track_opportunity_trigger"("p_business_id" "uuid", "p_opportunity_type" "text", "p_opportunity_subtype" "text", "p_context" "jsonb") IS 'Call when opportunity is triggered (terrace opening, team spotlight, etc.)';



CREATE OR REPLACE FUNCTION "public"."update_contextual_calendar_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_contextual_calendar_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_menu_item_posted"("p_business_id" "uuid", "p_item_name" "text", "p_engagement_rate" numeric DEFAULT NULL::numeric) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE menu_item_metadata
  SET 
    last_posted_date = NOW(),
    total_times_posted = total_times_posted + 1,
    last_engagement_rate = COALESCE(p_engagement_rate, last_engagement_rate),
    avg_engagement_rate = CASE 
      WHEN p_engagement_rate IS NOT NULL THEN
        ((avg_engagement_rate * total_times_posted) + p_engagement_rate) / (total_times_posted + 1)
      ELSE avg_engagement_rate
    END
  WHERE business_id = p_business_id
    AND item_name = p_item_name;
  
  -- If no row exists, create one
  IF NOT FOUND THEN
    INSERT INTO menu_item_metadata (business_id, item_name, last_posted_date, total_times_posted, last_engagement_rate)
    VALUES (p_business_id, p_item_name, NOW(), 1, p_engagement_rate);
  END IF;
END;
$$;


ALTER FUNCTION "public"."update_menu_item_posted"("p_business_id" "uuid", "p_item_name" "text", "p_engagement_rate" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_menu_item_posted"("p_business_id" "uuid", "p_item_name" "text", "p_engagement_rate" numeric) IS 'Call after posting menu item to update recency and performance data';



CREATE OR REPLACE FUNCTION "public"."update_menu_results_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_menu_results_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_menu_results_v2_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_menu_results_v2_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_post_performance"("p_post_idea_id" "uuid", "p_reach" integer, "p_engagement" integer, "p_clicks" integer DEFAULT 0) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Check if post_ideas table exists before updating
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'post_ideas') THEN
    EXECUTE format(
      'UPDATE post_ideas SET reach = %L, engagement = %L, clicks = %L, updated_at = NOW() WHERE id = %L',
      p_reach, p_engagement, p_clicks, p_post_idea_id
    );
  END IF;
  
  -- Trigger baseline recalculation if significant data added
  -- (Will be called by background job)
END;
$$;


ALTER FUNCTION "public"."update_post_performance"("p_post_idea_id" "uuid", "p_reach" integer, "p_engagement" integer, "p_clicks" integer) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "storage"."add_prefixes"("_bucket_id" "text", "_name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    prefixes text[];
BEGIN
    prefixes := "storage"."get_prefixes"("_name");

    IF array_length(prefixes, 1) > 0 THEN
        INSERT INTO storage.prefixes (name, bucket_id)
        SELECT UNNEST(prefixes) as name, "_bucket_id" ON CONFLICT DO NOTHING;
    END IF;
END;
$$;


ALTER FUNCTION "storage"."add_prefixes"("_bucket_id" "text", "_name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


ALTER FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."delete_leaf_prefixes"("bucket_ids" "text"[], "names" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_rows_deleted integer;
BEGIN
    LOOP
        WITH candidates AS (
            SELECT DISTINCT
                t.bucket_id,
                unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        ),
        uniq AS (
             SELECT
                 bucket_id,
                 name,
                 storage.get_level(name) AS level
             FROM candidates
             WHERE name <> ''
             GROUP BY bucket_id, name
        ),
        leaf AS (
             SELECT
                 p.bucket_id,
                 p.name,
                 p.level
             FROM storage.prefixes AS p
                  JOIN uniq AS u
                       ON u.bucket_id = p.bucket_id
                           AND u.name = p.name
                           AND u.level = p.level
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM storage.objects AS o
                 WHERE o.bucket_id = p.bucket_id
                   AND o.level = p.level + 1
                   AND o.name COLLATE "C" LIKE p.name || '/%'
             )
             AND NOT EXISTS (
                 SELECT 1
                 FROM storage.prefixes AS c
                 WHERE c.bucket_id = p.bucket_id
                   AND c.level = p.level + 1
                   AND c.name COLLATE "C" LIKE p.name || '/%'
             )
        )
        DELETE
        FROM storage.prefixes AS p
            USING leaf AS l
        WHERE p.bucket_id = l.bucket_id
          AND p.name = l.name
          AND p.level = l.level;

        GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
        EXIT WHEN v_rows_deleted = 0;
    END LOOP;
END;
$$;


ALTER FUNCTION "storage"."delete_leaf_prefixes"("bucket_ids" "text"[], "names" "text"[]) OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."delete_prefix"("_bucket_id" "text", "_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Check if we can delete the prefix
    IF EXISTS(
        SELECT FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name") + 1
          AND "prefixes"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    )
    OR EXISTS(
        SELECT FROM "storage"."objects"
        WHERE "objects"."bucket_id" = "_bucket_id"
          AND "storage"."get_level"("objects"."name") = "storage"."get_level"("_name") + 1
          AND "objects"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    ) THEN
    -- There are sub-objects, skip deletion
    RETURN false;
    ELSE
        DELETE FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name")
          AND "prefixes"."name" = "_name";
        RETURN true;
    END IF;
END;
$$;


ALTER FUNCTION "storage"."delete_prefix"("_bucket_id" "text", "_name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."delete_prefix_hierarchy_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    prefix text;
BEGIN
    prefix := "storage"."get_prefix"(OLD."name");

    IF coalesce(prefix, '') != '' THEN
        PERFORM "storage"."delete_prefix"(OLD."bucket_id", prefix);
    END IF;

    RETURN OLD;
END;
$$;


ALTER FUNCTION "storage"."delete_prefix_hierarchy_trigger"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."enforce_bucket_name_length"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


ALTER FUNCTION "storage"."enforce_bucket_name_length"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."extension"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    SELECT _parts[array_length(_parts,1)] INTO _filename;
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


ALTER FUNCTION "storage"."extension"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."filename"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


ALTER FUNCTION "storage"."filename"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."foldername"("name" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


ALTER FUNCTION "storage"."foldername"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_level"("name" "text") RETURNS integer
    LANGUAGE "sql" IMMUTABLE STRICT
    AS $$
SELECT array_length(string_to_array("name", '/'), 1);
$$;


ALTER FUNCTION "storage"."get_level"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_prefix"("name" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT
    AS $_$
SELECT
    CASE WHEN strpos("name", '/') > 0 THEN
             regexp_replace("name", '[\/]{1}[^\/]+\/?$', '')
         ELSE
             ''
        END;
$_$;


ALTER FUNCTION "storage"."get_prefix"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_prefixes"("name" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE STRICT
    AS $$
DECLARE
    parts text[];
    prefixes text[];
    prefix text;
BEGIN
    -- Split the name into parts by '/'
    parts := string_to_array("name", '/');
    prefixes := '{}';

    -- Construct the prefixes, stopping one level below the last part
    FOR i IN 1..array_length(parts, 1) - 1 LOOP
            prefix := array_to_string(parts[1:i], '/');
            prefixes := array_append(prefixes, prefix);
    END LOOP;

    RETURN prefixes;
END;
$$;


ALTER FUNCTION "storage"."get_prefixes"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_size_by_bucket"() RETURNS TABLE("size" bigint, "bucket_id" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


ALTER FUNCTION "storage"."get_size_by_bucket"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "next_key_token" "text" DEFAULT ''::"text", "next_upload_token" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "id" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


ALTER FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "next_key_token" "text", "next_upload_token" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_objects_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "start_after" "text" DEFAULT ''::"text", "next_token" "text" DEFAULT ''::"text") RETURNS TABLE("name" "text", "id" "uuid", "metadata" "jsonb", "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(name COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                        substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1)))
                    ELSE
                        name
                END AS name, id, metadata, updated_at
            FROM
                storage.objects
            WHERE
                bucket_id = $5 AND
                name ILIKE $1 || ''%'' AND
                CASE
                    WHEN $6 != '''' THEN
                    name COLLATE "C" > $6
                ELSE true END
                AND CASE
                    WHEN $4 != '''' THEN
                        CASE
                            WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                                substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                name COLLATE "C" > $4
                            END
                    ELSE
                        true
                END
            ORDER BY
                name COLLATE "C" ASC) as e order by name COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_token, bucket_id, start_after;
END;
$_$;


ALTER FUNCTION "storage"."list_objects_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "start_after" "text", "next_token" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."lock_top_prefixes"("bucket_ids" "text"[], "names" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_bucket text;
    v_top text;
BEGIN
    FOR v_bucket, v_top IN
        SELECT DISTINCT t.bucket_id,
            split_part(t.name, '/', 1) AS top
        FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        WHERE t.name <> ''
        ORDER BY 1, 2
        LOOP
            PERFORM pg_advisory_xact_lock(hashtextextended(v_bucket || '/' || v_top, 0));
        END LOOP;
END;
$$;


ALTER FUNCTION "storage"."lock_top_prefixes"("bucket_ids" "text"[], "names" "text"[]) OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."objects_delete_cleanup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


ALTER FUNCTION "storage"."objects_delete_cleanup"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."objects_insert_prefix_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    NEW.level := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


ALTER FUNCTION "storage"."objects_insert_prefix_trigger"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."objects_update_cleanup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    -- NEW - OLD (destinations to create prefixes for)
    v_add_bucket_ids text[];
    v_add_names      text[];

    -- OLD - NEW (sources to prune)
    v_src_bucket_ids text[];
    v_src_names      text[];
BEGIN
    IF TG_OP <> 'UPDATE' THEN
        RETURN NULL;
    END IF;

    -- 1) Compute NEW−OLD (added paths) and OLD−NEW (moved-away paths)
    WITH added AS (
        SELECT n.bucket_id, n.name
        FROM new_rows n
        WHERE n.name <> '' AND position('/' in n.name) > 0
        EXCEPT
        SELECT o.bucket_id, o.name FROM old_rows o WHERE o.name <> ''
    ),
    moved AS (
         SELECT o.bucket_id, o.name
         FROM old_rows o
         WHERE o.name <> ''
         EXCEPT
         SELECT n.bucket_id, n.name FROM new_rows n WHERE n.name <> ''
    )
    SELECT
        -- arrays for ADDED (dest) in stable order
        COALESCE( (SELECT array_agg(a.bucket_id ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        COALESCE( (SELECT array_agg(a.name      ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        -- arrays for MOVED (src) in stable order
        COALESCE( (SELECT array_agg(m.bucket_id ORDER BY m.bucket_id, m.name) FROM moved m), '{}' ),
        COALESCE( (SELECT array_agg(m.name      ORDER BY m.bucket_id, m.name) FROM moved m), '{}' )
    INTO v_add_bucket_ids, v_add_names, v_src_bucket_ids, v_src_names;

    -- Nothing to do?
    IF (array_length(v_add_bucket_ids, 1) IS NULL) AND (array_length(v_src_bucket_ids, 1) IS NULL) THEN
        RETURN NULL;
    END IF;

    -- 2) Take per-(bucket, top) locks: ALL prefixes in consistent global order to prevent deadlocks
    DECLARE
        v_all_bucket_ids text[];
        v_all_names text[];
    BEGIN
        -- Combine source and destination arrays for consistent lock ordering
        v_all_bucket_ids := COALESCE(v_src_bucket_ids, '{}') || COALESCE(v_add_bucket_ids, '{}');
        v_all_names := COALESCE(v_src_names, '{}') || COALESCE(v_add_names, '{}');

        -- Single lock call ensures consistent global ordering across all transactions
        IF array_length(v_all_bucket_ids, 1) IS NOT NULL THEN
            PERFORM storage.lock_top_prefixes(v_all_bucket_ids, v_all_names);
        END IF;
    END;

    -- 3) Create destination prefixes (NEW−OLD) BEFORE pruning sources
    IF array_length(v_add_bucket_ids, 1) IS NOT NULL THEN
        WITH candidates AS (
            SELECT DISTINCT t.bucket_id, unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(v_add_bucket_ids, v_add_names) AS t(bucket_id, name)
            WHERE name <> ''
        )
        INSERT INTO storage.prefixes (bucket_id, name)
        SELECT c.bucket_id, c.name
        FROM candidates c
        ON CONFLICT DO NOTHING;
    END IF;

    -- 4) Prune source prefixes bottom-up for OLD−NEW
    IF array_length(v_src_bucket_ids, 1) IS NOT NULL THEN
        -- re-entrancy guard so DELETE on prefixes won't recurse
        IF current_setting('storage.gc.prefixes', true) <> '1' THEN
            PERFORM set_config('storage.gc.prefixes', '1', true);
        END IF;

        PERFORM storage.delete_leaf_prefixes(v_src_bucket_ids, v_src_names);
    END IF;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "storage"."objects_update_cleanup"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."objects_update_level_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Set the new level
        NEW."level" := "storage"."get_level"(NEW."name");
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "storage"."objects_update_level_trigger"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."objects_update_prefix_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    old_prefixes TEXT[];
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Retrieve old prefixes
        old_prefixes := "storage"."get_prefixes"(OLD."name");

        -- Remove old prefixes that are only used by this object
        WITH all_prefixes as (
            SELECT unnest(old_prefixes) as prefix
        ),
        can_delete_prefixes as (
             SELECT prefix
             FROM all_prefixes
             WHERE NOT EXISTS (
                 SELECT 1 FROM "storage"."objects"
                 WHERE "bucket_id" = OLD."bucket_id"
                   AND "name" <> OLD."name"
                   AND "name" LIKE (prefix || '%')
             )
         )
        DELETE FROM "storage"."prefixes" WHERE name IN (SELECT prefix FROM can_delete_prefixes);

        -- Add new prefixes
        PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    END IF;
    -- Set the new level
    NEW."level" := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


ALTER FUNCTION "storage"."objects_update_prefix_trigger"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."operation"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


ALTER FUNCTION "storage"."operation"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."prefixes_delete_cleanup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


ALTER FUNCTION "storage"."prefixes_delete_cleanup"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."prefixes_insert_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    RETURN NEW;
END;
$$;


ALTER FUNCTION "storage"."prefixes_insert_trigger"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "offsets" integer DEFAULT 0, "search" "text" DEFAULT ''::"text", "sortcolumn" "text" DEFAULT 'name'::"text", "sortorder" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
declare
    can_bypass_rls BOOLEAN;
begin
    SELECT rolbypassrls
    INTO can_bypass_rls
    FROM pg_roles
    WHERE rolname = coalesce(nullif(current_setting('role', true), 'none'), current_user);

    IF can_bypass_rls THEN
        RETURN QUERY SELECT * FROM storage.search_v1_optimised(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    ELSE
        RETURN QUERY SELECT * FROM storage.search_legacy_v1(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    END IF;
end;
$$;


ALTER FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_legacy_v1"("prefix" "text", "bucketname" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "offsets" integer DEFAULT 0, "search" "text" DEFAULT ''::"text", "sortcolumn" "text" DEFAULT 'name'::"text", "sortorder" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select path_tokens[$1] as folder
           from storage.objects
             where objects.name ilike $2 || $3 || ''%''
               and bucket_id = $4
               and array_length(objects.path_tokens, 1) <> $1
           group by folder
           order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


ALTER FUNCTION "storage"."search_legacy_v1"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_v1_optimised"("prefix" "text", "bucketname" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "offsets" integer DEFAULT 0, "search" "text" DEFAULT ''::"text", "sortcolumn" "text" DEFAULT 'name'::"text", "sortorder" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select (string_to_array(name, ''/''))[level] as name
           from storage.prefixes
             where lower(prefixes.name) like lower($2 || $3) || ''%''
               and bucket_id = $4
               and level = $1
           order by name ' || v_sort_order || '
     )
     (select name,
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[level] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where lower(objects.name) like lower($2 || $3) || ''%''
       and bucket_id = $4
       and level = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


ALTER FUNCTION "storage"."search_v1_optimised"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "start_after" "text" DEFAULT ''::"text", "sort_order" "text" DEFAULT 'asc'::"text", "sort_column" "text" DEFAULT 'name'::"text", "sort_column_after" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    sort_col text;
    sort_ord text;
    cursor_op text;
    cursor_expr text;
    sort_expr text;
BEGIN
    -- Validate sort_order
    sort_ord := lower(sort_order);
    IF sort_ord NOT IN ('asc', 'desc') THEN
        sort_ord := 'asc';
    END IF;

    -- Determine cursor comparison operator
    IF sort_ord = 'asc' THEN
        cursor_op := '>';
    ELSE
        cursor_op := '<';
    END IF;
    
    sort_col := lower(sort_column);
    -- Validate sort column  
    IF sort_col IN ('updated_at', 'created_at') THEN
        cursor_expr := format(
            '($5 = '''' OR ROW(date_trunc(''milliseconds'', %I), name COLLATE "C") %s ROW(COALESCE(NULLIF($6, '''')::timestamptz, ''epoch''::timestamptz), $5))',
            sort_col, cursor_op
        );
        sort_expr := format(
            'COALESCE(date_trunc(''milliseconds'', %I), ''epoch''::timestamptz) %s, name COLLATE "C" %s',
            sort_col, sort_ord, sort_ord
        );
    ELSE
        cursor_expr := format('($5 = '''' OR name COLLATE "C" %s $5)', cursor_op);
        sort_expr := format('name COLLATE "C" %s', sort_ord);
    END IF;

    RETURN QUERY EXECUTE format(
        $sql$
        SELECT * FROM (
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    NULL::uuid AS id,
                    updated_at,
                    created_at,
                    NULL::timestamptz AS last_accessed_at,
                    NULL::jsonb AS metadata
                FROM storage.prefixes
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
            UNION ALL
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    id,
                    updated_at,
                    created_at,
                    last_accessed_at,
                    metadata
                FROM storage.objects
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
        ) obj
        ORDER BY %s
        LIMIT $3
        $sql$,
        cursor_expr,    -- prefixes WHERE
        sort_expr,      -- prefixes ORDER BY
        cursor_expr,    -- objects WHERE
        sort_expr,      -- objects ORDER BY
        sort_expr       -- final ORDER BY
    )
    USING prefix, bucket_name, limits, levels, start_after, sort_column_after;
END;
$_$;


ALTER FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer, "levels" integer, "start_after" "text", "sort_order" "text", "sort_column" "text", "sort_column_after" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


ALTER FUNCTION "storage"."update_updated_at_column"() OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "auth"."audit_log_entries" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "payload" json,
    "created_at" timestamp with time zone,
    "ip_address" character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE "auth"."audit_log_entries" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."audit_log_entries" IS 'Auth: Audit trail for user actions.';



CREATE TABLE IF NOT EXISTS "auth"."flow_state" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid",
    "auth_code" "text" NOT NULL,
    "code_challenge_method" "auth"."code_challenge_method" NOT NULL,
    "code_challenge" "text" NOT NULL,
    "provider_type" "text" NOT NULL,
    "provider_access_token" "text",
    "provider_refresh_token" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "authentication_method" "text" NOT NULL,
    "auth_code_issued_at" timestamp with time zone
);


ALTER TABLE "auth"."flow_state" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."flow_state" IS 'stores metadata for pkce logins';



CREATE TABLE IF NOT EXISTS "auth"."identities" (
    "provider_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "identity_data" "jsonb" NOT NULL,
    "provider" "text" NOT NULL,
    "last_sign_in_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "email" "text" GENERATED ALWAYS AS ("lower"(("identity_data" ->> 'email'::"text"))) STORED,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "auth"."identities" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."identities" IS 'Auth: Stores identities associated to a user.';



COMMENT ON COLUMN "auth"."identities"."email" IS 'Auth: Email is a generated column that references the optional email property in the identity_data';



CREATE TABLE IF NOT EXISTS "auth"."instances" (
    "id" "uuid" NOT NULL,
    "uuid" "uuid",
    "raw_base_config" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "auth"."instances" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."instances" IS 'Auth: Manages users across multiple sites.';



CREATE TABLE IF NOT EXISTS "auth"."mfa_amr_claims" (
    "session_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "authentication_method" "text" NOT NULL,
    "id" "uuid" NOT NULL
);


ALTER TABLE "auth"."mfa_amr_claims" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_amr_claims" IS 'auth: stores authenticator method reference claims for multi factor authentication';



CREATE TABLE IF NOT EXISTS "auth"."mfa_challenges" (
    "id" "uuid" NOT NULL,
    "factor_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "verified_at" timestamp with time zone,
    "ip_address" "inet" NOT NULL,
    "otp_code" "text",
    "web_authn_session_data" "jsonb"
);


ALTER TABLE "auth"."mfa_challenges" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_challenges" IS 'auth: stores metadata about challenge requests made';



CREATE TABLE IF NOT EXISTS "auth"."mfa_factors" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "friendly_name" "text",
    "factor_type" "auth"."factor_type" NOT NULL,
    "status" "auth"."factor_status" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "secret" "text",
    "phone" "text",
    "last_challenged_at" timestamp with time zone,
    "web_authn_credential" "jsonb",
    "web_authn_aaguid" "uuid",
    "last_webauthn_challenge_data" "jsonb"
);


ALTER TABLE "auth"."mfa_factors" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_factors" IS 'auth: stores metadata about factors';



COMMENT ON COLUMN "auth"."mfa_factors"."last_webauthn_challenge_data" IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';



CREATE TABLE IF NOT EXISTS "auth"."oauth_authorizations" (
    "id" "uuid" NOT NULL,
    "authorization_id" "text" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "redirect_uri" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "state" "text",
    "resource" "text",
    "code_challenge" "text",
    "code_challenge_method" "auth"."code_challenge_method",
    "response_type" "auth"."oauth_response_type" DEFAULT 'code'::"auth"."oauth_response_type" NOT NULL,
    "status" "auth"."oauth_authorization_status" DEFAULT 'pending'::"auth"."oauth_authorization_status" NOT NULL,
    "authorization_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:03:00'::interval) NOT NULL,
    "approved_at" timestamp with time zone,
    "nonce" "text",
    CONSTRAINT "oauth_authorizations_authorization_code_length" CHECK (("char_length"("authorization_code") <= 255)),
    CONSTRAINT "oauth_authorizations_code_challenge_length" CHECK (("char_length"("code_challenge") <= 128)),
    CONSTRAINT "oauth_authorizations_expires_at_future" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "oauth_authorizations_nonce_length" CHECK (("char_length"("nonce") <= 255)),
    CONSTRAINT "oauth_authorizations_redirect_uri_length" CHECK (("char_length"("redirect_uri") <= 2048)),
    CONSTRAINT "oauth_authorizations_resource_length" CHECK (("char_length"("resource") <= 2048)),
    CONSTRAINT "oauth_authorizations_scope_length" CHECK (("char_length"("scope") <= 4096)),
    CONSTRAINT "oauth_authorizations_state_length" CHECK (("char_length"("state") <= 4096))
);


ALTER TABLE "auth"."oauth_authorizations" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."oauth_client_states" (
    "id" "uuid" NOT NULL,
    "provider_type" "text" NOT NULL,
    "code_verifier" "text",
    "created_at" timestamp with time zone NOT NULL
);


ALTER TABLE "auth"."oauth_client_states" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."oauth_client_states" IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';



CREATE TABLE IF NOT EXISTS "auth"."oauth_clients" (
    "id" "uuid" NOT NULL,
    "client_secret_hash" "text",
    "registration_type" "auth"."oauth_registration_type" NOT NULL,
    "redirect_uris" "text" NOT NULL,
    "grant_types" "text" NOT NULL,
    "client_name" "text",
    "client_uri" "text",
    "logo_uri" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "client_type" "auth"."oauth_client_type" DEFAULT 'confidential'::"auth"."oauth_client_type" NOT NULL,
    CONSTRAINT "oauth_clients_client_name_length" CHECK (("char_length"("client_name") <= 1024)),
    CONSTRAINT "oauth_clients_client_uri_length" CHECK (("char_length"("client_uri") <= 2048)),
    CONSTRAINT "oauth_clients_logo_uri_length" CHECK (("char_length"("logo_uri") <= 2048))
);


ALTER TABLE "auth"."oauth_clients" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."oauth_consents" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "scopes" "text" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "oauth_consents_revoked_after_granted" CHECK ((("revoked_at" IS NULL) OR ("revoked_at" >= "granted_at"))),
    CONSTRAINT "oauth_consents_scopes_length" CHECK (("char_length"("scopes") <= 2048)),
    CONSTRAINT "oauth_consents_scopes_not_empty" CHECK (("char_length"(TRIM(BOTH FROM "scopes")) > 0))
);


ALTER TABLE "auth"."oauth_consents" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."one_time_tokens" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token_type" "auth"."one_time_token_type" NOT NULL,
    "token_hash" "text" NOT NULL,
    "relates_to" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "one_time_tokens_token_hash_check" CHECK (("char_length"("token_hash") > 0))
);


ALTER TABLE "auth"."one_time_tokens" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."refresh_tokens" (
    "instance_id" "uuid",
    "id" bigint NOT NULL,
    "token" character varying(255),
    "user_id" character varying(255),
    "revoked" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "parent" character varying(255),
    "session_id" "uuid"
);


ALTER TABLE "auth"."refresh_tokens" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."refresh_tokens" IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';



CREATE SEQUENCE IF NOT EXISTS "auth"."refresh_tokens_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNER TO "supabase_auth_admin";


ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNED BY "auth"."refresh_tokens"."id";



CREATE TABLE IF NOT EXISTS "auth"."saml_providers" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "entity_id" "text" NOT NULL,
    "metadata_xml" "text" NOT NULL,
    "metadata_url" "text",
    "attribute_mapping" "jsonb",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "name_id_format" "text",
    CONSTRAINT "entity_id not empty" CHECK (("char_length"("entity_id") > 0)),
    CONSTRAINT "metadata_url not empty" CHECK ((("metadata_url" = NULL::"text") OR ("char_length"("metadata_url") > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK (("char_length"("metadata_xml") > 0))
);


ALTER TABLE "auth"."saml_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_providers" IS 'Auth: Manages SAML Identity Provider connections.';



CREATE TABLE IF NOT EXISTS "auth"."saml_relay_states" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "request_id" "text" NOT NULL,
    "for_email" "text",
    "redirect_to" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "flow_state_id" "uuid",
    CONSTRAINT "request_id not empty" CHECK (("char_length"("request_id") > 0))
);


ALTER TABLE "auth"."saml_relay_states" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_relay_states" IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';



CREATE TABLE IF NOT EXISTS "auth"."schema_migrations" (
    "version" character varying(255) NOT NULL
);


ALTER TABLE "auth"."schema_migrations" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."schema_migrations" IS 'Auth: Manages updates to the auth system.';



CREATE TABLE IF NOT EXISTS "auth"."sessions" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "factor_id" "uuid",
    "aal" "auth"."aal_level",
    "not_after" timestamp with time zone,
    "refreshed_at" timestamp without time zone,
    "user_agent" "text",
    "ip" "inet",
    "tag" "text",
    "oauth_client_id" "uuid",
    "refresh_token_hmac_key" "text",
    "refresh_token_counter" bigint,
    "scopes" "text",
    CONSTRAINT "sessions_scopes_length" CHECK (("char_length"("scopes") <= 4096))
);


ALTER TABLE "auth"."sessions" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sessions" IS 'Auth: Stores session data associated to a user.';



COMMENT ON COLUMN "auth"."sessions"."not_after" IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';



COMMENT ON COLUMN "auth"."sessions"."refresh_token_hmac_key" IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';



COMMENT ON COLUMN "auth"."sessions"."refresh_token_counter" IS 'Holds the ID (counter) of the last issued refresh token.';



CREATE TABLE IF NOT EXISTS "auth"."sso_domains" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "domain" "text" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK (("char_length"("domain") > 0))
);


ALTER TABLE "auth"."sso_domains" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_domains" IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';



CREATE TABLE IF NOT EXISTS "auth"."sso_providers" (
    "id" "uuid" NOT NULL,
    "resource_id" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "disabled" boolean,
    CONSTRAINT "resource_id not empty" CHECK ((("resource_id" = NULL::"text") OR ("char_length"("resource_id") > 0)))
);


ALTER TABLE "auth"."sso_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_providers" IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';



COMMENT ON COLUMN "auth"."sso_providers"."resource_id" IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';



CREATE TABLE IF NOT EXISTS "auth"."users" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "aud" character varying(255),
    "role" character varying(255),
    "email" character varying(255),
    "encrypted_password" character varying(255),
    "email_confirmed_at" timestamp with time zone,
    "invited_at" timestamp with time zone,
    "confirmation_token" character varying(255),
    "confirmation_sent_at" timestamp with time zone,
    "recovery_token" character varying(255),
    "recovery_sent_at" timestamp with time zone,
    "email_change_token_new" character varying(255),
    "email_change" character varying(255),
    "email_change_sent_at" timestamp with time zone,
    "last_sign_in_at" timestamp with time zone,
    "raw_app_meta_data" "jsonb",
    "raw_user_meta_data" "jsonb",
    "is_super_admin" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "phone" "text" DEFAULT NULL::character varying,
    "phone_confirmed_at" timestamp with time zone,
    "phone_change" "text" DEFAULT ''::character varying,
    "phone_change_token" character varying(255) DEFAULT ''::character varying,
    "phone_change_sent_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone GENERATED ALWAYS AS (LEAST("email_confirmed_at", "phone_confirmed_at")) STORED,
    "email_change_token_current" character varying(255) DEFAULT ''::character varying,
    "email_change_confirm_status" smallint DEFAULT 0,
    "banned_until" timestamp with time zone,
    "reauthentication_token" character varying(255) DEFAULT ''::character varying,
    "reauthentication_sent_at" timestamp with time zone,
    "is_sso_user" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "is_anonymous" boolean DEFAULT false NOT NULL,
    CONSTRAINT "users_email_change_confirm_status_check" CHECK ((("email_change_confirm_status" >= 0) AND ("email_change_confirm_status" <= 2)))
);


ALTER TABLE "auth"."users" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."users" IS 'Auth: Stores user login data within a secure schema.';



COMMENT ON COLUMN "auth"."users"."is_sso_user" IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';



CREATE TABLE IF NOT EXISTS "public"."business_brand_profile" (
    "business_id" "uuid" NOT NULL,
    "tone_keywords" "text"[],
    "voice_style" "text",
    "values" "text"[],
    "certifications" "text"[],
    "do_not_say" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "offerings_full" "jsonb",
    "booking_link" "text",
    "cta_preference" "text",
    "business_voice" "text" DEFAULT 'friendly'::"text",
    CONSTRAINT "business_brand_profile_business_voice_check" CHECK (("business_voice" = ANY (ARRAY['formal'::"text", 'professional'::"text", 'friendly'::"text", 'casual'::"text"])))
);


ALTER TABLE "public"."business_brand_profile" OWNER TO "postgres";


COMMENT ON TABLE "public"."business_brand_profile" IS 'Brand voice, tone, and communication preferences';



COMMENT ON COLUMN "public"."business_brand_profile"."offerings_full" IS 'All core offering candidates, scores, and evidence for explainability.';



COMMENT ON COLUMN "public"."business_brand_profile"."booking_link" IS 'URL for booking/reservation system';



COMMENT ON COLUMN "public"."business_brand_profile"."cta_preference" IS 'Preferred call-to-action text/style';



COMMENT ON COLUMN "public"."business_brand_profile"."business_voice" IS 'Business voice/tone setting that controls both language style and emoji usage.
Values:
- formal: Fine dining, luxury (0-1 elegant emoji)
- professional: Upscale casual, bistro (1-2 practical emojis)
- friendly: Cafes, family restaurants (2-3 strategic emojis)
- casual: Bars, young crowd (2-3 expressive emojis)';



CREATE TABLE IF NOT EXISTS "public"."business_concept_fit" (
    "business_id" "uuid" NOT NULL,
    "overall_fit_level" "text" NOT NULL,
    "overall_fit_score" numeric(3,2),
    "overall_fit_confidence" numeric(3,2),
    "customer_fit" "text",
    "motivation_fit" "text",
    "pace_fit" "text",
    "price_fit" "text",
    "winning_angles_fit" "text",
    "fit_reasons" "jsonb",
    "mismatch_reasons" "jsonb",
    "strengths" "jsonb",
    "weaknesses" "jsonb",
    "strategy_approach" "text" NOT NULL,
    "strategy_positioning" "text",
    "emphasis" "jsonb",
    "avoid" "jsonb",
    "cta_style" "text",
    "detected_motivations" "jsonb",
    "weather_sensitivity" "text",
    "seasonality_pattern" "text",
    "seasonal_weights" "jsonb",
    "analyzed_for_location_type" "text",
    "analyzed_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "business_concept_fit_customer_fit_check" CHECK (("customer_fit" = ANY (ARRAY['good'::"text", 'moderate'::"text", 'poor'::"text"]))),
    CONSTRAINT "business_concept_fit_motivation_fit_check" CHECK (("motivation_fit" = ANY (ARRAY['good'::"text", 'moderate'::"text", 'poor'::"text"]))),
    CONSTRAINT "business_concept_fit_overall_fit_confidence_check" CHECK ((("overall_fit_confidence" >= (0)::numeric) AND ("overall_fit_confidence" <= (1)::numeric))),
    CONSTRAINT "business_concept_fit_overall_fit_level_check" CHECK (("overall_fit_level" = ANY (ARRAY['strong'::"text", 'moderate'::"text", 'challenging'::"text"]))),
    CONSTRAINT "business_concept_fit_overall_fit_score_check" CHECK ((("overall_fit_score" >= (0)::numeric) AND ("overall_fit_score" <= (1)::numeric))),
    CONSTRAINT "business_concept_fit_pace_fit_check" CHECK (("pace_fit" = ANY (ARRAY['good'::"text", 'moderate'::"text", 'poor'::"text"]))),
    CONSTRAINT "business_concept_fit_price_fit_check" CHECK (("price_fit" = ANY (ARRAY['good'::"text", 'moderate'::"text", 'poor'::"text"]))),
    CONSTRAINT "business_concept_fit_strategy_approach_check" CHECK (("strategy_approach" = ANY (ARRAY['amplify'::"text", 'adapt'::"text", 'contrarian'::"text"]))),
    CONSTRAINT "business_concept_fit_weather_sensitivity_check" CHECK (("weather_sensitivity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "business_concept_fit_winning_angles_fit_check" CHECK (("winning_angles_fit" = ANY (ARRAY['good'::"text", 'moderate'::"text", 'poor'::"text"])))
);


ALTER TABLE "public"."business_concept_fit" OWNER TO "postgres";


COMMENT ON TABLE "public"."business_concept_fit" IS 'Primary concept fit analysis against main location type';



COMMENT ON COLUMN "public"."business_concept_fit"."strategy_approach" IS 'amplify = lean into location strengths, adapt = hybrid approach, contrarian = position as exception';



COMMENT ON COLUMN "public"."business_concept_fit"."analyzed_for_location_type" IS 'Location type ID from LOCATION_EXPECTATIONS (e.g., city_centre, residential, student)';



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
    "who_analysis_internal" "jsonb" DEFAULT '[]'::"jsonb",
    "when_analysis_internal" "jsonb" DEFAULT '[]'::"jsonb",
    "why_analysis_internal" "jsonb" DEFAULT '[]'::"jsonb",
    "who_analysis" "jsonb" DEFAULT '[]'::"jsonb",
    "when_analysis" "jsonb" DEFAULT '[]'::"jsonb",
    "why_analysis" "jsonb" DEFAULT '[]'::"jsonb",
    "concept_fit_analyzed_at" timestamp with time zone,
    "concept_fit_by_category" "jsonb" DEFAULT '{}'::"jsonb",
    "location_type_matches" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."business_location_intelligence" OWNER TO "postgres";


COMMENT ON COLUMN "public"."business_location_intelligence"."category_scores" IS 'Location category scores (0-100) for each location type: 
{"waterfront": 85, "city_center": 60, "tourist_area": 40, etc.}';



COMMENT ON COLUMN "public"."business_location_intelligence"."concept_fit_by_category" IS 'Concept fit analysis for each detected location category. Keyed by category_id, contains fit_level, one_liner, marketing_angle, etc.';



COMMENT ON COLUMN "public"."business_location_intelligence"."location_type_matches" IS 'Pure location type analysis - which of the 10 location types describe this physical location. Independent of business concept. Format: {"location_type_id": {"match_score": 0-100, "match_level": "strong|moderate|weak", "confidence": 0.0-1.0, "reason": "text"}}';



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
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."business_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_operations" (
    "business_id" "uuid" NOT NULL,
    "opening_hours" "jsonb" DEFAULT '{}'::"jsonb",
    "service_periods" "jsonb" DEFAULT '{}'::"jsonb",
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
    "establishment_type" character varying(10),
    "has_wifi" boolean DEFAULT false,
    "has_power_outlets" boolean DEFAULT false,
    "has_parking" boolean DEFAULT false,
    "primary_service_period" "text",
    "posting_time_windows" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "business_operations_price_level_check" CHECK (("price_level" = ANY (ARRAY['budget'::"text", 'moderate'::"text", 'upscale'::"text", 'fine_dining'::"text"]))),
    CONSTRAINT "business_operations_primary_service_period_check" CHECK (("primary_service_period" = ANY (ARRAY['breakfast'::"text", 'brunch'::"text", 'lunch'::"text", 'dinner'::"text", 'all_day'::"text", 'evening_only'::"text"]))),
    CONSTRAINT "establishment_type_check" CHECK ((("establishment_type" IS NULL) OR (("establishment_type")::"text" = ANY ((ARRAY['FSE'::character varying, 'SBO'::character varying, 'MFV'::character varying, 'MFD'::character varying, 'QSR'::character varying])::"text"[]))))
);


ALTER TABLE "public"."business_operations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."business_operations"."service_periods" IS 'All service periods offered (e.g., ["breakfast", "lunch", "dinner"])';



COMMENT ON COLUMN "public"."business_operations"."has_kids_menu" IS 'Whether the business offers a kids/children menu';



COMMENT ON COLUMN "public"."business_operations"."has_outdoor_seating" IS 'Whether the business offers outdoor seating/serving (terrace, patio, etc.). 
Used to boost seasonal content in Q2-Q3.';



COMMENT ON COLUMN "public"."business_operations"."establishment_type" IS 'Business type classification:
- FSE: Full-Service Establishment (fine dining, sit-down restaurants)
- SBO: Service-Based Operation (cafes, small restaurants)
- MFV: Mobile Food Vendor (food trucks)
- MFD: Multi-location/Multi-per-Day (chains, multiple daily posts)
- QSR: Quick Service Restaurant (fast food)';



COMMENT ON COLUMN "public"."business_operations"."has_wifi" IS 'Whether the business offers WiFi to customers';



COMMENT ON COLUMN "public"."business_operations"."has_power_outlets" IS 'Whether the business has power outlets available for customers';



COMMENT ON COLUMN "public"."business_operations"."has_parking" IS 'Whether the business has parking available';



COMMENT ON COLUMN "public"."business_operations"."primary_service_period" IS 'Main service focus derived from hours and menu';



COMMENT ON COLUMN "public"."business_operations"."posting_time_windows" IS 'Optimal posting times based on service periods. Format: [{"period": "lunch", "post_at": "10:30", "urgency_window": "11:00-14:00"}]';



CREATE TABLE IF NOT EXISTS "public"."business_profile" (
    "business_id" "uuid" NOT NULL,
    "short_description" "text",
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



COMMENT ON COLUMN "public"."business_profile"."booking_url" IS 'Booking/reservation URL for the business';



CREATE TABLE IF NOT EXISTS "public"."business_team_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "invited_at" timestamp with time zone DEFAULT "now"(),
    "accepted_at" timestamp with time zone
);


ALTER TABLE "public"."business_team_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_type_defaults" (
    "business_type" "text" NOT NULL,
    "min_posts_per_week" integer NOT NULL,
    "max_posts_per_week" integer NOT NULL,
    "ideal_posts_per_week" integer NOT NULL,
    "instagram_weight" numeric(3,2) DEFAULT 0.50,
    "facebook_weight" numeric(3,2) DEFAULT 0.50,
    "menu_highlight_ratio" numeric(3,2) DEFAULT 0.30,
    "location_story_ratio" numeric(3,2) DEFAULT 0.20,
    "behind_scenes_ratio" numeric(3,2) DEFAULT 0.15,
    "event_promotion_ratio" numeric(3,2) DEFAULT 0.20,
    "engagement_ratio" numeric(3,2) DEFAULT 0.15,
    "default_tone" "text",
    "emoji_frequency" "text",
    "caption_length" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "business_type_defaults_business_type_check" CHECK (("business_type" = ANY (ARRAY['FSE'::"text", 'SBO'::"text", 'MFV'::"text", 'MFD'::"text", 'QSR'::"text"]))),
    CONSTRAINT "business_type_defaults_caption_length_check" CHECK (("caption_length" = ANY (ARRAY['short'::"text", 'medium'::"text", 'long'::"text"]))),
    CONSTRAINT "business_type_defaults_default_tone_check" CHECK (("default_tone" = ANY (ARRAY['casual'::"text", 'refined'::"text", 'playful'::"text", 'professional'::"text"]))),
    CONSTRAINT "business_type_defaults_emoji_frequency_check" CHECK (("emoji_frequency" = ANY (ARRAY['none'::"text", 'minimal'::"text", 'moderate'::"text", 'frequent'::"text"])))
);


ALTER TABLE "public"."business_type_defaults" OWNER TO "postgres";


COMMENT ON TABLE "public"."business_type_defaults" IS 'Default posting patterns and content style per business type';



COMMENT ON COLUMN "public"."business_type_defaults"."instagram_weight" IS 'Priority weight for Instagram (0.0-1.0)';



COMMENT ON COLUMN "public"."business_type_defaults"."facebook_weight" IS 'Priority weight for Facebook (0.0-1.0)';



COMMENT ON COLUMN "public"."business_type_defaults"."menu_highlight_ratio" IS 'Ratio of posts featuring menu items';



COMMENT ON COLUMN "public"."business_type_defaults"."location_story_ratio" IS 'Ratio of posts about location/atmosphere';



CREATE TABLE IF NOT EXISTS "public"."businesses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "vertical" "text" NOT NULL,
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
    "category" "text",
    "logo_url" "text",
    "subscription_tier" "text" DEFAULT 'free'::"text",
    "subpage_urls" "jsonb" DEFAULT '[]'::"jsonb",
    "selected_platforms" "jsonb" DEFAULT '["instagram", "facebook"]'::"jsonb",
    "country" "text" DEFAULT 'DK'::"text" NOT NULL,
    CONSTRAINT "businesses_plan_check" CHECK (("plan" = ANY (ARRAY['free'::"text", 'standardplus'::"text", 'premium'::"text"])))
);


ALTER TABLE "public"."businesses" OWNER TO "postgres";


COMMENT ON COLUMN "public"."businesses"."selected_platforms" IS 'Array of selected social media platforms (e.g., ["instagram", "facebook", "linkedin"])';



CREATE TABLE IF NOT EXISTS "public"."content_distribution_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_type" "text" NOT NULL,
    "content_type_id" "text" NOT NULL,
    "baseline_percentage" numeric(4,1) NOT NULL,
    "posts_per_week" numeric(3,1),
    "priority" integer DEFAULT 5,
    "min_days_between" integer DEFAULT 0,
    "rationale" "text",
    "examples" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "content_distribution_rules_baseline_percentage_check" CHECK ((("baseline_percentage" >= (0)::numeric) AND ("baseline_percentage" <= (100)::numeric))),
    CONSTRAINT "content_distribution_rules_priority_check" CHECK ((("priority" >= 1) AND ("priority" <= 10)))
);


ALTER TABLE "public"."content_distribution_rules" OWNER TO "postgres";


COMMENT ON TABLE "public"."content_distribution_rules" IS 'Content type distribution ratios per business type - the strategic baseline';



CREATE TABLE IF NOT EXISTS "public"."content_performance_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "post_idea_id" "uuid",
    "content_type" "text",
    "content_pillar" "text",
    "business_type" "text",
    "platform" "text" NOT NULL,
    "posted_at" timestamp with time zone NOT NULL,
    "post_time" time without time zone,
    "post_day_of_week" integer,
    "reach" integer DEFAULT 0,
    "impressions" integer DEFAULT 0,
    "engagement_total" integer DEFAULT 0,
    "likes" integer DEFAULT 0,
    "comments" integer DEFAULT 0,
    "shares" integer DEFAULT 0,
    "saves" integer DEFAULT 0,
    "clicks" integer DEFAULT 0,
    "engagement_rate" numeric(5,2) GENERATED ALWAYS AS (
CASE
    WHEN ("reach" > 0) THEN ((("engagement_total")::numeric / ("reach")::numeric) * (100)::numeric)
    ELSE (0)::numeric
END) STORED,
    "click_through_rate" numeric(5,2) GENERATED ALWAYS AS (
CASE
    WHEN ("impressions" > 0) THEN ((("clicks")::numeric / ("impressions")::numeric) * (100)::numeric)
    ELSE (0)::numeric
END) STORED,
    "menu_items_featured" "text"[],
    "location_hooks" "text"[],
    "weather_condition" "text",
    "calendar_event_id" "uuid",
    "seasonal_context" "text",
    "was_ai_generated" boolean DEFAULT true,
    "user_edited" boolean DEFAULT false,
    "visual_style" "text",
    "user_rating" integer,
    "user_notes" "text",
    "fetched_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "content_performance_log_platform_check" CHECK (("platform" = ANY (ARRAY['instagram'::"text", 'facebook'::"text", 'both'::"text"]))),
    CONSTRAINT "content_performance_log_user_rating_check" CHECK ((("user_rating" >= 1) AND ("user_rating" <= 5))),
    CONSTRAINT "valid_engagement" CHECK (("engagement_total" >= 0)),
    CONSTRAINT "valid_reach" CHECK (("reach" >= 0))
);


ALTER TABLE "public"."content_performance_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."content_performance_log" IS 'Historical post performance data from Instagram/Facebook APIs - feeds learning system';



COMMENT ON COLUMN "public"."content_performance_log"."engagement_rate" IS 'Auto-calculated: (engagement / reach) * 100';



COMMENT ON COLUMN "public"."content_performance_log"."click_through_rate" IS 'Auto-calculated: (clicks / impressions) * 100';



CREATE TABLE IF NOT EXISTS "public"."content_type_baselines" (
    "business_id" "uuid" NOT NULL,
    "overall_avg_engagement_rate" numeric(5,2) DEFAULT 0,
    "overall_avg_reach" integer DEFAULT 0,
    "total_posts_analyzed" integer DEFAULT 0,
    "baselines" "jsonb" DEFAULT '{}'::"jsonb",
    "platform_baselines" "jsonb" DEFAULT '{}'::"jsonb",
    "sufficient_data" boolean DEFAULT false,
    "last_calculated" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."content_type_baselines" OWNER TO "postgres";


COMMENT ON TABLE "public"."content_type_baselines" IS 'Calculated performance baselines per business - auto-updated as data flows in';



COMMENT ON COLUMN "public"."content_type_baselines"."sufficient_data" IS 'TRUE when >= 20 posts analyzed - enables performance-based adjustments';



CREATE TABLE IF NOT EXISTS "public"."content_types" (
    "id" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text",
    "requires_high_quality_photo" boolean DEFAULT false,
    "typical_photo_style" "text",
    "instagram_priority" integer DEFAULT 5,
    "facebook_priority" integer DEFAULT 5,
    "is_promotional" boolean DEFAULT false,
    "is_time_sensitive" boolean DEFAULT false,
    "requires_user_permission" boolean DEFAULT false,
    "max_frequency_per_week" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "content_types_facebook_priority_check" CHECK ((("facebook_priority" >= 1) AND ("facebook_priority" <= 10))),
    CONSTRAINT "content_types_instagram_priority_check" CHECK ((("instagram_priority" >= 1) AND ("instagram_priority" <= 10)))
);


ALTER TABLE "public"."content_types" OWNER TO "postgres";


COMMENT ON TABLE "public"."content_types" IS 'Master list of content types with platform affinity and characteristics';



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
    CONSTRAINT "contextual_calendar_event_type_check" CHECK (("event_type" = ANY (ARRAY['holiday'::"text", 'school_vacation'::"text", 'season'::"text", 'cultural'::"text", 'business_rhythm'::"text"]))),
    CONSTRAINT "contextual_calendar_recurrence_check" CHECK (("recurrence" = ANY (ARRAY['annual'::"text", 'seasonal'::"text", 'monthly'::"text", 'weekly'::"text", NULL::"text"])))
);


ALTER TABLE "public"."contextual_calendar" OWNER TO "postgres";


COMMENT ON TABLE "public"."contextual_calendar" IS 'Country-specific calendar events for AI content suggestions';



COMMENT ON COLUMN "public"."contextual_calendar"."country" IS 'ISO 3166-1 alpha-2 country code (DK, SE, NO, etc.)';



COMMENT ON COLUMN "public"."contextual_calendar"."region" IS 'Optional regional subdivision for events that vary by area';



COMMENT ON COLUMN "public"."contextual_calendar"."relevance_tags" IS 'Filter events by business concept fit (families, couples, outdoor, etc.)';



COMMENT ON COLUMN "public"."contextual_calendar"."content_angle" IS 'AI guidance for content strategy during this period';



COMMENT ON COLUMN "public"."contextual_calendar"."marketing_hook" IS 'Specific promotional opportunities to highlight';


-- Seed data: Denmark calendar events 2026
-- Public Holidays 2026
INSERT INTO "public"."contextual_calendar" (country, event_type, event_name, date_start, date_end, recurrence, relevance_tags, content_angle, marketing_hook) VALUES
  ('DK', 'holiday', 'Nytårsdag', '2026-01-01', NULL, 'annual', ARRAY['cozy_indoor'], 'Emphasis: Fresh start, new year energy', 'Promote: New year brunch, healthy menu items'),
  ('DK', 'holiday', 'Skærtorsdag', '2026-04-02', NULL, 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Long weekend begins', 'Promote: Easter menu, family dining'),
  ('DK', 'holiday', 'Langfredag', '2026-04-03', NULL, 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Easter traditions', 'Promote: Traditional Danish Easter lunch'),
  ('DK', 'holiday', '1. Påskedag', '2026-04-05', NULL, 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Easter Sunday, the main Easter celebration day', 'Promote: Easter Sunday brunch, special Easter menu, family dining'),
  ('DK', 'holiday', '2. Påskedag', '2026-04-06', NULL, 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Family gatherings', 'Promote: Easter brunch, family-friendly atmosphere'),
  ('DK', 'holiday', 'Store Bededag', '2026-05-01', NULL, 'annual', ARRAY['cozy_indoor'], 'Emphasis: Spring long weekend', 'Promote: Long weekend dining, outdoor if weather permits'),
  ('DK', 'holiday', 'Kristi Himmelfartsdag', '2026-05-14', NULL, 'annual', ARRAY['outdoor', 'families'], 'Emphasis: Often combined with weekend off', 'Promote: Outdoor dining, day trips'),
  ('DK', 'holiday', '2. Pinsedag', '2026-05-25', NULL, 'annual', ARRAY['outdoor', 'families'], 'Emphasis: Pentecost weekend', 'Promote: Spring menu, terrace dining'),
  ('DK', 'holiday', 'Grundlovsdag', '2026-06-05', NULL, 'annual', ARRAY['outdoor'], 'Emphasis: Constitution Day, patriotic', 'Promote: Danish classics, outdoor events'),
  ('DK', 'holiday', 'Juleaftensdag', '2026-12-24', NULL, 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Most places closed, family time', 'Watch out: Respect that most are at home'),
  ('DK', 'holiday', '1. Juledag', '2026-12-25', NULL, 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Christmas Day', 'Promote: Christmas brunch if open'),
  ('DK', 'holiday', '2. Juledag', '2026-12-26', NULL, 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Boxing Day, family gatherings', 'Promote: Post-Christmas casual dining')
ON CONFLICT DO NOTHING;

-- School Vacations 2026 (Denmark-wide)
INSERT INTO "public"."contextual_calendar" (country, event_type, event_name, date_start, date_end, recurrence, relevance_tags, content_angle, marketing_hook) VALUES
  ('DK', 'school_vacation', 'Vinterferie', '2026-02-07', '2026-02-15', 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Family activities, kids at home', 'Promote: Kids menu, family-friendly lunch, hot chocolate'),
  ('DK', 'school_vacation', 'Påskeferie', '2026-03-30', '2026-04-06', 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Easter break, family time', 'Promote: Easter brunch, family dining, kids activities'),
  ('DK', 'school_vacation', 'Sommerferie', '2026-06-27', '2026-08-10', 'annual', ARRAY['families', 'outdoor'], 'Emphasis: Peak vacation season, tourism', 'Promote: Outdoor dining, ice cream, refreshing drinks, tourist-friendly'),
  ('DK', 'school_vacation', 'Efterårsferie (Uge 42)', '2026-10-10', '2026-10-18', 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Fall break, cozy indoor activities', 'Promote: Warm comfort food, fall menu, family deals'),
  ('DK', 'school_vacation', 'Juleferie', '2026-12-21', '2027-01-03', 'annual', ARRAY['families', 'cozy_indoor'], 'Emphasis: Christmas break, holiday season', 'Promote: Holiday specials, festive atmosphere, gift vouchers')
ON CONFLICT DO NOTHING;


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


CREATE TABLE IF NOT EXISTS "public"."menu_extractions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "menu_source_id" "uuid",
    "menu_name" "text" NOT NULL,
    "menu_type" "text" DEFAULT 'standard'::"text" NOT NULL,
    "extracted_data" "jsonb" NOT NULL,
    "extracted_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "menu_extractions_menu_type_check" CHECK (("menu_type" = ANY (ARRAY['standard'::"text", 'special'::"text"])))
);


ALTER TABLE "public"."menu_extractions" OWNER TO "postgres";


COMMENT ON TABLE "public"."menu_extractions" IS 'Stores extracted menu data per source (categories and items)';



COMMENT ON COLUMN "public"."menu_extractions"."menu_source_id" IS 'Reference to the source menu (link or PDF)';



COMMENT ON COLUMN "public"."menu_extractions"."menu_name" IS 'User-editable name for the menu (e.g., "Julefrokost", "Brunch")';



COMMENT ON COLUMN "public"."menu_extractions"."menu_type" IS 'Menu type for grouping: standard or special';



COMMENT ON COLUMN "public"."menu_extractions"."extracted_data" IS 'JSON structure with categories and items';



CREATE TABLE IF NOT EXISTS "public"."menu_item_metadata" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "item_name" "text" NOT NULL,
    "item_category" "text",
    "item_section" "text",
    "is_signature" boolean DEFAULT false,
    "is_seasonal" boolean DEFAULT false,
    "is_limited_time" boolean DEFAULT false,
    "dish_temp_category" "text",
    "item_added_date" timestamp with time zone DEFAULT "now"(),
    "item_available_from" "date",
    "item_available_to" "date",
    "last_posted_date" timestamp with time zone,
    "location_tags" "text"[],
    "seasonal_ingredients" "jsonb" DEFAULT '[]'::"jsonb",
    "total_times_posted" integer DEFAULT 0,
    "avg_engagement_rate" numeric(5,2) DEFAULT 0,
    "last_engagement_rate" numeric(5,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "menu_item_metadata_dish_temp_category_check" CHECK (("dish_temp_category" = ANY (ARRAY['cold'::"text", 'hot'::"text", 'warm'::"text", 'neutral'::"text"])))
);


ALTER TABLE "public"."menu_item_metadata" OWNER TO "postgres";


COMMENT ON TABLE "public"."menu_item_metadata" IS 'Metadata for menu items to enable opportunity scoring (Layer 5)';



COMMENT ON COLUMN "public"."menu_item_metadata"."is_signature" IS 'Signature/famous dish - gets base score of 100';



COMMENT ON COLUMN "public"."menu_item_metadata"."is_seasonal" IS 'Seasonal special - gets base score of 75';



COMMENT ON COLUMN "public"."menu_item_metadata"."is_limited_time" IS 'Limited time offer - gets base score of 85';



COMMENT ON COLUMN "public"."menu_item_metadata"."dish_temp_category" IS 'Temperature classification for weather matching (cold/hot/warm/neutral)';



COMMENT ON COLUMN "public"."menu_item_metadata"."last_posted_date" IS 'Last time featured in post - used for recency penalty';



COMMENT ON COLUMN "public"."menu_item_metadata"."seasonal_ingredients" IS 'Array of seasonal ingredients for bonus scoring';



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
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."menu_items_normalized" OWNER TO "postgres";


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
    "label" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
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



CREATE TABLE IF NOT EXISTS "public"."opportunity_tracking" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "opportunity_type" "text" NOT NULL,
    "opportunity_subtype" "text",
    "last_triggered_date" timestamp with time zone NOT NULL,
    "last_posted_date" timestamp with time zone,
    "times_triggered" integer DEFAULT 1,
    "times_posted" integer DEFAULT 0,
    "context" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."opportunity_tracking" OWNER TO "postgres";


COMMENT ON TABLE "public"."opportunity_tracking" IS 'Tracks when opportunities were triggered/posted to prevent repetition';



CREATE TABLE IF NOT EXISTS "public"."platform_assignment_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content_type_id" "text" NOT NULL,
    "primary_platform" "text" NOT NULL,
    "secondary_platform" "text",
    "rule_description" "text" NOT NULL,
    "why" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "platform_assignment_rules_primary_platform_check" CHECK (("primary_platform" = ANY (ARRAY['instagram'::"text", 'facebook'::"text", 'both'::"text"]))),
    CONSTRAINT "platform_assignment_rules_secondary_platform_check" CHECK (("secondary_platform" = ANY (ARRAY['instagram'::"text", 'facebook'::"text", 'none'::"text"])))
);


ALTER TABLE "public"."platform_assignment_rules" OWNER TO "postgres";


COMMENT ON TABLE "public"."platform_assignment_rules" IS 'Rules for assigning content types to Instagram vs Facebook';



CREATE TABLE IF NOT EXISTS "public"."post_approvals" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "post_index" integer NOT NULL,
    "status" "text" DEFAULT 'draft'::"text",
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "media_uploads" "jsonb" DEFAULT '[]'::"jsonb",
    "selected_media" "text",
    "edit_history" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "post_approvals_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'approved'::"text", 'scheduled'::"text", 'posted'::"text"])))
);


ALTER TABLE "public"."post_approvals" OWNER TO "postgres";


COMMENT ON TABLE "public"."post_approvals" IS 'Tracks approval status, media uploads, and edit history for individual posts';



COMMENT ON COLUMN "public"."post_approvals"."edit_history" IS 'Tracks caption edits, timing changes, platform swaps for learning system';



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
    "business_offerings" "jsonb",
    CONSTRAINT "profiles_plan_check" CHECK (("plan" = ANY (ARRAY['free'::"text", 'standardplus'::"text", 'premium'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."plan" IS 'User tier: free, standardplus (Smart), or premium (Pro)';



COMMENT ON COLUMN "public"."profiles"."ai_generations_today" IS 'Count of AI generations used today';



COMMENT ON COLUMN "public"."profiles"."ai_generations_this_month" IS 'Count of AI generations used this month';



COMMENT ON COLUMN "public"."profiles"."last_daily_reset" IS 'Date when daily quotas were last reset';



COMMENT ON COLUMN "public"."profiles"."last_monthly_reset" IS 'Date when monthly quotas were last reset';



COMMENT ON COLUMN "public"."profiles"."selected_platforms" IS 'Array of platform names selected by user (e.g., ["facebook", "instagram"])';



COMMENT ON COLUMN "public"."profiles"."business_offerings" IS 'Business offerings/products structured as categories and items (menu, treatments, products, etc.)';



CREATE TABLE IF NOT EXISTS "public"."seasonal_ingredients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ingredient_name" "text" NOT NULL,
    "country_code" "text" DEFAULT 'DK'::"text",
    "season" "text" NOT NULL,
    "peak_months" integer[] NOT NULL,
    "bonus_points" integer DEFAULT 50,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "seasonal_ingredients_season_check" CHECK (("season" = ANY (ARRAY['spring'::"text", 'summer'::"text", 'autumn'::"text", 'winter'::"text"])))
);


ALTER TABLE "public"."seasonal_ingredients" OWNER TO "postgres";


COMMENT ON TABLE "public"."seasonal_ingredients" IS 'Seasonal ingredient database for bonus scoring - expandable by country';



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
    CONSTRAINT "website_analyses_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'success'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."website_analyses" OWNER TO "postgres";


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
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."weekly_content_plans" OWNER TO "postgres";


COMMENT ON TABLE "public"."weekly_content_plans" IS 'Stores AI-generated weekly content plans with 4-7 post specifications';



COMMENT ON COLUMN "public"."weekly_content_plans"."posts" IS 'Array of complete post specifications (timing, platform, caption, visual, etc.)';



COMMENT ON COLUMN "public"."weekly_content_plans"."summary" IS 'Aggregated statistics (platform distribution, format distribution, production time)';



COMMENT ON COLUMN "public"."weekly_content_plans"."learning_data" IS 'User edit patterns for AI learning feedback loop';



CREATE TABLE IF NOT EXISTS "storage"."buckets" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "public" boolean DEFAULT false,
    "avif_autodetection" boolean DEFAULT false,
    "file_size_limit" bigint,
    "allowed_mime_types" "text"[],
    "owner_id" "text",
    "type" "storage"."buckettype" DEFAULT 'STANDARD'::"storage"."buckettype" NOT NULL
);


ALTER TABLE "storage"."buckets" OWNER TO "supabase_storage_admin";


COMMENT ON COLUMN "storage"."buckets"."owner" IS 'Field is deprecated, use owner_id instead';



CREATE TABLE IF NOT EXISTS "storage"."buckets_analytics" (
    "name" "text" NOT NULL,
    "type" "storage"."buckettype" DEFAULT 'ANALYTICS'::"storage"."buckettype" NOT NULL,
    "format" "text" DEFAULT 'ICEBERG'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "storage"."buckets_analytics" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."buckets_vectors" (
    "id" "text" NOT NULL,
    "type" "storage"."buckettype" DEFAULT 'VECTOR'::"storage"."buckettype" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."buckets_vectors" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."migrations" (
    "id" integer NOT NULL,
    "name" character varying(100) NOT NULL,
    "hash" character varying(40) NOT NULL,
    "executed_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "storage"."migrations" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."objects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bucket_id" "text",
    "name" "text",
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_accessed_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb",
    "path_tokens" "text"[] GENERATED ALWAYS AS ("string_to_array"("name", '/'::"text")) STORED,
    "version" "text",
    "owner_id" "text",
    "user_metadata" "jsonb",
    "level" integer
);


ALTER TABLE "storage"."objects" OWNER TO "supabase_storage_admin";


COMMENT ON COLUMN "storage"."objects"."owner" IS 'Field is deprecated, use owner_id instead';



CREATE TABLE IF NOT EXISTS "storage"."prefixes" (
    "bucket_id" "text" NOT NULL,
    "name" "text" NOT NULL COLLATE "pg_catalog"."C",
    "level" integer GENERATED ALWAYS AS ("storage"."get_level"("name")) STORED NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "storage"."prefixes" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."s3_multipart_uploads" (
    "id" "text" NOT NULL,
    "in_progress_size" bigint DEFAULT 0 NOT NULL,
    "upload_signature" "text" NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "version" "text" NOT NULL,
    "owner_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_metadata" "jsonb"
);


ALTER TABLE "storage"."s3_multipart_uploads" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."s3_multipart_uploads_parts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "upload_id" "text" NOT NULL,
    "size" bigint DEFAULT 0 NOT NULL,
    "part_number" integer NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "etag" "text" NOT NULL,
    "owner_id" "text",
    "version" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."s3_multipart_uploads_parts" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."vector_indexes" (
    "id" "text" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL COLLATE "pg_catalog"."C",
    "bucket_id" "text" NOT NULL,
    "data_type" "text" NOT NULL,
    "dimension" integer NOT NULL,
    "distance_metric" "text" NOT NULL,
    "metadata_configuration" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."vector_indexes" OWNER TO "supabase_storage_admin";


ALTER TABLE ONLY "auth"."refresh_tokens" ALTER COLUMN "id" SET DEFAULT "nextval"('"auth"."refresh_tokens_id_seq"'::"regclass");



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "amr_id_pk" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."audit_log_entries"
    ADD CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."flow_state"
    ADD CONSTRAINT "flow_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_provider_id_provider_unique" UNIQUE ("provider_id", "provider");



ALTER TABLE ONLY "auth"."instances"
    ADD CONSTRAINT "instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_authentication_method_pkey" UNIQUE ("session_id", "authentication_method");



ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_last_challenged_at_key" UNIQUE ("last_challenged_at");



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_code_key" UNIQUE ("authorization_code");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_id_key" UNIQUE ("authorization_id");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_client_states"
    ADD CONSTRAINT "oauth_client_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_clients"
    ADD CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_client_unique" UNIQUE ("user_id", "client_id");



ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_token_unique" UNIQUE ("token");



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_entity_id_key" UNIQUE ("entity_id");



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version");



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."sso_providers"
    ADD CONSTRAINT "sso_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_brand_profile"
    ADD CONSTRAINT "business_brand_profile_pkey" PRIMARY KEY ("business_id");



ALTER TABLE ONLY "public"."business_concept_fit"
    ADD CONSTRAINT "business_concept_fit_pkey" PRIMARY KEY ("business_id");



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



ALTER TABLE ONLY "public"."business_team_members"
    ADD CONSTRAINT "business_team_members_business_id_user_id_key" UNIQUE ("business_id", "user_id");



ALTER TABLE ONLY "public"."business_team_members"
    ADD CONSTRAINT "business_team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_type_defaults"
    ADD CONSTRAINT "business_type_defaults_pkey" PRIMARY KEY ("business_type");



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_owner_id_key" UNIQUE ("owner_id");



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_distribution_rules"
    ADD CONSTRAINT "content_distribution_rules_business_type_content_type_id_key" UNIQUE ("business_type", "content_type_id");



ALTER TABLE ONLY "public"."content_distribution_rules"
    ADD CONSTRAINT "content_distribution_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_performance_log"
    ADD CONSTRAINT "content_performance_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_type_baselines"
    ADD CONSTRAINT "content_type_baselines_pkey" PRIMARY KEY ("business_id");



ALTER TABLE ONLY "public"."content_types"
    ADD CONSTRAINT "content_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contextual_calendar"
    ADD CONSTRAINT "contextual_calendar_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media_assets"
    ADD CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_extractions"
    ADD CONSTRAINT "menu_extractions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_item_metadata"
    ADD CONSTRAINT "menu_item_metadata_business_id_item_name_key" UNIQUE ("business_id", "item_name");



ALTER TABLE ONLY "public"."menu_item_metadata"
    ADD CONSTRAINT "menu_item_metadata_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."opportunity_tracking"
    ADD CONSTRAINT "opportunity_tracking_business_id_opportunity_type_opportuni_key" UNIQUE ("business_id", "opportunity_type", "opportunity_subtype");



ALTER TABLE ONLY "public"."opportunity_tracking"
    ADD CONSTRAINT "opportunity_tracking_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_assignment_rules"
    ADD CONSTRAINT "platform_assignment_rules_content_type_id_key" UNIQUE ("content_type_id");



ALTER TABLE ONLY "public"."platform_assignment_rules"
    ADD CONSTRAINT "platform_assignment_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_approvals"
    ADD CONSTRAINT "post_approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_approvals"
    ADD CONSTRAINT "post_approvals_plan_id_post_index_key" UNIQUE ("plan_id", "post_index");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seasonal_ingredients"
    ADD CONSTRAINT "seasonal_ingredients_ingredient_name_country_code_season_key" UNIQUE ("ingredient_name", "country_code", "season");



ALTER TABLE ONLY "public"."seasonal_ingredients"
    ADD CONSTRAINT "seasonal_ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_accounts"
    ADD CONSTRAINT "social_accounts_business_id_platform_key" UNIQUE ("business_id", "platform");



ALTER TABLE ONLY "public"."social_accounts"
    ADD CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."website_analyses"
    ADD CONSTRAINT "website_analyses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_content_plans"
    ADD CONSTRAINT "weekly_content_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets_analytics"
    ADD CONSTRAINT "buckets_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets"
    ADD CONSTRAINT "buckets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets_vectors"
    ADD CONSTRAINT "buckets_vectors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_name_key" UNIQUE ("name");



ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."prefixes"
    ADD CONSTRAINT "prefixes_pkey" PRIMARY KEY ("bucket_id", "level", "name");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."vector_indexes"
    ADD CONSTRAINT "vector_indexes_pkey" PRIMARY KEY ("id");



CREATE INDEX "audit_logs_instance_id_idx" ON "auth"."audit_log_entries" USING "btree" ("instance_id");



CREATE UNIQUE INDEX "confirmation_token_idx" ON "auth"."users" USING "btree" ("confirmation_token") WHERE (("confirmation_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "email_change_token_current_idx" ON "auth"."users" USING "btree" ("email_change_token_current") WHERE (("email_change_token_current")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "email_change_token_new_idx" ON "auth"."users" USING "btree" ("email_change_token_new") WHERE (("email_change_token_new")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "factor_id_created_at_idx" ON "auth"."mfa_factors" USING "btree" ("user_id", "created_at");



CREATE INDEX "flow_state_created_at_idx" ON "auth"."flow_state" USING "btree" ("created_at" DESC);



CREATE INDEX "identities_email_idx" ON "auth"."identities" USING "btree" ("email" "text_pattern_ops");



COMMENT ON INDEX "auth"."identities_email_idx" IS 'Auth: Ensures indexed queries on the email column';



CREATE INDEX "identities_user_id_idx" ON "auth"."identities" USING "btree" ("user_id");



CREATE INDEX "idx_auth_code" ON "auth"."flow_state" USING "btree" ("auth_code");



CREATE INDEX "idx_oauth_client_states_created_at" ON "auth"."oauth_client_states" USING "btree" ("created_at");



CREATE INDEX "idx_user_id_auth_method" ON "auth"."flow_state" USING "btree" ("user_id", "authentication_method");



CREATE INDEX "mfa_challenge_created_at_idx" ON "auth"."mfa_challenges" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "mfa_factors_user_friendly_name_unique" ON "auth"."mfa_factors" USING "btree" ("friendly_name", "user_id") WHERE (TRIM(BOTH FROM "friendly_name") <> ''::"text");



CREATE INDEX "mfa_factors_user_id_idx" ON "auth"."mfa_factors" USING "btree" ("user_id");



CREATE INDEX "oauth_auth_pending_exp_idx" ON "auth"."oauth_authorizations" USING "btree" ("expires_at") WHERE ("status" = 'pending'::"auth"."oauth_authorization_status");



CREATE INDEX "oauth_clients_deleted_at_idx" ON "auth"."oauth_clients" USING "btree" ("deleted_at");



CREATE INDEX "oauth_consents_active_client_idx" ON "auth"."oauth_consents" USING "btree" ("client_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "oauth_consents_active_user_client_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "client_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "oauth_consents_user_order_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "granted_at" DESC);



CREATE INDEX "one_time_tokens_relates_to_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("relates_to");



CREATE INDEX "one_time_tokens_token_hash_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("token_hash");



CREATE UNIQUE INDEX "one_time_tokens_user_id_token_type_key" ON "auth"."one_time_tokens" USING "btree" ("user_id", "token_type");



CREATE UNIQUE INDEX "reauthentication_token_idx" ON "auth"."users" USING "btree" ("reauthentication_token") WHERE (("reauthentication_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "recovery_token_idx" ON "auth"."users" USING "btree" ("recovery_token") WHERE (("recovery_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "refresh_tokens_instance_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id");



CREATE INDEX "refresh_tokens_instance_id_user_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id", "user_id");



CREATE INDEX "refresh_tokens_parent_idx" ON "auth"."refresh_tokens" USING "btree" ("parent");



CREATE INDEX "refresh_tokens_session_id_revoked_idx" ON "auth"."refresh_tokens" USING "btree" ("session_id", "revoked");



CREATE INDEX "refresh_tokens_updated_at_idx" ON "auth"."refresh_tokens" USING "btree" ("updated_at" DESC);



CREATE INDEX "saml_providers_sso_provider_id_idx" ON "auth"."saml_providers" USING "btree" ("sso_provider_id");



CREATE INDEX "saml_relay_states_created_at_idx" ON "auth"."saml_relay_states" USING "btree" ("created_at" DESC);



CREATE INDEX "saml_relay_states_for_email_idx" ON "auth"."saml_relay_states" USING "btree" ("for_email");



CREATE INDEX "saml_relay_states_sso_provider_id_idx" ON "auth"."saml_relay_states" USING "btree" ("sso_provider_id");



CREATE INDEX "sessions_not_after_idx" ON "auth"."sessions" USING "btree" ("not_after" DESC);



CREATE INDEX "sessions_oauth_client_id_idx" ON "auth"."sessions" USING "btree" ("oauth_client_id");



CREATE INDEX "sessions_user_id_idx" ON "auth"."sessions" USING "btree" ("user_id");



CREATE UNIQUE INDEX "sso_domains_domain_idx" ON "auth"."sso_domains" USING "btree" ("lower"("domain"));



CREATE INDEX "sso_domains_sso_provider_id_idx" ON "auth"."sso_domains" USING "btree" ("sso_provider_id");



CREATE UNIQUE INDEX "sso_providers_resource_id_idx" ON "auth"."sso_providers" USING "btree" ("lower"("resource_id"));



CREATE INDEX "sso_providers_resource_id_pattern_idx" ON "auth"."sso_providers" USING "btree" ("resource_id" "text_pattern_ops");



CREATE UNIQUE INDEX "unique_phone_factor_per_user" ON "auth"."mfa_factors" USING "btree" ("user_id", "phone");



CREATE INDEX "user_id_created_at_idx" ON "auth"."sessions" USING "btree" ("user_id", "created_at");



CREATE UNIQUE INDEX "users_email_partial_key" ON "auth"."users" USING "btree" ("email") WHERE ("is_sso_user" = false);



COMMENT ON INDEX "auth"."users_email_partial_key" IS 'Auth: A partial unique index that applies only when is_sso_user is false';



CREATE INDEX "users_instance_id_email_idx" ON "auth"."users" USING "btree" ("instance_id", "lower"(("email")::"text"));



CREATE INDEX "users_instance_id_idx" ON "auth"."users" USING "btree" ("instance_id");



CREATE INDEX "users_is_anonymous_idx" ON "auth"."users" USING "btree" ("is_anonymous");



CREATE INDEX "idx_business_documents_business_id" ON "public"."business_documents" USING "btree" ("business_id");



CREATE INDEX "idx_business_documents_json" ON "public"."business_documents" USING "gin" ("extracted_json");



CREATE INDEX "idx_business_documents_type" ON "public"."business_documents" USING "btree" ("business_id", "document_type");



CREATE INDEX "idx_business_location_coordinates" ON "public"."business_location_intelligence" USING "btree" ("latitude", "longitude");



CREATE INDEX "idx_business_operations_price_level" ON "public"."business_operations" USING "btree" ("price_level");



CREATE INDEX "idx_business_profile_booking_url" ON "public"."business_profile" USING "btree" ("business_id") WHERE ("booking_url" IS NOT NULL);



CREATE INDEX "idx_business_profile_brand_context_generated" ON "public"."business_profile" USING "btree" ("ai_brand_context_generated_at") WHERE ("ai_brand_context" IS NOT NULL);



CREATE INDEX "idx_business_profile_menu_structure" ON "public"."business_profile" USING "gin" ("menu_structure");



CREATE INDEX "idx_business_type_defaults_type" ON "public"."business_type_defaults" USING "btree" ("business_type");



CREATE INDEX "idx_businesses_country" ON "public"."businesses" USING "btree" ("country");



CREATE INDEX "idx_businesses_plan" ON "public"."businesses" USING "btree" ("plan");



CREATE INDEX "idx_concept_fit_business" ON "public"."business_concept_fit" USING "btree" ("business_id");



CREATE INDEX "idx_concept_fit_level" ON "public"."business_concept_fit" USING "btree" ("overall_fit_level");



CREATE INDEX "idx_contextual_calendar_country" ON "public"."contextual_calendar" USING "btree" ("country");



CREATE INDEX "idx_contextual_calendar_dates" ON "public"."contextual_calendar" USING "btree" ("date_start", "date_end");



CREATE INDEX "idx_contextual_calendar_tags" ON "public"."contextual_calendar" USING "gin" ("relevance_tags");



CREATE INDEX "idx_contextual_calendar_type" ON "public"."contextual_calendar" USING "btree" ("event_type");



CREATE INDEX "idx_menu_extractions_business_id" ON "public"."menu_extractions" USING "btree" ("business_id");



CREATE INDEX "idx_menu_extractions_business_type" ON "public"."menu_extractions" USING "btree" ("business_id", "menu_type");



CREATE INDEX "idx_menu_extractions_source" ON "public"."menu_extractions" USING "btree" ("menu_source_id");



CREATE INDEX "idx_menu_items_normalized_business" ON "public"."menu_items_normalized" USING "btree" ("business_id");



CREATE INDEX "idx_menu_items_normalized_category_type" ON "public"."menu_items_normalized" USING "btree" ("category_type");



CREATE INDEX "idx_menu_items_normalized_menu_result" ON "public"."menu_items_normalized" USING "btree" ("menu_result_id");



CREATE INDEX "idx_menu_items_normalized_service_periods" ON "public"."menu_items_normalized" USING "gin" ("service_periods");



CREATE INDEX "idx_menu_items_normalized_signature" ON "public"."menu_items_normalized" USING "btree" ("is_signature") WHERE ("is_signature" = true);



CREATE INDEX "idx_menu_items_normalized_temp_category" ON "public"."menu_items_normalized" USING "btree" ("dish_temp_category");



CREATE INDEX "idx_menu_metadata_business" ON "public"."menu_item_metadata" USING "btree" ("business_id");



CREATE INDEX "idx_menu_metadata_last_posted" ON "public"."menu_item_metadata" USING "btree" ("last_posted_date");



CREATE INDEX "idx_menu_metadata_new" ON "public"."menu_item_metadata" USING "btree" ("item_added_date" DESC);



CREATE INDEX "idx_menu_metadata_seasonal" ON "public"."menu_item_metadata" USING "btree" ("is_seasonal") WHERE ("is_seasonal" = true);



CREATE INDEX "idx_menu_metadata_signature" ON "public"."menu_item_metadata" USING "btree" ("is_signature") WHERE ("is_signature" = true);



CREATE INDEX "idx_menu_results_v2_business_status" ON "public"."menu_results_v2" USING "btree" ("business_id", "status");



CREATE INDEX "idx_menu_results_v2_claimed_at" ON "public"."menu_results_v2" USING "btree" ("claimed_at");



CREATE INDEX "idx_menu_results_v2_service_periods" ON "public"."menu_results_v2" USING "gin" ("service_periods");



CREATE INDEX "idx_menu_results_v2_sha" ON "public"."menu_results_v2" USING "btree" ("sha256");



CREATE INDEX "idx_menu_results_v2_signature" ON "public"."menu_results_v2" USING "btree" ("business_id", "is_signature") WHERE ("is_signature" = true);



CREATE INDEX "idx_menu_results_v2_source_id" ON "public"."menu_results_v2" USING "btree" ("source_id");



CREATE INDEX "idx_menu_results_v2_status_created_at" ON "public"."menu_results_v2" USING "btree" ("status", "created_at");



CREATE INDEX "idx_menu_sources_business_id" ON "public"."menu_sources" USING "btree" ("business_id");



CREATE INDEX "idx_menu_sources_status" ON "public"."menu_sources" USING "btree" ("business_id", "status");



CREATE INDEX "idx_opportunity_tracking_business" ON "public"."opportunity_tracking" USING "btree" ("business_id");



CREATE INDEX "idx_opportunity_tracking_last_posted" ON "public"."opportunity_tracking" USING "btree" ("last_posted_date");



CREATE INDEX "idx_opportunity_tracking_type" ON "public"."opportunity_tracking" USING "btree" ("opportunity_type");



CREATE INDEX "idx_perf_log_business" ON "public"."content_performance_log" USING "btree" ("business_id");



CREATE INDEX "idx_perf_log_business_date" ON "public"."content_performance_log" USING "btree" ("business_id", "posted_at" DESC);



CREATE INDEX "idx_perf_log_business_type" ON "public"."content_performance_log" USING "btree" ("business_id", "content_type");



CREATE INDEX "idx_perf_log_content_type" ON "public"."content_performance_log" USING "btree" ("content_type");



CREATE INDEX "idx_perf_log_engagement_rate" ON "public"."content_performance_log" USING "btree" ("engagement_rate" DESC);



CREATE INDEX "idx_perf_log_platform" ON "public"."content_performance_log" USING "btree" ("platform");



CREATE INDEX "idx_perf_log_posted_at" ON "public"."content_performance_log" USING "btree" ("posted_at" DESC);



CREATE INDEX "idx_post_approvals_plan" ON "public"."post_approvals" USING "btree" ("plan_id");



CREATE INDEX "idx_post_approvals_status" ON "public"."post_approvals" USING "btree" ("status");



CREATE INDEX "idx_profiles_plan" ON "public"."profiles" USING "btree" ("plan");



CREATE INDEX "idx_seasonal_country_season" ON "public"."seasonal_ingredients" USING "btree" ("country_code", "season");



CREATE INDEX "idx_weekly_plans_business" ON "public"."weekly_content_plans" USING "btree" ("business_id");



CREATE INDEX "idx_weekly_plans_user" ON "public"."weekly_content_plans" USING "btree" ("user_id");



CREATE INDEX "idx_weekly_plans_user_week" ON "public"."weekly_content_plans" USING "btree" ("user_id", "week_start");



CREATE INDEX "idx_weekly_plans_week_start" ON "public"."weekly_content_plans" USING "btree" ("week_start");



CREATE UNIQUE INDEX "unique_primary_location_per_business" ON "public"."business_locations" USING "btree" ("business_id") WHERE ("is_primary" = true);



CREATE UNIQUE INDEX "bname" ON "storage"."buckets" USING "btree" ("name");



CREATE UNIQUE INDEX "bucketid_objname" ON "storage"."objects" USING "btree" ("bucket_id", "name");



CREATE UNIQUE INDEX "buckets_analytics_unique_name_idx" ON "storage"."buckets_analytics" USING "btree" ("name") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_multipart_uploads_list" ON "storage"."s3_multipart_uploads" USING "btree" ("bucket_id", "key", "created_at");



CREATE UNIQUE INDEX "idx_name_bucket_level_unique" ON "storage"."objects" USING "btree" ("name" COLLATE "C", "bucket_id", "level");



CREATE INDEX "idx_objects_bucket_id_name" ON "storage"."objects" USING "btree" ("bucket_id", "name" COLLATE "C");



CREATE INDEX "idx_objects_lower_name" ON "storage"."objects" USING "btree" (("path_tokens"["level"]), "lower"("name") "text_pattern_ops", "bucket_id", "level");



CREATE INDEX "idx_prefixes_lower_name" ON "storage"."prefixes" USING "btree" ("bucket_id", "level", (("string_to_array"("name", '/'::"text"))["level"]), "lower"("name") "text_pattern_ops");



CREATE INDEX "name_prefix_search" ON "storage"."objects" USING "btree" ("name" "text_pattern_ops");



CREATE UNIQUE INDEX "objects_bucket_id_level_idx" ON "storage"."objects" USING "btree" ("bucket_id", "level", "name" COLLATE "C");



CREATE UNIQUE INDEX "vector_indexes_name_bucket_id_idx" ON "storage"."vector_indexes" USING "btree" ("name", "bucket_id");



CREATE OR REPLACE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();



CREATE OR REPLACE TRIGGER "menu_results_v2_updated_at" BEFORE UPDATE ON "public"."menu_results_v2" FOR EACH ROW EXECUTE FUNCTION "public"."update_menu_results_v2_updated_at"();



CREATE OR REPLACE TRIGGER "on_profile_updated" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_contextual_calendar_updated_at" BEFORE UPDATE ON "public"."contextual_calendar" FOR EACH ROW EXECUTE FUNCTION "public"."update_contextual_calendar_updated_at"();



CREATE OR REPLACE TRIGGER "update_baselines_updated_at" BEFORE UPDATE ON "public"."content_type_baselines" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_menu_metadata_updated_at" BEFORE UPDATE ON "public"."menu_item_metadata" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_opportunity_tracking_updated_at" BEFORE UPDATE ON "public"."opportunity_tracking" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_perf_log_updated_at" BEFORE UPDATE ON "public"."content_performance_log" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_post_approvals_updated_at" BEFORE UPDATE ON "public"."post_approvals" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_weekly_plans_updated_at" BEFORE UPDATE ON "public"."weekly_content_plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "enforce_bucket_name_length_trigger" BEFORE INSERT OR UPDATE OF "name" ON "storage"."buckets" FOR EACH ROW EXECUTE FUNCTION "storage"."enforce_bucket_name_length"();



CREATE OR REPLACE TRIGGER "objects_delete_delete_prefix" AFTER DELETE ON "storage"."objects" FOR EACH ROW EXECUTE FUNCTION "storage"."delete_prefix_hierarchy_trigger"();



CREATE OR REPLACE TRIGGER "objects_insert_create_prefix" BEFORE INSERT ON "storage"."objects" FOR EACH ROW EXECUTE FUNCTION "storage"."objects_insert_prefix_trigger"();



CREATE OR REPLACE TRIGGER "objects_update_create_prefix" BEFORE UPDATE ON "storage"."objects" FOR EACH ROW WHEN ((("new"."name" <> "old"."name") OR ("new"."bucket_id" <> "old"."bucket_id"))) EXECUTE FUNCTION "storage"."objects_update_prefix_trigger"();



CREATE OR REPLACE TRIGGER "prefixes_create_hierarchy" BEFORE INSERT ON "storage"."prefixes" FOR EACH ROW WHEN (("pg_trigger_depth"() < 1)) EXECUTE FUNCTION "storage"."prefixes_insert_trigger"();



CREATE OR REPLACE TRIGGER "prefixes_delete_hierarchy" AFTER DELETE ON "storage"."prefixes" FOR EACH ROW EXECUTE FUNCTION "storage"."delete_prefix_hierarchy_trigger"();



CREATE OR REPLACE TRIGGER "update_objects_updated_at" BEFORE UPDATE ON "storage"."objects" FOR EACH ROW EXECUTE FUNCTION "storage"."update_updated_at_column"();



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_auth_factor_id_fkey" FOREIGN KEY ("factor_id") REFERENCES "auth"."mfa_factors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_flow_state_id_fkey" FOREIGN KEY ("flow_state_id") REFERENCES "auth"."flow_state"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_oauth_client_id_fkey" FOREIGN KEY ("oauth_client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_brand_profile"
    ADD CONSTRAINT "business_brand_profile_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_concept_fit"
    ADD CONSTRAINT "business_concept_fit_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_concept_fit"
    ADD CONSTRAINT "business_concept_fit_business_id_fkey1" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id");



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



ALTER TABLE ONLY "public"."business_team_members"
    ADD CONSTRAINT "business_team_members_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_team_members"
    ADD CONSTRAINT "business_team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_distribution_rules"
    ADD CONSTRAINT "content_distribution_rules_business_type_fkey" FOREIGN KEY ("business_type") REFERENCES "public"."business_type_defaults"("business_type");



ALTER TABLE ONLY "public"."content_distribution_rules"
    ADD CONSTRAINT "content_distribution_rules_content_type_id_fkey" FOREIGN KEY ("content_type_id") REFERENCES "public"."content_types"("id");



ALTER TABLE ONLY "public"."content_performance_log"
    ADD CONSTRAINT "content_performance_log_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_type_baselines"
    ADD CONSTRAINT "content_type_baselines_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media_assets"
    ADD CONSTRAINT "media_assets_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_extractions"
    ADD CONSTRAINT "menu_extractions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_extractions"
    ADD CONSTRAINT "menu_extractions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."menu_extractions"
    ADD CONSTRAINT "menu_extractions_menu_source_id_fkey" FOREIGN KEY ("menu_source_id") REFERENCES "public"."menu_sources"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."menu_item_metadata"
    ADD CONSTRAINT "menu_item_metadata_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



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



ALTER TABLE ONLY "public"."opportunity_tracking"
    ADD CONSTRAINT "opportunity_tracking_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_assignment_rules"
    ADD CONSTRAINT "platform_assignment_rules_content_type_id_fkey" FOREIGN KEY ("content_type_id") REFERENCES "public"."content_types"("id");



ALTER TABLE ONLY "public"."post_approvals"
    ADD CONSTRAINT "post_approvals_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."post_approvals"
    ADD CONSTRAINT "post_approvals_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."weekly_content_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."social_accounts"
    ADD CONSTRAINT "social_accounts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."website_analyses"
    ADD CONSTRAINT "website_analyses_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weekly_content_plans"
    ADD CONSTRAINT "weekly_content_plans_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weekly_content_plans"
    ADD CONSTRAINT "weekly_content_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."prefixes"
    ADD CONSTRAINT "prefixes_bucketId_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "storage"."s3_multipart_uploads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "storage"."vector_indexes"
    ADD CONSTRAINT "vector_indexes_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets_vectors"("id");



ALTER TABLE "auth"."audit_log_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."flow_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."identities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."instances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_amr_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_factors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."one_time_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."refresh_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."saml_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."saml_relay_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."schema_migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sso_domains" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sso_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Allow delete for service role" ON "public"."menu_items_normalized" FOR DELETE TO "service_role" USING (true);



CREATE POLICY "Allow insert for service role" ON "public"."menu_items_normalized" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Allow read access for authenticated users" ON "public"."menu_items_normalized" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow update for service role" ON "public"."menu_items_normalized" FOR UPDATE TO "service_role" USING (true);



CREATE POLICY "Members can accept own invitation" ON "public"."business_team_members" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Owners can add team members" ON "public"."business_team_members" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "business_team_members"."business_id") AND ("b"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Owners can create business profile" ON "public"."business_profile" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "business_profile"."business_id") AND ("b"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Owners can delete business profile" ON "public"."business_profile" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "business_profile"."business_id") AND ("b"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Owners can delete own business" ON "public"."businesses" FOR DELETE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Owners can manage business locations" ON "public"."business_locations" USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "business_locations"."business_id") AND ("b"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "business_locations"."business_id") AND ("b"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Owners can remove team members" ON "public"."business_team_members" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "business_team_members"."business_id") AND ("b"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Owners can update business profile" ON "public"."business_profile" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "business_profile"."business_id") AND ("b"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Owners can update own business" ON "public"."businesses" FOR UPDATE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Owners can view business profile" ON "public"."business_profile" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "business_profile"."business_id") AND ("b"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Owners can view own business" ON "public"."businesses" FOR SELECT USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Owners can view team members" ON "public"."business_team_members" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "business_team_members"."business_id") AND ("b"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Service role has full access to concept fit" ON "public"."business_concept_fit" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Team members can view other members" ON "public"."business_team_members" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."business_team_members" "btm"
  WHERE (("btm"."business_id" = "business_team_members"."business_id") AND ("btm"."user_id" = "auth"."uid"()) AND ("btm"."accepted_at" IS NOT NULL))))));



CREATE POLICY "Team members can view their team" ON "public"."business_team_members" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can create own business" ON "public"."businesses" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can create post approvals for their plans" ON "public"."post_approvals" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."weekly_content_plans"
  WHERE (("weekly_content_plans"."id" = "post_approvals"."plan_id") AND ("weekly_content_plans"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can create their own weekly plans" ON "public"."weekly_content_plans" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete business brand profile" ON "public"."business_brand_profile" FOR DELETE USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete business operations" ON "public"."business_operations" FOR DELETE USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete post approvals for their plans" ON "public"."post_approvals" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."weekly_content_plans"
  WHERE (("weekly_content_plans"."id" = "post_approvals"."plan_id") AND ("weekly_content_plans"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete their business menu results v2" ON "public"."menu_results_v2" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "menu_results_v2"."business_id") AND ("b"."owner_id" = "auth"."uid"())))));



COMMENT ON POLICY "Users can delete their business menu results v2" ON "public"."menu_results_v2" IS 'Allows business owners to delete menu extraction results for their own businesses';



CREATE POLICY "Users can delete their own business" ON "public"."businesses" FOR DELETE USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own business documents" ON "public"."business_documents" FOR DELETE USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete their own business menu extractions" ON "public"."menu_extractions" FOR DELETE USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete their own business menu sources" ON "public"."menu_sources" FOR DELETE USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete their own weekly plans" ON "public"."weekly_content_plans" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert business brand profile" ON "public"."business_brand_profile" FOR INSERT WITH CHECK (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert business operations" ON "public"."business_operations" FOR INSERT WITH CHECK (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert documents for their businesses" ON "public"."business_documents" FOR INSERT WITH CHECK (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert menu extractions for their business" ON "public"."menu_extractions" FOR INSERT WITH CHECK ((("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))) AND ("created_by" = "auth"."uid"())));



CREATE POLICY "Users can insert menu sources for their business" ON "public"."menu_sources" FOR INSERT WITH CHECK ((("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))) AND ("created_by" = "auth"."uid"())));



CREATE POLICY "Users can insert own business" ON "public"."businesses" FOR INSERT WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert their business concept fit" ON "public"."business_concept_fit" FOR INSERT WITH CHECK (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert their own business" ON "public"."businesses" FOR INSERT WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their brand profile" ON "public"."business_brand_profile" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can manage their business profile" ON "public"."business_profile" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can manage their opening hours" ON "public"."opening_hours" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"())))) WITH CHECK (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can read their business concept fit" ON "public"."business_concept_fit" FOR SELECT USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can update business brand profile" ON "public"."business_brand_profile" FOR UPDATE USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"())))) WITH CHECK (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can update business operations" ON "public"."business_operations" FOR UPDATE USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"())))) WITH CHECK (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own business" ON "public"."businesses" FOR UPDATE USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update post approvals for their plans" ON "public"."post_approvals" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."weekly_content_plans"
  WHERE (("weekly_content_plans"."id" = "post_approvals"."plan_id") AND ("weekly_content_plans"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update their business concept fit" ON "public"."business_concept_fit" FOR UPDATE USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can update their business menu results v2" ON "public"."menu_results_v2" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "menu_results_v2"."business_id") AND ("b"."owner_id" = "auth"."uid"())))));



COMMENT ON POLICY "Users can update their business menu results v2" ON "public"."menu_results_v2" IS 'Allows business owners to update menu extraction results for their own businesses (for editing extracted menus)';



CREATE POLICY "Users can update their own business" ON "public"."businesses" FOR UPDATE USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own business documents" ON "public"."business_documents" FOR UPDATE USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can update their own business menu extractions" ON "public"."menu_extractions" FOR UPDATE USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can update their own business menu sources" ON "public"."menu_sources" FOR UPDATE USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can update their own weekly plans" ON "public"."weekly_content_plans" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own business" ON "public"."businesses" FOR SELECT USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view post approvals from their plans" ON "public"."post_approvals" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."weekly_content_plans"
  WHERE (("weekly_content_plans"."id" = "post_approvals"."plan_id") AND ("weekly_content_plans"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their business brand profile" ON "public"."business_brand_profile" FOR SELECT USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their business location intelligence" ON "public"."business_location_intelligence" USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their business menu results v2" ON "public"."menu_results_v2" FOR SELECT USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their business operations" ON "public"."business_operations" FOR SELECT USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own business" ON "public"."businesses" FOR SELECT USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own business documents" ON "public"."business_documents" FOR SELECT USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own business menu extractions" ON "public"."menu_extractions" FOR SELECT USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own business menu sources" ON "public"."menu_sources" FOR SELECT USING (("business_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own weekly plans" ON "public"."weekly_content_plans" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."business_brand_profile" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_concept_fit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_location_intelligence" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_operations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_profile" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_team_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."businesses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."menu_extractions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."menu_items_normalized" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."menu_results_v2" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."menu_sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."opening_hours" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_approvals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."social_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weekly_content_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Public can read all post images" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'post-images'::"text"));



CREATE POLICY "Users can delete their business documents" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'business-documents'::"text") AND (("storage"."foldername"("name"))[1] IN ( SELECT ("businesses"."id")::"text" AS "id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete their own images" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'post-images'::"text") AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text")));



CREATE POLICY "Users can read their own images" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'post-images'::"text") AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text")));



CREATE POLICY "Users can upload documents for their businesses" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'business-documents'::"text") AND (("storage"."foldername"("name"))[1] IN ( SELECT ("businesses"."id")::"text" AS "id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can upload to their own folder" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'post-images'::"text") AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text")));



CREATE POLICY "Users can view their business documents" ON "storage"."objects" FOR SELECT USING ((("bucket_id" = 'business-documents'::"text") AND (("storage"."foldername"("name"))[1] IN ( SELECT ("businesses"."id")::"text" AS "id"
   FROM "public"."businesses"
  WHERE ("businesses"."owner_id" = "auth"."uid"())))));



ALTER TABLE "storage"."buckets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."buckets_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."buckets_vectors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."objects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."prefixes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."s3_multipart_uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."s3_multipart_uploads_parts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."vector_indexes" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "auth" TO "anon";
GRANT USAGE ON SCHEMA "auth" TO "authenticated";
GRANT USAGE ON SCHEMA "auth" TO "service_role";
GRANT ALL ON SCHEMA "auth" TO "supabase_auth_admin";
GRANT ALL ON SCHEMA "auth" TO "dashboard_user";
GRANT USAGE ON SCHEMA "auth" TO "postgres";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT USAGE ON SCHEMA "storage" TO "postgres" WITH GRANT OPTION;
GRANT USAGE ON SCHEMA "storage" TO "anon";
GRANT USAGE ON SCHEMA "storage" TO "authenticated";
GRANT USAGE ON SCHEMA "storage" TO "service_role";
GRANT ALL ON SCHEMA "storage" TO "supabase_storage_admin";
GRANT ALL ON SCHEMA "storage" TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."email"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."jwt"() TO "postgres";
GRANT ALL ON FUNCTION "auth"."jwt"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."role"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."uid"() TO "dashboard_user";



GRANT ALL ON FUNCTION "public"."calculate_content_baselines"("p_business_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_content_baselines"("p_business_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_content_baselines"("p_business_id" "uuid") TO "service_role";



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
GRANT ALL ON FUNCTION "public"."claim_menu_result_v2"() TO "anon";
GRANT ALL ON FUNCTION "public"."claim_menu_result_v2"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_menu_result_v2"() TO "service_role";



GRANT ALL ON FUNCTION "public"."classify_category_type"("category_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."classify_category_type"("category_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."classify_category_type"("category_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_business_onboarding"("p_user_id" "uuid", "p_business_name" "text", "p_business_vertical" "text", "p_postal_code" "text", "p_city" "text", "p_country" "text", "p_selected_platforms" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."create_business_onboarding"("p_user_id" "uuid", "p_business_name" "text", "p_business_vertical" "text", "p_postal_code" "text", "p_city" "text", "p_country" "text", "p_selected_platforms" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_business_onboarding"("p_user_id" "uuid", "p_business_name" "text", "p_business_vertical" "text", "p_postal_code" "text", "p_city" "text", "p_country" "text", "p_selected_platforms" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."derive_service_periods"("business_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."derive_service_periods"("business_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."derive_service_periods"("business_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_weekly_post_slots"("p_business_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_weekly_post_slots"("p_business_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_weekly_post_slots"("p_business_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_content_distribution"("p_business_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_content_distribution"("p_business_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_content_distribution"("p_business_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_contextual_events"("p_country" "text", "p_start_date" "date", "p_end_date" "date", "p_tags" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_contextual_events"("p_country" "text", "p_start_date" "date", "p_end_date" "date", "p_tags" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_contextual_events"("p_country" "text", "p_start_date" "date", "p_end_date" "date", "p_tags" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_performance_adjusted_distribution"("p_business_id" "uuid", "p_business_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_performance_adjusted_distribution"("p_business_id" "uuid", "p_business_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_performance_adjusted_distribution"("p_business_id" "uuid", "p_business_type" "text") TO "service_role";



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



GRANT ALL ON FUNCTION "public"."is_business_owner"("business_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_business_owner"("business_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_business_owner"("business_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_team_member"("business_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_team_member"("business_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_team_member"("business_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_post_performance"("p_business_id" "uuid", "p_post_idea_id" "uuid", "p_content_type" "text", "p_platform" "text", "p_posted_at" timestamp with time zone, "p_reach" integer, "p_engagement" integer, "p_likes" integer, "p_comments" integer, "p_shares" integer, "p_saves" integer, "p_clicks" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."log_post_performance"("p_business_id" "uuid", "p_post_idea_id" "uuid", "p_content_type" "text", "p_platform" "text", "p_posted_at" timestamp with time zone, "p_reach" integer, "p_engagement" integer, "p_likes" integer, "p_comments" integer, "p_shares" integer, "p_saves" integer, "p_clicks" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_post_performance"("p_business_id" "uuid", "p_post_idea_id" "uuid", "p_content_type" "text", "p_platform" "text", "p_posted_at" timestamp with time zone, "p_reach" integer, "p_engagement" integer, "p_likes" integer, "p_comments" integer, "p_shares" integer, "p_saves" integer, "p_clicks" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."requeue_stale_menu_results_v2"("max_age_minutes" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."requeue_stale_menu_results_v2"("max_age_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."requeue_stale_menu_results_v2"("max_age_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."requeue_stale_menu_results_v2"("max_age_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_daily_quotas"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_daily_quotas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_daily_quotas"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_monthly_quotas"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_monthly_quotas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_monthly_quotas"() TO "service_role";



GRANT ALL ON FUNCTION "public"."track_opportunity_trigger"("p_business_id" "uuid", "p_opportunity_type" "text", "p_opportunity_subtype" "text", "p_context" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."track_opportunity_trigger"("p_business_id" "uuid", "p_opportunity_type" "text", "p_opportunity_subtype" "text", "p_context" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_opportunity_trigger"("p_business_id" "uuid", "p_opportunity_type" "text", "p_opportunity_subtype" "text", "p_context" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_contextual_calendar_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_contextual_calendar_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_contextual_calendar_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_menu_item_posted"("p_business_id" "uuid", "p_item_name" "text", "p_engagement_rate" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."update_menu_item_posted"("p_business_id" "uuid", "p_item_name" "text", "p_engagement_rate" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_menu_item_posted"("p_business_id" "uuid", "p_item_name" "text", "p_engagement_rate" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_menu_results_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_menu_results_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_menu_results_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_menu_results_v2_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_menu_results_v2_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_menu_results_v2_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_post_performance"("p_post_idea_id" "uuid", "p_reach" integer, "p_engagement" integer, "p_clicks" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_post_performance"("p_post_idea_id" "uuid", "p_reach" integer, "p_engagement" integer, "p_clicks" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_post_performance"("p_post_idea_id" "uuid", "p_reach" integer, "p_engagement" integer, "p_clicks" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_profile_onboarding"("p_user_id" "uuid", "p_business_name" "text", "p_business_category" "text", "p_address" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_profile_onboarding"("p_user_id" "uuid", "p_business_name" "text", "p_business_category" "text", "p_address" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_profile_onboarding"("p_user_id" "uuid", "p_business_name" "text", "p_business_category" "text", "p_address" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_profile_onboarding"("p_user_id" "uuid", "p_business_name" "text", "p_business_category" "text", "p_address" "text", "p_selected_platforms" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_profile_onboarding"("p_user_id" "uuid", "p_business_name" "text", "p_business_category" "text", "p_address" "text", "p_selected_platforms" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_profile_onboarding"("p_user_id" "uuid", "p_business_name" "text", "p_business_category" "text", "p_address" "text", "p_selected_platforms" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "auth"."audit_log_entries" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."audit_log_entries" TO "postgres";
GRANT SELECT ON TABLE "auth"."audit_log_entries" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."flow_state" TO "postgres";
GRANT SELECT ON TABLE "auth"."flow_state" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."flow_state" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."identities" TO "postgres";
GRANT SELECT ON TABLE "auth"."identities" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."identities" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."instances" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."instances" TO "postgres";
GRANT SELECT ON TABLE "auth"."instances" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_amr_claims" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_amr_claims" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_amr_claims" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_challenges" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_challenges" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_challenges" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_factors" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_factors" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_factors" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_authorizations" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_authorizations" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_client_states" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_client_states" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_clients" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_clients" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_consents" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_consents" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."one_time_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."one_time_tokens" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."one_time_tokens" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."refresh_tokens" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."refresh_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."refresh_tokens" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "dashboard_user";
GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "postgres";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."saml_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_providers" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."saml_relay_states" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_relay_states" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_relay_states" TO "dashboard_user";



GRANT SELECT ON TABLE "auth"."schema_migrations" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sessions" TO "postgres";
GRANT SELECT ON TABLE "auth"."sessions" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sessions" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sso_domains" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_domains" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_domains" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sso_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_providers" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."users" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."users" TO "postgres";
GRANT SELECT ON TABLE "auth"."users" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "public"."business_brand_profile" TO "anon";
GRANT ALL ON TABLE "public"."business_brand_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."business_brand_profile" TO "service_role";



GRANT ALL ON TABLE "public"."business_concept_fit" TO "anon";
GRANT ALL ON TABLE "public"."business_concept_fit" TO "authenticated";
GRANT ALL ON TABLE "public"."business_concept_fit" TO "service_role";



GRANT ALL ON TABLE "public"."business_documents" TO "anon";
GRANT ALL ON TABLE "public"."business_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."business_documents" TO "service_role";



GRANT ALL ON TABLE "public"."business_location_intelligence" TO "anon";
GRANT ALL ON TABLE "public"."business_location_intelligence" TO "authenticated";
GRANT ALL ON TABLE "public"."business_location_intelligence" TO "service_role";



GRANT ALL ON TABLE "public"."business_locations" TO "anon";
GRANT ALL ON TABLE "public"."business_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."business_locations" TO "service_role";



GRANT ALL ON TABLE "public"."business_operations" TO "anon";
GRANT ALL ON TABLE "public"."business_operations" TO "authenticated";
GRANT ALL ON TABLE "public"."business_operations" TO "service_role";



GRANT ALL ON TABLE "public"."business_profile" TO "anon";
GRANT ALL ON TABLE "public"."business_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."business_profile" TO "service_role";



GRANT ALL ON TABLE "public"."business_team_members" TO "anon";
GRANT ALL ON TABLE "public"."business_team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."business_team_members" TO "service_role";



GRANT ALL ON TABLE "public"."business_type_defaults" TO "anon";
GRANT ALL ON TABLE "public"."business_type_defaults" TO "authenticated";
GRANT ALL ON TABLE "public"."business_type_defaults" TO "service_role";



GRANT ALL ON TABLE "public"."businesses" TO "anon";
GRANT ALL ON TABLE "public"."businesses" TO "authenticated";
GRANT ALL ON TABLE "public"."businesses" TO "service_role";



GRANT ALL ON TABLE "public"."content_distribution_rules" TO "anon";
GRANT ALL ON TABLE "public"."content_distribution_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."content_distribution_rules" TO "service_role";



GRANT ALL ON TABLE "public"."content_performance_log" TO "anon";
GRANT ALL ON TABLE "public"."content_performance_log" TO "authenticated";
GRANT ALL ON TABLE "public"."content_performance_log" TO "service_role";



GRANT ALL ON TABLE "public"."content_type_baselines" TO "anon";
GRANT ALL ON TABLE "public"."content_type_baselines" TO "authenticated";
GRANT ALL ON TABLE "public"."content_type_baselines" TO "service_role";



GRANT ALL ON TABLE "public"."content_types" TO "anon";
GRANT ALL ON TABLE "public"."content_types" TO "authenticated";
GRANT ALL ON TABLE "public"."content_types" TO "service_role";



GRANT ALL ON TABLE "public"."contextual_calendar" TO "anon";
GRANT ALL ON TABLE "public"."contextual_calendar" TO "authenticated";
GRANT ALL ON TABLE "public"."contextual_calendar" TO "service_role";



GRANT ALL ON TABLE "public"."media_assets" TO "anon";
GRANT ALL ON TABLE "public"."media_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."media_assets" TO "service_role";



GRANT ALL ON TABLE "public"."menu_extractions" TO "anon";
GRANT ALL ON TABLE "public"."menu_extractions" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_extractions" TO "service_role";



GRANT ALL ON TABLE "public"."menu_item_metadata" TO "anon";
GRANT ALL ON TABLE "public"."menu_item_metadata" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_item_metadata" TO "service_role";



GRANT ALL ON TABLE "public"."menu_items_normalized" TO "anon";
GRANT ALL ON TABLE "public"."menu_items_normalized" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_items_normalized" TO "service_role";



GRANT ALL ON TABLE "public"."menu_sources" TO "anon";
GRANT ALL ON TABLE "public"."menu_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_sources" TO "service_role";



GRANT ALL ON TABLE "public"."opening_hours" TO "anon";
GRANT ALL ON TABLE "public"."opening_hours" TO "authenticated";
GRANT ALL ON TABLE "public"."opening_hours" TO "service_role";



GRANT ALL ON TABLE "public"."opportunity_tracking" TO "anon";
GRANT ALL ON TABLE "public"."opportunity_tracking" TO "authenticated";
GRANT ALL ON TABLE "public"."opportunity_tracking" TO "service_role";



GRANT ALL ON TABLE "public"."platform_assignment_rules" TO "anon";
GRANT ALL ON TABLE "public"."platform_assignment_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_assignment_rules" TO "service_role";



GRANT ALL ON TABLE "public"."post_approvals" TO "anon";
GRANT ALL ON TABLE "public"."post_approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."post_approvals" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."seasonal_ingredients" TO "anon";
GRANT ALL ON TABLE "public"."seasonal_ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."seasonal_ingredients" TO "service_role";



GRANT ALL ON TABLE "public"."social_accounts" TO "anon";
GRANT ALL ON TABLE "public"."social_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."social_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."website_analyses" TO "anon";
GRANT ALL ON TABLE "public"."website_analyses" TO "authenticated";
GRANT ALL ON TABLE "public"."website_analyses" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_content_plans" TO "anon";
GRANT ALL ON TABLE "public"."weekly_content_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_content_plans" TO "service_role";



REVOKE ALL ON TABLE "storage"."buckets" FROM "supabase_storage_admin";
GRANT ALL ON TABLE "storage"."buckets" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON TABLE "storage"."buckets" TO "anon";
GRANT ALL ON TABLE "storage"."buckets" TO "authenticated";
GRANT ALL ON TABLE "storage"."buckets" TO "service_role";
GRANT ALL ON TABLE "storage"."buckets" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "storage"."buckets_analytics" TO "service_role";
GRANT ALL ON TABLE "storage"."buckets_analytics" TO "authenticated";
GRANT ALL ON TABLE "storage"."buckets_analytics" TO "anon";



GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "service_role";
GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "authenticated";
GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "anon";



REVOKE ALL ON TABLE "storage"."objects" FROM "supabase_storage_admin";
GRANT ALL ON TABLE "storage"."objects" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON TABLE "storage"."objects" TO "anon";
GRANT ALL ON TABLE "storage"."objects" TO "authenticated";
GRANT ALL ON TABLE "storage"."objects" TO "service_role";
GRANT ALL ON TABLE "storage"."objects" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "storage"."prefixes" TO "service_role";
GRANT ALL ON TABLE "storage"."prefixes" TO "authenticated";
GRANT ALL ON TABLE "storage"."prefixes" TO "anon";



GRANT ALL ON TABLE "storage"."s3_multipart_uploads" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "anon";



GRANT ALL ON TABLE "storage"."s3_multipart_uploads_parts" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "anon";



GRANT SELECT ON TABLE "storage"."vector_indexes" TO "service_role";
GRANT SELECT ON TABLE "storage"."vector_indexes" TO "authenticated";
GRANT SELECT ON TABLE "storage"."vector_indexes" TO "anon";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES TO "dashboard_user";



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






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "service_role";




