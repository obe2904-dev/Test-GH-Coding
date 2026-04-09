# AI Weekly Plan — Komplet Dataoversigt

> Hvad modtager AI Ugentlig Plan af information, og hvor kommer det fra?  
> Sidst opdateret: Marts 2026 (efter Option A implementation)

---

## Overblik

`get-weekly-strategy` henter data fra **8 databasetabeller + 1 eksternt API**, bygger et `WeekContext`-objekt og sender det til `weekly-strategy-generator.ts`, som assemblerer en GPT-prompt i 3 faser (Phase 0 → Phase 1 → Phase 2).

---

## 1. Virksomhedsbasics

**Kilde:** `businesses` + `business_locations`

| Felt | Hvad det bruges til i prompten |
|---|---|
| `name` | Virksomhedens navn i alle prompt-blokke |
| `category` / `business_type` | Framework-valg (café, restaurant, bar, hybrid) |
| `city` | "By: Aarhus, Danmark" |
| `country` | Sæson-logik + event-hentning (DK/SE/NO) |
| `subscription_tier` | Antal foreslåede posts (smart vs. pro) |

---

## 2. Brand Voice / Personality Anchor

**Kilde:** `business_brand_profile`

Hele dette afsnit styrer *hvordan* AI'en skriver — tone, stil, grænser.

### 2a. Hvad sendes til prompt (komplet liste)

| DB-felt | Prompt-label | Format i prompten | Status |
|---|---|---|---|
| `brand_essence` | `🏷️ "…"` (identity anchor) | Øverste linje i PERSONALITY ANCHOR-blokken | Eksisterer |
| `brand_essence_elaboration` | `📌 Uddybning:` | 2–3 sætninger under identity anchor | **Ny** |
| `identity_keywords` | `🔑 Identitet:` | 3 distinkte identitetsord (≠ tone keywords) | **Ny** |
| `emotional_core` | `💡 Emotionel kerne:` | Kort tekst — hvad oplevelsen handler om | **Ny** |
| `target_audience` | `• Målgruppe:` | primary + op til 3 characteristics | Eksisterer |
| `core_offerings` | `• Kernetilbud:` | Første 200 tegn (string eller array) | Eksisterer |
| `tone_of_voice` | `TONE-GUIDE:` | Ny format: rules-string direkte / Legacy format: primary_tone + attributes | Eksisterer |
| `humor_level` | `• Humor:` | moderate / low / high | Eksisterer |
| `typical_openings[0]` | `✅ Typisk åbning:` | Første eksempel-åbning | Eksisterer |
| `content_focus` | `DO'S` — Content pillars | Array af `{hook, usage}` — vis op til 5 | Eksisterer |
| `signature_phrases[0]` | `✅ Signaturfrase:` | Første signaturfrase | Eksisterer |
| `voice_constraints` | `⚠️ Skriveprincip:` | Én principsætning — *hvorfor* ikke *hvad ikke* | **Ny** |
| `tone_model.avoid_examples` | `❌ Undgå fx:` | 2 konkrete eksempler — genereret fra principsætningen | Eksisterer (sub-felt) |
| `tone_keywords` | `• Kernepersonlighed:` | Kun udfyldt hvis legacy tone_of_voice-format | Eksisterer |

> **Fra lister til principper:** `never_say` og `things_to_avoid` er erstattet af `voice_constraints` — én principsætning der forklarer *hvorfor* i stedet for *hvad*. En sætning som *"Undgå ord der lyder som de hører hjemme i et reklamefirma, ikke bag en kaffemaskine"* giver AI'en langt mere at arbejde med end 40 forbudte ord — og vokser ikke over tid. `tone_model.avoid_examples` leverer 2 konkrete eksempler under princippet så det ikke hænger i luften.

> ⚠️ **Kendt datakvalitets-problem:** `target_audience` er genereret af den ældre generator-version, som producerede situationelle beskrivelser i stedet for demografiske facts. Feltet er nu korrekt *koblet* til prompten (Option A), men selve indholdet er upålideligt indtil generator-rewrite.

