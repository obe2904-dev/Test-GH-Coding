/**
 * 🤖 ENHANCED AI CONTEXT SERVICE
 * 
 * Gathers comprehensive business context for AI-powered idea generation.
 * Includes brand voice, offerings, weather, holidays, and post history.
 */

import { supabase } from '../lib/supabase'
import { getUpcomingHolidays, getCurrentSeason } from '../config/danish-holidays'
import { getWeather } from '../services/weatherService'
import type { Database } from '../types/supabase'
import type { BrandProfileForAI } from '../features/aiPromptBuilder'

type BusinessBrandProfile = Database['public']['Tables']['business_brand_profile']['Row']

export interface EnhancedAIContext {
  // Brand Profile
  brandVoice?: {
    essence: string | null
    toneOfVoice: string | null
    socialStyle: any
    voiceExamples: any
    thingsToAvoid: string | null
    toneModel: any
    contentPillars: any
  }
  
  // Business Data
  offerings?: {
    categories: Array<{
      name: string
      items: Array<{ name: string; popular?: boolean }>
    }>
  }
  openingHours?: any
  
  // Environmental Context
  weather?: {
    summary: string
    temperature?: number
    condition?: string
  }
  
  // Seasonal Context
  holidays?: Array<{
    name: string
    contentIdeas: string[]
  }>
  season?: { name: string; nameEn: string }
  
  // Post History (avoid repetition)
  recentPostSummaries?: string[]
  
  // Formatted for prompt
  formattedContext: string
}

/**
 * Fetch brand profile for a business
 */
async function fetchBrandProfile(businessId: string): Promise<BusinessBrandProfile | null> {
  try {
    const { data, error } = await supabase
      .from('business_brand_profile')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle()
    
    if (error) {
      console.warn('Could not fetch brand profile:', error.message)
      return null
    }
    return data
  } catch (e) {
    console.warn('Brand profile fetch error:', e)
    return null
  }
}

/**
 * Map database brand profile to BrandProfileForAI format
 * This is the canonical mapping - never hard-code brand assumptions elsewhere
 */
export function mapToBrandProfileForAI(dbProfile: BusinessBrandProfile | null): BrandProfileForAI | null {
  if (!dbProfile) return null
  
  // Check if any meaningful data exists
  // NOTE: brand_essence deprecated - use signature_themes from menu intelligence instead
  const hasData = dbProfile.tone_of_voice || 
                  dbProfile.target_audience ||
                  dbProfile.core_offerings ||
                  dbProfile.things_to_avoid ||
                  dbProfile.content_focus ||
                  dbProfile.communication_goal ||
                  dbProfile.image_preferences ||
                  dbProfile.tone_model ||
                  (dbProfile as any).signature_themes  // Menu intelligence
  
  if (!hasData) return null

  // (content_pillars_jsonb was dropped April 2026 — content_strategy is the canonical field)
  const contentPillars: string[] | null = null

  return {
    // DEPRECATED: brandEssence removed - use signature_themes from menu intelligence
    brandEssence: undefined,
    identityKeywords: (typeof dbProfile.identity_keywords === 'string' ? dbProfile.identity_keywords.split(',').map(k => k.trim()) : null),
    voiceConstraints: dbProfile.voice_constraints ?? null,
    toneOfVoice: (Array.isArray(dbProfile.tone_of_voice) ? (dbProfile.tone_of_voice as string[]).join(', ') : (typeof dbProfile.tone_of_voice === 'string' ? dbProfile.tone_of_voice : undefined)),
    thingsToAvoid: (typeof dbProfile.things_to_avoid === 'string' ? dbProfile.things_to_avoid : undefined),
    targetAudience: (typeof dbProfile.target_audience === 'string' ? dbProfile.target_audience : undefined),
    coreOfferings: (typeof dbProfile.core_offerings === 'string' || Array.isArray(dbProfile.core_offerings) ? dbProfile.core_offerings : undefined),
    contentFocus: (typeof dbProfile.content_focus === 'string' ? dbProfile.content_focus : undefined),
    communicationGoal: (typeof dbProfile.communication_goal === 'string' ? dbProfile.communication_goal : undefined),
    imagePreferences: (typeof dbProfile.image_preferences === 'string' ? dbProfile.image_preferences : undefined),
    toneModel: (dbProfile.tone_model as BrandProfileForAI['toneModel']) ?? null,
    contentPillars: contentPillars,
    socialStyle: (dbProfile.social_style as BrandProfileForAI['socialStyle']) ?? null,
    voiceExamples: (dbProfile.voice_examples as BrandProfileForAI['voiceExamples']) ?? null,
    locationIntelligence: (dbProfile.location_intelligence as BrandProfileForAI['locationIntelligence']) ?? null,
    signaturePhrases: ((dbProfile as any).signature_phrases as string[] | null) ?? null,
  }
}

/**
 * Fetch brand profile for AI prompt (standalone function for direct use)
 */
