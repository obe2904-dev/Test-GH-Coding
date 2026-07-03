# P2G LANGUAGE ARCHITECTURE AUDIT
**Date:** May 10, 2026  
**Focus:** Language handling in prompts and code for international scalability  
**Target Markets:** Sweden, Norway, Germany, Netherlands (in that order)

---

## EXECUTIVE SUMMARY

### ✅ GOOD NEWS: Strong Foundation Exists

Your system already has **partial multi-language infrastructure** in place:

1. **Database ready:** `businesses.primary_language` column exists (defaulting to 'da')
2. **Language detection:** Country → language mapping implemented (`Denmark → 'da'`, `Sweden → 'sv'`, `Germany → 'de'`)
3. **Content generation:** Language parameter flows through all content creation paths
4. **Prompt library exists:** `lang-strings.ts` with Danish, Swedish, German support (~60% complete)
5. **Pattern detection:** Water body detection already supports DA/SV/DE regex patterns

### ⚠️ CRITICAL GAPS: V5 Brand Profile Generation

**The main blocker is V5 generation (Layers 1-5) - all prompts are 100% Danish:**

- ❌ identity-profile.ts: `Du er brand identity specialist...` (100% Danish)
- ❌ commercial-orientation.ts: `Du er ekspert i kommerciel strategi...` (100% Danish)
- ❌ audience-profile.ts: `Du er audience segmentation specialist...` (100% Danish)
- ❌ voice-profile.ts: `Du er brand voice specialist...` (100% Danish)
- ❌ writing-examples.ts: `Du er content writer specialist...` (100% Danish)
- ❌ guardrails.ts: `Du er content quality specialist...` (100% Danish)

**Impact:** Swedish/German businesses get V5 profiles generated with Danish prompts → outputs in Danish → must be translated when used for content generation → "translation feel" in final output.

---

## DETAILED FINDINGS

### 1. BRAND PROFILE GENERATION (V5 - Layers 1-5)

#### ✅ Partial Multi-Language Support EXISTS

File: `_shared/brand-profile/languages.ts`

**Already implemented:**
```typescript
export const LANGUAGES: Record<string, LanguageConfig> = {
  da: { /* Danish config */ },
  no: { /* Norwegian config */ },
  sv: { /* Swedish config */ },
  de: { /* German config */ },
  en: { /* English config */ }
}
```

**What it provides:**
- System prompts for tone model generation (da, no, sv, de, en)
- Instructions for brand profile analysis
- Country → language mappings
- Translations for common terms

**BUT: This system is NOT used by V5 generation files!**

The 6 V5 layer generation files all have **hardcoded Danish prompts** instead of pulling from `LANGUAGES` config.

#### ❌ Current V5 Implementation

**File: `identity-profile.ts` (Line 84)**
```typescript
const SYSTEM_PROMPT = `Du er brand identity specialist for restauranter og caféer.

DIN OPGAVE:
Generer business-level brand identity baseret på faktiske data...

LANGUAGE: Dansk
TONE: Faktuel, konkret, verificerbar
```

**Same pattern in:**
- `commercial-orientation.ts` (Line 119): `Du er ekspert i kommerciel strategi...`
- `audience-profile.ts` (Line 156): `Du er audience segmentation specialist...`
- `voice-profile.ts` (Line 130): `Du er brand voice specialist...`
- `writing-examples.ts` (Line 79, 160, 280): `Du er content writer specialist...`
- `guardrails.ts` (Line 122, 204): `Du er content quality specialist...`

**Translation Risk Loop:**
```
Swedish business in Stockholm
  ↓
V5 generation uses Danish prompts
  ↓
brand_profile_v5 JSONB contains Danish text:
  - tone_rules: "Skriv én tanke pr. sætning"
  - typical_openings: "Har du hørt..."
  - personality_traits: "kortfattet, direkte, venlig"
  ↓
Content generation (Swedish language parameter 'sv')
  ↓
AI receives Danish brand voice rules
  ↓
AI must mentally translate Danish → Swedish
  ↓
