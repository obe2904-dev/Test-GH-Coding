/**
 * Core Offerings Detector
 * 
 * CRITICAL: Core Offerings are USAGE PATTERNS, not menu sections.
 * Menu structure is an INPUT SIGNAL that helps infer how guests use the place.
 * 
 * INFERENCE LOGIC:
 * 1. Menu sections provide evidence of WHAT is available
 * 2. Opening hours + alcohol + price + business type determine HOW it's used
 * 3. Core Offerings answer: "How do guests primarily think of and use this place?"
 * 
 * DETERMINISTIC FIRST: Calculate weighted patterns from hard data.
 * AI is ONLY used to refine labels, NOT to invent offerings.
 * 
 * WEIGHT SOURCES (COMBINED):
 * 1. Menu categories (evidence of what's available)
 * 2. Opening hours patterns (evidence of usage timing)
 * 3. Special signals (reinforcement: specialty coffee, wine list, etc.)
 * 4. Price level (influences offering nature)
 * 5. Business type (context for interpretation)
 */

import {
  StrategyDeductionInputs,
  CoreOfferings,
  CoreOfferingCandidate,
  CoreOfferingEvidence,
  CoreOfferingEvidenceCue,
  CoreOfferingIdentitySource
} from './types';
import { getPrimaryType } from '../businessTypeHelpers';

// =============================================================================
// LOCKED PRINCIPLE:
// Availability ≠ Identity.
// A core offering must be BOTH meaningfully available AND reinforced as identity.
// =============================================================================

export const AVAILABILITY_MIN = 50;
export const IDENTITY_MIN = 50;
export const TWO_SOURCE_BOOST = 15;

const INTENT_PHRASES_DA = [
  'vi fokuserer på',
  'fokus på',
  'vores koncept',
  'kendt for',
  'speciale',
  'specialitet',
  'signatur',
  'håndplukket',
  'udvalgte',
  'kurateret',
  'vi har valgt',
  'vores udvalg',
  'vores særlige',
  'vores egne'
];

const GENERIC_HEADINGS = new Set([
  'menu',
  'mad',
  'drikkevarer',
  'drikke',
  'vin',
  'øl',
  'kaffe',
  'te',
  'cocktails',
  'cocktail',
  'snacks'
]);

/**
 * Usage pattern definitions (identity-level).
 * These represent HOW guests use the place, not WHAT is on the menu.
 */
