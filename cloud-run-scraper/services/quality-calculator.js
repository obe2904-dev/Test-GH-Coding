/**
 * Quality Calculator
 * 
 * Calculate extraction quality based on:
 * - Business fields found
 * - Noise ratio
 * NOT based on character count (v2 mistake)
 */

/**
 * Calculate quality rating
 * @param {object} extraction - Full extraction result
 * @returns {object} Quality rating with diagnostics
 */
export function calculateQuality(extraction) {
  const fieldsFound = countFieldsFound(extraction);
  const fieldsExpected = 8; // name, contact, address, phone, email, hours, menu, booking

  // Calculate noise ratio
  const noiseAnalysis = analyzeNoiseRatio(extraction);

  // Determine rating based on thresholds
  const rating = determineRating(fieldsFound, fieldsExpected, noiseAnalysis.ratio);

  // Collect warnings
  const warnings = [];
  if (noiseAnalysis.ratio > 0.6) {
    warnings.push('Cookie/tracking content dominates extracted text');
  }
  if (!extraction.business?.name) {
    warnings.push('Business name not extracted');
  }
  if (extraction.contact.emails.length === 0 && extraction.contact.phones.length === 0) {
    warnings.push('No contact information extracted');
  }
  if (!extraction.services.booking && !extraction.services.menu) {
    warnings.push('No booking or menu link found');
  }

  return {
    rating,
    business_text_characters: noiseAnalysis.businessChars,
    noise_text_characters: noiseAnalysis.noiseChars,
    noise_ratio: noiseAnalysis.ratio,
    fields_found: fieldsFound,
    fields_expected: fieldsExpected,
    warnings
  };
}

/**
 * Count how many expected fields were found
 */
function countFieldsFound(extraction) {
  let count = 0;

  // Business name
  if (extraction.business?.name) count++;

  // Description/about
  if (extraction.business?.description || extraction.content_sections?.some(s => s.type === 'about')) count++;

  // Contact email
  if (extraction.contact.emails.length > 0) count++;

  // Contact phone
  if (extraction.contact.phones.length > 0) count++;

  // Address
  if (extraction.contact.addresses.length > 0) count++;

  // Opening hours
  if (extraction.opening_hours?.value) count++;

  // Menu
  if (extraction.services.menu) count++;

  // Booking
  if (extraction.services.booking) count++;

  return count;
}

/**
 * Analyze noise vs business content ratio
 */
function analyzeNoiseRatio(extraction) {
  const noiseTerms = [
    'cookie',
    'cookies',
    'privatlivspolitik',
    'privacy policy',
    'google analytics',
    'microsoft clarity',
    'klaviyo',
    'hubspot',
    'marketing cookies',
    'tracking',
    'consent',
    'gdpr',
    'terms of service',
    'vilkår og betingelser'
  ];

  let businessChars = 0;
  let noiseChars = 0;

  // Analyze content sections
  for (const section of (extraction.content_sections || [])) {
    const text = section.text || '';
    const lowerText = text.toLowerCase();
    
    // Check if section is mainly noise
    const noiseScore = noiseTerms.reduce((score, term) => {
      const count = (lowerText.match(new RegExp(term, 'g')) || []).length;
      return score + count;
    }, 0);

    if (noiseScore > 3) {
      // High noise density
      noiseChars += text.length;
    } else {
      businessChars += text.length;
    }
  }

  const totalChars = businessChars + noiseChars;
  const ratio = totalChars > 0 ? noiseChars / totalChars : 0;

  return {
    businessChars,
    noiseChars,
    ratio: Math.round(ratio * 100) / 100
  };
}

/**
 * Determine rating based on thresholds
 * 
 * Rating Thresholds:
 * - excellent: name + description + contact + opening hours + menu or booking found; noise < 0.2
 * - good: name + contact + opening hours found; noise < 0.4
 * - partial: name found; >= 3 other fields found; noise < 0.6
 * - poor: name found but < 3 other fields; or noise > 0.6
 * - failed: fetch failed; or name not found and noise > 0.8
 */
function determineRating(fieldsFound, fieldsExpected, noiseRatio) {
  // Failed
  if (fieldsFound === 0 || (fieldsFound < 2 && noiseRatio > 0.8)) {
    return 'failed';
  }

  // Poor
  if (fieldsFound < 3 || noiseRatio > 0.6) {
    return 'poor';
  }

  // Partial
  if (fieldsFound >= 3 && fieldsFound < 6 && noiseRatio < 0.6) {
    return 'partial';
  }

  // Good
  if (fieldsFound >= 6 && noiseRatio < 0.4) {
    return 'good';
  }

  // Excellent
  if (fieldsFound >= 7 && noiseRatio < 0.2) {
    return 'excellent';
  }

  // Default to partial
  return 'partial';
}

/**
 * Determine if page should continue crawling
 * Conservative threshold: Continue if fields < 6 OR noise >= 0.4
 */
export function shouldContinueCrawling(quality) {
  return quality.fields_found < 6 || quality.noise_ratio >= 0.4;
}
