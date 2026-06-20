# AI Weekly Plan Flow Overview

Generated: 5. maj 2026  
Scope: Dashboard route /dashboard/ai-weekly-plan with focus on get-weekly-strategy as foundation for generate-weekly-plan.

---

## 1) Route and Main Components

- Route registration: src/App.tsx
- Route path: ai-weekly-plan
- Page component: src/app/content/ai-weekly-plan/page.tsx

This page is a two-phase orchestration:

1. Phase A: call get-weekly-strategy and wait until strategy is generated.
2. Phase B: call generate-weekly-plan with strategy_id, then wait until posts are created and plan is persisted.

---

## 2) Key Element A: get-weekly-strategy (Foundation)

## Purpose

Build the strategic layer for the selected week:

- Strategic brief
- Narrative
- Priorities
- Structured post ideas
- Full week context snapshot for downstream reuse

## Runtime Contract

Input (from frontend):

- business_id
- week_start
- regenerate
- owner_note

Primary output:

- strategy_id
- status (pending or generated)
- generated strategy payload when cached/ready

Status lifecycle in weekly_strategies:

- pending -> generated
- error possible on failure

## Data Assembly Before AI

get-weekly-strategy composes WeekContext from multiple sources:

- businesses
- business_locations
- business_location_intelligence
- business_operations
- opening_hours
- business_brand_profile
- business_profile
- menu_results_v2
- menu_items_normalized (flag enrichment)
- contextual_calendar
- weather API/fallback
- weekly_content_plans history
- weekly_strategies history
- generated_posts history

## Prompt and Model Pipeline

Orchestrator:

- _shared/post-helpers/weekly-strategy-generator.ts

Phases:

1. Phase 0 contextual analysis
   - Prompt builder: strategy/phase0.ts
   - AI call via callAI
2. Phase 1 strategic brief
   - Prompt builder: strategy/phase1.ts
   - AI call via callAI
3. Phase 2 tactical plan + narrative
   - Unified tactical prompt: strategy/phase2/phase2ab-unified.ts
   - Narrative prompt: strategy/phase2/phase2c.ts
   - Phase 2c uses callGeminiWithRetry

Post-processing and validation are applied before save.

## Persistence

Final strategy row is saved in weekly_strategies with:

- strategic_brief
- strategic_brief_raw
- narrative
- strategic_priorities
- post_ideas
- week_context_snapshot
- target_post_count
- status = generated

---

## 3) Key Element B: generate-weekly-plan (Execution)

## Purpose

Convert strategy output into executable weekly plan records and per-day suggestions.

## Runtime Contract

Input:

- weekStart
- strategy_id (required)
- selected_idea_ids (optional)
- regenerate

Critical rule:

- Legacy no-strategy path is removed. strategy_id is mandatory.

## Data Consumption Strategy

Step 1: load strategy row by strategy_id (ownership checked).

Step 2: prefer week_context_snapshot from strategy for fast path reconstruction of:

- brand profile context
- location context
- operations context
- menu context
- opening-hours context

This snapshot path skips multiple live DB re-queries.

## Plan Generation Behavior

- Builds normalized input for weekly-plan generator.
- Runs feasibility checks when enabled.
- Runs generateWeeklyPlan in background.
- Saves final plan via saveWeeklyPlan.
- Updates weekly_strategies status to posts_created with executed selected_idea_ids.

## Persistence Targets

- weekly_content_plans (final weekly plan blob and metadata)
- daily_suggestions (individual operational suggestions)
- weekly_strategies (status and selected_idea_ids)

---

## 4) Frontend Orchestration Flow

From src/app/content/ai-weekly-plan/page.tsx:

1. Resolve business_id.
2. Call get-weekly-strategy.
3. If pending, poll weekly_strategies until generated.
4. Guard: do not continue without valid strategy_id.
5. Call generate-weekly-plan with strategy_id.
6. If async response, poll:
   - primary: weekly_strategies status = posts_created
   - fallback: weekly_content_plans by strategy_id
7. Hydrate UI from saved weekly_content_plans row.

---

## 5) Information Handoff: What Moves from A to B

From get-weekly-strategy to generate-weekly-plan:

- strategy_id (hard dependency)
- narrative
- strategic_priorities
- strategic_brief
- post_ideas
- week_context_snapshot (major optimization + consistency anchor)

From generate-weekly-plan to storage/UI:

- weekly_content_plans row linked by strategy_id
- daily_suggestions rows for actionable daily execution
- weekly_strategies status transition to posts_created

---

## 6) Prompt Inventory (Where Prompts Live)

Weekly strategy prompts:

- strategy/phase0.ts (buildPhase0Prompt)
- strategy/phase1.ts (buildPhase1Prompt)
- strategy/phase2/phase2ab-unified.ts (unified tactical post planning prompt)
- strategy/phase2/phase2c.ts (narrative compression/reformulation prompt)

