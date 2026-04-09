-- Delete all cached weekly plans for this user to force regeneration
DELETE FROM weekly_content_plans
WHERE user_id = '04b868f4-7a8d-402c-a60a-d089bf9013e1';

-- Verify deletion
SELECT COUNT(*) as remaining_plans
FROM weekly_content_plans
WHERE user_id = '04b868f4-7a8d-402c-a60a-d089bf9013e1';
