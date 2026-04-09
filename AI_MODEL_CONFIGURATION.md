# AI Model Configuration Per Feature

## Overview

The system now supports **different AI models for different features**, optimizing for cost, speed, and quality based on each task's requirements.

---

## Current Configuration

Located in: `supabase/functions/_shared/ai-caption-generator/ai-provider.ts`

```typescript
export const FEATURE_AI_CONFIG = {
  'brand-profile': {
    provider: 'openai',
    model: 'gpt-4o'  // Strategic depth required
  },
  'caption': {
    provider: 'openai',
    model: 'gpt-4o-mini'  // Fast and cheap
  },
  'photo-idea': {
    provider: 'gemini',
    model: 'gemini-2.0-flash-exp'  // Creative generation
  },
  'menu-extract': {
    provider: 'openai',
    model: 'gpt-4o-mini'  // Structured extraction
  },
  'location-analysis': {
    provider: 'openai',
    model: 'gpt-4o'  // Complex reasoning
  },
  'post-ideas': {
    provider: 'gemini',
    model: 'gemini-2.5-flash'  // Bulk generation
  },
  'default': {
    provider: 'openai',
    model: 'gpt-4o-mini'  // Safe fallback
  }
}
```

---

## How to Change Models

### Option 1: Change Model for Specific Feature

```typescript
'brand-profile': {
  provider: 'gemini',
  model: 'gemini-2.5-flash'  // ← Switch to Gemini
}
```

### Option 2: Change Provider but Keep Model Class

```typescript
'caption': {
  provider: 'openai',
  model: 'gpt-4o'  // ← Upgrade to full GPT-4o for better quality
}
```

### Option 3: Override at Runtime (Advanced)

```typescript
// In your Edge Function
const result = await callAI<ResponseType>(prompt, {
  temperature: 0.7,
  maxTokens: 4000,
  model: 'gpt-4-turbo'  // ← Explicit override, ignores feature config
})
```

---

## Available Models

### OpenAI
- **gpt-4o** - Most capable, best for strategic/complex tasks ($5/1M input, $15/1M output)
- **gpt-4o-mini** - Fast and cheap, good for most tasks ($0.15/1M input, $0.60/1M output)
- **gpt-4-turbo** - Previous generation, still very capable

### Gemini
- **gemini-2.5-flash** - Latest, best balance of speed/quality
- **gemini-2.0-flash-exp** - Experimental, free tier available
- **gemini-exp-1206** - Older experimental version

---

## Usage in Edge Functions

### Method 1: Feature-Based (Recommended)

```typescript
import { callAI } from '../../_shared/ai-caption-generator/ai-provider.ts'

const brandProfile = await callAI<BrandProfileType>(prompt, {
  temperature: 0.7,
  maxTokens: 4000,
  feature: 'brand-profile'  // Uses gpt-4o per config
})
```

### Method 2: Explicit Model Override

```typescript
const caption = await callAI<CaptionType>(prompt, {
  temperature: 0.7,
  model: 'gemini-2.5-flash'  // Ignores feature config
})
```

### Method 3: No Feature Specified

```typescript
const result = await callAI<any>(prompt)  // Uses 'default' config
```

---

## Cost Optimization Strategies

### High-Quality Tasks (Use GPT-4o)
- Brand Profile generation
- Location intelligence analysis
- Strategic content planning

**Why:** Requires deep reasoning, nuance, and strategic thinking

### High-Volume Tasks (Use GPT-4o-mini or Gemini)
- Social media captions
- Post ideas generation
- Menu extraction

**Why:** Fast, cheap, good enough quality for repetitive tasks

### Creative Tasks (Use Gemini)
- Photo content ideas
- Weekly post brainstorming
- Experimental features

**Why:** Gemini excels at creative generation and is cheaper

---

## Testing Different Models

1. **Change config** in `ai-provider.ts`
2. **Redeploy function:**
   ```bash
   npx supabase functions deploy brand-profile-generator-v5
   ```
3. **Check logs** for model usage:
   ```bash
   npx supabase functions logs brand-profile-generator-v5
   ```
4. **Compare quality** and cost

---

## Estimated Monthly Costs

Assuming 1,000 businesses:

| Feature | Model | Monthly Cost |
|---------|-------|--------------|
| Brand Profile (1x per business) | GPT-4o | ~$15 |
| Captions (30 per business) | GPT-4o-mini | ~$25 |
| Photo Ideas (10 per business) | Gemini 2.5 Flash | ~$0 (free tier) |
| Location Analysis (1x per business) | GPT-4o | ~$10 |
| Post Ideas (4 per business/month) | Gemini 2.5 Flash | ~$0 (free tier) |
| **Total** | | **~$50/month** |

---

## Migration Checklist

When adding per-feature config to existing functions:

- [ ] Import `callAI` from `_shared/ai-caption-generator/ai-provider.ts`
- [ ] Add `feature` parameter when calling `callAI`
- [ ] Remove hardcoded `OPENAI_API_KEY` or `GEMINI_API_KEY` calls
- [ ] Update function to use unified interface
- [ ] Test with both providers
- [ ] Update documentation

---

## Monitoring

Check which model was used in logs:

```
[AI] Feature 'brand-profile' using: openai gpt-4o
[OpenAI] Calling gpt-4o (temp=0.7, maxTokens=4000)
[OpenAI] Tokens used: { prompt: 2341, completion: 856, total: 3197, cost: $0.024123 }
```

---

## Future Model Support

To add new models (e.g., Claude, Llama):

1. Add provider to `AIFeature` type
2. Create client function (like `callOpenAI` or `callGeminiJSON`)
3. Update `callAI` to route to new provider
4. Add to `FEATURE_AI_CONFIG`

---

## Best Practices

✅ **DO:**
- Use GPT-4o for complex, strategic tasks
- Use GPT-4o-mini for high-volume, simple tasks
- Use Gemini for creative, experimental features
- Monitor costs and quality regularly
- Test new models before switching production

❌ **DON'T:**
- Use GPT-4o for everything (expensive!)
- Use cheapest model for strategic tasks (quality suffers)
- Change models without testing
- Forget to redeploy after config changes
