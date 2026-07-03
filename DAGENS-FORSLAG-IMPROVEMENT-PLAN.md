# Dagens Forslag — Implementation Plan
_Based on full assessment of `get-quick-suggestions/index.ts`, 18 April 2026._

Status: `[ ]` not started · `[~]` in progress · `[x]` done

All work is in `supabase/functions/get-quick-suggestions/index.ts` unless otherwise stated.
No DB migrations are required unless explicitly noted.

---

## Phase 1 — Quick Wins
_Each item is self-contained and can be deployed independently. Low risk._

---

### 1A. Fix weather country code (hardcoded to DK)
**Problem:** OpenWeather API call is `?q=${city},DK`. Norwegian, German, and Swedish businesses always query the wrong country or get a failed fetch, falling back to "Skønt vejr".

**What to do:**
- The function already imports `countryToLangCode` and has `business.country`. Add a `countryToISOAlpha2()` helper (a simple lookup map: `Denmark → DK`, `Norway → NO`, `Sweden → SE`, `Germany → DE`, `UK → GB`) and inject the result into both OpenWeather calls (current + forecast).
- If country is not in the map, fall back to `DK` (existing behaviour is no worse than now).

**Files:** `get-quick-suggestions/index.ts`
**Risk:** None. Purely additive.

---

### 1B. Fetch `has_takeaway` and inject into prompt
**Problem:** `has_takeaway` is stored in `business_operations` and already fetched alongside `has_outdoor_seating` and `has_kids_menu` — but the field is never read and never injected.

**What to do:**
- Add `has_takeaway` to the existing `business_operations` select statement (same query, same row).
- Add a `hasTakeaway` constant.
- In the confirmed facts block: if `hasTakeaway` is true, add `"Tilbyder takeaway"` to `confirmedFactsSlotB` so it becomes a valid Slot B anchor.
- In the main prompt context block: add a line parallel to the existing kids menu line: `"Takeaway: ${hasTakeaway ? 'JA — takeaway-occasion tilladt i Slot B' : 'NEJ — undgå ideer om at hente mad med hjem'}"`.
- Do NOT restructure any slot logic in this phase — just make the flag visible to Gemini.

**Files:** `get-quick-suggestions/index.ts`
**Risk:** None.

---

### 1C. Open `has_takeaway` for Slot B: takeaway-specific occasion framing
**Problem (extension of 1B):** For take-away-first businesses, Slot B's "besøgsscenarie" framing is structurally wrong — it describes a seated in-venue visit. A "bestil og hent om 20 min" angle has no home.

**What to do (builds on 1B):**
- Detect whether takeaway is the primary service model. This is true if `hasTakeaway = true` AND `effectiveVertical === 'cafe'` or `'restaurant'` AND `establishment_type` (already in `business_operations`) contains `'takeaway'` or `'food_truck'`.
- If `isTakeawayPrimary`, add a fourth valid `slotB` scenario type: `'takeaway_moment'`, and add to the SLOT B instruction block: a `takeaway_moment` definition — "Vis takeaway-oplevelsen: pakken der er klar, afhentning, online bestilling der er nem".
- Add `concrete_anchor` guidance for this type: anchor must be a service or logistic fact (e.g., "Bestil online og hent om 20 min", "Klar til afhentning fra kl. X").

**Files:** `get-quick-suggestions/index.ts`
**Risk:** Low. Conditional on `isTakeawayPrimary` flag, does not affect other businesses.

---

### 1D. Write `selected = true` when a suggestion card is tapped
**Problem:** The `daily_suggestions` table has a `selected BOOLEAN` column but it is never written. This is the cheapest possible foundation for a learning loop.

**What to do:**
- In `src/pages/dashboard/CreatePostPage.tsx` (or wherever the suggestion card click handler lives), after the user selects a suggestion, issue a `supabase.from('daily_suggestions').update({ selected: true }).eq('id', suggestionId)` call.
- No other changes now — just capture the signal. The learning loop itself is Phase 4.

