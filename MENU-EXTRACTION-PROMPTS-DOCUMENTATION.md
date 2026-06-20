# Menu Extraction & Summarization System Documentation

**Route:** `http://localhost:3000/dashboard/menu`  
**Last Updated:** 21. maj 2026

---

## Overview

The menu system uses a 4-stage AI pipeline to extract, analyze, and summarize restaurant menus:

1. **Detailed Menu Extraction** — Extracts raw menu items (categories, dishes, prices)
2. **Individual Menu Summary** — Creates adaptive overview per menu (e.g., "AFTEN" menu)
3. **Cross-Menu Summary** — Synthesizes all menus into business-level overview
4. **Gastronomic Profile** — Ultra-short 1-2 sentence identity statement

### Prompt Philosophy (Updated 21. maj 2026)

**"Trust + Boundaries" Approach:**
- ✅ Sharp quality guards (no invention, categories not dishes, factual tone)
- ✅ Trust AI to assess complexity and adapt output
- ❌ Removed prescriptive counts (4-5 bullets, 100-150 words, simple café = 4 themes)
- ❌ Removed if-then logic and micromanagement

**Results:**
- Stage 2: 334 words → 55 words (84% reduction)
- Stage 3: 800 words → 120 words (85% reduction)
- Better adaptation to business types (coffee bars, wine bars, restaurants, hybrids)
- Quality guards maintained 100%

---

## 1. Detailed Menu Extraction

**Purpose:** Extract structured menu data from webpage/PDF content

**File:** `supabase/functions/_shared/ai-extractors/menu-extractor.ts`  
**Function:** `extractMenu()`  
**Model:** `gpt-4o` (premium model, ~70% of AI costs)  
**Temperature:** 0.0 (deterministic)

### Output Example
```json
{
  "menuStructure": [
    {
      "name": "FORRETTER",
      "timeRange": null,
      "items": [
        "MOULES MARINIERS",
        "CARPACCIO"
      ]
    },
    {
      "name": "HOVEDRETTER",
      "timeRange": null,
      "items": [
        "OVNBAGT LAKS",
        "BØF & BEARNAISE"
      ]
    }
  ],
  "dietaryOptions": ["vegetarian", "gluten-free"],
  "takeaway": true,
  "hasKidsMenu": true
}
```

### Key Prompt Instructions

```
CRITICAL RULES - MUST FOLLOW:
1. ONLY extract menu items that are EXPLICITLY WRITTEN in the content below
2. DO NOT make up menu items based on restaurant type or cuisine
3. DO NOT infer or guess dishes - if you can't find actual menu text, return empty array
4. Look for "=== PDF Menu" sections - these contain the actual menu text from PDF files
5. Menu items are usually listed with names and may include prices (e.g., "Smørrebrød 95 kr.")
6. Preserve EXACT dish names as they appear - do not translate or modify
7. Preserve EXACT category names (e.g., "BRUNCH", "FROKOST", "AFTEN", "TAPAS")
8. Look for time ranges in category names (e.g., "BRUNCH 09.00-12.00")

If the content below DOES NOT contain clear menu items with dish names, return:
{
  "menuStructure": [],
  "dietaryOptions": [],
  "takeaway": null,
  "delivery": null,
  "hasTableService": null,
  "reservationRequired": null,
  "hasKidsMenu": null
}
```

**System Prompt:**
```
You are a precise menu extraction expert. ONLY extract menu items that are 
explicitly written in the provided content. DO NOT invent, guess, or infer 
menu items. If no clear menu is found, return empty arrays. Return only 
valid JSON.
```

**Storage:** Raw data stored in `menu_results_v2.structured_data`

---

## 2. Individual Menu Summary

**Purpose:** Create 5-bullet point overview for each extracted menu

**File:** `supabase/functions/menu-extract-v2/index.ts`  
**Function:** `generateMenuSummary()` (lines 743-808)  
**Model:** `gpt-4o-mini` (cost-effective)  
**Temperature:** 0.3  
**Max Tokens:** 400

