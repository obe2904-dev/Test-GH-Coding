-- Create dashboard tips table
CREATE TABLE IF NOT EXISTS dashboard_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tip_da TEXT NOT NULL,
  tip_en TEXT NOT NULL,
  requires_verification BOOLEAN DEFAULT false,
  verification_notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table to track which tips have been shown to each user
CREATE TABLE IF NOT EXISTS user_shown_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tip_id UUID NOT NULL REFERENCES dashboard_tips(id) ON DELETE CASCADE,
  shown_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tip_id)
);

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_shown_tips_user_shown 
  ON user_shown_tips(user_id, shown_at DESC);

-- Insert tips
INSERT INTO dashboard_tips (tip_da, tip_en, requires_verification, verification_notes) VALUES
(
  'På Facebook bruger vi 1–2 hashtags, på Instagram 3–5. Mere end det skader faktisk rækkevidden — det har vi styr på.',
  'On Facebook we use 1-2 hashtags, on Instagram 3-5. More than that actually hurts reach — we have that covered.',
  true,
  'Verify hashtag limits in caption generation logic'
),
(
  'På Facebook virker lokale og stedspecifikke hashtags bedst — fx #Silkeborg eller #SilkeborgSpiser. Vi vælger dem automatisk ud fra jeres placering.',
  'On Facebook, local and location-specific hashtags work best — e.g. #Silkeborg or #SilkeborgEats. We choose them automatically based on your location.',
  true,
  'Verify location-based hashtag generation for Facebook'
),
(
  'På Instagram blander vi nichehashtags med jeres kategori — fx #KoreanskmadDanmark og #SushiAarhus. Det rammer dem, der faktisk leder efter jeres type mad.',
  'On Instagram we mix niche hashtags with your category — e.g. #KoreanFoodDenmark and #SushiAarhus. This reaches people actually looking for your type of food.',
  true,
  'Verify niche + location hashtag mixing for Instagram'
),
(
  'Vil I ikke have opslag om en bestemt ret? Tryk på 🚫 ud for retten under Det I tilbyder. I kan altid slå den til igen.',
  'Don''t want posts about a specific dish? Click 🚫 next to the dish under What You Offer. You can always turn it back on.',
  false,
  NULL
),
(
  'Vil I have flere opslag om en bestemt ret? Tryk på ☆ ud for retten under Det I tilbyder. I kan altid fortryde det igen.',
  'Want more posts about a specific dish? Click ☆ next to the dish under What You Offer. You can always undo it.',
  true,
  'Verify star/favorite functionality exists in menu items'
),
(
  'Når teksten er klar, kan I få en konkret idé til et mobilfoto under Design — tryk på 📷 Medieidé.',
  'When the text is ready, you can get a specific mobile photo idea under Design — click 📷 Media Idea.',
  false,
  NULL
),
(
  'AI kan kigge på jeres foto og give råd til, hvad der eventuelt kan gøres bedre — find det under Design.',
  'AI can look at your photo and give advice on what could be improved — find it under Design.',
  false,
  NULL
),
(
  'AI kan foretage mindre justeringer af jeres foto direkte i Design-fasen.',
  'AI can make minor adjustments to your photo directly in the Design phase.',
  false,
  NULL
),
(
  'Når AI forbedrer et foto, fjerner vi aldrig noget fra billedet — kun subtile justeringer.',
  'When AI improves a photo, we never remove anything from the image — only subtle adjustments.',
  false,
  NULL
),
(
  'I kan altid justere det tidspunkt, AI foreslår til et opslag — tryk blot på tidspunktet og ret det.',
  'You can always adjust the time AI suggests for a post — just click the time and change it.',
  false,
  NULL
),
(
  'Under Sociale Medier kan I til enhver tid ændre, hvilke platforme jeres opslag publiceres på.',
  'Under Social Media you can change which platforms your post is published to at any time.',
  false,
  NULL
),
(
  'I Indholdskalender har I fuldt overblik over alle planlagte opslag og deres publiceringsdatoer.',
  'In the Content Calendar you have full overview of all scheduled posts and their publication dates.',
  false,
  NULL
),
(
  'I Design kan I genbruge fotos fra tidligere opslag — find dem i Mediegalleri.',
  'In Design you can reuse photos from previous posts — find them in Media Gallery.',
  false,
  NULL
),
(
  'I Design kan I se præcis, hvordan opslaget kommer til at se ud, før det publiceres.',
  'In Design you can see exactly how the post will look before it''s published.',
  false,
  NULL
),
(
  'Forslagene under Opslag til i dag nulstilles automatisk ved midnat — I starter altid med relevante idéer.',
  'Suggestions under Today''s Posts reset automatically at midnight — you always start with relevant ideas.',
  false,
  NULL
),
(
  'Ugentlig plan tjekker vejrudsigten 14 dage frem og tager højde for det i indholdsplanen.',
  'Weekly plan checks the weather forecast 14 days ahead and takes it into account in the content plan.',
  false,
  NULL
),
(
  'Opslag til i dag tjekker vejrudsigten time for time de næste 12 timer — opslag passer altid til vejret.',
  'Today''s Posts checks the weather forecast hour by hour for the next 12 hours — posts always match the weather.',
  false,
  NULL
),
(
  'Ugentlig plan tager automatisk højde for danske helligdage og ferier, når den planlægger ugen.',
  'Weekly plan automatically takes Danish holidays and vacations into account when planning the week.',
  false,
  NULL
);

-- Enable RLS
ALTER TABLE dashboard_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_shown_tips ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read active tips
CREATE POLICY "Users can read active tips"
  ON dashboard_tips
  FOR SELECT
  TO authenticated
  USING (active = true);

-- Users can manage their own shown tips
CREATE POLICY "Users can manage their own shown tips"
  ON user_shown_tips
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
