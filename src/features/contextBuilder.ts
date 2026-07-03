/**
 * Context Builder
 * 
 * Intelligently assembles context data for AI prompts based on:
 * - Functionality being used (post-generation, menu-parsing, etc.)
 * - User's subscription tier (controls depth and external API access)
 * - Available business data
 * - Cached external data
 */

import { supabase } from '../lib/supabase'
import { TIER_FEATURES, type UserTier } from '../config/features'
import { getVerticalConfig, resolveEffectiveVertical, verticalHasCapability, type BusinessVertical } from '../config/businessVerticals'
import { executeTrigger, CONTEXT_TRIGGERS } from './contextTriggers'
import { globalContextCache } from './contextCache'



/**
 * Assembled context ready for AI prompt
 */
export interface AssembledContext {
  business: Record<string, any>
  externalStatic: Record<string, any>
  externalDynamic: Record<string, any>
  userPreferences: Record<string, any>
  metadata: {
    tier: UserTier
    tokenEstimate: number
    sources: string[]
    cached: string[]
  }
}

/**
 * Parameters for building context
 */
export interface BuildContextParams {
  functionality: 'post-generation' | 'menu-parsing' | 'website-analysis' | 'content-optimization'
  userTier: UserTier
  businessId: string
  userId: string
  additionalParams?: Record<string, any>
  language?: string
}

/**
 * Context Builder Class
 */
export class ContextBuilder {
  private tier: UserTier
  private maxTokens: number

  constructor(_functionality: string, tier: UserTier) {
    this.tier = tier
    // Profile can be accessed from CONTEXT_PROFILES when needed
    this.maxTokens = TIER_FEATURES[tier].contextAccess.maxTokens
  }

  /**
   * Main method: Build complete context for AI prompt
   */
  async buildContext(params: BuildContextParams): Promise<AssembledContext> {
    const { businessId, additionalParams = {}, language = 'da' } = params

    const context: AssembledContext = {
      business: {},
      externalStatic: {},
      externalDynamic: {},
      userPreferences: { language },
      metadata: {
        tier: this.tier,
        tokenEstimate: 0,
        sources: [],
        cached: [],
      },
    }

    // 1. Fetch business data
    await this.fetchBusinessData(businessId, context)

    // 2. Add external static data
    await this.addExternalStaticData(context)

    // 3. Add external dynamic data (API calls with triggers)
    await this.addExternalDynamicData(context, additionalParams)

    // 4. Apply token budget limits
    this.applyTokenBudget(context)

    return context
  }

