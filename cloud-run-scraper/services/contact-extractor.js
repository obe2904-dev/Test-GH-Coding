/**
 * Contact Extraction
 * 
 * Extract email, phone, and address with evidence and confidence
 * Priority order:
 * 1. Structured data (mailto:, tel:, JSON-LD)
 * 2. Visible patterns
 * 3. Contact/footer blocks
 */

/**
 * Extract contact information from page document
 * @param {object} pageDoc - From extractPageDocument()
 * @returns {object} Contact candidates with evidence
 */
export function extractContact(pageDoc) {
  const emails = extractEmails(pageDoc);
  const phones = extractPhones(pageDoc);
  const addresses = extractAddresses(pageDoc);

  return {
    emails,
    phones,
    addresses
  };
}

/**
 * Extract email addresses
 */
function extractEmails(pageDoc) {
  const candidates = [];

  // Priority 1: mailto: links
  for (const link of pageDoc.links) {
    if (link.url?.startsWith('mailto:')) {
      const email = link.url.replace('mailto:', '').split('?')[0].trim();
      if (isValidEmail(email)) {
        candidates.push({
          value: email,
          confidence: 0.99,
          source_type: 'mailto_link',
          source_url: pageDoc.final_url,
          evidence: link.url
        });
      }
    }
  }

  // Priority 2: Visible email patterns in text blocks
  const emailPattern = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;

  for (const block of pageDoc.blocks) {
    const matches = block.text.matchAll(emailPattern);
    for (const match of matches) {
      const email = match[0].toLowerCase();
      if (isValidEmail(email) && !isCommonNoiseEmail(email)) {
        candidates.push({
          value: email,
          confidence: 0.90,
          source_type: 'visible_text',
          source_url: pageDoc.final_url,
          evidence: block.text.slice(Math.max(0, match.index - 20), match.index + email.length + 20)
        });
      }
    }
  }

  // Deduplicate by value, keep highest confidence
  return deduplicateCandidates(candidates);
}

/**
 * Extract phone numbers (Danish 8-digit format)
 */
function extractPhones(pageDoc) {
  const candidates = [];

  // Priority 1: tel: links
  for (const link of pageDoc.links) {
    if (link.url?.startsWith('tel:')) {
      const phone = link.url.replace('tel:', '').trim();
      const normalized = normalizePhone(phone);
      if (normalized) {
        candidates.push({
          value: normalized,
          confidence: 0.99,
          source_type: 'tel_link',
          source_url: pageDoc.final_url,
          evidence: link.url
        });
      }
    }
  }

  // Priority 2: Danish phone patterns in text
  // Patterns: +45 32 27 41 43, 32 27 41 43, +4532274143
  // CRITICAL: Avoid matching opening hours (11.30-23.30) or dates
  const phonePatterns = [
    /\+45\s*\d{2}\s*\d{2}\s*\d{2}\s*\d{2}/g,  // +45 32 27 41 43
    /(?:tlf|tel|phone|mobil)[\s:]*\+?\d{2}\s*\d{2}\s*\d{2}\s*\d{2}/gi,  // "Tel: 32 27 41 43"
    /\b\d{8}\b/g  // 32274143 (8 consecutive digits, word boundaries to avoid years/times)
  ];

  for (const block of pageDoc.blocks) {
    for (const pattern of phonePatterns) {
      const matches = block.text.matchAll(pattern);
      for (const match of matches) {
        const phone = match[0];
        
        // Skip if looks like time (contains : or .)
        if (phone.includes(':') || phone.includes('.')) continue;
        
        // Skip if in context of opening hours
        const context = block.text.slice(Math.max(0, match.index - 30), match.index + phone.length + 30).toLowerCase();
        if (/åbningstider|opening|hours|mandag|monday|tirdag|tuesday|onsdag|wednesday|torsdag|thursday|fredag|friday|lørdag|saturday|søndag|sunday/.test(context)) {
          continue;
        }
        
        const normalized = normalizePhone(phone);
        if (normalized) {
          candidates.push({
            value: normalized,
            confidence: 0.85,
            source_type: 'visible_text',
            source_url: pageDoc.final_url,
            evidence: block.text.slice(Math.max(0, match.index - 20), match.index + phone.length + 20)
          });
        }
      }
    }
  }

  return deduplicateCandidates(candidates);
}

/**
 * Extract addresses
 * CRITICAL: Handle multi-node address concatenation properly
 * Input: ["Åboulevarden 32", "8000 Aarhus C"]
 * Expected: "Åboulevarden 32, 8000 Aarhus C"
 * NOT: "Åboulevarden 328000 Aarhus C"
 */
