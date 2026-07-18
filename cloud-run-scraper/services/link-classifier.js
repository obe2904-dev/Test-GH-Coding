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

  // Menu - Tiered approach: Tier 1 (high confidence) + Tier 2 (AI for uncertain)
  const highConfidenceMenus = candidates.menu
    .filter(c => c.score >= MENU_HIGH_CONFIDENCE)
    .sort((a, b) => b.score - a.score);
  
  const uncertainMenus = candidates.menu
    .filter(c => c.score >= MENU_THRESHOLD && c.score < MENU_HIGH_CONFIDENCE)
    .sort((a, b) => b.score - a.score);

  console.log(`📋 Menu candidates: ${candidates.menu.length} total, ${highConfidenceMenus.length} high-confidence (≥60), ${uncertainMenus.length} uncertain (40-59)`);
  
  let allMenus = [...highConfidenceMenus];
  
  // AI Tier 2: Classify uncertain links if API key provided
  if (uncertainMenus.length > 0) {
    console.log(`🤔 Found ${uncertainMenus.length} uncertain menu candidate(s), attempting AI classification...`);
    const aiConfirmedMenus = await classifyUncertainLinksWithAI(uncertainMenus, options.openaiApiKey);
    allMenus = [...allMenus, ...aiConfirmedMenus].sort((a, b) => b.score - a.score);
  }
  
  console.log(`📋 Final menu detection: ${allMenus.length} menu URL(s) confirmed`);
  allMenus.forEach(m => {
    const pathname = new URL(m.url).pathname;
    const method = m.ai_verified ? 'AI' : 'keyword';
    console.log(`  ✓ ${pathname} (score: ${m.score}, method: ${method}, text: "${m.text || m.aria_label || 'N/A'}")`);
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
    detection_method: m.ai_verified ? 'ai_verified' : 'keyword'
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

/**
 * AI Tier 2: Classify uncertain menu links using OpenAI
 * Only called for links scoring 40-59 (uncertain zone)
 */
async function classifyUncertainLinksWithAI(uncertainLinks, openaiApiKey) {
  if (!openaiApiKey || uncertainLinks.length === 0) {
    return [];
  }

  try {
    // Batch up to 10 links per API call
    const linksToClassify = uncertainLinks.slice(0, 10);
    
    const linkDescriptions = linksToClassify.map((link, idx) => {
      const urlPath = new URL(link.url).pathname;
      return `${idx + 1}. URL: ${urlPath}, Anchor Text: "${link.text || link.aria_label || 'no text'}"`;
    }).join('\n');

    const prompt = `You are classifying website links for a restaurant/cafe.
Determine if each link is a MENU page (food/drink offerings) or NOT_MENU (other pages).

MENU pages include:
- Food menus, drink menus, wine lists, cocktail menus
- Meal period menus (breakfast, brunch, lunch, dinner)
- Menu sections (appetizers, desserts, etc.)

NOT_MENU pages include:
- Job/career pages
- Gift cards/vouchers
- Legal/privacy pages
- Events, gallery, "look inside" tours
- About/contact pages
- Ordering/takeaway platforms (separate from viewing menu)

Links to classify:
${linkDescriptions}

Return ONLY valid JSON array (no markdown):
[
  {"index": 0, "classification": "MENU", "confidence": "high"},
  {"index": 1, "classification": "NOT_MENU", "confidence": "high"}
]`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a link classifier. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      console.log(`⚠️ AI classification failed (HTTP ${response.status}), using keyword-only results`);
      return [];
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    
    if (!content) {
      console.log('⚠️ AI classification returned empty response');
      return [];
    }

    // Parse AI response
    const cleanedContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const parsed = JSON.parse(cleanedContent);
    const classifications = Array.isArray(parsed) ? parsed : (parsed.classifications || []);
    
    // Upgrade confirmed menus
    const confirmedMenus = [];
    classifications.forEach(item => {
      const idx = item.index;
      if (idx >= 0 && idx < linksToClassify.length && item.classification === 'MENU') {
        const link = linksToClassify[idx];
        confirmedMenus.push({
          ...link,
          score: 70, // Upgrade to high confidence
          ai_verified: true
        });
        console.log(`  ✨ AI confirmed menu: ${new URL(link.url).pathname} (was uncertain)`);
      }
    });

    console.log(`🤖 AI classified ${classifications.length} uncertain links, confirmed ${confirmedMenus.length} as menus`);
    return confirmedMenus;

  } catch (error) {
    console.log('⚠️ AI classification error:', error.message);
    return [];
  }
}
