// ContentTypeIcon.tsx
// SVG icons for AI suggestion content types — same style as sidebar icons
// fill="none", stroke="currentColor", strokeWidth=2, viewBox="0 0 24 24"

interface ContentTypeIconProps {
  contentType: string
  className?: string
}

export function ContentTypeIcon({ contentType, className = 'w-5 h-5' }: ContentTypeIconProps) {
  const normalized = (contentType || '').toLowerCase()

  switch (normalized) {
    case 'menu_item':
    case 'menu_highlight':
    case 'product_menu':
    case 'craving_visual':
      // Fork and knife — menu/dish content
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 2v6a3 3 0 003 3v11" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 2v6" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 2v6a3 3 0 01-3 3" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 2c0 0 3 2 3 7s-3 7-3 7v6" />
        </svg>
      )
    case 'drinks':
    case 'drink':
    case 'beverage':
      // Wine glass — drinks content
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 3h8l-2 8a4 4 0 01-4 0L8 3z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 14v5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8" />
        </svg>
      )
    case 'atmosphere':
      // Sparkles — vibe/ambience
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l1.5 3.5L10 8l-3.5 1.5L5 13l-1.5-3.5L0 8l3.5-1.5L5 3zm14 10l1 2.5 2.5 1-2.5 1L19 20l-1-2.5L15.5 16.5l2.5-1L19 13zm-4-10l.75 1.75L17.5 5.5l-1.75.75L15 8l-.75-1.75L12.5 5.5l1.75-.75L15 3z" />
        </svg>
      )
    case 'behind_scenes':
      // Clapperboard — behind the scenes
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v2m4-2v2m4-2v2M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
        </svg>
      )
    case 'team_people':
      // People group — team content
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5.447-3.724M17 20H7m10 0v-2c0-.768-.231-1.48-.626-2.076M7 20H2v-2a4 4 0 015.447-3.724M7 20v-2c0-.768.231-1.48.626-2.076m0 0A4 4 0 0112 12a4 4 0 014.374 3.924M12 12a4 4 0 100-8 4 4 0 000 8z" />
        </svg>
      )
    case 'location_story':
      // Compass — location/story content
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 9.5l-1.5 5-5 1.5 1.5-5 5-1.5z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2M12 19v2M3 12h2M19 12h2" />
        </svg>
      )
    case 'outdoor_seating':
      // Patio set — outdoor / terrace seating
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.45}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 8.5a7.5 5.5 0 0 1 15 0" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 8.5h15" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v16" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 13v3.5h3" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 16.5v2.5 M8.5 16.5v2.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 13v3.5h-3" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 16.5v2.5 M15.5 16.5v2.5" />
        </svg>
      )
    case 'engagement':
      // Chat bubble — engagement/question post
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      )
    case 'event_promotion':
      // Calendar — event/special occasion
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 13v3m0 0h.01" />
        </svg>
      )
    case 'seasonal':
      // Sun — seasonal content
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2m0 14v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M3 12h2m14 0h2M4.22 19.78l1.42-1.42m12.72-12.72l1.42-1.42M12 7a5 5 0 100 10 5 5 0 000-10z" />
        </svg>
      )
    default:
      // Fallback: pencil/post
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      )
  }
}
