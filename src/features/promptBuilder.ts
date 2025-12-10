/**
 * Vertical-Specific Prompt Builder
 * 
 * Builds AI prompts tailored to specific business verticals.
 * Uses vertical-specific terminology, content focus, and context priorities.
 */

import type { BusinessVertical } from '../config/businessVerticals'
import { getVerticalConfig } from '../config/businessVerticals'
import type { AssembledContext } from './contextBuilder'

export interface PromptBuilderOptions {
  functionality: 'post-generation' | 'menu-parsing' | 'content-optimization'
  language?: string
  tone?: 'professional' | 'casual' | 'friendly' | 'excited'
  includeEmojis?: boolean
  includeHashtags?: boolean
  includeCTA?: boolean
}

/**
 * Build a vertical-aware AI prompt
 */
export function buildVerticalPrompt(
  context: AssembledContext,
  options: PromptBuilderOptions
): string {
  const vertical = context.business.vertical as BusinessVertical
  const verticalConfig = getVerticalConfig(vertical)
  
  if (!verticalConfig) {
    // Fallback to generic prompt if vertical not found
    return buildGenericPrompt(context, options)
  }

  const { terminology, contentFocus, contextPriorities } = verticalConfig
  const lang = options.language || 'en'

  // Build prompt sections
  const sections: string[] = []

  // 1. Role and Context
  sections.push(buildRoleSection(verticalConfig, lang))

  // 2. Business Information
  sections.push(buildBusinessSection(context, terminology, lang))

  // 3. Content Focus and Strategy
  sections.push(buildContentFocusSection(contentFocus, terminology, lang))

  // 4. External Context (if available)
  if (Object.keys(context.externalStatic).length > 0 || Object.keys(context.externalDynamic).length > 0) {
    sections.push(buildExternalContextSection(context, contextPriorities, lang))
  }

  // 5. Task Instructions
  sections.push(buildTaskSection(options, terminology, lang))

  // 6. Format Requirements
  sections.push(buildFormatSection(options, lang))

  return sections.join('\n\n')
}

/**
 * Build role and expertise section
 */
function buildRoleSection(verticalConfig: any, lang: string): string {
  const { displayName } = verticalConfig
  
  if (lang === 'da') {
    return `Du er en ekspert social media manager med speciale i ${displayName.toLowerCase()}-branchen. Du forstår, hvad der engagerer kunder, og hvordan man skaber autentisk, relaterbart indhold.`
  }
  
  return `You are an expert social media manager specializing in the ${displayName.toLowerCase()} industry. You understand what engages customers and how to create authentic, relatable content.`
}

/**
 * Build business information section
 */
function buildBusinessSection(context: AssembledContext, terminology: any, lang: string): string {
  const { business } = context
  const parts: string[] = []

  if (lang === 'da') {
    parts.push(`**Om ${terminology.location}:**`)
    if (business.name) parts.push(`- Navn: ${business.name}`)
    if (business.location) parts.push(`- Placering: ${business.location}`)
    if (business.description) parts.push(`- Beskrivelse: ${business.description}`)
  } else {
    parts.push(`**About the ${terminology.location}:**`)
    if (business.name) parts.push(`- Name: ${business.name}`)
    if (business.location) parts.push(`- Location: ${business.location}`)
    if (business.description) parts.push(`- Description: ${business.description}`)
  }

  // Add vertical-specific data
  if (business.menu && business.menu.length > 0) {
    const menuLabel = lang === 'da' ? '**Menu highlights:**' : '**Menu highlights:**'
    parts.push(`\n${menuLabel}`)
    business.menu.slice(0, 5).forEach((item: any) => {
      parts.push(`- ${item.name}${item.price ? ` (${item.price})` : ''}${item.description ? `: ${item.description}` : ''}`)
    })
  }

  if (business.services && business.services.length > 0) {
    const serviceLabel = lang === 'da' ? `**${terminology.offeringPlural}:**` : `**${terminology.offeringPlural}:**`
    parts.push(`\n${serviceLabel}`)
    business.services.slice(0, 5).forEach((service: any) => {
      parts.push(`- ${service.name}${service.price ? ` (${service.price})` : ''}${service.description ? `: ${service.description}` : ''}`)
    })
  }

  if (business.staff && business.staff.length > 0) {
    const staffLabel = lang === 'da' ? '**Team:**' : '**Team:**'
    parts.push(`\n${staffLabel}`)
    business.staff.slice(0, 3).forEach((member: any) => {
      parts.push(`- ${member.name}${member.role ? ` (${member.role})` : ''}`)
    })
  }

  if (business.classes && business.classes.length > 0) {
    const classLabel = lang === 'da' ? '**Hold/Klasser:**' : '**Classes:**'
    parts.push(`\n${classLabel}`)
    business.classes.slice(0, 3).forEach((cls: any) => {
      parts.push(`- ${cls.name}${cls.day_of_week !== undefined ? ` (${getDayName(cls.day_of_week, lang)})` : ''}`)
    })
  }

  return parts.join('\n')
}