**Files:** `src/pages/dashboard/CreatePostPage.tsx`
**Risk:** None. A write to an existing column.

---

### 1E. Remove free-tier opening hours gate
**Problem:** `todayOpenTime` and `todayCloseTime` are only fetched for `isPaidTier`. Free tier businesses receive wrong default posting times (12:00 for menu, 14:00 for everything else) regardless of when they actually open.

**What to do:**
- Move the opening-hours fetch outside the `if (isPaidTier)` guard so it runs for all tiers.
- The BTS activity window (`getBTSActivityWindow`) and time-clamping (`getContentAwareTime`) already use these values when present — they will simply start working for free tier businesses without any other change.
- Retain the `isPaidTier` guard around the more expensive paid-tier brand profile and menu fetches.

**Files:** `get-quick-suggestions/index.ts`
**Risk:** None. The query is a single row from `opening_hours`.

---

## Phase 2 — Contextual Enrichment
_Moderate complexity. Each item requires reading data already available in the DB._

---

### 2A. Inject contextual calendar events into the prompt
**Problem:** `contextual_calendar` (holidays, school vacations, seasonal events) exists and is fully populated. It is already used in `get-weekly-strategy` with a working query. `get-quick-suggestions` ignores it entirely — Gemini has no awareness of Påske, vinterferie, Grundlovsdag, or the julefrokost season.

**What to do:**
- Port the calendar query from `get-weekly-strategy`: fetch events where `date_start <= today + 7 AND (date_end IS NULL OR date_end >= today)` and country matches the business's country.
- Select `event_name`, `event_type`, `content_angle`, `marketing_hook`, `relevance_tags`.
- Limit to 3 events maximum (nearest first).
- Add a `──── KALENDERBEGIVENHED ────` block to the prompt (only when events exist):
  - List each event's name and marketing hook.
  - If an event's `relevance_tags` include `'families'` and `hasKidsMenu = false`, suppress that event.
  - If an event's tags include `'outdoor'` and outdoor conditions are not suitable, suppress that event.
- The event becomes a high-priority candidate for Slot B `concrete_anchor` — add it to `confirmedFactsSlotB` with the format `"Kommende event: ${event_name} — ${marketing_hook}"`.

**Files:** `get-quick-suggestions/index.ts`
**DB:** No migration needed — table exists and is populated.
**Risk:** Low. Additive context block. If no events found, prompt is unchanged.

---

### 2B. Inject cuisine type from `menu_results_v2`
**Problem:** `analyze-menu-metadata` already extracts and stores `cuisine_style` (Italian, Thai, Nordic, etc.) in `menu_results_v2`. This is never read by the suggestion engine. A Thai restaurant and a French bistro receive identical prompt framing.

**What to do:**
- Add `cuisine_style` to the existing `menu_results_v2` select (already fetched for paid tier).
- Collect the first non-null, non-"Nordic"/"Danish" cuisine style found across the menu rows.
- If a specific cuisine style is detected (e.g., "Italian", "Thai", "Japanese"):
  - Add a `KØKKENTYPE` context line to the prompt: `"Køkkentype: ${cuisineStyle} — tilpas Slot A titel-framing og foto-instruktioner til dette køkken"`.
  - Add a cuisine-specific photo guidance hint to the `media_suggestion.primary` instruction: e.g., for Italian "Brug overhead 45° for pastaretter og pizzaer — kontrasterende farver i ingredienser"; for Thai "Overhead eller lavt perspektiv for farverige retter — krydderier og friske urter synlige i rammen".
  - Add cuisine-specific occasion vocabulary to the Slot B default: e.g., Italian → "Antipasto-øjeblik, familieselskab, Sunday dinner"; Thai → "Del-retter til bordet, lunch-bowl".

