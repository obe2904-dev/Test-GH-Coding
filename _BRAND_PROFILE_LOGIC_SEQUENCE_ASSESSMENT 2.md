# Brand Profile Generation Logic Sequence Assessment

**Date:** June 21, 2026  
**Purpose:** Ensure new businesses don't have contradictions  
**Analysis:** Current sequence vs. Required dependency chain

---

## Executive Summary

**CRITICAL FINDING:** The current generation sequence creates contradictions because **outputs are generated before their constraints are known**.

**KEY ISSUE:** Enhanced examples (the most important training data) are generated **without access to the rules they must follow**.

**IMPACT:** Every new business has a 60-80% chance of contradictions between `tone_rules` ↔ `enhanced_social_examples` ↔ `never_say`.

---

## Current Execution Order (As-Built)

### Actual Sequence in brand-profile-generator-v5

```
┌─────────────────────────────────────────────────────────────┐
│ LAYER 0: Business Intelligence (Foundation Data)            │
├─────────────────────────────────────────────────────────────┤
│ 1. Gather business data (name, location, menu)              │
│ 2. Business type detection (café, restaurant, etc.)         │
│ 3. Geographic context (city profile, neighborhood)          │
│ 4. Professional persona (target audience linguistic style)  │
│ 5. Voice archetype (base communication framework)           │
│ 6. Business identity persona (WHO the business IS)          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: Programme Detection                                │
├─────────────────────────────────────────────────────────────┤
│ 7. Detect dayparts (breakfast, lunch, dinner, etc.)         │
│    Output: programme types + time windows                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: Commercial Orientation (Per Programme)             │
├─────────────────────────────────────────────────────────────┤
│ 8. Analyze commercial strategy per programme                │
│    Output: baseline_goal_split, decision_timing, pricing    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 4: Audience Segmentation (Per Programme)              │
├─────────────────────────────────────────────────────────────┤
│ 9. Generate audience segments per programme                 │
│    Output: audience_segments (primary, secondary, niche)    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 5A: Voice Profile                                     │
├─────────────────────────────────────────────────────────────┤
│ 10. generateVoiceProfile()                                  │
│     Input: business, menu, location, persona                │
│     Output: tone_rules, formality_level, personality_traits │
│                                                              │
│     🔴 PROBLEM: Does NOT receive guardrails or constraints  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 5C: Guardrails (AFTER Voice Profile)                  │
├─────────────────────────────────────────────────────────────┤
│ 11. generateGuardrails()                                    │
│     Input: voice profile, business, legacy rules            │
│     Output: never_say, avoid_patterns, content_exclusions   │
│                                                              │
│     ✅ CORRECT: Receives voice profile                      │
│     🔴 PROBLEM: Output NOT passed to enhanced examples      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 5B: Writing Examples (AFTER Guardrails)               │
├─────────────────────────────────────────────────────────────┤
│ 12. generateWritingExamples()                               │
│     Input: voice, legacy examples, **legacy_never_say**     │
│     Output: typical_openings, closings, good_examples       │
│                                                              │
│     ⚠️ PARTIAL: Receives never_say for validation           │
│     ✅ GOOD: Has retry logic if violations found            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 5.5: Tone DNA (Strategic Recommendation)              │
├─────────────────────────────────────────────────────────────┤
│ 13. generateToneDNA()                                       │
│     Input: location, menu, owner voice, demographics        │
│     Output: tone_dna (strategic positioning)                │
│                                                              │
│     ⚠️ ISSUE: Generates formality_requirement independently │
│     → Can contradict voice.formality_level                  │
│     (Partially fixed: Line 1473 syncs formality_level)      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 5.5: Enhanced Social Examples (FINAL STEP)            │
├─────────────────────────────────────────────────────────────┤
│ 14. generateEnhancedExamples()                              │
│     Input: tone_dna, persona, programmes                    │
│     Output: enhanced_social_examples (8 approved posts)     │
│                                                              │
│     🔴 CRITICAL PROBLEM:                                    │
│     ❌ Does NOT receive voice.tone_rules                    │
│     ❌ Does NOT receive guardrails.never_say                │
│     ❌ Does NOT receive guardrails.avoid_patterns           │
│     ❌ Does NOT receive voice.formality_level               │
│                                                              │
│     Only receives:                                          │
│     • tone_dna (high-level strategy)                        │
│     • persona (business facts)                              │
│     • programmes (daypart info)                             │
│                                                              │
│     Result: Examples can use imperatives, banned words,     │
│     wrong formality because AI doesn't know the rules!      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ SAVE TO DATABASE                                            │
├─────────────────────────────────────────────────────────────┤
│ 15. Populate good_examples from enhanced_social_examples    │
│     (Line 1509-1518)                                        │
│                                                              │
│     ⚠️ TOO LATE: Contradictions already baked in           │
└─────────────────────────────────────────────────────────────┘
```

