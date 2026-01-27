/**
 * Value Validators
 * 
 * Functions that check if field values are malformed or contain generic/placeholder text.
 * Used as safety checks before saving Brand Profile to database.
 */

export function isBadTargetAudienceValue(value: string): boolean {
  const v = value.trim()
  if (!v) return true
  const n = v.toLowerCase().replace(/\s+/g, ' ').trim()
  if (v.includes('?') || /\?$/.test(v)) return true
  if (n === 'hvem taler i til' || n.includes('hvem taler i til')) return true
  if (n.includes('who are you speaking to') || n.includes('who do you speak to')) return true
  return false
}

export function isBadCoreOfferingsValue(value: string): boolean {
  const v = value.trim()
  if (!v) return true
  const n = v.toLowerCase().replace(/\s+/g, ' ').trim()
  if (/(\.{3,}|…)/.test(v)) return true
  if (/\bjeres\b/i.test(v)) return true
  if (/\bhvem\b/i.test(v)) return true
  if (/\bperfekt\s+til\b/i.test(v)) return true
  if (n.includes('jeres primære produkter') || n.includes('produkter eller services')) return true
  return false
}

export function isBadContentFocusValue(value: string): boolean {
  const v = value.trim()
  if (!v) return true
  const lines = v.split('\n').map(l => l.trim()).filter(Boolean)
  const bulletCount = lines.filter(l => l.startsWith('- ')).length
  if (bulletCount >= 3) return false

  const n = v.toLowerCase().replace(/\s+/g, ' ').trim()
  const food = /\b(brunch|frokost|middag|aften|kaffe|menu|retter|mad|servering)\b/i.test(n)
  const atmosphere = /\b(stemning|atmosfære|vibe|interiør|indretning|lys|musik|bar)\b/i.test(n)
  const people = /\b(mennesker|gæster|team|øjeblik|momenter|tempo|hverdag|venner|date|familie)\b/i.test(n)
  const story = /\b(bts|bag\s+kulissen|fortæll|story|overgang|dag\s*→\s*aften|dag\s+til\s+aften)\b/i.test(n)
  const hits = [food, atmosphere, people, story].filter(Boolean).length
  return hits < 3
}

export function isBadCtaStyleValue(value: string): boolean {
  const v = value.trim()
  if (!v) return true
  const n = v.toLowerCase().replace(/\s+/g, ' ').trim()
  const primaryBooking = /\b(book|bordreserv|reserv|reservation|book\s+dit\s+bord|book\s+bord|reserve(r)?\s+bord)\b/i.test(n)
  const secondaryHit = [
    /\bse\s+menu(en)?\b/i,
    /\b(kig|kom)\s+(forbi|ind)\b/i,
    /\b(del|tag)\b/i,
    /\bfølg\s+med\b/i,
    /\bskriv\s+til\s+os\b/i,
  ].reduce((acc, re) => (re.test(n) ? acc + 1 : acc), 0)

  // Must have booking + 2+ soft options
  return !(primaryBooking && secondaryHit >= 2)
}
