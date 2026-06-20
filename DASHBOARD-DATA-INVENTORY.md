# Dashboard Data Inventory
## All information collected across the 4 setup pages — with AI usage and punch list

**Legend**
| Symbol | Meaning |
|--------|---------|
| ✅ | Used by **Dagens Forslag** (daily idea generator) |
| 🗺️ | Used by **Weekly Strategy** only |
| 💬 | Used by **Caption / Text Generator** only |
| ❌ | Collected and saved — **not used by any AI feature** |
| ⚠️ | Has a known problem or gap |

---

## Page 1 — `/dashboard/profile`
**BusinessProfilePage.tsx**  
Core business identity, contact details, opening hours, and service model.

---

### A. Business Identity

| Field shown in UI | DB table · column | AI use |
|---|---|---|
| Website URL | `businesses.website_url` | ❌ Only used as trigger for auto-fill; not in prompts |
| Business Name | `businesses.name` | ❌ Not injected into suggestion prompts |
| Business Sector (hospitality / beauty / wellness / retail) | `businesses.vertical` (mapped) | ❌ Grouping only |
| Business Category / Vertical (e.g. restaurant, café, bar) | `businesses.vertical` | ✅ Core signal — determines slot types, day behavior, and vocabulary register |
| Tagline (short description) | `business_profile.short_description` | ❌ Not read by Dagens Forslag |
| About text (long description) | `business_profile.long_description` | ❌ Not read by Dagens Forslag |
| Logo | `businesses.logo_url` | ❌ |
| Booking link | `business_brand_profile.booking_link` | ❌ |

---

### B. Contact

| Field shown in UI | DB table · column | AI use |
|---|---|---|
| Phone | `business_locations.phone` | ❌ |
| Email | `business_locations.email` | ❌ |
| Address line 1 | `business_locations.address_line1` | ❌ (fed into Location page as geocoding input) |
| Postal code | `business_locations.postal_code` | ❌ |
| City | `business_locations.city` | ❌ |
| Country | `business_locations.country` | ⚠️ Saved to DB but **weather API is hardcoded to `DK`** — country is never actually used |

---

### C. Opening Hours

| Field shown in UI | DB table · column | AI use |
|---|---|---|
| Mon–Sun open time | `opening_hours.weekday + open_time` | ⚠️ Used by Dagens Forslag — but **only for paid-tier users**. Free tier always falls back to global time defaults regardless of what is entered here. |
| Mon–Sun close time | `opening_hours.weekday + close_time` | ⚠️ Same gate as above |

> There is no `kitchen_close_time` field anywhere in the system. A restaurant that stops serving food at 21:00 but stays open for drinks until 01:00 cannot express this, so Dagens Forslag may suggest food posts during the drinks-only window.

---

### D. Service Model

| Field shown in UI | DB table · column | AI use |
|---|---|---|
| Table service | `business_operations.has_table_service` | ❌ Not read by Dagens Forslag |
| Takeaway | `business_operations.has_takeaway` | ⚠️ Saved but **never read** by Dagens Forslag — a takeaway-only business still receives seated dine-in framing |
| Delivery | `business_operations.has_delivery` | ❌ |
| Outdoor seating | `business_operations.has_outdoor_seating` | ❌ |
| WiFi | `business_operations.has_wifi` | ❌ |
| Power outlets | `business_operations.has_power_outlets` | ❌ |
| Parking | `business_operations.has_parking` | ❌ |
| Reservation required | `business_operations.reservation_required` | ❌ |
| Kids menu | `business_operations.has_kids_menu` | ❌ |

---

### E. AI-Inferred Fields (displayed on Profile page, generated elsewhere)

| Field shown in UI | DB table · column | AI use |
|---|---|---|
| Business character (AI-generated text, editable) | `business_brand_profile.business_character` | ✅ Injected into Dagens Forslag prompt as a business descriptor |
| Menu highlights (read-only list, max 10 items) | `business_profile.menu_signal.signatureItems` or `menuCategories` | ✅ Displayed for reference; these items come from website analysis, not the full Menu page extraction — can fall out of sync |

---

## Page 2 — `/dashboard/menu`
**MenuPage.tsx**  
Manages menu sources, triggers AI extraction, displays structured content, computes pricing.

---

### A. Menu Sources

