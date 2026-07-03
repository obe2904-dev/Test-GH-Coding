import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import {
  collectText,
  wordCount,
  assertNoPersonas,
  assertNoUniversalForbidden,
} from './helpers/brandProfileTestUtils'
import { runForbiddenGate } from '../src/brand-profile/forbidden-gate'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadJson(p: string): any {
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

/**
 * Derives the expected location phrase from location.enrichment.
 * Mirrors the deterministic slot-filling in buildPromptB / index.ts.
 * Replace with an import of your actual renderLocationPhrase() if available.
 */
function expectedLocationPhraseFromEnrichment(enrichment: any): string | null {
  const area = enrichment?.micro?.area_type
  const nearby = enrichment?.micro?.nearby_signals?.[0]
  const city = enrichment?.macro?.city

  switch (area) {
    case 'waterfront':          return 'ved åen'
    case 'transit_hub':         return 'ved stationen'
    case 'pedestrian_zone':     return 'på gågaden'
    case 'shopping_street':     return 'på gågaden'
    case 'city_center':         return 'i centrum'
    case 'residential':
    case 'neighborhood':        return 'i kvarteret'
    case 'business_district':   return 'i centrum'
    case 'tourist_area':
      return nearby ? `ved ${nearby}`.toLowerCase() : 'i turistområdet'
    default:                    return null
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Brand Profile regression (snapshot, invariant-based)', () => {
  const fixturesDir  = path.resolve(process.cwd(), 'test/fixtures/brand-profile')
  const snapshotsDir = path.resolve(process.cwd(), 'test/snapshots/brand-profile')

  const fixtureFiles = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.json'))

  for (const f of fixtureFiles) {
    const fixtureName = f.replace('.json', '')

    it(fixtureName, () => {
      const fixture = loadJson(path.join(fixturesDir, f))
      const name: string = fixture.name

      // Skip gracefully until snapshot is populated
      const snapshotPath = path.join(snapshotsDir, `${name}.output.json`)
      if (!fs.existsSync(snapshotPath)) {
        console.warn(`⚠️  Snapshot missing for "${name}" — skipping. Run generation and save output to ${snapshotPath}`)
        return
      }

      const out  = loadJson(snapshotPath)
      const text = collectText(out)

      // -----------------------------------------------------------------------
      // INVARIANT 1: full 2.3 forbidden-phrase gate must pass
      // -----------------------------------------------------------------------
      expect(() => runForbiddenGate(out)).not.toThrow()

      // -----------------------------------------------------------------------
      // INVARIANT 2: brand_essence exists and is within word limit
      // -----------------------------------------------------------------------
      const essenceValue =
        out?.brand_essence?.value ?? (typeof out?.brand_essence === 'string' ? out.brand_essence : '')
      expect(essenceValue).toBeTruthy()
      expect(wordCount(essenceValue)).toBeLessThanOrEqual(24)

      // -----------------------------------------------------------------------
      // INVARIANT 3: no demographic personas in target_audience
      // -----------------------------------------------------------------------
      const audienceValue =
        out?.target_audience?.value ?? (typeof out?.target_audience === 'string' ? out.target_audience : '')
      expect(audienceValue).toBeTruthy()
      expect(() => assertNoPersonas(audienceValue)).not.toThrow()

      // -----------------------------------------------------------------------
      // INVARIANT 4: location phrase present in brand_essence (if enrichment exists)
      // -----------------------------------------------------------------------
      const enrichment  = fixture?.dataSources?.location?.enrichment
      const expectedLoc = expectedLocationPhraseFromEnrichment(enrichment)

      if (expectedLoc) {
        expect(essenceValue.toLowerCase()).toContain(expectedLoc)

        const signatureShot = out?.image_preferences?.signature_shot
        if (typeof signatureShot === 'string' && signatureShot) {
          // Partial match: "ved", "på", "i" is enough to confirm location is referenced
          expect(signatureShot.toLowerCase()).toContain(expectedLoc.split(' ')[0])
        }
      }

      // -----------------------------------------------------------------------
      // INVARIANT 5: at least one menu item name appears somewhere in output
      // -----------------------------------------------------------------------
      const menu: any[] = fixture?.dataSources?.menu ?? []
      const menuTokens = menu
        .map((m: any) => String(m?.name ?? '').trim().toLowerCase())
        .filter((s: string) => s.length >= 3)

      if (menuTokens.length > 0) {
        const hit = menuTokens.some(tok => text.includes(tok))
        expect(hit).toBe(true)
      }

      // -----------------------------------------------------------------------
      // INVARIANT 6: universal forbidden phrases not in full text (belt + suspenders)
      // -----------------------------------------------------------------------
      expect(() => assertNoUniversalForbidden(text, fixtureName)).not.toThrow()
    })
  }
})
