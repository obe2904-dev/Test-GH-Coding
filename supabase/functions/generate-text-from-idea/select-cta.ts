// select-cta.ts
// Deterministic CTA selection: intent resolution, brand-voice pool, booking-link gating,
// and ctaStyle flag (strict = verbatim for booking URLs, soft = model integrates naturally).

// CTA pool — variety sets per language and intent.
// Swedish and German entries are stubs pending localisation.
export const FREE_CTAS: Record<string, Record<string, string[]>> = {
  da: {
    visit: [
      'Ses vi i dag? 😊',
      'Find os i weekenden 🙌',
      'Vi har åbent — og vi glæder os',
      'Svip forbi efter arbejde 🍽️',
      'Se menuen og book bord 👇'
    ],
    social: [
      'Tag den du vil dele det med 👇',
      'Hvem tager du med? 😋',
      'Del med én der har brug for det her',
      'Send til din frokost-makker 🤝'
    ],
    engagement: [
      'Hvad ville du vælge? 👇',
      'Skriv din favorit i kommentarerne 💬',
      'Kender du det? 😄',
      'Er du enig? 🙌',
      'Hvad synes du? 👇'
    ],
    save: [
      'Gem til næste gang du er i byen 📌',
      'Gem det her til weekenden 📌',
      'Husk os næste gang 😊'
    ]
  },
  // Swedish templates (future expansion)
  sv: {
    visit: ['Titta förbi idag ☀️', 'Ses vi snart? 😊'],
    social: ['Tagga den du vill dela med 👇'],
    engagement: ['Vad skulle du välja? 👇'],
    save: ['Spara till nästa gång 📌']
  },
  // German templates (future expansion)
  de: {
    visit: ['Schau heute vorbei ☀️', 'Sehen wir uns bald? 😊'],
    social: ['Markiere jemanden 👇'],
    engagement: ['Was würdest du wählen? 👇'],
    save: ['Speichern für später 📌']
  }
}

interface CTASelectionParams {
  typicalClosings: string[]     // brand-specific CTA pool from brand_profile
  language: string
  suggestionCtaIntent?: string  // explicit intent from suggestion
  resolvedGoalMode?: string     // weekly_plan goal mode used as fallback intent
  isMenuPost: boolean
  bookingLink: string | null
  suggestionId: number | string // used for deterministic cycling
}

export interface CTASelection {
  selectedCta: string
  ctaStyle: 'strict' | 'soft'  // strict = verbatim; soft = model may integrate naturally
  ctaIntent: string
}

export function selectCTA(params: CTASelectionParams): CTASelection {
  const { typicalClosings, language, suggestionCtaIntent, resolvedGoalMode, isMenuPost, bookingLink, suggestionId } = params

  // goalMode overrides ctaIntent when no explicit intent given
  const goalModeCTAMap: Record<string, string> = {
    drive_footfall: 'visit',
    build_brand: 'social',
    retain_loyalty: 'save',
  }
  const ctaIntent = suggestionCtaIntent
    || (resolvedGoalMode ? goalModeCTAMap[resolvedGoalMode] : undefined)
    || (isMenuPost ? 'visit' : 'social')

  // Brand typical_closings win for social/save intent (always) and for visit intent
  // when no booking link is set — no operational URL is at stake, so the brand voice
  // can close naturally. Only defer to FREE_CTAS.visit when a real booking URL exists.
  const rawCtaPool = (typicalClosings.length > 0 && (ctaIntent !== 'visit' || !bookingLink))
    ? typicalClosings
    : (FREE_CTAS[language]?.[ctaIntent] || FREE_CTAS.da.visit)

  // Never serve a booking-URL CTA ("Se menuen og book bord 👇") when no booking link
  // is configured — the 👇 arrow would point to nothing.
  const ctaPool = bookingLink
    ? rawCtaPool
    : rawCtaPool.filter(cta => !/book\s*bord|se\s*menuen.*👇/i.test(cta))

  // Deterministic selection by cycling (same idea always gets same CTA)
  const ctaIndex = (typeof suggestionId === 'number' ? suggestionId : 0) % ctaPool.length
  const selectedCta = ctaPool[ctaIndex]

  // strict = booking CTA with URL must appear verbatim; soft = model may integrate naturally
  const ctaStyle: 'strict' | 'soft' = (ctaIntent === 'visit' && !!bookingLink) ? 'strict' : 'soft'

  console.log('🎯 CTA selected:', selectedCta, '(intent:', ctaIntent, ', style:', ctaStyle, ', from brand closings:', typicalClosings.length > 0, ')')

  return { selectedCta, ctaStyle, ctaIntent }
}
