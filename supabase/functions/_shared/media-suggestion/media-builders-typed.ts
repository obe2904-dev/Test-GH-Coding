// media-builders-typed.ts
// Type-specific media instruction builders for F&B content
// Each builder creates 3 imperative sentences optimized for that content type

import { buildCameraPosition, buildLighting, getTimeBasedLighting } from './media-components.ts'

// ══════════════════════════════════════════════════════════════════════════
// MENU MEDIA BUILDER (menu_item, product_menu, craving_visual)
// ══════════════════════════════════════════════════════════════════════════

export function buildMenuMediaInstruction(opts: {
  dishName?: string
  isCravingVisual?: boolean
  language?: string
}): string {
  const { dishName, isCravingVisual, language = 'da' } = opts

  const dishContext = dishName ? `${dishName}` : 'retten'

  // Sentence 1: Camera position - overhead or 45° for food
  const position = buildCameraPosition({
    angle: '45-degree',
    distanceCm: 60,
    context: 'bordkanten'
  })

  // Sentence 2: Natural window light from side
  const lighting = buildLighting({
    source: 'window',
    direction: 'side'
  })

  // Sentence 3: Dish-specific frame content
  const frameContent = isCravingVisual
    ? `Fyld rammen med ${dishContext} — vis rettens farver, tekstur og damp. Lad bordet skabe dybde og ramme omkring.`
    : `Fyld rammen med ${dishContext} — vis specifikke farver, tekstur og detaljer. Lad tallerkenen ligge lidt off-center.`

  const prohibitions = '⛔ ALDRIG: Menu boards, kasseapparater, flere retter i samme billede.'

  return `${position} ${lighting} ${frameContent}\n${prohibitions}`
}

// ══════════════════════════════════════════════════════════════════════════
// BEHIND-SCENES MEDIA BUILDER (behind_scenes)
// ══════════════════════════════════════════════════════════════════════════

export function buildBehindScenesMediaInstruction(opts: {
  concreteAnchor?: string
  language?: string
}): string {
  const { concreteAnchor, language = 'da' } = opts

  // Extract action element from concrete anchor
  // E.g., "Brød bagt fra bunden kl. 07" → focus on hands shaping dough
  // E.g., "Kasper bag baren kender halvdelen" → focus on bartender's hands/face

  // Sentence 1: Eye-level, human perspective
  const position = buildCameraPosition({
    angle: 'eye-level',
    distanceCm: 50,
    context: 'handlingen'
  })

  // Sentence 2: Natural work lighting
  const lighting = buildLighting({
    source: 'window',
    direction: 'side',
    context: 'på arbejdsområdet'
  })

  // Sentence 3: Force focus on HUMAN ACTION, not room/equipment
  const frameContent = concreteAnchor
    ? `Fyld rammen med den konkrete handling fra "${concreteAnchor}" — vis hænder, værktøj eller kropsdele i aktion. Vis håndværket, ikke rummet.`
    : `Fyld rammen med handlingen — vis hænder der former, skærer eller hælder. Vis håndværket, ikke rummet.`

  const prohibitions = `⛔ ALDRIG: Tomme rum, møbler, overflader, udstyr uden mennesker, "før åbning"-shots af tomme borde.
✅ VIS ALTID: Hænder i aktion, værktøj i brug, kropsdele der performer håndværket.`

  return `${position} ${lighting} ${frameContent}\n${prohibitions}`
}

// ══════════════════════════════════════════════════════════════════════════
// ATMOSPHERE MEDIA BUILDER (atmosphere, team_people)
// ══════════════════════════════════════════════════════════════════════════

export function buildAtmosphereMediaInstruction(opts: {
  contentType: 'atmosphere' | 'team_people'
  suggestedTime?: string
  locationContext?: string
  language?: string
}): string {
  const { contentType, suggestedTime = '12:00', locationContext, language = 'da' } = opts

  const isTeamPost = contentType === 'team_people'

  // Get time-based lighting
  const timeLight = getTimeBasedLighting(suggestedTime)

  if (isTeamPost) {
    // Team/people posts: focus on person in action

    const position = buildCameraPosition({
      angle: 'eye-level',
      distanceCm: 80,
      context: 'personen'
    })

    const lighting = buildLighting({
      source: timeLight.source,
      direction: 'side'
    })

    const frameContent = `Fyld rammen med personen i aktion — ikke poserende, men i en naturlig arbejdssituation. Vis mennesket, ikke stedet.`

    const prohibitions = `⛔ ALDRIG: Poserede smil, "se ind i kameraet"-shots, tomme rum.
✅ VIS: Person i gang med konkret opgave, naturligt i arbejdet.`

    return `${position} ${lighting} ${frameContent}\n${prohibitions}`
  }

  // Atmosphere posts: guest perspective of space

  const contextPhrase = locationContext 
    ? `bordet med udsigt til ${locationContext}`
    : 'bordet'

  const position = buildCameraPosition({
    angle: 'guest-perspective',
    distanceCm: 100,
    context: contextPhrase
  })

  const lighting = buildLighting({
    source: timeLight.source,
    context: 'på scenen'
  })

  const frameContent = locationContext
    ? `Fyld rammen med det gæsten ser: ${locationContext} i baggrunden, bordet i forgrunden. Vis invitationen til pladsen og udsigten — ikke retten, ikke interiøret som dokumentation.`
    : `Fyld rammen med perspektivet gæsten oplever — vis stemningen og rummet fra gæstens synsvinkel. Hvis gæster er til stede, vis dem i naturlig interaktion.`

  const prohibitions = `⛔ ALDRIG: Arkitektur-dokumentation, tomme borde "før åbning", nærbilleder af møbler, retter i fokus.
✅ VIS: Gæstens oplevelse af rummet, social energi, invitation til pladsen.`

  return `${position} ${lighting} ${frameContent}\n${prohibitions}`
}

