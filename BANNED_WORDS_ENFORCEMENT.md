# Banned Words Enforcement & Quality Gates

## Critical Rules (Zero Tolerance)

### 1. Target Audience - Strict Persona Ban

**BANNED WORDS (must NEVER appear):**
```
familier, børnefamilier, par, venner,
turister, studerende, lokale, unge
```

**Validation Rule:**
```typescript
const BAN_WORDS_TARGET_AUDIENCE = [
  'familier', 'børnefamilier', 'par', 'venner',
  'turister', 'studerende', 'lokale', 'unge'
];

function validateTargetAudience(text: string): boolean {
  const lowerText = text.toLowerCase();
  return !BAN_WORDS_TARGET_AUDIENCE.some(word => 
    lowerText.includes(word.toLowerCase())
  );
}
```

**Required Format:**
- Each clause = SITUATION + TIME + CONTEXT
- Pattern: "Når gæster [behavior + context], når [situation + time], samt når [transition]"

**Valid Examples:**
- ✅ "Når gæster samles om længere brunch ved bordet"
- ✅ "Når børn kan spise med uden bøvl"
- ✅ "Når aftenen glider fra middag til cocktails"

**Invalid Examples:**
- ❌ "For familier med børn" (demographic)
- ❌ "Når par søger romantisk middag" (persona)
- ❌ "Turister og lokale" (persona labels)

### 2. Tone of Voice - No Subjective Words

**BANNED WORDS (must NEVER appear):**
```
lækker, hyggelig, afslappet, autentisk, 
unik, charmerende, fantastisk
```

**Replacement Rules:**
- ❌ "afslappet" → ✅ "roligt tempo", "i eget tempo", "god tid"
- ❌ "lækker" → ✅ observable descriptors ("sprød", "cremet", "syrlig")
- ❌ "hyggelig" → ✅ specific details ("candlelight", "wood interior")

**Required Format:**
- Rule-based (not descriptive prose)
- 3-5 style rules as bullets
- 2-3 concrete examples with "Eksempel:"
- NO subjective adjectives in examples

**Valid Structure:**
```
- Direkte og uformel uden marketing-sprog
- Beskrivende frem for vurderende
- Fokus på konkrete situationer

Eksempel: Brunch ved åen med god tid ved bordet
Eksempel: Middag der kan fortsætte i baren
Eksempel: BOOK DIT BORD

Undgå: Vurderende tillægsord
```

### 3. Brand Essence - ONE Behavioral Hook

**BANNED WORDS:**
```
lækker, hyggelig, afslappet, autentisk,
unik, charmerende, fantastisk
```

**Required Components:**
1. Venue type (café/restaurant/bar)
2. Location cue (ved åen, i Aarhus C)
3. Offering cue (brunch, frokost, middag)
4. **Exactly ONE behavioral hook** (flow/duration/transition/tempo)

**Valid Hooks (behavioral only):**
- ✅ "roligt tempo"
- ✅ "glide naturligt over i aftenen"
- ✅ "lange ophold"
- ✅ "fra dag til aften"

**Invalid Hooks:**
- ❌ Menu items alone ("lækker brunch")
- ❌ Location alone ("ved åen" without behavior)
- ❌ Subjective words ("hyggelig stemning")

**Example (correct):**
"Café ved åen hvor brunch og frokost kan nydes i roligt tempo og glide naturligt over i aftenen."

**Example (wrong):**
"Café ved åen med lækker mad og hyggelig stemning." (banned words, no behavioral hook)

### 4. Signature Shot - Observable Only

**BANNED WORDS:**
```
lækker, hyggelig, afslappet, charmerende, fantastisk
```

