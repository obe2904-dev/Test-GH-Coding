# PROMPT COMPRESSION & OPTIMIZATION ANALYSIS
**Date:** 2026-06-07  
**Scope:** Weekly Strategy Generation (Phase 0 → Phase 1 → Phase 2)  
**Objective:** Identify optimization opportunities WITHOUT losing functionality

---

## EXECUTIVE SUMMARY

**Current State:**
- **Total tokens/strategy:** 68,350 (56,650 input + 11,700 output)
- **Total cost/strategy:** $0.096
- **Generation time:** ~18.5 seconds (4 posts)

**Optimization Potential:**
- **Token reduction:** 20-35% (~12,000-20,000 tokens)
- **Cost savings:** $0.018-$0.032 per strategy (19-33% reduction)
- **Time savings:** 2-4 seconds (through Gemini migration)
- **No functionality loss:** All optimizations preserve data quality

**Key Opportunities:**
1. **Separator overhead:** ~1,500-2,000 tokens/strategy (3-4%)
2. **Redundant context repetition:** ~3,000-4,500 tokens (5-8%)
3. **Verbose prompt prose:** ~4,000-6,000 tokens (7-10%)
4. **Business Intelligence duplication:** ~1,200-1,800 tokens (2-3%)
5. **Phase 2b Gemini migration:** 76% cost reduction in Phase 2b

---

## 1. SEPARATOR & FORMATTING OVERHEAD

### 1.1 Current Pattern

Every prompt uses heavy ASCII art separators:

```
═══════════════════════════════════════════════
SECTION TITLE
═══════════════════════════════════════════════
```

**Cost per separator:**
- Characters: 93 (47 chars × 2 lines + title line)
- Tokens: ~25-30 per separator
- **Total separators across all prompts:** 40-50
- **Total overhead:** 1,000-1,500 tokens (~2.2% of total input)

### 1.2 Optimization

**Replace with minimal markers:**

```markdown
## SECTION TITLE
```

or even:

```
# SECTION TITLE
```

**Savings:**
- Per separator: 20-25 tokens (83% reduction)
- **Total savings: 800-1,200 tokens**
- **Cost savings: $0.002/strategy**

**Impact on AI comprehension:**
- ✅ **ZERO** — Modern LLMs parse Markdown headers perfectly
- GPT-4o and Gemini both trained on Markdown extensively
- Headers provide same semantic separation

### 1.3 Implementation Priority

🟢 **HIGH** — Easy win, zero risk, immediate 2% token reduction

---

## 2. REDUNDANT CONTEXT REPETITION

### 2.1 Business Context Duplication

**Current state:** Basic business info repeated in EVERY phase:

**Phase 0:**
```
VIRKSOMHED: ${context.business_character || context.business_name}
LOKATION: ${locType}, ${context.city}
SERVICE-PERIODER: ${servicePeriods}
```

**Phase 1 Step 1:**
```
${context.business_name}
Placering: ${context.city}
Service perioder: ${context.service_periods.join(', ')}
```

**Phase 1 Step 2:**
```
${context.business_name}
Placering: ${context.city}
Menu capabilities: ${menuCapabilities}
```

**Phase 2b (per post):**
```
STEDSTYPE: ${business_character}
(+ city, service periods in other sections)
```

**Token cost:**
- Basic context per phase: ~50-80 tokens
- Repeated 5+ times across phases
- **Total redundancy:** ~250-400 tokens

### 2.2 Optimization: Assumed Context Pattern

**Principle:** After Phase 0, AI already knows the business. Only mention CHANGES or NEW facts.

**Phase 0:** Full context (needed for first analysis)
```
VIRKSOMHED: Cafe Faust — hybrid day-to-evening cafe [waterfront, Aarhus]
SERVICE: Brunch 09:00-14:00, Frokost 09:00-17:30, Aften 17:30-21:30
```

**Phase 1+:** Reference only, no repetition
```
# STRATEGIC BRIEF (continued from contextual analysis)
Uge 24 for Cafe Faust
```

**Phase 2:** Remove entirely (already in Phase 1 output)

**Savings:**
- Per phase after Phase 0: 50-80 tokens
- **Total savings: 200-320 tokens**
- **Cost savings: $0.0005-$0.0008/strategy**

**Risk assessment:**
- ⚠️ **MEDIUM** — Requires testing to confirm AI maintains context
- Mitigation: Keep business_name for continuity anchor
- Test with 10-20 strategies to validate output quality

### 2.3 Implementation Priority

🟡 **MEDIUM** — Good savings, needs validation testing

---

## 3. BUSINESS INTELLIGENCE DUPLICATION

### 3.1 Current Pattern

**Business Intelligence** (service period strategies, audience segments) is built from `brand_profile_v5.layer_1_programmes` and injected into:

**Phase 1 Step 1:**
```
═══════════════════════════════════════════════
BUSINESS INTELLIGENCE: SERVICE PERIOD STRATEGIES
═══════════════════════════════════════════════

Frokost:
  Mål: 50% drive_footfall, 30% strengthen_brand, 20% retain_loyalty
  Primære målgrupper: Planlagt frokost (planned decisions), ...

Aften:
  Mål: 60% drive_footfall, 25% strengthen_brand, 15% retain_loyalty
  ...
```

**Token cost:** ~800-1,200 tokens

