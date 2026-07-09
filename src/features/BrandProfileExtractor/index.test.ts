// src/features/BrandProfileExtractor/index.test.ts
// Tests for brand signal extraction logic

import { describe, it, expect } from 'vitest'
import { extractBrandSignals } from './index'
import type { BusinessOfferingsProfile } from '../../types/businessOfferings'
import type { WeekSchedule } from '../../types/businessProfile'

describe('BrandProfileExtractor', () => {
  describe('Alcohol Detection', () => {
    it('detects alcohol from category name', () => {
      const offerings: BusinessOfferingsProfile = {
        categories: [
          {
            id: 'cat-1',
            name: 'Drikkevarer (vin, øl)',
            items: [{ id: 'item-1', name: 'Kaffe' }]
          }
        ]
      }

      const openingHours: WeekSchedule = {
        man: { open: '08:00', close: '16:00' },
        tir: { open: '08:00', close: '16:00' },
        ons: { open: '08:00', close: '16:00' },
        tor: { open: '08:00', close: '16:00' },
        fre: { open: '08:00', close: '16:00' },
        lør: { open: '09:00', close: '15:00' },
        søn: { open: '', close: '' }
      }

      const signals = extractBrandSignals({
        businessOfferings: offerings,
        openingHours,
        businessSector: 'hospitality'
      })

      expect(signals.has_alcohol).toBe(true)
    })

    it('detects alcohol from item name', () => {
      const offerings: BusinessOfferingsProfile = {
        categories: [
          {
            id: 'cat-1',
            name: 'Drikkevarer',
            items: [
              { id: 'item-1', name: 'Rødvin' },
              { id: 'item-2', name: 'Hvidvin' }
            ]
          }
        ]
      }

      const openingHours: WeekSchedule = {
        man: { open: '08:00', close: '16:00' },
        tir: { open: '08:00', close: '16:00' },
        ons: { open: '08:00', close: '16:00' },
        tor: { open: '08:00', close: '16:00' },
        fre: { open: '08:00', close: '16:00' },
        lør: { open: '', close: '' },
        søn: { open: '', close: '' }
      }

      const signals = extractBrandSignals({
        businessOfferings: offerings,
        openingHours,
        businessSector: 'hospitality'
      })

      expect(signals.has_alcohol).toBe(true)
    })

    it('returns false when no alcohol detected', () => {
      const offerings: BusinessOfferingsProfile = {
        categories: [
          {
            id: 'cat-1',
            name: 'Kaffe og te',
            items: [
              { id: 'item-1', name: 'Espresso' },
              { id: 'item-2', name: 'Cappuccino' }
            ]
          }
        ]
      }

      const openingHours: WeekSchedule = {
        man: { open: '07:00', close: '15:00' },
        tir: { open: '07:00', close: '15:00' },
        ons: { open: '07:00', close: '15:00' },
        tor: { open: '07:00', close: '15:00' },
        fre: { open: '07:00', close: '15:00' },
        lør: { open: '', close: '' },
        søn: { open: '', close: '' }
      }

      const signals = extractBrandSignals({
        businessOfferings: offerings,
        openingHours,
        businessSector: 'hospitality'
      })

      expect(signals.has_alcohol).toBe(false)
    })
  })

  describe('Opening Hours Analysis', () => {
    it('detects early opening', () => {
      const offerings: BusinessOfferingsProfile = { categories: [] }
      const openingHours: WeekSchedule = {
        man: { open: '06:30', close: '15:00' },
        tir: { open: '06:30', close: '15:00' },
        ons: { open: '06:30', close: '15:00' },
        tor: { open: '06:30', close: '15:00' },
        fre: { open: '06:30', close: '15:00' },
        lør: { open: '', close: '' },
        søn: { open: '', close: '' }
      }

      const signals = extractBrandSignals({
        businessOfferings: offerings,
        openingHours,
        businessSector: 'hospitality'
      })

      expect(signals.opens_early).toBe(true)
    })

    it('detects late closing', () => {
      const offerings: BusinessOfferingsProfile = { categories: [] }
      const openingHours: WeekSchedule = {
        man: { open: '17:00', close: '23:00' },
        tir: { open: '17:00', close: '23:00' },
        ons: { open: '17:00', close: '23:00' },
        tor: { open: '17:00', close: '23:00' },
        fre: { open: '17:00', close: '01:00' },
        lør: { open: '17:00', close: '01:00' },
        søn: { open: '', close: '' }
      }

      const signals = extractBrandSignals({
        businessOfferings: offerings,
        openingHours,
        businessSector: 'hospitality'
      })

      expect(signals.closes_late).toBe(true)
    })

    it('detects breakfast mode', () => {
      const offerings: BusinessOfferingsProfile = { categories: [] }
      const openingHours: WeekSchedule = {
        man: { open: '07:00', close: '14:00' },
        tir: { open: '07:00', close: '14:00' },
        ons: { open: '07:00', close: '14:00' },
        tor: { open: '07:00', close: '14:00' },
        fre: { open: '07:00', close: '14:00' },
        lør: { open: '08:00', close: '14:00' },
        søn: { open: '', close: '' }
      }

      const signals = extractBrandSignals({
        businessOfferings: offerings,
        openingHours,
        businessSector: 'hospitality'
      })

      expect(signals.dominant_usage_mode).toBe('breakfast')
    })

    it('detects dinner mode', () => {
      const offerings: BusinessOfferingsProfile = { categories: [] }
      const openingHours: WeekSchedule = {
        man: { open: '17:00', close: '22:00' },
        tir: { open: '17:00', close: '22:00' },
        ons: { open: '17:00', close: '22:00' },
        tor: { open: '17:00', close: '22:00' },
        fre: { open: '17:00', close: '23:00' },
        lør: { open: '17:00', close: '23:00' },
        søn: { open: '17:00', close: '22:00' }
      }

      const signals = extractBrandSignals({
        businessOfferings: offerings,
        openingHours,
        businessSector: 'hospitality'
      })

      expect(signals.dominant_usage_mode).toBe('dinner')
    })
  })

  describe('Target Audience Inference (Permissive)', () => {
    it('infers Professionals from early opening', () => {
      const offerings: BusinessOfferingsProfile = { categories: [] }
      const openingHours: WeekSchedule = {
        man: { open: '07:00', close: '17:00' },
        tir: { open: '07:00', close: '17:00' },
        ons: { open: '07:00', close: '17:00' },
        tor: { open: '07:00', close: '17:00' },
        fre: { open: '07:00', close: '17:00' },
        lør: { open: '', close: '' },
        søn: { open: '', close: '' }
      }

      const signals = extractBrandSignals({
        businessOfferings: offerings,
        openingHours,
        businessSector: 'hospitality',
        city: 'København'
      })

      expect(signals.target_audiences).toContain('Professionals')
    })

    it('infers Young adults from late closing and alcohol', () => {
      const offerings: BusinessOfferingsProfile = {
        categories: [
          {
            id: 'cat-1',
            name: 'Cocktails',
            items: [{ id: 'item-1', name: 'Mojito' }]
          }
        ]
      }

      const openingHours: WeekSchedule = {
        man: { open: '', close: '' },
        tir: { open: '', close: '' },
        ons: { open: '', close: '' },
        tor: { open: '18:00', close: '23:00' },
        fre: { open: '18:00', close: '02:00' },
        lør: { open: '18:00', close: '02:00' },
        søn: { open: '', close: '' }
      }

      const signals = extractBrandSignals({
        businessOfferings: offerings,
        openingHours,
        businessSector: 'hospitality'
      })

      expect(signals.target_audiences).toContain('Young adults')
    })

    it('infers Tourists from large city location', () => {
      const offerings: BusinessOfferingsProfile = { categories: [] }
      const openingHours: WeekSchedule = {
        man: { open: '10:00', close: '18:00' },
        tir: { open: '10:00', close: '18:00' },
        ons: { open: '10:00', close: '18:00' },
        tor: { open: '10:00', close: '18:00' },
        fre: { open: '10:00', close: '18:00' },
        lør: { open: '10:00', close: '18:00' },
        søn: { open: '10:00', close: '18:00' }
      }

      const signals = extractBrandSignals({
        businessOfferings: offerings,
        openingHours,
        businessSector: 'retail',
        city: 'Copenhagen'
      })

      expect(signals.target_audiences).toContain('Tourists')
    })

    it('always includes Locals as fallback', () => {
      const offerings: BusinessOfferingsProfile = { categories: [] }
      const openingHours: WeekSchedule = {
        man: { open: '', close: '' },
        tir: { open: '', close: '' },
        ons: { open: '', close: '' },
        tor: { open: '', close: '' },
        fre: { open: '', close: '' },
        lør: { open: '', close: '' },
        søn: { open: '', close: '' }
      }

      const signals = extractBrandSignals({
        businessOfferings: offerings,
        openingHours,
        businessSector: null
      })

      expect(signals.target_audiences).toContain('Locals')
    })
  })

  describe('Dietary Options Detection', () => {
    it('detects vegan options', () => {
      const offerings: BusinessOfferingsProfile = {
        categories: [
          {
            id: 'cat-1',
            name: 'Mad',
            items: [
              { id: 'item-1', name: 'Vegan burger' },
              { id: 'item-2', name: 'Vegetarisk pizza' }
            ]
          }
        ]
      }

      const openingHours: WeekSchedule = {
        man: { open: '11:00', close: '21:00' },
        tir: { open: '11:00', close: '21:00' },
        ons: { open: '11:00', close: '21:00' },
        tor: { open: '11:00', close: '21:00' },
        fre: { open: '11:00', close: '21:00' },
        lør: { open: '11:00', close: '21:00' },
        søn: { open: '', close: '' }
      }

      const signals = extractBrandSignals({
        businessOfferings: offerings,
        openingHours,
        businessSector: 'hospitality'
      })

      expect(signals.dietary_options).toContain('vegan')
      expect(signals.dietary_options).toContain('vegetar')
    })
  })
})
