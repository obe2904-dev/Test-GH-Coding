-- =====================================================
-- BACKFILL: Populate media_category on menu_items_normalized
-- =====================================================
-- Purpose: Fill existing rows with FOOD / DRINK / NULL classification
-- Requires: classify_media_category(category_name, item_name, item_description)
-- =====================================================

CREATE OR REPLACE FUNCTION classify_media_category(category_name TEXT, item_name TEXT, item_description TEXT)
RETURNS TEXT AS $$
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
$$ LANGUAGE plpgsql IMMUTABLE;

UPDATE menu_items_normalized
SET media_category = classify_media_category(category_name, item_name, item_description),
    updated_at = NOW()
WHERE media_category IS DISTINCT FROM classify_media_category(category_name, item_name, item_description);

-- Verification summary
SELECT
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE media_category = 'FOOD') AS food_rows,
  COUNT(*) FILTER (WHERE media_category = 'DRINK') AS drink_rows,
  COUNT(*) FILTER (WHERE media_category IS NULL) AS null_rows
FROM menu_items_normalized;

-- Sample output for quick inspection
SELECT
  item_name,
  category_name,
  item_description,
  media_category
FROM menu_items_normalized
ORDER BY updated_at DESC
LIMIT 20;