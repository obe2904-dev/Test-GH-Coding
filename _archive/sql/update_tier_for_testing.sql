-- Update your business to standardplus (Smart) for testing
-- Replace with your actual business ID or use the query below to find it

-- First, find your business ID:
SELECT id, name, owner_id, plan 
FROM businesses 
WHERE owner_id = 'd60e2675-7198-49cd-b167-e0a1661b6020'
LIMIT 1;

-- Then update the plan to standardplus:
UPDATE businesses 
SET plan = 'standardplus'
WHERE owner_id = 'd60e2675-7198-49cd-b167-e0a1661b6020';

-- Verify the change:
SELECT id, name, plan 
FROM businesses 
WHERE owner_id = 'd60e2675-7198-49cd-b167-e0a1661b6020';
