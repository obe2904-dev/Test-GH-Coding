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
      opening_hours: processOpeningHours(homepageDoc),
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
            opening_hours: processOpeningHours(pageDoc),
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
        pages_crawled_count: pagesCrawled.length
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
 * Process structured opening hours from page document
 * @param {object} pageDoc - Page document with opening_hours_structured
 * @returns {object} { value: string | null, candidates: array }
 */
function processOpeningHours(pageDoc) {
  if (!pageDoc.opening_hours_structured || pageDoc.opening_hours_structured.length === 0) {
    return { value: null, candidates: [] };
  }

  const pairs = pageDoc.opening_hours_structured;
  
  // Format as readable text
  const lines = pairs.map(pair => `${pair.day_text}: ${pair.time_text}`);
  const formattedText = lines.join('; ');

  return {
    value: formattedText,
    candidates: pairs,
    confidence: 0.90,
    source_url: pageDoc.final_url,
    source_type: 'structured_dom'
  };
}

/**
 * Extract business name from page document
 */
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
    const welcomeMatch = block.text.match(/velkommen til\s+([A-ZÆØÅ][a-zæøå]+)/i);
    if (welcomeMatch) {
      candidates.push({
        value: welcomeMatch[1].trim(),
        confidence: 0.85,
        source_type: 'welcome_phrase',
        source_url: pageDoc.final_url
      });
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
