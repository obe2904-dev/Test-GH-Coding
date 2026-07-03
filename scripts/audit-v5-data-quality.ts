#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

// V5 Data Quality Audit Script
// Checks which businesses have V5 data and assesses completeness

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { V5DataQuality } from '../src/types/brand-profile-v5.ts'

// Initialize Supabase client
const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

interface AuditStats {
  totalBusinesses: number
  withLayer3: number
  withLayer4: number
  ready: number
  partial: number
  missing: number
}

/**
 * Assess V5 data quality for a single business
 */
async function assessBusiness(businessId: string, businessName: string): Promise<V5DataQuality> {
  // Fetch Layer 3 (Identity Profile)
  const { data: profile, error: profileError } = await supabase
    .from('business_brand_profile')
    .select('brand_essence, positioning, core_values, what_makes_us_different, identity_confidence, identity_reasoning')
    .eq('business_id', businessId)
    .maybeSingle()
  
  // Fetch Layer 4 (Programme Profiles)
  const { data: programmes, error: programmesError } = await supabase
    .from('business_programme_profiles')
    .select('programme_type, programme_name, audience_segments, segment_confidence')
    .eq('business_id', businessId)
  
  // Assess Layer 3 completeness
  const layer3Fields = {
    brand_essence: !!(profile?.brand_essence),
    positioning: !!(profile?.positioning),
    core_values: !!(profile?.core_values),
    what_makes_us_different: !!(profile?.what_makes_us_different),
    identity_confidence: profile?.identity_confidence || 0
  }
  
  const layer3Count = Object.values(layer3Fields).filter(v => v === true).length
  const layer3Completeness = layer3Count / 4  // 4 required fields (excluding confidence)
  
  // Assess Layer 4 completeness
  let totalSegments = 0
  let segmentsWithEvidence = 0
  let totalConfidence = 0
  let confidenceCount = 0
  
  if (programmes && programmes.length > 0) {
    for (const prog of programmes) {
      if (prog.audience_segments && Array.isArray(prog.audience_segments)) {
        for (const seg of prog.audience_segments) {
          totalSegments++
          if (seg.evidence && Array.isArray(seg.evidence) && seg.evidence.length > 0) {
            segmentsWithEvidence++
          }
        }
      }
      if (prog.segment_confidence) {
        totalConfidence += prog.segment_confidence
        confidenceCount++
      }
    }
  }
  
  // Calculate quality status
  let quality: 'ready' | 'partial' | 'missing' | 'error' = 'missing'
  const missingFields: string[] = []
  const recommendations: string[] = []
  
  if (profileError || programmesError) {
    quality = 'error'
    if (profileError) recommendations.push(`Layer 3 error: ${profileError.message}`)
    if (programmesError) recommendations.push(`Layer 4 error: ${programmesError.message}`)
  } else if (layer3Completeness === 1 && programmes && programmes.length > 0 && totalSegments > 0) {
    quality = 'ready'
    if (segmentsWithEvidence / totalSegments < 0.8) {
      recommendations.push('Some segments lack evidence - regenerate Layer 4')
    }
  } else if (layer3Completeness > 0 || (programmes && programmes.length > 0)) {
    quality = 'partial'
    if (layer3Completeness < 1) {
      if (!profile?.brand_essence) missingFields.push('brand_essence')
      if (!profile?.positioning) missingFields.push('positioning')
      if (!profile?.core_values) missingFields.push('core_values')
      if (!profile?.what_makes_us_different) missingFields.push('what_makes_us_different')
      recommendations.push('Regenerate Layer 3 (Identity Profile)')
    }
    if (!programmes || programmes.length === 0) {
      missingFields.push('programme_profiles')
      recommendations.push('Generate Layer 4 (Programme Profiles)')
    } else if (totalSegments === 0) {
      missingFields.push('audience_segments')
      recommendations.push('Regenerate Layer 4 with audience segments')
    }
  } else {
    quality = 'missing'
    recommendations.push('Run brand-profile-generator-v5 to generate all layers')
  }
  
  return {
    businessId,
    businessName,
    hasLayer3: !!profile,
    layer3Completeness,
    layer3Fields,
    hasLayer4: !!(programmes && programmes.length > 0),
    layer4Programmes: programmes?.length || 0,
    totalSegments,
    segmentsWithEvidence,
    averageSegmentConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
    quality,
    missingFields,
    recommendations
  }
}

