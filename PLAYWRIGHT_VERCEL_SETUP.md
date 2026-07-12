# Playwright Vercel Scraper - Setup Guide

## 🎯 Overview

This guide walks you through setting up the Playwright-based scraping system on Vercel, which replaces ScrapingBee completely.

**Cost Savings**: Free on Vercel Pro (already paying $20/mo) vs ScrapingBee $49.99/mo minimum

**Architecture**:
- ✅ **Primary**: Vercel Playwright (free, 60s timeout, full JS rendering)
- 📄 **Fallback**: Simple fetch (for static sites when Vercel unavailable)
- 💾 **Cache**: 24-hour TTL to minimize scraping costs

**Note**: ScrapingBee has been completely removed from the codebase.

---

## 📁 Files Created/Modified

### New Files:
- `api/scrape.js` - Vercel serverless function with Playwright
- `api/package.json` - Dependencies for Playwright
- `_add_scraped_cache_table.sql` - Database migration for caching

### Modified Files:
- `supabase/functions/_shared/crawling/website-scraper.ts` - Added Vercel integration
- `supabase/functions/analyze-website/index.ts` - Added cache checking + Vercel params

---

## 🚀 Deployment Steps

### Step 1: Database Migration

Run the SQL migration to create the cache table:

```bash
cd "/Users/olebaek/Library/Mobile Documents/com~apple~CloudDocs/Test P2G 1-iCloud"

# Option A: Via Supabase Dashboard
# 1. Open https://supabase.com/dashboard/project/oadwluspjlsnxhgakral/sql/new
# 2. Paste contents of _add_scraped_cache_table.sql
# 3. Click "Run"

# Option B: Via psql (if connection works)
psql "postgresql://postgres.oadwluspjlsnxhgakral:Azb8OkgabqJPOxPS@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" -f _add_scraped_cache_table.sql
```

**Verify**:
```sql
-- In Supabase SQL Editor
SELECT tablename FROM pg_tables WHERE tablename = 'scraped_cache';
```

---

### Step 2: Generate API Key

Generate a secure API key for authentication between Supabase and Vercel:

```bash
# Generate a strong 32-character API key
openssl rand -base64 32
```

**Save this key** - you'll need it for both Vercel and Supabase.

Example output: `a8Ks9mP2xLqR3vWn4tYu5iOp6jHgF7dZ1cVb2nM=`

---

### Step 3: Configure Vercel Environment Variables

```bash
# Navigate to project root
cd "/Users/olebaek/Library/Mobile Documents/com~apple~CloudDocs/Test P2G 1-iCloud"

# Set the API key in Vercel (use the key from Step 2)
vercel env add SCRAPER_API_KEY

# When prompted:
# - Environment: Production, Preview, Development (select all 3)
# - Value: paste your generated API key
```

**Or via Vercel Dashboard**:
1. Go to https://vercel.com/dashboard
2. Select your project: `social-media-saas`
3. Go to Settings → Environment Variables
4. Add: `SCRAPER_API_KEY` = `<your-generated-key>`
5. Apply to: Production, Preview, Development

---

### Step 4: Deploy Vercel Function

```bash
# Make sure you're in project root
cd "/Users/olebaek/Library/Mobile Documents/com~apple~CloudDocs/Test P2G 1-iCloud"

# Deploy to Vercel
vercel --prod

# Or use Git push (if connected to GitHub)
git add api/
git commit -m "Add Playwright scraper to Vercel"
git push origin main
```

**Verify Deployment**:
1. Check Vercel dashboard for successful deployment
2. Note the function URL: `https://social-media-saas-psi.vercel.app/api/scrape`

---

### Step 5: Configure Supabase Secrets

Set the Vercel scraper URL and API key in Supabase:

```bash
cd "/Users/olebaek/Library/Mobile Documents/com~apple~CloudDocs/Test P2G 1-iCloud"

# Set Vercel scraper URL
npx supabase secrets set VERCEL_SCRAPER_URL="https://social-media-saas-psi.vercel.app/api/scrape"

# Set API key (same as Vercel)
npx supabase secrets set VERCEL_SCRAPER_API_KEY="<your-generated-key>"

# Verify secrets are set
npx supabase secrets list
```

