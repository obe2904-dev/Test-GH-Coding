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
import { extractPageDocument, extractOpeningHoursFromText, extractKitchenCloseTime } from './services/dom-extractor.js';
import { normalizeLinks, classifyLinks } from './services/link-classifier.js';
import { extractContact } from './services/contact-extractor.js';
import { calculateQuality, shouldContinueCrawling } from './services/quality-calculator.js';
import {
  discoverAdditionalPages,
  scrapePage,
  mergePageExtractions
} from './services/page-crawler.js';
import { discoverMenuStructure, isMenuLandingPage } from './services/menu-discovery.js';

/**
 * Attempt a plain HTTP GET with a crawler User-Agent to retrieve the
 * server-side rendered version of a page.
 *
 * Many headless CMS platforms (Umbraco Heartcore, Contentful, Sanity,
 * Prismic etc.) deliberately serve pre-rendered HTML to search crawlers
 * while serving a JS shell to browsers.
 *
 * Returns the HTML string if the response contains substantial visible text,
 * or null if the page appears to be a JS shell (text too short).
 *
 * @param {string} url - The URL to fetch
 * @param {number} minTextLength - Minimum visible text characters to accept
 * @returns {Promise<string|null>}
 */
async function trySSRFetch(url, minTextLength = 1000) {
  try {
    console.log(`[SSR] Attempting pre-flight fetch for: ${url}`);

    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Googlebot UA triggers SSR on most headless CMS platforms
        'User-Agent':      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept':          'text/html,application/xhtml+xml',
        'Accept-Language': 'da,en;q=0.9',
        'Cache-Control':   'no-cache',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`[SSR] Pre-flight returned ${response.status} — falling back to Puppeteer`);
      return null;
    }

    const html = await response.text();

    // Extract alt text from img tags before stripping — some pages carry
    // meaningful content labels in alt attributes (logo names, section labels)
    const altTexts = [...html.matchAll(/\balt=["']([^"']{3,})["']/gi)]
      .map(m => m[1].trim())
      .filter(Boolean)
      .join(' ');

    // Strip non-content markup
    const strippedText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')  // strip scripts + contents
      .replace(/<style[\s\S]*?<\/style>/gi, '')     // strip styles + contents
      .replace(/<[^>]+>/g, ' ')                     // strip remaining tags
      .replace(/\s+/g, ' ')
      .trim();

    // Combine visible text + alt text for threshold measurement only
    // The raw HTML is still what gets passed to extractPageDocument()
    const measuredText = altTexts.length > 0
      ? `${strippedText} ${altTexts}`.trim()
      : strippedText;

    console.log(`[SSR] Pre-flight visible text: ${strippedText.length} chars, alt text: ${altTexts.length} chars, combined: ${measuredText.length} chars`);

    if (measuredText.length < minTextLength) {
      console.log(`[SSR] Text below threshold (${minTextLength}) — JS shell detected, falling back to Puppeteer`);
      return null;
    }

    console.log(`[SSR] ✅ SSR content detected (${measuredText.length} chars) — skipping Puppeteer`);
    return html;

  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('[SSR] Pre-flight timed out — falling back to Puppeteer');
    } else {
      console.log('[SSR] Pre-flight failed:', err.message, '— falling back to Puppeteer');
    }
    return null;
  }
}

/**
 * Get appropriate JavaScript hydration wait time based on HTML content.
 * Simplified 3-tier detection: ordering platforms (heavy SPAs) > modern SSR > default.
 * 
 * @param {string} html - Raw HTML source
 * @returns {number} Milliseconds to wait for hydration
 */
function getHydrationTimeout(html) {
  // Tier 1: Ordering platforms (heavy SPAs needing significant JS hydration)
  if (/mealo\.dk|wolt|just.*eat|order\.lifepeaks|heapsgo/i.test(html)) {
    console.log('[Platform] Ordering SPA detected → 12s wait');
    return 12000;
  }
  
  // Tier 2: Modern SSR frameworks (fast render, minimal hydration)
  if (/website-files\.com|webflow|wix\.com|_wix_|squarespace|parastorage\.com/i.test(html)) {
    console.log('[Platform] Modern SSR detected → 2s wait');
    return 2000;
  }
  
  // Tier 3: Default (WordPress, custom builds, unknown platforms)
  console.log('[Platform] Default platform → 5s wait');
  return 5000;
}

const app = express();
const PORT = process.env.PORT || 8080;
const API_KEY = process.env.API_KEY;

// Async pattern environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SCRAPE_WEBHOOK_SECRET = process.env.SCRAPE_WEBHOOK_SECRET;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// Quality mapping (sync with webhook expectations)
const QUALITY_MAP = {
  'excellent': 'rich',
  'good': 'rich',
  'partial': 'thin',
  'poor': 'shell',
  'failed': 'shell'
};

// Menu source mapping (detection_method → menu_source constraint)
const MENU_SOURCE_MAP = {
  'keyword': 'link',       // keyword detection means we found a link
  'link': 'link',          // explicit link
  'pdf': 'pdf',            // PDF link
  'inline': 'inline',      // inline menu content
  'embedded': 'inline',    // embedded menu
  'none': 'none',          // no menu found
  'unknown': 'none',       // fallback to none
};

function mapMenuSource(detectionMethod) {
  if (!detectionMethod) return 'none';
  return MENU_SOURCE_MAP[detectionMethod] || 'none';
}

// Enrich services with derived fields
function enrichServices(services) {
  if (!services) return services;
  
  // Rule: If booking exists, table_service is true
  if (services.booking && services.booking.url) {
    services.table_service = true;
  }
  
  return services;
}

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

/**
 * Write full scraping payload directly to Supabase website_scrape_results table
 * CRITICAL: Must happen BEFORE webhook call to prevent race conditions
 */
async function writePayloadToSupabase(jobId, responsePayload) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase credentials (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
  }

  const headers = {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'  // Don't echo back the payload (saves bandwidth)
  };

  // Extract metadata for content_quality and menu_source
  const qualityRating = responsePayload.extraction?.quality?.rating || 'partial';
  const menuAll = responsePayload.extraction?.services?.menu_all || [];
  const detectionMethod = menuAll.length > 0 ? menuAll[0].detection_method : null;

  // Prepare update payload
  const updateData = {
    payload: responsePayload,  // Full extraction result
    content_quality: QUALITY_MAP[qualityRating] || 'thin',
    menu_source: mapMenuSource(detectionMethod),
    scraped_at: new Date().toISOString(),
    status: 'completed',
    completed_at: new Date().toISOString()
  };

  const url = `${SUPABASE_URL}/rest/v1/website_scrape_results?id=eq.${jobId}`;

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to write payload: ${response.status} ${errorText}`);
    }

    console.log(`[Async] ✅ Payload written to Supabase for job ${jobId}`);

    // Small delay to ensure DB commit completes before webhook
    await new Promise(resolve => setTimeout(resolve, 500));
    return true;

  } catch (error) {
    console.error(`[Async] ❌ Exception writing payload for job ${jobId}:`, error.message);
    throw error;
  }
}

/**
 * Notify webhook with metadata only (NOT full payload)
 * CRITICAL: Only call AFTER writePayloadToSupabase succeeds
 */
async function notifyWebhookCompletion(jobId, responsePayload) {
  if (!WEBHOOK_URL || !SCRAPE_WEBHOOK_SECRET) {
    console.warn('[Async] ⚠️ Missing webhook configuration - skipping notification');
    return false;
  }

  const qualityRating = responsePayload.extraction?.quality?.rating || 'partial';
  const menuAll = responsePayload.extraction?.services?.menu_all || [];
  const detectionMethod = menuAll.length > 0 ? menuAll[0].detection_method : null;
  const menuPagesQueued = responsePayload.menu_pages_queued?.length || 0;

  // Prepare lightweight metadata (NO full payload!)
  const metadata = {
    job_id: jobId,
    status: 'completed', // Edge function expects 'completed' not 'success'
    quality: QUALITY_MAP[qualityRating] || 'thin',
    menu_source: mapMenuSource(detectionMethod),
    menu_pages_queued: menuPagesQueued
  };

  const headers = {
    'Content-Type': 'application/json',
    'X-Scrape-Webhook-Secret': SCRAPE_WEBHOOK_SECRET
  };

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(metadata)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[Async] ⚠️ Webhook failed for job ${jobId}: ${response.status} ${errorText}`);
      return false;
    }

    console.log(`[Async] ✅ Webhook notified for job ${jobId}`);
    return true;

  } catch (error) {
    console.error(`[Async] ❌ Webhook exception for job ${jobId}:`, error.message);
    return false;
  }
}