**Files:** `get-quick-suggestions/index.ts`
**Risk:** Medium. Requires a curated map of 8–12 cuisine types → framing hints. Build the map inline as a const object.

---

### 2C. Fix service period overriding day-of-week defaults
**Problem:** `deriveServicePeriod()` correctly detects brunch/lunch/dinner from opening hours, but it only produces a text hint (`servicePeriodHint`) and a menu-selection guide. It does NOT override `getDayBehavior()`'s slot defaults. A brunch-only café (closes 14:00) receives `slotBDefault: 'afterwork_moment'` every Thursday and Friday.

**What to do:**
- After `getDayBehavior()` and `deriveServicePeriod()` are both resolved, add an override step:
  - If `activeServicePeriod === 'brunch'`: override `slotBDefault` to `'brunch_moment'` and `slotCDefault` to `'atmosphere'` unconditionally (they will never have an afterwork to show).
  - If `activeServicePeriod === 'lunch'`: override `slotBDefault` to `'lunch_moment'` unless the day is Friday/Thursday (in which case `'lunch_moment'` is still valid, just less social).
  - If `activeServicePeriod === 'dinner'` AND day is Monday–Wednesday: keep defaults but ensure `slotB` does not generate a brunch scenario.
- Pass the overridden values through the existing `slotB` / `slotC` variables so the 3-slot structure block picks them up.

**Files:** `get-quick-suggestions/index.ts`
**Risk:** Low. Narrow conditional logic, no external dependencies.

---

### 2D. Inject `cuisine_style` for free tier (from `menu_signal`)
**Problem (extension of 2B):** Free tier businesses do not get `menu_results_v2`. But `menu_signal` (in `business_profile`) contains the `menu_signal.cuisineStyle` or at minimum `signatureItems` from which a cuisine can sometimes be inferred.

**What to do:**
- When `isPaidTier` is false and `menu_signal` is fetched: read `menu_signal.cuisineStyle` if present.
- Apply the same cuisine framing hint as 2B, but skip photo-specific guidance (keep free tier simple).

**Files:** `get-quick-suggestions/index.ts`
**Risk:** None beyond 2B.

---

## Phase 3 — Hybrid Business Support
_The highest-impact improvement. Most complex. Build in two sub-phases._

---

### 3A. Time-of-day vertical resolution
**Problem:** `detectEffectiveVertical()` returns one value, hardcoded in priority order (bar > bakery > coffee_shop > else). A café-restaurant-bar open 09:30–02:00 returns `'bar'` if "bar" appears anywhere, making all Slot A dish choices into cocktails and all BTS vocabulary into bar language from morning onwards.

**What to do:**
- Create `detectHybridVerticals(vertical, businessCharacter, identityKeywords): string[]` — a multi-return version that collects ALL matched verticals (not just the first one) using the same regex logic as `detectEffectiveVertical()`.
- Add a `resolveActiveVertical(hybrids: string[], nowHour: number, openTime: string | null, closeTime: string | null): string` function:
  - If only one vertical detected: return it (existing behaviour, no change).
  - If `bar` + `cafe` or `restaurant` detected (the core hybrid case):
    - Hours 06:00–14:00 → return `'cafe'` (morning service window).
    - Hours 14:00–17:00 → return the non-bar type (restaurant/cafe, transition period).
    - Hours 17:00–close → return `'bar'` (evening service window).
  - If `coffee_shop` + `bar` (coffee and wine bar):
    - Hours 06:00–14:00 → return `'coffee_shop'`.
    - Hours 14:00+ → return `'bar'`.
  - If `bakery` + anything: return `'bakery'` for hours within 2h of open, otherwise the other type.
- Replace the `effectiveVertical` single call with `resolveActiveVertical(hybrids, new Date().getHours(), todayOpenTime, todayCloseTime)`.
- The rest of the function (BTS vocabulary, Slot A product rule, `isBarVertical` etc.) already reads from `effectiveVertical` — no further changes needed there.

