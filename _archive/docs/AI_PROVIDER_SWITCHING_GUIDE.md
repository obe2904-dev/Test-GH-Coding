# AI Provider Switching Guide

## Current Configuration

**Active Provider:** OpenAI GPT-4o-mini (Testing)  
**Location:** `supabase/functions/_shared/ai-caption-generator/ai-provider.ts`

---

## How to Switch Providers

### Quick Switch

Open `ai-provider.ts` and change line 19:

```typescript
// Current (OpenAI)
export const AI_PROVIDER: 'gemini' | 'openai' = 'openai'

// Switch back to Gemini
export const AI_PROVIDER: 'gemini' | 'openai' = 'gemini'
```

Then redeploy:
```bash
npx supabase functions deploy generate-weekly-plan
```

---

## Provider Comparison

### Gemini 2.0 Flash Exp
- **Cost:** $0.00 (free tier) or very low cost
- **Speed:** Very fast (~1.5-2s)
- **Quality:** Excellent for Danish content
- **Strengths:** Free, fast, good with Danish language
- **Weaknesses:** May occasionally be verbose

### OpenAI GPT-4o-mini
- **Cost:** $0.150/1M input + $0.600/1M output tokens
- **Speed:** Fast (~2-3s)
- **Quality:** Generally high quality, good instruction following
- **Strengths:** Excellent instruction adherence, brevity control
- **Weaknesses:** Costs money (though minimal)

**Estimated Cost per Caption:**
- Gemini: $0.000 (free)
- GPT-4o-mini: ~$0.0008 per caption
- At 10,000 captions/month: ~$8/month

---

## Testing Checklist

When testing a new provider, verify:

- [ ] Caption quality (natural Danish, not translated)
- [ ] Length adherence (125-175 chars for Instagram)
- [ ] Hashtag relevance and quantity
- [ ] Emoji usage (appropriate count and placement)
- [ ] Brand voice match
- [ ] Menu description summarization
- [ ] No banned words
- [ ] JSON parsing works correctly
- [ ] Cost vs quality trade-off

---

## Logs to Monitor

Check Supabase logs for:

```
[AI Caption] Using provider: OpenAI gpt-4o-mini
[OpenAI] Calling gpt-4o-mini (temp=0.7, maxTokens=4096)
[OpenAI] Tokens used: { prompt: 1234, completion: 156, total: 1390, cost: $0.000423 }
[AI Caption] AI response received: { captionLength: 145, hashtagCount: 8, emojiCount: 2 }
```

vs

```
[AI Caption] Using provider: Gemini gemini-2.0-flash-exp
[Gemini Client] Calling Gemini (temp=0.7, maxTokens=4096)
[AI Caption] AI response received: { captionLength: 187, hashtagCount: 10, emojiCount: 3 }
```

---

## Architecture

### Unified Interface

Both providers use the same interface:

```typescript
export async function callAI<T>(
  prompt: string,
  options: {
    temperature?: number
    maxTokens?: number
  } = {}
): Promise<T>
```

This means:
- ✅ No changes needed in calling code
- ✅ Same error handling
- ✅ Same logging patterns
- ✅ Easy A/B testing

### Files Modified

1. **`ai-provider.ts`** (NEW) - Provider abstraction layer
   - `AI_PROVIDER` constant controls which is used
   - `callAI()` unified interface
   - `callOpenAI()` implementation
   - `callGeminiJSON()` passthrough

2. **`index.ts`** (UPDATED)
   - Imports `callAI` instead of `callGeminiJSON`
   - Logs active provider on each call
   - All other logic unchanged

3. **`types.ts`** (UPDATED)
   - Added `enforceBrevity?: boolean` option

---

## Performance Testing

### Test Plan

1. **Generate 50 captions** with GPT-4o-mini
2. **Generate 50 captions** with Gemini
3. **Compare:**
   - Average caption length
   - Quality score distribution
   - Banned word violations
   - User satisfaction (manual review of 10 random samples)
   - Cost per caption
   - Generation time

### Metrics to Track

```typescript
{
  provider: 'openai' | 'gemini',
  captionLength: number,
  hashtagCount: number,
  emojiCount: number,
  qualityScore: number,
  generationTimeMs: number,
  cost: number,
  bannedWordViolations: number
}
```

---

## Rollback Plan

If GPT-4o-mini doesn't perform well:

1. Change `AI_PROVIDER` back to `'gemini'`
2. Redeploy function
3. Done - immediate rollback

**No database changes needed.**  
**No frontend changes needed.**

---

## Future Enhancements

### Smart Provider Selection

Could implement automatic provider selection based on:

```typescript
function selectProvider(context: CaptionGenerationContext): 'gemini' | 'openai' {
  // Use OpenAI for high-priority content
  if (context.contentOpportunity.type === 'event_promotion') {
    return 'openai'
  }
  
  // Use Gemini for regular content (free)
  return 'gemini'
}
```

### A/B Testing

```typescript
function selectProviderAB(businessId: string): 'gemini' | 'openai' {
  // 50/50 split based on business ID
  return businessId.charCodeAt(0) % 2 === 0 ? 'gemini' : 'openai'
}
```

---

## Environment Variables

Ensure these are set in Supabase:

```bash
# Required for Gemini
GEMINI_API_KEY=your_gemini_key

# Required for OpenAI
OPENAI_API_KEY=your_openai_key
```

Check with:
```bash
npx supabase secrets list
```

Set with:
```bash
npx supabase secrets set OPENAI_API_KEY=sk-...
```

---

## Current Status

✅ **READY FOR TESTING**

- [x] Provider abstraction implemented
- [x] OpenAI client integrated
- [x] Unified interface working
- [x] Error handling consistent
- [x] Logging in place
- [x] Cost tracking implemented
- [x] Easy rollback available

**Next Step:** Deploy and test with real weekly plan generation.
