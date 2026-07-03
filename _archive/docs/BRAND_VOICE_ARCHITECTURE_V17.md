# Brand Voice Architecture - v17 Foundation
**Date:** 17. februar 2026  
**Status:** Architectural Decision - Ready for Implementation  
**Context:** Layer 0 → Weekly Plan → Caption flow optimization

---

## Executive Summary

**Problem:** Weekly plan captions use generic language ("kom forbi og nyd") despite strategy narrative avoiding it.

**Root Cause:** Enriched brand voice fields (never_say: 80 words, signature_phrases, humor_level) exist in database but `weekly-plan-generator.ts` only passes 5 legacy fields to caption generator.

**Solution:** 3-phase implementation prioritizing unified architecture as foundation.

---

## Phase Decisions (APPROVED)

### Phase 1: Foundation (3-4 hours)
**Scope:** Unified type + centralized fetch + data flow fix

**Rationale:** Establishes architectural foundation preventing future technical debt. Gets type consistency right before business logic extensions.

**Components:**
- Create unified `BrandVoice` type in `_shared/types/`
- Use existing `fetchBrandProfile()` from `_shared/brand-profile/database.ts` (currently unused!)
- Pass enriched fields through to caption generator
- Fix word display prioritization

### Phase 2: Context-Aware Anti-Patterns (2-3 hours)
**Scope:** Business-type-agnostic generic warnings via CountryConfig

**Rationale:** Removes hardcoded café assumptions. Supports wine bar, food truck, restaurant with appropriate context.

**Components:**
- Extend `CountryConfig` with `antiPatterns` by business type
- Add `voiceGuidance` section to prompts
- Make strategy generator use config instead of hardcoded strings

### Phase 3: Country-Aware Prompts (3-4 hours)
**Scope:** Strategy generator i18n for Swedish/Norwegian expansion

**Rationale:** Not blocking current quality but designed into Phase 2 structure.

**Components:**
- Add strategy prompts to `CountryConfig`
- Create country template system
- Test market expansion readiness

---

## Critical Findings

### 1. Unused Infrastructure Exists
**Discovery:** `fetchBrandProfile()` already exists in `_shared/brand-profile/database.ts` line 186.

**Impact:** Both edge functions duplicate this fetch logic instead of importing it.

**Location:**
```typescript
// supabase/functions/_shared/brand-profile/database.ts:186
export async function fetchBrandProfile(
  supabase: any,
  businessId: string
): Promise<any | null>
```

**Action:** Use existing function, don't recreate.

---

### 2. Data Loss at aiContext Construction
**Discovery:** `weekly-plan-generator.ts` fetches ALL brand profile fields but only passes 5 legacy fields to caption generator.

**Location:** `supabase/functions/weekly-plan-generator.ts` lines 920-960

**Current (BROKEN):**
```typescript
const aiContext = {
  brandVoice: {
    tone_keywords: fullBrandProfile?.tone_keywords || [],
    voice_style: fullBrandProfile?.voice_style || 'casual',
    values: fullBrandProfile?.values || [],
    certifications: fullBrandProfile?.certifications || [],
    do_not_say: fullBrandProfile?.do_not_say || { words: [] }
    // ❌ Missing: signature_phrases
    // ❌ Missing: never_say (80 words!)
    // ❌ Missing: typical_openings
    // ❌ Missing: humor_level
    // ❌ Missing: formality
  }
}
```

**Required (Phase 1):**
```typescript
brandVoice: {
  // Enriched fields (priority)
  signature_phrases: fullBrandProfile?.signature_phrases || [],
  never_say: fullBrandProfile?.never_say || [],
  typical_openings: fullBrandProfile?.typical_openings || [],
  typical_closings: fullBrandProfile?.typical_closings || [],
  humor_level: fullBrandProfile?.humor_level,
  formality: fullBrandProfile?.formality,
  emoji_style: fullBrandProfile?.emoji_style,
  
  // Legacy (backward compatibility)
  tone_keywords: fullBrandProfile?.tone_keywords || [],
  voice_style: fullBrandProfile?.voice_style || 'casual',
  // ...
}
```

---

### 3. Caption Generator Logic Ready
**Discovery:** `prompt-builder.ts` has branching logic for enriched fields but receives empty legacy data.

**Location:** `supabase/functions/_shared/ai-caption-generator/prompt-builder.ts` lines 120-190

**Code:**
```typescript
const hasEnriched = voice.signature_phrases?.length || voice.never_say?.length;

const bannedWords = voice.never_say?.length 
  ? voice.never_say 
  : voice.do_not_say?.words;  // Falls back to empty array
```

**Status:** ✅ Logic correct, ❌ Data not passed

