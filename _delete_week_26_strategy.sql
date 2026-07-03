-- Delete week 26 strategy for Café Faust to force regeneration with timing intelligence
DELETE FROM weekly_strategies 
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79' 
  AND week_number = 26;
