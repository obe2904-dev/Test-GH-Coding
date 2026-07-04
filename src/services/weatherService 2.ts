/**
 * 🌤️ WEATHER SERVICE (OpenWeatherMap)
 * 
 * Fetches current weather and forecast for AI Ideas context.
 * Used to generate weather-appropriate content suggestions.
 */

export interface WeatherData {
  location: string
  temperature: number // Celsius
  feelsLike: number
  condition: string
  conditionDa: string // Danish description
  humidity: number
  windSpeed: number // m/s
  icon: string
  description: string
  isGoodWeather: boolean
}

export interface WeatherContext {
  current: WeatherData | null
  summary: string // Human-readable summary for AI prompt
  error?: string
}
// Weather condition translations
const WEATHER_CONDITIONS_DA: Record<string, string> = {
  'clear sky': 'Klar himmel',
  'few clouds': 'Få skyer',
  'scattered clouds': 'Spredte skyer',
  'broken clouds': 'Overskyet',
  'overcast clouds': 'Overskyet',
  'shower rain': 'Byger',
  'rain': 'Regn',
  'light rain': 'Let regn',
  'moderate rain': 'Moderat regn',
  'heavy intensity rain': 'Kraftig regn',
  'thunderstorm': 'Tordenvejr',
  'snow': 'Sne',
  'light snow': 'Let sne',
  'heavy snow': 'Kraftig sne',
  'mist': 'Tåge',
  'fog': 'Tåge',
  'haze': 'Dis',
  'drizzle': 'Støvregn',
}

/**
 * Get weather for a location using OpenWeatherMap API
 */
export async function getWeather(
  city: string,
  countryCode: string = 'DK',
  apiKey?: string
): Promise<WeatherContext> {
  const key = apiKey || import.meta.env.VITE_OPENWEATHERMAP_API_KEY
  
  if (!key) {
    return {
      current: null,
      summary: '',
      error: 'OpenWeatherMap API key not configured'
    }
  }
  
  try {
    // First, get coordinates for the city
    const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)},${countryCode}&limit=1&appid=${key}`
    const geoResponse = await fetch(geoUrl)
    
    if (!geoResponse.ok) {
      throw new Error(`Geo API error: ${geoResponse.status}`)
    }
    
    const geoData = await geoResponse.json()
    
    if (!geoData.length) {
      return {
        current: null,
        summary: '',
        error: `Location not found: ${city}`
      }
    }
    
    const { lat, lon, name } = geoData[0]
    
    // Get current weather using One Call API 3.0
    const weatherUrl = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&units=metric&exclude=minutely,hourly,alerts&appid=${key}`
    const weatherResponse = await fetch(weatherUrl)
    
    if (!weatherResponse.ok) {
      // Fall back to 2.5 API if 3.0 not available (requires subscription)
      const fallbackUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${key}`
      const fallbackResponse = await fetch(fallbackUrl)
      
      if (!fallbackResponse.ok) {
        throw new Error(`Weather API error: ${fallbackResponse.status}`)
      }
      
      const fallbackData = await fallbackResponse.json()
      return processWeatherData(fallbackData, name, 'v2.5')
    }
    
    const weatherData = await weatherResponse.json()
    return processWeatherData(weatherData, name, 'v3.0')
    
  } catch (error) {
    console.error('Weather fetch error:', error)
    return {
      current: null,
      summary: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Process weather data from either API version
 */
function processWeatherData(data: any, locationName: string, apiVersion: 'v2.5' | 'v3.0'): WeatherContext {
  let condition: string
  let temp: number
  let feelsLike: number
  let humidity: number
  let windSpeed: number
  let icon: string
  let description: string
  
  if (apiVersion === 'v3.0') {
    // One Call API 3.0 structure
    const current = data.current
    condition = current?.weather?.[0]?.description || 'unknown'
    temp = Math.round(current?.temp || 0)
    feelsLike = Math.round(current?.feels_like || 0)
    humidity = current?.humidity || 0
    windSpeed = current?.wind_speed || 0
    icon = current?.weather?.[0]?.icon || ''
    description = current?.weather?.[0]?.main || ''
  } else {
    // Legacy 2.5 API structure
    condition = data.weather?.[0]?.description || 'unknown'
    temp = Math.round(data.main?.temp || 0)
    feelsLike = Math.round(data.main?.feels_like || 0)
    humidity = data.main?.humidity || 0
    windSpeed = data.wind?.speed || 0
    icon = data.weather?.[0]?.icon || ''
    description = data.weather?.[0]?.main || ''
  }
  
  // Determine if it's "good" weather (subjective, but useful for AI)
  const isGoodWeather = 
    temp >= 15 && 
    temp <= 28 && 
    !condition.includes('rain') && 
    !condition.includes('snow') &&
    !condition.includes('thunder')
  
  const current: WeatherData = {
    location: locationName,
    temperature: temp,
    feelsLike,
    condition,
    conditionDa: WEATHER_CONDITIONS_DA[condition] || condition,
    humidity,
    windSpeed,
    icon,
    description,
    isGoodWeather
  }
  
  // Create human-readable summary for AI
  const summary = formatWeatherForPrompt(current)
  
  return { current, summary }
}

/**
 * Format weather data for AI prompt context
 */
export function formatWeatherForPrompt(weather: WeatherData): string {
  const lines = [
    `CURRENT WEATHER in ${weather.location}:`,
    `- Temperature: ${weather.temperature}°C (feels like ${weather.feelsLike}°C)`,
    `- Conditions: ${weather.conditionDa}`,
  ]
  
  // Add weather-based suggestions
  if (weather.temperature >= 25) {
    lines.push('- Suggestion: Perfect for cold drinks, ice cream, outdoor seating')
  } else if (weather.temperature >= 15 && weather.isGoodWeather) {
    lines.push('- Suggestion: Good weather for outdoor activities, outdoor dining')
  } else if (weather.temperature < 10) {
    lines.push('- Suggestion: Perfect for warm drinks, comfort food, cozy atmosphere')
  }
  
  if (weather.condition.includes('rain')) {
    lines.push('- Suggestion: Indoor activities, warm beverages, "hygge" atmosphere')
  }
  
  if (weather.condition.includes('snow')) {
    lines.push('- Suggestion: Winter wonderland content, warm seasonal treats')
  }
  
  return lines.join('\n')
}

/**
 * Get simple weather summary string
 */
export function getWeatherEmoji(condition: string): string {
  const c = condition.toLowerCase()
  if (c.includes('clear') || c.includes('sunny')) return '☀️'
  if (c.includes('cloud') && !c.includes('overcast')) return '⛅'
  if (c.includes('overcast') || c.includes('broken')) return '☁️'
  if (c.includes('rain') || c.includes('drizzle')) return '🌧️'
  if (c.includes('thunder')) return '⛈️'
  if (c.includes('snow')) return '❄️'
  if (c.includes('fog') || c.includes('mist')) return '🌫️'
  return '🌤️'
}