**Expected Output**:
```
┌─────────────────────────┬─────────────────┐
│ NAME                    │ DIGEST          │
├─────────────────────────┼─────────────────┤
│ VERCEL_SCRAPER_URL      │ sha256:...      │
│ VERCEL_SCRAPER_API_KEY  │ sha256:...      │
│ SCRAPINGBEE_API_KEY     │ sha256:... (existing) │
│ OPENAI_API_KEY          │ sha256:... (existing) │
└─────────────────────────┴─────────────────┘
```

---

### Step 6: Deploy Supabase Edge Function

```bash
cd "/Users/olebaek/Library/Mobile Documents/com~apple~CloudDocs/Test P2G 1-iCloud"

# Deploy the modified analyze-website function
npx supabase functions deploy analyze-website
```

**Expected Output**:
```
Bundling Function: analyze-website
Deploying Function: analyze-website (script size: X MB)
{"project_ref":"oadwluspjlsnxhgakral","functions":["analyze-website"],...}
```

---

## ✅ Testing

### Test 1: Simple Website (Should use Vercel)

```bash
# Test with a simple restaurant site
curl -X POST https://oadwluspjlsnxhgakral.supabase.co/functions/v1/analyze-website \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example-restaurant.dk", "businessId": "test-id"}'
```

**Check logs** in Supabase Dashboard → Edge Functions → analyze-website → Logs

Look for:
- ✅ `Cache MISS - Will scrape fresh content`
- ✅ `Using Vercel Playwright (Primary scraper)`
- ✅ `Vercel scraping successful`
- ✅ `Saved to cache for future requests`

---

### Test 2: Heavy JS Site (Souk Aarhus)

```bash
curl -X POST https://oadwluspjlsnxhgakral.supabase.co/functions/v1/analyze-website \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://soukaarhus.dk/da", "businessId": "450c1b6a-e354-4eef-88d8-86cd2ac8d42b"}'
```

**Expected Behavior**:
- Vercel Playwright successfully renders heavy JS site
- Extracts links, headings, menu content
- Classifies as "restaurant" (not "retail")

---

### Test 3: Cache Hit (Repeat Request)

Run the same request again within 24 hours:

```bash
# Repeat test from Test 1 or Test 2
```

**Check logs** for:
- ✅ `Cache HIT - Using cached content from 2026-07-12T...`
- ✅ `Original scraper: vercel-playwright`
- ❌ No scraping occurs (cache served immediately)

---

## 🔍 Troubleshooting

### Issue: "Vercel Playwright failed: 401 - Unauthorized"

**Cause**: API key mismatch between Vercel and Supabase

**Fix**:
```bash
# Verify keys match
vercel env ls | grep SCRAPER_API_KEY
npx supabase secrets list | grep VERCEL_SCRAPER_API_KEY

# If different, regenerate and set consistently:
openssl rand -base64 32
# Then update both Vercel and Supabase with the new key
```

---

### Issue: "VERCEL_SCRAPER_URL not configured"

**Cause**: Supabase secrets not set or function not redeployed

**Fix**:
```bash
# Set the secret
npx supabase secrets set VERCEL_SCRAPER_URL="https://social-media-saas-psi.vercel.app/api/scrape"

# Redeploy function
npx supabase functions deploy analyze-website
```

---

### Issue: "Cache table does not exist"

**Cause**: Database migration not run

**Fix**:
1. Open Supabase SQL Editor
2. Run `_add_scraped_cache_table.sql`
3. Verify: `SELECT * FROM scraped_cache LIMIT 1;`

---

### Issue: Vercel timeout (60s exceeded)

**Cause**: Website is extremely slow or hanging

**Behavior**: 
- Vercel times out after 60s
- System falls back to simple fetch
- Simple fetch may fail for JS-heavy sites

**Solutions**:
1. Check Vercel function logs for specific errors
2. Try manual test: Visit the site in browser to see if it loads
3. If site is consistently slow, consider if it's worth including in your system

**Check**: Vercel function logs in dashboard

---

### Issue: "Advanced scraping recommended but Vercel scraper not configured"

**Cause**: Vercel scraper URL or API key not set in Supabase

