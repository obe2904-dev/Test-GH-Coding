#!/usr/bin/env node
/**
 * Import Calendar Data Script
 * 
 * Usage:
 *   deno run --allow-net --allow-env --allow-read --env-file=.env scripts/import-calendar-data.mjs
 *   
 * Imports public holidays from JSON files into calendar_public_holidays table
 * Run this annually to add next year's holidays
 */

import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!SUPABASE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment')
  Deno.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

console.log('📅 Calendar Data Import Script\n')
console.log('═'.repeat(60))

// Load Denmark holidays
const denmarkPath = join(Deno.cwd(), 'calendar-data/denmark-holidays-2026-2028.json')
let denmarkData

try {
  const fileContent = await Deno.readTextFile(denmarkPath)
  denmarkData = JSON.parse(fileContent)
  console.log(`✅ Loaded ${denmarkPath}`)
  console.log(`   Years: ${denmarkData.years.join(', ')}`)
  console.log(`   Holidays: ${denmarkData.holidays.length}`)
} catch (error) {
  console.error(`❌ Failed to load ${denmarkPath}:`, error.message)
  Deno.exit(1)
}

console.log('\n' + '─'.repeat(60))
console.log('Importing Denmark holidays...\n')

let imported = 0
let updated = 0
let errors = 0

for (const holiday of denmarkData.holidays) {
  const data = {
    country: denmarkData.country,
    date: holiday.date,
    name: holiday.name,
    name_local: holiday.name_local,
    is_public_holiday: true,
    retail_impact: holiday.retail_impact,
    typical_bridge_day: holiday.typical_bridge_day,
    hospitality_traffic: holiday.hospitality_traffic,
    notes: holiday.notes
  }

  try {
    const { error } = await supabase
      .from('calendar_public_holidays')
      .upsert(data, {
        onConflict: 'country,date',
        ignoreDuplicates: false
      })

    if (error) {
      console.error(`  ❌ ${holiday.date} ${holiday.name}: ${error.message}`)
      errors++
    } else {
      // Check if it was insert or update by querying
      const { data: existing } = await supabase
        .from('calendar_public_holidays')
        .select('created_at, updated_at')
        .eq('country', data.country)
        .eq('date', data.date)
        .single()

      if (existing && existing.created_at !== existing.updated_at) {
        console.log(`  🔄 ${holiday.date} ${holiday.name_local || holiday.name} (updated)`)
        updated++
      } else {
        console.log(`  ✅ ${holiday.date} ${holiday.name_local || holiday.name} (new)`)
        imported++
      }
    }
  } catch (error) {
    console.error(`  ❌ ${holiday.date} ${holiday.name}: ${error.message}`)
    errors++
  }

  // Small delay to avoid rate limiting
  await new Promise(resolve => setTimeout(resolve, 50))
}

console.log('\n' + '─'.repeat(60))
console.log('📊 Import Summary:')
console.log(`   New holidays imported: ${imported}`)
console.log(`   Existing holidays updated: ${updated}`)
console.log(`   Errors: ${errors}`)
console.log(`   Total processed: ${denmarkData.holidays.length}`)

if (errors === 0) {
  console.log('\n✅ Import completed successfully!')
} else {
  console.log('\n⚠️ Import completed with errors')
  Deno.exit(1)
}

// Verify data
console.log('\n' + '═'.repeat(60))
console.log('🔍 Verification:\n')

const { data: stats } = await supabase
  .from('calendar_public_holidays')
  .select('country, date')
  .eq('country', 'Denmark')
  .gte('date', '2026-01-01')
  .lte('date', '2028-12-31')

if (stats) {
  const byYear = stats.reduce((acc, h) => {
    const year = h.date.substring(0, 4)
    acc[year] = (acc[year] || 0) + 1
    return acc
  }, {})

  console.log('Holidays in database by year:')
  Object.entries(byYear).sort().forEach(([year, count]) => {
    console.log(`  ${year}: ${count} holidays`)
  })
}

// Show next 5 upcoming holidays
console.log('\n📅 Next 5 upcoming holidays:')
const { data: upcoming } = await supabase
  .from('calendar_public_holidays')
  .select('date, name_local, name, retail_impact, typical_bridge_day')
  .eq('country', 'Denmark')
  .gte('date', new Date().toISOString().split('T')[0])
  .order('date', { ascending: true })
  .limit(5)

if (upcoming) {
  upcoming.forEach(h => {
    const bridgeFlag = h.typical_bridge_day ? ' 🌉' : ''
    const retailFlag = h.retail_impact === 'stores_closed' ? ' 🏪🚫' : ''
    console.log(`  ${h.date}: ${h.name_local || h.name}${bridgeFlag}${retailFlag}`)
  })
}

console.log('\n✅ Done!')