> **`identity_keywords` vs. `tone_model.primary_keywords`:** Disse to felter er bevidst adskilte. `identity_keywords` er *hvem* virksomheden er ("Hygge · Uformel · Klassikere"). `tone_model.primary_keywords` er *hvordan* der skrives ("Direkte · Varm · Nærværende"). De må ikke blandes.

---

### 2b. Brand Profil-siden — aftalt baseline-struktur (v2, Marts 2026)

Brand Profil-siden er organiseret efter **funktion**, ikke alfabetisk. Hvert afsnit er tydeligt mærket med om AI'en læser det ved *hver* planegenerering.

**Gruppe 1 — Identitet** *(alle 4 felter læses ved hver generering)*
| Felt vist | DB-felt | Bemærkning |
|---|---|---|
| Brand Essence (1 sætning) | `brand_essence` | Heroafsnit øverst — identitetsanker |
| Uddybning (2–3 sæt.) | `brand_essence_elaboration` | Strategisk kontekst under heroen |
| 3 identitetsord | `identity_keywords` | Chips — tydeligt adskilt fra tone-chips |
| Emotionel kerne | `emotional_core` | "Det her handler om…" — driver content angles |

> **`core_offerings` vises bevidst IKKE på siden.** Feltet injiceres stadig i Weekly Plan-prompten, men for hospitality-virksomheder med et begrænset udvalg ville det føre til, at AI'en gentager de samme retter i hvert forslag. Brugeren skal overraskes — ikke fodres med det samme igen og igen.

**Gruppe 2 — Stemme** *(læses ved hver generering)*
| Felt vist | DB-felt | Bemærkning |
|---|---|---|
| Tone-regler (tekst) | `tone_of_voice` | Pre-formatted rules-string |
| Tone-nøgleord (chips) | `tone_model.primary_keywords` | Visuel opsamling |
| Typisk åbning | `typical_openings[0]` | Var usynlig i V1 — tilføjet i V2 |
| Humor-niveau | `humor_level` | moderate / low / high |

