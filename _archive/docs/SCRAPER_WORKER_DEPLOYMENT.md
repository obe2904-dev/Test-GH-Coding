# Web Scraper Worker Deployment Guide

This guide explains how to deploy the advanced web scraper worker to Google Cloud Run and integrate it with the `analyze-website` edge function.

## Overview

The scraper worker provides advanced JavaScript-rendering capabilities using Playwright/Chromium, which dramatically improves content extraction from:
- Single Page Applications (SPAs)
- JavaScript-heavy websites
- Sites with lazy-loaded content
- Sites with navigation toggles or modals

**Expected Improvements:**
- +40-60% more menu items extracted
- +30% better contact info discovery
- +50% more complete opening hours
- Better handling of cookie consent modals
- Discovery of content in SPA routes

## Architecture

```
Edge Function (analyze-website)
    ↓
  Detects JavaScript/SPA
    ↓
Cloud Run Worker (/scrape endpoint)
    ↓
  Playwright Browser Scraping
    ↓
Returns full rendered HTML
```

## Deployment Steps

### 1. Prerequisites

- Google Cloud SDK installed (`gcloud` CLI)
- Google Cloud project with Cloud Run API enabled
- Service account with Cloud Run deployment permissions

### 2. Deploy to Cloud Run

```bash
cd cloud-run-workers/website-analyzer-worker

# Build and deploy to Cloud Run
gcloud run deploy website-analyzer-worker \
  --source . \
  --region europe-west1 \
  --platform managed \
  --allow-unauthenticated \
  --timeout 60s \
  --memory 2Gi \
  --cpu 2 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars WORKER_TRIGGER_TOKEN=your-secret-token-here,\
SUPABASE_URL=your-supabase-url,\
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key,\
OPENAI_API_KEY=your-openai-key
```

**Important Configuration:**
- `--memory 2Gi` - Playwright needs sufficient memory for Chromium
- `--cpu 2` - Faster page rendering with multiple CPUs
- `--timeout 60s` - Allow time for complex pages to render
- `--min-instances 0` - Scale to zero when not in use
- `--max-instances 10` - Limit concurrent instances

### 3. Get Service URL

After deployment, Cloud Run will output the service URL:

```
Service [website-analyzer-worker] revision [website-analyzer-worker-00001-abc] has been deployed and is serving 100 percent of traffic.
Service URL: https://website-analyzer-worker-xyz-ew.a.run.app
```

### 4. Configure Edge Function

Add the following environment variables to your Supabase Edge Function:

**Via Supabase Dashboard:**
1. Go to Edge Functions → analyze-website → Settings
2. Add environment variables:
   - `SCRAPER_WORKER_URL`: `https://website-analyzer-worker-xyz-ew.a.run.app`
   - `WORKER_TRIGGER_TOKEN`: `your-secret-token-here` (same as Cloud Run config)

**Via Supabase CLI:**
```bash
supabase secrets set SCRAPER_WORKER_URL=https://website-analyzer-worker-xyz-ew.a.run.app
supabase secrets set WORKER_TRIGGER_TOKEN=your-secret-token-here
```

### 5. Deploy Edge Function

```bash
supabase functions deploy analyze-website
```

## How It Works

### Automatic Detection

The edge function automatically detects when to use advanced scraping:

**URL-Based Detection:**
- `wolt.com`, `nemlig.com`, `hungry.dk`, `just-eat.dk`
- `ubereats.com`, `deliveroo.*`, `foodora.*`, `bolt.eu`

**HTML-Based Detection (after initial fetch):**
- Detects React: `<div id="root">`, React bundles
- Detects Vue: `<div id="app">`, Vue bundles
- Detects Angular: `ng-app`, `ng-controller`
- Detects Next.js: `__NEXT_DATA__`, `_next/`
- Detects Nuxt.js: `__NUXT__`, `_nuxt/`
- Minimal content (<500 chars) + SPA indicators

### Scraping Flow

1. **Try URL-based detection** → Use advanced scraper immediately
2. **Try simple fetch first** → If HTML looks like SPA, retry with browser
3. **Fallback** → If scraper fails, use simple fetch results

### Advanced Scraping Features

The Playwright scraper (`browser_fetcher.py`) provides:

**Navigation:**
- Clicks navigation toggles: `"nav button"`, `"button.menu"`, `"#menu"`
- Clicks menu links: "Menu", "Menukort", "Bestil", "Åbningstider", "Om"

