#!/usr/bin/env node
/**
 * TEST: Business Intelligence Integration + Phase 3 Validation
 * 
 * Generates a weekly strategy with business intelligence integration
 * and validates the results with Phase 3 validation layer
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

async function testWithValidation() {
  console.log('\n')
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║   TEST: BI Integration + Phase 3 Validation              ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log('\n')

  const weekStart = getNextMonday()
  console.log(`📅 Testing for week starting: ${weekStart}`)
  console.log(`🏢 Business: Cafe Faust (${CAFE_FAUST_ID})`)
  console.log('')

  const requestBody = {
    business_id: CAFE_FAUST_ID,
    week_start: weekStart,
    regenerate: true,
    target_post_count: 4
  }

  console.log('📡 Calling get-weekly-strategy Edge Function...')
  console.log('   This will now include Phase 3 validation in the logs!')
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

    console.log('✅ Strategy generation triggered successfully!')
    console.log('')
    console.log('💡 Check the Edge Function logs to see:')
    console.log('   1. Business intelligence assembly')
    console.log('   2. Phase 1 with BI context')
    console.log('   3. Phase 2 with BI prompts')  
    console.log('   4. Phase 3 validation results')
    console.log('')
    console.log('🔍 To view logs, run:')
    console.log('   supabase functions logs get-weekly-strategy --tail')
    console.log('')
    
    console.log('📋 Wait ~3 seconds then check database results:')
    console.log('   node scripts/check-generated-strategy.mjs')
    console.log('')

  } catch (error) {
    console.error('\n❌ Test Failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

testWithValidation()