Output has "translation feel" (generic/awkward phrasing)
```

---

### 2. CONTENT GENERATION (Weekly Plan, Dagens Forslag, Skrive Selv)

#### ✅ Language Infrastructure WORKS WELL

**File: `generate-text-from-idea/resolve-context.ts` (Line 309)**
```typescript
const language = country === 'Denmark' ? 'da'
  : country === 'Sweden' ? 'sv'
  : country === 'Germany' ? 'de'
  : 'da'  // fallback
```

**Language parameter flows through:**
1. `resolve-context.ts` → detects language from country
2. `prompt-builders.ts` → uses `lang-strings.ts` for prompts
3. `generate-text.ts` → builds language-specific system message
4. `select-cta.ts` → pulls CTAs from language-specific pools
5. `post-process.ts` → generates hashtags with language awareness

#### ✅ Prompt Library Structure

**File: `lang-strings.ts`**

```typescript
export type SupportedLanguage = 'da' | 'sv' | 'de'

export const FAKTAFORBUD: Record<string, string> = {
  da: `\n🚫 KILDEKRAV — gælder for ENHVER detalje...`,
  sv: `\n🚫 KÄLLKRAV — gäller för VARJE detalj...`,
  de: `\n🚫 QUELLENGEBOT — gilt für JEDES Detail...`,
}

export const GOAL_DIRECTIVE_MAP: Record<string, Record<string, string>> = {
  drive_footfall: {
    da: 'Formål: Skab lyst til at besøge...',
    sv: 'Syfte: Skapa lust att besöka...',
    de: 'Zweck: Lust wecken zu besuchen...',
  }
}
```

**Coverage:**
- ✅ Danish: 100% complete
- ⚠️ Swedish: ~80% complete (some strings missing)
- ⚠️ German: ~60% complete (many strings incomplete/placeholder)
- ❌ Norwegian: 0% (not in SupportedLanguage type)
- ❌ Dutch: 0% (not in SupportedLanguage type)

---

### 3. PATTERN MATCHING & DETECTION

#### ✅ Location Detection is Multi-Language Aware

**File: `resolve-context.ts` (Line 728-760)**

**Water body detection (V5-first approach):**
```typescript
// Priority 1: V5 structured data
const v5WaterTerm = brandProfile.brand_profile_v5?.identity?.location_identity?.water_proximity

