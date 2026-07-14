import express from 'express';
import puppeteer from 'puppeteer';
import { preprocessHtml } from './services/html-preprocessor.js';

// V3 imports
import {
  dismissCookieDialog,
  removeKnownNoise,
  autoScroll,
  waitForContentStability
} from './services/browser-helpers.js';
import { extractPageDocument } from './services/dom-extractor.js';
import { normalizeLinks, classifyLinks } from './services/link-classifier.js';
import { extractContact } from './services/contact-extractor.js';
import { calculateQuality, shouldContinueCrawling } from './services/quality-calculator.js';
import {
  discoverAdditionalPages,
  scrapePage,
  mergePageExtractions
} from './services/page-crawler.js';

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

// V2 scraping endpoint with preprocessing
app.post('/scrape-v2', async (req, res) => {
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

    console.log(`[${new Date().toISOString()}] [V2] Starting scrape for: ${url}`);

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

    // NEW: Preprocess HTML into structured payload
    const payload = preprocessHtml(html, url);

    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] [V2] Scrape completed in ${duration}ms`);
    console.log(`[V2] Payload size: ${JSON.stringify(payload).length} bytes (raw HTML: ${html.length} bytes)`);
    console.log(`[V2] Content quality: ${payload.content_quality}, Menu source: ${payload.menu_source}`);

    res.json({
      success: true,
      ...payload,
      scraper_metadata: {
        version: 'v2',
        scraper_type: 'cloud-run-puppeteer',
        duration_ms: duration,
        reduction_ratio: `${Math.round((1 - JSON.stringify(payload).length / html.length) * 100)}%`
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] [V2] Scrape failed:`, error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      scraper_metadata: {
        version: 'v2',
        scraper_type: 'cloud-run-puppeteer',
        duration_ms: duration
      }
    });
  }
});