  /**
   * Fetch business data from database
   */
  private async fetchBusinessData(businessId: string, context: AssembledContext): Promise<void> {
    const tierConfig = TIER_FEATURES[this.tier].contextAccess

    try {
      // Get business basic info
      const { data: business } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single() as any

      if (!business) {
        console.warn('Business not found:', businessId)
        return
      }

      // Get business profile
      const { data: profile } = await supabase
        .from('business_profile')
        .select('*')
        .eq('business_id', businessId)
        .single() as any

      const { data: brandProfile } = await supabase
        .from('business_brand_profile')
        .select('business_character, business_identity_persona, identity_keywords, brand_profile_v5')
        .eq('business_id', businessId)
        .maybeSingle() as any

      const businessCharacter =
        brandProfile?.brand_profile_v5?.layer_0_intelligence?.business_identity?.system_persona ||
        brandProfile?.business_identity_persona ||
        brandProfile?.business_character ||
        profile?.brand_voice ||
        ''
      const identityKeywords = Array.isArray(brandProfile?.identity_keywords)
        ? brandProfile.identity_keywords
        : []
      const effectiveVertical = resolveEffectiveVertical(
        business.vertical,
        businessCharacter,
        identityKeywords,
      )

      // Get business location
      const { data: location } = await supabase
        .from('business_locations')
        .select('*')
        .eq('business_id', businessId)
        .single() as any

      // Get menu data if available
      const { data: documents } = await supabase
        .from('business_documents')
        .select('extracted_json, pdf_type')
        .eq('business_id', businessId)
        .eq('pdf_type', 'menu')
        .order('created_at', { ascending: false })
        .limit(1)
        .single() as any

      // Map fields based on tier access
      const allowedFields = tierConfig.business === 'all' 
        ? 'all' 
        : tierConfig.business

      if (allowedFields === 'all' || allowedFields.includes('name')) {
        context.business.name = business.name
        context.metadata.sources.push('business.name')
      }

      if (allowedFields === 'all' || allowedFields.includes('type')) {
        context.business.type = effectiveVertical
        context.metadata.sources.push('business.type')
      }

      if (allowedFields === 'all' || allowedFields.includes('vertical')) {
        context.business.vertical = business.vertical
        context.metadata.sources.push('business.vertical')
      }

      context.business.effectiveVertical = effectiveVertical
      context.metadata.sources.push('business.effectiveVertical')

      if (allowedFields === 'all' || allowedFields.includes('website')) {
        context.business.website = business.website_url
        context.metadata.sources.push('business.website')
      }

      // Location fields
      if (location) {
        if (allowedFields === 'all' || allowedFields.includes('location')) {
          context.business.location = {
            city: location.city,
            country: location.country,
          }
          context.metadata.sources.push('business.location')
        }

        if (allowedFields === 'all' || allowedFields.includes('address')) {
          context.business.address = location.address_line1
          context.metadata.sources.push('business.address')
        }

        if (allowedFields === 'all' || allowedFields.includes('city')) {
          context.business.city = location.city
          context.metadata.sources.push('business.city')
        }
      }

      // Profile fields
      if (profile) {
        if (allowedFields === 'all' || allowedFields.includes('description') || allowedFields.includes('long-description')) {
          context.business.description = profile.long_description
          context.metadata.sources.push('business.description')
        }

        if (allowedFields === 'all' || allowedFields.includes('short-description')) {
          context.business.shortDescription = profile.short_description
          context.metadata.sources.push('business.short-description')
        }

        if (allowedFields === 'all' || allowedFields.includes('target-audience')) {
          context.business.targetAudience = profile.target_audience
          context.metadata.sources.push('business.target-audience')
        }

        if (allowedFields === 'all' || allowedFields.includes('vibe')) {
          context.business.vibe = profile.brand_voice
          context.metadata.sources.push('business.vibe')
        }

        if (allowedFields === 'all' || allowedFields.includes('tone')) {
          context.business.tone = profile.brand_voice
          context.metadata.sources.push('business.tone')
        }
      }

      // Menu fields
      if (documents?.extracted_json) {
        const menuData = documents.extracted_json as any

        if (allowedFields === 'all' || allowedFields.includes('menu') || allowedFields.includes('menu-full')) {
          context.business.menu = menuData
          context.metadata.sources.push('business.menu')
        } else if (allowedFields.includes('menu-highlights')) {
          // Just include category names and a few items for free tier
          context.business.menuHighlights = {
            categories: menuData.categories?.slice(0, 3).map((cat: any) => cat.name),
            sampleItems: menuData.categories?.[0]?.items?.slice(0, 3),
          }
          context.metadata.sources.push('business.menu-highlights')
        }
      }

      // Fetch vertical-specific data
      await this.fetchVerticalSpecificData(effectiveVertical as BusinessVertical, businessId, context, allowedFields)

    } catch (error) {
      console.error('Error fetching business data:', error)
    }
  }

  /**
   * Fetch vertical-specific data (services, staff, products, classes)
   */
  private async fetchVerticalSpecificData(
    vertical: BusinessVertical,
    businessId: string,
    context: AssembledContext,
    allowedFields: any
  ): Promise<void> {
    const verticalConfig = getVerticalConfig(vertical)
    
    // Store vertical config for use in prompts
    context.business.verticalConfig = {
      displayName: verticalConfig.displayName,
      category: verticalConfig.category,
      terminology: verticalConfig.terminology,
      contentFocus: verticalConfig.contentFocus,
    }

    try {
      // Fetch service list (for salons, gyms, spas, etc.)
      if (verticalHasCapability(vertical, 'hasServiceList')) {
        const { data: services } = await supabase
          .from('business_services')
          .select('*')
          .eq('business_id', businessId)
          .eq('is_active', true)
          .order('display_order')

        if (services && services.length > 0) {
          context.business.services = services
          context.metadata.sources.push('business.services')
        }
      }

      // NOTE: business_staff table was DROPPED April 2026 (migration 20260420000007).
      // Staff data is no longer available. Do NOT restore this query.

      // Fetch product catalog (retail products)
      if (verticalHasCapability(vertical, 'hasProductCatalog') && (allowedFields === 'all')) {
        const { data: products } = await supabase
          .from('business_products')
          .select('*')
          .eq('business_id', businessId)
          .eq('is_active', true)
          .order('is_featured', { ascending: false })
          .order('display_order', { ascending: true })

        if (products && products.length > 0) {
          context.business.products = products
          context.metadata.sources.push('business.products')
        }
      }

      // Fetch class schedule (for gyms, yoga studios, etc.)
      if (verticalHasCapability(vertical, 'hasClassSchedule')) {
        const { data: classes } = await supabase
          .from('business_classes')
          .select('*')
          .eq('business_id', businessId)
          .eq('is_active', true)
          .order('day_of_week', { ascending: true })
          .order('start_time', { ascending: true })

        if (classes && classes.length > 0) {
          context.business.classes = classes
          context.metadata.sources.push('business.classes')
        }
      }

    } catch (error) {
      console.error('Error fetching vertical-specific data:', error)
    }
  }

