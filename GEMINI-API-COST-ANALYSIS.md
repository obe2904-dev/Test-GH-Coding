# Gemini API Cost & Usage Analysis
**Date:** May 18, 2026  
**Status:** Currently on FREE tier (rate limited)

---

## 🔍 Current Gemini API Usage

### Functions Using Gemini API:

| Function | Model | Calls per Request | Use Case |
|----------|-------|-------------------|----------|
| **analyze-photo** | gemini-2.5-flash | 1-3 | Photo analysis (Free: 1 call, Smart/Pro: 2 calls + atmosphere synthesis) |
| **get-quick-suggestions** | gemini-2.5-flash | 1 | Daily suggestion generation (3 ideas) |
| **edit-photo** | gemini-2.5-flash-image | 1 | AI photo editing |
| **ai-carousel-organise** | gemini-1.5-flash | 1 | Carousel organization |
| **generate-text-from-idea** | (Uses GPT-4o/mini) | 0 | Caption generation - **NOT USING GEMINI** ✅ |

### Daily Suggestion System:
- **Phase 0-2c:** Multiple Gemini calls for strategy, modulation, and content generation
- Estimated: **3-5 Gemini calls** per daily suggestion batch (3 suggestions)

---

## 💰 Gemini API Pricing (May 2026)

### Free Tier (Current):
- **Rate Limit:** 15 requests/minute
- **Daily Limit:** 1,500 requests/day
- **Cost:** $0.00
- **Problem:** Shared across ALL users globally

### Gemini 2.5 Flash Pricing (Paid):
- **Input:** $0.15 per 1M tokens (~$0.00015 per 1K tokens)
- **Output:** $0.60 per 1M tokens (~$0.0006 per 1K tokens)
- **Context caching:** $0.0375 per 1M tokens (75% discount)

### Gemini 1.5 Flash Pricing:
- **Input:** $0.075 per 1M tokens
- **Output:** $0.30 per 1M tokens
- Cheaper than 2.5 Flash but older model

---

## 📊 Usage Scenarios & Cost Estimates

### Scenario 1: Low Usage (10 active users/day)
**Daily Activities:**
- 10 daily suggestion batches: 10 × 4 calls = **40 requests**
- 20 photo analyses: 20 × 1.5 avg = **30 requests**
- 5 carousel organizes: **5 requests**

**Total:** ~75 requests/day

**Cost Estimate:**
- Average tokens per request: ~500 input + 300 output
- Daily cost: 75 × (0.5K × $0.00015 + 0.3K × $0.0006) ≈ **$0.019/day**
- **Monthly:** ~$0.57

✅ **FREE TIER WORKS** (well under 1,500/day limit)

---

### Scenario 2: Medium Usage (50 active users/day)
**Daily Activities:**
- 50 daily suggestion batches: 50 × 4 calls = **200 requests**
- 100 photo analyses: 100 × 1.5 avg = **150 requests**
- 20 carousel organizes: **20 requests**

**Total:** ~370 requests/day

**Cost Estimate:**
- Daily cost: 370 × (0.5K × $0.00015 + 0.3K × $0.0006) ≈ **$0.094/day**
- **Monthly:** ~$2.82

✅ **FREE TIER WORKS** (still under daily limit)
⚠️ **RATE LIMITING RISK** during peak hours (370 requests / 24 hours = 15.4/hour avg, but users cluster)

---

### Scenario 3: High Usage (200 active users/day)
**Daily Activities:**
- 200 daily suggestion batches: 200 × 4 calls = **800 requests**
- 400 photo analyses: 400 × 1.5 avg = **600 requests**
- 50 carousel organizes: **50 requests**

**Total:** ~1,450 requests/day

**Cost Estimate:**
- Daily cost: 1,450 × (0.5K × $0.00015 + 0.3K × $0.0006) ≈ **$0.369/day**
- **Monthly:** ~$11.07

⚠️ **FREE TIER AT LIMIT** (approaching 1,500/day)
❌ **RATE LIMITING GUARANTEED** (60/hour avg, peaks will hit 15/min limit)

---

### Scenario 4: Production Scale (1,000 users/day)
**Daily Activities:**
- 1,000 daily suggestion batches: 1,000 × 4 calls = **4,000 requests**
- 2,000 photo analyses: 2,000 × 1.5 avg = **3,000 requests**
- 200 carousel organizes: **200 requests**

**Total:** ~7,200 requests/day

**Cost Estimate:**
- Daily cost: 7,200 × (0.5K × $0.00015 + 0.3K × $0.0006) ≈ **$1.83/day**
- **Monthly:** ~$54.90

❌ **FREE TIER EXCEEDED** (4.8× over daily limit)
✅ **PAID TIER REQUIRED** (~$55/month)

---

## 🚨 Current Problem: Rate Limiting

### Why You're Getting 429 Errors:
1. **Free tier limit:** 15 requests/minute (900/hour)
2. **Burst usage:** When you test multiple photos quickly = instant rate limit
3. **Shared quota:** ALL users hit the same 15/min pool