Infrastructure and retry utilities:

- strategy/infrastructure.ts (Gemini retry wrapper + spelling correction)

Important distinction:

- generate-weekly-plan does not run a second large strategic planning prompt pipeline.
- It executes and persists strategy-derived plan structure; final long-form post text is generated later in downstream create-post flow.

---

## 7) Data Points Most Critical for Output Quality

Highest leverage context inputs inside get-weekly-strategy:

- business_brand_profile voice and strategy fields
- menu signals (structured menu + normalized item flags)
- opening-hours constraints
- contextual calendar events with commercial weighting
- weather interpretation and season context
- previous-week and multi-week history signals
- owner_note (when provided)

Highest leverage handoff artifact:

- week_context_snapshot in weekly_strategies

This snapshot is the continuity layer that keeps generate-weekly-plan aligned with the exact strategy context used at generation time.

---

## 8) One-Line Architecture Summary

The AI Weekly Plan page is a strict two-step pipeline where get-weekly-strategy creates a context-rich strategic source of truth, and generate-weekly-plan executes that strategy into persisted plan artifacts using strategy_id plus week_context_snapshot as the primary handoff contract.

---

## 9) Prompt Risk Matrix and Improvement Suggestions

This section assesses weekly strategy prompting quality against the implementation analysis and proposes non-code improvements.

### Prompt Risk Matrix

| Priority | Risk | Where It Shows Up | Likely Impact | Confidence |
|---|---|---|---|---|
| 1 (High) | Runtime/schema drift in prompt input fields | get-weekly-strategy selects post_length_guidelines from business_brand_profile | If missing in live schema, brand profile fetch can degrade or fail, reducing voice precision and increasing generic output | High |
| 2 (Medium-High) | Prompt density and instruction collisions in Phase 1 | phase1 prompt contains many mandatory blocks (booking-critical, quiet-week, weather constraints, anti-repetition, slot mix) | Model can satisfy one rule by violating another, causing brittle or inconsistent briefs in edge weeks | High |
| 3 (Medium) | Cross-model narrative drift | Phase 0/1/2ab use GPT-family calls while Phase 2c narrative uses Gemini | Tactical plan and narrative can diverge in wording, emphasis, or certainty framing | Medium |
| 4 (Medium) | Mixed business identity signals | business_type derived from category while other logic uses archetype/interpreted mode | Inconsistent framing in strategy text (identity ambiguity) | Medium |
| 5 (Low-Medium) | Over-anchoring to historical anti-repetition constraints | heavy history context and anti-repeat directives in Phase 1 | Potentially suppresses valid repeat winners when current-week conditions are similar | Medium |

### What Is Already Strong

1. Strong context-first design before AI calls (weather, events, history, operating constraints, brand voice).
2. Clear two-phase orchestration with strict strategy_id dependency.
3. week_context_snapshot handoff provides continuity and replayable context.
4. Deterministic interpretation layers reduce reliance on raw model inference.

### Improvement Suggestions (No Code, Process and Prompt Design)

1. Add a prompt governance checklist before deploy.
Include one owner-reviewed checklist that verifies:
- all selected prompt input fields exist in live schema,
- each mandatory rule has a single owner and priority,
- conflicts are documented with tie-break precedence.

2. Introduce explicit instruction precedence in prompt text.
Use a single short hierarchy at top of Phase 1, for example:
1) safety and factual constraints,
2) hard business constraints,
3) week-specific commercial events,
4) stylistic/variety preferences.
This reduces rule collisions without changing architecture.

3. Split Phase 1 prompt into stable core vs dynamic context blocks.
Keep a fixed compact core and move volatile contextual directives (booking windows, quiet-week mode, repetition controls) into clearly labeled optional blocks with strict trigger conditions.
Expected benefit: lower token noise and more stable behavior week-to-week.

4. Align model responsibilities in evaluation criteria.
If multiple model families are retained, define acceptance checks that specifically validate cross-step consistency:
- Phase 2c narrative must reference the same primary angle/theme as Phase 2ab,
- no contradiction in timing rationale,
- no contradiction in commercial priority framing.

5. Add a weekly "prompt quality scorecard" for operations.
Track a small set of review metrics for generated strategies:
- strategic coherence,
- rule compliance,
- uniqueness vs previous week,
- business-voice fit,
- event relevance.
Use this as an operational feedback loop rather than ad hoc debugging.

6. Add a documented fallback policy for missing brand inputs.
Define what to do when brand profile fields are absent or partial:
- minimum viable voice profile,
- conservative tone defaults,
- explicit uncertainty wording.
This prevents silent quality degradation.