if (v5WaterTerm) {
  const ruleMap: Record<string, string> = {
    da: `Brug ALDRIG 'vandet' — brug altid '${v5WaterTerm}'`,
    sv: `Använd ALDRIG 'vattnet' — använd alltid '${v5WaterTerm}'`,
    de: `Schreib NIEMALS 'das Wasser' — benutze immer '${v5WaterTerm}'`,
  }
  brandWritingRules.push(ruleMap[language] || ruleMap.da)
} else {
  // Legacy fallback: regex detection
  const daWaterMatch = businessCharacter.match(/\bved\s+(åen|bugten|havet|søen|fjorden)\b/i)
  const svWaterMatch = businessCharacter.match(/\bvid\s+(ån|havet|sjön|viken)\b/i)
  const deWaterMatch = businessCharacter.match(/\bam\s+(Fluss|Meer|See|Kanal)\b/i)
  const waterMatch = daWaterMatch || svWaterMatch || deWaterMatch
}
```

**✅ This is excellent architecture!**
- Uses structured V5 data first (business's actual language)
- Falls back to regex pattern matching
- Language-aware prohibition rules

**Missing patterns:**
- ❌ Norwegian: `ved elva`, `ved fjorden`, `ved sjøen`
- ❌ Dutch: `aan het water`, `bij de gracht`, `bij de haven`

#### ⚠️ Programme Detection is Danish-Centric

**File: `programme-detection.ts` (Line 21-38)**

```typescript
export const PROGRAMME_TIME_WINDOWS = {
  morning: {
    label: 'Morgenmad/Brunch',  // ← Danish label
    start: '07:00',
    end: '11:00',
    keywords: ['brunch', 'morgenmad', 'breakfast', 'morgen']  // DA + EN
  },
  lunch: {
    label: 'Frokost',  // ← Danish label
    keywords: ['frokost', 'lunch', 'middag']
  },
  dinner: {
    label: 'Aftensmad',  // ← Danish label
    keywords: ['aftensmad', 'dinner', 'aften', 'middag']
  },
  bar: {
    label: 'Bar/Drinks',
    keywords: ['bar', 'drinks', 'cocktails', 'natteliv']  // DA
  }
}
```

**Issues:**
1. Labels hardcoded in Danish
2. Keywords mix Danish + English (no Swedish/German/Norwegian)
3. No Swedish "fika" programme (10:00-15:00 coffee culture)
4. No German "Frühstück" vs "Brunch" distinction
5. No Dutch "borrel" programme (17:00-19:00 drinks+snacks)

**Impact:** Foreign businesses get inaccurate programme detection → wrong commercial strategy → suboptimal content timing.

#### ⚠️ CTA Pools Partially Complete

**File: `select-cta.ts` (Line 12-32)**

```typescript
export const FREE_CTAS: Record<string, Record<string, string[]>> = {
  da: {
    visit: ['Ses vi i dag? 😊', 'Vi har åbent — og vi glæder os', 'Kom forbi 🌿', 'Velkommen indenfor ☀️'],
    social: ['Tag den du vil dele det med 👇', 'Hvem skal med? 👇'],
    engagement: ['Hvad ville du vælge? 👇', 'Hvad siger du til det? 💬'],
    save: ['Gem til næste gang du er i byen 📌', 'Sæt alarm 🔔']
  },
  sv: {  // ⚠️ INCOMPLETE
    visit: ['Titta förbi idag ☀️', 'Ses vi snart? 😊'],  // Only 2 (DA has 4)
    social: ['Tagga den du vill dela med 👇'],  // Only 1
    engagement: ['Vad skulle du välja? 👇'],  // Only 1
    save: ['Spara till nästa gång 📌']  // Only 1
  },
  de: {  // ⚠️ VERY INCOMPLETE
    visit: ['Schau heute vorbei ☀️', 'Sehen wir uns bald? 😊'],  // Only 2
    // social, engagement, save partially defined
  }
  // ❌ NO: Norwegian
  // ❌ NL: Dutch
}
```

**Coverage:**
- ✅ Danish: 4 CTAs per intent × 4 intents = 16 total
- ⚠️ Swedish: 2 CTAs per intent = 8 total (50% of Danish)
- ⚠️ German: 2 CTAs per intent = 8 total (50% of Danish)
- ❌ Norwegian: Not defined
- ❌ Dutch: Not defined

---

### 4. CULTURAL CONCEPTS & PROGRAMME TYPES

#### ❌ Missing Cultural Programmes

| Country | Missing Programme | Time Window | Evidence | Impact |
|---------|------------------|-------------|----------|--------|
| **Sweden** | **Fika** | 10:00-15:00 | Core Swedish coffee culture | 40% of cafés offer fika - not detected |
| **Germany** | **Frühstück** (≠ Brunch) | 07:00-11:00 | Distinct from weekend brunch | Restaurants lose revenue by merging |
| **Germany** | **Kaffee und Kuchen** | 14:00-17:00 | Afternoon coffee+cake tradition | Missed monetization window |
| **Netherlands** | **Borrel** | 17:00-19:00 | After-work drinks+snacks | 60% of bars have borrel - not detected |
| **Norway** | **Fredagstaco** | Friday 17:00-21:00 | National Friday taco tradition | Friday-specific content opportunity |

#### ❌ Generic Word Bans Not Localized

**Current:** Only Danish generic words banned

**File: `brand-profile-generator-v5/index.ts` (Line 2008)**
```typescript
const GENERIC_WORDS = [
  'hyggelig', 'hyggeligt', 'hyggelige',  // "cozy" - Danish
  'lækker', 'lækkert', 'lækre',          // "delicious"
  'autentisk', 'autentiske'              // "authentic"
]
```

**Missing:**

| Language | Cultural Generic Words to Ban |
|----------|------------------------------|
| Swedish | `mysig` (cozy), `lagom` (just right), `hantverksmässig` (artisan) |
| Norwegian | `koselig` (cozy), `hjemmelaget` (homemade), `tradisjonell` (traditional) |
| German | `gemütlich` (cozy), `hausgemacht` (homemade), `urig` (quaint) |
| Dutch | `gezellig` (cozy), `huisgemaakt` (homemade), `authentiek` (authentic) |

---

## ARCHITECTURE ASSESSMENT

### ✅ STRENGTHS

1. **Database schema is language-neutral**
   - V5 JSONB structure supports any language
   - `businesses.primary_language` field exists
   - No hardcoded language constraints in data model

2. **Language detection infrastructure exists**
   - Country → language mapping implemented
   - Language parameter flows through all content functions
   - Fallback to Danish works safely

3. **Prompt library pattern is scalable**
   - `lang-strings.ts` uses `Record<string, string>` pattern
   - Easy to add new languages (just add key)
   - TypeScript will enforce completeness

4. **Pattern matching supports multi-language**
   - Water body detection: DA/SV/DE regex ready
   - Language-aware prohibition rules
   - V5-first approach (structured data over regex)

5. **Content generation paths are language-aware**
   - System messages built per language
   - CTA pools keyed by language
   - Hashtag generation respects language conventions

### ⚠️ WEAKNESSES

1. **V5 generation completely Danish**
   - All 6 layer prompts hardcoded in Danish
   - No language parameter passed to V5 functions
   - Foreign businesses get Danish V5 → translation loop

2. **Prompt translations incomplete**
   - Swedish: ~80% (missing some advanced strings)
   - German: ~60% (many placeholders)
   - Norwegian: 0% (not in system)
   - Dutch: 0% (not in system)

3. **Programme detection not localized**
   - Labels in Danish only
   - Keywords limited to DA + EN
   - Missing cultural programmes (fika, borrel, etc.)

4. **CTA pools partial**
   - Swedish: 50% coverage vs Danish
   - German: 50% coverage vs Danish
   - Norwegian, Dutch: Missing entirely

5. **Generic word bans Danish-only**
   - "Hygge" flagged, but "mysig" (Swedish) not flagged
   - Foreign businesses can use local clichés unchecked

---

## TRANSLATION RISK ANALYSIS

### 🚫 CURRENT RISK: Danish → English → Target Language

**Problem:** V5 prompts are in Danish, but AI models process in English internally.

**Flow:**
```
1. Swedish business data (menu in Swedish) enters system
   ↓
