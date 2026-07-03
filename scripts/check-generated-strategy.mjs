#!/usr/bin/env node
/**
 * CHECK: Recently Generated Strategy Results
 * 
 * Queries the database for the most recent weekly strategy
 * to verify business intelligence integration
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

async function checkGeneratedStrategy() {
  console.log('\n')
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║   CHECK: Generated Strategy with Business Intelligence   ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log('\n')

  // Get most recent strategy
  const { data: strategy, error } = await supabase
    .from('weekly_strategies')
    .select('*')
    .eq('business_id', CAFE_FAUST_ID)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('❌ Error fetching strategy:', error.message)
    process.exit(1)
  }

  if (!strategy) {
    console.log('⚠️  No strategy found for Cafe Faust')
    console.log('   The background job might still be processing.')
    console.log('   Wait a minute and try again.')
    process.exit(0)
  }

  console.log(`✅ Strategy Found`)
  console.log(`   Week: ${strategy.week_start} to ${strategy.week_end}`)
  console.log(`   Generated: ${new Date(strategy.generated_at).toLocaleString()}`)
  console.log('')

  if (!strategy.post_ideas || strategy.post_ideas.length === 0) {
    console.log('⚠️  No post ideas in strategy (might still be processing)')
    process.exit(0)
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`📝 POST IDEAS (${strategy.post_ideas.length} total)`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')

  const servicePeriods = new Map()
  const contentCategories = new Map()
  const goalModes = new Map()
  let locationContentCount = 0
  let menuItemCount = 0

  strategy.post_ideas.forEach((idea, idx) => {
    console.log(`\n${idx + 1}. ${idea.title || 'Untitled'}`)
    console.log(`   Day: ${idea.suggested_day || 'not set'}`)
    console.log(`   Type: ${idea.type || 'unknown'}`)
    
    if (idea.goal_mode) {
      console.log(`   Goal Mode: ${idea.goal_mode}`)
      goalModes.set(idea.goal_mode, (goalModes.get(idea.goal_mode) || 0) + 1)
    }

    if (idea.content_category) {
      console.log(`   Content Category: ${idea.content_category}`)
      contentCategories.set(idea.content_category, (contentCategories.get(idea.content_category) || 0) + 1)
    }

    if (idea.service_period) {
      console.log(`   Service Period: ${idea.service_period}`)
      servicePeriods.set(idea.service_period, (servicePeriods.get(idea.service_period) || 0) + 1)
    }

    if (idea.menu_item_used) {
      console.log(`   Menu Item: ${idea.menu_item_used}`)
      menuItemCount++
    }

    // Check for location/waterfront references
    const titleLower = (idea.title || '').toLowerCase()
    const rationaleLower = (idea.rationale || '').toLowerCase()
    const hasLocationRef = /åen|waterfront|udeservering|terrasse|ved vandet|havne/i.test(titleLower + ' ' + rationaleLower)
    
    if (hasLocationRef || idea.type === 'atmosphere' || idea.content_category === 'behind_scenes') {
      locationContentCount++
      console.log(`   🌊 Location/Atmosphere: YES`)
    }

    if (idea.rationale) {
      const preview = idea.rationale.substring(0, 120)
      console.log(`   Rationale: ${preview}${idea.rationale.length > 120 ? '...' : ''}`)
    }
  })

  console.log('\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 BUSINESS INTELLIGENCE IMPACT ANALYSIS')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')

  // Service Period Coverage
  console.log('🎯 Service Period Coverage:')
  console.log('   Expected: FROKOST, Brunch, AFTEN, MENUKORT')
  if (servicePeriods.size > 0) {
    servicePeriods.forEach((count, period) => {
      console.log(`   ✅ ${period}: ${count} post(s)`)
    })
    if (servicePeriods.size >= 3) {
      console.log('   ✅ Good coverage (3+ service periods)')
    } else {
      console.log('   ⚠️  Limited coverage (< 3 service periods)')
    }
  } else {
    console.log('   ❌ No service period metadata found')
  }
  console.log('')

  // Goal Mode Distribution
  console.log('💰 Commercial Goal Distribution:')
  console.log('   Expected: Mix of drive_footfall, build_brand, retain_loyalty')
  if (goalModes.size > 0) {
    goalModes.forEach((count, mode) => {
      console.log(`   • ${mode}: ${count} post(s)`)
    })
  } else {
    console.log('   ⚠️  No goal mode metadata')
  }
  console.log('')

  // Content Category Mix
  console.log('📂 Content Category Distribution:')
  if (contentCategories.size > 0) {
    contentCategories.forEach((count, category) => {
      console.log(`   • ${category}: ${count} post(s)`)
    })
  } else {
    console.log('   ⚠️  No content category metadata')
  }
  console.log('')

  // Location Positioning Check
  console.log('📍 Location Positioning (Waterfront Score: 95):')
  console.log(`   Location/Atmosphere posts: ${locationContentCount}/${strategy.post_ideas.length}`)
  if (locationContentCount > 0) {
    console.log(`   ✅ Waterfront positioning leveraged`)
  } else {
    console.log(`   ❌ ISSUE: Waterfront score (95) not used in content`)
  }
  console.log('')

  // Content Variety Check
  console.log('🎨 Content Variety:')
  console.log(`   Menu-focused posts: ${menuItemCount}/${strategy.post_ideas.length}`)
  if (menuItemCount >= 3) {
    console.log(`   ⚠️  High menu concentration (${menuItemCount}/4 posts)`)
    console.log(`      Before fix: Typically 3-4/4 were menu items`)
  } else {
    console.log(`   ✅ Good variety (${menuItemCount} menu, ${strategy.post_ideas.length - menuItemCount} experience/atmosphere)`)
  }
  console.log('')

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 SUMMARY')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')

  const checks = []
  
  if (servicePeriods.size >= 3) {
    checks.push('✅ Service period coverage')
  } else {
    checks.push('❌ Service period coverage')
  }

  if (goalModes.size >= 2) {
    checks.push('✅ Goal mode diversity')
  } else {
    checks.push('⚠️  Goal mode diversity')
  }

  if (locationContentCount > 0) {
    checks.push('✅ Location positioning used')
  } else {
    checks.push('❌ Location positioning NOT used')
  }

  if (menuItemCount < 3) {
    checks.push('✅ Content variety')
  } else {
    checks.push('⚠️  Content variety (too many menu posts)')
  }

  checks.forEach(check => console.log(check))
  console.log('')

  const passCount = checks.filter(c => c.startsWith('✅')).length
  const totalChecks = checks.length

  if (passCount === totalChecks) {
    console.log('🎉 ALL CHECKS PASSED - Business intelligence integration successful!')
  } else if (passCount >= totalChecks / 2) {
    console.log('⚠️  PARTIAL SUCCESS - Some business intelligence flowing through')
  } else {
    console.log('❌ INTEGRATION INCOMPLETE - Business intelligence not being used')
  }

  console.log('')
}

checkGeneratedStrategy()
