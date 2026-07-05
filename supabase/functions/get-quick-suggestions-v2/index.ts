// index.ts
// Quick Suggestions V2 - Clean Implementation
// Philosophy: Hard Constraints + Rich Context + AI Reasoning

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { MenuItem, MenuSuggestion } from './types.ts'
import { CORS_HEADERS, AI_CONFIG, TIMING } from './constants.ts'
import { daysAgo, formatDate, isCacheStale } from './utils.ts'
import { detectEffectiveVertical } from '../_shared/business-type-helpers.ts'

// ── Weather Data Structure ─────────────────────────────────────────────────
interface WeatherData {
  temp: number
  description: string
  windSpeed: number
  conditions: string  // 'Clear', 'Clouds', 'Rain', etc.
  cloudCoverage?: number  // 0-100%
  precipProbability?: number  // 0-100%
}

// ── Helper: Map WMO Weather Code to Condition ───────────────────────────────
function mapWMOToCondition(wmo: number): { condition: string; description: string } {
  // WMO Weather interpretation codes
  // 0 = Clear sky
  // 1, 2, 3 = Mainly clear, partly cloudy, and overcast
  // 45, 48 = Fog
  // 51-67 = Drizzle/Rain
  // 71-77 = Snow
  // 80-82 = Rain showers
  // 85-86 = Snow showers
  // 95+ = Thunderstorm
  
  if (wmo === 0) return { condition: 'Clear', description: 'klar himmel' }
  if (wmo === 1) return { condition: 'Clear', description: 'overvejende klart' }
  if (wmo === 2) return { condition: 'Clouds', description: 'delvist skyet' }
  if (wmo === 3) return { condition: 'Clouds', description: 'overskyet' }
  if (wmo === 45 || wmo === 48) return { condition: 'Fog', description: 'tåge' }
  if (wmo >= 51 && wmo <= 55) return { condition: 'Drizzle', description: 'let regn' }
  if (wmo >= 56 && wmo <= 57) return { condition: 'Drizzle', description: 'frysende støvregn' }
  if (wmo >= 61 && wmo <= 65) return { condition: 'Rain', description: 'regn' }
  if (wmo >= 66 && wmo <= 67) return { condition: 'Rain', description: 'frysende regn' }
  if (wmo >= 71 && wmo <= 75) return { condition: 'Snow', description: 'sne' }
  if (wmo === 77) return { condition: 'Snow', description: 'snefnug' }
  if (wmo >= 80 && wmo <= 82) return { condition: 'Rain', description: 'regnbyger' }
  if (wmo >= 85 && wmo <= 86) return { condition: 'Snow', description: 'snebyger' }
  if (wmo >= 95) return { condition: 'Thunderstorm', description: 'tordenvejr' }
  
  return { condition: 'Clouds', description: 'skyet' }
}

// ── Helper: Evaluate Outdoor Suitability ────────────────────────────────────
function evaluateOutdoorSuitability(weather: WeatherData): string | null {
  const { temp, conditions, windSpeed, cloudCoverage } = weather
  
  // Wind threshold (m/s): 0-2 = calm, 2-4 = light breeze, >4 = breezy
  const isCalm = windSpeed <= 2
  const isLightWind = windSpeed <= 4
  
  // Condition check
  const isSunny = conditions === 'Clear'
  const isFewClouds = conditions === 'Clouds' && cloudCoverage && cloudCoverage <= 25
  const isPartlyCloudy = conditions === 'Clouds' && cloudCoverage && cloudCoverage <= 50
  
  // Tier 1: 21°C+, sun to partly cloudy, little wind
  if (temp >= 21 && (isSunny || isFewClouds || isPartlyCloudy) && isLightWind) {
    return 'PERFECT for outdoor seating'
  }
  
  // Tier 2: 19°C+, sun or few clouds, no/little wind
  if (temp >= 19 && (isSunny || isFewClouds) && isLightWind) {
    return 'GREAT for outdoor seating'
  }
  
  // Tier 3: 15°C+, sun, no wind
  if (temp >= 15 && isSunny && isCalm) {
    return 'SUITABLE for outdoor seating'
  }
  
  // Below thresholds - no outdoor emphasis
  return null
}

