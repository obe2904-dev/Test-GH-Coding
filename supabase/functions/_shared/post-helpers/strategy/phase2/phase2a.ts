/**
 * PHASE 2a: CONTENT PLANNER
 *
 * Decides content types, angle distribution, and days.
 * Gets NO menu data (prevents hallucination).
 * Short prompt (~800 chars) → Gemini forgets nothing.
 *
 * Uses Gemini 2.5 Flash.
 */

import type { StrategicBrief, Platform } from '../../types/strategy-types.ts';
import { callGeminiWithRetry } from '../infrastructure.ts';

export async function generateContentPlan2a(
  strategicBrief: StrategicBrief,
  availableDays: string[],
  targetPostCount: number,
  platforms: Platform[],
  contentCategoryWeights?: Record<string, number>,
  previousFlexibleDows?: number[],      // DOWs used by Slot D in last 2 weeks (Change B)
  events?: Array<{ name?: string; date: string; date_end?: string | null; days_away: number; type: string; commercial_weight?: number | null }>, // for event-pin (Change C)
): Promise<Array<{ id: number; type: string; angle_focus: string; suggested_day: string; platforms: Platform[]; goal_mode?: string; content_category?: string; slot_id?: string }>> {

  const t0 = performance.now();

  const anglesSummary = strategicBrief.angles
    .map(a => `"${a.focus}" (${Math.round(a.weight * 100)}%)`)
    .join(', ');

  // If brand profile provides product_menu weight (0–100), use it; fall back to 60%
  const menuWeight = contentCategoryWeights?.product_menu;
  const rawMenuMax = menuWeight !== undefined
    ? Math.round(targetPostCount * menuWeight / 100)
    : Math.ceil(targetPostCount * 0.6);
  const maxMenuPosts = Math.max(1, Math.min(rawMenuMax, targetPostCount - 1));
  const minExperiencePosts = targetPostCount - maxMenuPosts;

  const prompt = `Du er marketing-chef. Fordel ${targetPostCount} posts over ugen.

FOKUS-OMRÅDER: ${anglesSummary}

TILGÆNGELIGE DAGE: ${availableDays.join(', ')}

PLATFORME: ${JSON.stringify(platforms)}

INDHOLDSTYPER:
- "menu_item": Vis en specifik ret (max ${maxMenuPosts} stk)
- "atmosphere": Vis stemning, sted, udsigt (mindst ${minExperiencePosts} stk)
- "behind_scenes": Vis køkken, mennesker, forberedelse
- "seasonal": Vis sæson-stemning uden specifik ret

REGLER:
1. Præcis ${targetPostCount} posts
2. Max ${maxMenuPosts} menu_item, resten atmosphere/behind_scenes/seasonal
3. Fordel posts jævnt over dagene (max 1 per dag)
4. Fordel angle_focus efter vægtning (højere vægt = flere posts)
5. Brug PRÆCIS de fokus-navne der er givet ovenfor
6. KRITISK: Ingen to posts af SAMME type (fx atmosphere) må dele angle_focus — hvert par (type + angle_focus) skal være unikt i arrayet

Svar KUN med JSON-array:
[
  { "id": 1, "type": "menu_item", "angle_focus": "eksakt_fokus_navn", "suggested_day": "2026-02-17", "platforms": ["facebook", "instagram"] },
  { "id": 2, "type": "atmosphere", "angle_focus": "eksakt_fokus_navn", "suggested_day": "2026-02-18", "platforms": ["facebook", "instagram"] }
]`;

  const result = await callGeminiWithRetry(
    prompt,
    {
      temperature: 0.2,
      maxOutputTokens: 6144,
      jsonMode: true,
      model: 'gemini-2.5-flash',
    },
    'Phase 2a'
  );

  const plan = Array.isArray(result.parsed) ? result.parsed : result.parsed.posts || result.parsed.post_plan || [];

  // ── Use Phase 1 slot assignments from strategicBrief.angles ──
  // Phase 1 has already computed the correct slot_id / goal_mode / content_category /
  // timing_window for each post based on goal_blend weights. We use those here
  // instead of a hardcoded SLOT_ORDER, so the slot distribution really reflects
  // the business's Post Strategi.
  const phase1Slots = strategicBrief.angles.slice(0, targetPostCount);

  // ── Deterministically assign suggested_day from timing_window ──
  //
  // Day guardrail: encode which days of the week are appropriate for each goal_mode.
  //   drive_footfall → Wed–Fri first (peak decision-making window for dinner/outing)
  //   build_brand    → Mon, Tue, Sun first (awareness at start-of-week or weekend)
  //   retain_loyalty → Tue, Mon, Sun first (loyalty touchpoints mid-start-of-week)
  // Used for 'any'-timing_window slots (Slot D) to enforce the weekly strategy.
  const msPerDay = 24 * 60 * 60 * 1000;

  const goalModePreferredDows: Record<string, number[]> = {
    drive_footfall: [3, 4, 5, 6, 1, 2, 0],  // Wed Thu Fri Sat Mon Tue Sun
    build_brand:    [1, 2, 0, 6, 5, 3, 4],  // Mon Tue Sun Sat Fri Wed Thu
    retain_loyalty: [2, 1, 0, 6, 5, 3, 4],  // Tue Mon Sun Sat Fri Wed Thu
  };

  const getDayOfWeek = (isoDate: string): number => {
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, d).getDay(); // 0=Sun, 1=Mon, ...6=Sat — local, avoids UTC offset
  };

  // Returns DOW preference list for a timing_window + goal_mode pair.
  // Fixed windows (Mon/Wed/Thu) keep their canonical DOW preference.
  // 'any' windows use the goal_mode day guardrail.
  const preferredDowsForWindow = (w: string, goalMode?: string): number[] => {
    if (/\bMon\b/.test(w))  return [1];
    if (/\bTue\b/.test(w))  return [2];
    if (/\bWed\b/.test(w))  return [3, 4];
    if (/\bThu\b/.test(w))  return [4, 5];
    // Fri-Sat window: prefer Sat first — Saturday has higher commercial footfall for restaurants
    if (/\bFri\b/.test(w) && /\bSat\b/.test(w))  return [6, 5];
    if (/\bFri\b/.test(w))  return [5, 6];
    if (/\bSat\b/.test(w))  return [6, 0];
    // 'any' — use goal_mode day guardrail
    if (goalMode && goalModePreferredDows[goalMode]) return goalModePreferredDows[goalMode];
    return [1, 2, 3, 4, 5, 6, 0];
  };

  // Sort key determines assignment order (earlier = higher priority for preferred days).
  // brand/loyalty 'any' slots sort between Mon (1) and Wed (3) so they prefer
  // Tue before the footfall slots claim it; footfall 'any' sorts after Thu (4.5).
  const calendarSortKey = (w: string, goalMode?: string): number => {
    if (/\bMon\b/.test(w))  return 1;
    if (/\bTue\b/.test(w))  return 2;
    if (/\bWed\b/.test(w))  return 3;
    if (/\bThu\b/.test(w))  return 4;
    if (/\bFri\b/.test(w))  return 5;
    if (/\bSat\b/.test(w))  return 6;
    if (goalMode === 'build_brand' || goalMode === 'retain_loyalty') return 1.5;
    if (goalMode === 'drive_footfall') return 4.5;
    return 99;
  };

  // For 'any' slots: pick the unused day that maximises distance from already-assigned
  // days (best spread), tie-broken by goal_mode DOW preference.
  // prevFlexDows: DOW numbers used by Slot D in recent weeks — small penalty to encourage variety.
  const pickSpreadDay = (
    unused: string[],
    assignedSet: Set<string>,
    goalMode: string,
    prevFlexDows: number[] = [],
  ): string | undefined => {
    if (unused.length === 0) return undefined;
    const assignedMs = Array.from(assignedSet).map(d => new Date(d + 'T00:00:00').getTime());
    const gPref = goalModePreferredDows[goalMode] ?? [];
    const scored = unused.map(day => {
      const dayMs = new Date(day + 'T00:00:00').getTime();
      const minGap = assignedMs.length === 0
        ? Infinity
        : Math.min(...assignedMs.map(ms => Math.abs(dayMs - ms) / msPerDay));
      const goalIdx = gPref.indexOf(getDayOfWeek(day));
      const goalScore = goalIdx === -1 ? -(gPref.length + 1) : -goalIdx;
      // Soft penalty for DOWs used as flexible slot in recent weeks (Change B)
      const recentPenalty = prevFlexDows.includes(getDayOfWeek(day)) ? -0.5 : 0;
      return { day, minGap, goalScore: goalScore + recentPenalty };
    });
    scored.sort((a, b) => b.minGap !== a.minGap ? b.minGap - a.minGap : b.goalScore - a.goalScore);
    return scored[0]?.day;
  };

  // ── Event-pin: anchor a slot to the lead-up day of high-weight events (Change C, improved) ──
  // Triggers for:
  //   • Any holiday (type === 'holiday')
  //   • Any event with commercial_weight ≥ 4 (e.g. Mors Dag, Valentine's)
  //   • school_vacation start day (first day of the period)
  // Lead time: 1 day before (2 days for Mon/Tue events to avoid weekend).
  // Applies within the current week (days_away 0–7 for start, or span covers the week).
  const eventPinDates = new Set<string>();
  // Also track which pins are "high priority" (holiday/weight≥4) vs normal (school_vacation start)
  const highPriorityPinDates = new Set<string>();
  if (events && events.length > 0) {
    for (const ev of events) {
      const isHighPriority = ev.type === 'holiday' || (ev.commercial_weight ?? 0) >= 4;
      const isSchoolVacationStart = ev.type === 'school_vacation' && ev.days_away >= 0 && ev.days_away <= 3;
      if (!isHighPriority && !isSchoolVacationStart) continue;
      if (ev.days_away < 0 || ev.days_away > 7) continue;
      const evDate = new Date(ev.date.split('T')[0] + 'T00:00:00');
      const evDow = evDate.getDay();
      // Post 2 days before Mon/Tue events (avoid posting on weekend before a weekday holiday)
      const leadDays = (evDow === 1 || evDow === 2) ? 2 : 1;
      const pinDate = new Date(evDate.getTime() - leadDays * msPerDay);
      const pinISO = `${pinDate.getFullYear()}-${String(pinDate.getMonth() + 1).padStart(2, '0')}-${String(pinDate.getDate()).padStart(2, '0')}`;
      if (availableDays.includes(pinISO)) {
        eventPinDates.add(pinISO);
        if (isHighPriority) highPriorityPinDates.add(pinISO);
        console.log(`[Phase 2a] Event pin: "${ev.name ?? ev.type}" on ${ev.date} → lead-up date ${pinISO} (${isHighPriority ? 'HIGH' : 'normal'} priority)`);
      }
    }
  }

  // Build list of (originalIndex, slot) sorted by calendar preference
  const slotsWithIndex = phase1Slots.map((s, i) => ({
    s,
    i,
    sortKey: calendarSortKey((s as any)?.timing_window ?? 'any', (s as any)?.goal_mode),
  }));
  slotsWithIndex.sort((a, b) => a.sortKey - b.sortKey);

  // Assign days greedily in calendar order
  const usedDays = new Set<string>();
  const dayByOriginalIndex: Record<number, string> = {};
  for (const { s, i } of slotsWithIndex) {
    const timingWindow = (s as any)?.timing_window ?? 'any';
    const goalMode   = (s as any)?.goal_mode ?? 'retain_loyalty';
    const isAnySlot  = timingWindow === 'any';
    let assigned: string | undefined;

    // Event-pin pre-check: (Change C, improved)
    // • High-priority pins (holiday / commercial_weight≥4): apply to ANY slot type that has
    //   goal_mode === 'drive_footfall' — including fixed-window slots.
    // • Normal pins (school_vacation start): only apply to any-window drive_footfall slots.
    // • Fixed-window slots: only use pins within the slot's own DOW range; fall back to any pin
    //   only if no in-window pin exists. Sorted by preferred DOW order (not chronological) so
    //   e.g. Fri-Sat prefers Sat first.
    if (goalMode === 'drive_footfall' && eventPinDates.size > 0) {
      const allCandidatePins = isAnySlot
        ? availableDays.filter(d => !usedDays.has(d) && eventPinDates.has(d))
        : availableDays.filter(d => !usedDays.has(d) && highPriorityPinDates.has(d));
      let candidatePins = allCandidatePins;
      if (!isAnySlot && allCandidatePins.length > 0) {
        // Filter to pins within this slot's preferred DOW window, sorted by DOW preference order
        const preferredDows = preferredDowsForWindow(timingWindow, goalMode);
        const inWindowPins = allCandidatePins.filter(d => preferredDows.includes(getDayOfWeek(d)));
        const pinsToSort = inWindowPins.length > 0 ? inWindowPins : allCandidatePins;
        candidatePins = [...pinsToSort].sort((a, b) => {
          const ai = preferredDows.indexOf(getDayOfWeek(a));
          const bi = preferredDows.indexOf(getDayOfWeek(b));
          const aIdx = ai === -1 ? 99 : ai;
          const bIdx = bi === -1 ? 99 : bi;
          return aIdx !== bIdx ? aIdx - bIdx : a.localeCompare(b);
        });
      }
      if (candidatePins.length > 0) {
        assigned = candidatePins[0];
        console.log(`[Phase 2a] Event pin applied: ${goalMode} ${isAnySlot ? 'any' : 'fixed'}-slot (${timingWindow}) -> ${assigned}`);
      }
    }

    if (!assigned && isAnySlot) {
      // Spread-aware: pick the unused day that best separates from already-assigned days
      const unused = availableDays.filter(d => !usedDays.has(d));
      assigned = pickSpreadDay(unused, usedDays, goalMode, previousFlexibleDows ?? []);
    } else if (!assigned) {
      // Fixed-window: prefer exact DOW then fallback
      const preferred = preferredDowsForWindow(timingWindow, goalMode);
      for (const dow of preferred) {
        assigned = availableDays.find(d => !usedDays.has(d) && getDayOfWeek(d) === dow);
        if (assigned) break;
      }
    }
    if (!assigned) {
      // Ultimate fallback: first unused available day
      assigned = availableDays.find(d => !usedDays.has(d)) ?? availableDays[availableDays.length - 1];
    }
    usedDays.add(assigned);
    dayByOriginalIndex[i] = assigned;
  }

  // ── Consecutive-days guard (max 2 days in a row) ─────────────────────────
  // Walk sorted assignment list; if a run of ≥3 consecutive calendar days is found
  // AND there is still an unused available day AND one of the ≥3rd slots has
  // timing_window='any' (flexible), move it to the best spread-maximising unused day.
  // Repeats up to 5 times until no run of ≥3 remains or no move is possible.
  for (let iter = 0; iter < 5; iter++) {
    const sorted = Object.entries(dayByOriginalIndex)
      .map(([idx, date]) => ({ idx: parseInt(idx), date }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Find first run of ≥3 consecutive calendar days
    let runStartI = -1, runEndI = -1;
    outer: for (let i = 0; i < sorted.length - 1; i++) {
      let j = i;
      while (
        j + 1 < sorted.length &&
        new Date(sorted[j + 1].date + 'T00:00:00').getTime() -
        new Date(sorted[j].date + 'T00:00:00').getTime() === msPerDay
      ) j++;
      if (j - i >= 2) { runStartI = i; runEndI = j; break outer; }
    }
    if (runStartI === -1) break; // no ≥3 run, done

    const unused = availableDays.filter(d => !usedDays.has(d));
    if (unused.length === 0) break;

    // Try to move the 3rd+ slot in the run (most flexible first = timing_window='any')
    let moved = false;
    for (let k = runStartI + 2; k <= runEndI && !moved; k++) {
      const { idx } = sorted[k];
      const slotTw = (phase1Slots[idx] as any)?.timing_window ?? 'any';
      if (slotTw !== 'any') continue;

      const gm = phase1Slots[idx]?.goal_mode ?? 'retain_loyalty';
      // Find an unused day that does NOT create a new ≥3 consecutive run
      const candidateDay = unused.find(d => {
        const updatedDates = sorted
          .filter((_, si) => si !== k)
          .map(s => s.date)
          .concat([d])
          .sort();
        for (let ci = 0; ci < updatedDates.length - 2; ci++) {
          const t0ms = new Date(updatedDates[ci]     + 'T00:00:00').getTime();
          const t1ms = new Date(updatedDates[ci + 1] + 'T00:00:00').getTime();
          const t2ms = new Date(updatedDates[ci + 2] + 'T00:00:00').getTime();
          if (t1ms - t0ms === msPerDay && t2ms - t1ms === msPerDay) return false;
        }
        return true;
      });

      if (candidateDay) {
        usedDays.delete(sorted[k].date);
        usedDays.add(candidateDay);
        dayByOriginalIndex[idx] = candidateDay;
        moved = true;
        console.log(`[Phase 2a] Consecutive guard: moved slot ${idx} from ${sorted[k].date} → ${candidateDay} (broke ≥3-day run)`);
      }
    }
    if (!moved) break; // can't improve further
  }

  // Match each plan entry to the correct Phase 1 slot by angle_focus name.
  // Index-based matching breaks whenever the AI returns posts in a different
  // order than Phase 1's angle array (e.g. "Brunch ved Åen" gets Fri-Sat 14:00).
  const usedPhase1Indices = new Set<number>();
  const enrichedPlan = plan.map((p: any, planIdx: number) => {
    // Find the Phase 1 slot whose focus matches this plan entry's angle_focus.
    // Track used indices to handle the rare case of duplicate angle_focus values.
    let slotIdx = phase1Slots.findIndex(
      (s, i) => s.focus === p.angle_focus && !usedPhase1Indices.has(i)
    );
    if (slotIdx === -1) {
      // Fallback: any unused slot
      slotIdx = phase1Slots.findIndex((_, i) => !usedPhase1Indices.has(i));
    }
    if (slotIdx === -1) slotIdx = planIdx % phase1Slots.length; // last resort
    usedPhase1Indices.add(slotIdx);

    const phase1Slot = phase1Slots[slotIdx];
    const assignedDay = dayByOriginalIndex[slotIdx] ?? availableDays[planIdx] ?? availableDays[0];
    return {
      ...p,
      goal_mode:        phase1Slot?.goal_mode        ?? 'drive_footfall',
      content_category: phase1Slot?.content_category ?? 'product_menu',
      slot_id:          phase1Slot?.slot_id          ?? 'A',
      timing_window:    (phase1Slot as any)?.timing_window ?? 'any', // forward to phase2b for canonical-time resolution
      suggested_day:    assignedDay, // calendar-aware, overrides AI pick
    };
  });

  // Sort by calendar date so Phase 2b processes posts in chronological order.
  // This ensures menu dedup and rationale-theme exclusions fire in the right sequence.
  enrichedPlan.sort((a: any, b: any) => a.suggested_day.localeCompare(b.suggested_day));

  console.log(`[Phase 2a] Completed in ${Math.round(performance.now() - t0)}ms - Plan:`, enrichedPlan.map((p: any) => `${p.id}: ${p.type}/${p.content_category} [${p.goal_mode}] (${p.angle_focus}) → ${p.suggested_day}`));

  return enrichedPlan;
}
