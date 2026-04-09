/**
 * COMPOUND OPPORTUNITY DETECTOR
 * 
 * Combines Location + Weather + Season to detect high-value content opportunities.
 * 
 * Examples:
 * - Waterfront + Summer + Sunny → HIGH outdoor content opportunity
 * - Waterfront + Winter + Cold → LOW outdoor, shift to cozy interior
 * - City Center + Lunch hours + Business season → Business lunch angle
 * - Tourist Area + Summer vacation → International appeal, visual focus
 */

import type { WeatherForecast } from './weather.ts'

// =====================================================
// TYPES
// =====================================================

export interface LocationContext {
  // Location intelligence from category_scores
  categoryScores: Record<string, number> // e.g., { waterfront: 85, tourist_area: 60, ... }
  outdoorSeating: boolean
  areaType?: 'urban' | 'suburban' | 'rural' | 'tourist'
  
  // Operational context
  servicePeriods?: string[] // ['breakfast', 'lunch', 'dinner']
  primaryServicePeriod?: string
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export interface CompoundOpportunity {
  id: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  score: number // 0-100
  
  // What triggered this opportunity
  triggers: {
    location: string[] // e.g., ['waterfront', 'outdoor_seating']
    weather: string[] // e.g., ['sunny', 'warm_weekend']
    season: Season
    timing?: string[] // e.g., ['lunch_hours', 'weekend']
  }
  
  // Content guidance
  contentAngle: string // e.g., "Amplify outdoor terrace with harbor views"
  contentTypes: string[] // e.g., ['atmosphere_experience', 'location_announcement']
  platformPriority: 'instagram' | 'facebook' | 'both'
  
  // Urgency
  isTimeSensitive: boolean
  expiresAt?: Date // When this opportunity expires (e.g., before weather changes)
  
  // AI guidance
  promptHints: string[] // Specific suggestions for AI prompt
}

// =====================================================
// COMPOUND OPPORTUNITY DETECTION
// =====================================================

/**
 * Main detector: combines all three layers to find content opportunities
 */
export async function detectCompoundOpportunities(
  location: LocationContext,
  weatherForecast: WeatherForecast[],
  season: Season,
  businessId: string,
  supabase: any,
  currentHour?: number,
  countryCode?: string // Added: need country for calendar lookup
): Promise<CompoundOpportunity[]> {
  const opportunities: CompoundOpportunity[] = []
  
  // Extract dominant location types (score >= 70)
  const dominantLocations = Object.entries(location.categoryScores)
    .filter(([_, score]) => score >= 70)
    .map(([category]) => category)
  
  // Upcoming weather (next 3 days)
  const upcomingWeather = weatherForecast.slice(0, 3)
  
  // =====================================================
  // PATTERN 1: Outdoor Seating Opportunities
  // =====================================================
  if (location.outdoorSeating) {
    const outdoorOpportunities = detectOutdoorOpportunities(
      dominantLocations,
      upcomingWeather,
      season
    )
    opportunities.push(...outdoorOpportunities)
  }
  
  // =====================================================
  // PATTERN 2: Waterfront Amplification
  // =====================================================
  if (dominantLocations.includes('waterfront')) {
    const waterfrontOpportunities = detectWaterfrontOpportunities(
      upcomingWeather,
      season
    )
    opportunities.push(...waterfrontOpportunities)
  }
  
  // =====================================================
  // PATTERN 3: Tourist Area + Season
  // =====================================================
  if (dominantLocations.includes('tourist_area')) {
    const touristOpportunities = detectTouristOpportunities(
      upcomingWeather,
      season
    )
    opportunities.push(...touristOpportunities)
  }
  
  // =====================================================
  // PATTERN 4: Business District + Time of Day
  // =====================================================
  if (dominantLocations.includes('business_district') && currentHour) {
    const businessOpportunities = detectBusinessOpportunities(
      location,
      upcomingWeather,
      season,
      currentHour
    )
    opportunities.push(...businessOpportunities)
  }
  
  // =====================================================
  // PATTERN 5: Residential + Cozy Factor
  // =====================================================
  if (dominantLocations.includes('residential')) {
    const residentialOpportunities = detectResidentialOpportunities(
      upcomingWeather,
      season
    )
    opportunities.push(...residentialOpportunities)
  }
  
  // =====================================================
  // PATTERN 6: Weather-Driven Pivots
  // =====================================================
  const weatherPivots = detectWeatherPivots(
    location,
    upcomingWeather,
    season
  )
  opportunities.push(...weatherPivots)
  
  // =====================================================
  // PATTERN 7: Terrace Opening (Spring First Warm Days)
  // =====================================================
  if (location.outdoorSeating) {
    const terraceOpportunities = await detectTerraceOpening(
      season,
      upcomingWeather,
      location.outdoorSeating,
      supabase,
      businessId
    )
    opportunities.push(...terraceOpportunities)
  }
  
  // =====================================================
  // PATTERN 8: Team Spotlight (Behind-the-Scenes)
  // =====================================================
  const teamOpportunities = await detectTeamSpotlight(
    supabase,
    businessId
  )
  opportunities.push(...teamOpportunities)
  
  // =====================================================
  // PATTERN 9: Event Announcement (Calendar Integration)
  // =====================================================
  const eventOpportunities = await detectEventAnnouncement(
    supabase,
    businessId,
    countryCode || 'DK' // Pass country code for calendar lookup
  )
  opportunities.push(...eventOpportunities)
  
  // Sort by priority and score
  return opportunities.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
    return priorityDiff !== 0 ? priorityDiff : b.score - a.score
  })
}

