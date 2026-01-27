// Weather data fetching using OpenWeather API
import { WeatherData } from '../types.ts'

export async function fetchWeatherData(
  city: string,
  country?: string
): Promise<WeatherData | null> {
  try {
    const apiKey = Deno.env.get('OPENWEATHER_API_KEY')
    if (!apiKey) {
      console.warn('⚠️ OPENWEATHER_API_KEY not configured')
      return null
    }

    const location = country ? `${city},${country}` : city
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric&lang=en`

    console.log(`🌤️ Fetching weather for: ${location}`)
    
    const response = await fetch(url)
    if (!response.ok) {
      console.error(`Weather API error: ${response.status} ${response.statusText}`)
      return null
    }

    const data = await response.json()

    const weatherData: WeatherData = {
      temperature: Math.round(data.main.temp),
      condition: data.weather[0].main,
      description: data.weather[0].description,
      icon: data.weather[0].icon,
      timestamp: Date.now()
    }

    console.log(`✅ Weather fetched: ${weatherData.temperature}°C, ${weatherData.description}`)
    return weatherData

  } catch (error) {
    console.error('❌ Error fetching weather:', error)
    return null
  }
}

export function formatWeatherForPrompt(weather: WeatherData | null): string {
  if (!weather) return ''

  return `
=== CURRENT WEATHER ===
Temperature: ${weather.temperature}°C
Conditions: ${weather.description}
Context: ${getWeatherContext(weather)}
`
}

function getWeatherContext(weather: WeatherData): string {
  const temp = weather.temperature
  const condition = weather.condition.toLowerCase()

  const contexts: string[] = []

  // Temperature context
  if (temp < 5) contexts.push('cold weather')
  else if (temp < 15) contexts.push('cool weather')
  else if (temp < 25) contexts.push('pleasant weather')
  else contexts.push('warm weather')

  // Condition context
  if (condition.includes('rain')) contexts.push('rainy, cozy indoor atmosphere')
  else if (condition.includes('snow')) contexts.push('snowy, warm comfort food')
  else if (condition.includes('clear')) contexts.push('sunny, outdoor seating')
  else if (condition.includes('cloud')) contexts.push('overcast, comfortable indoor dining')

  return contexts.join(', ')
}