function extractAddresses(pageDoc) {
  const candidates = [];

  // Priority 1: <address> elements
  const addressBlocks = pageDoc.blocks.filter(b => b.tag === 'address');
  for (const block of addressBlocks) {
    const cleaned = cleanAddress(block.text);
    if (cleaned && containsPostalCode(cleaned)) {
      candidates.push({
        value: cleaned,
        confidence: 0.95,
        source_type: 'address_tag',
        source_url: pageDoc.final_url,
        evidence: block.text
      });
    }
  }

  // Priority 2: Postal code + street patterns
  const postalPattern = /\b\d{4}\s+[A-ZÆØÅa-zæøå]+(?:\s+[A-ZÆØÅa-zæøå]+)?\b/;
  const streetPattern = /[A-ZÆØÅ][a-zæøå]+(?:vej|vænget|gade|boulevard|alle|stræde|torv|plads|vej|gården)\s+\d+[A-Za-z]?/;

  for (const block of pageDoc.blocks) {
    const text = block.text;

    // Look for pattern: Street + Postal Code
    if (streetPattern.test(text) && postalPattern.test(text)) {
      const cleaned = cleanAddress(text);
      if (cleaned) {
        candidates.push({
          value: cleaned,
          confidence: 0.85,
          source_type: 'text_pattern',
          source_url: pageDoc.final_url,
          evidence: text
        });
      }
    }
  }

  // Priority 3: Google Maps link text (use same detection as classifier)
  const mapsLinks = pageDoc.links.filter(link => isGoogleMapsLink(link.url));
  
  for (const link of mapsLinks) {
    if (link.text && containsPostalCode(link.text)) {
      const cleaned = cleanAddress(link.text);
      if (cleaned) {
        candidates.push({
          value: cleaned,
          confidence: 0.98,  // High confidence - Maps links usually have accurate addresses
          source_type: 'google_maps_link_text',
          source_url: pageDoc.final_url,
          evidence: link.text
        });
      }
    }
  }

  return deduplicateCandidates(candidates);
}

/**
 * Check if URL is a Google Maps link (matches classifier logic)
 */
function isGoogleMapsLink(urlString) {
  if (!urlString) return false;
  try {
    const url = new URL(urlString);
    const host = url.hostname.toLowerCase();
    return (
      host === 'maps.google.com' ||
      host === 'maps.app.goo.gl' ||
      (host === 'goo.gl' && url.pathname.startsWith('/maps')) ||
      (host === 'google.com' && url.pathname.startsWith('/maps')) ||
      host.includes('maps.google')  // Catch maps.google.dk, maps.google.co.uk, etc.
    );
  } catch {
    return false;
  }
}

/**
 * Clean and normalize address
 * CRITICAL: Join multi-line addresses with ", " not direct concatenation
 */
function cleanAddress(text) {
  if (!text) return null;

  // Split on line breaks and whitespace boundaries
  const parts = text
    .split(/[\n\r]+/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  // Join with comma-space
  const joined = parts.join(', ');

  // Remove extra commas
  return joined.replace(/,\s*,/g, ',').trim();
}

/**
 * Check if text contains Danish postal code
 */
function containsPostalCode(text) {
  return /\b\d{4}\s+[A-ZÆØÅa-zæøå]/.test(text);
}

/**
 * Normalize phone number to +45 XX XX XX XX format
 */
function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');

  // Danish numbers: 8 digits
  if (digits.length === 8) {
    return `+45 ${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)}`;
  }

  // With country code: 10 digits (45 + 8)
  if (digits.length === 10 && digits.startsWith('45')) {
    const local = digits.slice(2);
    return `+45 ${local.slice(0, 2)} ${local.slice(2, 4)} ${local.slice(4, 6)} ${local.slice(6, 8)}`;
  }

  return null;
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

/**
 * Filter out common noise emails
 */
function isCommonNoiseEmail(email) {
  const noiseDomains = ['example.com', 'test.com', 'sentry.io', 'bugsnag.com'];
  return noiseDomains.some(domain => email.endsWith('@' + domain));
}

/**
 * Deduplicate candidates, keep highest confidence
 */
function deduplicateCandidates(candidates) {
  const byValue = new Map();

  for (const candidate of candidates) {
    const existing = byValue.get(candidate.value);
    if (!existing || candidate.confidence > existing.confidence) {
      byValue.set(candidate.value, candidate);
    }
  }

  return Array.from(byValue.values());
}
