// Helper: Regenerate magic links for test businesses
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'http://localhost:54321'
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_KEY not found')
  Deno.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Test business emails
const testEmails = [
  'test-cafe-solskin@p2g-test.com',
  'test-vinbar-nordlys@p2g-test.com',
  'test-coffee-house@p2g-test.com',
  'test-restaurant-havfruen@p2g-test.com',
  'test-burger-street@p2g-test.com',
  'test-sushi-maru@p2g-test.com',
  'test-cocktailbar@p2g-test.com',
  'test-pizzeria-bella@p2g-test.com',
  'test-foodtruck@p2g-test.com',
  'test-brasserie@p2g-test.com'
]

console.log('🔗 Regenerating magic links for all test businesses...\n')

// Get frontend URL from args or use localhost
const frontendUrl = Deno.args[0] || 'http://localhost:3000'
console.log(`Frontend URL: ${frontendUrl}\n`)

for (const email of testEmails) {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: email
  })

  if (error) {
    console.error(`❌ ${email}: ${error.message}`)
  } else {
    // Replace localhost with provided URL
    const link = data.properties.action_link.replace(
      /redirect_to=http:\/\/localhost:3000/,
      `redirect_to=${encodeURIComponent(frontendUrl)}`
    )
    console.log(`${email}:`)
    console.log(`${link}\n`)
  }
}

console.log('\n💡 Usage: deno run --allow-net --allow-env scripts/regenerate-magic-links.ts [FRONTEND_URL]')
console.log('Example: deno run --allow-net --allow-env scripts/regenerate-magic-links.ts https://app.p2g.com')
