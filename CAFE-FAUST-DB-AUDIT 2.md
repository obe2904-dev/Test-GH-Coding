# Cafe Faust — DB Audit & Non-Menu Content Gap Analysis
_Test case: cafefaust.dk — Business ID: `2037d63c-a138-4247-89c5-5b6b8cef9f3f`_
_Audited: 22 April 2026_

---

## 1. Business Basics

| Field | Value | Notes |
|---|---|---|
| Name | Cafe Faust | |
| Vertical | `cafe` | |
| Language | `da` | |
| Subscription tier | `free` | Text generator uses `gpt-4o-mini`, not `gpt-4o` |
| Brand profile status | `yellow` | Not fully complete |

---

## 2. Operations (`business_operations`)

| Field | Value | Content implication |
|---|---|---|
| `has_outdoor_seating` | `true` | Enters Slot B confirmed facts bank (weather-conditional) |
| `has_table_service` | `true` | Not used in confirmed facts bank |
| `has_takeaway` | `true` | Enters both confirmed facts banks |
| `has_delivery` | `false` | — |
| `has_kids_menu` | `true` | Enters both confirmed facts banks |
| `accepts_walk_ins` | `true` | Not used in confirmed facts bank |
| `reservation_required` | `false` | — |
| `weekly_programme` | **NULL** | No recurring events — confirmed correct for this business |
| `kitchen_close_time` | `21:30` | Bar-gap fact fires on all days (gap ≥ 90 min) |

---

## 3. Opening Hours (`opening_hours` table)

> ⚠️ The `time` column type in PostgreSQL serialises as `HH:MM:SS`. Every confirmed fact derived from these values carries a `:00` seconds suffix (e.g. `"Bar åben til 23:00:00"`). This leaks verbatim into `caption_base` and from there into `ANKER:` in the text generator.

| Day | Opens | Closes | Bar gap after kitchen (21:30) |
|---|---|---|---|
| Monday | 09:30:00 | 23:00:00 | 90 min (edge case — exactly at threshold) |
| Tuesday | 09:30:00 | 23:00:00 | 90 min |
| Wednesday | 09:30:00 | 00:00:00 | 150 min |
| Thursday | 09:30:00 | 01:00:00 | 210 min |
| Friday | 09:30:00 | 02:00:00 | 270 min |
| Saturday | 09:00:00 | 02:00:00 | 270 min |
| Sunday | 09:00:00 | 23:00:00 | 90 min |

**No kitchen-kind rows** exist — only `normal` kind. The kitchen close time comes from `business_operations.kitchen_close_time = "21:30"`.

---

## 4. Brand Profile (`business_brand_profile`)

### 4a. Core identity fields

| Field | Value |
|---|---|
| `brand_essence` | "Café, restaurant og bar ved åen i Aarhus, der serverer brunch og frokost om dagen og skifter til aftensmad og drinks om aftenen." |
| `emotional_promise` | "Fællesskab, brunch, livlighed" |
| `humor_level` | `subtle` |
| `voice_constraints` | "Undgå ord der lyder som de hører hjemme i et reklamefirma — dette sted kommunikerer som en person, ikke en kampagne" |
| `content_exclusions` | "Skriv aldrig om møbler, inventar eller indretning — vis stedet via mennesker og den følelse de tager med hjem. Undtagelse: gælder ikke menu-opslag." |

### 4b. Differentiator and character fields — the Slot B/C anchor pool