**Files:** `get-quick-suggestions/index.ts`, `_shared/business-type-helpers.ts`
**Risk:** Medium. Test with: pure café, pure bar, pure bakery (all should behave exactly as now), hybrid café-bar morning, hybrid café-bar evening, coffee-wine bar.

---

### 3B. Multi-service-phase awareness in the 3-slot structure
**Problem (extension of 3A):** Even with the correct vertical resolved per hour, a full-day hybrid still produces three slots all anchored to the same service phase. The Slot B occasion and Slot C BTS context should represent the phase the business is currently IN — but the 3-slot structure offers no way to communicate about the OTHER phases in the same day.

**What to do:**
- When multiple verticals are detected AND they represent genuinely different service phases (morning coffee + evening bar):
  - Add a `──── DRIFTSFORMER I DAG ────` context block listing all phases with times: e.g., "Morgen: kaffebar 09:30–14:00 · Aften: vinbar/cocktailbar 17:00–02:00".
  - Instruct Gemini that the three slots may represent different phases if relevant: "Hvis det passer til tidspunktet, må Slot A gerne repræsentere aftenens drikke-tilbud selv om det er formiddag — annoncér hvad der venter".
  - Set `slotBDefault` to the phase currently active (already handled by 3A), but give Gemini permission to frame Slot C as the upcoming phase transition (e.g., "klar til aftenservice om X timer").

**Files:** `get-quick-suggestions/index.ts`
**Risk:** Low once 3A is done. This is prompt text only.

---

## Phase 4 — Data Quality Fixes
_These require either UI changes or changes to upstream analysis prompts, not just the suggestion engine._

---

### 4A. Activate `never-say-config/builder.ts` in the suggestion prompt
**Problem:** The entire `never-say-config/` infrastructure (universal, Danish, business-type-specific forbidden words) exists but is never called from `get-quick-suggestions`. Vocabulary quality relies entirely on Gemini's inference.

**What to do:**
- Import `buildNeverSayList` from `_shared/never-say-config/builder.ts`.
- Map `effectiveVertical` to a `BusinessContext.businessType` enum value:
  - `cafe`, `restaurant` → `'FSE'`
  - `bar`, `coffee_shop` → `'SBO'`
  - `bakery` → `'FSE'` (closest match)
  - `food_truck` → `'MFV'`
- Determine `priceLevel` from brand profile if available (check `brand_essence` or `identity_keywords` for "fine dining", "budget" signals) — otherwise omit.
- Call `buildNeverSayList()` and inject as a compact `ALDRIG BRUG DISSE ORD` block near the bottom of the prompt (after the register block).
- Cap the list at 25 words to avoid bloating the prompt (the builder currently returns 40–60; slice to the most relevant).

**Files:** `get-quick-suggestions/index.ts`
**Risk:** Low. Additive constraint block.

---

### 4B. `content_strategy.anchors` — owner confirmation UI
**Problem:** The three "natural social moments" are the most powerful idea-selection signal in the paid tier, but they are AI-guessed and never shown to the owner. An incorrect anchor biases all suggestions permanently.

**What to do:**
- Add a UI section to `/dashboard/brand` (or a dedicated `/dashboard/content-strategy` page): "Hvad er de 3 situationer, der naturligt tiltrækker gæster til jer?" — one editable text field per anchor, pre-filled with the AI-generated value.
- Add a `content_strategy_confirmed: boolean` flag to `business_brand_profile`.
- In the suggestion prompt: if `content_strategy_confirmed` is true, label the anchors as `BEKRÆFTEDE ØJEBLIKKE`; if false, label as `AI-FORESLÅEDE ØJEBLIKKE (ikke bekræftet af ejer)` — same data, different authority signal to Gemini.
- Add a nudge on the dashboard if `content_strategy_confirmed` is false: "Bekræft dine indholdspillar for bedre daglige forslag."

