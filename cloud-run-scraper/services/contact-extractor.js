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
 * Extract Danish address from page blocks using pattern matching.
 * Simple approach: match permissively, clean post-extraction.
 */
function extractAddressFromBlocks(pageDoc) {
  const blocks = pageDoc?.blocks || [];
  if (!blocks.length) return null;

  // Simple pattern that works: Street Number, PostalCode City
  const fullPattern = /([A-ZÆØÅ][a-zæøåA-ZÆØÅ\s]+\s+\d+[A-Za-z]?)[,\s]+(\d{4})\s+([A-ZÆØÅ][a-zæøåA-ZÆØÅ\s]+)/;

  for (const block of blocks) {
    const text = block.text?.trim() || '';
    const match = text.match(fullPattern);
    
    if (match) {
      const [, street, postal, city] = match;
      let address = `${street.trim()} ${postal} ${city.trim()}`;
      
      // Clean garbage: leading single letter from "A/S Streetname" 
      address = address.replace(/^[A-Z]\s+/, '');
      
      // Clean garbage: trailing contact keywords
      address = address.replace(/\s+(Tlf|Tel|E-mail|CVR|Se vejkort|Åbningstider).*$/i, '');
      
      console.log(`[extractAddress] Found: "${address}"`);
      return {
        value: address,
        confidence: 0.99,
        source_type: 'homepage_block_pattern',
        source_url: pageDoc.final_url,
        evidence: `Block: ${text}`
      };
    }
  }

  return null;
}

/**
 * Extract contact information from page document
 * @param {object} pageDoc - From extractPageDocument()
 * @returns {Promise<object>} Contact candidates with evidence
 */
export async function extractContact(pageDoc) {
  const emails = extractEmails(pageDoc);
  const phones = extractPhones(pageDoc);
  const addresses = await extractAddresses(pageDoc);

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
 * Priority: 1) tel: links, 2) JSON-LD, 3) footer/contact text, 4) general text
 */
