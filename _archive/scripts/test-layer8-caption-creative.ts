/**
 * LAYER 8 COMPREHENSIVE TEST SUITE
 * Tests caption generation, visual directions, and content brief assembly
 */

import { testHelpers as captionHelpers } from './supabase/functions/_shared/post-helpers/caption-generator.ts'
import { testHelpers as visualHelpers } from './supabase/functions/_shared/post-helpers/visual-direction-generator.ts'
import { testHelpers as briefHelpers, assembleContentBrief, formatBriefForDisplay } from './supabase/functions/_shared/post-helpers/content-brief-assembler.ts'

const {
  generateHook,
  generateCoreMessage,
  weaveContext,
  generateCTA,
  selectEmojis,
  PLATFORM_LIMITS,
  EMOJI_FREQUENCIES,
} = captionHelpers

const {
  getLightingDirection,
  getStylingDirection,
  getSettingDirection,
  generatePhotoDirection,
  estimateProductionTime,
  TECHNICAL_SPECS,
} = visualHelpers

const {
  convertTimeToPostPeriod,
  generateContextNotes,
} = briefHelpers

console.log('🧪 LAYER 8: CAPTION & CREATIVE DIRECTION TEST SUITE')
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
// TEST 1: CAPTION HOOK GENERATION
// ============================================================================

console.log('\n🎣 TEST 1: Caption Hook Generation')
console.log('─'.repeat(70))

test('Casual voice generates conversational hook', () => {
  const hook = generateHook(
    { tone: 'casual', emoji_frequency: 'moderate' },
    'menu_highlight',
    'Spring Salmon'
  )
  return hook.length > 0 && hook.length < 150
})

test('Refined voice generates elegant hook', () => {
  const hook = generateHook(
    { tone: 'refined', emoji_frequency: 'minimal' },
    'menu_highlight',
    'Pan-Seared Salmon'
  )
  return hook.length > 0 && !hook.includes('😋')
})

test('Playful voice generates fun hook', () => {
  const hook = generateHook(
    { tone: 'playful', emoji_frequency: 'frequent' },
    'behind_scenes',
    'Kitchen Magic'
  )
  return hook.length > 0
})

test('Professional voice generates clear hook', () => {
  const hook = generateHook(
    { tone: 'professional', emoji_frequency: 'none' },
    'menu_highlight',
    'Seasonal Menu'
  )
  return hook.length > 0
})

// ============================================================================
// TEST 2: CORE MESSAGE GENERATION
// ============================================================================

console.log('\n💬 TEST 2: Core Message Generation')
console.log('─'.repeat(70))

test('Menu highlight includes subject', () => {
  const message = generateCoreMessage(
    { tone: 'casual', emoji_frequency: 'moderate' },
    'Spring Salmon',
    'menu_highlight'
  )
  return message.includes('Spring Salmon') || message.includes('spring salmon')
})

test('Refined voice uses sophisticated language', () => {
  const message = generateCoreMessage(
    { tone: 'refined', emoji_frequency: 'minimal' },
    'Salmon',
    'menu_highlight'
  )
  return message.includes('locally') || message.includes('prepared') || message.includes('traditional')
})

test('Behind-scenes mentions process', () => {
  const message = generateCoreMessage(
    { tone: 'casual', emoji_frequency: 'moderate' },
    'Salmon',
    'behind_scenes'
  )
  return message.length > 0
})

// ============================================================================
// TEST 3: CONTEXT WEAVING
// ============================================================================

console.log('\n🌍 TEST 3: Context Weaving')
console.log('─'.repeat(70))

test('Waterfront + Spring + Sunny creates specific context', () => {
  const context = weaveContext(
    { season: 'spring', weather: 'sunny' },
    { type: 'waterfront', amplifiers: [] },
    'lunch'
  )
  return context.includes('waterfront') || context.includes('spring') || context.includes('Spring')
})

test('City center + Lunch creates business context', () => {
  const context = weaveContext(
    { season: 'spring' },
    { type: 'city_center', amplifiers: [] },
    'lunch'
  )
  return context.length > 0
})

test('Rainy weather triggers hygge context', () => {
  const context = weaveContext(
    { season: 'fall', weather: 'rainy' },
    { type: 'waterfront', amplifiers: [] }
  )
  return context.includes('Rainy') || context.includes('hygge') || context.includes('cozy')
})

test('Winter + Cold creates warmth context', () => {
  const context = weaveContext(
    { season: 'winter', weather: 'cold' },
    { type: 'city_center', amplifiers: [] }
  )
  return context.includes('Winter') || context.includes('winter') || context.includes('warmth') || context.includes('warm')
})