| Field | Value | Used by pipeline? |
|---|---|---|
| `what_makes_us_different` | "Cafe Faust ligger direkte ved Aarhus Å med udeservering og bordservice — en kombination af placering og format de fleste caféer i Aarhus ikke kan matche. Menuen spænder fra brunch til 3-retters aftensmenu, så stedet dækker hele dagen fra morgen til midnat." | ✅ Slot C confirmed facts: `"Hvad adskiller dem: [text]"` |
| `business_character` | "Café beliggende ved åen i Aarhus, der tilbyder brunch, frokost og 3-retters aftenmenuer. Menuen inkluderer klassiske caféretter, salater, sandwiches, burgere og et udvalg af cocktails. Der er udendørs siddepladser og takeaway-muligheder. Åbent til kl. 02 i weekenden." | ✅ Both confirmed facts banks: `"Stedet er: [text]"` |
| `brand_context.unique_differentiator` | "Deres evne til at levere en fuldendt spiseoplevelse – fra casual brunch til fine dining – udelukkende i en udendørs setting ved Aarhus Å, komplet med bordservice." | ✅ Slot C confirmed facts: `"Hvad adskiller dem (AI-analyseret): [text]"` |
| `brand_context.local_landmarks` | `["Åboulevarden", "Aarhus Å"]` | ✅ Both banks: `"Beliggenhed: ved Åboulevarden"` |
| `brand_context.origin_story` | **NULL** | ❌ No story available — not on homepage, 3rd party data not used |

### 4c. Structural quality gaps

| Field | Status | Pipeline impact |
|---|---|---|
| `tone_model` | **NULL** | No structured writing rules, no good/avoid examples reach the prompt. Prompt falls back to raw multi-line `tone_of_voice` text with "STEMME-MEKANIK:" headers — less clean than structured input. |
| `tone_keywords` | **NULL** | No tone tags for brand block |
| `sample_posts` | **Empty array `[]`** | No real posts to anchor voice on — Tier 1 voice signal absent |
| `do_not_say` | **NULL** | Relies on `never_say` array instead |
| `weekly_programme` | **NULL** | Correct — no events |

> **Note on `tone_model` NULL:** The brand profile `quality_status` is `yellow` (not `ready`), which explains the NULL. The `tone_of_voice` field is populated with a multi-line narrative including example sentences ("Vi serverer nu.", "Kom forbi til frokost.", "Cocktails klar til aften.") — these feed `typical_openings` but the structured tone model was never generated.

### 4d. `never_say` array (60+ entries)

The entire list is generic platform clichés auto-generated at brand profile creation — none are Faust-specific. Examples: `#foodporn`, `amazing`, `incredible`, `for the gram`, `OMG`, `authentic Danish experience`, `LOL`, `YOLO`. No curated owner-specific banned phrases exist.

### 4e. `content_strategy` (write-once, never overwritten on regen)

| Field | Value |
|---|---|
| `primary_goal` | `drive_footfall` |
| Goal blend | 50% footfall / 30% build_brand / 20% retain_loyalty |
| Content weights | product/menu 37%, craving_visual 25%, behind_scenes 19%, team_people 19% |
| `brand_anchors` | `["Lækker brunch og solid frokost", "delikate 3-retters menuer"]` |
| `footfall_signals` | `["Weekend dinner service", "central location", "ved åen"]` |

**Gap:** `brand_anchors` is food-only. No location or service anchors (outdoor seating, bar, Åboulevarden) appear here, even though those are the primary non-menu content levers.

### 4f. Venue identity fields

| Field | Value | Pipeline use |
|---|---|---|
| `venue_scene` | "Man sidder i blødt dagslys. Varm tone — kølig kontrast. Åben og rummelig." | Blocked for `atmosphere`/`team_people` posts (furniture-tour prevention fix) |
| `venue_energy` | **NULL** | — |
| `recognizable_interior_identity` | "Udendørs siddepladser med parasoller og sorte stole. Indendørs er der træborde og sorte stole, trægulv og glasvægge. Store vinduespartier langs væggen giver udsigt til gaden." | Interior detail — only valid for `behind_scenes` WITH photo; also banned by `content_exclusions` |
| `visual_character` | "Casual moderne café" | Brand block only |
| `signature_phrases` | `["ved åen", "fra brunch til 3-retters", "udeservering i Aarhus", "café-kultur ved åen"]` | Woven in naturally via brand block |
| `identity_keywords` | `["Levende", "Uformel", "Klassikere"]` | Brand block |

---

## 5. Location Intelligence (`business_location_intelligence`)

