# Phase 1 Prompt Anatomy

> Reference: `supabase/functions/_shared/post-helpers/strategy/phase1.ts` → `buildPhase1Prompt()`

---

## 1. System / Instruction Opening

```
Du er marketing-chef for [business_name]. Du briefer ejeren om ugens sociale medie-strategi.

OPGAVE:
Den strategiske retning for ugen er FORBEREGNET og fremgår nedenfor
(week_mode, prioriterede kandidater, dagsdel, forbudte vinkler).
Din opgave er IKKE at beslutte strategien fra bunden — den er at oversætte
den til konkret, ejervendt sprog og angles.

TONE: Marketing-chef der briefer ejeren — professionel, klar, konkret, ingen buzzwords.
SKRIV: Resultatorienteret og databaseret. Forklar HVORFOR med konkrete fakta
hentet fra konteksten — ikke med generiske sektorbeskrivelser.
Svar KUN med JSON-format (ingen forklaring udenfor).
```

---

## 2. Input Data Blocks (in order)

### 2.1 Phase 0: Kontekst-signaler (fakta-grundlag)
- `key_factors[]` — each rendered as:
  - name, type, strategic_weight
  - behavioral_impact
  - target_audience
  - content_opportunities (first 3)
  - timing_recommendation
- `factor_interactions[]` — factors, synergy, insight, strategic_implication, resolution
- `strategic_priorities_suggestion[]` — priority rank, theme, recommended_weight, reasoning

### 2.2 Virksomhed
- business_name, business_character, city
- has_outdoor_seating, has_takeaway, has_table_service
- menu_programmes (with role + timeContext)
- late_night_closing flag
- weather_is_differentiator = false override note

### 2.3 Menuer / Menu-evner
- **If** menu_summaries present: full `[Title]\n{summary}` blocks per menu
- **Else**: category counts with strategic_value from `analyzeMenuCapabilities()`