### Your Current Retry Logic (Just Deployed):
```typescript
- Max retries: 3
- Delays: 1s, 2s, 4s (exponential backoff)
- Total wait: up to 7 seconds
```
✅ Helps smooth transient spikes  
❌ Doesn't increase capacity (still 15/min shared)

---

## 💡 Solutions & Recommendations

### Option 1: Upgrade to Gemini API Paid Tier ⭐ RECOMMENDED
**Benefits:**
- 1,000+ requests/minute (vs 15/min)
- Predictable costs: ~$0.50-$2/day for current usage
- No rate limiting for reasonable growth

**Setup:**
1. Go to Google AI Studio: https://aistudio.google.com/
2. Enable billing on your Google Cloud project
3. No minimum commitment - pay per use

**Expected Monthly Cost:**
- Current usage (testing): ~$5-10/month
- With 100 users: ~$20-30/month
- With 1,000 users: ~$50-75/month

---

### Option 2: Hybrid Approach (Gemini Free + OpenAI for Critical Paths)
**Strategy:**
- Keep Gemini free tier for daily suggestions (low priority, batched)
- Switch photo analysis to OpenAI Vision API (user-facing, needs instant response)

**OpenAI Vision API Pricing:**
- GPT-4o: $2.50 per 1M input tokens, $10 per 1M output tokens
- GPT-4o-mini: $0.15 per 1M input tokens, $0.60 per 1M output tokens
- Vision images: $0.17 per image (low res), $0.85 per image (high res)

**Photo Analysis Cost Comparison:**
- **Gemini 2.5 Flash:** ~$0.0002/photo
- **GPT-4o-mini Vision:** ~$0.002/photo (10× more expensive)
- **GPT-4o Vision:** ~$0.01/photo (50× more expensive)

❌ **NOT RECOMMENDED** - Gemini is already very cheap for vision

---

### Option 3: Implement Intelligent Rate Limiting
**Client-side:**
- Add queue system for photo analysis
- Show "Analyzing... please wait" with position in queue
- Batch daily suggestions (already done)

**Server-side:**
- Track API usage per business/user
- Implement per-tier quotas (Free: 5 photo analyses/day, etc.)
- Cache repeated requests

⚠️ **TEMPORARY FIX** - Doesn't solve underlying capacity issue

---

### Option 4: Switch to Gemini 1.5 Flash (Older, Cheaper)
**Savings:**
- 50% cheaper than 2.5 Flash
- Still very capable for most tasks

**Trade-off:**
- Slightly older model (less capable)
- May affect quality of photo analysis

🤔 **CONSIDER** if budget is critical, but 2.5 Flash is already very cheap

---

## 🎯 Final Recommendation

### Immediate Action (Today):
✅ **Upgrade to Gemini API Paid Tier**

**Why:**
1. **Extremely cheap:** ~$10-30/month for foreseeable growth
2. **Eliminates rate limiting:** 1,000+ requests/min
3. **Better UX:** No delays, no 429 errors
4. **Scalable:** Supports 100-1,000+ users without issue

**How:**
1. Visit: https://aistudio.google.com/app/apikey
2. Create new API key with billing enabled
3. Add to Supabase secrets: `GEMINI_API_KEY=<new-key>`
4. No code changes needed

---

### Medium-term (Next Month):
1. **Add usage monitoring:** Log Gemini API calls, track costs
2. **Implement per-tier quotas:** Free: 5 photo analyses/day, Smart: 20/day, Pro: unlimited
3. **Cache results:** Store photo analysis results to avoid re-analyzing same images

---

### Long-term (3-6 months):
1. **Evaluate quality:** Is Gemini 2.5 Flash good enough for photo analysis?
2. **Consider GPT-4o Vision:** If quality issues, test OpenAI Vision API
3. **Optimize prompts:** Reduce token usage (shorter prompts = lower costs)
4. **Context caching:** Use Gemini's caching for repeated business context (75% discount)

---

## 📈 Cost Projection

| User Scale | Daily Requests | Monthly Cost (Gemini Paid) | Savings vs OpenAI Vision |
|------------|----------------|---------------------------|--------------------------|
| 10 users | 75 | $0.57 | ~$15 |
| 50 users | 370 | $2.82 | ~$75 |
| 100 users | 750 | $5.70 | ~$150 |
| 500 users | 3,750 | $28.50 | ~$750 |
| 1,000 users | 7,500 | $57.00 | ~$1,500 |

**Conclusion:** Gemini is 95%+ cheaper than OpenAI Vision for your use case.

---

## ✅ Action Items

- [ ] Enable billing on Google Cloud project
- [ ] Generate new Gemini API key with billing enabled
- [ ] Update `GEMINI_API_KEY` in Supabase secrets
- [ ] Test photo analysis (should work instantly)
- [ ] Add cost monitoring/logging
- [ ] Document API costs for future reference

---

**Questions? Next Steps?**  
Ready to enable Gemini paid tier when you are!
