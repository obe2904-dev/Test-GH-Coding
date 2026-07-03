/**
 * LAYER 7 COMPREHENSIVE TEST SUITE
 * Tests media format selection and platform finalization
 */

import { testHelpers } from './supabase/functions/_shared/post-helpers/media-format-selector.ts'

const {
  getContentFormatPreference,
  isPlatformCompatible,
  shouldIncreaseReels,
  respectCapacityConstraints,
  enforceBalancing,
  generateFormatReason,
  generatePlatformReason,
  FORMAT_PREFERENCES,
  PLATFORM_FORMATS,
} = testHelpers

console.log('🧪 LAYER 7: MEDIA FORMAT & PLATFORM SELECTOR TEST SUITE')
console.log('=' .repeat(70))

let passedTests = 0
let totalTests = 0

function test(name: string, fn: () => boolean) {
  totalTests++
  try {
    const result = fn()
    if (result) {
      console.log(`✅ ${name}`)
      passedTests++
    } else {
      console.log(`❌ ${name}`)
    }
  } catch (error) {
    console.log(`❌ ${name} - Error: ${(error as Error).message}`)
  }
}

// ============================================================================
// TEST 1: FORMAT PREFERENCES BY CONTENT TYPE
// ============================================================================

console.log('\n📸 TEST 1: Format Preferences by Content Type')
console.log('─'.repeat(70))

test('Menu highlights prefer photo first (beauty shots)', () => {
  const prefs = getContentFormatPreference('menu_highlight')
  return prefs[0] === 'photo'
})

test('Behind-scenes prefer reel first (action/process)', () => {
  const prefs = getContentFormatPreference('behind_scenes')
  return prefs[0] === 'reel'
})

test('Atmosphere prefers reel (sound and movement)', () => {
  const prefs = getContentFormatPreference('atmosphere')
  return prefs[0] === 'reel'
})

test('Event promotion prefers carousel (multiple aspects)', () => {
  const prefs = getContentFormatPreference('event_promotion')
  return prefs[0] === 'carousel'
})

test('Engagement posts prefer photo (keep simple)', () => {
  const prefs = getContentFormatPreference('engagement')
  return prefs[0] === 'photo'
})

test('Unknown content type defaults to photo', () => {
  const prefs = getContentFormatPreference('unknown_type')
  return prefs[0] === 'photo'
})

// ============================================================================
// TEST 2: PLATFORM-FORMAT COMPATIBILITY
// ============================================================================

console.log('\n🔌 TEST 2: Platform-Format Compatibility')
console.log('─'.repeat(70))

test('Instagram supports photo', () => {
  return isPlatformCompatible('instagram', 'photo')
})

test('Instagram supports carousel', () => {
  return isPlatformCompatible('instagram', 'carousel')
})

test('Instagram supports reel', () => {
  return isPlatformCompatible('instagram', 'reel')
})

test('TikTok supports video/reel', () => {
  return isPlatformCompatible('tiktok', 'video') || isPlatformCompatible('tiktok', 'reel')
})

test('TikTok does NOT support carousel', () => {
  return !isPlatformCompatible('tiktok', 'carousel')
})

test('LinkedIn supports photo', () => {
  return isPlatformCompatible('linkedin', 'photo')
})

test('LinkedIn does NOT support reel', () => {
  return !isPlatformCompatible('linkedin', 'reel')
})

test('Facebook supports all standard formats', () => {
  return isPlatformCompatible('facebook', 'photo') &&
         isPlatformCompatible('facebook', 'carousel') &&
         isPlatformCompatible('facebook', 'reel')
})

// ============================================================================
// TEST 3: HISTORICAL PERFORMANCE ANALYSIS
// ============================================================================

console.log('\n📊 TEST 3: Historical Performance Analysis')
console.log('─'.repeat(70))

test('Recommends Reels when performing +40% better', () => {
  const performanceData = {
    format_performance: {
      photo: { avg_engagement: 100 },
      reel: { avg_engagement: 150 }, // +50% better
    }
  }
  return shouldIncreaseReels(performanceData)
})

test('Does NOT recommend Reels when only +30% better', () => {
  const performanceData = {
    format_performance: {
      photo: { avg_engagement: 100 },
      reel: { avg_engagement: 130 }, // +30% better (below 40% threshold)
    }
  }
  return !shouldIncreaseReels(performanceData)
})

test('Returns false when no performance data', () => {
  return !shouldIncreaseReels(null)
})

test('Returns false when missing photo performance', () => {
  const performanceData = {
    format_performance: {
      reel: { avg_engagement: 150 },
    }
  }
  return !shouldIncreaseReels(performanceData)
})

test('Returns false when missing reel performance', () => {
  const performanceData = {
    format_performance: {
      photo: { avg_engagement: 100 },
    }
  }
  return !shouldIncreaseReels(performanceData)
})

// ============================================================================
// TEST 4: CAPACITY CONSTRAINTS
// ============================================================================

console.log('\n⚡ TEST 4: Capacity Constraints')
console.log('─'.repeat(70))

