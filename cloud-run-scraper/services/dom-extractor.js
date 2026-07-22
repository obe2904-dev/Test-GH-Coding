/**
 * DOM Extractor - Phase 5e
 * 
 * Extract structured page document directly in browser context.
 * CRITICAL: All helpers (isVisible, clean, etc.) must be defined INSIDE page.evaluate()
 * as they use browser-only APIs like getBoundingClientRect().
 */

// =====================================================
// Opening Hours Text Pattern Fallback
// =====================================================

const DANISH_DAYS = {
  // Danish day names (canonical output)
  mandag:    'Mandag',    man: 'Mandag',
  tirsdag:   'Tirsdag',  tir: 'Tirsdag',
  onsdag:    'Onsdag',   ons: 'Onsdag',
  torsdag:   'Torsdag',  tor: 'Torsdag',
  fredag:    'Fredag',   fre: 'Fredag',
  lørdag:    'Lørdag',   lør: 'Lørdag',   lor: 'Lørdag',
  søndag:    'Søndag',   søn: 'Søndag',   son: 'Søndag',
  // English day names (map to Danish canonical)
  monday:    'Mandag',    mon: 'Mandag',
  tuesday:   'Tirsdag',   tue: 'Tirsdag',   tues: 'Tirsdag',
  wednesday: 'Onsdag',    wed: 'Onsdag',
  thursday:  'Torsdag',   thu: 'Torsdag',   thur: 'Torsdag',   thurs: 'Torsdag',
  friday:    'Fredag',    fri: 'Fredag',
  saturday:  'Lørdag',    sat: 'Lørdag',
  sunday:    'Søndag',    sun: 'Søndag',
};

const DAY_ORDER = [
  'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'
];

/**
 * Normalise a raw time string to "HH:MM" format.
 * Handles: "17.30", "17:30", "17 30", "1730", "17", "2"
 */
function normaliseTime(raw) {
  if (!raw) return null;
  const s = raw.trim().replace(',', '.').replace(/[.,;!?]+$/, ''); // Strip trailing punctuation

  // Already HH:MM or H:MM
  const colonMatch = s.match(/^(\d{1,2}):(\d{2})$/);
  if (colonMatch) {
    return `${colonMatch[1].padStart(2, '0')}:${colonMatch[2]}`;
  }

  // Dot separator: 17.30 or 17.00
  const dotMatch = s.match(/^(\d{1,2})\.(\d{2})$/);
  if (dotMatch) {
    return `${dotMatch[1].padStart(2, '0')}:${dotMatch[2]}`;
  }

  // 4-digit compact: 1730
  const compactMatch = s.match(/^(\d{2})(\d{2})$/);
  if (compactMatch) {
    return `${compactMatch[1]}:${compactMatch[2]}`;
  }

  // Hour only: "17" or "2"
  const hourMatch = s.match(/^(\d{1,2})$/);
  if (hourMatch) {
    return `${hourMatch[1].padStart(2, '0')}:00`;
  }

  return null;
}

/**
 * Resolve a Danish day name or abbreviation to its canonical form.
 * Returns null if unrecognised.
 */
function resolveDay(raw) {
  if (!raw) return null;
  const key = raw.toLowerCase().trim()
    .replace(/ø/g, 'ø').replace(/æ/g, 'æ').replace(/å/g, 'å');
  return DANISH_DAYS[key] || null;
}

/**
 * Expand a day range ("Mandag til Torsdag" or "Man-Tor") to an array
 * of canonical day names.
 */
function expandDayRange(fromDay, toDay) {
  const from = DAY_ORDER.indexOf(fromDay);
  const to   = DAY_ORDER.indexOf(toDay);
  if (from === -1 || to === -1) return [];
  if (from <= to) return DAY_ORDER.slice(from, to + 1);
  // Wrapping range e.g. Fredag-Mandag — uncommon but handle it
  return [...DAY_ORDER.slice(from), ...DAY_ORDER.slice(0, to + 1)];
}

/**
 * Parse a raw time range string into { open, close } both in "HH:MM".
 * Handles separators: " - ", "–", " til ", "-"
 * Returns null if parsing fails.
 */
function parseTimeRange(raw) {
  if (!raw) return null;

  // Normalise separators
  const normalised = raw
    .replace(/\s*–\s*/g, ' - ')
    .replace(/\s+til\s+/gi, ' - ')
    .trim();

  const parts = normalised.split(/\s*-\s*/);
  if (parts.length < 2) return null;

  const open  = normaliseTime(parts[0].trim());
  const close = normaliseTime(parts[parts.length - 1].trim());

  if (!open || !close) return null;
  return { open, close };
}

