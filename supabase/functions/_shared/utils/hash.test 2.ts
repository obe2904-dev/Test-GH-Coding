/**
 * Hash Utility Tests
 * 
 * Tests for stable JSON hashing and comparison functions.
 */

import { test, expect } from 'vitest'
import { stableJsonString, jsonEquals, stableJsonHashAsync } from './hash.ts'

// ============================================================================
// stableJsonString() Tests
// ============================================================================

test('stableJsonString - same object different key order', () => {
  const obj1 = { a: 1, b: 2, c: 3 }
  const obj2 = { c: 3, a: 1, b: 2 }
  
  expect(stableJsonString(obj1)).toEqual(stableJsonString(obj2))
})

test('stableJsonString - nested objects with different key order', () => {
  const obj1 = { outer: { a: 1, b: { x: 10, y: 20 } } }
  const obj2 = { outer: { b: { y: 20, x: 10 }, a: 1 } }
  
  expect(stableJsonString(obj1)).toEqual(stableJsonString(obj2))
})

test('stableJsonString - different objects produce different strings', () => {
  const obj1 = { a: 1, b: 2 }
  const obj2 = { a: 1, b: 3 }
  
  const hash1 = stableJsonString(obj1)
  const hash2 = stableJsonString(obj2)
  
  expect(hash1).not.toEqual(hash2)
})

test('stableJsonString - arrays maintain order', () => {
  const obj1 = { items: [1, 2, 3] }
  const obj2 = { items: [3, 2, 1] }
  
  const hash1 = stableJsonString(obj1)
  const hash2 = stableJsonString(obj2)
  
  expect(hash1).not.toEqual(hash2)
})

test('stableJsonString - null and undefined handling', () => {
  const obj1 = { a: null, b: undefined }
  const obj2 = { b: undefined, a: null }
  
  expect(stableJsonString(obj1)).toEqual(stableJsonString(obj2))
})

// ============================================================================
// jsonEquals() Tests
// ============================================================================

test('jsonEquals - equal objects with different key order', () => {
  const obj1 = { city: 'Aarhus', area_type: 'waterfront' }
  const obj2 = { area_type: 'waterfront', city: 'Aarhus' }
  
  expect(jsonEquals(obj1, obj2)).toBe(true)
})

test('jsonEquals - different objects', () => {
  const obj1 = { city: 'Aarhus', area_type: 'waterfront' }
  const obj2 = { city: 'København', area_type: 'waterfront' }
  
  expect(jsonEquals(obj1, obj2)).toBe(false)
})

test('jsonEquals - nested objects', () => {
  const obj1 = { macro: { city: 'Aarhus', city_tier: 'major_city' }, micro: { area_type: 'waterfront' } }
  const obj2 = { micro: { area_type: 'waterfront' }, macro: { city_tier: 'major_city', city: 'Aarhus' } }
  
  expect(jsonEquals(obj1, obj2)).toBe(true)
})

// ============================================================================
// stableJsonHashAsync() Tests
// ============================================================================

test('stableJsonHashAsync - deterministic hashing', async () => {
  const obj = { city: 'Aarhus', area_type: 'waterfront', confidence: 'high' }
  
  const hash1 = await stableJsonHashAsync(obj)
  const hash2 = await stableJsonHashAsync(obj)
  
  expect(hash1).toEqual(hash2)
})

test('stableJsonHashAsync - produces 64-character hex string', async () => {
  const obj = { test: 'data' }
  const hash = await stableJsonHashAsync(obj)
  
  // SHA-256 produces 64 hex characters
  expect(hash.length).toEqual(64)
  expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true)
})

test('stableJsonHashAsync - different objects produce different hashes', async () => {
  const obj1 = { city: 'Aarhus' }
  const obj2 = { city: 'København' }
  
  const hash1 = await stableJsonHashAsync(obj1)
  const hash2 = await stableJsonHashAsync(obj2)
  
  expect(hash1).not.toEqual(hash2)
})

// ============================================================================
// Real-World LocationEnrichment Tests
// ============================================================================

test('Real-world - LocationEnrichment comparison (same data)', () => {
  const enrichment1 = {
    version: '1.0',
    macro: { country: 'Denmark', city: 'Aarhus', city_tier: 'major_city' },
    micro: { area_type: 'waterfront', nearby_signals: ['waterfront (å)', 'scenic views likely'], confidence: 'high' }
  }
  
  const enrichment2 = {
    version: '1.0',
    micro: { confidence: 'high', area_type: 'waterfront', nearby_signals: ['waterfront (å)', 'scenic views likely'] },
    macro: { city_tier: 'major_city', country: 'Denmark', city: 'Aarhus' }
  }
  
  expect(jsonEquals(enrichment1, enrichment2)).toBe(true)
})

test('Real-world - LocationEnrichment comparison (different confidence)', () => {
  const enrichment1 = {
    version: '1.0',
    macro: { country: 'Denmark', city: 'Aarhus', city_tier: 'major_city' },
    micro: { area_type: 'waterfront', nearby_signals: ['waterfront (å)'], confidence: 'high' }
  }
  
  const enrichment2 = {
    version: '1.0',
    macro: { country: 'Denmark', city: 'Aarhus', city_tier: 'major_city' },
    micro: { area_type: 'waterfront', nearby_signals: ['waterfront (å)'], confidence: 'medium' }
  }
  
  expect(jsonEquals(enrichment1, enrichment2)).toBe(false)
})

test('Real-world - LocationEnrichment comparison (different signals)', () => {
  const enrichment1 = {
    version: '1.0',
    macro: { country: 'Denmark', city: 'Aarhus', city_tier: 'major_city' },
    micro: { area_type: 'waterfront', nearby_signals: ['waterfront (å)', 'scenic views'], confidence: 'high' }
  }
  
  const enrichment2 = {
    version: '1.0',
    macro: { country: 'Denmark', city: 'Aarhus', city_tier: 'major_city' },
    micro: { area_type: 'waterfront', nearby_signals: ['waterfront (å)', 'tourist appeal'], confidence: 'high' }
  }
  
  expect(jsonEquals(enrichment1, enrichment2)).toBe(false)
})
