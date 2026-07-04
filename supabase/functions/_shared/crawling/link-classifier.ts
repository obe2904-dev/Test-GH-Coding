// supabase/functions/_shared/crawling/link-classifier.ts
// Link classification utilities for website analysis

const BOOKING_PLATFORMS = [
  'dinnerbooking.com',
  'bestilling.dk',
  'resengo.com',
  'bordbestilling.dk',
  'dinnersite.dk',
  'opentable.com',
  'tockify.com',
  'resy.com',
  'bookatable.dk',
  'tablein.com',
  'eatapp.co',
  'sevenrooms.com',
  'booksy.com',
  'fresha.com',
  'treatwell.com',
]

// Domains that are never menu/booking/contact content — safe to always drop.
// This is intentionally small and generic. We use a DENYLIST approach:
// - ALLOW: External menu/ordering platforms (Mealo, Wolt, etc.) → classify normally
// - DENY: Only social media, maps, messaging → always drop
// - OVERRIDE: BOOKING_PLATFORMS always forced to BOOKING type (strong signal)
const EXTERNAL_IGNORE_DOMAINS = [
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'twitter.com',
  'x.com',
  'youtube.com',
  'linkedin.com',
  'pinterest.com',
  'snapchat.com',
  'whatsapp.com',
  'wa.me',
  'google.com/maps',
  'maps.app.goo.gl',
]

export type LinkType = 'MENU' | 'BOOKING' | 'CONTACT' | 'ABOUT' | 'CANCEL' | 'IGNORE' | 'OTHER'

export interface Link {
  href: string
  text: string
  ariaLabel?: string
  title?: string
  isInternal: boolean
}

export interface ClassifiedLink extends Link {
  type: LinkType
}

export interface DetectedPDF {
  url: string
  type: string
  name: string
}

export interface LinkClassificationResult {
  classifiedLinks: ClassifiedLink[]
  menuUrls: string[]
  bookingUrl: string | null
  detectedPDFs: DetectedPDF[]
}

/**
 * Classify a single link based on URL, text, and attributes
 */
export function classifyLink(
  href: string,
  text: string,
  ariaLabel: string = '',
  title: string = ''
): LinkType {
  // Combine all signals for better classification
  const lower = [href, text, ariaLabel, title].join(' ').toLowerCase()
  
  // 1) Explicit cancel/afbestilling detection
  const cancelPatterns = ['afbestilling', 'aflys', 'cancel', 'cancellation']
  if (cancelPatterns.some(p => lower.includes(p))) {
    return 'CANCEL'
  }
  
  // 2) Ignore junk pages
  const ignorePatterns = [
    'cookie',
    'privacy',
    'persondata',
    'gdpr',
    'terms',
    'vilkår',
    'betingelser',
    'faq',
    'jobs',
    'karriere',
    'job',
    'career',
  ]
  if (ignorePatterns.some(p => lower.includes(p))) {
    return 'IGNORE'
  }
  
  // 3) Booking pages – check BEFORE menu to avoid "dinnerbooking" matching "dinner"
  const bookingRegexes = [
    /\bbook\b/i,
    /\bbooking\b/i,
    /\breservation\b/i,
    /\breserver\b/i,
    /\bbestil bord\b/i,
    /\bbook bord\b/i,
    /\bbestil tid\b/i,
    /dinnerbooking/i,  // Explicit booking platform
  ]
  
  if (bookingRegexes.some(re => re.test(lower))) {
    return 'BOOKING'
  }
  
  // 4) Menu pages - expanded Danish patterns (checked AFTER booking)
  const menuPatterns = [
    'menu', 'menukort', 'mad', 'drikke', 'food', 'drinks', 'spise', 'eat',
    'cocktail', 'vin', 'wine', 'øl', 'beer', 'brunch', 'frokost', 'aften',
    'julefrokost', 'julemenu', 'morgenmad', 'breakfast', 'lunch',
    'dessert', 'snack', 'tapas', 'smørrebrød', 'buffet'
  ]
  // Use word boundary for 'dinner' to avoid matching 'dinnerbooking'
  const isDinnerMenu = /\bdinner\b/i.test(lower) && !lower.includes('booking')
  
  if (menuPatterns.some(p => lower.includes(p)) || isDinnerMenu) {
    return 'MENU'
  }
  
  // 5) Contact pages
  const contactPatterns = ['contact', 'kontakt', 'find', 'location', 'adresse', 'address']
  if (contactPatterns.some(p => lower.includes(p))) {
    return 'CONTACT'
  }
  
  // 6) About pages
  const aboutPatterns = ['about', 'om', 'story', 'historie', 'who', 'hvem']
  if (aboutPatterns.some(p => lower.includes(p))) {
    return 'ABOUT'
  }
  
  return 'OTHER'
}

