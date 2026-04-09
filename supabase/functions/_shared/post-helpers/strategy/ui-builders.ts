/**
 * PROGRAMMATIC UI BUILDERS
 * Build context_summary and strategy_reasoning deterministically from Phase 0/1 data.
 * No AI calls — no hallucination risk.
 */

import type { WeekContext, StrategicBrief } from '../types/strategy-types.ts';

// ============================================================
// INTERFACES
// ============================================================

export interface ContextFactorUI {
  icon: string;
  title: string;
  subtitle: string;
  impact: string;
  color: 'blue' | 'green' | 'orange' | 'red' | 'gray';
}

export interface ContextSummary {
  headline: string;
  key_factors: ContextFactorUI[];
}

export interface StrategyReasoning {
  primary_angle: string;
  reasoning_chain: Array<{
    angle: string;
    weight_pct: number;
    why: string;
    addresses: string;
  }>;
  content_mix_summary: string;
}

// ============================================================
// WEATHER PATTERN TRANSLATOR
// ============================================================

export function translateWeatherPattern(pattern: string): string {
  const map: Record<string, string> = {
    cold_week: 'Kold uge',
    hot_week: 'Varm uge',
    mild_week: 'Mild uge',
    mixed_week: 'Blandet vejr',
    rainy_week: 'Regnfuld uge',
  };
  return map[pattern] || pattern;
}

// ============================================================
// CONTEXT SUMMARY BUILDER
// ============================================================

/**
 * Bygger brugervenlig context_summary fra rå data.
 * Deterministisk — ingen AI, ingen hallucination.
 * Vises i UI som fakta-kort med ikoner.
 */
export function buildContextSummaryFromData(
  context: WeekContext,
  strategicBrief: StrategicBrief,
): ContextSummary {
  const factors: ContextFactorUI[] = [];

  // ── VEJR ──
  const avgTemp = context.weather.avg_temp;
  const pattern = context.weather.pattern;

  if (pattern === 'cold_week' || avgTemp < 5) {
    factors.push({
      icon: '🥶',
      title: `Koldt vejr (${avgTemp}°C)`,
      subtitle: translateWeatherPattern(pattern),
      impact: avgTemp < 0
        ? 'Gæster søger varme og ly — fokus på indendørs hygge'
        : 'Comfort food og varme drikke passer godt',
      color: 'blue',
    });
  } else if (pattern === 'hot_week' || avgTemp > 20) {
    factors.push({
      icon: '☀️',
      title: `Varmt vejr (${avgTemp}°C)`,
      subtitle: translateWeatherPattern(pattern),
      impact: context.weather.has_outdoor_seating
        ? 'Perfekt til udeservering — vis terrassen'
        : 'Kolde drikke og lette retter i fokus',
      color: 'orange',
    });
  } else if (pattern === 'rainy_week') {
    factors.push({
      icon: '🌧️',
      title: `Regnvejr (${avgTemp}°C)`,
      subtitle: translateWeatherPattern(pattern),
      impact: 'Folk søger ly — spontane besøg stiger',
      color: 'gray',
    });
  } else {
    factors.push({
      icon: '🌤️',
      title: `${avgTemp}°C gennemsnit`,
      subtitle: translateWeatherPattern(pattern),
      impact: 'Behageligt vejr — bred menu-appel',
      color: 'green',
    });
  }

  // ── VIND (kun hvis relevant) ──
  const weatherDays = context.weather.days || [];
  const avgWind = weatherDays.length > 0
    ? weatherDays.reduce((sum, d) => sum + (d.wind_speed || 0), 0) / weatherDays.length
    : 0;
  if (avgWind > 5 && context.weather.has_outdoor_seating) {
    factors.push({
      icon: '💨',
      title: `Blæsende (${Math.round(avgWind)} m/s)`,
      subtitle: 'Påvirker udeservering',
      impact: 'Udeservering mindre attraktiv — fokus indendørs',
      color: 'gray',
    });
  }

  // ── EVENTS ──
  if (context.events.length > 0) {
    const nearestEvent = context.events.sort((a, b) => a.days_away - b.days_away)[0];
    factors.push({
      icon: '📅',
      title: nearestEvent.name_dk || nearestEvent.name,
      subtitle: nearestEvent.days_away === 0
        ? 'I dag!'
        : `Om ${nearestEvent.days_away} dage`,
      impact: nearestEvent.strategic_angle || 'Mulighed for tematisk indhold',
      color: 'orange',
    });
  }

  // ── ØKONOMISK TIMING ──
  const econ = context.economic;
  if (econ.pattern === 'salary_week') {
    factors.push({
      icon: '💰',
      title: 'Lønningsuge',
      subtitle: `Uge ${econ.week_of_month} i måneden`,
      impact: 'Folk har råd til at forkæle sig — vis premium-retter',
      color: 'green',
    });
  } else if (econ.pattern === 'budget_conscious') {
    factors.push({
      icon: '💸',
      title: 'Slutningen af måneden',
      subtitle: `Uge ${econ.week_of_month} i måneden`,
      impact: 'Fokus på value-for-money og frokosttilbud',
      color: 'gray',
    });
  } else if (econ.pattern === 'december_high') {
    factors.push({
      icon: '🎄',
      title: 'December højsæson',
      subtitle: 'Julefrokoster og firmaarrangementer',
      impact: 'Højt forbrug — vis julemenuen og booking-muligheder',
      color: 'red',
    });
  }

  // ── SÆSON ──
  const seasonIcons: Record<string, string> = { winter: '❄️', spring: '🌱', summer: '🌻', autumn: '🍂' };
  const seasonNames: Record<string, string> = { winter: 'Vinter', spring: 'Forår', summer: 'Sommer', autumn: 'Efterår' };
  factors.push({
    icon: seasonIcons[context.season.current] || '📆',
    title: seasonNames[context.season.current] || context.season.current,
    subtitle: `Sæson-ingredienser: ${(context.season.ingredients_in_season || []).slice(0, 3).join(', ') || 'Ingen'}`,
    impact: (context.season.out_of_season || []).length > 0
      ? `Undgå: ${(context.season.out_of_season || []).slice(0, 2).join(', ')}`
      : 'Alle sæson-ingredienser tilgængelige',
    color: 'green',
  });

  // ── MENU STYRKE ──
  const signatureItems = context.signature_items || [];
  if (signatureItems.length >= 5) {
    factors.push({
      icon: '🍽️',
      title: `${signatureItems.length} signaturretter`,
      subtitle: signatureItems.slice(0, 3).map((i: any) => i.name ?? i).join(', '),
      impact: 'Stærk menu til produkt-posts',
      color: 'green',
    });
  }

  // ── UDESERVERING ──
  if (context.weather.has_outdoor_seating && avgTemp > 12 && avgWind < 5) {
    factors.push({
      icon: '🪑',
      title: 'Udeservering mulig',
      subtitle: `${avgTemp}°C, stille vind`,
      impact: 'Vis terrasse/udeområde i posts',
      color: 'green',
    });
  }

  const sorted = factors.slice(0, 5);
  const headline = `${sorted.length} vigtige faktorer for uge ${context.week_number}:`;

  return {
    headline,
    key_factors: sorted,
  };
}

