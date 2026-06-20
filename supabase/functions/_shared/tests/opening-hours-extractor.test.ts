import { test, expect } from 'vitest'
import { extractKitchenCloseTime, extractOpeningHours } from '../opening-hours-extractor.ts'

const sampleHtml = `
  <section>
    <h2>ÅBNINGSTIDER</h2>
    <p>Mandag, tirsdag, onsdag, torsdag</p>
    <p>aften 17 – sent (køkkenet lukker kl. 21.30)</p>
    <p>Fredag, lørdag, søndag</p>
    <p>frokost 12 – 16</p>
    <p>aften 17 – sent (køkkenet lukker kl. 21.30, søndag 20.00)</p>
  </section>
`

test('extractKitchenCloseTime handles "køkkenet lukker"', () => {
  expect(extractKitchenCloseTime(sampleHtml)).toBe('21:30')
})

test('extractOpeningHours parses Kazo-style day and service lines', () => {
  const hours = extractOpeningHours(
    `
      <section>
        <h2>ÅBNINGSTIDER</h2>
        <p>Mandag, tirsdag, onsdag, torsdag aften 17 – sent (køkkenet lukker kl. 21.30)</p>
      </section>
    `,
    []
  )

  expect(hours.openingHours?.monday?.open).toBe('17:00')
  expect(hours.openingHours?.monday?.close).toBe('21:30')
  expect(hours.openingHours?.thursday?.open).toBe('17:00')
  expect(hours.openingHours?.thursday?.close).toBe('21:30')
})

test('extractOpeningHours flags conflicting opening-hours blocks for review', () => {
  const hours = extractOpeningHours(
    `
      <section>
        <h2>ÅBNINGSTIDER</h2>
        <p>Mandag - fredag 10 – 16</p>
      </section>
      <section>
        <h2>ÅBNINGSTIDER</h2>
        <p>Mandag - fredag 17 – sent</p>
      </section>
    `,
    []
  )

  expect(hours.reviewRequired).toBe(true)
  expect(hours.reviewReasons.length).toBeGreaterThan(0)
  expect(hours.openingHours?.monday?.open).toBe('17:00')
})