#!/usr/bin/env node
/**
 * Test Menu Intelligence Extraction Patterns
 * 
 * Purpose: Validate that the 8 new brand-building extraction patterns
 * successfully capture relevant signals from real ai_summary data.
 * 
 * Test businesses:
 * - 02765409-46b9-4287-808f-21cf9d631f86 (Restaurant with håndpillede rejer)
 * - 1a285371-64f7-4def-b248-2e8cdfbba106 (Another business)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY environment variables')
  Deno.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Pattern definitions (matching get-quick-suggestions/index.ts)
const patterns = {
  quotedName: /["«»„"""]([^"«»„"""]{3,50})["«»„"""]/g,
  dietary: /vegansk|vegetarisk|glutenfri|laktosefri|halal|kosher|plantebaseret/i,
  drink: /vinmenu|Ad Libitum|cocktailmenu|øl.?menu|drinks.?menu/i,
  kid: /børnemenu|børneret|barnemenuen/i,
  craftsmanship: /hjemmelavet|håndlavet|friskbagt|håndpillede?|hånd.?rullet|hånd.?skåret|selv.?lavet/i,
  localSourcing: /lokale? (råvarer|ingredienser|producenter)|traditionelle danske|fra Vesterhav|dansk produceret/i,
  innovation: /moderne (tilgang|twist|præsentation|fortolkning)|kreativ|nyfortolkning|fusion/i,
  culturalIdentity: /(Skandinavisk|dansk|fransk|italiensk|asiatisk) (madkultur|frokostkultur|traditioner|køkken)/i,
  experience: /(luksuriøs|global|alsidig|social|delbar|intim|hyggelig) oplevelse/i,
  qualitySignal: /fokus på kvalitet|premium ingredienser|autentisk smag|høj kvalitet|økologisk/i,
  familyFriendly: /børnevenlig|familier|børn velkommen|family.?friendly/i,
  customization: /tilpasning|variation|valgmuligheder|personlig|kan sammensættes/i
}

// Marketing sentence filter (matching get-quick-suggestions/index.ts)
function isMarketingSentence(line) {
  const marketingPhrases = [
    /perfekt til|ideel til|egnet til/i,
    /velkommen til at/i,
    /du kan (også )?bestille|bestil her/i,
    /kom (forbi|og besøg)/i,
    /finder du (også|her)/i,
    /tilbyder vi/i,
    /vi (har|serverer|laver)/i
  ]
  return marketingPhrases.some(p => p.test(line))
}

// Extract facts from ai_summary
function extractFacts(aiSummary, servicePeriodName = '') {
  const facts = []
  const periodLabel = servicePeriodName ? `[${servicePeriodName}] ` : ''
  
  if (!aiSummary || typeof aiSummary !== 'string') return facts
  
  const lines = aiSummary
    .split('\n')
    .map(l => l.replace(/^[\s•\-–*]+/, '').trim())
    .filter(l => l.length > 10 && !isMarketingSentence(l))
  
  for (const line of lines) {
    // Test each pattern
    const quotedMatches = [...line.matchAll(patterns.quotedName)].map(m => m[1])
    if (quotedMatches.length > 0) {
      facts.push({ type: 'quotedName', text: `${periodLabel}${quotedMatches.join(', ')}`, line })
      continue
    }
    
    if (patterns.dietary.test(line)) {
      facts.push({ type: 'dietary', text: `${periodLabel}${line.slice(0, 80).replace(/[,;].*$/, '')}`, line })
      continue
    }
    
    if (patterns.drink.test(line)) {
      facts.push({ type: 'drink', text: `${periodLabel}${line.slice(0, 80).replace(/[,;].*$/, '')}`, line })
      continue
    }
    
    if (patterns.kid.test(line)) {
      facts.push({ type: 'kid', text: `${periodLabel}Børnemenu tilgængelig`, line })
      continue
    }
    
    if (patterns.craftsmanship.test(line)) {
      facts.push({ type: 'craftsmanship', text: `${periodLabel}${line.slice(0, 80).replace(/[,;].*$/, '')}`, line })
      continue
    }
    
    if (patterns.localSourcing.test(line)) {
      facts.push({ type: 'localSourcing', text: `${periodLabel}${line.slice(0, 80).replace(/[,;].*$/, '')}`, line })
      continue
    }
    
    if (patterns.innovation.test(line)) {
      facts.push({ type: 'innovation', text: `${periodLabel}${line.slice(0, 80).replace(/[,;].*$/, '')}`, line })
      continue
    }
    
    if (patterns.culturalIdentity.test(line)) {
      facts.push({ type: 'culturalIdentity', text: `${periodLabel}${line.slice(0, 80).replace(/[,;].*$/, '')}`, line })
      continue
    }
    
    if (patterns.experience.test(line)) {
      facts.push({ type: 'experience', text: `${periodLabel}${line.slice(0, 80).replace(/[,;].*$/, '')}`, line })
      continue
    }
    
    if (patterns.qualitySignal.test(line)) {
      facts.push({ type: 'qualitySignal', text: `${periodLabel}${line.slice(0, 80).replace(/[,;].*$/, '')}`, line })
      continue
    }
    
    if (patterns.familyFriendly.test(line)) {
      facts.push({ type: 'familyFriendly', text: `${periodLabel}${line.slice(0, 80).replace(/[,;].*$/, '')}`, line })
      continue
    }
    
    if (patterns.customization.test(line)) {
      facts.push({ type: 'customization', text: `${periodLabel}${line.slice(0, 80).replace(/[,;].*$/, '')}`, line })
      continue
    }
  }
  
  return facts
}

// Test with real businesses
async function runTests() {
  console.log('🧪 Testing Menu Intelligence Extraction Patterns\n')
  
  // First, find businesses with ai_summary data
  console.log('🔍 Finding businesses with ai_summary data...\n')
  
  const { data: menusWithSummary, error: searchError } = await supabase
    .from('menu_results_v2')
    .select('business_id, source_url, ai_summary, service_period_name')
    .not('ai_summary', 'is', null)
    .limit(10)
  
  if (searchError) {
    console.error(`❌ Error searching for menus: ${searchError.message}`)
    return
  }
  
  if (!menusWithSummary || menusWithSummary.length === 0) {
    console.log('⚠️  No menus with ai_summary found in database')
    return
  }
  
  // Get unique business IDs
  const businessIds = [...new Set(menusWithSummary.map(m => m.business_id))]
  console.log(`✅ Found ${businessIds.length} businesses with ai_summary data`)
  console.log(`📋 Testing with first ${Math.min(2, businessIds.length)} businesses\n`)
  
  const testBusinessIds = businessIds.slice(0, 2)
  
  for (const businessId of testBusinessIds) {
    console.log(`\n${'='.repeat(80)}`)
    console.log(`📍 Business: ${businessId}`)
    console.log('='.repeat(80))
    
    // Fetch menu_results_v2 for this business
    const { data: menus, error } = await supabase
      .from('menu_results_v2')
      .select('id, source_url, ai_summary, service_period_name')
      .eq('business_id', businessId)
      .not('ai_summary', 'is', null)
      .limit(5)
    
    if (error) {
      console.error(`❌ Error fetching menus: ${error.message}`)
      continue
    }
    
    if (!menus || menus.length === 0) {
      console.log('⚠️  No menus with ai_summary found')
      continue
    }
    
    console.log(`\n📋 Found ${menus.length} menus with ai_summary\n`)
    
    let totalFacts = 0
    const factsByType = {}
    
    for (const menu of menus) {
      console.log(`\n--- Menu: ${menu.service_period_name || 'No period name'} ---`)
      console.log(`URL: ${menu.source_url || 'N/A'}`)
      console.log(`\nai_summary:`)
      console.log(menu.ai_summary)
      
      const facts = extractFacts(menu.ai_summary, menu.service_period_name)
      
      if (facts.length === 0) {
        console.log(`\n❌ No facts extracted`)
      } else {
        console.log(`\n✅ Extracted ${facts.length} facts:`)
        facts.forEach(fact => {
          console.log(`  [${fact.type}] ${fact.text}`)
          factsByType[fact.type] = (factsByType[fact.type] || 0) + 1
          totalFacts++
        })
      }
    }
    
    console.log(`\n${'─'.repeat(80)}`)
    console.log(`📊 Summary for ${businessId}:`)
    console.log(`   Total facts: ${totalFacts}`)
    console.log(`   Facts by type:`)
    Object.entries(factsByType)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`     - ${type}: ${count}`)
      })
  }
  
  console.log(`\n${'='.repeat(80)}`)
  console.log('✅ Test complete!')
  console.log('='.repeat(80))
}

await runTests()