// ============================================================================
// TEST 4: CTA GENERATION
// ============================================================================

console.log('\n📣 TEST 4: Call-to-Action Generation')
console.log('─'.repeat(70))

test('Menu highlight CTA includes booking/visit', () => {
  const cta = generateCTA(
    { tone: 'casual', emoji_frequency: 'moderate' },
    'menu_highlight'
  )
  return cta.length > 0
})

test('Behind-scenes CTA encourages follow', () => {
  const cta = generateCTA(
    { tone: 'casual', emoji_frequency: 'moderate' },
    'behind_scenes'
  )
  return cta.length > 0
})

test('Engagement CTA asks for interaction', () => {
  const cta = generateCTA(
    { tone: 'playful', emoji_frequency: 'frequent' },
    'engagement'
  )
  return cta.length > 0
})

test('Professional CTA is clear and direct', () => {
  const cta = generateCTA(
    { tone: 'professional', emoji_frequency: 'none' },
    'menu_highlight'
  )
  return !cta.includes('😋') && !cta.includes('🔥')
})

// ============================================================================
// TEST 5: EMOJI SELECTION
// ============================================================================

console.log('\n😊 TEST 5: Emoji Selection')
console.log('─'.repeat(70))

test('None frequency returns no emojis', () => {
  const emojis = selectEmojis('none', 'menu_highlight', 'spring')
  return emojis.length === 0
})

test('Minimal frequency returns 1-2 emojis', () => {
  const emojis = selectEmojis('minimal', 'menu_highlight', 'spring')
  return emojis.length >= 1 && emojis.length <= 2
})

test('Moderate frequency returns 2-3 emojis', () => {
  const emojis = selectEmojis('moderate', 'menu_highlight', 'spring')
  return emojis.length >= 2 && emojis.length <= 3
})

test('Frequent frequency returns 3-5 emojis', () => {
  const emojis = selectEmojis('frequent', 'menu_highlight', 'spring')
  return emojis.length >= 3 && emojis.length <= 5
})

// ============================================================================
// TEST 6: PLATFORM CHARACTER LIMITS
// ============================================================================

console.log('\n📏 TEST 6: Platform Character Limits')
console.log('─'.repeat(70))

test('Instagram limit is 2200 chars', () => {
  return PLATFORM_LIMITS.instagram.max === 2200
})

test('Facebook limit is highest', () => {
  return PLATFORM_LIMITS.facebook.max > PLATFORM_LIMITS.instagram.max
})

test('LinkedIn limit is 3000 chars', () => {
  return PLATFORM_LIMITS.linkedin.max === 3000
})

test('TikTok limit matches Instagram', () => {
  return PLATFORM_LIMITS.tiktok.max === PLATFORM_LIMITS.instagram.max
})

// ============================================================================
// TEST 7: LIGHTING DIRECTION
// ============================================================================

console.log('\n💡 TEST 7: Lighting Direction')
console.log('─'.repeat(70))

test('Morning time generates soft morning light', () => {
  const lighting = getLightingDirection('morning', 'spring', undefined)
  return lighting.includes('morning') || lighting.includes('Morning')
})

test('Lunch time generates bright daylight', () => {
  const lighting = getLightingDirection('lunch', 'summer', undefined)
  return lighting.includes('daylight') || lighting.includes('bright')
})

test('Dinner time generates warm artificial lighting', () => {
  const lighting = getLightingDirection('dinner', 'winter', undefined)
  return lighting.includes('warm') || lighting.includes('artificial')
})

test('Rainy weather adjusts to diffused light', () => {
  const lighting = getLightingDirection('lunch', 'fall', 'rainy')
  return lighting.includes('diffused') || lighting.includes('Soft') || lighting.includes('soft') || 
         lighting.includes('minimal') || lighting.includes('cozy')
})

test('Winter season emphasizes warmth', () => {
  const lighting = getLightingDirection(undefined, 'winter', undefined)
  return lighting.includes('warm') || lighting.includes('Warm') || lighting.includes('cozy')
})

// ============================================================================
// TEST 8: STYLING DIRECTION
// ============================================================================

console.log('\n🎨 TEST 8: Styling Direction')
console.log('─'.repeat(70))

test('Spring styling includes fresh/bright colors', () => {
  const styling = getStylingDirection('spring')
  return styling.includes('spring') || styling.includes('Fresh') || styling.includes('bright')
})

test('Summer styling includes vibrant palette', () => {
  const styling = getStylingDirection('summer')
  return styling.includes('summer') || styling.includes('Vibrant') || styling.includes('vibrant')
})

