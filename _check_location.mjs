import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

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

const { data: location, error } = await supabase
  .from('business_location_intelligence')
  .select('*')
  .eq('business_id', 'f4679fa9-3120-4a59-9506-d059b010c34a')
  .single()

if (error) {
  console.error('Error:', error)
  process.exit(1)
}

console.log('Location Intelligence fields:')
console.log(JSON.stringify(location, null, 2))
