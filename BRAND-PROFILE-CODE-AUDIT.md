# Brand Profile Generator — Kode-audit

**Udarbejdet:** April 2026  
**Version:** 4.13.0 (index.ts)  
**Fokus:** Hvad er systemet? Hvad sender vi til AI'en? Hvad parser vi ud? Hvad skriver vi til databasen?

---

## 1. System-prompt og user-prompt (HØJESTE PRIORITET)

Der er **to AI-kald** i brand profile-generatoren. Begge bruger `response_format: json_object`.

---

### Prompt A — Intern signal-ekstraktion

**Fil:** `supabase/functions/_shared/brand-profile/prompts/prompt-a.ts`  
**Funktion:** `buildPromptA(dataSources, language, allowThirdParty)`  
**Kald i:** `supabase/functions/brand-profile-generator/index.ts` → `runInternalAnalysis()`

#### Kald-konfiguration
```
Model:       gpt-4o-mini
Temperature: 0.3
Max tokens:  1800  (var 3000 — timede ud >55s)
Timeout:     45.000 ms + 1 retry
```

#### System-prompt (Prompt A)
Feltet er `language.systemPromptA` — defineret i `languages.ts`. Indholdet varierer efter sprog, men det centrale er:
```
Du er en intern signal-ekstraktor. Output JSON ONLY. No markdown.
```

#### User-prompt (Prompt A) — fuld opbygning

User-prompten er bygget op i **Tier 1 / Tier 2 / Tier 3** og slutter med JSON-skema:

```
TIER 1 (intern — højest prioritet):
- name=...          (businesses.name)
- vertical=...      (businesses.vertical)
- city=...          (businesses.city)
- address=...       (businesses.address)
- country=...       (businesses.country)

LOCATION ENRICHMENT (deterministisk):
- city=, country=, city_tier=
- micro_area_type=
- nearby_signals=
- confidence=
- canonical_location_phrase=

User Profile:
- short_description=  (business_profile.short_description)
- long_description=   (business_profile.long_description)
- target_audience=    (business_profile.target_audience)
- price_level=        (business_profile.price_level)
- existing_business_character=  (business_brand_profile.business_character)

OPERATIONAL PROGRAMMES:
- [rolle] ([tidskontext]): [item 1], [item 2], ...
- late_night_venue=true/false
- latest_closing_time=HH:MM

Menu (type summary):
[AI helicopter summaries fra menu_results_v2.ai_summary, eller code-genereret type-summary]

Images:
[Op til 8 billeder: type, is_hero, ai_labels, category_tags]

TIER 2 (supporting):
WEBSITE (compact):
- Hero: [hero-tekster]
- Headers: [h1/h2 overskrifter]
- CTA: [call-to-action knapper]
- Value phrases: [slogans/løfter]
- Menu categories mentioned: [menukat.]
- About copy: [om-tekst snippets]
- Raw excerpt: [første 300 chars]

Social (bios):
[social_accounts: platform + bio]

TIER 3 (third-party — disabled som default):
[google_maps_photos_count, review_patterns, instagram_posts]
```

**CONSTRAINTS injiceret i Prompt A user-prompt:**
```
- distinctive_hooks: max 4
- micro_location_context: max 2
- usage_occasions: max 3
- tone_markers_from_text: max 8 — konkrete rytme-observationer fra FAKTISK tekst
- must_use_phrases.brand_essence: max 3
- must_use_phrases.cta: max 3
- evidence snippets: max 140 chars each
- No invented demographic personas (familier, børnefamilier, par, venner, lokale, unge, voksne, seniorer)
```

**JSON-skema Prompt A returnerer:**
```json
{
  "business_id": "string",
  "analysis_version": "compact-1.0",
  "distinctive_hooks": [
    { "hook": "...", "evidence": "...", "source": "...", "confidence": "high|medium|low" }
  ],
  "micro_location_context": [
    { "cue_type": "...", "description": "...", "evidence": "...", "source": "...", "confidence": "..." }
  ],
  "usage_occasions": [
    {
      "id": "...", "name": "...", "when": "...", "behavior": "...",
      "job_to_be_done": "...",
      "evidence": [{ "quote": "...", "source": "...", "confidence": "..." }],
      "confidence": "..."
    }
  ],
  "tone_markers_from_text": ["string"],
  "must_use_phrases": {
    "brand_essence": ["string"],
    "cta": ["string"]
  },
  "voice_context_signals": {
    "has_kids_menu": "boolean",
    "has_english_menu": "boolean",
    "price_register": "budget|mid|premium",
    "location_atmosphere": ["waterfront|outdoor_seating|city_centre|neighbourhood|shopping_street|harbour|park_adjacent"]
  }
}
```

