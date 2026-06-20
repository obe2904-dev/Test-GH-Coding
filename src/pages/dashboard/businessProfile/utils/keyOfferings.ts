const DETAIL_MAP: Array<{ pattern: RegExp; detail: string }> = [
  { pattern: /(pariserb[oø]f|parisarb[oø]f)/i, detail: 'klassisk dansk frokostret' },
  { pattern: /faustburger|burger/i, detail: 'signaturburger' },
  { pattern: /moules?\s+frites/i, detail: 'skaldyr med pommes frites' },
  { pattern: /(gammeldags\s+)?æblekage/i, detail: 'klassisk dessert' },
  { pattern: /faust\s+stormy/i, detail: 'signaturcocktail' },
  { pattern: /cocktail|drinks?/i, detail: 'signaturcocktail' },
  { pattern: /smørrebrød/i, detail: 'smørrebrød' },
  { pattern: /brunch/i, detail: 'brunchret' },
  { pattern: /frokost|lunch/i, detail: 'klassisk frokostret' },
  { pattern: /aften|middag|dinner/i, detail: 'aftensret' },
  { pattern: /salat/i, detail: 'salat' },
  { pattern: /pasta/i, detail: 'pastaret' },
  { pattern: /nachos?/i, detail: 'snack/shareplate' },
]

function compactText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function hasExistingDetail(line: string): boolean {
  return /\s[-–—:]\s/.test(line)
}

function enrichLine(line: string): string {
  const cleaned = compactText(line)
  if (!cleaned) return ''
  if (hasExistingDetail(cleaned)) return cleaned

  const detail = DETAIL_MAP.find((entry) => entry.pattern.test(cleaned))?.detail
  return detail ? `${cleaned} - ${detail}` : cleaned
}

export function enrichKeyOfferings(value: string | null | undefined): string {
  if (!value) return ''

  const lines = value
    .split(/\r?\n/)
    .map(enrichLine)
    .filter(Boolean)

  const seen = new Set<string>()
  const uniqueLines: string[] = []

  for (const line of lines) {
    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    uniqueLines.push(line)
  }

  return uniqueLines.join('\n')
}