// ── Helper: Fetch Today's Weather from Open-Meteo ───────────────────────────
async function fetchTodayWeather(
  lat: number,
  lon: number,
  currentHour: number,
  hasOutdoorSeating: boolean
): Promise<{ raw: string; data?: WeatherData; outdoorStatus?: string } | undefined> {
  try {
    // Use Open-Meteo hourly forecast (free, no API key needed)
    const url = `https://api.open-meteo.com/v1/forecast?` +
      `latitude=${lat}&longitude=${lon}` +
      `&hourly=temperature_2m,precipitation_probability,weathercode,cloudcover,windspeed_10m` +
      `&timezone=auto` +
      `&forecast_days=1`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      console.warn('⚠️ Open-Meteo API failed:', response.status)
      return undefined
    }
    
    const data = await response.json()
    const hourly = data.hourly
    
    if (!hourly || !hourly.time) {
      console.warn('⚠️ No hourly data from Open-Meteo')
      return undefined
    }
    
    // Find current hour index
    const now = new Date()
    const currentIndex = hourly.time.findIndex((time: string) => {
      const hour = new Date(time).getHours()
      return hour === currentHour
    })
    
    if (currentIndex === -1) {
      console.warn('⚠️ Could not find current hour in forecast')
      return undefined
    }
    
    // Get current weather
    const currentTemp = Math.round(hourly.temperature_2m[currentIndex])
    const currentWMO = hourly.weathercode[currentIndex]
    const currentWind = Math.round(hourly.windspeed_10m[currentIndex])
    const currentClouds = hourly.cloudcover[currentIndex]
    const currentPrecipProb = hourly.precipitation_probability[currentIndex] || 0
    
    const { condition, description } = mapWMOToCondition(currentWMO)
    
    // Build weather data object
    const weatherData: WeatherData = {
      temp: currentTemp,
      description,
      windSpeed: currentWind,
      conditions: condition,
      cloudCoverage: currentClouds,
      precipProbability: currentPrecipProb
    }
    
    // Get remaining hours today (up to 6 hours ahead)
    const remainingHours = hourly.time
      .slice(currentIndex + 1, Math.min(currentIndex + 7, hourly.time.length))
      .map((time: string, idx: number) => ({
        hour: new Date(time).getHours(),
        temp: Math.round(hourly.temperature_2m[currentIndex + 1 + idx]),
        wmo: hourly.weathercode[currentIndex + 1 + idx],
        precipProb: hourly.precipitation_probability[currentIndex + 1 + idx] || 0,
        clouds: hourly.cloudcover[currentIndex + 1 + idx]
      }))
    
    // Find significant weather changes
    const afternoon = remainingHours.find(h => h.hour >= 12 && h.hour < 18)
    const evening = remainingHours.find(h => h.hour >= 18)
    
    // Build smart weather description
    // Only mention rain if precipitation probability > 50%
    let weatherDesc = description
    if (currentPrecipProb > 50) {
      weatherDesc = `${description} (${currentPrecipProb}% regn)`
    } else if (currentPrecipProb > 30) {
      weatherDesc = `${description} (risiko for regn)`
    }
    
    let weatherStr = `Nu: ${currentTemp}°C, ${weatherDesc}`
    
    // Add afternoon if different
    if (afternoon && Math.abs(afternoon.temp - currentTemp) > 2) {
      const afternoonWeather = mapWMOToCondition(afternoon.wmo)
      let afternoonDesc = afternoonWeather.description
      if (afternoon.precipProb > 50) {
        afternoonDesc = `${afternoonDesc} (${afternoon.precipProb}% regn)`
      }
      weatherStr += `\nEftermiddag: ${afternoon.temp}°C, ${afternoonDesc}`
    }
    
    // Add evening if different
    if (evening && Math.abs(evening.temp - currentTemp) > 2) {
      const eveningWeather = mapWMOToCondition(evening.wmo)
      let eveningDesc = eveningWeather.description
      if (evening.precipProb > 50) {
        eveningDesc = `${eveningDesc} (${evening.precipProb}% regn)`
      }
      weatherStr += `\nAften: ${evening.temp}°C, ${eveningDesc}`
    }
    
    // Evaluate outdoor suitability (only if precipitation probability < 50%)
    const outdoorStatus = hasOutdoorSeating && currentPrecipProb < 50
      ? evaluateOutdoorSuitability(weatherData)
      : undefined
    
    console.log('✅ Weather fetched (Open-Meteo):', weatherStr.replace(/\n/g, ' | '))
    if (outdoorStatus) {
      console.log('🌤️ Outdoor status:', outdoorStatus)
    }
    
    return {
      raw: weatherStr,
      data: weatherData,
      outdoorStatus: outdoorStatus || undefined
    }
    
  } catch (error) {
    console.warn('⚠️ Weather fetch error:', error)
    return undefined
  }
}

