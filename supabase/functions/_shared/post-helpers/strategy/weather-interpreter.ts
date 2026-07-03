/**
 * Weather Interpreter
 * -------------------
 * Converts raw DayWeather forecast data into a structured interpretation that
 * Phase 0 and Phase 1 prompts can use directly — without re-deriving conditions
 * from raw temperature/precipitation numbers inside the AI.
 *
 * Design principle: all logic lives here in TypeScript, not in the AI prompt.
 * The AI receives pre-computed conclusions and a one-sentence operational note.
 */

import type { WeekWeather } from '../types/strategy-types.ts';
import { getCountryProfile, isCountrySupported } from '../config/country/registry.ts';
import { assessOutdoorComfort, assessWeekOutdoorViability } from './weather-comfort-tiers.ts';
import { WEATHER_THRESHOLDS } from './weather-thresholds.ts';

export interface WeatherInterpretation {
  indoor_outdoor_bias: 'strongly_indoor' | 'lean_indoor' | 'neutral' | 'lean_outdoor' | 'strongly_outdoor';
  strongest_opportunity_day?: string;  // Weekday name in Danish, e.g. 'lørdag'
  strongest_constraint_day?: string;   // Weekday name, e.g. 'mandag'
  weekend_usability: 'good' | 'mixed' | 'poor';
  forecast_confidence: 'high' | 'medium' | 'low'; // Based on reliability of forecast days
  operational_note: string; // One-sentence practical implication for content strategy
  /**
   * True when this week's weather deviates meaningfully from the monthly climate baseline.
   * False = weather is within normal range → suppress weather as a strategic narrative signal.
   * Thresholds: avg_temp > baseline_avg_max + 3°C, OR baseline_outdoor_viable=false but forecast ≥ 15°C.
   */
  weather_is_newsworthy: boolean;
  /** Whether outdoor dining is a realistic expectation for this calendar month (from country baseline). */
  baseline_outdoor_viable: boolean;
  precipitation_days: string[];   // Danish weekday names where condition is rain/snow OR precipitation_chance >= 60
  week_character: string;         // Temperature range + dominant cloud/sun character (no precipitation attribution)
}

const WEEKDAY_DK = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];

