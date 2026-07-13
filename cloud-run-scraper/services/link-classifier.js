/**
 * Link Classification Pipeline
 * 
 * Three stages:
 * A. Collect (done in dom-extractor.js)
 * B. Normalize
 * C. Classify (with exclusion-first logic)
 */

/**
 * Stage B: Normalize links
 * - Decode HTML entities
 * - Resolve relative URLs (already done by absoluteUrl)
 * - Remove tracking parameters
 * - Deduplicate
 */
export function normalizeLinks(links) {
  const normalized = links.map(link => ({
    ...link,
    url: normalizeUrl(link.url)
  }));

  // Deduplicate by URL
  const seen = new Set();
  return normalized.filter(link => {
    if (seen.has(link.url)) {
      return false;
    }
    seen.add(link.url);
    return true;
  });
}

/**
 * Normalize a single URL
 * - Decode HTML entities (&amp; → &)
 * - Remove tracking parameters
 */
function normalizeUrl(urlString) {
  try {
    // Decode HTML entities
    const decoded = urlString
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');

    const url = new URL(decoded);

    // Remove common tracking parameters
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
    trackingParams.forEach(param => url.searchParams.delete(param));

    return url.href;
  } catch {
    return urlString;
  }
}

/**
 * Stage C: Classify links
 * CRITICAL: Exclusion-first logic - check isExcludedBusinessLink BEFORE any positive scoring
 */
export function classifyLinks(links) {
  const classified = {
    booking: null,
    menu: null,
    takeaway: null,
    social_profiles: [],
    google_maps: null,
    food_inspection: null,
    unclassified: []
  };

  const candidates = {
    booking: [],
    menu: [],
    takeaway: [],
    social: [],
    maps: [],
    inspection: []
  };

  for (const link of links) {
    // ========================================
    // EXCLUSION FIRST
    // ========================================
    if (isExcludedBusinessLink(link)) {
      continue; // Skip entirely - don't add to any category
    }

    // ========================================
    // Classify by Type
    // ========================================

    // Google Maps
    if (isGoogleMapsUrl(link.url)) {
      candidates.maps.push({
        ...link,
        score: 100,
        type: 'maps'
      });
      continue;
    }

    // FindSmiley (Danish food inspection)
    if (link.url.toLowerCase().includes('findsmiley.dk')) {
      candidates.inspection.push({
        ...link,
        score: 100,
        type: 'food_inspection'
      });
      continue;
    }

    // Social profiles
    const socialPlatform = classifySocialProfile(link.url);
    if (socialPlatform) {
      candidates.social.push({
        ...link,
        score: 100,
        platform: socialPlatform,
        type: 'social'
      });
      continue;
    }

    // Booking
    const bookingScore = scoreBookingLink(link);
    if (bookingScore > 0) {
      candidates.booking.push({
        ...link,
        score: bookingScore,
        type: 'booking'
      });
    }

    // Menu
    const menuScore = scoreMenuLink(link);
    if (menuScore > 0) {
      candidates.menu.push({
        ...link,
        score: menuScore,
        type: 'menu'
      });
    }

    // Takeaway
    const takeawayScore = scoreTakeawayLink(link);
    if (takeawayScore > 0) {
      candidates.takeaway.push({
        ...link,
        score: takeawayScore,
        type: 'takeaway'
      });
    }
  }

  // ========================================
  // Select Best Candidates (threshold-based)
  // ========================================

  const BOOKING_THRESHOLD = 50;
  const MENU_THRESHOLD = 40;
  const TAKEAWAY_THRESHOLD = 40;

  // Booking
  const bestBooking = candidates.booking
    .filter(c => c.score >= BOOKING_THRESHOLD)
    .sort((a, b) => b.score - a.score)[0];
  if (bestBooking) {
    classified.booking = {
      url: bestBooking.url,
      confidence: Math.min(bestBooking.score / 100, 0.99),
      evidence: bestBooking.text || bestBooking.aria_label,
      source_url: bestBooking.final_url
    };
  }

  // Menu
  const bestMenu = candidates.menu
    .filter(c => c.score >= MENU_THRESHOLD)
    .sort((a, b) => b.score - a.score)[0];
  if (bestMenu) {
    classified.menu = {
      url: bestMenu.url,
      confidence: Math.min(bestMenu.score / 100, 0.99),
      evidence: bestMenu.text || bestMenu.aria_label,
      source_url: bestMenu.final_url
    };
  }

  // Takeaway
  const bestTakeaway = candidates.takeaway
    .filter(c => c.score >= TAKEAWAY_THRESHOLD)
    .sort((a, b) => b.score - a.score)[0];
  if (bestTakeaway) {
    classified.takeaway = {
      url: bestTakeaway.url,
      confidence: Math.min(bestTakeaway.score / 100, 0.99),
      evidence: bestTakeaway.text || bestTakeaway.aria_label,
      source_url: bestTakeaway.final_url
    };
  }

  // Social (all valid profiles)
  classified.social_profiles = candidates.social.map(s => ({
    platform: s.platform,
    url: s.url,
    confidence: 0.99
  }));

  // Maps
  if (candidates.maps.length > 0) {
    const bestMaps = candidates.maps[0];
    classified.google_maps = {
      url: bestMaps.url,
      confidence: 0.99,
      evidence: bestMaps.text
    };
  }

  // Food inspection
  if (candidates.inspection.length > 0) {
    const bestInspection = candidates.inspection[0];
    classified.food_inspection = {
      url: bestInspection.url,
      confidence: 0.99,
      type: 'findsmiley'
    };
  }

  return { classified, candidates };
}