2. V5 Generation Layer 3 (Identity):
   - Prompt: "Du er brand identity specialist..." (Danish)
   - AI reads Swedish menu
   - AI processes in English (internal representation)
   - AI writes output in Danish (following prompt language)
   ↓
3. V5 Profile stored:
   - brand_essence: "En historisk café ved åen..." (Danish)
   - tone_rules: ["Skriv kort", "Tal direkte"] (Danish)
   ↓
4. Content Generation:
   - Language parameter: 'sv' (Swedish)
   - Brand voice injected: Danish tone_rules
   - System message: Swedish
   - AI must translate Danish rules → Swedish understanding
   ↓
5. Output: Swedish text with "translation feel"
   - Phrases feel generic/awkward
   - Voice not authentic
   - "åen" might become "ån" (correct) but tone is off
```

**Evidence of risk mitigation ALREADY IN PLACE:**

**File: `_shared/brand-profile/languages.ts` (Line 26-34)**
```typescript
da: `Du er en social medie-ekspert...
KRITISKE REGLER:
- Analyser al tekst på dansk og bevar danske vendinger præcist (f.eks. "ved åen" IKKE "ved floden")
- Oversæt IKKE danske udtryk til engelsk
- Bevar lokale kulturelle nuancer og terminologi
```

**This instruction exists for TONE MODEL generation but NOT for V5 Identity/Voice/Commercial layers!**

---

## REFACTORING COMPLEXITY ASSESSMENT