// =====================================================
// PATTERN DETECTORS
// =====================================================

/**
 * PATTERN 1: Outdoor seating opportunities based on weather
 */
function detectOutdoorOpportunities(
  locations: string[],
  weather: WeatherForecast[],
  season: Season
): CompoundOpportunity[] {
  const opportunities: CompoundOpportunity[] = []
  
  // Check for ideal outdoor weather in next 3 days
  for (let i = 0; i < weather.length; i++) {
    const day = weather[i]
    const date = new Date(day.date)
    const isWeekend = date.getDay() === 0 || date.getDay() === 6
    
    // Perfect outdoor conditions: sunny/partly_cloudy + temp 15-28°C
    if (
      (day.condition === 'clear' || day.condition === 'partly_cloudy') &&
      day.temp.day >= 15 &&
      day.temp.day <= 28
    ) {
      const score = calculateOutdoorScore(day, isWeekend, season)
      
      if (score >= 70) {
        opportunities.push({
          id: `outdoor-${day.date}`,
          priority: isWeekend ? 'critical' : 'high',
          score,
          triggers: {
            location: ['outdoor_seating', ...locations.filter(l => l === 'waterfront' || l === 'park_adjacent')],
            weather: [day.condition, `${day.temp.day}°C`],
            season,
            timing: isWeekend ? ['weekend'] : []
          },
          contentAngle: isWeekend 
            ? `☀️ Perfect weekend weather → Showcase outdoor dining/terrace experience`
            : `🌤️ Beautiful ${day.description} → Highlight outdoor seating availability`,
          contentTypes: ['atmosphere_experience', 'location_announcement', 'product_beauty'],
          platformPriority: 'instagram',
          isTimeSensitive: true,
          expiresAt: date,
          promptHints: [
            'Emphasize outdoor setting and natural light',
            'Show tables, umbrellas, outdoor ambiance',
            'Mention weather in caption ("Perfect day for outdoor dining")',
            isWeekend ? 'Create urgency: limited outdoor tables available' : ''
          ].filter(Boolean)
        })
      }
    }
    
    // Bad weather coming → pivot to indoor
    if (
      (day.condition === 'rain' || day.temp.day < 10) &&
      i <= 1 // Within next 2 days
    ) {
      opportunities.push({
        id: `indoor-pivot-${day.date}`,
        priority: 'medium',
        score: 60,
        triggers: {
          location: locations,
          weather: [day.condition, 'cold' ],
          season
        },
        contentAngle: `🏠 Weather shift → Emphasize cozy interior, comfort food, warmth`,
        contentTypes: ['atmosphere_experience', 'menu_highlight'],
        platformPriority: 'both',
        isTimeSensitive: true,
        expiresAt: date,
        promptHints: [
          'Shift from outdoor to indoor comfort',
          'Warm lighting, cozy corners, comfort food',
          'Use words like "hyggelig", "warm", "cozy"'
        ]
      })
    }
  }
  
  return opportunities
}

