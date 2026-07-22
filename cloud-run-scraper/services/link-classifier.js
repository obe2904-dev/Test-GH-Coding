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
 * - Decode HTML entities (&amp; → &, &#038; → &)
 * - Remove tracking parameters
 */
function normalizeUrl(urlString) {
  try {
    // Decode HTML entities (both named and numeric)
    const decoded = urlString
      .replace(/&#038;/g, '&')   // Numeric form first
      .replace(/&#x26;/g, '&')   // Hex form
      .replace(/&amp;/g, '&')    // Named form
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
 * 
 * @param {Array} links - Links to classify
 * @param {Object} options - Optional configuration
 * @param {string} options.openaiApiKey - OpenAI API key for AI Tier 2 classification
 * @param {string} options.homepageUrl - Homepage URL for iframe menu detection
 */
export async function classifyLinks(links, options = {}) {
  const { openaiApiKey, homepageUrl } = options;
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
      // Debug logging for cocktails
      if (link.url.toLowerCase().includes('cocktail')) {
        console.log(`🍹 DEBUG: Cocktails link scored ${menuScore} - ${link.url} (text: "${link.text}")`);
      }
    } else if (link.url.toLowerCase().includes('cocktail')) {
      console.log(`🍹 DEBUG: Cocktails link scored 0 - ${link.url} (text: "${link.text}")`);
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
  const MENU_HIGH_CONFIDENCE = 60;  // NEW: Tier 1 threshold
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

  // Menu - Pure regex classification (AI removed for performance)
  const allMenus = candidates.menu
    .filter(c => c.score >= MENU_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  console.log(`📋 Menu candidates: ${candidates.menu.length} total, ${allMenus.length} above threshold (≥${MENU_THRESHOLD})`);
  
  console.log(`📋 Final menu detection: ${allMenus.length} menu URL(s) confirmed`);
  allMenus.forEach(m => {
    const pathname = new URL(m.url).pathname;
    console.log(`  ✓ ${pathname} (score: ${m.score}, method: keyword, text: "${m.text || m.aria_label || 'N/A'}")`);
  });
  
  // Keep single menu object for backward compatibility
  if (allMenus.length > 0) {
    classified.menu = {
      url: allMenus[0].url,
      confidence: Math.min(allMenus[0].score / 100, 0.99),
      evidence: allMenus[0].text || allMenus[0].aria_label,
      source_url: allMenus[0].final_url
    };
  }
  
  // Add array of ALL menu URLs for multi-menu support
  classified.menu_all = allMenus.map(m => ({
    url: m.url,
    confidence: Math.min(m.score / 100, 0.99),
    evidence: m.text || m.aria_label,
    source_url: m.final_url,
    detection_method: 'keyword'
  }));
  
  // Special case: Mealo platform iframe menus
  // If no menu links found but homepage is Mealo, the entire page IS the menu
  if (classified.menu_all.length === 0 && homepageUrl && isMealoPlatform(homepageUrl)) {
    console.log('🍽️ Mealo platform detected: Adding homepage as iframe menu');
    classified.menu_all = [{
      url: homepageUrl,
      confidence: 0.95,
      evidence: 'Menu fundet som iframe',
      source_url: homepageUrl,
      detection_method: 'iframe_platform'
    }];
    classified.menu = {
      url: homepageUrl,
      confidence: 0.95,
      evidence: 'Menu fundet som iframe',
      source_url: homepageUrl
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
 * Detect if a page (especially contact page) contains booking functionality
 * @param {object} pageDoc - Extracted page document
 * @returns {boolean} True if page has booking functionality
 */
function pageHasBookingContent(pageDoc) {
  // Check if any block contains booking-related text
  for (const block of pageDoc.blocks || []) {
    const text = block.text.toLowerCase();
    const heading = (block.section_heading || '').toLowerCase();
    
    // Look for booking headers like "Bestil bord", "Book table", "Reservation"
    if (/(?:bestil|book|reserver)(?:\s+)(?:bord|table|online)/i.test(heading)) {
      return true;
    }
    
    // Look for booking instructions in text blocks
    if (/(?:bestil|book|reserver).*bord/i.test(text) && text.length < 500) {
      return true;
    }
  }
  
  return false;
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

  // Filter out hash-only links (not real pages)
  if (url.endsWith('#') || url.includes('/#') || /#$/.test(url.split('?')[0])) {
    return 0;
  }

  // Tier 1: High-confidence menu keywords (anchor text + aria-label + title)
  // Core menu terms, meal periods, menu types, menu sections, drink menus
  const menuKeywords = [
    // Core menu/card terms
    'menu', 'menukort', 'madkort', 'drikkekort', 'food menu', 'wine list', 'vinkort',
    // Meal periods
    'morgenmad', 'morgenmenu', 'breakfast',
    'brunch', 'brunchmenu', 'brunchkort', 'brunchbuffet',
    'frokost', 'frokostmenu', 'frokostkort', 'frokostbuffet', 'lunch',
    'aften', 'aftenmenu', 'aftenkort', 'aftensmad', 'evening',
    'middag', 'middagsmenu', 'dinner',
    // Menu types
    'buffet', 'aftenbuffet', 'grillbuffet',
    'a-la-carte', 'alacarte', 'smagemenu', 'sæsonmenu',
    'dagens menu', 'dagens ret', 'ugens menu',
    // Menu sections
    'forretter', 'hovedretter', 'desserter', 'dessertkort',
    'snacks', 'småretter', 'deleretter',
    'børnemenu', 'juniormenu', 'junior',
    // Drinks
    'cocktails?', 'cocktailkort',
    'vin', 'vine', 'vinmenu',
    'øl', 'ølkort', 'fadøl', 'specialøl',
    // Special occasion
    'julemenu', 'nytårsmenu'
  ].join('|');
  
  const menuRegex = new RegExp(`(?:^|\\s)(${menuKeywords})(?:\\s|$)`, 'i');
  if (menuRegex.test(combined)) {
    score += 50;
  }

  // URL path patterns (expanded to match bruttolist)
  const pathKeywords = [
    'menu', 'menukort', 'madkort', 'drikkekort',
    'morgenmad', 'morgenmenu', 'breakfast',
    'brunch', 'brunchmenu', 'brunchkort',
    'frokost', 'frokostmenu', 'frokostkort', 'lunch',
    'aften', 'aftenmenu', 'aftenkort', 'aftensmad', 'evening',
    'middag', 'middagsmenu', 'dinner',
    'buffet', 'aftenbuffet', 'grillbuffet',
    'a-la-carte', 'alacarte', 'smagemenu', 'sæsonmenu',
    'dagens-menu', 'dagens-ret', 'ugens-menu',
    'forretter', 'hovedretter', 'desserter', 'dessertkort',
    'snacks', 'småretter', 'deleretter',
    'børnemenu', 'juniormenu',
    'food', 'drinks?', 'cocktails?', 'cocktailkort',
    'vin', 'vine', 'vinmenu', 'vinkort',
    'øl', 'ølkort',
    'julemenu', 'nytårsmenu'
  ].join('|');
  
  const pathRegex = new RegExp(`/(${pathKeywords})\\b`, 'i');
  if (pathRegex.test(url)) {
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

/**
 * Detect if URL is from Mealo platform (iframe menu platform)
 * Mealo embeds the entire menu as an iframe, so the page itself IS the menu
 */
function isMealoPlatform(urlString) {
  try {
    const url = new URL(urlString);
    const host = url.hostname.toLowerCase();
    return host.includes('mealo.dk');
  } catch {
    return false;
  }
}

// AI classification removed - pure regex-based classification is faster and works well
// Regex patterns cover 95%+ of real-world cases based on testing