---

### Prompt B — Bruger-vendt brand profil

**Fil:** `supabase/functions/_shared/brand-profile/prompts/prompt-b.ts`  
**Funktioner:** `buildSystemPromptB(language)` + `buildPromptB(dataSources, analysis, language, locale)`  
**Kald i:** `supabase/functions/brand-profile-generator/index.ts` → `generateBrandProfile()`

#### Kald-konfiguration
```
Model:       gpt-4o
Temperature: 0.25
Max tokens:  2500  (var 3500 — timede ud)
Timeout:     50.000 ms + 1 retry
```

#### System-prompt (Prompt B) — `buildSystemPromptB()`

Systemprompten er ~200 linjer og indeholder bl.a.:

```
Du er en social media-ekspert der bygger Brand Profiles for små lokale virksomheder.
Output: JSON only.

🚨 LOCATION CONTEXT (HIGHEST PRIORITY) 🚨
Hvis prompten leverer location enrichment med area_type, SKAL du inkludere den
specifikke lokationsfrase i:
1. brand_essence.value (start sætningen med den)
2. image_preferences.signature_shot (inkluder area-frasen)

TARGET AUDIENCE (behavior-centric, TEMPORAL FORMAT):
- Brug "Når gæster..." temporal framing
- FORBUDT: familier, børnefamilier, par, venner, lokale, unge, erhvervsfolk
- score-gated exceptions for besøgende (tourist ≥secondary), studerende (student primary only),
  erhvervsgæster (office primary/secondary)

BRAND ESSENCE ELABORATION:
- Svar: Hvorfor vælger en gæst DETTE sted frem for nabocafé 100m væk?
- FORBUDT: 'Om dagen', 'Om aftenen', 'forvandles', 'skifter til'

IDENTITY KEYWORDS:
- Nøjagtigt 3 ord — hvert i FORSKELLIG dimension:
  1. Atmosfære (hygge, intim, levende...)
  2. Formalitet (uformel, casual, lavmælt...)
  3. Kategori/format (klassikere, specialty, håndværk...)

BUSINESS CHARACTER:
- 1-2 faktuelle sætninger om hvad virksomheden ER
- INGEN marketing-sprog

STEMME-MEKANIK / STEMME-IDENTITET format (tone_of_voice):
STEMME-MEKANIK:
- [portabel mekanik-regel]
STEMME-IDENTITET:
- [forretnings-specifik regel (signal: meal_arc|price_register|location|venue_type|...)]
Eksempel: "[eksempelsætning]"

CONTENT STRATEGY (maturity × distinctiveness matrix):
- emerging: drive_footfall 35-45%, build_brand 40-50%, retain_loyalty 10-20%
- growing footfall-led: drive_footfall 45-55%, ...
- established footfall-led: drive_footfall 30-40%, retain_loyalty 35-45%

CONTENT PILLARS (altid alle 6):
- Crave-worthy, BTS, Social proof, Vibe, Engagement, Offers
- Nøjagtigt 3-4 sættes encouraged=true

BANNED WORDS (aldrig brug):
hyggelig, lækker, indbydende, autentisk, unik, afslappet/afslappede,
perfekt spot, charmerende, fantastisk, udsøgt, gastronomisk
```

#### User-prompt (Prompt B) — vigtigste blokke

User-prompten til Prompt B er den store datablok. Den indeholder disse sektioner i rækkefølge:

| Sektion | Hvad den indeholder | Kilde |
|---------|-------------------|-------|
| `LANGUAGE` | Sprogkode | `language.name` |
| `BANNED WORDS` | Smart-filtreret bannedliste (ord der bruges 2+ gange på websitet whitelistes) | `brand-word-lists.ts` |
| `BUSINESS` | name, venue_type, city, address | `businesses` tabel |
| `LOCATION ENRICHMENT` | area_type, nearby_signals, confidence, neighborhood | `business_locations.enrichment` |
| `CONCURRENT VISITOR AUDIENCE` | category_scores fra location_intelligence | `location_intelligence` tabel |
| `AUDIENCE PERMISSIONS` | tourist_strength, student_strength, office_strength (score-gated) | `filterAudienceLabels()` |
| `SERVICE FACTS` | has_kids_menu, has_outdoor_seating | `business_operations` |
| `MANDATORY PHRASES` | 🔴 brand_essence.value SKAL starte med "[venueType] [locationPhrase] hvor..." | deterministisk |
| `OPERATIONS` | establishment_type, takeaway, kitchen_close_time, weekly_programme | `business_operations` |
| `OPERATIONAL PROGRAMMES` | Bekræftede menu-programmer (brunch/frokost/bar) + åbningstider | `menu_results_v2` + `opening_hours` |
| `EXISTING BUSINESS CHARACTER` | Seed fra tidligere generering | `business_brand_profile.business_character` |
| `BRAND ESSENCE constraint` | Hybrid-venue vs. standard format-instruks | computed |
| `USAGE OCCASIONS` | Fra Prompt A: occasions med evidence-quotes | `analysis.usage_occasions` |
| `LOCATION MOTIVATIONS` | category_scores ≥40 → hvert earn én "Når..."-klausul | `categoryScores` |
| `CONTENT TRIGGERS` | Fra Prompt A: what_to_show, copy_angles | `analysis.content_triggers` |
| `PROMPT A SIGNALS` | distinctive_hooks, physical_space_cues, copy_patterns | `analysis.distinctive_hooks` |
| `MUST-USE PHRASES` | Nøjagtigt ord der skal kopieres | `analysis.must_use_phrases` |
| `TONE MARKERS FROM TEXT` | Observerede rytme-mønstre fra website copy | `analysis.tone_markers_from_text` |
| `SIGNAL PROFILE` | Strukturelle fakta: venue_type, meal_arc, price_register, dietary_flags, location cluster | computed |
| `VOICE REASONING FRAMEWORK` | Spørgsmål AI skal besvare for at udlede stemmeregler | computed |
| `WRITING SAMPLES (Path A)` | Op til 6 rene social posts (filtreret for banned words) | `business_brand_profile.sample_posts` |
| *(eller)* `NO WRITING SAMPLES (Path B)` | Instruks om at udlede fra markers + signal profile | mangler sample posts |
| `MENU` | Top items / AI helicopter summaries | `menu_results_v2.ai_summary` |
| `WEBSITE SIGNALS` | CTAs, headers, value phrases, menu categories | `website_analyses` |
| `IMAGES` | Op til 5 billeder med labels og tags | `media_assets` |
| `ALLOWED PROOF TOKENS` | Verbatim-tokens til brug i proof-bullets | computed |
| `FIELD-SPECIFIC RULES` | Detaljerede instrukser per output-felt | hardcoded |

---

## 2. Kontekst-samlingen — `gatherDataSources()`

**Fil:** `supabase/functions/_shared/brand-profile/data-gatherer.ts`  
**Funktion:** `gatherDataSources(supabase, businessId, allowThirdParty)`

Fetcher **13 tabeller i parallel** med `Promise.all()`:

| # | Tabel | Hvad der hentes |
|---|-------|----------------|
| 1 | `businesses` | Alle felter (name, vertical, city, address, country) |
| 2 | `business_locations` | Primær lokation med enrichment JSONB |
| 3 | `business_profile` | short_description, long_description, target_audience, price_level |
| 4 | `website_analyses` | Seneste analyse: hero, headers, CTAs, raw_result |
| 5 | `media_assets` | Op til 20 billeder: type, category_tags, ai_labels, is_hero |
| 6 | `social_accounts` | Tilsluttede platforme med handle/url |
| 7 | `third_party_evidence` | *(kun når allowThirdParty=true)* Google Maps + Instagram |
| 8 | `business_operations` | has_outdoor_seating, has_takeaway, kitchen_close_time, weekly_programme |
| 9 | `location_intelligence` | category_scores, concept_fit_by_category, location_marketing_hooks |
| 10 | `menu_results_v2` | AI-summaries + structured_data (seneste per service_period) |
| 11 | `business_brand_profile` | Eksisterende brand_character + sample_posts (til Path A) |
| 12 | `opening_hours` | Ugedage med open_time / close_time |
| 13 | `businesses` (count) | Antal lokationer (multi-location detection) |