export const OFFERING_PATTERNS = {
  // Coffee-led usage patterns
  'specialty_coffee': {
    menuEvidence: ['kaffe', 'coffee', 'espresso', 'cappuccino', 'latte'],
    requiredSignals: ['hasSpecialtyCoffee'],
    hourPatterns: ['hasBreakfast'],
    minMenuShare: 0.25, // Alternative to signal: 25%+ of menu must be coffee
    description: 'Specialty coffee som identitet',
    identityType: 'product'
  },
  
  // Weekend/leisure meal patterns
  'weekend_brunch': {
    menuEvidence: ['brunch', 'morgenmad', 'breakfast', 'æg', 'eggs'],
    requiredSignals: [],
    hourPatterns: ['opensWeekends', 'hasBreakfast'], // BOTH required
    minMenuShare: 0.15,
    description: 'Weekend-brunch',
    identityType: 'timing'
  },
  
  // Weekday meal patterns
  'weekday_lunch': {
    menuEvidence: ['frokost', 'lunch', 'sandwich', 'salat'],
    requiredSignals: [],
    hourPatterns: ['hasLunch', 'opensWeekdays'], // BOTH required
    minMenuShare: 0.15,
    description: 'Hverdagsfrokost',
    identityType: 'timing'
  },
  
  'casual_dinner': {
    menuEvidence: ['middag', 'dinner', 'evening', 'main', 'hovedret', 'forret', 'dessert', 'pasta', 'pizza'],
    requiredSignals: [],
    hourPatterns: ['hasDinner'],
    minMenuShare: 0.20,
    description: 'Aftenmad / casual dining',
    identityType: 'timing'
  },
  
  // Beverage-led social patterns
  'natural_wine_focus': {
    menuEvidence: ['naturvin', 'natural wine', 'vin', 'wine'],
    requiredSignals: [],
    hourPatterns: ['hasDinner'],
    minMenuShare: 0.10,
    description: 'Naturvin / vinfokus',
    identityType: 'product'
  },
  
  'cocktails_social': {
    menuEvidence: ['cocktail', 'drinks', 'bar'],
    requiredSignals: [],
    hourPatterns: ['hasDinner', 'hasLateNight'], // At least one
    minMenuShare: 0.15,
    description: 'Cocktails og social drinks',
    identityType: 'product'
  },
  
  'craft_beer_bar': {
    menuEvidence: ['øl', 'beer', 'brewery', 'ipa', 'lager'],
    requiredSignals: [],
    hourPatterns: [],
    minMenuShare: 0.15,
    description: 'Craft beer / ølfokus',
    identityType: 'product'
  },
  
  // Experience patterns
  'late_night_bar': {
    menuEvidence: ['bar', 'drinks', 'cocktail', 'shot'],
    requiredSignals: [],
    hourPatterns: ['hasLateNight'], // REQUIRED
    minMenuShare: 0.10,
    description: 'Late-night bar',
    identityType: 'timing'
  },
  
  'quick_takeaway': {
    menuEvidence: ['takeaway', 'take away', 'to go', 'delivery'],
    requiredSignals: [],
    hourPatterns: [],
    minMenuShare: 0.10,
    description: 'Hurtig service / takeaway',
    identityType: 'product'
  },
  
  // Comfort/casual patterns
  'comfort_food': {
    menuEvidence: ['burger', 'pizza', 'fries', 'comfort', 'classic'],
    requiredSignals: [],
    hourPatterns: [],
    minMenuShare: 0.20,
    description: 'Comfort food-klassikere',
    identityType: 'product'
  },
  
  'healthy_casual': {
    menuEvidence: ['salat', 'salad', 'bowl', 'smoothie', 'juice', 'vegan', 'vegetar'],
    requiredSignals: [],
    hourPatterns: [],
    minMenuShare: 0.20,
    description: 'Sundt og friskt',
    identityType: 'product'
  }
} as const;

type OfferingId = keyof typeof OFFERING_PATTERNS;

function clamp0to100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function includesAny(haystackLower: string, needles: string[]): boolean {
  return needles.some(n => haystackLower.includes(n.toLowerCase()));
}

function hasIntentLanguage(textLower: string): boolean {
  return INTENT_PHRASES_DA.some(p => textLower.includes(p));
}

function headingLooksConceptual(heading: string): boolean {
  const cleaned = heading.trim().toLowerCase();
  if (!cleaned) return false;
  if (GENERIC_HEADINGS.has(cleaned)) return false;
  if (cleaned.length >= 28) return true; // longer headings often include intent words
  if (hasIntentLanguage(cleaned)) return true;
  // simple concept markers (generic, not per-offering)
  const conceptWords = ['signatur', 'vores', 'special', 'koncept', 'fokus', 'vinbar', 'bar', 'naturvin', 'specialkaffe'];
  return conceptWords.some(w => cleaned.includes(w));
}

function shareToAvailabilityBase(share: number): number {
  // Ratio-based tiers (not raw counts)
  if (share >= 0.4) return 70;
  if (share >= 0.3) return 60;
  if (share >= 0.2) return 50;
  if (share >= 0.15) return 45;
  if (share >= 0.1) return 35;
  if (share >= 0.05) return 20;
  return 0;
}

function buildMatchedCategories(inputs: StrategyDeductionInputs, pattern: (typeof OFFERING_PATTERNS)[OfferingId]) {
  const matched: Array<{ category: string; count: number }> = [];
  for (const [category, count] of Object.entries(inputs.menu.categories)) {
    const categoryLower = category.toLowerCase();
    if (pattern.menuEvidence.some(e => categoryLower.includes(e.toLowerCase()))) {
      matched.push({ category, count });
    }
  }
  return matched;
}

function computeMenuShare(totalItems: number, matched: Array<{ category: string; count: number }>): { matchedItems: number; share: number } {
  const matchedItems = matched.reduce((sum, item) => sum + item.count, 0);
  const share = totalItems > 0 ? matchedItems / totalItems : 0;
  return { matchedItems, share };
}