| Field shown in UI | DB table · column | AI use |
|---|---|---|
| Menu URL (auto-detected or manually added) | `menu_sources.source_url` | ✅ Indirectly — triggers extraction pipeline that feeds `menu_results_v2` |
| Menu type (standard / special) | `menu_sources.menu_type` | ❌ Not read by Dagens Forslag |
| Menu label (e.g. "Frokostmenu") | `menu_sources.label` | ❌ |
| Manual text paste | Processed into `menu_results_v2` via edge function | ✅ Indirectly |

---

### B. Extracted Menu Data (`menu_results_v2.structured_data`)

| Field | DB location | AI use |
|---|---|---|
| Category names | `structured_data.categories[n].name` | ✅ Read by Dagens Forslag when querying for signature menu items |
| Item names | `structured_data.categories[n].items[n].name` | ✅ Primary source for Slot A (offering/menu item ideas) |
| Item descriptions | `structured_data.categories[n].items[n].description` | ⚠️ Extracted but not specifically surfaced in the suggestion prompt; could add rich context |
| Item prices | `structured_data.categories[n].items[n].price` | ❌ Not read by Dagens Forslag |
| Menu title | `structured_data.menuTitle` | ❌ |
| Availability time | `structured_data.availabilityTime` | ❌ Not read — lunch menus with noon-only availability are ignored |
| Availability days | `structured_data.availabilityDays` | ❌ Not read |
| Menu periods | `structured_data.menuPeriods[]` | ❌ Not read — time-bounded sections (e.g. 11:30–15:00) are ignored |
| AI summary | `menu_results_v2.ai_summary` | ❌ Generated per menu, never read by Dagens Forslag |
| Cuisine style | Inferred during extraction | ⚠️ Detected (e.g. Italian, Thai, Nordic) but **not stored in a discrete column** — Dagens Forslag has zero cuisine awareness |

---

### C. Pricing (auto-calculated from extracted items + manual override)

| Field shown in UI | DB table · column | AI use |
|---|---|---|
| Price level (budget / moderate / upscale / luxury) | `business_operations.price_level` | ❌ Not read by Dagens Forslag |
| Average check per person (DKK) | `business_operations.average_check_per_person` | ❌ Not read |
| Currency | `business_operations.currency` (always DKK) | ❌ |
| Kids menu (auto-detected from item names) | `business_operations.has_kids_menu` | ❌ |

---

## Page 3 — `/dashboard/location`
**LocationIntelligencePage.tsx**  
Geocodes the business address, classifies it into area types, and analyses concept fit per area type.

---

### A. Input

| Field shown in UI | Source | AI use |
|---|---|---|
| Address (read-only, from Profile) | `business_locations.address_line1 + city` | Geocoding input only — not in prompts |

---

### B. Location Intelligence Output (stored in `business_location_intelligence`)

| Field | DB column | AI use |
|---|---|---|
| Primary area type (e.g. city_centre, tourist, residential) | `.area_type` | 🗺️ Weekly Strategy only — **not used by Dagens Forslag** |
| All area type scores (%) | `.category_scores` (JSONB) | 🗺️ Weekly Strategy only |
| Client-side location type matches | `.location_type_matches` (JSONB) | 🗺️ Weekly Strategy only |
| Coordinates (lat/lng) | `.latitude + .longitude` | ❌ Not used by Dagens Forslag |
| Neighborhood name | `.neighborhood` | 🗺️ Weekly Strategy only |
| Neighborhood character (text) | `.neighborhood_character` | 🗺️ Weekly Strategy only |
| Nearby landmarks | `.landmarks_nearby` (JSONB array) | 🗺️ Weekly Strategy only |
| Location marketing hooks | `.location_marketing_hooks` (array) | 🗺️ Weekly Strategy only |
| Last analyzed timestamp | `.last_updated_by_ai` | 7-day cache gate — not an AI input |

---

### C. Concept Fit Analysis (per area type, stored in `.concept_fit_by_category`)

| Field | DB location | AI use |
|---|---|---|
| Fit level (strong / moderate / challenging) | `[area_type].fit_level` | 🗺️ Weekly Strategy only |
| Strategy positioning one-liner | `[area_type].ui_summary.one_liner` | 🗺️ Weekly Strategy only |
| Best marketing angle | `[area_type].ui_summary.best_marketing_angle` | 🗺️ Weekly Strategy only |
| Fit reasons | `[area_type].fit_reasons[]` | 🗺️ Weekly Strategy only |
| Content emphasis | `[area_type].marketing_implications.content_emphasis[]` | 🗺️ Weekly Strategy only |
| Watchouts | `[area_type].watchouts[]` | 🗺️ Weekly Strategy only |