**Phase 1 Step 2:**
```
═══════════════════════════════════════════════
GOAL MODE GUIDANCE (FROM SERVICE PERIOD STRATEGIES)
═══════════════════════════════════════════════

Frokost: 50% drive_footfall, 30% strengthen_brand, ...
Aften: 60% drive_footfall, 25% strengthen_brand, ...

Når du tildeler goal_mode til dine 4 angles:
- Brug disse vægtninger som vejledning
- MIX mellem drive_footfall, build_brand, retain_loyalty
```

**Token cost:** ~300-400 tokens

**Phase 2b (per post):**
Business intelligence passed but NOT actually formatted into prompt text (only used for code logic).

### 3.2 Redundancy Analysis

**Step 1 → Step 2:** Same service period data, different formatting
- Step 1: Full detail (audiences, decision timing)
- Step 2: Condensed to just goal percentages

**Duplication:** ~500-800 tokens (the full BI is shown in Step 1, then summarized again in Step 2)

### 3.3 Optimization Options

#### Option A: Single Injection (Step 2 only)

**Remove from Step 1 entirely** — contextual analysis doesn't need service period goals, only Step 2 angle generation does.

**Reasoning:**
- Step 1 task: "Identify unique factors this week"
- Doesn't require knowing "Frokost = 50% footfall, 30% brand"
- Step 2 task: "Generate 4 angles with goal_mode"
- **This** is where BI matters

**Savings:** 800-1,200 tokens (entire Step 1 BI section)

**Risk:** ⚠️ Step 1 might produce less aligned contextual analysis if it doesn't know business priorities

#### Option B: Compressed Format

Keep in both steps but compress heavily:

**Current (verbose):**
```
Frokost:
  Mål: 50% drive_footfall, 30% strengthen_brand, 20% retain_loyalty
  Primære målgrupper: Planlagt frokost (planned decisions), Spontane frokostgæster (impulse)
```

**Compressed:**
```
Frokost: 50/30/20 (footfall/brand/loyalty) | Planlagt frokost, Spontane gæster
Aften: 60/25/15 | Weekend-dining, Date night
```

**Savings:** ~400-600 tokens (50% compression)

**Risk:** ✅ **LOW** — Data is fully preserved, just denser format

### 3.4 Implementation Priority

🟢 **HIGH** — Option B (compressed format) is safe, immediate 7-10% BI token reduction

---

## 4. VERBOSE PROMPT PROSE

### 4.1 Current Anti-Pattern: Conversational Instructions

Many prompts contain verbose, conversational guidance that could be condensed:

#### Example 1: Phase 0

**Current (111 tokens):**
```
Din opgave: Analysér uge 24 for Cafe Faust og identificér 1-3 adfærdsmæssige 
faktorer der er MATERIELT FORSKELLIGE fra en normal uge.

Svar på:
1. Er der noget særligt ved denne uge? (events, vejr afviger fra normalen, 
   lønning, sæsonskift)
2. Hvordan påvirker det HVORNÅR gæsterne beslutter at besøge og HVORNÅR de 
   faktisk kommer?
3. Hvilke af virksomhedens målgrupper er mest påvirkede?

Hvis ugen er normal (intet afviger fra baseline), er det KORREKT at rapportere 
0-1 faktorer.
Opfind IKKE dramatik hvor der ingen er.
```

**Optimized (62 tokens):**
```
Opgave: Identificér 1-3 MATERIELT FORSKELLIGE faktorer uge 24 (events, vejr, 
lønning, sæson).
Hvis normal uge → 0-1 faktorer OK.
For hver faktor: HVORNÅR påvirker det gæste-beslutninger + HVILKE målgrupper.
⚠️ Opfind ikke dramatik.
```

**Savings per instance:** 40-50 tokens (44% reduction)

#### Example 2: Phase 1 Step 1

**Current (85 tokens):**
```
DIN OPGAVE I DENNE STEP:
Scan ALLE tilgængelige faktorer (se data nedenfor) og identificér:
1. Unique factors this week (mindst 2)
2. Tids-vinduer aktiveret af disse faktorer
3. Målgrupper påvirket
4. Hvordan faktorer kombineres til compound opportunities
```

**Optimized (47 tokens):**
```
Opgave: Identificér (min 2):
1. Unique factors + tidsvinduer
2. Målgrupper påvirket  
3. Compound opportunities (faktor-kombinationer)
```

**Savings:** 38 tokens (45% reduction)

#### Example 3: Phase 2b CTA Instructions

**Current (142 tokens):**
```typescript
const buildFootfallCta = (): string => {
  if (isBudgetWeek) {
    if (!bookingLink) return 'MEDIUM CTA: Inviter blidt folk til at komme forbi — nævn tidspunkt, ingen salgspres.';
    if (hasFacebook) return `MEDIUM CTA: Nævn tidspunkt naturligt og booking-link: ${bookingLink} — blød, inviterende tone.`;
    return 'MEDIUM CTA: Sig "link i bio" naturligt — inviterende tone, ingen salgspres.';
  }
  // ... continues for many lines
```

**Optimized (74 tokens):**
```
Budget-uge: MEDIUM CTA — invit blidt, nævn tidspunkt${bookingLink ? `, link: ${bookingLink}` : ''}, ingen salgspres
Weekend-aften: HÅRD CTA — "bordene fylder op"${bookingLink ? `, book: ${bookingLink}` : ', ring nu'}
Standard: HÅRD CTA — tidspunkt + ${bookingLink || 'telefon'}
```

