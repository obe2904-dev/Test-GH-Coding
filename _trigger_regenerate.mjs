import 'jsr:@std/dotenv/load'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')
const supabaseAnonKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a'

console.log('🔄 Triggering regeneration for Cafe Faust with single-suggestion mode...\n')

const response = await fetch(`${supabaseUrl}/functions/v1/get-quick-suggestions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${serviceRoleKey || supabaseAnonKey}`,
  },
  body: JSON.stringify({
    businessId,
    regenerate: true,
    tier: 'standardplus',
  }),
})

if (!response.ok) {
  console.error(`❌ HTTP ${response.status}: ${response.statusText}`)
  const text = await response.text()
  console.error(text)
  Deno.exit(1)
}

const data = await response.json()

console.log('✅ Response received:\n')
console.log(`Number of suggestions: ${data.suggestions?.length || 0}`)
console.log(`Cached: ${data.cached}`)
console.log(`Planner rationale: "${data.plannerRationale || ''}"`)
console.log(`Programs found: ${(data.suggestions?.[0]?.menu_item_name) ? 'yes (menu items in response)' : 'check logs'}`)
console.log()

if (data.suggestions && data.suggestions.length > 0) {
  data.suggestions.forEach((s, idx) => {
    console.log(`═══ SUGGESTION ${idx + 1} ═══`)
    console.log(`Title: ${s.title}`)
    console.log(`Content Type: ${s.content_type}`)
    console.log(`Position: ${s.position}`)
    console.log(`Suggested Time: ${s.suggested_time || '(none)'}`)
    if (s.menu_item_name) {
      console.log(`Menu Item: ${s.menu_item_name}`)
    }
    console.log(`\nWhy (${(s.why_explanation || '').split('. ').length} sentences):`)
    console.log(`  ${s.why_explanation || s.rationale || '(none)'}`)
    console.log()
  })
}

console.log('✅ Regeneration complete!')
