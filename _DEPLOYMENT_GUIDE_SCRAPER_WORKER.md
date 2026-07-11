# Scraper Worker Deployment Guide

This guide walks you through deploying the Playwright scraper worker to fix JavaScript-heavy website extraction (like soukaarhus.dk).

## Problem Summary

**Current Issue:**
- Websites with JavaScript/SPAs/cookie consent → scraper gets empty content
- AI extracts wrong data because it only sees cookie dialog text
- Example: soukaarhus.dk/da shows 3 lines instead of full restaurant info

**Solution:**
- Deploy Playwright-based browser scraper
- Auto-dismisses cookie consent
- Returns fully-rendered HTML to AI

---

## Step-by-Step Deployment

### ✅ Step 1: Deploy Scraper Worker (Choose One Platform)

#### Option A: Railway (Recommended - Easiest)

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login and Deploy:**
   ```bash
   railway login
   cd scraper-worker
   railway init
   railway up
   ```

3. **Generate and Set Token:**
   ```bash
   railway variables set WORKER_TOKEN=$(openssl rand -hex 32)
   ```

4. **Create Public Domain:**
   ```bash
   railway domain
   ```
   Copy the URL (e.g., `https://scraper-worker-production-xxxx.up.railway.app`)

5. **Save Token for Later:**
   ```bash
   railway variables
   # Copy the WORKER_TOKEN value
   ```

#### Option B: Render (Best Free Tier)