/**
 * PATTERN 2: Waterfront location amplification
 */
function detectWaterfrontOpportunities(
  weather: WeatherForecast[],
  season: Season
): CompoundOpportunity[] {
  const opportunities: CompoundOpportunity[] = []
  
  // Summer + Waterfront + Good weather = CRITICAL opportunity
  if (season === 'summer' || season === 'spring') {
    const goodWeatherDays = weather.filter(d => 
      (d.condition === 'clear' || d.condition === 'partly_cloudy') &&
      d.temp.day >= 18
    )
    
    if (goodWeatherDays.length >= 2) {
      opportunities.push({
        id: 'waterfront-summer-amplify',
        priority: 'critical',
        score: 95,
        triggers: {
          location: ['waterfront'],
          weather: ['sunny', 'warm'],
          season
        },
        contentAngle: `⚓ Waterfront + Summer + Sunshine → MAXIMUM amplification of harbor/water views`,
        contentTypes: ['atmosphere_experience', 'location_announcement', 'lifestyle_ambiance'],
        platformPriority: 'instagram',
        isTimeSensitive: false,
        promptHints: [
          'Emphasize water views, boats, harbor atmosphere',
          'Golden hour shots with water reflections',
          'Show outdoor seating with water backdrop',
          'Use maritime vocabulary (harbor, waterfront, seaside)',
          'Target tourists and local explorers'
        ]
      })
    }
  }
  
  // Winter + Waterfront = Shift to warmth contrast
  if (season === 'winter' || season === 'autumn') {
    const coldDays = weather.filter(d => d.temp.day < 10)
    
    if (coldDays.length >= 2) {
      opportunities.push({
        id: 'waterfront-winter-pivot',
        priority: 'medium',
        score: 70,
        triggers: {
          location: ['waterfront'],
          weather: ['cold', 'winter'],
          season
        },
        contentAngle: `❄️ Cold waterfront → Warm interior contrast (hygge angle)`,
        contentTypes: ['atmosphere_experience', 'menu_highlight'],
        platformPriority: 'instagram',
        isTimeSensitive: false,
        promptHints: [
          'Show warm interior with cold harbor views outside',
          'Contrast: cozy inside, dramatic weather outside',
          'Hot drinks, warm food, window shots',
          'Use "hygge", "varme", "cozy by the water"',
          'Play up the "escape the cold" angle'
        ]
      })
    }
  }
  
  return opportunities
}

/**
 * PATTERN 3: Tourist area seasonality
 */
function detectTouristOpportunities(
  weather: WeatherForecast[],
  season: Season
): CompoundOpportunity[] {
  const opportunities: CompoundOpportunity[] = []
  
  // Summer vacation period (June-August)
  if (season === 'summer') {
    opportunities.push({
      id: 'tourist-summer',
      priority: 'high',
      score: 85,
      triggers: {
        location: ['tourist_area'],
        weather: [],
        season,
        timing: ['vacation_period']
      },
      contentAngle: `🌍 Tourist season → International appeal, visual storytelling, iconic shots`,
      contentTypes: ['atmosphere_experience', 'location_announcement', 'product_beauty'],
      platformPriority: 'instagram',
      isTimeSensitive: false,
      promptHints: [
        'Use universally appealing visual content',
        'Minimal text, maximum visual impact',
        'Show iconic/instagrammable elements',
        'Include English captions or bilingual',
        'Focus on "must-visit" angle',
        'Tag location prominently'
      ]
    })
  }
  
  // Off-season: focus on locals
  if (season === 'winter' || season === 'autumn') {
    opportunities.push({
      id: 'tourist-offseason',
      priority: 'medium',
      score: 60,
      triggers: {
        location: ['tourist_area'],
        weather: [],
        season
      },
      contentAngle: `🏠 Off-season → Local favorite angle, neighborhood gem, authentic experience`,
      contentTypes: ['community_events', 'behind_scenes', 'menu_highlight'],
      platformPriority: 'facebook',
      isTimeSensitive: false,
      promptHints: [
        'Target locals: "Your neighborhood spot"',
        'Emphasize authenticity over tourism',
        'Community-focused content',
        'Regular customer shoutouts',
        'Cozy, familiar, welcoming angle'
      ]
    })
  }
  
  return opportunities
}

