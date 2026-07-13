/**
 * DOM Extractor - Phase 5e
 * 
 * Extract structured page document directly in browser context.
 * CRITICAL: All helpers (isVisible, clean, etc.) must be defined INSIDE page.evaluate()
 * as they use browser-only APIs like getBoundingClientRect().
 */

/**
 * Extract page document with links, blocks, meta, and structured data
 * @param {import('puppeteer').Page} page
 * @returns {Promise<PageDocument>}
 */
export async function extractPageDocument(page) {
  return page.evaluate(() => {
    // ========================================
    // Helper Functions (Browser Context Only)
    // ========================================

    const clean = value =>
      value?.replace(/\s+/g, ' ').trim() || null;

    const absoluteUrl = href => {
      try {
        return new URL(href, document.baseURI).href;
      } catch {
        return null;
      }
    };

    /**
     * CRITICAL: isVisible() uses getBoundingClientRect()
     * which only works in browser context
     */
    const isVisible = element => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();

      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity) !== 0 &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const getNearestHeading = element => {
      const section = element.closest(
        'section, article, main, aside, header, footer'
      );

      if (!section) {
        return null;
      }

      const heading = section.querySelector('h1, h2, h3, h4, h5, h6');
      return clean(heading?.innerText);
    };

    // ========================================
    // Extract Links
    // ========================================

    const links = [...document.querySelectorAll('a[href]')]
      .filter(isVisible)
      .map(anchor => {
        const container = anchor.closest(
          'section, article, main, nav, header, footer, address'
        );

        return {
          url: absoluteUrl(anchor.getAttribute('href')),
          original_href: anchor.getAttribute('href'),
          text: clean(anchor.innerText),
          aria_label: clean(anchor.getAttribute('aria-label')),
          title: clean(anchor.getAttribute('title')),
          section_heading: getNearestHeading(anchor),
          context: clean(container?.innerText)?.slice(0, 700) || null
        };
      })
      .filter(link => link.url);

    // ========================================
    // Extract Content Blocks
    // ========================================

    const blockSelector = [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'li', 'dt', 'dd',
      'address', 'time', 'table',
      'article', 'section'
    ].join(',');

    const blocks = [...document.querySelectorAll(blockSelector)]
      .filter(isVisible)
      .map(element => ({
        tag: element.tagName.toLowerCase(),
        text: clean(element.innerText),
        id: element.id || null,
        class_name:
          typeof element.className === 'string'
            ? element.className
            : null,
        section_heading: getNearestHeading(element)
      }))
      .filter(block => block.text && block.text.length >= 10);

    // ========================================
    // Extract Structured Data (JSON-LD)
    // ========================================

    const jsonLdRaw = [
      ...document.querySelectorAll('script[type="application/ld+json"]')
    ]
      .map(script => script.textContent?.trim())
      .filter(Boolean);

    // ========================================
    // Extract Meta Tags
    // ========================================

    const meta = [...document.querySelectorAll('meta')]
      .map(element => ({
        name:
          element.getAttribute('name') ||
          element.getAttribute('property') ||
          null,
        content: element.getAttribute('content') || null
      }))
      .filter(item => item.name && item.content);

    // ========================================
    // Return Page Document
    // ========================================

    return {
      title: clean(document.title),
      final_url: location.href,
      canonical_url:
        document.querySelector('link[rel="canonical"]')?.href || null,
      lang: document.documentElement?.lang || null,
      meta,
      links,
      blocks,
      json_ld_raw: jsonLdRaw
    };
  });
}