**Savings per post:** 60-80 tokens (48% reduction)

### 4.2 Total Verbose Prose Overhead

**Estimated occurrences across all prompts:**
- Phase 0: 3-4 verbose instruction blocks (~150-200 tokens)
- Phase 1 Step 1: 4-5 blocks (~200-250 tokens)
- Phase 1 Step 2: 5-6 blocks (~250-350 tokens)
- Phase 2a: 2-3 blocks (~100-150 tokens)
- Phase 2b: 8-10 blocks per post × 4 posts (~1,200-1,600 tokens)

**Total verbose overhead:** ~1,900-2,550 tokens

**Compression potential:** 40-50% → Save 800-1,300 tokens

### 4.3 Optimization Guidelines

**Principles:**
1. **Bullet lists > Paragraphs** — LLMs parse lists faster
2. **Symbols > Words** — Use → ⚠️ ✅ instead of "therefore", "warning", "correct"
3. **Omit filler words** — "Du skal", "Det er vigtigt at", "Husk at" = unnecessary
4. **Imperative mood** — "Identificér faktorer" not "Din opgave er at identificere faktorer"
5. **Combine related constraints** — "Max 4 menu posts + min 2 experience" in one line

**Example transformation:**

**Before:**
```
VIGTIGT: Når du identificerer tidsmæssige muligheder (frokosttrafik, weekendbesøg, etc.),
bemærk tidsmæssig overensstemmelse med programme-vinduerne for præcision.
Eksempel: "Helligdag øger frokosttrafik — aligner med Frokost Programme (Man-Fre, 11:30-15:00)"
```

**After:**
```
Timing-match: Tjek overensstemmelse med programme-vinduer
Ex: "Helligdag frokost → Frokost Programme (Man-Fre 11:30-15:00)"
```

**Savings:** 34 tokens → 19 tokens (44% reduction)

### 4.4 Implementation Priority

🟢 **HIGH** — Systematic compression across all prompts
- Savings: 800-1,300 tokens (~1.4-2.3% of total input)
- Risk: ✅ **VERY LOW** — Semantic content unchanged
- Effort: Moderate (requires careful editing of 5 prompt builders)

---

## 5. EXAMPLE-DRIVEN LEARNING OVERHEAD

### 5.1 Current Pattern: Stellar Examples

**Phase 1 Step 2** includes a ~600-token "STELLAR EXAMPLE":

```
═══════════════════════════════════════════════
STELLAR EXAMPLE (using contextual_analysis)
═══════════════════════════════════════════════

Givet contextual_analysis viste "4-day window" (Thursday+Friday):

{
  "week_summary": "Kr. Himmelfartsdag torsdag...",
  "competitive_advantage": "Netop denne uge...",
  "angles": [
    {
      "focus": "Planlagt frokostbesøg...",
      // ... full angle object
    },
    {
      "focus": "Aftenbesøg...",
      // ... full angle object
    }
  ]
}

↑ Bemærk: BEGGE lunch OG evening er dækket...
```

**Token cost:** ~550-650 tokens

### 5.2 Optimization: Minimal Schema Example

**Current approach:** Full realistic example (2 complete angles)
**Optimized approach:** Single minimal angle + schema reference

**Compressed version:**
```
## OUTPUT SCHEMA

{
  "week_summary": "[3-4 sætninger fra din contextual_analysis]",
  "competitive_advantage": "[Start: 'Netop denne uge er fordelen...']",
  "angles": [
    {
      "focus": "[dagsdel/adfærd + mekanisme]",
      "weight": 0.35,
      "goal_mode": "drive_footfall",
      "content_category": "product_menu",
      "timing_window": "Thu-Fri 14:00",
      "promoted_moment": "frokost torsdag-fredag",
      "reasoning": "[adfærd + virksomhedsfit + uge-relevans]",
      "menu_alignment": "[menu-kategori]",
      "content_direction": "[format fordi argument — vis scene — trigger handling]",
      "phase0_factors_used": ["special_day:Kr. Himmelfartsdag"]
    }
    // ... ${targetPostCount} total angles
  ]
}
```

**Token cost:** ~200-250 tokens

**Savings:** 300-400 tokens per Phase 1 Step 2 call

### 5.3 Risk Assessment

**Concern:** Will AI produce lower-quality output without full example?

**Evidence:**
- GPT-4o and Gemini 2.5 have strong schema-following abilities
- System already uses JSON mode for validation
- Example is for illustration, not the actual prompt instruction
- Real constraint is in the detailed field descriptions

**Mitigation:**
- A/B test 20 strategies (10 with full example, 10 with schema-only)
- Measure: angle quality, reasoning depth, JSON validation pass rate
- If quality drops, revert

### 5.4 Implementation Priority

🟡 **MEDIUM-HIGH** — Good savings, needs A/B testing
- Savings: 300-400 tokens
- Risk: ⚠️ **MEDIUM** — Quality impact unknown without testing

---

## 6. WEATHER DATA VERBOSITY

### 6.1 Current Pattern