**Gruppe 3 — Content Pillars** *(DO'S — læses ved hver generering)*
| Felt vist | DB-felt | Bemærkning |
|---|---|---|
| Op til 5 hooks med usage | `content_focus` | Array af `{hook, usage}` |

**Gruppe 4 — Grænser** *(læses ved hver generering)*
| Felt vist | DB-felt | Bemærkning |
|---|---|---|
| Skriveprincip (tekst) | `voice_constraints` | Én sætning — princip, ikke liste |
| Konkrete eksempler | `tone_model.avoid_examples` | 2 eksempler under principsætningen |
| Signatur-fraser | `signature_phrases` | Øverste 3-5 |

**Gruppe 5 — Baggrundskontekst** *(kollapsét som standard — ikke i prompt)*
| Felt vist | DB-felt | Bemærkning |
|---|---|---|
| Målgruppe | `target_audience` | Med datakvalitets-advarsel |
| Eksempel-opslag | `sample_posts` | **Bruges som generator-input** (Tier 1 stemme) — vises også her |
| Brand-historie | `brand_origin_story`, `what_makes_us_different` | Vises kun hvis tilgængeligt |

**Hvad der er fjernet fra V1-siden:**
- Konkurrencemæssig Positionering (`communication_goal`) — ikke brugt i Weekly Plan-prompten
- Stemme Personlighed (formality, storytelling_style) — for teknisk til brugerfacing visning
- Confidence Score — intern metric, ikke brugerrelevant

---

### 2c. Brand Essence — genererings-spec (v1, Marts 2026)

**Formål:** Genereres én gang af brand-profile-generator og gemmes. Bruges derefter som statisk identitetsanker i alle Weekly Plan-kørsler — genregenereres ikke ugentligt.

**Input-prioritet til generatoren:**

| Prioritet | Kilde | Hvad det bidrager med |
|---|---|---|
| 1 (primær) | `location_intelligence.matched_motivations` | Hvad gæster faktisk søger og føler |
| 2 (primær) | `location_intelligence.marketing_focus` | Strategisk vinkel fra lokationsanalysen |
| 3 (primær) | `businesses.name` + `category` + `city` | Grundlæggende identitet og kontekst |
| 4 (sekundær) | `menu_results_v2.ai_summary` (alle fundne) | Typen af sted — café, restaurant, hybrid, vinbar etc. |
| 5 (sekundær) | `location_intelligence.category_scores` (≥60%) | Hvad slags oplevelsessted det primært er |

> Menu summaries inkluderes for at AI'en kan skelne en hybridkafé fra en italiensk restaurant. De bruges til at forstå *typen af sted* — ikke til at generere dish-specifikke sætninger.

**Output-struktur og DB-mapping:**

| Output | DB-felt | Injiceres i Weekly Plan | Prompt-label |
|---|---|---|---|
| Én sætning (maks. 12 ord) | `brand_essence` | ✅ Hver kørsel | `🏷️ "…"` |
| Uddybning (2–3 sætninger) | `brand_essence_elaboration` | ✅ Hver kørsel | `📌 Uddybning:` |
| 3 distinkte identitetsord | `identity_keywords` (string[3]) | ✅ Hver kørsel | `🔑 Identitet:` |
| Emotionel kerne (kort tekst) | `emotional_core` | ✅ Hver kørsel | `💡 Emotionel kerne:` |

**Krav til de 3 identitetsord (`identity_keywords`):**
- Hvert ord skal trække i en *forskellig* retning (ikke synonymer)
- Anbefalet struktur: én atmosfære-dimension + én formalitets-dimension + én kategori-dimension
- Eksempel Café Faust: "Hygge · Uformel · Klassikere" (ikke "Hygge · Samvær · Fællesskab")
- Må ikke overlappe med `tone_model.primary_keywords` (som beskriver *skrivestil*, ikke *identitet*)

**Prompt-instruktioner til generatoren:**
```
Udarbejd en Brand Essence for [VIRKSOMHEDSNAVN].

Lever i følgende struktur:
1. Brand Essence i én sætning (maks. 12 ord)
2. Uddybning (2–3 sætninger, strategisk formuleret)
3. Kogt ned til 3 kerneord — hvert ord skal trække i en FORSKELLIG retning
   (undgå synonymer — fx ikke "Hygge · Samvær · Fællesskab")
4. Emotionel kerne (hvad det i virkeligheden handler om — 3–5 korte linjer)

Krav:
- Skal være tidløs og ikke kampagneorienteret
- Må ikke ligne en tagline
- Skal udtrykke brandets dybe identitet, ikke konkrete produkter
- Professionel og strategisk tone
- På dansk
```

**PERSONALITY ANCHOR-blokken i Weekly Plan-prompten (efter implementering):**
```
🏷️ "[brand_essence]"
📌 [brand_essence_elaboration]
🔑 Identitet: [identity_keywords[0]] · [identity_keywords[1]] · [identity_keywords[2]]
💡 Emotionel kerne: [emotional_core]
• Målgruppe: [target_audience]
```

---

### 2d. Stemme — genererings-spec (v1, Marts 2026)

**Formål:** Genereres i samme kørsel som Brand Essence (Gruppe 1 køres først — Stemme *udledes* af Identitet). Gemmes og genregenereres ikke ugentligt. Gruppe 4-felterne (`voice_constraints`, `tone_model.avoid_examples`) genereres i **samme kald** som Gruppe 2 — de er to sider af samme analyse.

**Input-prioritet — 3 niveauer:**

| Niveau | Kilde | Hvad det bidrager med | Forudsætning |
|---|---|---|---|
| **Tier 1 — Faktisk skrivning** | `sample_posts` (råtekst) | Præcis sætningsrytme, tegnsætning, brug af "vi", direkte tiltale, humor-markører | Skal have ≥3 opslag |
| **Tier 1 — Faktisk skrivning** | `menu_results_v2` råbeskrivelser (ikke `ai_summary`) | Ordvalg, formalitetsniveau, konkret vs. emotionelt sprog | Skal have tekstindhold |
| **Tier 2 — Udledt fra Identitet** | `brand_essence` + `brand_essence_elaboration` + `identity_keywords` + `emotional_core` | Formalitetsdimension → register; emotionel kerne → varmeniveau | Gruppe 1 skal være genereret |
| **Tier 3 — Kategori-prior (fallback)** | `businesses.category` + `location_intelligence.matched_motivations` | Branchemæssige normer og gæsteforventninger | Bruges kun hvis Tier 1 og 2 er tomme |

> **Tier 1 er den stærkeste signal.** Kategorien fortæller hvad virksomheden er — faktisk skrivning fortæller hvordan ejeren tænker og kommunikerer. De er ikke det samme. Tier 3 er et prior, ikke et faktum, og skal aldrig overskrive observationer fra Tier 1.

> `sample_posts` flyttes fra "display-only" til **aktiv generator-input**. Det er det højest-fidelitetssignal vi har og er i dag uudnyttet.

**Output-struktur og DB-mapping:**

| Output | DB-felt | Gruppe | Injiceres i Weekly Plan |
|---|---|---|---|
| 5 konkrete skriveregler | `tone_of_voice` | 2 | ✅ Hver kørsel (`TONE-GUIDE:`) |
| 3–4 tone-nøgleord | `tone_model.primary_keywords` | 2 | ✅ Hver kørsel (`• Kernepersonlighed:`) |
| 3 eksempel-åbninger | `typical_openings` | 2 | ✅ Første bruges (`✅ Typisk åbning:`) |
| Humor-kalibrering | `humor_level` | 2 | ✅ Hver kørsel (`• Humor:`) |
| Skriveprincip (én sætning) | `voice_constraints` | 4 | ✅ Hver kørsel (`⚠️ Skriveprincip:`) |
| 2 konkrete undgå-eksempler | `tone_model.avoid_examples` | 4 | ✅ Hver kørsel (`❌ Undgå fx:`) |

**`tone_of_voice` fast struktur — altid præcis 5 regler:**

Hver regel starter med et verbum, maks. 12 ord. Ingen punktummer sidst. Eksempel (Café Faust-type):
```
Skriv som en ven der kender stedet indefra
Brug direkte tiltale — du, ikke man
Hold sætninger korte — én tanke ad gangen
Lad billedet tale — beskriv hvad man mærker, ikke hvad man ser
Undgå adjektiv-ophobning — vælg ét præcist ord frem for tre bløde
```

> Fast struktur (5 regler, verbum-åbning) giver forudsigelig prompt-injektion og tvinger generatoren til at prioritere i stedet for at liste alt op.

**Prompt-instruktioner til generatoren:**
```
Gruppe 1 (Brand Essence) er allerede genereret. Udled nu stemmeprofilen for [VIRKSOMHEDSNAVN].

[Hvis Tier 1-data tilgængeligt:]
Analysér disse eksisterende tekster og identificér mønsteret:
- Sætningslængde og rytme
- Brug af direkte tiltale (du/vi/man)
- Tegnsætningsstil (tankestreger, udråbstegn, ellipser)
- Konkret vs. abstrakt/emotionelt sprog
- Humor-markører og varmhedsgrad

Lever i følgende struktur:
1. 5 skriveregler — hver starter med verbum, maks. 12 ord (TONE-GUIDE format)
2. 3–4 tone-nøgleord der beskriver SKRIVESTIL (ikke identitet — de må ikke overlappe med identity_keywords)
3. 3 eksempel-åbningssætninger i den korrekte stemme (til social media captions)
4. Humor-niveau: low / moderate / high
5. Skriveprincip: én sætning der forklarer HVORFOR denne stil passer — ikke hvad der er forbudt
6. 2 konkrete eksempler på hvad der ville bryde stilen (specifikke sætninger, ikke kategorier)

Krav:
- tone-nøgleord og identity_keywords må IKKE overlappe
- Stilen skal være konsistent med brand_essence: "[brand_essence]"
- På dansk
```

**TONE-GUIDE-blokken i Weekly Plan-prompten (efter implementering):**
```
TONE-GUIDE:
[regel 1]
[regel 2]
[regel 3]
[regel 4]
[regel 5]
• Kernepersonlighed: [kw1] · [kw2] · [kw3]
• Humor: [humor_level]
✅ Typisk åbning: "[typical_openings[0]]"
⚠️ Skriveprincip: [voice_constraints]
❌ Undgå fx: [avoid_examples[0]] / [avoid_examples[1]]
```

---

### 2e. Content Pillars — genererings-spec (v1, Marts 2026)

**Formål:** Definerer de *vinkler* AI'en må skrive fra — ikke emner, men linser. En pillar er ikke "Vores menu" (emne) men "Håndværket bag det simple" (vinkel der kan generere uendeligt mange posts om kaffe, mad, proces, people). Genereres efter Gruppe 1 og 2 er afsluttet.

**Levetid:** Semi-permanent. Ikke automatisk regenereret ved Weekly Plan-kørsler. Regenereres on-demand (knap) hvis virksomheden pivoterer — fx dropper brunch, tilføjer vinavtener. Mere foranderlig end `brand_essence` (dyb identitet), men ikke ugentlig som vejrdata.

**Input-prioritet til generatoren:**

| Prioritet | Kilde | Hvad det bidrager med |
|---|---|---|
| 1 (primær) | `emotional_core` | Det emotionelle territorium pillars må arbejde i |
| 2 (primær) | `location_intelligence.matched_motivations` | Hvilke vinkler der reelt lander hos gæsterne |
| 3 (primær) | `location_intelligence.marketing_focus` | Hvad der strategisk skal leanes ind i |
| 4 (sekundær) | `identity_keywords` | Konsistensanker — pillars skal føles som samme brand |
| 5 (sekundær) | `menu_results_v2.ai_summary` (alle fundne) | Grounding i faktisk indhold der eksisterer |

> Menu summaries bruges til at sikre pillars kan aktiveres med *noget der faktisk er der* — ikke abstrakte vinkler der kræver indhold virksomheden ikke har.

**Output:** 3–5 objekter i `content_focus` (array af `{hook, usage}`). Ingen nye DB-felter.

**Kvalitetskrav til hver pillar:**

- Skal være **sæsonneutral** — sæsonkontekst leveres af Weekly Plan, ikke pillars
- Skal kunne generere **mindst 10 distinkte posts** — bestå "10-post-testen" inden den godkendes
- Ingen to pillars må overlappe i **emotionelt territorium**
- Skal **fejle genericitetstesten**: *"Ville en hvilken som helst café kunne bruge denne?"* — hvis ja, for generisk
- `hook` maks. 6 ord. `usage` maks. 15 ord — konkret vejledning til AI'en, ikke beskrivelse

**Eksempler (Café Faust-type):**
```json
[
  {
    "hook": "Håndværket bag det simple",
    "usage": "Vis ingredienser og teknik uden at prale — stolthed uden reklame"
  },
  {
    "hook": "Stedet som tredje sted",
    "usage": "Lad stedet tale som fast punkt i hverdagen, ikke destination"
  },
  {
    "hook": "Øjeblikket der holder",
    "usage": "Fang stille, uformelle øjeblikke der gør et besøg til en vane"
  },
  {
    "hook": "Mennesker bag bordet",
    "usage": "Folk der arbejder her — ikke portrætter, men autentiske glimt"
  }
]
```

**Anti-mønstre der skal afvises:**
```
❌ "Vores menu"         — emne, ikke vinkel
❌ "Kvalitet"           — generisk, ingen retning
❌ "Vinterkampagne"     — sæsonspecifik, hører hjemme i Weekly Plan
❌ "Sociale medier"     — platform, ikke indholdsdimension
```

**Prompt-instruktioner til generatoren:**
```
Gruppe 1 (Brand Essence) og Gruppe 2 (Stemme) er genereret. Definer nu content pillars for [VIRKSOMHEDSNAVN].

En pillar er en VINKEL — ikke et emne. Den skal kunne generere mindst 10 distinkte posts.
Eksempel på forskel: "Vores menu" (emne ❌) vs. "Håndværket bag det simple" (vinkel ✅)

Lever 3–5 pillars i formatet:
{
  "hook": "[maks. 6 ord — vinklen i komprimeret form]",
  "usage": "[maks. 15 ord — konkret vejledning: hvornår og hvordan AI'en bruger denne vinkel]"
}

Krav til hver pillar:
- Sæsonneutral (sæson kommer fra ugekontekst, ikke pillars)
- Bestå 10-post-testen: kan der genereres 10 FORSKELLIGE posts fra denne vinkel?
- Intet emotionelt overlap med andre pillars
- Fejle genericitetstesten: ville enhver café kunne bruge den? Hvis ja — skriv om
- Forankret i hvad virksomheden faktisk har (menu, atmosfære, mennesker)
- Konsistent med brand_essence: "[brand_essence]"
- På dansk
```

**DO'S-blokken i Weekly Plan-prompten (efter implementering):**
```
DO'S — Brug disse vinkler som afsæt:
→ [hook 1]: [usage 1]
→ [hook 2]: [usage 2]
→ [hook 3]: [usage 3]
[→ hook 4 og 5 hvis tilgængeligt]
```

---

## 3. Menu & Madretter

**Kilde:** `menu_results_v2` (op til 20 rækker, status = 'done')

### 3a. AI Menu Summaries (primær)
Hvis en menuside har et `ai_summary`-felt, vises det i prompten som:

```
MENUER (overordnet oversigt):
[BRUNCH]
Café Fausts brunch-menu byder på...

[AFTEN]
Aftenmenuen har fokus på...
```

Alle fundne menuer vises med deres URL-baserede titel.

### 3b. Signaturvarer (sekundær/fallback)
Hvis ingen ai_summary: udtrækkes navne fra `structured_data.menuStructure` — op til 10 retter.

### 3c. Sæsoningrediens-sporing
Ingredienser fra menubeskrivelser udtrækkes (op til 15) og bruges i Phase 0.

### 3d. Service Periods
Hvilke perioder virksomheden dækker (`brunch`, `frokost`, `aften`, `takeaway`) — udtrækkes fra `service_periods`-feltet.

> ⚠️ **Café Faust-problem:** AFTEN-menuen mangler `ai_summary` (kun `structured_data`). `extractMealCategoryPhrase` finder ikke "aften" i varebeskrivelserne fordi det er en service_period, ikke et varenavn.

---

## 4. Lokation & Besøgsmotiver

**Kilde:** `location_intelligence` (inkl. `category_scores`)

| Felt | Prompt-label | Bemærkning |
|---|---|---|
| `category_scores` → top-1 (>50%) | Primær lokationstype | Bruges som `location.type` |
| `category_scores` → top-4 (≥60%) | `Aktive lokationstyper (≥60%):` | Vises kun hvis >1 kategori over 60% |
| `matched_motivations` | `Besøgsmotiver:` | F.eks. "hygge-søgende", "familieudflug" |
| `marketing_focus` | `Markedsføringsfokus:` | Strategisk anbefaling fra location intel |
| `neighborhood` | Del af location-objekt | Sendes men bruges ikke eksplicit i prompten |
| `tourist_context` | `(turistzone)` | Tilføjes til lokationstype-label |
| `latitude` / `longitude` | Vejr-API-kald | Koordinater sendes til OpenWeatherMap |

**Operations** (`business_operations`):

| Felt | Bruges i prompten |
|---|---|
| `has_outdoor_seating` | "Har udeservering: Ja/Nej" + påvirker vejr-framing |
| `has_takeaway` | "Har takeaway: Ja/Nej" |
| `has_table_service` | "Har bordbetjening: Ja/Nej" |
| `preferred_posts_per_week` | Styrer antal foreslåede posts |

**Åbningstider** (`opening_hours`): Bruges til at filtrere hvilke ugedage der er gyldige post-dage. Lukkede dage fjernes fra `available_days`.

---

## 5. Tids- og Ugekontekst

Beregnet af funktionen selv (ingen DB):

| Felt | Indhold |
|---|---|
| `week_number` | ISO-ugenummer |
| `week_start` / `week_end` | Dato-interval |
| `available_days` | Ugedage filtreret på åbningstider |
| `is_current_week` | Boolean — påvirker urgency-framing |

---

## 6. Økonomisk Timing

**Kilde:** Beregnes fra dato (`calculateEconomicTiming`)

Fortæller AI'en om kontekstuel købekraft:

- `is_payday_week` — lønningsuge (typisk sidst i måneden)
- `is_summer_holiday` — juli-mode
- `is_july` — specifikt juli (tourist boost-logik)
- `month_position` — start/midt/slut på måneden
- `economic_narrative` — kort tekstblok til prompten

---

## 7. Events & Begivenheder

**Kilde:** `get_contextual_events` RPC (kontekstuel kalender, 2 uger frem)

Henter begivenheder filtreret på land + dato-interval:

- Navn, dato, `days_away` (dage til begivenheden)
- Type: `holiday` / `occasion` / `season_change` / `local`
- `content_angle` — strategisk vinkel fra kalenderen

Bruges i Phase 0 til "special_day"-faktorer og til at foreslå lead-up posts (f.eks. Valentinsdag 3-5 dage i forvejen).

---

## 8. Vejr

**Kilde:** OpenWeatherMap API (live 5-dages forecast via koordinater)

Fallback: Sæsonbaseret estimat hvis ingen koordinater.

| Felt | Bruges til |
|---|---|
| `pattern` | "Overskyet og regnfuldt", "Certi solskin" |
| `avg_temp` | Temperaturgennemsnit for ugen |
| `days[]` | Dag-for-dag nedbørs-chance + temperatur |
| `precipitation_chance` range | Variabelt vs. stabilt vejr — afgør framing |
| `wind_speed` range | Vind-kontekst til udesidderi |
| `has_outdoor_seating` | Kobles med vejret til outdoor-framing |

Vejr-blokken i prompten viser om vejret er stabilt eller variabelt (range vs. gennemsnit).

---

## 9. Sæson

**Kilde:** Beregnes fra dato + land (`getRealSeasonContext`)

- `current` — dansk sæsonnavn (f.eks. "tidlig forår", "sensommer")
- Bruges i lokations-blokken: *"Kombiner sæson (tidlig forår) med dominerende motiver"*

---

## 10. Forrige Uge (No-Repeat)

**Kilde:** `weekly_content_plans` (seneste post-plan)

| Felt | Bruges til |
|---|---|
| `posted_menu_items` | Undgå at gentage samme ret 2 uger i træk |
| `posted_content_types` | Undgå at gentage samme content-type |

> `data_available` er altid `false` — rigtig engagement-data (Facebook/Instagram API) er ikke koblet endnu.

---

## 11. Platforme & Abonnement

**Kilde:** `profiles` (selected_platforms) + `businesses` (subscription_tier)

| Felt | Indhold |
|---|---|
| `platforms` | `['facebook', 'instagram']` eller subset |
| `subscription_tier` | `smart` / `pro` |
| `preferred_posts_per_week` | 3–7 posts (fra business_operations) |

Platforme-konteksten bruges i Phase 2b til at tilpasse format og tone per platform.

---

## Hvad AI'en IKKE modtager (kendte huller)

| Manglende data | Konsekvens |
|---|---|
| `target_audience` (demografisk profil) | Generator-data er situationel tekst, ikke demografi — pålideligt datakvalitets-fix afventer generator-rewrite |
| AFTEN ai_summary for Café Faust | Aften-menuen mangler AI-opsummering; kun `structured_data` tilgængeligt |
| Facebook/Instagram engagement-data | `previousWeek.data_available` altid false — rigtig engagement-data ikke koblet |
| Booking-URL eller online bestillings-intent | Ingen booking-kontekst i prompten |

> **Bevidst fravalg (ikke et hul):** `core_offerings` sendes til prompten men vises ikke på Brand Profil-siden. Hospitality-virksomheder har et begrænset udvalg — at fremhæve det ville føre til repetitive AI-forslag og reducere indholdsvariation.

---

## Prompt-arkitektur (3 faser)

```
Phase 0  →  Kontekstuel analyse (vejr × events × timing → adfærds-insights)
Phase 1  →  Strategisk brief (insights + brand + menu → strategiske vinkler)
Phase 2  →  Content-plan (vinkler → konkrete post-ideer per dag/platform)
   └─ 2a: Strategiske vinkler
   └─ 2b: Post-ideer
   └─ 2c: Brugerfacing summary + reasoning
```

Al data fra de 11 kilder ovenfor er tilgængelig fra Phase 0 og frem.