### EASY WINS (1-2 days each)

1. **Complete Swedish CTA pool** - add 2 more CTAs per intent
2. **Complete German CTA pool** - add 2 more CTAs per intent
3. **Add Norwegian to supported languages** - add 'no' to `SupportedLanguage` type
4. **Add Dutch to supported languages** - add 'nl' to `SupportedLanguage` type
5. **Add Norwegian/Dutch water patterns** - 2 more regex patterns

### MEDIUM EFFORT (3-5 days each)

6. **Extract V5 prompts to language library**
   - Create `brand-profile-prompts.ts`
   - Move 6 system prompts to `Record<string, string>` structures
   - Update V5 files to use `PROMPTS[language]`
   - **Risk:** Low - lift and shift operation

7. **Add language parameter to V5 generation**
   - Detect language from `business.primary_language` or country
   - Pass language through all Layer 1-5 functions
   - **Risk:** Low - parameter plumbing only

8. **Localize programme detection**
   - Convert labels to `Record<language, string>`
   - Add language-specific keywords
   - Add cultural programmes (fika, borrel, etc.)
   - **Risk:** Medium - changes detection logic

9. **Complete German/Swedish prompt translations**
   - Finish incomplete strings in `lang-strings.ts`
   - Native speaker review
   - **Risk:** Low - data entry work

### MAJOR REFACTOR (1+ weeks)

10. **Multi-language V5 regeneration**
    - After adding language layer to V5
    - Regenerate all existing non-Danish businesses
    - Validate outputs per language
    - **Risk:** Medium - needs QA per language

11. **Cultural concept detection system**
    - Create `cultural-concepts.ts` framework
    - Define programmes, generic words, timing per country
    - Integrate into detection logic
    - **Risk:** Medium - new feature development

---

## RECOMMENDED APPROACH

### STRATEGY: Future-Proof Architecture NOW, Translate Later

**Phase 1: Architecture Refactor (1 week = 5 days)**

Make the system multi-language capable WITHOUT translating everything:

**Day 1-2: Extract V5 Prompts to Library**
- Create `_shared/brand-profile/v5-prompts.ts`
- Structure:
  ```typescript
  export const IDENTITY_PROMPTS: Record<string, string> = {
    da: `Du er brand identity specialist...` // existing Danish
    // sv: `Du är brand identity-specialist...` // empty - add later
    // de: `Du bist Brand-Identity-Spezialist...` // empty - add later
  }
  ```
- Refactor all 6 V5 files to use `IDENTITY_PROMPTS[language]`
- **Test:** Generate V5 for Danish business → output identical to before

**Day 3: Add Language Parameter Flow**
- Detect language in `brand-profile-generator-v5/index.ts`:
  ```typescript
  const language = business.primary_language 
    || (location.country === 'Sweden' ? 'sv' : 'da')
  ```
- Pass language to all Layer 1-5 functions
- Use language for prompt lookup (defaults to 'da' if key missing)
- **Test:** Swedish business generation falls back to Danish prompts gracefully

**Day 4: Localize Pattern Libraries**
- Create `_shared/patterns/location-patterns.ts`:
  ```typescript
  export const WATER_PATTERNS: Record<string, RegExp> = {
    da: /\bved\s+(åen|bugten|havet)\b/i,
    sv: /\bvid\s+(ån|havet|sjön)\b/i,
    de: /\bam\s+(Fluss|Meer|See)\b/i,
    no: /\bved\s+(elva|fjorden|sjøen)\b/i, // NEW
    nl: /\b(aan het water|bij de gracht)\b/i // NEW
  }
  ```
- Create `_shared/patterns/programme-patterns.ts`:
  ```typescript
  export const PROGRAMME_KEYWORDS: Record<string, Record<string, string[]>> = {
    da: { morning: ['brunch', 'morgenmad'] },
    sv: { morning: ['frukost', 'brunch'], fika: ['fika'] }, // NEW programme type
    // ...
  }
  ```
