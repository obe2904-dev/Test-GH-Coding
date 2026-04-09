import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      businessName,
      businessCategory,
      aboutText,
      menuDescription,
      menuHighlights,
      programmes,
      openingHours,
      hasOutdoorSeating,
      hasTableService,
      hasTakeaway,
      websiteUrl,
    } = await req.json()

    if (!businessName) {
      return new Response(
        JSON.stringify({ error: 'businessName is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const openAiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build context for the prompt
    const contextLines: string[] = []
    if (businessName) contextLines.push(`Navn: ${businessName}`)
    if (businessCategory) contextLines.push(`Kategori/type (udfyldt manuelt): ${businessCategory}`)
    if (aboutText) contextLines.push(`Om virksomheden (fra hjemmeside): ${aboutText}`)
    if (websiteUrl) contextLines.push(`Hjemmeside: ${websiteUrl}`)

    // Structured programmes (strong signal — use instead of flat menu description when available)
    if (programmes && Array.isArray(programmes) && programmes.length > 0) {
      contextLines.push(`Driftsprogrammer (AI-analyseret fra hjemmeside):`)
      for (const p of programmes) {
        const timeCtx = p.timeContext ? ` (${p.timeContext})` : ''
        const itemStr = p.items?.length > 0 ? ` — ${p.items.join(', ')}` : ''
        contextLines.push(`  • ${p.role}${timeCtx}${itemStr}`)
      }
    } else {
      // Fallback: flat menu signal
      if (menuDescription) contextLines.push(`Menuoversigt (AI-analyseret): ${menuDescription}`)
      if (menuHighlights && Array.isArray(menuHighlights) && menuHighlights.length > 0) {
        contextLines.push(`Menupunkter: ${menuHighlights.join(', ')}`)
      } else if (menuHighlights && typeof menuHighlights === 'string' && menuHighlights.trim()) {
        contextLines.push(`Menupunkter: ${menuHighlights}`)
      }
    }

    // Opening hours — derive late-night signal (critical for bar/nightlife detection)
    if (openingHours && typeof openingHours === 'object') {
      const entries = Object.entries(openingHours as Record<string, {open?: string, close?: string}>)
      const dayNamesDA: Record<string, string> = {
        man: 'man', tir: 'tir', ons: 'ons', tor: 'tor', fre: 'fre', lør: 'lør', søn: 'søn'
      }
      // Compute latest closing time
      let latestHour = 0
      const lateDays: string[] = []
      for (const [day, h] of entries) {
        if (!h?.close) continue
        const parts = h.close.split(':')
        let hr = parseInt(parts[0], 10)
        if (isNaN(hr)) continue
        if (hr < 6) hr += 24  // treat 00:xx–05:xx as next-day (past midnight)
        if (hr > latestHour) {
          latestHour = hr
          lateDays.length = 0
          lateDays.push(dayNamesDA[day] || day)
        } else if (hr === latestHour) {
          lateDays.push(dayNamesDA[day] || day)
        }
      }
      if (latestHour > 0) {
        const displayHour = latestHour >= 24 ? latestHour - 24 : latestHour
        const displayTime = `${String(displayHour).padStart(2, '0')}:00`
        contextLines.push(`Lukketid: ${displayTime} (${lateDays.join(', ')})${latestHour >= 24 ? ' — lukker efter midnat' : ''}`)
      }
    }

    const amenities: string[] = []
    if (hasTableService) amenities.push('bordbetjening')
    if (hasTakeaway) amenities.push('takeaway')
    if (hasOutdoorSeating) amenities.push('udendørs siddepladser')
    if (amenities.length > 0) contextLines.push(`Faciliteter: ${amenities.join(', ')}`)

    const context = contextLines.join('\n')

    const systemPrompt = `Du er en erfaren redaktør der skriver præcise, faktuelle beskrivelser af lokale forretninger. Dit job er at fortælle hvad et sted ER — ingen pynt, ingen vurderinger, ingen salgssprog.

OPGAVE: Skriv 2–3 sætninger i klart faktasprog der beskriver hvad denne forretning ER.

REGLER:
- List ALLE roller hvis det er en hybrid-forretning (fx "café, restaurant og bar")
- Brug DRIFTSPROGRAMMER hvis de er tilgængelige — de fortæller om separate tilbud med deres tidsramme
- Hvis lukketid er efter kl. 22:00, inkluder bar/aftendrik-dimensionen i beskrivelsen
- Hvis lukketid er efter midnat (00:xx–05:xx), beskriv stedet som café/restaurant OG bar med senlukket
- Inkluder fysiske features der skaber content-muligheder (fx "med udendørs terrasse ved åen")
- Inkluder tidsformat pr. rolle hvis det er relevant (fx "brunch til kl. 14", "aftensmenu fra 17:30")
- INTET marketingsprog — kun faktuelle beskrivelser
- Skriv på dansk
- Maks 450 tegn

EKSEMPLER:
- "Café, restaurant og bar beliggende ved åen i Aarhus. Serverer brunch dagligt til kl. 14, frokostmenu med danske klassikere og burgere, og 3-retters aftensmenu med tapas ons–lør. Åbent til kl. 02 i weekenden."
- "Klassisk dansk restaurant med fokus på smørrebrød til frokost og moderne aftenmenu."
- "Specialty kaffebar med take-away fokus og få indepladser — travl morgenstemning og rolig eftermiddag."
- "Vinbar og bistro med fokus på naturvin og ostebord. Åbent onsdag–lørdag fra kl. 16 til midnat."`

    const userPrompt = `Forretningsdata:\n${context}\n\nSkriv den korte faktuelle beskrivelse:`

    let suggestion = ''
    let lastError = ''

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * attempt))

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 300,
        }),
      })

      if (!response.ok) {
        lastError = await response.text()
        continue
      }

      const aiResult = await response.json()
      suggestion = aiResult.choices?.[0]?.message?.content?.trim() ?? ''
      break
    }

    if (!suggestion) {
      return new Response(
        JSON.stringify({ error: `OpenAI fejlede efter 3 forsøg: ${lastError}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Output validation
    if (suggestion.length < 80) {
      return new Response(
        JSON.stringify({ error: 'AI returnerede en for kort beskrivelse — prøv igen' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (suggestion.length > 450) {
      const truncated = suggestion.slice(0, 450)
      const lastDot = truncated.lastIndexOf('.')
      suggestion = lastDot > 200 ? truncated.slice(0, lastDot + 1) : truncated
    }

    const marketingTerms = ['unikke', 'enestående', 'fantastiske', 'bedste', 'byder på en oplevelse']
    if (marketingTerms.some(t => suggestion.toLowerCase().includes(t))) {
      console.warn('suggest-business-character: marketing language detected in output:', suggestion)
    }

    return new Response(
      JSON.stringify({ suggestion }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
