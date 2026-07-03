"""Browser-based web content fetching with JavaScript rendering."""

import logging
from typing import Tuple, Optional
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

logger = logging.getLogger(__name__)


def fetch_webpage_with_browser(url: str, timeout: int = 25000) -> Tuple[str, str, Optional[str]]:
    """Fetch webpage content using Playwright to render JavaScript-heavy sites."""
    browser = None
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                ],
            )
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/118.0.5993.117 Safari/537.36"
                ),
                viewport={"width": 1920, "height": 1080},
                locale="da-DK",
                ignore_https_errors=True,
                java_script_enabled=True,
                extra_http_headers={
                    "Accept-Language": "da-DK,da;q=0.9,en-US;q=0.8,en;q=0.7",
                    "Upgrade-Insecure-Requests": "1",
                    "DNT": "1",
                    "Sec-CH-UA": '"Chromium";v="118", "Not=A?Brand";v="99"',
                    "Sec-CH-UA-Mobile": "?0",
                    "Sec-CH-UA-Platform": '"macOS"',
                },
            )
            page = context.new_page()

            def _goto_with_fallback(target_url: str):
                """Try HTTPS first, then HTTP (or vice versa) to dodge resets."""
                try_urls = [target_url]
                if target_url.startswith("https://"):
                    try_urls.append(target_url.replace("https://", "http://", 1))
                else:
                    try_urls.append(target_url.replace("http://", "https://", 1))

                for candidate in try_urls:
                    try:
                        resp = page.goto(candidate, timeout=timeout, wait_until="networkidle")
                        if resp and resp.ok:
                            return resp, candidate
                    except Exception as e:  # noqa: BLE001
                        logger.debug(f"Navigation failed for {candidate}: {e}")
                return None, target_url

            response, final_nav_url = _goto_with_fallback(url)
            if not response:
                logger.warning(f"Navigation failed for {url}")
                return "", final_nav_url, "Navigation failed"

            # Let above-the-fold content render
            page.wait_for_timeout(1500)

            # Click common nav/menu toggles to reveal SPA content
            nav_selectors = [
                "nav button",
                "nav [role='button']",
                "button[aria-label*='menu']",
                "button[aria-label*='Menu']",
                "button.menu",
                "#menu",
            ]
            for selector in nav_selectors:
                try:
                    if page.is_visible(selector):
                        page.click(selector, timeout=3000)
                        page.wait_for_timeout(800)
                except Exception as e:  # noqa: BLE001
                    logger.debug(f"Nav click failed for {selector}: {e}")

            # Click likely anchors to force SPA routes to load
            link_texts = [
                "Menu",
                "Menukort",
                "Bestil",
                "Åbningstider",
                "Om",
                "About",
                "Kontakt",
            ]
            for text in link_texts:
                try:
                    locator = page.get_by_text(text, exact=False).first
                    locator.click(timeout=3000)
                    page.wait_for_timeout(900)
                except Exception as e:  # noqa: BLE001
                    logger.debug(f"Anchor click failed for {text}: {e}")

            # Scroll to trigger lazy-loaded sections
            for _ in range(3):
                page.mouse.wheel(0, 1400)
                page.wait_for_timeout(900)

            # Try hash fragments that often host content sections
            hash_fragments = [
                "#menu",
                "#menukort",
                "#food",
                "#mad",
                "#about",
                "#om",
                "#opening-hours",
                "#aabningstider",
                "#kontakt",
            ]
            for fragment in hash_fragments:
                try:
                    page.goto(final_nav_url + fragment, timeout=timeout // 2, wait_until="domcontentloaded")
                    page.wait_for_timeout(800)
                    page.mouse.wheel(0, 1200)
                    page.wait_for_timeout(600)
                except Exception as e:  # noqa: BLE001
                    logger.debug(f"Hash nav failed for {fragment}: {e}")

            html = page.content()
            final_url = page.url
            logger.info(f"✅ Fetched {final_url} with browser ({len(html)} chars)")
            return html, final_url, None

    except PlaywrightTimeout:
        return "", url, "Browser timeout"
    except Exception as e:  # noqa: BLE001
        logger.error(f"Browser fetch error for {url}: {e}")
        return "", url, f"Browser error: {e}"
    finally:
        if browser:
            try:
                browser.close()
            except Exception:  # noqa: BLE001
                pass


def fetch_webpage_simple(url: str, timeout: int = 25) -> Tuple[str, str, Optional[str]]:
    """
    Simple fetch without browser (fallback for static sites).
    """
    import requests
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (compatible; WebsiteAnalyzer/1.0)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
        
        response = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
        response.raise_for_status()
        
        html = response.text
        final_url = str(response.url)
        
        logger.info(f"✅ Fetched {final_url} simple ({len(html)} chars)")
        return html, final_url, None
        
    except Exception as e:
        return "", url, f"Request error: {str(e)}"