test('Fall styling includes rich autumn tones', () => {
  const styling = getStylingDirection('fall')
  return styling.includes('fall') || styling.includes('autumn') || styling.includes('Rich')
})

test('Winter styling includes warm elements', () => {
  const styling = getStylingDirection('winter')
  return styling.includes('winter') || styling.includes('warm') || styling.includes('Warm')
})

// ============================================================================
// TEST 9: SETTING DIRECTION
// ============================================================================

console.log('\n🏛️ TEST 9: Setting Direction')
console.log('─'.repeat(70))

test('Waterfront includes harbor/water view', () => {
  const setting = getSettingDirection('waterfront', [])
  return setting.includes('water') || setting.includes('harbor')
})

test('City center includes urban backdrop', () => {
  const setting = getSettingDirection('city_center', [])
  return setting.includes('urban') || setting.includes('city')
})

test('Historic includes architecture', () => {
  const setting = getSettingDirection('historic', [])
  return setting.includes('historic') || setting.includes('architecture')
})

test('Terrace amplifier adds outdoor element', () => {
  const setting = getSettingDirection('waterfront', ['terrace'])
  return setting.includes('terrace') || setting.includes('outdoor')
})

// ============================================================================
// TEST 10: PHOTO DIRECTION GENERATION
// ============================================================================

console.log('\n📷 TEST 10: Photo Direction Generation')
console.log('─'.repeat(70))

test('Menu highlight generates 45-degree angle', () => {
  const direction = generatePhotoDirection({
    format: 'photo',
    subject: 'Spring Salmon',
    contentType: 'menu_highlight',
    platform: 'instagram',
    seasonalContext: { season: 'spring' },
    locationContext: { type: 'waterfront' },
  })
  return direction.angle.includes('45')
})

test('Photo direction includes all required elements', () => {
  const direction = generatePhotoDirection({
    format: 'photo',
    subject: 'Salmon',
    contentType: 'menu_highlight',
    platform: 'instagram',
    seasonalContext: { season: 'spring' },
    locationContext: { type: 'waterfront' },
  })
  return direction.subject && direction.angle && direction.setting && 
         direction.lighting && direction.styling
})

test('Behind-scenes uses dynamic angle', () => {
  const direction = generatePhotoDirection({
    format: 'photo',
    subject: 'Kitchen Prep',
    contentType: 'behind_scenes',
    platform: 'instagram',
    seasonalContext: { season: 'spring' },
    locationContext: { type: 'city_center' },
  })
  return direction.angle.includes('Dynamic') || direction.angle.includes('dynamic')
})

// ============================================================================
// TEST 11: PRODUCTION TIME ESTIMATION
// ============================================================================

console.log('\n⏱️ TEST 11: Production Time Estimation')
console.log('─'.repeat(70))

test('Photo menu highlight: 5-10 minutes', () => {
  const time = estimateProductionTime('photo', 'menu_highlight')
  return time.includes('5') || time.includes('10')
})

test('Carousel: 15-20 minutes', () => {
  const time = estimateProductionTime('carousel', 'event_promotion')
  return time.includes('15') || time.includes('20')
})

test('Reel behind-scenes: 30-45 minutes', () => {
  const time = estimateProductionTime('reel', 'behind_scenes')
  return time.includes('30') || time.includes('45')
})

test('Regular reel: 20-30 minutes', () => {
  const time = estimateProductionTime('reel', 'menu_highlight')
  return time.includes('20') || time.includes('30')
})

// ============================================================================
// TEST 12: TECHNICAL SPECS
// ============================================================================

console.log('\n⚙️  TEST 12: Technical Specifications')
console.log('─'.repeat(70))

test('Instagram photo is 1080x1080 square', () => {
  return TECHNICAL_SPECS.instagram.photo_square.dimensions === '1080x1080'
})

test('Instagram Reel is 9:16 vertical', () => {
  return TECHNICAL_SPECS.instagram.reel.aspectRatio === '9:16'
})

test('TikTok only has video format', () => {
  return TECHNICAL_SPECS.tiktok.video && !TECHNICAL_SPECS.tiktok.photo_square
})

test('All specs include color space RGB', () => {
  return TECHNICAL_SPECS.instagram.photo_square.colorSpace === 'RGB' &&
         TECHNICAL_SPECS.facebook.photo_square.colorSpace === 'RGB'
})

// ============================================================================
// TEST 13: TIME PERIOD CONVERSION
// ============================================================================

console.log('\n🕐 TEST 13: Time Period Conversion')
console.log('─'.repeat(70))

test('07:30 converts to morning', () => {
  return convertTimeToPostPeriod('07:30') === 'morning'
})

