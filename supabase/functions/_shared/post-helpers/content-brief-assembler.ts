/**
 * LAYER 8: CONTENT BRIEF ASSEMBLER
 * Assembles complete content creation briefs combining caption + visual direction
 */

import { generateCaption } from './caption-generator.ts'
import { generateVisualDirection } from './visual-direction-generator.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// ============================================================================
// TYPES
// ============================================================================

export interface ContentCreationBrief {
  // Caption
  caption: string
  firstLine: string // First 125 chars (truncation preview)
  characterCount: number
  
  // Visual Direction
  visualDirection: {
    format: 'photo' | 'carousel' | 'reel' | 'video'
    subject: string
    directions: any // PhotoDirection | CarouselDirection | ReelDirection
    sceneBreakdown?: {
      scene: number
      duration: string
      action: string
    }[]
  }
  
  // Technical Specs
  technicalSpecs: {
    dimensions: string
    aspectRatio: string
    duration?: string
    fileFormat: string
    colorSpace: string
    videoCodec?: string
    frameRate?: string
  }
  
  // Accessibility
  altText: string
  
  // Scheduling Context
  schedulingInfo: {
    day: string
    time: string
    platform: string
    timeRationale: string
  }
  
  // Context Notes
  contextNotes: string
  
  // Metadata
  contentType: string
  businessType: string
  creationEstimate: string
}

interface BriefInput {
  // From Layer 5
  contentSubject: string
  contentType: 'menu_highlight' | 'location_story' | 'behind_scenes' | 'engagement' | 'event_promotion' | 'atmosphere'
  
  // From Layer 1 (Brand Profile)
  brandVoice: {
    tone: 'casual' | 'refined' | 'playful' | 'professional'
    emoji_frequency: 'none' | 'minimal' | 'moderate' | 'frequent'
  }
  businessType: 'FSE' | 'SBO' | 'MFV' | 'MFD' | 'QSR'
  
  // From Layer 3 (Temporal Intelligence)
  seasonalContext: {
    season: 'spring' | 'summer' | 'fall' | 'winter'
    weather?: string
    temperature?: string
  }
  locationContext: {
    type: 'waterfront' | 'city_center' | 'historic' | 'residential' | 'suburban'
    amplifiers?: string[]
    secondary_types?: string[] // Additional scored location types (≥60%) beyond primary
  }
  
  // From Layer 6 (Post Slot Optimization)
  schedulingInfo: {
    day: string
    time: string
    timeRationale: string
  }
  
  // From Layer 7 (Media Format Selection)
  format: 'photo' | 'carousel' | 'reel' | 'video'
  platform: 'instagram' | 'facebook' | 'linkedin' | 'tiktok'
  formatReason: string
  platformReason: string
}

// ============================================================================
// TIME OF DAY CONVERTER
// ============================================================================

function convertTimeToPostPeriod(time: string): string {
  const hour = parseInt(time.split(':')[0])
  
  if (hour >= 6 && hour < 10) return 'morning'
  if (hour >= 10 && hour < 14) return 'lunch'
  if (hour >= 14 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 20) return 'dinner'
  if (hour >= 20 || hour < 6) return 'evening'
  
  return 'afternoon'
}

// ============================================================================
// CONTEXT NOTES GENERATOR
// ============================================================================

function generateContextNotes(input: BriefInput): string {
  const { seasonalContext, locationContext, contentType, schedulingInfo, formatReason, platformReason } = input
  
  const notes: string[] = []
  
  // Season + weather context
  if (seasonalContext.season && seasonalContext.weather) {
    notes.push(`${seasonalContext.season.charAt(0).toUpperCase() + seasonalContext.season.slice(1)} season with ${seasonalContext.weather} weather creates ideal context for this content.`)
  } else if (seasonalContext.season) {
    notes.push(`${seasonalContext.season.charAt(0).toUpperCase() + seasonalContext.season.slice(1)} seasonal relevance.`)
  }
  
  // Location amplifiers
  if (locationContext.amplifiers && locationContext.amplifiers.length > 0) {
    notes.push(`Location features (${locationContext.amplifiers.join(', ')}) enhance visual storytelling.`)
  }
  
  // Secondary location types — inform creator of the full audience profile
  if (locationContext.secondary_types && locationContext.secondary_types.length > 0) {
    notes.push(`Also attracts: ${locationContext.secondary_types.join(', ')} audiences — keep styling and tone accessible across segments.`)
  }
  
  // Scheduling rationale
  notes.push(`Scheduled for ${schedulingInfo.day} at ${schedulingInfo.time}: ${schedulingInfo.timeRationale}`)
  
  // Format rationale
  notes.push(`${input.format.charAt(0).toUpperCase() + input.format.slice(1)} format: ${formatReason}`)
  
  // Platform rationale
  notes.push(`${input.platform.charAt(0).toUpperCase() + input.platform.slice(1)} platform: ${platformReason}`)
  
  return notes.join(' ')
}