/**
 * Main audit function
 */
async function runAudit() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('V5 DATA QUALITY AUDIT')
  console.log('═══════════════════════════════════════════════════════════\n')
  
  // Fetch all businesses
  const { data: businesses, error } = await supabase
    .from('businesses')
    .select('id, name')
    .order('name')
  
  if (error) {
    console.error('❌ Failed to fetch businesses:', error.message)
    Deno.exit(1)
  }
  
  if (!businesses || businesses.length === 0) {
    console.log('No businesses found.')
    Deno.exit(0)
  }
  
  console.log(`Found ${businesses.length} businesses. Auditing...\n`)
  
  const results: V5DataQuality[] = []
  const stats: AuditStats = {
    totalBusinesses: businesses.length,
    withLayer3: 0,
    withLayer4: 0,
    ready: 0,
    partial: 0,
    missing: 0
  }
  
  // Assess each business
  for (const biz of businesses) {
    const assessment = await assessBusiness(biz.id, biz.name)
    results.push(assessment)
    
    // Update stats
    if (assessment.hasLayer3) stats.withLayer3++
    if (assessment.hasLayer4) stats.withLayer4++
    if (assessment.quality === 'ready') stats.ready++
    else if (assessment.quality === 'partial') stats.partial++
    else stats.missing++
  }
  
  // Display results
  console.log('═══════════════════════════════════════════════════════════')
  console.log('SUMMARY STATISTICS')
  console.log('═══════════════════════════════════════════════════════════\n')
  
  console.log(`Total Businesses: ${stats.totalBusinesses}`)
  console.log(`\n✅ Ready for V5: ${stats.ready} (${Math.round(stats.ready / stats.totalBusinesses * 100)}%)`)
  console.log(`⚠️  Partial Data: ${stats.partial} (${Math.round(stats.partial / stats.totalBusinesses * 100)}%)`)
  console.log(`❌ Missing Data: ${stats.missing} (${Math.round(stats.missing / stats.totalBusinesses * 100)}%)`)
  console.log(`\nLayer 3 Coverage: ${stats.withLayer3}/${stats.totalBusinesses} (${Math.round(stats.withLayer3 / stats.totalBusinesses * 100)}%)`)
  console.log(`Layer 4 Coverage: ${stats.withLayer4}/${stats.totalBusinesses} (${Math.round(stats.withLayer4 / stats.totalBusinesses * 100)}%)`)
  
  // Display ready businesses
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('READY BUSINESSES (100% V5 Compatible)')
  console.log('═══════════════════════════════════════════════════════════\n')
  
  const ready = results.filter(r => r.quality === 'ready')
  if (ready.length === 0) {
    console.log('None\n')
  } else {
    for (const biz of ready) {
      console.log(`✅ ${biz.businessName}`)
      console.log(`   ID: ${biz.businessId}`)
      console.log(`   Layer 3: ${Math.round(biz.layer3Completeness * 100)}% complete`)
      console.log(`   Layer 4: ${biz.layer4Programmes} programmes, ${biz.totalSegments} segments`)
      console.log(`   Evidence: ${biz.segmentsWithEvidence}/${biz.totalSegments} segments (${Math.round(biz.segmentsWithEvidence / biz.totalSegments * 100)}%)`)
      if (biz.recommendations.length > 0) {
        console.log(`   💡 ${biz.recommendations[0]}`)
      }
      console.log()
    }
  }
  
  // Display partial businesses
  console.log('═══════════════════════════════════════════════════════════')
  console.log('PARTIAL BUSINESSES (Some V5 Data)')
  console.log('═══════════════════════════════════════════════════════════\n')
  
  const partial = results.filter(r => r.quality === 'partial')
  if (partial.length === 0) {
    console.log('None\n')
  } else {
    for (const biz of partial.slice(0, 10)) {  // Show first 10
      console.log(`⚠️  ${biz.businessName}`)
      console.log(`   Layer 3: ${biz.hasLayer3 ? '✅' : '❌'} (${Math.round(biz.layer3Completeness * 100)}%)`)
      console.log(`   Layer 4: ${biz.hasLayer4 ? '✅' : '❌'} (${biz.layer4Programmes} programmes)`)
      console.log(`   Missing: ${biz.missingFields.join(', ') || 'none'}`)
      console.log(`   💡 ${biz.recommendations[0] || 'No recommendations'}`)
      console.log()
    }
    if (partial.length > 10) {
      console.log(`   ... and ${partial.length - 10} more\n`)
    }
  }
  
  // Display test business (Café Faust) detail
  console.log('═══════════════════════════════════════════════════════════')
  console.log('TEST BUSINESS DETAIL (Café Faust)')
  console.log('═══════════════════════════════════════════════════════════\n')
  
  const testBusiness = results.find(r => 
    r.businessId === '2037d63c-a138-4247-89c5-5b6b8cef9f3f' ||
    r.businessName.toLowerCase().includes('faust')
  )
  
  if (testBusiness) {
    console.log(`Business: ${testBusiness.businessName}`)
    console.log(`ID: ${testBusiness.businessId}`)
    console.log(`\nLayer 3 (Identity Profile):`)
    console.log(`  Status: ${testBusiness.hasLayer3 ? '✅ Present' : '❌ Missing'}`)
    console.log(`  Completeness: ${Math.round(testBusiness.layer3Completeness * 100)}%`)
    console.log(`  Fields:`)
    console.log(`    brand_essence: ${testBusiness.layer3Fields.brand_essence ? '✅' : '❌'}`)
    console.log(`    positioning: ${testBusiness.layer3Fields.positioning ? '✅' : '❌'}`)
    console.log(`    core_values: ${testBusiness.layer3Fields.core_values ? '✅' : '❌'}`)
    console.log(`    what_makes_us_different: ${testBusiness.layer3Fields.what_makes_us_different ? '✅' : '❌'}`)
    console.log(`    identity_confidence: ${testBusiness.layer3Fields.identity_confidence}`)
    
    console.log(`\nLayer 4 (Programme Profiles):`)
    console.log(`  Status: ${testBusiness.hasLayer4 ? '✅ Present' : '❌ Missing'}`)
    console.log(`  Programmes: ${testBusiness.layer4Programmes}`)
    console.log(`  Total Segments: ${testBusiness.totalSegments}`)
    console.log(`  Segments with Evidence: ${testBusiness.segmentsWithEvidence}/${testBusiness.totalSegments}`)
    console.log(`  Average Confidence: ${Math.round(testBusiness.averageSegmentConfidence * 100)}%`)
    
    console.log(`\nOverall Quality: ${testBusiness.quality.toUpperCase()}`)
    
    if (testBusiness.recommendations.length > 0) {
      console.log(`\nRecommendations:`)
      for (const rec of testBusiness.recommendations) {
        console.log(`  💡 ${rec}`)
      }
    }
  } else {
    console.log('❌ Test business (Café Faust) not found')
  }
  
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('AUDIT COMPLETE')
  console.log('═══════════════════════════════════════════════════════════\n')
  
  // Exit with status code based on test business readiness
  if (testBusiness && testBusiness.quality === 'ready') {
    console.log('✅ Test business is ready for V5 integration\n')
    Deno.exit(0)
  } else {
    console.log('⚠️  Test business needs V5 data generation\n')
    Deno.exit(1)
  }
}

// Run audit
if (import.meta.main) {
  runAudit()
}
