// supabase/functions/get-quick-suggestions/index.ts
// Lightweight AI suggestion generator for post-onboarding dashboard
// Returns 3 simple suggestions based on weather + top 5 menu items
// NOT full Layer 0 - just enough for quick suggestions

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Safe Hospitality Fallback for FREE tier ──
// For Free tier, we use this universal safe tone that works for 90% of Danish hospitality
const SAFE_HOSPITALITY_FALLBACK = {
  formalityLevel: 'casual',      // Næsten ingen dansk hospitality bruger formel tone
  addressForm: 'du-tiltale',     // >90% af danske caféer/restauranter bruger du
  sentenceStyle: 'beskrivende',
  personalityTraits: ['varm', 'inviterende'],  // Universelt sikkert
  brandVoiceSummary: null,       // Opfind ikke noget
}

// ── Helper: Content-aware suggested time ──
// Returns the ideal posting hour (HH:MM) based on what is being posted.
// todayOpenTime clamps the result so we never suggest posting before the business opens.
// The frontend handles rolling to tomorrow if the slot has already passed.
function getContentAwareTime(contentType: string, title: string, todayOpenTime?: string | null): string {
  const t = title.toLowerCase()
  let slotTime: string
  if (contentType === 'menu_item') {
    if (/brunch|morgen|morgenmad|breakfast|æg|croissant|granola|acai|boller|pandekage|vaffel/.test(t)) slotTime = '09:00'
    else if (/frokost|sandwich|smørbr|suppe|salat|wrap|baguette/.test(t)) slotTime = '11:00'
    else if (/aftensmad|middag|3-retters|tre retters|aftenmenu|bøf|vildt|pasta ret/.test(t)) slotTime = '17:00'
    else slotTime = '12:00'
  } else {
    slotTime = '14:00' // atmosphere or behind_scenes
  }
  // Clamp to actual opening time so we never suggest posting before the business opens
  if (todayOpenTime) {
    const [slotH, slotM = 0] = slotTime.split(':').map(Number)
    const [openH, openM = 0] = todayOpenTime.split(':').map(Number)
    if (slotH * 60 + slotM < openH * 60 + openM) {
      const postMinutes = openH * 60 + openM + 30
      return `${Math.floor(postMinutes / 60).toString().padStart(2, '0')}:${(postMinutes % 60).toString().padStart(2, '0')}`
    }
  }
  return slotTime
}

// ── Helper: Day-of-week behavioral state ──
type DayBehavior = {
  mode: string; danishMode: string; emphasis: string
  avoidPushFootfall: boolean; offeringTone: string
  slotBDefault: string; slotCDefault: string
}
function getDayBehavior(dayIndex: number): DayBehavior {
  const behaviors: DayBehavior[] = [
    { mode: 'sunday_slow',     danishMode: 'Søndagsrolig',         emphasis: 'langsom start, brunch, afslapning',           avoidPushFootfall: false, offeringTone: 'hyggelig og uformel',     slotBDefault: 'brunch_moment',    slotCDefault: 'atmosphere'    },
    { mode: 'weekday_restart', danishMode: 'Mandags-restart',       emphasis: 'frisk start, frokostpause, ny uge',           avoidPushFootfall: false, offeringTone: 'energisk og informativ', slotBDefault: 'lunch_moment',     slotCDefault: 'behind_scenes' },
    { mode: 'midweek_quiet',   danishMode: 'Rolig hverdag',         emphasis: 'hverdagsrutine, stille øjeblikke',             avoidPushFootfall: false, offeringTone: 'rolig og informativ',   slotBDefault: 'lunch_moment',     slotCDefault: 'atmosphere'    },
    { mode: 'hump_day',        danishMode: 'Midt på ugen',          emphasis: 'lille pause i ugen, hverdag med charme',       avoidPushFootfall: false, offeringTone: 'imødekommende',         slotBDefault: 'lunch_moment',     slotCDefault: 'behind_scenes' },
    { mode: 'pre_weekend',     danishMode: 'Torsdag – pre-weekend', emphasis: 'forhype til weekend, afterwork, socialt',      avoidPushFootfall: false, offeringTone: 'let festlig',            slotBDefault: 'afterwork_moment', slotCDefault: 'atmosphere'    },
    { mode: 'friday_social',   danishMode: 'Fredagsvibes',          emphasis: 'fyraftensdrink, weekend starter, socialt samvær', avoidPushFootfall: false, offeringTone: 'festlig og indbydende', slotBDefault: 'afterwork_moment', slotCDefault: 'atmosphere'    },
    { mode: 'weekend_peak',    danishMode: 'Weekendpeak',           emphasis: 'brunch, frokost, gæster med tid',             avoidPushFootfall: false, offeringTone: 'varm og social',         slotBDefault: 'brunch_moment',    slotCDefault: 'atmosphere'    },
  ]
  return behaviors[dayIndex] ?? behaviors[1]
}

// ── Helper: Derive service period from opening hours ──
function deriveServicePeriod(openTime: string | null, closeTime: string | null): 'brunch' | 'lunch' | 'dinner' | 'all_day' | null {
  if (!openTime || !closeTime) return null
  const [openH] = openTime.split(':').map(Number)
  const [closeH] = closeTime.split(':').map(Number)
  if (openH >= 17) return 'dinner'
  if (openH <= 11 && closeH <= 16) return 'brunch'
  if (openH <= 11 && closeH <= 20) return 'lunch'
  return 'all_day'
}

