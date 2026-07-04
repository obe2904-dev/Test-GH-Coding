G# Improvement Punch List
_Reference document — updated as items are resolved._

Status legend: `[ ]` open · `[~]` in progress · `[x]` done · `[?]` needs investigation first

---

## 1. `/dashboard/profile`

### Investigate
- `[?]` Is `kitchen_close_time` already in the DB separately from venue close? If yes, it is not surfaced to the user and not used as a CTA anchor in the idea generator.
- `[?]` Does saving opening hours correctly write both `open_time` and `close_time` for every day, including split shifts?

### Improve
- `[x]` Add **kitchen close time** field (separate from venue close) — needed as "bar stays open until X" CTA anchor for atmosphere/BTS posts. **Done:** `kitchen_close_time` field rendered and saved in `BusinessProfilePage.tsx` (line 1749); fetched, stored in `business_operations`, and injected into `confirmedFactsSlotB` by `get-quick-suggestions`.
- `[x]` Add **weekly programme** field (free text or structured): happy hour window, recurring events (quiz night, DJ, live music). This information cannot be scraped from a website. **Done:** `weeklyProgramme` → `weekly_programme` column in `business_operations`; editable in `BusinessProfilePage.tsx` (line 1756) with clear placeholder and AI-usage explanation.
- `[x]` Add **competitive differentiator** field — one sentence the owner writes about why guests choose this place over the next option on the same street. Pre-fill with AI suggestion from `what_makes_us_different` but make it editable and required-to-confirm. **Done:** `ownerDifferentiator` → `what_makes_us_different` fully editable in `BusinessProfilePage.tsx` (line 1462); saved to `business_brand_profile` and injected into confirmed facts.
- `[x]` Make `About Business` (business_character) editable directly here — it is currently AI-suggested only via a button, but the owner may want to just type it themselves. **Done:** `businessCharacter` is a free-text field in `BusinessProfilePage.tsx` with an AI-generate button as an optional shortcut (line 730); owner can edit directly.

---

## 2. `/dashboard/menu`

### Investigate
- `[?]` Are AI-extracted `availability_time` / `availability_days` per menu ever used in the idea generator to pick the right menu for the current service period? Or are they stored but ignored?
- `[?]` What happens when a menu URL returns a 404 or requires JavaScript? Is the user informed clearly or does it silently fail?
- `[?]` Is there any mechanism to detect when the menu changes and prompt re-extraction?

