// Setup 10 test businesses for full onboarding testing
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'http://localhost:54321'
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_KEY not found')
  Deno.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Test business templates
const testBusinesses = [
  {
    name: 'Café Solskin',
    email: 'test-cafe-solskin@p2g-test.com',
    vertical: 'SBO',
    city: 'København',
    website: 'https://example.com/cafe-solskin',
    description: 'Hyggelig café i hjertet af København'
  },
  {
    name: 'Vinbar Nordlys',
    email: 'test-vinbar-nordlys@p2g-test.com',
    vertical: 'SBO_wine',
    city: 'Aarhus',
    website: 'https://example.com/vinbar-nordlys',
    description: 'Specialiseret vinbar med fokus på biodynamiske vine'
  },
  {
    name: 'Coffee House Ø',
    email: 'test-coffee-house@p2g-test.com',
    vertical: 'SBO_coffee',
    city: 'Odense',
    website: 'https://example.com/coffee-house',
    description: 'Specialty coffee og hjemmebag'
  },
  {
    name: 'Restaurant Havfruen',
    email: 'test-restaurant-havfruen@p2g-test.com',
    vertical: 'FSE',
    city: 'Aalborg',
    website: 'https://example.com/restaurant-havfruen',
    description: 'Moderne nordisk fine dining med fokus på fisk'
  },
  {
    name: 'Burger Street',
    email: 'test-burger-street@p2g-test.com',
    vertical: 'QSR',
    city: 'København',
    website: 'https://example.com/burger-street',
    description: 'Gourmet burgere til takeaway'
  },
  {
    name: 'Sushi Maru',
    email: 'test-sushi-maru@p2g-test.com',
    vertical: 'SBO',
    city: 'Aarhus',
    website: 'https://example.com/sushi-maru',
    description: 'Autentisk japansk sushi restaurant'
  },
  {
    name: 'Cocktailbar Hemingway',
    email: 'test-cocktailbar@p2g-test.com',
    vertical: 'SBO_cocktail',
    city: 'København',
    website: 'https://example.com/cocktailbar',
    description: 'Klassiske cocktails i vintage atmosfære'
  },
  {
    name: 'Pizzeria Bella',
    email: 'test-pizzeria-bella@p2g-test.com',
    vertical: 'SBO',
    city: 'Esbjerg',
    website: 'https://example.com/pizzeria-bella',
    description: 'Italiensk pizzeria med stenoven'
  },
  {
    name: 'Food Truck Grill Master',
    email: 'test-foodtruck@p2g-test.com',
    vertical: 'FOOD_TRUCK',
    city: 'København',
    website: 'https://example.com/grill-master',
    description: 'Mobile grill specialiteter på farten'
  },
  {
    name: 'Restaurant Brasserie 1901',
    email: 'test-brasserie@p2g-test.com',
    vertical: 'FSE',
    city: 'Aarhus',
    website: 'https://example.com/brasserie-1901',
    description: 'Fransk-inspireret brasserie med historisk charme'
  }
]

console.log('🚀 Setting up 10 test businesses for full onboarding...\n')

const results = []

for (const business of testBusinesses) {
  console.log(`\n📍 Creating: ${business.name} (${business.vertical})`)
  
  try {
    // 1. Create or get user
    let userId: string

    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users.find(u => u.email === business.email)

    if (existingUser) {
      userId = existingUser.id
      console.log(`  ✅ Found existing user`)
    } else {
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: business.email,
        email_confirm: true,
        password: Math.random().toString(36).slice(-16)
      })

      if (authError) throw authError
      userId = authUser.user.id
      console.log(`  ✅ Created user`)
    }

    // 2. Create business (MINIMAL - let onboarding handle the rest)
    const { data: businessData, error: businessError } = await supabase
      .from('businesses')
      .insert({
        owner_id: userId,
        name: business.name,
        vertical: business.vertical,
        website_url: business.website,
        primary_language: 'da'
      })
      .select()
      .single()

    if (businessError) throw businessError
    console.log(`  ✅ Created business`)

    // 3. Create minimal location (required for context)
    await supabase.from('business_locations').insert({
      business_id: businessData.id,
      label: 'Hovedlokation',
      city: business.city,
      country: 'Denmark'
    })
    console.log(`  ✅ Created location`)

    // 4. Generate magic link
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: business.email
    })

    if (linkError) throw linkError

    results.push({
      name: business.name,
      vertical: business.vertical,
      city: business.city,
      email: business.email,
      business_id: businessData.id,
      magic_link: linkData.properties.action_link
    })

    console.log(`  ✅ Magic link generated`)

  } catch (error) {
    console.error(`  ❌ Error:`, error.message)
    results.push({
      name: business.name,
      email: business.email,
      error: error.message
    })
  }

  // Rate limit protection
  await new Promise(resolve => setTimeout(resolve, 500))
}

// Generate summary
console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('✅ SETUP COMPLETE - 10 TEST BUSINESSES')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

// Create CSV for tracking
const csv = [
  'Business,Vertical,City,Email,Business ID,Magic Link',
  ...results.map(r => 
    `"${r.name}","${r.vertical}","${r.city}","${r.email}","${r.business_id || ''}","${r.magic_link || r.error || ''}"`
  )
].join('\n')

await Deno.writeTextFile('/tmp/test-businesses.csv', csv)
console.log('📊 Tracking sheet saved to: /tmp/test-businesses.csv\n')

// Print summary table
console.log('┌─────────────────────────────────────────────────────────────────┐')
console.log('│ Test Business Summary                                           │')
console.log('├─────────────────────────────────────────────────────────────────┤')

for (const result of results) {
  if (result.error) {
    console.log(`│ ❌ ${result.name.padEnd(55)} │`)
  } else {
    console.log(`│ ✅ ${result.name.padEnd(20)} ${result.vertical.padEnd(12)} ${result.city.padEnd(15)} │`)
  }
}

console.log('└─────────────────────────────────────────────────────────────────┘\n')

// Print magic links for easy access
console.log('🔗 MAGIC LINKS (click to access each business):\n')
for (const result of results) {
  if (result.magic_link) {
    console.log(`${result.name}:`)
    console.log(`${result.magic_link}\n`)
  }
}

console.log('\n📋 TESTING INSTRUCTIONS:')
console.log('1. Click a magic link above (or paste in browser)')
console.log('2. Complete onboarding flow in frontend:')
console.log('   - Brand profile generation')
console.log('   - Website analysis (will use placeholder)')
console.log('   - Menu/offerings setup')
console.log('   - Select platforms')
console.log('3. Generate weekly strategy')
console.log('4. Generate captions (test V17 banned words)')
console.log('5. Verify business type framework working')
console.log('\n💡 TIP: Open each link in a different browser/incognito window')
console.log('    to test multiple businesses simultaneously\n')
