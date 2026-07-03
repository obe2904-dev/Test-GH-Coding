# Novelty Check System Implementation

## Overview
Enhanced the AI post generation system with a robust **fingerprint-based novelty checker** that prevents repetitive content by requiring new ideas to differ from previous posts on at least 2 dimensions.

## Problem Statement

**Before**: 
- Previous post avoidance was "soft" - just passed "previous post patterns" to AI
- AI could still generate repetitive content:
  - 3 consecutive "Club Sandwich by the river" posts
  - All posts using "book" CTA
  - Same theme/anchors over and over
- No hard constraint on similarity
- Difficult to debug why content felt repetitive

**After**:
- Hard fingerprint-based comparison
- Quantifiable similarity metric (4 dimensions)
- Requires at least 2 differences from any recent post
- Detailed logging for debugging
- Proactive prevention, not reactive detection

## Implementation

### 1. PostFingerprint Type

**File**: `supabase/functions/ai-generate-v2/types.ts`

```typescript
interface PostFingerprint {
  theme: 'menu' | 'vibe' | 'occasion'  // Primary content focus
  anchors: string[]  // Location/interior/experience phrases
  menuItems: string[]  // Menu item names mentioned
  ctaIntent: 'book' | 'menu' | 'visit' | 'engage'  // Call-to-action
}
```

**Why these 4 dimensions?**
- **Theme**: Affects overall message structure (menu spotlight vs atmosphere vs occasion)
- **Anchors**: Key selling points (location "ved åen" vs interior "hyggelig")
- **Menu Items**: Specific offerings featured (Club Sandwich vs Caesar Salat)
- **CTA Intent**: User action desired (book reservation vs visit vs engage)

### 2. Novelty Checker Module

**File**: `supabase/functions/ai-generate-v2/validators/novelty-checker.ts`

**Key Functions**:

```typescript
// Extract fingerprint from new idea (structured data)
extractIdeaFingerprint(idea: PostIdea): PostFingerprint

// Extract fingerprint from previous post (unstructured text)
extractPreviousPostFingerprint(post: PreviousPost, policy: BrandPolicy): PostFingerprint

// Check if new idea differs on at least N dimensions
isNovel(idea: PostIdea, previousFingerprints: PostFingerprint[], minDifferences = 2): 
  { novel: boolean; reason?: string; similarTo?: number }

// Get detailed comparison report for debugging
getNoveltyReport(idea: PostIdea, previousFingerprints: PostFingerprint[]): NoveltyReport
```

**Extraction Logic**:

For **new ideas** (structured):
```typescript
{
  theme: idea.idea_type,  // Direct access
  anchors: extractAnchorsFromText(idea.caption_base),  // Pattern matching
  menuItems: [idea.menu_item.name],  // Direct access
  ctaIntent: idea.cta_intent  // Direct access
}
```

For **previous posts** (unstructured text):
```typescript
{
  theme: inferThemeFromContent(content, policy),  // Heuristic inference
  anchors: extractAnchorsFromText(content),  // Pattern matching
  menuItems: extractMenuItemsFromText(content, policy),  // Allowlist matching
  ctaIntent: inferCtaIntentFromContent(content)  // Keyword detection
}
```

**Anchor Extraction Patterns**:
```typescript
// Location patterns
/ved (åen|stranden|havnen|søen)/gi
/(i hjertet af|midt i|tæt på) \w+/gi

// Interior patterns
/hyggelig(t)? (atmosfære|stemning|miljø)/gi
/moderne (indretning|design|lokaler)/gi

// Experience patterns
/perfekt til (brunch|dating|familier)/gi
/familievenlig(t)?/gi
```

### 3. Similarity Scoring

**Dimension Comparison**:
```typescript
function countDifferences(fp1, fp2): number {
  let differences = 0
  
  // Dimension 1: Theme (exact match)
  if (fp1.theme !== fp2.theme) differences++
  
  // Dimension 2: Anchors (array overlap)
  if (!hasArrayOverlap(fp1.anchors, fp2.anchors)) differences++
  
  // Dimension 3: Menu items (array overlap)
  if (!hasArrayOverlap(fp1.menuItems, fp2.menuItems)) differences++
  
  // Dimension 4: CTA intent (exact match)
  if (fp1.ctaIntent !== fp2.ctaIntent) differences++
  
  return differences  // 0-4
}
```