**Post-processing i data-gatherer:**
- `parseMenuStructure()` — flattener `menu_structure` JSONB til items
- `computeAndPersistEnrichment()` — udregner deterministisk location enrichment + persister hvis ændret (hash-sammenlignet)
- Udtrækker `menuSignalProgrammes` (rolle + tidskontext + items) fra menu_results_v2
- Udtrækker `openingHoursRows` til late-night detection
- Samler `existingBusinessCharacter` fra brand_profile

**Signal-extraction af website:**  
`extractStructuredWebsiteData()` fra `signal-extractor.ts` — parser `website_analyses.raw_result` til:
- `heroTexts`, `headers`, `ctaTexts`, `valuePhrases`, `menuCategoriesMentioned`, `aboutSnippets`, `rawExcerpt`

---

## 3. Output-parseren

**Primær fil:** `supabase/functions/brand-profile-generator/index.ts`  
**Funktioner:** `parseBrandProfileResponse()` + `generateBrandProfile()`

### Parsing-flow

```
AI retur-JSON (string)
     ↓
parseOpenAIJson()          [openai-client.ts — strippper ```json``` code fences]
     ↓
coerce STRING_VALUE_FIELDS [sikrer .value er string, ikke objekt]
     ↓
applyDeterministicRepairs() [repair/deterministic-repairs.ts]
     ↓
normalizeContentPillars()  [sikrer alle 6 pillars + korrekt shape]
     ↓
validateBrandProfileOutput() [validators.ts]
     ↓
buildFallback*()           [repair/fallback-builders.ts — for hvert felt der fejler]
     ↓
sanitizeBannedWords()      [prompts/brand-word-lists.ts]
     ↓
Absolutte safety-guards    [isBadTargetAudienceValue etc.]
     ↓
Path B trim: tone_of_voice bullets begrænses til voiceAnchorCount (4-6)
     ↓
parseBrandProfileResponse() → BrandProfile object
```

### Hjælperfunktioner i parseren

| Funktion | Formål |
|---------|--------|
| `pickValue(field)` | Henter `.value` som string — håndterer både `"string"` og `{value: "string"}` |
| `pickProof(field)` | Henter `.proof` array |
| `pickArrayValue(field)` | Henter direkte array eller `{value: array}` (content_pillars) |

### Felter AI'en producerer → hvad der bliver brugt

| AI-felt | Parser-handling | DB-destination |
|---------|----------------|---------------|
| `brand_essence.value` | `pickValue()` → post-processet deterministisk | `business_brand_profile.brand_essence` |
| `brand_essence_elaboration.value` | `pickValue()` | `business_brand_profile.brand_essence_elaboration` |
| `identity_keywords` | direkte array | `business_brand_profile.identity_keywords` |
| `business_character` | quality-gate: brug ny ≥30 chars, ellers bevar eksisterende | `business_brand_profile.business_character` |
| `voice_rationale` | `pickValue()` | `business_brand_profile.voice_rationale` |
| `tone_of_voice.value` | `pickValue()` + Path B trim + Eksempel: linje-ekstraktion | `business_brand_profile.tone_of_voice` |
| `tone_model` | direkte objekt → `sanitizeToneModelForDb()` | `business_brand_profile.tone_model` (JSONB) |
| `things_to_avoid` | `{language_constraints, factual_constraints}` | `things_to_avoid` (TEXT) + `things_to_avoid_jsonb` |
| `target_audience.value` | `pickValue()` + fallback hvis banned words | `business_brand_profile.target_audience` |
| `core_offerings.value` | `pickValue()` + `deriveCoreOfferingsJsonb()` | `core_offerings` (TEXT) + `core_offerings_jsonb` |
| `content_focus.value` | `pickValue()` | `business_brand_profile.content_focus` |
| `content_pillars` | `pickArrayValue()` + `normalizeContentPillars()` | `business_brand_profile.content_pillars` (TEXT/JSON) |
| `communication_goal.value` | `pickValue()` | `business_brand_profile.communication_goal` |
| `image_preferences` | `{dos, donts, signature_shot}` | `image_preferences` (TEXT) + `image_preferences_jsonb` |
| `social_style` | `{emoji_usage, emoji_examples, hashtag_strategy}` | `business_brand_profile.social_style` (JSONB) |
| `voice_examples` | `{do_say, dont_say, vocabulary}` | *(ikke i profileData — mangler)* |
| `content_strategy` | direkte objekt | `business_brand_profile.content_strategy` (**PROTECTED — overskrives ikke hvis allerede sat**) |
| `tone_of_voice` Eksempel:-linjer | `extractEksempelLines()` | `business_brand_profile.typical_openings` |

