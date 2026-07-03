# Refined Cuisine Detection Patterns

**Issue Found**: Test shows "internationale" matching as "Italian" (false positive)

## Current Pattern Problems

```typescript
'Italian': /italiensk|italian|pasta|pizza|risotto/i
// Matches: "internationale" → false positive
```

## Refined Patterns (Word Boundaries)

```typescript
const CUISINE_PATTERNS = {
  'Thai': /\b(thai|thailandsk)\b/i,
  'Italian': /\b(italiensk|italian)\b|pasta|pizza|risotto/i,  // ← Word boundary on italian/italiensk
  'French': /\b(fransk|french)\b|bistro|brasserie/i,
  'Nordic': /\bnordisk\b|\bnordic\b|ny nordisk|new nordic/i,
  'Danish': /dansk madkultur|traditional danish|smørrebrød|frikadeller/i,
  'Japanese': /\b(japansk|japanese)\b|sushi|ramen|izakaya/i,
  'Mediterranean': /\bmediterran(ean)?\b/i,
  'Mexican': /\b(mexicansk|mexican)\b|taco|burrito/i,
  'Indian': /\b(indisk|indian)\b|curry|tandoori/i,
  'Middle Eastern': /mellemøstlig|middle eastern|falafel|hummus|mezze/i,
  'Chinese': /\b(kinesisk|chinese)\b|dim sum|wok/i,
  'Spanish': /\b(spansk|spanish)\b|tapas|paella/i,
  'Greek': /\b(græsk|greek)\b|gyros|souvlaki/i,
  'Vietnamese': /\b(vietnamesisk|vietnamese)\b|pho|banh mi/i,
  'Korean': /\b(koreansk|korean)\b|bibimbap|kimchi/i,
}
```

## Explanation

**Word Boundaries (`\b`)**:
- `\bitalian\b` matches: "italian cuisine" ✅
- `\bitalian\b` skips: "internationale" ✗

**Why Dish Names Don't Need Boundaries**:
- `pasta`, `pizza`, `sushi` are standalone indicators
- These are specific enough to not cause false matches

## Expected Improvement

**Before** (current test):
- Italian: 7 items (includes false positives from "internationale")
- Danish: 0 items (misclassified as Italian)

**After** (refined patterns):
- Italian: ~2-3 items (true Italian dishes only)
- Danish: ~5-7 items (correctly detected from "dansk madkultur")
- Nordic: 13 items (unchanged)

## Action Item

Update `_test_cuisine_integration.mjs` and final implementation with word boundary patterns.

**Status**: Minor refinement, does not block Phase 0 implementation.