export function interpretWeather(
  weather: WeekWeather,
  hasOutdoorSeating: boolean,
  locationType: string,
  servicePeriods: string[],
  countryCode: string = 'DK',
  month?: number,
): WeatherInterpretation {
  const days = weather.days;

  // Derive month from first forecast day if not provided
  const effectiveMonth = month ?? (days[0]?.date ? new Date(days[0].date).getMonth() + 1 : new Date().getMonth() + 1);

  // Look up climate baseline (safe — fall back to non-newsworthy if country unknown)
  let baseline_outdoor_viable = false;
  let baseline_avg_max = 15; // Conservative neutral default
  let weather_is_newsworthy = false;
  try {
    if (isCountrySupported(countryCode)) {
      const profile = getCountryProfile(countryCode);
      const climate = profile.climate_baseline[effectiveMonth];
      if (climate) {
        baseline_outdoor_viable = climate.outdoor_viable;
        baseline_avg_max = climate.avg_max_temp;
        // Weather is newsworthy when it deviates meaningfully from the monthly norm
        // Uses unified thresholds from WEATHER_THRESHOLDS.NEWSWORTHY
        const forecastAvgMax = days.length > 0
          ? days.reduce((s, d) => s + d.temp_max, 0) / days.length
          : weather.avg_temp;
        const unexpectedlyWarm = forecastAvgMax >= baseline_avg_max + WEATHER_THRESHOLDS.NEWSWORTHY.tempDeltaC;
        const outdoorFlip = !climate.outdoor_viable && forecastAvgMax >= WEATHER_THRESHOLDS.NEWSWORTHY.unexpectedOutdoorTempMin;
        const unexpectedlyCold = climate.outdoor_viable && forecastAvgMax <= climate.avg_min_temp - WEATHER_THRESHOLDS.NEWSWORTHY.tempDeltaC;
        weather_is_newsworthy = unexpectedlyWarm || outdoorFlip || unexpectedlyCold;
      }
    }
  } catch {
    // Unknown country — treat as non-newsworthy to avoid false positives
    weather_is_newsworthy = false;
  }

  // Assess each day using weighted comfort tier system
  const scored = days.map(d => {
    const assessment = assessOutdoorComfort(d);
    return {
      date: d.date,
      weekday: WEEKDAY_DK[new Date(d.date).getDay()],
      score: assessment.score, // 0-100 weighted score
      tier: assessment.tier,
      feelsLike: assessment.feelsLike,
      reliability: d.reliability,
      condition: d.condition,
      temp_max: d.temp_max,
    };
  });

  // Aggregate outdoor score for the week (average of reliable days)
  const reliableDays = scored.filter(d => d.reliability !== 'seasonal');
  const avgScore = reliableDays.length > 0
    ? reliableDays.reduce((s, d) => s + d.score, 0) / reliableDays.length
    : scored.reduce((s, d) => s + d.score, 0) / Math.max(scored.length, 1);

  // Determine indoor/outdoor bias based on weighted score (0-100 scale)
  // If no outdoor seating: always indoor-biased (but weather still affects footfall)
  let indoor_outdoor_bias: WeatherInterpretation['indoor_outdoor_bias'];
  if (!hasOutdoorSeating) {
    indoor_outdoor_bias = avgScore <= 30 ? 'strongly_indoor'
      : avgScore <= 50 ? 'lean_indoor'
      : 'neutral'; // Good weather → neutral (it drives footfall but venue is indoor)
  } else {
    // With outdoor seating, use tier-based scoring
    indoor_outdoor_bias = avgScore >= 80 ? 'strongly_outdoor'   // Premium range
      : avgScore >= 60 ? 'lean_outdoor'       // Viable range
      : avgScore >= 40 ? 'neutral'            // Marginal range
      : avgScore >= 20 ? 'lean_indoor'        // Low marginal
      : 'strongly_indoor';                    // Unviable
  }

  // Best and worst days
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  // Opportunity day: score ≥50 (at least marginal-tier outdoor conditions)
  const strongest_opportunity_day = best && best.score >= 50 ? best.weekday : undefined;
  // Constraint day: score ≤20 (unviable outdoor conditions)
  const strongest_constraint_day = worst && worst.score <= 20 ? worst.weekday : undefined;

  // Weekend usability (Saturday + Sunday)
  const weekendDays = scored.filter(d => WEATHER_THRESHOLDS.WEEKEND_DAYS.includes(d.weekday as any));
  const weekendAvg = weekendDays.length > 0
    ? weekendDays.reduce((s, d) => s + d.score, 0) / weekendDays.length
    : avgScore;
  const weekend_usability: WeatherInterpretation['weekend_usability'] =
    weekendAvg >= 65 ? 'good' : weekendAvg >= 45 ? 'mixed' : 'poor';

  // Forecast confidence: based on reliability field across the week
  // Uses unified thresholds from WEATHER_THRESHOLDS.FORECAST_CONFIDENCE
  const specificCount = days.filter(d => d.reliability === 'specific').length;
  const forecast_confidence: WeatherInterpretation['forecast_confidence'] =
    specificCount >= WEATHER_THRESHOLDS.FORECAST_CONFIDENCE.highConfidenceDays ? 'high'
    : specificCount >= WEATHER_THRESHOLDS.FORECAST_CONFIDENCE.mediumConfidenceDays ? 'medium'
    : 'low';

  // Build the operational note (pass scored days for nuanced contrast detection)
  const operational_note = buildOperationalNote(
    indoor_outdoor_bias,
    strongest_opportunity_day,
    strongest_constraint_day,
    weekend_usability,
    hasOutdoorSeating,
    weather.avg_temp,
    scored,
  );

  // Compute precipitation_days: only days with actual wet conditions
  // Uses unified threshold from WEATHER_THRESHOLDS.PRECIPITATION_DAY
  const PRECIP_CONDITIONS = new Set<string>(['rain', 'snow']);
  const precipitation_days: string[] = days
    .filter(d => PRECIP_CONDITIONS.has(d.condition) || (d.precipitation_chance ?? 0) >= WEATHER_THRESHOLDS.PRECIPITATION_DAY.precipProbMin)
    .map(d => WEEKDAY_DK[new Date(d.date).getDay()]);

  // Compute week_character: temperature range + cloud/sun character (no precipitation attribution)
  const tempMin = Math.min(...days.map(d => d.temp_min));
  const tempMax = Math.max(...days.map(d => d.temp_max));
  const sunnyCount = days.filter(d => d.condition === 'sunny').length;
  const heavyCloudCount = days.filter(d => ['cloudy', 'rain', 'snow', 'fog'].includes(d.condition)).length;
  const cloudLabel = sunnyCount >= 4 ? 'overvejende sol'
    : heavyCloudCount >= 5 ? 'overvejende skyet'
    : 'blandet skyet til sol';
  const week_character = `${tempMin}–${tempMax}°C, ${cloudLabel}`;

  return {
    indoor_outdoor_bias,
    strongest_opportunity_day,
    strongest_constraint_day,
    weekend_usability,
    forecast_confidence,
    operational_note,
    precipitation_days,
    week_character,
    weather_is_newsworthy,
    baseline_outdoor_viable,
  };
}

