import { LocaleConfig } from '../../core/types';
import { CATEGORIES_DA } from './categories';
import { KNOWN_LOCATIONS_DA } from './known-locations';
import { KEYWORDS_DA } from './keywords';
import { TIME_PATTERNS_DA } from './time-patterns';
import { AI_PROMPTS_DA } from './ai-prompts';

export const LOCALE_DA_DK: LocaleConfig = {
  locale: 'da-DK',
  country: 'DK',
  language: 'da',
  categories: CATEGORIES_DA,
  knownLocations: KNOWN_LOCATIONS_DA,
  keywords: KEYWORDS_DA,
  culturalKnowledge: {},
  timePatterns: TIME_PATTERNS_DA,
  aiPrompts: AI_PROMPTS_DA
};

// Helper to extract cultural knowledge from known locations
Object.entries(KNOWN_LOCATIONS_DA).forEach(([city, locations]) => {
  locations.forEach(location => {
    if (location.culturalContext) {
      const key = `${city}:${location.identifier}`;
      LOCALE_DA_DK.culturalKnowledge[key] = location.culturalContext;
    }
  });
});

export * from './categories';
export * from './known-locations';
export * from './keywords';
export * from './time-patterns';
export * from './ai-prompts';