function computeAvailabilityScore(inputs: StrategyDeductionInputs, offeringId: OfferingId, totalItems: number, matchedCategories: Array<{ category: string; count: number }>): { score: number; signals: string[] } {
  const pattern = OFFERING_PATTERNS[offeringId];
  const { share } = computeMenuShare(totalItems, matchedCategories);

  let score = shareToAvailabilityBase(share);
  const signals: string[] = [];

  // Hours reinforce usage patterns
  const hourCap = 20;
  let hourPoints = 0;
  for (const hourPattern of pattern.hourPatterns) {
    if (inputs.hours[hourPattern as keyof typeof inputs.hours]) {
      hourPoints += 10;
      signals.push(`hours:${hourPattern}`);
    }
  }
  score += Math.min(hourCap, hourPoints);

  // Flags reinforce meaningful availability (capped)
  let flagPoints = 0;
  if (offeringId === 'quick_takeaway' && inputs.menu.hasTakeaway) {
    flagPoints += 20;
    signals.push('flag:hasTakeaway');
  }
  if ((offeringId === 'cocktails_social' || offeringId === 'late_night_bar' || offeringId === 'craft_beer_bar' || offeringId === 'natural_wine_focus') && inputs.menu.hasAlcohol) {
    flagPoints += 15;
    signals.push('flag:hasAlcohol');
  }
  if (offeringId === 'specialty_coffee' && inputs.menu.hasSpecialtyCoffee) {
    flagPoints += 15;
    signals.push('flag:hasSpecialtyCoffee');
  }
  score += Math.min(25, flagPoints);

  // If there is no meaningful presence at all, keep it at 0
  if (share === 0 && flagPoints === 0) score = 0;

  // Generic min share dampening (availability only)
  if (share > 0 && share < pattern.minMenuShare) {
    score = Math.round(score * 0.6);
    signals.push(`belowMinShare:${Math.round(pattern.minMenuShare * 100)}%`);
  }

  return { score: clamp0to100(score), signals };
}

function computeIdentityScore(inputs: StrategyDeductionInputs, offeringId: OfferingId, totalItems: number, matchedCategories: Array<{ category: string; count: number }>): { score: number; cues: CoreOfferingEvidenceCue[]; sources: CoreOfferingIdentitySource[] } {
  const pattern = OFFERING_PATTERNS[offeringId];
  const cues: CoreOfferingEvidenceCue[] = [];
  const sources = new Set<CoreOfferingIdentitySource>();

  let score = 0;

  // 1) Menu headings as intent signals (concept-focused titles matter)
  let headingPoints = 0;
  for (const cat of matchedCategories) {
    const conceptual = headingLooksConceptual(cat.category);
    const strength: CoreOfferingEvidenceCue['strength'] = conceptual ? 'strong' : 'weak';
    cues.push({ source: 'menu_heading', text: cat.category, strength });
    sources.add('menu_heading');
    headingPoints += conceptual ? 25 : 10;
  }
  score += Math.min(35, headingPoints);

  // 2) Food philosophy (high weight if present)
  if (inputs.menu.foodPhilosophy) {
    const philosophyLower = inputs.menu.foodPhilosophy.toLowerCase();
    const mentionsTopic = includesAny(philosophyLower, [...pattern.menuEvidence]);
    if (mentionsTopic) {
      const intent = hasIntentLanguage(philosophyLower);
      score += intent ? 35 : 20;
      cues.push({ source: 'food_philosophy', text: inputs.menu.foodPhilosophy, strength: intent ? 'strong' : 'weak' });
      sources.add('food_philosophy');
    }
  }

  // 3) Marketing hooks (medium weight)
  if (Array.isArray(inputs.location.marketingHooks)) {
    let hookPoints = 0;
    for (const hook of inputs.location.marketingHooks) {
      const hookLower = String(hook).toLowerCase();
      if (includesAny(hookLower, [...pattern.menuEvidence])) {
        const intent = hasIntentLanguage(hookLower);
        hookPoints += intent ? 15 : 10;
        cues.push({ source: 'marketing_hooks', text: String(hook), strength: intent ? 'strong' : 'weak' });
        sources.add('marketing_hooks');
      }
    }
    score += Math.min(25, hookPoints);
  }

  // 4) Hours intent reinforcement for timing-based patterns only
  if (pattern.identityType === 'timing') {
    const hourMatches = pattern.hourPatterns.filter(h => inputs.hours[h as keyof typeof inputs.hours]);
    if (hourMatches.length > 0) {
      // Translate "we are open for this occasion" into identity reinforcement
      const { share } = computeMenuShare(totalItems, matchedCategories);
      const hoursIntent = hourMatches.length >= 2 ? 25 : 18;
      const shareIntent = share >= pattern.minMenuShare ? 10 : 0;
      score += Math.min(35, hoursIntent + shareIntent);
      cues.push({ source: 'hours_intent', text: hourMatches.join(', '), strength: 'strong' });
      sources.add('hours_intent');
    }
  }

  // 5) Metadata signals (allowed, but must not invent claims)
  if (offeringId === 'specialty_coffee' && inputs.menu.hasSpecialtyCoffee) {
    score += 30;
    cues.push({ source: 'metadata_signal', text: 'hasSpecialtyCoffee', strength: 'strong' });
    sources.add('metadata_signal');
  }

  // Two-source boost
  if (sources.size >= 2) {
    score += TWO_SOURCE_BOOST;
  }

  return { score: clamp0to100(score), cues, sources: Array.from(sources) };
}

