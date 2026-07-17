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
import { extractPageDocument, extractOpeningHoursFromText } from './services/dom-extractor.js';
import { normalizeLinks, classifyLinks } from './services/link-classifier.js';
import { extractContact } from './services/contact-extractor.js';
import { calculateQuality, shouldContinueCrawling } from './services/quality-calculator.js';
import {
  discoverAdditionalPages,
  scrapePage,
  mergePageExtractions
} from './services/page-crawler.js';

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
        waitUntil: 'networkidle2',
        timeout:   30000,
      });

      // Wait for meaningful content volume — 500 chars is enough to confirm
      // the page has rendered beyond nav links and empty shells
      const hasContent = await page
        .waitForFunction(
          () => document.body?.innerText?.trim().length > 500,
          { timeout: 12000 }
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
      await waitForContentStability(page);
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
    const { classified: services } = classifyLinks(normalizedLinks);
    const contact = extractContact(homepageDoc);
    const opening_hours = await processOpeningHours(homepageDoc);

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
      services,
      content_sections: extractContentSections(homepageDoc, opening_hours),
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
          const pageOpeningHours = await processOpeningHours(pageDoc);

          const pageExtraction = {
            meta: {
              final_url: pageDoc.final_url || pageUrl
            },
            contact: pageContact,
            services: pageServices,
            content_sections: extractContentSections(pageDoc, pageOpeningHours),
            opening_hours: pageOpeningHours,
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
        version:            'v3',
        scraper_type:       ssrUsed ? 'cloud-run-ssr-fetch' : 'cloud-run-puppeteer-smart',
        duration_ms:        duration,
        pages_crawled_count: pagesCrawled.length,
        ssr_used:           ssrUsed,
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