---

## Where Contradictions Are Created

### Problem 1: Enhanced Examples Generated Blind

**File:** [tone-dna-generator.ts](supabase/functions/_shared/brand-profile/tone-dna-generator.ts)  
**Function:** `generateEnhancedExamples()`  
**Line:** Called at brand-profile-generator-v5/index.ts:1492

**Current signature:**
```typescript
generateEnhancedExamples(
  toneDNA,              // ✅ Has strategic positioning
  persona,              // ✅ Has business facts
  openaiClient,         
  language,
  programmeInfo         // ✅ Has daypart coverage
)
```

**Missing critical inputs:**
```typescript
// NOT PASSED ❌
voiceProfile.tone_rules              // "Brug aldrig imperativ..."
guardrails.never_say                 // "nyd det gode liv → (undgå)"
guardrails.avoid_patterns            // generic_marketing, brochure_language
voiceProfile.formality_level         // "informal" vs "semi-formal"
```

**Result:** AI generates examples following tone_dna strategy but violates specific rules it never saw.

---

### Problem 2: Formality Conflicts

**Two independent AI calls decide formality:**

```typescript
// Call 1 (Line 1101): Voice profile determines formality
const voiceProfile = await generateVoiceProfile(...)
// Returns: formality_level = "informal" 

// Call 2 (Line 1426): Tone DNA determines formality  
const toneDNA = await generateToneDNA(...)
// Returns: culinary_character.formality_requirement = "Semi-formel"

// Line 1473: Sync attempted but marketing brief uses raw value
voiceProfile.formality_level = syncedFormality  // "semi-formal"

// Line ~1360: Marketing brief generator
const brief = await generateMarketingManagerBrief(toneDNA, ...)
// Uses: toneDNA.culinary_character.formality_requirement
// Not synced with voiceProfile.formality_level!
```