function extractPhones(pageDoc) {
  const candidates = [];

  // Priority 1: tel: links (highest confidence)
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

  // Priority 2: JSON-LD structured data
  if (pageDoc.json_ld_raw && Array.isArray(pageDoc.json_ld_raw)) {
    for (const jsonStr of pageDoc.json_ld_raw) {
      try {
        const data = JSON.parse(jsonStr);
        const items = Array.isArray(data) ? data : [data];
        
        for (const item of items) {
          const phone = item.telephone || item.phone;
          if (phone && typeof phone === 'string') {
            const normalized = normalizePhone(phone);
            if (normalized) {
              candidates.push({
                value: normalized,
                confidence: 0.95,
                source_type: 'json_ld',
                source_url: pageDoc.final_url,
                evidence: `JSON-LD: ${phone}`
              });
            }
          }
        }
      } catch (e) {
        // Skip malformed JSON-LD
      }
    }
  }

  // Priority 3: Footer/contact section text (high confidence for structured areas)
  for (const block of pageDoc.blocks) {
    const lowerText = block.text.toLowerCase();
    const isFooterOrContact = 
      lowerText.includes('kontakt') ||
      lowerText.includes('contact') ||
      lowerText.includes('footer') ||
      block.section_heading?.toLowerCase().includes('kontakt') ||
      block.section_heading?.toLowerCase().includes('contact');
    
    if (isFooterOrContact) {
      // Danish phone patterns with context
      // FIX: Added dot (.) to character class to handle "Tlf.:" style
      // FIX: Added space-separated pattern for "86 19 07 06" style
      const phonePatterns = [
        /(?:tlf|tel|telefon|phone|mobil|ring)[\s:.]*\+?45[\s-]*\d{2}[\s-]*\d{2}[\s-]*\d{2}[\s-]*\d{2}/gi,
        /(?:tlf|tel|telefon|phone|mobil|ring)[\s:.]*\d{2}[\s-]*\d{2}[\s-]*\d{2}[\s-]*\d{2}/gi,
        /\b\d{2}\s+\d{2}\s+\d{2}\s+\d{2}\b/g,
        /\+45[\s-]*\d{2}[\s-]*\d{2}[\s-]*\d{2}[\s-]*\d{2}/g,
        /\b\d{8}\b/g
      ];

      for (const pattern of phonePatterns) {
        const matches = block.text.matchAll(pattern);
        for (const match of matches) {
          const phone = match[1] || match[0];
          
          // Skip if looks like time or date
          if (phone.includes(':') || phone.includes('.') || phone.includes('-')) continue;
          
          const normalized = normalizePhone(phone);
          if (normalized) {
            candidates.push({
              value: normalized,
              confidence: 0.90,
              source_type: 'footer_contact_text',
              source_url: pageDoc.final_url,
              evidence: block.text.slice(Math.max(0, match.index - 20), match.index + phone.length + 20)
            });
          }
        }
      }
    }
  }

  // Priority 4: Danish phone patterns in general text (lowest confidence)
  // Patterns: +45 32 27 41 43, 32 27 41 43, +4532274143
  // CRITICAL: Avoid matching opening hours (11.30-23.30) or dates
  const generalPhonePatterns = [
    /\+45\s*\d{2}\s*\d{2}\s*\d{2}\s*\d{2}/g,  // +45 32 27 41 43
    /(?:tlf|tel|telefon|phone|mobil)[\s:]*\+?\d{2}\s*\d{2}\s*\d{2}\s*\d{2}/gi,  // "Tel: 32 27 41 43"
    /\b\d{8}\b/g  // 32274143 (8 consecutive digits, word boundaries to avoid years/times)
  ];

  for (const block of pageDoc.blocks) {
    // Skip if already found in footer/contact for this block
    const lowerText = block.text.toLowerCase();
    const isFooterOrContact = 
      lowerText.includes('kontakt') ||
      lowerText.includes('contact') ||
      lowerText.includes('footer');
    
    if (isFooterOrContact) continue; // Already handled in Priority 3

    for (const pattern of generalPhonePatterns) {
      const matches = block.text.matchAll(pattern);
      for (const match of matches) {
        const phone = match[1] || match[0];
        
        // Skip if looks like time or date
        if (phone.includes(':') || phone.includes('.') || phone.includes('-')) continue;
        
        // Skip if in context of opening hours
        const context = block.text.slice(Math.max(0, match.index - 30), match.index + phone.length + 30).toLowerCase();
        if (/åbningstider|opening|hours|mandag|monday|tirdag|tuesday|onsdag|wednesday|torsdag|thursday|fredag|friday|lørdag|saturday|søndag|sunday/.test(context)) {
          continue;
        }
        
        const normalized = normalizePhone(phone);
        if (normalized) {
          candidates.push({
            value: normalized,
            confidence: 0.80,
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
 * Extract addresses using AI (primary method)
 * Handles all Danish address formats naturally without regex edge cases
 */
async function extractAddressesWithAI(pageDoc) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    console.warn('[Address AI] GEMINI_API_KEY not set, skipping AI extraction');
    return [];
  }

  // Collect relevant text blocks (prioritize address tags and blocks with numbers)
  const relevantBlocks = pageDoc.blocks
    .filter(b => 
      b.tag === 'address' ||
      /\d/.test(b.text) || // Contains any digit
      (b.section_heading && /kontakt|adresse|info|footer/i.test(b.section_heading))
    )
    .slice(0, 30) // Increased limit
    .map(b => b.text)
    .join('\n\n');

  console.log(`[Address AI] Collected ${relevantBlocks.length} chars from ${pageDoc.blocks.length} total blocks`);

  if (!relevantBlocks || relevantBlocks.length < 10) {
    console.log('[Address AI] No relevant text found for extraction');
    return [];
  }

  const prompt = `Du er en dansk adresse-ekstraktor. Find fysiske adresser i følgende tekst.

TEKST:
${relevantBlocks}

REGLER:
- En dansk adresse har vejnavn + nummer + postnummer (4 cifre) + by
- Returner KUN faktiske fysiske adresser (ikke links, telefonnumre, emails)
- Returner adresser i format: "Vejnavn Nummer, Postnummer By"
- Hvis ingen adresse findes, returner tomt array

Returner JSON array med fundne adresser:
{"addresses": ["Åboulevarden 38, 8000 Aarhus C"]}`;

  // Prompt sanity check before calling API
  const promptIssues = [];
  if (prompt.includes('undefined')) promptIssues.push('prompt contains literal "undefined"');
  if (prompt.includes('null') && (prompt.match(/\bnull\b/g)?.length || 0) > 2) promptIssues.push('prompt contains multiple nulls');
  if (prompt.length < 50) promptIssues.push(`prompt suspiciously short: ${prompt.length} chars`);
  if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === '') promptIssues.push('API key is empty');

  if (promptIssues.length > 0) {
    console.error('[Address AI] Prompt issues detected:', promptIssues);
    console.error('[Address AI] Prompt preview:', prompt.slice(0, 300));
  }

  try {
    console.log('[Address AI] Calling Gemini API...');
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1, // Low temperature for factual extraction
            maxOutputTokens: 256,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Address AI] Gemini API error details:', JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        promptLength: prompt.length,
        promptPreview: prompt.slice(0, 200),
        model: 'gemini-2.0-flash-exp'
      }, null, 2));
      return [];
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    
    console.log('[Address AI] Gemini response:', responseText.substring(0, 200));
    
    // Extract JSON from markdown code blocks if present
    let jsonText = responseText.trim()
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();

    const parsed = JSON.parse(jsonText);
    const addresses = parsed.addresses || [];

    console.log(`[Address AI] Parsed ${addresses.length} addresses:`, addresses);

    return addresses
      .filter(addr => addr && containsPostalCode(addr))
      .map(addr => ({
        value: addr.trim(),
        confidence: 0.92,
        source_type: 'ai_extraction',
        source_url: pageDoc.final_url,
        evidence: 'AI-extracted from page content'
      }));

  } catch (error) {
    console.error('[Address AI] Extraction failed:', error.message, error.stack);
    return [];
  }
}

