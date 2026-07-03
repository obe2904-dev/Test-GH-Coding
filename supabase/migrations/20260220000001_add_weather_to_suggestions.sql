-- Add weather forecast storage to daily_suggestions
-- Store weather context that was used to generate the ideas

ALTER TABLE public.daily_suggestions
ADD COLUMN IF NOT EXISTS weather_forecast JSONB;

COMMENT ON COLUMN public.daily_suggestions.weather_forecast IS 'Weather forecast at time of generation: {city, until, temperature, conditions}';