/**
 * Build content focus section
 */
function buildContentFocusSection(contentFocus: any, terminology: any, lang: string): string {
  const parts: string[] = []

  if (lang === 'da') {
    parts.push(`**Indholdsfokus for ${terminology.offeringPlural}:**`)
    parts.push(`Fremhæv: ${contentFocus.primary.join(', ')}`)
    
    if (contentFocus.engagementTactics && contentFocus.engagementTactics.length > 0) {
      parts.push(`\nEngagement strategi: ${contentFocus.engagementTactics.join(', ')}`)
    }
  } else {
    parts.push(`**Content Focus for ${terminology.offeringPlural}:**`)
    parts.push(`Emphasize: ${contentFocus.primary.join(', ')}`)
    
    if (contentFocus.engagementTactics && contentFocus.engagementTactics.length > 0) {
      parts.push(`\nEngagement tactics: ${contentFocus.engagementTactics.join(', ')}`)
    }
  }

  return parts.join('\n')
}

/**
 * Build external context section (time, weather, location)
 */
function buildExternalContextSection(
  context: AssembledContext,
  priorities: any,
  lang: string
): string {
  const parts: string[] = []
  const { externalStatic, externalDynamic } = context

  // Time context (always available)
  if (externalStatic.time) {
    const time = externalStatic.time
    if (lang === 'da') {
      parts.push(`**Tidskontekst:**`)
      parts.push(`- ${time.dayOfWeek} ${time.isWeekend ? '(weekend)' : '(hverdag)'}`)
      parts.push(`- Stemning: ${time.vibe}`)
      if (time.timeOfDay) parts.push(`- Tid på dagen: ${time.timeOfDay}`)
    } else {
      parts.push(`**Time Context:**`)
      parts.push(`- ${time.dayOfWeek} ${time.isWeekend ? '(weekend)' : '(weekday)'}`)
      parts.push(`- Vibe: ${time.vibe}`)
      if (time.timeOfDay) parts.push(`- Time of day: ${time.timeOfDay}`)
    }
  }

  // Season context
  if (externalStatic.season) {
    const season = externalStatic.season
    if (lang === 'da') {
      parts.push(`\n**Sæson:** ${season.name}`)
      if (season.characteristics) parts.push(`Karakteristika: ${season.characteristics}`)
    } else {
      parts.push(`\n**Season:** ${season.name}`)
      if (season.characteristics) parts.push(`Characteristics: ${season.characteristics}`)
    }
  }

  // Weather context (premium tier)
  if (externalDynamic.weather && priorities.weatherRelevance !== 'low') {
    const weather = externalDynamic.weather
    if (lang === 'da') {
      parts.push(`\n**Vejr:** ${weather.description}, ${weather.temp}°C`)
      if (weather.mood) parts.push(`Stemning: ${weather.mood}`)
    } else {
      parts.push(`\n**Weather:** ${weather.description}, ${weather.temp}°C`)
      if (weather.mood) parts.push(`Mood: ${weather.mood}`)
    }
  }

  // Transit context (standardplus+)
  if (externalDynamic.transit && priorities.locationRelevance !== 'low') {
    const transit = externalDynamic.transit
    if (transit.length > 0) {
      const nearestStation = transit[0]
      if (lang === 'da') {
        parts.push(`\n**Transport:** ${nearestStation.name} (${nearestStation.walkingTime})`)
      } else {
        parts.push(`\n**Transit:** ${nearestStation.name} (${nearestStation.walkingTime})`)
      }
    }
  }

  // Holidays
  if (externalStatic.holidays && externalStatic.holidays.length > 0) {
    const holiday = externalStatic.holidays[0]
    if (lang === 'da') {
      parts.push(`\n**Kommende højtid:** ${holiday.name}`)
      if (holiday.vibe) parts.push(`Stemning: ${holiday.vibe}`)
    } else {
      parts.push(`\n**Upcoming Holiday:** ${holiday.name}`)
      if (holiday.vibe) parts.push(`Vibe: ${holiday.vibe}`)
    }
  }

  return parts.join('\n')
}

