/**
 * Intelligent Scraper Router
 * 
 * Purpose: Route to optimal scraper based on content signature
 * Validates scraper output quality and upgrades if needed
 * 
 * Scraper priority: Direct API > Simple Fetch > Puppeteer
 */

import type { ContentSignature } from './content-signature-detector.ts'
import { scrapeWebsite, type ScrapeResult } from '../crawling/website-scraper.ts'

export interface ScraperConfig {
  method: 'FETCH' | 'PUPPETEER' | 'API'
  timeout: number
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'
  waitForSelector?: string
  blockResources?: string[]
  userAgent: string
  cacheStrategy: 'AGGRESSIVE' | 'NORMAL' | 'NO_CACHE'
  retryStrategy: {
    maxRetries: number
    backoff: 'LINEAR' | 'EXPONENTIAL'
    upgradePath?: 'FETCH_TO_PUPPETEER' | 'PUPPETEER_TO_API'
  }
}

export interface ScraperValidation {
  isValid: boolean
  quality: 'HIGH' | 'MEDIUM' | 'LOW' | 'FAILED'
  issues: string[]
  shouldUpgrade: boolean
  recommendedUpgrade?: 'PUPPETEER' | 'API'
}

export interface ScraperRoutingResult {
  html: string
  scraperUsed: 'SIMPLE_FETCH' | 'PUPPETEER' | 'DIRECT_API'
  attemptsMade: number
  upgradedFrom?: string
  validation: ScraperValidation
  executionTime: number
  estimatedCost: number
}

/**
 * Scraper configurations per content type
 */
const SCRAPER_CONFIGS: Record<ContentSignature['classification'], ScraperConfig> = {
  STATIC_RICH: {
    method: 'FETCH',
    timeout: 10000,
    userAgent: 'Mozilla/5.0 (compatible; BusinessProfileBot/1.0)',
    cacheStrategy: 'AGGRESSIVE',  // 7 days
    retryStrategy: { 
      maxRetries: 2, 
      backoff: 'LINEAR', 
      upgradePath: 'FETCH_TO_PUPPETEER' 
    }
  },
  STATIC_SIMPLE: {
    method: 'FETCH',
    timeout: 8000,
    userAgent: 'Mozilla/5.0 (compatible; BusinessProfileBot/1.0)',
    cacheStrategy: 'NORMAL',  // 24 hours
    retryStrategy: { 
      maxRetries: 1, 
      backoff: 'LINEAR' 
    }
  },
  DYNAMIC_SPA: {
    method: 'PUPPETEER',
    timeout: 25000,
    waitUntil: 'networkidle2',
    blockResources: ['image', 'font', 'stylesheet'],
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    cacheStrategy: 'NORMAL',
    retryStrategy: { 
      maxRetries: 2, 
      backoff: 'EXPONENTIAL' 
    }
  },
  HYBRID: {
    method: 'PUPPETEER',
    timeout: 20000,
    waitUntil: 'domcontentloaded',
    waitForSelector: 'main, article, #content',
    userAgent: 'Mozilla/5.0 (compatible; BusinessProfileBot/1.0)',
    cacheStrategy: 'NORMAL',
    retryStrategy: { 
      maxRetries: 1, 
      backoff: 'LINEAR' 
    }
  },
  API_AVAILABLE: {
    method: 'API',
    timeout: 5000,
    userAgent: 'Mozilla/5.0 (compatible; BusinessProfileBot/1.0)',
    cacheStrategy: 'AGGRESSIVE',
    retryStrategy: { 
      maxRetries: 2, 
      backoff: 'LINEAR', 
      upgradePath: 'PUPPETEER_TO_API' 
    }
  }
}

/**
 * Validate scraper output quality
 */
