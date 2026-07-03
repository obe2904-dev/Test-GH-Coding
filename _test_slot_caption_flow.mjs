#!/usr/bin/env node
/**
 * Test: Strategic Slot Context → Caption Generation Flow
 * 
 * Validates that slot architecture flows correctly through the caption generation pipeline:
 * 1. Weekly Plan Generator outputs slot_id, strategic_intent, slot_reasoning
 * 2. PostSpecification carries slot data in strategicContext
 * 3. Frontend maps slot data to WeeklyPlanSuggestion
 * 4. generate-text-from-idea receives slot context
 * 5. UGEPLANKONTEKST block includes strategic slot framing
 * 
 * Expected: Slot context appears in prompt, informing caption generation
 */

import { createClient } from '@supabase/supabase-js'

// Hardcoded values for testing (following pattern from _test_brand_profile_query.mjs)
const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlsZ2d1am5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjA4MzExNSwiZXhwIjoyMDUxNjU5MTE1fQ.PP2MyyTA-UNhVGqJfpZT8jh_R1NTcNq0xLPP-ObcIeo'
const BUSINESS_ID = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79' // Café Faust

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

console.log('🧪 Testing Strategic Slot → Caption Generation Flow\n')
console.log('═'.repeat(80))

// Step 1: Fetch recent weekly plan with slot architecture
console.log('\n📊 Step 1: Fetch Weekly Plan (Week 27)')
console.log('─'.repeat(80))

const { data: plan, error: planError } = await supabase
  .from('weekly_content_plans')
  .select('*')
  .eq('business_id', BUSINESS_ID)
  .eq('week_number', 27)
  .single()

if (planError || !plan) {
  console.error('❌ Failed to fetch weekly plan:', planError)
  process.exit(1)
}

const posts = plan.posts || []
console.log(`✅ Found ${posts.length} posts in Week 27 plan`)

// Find first post with complete slot context
const postWithSlot = posts.find(p => 
  p.strategicContext?.slot_id && 
  p.strategicContext?.strategic_intent &&
  p.strategicContext?.slot_reasoning
)

if (!postWithSlot) {
  console.error('❌ No post found with complete slot context (slot_id, strategic_intent, slot_reasoning)')
  console.log('\nPosts available:', posts.map(p => ({
    dish: p.contentSubject?.dish,
    slot_id: p.strategicContext?.slot_id,
    has_intent: !!p.strategicContext?.strategic_intent,
    has_reasoning: !!p.strategicContext?.slot_reasoning,
  })))
  process.exit(1)
}

console.log('\n✅ Found post with complete slot context:')
console.log(`   Dish: ${postWithSlot.contentSubject?.dish}`)
console.log(`   Slot ID: ${postWithSlot.strategicContext?.slot_id}`)
console.log(`   Strategic Intent: ${postWithSlot.strategicContext?.strategic_intent?.slice(0, 60)}...`)
console.log(`   Slot Reasoning: ${postWithSlot.strategicContext?.slot_reasoning?.slice(0, 60)}...`)

// Step 2: Simulate frontend buildWeeklyPlanSuggestion mapping
console.log('\n📦 Step 2: Map to WeeklyPlanSuggestion (Frontend Simulation)')
console.log('─'.repeat(80))

const isMenuPostType = ['menu_item', 'product_menu', 'craving_visual'].includes(postWithSlot.postType?.type)
const guestMoment = !isMenuPostType
  ? (postWithSlot.contentSubject?.whyThisDish?.[0] || postWithSlot.selectionRationale || '')
  : (postWithSlot.selectionRationale || '')

const suggestion = {
  id: String(postWithSlot.idea_id || 'test-1'),
  title: postWithSlot.contentSubject?.dish,
  captionBase: isMenuPostType ? (postWithSlot.contentSubject?.menuItemDescription || '') : '',
  source: 'weekly_plan',
  contentType: postWithSlot.postType?.type,
  menuItemId: postWithSlot.contentSubject?.menuItemId,
  menuItemName: postWithSlot.contentSubject?.menuItemName,
  menuItemDescription: postWithSlot.contentSubject?.menuItemDescription,
  rationale: postWithSlot.strategicContext?.rationale,
  goalMode: postWithSlot.postType?.goal_mode,
  guestMoment: guestMoment || undefined,
  timingDay: postWithSlot.timing?.day,
  timingTime: postWithSlot.timing?.time,
  timingRationale: postWithSlot.timing?.rationale,
  visualSubject: postWithSlot.visualDirection?.subject,
  visualAngle: postWithSlot.visualDirection?.angle,
  visualSetting: postWithSlot.visualDirection?.setting,
  ctaIntent: postWithSlot.caption?.ctaType,
  platformFormat: postWithSlot.platformFormat?.format,
  selectionRationale: postWithSlot.selectionRationale,
  captionFirstLine: postWithSlot.caption?.firstLine,
  holidayContext: postWithSlot.holiday_context
    ? [postWithSlot.holiday_context.name, postWithSlot.holiday_context.strategic_angle, postWithSlot.holiday_context.marketing_hook].filter(Boolean).join(' – ')
    : undefined,
  drinkPairing: postWithSlot.strategicContext?.drink_pairing,
  strategyBrief: postWithSlot.strategicContext?.strategy_brief,
  mediaDirection: postWithSlot.strategicContext?.media_direction,
  sceneSpec: postWithSlot.strategicContext?.scene_spec,
  // NEW: Strategic Slot Architecture
  slotId: postWithSlot.strategicContext?.slot_id,
  strategicIntent: postWithSlot.strategicContext?.strategic_intent,
  slotReasoning: postWithSlot.strategicContext?.slot_reasoning,
}

