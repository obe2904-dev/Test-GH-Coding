/**
 * Weather Service
 * 
 * Fetches and caches weather forecasts for post generation.
 * Uses OpenWeatherMap API (free tier: 1000 calls/day, 7-day forecast).
 */

// Deno global type declaration
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

export interface HourlyWeather {
  time: string // ISO timestamp
  temp: number
  feelsLike: number
  condition: 'clear' | 'cloudy' | 'partly_cloudy' | 'rain' | 'snow' | 'fog'
  description: string
  icon: string
}

export interface WeatherForecast {
  date: string // YYYY-MM-DD
  condition: 'clear' | 'cloudy' | 'partly_cloudy' | 'rain' | 'snow' | 'fog'
  temp: {
    day: number
    min: number
    max: number
    night: number
    eve: number
    morn: number
  }
  feelsLike: {
    day: number
    night: number
    eve: number
    morn: number
  }
  humidity: number
  windSpeed: number
  description: string
  hourly?: HourlyWeather[]
}

interface CachedWeather {
  forecast: WeatherForecast[]
  fetchedAt: number
  expiresAt: number
}

// In-memory cache (1 hour TTL)
const weatherCache = new Map<string, CachedWeather>()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

/**
 * Maps OpenWeatherMap condition codes to simplified conditions
 */
function mapWeatherCondition(weatherCode: number, icon: string): 'clear' | 'cloudy' | 'partly_cloudy' | 'rain' | 'snow' | 'fog' {
  // Thunderstorm (2xx)
  if (weatherCode >= 200 && weatherCode < 300) return 'rain'
  
  // Drizzle (3xx) or Rain (5xx)
  if ((weatherCode >= 300 && weatherCode < 400) || (weatherCode >= 500 && weatherCode < 600)) return 'rain'
  
  // Snow (6xx)
  if (weatherCode >= 600 && weatherCode < 700) return 'snow'
  
  // Atmosphere (7xx) - mist, fog, haze
  if (weatherCode >= 700 && weatherCode < 800) return 'fog'
  
  // Clear (800)
  if (weatherCode === 800) return 'clear'
  
  // Clouds (80x)
  if (weatherCode > 800 && weatherCode < 900) {
    // Check icon for day/night and cloud coverage
    if (icon.includes('02')) return 'partly_cloudy' // few clouds
    if (icon.includes('03') || icon.includes('04')) return 'cloudy' // scattered/broken clouds
    return 'cloudy'
  }
  
  return 'cloudy' // fallback
}

/**
 * Fetches 7-day weather forecast from OpenWeatherMap API
 */
async function fetchWeatherFromAPI(city: string, apiKey: string): Promise<WeatherForecast[]> {
  // OpenWeatherMap One Call API 3.0 (free tier)
  // First, get coordinates from city name
  const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${apiKey}`
  
  const geoResponse = await fetch(geoUrl)
  if (!geoResponse.ok) {
    throw new Error(`Geocoding API failed: ${geoResponse.status} ${geoResponse.statusText}`)
  }
  
  const geoData = await geoResponse.json()
  if (!Array.isArray(geoData) || geoData.length === 0) {
    throw new Error(`City not found: ${city}`)
  }
  
  const { lat, lon } = geoData[0]
  
  // Fetch 7-day forecast (One Call API 3.0)
  const forecastUrl = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely,alerts&units=metric&appid=${apiKey}`
  
  const forecastResponse = await fetch(forecastUrl)
  if (!forecastResponse.ok) {
    throw new Error(`Weather API failed: ${forecastResponse.status} ${forecastResponse.statusText}`)
  }
  
  const forecastData = await forecastResponse.json()
  
  // Parse daily forecasts (up to 7 days)
  const forecasts: WeatherForecast[] = []
  
  if (forecastData.daily && Array.isArray(forecastData.daily)) {
    for (const day of forecastData.daily.slice(0, 7)) {
      const date = new Date(day.dt * 1000)
      const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
      
      const weather = day.weather?.[0]
      const condition = mapWeatherCondition(weather?.id || 800, weather?.icon || '01d')
      
      forecasts.push({
        date: dateStr,
        condition,
        temp: {
          day: Math.round(day.temp?.day || 0),
          min: Math.round(day.temp?.min || 0),
          max: Math.round(day.temp?.max || 0),
          night: Math.round(day.temp?.night || 0),
          eve: Math.round(day.temp?.eve || 0),
          morn: Math.round(day.temp?.morn || 0)
        },
        feelsLike: {
          day: Math.round(day.feels_like?.day || 0),
          night: Math.round(day.feels_like?.night || 0),
          eve: Math.round(day.feels_like?.eve || 0),
          morn: Math.round(day.feels_like?.morn || 0)
        },
        humidity: day.humidity || 0,
        windSpeed: Math.round((day.wind_speed || 0) * 10) / 10,
        description: weather?.description || 'Unknown'
      })
    }
  }
  
  return forecasts
}