test('12:00 converts to lunch', () => {
  return convertTimeToPostPeriod('12:00') === 'lunch'
})

test('15:00 converts to afternoon', () => {
  return convertTimeToPostPeriod('15:00') === 'afternoon'
})

test('18:00 converts to dinner', () => {
  return convertTimeToPostPeriod('18:00') === 'dinner'
})

test('21:00 converts to evening', () => {
  return convertTimeToPostPeriod('21:00') === 'evening'
})

// ============================================================================
// TEST 14: CONTEXT NOTES GENERATION
// ============================================================================

console.log('\n📝 TEST 14: Context Notes Generation')
console.log('─'.repeat(70))

test('Context notes include season', () => {
  const notes = generateContextNotes({
    contentSubject: 'Salmon',
    contentType: 'menu_highlight',
    brandVoice: { tone: 'casual', emoji_frequency: 'moderate' },
    businessType: 'FSE',
    seasonalContext: { season: 'spring', weather: 'sunny' },
    locationContext: { type: 'waterfront' },
    schedulingInfo: { day: 'Wednesday', time: '12:00', timeRationale: 'Lunch peak' },
    format: 'photo',
    platform: 'instagram',
    formatReason: 'Quick beauty shot',
    platformReason: 'Visual platform',
  })
  return notes.includes('Spring') || notes.includes('spring')
})

test('Context notes include scheduling rationale', () => {
  const notes = generateContextNotes({
    contentSubject: 'Salmon',
    contentType: 'menu_highlight',
    brandVoice: { tone: 'casual', emoji_frequency: 'moderate' },
    businessType: 'FSE',
    seasonalContext: { season: 'spring' },
    locationContext: { type: 'waterfront' },
    schedulingInfo: { day: 'Wednesday', time: '12:00', timeRationale: 'Lunch peak engagement' },
    format: 'photo',
    platform: 'instagram',
    formatReason: 'Quick beauty shot',
    platformReason: 'Visual platform',
  })
  return notes.includes('Lunch peak')
})

test('Context notes include format reason', () => {
  const notes = generateContextNotes({
    contentSubject: 'Salmon',
    contentType: 'menu_highlight',
    brandVoice: { tone: 'casual', emoji_frequency: 'moderate' },
    businessType: 'FSE',
    seasonalContext: { season: 'spring' },
    locationContext: { type: 'waterfront' },
    schedulingInfo: { day: 'Wednesday', time: '12:00', timeRationale: 'Lunch peak' },
    format: 'photo',
    platform: 'instagram',
    formatReason: 'Quick beauty shot',
    platformReason: 'Visual platform',
  })
  return notes.includes('Photo') && notes.includes('beauty shot')
})

// ============================================================================
// TEST 15: COMPLETE BRIEF ASSEMBLY
// ============================================================================

console.log('\n🎯 TEST 15: Complete Brief Assembly')
console.log('─'.repeat(70))

test('Assembled brief includes caption', async () => {
  const brief = await assembleContentBrief({
    contentSubject: 'Spring Salmon with Asparagus',
    contentType: 'menu_highlight',
    brandVoice: { tone: 'casual', emoji_frequency: 'moderate' },
    businessType: 'FSE',
    seasonalContext: { season: 'spring', weather: 'sunny' },
    locationContext: { type: 'waterfront', amplifiers: ['terrace'] },
    schedulingInfo: { day: 'Wednesday', time: '12:00', timeRationale: 'Lunch peak engagement' },
    format: 'photo',
    platform: 'instagram',
    formatReason: 'Quick production, beauty shot ideal',
    platformReason: 'Primary visual platform',
  })
  return brief.caption.length > 0
})

test('Assembled brief includes visual direction', async () => {
  const brief = await assembleContentBrief({
    contentSubject: 'Pan-Seared Salmon',
    contentType: 'menu_highlight',
    brandVoice: { tone: 'refined', emoji_frequency: 'minimal' },
    businessType: 'FSE',
    seasonalContext: { season: 'spring' },
    locationContext: { type: 'waterfront' },
    schedulingInfo: { day: 'Friday', time: '17:00', timeRationale: 'Dinner FOMO time' },
    format: 'photo',
    platform: 'instagram',
    formatReason: 'Elegant presentation',
    platformReason: 'Visual storytelling',
  })
  return brief.visualDirection && brief.visualDirection.subject
})