// ── Helper: Parse Service Periods ───────────────────────────────────────────
interface ServicePeriod {
  name: string
  type: string
  timeWindows: string[]
}

function getActiveProgrammes(
  programmes: Array<{
    programme_type: string
    programme_name: string
    time_windows: string[]
    operating_days: string[]
  }>,
  currentDate: Date
): ServicePeriod[] {
  const dayMap: Record<number, string> = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday'
  }
  
  const todayName = dayMap[currentDate.getDay()]
  
  return programmes
    .filter(p => p.operating_days?.includes(todayName))
    .map(p => ({
      name: p.programme_name || p.programme_type,
      type: p.programme_type,
      timeWindows: p.time_windows || []
    }))
}

function isActiveOrUpcoming(
  timeWindow: string,
  currentHour: number,
  currentMinute: number
): boolean {
  const match = timeWindow.match(/(\d{2}):(\d{2})(?::\d{2})?-(\d{2}):(\d{2})(?::\d{2})?/)
  if (!match) return false
  
  const startHour = parseInt(match[1])
  const startMinute = parseInt(match[2])
  const endHour = parseInt(match[3])
  const endMinute = parseInt(match[4])
  
  const currentMinutes = currentHour * 60 + currentMinute
  const startMinutes = startHour * 60 + startMinute
  const endMinutes = endHour * 60 + endMinute
  
  // Programme is active or upcoming if current time is before its end time
  return currentMinutes < endMinutes
}

function calculateCloseTime(
  programmes: ServicePeriod[],
  currentHour: number,
  currentMinute: number
): { hour: number, minute: number } {
  let latestHour = 22
  let latestMinute = 0
  
  for (const prog of programmes) {
    for (const window of prog.timeWindows) {
      // Only consider active or upcoming programmes
      if (!isActiveOrUpcoming(window, currentHour, currentMinute)) {
        continue
      }
      
      // Parse "09:00:00-11:00" or "09:00-11:00"
      const match = window.match(/(\d{2}):(\d{2})(?::\d{2})?-(\d{2}):(\d{2})(?::\d{2})?/)
      if (match) {
        const endHour = parseInt(match[3])
        const endMinute = parseInt(match[4])
        
        if (endHour > latestHour || (endHour === latestHour && endMinute > latestMinute)) {
          latestHour = endHour
          latestMinute = endMinute
        }
      }
    }
  }
  
  return { hour: latestHour, minute: latestMinute }
}

function formatServicePeriods(programmes: ServicePeriod[]): string {
  if (programmes.length === 0) return 'No service periods defined'
  
  return programmes
    .map(p => {
      const times = p.timeWindows.map(w => {
        const match = w.match(/(\d{2}:\d{2})(?::\d{2})?-(\d{2}:\d{2})(?::\d{2})?/)
        return match ? `${match[1]}-${match[2]}` : w
      }).join(', ')
      return `${p.name} (${times})`
    })
    .join(' • ')
}

// ── Helper: Determine Max Ideas Based on Time Remaining ──────────────────────
function calculateMaxIdeas(hoursUntilClose: number): number {
  if (hoursUntilClose >= 6) return 3
  if (hoursUntilClose >= 3) return 2
  if (hoursUntilClose >= 1) return 1
  return 0 // Refuse - too late
}