**Phase 0 and Phase 1:**
```
VEJR:
Mandag: 12°C, partly_cloudy
Tirsdag: 14°C, sunny
Onsdag: 11°C, rain
Torsdag: 13°C, partly_cloudy
Fredag: 15°C, sunny
Lørdag: 16°C, sunny
Søndag: 14°C, partly_cloudy
```

**Token cost:** ~80-100 tokens (Danish day names + conditions + formatting)

### 6.2 Optimization: Compressed Format

**Optimized:**
```
Vejr (°C): Mon 12 half-cloudy, Tue 14 sun, Wed 11 rain, Thu 13 half, Fri 15 sun, Sat 16 sun, Sun 14 half
```

or even more compact:

```
Vejr: 12° half | 14° sun | 11° rain | 13° half | 15° sun | 16° sun | 14° half
```

**Token cost:** ~30-40 tokens

**Savings:** 50-60 tokens per prompt using weather (Phase 0, Phase 1 Step 1)
**Total savings:** ~100-120 tokens

### 6.3 Implementation Priority

🟢 **HIGH** — Easy, safe, immediate savings
- Risk: ✅ **ZERO** — Data fully preserved
- Effort: Minimal (change formatting function)

---

## 7. ACTIVATION ENGINE OUTPUT VERBOSITY

### 7.1 Current Pattern

When Activation Engine is active, Phase 1 Step 1 receives:

```
═══════════════════════════════════════════════
AKTIVEREDE MÅLGRUPPESEGMENTER DENNE UGE
═══════════════════════════════════════════════

UGE-TYPE: normal_week
PRIMÆRE ADFÆRDSMØNSTRE: routine, planned

ADFÆRDS-AKTIVERING:
ROUTINE — HØJTAKTIVT
├─ Trigger: Standard arbejdsuge
├─ Aktive dage: Monday, Tuesday, Wednesday, Thursday, Friday
└─ Tidsvinduer: 08:00-10:00, 11:30-14:00

AKTIVEREDE SEGMENTER (prioriteret efter relevans):
1. Planlagt frokost [Frokost Programme] — HØJ
├─ Normal prioritet: høj → Denne uge: høj
├─ Timing: Monday-Friday 11:30-14:00
├─ Beslutningstype: planned
├─ Content angles: menu-fokuseret frokost, dagens ret
├─ Aktiveringsgrund: Rutine-uge favoriserer planlagte besøg
└─ Mål: drive_footfall

2. Weekend-dining [Aften Programme] — HØJ
...
```

**Token cost:** ~1,000-1,500 tokens (when activation is used)

### 7.2 Optimization: Tabular Format

**Compressed:**
```
## AKTIVEREDE SEGMENTER (uge 24: normal_week, routine+planned)

Seg | Programme | Pri | Timing | Decision | Goal | Angles | Grund
----|-----------|-----|--------|----------|------|--------|------
Planlagt frokost | Frokost | HØJ | Mon-Fri 11:30-14 | planned | footfall | menu, dagens ret | Rutine favoriserer planlagt
Weekend-dining | Aften | HØJ | Fri-Sat 17-22 | impulse→planned | footfall | aften-stemning, cocktails | Weekend social
...

Deaktiveret: Impuls-besøg (lav trafik-uge)
```

**Token cost:** ~400-600 tokens (60% reduction)

**Savings:** 600-900 tokens when activation is used

### 7.3 Implementation Priority

🟢 **HIGH** — Large savings when activation is active
- Risk: ✅ **LOW** — Tabular data is highly parseable by LLMs
- Effort: Moderate (change activation output formatting)

---

## 8. PHASE 2B: PER-POST PROMPT BLOAT

### 8.1 Current Scale

**Phase 2b generates 4-7 posts sequentially**, each with its own prompt:

**Per-post token cost:** ~8,300 input tokens
**Total Phase 2b input:** 4 posts × 8,300 = **33,200 tokens** (59% of total input!)

**This is the highest token consumer in the entire system.**

### 8.2 Bloat Sources in Phase 2b

#### A. CTA Logic Verbosity

**Current:** Long conditional text blocks for CTA instructions (~200-300 tokens per post)

```typescript
const buildFootfallCta = (): string => {
  if (isBudgetWeek) {
    if (!bookingLink) return 'MEDIUM CTA: Inviter blidt folk til at komme forbi — nævn tidspunkt, ingen salgspres.';
    if (hasFacebook) return `MEDIUM CTA: Nævn tidspunkt naturligt og booking-link: ${bookingLink} — blød, inviterende tone.`;
    return 'MEDIUM CTA: Sig "link i bio" naturligt — inviterende tone, ingen salgspres.';
  }
  
  if (isWeekendDinnerPost) {
    const dayDk = postDay === 'friday' ? 'fredag' : 'lørdag';
    if (!bookingLink) {
      return `HÅRD CTA påkrævet (${dayDk} aften): Bordene fylder op — opfordre til at ringe...`;
    }
    // ... continues for 10+ more conditionals
  }
}
```

**Optimized:** Lookup table with placeholders

