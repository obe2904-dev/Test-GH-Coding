# Browser Extraction Feature - Deployment Notes

## 🎯 Overview

Added Playwright browser automation to handle JavaScript-rendered menu pages (e.g., React apps, Mealo platform, SPAs).

**Problem Solved**: Pages like `https://koedstaden.mealo.dk/` load menu content dynamically via JavaScript. Static HTML fetch returns empty `<div>` tags, causing extraction to fail.

**Solution**: Automatic detection of minimal HTML → Playwright fallback → Full browser rendering → Content extraction.

---

## 📦 Changes Made

### 1. **New Dependencies**
- **requirements.txt**: Added `playwright==1.41.0`
- **Dockerfile**: Added Playwright browser dependencies (Chromium) and installation step

### 2. **New Module**
- **extractors/browser_extractor.py**:
  - `extract_with_browser(url)`: Renders JavaScript pages using headless Chromium
  - `is_html_empty_or_minimal(html)`: Detects if HTML needs browser rendering
  - Timeout: 30 seconds default
  - User agent: Chrome 120 (desktop)

### 3. **Updated Files**
- **worker.py**:
  - Import browser_extractor
  - Check if HTML is minimal before processing
  - Automatic fallback to browser rendering
  - Updated extraction method tracking (`method: 'browser'`)
  - Browser-extracted content uses same LLM cleaning as static HTML

- **README.md**: Documented browser extraction feature
- **QUICK_REFERENCE.md**: Added browser testing examples
- **ARCHITECTURE.md**: Updated diagrams to include browser flow

---

## 🚀 Deployment

### Local Testing
```bash
cd cloud-run-workers/menu-ocr-worker

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium

# Test extraction
python -c "
from extractors.browser_extractor import extract_with_browser
html, text = extract_with_browser('https://koedstaden.mealo.dk/')
print(f'Extracted {len(text)} chars')
"

# Run worker
python main.py
```

### Cloud Run Deployment
```bash
# Build and deploy (Playwright browsers will be installed during build)
gcloud run deploy menu-ocr-worker-v2 \
  --source . \
  --region europe-west1 \
  --project aigetmenu \
  --memory 2Gi \                          # Increased from 1Gi for browser
  --cpu 2 \                               # Increased from 1 for browser
  --timeout 300 \                         # Increased from 180 for rendering
  --concurrency 1 \
  --min-instances 0 \
  --max-instances 5 \
  --set-env-vars="SUPABASE_URL=...,SUPABASE_SERVICE_ROLE_KEY=...,OPENAI_API_KEY=..."
```

**⚠️ Important Resource Changes**:
- **Memory**: 1Gi → **2Gi** (Chromium needs ~1.2Gi)
- **CPU**: 1 → **2** (Browser rendering is CPU-intensive)
- **Timeout**: 180s → **300s** (Allow time for JavaScript execution)
- **Max instances**: 3 → **5** (Browser instances don't scale as well)

---

## 💰 Cost Impact

**Before**:
- Memory: 1Gi @ $0.0000025/Gi-second
- CPU: 1 @ $0.00002400/vCPU-second

**After**:
- Memory: 2Gi @ $0.0000025/Gi-second
- CPU: 2 @ $0.00002400/vCPU-second

**Per extraction (30 second browser render)**:
- Before: ~$0.0007/extraction
- After (browser): ~$0.0014/extraction
- After (static HTML): ~$0.0007/extraction (no change)

**Cost only applies to JavaScript-heavy pages** - most static HTML pages skip browser rendering.

---

## 🧪 Testing

### Test URLs
```python
# JavaScript-rendered (will use browser)
extract_with_browser("https://koedstaden.mealo.dk/")
# Expected: ~50KB+ of rendered HTML with menu items

# Static HTML (will skip browser)
extract_with_browser("https://example.com/menu.html")
# Expected: Fast extraction, no browser launch
```

### Verification
1. Check logs for `"🌐 Launching browser to render JavaScript page"`
2. Verify `extraction_method: 'browser'` in `menu_results_v2` table
3. Confirm menu items extracted from previously failing URLs

---

## 🔧 Configuration

No new environment variables needed. Browser extraction triggers automatically when:
1. Content-type is `text/html`
2. HTML has fewer than 3 menu indicators
3. HTML contains 5+ empty `<div>` elements with menu class names

---

## 🐛 Troubleshooting

### Browser fails to launch
**Error**: `Browser executable not found`  
**Fix**: Run `playwright install chromium --with-deps` in container

### Out of memory errors
**Error**: `OOMKilled` in Cloud Run logs  
**Fix**: Increase memory to 2Gi or higher

### Slow extractions
**Symptom**: Timeouts after 30 seconds  
**Fix**: Increase timeout in `extract_with_browser(url, timeout_ms=60000)`

### Browser hangs
**Symptom**: Worker doesn't return  
**Fix**: Check if page has infinite loading. Add `wait_until='domcontentloaded'` instead of `'networkidle'`

---

## 📊 Monitoring

Track browser usage in logs:
```bash
# Count browser extractions
grep "Launching browser" cloud-run-logs.txt | wc -l

# Average browser time
grep "Browser extraction successful" cloud-run-logs.txt | awk '{print $8}'
```

Database query:
```sql
SELECT 
  COUNT(*) as total_extractions,
  COUNT(*) FILTER (WHERE extraction_method = 'browser') as browser_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE extraction_method = 'browser') / COUNT(*), 2) as browser_pct
FROM menu_results_v2
WHERE created_at > NOW() - INTERVAL '7 days';
```

---

## 🎓 How It Works

1. **HTML fetch**: Worker fetches static HTML
2. **Detection**: `is_html_empty_or_minimal()` checks for indicators
3. **Browser launch**: Playwright starts headless Chromium
4. **Page render**: Navigate to URL, wait for JavaScript execution
5. **Content extract**: Get rendered HTML and text
6. **Cleanup**: Close browser, continue normal flow
7. **LLM parse**: Same as static HTML (gpt-4o-mini)

**Graceful degradation**: If browser fails, falls back to static HTML extraction (may produce empty results, but won't crash).

---

## 📝 Notes

- Browser extraction adds ~5-10 seconds per page
- Only triggered for JS-heavy pages (automatic detection)
- Chromium binary is ~300MB (increases Docker image size)
- Supports all Playwright features (screenshots, PDF export, etc.) for future enhancements
- Safe for Cloud Run auto-scaling (each instance manages its own browser)

---

**Status**: ✅ Ready for deployment  
**Next Steps**: Deploy to Cloud Run, monitor browser extraction rate, adjust resources if needed
