/**
 * Smart Multi-Page Crawler
 * 
 * Strategy:
 * 1. Scrape homepage
 * 2. Evaluate quality
 * 3. If quality good/excellent → STOP (1 page)
 * 4. If quality partial/poor → Crawl 2-4 more pages
 * 5. Prioritize by: type (contact/about > menu), missing fields, keywords
 * 6. Merge results with conflict resolution
 */

import {
  dismissCookieDialog,
  removeKnownNoise,
  autoScroll,
  waitForContentStability
} from './browser-helpers.js';
import { extractPageDocument } from './dom-extractor.js';

/**
 * Classify page type from URL and link text.
 * Returns page type and priority for crawl scheduling.
 * 
 * @param {string} url - Page URL
 * @param {string} linkText - Anchor text (if available)
 * @returns {object} { type: string, priority: number }
 */
export function classifyPageType(url, linkText = '') {
  const urlLower = url.toLowerCase();
  const textLower = (linkText || '').toLowerCase();
  const combined = `${urlLower} ${textLower}`;

  // Contact pages (highest priority - has address)
  const contactKeywords = ['kontakt', 'contact', 'find', 'location', 'reach', 'besøg', 'findus', 'findvej'];
  if (contactKeywords.some(k => combined.includes(k))) {
    return { type: 'contact', priority: 90 };
  }

  // About pages (high priority - has description)
  const aboutKeywords = ['om-os', 'om os', 'about', 'historie', 'history', 'concept', 'vores'];
  if (aboutKeywords.some(k => combined.includes(k))) {
    return { type: 'about', priority: 70 };
  }

  // Menu pages (skip for sync crawl)
  const menuKeywords = ['menu', 'menukort', 'madkort', 'drikkekort', 'food', 'drinks', 'brunch', 'frokost', 'aften', 'cocktail', 'drikke', 'mad'];
  if (menuKeywords.some(k => combined.includes(k))) {
    return { type: 'menu', priority: 0 };
  }

  // Opening hours (medium priority)
  const hoursKeywords = ['åbningstid', 'opening', 'hours', 'praktisk', 'practical'];
  if (hoursKeywords.some(k => combined.includes(k))) {
    return { type: 'hours', priority: 60 };
  }

  // Default: unknown type, low priority
  return { type: 'other', priority: 30 };
}

/**
 * Discover and score additional pages to crawl.
 * Now returns typed page objects with priorities.
 * 
 * @param {object} homepageDoc - Extracted homepage document
 * @param {object} homepageExtraction - Initial extraction from homepage
 * @param {number} maxPages - Max additional pages to crawl (2-4)
 * @returns {array} Sorted page objects: { url, type, priority, text }
 */
export function discoverAdditionalPages(homepageDoc, homepageExtraction, maxPages = 4) {
  const candidates = [];
  const baseUrl = new URL(homepageDoc.final_url);

  // Score each internal link
  for (const link of homepageDoc.links) {
    try {
      const linkUrl = new URL(link.url);

      // Only internal links
      if (linkUrl.hostname !== baseUrl.hostname) {
        continue;
      }

      // CRITICAL: Exclude privacy/legal pages FIRST
      const linkText = (link.text || '').toLowerCase();
      const fullContext = `${linkUrl.pathname.toLowerCase()} ${linkText}`;
      if (isExcludedPage(fullContext)) {
        continue;
      }

      // Classify page type
      const { type, priority } = classifyPageType(link.url, link.text);

      // Boost priority if field is missing from homepage
      let adjustedPriority = priority;
      if (type === 'contact' && homepageExtraction.contact.addresses.length === 0) {
        adjustedPriority += 10; // Really need this
      }
      if (type === 'about' && (!homepageExtraction.content_sections || homepageExtraction.content_sections.length < 3)) {
        adjustedPriority += 10; // Need more content
      }

      // Add to candidates (including menu pages for later queuing)
      candidates.push({
        url: link.url,
        type,
        priority: adjustedPriority,
        text: link.text || ''
      });

    } catch {
      // Invalid URL, skip
    }
  }

  // Sort by priority descending
  candidates.sort((a, b) => b.priority - a.priority);

  // Deduplicate URLs
  const seen = new Set();
  const uniqueCandidates = [];
  for (const candidate of candidates) {
    if (!seen.has(candidate.url)) {
      seen.add(candidate.url);
      uniqueCandidates.push(candidate);
    }
  }

  // Take top N pages
  const result = uniqueCandidates.slice(0, maxPages);
  
  console.log(`[Crawler] Discovered ${result.length} pages to crawl:`, 
    result.map(p => `${new URL(p.url).pathname} (${p.type}, pri=${p.priority})`));
  
  return result;
}

/**
 * Check if page should be excluded from crawling
 * Checks both URL path and anchor text for exclusion keywords
 * Returns true immediately if any privacy/legal/system pattern found
 */
