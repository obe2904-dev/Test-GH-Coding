// Playwright-based web scraper worker service
// Handles JavaScript-heavy websites with cookie consent auto-dismissal

const express = require('express');
const { chromium } = require('playwright');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const WORKER_TOKEN = process.env.WORKER_TOKEN || 'dev-token-change-in-production';

// Security middleware
app.use((req, res, next) => {
  const token = req.headers['x-worker-token'];
  if (token !== WORKER_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Main scraping endpoint
app.post('/scrape', async (req, res) => {
  const { url, useBrowser = true, timeout = 25000 } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  console.log(`🌐 Scraping request: ${url} (browser: ${useBrowser})`);

  let browser;
  try {
    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080'
      ]
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'da-DK',
      viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    // Set timeout
    page.setDefaultTimeout(timeout);

    // Navigate to page
    console.log(`📡 Navigating to ${url}`);
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: timeout
    });

    // Wait for page to stabilize (network idle or timeout)
    try {
      await page.waitForLoadState('networkidle', { timeout: 3000 });
    } catch (e) {
      console.log('⚠️ Network not idle, continuing anyway');
    }

    // Auto-dismiss cookie consent dialogs
    await dismissCookieConsent(page);

    // Wait a bit more for any dynamic content
    await page.waitForTimeout(1000);

    // Get final HTML
    const html = await page.content();
    console.log(`✅ Scraped ${html.length} chars from ${url}`);

    await browser.close();

    res.json({
      html,
      url,
      timestamp: new Date().toISOString(),
      length: html.length
    });

  } catch (error) {
    console.error('❌ Scraping error:', error.message);
    
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore close errors
      }
    }

    res.status(500).json({
      error: 'Scraping failed',
      message: error.message,
      url
    });
  }
});

/**
 * Auto-dismiss cookie consent dialogs
 * Tries common Danish and English cookie accept buttons
 */
async function dismissCookieConsent(page) {
  const cookieSelectors = [
    // Danish
    'button:has-text("Acceptér alle")',
    'button:has-text("Accepter alle")',
    'button:has-text("Tillad alle")',
    'button:has-text("Godkend alle")',
    'a:has-text("Acceptér alle")',
    'a:has-text("Accepter alle")',
    
    // English
    'button:has-text("Accept all")',
    'button:has-text("Accept All")',
    'button:has-text("Allow all")',
    'button:has-text("Agree")',
    'button:has-text("I agree")',
    
    // Common CSS classes and IDs
    '[data-testid="cookie-accept"]',
    '[data-testid="accept-all"]',
    '.cookie-accept',
    '.accept-cookies',
    '#cookie-accept',
    '#accept-cookies',
    '[id*="cookie"][id*="accept"]',
    '[class*="cookie"][class*="accept"]',
    
    // Cookiebot (common in Denmark)
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
    '#CybotCookiebotDialogBodyButtonAccept',
    
    // Cookie Information (also common in DK)
    '#coiPage-1',
    '.coi-banner__accept',
    
    // OneTrust
    '#onetrust-accept-btn-handler',
    '.onetrust-close-btn-handler',
    
    // Generic last resort
    'button[class*="accept"]',
    'button[id*="accept"]'
  ];

  console.log('🍪 Attempting to dismiss cookie consent...');

  for (const selector of cookieSelectors) {
    try {
      const button = await page.$(selector);
      if (button) {
        console.log(`✅ Found cookie button: ${selector}`);
        await button.click();
        await page.waitForTimeout(500); // Wait for dialog to close
        console.log('✅ Cookie consent dismissed');
        return;
      }
    } catch (e) {
      // Continue to next selector
    }
  }

  console.log('⚠️ No cookie consent dialog found (or already dismissed)');
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Scraper worker listening on port ${PORT}`);
  console.log(`🔐 Auth token: ${WORKER_TOKEN.substring(0, 8)}...`);
});
