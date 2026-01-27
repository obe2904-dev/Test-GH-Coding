import { describe, it, expect } from 'vitest';
import { detectCoreOfferings } from './offeringsDetector';
import type { StrategyDeductionInputs } from './types';

function baseInputs(partial: Partial<StrategyDeductionInputs>): StrategyDeductionInputs {
  return {
    menu: {
      categories: {},
      avgPrice: 120,
      hasAlcohol: false,
      hasTakeaway: false,
      foodPhilosophy: undefined,
      dietaryOptions: [],
      hasSpecialtyCoffee: false,
      hasWineList: false,
      ...(partial.menu ?? {})
    },
    hours: {
      opensWeekdays: true,
      opensWeekends: true,
      hasBreakfast: false,
      hasLunch: false,
      hasDinner: false,
      hasLateNight: false,
      ...(partial.hours ?? {})
    },
    location: {
      areaType: 'city_centre',
      categoryScores: {},
      neighborhood: '',
      marketingHooks: [],
      scoreSource: 'areaTypeOnly',
      ...(partial.location ?? {})
    },
    context: {
      season: 'winter',
      generatedAt: new Date().toISOString(),
      ...(partial.context ?? {})
    },
    businessType: partial.businessType ?? 'restaurant',
    locale: partial.locale ?? 'da-DK'
  };
}

describe('detectCoreOfferings (two-axis: availability + identity)', () => {
  it('late-night bar: wine present but no reinforcement -> wine is NOT core', () => {
    const inputs = baseInputs({
      businessType: 'bar',
      menu: {
        categories: {
          Vin: 10,
          Cocktails: 10,
          Snacks: 5
        },
        hasAlcohol: true
      },
      hours: {
        hasLateNight: true,
        hasDinner: true
      },
      location: {
        marketingHooks: []
      }
    });

    const result = detectCoreOfferings(inputs);

    expect(result.offerings).toContain('late_night_bar');
    expect(result.offerings).not.toContain('natural_wine_focus');

    const wineCandidate = result.offeringsFull?.find(c => c.id === 'natural_wine_focus');
    expect(wineCandidate?.availabilityScore).toBeGreaterThanOrEqual(0);
    expect(wineCandidate?.identityScore ?? 0).toBeLessThan(50);
  });

  it('wine bar: wine share high + explicit philosophy -> natural wine CAN be core', () => {
    const inputs = baseInputs({
      businessType: 'bar',
      menu: {
        categories: {
          Naturvin: 12,
          Flasker: 8,
          'Små retter': 4
        },
        hasAlcohol: true,
        foodPhilosophy: 'Vi fokuserer på naturvin og håndplukket udvalg fra små producenter.'
      },
      hours: {
        hasDinner: true
      },
      location: {
        marketingHooks: ['Naturvin i fokus – håndplukket og kurateret.']
      }
    });

    const result = detectCoreOfferings(inputs);

    expect(result.offerings).toContain('natural_wine_focus');
    const wineCandidate = result.offeringsFull?.find(c => c.id === 'natural_wine_focus');
    expect(wineCandidate?.eligible).toBe(true);
  });

  it('specialty coffee café: coffee share + specialty coffee signal + daytime hours -> specialty coffee core', () => {
    const inputs = baseInputs({
      businessType: 'cafe',
      menu: {
        categories: {
          Specialkaffe: 15,
          Kager: 5,
          Brunch: 2
        },
        hasSpecialtyCoffee: true,
        foodPhilosophy: undefined
      },
      hours: {
        hasBreakfast: true,
        hasLunch: true
      }
    });

    const result = detectCoreOfferings(inputs);

    expect(result.offerings).toContain('specialty_coffee');
    const coffee = result.offeringsFull?.find(c => c.id === 'specialty_coffee');
    expect(coffee?.eligible).toBe(true);
    expect(coffee?.identityScore ?? 0).toBeGreaterThanOrEqual(50);
  });

  it('regular restaurant: dinner heavy -> casual dinner core', () => {
    const inputs = baseInputs({
      businessType: 'restaurant',
      menu: {
        categories: {
          Hovedretter: 20,
          Forretter: 10,
          Dessert: 8
        },
        hasAlcohol: false
      },
      hours: {
        hasDinner: true
      }
    });

    const result = detectCoreOfferings(inputs);

    expect(result.offerings).toContain('casual_dinner');
    const dinner = result.offeringsFull?.find(c => c.id === 'casual_dinner');
    expect(dinner?.eligible).toBe(true);
  });
});
