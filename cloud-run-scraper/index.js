import express from 'express';
import puppeteer from 'puppeteer';

const app = express();
const PORT = process.env.PORT || 8080;
const API_KEY = process.env.API_KEY;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Main scraping endpoint
app.post('/scrape', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // API key validation
    const providedKey = req.headers['x-api-key'];
    if (!providedKey || providedKey !== API_KEY) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid or missing API key'
      });
    }

    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: url'
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }

    console.log(`[${new Date().toISOString()}] Starting scrape for: ${url}`);

    // Launch headless browser
    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-extensions'
      ]
    });

    const page = await browser.newPage();
    
    // Set reasonable timeout
    await page.setDefaultNavigationTimeout(30000);
    await page.setDefaultTimeout(30000);
    
    // Set user agent to avoid bot detection
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate to URL
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait a bit for any dynamic content to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Extract HTML content
    const html = await page.content();

    await browser.close();

    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] Scrape completed in ${duration}ms`);

    res.json({
      success: true,
      html,
      scraperType: 'cloud-run-puppeteer',
      metadata: {
        url,
        scrapedAt: new Date().toISOString(),
        durationMs: duration,
        htmlLength: html.length
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] Scrape failed:`, error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      scraperType: 'cloud-run-puppeteer',
      metadata: {
        url: req.body.url,
        failedAt: new Date().toISOString(),
        durationMs: duration
      }
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found. Available endpoints: GET /health, POST /scrape'
  });
});

app.listen(PORT, () => {
  console.log(`Cloud Run Scraper listening on port ${PORT}`);
  console.log(`API Key protection: ${API_KEY ? 'ENABLED' : 'DISABLED (WARNING!)'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
