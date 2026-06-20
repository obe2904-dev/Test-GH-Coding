// ============================================================================
// VOICE ARCHETYPE SYSTEM
// ============================================================================
// Prescriptive professional voice rules for business type × location combinations
// Provides concrete, measurable rules instead of vague tone descriptions
// ============================================================================

import type { BusinessType } from './business-type-detection.ts';
import type { LocationType, CitySize } from './geographic-context.ts';

export type ArchetypeName =
  | 'versatile_casual_waterfront'       // hybrid cafe + waterfront
  | 'versatile_casual_urban'            // hybrid cafe + urban/downtown
  | 'elevated_local_authentic'          // fine dining + small town
  | 'elevated_sophisticated'            // fine dining + capital/large city
  | 'coffee_enthusiast_accessible'      // coffee bar (any location)
  | 'wine_intimate_educated'            // wine bar
  | 'cocktail_energetic_visual'         // cocktail bar
  | 'bakery_warm_craft'                 // bakery cafe
  | 'restaurant_approachable';          // default restaurant

export interface VoiceArchetype {
  archetype_name: ArchetypeName;
  base_rules: string[];               // Concrete Danish rules
  formality_level: string;
  sentence_structure: string;
  professional_standards: string;
  location_context_weight: 'high' | 'medium' | 'low';  // How much to emphasize location
  content_priorities: string[];
}

// ============================================================================
// ARCHETYPE SELECTION
// ============================================================================