// ── Helper: Build AI Prompt ─────────────────────────────────────────────────
function buildPrompt(context: {
  businessName: string
  businessType: string
  currentTime: string
  dayOfWeek: string
  servicePeriods: string
  hoursRemaining: number
  maxIdeas: number
  menu: MenuItem[]
  recentlyUsed: Array<{name: string, daysAgo: number}>
  isTier3: boolean
  weatherContext?: string
  outdoorSeating?: string
  hasOutdoorSeating?: boolean
  country?: string
}): string {
  const {
    businessName,
    businessType,
    currentTime,
    dayOfWeek,
    servicePeriods,
    hoursRemaining,
    maxIdeas,
    menu,
    recentlyUsed,
    isTier3,
    weatherContext,
    outdoorSeating,
    hasOutdoorSeating,
    country
  } = context

  // Determine response language based on country
  const isDanish = country?.toLowerCase().includes('denmark') || country?.toLowerCase().includes('danmark')
  const languageInstruction = isDanish 
    ? '\n\nIMPORTANT: Write all explanations in DANISH. Menu item names must remain EXACT as listed.'
    : ''

  const weatherBlock = weatherContext 
    ? hasOutdoorSeating && outdoorSeating
      ? `\n\nWEATHER TODAY:\n${weatherContext}\n${outdoorSeating}\n→ Emphasize outdoor seating in your suggestions`
      : `\n\nWEATHER TODAY:\n${weatherContext}\n→ Mention weather only if it genuinely influences customer decisions`
    : ''

  const recentBlock = recentlyUsed.length > 0
    ? isTier3
      ? `\n\nNOTE: All dishes used recently. Pick from the TOP of this list (oldest first):\n${recentlyUsed.slice(0, 15).map(d => `- ${d.name} (${d.daysAgo === 0 ? 'today' : d.daysAgo === 1 ? 'yesterday' : `${d.daysAgo} days ago`})`).join('\n')}`
      : `\n\nAVOID (posted recently):\n${recentlyUsed.slice(0, 10).map(d => `- ${d.name} (${d.daysAgo === 0 ? 'today' : d.daysAgo === 1 ? 'yesterday' : `${d.daysAgo} days ago`})`).join('\n')}`
    : ''

  return `You are helping ${businessName} choose Instagram post ideas for TODAY.

CONTEXT:
- Current time: ${dayOfWeek} ${currentTime} (local)
- Business: ${businessType}
- Today's service: ${servicePeriods}
- Hours until close: ${hoursRemaining.toFixed(1)}${weatherBlock}

CONSTRAINTS:
- Time limit: All posts must be scheduled for today
- Quantity: Suggest UP TO ${maxIdeas} idea${maxIdeas > 1 ? 's' : ''} (fewer if only strong ideas exist)
- Menu: Only choose from dishes listed below

MENU:
${menu.map(i => `- ${i.name}${i.category ? ` [${i.category}]` : ''}${i.description ? `: ${i.description}` : ''}`).join('\n')}${recentBlock}

TASK:
Pick ${maxIdeas === 1 ? '1' : `1-${maxIdeas}`} menu item${maxIdeas > 1 ? 's' : ''} with strategic timing for the rest of TODAY.

For each suggestion provide:
1. menu_item_name: ONLY the item name from the list above - NOTHING ELSE. Do not add descriptions, do not add colons, just the exact name.
2. post_time: When to post (HH:MM format, must be in future)
3. why: Why this item + timing + context makes sense${isDanish ? ' (in Danish)' : ''}
4. context_reasoning: A brief contextual explanation starting with the day/time/weather context, followed by why this suggestion makes sense NOW${isDanish ? ' (in Danish)' : ''}. Example format: "I dag er ${dayOfWeek} ${currentTime}${weatherContext ? ' og ' + weatherContext.split('\n')[1].toLowerCase() : ''} - derfor er mit bedste forslag..."
5. alternative_timings: Optional array of 1-2 alternative times to post this later today with brief rationale for each${isDanish ? ' (in Danish)' : ''}

CRITICAL: The menu_item_name field must contain ONLY the name (e.g., "OMELET" not "OMELET: classic Danish omelet...").

Use your judgment:
- Consider business type and service flow
- Consider time remaining and priorities
- Use weather/outdoor context if it enhances the idea
- Focus on what drives real value
- Make context_reasoning conversational and helpful, explaining the strategic thinking
- Alternative timings should be genuinely better options for later, not just random times

Quality over quantity. ${maxIdeas} is a MAXIMUM, not a requirement.${languageInstruction}

Return JSON with this exact structure:
{
  "suggestions": [
    {
      "menu_item_name": "BRUNCH DELUXE",
      "post_time": "11:30",
      "why": "explanation here",
      "context_reasoning": "I dag er ${dayOfWeek} formiddag og vejret er perfekt til udeservering - derfor er mit bedste forslag at fremhæve jeres brunch nu, når folk planlægger weekendfrokost",
      "alternative_timings": [
        {
          "time": "14:00",
          "reasoning": "Eftermiddagsgæster søger ofte en sen frokost"
        }
      ]
    }
  ]
}

Example menu_item_name values: "OMELET", "FAUST GRYDE", "BRUNCH DELUXE" (just the name, nothing else)`
}