  /**
   * Add external static data (holidays, seasons, etc.)
   */
  private async addExternalStaticData(context: AssembledContext): Promise<void> {
    const tierConfig = TIER_FEATURES[this.tier].contextAccess
    const allowedStatic = tierConfig.externalStatic

    // Day/Time (always real-time, no cache)
    if (allowedStatic.includes('day-time')) {
      const now = new Date()
      const day = now.toLocaleDateString('en-US', { weekday: 'long' })
      const hour = now.getHours()
      const period = this.getTimePeriod(hour)
      
      context.externalStatic.dayTime = {
        day,
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        period,
        hour,
        vibe: this.getDayVibe(day),
        isWeekend: day === 'Saturday' || day === 'Sunday',
        isEveningRush: hour >= 17 && hour <= 19,
        isLunchTime: hour >= 11 && hour <= 14,
        isBreakfast: hour >= 7 && hour <= 10,
      }
      context.metadata.sources.push('external-static.day-time')
    }

    // Seasons
    if (allowedStatic.includes('seasons')) {
      const seasonData = this.getCurrentSeason()
      context.externalStatic.season = seasonData.name
      context.externalStatic.seasonalCharacteristics = seasonData.characteristics
      context.metadata.sources.push('external-static.seasons')
    }

    // Holidays (with country support)
    if (allowedStatic.includes('holidays') || allowedStatic.includes('major-holidays')) {
      const country = context.business?.country || 'Denmark'
      const holidays = await this.getUpcomingHolidays(
        allowedStatic.includes('major-holidays'),
        country
      )
      if (holidays.length > 0) {
        context.externalStatic.holidays = holidays
        context.externalStatic.nextHoliday = holidays[0] // Closest upcoming holiday
        context.metadata.sources.push('external-static.holidays')
      }
    }
  }

  /**
   * Add external dynamic data with API calls (using triggers)
   */
  private async addExternalDynamicData(
    context: AssembledContext, 
    _additionalParams: Record<string, any>
  ): Promise<void> {
    const tierConfig = TIER_FEATURES[this.tier].contextAccess
    const allowedDynamic = tierConfig.externalDynamic

    // Weather (premium only by default)
    if (allowedDynamic.includes('weather-basic') && context.business.city) {
      const trigger = CONTEXT_TRIGGERS['weather']
      const cacheKey = trigger.cacheKey(context.business.city)
      
      const weather = await globalContextCache.getOrFetch(
        cacheKey,
        () => executeTrigger('weather', context.business.city, this.tier, context),
        trigger.cacheTTL
      )
      
      if (weather) {
        context.externalDynamic.weather = weather
        context.metadata.sources.push('external-dynamic.weather-basic')
        if (globalContextCache.has(cacheKey)) {
          context.metadata.cached.push('weather')
        }
      }
    }

    // Nearby transit (standardplus+)
    if (allowedDynamic.includes('nearby-transit') && context.business.address) {
      const trigger = CONTEXT_TRIGGERS['nearby-transit']
      const cacheKey = trigger.cacheKey(context.business.address)
      
      const transit = await globalContextCache.getOrFetch(
        cacheKey,
        () => executeTrigger('nearby-transit', context.business.address, this.tier, context),
        trigger.cacheTTL
      )
      
      if (transit) {
        context.externalDynamic.nearbyTransit = transit
        context.metadata.sources.push('external-dynamic.nearby-transit')
        if (globalContextCache.has(cacheKey)) {
          context.metadata.cached.push('nearby-transit')
        }
      }
    }

    // Seasonal items trigger (free for all tiers)
    if (context.externalStatic.season && context.business.menu) {
      const trigger = CONTEXT_TRIGGERS['seasonal-items']
      const cacheKey = `${trigger.cacheKey(context.externalStatic.season)}:${context.business.name}`
      
      const seasonalItems = await globalContextCache.getOrFetch(
        cacheKey,
        () => executeTrigger('seasonal-items', context.externalStatic.season, this.tier, context),
        trigger.cacheTTL
      )
      
      if (seasonalItems && seasonalItems.length > 0) {
        context.externalStatic.seasonalMenuItems = seasonalItems
        context.metadata.sources.push('external-static.seasonal-items')
      }
    }
  }

  /**
   * Apply token budget limits
   */
  private applyTokenBudget(context: AssembledContext): void {
    // Estimate tokens (rough: 1 token ≈ 4 characters)
    const jsonString = JSON.stringify(context)
    const estimatedTokens = Math.ceil(jsonString.length / 4)

    context.metadata.tokenEstimate = estimatedTokens

    // If over budget, start removing optional fields
    if (estimatedTokens > this.maxTokens) {
      console.warn(`Context exceeds token budget: ${estimatedTokens}/${this.maxTokens}`)
      // TODO: Implement smart pruning (remove lowest priority fields first)
    }
  }