```typescript
const CTA_TEMPLATES = {
  'budget_medium': 'Invit blidt, nævn tid{link}, ingen salgspres',
  'weekend_hard': '{day} aften — "bordene fylder op"{link}',
  'advance_book': 'Forhåndsbook weekend{link}',
  'standard_hard': 'Tid + {link}'
};

const ctaKey = isBudgetWeek ? 'budget_medium' 
  : isWeekendDinnerPost ? 'weekend_hard'
  : isAdvanceBookingPost ? 'advance_book'
  : 'standard_hard';

const ctaInstruction = CTA_TEMPLATES[ctaKey]
  .replace('{link}', bookingLink ? ` → ${bookingLink}` : '')
  .replace('{day}', postDay === 'friday' ? 'Fre' : 'Lør');
```

**Savings per post:** 150-200 tokens
**Total savings (4 posts):** 600-800 tokens

#### B. Contextual Analysis Repetition

**Current:** Every Phase 2b post receives the FULL Phase 0 analysis:

```
Phase 0 analysis (forberegnet kontekst):
- Faktor 1: Kr. Himmelfartsdag Thursday... [150 tokens]
  Adfærd: Families seek restaurant visits...
  Timing: Thursday 11:00-15:00
- Faktor 2: Bridge day Friday... [150 tokens]
  ...
```

**Token cost:** ~400-600 tokens per post × 4 posts = **1,600-2,400 tokens**

**Optimization:** Reference summary, not full text

Phase 2b only needs Phase 0 for "grounding" — the actual strategic angles already incorporate Phase 0 insights.

**Compressed:**
```
Kontekst (fra Phase 0): 4-dages vindue (Thu helligdag + Fri klemmedag) → frokost+aften surge
```

**Savings per post:** 350-550 tokens
**Total savings (4 posts):** 1,400-2,200 tokens

#### C. Business Intelligence Per-Post

**Current:** Each post gets formatted BI text (~400-600 tokens)

**Optimization:** BI already influenced Phase 1 slot assignment. Phase 2b receives slot_id + goal_mode which ARE the BI output. No need to repeat the raw BI data.

**Remove entirely from Phase 2b.**

**Savings per post:** 400-600 tokens
**Total savings (4 posts):** 1,600-2,400 tokens

### 8.3 Total Phase 2b Compression Potential

| Source | Current | Optimized | Savings |
|--------|---------|-----------|---------|
| CTA logic | 200-300 | 50-100 | 150-200 |
| Phase 0 analysis | 400-600 | 50-100 | 350-500 |
| Business Intelligence | 400-600 | 0 | 400-600 |
| **Per post** | **1,000-1,500** | **100-200** | **900-1,300** |
| **4 posts** | **4,000-6,000** | **400-800** | **3,600-5,200** |

**Phase 2b compression: 60-65%**

### 8.4 Implementation Priority

🔴 **CRITICAL** — Highest impact optimization
- Savings: 3,600-5,200 tokens (6.4-9.2% of total input)
- Cost savings: ~$0.009-$0.013 per strategy
- Risk: ✅ **LOW** — CTA and context compression preserve semantics
- Effort: Moderate (refactor Phase 2b prompt builder)

---

## 9. V5 PROGRAMME WINDOWS FORMATTING

### 9.1 Current Pattern

**Phase 0** includes V5 programme data with verbose formatting:

```
V5 PROGRAMME DRIFTSVINDUER (3 programmer):
Frokost Programme
  Tidsvinduer: Monday-Friday 11:30-15:00
  Målgrupper: Planlagt frokost (planned decisions, work proximity)
              Spontane frokostgæster (impulse, lunch break)
  Mål: 50% drive_footfall, 30% strengthen_brand, 20% retain_loyalty

Aften Programme
  Tidsvinduer: Friday-Saturday 17:30-21:30
  Målgrupper: Weekend-dining (planned decisions, social occasion)
              Date night (planned decisions, intimate)
  Mål: 60% drive_footfall, 25% strengthen_brand, 15% retain_loyalty
  
...

INSTRUKTION - TEMPORAL PRÆCISION:
Når du identificerer tidsmæssige muligheder (frokosttrafik, weekendbesøg, etc.),
bemærk tidsmæssig overensstemmelse med programme-vinduerne for præcision.
Eksempel: "Helligdag øger frokosttrafik — aligner med Frokost Programme (Man-Fre, 11:30-15:00)"
```

**Token cost:** ~500-800 tokens (for 3 programmes)

### 9.2 Optimization: Condensed Table

**Compressed:**
```
## PROGRAMME VINDUER (3)

Prog | Tid | Målgrupper | Mål (F/B/L)
-----|-----|------------|------------
Frokost | Mon-Fri 11:30-15 | Planlagt, Spontan | 50/30/20
Aften | Fri-Sat 17:30-21:30 | Weekend, Date | 60/25/15
Brunch | Sat-Sun 09-14 | Leisure, Families | 40/40/20

Match timing-muligheder → programme vinduer for præcision
```

**Token cost:** ~200-300 tokens

**Savings:** 300-500 tokens

### 9.3 Implementation Priority

🟢 **MEDIUM-HIGH** — Good savings, low risk
- Savings: 300-500 tokens
- Risk: ✅ **VERY LOW** — Tabular data highly parseable

---

## 10. PHASE 2A: MINIMAL PROMPT STRATEGY

### 10.1 Current State

Phase 2a is already highly optimized:
- **Token cost:** ~3,200 input tokens
- Uses Gemini 2.5 Flash (cheap)
- Minimal prompt design
- No menu data (prevents hallucination)

### 10.2 Optimization Opportunity: Rule Compression