function isExcludedPage(contextString) {
  // Keywords without leading slashes to catch mid-path matches
  const excludeKeywords = [
    'privacy',
    'privatliv',
    'cookie',
    'cookiepolitik',
    'gdpr',
    'legal',
    'terms',
    'vilkår',
    'betingelser',
    'login',
    'signin',
    'signup',
    'checkout',
    'cart',
    'account',
    'admin',
    'policy',
    'politik'
  ];

  const lower = contextString.toLowerCase();
  return excludeKeywords.some(keyword => lower.includes(keyword));
}

/**
 * Scrape a single page
 * @param {import('puppeteer').Page} page
 * @param {string} url
 * @param {number} timeout - Navigation timeout in ms (default 30000)
 * @returns {Promise<object>} Page document
 */
export async function scrapePage(page, url, timeout = 30000) {
  console.log(`[Crawler] Scraping ${url}`);

  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout
  });

  // Wait for network idle (XHR/fetch hydration)
  await page
    .waitForNetworkIdle({ idleTime: 1000, timeout: 10000 })
    .catch(() => null);

  // Wait for meaningful content
  await page
    .waitForFunction(
      () => document.body?.innerText?.trim().length > 300,
      { timeout: 10000 }
    )
    .catch(() => null);

  // Execute Phase 5 in order
  await dismissCookieDialog(page);
  await removeKnownNoise(page);
  await autoScroll(page);
  await waitForContentStability(page);

  // Guard: verify we have content before extracting
  // If stability check left us with an empty DOM, wait one more beat
  let bodyLength = 0;
  try {
    bodyLength = await page.evaluate(() => document.body?.innerText?.trim().length ?? 0);
  } catch (_) {}

  if (bodyLength < 100) {
    console.warn(`[scrapePage] Body too short after stability (${bodyLength} chars) — waiting 2s`);
    await new Promise(r => setTimeout(r, 2000));
    try {
      bodyLength = await page.evaluate(() => document.body?.innerText?.trim().length ?? 0);
    } catch (_) {}
    console.log(`[scrapePage] Body length after extra wait: ${bodyLength} chars`);
  }
  
  return await extractPageDocument(page);
}

/**
 * Merge extraction results from multiple pages
 * @param {array} pageExtractions - Array of extraction results
 * @returns {object} Merged extraction
 */
export function mergePageExtractions(pageExtractions) {
  if (pageExtractions.length === 0) {
    throw new Error('No pages to merge');
  }

  if (pageExtractions.length === 1) {
    return pageExtractions[0];
  }

  const merged = JSON.parse(JSON.stringify(pageExtractions[0])); // Deep clone

  // Merge strategy:
  // - Links: combine all, deduplicate
  // - Contact: pool all candidates, deduplicate
  // - Services: prefer highest confidence
  // - Content sections: combine all
  // - Business name/description: prefer highest confidence

  for (let i = 1; i < pageExtractions.length; i++) {
    const page = pageExtractions[i];

    // Merge contact candidates
    merged.contact.emails = deduplicateByValue([
      ...merged.contact.emails,
      ...page.contact.emails
    ]);

    merged.contact.phones = deduplicateByValue([
      ...merged.contact.phones,
      ...page.contact.phones
    ]);

    merged.contact.addresses = deduplicateByValue([
      ...merged.contact.addresses,
      ...page.contact.addresses
    ]);

    // Merge services (prefer highest confidence)
    if (!merged.services.booking || (page.services.booking && page.services.booking.confidence > merged.services.booking.confidence)) {
      merged.services.booking = page.services.booking;
    }

    if (!merged.services.menu || (page.services.menu && page.services.menu.confidence > merged.services.menu.confidence)) {
      merged.services.menu = page.services.menu;
    }

    if (!merged.services.takeaway || (page.services.takeaway && page.services.takeaway.confidence > merged.services.takeaway.confidence)) {
      merged.services.takeaway = page.services.takeaway;
    }

    // Merge social profiles (deduplicate by platform)
    const socialByPlatform = new Map();
    for (const profile of [...merged.services.social_profiles, ...page.services.social_profiles]) {
      if (!socialByPlatform.has(profile.platform)) {
        socialByPlatform.set(profile.platform, profile);
      }
    }
    merged.services.social_profiles = Array.from(socialByPlatform.values());

    // Merge content sections
    merged.content_sections = [
      ...(merged.content_sections || []),
      ...(page.content_sections || [])
    ];

    // Merge opening hours (prefer one with higher confidence)
    if (!merged.opening_hours?.value || (page.opening_hours?.value && page.opening_hours.confidence > merged.opening_hours.confidence)) {
      merged.opening_hours = page.opening_hours;
    }
  }

  // Track which pages were crawled
  merged.pages_crawled = pageExtractions.map(p => ({
    url: p.meta.final_url,
    quality: p.quality.rating
  }));

  return merged;
}

/**
 * Deduplicate array by value property, keep highest confidence
 */
function deduplicateByValue(items) {
  const byValue = new Map();

  for (const item of items) {
    const existing = byValue.get(item.value);
    if (!existing || item.confidence > existing.confidence) {
      byValue.set(item.value, item);
    }
  }

  return Array.from(byValue.values());
}
