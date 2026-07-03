#!/usr/bin/env node

/**
 * Query menu_results_v2.ai_summary for two specific businesses
 * to understand brand-building content potential
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL') || 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlscWd1anBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5ODg3NjAsImV4cCI6MjA3NjU2NDc2MH0.mB5s5sBCKIov-hIG5xJpo90SDLiQ2c8JAvvOkGCGyII'

const supabase = createClient(supabaseUrl, supabaseKey)

const businessIds = [
  'f4679fa9-3120-4a59-9506-d059b010c34a', // Cafe Faust - known to have menu data
  '02765409-46b9-4287-808f-21cf9d631f86',
  '1a285371-64f7-4def-b248-2e8cdfbba106'
]

console.log('🔍 Querying menu_results_v2 for business examples...\n')

for (const businessId of businessIds) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`BUSINESS ID: ${businessId}`)
  console.log('='.repeat(80))

  // Get business name
  const { data: business } = await supabase
    .from('businesses')
    .select('business_name, business_description')
    .eq('id', businessId)
    .single()

  if (business) {
    console.log(`📍 Business: ${business.business_name}`)
    console.log(`📝 Description: ${business.business_description?.substring(0, 100)}...`)
  }

  // Get menu results with ai_summary
  const { data: menus, error } = await supabase
    .from('menu_results_v2')
    .select('id, service_period_name, menu_type, language_code, ai_summary, source_url, status')
    .eq('business_id', businessId)
    .order('service_period_name')

  if (error) {
    console.error('❌ Error:', error.message)
    continue
  }

  if (!menus || menus.length === 0) {
    console.log('⚠️  No menu data found')
    continue
  }

  console.log(`\n✅ Found ${menus.length} menu(s)\n`)

  for (const menu of menus) {
    console.log(`\n📋 Menu: ${menu.service_period_name} (${menu.menu_type}, ${menu.language_code})`)
    console.log(`🔗 Source: ${menu.source_url}`)
    console.log(`\n📄 AI SUMMARY:`)
    
    if (menu.ai_summary) {
      console.log(menu.ai_summary)
    } else {
      console.log('  (no ai_summary available)')
    }
    
    console.log('\n' + '-'.repeat(80))
  }
}

console.log('\n✅ Query complete\n')
