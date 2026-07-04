/**
 * Commercial Strategy Analyzer
 * 
 * Analyzes business characteristics and generates AI-powered recommendations
 * for commercial content strategy configuration.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { buildCommercialStrategyPrompt, CommercialStrategyContext } from './prompts/commercial-strategy-prompt.ts';

export interface TriggerConfig {
  enabled: boolean;
  mode: 'booking_push' | 'footfall_push' | 'balanced';
  min_booking_ideas?: number;
  min_footfall_ideas?: number;
  reasoning: string;
}

export interface CommercialStrategyRecommendation {
  commercial_baseline_mode: 'booking_push' | 'footfall_push' | 'balanced';
  baseline_reasoning: string;
  trigger_configuration: Record<string, TriggerConfig>;
  summary_text: string;
  confidence_score: number;
  key_factors: string[];
}

interface MenuAnalysis {
  price_point?: 'budget' | 'moderate' | 'upscale' | 'luxury';
  item_count: number;
  has_seasonal_items: boolean;
  fine_dining_indicators: string[];
}

/**
 * Analyze menu items to extract pricing and characteristics
 */
async function analyzeMenu(
  supabase: SupabaseClient,
  businessId: string
): Promise<MenuAnalysis> {
  const { data: menuItems, error } = await supabase
    .from('menu_items_normalized')
    .select('item_price, item_name, item_description, is_seasonal, seasonal_ingredients')
    .eq('business_id', businessId)
    .limit(100);

  if (error || !menuItems || menuItems.length === 0) {
    return {
      item_count: 0,
      has_seasonal_items: false,
      fine_dining_indicators: []
    };
  }

  // Calculate average price for price point (parse text prices like "125 kr")
  const prices = menuItems
    .map(item => {
      if (!item.item_price) return null;
      const match = item.item_price.match(/(\d+)/);
      return match ? parseInt(match[1]) : null;
    })
    .filter(p => p !== null && p > 0) as number[];
  
  let price_point: 'budget' | 'moderate' | 'upscale' | 'luxury' | undefined;
  if (prices.length > 0) {
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    if (avgPrice < 100) price_point = 'budget';
    else if (avgPrice < 200) price_point = 'moderate';
    else if (avgPrice < 350) price_point = 'upscale';
    else price_point = 'luxury';
  }

  // Detect seasonal items using explicit flags first, then text search as backup
  const has_seasonal_items = menuItems.some(item => item.is_seasonal === true) ||
    menuItems.some(item => item.seasonal_ingredients && item.seasonal_ingredients.length > 0) ||
    menuItems.some(item => {
      const text = `${item.item_name || ''} ${item.item_description || ''}`.toLowerCase();
      const seasonalKeywords = ['seasonal', 'season', 'forår', 'sommer', 'efterår', 'vinter', 'spring', 'summer', 'autumn', 'winter'];
      return seasonalKeywords.some(keyword => text.includes(keyword));
    });

  // Fine dining indicators
  const fine_dining_indicators: string[] = [];
  const allText = menuItems.map(item => `${item.item_name || ''} ${item.item_description || ''}`).join(' ').toLowerCase();
  
  if (allText.includes('tasting menu') || allText.includes('menu dégustation') || allText.includes('smagsmenu')) {
    fine_dining_indicators.push('tasting_menu');
  }
  if (allText.includes('wine pairing') || allText.includes('vinmenu')) {
    fine_dining_indicators.push('wine_pairing');
  }
  if (allText.includes('chef') || allText.includes('køkkenchef')) {
    fine_dining_indicators.push('chef_driven');
  }

  return {
    price_point,
    item_count: menuItems.length,
    has_seasonal_items,
    fine_dining_indicators
  };
}

/**
 * Gather business context for commercial strategy analysis
 */
async function gatherBusinessContext(
  supabase: SupabaseClient,
  businessId: string
): Promise<CommercialStrategyContext | null> {
  // Fetch business data
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('category')
    .eq('id', businessId)
    .single();

  if (businessError || !business) {
    console.error('Failed to fetch business:', businessError);
    return null;
  }

  // Fetch operations data
  const { data: operations } = await supabase
    .from('business_operations')
    .select('has_reservation_system, has_outdoor_seating, has_kids_menu, primary_service_period, weekly_programme')
    .eq('business_id', businessId)
    .single();

  // Fetch location intelligence
  const { data: location } = await supabase
    .from('business_location_intelligence')
    .select('location_types, footfall_pattern')
    .eq('business_id', businessId)
    .single();

  // Fetch brand profile (for brand essence and booking_link fallback)
  const { data: profile } = await supabase
    .from('business_brand_profile')
    .select('brand_essence, primary_audience, tourist_factor, booking_link')
    .eq('business_id', businessId)
    .single();

  // Fetch business self-description for hybrid venue detection
  const { data: businessProfile } = await supabase
    .from('business_profile')
    .select('short_description, long_description')
    .eq('business_id', businessId)
    .single();

  // Analyze menu
  const menuAnalysis = await analyzeMenu(supabase, businessId);

  // Determine has_reservation_system: use column if exists, fallback to booking_link presence
  const hasReservationSystem = operations?.has_reservation_system ?? 
    (profile?.booking_link ? true : false);

  return {
    business_id: businessId,
    category: business.category,
    brand_essence: profile?.brand_essence,
    primary_audience: profile?.primary_audience,
    tourist_factor: profile?.tourist_factor,
    business_description: businessProfile?.short_description || businessProfile?.long_description,
    
    has_reservation_system: hasReservationSystem,
    has_outdoor_seating: operations?.has_outdoor_seating || false,
    has_kids_menu: operations?.has_kids_menu || false,
    primary_service_period: operations?.primary_service_period,
    weekly_programme: operations?.weekly_programme,
    
    location_types: location?.location_types,
    footfall_pattern: location?.footfall_pattern,
    
    menu_price_point: menuAnalysis.price_point,
    menu_item_count: menuAnalysis.item_count,
    has_seasonal_items: menuAnalysis.has_seasonal_items,
    fine_dining_indicators: menuAnalysis.fine_dining_indicators
  };
}

