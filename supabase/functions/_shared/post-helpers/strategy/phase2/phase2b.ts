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
import { callAI } from '../../../ai-caption-generator/ai-provider.ts';
import { silentSpellingCorrection } from '../infrastructure.ts';
import { translateCondition } from '../platform-helpers.ts';
import { buildForbiddenBlock } from '../forbidden-phrases.ts';

export async function generatePostDetail(
  postSlot: { id: number; type: string; angle_focus: string; suggested_day: string; platforms: Platform[]; goal_mode?: string; content_category?: string; slot_id?: string },
  context: WeekContext,
  strategicBrief: StrategicBrief,
  contextualAnalysis: ContextualAnalysis,
  contentPlan: Array<{ type: string; angle_focus: string }>,
  usedMenuItems: string[] = [],
  usedExperiencePosts: Array<{ title: string; angle_focus: string }> = [],
  resolvedCtaIntent: CTAIntent = 'engagement',
  usedRationaleThemes: string[] = [],
  ctaFlavorIndex: number = 0,
): Promise<any> {

  // ── Template routing: prefer content_category, fall back to legacy type ──
  const contentCategory = postSlot.content_category as string | undefined;
  const goalMode = postSlot.goal_mode as string | undefined;

  // Map content_category → whether this post can use menu items
  const isMenuPost = contentCategory === 'product_menu' || contentCategory === 'craving_visual'
    ? true
    : contentCategory === 'behind_scenes' || contentCategory === 'team_people'
      ? false
      : postSlot.type === 'menu_item'; // legacy fallback

  // CTA instruction driven by goal_mode — platform-aware for drive_footfall
  const bookingLink: string | null = (context as any).booking_link ?? null;
  const hasFacebook = postSlot.platforms.includes('facebook' as any);
  const hasInstagram = postSlot.platforms.includes('instagram' as any);

  // CTA strength: modulated by economic timing
  // salary_week / december_high → hard CTA with link
  // budget_conscious → soften, no pricing pressure
  // normal_spend / july_vacation → standard hard CTA
  const economicPattern = (context.economic as any)?.pattern || 'normal_spend';
  const isBudgetWeek = economicPattern === 'budget_conscious';

  // Day-of-week CTA signals:
  // - Same-day urgency: Fri/Sat post at 14:00+ → tables fill up tonight
  // - Advance booking: Wed/Thu post → book your Fri/Sat table now
  const postDay: string = (postSlot.suggested_day || '').toLowerCase();
  const postHour: number = (() => {
    const t = (postSlot.time || '').split(':');
    return t.length >= 1 ? parseInt(t[0], 10) : 0;
  })();
  const isWeekendDinnerPost = (postDay === 'friday' || postDay === 'saturday') && postHour >= 14;
  const isAdvanceBookingPost = (postDay === 'wednesday' || postDay === 'thursday') &&
    goalMode === 'drive_footfall';

  const buildFootfallCta = (): string => {
    // Budget-conscious weeks: soften — light invitation, no sales pressure
    if (isBudgetWeek) {
      if (!bookingLink) return 'MEDIUM CTA: Inviter blidt folk til at komme forbi — nævn tidspunkt, ingen salgspres.';
      if (hasFacebook) return `MEDIUM CTA: Nævn tidspunkt naturligt og booking-link: ${bookingLink} — blød, inviterende tone.`;
      return 'MEDIUM CTA: Sig "link i bio" naturligt — inviterende tone, ingen salgspres.';
    }

    // Same-day weekend dinner urgency
    if (isWeekendDinnerPost) {
      const dayDk = postDay === 'friday' ? 'fredag' : 'lørdag';
      if (!bookingLink) {
        return `HÅRD CTA påkrævet (${dayDk} aften): Bordene fylder op — opfordre til at ringe og reservere eller komme tidligt. Nævn åbningstid.`;
      }
      if (hasFacebook && hasInstagram) {
        return `HÅRD CTA påkrævet (${dayDk} aften — borde fylder op):\n` +
          `  Facebook: "Book bord nu" + link direkte: ${bookingLink}\n` +
          `  Instagram: "Book via link i bio" — skriv IKKE URL'en.`;
      }
      if (hasFacebook) {
        return `HÅRD CTA påkrævet (${dayDk} aften — borde fylder op): "Book bord nu" + link: ${bookingLink}`;
      }
      return `HÅRD CTA påkrævet (${dayDk} aften): "Book via link i bio" — nævn at bordene fylder op.`;
    }

    // Advance booking for upcoming weekend (Wed/Thu posts)
    if (isAdvanceBookingPost) {
      if (!bookingLink) {
        return 'HÅRD CTA påkrævet (forhåndsbook weekend): Opfordre til at reservere bord til fredag eller lørdag aften — nævn at det er en god idé at sikre sig plads i tide.';
      }
      if (hasFacebook && hasInstagram) {
        return `HÅRD CTA påkrævet (forhåndsbook weekend):\n` +
          `  Facebook: "Sikr din plads til weekenden" + link: ${bookingLink}\n` +
          `  Instagram: "Book via link i bio" — skriv IKKE URL'en.`;
      }
      if (hasFacebook) {
        return `HÅRD CTA påkrævet (forhåndsbook weekend): "Sikr din plads til weekenden" + link: ${bookingLink}`;
      }
      return `HÅRD CTA påkrævet (forhåndsbook weekend): "Book via link i bio" — opfordre til at reservere til fredag/lørdag.`;
    }

    // Standard drive_footfall CTA
    if (!bookingLink) {
      return 'HÅRD CTA påkrævet: Nævn tidspunkt, book-mulighed eller telefonnummer i rationale.';
    }
    if (hasFacebook && hasInstagram) {
      // Both platforms — give per-platform instructions since captions will differ
      return `HÅRD CTA påkrævet:\n` +
        `  Facebook: Inkludér booking-URL direkte i rationale: ${bookingLink}\n` +
        `  Instagram: Sig "link i bio" — skriv IKKE URL'en i Instagram-caption.`;
    }
    if (hasFacebook) {
      return `HÅRD CTA påkrævet: Inkludér booking-URL direkte: ${bookingLink}`;
    }
    // Instagram only — no clickable links allowed in captions
    return 'HÅRD CTA påkrævet: Sig "link i bio" (Instagram tillader ikke klikbare links i opslag). Nævn tidspunkt og opfordring til at booke.';
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

  // Slot D has timing_window='any' so it has no explicit time in timing_window.
  // Make it day-of-week aware: weekend (Sat/Sun) → brunch window 10:00;
  // weekday → lunch decision time 12:00.
  const suggestedDow = (() => {
    const [y, m, d] = (postSlot.suggested_day as string).split('-').map(Number);
    return new Date(y, m - 1, d).getDay(); // 0=Sun, 6=Sat
  })();
  const slotDTime = (suggestedDow === 0 || suggestedDow === 6) ? '10:00' : '12:00';

  const SLOT_CANONICAL_TIMES: Record<string, string> = hasDinner || servicePeriods.length === 0
    ? { A: '14:00', B: '11:00', C: '09:00', D: slotDTime }  // dinner-focused or unknown
    : hasLunch
    ? { A: '10:30', B: '09:00', C: '08:00', D: '10:00' }    // lunch/brunch only
    : { A: '09:00', B: '08:00', C: '07:30', D: '08:30' };   // breakfast only
  // Prefer the time explicitly encoded in timing_window (e.g. 'Thu-Fri 14:00' → '14:00').
  // This makes slot timing_window the single source of truth, so service-period logic
  // only applies for slots with no explicit time (e.g. Slot D = 'any').
  const timingWindowTime = (() => {
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

  const businessCharacterLine = (context as any).business_character
    ? `STEDSTYPE: ${(context as any).business_character}`
    : '';
  // v5: voice_rationale — "Hvorfor denne anbefaling?" — negative register constraint.
  // Tells the AI exactly which register is wrong for this business and why.
  // Only injected for atmosphere/behind_scenes/team_people posts.
  const voiceRationaleLine = (context.brand_voice as any)?.voice_rationale
    ? `🚫 REGISTERVAGT — læs inden du skriver: ${(context.brand_voice as any).voice_rationale}`
    : '';
  // v5: recognizable_interior_identity — verified factual venue description from photo analysis.
  // Replaces training-data interpolation with real spatial facts for atmosphere posts.
  const venueIdentityLine = (context.brand_voice as any)?.recognizable_interior_identity
    ? `KENDTE STEDSDETALJER (faktuelle — brug disse; opfind IKKE andre): ${(context.brand_voice as any).recognizable_interior_identity}`
    : '';
  // V2: brand_essence_elaboration — gives AI hybrid/programme-aware identity context at post level
  const brandEssenceElaborationLine = (context.brand_voice as any)?.brand_essence_elaboration
    ? `IDENTITETSUDDYBNING: ${(context.brand_voice as any).brand_essence_elaboration}`
    : '';
  // FIX: was (context as any).target_audience — that field doesn't exist on WeekContext;
  // target_audience only lives inside brand_voice (fetched from business_brand_profile)
  const targetAudienceRaw = (context.brand_voice as any)?.target_audience;
  const targetAudienceLine = targetAudienceRaw
    ? `MÅLGRUPPE: ${typeof targetAudienceRaw === 'string' ? targetAudienceRaw : (targetAudienceRaw?.primary_demographic || JSON.stringify(targetAudienceRaw))}`
    : '';

  // Content strategy signals — injected per goal_mode so AI uses business-specific anchors
  const cs = (context.brand_voice as any)?.content_strategy;
  const contentStrategyHint = (() => {
    if (!cs || !goalMode) return '';
    if (goalMode === 'drive_footfall' && cs.footfall_signals?.length > 0) {
      return `FODFÆSTE-SIGNALER (brug mindst ét i rationale — disse er baseret på din Post Strategi):\n${(cs.footfall_signals as string[]).slice(0, 4).map((s) => `- ${s}`).join('\n')}`;
    }
    if (goalMode === 'build_brand' && cs.brand_anchors?.length > 0) {
      return `BRAND-ANKRE (væv mindst ét ind i rationale — disse er baseret på din Post Strategi):\n${(cs.brand_anchors as string[]).slice(0, 4).map((s) => `- ${s}`).join('\n')}`;
    }
    if (goalMode === 'retain_loyalty' && cs.loyalty_hooks?.length > 0) {
      return `LOYALITETSHOOKS (brug mindst ét i rationale — disse er baseret på din Post Strategi):\n${(cs.loyalty_hooks as string[]).slice(0, 4).map((s) => `- ${s}`).join('\n')}`;
    }
    return '';
  })();

  // Writing patterns — brand's actual vocabulary, opening/closing patterns and communication goal
  const typicalOpenings: string[] = ((context.brand_voice as any)?.typical_openings || []).slice(0, 2);
  const typicalClosings: string[] = ((context.brand_voice as any)?.typical_closings || []).slice(0, 2);
  const signaturePhrases: string[] = ((context.brand_voice as any)?.signature_phrases || []).slice(0, 4);
  const communicationGoal: string | null = (context.brand_voice as any)?.communication_goal || null;
  const writingPatternBlock = (typicalOpenings.length > 0 || typicalClosings.length > 0 || signaturePhrases.length > 0 || communicationGoal)
    ? [
        'SKRIVEMØNSTER (brug det der passer — naturligt og ægte, ikke mekanisk):',
        communicationGoal ? `• Kommunikationsmål: ${communicationGoal}` : null,
        typicalOpenings.length > 0 ? `• Typiske åbninger: ${typicalOpenings.map((o: string) => `"${o}"`).join(' / ')}` : null,
        typicalClosings.length > 0 ? `• Typiske afslutninger: ${typicalClosings.map((c: string) => `"${c}"`).join(' / ')}` : null,
        signaturePhrases.length > 0 ? `• Signaturfraser (kun i caption-tekst, IKKE i titel): ${signaturePhrases.map((p: string) => `"${p}"`).join(', ')}` : null,
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
      // Thu/Fri footfall driver — but use actual day, not hardcoded 'fredag'.
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

  // ── Phase 0 summary grouped by type ──
  // Weather factors are omitted here — the specific day's weather is already shown
  // in KONTEKST FOR DENNE DAG → Vejr above. Week-level weather averages would dilute it.
  const phase0Factors = contextualAnalysis.key_factors || [];
  const seasonFactors = phase0Factors.filter((f: any) => f.type === 'season');
  const eventFactors = phase0Factors.filter((f: any) => f.type === 'special_day');
  const economicFactors = phase0Factors.filter((f: any) => f.type === 'economic');
  const otherFactors = phase0Factors.filter((f: any) => !['weather', 'season', 'special_day', 'economic'].includes(f.type));

  let phase0Summary = 'KONTEKST FRA PHASE 0:\n';
  if (seasonFactors.length > 0) {
    phase0Summary += '\nSÆSON:\n';
    phase0Summary += seasonFactors.map((f: any) => `- ${f.name}: ${f.behavioral_impact} (${f.strategic_weight} vægt)`).join('\n');
  }
  if (eventFactors.length > 0) {
    phase0Summary += '\n\nEVENTS:\n';
    phase0Summary += eventFactors.map((f: any) => `- ${f.name}: ${f.behavioral_impact} (${f.strategic_weight} vægt)`).join('\n');
  }
  if (economicFactors.length > 0) {
    phase0Summary += '\n\nØKONOMISK TIMING:\n';
    phase0Summary += economicFactors.map((f: any) => `- ${f.name}: ${f.behavioral_impact} (${f.strategic_weight} vægt)`).join('\n');
  }
  if (otherFactors.length > 0) {
    phase0Summary += '\n\nØVRIGT:\n';
    phase0Summary += otherFactors.map((f: any) => `- ${f.name}: ${f.behavioral_impact} (${f.strategic_weight} vægt)`).join('\n');
  }

  const allAnglesSummary = strategicBrief.angles
    .map(a => `- ${a.focus} (${Math.round(a.weight * 100)}%): ${a.reasoning}`)
    .join('\n');

  const totalMenu = contentPlan.filter(p => p.type === 'menu_item').length;
  const totalExperience = contentPlan.length - totalMenu;
  const menuPct = Math.round((totalMenu / contentPlan.length) * 100);
  const contentDistribution = `CONTENT MIX DENNE UGE: ${totalMenu} menu_item posts + ${totalExperience} atmosphere/behind_scenes posts\nHvorfor: ${angle?.focus || 'Hovedvinklen'} har ${Math.round((angle?.weight || 0) * 100)}% vægt, og vi balancerer produkt-fokus med oplevelser.`;

  // Shared prompt blocks — identical in both menu and experience templates
  const sharedForbiddenBlock = buildForbiddenBlock('post');

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
    type DishEntry = { name: string; description?: string; category?: string; isSignature?: boolean };
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
    // Use substring matching (not exact): "Pariserbøf med rødbeder" matches "Pariserbøf" etc.
    const isUsed = (name: string): boolean => {
      const nameLower = name.toLowerCase().trim();
      return usedMenuItems.some(used => {
        const usedLower = used.toLowerCase().trim();
        return usedLower === nameLower || usedLower.includes(nameLower) || nameLower.includes(usedLower);
      });
    };

    let menuItems: DishEntry[] = preferencePool.filter(item => !isUsed(item.name));

    if (menuItems.length < preferencePool.length) {
      console.log(`[Phase 2b] Post ${postSlot.id}: Filtered out ${preferencePool.length - menuItems.length} already-used dishes. ${menuItems.length} available.`);
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
    const formatDish = (d: DishEntry): string => {
      let line = `- ${d.name}`;
      if (d.description) line += `: ${d.description}`;
      const periods = (d as any).service_periods as string[] | undefined;
      const periodLabel = periods && periods.length > 0 ? periods[0].toUpperCase() : (d.category || '');
      if (periodLabel) line += ` [${periodLabel}]`;
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
    const servicePeriodHint = `DIT TIDSPUNKT: ${canonicalTime}. Vælg KUN retter fra ${slotServiceLabel}-menuen — se [BRUNCH], [LUNCH] eller [DINNER] etiketten bag hvert dish. Posten markedsfører den N\u00c6STE service gæsten kan komme til, ikke en anden. ALDRIG frokostretter til aftenstidsposter og omvendt.`;

    // Template-specific rules based on content_category
    const templateTypeLabel = contentCategory === 'craving_visual'
      ? 'Sensorisk visuel ret-post (fokus på sanseoplevelse, ikke drift)'
      : 'Produkt-post med drifts-info (fokus på specifik ret + booking-mulighed)';

    const titleRule = contentCategory === 'craving_visual'
      ? `3. Title: 3-7 ord. Skal starte med sanselig beskrivelse, gerne med rettens navn.
   Gode eksempler: "Cremet pastaret med sprød parmesan", "Syrlig citustærte med flødecreme", "Mørke chokoladetrøfler"
   FORBUDTE STARTER: Forkæl, Nyd, Oplev, Tag, Prøv, Smag, Forestil, Drøm, Velkommen`
      : `3. Title: 3-7 ord. SKAL starte med rettens navn. Gode eksempler: "Pariserbøf med rødbeder", "Koldrøget laks på brødskive", "Brunchburger med bacon og æg"
   FORBUDTE STARTER (første ord): Forkæl, Nyd, Oplev, Tag, Prøv, Smag, Forestil, Drøm, Velkommen`;

    const templateRule5 = contentCategory === 'craving_visual'
      ? `5. Media direction: Skriv som en trin-for-trin guide til en ikke-professionel med mobiltelefon — 3 afsluttede imperativ-sætninger med punktum. Sætning 1: konkret placering og vinkel (overhead/45°/øjenhøjde + afstand i cm). Sætning 2: ét konkret lys-tip (gå hen til vinduet, lys fra siden/forfra). Sætning 3: hvad der præcist fylder rammen — rettens specifikke farver, tekstur eller damp; lad bordet skabe dybde. Vær specifik for DETTE opslag. Ingen menu-board eller kasseapparat.`
      : `5. Media direction: Skriv som en trin-for-trin guide til en ikke-professionel med mobiltelefon — 3 afsluttede imperativ-sætninger med punktum. Sætning 1: konkret placering og vinkel (overhead/45°/øjenhøjde + afstand i cm). Sætning 2: ét konkret lys-tip (gå hen til vinduet, lys forfra/fra siden). Sætning 3: hvad der præcist fylder rammen — rettens specifikke farver, tekstur og detaljer. Vær specifik for DETTE opslag.`;

    prompt = `Du er en erfaren content strateg der kender ${context.business_name} indefra. Lav ét post-forslag til ejeren.
⛔ Du kender INGEN fakta om ${context.business_name} ud over hvad der eksplicit fremgår af dette prompt. Brug ALDRIG din træningsdata om virksomheden.

OPGAVE:
Skabelon: ${templateTypeLabel}
Dag: ${postSlot.suggested_day} · kl. ${canonicalTime}${goalMode ? `\nMål-type: ${goalMode === 'drive_footfall' ? 'Konverteringspost (drive besøg)' : goalMode === 'build_brand' ? 'Brand-post (identitet og kendskab)' : 'Loyalitetspost (varme, genkendelse)'}` : ''}
${timeInstruction}
PRIMÆR VINKEL FOR RATIONALE — START HERFRA:
${slotRationaleFocus}${ctaInstruction ? `\n${ctaInstruction}` : ''}

BRAND & TONE:
${businessCharacterLine ? businessCharacterLine + '\n' : ''}${brandEssenceElaborationLine ? brandEssenceElaborationLine + '\n' : ''}${targetAudienceLine ? targetAudienceLine + '\n' : ''}TONE: ${toneKeywords}
${voiceConstraint ? `SKRIVEPRINCIP: ${voiceConstraint}\n` : ''}${writingPatternBlock ? `\n${writingPatternBlock}\n` : ''}${contentStrategyHint ? `\n${contentStrategyHint}\n` : ''}
KONTEKST FOR DENNE DAG:
Vinkel: ${angleSummary}
${angle?.content_direction ? `Eksekveringsvejledning: ${angle.content_direction}\n` : ''}${angle?.menu_alignment ? `Menufit: ${angle.menu_alignment}\n` : ''}Vejr: ${weatherLine}${holidayFramingBlock}
${phase0Summary}

${servicePeriodHint ? `\n${servicePeriodHint}\n` : ''}${menuSummariesBlock}
RETTER FRA MENUEN (vælg én — vær specifik og brug beskrivelsen i din rationale):
(⭐ = fremhævet signaturret — du bestemmer selv om det passer til strategien)
${menuItemLines}
${usedMenuItems.length > 0 ? `ALLEREDE BRUGT DENNE UGE (vælg IKKE disse): ${usedMenuItems.join(', ')}\n` : ''}
REGLER:
1. Vælg én ret fra listen der kan stå ALENE som et komplet måltid (forret, hovedret, brunchret, drinksmenu o.l.).
   Undgå tillæg, tilbehør og bioretter der normalt følger med en anden ret (fx "brød med smør", "salat på siden", "chips", "dipsauce").
   Opfind ingen nye retter. Hver ret må kun vises én gang denne uge!
2. Brug rettens BESKRIVELSE aktivt i rationale og media direction — det er her de konkrete detaljer gemmer sig.
   ⛔ OPFIND ALDRIG ingredienser, kødtyper, saucenavn eller garniturer der IKKE eksplicit fremgår af rettens beskrivelse i listen. Fx: skriv ikke "kalv" hvis listen kun siger "mørbrad", skriv ikke "rødvinssauce" hvis listen siger "portvinsglace". Brug ordlyden fra listen — ord for ord.
${titleRule}
   FORBUDTE TITELSUFFIKSER: "- ved Åen", "ved Åen", "ved åen" — stedets placering er implicit, skriv det IKKE i titlen
   FORBUDTE MØNSTRE: "Forkæl dig...", "[noget] ved Åen", "X-magi", "[Sæson]-X"
4. Rationale: 2-3 konkrete sætninger. ALLE tre punkter SKAL være til stede:
   a) TEMA-RELEVANS: Hvordan advancerer denne post ugens centrale argument (se PRIMÆR VINKEL ovenfor)?
      ✓ "Brunch-positioneringen drives frem af at vise et konkret brunchmåltid der beviser præmissen"
      ✗ "Det viser vores dedikation til god mad" (intet argument, ingen ugeskobling)
   b) POST-ROLLE: Hvad er denne posts specifikke rolle i ugens arc — åbner, driver eller afslutter den ugens argument?
      ✓ "[Navn]s fredag-post er ugens konverteringsdriver — her omsættes ugens fortælling til et konkret besøgstilbud"
      ✗ "Vi sætter altid gæsten i centrum" (generisk, ingen rolle i ugens fortælling)
   c) TIMING: Timing som støtte-argument for denne posts rolle — ikke som ugens primære åbner.
      ✓ "Fredag kl. 14 er beslutningsklar timing — folk planlægger aktivt weekendbesøg på dette tidspunkt"
      ✗ "Det er en god post til denne dag" (ingen slot-logik)
   ⛔ Brug ALDRIG vejr-adjektiver ("mildt", "smukt", "varmt", "koldt", "mild", "kølig", "kølige", "frisk", "friske", "skøn", "skønt") — brug kun faktisk temperatur fra "Vejr" eller undlad vejrreferencer.
   ⛔ Brug ALDRIG: "det viser vores dedikation", "den ægte start", "god oplevelse fra morgenstunden", "starter ugen rigtigt"
${usedThemesBlock ? `${usedThemesBlock}\n` : ''}${templateRule5}
   TITEL: Skriv med normal skrifttype — IKKE ALL CAPS. Retter med store bogstaver i menulisten skrives om: "BØF & BEARNAISE med RIBEYE" → "Bøf & bearnaise med ribeye".
${sharedForbiddenBlock}
PLATFORM-CAPTIONS — skriv korte captions til hvert netværk (basér på titel + rationale + rettens beskrivelse):
- caption_facebook: 1-2 sætninger. ${goalMode === 'drive_footfall' ? 'Følg CTA-instruktionen fra OPGAVE ovenfor (link, urgency, timing).' : 'Inviterende tone. Gerne med konkret handlingsopfordring.'}
- caption_instagram: 1-2 sætninger (kortere end Facebook). ${goalMode === 'drive_footfall' ? 'Følg CTA-instruktionen fra OPGAVE ("link i bio" — ingen URL). ' : ''}Afslut med 5-8 relevante hashtags på dansk. INGEN URL.

Svar KUN med JSON:
{
  "title": "Pariserbøf med rødbeder",
  "rationale": "2-3 konkrete sætninger der forbinder denne dag, dette tidspunkt og denne ret",
  "menu_item_used": "Præcis det valgte rets NAVN fra listen (kun navnet, ikke beskrivelsen)",
  "menu_item_description": "Rettens beskrivelse fra listen (kopier direkte fra listen — tomt hvis ingen beskrivelse)",
  "caption_facebook": "1-2 sætninger med CTA som angivet i OPGAVE${bookingLink && goalMode === 'drive_footfall' ? ` — inkl. booking-link` : ''}",
  "caption_instagram": "1-2 sætninger kortere + #hashtag1 #hashtag2 #hashtag3 #hashtag4 #hashtag5",
  "suggested_time": "${canonicalTime}",
  "cta_intent": "${resolvedCtaIntent}",
  "suggested_media": {
    "type": "photo",
    "direction": "Placer retten på et lyst bord og hold telefonen 50–70 cm over retten i let skrå vinkel. Gå hen til vinduet så lyset falder skråt fra siden. Fyld rammen med retten — læg tallerkenen lidt off-center og lad bordet skabe baggrund.",
    "photo_count": 1
  }
}`;
  } else {
    const locationInfo = [
      context.city,
      (context.location as any)?.neighborhood,
      ((context.location as any)?.has_outdoor_seating && outdoorSeatingOk) ? 'har udeservering' : null,
    ].filter(Boolean).join(', ');

    // Template-specific type description based on content_category (preferred) or legacy type
    const typeDescription = contentCategory === 'behind_scenes'
      ? 'Bag kulisserne (vis specifik scene, tidspunkt, rolle i køkkenet eller lokalet — ingen mad-navne)'
      : contentCategory === 'team_people'
        ? 'Menneskepost (vis en person, rolle, konkret fakta — blød tone, ingen hård salgstale)'
        : postSlot.type === 'behind_scenes'
          ? 'Bag kulisserne (vis mennesker, forberedelse, køkkenet)'
          : 'Stemnings-post (vis stedet, udsigten, atmosfæren)';

    // Template-specific title rule
    const experienceTitleRule = contentCategory === 'team_people'
      ? `3. Title: 3-7 ord. Skal fremhæve en person, rolle eller specifik menneskelig detalje.
   GODE EKSEMPLER: "Kokken der starter kl. 7", "En mandag med Martin", "Bartender på sin yndlingsaften"
   FORBUDTE STARTER: Forkæl, Nyd, Oplev, Tag, Prøv, Forestil, Drøm`
      : `3. Title: 3-7 ord. SKAL have et KONKRET anker: specifik scene, tidspunkt, aktivitet.
   GODE EKSEMPLER: "Bag marmitterne på en fredag", "Morgenkaffen er klar kl. 8", "En stille tirsdag inden frokostrushet", "Kl. 7:58 — køkkenet er allerede i gang", "Regndråber på ruden og varm kaffe"
   FORBUDTE STARTER (første ord): Forkæl, Nyd, Oplev, Tag, Prøv, Forestil, Drøm
   FORBUDT MØNSTER: Titler der åbner med '[Stedets/Værtens/Køkkenets/Gæstens] [adjektiv] [abstraktum]' — fx "Værtens velkendte smil", "Stedets varme atmosfære". Disse er holllow. Vis i stedet det konkrete øjeblik.`;

    // Template-specific rule 5
    const experienceRule5 = contentCategory === 'team_people'
      ? `5. Media direction: Skriv som en trin-for-trin guide til en ikke-professionel med mobiltelefon — 3 afsluttede imperativ-sætninger med punktum. Sætning 1: konkret placering og vinkel (øjenhøjde + afstand i cm). Sætning 2: ét konkret lys-tip (gå hen til vinduet, naturligt lys fra siden). Sætning 3: hvad der præcist fylder rammen — personen i aktion, ikke poserende. Vær specifik for DETTE opslag.`
      : `5. Media direction: Skriv som en trin-for-trin guide til en ikke-professionel med mobiltelefon — 3 afsluttede imperativ-sætninger med punktum. Sætning 1: konkret placering og vinkel (øjenhøjde/let hævet + afstand i cm). Sætning 2: ét konkret lys-tip (naturligt lys fra vinduet). Sætning 3: hvad der præcist fylder rammen — det centrale element i scenen med dybde. SKAL vise en anden scene end de allerede brugte.`;

    prompt = `Du er en erfaren content strateg der kender ${context.business_name} indefra. Lav ét post-forslag til ejeren.
⛔ Du kender INGEN fakta om ${context.business_name} ud over hvad der eksplicit fremgår af dette prompt. Brug ALDRIG din træningsdata om virksomheden — ikke stedsdetaljer, atmosfære, menudetaljer eller lokal viden.

OPGAVE:
Skabelon: ${typeDescription}
Dag: ${postSlot.suggested_day} · kl. ${canonicalTime}${goalMode ? `\nMål-type: ${goalMode === 'drive_footfall' ? 'Konverteringspost (drive besøg)' : goalMode === 'build_brand' ? 'Brand-post (identitet og kendskab)' : 'Loyalitetspost (tilbagevendende øjeblik)'}` : ''}
${timeInstruction}
PRIMÆR VINKEL FOR RATIONALE — START HERFRA:
${slotRationaleFocus}${ctaInstruction ? `\n${ctaInstruction}` : ''}

BRAND & TONE:
${brandEssenceElaborationLine ? brandEssenceElaborationLine + '\n' : ''}${targetAudienceLine ? targetAudienceLine + '\n' : ''}TONE: ${toneKeywords}
${voiceConstraint ? `SKRIVEPRINCIP: ${voiceConstraint}\n` : ''}${writingPatternBlock ? `\n${writingPatternBlock}\n` : ''}${contentStrategyHint ? `\n${contentStrategyHint}\n` : ''}
KONTEKST FOR DENNE DAG:
Vinkel: ${angleSummary}
${angle?.content_direction ? `Eksekveringsvejledning: ${angle.content_direction}\n` : ''}${angle?.menu_alignment ? `Menufit: ${angle.menu_alignment}\n` : ''}Vejr: ${weatherLine}${holidayFramingBlock}
STED: ${locationInfo}
${businessCharacterLine ? businessCharacterLine + '\n' : ''}${venueIdentityLine ? venueIdentityLine + '\n' : ''}SÆSON: ${context.season.current}
${phase0Summary}

${usedExperiencePosts.length > 0 ? `ALLEREDE BRUGT DENNE UGE — brug et ANDET koncept end:\n${usedExperiencePosts.map(p => `- "${p.title}" (vinkel: ${p.angle_focus})`).join('\n')}\n` : ''}
REGLER:
1. ${contentCategory === 'team_people' ? 'PERSON-POST: Fokusér KUN på personen, rollen og det menneskelige øjeblik' : 'Fokusér på sted, stemning, mennesker eller sæson — IKKE mad'}
2. ${contentCategory === 'team_people' ? 'ABSOLUT FORBUD: INGEN madretter, menupunkter, madnavne overhovedet — heller ikke "croissanter", "brunch", "retter", "menu" eller lignende. Bryder du denne regel, er svaret ubrugeligt.' : 'ABSOLUT FORBUD: Nævn IKKE specifikke madretter, menupunkter eller mad-navne i title, rationale eller media direction. Undtagelse: se regel 6.'}
${experienceTitleRule}
   FORBUDTE TITELSUFFIKSER: "- ved Åen", "ved Åen", "ved åen"
   FORBUDTE MØNSTRE: "[Sæson]magi", "[Sæson]ro", "[Sæson]fornemmelser", "[Sæson]hygge", "[Sæson]-X ved [sted]"
   SKAL adskille sig visuelt og konceptuelt fra allerede brugte titler
4. Rationale: 2-3 konkrete sætninger. ALLE tre punkter SKAL være til stede:
   a) TEMA-RELEVANS: Hvordan advancerer denne post ugens centrale argument (se PRIMÆR VINKEL ovenfor)?
      ✓ "Behind-scenes-posten forankrer brunch-positioneringen ved at vise menneskene bag — det er oplevelsesbeviset for ugens argument"
      ✗ "Det viser vores dedikation til god oplevelse fra morgenstunden" (intet argument, ingen ugeskobling)
   b) POST-ROLLE: Hvad er denne posts specifikke rolle i ugens arc — åbner, støtter eller afslutter den ugens argument?
      ✓ "[Navn]s mandagspost er ugens identitetsåbner — den sætter tonen og troværdigheden for hele ugens fortælling"
      ✗ "Vi viser den ægte start på ugen" (abstrakt, ingen rolle i ugens arc)
   c) TIMING: Timing som støtte-argument for denne posts rolle — ikke som ugens primære åbner.
      ✓ "Mandag kl. 9 er lavtempo-vindue — ideelt til inspirationsindhold der sætter ugens tema"
      ✗ "Det er en god dag til dette indhold" (ingen timing-logik)
   ⛔ Brug ALDRIG egne vejr-adjektiver ("mildt", "smukt", "varmt", "koldt", "kølig", "kølige", "frisk", "friske", "skøn", "skønt") — brug kun faktisk temperatur fra "Vejr" eller udelad vejrreferencer helt.
   ⛔ Brug ALDRIG: "det viser vores dedikation", "den ægte start", "god oplevelse fra morgenstunden", "starter ugen rigtigt"
${usedThemesBlock ? `${usedThemesBlock}\n` : ''}${experienceRule5}
${contentCategory === 'behind_scenes' ? `6. VALGFRIT — kun hvis scenen konkret viser tilberedning af en specifik ret eller drink:
   Inkludér "menu_item_used" med rettens/drinkens præcise navn (fx "Pariserbøf", "Negroni", "Confiteret nakkefilet af gris").
   Nævn IKKE retten i title eller rationale — kun i menu_item_used-feltet.
   Ren stemningsscene uden konkret madlavning → udelad feltet helt.` : ''}
${voiceRationaleLine ? `\n${voiceRationaleLine}\n` : ''}
${sharedForbiddenBlock}
PLATFORM-CAPTIONS — skriv korte captions til hvert netværk (basér på titel + rationale + stemning/person):
- caption_facebook: 1-2 sætninger. ${goalMode === 'drive_footfall' ? 'Følg CTA-instruktionen fra OPGAVE ovenfor (link, urgency, timing).' : 'Inviterende tone. Gerne et spørgsmål til engagement.'}
- caption_instagram: 1-2 sætninger (kortere end Facebook). ${goalMode === 'drive_footfall' ? 'Følg CTA-instruktionen fra OPGAVE ("link i bio" — ingen URL). ' : ''}Afslut med 5-8 relevante hashtags på dansk. INGEN URL.

Svar KUN med JSON:
{
  "title": "${contentCategory === 'team_people' ? 'Kokken der starter kl. 7' : 'Bag marmitterne på en fredag'}",
  "rationale": "2-3 konkrete sætninger der forbinder denne dag, dette tidspunkt og denne post",${contentCategory === 'behind_scenes' ? `
  "menu_item_used": "Kun hvis scenen viser konkret tilberedning — ellers udelad dette felt",` : ''}
  "caption_facebook": "1-2 sætninger med CTA som angivet i OPGAVE${bookingLink && goalMode === 'drive_footfall' ? ` — inkl. booking-link` : ''}",
  "caption_instagram": "1-2 sætninger kortere + #hashtag1 #hashtag2 #hashtag3 #hashtag4 #hashtag5",
  "suggested_time": "${canonicalTime}",
  "cta_intent": "${resolvedCtaIntent}",
  "suggested_media": {
    "type": "photo",
    "direction": "${contentCategory === 'team_people' ? 'Sæt kameraet i øjenhøjde ca. 60 cm fra personen. Gå hen til vinduet så det naturlige lys falder fra siden. Fang personen i aktion — ikke poserende.' : 'Stå to skridt tilbage og hold kameraet let hævet i øjenhøjde. Brug lyset fra det nærmeste vindue forfra eller fra siden. Fang det centrale element med omgivelserne som dybde.'}",
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

    // Safety net: if outdoor seating is not suitable (cold/overcast) and the title
    // opens with an outdoor-seating reference ("Terrassen" or "Udeservering"), block it
    if (!outdoorSeatingOk && /^(terrassen|udeservering)\b/i.test(correctedTitle)) {
      console.log(`[Phase 2b] Blocked outdoor-seating title "${correctedTitle}" — outdoor seating not suited today. Using neutral fallback.`);
      correctedTitle = 'En stille dag bag disken';
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
        correctedTitle = result.parsed.menu_item_used;
      }
    }

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
      suggested_time: canonicalTime, // always use our computed canonical time — AI output may be wrong
      title: correctedTitle,
      rationale: correctedRationale,
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
    };
  }
}
