// Run an end-to-end ai-generate call using signals from analyze-website.
//
// Easiest setup (recommended): put the token in .env.local (gitignored)
//   ACCESS_TOKEN=eyJ...
// then run:
//   node scripts/run-ai-generate-faust.mjs --url https://cafefaust.dk/ --tier premium --userTier free
//
// Alternative: set ACCESS_TOKEN in your shell environment.
//
// Note: Do NOT pass the token on the command line to avoid it being echoed/logged.

import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)

function getArg(name, fallback) {
  const idx = args.indexOf(name)
  if (idx === -1) return fallback
  const v = args[idx + 1]
  return v ?? fallback
}

const baseUrl = getArg('--baseUrl', 'https://kvqdkohdpvmdylqgujpn.supabase.co')
const websiteUrl = getArg('--url', 'https://cafefaust.dk/')
const tier = getArg('--tier', 'premium')
const userTier = getArg('--userTier', 'free')

function parseDotEnv(contents) {
  const out = {}
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line
    const eq = normalized.indexOf('=')
    if (eq === -1) continue
    const key = normalized.slice(0, eq).trim()
    let value = normalized.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key) out[key] = value
  }
  return out
}

function loadEnvFromFiles() {
  const cwd = process.cwd()
  for (const filename of ['.env.local', '.env']) {
    const fullPath = path.join(cwd, filename)
    if (!fs.existsSync(fullPath)) continue
    try {
      const parsed = parseDotEnv(fs.readFileSync(fullPath, 'utf8'))
      for (const [k, v] of Object.entries(parsed)) {
        if (process.env[k] == null) process.env[k] = v
      }
    } catch {
      // ignore
    }
  }
}

loadEnvFromFiles()

const accessToken = process.env.ACCESS_TOKEN
if (!accessToken) {
  console.error('Missing ACCESS_TOKEN. Put it in .env.local (recommended) or export it in your shell.')
  console.error('Example .env.local line: ACCESS_TOKEN=eyJ...')
  process.exit(1)
}

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { _raw: text }
  }
  return { ok: res.ok, status: res.status, json }
}

