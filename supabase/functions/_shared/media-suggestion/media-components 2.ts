// media-components.ts
// Shared photography building blocks for all content types
// Used by type-specific media builders

/**
 * Build camera position guidance (Sentence 1 template)
 */
export function buildCameraPosition(opts: {
  angle: 'overhead' | '45-degree' | 'eye-level' | 'guest-perspective'
  distanceCm: number
  context?: string
}): string {
  const { angle, distanceCm, context } = opts

  const angleText = {
    'overhead': 'ret over',
    '45-degree': '45° vinkel',
    'eye-level': 'øjenhøjde',
    'guest-perspective': 'gæstens perspektiv'
  }[angle]

  if (context) {
    return `Placer telefonen ${angleText}, ${distanceCm}cm fra ${context}.`
  }

  return `Placer telefonen ${angleText}, ${distanceCm}cm afstand.`
}

/**
 * Build lighting guidance (Sentence 2 template)
 */
export function buildLighting(opts: {
  source: 'window' | 'natural-daylight' | 'afternoon-golden' | 'morning-fresh'
  direction?: 'side' | 'front' | 'back'
  context?: string
}): string {
  const { source, direction, context } = opts

  const sourceText = {
    'window': 'Gå hen til vinduet',
    'natural-daylight': 'Brug naturligt dagslys',
    'afternoon-golden': 'Brug eftermiddagens gyldne lys',
    'morning-fresh': 'Brug morgenlys fra vinduet'
  }[source]

  if (direction) {
    const directionText = {
      'side': 'fra siden',
      'front': 'forfra',
      'back': 'bagfra (konturlys)'
    }[direction]
    
    if (context) {
      return `${sourceText} så lyset falder ${directionText} ${context}.`
    }
    return `${sourceText} så lyset falder ${directionText}.`
  }

  return `${sourceText}.`
}

/**
 * Build universal prohibitions (what never to show)
 */
export function buildUniversalProhibitions(): string {
  return '⛔ ALDRIG: Menu boards, kasseapparater, flash/kunstigt lys, poserede shots.'
}

/**
 * Build time-of-day lighting guidance
 */
export function getTimeBasedLighting(suggestedTime: string): {
  source: 'window' | 'natural-daylight' | 'afternoon-golden' | 'morning-fresh'
  quality: string
} {
  const hour = parseInt(suggestedTime.split(':')[0], 10)

  if (hour < 10) {
    return {
      source: 'morning-fresh',
      quality: 'klart morgenlys, frisk og energisk'
    }
  }

  if (hour >= 10 && hour < 15) {
    return {
      source: 'natural-daylight',
      quality: 'jævnt dagslys, klart og balanceret'
    }
  }

  if (hour >= 15 && hour < 18) {
    return {
      source: 'afternoon-golden',
      quality: 'gyldent eftermiddagslys, varmt og inviterende'
    }
  }

  // Evening
  return {
    source: 'window',
    quality: 'naturligt lys suppleret med stedsbelysning, intimt og stemningsfuldt'
  }
}
