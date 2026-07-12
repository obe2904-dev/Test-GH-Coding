import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export const config = {
  maxDuration: 30,
  memory: 3008
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-api-key');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // API key validation
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.API_KEY;
  
  console.log('API Key check:', {
    receivedKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'none',
    expectedKey: expectedKey ? `${expectedKey.substring(0, 10)}...` : 'undefined',
    match: apiKey === expectedKey
  });
  
  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      debug: expectedKey ? 'key mismatch' : 'env var not set'
    });
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  console.log('Starting scrape for:', url);
  const startTime = Date.now();
  
  let browser = null;
  try {
    const execPath = await chromium.executablePath();
    console.log('Chromium executable path:', execPath);
    
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: execPath,
      headless: 'new',
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
    
    // Wait for React/Vue/SPA frameworks to initialize and render navigation
    await page.waitForTimeout(3000);
    
    const html = await page.content();
    
    // Extract ALL navigation elements (including React Router, click handlers, etc.)
    const navigationData = await page.evaluate(() => {
      const extractText = (el) => {
        // Try multiple text sources
        return el.textContent?.trim() || 
               el.getAttribute('aria-label') || 
               el.getAttribute('title') || 
               el.getAttribute('data-label') ||
               el.querySelector('img')?.getAttribute('alt') || 
               '';
      };
      
      const elements = [];
      
      // 1. Traditional <a> links
      document.querySelectorAll('a[href]').forEach(el => {
        elements.push({
          type: 'link',
          href: el.getAttribute('href'),
          text: extractText(el),
          role: el.getAttribute('role'),
          ariaLabel: el.getAttribute('aria-label')
        });
      });
      
      // 2. Buttons (might have navigation handlers)
      document.querySelectorAll('button, [role="button"]').forEach(el => {
        const text = extractText(el);
        // Only include if text suggests navigation
        const navKeywords = /menu|book|reservation|contact|about|gallery|events|order|delivery|takeaway/i;
        if (navKeywords.test(text)) {
          elements.push({
            type: 'button',
            text,
            href: el.getAttribute('data-href') || el.getAttribute('data-link'),
            onClick: !!el.onclick || !!el.getAttribute('onclick'),
            role: el.getAttribute('role'),
            ariaLabel: el.getAttribute('aria-label')
          });
        }
      });
      
      // 3. Clickable divs/spans (React Router often uses these)
      document.querySelectorAll('[onclick], [data-href], [data-link], [data-to]').forEach(el => {
        if (el.tagName === 'A' || el.tagName === 'BUTTON') return; // Already captured
        const text = extractText(el);
        if (text) {
          elements.push({
            type: 'clickable',
            text,
            href: el.getAttribute('data-href') || el.getAttribute('data-link') || el.getAttribute('data-to'),
            onClick: true,
            role: el.getAttribute('role'),
            ariaLabel: el.getAttribute('aria-label')
          });
        }
      });
      
      return {
        totalElements: elements.length,
        elements: elements.slice(0, 100) // Limit to first 100
      };
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`Scrape completed in ${duration}ms, HTML: ${html.length} chars, Nav elements: ${navigationData.totalElements}`);
    
    return res.status(200).json({
      html,
      navigationData,
      scraperType: 'puppeteer-vercel',
      duration
    });
  } catch (error) {
    console.error('Scrape error:', error);
    return res.status(500).json({ 
      error: 'Scraping failed', 
      message: error.message 
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