/**
 * EXCLUSION: Check if link should be excluded from business classification
 * CRITICAL: Must run BEFORE any positive scoring
 */
function isExcludedBusinessLink(link) {
  const combined = [
    link.url,
    link.text,
    link.aria_label,
    link.title,
    link.section_heading,
    link.context
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return /privacy|privatliv|cookie|legal|policy|terms|consent|tracking|support|help|optout|\/share|\/sharer/.test(
    combined
  );
}

/**
 * Score booking link
 */
function scoreBookingLink(link) {
  const url = link.url.toLowerCase();
  const combined = [
    link.text,
    link.aria_label,
    link.title,
    link.section_heading
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  let score = 0;

  // Strong providers
  if (
    /easytable|opentable|resdiary|dinnerbooking|quandoo|bookatable/.test(url)
  ) {
    score += 80;
  }

  // Booking keywords (Danish + English)
  if (
    /(?:^|\s)(book bord|bestil bord|reserver bord|book table|reservation|reserve)(?:\s|$)/.test(combined)
  ) {
    score += 40;
  }

  // URL path
  if (/\/book|\/booking|\/reservation|\/reserve/.test(url)) {
    score += 30;
  }

  return score;
}

/**
 * Score menu link
 * CRITICAL: Must distinguish from takeaway/delivery
 */
function scoreMenuLink(link) {
  const url = link.url.toLowerCase();
  const combined = [
    link.text,
    link.aria_label,
    link.title,
    link.section_heading
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  let score = 0;

  // Menu keywords (Danish aware - no \b before æ/ø/å)
  if (/(?:^|\s)(menu|menukort|madkort|drikkekort|food menu|wine list|vinkort)(?:\s|$)/.test(combined)) {
    score += 50;
  }

  // URL path (Danish aware)
  if (/\/(menu|menukort|food|drinks)\b/.test(url)) {
    score += 40;
  }

  // PDF bonus
  if (/\.pdf($|\?)/.test(url)) {
    score += 20;
  }

  // PENALTY: Takeaway/delivery indicators
  if (/takeaway|take-away|delivery|order|bestil|catering|gift|gavekort/.test(combined + ' ' + url)) {
    score -= 70;
  }

  return score;
}

/**
 * Score takeaway link
 */
function scoreTakeawayLink(link) {
  const url = link.url.toLowerCase();
  const combined = [
    link.text,
    link.aria_label,
    link.title
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  let score = 0;

  // Known providers
  if (/wolt\.com|just-?eat|foodora|heapsgo/.test(url)) {
    score += 70;
  }

  // Takeaway keywords
  if (/(?:^|\s)(takeaway|take away|bestil mad|order food|delivery|afhentning|pickup)(?:\s|$)/.test(combined)) {
    score += 50;
  }

  // URL path
  if (/\/takeaway|\/delivery|\/order|\/bestil/.test(url)) {
    score += 40;
  }

  return score;
}

/**
 * Classify social profile
 * Returns platform name or null
 */
function classifySocialProfile(urlString) {
  try {
    const url = new URL(urlString);

    // Reject privacy/legal URLs
    const excludedPath =
      /\/(privacy|legal|policy|terms|help|support|share|sharer)\b/i;

    if (excludedPath.test(url.pathname)) {
      return null;
    }

    const host = url.hostname.replace(/^www\./, '');

    const supported = {
      'instagram.com': 'instagram',
      'facebook.com': 'facebook',
      'linkedin.com': 'linkedin',
      'tiktok.com': 'tiktok',
      'youtube.com': 'youtube',
      'youtu.be': 'youtube'
    };

    return supported[host] || null;
  } catch {
    return null;
  }
}

/**
 * Check if URL is Google Maps
 */
function isGoogleMapsUrl(urlString) {
  try {
    const url = new URL(urlString);
    const host = url.hostname.replace(/^www\./, '');

    return (
      host === 'maps.google.com' ||
      host === 'maps.app.goo.gl' ||
      (host === 'goo.gl' && url.pathname.startsWith('/maps')) ||
      (host === 'google.com' && url.pathname.startsWith('/maps'))
    );
  } catch {
    return false;
  }
}