7. Reduce duplicate phrasing pressure by clarifying "must include" vs "prefer".
In prompt wording and review criteria, classify constraints as:
- MUST (hard constraints),
- SHOULD (quality targets),
- MAY (nice-to-have variation).
This improves model compliance on critical business outcomes.

### Recommended Next Review Cadence

1. Weekly: spot-check 5 generated strategies with the scorecard.
2. Bi-weekly: review top 3 prompt failure patterns and update wording priorities.
3. Monthly: validate prompt inputs against live schema and remove stale fields.

### Bottom-Line Assessment

Architecture quality is high, but prompt-system complexity is now the main risk surface. The best next step is not adding more rules, but clarifying rule priority, reducing collision points, and formalizing operational prompt QA.

---

## 10) In-Depth Resolution Plan (No Code)

This plan addresses the three core issues identified:

1. Sales and footfall intent is not consistently enforced at idea level.
2. Brand Profile Post Strategi is present but not reliably translated into weekly idea weighting.
3. get-weekly-strategy orchestration is too large and difficult to evolve safely.

The goal is to improve commercial outcomes and generation quality without introducing implementation-level details here.

## Plan Overview

### Phase Structure

- Phase A: Commercial Objective Governance (Issue 1)
- Phase B: Strategy-to-Idea Weighting Governance (Issue 2)
- Phase C: Function Complexity Reduction Program (Issue 3)
- Phase D: Validation, Rollout, and Operating Rhythm (cross-cutting)

Each phase contains:

- Objective
- Scope
- Deliverables
- Decision framework
- Success metrics
- Risks and mitigations
- Timeline recommendation

---

## Phase A: Commercial Objective Governance (Issue 1)

### Objective

Guarantee that weekly output is commercially actionable, with footfall and sales as the primary purpose and reservation conversion elevated when relevant triggers are present.

### Scope

- Weekly strategy framing quality
- Idea-level CTA and conversion intent quality
- Trigger-based booking priority behavior

### Deliverables

1. Weekly Commercial Mode taxonomy:
   - Booking Push Week
   - Footfall Push Week
   - Balanced Week

2. Trigger policy table (business + calendar + timing):
   - Reservation capability present
   - Event-driven triggers (for example Valentines, Mother’s Day)
   - Temporal triggers (first Friday/Saturday, payday proximity)
   - Demand-shape triggers (high commercial-weight events)

3. Commercial acceptance criteria for generated weekly strategy:
   - One explicit weekly conversion objective sentence
   - Minimum conversion-oriented idea presence when mode is Booking Push
   - Explicit reason when commercial priority is intentionally reduced

4. Weekly reviewer checklist for commercial compliance:
   - Does this week tell guests what action to take now?
   - Is booking CTA used when reservation opportunity is high?
   - Is timing aligned to decision windows?

### Decision Framework

Use a deterministic hierarchy in business review:

1. Hard constraints: factual and operational validity
2. Commercial constraints: footfall and booking conversion
3. Strategic support: brand and loyalty reinforcement
4. Stylistic quality: variation and polish

If conflict occurs, higher-level priority wins and lower-level instruction must adapt.

### Success Metrics

Primary:

- Share of Booking Push weeks with at least one clear booking-driving idea
- Share of weeks with explicit conversion objective statement
- Footfall-oriented idea ratio in Footfall Push weeks

Secondary:

- Reviewer-rated commercial clarity score
- Fewer “nice content but weak conversion” review comments

### Risks and Mitigations

- Risk: Over-commercial tone hurts brand quality.
  Mitigation: Keep brand and loyalty quotas as minimum floor, not zero.

- Risk: Too many booking CTAs in non-booking weeks.
  Mitigation: Trigger table must gate Booking Push mode.

### Timeline Recommendation

- Week 1: Define taxonomy, trigger table, acceptance criteria.
- Week 2: Run side-by-side review on recent strategies.
- Week 3: Operationalize checklist and baseline metrics.

---

## Phase B: Strategy-to-Idea Weighting Governance (Issue 2)

### Objective

Ensure Brand Profile Post Strategi is translated into measurable weekly idea composition, not just treated as narrative context.

### Scope

- Alignment between Post Strategi priorities and selected ideas
- Weekly adaptation based on context without losing strategic identity

### Deliverables

1. Post Strategi Interpretation Guide:
   - Primary objective definition (for example Tiltrækning)
   - Secondary objective definition
   - Loyalty floor definition
   - Week-sensitive override conditions

2. Weekly Allocation Sheet template:
   - Target objective mix for the week
   - Required rationale for any deviation
   - Expected category spread tied to business profile and week context

3. Alignment scoring rubric:
   - Strategic fit score (objective alignment)
   - Temporal fit score (day/time logic)
   - Commercial fit score (actionability)
   - Business identity fit score (voice and concept)