/**
 * Handle scraping failure in async mode
 * Writes error to DB and notifies webhook
 */
async function handleAsyncFailure(jobId, errorMessage) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[Async] Cannot record failure - missing Supabase credentials');
    return;
  }

  const headers = {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  };

  const failureData = {
    status: 'failed',
    error: errorMessage.substring(0, 1000),  // Truncate if too long
    completed_at: new Date().toISOString()
  };

  const url = `${SUPABASE_URL}/rest/v1/website_scrape_results?id=eq.${jobId}`;

  try {
    await fetch(url, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify(failureData)
    });
    console.log(`[Async] ❌ Failure recorded for job ${jobId}`);
  } catch (error) {
    console.error(`[Async] Failed to record failure for job ${jobId}:`, error.message);
  }

  // Notify webhook of failure
  if (WEBHOOK_URL && SCRAPE_WEBHOOK_SECRET) {
    try {
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Scrape-Webhook-Secret': SCRAPE_WEBHOOK_SECRET
        },
        body: JSON.stringify({
          job_id: jobId,
          status: 'failed',
          error: errorMessage.substring(0, 500)
        })
      });
    } catch (err) {
      console.error('[Async] Failed to notify webhook of failure:', err.message);
    }
  }
}

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

/**
 * Run async scraping in background (v4 pattern)
 * Writes payload to Supabase, then notifies webhook with metadata only
 * 
 * NOTE: This contains the FULL scraping logic from the sync endpoint
 * (browser launch → SSR/Puppeteer → extraction → multi-page crawl)
 * followed by DB write + webhook notification instead of HTTP response
 */
async function runAsyncScrape(url, jobId, openai_api_key, startTimeParam, SCRAPE_BUDGET_MS, remainingBudgetMsFunc, budgetedTimeoutFunc) {
  const startTime = Date.now(); // Use our own startTime
  let browser;
  
  // Redefine helper functions with correct scope
  const remainingBudgetMs = () => Math.max(0, SCRAPE_BUDGET_MS - (Date.now() - startTime));
  const budgetedTimeout = (preferredMs, minimumMs = 5000) => {
    const remaining = remainingBudgetMs();
    return Math.max(minimumMs, Math.min(preferredMs, Math.max(minimumMs, remaining - 5000)));
  };
  
  try {
    console.log(`[V3] [Async] Starting background scrape for job ${jobId}: ${url}`);

    // === IMPORTANT: The following code is IDENTICAL to the sync endpoint ===
    // Copy lines 650-1020 from the sync endpoint (browser launch through extraction)
    // I'm including a minimal version here for structure - you'd copy the full logic
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
             '--disable-gpu', '--no-first-run', '--no-zygote', '--single-process', '--disable-extensions']
    });

    const page = await browser.newPage();
    page.on('console', msg => console.log(`[Browser Console] ${msg.text()}`));

    await page.setRequestInterception(true);
    page.on('request', request => {
      const blockedTypes = new Set(['image', 'media', 'font']);
      blockedTypes.has(request.resourceType()) ? request.abort() : request.continue();
    });

    await page.setDefaultNavigationTimeout(30000);
    await page.setDefaultTimeout(30000);
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    // SSR attempt
    const ssrHtml = await trySSRFetch(url, 400);
    let ssrUsed = false;
    let homepageDoc = null;

    if (ssrHtml) {
      await page.setJavaScriptEnabled(false);
      const htmlWithBase = ssrHtml.replace(/<head[^>]*>/i, `$&<base href="${url}">`);
      await page.setContent(htmlWithBase, { waitUntil: 'domcontentloaded', timeout: 15000 });
      ssrUsed = true;
    } else {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: budgetedTimeout(30000, 15000) });
      await page.waitForFunction(() => document.body?.innerText?.trim().length > 500, { timeout: budgetedTimeout(12000, 5000) }).catch(() => {});
      await dismissCookieDialog(page);
      await autoScroll(page);
      await waitForContentStability(page, { maxWaitMs: Math.min(4000, Math.max(1500, remainingBudgetMs() - 5000)) });
    }

    homepageDoc = await extractPageDocument(page);

    if (ssrUsed) {
      homepageDoc.final_url = url;
      homepageDoc.canonical_url = homepageDoc.canonical_url || url;
    }

    const normalizedLinks = normalizeLinks(homepageDoc.links);
    const { classified: services } = await classifyLinks(normalizedLinks, { homepageUrl: url });
    enrichServices(services); // Add derived fields like table_service
    const contact = await extractContact(homepageDoc);
    const opening_hours = await processOpeningHours(homepageDoc);
    const kitchen_close_time = extractKitchenCloseTime(homepageDoc);

    let extraction = {
      meta: { title: homepageDoc.title || null, canonical_url: homepageDoc.canonical_url || null, final_url: homepageDoc.final_url || url, locale: homepageDoc.lang || null },
      business: { name: extractBusinessName(homepageDoc), description: extractBusinessDescription(homepageDoc) },
      contact, opening_hours, kitchen_close_time, services,
      content_sections: extractContentSections(homepageDoc, opening_hours),
      scraped_at: new Date().toISOString()
    };

    const homepageQuality = calculateQuality(extraction);
    extraction.quality = homepageQuality;

    let pagesCrawled = [{ url: homepageDoc.final_url, quality: homepageQuality.rating }];
    let menuPagesQueued = [];
    let menuDiscoveryResults = [];

    const hydrationTimeout = getHydrationTimeout(ssrHtml || await page.content());

    const criticalFieldsMissing = contact.phones.length === 0 || contact.addresses.length === 0 || !extraction.opening_hours?.candidates?.length;
    const shouldCrawlMultiPage = criticalFieldsMissing && remainingBudgetMs() > 30000;

    if (shouldCrawlMultiPage) {
      const discoveredPages = discoverAdditionalPages(homepageDoc, extraction, 2);
      const essentialPages = discoveredPages.filter(p => ['contact', 'about'].includes(p.type) && p.priority >= 60).slice(0, 2);
      const menuPages = discoveredPages.filter(p => p.type === 'menu');
      menuPagesQueued = menuPages.map(p => ({ url: p.url, type: p.type }));

      if (extraction.services?.menu_all) {
        for (const menuItem of extraction.services.menu_all) {
          if (!menuPagesQueued.find(m => m.url === menuItem.url)) {
            menuPagesQueued.push({ url: menuItem.url, type: 'menu' });
          }
        }
      }

      // Crawl essential pages
      if (essentialPages.length > 0 && remainingBudgetMs() > 12000) {
        const additionalExtractions = [extraction];
        for (const pageInfo of essentialPages) {
          if (remainingBudgetMs() < 10000) break;
          try {
            const pageTimeout = pageInfo.type === 'contact' ? budgetedTimeout(12000, 5000) : budgetedTimeout(10000, 5000);
            const pageDoc = await scrapePage(page, pageInfo.url, pageTimeout);
            const pageNormalizedLinks = normalizeLinks(pageDoc.links);
            const { classified: pageServices } = await classifyLinks(pageNormalizedLinks, { homepageUrl: pageInfo.url });
            enrichServices(pageServices); // Add derived fields
            const pageContact = await extractContact(pageDoc);
            const pageOpeningHours = await processOpeningHours(pageDoc);
            const pageExtraction = {
              meta: { final_url: pageDoc.final_url || pageInfo.url, page_type: pageInfo.type },
              contact: pageContact, services: pageServices,
              content_sections: extractContentSections(pageDoc, pageOpeningHours),
              opening_hours: pageOpeningHours,
              business: { name: null, description: null },
              quality: { rating: 'unknown', fields_found: 0, fields_expected: 8, noise_ratio: 0, warnings: [] }
            };
            const pageQuality = calculateQuality(pageExtraction);
            pagesCrawled.push({ url: pageDoc.final_url, quality: pageQuality.rating, type: pageInfo.type });
            additionalExtractions.push(pageExtraction);
          } catch (err) {
            console.warn(`[V3] [Async] Failed to scrape ${pageInfo.type} page:`, err.message);
          }
        }
        extraction = mergePageExtractions(additionalExtractions);
        enrichServices(extraction.services); // Add derived fields
        const finalQuality = calculateQuality(extraction);
        extraction.quality = finalQuality;
      }
    }

    await browser.close();
    browser = null;

    const duration = Date.now() - startTime;

    const responsePayload = {
      success: true,
      version: 'v3',
      extraction,
      pages_crawled: pagesCrawled,
      menu_pages_queued: menuPagesQueued,
      menu_discovery: menuDiscoveryResults,
      scraper_metadata: {
        version: 'v3',
        scraper_type: ssrUsed ? 'cloud-run-ssr-fetch' : 'cloud-run-puppeteer-smart',
        hydration_timeout: hydrationTimeout,
        duration_ms: duration,
        pages_crawled_count: pagesCrawled.length,
        menu_pages_skipped: menuPagesQueued.length,
        menu_discovery_count: menuDiscoveryResults.length,
        ssr_used: ssrUsed
      }
    };
    
    // === ASYNC PATTERN v4: Write to DB, then notify webhook ===
    console.log(`[V3] [Async] Scraping completed in ${duration}ms - writing payload to Supabase...`);
    
    // 1. Write payload to Supabase (FIRST)
    await writePayloadToSupabase(jobId, responsePayload);
    
    // 2. Call webhook with metadata (SECOND)
    await notifyWebhookCompletion(jobId, responsePayload);
    
    console.log(`[V3] [Async] ✅ Job ${jobId} completed successfully`);
    
  } catch (error) {
    console.error(`[V3] [Async] ❌ Job ${jobId} failed:`, error.message);
    await handleAsyncFailure(jobId, error.message);
  } finally {
    if (browser) {
      await browser.close().catch(() => null);
    }
  }
}