**Array Overlap Logic**:
- If either array is empty → NO overlap (difference)
- If arrays share ANY element → OVERLAP (same)
- Case-insensitive comparison

**Example Comparisons**:

```typescript
// Example 1: TOO SIMILAR (1 difference)
New:      { theme: 'menu', anchors: ['ved åen'], menuItems: ['Club Sandwich'], cta: 'book' }
Previous: { theme: 'menu', anchors: ['ved åen'], menuItems: ['Caesar Salat'], cta: 'book' }
Differences: 
  - Theme: SAME ✗
  - Anchors: OVERLAP ✗
  - Menu: DIFFERENT ✓
  - CTA: SAME ✗
Total: 1 difference → ⚠️ TOO SIMILAR (need 2+)

// Example 2: NOVEL (3 differences)
New:      { theme: 'vibe', anchors: ['hyggelig'], menuItems: [], cta: 'visit' }
Previous: { theme: 'menu', anchors: ['ved åen'], menuItems: ['Club Sandwich'], cta: 'book' }
Differences:
  - Theme: DIFFERENT ✓
  - Anchors: DIFFERENT ✓
  - Menu: DIFFERENT ✓
  - CTA: DIFFERENT ✓
Total: 4 differences → ✅ NOVEL

// Example 3: BORDERLINE NOVEL (2 differences - passes)
New:      { theme: 'menu', anchors: ['hyggelig'], menuItems: ['Club Sandwich'], cta: 'visit' }
Previous: { theme: 'menu', anchors: ['ved åen'], menuItems: ['Club Sandwich'], cta: 'book' }
Differences:
  - Theme: SAME ✗
  - Anchors: DIFFERENT ✓
  - Menu: OVERLAP ✗
  - CTA: DIFFERENT ✓
Total: 2 differences → ✅ NOVEL (just passes threshold)
```

### 4. Integration with Content Validator

**File**: `supabase/functions/ai-generate-v2/validators/content-validator.ts`

**Enhanced Validation Function**:
```typescript
validateSuggestions(
  ideas: PostIdea[],
  businessProfile: BusinessProfile,
  menuCatalog: MenuCatalog,
  ideaPlan?: IdeaPlan,
  previousPosts?: PreviousPost[]  // NEW PARAMETER
): ValidationError[]
```

**Validation Flow**:
```typescript
// 1. Extract fingerprints from previous posts
const previousFingerprints = extractPreviousPostsFingerprints(previousPosts, policy)

// 2. For each new idea:
for (const idea of ideas) {
  // ... other validations ...
  
  // 3. Novelty check
  const noveltyCheck = isNovel(idea, previousFingerprints, 2)
  
  if (!noveltyCheck.novel) {
    // 4. Get detailed report for debugging
    const report = getNoveltyReport(idea, previousFingerprints)
    
    // 5. Log details
    console.log('⚠️ Novelty check failed:', {
      reason: noveltyCheck.reason,
      fingerprint: report.fingerprint,
      comparisonDetails: report.comparisonDetails
    })
    
    // 6. Add warning (not blocking)
    errors.push({
      field: 'novelty',
      message: `Content too similar. ${noveltyCheck.reason}`,
      severity: 'warning'  // Not blocking - AI can still be creative
    })
  }
}
```

### 5. Main Handler Update

**File**: `supabase/functions/ai-generate-v2/index.ts`

```typescript
// Pass previous posts to validator
const validationErrors = validateSuggestions(
  ideas,
  businessProfile,
  menuCatalog,
  ideaPlan,
  previousPosts  // NEW: Enable novelty checking
)
```

## Real-World Examples

### Scenario 1: Menu Item Rotation
**Previous Post**:
```
Theme: menu
Anchors: ["ved åen i Aarhus"]
Menu: ["Club Sandwich"]
CTA: book
```

**New Idea (TOO SIMILAR - only menu item changes)**:
```
Theme: menu  ← SAME
Anchors: ["ved åen i Aarhus"]  ← OVERLAP
Menu: ["Caesar Salat"]  ← DIFFERENT
CTA: book  ← SAME
```
**Result**: ⚠️ Only 1 difference → TOO SIMILAR

