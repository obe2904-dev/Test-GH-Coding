/**
 * Commercial Strategy Analysis Prompt
 * 
 * Generates AI-powered recommendations for weekly content commercial strategy
 * based on business characteristics, location, menu, and operational capabilities.
 */

import { loadLanguageConfig, type Language } from '../../prompts/utils/prompt-loader.ts'

export interface CommercialStrategyContext {
  // Business basics
  business_id: string;
  category: string;
  brand_essence?: string;
  business_description?: string; // Self-description from "Om os" section
  
  // Operations
  has_reservation_system: boolean;
  has_outdoor_seating?: boolean;
  has_kids_menu?: boolean;
  primary_service_period?: string;
  weekly_programme?: string;
  
  // Location intelligence
  location_types?: string[]; // Up to 4: tourist_destination, residential_neighborhood, business_district, waterfront
  footfall_pattern?: string;
  
  // Menu analysis
  menu_price_point?: 'budget' | 'moderate' | 'upscale' | 'luxury';
  menu_item_count?: number;
  has_seasonal_items?: boolean;
  fine_dining_indicators?: string[];
  
  // Optional context
  tourist_factor?: 'none' | 'minor' | 'moderate' | 'dominant';
  primary_audience?: string;
}

export async function buildCommercialStrategyPrompt(context: CommercialStrategyContext): Promise<string> {
  const {
    category,
    brand_essence,
    business_description,
    has_reservation_system,
    has_outdoor_seating = false,
    has_kids_menu = false,
    primary_service_period,
    weekly_programme,
    location_types = [],
    menu_price_point,
    menu_item_count,
    has_seasonal_items,
    tourist_factor,
    primary_audience
  } = context;

  // Load language-specific system message (default to Danish)
  const result = await loadLanguageConfig('da', 'commercial-strategy-system')
  
  let systemMessage: string
  let closerMessage: string
  
  if (!result.success || !result.prompt) {
    console.warn('Failed to load DA commercial-strategy system prompt, using hardcoded fallback')
    systemMessage = `You are a commercial content strategist analyzing a business to recommend optimal content strategy triggers for their weekly social media planning.`
    closerMessage = ``
  } else {
    systemMessage = result.prompt.system
    closerMessage = result.prompt.closer
  }

  return `${systemMessage}

## BUSINESS PROFILE

**Category:** ${category}
**Brand Positioning:** ${brand_essence || 'Not specified'}
**Primary Audience:** ${primary_audience || 'General'}
${business_description ? `**Business Description (from owner):** ${business_description}` : ''}

**Operational Capabilities:**
- Reservation system: ${has_reservation_system ? 'Yes' : 'No'}
- Outdoor seating: ${has_outdoor_seating ? 'Yes' : 'No'}
- Kids menu: ${has_kids_menu ? 'Yes' : 'No'}
- Primary service period: ${primary_service_period || 'Not specified'}
${weekly_programme ? `- Recurring weekly events: ${weekly_programme}` : ''}

**Location Context:**
- Location types: ${location_types.length > 0 ? location_types.join(', ') : 'Not specified'}
- Tourist factor: ${tourist_factor || 'unknown'}

**Menu Characteristics:**
- Price point: ${menu_price_point || 'Not specified'}
- Menu size: ${menu_item_count ? `${menu_item_count} items` : 'Not specified'}
- Seasonal offerings: ${has_seasonal_items ? 'Yes' : 'No'}

---

## YOUR TASK

Analyze this business and recommend a commercial content strategy configuration. The goal is to ensure weekly content consistently drives footfall and sales, with the right balance between booking conversion and walk-in visits.

## OUTPUT REQUIREMENTS

Generate a JSON response with this exact structure:

\`\`\`json
{
  "commercial_baseline_mode": "booking_push" | "footfall_push" | "balanced",
  "baseline_reasoning": "1-2 sentences explaining why this mode fits",
  
  "trigger_configuration": {

    "MD_WEEK": {
      "enabled": true/false,
      "mode": "booking_push" | "footfall_push" | "balanced",
      "min_booking_ideas": 1-4,
      "min_footfall_ideas": 1-5,
      "reasoning": "Why this trigger matters (or doesn't)"
    },
    "FD_WEEK": {
      "enabled": true/false,
      "mode": "booking_push" | "footfall_push" | "balanced",
      "min_booking_ideas": 1-4,
      "min_footfall_ideas": 1-5,
      "reasoning": "Why this trigger matters (or doesn't)"
    },
    "FIRST_WEEKEND": {
      "enabled": true/false,
      "mode": "footfall_push",
      "min_footfall_ideas": 2-5,
      "min_booking_ideas": 1-2,
      "reasoning": "Why this trigger matters (or doesn't)"
    },
    "PAYDAY_PERIOD": {
      "enabled": true/false,
      "mode": "footfall_push",
      "min_footfall_ideas": 2-5,
      "min_booking_ideas": 1-2,
      "reasoning": "Why this trigger matters (or doesn't)"
    },
    "WEATHER_BREAK": {
      "enabled": true/false,
      "mode": "footfall_push",
      "min_footfall_ideas": 3-5,
      "min_booking_ideas": 1-2,
      "reasoning": "Why this trigger matters (or doesn't)"
    },
    "LOCAL_EVENT": {
      "enabled": true/false,
      "mode": "balanced",
      "min_booking_ideas": 2-3,
      "min_footfall_ideas": 2-3,
      "reasoning": "Why this trigger matters (or doesn't)"
    }
  },
  
  "summary_text": "3-4 sentence explanation in conversational tone. Use general terms and example triggers, not exhaustive lists. Explain what drives commercial success for THIS specific business and what's NOT relevant. Mention seasonal patterns if applicable.",
  
  "confidence_score": 0.0-1.0,
  "key_factors": ["array", "of", "main", "decision", "factors"]
}
\`\`\`

## TRIGGER DEFINITIONS

**VD_WEEK** - Valentine's Day & romantic occasions (week of Feb 12-14)
- Relevant for: Restaurants with reservations, upscale/romantic positioning, fine dining. Check business_description for "restaurant", "aftensmad" (dinner), "cocktails", "bar", late evening hours (e.g., "02:00").
- Not relevant for: Fast casual, coffee shops, non-dining businesses

**MD_WEEK** - Mother's Day & family celebrations (week before 2nd Sunday of May)
- Relevant for: Brunch service, family-friendly venues (kids menu), restaurants
- Not relevant for: Bars, nightlife, business-only venues

**FD_WEEK** - Father's Day & similar (week before in June)
- Relevant for: Restaurants, venues with outdoor spaces, casual dining, family-friendly (kids menu)
- Not relevant for: Formal fine dining without family appeal, cafés

**FIRST_WEEKEND** - First weekend of each month
- Relevant for: Casual venues, residential neighborhoods, walk-in focused
- Not relevant for: Upscale destination dining, tourist-focused

**PAYDAY_PERIOD** - Around 15th and end of month
- Relevant for: Residential areas, casual/moderate pricing, local regulars
- Not relevant for: Tourist destinations, upscale dining

**WEATHER_BREAK** - First warm day (20°C+) in spring, terrace season
- Relevant for: Outdoor seating, waterfront, terraces, beer gardens
- Not relevant for: Indoor-only venues (no outdoor seating)

**LOCAL_EVENT** - High commercial-weight events from contextual calendar
- Relevant for: Most businesses, especially in tourist/event areas
- Context-dependent: booking vs footfall based on event type

## DECISION LOGIC GUIDELINES

**Baseline Mode Selection:**
- **booking_push**: Has reservation system + upscale/fine dining + special occasion positioning. Check business_description for keywords: "restaurant", "aftensmad" (dinner), "cocktails", "bar", late hours.
- **footfall_push**: No reservations OR casual positioning OR residential location
- **balanced**: Mixed signals or moderate positioning. Hybrid venues (café + restaurant + bar) often fit here.

**Quota Guidelines:**
- Upscale with reservations: Higher booking quotas (3-4 ideas)
- Casual/neighborhood: Higher footfall quotas (4-5 ideas)
- Outdoor seating present: Weather trigger should have high footfall quota
- Kids menu available: Mother's Day and Father's Day triggers should be enabled
- Brunch service: Mother's Day trigger should be enabled
- Tourist areas: Local events more relevant
- Residential: Payday and weekend patterns more relevant

**Confidence Score:**
- 0.9+: Clear business model, strong signals, confident recommendations
- 0.7-0.9: Good understanding, minor ambiguities
- 0.5-0.7: Mixed signals, default to safe balanced approach
- <0.5: Insufficient data, use conservative defaults

**Summary Text Style:**
- Start with primary commercial driver ("Your outdoor terrace...", "As an upscale restaurant...")
- Mention 2-3 example triggers, not all of them
- Explain what's NOT relevant and why
- Keep conversational and specific to this business
- Use general terms like "seasonal events and public holidays" not exhaustive lists

## IMPORTANT RULES

1. **Hybrid venues**: If business_description contains multiple service formats (e.g., "café, restaurant og bar", "brunch, frokost, aftensmad", "cocktails"), treat this as a multi-format operation. Don't let single signals (e.g., kids_menu=true) override the full picture. Keywords like "restaurant", "aftensmad" (dinner), "cocktails", "bar", and late hours (e.g., "02:00") indicate romantic occasion relevance.

2. **Be decisive**: Don't enable everything. Fewer, more relevant triggers are better.
3. **Consider business reality**: Don't recommend booking strategies for businesses without reservations.
4. **Respect positioning**: Upscale venues and casual cafés have different commercial rhythms.
5. **Location matters**: Residential vs tourist vs business district changes everything.
6. **Weather relevance**: Only enable weather triggers if outdoor seating is available (has_outdoor_seating = true).
7. **Family occasions**: Mother's/Father's Day matter for family-friendly venues (kids menu, brunch service), not for bars/nightlife.
8. **Calendar patterns**: First weekend and payday are for casual/neighborhood, not destination dining.
9. **Seasonal offerings**: If menu has seasonal items, mention this as a strength for event-based triggers.
10. **Recurring events**: If weekly_programme is provided, consider it when evaluating LOCAL_EVENT trigger.

${closerMessage}`;
}
