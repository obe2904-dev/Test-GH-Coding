// Test script for AI Generate V2
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlscWd1am5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4OTQ2MjEsImV4cCI6MjA1MjQ3MDYyMX0.8h9yLjJ8sJLJG1vRmN3qXKTYQKZCk6FqXQQVYQXQYQY' // Replace with your actual anon key

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testAIGenerateV2() {
  console.log('🧪 Testing AI Generate V2...\n')

  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('❌ Not authenticated. Please sign in first.')
      console.log('\nTo authenticate, run this in your browser console:')
      console.log('localStorage.getItem("sb-kvqdkohdpvmdylqgujpn-auth-token")')
      return
    }

    console.log('✅ Authenticated as:', user.email)
    console.log('   User ID:', user.id)
    console.log()

    // Call ai-generate-v2
    console.log('📤 Calling ai-generate-v2...')
    const startTime = Date.now()

    const { data, error } = await supabase.functions.invoke('ai-generate-v2', {
      body: {
        user_id: user.id,
        userTier: 'smart',
        count: 3
      }
    })

    const elapsed = Date.now() - startTime
    console.log(`⏱️  Response received in ${elapsed}ms\n`)

    if (error) {
      console.error('❌ Error:', error)
      return
    }

    if (!data) {
      console.error('❌ No data returned')
      return
    }

    // Display results
    console.log('✅ SUCCESS!\n')
    console.log('=' .repeat(80))
    console.log('METADATA')
    console.log('=' .repeat(80))
    console.log('Model:', data.metadata?.model)
    console.log('Language:', data.metadata?.language)
    console.log('Context used:', data.metadata?.context_used?.join(', '))
    console.log('Generated at:', data.metadata?.generated_at)
    console.log()

    if (data.suggestions && Array.isArray(data.suggestions)) {
      console.log('=' .repeat(80))
      console.log(`SUGGESTIONS (${data.suggestions.length})`)
      console.log('=' .repeat(80))

      data.suggestions.forEach((suggestion, index) => {
        console.log()
        console.log(`📝 SUGGESTION ${index + 1}`)
        console.log('-'.repeat(80))
        console.log('Headline:', suggestion.headline)
        console.log('Impact:', suggestion.impact)
        console.log('Menu item:', suggestion.menuItemUsed || '(none - generic content)')
        console.log('Best time:', suggestion.bestTimeToPost)
        console.log()
        console.log('Text:')
        console.log(suggestion.text)
        console.log()
        console.log('Photo suggestion:')
        console.log(suggestion.photoSuggestion)
        console.log('-'.repeat(80))
      })
    }

    // Analysis
    console.log()
    console.log('=' .repeat(80))
    console.log('ANALYSIS')
    console.log('=' .repeat(80))
    
    const menuBased = data.suggestions.filter(s => s.menuItemUsed && s.menuItemUsed.trim().length > 0).length
    const generic = data.suggestions.length - menuBased
    
    console.log(`✅ Menu-based suggestions: ${menuBased}/${data.suggestions.length}`)
    console.log(`✅ Generic suggestions: ${generic}/${data.suggestions.length}`)
    
    const impacts = data.suggestions.map(s => s.impact)
    console.log(`✅ Impact levels: ${impacts.join(', ')}`)
    
    console.log()
    console.log('🎉 Test completed successfully!')

  } catch (err) {
    console.error('❌ Exception:', err.message)
    console.error(err)
  }
}

// Run test
testAIGenerateV2()
