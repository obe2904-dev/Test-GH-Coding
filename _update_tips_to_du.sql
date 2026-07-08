-- Update tips to use "du" instead of "I" for more personal tone
-- Apply to both databases: kvqdkohdpvmdylqgujpn (localhost) and oadwluspjlsnxhgakral (production)

-- Tip #2: jeres → din
UPDATE dashboard_tips
SET tip_da = 'På Facebook virker lokale hashtags bedst — fx #Silkeborg eller #SilkeborgMad. Systemet vælger dem automatisk ud fra din placering.'
WHERE tip_da LIKE '%jeres placering%';

-- Tip #3: jeres → din
UPDATE dashboard_tips
SET tip_da = 'På Instagram blander vi niche, kategori og lokation i op til 5 hashtags — fx #KoreanFood #Sushi #Aarhus #Foodie. Det rammer dem, der faktisk leder efter din type mad.'
WHERE tip_da LIKE '%jeres type mad%';

-- Tip #4: I → du, Det I tilbyder → Det du tilbyder
UPDATE dashboard_tips
SET tip_da = 'Vil du ikke have opslag om en bestemt ret? Tryk på 🚫 ud for retten under Det du tilbyder. Du kan altid slå den til igen.'
WHERE tip_da LIKE 'Vil I ikke have opslag om en bestemt ret%';

-- Tip #5: I → du, Det I tilbyder → Det du tilbyder
UPDATE dashboard_tips
SET tip_da = 'Vil du have flere opslag om en bestemt ret? Tryk på ☆ ud for retten under Det du tilbyder. Du kan altid fortryde det igen.'
WHERE tip_da LIKE 'Vil I have flere opslag om en bestemt ret%';

-- Tip #6: I → du
UPDATE dashboard_tips
SET tip_da = 'Når teksten er klar, kan du få en konkret idé til et mobilfoto under Design — tryk på 📷 Medieidé.'
WHERE tip_da LIKE 'Når teksten er klar, kan I få%';

-- Tip #7: jeres → dit
UPDATE dashboard_tips
SET tip_da = 'AI kan kigge på dit foto og give råd til, hvad der eventuelt kan gøres bedre — find det under Design.'
WHERE tip_da LIKE '%jeres foto og give råd%';

-- Tip #8: jeres → dit
UPDATE dashboard_tips
SET tip_da = 'AI kan foretage mindre justeringer af dit foto direkte i Design-fasen.'
WHERE tip_da LIKE '%jeres foto direkte i Design%';

-- Tip #10: I → du
UPDATE dashboard_tips
SET tip_da = 'Du kan altid justere det tidspunkt, AI foreslår til et opslag — tryk blot på tidspunktet og ret det.'
WHERE tip_da LIKE 'I kan altid justere det tidspunkt%';

-- Tip #11: I → du, jeres → dine
UPDATE dashboard_tips
SET tip_da = 'Under Sociale Medier kan du til enhver tid ændre, hvilke platforme dine opslag publiceres på.'
WHERE tip_da LIKE 'Under Sociale Medier kan I%';

-- Tip #12: I → du
UPDATE dashboard_tips
SET tip_da = 'I Indholdskalender har du fuldt overblik over alle planlagte opslag og deres publiceringsdatoer.'
WHERE tip_da LIKE 'I Indholdskalender har I fuldt%';

-- Tip #13: I → du
UPDATE dashboard_tips
SET tip_da = 'I Design kan du genbruge fotos fra tidligere opslag — find dem i Mediegalleri.'
WHERE tip_da LIKE 'I Design kan I genbruge%';

-- Tip #14: I → du
UPDATE dashboard_tips
SET tip_da = 'I Design kan du se præcis, hvordan opslaget kommer til at se ud, før det publiceres.'
WHERE tip_da LIKE 'I Design kan I se præcis%';

-- Tip #15: I → du
UPDATE dashboard_tips
SET tip_da = 'Forslagene under Opslag til i dag nulstilles automatisk ved midnat — du starter altid med relevante idéer.'
WHERE tip_da LIKE '%I starter altid med%';

-- Verification
SELECT 
  id,
  LEFT(tip_da, 80) as tip_preview,
  updated_at
FROM dashboard_tips
ORDER BY created_at;