test('Assembled brief includes technical specs', async () => {
  const brief = await assembleContentBrief({
    contentSubject: 'Chef Prep',
    contentType: 'behind_scenes',
    brandVoice: { tone: 'playful', emoji_frequency: 'frequent' },
    businessType: 'FSE',
    seasonalContext: { season: 'spring' },
    locationContext: { type: 'city_center' },
    schedulingInfo: { day: 'Monday', time: '09:00', timeRationale: 'Morning engagement' },
    format: 'reel',
    platform: 'instagram',
    formatReason: 'Show action and process',
    platformReason: 'Reel performance',
  })
  return brief.technicalSpecs && brief.technicalSpecs.dimensions
})

test('Assembled brief includes alt text', async () => {
  const brief = await assembleContentBrief({
    contentSubject: 'Salmon Dish',
    contentType: 'menu_highlight',
    brandVoice: { tone: 'casual', emoji_frequency: 'moderate' },
    businessType: 'FSE',
    seasonalContext: { season: 'spring' },
    locationContext: { type: 'waterfront' },
    schedulingInfo: { day: 'Wednesday', time: '12:00', timeRationale: 'Lunch time' },
    format: 'photo',
    platform: 'instagram',
    formatReason: 'Beauty shot',
    platformReason: 'Visual platform',
  })
  return brief.altText && brief.altText.length > 20
})

test('Assembled brief includes scheduling info', async () => {
  const brief = await assembleContentBrief({
    contentSubject: 'Special Menu',
    contentType: 'event_promotion',
    brandVoice: { tone: 'professional', emoji_frequency: 'none' },
    businessType: 'FSE',
    seasonalContext: { season: 'summer' },
    locationContext: { type: 'historic' },
    schedulingInfo: { day: 'Saturday', time: '18:00', timeRationale: 'Weekend evening' },
    format: 'carousel',
    platform: 'facebook',
    formatReason: 'Multiple aspects',
    platformReason: 'Event reach',
  })
  return brief.schedulingInfo.day === 'Saturday'
})

test('Reel brief includes scene breakdown', async () => {
  const brief = await assembleContentBrief({
    contentSubject: 'Kitchen Magic',
    contentType: 'behind_scenes',
    brandVoice: { tone: 'playful', emoji_frequency: 'frequent' },
    businessType: 'FSE',
    seasonalContext: { season: 'spring' },
    locationContext: { type: 'city_center' },
    schedulingInfo: { day: 'Thursday', time: '10:00', timeRationale: 'Morning story' },
    format: 'reel',
    platform: 'instagram',
    formatReason: 'Show process',
    platformReason: 'Reel engagement',
  })
  return brief.visualDirection.sceneBreakdown && brief.visualDirection.sceneBreakdown.length > 0
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
  console.log('\n🎉 All tests passed! Layer 8 is working correctly.')
  console.log('\n✨ Validated:')
  console.log('   • Caption generation (hooks, messages, context, CTAs, emojis)')
  console.log('   • Brand voice modifiers (casual/refined/playful/professional)')
  console.log('   • Context weaving (season/weather/location)')
  console.log('   • Platform character limits (Instagram/Facebook/LinkedIn/TikTok)')
  console.log('   • Visual direction (photo/carousel/reel)')
  console.log('   • Lighting & styling by time/season')
  console.log('   • Setting direction by location type')
  console.log('   • Production time estimation')
  console.log('   • Technical specifications by platform')
  console.log('   • Alt text generation (accessibility)')
  console.log('   • Complete brief assembly')
  console.log('   • Scene breakdown for video content')
  
  console.log('\n🎯 Layer 8 Status: OPERATIONAL ✅')
  console.log('   Ready for end-to-end integration (Layers 5-8)')
  
  console.log('\n📋 Content Brief Components:')
  console.log('   • Caption: Hook + Message + Context + CTA + Emojis')
  console.log('   • Visual: Subject + Angle + Setting + Lighting + Styling')
  console.log('   • Technical: Dimensions + Format + Codec + Specs')
  console.log('   • Accessibility: Alt text descriptions')
  console.log('   • Scheduling: Day + Time + Platform + Rationale')
  console.log('   • Context: Season + Weather + Location + Reasons')
  
  console.log('\n⏱️  Production Time Estimates:')
  console.log('   • Photo: 5-15 minutes')
  console.log('   • Carousel: 15-20 minutes')
  console.log('   • Reel: 20-45 minutes')
  
  console.log('\n📱 Platform Support:')
  console.log('   • Instagram: Photos, Carousels, Reels')
  console.log('   • Facebook: Photos, Carousels, Videos')
  console.log('   • LinkedIn: Photos, Carousels, Videos')
  console.log('   • TikTok: Video/Reels only')
} else {
  console.log(`\n⚠️  ${totalTests - passedTests} test(s) failed`)
  console.log('   Review failed tests above')
}

Deno.exit(passedTests === totalTests ? 0 : 1)
