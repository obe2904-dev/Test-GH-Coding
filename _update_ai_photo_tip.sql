-- Update AI photo enhancement tip to clarify we don't ADD to images, only adjust
-- Changed from "fjerner vi aldrig noget fra" (never remove) to "tilføjer vi aldrig noget til" (never add)

UPDATE dashboard_tips
SET 
  tip_da = 'Når AI forbedrer et foto, tilføjer vi aldrig noget til billedet — kun subtile justeringer.',
  tip_en = 'When AI improves a photo, we never add anything to the image — only subtle adjustments.',
  updated_at = NOW()
WHERE tip_da = 'Når AI forbedrer et foto, fjerner vi aldrig noget fra billedet — kun subtile justeringer.';

-- Verification: Show the updated tip
SELECT id, tip_da, tip_en, updated_at
FROM dashboard_tips
WHERE tip_da LIKE '%Når AI forbedrer et foto%'
ORDER BY id;
