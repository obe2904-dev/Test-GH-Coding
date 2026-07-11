# Website Scraper Worker

Playwright-based web scraper service that handles JavaScript-heavy websites with automatic cookie consent dismissal.

## Features

- ✅ Executes JavaScript (React, Vue, Angular, Next.js, etc.)
- ✅ Auto-dismisses cookie consent dialogs (Danish + English)
- ✅ Headless Chrome via Playwright
- ✅ Token-based authentication
- ✅ Docker containerized
- ✅ Ready for Railway/Render/Fly.io deployment

## Quick Deploy to Railway (Recommended)

### 1. Install Railway CLI
```bash
npm install -g @railway/cli
```

### 2. Login to Railway
```bash
railway login
```

### 3. Deploy from this directory
```bash
cd scraper-worker
railway init
railway up
```

### 4. Set Environment Variables
```bash
# Generate a secure token
railway variables set WORKER_TOKEN=$(openssl rand -hex 32)

# Get your deployment URL
railway domain
```

### 5. Configure Supabase Edge Function

Go to Supabase Dashboard → Project Settings → Edge Functions → Environment Variables

Add:
- **Key:** `SCRAPER_WORKER_URL`
- **Value:** `https://your-railway-app.railway.app` (from step 4)
- **Key:** `SCRAPER_WORKER_TOKEN`
- **Value:** (same token from step 4)

## Alternative: Deploy to Render

### 1. Create New Web Service
- Go to [render.com](https://render.com)
- Click "New +" → "Web Service"
- Connect your Git repository
- Select `scraper-worker` directory

### 2. Configure Build Settings
- **Environment:** Docker
- **Dockerfile Path:** `scraper-worker/Dockerfile`
- **Instance Type:** Starter ($7/mo) or Free (limited hours)

### 3. Set Environment Variables
- `WORKER_TOKEN`: Generate with `openssl rand -hex 32`
- `PORT`: 3000 (Render auto-sets this)

### 4. Deploy
Click "Create Web Service" and wait for deployment

### 5. Configure Supabase
Add environment variables (same as Railway step 5)

## Alternative: Deploy to Fly.io

### 1. Install Fly CLI
```bash
curl -L https://fly.io/install.sh | sh
```

### 2. Login and Launch
```bash
cd scraper-worker
fly launch
# Follow prompts, say yes to Dockerfile
```

### 3. Set Secrets
```bash
fly secrets set WORKER_TOKEN=$(openssl rand -hex 32)
```

### 4. Deploy
```bash
fly deploy
```

### 5. Get URL
```bash
fly info
# Copy the hostname (e.g., your-app.fly.dev)
```

### 6. Configure Supabase
Add environment variables (same as Railway step 5)

## Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Install Playwright Browser
```bash
npx playwright install chromium
```

### 3. Set Environment Variable
```bash
export WORKER_TOKEN="dev-token-for-testing"
```

### 4. Start Server
```bash
npm run dev
```

### 5. Test Endpoint
```bash
curl -X POST http://localhost:3000/scrape \
  -H "Content-Type: application/json" \
  -H "x-worker-token: dev-token-for-testing" \
  -d '{"url": "https://soukaarhus.dk/da", "useBrowser": true}'
```

## API Reference

### POST /scrape

Scrape a website with Playwright browser.

**Headers:**
- `x-worker-token`: Authentication token (required)
- `Content-Type`: application/json

**Body:**
```json
{
  "url": "https://example.com",
  "useBrowser": true,
  "timeout": 25000
}
```

**Response:**
```json
{
  "html": "<html>...</html>",
  "url": "https://example.com",
  "timestamp": "2026-07-12T10:30:00.000Z",
  "length": 145000
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-07-12T10:30:00.000Z"
}
```

## Cost Estimates

| Platform | Free Tier | Paid Tier | Notes |
|----------|-----------|-----------|-------|
| Railway | $5 free credit | ~$5-10/mo | 512MB RAM, auto-sleep |
| Render | 750 hrs/mo free | $7/mo | Spins down after 15min idle |
| Fly.io | 3 small VMs free | ~$5/mo | 256MB RAM |

**Recommendation:** Railway (easiest setup) or Render (best free tier)

## Troubleshooting

### "Executable doesn't exist" Error
The Playwright browser isn't installed. Run:
```bash
npx playwright install chromium
```

### "Out of Memory" Error
Increase instance size:
- Railway: Upgrade to 1GB RAM ($10/mo)
- Render: Use Starter plan (512MB)
- Fly.io: Scale up with `fly scale memory 512`

### Slow Scraping
Normal for JavaScript-heavy sites. Expect 2-5 seconds per page.

### 401 Unauthorized
Token mismatch. Verify:
1. `WORKER_TOKEN` matches in worker and Supabase
2. Header is `x-worker-token` (lowercase)

## Security Notes

- Always use a strong random token (32+ characters)
- Don't commit tokens to Git
- Token is required for all requests
- Use HTTPS in production

## Next Steps After Deployment

1. ✅ Deploy worker service (Railway/Render/Fly.io)
2. ✅ Set environment variables in Supabase
3. ✅ Add `soukaarhus.dk` to detection list (see parent README)
4. ✅ Test with `soukaarhus.dk/da`
5. ✅ Monitor Railway/Render logs for errors