// ============================================================================
// MAIN CONTENT BRIEF ASSEMBLER
// ============================================================================

export async function assembleContentBrief(
  input: BriefInput
): Promise<ContentCreationBrief> {
  // 1. Generate caption
  const postTime = convertTimeToPostPeriod(input.schedulingInfo.time)
  
  const captionResult = await generateCaption({
    brandVoice: input.brandVoice,
    seasonalContext: input.seasonalContext,
    locationContext: input.locationContext,
    contentPurpose: {
      type: input.contentType,
      subject: input.contentSubject,
      postTime,
    },
    platform: input.platform,
  })
  
  // 2. Generate visual direction
  const visualResult = await generateVisualDirection({
    format: input.format,
    subject: input.contentSubject,
    contentType: input.contentType,
    platform: input.platform,
    seasonalContext: input.seasonalContext,
    locationContext: input.locationContext,
    postTime,
  })
  
  // 3. Convert reel scenes to scene breakdown if applicable
  let sceneBreakdown: { scene: number; duration: string; action: string }[] | undefined
  if (input.format === 'reel' || input.format === 'video') {
    const reelDirections = visualResult.directions as any
    if (reelDirections.scenes) {
      sceneBreakdown = reelDirections.scenes.map((s: any) => ({
        scene: s.sceneNumber,
        duration: `${s.startTime}s - ${s.endTime}s`,
        action: s.action,
      }))
    }
  }
  
  // 4. Generate context notes
  const contextNotes = generateContextNotes(input)
  
  // 5. Assemble complete brief
  return {
    caption: captionResult.caption,
    firstLine: captionResult.firstLine,
    characterCount: captionResult.characterCount,
    
    visualDirection: {
      format: input.format,
      subject: input.contentSubject,
      directions: visualResult.directions,
      sceneBreakdown,
    },
    
    technicalSpecs: visualResult.technicalSpecs,
    
    altText: visualResult.altText,
    
    schedulingInfo: {
      day: input.schedulingInfo.day,
      time: input.schedulingInfo.time,
      platform: input.platform,
      timeRationale: input.schedulingInfo.timeRationale,
    },
    
    contextNotes,
    
    contentType: input.contentType,
    businessType: input.businessType,
    creationEstimate: visualResult.productionTime,
  }
}

// ============================================================================
// BRIEF FORMATTER (Human-Readable Output)
// ============================================================================

