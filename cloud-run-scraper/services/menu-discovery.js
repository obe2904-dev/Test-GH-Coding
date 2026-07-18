/**
 * Menu Discovery Service
 * 
 * Phase 1a: Detection Only
 * 
 * Purpose: Visit detected menu pages and classify their structure
 * - Detection ONLY - no extraction yet
 * - Logs findings for analysis
 * - Non-breaking - all paths are optional
 * 
 * Structure Types:
 * - inline_html: Menu text embedded in page HTML
 * - direct_pdf: Single PDF link
 * - image_gallery: Menu stored as JPEG/PNG images
 * - nested_pages: Links to subpages (Lunch, Dinner, etc.)
 * - unknown: Cannot classify structure
 */

/**
 * Detect the type of a link based on URL and context
 * @param {string} url - The URL to classify
 * @param {string} text - Link anchor text
 * @returns {string} - 'pdf' | 'image' | 'submenu' | 'other'
 */
function detectLinkType(url, text = '') {
  const urlLower = url.toLowerCase();
  const textLower = text.toLowerCase();
  
  // PDF files
  if (urlLower.match(/\.(pdf)(\?|$)/i)) {
    return 'pdf';
  }
  
  // Image files (menu scans)
  if (urlLower.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i)) {
    return 'image';
  }
  
  // Submenu pages (lunch, dinner, brunch subpages)
  const menuKeywords = [
    'lunch', 'dinner', 'brunch', 'frokost', 'aften', 'aftensmad',
    'morgenmad', 'tapas', 'bar', 'drinks', 'cocktail', 'menu-'
  ];
  
  const hasMenuKeywordInUrl = menuKeywords.some(k => urlLower.includes(k));
  const hasMenuKeywordInText = menuKeywords.some(k => textLower.includes(k));
  
  if (hasMenuKeywordInUrl || hasMenuKeywordInText) {
    return 'submenu';
  }
  
  return 'other';
}

/**
 * Check if link text suggests a menu category/section
 * @param {string} text - Link text
 * @returns {boolean}
 */
function isMenuCategoryLink(text) {
  if (!text || text.length < 3) return false;
  
  const lower = text.toLowerCase().trim();
  
  // Explicit menu category names
  const categoryPatterns = [
    'frokost', 'lunch', 'middag', 'dinner', 'aften', 'aftensmad',
    'brunch', 'morgenmad', 'breakfast',
    'tapas', 'bar', 'drinks', 'cocktail', 'vin', 'wine',
    'menu', 'menukort', 'spisekort'
  ];
  
  return categoryPatterns.some(pattern => lower.includes(pattern));
}

/**
 * Extract menu-related assets from page
 * @param {object} page - Puppeteer page instance
 * @returns {Promise<object>} Assets found on page
 */
async function extractMenuAssets(page) {
  try {
    const assets = await page.evaluate(() => {
      const links = [];
      const images = [];
      const buttons = [];
      
      // Extract all links with text
      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.href;
        const text = a.textContent.trim();
        const ariaLabel = a.getAttribute('aria-label') || '';
        
        if (href && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
          links.push({
            url: href,
            text: text,
            ariaLabel: ariaLabel
          });
        }
      });
      
      // Extract all images (potential menu scans)
      document.querySelectorAll('img[src]').forEach(img => {
        const src = img.src;
        const alt = img.alt || '';
        
        // Only include if image looks like content (not icons/logos)
        if (src && !src.includes('logo') && !src.includes('icon')) {
          images.push({
            url: src,
            alt: alt,
            width: img.width,
            height: img.height
          });
        }
      });
      
      // Extract buttons (may trigger menu displays)
      document.querySelectorAll('button').forEach(btn => {
        const text = btn.textContent.trim();
        if (text.length > 2) {
          buttons.push({
            text: text,
            ariaLabel: btn.getAttribute('aria-label') || ''
          });
        }
      });
      
      return { links, images, buttons };
    });
    
    return assets;
  } catch (err) {
    console.error('❌ Failed to extract menu assets:', err.message);
    return { links: [], images: [], buttons: [] };
  }
}

/**
 * Classify menu page structure
 * @param {object} assets - Assets extracted from page
 * @param {string} pageUrl - URL of the menu page
 * @returns {object} Structure classification
 */