### 2.4 Personality Anchor (brand_voice)
- brand_essence + brand_essence_elaboration
- communication_goal
- identity_keywords
- target_audience.primary
- tone_of_voice (string or structured object)
- tone_keywords / primary_keywords
- humor_level
- typical_openings[0]
- voice_constraints
- tone_model.avoid_examples (first 2)
- content_pillars (up to 5, as DO's)
- signature_phrases[0]
- content_strategy: footfall_signals, brand_anchors, loyalty_hooks (POST STRATEGI block)

### 2.5 Lokationstype & Besøgsmotiver
- location.type + tourist_context flag
- location_categories with scores (≥60%)
- matched_motivations → rendered via `buildMotivationBlock()`
- marketing_focus
- Strategic consequence instruction tied to season + dominant motivations

### 2.6 Uge Kontekst
- weather_interpretation: operational_note, indoor_outdoor_bias, weekend_usability, strongest_opportunity_day, strongest_constraint_day
- Day-by-day forecast (Mon–Sun): temp range, precipitation %, wind speed, reliability hedge
- season.current
- Payday framing (if payday_this_week and economic_relevance ≠ low): day label + spend-readiness note
- Events list (name_dk)
- Previous week top post (content_type, performance vs avg)
- Historical goal_mode rates (floored at 15%, normalized) — soft indicator block
- posted_menu_items ban list (items used last 1–2 weeks)

### 2.7 Udeservering-regler
Only injected if `has_outdoor_seating = true`. Static Danish outdoor seating temperature/season rules.

### 2.8 Strategiske Kandidater (v2)
- All candidates with: label, confidence %, customer_behavior_reason, business_reason
- ★ marker for confidence ≥ 0.70
- Mandatory coverage rule: candidates with ★ MUST be represented in at least one focus area

### 2.9 Goal / Content Category Blend
- week_goal_blend from brand profile → % footfall / brand / loyalty
- week_content_category_weights → % product / craving_visual / behind_scenes / team_people

### 2.10 Sproglige Guardrails
- narrative_guardrails[] — injected as bullet points, marked UFRAVIGELIGE

### 2.11 Ugens Tilstand (week_mode block)
- `UGENS TILSTAND: [week_mode]` (only if ≠ standard_week)
- Commercial framing guidance per type:
  - `indoor_refuge` → visit mechanism framing, not atmosphere
  - `terrace` → concrete daypart/outdoor offer
  - `takeaway` → convenience, speed, concrete offer
- `DEPRIORITÉR DENNE UGE: [list]` — topics with low relevance to skip

---

## 3. Rules Block

```
FORBUDTE VENDINGER (may NEVER appear in any field):
  "foråret er på vej" · "folk vil forkæle sig selv" · "hyggelige rammer" · "den perfekte ramme"
  "noget for enhver" · "noget for alle" · "indbydende atmosfære" · "autentisk oplevelse"
  "lokal perle" · "socialt samvær" · "giv dig selv lov" · "tag chancen"
  "hygge" · "hyggelig" · "hyggelige" · "hyggefølelse" · "hyggepause"
    (unless the word appears in the business's own brand profile)
  "fristed fra vejret" · "fristed" · "oase" · "indendørs oase" · "trækker folk ind"
  "friske sæsoningredienser" (unless in menu-supported seasonal ingredients list)

VEJR-FRAMING REGLER (when week_mode contains 'indoor_refuge' or 'takeaway'):
  FORBUDT: metaforer — "fristed", "oase", "ly for vejret", "trækker folk ind"
  PÅKRÆVET: kommerciel mekanisme direkte — fx:
    ✓ "Regnfuld uge øger sandsynlighed for spontant frokostbesøg 11:30–14:00"
    ✓ "Vedvarende regn mandag–torsdag reducerer spontan udegang og øger værdien af et konkret besøgsargument"
    ✓ "Koldt vejr under 5°C skubber kaffepause-besøg fra udetorvet til indendørs spisested"

REGLER:
1.  Lav præcis [N] fokus-områder — ét per post. Giv dem CUSTOM navne (ikke generiske).
2.  Hvert område SKAL bruge: brand profile + menu + vejr/events + timing.
3.  reasoning = 2–4 sætninger. SKAL indeholde tre forankringspunkter:
      a) Gæste-adfærdsændring denne uge (observerbar, ikke redaktionel)
      b) Hvorfor NETOP denne virksomhed matcher den adfærd (driftsform, menu, location_behavior_mode)
      c) Hvorfor NETOP denne vinkel hjælper denne uge (week_mode, dagsdel, content_role)
    En reasoning der mangler et af de tre punkter er ugyldig.
4.  Nævn ALDRIG specifikke menu-retter (kun kategorier).
5.  Mindst ét fokus-område skal åbne for oplevelse-posts (ikke kun produkt).
6.  competitive_advantage: se krav i JSON-instruktionen.
7.  Vægte summer til 1.0.
8.  Test: Er reasoning klar, troværdig og forankret i de tre punkter?
9.  suggested_content_category mapping:
      product_menu    = specifik ret med booking/drifts-CTA
      craving_visual  = sensorisk madbillede, ingen drift
      behind_scenes   = bag om køkkenet, rummet, stedet
      team_people     = menneskestory, personhistorie
10. Nævn KUN konkrete ingredienser/råvarer fra "Menustøttede sæsonråvarer".

KVALITETS-CHECK:
- Er hvert reasoning-felt forankret i alle tre punkter?
- Er competitive_advantage specifik for DENNE virksomhed DENNE uge?
- Er week_summary bygget på observerbare fakta, ikke generiske sæsonbeskrivelser?
- Bruger jeg konkrete data fra brand profile og kontekst (ikke branchen generelt)?
```

---

## 4. JSON Output Schema

```json
{
  "week_summary": "<4-sentence structure — see field spec below>",
  "competitive_advantage": "<2-of-5 dimension spec — see field spec below>",
  "angles": [
    {
      "focus": "custom_focus_name",
      "weight": 0.5,
      "reasoning": "2–4 sentences with 3 mandatory anchor points",
      "menu_alignment": "which menu categories support this angle",
      "content_direction": "how posts should execute this angle",
      "suggested_content_category": "product_menu",
      "phase0_factors_used": ["special_day:Valentinsdag", "weather:cold_indoor"]
    }
  ]
}
```

### Field: `week_summary`
Instruction is embedded **inside the JSON value string** (anti-pattern — see issues below):
> Præcis 3–4 sætninger. Struktur OBLIGATORISK:
> 1. Faktisk vejr/timing/event + konkret effekt på gæsteadfærd
> 2. Kommerciel implikation for NETOP denne virksomhed (via business_mode + location_behavior_mode)
> 3. Ét konkret taktisk træk (dagsdel, menu-kategori, content-vinkel)
> 4. Valgfri: kun hvis reel modvægt — ellers udelad
>
> FORBUDT: alle vendinger fra FORBUDTE VENDINGER-listen. Ved indoor_refuge: ALDRIG vejret som stemning — kun besøgsadfærd og kommerciel mekanisme.

### Field: `competitive_advantage`
Instruction is embedded **inside the JSON value string** (anti-pattern — see issues below):
> Svar på: "Hvorfor netop DENNE virksomhed — ikke bare en virksomhed som denne — denne uge?"
> Kræver mindst to af disse fem dimensioner:
> 1. Lokationsfordel (location_behavior_mode advantage)
> 2. Dagsdels-/menufordel (primary_daypart_this_week or menu fit)
> 3. Driftsmodelfordel (business_mode advantage)
> 4. Gæstebesøgsfordel (primary_visit_motivation fit)
> 5. Ugespecifik fit (week_mode relevance)
>
> FORBUDT som standalone: kvalitet, lokal, autentisk, hyggelig — unless tied to a concrete fact.

---

## 5. Known Issues / Potential Flattening Points

| # | Location | Problem |
|---|----------|---------|
| 1 | `week_summary` JSON value | Field instruction is embedded as the default JSON value string. Gemini follows the schema shape and may output the instruction text literally or ignore it. Should be a named spec block **before** the schema. |
| 2 | `competitive_advantage` JSON value | Same problem — constraint text lives inside the JSON value, not as a prompt-level instruction. |
| 3 | `reasoning` constraints | The 3-anchor-point rule is in rule 3 and the quality check, but **after** the schema. Not inline with the angle object definition where the model is writing. |
| 4 | Post count constraint | Rule 1 states "præcis [N] fokus-områder" but the count constraint is disconnected from the schema itself — the `angles` array has no length hint. |
| 5 | Commercial framing guidance | indoor_refuge/terrace/takeaway framing is in the `UGENS TILSTAND` block (section 2.11), far above the rules and schema. May not carry weight when the model is filling JSON fields. |

---

## 6. Recommended Fixes (Priority Order)

1. **Pull `week_summary` and `competitive_advantage` instructions out of the JSON values** and place them as named field specification blocks immediately before the JSON schema — use `FELT: week_summary` / `FELT: competitive_advantage` headers.
2. **Add reasoning anchor-point reminder inline in the JSON angle object** — a short comment next to the `reasoning` key (e.g. `// KRAV: a) adfærd b) virksomhedsfit c) uge-relevans`).
3. **Add explicit array length note** to the schema preamble: `"angles" indeholder præcis [N] objekter`.
4. **Move weather commercial framing rule** from `UGENS TILSTAND` to a dedicated block immediately above the JSON schema so it's the last instruction before output generation.
