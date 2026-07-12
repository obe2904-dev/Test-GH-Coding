# ScrapingBee Integration Guide - Pay-Per-Use Website Scraping

Quick guide for integrating ScrapingBee to handle JavaScript-heavy websites (like soukaarhus.dk).

## Why ScrapingBee?

**Perfect for sporadic use:**
- ✅ **Pay-per-request** (not always-on like Railway)
- ✅ 1,000 free requests/month
- ✅ $0.001 per request after free tier
- ✅ No infrastructure to maintain
- ✅ Automatic cookie consent dismissal
- ✅ JavaScript rendering built-in

**Cost comparison for ~1,500 analyses/month:**
| Service | Monthly Cost | Always On? |
|---------|--------------|------------|
| Railway/Render | $5-10 | ✅ Yes |
| **ScrapingBee** | **$0.50** | ❌ No |

---

## Setup (5 Minutes)

### Step 1: Sign Up for ScrapingBee

1. Go to [scrapingbee.com](https://www.scrapingbee.com/)
2. Click "Start Free Trial"
3. Sign up with email or GitHub
4. **No credit card required** for 1,000 free requests

### Step 2: Get Your API Key

1. After signup, go to your dashboard
2. Copy the API key (looks like: `abc123def456...`)

### Step 3: Add API Key to Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `oadwluspjlsnxhgakral`
3. Settings → Edge Functions → Environment Variables
4. Click "+ Add Variable"
   - **Key:** `SCRAPINGBEE_API_KEY`
   - **Value:** (paste your API key)
   - **Apply to:** All functions or `analyze-website`
5. Click "Save"

### Step 4: Deploy Updated Edge Function

```bash
cd "Test P2G 1-iCloud"
npx supabase functions deploy analyze-website
```

Wait for deployment to complete (~30 seconds).

---

## Testing

### 1. Test ScrapingBee Directly (Optional)

```bash
curl "https://app.scrapingbee.com/api/v1/?api_key=YOUR_API_KEY&url=https://soukaarhus.dk/da&render_js=true" | head -c 1000
```

Expected: HTML starting with `<!DOCTYPE html>`

### 2. Test Via Your App

1. Go to: https://social-media-saas-psi.vercel.app
2. Login
3. Business Profile page
4. Enter URL: `soukaarhus.dk/da`
5. Click "Analysér website"

**Expected result:**
```json
{
  "businessName": "Souk Aarhus",
  "businessType": "restaurant",
  "shortDescription": "Middle Eastern cuisine..."
}
```

### 3. Check Logs

```bash
npx supabase functions logs analyze-website --tail
```

Look for:
- ✅ `🚀 Using ScrapingBee (JavaScript rendering + cookie consent)`
- ✅ `✅ ScrapingBee scraping successful: 145000 chars`
- ✅ `✅ Basic info extracted: Souk Aarhus - restaurant`

---

## How It Works

### Before (Simple Fetch - Failed)
```
1. fetch('soukaarhus.dk/da')
2. Gets HTML with cookie dialog
3. Extracts 3 lines of text
4. AI hallucinates wrong data ❌
```

### After (ScrapingBee - Works)
```
1. ScrapingBee renders JS + dismisses cookies
2. Returns fully-rendered HTML
3. Extracts full content (145KB+)
4. AI extracts correct data ✅
```

### Automatic Detection

The system automatically uses ScrapingBee when:
1. Domain is in hardcoded list (`soukaarhus.dk`)
2. OR: After initial fetch, detects SPA patterns + minimal content

**From code:**
```typescript
const useAdvancedScraper = needsAdvancedScraping(url)
// Checks: jsHeavyDomains.includes('soukaarhus.dk') → true
// Uses ScrapingBee automatically
```

---

## Cost Tracking

### Monitor Usage

1. Go to [ScrapingBee Dashboard](https://app.scrapingbee.com/account)
2. View → API Calls
3. Check requests used this month

### Expected Usage

- **Per analysis:** 1 request
- **50 analyses/day:** 1,500 requests/month
- **Cost:** FREE (under 1,000) or $0.50/month (over 1,000)

### Optimization Tips

**Cache results** (future improvement):
```sql
-- Store rendered HTML for 24h
-- Reuse for same URL if fresh
```

---

## Troubleshooting

### "Advanced scraping recommended but SCRAPINGBEE_API_KEY not configured"

**Fix:** Add API key to Supabase environment variables (Step 3 above)

### "ScrapingBee failed: 401"

**Cause:** Invalid API key

**Fix:**
1. Check API key in ScrapingBee dashboard
2. Verify it's correctly set in Supabase
3. Redeploy edge function

### "ScrapingBee failed: 403 - Quota exceeded"

**Cause:** Used all 1,000 free requests

**Fix:**
1. Upgrade to paid plan ($49/mo for 100k requests)
2. Or add credit card for pay-per-use ($0.001/request)

### Still Extracting Wrong Data

1. Check logs: `npx supabase functions logs analyze-website`
2. Verify ScrapingBee was used (look for "🚀 Using ScrapingBee")
3. Check HTML length (should be >50,000 chars)
4. Test URL directly in browser

---

## ScrapingBee Features Used

| Feature | Enabled | Purpose |
|---------|---------|---------|
| `render_js=true` | ✅ | Execute JavaScript |
| `country_code=dk` | ✅ | Use Danish proxy |
| `wait=1000` | ✅ | Wait 1s for content |
| `premium_proxy=false` | ✅ | Standard (cheaper) |
| Cookie auto-accept | ✅ | Built-in |

---

## Upgrading (Optional)

### Free Tier Limits
- 1,000 requests/month
- Standard proxies only
- No concurrent requests guarantee

### Paid Plans
| Plan | Monthly | Requests | Best For |
|------|---------|----------|----------|
| Freelancer | $49 | 100k | Growing usage |
| Startup | $149 | 400k | High volume |
| Pay-as-you-go | $0.001/req | Unlimited | Sporadic use |

**Recommendation:** Stay on free tier until you hit 1,000/month, then switch to pay-as-you-go.

---

## Alternative: Fallback to Simple Fetch

If ScrapingBee fails, the system automatically falls back to simple HTTP fetch:

```typescript
try {
  html = await fetchWithScrapingBee(url)
} catch (error) {
  console.log('⚠️ ScrapingBee failed, falling back')
  html = await fetchWithSimpleRequest(url)
}
```

This ensures your app keeps working even if:
- ScrapingBee quota exceeded
- API key issues
- Service temporarily down

---

## Next Steps

### After Successful Integration

1. ✅ Monitor first week of usage
2. ✅ Check ScrapingBee dashboard for request count
3. ✅ Add more domains to detection list as needed
4. 🔄 Consider caching for repeat requests

### Adding More Domains

Edit [html-helpers.ts](supabase/functions/_shared/crawling/html-helpers.ts):

```typescript
const jsHeavyDomains = [
  'soukaarhus.dk',
  'your-next-spa-site.com',  // Add here
]
```

Then redeploy:
```bash
npx supabase functions deploy analyze-website
```

---

## Support

- **ScrapingBee Docs:** https://www.scrapingbee.com/documentation/
- **Dashboard:** https://app.scrapingbee.com/
- **Support:** support@scrapingbee.com

**Test Command:**
```bash
# Quick test
curl "https://app.scrapingbee.com/api/v1/?api_key=YOUR_KEY&url=https://httpbin.org/html"
```
