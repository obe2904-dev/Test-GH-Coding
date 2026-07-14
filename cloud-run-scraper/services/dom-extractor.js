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
    // Extract Opening Hours (Structured)
    // ========================================

    const extractOpeningHours = () => {
      const pairs = [];
      
      // Find sections containing opening hours keywords
      const hoursKeywords = ['åbningstider', 'opening hours', 'öffnungszeiten', 'horaires'];
      const allElements = [...document.querySelectorAll('*')];
      
      const hoursContainers = allElements.filter(el => {
        const text = (el.textContent || '').toLowerCase();
        return hoursKeywords.some(kw => text.includes(kw)) && text.length < 500;
      });

      for (const container of hoursContainers) {
        if (!container) continue;
        
        // Strategy 1: Table rows (tr)
        const tableRows = container.querySelectorAll ? [...(container.querySelectorAll('tr') || [])].filter(isVisible) : [];
        if (tableRows.length > 0) {
          for (const row of tableRows) {
            const cells = row.querySelectorAll ? [...(row.querySelectorAll('td, th') || [])].filter(isVisible) : [];
            if (cells.length >= 2) {
              const dayText = clean(cells[0]?.innerText);
              const timeText = clean(cells[1]?.innerText);
              if (dayText && timeText && /\d{1,2}[:.]\d{2}/.test(timeText)) {
                pairs.push({ day_text: dayText, time_text: timeText, structure: 'table' });
              }
            }
          }
        }

        // Strategy 2: Definition lists (dt/dd pairs)
        const dts = container.querySelectorAll ? [...(container.querySelectorAll('dt') || [])].filter(isVisible) : [];
        if (dts.length > 0) {
          for (const dt of dts) {
            const dd = dt.nextElementSibling;
            if (dd && dd.tagName === 'DD') {
              const dayText = clean(dt?.innerText);
              const timeText = clean(dd?.innerText);
              if (dayText && timeText && /\d{1,2}[:.]\d{2}/.test(timeText)) {
                pairs.push({ day_text: dayText, time_text: timeText, structure: 'dl' });
              }
            }
          }
        }

        // Strategy 3: List items with day + time pattern
        const listItems = container.querySelectorAll ? [...(container.querySelectorAll('li') || [])].filter(isVisible) : [];
        if (listItems.length > 0) {
          for (const li of listItems) {
            const text = clean(li?.innerText);
            if (!text) continue;
            // Match patterns like "Monday: 10:00 - 18:00" or "Mandag - Torsdag 11.30 - 23.30"
            const match = text.match(/^([^:0-9]+?)[\s:-]+(.+)$/);
            if (match && /\d{1,2}[:.]\d{2}/.test(match[2])) {
              pairs.push({ day_text: match[1].trim(), time_text: match[2].trim(), structure: 'list' });
            }
          }
        }

        // Strategy 4: Repeated sibling divs/spans (common in modern layouts)
        const children = container.children ? [...(container.children || [])].filter(isVisible) : [];
        if (children.length >= 3 && children.length <= 10) {
          for (const child of children) {
            const childText = clean(child?.innerText);
            if (childText && childText.length < 100) {
              // Look for inline structure: <span>Monday</span> <span>10:00 - 18:00</span>
              const spans = child.querySelectorAll ? [...(child.querySelectorAll('span, div, p') || [])].filter(isVisible) : [];
              if (spans.length >= 2) {
                const dayText = clean(spans[0]?.innerText);
                const timeText = clean(spans[1]?.innerText);
                if (dayText && timeText && /\d{1,2}[:.]\d{2}/.test(timeText)) {
                  pairs.push({ day_text: dayText, time_text: timeText, structure: 'div' });
                }
              } else {
                // Single element with day: time pattern
                const match = childText.match(/^([^:0-9]+?)[\s:-]+(.+)$/);
                if (match && /\d{1,2}[:.]\d{2}/.test(match[2])) {
                  pairs.push({ day_text: match[1].trim(), time_text: match[2].trim(), structure: 'div' });
                }
              }
            }
          }
        }

        // Strategy 5: Plain text parsing (fallback for unstructured hours)
        if (pairs.length === 0) {
          const fullText = clean(container?.innerText);
          if (fullText) {
            // Match patterns like "Mandag 15 - 22" or "Mandag kl. 09.30 – 23.00"
            // This regex finds day names followed by time patterns
            // Supports: hours only (15-22), hours+minutes (09.30-23.00), mixed separators (til/to/-)
            // Explicitly handle "kl." or "kl" prefix before times
            const dayPattern = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag|man|tir|ons|tor|fre|lør|søn)(?:\s+kl\.?)?\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:[-–—]|til|to)\s*\d{1,2}(?:[:.]\d{2})?)/gi;
            const matches = [...fullText.matchAll(dayPattern)];
            
            for (const match of matches) {
              pairs.push({ 
                day_text: match[1].trim(), 
                time_text: match[2].trim(), 
                structure: 'text' 
              });
            }
          }
        }

        // If we found pairs in this container, stop looking
        if (pairs.length > 0) break;
      }

      return pairs.length > 0 ? pairs : null;
    };

    const opening_hours_structured = extractOpeningHours();

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
      json_ld_raw: jsonLdRaw,
      opening_hours_structured
    };
  });
}