> ⚠️ The `proximity_anchor` column referenced in the schema documentation does **not** exist in the live DB. The pipeline constructs the `"Beliggenhed: ved [landmark]"` confirmed fact from `landmarks_nearby[0].name` directly.

| Field | Value |
|---|---|
| `area_type` | `waterfront` |
| `neighborhood` | Aarhus |
| `neighborhood_character` | "Ikonisk gade langs Aarhus Å med caféliv, restauranter og aftenliv" |
| `landmarks_nearby` | `[{ name: "Åboulevarden", type: "known_waterfront_street" }]` |
| `location_marketing_hooks` | `["udeservering", "café-kultur", "aftenliv", "turistattraktion", "sociale sammenkomster"]` |
| `has_view` | `false` → no `"Udsigt:"` confirmed fact generated |
| `view_type` | NULL |
| `is_hidden_gem` | `false` |
| `outdoor_space_type` | NULL |
| `nearby_hospitality` | **HIGH** — 16 venues within 300m: 12 restaurants, 2 cafes, 2 bars → fires Slot C competitive fact |
| `matched_motivations` | `["destinationsbesøg", "romantisk_stemning", "belønning_forkælelse", "familieudflug"]` |
| `who_analysis` | Brunch guests + evening diners |

The `location_intelligence` denormalised snapshot on `business_brand_profile` reflects `matched_motivations` and `primary_type: waterfront` but does **not** carry `landmarks_nearby` or `nearby_hospitality` — those are read from `business_location_intelligence` directly at suggestion time.

---

## 6. Menu Data

### 6a. Sources

| Source label | Type | Status | `is_social_lead` |
|---|---|---|---|
| Brunch | url | extracted | false |
| Menukort | url | extracted | false |
| Aftenmenu | url | extracted | false |
| Cocktails | url | extracted | false |
| Menukort | url | extracted | false |
| Middag | url | extracted | false |

No source is marked `is_social_lead = true`. This means no "featured menu" note is injected into the Slot A suggestion prompt.

### 6b. Extraction pipeline

| Table | Status |
|---|---|
| `menu_results_v2` | 6 rows, all `done` — brunch ×3, lunch ×1, dinner ×2 |
| `menu_items_normalized` | **0 rows** — `menu-sync` has not been run |

The `menu_results_v2.structured_data` contains rich, usable dish data with full ingredient descriptions. Example (brunch):

- **DEN ENE** (189 DKK): Skyr med æblekompot og hjemmelavet granola, Spejlæg med purløg og tomat, Brunchpølser fra Højer, Koldrøget laks, Gran Reserva Serrano med rødløg, Gulerodskage med frosting, Hjemmelavet friskbagt brød
- **DEN NYE LUKSURIØSE BRUNCH** (239 DKK, min. 2 pers): Eggs Benedict med pocheret æg og hollandaisesauce, Laksetatar med purløgsmayo, Hjemmelavet vaffel med friske bær og chokolademousse
- **VEGETAR BRUNCH** (179 DKK): Hjemmelavet Romesco, hummus, Pocherede æg, Hjemmelavet Falafel

Despite `menu_items_normalized` being empty, Slot A (menu_item) dish suggestions currently work because `get-quick-suggestions` reads from `menu_results_v2.structured_data` directly.

---

## 7. Confirmed Facts Banks — What the Pipeline Actually Has

This is the complete pool of confirmed facts that Gemini can legally choose from when writing non-menu `concrete_anchor` values.

### Slot B bank (`confirmedFactsSlotB`)

| Fact | Source | Bug? |
|---|---|---|
| `"Åbningstider i dag: 09:30:00–23:00:00"` | `opening_hours` | ⚠️ Seconds suffix |
| `"Bar åben til 23:00:00"` (Mon–Sun, all days) | kitchen_close_time vs close_time | ⚠️ Seconds suffix |
| `"Udeservering tilgængelig"` (weather-conditional) | `has_outdoor_seating` | ✅ |
| `"Takeaway tilgængeligt"` | `has_takeaway` | ✅ |
| `"Børnemenu tilgængelig"` | `has_kids_menu` | ✅ |
| `"Beliggenhed: ved Åboulevarden"` | `landmarks_nearby[0]` | ✅ |
| `"Stedet er: Café beliggende ved åen…"` | `business_character` | ✅ (long) |