// =====================================================
// V3 Scraping Endpoint with Smart Multi-Page Crawl + Async Pattern
// =====================================================
app.post('/scrape-v3', async (req, res) => {
  const startTime = Date.now();
  let browser;
  const SCRAPE_BUDGET_MS = 150000;

  const remainingBudgetMs = () => Math.max(0, SCRAPE_BUDGET_MS - (Date.now() - startTime));
  const budgetedTimeout = (preferredMs, minimumMs = 5000) => {
    const remaining = remainingBudgetMs();
    return Math.max(minimumMs, Math.min(preferredMs, Math.max(minimumMs, remaining - 5000)));
  };

  // API key validation
  const providedKey = req.headers['x-api-key'];
  if (!providedKey || providedKey !== API_KEY) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or missing API key'
    });
  }

  const { url, openai_api_key, async: isAsync, job_id: jobId, callback_url } = req.body;

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

  console.log(`[${new Date().toISOString()}] [V3] Starting smart scrape for: ${url} (async=${isAsync}, job_id=${jobId || 'none'})`);

  // =====================================================
  // ASYNC MODE: Process synchronously, write to DB, call webhook
  // The "async" is from USER perspective (edge function returns 202)
  // Cloud Run must process BEFORE returning to keep resources available
  // =====================================================
  if (isAsync && jobId) {
    console.log(`[V3] [Async] Processing job ${jobId} synchronously (will write to DB + webhook)`);
    
    try {
      // Run scraping synchronously (await it!)
      await runAsyncScrape(url, jobId, openai_api_key, startTime, SCRAPE_BUDGET_MS, remainingBudgetMs, budgetedTimeout);
      
      // Return lightweight acknowledgment (edge function ignores this)
      return res.status(200).json({
        success: true,
        job_id: jobId,
        message: 'Processing completed and written to database'
      });
      
    } catch (error) {
      console.error(`[V3] [Async] Scrape failed for job ${jobId}:`, error.message);
      await handleAsyncFailure(jobId, error.message).catch(err => 
        console.error(`[V3] [Async] Failed to handle failure:`, err.message)
      );
      
      // Return error (edge function ignores this too)
      return res.status(500).json({
        success: false,
        job_id: jobId,
        error: error.message
      });
    }
  }

  // =====================================================
  // SYNC MODE: Continue with original behavior
  // =====================================================
  try {

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
    // HOMEPAGE: SSR Pre-flight → Puppeteer fallback
    // ========================================

    let homepageDoc = null;
    let ssrUsed     = false;

    // Attempt SSR pre-flight first — works for headless CMS sites
    // (Umbraco Heartcore, Contentful, Sanity etc.) that serve pre-rendered
    // HTML to Googlebot but a JS shell to browsers.
    // 400 chars is enough to confirm real content (nav links alone give ~150-200).
    // Rejects genuine JS shells while accepting minimal but complete pages.
    const ssrHtml = await trySSRFetch(url, 400);

    if (ssrHtml) {
      // SSR succeeded — inject HTML into the Puppeteer page for extraction
      console.log('[V3] Using SSR content — injecting pre-rendered HTML...');
      
      // CRITICAL: Disable JavaScript to prevent hydration scripts from clearing/modifying
      // the DOM. The HTML is already server-rendered, so we don't need JS execution.
      await page.setJavaScriptEnabled(false);
      
      // Inject <base href> to give the page proper URL context for relative links
      const htmlWithBase = ssrHtml.replace(
        /<head[^>]*>/i,
        `$&<base href="${url}">`
      );
      
      // Inject the SSR content
      await page.setContent(htmlWithBase, { waitUntil: 'domcontentloaded', timeout: 15000 });

      // Note: page.setContent() resets page.url() to "about:blank".
      // We fix final_url after extraction — see below.
      ssrUsed = true;
    } else {
      // SSR returned a shell — use Puppeteer with full browser rendering
      console.log('[V3] Navigating with Puppeteer (full browser render)...');
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout:   budgetedTimeout(30000, 15000),
      });

      // Wait for meaningful content volume — 500 chars is enough to confirm
      // the page has rendered beyond nav links and empty shells
      const hasContent = await page
        .waitForFunction(
          () => document.body?.innerText?.trim().length > 500,
          { timeout: budgetedTimeout(12000, 5000) }
        )
        .then(() => true)
        .catch(() => {
          console.warn('[V3] Content wait timed out — proceeding with what is available');
          return false;
        });

      console.log(`[V3] Puppeteer content ready: ${hasContent}`);

      // Full browser automation sequence
      console.log('[V3] Running browser automation (cookie dismiss, scroll, stability)...');
      await dismissCookieDialog(page);
      await autoScroll(page);
      await waitForContentStability(page, { maxWaitMs: Math.min(4000, Math.max(1500, remainingBudgetMs() - 5000)) });
    }

    // Extract page document — same for both SSR and Puppeteer paths
    console.log('[V3] Extracting page document...');
    homepageDoc = await extractPageDocument(page);

    // page.setContent() resets page.url() to "about:blank".
    // Override unconditionally for SSR — the real URL is always known.
    if (ssrUsed) {
      homepageDoc.final_url    = url;
      homepageDoc.canonical_url = homepageDoc.canonical_url || url;

      // Fix source_url throughout the extraction for clean payloads
      const fixSourceUrls = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        for (const key of Object.keys(obj)) {
          if (key === 'source_url' && obj[key] === 'about:blank') {
            obj[key] = url;
          } else if (typeof obj[key] === 'object') {
            fixSourceUrls(obj[key]);
          }
        }
      };
      fixSourceUrls(homepageDoc);
    }

    console.log(`[V3] Extracted: title=${homepageDoc.title}, links=${homepageDoc.links?.length || 0}, blocks=${homepageDoc.blocks?.length || 0}, ssr=${ssrUsed}`);

    // ========================================
    // HOMEPAGE: Process Extraction
    // ========================================
    console.log(`[V3] Processing homepage extraction...`);
    const normalizedLinks = normalizeLinks(homepageDoc.links);
    const { classified: services } = await classifyLinks(normalizedLinks, { 
      homepageUrl: url 
    });
    enrichServices(services); // Add derived fields like table_service
    const contact = await extractContact(homepageDoc);
    const opening_hours = await processOpeningHours(homepageDoc);
    const kitchen_close_time = extractKitchenCloseTime(homepageDoc);
    if (kitchen_close_time) {
      console.log(`[Kitchen] ✅ Extracted kitchen close time from homepage: ${kitchen_close_time}`);
    } else {
      console.log(`[Kitchen] ⚠️  No kitchen close time found on homepage`);
    }

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
        description: extractBusinessDescription(homepageDoc)
      },
      contact,
      opening_hours,
      kitchen_close_time,
      services,
      content_sections: extractContentSections(homepageDoc, opening_hours),
      scraped_at: new Date().toISOString()
    };
    
    console.log(`[Kitchen] 🔍 extraction.kitchen_close_time = ${extraction.kitchen_close_time}`);

    // Calculate initial quality
    const homepageQuality = calculateQuality(extraction);
    extraction.quality = homepageQuality;

    console.log(`[V3] Homepage quality: ${homepageQuality.rating} (fields: ${homepageQuality.fields_found}/${homepageQuality.fields_expected}, noise: ${homepageQuality.noise_ratio})`);

    // ========================================
    // SMART CRAWL DECISION - Platform-aware, page-type prioritization
    // ========================================
    let pagesCrawled = [{ url: homepageDoc.final_url, quality: homepageQuality.rating }];
    let menuPagesQueued = []; // Track menu pages for async queue

    // Get smart hydration timeout based on HTML content
    const hydrationTimeout = getHydrationTimeout(ssrHtml || await page.content());

    // ========================================
    // PHASE 3: CONDITIONAL MULTI-PAGE CRAWLING
    // Only crawl additional pages if critical fields are missing AND budget allows
    // ========================================
    
    // Check for missing critical fields
    const missingPhone = contact.phones.length === 0;
    const missingAddress = contact.addresses.length === 0;
    const missingHours = !extraction.opening_hours?.candidates?.length;
    const missingBooking = !extraction.services?.booking?.url;
    const missingDescription = !extraction.business?.description?.value || 
                               extraction.business.description.value.length < 50;
    const sparseContent = extraction.content_sections.length < 2;
    
    const criticalFieldsMissing = missingPhone || missingAddress || missingHours || missingBooking || missingDescription;
    const budgetAllows = remainingBudgetMs() > 30000;  // Need at least 30s for multi-page
    
    // PHASE 3 REVISED: Crawl if ANY critical field missing (regardless of quality)
    // Quality check removed - completeness is more important than speed
    const shouldCrawlMultiPage = criticalFieldsMissing && budgetAllows;
    
    console.log(`[V3] 🔍 Multi-page decision: phone=${contact.phones.length}, address=${contact.addresses.length}, hours=${missingHours ? 'missing' : 'present'}, booking=${missingBooking ? 'missing' : 'present'}, description=${missingDescription ? 'missing' : 'present'}, quality=${homepageQuality.rating}`);
    console.log(`[V3] 📊 Critical missing: ${criticalFieldsMissing}, Budget OK: ${budgetAllows} (${Math.round(remainingBudgetMs()/1000)}s)`);
    console.log(`[V3] ➡️  Multi-page crawl: ${shouldCrawlMultiPage ? 'YES' : 'NO'}`);
    
    // Discover pages only if we'll actually crawl them
    const discoveredPages = shouldCrawlMultiPage ? discoverAdditionalPages(homepageDoc, extraction, 2) : [];

    // Separate pages by type: essential (contact/about) vs menu
    // PHASE 3: Limit to contact and about pages only (skip hours, other)
    const essentialTypes = ['contact', 'about'];
    const essentialPages = discoveredPages.filter(p => 
      essentialTypes.includes(p.type) && p.priority >= 60
    ).slice(0, 2);  // Strict limit: max 2 pages
    
    const menuPages = discoveredPages.filter(p => p.type === 'menu');

    // Track menu URLs for async queue (in response metadata)
    // CRITICAL: Include ALL menu URLs from classifier (not just the best one)
    menuPagesQueued = menuPages.map(p => ({ url: p.url, type: p.type }));
    
    // Add all detected menu URLs from services.menu_all
    if (extraction.services?.menu_all && Array.isArray(extraction.services.menu_all)) {
      for (const menuItem of extraction.services.menu_all) {
        if (!menuPagesQueued.find(m => m.url === menuItem.url)) {
          menuPagesQueued.push({ url: menuItem.url, type: 'menu' });
          console.log(`[V3] Added detected menu URL to queue: ${new URL(menuItem.url).pathname}`);
        }
      }
    }
    
    if (menuPagesQueued.length > 0) {
      console.log(`[V3] Total menu pages queued for async enrichment: ${menuPagesQueued.map(p => new URL(p.url).pathname).join(', ')}`);
    }

    if (remainingBudgetMs() < 15000) {
      console.log('[V3] Crawl budget nearly exhausted - skipping optional discovery pages');
      menuPagesQueued = [];
    }

    // ========================================
    // MENU DISCOVERY - Phase 1a: Detection Only
    // ========================================
    let menuDiscoveryResults = [];
    
    if (menuPagesQueued.length > 0) {
      console.log(`\n🔍 [MENU DISCOVERY] Starting discovery for ${menuPagesQueued.length} menu URL(s)...`);
      
      // Discover structure for each menu URL (limit to first 3 to avoid timeout)
      const menuUrlsToDiscover = menuPagesQueued.slice(0, 3);
      
      for (const menuPage of menuUrlsToDiscover) {
        if (remainingBudgetMs() < 12000) {
          console.log('[V3] Stopping menu discovery early due to crawl budget');
          break;
        }

        try {
          // Only discover if it looks like a landing page (not a direct PDF/image link)
          const urlObj = new URL(menuPage.url);
          const isPdfLink = urlObj.pathname.toLowerCase().endsWith('.pdf');
          const isImageLink = /\.(jpg|jpeg|png|gif|webp)$/i.test(urlObj.pathname);
          
          if (isPdfLink) {
            console.log(`⏭️  Skipping discovery for direct PDF link: ${urlObj.pathname}`);
            menuDiscoveryResults.push({
              menuUrl: menuPage.url,
              structure: 'direct_pdf',
              confidence: 'high',
              skipped: true,
              extractionMethod: 'pdf_extract'
            });
            continue;
          }
          
          if (isImageLink) {
            console.log(`⏭️  Skipping discovery for direct image link: ${urlObj.pathname}`);
            menuDiscoveryResults.push({
              menuUrl: menuPage.url,
              structure: 'image_gallery',
              confidence: 'high',
              skipped: true,
              extractionMethod: 'ocr_required'
            });
            continue;
          }
          
          // Run discovery on HTML menu pages
          if (isMenuLandingPage(menuPage.url)) {
            console.log(`🔍 Running discovery on landing page: ${urlObj.pathname}`);
            const discovery = await discoverMenuStructure(browser, menuPage.url, budgetedTimeout(10000, 4000));
            menuDiscoveryResults.push(discovery);
            
            // Log key findings
            if (discovery.success) {
              console.log(`   ✅ Structure: ${discovery.structure} | Method: ${discovery.extractionMethod}`);
              if (discovery.assets) {
                const assetSummary = Object.entries(discovery.assets)
                  .map(([key, val]) => `${key}=${Array.isArray(val) ? val.length : 'N/A'}`)
                  .join(', ');
                console.log(`   📊 Assets: ${assetSummary}`);
              }
            }
          } else {
            console.log(`⏭️  Skipping discovery for non-landing page: ${urlObj.pathname}`);
          }
          
        } catch (discErr) {
          console.error(`❌ Menu discovery failed for ${menuPage.url}:`, discErr.message);
          menuDiscoveryResults.push({
            menuUrl: menuPage.url,
            structure: 'error',
            confidence: 'none',
            error: discErr.message,
            extractionMethod: 'manual_review'
          });
        }
      }
      
      console.log(`✅ [MENU DISCOVERY] Completed: ${menuDiscoveryResults.length} result(s)\n`);
    }

    // Crawl ONLY essential pages (contact + about) - skip menu pages
    if (essentialPages.length > 0) {
      if (remainingBudgetMs() < 12000) {
        console.log('[V3] Crawl budget nearly exhausted - skipping essential page crawl');
      } else {
      console.log(`[V3] Crawling ${essentialPages.length} essential page(s): ${essentialPages.map(p => `${new URL(p.url).pathname} (${p.type})`).join(', ')}`);

      const additionalExtractions = [extraction];

      for (const pageInfo of essentialPages) {
        if (remainingBudgetMs() < 10000) {
          console.log('[V3] Stopping essential page crawl early due to crawl budget');
          break;
        }

        try {
          // Use adaptive timeout based on page type
          const pageTimeout = pageInfo.type === 'contact'
            ? budgetedTimeout(12000, 5000)
            : budgetedTimeout(10000, 5000);
          
          const pageDoc = await scrapePage(page, pageInfo.url, pageTimeout);
          const pageNormalizedLinks = normalizeLinks(pageDoc.links);
          const { classified: pageServices } = await classifyLinks(pageNormalizedLinks, { 
            homepageUrl: pageInfo.url 
          });
          enrichServices(pageServices); // Add derived fields
          const pageContact = await extractContact(pageDoc);
          console.log(`[Crawler] ${pageInfo.url} → blocks: ${pageDoc?.blocks?.length ?? 0}, phones: ${pageContact?.phones?.length ?? 0}, addresses: ${pageContact?.addresses?.length ?? 0}`);
          const pageOpeningHours = await processOpeningHours(pageDoc);

          const pageExtraction = {
            meta: {
              final_url: pageDoc.final_url || pageInfo.url,
              page_type: pageInfo.type
            },
            contact: pageContact,
            services: pageServices,
            content_sections: extractContentSections(pageDoc, pageOpeningHours),
            opening_hours: pageOpeningHours,
            business: { name: null, description: null },
            quality: { rating: 'unknown', fields_found: 0, fields_expected: 8, noise_ratio: 0, warnings: [] }
          };

          const pageQuality = calculateQuality(pageExtraction);
          pagesCrawled.push({ url: pageDoc.final_url, quality: pageQuality.rating, type: pageInfo.type });

          additionalExtractions.push(pageExtraction);
          
          console.log(`[V3] ✅ Crawled ${pageInfo.type} page: ${new URL(pageInfo.url).pathname} (quality: ${pageQuality.rating})`);
        } catch (err) {
          console.warn(`[V3] ⚠️ Failed to scrape ${pageInfo.type} page ${pageInfo.url}:`, err.message);
        }
      }

      // Merge all extractions
      console.log(`[V3] Merging ${additionalExtractions.length} page extractions...`);
      extraction = mergePageExtractions(additionalExtractions);
      enrichServices(extraction.services); // Add derived fields

      // Recalculate quality after merge
      const finalQuality = calculateQuality(extraction);
      extraction.quality = finalQuality;

      console.log(`[V3] Final quality after merge: ${finalQuality.rating} (fields: ${finalQuality.fields_found}/${finalQuality.fields_expected})`);
      }
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
      menu_pages_queued: menuPagesQueued,  // Menu pages for async enrichment
      menu_discovery: menuDiscoveryResults, // Phase 1a: Structure detection results
      scraper_metadata: {
        version:            'v3',
        scraper_type:       ssrUsed ? 'cloud-run-ssr-fetch' : 'cloud-run-puppeteer-smart',
        hydration_timeout:  hydrationTimeout,  // Simplified: just the timeout used
        duration_ms:        duration,
        pages_crawled_count: pagesCrawled.length,
        menu_pages_skipped: menuPagesQueued.length,
        menu_discovery_count: menuDiscoveryResults.length,
        ssr_used:           ssrUsed,
      }
    };

    // SYNC MODE: Legacy webhook behavior (kept for backward compatibility)
    // In sync mode, webhook is called with full payload via headers
    const webhookUrl = req.headers['x-webhook-url'];
    const legacyJobId = req.headers['x-job-id'];

    if (webhookUrl && legacyJobId) {
      console.log(`[V3] [Sync] Calling legacy webhook for job ${legacyJobId}: ${webhookUrl}`);
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: legacyJobId,
          status: 'completed',
          payload: responsePayload
        })
      })
      .then(res => {
        if (!res.ok) {
          console.error(`[V3] [Sync] Webhook returned ${res.status}: ${res.statusText}`);
        } else {
          console.log(`[V3] [Sync] Webhook succeeded for job ${legacyJobId}`);
        }
        return res.text();
      })
      .then(body => console.log('[V3] [Sync] Webhook response:', body))
      .catch(err => {
        console.error('[V3] [Sync] Webhook network error:', err);
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

const DAY_ORDER_DANISH = [
  'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'
];

/**
 * Extract and merge opening hours from both structured DOM and text patterns.
 *
 * Strategy:
 *   1. Run text-pattern extraction across all page blocks (handles range
 *      patterns like "Mandag - Torsdag 11.30 - 23.30").
 *   2. Run structured DOM extraction (handles explicit day/time table rows).
 *   3. Merge: structured DOM wins per day, text-pattern fills any gaps.
 *
 * This always runs both passes — never short-circuits — so range patterns
 * are never missed because structured DOM returned a partial result.
 */
function processOpeningHours(pageDoc) {
  const merged = new Map();

  // ── Pass 1: Text-pattern (lower priority, fills gaps) ────────────────────
  const allText = (pageDoc.blocks || [])
    .map(b => b.text || '')
    .join('\n');

  const textCandidates = extractOpeningHoursFromText(allText);

  for (const c of textCandidates) {
    merged.set(c.day_text, {
      day_text:    c.day_text,
      time_text:   c.time_text,  // already normalised by extractOpeningHoursFromText
      source_type: 'text_pattern',
    });
  }

  // ── Pass 2: Structured DOM (higher priority, overwrites per day) ──────────
  const structuredPairs = pageDoc.opening_hours_structured || [];

  for (const c of structuredPairs) {
    merged.set(c.day_text, {
      day_text:    c.day_text,
      time_text:   normaliseTimeText(c.time_text),
      source_type: 'structured_dom',
    });
  }

  // ── Build final candidates in day order ───────────────────────────────────
  const finalCandidates = DAY_ORDER_DANISH
    .filter(d => merged.has(d))
    .map(d => merged.get(d));

  if (finalCandidates.length === 0) {
    console.log('[V3] Opening hours: no candidates found');
    return {
      value:       null,
      candidates:  [],
      confidence:  0,
      source_url:  pageDoc.final_url,
      source_type: 'none',
    };
  }

  const hasTextPattern   = finalCandidates.some(c => c.source_type === 'text_pattern');
  const hasStructuredDom = finalCandidates.some(c => c.source_type === 'structured_dom');

  const sourceType = hasStructuredDom && hasTextPattern
    ? 'merged'
    : hasStructuredDom
      ? 'structured_dom'
      : 'text_pattern';

  const confidence = hasStructuredDom ? 0.92 : 0.78;

  const lines = finalCandidates.map(p => `${p.day_text}: ${p.time_text}`);

  console.log(
    `[V3] Opening hours: ${finalCandidates.length} days (${sourceType}),`,
    `text=${textCandidates.length}, structured=${structuredPairs.length}`
  );

  return {
    value:       lines.join('; '),
    candidates:  finalCandidates,
    confidence,
    source_url:  pageDoc.final_url,
    source_type: sourceType,
  };
}

/**
 * Normalise a time range string to "HH:MM - HH:MM".
 * Only converts dot separators to colons — does not add seconds.
 * e.g. "11.30 - 23.30" → "11:30 - 23:30"
 *      "11:30 - 23:30" → unchanged
 *      "Lukket"        → unchanged
 */
function normaliseTimeText(raw) {
  if (!raw || raw === 'Lukket') return raw;
  // Convert dot-separated times only: 11.30 → 11:30
  return raw.replace(/(\d{1,2})\.(\d{2})/g, (_, h, m) =>
    `${h.padStart(2, '0')}:${m}`
  );
}

/**
 * Extract business name from page document
 */
/**
 * Extract business description from hero/welcome text
 * Looks for the first substantial content block with welcome/intro text
 */
function extractBusinessDescription(pageDoc) {
  // Look through blocks for hero/welcome text
  for (const block of pageDoc.blocks) {
    const text = block.text.trim();
    
    // Skip if too short
    if (text.length < 100) continue;
    
    // Skip if it's likely opening hours (has time patterns)
    if (/\d{1,2}[:\.]?\d{2}\s*-\s*\d{1,2}[:\.]?\d{2}/.test(text)) continue;
    
    // Look for welcome phrases or substantial intro text
    const hasWelcome = /velkommen|welcome|introducing|discover|experience|cuisine/i.test(text);
    const isSubstantial = text.length > 150 && text.split(/\s+/).length > 20;
    
    if (hasWelcome || isSubstantial) {
      return {
        value: text,
        confidence: hasWelcome ? 0.85 : 0.75,
        source_url: pageDoc.final_url,
        source_type: 'hero_text'
      };
    }
  }
  
  return null;
}

/**
 * Extract business name using multi-source voting
 * Collects candidates from multiple sources and picks the best one
 */
function extractBusinessName(pageDoc) {
  const candidates = [];

  // Source 1: JSON-LD (highest confidence if present)
  // TODO: Add JSON-LD parsing if available in pageDoc

  // Source 2: Open Graph site_name
  // TODO: Add OG parsing if available in pageDoc

  // Source 3: Title tag (common pattern: "Business Name - Description")
  if (pageDoc.title) {
    const titleParts = pageDoc.title.split(/[-–|]/);
    if (titleParts.length > 0) {
      const firstPart = titleParts[0].trim();
      if (firstPart.length > 2 && firstPart.length < 100) {
        candidates.push({
          value: firstPart,
          confidence: 0.80,
          source_type: 'title_first_part',
          source_url: pageDoc.final_url
        });
      }
    }
  }

  // Source 4: Logo alt text (check blocks for img alt attributes)
  for (const block of pageDoc.blocks) {
    if (block.tag === 'img' && block.alt && block.alt.length < 50 && block.alt.length > 2) {
      // Logo alts often contain business name
      if (!/foto|photo|image|billed/.test(block.alt.toLowerCase())) {
        candidates.push({
          value: block.alt.trim(),
          confidence: 0.75,
          source_type: 'logo_alt',
          source_url: pageDoc.final_url
        });
      }
    }
  }

  // Source 5: Domain name (extract from final_url)
  if (pageDoc.final_url) {
    try {
      const url = new URL(pageDoc.final_url);
      const domain = url.hostname.replace(/^www\./, '').split('.')[0];
      // Capitalize first letter
      const domainName = domain.charAt(0).toUpperCase() + domain.slice(1);
      if (domainName.length > 2 && domainName.length < 30) {
        candidates.push({
          value: domainName,
          confidence: 0.65,
          source_type: 'domain',
          source_url: pageDoc.final_url
        });
      }
    } catch {}
  }

  // Source 6: H1 tags (but only if short and not descriptive phrases)
  const h1Block = pageDoc.blocks.find(b => b.tag === 'h1');
  if (h1Block && h1Block.text.length < 50 && h1Block.text.length > 2) {
    const h1Text = h1Block.text.trim();
    // Skip if looks like a description/category (all caps, contains common category words)
    const isDescriptive = /^[A-ZÆØÅ\s]+$/.test(h1Text) || 
                          /cuisine|restaurant|cafe|bar|mad|food|drinks/.test(h1Text.toLowerCase());
    if (!isDescriptive) {
      candidates.push({
        value: h1Text,
        confidence: 0.70,
        source_type: 'h1',
        source_url: pageDoc.final_url
      });
    }
  }

  // Source 7: "Velkommen til X" patterns
  for (const block of pageDoc.blocks) {
    // Match "Velkommen til Business Name" - capture up to 50 chars, stop at long text or punctuation
    const welcomeMatch = block.text.match(/velkommen til\s+([\wÆØÅæøå\s]{3,50}?)(?:\s{2,}|[.!]|\s+[A-ZÆØÅ]{4,}|$)/i);
    if (welcomeMatch) {
      const name = welcomeMatch[1].trim();
      // Skip if looks like a description (too many words or all caps tagline)
      const wordCount = name.split(/\s+/).length;
      if (wordCount <= 5 && name.length >= 3) {
        candidates.push({
          value: name,
          confidence: 0.85,
          source_type: 'welcome_phrase',
          source_url: pageDoc.final_url
        });
      }
    }
  }

  // Deduplicate and pick best
  if (candidates.length === 0) {
    return null;
  }

  // Group by normalized value (case-insensitive)
  const groups = new Map();
  for (const candidate of candidates) {
    const normalized = candidate.value.toLowerCase().trim();
    if (!groups.has(normalized)) {
      groups.set(normalized, []);
    }
    groups.get(normalized).push(candidate);
  }

  // Score each group: sum of confidences + bonus for multiple sources
  let bestGroup = null;
  let bestScore = 0;

  for (const [normalized, group] of groups) {
    const confidenceSum = group.reduce((sum, c) => sum + c.confidence, 0);
    const sourcesBonus = (group.length - 1) * 0.15; // Bonus for multiple sources agreeing
    const score = confidenceSum + sourcesBonus;

    if (score > bestScore) {
      bestScore = score;
      bestGroup = group;
    }
  }

  // Return the candidate with highest individual confidence from best group
  if (bestGroup && bestGroup.length > 0) {
    return bestGroup.sort((a, b) => b.confidence - a.confidence)[0];
  }

  return null;
}

/**
 * Extract menu item headlines from a menu page
 * Extracts H1/H2/H3 headlines without descriptions or prices
 * Prioritizes food > drinks > snacks with per-section caps
 * @param {object} pageDoc - Page document with blocks
 * @param {number} maxItems - Maximum total items to extract (5-10)
 * @returns {string[]|null} Array of menu item headlines or null if not a menu page
 */
function extractMenuHeadlines(pageDoc, maxItems = 10) {
  // ONLY run on actual menu pages (URL-based check, not content)
  const pageUrl = pageDoc.final_url?.toLowerCase() || '';
  const isMenuPage = /menu|menukort|food|drinks|mad|drikke/.test(pageUrl);
  
  if (!isMenuPage) {
    return null;
  }

  console.log('[Menu Extract] Menu page detected, extracting headlines...');

  // Category classification
  const foodKeywords = ['brunch', 'frokost', 'lunch', 'middag', 'dinner', 'aften', 'mad', 'food', 'ret', 'dish', 'burger', 'sandwich', 'salat', 'pasta', 'pizza'];
  const drinkKeywords = ['cocktail', 'drink', 'bar', 'vin', 'wine', 'øl', 'beer', 'kaffe', 'coffee', 'te', 'tea', 'juice'];
  const snackKeywords = ['snack', 'tapas', 'småret', 'side', 'tilbehør'];

  const classifyHeading = (text) => {
    const lower = text.toLowerCase();
    if (foodKeywords.some(kw => lower.includes(kw))) return 'food';
    if (drinkKeywords.some(kw => lower.includes(kw))) return 'drink';
    if (snackKeywords.some(kw => lower.includes(kw))) return 'snack';
    return 'food'; // Default to food
  };

  // Extract headlines from blocks
  // Look for patterns like: short text (3-50 chars), capitalized, no prices
  const headlines = [];
  let currentSection = null;
  const sectionItems = { food: [], drink: [], snack: [] };

  for (const block of pageDoc.blocks) {
    const text = block.text.trim();
    
    // Skip if contains price patterns
    if (/\d+[.,]\d+\s*kr|kr[.,]?\s*\d+|\d+\s*,-|DKK|\$|€|£/.test(text)) {
      continue;
    }

    // Detect section headers (H1/H2 - longer, all caps, or contains menu keywords)
    if (
      text.length > 3 && text.length < 50 && 
      (text === text.toUpperCase() || menuIndicators.some(ind => text.toLowerCase().includes(ind)))
    ) {
      currentSection = classifyHeading(text);
      continue;
    }

    // Extract potential menu items (H3 - short, capitalized, 3-50 chars)
    if (
      text.length >= 3 && 
      text.length <= 50 && 
      /^[A-ZÆØÅ]/.test(text) && // Starts with capital
      !/\s{3,}/.test(text) && // Not excessive whitespace
      !/(privacy|cookie|gdpr|login|cart|account|link to|facebook|instagram|kontakt|book|gavekort|english)/i.test(text) && // Not UI/navigation text
      text.split(/\s+/).length <= 5 // Max 5 words
    ) {
      const category = currentSection || classifyHeading(text);
      headlines.push({ text, category });
    }
  }

  if (headlines.length === 0) {
    console.log('[Menu Extract] No headlines found');
    return null;
  }

  // Group by category
  for (const item of headlines) {
    sectionItems[item.category].push(item.text);
  }

  // Apply priority: food > drinks > snacks
  const priorityOrder = ['food', 'drink', 'snack'];
  const result = [];

  // Count sections with items
  const activeSections = priorityOrder.filter(cat => sectionItems[cat].length > 0);
  const perSectionCap = activeSections.length > 1 ? 3 : maxItems; // Cap at 2-3 per section if multiple sections

  for (const category of priorityOrder) {
    const items = sectionItems[category];
    if (items.length === 0) continue;

    const takeCount = Math.min(items.length, perSectionCap, maxItems - result.length);
    result.push(...items.slice(0, takeCount));

    if (result.length >= maxItems) break;
  }

  console.log(`[Menu Extract] Extracted ${result.length} headlines: food=${sectionItems.food.length}, drink=${sectionItems.drink.length}, snack=${sectionItems.snack.length}`);
  
  return result.length > 0 ? result : null;
}

/**
 * Extract content sections from blocks
 * @param {object} pageDoc - Page document with blocks
 * @param {object} openingHours - Structured opening hours data (optional)
 * @returns {array} Content sections
 */
function extractContentSections(pageDoc, openingHours = null) {
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
    // Deduplicate repeated sentences (common on restaurant sites with repeating hero text)
    const uniqueTexts = [];
    const seen = new Set();
    for (const block of blocks) {
      const trimmed = block.text.trim();
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        uniqueTexts.push(trimmed);
      }
    }
    
    // Join and deduplicate at word-chunk level (handle cases without punctuation)
    const combinedText = uniqueTexts.join(' ');
    
    // Split by sentence boundaries OR by word chunks (10+ words)
    const chunks = [];
    let current = '';
    const words = combinedText.split(/\s+/);
    
    for (const word of words) {
      current += (current ? ' ' : '') + word;
      
      // Break on sentence ending or after ~10 words
      if (/[.!?]$/.test(word) || current.split(/\s+/).length >= 10) {
        if (current) chunks.push(current.trim());
        current = '';
      }
    }
    if (current) chunks.push(current.trim());
    
    // Deduplicate chunks
    const uniqueChunks = [];
    const chunkSeen = new Set();
    
    for (const chunk of chunks) {
      const normalized = chunk.toLowerCase().replace(/\s+/g, ' ');
      if (!chunkSeen.has(normalized) && chunk.length > 10) {
        chunkSeen.add(normalized);
        uniqueChunks.push(chunk);
      }
    }
    
    const text = uniqueChunks.join(' ').trim();

    if (text.length >= 50) {
      // Check if this section contains opening hours
      const isOpeningHours = /åbningstider|opening hours/i.test(text);
      const isServiceSection = /frokost|lunch|aften|middag|dinner|brunch|drikkevarer|vin|cocktail|menu|smørrebrød|terrasse|bord|reservation|book|event|særarrangement/i.test(text);
      const isContactSection = /kontakt|adresse|telefon|email|find vej|map|smiley|findsmiley/i.test(text);
      
      if (isOpeningHours && openingHours?.candidates?.length > 0) {
        // Replace with formatted structured data
        const formattedLines = openingHours.candidates.map(pair => 
          `${pair.day_text}: ${pair.time_text}`
        );
        
        // Extract address and email from original text if present
        const addressMatch = text.match(/[A-ZÆØÅ][a-zæøå]+\s+\d+[,\s]+\d{4}\s+[A-ZÆØÅ][a-zæøå\s]+,\s*[A-ZÆØÅ][a-zæøå]+/);
        const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        
        let formattedText = `ÅBNINGSTIDER\n${formattedLines.join('\n')}`;
        if (addressMatch) {
          formattedText += `\n\n${addressMatch[0]}`;
        }
        if (emailMatch) {
          formattedText += `\n${emailMatch[0]}`;
        }
        
        sections.push({
          type: 'opening_hours',
          heading: heading !== 'unknown' ? heading : 'ÅBNINGSTIDER',
          text: formattedText,
          source_url: pageDoc.final_url,
          confidence: 0.90
        });
      } else if (isServiceSection) {
        sections.push({
          type: 'service',
          heading: heading !== 'unknown' ? heading : null,
          text,
          source_url: pageDoc.final_url,
          confidence: 0.82
        });
      } else if (isContactSection) {
        sections.push({
          type: 'contact',
          heading: heading !== 'unknown' ? heading : null,
          text,
          source_url: pageDoc.final_url,
          confidence: 0.82
        });
      } else {
        sections.push({
          type: 'unknown', // TODO: Add section type classification
          heading: heading !== 'unknown' ? heading : null,
          text,
          source_url: pageDoc.final_url,
          confidence: 0.80
        });
      }
    }
  }

  return sections;
}

