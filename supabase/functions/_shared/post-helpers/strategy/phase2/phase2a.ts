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
import { BusinessRulesEngine, type WeekContext, type DayAllocationRule } from '../../business-rules-engine.ts';

export async function generateContentPlan2a(
  strategicBrief: StrategicBrief,
  availableDays: string[],
  targetPostCount: number,
  platforms: Platform[],
  contentCategoryWeights?: Record<string, number>,
  previousFlexibleDows?: number[],      // DOWs used by Slot D in last 2 weeks (Change B)
  events?: Array<{ name?: string; date: string; date_end?: string | null; days_away: number; type: string; commercial_weight?: number | null }>, // for event-pin (Change C)
  categoryOverrides?: Array<{ content_type: string; type_rationale: string }>, // Phase C: analytics type only (not template routing)
  revenueDrivers?: any, // Revenue drivers from business_brand_profile
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

  // Extract strategic narrative for intelligent day clustering
  const weekSummary = strategicBrief.week_summary || '';
  const competitiveAdvantage = strategicBrief.competitive_advantage || '';
  
  // Build strategic context for AI day selection
  const strategicContext = weekSummary 
    ? `\n\nSTRATEGISK KONTEKST:\n"${weekSummary}"\n${competitiveAdvantage ? `\nKoncurrencefordel: "${competitiveAdvantage}"\n` : ''}\n⚠️ KRITISK: Vælg dage der understøtter denne strategi. Hvis strategien fokuserer på weekend, cluster posts torsdag-søndag. Hvis strategien handler om hverdage, brug mandag-fredag. Skab et narrativ-flow med posts der bygger på hinanden.`
    : '';

  const prompt = `Du er marketing-chef. Fordel ${targetPostCount} posts over ugen.

FOKUS-OMRÅDER: ${anglesSummary}
${strategicContext}

TILGÆNGELIGE DAGE: ${availableDays.join(', ')}

PLATFORME: ${JSON.stringify(platforms)}

INDHOLDSTYPER:
- "menu_item": Vis en specifik ret (max ${maxMenuPosts} stk)
- "atmosphere": Vis stemning, sted, udsigt (mindst ${minExperiencePosts} stk)
- "behind_scenes": Vis køkken, mennesker, forberedelse
- "seasonal": Vis sæson-stemning uden specifik ret

REGLER:
• Præcis ${targetPostCount} posts, max ${maxMenuPosts} menu_item
• 1 post/dag, fordel efter vægtning
• Brug EKSAKTE fokus-navne
• ⚠️ Unikt (type + angle_focus) for hver post
• Vælg suggested_day baseret på strategisk timing (byg narrativ-momentum mod hovedfokus)

Svar KUN med JSON:
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
  //
  // CRITICAL: If Phase 1 provides fewer slots than targetPostCount, we need to
  // expand the slots to match. This happens when the strategic brief has limited
  // angles but we need more posts for better week coverage.
  let phase1Slots = strategicBrief.angles.slice(0, targetPostCount);
  
  if (phase1Slots.length < targetPostCount) {
    console.log(`[Phase 2a] Expanding ${phase1Slots.length} Phase 1 slots to ${targetPostCount} total slots`);
    
    // Replicate slots cyclically, but mark them as flexible ("any" timing)
    // so they can be assigned to any available day. Give them unique focus values
    // to prevent Gemini's angle_focus from matching multiple expanded slots.
    const expandedSlots = [];
    for (let i = 0; i < targetPostCount; i++) {
      const baseSlot = phase1Slots[i % phase1Slots.length];
      if (i < phase1Slots.length) {
        // Original slots keep their timing windows
        expandedSlots.push(baseSlot);
      } else {
        // Expanded slots become flexible (any timing) with unique focus to prevent duplicate matching
        expandedSlots.push({
          ...baseSlot,
          focus: `__expanded_slot_${i}__`,  // Unique focus that won't match Gemini's output
          timing_window: 'any',
          slot_id: `${baseSlot.slot_id}_exp${i}`
        });
      }
    }
    phase1Slots = expandedSlots;
  }

  // ── BUSINESS RULES ENGINE: Revenue-driven day allocation ──
  // If brand profile has revenue_drivers, generate allocation rules from business logic
  // instead of using pure calendar templates. Revenue driver posts get PRIORITY assignment
  // before calendar-first spread logic.
  let businessRules: DayAllocationRule[] = [];
  
  if (revenueDrivers) {
    try {
      const weekContext: WeekContext = {
        week_start_date: availableDays[0],
        week_end_date: availableDays[availableDays.length - 1],
        week_type: events && events.length > 0 ? 'event' : 'normal',
        events: events?.map(e => ({
          name: e.name || e.type,
          date: e.date.split('T')[0],
          category: e.type
        })) || [],
        post_count: targetPostCount
      };
      
      const rulesEngine = new BusinessRulesEngine(revenueDrivers);
      businessRules = rulesEngine.generateWeeklyAllocationRules(weekContext);
      
      console.log(`[Phase 2a] Business Rules Engine: Generated ${businessRules.length} allocation rules from revenue_drivers`);
      businessRules.forEach(rule => {
        console.log(`  - ${rule.business_moment}: priority ${rule.priority}, days ${rule.post_days.join(', ')}`);
      });
    } catch (err) {
      console.warn('[Phase 2a] Business Rules Engine failed, falling back to calendar logic:', err);
    }
  }

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
  // Returns DOW preference list for a timing_window + goal_mode pair.
  // Parses ALL named days in the window string so "Tue-Wed 11:00" correctly
  // returns [2, 3] rather than stopping at the first match.
  // 'any' windows fall back to the goal_mode day guardrail.
  const DAY_NAMES: Array<[RegExp, number]> = [
    [/\bMon\b/, 1],
    [/\bTue\b/, 2],
    [/\bWed\b/, 3],
    [/\bThu\b/, 4],
    [/\bFri\b/, 5],
    [/\bSat\b/, 6],
    [/\bSun\b/, 0],
  ];
  const preferredDowsForWindow = (w: string, goalMode?: string): number[] => {
    if (!w || w === 'any') {
      if (goalMode && goalModePreferredDows[goalMode]) return goalModePreferredDows[goalMode];
      return [1, 2, 3, 4, 5, 6, 0];
    }
    // Collect all DOWs mentioned in the window string (preserves declaration order = priority)
    const matched = DAY_NAMES.filter(([re]) => re.test(w)).map(([, dow]) => dow);
    if (matched.length > 0) {
      // Special case: Fri-Sat window prefers Sat first (higher commercial footfall)
      if (matched.includes(5) && matched.includes(6)) return [6, 5];
      return matched;
    }
    // No named day found → treat as 'any'
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

  // ── REVENUE DRIVER PRE-ASSIGNMENT ──
  // Before calendar greedy allocation, pre-assign days for revenue driver rules.
  // These get PRIORITY over calendar-first logic to ensure business moments are covered.
  const usedDays = new Set<string>();
  const dayByOriginalIndex: Record<number, string> = {};
  const revenueDriverSlotIndices = new Set<number>(); // Track which slots were revenue-assigned
  
  if (businessRules.length > 0) {
    const DAY_NAME_TO_DOW: Record<string, number> = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
      'Thursday': 4, 'Friday': 5, 'Saturday': 6
    };
    
    console.log(`[Phase 2a] Starting revenue driver assignment:`, {
      total_rules: businessRules.length,
      total_slots: slotsWithIndex.length,
      available_days_count: availableDays.length,
      available_days: availableDays.map(d => `${d} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][getDayOfWeek(d)]})`).join(', ')
    });
    
    // Sort business rules by priority (lowest number = highest priority)
    const sortedRules = [...businessRules].sort((a, b) => a.priority - b.priority);
    console.log(`[Phase 2a] Processing ${sortedRules.length} rules in priority order`);
    
    // For each rule, find ANY available slot and assign its recommended day
    // (Not just drive_footfall - preferred_day_pattern covers all revenue moments)
    for (const rule of sortedRules) {
      if (rule.priority >= 10) continue; // Skip flexible slots (priority 10+)
      
      console.log(`[Phase 2a] Processing rule ${rule.rule_id}, priority ${rule.priority}, days: ${rule.post_days.join(', ')}`);
      
      // Find any unused slot (ANY goal_mode works)
      const slotMatch = slotsWithIndex.find(({ s, i }) => {
        return !revenueDriverSlotIndices.has(i); // Just check not already assigned
      });
      
      if (!slotMatch) {
        console.log(`[Phase 2a] ❌ No available slot for rule ${rule.rule_id} - ${businessRules.length} rules, ${revenueDriverSlotIndices.size} assigned, ${slotsWithIndex.length} total slots`);
        continue; // No available slots
      }
      
      console.log(`[Phase 2a]   Found available slot ${slotMatch.i} for rule ${rule.rule_id}`);
      
      // Find best day from rule's recommended days that's available
      let assignedDay: string | undefined;
      for (const dayName of rule.post_days) {
        const dow = DAY_NAME_TO_DOW[dayName];
        if (dow === undefined) {
          console.log(`[Phase 2a]   ⚠️ Unknown day name: ${dayName}`);
          continue;
        }
        
        console.log(`[Phase 2a]   Looking for ${dayName} (dow=${dow}) in availableDays`);
        const candidate = availableDays.find(d => 
          !usedDays.has(d) && getDayOfWeek(d) === dow
        );
        if (candidate) {
          assignedDay = candidate;
          console.log(`[Phase 2a]   ✓ Found candidate: ${candidate}`);
          break;
        } else {
          const matchingDows = availableDays.filter(d => getDayOfWeek(d) === dow);
          const usedMatchingDows = matchingDows.filter(d => usedDays.has(d));
          console.log(`[Phase 2a]   ✗ No candidate for ${dayName}: matching days=${matchingDows.length}, already used=${usedMatchingDows.length}`);
        }
      }
      
      if (assignedDay) {
        usedDays.add(assignedDay);
        dayByOriginalIndex[slotMatch.i] = assignedDay;
        revenueDriverSlotIndices.add(slotMatch.i);
        console.log(`[Phase 2a] ✅ Preferred day pattern: ${rule.business_moment} → ${assignedDay} (slot ${slotMatch.i}, priority ${rule.priority})`);
      } else {
        console.log(`[Phase 2a] ❌ No available day found for rule ${rule.rule_id} (checked: ${rule.post_days.join(', ')})`);
      }
    }
    console.log(`[Phase 2a] Revenue driver assignment complete: ${revenueDriverSlotIndices.size}/${businessRules.length} rules applied to ${slotsWithIndex.length} slots`);
    console.log(`[Phase 2a] Used days: ${Array.from(usedDays).sort().join(', ')}`);
  }
  // ── Calendar greedy allocation for remaining slots ──
  // Revenue driver slots already assigned above; skip them here.
  for (const { s, i } of slotsWithIndex) {
    if (dayByOriginalIndex[i]) continue; // Already assigned by revenue driver logic
    
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
  // Walk sorted assignment list; if a run of ≥3 consecutive calendar days is found,
  // try to move the most flexible slot to break the run.
  // Priority: any-window slots first, then fixed-window slots that have alternative
  // days available within the same window (e.g. Thu-Fri on Thu → move to Fri).
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

    // Early exit: if every day is already used, nothing can move
    if (availableDays.every(d => usedDays.has(d))) break;

    // Try to break the run. Priority order:
    // 1. any-window slots (fully flexible — can go anywhere)
    // 2. fixed-window slots with >1 allowed DOW (can shift within window, e.g. Thu→Fri)
    let moved = false;

    // Build candidate moves: for each slot in the run from position 3 onwards,
    // determine which days are valid for it and not yet used.
    const candidateMoves: Array<{ k: number; idx: number; validDays: string[] }> = [];
    for (let k = runStartI + 2; k <= runEndI; k++) {
      const { idx } = sorted[k];
      const slotTw = (phase1Slots[idx] as any)?.timing_window ?? 'any';
      const gm = (phase1Slots[idx] as any)?.goal_mode ?? 'retain_loyalty';
      const allowedDows = new Set(preferredDowsForWindow(slotTw, gm));

      // Candidates: available days within the slot's window, not already used by another slot
      const isAny = slotTw === 'any';
      const currentDay = sorted[k].date;
      const validDays = availableDays.filter(d => {
        if (d === currentDay) return false; // same day — no change
        if (usedDays.has(d)) return false;  // taken by another slot
        if (!isAny && !allowedDows.has(getDayOfWeek(d))) return false; // outside window
        return true;
      });

      if (validDays.length > 0) candidateMoves.push({ k, idx, validDays });
    }

    // Sort: prefer any-window slots first, then multi-day fixed windows
    candidateMoves.sort((a, b) => {
      const twA = (phase1Slots[a.idx] as any)?.timing_window ?? 'any';
      const twB = (phase1Slots[b.idx] as any)?.timing_window ?? 'any';
      const isAnyA = twA === 'any' ? 0 : 1;
      const isAnyB = twB === 'any' ? 0 : 1;
      if (isAnyA !== isAnyB) return isAnyA - isAnyB;
      return b.validDays.length - a.validDays.length; // more options = more flexibility
    });

    for (const { k, validDays } of candidateMoves) {
      // Pick the valid day that breaks the consecutive run without creating a new one
      const candidateDay = validDays.find(d => {
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
        const { idx } = candidateMoves.find(m => m.k === k)!;
        const slotTw = (phase1Slots[idx] as any)?.timing_window ?? 'any';
        usedDays.delete(sorted[k].date);
        usedDays.add(candidateDay);
        dayByOriginalIndex[idx] = candidateDay;
        moved = true;
        console.log(`[Phase 2a] Consecutive guard: moved slot ${idx} (${slotTw}) from ${sorted[k].date} → ${candidateDay} (broke ≥3-day run)`);
        break;
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
    const slotPreferredDay = dayByOriginalIndex[slotIdx] ?? availableDays[planIdx] ?? availableDays[0];
    
    // STRATEGY-AWARE DAY SELECTION:
    // For footfall slots (A/B): trust AI's strategic day choice — it may cluster
    // Thu-Fri for conversion, which is intentional.
    // For brand/loyalty slots (C/D): enforce early-week placement regardless of
    // what the AI picks. The AI tends to cluster everything on Thu-Fri because
    // the angle names ("torsdag-fredag") bleed into its day choice.
    const aiDay = p.suggested_day;
    const isAiDayValid = aiDay && availableDays.includes(aiDay);
    const slotGoalMode = phase1Slot?.goal_mode ?? 'drive_footfall';

    // Day-of-week ranges that count as "late week" (Thu=4, Fri=5, Sat=6, Sun=0)
    const LATE_WEEK_DOWS = new Set([0, 4, 5, 6]);
    const aiDOW = aiDay ? new Date(aiDay + 'T00:00:00').getDay() : -1;
    const aiIsLateWeek = LATE_WEEK_DOWS.has(aiDOW);

    let finalDay: string;
    const slotTimingWindow = (phase1Slot as any)?.timing_window ?? 'any';
    const slotAllowedDows = slotTimingWindow !== 'any'
      ? new Set(preferredDowsForWindow(slotTimingWindow, slotGoalMode))
      : null; // null = no restriction

    if (!isAiDayValid) {
      // AI gave invalid day → use slot preference
      finalDay = slotPreferredDay;
    } else if (slotGoalMode === 'build_brand' && aiIsLateWeek) {
      // Brand slot must be early week (Mon-Wed) — override AI Thu-Sun choice
      finalDay = slotPreferredDay;
      console.log(`[Phase 2a] Day-spread override: "${p.angle_focus}" build_brand AI chose ${aiDay} (late week) → enforcing slot preference ${slotPreferredDay}`);
    } else if (slotGoalMode === 'retain_loyalty' && LATE_WEEK_DOWS.has(aiDOW) && aiDOW !== 4) {
      // Loyalty slot allows Thu but not Fri/Sat/Sun
      finalDay = slotPreferredDay;
      console.log(`[Phase 2a] Day-spread override: "${p.angle_focus}" retain_loyalty AI chose ${aiDay} (Fri/Sat/Sun) → enforcing slot preference ${slotPreferredDay}`);
    } else if (slotAllowedDows && !slotAllowedDows.has(aiDOW)) {
      // AI's day falls outside Phase 1's timing window for this slot — enforce slot preference.
      // e.g. slot B is "Tue-Wed" but AI chose Thu → use Tue or Wed.
      finalDay = slotPreferredDay;
      console.log(`[Phase 2a] Day-spread override: "${p.angle_focus}" (${slotTimingWindow}) AI chose ${aiDay} (DOW ${aiDOW} outside window) → enforcing slot preference ${slotPreferredDay}`);
    } else {
      finalDay = aiDay;
      if (aiDay !== slotPreferredDay) {
        console.log(`[Phase 2a] AI chose ${aiDay} for "${p.angle_focus}" (slot preference was ${slotPreferredDay}) - trusting strategic clustering`);
      }
    }
    
    // Phase C provides analytics content_type (PRODUCT/EXPERIENCE/OCCASION/RETENTION).
    // It must NEVER override content_category — that controls Phase 2b template routing
    // and is correctly set by Phase 1's slot assignment + Phase 2a's type mapping below.
    const phaseCOverride = categoryOverrides && categoryOverrides[planIdx];

    // Derive content_category from Phase 2a's post type (atmosphere → craving_visual, etc.)
    // This is the template router for Phase 2b. Phase C must not touch this.
    const PHASE2A_TYPE_TO_CATEGORY: Record<string, string> = {
      menu_item:      'product_menu',
      atmosphere:     'craving_visual',
      behind_scenes:  'behind_scenes',
      seasonal:       'craving_visual',
      occasion:       'craving_visual',
    };
    const derivedCategory = PHASE2A_TYPE_TO_CATEGORY[p.type] ?? phase1Slot?.content_category ?? 'product_menu';

    if (phaseCOverride) {
      console.log(`[Phase 2a] Post ${planIdx + 1}: Phase C type → ${phaseCOverride.content_type} (keeps category: ${derivedCategory}) — ${phaseCOverride.type_rationale}`);
    }
    
    return {
      ...p,
      goal_mode:        phase1Slot?.goal_mode        ?? 'drive_footfall',
      content_category: derivedCategory, // Phase 2b template router — from post type, never from Phase C
      content_type:     phaseCOverride?.content_type ?? undefined, // Phase C analytics label (PRODUCT/EXPERIENCE/etc.)
      type_rationale:   phaseCOverride?.type_rationale ?? undefined,
      slot_id:          phase1Slot?.slot_id          ?? 'A',
      timing_window:    (phase1Slot as any)?.timing_window ?? 'any', // forward to phase2b for canonical-time resolution
      suggested_day:    finalDay, // Trust AI's strategic clustering when valid
    };
  });

  // ── CRITICAL: Enforce one post per day ──
  // If duplicate days exist (e.g., due to Gemini returning duplicate angle_focus values),
  // reassign duplicates to other available days to ensure maximum day spread.
  const dayUsageCount = new Map<string, number>();
  enrichedPlan.forEach((p: any) => {
    dayUsageCount.set(p.suggested_day, (dayUsageCount.get(p.suggested_day) || 0) + 1);
  });
  
  const duplicateDays = Array.from(dayUsageCount.entries())
    .filter(([_, count]) => count > 1)
    .map(([day, _]) => day);
  
  if (duplicateDays.length > 0) {
    console.log(`[Phase 2a] ⚠️ Duplicate day assignments detected: ${duplicateDays.join(', ')} - redistributing...`);
    
    const usedDaysSet = new Set<string>();
    const reassigned: Array<{postIdx: number; oldDay: string; newDay: string}> = [];
    
    enrichedPlan.forEach((p: any, idx: number) => {
      if (usedDaysSet.has(p.suggested_day)) {
        // This day is already used - find an alternative
        const alternative = availableDays.find(d => !usedDaysSet.has(d));
        if (alternative) {
          reassigned.push({postIdx: idx, oldDay: p.suggested_day, newDay: alternative});
          p.suggested_day = alternative;
          usedDaysSet.add(alternative);
          console.log(`[Phase 2a]   Post ${idx + 1}: ${p.angle_focus} → moved from ${reassigned[reassigned.length - 1].oldDay} to ${alternative}`);
        } else {
          // No alternative available - keep duplicate (shouldn't happen with proper slot count)
          usedDaysSet.add(p.suggested_day);
          console.warn(`[Phase 2a]   Post ${idx + 1}: No alternative day available, keeping duplicate ${p.suggested_day}`);
        }
      } else {
        usedDaysSet.add(p.suggested_day);
      }
    });
    
    if (reassigned.length > 0) {
      console.log(`[Phase 2a] ✅ Redistributed ${reassigned.length} posts to ensure one post per day`);
    }
  }

  // Sort by calendar date so Phase 2b processes posts in chronological order.
  // This ensures menu dedup and rationale-theme exclusions fire in the right sequence.
  enrichedPlan.sort((a: any, b: any) => a.suggested_day.localeCompare(b.suggested_day));

  console.log(`[Phase 2a] Completed in ${Math.round(performance.now() - t0)}ms - Plan:`, enrichedPlan.map((p: any) => `${p.id}: ${p.type}/${p.content_category} [${p.goal_mode}] (${p.angle_focus}) → ${p.suggested_day}`));

  return enrichedPlan;
}
