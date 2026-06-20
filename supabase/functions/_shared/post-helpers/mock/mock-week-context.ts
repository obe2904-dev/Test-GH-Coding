// ============================================================
// MOCK DATA FOR LAYER 0 TESTING (Phase 1 Only)
// Replace with real data pipeline in Phase 2
// ============================================================

import type { WeekContext } from '../types/strategy-types.ts';

/**
 * Mock: Café Faust, København
 * Week 7, 2026 (Feb 10-16)
 * Cold weather + Valentine's Day
 */
export const MOCK_WEEK_CONTEXT_CAFE_FAUST: WeekContext = {
  business_id: 'f4679fa9-3120-4a59-9506-d059b010c34a',
  week_number: 7,
  week_start: '2026-02-10',
  week_end: '2026-02-16',
  is_current_week: true,
  available_days: [
    '2026-02-10',
    '2026-02-11',
    '2026-02-12',
    '2026-02-13',
    '2026-02-14',
    '2026-02-15',
    '2026-02-16',
  ],

  weather: {
    days: [
      { date: '2026-02-10', temp_min: 1, temp_max: 4, condition: 'cloudy',       reliability: 'specific'  },
      { date: '2026-02-11', temp_min: 0, temp_max: 3, condition: 'cloudy',       reliability: 'specific'  },
      { date: '2026-02-12', temp_min: 1, temp_max: 5, condition: 'partly_cloudy',reliability: 'specific'  },
      { date: '2026-02-13', temp_min: 2, temp_max: 6, condition: 'rain',         reliability: 'specific'  },
      { date: '2026-02-14', temp_min: 3, temp_max: 7, condition: 'partly_cloudy',reliability: 'cautious'  },
      { date: '2026-02-15', temp_min: 4, temp_max: 8, condition: 'sunny',        reliability: 'cautious'  },
      { date: '2026-02-16', temp_min: 3, temp_max: 7, condition: 'partly_cloudy',reliability: 'cautious'  },
    ],
    pattern: 'cold_week',
    avg_temp: 4,
    has_outdoor_seating: true,
  },

  season: {
    current: 'winter',
    ingredients_in_season: ['kål', 'rodfrugter', 'selleri', 'porrer', 'æbler', 'pærer'],
    out_of_season: ['jordbær', 'hindbær', 'tomater', 'asparges'],
  },

  events: [
    {
      name: 'Valentine\'s Day',
      name_dk: 'Valentinsdag',
      date: '2026-02-14',
      days_away: 4,
      type: 'occasion',
      strategic_angle: 'Romantisk aften for to ved åen',
      recommended_lead_days: 3,
    },
  ],

  economic: {
    week_of_month: 2,
    pattern: 'normal_spend',
    is_july: false,
  },

  location: {
    type: 'waterfront',
    has_outdoor_seating: true,
    is_july_tourist_boost: false,
  },

  business_name: 'Café Faust',
  business_type: 'FSE',
  service_periods: ['brunch', 'lunch', 'dinner'],
  signature_items: [
    { name: 'Faust Gryde', description: 'Husets gryde med sæsonens grøntsager og braiseret kød', category: 'AFTENSMAD', isSignature: true },
    { name: 'Pariserbøf', description: 'Hakket bøf med spejlæg, kapers og løg', category: 'FROKOST', isSignature: true },
    { name: 'Dagens Suppe', description: 'Skiftende daglig suppe serveret med brød', category: 'FROKOST' },
    { name: 'Brunch Buffet', description: 'Buffet med æg, bacon, brød og tilbehør', category: 'BRUNCH' },
  ],
  country: 'DK',
  city: 'København',

  previous_week: {
    top_post: {
      content_summary: 'Pariserbøf med pommes frites',
      likes: 234,
      engagement_rate: 8.2,
      performance_vs_avg: 1.54,
      content_type: 'menu_item',
    },
    posted_menu_items: ['Pariserbøf', 'Brunch Buffet', 'Dagens Suppe'],
    posted_content_types: ['menu_item', 'atmosphere', 'behind_scenes'],
    data_available: true, // Set false until FB/IG API integrated in production
  },
};

/**
 * Mock: Vinhuset Nord, Aarhus
 * Wine bar, cold week, no major events
 */