**Better New Idea**:
```
Theme: vibe  ← DIFFERENT
Anchors: ["hyggelig atmosfære"]  ← DIFFERENT
Menu: []  ← DIFFERENT
CTA: visit  ← DIFFERENT
```
**Result**: ✅ 4 differences → NOVEL

### Scenario 2: CTA Variation
**Previous Posts** (all menu + book):
```
Post 1: { theme: 'menu', cta: 'book' }
Post 2: { theme: 'menu', cta: 'book' }
Post 3: { theme: 'menu', cta: 'book' }
```

**New Idea (forced variety)**:
```
Theme: vibe  ← DIFFERENT (forces different theme)
CTA: visit  ← DIFFERENT (forces different CTA)
```
**Result**: ✅ System prevents "all book CTAs" fatigue

### Scenario 3: Anchor Diversity
**Previous Posts**:
```
Post 1: anchors: ["ved åen"]
Post 2: anchors: ["ved åen"]
Post 3: anchors: ["ved åen"]
```

**New Idea (forced anchor change)**:
```
Anchors: ["hyggelig atmosfære"]  ← DIFFERENT
```
**Result**: ✅ System prevents "ved åen" overuse

## Benefits

### Quantifiable Quality
- ✅ Hard metric: 0-4 differences measured
- ✅ Clear threshold: Need 2+ differences
- ✅ Debuggable: Detailed comparison reports
- ✅ Tunable: Can adjust minDifferences parameter

### Content Diversity
- ✅ Prevents menu item spam (same dish every post)
- ✅ Forces anchor rotation (different selling points)
- ✅ Mixes themes (menu/vibe/occasion)
- ✅ Varies CTAs (book/visit/engage)

### User Experience
- ✅ No repetitive content fatigue
- ✅ Fresh angles on business
- ✅ Balanced content mix
- ✅ Better engagement (variety)

### Developer Experience
- ✅ Detailed logging for debugging
- ✅ NoveltyReport shows exact comparison
- ✅ Warning severity (not blocking)
- ✅ Easy to adjust threshold

## Logging Output

**When novelty check passes**:
```
✅ Novelty check passed for Idea 1
```

**When novelty check fails**:
```
⚠️ Novelty check failed for Idea 2: {
  reason: "Too similar to previous post #1 (only 1 differences, need 2)",
  fingerprint: {
    theme: "menu",
    anchors: ["ved åen i Aarhus"],
    menuItems: ["Club Sandwich"],
    ctaIntent: "book"
  },
  comparisonDetails: [
    {
      previousPostIndex: 0,
      differences: 1,
      dimensions: {
        theme: { same: true, new: "menu", old: "menu" },
        anchors: { overlap: true, new: ["ved åen i Aarhus"], old: ["ved åen"] },
        menuItems: { overlap: false, new: ["Club Sandwich"], old: ["Caesar Salat"] },
        ctaIntent: { same: true, new: "book", old: "book" }
      }
    }
  ]
}
```

## Configuration

### Minimum Differences Threshold
**Default**: 2 differences required
**Adjustable**: Can be changed in `isNovel()` call

```typescript
// Stricter (need 3 differences)
isNovel(idea, previousFingerprints, 3)

// Looser (only need 1 difference)
isNovel(idea, previousFingerprints, 1)
```

**Recommendation**: Keep at 2
- **Too strict (3+)**: Might be hard to satisfy with limited content
- **Too loose (1)**: Not enough diversity guarantee
- **Just right (2)**: Ensures meaningful variation

### Number of Previous Posts
**Current**: 10 most recent posts checked
**Adjustable**: Can fetch more/fewer in data gathering phase

```typescript
// Check against last 5 posts only
const recentPosts = previousPosts.slice(0, 5)

// Check against last 20 posts
const recentPosts = previousPosts.slice(0, 20)
```

**Recommendation**: 10 posts
- **Too few (<5)**: Might miss recent patterns
- **Too many (>15)**: Overly restrictive, content may have naturally evolved
- **Just right (10)**: Good balance of recency and diversity

## Edge Cases

### No Previous Posts
```typescript
if (previousFingerprints.length === 0) {
  // All ideas pass novelty check
  return { novel: true }
}
```

### Empty Fingerprint Fields
```typescript
// Empty arrays count as "different" from non-empty arrays
hasArrayOverlap([], ["ved åen"]) → false  // DIFFERENT
hasArrayOverlap([], []) → false  // DIFFERENT
```