/**
 * Parse a day expression into an array of canonical day names.
 * Handles single days, abbreviated ranges (Man-Fre), and "til" ranges.
 * @param {string} expr
 * @returns {string[]}
 */
function parseDayExpression(expr) {
  if (!expr) return [];
  const clean = expr.trim();

  // Range with "-", "–", or "til"
  const rangeMatch = clean.match(
    /^([a-zæøå]{3,8})\s*(?:-|–|til)\s*([a-zæøå]{3,8})$/i
  );
  if (rangeMatch) {
    const from = resolveDay(rangeMatch[1]);
    const to   = resolveDay(rangeMatch[2]);
    if (from && to) return expandDayRange(from, to);
  }

  // Single day
  const single = resolveDay(clean);
  if (single) return [single];

  return [];
}

/**
 * Extract opening hours candidates from freeform text blocks.
 *
 * Handles formats including:
 *   "Mandag - 17:00 - 23:00"
 *   "Torsdag: 11.30 - 23.30"
 *   "Åbent mandag til torsdag 17 til 23"
 *   "Lør-Søn 12-22"
 *   "Alle dage 11-22"
 *   "Lukket" / "Closed"
 *   "Man-Fre: 09.00-17.00, Lør-Søn: 10.00-15.00"
 *
 * @param {string} text - Raw text content from a content block
 * @returns {Array<{ day_text: string, time_text: string }>}
 */
export function extractOpeningHoursFromText(text) {
  if (!text || text.length < 5) return [];

  const candidates = [];

  // ── Pre-process: join orphaned time lines to preceding day line ───────────
  // Handles the common two-line format:
  //   "Mandag - Torsdag"   ← day line
  //   "11.30 - 23.30"      ← time line (no day context)
  // Joins them into: "Mandag - Torsdag 11.30 - 23.30"
  // so the existing pattern matchers work unchanged.
  const TIME_ONLY_LINE = /^\d{1,2}[.:]\d{2}\s*[-–]\s*\d{1,2}[.:]\d{2}$/;

  const rawLines = text
    .split(/[\n;]+/)
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => {
      // Strip common headers like "OPENING HOURS", "ÅBNINGSTIDER", etc.
      return l.replace(/^(opening hours?|åbningstider|öffnungszeiten|horaires?|hours?)[:\s]*/i, '').trim();
    })
    .filter(Boolean);

  const lines = [];
  for (let i = 0; i < rawLines.length; i++) {
    const current = rawLines[i];
    const next    = rawLines[i + 1] ?? '';

    if (TIME_ONLY_LINE.test(next)) {
      // Next line is a bare time range — merge it onto this line
      lines.push(`${current} ${next}`);
      i++; // consume the next line
    } else {
      lines.push(current);
    }
  }
  // ── End pre-process ───────────────────────────────────────────────────────

  console.log(`[Hours] Processing ${lines.length} lines:`, lines.slice(0, 5).map(l => `"${l}"`));

  for (const line of lines) {
    // --- Pattern: "Alle dage HH - HH" ---
    const allDaysMatch = line.match(
      /alle\s+dage\s+(\d[\d.:]*)\s*[-–]\s*(\d[\d.:]*)/i
    );
    if (allDaysMatch) {
      const open  = normaliseTime(allDaysMatch[1]);
      const close = normaliseTime(allDaysMatch[2]);
      if (open && close) {
        const timeText = `${open} - ${close}`;
        for (const day of DAY_ORDER) {
          candidates.push({ day_text: day, time_text: timeText });
        }
      }
      continue;
    }

    // --- Pattern: "Lukket" / "Closed" (whole line or after day name) ---
    const closedLineMatch = line.match(
      /^([a-zæøå]{3,8}(?:\s*[-–]\s*[a-zæøå]{3,8})?)\s*:?\s*(lukket|closed)$/i
    );
    if (closedLineMatch) {
      const dayRaw = closedLineMatch[1];
      const days   = parseDayExpression(dayRaw);
      for (const day of days) {
        candidates.push({ day_text: day, time_text: 'Lukket' });
      }
      continue;
    }

    // --- Pattern: day range + time range ---
    // e.g. "Man-Fre: 09.00 - 17.00"
    // e.g. "Mandag til torsdag 17 til 23"
    // e.g. "Torsdag: 11.30 - 23.30"
    // e.g. "Mandag - 17:00 - 23:00"  (day separator vs time separator)
    // e.g. "Monday - Thursday 11.30 - 23.30" (only capture first time range)
    const dayTimeMatch = line.match(
      /^([a-zæøå]{3,8}(?:\s*(?:til|-|–)\s*[a-zæøå]{3,8})?)\s*[:\-–]?\s*(\d[\d.:]*\s*(?:[-–]|til)\s*\d[\d.:]*)/i
    );
    if (dayTimeMatch) {
      const dayPart  = dayTimeMatch[1].trim();
      const timePart = dayTimeMatch[2].trim();
      console.log(`[Hours] Matched day+time: dayPart="${dayPart}", timePart="${timePart}"`);

      // Skip if dayPart doesn't look like a day name
      const days = parseDayExpression(dayPart);
      console.log(`[Hours] parseDayExpression("${dayPart}") → [${days.join(', ')}]`);
      if (days.length === 0) {
        console.log(`[Hours] ⚠️  No valid days parsed from "${dayPart}" - skipping line`);
        continue;
      }

      // Check for closed
      if (/lukket|closed/i.test(timePart)) {
        for (const day of days) {
          candidates.push({ day_text: day, time_text: 'Lukket' });
        }
        continue;
      }

      // Parse time range from remaining text
      // Handle "17 til 23" format
      const tilNormalisedTime = timePart.replace(
        /(\d[\d.:]*)\s+til\s+(\d[\d.:]*)/i,
        '$1 - $2'
      );

      const timeRange = parseTimeRange(tilNormalisedTime);
      if (timeRange) {
        const timeText = `${timeRange.open} - ${timeRange.close}`;
        for (const day of days) {
          candidates.push({ day_text: day, time_text: timeText });
        }
      }
    }
  }

  // Deduplicate: last write wins per day (later pages override earlier)
  const seen = new Map();
  for (const c of candidates) {
    seen.set(c.day_text, c);
  }

  // Return in DAY_ORDER
  return DAY_ORDER
    .filter(d => seen.has(d))
    .map(d => seen.get(d));
}

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

    const semanticContainerSelector = [
      'header', 'nav', 'main', 'footer', 'aside', 'address', 'details'
    ].join(',');

    const semanticBlocks = [...document.querySelectorAll(semanticContainerSelector)]
      .filter(isVisible)
      .map(element => ({
        tag: element.tagName.toLowerCase(),
        text: clean(element.innerText),
        id: element.id || null,
        class_name:
          typeof element.className === 'string'
            ? element.className
            : null,
        section_heading: getNearestHeading(element),
        semantic_area: element.tagName.toLowerCase()
      }))
      .filter(block => block.text && block.text.length >= 20 && block.text.length <= 4000);

    const dedupedBlocks = [];
    const blockSeen = new Set();
    for (const block of [...blocks, ...semanticBlocks]) {
      const key = `${block.tag}|${block.section_heading || ''}|${block.text}`;
      if (blockSeen.has(key)) continue;
      blockSeen.add(key);
      dedupedBlocks.push(block);
    }

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
      blocks: dedupedBlocks,
      json_ld_raw: jsonLdRaw,
      opening_hours_structured,
      kitchen_close_time: null // Extracted separately in Node context
    };
  });
}