function applyBusinessTypePriors(inputs: StrategyDeductionInputs, offeringId: OfferingId, combinedScore: number, identityScore: number): number {
  // Priors are mild and MUST NOT override eligibility thresholds.
  let adjusted = combinedScore;

  const isBarContext = getPrimaryType(inputs.businessType) === 'bar' && inputs.hours.hasLateNight && inputs.menu.hasAlcohol;
  if (!isBarContext) return adjusted;

  const barPatterns: OfferingId[] = ['late_night_bar', 'cocktails_social', 'craft_beer_bar'];
  const cafeDayPatterns: OfferingId[] = ['specialty_coffee', 'weekend_brunch', 'weekday_lunch'];

  if (barPatterns.includes(offeringId)) adjusted += 5;
  if (cafeDayPatterns.includes(offeringId) && identityScore < 70) adjusted -= 5;

  return clamp0to100(adjusted);
}

function buildWhyBulletsDa(offeringId: OfferingId, candidate: CoreOfferingCandidate): string[] {
  const pattern = OFFERING_PATTERNS[offeringId];
  const bullets: string[] = [];

  const sharePct = Math.round(candidate.evidence.menuShare * 100);
  if (sharePct > 0) bullets.push(`Det fylder ca. ${sharePct}% af jeres menustruktur.`);

  const strongCues = candidate.evidence.identityCues.filter(c => c.strength === 'strong');
  if (strongCues.some(c => c.source === 'food_philosophy')) {
    bullets.push('Det bliver understøttet af jeres mad-/konceptbeskrivelse.');
  }
  if (strongCues.some(c => c.source === 'menu_heading')) {
    bullets.push('Det bliver fremhævet direkte i menutitlerne.');
  }
  if (strongCues.some(c => c.source === 'marketing_hooks')) {
    bullets.push('Det bliver nævnt som et tydeligt salgsargument.');
  }
  if (strongCues.some(c => c.source === 'hours_intent') && pattern.identityType === 'timing') {
    bullets.push('Jeres åbningstider peger på et klart fokus på den anledning.');
  }
  if (strongCues.some(c => c.source === 'metadata_signal')) {
    bullets.push('Det er markeret som et tydeligt fokus i jeres data.');
  }

  // Ensure 2-4 bullets, not technical
  const unique = Array.from(new Set(bullets));
  if (unique.length < 2) unique.push('Der er tegn på, at gæster især bruger jer på den måde.');
  return unique.slice(0, 4);
}

export function validateCoreOfferings(result: CoreOfferings, _inputs: StrategyDeductionInputs): CoreOfferings {
  const full = result.offeringsFull || [];
  const topIds = (result.coreOfferingsTop3 || result.offerings || []).filter(Boolean);

  const eligibleTop = topIds.filter(id => {
    const c = full.find(x => x.id === id);
    if (!c) return false;
    return c.availabilityScore >= AVAILABILITY_MIN && c.identityScore >= IDENTITY_MIN;
  });

  const next = {
    ...result,
    offerings: eligibleTop,
    coreOfferingsTop3: eligibleTop
  };

  // Adjust confidence downwards if we had to remove entries
  if (eligibleTop.length < topIds.length) {
    next.confidence = eligibleTop.length === 0 ? 'low' : 'medium';
  }

  return next;
}

