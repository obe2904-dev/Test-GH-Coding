-- Check location intelligence data for business 768890fd-1c3b-4309-95c4-7451e5906197
SELECT 
  business_id,
  neighborhood,
  area_type,
  category_scores,
  concept_fit_by_category,
  last_updated_by_ai
FROM business_location_intelligence
WHERE business_id = '768890fd-1c3b-4309-95c4-7451e5906197';