**No** weekly events, no calendar event entries (no event today unless contextual_calendar fires), no neighbourhood or view facts.

### Slot C bank (`confirmedFacts`) — adds to Slot B:

| Fact | Source | Bug? |
|---|---|---|
| `"Rum/interiør: Udendørs siddepladser med parasoller…"` | `recognizable_interior_identity` | ⚠️ Explicitly banned by `content_exclusions` |
| `"Hvad adskiller dem: Cafe Faust ligger direkte ved Aarhus Å…"` | `what_makes_us_different` | ✅ |
| `"Hvad adskiller dem (AI-analyseret): Deres evne til…"` | `brand_context.unique_differentiator` | ⚠️ Written in 3rd person ("Deres") |
| `"Historien bag stedet: [text]"` | `brand_context.origin_story` | ❌ NULL — no data |
| `"Kvarter: Aarhus (Ikonisk gade langs Aarhus Å…)"` | `neighborhood` + `neighborhood_character` | ✅ |
| Hospitality density (competitive fact) | `nearby_hospitality` | ✅ (sent separately, not as confirmed fact string) |

---

## 8. Identified Gaps and Issues

### Bug — confirmed, requires code fix

**B1. Time format: `:00` seconds suffix in all time-derived confirmed facts**
Every opening-hours and bar-gap entry carries `:00` (e.g. `"Bar åben til 23:00:00"`). This leaks into `caption_base` and then verbatim into `ANKER:` in the text generator. Affects all 7 days.
_Fix: Strip the `:00` suffix when formatting `time` column values from PostgreSQL._

**B2. Kitchen-close gap threshold edge case**
Mon, Tue, Sun: close = 23:00, kitchen = 21:30 → gap = exactly 90 minutes. The bar-gap confirmed fact fires only when gap `>= 90`. This means the fact does fire, but the threshold is tight. If close time is ever changed to 22:45, Mon/Tue lose the fact silently.
_Low risk for now, but worth documenting._

**B3. `repairSuggestions` Slot C fallback picks `Rum/interiør:` first**
If Gemini produces a weak or mood-only anchor for Slot C, the repair logic picks from `confirmedFacts` by prefix. `"Rum/interiør:"` is in the bank and may be selected before differentiator facts. The result: repaired Slot C suggestion carries furniture inventory as its anchor — directly violating `content_exclusions`.
_Fix: Remove `"Rum/interiør:"` from the repair fallback priority, or skip it entirely when `content_exclusions` contains an interior ban._

**B4. `brand_context.unique_differentiator` is in third person**
Text: "Deres evne til at levere…" (their ability…). This is injected into the confirmed facts bank and then into `ANKER:`. GPT-4o must write in first person (`"Vi"`), but the anchor it receives is third-person framing. Creates a perspective conflict.
_Fix: Either rewrite the differentiator to first person during brand profile generation, or transform it on injection: strip "Deres" → "Vores" / "Vi"._

**B5. Dead code: `VENUE_ANCHOR_PROTAGONIST_HINT` never imported into prompt-builders**
`lang-strings.ts` defines the instruction that ANKER should be the structural load-bearer for non-menu posts (equivalent to the dish name role in menu posts). It is never imported into `prompt-builders.ts` and therefore never reaches GPT-4o.
_Fix: Import and inject for `atmosphere` and `behind_scenes` paths._

**B6. Dead code: `ATMOSPHERE_NO_PHOTO_HINT` never imported**
The richer no-photo hint (explicit ban on inventing furniture, redirect to human activity) is defined in `lang-strings.ts` but not imported. The `buildPathInstruction` function appends only a shorter 1-line note instead.
_Fix: Import and inject for atmosphere path when `!hasPhoto`._

---

### Data gaps — require data entry or structural decisions