/**
 * PATTERN 4: Business district + time of day
 */
function detectBusinessOpportunities(
  location: LocationContext,
  weather: WeatherForecast[],
  season: Season,
  currentHour: number
): CompoundOpportunity[] {
  const opportunities: CompoundOpportunity[] = []
  
  // Lunch hours (11-14) + Business district
  if (
    currentHour >= 11 && currentHour <= 14 &&
    location.servicePeriods?.includes('lunch')
  ) {
    opportunities.push({
      id: 'business-lunch',
      priority: 'high',
      score: 80,
      triggers: {
        location: ['business_district'],
        weather: [],
        season,
        timing: ['lunch_hours', 'weekday']
      },
      contentAngle: `💼 Business lunch hour → Quick, professional, value-focused messaging`,
      contentTypes: ['menu_highlight', 'promotional_offers', 'speed_convenience'],
      platformPriority: 'facebook',
      isTimeSensitive: true,
      expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours
      promptHints: [
        'Emphasize speed: "Quick lunch", "Express menu"',
        'Business casual tone, professional',
        'Value proposition: lunch deals, combo meals',
        'Highlight convenience (takeaway, reserved seating)',
        'Post between 10-11 AM for lunch visibility'
      ]
    })
  }
  
  // After-work (17-19) + Business district
  if (currentHour >= 17 && currentHour <= 19) {
    opportunities.push({
      id: 'business-afterwork',
      priority: 'medium',
      score: 70,
      triggers: {
        location: ['business_district'],
        weather: [],
        season,
        timing: ['after_work', 'weekday']
      },
      contentAngle: `🍷 After-work crowd → Relaxation angle, unwind, social gathering`,
      contentTypes: ['lifestyle_ambiance', 'promotional_offers', 'community_events'],
      platformPriority: 'both',
      isTimeSensitive: true,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
      promptHints: [
        'Transition from work to social',
        'Happy hour, drinks, casual dining',
        'Use words like "unwind", "relax", "celebrate"',
        'Group-friendly messaging',
        'Post between 15-16 for after-work awareness'
      ]
    })
  }
  
  return opportunities
}

/**
 * PATTERN 5: Residential area + season
 */
function detectResidentialOpportunities(
  weather: WeatherForecast[],
  season: Season
): CompoundOpportunity[] {
  const opportunities: CompoundOpportunity[] = []
  
  // Fall/Winter + Residential = Neighborhood comfort
  if (season === 'autumn' || season === 'winter') {
    opportunities.push({
      id: 'residential-comfort',
      priority: 'medium',
      score: 75,
      triggers: {
        location: ['residential'],
        weather: [],
        season
      },
      contentAngle: `🏡 Residential + Cold season → Neighborhood gathering place, local comfort, familiarity`,
      contentTypes: ['community_events', 'menu_highlight', 'lifestyle_ambiance'],
      platformPriority: 'facebook',
      isTimeSensitive: false,
      promptHints: [
        'Emphasize local/neighborhood angle',
        'Use "Your local spot", "Neighborhood favorite"',
        'Community-focused content',
        'Familiar faces, regular customers',
        'Comfort food, warm atmosphere',
        'Family-friendly messaging'
      ]
    })
  }
  
  return opportunities
}

/**
 * PATTERN 6: Weather-driven content pivots
 */
