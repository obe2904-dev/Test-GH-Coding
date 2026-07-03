-- Fix record_text_generation to remove 'selected' column reference
CREATE OR REPLACE FUNCTION record_text_generation(
  p_suggestion_id INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE daily_suggestions
  SET 
    text_generated_count = COALESCE(text_generated_count, 0) + 1,
    first_text_generated_at = COALESCE(first_text_generated_at, NOW()),
    last_text_generated_at = NOW()
  WHERE id = p_suggestion_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