export function formatBriefForDisplay(brief: ContentCreationBrief): string {
  let output = '═'.repeat(70) + '\n'
  output += '📋 CONTENT CREATION BRIEF\n'
  output += '═'.repeat(70) + '\n\n'
  
  // Header
  output += `Content Type: ${brief.contentType}\n`
  output += `Business Type: ${brief.businessType}\n`
  output += `Format: ${brief.visualDirection.format.toUpperCase()}\n`
  output += `Platform: ${brief.schedulingInfo.platform.toUpperCase()}\n`
  output += `Estimated Production Time: ${brief.creationEstimate}\n\n`
  
  // Scheduling
  output += '─'.repeat(70) + '\n'
  output += '📅 SCHEDULING\n'
  output += '─'.repeat(70) + '\n'
  output += `Day: ${brief.schedulingInfo.day}\n`
  output += `Time: ${brief.schedulingInfo.time}\n`
  output += `Rationale: ${brief.schedulingInfo.timeRationale}\n\n`
  
  // Caption
  output += '─'.repeat(70) + '\n'
  output += '✍️  CAPTION\n'
  output += '─'.repeat(70) + '\n'
  output += `${brief.caption}\n\n`
  output += `Character Count: ${brief.characterCount}\n`
  output += `First Line (truncation preview): "${brief.firstLine}"\n\n`
  
  // Visual Direction
  output += '─'.repeat(70) + '\n'
  output += '📸 VISUAL DIRECTION\n'
  output += '─'.repeat(70) + '\n'
  output += `Subject: ${brief.visualDirection.subject}\n\n`
  
  if (brief.visualDirection.format === 'photo') {
    const photoDir = brief.visualDirection.directions as any
    output += `Angle: ${photoDir.angle}\n`
    output += `Setting: ${photoDir.setting}\n`
    output += `Lighting: ${photoDir.lighting}\n`
    output += `Styling: ${photoDir.styling}\n`
    if (photoDir.optionalElements && photoDir.optionalElements.length > 0) {
      output += `Optional Elements:\n`
      photoDir.optionalElements.forEach((el: string) => {
        output += `  • ${el}\n`
      })
    }
  } else if (brief.visualDirection.format === 'carousel') {
    const carouselDir = brief.visualDirection.directions as any
    output += `Slides: ${carouselDir.slideCount} total\n\n`
    carouselDir.slides.forEach((slide: any) => {
      output += `Slide ${slide.slideNumber}: ${slide.description}\n`
      output += `  Focus: ${slide.focus}\n`
    })
  } else if (brief.visualDirection.format === 'reel' || brief.visualDirection.format === 'video') {
    const reelDir = brief.visualDirection.directions as any
    output += `Duration: ${reelDir.duration} seconds\n\n`
    output += `Scenes:\n`
    reelDir.scenes.forEach((scene: any) => {
      output += `  Scene ${scene.sceneNumber} (${scene.startTime}s-${scene.endTime}s):\n`
      output += `    ${scene.action}\n`
    })
    output += `\nTransitions: ${reelDir.transitions}\n`
    output += `Audio: ${reelDir.audio}\n`
    if (reelDir.textOverlays && reelDir.textOverlays.length > 0) {
      output += `Text Overlays:\n`
      reelDir.textOverlays.forEach((overlay: any) => {
        output += `  • "${overlay.text}" (${overlay.timing})\n`
      })
    }
  }
  
  output += '\n'
  
  // Technical Specs
  output += '─'.repeat(70) + '\n'
  output += '⚙️  TECHNICAL SPECIFICATIONS\n'
  output += '─'.repeat(70) + '\n'
  output += `Dimensions: ${brief.technicalSpecs.dimensions}\n`
  output += `Aspect Ratio: ${brief.technicalSpecs.aspectRatio}\n`
  output += `File Format: ${brief.technicalSpecs.fileFormat}\n`
  output += `Color Space: ${brief.technicalSpecs.colorSpace}\n`
  if (brief.technicalSpecs.duration) {
    output += `Duration: ${brief.technicalSpecs.duration}\n`
  }
  if (brief.technicalSpecs.videoCodec) {
    output += `Video Codec: ${brief.technicalSpecs.videoCodec}\n`
  }
  if (brief.technicalSpecs.frameRate) {
    output += `Frame Rate: ${brief.technicalSpecs.frameRate}\n`
  }
  
  output += '\n'
  
  // Accessibility
  output += '─'.repeat(70) + '\n'
  output += '♿ ACCESSIBILITY\n'
  output += '─'.repeat(70) + '\n'
  output += `Alt Text: ${brief.altText}\n\n`
  
  // Context
  output += '─'.repeat(70) + '\n'
  output += '🎯 CONTEXT\n'
  output += '─'.repeat(70) + '\n'
  output += `${brief.contextNotes}\n\n`
  
  output += '═'.repeat(70) + '\n'
  
  return output
}

// ============================================================================
// BATCH BRIEF GENERATOR
// ============================================================================

export async function generateWeeklyBriefs(
  inputs: BriefInput[]
): Promise<ContentCreationBrief[]> {
  const briefs: ContentCreationBrief[] = []
  
  for (const input of inputs) {
    const brief = await assembleContentBrief(input)
    briefs.push(brief)
  }
  
  return briefs
}

// Export for testing
export const testHelpers = {
  convertTimeToPostPeriod,
  generateContextNotes,
}