function detectWeatherPivots(
  location: LocationContext,
  weather: WeatherForecast[],
  season: Season
): CompoundOpportunity[] {
  const opportunities: CompoundOpportunity[] = []
  
  // Heatwave detection (temp >= 28°C for 2+ days)
  const heatwaveDays = weather.filter(d => d.temp.day >= 28)
  if (heatwaveDays.length >= 2) {
    opportunities.push({
      id: 'weather-heatwave',
      priority: 'critical',
      score: 90,
      triggers: {
        location: Object.keys(location.categoryScores),
        weather: ['heatwave', 'hot'],
        season
      },
      contentAngle: `🔥 Heatwave → Cold beverages, ice cream, light meals, cooling angle`,
      contentTypes: ['menu_highlight', 'product_beauty', 'promotional_offers'],
      platformPriority: 'instagram',
      isTimeSensitive: true,
      expiresAt: new Date(heatwaveDays[heatwaveDays.length - 1].date),
      promptHints: [
        'Emphasize COLD: iced drinks, frozen treats, salads',
        'Visual: ice, condensation, refreshing colors',
        'Use words like "cooling", "refreshing", "beat the heat"',
        'Promote air conditioning if available',
        'Focus on light, fresh menu items'
      ]
    })
  }
  
  // Cold snap detection (temp <= 5°C)
  const coldSnapDays = weather.filter(d => d.temp.day <= 5)
  if (coldSnapDays.length >= 2) {
    opportunities.push({
      id: 'weather-coldsnap',
      priority: 'high',
      score: 85,
      triggers: {
        location: Object.keys(location.categoryScores),
        weather: ['cold_snap', 'freezing'],
        season
      },
      contentAngle: `❄️ Cold snap → Hot drinks, hearty dishes, warmth angle, comfort`,
      contentTypes: ['menu_highlight', 'atmosphere_experience'],
      platformPriority: 'instagram',
      isTimeSensitive: true,
      expiresAt: new Date(coldSnapDays[coldSnapDays.length - 1].date),
      promptHints: [
        'Emphasize HEAT: steaming coffee, hot chocolate, soup',
        'Visual: steam, warm lighting, cozy corners',
        'Use words like "warm up", "cozy", "hearty"',
        'Promote indoor comfort, heating',
        'Focus on comfort food, hot meals'
      ]
    })
  }
  
  // Rainy weekend → Cozy indoor pivot
  const upcomingWeekend = weather.find(d => {
    const date = new Date(d.date)
    return date.getDay() === 6 || date.getDay() === 0
  })
  
  if (upcomingWeekend && upcomingWeekend.condition === 'rain') {
    opportunities.push({
      id: 'weather-rainy-weekend',
      priority: 'high',
      score: 80,
      triggers: {
        location: Object.keys(location.categoryScores),
        weather: ['rain', 'weekend'],
        season
      },
      contentAngle: `🌧️ Rainy weekend → Indoor hygge, comfort dining, escape the rain`,
      contentTypes: ['atmosphere_experience', 'menu_highlight', 'promotional_offers'],
      platformPriority: 'both',
      isTimeSensitive: true,
      expiresAt: new Date(upcomingWeekend.date),
      promptHints: [
        'Emphasize indoor comfort vs. outdoor rain',
        'Use "hygge", "cozy", "perfect rainy day spot"',
        'Show warm interior, soft lighting',
        'Promote comfort food, hot drinks',
        'Create urgency: book ahead for dry comfort'
      ]
    })
  }
  
  return opportunities
}

// =====================================================
// SCORING HELPERS
// =====================================================

/**
 * Calculate outdoor opportunity score
 */
function calculateOutdoorScore(
  day: WeatherForecast,
  isWeekend: boolean,
  season: Season
): number {
  let score = 50 // Base score
  
  // Weather contribution (0-30 points)
  if (day.condition === 'clear') score += 30
  else if (day.condition === 'partly_cloudy') score += 20
  
  // Temperature contribution (0-20 points)
  if (day.temp.day >= 20 && day.temp.day <= 25) score += 20 // Perfect
  else if (day.temp.day >= 15 && day.temp.day <= 28) score += 15 // Good
  else if (day.temp.day >= 12) score += 10 // Acceptable
  
  // Weekend bonus (0-10 points)
  if (isWeekend) score += 10
  
  // Season bonus (0-10 points)
  if (season === 'summer') score += 10
  else if (season === 'spring') score += 8
  else if (season === 'autumn') score += 5
  
  return Math.min(score, 100)
}

