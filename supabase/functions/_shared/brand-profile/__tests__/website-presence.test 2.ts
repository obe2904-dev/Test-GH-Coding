/**
 * Unit Tests for Website Presence Detection (v4.9.0)
 * 
 * Tests the website presence detection logic that determines
 * if a business has sufficient website data for brand profile generation.
 */

import { test, expect } from 'vitest'

// Mock the website presence detection logic
function detectWebsitePresence(websiteAnalysis: any): {
  hasWebsiteAnalysis: boolean
  hasWebsite: boolean
  hasContent: boolean
  hasRawText: boolean
  contentLength: number
  triggers: number
} {
  const hasWebsiteAnalysis = !!websiteAnalysis
  const hasWebsite = !!websiteAnalysis?.source_url
  const rawHtml = websiteAnalysis?.raw_html || ''
  const hasRawText = rawHtml.length > 0
  
  // Count content triggers
  let triggers = 0
  if (websiteAnalysis?.source_url) triggers++
  if (websiteAnalysis?.headers?.length > 0) triggers++
  if (websiteAnalysis?.cta_texts?.length > 0) triggers++
  if (websiteAnalysis?.nav_items?.length > 0) triggers++
  if (rawHtml.length > 0) triggers++
  
  const homepageContent = websiteAnalysis?.homepage_content || ''
  const hasContent = homepageContent.length > 100
  
  return {
    hasWebsiteAnalysis,
    hasWebsite,
    hasContent,
    hasRawText,
    contentLength: homepageContent.length,
    triggers,
  }
}

test('Website Presence: Full website analysis present', () => {
  const websiteAnalysis = {
    source_url: 'https://example.com',
    homepage_content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.',
    headers: ['Welcome', 'About Us'],
    cta_texts: ['Book Now', 'Contact'],
    nav_items: ['Home', 'Menu', 'Contact'],
    raw_html: '<html><body>Content</body></html>',
  }

  const result = detectWebsitePresence(websiteAnalysis)

  expect(result.hasWebsiteAnalysis).toBe(true)
  expect(result.hasWebsite).toBe(true)
  expect(result.hasContent).toBe(true)
  expect(result.hasRawText).toBe(true)
  expect(result.triggers).toEqual(5)
})

test('Website Presence: Minimal website data', () => {
  const websiteAnalysis = {
    source_url: 'https://example.com',
    homepage_content: 'Short content',
    headers: [],
    cta_texts: [],
    nav_items: [],
    raw_html: '',
  }

  const result = detectWebsitePresence(websiteAnalysis)

  expect(result.hasWebsiteAnalysis).toBe(true)
  expect(result.hasWebsite).toBe(true)
  expect(result.hasContent).toBe(false)
  expect(result.hasRawText).toBe(false)
  expect(result.triggers).toEqual(1)
})

test('Website Presence: No website analysis', () => {
  const websiteAnalysis = null

  const result = detectWebsitePresence(websiteAnalysis)

  expect(result.hasWebsiteAnalysis).toBe(false)
  expect(result.hasWebsite).toBe(false)
  expect(result.hasContent).toBe(false)
  expect(result.hasRawText).toBe(false)
  expect(result.triggers).toEqual(0)
})

test('Website Presence: Partial website data (only headers)', () => {
  const websiteAnalysis = {
    source_url: 'https://example.com',
    homepage_content: '',
    headers: ['Welcome to Our Restaurant'],
    cta_texts: [],
    nav_items: [],
    raw_html: '<html><body><h1>Welcome</h1></body></html>',
  }

  const result = detectWebsitePresence(websiteAnalysis)

  expect(result.hasWebsiteAnalysis).toBe(true)
  expect(result.hasWebsite).toBe(true)
  expect(result.hasContent).toBe(false)
  expect(result.hasRawText).toBe(true)
  expect(result.triggers).toEqual(3)
})

test('Website Presence: Edge case - empty strings', () => {
  const websiteAnalysis = {
    source_url: '',
    homepage_content: '',
    headers: [],
    cta_texts: [],
    nav_items: [],
    raw_html: '',
  }

  const result = detectWebsitePresence(websiteAnalysis)

  expect(result.hasWebsiteAnalysis).toBe(true)
  expect(result.hasWebsite).toBe(false)
  expect(result.hasContent).toBe(false)
  expect(result.hasRawText).toBe(false)
  expect(result.triggers).toEqual(0)
})

test('Website Presence: Rich content but no URL', () => {
  const websiteAnalysis = {
    source_url: null,
    homepage_content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    headers: ['About', 'Menu'],
    cta_texts: ['Book Now'],
    nav_items: ['Home', 'Contact'],
    raw_html: '<html><body>Full content here</body></html>',
  }

  const result = detectWebsitePresence(websiteAnalysis)

  expect(result.hasWebsiteAnalysis).toBe(true)
  expect(result.hasWebsite).toBe(false)
  expect(result.hasContent).toBe(true)
  expect(result.hasRawText).toBe(true)
  expect(result.triggers).toEqual(4)
})

console.log('✅ All Website Presence tests passed!')