function buildPromptFromAnalysis(a) {
  const businessName = a.businessName || 'Café Faust'
  const businessType = a.businessType || 'cafe'
  const keywords = Array.isArray(a.keywords) ? a.keywords.slice(0, 12) : []
  const bookingUrl = a.bookingUrl || ''
  const openingHours = a.openingHours || {}

  const menuStructure = a.offerings?.menuStructure || []
  const firstCat = menuStructure[0] || {}
  const catName = String(firstCat.name || firstCat.category || 'BRUNCH').toUpperCase()
  const items = Array.isArray(firstCat.items) ? firstCat.items : []
  const menuNames = items
    .map((it) => String(it?.name || '').trim())
    .filter(Boolean)
    .slice(0, 10)

  const menuLines = menuNames.length ? menuNames.map((n) => `${n} (${catName})`).join('\n') : ''

  const pillars = a.experiencePillars?.recommendedPillars || []
  const pillarsLines = Array.isArray(pillars) && pillars.length
    ? pillars.slice(0, 6)
        .map((p) => `- ${p.type}${p.why ? `: ${String(p.why).replace(/\s+/g, ' ').trim()}` : ''}`)
        .join('\n')
    : ''

  const hoursLines = Object.entries(openingHours)
    .map(([day, v]) => {
      const open = v?.open
      const close = v?.close
      const closed = v?.closed
      if (closed) return `- ${day}: Lukket`
      if (open && close) return `- ${day}: ${open}–${close}`
      return `- ${day}: (ukendt)`
    })
    .join('\n')

  const menuSection = menuLines
    ? `=== DRIFTSREGLER FOR INDHOLD ===
MENUPUNKTER (kopiér PRÆCIS, én pr. linje):
${menuLines}

REGLER FOR MENUPUNKTER (OBLIGATORISK):
- Idé 1 SKAL være menu-baseret og bruge PRÆCIS ÉT menupunkt fra listen ovenfor.
- 1–2 ideer MÅ gerne være ikke-menu-baserede (storytelling, vibe, location, daypart osv.).
  - For en ikke-menu-idé: sæt "menuItemUsed" til "" (tom streng).
- For en menu-idé: menuItemUsed skal være et eksakt match fra listen.
- Når et menupunkt bruges: hvis det er "RET (KATEGORI)", så brug kun "RET" i teksten (ingen kategori).
- Opfind aldrig retter.`
    : `=== DRIFTSREGLER FOR INDHOLD ===
INGEN MENUPUNKTER FUNDET:
- Lav 3 ikke-menu-baserede ideer (storytelling, vibe, location, daypart osv.).
- Sæt "menuItemUsed" til "" (tom streng) for alle ideer.
- Opfind ikke retter.`

  return `=== SPROG ===
PROMPT_SPROG: da

Skriv alt på dansk.

=== VIRKSOMHEDSKONTEKST ===
Navn: ${businessName}
Type: ${businessType}
Website: ${websiteUrl}
Nøgleord: ${keywords.join(', ')}

OPLEVELSESPILLER (EVIDENS):
REGLER: Brug disse som vinkel-kort, men opfind ikke claims/events.
${pillarsLines || '- (ingen piller fundet)'}

${menuSection}

ÅBNINGSTIDER:
${hoursLines}

BORDRESERVATION:
${bookingUrl}
REGLER:
- Mindst 1 idé SKAL indeholde en booking-CTA.
- Sæt URL’en på sin egen linje til sidst i teksten.

=== TONERAMMER (OBLIGATORISK) ===
Hold tonen venlig, lokal og jordnær. Ingen hype, ingen FOMO. Max 1 udråbstegn pr. idé.

=== OPGAVE ===
Generér 3 post-ideer. De skal have tydeligt forskellige vinkler og gerne udnytte daypart (brunch vs aften/cocktails).

=== OUTPUTFORMAT ===
Returnér KUN gyldig JSON i dette format:
{
  "ideas": [
    {
      "id": "idea-1",
      "title": "...",
      "headline": "...",
      "text": "...",
      "photoSuggestion": "...",
      "menuItemUsed": "...",
      "bestTimeToPost": "fx. Fredag 20:00–22:00",
      "impact": "low | medium | high"
    },
    {"id":"idea-2", "title":"...", "headline":"...", "text":"...", "photoSuggestion":"...", "menuItemUsed":"...", "bestTimeToPost":"...", "impact":"low | medium | high"},
    {"id":"idea-3", "title":"...", "headline":"...", "text":"...", "photoSuggestion":"...", "menuItemUsed":"...", "bestTimeToPost":"...", "impact":"low | medium | high"}
  ]
}`
}

// 1) Pull fresh analysis signals
const analysisResp = await postJson(`${baseUrl}/functions/v1/analyze-website`, {
  url: websiteUrl,
  tier,
})

if (!analysisResp.ok) {
  console.error('analyze-website failed', analysisResp.status)
  console.error(JSON.stringify(analysisResp.json, null, 2))
  process.exit(1)
}

const prompt = buildPromptFromAnalysis(analysisResp.json)

// 2) Call ai-generate
const ideasResp = await postJson(
  `${baseUrl}/functions/v1/ai-generate`,
  {
    mode: 'ai-ideas',
    prompt,
    count: 3,
    platforms: ['facebook', 'instagram'],
    tone: 'objective',
    length: 'medium',
    userTier,
  },
  { Authorization: `Bearer ${accessToken}` }
)

if (!ideasResp.ok) {
  console.error('ai-generate failed', ideasResp.status)
  console.error(JSON.stringify(ideasResp.json, null, 2))
  process.exit(1)
}

console.log(JSON.stringify(ideasResp.json, null, 2))