/**
 * Call OpenAI to analyze commercial strategy
 */
async function callOpenAI(
  prompt: string,
  openaiApiKey: string
): Promise<CommercialStrategyRecommendation> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a commercial content strategist. Respond ONLY with valid JSON, no markdown formatting or explanations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  
  if (!content) {
    throw new Error('No content in OpenAI response');
  }

  return JSON.parse(content);
}

/**
 * Validate and sanitize AI recommendation
 */
function validateRecommendation(
  recommendation: any
): CommercialStrategyRecommendation {
  // Ensure all required fields exist
  if (!recommendation.commercial_baseline_mode) {
    recommendation.commercial_baseline_mode = 'balanced';
  }
  
  if (!recommendation.baseline_reasoning) {
    recommendation.baseline_reasoning = 'Balanced approach based on business characteristics.';
  }

  if (!recommendation.trigger_configuration) {
    recommendation.trigger_configuration = {};
  }

  if (!recommendation.summary_text) {
    recommendation.summary_text = 'Commercial strategy configured based on business characteristics.';
  }

  if (typeof recommendation.confidence_score !== 'number') {
    recommendation.confidence_score = 0.7;
  }

  if (!Array.isArray(recommendation.key_factors)) {
    recommendation.key_factors = [];
  }

  // Validate baseline mode
  const validModes = ['booking_push', 'footfall_push', 'balanced'];
  if (!validModes.includes(recommendation.commercial_baseline_mode)) {
    recommendation.commercial_baseline_mode = 'balanced';
  }

  // Validate trigger configuration
  const validTriggers = ['VD_WEEK', 'MD_WEEK', 'FD_WEEK', 'FIRST_WEEKEND', 'PAYDAY_PERIOD', 'WEATHER_BREAK', 'LOCAL_EVENT'];
  
  for (const trigger of validTriggers) {
    if (!recommendation.trigger_configuration[trigger]) {
      recommendation.trigger_configuration[trigger] = {
        enabled: false,
        mode: 'balanced',
        min_booking_ideas: 1,
        min_footfall_ideas: 2,
        reasoning: 'Not configured'
      };
    }

    const config = recommendation.trigger_configuration[trigger];
    
    // Validate mode
    if (!validModes.includes(config.mode)) {
      config.mode = 'balanced';
    }

    // Ensure quotas are within range
    if (config.min_booking_ideas) {
      config.min_booking_ideas = Math.max(0, Math.min(7, config.min_booking_ideas));
    }
    if (config.min_footfall_ideas) {
      config.min_footfall_ideas = Math.max(0, Math.min(7, config.min_footfall_ideas));
    }
  }

  return recommendation as CommercialStrategyRecommendation;
}

/**
 * Main function: Analyze commercial strategy for a business
 */
export async function analyzeCommercialStrategy(
  supabase: SupabaseClient,
  businessId: string,
  openaiApiKey: string
): Promise<CommercialStrategyRecommendation> {
  try {
    // Gather business context
    const context = await gatherBusinessContext(supabase, businessId);
    
    if (!context) {
      throw new Error('Failed to gather business context');
    }

    // Build prompt (now async due to language file loading)
    const prompt = await buildCommercialStrategyPrompt(context);

    // Call OpenAI
    const recommendation = await callOpenAI(prompt, openaiApiKey);

    // Validate and sanitize
    return validateRecommendation(recommendation);

  } catch (error) {
    console.error('Commercial strategy analysis failed:', error);
    
    // Return safe defaults on error
    return {
      commercial_baseline_mode: 'balanced',
      baseline_reasoning: 'Default configuration due to analysis error.',
      trigger_configuration: {
        'VD_WEEK': { enabled: false, mode: 'balanced', min_booking_ideas: 2, min_footfall_ideas: 2, reasoning: 'Not analyzed' },
        'MD_WEEK': { enabled: false, mode: 'balanced', min_booking_ideas: 2, min_footfall_ideas: 2, reasoning: 'Not analyzed' },
        'FD_WEEK': { enabled: false, mode: 'balanced', min_booking_ideas: 2, min_footfall_ideas: 2, reasoning: 'Not analyzed' },
        'FIRST_WEEKEND': { enabled: false, mode: 'footfall_push', min_footfall_ideas: 3, min_booking_ideas: 1, reasoning: 'Not analyzed' },
        'PAYDAY_PERIOD': { enabled: false, mode: 'footfall_push', min_footfall_ideas: 3, min_booking_ideas: 1, reasoning: 'Not analyzed' },
        'WEATHER_BREAK': { enabled: false, mode: 'footfall_push', min_footfall_ideas: 3, min_booking_ideas: 1, reasoning: 'Not analyzed' },
        'LOCAL_EVENT': { enabled: false, mode: 'balanced', min_booking_ideas: 2, min_footfall_ideas: 2, reasoning: 'Not analyzed' }
      },
      summary_text: 'Commercial strategy analysis failed. Using default configuration.',
      confidence_score: 0.3,
      key_factors: ['error_fallback']
    };
  }
}
