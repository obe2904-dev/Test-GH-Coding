// Test catalog system with real Viggo data
// Run this in browser console after logging in

async function testMenuCatalog() {
  console.log('🧪 Testing Menu Catalog System')
  console.log('=' .repeat(60))
  
  try {
    const token = localStorage.getItem('sb-kvqdkohdpvmdylqgujpn-auth-token')
    const authData = token ? JSON.parse(token) : null
    const accessToken = authData?.access_token
    
    if (!accessToken) {
      console.error('❌ Not authenticated')
      return
    }
    
    console.log('✅ Authenticated')
    
    // Test 1: Generate 3 suggestions
    console.log('\n📝 Test 1: Generate 3 suggestions with catalog constraints')
    console.log('-'.repeat(60))
    
    const startTime = Date.now()
    const response = await fetch(
      'https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/ai-generate-v2',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          count: 3,
          userTier: 'smart'
        })
      }
    )
    
    const duration = Date.now() - startTime
    
    if (!response.ok) {
      const error = await response.json()
      console.error(`❌ Request failed (${response.status}):`, error)
      return
    }
    
    const data = await response.json()
    console.log(`✅ Generation completed in ${duration}ms`)
    console.log(`📊 Model: ${data.metadata.model}`)
    console.log(`🌍 Language: ${data.metadata.language}`)
    console.log(`📦 Context: ${data.metadata.context_used.join(', ')}`)
    
    // Analyze suggestions
    console.log(`\n📋 Generated ${data.suggestions.length} suggestions:`)
    console.log('='.repeat(60))
    
    const menuSuggestions = []
    const lifestyleSuggestions = []
    
    for (let i = 0; i < data.suggestions.length; i++) {
      const s = data.suggestions[i]
      console.log(`\n${i + 1}. ${s.headline}`)
      console.log(`   Impact: ${s.impact}`)
      console.log(`   Time: ${s.bestTimeToPost}`)
      
      if (s.menuItemUsed) {
        console.log(`   ✅ Menu item: "${s.menuItemUsed}"`)
        menuSuggestions.push({ index: i + 1, item: s.menuItemUsed, time: s.bestTimeToPost })
      } else {
        console.log(`   🎨 Lifestyle/vibe post (no menu item)`)
        lifestyleSuggestions.push(i + 1)
      }
      
      console.log(`   Text preview: ${s.text.substring(0, 100)}...`)
      console.log(`   Photo: ${s.photoSuggestion.substring(0, 80)}...`)
    }
    
    // Test 2: Validate catalog constraints
    console.log('\n\n🔍 Test 2: Catalog Constraint Validation')
    console.log('='.repeat(60))
    
    console.log(`✅ Menu suggestions: ${menuSuggestions.length}`)
    console.log(`✅ Lifestyle suggestions: ${lifestyleSuggestions.length}`)
    
    if (menuSuggestions.length >= 2) {
      console.log('\n✅ PASS: Got at least 2 menu-focused suggestions')
    } else {
      console.log(`\n⚠️ WARNING: Expected 2+ menu suggestions, got ${menuSuggestions.length}`)
    }
    
    if (lifestyleSuggestions.length >= 1) {
      console.log('✅ PASS: Got at least 1 lifestyle suggestion')
    } else {
      console.log(`⚠️ WARNING: Expected 1+ lifestyle suggestion, got ${lifestyleSuggestions.length}`)
    }
    
    // Test 3: Check for BØF & BEARNAISE constraint
    console.log('\n\n🍴 Test 3: BØF & BEARNAISE Constraint Check')
    console.log('='.repeat(60))
    console.log('Looking for invalid category usage (e.g., AFTEN item for breakfast)...')
    
    const bofItem = menuSuggestions.find(s => 
      s.item.toLowerCase().includes('bøf') || 
      s.item.toLowerCase().includes('bearnaise')
    )
    
    if (bofItem) {
      const time = parseInt(bofItem.time.split(':')[0])
      const isValidTime = time >= 17 && time <= 22 // Dinner time
      
      if (isValidTime) {
        console.log(`✅ PASS: "${bofItem.item}" used at valid time (${bofItem.time})`)
      } else {
        console.log(`❌ FAIL: "${bofItem.item}" used at invalid time (${bofItem.time})`)
        console.log(`   Expected: 17:00-22:00 (dinner)`)
        console.log(`   Got: ${bofItem.time}`)
      }
    } else {
      console.log('ℹ️ BØF & BEARNAISE not used in suggestions (that\'s fine)')
    }
    
    // Test 4: Category diversity
    console.log('\n\n🎯 Test 4: Category Diversity Check')
    console.log('='.repeat(60))
    
    if (menuSuggestions.length >= 2) {
      const items = menuSuggestions.map(s => s.item)
      const uniqueItems = new Set(items)
      
      if (uniqueItems.size === items.length) {
        console.log('✅ PASS: All menu items are different')
        menuSuggestions.forEach(s => {
          console.log(`   ${s.index}. "${s.item}" at ${s.time}`)
        })
      } else {
        console.log('⚠️ WARNING: Some menu items are repeated')
      }
    }
    
    // Summary
    console.log('\n\n📊 Test Summary')
    console.log('='.repeat(60))
    console.log(`✅ Total suggestions: ${data.suggestions.length}`)
    console.log(`✅ Menu-focused: ${menuSuggestions.length}`)
    console.log(`✅ Lifestyle/vibe: ${lifestyleSuggestions.length}`)
    console.log(`✅ Generation time: ${duration}ms`)
    console.log(`✅ Model: ${data.metadata.model}`)
    
    return data
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    console.error(error.stack)
  }
}

// Run the test
console.log('🚀 Starting Menu Catalog Test Suite')
console.log('Run: testMenuCatalog()')
console.log('')
console.log('Or auto-run now:')
testMenuCatalog()
