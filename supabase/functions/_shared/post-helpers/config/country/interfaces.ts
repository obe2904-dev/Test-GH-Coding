/**
 * Country Profile Interfaces
 *
 * Every country must implement CountryProfile to be registered.
 * See README.md for how to add a new country.
 */

export type SeasonName = 'winter' | 'spring' | 'summer' | 'autumn';

/**
 * Historical climate data for one month in a specific country/region.
 * Based on long-term climate normals (e.g. DMI 1991–2020) — NOT the current week's forecast.
 */
export interface MonthClimate {
  /** Historical average maximum temperature (°C) */
  avg_max_temp: number;
  /** Historical average minimum temperature (°C) */
  avg_min_temp: number;
  /** Average number of rainy days per month */
  avg_rain_days: number;
  /**
   * Whether outdoor dining is a realistic guest expectation this month in this country.
   * Based on climate norms, not the current week's forecast.
   */
  outdoor_viable: boolean;
  /**
   * One-sentence baseline label, injected verbatim into AI prompts when the week's
   * weather is NOT newsworthy — prevents AI from dramatising normal seasonal conditions.
   * Example: "april dk: 12°C maks — foråret begynder men udeservering ikke normalt endnu"
   */
  baseline_label: string;
}

/**
 * Seasonal data for one calendar month — local produce availability and behavioral signals.
 */
export interface SeasonMonth {
  current: SeasonName;
  /**
   * Ingredients currently available from local producers this month.
   * Only surfaced to AI when the ingredient also appears on the business's menu
   * (matched via deriveSeasonalSignals). Never injected raw.
   */
  ingredients: Array<{
    /** Ingredient name as it appears in Danish menu text */
    name: string;
    /** Specific content hook for this ingredient this month */
    content_hook: string;
  }>;
  /**
   * Abstract behavioral descriptors — no ingredient names.
   * Safe to pass directly to the AI as atmosphere/mood context.
   * Per-month precision prevents wrong signals (e.g. "spontane besøg" for April DK = wrong).
   */
  behavioral_signals: string[];
  /**
   * Ingredient names that SOUND seasonal but are NOT available this month in this country.
   * Used by the forbidden-phrase guard to flag false positives in AI output.
   * Example for DK April: ['tomater', 'agurk', 'jordbær']
   */
  unavailable_false_positives: string[];
}

/**
 * Full country profile — implement this interface for every country.
 * Keys are calendar months 1–12.
 */
export interface CountryProfile {
  country_code: string;
  /** Climate baseline per month (1–12) */
  climate_baseline: Record<number, MonthClimate>;
  /** Seasonal produce and behavioral signals per month (1–12) */
  season_calendar: Record<number, SeasonMonth>;
}
