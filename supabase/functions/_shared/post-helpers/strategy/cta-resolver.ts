/**
 * CTA RESOLVER — DETERMINISTIC CTA INTENT SELECTION
 *
 * Decides which cta_intent a post should use based on:
 *   1. Event proximity  (upcoming event within lead window → event_promo)
 *   2. Business capability  (no table service → never booking)
 *   3. Economic timing  (salary week → push booking / budget week → back off)
 *   4. Week position  (last post anchors the weekend → booking)
 *   5. Post type default  (menu_item → engagement, non-menu → awareness)
 *
 * This is PURE logic — no AI calls. Called once per post slot in Phase 2.
 */

import type { WeekContext, CTAIntent, EconomicPattern } from '../types/strategy-types.ts';

export interface CtaResolutionResult {
  intent: CTAIntent;
  reason: string;  // For logging — helps trace why a CTA was chosen
}

/**
 * Resolve the appropriate CTA intent for a single post slot.
 *
 * @param postType  - 'menu_item' | 'atmosphere' | 'behind_scenes' | 'seasonal'
 * @param context   - Full WeekContext
 * @param isLastPost - Whether this is the final post in the week's plan
 */
export function resolveCtaIntent(
  postType: string,
  context: WeekContext,
  isLastPost: boolean,
): CtaResolutionResult {

  const hasTableService = context.location?.has_table_service !== false;
  const economicPattern: EconomicPattern = context.economic.pattern;
  const isMenuPost = postType === 'menu_item';

  // 1. OVERRIDE: Upcoming event within its recommended lead window
  //    e.g. 6 days to Valentinsdag (lead=7) → event_promo
  const nearbyEvent = context.events.find(e =>
    e.days_away >= 0 && e.days_away <= (e.recommended_lead_days ?? 7)
  );
  if (nearbyEvent) {
    return {
      intent: 'event_promo',
      reason: `Event "${nearbyEvent.name_dk || nearbyEvent.name}" om ${nearbyEvent.days_away} dage (lead: ${nearbyEvent.recommended_lead_days ?? 7} dage)`,
    };
  }

  // 2. NO TABLE SERVICE → booking CTA makes no sense
  if (!hasTableService) {
    return {
      intent: isMenuPost ? 'engagement' : 'awareness',
      reason: 'Ingen bordbetjening — booking CTA ikke relevant',
    };
  }

  // 3. BUDGET-CONSCIOUS (week 4 / end of month) → don't push financial commitment
  if (economicPattern === 'budget_conscious') {
    return {
      intent: isMenuPost ? 'engagement' : 'awareness',
      reason: 'Uge 4/4 — folk overvejer udgifter, booking-push uegnet',
    };
  }

  // 4. HIGH-SPEND WINDOWS with table service → push booking on last post(s)
  const isHighSpend =
    economicPattern === 'salary_week' ||
    economicPattern === 'december_high' ||
    economicPattern === 'july_vacation';

  if (isHighSpend && isLastPost) {
    return {
      intent: 'booking',
      reason: `${translatePattern(economicPattern)} + ugens sidste post → book bord-opfordring`,
    };
  }

  // 5. NORMAL SPEND: anchor the weekend on the last post
  if (isLastPost && (economicPattern === 'normal_spend' || isHighSpend)) {
    return {
      intent: 'booking',
      reason: 'Ugens afsluttende post → weekend-ankring med booking-CTA',
    };
  }

  // 6. SALARY WEEK — middle posts can still nudge towards booking (non-menu only)
  if (isHighSpend && !isMenuPost) {
    return {
      intent: 'booking',
      reason: `${translatePattern(economicPattern)} — stemnosposts opfordrer til at reservere`,
    };
  }

  // 7. DEFAULT: post-type baseline
  return {
    intent: isMenuPost ? 'engagement' : 'awareness',
    reason: 'Standard: produkt → engagement, stemning → awareness',
  };
}

function translatePattern(pattern: EconomicPattern): string {
  switch (pattern) {
    case 'salary_week':    return 'Lønningsuge';
    case 'december_high':  return 'December-høj';
    case 'july_vacation':  return 'Feriemåned';
    case 'normal_spend':   return 'Normalt forbrug';
    case 'budget_conscious': return 'Budgetuge';
    default: return pattern;
  }
}
