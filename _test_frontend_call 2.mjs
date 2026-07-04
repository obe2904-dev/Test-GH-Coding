import 'jsr:@std/dotenv/load'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')
const supabaseAnonKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')
const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a'

console.log('🔍 Calling get-quick-suggestions (like frontend does)...\n')

const response = await fetch(`${supabaseUrl}/functions/v1/get-quick-suggestions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAnonKey}`,
  },
  body: JSON.stringify({
    businessId,
    tier: 'paid',
    regenerate: false  // Frontend calls with regenerate=false initially
  }),
})

if (!response.ok) {
  console.error(`❌ HTTP ${response.status}: ${response.statusText}`)
  const text = await response.text()
  console.error(text)
  Deno.exit(1)
}

const data = await response.json()

console.log(`✅ API Response:\n`)
console.log(`Suggestions: ${data.suggestions?.length || 0}`)
console.log(`Cached: ${data.cached}`)
console.log()

if (data.suggestions && data.suggestions.length > 0) {
  data.suggestions.forEach((s, idx) => {
    console.log(`${idx + 1}. ${s.title}`)
    console.log(`   Type: ${s.content_type} | Position: ${s.position} | Menu: ${s.menu_item_name || 'n/a'}`)
  })
} else {
  console.log('No suggestions returned')
}
