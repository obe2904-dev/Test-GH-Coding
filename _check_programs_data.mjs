#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

import { createClient } from 'npm:@supabase/supabase-js@2'

// Read .env file manually
const envText = await Deno.readTextFile('.env')
const envVars = {}
for (const line of envText.split('\n')) {
  if (line.trim() && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=')
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim()
    }
  }
}

const supabaseUrl = envVars.VITE_SUPABASE_URL
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY
const businessId = 'f4679fa9-3120-4a59-9506-d059b010c34a'

const supabase = createClient(supabaseUrl, supabaseKey)

// Fetch menu data to see programs
const { data: menuResults, error } = await supabase
  .from('menu_results_v2')
  .select('id, service_period_name, structured_data')
  .eq('business_id', businessId)
  .limit(5)

if (error) {
  console.error('Error:', error)
  Deno.exit(1)
}

console.log('📅 Programs extracted from menu_results_v2:\n')

for (const menu of menuResults || []) {
  console.log(`Menu ID: ${menu.id}`)
  console.log(`Service Period: ${menu.service_period_name || '(none)'}`)
  console.log(`Menu Title: ${menu.structured_data?.menuTitle || '(none)'}`)
  
  // Check availabilityTime
  if (menu.structured_data?.availabilityTime) {
    console.log(`  Availability Time: ${JSON.stringify(menu.structured_data.availabilityTime)}`)
  }
  
  // Check menuPeriods
  if (menu.structured_data?.menuPeriods) {
    console.log(`  Menu Periods: ${JSON.stringify(menu.structured_data.menuPeriods)}`)
  }
  
  console.log()
}
