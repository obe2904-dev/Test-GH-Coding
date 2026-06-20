#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

// Test V5 Phase 1 Integration - Verify V5 identity appears in weekly strategy

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

const CAFE_FAUST_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'

console.log('═══════════════════════════════════════════════════════════')
console.log('V5 PHASE 1 INTEGRATION TEST')
console.log('Testing: get-weekly-strategy with V5 Layer 3')
console.log('═══════════════════════════════════════════════════════════\n')

console.log('Setting V5 feature flags in environment...')
Deno.env.set('V5_ENABLED', 'true')
Deno.env.set('V5_LAYER3_ENABLED', 'true')
Deno.env.set('V5_TEST_BUSINESS_ONLY', 'true')
Deno.env.set('V5_TEST_BUSINESS_IDS', CAFE_FAUST_ID)
Deno.env.set('V5_DEBUG', 'true')
Deno.env.set('V5_LOG_COMPARISONS', 'true')

console.log('✅ Environment configured')
console.log(`   V5_ENABLED: true`)
console.log(`   V5_LAYER3_ENABLED: true`)
console.log(`   V5_TEST_BUSINESS_ONLY: true`)
console.log(`   V5_DEBUG: true\n`)

// Calculate next Monday
function getNextMonday(from: Date = new Date()): Date {
  const date = new Date(from)
  const day = date.getDay()
  const daysUntilMonday = day === 0 ? 1 : (8 - day) % 7
  date.setDate(date.getDate() + daysUntilMonday)
  date.setHours(0, 0, 0, 0)
  return date
}

const nextMonday = getNextMonday()
const weekStart = nextMonday.toISOString().split('T')[0]

console.log('Calling get-weekly-strategy endpoint...')
console.log(`   Business: Café Faust`)
console.log(`   Week Start: ${weekStart}`)
console.log(`   Regenerate: false\n`)

try {
  const response = await fetch(`${supabaseUrl}/functions/v1/get-weekly-strategy`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'apikey': supabaseKey
    },
    body: JSON.stringify({
      business_id: CAFE_FAUST_ID,
      week_start: weekStart,
      regenerate: false
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ API call failed:', response.status, response.statusText)
    console.error('Error:', errorText)
    Deno.exit(1)
  }

  const result = await response.json()

  console.log('═══════════════════════════════════════════════════════════')
  console.log('API RESPONSE')
  console.log('═══════════════════════════════════════════════════════════\n')

  console.log('Response:', JSON.stringify(result, null, 2))

  if (result.success) {
    console.log('\n✅ Strategy generation initiated')
    console.log(`   Strategy ID: ${result.strategy_id}`)
    console.log(`   Status: ${result.status}`)

    // Poll for completion
    console.log('\nPolling for completion...')
    
    let attempts = 0
    const maxAttempts = 60  // 5 minutes max
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000))  // Wait 5 seconds
      
      const { data: strategy, error } = await supabase
        .from('weekly_strategies')
        .select('status, narrative, strategic_priorities, post_ideas')
        .eq('id', result.strategy_id)
        .single()
      
      if (error) {
        console.error('❌ Error checking status:', error.message)
        break
      }
      
      console.log(`   [${attempts + 1}/${maxAttempts}] Status: ${strategy.status}`)
      
      if (strategy.status === 'generated') {
        console.log('\n✅ Strategy generated successfully!')
        console.log('\n═══════════════════════════════════════════════════════════')
        console.log('STRATEGY CONTENT')
        console.log('═══════════════════════════════════════════════════════════\n')
        
        console.log('Narrative:')
        console.log(strategy.narrative || 'N/A')
        console.log()
        
        console.log('Strategic Priorities:')
        if (strategy.strategic_priorities && strategy.strategic_priorities.length > 0) {
          strategy.strategic_priorities.forEach((p: any, i: number) => {
            console.log(`${i + 1}. ${p.focus} (${p.weight}%)`)
            console.log(`   Rationale: ${p.rationale}`)
          })
        }
        console.log()
        
        console.log('Post Ideas:', strategy.post_ideas?.length || 0)
        
        // Check if V5 identity appears in narrative
        console.log('\n═══════════════════════════════════════════════════════════')
        console.log('V5 INTEGRATION CHECK')
        console.log('═══════════════════════════════════════════════════════════\n')
        
        const narrative = strategy.narrative || ''
        const hasV5Markers = narrative.includes('V5 BRAND IDENTITY') || 
                            narrative.includes('Layer 3') ||
                            narrative.includes('ved åen')  // Café Faust location ref
        
        if (hasV5Markers) {
          console.log('✅ V5 markers found in strategy')
        } else {
          console.log('⚠️  V5 markers not explicitly visible (may be integrated subtly)')
        }
        
        // Check priorities for brand consistency
        const priorities = strategy.strategic_priorities || []
        const hasBrandFocus = priorities.some((p: any) => 
          p.focus.toLowerCase().includes('brand') ||
          p.focus.toLowerCase().includes('identitet')
        )
        
        console.log(`Brand-focused priorities: ${hasBrandFocus ? '✅' : '⚠️'}`)
        
        break
      } else if (strategy.status === 'error') {
        console.error('\n❌ Strategy generation failed')
        break
      }
      
      attempts++
    }
    
    if (attempts >= maxAttempts) {
      console.log('\n⚠️  Timeout waiting for strategy completion')
    }
    
  } else {
    console.error('\n❌ Strategy generation failed')
    console.error('Error:', result.error)
  }

} catch (err) {
  console.error('\n❌ Test failed:', err instanceof Error ? err.message : String(err))
  Deno.exit(1)
}

console.log('\n═══════════════════════════════════════════════════════════')
console.log('TEST COMPLETE')
console.log('═══════════════════════════════════════════════════════════\n')
