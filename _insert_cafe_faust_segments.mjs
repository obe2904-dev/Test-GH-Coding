import { createClient } from 'npm:@supabase/supabase-js@2.39.7'
import 'jsr:@std/dotenv/load'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const supabase = createClient(supabaseUrl, supabaseKey)

const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a' // Café Faust

console.log('🎯 Inserting audience segments for Café Faust...\n')

const segments = [
  {
    name: 'Morning Coffee Rush',
    program: 'breakfast',
    timing: {
      days: [1, 2, 3, 4, 5],
      startHour: 7,
      endHour: 10
    },
    priority: 'primary',
    motivation: 'Quick caffeine fix before work',
    decision: 'convenience-first',
    goal: 'Get energized and get going',
    contentAngles: [
      'Your morning ritual, perfected',
      'First coffee, best coffee',
      'Start strong with fresh brew',
      'Wake up with us'
    ],
    requiresKitchen: false,
    minLeadTime: 15,
    maxActiveTime: 30
  },
  {
    name: 'Leisurely Brunch Crowd',
    program: 'brunch',
    timing: {
      days: [0, 6],
      startHour: 10,
      endHour: 14
    },
    priority: 'primary',
    motivation: 'Slow weekend morning, quality time',
    decision: 'experience-focused',
    goal: 'Relax and enjoy special breakfast',
    contentAngles: [
      'Weekend vibes done right',
      'Brunch is a mood',
      'Slow mornings, good company',
      'This is what weekends are for'
    ],
    requiresKitchen: true,
    minLeadTime: 30,
    maxActiveTime: 60
  },
  {
    name: 'Afternoon Work & Study',
    program: 'cafe',
    timing: {
      days: [1, 2, 3, 4, 5],
      startHour: 14,
      endHour: 17
    },
    priority: 'secondary',
    motivation: 'Focus time, productive environment',
    decision: 'atmosphere-focused',
    goal: 'Get work done in pleasant space',
    contentAngles: [
      'Your workspace away from home',
      'Focus fuel: coffee + calm',
      'Productive vibes',
      'Work better here'
    ],
    requiresKitchen: false,
    minLeadTime: 20,
    maxActiveTime: 45
  },
  {
    name: 'Evening Social',
    program: 'bar',
    timing: {
      days: [4, 5, 6],
      startHour: 17,
      endHour: 22
    },
    priority: 'primary',
    motivation: 'Unwind with friends, casual drinks',
    decision: 'social-driven',
    goal: 'Relax and socialize in cozy atmosphere',
    contentAngles: [
      'End your day the right way',
      'Cheers to good times',
      'Evening drinks, easy vibes',
      'Your local after-work spot'
    ],
    requiresKitchen: false,
    minLeadTime: 30,
    maxActiveTime: 60
  }
]

// Insert or update segments - try with just segments field first
const { data, error } = await supabase
  .from('business_audience_profile')
  .upsert({
    business_id: businessId,
    segments: segments
  })
  .select()

if (error) {
  console.error('❌ Error inserting segments:', error)
  Deno.exit(1)
}

console.log('✅ Segments inserted successfully!\n')

// Verify
const { data: verification, error: verifyError } = await supabase
  .from('business_audience_profile')
  .select('*')
  .eq('business_id', businessId)
  .single()

if (verifyError) {
  console.error('❌ Error verifying:', verifyError)
  Deno.exit(1)
}

console.log('📊 Verification:')
console.log(`   Business ID: ${verification.business_id}`)
console.log(`   Audience Breadth: ${verification.audience_breadth}`)
console.log(`   Business Model: ${verification.business_model_type}`)
console.log(`   Segments Count: ${verification.segments.length}`)
console.log('\n📝 Segments:')
verification.segments.forEach((seg, idx) => {
  console.log(`   ${idx + 1}. ${seg.name} (${seg.program})`)
  console.log(`      Days: ${seg.timing.days.join(', ')} | Hours: ${seg.timing.startHour}-${seg.timing.endHour}`)
  console.log(`      Priority: ${seg.priority}`)
})

console.log('\n🎉 Ready to test v2 function!')