export async function fetchBrandProfileForAI(businessId: string): Promise<BrandProfileForAI | null> {
  const dbProfile = await fetchBrandProfile(businessId)
  return mapToBrandProfileForAI(dbProfile)
}

/**
 * Fetch recent posts for a user (last 10 days)
 */
async function fetchRecentPosts(userId: string): Promise<string[]> {
  try {
    const tenDaysAgo = new Date()
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)
    
    const { data, error } = await (supabase as any)
      .from('post_ideas')
      .select('caption')
      .eq('business_id', userId)
      .gte('updated_at', tenDaysAgo.toISOString())
      .order('updated_at', { ascending: false })
      .limit(10)
    
    if (error || !data) {
      return []
    }
    
    // Extract text content summaries from post_content JSONB
    const summaries: string[] = []
    for (const row of data as any[]) {
      if (row.post_content) {
        const content = row.post_content as any
        // Get first 50 chars of text for summary
        if (content.text) {
          summaries.push(content.text.substring(0, 80))
        } else if (content.headline) {
          summaries.push(content.headline)
        }
      }
    }
    
    return summaries.slice(0, 5) // Return max 5 summaries
  } catch (e) {
    console.warn('Recent posts fetch error:', e)
    return []
  }
}

/**
 * Gather all enhanced context for AI prompt generation
 */
export async function gatherEnhancedAIContext(
  businessId: string,
  userId: string,
  city?: string | null,
  countryCode: string = 'DK'
): Promise<EnhancedAIContext> {
  const context: EnhancedAIContext = {
    formattedContext: ''
  }
  
  // Gather data in parallel
  const [
    brandProfile,
    recentPosts,
    weatherData,
  ] = await Promise.all([
    fetchBrandProfile(businessId),
    fetchRecentPosts(userId),
    city ? getWeather(city, countryCode) : Promise.resolve({ current: null, summary: '' }),
  ])
  
  // Process Brand Profile
  if (brandProfile) {
    context.brandVoice = {
      // DEPRECATED: essence removed - use signature_themes from menu intelligence
      essence: null,
      toneOfVoice: brandProfile.tone_of_voice,
      socialStyle: brandProfile.social_style,
      voiceExamples: brandProfile.voice_examples,
      thingsToAvoid: brandProfile.things_to_avoid,
      toneModel: brandProfile.tone_model ?? null,
      contentPillars: null,
    }
  }
  
  // Process Weather
  if (weatherData.current) {
    context.weather = {
      summary: weatherData.summary,
      temperature: weatherData.current.temperature,
      condition: weatherData.current.conditionDa
    }
  }
  
  // Get upcoming holidays
  const holidays = getUpcomingHolidays(new Date(), 14, 3)
  if (holidays.length > 0) {
    context.holidays = holidays.map(h => ({
      name: h.name,
      contentIdeas: h.contentIdeas
    }))
  }
  
  // Get current season
  context.season = getCurrentSeason()
  
  // Process recent posts
  if (recentPosts.length > 0) {
    context.recentPostSummaries = recentPosts
  }
  
  // Build formatted context string for AI prompt
  context.formattedContext = buildFormattedContext(context)
  
  return context
}

/**
 * Build formatted context string for AI prompt
 */
function buildFormattedContext(context: EnhancedAIContext): string {
  const sections: string[] = []
  
  // Brand Voice Section
  if (context.brandVoice) {
    const bv = context.brandVoice
    const brandLines: string[] = ['BRAND VOICE:']
    
    if (bv.essence) brandLines.push(`- Brand Essence: ${bv.essence}`)
    if (bv.toneOfVoice) brandLines.push(`- Tone: ${bv.toneOfVoice}`)
    if (bv.thingsToAvoid) brandLines.push(`- Avoid: ${bv.thingsToAvoid}`)
    
    // Voice examples
    if (bv.voiceExamples) {
      const examples = bv.voiceExamples as any
      if (examples.headlines?.length > 0) {
        brandLines.push(`- Example Headlines: "${examples.headlines.slice(0, 2).join('", "')}"`)
      }
      if (examples.phrases?.length > 0) {
        brandLines.push(`- Signature Phrases: "${examples.phrases.slice(0, 2).join('", "')}"`)
      }
    }
    
    // Social style
    if (bv.socialStyle) {
      const style = bv.socialStyle as any
      if (style.emojiUsage) brandLines.push(`- Emoji Usage: ${style.emojiUsage}`)
      if (style.hashtagStrategy) brandLines.push(`- Hashtag Strategy: ${style.hashtagStrategy}`)
    }

    // Tone model details
    if (bv.toneModel) {
      const tm = bv.toneModel as any
      if (tm.emoji_level) brandLines.push(`- Emoji Level: ${tm.emoji_level}`)
      if (tm.formality) brandLines.push(`- Formality: ${tm.formality}`)
      if (tm.writing_rules?.length > 0) brandLines.push(`- Writing Rules: ${tm.writing_rules.join(' | ')}`)
      if (tm.good_examples?.length > 0) brandLines.push(`- Good Examples: "${tm.good_examples.slice(0, 2).join('", "')}"`)
      if (tm.avoid_examples?.length > 0) brandLines.push(`- Avoid: "${tm.avoid_examples.slice(0, 3).join('", "')}"`)
    }

    // Content pillars
    if (bv.contentPillars) {
      const pillars = Array.isArray(bv.contentPillars) ? bv.contentPillars : (bv.contentPillars as any)?.pillars
      if (pillars?.length > 0) {
        brandLines.push(`- Content Pillars: ${(pillars as string[]).slice(0, 5).join(', ')}`)
      }
    }
    
    if (brandLines.length > 1) {
      sections.push(brandLines.join('\n'))
    }
  }
  
  // Weather Section
  if (context.weather?.summary) {
    sections.push(context.weather.summary)
  }
  
  // Holidays Section
  if (context.holidays && context.holidays.length > 0) {
    const holidayLines = ['UPCOMING HOLIDAYS/EVENTS:']
    context.holidays.forEach(h => {
      holidayLines.push(`- ${h.name}: ${h.contentIdeas.slice(0, 2).join(', ')}`)
    })
    sections.push(holidayLines.join('\n'))
  }
  
  // Season Section
  if (context.season) {
    sections.push(`CURRENT SEASON: ${context.season.name} (${context.season.nameEn})`)
  }
  
  // Recent Posts (to avoid repetition)
  if (context.recentPostSummaries && context.recentPostSummaries.length > 0) {
    const recentLines = ['RECENT POSTS (avoid similar topics):']
    context.recentPostSummaries.forEach((summary, i) => {
      recentLines.push(`${i + 1}. ${summary}...`)
    })
    sections.push(recentLines.join('\n'))
  }
  
  return sections.join('\n\n')
}