function buildOperationalNote(
  bias: WeatherInterpretation['indoor_outdoor_bias'],
  bestDay: string | undefined,
  worstDay: string | undefined,
  weekend: WeatherInterpretation['weekend_usability'],
  hasOutdoor: boolean,
  avgTemp: number,
  scored: Array<{ weekday: string; score: number; condition: string; temp_max: number }>,
): string {
  // Build day-by-day contrast description for nuanced weeks
  // e.g., "Mon-Thu rain 11-15°C, Fri-Sat sunny 22°C" instead of just "mixed week"
  const weekdays = scored.filter(d => !WEATHER_THRESHOLDS.WEEKEND_DAYS.includes(d.weekday as any));
  const weekendDays = scored.filter(d => WEATHER_THRESHOLDS.WEEKEND_DAYS.includes(d.weekday as any));
  
  const weekdayAvgScore = weekdays.length > 0 ? weekdays.reduce((s, d) => s + d.score, 0) / weekdays.length : 0;
  const weekendAvgScore = weekendDays.length > 0 ? weekendDays.reduce((s, d) => s + d.score, 0) / weekendDays.length : 0;
  
  // Detect weekday vs weekend contrast (common pattern: rainy weekdays, sunny weekend)
  // Adjusted for 0-100 scale: 30-point difference is significant
  const hasWeekdayWeekendContrast = Math.abs(weekdayAvgScore - weekendAvgScore) >= 30;
  
  if (hasWeekdayWeekendContrast && weekendAvgScore > weekdayAvgScore) {
    // Good weekend despite bad weekdays
    const weekendTemps = weekendDays.map(d => d.temp_max);
    const weekendMax = Math.max(...weekendTemps);
    return hasOutdoor
      ? `Blandet uge: ${worstDay ? worstDay + ' sværest' : 'kølige hverdage'}, men ${bestDay ?? 'weekend'} oplagt til udeservering (${weekendMax}°C).`
      : `Variabelt vejr: kølige hverdage men pæn weekend (${weekendMax}°C) driver footfall.`;
  }
  
  if (hasWeekdayWeekendContrast && weekdayAvgScore > weekendAvgScore) {
    // Good weekdays but poor weekend
    return `Usædvanligt mønster: pæne hverdage men ${weekend === 'poor' ? 'dårlig weekend' : 'blandet weekend'}.`;
  }
  
  // No strong contrast - use existing logic with adjusted thresholds for 0-100 scale
  if (bias === 'strongly_outdoor' && bestDay) {
    return hasOutdoor
      ? `Fremragende udedags vejr — ${bestDay} er den stærkeste dag og weekenden er oplagt til udeservering.`
      : `Dejligt sommervejr driver folk ud af hjemmet — god uge til footfall-fokuseret content.`;
  }
  if (bias === 'lean_outdoor' && bestDay) {
    return hasOutdoor
      ? `Godt vejr til udeservering, særligt ${bestDay}. Weekend-usability: ${weekend}.`
      : `Fint vejr ${avgTemp}°C — content kan spille på at folk er ude og aktive.`;
  }
  if (bias === 'neutral') {
    if (weekend === 'good') return `Blandede hverdage men god weekend — prioritér weekend-content.`;
    if (weekend === 'poor') return `Stabilt men ikke opsigtsvækkende vejr — fokusér på indendørs oplevelse og comfort.`;
    return `Variabelt vejr denne uge — brug indsigt om ${bestDay ?? 'bedste dag'} som mulighed og ${worstDay ?? 'sværeste dag'} som innekos-anker.`;
  }
  if (bias === 'lean_indoor') {
    return worstDay
      ? `Køligt/ustadigt vejr — særligt ${worstDay} er en indendørs dag. Prioritér comfort-content og hyggelige interiør-billeder.`
      : `Køligt vejr ${avgTemp}°C — indendørs stemning og varme retter er det rigtige anker.`;
  }
  // strongly_indoor
  return `Dårligt vejr hele ugen — content skal spille på indendørs komfort, varme og ly. ${worstDay ? `${worstDay} er den sværeste dag.` : ''}`.trim();
}