4. Drift monitor:
   - Track gap between intended objective mix and actual generated idea mix
   - Flag recurring mismatch patterns

### Decision Framework

When weekly context conflicts with baseline strategy:

1. Keep primary objective unless hard context evidence says otherwise.
2. If changed, require explicit reason linked to this week’s signals.
3. Preserve loyalty/brand minimum coverage to prevent mono-mode output.

### Success Metrics

Primary:

- Objective alignment rate (actual vs intended mix)
- Primary objective dominance rate in weeks where it is configured as primary

Secondary:

- Reviewer confidence in “this looks like this business”
- Reduction in “generic strategy” feedback

### Risks and Mitigations

- Risk: Overfitting to fixed strategy and ignoring real week context.
  Mitigation: Explicit override protocol with evidence requirement.

- Risk: Too rigid quotas reduce creative quality.
  Mitigation: Keep ranges, not exact counts, except in high-priority commercial weeks.

### Timeline Recommendation

- Week 1: Define interpretation guide + scoring rubric.
- Week 2: Evaluate last 8 weeks of outputs with rubric.
- Week 3: Introduce drift reporting in weekly operations review.

---

## Phase C: Function Complexity Reduction Program (Issue 3)

### Objective

Reduce orchestration risk and improve change safety by separating responsibilities at the process and governance level.

### Scope

- End-to-end get-weekly-strategy workflow responsibilities
- Operational ownership and review boundaries
- Testing and release gating discipline

### Deliverables

1. Responsibility Map (single source of truth):
   - Request/auth boundary
   - Data retrieval boundary
   - Context enrichment boundary
   - Strategy generation boundary
   - Persistence/status boundary
   - Observability boundary

2. Change Impact Matrix:
   - Which responsibility areas are affected by each proposed change
   - Required reviewers by area
   - Required test evidence by area

3. Release gate policy for strategy changes:
   - No release without passing baseline quality checks
   - Mandatory regression comparison on representative business profiles

4. Incident playbook for strategy regressions:
   - Detect
   - Triage
   - Contain
   - Rollback decision path
   - Postmortem template

### Decision Framework

Adopt a governance rule:

- Changes must be evaluated by responsibility area, not by file size.
- High-risk areas (context assembly, strategy output contract, status lifecycle) require stricter gate.

### Success Metrics

Primary:

- Reduction in regression incidents per release
- Faster root-cause identification in failed weeks
- Lower review cycle time for isolated changes

Secondary:

- Team confidence score in making strategy changes
- Fewer emergency hotfixes

### Risks and Mitigations

- Risk: Program seen as process overhead.
  Mitigation: Keep templates lightweight and tie directly to release outcomes.

- Risk: Partial adoption creates inconsistent quality.
  Mitigation: Require minimum mandatory checklist for every strategy-related release.

### Timeline Recommendation

- Week 1: Responsibility Map + Change Impact Matrix drafted.
- Week 2: Pilot on one strategy improvement cycle.
- Week 3-4: Full adoption for strategy/plan pipeline releases.

---

## Phase D: Validation, Rollout, and Operating Rhythm

### Objective

Institutionalize a feedback loop so improvements are sustained, measurable, and reversible if quality drops.

### Rollout Plan

1. Baseline period (2 weeks)
   - Capture current performance against new rubrics without changing behavior.

2. Controlled activation (2-3 weeks)
   - Apply Phase A and B governance rules on a subset of businesses/weeks.

3. Full activation
   - Expand once commercial clarity and alignment metrics are stable.

### Weekly Operating Ritual

1. Monday: Strategy quality review (sample set)
2. Mid-week: Issue triage and pattern capture
3. Friday: Metrics snapshot and decision log updates

### Monthly Review

1. Commercial outcome trends
2. Alignment drift trends
3. Top failure modes and corrective actions
4. Prompt governance updates (priority conflicts, stale rules)

---

## Priority Roadmap (Recommended Order)

1. First fix commercial objective enforcement (Phase A).
2. Then enforce Post Strategi to idea weighting alignment (Phase B).
3. In parallel, start complexity governance and release discipline (Phase C).
4. Lock in validation rhythm so gains persist (Phase D).

Rationale:

- Phase A and B directly affect business outcomes fastest.
- Phase C reduces future risk and accelerates safe iteration.
- Phase D prevents drift back to previous quality issues.

---

## Final Outcome Definition

The plan is successful when:

1. Weekly strategies consistently produce commercially actionable ideas.
2. Post Strategi priorities are visible and measurable in final idea mix.
3. Strategy pipeline changes become safer, faster, and less regression-prone.
4. Quality is managed through a repeatable operating system, not ad hoc tuning.
