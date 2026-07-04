/**
 * Business Archetype Inference
 * 
 * Auto-detects the business archetype from operational data during brand profile generation.
 * This provides a validated, persistent classification that prevents week-to-week inconsistency.
 * 
 * Detection logic analyzes:
 * - Service periods (brunch, lunch, dinner)
 * - Opening hours and late-night service
 * - Menu programmes (timing and meal types)
 * - Business character description
 */

import type { BusinessArchetype } from '../post-helpers/types/strategy-types.ts';

interface ArchetypeDetectionInput {
  service_periods?: string[];
  late_night_closing?: boolean;
  menu_programmes?: Array<{
    name: string;
    available_from?: string;
    available_until?: string;
  }>;
  business_character?: string;
  opening_hours?: {
    earliest_open?: string;
    latest_close?: string;
  };
}

/**
 * Infer business archetype from operational characteristics
 * 
 * Priority order:
 * 1. Service periods and timing (most reliable)
 * 2. Late-night operation (nightlife indicator)
 * 3. Menu programmes (backup inference)
 * 4. Business character text analysis (fallback)
 */
export function inferBusinessArchetype(input: ArchetypeDetectionInput): BusinessArchetype {
  const {
    service_periods = [],
    late_night_closing = false,
    menu_programmes = [],
    business_character = '',
    opening_hours
  } = input;

  // Normalize service periods to lowercase
  const periods = service_periods.map(p => p.toLowerCase());

  // --- Priority 1: Service Period Analysis ---
  
  const hasBrunch = periods.includes('brunch');
  const hasLunch = periods.includes('lunch') || periods.includes('frokost');
  const hasDinner = periods.includes('dinner') || periods.includes('middag');
  const hasMorning = periods.includes('morning') || periods.includes('breakfast');

  // Dinner-only restaurant
  if (hasDinner && !hasLunch && !hasBrunch && !hasMorning) {
    const charLower = business_character.toLowerCase();
    if (charLower.includes('fine dining') || charLower.includes('gourmet') || charLower.includes('michelin')) {
      return 'fine_dining';
    }
    return 'dinner_restaurant';
  }

  // Lunch-only restaurant
  if (hasLunch && !hasDinner && !hasBrunch && !hasMorning) {
    return 'lunch_restaurant';
  }

  // Brunch specialist (brunch-only)
  if (hasBrunch && !hasLunch && !hasDinner) {
    return 'brunch_specialist';
  }

  // Full-service restaurant (lunch + dinner)
  if ((hasLunch || hasBrunch) && hasDinner) {
    const charLower = business_character.toLowerCase();
    
    // Fine dining
    if (charLower.includes('fine dining') || charLower.includes('gourmet')) {
      return 'fine_dining';
    }
    
    // Restaurant-bar hybrid (has dinner service + late-night bar component)
    if (late_night_closing || charLower.includes('bar') || charLower.includes('cocktail')) {
      return 'restaurant_bar';
    }
    
    return 'full_service_restaurant';
  }

  // All-day cafe (morning/brunch + lunch, no dinner)
  if ((hasMorning || hasBrunch) && hasLunch && !hasDinner) {
    return 'all_day_cafe';
  }

  // Morning cafe (morning-only, no lunch/dinner)
  if (hasMorning && !hasLunch && !hasDinner && !hasBrunch) {
    return 'morning_cafe';
  }

  // Brunch cafe (brunch + possibly lunch, closes mid-afternoon)
  if (hasBrunch && !hasDinner) {
    return 'brunch_cafe';
  }

  // --- Priority 2: Late-Night Operation (only if no food service detected) ---
  
  // Late-night bar (opens after midnight or stays open past 1am, no lunch/dinner service)
  if (late_night_closing && !hasLunch && !hasDinner && !hasBrunch) {
    const charLower = business_character.toLowerCase();
    if (charLower.includes('natteliv') || charLower.includes('nightlife') || charLower.includes('club')) {
      return 'nightlife_bar';
    }
    return 'late_night_bar';
  }

  // --- Priority 3: Business Character Text Analysis ---
  
  const charLower = business_character.toLowerCase();

  // Hybrid cafe/bar (look for dual identity in description)
  if ((charLower.includes('café') || charLower.includes('kaffe')) && 
      (charLower.includes('bar') || charLower.includes('vin') || charLower.includes('wine'))) {
    if (charLower.includes('om aftenen') || charLower.includes('evening') || charLower.includes('skifter')) {
      return 'cafe_bar';
    }
  }

  // Wine bar
  if (charLower.includes('vinbar') || charLower.includes('wine bar') || charLower.includes('naturvin')) {
    return 'wine_bar';
  }

  // Evening bar (cocktails, drinks)
  if ((charLower.includes('bar') || charLower.includes('cocktail')) && 
      (charLower.includes('aften') || charLower.includes('evening'))) {
    return 'evening_bar';
  }

  // Coffee shop
  if (charLower.includes('kaffebar') || charLower.includes('coffee shop') || 
      charLower.includes('espresso') || charLower.includes('specialty coffee')) {
    return 'coffee_shop';
  }

  // Bakery
  if (charLower.includes('bageri') || charLower.includes('bakery') || 
      charLower.includes('konditori') || charLower.includes('patisserie')) {
    return 'bakery';
  }

  // Quick service / fast casual
  if (charLower.includes('takeaway') || charLower.includes('street food') || 
      charLower.includes('food truck') || charLower.includes('quick service')) {
    return 'fast_casual';
  }

  // --- Priority 3: Menu Programme Analysis ---
  
  if (menu_programmes.length > 0) {
    const programmeNames = menu_programmes.map(p => p.name.toLowerCase());
    
    // Check for brunch programme
    const hasBrunchProgramme = programmeNames.some(n => 
      n.includes('brunch') || n.includes('morgenmad'));
    
    // Check for dinner programme
    const hasDinnerProgramme = programmeNames.some(n => 
      n.includes('dinner') || n.includes('middag') || n.includes('aften'));
    
    if (hasBrunchProgramme && hasDinnerProgramme) {
      return 'full_service_restaurant';
    }
    
    if (hasBrunchProgramme && !hasDinnerProgramme) {
      return 'all_day_cafe';
    }
  }

  // --- Priority 4: Opening Hours Analysis (if available) ---
  
  if (opening_hours?.earliest_open && opening_hours?.latest_close) {
    const earliestHour = parseInt(opening_hours.earliest_open.split(':')[0]);
    const latestHour = parseInt(opening_hours.latest_close.split(':')[0]);
    
    // Opens early (before 9am), closes before dinner time (before 6pm)
    if (earliestHour < 9 && latestHour < 18) {
      return 'morning_cafe';
    }
    
    // Opens late (after 5pm), closes late (after 11pm)
    if (earliestHour >= 17 && latestHour >= 23) {
      return 'evening_bar';
    }
  }

  // --- Default Fallback ---
  
  // If we have any service periods, default to casual dining
  if (periods.length > 0) {
    return 'casual_dining';
  }

  // Absolute fallback: cafe_bistro (most flexible archetype)
  return 'cafe_bistro';
}

