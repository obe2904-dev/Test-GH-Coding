#!/usr/bin/env node
/**
 * TEST: View Business Intelligence Prompt
 * 
 * Shows exactly what business intelligence context is being sent to the AI
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

// Load .env.local
function parseDotEnv(contents) {
  const out = {}
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line
    const eq = normalized.indexOf('=')
    if (eq === -1) continue
    const key = normalized.slice(0, eq).trim()
    let value = normalized.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key) out[key] = value
  }
  return out
}

function loadEnvFromFiles() {
  const cwd = process.cwd()
  for (const filename of ['.env.local', '.env']) {
    const fullPath = path.join(cwd, filename)
    if (!fs.existsSync(fullPath)) continue
    try {
      const parsed = parseDotEnv(fs.readFileSync(fullPath, 'utf8'))
      for (const [k, v] of Object.entries(parsed)) {
        if (process.env[k] == null) process.env[k] = v
      }
    } catch {
      // ignore
    }
  }
}

loadEnvFromFiles()

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceRoleKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(
  'https://kvqdkohdpvmdylqgujpn.supabase.co',
  serviceRoleKey
)

const CAFE_FAUST_ID = 'f4679fa9-3120-4a59-9506-d059b010c34a'

// Import the actual functions from the Edge Function
// Note: This is a simulation since we can't directly import Deno modules
// We'll reconstruct the logic here

async function fetchServicePeriodStrategies(businessId) {
  const { data, error } = await supabase
    .from('business_programme_profiles')
    .select('service_period_name, service_period_label_dk, commercial_strategy, audience_segments, content_angles')
    .eq('business_id', businessId)

  if (error) throw error
  return data || []
}

async function fetchLocationPositioning(businessId) {
  const { data, error } = await supabase
    .from('business_location_intelligence')
    .select('waterfront_score, city_center_score, tourist_area_score, student_area_score, category_scores, location_marketing_hooks, competition_analysis')
    .eq('business_id', businessId)
    .maybeSingle()

  if (error) throw error
  return data
}

async function fetchBrandVoice(businessId) {
  const { data, error } = await supabase
    .from('business_brand_profile')
    .select('brand_profile_v5')
    .eq('business_id', businessId)
    .maybeSingle()

  if (error) throw error
  return data?.brand_profile_v5
}

async function fetchMenuIntelligence(businessId) {
  const { data, error } = await supabase
    .from('menu_items_normalized')
    .select('dish_name, category, is_signature')
    .eq('business_id', businessId)
    .eq('is_signature', true)

  if (error) throw error
  return data || []
}

async function testBusinessIntelligence() {
  console.log('\n')
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║   VIEW: Business Intelligence AI Prompt                  ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log('\n')

  console.log('Fetching business intelligence for Cafe Faust...\n')

  try {
    const [servicePeriods, location, brandVoice, menuItems] = await Promise.all([
      fetchServicePeriodStrategies(CAFE_FAUST_ID),
      fetchLocationPositioning(CAFE_FAUST_ID),
      fetchBrandVoice(CAFE_FAUST_ID),
      fetchMenuIntelligence(CAFE_FAUST_ID)
    ])
  } catch (error) {
    console.error('❌ Error fetching data:', error.message)
    throw error
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 RAW DATA')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')

  console.log('🎯 Service Period Strategies:', servicePeriods.length)
  servicePeriods.forEach(sp => {
    console.log(`\n  ${sp.service_period_label_dk} (${sp.service_period_name}):`)
    if (sp.commercial_strategy) {
      console.log(`    Goals: ${sp.commercial_strategy.goals?.map(g => `${g.goal} ${g.weight}%`).join(', ')}`)
    }
    if (sp.audience_segments && sp.audience_segments.length > 0) {
      console.log(`    Audiences: ${sp.audience_segments.length} segments`)
    }
    if (sp.content_angles && sp.content_angles.length > 0) {
      console.log(`    Content Angles: ${sp.content_angles.length} angles`)
      sp.content_angles.slice(0, 2).forEach(angle => {
        console.log(`      • "${angle.angle}" (${angle.audience_segment})`)
      })
    }
  })

  console.log('\n📍 Location Intelligence:')
  if (location) {
    console.log(`    Waterfront: ${location.waterfront_score || 0}`)
    console.log(`    City Center: ${location.city_center_score || 0}`)
    console.log(`    Tourist Area: ${location.tourist_area_score || 0}`)
    console.log(`    Student Area: ${location.student_area_score || 0}`)
  }

  console.log('\n🍽️  Menu Intelligence:')
  console.log(`    Signature Dishes: ${menuItems.length}`)
  if (menuItems.length > 0) {
    menuItems.slice(0, 3).forEach(item => {
      console.log(`      • ${item.dish_name} (${item.category})`)
    })
  }

  console.log('\n🎨 Brand Voice:')
  if (brandVoice) {
    console.log(`    Personality: ${brandVoice.personality?.archetype || 'not set'}`)
    console.log(`    Themes: ${brandVoice.themes?.length || 0} defined`)
  }

  console.log('\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📝 FORMATTED PROMPT (sent to AI)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')

  // Reconstruct the formatted prompt
  let prompt = '## BUSINESS INTELLIGENCE\n\n'
  prompt += 'Use this business-specific intelligence to inform your content decisions:\n\n'

  if (servicePeriods.length > 0) {
    prompt += '### Service Period Strategies\n\n'
    servicePeriods.forEach(sp => {
      prompt += `**${sp.service_period_label_dk}** (${sp.service_period_name}):\n`
      if (sp.commercial_strategy) {
        const goals = sp.commercial_strategy.goals?.map(g => `${g.weight}% ${g.goal}`).join(', ') || ''
        prompt += `- Commercial goals: ${goals}\n`
      }
      if (sp.audience_segments && sp.audience_segments.length > 0) {
        prompt += `- Audience segments:\n`
        sp.audience_segments.slice(0, 2).forEach(aud => {
          prompt += `  - ${aud.segment_name}: ${aud.decision_timing} decisions, ${aud.booking_likelihood}\n`
        })
      }
      if (sp.content_angles && sp.content_angles.length > 0) {
        prompt += `- Content angles:\n`
        sp.content_angles.slice(0, 3).forEach(angle => {
          prompt += `  - "${angle.angle}"\n`
        })
      }
      prompt += '\n'
    })
  }

  if (location) {
    prompt += '### Location Positioning\n\n'
    prompt += `- Waterfront score: ${location.waterfront_score || 0}/100\n`
    prompt += `- City center score: ${location.city_center_score || 0}/100\n`
    if (location.location_marketing_hooks && location.location_marketing_hooks.length > 0) {
      prompt += `- Marketing hooks: ${location.location_marketing_hooks.slice(0, 2).join(', ')}\n`
    }
    prompt += '\n'
  }

  if (menuItems.length > 0) {
    prompt += '### Signature Menu Items\n\n'
    menuItems.slice(0, 5).forEach(item => {
      prompt += `- ${item.dish_name} (${item.category})\n`
    })
    prompt += '\n'
  }

  prompt += '### MANDATORY REQUIREMENTS\n\n'
  prompt += '1. **Service Period Coverage**: Ensure posts span multiple service periods\n'
  prompt += '2. **Location Leverage**: Use location positioning (especially waterfront) in content\n'
  prompt += '3. **Content Variety**: Mix menu items with atmosphere/experience content\n'
  prompt += '4. **Goal Alignment**: Match content to commercial goals for each service period\n'

  console.log(prompt)
  console.log('')

  console.log('💡 This is the context being injected into Phase 2b AI prompts.')
  console.log('')
}

testBusinessIntelligence().catch(err => {
  console.error('\n❌ Fatal error:', err)
  process.exit(1)
})
