# Weekly Plan — New Chat Handoff

## Project Context

| | |
|---|---|
| **Supabase project ref** | `kvqdkohdpvmdylqgujpn` |
| **Test business** | `2037d63c-a138-4247-89c5-5b6b8cef9f3f` (Cafe Faust, Aarhus waterfront) |
| **Python venv** | `/Users/olebaek/Test P2G 1/.venv/bin/python` |
| **Management API token** | `sbp_b81af8a5ab58b868d06e7ae56b78cb3f597ff947` |

---

## Fully Completed Work (Don't Redo)

### 1. `get-weekly-strategy` — 504 Timeout Fix ✅

- Synchronous response replaced with **async fire-and-respond** using `EdgeRuntime.waitUntil()`
- Returns **HTTP 202** + `{ strategy_id, status: 'pending' }` in ~25s; full Gemini pipeline runs in background
- `weekly_strategies.status` constraint: `pending | generated | ideas_selected | posts_created | error`
- Stale-pending detection: auto-restart if `generated_at` > 5 min old
- DB migration applied: `supabase/migrations/20260315000000_add_pending_status_to_weekly_strategies.sql`
- Function deployed to production

### 2. Frontend Polling — Strategy Generation ✅

- `src/pages/dashboard/WeeklyStrategyPage.tsx` — polls `weekly_strategies` by ID every 3s, skips `pending` rows on mount-fetch, loading label switches to `"AI analyserer strategi… (~2–3 min)"` during polling
- `src/app/content/ai-weekly-plan/page.tsx` — same poll-until-generated, times out after 5 min (non-fatal)

### 3. `generate-weekly-plan` — 504 Timeout Fix ✅

**Problem confirmed:** `const plan = await generateWeeklyPlan(input, supabaseClient)` was fully synchronous before response — exact same 504 risk as `get-weekly-strategy`. Layers 6–8 run one Gemini call per post (4 posts minimum).

**Fix implemented:**
- `supabase/functions/generate-weekly-plan/index.ts` — generation+save+strategy-update wrapped in `EdgeRuntime.waitUntil()` IIFE; now returns **HTTP 202** + `{ status: 'generating', strategy_id }` immediately; on error sets `weekly_strategies.status = 'error'`
- `src/hooks/useWeeklyPlanGeneration.ts` — handles both 202 (async) and 200 (sync/legacy):
  - **202 path**: polls `weekly_strategies` for `status = 'posts_created'` every 3s, then loads from `weekly_content_plans` via `.eq('strategy_id', ...)`
  - **Timeout**: 5 minutes; throws immediately if status hits `'error'`

### 4. Brand Profile Generator — Voice & Content Strategy ✅

- `supabase/functions/brand-profile-generator/index.ts` + `brand-profile-generator-v5` deployed
- `voice_rationale` column added to `business_brand_profile`; `what_makes_us_different` field present and populated
- `content_strategy` patched on Cafe Faust:
  - `primary_goal: 'drive_footfall'`
  - `brand_anchors: ['Lækker brunch ved åen', 'delikate 3-retters menuer']`
  - `loyalty_hooks: ['Regelmæssige gæster til brunch', 'aftenstemning ved åen']`
  - `content_category_weights: { team_people: 13, product_menu: 40, behind_scenes: 20, craving_visual: 27 }`
- `signature_phrases` corrected: `['ved åen', 'fra brunch til 3-retters', 'udeservering i Aarhus', 'café-kultur ved åen']`
- `sample_posts` cleared (was dirty — fed as Tier 1 tone signal on regeneration)
- Brand profile regenerated + verified; `tone_of_voice` and `voice_rationale` populated correctly
- `src/pages/dashboard/BrandProfilePageV5.tsx` — voice_rationale display wired in and verified

---

## Architecture — The Full PATH A Flow

```
get-weekly-strategy (Layer 0 ideas)
  → returns HTTP 202 + strategy_id
  → frontend polls weekly_strategies until status = 'generated'
  → WeeklyStrategyPage shows ideas, user selects checkboxes
  → useWeeklyPlanGeneration.generateWeeklyPlan(strategyId, selectedIdeaIds, weekStart)
  → POST to generate-weekly-plan with { strategy_id, selected_idea_ids }
  → returns HTTP 202 + strategy_id
  → frontend polls weekly_strategies until status = 'posts_created'
  → loads completed plan from weekly_content_plans by strategy_id
  → WeeklyPlan displayed with all posts (Layers 6–8)
```

**PATH B** (legacy fallback, still exists):
```
ai-generate-from-strategy (per individual idea, one-by-one)
  → POST to generate-weekly-plan WITHOUT strategy_id
  → returns HTTP 200 sync (legacy path, rarely used)
```

