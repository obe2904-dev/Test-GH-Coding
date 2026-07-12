# Google Cloud Run Scraper - Implementation Status

**Date**: 2026-07-12  
**Project**: P2G Social Media SaaS  
**Purpose**: Solve JavaScript-heavy website scraping (e.g., Souk Aarhus)

---

## 🔴 **PROBLEM IDENTIFIED**

### Souk Aarhus Scraping Failure
- **URL**: https://soukaarhus.dk/da
- **Business ID**: `450c1b6a-e354-4eef-88d8-86cd2ac8d42b`
- **Issue**: Simple HTTP fetch only extracts 3 lines (CSS imports)
- **Current Classification**: "retail" (WRONG - should be "restaurant")
- **Root Cause**: JavaScript-rendered SPA - content loads after page render

### Cost Constraint
- ❌ ScrapingBee: $49.99/month (eliminated)
- ✅ Google Cloud Run: ~$1-3/month pay-per-use

---

## ✅ **COMPLETED STEPS**

### 1. Google Cloud Setup
- ✅ Created project: `p2g-scraper` (hit billing limit)
- ✅ Switched to existing project: **`strategyp2g`**
- ✅ Project ID: `strategyp2g`
- ✅ Billing enabled: `billingAccounts/014990-579FE9-1BD41C`

### 2. APIs Enabled
- ✅ Cloud Run API (`run.googleapis.com`)
- ✅ Cloud Build API (`cloudbuild.googleapis.com`)
- ✅ Artifact Registry API (`artifactregistry.googleapis.com`)

### 3. Database Migration
- ✅ Created `scraped_cache` table in Supabase
- ✅ 24-hour cache TTL implemented
- ✅ 7-day cleanup function deployed

### 4. Local Folder Structure
- ✅ Created `cloud-run-scraper/` directory

---

## 🟡 **PARTIALLY COMPLETE**

### Cloud Run Scraper Files (IN PROGRESS)
Started but not finished creating:
- `cloud-run-scraper/index.js` - Express server with Puppeteer
- `cloud-run-scraper/Dockerfile` - Container configuration
- `cloud-run-scraper/package.json` - Dependencies
- `cloud-run-scraper/.dockerignore` - Build exclusions
- `cloud-run-scraper/deploy.sh` - Deployment script

---

## 🔴 **MISSING / TODO**

### 1. Complete Scraper Service Files
- [ ] Create complete `index.js` with Puppeteer scraper
- [ ] Create `Dockerfile` with Chromium dependencies
- [ ] Create `package.json` with correct dependencies
- [ ] Create `.dockerignore`
- [ ] Create deployment script

### 2. Deploy to Cloud Run
- [ ] Build Docker image
- [ ] Push to Artifact Registry
- [ ] Deploy to Cloud Run
- [ ] Get service URL
- [ ] Test scraper endpoint

### 3. Update Supabase Edge Function
- [ ] Modify `supabase/functions/_shared/crawling/website-scraper.ts`
- [ ] Add Cloud Run scraper integration
- [ ] Add fallback logic (try Cloud Run → fallback to simple fetch)
- [ ] Store Cloud Run URL as environment variable

### 4. Test & Verify
- [ ] Test Souk Aarhus scraping
- [ ] Verify "restaurant" classification
- [ ] Monitor Cloud Run costs
- [ ] Test other JS-heavy sites

---

## 📋 **NEXT STEPS (IN ORDER)**

1. **Create all Cloud Run scraper files** (10 min)
2. **Deploy to Cloud Run** (5 min)
   ```bash
   cd cloud-run-scraper
   ./deploy.sh
   ```
3. **Get service URL** from deployment output
4. **Update Supabase scraper** to call Cloud Run service
5. **Test with Souk Aarhus**
6. **Verify cost** after 24 hours

---

## 🎯 **EXPECTED OUTCOME**

After completion:
- ✅ Souk Aarhus correctly classified as "restaurant"
- ✅ All JS-heavy sites can be scraped
- ✅ Cost: ~$1-3/month (vs $49.99 ScrapingBee)
- ✅ Automatic fallback to simple fetch for simple sites

---

## 🛠️ **TECHNICAL ARCHITECTURE**

```
User clicks "Analyze Website"
    ↓
Supabase Edge Function (analyze-website)
    ↓
website-scraper.ts checks cache
    ↓
If cache miss:
    ├─ Try Cloud Run scraper (for JS sites)
    │   └─ https://scraper-[hash]-uc.a.run.app/scrape
    │       └─ Returns: { html, success, scraperType: "cloud-run-puppeteer" }
    │
    └─ Fallback to simple fetch (for simple sites)
    ↓
Cache result (24h TTL)
    ↓
Extract business info with AI
```

---

## 💰 **COST ESTIMATE**

### Cloud Run Pricing (us-central1)
- **CPU**: $0.00002400 per vCPU-second
- **Memory**: $0.00000250 per GiB-second
- **Requests**: $0.40 per million

### Example Usage (100 scrapes/month)
- 100 requests × 10 seconds × 1 vCPU = 1,000 vCPU-seconds = $0.024
- 100 requests × 10 seconds × 2 GiB = 2,000 GiB-seconds = $0.005
- 100 requests = $0.00004
- **Total: ~$0.03/month** (with 24h cache reducing requests by 80%)

### With Cache (80% hit rate)
- Actual scrapes: 20/month
- **Real cost: ~$0.006/month** 🎉

---

## 🚨 **BLOCKERS RESOLVED**

- ✅ Vercel Lambda library incompatibility (switched to Cloud Run)
- ✅ ScrapingBee cost ($49.99/mo eliminated)
- ✅ Billing account limit (used existing strategyp2g project)
- ✅ API enablement (all required APIs active)

---

## 📞 **ACTION REQUIRED**

**Status**: Waiting to complete file creation and deployment

**User should confirm**:
- Ready to proceed with Cloud Run deployment?
- Any security/cost concerns?
- Test with Souk Aarhus after deployment?