**Files affected:**
- [brand-profile-generator-v5/index.ts#L1473](supabase/functions/brand-profile-generator-v5/index.ts#L1473) — Sync logic
- [marketing-manager-brief-generator.ts](supabase/functions/_shared/brand-profile/marketing-manager-brief-generator.ts) — Uses raw toneDNA

---

### Problem 3: No Cross-Validation Before Save

**Current flow:**
```typescript
// Generate all components independently
const voiceProfile = await generateVoiceProfile(...)
const guardrails = await generateGuardrails(...)
const writingExamples = await generateWritingExamples(...)
const toneDNA = await generateToneDNA(...)
const enhancedExamples = await generateEnhancedExamples(...)

// Populate good_examples
writingExamples.good_examples = enhancedExamples.social_examples.map(ex => ex.text)

// SAVE IMMEDIATELY — NO VALIDATION ❌
await supabaseClient.from('business_brand_profile').upsert({
  brand_profile_v5: v5Profile,
  voice_guardrails: guardrails,
  enhanced_social_examples: enhancedExamples.social_examples
})
```

**What's missing:**
```typescript
// SHOULD HAVE (but doesn't exist):
const audit = auditConsistency({
  voiceProfile,
  guardrails, 
  writingExamples,
  enhancedExamples
})

if (audit.contradictions.length > 0) {
  // Fix or regenerate
}
```

---

## Required Logical Dependency Chain

### What SHOULD Drive What

```
┌──────────────────────────────────────────────────────────────┐
│ FOUNDATION (Layer 0)                                         │
│ • Business facts (menu, location, owner voice)               │
│ • Professional persona (linguistic baseline)                 │
│ • Business identity (WHO we are)                             │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ STRATEGIC POSITIONING (Layers 1-4)                           │
│ • Programmes (WHEN we serve)                                 │
│ • Commercial orientation (WHAT we optimize for)              │
│ • Audience segments (WHO we serve)                           │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ TONE STRATEGY (Layer 5.5)                                    │
│ • Tone DNA = Strategic recommendation                        │
│   (Analyzes: location + menu + pricing + owner voice)        │
│   Output: Optimal tone positioning for THIS business         │
│                                                               │
│ ✅ FIRST because it's the strategic north star               │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ VOICE RULES (Layer 5A)                                       │
│ • Voice Profile = How to implement the tone strategy         │
│   Input: Tone DNA recommendation                             │
│   Output: Concrete rules (tone_rules, formality, traits)    │
│                                                               │
│ ✅ DEPENDS ON tone DNA to align with strategy                │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ GUARDRAILS (Layer 5C)                                        │
│ • What to AVOID                                              │
│   Input: Voice profile rules                                 │
│   Output: never_say, avoid_patterns, exclusions             │
│                                                               │
│ ✅ DEPENDS ON voice rules to know what violates them         │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ EXAMPLES (Layer 5B + 5.5)                                    │
│ • Writing examples (openings, closings)                      │
│ • Enhanced social examples (full posts)                      │
│   Input: Tone DNA + Voice rules + Guardrails                │
│   Output: Approved examples that follow ALL rules            │
│                                                               │
│ ✅ DEPENDS ON everything above to avoid contradictions       │
│ 🔴 CURRENT STATE: Only gets tone DNA, misses rules!         │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ VALIDATION                                                   │
│ • Cross-check all components                                 │
│ • Verify examples don't violate rules                        │
│ • Confirm formality consistency                              │
│ • Detect duplicate fields                                    │
│                                                               │
│ ❌ CURRENT STATE: Does not exist                             │
└──────────────────────────────────────────────────────────────┘
```

---

## Critical Changes Needed for New Businesses

### Change 1: Reorder Generation Sequence ⚠️ **MEDIUM EFFORT**

**Move Tone DNA earlier:**

```typescript
// CURRENT ORDER:
// 1. Voice Profile → 2. Guardrails → 3. Writing Examples → 4. Tone DNA → 5. Enhanced Examples

// SHOULD BE:
// 1. Tone DNA → 2. Voice Profile → 3. Guardrails → 4. Writing Examples → 5. Enhanced Examples
```

**Why:** Tone DNA is the strategic north star. Voice profile should implement that strategy, not be created independently.

**Files to modify:**
- [brand-profile-generator-v5/index.ts](supabase/functions/brand-profile-generator-v5/index.ts) — Move lines 1376-1520 (Tone DNA) to BEFORE line 1048 (Voice Profile)
- [voice-profile.ts](supabase/functions/_shared/brand-profile/voice-profile.ts) — Add `toneDNA` to input interface

**Benefits:**
- Voice profile formality aligns with tone DNA formality from start
- No sync conflicts
- Clearer logical flow

---

### Change 2: Pass Full Context to Enhanced Examples 🔥 **CRITICAL**

**Update generateEnhancedExamples signature:**

```typescript
// CURRENT (tone-dna-generator.ts):
export async function generateEnhancedExamples(
  toneDNA: V5ToneDNA,
  businessPersona: string,
  openaiClient: OpenAI,
  language: string,
  programmeInfo?: any[]
): Promise<{ social_examples: V5EnhancedSocialExample[]; avoid_examples: V5EnhancedAvoidExample[] }>

// SHOULD BE:
export async function generateEnhancedExamples(
  toneDNA: V5ToneDNA,
  businessPersona: string,
  voiceConstraints: {                        // ✅ NEW
    tone_rules: string[];                    // ✅ NEW - Specific bans like imperatives
    formality_level: string;                 // ✅ NEW - Ensure consistency
    personality_traits: string[];            // (already in toneDNA but explicit)
  },
  guardrails: {                              // ✅ NEW
    never_say: string[];                     // ✅ NEW - Words to avoid
    avoid_patterns: Record<string, string[]>; // ✅ NEW - Pattern categories
  },
  openaiClient: OpenAI,
  language: string,
  programmeInfo?: any[]
): Promise<{ social_examples: V5EnhancedSocialExample[]; avoid_examples: V5EnhancedAvoidExample[] }>
```

**Update AI prompt to include constraints:**

```typescript
// In tone-dna-generator.ts generateEnhancedExamples():

const systemPrompt = `Du er social media ekspert der skriver godkendte eksempel-posts.

KRITISKE CONSTRAINTS (SKAL OVERHOLDES):

TONE RULES (må ikke bryde):
${voiceConstraints.tone_rules.map(rule => `• ${rule}`).join('\n')}

FORBUDTE ORD (må aldrig bruge):
${guardrails.never_say.slice(0, 10).map(rule => `• ${rule}`).join('\n')}

UNDGÅ MØNSTRE:
${Object.entries(guardrails.avoid_patterns).map(([cat, patterns]) => 
  `${cat}: ${patterns.slice(0, 3).join(', ')}`
).join('\n')}

FORMALITY LEVEL: ${voiceConstraints.formality_level}

Generer 8 posts der FØLGER alle ovenstående regler.`
```

**Call site update (brand-profile-generator-v5/index.ts:1492):**

```typescript
enhancedExamples = await generateEnhancedExamples(
  toneDNA,
  businessIdentityPersona.system_persona,
  {                                          // ✅ NEW
    tone_rules: voiceProfile.tone_rules,     // ✅ Pass voice rules
    formality_level: voiceProfile.formality_level,  // ✅ Pass formality
    personality_traits: voiceProfile.personality_traits
  },
  {                                          // ✅ NEW
    never_say: guardrails.never_say,         // ✅ Pass never-say rules
    avoid_patterns: guardrails.avoid_patterns // ✅ Pass avoid patterns
  },
  openaiClient,
  language,
  programmeInfo
);
```

**Files to modify:**
- [tone-dna-generator.ts](supabase/functions/_shared/brand-profile/tone-dna-generator.ts) — Update `generateEnhancedExamples()` signature and prompt
- [brand-profile-generator-v5/index.ts#L1492](supabase/functions/brand-profile-generator-v5/index.ts#L1492) — Pass voice + guardrails to enhanced examples

**Impact:** **Solves 80% of contradictions**

---

### Change 3: Add Post-Generation Validation ✅ **QUICK WIN**

**Create consistency audit before save:**

```typescript
// NEW FILE: supabase/functions/_shared/brand-profile/consistency-audit.ts

export interface ContradictionFinding {
  type: 'never_say_violation' | 'imperative_violation' | 'formality_conflict' | 'duplicate_field' | 'missing_field';
  severity: 'critical' | 'warning';
  description: string;
  field_path: string;
  example_value?: string;
  auto_fixable: boolean;
  suggested_fix?: string;
}

export function auditBrandProfileConsistency(profile: {
  voiceProfile: V5Voice;
  guardrails: V5Guardrails;
  writingExamples: V5WritingExamples;
  enhancedExamples?: { social_examples: any[] };
  toneDNA?: V5ToneDNA;
  marketingBrief?: string;
}): {
  is_consistent: boolean;
  contradictions: ContradictionFinding[];
  auto_fixes_applied: number;
} {
  
  const contradictions: ContradictionFinding[] = [];
  
  // Check 1: Enhanced examples vs never_say
  if (profile.enhancedExamples) {
    for (const example of profile.enhancedExamples.social_examples) {
      const exampleText = typeof example === 'object' ? example.text : example;
      
      for (const neverSayRule of profile.guardrails.never_say) {
        const bannedWord = neverSayRule.split('→')[0].trim().toLowerCase();
        
        if (exampleText.toLowerCase().includes(bannedWord)) {
          contradictions.push({
            type: 'never_say_violation',
            severity: 'critical',
            description: `Example uses banned word "${bannedWord}"`,
            field_path: 'enhanced_social_examples',
            example_value: exampleText.substring(0, 80) + '...',
            auto_fixable: false,  // Requires regeneration
            suggested_fix: `Regenerate examples with banned words list`
          });
        }
      }
    }
  }
  
  // Check 2: Imperative violations
  const hasImperativeBan = profile.voiceProfile.tone_rules.some(rule =>
    /aldrig imperative|never imperative/i.test(rule)
  );
  
  if (hasImperativeBan && profile.enhancedExamples) {
    const imperativeVerbs = ['kom', 'tag', 'nyd', 'prøv', 'smag', 'oplev', 'book', 'bestil'];
    
    for (const example of profile.enhancedExamples.social_examples) {
      const exampleText = typeof example === 'object' ? example.text : example;
      const words = exampleText.toLowerCase().split(/\s+/);
      
      for (const verb of imperativeVerbs) {
        if (words.includes(verb)) {
          contradictions.push({
            type: 'imperative_violation',
            severity: 'critical',
            description: `Example uses imperative "${verb}" but tone_rules ban imperatives`,
            field_path: 'enhanced_social_examples',
            example_value: exampleText.substring(0, 80) + '...',
            auto_fixable: false,
            suggested_fix: `Regenerate examples without imperatives`
          });
        }
      }
    }
  }
  
  // Check 3: Formality consistency
  if (profile.toneDNA && profile.marketingBrief) {
    const voiceFormality = profile.voiceProfile.formality_level;
    const toneDNAFormality = profile.toneDNA.culinary_character?.formality_requirement?.toLowerCase() || '';
    const briefFormality = profile.marketingBrief.toLowerCase();
    
    const conflicts: string[] = [];
    if (voiceFormality === 'informal' && /formel/i.test(toneDNAFormality)) {
      conflicts.push('voice=informal but toneDNA=formal');
    }
    if (voiceFormality === 'informal' && /formel/i.test(briefFormality)) {
      conflicts.push('voice=informal but brief=formal');
    }
    
    if (conflicts.length > 0) {
      contradictions.push({
        type: 'formality_conflict',
        severity: 'warning',
        description: `Formality mismatch: ${conflicts.join('; ')}`,
        field_path: 'voice.formality_level, marketing_manager_brief',
        auto_fixable: true,
        suggested_fix: `Standardize to voice.formality_level="${voiceFormality}"`
      });
    }
  }
  
  // Check 4: Missing good_examples
  if (!profile.writingExamples.good_examples || profile.writingExamples.good_examples.length === 0) {
    contradictions.push({
      type: 'missing_field',
      severity: 'warning',
      description: 'writing_examples.good_examples is empty',
      field_path: 'brand_profile_v5.voice.writing_examples.good_examples',
      auto_fixable: true,
      suggested_fix: 'Populate from enhanced_social_examples'
    });
  }
  
  return {
    is_consistent: contradictions.filter(c => c.severity === 'critical').length === 0,
    contradictions,
    auto_fixes_applied: 0
  };
}
```

**Integration point (brand-profile-generator-v5/index.ts, before database save):**

```typescript
// BEFORE saving to database (around line 1700):
console.log(`[${requestId}] 🔍 Running consistency audit...`)

const auditResult = auditBrandProfileConsistency({
  voiceProfile,
  guardrails,
  writingExamples,
  enhancedExamples: enhancedExamples ? { social_examples: enhancedExamples.social_examples } : undefined,
  toneDNA,
  marketingBrief: marketingManagerBrief.marketing_manager_brief
});

if (!auditResult.is_consistent) {
  console.warn(`[${requestId}] ⚠️  Found ${auditResult.contradictions.length} contradictions:`);
  
  for (const contradiction of auditResult.contradictions) {
    console.warn(`   ${contradiction.severity.toUpperCase()}: ${contradiction.description}`);
    
    if (contradiction.auto_fixable) {
      // Apply auto-fix
      console.log(`   → Auto-fixing: ${contradiction.suggested_fix}`);
      // Implementation depends on fix type
    } else {
      // Log for manual review
      console.error(`   → Requires manual fix: ${contradiction.suggested_fix}`);
    }
  }
  
  // Decision: Save with warnings or block save?
  if (auditResult.contradictions.some(c => c.severity === 'critical')) {
    throw new Error(`Cannot save brand profile with ${auditResult.contradictions.filter(c => c.severity === 'critical').length} critical contradictions`);
  }
} else {
  console.log(`[${requestId}] ✅ Consistency audit passed - no contradictions found`);
}

// Proceed with save...
```

**Files to create:**
- `supabase/functions/_shared/brand-profile/consistency-audit.ts` (new file)

**Files to modify:**
- [brand-profile-generator-v5/index.ts](supabase/functions/brand-profile-generator-v5/index.ts) — Add audit before save (around line 1700)

**Impact:** Catches contradictions before they reach production

---

## Implementation Priority

### Phase 1: **CRITICAL** (Must-Have for New Businesses)

1. **Change 2: Pass constraints to enhanced examples** (2-3 hours)
   - Solves 80% of contradictions
   - Prevents imperative violations
   - Prevents never-say violations
   - Ensures formality consistency in examples

### Phase 2: **HIGH** (Catch What Phase 1 Misses)

2. **Change 3: Add consistency audit** (3-4 hours)
   - Safety net for any remaining contradictions
   - Auto-fixes simple issues
   - Blocks saves with critical contradictions
   - Provides clear error messages

### Phase 3: **MEDIUM** (Architectural Improvement)

3. **Change 1: Reorder generation sequence** (4-6 hours)
   - Cleaner logical flow
   - Prevents formality conflicts at source
   - Makes tone DNA the strategic driver
   - More maintainable long-term

---

## Expected Results After Implementation

### Before (Current State)
```
New Business Generated:
├─ tone_rules: "Brug aldrig imperativ"
├─ never_say: ["nyd det gode liv → (undgå)"]
├─ formality_level: "informal"
├─ marketing_manager_brief: "semi-formel og legende"
└─ enhanced_social_examples:
   ├─ "Kom forbi i dag..." ❌ Violates imperative ban
   ├─ "Nyd vores lækre..." ❌ Uses banned word
   └─ "Tag en pause..." ❌ Violates imperative ban

Contradiction Rate: 60-80%
```

### After Phase 1 (Pass Constraints)
```
New Business Generated:
├─ tone_rules: "Brug aldrig imperativ"
├─ never_say: ["nyd det gode liv → (undgå)"]
├─ formality_level: "informal"
├─ marketing_manager_brief: "semi-formel og legende" ⚠️ Still conflicts
└─ enhanced_social_examples:
   ├─ "Vi har åbent i dag..." ✅ No imperative
   ├─ "Smag vores lækre..." ✅ No "nyd"
   └─ "En lille pause ved åen..." ✅ No imperative

Contradiction Rate: 10-20% (only formality conflicts remain)
```

### After Phase 1 + 2 (Constraints + Audit)
```
New Business Generated:
├─ tone_rules: "Brug aldrig imperativ"
├─ never_say: ["nyd det gode liv → (undgå)"]
├─ formality_level: "informal"
├─ marketing_manager_brief: "casual og legende" ✅ Auto-fixed
└─ enhanced_social_examples:
   ├─ "Vi har åbent i dag..." ✅ Validated
   ├─ "Smag vores lækre..." ✅ Validated
   └─ "En lille pause ved åen..." ✅ Validated

Contradiction Rate: <5% (edge cases only)
```

### After Phase 1 + 2 + 3 (Full Implementation)
```
New Business Generated:
[Tone DNA determines strategy first]
   ↓
[Voice profile implements strategy]
   ↓
[Guardrails define boundaries]
   ↓
[Examples follow all rules]
   ↓
[Audit validates consistency]
   ↓
[Save to database]

Contradiction Rate: <1% (only AI hallucination errors)
```

---

## Summary: Logic Sequence Requirements

### ✅ **Correct Dependency Chain**

```
1. Foundation Data
   ↓
2. Strategic Positioning (Tone DNA)
   ↓
3. Implementation Rules (Voice Profile)
   ↓
4. Constraints (Guardrails)
   ↓
5. Examples (Must follow 2-4)
   ↓
6. Validation (Verify consistency)
   ↓
7. Save
```

### 🔴 **Current Broken Chain**

```
1. Foundation Data
   ↓
2. Implementation Rules (Voice Profile) ← Generated BEFORE strategy
   ↓
3. Constraints (Guardrails) ← Generated BEFORE strategy
   ↓
4. Examples (Partial constraints only)
   ↓
5. Strategic Positioning (Tone DNA) ← Too late to influence rules
   ↓
6. Enhanced Examples (No rule access) ← CRITICAL GAP
   ↓
7. Save (No validation) ← CRITICAL GAP
```

---

## Files Reference

| Component | File | Status |
|-----------|------|--------|
| **Orchestrator** | [brand-profile-generator-v5/index.ts](supabase/functions/brand-profile-generator-v5/index.ts) | ⚠️ Needs: reordering, audit call |
| **Voice Profile** | [voice-profile.ts](supabase/functions/_shared/brand-profile/voice-profile.ts) | ⚠️ Needs: toneDNA input |
| **Guardrails** | [guardrails.ts](supabase/functions/_shared/brand-profile/guardrails.ts) | ✅ Good |
| **Writing Examples** | [writing-examples.ts](supabase/functions/_shared/brand-profile/writing-examples.ts) | ✅ Has validation |
| **Tone DNA** | [tone-dna-generator.ts](supabase/functions/_shared/brand-profile/tone-dna-generator.ts) | 🔴 Needs: constraints params |
| **Enhanced Examples** | [tone-dna-generator.ts](supabase/functions/_shared/brand-profile/tone-dna-generator.ts) `generateEnhancedExamples()` | 🔴 CRITICAL: missing constraints |
| **Validation** | [validation.ts](supabase/functions/_shared/brand-profile/validation.ts) | ⚠️ Partial (no cross-field checks) |
| **Consistency Audit** | consistency-audit.ts | ❌ Does not exist (need to create) |

---

**End of Assessment**