### Output Example
```
AFTEN
Fra: Aftenmenu
https://cafefaust.dk/menukort/aften/

38 items · Ø 139 DKK

• Omfattende udvalg af forretter, hovedretter og desserter
• Kategorierne dækker klassiske danske retter og moderne caféinspirationer
• Vegetariske og glutenfrie alternativer tilgængelige
• Drikketilbud omfatter både alkoholiske og alkoholfrie valg
• Børnemenu tilgængelig med flere kategorier
```

### Complete Prompt (Danish)

**System Prompt:**
```javascript
Du er menu-analytiker. Lav objektiv beskrivelse af menuens tilbud.

Regler:
- Beskriv kategorier og madtyper, aldrig specifikke retnavne
- Faktuel tone uden subjektive ord
- Opfind intet - kun hvad der fremgår
- Returner bullet-liste med •
```

**User Prompt:**
```javascript
Menu: "${menuTitle}"
${itemLines.join('\n')}

Beskriv hvad denne menu tilbyder.
```

**Philosophy:** 
- Short, sharp boundaries (quality guards)
- Trust AI to determine appropriate bullet count and structure
- Adapts to menu complexity (simple menu = fewer bullets, complex = more)
- Word count: ~55 words (was 334 words - 84% reduction)

**Storage:** Stored in `menu_results_v2.ai_summary`

**Triggered:** Automatically after menu extraction completes

---

## 3. Cross-Menu Summary

**Purpose:** Synthesize ALL menus into business-level overview + signature themes

**File:** `supabase/functions/_shared/brand-profile/menu-overview-summary.ts`  
**Function:** `generateCrossMenuSummary()` + `buildCrossMenuPrompt()`  
**Model:** `gpt-4o-mini`  
**Temperature:** 0.5 (balanced creativity)  
**Max Tokens:** 500

### Output Example
```json
{
  "cross_menu_summary": "• Bullet 1\n• Bullet 2\n...",
  "signature_themes": ["Brunch-specialist", "Casual dining", "Bar-program"],
  "total_items": 85,
  "total_menus": 3,
  "overall_avg_price": 145,
  "menu_breakdown": [...]
}
```

### Complete Prompt (Danish)

**User Prompt:**
```
Du er menu-analytiker der syntetiserer etablissementets menuudbud.

${businessName}
${menuBreakdownText}

Analyser kompleksitet og tilpas beskrivelsen:

VURDER:
- Bredde: Få kategorier eller bredt udvalg?
- Stil: Klassisk, moderne, fusion?
- Fokus: Mad, drikke, eller begge?
- Inklusivitet: Vegetar/allergi-tilgængelighed?

REGLER:
- Beskriv kategorier og madtyper, aldrig specifikke retnavne
- Faktuel tone - opfind intet
- Hold det koncist

SIGNATUR-TEMAER:
- Vælg 2-10 labels afhængigt af kompleksitet
- Simple steder = færre temaer, komplekse steder = flere
- Du må opfinde nye labels hvis de passer bedre

Tema-eksempler (inspiration): Kaffespecialist, Casual dining, 
Plantebaseret, Brunch-fokus

Returner JSON:
{
  "summary": "• Bullet 1\\n• Bullet 2\\n...",
  "signature_themes": ["Label 1", "Label 2", ...]
}
```

**System Prompt:**
```
Du er menu-analytiker der syntetiserer menuudbud til forbruger-information.

Regler:
- Beskriv kategorier og madtyper, aldrig specifikke retnavne
- Faktuel tone - opfind intet
- Returner valid JSON med "summary" og "signature_themes"

Kvalitet:
✅ "Klassiske danske retter inden for smørrebrød og hovedretter"
❌ "Pariserbøf og FAVORITTEN" (specifikke retnavne)
```

