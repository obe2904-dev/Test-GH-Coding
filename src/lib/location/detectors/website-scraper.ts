/**
 * Website Content Scraper
 * Extracts location context from business websites
 */

import { LocaleConfig } from '../core/types';

export interface WebsiteContext {
  textContent: string;
  businessName: string | null;
  locationKeywords: string[];
  hasLocationDescription: boolean;
}

/**
 * Scrape website for location context (client-side version)
 * Note: Full scraping requires server-side proxy to avoid CORS
 */
export async function scrapeWebsiteForLocationContext(
  _websiteUrl: string,
  _localeConfig: LocaleConfig
): Promise<WebsiteContext | null> {
  try {
    // Client-side limitation: Can't fetch cross-origin without CORS
    // This would need to be implemented as a server-side function
    // For now, return null and rely on other detection methods
    
    console.log('Website scraping requires server-side implementation');
    
    return {
      textContent: '',
      businessName: null,
      locationKeywords: [],
      hasLocationDescription: false
    };
  } catch (error) {
    console.error('Website scraping error:', error);
    return null;
  }
}

/**
 * Extract location keywords from text (utility for future server-side implementation)
 */
export function extractLocationKeywords(
  text: string,
  localeConfig: LocaleConfig
): string[] {
  const foundKeywords: string[] = [];
  const normalizedText = text.toLowerCase();
  
  // Check all keyword categories
  const allKeywords = [
    ...localeConfig.keywords.waterfront,
    ...localeConfig.keywords.cityCenter,
    ...localeConfig.keywords.tourist,
    ...localeConfig.keywords.residential
  ];
  
  for (const keyword of allKeywords) {
    if (normalizedText.includes(keyword.toLowerCase())) {
      foundKeywords.push(keyword);
    }
  }
  
  return [...new Set(foundKeywords)]; // Remove duplicates
}