> **Summary:** All output from this page is used exclusively by the weekly strategy engine. The daily idea generator (`get-quick-suggestions`) never reads from `business_location_intelligence`. The richest contextual layer in the system is completely invisible to the feature users interact with every day.

---

## Page 4 — `/dashboard/brand`
**BrandProfilePageV5.tsx** (routes to `brand-v5` internally; `BrandPage.tsx` also writes to same table)  
AI-generated brand profile with visual identity input, and a simpler voice/style editor.

---

### A. Photos & Visual Identity

| Field shown in UI | DB table · column | AI use |
|---|---|---|
| Interior photos (upload) | `storage: visual-identity/{businessId}/` | ✅ Triggers AI photo analysis that populates the 3 fields below |
| Scenebeskrivelse / `venue_scene` | `business_brand_profile.venue_scene` | ✅ Dagens Forslag — injected into atmosphere and behind-the-scenes prompts (Slot B/C) |
| Konceptkarakter / `visual_character` | `business_brand_profile.visual_character` | ✅ Dagens Forslag — tone register calibration label for all atmosphere posts |
| Fysisk inventar / `recognizable_interior_identity` | `business_brand_profile.recognizable_interior_identity` | ⚠️ Used in BTS prompts as a factual anchor — but the AI description is **furniture and object inventory**, not guest moments or craft activities |

---

### B. AI-Generated Brand Profile (`business_brand_profile`)

Generated by an Edge Function from website analysis and owner text. Displayed as read-only; regeneration is manual.

| Field | DB column | AI use |
|---|---|---|
| Brand essence (one-liner) | `brand_essence` | ❌ Not read by Dagens Forslag |
| Brand essence elaboration | `brand_essence_elaboration` | ❌ |
| Tone of voice (rules text) | `tone_of_voice` | 💬 Caption generator |
| Tone model (structured JSONB) | `tone_model` | 💬 Caption generator |
| Content hooks / focus areas | `content_focus` | ❌ Not read by Dagens Forslag |
| Content strategy (with anchors array) | `content_strategy` | ⚠️ Dagens Forslag reads `content_strategy.anchors` as the **highest-priority idea filter** for Slot A — but it is AI-generated and **never confirmed by the owner** |
| Target audience | `target_audience` | ❌ Not read by Dagens Forslag |
| Competitive positioning / communication goal | `communication_goal` | ❌ |
| Identity keywords | `identity_keywords` | ✅ Passed to `detectEffectiveVertical()` to help classify hybrid businesses |
| Voice archetype | `voice_archetype` | ❌ |
| Voice options (JSONB) | `voice_options` | ❌ |
| Emotional promise | `emotional_promise` | ❌ |
| Content exclusions | `content_exclusions` | ❌ |
| Voice confidence score | `voice_confidence_score` | ❌ |
| Signature phrases | `signature_phrases` | 💬 Caption generator |
| Never-say list (AI-generated) | `never_say` | ⚠️ Exists in DB — but `buildNeverSayList()` is **never called** by `get-quick-suggestions` |
| Typical openings | `typical_openings` | 💬 Caption generator |
| Typical closings | `typical_closings` | 💬 Caption generator |
| Sample posts | `sample_posts` | 💬 Caption generator |
| Brand origin story | `brand_origin_story` | ❌ |
| What makes us different | `what_makes_us_different` | ❌ |
| Humor level | `humor_level` | 💬 Caption generator |
| Formality | `formality` | 💬 Caption generator |
| Storytelling style | `storytelling_style` | 💬 Caption generator |
| Emoji style | `emoji_style` | 💬 Caption generator |
| Banned words / things to avoid | `things_to_avoid` | ❌ Not read by Dagens Forslag |

---

### C. Voice & Style Editor (BrandPage.tsx — also writes to `business_brand_profile`)

Simpler form for owner-curated brand style. Paid tier only — free users see an upgrade prompt.

