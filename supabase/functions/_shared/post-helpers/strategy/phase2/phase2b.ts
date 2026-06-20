/**
 * PHASE 2b: CONTENT DETAILER
 *
 * Generates title, rationale, media direction for one post.
 *
 * TEMPLATE SYSTEM (Step 3 — 4 content categories):
 *   product_menu   — dish + description + footfall CTA; title starts with dish name
 *   craving_visual — sensory dish visual, no operational required; title = sensory + dish
 *   behind_scenes  — specific scene + time/role anchor; title = scene + time
 *   team_people    — human role + specific fact, soft CTA; title = person/role + fact
 *
 * goal_mode drives the CTA instruction inside each template:
 *   drive_footfall → hard CTA: time, booking, phone number
 *   build_brand    → soft CTA or none; memorable and shareable
 *   retain_loyalty → no explicit CTA required; warmth and recognition
 *
 * CRITICAL DESIGN:
 * - product_menu / craving_visual posts receive menu-items → can mention dishes
 * - behind_scenes / team_people posts receive NO menu-items
 *   → CANNOT hallucinate croissants or other dishes
 *
 * Uses GPT-4o-mini (free tier) or GPT-4o (paid tier).
 */

import type { WeekContext, StrategicBrief, ContextualAnalysis, Platform, CTAIntent } from '../../types/strategy-types.ts';
import type { BusinessIntelligence } from '../../assemble-business-intelligence.ts';
import { callAI } from '../../../ai-caption-generator/ai-provider.ts';
import { silentSpellingCorrection } from '../infrastructure.ts';
import { translateCondition } from '../platform-helpers.ts';
import type { MenuTiming } from '../../assemble-business-intelligence.ts';

/**
 * Normalize ALL CAPS titles from database to proper case.
 * Works on both fully-uppercase strings and ALL-CAPS words embedded in mixed-case strings.
 * Example: "FAVORITTEN" → "Favoritten", "MOULES FRITES med friskbagt brød" → "Moules frites med friskbagt brød"
 */
function normalizeTitle(title: string): string {
  // Fast path: if not all-caps string, check word by word for embedded ALL-CAPS segments
  if (title !== title.toUpperCase()) {
    // Normalize any ALL-CAPS word sequences (2+ consecutive ALL-CAPS words) within the string
    return title.replace(/\b([A-ZÆØÅ]{2,}(?:\s+[A-ZÆØÅ&]{2,})*)\b/g, (match) => {
      // Only convert if the matched segment is itself all-caps (ignore single abbreviations like "CTA")
      if (match === match.toUpperCase() && match.length > 3) {
        return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
      }
      return match;
    });
  }
  // Fully ALL-CAPS string → sentence case
  return title.charAt(0).toUpperCase() + title.slice(1).toLowerCase();
}

/**
 * Infer service period from slot timing using FACTUAL menu timing data
 * Falls back to time-based heuristics if no menu data available
 */
function inferServicePeriod(
  postSlot: any, 
  canonicalTime: string,
  menuTiming?: MenuTiming[]
): string | undefined {
  // Parse time (format: "HH:MM")
  const [hourStr, minuteStr] = canonicalTime.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr || '0', 10);
  const totalMinutes = hour * 60 + minute;
  
  console.log(`[inferServicePeriod] time=${canonicalTime}, totalMinutes=${totalMinutes}`);
  
  // FACT-BASED: Use actual menu timing if available
  if (menuTiming && menuTiming.length > 0) {
    console.log(`[inferServicePeriod] Using ${menuTiming.length} menu timing facts`);
    
    // Find which menu period this time falls into
    for (const menu of menuTiming) {
      if (!menu.startTime || !menu.endTime) continue;
      
      const [startHourStr, startMinStr] = menu.startTime.split(':');
      const startMinutes = parseInt(startHourStr) * 60 + parseInt(startMinStr || '0');
      
      const [endHourStr, endMinStr] = menu.endTime.split(':');
      const endMinutes = parseInt(endHourStr) * 60 + parseInt(endMinStr || '0');
      
      // Check if time falls within this menu period
      if (totalMinutes >= startMinutes && totalMinutes < endMinutes) {
        console.log(`[inferServicePeriod] → ${menu.servicePeriodName} (matched ${menu.menuTitle}: ${menu.startTime}-${menu.endTime})`);
        return menu.servicePeriodName;
      }
    }
    console.log('[inferServicePeriod] No menu period matched, using fallback');
  }
  
  // FALLBACK: Hardcoded heuristics if no menu data
  if (hour >= 7 && hour < 11) {
    console.log('[inferServicePeriod] → FROKOST (early morning fallback)');
    return 'FROKOST';
  } else if (hour >= 11 && hour < 15) {
    console.log('[inferServicePeriod] → FROKOST (lunch fallback)');
    return 'FROKOST';
  } else if (hour >= 15 && hour < 18) {
    console.log('[inferServicePeriod] → AFTEN (afternoon fallback)');
    return 'AFTEN';
  } else if (hour >= 18 && hour < 23) {
    console.log('[inferServicePeriod] → AFTEN (evening fallback)');
    return 'AFTEN';
  }
  
  console.log('[inferServicePeriod] → undefined (no match)');
  return undefined;
}

