/**
 * PHASE 1 TEST: Verify Bug #3 and #4 Fixes
 * 
 * Bug #3: Menu scoring should be varied (not hardcoded 70)
 * Bug #4: No time collisions
 * 
 * Run: deno run --allow-env --allow-net test-phase1-fixes.ts
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')
const SUPABASE_KEY = Deno.env.get('VITE_SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY')

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing environment variables')
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗')
  console.error('   SUPABASE_KEY:', SUPABASE_KEY ? '✓' : '✗')
  Deno.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const CAFE_FAUST_ID = '840347de-9ba7-4275-8aa3-4553417fc2af'

console.log('🧪 PHASE 1 TEST: Bug #3 and #4 Fixes')
console.log('=' .repeat(70))
console.log('')

// Step 1: Check if there's a recent plan (generated after fix deployment)
console.log('📅 Step 1: Checking for test plan...')
console.log(`   Business ID: ${CAFE_FAUST_ID}`)
console.log('')

// Get the latest plan
const { data: latestPlan, error: planError } = await supabase
  .from('weekly_content_plans')
  .select('*')
  .eq('business_id', CAFE_FAUST_ID)
  .order('created_at', { ascending: false })
  .limit(1)
  .single()

if (planError || !latestPlan) {
  console.error('❌ No plan found in database')
  console.error('')
  console.error('⚠️  Please generate a new weekly plan through your UI first:')
  console.error('   1. Go to your app')
  console.error('   2. Navigate to Café Faust')
  console.error('   3. Generate a weekly plan for week starting Feb 2, 2026')
  console.error('   4. Then run this test again')
  console.error('')
  Deno.exit(1)
}

const planDate = new Date(latestPlan.created_at)
const now = new Date()
const ageMinutes = Math.floor((now.getTime() - planDate.getTime()) / 1000 / 60)

console.log(`✅ Found plan created ${ageMinutes} minutes ago`)
console.log(`   Created: ${planDate.toISOString()}`)
console.log(`   Week start: ${latestPlan.week_start_date}`)
console.log('')

if (ageMinutes > 30) {
  console.log('⚠️  WARNING: This plan is older than 30 minutes')
  console.log('   It may have been created BEFORE Phase 1 fixes were deployed')
  console.log('   For accurate testing, generate a NEW plan through your UI')
  console.log('')
}

// Step 2: Verify Bug #3 - Scores should be varied
console.log('🔍 Step 2: Verifying Bug #3 Fix (Scoring)')
console.log('-'.repeat(70))

const posts = latestPlan.posts as any[]
const scores = posts.map(p => p.opportunity?.finalScore).filter(Boolean)

console.log(`📊 Score Analysis:`)
console.log(`   Total posts: ${posts.length}`)
console.log(`   Scores: ${scores.join(', ')}`)
console.log('')

// Check if all scores are the same (bug not fixed)
const uniqueScores = [...new Set(scores)]
console.log(`   Unique scores: ${uniqueScores.length}`)
console.log(`   Min score: ${Math.min(...scores)}`)
console.log(`   Max score: ${Math.max(...scores)}`)
console.log(`   Avg score: ${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}`)
console.log('')

if (uniqueScores.length === 1 && uniqueScores[0] === 70) {
  console.log('❌ BUG #3 NOT FIXED: All scores are still 70')
  console.log('   Expected: Varied scores based on seasonal, weather, location factors')
} else if (uniqueScores.length === 1) {
  console.log(`⚠️  BUG #3 PARTIALLY FIXED: All scores are ${uniqueScores[0]}`)
  console.log('   Expected: Multiple different scores')
} else {
  console.log('✅ BUG #3 FIXED: Scores are varied!')
  console.log('')
  console.log('   Score breakdown by post:')
  posts.forEach(p => {
    const score = p.opportunity?.finalScore
    const breakdown = p.opportunity?.scoreBreakdown
    const subject = p.contentSubject?.dish || p.contentSubject?.theme || 'Unknown'
    console.log(`   - ${subject}: ${score} pts`)
    if (breakdown) {
      console.log(`     Base: ${breakdown.baseScore}, Seasonal: ${breakdown.seasonalBonus}, Weather: ${breakdown.weatherBonus}`)
    }
  })
}

console.log('')

// Step 3: Verify Bug #4 - No time collisions
console.log('🔍 Step 3: Verifying Bug #4 Fix (Collision Detection)')
console.log('-'.repeat(70))

const schedule = posts.map(p => ({
  subject: p.contentSubject?.dish || p.contentSubject?.theme || 'Unknown',
  day: p.timing?.day,
  time: p.timing?.time,
  type: p.postType?.type,
}))

console.log('📅 Schedule:')
schedule.forEach(s => {
  console.log(`   ${s.day} ${s.time} - ${s.subject} (${s.type})`)
})
console.log('')

// Check for collisions
const timeSlots = new Map<string, string[]>()
schedule.forEach(s => {
  const key = `${s.day}-${s.time}`
  if (!timeSlots.has(key)) {
    timeSlots.set(key, [])
  }
  timeSlots.get(key)!.push(s.subject)
})

const collisions = Array.from(timeSlots.entries()).filter(([_, subjects]) => subjects.length > 1)

if (collisions.length > 0) {
  console.log('❌ BUG #4 NOT FIXED: Time collisions detected!')
  console.log('')
  collisions.forEach(([slot, subjects]) => {
    console.log(`   ${slot}: ${subjects.join(' + ')} ❌ COLLISION`)
  })
} else {
  console.log('✅ BUG #4 FIXED: No time collisions!')
  console.log(`   All ${schedule.length} posts have unique time slots`)
  
  // Check for collision notes
  const rescheduled = posts.filter(p => 
    p.timing?.timeRationale?.toLowerCase().includes('collision')
  )
  
  if (rescheduled.length > 0) {
    console.log('')
    console.log('   Posts that were rescheduled to avoid collisions:')
    rescheduled.forEach(p => {
      const subject = p.contentSubject?.dish || p.contentSubject?.theme || 'Unknown'
      console.log(`   - ${subject}: ${p.timing?.timeRationale}`)
    })
  }
}

console.log('')
console.log('=' .repeat(70))
console.log('✅ PHASE 1 TESTING COMPLETE')
console.log('')
console.log('Summary:')
console.log(`  Bug #3 (Scoring): ${uniqueScores.length > 1 ? '✅ FIXED' : '❌ NOT FIXED'}`)
console.log(`  Bug #4 (Collision): ${collisions.length === 0 ? '✅ FIXED' : '❌ NOT FIXED'}`)
console.log('')
