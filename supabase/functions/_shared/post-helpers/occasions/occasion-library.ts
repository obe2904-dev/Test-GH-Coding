/**
 * OCCASION LIBRARY
 *
 * Canonical posting-occasion definitions and per-market timing profiles.
 *
 * Architecture:
 *   OCCASION_DEFINITIONS  — universal behavioural occasions (archetype-tagged, no timing)
 *   MARKET_TIMING         — country-keyed timing profiles (post_timing, decision_latency, default_cta)
 *
 * Produced once per brand-profile generation (Prompt B selects which occasions apply
 * to a given business and stores them as PostingOccasion[] in the DB).
 * Phase 0 reads the stored list weekly and resolves an ActiveOccasion[] with
 * concrete timing for that specific week.
 *
 * Occasion ID naming convention:  <category>_<descriptor>
 * Business archetypes mirror the expert's canonical library (da-DK v1).
 */

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

/** Archetypes from the expert's canonical occasion library */
export type BusinessArchetypeTag =
  | 'full_service_cafe'    // Full daytime + evening programme; bruger alle dayparts
  | 'coffee_bar'           // Primært kaffebar / grab-and-go
  | 'wine_bar'             // Vinbar — aften-fokus
  | 'cocktail_bar'         // Cocktailbar — aften + natteliv
  | 'bakery'               // Bageri / konditori
  | 'takeaway'             // Take-away-format
  | 'ice_dessert';         // Is / dessert

export type OccasionGoalMode = 'drive_footfall' | 'build_brand' | 'retain_loyalty';
export type OccasionContentType = 'menu_item' | 'atmosphere' | 'behind_scenes' | 'seasonal' | 'drink_feature';
export type DefaultCTA          = 'book_table' | 'see_menu' | 'drop_by' | 'order_now' | 'engage';

/** Conditional trigger — when detected in WeekContext, this occasion's weight is boosted */
export type ConditionalTrigger =
  | 'payday_week'          // Lønningsuge (payday_week_of_month <= 2 OR payday_this_week)
  | 'month_december'       // December — high consumer spending
  | 'high_value_event'     // Event with commercial_weight >= 4 this week
  | 'holiday_week'         // Holiday in events list
  | 'summer_season'        // June–August
  | 'friday_in_week'       // Self-referential: Fri present in available_days
  | 'saturday_in_week'     // Self-referential: Sat present in available_days
  | 'thursday_in_week'     // Self-referential: Thu present in available_days
  | 'weekend_in_week'      // Sat or Sun present in available_days
  | 'week_start'           // Monday present in available_days
  | 'booking_pressure';    // booking_eligible + payday_week / december / high_value_event

/** One universal occasion definition — no timing yet */
export interface OccasionDefinition {
  id: string;
  label_dk: string;                      // Short Danish label shown to the business owner
  description_dk: string;               // 1 sentence explaining WHAT this occasion captures
  archetype_fit: BusinessArchetypeTag[]; // Which archetypes this occasion applies to
  goal_mode: OccasionGoalMode;
  content_type: OccasionContentType;
  /** Whether a booking CTA upgrade is eligible for this occasion */
  booking_eligible: boolean;
  /** Triggers that raise activation_weight if present in WeekContext */
  conditional_triggers: ConditionalTrigger[];
  /** Base activation weight — 1 (weakest) to 5 (strongest) */
  base_weight: number;
}

/** Per-market timing profile for one occasion */
export interface OccasionMarketTiming {
  /** "Day TT:MM" or "Day-Day TT:MM" — e.g. "Fri 09:30" or "Thu-Fri 14:00" */
  post_timing: string;
  /**
   * "day-of" means publish ON the revenue day itself (impulse).
   * Number means hours before the revenue moment (decision lead time).
   */
  decision_latency: 'day-of' | number;
  default_cta: DefaultCTA;
  /** How many slots this occasion typically occupies in a 4-post week */
  typical_slot_count: 1 | 2;
}

/** What the brand-profile AI stores per business (written once, updated on hash change) */
export interface PostingOccasion {
  occasion_id: string;
  /** 1 (lowest priority) – 5 (must always be in plan) */
  priority_weight: number;
  /** How many posts per week this occasion typically generates for this business */
  default_slot_count: 1 | 2;
  /** Free-text customisations the AI added for this specific business */
  business_customizations: string[];
  /** Week-signal conditions that should boost or dampen this occasion for this business */
  conditional_modifiers: string[];
}

