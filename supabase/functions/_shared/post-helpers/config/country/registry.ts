/**
 * Country Registry
 *
 * Register a country by:
 *   1. Creating a new file `<code>.ts` implementing `CountryProfile` (see dk.ts as template)
 *   2. Importing it here and adding it to REGISTRY
 *   3. Setting `country: '<CODE>'` on WeekContext for businesses in that country
 *
 * See README.md for the full checklist.
 */

import type { CountryProfile } from './interfaces.ts';
import { DK_COUNTRY_PROFILE } from './dk.ts';

const REGISTRY: Record<string, CountryProfile> = {
  DK: DK_COUNTRY_PROFILE,
  // Add more countries here:
  // SE: SE_COUNTRY_PROFILE,
  // NO: NO_COUNTRY_PROFILE,
  // DE: DE_COUNTRY_PROFILE,
  // NL: NL_COUNTRY_PROFILE,
};

/**
 * Returns the CountryProfile for the given ISO 3166-1 alpha-2 country code.
 *
 * Throws if the country is not registered — never silently falls back to a default.
 * Callers should pass `context.country` (which defaults to 'DK' for existing businesses).
 */
export function getCountryProfile(code: string): CountryProfile {
  const profile = REGISTRY[code?.toUpperCase()];
  if (!profile) {
    throw new Error(
      `[CountryRegistry] No profile registered for country code: "${code}". ` +
      `Add it to supabase/functions/_shared/post-helpers/config/country/registry.ts.`
    );
  }
  return profile;
}

/**
 * Returns true if a CountryProfile is registered for the given code.
 * Useful for validation at edge-function entry points.
 */
export function isCountrySupported(code: string): boolean {
  return !!(REGISTRY[code?.toUpperCase()]);
}
