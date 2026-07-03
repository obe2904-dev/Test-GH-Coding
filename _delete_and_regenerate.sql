-- Delete week 26 to test the fix
DELETE FROM weekly_content_plans WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79' AND week_number = 26;
DELETE FROM weekly_strategies WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79' AND week_number = 26;

SELECT 
  (SELECT COUNT(*) FROM weekly_strategies WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79' AND week_number = 26) as strategies,
  (SELECT COUNT(*) FROM weekly_content_plans WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79' AND week_number = 26) as plans;
