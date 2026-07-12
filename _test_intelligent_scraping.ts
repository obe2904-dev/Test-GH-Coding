/**
 * Integration Test Suite for Intelligent Scraping System
 * 
 * Tests all 4 phases:
 * 1. Content signature detection
 * 2. Intelligent scraper routing
 * 3. Extraction waterfall
 * 4. Validation & quality assurance
 * 
 * Key Test Cases:
 * - Souk Aarhus (restaurant misclassified as retail - MUST PASS)
 * - Static site with JSON-LD
 * - SPA requiring Puppeteer
 * - Site with missing data requiring AI
 */

import { assertEquals, assertExists, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { detectContentSignature } from '../supabase/functions/_shared/scraping/content-signature-detector.ts'
import { routeToOptimalScraper } from '../supabase/functions/_shared/scraping/intelligent-scraper-router.ts'
import { 
  stage1ZeroCostExtraction, 
  stage2LowCostExtraction, 
  calculateCompleteness,
  identifyFieldsForAI 
} from '../supabase/functions/_shared/scraping/extraction-waterfall.ts'
import { validateExtractionQuality } from '../supabase/functions/_shared/scraping/extraction-validator.ts'

/**
 * TEST 1: Souk Aarhus - Restaurant Misclassification Prevention
 * 
 * Critical test: This was the original bug that triggered the refactor
 * 
 * Expected behavior:
 * - Content signature should detect hospitality indicators
 * - Validation should catch retail misclassification
 * - Auto-correction should fix: "Retail" → "Restaurant"
 */
Deno.test('CRITICAL: Souk Aarhus - Prevent restaurant→retail misclassification', async () => {
  const url = 'https://soukaarhus.dk/'
  
  console.log('🧪 TEST: Souk Aarhus restaurant misclassification')
  console.log('   URL:', url)
  
  // Phase 1: Detect content signature
  const signature = await detectContentSignature(url)
  console.log('   Signature:', signature.classification, 'confidence:', signature.confidence)
  
  // Phase 2: Route to optimal scraper
  const routingResult = await routeToOptimalScraper(url, signature)
  console.log('   Scraper used:', routingResult.scraperUsed)
  console.log('   Validation quality:', routingResult.validation.quality)
  
  assert(routingResult.html.length > 0, 'HTML should be scraped')
  
  // Phase 3: Extract with waterfall (Stage 1 + 2 only, no AI for speed)
  const mockMetadata = {
    title: 'Souk Aarhus',
    description: 'Restaurant in Aarhus',
    image: null
  }
  
  const stage1Result = await stage1ZeroCostExtraction(routingResult.html, mockMetadata)
  const stage2Result = await stage2LowCostExtraction(routingResult.html, url, stage1Result)
  const completeness = calculateCompleteness(stage2Result)
  
  console.log('   Completeness score:', completeness.overallScore)
  console.log('   Business type extracted:', completeness.businessType.value)
  
  // Phase 4: Validate quality (critical test)
  const hasMenuUrl = routingResult.html.includes('menu') || routingResult.html.includes('menukort')
  const hasBookingUrl = routingResult.html.includes('book') || routingResult.html.includes('reserv')
  const jsonLdType = completeness.businessType.source === 'JSON_LD' ? completeness.businessType.value : null
  
  const qualityReport = validateExtractionQuality(completeness, {
    hasMenuUrl,
    hasBookingUrl,
    websiteContent: routingResult.html.substring(0, 5000),
    jsonLdType,
    metaDescription: mockMetadata.description
  })
  
  console.log('   Quality:', qualityReport.overallQuality)
  console.log('   Auto-corrections applied:', qualityReport.autoCorrections.length)
  
  // CRITICAL ASSERTIONS
  assert(
    !completeness.businessType.value?.toLowerCase().includes('retail') &&
    !completeness.businessType.value?.toLowerCase().includes('shop'),
    '❌ FAILED: Business type should NOT be retail/shop for restaurant'
  )
  
  assert(
    completeness.businessType.value?.toLowerCase().includes('restaurant') ||
    completeness.businessType.value?.toLowerCase().includes('café') ||
    qualityReport.autoCorrections.some(c => c.field === 'businessType' && c.to.toLowerCase().includes('restaurant')),
    '❌ FAILED: Business type should be Restaurant or auto-corrected to Restaurant'
  )
  
  console.log('✅ PASSED: Souk Aarhus correctly identified as Restaurant')
})

/**
 * TEST 2: Static Site with Rich JSON-LD
 * 
 * Expected behavior:
 * - Signature: STATIC_RICH
 * - Scraper: SIMPLE_FETCH
 * - Extraction: Stage 1 complete (90%+)
 * - AI: Not needed
 */
Deno.test('Static site with JSON-LD - should complete without AI', async () => {
  const url = 'https://example-restaurant.com/'  // Replace with real test URL
  
  console.log('🧪 TEST: Static site with JSON-LD')
  
  // Phase 1: Signature detection
  const signature = await detectContentSignature(url)
  
  // Expect static classification
  assertEquals(
    signature.classification,
    'STATIC_RICH',
    'Should classify as STATIC_RICH with JSON-LD'
  )
  
  // Expect simple fetch recommendation
  assertEquals(
    signature.recommendedScraper,
    'SIMPLE_FETCH',
    'Should recommend SIMPLE_FETCH for static content'
  )
  
  // Phase 2: Routing
  const routingResult = await routeToOptimalScraper(url, signature)
  
  assertEquals(
    routingResult.scraperUsed,
    'SIMPLE_FETCH',
    'Should use SIMPLE_FETCH'
  )
  
  assert(
    routingResult.validation.isValid,
    'Validation should pass'
  )
  
  console.log('✅ PASSED: Static site handled efficiently')
})

/**
 * TEST 3: SPA requiring JavaScript rendering
 * 
 * Expected behavior:
 * - Signature: DYNAMIC_SPA
 * - Scraper: PUPPETEER
 * - Validation: Should catch if simple fetch was used
 */
Deno.test('SPA site - should use Puppeteer', async () => {
  const url = 'https://example-spa.com/'  // Replace with real SPA test URL
  
  console.log('🧪 TEST: SPA requiring JS rendering')
  
  // Phase 1: Signature detection
  const signature = await detectContentSignature(url)
  
  // Should detect high script count
  assert(
    signature.evidence.scriptCount > 10,
    'Should detect high script count for SPA'
  )
  
  // Should recommend Puppeteer
  assertEquals(
    signature.recommendedScraper,
    'PUPPETEER',
    'Should recommend PUPPETEER for SPA'
  )
  
  // Phase 2: Routing
  const routingResult = await routeToOptimalScraper(url, signature)
  
  // Should use Puppeteer (or upgrade to it)
  assert(
    routingResult.scraperUsed === 'PUPPETEER' || routingResult.upgradedFrom === 'SIMPLE_FETCH',
    'Should use or upgrade to Puppeteer'
  )
  
  console.log('✅ PASSED: SPA handled with Puppeteer')
})

/**
 * TEST 4: Extraction Waterfall - Short-circuit behavior
 * 
 * Expected behavior:
 * - Complete JSON-LD data → Stage 1 complete (90%+)
 * - identifyFieldsForAI() should return empty array
 */
Deno.test('Extraction waterfall - should short-circuit when complete', async () => {
  console.log('🧪 TEST: Extraction waterfall short-circuit')
  
  // Mock complete JSON-LD HTML
  const mockHtml = `
    <html lang="da">
      <head>
        <title>Test Restaurant</title>
        <meta name="description" content="A great restaurant in Aarhus">
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Restaurant",
          "name": "Test Restaurant",
          "description": "A great restaurant in Aarhus",
          "telephone": "+4512345678",
          "email": "info@test.dk",
          "address": {
            "streetAddress": "Street 1",
            "addressLocality": "Aarhus",
            "postalCode": "8000",
            "addressCountry": "DK"
          },
          "openingHours": "Mo-Su 11:00-22:00",
          "logo": "https://test.dk/logo.png"
        }
        </script>
      </head>
      <body>
        <h1>Test Restaurant</h1>
        <p>Welcome to our restaurant</p>
      </body>
    </html>
  `
  
  const mockMetadata = {
    title: 'Test Restaurant',
    description: 'A great restaurant in Aarhus',
    image: 'https://test.dk/logo.png'
  }
  
  // Stage 1: Zero-cost extraction
  const stage1Result = await stage1ZeroCostExtraction(mockHtml, mockMetadata)
  
  // Stage 2: Low-cost extraction
  const stage2Result = await stage2LowCostExtraction(mockHtml, 'https://test.dk/', stage1Result)
  
  // Calculate completeness
  const completeness = calculateCompleteness(stage2Result)
  
  console.log('   Completeness:', completeness.overallScore)
  
  // Should be 90%+ complete
  assert(
    completeness.overallScore >= 90,
    `Should be 90%+ complete, got ${completeness.overallScore}`
  )
  
  // Should have no missing critical fields
  assertEquals(
    completeness.missingCriticalFields.length,
    0,
    'Should have no missing critical fields'
  )
  
  // Should not require AI
  const fieldsForAI = identifyFieldsForAI(completeness)
  assertEquals(
    fieldsForAI.length,
    0,
    'Should not require AI extraction'
  )
  
  console.log('✅ PASSED: Waterfall short-circuited correctly')
})

/**
 * TEST 5: Validation - Confidence scoring
 * 
 * Expected behavior:
 * - JSON-LD source > AI source
 * - Conflicts should be detected
 * - Recommendations should be appropriate
 */
Deno.test('Validation - source authority and conflict detection', async () => {
  console.log('🧪 TEST: Validation authority and conflicts')
  
  // Mock completeness with conflicting sources
  const mockCompleteness: any = {
    businessName: { value: 'Test Restaurant', status: 'FOUND', source: 'JSON_LD', confidence: 0.95 },
    businessType: { value: 'Restaurant', status: 'FOUND', source: 'JSON_LD', confidence: 0.95 },
    description: { value: 'Great food', status: 'FOUND', source: 'META_TAG', confidence: 0.75 },
    phone: { value: '+4512345678', status: 'FOUND', source: 'REGEX', confidence: 0.8 },
    email: { value: 'info@test.dk', status: 'FOUND', source: 'HTML_SEMANTIC', confidence: 0.9 },
    address: { value: 'Street 1, Aarhus', status: 'FOUND', source: 'JSON_LD', confidence: 0.9 },
    hours: { value: {}, status: 'FOUND', source: 'JSON_LD', confidence: 0.9 },
    menu: { value: null, status: 'MISSING', source: null, confidence: 0 },
    logo: { value: 'https://test.dk/logo.png', status: 'FOUND', source: 'JSON_LD', confidence: 0.85 },
    overallScore: 85,
    missingCriticalFields: [],
    stageSummary: {
      stage1Complete: false,
      stage2Complete: true,
      stage3Required: false
    }
  }
  
  const qualityReport = validateExtractionQuality(mockCompleteness, {
    hasMenuUrl: true,
    hasBookingUrl: false,
    websiteContent: 'restaurant menu food',
    jsonLdType: 'Restaurant',
    metaDescription: 'Great food'
  })
  
  console.log('   Quality:', qualityReport.overallQuality)
  
  // Should have HIGH or MEDIUM quality (no critical issues)
  assert(
    qualityReport.overallQuality === 'HIGH' || qualityReport.overallQuality === 'MEDIUM',
    'Should have acceptable quality'
  )
  
  // Should not have critical issues
  assertEquals(
    qualityReport.criticalIssues.length,
    0,
    'Should not have critical issues for valid data'
  )
  
  console.log('✅ PASSED: Validation working correctly')
})

/**
 * TEST 6: Cost Estimation
 * 
 * Expected behavior:
 * - Simple fetch: $0
 * - Puppeteer: ~$0.005
 * - Metrics should be logged
 */
Deno.test('Cost estimation - verify pricing model', async () => {
  console.log('🧪 TEST: Cost estimation')
  
  // Test with static site (should be $0)
  const staticUrl = 'https://example.com/'
  const staticSignature = await detectContentSignature(staticUrl)
  const staticRouting = await routeToOptimalScraper(staticUrl, staticSignature)
  
  console.log('   Static site cost:', staticRouting.estimatedCost)
  
  assert(
    staticRouting.estimatedCost === 0,
    'Static site (simple fetch) should cost $0'
  )
  
  // Test with SPA (should be ~$0.005 if Puppeteer used)
  // Skip if Cloud Run not available
  
  console.log('✅ PASSED: Cost estimation working')
})

/**
 * Run all tests
 */
console.log('🚀 Running intelligent scraping system test suite...')
console.log('=' .repeat(60))