**Philosophy:**
- Short, sharp boundaries (quality guards)
- Trust AI to assess complexity and adapt
- Removed prescriptive counts (5-6 bullets, 4-8 themes, 100-150 words)
- Removed if-then logic (simple café = 4, hybrid = 8)
- Analytical frameworks guide thinking, not output
- Word count: ~120 words (was 800 words - 85% reduction)
2. Syntetiser på tværs af ALLE menuer - liste dem ikke individuelt
3. Beskriv KATEGORIER og MADTYPER - aldrig specifikke retnavne
4. Objektiv, neutral tone - INGEN subjektive ord (lækre, vidunderlig, 
   fantastisk)
5. Tænk analytisk (bredde/dybde, stil, pris) men skriv forbruger-venligt
6. INGEN menunavne (Brunch Menu), INGEN retnavne (Pariserbøf, FAVORITTEN)
7. Returner ALTID valid JSON med "summary" og "signature_themes"

OVERSIGT (summary):
• 5-6 bullet points med • symbol
• 100-150 ord totalt
• Beskrivende men neutral tone

SIGNATUR-TEMAER (signature_themes):
• 4-8 korte, præcise labels baseret på din analyse
• Tilpas antal efter etablissementets kompleksitet
• Du må opfinde nye labels hvis de passer bedre end eksemplerne

Kvalitetsmarkører:
✅ "Omfattende menuudvalg fra morgenmad til sen aften"
✅ "Klassiske danske retter inden for smørrebrød, varme hovedretter 
    og desserter"
✅ "Vegetariske og glutenfri alternativer tilgængelige"
✅ "Cocktailkort med klassiske drinks og moderne signaturer"
❌ "Lækre desserter..." (subjektivt sprog)
❌ "FAVORITTEN og DEN LUKSURIØSE BRUNCH..." (specifikke retnavne)
❌ "Pariserbøf og Faustburger..." (specifikke retnavne)
```

**Storage:** Stored in `business_brand_profile.menu_overview`

**Trigger:** Edge Function `menu-overview-summary`

---

## 4. Gastronomic Profile

**Purpose:** Ultra-short 1-2 sentence factual identity statement

**File:** `supabase/functions/_shared/brand-profile/menu-overview-summary.ts`  
**Function:** `generateGastronomicProfile()` (lines 393-455)  
**Model:** `gpt-4o-mini`  
**Temperature:** 0.3 (factual output)  
**Max Tokens:** 100

### Output Example
```
Mellemklasse casual dining med fokus på klassiske danske retter og 
internationale inspirationer. Prisvenligt og familieorienteret.
```

### Complete Prompt (Danish)

```
Tag følgende råpunkter om menukortet og lav en ultra-kort, faktuel 
profilering af stedets gastronomiske identitet på 1-2 sætninger. 
Vurder ud fra teksten, hvor de ligger på parametre som prisniveau 
(f.eks. budget, mellemklasse, high-end) og stil (f.eks. klassisk 
vs. moderne), og skær helt ind til benet uden salgsgas.

Menupunkter:
${crossMenuSummary}

Returner KUN 1-2 korte, faktuelle sætninger.
```

### System Prompt

```
Du er gastronomisk analytiker. Lav ultra-korte, faktuelle profiler 
uden salgsgas. 1-2 sætninger kun.
```

**Storage:** Stored in `business_brand_profile.gastronomic_profile`

**Database Migration:** See `ADD_GASTRONOMIC_PROFILE_COLUMN.sql`

---

## Data Flow

```
1. User clicks "Extract Menu" on /dashboard/menu
   ↓
2. Edge Function: menu-extract-v2
   ↓
3. AI: Detailed Menu Extraction (gpt-4o)
   → Stores in menu_results_v2.structured_data
   ↓
4. AI: Individual Menu Summary (gpt-4o-mini)
   → Stores in menu_results_v2.ai_summary
   ↓
5. Later: Edge Function menu-overview-summary
   ↓
6. AI: Cross-Menu Summary (gpt-4o-mini)
   → Aggregates all menu summaries
   ↓