### Case Sensitivity
```typescript
// All comparisons are case-insensitive
"Ved Åen" === "ved åen" → SAME
["Hyggelig"] overlaps ["hyggelig"] → OVERLAP
```

## Future Enhancements

### Possible Improvements:
1. **Weighted Dimensions** - Some dimensions matter more than others
   ```typescript
   weights = { theme: 2, anchors: 1.5, menuItems: 1, cta: 1.5 }
   minScore = 3.0  // Instead of count
   ```

2. **Time Decay** - Older posts matter less
   ```typescript
   ageInDays = (now - post.created_at) / 86400000
   weight = 1 / (1 + ageInDays / 7)  // Half weight after 7 days
   ```

3. **Semantic Similarity** - Use embeddings for anchor/caption similarity
   ```typescript
   anchorSimilarity = cosineSimilarity(embed(fp1.anchors), embed(fp2.anchors))
   if (anchorSimilarity > 0.8) → TOO SIMILAR
   ```

4. **Category-Specific Thresholds** - Different requirements per business type
   ```typescript
   if (businessType === 'cafe') minDifferences = 1  // Limited menu
   if (businessType === 'restaurant') minDifferences = 2  // More variety
   ```

5. **Learning from Engagement** - Adjust weights based on performance
   ```typescript
   if (post.engagement.likes > avgLikes * 1.5) {
     // Allow similar posts to high-performing content
     minDifferences = 1
   }
   ```

## Testing Recommendations

### Unit Tests
```typescript
// Test dimension counting
expect(countDifferences(fp1, fp2)).toBe(2)

// Test array overlap
expect(hasArrayOverlap(['ved åen'], ['ved åen i Aarhus'])).toBe(true)
expect(hasArrayOverlap(['hyggelig'], ['moderne'])).toBe(false)

// Test novelty check
expect(isNovel(idea, [prevFp1, prevFp2], 2).novel).toBe(true)
```

### Integration Tests
```typescript
// Test with real previous posts
const posts = await fetchPreviousPosts(businessId, 10)
const fingerprints = extractPreviousPostsFingerprints(posts, policy)
const ideas = await generateIdeas(context)

for (const idea of ideas) {
  const check = isNovel(idea, fingerprints, 2)
  expect(check.novel).toBe(true)
}
```

### Manual Testing
1. Generate 3 ideas
2. Save as previous posts
3. Generate 3 more ideas immediately
4. Verify they differ on at least 2 dimensions
5. Check logs for detailed comparison

## Deployment

### No Breaking Changes
- ✅ Backward compatible (previous posts parameter is optional)
- ✅ Graceful degradation (if no previous posts, all pass)
- ✅ Warning severity (doesn't block generation)

### Deployment Steps
1. Deploy Edge Function: `supabase functions deploy ai-generate-v2`
2. Test with existing businesses (should work without previous posts)
3. Verify novelty check logs appear in function logs
4. Monitor warning frequency
5. Adjust threshold if too many/few warnings

## Success Metrics

### Track:
- **Novelty pass rate**: % of ideas passing novelty check
- **Dimension distribution**: Which dimensions differ most often
- **Warning frequency**: How often novelty check fails
- **User feedback**: Reduction in "repetitive content" complaints
- **Engagement**: Compare engagement on novel vs similar posts

### Expected Results:
- **Pass rate**: 80-90% (some warnings expected)
- **Most common differences**: Theme + CTA (easiest to vary)
- **Least common differences**: Menu items (limited menu)
- **User satisfaction**: Higher with varied content

## Files Modified

1. ✅ `types.ts` - Added PostFingerprint interface
2. ✅ `validators/novelty-checker.ts` - NEW FILE (fingerprint extraction, comparison logic)
3. ✅ `validators/content-validator.ts` - Integrated novelty check
4. ✅ `index.ts` - Pass previousPosts to validator
5. ✅ `IDEA_GENERATION_ARCHITECTURE.md` - Documented system

## Summary

The novelty check system transforms previous post avoidance from **soft guidance** to **hard constraints**:

**Before**: "Try to be different from: [soft patterns]" → AI could ignore
**After**: "Must differ on 2+ dimensions: theme/anchors/menu/CTA" → Quantifiable requirement

This ensures consistent content variety without being overly restrictive, while providing detailed debugging information when similarity is detected.