/**
 * Format offerings for prompt
 * Handles multiple formats:
 * - { categories: [...] } (standard format)
 * - [...] (array of categories from menu_structure)
 * - { menuStructure: [...] } (from website analysis offerings)
 * - JSON string of any of the above
 * 
 * Menu structure format: { name: string, timeRange: string | null, items: string[] }
 */
export function formatOfferingsForPrompt(offerings: any): string {
  if (!offerings) return ''
  
  // Parse if it's a JSON string
  let parsedOfferings = offerings
  if (typeof offerings === 'string') {
    try {
      parsedOfferings = JSON.parse(offerings)
    } catch (e) {
      console.log('[formatOfferingsForPrompt] Failed to parse offerings string')
      return ''
    }
  }
  
  // Normalize to array of categories
  let categories: any[] = []
  
  if (Array.isArray(parsedOfferings)) {
    // Direct array of categories (from menu_structure column)
    categories = parsedOfferings
  } else if (parsedOfferings.categories && Array.isArray(parsedOfferings.categories)) {
    // Standard { categories: [...] } format
    categories = parsedOfferings.categories
  } else if (parsedOfferings.menuStructure && Array.isArray(parsedOfferings.menuStructure)) {
    // From website analysis { menuStructure: [...] }
    categories = parsedOfferings.menuStructure
  }
  
  // DIAGNOSTIC: Log what we found
  console.log('[formatOfferingsForPrompt] Categories found:', categories.length)
  if (categories.length > 0) {
    console.log('[formatOfferingsForPrompt] First category:', JSON.stringify(categories[0]).slice(0, 200))
  }
  
  if (categories.length === 0) {
    return ''
  }
  
  const lines: string[] = [
    '═══════════════════════════════════════',
    '📋 MENU ITEMS (COPY THESE EXACT NAMES INTO POSTS):',
    '═══════════════════════════════════════'
  ]
  
  for (const category of categories.slice(0, 5)) {
    // Items can be strings or objects with name property
    const items = category.items || []
    if (!Array.isArray(items) || items.length === 0) continue
    
    // Get up to 5 items per category, handling both string[] and object[]
    const itemNames = items.slice(0, 5).map((item: any) => {
      if (typeof item === 'string') return item
      if (item && item.name) return item.name
      return null
    }).filter(Boolean)
    
    if (itemNames.length > 0) {
      const categoryName = category.name || 'Menu'
      const timeInfo = category.timeRange ? ` (${category.timeRange})` : ''
      lines.push(`• ${categoryName}${timeInfo}: ${itemNames.join(', ')}`)
    }
  }
  
  // DIAGNOSTIC: Log the final output
  console.log('[formatOfferingsForPrompt] Output lines:', lines.length)
  
  return lines.length > 1 ? lines.join('\n') : ''
}

/**
 * Format opening hours for prompt (simplified)
 */
export function formatOpeningHoursForPrompt(hours: any): string {
  if (!hours) return ''
  
  // Check if business is currently open or closes soon
  const now = new Date()
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const today = dayNames[now.getDay()]
  const todayHours = hours[today]
  
  if (!todayHours || todayHours.closed) {
    return 'Note: Business is closed today.'
  }
  
  return `Today's hours: ${todayHours.open || '?'} - ${todayHours.close || '?'}`
}