7. AI: Gastronomic Profile (gpt-4o-mini)
   → Stores in business_brand_profile.menu_overview
   → Stores in business_brand_profile.gastronomic_profile
```

---

## Cost Structure

| Stage | Model | Approx. Cost | % of Total |
|-------|-------|--------------|------------|
| Detailed Extraction | gpt-4o | ~$0.015 | ~70% |
| Individual Summary | gpt-4o-mini | ~$0.001 | ~5% |
| Cross-Menu Summary | gpt-4o-mini | ~$0.0012 | ~6% |
| Gastronomic Profile | gpt-4o-mini | ~$0.0004 | ~2% |
| **Total per business** | | **~$0.018** | **100%** |

**Note:** Detailed extraction uses premium model (gpt-4o) due to complexity of menu structure understanding. This accounts for ~70% of AI costs.

---

## Key Files Reference

| File | Purpose | Lines |
|------|---------|-------|
| `supabase/functions/_shared/ai-extractors/menu-extractor.ts` | Detailed menu extraction prompt | 207-290 |
| `supabase/functions/menu-extract-v2/index.ts` | Individual menu summary prompt | 743-808 |
| `supabase/functions/_shared/brand-profile/menu-overview-summary.ts` | Cross-menu summary + gastronomic profile | 114-455 |
| `src/pages/dashboard/MenuPage.tsx` | Frontend UI component | 1-100+ |
| `ADD_GASTRONOMIC_PROFILE_COLUMN.sql` | Database migration | 1-29 |

---

## Quality Control

### Individual Menu Summary Validation
- ✅ Must have bullet points (• symbol)
- ✅ Category-focused descriptions (no specific dish names)
- ✅ Adaptive length (simple menu = concise, complex = comprehensive)
- ✅ Adaptive bullet count (typically 2-6, varies by complexity)
- ❌ No subjective language (lækre, hyggelig, fantastisk, afslappet)
- ❌ No target audience mentions (familier, par, børn)
- ❌ No atmosphere descriptions (hyggelig atmosfære, afslappet)
- ❌ No specific dish names (Pariserbøf, Moules Mariniers)

### Cross-Menu Summary Validation
- ✅ Must include "summary" and "signature_themes" in JSON
- ✅ Adaptive word count (simple = concise, complex = comprehensive)
- ✅ Adaptive theme count (2-10 themes based on complexity)
- ❌ No specific dish names
- ❌ No menu titles (e.g., "FAVORITTEN")
- ✅ Quality guards maintained, creative constraints removed

### Gastronomic Profile Validation
- ✅ 1-2 sentences only
- ✅ Max 100 tokens
- ✅ Factual, no sales language
- ✅ Must mention price level or style

---

## Database Schema

### menu_results_v2
```sql
CREATE TABLE menu_results_v2 (
  id UUID PRIMARY KEY,
  business_id UUID REFERENCES businesses(id),
  source_url TEXT,
  structured_data JSONB,      -- Raw extraction
  ai_summary TEXT,             -- Individual menu summary
  service_period_name TEXT,    -- e.g., "AFTEN"
  item_count INTEGER,
  average_price NUMERIC,
  status TEXT,
  created_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
```

### business_brand_profile
```sql
CREATE TABLE business_brand_profile (
  business_id UUID PRIMARY KEY,
  menu_overview JSONB,         -- Cross-menu summary + themes
  gastronomic_profile TEXT,    -- Ultra-short 1-2 sentence profile
  updated_at TIMESTAMPTZ
);
```

---

## Related Documentation

- `DASHBOARD-MENU-DATA-FLOW.md` — UI data flow
- `MENU-EXTRACTION-FIX-2025-01.md` — Extraction fixes
- `MENU-NORMALIZATION-IMPLEMENTATION-GUIDE.md` — Item normalization
- `AI-PROMPT-MIGRATION-COMPLETE.md` — Prompt migration history