function classifyMenuStructure(assets, pageUrl) {
  const { links = [], images = [], buttons = [] } = assets;
  
  // Classify all links by type
  const pdfLinks = links.filter(l => detectLinkType(l.url, l.text) === 'pdf');
  const imageLinks = links.filter(l => detectLinkType(l.url, l.text) === 'image');
  const submenuLinks = links.filter(l => detectLinkType(l.url, l.text) === 'submenu');
  
  // Also check for image elements (not linked, but displayed)
  const largeImages = images.filter(img => img.width > 400 && img.height > 400);
  const menuImages = largeImages.filter(img => {
    const urlLower = img.url.toLowerCase();
    const altLower = img.alt.toLowerCase();
    return urlLower.includes('menu') || altLower.includes('menu') ||
           urlLower.match(/\.(jpg|jpeg|png)$/i);
  });
  
  // Check for menu category buttons (common in modern sites)
  const menuButtons = buttons.filter(b => isMenuCategoryLink(b.text));
  
  // Classification logic (priority order)
  
  // 1. Image Gallery - Multiple menu images or image links
  if (imageLinks.length > 0 || menuImages.length > 0) {
    return {
      structure: 'image_gallery',
      confidence: 'high',
      assets: {
        imageLinks: imageLinks.slice(0, 10),
        displayedImages: menuImages.slice(0, 10)
      },
      extractionMethod: 'ocr_required',
      reasoning: `Found ${imageLinks.length} image links and ${menuImages.length} displayed menu images`
    };
  }
  
  // 2. Direct PDF - Single or multiple PDF links
  if (pdfLinks.length > 0) {
    return {
      structure: 'direct_pdf',
      confidence: 'high',
      assets: {
        pdfLinks: pdfLinks.slice(0, 5)
      },
      extractionMethod: 'pdf_extract',
      reasoning: `Found ${pdfLinks.length} PDF link(s)`
    };
  }
  
  // 3. Nested Pages - Links to submenu pages
  if (submenuLinks.length > 1 || menuButtons.length > 1) {
    return {
      structure: 'nested_pages',
      confidence: 'medium',
      assets: {
        submenuLinks: submenuLinks.slice(0, 10),
        menuButtons: menuButtons.slice(0, 10)
      },
      extractionMethod: 'recursive_discovery',
      reasoning: `Found ${submenuLinks.length} submenu links and ${menuButtons.length} menu buttons`
    };
  }
  
  // 4. Inline HTML - Text content on page
  // Check if page has substantial menu-related text
  const hasMenuText = links.some(l => 
    l.text.length > 20 && isMenuCategoryLink(l.text)
  );
  
  if (hasMenuText || links.length > 10) {
    return {
      structure: 'inline_html',
      confidence: 'medium',
      assets: {
        linkCount: links.length
      },
      extractionMethod: 'edge_html',
      reasoning: 'Page appears to have menu content in HTML'
    };
  }
  
  // 5. Unknown - Cannot determine structure
  return {
    structure: 'unknown',
    confidence: 'low',
    assets: {
      linkCount: links.length,
      imageCount: images.length
    },
    extractionMethod: 'manual_review',
    reasoning: 'Unable to classify menu structure'
  };
}

/**
 * Discover menu structure from a detected menu page
 * Phase 1a: Detection only - no extraction
 * 
 * @param {object} browser - Puppeteer browser instance
 * @param {string} menuUrl - URL of suspected menu page
 * @param {number} timeout - Max time to spend (ms)
 * @returns {Promise<object>} Discovery result
 */
export async function discoverMenuStructure(browser, menuUrl, timeout = 15000) {
  console.log(`\n🔍 [MENU DISCOVERY] Starting discovery for: ${menuUrl}`);
  
  let page = null;
  try {
    page = await browser.newPage();
    
    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate to menu page
    console.log('📄 Loading menu page...');
    await page.goto(menuUrl, {
      waitUntil: 'networkidle2',
      timeout: timeout
    });
    
    // Wait a moment for any JS to render
    await page.waitForTimeout(1000);
    
    // Extract all assets from page
    console.log('🔎 Extracting menu assets...');
    const assets = await extractMenuAssets(page);
    
    console.log(`📊 Assets found: ${assets.links.length} links, ${assets.images.length} images, ${assets.buttons.length} buttons`);
    
    // Classify structure
    const classification = classifyMenuStructure(assets, menuUrl);
    
    console.log(`✅ [MENU DISCOVERY] Structure: ${classification.structure} (confidence: ${classification.confidence})`);
    console.log(`   Reasoning: ${classification.reasoning}`);
    
    return {
      success: true,
      menuUrl: menuUrl,
      ...classification,
      timestamp: new Date().toISOString()
    };
    
  } catch (err) {
    console.error(`❌ [MENU DISCOVERY] Failed for ${menuUrl}:`, err.message);
    
    return {
      success: false,
      menuUrl: menuUrl,
      structure: 'error',
      confidence: 'none',
      error: err.message,
      extractionMethod: 'manual_review',
      timestamp: new Date().toISOString()
    };
    
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (closeErr) {
        console.warn('⚠️ Failed to close discovery page:', closeErr.message);
      }
    }
  }
}

/**
 * Check if a URL looks like a menu landing page vs actual menu content
 * Landing pages require deeper discovery
 * 
 * @param {string} url - URL to check
 * @returns {boolean} True if likely a landing page
 */
export function isMenuLandingPage(url) {
  const urlLower = url.toLowerCase();
  
  // Simple menu page patterns (likely landing pages)
  const landingPatterns = [
    /\/menu\/?$/i,        // Just "/menu"
    /\/mad\/?$/i,         // Just "/mad"
    /\/carte\/?$/i,       // Just "/carte"
    /\/spisekort\/?$/i    // Just "/spisekort"
  ];
  
  return landingPatterns.some(pattern => pattern.test(url));
}
