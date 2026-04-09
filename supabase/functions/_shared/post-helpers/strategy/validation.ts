/**
 * VALIDATION: Validate strategy output structure, data integrity, and content rules.
 */

import type { WeekContext, StrategicBrief, SuggestedMediaType, Platform } from '../types/strategy-types.ts';

export interface ValidationResult {
  passed: boolean;
  critical_errors: string[];
  warnings: string[];
}

export function validateStrategyOutput(
  raw: any,
  context: WeekContext,
  targetPostCount: number,
  strategicBrief?: StrategicBrief
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // CRITICAL: Structure checks
  if (!raw.narrative?.headline) errors.push('Mangler headline');
  if (!raw.narrative?.overview) errors.push('Mangler overview');
  if (!Array.isArray(raw.post_ideas)) errors.push('post_ideas er ikke et array');
  if (!Array.isArray(raw.strategic_priorities)) errors.push('strategic_priorities er ikke et array');

  if (errors.length > 0) return { passed: false, critical_errors: errors, warnings };

  // CRITICAL: Post idea count (allow ±1 tolerance)
  if (raw.post_ideas.length !== targetPostCount) {
    if (Math.abs(raw.post_ideas.length - targetPostCount) > 1) {
      errors.push(`Forventede ${targetPostCount} post-idéer, fik ${raw.post_ideas.length}`);
    } else {
      warnings.push(`Forventede ${targetPostCount} post-idéer, fik ${raw.post_ideas.length} (accepteret med tolerance)`);
    }
  }

  // CRITICAL: No invented menu items (basic check)
  const allKnownItems = [
    ...(context.signature_items ?? []).map(i => i.name.toLowerCase()),
    ...(context.season.ingredients_in_season ?? []).map(i => i.toLowerCase()),
  ];

  raw.post_ideas.forEach((idea: any) => {
    if (idea.content_type === 'menu_item') {
      const titleLower = idea.title.toLowerCase();
      const isKnownItem = allKnownItems.some(item => titleLower.includes(item));
      const isGeneric = ['varm', 'kold', 'sæson', 'special', 'dagens'].some(g => titleLower.includes(g));
      if (!isKnownItem && !isGeneric) {
        warnings.push(`Post-idé "${idea.title}" refererer muligvis til ukendt menu-item`);
      }
    }
  });

  // Build set of Phase 1 angle focuses
  const briefAngleFocuses = new Set<string>(
    (strategicBrief?.angles || [])
      .map(a => (a?.focus || '').trim())
      .filter(Boolean)
  );

  // CRITICAL: Strategic priorities reference Phase 1 angles
  if (raw.strategic_priorities) {
    raw.strategic_priorities.forEach((priority: any, index: number) => {
      const focus = priority.focus;
      if (!focus || typeof focus !== 'string' || focus.trim().length === 0) {
        errors.push(`Strategic priority at index ${index} missing or invalid focus value`);
        return;
      }
      if (briefAngleFocuses.size > 0 && !briefAngleFocuses.has(focus.trim())) {
        errors.push(
          `Strategic priority "${focus}" does not match any Phase 1 angle focus. Must be one of: ${Array.from(briefAngleFocuses).join(' | ')}`
        );
      }
    });
  }

  // AUTO-CORRECT: Max 3 strategic priorities
  if (raw.strategic_priorities && raw.strategic_priorities.length > 3) {
    console.warn(`[Layer 0] Too many priorities (${raw.strategic_priorities.length}), merging to 3`);
    warnings.push(`${raw.strategic_priorities.length} prioriteter reduceret til 3`);
    raw.strategic_priorities.sort((a: any, b: any) => (b.weight || 0) - (a.weight || 0));
    const kept = raw.strategic_priorities.slice(0, 3);
    const removed = raw.strategic_priorities.slice(3);
    const removedWeight = removed.reduce((sum: number, p: any) => sum + (p.weight || 0), 0);
    kept[2].weight = Math.round((kept[2].weight + removedWeight) * 100) / 100;
    raw.strategic_priorities = kept;
  }

  // AUTO-CORRECT: Normalize strategic weights to sum to 1.0
  const weightSum = raw.strategic_priorities.reduce((sum: number, p: any) => sum + (p.weight || 0), 0);
  if (Math.abs(weightSum - 1.0) > 0.001) {
    if (weightSum > 0) {
      warnings.push(`Strategiske vægte summerede til ${weightSum.toFixed(2)}, normaliseret til 1.0`);
      raw.strategic_priorities.forEach((p: any) => {
        p.weight = Math.round((p.weight / weightSum) * 1000) / 1000;
      });
      // Fix rounding drift on last element
      const newSum = raw.strategic_priorities.reduce((s: number, p: any) => s + p.weight, 0);
      if (Math.abs(newSum - 1.0) > 0.001) {
        raw.strategic_priorities[raw.strategic_priorities.length - 1].weight =
          Math.round((raw.strategic_priorities[raw.strategic_priorities.length - 1].weight + (1.0 - newSum)) * 1000) / 1000;
      }
    } else {
      errors.push(`Strategiske vægte summerer til ${weightSum.toFixed(2)}, kan ikke normalisere`);
    }
  }

  // CRITICAL: Dates within available days
  const availableDates = new Set(context.available_days);
  raw.post_ideas.forEach((idea: any) => {
    if (idea.suggested_day && !availableDates.has(idea.suggested_day)) {
      errors.push(`Post-idé "${idea.title}" har dato ${idea.suggested_day} som ikke er i tilgængelige dage`);
    }
  });

  // CRITICAL: Platform validation
  const validPlatforms = new Set(context.platforms);
  raw.post_ideas.forEach((idea: any) => {
    if (!idea.platforms || !Array.isArray(idea.platforms) || idea.platforms.length === 0) {
      errors.push(`Post-idé "${idea.title}" mangler platforms`);
    } else {
      idea.platforms.forEach((p: string) => {
        if (!validPlatforms.has(p as Platform)) {
          errors.push(`Post-idé "${idea.title}" har platform "${p}" som ikke er aktiv`);
        }
      });
    }
  });

  // WARNING: Media type validation
  const validMediaTypes: SuggestedMediaType[] = ['photo', 'photo_reel', 'carousel'];
  raw.post_ideas.forEach((idea: any) => {
    if (!idea.suggested_media) {
      warnings.push(`Post-idé "${idea.title}" mangler suggested_media`);
    } else if (!validMediaTypes.includes(idea.suggested_media.type)) {
      warnings.push(`Post-idé "${idea.title}" har ukendt medie-type: ${idea.suggested_media.type}`);
    }
  });

  // WARNING: CTA intent validation
  const validCTAIntents = ['booking', 'engagement', 'awareness', 'event_promo', 'traffic'];
  raw.post_ideas.forEach((idea: any) => {
    if (!idea.cta_intent) {
      warnings.push(`Post-idé "${idea.title}" mangler cta_intent`);
    } else if (!validCTAIntents.includes(idea.cta_intent)) {
      warnings.push(`Post-idé "${idea.title}" har ukendt cta_intent: ${idea.cta_intent}`);
    }
  });

  // CRITICAL: Each post references a Phase 1 angle
  if (briefAngleFocuses.size > 0 && Array.isArray(raw.post_ideas)) {
    raw.post_ideas.forEach((idea: any) => {
      const angleFocus = idea?.angle_focus;
      if (!angleFocus || typeof angleFocus !== 'string' || angleFocus.trim().length === 0) {
        errors.push(`Post-idé "${idea?.title || '(uden titel)'}" mangler angle_focus`);
        return;
      }
      if (!briefAngleFocuses.has(angleFocus.trim())) {
        errors.push(
          `Post-idé "${idea?.title || '(uden titel)'}" har angle_focus="${angleFocus}" som ikke matcher Phase 1 angles`
        );
      }
    });
  }

  // WARNING: Post distribution vs Phase 1 weights
  if (strategicBrief?.angles?.length && Array.isArray(raw.post_ideas) && raw.post_ideas.length > 0) {
    const N = raw.post_ideas.length;
    const actual = new Map<string, number>();
    for (const idea of raw.post_ideas) {
      const k = String(idea?.angle_focus || '').trim();
      if (!k) continue;
      actual.set(k, (actual.get(k) || 0) + 1);
    }

    const angles = strategicBrief.angles
      .map(a => ({ focus: String(a?.focus || '').trim(), weight: Number(a?.weight) || 0 }))
      .filter(a => a.focus && a.weight > 0);

    if (angles.length > 0) {
      const parts = angles.map(a => {
        const ideal = a.weight * N;
        const base = Math.floor(ideal);
        return { ...a, ideal, base, rem: ideal - base };
      });
      let allocated = parts.reduce((s, x) => s + x.base, 0);
      let remaining = Math.max(0, N - allocated);
      const expected = new Map<string, number>();
      parts.forEach(p => expected.set(p.focus, p.base));
      parts.sort((a, b) => b.rem - a.rem).slice(0, remaining).forEach(p => expected.set(p.focus, (expected.get(p.focus) || 0) + 1));

      const tolerance = 1;
      for (const a of angles) {
        const exp = expected.get(a.focus) ?? 0;
        const act = actual.get(a.focus) ?? 0;
        if (Math.abs(act - exp) > tolerance) {
          warnings.push(`Angle distribution off for "${a.focus}": expected ~${exp}/${N}, got ${act}/${N}`);
        }
      }
    }
  }

  // WARNING: Too many reels
  const reelCount = raw.post_ideas.filter((i: any) => i.suggested_media?.type === 'photo_reel').length;
  if (reelCount > Math.ceil(targetPostCount * 0.5)) {
    warnings.push(`For mange photo_reels (${reelCount}/${targetPostCount}) - kan være urealistisk for brugeren`);
  }

  // WARNING: No-repeat check
  raw.post_ideas.forEach((idea: any) => {
    if (context.previous_week.posted_menu_items.some(
      item => idea.title.toLowerCase().includes(item.toLowerCase())
    )) {
      warnings.push(`Post-idé "${idea.title}" ligner en post fra sidste uge`);
    }
  });

  // CRITICAL: Weather hallucination check
  const weatherConditions = context.weather.days.map(d => d.condition);
  const hasSunny = weatherConditions.some(c => c === 'sunny');

  raw.post_ideas.forEach((idea: any) => {
    const titleLower = (idea.title + ' ' + idea.rationale).toLowerCase();
    if (!hasSunny && (titleLower.includes('solskin') || titleLower.includes('sol ') || titleLower.includes('solen'))) {
      errors.push(`KRITISK: Post-idé "${idea.title}" nævner solskin, men vejret er IKKE solrigt.`);
    }
    const hasGenericDrink = ['kaffe', 'te ', 'the', 'drinks', 'drikkevarer'].some(term => titleLower.includes(term));
    const isInSignature = (context.signature_items ?? []).some(item => titleLower.includes(item.name.toLowerCase()));
    if (hasGenericDrink && !isInSignature) {
      warnings.push(`Post-idé "${idea.title}" nævner generisk drik som ikke er i signatur-items`);
    }
  });

  // WARNING: Seasonal ingredient mention without menu presence
  const narrativeText = JSON.stringify(raw.narrative).toLowerCase();
  context.season.ingredients_in_season.forEach((ingredient: string) => {
    if (narrativeText.includes(ingredient.toLowerCase())) {
      const isOnMenu = (context.signature_items ?? []).some(item =>
        item.name.toLowerCase().includes(ingredient.toLowerCase())
      );
      if (!isOnMenu) {
        warnings.push(`Narrativ nævner sæsoningrediens "${ingredient}" som IKKE er på menuen`);
      }
    }
  });

  // WARNING: Narrative length
  const totalWords = [
    raw.narrative.overview,
    raw.narrative.detailed_sections?.weather_season,
    raw.narrative.detailed_sections?.events,
    raw.narrative.detailed_sections?.business_advantage,
    raw.narrative.detailed_sections?.post_plan,
  ].filter(Boolean).join(' ').split(' ').length;

  if (totalWords > 350) {
    warnings.push(`Narrativ er ${totalWords} ord, anbefalet max 300`);
  }

  if (warnings.length > 0) {
    console.warn('[STRATEGY VALIDATION WARNINGS]', {
      business_name: context.business_name,
      week_number: context.week_number,
      warnings,
      timestamp: new Date().toISOString(),
    });
  }

  return {
    passed: errors.length === 0,
    critical_errors: errors,
    warnings,
  };
}