---

## Confirmed Answers

| Question | Answer |
|---|---|
| Does `generate-weekly-plan` consume `strategy_id`? | ✅ YES — fetched + reconstructed, lines 85–148 |
| Are idea-selection checkboxes wired through? | ✅ YES — both validation + generation use `selected_idea_ids`; auto-select-all fallback if null |
| Did `generate-weekly-plan` have a 504 risk? | ✅ YES — now fixed (see §3 above) |

---

## Key Files

| File | Role |
|---|---|
| `supabase/functions/generate-weekly-plan/index.ts` | Edge function — async 202 |
| `src/hooks/useWeeklyPlanGeneration.ts` | Frontend hook — polls for plan completion |
| `supabase/functions/get-weekly-strategy/index.ts` | Edge function — async 202 |
| `supabase/functions/brand-profile-generator/index.ts` | Brand profile generation |
| `supabase/functions/brand-profile-generator-v5/index.ts` | Brand profile v5 variant |
| `src/pages/dashboard/WeeklyStrategyPage.tsx` | Strategy page + idea selection + plan trigger |
| `src/pages/dashboard/BrandProfilePageV5.tsx` | Brand profile display incl. voice_rationale |
| `src/app/content/ai-weekly-plan/page.tsx` | Plan page orchestrator |
| `supabase/functions/_shared/post-helpers/weekly-plan-generator.ts` | `generateWeeklyPlan` + `saveWeeklyPlan` — Layers 6–9 |

---

## Coding Principles — MANDATORY for All Future Work

Before writing a single line of code, read and apply these rules. They exist because several bugs in this codebase were caused by violations of them.

### 1. Understand before touching
- Read the full function / file you are about to edit. Never edit based on a partial grep.
- Trace the data flow end-to-end: where does the value come from, where does it go, what breaks if it is wrong?
- Check what other functions call the thing you are changing.

### 2. One change, one reason
- Each edit must have a single, clearly stated reason.
- If a fix has three parts, make three described changes — not one blob commit with "various fixes".
- Never combine a bug fix with a refactor in the same edit.

### 3. Defensive data access
- Every field read from DB or external JSON must handle `null` / `undefined` gracefully. Use `?.` and `?? fallback` everywhere.
- Array fields: always guard with `Array.isArray(x) && x.length > 0` before iterating or slicing.
- Every `JSON.parse()` must be wrapped in try/catch.

### 4. Async / Edge Function rules (established pattern — don't break it)
- All long-running work must be wrapped in `EdgeRuntime.waitUntil()`. Return HTTP 202 immediately.
- Never `await` an upstream AI call inside the response path.
- Set `status = 'error'` in DB on any unhandled exception inside `waitUntil`.
- Never leave `status = 'pending'` permanently — stale-pending detection is already in place at 5 min.

### 5. Prompt changes require a test run
- Any change to a prompt string must be followed by a `_regen_test_business.py`-style test before deploying to production.
- Check the actual AI output, not just that the function didn't crash.
- Never deploy a prompt-only change without verifying the output quality changed in the intended direction.

### 6. DB migrations before code
- If code reads a new column, the migration (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) must be applied to the live project **before** the function is deployed.
- Use `IF NOT EXISTS` on every `ALTER TABLE` so migrations are safe to re-run.
- Document every migration file in the Key Files table above.

### 7. No silent failures in pipelines
- Every pipeline phase (Phase 0 → 1 → 2b) must catch errors and propagate them to `weekly_strategies.status = 'error'` with a reason string.
- Do not swallow exceptions with empty `catch {}` blocks.
- Log the phase name and input dimensions at the start of each phase — makes debugging timeouts vastly easier.

### 8. Brand profile fields — always check reach
- When adding a new brand profile field to a prompt, verify it is actually passed through every intermediate builder object.
- The known gap: `typical_openings`, `typical_closings`, `communication_goal`, `core_offerings` are fetched but do not reach Phase 2b. Any fix must trace the full path: DB fetch → `brand_voice` object → prompt template.

### 5. 7-Step Quality Improvements + Brand Profile Wiring ✅

All implemented and deployed in one session (March 11, 2026).

**Brand Profile gaps fixed:**
- `brand_essence_elaboration` added to DB SELECT (was fetched but missing from query)
- `communication_goal` wired into brand_voice assembly AND Phase 1 prompt (`🎯 Kommunikationsmål:` line)
- `core_offerings` wired into Phase 1 POST STRATEGI block (`Kernetilbud:` line)
- `typical_openings`, `typical_closings`, `signature_phrases` now reach Phase 2b via `SKRIVEMØNSTER` block (injected in both menu and experience prompt templates)

