#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  }
}

loadEnvLocal()

const supabase = createClient(
  'https://kvqdkohdpvmdylqgujpn.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const CAFE_FAUST = 'f4679fa9-3120-4a59-9506-d059b010c34a'

async function main() {
  console.log('🔍 Checking business_programme_profiles...\n')
  
  const { data: programmes, error: progError } = await supabase
    .from('business_programme_profiles')
    .select('programme_type, programme_name, baseline_goal_split, audience_segments')
    .eq('business_id', CAFE_FAUST)
    
  if (progError) {
    console.error('❌ Error:', progError.message)
    return
  }
  
  if (!programmes || programmes.length === 0) {
    console.log('❌ No programme data found')
  } else {
    console.log(`✅ Found ${programmes.length} programmes:`)
    programmes.forEach(p => {
      console.log(`\n📋 ${p.programme_name} (${p.programme_type})`)
      if (p.baseline_goal_split) {
        console.log('   Goals:', JSON.stringify(p.baseline_goal_split, null, 2))
      }
      if (p.audience_segments) {
        const segments = Array.isArray(p.audience_segments) ? p.audience_segments : []
        console.log(`   Audiences: ${segments.length} segments`)
      }
    })
  }
  
  console.log('\n\n🗺️  Checking business_location_intelligence...\n')
  
  const { data: location, error: locError } = await supabase
    .from('business_location_intelligence')
    .select('neighborhood, area_type, location_marketing_hooks')
    .eq('business_id', CAFE_FAUST)
    .single()
    
  if (locError) {
    console.error('❌ Error:', locError.message)
    return
  }
  
  if (!location) {
    console.log('❌ No location data found')
  } else {
    console.log(`✅ Location: ${location.neighborhood || 'N/A'}`)
    console.log(`   Area type: ${location.area_type || 'N/A'}`)
    if (location.location_marketing_hooks && location.location_marketing_hooks.length > 0) {
      console.log(`   Marketing hooks (${location.location_marketing_hooks.length}):`)
      location.location_marketing_hooks.forEach((hook, i) => {
        console.log(`     ${i+1}. ${hook}`)
      })
    } else {
      console.log('   ❌ No marketing hooks')
    }
  }
}

main().catch(console.error)