// ══════════════════════════════════════════════════════════════════════════
// OCCASION MEDIA BUILDER (lunch_moment, brunch_moment, afterwork_moment)
// ══════════════════════════════════════════════════════════════════════════

export function buildOccasionMediaInstruction(opts: {
  occasionType: 'lunch_moment' | 'brunch_moment' | 'afterwork_moment'
  language?: string
}): string {
  const { occasionType, language = 'da' } = opts

  // Occasion-specific photography philosophy

  if (occasionType === 'lunch_moment') {
    // Lunch: bright, energized, efficient

    const position = buildCameraPosition({
      angle: '45-degree',
      distanceCm: 60,
      context: 'retten'
    })

    const lighting = buildLighting({
      source: 'natural-daylight',
      direction: 'front',
      context: 'på måltidet'
    })

    const frameContent = `Fyld rammen med frokostretten — klart, skarpt, ingen dybdeskarphed. Vis efficiency og kvalitet, energi i kompositionen.`

    const prohibitions = `⛔ STIL: Ingen "leisurely" stemning, ingen mørke hjørner.
✅ STIL: Klart, frisk, energiseret — frokosten der matcher arbejdsdagen.`

    return `${position} ${lighting} ${frameContent}\n${prohibitions}`
  }

  if (occasionType === 'brunch_moment') {
    // Brunch: warm morning light, leisurely, abundant

    const position = buildCameraPosition({
      angle: 'eye-level',
      distanceCm: 80,
      context: 'bordet'
    })

    const lighting = buildLighting({
      source: 'morning-fresh',
      direction: 'side',
      context: 'over bordet'
    })

    const frameContent = `Fyld rammen med brunch som oplevelse — vis flere elementer (kaffe ved siden af mad), afslappet komposition. Vis overflod og ro.`

    const prohibitions = `⛔ STIL: Ingen hast, ingen tight cropping.
✅ STIL: Varmt morgenlys, afslappet, læg lidt luft omkring elementerne.`

    return `${position} ${lighting} ${frameContent}\n${prohibitions}`
  }

  // afterwork_moment: golden hour, transition, social decompression

  const position = buildCameraPosition({
    angle: 'eye-level',
    distanceCm: 70,
    context: 'bordet/baren'
  })

  const lighting = buildLighting({
    source: 'afternoon-golden',
    direction: 'side'
  })

  const frameContent = `Fyld rammen med overgangsstemningen — vis drik i forgrunden hvis relevant, mad sekundært. Vis skiftet fra arbejde til fritid.`

  const prohibitions = `⛔ STIL: Ingen "middag" formalitet, ingen hektik.
✅ STIL: Gyldent lys, afslappet overgang, bar-perspektiv er gyldigt.`

  return `${position} ${lighting} ${frameContent}\n${prohibitions}`
}

// ══════════════════════════════════════════════════════════════════════════
// DISPATCHER (optional utility)
// ══════════════════════════════════════════════════════════════════════════

export function buildMediaInstruction(opts: {
  contentType: string
  dishName?: string
  concreteAnchor?: string
  suggestedTime?: string
  locationContext?: string
  language?: string
}): string {
  const { contentType, dishName, concreteAnchor, suggestedTime, locationContext, language = 'da' } = opts

  // Route to appropriate builder
  if (['menu_item', 'product_menu', 'craving_visual'].includes(contentType)) {
    return buildMenuMediaInstruction({
      dishName,
      isCravingVisual: contentType === 'craving_visual',
      language
    })
  }

  if (contentType === 'behind_scenes') {
    return buildBehindScenesMediaInstruction({
      concreteAnchor,
      language
    })
  }

  if (['atmosphere', 'team_people'].includes(contentType)) {
    return buildAtmosphereMediaInstruction({
      contentType: contentType as 'atmosphere' | 'team_people',
      suggestedTime,
      locationContext,
      language
    })
  }

  if (['lunch_moment', 'brunch_moment', 'afterwork_moment'].includes(contentType)) {
    return buildOccasionMediaInstruction({
      occasionType: contentType as 'lunch_moment' | 'brunch_moment' | 'afterwork_moment',
      language
    })
  }

  // Fallback: generic instruction
  return `Placer telefonen i øjenhøjde, 60-80cm fra motivet. Brug naturligt lys fra vinduet. Fyld rammen med det centrale element i scenen.`
}