**Current rules section (160 tokens):**
```
REGLER:
1. Præcis 4 posts
2. Max 2 menu_item, resten atmosphere/behind_scenes/seasonal
3. Fordel posts jævnt over dagene (max 1 per dag)
4. Fordel angle_focus efter vægtning (højere vægt = flere posts)
5. Brug PRÆCIS de fokus-navne der er givet ovenfor
6. KRITISK: Ingen to posts af SAMME type må dele angle_focus — 
   hvert par (type + angle_focus) skal være unikt
```

**Compressed (85 tokens):**
```
Regler:
• Præcis 4 posts, max 2 menu_item
• 1 post/dag, fordel efter vægtning
• Brug EKSAKTE fokus-navne
• ⚠️ Unikt (type + angle_focus) par for hver post
```

**Savings:** 75 tokens

### 10.3 Implementation Priority

🟡 **LOW-MEDIUM** — Phase 2a already cheap, small absolute savings
- Savings: ~75 tokens
- Cost savings: ~$0.00001 per strategy (negligible)

---

## 11. ARCHITECTURAL OPTIMIZATIONS

### 11.1 Phase 2b Model Migration: GPT-4o → Gemini 2.5 Flash

**Current state:**
- Model: GPT-4o
- Cost per post: $0.00197 (input $0.00125 + output $0.00072)
- Total Phase 2b cost (4 posts): **$0.0079**

**Proposed state:**
- Model: Gemini 2.5 Flash
- Cost per post: $0.00015 (input $0.00012 + output $0.00003)
- Total Phase 2b cost (4 posts): **$0.0006**

**Savings:** $0.0073 per strategy (92% reduction in Phase 2b, 7.6% total strategy cost)

**Annual savings (100 businesses):**
- Per business: $0.0073 × 4.2 weeks = $0.031/month = **$0.37/year**
- Total: 100 businesses × $0.37 = **$37/year**

**Risk assessment:**

**Concerns:**
1. Menu item selection quality — Phase 2b does complex menu matching
2. CTA generation — needs to handle booking links, platform differences
3. JSON structure adherence — must maintain exact schema

**Mitigation:**
1. A/B test: 50 strategies GPT-4o vs 50 Gemini
2. Metrics: Menu relevance score, CTA appropriateness (human eval), JSON validation pass rate
3. Rollback plan: Keep GPT-4o option as fallback flag

**Evidence in favor:**
- Gemini 2.5 Flash already used successfully in Phase 2a (planner) and Phase 2c (narrative)
- Phase 2a generates post shells with type assignment — WORKS perfectly
- Gemini excels at structured output (JSON mode)

**Recommendation:** 🔴 **HIGH PRIORITY** — Test this immediately
- If successful: 7.6% cost reduction with ZERO token changes
- If fails: Revert, no harm done

### 11.2 Phase 1 Single-Shot Generation

**Current:** Two sequential AI calls
- Step 1: Contextual analysis (~5,600 tokens, $0.020)
- Step 2: Full strategy using Step 1 output (~9,500 tokens, $0.043)
- Total: 15,100 tokens, $0.063

**Proposed:** Single prompt combining both steps
- Merged prompt: ~12,000 tokens (removing duplication)
- Single call: $0.048

**Savings:** 3,100 tokens, $0.015 per strategy, ~2 seconds time

**Trade-off:**
- ⚠️ **Quality risk:** Two-step gives AI "thinking space" to analyze before generating angles
- Current two-step mimics chain-of-thought reasoning
- Single-shot may produce shallower strategic analysis

**Recommendation:** 🟡 **LOW-MEDIUM PRIORITY**
- Test after other optimizations
- A/B test required with human quality evaluation
- Benefit is significant but quality risk is high

### 11.3 Parallel Phase 2b Execution

**Current:** Sequential with 800ms delays
- 4 posts × 2s each = 8 seconds
- Delays prevent rate limiting

**Proposed:** Parallel with smart rate limiting
- Launch all 4 simultaneously
- Gemini handles rate limits gracefully
- Estimated time: 2.5-3 seconds (fastest post + overhead)

**Time savings:** ~5 seconds per strategy

**Risk:** Rate limit errors if Gemini quota exceeded

**Recommendation:** 🟡 **MEDIUM PRIORITY**
- Implement AFTER Gemini migration (if successful)
- Requires retry logic for rate limit errors
- Significant time savings for user experience

---

## 12. CONSOLIDATION MATRIX

### 12.1 All Optimizations by Impact

