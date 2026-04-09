-- Check stuck menu extraction jobs
SELECT 
    id,
    business_id,
    status,
    extraction_method,
    source_url,
    created_at,
    attempts
FROM menu_results_v2 
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
AND status IN ('queued', 'processing')
ORDER BY created_at DESC;

-- Mark old queued jobs as failed so they can be retried
UPDATE menu_results_v2 
SET 
    status = 'error',
    error_message = 'Timeout - Cloud Run worker not configured. Will be retried with Edge function.',
    completed_at = NOW()
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
AND status = 'queued'
AND created_at < NOW() - INTERVAL '5 minutes';

-- Show updated status
SELECT 
    status,
    COUNT(*) as count,
    extraction_method
FROM menu_results_v2 
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
GROUP BY status, extraction_method
ORDER BY status;
