-- Update dashboard tips to match actual hashtag system behavior
-- Fix #1: Facebook uses 0-2 hashtags (not 1-2)
-- Fix #2: Location hashtags are separate, not compounds (#Copenhagen #Food, not #CopenhagenFood)
-- Fix #3: Instagram uses separate tags, not compounds

-- Update Tip #1: Correct Facebook hashtag count from 1-2 to 0-2
UPDATE dashboard_tips
SET 
  tip_da = 'På Facebook bruger vi 0–2 hashtags, på Instagram 3–5. Mere end det skader faktisk rækkevidden — det har vi styr på.',
  tip_en = 'On Facebook we use 0-2 hashtags, on Instagram 3-5. More than that actually hurts reach — we have that covered.',
  updated_at = NOW()
WHERE tip_da = 'På Facebook bruger vi 1–2 hashtags, på Instagram 3–5. Mere end det skader faktisk rækkevidden — det har vi styr på.';

-- Update Tip #2: Show location hashtags as separate tags, not compounds
UPDATE dashboard_tips
SET 
  tip_da = 'På Facebook virker lokale hashtags bedst — fx #Silkeborg eller #SilkeborgMad. Systemet vælger dem automatisk ud fra jeres placering.',
  tip_en = 'On Facebook, local hashtags work best — e.g. #Silkeborg or #SilkeborgFood. The system chooses them automatically based on your location.',
  updated_at = NOW()
WHERE tip_da = 'På Facebook virker lokale og stedspecifikke hashtags bedst — fx #Silkeborg eller #SilkeborgSpiser. Vi vælger dem automatisk ud fra jeres placering.';

-- Update Tip #3: Show Instagram hashtags as separate tags in the mix
UPDATE dashboard_tips
SET 
  tip_da = 'På Instagram blander vi niche, kategori og lokation i op til 5 hashtags — fx #KoreanFood #Sushi #Aarhus #Foodie. Det rammer dem, der faktisk leder efter jeres type mad.',
  tip_en = 'On Instagram we mix niche, category and location in up to 5 hashtags — e.g. #KoreanFood #Sushi #Aarhus #Foodie. This reaches people actually looking for your type of food.',
  updated_at = NOW()
WHERE tip_da = 'På Instagram blander vi nichehashtags med jeres kategori — fx #KoreanskmadDanmark og #SushiAarhus. Det rammer dem, der faktisk leder efter jeres type mad.';

-- Verify the updates
SELECT id, 
       LEFT(tip_da, 100) as tip_preview_da,
       requires_verification,
       updated_at
FROM dashboard_tips
WHERE requires_verification = true
ORDER BY created_at;
