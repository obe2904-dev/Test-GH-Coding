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

export interface WeatherInterpretation {
  indoor_outdoor_bias: 'strongly_indoor' | 'lean_indoor' | 'neutral' | 'lean_outdoor' | 'strongly_outdoor';
  strongest_opportunity_day?: string;  // Weekday name in Danish, e.g. 'lørdag'
  strongest_constraint_day?: string;   // Weekday name, e.g. 'mandag'
  weekend_usability: 'good' | 'mixed' | 'poor';
  forecast_confidence: 'high' | 'medium' | 'low'; // Based on reliability of forecast days
  operational_note: string; // One-sentence practical implication for content strategy
  precipitation_days: string[];   // Danish weekday names where condition is rain/snow OR precipitation_chance >= 60
  week_character: string;         // Temperature range + dominant cloud/sun character (no precipitation attribution)
}

const WEEKDAY_DK = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];

/**
 * Score a single day for outdoor viability (0 = terrible, 10 = perfect).
 * Uses Danish outdoor-dining thresholds: min 15°C, low rain, low wind.
 */
function outdoorScore(day: { temp_max: number; precipitation_chance?: number; wind_speed?: number }): number {
  let score = 0;

  // Temperature: 15°C minimum, ideal 18-25°C
  if (day.temp_max >= 25) score += 4;
  else if (day.temp_max >= 20) score += 3;
  else if (day.temp_max >= 18) score += 2;
  else if (day.temp_max >= 15) score += 1;
  // Below 15°C: 0 points

  // Rain: low chance is good
  const rain = day.precipitation_chance ?? 0;
  if (rain <= 15) score += 3;
  else if (rain <= 30) score += 2;
  else if (rain <= 50) score += 1;
  // Above 50%: 0 points

  // Wind: low wind is good
  const wind = day.wind_speed ?? 0;
  if (wind <= 4) score += 3;
  else if (wind <= 7) score += 2;
  else if (wind <= 10) score += 1;
  // Above 10 m/s: 0 points

  return score; // max 10
}

export function interpretWeather(
  weather: WeekWeather,
  hasOutdoorSeating: boolean,
  locationType: string,
  servicePeriods: string[],
): WeatherInterpretation {
  const days = weather.days;

  // Score each day
  const scored = days.map(d => ({
    date: d.date,
    weekday: WEEKDAY_DK[new Date(d.date).getDay()],
    score: outdoorScore(d),
    reliability: d.reliability,
  }));

  // Aggregate outdoor score for the week (average of reliable days)
  const reliableDays = scored.filter(d => d.reliability !== 'seasonal');
  const avgScore = reliableDays.length > 0
    ? reliableDays.reduce((s, d) => s + d.score, 0) / reliableDays.length
    : scored.reduce((s, d) => s + d.score, 0) / Math.max(scored.length, 1);

  // Determine indoor/outdoor bias
  // If no outdoor seating: always indoor-biased (but weather still affects footfall)
  let indoor_outdoor_bias: WeatherInterpretation['indoor_outdoor_bias'];
  if (!hasOutdoorSeating) {
    indoor_outdoor_bias = avgScore <= 3 ? 'strongly_indoor'
      : avgScore <= 5 ? 'lean_indoor'
      : 'neutral'; // Good weather → neutral (it drives footfall but venue is indoor)
  } else {
    indoor_outdoor_bias = avgScore >= 8 ? 'strongly_outdoor'
      : avgScore >= 6 ? 'lean_outdoor'
      : avgScore >= 4 ? 'neutral'
      : avgScore >= 2 ? 'lean_indoor'
      : 'strongly_indoor';
  }

  // Best and worst days
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  const strongest_opportunity_day = best && best.score >= 5 ? best.weekday : undefined;
  const strongest_constraint_day = worst && worst.score <= 2 ? worst.weekday : undefined;

  // Weekend usability (Saturday + Sunday)
  const weekendDays = scored.filter(d => ['lørdag', 'søndag'].includes(d.weekday));
  const weekendAvg = weekendDays.length > 0
    ? weekendDays.reduce((s, d) => s + d.score, 0) / weekendDays.length
    : avgScore;
  const weekend_usability: WeatherInterpretation['weekend_usability'] =
    weekendAvg >= 6 ? 'good' : weekendAvg >= 3 ? 'mixed' : 'poor';

  // Forecast confidence: based on reliability field across the week
  const specificCount = days.filter(d => d.reliability === 'specific').length;
  const forecast_confidence: WeatherInterpretation['forecast_confidence'] =
    specificCount >= 5 ? 'high' : specificCount >= 3 ? 'medium' : 'low';

  // Build the operational note
  const operational_note = buildOperationalNote(
    indoor_outdoor_bias,
    strongest_opportunity_day,
    strongest_constraint_day,
    weekend_usability,
    hasOutdoorSeating,
    weather.avg_temp,
  );

  // Compute precipitation_days: only days with actual wet conditions
  const PRECIP_CONDITIONS = new Set<string>(['rain', 'snow']);
  const precipitation_days: string[] = days
    .filter(d => PRECIP_CONDITIONS.has(d.condition) || (d.precipitation_chance ?? 0) >= 60)
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
  };
}

function buildOperationalNote(
  bias: WeatherInterpretation['indoor_outdoor_bias'],
  bestDay: string | undefined,
  worstDay: string | undefined,
  weekend: WeatherInterpretation['weekend_usability'],
  hasOutdoor: boolean,
  avgTemp: number,
): string {
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