/**
 * Get human-readable description of business archetype for logging
 */
export function getArchetypeDescription(archetype: BusinessArchetype): string {
  const descriptions: Record<BusinessArchetype, string> = {
    fine_dining: 'Fine dining restaurant with upscale service',
    casual_dining: 'Casual dining restaurant',
    cafe_bistro: 'Cafe bistro with flexible service',
    cafe_bar: 'Hybrid cafe by day, bar by night',
    restaurant_bar: 'Full-service restaurant with late-night bar',
    wine_bar: 'Wine-focused bar',
    coffee_shop: 'Specialty coffee shop',
    quick_service: 'Quick service / fast casual',
    bakery: 'Bakery or patisserie',
    morning_cafe: 'Morning-only cafe',
    brunch_cafe: 'Brunch-focused cafe',
    all_day_cafe: 'All-day cafe (morning through afternoon)',
    lunch_restaurant: 'Lunch-only restaurant',
    dinner_restaurant: 'Dinner-only restaurant',
    full_service_restaurant: 'Full-service restaurant (lunch + dinner)',
    evening_bar: 'Evening drinks venue',
    late_night_bar: 'Late-night bar (open past 1am)',
    nightlife_bar: 'Nightlife-focused bar or club',
    brunch_specialist: 'Brunch specialist',
    fast_casual: 'Fast casual or counter service'
  };
  
  return descriptions[archetype] || archetype;
}
