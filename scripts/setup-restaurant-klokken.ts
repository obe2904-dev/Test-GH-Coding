// Setup Restaurant Klokken test business
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'http://localhost:54321'
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_KEY not found')
  Deno.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🏢 Setting up Restaurant Klokken...\n')

// Get or create user for Restaurant Klokken
console.log('🔍 Getting/creating user for Restaurant Klokken...')

let userId: string

// Try to find existing user first
const { data: existingUsers } = await supabase.auth.admin.listUsers()
const existingUser = existingUsers?.users.find(u => u.email === 'test-klokken@p2g-test.com')

if (existingUser) {
  userId = existingUser.id
  console.log('✅ Found existing user ID:', userId)
} else {
  // Create new user
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: 'test-klokken@p2g-test.com',
    email_confirm: true,
    password: Math.random().toString(36).slice(-16)
  })

  if (authError) {
    console.error('❌ Error creating user:', authError)
    Deno.exit(1)
  }

  userId = authUser.user.id
  console.log('✅ Created user ID:', userId)
}

// Create business
const { data: business, error: businessError } = await supabase
  .from('businesses')
  .insert({
    owner_id: userId,
    name: 'Restaurant Klokken',
    vertical: 'FSE',
    website_url: 'https://restaurantklokken.dk',
    primary_language: 'da'
  })
  .select()
  .single()

if (businessError) {
  console.error('❌ Error creating business:', businessError)
  Deno.exit(1)
}

const businessId = business.id
console.log(`✅ Created business: ${business.name} (${businessId})`)

// Create business profile
await supabase.from('business_profile').insert({
  business_id: businessId,
  short_description: 'Moderne nordisk gastronomi i hjertet af Aarhus',
  long_description: 'Restaurant Klokken tilbyder en unik madoplevelse med fokus på sæsonbetonede råvarer og nordisk håndværk.',
  price_level: 'high',
  target_audience: 'Madentusiaster, særlige lejligheder, gourmets',
  founded_year: 2018
})

console.log('✅ Created business profile')

// Create brand profile
const { error: brandError } = await supabase.from('business_brand_profile').insert({
  business_id: businessId,
  tone_keywords: ['Raffineret', 'Passioneret', 'Autentisk', 'Nordisk', 'Håndværk'],
  voice_style: 'Sofistikeret men tilgængeligt',
  values: ['Bæredygtighed', 'Råvarekvalitet', 'Håndværk'],
  never_say: [
    'kom forbi', 'nyd', 'nyder', 'nydes', 'oplev', 'oplevelse', 'autentisk', 
    'unik', 'unikke', 'skøn', 'dejlig', 'dejligt', 'lækker', 'lækkert', 
    'hyggelig', 'hyggeligt', 'perfekt', 'perfekte', 'fantastisk'
  ],
  signature_phrases: [
    'Vores 3-retters menu',
    'Sæsonens råvarer fra lokale producenter',
    'Nordisk gastronomi med moderne twist'
  ],
  typical_openings: ['Denne uge på Restaurant Klokken', 'Vores køkken'],
  typical_closings: ['Book dit bord', 'Reservér via vores hjemmeside'],
  humor_level: 'subtle',
  formality: 'professional'
})

if (brandError) {
  console.error('❌ Error creating brand profile:', brandError)
  Deno.exit(1)
}

console.log('✅ Created brand profile')

// Create location
await supabase.from('business_locations').insert({
  business_id: businessId,
  label: 'Hovedlokation',
  address_line1: 'M.P. Bruuns Gade 31',
  postal_code: '8000',
  city: 'Aarhus',
  country: 'Denmark',
  is_primary: true
})

console.log('✅ Created location')

// Create opening hours
const hours = [
  { weekday: 'tuesday', open_time: '17:30:00', close_time: '22:00:00', closed: false },
  { weekday: 'wednesday', open_time: '17:30:00', close_time: '22:00:00', closed: false },
  { weekday: 'thursday', open_time: '17:30:00', close_time: '22:00:00', closed: false },
  { weekday: 'friday', open_time: '17:30:00', close_time: '23:00:00', closed: false },
  { weekday: 'saturday', open_time: '17:30:00', close_time: '23:00:00', closed: false },
  { weekday: 'sunday', closed: true },
  { weekday: 'monday', closed: true }
]

for (const hour of hours) {
  await supabase.from('opening_hours').insert({
    business_id: businessId,
    ...hour,
    kind: 'normal'
  })
}

console.log('✅ Created opening hours (Tue-Sat, 17:30-22:00)')

// Create operations
await supabase.from('business_operations').insert({
  business_id: businessId,
  seating_capacity_indoor: 65,
  has_booking_system: true,
  has_takeaway: false,
  has_delivery: false,
  has_outdoor_seating: false,
  establishment_type: 'restaurant',
  preferred_posts_per_week: 4
})

console.log('✅ Created operations data')

// Create menu items
const menuItems = [
  { name: 'Tartare af Dansk Okse med Trøffel', category: 'Forretter', is_signature: true, seasonal: false },
  { name: 'Kammusling fra Limfjorden', category: 'Forretter', is_signature: true, seasonal: true },
  { name: 'Helstegt Pigeon', category: 'Hovedretter', is_signature: true, seasonal: true },
  { name: 'Torsk fra Skagerrak', category: 'Hovedretter', is_signature: true, seasonal: true },
  { name: 'Lammeryg fra Fanø', category: 'Hovedretter', is_signature: true, seasonal: true },
  { name: 'Rabarber og Jordbær', category: 'Desserter', is_signature: false, seasonal: true },
  { name: 'Chokoladefondant', category: 'Desserter', is_signature: true, seasonal: false },
  { name: 'Oste fra Danmark', category: 'Desserter', is_signature: false, seasonal: false }
]

for (const item of menuItems) {
  await supabase.from('menu_item_metadata').insert({
    business_id: businessId,
    item_name: item.name,
    item_category: item.category,
    item_section: 'dinner',
    is_signature: item.is_signature,
    is_seasonal: item.seasonal,
    dish_temp_category: item.category === 'Desserter' ? 'cold' : 'hot'
  })
}

console.log('✅ Created 8 menu items')

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('✅ Restaurant Klokken setup complete!')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`\n📋 Business ID: ${businessId}`)
console.log('🏷️  Type: FSE (Fine Service Establishment)')
console.log('📍 Location: Aarhus, Denmark')
console.log('🍽️  Menu: 8 signature dishes')
console.log('🕐 Hours: Tue-Sat, 17:30-22:00')
console.log('\n🎯 Next: Test strategy generation with this business!')
