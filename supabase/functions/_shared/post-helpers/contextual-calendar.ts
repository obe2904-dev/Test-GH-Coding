/**
 * Contextual Calendar Service
 * 
 * Fetches country-specific events, holidays, vacations, and seasonal context
 * for AI content generation. Works alongside weather data to provide
 * comprehensive temporal context.
 */

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.39.0'

export interface ContextualEvent {
  eventType: 'holiday' | 'school_vacation' | 'season' | 'cultural' | 'business_rhythm'
  eventName: string
  dateStart: string // YYYY-MM-DD
  dateEnd: string | null
  relevanceTags: string[] // ['families', 'couples', 'outdoor', etc.]
  contentAngle: string | null
  marketingHook: string | null
}

export interface ContextualCalendarContext {
  events: ContextualEvent[]
  formatted: string // Human-readable summary for AI prompt
  opportunities: string[] // Key promotional opportunities
  warnings: string[] // Things to watch out for
}

/**
 * Fetch contextual events for a date range
 */
export async function getContextualEvents(
  supabase: SupabaseClient,
  country: string,
  startDate: Date,
  endDate: Date,
  relevanceTags?: string[]
): Promise<ContextualEvent[]> {
  try {
    // Format dates as YYYY-MM-DD
    const start = startDate.toISOString().split('T')[0]
    const end = endDate.toISOString().split('T')[0]
    
    // Call database function
    const { data, error } = await supabase.rpc('get_contextual_events', {
      p_country: country,
      p_start_date: start,
      p_end_date: end,
      p_tags: relevanceTags || null
    })
    
    if (error) {
      console.error('Error fetching contextual events:', error)
      return []
    }
    
    if (!data || !Array.isArray(data)) {
      return []
    }
    
    // Map to TypeScript interface
    return data.map(event => ({
      eventType: event.event_type,
      eventName: event.event_name,
      dateStart: event.date_start,
      dateEnd: event.date_end,
      relevanceTags: event.relevance_tags || [],
      contentAngle: event.content_angle,
      marketingHook: event.marketing_hook
    }))
    
  } catch (error) {
    console.error('Failed to fetch contextual events:', error)
    return []
  }
}

/**
 * Build full contextual calendar context for AI prompts
 */
export async function buildContextualCalendarContext(
  supabase: SupabaseClient,
  country: string,
  startDate: Date,
  endDate: Date,
  relevanceTags?: string[]
): Promise<ContextualCalendarContext> {
  const events = await getContextualEvents(supabase, country, startDate, endDate, relevanceTags)
  
  if (events.length === 0) {
    return {
      events: [],
      formatted: '',
      opportunities: [],
      warnings: []
    }
  }
  
  // Analyze events for opportunities and warnings
  const opportunities: string[] = []
  const warnings: string[] = []
  
  for (const event of events) {
    if (event.marketingHook) {
      opportunities.push(`${event.eventName}: ${event.marketingHook}`)
    }
    
    // Extract warnings from content angle
    if (event.contentAngle && event.contentAngle.toLowerCase().includes('watch out')) {
      const warningMatch = event.contentAngle.match(/watch out:([^,]+)/i)
      if (warningMatch) {
        warnings.push(`${event.eventName}: ${warningMatch[1].trim()}`)
      }
    }
  }
  
  // Format for AI prompt
  const formatted = formatEventsForPrompt(events, startDate, endDate)
  
  return {
    events,
    formatted,
    opportunities,
    warnings
  }
}

/**
 * Format events into human-readable text for AI prompts
 */
function formatEventsForPrompt(events: ContextualEvent[], startDate: Date, endDate: Date): string {
  if (events.length === 0) return ''
  
  const lines: string[] = []
  lines.push(`📅 CONTEXTUAL CALENDAR (${formatDate(startDate)} - ${formatDate(endDate)}):`)
  lines.push('')
  
  // Group events by type
  const byType: Record<string, ContextualEvent[]> = {
    holiday: [],
    school_vacation: [],
    season: [],
    cultural: [],
    business_rhythm: []
  }
  
  for (const event of events) {
    byType[event.eventType].push(event)
  }
  
  // Format each group
  if (byType.holiday.length > 0) {
    lines.push('🏛️ PUBLIC HOLIDAYS:')
    for (const event of byType.holiday) {
      lines.push(`   • ${event.eventName} (${formatDate(new Date(event.dateStart))})`)
      if (event.contentAngle) {
        lines.push(`     ${event.contentAngle}`)
      }
    }
    lines.push('')
  }
  
  if (byType.school_vacation.length > 0) {
    lines.push('🎒 SCHOOL VACATIONS:')
    for (const event of byType.school_vacation) {
      const duration = event.dateEnd 
        ? `${formatDate(new Date(event.dateStart))} - ${formatDate(new Date(event.dateEnd))}`
        : formatDate(new Date(event.dateStart))
      lines.push(`   • ${event.eventName} (${duration})`)
      if (event.contentAngle) {
        lines.push(`     ${event.contentAngle}`)
      }
    }
    lines.push('')
  }
  
  if (byType.season.length > 0) {
    lines.push('🌍 SEASONAL CONTEXT:')
    for (const event of byType.season) {
      lines.push(`   • ${event.eventName}`)
      if (event.contentAngle) {
        lines.push(`     ${event.contentAngle}`)
      }
    }
    lines.push('')
  }
  
  if (byType.cultural.length > 0) {
    lines.push('🎉 CULTURAL EVENTS:')
    for (const event of byType.cultural) {
      lines.push(`   • ${event.eventName} (${formatDate(new Date(event.dateStart))})`)
      if (event.marketingHook) {
        lines.push(`     💡 ${event.marketingHook}`)
      }
    }
    lines.push('')
  }
  
  if (byType.business_rhythm.length > 0) {
    lines.push('📊 BUSINESS RHYTHMS:')
    for (const event of byType.business_rhythm) {
      lines.push(`   • ${event.eventName}`)
      if (event.contentAngle) {
        lines.push(`     ${event.contentAngle}`)
      }
    }
    lines.push('')
  }
  
  return lines.join('\n')
}

/**
 * Format date in Danish style: "14. feb"
 */
function formatDate(date: Date): string {
  const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  const day = date.getDate()
  const month = months[date.getMonth()]
  return `${day}. ${month}`
}

/**
 * Get events happening TODAY specifically
 */
export async function getTodaysEvents(
  supabase: SupabaseClient,
  country: string,
  relevanceTags?: string[]
): Promise<ContextualEvent[]> {
  const today = new Date()
  return getContextualEvents(supabase, country, today, today, relevanceTags)
}

/**
 * Get events for the next N days
 */
export async function getUpcomingEvents(
  supabase: SupabaseClient,
  country: string,
  days: number = 7,
  relevanceTags?: string[]
): Promise<ContextualEvent[]> {
  const today = new Date()
  const future = new Date()
  future.setDate(today.getDate() + days)
  
  return getContextualEvents(supabase, country, today, future, relevanceTags)
}