---

### 4. Word Display Limitation
**Discovery:** Only shows first 8 banned words, which are English/cities (#foodporn, Aalborg, CPH, Copenhagen...)

**Location:** `supabase/functions/_shared/ai-caption-generator/prompt-builder.ts` line 148

**Current:**
```typescript
section += `- ⚠️ UNDGÅ DISSE ORD: ${bannedWords.slice(0, 8).join(', ')}\n`;
```

**Issues:**
- Database has 80 words in never_say
- First 8 are English/cities (not Danish phrases causing issues)
- "kom forbi", "nyd", "kaffepause" NOT in database at all

**Required (Phase 1):**
- Prioritize Danish words first
- Show 15-20 words instead of 8
- Consider sorting: Danish phrases → English terms → city names

---

### 5. Hardcoded Business-Type Assumptions
**Discovery:** Strategy generator has hardcoded café-specific warnings.

**Location:** `supabase/functions/_shared/post-helpers/weekly-strategy-generator.ts` lines 1714-1722

**Current:**
```typescript
BRAND VOICE (KRITISK - UNDGÅ GENERISK CAFÉ-SPROG):
- Undgå: "kaffepause", "kom indenfor", "nyd" (generisk - alle caféer siger det)
```

**Problem:** Doesn't work for:
- Wine bar (generic: "skål", "nyd vinen", "kom og smag")
- Food truck (generic: "find os", "kom og hent", "street food")
- Restaurant (generic: "kom og spis", "nyd måltidet")

**Solution (Phase 2):** Context-aware anti-patterns via `CountryConfig`

---

### 6. Asymmetric i18n Support
**Discovery:** Caption generator has robust `CountryConfig`, strategy generator has hardcoded Danish.

**Caption Generator:**
```typescript
// supabase/functions/_shared/ai-caption-generator/i18n-config.ts
interface CountryConfig {
  code, language, prompts, hashtags, culture
}
const DENMARK_CONFIG: CountryConfig = { ... }
```
✅ Easy to add SWEDEN_CONFIG, NORWAY_CONFIG

**Strategy Generator:**
```typescript
// Hardcoded Danish prompts throughout
"beskriv hvordan folk TÆNKER og HANDLER"
"UNDGÅ: 'kaffepause', 'kom indenfor'"
```
❌ Requires code changes for new countries

**Solution (Phase 3):** Extend `CountryConfig` structure to strategy generator

---

## Implementation Plan - Phase 1

### Part A: Unified BrandVoice Type (1 hour)

**Create:** `supabase/functions/_shared/types/brand-voice.ts`

```typescript
/**
 * Unified Brand Voice Type
 * 
 * Single source of truth for brand voice data structure.
 * Used by strategy generator, weekly plan generator, and caption generator.
 * 
 * Design: Enriched fields are primary, legacy fields for backward compatibility.
 */

export interface BrandVoice {
  // ============================================================================
  // ENRICHED FIELDS (Primary - from business_brand_profile table)
  // ============================================================================
  
  /** Distinctive phrases that identify this specific business */
  signature_phrases?: string[]
  
  /** Words/phrases this business should never use (80+ terms) */
  never_say?: string[]
  
  /** Opening phrases this business commonly uses */
  typical_openings?: string[]
  
  /** Closing phrases this business commonly uses */
  typical_closings?: string[]
  
  /** Humor sensibility: none, subtle, or playful */
  humor_level?: 'none' | 'subtle' | 'playful'
  
  /** Communication formality: professional, casual, or friendly */
  formality?: 'professional' | 'casual' | 'friendly'
  
  /** Emoji usage preference: none, minimal, or moderate */
  emoji_style?: 'none' | 'minimal' | 'moderate'
  
  // ============================================================================
  // LEGACY FIELDS (Backward compatibility)
  // ============================================================================
  
  /** Tone keywords (deprecated - use signature_phrases) */
  tone_keywords?: string[]
  
  /** Voice style description (deprecated - use formality) */
  voice_style?: string
  
  /** Brand values (deprecated - now in brand_essence) */
  values?: string[]
  
  /** Certifications (deprecated - now in core_offerings) */
  certifications?: string[]
  
  /** Legacy banned words structure (deprecated - use never_say) */
  do_not_say?: { words: string[] }
}

/**
 * Type guard to check if BrandVoice has enriched fields populated
 */
export function hasEnrichedVoice(voice: BrandVoice | undefined): boolean {
  if (!voice) return false
  return !!(
    voice.signature_phrases?.length ||
    voice.never_say?.length ||
    voice.humor_level ||
    voice.formality
  )
}

/**
 * Converts legacy do_not_say to enriched never_say format
 */
export function migrateLegacyVoice(voice: BrandVoice): BrandVoice {
  return {
    ...voice,
    never_say: voice.never_say?.length 
      ? voice.never_say 
      : voice.do_not_say?.words || []
  }
}
```

---

### Part B: Update Data Flow (2 hours)

#### File 1: `get-weekly-strategy/index.ts`

**Lines 509-550:** Remove duplicate fetch, use shared function

**Replace:**
```typescript
const { data: brandProfile } = await dataClient
  .from('business_brand_profile')
  .select(`...`)
  .eq('business_id', body.business_id)
  .single();
```

**With:**
```typescript
import { fetchBrandProfile } from '../_shared/brand-profile/database.ts'
import type { BrandVoice } from '../_shared/types/brand-voice.ts'

const brandProfileData = await fetchBrandProfile(dataClient, body.business_id);
```

**Lines 833-880:** Update conversion to use unified type

#### File 2: `weekly-plan-generator.ts`

**Lines 860-880:** Remove duplicate fetch, use shared function

**Lines 920-960:** Pass enriched fields (THE CRITICAL FIX)

**Replace:**
```typescript
brandVoice: {
  tone_keywords: fullBrandProfile?.tone_keywords || [],
  voice_style: fullBrandProfile?.voice_style || 'casual',
  values: fullBrandProfile?.values || [],
  certifications: fullBrandProfile?.certifications || [],
  do_not_say: fullBrandProfile?.do_not_say || { words: [] }
}
```

**With:**
```typescript
brandVoice: {
  // Enriched fields
  signature_phrases: fullBrandProfile?.signature_phrases || [],
  never_say: fullBrandProfile?.never_say || [],
  typical_openings: fullBrandProfile?.typical_openings || [],
  typical_closings: fullBrandProfile?.typical_closings || [],
  humor_level: fullBrandProfile?.humor_level,
  formality: fullBrandProfile?.formality,
  emoji_style: fullBrandProfile?.emoji_style,
  
  // Legacy (backward compatibility)
  tone_keywords: fullBrandProfile?.tone_keywords || [],
  voice_style: fullBrandProfile?.voice_style || 'casual',
  values: fullBrandProfile?.values || [],
  certifications: fullBrandProfile?.certifications || [],
  do_not_say: fullBrandProfile?.do_not_say || { words: [] }
}
```

#### File 3: `ai-caption-generator/types.ts`

**Replace inline `brandVoice` definition:**

**With:**
```typescript
import type { BrandVoice } from '../types/brand-voice.ts'

export interface CaptionGenerationContext {
  brandVoice: BrandVoice  // Use unified type
  // ... other fields
}
```

---

### Part C: Fix Word Display (30 min)

#### File 4: `ai-caption-generator/prompt-builder.ts`

**Line 148:** Improve word selection and display

**Replace:**
```typescript
section += `- ⚠️ UNDGÅ DISSE ORD: ${bannedWords.slice(0, 8).join(', ')}\n`;
```

**With:**
```typescript
// Prioritize Danish phrases over English terms and city names
const prioritizedWords = prioritizeDanishWords(bannedWords);
const displayWords = prioritizedWords.slice(0, 20);
section += `- ⚠️ UNDGÅ DISSE ORD: ${displayWords.join(', ')}\n`;

// Add helper function at top of file:
function prioritizeDanishWords(words: string[]): string[] {
  if (!words?.length) return [];
  
  const danish: string[] = [];
  const english: string[] = [];
  const cities: string[] = [];
  
  const danishPatterns = /[æøå]|^\w+\s+\w+$/i; // Has Danish chars or multi-word phrase
  const cityNames = ['Aalborg', 'Aarhus', 'Copenhagen', 'CPH', 'Odense', 'Esbjerg', 'Fredericia', 'Herning'];
  
  words.forEach(word => {
    if (cityNames.some(city => word.includes(city))) {
      cities.push(word);
    } else if (danishPatterns.test(word)) {
      danish.push(word);
    } else {
      english.push(word);
    }
  });
  
  return [...danish, ...english, ...cities];
}
```

---

## Validation Criteria - Phase 1

### Test Script

```bash
# Run full flow test
cd '/Users/olebaek/Test P2G 1'

# 1. Generate strategy
SERVICE_KEY=$(supabase projects api-keys --project-ref kvqdkohdpvmdylqgujpn -o json | jq -r '.[] | select(.name=="service_role") | .api_key')
WEEK_START=$(node -e "const t=new Date();const d=new Date(t);d.setDate(t.getDate()+((1+7-t.getDay())%7||7));console.log(d.toISOString().split('T')[0])")

curl -s "https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/get-weekly-strategy" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"business_id\":\"840347de-9ba7-4275-8aa3-4553417fc2af\",\"week_start\":\"$WEEK_START\",\"regenerate\":true}" \
  -o /tmp/l0.json

# 2. Generate weekly plan
STRATEGY_ID=$(jq -r '.strategy_id' /tmp/l0.json)

curl -s "https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/generate-weekly-plan" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"weekStart\":\"$WEEK_START\",\"business_id\":\"840347de-9ba7-4275-8aa3-4553417fc2af\",\"strategy_id\":\"$STRATEGY_ID\",\"selected_idea_ids\":[1,3],\"regenerate\":true}" \
  -o /tmp/patha.json

# 3. Check captions
jq -r '.plan.posts[] | .caption' /tmp/patha.json
```

### Success Criteria

✅ **Pass:** Captions do NOT contain:
- "kom forbi"
- "nyd"
- "kaffepause"
- "kom indenfor"
- "hyggelig stemning" (generic)

✅ **Pass:** Captions DO contain:
- Business-specific phrases from signature_phrases
- Behavioral language (consistent with strategy narrative)
- Authentic voice personality

✅ **Pass:** No regressions:
- Strategy generation still works
- Weekly plan generation still works
- All existing tests pass

---

## Open Questions for Database/Types Deep-Dive

### 1. Database Schema Alignment
**Question:** Does `business_brand_profile` table structure match our unified `BrandVoice` type?

**Check:**
- Field names consistent?
- Data types match (string[] vs JSONB)?
- Any missing fields in database that type expects?
- Any database fields we're not using?

### 2. Type System Consistency
**Question:** Are there other type definitions conflicting with unified `BrandVoice`?

**Check:**
- `_shared/brand-profile/types.ts` - `BrandProfile` vs `BrandProfileRecord`
- `_shared/post-helpers/types/strategy-types.ts` - strategy-specific types
- Type imports in multiple files creating circular dependencies?

### 3. Data Flow Verification
**Question:** Are there other places fetching brand profile we haven't identified?

**Scan for:**
```typescript
.from('business_brand_profile')
.select(
```

**Check:**
- ai-generate functions
- regenerate-caption
- test utilities
- Any cron jobs or background tasks

### 4. Legacy Conversion Logic
**Question:** Do we need migration logic for existing data?

**Scenarios:**
- Old posts with legacy `do_not_say` structure
- Cached brand profiles in memory
- Other systems expecting old structure

### 5. Performance Implications
**Question:** Does centralized fetch + passing more fields impact performance?

**Consider:**
- Edge function bundle size
- Query performance (selecting all fields)
- Memory footprint with 80-word arrays
- Should we implement field selection based on context?

---

## Risk Assessment

### Low Risk ✅
- Creating unified type (new file, no breaking changes)
- Using existing `fetchBrandProfile()` (already tested)
- Caption generator logic ready (branching already exists)

### Medium Risk ⚠️
- Removing duplicate fetches (test both functions independently)
- Type changes cascading (may affect multiple imports)
- Word prioritization logic (test with actual data)

### Mitigation Strategies
1. **Checkpoint Testing:** Test after each file change, not at end
2. **Backward Compatibility:** Keep legacy fields populated
3. **Rollback Plan:** Git branch before changes
4. **Incremental Deployment:** Test strategy function first, then weekly plan

---

## Next Steps

1. ✅ Document created (this file)
2. ⏳ **Deep-dive: Database Schema & Types** (next task)
3. ⏳ Implement Phase 1 Part A (unified type)
4. ⏳ Implement Phase 1 Part B (data flow)
5. ⏳ Implement Phase 1 Part C (word display)
6. ⏳ Validation testing
7. ⏳ Phase 2 planning

---

## References

**Related Files:**
- `supabase/functions/_shared/brand-profile/database.ts` - Existing fetch function
- `supabase/functions/_shared/brand-profile/types.ts` - Brand profile types
- `supabase/functions/_shared/ai-caption-generator/i18n-config.ts` - Country config
- `supabase/functions/get-weekly-strategy/index.ts` - Strategy generator entry
- `supabase/functions/generate-weekly-plan/index.ts` - Weekly plan entry

**Test Results:**
- `/tmp/l0.json` - Latest strategy generation output
- `/tmp/patha.json` - Latest weekly plan output

**Database:**
- Table: `business_brand_profile`
- Test business: `840347de-9ba7-4275-8aa3-4553417fc2af` (Café Faust)
- Current never_say count: 80 words

---

**Version:** v17 (Foundation Architecture)  
**Last Updated:** 17. februar 2026  
**Next Review:** After database/types deep-dive