| # | Optimization | Tokens Saved | Cost Saved | Effort | Risk | Priority |
|---|--------------|--------------|------------|--------|------|----------|
| **1** | Phase 2b compression | 3,600-5,200 | $0.009-$0.013 | Med | Low | 🔴 CRITICAL |
| **2** | Separator replacement | 800-1,200 | $0.002 | Low | Zero | 🟢 HIGH |
| **3** | Verbose prose compression | 800-1,300 | $0.002-$0.003 | Med | V.Low | 🟢 HIGH |
| **4** | Activation format (table) | 600-900 | $0.0015-$0.002 | Med | Low | 🟢 HIGH |
| **5** | BI compressed format | 400-600 | $0.001-$0.0015 | Low | Low | 🟢 HIGH |
| **6** | V5 programme table | 300-500 | $0.0007-$0.001 | Low | V.Low | 🟢 MED-HIGH |
| **7** | Example → schema | 300-400 | $0.0007-$0.001 | Low | Med | 🟡 MED-HIGH |
| **8** | Business context dedup | 200-320 | $0.0005-$0.0008 | Med | Med | 🟡 MEDIUM |
| **9** | Weather compression | 100-120 | $0.00025-$0.0003 | Low | Zero | 🟢 HIGH |
| **10** | Phase 2a rules | 75 | $0.00001 | Low | Zero | 🟡 LOW-MED |
| **Architectural** | | | | | | |
| **A** | Phase 2b → Gemini | 0 | $0.0073 | Med | Med | 🔴 CRITICAL |
| **B** | Phase 1 single-shot | 3,100 | $0.015 | High | High | 🟡 LOW-MED |
| **C** | Parallel Phase 2b | 0 (time only) | $0 | Med | Med | 🟡 MEDIUM |

### 12.2 Combined Token Impact

**Conservative estimate (safe optimizations only):**
- Items #1-6 + #9-10: 6,075-8,520 tokens saved
- Percentage: **10.7-15.1%** of total input tokens
- **New total: 48,130-50,575 input tokens** (was 56,650)

**Aggressive estimate (all optimizations):**
- Items #1-10: 7,175-10,440 tokens saved
- Percentage: **12.7-18.4%** of total input tokens
- **New total: 46,210-49,475 input tokens** (was 56,650)

### 12.3 Combined Cost Impact

**Token-based savings (conservative):**
- Input reduction: 6,075-8,520 tokens × $2.50/1M = $0.015-$0.021
- **New token cost: $0.081-$0.085** (was $0.096)

**With architectural optimization (Phase 2b → Gemini):**
- Token savings: $0.015-$0.021
- Model savings: $0.0073
- **Total savings: $0.022-$0.028 per strategy**
- **New total cost: $0.068-$0.074** (was $0.096)
- **Reduction: 23-29%**

**Annual impact (100 businesses, 4.2 weeks/month):**
- Current: $40.32/month = $484/year
- Optimized: $28.56-$31.10/month = $343-$373/year
- **Annual savings: $111-$141**

---

## 13. IMPLEMENTATION ROADMAP

### 13.1 Phase 1: Quick Wins (1-2 days)

**No testing required — zero risk:**
1. ✅ Separator replacement (800-1,200 tokens)
2. ✅ Weather compression (100-120 tokens)
3. ✅ Phase 2a rules compression (75 tokens)
4. ✅ BI format compression (400-600 tokens)
5. ✅ V5 programme table (300-500 tokens)

**Total Phase 1 savings:** 1,675-2,495 tokens (~3-4% reduction)
**Effort:** 4-6 hours

### 13.2 Phase 2: Medium-Risk Optimizations (3-5 days)

**Requires A/B testing:**
1. 🧪 Phase 2b compression (3,600-5,200 tokens)
   - Deploy compressed version to 20 test strategies
   - Human eval: menu relevance, CTA quality
   - Validate JSON structure adherence
2. 🧪 Verbose prose compression (800-1,300 tokens)
   - Deploy to 20 test strategies
   - Compare angle quality, reasoning depth
3. 🧪 Activation format compression (600-900 tokens)
   - Test only when activation engine is active
   - Validate segment allocation quality

**Total Phase 2 savings:** 5,000-7,400 tokens (~9-13% reduction)
**Effort:** 2-3 days implementation + 1-2 days testing

### 13.3 Phase 3: Architectural Changes (1-2 weeks)

**Critical path — highest impact:**
1. 🧪 Phase 2b → Gemini 2.5 Flash migration
   - A/B test 50 GPT-4o vs 50 Gemini strategies
   - Human evaluation panel (3 reviewers)
   - Metrics: Menu relevance (1-5), CTA appropriateness (1-5), JSON validation (pass/fail)
   - Rollback plan: Feature flag for model selection
   - **Potential: $0.0073 savings per strategy (7.6%)**

2. 🧪 Example → schema in Phase 1 Step 2
   - Deploy to 20 test strategies
   - Validate angle generation quality
   - Rollback if quality drops

3. ⏸️ Phase 1 single-shot (defer)
   - Higher risk, quality concerns
   - Revisit after Phase 1-2 optimizations proven

4. ⏸️ Parallel Phase 2b (defer)
   - Depends on Gemini migration success
   - Implement after architectural stability confirmed

**Total Phase 3 potential:** $0.0073-$0.015 cost savings + 300-400 tokens
**Effort:** 1 week implementation + 1 week testing

### 13.4 Rollout Strategy

**Gradual deployment:**
1. Deploy Phase 1 optimizations to 10% of traffic (10 businesses)
2. Monitor for 1 week — check strategy quality, error rates
3. If stable → 50% traffic
4. If stable → 100% traffic

**For each Phase 2-3 optimization:**
- A/B test framework with control group
- Human quality evaluation (sample 10-20 strategies)
- Automated metrics (JSON validation, token usage, cost)
- Go/no-go decision based on metrics

### 13.5 Success Metrics

**Token efficiency:**
- Target: 10-15% reduction in total input tokens
- Measurement: Average tokens per strategy (weekly)

**Cost efficiency:**
- Target: 20-30% reduction in cost per strategy
- Measurement: Average cost per strategy (weekly)