// =====================================================
// PATTERN 7: Terrace Opening (Spring First Warm Days)
// =====================================================
async function detectTerraceOpening(
  season: Season,
  upcomingWeather: WeatherForecast[],
  outdoorSeating: boolean,
  supabase: any,
  businessId: string
): Promise<CompoundOpportunity[]> {
  if (!outdoorSeating) return []
  if (season !== 'spring' && season !== 'summer') return []
  
  // Check if we have warm weather coming (3+ consecutive days above 15°C)
  const warmDays = upcomingWeather.filter(day => day.temp.day >= 15)
  if (warmDays.length < 3) return []
  
  // Check if we already announced terrace opening this year
  const currentYear = new Date().getFullYear()
  const { data: lastTerrace } = await supabase
    .from('opportunity_tracking')
    .select('last_posted_date')
    .eq('business_id', businessId)
    .eq('opportunity_type', 'terrace_opening')
    .gte('last_posted_date', `${currentYear}-01-01`)
    .single()
  
  if (lastTerrace) {
    return [] // Already announced this year
  }
  
  return [{
    id: 'terrace_opening',
    priority: 'critical',
    score: 250,
    triggers: {
      location: ['outdoor_seating'],
      weather: ['first_warm_days'],
      season
    },
    contentAngle: 'Announce terrace opening for the season - celebrate outdoor dining return',
    contentTypes: ['location_announcement', 'atmosphere_experience'],
    platformPriority: 'both',
    isTimeSensitive: true,
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
    promptHints: [
      'Excitement about first warm days',
      'Visual: terrace setup, outdoor space',
      'Caption: seasonal transition, outdoor dining joy',
      'Hashtags: #TerraceOpen #AlFrescoDining #SpringDining'
    ]
  }]
}

// =====================================================
// PATTERN 8: Team Spotlight (Behind-the-Scenes)
// =====================================================
async function detectTeamSpotlight(
  supabase: any,
  businessId: string
): Promise<CompoundOpportunity[]> {
  // Check performance of behind-the-scenes content
  const { data: performanceData } = await supabase
    .from('content_type_baselines')
    .select('content_type, avg_engagement_rate')
    .eq('business_id', businessId)
    .eq('content_type', 'behind_the_scenes')
    .single()
  
  // Check business average
  const { data: businessAvg } = await supabase
    .from('content_type_baselines')
    .select('avg_engagement_rate')
    .eq('business_id', businessId)
  
  if (!performanceData || !businessAvg || businessAvg.length === 0) {
    return [] // Not enough data
  }
  
  const avgEngagement = businessAvg.reduce((sum, row) => sum + row.avg_engagement_rate, 0) / businessAvg.length
  const btsEngagement = performanceData.avg_engagement_rate
  
  // Only suggest if BTS performs 30%+ above average
  if (btsEngagement < avgEngagement * 1.3) {
    return []
  }
  
  // Check when we last did team spotlight
  const { data: lastSpotlight } = await supabase
    .from('opportunity_tracking')
    .select('last_posted_date')
    .eq('business_id', businessId)
    .eq('opportunity_type', 'team_spotlight')
    .order('last_posted_date', { ascending: false })
    .limit(1)
    .single()
  
  if (lastSpotlight) {
    const daysSince = Math.floor(
      (Date.now() - new Date(lastSpotlight.last_posted_date).getTime()) / (24 * 60 * 60 * 1000)
    )
    if (daysSince < 45) {
      return [] // Too recent (wait 45+ days between team spotlights)
    }
  }
  
  return [{
    id: 'team_spotlight',
    priority: 'medium',
    score: 150,
    triggers: {
      location: ['behind_the_scenes'],
      weather: [],
      season: 'spring' // Placeholder - not season-dependent
    },
    contentAngle: 'Spotlight team member or kitchen process - humanize brand',
    contentTypes: ['behind_the_scenes', 'team_culture'],
    platformPriority: 'instagram',
    isTimeSensitive: false,
    promptHints: [
      'Focus on one person or process',
      'Visual: candid action shot, not posed',
      'Caption: personal story, passion, expertise',
      'Humanize: show personality, dedication',
      'Hashtags: #MeetTheTeam #BehindTheScenes #TeamSpotlight'
    ]
  }]
}