// ── Helper: Rotate Slot B+C content types based on recent history ──
type RecentSuggestion = { title: string; content_type: string; photo_idea: string }
function getSlotBCTypes(recentSugg: RecentSuggestion[], dayBehavior: DayBehavior): { slotB: string; slotC: string } {
  const recentTypes = recentSugg.map((s) => s.content_type || '')
  const behindCount = recentTypes.filter((t) => t === 'behind_scenes').length
  const atmoCount = recentTypes.filter((t) => t === 'atmosphere').length
  // Rotate in behind_scenes if atmosphere has dominated recently
  if (atmoCount >= 3 && behindCount < 2) {
    return { slotB: dayBehavior.slotBDefault, slotC: 'behind_scenes' }
  }
  return { slotB: dayBehavior.slotBDefault, slotC: dayBehavior.slotCDefault }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { businessId, count = 3, tier = 'free', regenerate = false } = await req.json()
    
    if (!businessId) {
      return new Response(JSON.stringify({ error: 'businessId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Fetch business data ──
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // ── Get today's date for caching and quota checks ──
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

    // ── Tier-based logic ──
    const isPaidTier = tier === 'standardplus' || tier === 'premium'

    // ── Check daily quota (FREE and PAID tiers, only if regenerating = new generation) ──
    if (regenerate) {
      // Fetch business quota info
      const { data: businessQuota, error: quotaError } = await supabase
        .from('businesses')
        .select('quick_suggestions_today, last_quick_suggestions_reset, plan')
        .eq('id', businessId)
        .single()

      if (quotaError) {
        console.error('❌ Could not check quota:', quotaError)
      } else if (businessQuota) {
        // Reset counter if it's a new day
        const lastReset = businessQuota.last_quick_suggestions_reset
        const needsReset = !lastReset || lastReset < today
        
        let currentCount = businessQuota.quick_suggestions_today || 0
        
        if (needsReset) {
          // Reset counter for new day
          await supabase
            .from('businesses')
            .update({ 
              quick_suggestions_today: 0, 
              last_quick_suggestions_reset: today 
            })
            .eq('id', businessId)
          currentCount = 0
          console.log('🔄 Reset daily quota for new day')
        }

        // Check tier-based limits
        const FREE_DAILY_LIMIT = 5
        const PAID_DAILY_LIMIT = 100
        
        const dailyLimit = tier === 'free' ? FREE_DAILY_LIMIT : PAID_DAILY_LIMIT
        
        if (currentCount >= dailyLimit) {
          console.log(`🚫 ${tier.toUpperCase()} tier daily limit exceeded:`, currentCount)
          
          const message = tier === 'free' 
            ? 'Du har brugt dine 5 forslag i dag 😊\nKom tilbage i morgen — eller opgrader til Smart\nfor ubegrænsede forslag og en komplet ugeplan.'
            : `Du har nået din daglige grænse på ${PAID_DAILY_LIMIT} forslag. Prøv igen i morgen.`
          
          return new Response(JSON.stringify({ 
            error: 'DAILY_LIMIT_EXCEEDED',
            message: message,
            current: currentCount,
            limit: dailyLimit,
            tier: tier
          }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    }

    // ── Check for existing suggestions (unless regenerate = true) ──
    console.log('🔍 Cache check:', { businessId, date: today, regenerate })
    
    if (!regenerate) {
      try {
        const { data: existingSuggestions, error: dbError } = await supabase
          .from('daily_suggestions')
          .select('id, title, rationale, why_explanation, photo_idea, content_type, suggested_time, position, menu_item_name, menu_item_description, caption_base, cta_intent, weather_forecast, created_at')
          .eq('business_id', businessId)
          .eq('date', today)
          .eq('is_active', true)
          .order('position', { ascending: true })

        console.log('📊 Cache lookup result:', { 
          found: existingSuggestions?.length || 0, 
          hasError: !!dbError,
          errorCode: dbError?.code,
          errorMessage: dbError?.message 
        })

        if (!dbError && existingSuggestions && existingSuggestions.length > 0) {
          // Check if suggestions are >24 hours old
          const createdAt = new Date(existingSuggestions[0].created_at)
          const now = new Date()
          const hoursOld = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
          
          if (hoursOld > 24) {
            console.log(`⏰ Suggestions are ${hoursOld.toFixed(1)} hours old (>24h) - auto-regenerating`)
            // Auto-regenerate by continuing to generation flow
            // Delete old suggestions first
            await supabase
              .from('daily_suggestions')
              .delete()
              .eq('business_id', businessId)
              .eq('date', today)
          } else {
            console.log(`✅ Returning existing suggestions (${hoursOld.toFixed(1)} hours old, <24h)`)
            const suggestions = existingSuggestions.map(s => ({
              id: s.id,
              title: s.title,
              rationale: s.rationale,
              why_explanation: s.why_explanation,
              photo_idea: s.photo_idea,
              media_suggestion: s.media_suggestion || null,
              content_type: s.content_type,
              suggested_time: s.suggested_time,
              suggestion_date: today,
              slot: (s as any).slot || (s.position === 1 ? 'offering' : s.position === 2 ? 'guest_moment' : 'brand_behind'),
              menu_item_name: s.menu_item_name || '',
              menu_item_description: s.menu_item_description || '',
              caption_base: s.caption_base || '',
              cta_intent: s.cta_intent || 'visit'
            }))
            
            // Return stored weather forecast from when ideas were generated
            const weatherForecast = existingSuggestions[0].weather_forecast || null
            
            return new Response(JSON.stringify({ suggestions, cached: true, weatherForecast }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
        }
        
        if (dbError) {
          console.log('⚠️ Cache lookup error:', dbError)
        } else {
          console.log('💡 No cached suggestions found, will generate fresh')
        }
      } catch (e) {
        console.log('❌ Error checking cache:', e)
      }
    } else {
      // Delete old suggestions when regenerating (to avoid unique constraint violation)
      try {
        console.log('🔄 Deleting old suggestions for regeneration')
        const { error: deleteError } = await supabase
          .from('daily_suggestions')
          .delete()
          .eq('business_id', businessId)
          .eq('date', today)
        
        if (deleteError) {
          console.log('⚠️ Could not delete old suggestions:', deleteError)
        }
      } catch (e) {
        console.log('⚠️ Could not delete old suggestions:', e)
      }
    }

    // Get business info
    const { data: business } = await supabase
      .from('businesses')
      .select('name, vertical, website_url, country')
      .eq('id', businessId)
      .single()

    if (!business) {
      return new Response(JSON.stringify({ error: 'Business not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get operations data (outdoor seating, kids menu)
    const { data: operations } = await supabase
      .from('business_operations')
      .select('has_outdoor_seating, has_kids_menu')
      .eq('business_id', businessId)
      .single()
    
    const hasOutdoorSeating = operations?.has_outdoor_seating || false
    const hasKidsMenu = operations?.has_kids_menu || false

    // ── Fetch today's opening hours (paid tier only) ──
    let todayOpenTime: string | null = null
    let todayCloseTime: string | null = null
    if (isPaidTier) {
      const dowNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      const todayDow = dowNames[new Date().getDay()]
      try {
        const { data: hoursRows } = await supabase
          .from('opening_hours')
          .select('open_time, close_time, closed')
          .eq('business_id', businessId)
          .eq('kind', 'normal')
          .eq('weekday', todayDow)
          .limit(1)
        const todayHours = hoursRows?.[0]
        if (todayHours && !todayHours.closed) {
          todayOpenTime = todayHours.open_time ?? null
          todayCloseTime = todayHours.close_time ?? null
          console.log(`⏰ Today's hours: ${todayOpenTime}–${todayCloseTime}`)
        }
      } catch (e) {
        console.warn('⚠️ Failed to fetch opening hours:', e)
      }
    }

    // Get location
    const { data: location } = await supabase
      .from('business_locations')
      .select('postal_code, city, country')
      .eq('business_id', businessId)
      .eq('is_primary', true)
      .single()

    // Get menu items (top 5 for free tier)
    const maxItems = tier === 'free' ? 5 : 100
    let signatureItems: string[] = []
    // name → description from menu_results_v2 (paid tier only)
    const menuDescriptionMap = new Map<string, string>()
    // Structured category list for the Gemini prompt (paid tier — built from menu_results_v2)
    const menuCategoryEntries: { catName: string; items: { name: string; description: string }[] }[] = []
    // Tier 3 facts from ai_summary: specific verifiable signals for Slot B/C idea generation
    // (named dishes/concepts in quotes, dietary options, drink programmes, kids menu)
    const menuIntelligenceFacts: string[] = []

    // TIER-BASED MENU SOURCE LOGIC:
    // Free tier: menu_signal only (quick overview from analyze-website)
    // Paid tier: menu_results_v2 (full extraction) → menu_signal (fallback)

    // Source 1: menu_results_v2 (PAID TIER ONLY - full menu with ingredients)
    if (isPaidTier) {
      const { data: menuResults } = await supabase
        .from('menu_results_v2')
        .select('structured_data, ai_summary, service_period_name')
        .eq('business_id', businessId)
        .limit(3)

      if (menuResults && menuResults.length > 0) {
        // Use structured menu data — skip add-on / extra categories
        const addonPattern = /tilk\u00f8b|tilbeh\u00f8r|ekstra|till\u00e6g|add.?on|ekstr|side|snack/i
        // Detect marketing summary sentences — these are website copy, not ingredient lists.
        // They contain full-sentence verbs that describe the menu concept rather than the dish.
        // When passed to Gemini they produce misleading words like "tilbud" (implying a price deal)
        // or "mulighed" (implying a selection concept) in the generated text.
        const isMarketingSentence = (s: string): boolean =>
          s.length > 60 &&
          /tilbyder|giver mulighed|henvender|inkluderer|sk\u00e6reddersyet|oplevelse|foretr\u00e6kker|imødekommer|pr\u00e6ferencer|alternativer/i.test(s)
        for (const result of menuResults) {
          const categories = result.structured_data?.categories || []
          for (const cat of categories) {
            if (addonPattern.test(cat.name || '')) {
              console.log(`\u23ed\ufe0f Skipping add-on category: "${cat.name}"`)
              continue
            }
            const catItems: { name: string; description: string }[] = []
            for (const item of (cat.items || [])) {
              signatureItems.push(item.name)
              let desc = (item.description || '').trim()
              // Strip marketing sentences before storing — they contaminate dish_text_brief
              if (isMarketingSentence(desc)) {
                console.log(`\u26a0\ufe0f Stripped marketing sentence from "${item.name}": ${desc.slice(0, 60)}...`)
                desc = ''
              }
              if (desc) menuDescriptionMap.set(item.name, desc)
              catItems.push({ name: item.name, description: desc })
            }
            if (catItems.length > 0) {
              menuCategoryEntries.push({ catName: cat.name || 'Menu', items: catItems })
            }
          }
        }
        console.log(`📋 Using menu_results_v2 (paid tier): ${signatureItems.length} items across ${menuCategoryEntries.length} categories`)

        // ── Extract Tier 3 menu intelligence from ai_summary ──
        // ai_summary is a 5-bullet helicopter view generated at website-extraction time.
        // Tier 1 (marketing filler) → discarded via isMarketingSentence
        // Tier 2 (audience abstractions) → discarded
        // Tier 3 (specific verifiable facts) → kept as Slot B/C idea signals:
        //   quoted dish/concept names, dietary options, drink programmes, kids menus
        const quotedNamePattern = /["«»„"""]([^"«»„"""]{3,50})["«»„"""]/g
        const dietaryPattern = /vegansk|vegetarisk|glutenfri|laktosefri|halal|kosher|plantebaseret/i
        const drinkPattern = /vinmenu|Ad Libitum|cocktailmenu|øl.?menu|drinks.?menu/i
        const kidPattern = /børnemenu|børneret|barnemenuen/i

        for (const result of menuResults) {
          if (!result.ai_summary || typeof result.ai_summary !== 'string') continue
          const periodLabel = result.service_period_name ? `[${result.service_period_name}] ` : ''
          const lines = (result.ai_summary as string)
            .split('\n')
            .map((l: string) => l.replace(/^[\s•\-–*]+/, '').trim())
            .filter((l: string) => l.length > 10 && !isMarketingSentence(l))

          for (const line of lines) {
            // Named dishes/concepts in quotes
            const quotedMatches = [...line.matchAll(quotedNamePattern)].map(m => m[1])
            if (quotedMatches.length > 0) {
              menuIntelligenceFacts.push(`${periodLabel}${quotedMatches.join(', ')}`)
              continue
            }
            // Dietary options
            if (dietaryPattern.test(line)) {
              menuIntelligenceFacts.push(`${periodLabel}${line.slice(0, 80).replace(/[,;].*$/, '')}`)
              continue
            }
            // Drink programmes
            if (drinkPattern.test(line)) {
              menuIntelligenceFacts.push(`${periodLabel}${line.slice(0, 80).replace(/[,;].*$/, '')}`)
              continue
            }
            // Kids menu
            if (kidPattern.test(line)) {
              menuIntelligenceFacts.push(`${periodLabel}Børnemenu tilgængelig`)
            }
          }
        }
        if (menuIntelligenceFacts.length > 0) {
          console.log(`💡 Menu intelligence facts: ${menuIntelligenceFacts.length}`)
        }
      }
    }

    // Source 2: menu_signal (FREE + PAID fallback - quick overview from analyze-website)
    if (signatureItems.length === 0) {
      const { data: profile } = await supabase
        .from('business_profile')
        .select('menu_signal')
        .eq('business_id', businessId)
        .single()

      const menuSignal = profile?.menu_signal
      if (menuSignal?.hasMenu && menuSignal.signatureItems) {
        // Use signature items from menu signal
        signatureItems = menuSignal.signatureItems.slice(0, maxItems)
        console.log(`📋 Using menu_signal (${tier} tier): ${signatureItems.length} signature items`)
      }
    }

    // Source 3: Fallback to old website_analysis_data format (legacy)
    if (signatureItems.length === 0) {
      const { data: profile } = await supabase
        .from('business_profile')
        .select('website_analysis_data')
        .eq('business_id', businessId)
        .single()

      const offerings = profile?.website_analysis_data?.offerings
      if (offerings?.menuStructure) {
        const addonPattern = /tilk\u00f8b|tilbeh\u00f8r|ekstra|till\u00e6g|add.?on|side|snack/i
        for (const cat of offerings.menuStructure) {
          if (addonPattern.test(cat.name || '')) continue
          for (const item of (cat.items || [])) {
            if (signatureItems.length < maxItems) {
              signatureItems.push(item.name)
            }
          }
        }
        console.log(`📋 Using legacy website_analysis_data: ${signatureItems.length} items`)
      }
    }

    // ── Fetch weather (current + 24h forecast) ──
    let weatherInfo = 'Ingen vejrdata'
    let weatherForecast = ''
    let currentTemp = 0
    let windSpeedMs = 0
    let isSunny = false
    console.log('🌤️ Attempting weather fetch for city:', location?.city || 'NO CITY')
    if (location?.city) {
      try {
        const owmKey = Deno.env.get('OPENWEATHER_API_KEY')
        console.log('🔑 OpenWeather API key:', owmKey ? 'SET' : 'NOT SET')
        if (owmKey) {
          // Current weather
          const weatherRes = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${location.city},DK&appid=${owmKey}&units=metric&lang=da`
          )
          if (weatherRes.ok) {
            const weatherData = await weatherRes.json()
            currentTemp = Math.round(weatherData.main.temp)
            windSpeedMs = weatherData.wind?.speed || 0
            const weatherId = weatherData.weather?.[0]?.id || 0
            isSunny = weatherId >= 800 && weatherId <= 801 // Clear sky or few clouds
            const desc = weatherData.weather?.[0]?.description || ''
            weatherInfo = `${currentTemp}°C, ${desc}, vind ${windSpeedMs.toFixed(1)} m/s`
            console.log('✅ Current weather:', weatherInfo, { currentTemp, windSpeedMs, isSunny })
          }

          // 24-hour forecast
          const forecastRes = await fetch(
            `https://api.openweathermap.org/data/2.5/forecast?q=${location.city},DK&appid=${owmKey}&units=metric&lang=da&cnt=8`
          )
          if (forecastRes.ok) {
            const forecastData = await forecastRes.json()
            // Get conditions for today + tomorrow (16 x 3-hour intervals = ~48h)
            const conditions = new Set<string>()
            let maxTemp = -Infinity
            let minTemp = Infinity
            
            forecastData.list?.slice(0, 16).forEach((item: any) => {
              const temp = item.main.temp
              if (temp > maxTemp) maxTemp = temp
              if (temp < minTemp) minTemp = temp
              const condition = item.weather?.[0]?.main
              if (condition) conditions.add(condition)
            })
            
            // Translate conditions to Danish
            const weatherTranslations: Record<string, string> = {
              'clear': 'sol',
              'clouds': 'skyet',
              'rain': 'regn',
              'snow': 'sne',
              'drizzle': 'diset',
              'thunderstorm': 'torden',
              'mist': 'tåge',
              'fog': 'tåge'
            }
            
            const conditionsList = Array.from(conditions)
            const conditionsText = conditionsList.length > 0 
              ? conditionsList.map(c => weatherTranslations[c.toLowerCase()] || c.toLowerCase()).join(', ') 
              : 'varieret'
            
            // Format weather for today + tomorrow
            const untilText = 'i dag og i morgen'
            const tempText = `${Math.round(minTemp)}°C til ${Math.round(maxTemp)}°C`
            
            weatherForecast = JSON.stringify({
              city: location.city,
              until: untilText,
              temperature: tempText,
              conditions: conditionsText
            })
            console.log('✅ 24h forecast:', weatherForecast)
          }
        } else {
          console.warn('OPENWEATHER_API_KEY missing - using fallback weather')
          weatherInfo = 'Skønt vejr'
          weatherForecast = 'Varieret vejr'
        }
      } catch (e) {
        console.warn('Weather fetch failed:', e)
        weatherInfo = 'Skønt vejr'
        weatherForecast = 'Varieret vejr'
      }
    } else {
      console.warn('⚠️ No city found in location - cannot fetch weather')
    }

    // ── Determine season ──
    const month = new Date().getMonth() + 1
    const season = month <= 2 || month === 12 ? 'vinter'
      : month <= 5 ? 'forår'
      : month <= 8 ? 'sommer'
      : 'efterår'

    // ── Outdoor seating conditions ──
    const outdoorSuitability = hasOutdoorSeating && currentTemp >= 15 && windSpeedMs < 5 && isSunny
    const outdoorNote = hasOutdoorSeating
      ? (outdoorSuitability 
          ? 'Vi har udeservering - PERFEKT vejr til outdoor-opslag (15°C+, lav vind, sol)' 
          : `Vi har udeservering - men vejret passer IKKE til outdoor-opslag (temp: ${currentTemp}°C, vind: ${windSpeedMs.toFixed(1)} m/s, sol: ${isSunny ? 'ja' : 'nej'})`)
      : 'Ingen udeservering'

    // ── Fetch brand filter + tone (tier-specific) ──
    // For paid tiers: builds a brand filter block that tells GPT:
    //   1. Which idea types/occasions fit this brand (content_strategy.anchors)
    //   2. What to actively avoid (things_to_avoid + tone_model.avoid_examples)
    //   3. How to write the titles (tone_model.writing_rules or tone_of_voice.value)
    // For free tier: safe hospitality fallback written style only (no idea filtering)
    let toneInstructions = ''
    // New brand context variables (populated for paid tier below)
    let businessCharacterText = ''
    let targetAudienceText = ''
    let communicationGoalText = ''
    let identityKeywordsText = ''
    let venueIdentityText = ''
    let voiceRationaleText = ''

    if (isPaidTier) {
      const { data: brandProfile } = await supabase
        .from('business_brand_profile')
        .select('brand_essence, tone_of_voice, tone_keywords, tone_model, things_to_avoid, content_strategy, communication_goal, target_audience, identity_keywords, business_character, humor_level, voice_rationale, recognizable_interior_identity')
        .eq('business_id', businessId)
        .single()

      if (brandProfile) {
        const parts: string[] = []

        // ── 1. Brand identity anchor ──
        if (brandProfile.brand_essence) {
          const be = brandProfile.brand_essence as any
          const essenceText = typeof be === 'object' && be?.value ? String(be.value) : String(be || '')
          if (essenceText.trim()) {
            parts.push(`BRAND IDENTITET (hvad stedet ER — lad dette styre ide-valget):\n${essenceText.trim()}`)
          }
        }

        // ── 2. Natural social moments → idea selection filter ──
        // content_strategy.anchors (Pipeline B) is authoritative; tone_model.content_anchors is fallback
        let naturalMoments: string[] = []
        const cs = (brandProfile as any).content_strategy
        if (cs) {
          const csObj = typeof cs === 'string' ? (() => { try { return JSON.parse(cs) } catch { return null } })() : cs
          if (Array.isArray(csObj?.anchors) && csObj.anchors.length > 0) {
            naturalMoments = csObj.anchors.slice(0, 3)
          }
        }
        if (naturalMoments.length === 0 && brandProfile.tone_model) {
          const tm = brandProfile.tone_model as any
          if (Array.isArray(tm?.content_anchors) && tm.content_anchors.length > 0) {
            naturalMoments = tm.content_anchors.slice(0, 3)
          }
        }
        if (naturalMoments.length > 0) {
          parts.push(`PRIORITÉR IDEER OM (brandets naturlige sociale øjeblikke — fordel de 3 forslag herfra):\n${naturalMoments.map((m: string) => `- ${m}`).join('\n')}`)
        }

        // ── 3. Ideas to actively avoid ──
        let avoidIdeas: string[] = []
        if ((brandProfile as any).things_to_avoid) {
          const ta = (brandProfile as any).things_to_avoid as any
          if (typeof ta === 'object' && ta !== null) {
            if (Array.isArray(ta.tone_constraints)) avoidIdeas.push(...ta.tone_constraints.slice(0, 3))
            if (Array.isArray(ta.language_constraints)) avoidIdeas.push(...ta.language_constraints.slice(0, 2))
          } else if (typeof ta === 'string' && ta.trim()) {
            avoidIdeas.push(ta.trim())
          }
        }
        // tone_model.avoid_examples give GPT concrete phrase-level examples of what NOT to do
        const tm = brandProfile.tone_model as any
        const avoidExamples: string[] = Array.isArray(tm?.avoid_examples)
          ? tm.avoid_examples.filter((s: any) => typeof s === 'string').slice(0, 2)
          : []
        if (avoidIdeas.length > 0 || avoidExamples.length > 0) {
          const avoidLines = [
            ...avoidIdeas.map((a: string) => `- ${a}`),
            ...avoidExamples.map((a: string) => `- (eksempel at undgå) "${a}"`),
          ].slice(0, 5)
          parts.push(`UNDGÅ IDEER DER LYDER SOM:\n${avoidLines.join('\n')}`)
        }

        // ── 4. Writing style for titles and why_explanation ──
        // v5 format: tone_of_voice.value = string of 5 writing rules
        // legacy: tone_of_voice = {primary_tone, attributes, formality_level}
        let toneText = ''
        if (brandProfile.tone_of_voice) {
          const tov = brandProfile.tone_of_voice as any
          if (typeof tov === 'object' && tov !== null) {
            if (typeof tov.value === 'string' && tov.value.trim().length > 10) {
              toneText = tov.value.trim()
            } else {
              const p: string[] = []
              if (tov.primary_tone) p.push(tov.primary_tone)
              if (Array.isArray(tov.attributes) && tov.attributes.length > 0) p.push(tov.attributes.join(', '))
              if (tov.formality_level) p.push(`formalitet: ${tov.formality_level}`)
              toneText = p.join(' · ')
            }
          } else if (typeof brandProfile.tone_of_voice === 'string') {
            toneText = brandProfile.tone_of_voice
          }
        }
        // v5 tone_model.writing_rules are more precise than legacy tov fields
        if (Array.isArray(tm?.writing_rules) && tm.writing_rules.length > 0) {
          const rules = tm.writing_rules.filter((s: any) => typeof s === 'string').slice(0, 4)
          toneText = rules.map((r: string) => `- ${r}`).join('\n')
        }
        if (!toneText && Array.isArray(brandProfile.tone_keywords) && brandProfile.tone_keywords.length > 0) {
          toneText = (brandProfile.tone_keywords as string[]).join(', ')
        }
        if (toneText) {
          parts.push(`SKRIVESTIL (til titles og why_explanation):\n${toneText}`)
        }

        // ── 5. Business character (AI plain-text description) ──
        if ((brandProfile as any).business_character) {
          const bc = (brandProfile as any).business_character as any
          businessCharacterText = typeof bc === 'string' ? bc.trim()
            : (typeof bc === 'object' && bc?.value) ? String(bc.value).trim() : ''
        }

        // ── 6. Target audience ──
        if ((brandProfile as any).target_audience) {
          const ta = (brandProfile as any).target_audience as any
          if (typeof ta === 'object' && ta !== null) {
            const audienceParts: string[] = []
            if (ta.primary) audienceParts.push(ta.primary)
            if (Array.isArray(ta.segments) && ta.segments.length > 0) audienceParts.push(ta.segments.join(', '))
            targetAudienceText = audienceParts.join(' · ')
          } else if (typeof ta === 'string') {
            targetAudienceText = ta.trim()
          }
        }

        // ── 7. Communication goal ──
        if ((brandProfile as any).communication_goal) {
          const cg = (brandProfile as any).communication_goal as any
          communicationGoalText = typeof cg === 'string' ? cg.trim()
            : (typeof cg === 'object' && cg?.value) ? String(cg.value).trim()
            : (typeof cg === 'object' && cg?.primary) ? String(cg.primary).trim() : ''
        }

        // ── 8. Identity keywords ──
        if ((brandProfile as any).identity_keywords) {
          const ik = (brandProfile as any).identity_keywords as any
          if (Array.isArray(ik)) {
            identityKeywordsText = ik.slice(0, 5).join(', ')
          } else if (typeof ik === 'string') {
            identityKeywordsText = ik.trim()
          } else if (typeof ik === 'object' && ik !== null) {
            const arr = ik.keywords || ik.values || ik.items
            if (Array.isArray(arr)) identityKeywordsText = arr.slice(0, 5).join(', ')
          }
        }

        // ── 9. Venue identity (for atmosphere/BTS ideas) ──
        const riRaw = (brandProfile as any).recognizable_interior_identity
        if (riRaw) {
          venueIdentityText = typeof riRaw === 'string' ? riRaw.trim()
            : (typeof riRaw === 'object' && riRaw?.value) ? String(riRaw.value).trim() : ''
        }

        // ── 10. Voice rationale register guard (for atmosphere/BTS ideas) ──
        const vrRaw = (brandProfile as any).voice_rationale
        if (vrRaw && typeof vrRaw === 'string') voiceRationaleText = vrRaw.trim()

        if (parts.length > 0) {
          toneInstructions = '\n\n' + parts.join('\n\n')
          console.log(`✅ Brand filter built: ${naturalMoments.length} moments, ${avoidIdeas.length} avoids, tone: ${toneText ? 'yes' : 'no'}`)
        } else {
          console.log('⚠️ Paid tier: brand profile found but empty — using fallback')
        }
      }

      if (!toneInstructions) {
        console.log('⚠️ Paid tier but no brand profile found, using safe fallback')
        toneInstructions = `\n\nTONE OF VOICE:
- Formalitet: ${SAFE_HOSPITALITY_FALLBACK.formalityLevel}
- Tiltaleform: ${SAFE_HOSPITALITY_FALLBACK.addressForm}
- Sætningsstil: ${SAFE_HOSPITALITY_FALLBACK.sentenceStyle}
- Personlighed: ${SAFE_HOSPITALITY_FALLBACK.personalityTraits.join(', ')}`
      }
    } else {
      // Free tier: writing style only, no idea filtering
      toneInstructions = `\n\nTONE OF VOICE:
- Formalitet: ${SAFE_HOSPITALITY_FALLBACK.formalityLevel}
- Tiltaleform: ${SAFE_HOSPITALITY_FALLBACK.addressForm}
- Sætningsstil: ${SAFE_HOSPITALITY_FALLBACK.sentenceStyle}
- Personlighed: ${SAFE_HOSPITALITY_FALLBACK.personalityTraits.join(', ')}`
      console.log('✅ Free tier: Using safe hospitality fallback')
    }

    // ── Fetch recent suggestions to avoid repetition ──
    const { data: recentSuggestions, error: recentError } = await supabase
      .from('daily_suggestions')
      .select('title, content_type, photo_idea')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(9) // Last 3 times × 3 suggestions = 9 ideas
    
    let avoidSection = ''
    if (recentError) {
      console.warn('⚠️ Could not fetch recent suggestions:', recentError)
    } else if (recentSuggestions && recentSuggestions.length > 0) {
      const recentTitles = recentSuggestions
        .map((s: any) => `"${s.title}" (${s.content_type})`)
        .join(', ')
      avoidSection = `\n\nUNDGÅ DISSE TIDLIGERE IDÉER FOR SLOT B + SLOT C (lav noget ANDET i dag):
${recentTitles}

VIGTIGT: Lav NYE idéer der ikke ligner ovenstående. Tænk kreativt og anderledes!`
      console.log(`📋 Loaded ${recentSuggestions.length} recent suggestions to avoid repetition`)
    }

    // ── Fetch last 5 Slot A dish names specifically to prevent Slot A repetition ──
    const { data: recentSlotA } = await supabase
      .from('daily_suggestions')
      .select('menu_item_name, created_at')
      .eq('business_id', businessId)
      .eq('position', 1)
      .not('menu_item_name', 'is', null)
      .neq('menu_item_name', '')
      .order('created_at', { ascending: false })
      .limit(5)
    let recentSlotASection = ''
    if (recentSlotA && recentSlotA.length > 0) {
      const todayMs = Date.now()
      const recentDishes = recentSlotA.map((s: any) => {
        const daysAgo = Math.round((todayMs - new Date(s.created_at).getTime()) / (1000 * 60 * 60 * 24))
        return `${s.menu_item_name} (${daysAgo === 0 ? 'i dag' : daysAgo === 1 ? 'i går' : `${daysAgo} dage siden`})`
      }).join(', ')
      recentSlotASection = `\nSLOT A RETTER BRUGT NYLIGT — vælg IKKE disse (gæsterne har set dem):\n${recentDishes}\n`
      console.log(`📋 Recent Slot A dishes: ${recentDishes}`)
    }

    // ── Day-of-week context ──
    const todayDate = new Date()
    const dayNames = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag']
    const dayName = dayNames[todayDate.getDay()]
    const isWeekend = todayDate.getDay() === 0 || todayDate.getDay() === 6
    const weekendLabel = isWeekend ? 'ja' : 'nej'
    const dayBehavior = getDayBehavior(todayDate.getDay())
    const activeServicePeriod = isPaidTier ? deriveServicePeriod(todayOpenTime, todayCloseTime) : null
    const { slotB, slotC } = getSlotBCTypes((recentSuggestions || []) as RecentSuggestion[], dayBehavior)

    // ── Generate suggestions with Gemini ──
    const servicePeriodHint = activeServicePeriod && activeServicePeriod !== 'all_day'
      ? ` (serverer primært ${activeServicePeriod === 'dinner' ? 'aftensmad' : activeServicePeriod === 'brunch' ? 'brunch/morgenmad' : 'frokost'})`
      : ''

    let menuBlock: string
    if (menuCategoryEntries.length > 0) {
      // Structured format with all categories + ingredients — Gemini can match service period
      const servicePeriodGuide = activeServicePeriod && activeServicePeriod !== 'all_day'
        ? `\nService-periode i dag: ${activeServicePeriod === 'dinner' ? 'AFTENSMAD' : activeServicePeriod === 'brunch' ? 'BRUNCH/MORGENMAD' : 'FROKOST'} — prioritér retter fra denne kategori, men alle kategorier er gyldige valg.\n`
        : ''
      const categoryLines = menuCategoryEntries.map(cat => {
        const itemLines = cat.items.map(item =>
          item.description ? `  - ${item.name} (${item.description})` : `  - ${item.name}`
        ).join('\n')
        return `${cat.catName.toUpperCase()}:\n${itemLines}`
      }).join('\n\n')
      menuBlock = `Vælg ÉT konkret tilbud fra menukortet til Slot A:${servicePeriodGuide}\n${categoryLines}\n\nTilbud-tone i dag (${dayBehavior.danishMode}): ${dayBehavior.offeringTone}`
    } else if (signatureItems.length > 0) {
      menuBlock = `Vælg ÉT konkret tilbud fra denne liste til Slot A:\n${signatureItems.join(', ')}\nTilbud-tone i dag (${dayBehavior.danishMode}): ${dayBehavior.offeringTone}`
    } else {
      menuBlock = `Ingen menu-data — erstat Slot A med et ekstra gæstemoment (content_type: atmosphere, slot: "guest_moment")`
    }

    // Tier 3 facts to guide Slot B/C idea generation — NOT for text generation
    const menuIntelligenceBlock = menuIntelligenceFacts.length > 0
      ? `\n\n──── MENU KARAKTERISTIKA (til Slot B + C ide-valg) ────\nSærlige kendetegn der egner sig til indholdsideer — nævn dem som udgangspunkt for Slot B/C:\n${menuIntelligenceFacts.map(f => `- ${f}`).join('\n')}\n`
      : ''

    const prompt = `Du er social media manager for ${business.name} i ${location?.city || 'Danmark'}. Generer ${count} kreative post-ideer til i dag.

──── KONTEKST ────
Forretning: ${business.name}${location?.city ? `, ${location.city}` : ''}${servicePeriodHint}
Vejr: ${weatherInfo} | Sæson: ${season}
Dag: ${dayName} (${dayBehavior.danishMode}) | Weekend: ${weekendLabel}
Dagsstemning: ${dayBehavior.emphasis}
Udeservering: ${outdoorNote}
Bekræftede facts: Børnemenu: ${hasKidsMenu ? 'JA — børnerettet occasion tilladt' : 'NEJ — undgå ALDRIG ideer om børnemenu, børnemenuer, børn spiser med, eller familie-tilbud'}${businessCharacterText ? `\nStedets karakter: ${businessCharacterText}` : ''}${targetAudienceText ? `\nTypisk gæst: ${targetAudienceText}` : ''}${identityKeywordsText ? `\nNøgleord: ${identityKeywordsText}` : ''}${venueIdentityText ? `\nStedsdetaljer (faktuelle — brug til Slot B + C; opfind IKKE andre): ${venueIdentityText}` : ''}

──── MENU (Slot A – fast tilbud) ────
${menuBlock}${recentSlotASection}${menuIntelligenceBlock}${toneInstructions}${avoidSection}

──── 3-SLOT STRUKTUR (FAST RÆKKEFØLGE) ────
Generer præcis ${count} forslag i denne faste rækkefølge:

SLOT A – TILBUD (content_type: menu_item, slot: "offering")
  → VÆLG ÉN ret fra MENU-listen ovenfor — den ret du IKKE har brugt for nylig (se SLOT A RETTER BRUGT NYLIGT)
  → dish_text_brief: List rettens ingredienser/karakteristika direkte fra menulisten ovenfor. Inkluder ALLE ingredienser medmindre retten har 7+ komponenter — vælg da de 5-6 mest visuelle eller smags-definerende (undgå generiske: "sauce", "salat", "brød" — foretræk specifikke: "syltede rødløg", "24h-marineret kylling"). Tom streng "" for ikke-menu slots.
  → Vælg KUN egentlige måltider (forret, main, dessert, brunch-ret) — IKKE snacks, nibbles, dips, nachos, chips, eller retter der primært serveres som tilbehør til drinks. Sådanne retter giver ikke gæsten grund til at komme ind alene.
  → Led med gæstesituationen, bring retten som det aktive substantiv i titlen
  → FORMAT-EKSEMPLER (erstat [RET] med din valgte ret fra menuen — brug IKKE pariserbøf medmindre menuen udelukkende har den):
    "[RET] og en times pause"
    "To tallerkener [RET] til middag"
    "Frokosttid: [RET] klar nu"
  → LOKATION I TITLEN: brug KUN stednavnet/udeservering hvis det ændrer gæstens valg (fx "udeservering i dag" på en celosol dag). Aldrig location som stemnings-suffiks — "ved åen", "hos os", "i byen" tilfører intet kommercielt argument.
  → FORBUDT FORMAT: passiv verbum ("serveres", "forberedes", "tilbydes"), kolon der opdeler titlen, punktum i titlen
  → EN sammenhængende titre, ikke to dele
  → Tilbud-tone: ${dayBehavior.offeringTone}

SLOT B – GÆSTEMOMENT (content_type: atmosphere, slot: "guest_moment")
  → Scenarie-type i dag: ${slotB}
  → Et specifikt besøgsscenarie baseret på: ${dayBehavior.emphasis}
  → Vis stedet fra gæstens perspektiv — lys, atmosfære, det sociale øjeblik${venueIdentityText ? `\n  → Faktiske stedsdetaljer at skrive om: ${venueIdentityText}` : ''}${voiceRationaleText ? `\n  → 🚫 REGISTERVAGT: ${voiceRationaleText}` : ''}

SLOT C – BRAND/BAG FACADEN (content_type: ${slotC === 'behind_scenes' ? 'behind_scenes' : 'atmosphere'}, slot: "brand_behind")
  → ${slotC === 'behind_scenes' ? 'Vis hvad der sker bag kulisserne, teamet eller forberedelserne — TITLEN skal være aktiv og konkret, ikke passiv (FORBUDT: "Klassikere forberedes", "Retter tilberedes", "Dagen forberedes")' : 'Stedstemning, vibe, årstid, lys — et poetisk øjeblik der viser stedets sjæl — TITLEN skal beskrive hvad der sker/er der, ikke hvad der passivt foregår'}${voiceRationaleText ? `\n  → 🚫 REGISTERVAGT: ${voiceRationaleText}` : ''}

──── SKRIVESTIL + REGLER ────
⛔ ABSOLUTE TITLE REGLER (gælder alle 3 slots uden undtagelse):
- INGEN punktum i titlen — aldrig. "Klassikere forberedes. Dagen starter" = fejl.
- INGEN kolon der opdeler titlen i to dele — "Onsdagspause: Pariserbøf ved åen" = fejl.
- INGEN subjekt + intransitivt verbum som eneste information — "Aftenstemning venter", "Åen flyder", "Hyggen kalder", "Æggekage venter", "Sulten kalder" = fejl. Hverken mad-substantiver eller abstrakte substantiver må stå alene med "venter", "kalder", "lokker", "flyder".
- EN sammenhængende titel, ikke to mini-sætninger.
1. Title: 3–7 ord, naturligt dansk, aktiv konstruktion, ikke passiv. Følg brand-filterets skrivestil præcist.
2. Why_explanation: 2–3 sætninger som erfaren social media manager${communicationGoalText ? ` — forankr forklaringen i brandets kommunikationsmål: "${communicationGoalText}"` : ''}. Brug naturligt, moderne dansk (IKKE oversat/stift). Forklar den strategiske pointe. For menu_item-slots KRAV: mindst én sætning skal forankre HVORFOR denne specifikke ret er det rigtige valg netop i dag — brug ingrediens, sæson, service-periode eller anledning som argument. Dagsstemning alene ("midt på ugen", "en pause i hverdagen") er ikke tilstrækkeligt — det skal kombineres med noget konkret om retten eller tidspunktet. FORBUDT i why_explanation for menu_item-slots: stedets navn, stedets lokation, "ved åen", "hos os", "i [by]" — why_explanation handler om RETTEN og TIMINGEN, ikke om stedet.
3. Media_suggestion: Anbefal det bedste medie for dette opslag. Standard er altid ét foto. Skriv som en trin-for-trin guide til en ikke-professionel der bruger sit kamera eller mobiltelefon — 3 korte imperativ-sætninger: (1) placering og vinkel (overhead/45°/øjenhøjde + afstand), (2) lys-tip (gå hen til vinduet, hold lyset forfra/fra siden osv.), (3) hvad der konkret skal fylde rammen (motiv, eventuel rekvisit eller kontekstdetalje). Vær specifik for DETTE opslag — IKKE "fang stemningen", IKKE "vis retten frem", IKKE generiske råd der passer til alt. Vurder om content_type og slot giver særlig grund til at anbefale en alternativ — carousel (2-4 billeder) hvis retten har tydelig visuel progression (f.eks. ost der flyder, dessert der skæres), eller kort video (5-10 sek) hvis bevægelse er kerneattrakt (f.eks. skum på kaffe, flambe, levende musik). Angiv:
   - primary: altid "photo" — 3 korte, konkrete sætninger (vinkel · lys · motiv), specifik for dette opslag
   - alternatives: kun hvis der er reel grund — array med {type: "carousel"|"reel", instruction: "..."} (tom array [] hvis ingen god grund til alternativ)
4. KUN 1 forslag må eksplicit nævne vejr/temperatur
5. Udeservering: KUN foreslå hvis "PERFEKT vejr" er angivet ovenfor
6. UNDGÅ i titles: "lækker", "hyggelig", "autentisk", "unik", "hjertevarmt"

Svar KUN med JSON-array (præcis ${count} objekter i slot-rækkefølge: offering → guest_moment → brand_behind):
[
  {
    "title": "Kort post-titel",
    "menu_item_name": "Præcist rettnavn fra menulisten (KUN for content_type menu_item — tom streng for de andre)",
    "dish_text_brief": "Ingredienser/karakteristika for valgt ret (KUN for menu_item — se Slot A-regel ovenfor — tom streng for øvrige)",
    "why_explanation": "Strategisk forklaring (2-3 sætninger)",
    "media_suggestion": {
      "primary": { "type": "photo", "instruction": "Hold telefonen lodret over retten i 60-70 cm højde. Gå hen til det nærmeste vindue så lyset falder skråt fra siden. Fyld 80% af rammen med retten — læg tallerkenen lidt off-center og lad bordet udgøre baggrunden." },
      "alternatives": []
    },
    "content_type": "menu_item",
    "slot": "offering"
  }
]`

    // Call Gemini API directly
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: 'Du er en erfaren social media manager for lokale virksomheder. Svar KUN med et gyldigt JSON-array som specificeret. Ingen markdown, ingen forklaring, ingen kommentarer uden for JSON.' }]
          },
          contents: [{
            role: 'user',
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json'
          }
        })
      }
    )

    if (!geminiResponse.ok) {
      const error = await geminiResponse.text()
      console.error('Gemini API Error:', error)
      throw new Error(`Gemini API failed: ${geminiResponse.status}`)
    }

    const geminiData = await geminiResponse.json()
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text

    if (!responseText) {
      throw new Error('No response from Gemini API')
    }

    let suggestions
    try {
      // Strip markdown code fences if Gemini wraps the JSON despite responseMimeType setting
      const cleanText = responseText.trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
      // If the cleaned text doesn't start with '[' or '{', try to extract the JSON array
      const jsonStart = cleanText.indexOf('[')
      const jsonEnd = cleanText.lastIndexOf(']')
      const jsonText = jsonStart >= 0 && jsonEnd > jsonStart
        ? cleanText.slice(jsonStart, jsonEnd + 1)
        : cleanText
      suggestions = JSON.parse(jsonText)
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', responseText.substring(0, 500))
      
      // Fallback: return generic suggestions — these are last-resort placeholders
      const fallbackItemName = signatureItems[0] || ''
      suggestions = [
        {
          title: fallbackItemName ? `${fallbackItemName} i dag` : 'Dagens ret er klar',
          rationale: fallbackItemName ? `${fallbackItemName} er et godt valg til netop dette tidspunkt på dagen.` : 'Del dagens tilbud med dine følgere.',
          why_explanation: fallbackItemName ? `${fallbackItemName} er et godt valg til netop dette tidspunkt på dagen.` : 'Del dagens tilbud med dine følgere.',
          content_type: 'menu_item',
          slot: 'offering',
          suggested_time: getContentAwareTime('menu_item', fallbackItemName, todayOpenTime)
        },
        {
          title: 'Et øjeblik på stedet',
          rationale: 'Giv følgerne et indblik i stemningen hos jer.',
          why_explanation: 'Giv følgerne et indblik i stemningen hos jer.',
          content_type: 'atmosphere',
          slot: 'guest_moment',
          suggested_time: getContentAwareTime('atmosphere', '', todayOpenTime)
        },
        {
          title: 'Bag om oplevelsen',
          rationale: 'Vis hvad der sker bag kulisserne hos jer i dag.',
          why_explanation: 'Vis hvad der sker bag kulisserne hos jer i dag.',
          content_type: 'behind_scenes',
          slot: 'brand_behind',
          suggested_time: getContentAwareTime('behind_scenes', '', todayOpenTime)
        }
      ]
      console.log('Using fallback suggestions due to parse error')
    }

    // ── Save suggestions to database ──
    // Preserve menu_item_name + descriptions from Gemini response before DB save overwrites the array.
    // dish_text_brief is the Gemini-curated ingredient list — it takes priority over the raw DB description.
    const menuItemNames: Record<number, string> = {}
    const menuItemDescriptions: Record<number, string> = {}
    const dishTextBriefs: Record<number, string> = {}
    suggestions.slice(0, count).forEach((s: any, idx: number) => {
      if (s.menu_item_name) {
        menuItemNames[idx] = s.menu_item_name
        menuItemDescriptions[idx] = menuDescriptionMap.get(s.menu_item_name) || ''
      }
      if (s.dish_text_brief) {
        dishTextBriefs[idx] = s.dish_text_brief
      }
    })

    const slotForPosition = (pos: number) => pos === 1 ? 'offering' : pos === 2 ? 'guest_moment' : 'brand_behind'
    const suggestionRows = suggestions.slice(0, count).map((s: any, idx: number) => ({
      business_id: businessId,
      title: s.title,
      rationale: s.rationale || s.why_explanation || '',
      why_explanation: s.why_explanation || '',
      photo_idea: s.media_suggestion?.primary?.instruction || s.photo_idea || '',
      content_type: s.content_type,
      suggested_time: getContentAwareTime(s.content_type || 'atmosphere', s.title || '', todayOpenTime),
      date: today,
      position: idx + 1,
      is_active: true,
      weather_forecast: weatherForecast ? JSON.parse(weatherForecast) : null,
      menu_item_name: menuItemNames[idx] || '',
      menu_item_description: dishTextBriefs[idx] || menuItemDescriptions[idx] || '',
      caption_base: ['menu_item', 'product_menu', 'craving_visual'].includes(s.content_type) ? (dishTextBriefs[idx] || menuItemDescriptions[idx] || '') : '',
      cta_intent: s.slot === 'guest_moment' ? 'social' : s.slot === 'brand_behind' ? 'engagement' : 'visit'
    }))

    console.log('💾 Attempting to save suggestions:', { count: suggestionRows.length, businessId, date: today })

    const { data: savedSuggestions, error: saveError } = await supabase
      .from('daily_suggestions')
      .insert(suggestionRows)
      .select('id, title, rationale, why_explanation, photo_idea, content_type, suggested_time, menu_item_name, menu_item_description, caption_base, cta_intent')

    if (saveError) {
      console.error('❌ Failed to save suggestions:', {
        code: saveError.code,
        message: saveError.message,
        details: saveError.details,
        hint: saveError.hint
      })
      // Return suggestions anyway even if save failed
    } else {
      console.log(`✅ Successfully saved ${savedSuggestions?.length || 0} suggestions to cache`)
      // Use saved suggestions with IDs
      if (savedSuggestions && savedSuggestions.length > 0) {
        suggestions = savedSuggestions
      }
    }

    // Ensure slot field is present on every suggestion (inferred from position)
    // Re-attach grounding fields — DB values take priority if insert succeeded, else use in-memory maps
    const finalSuggestions = suggestions.map((s: any, idx: number) => ({
      ...s,
      slot: s.slot || slotForPosition(s.position || idx + 1),
      menu_item_name: s.menu_item_name || menuItemNames[idx] || '',
      menu_item_description: s.menu_item_description || dishTextBriefs[idx] || menuItemDescriptions[idx] || '',
      caption_base: s.caption_base || (['menu_item', 'product_menu', 'craving_visual'].includes(s.content_type) ? (dishTextBriefs[idx] || menuItemDescriptions[idx] || '') : ''),
      cta_intent: s.cta_intent || (s.slot === 'guest_moment' ? 'social' : s.slot === 'brand_behind' ? 'engagement' : 'visit'),
      media_suggestion: s.media_suggestion || null,
      suggestion_date: today
    }))

    // ── Increment daily quota counter for all tiers ──
    try {
      // Fetch current count
      const { data: currentBiz } = await supabase
        .from('businesses')
        .select('quick_suggestions_today')
        .eq('id', businessId)
        .single()
      
      const newCount = (currentBiz?.quick_suggestions_today || 0) + 1
      
      const { error: incrementError } = await supabase
        .from('businesses')
        .update({ quick_suggestions_today: newCount })
        .eq('id', businessId)
      
      if (!incrementError) {
        console.log(`📊 Incremented quick_suggestions_today counter to ${newCount}`)
      } else {
        console.warn('⚠️ Failed to increment counter:', incrementError)
      }
    } catch (e) {
      console.warn('⚠️ Error incrementing counter:', e)
    }

    return new Response(JSON.stringify({ suggestions: finalSuggestions, cached: false, weatherForecast }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('get-quick-suggestions error:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to generate suggestions',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
