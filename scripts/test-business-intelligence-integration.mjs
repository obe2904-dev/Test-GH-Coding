#!/usr/bin/env node
/**
 * TEST: Business Intelligence Integration in Strategy Generation
 * 
 * Verifies that business intelligence flows through the system:
 * 1. Fetches business intelligence (service periods, location, brand, menu)
 * 2. Passes to Phase 2b AI prompts
 * 3. Generates contextually-aware strategy
 */

import fs from 'node:fs'
import path from 'node:path'

// Load .env.local file
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

const CAFE_FAUST_ID = 'f4679fa9-3120-4a59-9506-d059b010c34a'
const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co'

// Calculate next Monday
function getNextMonday() {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, etc.
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7
  const nextMonday = new Date(today)
  nextMonday.setDate(today.getDate() + daysUntilMonday)
  return nextMonday.toISOString().split('T')[0]
}

async function testStrategyGeneration() {
  console.log('\n')
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║   TEST: Business Intelligence Strategy Generation        ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log('\n')

  const weekStart = getNextMonday()
  console.log(`📅 Testing for week starting: ${weekStart}`)
  console.log(`🏢 Business: Cafe Faust (${CAFE_FAUST_ID})`)
  console.log('')

  console.log('📡 Calling get-weekly-strategy Edge Function...')
  console.log('   Expected: Business intelligence should be fetched and used')
  console.log('')

  const requestBody = {
    business_id: CAFE_FAUST_ID,
    week_start: weekStart,
    regenerate: true, // Force fresh generation
    target_post_count: 4
  }

  console.log('Request payload:', JSON.stringify(requestBody, null, 2))
  console.log('')

  try {
    const startTime = Date.now()
    
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/get-weekly-strategy`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`
        },
        body: JSON.stringify(requestBody)
      }
    )

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`⏱️  Response received in ${duration}s`)
    console.log(`📊 Status: ${response.status} ${response.statusText}`)
    console.log('')

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Error response:')
      console.error(errorText)
      process.exit(1)
    }

    const result = await response.json()

    // Check if result contains expected data
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ STRATEGY GENERATED SUCCESSFULLY')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')

    if (result.post_ideas && Array.isArray(result.post_ideas)) {
      console.log(`📝 Post Ideas Generated: ${result.post_ideas.length}`)
      console.log('')

      // Analyze service period coverage
      const servicePeriods = new Map()
      const contentTypes = new Map()
      const hasLocationContent = result.post_ideas.some(idea => 
        idea.type === 'atmosphere' || 
        idea.type === 'location' ||
        (idea.title && /åen|waterfront|udeservering|terrasse/i.test(idea.title))
      )

      result.post_ideas.forEach((idea, idx) => {
        console.log(`\n  Post ${idx + 1}: ${idea.title || 'Untitled'}`)
        console.log(`    Type: ${idea.type || 'unknown'}`)
        console.log(`    Goal: ${idea.goal_mode || 'not specified'}`)
        
        if (idea.service_period) {
          console.log(`    Service Period: ${idea.service_period}`)
          servicePeriods.set(idea.service_period, (servicePeriods.get(idea.service_period) || 0) + 1)
        }

        if (idea.content_category) {
          console.log(`    Content Category: ${idea.content_category}`)
          contentTypes.set(idea.content_category, (contentTypes.get(idea.content_category) || 0) + 1)
        }

        if (idea.rationale) {
          const preview = idea.rationale.substring(0, 100)
          console.log(`    Rationale: ${preview}${idea.rationale.length > 100 ? '...' : ''}`)
        }

        if (idea.menu_item_used) {
          console.log(`    Menu Item: ${idea.menu_item_used}`)
        }
      })

      console.log('\n')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('📊 ANALYSIS: Business Intelligence Integration')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('')

      // Service Period Coverage
      console.log('🎯 Service Period Coverage:')
      if (servicePeriods.size > 0) {
        servicePeriods.forEach((count, period) => {
          console.log(`  ✅ ${period}: ${count} post(s)`)
        })
      } else {
        console.log('  ⚠️  No service period metadata found')
      }
      console.log('')

      // Content Type Distribution
      console.log('📂 Content Category Distribution:')
      if (contentTypes.size > 0) {
        contentTypes.forEach((count, category) => {
          console.log(`  • ${category}: ${count} post(s)`)
        })
      } else {
        console.log('  ⚠️  No content category metadata found')
      }
      console.log('')

      // Location Leverage
      console.log('📍 Location Positioning:')
      if (hasLocationContent) {
        console.log('  ✅ Location/atmosphere content detected')
        console.log('     Expected: Waterfront score (95) should drive content')
      } else {
        console.log('  ⚠️  No location/atmosphere content detected')
        console.log('     Issue: Waterfront score (95) not leveraged')
      }
      console.log('')

      // Content Variety
      const menuPostCount = result.post_ideas.filter(idea => 
        idea.type === 'menu_item' || 
        idea.content_category === 'product_menu' ||
        idea.content_category === 'craving_visual'
      ).length

      console.log('🎨 Content Variety:')
      console.log(`  Menu posts: ${menuPostCount}/${result.post_ideas.length}`)
      if (menuPostCount >= 3) {
        console.log('  ⚠️  High menu post concentration (≥3)')
        console.log('     Expected: More atmosphere/experience content')
      } else {
        console.log('  ✅ Good variety (< 3 menu posts)')
      }
      console.log('')

    } else {
      console.log('⚠️  No post_ideas array in response')
    }

    // Check for strategic brief
    if (result.strategic_brief) {
      console.log('✅ Strategic Brief Present')
      if (result.strategic_brief.angles) {
        console.log(`   Angles: ${result.strategic_brief.angles.length}`)
      }
    }

    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ TEST COMPLETE')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')

    console.log('💡 Next Steps:')
    console.log('   1. Verify service period coverage meets expectations')
    console.log('   2. Check that waterfront positioning appears in content')
    console.log('   3. Confirm content variety (not all menu items)')
    console.log('   4. Review rationales for business intelligence references')
    console.log('')

  } catch (error) {
    console.error('\n❌ Test Failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

testStrategyGeneration()