| Field shown in UI | DB column | AI use |
|---|---|---|
| Voice style (casual / professional / friendly / energetic) | `voice_style` | ❌ Not read by Dagens Forslag |
| Tone keywords (free-text tags) | `tone_keywords` | ❌ Not read by Dagens Forslag |
| Brand values (free-text tags) | `values` | ❌ Not read by Dagens Forslag |
| Emoji usage (none / minimal / moderate / frequent) | `emoji_usage` | ❌ Not read by Dagens Forslag |
| Formality level (1–5 slider) | `formality_level` | ❌ Not read by Dagens Forslag |
| Do not say (user-entered phrases) | `do_not_say` | ❌ Not read by Dagens Forslag |

> **Three disconnected "never say" systems** live in this page:  
> 1. `do_not_say` — user-entered in the Voice editor (BrandPage.tsx)  
> 2. `never_say` — AI-generated in the Brand Profile (BrandProfilePageV5)  
> 3. File-based `buildNeverSayList()` — universal + country + business-type rules in `_shared/never-say-config/`  
> None of the three are currently fed into `get-quick-suggestions`.

---

## Punch List

Issues identified across the 4 pages, grouped by priority.

---

### Critical — directly hurts idea quality

**#1 `has_takeaway` not read by Dagens Forslag**  
The field is collected, saved to `business_operations`, but never queried in `get-quick-suggestions`. A takeaway-only business (QSR, food truck, delivery kitchen) receives seated dine-in Slot framing for all 3 ideas every day. Fix: fetch `has_takeaway` and switch to the QSR slot model when true.

**#2 `content_strategy.anchors` is unconfirmed**  
The AI generates `content_strategy.anchors` during brand profile generation and Dagens Forslag uses them as the highest-priority Slot A filter — without the owner ever seeing or approving them. An Italian restaurant could be anchored to "seasonal cocktails" because the AI misread the website. Fix: add a confirmation step or UI element, and a `content_strategy_confirmed` boolean; treat unconfirmed anchors as a soft hint, not a hard filter.

**#3 Country code hardcoded to `DK` in weather API call**  
`business_locations.country` is saved but ignored. Any business outside Denmark gets Danish weather. One-line fix: pass the stored country code to the OpenWeather call.

**#4 Opening hours gated to paid tier**  
Free users' hours are stored in `opening_hours` but `get-quick-suggestions` never reads them unless the business is on a paid plan. A free-tier morning bakery opening at 07:00 receives the same default time framing as a late-night bar. Fix: remove the tier gate on reading opening hours; it's a data lookup, not a premium capability.

**#5 All location intelligence is invisible to Dagens Forslag**  
`business_location_intelligence` — area type, neighborhood character, marketing hooks — is never queried by `get-quick-suggestions`. A beachfront café on a tourist strip and a suburban office café receive identical ideas. Fix: inject area type and top marketing hook into the suggestion prompt context.

---

### High — missing context that AI needs

**#6 No kitchen close time**  
Opening hours capture when the venue closes, not when the kitchen stops serving. No field exists for `kitchen_close_time`. Dagens Forslag may suggest food ideas after the kitchen is closed. Add a `kitchen_close_time` column to `opening_hours` and surface it in the Profile page UI.

**#7 Menu special menus not time-aware**  
`availabilityTime`, `availabilityDays`, and `menuPeriods[]` are extracted from menus but never read. A Friday lunch menu should only generate Slot A ideas on Fridays during the lunch window. Fix: read these fields in the suggestion engine and apply them as temporal filters.

**#8 Cuisine style has no dedicated field**  
Italian, Thai, Nordic, and burger restaurants all get identical generic framing. Cuisine type is probably detectable from menu item names during extraction but is never stored as a queryable field (e.g., `menu_results_v2.cuisine_style` or `businesses.cuisine_type`). Fix: extract and store cuisine style during menu processing; inject it into the suggestion prompt.

**#9 Three "never say" systems — all inactive in Dagens Forslag**  
`do_not_say` (user-entered), `never_say` (AI-generated), and the file-based `buildNeverSayList()` are all completely disconnected from `get-quick-suggestions`. Fix: consolidate into one resolved list and inject it into the prompt. The file-based system already has the right architecture; it just needs to be called.

**#10 `voice_style`, `tone_keywords`, and `values` are ignored**  
These are the most explicitly owner-curated fields in the system — the owner chose them deliberately. Yet Dagens Forslag never reads any of them. Fix: at minimum, inject `tone_keywords` and `values` into the prompt as style constraints.

---

### Medium — data quality and UX improvements

