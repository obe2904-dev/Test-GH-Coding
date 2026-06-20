// supabase/functions/_shared/helpers/country-to-language.ts
/**
 * Map country code to ISO 639-1 language code
 * Used to filter menu_items_normalized by menu_language matching business country
 */

export function countryToLanguageCode(country: string | null | undefined): string {
  if (!country) return 'da' // Default to Danish
  
  const countryUpper = country.toUpperCase()
  
  // Map country codes and names to language codes
  const mapping: Record<string, string> = {
    // Nordic countries
    'DK': 'da',
    'DENMARK': 'da',
    'SE': 'sv',
    'SWEDEN': 'sv',
    'NO': 'no',
    'NORWAY': 'no',
    'FI': 'fi',
    'FINLAND': 'fi',
    'IS': 'is',
    'ICELAND': 'is',
    
    // English-speaking countries
    'GB': 'en',
    'UK': 'en',
    'UNITED KINGDOM': 'en',
    'GREAT BRITAIN': 'en',
    'US': 'en',
    'USA': 'en',
    'UNITED STATES': 'en',
    'IE': 'en',
    'IRELAND': 'en',
    'AU': 'en',
    'AUSTRALIA': 'en',
    'NZ': 'en',
    'NEW ZEALAND': 'en',
    'CA': 'en',
    'CANADA': 'en',
    
    // Other European countries
    'DE': 'de',
    'GERMANY': 'de',
    'FR': 'fr',
    'FRANCE': 'fr',
    'ES': 'es',
    'SPAIN': 'es',
    'IT': 'it',
    'ITALY': 'it',
    'NL': 'nl',
    'NETHERLANDS': 'nl',
    'PL': 'pl',
    'POLAND': 'pl',
    'PT': 'pt',
    'PORTUGAL': 'pt',
  }
  
  return mapping[countryUpper] || 'da' // Default to Danish if unknown
}
