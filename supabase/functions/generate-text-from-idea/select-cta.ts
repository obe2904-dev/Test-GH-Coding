// select-cta.ts
// Deterministic CTA selection: intent resolution, brand-voice pool, booking-link gating,
// and ctaStyle flag (strict = verbatim for booking URLs, soft = model integrates naturally).

// CTA pool — variety sets per language and intent.
// Swedish and German entries are stubs pending localisation.
export const FREE_CTAS: Record<string, Record<string, string[]>> = {
  da: {
    visit: [
      'Ses vi i dag? 😊',
      'Vi har åbent — og vi glæder os',
      'Svip forbi efter arbejde 🍽️',
      'Se menuen og book bord 👇'
    ],
    social: [
      'Tag den du vil dele det med 👇',
      'Hvem tager du med? 😋',
      'Del med én der har brug for det her',
      'Tag en ven med 🤝'
    ],
    engagement: [
      'Hvad ville du vælge? 👇',
      'Skriv din favorit i kommentarerne 💬',
      'Kender du det? 😄',
      'Er du enig? 🙌',
      'Kan du se omsorgen? 😊',
      'Kender du følelsen? 👇'
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
  reservationRequired?: boolean  // booking pattern signal
  acceptsWalkIns?: boolean       // walk-in signal
  contentType?: string           // content type (determines if CTA needed)
}

export interface CTASelection {
  selectedCta: string | null     // null for behind_scenes
  ctaStyle: 'strict' | 'soft'    // strict = verbatim; soft = model may integrate naturally
  ctaIntent: string
}

export function selectCTA(params: CTASelectionParams): CTASelection {
  const { 
    typicalClosings, 
    language, 
    suggestionCtaIntent, 
    resolvedGoalMode, 
    isMenuPost, 
    bookingLink, 
    suggestionId,
    reservationRequired = false,
    acceptsWalkIns = false,
    contentType,
  } = params

  // NO CTA for behind-the-scenes posts — craft speaks for itself
  if (contentType === 'behind_scenes') {
    console.log('🎯 No CTA for behind_scenes post')
    return { 
      selectedCta: null, 
      ctaStyle: 'soft', 
      ctaIntent: 'engagement' 
    }
  }

  // goalMode overrides ctaIntent when no explicit intent given
  const goalModeCTAMap: Record<string, string> = {
    drive_footfall: 'visit',
    build_brand: 'social',
    retain_loyalty: 'save',
  }
  const ctaIntent = suggestionCtaIntent
    || (resolvedGoalMode ? goalModeCTAMap[resolvedGoalMode] : undefined)
    || (isMenuPost ? 'visit' : 'social')

  // ═══════════════════════════════════════════════════════════════════════
  // BOOKING PATTERN ADAPTATION
  // ═══════════════════════════════════════════════════════════════════════
  // Adjust CTA pool based on business booking pattern
  
  let ctaPoolOverride: string[] | null = null;
  
  // IMPULSE-FRIENDLY (walk-in, no reservations): Remove booking language
  const isImpulseFriendly = acceptsWalkIns && !reservationRequired;
  if (isImpulseFriendly && ctaIntent === 'visit') {
    // Use casual "kom forbi" language, never booking
    const casualVisitCTAs: Record<string, string[]> = {
      da: [
        'Kom forbi i dag 😊',
        'Vi ses snart? ☕',
        'Svip forbi når du er i nærheden',
        'Vi glæder os til at se dig'
      ],
      sv: ['Titta förbi idag ☀️', 'Ses vi snart? 😊'],
      de: ['Schau heute vorbei ☀️', 'Sehen wir uns bald? 😊']
    };
    ctaPoolOverride = casualVisitCTAs[language] || casualVisitCTAs.da;
  }
  
  // ADVANCE-PLANNING (reservation required): Emphasize booking
  if (reservationRequired && ctaIntent === 'visit' && bookingLink) {
    // Always use booking-focused CTAs
    const bookingFocusedCTAs: Record<string, string[]> = {
      da: [
        'Book bord online 👇',
        'Reservér din plads 📅',
        'Se menuen og book bord',
        'Sikr dig et bord — book nu'
      ],
      sv: ['Boka bord online 👇', 'Reservera din plats 📅'],
      de: ['Tisch online buchen 👇', 'Reservieren Sie Ihren Platz 📅']
    };
    ctaPoolOverride = bookingFocusedCTAs[language] || bookingFocusedCTAs.da;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CTA POOL SELECTION (with booking pattern override)
  // ═══════════════════════════════════════════════════════════════════════
  
  // Use override pool if set, otherwise apply existing logic
  const rawCtaPool = ctaPoolOverride
    ?? ((typicalClosings.length > 0 && (ctaIntent !== 'visit' || !bookingLink))
      ? typicalClosings
      : (FREE_CTAS[language]?.[ctaIntent] || FREE_CTAS.da.visit))

  // Never serve a booking-URL CTA ("Se menuen og book bord 👇") when no booking link
  // is configured — the 👇 arrow would point to nothing.
  const ctaPool = bookingLink
    ? rawCtaPool
    : rawCtaPool.filter(cta => !/book\s*bord|se\s*menuen.*👇/i.test(cta))

  // Deterministic selection by cycling (same idea always gets same CTA)
  // String IDs (e.g. UUIDs from weekly_plan) are reduced to a numeric hash so they
  // cycle the pool rather than always returning index 0.
  const ctaIndex = (typeof suggestionId === 'number'
    ? suggestionId
    : [...String(suggestionId)].reduce((a, c) => a + c.charCodeAt(0), 0)
  ) % ctaPool.length
  const selectedCta = ctaPool[ctaIndex]

  // strict = booking CTA with URL must appear verbatim; soft = model may integrate naturally
  const ctaStyle: 'strict' | 'soft' = (ctaIntent === 'visit' && !!bookingLink) ? 'strict' : 'soft'

  console.log('🎯 CTA selected:', selectedCta, '(intent:', ctaIntent, ', style:', ctaStyle, ', from brand closings:', typicalClosings.length > 0, ')')

  return { selectedCta, ctaStyle, ctaIntent }
}