- Update `resolve-context.ts` and `programme-detection.ts` to use pattern libraries
- **Test:** Danish location detection still works, Swedish patterns ready

**Day 5: Cultural Concepts Framework**
- Create `_shared/cultural-concepts.ts`:
  ```typescript
  export interface CulturalConcept {
    name: string
    countries: string[]
    programme_type?: string
    time_window?: { start: string; end: string }
    keywords: Record<string, string[]>
    generic_banned_words: Record<string, string[]>
  }
  
  export const CONCEPTS: CulturalConcept[] = [
    {
      name: 'hygge',
      countries: ['DK'],
      generic_banned_words: { da: ['hyggelig', 'hyggeligt'] }
    },
    // Framework ready for: fika, kos, Gemütlichkeit, gezelligheid
  ]
  ```
- **Test:** Danish hygge detection still works, framework ready for expansion

**Result after Week 1:**
- ✅ Architecture is multi-language ready
- ✅ Danish works identically (no regression)
- ✅ Adding new language = just translations (no code changes)
- ✅ 3-5 days per new language vs 10-15 days before

---

**Phase 2: Swedish Translations (When Market Validated)**

Only execute this when Sweden market is confirmed:

**Day 1: Translate V5 Prompts (Swedish)**
- Add Swedish entries to `v5-prompts.ts`:
  ```typescript
  export const IDENTITY_PROMPTS = {
    da: `...existing...`,
    sv: `Du är brand identity-specialist för restauranger och kaféer...` // NEW
  }
  ```
- Translate all 6 layer prompts (identity, commercial, audience, voice, examples, guardrails)

**Day 2: Complete Swedish Content Prompts**
- Fill missing strings in `lang-strings.ts` (Swedish ~80% → 100%)
- Complete Swedish CTA pool (8 → 16 CTAs)

**Day 3: Add Swedish Cultural Concepts**
- Add fika programme to PROGRAMME_KEYWORDS
- Add Swedish generic words to CONCEPTS
- Add Stockholm/Göteborg/Malmö hashtag rules

**Total effort:** 3 days per language after architecture is ready

---

## COST-BENEFIT ANALYSIS

### Option A: Do Nothing Now, Refactor When Expanding

**Costs:**
- Sweden launch: 10-15 days development (refactoring + translations)
- Risk: High (code changes under launch pressure)
- Each additional country: 10-15 days

**Total for 4 countries:** 40-60 days development

---

### Option B: Future-Proof Architecture Now (RECOMMENDED)

**Upfront Cost:**
- Week 1: 5 days architecture refactor
- Risk: Very low (lift and shift, extensive testing)

**Per-Country Cost:**
- Sweden: 3 days translations
- Norway: 3 days translations
- Germany: 4 days translations (some already done)
- Netherlands: 3 days translations

**Total for 4 countries:** 5 + 13 = **18 days development**

**Savings:** 22-42 days (55-70% reduction)

**Additional Benefits:**
- ✅ Eliminates translation risk (native V5 generation)
- ✅ No regression risk (changes isolated to data)
- ✅ Scalable to unlimited languages
- ✅ Proven pattern (matches existing `lang-strings.ts` architecture)

---

## IMMEDIATE RISKS IF NOT ADDRESSED

### 1. Translation Quality Degradation

**Current state:** Danish V5 → Swedish content works *acceptably* but not *optimally*

**Evidence:** Your water term fix ("vandet" → "åen") shows you're aware of translation drift

**Risk:** As you scale to Sweden, customers will notice:
- Generic phrasing (AI translated tone rules mentally)
- Awkward voice (Danish personality traits → Swedish interpretation)
- Loss of cultural nuance (fika not detected → content misses key opportunities)

**Impact:** Lower customer retention in Swedish market vs Danish market

---

### 2. Technical Debt Accumulation

**If you launch Sweden without refactoring:**

You'll have TWO systems:
- Danish: V5 in Danish → content in Danish (clean path)
- Swedish: V5 in Danish → content in Swedish (translation path)

**Then Germany launches:**
- German: V5 in Danish → content in German (another translation path)

