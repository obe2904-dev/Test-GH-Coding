// @ts-ignore - Deno import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// @ts-ignore - Deno npm import (VS Code doesn't recognize npm: prefix)
import { extractText, getDocumentProxy } from 'npm:unpdf'

// @ts-ignore - Deno global
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper: Extract text from PDF using unpdf
async function extractTextFromPdf(pdfUrl: string): Promise<string> {
  try {
    console.log('📄 Attempting to extract text from PDF via unpdf:', pdfUrl)

    const resp = await fetch(pdfUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BusinessProfileBot/1.0)',
      },
    })

    if (!resp.ok) {
      console.log('❌ Failed to fetch PDF:', pdfUrl, resp.status)
      return ''
    }

    const buffer = await resp.arrayBuffer()
    const pdf = await getDocumentProxy(new Uint8Array(buffer))

    const { text } = await extractText(pdf, { mergePages: true })

    console.log('✅ Extracted PDF text length:', text.length)
    return text
  } catch (err) {
    console.log('⚠️ PDF parsing failed (unpdf):', err)
    return ''
  }
}

serve(async (req: any) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log('📥 Received request:', body)
    
    const { url, businessName, businessType, tier } = body

    if (!url || typeof url !== 'string') {
      console.error('❌ Missing URL in request')
      return new Response(
        JSON.stringify({ error: 'Missing required field: url' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Determine AI model based on subscription tier (centralized configuration)
    const getAIModel = (userTier: string | undefined): string => {
      const tierModelMap: Record<string, string> = {
        'free': 'gpt-4o-mini',
        'standardplus': 'gpt-4o-mini',
        'standard_plus': 'gpt-4o-mini', // Handle underscore variant
        'premium': 'gpt-4o',
      }
      
      return tierModelMap[userTier || 'free'] || 'gpt-4o-mini'
    }
    
    const aiModel = getAIModel(tier)
    console.log('🤖 Using AI model:', aiModel, '(tier:', tier || 'free', ')')
    
    // Tier-based analysis configuration
    const getTierConfig = (userTier: string | undefined) => {
      const normalizedTier = (userTier || 'free').toLowerCase().replace('_', '')
      
      const configs: Record<string, {
        maxPriorityPages: number
        maxContentChars: number
        allowPdfParsing: boolean
        allowAiLinkClassification: boolean
        description: string
      }> = {
        'free': {
          maxPriorityPages: 0, // Homepage only
          maxContentChars: 5000,
          allowPdfParsing: false,
          allowAiLinkClassification: false,
          description: 'Homepage only, basic pattern-based analysis'
        },
        'standardplus': {
          maxPriorityPages: 3,
          maxContentChars: 10000,
          allowPdfParsing: true, // Menu PDFs only
          allowAiLinkClassification: true,
          description: 'Homepage + 3 pages, AI link classification, menu PDF parsing'
        },
        'premium': {
          maxPriorityPages: 5,
          maxContentChars: 15000,
          allowPdfParsing: true, // All PDFs
          allowAiLinkClassification: true,
          description: 'Full analysis with all PDFs'
        }
      }
      
      return configs[normalizedTier] || configs['free']
    }
    
    const tierConfig = getTierConfig(tier)
    console.log('🎯 Tier configuration:', tierConfig.description)
    console.log('🌐 Analyzing URL:', url)

    // Crawl the website (homepage + depth 1)
    console.log('🕷️ Starting website crawl...')
    
    interface PageData {
      url: string
      html: string
      links: { href: string; text: string }[]
    }
    
    const crawledPages: PageData[] = []
    let websiteContent = ''
    let menuUrl: string | null = null
    let bookingUrl: string | null = null
    const detectedPDFs: Array<{url: string; type: string; name: string}> = []
    
    try {
      // Normalize URL
      const baseUrl = new URL(url)
      const baseDomain = baseUrl.hostname
      
      console.log('🌐 Fetching homepage:', url)
      
      // Fetch homepage (depth 0)
      const homepageResp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BusinessProfileBot/1.0)'
        }
      })
      
      console.log('📡 Homepage response status:', homepageResp.status)
      
      if (!homepageResp.ok) {
        throw new Error(`Failed to fetch website: ${homepageResp.status}`)
      }
      
      const homepageHtml = await homepageResp.text()
      console.log('📄 Homepage HTML length:', homepageHtml.length)
      
      // Extract logo from HTML
      let logoUrl = ''
      
      // Try multiple methods to find logo
      // 1. Look for <link rel="icon" or "apple-touch-icon">
      const iconMatch = homepageHtml.match(/<link[^>]+rel=["'](icon|apple-touch-icon|shortcut icon)["'][^>]+href=["']([^"']+)["']/i)
      if (iconMatch && !logoUrl) {
        logoUrl = new URL(iconMatch[2], url).href
        console.log('🎨 Found logo via link icon:', logoUrl)
      }
      
      // 2. Look for og:image meta tag
      const ogImageMatch = homepageHtml.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      if (ogImageMatch && !logoUrl) {
        logoUrl = new URL(ogImageMatch[1], url).href
        console.log('🎨 Found logo via og:image:', logoUrl)
      }
      
      // 3. Look for <img> tags with "logo" in src, alt, or class
      const imgMatches = homepageHtml.matchAll(/<img[^>]+>/gi)
      if (!logoUrl) {
        for (const imgMatch of imgMatches) {
          const imgTag = imgMatch[0]
          const srcMatch = imgTag.match(/src=["']([^"']+)["']/)
          const altMatch = imgTag.match(/alt=["']([^"']*logo[^"']*)["']/i)
          const classMatch = imgTag.match(/class=["']([^"']*logo[^"']*)["']/i)
          
          if ((altMatch || classMatch) && srcMatch) {
            const imgSrc = srcMatch[1]
            // Prefer .png, .svg, .jpg files
            if (imgSrc.match(/\.(png|svg|jpg|jpeg|webp)$/i)) {
              logoUrl = new URL(imgSrc, url).href
              console.log('🎨 Found logo via img tag:', logoUrl)
              break
            }
          }
        }
      }
      
      // 4. Look for <img> with "brand" in attributes
      if (!logoUrl) {
        for (const imgMatch of imgMatches) {
          const imgTag = imgMatch[0]
          const srcMatch = imgTag.match(/src=["']([^"']+)["']/)
          const altMatch = imgTag.match(/alt=["']([^"']*brand[^"']*)["']/i)
          const classMatch = imgTag.match(/class=["']([^"']*brand[^"']*)["']/i)
          
          if ((altMatch || classMatch) && srcMatch) {
            const imgSrc = srcMatch[1]
            if (imgSrc.match(/\.(png|svg|jpg|jpeg|webp)$/i)) {
              logoUrl = new URL(imgSrc, url).href
              console.log('🎨 Found logo via brand img:', logoUrl)
              break
            }
          }
        }
      }
      
      console.log('🎨 Final extracted logo URL:', logoUrl || 'none found')
      
      // Extract links from homepage
      const linkMatches = homepageHtml.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi)
      const links: { href: string; text: string; hostname: string; isInternal: boolean }[] = []
      
      for (const match of linkMatches) {
        const href = match[1]
        const text = match[2].trim()
        
        // Skip anchors, mailto, tel, javascript
        if (
          href.startsWith('#') ||
          href.startsWith('mailto:') ||
          href.startsWith('tel:') ||
          href.startsWith('javascript:')
        ) {
          continue
        }
        
        try {
          const linkUrl = new URL(href, url)
          const isInternal = linkUrl.hostname === baseDomain
          
          // Optional: still skip homepage itself
          if (isInternal && linkUrl.pathname === baseUrl.pathname) continue
          
          links.push({
            href: linkUrl.href,
            text,
            hostname: linkUrl.hostname,
            isInternal,
          })
        } catch {
          // invalid URL, skip
        }
      }
      
      console.log('🔗 Found links (internal + external):', links.length)
      
      // Classify links using simple rules
      const classifyLink = (href: string, text: string) => {
        const lower = (href + ' ' + text).toLowerCase()
        
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
        
        // 3) Menu pages (unchanged)
        const menuPatterns = ['menu', 'menukort', 'mad', 'drikke', 'food', 'drinks', 'spise', 'eat']
        if (menuPatterns.some(p => lower.includes(p))) {
          return 'MENU'
        }
        
        // 4) Booking pages – now use stricter regexes
        const bookingRegexes = [
          /\bbook\b/i,
          /\bbooking\b/i,
          /\breservation\b/i,
          /\breserver\b/i,
          /\bbestil bord\b/i,
          /\bbook bord\b/i,
          /\bbestil tid\b/i,
        ]
        
        if (bookingRegexes.some(re => re.test(lower))) {
          return 'BOOKING'
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
      
      // Classify all links (internal only for now)
      const internalLinks = links.filter(l => l.isInternal)
      
      const classifiedLinks = internalLinks.map(link => ({
        ...link,
        type: classifyLink(link.href, link.text)
      }))
      
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
      
      if (unclearLinks.length > 0 && tierConfig.allowAiLinkClassification) {
        console.log('🤔 Found unclear links:', unclearLinks.length, '- calling AI for classification...')
        
        try {
          const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
          if (openaiApiKey) {
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
                'Authorization': `Bearer ${openaiApiKey}`
              },
              body: JSON.stringify({
                model: aiModel,
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
          }
        } catch (aiError) {
          console.log('⚠️ AI classification failed, using pattern-only results:', aiError)
        }
      }
      
      // Extract special URLs (after AI reclassification)
      menuUrl = classifiedLinks.find(l => l.type === 'MENU')?.href || null
      
      const bookingDomains = [
        'dinnerbooking.com',
        'thefork.com',
        'quandoo.dk',
        'quandoo.com',
        'opentable.com',
        'eatapp.co',
        'resmio.com',
      ]
      
      const bookingCandidates = classifiedLinks.filter(l => l.type === 'BOOKING')
      
      // Prefer external booking providers first
      const externalBooking = bookingCandidates.find(l =>
        bookingDomains.some(domain => l.href.includes(domain))
      )
      
      // Fallback: any booking candidate
      bookingUrl = externalBooking?.href || bookingCandidates[0]?.href || null
      
      // Collect detected PDF files for consent workflow
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
      
      console.log('🎯 Final detected URLs:', { menuUrl, bookingUrl, detectedPDFs: detectedPDFs.length })
      
      // Store homepage
      crawledPages.push({
        url: url,
        html: homepageHtml,
        links: internalLinks
      })
      
      // Fetch priority pages (menu, booking, contact, about - tier-based limit)
      const priorityLinks = classifiedLinks
        .filter(l => ['MENU', 'BOOKING', 'CONTACT', 'ABOUT'].includes(l.type))
        .slice(0, tierConfig.maxPriorityPages)
      
      console.log('📥 Fetching priority pages (HTML + MENU PDFs only):', priorityLinks.length, `(tier limit: ${tierConfig.maxPriorityPages})`)
      
      for (const link of priorityLinks) {
        try {
          console.log('  → Fetching:', link.href)

          const hrefLower = link.href.toLowerCase()
          const isPdf = hrefLower.endsWith('.pdf')

          if (isPdf && link.type === 'MENU' && tierConfig.allowPdfParsing) {
            // ✅ MENU PDF → parse as menu (tier allows PDF parsing)
            const pdfText = await extractTextFromPdf(link.href)
            if (pdfText) {
              // We don't need HTML for PDFs, just mark that we saw it
              crawledPages.push({
                url: link.href,
                html: '', // no HTML
                links: []
              })

              // Add parsed menu text directly into websiteContent
              websiteContent += `\n\n=== PDF Menu (MENU link): ${link.href} ===\n${pdfText.slice(0, 5000)}`
              console.log('  ✅ Parsed MENU PDF:', link.href)
            } else {
              console.log('  ⚠️ No text extracted from MENU PDF:', link.href)
            }

          } else if (isPdf) {
            // ❌ Non-MENU PDF → skip parsing (could be terms, booking docs, etc.)
            console.log('  ⚠️ Skipping non-MENU PDF:', link.href)
            // Optionally: still store minimal info if you want
            crawledPages.push({
              url: link.href,
              html: '',
              links: []
            })

          } else {
            // 🌐 Normal HTML page (MENU/BOOKING/CONTACT/ABOUT)
            const pageResp = await fetch(link.href, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; BusinessProfileBot/1.0)'
              }
            })

            if (pageResp.ok) {
              const pageHtml = await pageResp.text()
              crawledPages.push({
                url: link.href,
                html: pageHtml,
                links: []
              })
              console.log('  ✅ Fetched HTML page:', link.href, `(${pageHtml.length} chars)`)
            } else {
              console.log('  ❌ Failed to fetch HTML page:', link.href, pageResp.status)
            }
          }

        } catch (e) {
          console.log('  ❌ Error fetching priority link:', link.href, e)
        }
      }
      
      console.log('📊 Total pages crawled:', crawledPages.length)
      
      // Combine all page content for AI analysis
      for (const page of crawledPages) {
        // Skip PDFs and empty html
        if (!page.html || page.url.toLowerCase().endsWith('.pdf')) continue

        let pageText = page.html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        
        websiteContent += `\n\n=== Page: ${page.url} ===\n${pageText.slice(0, 5000)}`
      }
      
      // Limit total content based on tier
      websiteContent = websiteContent.slice(0, tierConfig.maxContentChars)
      console.log('📊 Content limited to', tierConfig.maxContentChars, 'chars for tier:', tier || 'free')
      
      console.log('✂️ Total processed content length:', websiteContent.length)
      
    } catch (fetchError) {
      console.error('Error crawling website:', fetchError)
      return new Response(
        JSON.stringify({ error: `Could not crawl website: ${(fetchError as Error).message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build the prompt for AI
    const systemPrompt = `You are a strict JSON API. Your task is to extract business information from website content and return ONLY valid JSON.

CRITICAL RULES:
- Never invent addresses, opening hours, phone numbers, or URLs
- Never invent menu items, categories, or signature dishes
- Only use information that is clearly present in the content
- If a field is missing or unclear, set it to null or an empty array
- Treat sections starting with "=== PDF Menu" as highly reliable menu text from the business
- When extracting offerings, you must only use items and categories that are explicitly mentioned in those sections or elsewhere in the content
- Return ONLY valid JSON with no markdown formatting, explanations, or code blocks`

    const userPrompt = `Extract business information from this website content and fill out the JSON object below.

${businessName ? `Hint - Business name: ${businessName}\n` : ''}${businessType ? `Hint - Business type: ${businessType}\n` : ''}${menuUrl ? `Detected menu page: ${menuUrl}\n` : ''}${bookingUrl ? `Detected booking page: ${bookingUrl}\n` : ''}Notes about the content:
- The content may include one or more sections starting with "=== PDF Menu". These sections contain raw menu text from PDF menus (dishes, categories, prices).
- Use the PDF menu sections as the primary source for menu categories and signature items.
- If there are no PDF menu sections, use any menu-like text from the HTML pages instead.

Your tasks:

1) BUSINESS BASICS (CRITICAL)
- Find the exact business name, business type (restaurant|cafe|bar|retail|beauty|fitness|services|other), and a concise description (1–2 sentences)
- Logo URL if clearly visible
- Opening hours: Extract exact hours for each day if available. If closed on a day, set "closed": true
- Contact details: phone (with country code if possible), email, physical address
- Address components: street address, city, postal/zip code, country
- Takeaway: Determine if takeaway/take-away/to-go service is offered (true/false/null if unclear)

2) OFFERINGS (VERY IMPORTANT)
- "offerings.categories":
  - Use high-level menu headings or food/drink sections as categories.
  - Examples: "Brunch", "Frokost", "Aften", "Cocktails", "Vin", "Kaffe & te".
  - Only include categories that clearly exist in the content.
- "offerings.signatureItems":
  - Pick 3–8 specific dishes or items that appear to be important or representative.
  - Each item MUST come directly from the menu text.
  - Use the exact or very close wording from the menu (e.g. "Eggs benedict", "Avocado toast", "Café burger").
  - Do NOT invent items and do NOT use generic labels like "Various brunch dishes".
- "offerings.dietaryOptions":
  - Only include dietary options that are explicitly mentioned (e.g. "vegan", "vegetar", "gluten-free").

3) MENU & BOOKING URLS
- "menuUrl": Use the most relevant URL where guests can see what they can order (HTML or PDF), if available.
- "bookingUrl": Use the direct URL where guests can make a reservation or book a table, if available.

4) KEYWORDS
- "keywords": 5–15 short keywords that describe the business (type, style, special focus, location, cuisine, etc.).
- Only use information clearly present in the content.

Website content:
${websiteContent}

Return this JSON structure with extracted information (use null for missing fields and [] for empty arrays):

{
  "businessName": "exact business name from website",
  "businessType": "restaurant|cafe|bar|retail|beauty|fitness|services|other",
  "description": "concise description in 1-2 sentences",
  "logoUrl": "logo image URL if clearly visible",
  "openingHours": {
    "monday": {"open": "HH:MM", "close": "HH:MM", "closed": false},
    "tuesday": {"open": "HH:MM", "close": "HH:MM", "closed": false},
    "wednesday": {"open": "HH:MM", "close": "HH:MM", "closed": false},
    "thursday": {"open": "HH:MM", "close": "HH:MM", "closed": false},
    "friday": {"open": "HH:MM", "close": "HH:MM", "closed": false},
    "saturday": {"open": "HH:MM", "close": "HH:MM", "closed": false},
    "sunday": {"open": "HH:MM", "close": "HH:MM", "closed": false}
  },
  "offerings": {
    "categories": ["menu categories or service types"],
    "signatureItems": ["popular items or specialties"],
    "dietaryOptions": ["vegan, gluten-free, etc."]
  },
  "contact": {
    "phone": "phone number with country code if available",
    "email": "contact email",
    "address": {
      "street": "street address with number",
      "city": "city name",
      "postalCode": "postal/zip code",
      "country": "country name or code"
    }
  },
  "takeaway": true or false or null,
  "menuUrl": "URL to menu page (HTML or PDF)",
  "bookingUrl": "direct URL for online reservations/bookings",
  "keywords": ["relevant keywords about the business"]
}

Return ONLY the JSON object.`

    // Call OpenAI GPT-4o-mini API
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    console.log('🔑 API Key present:', !!openaiApiKey)
    
    if (!openaiApiKey) {
      console.error('❌ No OPENAI_API_KEY found')
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🤖 Calling OpenAI API with model:', aiModel)
    console.log('📝 Prompt length:', (systemPrompt + userPrompt).length)
    
    const openaiResp = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: aiModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1,
          max_tokens: 2048,
          response_format: { type: 'json_object' }
        })
      }
    )

    console.log('🤖 OpenAI response status:', openaiResp.status)
    
    if (!openaiResp.ok) {
      const err = await openaiResp.text()
      console.error('❌ OpenAI API error (status', openaiResp.status, '):', err)
      return new Response(
        JSON.stringify({ 
          error: 'OpenAI API request failed',
          details: `Status ${openaiResp.status}: ${err.slice(0, 200)}`
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const openaiData = await openaiResp.json()
    const content = openaiData?.choices?.[0]?.message?.content

    if (!content || typeof content !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Gemini returned unexpected response' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse the JSON response
    let analysisResult
    try {
      // Remove markdown code blocks if present
      const cleanedContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      
      analysisResult = JSON.parse(cleanedContent)
      
      // Basic cleanup: ensure arrays exist
      analysisResult.offerings = analysisResult.offerings || {}
      analysisResult.offerings.categories = analysisResult.offerings.categories || []
      analysisResult.offerings.signatureItems = analysisResult.offerings.signatureItems || []

      // Remove signatureItems that look like generic categories
      const lowerCategories = new Set(
        analysisResult.offerings.categories.map((c: string) => c.toLowerCase())
      )

      analysisResult.offerings.signatureItems = analysisResult.offerings.signatureItems.filter(
        (item: string) => item && !lowerCategories.has(item.toLowerCase())
      )
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content)
      return new Response(
        JSON.stringify({ error: 'Failed to parse analysis result' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Add the original URL to the result
    analysisResult.url = url
    
    // Use detected URLs if AI didn't find them
    if (!analysisResult.menuUrl && menuUrl) {
      analysisResult.menuUrl = menuUrl
    }
    if (!analysisResult.bookingUrl && bookingUrl) {
      analysisResult.bookingUrl = bookingUrl
    }
    
    // Use extracted logo if AI didn't find one
    if (!analysisResult.logoUrl && logoUrl) {
      analysisResult.logoUrl = logoUrl
      console.log('🎨 Using extracted logo URL:', logoUrl)
    }
    
    // Add detected PDFs to response if any found
    if (detectedPDFs.length > 0) {
      analysisResult.detectedPDFs = detectedPDFs
      console.log('📄 Detected PDFs for potential storage:', detectedPDFs.length)
    }
    
    console.log('✅ Analysis complete, returning:', analysisResult)

    return new Response(
      JSON.stringify(analysisResult),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Error in analyze-website function:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
