import chromium from '@sparticuz/chromium';
import { chromium as playwright } from 'playwright-core';

/**
 * Vercel Serverless Function: Web Scraper with Playwright
 * 
 * Scrapes websites with full JavaScript rendering, cookie consent handling,
 * and structured data extraction optimized for restaurant websites.
 * 
 * Security: Bearer token authentication required
 * Timeout: 60s (Vercel Pro)
 */
export default async function handler(req, res) {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', 'https://oadwluspjlsnxhgakral.supabase.co');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Authentication via pre-shared bearer token
  const authHeader = req.headers['authorization'];
  const expectedAuth = `Bearer ${process.env.SCRAPER_API_KEY}`;
  
  if (!authHeader || authHeader !== expectedAuth) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
  }

  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'Missing "url" in request body' });
  }

  console.log(`[Scraper] Starting scrape for: ${url}`);
  
  let browser = null;
  const startTime = Date.now();

  try {
    // Launch optimized Chromium instance for serverless
    browser = await playwright.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    
    // Set viewport for consistent rendering
    await page.setViewportSize({ width: 1280, height: 720 });

    console.log(`[Scraper] Navigating to ${url}...`);
    
    // Navigate with networkidle to wait for JS rendering
    await page.goto(url, { 
      waitUntil: 'networkidle', 
      timeout: 30000 
    });

    console.log(`[Scraper] Page loaded, handling cookie consent...`);

    // Cookie consent handling - Try to click accept buttons
    const consentSelectors = [
      'button:has-text("Accepter alle")',
      'button:has-text("Accepter")',
      'button:has-text("Accept all")',
      'button:has-text("Accept")',
      'button:has-text("Tillad alle")',
      '[id*="CookiebotWidget"] button',
      '.cookie-consent button',
      '#cookie-accept',
      '[class*="cookie"] button[class*="accept"]',
      '[class*="consent"] button[class*="accept"]',
    ];

    for (const selector of consentSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          await button.click();
          console.log(`[Scraper] Clicked consent button: ${selector}`);
          // Wait a bit for consent to process
          await page.waitForTimeout(1000);
          break;
        }
      } catch (err) {
        // Continue to next selector if this one fails
      }
    }

    // If clicking failed, hide banners with CSS as fallback
    await page.addStyleTag({ 
      content: `
        #CookieInformationVideoBridge, 
        .cookie-banner, 
        [id*="cookie"][id*="banner"],
        [class*="cookie"][class*="banner"],
        [id*="consent"],
        [class*="consent"] { 
          display: none !important; 
          visibility: hidden !important; 
          pointer-events: none !important;
          opacity: 0 !important;
        }
      ` 
    });

    console.log(`[Scraper] Extracting page content...`);

    // Extract comprehensive page data
    const pageData = await page.evaluate(() => {
      // Helper: Get all internal links
      const links = Array.from(document.querySelectorAll('a'))
        .map(a => ({
          href: a.href,
          text: a.innerText?.trim() || '',
          title: a.title || ''
        }))
        .filter(link => link.href && !link.href.startsWith('mailto:') && !link.href.startsWith('tel:'));

      // Helper: Get all headings with hierarchy
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
        .map(h => ({
          level: parseInt(h.tagName.substring(1)),
          text: h.innerText?.trim() || ''
        }))
        .filter(h => h.text);

      // Helper: Get structured data (JSON-LD)
      const structuredData = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
        .map(script => {
          try {
            return JSON.parse(script.textContent);
          } catch {
            return null;
          }
        })
        .filter(data => data);

      return {
        html: document.documentElement.outerHTML,
        text: document.body.innerText,
        title: document.title,
        links,
        headings,
        structuredData,
        url: window.location.href
      };
    });

    await browser.close();

    const duration = Date.now() - startTime;
    console.log(`[Scraper] Successfully scraped ${url} in ${duration}ms`);
    console.log(`[Scraper] Extracted: ${pageData.links.length} links, ${pageData.headings.length} headings, ${pageData.text.length} chars`);

    return res.status(200).json({
      success: true,
      data: pageData,
      meta: {
        scrapedAt: new Date().toISOString(),
        durationMs: duration
      }
    });

  } catch (error) {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }

    const duration = Date.now() - startTime;
    console.error(`[Scraper] Error after ${duration}ms:`, error.message);

    return res.status(500).json({ 
      error: error.message,
      meta: {
        failedAt: new Date().toISOString(),
        durationMs: duration
      }
    });
  }
}
