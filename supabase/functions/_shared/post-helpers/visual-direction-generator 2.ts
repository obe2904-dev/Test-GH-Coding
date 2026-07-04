/**
 * LAYER 8: VISUAL DIRECTION GENERATOR
 * Generates production-ready visual directions with technical specs and accessibility
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// ============================================================================
// TYPES
// ============================================================================

interface VisualDirectionInput {
  format: 'photo' | 'carousel' | 'reel' | 'video'
  subject: string
  contentType: 'menu_highlight' | 'location_story' | 'behind_scenes' | 'engagement' | 'event_promotion' | 'atmosphere'
  platform: 'instagram' | 'facebook' | 'linkedin' | 'tiktok'
  seasonalContext: {
    season: 'spring' | 'summer' | 'fall' | 'winter'
    weather?: string
    temperature?: string
  }
  locationContext: {
    type: 'waterfront' | 'city_center' | 'historic' | 'residential' | 'suburban'
    amplifiers?: string[]
  }
  postTime?: string // "morning", "lunch", "afternoon", "dinner", "evening"
}

interface PhotoDirection {
  subject: string
  angle: string
  setting: string
  lighting: string
  styling: string
  optionalElements: string[]
}

interface CarouselDirection {
  slideCount: number
  slides: {
    slideNumber: number
    description: string
    focus: string
  }[]
}

interface ReelDirection {
  duration: number // seconds
  scenes: {
    sceneNumber: number
    startTime: number
    endTime: number
    action: string
  }[]
  transitions: string
  audio: string
  textOverlays?: {
    text: string
    timing: string
  }[]
}

interface TechnicalSpecs {
  dimensions: string
  aspectRatio: string
  duration?: string
  fileFormat: string
  colorSpace: string
  videoCodec?: string
  frameRate?: string
}

interface VisualDirection {
  format: 'photo' | 'carousel' | 'reel' | 'video'
  directions: PhotoDirection | CarouselDirection | ReelDirection
  technicalSpecs: TechnicalSpecs
  altText: string
  productionTime: string // Estimated time to create
}

// ============================================================================
// TECHNICAL SPECIFICATIONS BY PLATFORM
// ============================================================================

const TECHNICAL_SPECS = {
  instagram: {
    photo_square: {
      dimensions: '1080x1080',
      aspectRatio: '1:1',
      fileFormat: 'JPG',
      colorSpace: 'RGB',
    },
    photo_portrait: {
      dimensions: '1080x1350',
      aspectRatio: '4:5',
      fileFormat: 'JPG',
      colorSpace: 'RGB',
    },
    carousel: {
      dimensions: '1080x1080',
      aspectRatio: '1:1',
      fileFormat: 'JPG',
      colorSpace: 'RGB',
    },
    reel: {
      dimensions: '1080x1920',
      aspectRatio: '9:16',
      duration: '15-90s',
      fileFormat: 'MP4',
      colorSpace: 'RGB',
      videoCodec: 'H.264',
      frameRate: '30fps',
    },
  },
  facebook: {
    photo_square: {
      dimensions: '1080x1080',
      aspectRatio: '1:1',
      fileFormat: 'JPG',
      colorSpace: 'RGB',
    },
    photo_landscape: {
      dimensions: '1200x630',
      aspectRatio: '1.91:1',
      fileFormat: 'JPG',
      colorSpace: 'RGB',
    },
    video: {
      dimensions: '1920x1080',
      aspectRatio: '16:9',
      duration: 'up to 240min',
      fileFormat: 'MP4',
      colorSpace: 'RGB',
      videoCodec: 'H.264',
      frameRate: '30fps',
    },
  },
  linkedin: {
    photo_landscape: {
      dimensions: '1200x627',
      aspectRatio: '1.91:1',
      fileFormat: 'JPG',
      colorSpace: 'RGB',
    },
    photo_square: {
      dimensions: '1080x1080',
      aspectRatio: '1:1',
      fileFormat: 'JPG',
      colorSpace: 'RGB',
    },
    video: {
      dimensions: '1920x1080',
      aspectRatio: '16:9',
      duration: '3s-10min',
      fileFormat: 'MP4',
      colorSpace: 'RGB',
      videoCodec: 'H.264',
      frameRate: '30fps',
    },
  },
  tiktok: {
    video: {
      dimensions: '1080x1920',
      aspectRatio: '9:16',
      duration: '15-60s',
      fileFormat: 'MP4',
      colorSpace: 'RGB',
      videoCodec: 'H.264',
      frameRate: '30fps',
    },
  },
} as const

// ============================================================================
// LIGHTING DIRECTION BY TIME & SEASON
// ============================================================================

function getLightingDirection(
  postTime: string | undefined,
  season: string,
  weather: string | undefined
): string {
  // Weather-based adjustments take priority (override time)
  if (weather === 'rainy' || weather === 'cloudy') {
    return 'Blødt diffust lys, minimale skygger, hyggeligt atmosfære'
  }
  
  // Time-based lighting
  if (postTime === 'morning') {
    return 'Blødt morgenlys, blide skygger, varme toner'
  }
  if (postTime === 'lunch') {
    return 'Frisk naturligt dagslys, klare skygger'
  }
  if (postTime === 'afternoon') {
    return 'Eftermiddagssol, varme gyldne toner, blød retningsbestemt lys (15-16)'
  }
  if (postTime === 'dinner' || postTime === 'evening') {
    return 'Varm kunstig belysning, stearinlysakcenter, intim stemning'
  }
  
  // Season-based defaults
  if (season === 'winter') {
    return 'Varm interiorlys, stearinlys, gyldne hyggetoner'
  }
  if (season === 'summer') {
    return 'Stærkt naturligt dagslys, levende farver, høj kontrast'
  }
  if (season === 'spring') {
    return 'Frisk naturligt lys, lyst og luftigt, bløde skygger'
  }
  if (season === 'fall') {
    return 'Varmt gyllent efterårslys, rige toner, hyggelig stemning'
  }
  
  return 'Naturligt dagslys, afbalanceret eksponering'
}

// ============================================================================
// STYLING DIRECTION BY SEASON
// ============================================================================

function getStylingDirection(season: string): string {
  const styling = {
    spring: 'Friske, lyse forårsfaver – grønne, pastel, lyse toner, blomsterakcenterer',
    summer: 'Levende sommerpalette – friske farver, friske urter, citrusakcenterer',
    fall: 'Rige efterårstone – dybe orange, røde, brune, rustikke elementer',
    winter: 'Varm vinterstyling – dybe farver, hyggelige elementer, stearinlys, teksturerede stoffer',
  }
  
  return styling[season as keyof typeof styling] || 'Afbalanceret, appetitvækkende farvepalette'
}

// ============================================================================
// SETTING DIRECTION BY LOCATION
// ============================================================================

function getSettingDirection(
  locationType: string,
  amplifiers: string[] = []
): string {
  const baseSettings = {
    waterfront: 'havneudsigt med blød baggrundssløring',
    city_center: 'bymæssig baggrund med byenergien synlig',
    historic: 'historisk arkitektur i baggrunden',
    residential: 'varmt nabolagsmiljø, hyggelig atmosfære',
    suburban: 'rolig omgivelse med naturlige omgivelser',
  }
  
  let setting = baseSettings[locationType as keyof typeof baseSettings] || 'restaurantinteriør'
  
  if (amplifiers.includes('terrace') || amplifiers.includes('outdoor')) {
    setting = `udendørs terrasse, ${setting}`
  }
  if (amplifiers.includes('cozy') || amplifiers.includes('intimate')) {
    setting = `hyggekrog, ${setting}`
  }
  
  return setting
}

// ============================================================================
// PHOTO DIRECTION GENERATOR
// ============================================================================

function generatePhotoDirection(input: VisualDirectionInput): PhotoDirection {
  const { subject, contentType, seasonalContext, locationContext, postTime } = input
  
  // Angle based on content type
  const angles = {
    menu_highlight: '45-graders vinkel, viser ret fra siden',
    location_story: 'Bredvinkel der fanger rum og atmosfære',
    behind_scenes: 'Dynamisk vinkel der viser handling og bevægelse',
    engagement: 'Nærbillede, intimt perspektiv',
    event_promotion: 'Afbalanceret komposition der viser nøgleelementer',
    atmosphere: 'Miljøbillede, dybde og lag',
  }
  
  const angle = angles[contentType] || '45-graders vinkel, afbalanceret komposition'
  
  // Setting
  const setting = getSettingDirection(locationContext.type, locationContext.amplifiers)
  
  // Lighting
  const lighting = getLightingDirection(postTime, seasonalContext.season, seasonalContext.weather)
  
  // Styling
  const styling = getStylingDirection(seasonalContext.season)
  
  // Optional elements based on content type
  const optionalElements: string[] = []
  if (contentType === 'menu_highlight') {
    optionalElements.push('Passende drikkevareparing i baggrunden')
    optionalElements.push('Friske urter eller sæsongarniture')
    optionalElements.push('Tekstureret stofserviet eller -dækkeserviet')
  } else if (contentType === 'atmosphere') {
    optionalElements.push('Subtilt menneskeelement (hånd der rækker efter glas)')
    optionalElements.push('Stearinlys eller stemningsskabende rekvisitter')
  } else if (contentType === 'location_story') {
    optionalElements.push('Miljøkontekst (vinduer, arkitektur)')
    optionalElements.push('Naturlige rammeelementer')
  }
  
  return {
    subject,
    angle,
    setting: `På restaurantbord, ${setting}`,
    lighting,
    styling,
    optionalElements,
  }
}

// ============================================================================
// CAROUSEL DIRECTION GENERATOR
// ============================================================================

function generateCarouselDirection(input: VisualDirectionInput): CarouselDirection {
  const { subject, contentType } = input
  
  const carouselPatterns = {
    menu_highlight: [
      { slideNumber: 1, description: 'Hoveddish nærbillede', focus: 'Skønhedsbillede af ret, fuld komposition' },
      { slideNumber: 2, description: 'Nøgleingrediensspot', focus: 'Fremhæv ingrediensernes kvalitet' },
      { slideNumber: 3, description: 'Anretningsdetalje', focus: 'Håndværk og opmærksomhed på detaljer' },
      { slideNumber: 4, description: 'Kontekstbillede', focus: 'Ret i spisemiljø' },
    ],
    event_promotion: [
      { slideNumber: 1, description: 'Eventannoncering', focus: 'Hovednvisual med dato/tid' },
      { slideNumber: 2, description: 'Fremhævede tilbud', focus: 'Hvad man kan forvente' },
      { slideNumber: 3, description: 'Atmosfærepreview', focus: 'Venues opsætning og stemning' },
      { slideNumber: 4, description: 'Reservations-opfordring', focus: 'Hvordan man reserverer' },
    ],
    location_story: [
      { slideNumber: 1, description: 'Eksteriør eller signaturbillede', focus: 'Etabler stedsidentitet' },
      { slideNumber: 2, description: 'Interiorstemning', focus: 'Spiserum og design' },
      { slideNumber: 3, description: 'Detaljeshot', focus: 'Unikt arkitektonisk eller design-element' },
      { slideNumber: 4, description: 'Gæsteoplevelse', focus: 'Gæster der nyder rummet' },
    ],
    behind_scenes: [
      { slideNumber: 1, description: 'Startpunkt for proces', focus: 'Råvarer eller begyndelse af forberedelse' },
      { slideNumber: 2, description: 'Handling midt i processen', focus: 'Kok i arbejde, teknik vist' },
      { slideNumber: 3, description: 'Tæt på færdig', focus: 'Sidste hånd på værket' },
      { slideNumber: 4, description: 'Færdigt resultat', focus: 'Endelig ret eller resultat' },
    ],
  }
  
  const pattern = carouselPatterns[contentType as keyof typeof carouselPatterns] || carouselPatterns.menu_highlight
  
  return {
    slideCount: pattern.length,
    slides: pattern,
  }
}

// ============================================================================
// REEL DIRECTION GENERATOR
// ============================================================================

function generateReelDirection(input: VisualDirectionInput): ReelDirection {
  const { subject, contentType } = input
  
  // Reel patterns by content type (15-30 seconds optimal)
  const reelPatterns = {
    menu_highlight: {
      duration: 15,
      scenes: [
        { sceneNumber: 1, startTime: 0, endTime: 3, action: 'Ingredienspræsentation – friske ingredienser på skærebræt' },
        { sceneNumber: 2, startTime: 3, endTime: 8, action: `Kok tilbereder ${subject.toLowerCase()} – nøgletilberedelsesteknik` },
        { sceneNumber: 3, startTime: 8, endTime: 12, action: 'Anretning i slowmotion – opmærksomhed på detaljer' },
        { sceneNumber: 4, startTime: 12, endTime: 15, action: 'Færdig ret serveres ved bord med location i baggrunden' },
      ],
      transitions: 'Hurtige klip med match-on-action',
      audio: 'Naturlige madlyde (brusen, kniv på skærebræt), stærk baggrundsmusik (80-100 BPM)',
    },
    behind_scenes: {
      duration: 20,
      scenes: [
        { sceneNumber: 1, startTime: 0, endTime: 4, action: 'Tidlig morgen køkkenforberedelse – etableringsshots' },
        { sceneNumber: 2, startTime: 4, endTime: 10, action: 'Kok demonstrerer teknik – nærbillede af hænder og proces' },
        { sceneNumber: 3, startTime: 10, endTime: 16, action: 'Teamsamarbejde – flere vinkler på køkkenaktivitet' },
        { sceneNumber: 4, startTime: 16, endTime: 20, action: 'Endeligt resultat med kokkes reaktion – stolthed over arbejdet' },
      ],
      transitions: 'Dynamiske klip, nogle time-lapse-afsnit',
      audio: 'Køkkenstemning, let livlig musik, kort kokvoi forklarer processen',
    },
    atmosphere: {
      duration: 15,
      scenes: [
        { sceneNumber: 1, startTime: 0, endTime: 4, action: 'Udvendigt etableringsshot – lokationsafsløring' },
        { sceneNumber: 2, startTime: 4, endTime: 9, action: 'Gå gennem rummet – steadicam-bevægelse der viser stemning' },
        { sceneNumber: 3, startTime: 9, endTime: 13, action: 'Detailshots – belysning, designelementer, atmosfære' },
        { sceneNumber: 4, startTime: 13, endTime: 15, action: 'Gæster der nyder rummet – naturlig interaktion' },
      ],
      transitions: 'Blidere overgange, cinematografisk bevægelse',
      audio: 'Restaurantstemningslyde, blød baggrundsmusik (60-80 BPM, atmosfærisk)',
    },
    location_story: {
      duration: 18,
      scenes: [
        { sceneNumber: 1, startTime: 0, endTime: 5, action: 'Drone eller bredt etableringsshot af location' },
        { sceneNumber: 2, startTime: 5, endTime: 11, action: 'Rejse gennem rummet – bevægelse fra indgangen til nøgleområder' },
        { sceneNumber: 3, startTime: 11, endTime: 15, action: 'Signaturbillede eller træk – hvad gør lokationen særlig' },
        { sceneNumber: 4, startTime: 15, endTime: 18, action: 'Gæsteperspektiv – sidder ved bord med udsigt' },
      ],
      transitions: 'Fløjende overgange, rejsefølelse',
      audio: 'Naturlige stedslyde, let musik der opbygges, mulig speak',
    },
  }
  
  const pattern = reelPatterns[contentType as keyof typeof reelPatterns] || reelPatterns.menu_highlight
  
  // Add text overlays for menu/promotional content
  let textOverlays: { text: string; timing: string }[] | undefined
  if (contentType === 'menu_highlight' || contentType === 'event_promotion') {
    textOverlays = [
      { text: subject, timing: '0-2s' },
      { text: 'Frisk dagligt', timing: '10-12s' },
    ]
  }
  
  return {
    duration: pattern.duration,
    scenes: pattern.scenes,
    transitions: pattern.transitions,
    audio: pattern.audio,
    textOverlays,
  }
}

// ============================================================================
// ALT TEXT GENERATOR
// ============================================================================

function generateAltText(input: VisualDirectionInput, directions: any): string {
  const { format, subject, contentType, locationContext, seasonalContext } = input
  
  if (format === 'photo') {
    const photoDir = directions as PhotoDirection
    // Phase 3 Bug #1 fix: Use PhotoDirection properties instead of raw context
    return `${subject}, ${photoDir.setting}, ${photoDir.lighting}, ${photoDir.styling}`
  } else if (format === 'carousel') {
    return `${input.subject} karrusel der viser flere perspektiver: forberedelse, anretning og endelig præsentation i restaurantmiljø`
  } else if (format === 'reel' || format === 'video') {
    const reelDir = directions as ReelDirection
    const sceneDescriptions = reelDir.scenes.map(s => s.action).join(', ')
    return `Video showing ${subject}: ${sceneDescriptions}`
  }
  
  return `${subject} i ${locationContext.type} restaurantmiljø`
}

// ============================================================================
// PRODUCTION TIME ESTIMATOR
// ============================================================================

function estimateProductionTime(format: string, contentType: string): string {
  if (format === 'photo') {
    if (contentType === 'menu_highlight' || contentType === 'engagement') {
      return '5-10 minutter'
    }
    return '10-15 minutter'
  } else if (format === 'carousel') {
    return '15-20 minutter'
  } else if (format === 'reel' || format === 'video') {
    if (contentType === 'behind_scenes' || contentType === 'location_story') {
      return '30-45 minutter'
    }
    return '20-30 minutter'
  }
  
  return '15 minutter'
}

// ============================================================================
// MAIN VISUAL DIRECTION GENERATOR
// ============================================================================

export async function generateVisualDirection(
  input: VisualDirectionInput
): Promise<VisualDirection> {
  const { format, platform, contentType } = input
  
  // 1. Generate format-specific directions
  let directions: PhotoDirection | CarouselDirection | ReelDirection
  
  if (format === 'photo') {
    directions = generatePhotoDirection(input)
  } else if (format === 'carousel') {
    directions = generateCarouselDirection(input)
  } else if (format === 'reel' || format === 'video') {
    directions = generateReelDirection(input)
  } else {
    throw new Error(`Unsupported format: ${format}`)
  }
  
  // 2. Get technical specs for platform
  let technicalSpecs: TechnicalSpecs
  
  if (platform === 'instagram') {
    if (format === 'photo') {
      technicalSpecs = TECHNICAL_SPECS.instagram.photo_square
    } else if (format === 'carousel') {
      technicalSpecs = TECHNICAL_SPECS.instagram.carousel
    } else {
      technicalSpecs = TECHNICAL_SPECS.instagram.reel
    }
  } else if (platform === 'facebook') {
    if (format === 'photo' || format === 'carousel') {
      technicalSpecs = TECHNICAL_SPECS.facebook.photo_square
    } else {
      technicalSpecs = TECHNICAL_SPECS.facebook.video
    }
  } else if (platform === 'linkedin') {
    if (format === 'photo' || format === 'carousel') {
      technicalSpecs = TECHNICAL_SPECS.linkedin.photo_square
    } else {
      technicalSpecs = TECHNICAL_SPECS.linkedin.video
    }
  } else if (platform === 'tiktok') {
    technicalSpecs = TECHNICAL_SPECS.tiktok.video
  } else {
    throw new Error(`Unsupported platform: ${platform}`)
  }
  
  // 3. Generate alt text
  const altText = generateAltText(input, directions)
  
  // 4. Estimate production time
  const productionTime = estimateProductionTime(format, contentType)
  
  return {
    format,
    directions,
    technicalSpecs,
    altText,
    productionTime,
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function validateVisualDirection(direction: VisualDirection): {
  valid: boolean
  issues: string[]
} {
  const issues: string[] = []
  
  if (!direction.altText || direction.altText.length < 20) {
    issues.push('Alt text too short or missing')
  }
  
  if (direction.format === 'reel' || direction.format === 'video') {
    const reelDir = direction.directions as ReelDirection
    if (reelDir.duration < 10 || reelDir.duration > 90) {
      issues.push('Video duration outside optimal range (10-90s)')
    }
    if (reelDir.scenes.length < 2) {
      issues.push('Reel should have at least 2 scenes')
    }
  }
  
  if (direction.format === 'carousel') {
    const carouselDir = direction.directions as CarouselDirection
    if (carouselDir.slideCount < 2 || carouselDir.slideCount > 10) {
      issues.push('Carousel should have 2-10 slides')
    }
  }
  
  return {
    valid: issues.length === 0,
    issues,
  }
}

// Export for testing
export const testHelpers = {
  getLightingDirection,
  getStylingDirection,
  getSettingDirection,
  generatePhotoDirection,
  generateCarouselDirection,
  generateReelDirection,
  generateAltText,
  estimateProductionTime,
  TECHNICAL_SPECS,
}
