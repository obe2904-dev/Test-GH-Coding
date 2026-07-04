-- Weather Cache Table
-- Stores OpenWeatherMap 7-day forecasts to reduce API calls
-- TTL: 1 hour (managed in application code)

CREATE TABLE IF NOT EXISTS weather_cache (
  city TEXT PRIMARY KEY,
  forecast JSONB NOT NULL,  -- Array of 7-day forecast from OpenWeatherMap
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Index for cleanup of expired entries
CREATE INDEX IF NOT EXISTS idx_weather_cache_expires ON weather_cache(expires_at);

-- Cleanup function (optional - can be called periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_weather_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM weather_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comment
COMMENT ON TABLE weather_cache IS 'Caches OpenWeatherMap 7-day forecasts to reduce API calls (TTL: 1 hour)';
COMMENT ON COLUMN weather_cache.city IS 'City name (lowercase, used as cache key)';
COMMENT ON COLUMN weather_cache.forecast IS 'Array of WeatherForecast objects from OpenWeatherMap API';
COMMENT ON COLUMN weather_cache.fetched_at IS 'Timestamp when forecast was fetched';
COMMENT ON COLUMN weather_cache.expires_at IS 'Timestamp when cache expires (fetched_at + 1 hour)';
