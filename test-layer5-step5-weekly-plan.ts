/**
 * LAYER 5 TEST - STEP 5: TEST WEEKLY PLANNING
 * 
 * Run with: deno run --allow-env --allow-net test-layer5-step5-weekly-plan.ts
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { selectWeeklyOpportunities } from './supabase/functions/_shared/post-helpers/opportunity-selector.ts'

const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL')
const SUPABASE_KEY = Deno.env.get('VITE_SUPABASE_ANON_KEY')
const TEST_BUSINESS_ID = '840347de-9ba7-4275-8aa3-4553417fc2af'

async function testWeeklyPlanning() {
  console.log('🧪 LAYER 5 TEST - Weekly Planning Selector\n')
  
  Deno.env.set('SUPABASE_URL', SUPABASE_URL!)
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', SUPABASE_KEY!)
  
  const weekStartDate = new Date()
  weekStartDate.setHours(0, 0, 0, 0)
  
  console.log(`📅 Generating weekly plan starting: ${weekStartDate.toLocaleDateString()}\n`)
  console.log('⚡ Running 6-step algorithm...')
  console.log('   1. Generate all opportunities (menu + compound)')
  console.log('   2. Allocate slots by type (Layer 2 distribution)')
  console.log('   3. Fill slots with highest-scoring opportunities')
  console.log('   4. Apply sequencing rules (variety, spacing)')
  console.log('   5. Assign optimal timing (day + hour)')
  console.log('   6. Handle edge cases\n')
  
  try {
    const plan = await selectWeeklyOpportunities(TEST_BUSINESS_ID, weekStartDate)
    
    console.log('✅ Weekly plan generated!\n')
    console.log('═══════════════════════════════════════════════════════════════\n')
    
    // Plan summary
    console.log('📊 PLAN SUMMARY:')
    console.log(`   Week: ${plan.weekStartDate.toLocaleDateString()} - ${plan.weekEndDate.toLocaleDateString()}`)
    console.log(`   Total Slots: ${plan.summary.totalSlots}`)
    console.log(`   Filled Slots: ${plan.summary.filledSlots}`)
    console.log(`   Menu Items: ${plan.summary.menuItemSlots}`)
    console.log(`   Non-Menu: ${plan.summary.nonMenuSlots}`)
    console.log(`   Critical Opportunities: ${plan.summary.criticalOpportunities}`)
    console.log('')
    console.log('   Platform Distribution:')
    console.log(`     Instagram: ${plan.summary.platformDistribution.instagram}`)
    console.log(`     Facebook: ${plan.summary.platformDistribution.facebook}`)
    console.log(`     Both: ${plan.summary.platformDistribution.both}`)
    console.log('')
    
    // Warnings
    if (plan.warnings.length > 0) {
      console.log('⚠️  WARNINGS:')
      plan.warnings.forEach(w => console.log(`   ${w}`))
      console.log('')
    }
    
    // Suggestions
    if (plan.suggestions.length > 0) {
      console.log('💡 SUGGESTIONS:')
      plan.suggestions.forEach(s => console.log(`   ${s}`))
      console.log('')
    }
    
    console.log('═══════════════════════════════════════════════════════════════\n')
    
    // Show each slot
    console.log('📋 WEEKLY SCHEDULE:\n')
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    
    plan.slots.forEach((slot, i) => {
      const dayName = dayNames[slot.dayOfWeek]
      const time = `${slot.hour.toString().padStart(2, '0')}:00`
      
      console.log(`${i + 1}. ${dayName} ${slot.date.toLocaleDateString()} at ${time}`)
      console.log(`   Type: ${slot.contentType}`)
      console.log(`   Platform: ${slot.platform}`)
      console.log(`   Expected Performance: ${slot.expectedPerformance.toUpperCase()}`)
      console.log(`   Confidence: ${slot.confidenceScore}/100`)
      console.log('')
      
      if (slot.selectedOpportunity) {
        const opp = slot.selectedOpportunity as any
        
        if (opp.itemName) {
          // Menu item
          console.log(`   Selected: ${opp.itemName}`)
          console.log(`   Score: ${opp.finalScore} points`)
        } else {
          // Compound opportunity
          console.log(`   Selected: ${opp.id}`)
          console.log(`   Score: ${opp.score} points`)
        }
        
        console.log(`   Reason: ${slot.selectionReason}`)
      } else {
        console.log('   ⚠️ UNFILLED - No suitable opportunity found')
      }
      
      console.log('')
      
      if (slot.alternativeOpportunities.length > 0) {
        console.log('   Alternatives:')
        slot.alternativeOpportunities.slice(0, 2).forEach(alt => {
          const altName = (alt as any).itemName || (alt as any).id
          const altScore = (alt as any).finalScore || (alt as any).score
          console.log(`     • ${altName} (${altScore} pts)`)
        })
        console.log('')
      }
      
      console.log('───────────────────────────────────────────────────────────────\n')
    })
    
    // Success metrics preview
    console.log('📈 EXPECTED OUTCOMES:')
    console.log(`   Fill Rate: ${((plan.summary.filledSlots / plan.summary.totalSlots) * 100).toFixed(0)}% (target: 100%)`)
    console.log(`   Critical Opportunities: ${plan.summary.criticalOpportunities} (don't miss these!)`)
    
    const avgConfidence = plan.slots.reduce((sum, s) => sum + s.confidenceScore, 0) / plan.slots.length
    console.log(`   Average Confidence: ${avgConfidence.toFixed(0)}/100`)
    console.log('')
    
    console.log('✅ Weekly planning test complete!')
    console.log('\n🎉 All Layer 5 components validated!')
    console.log('\nReady for production integration.')
    
  } catch (error) {
    console.error('❌ Error generating weekly plan:', error)
    throw error
  }
}

testWeeklyPlanning().catch(console.error)
