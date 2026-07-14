/**
 * Smart Multi-Page Crawler
 * 
 * Strategy:
 * 1. Scrape homepage
 * 2. Evaluate quality
 * 3. If quality good/excellent → STOP (1 page)
 * 4. If quality partial/poor → Crawl 2-4 more pages
 * 5. Prioritize by: missing fields first, then keywords
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
 * Discover and score additional pages to crawl
 * @param {object} homepageDoc - Extracted homepage document
 * @param {object} homepageExtraction - Initial extraction from homepage
 * @param {number} maxPages - Max additional pages to crawl (2-4)
 * @returns {array} Sorted URLs to crawl
 */
export function discoverAdditionalPages(homepageDoc, homepageExtraction, maxPages = 4) {
  const candidates = [];
  const baseUrl = new URL(homepageDoc.final_url);

  // Priority keywords for different content types
  const keywordSets = {
    menu: {
      keywords: ['menu', 'menukort', 'madkort', 'drikkekort', 'food', 'drinks'],
      weight: determineMissingWeight(homepageExtraction.services.menu, 'menu')
    },
    contact: {
      keywords: ['kontakt', 'contact', 'find us', 'location', 'reach', 'besøg'],
      weight: determineMissingWeight(
        homepageExtraction.contact.emails.length > 0 && homepageExtraction.contact.phones.length > 0,
        'contact'
      )
    },
    hours: {
      keywords: ['åbningstider', 'opening hours', 'praktisk', 'practical'],
      weight: determineMissingWeight(homepageExtraction.opening_hours?.value, 'hours')
    },
    about: {
      keywords: ['om os', 'about', 'historie', 'history', 'concept'],
      weight: determineMissingWeight(
        homepageExtraction.content_sections?.some(s => s.type === 'about'),
        'about'
      )
    }
  };

  // Score each internal link
  for (const link of homepageDoc.links) {
    try {
      const linkUrl = new URL(link.url);

      // Only internal links
      if (linkUrl.hostname !== baseUrl.hostname) {
        continue;
      }

      // CRITICAL: Exclude privacy/legal pages FIRST (before any scoring)
      const linkText = (link.text || '').toLowerCase();
      const fullContext = `${linkUrl.pathname.toLowerCase()} ${linkText}`;
      if (isExcludedPage(fullContext)) {
        continue;
      }

      // Score based on keywords and missing fields
      let score = 0;
      const url = link.url.toLowerCase();
      const text = (link.text || '').toLowerCase();
      const combined = `${url} ${text}`;

      for (const [type, config] of Object.entries(keywordSets)) {
        for (const keyword of config.keywords) {
          if (combined.includes(keyword)) {
            score += 10 * config.weight; // Weight by how badly we need this field
            break;
          }
        }
      }

      if (score > 0) {
        candidates.push({
          url: link.url,
          score,
          text: link.text
        });
      }
    } catch {
      // Invalid URL, skip
    }
  }

  // Sort by score descending, take top N
  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPages)
    .map(c => c.url);
}

/**
 * Determine weight for missing field
 * Returns higher weight if field is missing/empty
 */
function determineMissingWeight(hasField, fieldName) {
  if (!hasField) {
    return 3.0; // High priority - field is missing
  }
  return 1.0; // Low priority - already have this field
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
 * @returns {Promise<object>} Page document
 */
export async function scrapePage(page, url) {
  console.log(`[Crawler] Scraping ${url}`);

  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
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