test('Allows Reel when under 40% for FSE business', () => {
  const recentFormats = ['photo', 'photo', 'reel', 'photo', 'photo']
  // 1/5 = 20% Reels
  const format = respectCapacityConstraints('reel', recentFormats, 'FSE')
  return format === 'reel'
})

test('Blocks Reel when at 40% for FSE business', () => {
  const recentFormats = ['photo', 'reel', 'photo', 'reel', 'photo']
  // 2/5 = 40% Reels
  const format = respectCapacityConstraints('reel', recentFormats, 'FSE')
  return format === 'photo' // Should fallback to photo
})

test('Allows Reel when at 40% for MFV business (50% limit)', () => {
  const recentFormats = ['photo', 'reel', 'photo', 'reel', 'photo']
  // 2/5 = 40% Reels (under 50% limit for MFV)
  const format = respectCapacityConstraints('reel', recentFormats, 'MFV')
  return format === 'reel'
})

test('Blocks Reel when at 50% for MFV business', () => {
  const recentFormats = ['reel', 'photo', 'reel', 'photo', 'reel']
  // 3/6 = 50% Reels
  const format = respectCapacityConstraints('reel', recentFormats, 'MFV')
  return format === 'photo'
})

test('Does not affect non-Reel formats', () => {
  const recentFormats = ['reel', 'reel', 'reel', 'reel', 'reel']
  // 100% Reels, but proposing carousel
  const format = respectCapacityConstraints('carousel', recentFormats, 'FSE')
  return format === 'carousel'
})

test('Allows Reel when no history', () => {
  const format = respectCapacityConstraints('reel', [], 'FSE')
  return format === 'reel'
})

// ============================================================================
// TEST 5: PLATFORM BALANCE ENFORCEMENT
// ============================================================================

console.log('\n⚖️  TEST 5: Platform Balance Enforcement')
console.log('─'.repeat(70))

test('Forces switch after 3 consecutive posts to same platform', () => {
  const recentPlatforms = ['instagram', 'instagram', 'instagram']
  const availablePlatforms = ['instagram', 'facebook']
  const platform = enforceBalancing('instagram', recentPlatforms, availablePlatforms)
  return platform === 'facebook'
})

test('Keeps platform when last 3 are mixed', () => {
  const recentPlatforms = ['instagram', 'facebook', 'instagram']
  const availablePlatforms = ['instagram', 'facebook']
  const platform = enforceBalancing('instagram', recentPlatforms, availablePlatforms)
  return platform === 'instagram'
})

test('Forces neglected platform after 7 posts', () => {
  const recentPlatforms = [
    'instagram', 'instagram', 'instagram',
    'instagram', 'instagram', 'instagram', 'instagram'
  ]
  const availablePlatforms = ['instagram', 'facebook']
  const platform = enforceBalancing('instagram', recentPlatforms, availablePlatforms)
  return platform === 'facebook'
})

test('No balancing for single platform business', () => {
  const recentPlatforms = ['instagram', 'instagram', 'instagram']
  const availablePlatforms = ['instagram']
  const platform = enforceBalancing('instagram', recentPlatforms, availablePlatforms)
  return platform === 'instagram'
})

test('Returns proposed platform when no history', () => {
  const platform = enforceBalancing('instagram', [], ['instagram', 'facebook'])
  return platform === 'instagram'
})

// ============================================================================
// TEST 6: REASON GENERATION
// ============================================================================

console.log('\n📝 TEST 6: Reason Generation')
console.log('─'.repeat(70))

test('Generates reason for photo format', () => {
  const reason = generateFormatReason('photo', 'menu_highlight', false)
  return reason.length > 0 && reason.includes('image')
})

test('Generates reason for carousel format', () => {
  const reason = generateFormatReason('carousel', 'event_promotion', false)
  return reason.length > 0 && reason.includes('Multiple')
})

test('Generates reason for reel with performance note', () => {
  const reason = generateFormatReason('reel', 'atmosphere', true)
  return reason.includes('40%') || reason.includes('performing')
})

test('Generates platform reason for Instagram', () => {
  const reason = generatePlatformReason('instagram', 'photo', false)
  return reason.includes('Instagram')
})

test('Indicates when platform was enforced', () => {
  const reason = generatePlatformReason('facebook', 'photo', true)
  return reason.includes('balance') || reason.includes('neglect')
})

// ============================================================================
// TEST 7: INTEGRATED SCENARIOS
// ============================================================================

console.log('\n🎯 TEST 7: Integrated Scenarios')
console.log('─'.repeat(70))

test('Scenario 1: Menu highlight defaults to photo', () => {
  const prefs = getContentFormatPreference('menu_highlight')
  return prefs[0] === 'photo'
})

test('Scenario 2: Behind-scenes Reel blocked by capacity', () => {
  const recentFormats = ['reel', 'reel', 'photo', 'reel', 'photo']
  // 3/5 = 60% Reels (over 40% FSE limit)
  const format = respectCapacityConstraints('reel', recentFormats, 'FSE')
  return format === 'photo'
})

