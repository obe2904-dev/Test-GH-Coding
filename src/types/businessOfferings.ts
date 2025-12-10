// src/types/businessOfferings.ts
// Business offerings structure for all sectors

import type { BusinessSector } from './businessSector'

export type OfferingItem = {
  id: string
  name: string
  short_desc?: string
  popular?: boolean
} & Record<string, unknown>

export type OfferingCategory = {
  id: string
  name: string
  items: OfferingItem[]
} & Record<string, unknown>

export type BusinessOfferingsProfile = {
  categories: OfferingCategory[]
} & Record<string, unknown>

// Helper to generate unique IDs
const makeId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`

/**
 * Get default offering categories based on business sector
 */
export const defaultOfferingsForSector = (sector: BusinessSector | null): BusinessOfferingsProfile => {
  switch (sector) {
    case 'hospitality':
      return {
        categories: [
          { id: makeId('drinks'), name: 'Drikkevarer (kaffe, vin, øl osv.)', items: [] },
          { id: makeId('food'), name: 'Mad / retter', items: [] },
          { id: makeId('sweet'), name: 'Kager / desserter', items: [] },
        ],
      }
    case 'beauty':
      return {
        categories: [
          { id: makeId('cuts'), name: 'Behandlinger (klip, farve, negle osv.)', items: [] },
          { id: makeId('products'), name: 'Produkter (shampoo, creme osv.)', items: [] },
        ],
      }
    case 'wellness':
      return {
        categories: [
          { id: makeId('treatments'), name: 'Behandlinger (massage, fysio osv.)', items: [] },
          { id: makeId('sessions'), name: 'Forløb / hold / sessioner', items: [] },
        ],
      }
    case 'retail':
      return {
        categories: [
          { id: makeId('main'), name: 'Produkter (fx tøj, smykker, interiør)', items: [] },
        ],
      }
    default:
      return { categories: [] }
  }
}