**Files:** `src/pages/dashboard/BrandPage.tsx` (UI), `get-quick-suggestions/index.ts` (label), `supabase/migrations/` (new boolean column)
**DB migration needed:** `ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS content_strategy_confirmed BOOLEAN DEFAULT FALSE`.
**Risk:** Medium. UI work is non-trivial. Start with just the column + label change — the UI confirmation screen is a separate ticket.

---

### 4C. Photo analysis: extract guest signals, not furniture
**Problem:** `venueScene` and `recognizable_interior_identity` currently contain furniture inventories from photo analysis ("lyse træborde, metalstole, vinduer mod gaden"). These are injected into atmosphere post ideas. The IMPROVEMENT-PUNCHLIST already flags this as a structural issue.

**What to do (in `analyze-photo` or `brand-profile-generator`):**
- Change the photo analysis prompt to ask for three outputs instead of one:
  1. `energy_word` — 1–3 words describing the energy/vibe seen (e.g., "hyggelig, livlig", "intim, stille", "travl, urban"). NOT furniture.
  2. `guest_situation_type` — what guests are doing in the photo if visible, or what the space invites (e.g., "par ved bord", "grupper", "solo-arbejde", "stående ved baren"). Default to "ikke synlig" if empty room.
  3. `visual_character` — keep as-is (concept label for tone register).