test('Scenario 3: TikTok requires video-compatible format', () => {
  // TikTok doesn't support carousel
  const isCarouselCompatible = isPlatformCompatible('tiktok', 'carousel')
  const isVideoCompatible = isPlatformCompatible('tiktok', 'video')
  return !isCarouselCompatible && isVideoCompatible
})

test('Scenario 4: Platform switching after 3 consecutive', () => {
  const recentPlatforms = ['facebook', 'facebook', 'facebook']
  const availablePlatforms = ['instagram', 'facebook']
  const platform = enforceBalancing('facebook', recentPlatforms, availablePlatforms)
  return platform === 'instagram'
})

test('Scenario 5: Performance-driven Reel recommendation', () => {
  const performanceData = {
    format_performance: {
      photo: { avg_engagement: 100 },
      reel: { avg_engagement: 200 }, // +100% better
    }
  }
  return shouldIncreaseReels(performanceData)
})

// ============================================================================
// TEST 8: EDGE CASES
// ============================================================================

console.log('\n🔧 TEST 8: Edge Cases')
console.log('─'.repeat(70))

test('Handles empty recent formats gracefully', () => {
  const format = respectCapacityConstraints('reel', [], 'FSE')
  return format === 'reel'
})

test('Handles empty recent platforms gracefully', () => {
  const platform = enforceBalancing('instagram', [], ['instagram', 'facebook'])
  return platform === 'instagram'
})

test('Handles single platform with balancing attempt', () => {
  const recentPlatforms = ['instagram', 'instagram', 'instagram']
  const platform = enforceBalancing('instagram', recentPlatforms, ['instagram'])
  return platform === 'instagram'
})

test('Handles unknown platform format check', () => {
  const isCompatible = isPlatformCompatible('unknown_platform', 'photo')
  return isCompatible // Should default to photo support
})

test('Handles performance data with missing keys', () => {
  const performanceData = { format_performance: {} }
  return !shouldIncreaseReels(performanceData)
})

// ============================================================================
// TEST 9: FORMAT & PLATFORM MATRIX COVERAGE
// ============================================================================

console.log('\n📋 TEST 9: Format & Platform Matrix Coverage')
console.log('─'.repeat(70))

test('All standard content types have format preferences', () => {
  const requiredTypes = [
    'menu_highlight',
    'location_story',
    'behind_scenes',
    'engagement',
    'event_promotion',
    'atmosphere',
  ]
  return requiredTypes.every(type => 
    FORMAT_PREFERENCES[type] && FORMAT_PREFERENCES[type].length > 0
  )
})

test('All platforms define supported formats', () => {
  const platforms = ['instagram', 'facebook', 'tiktok', 'linkedin']
  return platforms.every(platform =>
    PLATFORM_FORMATS[platform] && PLATFORM_FORMATS[platform].length > 0
  )
})

test('All standard formats are defined', () => {
  const standardFormats = ['photo', 'carousel', 'reel', 'video']
  return standardFormats.every(format =>
    Object.values(PLATFORM_FORMATS).some(formats => formats.includes(format))
  )
})

test('Photo is supported on visual platforms', () => {
  // Instagram, Facebook, LinkedIn support photo
  // TikTok is video-first and may not support static photos
  const visualPlatforms = ['instagram', 'facebook', 'linkedin']
  return visualPlatforms.every(platform =>
    PLATFORM_FORMATS[platform]?.includes('photo')
  )
})

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(70))
console.log('📊 TEST SUMMARY')
console.log('='.repeat(70))

const percentage = Math.round((passedTests / totalTests) * 100)
console.log(`\n✅ Passed: ${passedTests}/${totalTests} tests (${percentage}%)`)

if (passedTests === totalTests) {
  console.log('\n🎉 All tests passed! Layer 7 is working correctly.')
  console.log('\n✨ Validated:')
  console.log('   • Format preferences (content-type specific)')
  console.log('   • Platform compatibility (format-platform matrix)')
  console.log('   • Performance analysis (+40% Reel threshold)')
  console.log('   • Capacity constraints (40% max Reels for FSE/SBO)')
  console.log('   • Platform balancing (3 consecutive, 7-day neglect)')
  console.log('   • Reason generation (human-readable explanations)')
  console.log('   • Integrated scenarios (full selection chain)')
  console.log('   • Edge case handling (missing data, single platform)')
  console.log('   • Matrix coverage (all content types & platforms defined)')
  
  console.log('\n🎯 Layer 7 Status: OPERATIONAL ✅')
  console.log('   Ready for integration with Layer 6 and Layer 8')
  console.log('\n📋 Format Distribution Guidelines:')
  console.log('   • Photo: 40-60% (baseline, fastest production)')
  console.log('   • Carousel: 20-30% (variety & storytelling)')
  console.log('   • Reel: 20-40% (when performance justifies)')
  console.log('\n⚖️  Platform Balance:')
  console.log('   • No more than 3 consecutive to same platform')
  console.log('   • No platform neglected >7 posts')
  console.log('   • Dynamic from profiles.selected_platforms')
} else {
  console.log(`\n⚠️  ${totalTests - passedTests} test(s) failed`)
  console.log('   Review failed tests above')
}

Deno.exit(passedTests === totalTests ? 0 : 1)