/**
 * Extract addresses
 * Uses AI extraction as primary method with regex fallback
 */
async function extractAddresses(pageDoc) {
  const candidates = [];

  // Priority 0: Deterministic block pattern extraction (homepage blocks)
  // This works even when /kontakt/ page fails to render
  const blockAddress = extractAddressFromBlocks(pageDoc);
  if (blockAddress) {
    console.log(`[extractAddresses] Address from blocks: "${blockAddress.value}"`);
    candidates.push(blockAddress);
    // Return immediately if found - no need for AI/regex fallback
    return deduplicateCandidates(candidates);
  }

  // Priority 1: AI extraction (handles all Danish address formats)
  const aiAddresses = await extractAddressesWithAI(pageDoc);
  candidates.push(...aiAddresses);

  // If AI found addresses, return them
  if (candidates.length > 0) {
    return deduplicateCandidates(candidates);
  }

  // Fallback: Regex-based extraction

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
  // FIX: Allow Danish definite article suffixes (-en, -et, -ne, -erne) after street types
  const postalPattern = /\b\d{4}\s+[A-ZÆØÅa-zæøå]+(?:\s+[A-ZÆØÅa-zæøå]+)?\b/;
  const streetPattern = /[A-ZÆØÅ][a-zæøå]+(?:vej|vænget|gade|boulevard|alle|allé|stræde|torv|plads|gården)(?:en|et|ne|erne)?\s+\d+[A-Za-z]?/;

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

  // Priority 3: Google Maps link text OR query parameter
  const mapsLinks = pageDoc.links.filter(link => isGoogleMapsLink(link.url));
  
  for (const link of mapsLinks) {
    // Try link text first
    if (link.text && containsPostalCode(link.text)) {
      const cleaned = cleanAddress(link.text);
      if (cleaned) {
        candidates.push({
          value: cleaned,
          confidence: 0.98,
          source_type: 'google_maps_link_text',
          source_url: pageDoc.final_url,
          evidence: link.text
        });
      }
    }
    
    // Fallback: Parse address from Maps URL query parameter
    try {
      const decoded = decodeHtmlEntities(link.url);
      const url = new URL(decoded);
      const query = url.searchParams.get('query') || url.searchParams.get('q');
      if (query && containsPostalCode(query)) {
        const cleaned = cleanAddress(query);
        if (cleaned) {
          candidates.push({
            value: cleaned,
            confidence: 0.95,
            source_type: 'google_maps_url_query',
            source_url: pageDoc.final_url,
            evidence: `Maps query: ${query}`
          });
        }
      }
    } catch (e) {
      // Invalid URL, skip
    }
  }

  return deduplicateCandidates(candidates);
}

/**
 * Decode HTML entities in URL (handles &#038; -> &)
 */
function decodeHtmlEntities(url) {
  if (!url) return url;
  return url
    .replace(/&#038;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&#x26;/g, '&');
}

/**
 * Check if URL is a Google Maps link (matches classifier logic)
 */
function isGoogleMapsLink(urlString) {
  if (!urlString) return false;
  try {
    const decoded = decodeHtmlEntities(urlString);
    const url = new URL(decoded);
    const host = url.hostname.toLowerCase();
    return (
      host === 'maps.google.com' ||
      host === 'www.google.com' && url.pathname.startsWith('/maps') ||
      host === 'google.com' && url.pathname.startsWith('/maps') ||
      host === 'maps.app.goo.gl' ||
      (host === 'goo.gl' && url.pathname.startsWith('/maps')) ||
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