**Content Discovery:**
- Scrolls page 3 times to trigger lazy loading
- Tries hash fragments: `#menu`, `#menukort`, `#food`, `#about`, `#kontakt`
- Waits for JavaScript rendering

**Anti-Bot Evasion:**
- Full browser user agent
- Realistic viewport size
- Proper headers

## Testing

### Test the Worker Directly

```bash
curl -X POST https://website-analyzer-worker-xyz-ew.a.run.app/scrape \
  -H "Content-Type: application/json" \
  -H "x-worker-token: your-secret-token-here" \
  -d '{
    "url": "https://cafefaust.dk",
    "useBrowser": true,
    "timeout": 25000
  }'
```

Expected response:
```json
{
  "html": "<!DOCTYPE html>...",
  "finalUrl": "https://cafefaust.dk",
  "method": "browser"
}
```

### Test via Edge Function

```bash
curl -X POST https://your-project.supabase.co/functions/v1/analyze-website \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://cafefaust.dk",
    "businessName": "Café Faust",
    "tier": "free"
  }'
```

Check logs for:
```
🚀 Using advanced browser scraping (detected JavaScript/SPA)
✅ Advanced scraping successful: 85432 chars
```

## Monitoring

### Cloud Run Logs

View scraper worker logs:
```bash
gcloud run services logs read website-analyzer-worker \
  --region europe-west1 \
  --limit 100
```

### Edge Function Logs

View edge function logs via Supabase Dashboard or CLI:
```bash
supabase functions log analyze-website --tail
```

### Key Metrics to Monitor

- **Request latency**: Should be 5-15 seconds for browser scraping
- **Memory usage**: Should stay under 1.5GB for most pages
- **Success rate**: Should be >95% for supported sites
- **Extraction improvements**: Compare menu items before/after

## Troubleshooting

### Worker Returns 401 Unauthorized

- Ensure `WORKER_TRIGGER_TOKEN` matches in both Cloud Run and Edge Function
- Check `x-worker-token` header is being sent

### Worker Times Out

- Increase `--timeout` in Cloud Run deployment
- Check target website isn't blocking automated requests
- Verify sufficient memory allocation (`--memory 2Gi`)

### Worker Returns Empty HTML

- Check Playwright installation in Dockerfile
- Verify browser launches successfully (check logs)
- Ensure sufficient memory for Chromium

### Edge Function Not Using Worker

- Verify `SCRAPER_WORKER_URL` environment variable is set
- Check detection logic triggers (URL or HTML patterns)
- Review edge function logs for "Using advanced browser scraping"

### Fallback to Simple Fetch

This is expected behavior! If the worker fails, the edge function automatically falls back to simple fetch to ensure reliability.

## Cost Optimization

### Cloud Run Pricing (europe-west1)

**Free Tier:**
- 2M requests/month
- 360,000 vCPU-seconds/month
- 180,000 GiB-seconds/month

**Typical Request:**
- Duration: ~10 seconds
- Memory: ~1.5GB
- Cost: ~$0.0002 per request

**Optimization Tips:**
1. Use `--min-instances 0` to scale to zero
2. Set `--max-instances` to control concurrent load
3. Only use browser scraping when needed (automatic)
4. Monitor and adjust `--cpu` and `--memory` based on usage

## Security

### Authentication

The worker uses token-based authentication:
- Set `WORKER_TRIGGER_TOKEN` as a strong random value
- Keep token secret and rotate periodically
- Use different tokens for staging/production

### Network Security

Consider adding:
- Cloud Run ingress controls (allow only from Supabase IPs)
- VPC connector for private networking
- Cloud Armor for DDoS protection

## Maintenance

### Update Worker

```bash
cd cloud-run-workers/website-analyzer-worker
gcloud run deploy website-analyzer-worker \
  --source . \
  --region europe-west1
```

Cloud Run will automatically version and roll out changes.

### Update Playwright Version

Edit `Dockerfile`:
```dockerfile
FROM mcr.microsoft.com/playwright/python:v1.41.0-jammy
```

Redeploy to apply changes.

## Support

For issues or questions:
1. Check Cloud Run logs for errors
2. Review edge function logs for detection logic
3. Test worker endpoint directly (see Testing section)
4. Verify environment variables are set correctly