// =====================================================
// V3 Scraping Endpoint with Smart Multi-Page Crawl
// =====================================================
app.post('/scrape-v3', async (req, res) => {
  const startTime = Date.now();
  let browser;

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

    console.log(`[${new Date().toISOString()}] [V3] Starting smart scrape for: ${url}`);

    // ========================================
    // Launch Browser (try/finally to ensure cleanup)
    // ========================================
    browser = await puppeteer.launch({
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

    // Listen to browser console for debugging
    page.on('console', msg => console.log(`[Browser Console] ${msg.text()}`));

    // Block unnecessary resources (but NOT scripts/XHR/fetch - needed for Umbraco Heartcore etc.)
    await page.setRequestInterception(true);
    page.on('request', request => {
      const blockedTypes = new Set(['image', 'media', 'font']);
      if (blockedTypes.has(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });

    await page.setDefaultNavigationTimeout(30000);
    await page.setDefaultTimeout(30000);
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // ========================================
    // HOMEPAGE: Navigate and Extract
    // ========================================
    console.log(`[V3] Navigating to homepage...`);
    await page.goto(url, {
      waitUntil: 'networkidle2',  // Wait for network to be mostly idle
      timeout: 30000
    });

    console.log(`[V3] Page loaded, waiting for content stability...`);

    // Wait for meaningful content
    const hasContent = await page
      .waitForFunction(
        () => document.body?.innerText?.trim().length > 300,
        { timeout: 10000 }
      )
      .then(() => true)
      .catch(() => {
        console.warn('[V3] Content wait timed out - proceeding anyway');
        return false;
      });

    console.log(`[V3] Has content: ${hasContent}`);

    // Execute Phase 5 in exact order (skip Phase 5b removeKnownNoise - too aggressive)
    console.log(`[V3] Executing Phase 5: cookie dismiss, scroll, stability, extract...`);
    await dismissCookieDialog(page);
    await autoScroll(page);
    await waitForContentStability(page);

    console.log('[V3] Extracting page document...');
    const homepageDoc = await extractPageDocument(page);
    console.log(`[V3] Extracted: title=${homepageDoc.title}, links=${homepageDoc.links?.length || 0}, blocks=${homepageDoc.blocks?.length || 0}`);

    // ========================================
    // HOMEPAGE: Process Extraction
    // ========================================
    console.log(`[V3] Processing homepage extraction...`);
    const normalizedLinks = normalizeLinks(homepageDoc.links);
    const { classified: services } = classifyLinks(normalizedLinks);
    const contact = extractContact(homepageDoc);

    // Build initial extraction
    let extraction = {
      meta: {
        title: homepageDoc.title || null,
        canonical_url: homepageDoc.canonical_url || null,
        final_url: homepageDoc.final_url || url,
        locale: homepageDoc.lang || null
      },
      business: {
        name: extractBusinessName(homepageDoc),
        description: null // TODO: Add description extraction
      },
      contact,
      opening_hours: {
        value: null, // TODO: Add opening hours extraction
        candidates: []
      },
      services,
      content_sections: extractContentSections(homepageDoc),
      scraped_at: new Date().toISOString()
    };

    // Calculate initial quality
    const homepageQuality = calculateQuality(extraction);
    extraction.quality = homepageQuality;

    console.log(`[V3] Homepage quality: ${homepageQuality.rating} (fields: ${homepageQuality.fields_found}/${homepageQuality.fields_expected}, noise: ${homepageQuality.noise_ratio})`);

    // ========================================
    // SMART CRAWL DECISION
    // ========================================
    let pagesCrawled = [{ url: homepageDoc.final_url, quality: homepageQuality.rating }];

    if (shouldContinueCrawling(homepageQuality)) {
      console.log(`[V3] Quality insufficient, discovering additional pages...`);

      const additionalUrls = discoverAdditionalPages(homepageDoc, extraction, 4);
      console.log(`[V3] Found ${additionalUrls.length} candidate pages: ${additionalUrls.map(u => new URL(u).pathname).join(', ')}`);

      const additionalExtractions = [extraction];

      for (const pageUrl of additionalUrls) {
        try {
          const pageDoc = await scrapePage(page, pageUrl);
          const pageNormalizedLinks = normalizeLinks(pageDoc.links);
          const { classified: pageServices } = classifyLinks(pageNormalizedLinks);
          const pageContact = extractContact(pageDoc);

          const pageExtraction = {
            meta: {
              final_url: pageDoc.final_url || pageUrl
            },
            contact: pageContact,
            services: pageServices,
            content_sections: extractContentSections(pageDoc),
            opening_hours: { value: null, candidates: [] },
            business: { name: null, description: null },
            quality: { rating: 'unknown', fields_found: 0, fields_expected: 8, noise_ratio: 0, warnings: [] }
          };

          const pageQuality = calculateQuality(pageExtraction);
          pagesCrawled.push({ url: pageDoc.final_url, quality: pageQuality.rating });

          additionalExtractions.push(pageExtraction);
        } catch (err) {
          console.warn(`[V3] Failed to scrape ${pageUrl}:`, err.message);
        }
      }

      // Merge all extractions
      console.log(`[V3] Merging ${additionalExtractions.length} page extractions...`);
      extraction = mergePageExtractions(additionalExtractions);

      // Recalculate quality after merge
      const finalQuality = calculateQuality(extraction);
      extraction.quality = finalQuality;

      console.log(`[V3] Final quality after merge: ${finalQuality.rating} (fields: ${finalQuality.fields_found}/${finalQuality.fields_expected})`);
    } else {
      console.log(`[V3] Homepage quality sufficient (${homepageQuality.rating}), skipping additional pages.`);
    }

    await browser.close();
    browser = null;

    // ========================================
    // Response
    // ========================================
    const duration = Date.now() - startTime;

    console.log(`[V3] Scrape completed in ${duration}ms`);
    console.log(`[V3] Final stats: quality=${extraction.quality.rating}, pages=${pagesCrawled.length}, fields=${extraction.quality.fields_found}`);

    const responsePayload = {
      success: true,
      version: 'v3',
      extraction,
      pages_crawled: pagesCrawled,
      scraper_metadata: {
        version: 'v3',
        scraper_type: 'cloud-run-puppeteer-smart',
        duration_ms: duration,
        pages_crawled: pagesCrawled.length
      }
    };

    // Call webhook if provided
    const webhookUrl = req.headers['x-webhook-url'];
    const jobId = req.headers['x-job-id'];

    if (webhookUrl && jobId) {
      console.log(`[V3] Calling webhook for job ${jobId}: ${webhookUrl}`);
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          status: 'completed',
          payload: responsePayload
        })
      })
      .then(res => {
        if (!res.ok) {
          console.error(`[V3] Webhook returned ${res.status}: ${res.statusText}`);
        } else {
          console.log(`[V3] Webhook succeeded for job ${jobId}`);
        }
        return res.text();
      })
      .then(body => console.log('[V3] Webhook response:', body))
      .catch(err => {
        console.error('[V3] Webhook network error:', err);
      });
    }

    res.json(responsePayload);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] [V3] Scrape failed:`, error);

    // Call webhook with failure if provided
    const webhookUrl = req.headers['x-webhook-url'];
    const jobId = req.headers['x-job-id'];

    if (webhookUrl && jobId) {
      console.log(`[V3] Calling failure webhook for job ${jobId}: ${webhookUrl}`);
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          status: 'failed',
          error: error.message
        })
      })
      .then(res => {
        if (!res.ok) {
          console.error(`[V3] Failure webhook returned ${res.status}: ${res.statusText}`);
        } else {
          console.log(`[V3] Failure webhook succeeded for job ${jobId}`);
        }
        return res.text();
      })
      .then(body => console.log('[V3] Failure webhook response:', body))
      .catch(err => {
        console.error('[V3] Failure webhook network error:', err);
      });
    }

    res.status(500).json({
      success: false,
      error: error.message,
      scraper_metadata: {
        version: 'v3',
        scraper_type: 'cloud-run-puppeteer-smart',
        duration_ms: duration
      }
    });
  } finally {
    if (browser) {
      await browser.close().catch(() => null);
    }
  }
});

/**
 * Extract business name from page document
 */
function extractBusinessName(pageDoc) {
  // Try h1 first
  const h1Block = pageDoc.blocks.find(b => b.tag === 'h1');
  if (h1Block && h1Block.text.length < 100) {
    return {
      value: h1Block.text,
      confidence: 0.95,
      source_type: 'h1',
      source_url: pageDoc.final_url
    };
  }

  // Fallback to title
  if (pageDoc.title && pageDoc.title.length < 100) {
    return {
      value: pageDoc.title,
      confidence: 0.85,
      source_type: 'title',
      source_url: pageDoc.final_url
    };
  }

  return null;
}

/**
 * Extract content sections from blocks
 */
function extractContentSections(pageDoc) {
  const sections = [];

  // Group blocks by section heading
  const sectionMap = new Map();

  for (const block of pageDoc.blocks) {
    const heading = block.section_heading || 'unknown';
    if (!sectionMap.has(heading)) {
      sectionMap.set(heading, []);
    }
    sectionMap.get(heading).push(block);
  }

  // Convert to sections array
  for (const [heading, blocks] of sectionMap) {
    const text = blocks.map(b => b.text).join(' ');

    if (text.length >= 50) {
      sections.push({
        type: 'unknown', // TODO: Add section type classification
        heading: heading !== 'unknown' ? heading : null,
        text,
        source_url: pageDoc.final_url,
        confidence: 0.80
      });
    }
  }

  return sections;
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found. Available endpoints: GET /health, POST /scrape, POST /scrape-v2, POST /scrape-v3'
  });
});

app.listen(PORT, () => {
  console.log(`Cloud Run Scraper listening on port ${PORT}`);
  console.log(`API Key protection: ${API_KEY ? 'ENABLED' : 'DISABLED (WARNING!)'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