1. Go to [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your Git repo
4. **Settings:**
   - Root Directory: `scraper-worker`
   - Environment: Docker
   - Dockerfile Path: `scraper-worker/Dockerfile`
   - Instance Type: Free or Starter ($7/mo)
5. **Environment Variables:**
   - `WORKER_TOKEN`: Generate with `openssl rand -hex 32`
6. Click "Create Web Service"
7. Wait for deployment (~5-10 minutes)
8. Copy service URL (e.g., `https://scraper-worker.onrender.com`)

#### Option C: Fly.io (Most Control)

```bash
curl -L https://fly.io/install.sh | sh
cd scraper-worker
fly launch
fly secrets set WORKER_TOKEN=$(openssl rand -hex 32)
fly deploy
fly info  # Copy hostname
```

---

### ✅ Step 2: Configure Supabase Environment Variables

1. **Go to Supabase Dashboard:**
   - Open your project
   - Settings → Edge Functions

2. **Add Environment Variables:**

   **Variable 1:**
   - Key: `SCRAPER_WORKER_URL`
   - Value: `https://your-worker-url.railway.app` (from Step 1)
   - Apply to: All functions or `analyze-website`

   **Variable 2:**
   - Key: `SCRAPER_WORKER_TOKEN`
   - Value: (the token you generated in Step 1)
   - Apply to: All functions or `analyze-website`

3. **Save and Redeploy Edge Functions:**
   ```bash
   cd "Test P2G 1-iCloud"
   npx supabase functions deploy analyze-website
   ```

---

### ✅ Step 3: Test the Integration

1. **Test Worker Directly:**
   ```bash
   curl -X POST https://your-worker-url.railway.app/scrape \
     -H "Content-Type: application/json" \
     -H "x-worker-token: YOUR_TOKEN" \
     -d '{"url": "https://soukaarhus.dk/da", "useBrowser": true}'
   ```

   Expected: JSON response with ~100k+ chars of HTML

2. **Test via Frontend:**
   - Go to your app: https://social-media-saas-psi.vercel.app
   - Login
   - Business Profile page
   - Enter URL: `soukaarhus.dk/da`
   - Click "Analysér website"

3. **Check Supabase Logs:**
   ```bash
   npx supabase functions logs analyze-website
   ```

   Look for:
   - ✅ `🚀 Using advanced browser scraping`
   - ✅ `✅ Advanced scraping successful: 145000 chars`
   - ✅ `✅ Basic info extracted: Souk Aarhus - restaurant`

---

### ✅ Step 4: Deploy Updated Detection Logic

The code changes are already made. Just deploy:

```bash
git add supabase/functions/_shared/crawling/html-helpers.ts
git commit -m "Add soukaarhus.dk to advanced scraping detection list"
git push origin main

npx supabase functions deploy analyze-website
```

---

## Verification Checklist

After deployment, verify each step:

- [ ] Worker service is running (check Railway/Render dashboard)
- [ ] Health check works: `curl https://your-worker-url/health`
- [ ] Scrape endpoint works (test curl from Step 3.1)
- [ ] Supabase environment variables are set
- [ ] Edge function redeployed with new variables
- [ ] Detection logic updated and deployed
- [ ] Frontend test successful (extracts "Souk Aarhus")
- [ ] Database shows correct data

---

## Expected Results

**Before (Current Behavior):**
```json
{
  "businessName": "Souk Aarhus",
  "businessType": "retail",  // ❌ WRONG
  "shortDescription": "... online platform ..."  // ❌ WRONG
}
```

**After (With Worker):**
```json
{
  "businessName": "Souk Aarhus",
  "businessType": "restaurant",  // ✅ CORRECT
  "shortDescription": "Middle Eastern cuisine..."  // ✅ CORRECT
}
```

---

## Cost Breakdown

| Platform | Setup Time | Monthly Cost | Free Tier |
|----------|------------|--------------|-----------|
| Railway | 5 min | $5-10 | $5 credit |
| Render | 10 min | $7 or free | 750 hrs/mo |
| Fly.io | 10 min | $5-7 | 3 VMs free |

**Recommendation:** 
- **Development:** Railway free credit or Render free tier
- **Production:** Render Starter ($7/mo) or Railway Pro

---

## Troubleshooting

### Worker Returns "Unauthorized"
- Check `WORKER_TOKEN` matches in worker and Supabase
- Verify header is lowercase: `x-worker-token`

### "Advanced scraping not detected"
- Confirm `soukaarhus.dk` added to `jsHeavyDomains` list
- Redeploy edge function: `npx supabase functions deploy analyze-website`

### Worker Timeout
- Increase timeout in Railway/Render (30 seconds)
- Or increase `timeout` param in scraper config

### Still Extracting Wrong Data
- Check worker logs: Railway/Render dashboard
- Test scrape endpoint directly (curl command)
- Verify HTML length > 50,000 chars

### "Chromium not found"
- Dockerfile installs Playwright automatically
- For local dev: `npx playwright install chromium`

---

## Next Steps

After successful deployment:

1. **Monitor Usage:**
   - Railway/Render dashboard → Check RAM/CPU usage
   - May need to upgrade instance size if handling many requests

2. **Add More Sites:**
   - Update `jsHeavyDomains` in `html-helpers.ts`
   - Or rely on automatic SPA detection

3. **Optimize Costs:**
   - Cache rendered HTML (24h TTL)
   - Only use worker for detected JS-heavy sites
   - Track usage in database

4. **Scale:**
   - Multiple worker instances for high traffic
   - Load balancer if needed
   - Consider ScrapingBee if volume gets high (>1000/day)

---

## Support

- Worker logs: Railway/Render dashboard
- Edge function logs: `npx supabase functions logs analyze-website`
- Frontend logs: Vercel deployment logs
- Database queries: Supabase SQL Editor

**Test Command Cheat Sheet:**
```bash
# Test worker health
curl https://your-worker-url/health

# Test scraping
curl -X POST https://your-worker-url/scrape \
  -H "Content-Type: application/json" \
  -H "x-worker-token: YOUR_TOKEN" \
  -d '{"url": "https://soukaarhus.dk/da"}'

# Check edge function logs
npx supabase functions logs analyze-website --tail

# Redeploy edge function
npx supabase functions deploy analyze-website
```