/**
 * Calculate usage pattern weights by combining multiple signals.
 * 
 * INFERENCE LOGIC (USAGE PATTERNS, NOT MENU COPIES):
 * 1. Menu evidence: Calculate menu share for this pattern
 * 2. Hour patterns: Validate that usage timing makes sense
 * 3. Required signals: Check mandatory reinforcements
 * 4. Combined score: Pattern is only viable if ALL pieces align
 * 
 * WEIGHT FORMULA:
 * - Base: Menu share × 100 (e.g., 30% of menu → 30 points)
 * - Hour match: +20 per matching hour pattern (usage timing validation)
 * - Required signal: +25 if signal present (reinforcement)
 * - Philosophy match: +15 if mentioned in food philosophy
 * 
 * GUARDRAILS:
 * - Specialty coffee: Requires hasSpecialtyCoffee OR menuShare >= 0.25
 * - Weekend brunch: Requires BOTH opensWeekends AND hasBreakfast
 * - Late night: Requires hasLateNight hours
 */
export function calculateOfferingWeights(inputs: StrategyDeductionInputs): Record<string, number> {
  const weights: Record<string, number> = {};
  
  // Calculate total menu items for share calculation
  const totalMenuItems = Object.values(inputs.menu.categories).reduce((sum, count) => sum + count, 0);
  
  // Iterate through each usage pattern
  for (const [offeringId, pattern] of Object.entries(OFFERING_PATTERNS)) {
    let weight = 0;
    let menuMatchCount = 0;
    const reasons: string[] = [];
    
    // 1. Calculate menu evidence (HOW MUCH of menu suggests this pattern)
    for (const [category, count] of Object.entries(inputs.menu.categories)) {
      const categoryLower = category.toLowerCase();
      
      for (const evidence of pattern.menuEvidence) {
        if (categoryLower.includes(evidence.toLowerCase())) {
          menuMatchCount += count;
          break; // Count each category only once per pattern
        }
      }
    }
    
    const menuShare = totalMenuItems > 0 ? menuMatchCount / totalMenuItems : 0;
    
    // Base weight from menu share (primary evidence)
    weight += Math.round(menuShare * 100);
    if (menuShare > 0) {
      reasons.push(`menu ${Math.round(menuShare * 100)}%`);
    }
    
    // 2. Check hour patterns (usage timing validation)
    let hourMatches = 0;
    for (const hourPattern of pattern.hourPatterns) {
      if (inputs.hours[hourPattern as keyof typeof inputs.hours]) {
        weight += 20;
        hourMatches++;
        reasons.push(hourPattern);
      }
    }
    
    // 3. Check required signals (reinforcement)
    for (const signal of pattern.requiredSignals) {
      if (inputs.menu[signal as keyof typeof inputs.menu]) {
        weight += 25;
        reasons.push(signal);
      }
    }
    
    // 4. Check food philosophy (additional evidence)
    if (inputs.menu.foodPhilosophy) {
      const philosophyLower = inputs.menu.foodPhilosophy.toLowerCase();
      for (const evidence of pattern.menuEvidence) {
        if (philosophyLower.includes(evidence.toLowerCase())) {
          weight += 15;
          reasons.push('philosophy');
          break;
        }
      }
    }
    
    // GUARDRAILS: Enforce pattern requirements
    
    // Specialty coffee: MUST have signal OR high menu share
    if (offeringId === 'specialty_coffee') {
      const hasSignal = inputs.menu.hasSpecialtyCoffee;
      const hasHighShare = menuShare >= pattern.minMenuShare;
      
      if (!hasSignal && !hasHighShare) {
        weight = 0; // Disqualify if neither condition met
        reasons.length = 0;
        reasons.push('disqualified: needs hasSpecialtyCoffee OR 25%+ menu share');
      }
    }
    
    // Weekend brunch: MUST have BOTH weekend + breakfast hours
    if (offeringId === 'weekend_brunch') {
      if (!inputs.hours.opensWeekends || !inputs.hours.hasBreakfast) {
        weight = 0;
        reasons.length = 0;
        reasons.push('disqualified: needs opensWeekends AND hasBreakfast');
      }
    }
    
    // Weekday lunch: MUST have BOTH weekday + lunch hours
    if (offeringId === 'weekday_lunch') {
      if (!inputs.hours.opensWeekdays || !inputs.hours.hasLunch) {
        weight = 0;
        reasons.length = 0;
        reasons.push('disqualified: needs opensWeekdays AND hasLunch');
      }
    }
    
    // Late night bar: MUST have late night hours
    if (offeringId === 'late_night_bar') {
      if (!inputs.hours.hasLateNight) {
        weight = 0;
        reasons.length = 0;
        reasons.push('disqualified: needs hasLateNight');
      }
    }
    
    // General minimum menu share check
    if (menuShare > 0 && menuShare < pattern.minMenuShare && weight > 0) {
      // Has some presence but below threshold - reduce weight
      weight = Math.round(weight * 0.5);
      reasons.push(`below minShare (${Math.round(pattern.minMenuShare * 100)}%)`);
    }
    
    weights[offeringId] = weight;
  }
  
  return weights;
}

