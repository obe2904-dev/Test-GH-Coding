/**
 * Approved Danish CTAs (Call-to-Actions)
 * 
 * Pre-vetted, modern Danish CTA phrases for social media posts.
 * These replace AI-generated CTAs to ensure consistent quality and modern language.
 * 
 * QUALITY STANDARDS:
 * - No archaic phrases ("hop forbi", "går på hæld", etc.)
 * - Modern, conversational Danish
 * - Clear intent (booking vs walk-in)
 * - Variety to prevent repetition
 * 
 * @version 1.0
 * @date 2026-07-06
 */

/**
 * Booking CTAs - for businesses that accept or require reservations
 * Use when bookingLink is available or reservationRequired is true
 */
export const APPROVED_BOOKING_CTAS = [
  'Book bord i dag, og glæd dig til god mad.',
  'Sikr dig et bord — vi glæder os til at se dig.',
  'Reserver dit bord, før pladserne ryger.',
  'Book nu, og lad os tage os af resten.',
  'Planlæg dit næste besøg allerede i dag — book her.',
  'Skal du med? Book dit bord nu.',
  'Gør aftenen nem — reserver bord på forhånd.',
  'Find din plads hos os, og book bord i dag.',
  'Book bord, og glæd dig til hyggelig stemning.',
  'Vil du være sikker på en plads? Reservér nu.',
  'Saml dem, du holder af, og book et bord.',
  'Næste gode måltid starter med en booking.',
  'Reserver bord, og gør noget godt for dig selv.',
  'Book dit bord, og kom sulten.',
  'Vi gemmer gerne en plads til dig — book her.',
  'Gør weekenden lidt bedre — book bord nu.',
  'Skal vi dække op til dig? Book dit bord.',
  'Tag vennerne med, og sikr jer et bord sammen.',
  'Book en hyggelig stund hos os i aften.',
  'Reserver dit bord — din næste madoplevelse venter.',
]

/**
 * Walk-in CTAs - for casual visits without reservations
 * Use when acceptsWalkIns is true and no booking pressure
 */
export const APPROVED_WALKIN_CTAS = [
  'Kig forbi, når sulten melder sig.',
  'Kom forbi og gør dagen lidt lækrere.',
  'Kom forbi og smag selv.',
  'Tag en ven med og kig ind.',
  'Und dig selv lidt hverdagsforkælelse — kig ind i dag.',
  'Vi står klar med noget godt til dig.',
  'Kig ind — vi har sørget for hyggen.',
  'Kom sulten, gå mæt — vi klarer resten.',
  'Tag én, du holder af, med til en god stund hos os.',
  'Kom forbi, når du trænger til noget lækkert.',
  'Kom og find din nye favorit på menuen.',
  'Forkæl dig selv med et besøg hos os.',
  'Tag appetitten med — vi klarer resten.',
  'Kig ind og få en smagsoplevelse ud over det sædvanlige.',
  'Læg vejen forbi og oplev god stemning og godt selskab.',
  'Vi har noget godt klar — kom og hent det.',
  'Kom som du er — vi sørger for resten.',
  'Din næste gode spiseoplevelse venter her — kig ind.',
  'Kom forbi og nyd en stund uden at booke bord.',
  'Læg vejen forbi i dag — vi glæder os til at se dig.',
]

/**
 * Get a random CTA from the appropriate list
 */
export function getRandomApprovedCTA(type: 'booking' | 'walk_in'): string {
  const pool = type === 'booking' ? APPROVED_BOOKING_CTAS : APPROVED_WALKIN_CTAS
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * Get multiple random CTAs (no duplicates)
 */
export function getRandomApprovedCTAs(type: 'booking' | 'walk_in', count: number): string[] {
  const pool = type === 'booking' ? APPROVED_BOOKING_CTAS : APPROVED_WALKIN_CTAS
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(count, pool.length))
}