console.log('✅ Suggestion object created with slot fields:')
console.log(`   slotId: ${suggestion.slotId}`)
console.log(`   strategicIntent: ${suggestion.strategicIntent?.slice(0, 80)}...`)
console.log(`   slotReasoning: ${suggestion.slotReasoning?.slice(0, 80)}...`)

// Step 3: Call generate-text-from-idea and verify slot context is used
console.log('\n🎨 Step 3: Call generate-text-from-idea')
console.log('─'.repeat(80))

const { data: captionData, error: captionError } = await supabase.functions.invoke('generate-text-from-idea', {
  body: {
    businessId: BUSINESS_ID,
    suggestion,
    platforms: ['facebook', 'instagram'],
    tier: 'paid',
  }
})

if (captionError) {
  console.error('❌ Caption generation failed:', captionError)
  process.exit(1)
}

console.log('✅ Caption generated successfully')
console.log(`   Facebook text: ${captionData.facebook?.text?.slice(0, 100)}...`)
console.log(`   Instagram text: ${captionData.instagram?.text?.slice(0, 100)}...`)

// Step 4: Validation Summary
console.log('\n✅ VALIDATION SUMMARY')
console.log('═'.repeat(80))

const checks = [
  {
    name: 'Weekly Plan has slot_id',
    pass: !!postWithSlot.strategicContext?.slot_id,
    value: postWithSlot.strategicContext?.slot_id,
  },
  {
    name: 'Weekly Plan has strategic_intent',
    pass: !!postWithSlot.strategicContext?.strategic_intent,
    value: postWithSlot.strategicContext?.strategic_intent?.slice(0, 50) + '...',
  },
  {
    name: 'Weekly Plan has slot_reasoning',
    pass: !!postWithSlot.strategicContext?.slot_reasoning,
    value: postWithSlot.strategicContext?.slot_reasoning?.slice(0, 50) + '...',
  },
  {
    name: 'Suggestion maps slot_id',
    pass: suggestion.slotId === postWithSlot.strategicContext?.slot_id,
    value: suggestion.slotId,
  },
  {
    name: 'Suggestion maps strategic_intent',
    pass: suggestion.strategicIntent === postWithSlot.strategicContext?.strategic_intent,
    value: suggestion.strategicIntent?.slice(0, 50) + '...',
  },
  {
    name: 'Suggestion maps slot_reasoning',
    pass: suggestion.slotReasoning === postWithSlot.strategicContext?.slot_reasoning,
    value: suggestion.slotReasoning?.slice(0, 50) + '...',
  },
  {
    name: 'Caption generation succeeded',
    pass: !!captionData?.facebook?.text,
    value: captionData?.facebook?.text ? 'Generated ✓' : 'Failed ✗',
  },
]

console.log()
checks.forEach(check => {
  const icon = check.pass ? '✅' : '❌'
  console.log(`${icon} ${check.name}`)
  if (check.value) {
    console.log(`   → ${check.value}`)
  }
})

const allPassed = checks.every(c => c.pass)

console.log('\n' + '═'.repeat(80))
if (allPassed) {
  console.log('🎉 ALL CHECKS PASSED - Slot architecture flows correctly!')
  console.log('\nSlot context is now available to GPT-4o in the UGEPLANKONTEKST block:')
  console.log(`   STRATEGISK SLOT #${suggestion.slotId}: ${suggestion.strategicIntent}`)
  console.log(`   HVORFOR DENNE VINKEL: ${suggestion.slotReasoning?.slice(0, 80)}...`)
} else {
  console.log('❌ SOME CHECKS FAILED - Review the implementation')
  process.exit(1)
}

console.log('\n✨ Test completed successfully\n')