**D1. `origin_story` is NULL — no story content available**
Not on cafefaust.dk homepage. 3rd party sources (Google, reviews) are not ingested per product policy. Slot C's "Historien bag stedet" confirmed fact will never fire for this business. This is a real content gap, not a bug.
_Impact: Slot C is structurally weaker — relies on differentiator + location facts only._

**D2. `tone_model` is NULL (brand profile `quality_status = yellow`)**
Structured writing rules, good/avoid example sentences, and formality level do not reach the prompt. The prompt gets only raw `tone_of_voice` text which is less clean for GPT-4o to parse.
_Impact: Brand voice consistency is weaker. Requires a brand profile regeneration that fully completes._

**D3. `sample_posts` is empty**
No real Faust posts exist as Tier 1 voice anchors. The model has no direct examples of what a correct Faust caption looks like.
_Impact: Voice drift risk — the model defaults to category-generic hospitality copy._

**D4. `menu_items_normalized` is empty — `menu-sync` has not run**
6 menus with rich dish data sit in `menu_results_v2.structured_data`. The normalised table (which powers performance tracking, `is_signature` flags, `total_times_posted`, etc.) is empty. Slot A currently works by reading `menu_results_v2` directly, so this is not a live blocker, but the normalised table's metadata features are unavailable.
_Impact: No `is_signature` dish weighting, no post-frequency tracking, no anti-repeat logic based on `last_posted_date`._

**D5. No `menu_source` marked `is_social_lead = true`**
None of the 6 extracted menu sources has been designated as the social lead. This means no special priority or "featured" note is injected into Slot A idea generation.
_Impact: Gemini picks from all available menus without prioritisation signal._

**D6. `weekly_programme` is NULL — confirmed correct**
Cafe Faust has no recurring events (no happy hour, quiz night, DJ etc.). The NULL is accurate. This limits Slot B anchor variety — on days without outdoor seating eligibility, the bank is reduced to opening hours, takeaway, kids menu, and landmark.

---

## 9. Summary: Confirmed Facts Anchor Pool per Slot

This shows what is realistically available on a typical weekday (no calendar event, good weather):

### Slot B (guest_moment / atmosphere) — available anchors
1. Today's opening hours (with seconds bug)
2. Bar open late (with seconds bug)
3. Outdoor seating (only on good-weather days)
4. Takeaway available
5. Kids menu available
6. Located at Åboulevarden
7. Business character (long, generic)

**Total distinct, usable anchors: 4–5** (weather-dependent). Zero event-based variety.

### Slot C (brand_behind / atmosphere) — adds to above:
8. What makes Faust different (first/third person mix issue)
9. AI-analysed differentiator (third person issue)
10. Interior description (banned by content_exclusions → should not be used)
11. Neighbourhood character
12. Origin story: ❌ not available

**Total distinct, usable anchors for Slot C: 6–7** (after excluding interior).

---

## 10. Quick-Reference: What Is Working Well

| Area | Status |
|---|---|
| Waterfront/landmark anchor | ✅ "Cafe Faust ligger direkte ved Aarhus Å" appearing correctly in `caption_base` |
| Outdoor seating anchor | ✅ "Udeservering i dag — PERFEKT vejr" appearing in `caption_base` |
| Interior/furniture blocked from atmosphere posts | ✅ `venue_scene`/`venueIdentity` blocked in prompt-builders |
| `content_exclusions` (no interior) | ✅ In `business_character` and correctly stored |
| `repairSuggestions` mood-anchor detection | ✅ Catches `hyggelig`, `stemning`, `atmosfære`-type mood openers |
| `WHY_CAPTION_RE` filter | ✅ Strips promotional `why_explanation` values |
| `INTERIOR_NOUNS` stripping from STEMNING | ✅ Strips furniture nouns from hook/title before injecting |
| Kitchen close gap → bar-open confirmed fact | ✅ Fires correctly (with seconds bug) |
| Nearby hospitality (competitive framing) | ✅ Injected for Slot C posts |
| `cta_intent` per slot | ✅ Slot B = `social`, Slot C = `engagement` |