**Step 1 — Rationale reframe:** Phase 2b Rule 4 rewritten in both prompts. Old: "Forbind: Phase 0-faktor → Phase 1 vinkel → ret". New: "Skriv som marketing-chef der briefer ejeren. HVORFOR er denne post det rigtige valg DENNE dag DENNE uge?"

**Step 2 — Phase 0 business context:** `phase0.ts` prompt now includes `VIRKSOMHED: [business_character]`, `LOKATION: [type], [city]`, `SERVICE-PERIODER: [brunch/lunch/dinner]` — Phase 0 analysis is now business-specific.

**Step 3 — CTA strength framework:** `buildFootfallCta()` in `phase2b.ts` now modulates by `economic.pattern`. `budget_conscious` weeks → medium CTA ("Inviter blidt, ingen salgspres"). All other weeks → hard CTA (unchanged behavior).

**Step 4 — Owner strategic narrative:** Phase 1 `week_summary` instruction changed from "2-3 sætninger med professionel analyse" to "3-4 sætninger der taler direkte til ejeren: (1) Hvad er anderledes? (2) Ét taktisk træk. (3) Hvilken menu-kategori?" `strategy_rationale` in DB now uses `brief.week_summary` (Phase 1 output) instead of the modulator's short rationale. Verified: now produces real owner-facing briefs.

**Step 5 — Slim Phase 1 prompt:** Replaced the 22-line "HVAD ER GOD MARKETING-CHEF KOMMUNIKATION?" + "EKSEMPEL PÅ GOD WEATHER_SEASON NARRATIVE" blocks with a 6-line compact guide. Phase 1 prompt reduced by ~16 lines.

**Step 6 — Slot override logic:** Deferred. Day assignment happens in `phase2a.ts`; propagating slot overrides from Phase 1 through the full pipeline is architectural work requiring changes across 3+ files.

**Step 7 — Signature phrases as vocabulary:** Phase 1 label changed from `→ Signaturfrase:` to `→ Signatur-sprogbrug (caption-ordvalg, ikke strategisk indhold):`. Phase 2b now receives `signaturePhrases` in `SKRIVEMØNSTER` block with explicit instruction: "kun i caption-tekst, IKKE i titel".

**Additional fixes discovered during testing:**
- `strategy_rationale` mapping was wrong (was using modulator's short rationale, not Phase 1 week_summary) → fixed in `index.ts`
- ⛔ Weather adjective ban (`"mildt"`, `"varmt"` etc.) was only in experience prompt Rule 4 → added to menu prompt Rule 4 too
- "Terrassen åbner" safety net: if `outdoorSeatingOk === false` and title starts with "Terrassen", auto-replaced with "Udeservering"

**Test result (week 11, March 2026):**
- `strategy_rationale` = 3-4 sentence owner brief about spring weather, indoor focus, brunch priority ✅
- All 4 rationales owner-facing, no audit-trail phrases ✅
- No "Terrassen åbner" title ✅
- Correct dishes, slots, goal_modes ✅

---

## Remaining / Next Steps

### High priority
1. **Step 6 — Slot override logic**: Allow Phase 1 to output `slot_overrides` (e.g. move Slot A to Tuesday for Valentine's Day). Implementation plan:
   - Add `slot_overrides?: Record<string, { day_of_week: number; reasoning: string }>` to `StrategicBrief` type in `strategy-types.ts`
   - Add optional `slot_overrides` JSON field to Phase 1 prompt schema
   - Pass `brief.slot_overrides` through `index.ts` → `phase2a.ts`
   - In `phase2a.ts`: check `slot_overrides[slot_id]` and override `suggested_day` when present

2. **Expose `strategy_rationale` in UI**: `strategy_rationale` is now populated with a real owner-facing brief (verified). Check if `WeeklyStrategyPage.tsx` displays it prominently. If buried or not shown, surface it as the first thing the owner sees when the weekly plan is ready.

### Medium priority
3. **Performance feedback loop**: Show which posts got best engagement from previous week. Needs FB/IG API read access. When available, pass top posts into Phase 1 prompt as context.

4. **PATH B async**: If `ai-generate-from-strategy` (per-idea path) is still used, apply the same `waitUntil` fix used in `get-weekly-strategy` and `generate-weekly-plan`.

### Low priority / housekeeping
5. **`weekly_content_plans.strategy_id` column**: Confirm column exists in live DB. If not: `ALTER TABLE weekly_content_plans ADD COLUMN IF NOT EXISTS strategy_id UUID REFERENCES weekly_strategies(id);`
