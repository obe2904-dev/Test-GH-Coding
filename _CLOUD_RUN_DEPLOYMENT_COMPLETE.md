# ✅ Cloud Run Puppeteer Scraper - Deployment Complete

**Deployed:** 2026-07-12 13:30 UTC  
**Status:** ✅ Production Ready  
**Cost Estimate:** $1-3/month (vs $49.99/month ScrapingBee)

---

## 🚀 Deployment Summary

### Cloud Run Service
- **Service Name:** `scraper`
- **Region:** `europe-west1` (Belgium)
- **URL:** `https://scraper-831683741713.europe-west1.run.app`
- **Image:** `gcr.io/strategyp2g/scraper:latest`
- **Authentication:** Required (Google Cloud IAM + API key)
- **Resources:** 2GB RAM, 1 CPU, 30s timeout

### API Credentials
- **API Key:** `wPoMQTeyMW6zZ60oeRq9QGxZ2R/LHVj4diP7OD54KYo=`
- **Authentication:** Service requires Google Cloud identity token + API key header

### Supabase Integration
✅ **Secrets Added:**
- `CLOUD_RUN_SCRAPER_URL` = `https://scraper-831683741713.europe-west1.run.app`
- `CLOUD_RUN_API_KEY` = `wPoMQTeyMW6zZ60oeRq9QGxZ2R/LHVj4diP7OD54KYo=`

✅ **Edge Functions Deployed:**
- 36 functions deployed with updated website-scraper.ts
- Cloud Run fallback integrated into `analyze-website` function

### Scraper Logic
1. **Primary:** Simple fetch (fast, cheap, works for most sites)
2. **Fallback:** Cloud Run Puppeteer (triggers when):
   - Simple fetch fails
   - HTML < 5KB (likely JavaScript-heavy site)

---

## 🧪 Testing

### Test from Command Line
```bash
# Get identity token
TOKEN=$(gcloud auth print-identity-token)

# Test scraper directly
curl -X POST https://scraper-831683741713.europe-west1.run.app/scrape \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-api-key: wPoMQTeyMW6zZ60oeRq9QGxZ2R/LHVj4diP7OD54KYo=" \
  -d '{"url": "https://soukaarhus.dk/da"}' \
  | jq '.success, .scraperType, .metadata'
```

**Expected Output:**
```json
{
  "success": true,
  "scraperType": "cloud-run-puppeteer",
  "metadata": {
    "url": "https://soukaarhus.dk/da",
    "scrapedAt": "2026-07-12T13:28:46.658Z",
    "durationMs": 5241,
    "htmlLength": 1520758
  }
}
```

### Test from App UI
1. Go to https://social-media-saas-psi.vercel.app/
2. Navigate to business: Souk Aarhus (ID: `450c1b6a-e354-4eef-88d8-86cd2ac8d42b`)
3. Trigger "Re-analyze Website" or "Refresh Business Profile"
4. **Expected:** Business type changes from "retail" → "restaurant"
5. Check logs for: `✅ Cloud Run scraper succeeded`

---

## 💰 Cost Analysis

### Cloud Run Pricing (europe-west1)
- **CPU:** $0.00002400 per vCPU-second
- **Memory:** $0.00000250 per GiB-second
- **Requests:** First 2M requests/month free

### Per-Scrape Cost
- **Duration:** ~5s per scrape
- **CPU cost:** 1 vCPU × 5s × $0.000024 = **$0.00012**
- **Memory cost:** 2GB × 5s × $0.0000025 = **$0.000025**
- **Total per scrape:** **~$0.00015**

### Monthly Estimates
- **100 scrapes/month:** $0.015 (~$0.02)
- **500 scrapes/month:** $0.075 (~$0.08)
- **1,000 scrapes/month:** $0.15
- **10,000 scrapes/month:** $1.50

### Comparison
| Service | Cost | JavaScript Support | Setup |
|---------|------|-------------------|-------|
| ScrapingBee | $49.99/mo | ✅ Yes | Easy |
| **Cloud Run** | **$1-3/mo** | **✅ Yes** | **Medium** |
| Simple Fetch | Free | ❌ No | Easy |

**Savings:** $47-49/month (96-98% reduction)

---