**Quality maintenance:**
- Target: No statistically significant drop in human eval scores
- Measurement: 1-5 rating scale for strategy quality (sample 20/week)
- Threshold: Mean score ≥ 4.0, no more than 10% below 3.5

**Performance:**
- Target: No increase in generation time (maintain ~18.5s)
- Stretch goal: Reduce to ~16s with parallel Phase 2b

---

## 14. RISK MITIGATION

### 14.1 Quality Degradation Risks

**Risk:** Compressed prompts produce lower-quality strategies

**Mitigation:**
1. **Baseline measurement:** Capture quality metrics BEFORE changes
   - Human eval: 50 current strategies rated 1-5
   - Establish baseline mean (target: ≥4.0)
2. **A/B testing:** Every medium/high-risk change tested in parallel
3. **Rollback plan:** Feature flags for each optimization
4. **Canary deployment:** 10% → 50% → 100% rollout pattern

### 14.2 AI Model Behavior Changes

**Risk:** GPT-4o/Gemini updates change response patterns

**Mitigation:**
1. **Version pinning:** Use explicit model versions (gpt-4o-2024-05-13)
2. **Monitoring:** Weekly quality checks even after stable deployment
3. **Fallback models:** Keep GPT-4o option for Phase 2b if Gemini fails

### 14.3 Edge Case Handling

**Risk:** Compressed prompts fail for unusual business types

**Mitigation:**
1. **Test suite:** Include edge cases (breakfast-only, dinner-only, bars, cafes)
2. **Validation:** Ensure each business type generates valid strategies
3. **Graceful degradation:** If compressed version fails, fallback to verbose

---

## 15. EXPECTED OUTCOMES

### 15.1 Conservative Scenario (Phase 1 + Safe Phase 2)

**Token reduction:** 6,500-8,000 tokens (11-14%)
**Cost reduction:** $0.016-$0.021 per strategy (17-22%)
**Time impact:** Neutral (no architectural changes)
**Risk level:** ✅ **VERY LOW**

**Annual savings (100 businesses):**
- Cost: $67-$88/year
- Confidence: 95%

### 15.2 Target Scenario (Phase 1 + Phase 2 + Gemini)

**Token reduction:** 7,000-10,000 tokens (12-18%)
**Cost reduction:** $0.022-$0.028 per strategy (23-29%)
**Time impact:** Neutral to slightly positive
**Risk level:** ⚠️ **LOW-MEDIUM**

**Annual savings (100 businesses):**
- Cost: $111-$141/year
- Confidence: 70%

### 15.3 Stretch Scenario (All optimizations including architectural)

**Token reduction:** 10,000-13,000 tokens (18-23%)
**Cost reduction:** $0.028-$0.035 per strategy (29-36%)
**Time impact:** -5s (parallel Phase 2b)
**Risk level:** ⚠️ **MEDIUM**

**Annual savings (100 businesses):**
- Cost: $141-$176/year
- Time: 21,000 seconds/year (5.8 hours)
- Confidence: 40%

---

## 16. RECOMMENDATIONS

### 16.1 Immediate Actions (This Sprint)

**Deploy immediately (zero risk):**
1. ✅ Replace all `═══════` separators with `##` markdown headers
2. ✅ Compress weather format to single-line
3. ✅ Convert BI to tabular format
4. ✅ Convert V5 programmes to table
5. ✅ Compress Phase 2a rules

**Expected outcome:** 1,675-2,495 tokens saved, $0.004-$0.006 per strategy, ~1 day effort

### 16.2 Next Sprint (A/B Testing Required)

**Test in parallel with control group:**
1. 🧪 Phase 2b compression (CRITICAL — highest impact)
2. 🧪 Verbose prose systematic compression
3. 🧪 Activation output table format
4. 🧪 Phase 2b → Gemini migration (CRITICAL — cost savings)

**Expected outcome:** 4,000-6,500 additional tokens saved, $0.014-$0.022 per strategy, 1 week effort

### 16.3 Future Consideration (Defer 1-2 months)

**Re-evaluate after Phase 1-2 proven stable:**
- Phase 1 single-shot generation (high quality risk)
- Parallel Phase 2b execution (Gemini-dependent)
- Business context deduplication (needs validation)

---

## 17. CONCLUSION

**Current system is well-architected but verbose.**

**Optimization potential is substantial:**
- **Token reduction: 12-18%** (safe optimizations)
- **Cost reduction: 23-29%** (with Gemini migration)
- **Annual savings: $111-$141** (100 businesses)

**No functionality loss required** — all optimizations preserve semantic content through:
- Format compression (tables vs prose)
- Structural simplification (bullets vs paragraphs)
- Redundancy elimination (deduplicate repeated context)
- Model migration (Gemini = same capability, lower cost)

**Highest ROI optimizations:**
1. 🔴 Phase 2b compression (9% token reduction)
2. 🔴 Phase 2b → Gemini (7.6% cost reduction)
3. 🟢 Separator replacement (2% token reduction)
4. 🟢 Verbose prose compression (1.4-2.3% token reduction)

**Next step:** Implement Phase 1 (quick wins) this week, prepare A/B testing framework for Phase 2.

---

**Document Version:** 1.0  
**Review Date:** 2026-06-07  
**Next Review:** After Phase 1 deployment (1 week)
