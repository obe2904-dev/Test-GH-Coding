# Brand Profile Generator v4.8.8 - Task 1 Implementation

## Changes Made

### 1. New Function: `checkBannedWordsConsistency()` in validators.ts
**Location**: `/Users/olebaek/Test P2G 1/supabase/functions/_shared/brand-profile/validators.ts` (lines 51-109)

**Purpose**: Validates that words listed in `things_to_avoid.language_constraints` do NOT appear anywhere else in the generated output.

**How it works**:
- Extracts banned words from `things_to_avoid.language_constraints`
- Scans all major text fields (brand_essence, core_offerings, target_audience, tone_of_voice, content_focus, communication_goal, cta_style, signature_shot)
- Uses word boundary regex (`\b...\b`) for case-insensitive exact word matching
- Returns validation errors with clear field + banned word identification

**Fields checked**:
- brand_essence.value
- core_offerings.value
- target_audience.value
- tone_of_voice.value
- content_focus.value
- communication_goal.value
- cta_style.value
- image_preferences.signature_shot

### 2. Integration into Validation Pipeline
**Location**: validators.ts (line 1103)

Called at the end of `validateBrandProfileOutput()` before returning errors:
```typescript
const bannedWordErrors = checkBannedWordsConsistency(sections)
if (bannedWordErrors.length > 0) {
  errors.push(...bannedWordErrors)
}
```

### 3. Enhanced Repair Logic
**Location**: validators.ts `repairBrandProfile()` (lines 1344-1368)

**What changed**:
- Detects banned word violations by checking for "🚫 BANNED WORD INCONSISTENCY" marker
- Adds specific repair instructions to the AI prompt when banned words are detected
- Instructs AI to:
  - Replace banned words with concrete, descriptive alternatives
  - Rephrase naturally (not just delete)
  - Use specific sensory details instead of generic adjectives
  - Keep core meaning but make it more concrete

**Example repair instructions**:
```
- "lækker brunch" → "brunch med friskbagte croissanter"
- "hyggelig stemning" → "roligt tempo og bløde lydsætninger"
- "autentisk café" → "café med 20 års historie"
```

### 4. New Function: `sanitizeBannedWords()` in fallbacks.ts
**Location**: `/Users/olebaek/Test P2G 1/supabase/functions/_shared/brand-profile/fallbacks.ts` (lines 375-456)

**Purpose**: Last resort sanitization when AI repair fails. Silently removes banned words from all text fields.

**How it works**:
- Extracts banned words from `things_to_avoid.language_constraints`
- Uses regex to remove each banned word from text (word boundaries)
- Cleans up extra spaces after removal
- Handles both string fields and object fields with `.value` property
- Returns sanitized sections with console log

### 5. Sanitization Integration in Main Pipeline
**Location**: index.ts (lines 490-510)

**Flow**:
1. Validation detects banned word inconsistencies
2. AI repair attempts to fix (with specific instructions)
3. If repair fails, check for banned word errors in post-repair validation
4. If found, apply `sanitizeBannedWords()` as last resort
5. Revalidate after sanitization
6. If still errors remain, categorize them (structural vs. warnings)

**Code logic**:
```typescript
const hasBannedWordErrors = afterFallbackErrors.some(e => String(e).includes('🚫 BANNED WORD INCONSISTENCY'))
if (hasBannedWordErrors) {
  console.log(`[${requestId}] 🧹 Banned word violations detected after repair. Applying sanitization...`)
  sections = sanitizeBannedWords(sections)
  
  const afterSanitizationErrors = validateBrandProfileOutput(sections, analysis, dataSources)
  if (afterSanitizationErrors.length === 0) {
    console.log(`[${requestId}] ✅ Sanitization successful - all errors resolved`)
  }
}
```

### 6. Export Addition
**Location**: `_shared/brand-profile/index.ts` (line 101)

Added `sanitizeBannedWords` to the module exports so it can be used in the main index.ts.

## Repair Strategy (User-Approved)

**Option B: Repair first, then fallback**

This approach follows the existing v4.8.5 repair strategy:
1. **Validate** → detect banned word violation
2. **AI Repair** with specific instruction: "Remove banned word X from field Y" 
3. **If repair fails** → sanitize silently as last resort
4. **If sanitization fails** → continue with existing error categorization

This gives the AI a chance to rephrase naturally rather than just deleting words.

## Testing Plan

**Test Business**: Café Faust (82f7b70d-0a72-4888-8ba7-6dc1d34e8db8)
**URL**: https://cafefaust.dk/
**Expected Issue**: "lækker" appears in `core_offerings` but is also in banned list

**Success Criteria**:
1. System detects "lækker" in output during validation
2. AI repair attempts to replace "lækker" with specific alternative
3. If repair fails, sanitization removes "lækker"
4. Final output has no "lækker" in any field except `things_to_avoid.language_constraints`
5. Console logs show repair/sanitization steps

**Verification Steps**:
1. Trigger generation for Café Faust
2. Check console logs for:
   - "🚫 BANNED WORD INCONSISTENCY" detection
   - AI repair attempt with specific instructions
   - "🧹 Banned word violations detected after repair. Applying sanitization..."
   - "✅ Sanitization successful - all errors resolved"
3. Check final `brand_profile` record in database
4. Verify no banned words appear outside `things_to_avoid`

## Version

**v4.8.8 - Task 1 Only**

Per user guidance:
- ✅ Implemented Task 1 (banned word consistency check)
- ⏸️ Deferred Task 2 (smart banned words - 3+ occurrences)
- ⏸️ Deferred Task 3 (menu scoring)
- 📋 Next: Deploy → test → review before implementing Task 2-3

## Files Modified

1. `/Users/olebaek/Test P2G 1/supabase/functions/_shared/brand-profile/validators.ts`
   - Added `checkBannedWordsConsistency()` function
   - Integrated check into `validateBrandProfileOutput()`
   - Enhanced `repairBrandProfile()` with banned word repair instructions

2. `/Users/olebaek/Test P2G 1/supabase/functions/_shared/brand-profile/fallbacks.ts`
   - Added `sanitizeBannedWords()` function

3. `/Users/olebaek/Test P2G 1/supabase/functions/_shared/brand-profile/index.ts`
   - Added `sanitizeBannedWords` export

4. `/Users/olebaek/Test P2G 1/supabase/functions/brand-profile-generator/index.ts`
   - Imported `sanitizeBannedWords`
   - Added sanitization logic after repair fails
   - Revalidation after sanitization

## Deployment Status

**Not yet deployed** - staged for review and testing per user request.

Ready to deploy with:
```bash
cd /Users/olebaek/Test\ P2G\ 1 && supabase functions deploy brand-profile-generator
```
