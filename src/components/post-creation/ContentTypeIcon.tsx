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
    case 'indoor_focus':
      // House — indoor focus / interior setting
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 11l9-7 9 7" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10v10h14V10" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 20v-6h4v6" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 14h6" />
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
      // Patio umbrella with chairs — outdoor / terrace seating
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24" stroke="none">
          <g transform="scale(0.22) translate(-2, -5)">
            <path d="m55.555 79.797 8.4844-13.23h19.898c0.70703 0 1.4141-0.30469 1.8164-0.80859 0.40234-0.50391 0.60547-1.1094 0.60547-1.8164v-3.6367c0-1.4141-1.1094-2.5234-2.5234-2.5234l-32.422-0.003906v-23.23c2.1211-0.30469 4.2422-1.3125 6.0625-2.9297 1.8164 1.918 4.1406 2.9297 6.5664 3.0312h0.40234c2.5234 0 5.0508-1.0117 7.1719-2.9297 1.8164 1.8164 4.0391 2.8281 6.4648 2.9297 3.0312 0.10156 5.9609-1.2109 8.3828-3.7383 0.20312-0.20312 0.30469-0.50391 0.30469-0.80859-1.4141-15.758-17.273-28.184-36.367-28.184-19.09 0-34.949 12.426-36.16 28.184 0 0.30469 0.10156 0.50391 0.20312 0.70703 1.8164 2.3242 4.4453 3.6367 7.2734 3.7383h0.40234c2.5234 0 5.0508-1.0117 7.1719-2.9297 1.8164 1.8164 4.0391 2.8281 6.4648 2.9297h0.40234c2.625 0 5.1523-1.0117 7.2734-3.0312 1.7188 1.7188 3.8398 2.8281 6.1602 2.9297v23.332h-32.824c-1.4141 0-2.5234 1.1094-2.5234 2.5234v3.6367c0 1.4141 1.1094 2.5234 2.5234 2.5234h20l8.5859 13.332-11.418 17.883c-0.20312 0.30469-0.20312 0.70703 0 1.0117s0.50391 0.50391 0.91016 0.50391h7.8789c0.30469 0 0.70703-0.20312 0.80859-0.50391l5.8594-9.0898v8.4844c0 0.60547 0.40234 1.0117 1.0117 1.0117 0.60547 0 1.0117-0.40234 1.0117-1.0117v-8.7891l6.0625 9.3945c0.20312 0.30469 0.50391 0.50391 0.80859 0.50391h7.8789c0.40234 0 0.70703-0.20312 0.91016-0.50391 0.20312-0.30469 0.20312-0.70703 0-1.0117zm-11.414-50.199c-0.20312-0.30469-0.50391-0.40234-0.80859-0.40234-0.30469 0-0.60547 0.10156-0.80859 0.30469-1.918 2.1211-4.3438 3.1328-6.7695 3.1328-2.1211-0.10156-4.0391-1.0117-5.4531-2.7266-0.10156-0.10156-0.10156-0.30469-0.20312-0.40234-0.20312-0.20312-0.40234-0.30469-0.70703-0.30469h-0.10156c-0.20312 0-0.40234 0.10156-0.60547 0.20312-0.10156 0.10156-0.20312 0.20312-0.30469 0.40234-1.918 1.918-4.1406 2.9297-6.5664 2.8281-2.1211-0.10156-4.0391-1.0117-5.4531-2.7266 1.2148-14.652 16.164-25.969 34.043-25.969 17.574 0 32.727 11.617 34.141 25.859-1.918 1.918-4.1406 2.8281-6.4648 2.7266-2.1211-0.10156-4.0391-1.0117-5.4531-2.7266-0.10156-0.10156-0.10156-0.30469-0.20312-0.40234-0.20312-0.20312-0.40234-0.30469-0.70703-0.30469h-0.10156c-0.20312 0-0.40234 0.10156-0.60547 0.20312-0.10156 0.10156-0.20312 0.20312-0.30469 0.40234-1.918 1.918-4.1406 2.8281-6.4648 2.7266-2.1211-0.10156-4.0391-1.0117-5.4531-2.7266-0.10156-0.10156-0.10156-0.30469-0.20312-0.40234-0.20312-0.20312-0.40234-0.30469-0.70703-0.30469-0.30469 0-0.60547 0.10156-0.80859 0.30469z"/>
            <path d="m25.152 76.062h-18.688c-0.60547 0-1.0117 0.40234-1.0117 1.0117v3.8398c0 0.30469 0.20312 0.60547 0.40234 0.80859v16.465c0 0.60547 0.40234 1.0117 1.0117 1.0117h17.879c0.60547 0 1.0117-0.40234 1.0117-1.0117v-16.469c0.20313-0.20312 0.40234-0.50391 0.40234-0.80859v-3.8398c0-0.60547-0.40234-1.0078-1.0078-1.0078zm-1.0117 2.0195v1.7148h-16.664v-1.7188zm-16.262 19.09v-15.254h15.859v15.254z"/>
            <path d="m93.332 76.062h-18.688c-0.60547 0-1.0117 0.40234-1.0117 1.0117v3.8398c0 0.30469 0.20313 0.60547 0.40234 0.80859v16.465c0 0.60547 0.40234 1.0117 1.0117 1.0117l17.883-0.007813c0.60547 0 1.0117-0.40234 1.0117-1.0117l-0.003906-16.461c0.20312-0.20312 0.40234-0.50391 0.40234-0.80859v-3.8398c0.003906-0.60547-0.40234-1.0078-1.0078-1.0078zm-1.0078 2.0195v1.7148h-16.668v-1.7188zm-16.262 19.09v-15.254h15.855v15.254z"/>
          </g>
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