/**
 * Extract kitchen closing time from page text
 * Matches patterns like:
 * - "Køkkenet er åbent frem til kl. 21"
 * - "Køkken lukker 22:00"
 * - "Kitchen closes at 10pm"
 */
export function extractKitchenCloseTime(pageDoc) {
  if (!pageDoc?.blocks) return null;
  
  // Collect all text from blocks
  const allText = pageDoc.blocks.map(b => b.text).join(' ').toLowerCase();
  
  // Patterns for kitchen closing time
  const patterns = [
    /køkken[^.]*?lukker[^.]*?(\d{1,2}[:.\s]?\d{0,2})/i,
    /køkken[^.]*?(\d{1,2}[:.\s]?\d{0,2})[^.]*?lukker/i,
    /kitchen[^.]*?close[^.]*?(\d{1,2}[:.\s]?\d{0,2})/i,
    /køkken(?:et)?[^.]*?(?:åbent\s+frem\s+til|open\s+until|åben\s+til|frem\s+til)\s*(?:kl\.?\s*)?(\d{1,2}(?:[:.]\d{2})?)/i,
    /køkken[^.]*?:(.*?\d{1,2}[:.\s]?\d{0,2})[^.]{0,30}/i,
  ];

  for (const pattern of patterns) {
    const match = allText.match(pattern);
    if (match && match[1]) {
      // Extract just the time portion
      const timeMatch = match[1].match(/\d{1,2}[:.\s]?\d{0,2}/);
      if (timeMatch) {
        const raw = timeMatch[0].replace(/\s+/g, '').replace('.', ':');
        // Normalize to HH:MM
        const normalized = normaliseTime(raw);
        if (normalized) {
          return normalized;
        }
      }
    }
  }

  return null;
}
