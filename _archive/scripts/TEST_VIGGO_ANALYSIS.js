// TEST: Call analyze-website Edge Function directly for Café Viggo
// Copy this into browser console while logged in to test

(async () => {
  // Get auth token
  const { data: { session } } = await supabase.auth.getSession()
  const authToken = session?.access_token
  
  console.log('🔐 Auth token:', authToken ? 'Present' : 'Missing')
  
  // Call the Edge Function
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-website`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        url: 'https://www.jakobsenco.dk/viggo/',
        businessName: 'Café Viggo',
        businessType: 'cafe',
        tier: 'standardplus', // or 'premium'
        debugMode: false // Set to true to see raw AI extraction
      })
    }
  )
  
  console.log('📡 Response status:', response.status)
  
  const data = await response.json()
  console.log('📥 Full response:', data)
  
  // Check specific fields
  console.log('\n=== EXTRACTED DATA ===')
  console.log('Business Name:', data.businessName)
  console.log('Business Type:', data.businessType)
  console.log('Description:', data.description)
  console.log('\nOpening Hours:', data.openingHours)
  console.log('\nMenu Categories:', data.offerings?.categories?.length || 0, 'categories')
  if (data.offerings?.categories) {
    data.offerings.categories.forEach(cat => {
      console.log(`  - ${cat.name}: ${cat.items?.length || 0} items`)
    })
  }
  console.log('\nMenu URL:', data.menuUrl)
  console.log('Detected PDFs:', data.detectedPDFs?.length || 0)
  
  return data
})()
