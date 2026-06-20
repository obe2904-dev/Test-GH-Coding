import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Read .env file manually
const envContent = fs.readFileSync('.env', 'utf-8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.+)$/)
  if (match) {
    envVars[match[1]] = match[2]
  }
})

const supabase = createClient(
  envVars.VITE_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY
)

const { data, error } = await supabase
  .from('business_brand_profile')
  .select('brand_profile_v5')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .single()

if (error) {
  console.error('Error:', error)
  process.exit(1)
}

const voice = data?.brand_profile_v5?.voice
console.log('Voice object keys:', Object.keys(voice || {}))
console.log('\nFull voice object:', JSON.stringify(voice, null, 2))
