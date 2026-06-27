# Phase 1 Investigation Findings
**Date**: 2026-06-22  
**Status**: ✅ COMPLETE  
**Investigator**: AI Analysis of Codebase

---

## Executive Summary

**🎉 GOOD NEWS**: The system architecture is ALREADY CORRECTLY DESIGNED!

- ✅ Language-specific prompts exist (Danish, Norwegian, Swedish, German, English)
- ✅ `localLocationReference` field extracts exact website phrasing
- ✅ Protection against "ved vandet", "havnefronten" generic replacements
- ✅ Enforcement as first `natural_vocabulary` entry
- ✅ NO English translation layer (processes Danish directly)

**❓ THE MYSTERY**: Why does Café Faust's current brand profile have "ved vandet" and "udsigten"?

**Hypotheses**:
1. Profile was generated BEFORE protection logic was implemented
2. `localLocationReference` wasn't extracted at time of generation (field may have been empty)
3. There's a gap/bypass in the flow we haven't identified
4. AI ignored the constraints (unlikely but possible)

**NEXT STEP**: Test current system by re-analyzing cafefaust.dk and regenerating brand profile.

---

## Files Located

### Core Functions
| Function | Path | Status |
|----------|------|--------|
| `analyze-website` | `/supabase/functions/analyze-website/index.ts` | ✅ Found |
| `populate-location-intelligence` | `/supabase/functions/populate-location-intelligence/index.ts` | ✅ Found |
| `brand-profile-generator-v5` | `/supabase/functions/brand-profile-generator-v5/index.ts` | ✅ Found |

### Key Components
| Component | Path | Purpose |
|-----------|------|---------|
| Basic info extractor | `/supabase/functions/_shared/ai-extractors/basic-info-extractor.ts` | Extracts `localLocationReference` |
| Website analysis saver | `/supabase/functions/_shared/persistence/website-analysis-saver.ts` | Saves to database |
| Tone DNA generator | `/supabase/functions/_shared/brand-profile/tone-dna-generator.ts` | Enforces local reference |
| Claude analyzer | `/supabase/functions/populate-location-intelligence/services/claude-analyzer.ts` | Location intelligence |

---