/**
 * Main entry: detect core offerings using two-axis scoring.
 * 
 * Uses availability + identity scores to determine which offerings truly represent
 * the business's core usage patterns and brand identity.
 */
export function detectCoreOfferings(inputs: StrategyDeductionInputs): CoreOfferings {
    const totalItems = Object.values(inputs.menu.categories).reduce((sum, count) => sum + count, 0);

    const candidates: CoreOfferingCandidate[] = (Object.keys(OFFERING_PATTERNS) as OfferingId[]).map((id) => {
      const matchedCategories = buildMatchedCategories(inputs, OFFERING_PATTERNS[id]);
      const { matchedItems, share } = computeMenuShare(totalItems, matchedCategories);

      const availability = computeAvailabilityScore(inputs, id, totalItems, matchedCategories);
      const identity = computeIdentityScore(inputs, id, totalItems, matchedCategories);

      // Combined score (priors applied later)
      const combinedBase = (identity.score * 0.6) + (availability.score * 0.4);
      const combined = applyBusinessTypePriors(inputs, id, combinedBase, identity.score);

      const eligible = availability.score >= AVAILABILITY_MIN && identity.score >= IDENTITY_MIN;
      const evidence: CoreOfferingEvidence = {
        totalItems,
        matchedItems,
        menuShare: share,
        matchedCategories,
        availabilitySignals: availability.signals,
        identityCues: identity.cues,
        identitySources: identity.sources
      };

      const candidate: CoreOfferingCandidate = {
        id,
        availabilityScore: availability.score,
        identityScore: identity.score,
        combinedScore: clamp0to100(combined),
        eligible,
        evidence,
        whyDa: []
      };

      candidate.whyDa = buildWhyBulletsDa(id, candidate);
      return candidate;
    });

    // Rank eligible only (do not fill with weak guesses)
    const top = candidates
      .filter(c => c.eligible)
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, 3);

    const coreOfferingsTop3 = top.map(c => c.id);

    const weights: Record<string, number> = {};
    for (const c of candidates) {
      weights[c.id] = c.combinedScore;
    }

    const selectedWhyDa: Record<string, string[]> = {};
    const debugEvidence: Record<string, unknown> = {};
    for (const c of top) {
      selectedWhyDa[c.id] = c.whyDa;
      debugEvidence[c.id] = c.evidence;
    }

    const reasoning: string[] = top.map(c => {
      const label = OFFERING_PATTERNS[c.id as OfferingId].description;
      return `${label}: valgt fordi både udbud (${c.availabilityScore}/100) og fokus/identitet (${c.identityScore}/100) er tydelige.`;
    });

    // Confidence (honest)
    const confidence: CoreOfferings['confidence'] =
      top.length >= 2 && top.every(c => c.combinedScore >= 70) ? 'high'
        : top.length >= 1 ? 'medium'
          : 'low';

    const result: CoreOfferings = {
      offerings: coreOfferingsTop3,
      coreOfferingsTop3,
      offeringsFull: candidates,
      selectedWhyDa,
      debugEvidence,
      weights,
      reasoning,
      confidence,
      generated_at: new Date().toISOString()
    };

    return validateCoreOfferings(result, inputs);
  }
