/**
 * Integration Test Example
 * 
 * Shows how to integrate language quality tests with actual Edge Functions.
 * Replace mocked functions with real Edge Function calls.
 */

import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { 
  detectEnglishLeakage, 
  detectMetaCommentary, 
  detectForbiddenPhrases,
  assessContentQuality,
  type QualityScore
} from './language-quality.test.ts'

// ============================================================================
// EDGE FUNCTION INTEGRATION
// ============================================================================

/**
 * Configuration for Edge Function testing
 */
const EDGE_FUNCTION_CONFIG = {
  supabaseUrl: Deno.env.get('SUPABASE_URL') || 'http://localhost:54321',
  supabaseKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  functions: {
    generateText: '/functions/v1/generate-text-from-idea',
    quickSuggestions: '/functions/v1/get-quick-suggestions',
    aiEnhance: '/functions/v1/ai-enhance',
    analyzePhoto: '/functions/v1/analyze-photo',
  }
}

/**
 * Calls an Edge Function and returns the response
 */
async function callEdgeFunction(
  functionPath: string, 
  payload: any
): Promise<any> {
  const url = `${EDGE_FUNCTION_CONFIG.supabaseUrl}${functionPath}`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${EDGE_FUNCTION_CONFIG.supabaseKey}`,
    },
    body: JSON.stringify(payload)
  })
  
  if (!response.ok) {
    throw new Error(`Edge Function failed: ${response.status} ${response.statusText}`)
  }
  
  return await response.json()
}

// ============================================================================
// REAL EDGE FUNCTION TESTS
// ============================================================================

/**
 * Tests generate-text-from-idea for language quality
 * 
 * USAGE: Uncomment when ready to test against real Edge Function
 */
Deno.test({
  name: 'Edge Function - generate-text-from-idea produces quality Danish',
  ignore: true, // Set to false when ready to run real tests
  async fn() {
    const payload = {
      businessId: 'test-business-id',
      contentType: 'menu',
      userIdea: 'Stegt flæsk med persillesovs',
      language: 'da'
    }
    
    const response = await callEdgeFunction(
      EDGE_FUNCTION_CONFIG.functions.generateText,
      payload
    )
    
    const generatedText = response.text || response.cleanText || ''
    
    // Run quality checks
    const englishCheck = detectEnglishLeakage(generatedText)
    const metaCheck = detectMetaCommentary(generatedText)
    const forbiddenCheck = detectForbiddenPhrases(generatedText)
    
    assertEquals(englishCheck.hasLeakage, false, 
      `English leakage detected: ${englishCheck.matches.join(', ')}`)
    assertEquals(metaCheck.hasMetaCommentary, false,
      `Meta-commentary detected: ${metaCheck.matches.join(', ')}`)
    assertEquals(forbiddenCheck.hasForbidden, false,
      `Forbidden phrases detected: ${forbiddenCheck.matches.join(', ')}`)
    
    console.log('✅ Generated text:', generatedText.substring(0, 100) + '...')
  }
})

/**
 * Tests get-quick-suggestions batch quality
 * 
 * USAGE: Uncomment when ready to test against real Edge Function
 */
Deno.test({
  name: 'Edge Function - get-quick-suggestions batch quality >95%',
  ignore: true, // Set to false when ready to run real tests
  async fn() {
    const payload = {
      businessId: 'test-business-id',
      date: new Date().toISOString(),
      language: 'da'
    }
    
    const response = await callEdgeFunction(
      EDGE_FUNCTION_CONFIG.functions.quickSuggestions,
      payload
    )
    
    // Extract all suggestion texts
    const suggestions: string[] = []
    if (response.suggestions) {
      for (const slot of Object.values(response.suggestions)) {
        if (typeof slot === 'object' && slot !== null) {
          const suggestion = slot as any
          if (suggestion.title) suggestions.push(suggestion.title)
          if (suggestion.caption) suggestions.push(suggestion.caption)
        }
      }
    }
    
    // Assess batch quality
    const score = assessContentQuality(suggestions)
    
    console.log('📊 Quality Score:', score.score.toFixed(1) + '%')
    console.log('   Passed:', score.passed, '/', score.totalTests)
    console.log('   Issues:', {
      english: score.issues.englishLeakage,
      meta: score.issues.metaCommentary,
      forbidden: score.issues.forbiddenPhrases,
      passive: score.issues.passiveVoice,
    })
    
    // Require >95% quality
    assertEquals(score.score >= 95, true, 
      `Quality score ${score.score}% is below target 95%`)
  }
})

/**
 * Tests ai-enhance for language preservation
 * 
 * USAGE: Uncomment when ready to test against real Edge Function
 */
Deno.test({
  name: 'Edge Function - ai-enhance preserves Danish language',
  ignore: true, // Set to false when ready to run real tests
  async fn() {
    const payload = {
      businessId: 'test-business-id',
      draftText: 'Vi serverer lækker mad hver dag',
      language: 'da'
    }
    
    const response = await callEdgeFunction(
      EDGE_FUNCTION_CONFIG.functions.aiEnhance,
      payload
    )
    
    const enhancedText = response.enhancedText || response.text || ''
    
    // Check that enhancement doesn't introduce English
    const englishCheck = detectEnglishLeakage(enhancedText)
    
    assertEquals(englishCheck.hasLeakage, false,
      `Enhancement introduced English: ${englishCheck.matches.join(', ')}`)
    
    console.log('Original:', payload.draftText)
    console.log('Enhanced:', enhancedText)
  }
})

// ============================================================================
// LOAD TESTING WITH QUALITY MONITORING
// ============================================================================

/**
 * Runs load test while monitoring language quality
 * 
 * USAGE: For performance + quality testing
 */
Deno.test({
  name: 'Load Test - 50 generations maintain quality',
  ignore: true, // Set to false when ready to run load tests
  async fn() {
    const results: string[] = []
    const errors: string[] = []
    
    console.log('🔄 Running 50 test generations...')
    
    for (let i = 0; i < 50; i++) {
      try {
        const payload = {
          businessId: 'test-business-id',
          contentType: ['menu', 'atmosphere', 'behind_scenes'][i % 3],
          userIdea: 'Test content generation',
          language: 'da'
        }
        
        const response = await callEdgeFunction(
          EDGE_FUNCTION_CONFIG.functions.generateText,
          payload
        )
        
        results.push(response.text || response.cleanText || '')
        
        // Progress indicator
        if ((i + 1) % 10 === 0) {
          console.log(`   Generated ${i + 1}/50...`)
        }
      } catch (error) {
        errors.push(error.message)
      }
    }
    
    console.log('✅ Completed', results.length, 'generations')
    if (errors.length > 0) {
      console.log('⚠️  Errors:', errors.length)
    }
    
    // Assess quality
    const score = assessContentQuality(results)
    
    console.log('\n📊 Load Test Quality Report:')
    console.log('   Total Tests:', score.totalTests)
    console.log('   Passed:', score.passed)
    console.log('   Failed:', score.failed)
    console.log('   Quality Score:', score.score.toFixed(1) + '%')
    console.log('   English Leakage:', score.issues.englishLeakage, 'instances')
    console.log('   Meta-commentary:', score.issues.metaCommentary, 'instances')
    console.log('   Forbidden Phrases:', score.issues.forbiddenPhrases, 'instances')
    console.log('   Passive Voice:', score.issues.passiveVoice, 'instances')
    
    // Must maintain >95% quality even under load
    assertEquals(score.score >= 95, true,
      `Load test quality ${score.score}% below target 95%`)
  }
})

// ============================================================================
// REGRESSION TESTING
// ============================================================================

/**
 * Compares current output quality against baseline
 */
interface QualityBaseline {
  version: string
  date: string
  score: QualityScore
  samples: string[]
}

/**
 * Saves quality baseline for regression testing
 */
async function saveQualityBaseline(baseline: QualityBaseline): Promise<void> {
  const path = './quality-baseline.json'
  await Deno.writeTextFile(path, JSON.stringify(baseline, null, 2))
  console.log('💾 Baseline saved to', path)
}

/**
 * Loads quality baseline for comparison
 */
async function loadQualityBaseline(): Promise<QualityBaseline | null> {
  try {
    const path = './quality-baseline.json'
    const content = await Deno.readTextFile(path)
    return JSON.parse(content)
  } catch {
    return null
  }
}

/**
 * Regression test - compares against baseline
 * 
 * USAGE: Run after making prompt changes to ensure no quality regression
 */
Deno.test({
  name: 'Regression Test - Quality vs Baseline',
  ignore: true, // Set to false when ready to run regression tests
  async fn() {
    // Generate current samples
    const currentSamples: string[] = []
    for (let i = 0; i < 20; i++) {
      const payload = {
        businessId: 'test-business-id',
        contentType: 'menu',
        userIdea: 'Dagens ret',
        language: 'da'
      }
      
      const response = await callEdgeFunction(
        EDGE_FUNCTION_CONFIG.functions.generateText,
        payload
      )
      
      currentSamples.push(response.text || response.cleanText || '')
    }
    
    const currentScore = assessContentQuality(currentSamples)
    
    // Load baseline
    const baseline = await loadQualityBaseline()
    
    if (!baseline) {
      // No baseline - create one
      const newBaseline: QualityBaseline = {
        version: '1.0.0',
        date: new Date().toISOString(),
        score: currentScore,
        samples: currentSamples.slice(0, 5) // Save first 5 samples
      }
      
      await saveQualityBaseline(newBaseline)
      console.log('📊 No baseline found - created new baseline')
      console.log('   Quality Score:', currentScore.score.toFixed(1) + '%')
      return
    }
    
    // Compare to baseline
    console.log('📊 Regression Test Results:')
    console.log('   Baseline Score:', baseline.score.score.toFixed(1) + '%')
    console.log('   Current Score:', currentScore.score.toFixed(1) + '%')
    console.log('   Delta:', (currentScore.score - baseline.score.score).toFixed(1) + '%')
    
    // Quality must not degrade by more than 2%
    const qualityDelta = currentScore.score - baseline.score.score
    assertEquals(qualityDelta >= -2, true,
      `Quality regression detected: ${qualityDelta.toFixed(1)}% decline`)
    
    // If quality improved significantly, update baseline
    if (qualityDelta > 5) {
      console.log('🎉 Quality improvement detected! Consider updating baseline.')
    }
  }
})

// ============================================================================
// HELPER - Set up test baseline
// ============================================================================

/**
 * Helper script to establish initial quality baseline
 * Run this once before starting regression testing
 */
if (import.meta.main) {
  console.log('🔧 Setting up quality baseline...\n')
  
  // This would generate baseline samples
  // For now, just show instructions
  console.log('To set up baseline:')
  console.log('1. Enable the regression test (set ignore: false)')
  console.log('2. Run: deno test integration-example.test.ts --allow-net --allow-read --allow-write')
  console.log('3. Baseline will be saved to quality-baseline.json')
  console.log('4. Commit baseline to version control')
  console.log('\nBaseline will be used for all future regression tests.')
}
