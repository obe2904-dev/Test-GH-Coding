-- Add JSONB columns for structured brand profile fields
-- Safe two-step migration: new jsonb columns + best-effort backfill from legacy TEXT

ALTER TABLE public.business_brand_profile
  ADD COLUMN IF NOT EXISTS image_preferences_jsonb JSONB,
  ADD COLUMN IF NOT EXISTS things_to_avoid_jsonb JSONB,
  ADD COLUMN IF NOT EXISTS core_offerings_jsonb JSONB;

COMMENT ON COLUMN public.business_brand_profile.image_preferences_jsonb IS 'Structured image preferences JSON: {dos:[], donts:[], signature_shot:""}';
COMMENT ON COLUMN public.business_brand_profile.things_to_avoid_jsonb IS 'Structured avoidances JSON: {hard_constraints:[], soft_suggestions:[]}';
COMMENT ON COLUMN public.business_brand_profile.core_offerings_jsonb IS 'Structured offerings JSON: {meal_anchors:[], experience_service_anchors:[], unknowns:[], raw_text:""}';

-- -----------------------------
-- Backfill helpers (temporary)
-- -----------------------------

CREATE OR REPLACE FUNCTION public._tmp_try_parse_jsonb(input_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;

  input_text := btrim(input_text);
  IF input_text = '' THEN
    RETURN NULL;
  END IF;

  -- Only attempt cast for JSON-looking values
  IF left(input_text, 1) NOT IN ('{', '[') THEN
    RETURN NULL;
  END IF;

  RETURN input_text::jsonb;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public._tmp_parse_image_preferences_legacy(input_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  m TEXT[];
  dos_arr TEXT[];
  donts_arr TEXT[];
  sig TEXT;
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;

  -- Legacy format from backend (older):
  -- DO:\n- ...\n\nDON'T:\n- ...\n\nSIGNATURE SHOT:\n- ...
  m := regexp_match(input_text, 'DO:\s*\n(.*?)\n\nDON''T:\s*\n(.*?)\n\nSIGNATURE SHOT:\s*\n-\s*(.*)$', 's');
  IF m IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(array_agg(cleaned ORDER BY ord), ARRAY[]::TEXT[])
  INTO dos_arr
  FROM (
    SELECT ord,
           NULLIF(regexp_replace(btrim(line), '^[-•]\s*', ''), '') AS cleaned
    FROM regexp_split_to_table(m[1], E'\\n') WITH ORDINALITY AS t(line, ord)
  ) s
  WHERE cleaned IS NOT NULL;

  SELECT COALESCE(array_agg(cleaned ORDER BY ord), ARRAY[]::TEXT[])
  INTO donts_arr
  FROM (
    SELECT ord,
           NULLIF(regexp_replace(btrim(line), '^[-•]\s*', ''), '') AS cleaned
    FROM regexp_split_to_table(m[2], E'\\n') WITH ORDINALITY AS t(line, ord)
  ) s
  WHERE cleaned IS NOT NULL;

  sig := btrim(m[3]);

  RETURN jsonb_build_object(
    'dos', to_jsonb(dos_arr),
    'donts', to_jsonb(donts_arr),
    'signature_shot', COALESCE(sig, '')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public._tmp_parse_things_to_avoid_legacy(input_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  m TEXT[];
  hard_arr TEXT[];
  soft_arr TEXT[];
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;

  -- Legacy format from backend (older):
  -- HARD CONSTRAINTS:\n...\n\nSOFT SUGGESTIONS:\n...
  m := regexp_match(input_text, 'HARD CONSTRAINTS:\s*\n(.*?)\n\nSOFT SUGGESTIONS:\s*\n(.*)$', 's');
  IF m IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(array_agg(cleaned ORDER BY ord), ARRAY[]::TEXT[])
  INTO hard_arr
  FROM (
    SELECT ord,
           NULLIF(regexp_replace(btrim(line), '^[-•]\s*', ''), '') AS cleaned
    FROM regexp_split_to_table(m[1], E'\\n') WITH ORDINALITY AS t(line, ord)
  ) s
  WHERE cleaned IS NOT NULL
    AND cleaned <> 'Ingen eksplicitte begrænsninger';

  SELECT COALESCE(array_agg(cleaned ORDER BY ord), ARRAY[]::TEXT[])
  INTO soft_arr
  FROM (
    SELECT ord,
           NULLIF(regexp_replace(btrim(line), '^[-•]\s*', ''), '') AS cleaned
    FROM regexp_split_to_table(m[2], E'\\n') WITH ORDINALITY AS t(line, ord)
  ) s
  WHERE cleaned IS NOT NULL;

  RETURN jsonb_build_object(
    'hard_constraints', to_jsonb(hard_arr),
    'soft_suggestions', to_jsonb(soft_arr)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public._tmp_parse_core_offerings_legacy(input_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  line TEXT;
  cleaned TEXT;
  meal TEXT[] := ARRAY[]::TEXT[];
  exp TEXT[] := ARRAY[]::TEXT[];
  unknowns TEXT[] := ARRAY[]::TEXT[];
  anchor_count INT := 0;
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;

  FOR line IN
    SELECT btrim(x) FROM regexp_split_to_table(input_text, E'\\n') AS x
  LOOP
    IF line ~ '^[-•]\s+' THEN
      cleaned := regexp_replace(line, '^[-•]\s*', '');
      cleaned := NULLIF(btrim(cleaned), '');

      IF cleaned IS NULL THEN
        CONTINUE;
      END IF;

      IF cleaned ILIKE 'Uklart om %' OR cleaned ILIKE 'Unclear %' THEN
        unknowns := array_append(unknowns, cleaned);
      ELSE
        anchor_count := anchor_count + 1;
        IF anchor_count <= 3 THEN
          meal := array_append(meal, cleaned);
        ELSIF anchor_count <= 5 THEN
          exp := array_append(exp, cleaned);
        END IF;
      END IF;
    END IF;
  END LOOP;

  IF cardinality(meal) = 0 AND cardinality(exp) = 0 AND cardinality(unknowns) = 0 THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'meal_anchors', to_jsonb(meal),
    'experience_service_anchors', to_jsonb(exp),
    'unknowns', to_jsonb(unknowns),
    'raw_text', input_text
  );
END;
$$;

-- -----------------------------
-- Backfill (best effort)
-- -----------------------------

UPDATE public.business_brand_profile
SET image_preferences_jsonb = COALESCE(
  image_preferences_jsonb,
  public._tmp_try_parse_jsonb(image_preferences),
  public._tmp_parse_image_preferences_legacy(image_preferences)
)
WHERE image_preferences_jsonb IS NULL
  AND image_preferences IS NOT NULL;

UPDATE public.business_brand_profile
SET things_to_avoid_jsonb = COALESCE(
  things_to_avoid_jsonb,
  public._tmp_try_parse_jsonb(things_to_avoid),
  public._tmp_parse_things_to_avoid_legacy(things_to_avoid)
)
WHERE things_to_avoid_jsonb IS NULL
  AND things_to_avoid IS NOT NULL;

UPDATE public.business_brand_profile
SET core_offerings_jsonb = COALESCE(
  core_offerings_jsonb,
  public._tmp_try_parse_jsonb(core_offerings),
  public._tmp_parse_core_offerings_legacy(core_offerings)
)
WHERE core_offerings_jsonb IS NULL
  AND core_offerings IS NOT NULL;

-- -----------------------------
-- Cleanup temporary helpers
-- -----------------------------

DROP FUNCTION IF EXISTS public._tmp_parse_core_offerings_legacy(TEXT);
DROP FUNCTION IF EXISTS public._tmp_parse_things_to_avoid_legacy(TEXT);
DROP FUNCTION IF EXISTS public._tmp_parse_image_preferences_legacy(TEXT);
DROP FUNCTION IF EXISTS public._tmp_try_parse_jsonb(TEXT);