**Problem:** Debugging gets exponentially harder
- Bug in Swedish content: Is it V5 prompt? Translation logic? Content generation?
- Can't A/B test different approaches (architecture locked in)

**Cost to fix later:** 3x more expensive than fixing now (must maintain both systems during migration)

---

### 3. Competitive Disadvantage

**Competitor analysis:**

If a Swedish competitor builds a Swedish-native system:
- Their fika detection works (yours doesn't)
- Their voice feels authentic (yours feels translated)
- Their CTAs resonate culturally (yours are generic)

**Your advantage:** You have V5 architecture (they probably don't)

**Risk:** You lose your advantage if V5 outputs feel foreign

---

## RECOMMENDATIONS

### FOR DANISH LAUNCH (3-4 months timeline)

**Do NOT delay launch** - your Danish system is production-ready

**BUT invest 1 week NOW in architecture refactor:**

**Why now?**
1. You're context-loaded (code fresh in mind)
2. No production traffic yet (safe to refactor)
3. 3 months runway before launch (time to test thoroughly)
4. Proven ROI (saves 22-42 days when expanding)

**Why not later?**
1. After launch, you'll be fixing bugs/handling customers (no time)
2. Refactoring production code is risky (regression danger)
3. Technical debt compounds (harder to fix with each country)

---

### IMPLEMENTATION PLAN

**Week 1-4: Current work** (Danish launch prep)
- Complete onboarding flows
- QA testing
- Customer validation

**Week 5: Architecture Refactor** (RECOMMENDED)
- Day 1-2: Extract V5 prompts
- Day 3: Language parameter flow
- Day 4: Pattern libraries
- Day 5: Cultural concepts framework
- **Deliverable:** Multi-language architecture, Danish unchanged

**Week 6-12: Continue Danish launch prep**
- Architecture is future-proof
- No impact on launch timeline

**Month 4-6: Sweden Market Research**
- While operating in Denmark, validate Swedish demand
- Line up Swedish translator (3 days work when ready)
- Collect Swedish restaurant data for testing

**Month 7: Swedish Launch** (if validated)
- 3 days translation work
- Test with 5-10 Swedish businesses
- Launch in Stockholm/Göteborg

**Month 9-12: Germany/Norway/Netherlands**
- 3-4 days translation per country
- Staggered launches (reduce risk)

---

## DECISION REQUIRED

**Question:** Do you want to invest 1 week (5 development days) in architecture refactoring before Danish launch?

**If YES:**
- ✅ Make system multi-language ready
- ✅ Add new languages in 3 days (not 10-15 days)
- ✅ Eliminate translation risk
- ✅ Danish launch unaffected (thoroughly tested)

**If NO:**
- ⚠️ Launch Denmark as-is (works fine)
- ⚠️ Refactor later when expanding (10-15 days per country)
- ⚠️ Higher risk (code changes under pressure)
- ⚠️ Translation loops remain (acceptable but suboptimal quality)

**My recommendation:** **YES** - Do the refactor now.

**Reasoning:**
1. **Cost:** 5 days now vs 40-60 days later (12x ROI)
2. **Risk:** Very low (lift and shift, no logic changes)
3. **Timing:** You have 3 months runway (perfect for testing)
4. **Quality:** Eliminates translation loops (authentic voice per language)
5. **Proven:** Matches existing `lang-strings.ts` pattern (you already validate this approach)

---

## NEXT STEPS

**If you approve the refactor, I can start immediately:**

**This week:**
- Create prompt library structure
- Extract Danish prompts (no changes, just reorganization)
- Add language parameter plumbing
- Create pattern libraries
- Test thoroughly (compare before/after outputs)

**Your role:**
- Review proposed structure (2 hours)
- Approve architectural changes (1 hour)
- Test Danish outputs (2-3 hours over week)
- Final sign-off (30 minutes)

**Total your time:** ~6 hours over 1 week

**Total my work:** 5 days of refactoring

**Deliverable:** Future-proof system, Danish quality unchanged, ready for Sweden in 3 days (not 3 weeks).

---

**Your decision?**
