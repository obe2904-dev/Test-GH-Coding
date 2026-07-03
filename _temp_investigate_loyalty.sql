-- Investigation query 1: Total businesses with posting_strategy
select count(*) as total_with_posting_strategy
from business_brand_profile
where posting_strategy is not null;

-- Investigation query 2: Businesses with loyalty field in slot_windows
select business_id, posting_strategy
from business_brand_profile
where posting_strategy is not null
  and posting_strategy -> 'slot_windows' ? 'loyalty';