**#11 `recognizable_interior_identity` generates furniture catalogs, not atmosphere**  
The AI description of interior photos becomes an object inventory ("three wooden tables, exposed brick, industrial pendant lights"). This makes behind-the-scenes Slot C ideas read like IKEA captions. Relabel this field to capture **memorable guest moments and craft activities** instead of furniture. The `venue_scene` field already handles the physical description better.

**#12 Tagline and About text not used by Dagens Forslag**  
`short_description` and `long_description` are owner-written and richer than the AI-inferred `business_character` — but both are ignored. Fix: inject the tagline as a secondary business descriptor when `business_character` is absent or short.

**#13 No "featured item" flag on menu items**  
All extracted menu items are treated equally. There is no way to mark a signature dish or a seasonal special as a priority for idea generation. Fix: add a simple boolean `is_featured` flag to `menu_results_v2.structured_data.categories[n].items[n]`, with an edit UI in MenuPage.

**#14 Price level disconnected from idea framing**  
`business_operations.price_level` is displayed and editable on the Menu page but Dagens Forslag ignores it entirely. A Michelin-level restaurant and a budget canteen receive the same tone. Fix: inject price level into the prompt as a register signal.

**#15 `do_not_say` and `never_say` are two separate fields on the same page**  
Owners entering forbidden phrases in the Voice editor (`do_not_say`) are not told that the AI also generates a `never_say` list — and that neither list currently does anything in the idea generator. This erodes trust. Fix: merge into one visible, editable list and make it active.

**#16 Business Name not in suggestion prompt**  
`businesses.name` is never injected. The AI cannot reference the business by name in its idea text or know whether the business has a distinctive or unusual name worth referencing.

---

### Low — UX and polish

**#17 Country hardcoded to `DK` in Location page reconstruction**  
`reconstructedAnalysis` in LocationIntelligencePage.tsx hardcodes `country: 'DK'` and `locale: 'da-DK'` regardless of the business's actual country.

**#18 Menu highlights on Profile page can be stale**  
The 10-item menu highlight list on the Profile page pulls from `menu_signal.signatureItems` (website analysis), not from the full extracted menu in `menu_results_v2`. If the owner adds menus later in the Menu page, the Profile view stays out of date. Consider syncing or removing this preview.

**#19 Website analysis auto-fills opening hours only if the form is empty**  
If the owner has already entered hours manually, a re-analysis of the website will never update them — even if the website has changed. Add a "replace with website hours" option.

**#20 Brand profile is entirely locked behind paid tier**  
Free users cannot access the brand page at all. However, `business_character` (which IS used by Dagens Forslag) is generated separately during website analysis and stored in `business_brand_profile`. This creates an invisible partial dependency: free users get ideas shaped by a character description they have never seen or can edit.

**#21 `BrandPage.tsx` (Voice editor) and `BrandProfilePageV5.tsx` both write to `business_brand_profile`**  
Both pages share the same table and some field names overlap. There is a risk of one page's save overwriting another page's fields silently (e.g., an auto-save in the Voice editor could zero out JSONB fields set by the brand profile generator). Consider explicit field-level `upsert` guards.

**#22 Location page 7-day re-analysis gate hides the refresh option**  
When analysis is recent, the primary CTA button disappears and is replaced by a small "force re-analyze" text link. Users who update their address on the Profile page may not discover they can re-trigger. Make the refresh option more visible.

---

## Summary: What Dagens Forslag Actually Reads

For reference — the complete list of fields currently injected into `get-quick-suggestions`:

| Field | Source |
|---|---|
| `businesses.vertical` | Business vertical / category |
| `business_brand_profile.business_character` | AI-inferred descriptor (editable) |
| `business_brand_profile.identity_keywords` | For hybrid vertical detection only |
| `business_brand_profile.content_strategy.anchors` | AI-generated, unconfirmed priority filter |
| `business_brand_profile.venue_scene` | AI photo analysis — atmosphere/BTS prompts |
| `business_brand_profile.visual_character` | Tone calibration label |
| `business_brand_profile.recognizable_interior_identity` | BTS anchor (furniture inventory) |
| `opening_hours` (paid tier only) | Service period detection |
| `menu_results_v2.structured_data` | Menu items for Slot A |
| OpenWeather API (hardcoded to DK) | Live weather — wind, temp, condition |
| Current time + day of week | Day behavior and slot type selection |

Everything else shown across the 4 dashboard pages is either unused, or used only by the weekly strategy or caption generator.
