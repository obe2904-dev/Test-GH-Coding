"""Web content fetching utilities."""

import requests
import logging
from typing import Tuple, Optional
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


def fetch_webpage(url: str, timeout: int = 25, max_size_mb: int = 10) -> Tuple[str, str, Optional[str]]:
    """
    Fetch webpage content.
    
    Returns:
        (html_content, final_url, error_message)
    """
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (compatible; WebsiteAnalyzer/1.0)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'da,en-US;q=0.9,en;q=0.8',
        }
        
        response = requests.get(
            url,
            headers=headers,
            timeout=timeout,
            allow_redirects=True,
            stream=True
        )
        
        # Check content size
        content_length = response.headers.get('content-length')
        if content_length and int(content_length) > max_size_mb * 1024 * 1024:
            return "", url, f"Content too large (>{max_size_mb}MB)"
        
        response.raise_for_status()
        
        # Read content in chunks to limit memory usage
        content = b""
        max_bytes = max_size_mb * 1024 * 1024
        for chunk in response.iter_content(chunk_size=8192):
            content += chunk
            if len(content) > max_bytes:
                return "", url, f"Content exceeded {max_size_mb}MB during download"
        
        html = content.decode('utf-8', errors='ignore')
        final_url = str(response.url)
        
        logger.info(f"✅ Fetched {final_url} ({len(html)} chars)")
        return html, final_url, None
        
    except requests.exceptions.Timeout:
        return "", url, "Request timeout"
    except requests.exceptions.TooManyRedirects:
        return "", url, "Too many redirects"
    except requests.exceptions.RequestException as e:
        return "", url, f"Request error: {str(e)}"
    except Exception as e:
        logger.error(f"Unexpected error fetching {url}: {str(e)}")
        return "", url, f"Unexpected error: {str(e)}"


def extract_text_from_html(html: str) -> str:
    """Extract clean text from HTML."""
    try:
        soup = BeautifulSoup(html, 'html.parser')
        
        # Remove script and style elements
        for script in soup(['script', 'style', 'noscript']):
            script.decompose()
        
        # Get text
        text = soup.get_text(separator='\n')
        
        # Clean up
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = '\n'.join(chunk for chunk in chunks if chunk)
        
        return text
    except Exception as e:
        logger.error(f"Error extracting text from HTML: {str(e)}")
        return ""


def extract_ui_elements_from_html(html: str, max_items: int = 40) -> dict:
    """Extract CTA texts, headers, nav items, and hero text snippets from raw HTML.

    Returns a dict with:
      - cta_texts: List[str]
      - headers: List[str]
      - nav_items: List[str]
      - hero_texts: List[str]
    """
    try:
        soup = BeautifulSoup(html, 'html.parser')

        # Remove non-content that can pollute text
        for script in soup(['script', 'style', 'noscript']):
            script.decompose()

        def clean_text(value: str) -> str:
            if not value:
                return ""
            text = " ".join(value.split())
            return text.strip()

        def unique_preserve(items):
            seen = set()
            out = []
            for it in items:
                key = it.lower()
                if key in seen:
                    continue
                seen.add(key)
                out.append(it)
            return out

        headers = []
        for tag in soup.find_all(['h1', 'h2']):
            t = clean_text(tag.get_text(" "))
            if 2 < len(t) <= 120:
                headers.append(t)

        # Nav items
        nav_items = []
        for nav in soup.find_all('nav'):
            for a in nav.find_all('a'):
                t = clean_text(a.get_text(" ") or a.get('aria-label') or "")
                if 2 < len(t) <= 80:
                    nav_items.append(t)

        # CTA candidates: <button>, <a>, input[type=submit/button]
        cta_candidates = []

        for btn in soup.find_all('button'):
            t = clean_text(btn.get_text(" ") or btn.get('aria-label') or "")
            if 2 < len(t) <= 80:
                cta_candidates.append(t)

        for inp in soup.find_all('input'):
            typ = (inp.get('type') or '').lower()
            if typ in ('submit', 'button'):
                t = clean_text(inp.get('value') or inp.get('aria-label') or "")
                if 2 < len(t) <= 80:
                    cta_candidates.append(t)

        action_words = (
            'book', 'bestil', 'reserv', 'reservation', 'bord', 'kontakt', 'ring', 'call',
            'menu', 'menukort', 'se', 'order', 'bestil', 'takeaway', 'take away',
            'find vej', 'directions', 'opening hours', 'åbningstider', 'shop'
        )

        for a in soup.find_all('a'):
            text = clean_text(a.get_text(" ") or a.get('aria-label') or "")
            if not (2 < len(text) <= 80):
                continue

            cls = " ".join(a.get('class') or [])
            role = (a.get('role') or '').lower()

            is_ctaish = (
                role == 'button'
                or any(w in (cls or '').lower() for w in ['btn', 'button', 'cta'])
                or any(w in text.lower() for w in action_words)
            )
            if is_ctaish:
                cta_candidates.append(text)

        # Hero text: look for typical containers
        hero_texts = []
        hero_selectors = []
        for tag in soup.find_all(True):
            cid = (tag.get('id') or '').lower()
            cls = " ".join(tag.get('class') or []).lower()
            if any(k in cid for k in ['hero', 'masthead', 'banner']) or any(k in cls for k in ['hero', 'masthead', 'banner', 'jumbotron']):
                hero_selectors.append(tag)

        for hero in hero_selectors[:8]:
            for t in hero.find_all(['h1', 'h2', 'p']):
                v = clean_text(t.get_text(" "))
                if 5 < len(v) <= 160:
                    hero_texts.append(v)

        # Finalize + cap
        headers = unique_preserve(headers)[:max_items]
        nav_items = unique_preserve(nav_items)[:max_items]
        cta_texts = unique_preserve(cta_candidates)

        # Prefer longer phrases first (more concrete than single-word matches)
        cta_texts.sort(key=lambda s: len(s), reverse=True)
        cta_texts = cta_texts[:max_items]

        hero_texts = unique_preserve(hero_texts)[:max_items]

        return {
            'cta_texts': cta_texts,
            'headers': headers,
            'nav_items': nav_items,
            'hero_texts': hero_texts,
        }
    except Exception as e:
        logger.error(f"Error extracting UI elements from HTML: {str(e)}")
        return {
            'cta_texts': [],
            'headers': [],
            'nav_items': [],
            'hero_texts': [],
        }


def extract_metadata(html: str) -> dict:
    """Extract metadata from HTML."""
    try:
        soup = BeautifulSoup(html, 'html.parser')
        metadata = {}
        
        # Title
        title_tag = soup.find('title')
        if title_tag:
            metadata['title'] = title_tag.string.strip() if title_tag.string else None
        
        # Meta description
        desc_tag = soup.find('meta', attrs={'name': 'description'})
        if desc_tag and desc_tag.get('content'):
            metadata['description'] = desc_tag['content'].strip()
        
        # Open Graph tags
        og_tags = {}
        for tag in soup.find_all('meta', property=lambda x: x and x.startswith('og:')):
            key = tag.get('property', '').replace('og:', '')
            value = tag.get('content', '')
            if key and value:
                og_tags[key] = value
        if og_tags:
            metadata['og'] = og_tags
        
        # Language
        html_tag = soup.find('html')
        if html_tag and html_tag.get('lang'):
            metadata['language'] = html_tag['lang']
        
        return metadata
    except Exception as e:
        logger.error(f"Error extracting metadata: {str(e)}")
        return {}
