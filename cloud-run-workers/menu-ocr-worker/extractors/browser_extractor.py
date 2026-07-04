"""Browser-based extraction for JavaScript-rendered pages."""

import logging
from typing import Tuple, Optional
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

logger = logging.getLogger(__name__)


def extract_with_browser(url: str, timeout_ms: int = 30000) -> Tuple[str, str]:
    """
    Fetch and render a JavaScript-heavy page using Playwright.
    
    This is a fallback for pages where static HTML extraction fails because
    the content is loaded dynamically via JavaScript (e.g., React apps, Mealo platform).
    
    Args:
        url: The URL to fetch
        timeout_ms: Maximum time to wait for page load (default 30 seconds)
    
    Returns:
        Tuple of (html_content, text_content)
        - html_content: Fully rendered HTML after JavaScript execution
        - text_content: Plain text extracted from rendered page
    
    Raises:
        Exception: If browser extraction fails
    """
    logger.info(f"🌐 Launching browser to render JavaScript page: {url}")
    
    try:
        with sync_playwright() as p:
            # Launch Chromium in headless mode
            browser = p.chromium.launch(
                headless=True,
                args=[
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',  # Overcome limited resource problems
                    '--disable-gpu',
                ]
            )
            
            try:
                context = browser.new_context(
                    viewport={'width': 1280, 'height': 720},
                    user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                )
                page = context.new_page()
                
                # Navigate to the URL
                logger.info(f"📄 Navigating to {url}")
                page.goto(url, wait_until='networkidle', timeout=timeout_ms)
                
                # Wait a bit for any delayed JavaScript rendering
                page.wait_for_timeout(2000)  # 2 seconds additional wait
                
                # Extract content
                html_content = page.content()
                text_content = page.inner_text('body')
                
                logger.info(f"✅ Browser extraction successful: {len(html_content)} chars HTML, {len(text_content)} chars text")
                
                return html_content, text_content
                
            finally:
                browser.close()
                
    except PlaywrightTimeout as e:
        logger.error(f"⏱️ Browser timeout loading {url}: {e}")
        raise Exception(f"Page load timeout after {timeout_ms}ms")
    except Exception as e:
        logger.error(f"❌ Browser extraction failed for {url}: {e}")
        raise


def is_html_empty_or_minimal(html: str) -> bool:
    """
    Detect if HTML has minimal/empty content (likely JavaScript-rendered).
    
    This checks for common patterns where the initial HTML is mostly empty
    and the real content is loaded via JavaScript.
    
    Args:
        html: Raw HTML content
    
    Returns:
        True if HTML appears to be empty/minimal (needs browser rendering)
    """
    # Convert to lowercase for easier matching
    html_lower = html.lower()
    
    # Count menu-related content indicators
    menu_indicators = [
        '<div class="headline',
        '<div class="description',
        '<div class="price',
        'class="menu',
        'class="dish',
        'class="item',
        'class="product',
    ]
    
    indicator_count = sum(1 for indicator in menu_indicators if indicator in html_lower)
    
    # Check if we have very few indicators (less than 3)
    if indicator_count < 3:
        logger.info(f"🔍 HTML appears minimal (only {indicator_count} menu indicators) - likely JavaScript-rendered")
        return True
    
    # Check for empty divs pattern (common in JS frameworks)
    empty_div_count = html.count('<div class="headline"></div>') + \
                     html.count('<div class="description"></div>') + \
                     html.count('<div class="price"></div>')
    
    if empty_div_count > 5:
        logger.info(f"🔍 HTML has {empty_div_count} empty divs - likely JavaScript-rendered")
        return True
    
    return False
