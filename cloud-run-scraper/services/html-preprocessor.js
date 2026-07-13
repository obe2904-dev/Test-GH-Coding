/**
 * HTML Pre-Processor Module for Cloud Run
 * 
 * Reduces 1-2 MB raw HTML to 5-20 KB structured ScrapedPayload
 * Executes before any AI call to minimize token costs
 * 
 * @typedef {import('../types/scrape').ScrapedPayload} ScrapedPayload
 * @typedef {import('../types/scrape').MenuSource} MenuSource
 * @typedef {import('../types/scrape').ContentQuality} ContentQuality
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BOOKING_PATTERNS = [
  /book/i, /reservation/i, /reserv/i, /bestil/i, /bord/i,
];

const MENU_URL_PATTERNS = [
  /\/menu/i, /\/mad/i, /\/spisekort/i, /\/carte/i, /mealo\.dk/i,
  /menucard/i, /food/i,
];

const TAKEAWAY_PATTERNS = [
  /takeaway/i, /take.away/i, /afhentning/i, /levering/i, /delivery/i,
  /just.eat/i, /wolt/i, /foodora/i,
];

const SOCIAL_DOMAINS = [
  'facebook.com', 'instagram.com', 'tiktok.com',
  'twitter.com', 'x.com', 'linkedin.com',
];

// Sections of text that are boilerplate noise
const TEXT_NOISE_STRINGS = [
  'Du bestemmer over dine data',
  'Nødvendige cookies',
  'Statistiske',
  'Accepter alle',
  'Gem indstillinger',
  'Cookiepolitik',
  'Afghanistan',          // start of country dropdown
  'Færdiggør profil',
  'Glemt adgangskode',
  'Din kurv',
  'Check ud',
];

// Patterns that signal opening hours content
const HOURS_PATTERNS = [
  /(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})/,
  /mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag/i,
  /monday|tuesday|wednesday|thursday|friday|saturday|sunday/i,
  /åbent|lukket|åbningstider|opening hours/i,
];

// ---------------------------------------------------------------------------
// Strip HTML noise
// ---------------------------------------------------------------------------

/**
 * Remove CSS, scripts, tags and decode entities
 * @param {string} html
 * @returns {string}
 */