### Improve
- `[x]` Allow the owner to **annotate individual items**: "This is our signature dish" / "We're known for this" / "Seasonal — remove after summer". These are editorial facts the AI cannot infer. **Done (April 2026):** `is_signature` toggle added to each item row in `MenuPage.tsx`. Items with a match in `menu_items_normalized` show a ☆/★ star button; clicking toggles `is_signature` in the DB with optimistic UI. Marked items display bold name + amber "Signaturret" label. `get-weekly-strategy` already reads `is_signature` from `menu_items_normalized` and tags dishes accordingly in the strategy prompt.
- `[x]` Allow the owner to **flag which menu to lead with socially** — e.g. "Our Friday cocktail menu is what we're known for, not the food." **Done (April 2026):** Added `is_social_lead BOOLEAN DEFAULT FALSE` column to `menu_sources` via DB alter. Each extracted menu card now shows a 📢 toggle button; clicking sets that source as the social lead (clears all others first — only one at a time). In `get-quick-suggestions/index.ts`: social lead source queried from `menu_sources`, `menu_results_v2` rows sorted so the flagged source comes first, and a note injected into the `menuBlock` prompt instructing Gemini to prioritise items from that menu for Slot A.
- `[x]` When no menu is detected / extraction fails, the fallback to Slot A should be more graceful — currently falls back to atmosphere which may not suit the business type. **Done (April 2026):** Vertical-aware fallback: bar → `effectiveSlotB` (day's natural social occasion); coffee_shop/bakery → `brunch_moment`; default → `atmosphere`. Both `menuBlock` instruction and `slotExpectedContentTypes[0]` updated in `get-quick-suggestions/index.ts`.
- `[x]` Manual menu text entry — currently exists but buried. Consider making it the primary path for businesses whose menus are on a PDF or POS system not publicly accessible. **Done (April 2026):** Swapped section order in `MenuPage.tsx` — manual text entry (textarea) now appears before the URL link section. Added explanatory subtext: "Indsæt jeres menu som tekst — f.eks. kopieret fra jeres kassesystem, PDF eller eget dokument."

---

## 3. `/dashboard/location`

### Investigate
- `[x]` What data is actually returned by the location analysis edge function — is any of it used in the idea generator or text generator, or is this page entirely decorative? **Answered (April 2026):** `strategy_approach`, `avoid`, `neighborhood`, `area_type`, and `location_marketing_hooks` all feed into `get-weekly-strategy` and `generate-weekly-plan`. The page is not decorative.
- `[x]` Does the location analysis detect proximity to specific landmarks (river, harbourfront, main square) that could inform the "by us at the riverside" CTA? **Answered (April 2026):** Yes — `business_location_intelligence.landmarks_nearby` stores this. It is currently not passed to any AI feature.

### Improve
- `[x]` Inject `business_location_intelligence.landmarks_nearby` into `get-quick-suggestions` as a `confirmedFact` entry — format: `"Beliggenhed: ved [landmark]"` — so it can anchor location-specific Slot B posts. Must be a named fact in the `confirmedFacts` bank, not freeform context prose. **Done (April 2026):** Queries `proximity_anchor` first (pre-computed best landmark); falls back to `landmarks_nearby[0].name`.
- `[x]` The location page should surface **which of its outputs feed the AI** — currently nothing in the UI communicates that `strategy_approach`, `avoid`, and `location_marketing_hooks` are active inputs to the weekly plan. Owners assume the page is display-only. **Done (April 2026):** Added inline info banner below the page title in `LocationIntelligencePage.tsx` — visible when saved or freshly analyzed data exists. Explains that location type, marketing strategy, and strength points feed the daily suggestions and weekly plan.
- `[x]` The "Force Re-analyze" UX is poor — a 7-day cache with no manual refresh path will frustrate owners who move or change their concept. **Done (April 2026):** Changed the green "cache still valid" bar to a neutral info card with a proper secondary button (was a small underlined text link). Added hint: "Re-analysér hvis I har skiftet lokation eller ændret jeres koncept." Framing changed from "you're done" to "here if you need it."

---

## 4. `/dashboard/brand`

### 4a. Photo analysis (`venueScene`, `visual_character`, `recognizable_interior_identity`)

#### Investigate
- `[?]` What photos are typically uploaded? Are they empty-room shots or action/guest shots? The analysis output strongly suggests empty rooms.
- `[?]` What prompt is used for photo analysis? Is it asking for furniture inventory or for guest experience signals?

#### Improve
- `[x]` **Change the photo upload prompt** — currently asks for "fotos af dit sted". Should explicitly request: "Photos showing guests or activity, not just the empty room. These give better results." **Done (April 2026):** Updated in `BrandProfilePageV5.tsx` (inline description) and `da.json` (`uploadHint` key) — now says "Upload helst billeder med gæster eller aktivitet, ikke kun et tomt lokale — det giver markant bedre resultater."
- `[x]` **Change what photo analysis extracts** — current output (venueScene, inventory) is a furniture catalogue. New target: (a) energy/vibe word (1-3 words: "hyggelig, livlig, intim"), (b) guest situation type ("groups around tables", "solo workers", "couples"), (c) `visual_character` confirmation only. **Done (April 2026):** (a) `energy_word` → `venue_energy` was already implemented and injected. (b) `guest_situation_type` added: new DB column `business_brand_profile.guest_situation_type`, Field 5 added to `photo-analyzer.ts` prompt, mapped in `identity-builder.ts`, saved in `analyze-visual-identity/index.ts`, fetched and injected as `Gæstesituation` context in `get-quick-suggestions`. Deployed both functions.
- `[x]` **Stop injecting `venueScene` as content into the text generator** — even with the TON-REGISTER label added in recent fixes, the analytical language bleeds through. Test: remove venueScene from atmosphere posts entirely and measure output quality. **Done (April 2026):** `venueScene` is now fully blocked for `atmosphere` and `team_people` posts via `isAtmospherePost` guard in `buildBrandBlock()`. Still injected for `behind_scenes` as spatial register background only (not as sentence subject).
- `[x]` **Stop injecting `recognizable_interior_identity` as a primary anchor** — the furniture list is only useful as a fallback reference when the idea explicitly requires naming a physical object. Gate tightly. **Done (April 2026):** `venueIdentity` (maps to `recognizable_interior_identity`) is now blocked for `atmosphere`/`team_people`. For `behind_scenes` it remains as primary fact source (the only case where physical space names are useful as action backdrop).
- `[x]` `visual_character` is redundant with `business_character` + `identity_keywords` — investigate whether it adds anything before keeping it in the pipeline. **Done (April 2026):** DB query confirmed `visual_character` is NULL for all real businesses (only populated for a test duplicate via photo analysis). Field kept in DB and prompts (gracefully gated — `? ... : ''`). Removed two redundant separate DB queries: `visual_character` merged into the `venue_scene/venue_energy/guest_situation_type` query in both `get-quick-suggestions/index.ts` and `generate-text-from-idea/resolve-context.ts`, saving one round trip per request in each function.

### 4b. Brand profile generation (BrandProfileGenerator / BrandProfileDisplay)

#### Investigate
- `[?]` What is the actual content of `tone_model.good_examples` for a real business like Café Faust? Open the DB and read it. If these are AI-synthesised in marketing-copy register, the entire voice calibration chain is poisoned.
- `[?]` What source data does the brand profile generator use as input? Is it only `website_analysis_data`, or does it also use the menu, location, and photo outputs?
- `[?]` Is `what_makes_us_different` in the brand profile ever populated with something different from the brand essence? Does the owner ever see or confirm it?

#### Improve
- `[x]` **Make `what_makes_us_different` visible and editable** — currently collapsed under "Baggrundskontekst", AI-written, not editable. This is the single most important missing signal for non-generic social copy. **Done:** Rendered as editable `ownerDifferentiator` textarea in `BusinessProfilePage.tsx` (line 1462); saves to `business_brand_profile.what_makes_us_different`.
- `[x]` **Replace AI-synthesised `good_examples` with a human-approval step** — after generation, show the owner 3 sample posts and ask: "Does this sound like you? Edit or approve." Approved version replaces the AI synthesis. Even one approved example outperforms three AI-written ones. **Done (April 2026):** `sample_posts` section in `BrandProfileDisplay.tsx` (Baggrundskontekst group) now has per-post ✎ Redigér (inline textarea) and ✓ Godkend buttons. Approved posts render with a green border and ✓ checkmark; `why_this_works` hint is hidden once approved. All edits + approvals save back to `business_brand_profile.sample_posts` (`approved: boolean` flag added to `SamplePost` interface).
- `[~]` **Add Instagram / social import option** — analysing the business's own published captions would give real voice evidence: sentence length, fragment structure, emoji usage, register. Far more reliable than AI synthesis from website copy. **Approach revised (April 2026):** A paste-in textarea was implemented and then removed — it violates the "AI does it all" product principle. The correct UX is: owner enters their Instagram handle once → system fetches public posts automatically → AI extracts voice signals → saves silently to `voice_examples.do_say`. Deferred until Instagram public fetch reliability can be validated (Instagram blocks server-side HTML requests; requires headless browser in a worker). In the meantime, the `sample_posts` human-approval flow (human-edited social-format captions) covers the most important part of the same gap.
- `[x]` **Voice archetypes need to be validated** — if the owner selects an archetype, its `writing_rules` and `good_examples` should be checked to ensure they enforce short-form social format (fragments, ≤6-word openers) rather than marketing prose. **Done (April 2026):** Both `WEBSITE_SCHEMA` and `ENRICHED_SCHEMA` in `voice-options-generator.ts` now require at least one `writing_rules` entry to explicitly enforce short-form social format (max 6-word opener, imperative fragments). Deploys with `brand-profile-generator`.
- `[x]` `brand_origin_story` and `brand_essence_elaboration` — **Answered (April 2026):** `brand_essence_elaboration` is confirmed used in `get-weekly-strategy` and `generate-weekly-plan`. `origin_story` (sub-key of `brand_context`) was evaluated for injection this sprint and deliberately excluded — it was never injected into any prompt, so there is nothing to remove. Assessed as noise in weekly strategy context; flagged as a potential future injection for single-post brand-story generation only.

---

## 5. Idea Generator (`get-quick-suggestions`)

_See also: conversation summary for fixes already applied._

### Investigate
- `[?]` What does the `concrete_anchor` field actually contain for Café Faust's most recent Slot B suggestion? This is the key data point — if it still contains "træborde og metalstole" after recent fixes, the upstream generation prompt still needs work.
- `[?]` Is the `why_explanation` for recent Slot B suggestions now producing fact-anchored timing statements (Fix 2) or still cultural scene generalisations?

### Improve
- `[x]` Kitchen-close-to-venue-close gap should be computed and added as a `confirmedFact` with a specific CTA label: `"Bar åben til X — X timer efter køkkenet lukker"`. This is the Friday evening differentiator. **Done (April 2026).**
- `[x]` Weekly programme facts (if added to profile) must flow into the `confirmedFacts` bank as high-priority Slot B anchors. **Done (April 2026).**
- `[x]` Inject `business_location_intelligence.landmarks_nearby` into `confirmedFacts` — format: `"Beliggenhed: ved [landmark]"` — so the idea generator can use it as a legitimate place-specific CTA. See also §3 improve item (same field, same format requirement). **Done (April 2026).**
- `[x]` `content_strategy.anchors` (the 3 "natural social moments") are AI-guessed — they should be human-confirmed or replaced with the owner's direct answer to "what moments bring guests to you?" **Done (April 2026):** Fixed `BrandProfileDisplay.tsx` to read `cs.brand_anchors` (was incorrectly reading `cs.anchors` which is always NULL — all live businesses have their data in `brand_anchors`). Each anchor is now inline-editable (click ✎ → input → OK/Enter). "Bekræft disse øjeblikke" button now saves the edited `brand_anchors` array back to `content_strategy` JSONB and sets `content_strategy_confirmed: true`.

---

## 6. Text Generator (`generate-text-from-idea`)

### Investigate
- `[?]` Re-run a Friday atmosphere post for Café Faust after recent fixes. Evaluate: does the text still open with furniture? Does the ANKER appear in the output? Is the register closer to fragment/social or still marketing prose?
- `[?]` Are `brandGoodExamples` (now capped at 2 for scene posts) actually in fragment/social format or in the same marketing register as venueScene?

### Improve
- `[x]` TEMAVINKEL gate (Fix 3) — **verified (2026-04-20):** Tested live against `generate-text-from-idea` with id=392 (atmosphere, `cta_intent:social`) and id=391 (menu_item, `cta_intent:visit`). Neither output contains `TEMAVINKEL:`. Atmosphere post is correctly themed around guest moment with no menu anchoring. Gate is working. ✅
- `[x]` GoalMode mapping (Fix 4) — **verified (2026-04-20) via `resolve-context.ts` lines 706–718:** Mapping confirmed correct. `atmosphere`/`team_people` → `build_brand` (prevents opening-hours injection). `menu_item` → `drive_footfall`. Non-atmosphere, non-menu with `ctaIntent:'social'` → `drive_footfall` (this is Fix 4). `ctaIntent:'engagement'` → `build_brand`. The soft CTA observed in the menu post output ("Send til din frokost-makker") is a CTA-selection artifact — no `booking_link` for Café Faust causes `select-cta.ts` to fall back to `typicalClosings` regardless of goalMode. GoalMode itself is working. ✅
- `[x]` **Add universal format enforcement rules** to the atmosphere/BTS branch — these are not brand-specific and should not depend on brand profile quality:
  - First line: ≤7 words, must be a noun phrase or statement, no subordinate clause
  - No sentence where the grammatical subject is a room, light source, table, chair, window, or floor
  - Max 3 lines total for Slot B posts
  **Done (April 2026):** Rules 6–8 added to `buildUnifiedPrompt()` in `prompt-builders.ts` as `sceneFormatRules`, gated on `isSceneMoodPost`.
- `[x]` Consider adding a **post-generation format validator** — a simple regex check that flags output longer than 4 lines or containing banned subjects ("lyset", "træbordene", "metalstolene" as sentence subjects) before returning to the client. **Done (April 2026):** `validateSceneFormat()` added to `post-process.ts`; called in `index.ts` after `stripBannedClosers` for atmosphere/behind_scenes/team_people posts. Non-blocking — logs violations to edge function logs for monitoring.

---

## 7. Cross-cutting

- `[x]` **Feedback loop**: when a user edits a generated caption before posting, save the edited version as a `good_example` candidate with a one-tap "save as my voice style?" prompt. This is the fastest path to real voice evidence without additional setup steps. **Done (April 2026):** Added "Gem som stemmeeksempel" checkbox to `CaptionEditModal` footer — visible only when the user has made edits to the generated caption. On save with checkbox ticked, `CreateStep.handleCaptionSave` appends the edited text to `business_brand_profile.voice_examples.do_say` (capped at 10, deduplicated). `do_say` examples are already injected as few-shot voice anchors in `generate-text-from-idea`.
- `[x]` **Thumbs-up on Dagens Forslag**: a thumbed-up idea or generated text should be stored and fed back as a positive signal — currently there is no learning loop at all. **Done (April 2026):** Added `thumbs_up BOOLEAN DEFAULT FALSE` column to `daily_suggestions`. Added 👍 "Godt forslag" button to the bottom bar of every suggestion card in `AiSuggestionsCard.tsx` — optimistic UI toggle, writes `thumbs_up=true` to DB on click. Independent of card selection (tapping to start a post).
- `[x]` **Audit which brand profile fields are actually read** by the idea generator vs the text generator — **Done (April 2026):** Full audit completed in `DATA-USAGE-GAP-ANALYSIS.md` §7. Brand profile table is now fully utilised; all previously unused fields either implemented, assessed and excluded, or dropped.
- `[x]` **Data quality indicator on Brand page** — show the owner which fields are AI-generated vs human-confirmed, and surface a clear call to action for the 2-3 fields that most impact output quality. **Done (April 2026):** Added amber nudge banner in `BrandProfilePageV5.tsx` — shown when profile exists but any of these are missing: `what_makes_us_different` (most impactful — feeds confirmed facts), `content_strategy_confirmed` (confirm 3 social moments), or no photos analyzed. Banner hides automatically when all three are satisfied.