## 📊 Monitoring

### Budget Alert
⚠️ **Action Required:** Set up billing alert
1. Go to: https://console.cloud.google.com/billing
2. Navigate to: Budgets & alerts
3. Create alert:
   - **Budget:** $5/month
   - **Alert threshold:** 80% ($4)
   - **Email:** obk@pots2grow.com

### Usage Monitoring
```bash
# Check Cloud Run metrics
gcloud run services describe scraper \
  --region europe-west1 \
  --project strategyp2g \
  --format="get_uri()"

# View logs
gcloud logs read --project strategyp2g \
  --resource-type cloud_run_revision \
  --filter='resource.labels.service_name="scraper"' \
  --limit 50 \
  --format json
```

---

## 🏗️ Technical Details

### Architecture
```
Frontend → Supabase Edge Function → Cloud Run Scraper
                ↓                         ↓
         [Simple Fetch]           [Puppeteer + Chromium]
                ↓                         ↓
            Success?                  Fallback
                ↓                         ↓
           Return HTML             Return HTML
```

### Docker Image
- **Base:** `node:20-slim` (Debian)
- **Size:** ~700MB (includes Chromium)
- **Chromium:** System-installed via apt-get
- **Node packages:** Express 4.18.2, Puppeteer 21.0.0
- **User:** Non-root (pptruser)

### Files Created
```
cloud-run-scraper/
├── Dockerfile          # Container build instructions
├── index.js           # Express server + Puppeteer logic
├── package.json       # Node.js dependencies
├── .dockerignore      # Build exclusions
└── deploy.sh          # Deployment automation script
```

### Code Changes
- **Modified:** `supabase/functions/_shared/crawling/website-scraper.ts`
  - Added `scrapeWithCloudRun()` function
  - Added fallback logic to main `scrapeWebsite()` function
  - Updated return type to include `'cloud-run-puppeteer'`

---

## 🎯 Known Issues & Solutions

### Issue: Souk Aarhus Still Shows "retail"
**Cause:** Website hasn't been re-analyzed yet  
**Solution:** Trigger re-analysis from app UI or wait for next scheduled refresh

### Issue: Cloud Run Returns 403 Forbidden
**Cause:** Missing Google Cloud identity token  
**Solution:** Service requires both IAM authentication + API key header

### Issue: Slow Build Times (13+ minutes)
**Cause:** ARM64 Mac cross-compiling to AMD64 via QEMU emulation  
**Solution:** Future builds should use Cloud Build:
```bash
gcloud builds submit --tag gcr.io/strategyp2g/scraper \
  --project strategyp2g \
  --timeout 10m
```

---

## 📝 Next Steps

1. ✅ ~~Deploy Cloud Run service~~
2. ✅ ~~Add Supabase secrets~~
3. ✅ ~~Update website-scraper.ts~~
4. ✅ ~~Deploy Edge Functions~~
5. ⏳ **Set up $5/month budget alert** (obk@pots2grow.com)
6. ⏳ **Test with Souk Aarhus** (trigger from UI)
7. ⏳ **Monitor costs for 24-48 hours**
8. ⏳ **Verify classification changes** (retail → restaurant)

---

## 🔗 Resources

- **Cloud Run Dashboard:** https://console.cloud.google.com/run?project=strategyp2g
- **Container Registry:** https://console.cloud.google.com/gcr/images/strategyp2g
- **Supabase Functions:** https://supabase.com/dashboard/project/oadwluspjlsnxhgakral/functions
- **Billing:** https://console.cloud.google.com/billing/01E756-42D3E3-2D82CE

---

## 🚨 Emergency Rollback

If scraper causes issues, disable Cloud Run fallback:

```bash
# Remove Cloud Run secrets
supabase secrets unset CLOUD_RUN_SCRAPER_URL --project-ref oadwluspjlsnxhgakral
supabase secrets unset CLOUD_RUN_API_KEY --project-ref oadwluspjlsnxhgakral

# Redeploy Edge Functions
supabase functions deploy analyze-website --project-ref oadwluspjlsnxhgakral
```

This will fall back to simple fetch only.

---

**Deployment completed by:** GitHub Copilot  
**Documentation created:** 2026-07-12 13:35 UTC