function validateScraperOutput(
  html: string,
  signature: ContentSignature,
  scraperUsed: 'SIMPLE_FETCH' | 'PUPPETEER' | 'DIRECT_API'
): ScraperValidation {
  const issues: string[] = []
  let quality: 'HIGH' | 'MEDIUM' | 'LOW' | 'FAILED' = 'HIGH'
  let shouldUpgrade = false
  let recommendedUpgrade: 'PUPPETEER' | 'API' | undefined
  
  // Basic validation
  if (!html || html.length < 100) {
    issues.push('HTML too short (< 100 chars)')
    quality = 'FAILED'
    shouldUpgrade = true
    recommendedUpgrade = 'PUPPETEER'
    return { isValid: false, quality, issues, shouldUpgrade, recommendedUpgrade }
  }
  
  // Validation for simple fetch
  if (scraperUsed === 'SIMPLE_FETCH') {
    // Check for "Please enable JavaScript" messages
    if (/please enable javascript|you need to enable javascript|javascript is required/i.test(html)) {
      issues.push('Site requires JavaScript')
      quality = 'FAILED'
      shouldUpgrade = true
      recommendedUpgrade = 'PUPPETEER'
    }
    
    // Check for minimal content (likely needs JS rendering)
    if (html.length < 5000) {
      issues.push('HTML suspiciously short (< 5KB)')
      quality = 'LOW'
      shouldUpgrade = true
      recommendedUpgrade = 'PUPPETEER'
    }
    
    // Check script tag ratio (high ratio = likely SPA)
    const scriptMatches = html.match(/<script/gi)
    const scriptCount = scriptMatches ? scriptMatches.length : 0
    const totalTagMatches = html.match(/<[a-z]/gi)
    const totalTags = totalTagMatches ? totalTagMatches.length : 1
    const scriptRatio = scriptCount / totalTags
    
    if (scriptRatio > 0.3) {
      issues.push(`High script tag ratio (${(scriptRatio * 100).toFixed(1)}%)`)
      quality = quality === 'FAILED' ? 'FAILED' : 'LOW'
      shouldUpgrade = true
      recommendedUpgrade = 'PUPPETEER'
    }
    
    // Check for expected content based on signature
    if (signature.evidence.hasJsonLd && !/<script[^>]+type=["']application\/ld\+json["']/i.test(html)) {
      issues.push('Expected JSON-LD not found')
      quality = quality === 'FAILED' ? 'FAILED' : 'MEDIUM'
    }
    
    // Check for basic HTML structure
    const hasNav = /<nav/i.test(html)
    const hasHeader = /<header/i.test(html)
    const hasMain = /<main/i.test(html)
    const hasFooter = /<footer/i.test(html)
    
    if (!hasNav && !hasHeader && !hasMain && !hasFooter) {
      issues.push('Missing semantic HTML structure')
      quality = quality === 'FAILED' ? 'FAILED' : 'LOW'
    }
  }
  
  // Validation for Puppeteer
  if (scraperUsed === 'PUPPETEER') {
    // Should be better than simple fetch
    if (html.length < 8000) {
      issues.push('Puppeteer result still small (< 8KB)')
      quality = 'MEDIUM'
    }
    
    // Check for rendering indicators
    const hasDataAttributes = /data-reactroot|data-vue|data-rendered/i.test(html)
    if (!hasDataAttributes && signature.evidence.frameworkDetected) {
      issues.push(`Expected ${signature.evidence.frameworkDetected} rendering markers not found`)
      quality = quality === 'FAILED' ? 'FAILED' : 'MEDIUM'
    }
    
    // Check for loading spinners (page may not have finished)
    if (/loading|spinner|skeleton/i.test(html)) {
      issues.push('Page may still be loading')
      quality = 'MEDIUM'
    }
  }
  
  // Final assessment
  const isValid = quality !== 'FAILED'
  
  if (quality === 'FAILED') {
    console.error('❌ Scraper validation FAILED:', issues)
  } else if (quality === 'LOW') {
    console.warn('⚠️ Scraper validation LOW quality:', issues)
  } else if (quality === 'MEDIUM') {
    console.log('📊 Scraper validation MEDIUM quality:', issues)
  } else {
    console.log('✅ Scraper validation passed')
  }
  
  return {
    isValid,
    quality,
    issues,
    shouldUpgrade,
    recommendedUpgrade
  }
}

/**
 * Estimate scraping cost (for monitoring)
 */
function estimateCost(scraperUsed: 'SIMPLE_FETCH' | 'PUPPETEER' | 'DIRECT_API', executionTime: number): number {
  if (scraperUsed === 'SIMPLE_FETCH' || scraperUsed === 'DIRECT_API') {
    return 0  // Free
  }
  
  // Puppeteer cost estimation (Cloud Run or Vercel)
  // Rough estimate: $0.005 per execution
  return 0.005
}

/**
 * Main routing function: Intelligently scrape with validation and upgrades
 */
export async function routeToOptimalScraper(
  url: string,
  signature: ContentSignature
): Promise<ScraperRoutingResult> {
  const startTime = Date.now()
  const config = SCRAPER_CONFIGS[signature.classification]
  
  console.log(`🚀 Routing to scraper: ${signature.recommendedScraper} (classification: ${signature.classification})`)
  
  let html = ''
  let scraperUsed: 'SIMPLE_FETCH' | 'PUPPETEER' | 'DIRECT_API' = 'SIMPLE_FETCH'
  let attemptsMade = 0
  let upgradedFrom: string | undefined
  let validation: ScraperValidation
  
  // Attempt 1: Use recommended scraper
  try {
    attemptsMade++
    
    if (signature.recommendedScraper === 'DIRECT_API') {
      // Try API endpoints first
      for (const apiEndpoint of signature.evidence.apiEndpoints) {
        try {
          const apiUrl = new URL(apiEndpoint, url).href
          const response = await fetch(apiUrl, {
            headers: { 'User-Agent': config.userAgent },
            signal: AbortSignal.timeout(config.timeout)
          })
          
          if (response.ok) {
            const data = await response.json()
            // Convert JSON to HTML-like format for downstream processing
            html = `<pre>API_DATA: ${JSON.stringify(data)}</pre>`
            scraperUsed = 'DIRECT_API'
            console.log('✅ Direct API fetch successful:', apiUrl)
            break
          }
        } catch (apiError) {
          console.log('⚠️ API endpoint failed:', apiEndpoint, apiError)
        }
      }
      
      // If API failed, fall back to Puppeteer
      if (!html) {
        console.log('⚠️ All API endpoints failed, falling back to Puppeteer')
        upgradedFrom = 'DIRECT_API'
        const result = await scrapeWebsite(url)
        html = result.html
        scraperUsed = result.scraperType === 'simple-fetch' ? 'SIMPLE_FETCH' : 'PUPPETEER'
      }
      
    } else if (signature.recommendedScraper === 'SIMPLE_FETCH') {
      // Use existing scrapeWebsite (tries fetch, falls back to Puppeteer)
      const result = await scrapeWebsite(url)
      html = result.html
      scraperUsed = result.scraperType === 'simple-fetch' ? 'SIMPLE_FETCH' : 'PUPPETEER'
      
    } else {
      // Force Puppeteer (for DYNAMIC_SPA, HYBRID)
      // The scrapeWebsite function will route to Cloud Run Puppeteer
      const result = await scrapeWebsite(url)
      html = result.html
      scraperUsed = result.scraperType === 'simple-fetch' ? 'SIMPLE_FETCH' : 'PUPPETEER'
      
      // Log if we expected Puppeteer but got simple fetch
      if (scraperUsed === 'SIMPLE_FETCH' && signature.recommendedScraper === 'PUPPETEER') {
        console.warn('⚠️ Expected Puppeteer but got simple fetch (Cloud Run may be unavailable)')
      }
    }
    
    // Validate the result
    validation = validateScraperOutput(html, signature, scraperUsed)
    
    // Attempt 2: Upgrade if validation failed
    if (!validation.isValid && validation.shouldUpgrade && validation.recommendedUpgrade === 'PUPPETEER' && scraperUsed === 'SIMPLE_FETCH') {
      console.log('⬆️ Upgrading from simple fetch to Puppeteer')
      attemptsMade++
      upgradedFrom = 'SIMPLE_FETCH'
      
      // Force Puppeteer by using Cloud Run
      const result = await scrapeWebsite(url)
      html = result.html
      scraperUsed = 'PUPPETEER'
      
      // Re-validate
      validation = validateScraperOutput(html, signature, scraperUsed)
    }
    
  } catch (error) {
    console.error('❌ Scraper routing failed:', error)
    
    validation = {
      isValid: false,
      quality: 'FAILED',
      issues: [`Scraping error: ${error}`],
      shouldUpgrade: false
    }
  }
  
  const executionTime = Date.now() - startTime
  const estimatedCost = estimateCost(scraperUsed, executionTime)
  
  console.log(`📊 Scraper routing complete: ${scraperUsed} (${attemptsMade} attempts, ${executionTime}ms, ~$${estimatedCost.toFixed(4)})`)
  
  return {
    html,
    scraperUsed,
    attemptsMade,
    upgradedFrom,
    validation,
    executionTime,
    estimatedCost
  }
}