/**
 * Gets weather forecast with caching
 * 
 * @param city City name (e.g., "Aarhus", "Copenhagen")
 * @param days Number of days to forecast (1-7, default 7)
 * @returns Array of daily weather forecasts
 */
export async function getWeatherForecast(city: string, days: number = 7): Promise<WeatherForecast[]> {
  const cacheKey = city.toLowerCase()
  const now = Date.now()
  
  // Check in-memory cache
  const cached = weatherCache.get(cacheKey)
  if (cached && now < cached.expiresAt) {
    console.log(`[Weather] Cache hit for ${city}`)
    return cached.forecast.slice(0, days)
  }
  
  // Fetch from API
  console.log(`[Weather] Cache miss for ${city}, fetching from API...`)
  
  // Get API key from environment
  const apiKey = Deno.env.get('OPENWEATHER_API_KEY')
  if (!apiKey) {
    console.warn('[Weather] OPENWEATHER_API_KEY not configured, returning empty forecast')
    return []
  }
  
  try {
    const forecast = await fetchWeatherFromAPI(city, apiKey)
    
    // Cache for 1 hour
    weatherCache.set(cacheKey, {
      forecast,
      fetchedAt: now,
      expiresAt: now + CACHE_TTL_MS
    })
    
    console.log(`[Weather] Fetched and cached ${forecast.length} days for ${city}`)
    return forecast.slice(0, days)
  } catch (error) {
    const err = error as Error
    console.error(`[Weather] Failed to fetch weather for ${city}:`, err.message)
    
    // Return cached data even if expired (graceful degradation)
    if (cached) {
      console.log(`[Weather] Returning stale cache for ${city}`)
      return cached.forecast.slice(0, days)
    }
    
    return []
  }
}

/**
 * Formats weather forecast for AI prompt
 */
export function formatWeatherForPrompt(forecasts: WeatherForecast[]): string {
  if (!forecasts || forecasts.length === 0) {
    return 'Weather: Data not available'
  }
  
  const lines = ['Weather Forecast (next 7 days):']
  
  for (const day of forecasts) {
    const date = new Date(day.date)
    const dayName = date.toLocaleDateString('da-DK', { weekday: 'short' })
    const emoji = getWeatherEmoji(day.condition)
    
    lines.push(
      `- ${dayName} ${day.date}: ${emoji} ${day.description}, ${day.temp.day}°C (min ${day.temp.min}°C, max ${day.temp.max}°C)`
    )
  }
  
  return lines.join('\n')
}

/**
 * Gets emoji for weather condition
 */
function getWeatherEmoji(condition: string): string {
  switch (condition) {
    case 'clear': return '☀️'
    case 'partly_cloudy': return '⛅'
    case 'cloudy': return '☁️'
    case 'rain': return '🌧️'
    case 'snow': return '❄️'
    case 'fog': return '🌫️'
    default: return '🌤️'
  }
}

/**
 * Analyzes weather for content opportunities
 */
export function analyzeWeatherOpportunities(forecasts: WeatherForecast[]): string[] {
  const opportunities: string[] = []
  
  if (!forecasts || forecasts.length === 0) return opportunities
  
  // Check upcoming weekend weather
  const today = new Date()
  const daysUntilWeekend = (6 - today.getDay() + 7) % 7 || 7 // Days until Saturday
  
  if (daysUntilWeekend <= 3 && forecasts.length > daysUntilWeekend) {
    const weekendWeather = forecasts[daysUntilWeekend]
    
    if (weekendWeather.condition === 'clear' && weekendWeather.temp.day >= 18) {
      opportunities.push('☀️ Solskin i weekend → Fremhæv udeservering/terrasse')
    } else if (weekendWeather.condition === 'rain') {
      opportunities.push('🌧️ Regn i weekend → Fremhæv hyggelige indendørs oplevelser')
    }
  }
  
  // Check tomorrow's weather
  if (forecasts.length > 1) {
    const tomorrow = forecasts[1]
    
    if (tomorrow.condition === 'clear' && tomorrow.temp.day >= 20) {
      opportunities.push('☀️ Varmt vejr i morgen → Post i dag for booking/walk-ins')
    } else if (tomorrow.condition === 'rain') {
      opportunities.push('🌧️ Regn i morgen → Fokuser på cozy/comfort content')
    }
  }
  
  // Check for consistent good weather (3+ days)
  if (forecasts.length >= 3) {
    const goodWeatherStreak = forecasts.slice(0, 3).filter(
      f => f.condition === 'clear' || f.condition === 'partly_cloudy'
    ).length
    
    if (goodWeatherStreak === 3) {
      opportunities.push('🌤️ Godt vejr hele ugen → Planlæg outdoor content-serie')
    }
  }
  
  return opportunities
}