**Required:**
- Observable scene (what's happening)
- Lighting description
- Visible people/objects
- Location cue

**Example (correct):**
"Gæster der bliver siddende ved bordet ved åen i gyldent aftenlys, med flere retter og glas på bordet"

**Example (wrong):**
"Lækker mad og hyggelig oplevelse ved åen" (subjective, banned words)

### 5. Content Focus - Usage-Driven

**Must Map To:**
- usage_occasions[] (not menu alone)
- content_triggers[] (what_to_show, copy_angles)

**Required Coverage:**
1. Mad & servering (observable dishes)
2. Stemning & flow (time/transition)
3. Øjeblikke (duration/behavior)

**Example (correct):**
"- Retter der deles og bliver stående på bordet
- Overgangen fra dag til aften ved åen
- Lange ophold, samtaler, flere bestillinger over tid"

**Example (wrong):**
"Fokus på brunch og frokost" (menu-only, no behavioral insight)

## Validation Checklist

### Pre-Generation Checks
- [ ] usage_occasions[] produced (3-6 items)
- [ ] content_triggers[] produced (3-5 items)
- [ ] Each occasion has ≥1 evidence quote
- [ ] Each trigger has ≥1 evidence quote

### Post-Generation Checks

**Target Audience:**
- [ ] No banned persona words present
- [ ] Uses "Når gæster..." temporal format
- [ ] 2-4 occasions listed
- [ ] Each clause has SITUATION + TIME + CONTEXT

**Tone of Voice:**
- [ ] Rule-based (not descriptive)
- [ ] No banned words in examples
- [ ] Has "Eksempel:" lines
- [ ] Uses observable language

**Brand Essence:**
- [ ] ONE sentence
- [ ] Has venue type + location + offerings
- [ ] Has ONE behavioral hook (flow/duration/tempo)
- [ ] No banned words

**Signature Shot:**
- [ ] Observable scene description
- [ ] No banned words
- [ ] Includes lighting + people/objects + location

**Content Focus:**
- [ ] Maps to usage_occasions
- [ ] Covers 3+ distinct areas
- [ ] Not menu-only

## AI Ideas Generation Rules

**MUST Read From:**
1. usage_occasions[] - behavioral richness
2. content_triggers[] - what to show + copy angles
3. tone_of_voice rules - writing system

**MUST NOT:**
- Rely primarily on Brand Profile prose alone
- Brand Profile = compressed label for UI
- Internal layers = thinking for AI

**Why This Separation Matters:**
- Brand Profile stays compact and editable
- AI suggestions get richer behavioral context
- No compression loss from Layer 1→2→3

## Error Messages for Violations

```typescript
// Target Audience
if (containsBannedWords(targetAudience, BAN_WORDS_TARGET_AUDIENCE)) {
  throw new Error(
    'Target audience contains banned persona words. ' +
    'Use temporal behavioral format: "Når gæster [behavior]..." ' +
    'Banned: familier, par, turister, studerende, unge, lokale, venner'
  );
}

// Tone of Voice
if (containsBannedWords(toneOfVoice, BANNED_SUBJECTIVE_WORDS)) {
  throw new Error(
    'Tone of voice contains banned subjective words. ' +
    'Use observable, descriptive language. ' +
    'Banned: lækker, hyggelig, afslappet, autentisk, unik'
  );
}

// Brand Essence
if (!hasBehavioralHook(brandEssence)) {
  throw new Error(
    'Brand essence missing behavioral hook. ' +
    'Required: ONE hook describing flow/duration/tempo. ' +
    'Examples: "roligt tempo", "glide over i aftenen", "lange ophold"'
  );
}
```

## Quality Gates Summary

| Field | Banned Words | Required Format | Maps To Layer |
|-------|-------------|-----------------|---------------|
| target_audience | Personas | Når gæster... | usage_occasions[] |
| tone_of_voice | Subjective | Rule-based | tone rules |
| brand_essence | Subjective | ONE behavioral hook | Distinctive hooks |
| signature_shot | Subjective | Observable scene | Images |
| content_focus | - | Usage-driven | content_triggers[] |

## Testing Strategy

1. **Unit Tests:**
   - Validate no banned words in output
   - Validate required format patterns
   - Validate usage_occasion count (3-6)
   - Validate evidence quotes present

2. **Integration Tests:**
   - Generate Brand Profile for test venue
   - Run all validation checks
   - Verify AI Ideas read from internal layers

3. **Regression Tests:**
   - Test against known good examples
   - Test against known bad examples (should fail)
   - Ensure consistency across venue types

## Success Criteria

✅ **System passes when:**
- Zero banned words in target_audience
- Zero subjective words in tone_of_voice
- Brand essence has ONE behavioral hook
- Content focus maps to usage occasions
- AI Ideas read from internal layers (not Brand Profile alone)

❌ **System fails when:**
- Any banned persona word appears
- Subjective marketing words leak through
- Brand essence is generic (no behavioral hook)
- Content focus is menu-only
- AI Ideas rely solely on Brand Profile prose