### Felter der SPRINGES OVER / ikke gemmes

- `voice_examples` — parses men gemmes tilsyneladende ikke i `profileData` (potentielt bug/gap)
- `recognizable_interior_identity` — parses men er ikke i basis `profileData`
- `clarifications_needed` — AI producerer dette felt men der er ingen DB-kolonne

---

## 4. Rå AI-output (Cafefaust)

**Ingen rå AI-output er gemt i databasen.** Der er ingen `_debug_prompt`-kolonne i `business_brand_profile`, og ingen logging til fil/tabel.

Det rå JSON fra Prompt A og Prompt B parses direkte i memory og gemmes aldrig.

**For at få det rå output skal du:**

1. Tilføj et midlertidigt debug-felt i `saveBrandProfile()`:
```typescript
// I profileData-objektet:
...(process.env.DEBUG_MODE && {
  _debug_prompt_b_raw: JSON.stringify(sections)
})
```

2. Eller tilføj en `console.log` umiddelbart efter `parseOpenAIJson()` i `generateBrandProfile()`:
```typescript
const sections = parseOpenAIJson<any>(content)
console.log(`[${requestId}] 📦 RAW PROMPT B OUTPUT:`, JSON.stringify(sections, null, 2))
```
...og tjek Supabase Edge Function logs efterfølgende.

---

## 5. Nøgle-problemer at undersøge

Baseret på kode-audit er her de sandsynlige fejlkilder:

### A. `brand_essence.value` overskrives deterministisk
Prompt B's output for `brand_essence.value` **overskrives** i `applyDeterministicRepairs()`. AI'en kan producere et godt svar, men post-processoren bygger det om fra skabelon. Se `repair/deterministic-repairs.ts`.

### B. `tone_of_voice` — Path A vs. Path B
- **Path A** (rene sample posts findes): AI deriverer regler fra eksisterende posts
- **Path B** (ingen clean posts): AI deriverer fra tone_markers + signal profile
- Problemet er typisk at `tone_markers_from_text` fra Prompt A er tomme eller for generiske → Prompt B's Path B har for lidt at arbejde med

### C. `target_audience` — score-gated persona-regler
Persona-labels (besøgende, studerende, erhvervsgæster) kræver scores fra `location_intelligence.category_scores`. Hvis disse scores mangler eller er lave, falder alle personas bort og man får kun generiske "Når gæster..."-sætninger.

### D. `voice_examples` gemmes ikke
`parseBrandProfileResponse()` returnerer `voice_examples` i BrandProfile-objektet, men `saveBrandProfile()` inkluderer det ikke i `profileData`. Feltet genereres men gemmes aldrig.

### E. `content_strategy` er PROTECTED
Første gang brand profilen genereres skrives content_strategy. **Efterfølgende regenereringer overskriver den ikke**, selv hvis AI'en producerer bedre output. Dette er bevidst design, men kan føre til forældet strategi.

---

## 6. Fil-oversigt

```
supabase/functions/
├── brand-profile-generator/
│   └── index.ts                          ← Hoved-orchestrator + parseBrandProfileResponse()
│
└── _shared/brand-profile/
    ├── data-gatherer.ts                  ← gatherDataSources() — 13 tabeller parallelt
    ├── signal-extractor.ts               ← extractStructuredWebsiteData()
    ├── location-intelligence.ts          ← buildLocationIntelligence()
    ├── database.ts                       ← saveBrandProfile() — DB-felt-mapping
    ├── validators.ts                     ← validateBrandProfileOutput()
    ├── prompts/
    │   ├── prompt-a.ts                   ← buildPromptA() — intern signal-ekstraktion
    │   ├── prompt-b.ts                   ← buildPromptB() + buildSystemPromptB()
    │   ├── brand-profile-schema.ts       ← JSON-skema embedded i Prompt B user prompt
    │   └── brand-word-lists.ts           ← banned words + smart whitelist
    ├── repair/
    │   ├── deterministic-repairs.ts      ← applyDeterministicRepairs()
    │   ├── fallback-builders.ts          ← buildFallback*() per felt
    │   └── patchers.ts                   ← patchContentPillarsNotes...()
    └── validation/
        ├── value-validators.ts           ← isBadTargetAudienceValue() etc.
        └── contract-validators.ts        ← validateDistinctiveHooksContract()
```