- Store `energy_word` in a new column `venue_energy` (or reuse `venue_scene`'s column with different content after migration).
- In `get-quick-suggestions`: replace the current `venueSceneText` injection (which is analytical furniture description) with `venueEnergyText` — a 1–3 word energy descriptor. This gives Gemini a tone cue without providing inventory to fabricate titles from.

**Files:** `supabase/functions/analyze-photo/` (prompt change), `get-quick-suggestions/index.ts` (field read change)
**DB migration needed:** `ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS venue_energy TEXT`.
**Risk:** High impact on output quality but requires reanalysis of existing photos. Gate behind a re-analysis trigger. Old `venue_scene` data should remain available as fallback until new column is populated.

---

### 4D. Kitchen close time in confirmed facts (existing punchlist item)
**Problem:** No distinction between venue close time and kitchen close time. The "bar open after kitchen closes" CTA (the Friday evening differentiator) cannot be generated because the gap is not in the data.

**What to do:**
- Add `kitchen_close_time` field to the profile page UI (`/dashboard/profile`) alongside venue close time.
- Store in `business_operations` (new column) or `opening_hours` (new kind: `'kitchen'`).
- In `get-quick-suggestions`: if `kitchenCloseTime` and `todayCloseTime` differ by ≥90 minutes, add to `confirmedFactsSlotB`: `"Bar åben til ${todayCloseTime} — ${gap} timer efter køkkenet lukker kl. ${kitchenCloseTime}"`.

**Files:** `src/pages/dashboard/BusinessProfilePage.tsx` (UI), `get-quick-suggestions/index.ts`, `supabase/migrations/`
**DB migration needed:** `ALTER TABLE business_operations ADD COLUMN IF NOT EXISTS kitchen_close_time TEXT`.
**Risk:** Low engineering risk. Medium UI effort.

---

## Phase 5 — Learning Loop
_Lowest urgency. Build on top of Phase 1D (selected flag)._

---

### 5A. Use `selected` signal to bias future slot-type choices
**Problem:** There is currently no feedback mechanism. An idea that was selected and posted three times in a month has the same weight as one that was always dismissed.

**What to do:**
- After Phase 1D is live (writing `selected = true`), add a query to fetch selection rates per `content_type` and `slot` for the last 30 days:
  ```
  SELECT content_type, slot, COUNT(*) AS total, SUM(CASE WHEN selected THEN 1 ELSE 0 END) AS picks
  FROM daily_suggestions WHERE business_id = ? AND created_at > NOW() - INTERVAL '30 days'
  GROUP BY content_type, slot
  ```
- Compute a simple score: `pick_rate = picks / total`. If a slot type has `pick_rate > 0.6`, inject a positive signal into the prompt: "Ejer har valgt ${content_type} ideer oftere end gennemsnittet — prioritér denne type".
- If a slot type has `pick_rate < 0.2` over ≥6 impressions, inject a mild avoid signal: "Ejer har sjældent valgt ${content_type} ideer — varier med andre tilgange".
- Do NOT automatically suppress any slot type — this should be a soft bias, not a hard rule.

**Files:** `get-quick-suggestions/index.ts`
**Risk:** Low. Read-only query on existing data. Soft signal injection.

---

### 5B. Track edit distance as a quality signal
**Problem:** Even a selected idea may have been heavily edited before posting, meaning the idea quality was poor even if it was ultimately used. The current `selected` boolean captures nothing about this.

**What to do:**
- This requires the text generator to store the original generated caption alongside the final published caption (already partially done via `post_drafts`).
- Compute edit distance (or word-change ratio) between the initial AI caption and the published caption.
- Store as `edit_score FLOAT` (0 = no edits, 1 = completely rewritten) in `daily_suggestions` or `post_drafts`.
- Use in the learning loop (Phase 5A): a selected-but-heavily-edited idea is a weaker positive signal than a selected-and-lightly-edited one.

**Files:** `src/pages/dashboard/CreatePostPage.tsx` (on publish), `supabase/migrations/` (column)
**Risk:** Low. Deferred — purely additive. Build only after 5A is running.

---

## Implementation Order (Recommended)

```
Week 1 (deploy as a single batch — all low risk):
  1A — Weather country code fix
  1B — Fetch has_takeaway
  1E — Remove free-tier opening hours gate

Week 2 (deploy together — all additive prompt changes):
  1C — Take-away Slot B framing
  2C — Service period override for day defaults
  2A — Contextual calendar injection
  4A — Activate never-say-config

Week 3 (requires 1B and 2B to be done):
  2B — Cuisine type awareness (paid tier)
  2D — Cuisine type awareness (free tier, limited)
  1D — Write `selected = true` on card tap

Week 4–5 (moderate complexity):
  3A — Time-of-day vertical resolution (hybrid businesses)
  3B — Multi-phase prompt block (builds on 3A)

Week 6–7 (requires UI work):
  4B — content_strategy.anchors confirmation UI
  4D — Kitchen close time field + confirmed fact

Week 8+ (requires upstream prompt changes):
  4C — Photo analysis: energy words instead of furniture inventory

Ongoing after Week 3:
  5A — Learning loop (selection signal)
  5B — Edit distance signal
```

---

## Decision Log

| Decision | Rationale |
|---|---|
| Do NOT add a 4th slot for hybrid businesses | Three slots is the right UX constraint. The solution is to make the 3 slots represent the active service phase correctly, not to add more cards. |
| Keep `detectEffectiveVertical()` for non-hybrid cases | The existing single-return function is correct for 80% of businesses. Only extend it — do not replace it. |
| Do NOT inject `venueScene` raw into atmosphere posts | Even with the register guard, analytical furniture language bleeds through. Replace with `venue_energy` (1-3 words) when available. |
| Keep the 3-slot order (offering → guest_moment → brand_behind) | This order works. Do not change it for hybrid businesses — change the CONTENT of the slots based on active phase. |
| Calendar injection: suppress irrelevant events | An event tagged `'families'` for a business without a children's menu adds noise, not value. Active suppression is required. |
| `content_strategy.anchors` label change comes before UI | The label change ("AI-foreslåede" vs "bekræftede") costs nothing and immediately makes Gemini treat unconfirmed anchors with less authority. Do this first. |
| Never-say list: cap at 25 words | The builder returns 40–60 items. Half are city-name exclusions that waste prompt tokens. Slice to the most category-relevant words. |