// =====================================================
// PATTERN 9: Event Announcement (Calendar Integration)
// =====================================================
async function detectEventAnnouncement(
  supabase: any,
  businessId: string,
  countryCode: string // Changed: use country instead of business_id
): Promise<CompoundOpportunity[]> {
  // Query upcoming events from contextual calendar (next 30 days)
  const startDate = new Date()
  const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  
  const { data: events } = await supabase
    .from('contextual_calendar')
    .select('date_start, date_end, event_type, event_name, relevance_tags, content_angle, marketing_hook')
    .eq('country', countryCode)
    .gte('date_start', startDate.toISOString().split('T')[0])
    .lte('date_start', endDate.toISOString().split('T')[0])
    .order('date_start', { ascending: true })
  
  if (!events || events.length === 0) {
    return []
  }
  
  const opportunities: CompoundOpportunity[] = []
  
  for (const event of events) {
    // Check if already posted about this event
    const { data: alreadyPosted } = await supabase
      .from('opportunity_tracking')
      .select('id')
      .eq('business_id', businessId)
      .eq('opportunity_type', 'event_announcement')
      .eq('opportunity_subtype', event.event_name)
      .single()
    
    if (alreadyPosted) {
      continue // Skip if already announced
    }
    
    const eventDate = new Date(event.date_start)
    const daysUntil = Math.ceil((eventDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    
    opportunities.push({
      id: `event_${event.event_name.toLowerCase().replace(/\s+/g, '_')}`,
      priority: daysUntil <= 7 ? 'high' : 'medium',
      score: daysUntil <= 7 ? 90 : 75, // Higher score if event is soon
      triggers: {
        location: event.relevance_tags || [],
        weather: [],
        season: 'spring' // Placeholder
      },
      contentAngle: event.content_angle || `Announce upcoming ${event.event_type}: ${event.event_name}`,
      contentTypes: ['events_promotions', 'community_events'],
      platformPriority: 'both',
      isTimeSensitive: true,
      expiresAt: eventDate,
      promptHints: [
        `Event: ${event.event_name} (${eventDate.toLocaleDateString('da-DK')})`,
        `Type: ${event.event_type}`,
        event.marketing_hook || 'Create anticipation and excitement',
        event.content_angle || '',
        `Relevance: ${(event.relevance_tags || []).join(', ')}`,
        'Visual: event-themed imagery',
        'Hashtags: event-specific + seasonal'
      ].filter(h => h) // Remove empty hints
    })
  }
  
  return opportunities
}

// =====================================================
// EXPORT HELPERS
// =====================================================

/**
 * Format opportunities for AI prompt
 */
export function formatOpportunitiesForPrompt(opportunities: CompoundOpportunity[]): string {
  if (opportunities.length === 0) {
    return 'No special content opportunities detected.'
  }
  
  const lines = ['CONTENT OPPORTUNITIES (prioritized):']
  
  // Show top 3 opportunities
  const topOpportunities = opportunities.slice(0, 3)
  
  for (const opp of topOpportunities) {
    lines.push(`\n[${opp.priority.toUpperCase()}] ${opp.contentAngle}`)
    lines.push(`  → Suggested content types: ${opp.contentTypes.join(', ')}`)
    lines.push(`  → Platform: ${opp.platformPriority}`)
    if (opp.isTimeSensitive) {
      lines.push(`  → ⚠️ TIME-SENSITIVE`)
    }
    if (opp.promptHints.length > 0) {
      lines.push(`  → Hints: ${opp.promptHints.join(' | ')}`)
    }
  }
  
  return lines.join('\n')
}