/** What Phase 0 emits for Phase 1 to consume — one entry per post slot this week */
export interface ActiveOccasion {
  occasion_id: string;
  /** Resolved timing string from MarketTiming (possibly adjusted for booking pressure) */
  resolved_post_timing: string;
  /** Resolved CTA — may be overridden to book_table by booking-pressure logic */
  resolved_cta: DefaultCTA;
  /** 0–1 float: final activation weight after all signals applied */
  activation_weight: number;
  /** Human-readable list of signals that activated this occasion this week */
  activation_reasons: string[];
  /** Number of post slots to fill with this occasion this week */
  slot_count: 1 | 2;
  /** Goal mode passed through to Phase 1 */
  goal_mode: OccasionGoalMode;
  /** Content type passed through to Phase 1 */
  content_type: OccasionContentType;
  /** Optional label for Phase 1 prompt context */
  label_dk: string;
  /** Optional description for Phase 1 prompt context */
  description_dk: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// OCCASION DEFINITIONS  (universal — no market timing)
// ─────────────────────────────────────────────────────────────────────────────

export const OCCASION_DEFINITIONS: OccasionDefinition[] = [
  // ── WEEKEND DEMAND ──────────────────────────────────────────────────────────
  {
    id: 'weekend_brunch_planning',
    label_dk: 'Weekendbrunch – planlægning',
    description_dk: 'Post torsdag/fredag for at plante lyst til weekendbrunch hos gæster der planlægger på forhånd.',
    archetype_fit: ['full_service_cafe', 'coffee_bar', 'bakery'],
    goal_mode: 'drive_footfall',
    content_type: 'menu_item',
    booking_eligible: true,
    conditional_triggers: ['saturday_in_week', 'weekend_in_week', 'booking_pressure'],
    base_weight: 4,
  },
  {
    id: 'weekend_brunch_impulse',
    label_dk: 'Weekendbrunch – impuls',
    description_dk: 'Dag-til-post lørdag eller søndag morgen der fanger den spontane brunch-beslutning.',
    archetype_fit: ['full_service_cafe', 'coffee_bar', 'bakery'],
    goal_mode: 'drive_footfall',
    content_type: 'menu_item',
    booking_eligible: false,
    conditional_triggers: ['saturday_in_week', 'weekend_in_week'],
    base_weight: 4,
  },
  {
    id: 'saturday_strongest_post',
    label_dk: 'Lørdag – ugens stærkeste post',
    description_dk: 'Lørdag kl. 09 er den dag med højest organisk rækkevidde og social aktivitet — al fotofocus på kernetilbuddet.',
    archetype_fit: ['full_service_cafe', 'cocktail_bar', 'wine_bar', 'bakery'],
    goal_mode: 'drive_footfall',
    content_type: 'menu_item',
    booking_eligible: true,
    conditional_triggers: ['saturday_in_week', 'booking_pressure', 'payday_week'],
    base_weight: 5,
  },

  // ── THURSDAY–FRIDAY PEAK WINDOW ─────────────────────────────────────────────
  {
    id: 'thursday_night_out',
    label_dk: 'Torsdag aftenudflugt',
    description_dk: 'Torsdagspost der proaktivt sælger aftenbesøg og rejser spontan booklyst til torsdag–fredag.',
    archetype_fit: ['full_service_cafe', 'cocktail_bar', 'wine_bar'],
    goal_mode: 'drive_footfall',
    content_type: 'atmosphere',
    booking_eligible: true,
    conditional_triggers: ['thursday_in_week', 'friday_in_week', 'booking_pressure'],
    base_weight: 4,
  },
  {
    id: 'friday_book_table',
    label_dk: 'Fredag – book bord CTA',
    description_dk: 'Fredagspost tidligt morgen der opfordrer til at booke til weekenden — højeste booking-konvertering i ugen.',
    archetype_fit: ['full_service_cafe', 'cocktail_bar', 'wine_bar'],
    goal_mode: 'drive_footfall',
    content_type: 'menu_item',
    booking_eligible: true,
    conditional_triggers: ['friday_in_week', 'booking_pressure', 'payday_week'],
    base_weight: 4,
  },
  {
    id: 'saturday_pre_party',
    label_dk: 'Lørdag aften – pre-party',
    description_dk: 'Sent lørdag formiddag: fang dem der planlægger aftenens program — appetizer-drinks og let mad inden byen.',
    archetype_fit: ['cocktail_bar', 'wine_bar', 'full_service_cafe'],
    goal_mode: 'drive_footfall',
    content_type: 'atmosphere',
    booking_eligible: false,
    conditional_triggers: ['saturday_in_week', 'payday_week', 'month_december'],
    base_weight: 3,
  },

  // ── WEEKDAY TRAFFIC ──────────────────────────────────────────────────────────
  {
    id: 'weekday_lunch',
    label_dk: 'Hverdagsfrokost',
    description_dk: 'Onsdag–torsdag post der driver frokostbeslutning for samme dag eller næste dag.',
    archetype_fit: ['full_service_cafe', 'coffee_bar', 'takeaway'],
    goal_mode: 'drive_footfall',
    content_type: 'menu_item',
    booking_eligible: false,
    conditional_triggers: [],
    base_weight: 3,
  },
  {
    id: 'after_work_drinks',
    label_dk: 'After work drinks',
    description_dk: 'Torsdag–fredag eftermiddag: fang gæstestrøm fra arbejdspladser til spontan drinks-session.',
    archetype_fit: ['cocktail_bar', 'wine_bar', 'full_service_cafe'],
    goal_mode: 'drive_footfall',
    content_type: 'drink_feature',
    booking_eligible: false,
    conditional_triggers: ['thursday_in_week', 'friday_in_week', 'payday_week'],
    base_weight: 3,
  },

  // ── DRINK / SIGNATURE FEATURES ───────────────────────────────────────────────
  {
    id: 'signature_drink_feature',
    label_dk: 'Signatur-drink showcase',
    description_dk: 'Fremhæv et signatur-cocktail, naturvin eller specialdrink — bygg brand identity og crave-faktor.',
    archetype_fit: ['cocktail_bar', 'wine_bar', 'full_service_cafe'],
    goal_mode: 'build_brand',
    content_type: 'drink_feature',
    booking_eligible: false,
    conditional_triggers: ['payday_week', 'month_december'],
    base_weight: 3,
  },

  // ── BRAND BUILDING ───────────────────────────────────────────────────────────
  {
    id: 'monday_brand_reset',
    label_dk: 'Mandag – brand reset',
    description_dk: 'Mandag morgen er den stille dag — brug den til at nulstille med en BTS- eller identitetspost der styrker loyal­iteten.',
    archetype_fit: ['full_service_cafe', 'coffee_bar', 'cocktail_bar', 'wine_bar'],
    goal_mode: 'build_brand',
    content_type: 'behind_scenes',
    booking_eligible: false,
    conditional_triggers: ['week_start'],
    base_weight: 2,
  },
  {
    id: 'kitchen_craft_bts',
    label_dk: 'Køkkenhåndværk BTS',
    description_dk: 'Bag-om-scenen: vis madlavning, mise-en-place eller det personlige håndværk — bygger ægthed og brand-tillid.',
    archetype_fit: ['full_service_cafe', 'cocktail_bar', 'wine_bar', 'bakery'],
    goal_mode: 'build_brand',
    content_type: 'behind_scenes',
    booking_eligible: false,
    conditional_triggers: [],
    base_weight: 2,
  },
  {
    id: 'seasonal_special',
    label_dk: 'Sæsonspecial',
    description_dk: 'Fremhæv et sæsonbetinget tilbud, specialmenu eller tematisk anledning som understøtter besøgsmotivet.',
    archetype_fit: ['full_service_cafe', 'cocktail_bar', 'wine_bar', 'bakery', 'coffee_bar'],
    goal_mode: 'drive_footfall',
    content_type: 'seasonal',
    booking_eligible: true,
    conditional_triggers: ['high_value_event', 'holiday_week', 'month_december'],
    base_weight: 3,
  },

  // ── LOYALTY ──────────────────────────────────────────────────────────────────
  {
    id: 'loyal_regular_moment',
    label_dk: 'Stamgæstemoment',
    description_dk: 'Post der aktiverer stamgæsternes genkendelse — ugentlige ritualer, fast bordpladser, familiære tiltaleformer.',
    archetype_fit: ['full_service_cafe', 'coffee_bar', 'wine_bar'],
    goal_mode: 'retain_loyalty',
    content_type: 'atmosphere',
    booking_eligible: false,
    conditional_triggers: [],
    base_weight: 2,
  },
  {
    id: 'coffee_morning_ritual',
    label_dk: 'Kaffe-morgenritual',
    description_dk: 'Hverdagsmorgen post der aktiverer den daglige kaffegæst — lavt engagement-krav, høj loyalitetsværdi.',
    archetype_fit: ['coffee_bar', 'full_service_cafe', 'bakery'],
    goal_mode: 'retain_loyalty',
    content_type: 'menu_item',
    booking_eligible: false,
    conditional_triggers: ['week_start'],
    base_weight: 2,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MARKET TIMING PROFILES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map: market locale → (occasion_id → timing profile).
 * Initially only da-DK. Add other markets as objects with the same shape.
 */
export const MARKET_TIMING: Record<string, Record<string, OccasionMarketTiming>> = {
  'da-DK': {
    weekend_brunch_planning: {
      post_timing: 'Thu-Fri 14:00',
      decision_latency: 24,
      default_cta: 'book_table',
      typical_slot_count: 1,
    },
    weekend_brunch_impulse: {
      post_timing: 'Sat 09:00',
      decision_latency: 'day-of',
      default_cta: 'drop_by',
      typical_slot_count: 1,
    },
    saturday_strongest_post: {
      post_timing: 'Sat 09:00',
      decision_latency: 'day-of',
      default_cta: 'book_table',
      typical_slot_count: 1,
    },
    thursday_night_out: {
      post_timing: 'Thu 14:00',
      decision_latency: 6,
      default_cta: 'book_table',
      typical_slot_count: 1,
    },
    friday_book_table: {
      post_timing: 'Fri 09:30',
      decision_latency: 12,
      default_cta: 'book_table',
      typical_slot_count: 1,
    },
    saturday_pre_party: {
      post_timing: 'Sat 11:00',
      decision_latency: 'day-of',
      default_cta: 'drop_by',
      typical_slot_count: 1,
    },
    weekday_lunch: {
      post_timing: 'Wed-Thu 11:00',
      decision_latency: 1,
      default_cta: 'see_menu',
      typical_slot_count: 1,
    },
    after_work_drinks: {
      post_timing: 'Thu-Fri 14:00',
      decision_latency: 4,
      default_cta: 'drop_by',
      typical_slot_count: 1,
    },
    signature_drink_feature: {
      post_timing: 'Thu 18:00',
      decision_latency: 6,
      default_cta: 'drop_by',
      typical_slot_count: 1,
    },
    monday_brand_reset: {
      post_timing: 'Mon 09:00',
      decision_latency: 0,
      default_cta: 'engage',
      typical_slot_count: 1,
    },
    kitchen_craft_bts: {
      post_timing: 'Tue 09:00',
      decision_latency: 0,
      default_cta: 'engage',
      typical_slot_count: 1,
    },
    seasonal_special: {
      post_timing: 'Thu-Fri 14:00',
      decision_latency: 24,
      default_cta: 'book_table',
      typical_slot_count: 1,
    },
    loyal_regular_moment: {
      post_timing: 'Tue-Wed 09:00',
      decision_latency: 0,
      default_cta: 'engage',
      typical_slot_count: 1,
    },
    coffee_morning_ritual: {
      post_timing: 'Mon 08:00',
      decision_latency: 'day-of',
      default_cta: 'drop_by',
      typical_slot_count: 1,
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Look up a definition by ID. Returns undefined if not found. */
export function getOccasionById(id: string): OccasionDefinition | undefined {
  return OCCASION_DEFINITIONS.find((o) => o.id === id);
}

/** Get the market timing for one occasion in a given locale. Falls back to da-DK. */
export function getMarketTiming(
  occasionId: string,
  locale: string,
): OccasionMarketTiming | undefined {
  const profile = MARKET_TIMING[locale] ?? MARKET_TIMING['da-DK'];
  return profile?.[occasionId];
}

/**
 * Build a compact human-readable reference block for Prompt B.
 * Lists all occasion IDs with archetype_fit and a short description.
 * Used so the brand profiler AI can select which occasions apply to this business.
 */
export function buildOccasionLibraryBlock(): string {
  const lines: string[] = [
    'OCCASIONS BIBLIOTEK (vælg de occasions der passer til denne virksomhed):',
    '',
  ];
  for (const o of OCCASION_DEFINITIONS) {
    lines.push(
      `• ${o.id}  [${o.archetype_fit.join('/')}]  (base_weight: ${o.base_weight}/5)`,
    );
    lines.push(`  "${o.description_dk}"`);
    lines.push(`  goal_mode: ${o.goal_mode}  |  booking_eligible: ${o.booking_eligible}`);
    if (o.conditional_triggers.length > 0) {
      lines.push(`  boostes ved: ${o.conditional_triggers.join(', ')}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