// ── Helper: Call Gemini AI ──────────────────────────────────────────────────
async function generateSuggestions(prompt: string): Promise<any[]> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: AI_CONFIG.TEMPERATURE,
          maxOutputTokens: AI_CONFIG.MAX_OUTPUT_TOKENS,
          responseMimeType: AI_CONFIG.RESPONSE_MIME_TYPE,
        }
      })
    }
  )
  
  if (!response.ok) {
    const error = await response.text()
    console.error('❌ Gemini API error:', error)
    throw new Error(`Gemini API failed: ${response.status}`)
  }
  
  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  
  if (!text) throw new Error('Empty response from Gemini')
  
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
  const parsed = JSON.parse(cleaned)
  
  if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
    throw new Error('Invalid response format from Gemini')
  }
  
  console.log(`✅ Gemini generated ${parsed.suggestions.length} suggestions`)
  return parsed.suggestions
}

// ── Main Handler ────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  
  try {
    const { businessId, regenerate = false, clientTime, localDate } = await req.json()
    
    console.log('🎯 Quick Suggestions V2:', { businessId, regenerate })
    
    if (!businessId) {
      return new Response(JSON.stringify({ error: 'businessId required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }
    
    // Get client time (eliminates timezone issues)
    const clientNow = clientTime ? new Date(clientTime) : new Date()
    const today = localDate || formatDate(clientNow)
    
    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Check cache (unless regenerating)
    if (!regenerate) {
      const { data: cached } = await supabase
        .from('daily_suggestions')
        .select('*')
        .eq('business_id', businessId)
        .eq('date', today)
        .eq('status', 'available')
        .eq('source', 'quick_suggestions')
        .order('position')
        .limit(3)
      
      if (cached && cached.length > 0) {
        const firstCreated = cached[0].created_at
        if (!isCacheStale(firstCreated, clientNow, TIMING.CACHE_STALE_HOURS)) {
          console.log(`✅ Returning cached suggestions (${cached.length})`)
          return new Response(JSON.stringify({
            suggestions: cached,
            cached: true
          }), {
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
          })
        }
      }
    }
    
    // Fetch context
    console.log('📥 Fetching context...')
    const [businessData, locationData, operationsData, menuItemsData, menuResultsData, profileData, programmesData, postsData, suggestionsData, brandProfileData] = await Promise.all([
      supabase.from('businesses')
        .select('name, business_type_hybrid, country')
        .eq('id', businessId)
        .single(),
      
      supabase.from('business_locations')
        .select('city, postal_code, latitude, longitude')
        .eq('business_id', businessId)
        .eq('is_primary', true)
        .maybeSingle(),
      
      supabase.from('business_operations')
        .select('has_outdoor_seating')
        .eq('business_id', businessId)
        .maybeSingle(),
      
      supabase.from('menu_items_normalized')
        .select('item_name, item_description, category_name, menu_language, service_periods, service_period_name')
        .eq('business_id', businessId)
        .eq('is_active', true),
      
      supabase.from('menu_results_v2')
        .select('structured_data, service_period_name')
        .eq('business_id', businessId)
        .order('completed_at', { ascending: false, nullsLast: true })
        .limit(10),
      
      supabase.from('business_profile')
        .select('menu_signal')
        .eq('business_id', businessId)
        .single(),

      supabase.from('business_brand_profile')
        .select('business_character, business_identity_persona, identity_keywords, brand_profile_v5')
        .eq('business_id', businessId)
        .maybeSingle(),
      
      supabase.from('business_programme_profiles')
        .select('programme_type, programme_name, time_windows, operating_days')
        .eq('business_id', businessId),
      
      supabase.from('posts')
        .select('menu_item_name, posted_at')
        .eq('business_id', businessId)
        .not('menu_item_name', 'is', null)
        .gte('posted_at', new Date(Date.now() - TIMING.RECENT_POSTS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString())
        .order('posted_at', { ascending: false }),
      
      supabase.from('daily_suggestions')
        .select('menu_item_name, created_at')
        .eq('business_id', businessId)
        .eq('content_type', 'menu_item')
        .not('menu_item_name', 'is', null)
        .gte('created_at', new Date(Date.now() - TIMING.RECENT_POSTS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(42)
    ])
    
    const business = businessData.data
    const location = locationData.data
    const operations = operationsData.data
    const menuItems = menuItemsData.data || []
    const menuResults = menuResultsData.data || []
    const menuSignal = profileData.data?.menu_signal
    const programmes = programmesData.data || []
    const recentPosts = postsData.data || []
    const recentSuggestions = suggestionsData.data || []
    const brandProfile = brandProfileData.data || null

    const businessIdentityPersona =
      brandProfile?.brand_profile_v5?.layer_0_intelligence?.business_identity?.system_persona ||
      brandProfile?.business_identity_persona ||
      brandProfile?.business_character ||
      ''
    const identityKeywords = Array.isArray(brandProfile?.identity_keywords)
      ? brandProfile.identity_keywords
      : []
    const effectiveBusinessType = detectEffectiveVertical(
      business?.business_type_hybrid?.primary || '',
      businessIdentityPersona,
      identityKeywords,
    )
    
    console.log(`📦 Data fetched: ${menuItems.length} menu_items_normalized, ${menuResults.length} menu_results_v2, ${menuSignal?.signatureItems?.length || 0} signatureItems`)
    console.log(`🧭 Effective business type: ${business?.business_type_hybrid?.primary || 'not detected'} → ${effectiveBusinessType}`)
    
    if (!business) {
      return new Response(JSON.stringify({ error: 'Business not found' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }
    
    // Build recency map
    const recencyMap = new Map<string, number>()
    for (const post of recentPosts) {
      if (!post.menu_item_name) continue
      const key = post.menu_item_name.toLowerCase().trim()
      const days = daysAgo(post.posted_at, clientNow)
      if (!recencyMap.has(key) || days < recencyMap.get(key)!) {
        recencyMap.set(key, days)
      }
    }
    for (const suggestion of recentSuggestions) {
      if (!suggestion.menu_item_name) continue
      const key = suggestion.menu_item_name.toLowerCase().trim()
      const days = daysAgo(suggestion.created_at, clientNow)
      if (!recencyMap.has(key) || days < recencyMap.get(key)!) {
        recencyMap.set(key, days)
      }
    }
    
    console.log(`📊 Recency map: ${recencyMap.size} dishes from ${recentPosts.length} posts + ${recentSuggestions.length} suggestions`)
    
    console.log(`\n📋 DEBUG: programmes=${programmes.length}, menuItems=${menuItems.length}`)
    if (menuItems.length > 0) {
      console.log(`First menu item sample:`, JSON.stringify(menuItems[0]))
    }
    
    // Parse menu - prefer menu_items_normalized, fallback to menu_results_v2, then menu_signal
    let allMenuItems: MenuItem[]
    
    if (menuItems.length > 0) {
      // Use menu_items_normalized with service period filtering
      const activeProgrammesForMenu = getActiveProgrammes(programmes, clientNow)
      
      // Filter to only currently active or upcoming programmes
      const currentHour = clientNow.getHours()
      const currentMinute = clientNow.getMinutes()
      const relevantProgrammes = activeProgrammesForMenu.filter(prog => 
        prog.timeWindows.some(window => isActiveOrUpcoming(window, currentHour, currentMinute))
      )
      
      const activeProgrammeTypes = new Set(
        relevantProgrammes.map(p => p.type.toLowerCase())
      )
      const activeProgrammeNames = new Set(
        relevantProgrammes.map(p => p.name.toLowerCase())
      )
      
      console.log(`📋 Relevant programmes (${relevantProgrammes.length}):`, relevantProgrammes.map(p => `${p.name} (${p.type})`).join(', '))
      console.log(`📋 Looking for service periods matching:`, Array.from(activeProgrammeTypes).concat(Array.from(activeProgrammeNames)).join(', '))
      console.log(`📋 Raw menu items from DB: ${menuItems.length}`)
      
      allMenuItems = menuItems
        .filter(item => {
          // Parse service_periods if it's a string
          let periods = item.service_periods
          if (typeof periods === 'string') {
            try {
              periods = JSON.parse(periods)
            } catch (e) {
              console.warn(`Failed to parse service_periods for ${item.item_name}:`, periods)
              return true // Include it anyway
            }
          }
          
          if (!periods || periods.length === 0) {
            // If no service periods defined, include it (backward compatibility)
            return true
          }
          
          // Check if any of the item's service periods match active programmes
          const matches = periods.some((period: string) => {
            const periodLower = period.toLowerCase()
            return activeProgrammeTypes.has(periodLower) || activeProgrammeNames.has(periodLower)
          })
          
          return matches
        })
        .map(item => ({
          name: item.item_name,
          description: item.item_description || '',
          category: item.category_name || undefined,
          language: item.menu_language || undefined,
          program: item.service_period_name || 'main'
        }))
      
      console.log(`🍽️  Menu: ${menuItems.length} total → ${allMenuItems.length} available for active programmes`)
    } else if (menuResults.length > 0) {
      // Fallback to menu_results_v2 structured_data
      console.log('⚠️  No menu_items_normalized found, trying menu_results_v2')
      const extractedItems: MenuItem[] = []
      
      for (const result of menuResults) {
        if (!result.structured_data) continue
        
        const structuredData = result.structured_data as any
        const servicePeriod = result.service_period_name || 'main'
        
        // Extract items from structured_data (handle different formats)
        if (Array.isArray(structuredData)) {
          // Format: [{name, description, category?}]
          for (const item of structuredData) {
            if (item.name) {
              extractedItems.push({
                name: item.name,
                description: item.description || '',
                category: item.category || undefined,
                program: servicePeriod
              })
            }
          }
        } else if (structuredData.items && Array.isArray(structuredData.items)) {
          // Format: {items: [{name, description, category?}]}
          for (const item of structuredData.items) {
            if (item.name) {
              extractedItems.push({
                name: item.name,
                description: item.description || '',
                category: item.category || undefined,
                program: servicePeriod
              })
            }
          }
        }
      }
      
      allMenuItems = extractedItems
      console.log(`🍽️  Menu: ${extractedItems.length} items from menu_results_v2`)
    } else {
      // Final fallback to menu_signal
      console.log('⚠️  No menu_items_normalized or menu_results_v2 found, falling back to menu_signal')
      allMenuItems = menuSignal?.signatureItems?.map((name: string) => ({
        name,
        description: '',
        program: 'main'
      })) || []
    }
    
    if (allMenuItems.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No menu items available',
        message: menuItems.length > 0 
          ? 'No dishes available for current service periods. Service may not have started yet.'
          : 'No menu items found'
      }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }
    
    // TIER FILTERING
    const totalItems = allMenuItems.length
    const surviving = (threshold: number) =>
      allMenuItems.filter(item => {
        const days = recencyMap.get(item.name.toLowerCase().trim())
        return days === undefined || days >= threshold
      })
    
    let filteredMenu: MenuItem[]
    let recentlyUsed: Array<{name: string, daysAgo: number}> = []
    let isTier3 = false
    let tierUsed: string
    
    const tier1 = surviving(7)
    if (tier1.length >= 2) {
      filteredMenu = tier1
      tierUsed = 'Tier 1 (7d)'
      console.log(`🎯 Tier 1: ${totalItems} → ${tier1.length} dishes`)
    } else {
      const tier2 = surviving(3)
      if (tier2.length >= 2) {
        filteredMenu = tier2
        tierUsed = 'Tier 2 (3d)'
        console.log(`🎯 Tier 2: ${totalItems} → ${tier2.length} dishes`)
      } else {
        filteredMenu = allMenuItems
        isTier3 = true
        tierUsed = 'Tier 3 (all)'
        console.log(`⚠️  Tier 3: All ${totalItems} dishes used recently`)
        
        recentlyUsed = allMenuItems
          .map(item => ({
            name: item.name,
            daysAgo: recencyMap.get(item.name.toLowerCase().trim()) ?? 999
          }))
          .sort((a, b) => b.daysAgo - a.daysAgo)
      }
    }
    
    // Calculate time remaining from actual service periods
    const activeProgrammes = getActiveProgrammes(programmes, clientNow)
    
    if (activeProgrammes.length === 0) {
      console.log('⚠️  No active programmes for today')
    } else {
      console.log(`📅 Active programmes: ${activeProgrammes.map(p => p.name).join(', ')}`)
    }
    
    const currentHour = clientNow.getHours()
    const currentMinute = clientNow.getMinutes()
    const closeTime = calculateCloseTime(activeProgrammes, currentHour, currentMinute)
    const servicePeriodString = formatServicePeriods(activeProgrammes)
    
    const hoursRemaining = (closeTime.hour + closeTime.minute / 60) - (currentHour + currentMinute / 60)
    
    console.log(`⏰ Current: ${currentHour}:${String(currentMinute).padStart(2, '0')}, Close: ${closeTime.hour}:${String(closeTime.minute).padStart(2, '0')}, Hours remaining: ${hoursRemaining.toFixed(1)}`)
    
    // Determine max ideas
    const maxIdeas = calculateMaxIdeas(hoursRemaining)
    
    if (maxIdeas === 0) {
      return new Response(JSON.stringify({
        error: 'outside_service_hours',
        message: 'Services closed for today. Try "Skriv Selv" for custom posts or come back tomorrow.',
        hours_remaining: hoursRemaining
      }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }
    
    // Fetch weather (today only)
    let weatherContext: string | undefined
    let outdoorSeating: string | undefined
    const hasOutdoorSeating = operations?.has_outdoor_seating === true
    
    console.log('🌤️ Weather check - Lat:', location?.latitude, 'Lon:', location?.longitude, 'Has outdoor:', hasOutdoorSeating)
    if (location?.latitude && location?.longitude) {
      const weatherResult = await fetchTodayWeather(
        location.latitude,
        location.longitude,
        clientNow.getHours(),
        hasOutdoorSeating
      )
      
      if (weatherResult) {
        weatherContext = weatherResult.raw
        if (weatherResult.outdoorStatus) {
          outdoorSeating = weatherResult.outdoorStatus
          console.log('🌤️ Weather result: fetched with outdoor status:', weatherResult.outdoorStatus)
        } else {
          console.log('🌤️ Weather result: fetched (no outdoor emphasis)')
        }
      }
    } else {
      console.log('⚠️ No coordinates available - skipping weather')
    }
    
    // Build prompt
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const prompt = buildPrompt({
      businessName: business.name || 'this restaurant',
      businessType: effectiveBusinessType,
      currentTime: `${clientNow.getHours()}:${String(clientNow.getMinutes()).padStart(2, '0')}`,
      dayOfWeek: dayNames[clientNow.getDay()],
      servicePeriods: servicePeriodString,
      hoursRemaining,
      maxIdeas,
      menu: filteredMenu,
      recentlyUsed,
      isTier3,
      weatherContext,
      outdoorSeating,
      hasOutdoorSeating,
      country: business.country
    })
    
    // Generate
    console.log('🤖 Generating suggestions...')
    console.log(`📋 Menu being sent to AI (${filteredMenu.length} items):`, filteredMenu.map(i => i.name).join(', '))
    const aiSuggestions = await generateSuggestions(prompt)
    
    // Validate
    const menuSet = new Set(filteredMenu.map(i => i.name.toLowerCase().trim()))
    console.log(`🔍 Menu items in validation set (${menuSet.size}):`, Array.from(menuSet).slice(0, 10).join(', '))
    console.log(`🤖 AI suggested ${aiSuggestions.length} items:`, aiSuggestions.map((s: any) => s.menu_item_name).join(', '))
    
    const validated = aiSuggestions.filter((s: any) => {
      if (!s.menu_item_name) return false
      const exists = menuSet.has(s.menu_item_name.toLowerCase().trim())
      if (!exists) {
        console.warn(`⚠️  AI suggested "${s.menu_item_name}" - not in menu (case-insensitive check)`)
        console.warn(`   Available items: ${Array.from(menuSet).join(', ')}`)
      }
      return exists
    })
    
    console.log(`✅ Validated ${validated.length} of ${aiSuggestions.length} suggestions`)
    
    if (validated.length === 0) {
      console.error('❌ No valid suggestions after validation')
      console.error(`Full menu list (${menuSet.size} items):`, Array.from(menuSet).join(', '))
      console.error(`AI suggested (${aiSuggestions.length} items):`, aiSuggestions.map((s: any) => s.menu_item_name).join(', '))
      throw new Error('No valid suggestions generated')
    }
    
    // Enrich
    const enriched: MenuSuggestion[] = validated.map((s: any) => ({
      menu_item_name: s.menu_item_name,
      why_now: s.why || 'Recommended for today',
      posting_angle: 'Featured item',
      suggested_time: s.post_time || '12:00',
      context_reasoning: s.context_reasoning || null,
      alternative_timings: s.alternative_timings || []
    }))
    
    console.log(`✅ Generated ${enriched.length} validated suggestions`)
    
    return new Response(JSON.stringify({
      suggestions: enriched,
      cached: false,
      metadata: {
        tier_used: tierUsed,
        max_ideas_allowed: maxIdeas,
        hours_remaining: hoursRemaining
      }
    }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('❌ Error:', error)
    console.error('Error stack:', error.stack)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n')
    }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })
  }
})