**Fix**:
```bash
# Verify secrets are set
npx supabase secrets list | grep VERCEL

# If missing, set them
npx supabase secrets set VERCEL_SCRAPER_URL="https://social-media-saas-psi.vercel.app/api/scrape"
npx supabase secrets set VERCEL_SCRAPER_API_KEY="<your-key>"

# Redeploy
npx supabase functions deploy analyze-website
```

---

## 📊 Monitoring

### Cache Hit Rate

Check cache effectiveness:

```sql
-- In Supabase SQL Editor
SELECT 
  COUNT(*) as total_cached_urls,
  COUNT(DISTINCT scraper_type) as scraper_types_used,
  scraper_type,
  COUNT(*) as count
FROM scraped_cache
WHERE scraped_at > NOW() - INTERVAL '7 days'
GROUP BY scraper_type
ORDER BY count DESC;
```

---

### Scraper Usage Stats

Monitor which scraper is being used most:

```sql
SELECT 
  scraper_type,
  COUNT(*) as usage_count,
  AVG(scrape_duration_ms) as avg_duration_ms,
  MIN(scraped_at) as first_use,
  MAX(scraped_at) as last_use
FROM scraped_cache
WHERE scraped_at > NOW() - INTERVAL '30 days'
GROUP BY scraper_type
ORDER BY usage_count DESC;
```

---

### Failed Scrapes

Find problematic URLs:

```sql
SELECT 
  url,
  status,
  scraper_type,
  scraped_at
FROM scraped_cache
WHERE status != 'success'
ORDER BY scraped_at DESC
LIMIT 20;
```

---

## 🔄 Fallback Flow

```
User clicks "Analyser hjemmeside"
    ↓
Check scraped_cache (24h TTL)
    ├─ HIT → Use cached HTML ✅
    └─ MISS → Continue to scraping
        ↓
Try Vercel Playwright (Primary)
    ├─ SUCCESS → Cache + Return ✅
    └─ FAIL (timeout, error, 403)
        ↓
    Try Simple Fetch (Fallback)
        ├─ SUCCESS → Cache + Return ⚠️ (may be incomplete for JS-heavy sites)
        └─ FAIL → Return error ❌
```

---

## 💰 Cost Impact

### Before (ScrapingBee):
- **Cost**: $49.99/mo minimum (Freelance tier)
- **Per Request**: ~$0.002-0.003
- **1000 scrapes/mo**: ~$50-53

### After (Vercel Playwright + Cache):
- **Vercel**: $0 (included in Pro $20/mo)
- **Cache Hit Rate**: ~70-80% (estimated after 1 week)
- **Effective Fresh Scrapes**: 200-300/mo (20-30% cache miss)
- **Total Cost**: $0 extra

**Monthly Savings**: ~$50/mo (100% savings on scraping costs)

---

## 🎉 Success Indicators

You know it's working when:

1. ✅ Supabase logs show: `Using Vercel Playwright (Primary scraper)`
2. ✅ Second request shows: `Cache HIT - Using cached content`
3. ✅ Vercel dashboard shows successful `/api/scrape` invocations
4. ✅ Heavy JS sites (like Souk Aarhus) classify correctly as "restaurant"
5. ✅ Cache hit rate improves over time (check with SQL queries in Monitoring section)

---

## 🔐 Security Checklist

- [ ] API key is 32+ characters and random
- [ ] API key matches exactly between Vercel and Supabase
- [ ] CORS is restricted to Supabase domain in `api/scrape.js`
- [ ] No sensitive data logged in Vercel function
- [ ] Supabase secrets are set (not hardcoded in code)

---

##  Reference URLs

- **Vercel Project**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://supabase.com/dashboard/project/oadwluspjlsnxhgakral
- **Edge Function Logs**: https://supabase.com/dashboard/project/oadwluspjlsnxhgakral/functions/analyze-website/logs
- **Live App**: https://social-media-saas-psi.vercel.app/
- **Vercel Function URL**: https://social-media-saas-psi.vercel.app/api/scrape

---

## 🆘 Need Help?

If something isn't working:

1. Check Supabase Edge Function logs
2. Check Vercel function logs
3. Verify all environment variables are set
4. Test Vercel function directly with curl
5. Check database for `scraped_cache` table existence

---

**Last Updated**: 2026-07-12
**Version**: 1.0
**Status**: Ready for deployment ✅