// ============================================================
// STRATEGY REASONING BUILDER
// ============================================================

/**
 * Bygger strategy_reasoning fra Phase 1 angles.
 * Bruger AI-genereret reasoning fra Phase 1 — men formaterer deterministisk.
 */
export function buildStrategyReasoningFromAngles(
  strategicBrief: StrategicBrief,
  postPlan: Array<{ type: string; angle_focus: string }>,
): StrategyReasoning {
  const angles = strategicBrief.angles;

  const postCounts = new Map<string, { menu: number; experience: number }>();
  for (const post of postPlan) {
    const current = postCounts.get(post.angle_focus) || { menu: 0, experience: 0 };
    if (post.type === 'menu_item') {
      current.menu++;
    } else {
      current.experience++;
    }
    postCounts.set(post.angle_focus, current);
  }

  const reasoningChain = angles.map(a => {
    const counts = postCounts.get(a.focus) || { menu: 0, experience: 0 };
    const totalPosts = counts.menu + counts.experience;

    return {
      angle: a.focus,
      weight_pct: Math.round(a.weight * 100),
      why: a.reasoning || '',
      addresses: `${totalPosts} posts (${counts.menu} menu, ${counts.experience} oplevelse)`,
    };
  });

  const totalMenu = postPlan.filter(p => p.type === 'menu_item').length;
  const totalExperience = postPlan.length - totalMenu;
  const menuPct = Math.round((totalMenu / postPlan.length) * 100);
  const content_mix_summary = `${totalMenu} produkt-posts (${menuPct}%) + ${totalExperience} oplevelse-posts (${100 - menuPct}%)`;

  return {
    primary_angle: angles[0]?.focus || '',
    reasoning_chain: reasoningChain,
    content_mix_summary,
  };
}
