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
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
    
    const html = await page.content();
    const duration = Date.now() - startTime;
    
    console.log(`Scrape completed in ${duration}ms, HTML length: ${html.length}`);
    
    return res.status(200).json({
      html,
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