  /**
   * Helper: Get time period with vibe context
   */
  private getTimePeriod(hour: number): string {
    if (hour >= 5 && hour < 12) return 'morning'
    if (hour >= 12 && hour < 17) return 'afternoon'
    if (hour >= 17 && hour < 21) return 'evening'
    return 'night'
  }

  /**
   * Helper: Get day of week vibe for content generation
   */
  private getDayVibe(day: string): string {
    const vibes: Record<string, string> = {
      'Monday': 'start of the week, people need energy and motivation',
      'Tuesday': 'mid-week grind, people appreciate comfort and escape',
      'Wednesday': 'hump day, halfway through the week',
      'Thursday': 'almost Friday, anticipation building',
      'Friday': 'TGIF energy, celebration and relaxation mood',
      'Saturday': 'weekend leisure, people have more time to enjoy',
      'Sunday': 'relaxed day, preparing for the week ahead',
    }
    return vibes[day] || 'typical weekday'
  }

  /**
   * Helper: Get current season with characteristics
   */
  private getCurrentSeason(): { name: string; characteristics: string } {
    const month = new Date().getMonth()
    
    if (month >= 2 && month <= 4) {
      return {
        name: 'spring',
        characteristics: 'fresh ingredients, lighter dishes, renewal and growth'
      }
    }
    if (month >= 5 && month <= 7) {
      return {
        name: 'summer',
        characteristics: 'outdoor dining, refreshing drinks, grilled food, salads'
      }
    }
    if (month >= 8 && month <= 10) {
      return {
        name: 'autumn',
        characteristics: 'cozy atmosphere, warm drinks, hearty comfort food'
      }
    }
    return {
      name: 'winter',
      characteristics: 'warm and comforting, hot beverages, festive atmosphere'
    }
  }

  /**
   * Helper: Get upcoming holidays by country
   */
  private async getUpcomingHolidays(_majorOnly: boolean, country: string = 'Denmark'): Promise<any[]> {
    const holidaysByCountry: Record<string, any[]> = {
      'Denmark': [
        { name: 'Christmas', date: '2025-12-25', type: 'major', vibe: 'festive, cozy, gift-giving' },
        { name: 'New Year', date: '2026-01-01', type: 'major', vibe: 'celebration, fresh start' },
        { name: 'Easter', date: '2026-04-05', type: 'major', vibe: 'spring, family gatherings' },
        { name: 'Great Prayer Day', date: '2026-05-01', type: 'local', vibe: 'traditional Danish holiday' },
        { name: "Valentine's Day", date: '2026-02-14', type: 'commercial', vibe: 'romantic, couples' },
        { name: 'Fastelavn', date: '2026-02-15', type: 'local', vibe: 'Danish carnival, children, pastries' },
      ],
      'UK': [
        { name: 'Christmas', date: '2025-12-25', type: 'major', vibe: 'festive, cozy, gift-giving' },
        { name: 'New Year', date: '2026-01-01', type: 'major', vibe: 'celebration, fresh start' },
        { name: 'Easter', date: '2026-04-05', type: 'major', vibe: 'spring, family gatherings' },
        { name: "Valentine's Day", date: '2026-02-14', type: 'commercial', vibe: 'romantic, couples' },
        { name: 'Bank Holiday', date: '2026-05-25', type: 'local', vibe: 'long weekend, leisure' },
      ],
      'USA': [
        { name: 'Christmas', date: '2025-12-25', type: 'major', vibe: 'festive, cozy, gift-giving' },
        { name: 'New Year', date: '2026-01-01', type: 'major', vibe: 'celebration, fresh start' },
        { name: 'Thanksgiving', date: '2025-11-27', type: 'major', vibe: 'family, gratitude, feast' },
        { name: "Valentine's Day", date: '2026-02-14', type: 'commercial', vibe: 'romantic, couples' },
        { name: 'July 4th', date: '2026-07-04', type: 'major', vibe: 'patriotic, BBQ, fireworks' },
      ],
    }

    const holidays = holidaysByCountry[country] || holidaysByCountry['Denmark']
    
    return holidays
      .map(h => ({
        ...h,
        daysUntil: this.daysUntil(h.date),
      }))
      .filter(h => h.daysUntil >= 0 && h.daysUntil <= 30)
      .sort((a, b) => a.daysUntil - b.daysUntil)
  }



  /**
   * Helper: Calculate days until a date
   */
  private daysUntil(dateString: string): number {
    const target = new Date(dateString)
    const now = new Date()
    const diff = target.getTime() - now.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }
}

/**
 * Convenience function for building context
 */
export async function buildContext(params: BuildContextParams): Promise<AssembledContext> {
  const builder = new ContextBuilder(params.functionality, params.userTier)
  return await builder.buildContext(params)
}