export async function generatePostDetail(
  postSlot: { id: number; type: string; angle_focus: string; suggested_day: string; platforms: Platform[]; goal_mode?: string; content_category?: string; slot_id?: string },
  context: WeekContext,
  strategicBrief: StrategicBrief,
  contextualAnalysis: ContextualAnalysis,
  contentPlan: Array<{ type: string; angle_focus: string }>,
  usedMenuItems: string[] = [],     // Deprecated: kept for backward compatibility, use usedMenuItemIds instead
  usedExperiencePosts: Array<{ title: string; angle_focus: string }> = [],
  resolvedCtaIntent: CTAIntent = 'engagement',
  usedRationaleThemes: string[] = [],
  ctaFlavorIndex: number = 0,
  businessIntelligencePrompt?: string,
  businessIntelligence?: BusinessIntelligence,
  usedMenuCategories: string[] = [], // NEW: Track used categories to prevent duplicate categories
  postIndex: number = 0,            // Position in the week's post sequence — drives format rotation
  usedMenuItemIds: Set<string> = new Set(), // NEW: UUID-based deduplication (preferred over name matching)
): Promise<any> {

  // ── Template routing: prefer content_category, fall back to legacy type ──
  const contentCategory = postSlot.content_category as string | undefined;
  const goalMode = postSlot.goal_mode as string | undefined;

  // Map content_category → whether this post can use menu items
  // NOTE: craving_visual = venue benefits posts — concrete facilities/features (NO specific menu items)
  const isMenuPost = contentCategory === 'product_menu'
    ? true
    : contentCategory === 'behind_scenes' || contentCategory === 'team_people' || contentCategory === 'craving_visual'
      ? false
      : postSlot.type === 'menu_item'; // legacy fallback

  // CTA instruction driven by goal_mode — platform-aware for drive_footfall
  const bookingLink: string | null = (context as any).booking_link ?? null;
  const hasFacebook = postSlot.platforms.includes('facebook' as any);
  const hasInstagram = postSlot.platforms.includes('instagram' as any);

  // BOOKING MODEL — the primary CTA signal. Phase 1 decides cta_mode per angle based
  // on booking_model + week context. Phase 2b executes that decision.
  // cta_mode overrides the old day-of-week heuristics for drive_footfall posts.
  const ctaModeFromAngle = (postSlot as any).cta_mode as 'walk_in' | 'booking' | 'hybrid' | undefined;
  const bm = (context as any).booking_model;
  // Derive fallback cta_mode from booking_model when Phase 1 didn't set it
  const ctaMode: 'walk_in' | 'booking' | 'hybrid' = ctaModeFromAngle
    ?? (bm?.reservation_required ? 'booking'
        : (bm?.accepts_walk_ins && bookingLink) ? 'hybrid'
        : bm?.accepts_walk_ins ? 'walk_in'
        : 'booking');

  // CTA strength: modulated by economic timing
  const economicPattern = (context.economic as any)?.pattern || 'normal_spend';
  const isBudgetWeek = economicPattern === 'budget_conscious';

  // Day-of-week CTA signals (retained for urgency modulation, not for cta_mode selection):
  // - Advance booking: Wed/Thu post → book your Fri/Sat table now
  const postDay: string = (postSlot.suggested_day || '').toLowerCase();
  const postHour: number = (() => {
    const t = (postSlot.time || '').split(':');
    return t.length >= 1 ? parseInt(t[0], 10) : 0;
  })();
  const isWeekendDinnerPost = (postDay === 'friday' || postDay === 'saturday') && postHour >= 14;
  // Advance booking fires on Wed/Thu (standard), and also on Mon/Tue when the week
  // strategy centres on a weekend occasion (brunch, family event, etc.) — those
  // posts need a 4–5 day lead so families can plan ahead.
  const weekSummaryLower = (strategicBrief.week_summary || '').toLowerCase();
  const isWeekendOccasionStrategy = [
    'brunch', 'familiebrunch', 'familie', 'weekend', 'lørdag', 'søndag',
  ].some(kw => weekSummaryLower.includes(kw));
  // Spontaneous-visit strategies (walk-in, drop-by, hverdagsfrokost) should NOT get
  // advance-booking CTAs — "book your weekend table" conflicts with the spontaneous framing.
  const isSpontaneousStrategy = [
    'spontan', 'walk-in', 'drop-by', 'impuls',
  ].some(kw => weekSummaryLower.includes(kw));
  const isAdvanceBookingPost = (
    (postDay === 'wednesday' || postDay === 'thursday') ||
    ((postDay === 'monday' || postDay === 'tuesday') && isWeekendOccasionStrategy)
  ) && goalMode === 'drive_footfall' && !isSpontaneousStrategy;

  const buildFootfallCta = (): string => {
    // Budget-conscious weeks: always soften regardless of cta_mode
    if (isBudgetWeek) {
      if (!bookingLink || ctaMode === 'walk_in') return 'MEDIUM CTA: Inviter blidt folk til at komme forbi — nævn tidspunkt, ingen salgspres.';
      if (hasFacebook) return `MEDIUM CTA: Nævn tidspunkt naturligt og booking-link: ${bookingLink} — blød, inviterende tone.`;
      return 'MEDIUM CTA: Sig "link i bio" naturligt — inviterende tone, ingen salgspres.';
    }

    // ── WALK_IN: low-threshold invitation, no booking push ──
    if (ctaMode === 'walk_in') {
      // Add same-day urgency on Fri/Sat evenings even for walk-in businesses
      if (isWeekendDinnerPost) {
        const dayDk = postDay === 'friday' ? 'fredag' : 'lørdag';
        return `MEDIUM-HÅRD CTA (${dayDk} aften — spontan invitation): Opfordre til at komme forbi nu eller om lidt — nævn åbningstid og at de er velkomne uden reservation. Ingen booking-link push.`;
      }
      return 'WALK-IN CTA: Lav-tærskel invitation — "vi har plads", "kom forbi i dag", nævn åbningstid. INGEN booking-link eller reservationsopfordring. Gæsten beslutte spontant.';
    }

    // ── BOOKING: hard booking push ──
    if (ctaMode === 'booking') {
      // Same-day weekend dinner: highest urgency
      if (isWeekendDinnerPost) {
        const dayDk = postDay === 'friday' ? 'fredag' : 'lørdag';
        if (!bookingLink) return `HÅRD CTA (${dayDk} aften): Bordene fylder op — ring og reservér eller kom tidligt. Nævn åbningstid.`;
        if (hasFacebook && hasInstagram) {
          return `HÅRD CTA (${dayDk} aften — borde fylder op):\n  Facebook: "Book bord nu" + link: ${bookingLink}\n  Instagram: "Book via link i bio" — skriv IKKE URL'en.`;
        }
        return `HÅRD CTA (${dayDk} aften): ${hasFacebook ? `"Book bord nu" + link: ${bookingLink}` : '"Book via link i bio" — nævn at bordene fylder op.'}`;
      }
      // Advance booking (Wed/Thu or occasion-driven)
      if (isAdvanceBookingPost) {
        if (!bookingLink) return 'HÅRD CTA (forhåndsbook): Opfordre til at reservere bord til weekenden — nævn at det er en god idé at sikre sig plads i tide.';
        if (hasFacebook && hasInstagram) {
          return `HÅRD CTA (forhåndsbook weekend):\n  Facebook: "Sikr din plads" + link: ${bookingLink}\n  Instagram: "Book via link i bio" — skriv IKKE URL'en.`;
        }
        return `HÅRD CTA (forhåndsbook): ${hasFacebook ? `"Sikr din plads" + link: ${bookingLink}` : '"Book via link i bio" — opfordre til at reservere til weekenden.'}`;
      }
      // Standard booking CTA
      if (!bookingLink) return 'HÅRD CTA: Nævn tidspunkt og opfordre til at reservere bord.';
      if (hasFacebook && hasInstagram) {
        return `HÅRD CTA:\n  Facebook: booking-URL direkte: ${bookingLink}\n  Instagram: "link i bio" — skriv IKKE URL'en.`;
      }
      return `HÅRD CTA: ${hasFacebook ? `Inkludér booking-URL: ${bookingLink}` : '"Book via link i bio". Nævn tidspunkt og opfordring til at booke.'}`;
    }

    // ── HYBRID: both options, let guest choose ──
    // Same-day weekend → lean toward booking urgency
    if (isWeekendDinnerPost) {
      const dayDk = postDay === 'friday' ? 'fredag' : 'lørdag';
      if (!bookingLink) return `HYBRID CTA (${dayDk} aften): Kom forbi eller ring og reservér — nævn åbningstid og at walk-in er muligt men pladser er begrænsede.`;
      if (hasFacebook && hasInstagram) {
        return `HYBRID CTA (${dayDk} aften):\n  Facebook: "Book bord eller kom forbi" + link: ${bookingLink}\n  Instagram: "Book via link i bio eller kom direkte" — skriv IKKE URL'en.`;
      }
      return `HYBRID CTA (${dayDk} aften): ${hasFacebook ? `"Book bord eller kom forbi" + link: ${bookingLink}` : '"Book via link i bio eller kom forbi direkte."'}`;
    }
    // Advance booking window → lean toward planning
    if (isAdvanceBookingPost && bookingLink) {
      if (hasFacebook && hasInstagram) {
        return `HYBRID CTA (planlæg weekenden):\n  Facebook: "Book bord eller kom forbi — link: ${bookingLink}"\n  Instagram: "Book via link i bio eller mød os direkte."`;
      }
      return `HYBRID CTA: Invitér til at booke (${bookingLink}) eller bare komme forbi — begge muligheder er velkomne.`;
    }
    // Default hybrid: walk-in invitation + mention booking exists
    if (bookingLink) {
      return `HYBRID CTA: Lav-tærskel invitation — "kom forbi" er det primære budskab. Nævn kort at booking også er muligt${hasFacebook ? ` (link: ${bookingLink})` : ' (link i bio)'}. Walk-in er altid velkomment.`;
    }
    return 'WALK-IN CTA: Kom forbi — vi har plads. Nævn åbningstid.';
  };

  // Rotate brand-builder engagement flavors week over week so the same call-to-action
  // phrase doesn't repeat every single week. Three flavors cycle deterministically.
  const brandBuilderCtaFlavors = [
    'Blød CTA: Stil publikum et spørgsmål der inviterer dem til at dele deres oplevelse med stedet — fx "Hvad er din favorit?" eller "Hvornår var du sidst herinde?".',
    'Blød CTA: Opfordre følgerne til at tagge en ven eller et familiemedlem de vil tage med — konkret og personligt.',
    'Blød CTA: Del en insider-indsigt, et råd eller en lille hemmelighed fra køkkenet/stedet — ingen salgspres, bare genuint kendskab.',
  ];
  const retainLoyaltyCtaFlavors = [
    'Ingen eksplicit CTA: Fokusér på varme, genkendelse og stamgæst-følelsen — lad stamgæsterne nikke genkendende.',
    'Ingen eksplicit CTA: Tak de trofaste gæster direkte og personligt — vis at du husker dem.',
    'Ingen eksplicit CTA: Del en sæsonritual eller tradition der kun stamgæsterne kender — eksklusivt og nærværende.',
  ];
  const ctaInstruction = goalMode === 'drive_footfall'
    ? buildFootfallCta()
    : goalMode === 'build_brand'
      ? brandBuilderCtaFlavors[ctaFlavorIndex % brandBuilderCtaFlavors.length]
      : goalMode === 'retain_loyalty'
        ? retainLoyaltyCtaFlavors[ctaFlavorIndex % retainLoyaltyCtaFlavors.length]
        : ''; // no goal_mode → no special instruction

  // Opening/closing time for the post’s specific day
  const openTimeForDay: string | null = context.daily_open_time?.[postSlot.suggested_day] ?? null;
  const closeTimeForDay: string | null = (context as any).daily_close_time?.[postSlot.suggested_day] ?? null;

  // Shared time helpers (defined once here; used for min, max, clamp and canonical)
  const toMinutes = (t: string): number => {
    const [h, m = '0'] = t.split(':');
    return parseInt(h) * 60 + parseInt(m);
  };
  const fromMinutes = (mins: number): string => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // Earliest valid posting time:
  // build_brand may post 1h before opening (prep/tease angle).
  // drive_footfall may post 2h before opening IF the business opens late (≥15:00) —
  //   this gives the audience time to plan a dinner/evening visit before they decide.
  // All other posts must be at or after opening.
  const lateOpening = openTimeForDay ? (() => {
    const [h] = openTimeForDay.split(':').map(Number);
    return h >= 15;
  })() : false;
  const isPreOpenAllowed = goalMode === 'build_brand' || (goalMode === 'drive_footfall' && lateOpening);
  const preOpenHours = goalMode === 'drive_footfall' ? 2 : 1;
  const resolveMinPostTime = (openTime: string, allowPreOpen: boolean, hoursEarly: number): string => {
    const [hStr, mStr = '0'] = openTime.split(':');
    let h = parseInt(hStr, 10);
    if (allowPreOpen) h = Math.max(h - hoursEarly, 6); // no earlier than 06:00
    return `${String(h).padStart(2, '0')}:${mStr.padStart(2, '0')}`;
  };
  const minPostTime = openTimeForDay ? resolveMinPostTime(openTimeForDay, isPreOpenAllowed, preOpenHours) : null;

  // Latest valid posting time: at least 1h before closing (post lands while business is open)
  const maxPostTime: string | null = closeTimeForDay
    ? fromMinutes(Math.max(toMinutes(closeTimeForDay) - 60, toMinutes(minPostTime ?? '06:00')))
    : null;

  // Service-period-aware canonical slot times.
  // Dinner/unknown businesses get standard afternoon/midday slots.
  // Lunch/brunch-only businesses get late-morning slots.
  // Breakfast-only businesses get early-morning slots.
  const servicePeriods = (context.service_periods as string[] | undefined) ?? [];
  const hasDinner = servicePeriods.includes('dinner');
  const hasLunch  = servicePeriods.includes('lunch') || servicePeriods.includes('brunch');

  // FACT-BASED TIMING: Use actual menu availability windows from menu_results_v2
  // instead of hardcoded assumptions
  const menuTiming = businessIntelligence?.menuIntelligence?.menuTiming || [];
  
  // Extract actual service period times from menu data
  // NOTE: service_period_name uses lowercase: 'dinner', 'lunch', 'brunch' (not 'AFTEN', 'FROKOST')
  const aftenMenu = menuTiming.find(m => 
    m.menuTitle === 'AFTEN' || 
    m.servicePeriodName === 'dinner' ||
    m.menuTitle === 'EVENING DINNER'
  );
  const frokostMenu = menuTiming.find(m => 
    m.menuTitle === 'FROKOST' || 
    m.servicePeriodName === 'lunch'
  );
  const brunchMenu = menuTiming.find(m => 
    m.menuTitle?.includes('BRUNCH') || 
    m.menuTitle?.includes('Brunch') ||
    m.servicePeriodName === 'brunch'
  );
  
  console.log('[Phase 2b] Menu timing facts:', {
    aftenAvailable: aftenMenu ? `${aftenMenu.startTime}-${aftenMenu.endTime}` : 'none',
    frokostAvailable: frokostMenu ? `${frokostMenu.startTime}-${frokostMenu.endTime}` : 'none',
    brunchAvailable: brunchMenu ? `${brunchMenu.startTime}-${brunchMenu.endTime}` : 'none'
  });

  // Slot D has timing_window='any' so it has no explicit time in timing_window.
  // Make it day-of-week aware: weekend (Sat/Sun) → brunch window 10:00;
  // weekday → lunch decision time 12:00.
  const suggestedDow = (() => {
    const [y, m, d] = (postSlot.suggested_day as string).split('-').map(Number);
    return new Date(y, m - 1, d).getDay(); // 0=Sun, 6=Sat
  })();
  const slotDTime = (suggestedDow === 0 || suggestedDow === 6) ? '10:00' : '12:00';

  // FACT-BASED DECISION-MAKING WINDOWS:
  // Menu timing tells us WHAT to post about (which menu items are available)
  // Marketing strategy dictates WHEN to post (customer decision-making windows)
  // 
  // Key insight: Menu service time ≠ Optimal posting time
  // - AFTEN menu (17:30-21:30) → Post at 14:00-16:00 (afternoon planning/shopping hours)
  // - FROKOST menu (09:00-17:30) → Post at 09:00-11:00 (morning decision time)
  // - BRUNCH menu (09:00-14:00) → Post at 09:00-10:00 (early morning or previous evening)
  //
  // Posting windows optimized for:
  // - Book table: Post 3-5 hours before service (decision-making time)
  // - Spontaneous walk-in: Post 1-2 hours before service
  // - Planned visits: Post during shopping/commute hours (12:00-16:00 for dinner)
  const SLOT_CANONICAL_TIMES: Record<string, string> = (() => {
    // If we have actual AFTEN/dinner menu, post during DECISION-MAKING hours (afternoon)
    // NOT during service hours — people plan dinner during lunch/shopping (14:00-16:00)
    // EXCEPTION: when the strategy is explicitly about lunch/brunch/spontaneous visits,
    // use morning decision windows even if the business also has a dinner menu.
    const isLunchFocusedStrategy = isSpontaneousStrategy || [
      'frokost', 'brunch', 'formiddag', 'morgen',
    ].some(kw => weekSummaryLower.includes(kw));
    if (aftenMenu && !isLunchFocusedStrategy) {
      console.log('[Phase 2b] AFTEN menu detected → Using decision-making windows (afternoon for dinner planning)');
      return {
        A: '16:00',        // Slot A: Afternoon decision time (pre-dinner planning/booking)
        B: '11:00',        // Slot B: Late morning (lunch planning)
        C: '09:00',        // Slot C: Morning (brunch/early lunch)
        D: slotDTime       // Slot D: Day-aware
      };
    }
    if (aftenMenu && isLunchFocusedStrategy) {
      console.log('[Phase 2b] AFTEN menu detected but lunch/spontaneous strategy → Using morning decision windows');
      return {
        A: '11:00',        // Slot A: Late morning (lunch decision time)
        B: '09:00',        // Slot B: Early morning
        C: '08:30',        // Slot C: Commute hours
        D: slotDTime       // Slot D: Day-aware
      };
    }
    
    // If FROKOST/lunch menu available, post during morning decision hours
    if (frokostMenu) {
      console.log('[Phase 2b] FROKOST menu detected → Morning decision windows');
      return {
        A: '11:00',        // Slot A: Late morning (lunch decision time)
        B: '09:00',        // Slot B: Early morning
        C: '08:30',        // Slot C: Commute hours
        D: slotDTime       // Slot D: Day-aware
      };
    }
    
    // Fallback to original logic if no menu timing data
    return hasDinner || servicePeriods.length === 0
      ? { A: '14:00', B: '11:00', C: '09:00', D: slotDTime }  // dinner-focused or unknown
      : hasLunch
      ? { A: '10:30', B: '09:00', C: '08:00', D: '10:00' }    // lunch/brunch only
      : { A: '09:00', B: '08:00', C: '07:30', D: '08:30' };   // breakfast only
  })();
  
  console.log('[Phase 2b] SLOT_CANONICAL_TIMES:', SLOT_CANONICAL_TIMES);
  // Prefer the time explicitly encoded in timing_window (e.g. 'Thu-Fri 14:00' → '14:00').
  // This makes slot timing_window the single source of truth, so service-period logic
  // only applies for slots with no explicit time (e.g. Slot D = 'any').
  // EXCEPTION: walk_in / spontaneous strategies — timing is decision-window driven (morning),
  // so we ignore the Phase 1 time and let SLOT_CANONICAL_TIMES control it.
  const timingWindowTime = (() => {
    if (ctaMode === 'walk_in') return null; // spontaneous week → always use SLOT_CANONICAL_TIMES
    const tw = (postSlot as any).timing_window as string | undefined;
    if (!tw) return null;
    const match = tw.match(/(\d{1,2}:\d{2})/);
    return match ? match[1].padStart(5, '0') : null;
  })();
  const rawCanonical = timingWindowTime ?? (postSlot.slot_id ? SLOT_CANONICAL_TIMES[postSlot.slot_id] ?? null : null);

  // Clamp canonical into [minPostTime, maxPostTime] so it never falls outside open hours.
  // EXCEPTION: when timing_window encodes an explicit time (e.g. 'Thu-Fri 14:00'), that time is
  // a strategic MARKETING window (decision-making audience time), not an operational open-hours
  // constraint — skip clamping so 14:00 stays 14:00 even if the business opens at 17:00.
  const clampTime = (canonical: string, min: string | null, max: string | null): string => {
    let mins = toMinutes(canonical);
    if (min) mins = Math.max(mins, toMinutes(min));
    if (max) mins = Math.min(mins, toMinutes(max));
    return fromMinutes(mins);
  };
  const canonicalTime = rawCanonical
    ? (timingWindowTime
        ? timingWindowTime  // explicit timing_window time → use as-is, no open-hours clamping
        : clampTime(rawCanonical, minPostTime, maxPostTime))
    : minPostTime ?? maxPostTime ?? '12:00';

  // Time instruction shown in the prompt — exact target, not just a minimum
  const timeInstruction = `"suggested_time" SKAL være "${canonicalTime}". Dette er slottets kanoniske tidspunkt${rawCanonical ? ` (Slot ${postSlot.slot_id})` : ''}.`;

  // Template label for logging
  const templateLabel = contentCategory
    ? `${contentCategory}/${goalMode || 'no-goal'}`
    : `legacy-${postSlot.type}`;
  const angle = strategicBrief.angles.find(a => a.focus === postSlot.angle_focus);
  const angleSummary = angle ? `${angle.focus}: ${angle.reasoning}` : postSlot.angle_focus;

  // FORMAT ROTATION — cycles across the 4 visual presentation formats so back-to-back posts
  // never land on the same format. Deterministic: driven by postIndex so same plan = same formats.
  // Applied as a single line near the top of each prompt where it's seen before any other context.
  const FORMAT_LABELS: string[] = [
    'Sensorisk nærbillede — damp, tekstur, farve, flydende/smeltet element i centrum. Skab trang.',
    'Menneskefokus — en person (gæst, køkkenpersonale, ejer) i aktion i stedet. Skab identitet.',
    'Atmosfære — vidvinkel af lokalet og miljøet. Vis oplevelsen af at være der. Brug ALDRIG "terrassen" — brug "udeserveringen" kun hvis det er egnet vejr, ellers hold dig til lokalet.',
    'Informationsvinkel — klar, ren ramme med én tydelig besked: hvad, hvornår, pris/åbningstid.',
  ];
  // For menu posts: cycles between Sensory and Atmosphere (more visually varied than product every time)
  // For experience posts: cycles all 4 formats
  const formatIndex = postIndex % FORMAT_LABELS.length;
  const menuFormatIndex = postIndex % 2; // alternates Sensory ↔ Atmosphere for menu posts
  const menuFormatLabel = [FORMAT_LABELS[0], FORMAT_LABELS[2]][menuFormatIndex];
  const experienceFormatLabel = FORMAT_LABELS[formatIndex];

  const dayWeather = (context.weather as any).days?.find((d: any) => d.date === postSlot.suggested_day);
  const weatherLine = dayWeather
    ? `${dayWeather.temp_min}-${dayWeather.temp_max}°C, ${translateCondition(dayWeather.condition)}`
    : `${context.weather.avg_temp}°C gennemsnit`;
  // Only surface outdoor seating to the AI when weather is actually suitable (warm + not overcast/rain)
  const outdoorSeatingOk = dayWeather
    ? dayWeather.temp_max >= 14 && ['sunny', 'partly_cloudy'].includes(dayWeather.condition)
    : (context.weather.avg_temp ?? 0) >= 14;

  const toneKeywords = ((context.brand_voice as any)?.tone_model?.primary_keywords || context.brand_voice?.tone_keywords || []).slice(0, 3).join(', ') || 'venlig, autentisk';
  const voiceConstraint = (context.brand_voice as any)?.voice_constraints
    || (((context.brand_voice as any)?.never_say || []).slice(0, 3).join(', ') || '');

  // Tone-of-voice style signals — used by titleStyleHint in both menu and experience post branches
  const _toneKeywordsLower = toneKeywords.toLowerCase();
  const _humorLevel = ((context.brand_voice as any)?.tone_model?.humor_level || (context.brand_voice as any)?.humor_level || '').toLowerCase();
  const isPlayful = /playful|legesyg|humorist|witty/.test(_toneKeywordsLower) || /playful|high/.test(_humorLevel);
  const isSophisticated = /sofistik|elegant|premium|refined/.test(_toneKeywordsLower);
  const isModern = /modern|kontemporær|frisk/.test(_toneKeywordsLower);
  const isWarm = /varm|indbydende|nærværende|hyggelig/.test(_toneKeywordsLower);
  const isPoetic = /poetisk|drømmende|lyrisk/.test(_toneKeywordsLower);
  const titleStyleHint = (() => {
    const parts: string[] = [];
    if (isPlayful) parts.push('gerne et konkret øjeblik med energi eller et uventet detalje');
    if (isSophisticated && !isPoetic) parts.push('præcist og konkret — ingen generisk stemningsskrivning');
    if (isModern) parts.push('direkte, nutidigt sprog — ingen svulstig poesi');
    if (isWarm && !isPoetic) parts.push('nærværende tone med et konkret menneskeligt element');
    if (parts.length === 0) parts.push('konkret og direkte — fortæl hvad der sker, ikke hvad det føles som');
    return parts.join('; ');
  })();

  const businessCharacterLine = (context as any).business_character
    ? `STEDSTYPE: ${(context as any).business_character}`
    : '';
  // v5: voice_rationale — negative register constraint for experience posts.
  const voiceRationaleLine = (context.brand_voice as any)?.voice_rationale
    ? `🚫 REGISTERVAGT: ${(context.brand_voice as any).voice_rationale}`
    : '';
  // v5: recognizable_interior_identity — verified factual venue description.
  const venueIdentityLine = (context.brand_voice as any)?.recognizable_interior_identity
    ? `STEDSDETALJER (faktuelle): ${(context.brand_voice as any).recognizable_interior_identity}`
    : '';

  // CONSOLIDATED brand block — collapses 6 separate sub-blocks into 2 lines.
  // Keeps AI attention on the task; avoids context dilution from over-specified brand sections.
  const brandEssenceRaw = (context.brand_voice as any)?.brand_essence_elaboration || '';
  const targetAudienceRaw = (context.brand_voice as any)?.target_audience;
  const targetAudienceStr = targetAudienceRaw
    ? (typeof targetAudienceRaw === 'string' ? targetAudienceRaw : (targetAudienceRaw?.primary_demographic || ''))
    : '';
  // Pick the single most relevant content-strategy signal for this goal_mode (was 4-item list)
  const cs = (context.brand_voice as any)?.content_strategy;
  const contentStrategyAnchor = (() => {
    if (!cs || !goalMode) return '';
    if (goalMode === 'drive_footfall' && cs.footfall_signals?.length > 0) return (cs.footfall_signals as string[])[0];
    if (goalMode === 'build_brand' && cs.brand_anchors?.length > 0) return (cs.brand_anchors as string[])[0];
    if (goalMode === 'retain_loyalty' && cs.loyalty_hooks?.length > 0) return (cs.loyalty_hooks as string[])[0];
    return '';
  })();
  // Line 1: who they are + who they serve
  const brandIdentityLine = [
    businessCharacterLine,
    brandEssenceRaw ? `Identitet: ${brandEssenceRaw}` : '',
    targetAudienceStr ? `Målgruppe: ${targetAudienceStr}` : '',
  ].filter(Boolean).join(' | ');
  // Line 2: how to write
  const brandToneLine = [
    `Tone: ${toneKeywords}`,
    voiceConstraint ? `Undgå: ${voiceConstraint}` : '',
    contentStrategyAnchor ? `Nøglesignal: ${contentStrategyAnchor}` : '',
  ].filter(Boolean).join(' | ');

  // Writing patterns — condensed to 1 opening + 2 signature phrases max
  const typicalOpenings: string[] = ((context.brand_voice as any)?.typical_openings || []).slice(0, 1);
  const signaturePhrases: string[] = ((context.brand_voice as any)?.signature_phrases || []).slice(0, 2);
  const communicationGoal: string | null = (context.brand_voice as any)?.communication_goal || null;
  const writingPatternBlock = (typicalOpenings.length > 0 || signaturePhrases.length > 0 || communicationGoal)
    ? [
        'SKRIVEMØNSTER:',
        communicationGoal ? `• ${communicationGoal}` : null,
        typicalOpenings.length > 0 ? `• Åbning: ${typicalOpenings.map((o: string) => `"${o}"`).join(' / ')}` : null,
        signaturePhrases.length > 0 ? `• Fraser: ${signaturePhrases.map((p: string) => `"${p}"`).join(', ')}` : null,
      ].filter(Boolean).join('\n')
    : '';

  // ── Per-slot rationale focus: each slot must lead with a DIFFERENT Phase 0 angle ──
  // This prevents all posts from defaulting to the same "mild weather + payday" opening.
  // IMPORTANT: uses actual postSlot.suggested_day (not canonical slot day) so the rationale
  // never references a weekday that doesn't match the real publication date.
  // Week argument is prepended so every post rationale connects to the strategic spine.
  const weekArgPrefix = strategicBrief.week_summary
    ? `UGENS ARGUMENT (alle rationale-sætninger skal bygge videre på dette — kobl posten konkret til dette argument, ikke blot referere det):\n"${strategicBrief.week_summary}"\n\n`
    : '';
  const slotRationaleFocus = (() => {
    const slotId = postSlot.slot_id;
    const day = postSlot.suggested_day; // e.g. "2026-03-02"
    // Use local noon to avoid UTC-midnight day-shift on Danish timezone
    const dayName = day ? new Date(day + 'T12:00:00').toLocaleDateString('da-DK', { weekday: 'long' }) : '';
    const capitalDay = dayName.charAt(0).toUpperCase() + dayName.slice(1); // e.g. "Mandag"
    if (slotId === 'A') {
      // Thu/Fri footfall driver — framing depends on cta_mode from Phase 1.
      const isWeekendForwardSlot = isWeekendOccasionStrategy &&
        (postDay === 'thursday' || postDay === 'friday');
      if (isWeekendForwardSlot && ctaMode !== 'walk_in') {
        return `${weekArgPrefix}POST-ROLLE I UGENS ARC: WEEKENDTEASER — ${capitalDay} er det ideelle tidspunkt at så beslutningen om weekendbesøget. Denne post skal gøre det let at vælge netop det ugens argument lover: sæt scenen, vis hvad der venter i weekenden, og giv en konkret CTA mod weekenden (f.eks. "kom forbi lørdag" eller "book til weekenden"). IKKE en standalone ${capitalDay.toLowerCase()}spost — en bro frem mod weekendens oplevelse.`;
      }
      if (ctaMode === 'walk_in') {
        return `${weekArgPrefix}POST-ROLLE I UGENS ARC: SPONTANDRIVER — ${capitalDay} er dagen hvor folk beslutter sig i øjeblikket. Denne post skal gøre det let at vælge stedet NU — vis hvad der venter dem i dag, giv en konkret men lav-tærskel invitation ("kom forbi til frokost", "vi er åbne fra kl. X"). INGEN forhåndsbook-CTA — dette er en spontan walk-in beslutning.`;
      }
      return `${weekArgPrefix}POST-ROLLE I UGENS ARC: KONVERTERINGSDRIVER — ${capitalDay} trækker folk ud som en belønning efter en hård arbejdsuge. Denne post omsætter ugens argument til et konkret besøgstilbud. Kobl rettens appel direkte til denne energi og til ugens argument ovenfor.`;
    }
    if (slotId === 'B') {
      // Tue/Wed footfall support — neutral framing that works for any meal type.
      // For dinner-only businesses (no lunch/brunch), drop "frokost" to avoid misleading the AI.
      const sp = (context as any)?.service_periods as string[] | undefined;
      const dinnerOnly = sp && sp.includes('dinner') && !sp.includes('lunch') && !sp.includes('brunch');
      const mealWindow = dinnerOnly ? 'aftensmad' : 'frokost, aftensmad';
      return `${weekArgPrefix}POST-ROLLE I UGENS ARC: STRATEGISK SYNLIGHED — ${capitalDay} er et vindue hvor folk beslutter ${mealWindow} for de næste dage. Denne post driver ugens argument frem ved at vise konkret kvalitet. Kobl rettens konkrete egenskaber (smag, indhold, tilberedning) til HVORFOR den underbygger ugens argument på netop ${capitalDay}.`;
    }
    if (slotId === 'C') {
      // "UGENS START" only makes sense when the post is actually on Monday.
      // If Monday is closed and this slot was assigned to Tue/Wed, use a generic brand-story frame.
      const isMonday = day ? new Date(day + 'T12:00:00').getDay() === 1 : false;
      if (isMonday) {
        return `${weekArgPrefix}POST-ROLLE I UGENS ARC: IDENTITETSÅBNER — ${capitalDay} sætter tonen for hele ugen. Denne post forankrer ugens argument ved at vise stedet og menneskene bag det. Fokusér på hvad der gør denne forretning til den der kan levere netop det ugens argument lover.`;
      }
      return `${weekArgPrefix}POST-ROLLE I UGENS ARC: BRANDFORANKRING — ${capitalDay} er en god dag til at vise det der underbygger ugens argument: folkene bag, håndværket, det der adskiller stedet. Ikke salg — identitet og fortælling der giver ugens argument troværdighed.`;
    }
    if (slotId === 'D') {
      return `${weekArgPrefix}POST-ROLLE I UGENS ARC: LOYALITETSFORANKRING — denne post henvender sig til folk der allerede kender stedet. Vis et specifikt, gentagent øjeblik (tidspunkt, vane, scene) der kobler til ugens argument på en måde den faste gæst genkender fra egne besøg. Undgå abstrakt følelsesprog — vis øjeblikket konkret.`;
    }
    // Fallback: pick based on goal_mode
    if (goalMode === 'build_brand') return `${weekArgPrefix}POST-ROLLE I UGENS ARC: BRANDIDENTITET — hvad gør stedet unikt på netop ${capitalDay} i lyset af ugens argument? Vis karakter, ikke tilbud.`;
    if (goalMode === 'retain_loyalty') return `${weekArgPrefix}POST-ROLLE I UGENS ARC: TILBAGEVENDENDE ØJEBLIK — tal til de faste gæster på ${capitalDay} via et specifikt ritual eller scene der kobler til ugens argument. Ikke nye besøgende, ikke abstrakt følelse.`;
    return `${weekArgPrefix}POST-ROLLE I UGENS ARC: KONKRET TIMING — hvad gør netop ${capitalDay} til det rette tidspunkt for at drive ugens argument fremad?`;
  })();

  // If previous posts already used certain Phase 0 themes, exclude them from this rationale
  const usedThemesBlock = usedRationaleThemes.length > 0
    ? `FORBUDT RATIONALE-ÅBNING (disse vinkler er allerede brugt af tidligere posts denne uge — vælg en ANDEN):\n${usedRationaleThemes.map(t => `- "${t}"`).join('\n')}`
    : '';

  // ── Phase 0 summary: COMPRESSED — reference only, no full details ──
  // Phase 0 analysis already fed into Phase 1 strategic brief.
  // Phase 2b needs only the compact week synthesis, not factor-by-factor details.
  const phase0Factors = contextualAnalysis.key_factors || [];
  const hasSeason = phase0Factors.some((f: any) => f.type === 'season');
  const hasEvents = phase0Factors.some((f: any) => f.type === 'special_day');
  const hasEconomic = phase0Factors.some((f: any) => f.type === 'economic');
  
  // Condensed reference (saves ~350-500 tokens per post)
  const phase0Summary = phase0Factors.length > 0
    ? `Uge-kontekst: ${phase0Factors.map((f: any) => f.name).join(', ')}${hasSeason || hasEvents || hasEconomic ? '' : ' (normal uge)'}` 
    : 'Normal uge (ingen afvigende faktorer)'

  const allAnglesSummary = strategicBrief.angles
    .map(a => `- ${a.focus} (${Math.round(a.weight * 100)}%): ${a.reasoning}`)
    .join('\n');

  const totalMenu = contentPlan.filter(p => p.type === 'menu_item').length;
  const totalExperience = contentPlan.length - totalMenu;
  const menuPct = Math.round((totalMenu / contentPlan.length) * 100);
  const contentDistribution = `CONTENT MIX DENNE UGE: ${totalMenu} menu_item posts + ${totalExperience} venue_benefits/behind_scenes posts\nHvorfor: ${angle?.focus || 'Hovedvinklen'} har ${Math.round((angle?.weight || 0) * 100)}% vægt, og vi balancerer produkt-fokus med stedsfordele.`;

  // If the post falls on a public holiday, inject mandatory holiday framing into the prompt.
  // This ensures Easter Sunday, Good Friday etc. get correct framing regardless of what
  // Phase 1 produced as the strategic angle for the week.
  const postDayHoliday = (context.events ?? []).find(
    (e) => e.type === 'holiday' && e.date === postSlot.suggested_day
  ) ?? null;

  // Also pick up multi-day spans (school_vacation, cultural, occasion) active on this day
  const postDaySpanEvents = (context.events ?? []).filter((e) => {
    if (e.type === 'holiday') return false; // already handled above
    if (e.date === postSlot.suggested_day) return true; // single-day non-holiday
    if (e.date_end && e.date <= postSlot.suggested_day && e.date_end >= postSlot.suggested_day) return true; // span covers this day
    return false;
  });

  const holidayFramingBlock =
    (postDayHoliday
      ? `\n⚠️ HELLIGDAG PÅ DENNE DAG: ${postDayHoliday.name_dk ?? postDayHoliday.name}\n` +
        `${postDayHoliday.strategic_angle}` +
        (postDayHoliday.marketing_hook ? `\n📢 MARKETING-VINKEL: ${postDayHoliday.marketing_hook}` : '') +
        `\nAl framing og CTA SKAL tage udgangspunkt i denne helligdag — generisk framing er ugyldig.\n`
      : '') +
    (postDaySpanEvents.length > 0
      ? `\n📅 AKTIVE BEGIVENHEDER PÅ DENNE DAG:\n` +
        postDaySpanEvents
          .map((e) => {
            const label = e.type === 'school_vacation' ? '🏫 Skoleferie' : '🎉 Begivenhed';
            return `${label}: ${e.name_dk ?? e.name}` +
              (e.strategic_angle ? ` — ${e.strategic_angle}` : '') +
              (e.marketing_hook ? `\n  📢 ${e.marketing_hook}` : '');
          })
          .join('\n') + '\n'
      : '');

  let prompt: string;

  console.log(`[Phase 2b] Post ${postSlot.id} using template: ${templateLabel}`);

  if (isMenuPost) {
    type DishEntry = { id?: string; name: string; description?: string; category?: string; isSignature?: boolean };
    const fallbackDishes: DishEntry[] = [
      { name: 'Dagens ret' }, { name: 'Husets special' }, { name: 'Vores populære ret' }
    ];

    const allItemsUnfiltered: DishEntry[] = Array.isArray(context.signature_items) && context.signature_items.length > 0
      ? (context.signature_items as DishEntry[])
      : fallbackDishes;

    if (!Array.isArray(context.signature_items) || context.signature_items.length === 0) {
      console.warn(`[Phase 2b] Post ${postSlot.id}: signature_items missing or empty - using fallback menu items`);
    }

    // SERVICE PERIOD FILTER: pre-filter dishes to those matching the slot's intended meal time.
    // This prevents lunch-only dishes appearing in dinner-targeting posts and vice versa.
    // The filter is SOFT: items with no service_periods are always kept (no constraint data).
    const slotHour = parseInt(canonicalTime.split(':')[0], 10);
    // Map the slot hour to the service periods that are appropriate for that time:
    //   09:00-11:59 → brunch / breakfast only
    //   12:00-13:59 → brunch + lunch (overlap window)
    //   14:00-16:59 → lunch + dinner (Café Faust frokost closes 17:30; dinner starts 17:00)
    //   17:00+      → dinner only
    // drive_footfall posts promote a specific upcoming service → be strict about which menu applies.
    // A drive_footfall post at 14:00 targets the DINNER period ("plan your evening"),
    // at 11:00 it targets LUNCH, at 09:00 it targets BRUNCH.
    // Brand/loyalty posts are less time-specific → use the broader overlap windows.
    const allowedPeriods: string[] =
      (goalMode === 'drive_footfall' && slotHour >= 17) ? ['dinner'] :
      (goalMode === 'drive_footfall' && slotHour >= 14) ? ['dinner'] :  // 14:00 = afternoon dinner planning
      (goalMode === 'drive_footfall' && slotHour >= 11) ? ['brunch', 'lunch'] :
      (goalMode === 'drive_footfall' && slotHour < 11) ? ['brunch', 'breakfast'] :
      slotHour < 12 ? ['brunch', 'breakfast'] :
      slotHour < 14 ? ['brunch', 'lunch'] :
      slotHour < 17 ? ['lunch', 'dinner'] :
      ['dinner'];
    const periodFiltered = allItemsUnfiltered.filter(item => {
      const periods = (item as any).service_periods as string[] | undefined;
      if (!periods || periods.length === 0) return true; // no constraint → always include
      return periods.some((p: string) => allowedPeriods.includes(p));
    });
    const allItems: DishEntry[] = periodFiltered.length >= 2 ? periodFiltered : allItemsUnfiltered;
    if (periodFiltered.length < allItemsUnfiltered.length) {
      console.log(`[Phase 2b] Post ${postSlot.id}: Service period filter (${allowedPeriods.join('/')}) kept ${periodFiltered.length}/${allItemsUnfiltered.length} items`);
    }

    // STEP 1 — Build preferred candidate pool: items with a description are full dishes;
    // bare-name-only entries are typically supplements/sides. Use described items when available.
    // Always keep at least 2 candidates to give the AI a real choice.
    const allWithDesc = allItems.filter(item => item.description && item.description.trim().length > 0);
    const preferencePool: DishEntry[] = allWithDesc.length >= 2 ? allWithDesc : allItems;

    // STEP 2 — Remove already-used items from the preference pool.
    // PRIMARY: UUID-based matching (most reliable when available)
    // FALLBACK: Name-based matching with core dish extraction for items without UUIDs
    const isUsed = (item: DishEntry): boolean => {
      // UUID-based deduplication (preferred method)
      if (item.id && usedMenuItemIds.has(item.id)) {
        console.log(`[Phase 2b] UUID duplicate: "${item.name}" (${item.id}) already used this week`);
        return true;
      }
      
      // Name-based fallback for items without UUIDs (legacy menu_results_v2 data)
      const nameLower = item.name.toLowerCase().trim();
      
      // Helper: Extract core dish name (before modifiers like "med", "with", "på", "i", etc.)
      const extractCoreDish = (name: string): string => {
        const lowerName = name.toLowerCase().trim();
        // Split on common Danish/English modifiers that indicate variations
        const modifiers = [' med ', ' with ', ' på ', ' i ', ' af ', ' og ', ' and ', ','];
        for (const mod of modifiers) {
          const parts = lowerName.split(mod);
          if (parts.length > 1) {
            // Return everything before the first modifier, but keep multi-word dish names
            // E.g., "Klassisk pariserbøf med rødbeder" → "klassisk pariserbøf"
            return parts[0].trim();
          }
        }
        return lowerName;
      };
      
      // Helper: Extract significant words (4+ chars) from dish name for fuzzy matching
      const extractSignificantWords = (name: string): Set<string> => {
        return new Set(
          name.toLowerCase()
            .replace(/[^\wæøåéüö\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length >= 4)
            .filter(w => !['klassisk', 'classic', 'dagens', 'today', 'vores', 'fresh'].includes(w)) // Filter generic modifiers
        );
      };
      
      const itemCore = extractCoreDish(nameLower);
      const itemWords = extractSignificantWords(itemCore);
      
      return usedMenuItems.some(used => {
        const usedLower = used.toLowerCase().trim();
        
        // 1. Exact match
        if (usedLower === nameLower) {
          return true;
        }
        
        // 2. Full substring match (one contains the other completely)
        if (usedLower.includes(nameLower) || nameLower.includes(usedLower)) {
          return true;
        }
        
        // 3. CRITICAL: Core dish name matching
        // E.g., "pariserbøf med æggeblomme" and "pariserbøf med rødbeder" both have core "pariserbøf"
        const usedCore = extractCoreDish(usedLower);
        const usedWords = extractSignificantWords(usedCore);
        
        // Check if core dish names share significant words
        const sharedWords = [...itemWords].filter(w => usedWords.has(w));
        
        // If they share 2+ significant words, or 1 significant word that's 6+ chars (unique dish name)
        if (sharedWords.length >= 2 || (sharedWords.length === 1 && sharedWords[0].length >= 6)) {
          console.log(`[Phase 2b] Core dish match detected: "${item.name}" matches "${used}" (shared: ${sharedWords.join(', ')})`);
          return true;
        }
        
        // 4. Ingredient similarity check for language variants
        // Extract core ingredients from both items (words 4+ chars that appear in both)
        if (item.description && item.description.length > 20) {
          const extractIngredients = (text: string): Set<string> => {
            return new Set(
              text.toLowerCase()
                .replace(/[^\wæøåéüö\s]/g, ' ')  // Keep Nordic chars
                .split(/\s+/)
                .filter(w => w.length >= 4)  // Minimum word length
                .filter(w => !['with', 'beef', 'done', 'well', 'min.', 'med', 'oksekød', 'gennemstegt'].includes(w))  // Filter stopwords
            );
          };
          
          const itemIngredients = extractIngredients(item.description);
          const usedIngredients = extractIngredients(used);
          
          // Find intersection
          const intersection = new Set([...itemIngredients].filter(i => usedIngredients.has(i)));
          
          // If 70%+ ingredients match, consider it a duplicate (catches language variants)
          if (itemIngredients.size > 0 && intersection.size / itemIngredients.size >= 0.7) {
            console.log(`[Phase 2b] Semantic duplicate detected: "${item.name}" matches "${used}" (${intersection.size}/${itemIngredients.size} ingredients: ${[...intersection].join(', ')})`);
            return true;
          }
        }
        
        return false;
      });
    };

    let menuItems: DishEntry[] = preferencePool.filter(item => !isUsed(item));

    if (menuItems.length < preferencePool.length) {
      console.log(`[Phase 2b] Post ${postSlot.id}: Filtered out ${preferencePool.length - menuItems.length} already-used dishes. ${menuItems.length} available.`);
    }

    // STEP 2.5 — Filter out items from already-used categories (prevents 2x BRUNCH, 2x DESSERT, etc.)
    if (usedMenuCategories.length > 0) {
      const beforeCategoryFilter = menuItems.length;
      menuItems = menuItems.filter(item => {
        const category = (item as any).category as string | undefined;
        if (!category) return true; // No category = always include
        const categoryUpper = category.toUpperCase().trim();
        const isUsedCategory = usedMenuCategories.some(used => used.toUpperCase().trim() === categoryUpper);
        if (isUsedCategory) {
          console.log(`[Phase 2b] Skipping "${item.name}" - category "${category}" already used this week`);
        }
        return !isUsedCategory;
      });
      if (menuItems.length < beforeCategoryFilter) {
        console.log(`[Phase 2b] Post ${postSlot.id}: Category filter removed ${beforeCategoryFilter - menuItems.length} items from used categories. ${menuItems.length} available.`);
      }
    }

    // STEP 3 — Safety: if dedup leaves fewer than 2 candidates, widen back to full preference pool;
    // if still too narrow, use all items. This ensures the AI always has a real selection.
    if (menuItems.length < 2) {
      if (preferencePool.length >= 2) {
        console.warn(`[Phase 2b] Post ${postSlot.id}: Only ${menuItems.length} item(s) after dedup — widening to full preference pool (${preferencePool.length}).`);
        menuItems = preferencePool;
      } else {
        console.warn(`[Phase 2b] Post ${postSlot.id}: Preference pool too narrow — using all items (${allItems.length}).`);
        menuItems = allItems;
      }
    }

    // Format dishes for the prompt: include description when available
    // Annotate signature dishes so AI knows they're prominent — but doesn't HAVE to pick them
    // Normalize ALL-CAPS dish names so AI doesn't reproduce them verbatim in post titles.
    // COMPREHENSIVE MENU DETECTION: Identify all-inclusive offerings (brunch plates, set menus)
    const formatDish = (d: DishEntry): string => {
      let line = `- ${normalizeTitle(d.name)}`;
      if (d.description) {
        // Detect comprehensive offerings: 3+ items separated by commas
        const itemCount = d.description.split(',').length;
        const isComprehensive = itemCount >= 3;
        
        if (isComprehensive) {
          line += `: ${d.description} [ALL-INCLUSIVE BRUNCH/SET MENU med ${itemCount} elementer]`;
        } else {
          line += `: ${d.description}`;
        }
      }
      const periods = (d as any).service_periods as string[] | undefined;
      const category = d.category;
      
      // Show both service period AND category when available (different information)
      const labels: string[] = [];
      if (periods && periods.length > 0) labels.push(periods[0].toUpperCase());
      if (category && category !== periods?.[0]) labels.push(category);
      if (labels.length > 0) line += ` [${labels.join(' · ')}]`;
      
      if (d.isSignature) line += ' ⭐';
      return line;
    };
    const menuItemLines = menuItems.map(formatDish).join('\n');

    // Menu category summaries (helicopter view of each menu section)
    const menuSummariesBlock = context.menu_summaries && context.menu_summaries.length > 0
      ? `\nMENUKATEGORIER (kontekst til valg af ret):\n${context.menu_summaries.map(s => `${s.title}: ${s.summary.split('\n')[0]}`).join('\n')}\n`
      : '';

    // Service period context — helps AI pick the right category
    const slotServiceLabel =
      (goalMode === 'drive_footfall' && slotHour >= 14) ? 'AFTENSMENU (DINNER)' :
      (goalMode === 'drive_footfall' && slotHour >= 11) ? 'BRUNCH/FROKOST (BRUNCH/LUNCH)' :
      (goalMode === 'drive_footfall' && slotHour < 11) ? 'BRUNCH' :
      slotHour < 12 ? 'BRUNCH/MORGENMENU' :
      slotHour < 14 ? 'BRUNCH ELLER FROKOST (BRUNCH/LUNCH)' :
      slotHour < 17 ? 'FROKOST ELLER AFTENSMENU (LUNCH/DINNER)' :
      'AFTENSMENU (DINNER)';
    
    // Build service period timing info from menuTiming data
    const servicePeriodTimingInfo: string[] = [];
    if (brunchMenu) servicePeriodTimingInfo.push(`BRUNCH serveres ${brunchMenu.startTime.replace(/:\d\d$/, '')}-${brunchMenu.endTime.replace(/:\d\d$/, '')}`);
    if (frokostMenu) servicePeriodTimingInfo.push(`FROKOST serveres ${frokostMenu.startTime.replace(/:\d\d$/, '')}-${frokostMenu.endTime.replace(/:\d\d$/, '')}`);
    if (aftenMenu) servicePeriodTimingInfo.push(`AFTEN serveres ${aftenMenu.startTime.replace(/:\d\d$/, '')}-${aftenMenu.endTime.replace(/:\d\d$/, '')}`);
    const servicePeriodTimingLine = servicePeriodTimingInfo.length > 0 ? ` ${servicePeriodTimingInfo.join('. ')}.` : '';
    
    const servicePeriodHint = `DIT TIDSPUNKT: ${canonicalTime}. Vælg KUN retter fra ${slotServiceLabel}-menuen — se [BRUNCH], [LUNCH] eller [DINNER] etiketten bag hvert dish.${servicePeriodTimingLine} Posten markedsfører den N\u00c6STE service gæsten kan komme til, ikke en anden. ALDRIG frokostretter til aftenstidsposter og omvendt.`;

    // Template-specific rules based on content_category
    const templateTypeLabel = contentCategory === 'craving_visual'
      ? 'Sensorisk visuel ret-post (fokus på sanseoplevelse, ikke drift)'
      : 'Produkt-post med drifts-info (fokus på specifik ret + booking-mulighed)';

    const titleRule = contentCategory === 'craving_visual'
      ? `3. Title: 3-7 ord. SKAL kommunikere klar produktværdi — hvad kan kunden få/spise?
   ROLLE: Marketing manager (ikke Instagram-poet). Titlen skal sælge et konkret produkt/oplevelse.
   
   GODE EKSEMPLER (produkt + værdi):
   - "Cremet pastaret med sprød parmesan"
   - "Syrlig citustærte med flødecreme"
   - "Mørke chokoladetrøfler"
   
   TONE: ${titleStyleHint}
   
   ⛔ FORBUDTE STARTER: Forkæl, Nyd, Oplev, Tag, Prøv, Smag, Forestil, Drøm, Velkommen, Mærk, Find
   
   ⛔ FORBUDT: Poetiske/abstrakte beskrivelser uden kommerciel værdi:
   - "Morgenens første damp stiger" (hvad får kunden?)
   - "Stemningen vågner" (intet produkt)
   - "Varmen siver ind" (ingen handlingsværdi)
   - "[Årstid/Tidspunkt] + stemningsord" (fx "Efterårsmagi", "Morgenhygge")
   
   KRAV: Titel skal besvare "Hvad kan jeg få/bestille?" — ikke "Hvad er stemningen?"`
      : `3. Title: 3-7 ord. SKAL starte med rettens konkrete navn + nøgleingrediens/tilberedning.
   ROLLE: Marketing manager. Titlen driver salg af specifik ret — kunden skal vide præcis hvad de får.
   
   GODE EKSEMPLER (ret + konkret detalje):
   - "Pariserbøf med rødbeder"
   - "Koldrøget laks på brødskive"
   - "Brunchburger med bacon og æg"
   
   TONE: ${titleStyleHint}
   
   ⛔ FORBUDTE STARTER: Forkæl, Nyd, Oplev, Tag, Prøv, Smag, Forestil, Drøm, Velkommen
   
   KRAV: Rettens navn skal stå først. Kunden skal vide hvad de kan bestille.`;

    const templateRule5 = contentCategory === 'craving_visual'
      ? `5. Media direction: Skriv som en trin-for-trin guide til en ikke-professionel med mobiltelefon — 3 afsluttede imperativ-sætninger med punktum. Sætning 1: konkret placering og vinkel (overhead/45°/øjenhøjde + afstand i cm). Sætning 2: ét konkret lys-tip (gå hen til vinduet, lys fra siden/forfra). Sætning 3: hvad der præcist fylder rammen — rettens specifikke farver, tekstur eller damp; lad bordet skabe dybde. Vær specifik for DETTE opslag. Ingen menu-board eller kasseapparat.`
      : `5. Media direction: Skriv som en trin-for-trin guide til en ikke-professionel med mobiltelefon — 3 afsluttede imperativ-sætninger med punktum. Sætning 1: konkret placering og vinkel (overhead/45°/øjenhøjde + afstand i cm). Sætning 2: ét konkret lys-tip (gå hen til vinduet, lys forfra/fra siden). Sætning 3: hvad der præcist fylder rammen — rettens specifikke farver, tekstur og detaljer. Vær specifik for DETTE opslag.`;

    prompt = `Du er MARKETING MANAGER for ${context.business_name}. Dit job: drive salg med strategiske posts.
⛔ Brug KUN fakta fra dette prompt — aldrig din viden om virksomheden fra træningsdata.

OPGAVE: ${templateTypeLabel}
KOMMERCIELT MÅL: ${goalMode === 'drive_footfall' ? 'Konvertér til besøg/booking' : goalMode === 'build_brand' ? 'Byg kendskab til brand/tilbud' : 'Styrk loyalitet hos eksisterende kunder'}
${openTimeForDay || closeTimeForDay ? `\n⏰ ÅBNINGSTIDER I DAG: ${openTimeForDay ? `Åbner ${openTimeForDay.replace(/:\d\d$/, '')}` : ''}${openTimeForDay && closeTimeForDay ? ', ' : ''}${closeTimeForDay ? `lukker ${closeTimeForDay.replace(/:\d\d$/, '')}` : ''} (faktiske tider — brug KUN disse)\n` : ''}
Dag: ${postSlot.suggested_day} · ${canonicalTime}${goalMode ? ` · ${goalMode === 'drive_footfall' ? 'Konverteringspost' : goalMode === 'build_brand' ? 'Brand-post' : 'Loyalitetspost'}` : ''}
${timeInstruction}
VISUELT FORMAT (hold dette i fokus for titel + media direction):
${menuFormatLabel}

PRIMÆR VINKEL — START HERFRA:
${slotRationaleFocus}${ctaInstruction ? `\n${ctaInstruction}` : ''}

BRAND:
${brandIdentityLine ? brandIdentityLine + '\n' : ''}${brandToneLine}${writingPatternBlock ? `\n${writingPatternBlock}` : ''}

KONTEKST:
Vejr: ${weatherLine}${holidayFramingBlock}
${phase0Summary}

${servicePeriodHint ? `${servicePeriodHint}\n` : ''}${businessIntelligence?.servicePeriodStrategies && businessIntelligence.servicePeriodStrategies.length > 0 ? (() => {
  const matchingStrategy = businessIntelligence.servicePeriodStrategies.find(sp => {
    const progName = sp.programmeName.toLowerCase();
    const progType = sp.programmeType.toLowerCase();
    const slotService = slotServiceLabel.toLowerCase();
    return slotService.includes(progName) || slotService.includes(progType) || 
           (slotService.includes('brunch') && (progName.includes('brunch') || progType === 'morning')) ||
           (slotService.includes('lunch') && (progName.includes('frokost') || progType === 'lunch')) ||
           (slotService.includes('dinner') && (progName.includes('aften') || progType === 'dinner'));
  });
  if (!matchingStrategy) return '';
  const goals = matchingStrategy.commercialGoals;
  const topGoal = Object.entries(goals).sort((a, b) => b[1] - a[1])[0];
  const goalName = topGoal[0] === 'drive_footfall' ? 'drive besøg' : topGoal[0] === 'strengthen_brand' ? 'styrke brand' : 'fastholde stamgæster';
  const topSegments = matchingStrategy.audienceSegments.slice(0, 2).map(s => s.segment_name).join(', ');
  return `\n📊 KOMMERCIEL STRATEGI FOR ${matchingStrategy.programmeName.toUpperCase()}:\nHovedmål: ${goalName} (${topGoal[1]}%)\nMålgrupper: ${topSegments}\nContent-vinkler: ${matchingStrategy.contentAngles.slice(0, 3).join(', ')}\n\n`;
})() : ''}${menuSummariesBlock}
RETTER FRA MENUEN (vælg én — brug beskrivelsen aktivt i rationale og media direction):
(⭐ = signaturret)
${menuItemLines}
${usedMenuItems.length > 0 ? `BRUGT DENNE UGE — vælg IKKE disse: ${usedMenuItems.map(normalizeTitle).join(', ')}\n` : ''}
REGLER:
1. Vælg én ret der kan stå ALENE som komplet måltid. Undgå tillæg og bioretter ("brød med smør", "chips").
   ⛔ Opfind INGEN nye retter — brug PRÆCIS et navn fra listen ord for ord. Ingen "Mørk tapas" hvis listen siger "TAPAS".
   
   🎯 ALL-INCLUSIVE MENU ITEMS (mærket [ALL-INCLUSIVE BRUNCH/SET MENU]):
   Disse er KOMPLETTE måltider med mange elementer (fx brunch-tallerken med 10+ items).
   - Titlen skal TYDELIGT kommunikere den samlede VÆRDI, ikke bare ét element
   - FORKERT: "Skyr med æblekompot" (kun 1 af 12 items)
   - RIGTIGT: "Den ene brunch — komplet brunch-tallerken" eller "Brunch-menuen med 12 retter"
   - Captions skal fremhæve mangfoldigheden og det all-inclusive format (189 DKK dækker ALT)

2. Brug rettens beskrivelse — opfind ALDRIG ingredienser, kødtyper eller sauce-navne der ikke fremgår af listen.
${titleRule}
   ⛔ IKKE i titlen: "ved Åen", "ved åen", "Forkæl dig", "X-magi", "[Sæson]-X"
   Skriv IKKE ALL CAPS — omskriv: "BØF & BEARNAISE" → "Bøf & bearnaise"
4. Rationale (2-3 sætninger): a) Hvordan driver posten ugens argument? b) Hvad er postens rolle i ugen? c) Hvorfor dette tidspunkt?
   ⛔ Ingen vejr-adjektiver, "dedikation", "den ægte start"
${usedThemesBlock ? `${usedThemesBlock}\n` : ''}${templateRule5}

CAPTIONS:
- caption_facebook: 1-2 sætninger. ${goalMode === 'drive_footfall' ? 'Følg CTA-instruktionen ovenfor.' : 'Inviterende tone med konkret opfordring.'}
- caption_instagram: 1-2 sætninger kortere. ${goalMode === 'drive_footfall' ? '"Link i bio" — ingen URL. ' : ''}5-8 danske hashtags. Ingen URL.

Svar KUN med JSON:
{
  "title": "Pariserbøf med rødbeder",
  "rationale": "2-3 konkrete sætninger",
  "menu_item_used": "Præcis retnavn fra listen",
  "menu_item_description": "Rettens beskrivelse fra listen (kopier direkte)",
  "caption_facebook": "1-2 sætninger${bookingLink && goalMode === 'drive_footfall' ? ` inkl. booking-link` : ''}",
  "caption_instagram": "1-2 sætninger + #hashtag1 #hashtag2 #hashtag3 #hashtag4 #hashtag5",
  "suggested_time": "${canonicalTime}",
  "cta_intent": "${resolvedCtaIntent}",
  "suggested_media": {
    "type": "photo",
    "direction": "3 imperativ-sætninger: 1) placering og vinkel (afstand i cm), 2) lys-tip, 3) hvad der fylder rammen.",
    "photo_count": 1
  }
}`;
  } else {
    const locationInfo = [
      context.city,
      (context.location as any)?.neighborhood,
      ((context.location as any)?.has_outdoor_seating && outdoorSeatingOk) ? 'har udeservering' : null,
    ].filter(Boolean).join(', ');

    // Build location marketing hooks from businessIntelligence (if available)
    let locationMarketingBlock = '';
    if (businessIntelligence?.locationPositioning?.marketingHooks && businessIntelligence.locationPositioning.marketingHooks.length > 0) {
      const hooks = businessIntelligence.locationPositioning.marketingHooks.slice(0, 3);
      const context = businessIntelligence.locationPositioning.primaryContext;
      locationMarketingBlock = `

🎯 LOKATIONS-FORDELE (brug i titel/rationale hvis relevant):
Sted: ${context}
Marketing-vinkler: ${hooks.join(' | ')}
`;
    }

    // Template-specific type description based on content_category (preferred) or legacy type
    const typeDescription = contentCategory === 'behind_scenes'
      ? 'Bag kulisserne (vis specifik scene, tidspunkt, rolle i køkkenet eller lokalet — ingen mad-navne)'
      : contentCategory === 'team_people'
        ? 'Menneskepost (vis en person, rolle, konkret fakta — blød tone, ingen hård salgstale)'
        : postSlot.type === 'behind_scenes'
          ? 'Bag kulisserne (vis mennesker, forberedelse, køkkenet)'
          : 'Facilitetspost (vis konkret kundefordel: placering, udsigt, åbningstid, faciliteter, tilgængelighed)';

    // Template-specific title rule
    // Derive "avoid poetic" constraint and experience title rules using the outer-scope titleStyleHint.

    // Build "avoid" examples based on what the brand is NOT
    const titleAvoidPoetic = (!isPoetic && (isModern || isSophisticated))
      ? `\n   ⛔ UNDGÅ poetisk/lyrisk stemningsskrivning som "Regndråber på ruden og varm kaffe", "Åens spejling kl. 11", "En stille tirsdag morgen" — disse er for generiske og matcher IKKE brandets tone (${toneKeywords}).`
      : '';

    const experienceTitleRule = contentCategory === 'team_people'
      ? `3. Title: 3-7 ord. SKAL kommunikere hvem/hvad kunden møder ved besøg.
   ROLLE: Marketing manager (ikke feature writer). Titlen skal bygge tillid og give konkret info.
   
   GODE EKSEMPLER (person/rolle + handling/værdi):
   - "Vores kok starter kl. 7 hver morgen"
   - "Martin bag baren — 15 års erfaring"
   - "Bakkeriet åbner før solopgang"
   
   TONE: ${titleStyleHint}
   
   ⛔ FORBUDTE STARTER: Forkæl, Nyd, Oplev, Tag, Prøv, Forestil, Drøm, Mød, Mærk
   
   ⛔ FORBUDT: Abstrakte/poetiske stemningsbeskrivelser:
   - "Hænderne der former dagen" (hvem er det?)
   - "Passionen bag maden" (intet konkret)
   - "Hjertet i køkkenet" (for metaforisk)
   
   KRAV: Kunden skal få konkret info — hvem gør hvad, hvornår?`
      : `3. Title: 3-7 ord. SKAL kommunikere konkret kundefordel eller besøgsværdi.
   ROLLE: Marketing manager (ikke poet). Titlen skal give kunden en GRUND til at besøge — konkret facilitet eller fordel.
   
   GODE EKSEMPLER (facilitet/fordel + kontekst):
   - "Åbent fra kl. 8 — morgenkaffe klar"
   - "Terrasse med udsigt til åen"
   - "Weekend-brunch til kl. 14"
   - "Plads ved vinduerne — lyst og rummeligt"
   - "Parkering lige ved indgangen"
   - "Udeservering åben i dag"
   
   DÅRLIGE EKSEMPLER (for abstrakte — giv INGEN værdi):
   - "Morgenens første damp stiger" (hvad får kunden?)
   - "Køkkenet vågner kl. 08:30" (irrelevant for kunde)
   - "Lørdag morgen" (intet konkret tilbud)
   - "Stemningen sætter sig" (ingen handling)
   
   TONE: ${titleStyleHint}
   
   ⛔ FORBUDTE STARTER: Forkæl, Nyd, Oplev, Tag, Prøv, Forestil, Drøm, Mærk, Find${titleAvoidPoetic}
   
   ⛔ FORBUDT MØNSTER #1: '[Abstrakt substantiv] + [adjektiv]' uden konkret kundeværdi:
   - "Værtens varme smil", "Stedets autentiske atmosfære", "Morgenhyggen kalder"
   
   ⛔ FORBUDT MØNSTER #2: '[Tidspunkt/Sted] + poetisk verbum' uden produktinfo:
   - "Morgenens første damp stiger" (hvad sælger vi?)
   - "Middagens lys falder", "Stemningen vågner", "Varmen siver ind"
   - "Køkkenet vågner" (intern proces — irrelevant for kunde)
   
   ⛔ FORBUDT MØNSTER #3: Generiske tidsmarkører uden tilbud:
   - "Lørdag morgen", "Søndag eftermiddag", "En tirsdag"
   
   KRAV: Titel skal besvare "Hvilken konkret fordel får jeg her?" 
   - Fremhæv målbar fordel (udsigt, plads, parkering, åbningstid, lys)
   - Eller specifik facilitet (terrasse, udeservering, tilgængelighed)
   - Universelt anvendelig: skal fungere for restaurant, butik, kontor, klinik
   - ALDRIG bare "stemning", "følelse" eller "atmosfære"`;

    // Template-specific rule 5
    const experienceRule5 = contentCategory === 'team_people'
      ? `5. Media direction: Skriv som en trin-for-trin guide til en ikke-professionel med mobiltelefon — 3 afsluttede imperativ-sætninger med punktum. Sætning 1: konkret placering og vinkel (øjenhøjde + afstand i cm). Sætning 2: ét konkret lys-tip (gå hen til vinduet, naturligt lys fra siden). Sætning 3: hvad der præcist fylder rammen — personen i aktion, ikke poserende. Vær specifik for DETTE opslag.`
      : `5. Media direction: Skriv som en trin-for-trin guide til en ikke-professionel med mobiltelefon — 3 afsluttede imperativ-sætninger med punktum. Sætning 1: konkret placering og vinkel (øjenhøjde/let hævet + afstand i cm). Sætning 2: ét konkret lys-tip (naturligt lys fra vinduet). Sætning 3: hvad der præcist fylder rammen — det centrale element i scenen med dybde. SKAL vise en anden scene end de allerede brugte.`;

    prompt = `Du er MARKETING MANAGER for ${context.business_name}. Dit job: drive besøg med værdiskabende posts.
⛔ Brug KUN fakta fra dette prompt — aldrig din viden om stedet fra træningsdata (ikke stedsdetaljer, atmosfære, menu eller lokal viden).

💡 NØGLE-PRINCIP: Hver post skal give kunden en KLAR GRUND til at besøge.
Titler skal være KONKRETE (facilitet/fordel + kontekst), IKKE abstrakte beskrivelser.
Eksempel på DÅRLIG titel: "Aftenstemning" (ingen værdi)
Eksempel på GOD titel: "Terrasse åben — plads ved vinduerne" (konkret fordel)

OPGAVE: ${typeDescription}
KOMMERCIELT MÅL: ${goalMode === 'drive_footfall' ? 'Konvertér til besøg/booking' : goalMode === 'build_brand' ? 'Byg kendskab til brand/oplevelse' : 'Styrk loyalitet hos eksisterende'}
${openTimeForDay || closeTimeForDay ? `\n⏰ ÅBNINGSTIDER I DAG: ${openTimeForDay ? `Åbner ${openTimeForDay.replace(/:\d\d$/, '')}` : ''}${openTimeForDay && closeTimeForDay ? ', ' : ''}${closeTimeForDay ? `lukker ${closeTimeForDay.replace(/:\d\d$/, '')}` : ''} (faktiske tider — brug KUN disse)\n` : ''}
Dag: ${postSlot.suggested_day} · ${canonicalTime}${goalMode ? ` · ${goalMode === 'drive_footfall' ? 'Konverteringspost' : goalMode === 'build_brand' ? 'Brand-post' : 'Loyalitetspost'}` : ''}
${timeInstruction}
VISUELT FORMAT (hold dette i fokus for titel + media direction):
${experienceFormatLabel}

PRIMÆR VINKEL — START HERFRA:
${slotRationaleFocus}${ctaInstruction ? `\n${ctaInstruction}` : ''}

BRAND:
${brandIdentityLine ? brandIdentityLine + '\n' : ''}${brandToneLine}${writingPatternBlock ? `\n${writingPatternBlock}` : ''}
${venueIdentityLine ? `\n${venueIdentityLine}` : ''}${voiceRationaleLine ? `\n${voiceRationaleLine}` : ''}

KONTEKST:
Vejr: ${weatherLine}${holidayFramingBlock}
Sted: ${locationInfo} · Sæson: ${context.season.current}${locationMarketingBlock}
${phase0Summary}

${usedExperiencePosts.length > 0 ? `BRUGT DENNE UGE — brug ANDET koncept:\n${usedExperiencePosts.map(p => `- "${p.title}" (${p.angle_focus})`).join('\n')}\n` : ''}
⚠️ KRITISK TITEL-KRAV — Dit vigtigste job:
Titlen SKAL svare på: "Hvilken KONKRET FORDEL får jeg?"
❌ FORBUDT: Abstrakte beskrivelser uden handlingsværdi:
  • "Kl. 9 — køkkenet starter op" → Irrelevant (intern proces)
  • "Aftenstemning" → Ingen konkret fordel
  • "Morgenens første damp" → Hvad er fordelen?
  • "Lørdag morgen" → Ingen handlingsværdi
✅ KORREKT: Konkret facilitet/fordel med kontekst:
  • "Åbent fra kl. 9 — morgenkaffe klar"
  • "Terrasse med udsigt til åen"
  • "Weekend-brunch til kl. 14"
  • "Parkering lige ved døren"
  • "Udeservering i solen i dag"

REGLER:
1. ${contentCategory === 'team_people' ? 'PERSON-POST: KUN person, rolle og det menneskelige øjeblik — ingen madnavne overhovedet.' : 'Fokusér på KONKRETE FACILITETER/FORDELE: placering, udsigt, parkering, terrasse, åbningstid, plads, lys, tilgængelighed — IKKE mad eller abstrakt stemning.'}
2. ${contentCategory === 'team_people' ? '⛔ NULTOLERRANCE: ingen madretter, menupunkter, "brunch", "retter", "menu". Brydes reglen er svaret ubrugeligt.' : '⛔ Nævn IKKE specifikke madretter i titel, rationale eller media direction. Undtagelse: regel 6.'}
${experienceTitleRule}
   ⛔ Ikke i titel: "ved Åen", "[Sæson]magi", "[Sæson]ro", "[Sæson]hygge"
   SKAL adskille sig visuelt og konceptuelt fra brugte titler
4. Rationale (2-3 sætninger): a) Hvordan driver posten ugens argument? b) Postens rolle i ugen? c) Hvorfor dette tidspunkt?
   ⛔ Ingen vejr-adjektiver, "dedikation", "den ægte start"
${usedThemesBlock ? `${usedThemesBlock}\n` : ''}${experienceRule5}
${contentCategory === 'behind_scenes' ? `6. VALGFRIT: Hvis scenen konkret viser tilberedning af en ret/drink → inkludér "menu_item_used" med præcist navn. Nævn det IKKE i titel/rationale. Ren scene uden madforberedelse → udelad feltet.` : ''}

CAPTIONS:
- caption_facebook: 1-2 sætninger. ${goalMode === 'drive_footfall' ? 'Følg CTA-instruktionen ovenfor.' : 'Inviterende tone. Gerne et engagementspørgsmål.'}
- caption_instagram: 1-2 sætninger kortere. ${goalMode === 'drive_footfall' ? '"Link i bio" — ingen URL. ' : ''}5-8 danske hashtags. Ingen URL.

⛔ SIDSTE TJEK FØR DU SVARER:
Læs din titel højt og spørg: "Giver denne titel kunden en GRUND til at besøge?"
Hvis svaret er "nej" eller "måske" → OMSKRIV titlen til noget konkret (tilbud + timing).

Svar KUN med JSON:
{
  "title": "${contentCategory === 'team_people' ? 'Vores kok starter kl. 7 hver morgen' : 'Terrasse med udsigt til åen'}",
  "rationale": "2-3 konkrete sætninger",${contentCategory === 'behind_scenes' ? `
  "menu_item_used": "Kun hvis scenen viser konkret tilberedning — ellers udelad",` : ''}
  "caption_facebook": "1-2 sætninger${bookingLink && goalMode === 'drive_footfall' ? ` inkl. booking-link` : ''}",
  "caption_instagram": "1-2 sætninger kortere + #hashtag1 #hashtag2 #hashtag3 #hashtag4 #hashtag5",
  "suggested_time": "${canonicalTime}",
  "cta_intent": "${resolvedCtaIntent}",
  "suggested_media": {
    "type": "photo",
    "direction": "3 imperativ-sætninger: 1) placering og vinkel (afstand i cm), 2) lys-tip, 3) hvad der fylder rammen.",
    "photo_count": 1
  }
}`;
  }

  try {
    let result: any;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const phase2bModel = 'gemini-2.5-flash'; // Gemini Flash throughout — consistent model family with Phase 0/1/2a, better long-context instruction-following
        console.log(`[Phase 2b] Attempt ${attempt}/3 using ${phase2bModel}`);

        const parsed = await callAI<any>(
          prompt,
          {
            temperature: attempt === 1 ? 0.4 : 0,
            maxTokens: 8192,
            model: phase2bModel,
          }
        );

        result = { parsed };
        console.log(`[Phase 2b] Successful parse on attempt ${attempt}`);
        break;

      } catch (error) {
        lastError = error as Error;
        console.error(`[Phase 2b] Attempt ${attempt}/3 failed:`, lastError.message);

        if (attempt === 3) {
          throw new Error(`Post detail generation failed after 3 attempts: ${lastError.message}`);
        }

        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    if (!result) {
      throw new Error(`Post detail generation failed: ${lastError?.message || 'Unknown error'}`);
    }

    // Silent spelling correction (parallel)
    let correctedTitle = result.parsed.title || '';
    let correctedRationale = result.parsed.rationale || '';

    try {
      const corrections = await Promise.all([
        correctedTitle && correctedTitle.trim().length > 0
          ? silentSpellingCorrection(correctedTitle, 'da')
          : Promise.resolve(correctedTitle),
        correctedRationale && correctedRationale.trim().length > 0
          ? silentSpellingCorrection(correctedRationale, 'da')
          : Promise.resolve(correctedRationale)
      ]);
      correctedTitle = corrections[0];
      correctedRationale = corrections[1];
    } catch (spellingError) {
      console.warn(`[Phase 2b] Spelling correction failed for post ${postSlot.id}:`, spellingError);
    }

    // Safety net: if outdoor seating is not suitable, block ANY title mentioning terrassen
    if (!outdoorSeatingOk && /\bterrassen\b/i.test(correctedTitle)) {
      console.log(`[Phase 2b] Blocked terrasse reference in title "${correctedTitle}" — outdoor seating not suited today. Using neutral fallback.`);
      correctedTitle = isMenuPost
        ? (result.parsed.menu_item_used ? normalizeTitle(result.parsed.menu_item_used) : 'Husets specialitet')
        : 'Kl. 9 — køkkenet starter op';
    }

    // Safety net: catch poetic "abstract noun + poetic verb" AI hallucinations
    // e.g. "Morgenens første damp stiger", "Stemningen vågner", "Varmen siver ind"
    const poeticAbstractPattern = /\b\w+ens\s+\w+\s+(stiger|falder|vågner|siver|breder|folder|åbner|bølger|synker|hæver|letter|toner|hviler)\b/i;
    if (poeticAbstractPattern.test(correctedTitle)) {
      console.log(`[Phase 2b] Rejected poetic abstract title "${correctedTitle}" — using concrete fallback.`);
      correctedTitle = isMenuPost
        ? (result.parsed.menu_item_used ? normalizeTitle(result.parsed.menu_item_used) : 'Husets specialitet')
        : 'Bag disken kl. ' + canonicalTime.split(':')[0];
    }

    // Safety net: strip "ved Åen" / "ved åen" when used as a bare mechanical suffix
    // e.g. "Aftenstemning ved Åen" → "Aftenstemning", "Pariserbøf — Aftenforkælelse ved Åen" → "Pariserbøf — Aftenforkælelse"
    // But keep it when it's integral to the scene description (not just tacked on after the core title)
    const vedAaenSuffixPattern = /\s*[—–-]?\s*ved\s+[Åå]en\s*$/i;
    if (vedAaenSuffixPattern.test(correctedTitle)) {
      const stripped = correctedTitle.replace(vedAaenSuffixPattern, '').trim();
      if (stripped.length >= 4) { // Only strip if something meaningful remains
        console.log(`[Phase 2b] Stripped "ved Åen" suffix from title: "${correctedTitle}" → "${stripped}"`);
        correctedTitle = stripped;
      }
    }

    // Safety net: strip forbidden imperative openers if AI ignored the rule
    const forbiddenOpeners = /^(Forkæl|Nyd|Oplev|Tag|Prøv|Smag|Forestil|Drøm|Velkommen)\b/i;
    if (forbiddenOpeners.test(correctedTitle)) {
      console.warn(`[Phase 2b] Title "${correctedTitle}" starts with forbidden imperative — using dish name or fallback`);
      // For menu posts, try to use menu_item_used as title base
      if (isMenuPost && result.parsed.menu_item_used) {
        correctedTitle = normalizeTitle(result.parsed.menu_item_used);
      }
    }

    // Normalize ALL CAPS titles from database (e.g., "FAVORITTEN" → "Favoritten")
    if (correctedTitle === correctedTitle.toUpperCase() && correctedTitle.length > 2) {
      correctedTitle = normalizeTitle(correctedTitle);
      console.log(`[Phase 2b] Normalized ALL CAPS title to: "${correctedTitle}"`);
    }

    // Look up menu category and UUID for deduplication
    // Category: prevent multiple posts from same category (e.g., 2x BRUNCH)
    // UUID: prevent same dish appearing twice with different modifiers
    let menuCategory: string | undefined = undefined;
    let menuItemId: string | undefined = undefined;
    if (isMenuPost && result.parsed.menu_item_used && Array.isArray(context.signature_items)) {
      const menuItemName = result.parsed.menu_item_used.toLowerCase().trim();
      const matchedItem = (context.signature_items as any[]).find((item: any) => 
        item.name && item.name.toLowerCase().trim() === menuItemName
      );
      if (matchedItem) {
        if (matchedItem.category) {
          menuCategory = matchedItem.category;
          console.log(`[Phase 2b] Menu item "${result.parsed.menu_item_used}" is from category: ${menuCategory}`);
        }
        if (matchedItem.id) {
          menuItemId = matchedItem.id;
          console.log(`[Phase 2b] Menu item "${result.parsed.menu_item_used}" has UUID: ${menuItemId}`);
        }
      }
    }

    // Build strategic_intent: carries the Phase 1 angle's narrative purpose through to the
    // plan generator so cross-day booking/occasion logic survives the phase boundary.
    const angleForIntent = strategicBrief.angles.find(a => a.focus === postSlot.angle_focus);
    const strategicIntent = [
      strategicBrief.week_summary ? `Ugens strategi: "${strategicBrief.week_summary}"` : null,
      angleForIntent?.reasoning ? `Vinkel: ${angleForIntent.reasoning}` : null,
      postSlot.goal_mode ? `Mål: ${postSlot.goal_mode}` : null,
    ].filter(Boolean).join(' | ');

    return {
      id: postSlot.id,
      angle_focus: postSlot.angle_focus,
      content_type: postSlot.type,
      suggested_day: postSlot.suggested_day,
      platforms: postSlot.platforms,
      weather_dependent: false,
      estimated_performance: 'medium',
      strategic_fit: 0.85,
      // Goal-mode system fields — flow through to caption generation
      goal_mode: postSlot.goal_mode,
      content_category: postSlot.content_category,
      slot_id: postSlot.slot_id,
      ...result.parsed,
      menu_category: menuCategory, // Track category for deduplication
      menu_item_id: menuItemId,    // Track UUID for deduplication (most reliable)
      suggested_time: canonicalTime, // always use our computed canonical time — AI output may be wrong
      title: correctedTitle,
      rationale: correctedRationale,
      // Service period tracking (Option B): infer from timing_window using FACT-BASED menu timing
      service_period: inferServicePeriod(postSlot, canonicalTime, menuTiming),
      // Strategic intent — carries Phase 1 narrative to the plan generator and caption prompt
      strategic_intent: strategicIntent || undefined,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    // Classify error type for surfacing in UI
    const isJsonParseError = errorMsg.includes('JSON') || errorMsg.includes('parse') || errorMsg.includes('SyntaxError');
    const isApiError = errorMsg.includes('Gemini API failed') || errorMsg.includes('fetch') || errorMsg.includes('network') || errorMsg.includes('timeout');
    const errorType = isJsonParseError ? 'JSON_PARSE' : isApiError ? 'API_ERROR' : 'UNKNOWN';
    const shortError = errorMsg.substring(0, 120).replace(/\n/g, ' ');
    console.error(`[Phase 2b] Failed for post ${postSlot.id} (type: ${postSlot.type}, errorType: ${errorType}):`, {
      error: errorMsg,
      errorType,
      angle: postSlot.angle_focus,
      has_signature_items: Array.isArray(context.signature_items),
      signature_items_count: context.signature_items?.length || 0,
      items_with_descriptions: (context.signature_items as any[])?.filter((i: any) => i?.description)?.length || 0,
    });
    const angleForIntentFb = strategicBrief.angles.find(a => a.focus === postSlot.angle_focus);
    const strategicIntentFb = [
      strategicBrief.week_summary ? `Ugens strategi: "${strategicBrief.week_summary}"` : null,
      angleForIntentFb?.reasoning ? `Vinkel: ${angleForIntentFb.reasoning}` : null,
      postSlot.goal_mode ? `Mål: ${postSlot.goal_mode}` : null,
    ].filter(Boolean).join(' | ');

    return {
      id: postSlot.id,
      angle_focus: postSlot.angle_focus,
      content_type: postSlot.type,
      suggested_day: postSlot.suggested_day,
      platforms: postSlot.platforms,
      title: `Post ${postSlot.id}`,
      rationale: 'Fallback generated',
      suggested_time: canonicalTime,
      cta_intent: resolvedCtaIntent,
      suggested_media: {
        type: 'photo',
        direction: 'Standard billede',
        photo_count: 1
      },
      weather_dependent: false,
      estimated_performance: 'medium',
      strategic_fit: 0.75,
      // Goal-mode fallback
      goal_mode: postSlot.goal_mode,
      content_category: postSlot.content_category,
      slot_id: postSlot.slot_id,
      // Service period tracking (Option B): fact-based using menu timing
      service_period: inferServicePeriod(postSlot, canonicalTime, menuTiming),
      strategic_intent: strategicIntentFb || undefined,
    };
  }
}