export function getVoiceArchetype(
  businessType: BusinessType,
  locationType: LocationType,
  citySize: CitySize | null
): VoiceArchetype {
  
  // ========================================
  // HYBRID CAFE + WATERFRONT
  // ========================================
  if (businessType === 'hybrid_cafe' && locationType === 'waterfront_leisure') {
    return {
      archetype_name: 'versatile_casual_waterfront',
      base_rules: [
        'Max 15 ord per sætning - start med hovedsagen (tid, ret, eller sted)',
        'Nævn location (ved åen/ved havnen/ved stranden) når relevant - det er jeres USP',
        'Brug konkrete tider (kl. 10-14, kl. 17-22) ikke vage tidsangivelser',
        'Nævn konkrete retter fra menu - ikke kategorier ("avocadotoast" ikke "lækker brunch")',
        'Outdoor/terrasse skal fremhæves når vejr/sæson er relevant',
        'Time-segment klart: hvad tilbyder I hvornår'
      ],
      formality_level: 'casual_friend',
      sentence_structure: 'short_declarative',
      professional_standards: 'concrete_over_abstract',
      location_context_weight: 'high',
      content_priorities: [
        'location advantage (waterfront USP)',
        'time-specific offers',
        'menu variety',
        'outdoor/seasonal appeal'
      ]
    };
  }
  
  // ========================================
  // HYBRID CAFE + URBAN/DOWNTOWN
  // ========================================
  if (businessType === 'hybrid_cafe' && 
      (locationType === 'urban_neighborhood' || locationType === 'downtown_commercial')) {
    return {
      archetype_name: 'versatile_casual_urban',
      base_rules: [
        'Max 15 ord per sætning - start med hovedsagen',
        'Brug konkrete tider (kl. 10-14, kl. 17-22) for time-segment clarity',
        'Nævn konkrete retter fra menu',
        'Convenience og quick service kan fremhæves (frokost, takeaway)',
        'Neighborhood-tilhørsforhold hvis relevant',
        'Multi-programme versatilitet skal være tydelig'
      ],
      formality_level: 'casual_friend',
      sentence_structure: 'short_declarative',
      professional_standards: 'concrete_over_abstract',
      location_context_weight: 'medium',
      content_priorities: [
        'time-specific offers',
        'menu variety',
        'convenience positioning',
        'urban lifestyle fit'
      ]
    };
  }
  
  // ========================================
  // FINE DINING + SMALL TOWN
  // ========================================
  if (businessType === 'fine_dining' && citySize === 'small_town') {
    return {
      archetype_name: 'elevated_local_authentic',
      base_rules: [
        'Fokus på ingredienser og deres oprindelse - nævn producent når relevant',
        'Beskriv teknik og håndværk uden at være teknisk',
        'Fremhæv lokal tilknytning og community (lille by = personligt)',
        'Balance elegance med tilgængelighed - sofistikeret men ikke snobbet',
        'Chef\'s vision og seasonal menus driver narrativ',
        'Sanselig beskrivelse af mad og oplevelse'
      ],
      formality_level: 'sophisticated_warm',
      sentence_structure: 'descriptive_flowing',
      professional_standards: 'quality_craftsmanship_focus',
      location_context_weight: 'medium',
      content_priorities: [
        'ingredient quality and provenance',
        'local sourcing',
        'chef craftsmanship',
        'community connection'
      ]
    };
  }
  
  // ========================================
  // FINE DINING + CAPITAL/LARGE CITY
  // ========================================
  if (businessType === 'fine_dining' && 
      (citySize === 'capital' || citySize === 'medium_city')) {
    return {
      archetype_name: 'elevated_sophisticated',
      base_rules: [
        'Fokus på ingredienser, teknik, og chef\'s creativity',
        'Sanselig beskrivelse af mad og oplevelse',
        'Differentiation gennem unique concept eller gastronomisk angle',
        'Balance elegance med tilgængelighed',
        'Seasonal menus og tasting experiences',
        'Visual storytelling essentielt'
      ],
      formality_level: 'sophisticated_warm',
      sentence_structure: 'descriptive_flowing',
      professional_standards: 'quality_craftsmanship_focus',
      location_context_weight: 'low',
      content_priorities: [
        'ingredients and technique',
        'chef creativity',
        'tasting experience',
        'gastronomic positioning'
      ]
    };
  }
  
  // ========================================
  // COFFEE BAR (Any location)
  // ========================================
  if (businessType === 'coffee_bar') {
    return {
      archetype_name: 'coffee_enthusiast_accessible',
      base_rules: [
        'Nævn coffee specifics (bean origin, brewing method) men hold det tilgængeligt',
        'Balance coffee nørderi med casual everyday appeal',
        'Fokus på håndværk uden at være elitær',
        'Quick visit messaging - takeaway, "kom og få en hurtig flat white"',
        'Daily routine positioning ("din daglige kaffe")',
        'Community og stamkunde-feeling'
      ],
      formality_level: 'casual_enthusiast',
      sentence_structure: 'conversational',
      professional_standards: 'quality_accessibility_balance',
      location_context_weight: 'low',
      content_priorities: [
        'coffee quality and sourcing',
        'daily routine',
        'craftsmanship',
        'accessibility'
      ]
    };
  }
  
  // ========================================
  // WINE BAR
  // ========================================
  if (businessType === 'wine_bar') {
    return {
      archetype_name: 'wine_intimate_educated',
      base_rules: [
        'Vin præsenteres tilgængeligt - ikke pretentiøst',
        'Pairing-forslag og anbefalinger skaber værdi',
        'Intimacy og atmosphere er salgsargumenter',
        'Evening destination positioning',
        'Natural wine/alternative wines education uden at være elitær',
        'Wine stories og producer-connections'
      ],
      formality_level: 'sophisticated_warm',
      sentence_structure: 'conversational',
      professional_standards: 'expertise_invites_in',
      location_context_weight: 'low',
      content_priorities: [
        'wine selection and stories',
        'pairing suggestions',
        'evening atmosphere',
        'wine education'
      ]
    };
  }
  
  // ========================================
  // COCKTAIL BAR
  // ========================================
  if (businessType === 'cocktail_bar') {
    return {
      archetype_name: 'cocktail_energetic_visual',
      base_rules: [
        'Visuelt content prioriteres (cocktails er Instagram-guld)',
        'Cocktail names og inspiration-stories',
        'Technique og ingredients fremhævet kreativt',
        'Evening/weekend destination positioning',
        'Atmosphere, music, vibe lige så vigtig som drinks',
        'Energisk og inviterende tone'
      ],
      formality_level: 'casual_friend',
      sentence_structure: 'short_declarative',
      professional_standards: 'visual_energy_focus',
      location_context_weight: 'low',
      content_priorities: [
        'cocktail creations and stories',
        'bar atmosphere',
        'weekend destination',
        'visual drink content'
      ]
    };
  }
  
  // ========================================
  // BAKERY CAFE
  // ========================================
  if (businessType === 'bakery_cafe') {
    return {
      archetype_name: 'bakery_warm_craft',
      base_rules: [
        'Freshness og daily-baked er primære salgsargumenter',
        'Craft og håndværk fremhævet tilgængeligt',
        'Morning routine og breakfast positioning',
        'Visual content af bagning/produkter essentielt',
        'Comfort food følelser og warmth',
        'Varm og inviterende tone'
      ],
      formality_level: 'casual_friend',
      sentence_structure: 'conversational',
      professional_standards: 'warmth_craft_balance',
      location_context_weight: 'low',
      content_priorities: [
        'fresh-baked daily',
        'baking craftsmanship',
        'breakfast and morning',
        'comfort and warmth'
      ]
    };
  }
  
  // ========================================
  // DEFAULT: RESTAURANT
  // ========================================
  return {
    archetype_name: 'restaurant_approachable',
    base_rules: [
      'Menu-highlights og chef-anbefalinger',
      'Seasonal ingredients og skiftende menu',
      'Dining experience storytelling',
      'Balance mellem food-fokus og atmosphere',
      'Accessibility og approachability',
      'Mad-kvalitet kommunikeret tilgængeligt'
    ],
    formality_level: 'casual_friend',
    sentence_structure: 'conversational',
    professional_standards: 'quality_accessibility',
    location_context_weight: 'medium',
    content_priorities: [
      'menu highlights',
      'seasonal ingredients',
      'dining experience',
      'food quality'
    ]
  };
}

// ============================================================================
// EXTRACT MAX WORDS FROM RULES
// ============================================================================

export function extractMaxWordsFromRules(rules: string[]): number | null {
  for (const rule of rules) {
    const match = rule.match(/max (\d+) ord/i);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  return null;
}
