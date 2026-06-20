-- Stage B5: structured audience segment intelligence
-- Each segment is a JSONB object with: name, priority, who, timing[], motivation, content_angles[], loyalty_weight
ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS audience_segments JSONB DEFAULT NULL;