/**
 * Classify all links and optionally use AI for unclear ones
 */
export async function classifyLinks(
  links: Link[],
  options: {
    allowAiClassification: boolean
    aiModel?: string
    openaiApiKey?: string
  }
): Promise<ClassifiedLink[]> {
  // Classify internal links + all external links except known-useless domains.
  // External menu/ordering platforms (Mealo, etc.) are NOT pre-filtered here —
  // they flow through the same pattern/AI classification as internal links.
  const internalLinks = links.filter(l => l.isInternal)
  const externalLinks = links.filter(l =>
    !l.isInternal && !EXTERNAL_IGNORE_DOMAINS.some(domain => l.href.includes(domain))
  )

  // Combine for classification
  const linksToClassify = [...internalLinks, ...externalLinks]

  let classifiedLinks = linksToClassify.map(link => {
    const patternType = classifyLink(link.href, link.text, link.ariaLabel, link.title)
    // Known booking platforms are forced to BOOKING regardless of pattern
    // match — this is a stronger signal than link text/href keywords alone.
    const isKnownBookingPlatform = BOOKING_PLATFORMS.some(domain => link.href.includes(domain))
    return {
      ...link,
      type: isKnownBookingPlatform ? 'BOOKING' as LinkType : patternType,
    }
  })
  
  console.log('📋 Link classification:', {
    menu: classifiedLinks.filter(l => l.type === 'MENU').length,
    booking: classifiedLinks.filter(l => l.type === 'BOOKING').length,
    cancel: classifiedLinks.filter(l => l.type === 'CANCEL').length,
    contact: classifiedLinks.filter(l => l.type === 'CONTACT').length,
    about: classifiedLinks.filter(l => l.type === 'ABOUT').length,
    other: classifiedLinks.filter(l => l.type === 'OTHER').length,
    ignored: classifiedLinks.filter(l => l.type === 'IGNORE').length
  })
  
  // AI classification for unclear links (type === 'OTHER')
  const unclearLinks = classifiedLinks.filter(l => l.type === 'OTHER')
  
  if (unclearLinks.length > 0 && options.allowAiClassification && options.openaiApiKey) {
    console.log('🤔 Found unclear links:', unclearLinks.length, '- calling AI for classification...')
    
    try {
      const linkClassificationPrompt = `Classify these website links into categories: MENU, BOOKING, CONTACT, ABOUT, or IGNORE.

Links to classify:
${unclearLinks.map((l, idx) => `${idx + 1}. URL: ${l.href}\n   Text: "${l.text}"`).join('\n')}

Return a JSON array with the same order:
[
  {"index": 0, "type": "MENU|BOOKING|CONTACT|ABOUT|IGNORE"},
  {"index": 1, "type": "..."}
]

Categories:
- MENU: Menu, food/drink listings
- BOOKING: Reservations, table booking, appointments
- CONTACT: Contact info, location, map
- ABOUT: About us, history, team
- IGNORE: Not relevant (privacy, terms, social media links, etc.)`

      const aiClassifyResp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${options.openaiApiKey}`
        },
        body: JSON.stringify({
          model: options.aiModel || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a link classifier. Return only valid JSON.' },
            { role: 'user', content: linkClassificationPrompt }
          ],
          temperature: 0.1,
          max_tokens: 500,
          response_format: { type: 'json_object' }
        })
      })

      if (aiClassifyResp.ok) {
        const aiData = await aiClassifyResp.json()
        const aiContent = aiData?.choices?.[0]?.message?.content
        
        if (aiContent) {
          const cleanedContent = aiContent
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim()
          
          const classifications = JSON.parse(cleanedContent)
          const classArray = Array.isArray(classifications) ? classifications : (classifications.classifications || [])
          
          console.log('🤖 AI classified:', classArray.length, 'links')
          
          // Update classifications
          classArray.forEach((item: any) => {
            const idx = item.index
            if (idx >= 0 && idx < unclearLinks.length) {
              const link = unclearLinks[idx]
              const originalIdx = classifiedLinks.findIndex(l => l.href === link.href)
              if (originalIdx >= 0 && item.type !== 'IGNORE') {
                classifiedLinks[originalIdx].type = item.type
                console.log(`  ✨ Reclassified: ${link.href} → ${item.type}`)
              }
            }
          })
        }
      }
    } catch (aiError) {
      console.log('⚠️ AI classification failed, using pattern-only results:', aiError)
    }
  }
  
  return classifiedLinks
}

/**
 * Extract special URLs from classified links
 */
export function extractSpecialUrls(classifiedLinks: ClassifiedLink[]): {
  menuUrls: string[]
  bookingUrl: string | null
  detectedPDFs: DetectedPDF[]
} {
  // Collect ALL menu URLs - deduplicated and sorted
  const uniqueMenuUrls = new Set(
    classifiedLinks
      .filter(l => l.type === 'MENU')
      .map(l => l.href)
  )
  
  const menuUrls = Array.from(uniqueMenuUrls)
    .sort((a, b) => {
      // Deprioritize URLs containing 'english' - put them at the end
      const aIsEnglish = a.toLowerCase().includes('english')
      const bIsEnglish = b.toLowerCase().includes('english')
      if (aIsEnglish && !bIsEnglish) return 1  // a goes after b
      if (!aIsEnglish && bIsEnglish) return -1 // a goes before b
      return 0 // maintain original order
    })
  
  console.log('🍽️ Found menu URLs:', menuUrls.length, menuUrls)
  
  // Extract booking URL
  const bookingCandidates = classifiedLinks.filter(l => l.type === 'BOOKING')
  
  console.log('🔖 Booking candidates found:', bookingCandidates.length, bookingCandidates.map(c => ({ href: c.href, text: c.text })))
  
  // Prefer external booking providers first
  const externalBooking = bookingCandidates.find(l =>
    BOOKING_PLATFORMS.some(domain => l.href.includes(domain))
  )
  
  const bookingUrl = externalBooking?.href || bookingCandidates[0]?.href || null
  
  // Collect detected PDF files
  const detectedPDFs: DetectedPDF[] = []
  for (const link of classifiedLinks) {
    if (link.href.toLowerCase().endsWith('.pdf') && ['MENU', 'ABOUT'].includes(link.type)) {
      const urlParts = link.href.split('/')
      const fileName = urlParts[urlParts.length - 1] || 'document.pdf'
      detectedPDFs.push({
        url: link.href,
        type: link.type,
        name: fileName
      })
    }
  }
  
  console.log('🎯 Final detected URLs:', { menuCount: menuUrls.length, bookingUrl, detectedPDFs: detectedPDFs.length })
  
  return { menuUrls, bookingUrl, detectedPDFs }
}

/**
 * Combined classification and extraction
 */
export async function classifyAndExtractLinks(
  links: Link[],
  options: {
    allowAiClassification: boolean
    aiModel?: string
    openaiApiKey?: string
  }
): Promise<LinkClassificationResult> {
  const classifiedLinks = await classifyLinks(links, options)
  const { menuUrls, bookingUrl, detectedPDFs } = extractSpecialUrls(classifiedLinks)
  
  return {
    classifiedLinks,
    menuUrls,
    bookingUrl,
    detectedPDFs
  }
}
