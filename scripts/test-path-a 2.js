/**
 * PATH A INTEGRATION TESTER
 * 
 * Tests the complete Path A flow:
 * Layer 0 (get-weekly-strategy) → User selection → generate-weekly-plan (Layers 6-8)
 * 
 * This verifies:
 * - Strategy generation with ideas
 * - Path A with strategy_id + selected_idea_ids
 * - Correct city hashtags (#Aarhus, not #København)
 * - CTA intent preservation
 * - Strategic context flow
 */

import { createClient } from '@supabase/supabase-js'

// Configuration
const CONFIG = {
  supabaseUrl: 'http://127.0.0.1:54321',
  // Use service_role key for testing (has full permissions)
  serviceRoleKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  
  // Test business (Café Faust in Aarhus)
  businessId: '840347de-9ba7-4275-8aa3-4553417fc2af',
}

const supabase = createClient(CONFIG.supabaseUrl, CONFIG.serviceRoleKey)

// ============================================================================
// MAIN TEST FUNCTION
// ============================================================================

async function testPathA() {
  console.log('\n🎯 PATH A INTEGRATION TEST\n')
  console.log('=' .repeat(80))
  console.log(`🏢 Business: Café Faust (Aarhus)`)
  console.log(`📍 Expected City: Aarhus`)
  console.log(`🚫 Should NOT see: København, CPH, FoodieKbh`)
  console.log('=' .repeat(80))
  console.log()
  
  try {
    // STEP 1: Generate Layer 0 Strategy
    console.log('📋 STEP 1: Generating Layer 0 Strategy...')
    console.log('─'.repeat(80))
    
    const weekStart = getNextMonday()
    const strategyResult = await generateStrategy(weekStart)
    
    if (!strategyResult.success) {
      throw new Error(`Strategy generation failed: ${strategyResult.error}`)
    }
    
    console.log(`✅ Strategy generated: ${strategyResult.strategy_id}`)
    console.log(`   Post ideas: ${strategyResult.strategy.post_ideas.length}`)
    console.log()
    
    // Display ideas
    console.log('💡 Strategic Ideas:')
    strategyResult.strategy.post_ideas.forEach((idea, i) => {
      console.log(`   ${i + 1}. ${idea.title} (ID: ${idea.id})`)
      console.log(`      CTA: ${idea.cta_intent || 'none'}`)
      console.log(`      Day: ${idea.suggested_day || 'none'}`)
    })
    console.log()
    
    // STEP 2: Select Ideas (simulate user selection)
    const selectedIdeaIds = strategyResult.strategy.post_ideas
      .slice(0, 3) // Select first 3 ideas
      .map(idea => idea.id)
    
    console.log('👆 STEP 2: User selects ideas...')
    console.log('─'.repeat(80))
    console.log(`   Selected: ${selectedIdeaIds.join(', ')}`)
    console.log()
    
    // STEP 3: Generate Weekly Plan (PATH A)
    console.log('🚀 STEP 3: Generating Weekly Plan (PATH A)...')
    console.log('─'.repeat(80))
    console.log(`   Calling: generate-weekly-plan`)
    console.log(`   Strategy ID: ${strategyResult.strategy_id}`)
    console.log(`   Selected IDs: [${selectedIdeaIds.join(', ')}]`)
    console.log()
    
    const planResult = await generateWeeklyPlan(
      weekStart,
      strategyResult.strategy_id,
      selectedIdeaIds
    )
    
    if (!planResult.success) {
      throw new Error(`Weekly plan generation failed: ${planResult.error}`)
    }
    
    console.log(`✅ Weekly plan generated!`)
    console.log(`   Posts: ${planResult.posts?.length || 0}`)
    console.log()
    
    // STEP 4: Analyze Results
    console.log('🔍 STEP 4: Analyzing Results...')
    console.log('─'.repeat(80))
    console.log()
    
    let hasErrors = false
    
    planResult.posts.forEach((post, i) => {
      console.log(`📝 Post ${i + 1}: ${post.title}`)
      console.log(`   Platform: ${post.platform}`)
      console.log(`   Caption: ${post.caption?.substring(0, 100)}...`)
      console.log()
      
      // Check hashtags
      console.log(`   🏷️  Hashtags (${post.hashtags?.length || 0}):`)
      const hashtags = post.hashtags || []
      
      hashtags.forEach(tag => {
        const isLocationTag = tag.toLowerCase().includes('kbh') || 
                              tag.toLowerCase().includes('københavn') ||
                              tag.toLowerCase().includes('aarhus')
        const indicator = isLocationTag ? '📍' : '  '
        console.log(`   ${indicator} #${tag}`)
      })
      
      // Validate hashtags
      const hasKøbenhavn = hashtags.some(t => 
        t.toLowerCase().includes('kbh') || 
        t.toLowerCase().includes('københavn')
      )
      const hasAarhus = hashtags.some(t => 
        t.toLowerCase().includes('aarhus')
      )
      
      console.log()
      if (hasKøbenhavn) {
        console.log(`   ❌ BUG: København hashtags found in Aarhus post!`)
        hasErrors = true
      } else if (hasAarhus) {
        console.log(`   ✅ CORRECT: Aarhus hashtags present`)
      } else {
        console.log(`   ⚠️  WARNING: No location hashtags found`)
      }
      
      // Check CTA
      if (post.cta_text) {
        console.log(`   📢 CTA: ${post.cta_text}`)
      }
      
      // Check visual direction
      if (post.visual_direction) {
        console.log(`   📸 Visual: ${post.visual_direction.substring(0, 60)}...`)
      }
      
      console.log()
      console.log('─'.repeat(80))
      console.log()
    })
    
    // Final verdict
    console.log('\n' + '='.repeat(80))
    if (hasErrors) {
      console.log('❌ PATH A TEST FAILED: Location hashtag bug still present')
    } else {
      console.log('✅ PATH A TEST PASSED: All posts have correct location hashtags!')
    }
    console.log('='.repeat(80))
    console.log()
    
    return !hasErrors
    
  } catch (error) {
    console.error('\n❌ TEST FAILED WITH ERROR:')
    console.error(error.message)
    console.error(error.stack)
    return false
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function generateStrategy(weekStart) {
  const response = await fetch(
    `${CONFIG.supabaseUrl}/functions/v1/get-weekly-strategy`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.serviceRoleKey}`,
      },
      body: JSON.stringify({
        business_id: CONFIG.businessId,
        week_start: weekStart,
        regenerate: true,
      }),
    }
  )
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`)
  }
  
  return await response.json()
}

async function generateWeeklyPlan(weekStart, strategyId, selectedIdeaIds) {
  const response = await fetch(
    `${CONFIG.supabaseUrl}/functions/v1/generate-weekly-plan`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.serviceRoleKey}`,
      },
      body: JSON.stringify({
        weekStart: weekStart,
        strategy_id: strategyId,
        selected_idea_ids: selectedIdeaIds,
        regenerate: true,
        business_id: CONFIG.businessId, // For service_role calls
      }),
    }
  )
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`HTTP ${response.status}: ${errorText}`)
  }
  
  return await response.json()
}

function getNextMonday() {
  const today = new Date()
  const nextMonday = new Date(today)
  nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7))
  return nextMonday.toISOString().split('T')[0]
}

// ============================================================================
// RUN TEST
// ============================================================================

testPathA().then(success => {
  process.exit(success ? 0 : 1)
}).catch(error => {
  console.error('\n❌ FATAL ERROR:', error)
  process.exit(1)
})