/**
 * Build task instructions section
 */
function buildTaskSection(options: PromptBuilderOptions, terminology: any, lang: string): string {
  const parts: string[] = []

  if (lang === 'da') {
    parts.push(`**Din opgave:**`)
    
    if (options.functionality === 'post-generation') {
      parts.push(`Skriv et engaging social media opslag der:`)
      parts.push(`- Taler direkte til ${terminology.customerPlural}`)
      parts.push(`- Fremhæver ${terminology.offeringPlural} naturligt`)
      parts.push(`- Inkorporerer kontekst (tid, vejr, sæson) når relevant`)
      parts.push(`- Føles autentisk og personligt`)
      
      if (options.includeCTA) {
        parts.push(`- Slutter med en klar call-to-action`)
      }
    }
  } else {
    parts.push(`**Your task:**`)
    
    if (options.functionality === 'post-generation') {
      parts.push(`Write an engaging social media post that:`)
      parts.push(`- Speaks directly to ${terminology.customerPlural}`)
      parts.push(`- Highlights ${terminology.offeringPlural} naturally`)
      parts.push(`- Incorporates context (time, weather, season) when relevant`)
      parts.push(`- Feels authentic and personal`)
      
      if (options.includeCTA) {
        parts.push(`- Ends with a clear call-to-action`)
      }
    }
  }

  return parts.join('\n')
}

/**
 * Build format requirements section
 */
function buildFormatSection(options: PromptBuilderOptions, lang: string): string {
  const parts: string[] = []

  if (lang === 'da') {
    parts.push(`**Format:**`)
    parts.push(`- Sprog: Dansk`)
    parts.push(`- Tone: ${options.tone || 'professionel men varm'}`)
    if (options.includeEmojis) parts.push(`- Brug emojis naturligt (2-4 emojis)`)
    if (options.includeHashtags) parts.push(`- Inkluder 5-8 relevante hashtags i slutningen`)
    parts.push(`- Længde: 50-150 ord for Facebook, 100-200 for Instagram`)
  } else {
    parts.push(`**Format:**`)
    parts.push(`- Language: English`)
    parts.push(`- Tone: ${options.tone || 'professional but warm'}`)
    if (options.includeEmojis) parts.push(`- Use emojis naturally (2-4 emojis)`)
    if (options.includeHashtags) parts.push(`- Include 5-8 relevant hashtags at the end`)
    parts.push(`- Length: 50-150 words for Facebook, 100-200 for Instagram`)
  }

  return parts.join('\n')
}

/**
 * Fallback generic prompt builder
 */
function buildGenericPrompt(context: AssembledContext, options: PromptBuilderOptions): string {
  const lang = options.language || 'en'
  const parts: string[] = []

  if (lang === 'da') {
    parts.push(`Du er en social media manager. Skriv et engaging opslag for ${context.business.name || 'denne virksomhed'}.`)
  } else {
    parts.push(`You are a social media manager. Write an engaging post for ${context.business.name || 'this business'}.`)
  }

  return parts.join('\n\n')
}

/**
 * Helper: Get day name in specified language
 */
function getDayName(dayOfWeek: number, lang: string): string {
  const daysDA = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag']
  const daysEN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  
  const days = lang === 'da' ? daysDA : daysEN
  return days[dayOfWeek] || ''
}
