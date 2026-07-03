-- Check what columns exist in business_brand_profile
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'business_brand_profile'
  and column_name in ('posting_strategy', 'busy_pattern', 'content_strategy')
order by column_name;

-- Check total businesses in the table
select count(*) as total_businesses from business_brand_profile;

-- Check sample of business_brand_profile data
select business_id, 
       posting_strategy is not null as has_posting_strategy,
       busy_pattern is not null as has_busy_pattern,
       content_strategy is not null as has_content_strategy
from business_brand_profile
limit 10;