export const MOCK_WEEK_CONTEXT_WINE_BAR: WeekContext = {
  business_id: 'mock-wine-bar-id',
  week_number: 7,
  week_start: '2026-02-10',
  week_end: '2026-02-16',
  is_current_week: true,
  available_days: ['2026-02-10','2026-02-11','2026-02-12','2026-02-13','2026-02-14','2026-02-15','2026-02-16'],

  weather: {
    days: [
      { date: '2026-02-10', temp_min: 0, temp_max: 3, condition: 'cloudy',       reliability: 'specific' },
      { date: '2026-02-11', temp_min: -1, temp_max: 2, condition: 'cloudy',      reliability: 'specific' },
      { date: '2026-02-12', temp_min: 0, temp_max: 4, condition: 'partly_cloudy',reliability: 'specific' },
      { date: '2026-02-13', temp_min: 1, temp_max: 5, condition: 'rain',         reliability: 'specific' },
      { date: '2026-02-14', temp_min: 2, temp_max: 6, condition: 'cloudy',       reliability: 'cautious' },
      { date: '2026-02-15', temp_min: 3, temp_max: 7, condition: 'partly_cloudy',reliability: 'cautious' },
      { date: '2026-02-16', temp_min: 2, temp_max: 6, condition: 'cloudy',       reliability: 'cautious' },
    ],
    pattern: 'cold_week',
    avg_temp: 3,
    has_outdoor_seating: false,
  },

  season: { current: 'winter', ingredients_in_season: ['kål', 'rodfrugter'], out_of_season: ['jordbær'] },

  events: [
    {
      name: 'Valentine\'s Day',
      name_dk: 'Valentinsdag',
      date: '2026-02-14',
      days_away: 4,
      type: 'occasion',
      strategic_angle: 'Romantisk vinpairing for to',
      recommended_lead_days: 3,
    },
  ],

  economic: { week_of_month: 2, pattern: 'normal_spend', is_july: false },

  location: { type: 'city_center', has_outdoor_seating: false, is_july_tourist_boost: false },

  business_name: 'Vinhuset Nord',
  business_type: 'SBO_wine',
  service_periods: ['afternoon', 'evening'],
  signature_items: [
    { name: 'Châteauneuf-du-Pape', description: 'Klassisk sydfransk rødvin fra Rhône', category: 'VIN', isSignature: true },
    { name: 'Naturvin-selektion', description: 'Kurateret udvalg af biodynamiske vine', category: 'VIN' },
    { name: 'Oste-vinboard', description: 'Udvalgte oste serveret med tilbehør og anbefalet vin', category: 'SNACKS' },
  ],
  country: 'DK',
  city: 'Aarhus',

  previous_week: {
    data_available: false, // FB/IG API not yet integrated
    posted_menu_items: ['Naturvin fra Loire'],
    posted_content_types: ['atmosphere', 'menu_item'],
  },
};

/**
 * Mock: Coffee & Wine (Hybrid), København
 * Coffee in morning, wine in evening
 */
export const MOCK_WEEK_CONTEXT_HYBRID: WeekContext = {
  business_id: 'mock-hybrid-id',
  week_number: 7,
  week_start: '2026-02-10',
  week_end: '2026-02-16',
  is_current_week: true,
  available_days: ['2026-02-10','2026-02-11','2026-02-12','2026-02-13','2026-02-14','2026-02-15','2026-02-16'],

  weather: {
    days: [
      { date: '2026-02-10', temp_min: 1, temp_max: 4, condition: 'cloudy',       reliability: 'specific'  },
      { date: '2026-02-11', temp_min: 0, temp_max: 3, condition: 'cloudy',       reliability: 'specific'  },
      { date: '2026-02-12', temp_min: 1, temp_max: 5, condition: 'partly_cloudy',reliability: 'specific'  },
      { date: '2026-02-13', temp_min: 2, temp_max: 6, condition: 'rain',         reliability: 'specific'  },
      { date: '2026-02-14', temp_min: 3, temp_max: 7, condition: 'partly_cloudy',reliability: 'cautious'  },
      { date: '2026-02-15', temp_min: 4, temp_max: 8, condition: 'sunny',        reliability: 'cautious'  },
      { date: '2026-02-16', temp_min: 3, temp_max: 7, condition: 'partly_cloudy',reliability: 'cautious'  },
    ],
    pattern: 'cold_week',
    avg_temp: 4,
    has_outdoor_seating: true,
  },

  season: {
    current: 'winter',
    ingredients_in_season: ['kål', 'rodfrugter'],
    out_of_season: ['jordbær'],
  },

  events: [
    {
      name: 'Valentine\'s Day',
      name_dk: 'Valentinsdag',
      date: '2026-02-14',
      days_away: 4,
      type: 'occasion',
      strategic_angle: 'Romantisk aften med vin',
      recommended_lead_days: 3,
    },
  ],

  economic: {
    week_of_month: 2,
    pattern: 'normal_spend',
    is_july: false,
  },

  location: {
    type: 'city_center',
    has_outdoor_seating: true,
    is_july_tourist_boost: false,
  },

  business_name: 'Coffee & Wine',
  business_type: 'HYBRID',
  hybrid: {
    types: ['SBO_coffee', 'SBO_wine'],
    weights: {
      'SBO_coffee': 0.6,  // 60% coffee (morning focus)
      'SBO_wine': 0.4,    // 40% wine (evening focus)
    },
    derivedFrom: 'service_periods',
  },
  service_periods: ['morning', 'afternoon', 'evening'],
  signature_items: [
    { name: 'Latte', description: 'Espresso med dampet mælk', category: 'KAFFE' },
    { name: 'Flat White', description: 'Dobbelt espresso med silkeblød mikrodamp', category: 'KAFFE', isSignature: true },
    { name: 'Naturvin-selektion', description: 'Kurateret udvalg af naturvine til aftenen', category: 'VIN' },
    { name: 'Vin & Snacks', description: 'Glas naturvin med husets udvalgte snacks', category: 'VIN' },
  ],
  country: 'DK',
  city: 'København',

  previous_week: {
    data_available: false,
    posted_menu_items: ['Morgenskaffe', 'Vintips'],
    posted_content_types: ['menu_item', 'atmosphere'],
  },
};