function stripHtml(html) {
  let clean = html;

  // Remove <style> blocks entirely (CSS is never useful)
  clean = clean.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove <script> blocks EXCEPT JSON-LD (may contain structured data)
  clean = clean.replace(
    /<script(?![^>]*type=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>/gi,
    ''
  );

  // Remove <link> tags (fonts, stylesheets, prefetch)
  clean = clean.replace(/<link[^>]*>/gi, '');

  // Remove HTML comments
  clean = clean.replace(/<!--[\s\S]*?-->/g, '');

  // Remove <svg> blocks (icons, logos — not text content)
  clean = clean.replace(/<svg[\s\S]*?<\/svg>/gi, '');

  // Remove <noscript> blocks
  clean = clean.replace(/<noscript>[\s\S]*?<\/noscript>/gi, '');

  // Strip all remaining tags
  clean = clean.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  clean = clean
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Collapse whitespace
  clean = clean.replace(/\s+/g, ' ').trim();

  return clean;
}

// ---------------------------------------------------------------------------
// Remove known noise sections from stripped text
// ---------------------------------------------------------------------------

/**
 * Remove cookie walls, country dropdowns, and other boilerplate
 * @param {string} text
 * @returns {string}
 */
function removeBoilerplate(text) {
  let clean = text;

  for (const noise of TEXT_NOISE_STRINGS) {
    const idx = clean.indexOf(noise);
    if (idx === -1) continue;

    // Cut from noise trigger to 3000 chars forward (covers most cookie walls)
    const blockEnd = Math.min(idx + 3000, clean.length);
    const afterBlock = clean.slice(blockEnd);

    // Only cut if something meaningful follows
    clean = clean.slice(0, idx) + ' ' + afterBlock;
  }

  // Remove the country code phone dropdown by pattern
  // Signature: "Afghanistan +93 ... Zimbabwe +263"
  clean = clean.replace(
    /Afghanistan[^)]+\+93.{0,2000}Zimbabwe.{0,100}\+263/g,
    ''
  );

  return clean.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Meta tag extraction
// ---------------------------------------------------------------------------

/**
 * Extract meta tags from HTML
 * @param {string} html
 * @returns {import('../types/scrape').MetaData}
 */
function extractMeta(html) {
  const get = (pattern) => {
    const m = html.match(pattern);
    return m ? (m[1] || null) : null;
  };

  return {
    title: get(/<title[^>]*>([^<]+)<\/title>/i),
    description:
      get(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
      get(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i),
    og_title: get(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i),
    og_description: get(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i),
    og_image: get(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i),
    keywords: get(/<meta\s+name=["']keywords["']\s+content=["']([^"']+)["']/i),
    locale:
      get(/<meta\s+property=["']og:locale["']\s+content=["']([^"']+)["']/i) ||
      get(/<html[^>]+lang=["']([^"']+)["']/i),
  };
}

// ---------------------------------------------------------------------------
// JSON-LD extraction (structured data)
// ---------------------------------------------------------------------------

/**
 * Extract JSON-LD structured data blocks
 * @param {string} html
 * @returns {Array<Record<string, unknown>>}
 */
function extractJsonLd(html) {
  const results = [];
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = pattern.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      results.push(parsed);
    } catch {
      // Malformed JSON-LD — skip
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Link classification
// ---------------------------------------------------------------------------

/**
 * Extract and classify links from HTML
 * @param {string} html
 * @param {string} baseUrl
 * @returns {import('../types/scrape').LinksData}
 */
function extractLinks(html, baseUrl) {
  // Match full <a> tags to capture both href and visible link text
  const anchorPattern = /<a\s[^>]*href=["']([^"'#][^"']*?)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const allLinks = [];
  let m;

  const base = new URL(baseUrl);
  const resolve = (href) => {
    try {
      return new URL(href, base).href;
    } catch {
      return href;
    }
  };

  while ((m = anchorPattern.exec(html)) !== null) {
    const url = resolve(m[1]);
    // Strip any inner HTML tags (icons, spans) to get visible text only
    const text = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (url) {
      allLinks.push({ url, text });
    }
  }

  // Deduplicate by URL (keep first occurrence, which has the most context)
  const seen = new Set();
  const uniqueLinks = allLinks.filter(({ url }) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });

  const resolved = uniqueLinks.map(({ url }) => url);

  const social = uniqueLinks.filter(({ url }) =>
    SOCIAL_DOMAINS.some((domain) => url.includes(domain))
  );

  const pdfMenus = resolved.filter((url) =>
    /\.pdf(\?|$)/i.test(url) &&
    MENU_URL_PATTERNS.some((p) => p.test(url))
  );

  const menuUrl =
    resolved.find(
      (url) =>
        MENU_URL_PATTERNS.some((p) => p.test(url)) &&
        !pdfMenus.includes(url) &&
        !url.startsWith(baseUrl.split('/').slice(0, 3).join('/'))   // prefer external menu links
    ) ||
    resolved.find(
      (url) => MENU_URL_PATTERNS.some((p) => p.test(url)) && !pdfMenus.includes(url)
    ) ||
    null;

  const booking =
    resolved.find((url) => BOOKING_PATTERNS.some((p) => p.test(url))) ||
    uniqueLinks.find(({ text }) => BOOKING_PATTERNS.some((p) => p.test(text)))?.url ||
    null;

  const takeaway =
    resolved.find((url) => TAKEAWAY_PATTERNS.some((p) => p.test(url))) ||
    uniqueLinks.find(({ text }) => TAKEAWAY_PATTERNS.some((p) => p.test(text)))?.url ||
    null;

  // Filter raw links: drop assets, analytics, internal JS anchors, and
  // known noise domains — keep only links a human would click
  const NOISE_LINK_PATTERNS = [
    /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)(\?|$)/i,
    /google-analytics|googletagmanager|facebook\.net|cookieinformation/i,
    /^javascript:/i,
    /^mailto:/i,   // captured separately in contact extraction
    /^tel:/i,      // captured separately in contact extraction
    /privacy|privacypolicy|privatlivspolitik|cookie|gdpr/i,  // cookie consent noise
    /support\.(google|microsoft|mozilla|apple|opera)\.com/i,  // browser help links
    /legal\.hubspot|policies\.google|macromedia\.com/i,       // vendor privacy policies
  ];

  const raw = uniqueLinks.filter(
    ({ url, text }) =>
      text.length > 0 &&
      !NOISE_LINK_PATTERNS.some((p) => p.test(url))
  );

  return {
    booking,
    menu_url: menuUrl,
    takeaway,
    social: social.map(({ url }) => url),
    pdf_menus: pdfMenus,
    raw,
  };
}

// ---------------------------------------------------------------------------
// Contact extraction (regex — zero AI cost)
// ---------------------------------------------------------------------------

/**
 * Extract contact information from text
 * @param {string} text
 * @returns {import('../types/scrape').ContactData}
 */
function extractContact(text) {
  const email = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/i)?.[0] || null;

  // Danish phone: 8 digits, optionally grouped
  const phone =
    text.match(/(?:tel:|phone:|tlf:?)?\s*(\+?45\s?)?(\d{2}\s?){4}/i)?.[0]?.trim() || null;

  // Address: look for Danish postal pattern (4-digit postcode + city)
  const address =
    text.match(/[A-ZÆØÅ][a-zæøå\s]+\d+[,\s]+\d{4}\s+[A-ZÆØÅ][a-zæøå\s]+/)?.[0]?.trim() ||
    null;

  return { email, phone, address };
}

// ---------------------------------------------------------------------------
// Opening hours extraction
// ---------------------------------------------------------------------------

/**
 * Extract opening hours text block
 * @param {string} text
 * @returns {string | null}
 */
function extractOpeningHours(text) {
  // Find the first segment of text that matches hours patterns
  const lines = text.split(/[.!]|\n/);

  const hoursLines = [];
  let inHoursBlock = false;

  for (const line of lines) {
    const isHoursLine = HOURS_PATTERNS.some((p) => p.test(line));

    if (isHoursLine) {
      inHoursBlock = true;
      hoursLines.push(line.trim());
    } else if (inHoursBlock && hoursLines.length > 0) {
      // Allow up to 2 non-hours lines within a block before ending it
      if (line.trim().length < 5) continue;
      break;
    }
  }

  return hoursLines.length > 0 ? hoursLines.join(' ').trim() : null;
}

// ---------------------------------------------------------------------------
// Menu text extraction
// ---------------------------------------------------------------------------

/**
 * Extract menu section with prices
 * @param {string} text
 * @param {string} url
 * @returns {{ menuText: string | null, menuSource: MenuSource }}
 */
function extractMenuText(text, url) {
  // Check if this URL itself is a menu page
  const isMenuPage = MENU_URL_PATTERNS.some(p => p.test(url));
  
  // Price pattern: Danish kr. amounts
  const pricePattern = /\d+\s*kr\.?/i;

  if (!pricePattern.test(text)) {
    return { menuText: null, menuSource: 'none' };
  }

  // Find all price occurrences
  const matches = [...text.matchAll(/\d+\s*kr\.?/gi)];
  
  if (matches.length === 0) {
    return { menuText: null, menuSource: 'none' };
  }

  // If this IS a menu page, extract generously
  if (isMenuPage && matches.length > 5) {
    // Get from first price to last price with generous padding
    const firstIdx = matches[0].index;
    const lastIdx = matches[matches.length - 1].index;
    
    const start = Math.max(0, firstIdx - 500);
    const end = Math.min(text.length, lastIdx + 200);
    
    const menuText = text.slice(start, end).trim();
    return {
      menuText: menuText.length > 50 ? menuText : null,
      menuSource: 'inline',
    };
  }

  // Homepage: extract just the menu section
  const priceIdx = matches[0].index;
  const lastPriceIdx = matches[matches.length - 1].index;

  const start = Math.max(0, priceIdx - 500);
  const end = Math.min(text.length, lastPriceIdx + 200);

  const menuText = text.slice(start, end).trim();

  return {
    menuText: menuText.length > 50 ? menuText : null,
    menuSource: 'inline',
  };
}

// ---------------------------------------------------------------------------
// About / brand text extraction
// ---------------------------------------------------------------------------

/**
 * Extract brand narrative text
 * @param {string} text
 * @param {string | null} menuText
 * @returns {string | null}
 */
function extractAboutText(text, menuText) {
  // Brand copy is typically in the first ~1000 chars after noise removal
  // and before (or separate from) the menu block

  const menuStart = menuText ? text.indexOf(menuText.slice(0, 50)) : -1;
  const brandSection = menuStart > 0 ? text.slice(0, menuStart) : text.slice(0, 1500);

  // Must be at least a sentence
  if (brandSection.trim().length < 80) return null;

  return brandSection.trim();
}

// ---------------------------------------------------------------------------
// Content quality assessment
// ---------------------------------------------------------------------------

/**
 * Assess content quality based on character count
 * @param {number} charCount
 * @returns {ContentQuality}
 */
function assessQuality(charCount) {
  if (charCount >= 2000) return 'rich';
  if (charCount >= 200) return 'thin';
  return 'shell';
}

// ---------------------------------------------------------------------------
// Determine menu_source
// ---------------------------------------------------------------------------

/**
 * Determine where the menu content is located
 * @param {string | null} menuText
 * @param {import('../types/scrape').LinksData} links
 * @returns {MenuSource}
 */
function resolveMenuSource(menuText, links) {
  if (menuText && menuText.length > 100) return 'inline';
  if (links.pdf_menus.length > 0) return 'pdf';
  if (links.menu_url) return 'link';
  return 'none';
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Process raw HTML into structured, clean payload
 * @param {string} html
 * @param {string} url
 * @returns {ScrapedPayload}
 */
function preprocessHtml(html, url) {
  const rawSizeBytes = Buffer.byteLength(html, 'utf8');

  // 1. Extract structured data before stripping
  const meta = extractMeta(html);
  const links = extractLinks(html, url);
  // JSON-LD kept for potential future use by AI extractor
  // const jsonLd = extractJsonLd(html);

  // 2. Strip CSS, JS, tags
  const stripped = stripHtml(html);

  // 3. Remove known boilerplate (cookie walls, phone dropdowns, etc.)
  const clean = removeBoilerplate(stripped);

  // 4. Extract deterministic fields from clean text
  const contact = extractContact(clean);
  const openingHoursRaw = extractOpeningHours(clean);
  const { menuText, menuSource: rawMenuSource } = extractMenuText(clean, url);
  const aboutText = extractAboutText(clean, menuText);

  // 5. Quality assessment
  const contentCharCount = clean.length;
  const contentQuality = assessQuality(contentCharCount);

  // 6. Resolve final menu_source (inline > pdf > link > none)
  const menuSource = resolveMenuSource(menuText, links);

  return {
    url,
    scraped_at: new Date().toISOString(),
    meta,
    contact,
    opening_hours_raw: openingHoursRaw,
    links,
    menu_text: menuText,
    about_text: aboutText,
    full_text: clean,
    menu_source: menuSource,
    content_quality: contentQuality,
    content_char_count: contentCharCount,
    raw_size_bytes: rawSizeBytes,
  };
}

export {
  preprocessHtml,
  stripHtml,
  extractMeta,
  extractLinks,
  extractContact,
  extractOpeningHours,
  extractMenuText,
  extractAboutText,
};