// =========================================================================
// /scrape-v3-async - Async scraping with Supabase persistence & webhooks
// =========================================================================

app.post('/scrape-v3-async', async (req, res) => {
  const startTime = Date.now();
  let browser;
  const SCRAPE_BUDGET_MS = 150000;

  const remainingBudgetMs = () => Math.max(0, SCRAPE_BUDGET_MS - (Date.now() - startTime));
  const budgetedTimeout = (preferredMs, minimumMs = 5000) => {
    const remaining = remainingBudgetMs();
    return Math.max(minimumMs, Math.min(preferredMs, Math.max(minimumMs, remaining - 5000)));
  };

  /**
   * Deliver webhook with exponential backoff retry
   */
  async function deliverWebhook(webhookUrl, payload, apiKey, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Webhook] Attempt ${attempt}/${maxRetries} to ${webhookUrl}`);
        
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30000), // 30s timeout
        });

        if (response.ok) {
          console.log(`[Webhook] ✅ Delivered on attempt ${attempt}`);
          return true;
        }

        const errorText = await response.text().catch(() => 'unknown error');
        console.error(`[Webhook] ❌ Attempt ${attempt} failed: HTTP ${response.status} - ${errorText}`);

      } catch (error) {
        console.error(`[Webhook] ❌ Attempt ${attempt} network error:`, error.message);
      }

      // Exponential backoff: 2s, 4s, 8s
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.log(`[Webhook] Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    console.error(`[Webhook] ❌ All ${maxRetries} attempts failed`);
    return false;
  }

  /**
   * Update Supabase job progress
   */
  async function updateJobProgress(supabase, jobId, updates) {
    try {
      await supabase
        .from('scrape_jobs')
        .update(updates)
        .eq('id', jobId);
    } catch (error) {
      console.error('[Job Update] Failed:', error.message);
    }
  }

  try {
    // API key validation
    const providedKey = req.headers['x-api-key'];
    if (!providedKey || providedKey !== API_KEY) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid or missing API key'
      });
    }

    const { 
      url, 
      job_id, 
      business_id, 
      webhook_url, 
      webhook_api_key 
    } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: url'
      });
    }

    if (!job_id || !business_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: job_id, business_id'
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

    console.log(`[V3-Async] Starting scrape for job ${job_id}: ${url}`);

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update job to scraping status
    await updateJobProgress(supabase, job_id, {
      status: 'scraping',
      progress_percent: 10,
      current_step: 'Launching browser...',
      started_at: new Date().toISOString(),
    });

    // ========================================
    // Launch Browser
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
    page.on('console', msg => console.log(`[Browser Console] ${msg.text()}`));

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

    await updateJobProgress(supabase, job_id, {
      progress_percent: 15,
      current_step: 'Loading homepage...',
    });

    // ========================================
    // HOMEPAGE: SSR Pre-flight → Puppeteer fallback
    // ========================================
    let homepageDoc = null;
    let ssrUsed = false;

    const ssrHtml = await trySSRFetch(url, 400);

    if (ssrHtml) {
      ssrUsed = true;
      const preprocessed = preprocessHtml(ssrHtml);
      homepageDoc = extractPageDocument(preprocessed, url, url);
      console.log('[V3-Async] ✅ Using SSR pre-flight HTML');
    } else {
      console.log('[V3-Async] Falling back to Puppeteer for homepage');
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      await dismissCookieDialog(page);
      await removeKnownNoise(page);
      await autoScroll(page, 3000);

      const hydrationTimeout = getHydrationTimeout(await page.content());
      if (hydrationTimeout > 0) {
        console.log(`[Hydration] Waiting ${hydrationTimeout}ms for dynamic content...`);
        await waitForContentStability(page, budgetedTimeout(hydrationTimeout));
      }

      const finalHtml = await page.content();
      const preprocessed = preprocessHtml(finalHtml);
      homepageDoc = extractPageDocument(preprocessed, url, url);
    }

    await updateJobProgress(supabase, job_id, {
      progress_percent: 40,
      current_step: 'Analyzing homepage...',
      pages_crawled: 1,
    });

    // ========================================
    // EXTRACT HOMEPAGE DATA
    // ========================================
    const normalized = normalizeLinks(homepageDoc.links, url);
    const classified = classifyLinks(homepageDoc, normalized);

    const contact = extractContact(
      homepageDoc.blocks,
      homepageDoc.metadata.phone || null,
      homepageDoc.metadata.email || null,
      homepageDoc.metadata.address || null
    );

    const opening_hours = processOpeningHours(homepageDoc);
    const kitchen_close_time = extractKitchenCloseTime(homepageDoc);

    const extraction = {
      business_name: homepageDoc.metadata.site_name || null,
      description: homepageDoc.metadata.description || null,
      contact,
      services: enrichServices({
        booking: classified.booking || null,
        menu: classified.menu || null,
        takeaway: classified.takeaway || null,
        social_profiles: classified.social || [],
      }),
      opening_hours,
      kitchen_close_time,
      menu: { inline: null },
      quality: { rating: 'unknown', confidence: 0, fields_found: 0 },
    };

    const homepageExtraction = {
      ...extraction,
      meta: { final_url: url },
      blocks: homepageDoc.blocks,
    };

    const pagesCrawled = [{ url, type: 'homepage', extraction: homepageExtraction }];

    // ========================================
    // MULTI-PAGE CRAWL (Conditional)
    // ========================================
    const missingPhone = !extraction.contact.phone;
    const missingAddress = !extraction.contact.address;
    const missingHours = !extraction.opening_hours || extraction.opening_hours.length === 0;
    const missingBooking = !extraction.services?.booking?.url;
    const missingDescription = !extraction.description;

    const criticalFieldsMissing = missingPhone || missingAddress || missingHours || missingBooking || missingDescription;

    if (criticalFieldsMissing) {
      console.log('[Multi-Page] Critical fields missing, discovering additional pages...');
      
      await updateJobProgress(supabase, job_id, {
        progress_percent: 50,
        current_step: 'Crawling additional pages...',
      });

      const pagesToCrawl = discoverAdditionalPages(homepageDoc, homepageExtraction, 3);
      console.log(`[Multi-Page] ${pagesToCrawl.length} pages queued`);

      for (let i = 0; i < pagesToCrawl.length; i++) {
        const pageInfo = pagesToCrawl[i];
        console.log(`[Multi-Page] Crawling ${i + 1}/${pagesToCrawl.length}: ${pageInfo.url} (${pageInfo.type})`);

        const pageDoc = await scrapePage(page, pageInfo.url, budgetedTimeout(20000, 5000));
        const normalized = normalizeLinks(pageDoc.links, pageInfo.url);
        const classified = classifyLinks(pageDoc, normalized);
        const contact = extractContact(pageDoc.blocks, pageDoc.metadata.phone, pageDoc.metadata.email, pageDoc.metadata.address);

        const pageExtraction = {
          ...extraction,
          contact,
          services: enrichServices({
            booking: classified.booking,
            menu: classified.menu,
            takeaway: classified.takeaway,
            social_profiles: classified.social || [],
          }),
          meta: { final_url: pageInfo.url },
          blocks: pageDoc.blocks,
        };

        pagesCrawled.push({
          url: pageInfo.url,
          type: pageInfo.type,
          extraction: pageExtraction,
        });

        await updateJobProgress(supabase, job_id, {
          progress_percent: 50 + ((i + 1) / pagesToCrawl.length) * 30,
          current_step: `Crawled page ${i + 2} of ${pagesToCrawl.length + 1}`,
          pages_crawled: pagesCrawled.length,
        });
      }

      // Merge all extractions
      const allExtractions = pagesCrawled.map(p => p.extraction);
      extraction.contact = mergePageExtractions(allExtractions).contact;
      extraction.services = enrichServices(mergePageExtractions(allExtractions).services);
    }

    // Calculate final quality
    extraction.quality = calculateQuality(extraction);

    const duration = Date.now() - startTime;
    console.log(`[V3-Async] Scrape completed in ${duration}ms, quality=${extraction.quality.rating}, pages=${pagesCrawled.length}`);

    // ========================================
    // SAVE TO SUPABASE
    // ========================================
    await updateJobProgress(supabase, job_id, {
      progress_percent: 85,
      current_step: 'Saving results...',
    });

    const responsePayload = {
      success: true,
      version: 'v3-async',
      extraction,
      pages_crawled: pagesCrawled,
      scraper_metadata: {
        version: 'v3-async',
        scraper_type: ssrUsed ? 'cloud-run-ssr-fetch' : 'cloud-run-puppeteer-smart',
        hydration_timeout: ssrUsed ? 0 : getHydrationTimeout(''),
        duration_ms: duration,
        pages_crawled_count: pagesCrawled.length,
        ssr_used: ssrUsed,
      },
    };

    // Map quality to enum
    const qualityRating = extraction.quality.rating;
    const contentQuality = ['excellent', 'good'].includes(qualityRating) ? 'rich'
      : qualityRating === 'partial' ? 'thin'
      : 'shell';

    const menuSource = extraction.services?.menu?.url ? 'link'
      : extraction.menu?.inline ? 'inline'
      : 'none';

    const { data: scrapeResult, error: insertError } = await supabase
      .from('website_scrape_results')
      .insert({
        business_id,
        job_id,
        url,
        scraped_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        scraper_version: 'cloud-run-v3-async',
        content_quality: contentQuality,
        menu_source: menuSource,
        payload: responsePayload,
        webhook_status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to save scrape result: ${insertError.message}`);
    }

    console.log('[V3-Async] ✅ Saved to Supabase:', scrapeResult.id);

    // ========================================
    // DELIVER WEBHOOK
    // ========================================
    if (webhook_url) {
      console.log('[V3-Async] Delivering webhook...');
      
      const webhookPayload = {
        job_id,
        scrape_result_id: scrapeResult.id,
        status: 'success',
        pages_crawled: pagesCrawled.length,
        duration_ms: duration,
        quality_rating: extraction.quality.rating,
      };

      const webhookSuccess = await deliverWebhook(
        webhook_url,
        webhookPayload,
        webhook_api_key,
        3
      );

      await supabase
        .from('website_scrape_results')
        .update({
          webhook_status: webhookSuccess ? 'delivered' : 'failed',
          webhook_attempts: 3,
        })
        .eq('id', scrapeResult.id);
    }

    // Return success to caller (but webhook is the main notification)
    res.json({
      success: true,
      job_id,
      scrape_result_id: scrapeResult.id,
      pages_crawled: pagesCrawled.length,
      quality: extraction.quality.rating,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[V3-Async] ❌ Scrape failed:', error);

    const { job_id, business_id, webhook_url, webhook_api_key } = req.body;

    // Try to save partial/failed result
    if (job_id && business_id) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Save failed scrape
        const { data: scrapeResult } = await supabase
          .from('website_scrape_results')
          .insert({
            business_id,
            job_id,
            url: req.body.url,
            scraped_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            scraper_version: 'cloud-run-v3-async',
            content_quality: 'shell',
            menu_source: 'none',
            payload: {
              success: false,
              error: error.message,
              scraper_metadata: {
                version: 'v3-async',
                duration_ms: duration,
              },
            },
            webhook_status: 'pending',
          })
          .select()
          .single();

        // Deliver failure webhook
        if (webhook_url && scrapeResult) {
          await deliverWebhook(
            webhook_url,
            {
              job_id,
              scrape_result_id: scrapeResult.id,
              status: 'failed',
              error: error.message,
              pages_crawled: 0,
              duration_ms: duration,
            },
            webhook_api_key,
            3
          );
        }
      } catch (saveError) {
        console.error('[V3-Async] Failed to save error state:', saveError);
      }
    }

    res.status(500).json({
      success: false,
      error: error.message,
      job_id,
      scraper_metadata: {
        version: 'v3-async',
        duration_ms: duration,
      },
    });
  } finally {
    if (browser) {
      await browser.close().catch(() => null);
    }
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found. Available endpoints: GET /health, POST /scrape, POST /scrape-v2, POST /scrape-v3, POST /scrape-v3-async'
  });
});

app.listen(PORT, () => {
  console.log(`Cloud Run Scraper listening on port ${PORT}`);
  console.log(`API Key protection: ${API_KEY ? 'ENABLED' : 'DISABLED (WARNING!)'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