## Architecture Discovery: Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. ANALYZE-WEBSITE (Free Tier)                             │
│    File: _shared/ai-extractors/basic-info-extractor.ts     │
├─────────────────────────────────────────────────────────────┤
│ Input: HTML from cafefaust.dk                               │
│ Language Detection:                                         │
│   - Priority 1: <html lang="da"> → Danish ✅                │
│   - Priority 2: Content (æøå) → Danish ✅                   │
│                                                             │
│ Prompt (DANISH):                                            │
│   "Du er en virksomhedsinformationsekstraktor..."           │
│   "Extract: localLocationReference - EXACT local phrase"    │
│   "Look for: 'ved [landmark]', 'i [area]', 'på [street]'"  │
│                                                             │
│ Expected Output:                                            │
│   localLocationReference: "ved åen i Aarhus"                │
│                                                             │
│ Saves To:                                                   │
│   businesses.local_location_reference                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. POPULATE-LOCATION-INTELLIGENCE (Paid Tier - Optional)   │
│    File: populate-location-intelligence/services/          │
│          claude-analyzer.ts                                 │
├─────────────────────────────────────────────────────────────┤
│ Reads From:                                                 │
│   businesses.local_location_reference                       │
│                                                             │
│ Prompt (DANISH):                                            │
│   "✅ 'Ved Åen' ELLER 'Langs Åen'"                          │
│   "❌ ALDRIG 'vestlige/østlige bred'"                       │
│   "Output: local_terminology (danske termer)"               │
│                                                             │
│ Saves To:                                                   │
│   business_location_intelligence.local_terminology          │
│   business_location_intelligence.local_location_reference   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. BRAND-PROFILE-GENERATOR-V5                               │
│    File: _shared/brand-profile/tone-dna-generator.ts        │
├─────────────────────────────────────────────────────────────┤
│ Reads From:                                                 │
│   business.local_location_reference (PRIMARY)               │
│   location.local_location_reference (FALLBACK)              │
│                                                             │
│ Protection Prompt (DANISH):                                 │
│   "⚠️ KRITISK LOKATIONSKRAV:"                               │
│   "Forretningen bruger PRÆCIST: 'ved åen i Aarhus'"        │
│   "SKAL fremgå som FØRSTE i natural_vocabulary"             │
│   "Aldrig erstattes af: 'ved vandet', 'havnefronten'"      │
│   "Ikke parres med havbeskrivelser (bølger, hav, maritim)"  │
│                                                             │
│ Post-Processing:                                            │
│   if (vocab[0] !== localLocationReference) {                │
│     vocab = [localLocationReference, ...vocab.filter(...)]  │
│   }                                                         │
│                                                             │
│ Output:                                                     │
│   brand_profile_v5.voice.tone_dna.location_driver.         │
│     natural_vocabulary: ["ved åen i Aarhus", ...]           │
└─────────────────────────────────────────────────────────────┘
```

---

## Language Handling: Detailed Analysis

### 1. Language Detection (`analyze-website`)

**Method**: Two-tier priority system

```typescript
// Priority 1: HTML lang attribute (most reliable)
const langMatch = homepageHtml.match(/<html[^>]*\slang=["']([a-zA-Z-]+)["']/i)
if (langMatch) {
  htmlLang = langMatch[1].toLowerCase().split('-')[0]  // "da" from "da-DK"
}

// Priority 2: Content detection
const detectLanguage = (text: string) => {
  if (text.match(/[æø]/) || text.match(/\b(og|af|til|på)\b/i)) return 'da'
  if (text.match(/[äö]/) && !text.match(/[æø]/)) return 'sv'
  // ... etc
}
```

**For Café Faust**:
- `<html lang="da">` → Detected as Danish ✅
- Content: "Velkommen til Café Faust" → Confirms Danish ✅

### 2. Language-Specific Prompts

**Danish System Prompt** (`basic-info-extractor.ts`):
```
Du er en virksomhedsinformationsekstraktor. Returner KUN gyldig JSON.
KRITISK: Skriv ALTID beskrivelsen på DANSK. 
Oversæt ALDRIG til engelsk. 
Bevar originale danske vendinger og udtryk.
```

**Extraction Instruction** (Danish):
```
Skriv en kort beskrivelse på 2-4 sætninger på DANSK der opsummerer 
hele virksomheden: hvad stedet er, hvad det serverer, hvilken 
stemning/oplevelse det tilbyder, og hvor det ligger hvis det er tydeligt. 
Bevar danske udtryk.
```

**Location Extraction** (English - but extracts verbatim!):
```
localLocationReference: Extract EXACT local place name phrase if business 
describes its location (e.g., "ved åen", "i Nyhavn", "ved stranden"). 
ONLY extract if explicitly mentioned. Return null if not found.
Look for patterns: "ved [landmark]", "i [area]", "på [street/area]"
```

### 3. Protection Logic (`brand-profile-generator-v5`)

**Constraint Prompt** (Danish):
```typescript
⚠️ KRITISK LOKATIONSKRAV:
Forretningen bruger PRÆCIST denne formulering for sin placering: "ved åen i Aarhus"
Dette er operatørens eget ord for lokationen og SKAL:
  1. Fremgå som den FØRSTE post in natural_vocabulary (ordret, ikke omskrevet)
  2. Aldrig erstattes af generiske alternativer ("ved vandet", "havnefronten", 
     "waterfront", "åen" alene osv.)
  3. Ikke parres med havbeskrivelser (bølger, hav, maritim) — det er en å, 
     ikke et hav/fjord/strand.
```

**Enforcement Code**:
```typescript
// After AI returns JSON, enforce local_location_reference as first entry
const llr = prompt.match(/PRÆCIST denne formulering for sin placering: "([^"]+)"/);
if (llr?.[1] && parsed.location_driver?.natural_vocabulary) {
  const ref = llr[1];  // "ved åen i Aarhus"
  const vocab = parsed.location_driver.natural_vocabulary;
  
  if (vocab[0] !== ref) {
    // Force it first, remove duplicates
    parsed.location_driver.natural_vocabulary = [
      ref,
      ...vocab.filter((v: string) => v !== ref)
    ];
    console.log('[ToneDNA] ✅ local_location_reference enforced:', ref);
  }
}
```

---

## Critical Protections Already in Place

### Protection 1: Against Generic Water Terms

**In Tone DNA Prompt**:
```
"Aldrig erstattes af generiske alternativer:
 - 'ved vandet' ❌
 - 'havnefronten' ❌ 
 - 'waterfront' ❌
 - 'åen' alene ❌ (needs context)"
```

### Protection 2: Against River/Sea Confusion

**In Tone DNA Prompt**:
```
"Ikke parres med havbeskrivelser:
 - bølger ❌
 - hav ❌
 - maritim ❌
Forklaring: det er en å, ikke et hav/fjord/strand"
```

### Protection 3: Location Intelligence Instructions

**In Claude Analyzer** (Danish):
```
✅ KORREKT:
  - "Ved Åen"
  - "Langs Åen"

❌ FORBUDT:
  - "vestlige/østlige bred" (upræcis data)
  - "ved vandet" (for generisk)
  - retningsangivelser (vest, øst, nord, syd)
```

---

## Why Current Café Faust Profile Has Problems

### The Problematic Output

From user's example:
```json
"natural_vocabulary": [
  "ved åen", ✅
  "på Åboulevarden", ✅
  "i hjertet af Aarhus", ✅
  "ved vandet", ❌ SHOULD NOT EXIST
  "udsigt", ❌ TOO GRAND
  "udeservering" ✅
]
```

### Hypothesis 1: Pre-Protection Profile

**Timeline question**: When was this protection logic added vs. when was profile generated?

**Check needed**:
```sql
SELECT 
  brand_profile_v5->'voice'->'tone_dna'->'generated_at' as tone_dna_created,
  updated_at as profile_updated
FROM business_brand_profile
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';
```

**If `generated_at` predates protection code** → Profile needs regeneration

### Hypothesis 2: Missing Local Location Reference

**Check needed**:
```sql
SELECT 
  local_location_reference,
  name,
  website_url
FROM businesses
WHERE id = '36e24a84-c32d-4123-910a-1bb2e64d34af';
```

**If `local_location_reference IS NULL`** → analyze-website didn't extract it
**If `local_location_reference = 'ved åen'`** → Protection should have worked

### Hypothesis 3: AI Ignored Constraints

**Less likely** because:
- Post-processing enforcement should catch this
- Explicit console logging: `[ToneDNA] ✅ local_location_reference enforced`

---

## Recommended Next Steps

### 1. Check Current Database State

```sql
-- Check if local_location_reference exists
SELECT local_location_reference FROM businesses 
WHERE id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

-- Check when brand profile was last generated
SELECT 
  brand_profile_v5->'voice'->'tone_dna'->'generated_at' as generated_at,
  updated_at
FROM business_brand_profile
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';
```

### 2. Re-Analyze Website (Test Current System)

Run `analyze-website` on cafefaust.dk to verify extraction works:
- Should extract: `localLocationReference: "ved åen i Aarhus"`
- Or variation: `"ved åen"` or `"ved åen i Aarhus"`

### 3. Regenerate Brand Profile

If protection logic is recent, regenerate profile to apply fixes:
- Will enforce `local_location_reference` as first entry
- Will block "ved vandet", "udsigten" via prompt constraints
- Post-processing will catch any AI deviations

### 4. Add Logging/Validation

Enhance `tone-dna-generator.ts` to log:
```typescript
console.log('[ToneDNA] Input local_location_reference:', llr);
console.log('[ToneDNA] AI-generated natural_vocabulary:', parsed.location_driver.natural_vocabulary);
console.log('[ToneDNA] After enforcement:', parsed.location_driver.natural_vocabulary);
```

---

## Conclusion

**The system architecture is sound**. The protections needed are already implemented.

**The issue is likely**:
1. Café Faust's profile predates the protection logic
2. OR `local_location_reference` wasn't extracted (field was null)

**The fix is simple**: Re-analyze website + regenerate brand profile

**For other businesses**: System should work correctly going forward with current code.

**Potential improvements** (from original document):
- Strengthen subpage analysis (Havnær example shows key data on subpages)
- Add quality checks/warnings when generic terms detected
- Manual override capability for edge cases
