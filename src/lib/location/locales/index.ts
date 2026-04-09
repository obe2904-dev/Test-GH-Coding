import { LocaleConfig, SupportedLocale, CountryCode } from '../core/types';
import { LOCALE_DA_DK } from './da-DK';
import { LOCALE_EN_US } from './en-US';
// import { LOCALE_SV_SE } from './sv-SE';

/**
 * Registry of all supported locales
 */
const LOCALE_REGISTRY: Record<SupportedLocale, LocaleConfig> = {
  'da-DK': LOCALE_DA_DK,
  'en-US': LOCALE_EN_US,
  'sv-SE': LOCALE_DA_DK, // Fallback to Danish until sv-SE is created
  'no-NO': LOCALE_DA_DK, // Fallback to Danish until no-NO is created
  'de-DE': LOCALE_DA_DK, // Fallback to Danish until de-DE is created
  'es-ES': LOCALE_DA_DK, // Fallback to Danish until es-ES is created
};

/**
 * Country to default locale mapping
 */
const COUNTRY_TO_LOCALE: Record<CountryCode, SupportedLocale> = {
  'DK': 'da-DK',
  'US': 'en-US',
  'SE': 'sv-SE',
  'NO': 'no-NO',
  'DE': 'de-DE',
  'ES': 'es-ES'
};

/**
 * Get locale configuration by locale code
 */
export function getLocaleConfig(locale: SupportedLocale): LocaleConfig {
  const config = LOCALE_REGISTRY[locale];
  if (!config) {
    throw new Error(`Unsupported locale: ${locale}`);
  }
  return config;
}

/**
 * Get locale configuration by country code
 */
export function getLocaleConfigByCountry(country: CountryCode): LocaleConfig {
  const locale = COUNTRY_TO_LOCALE[country];
  if (!locale) {
    throw new Error(`No locale mapping for country: ${country}`);
  }
  return getLocaleConfig(locale);
}

/**
 * Get all supported locales
 */
export function getSupportedLocales(): SupportedLocale[] {
  return Object.keys(LOCALE_REGISTRY) as SupportedLocale[];
}

/**
 * Check if locale is supported
 */
export function isLocaleSupported(locale: string): locale is SupportedLocale {
  return locale in LOCALE_REGISTRY;
}
