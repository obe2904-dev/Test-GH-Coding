import {
  classifyDetectedMenuSource,
  extractCanonicalMenuUrl,
  isFalsePositiveMenuUrl,
  isLikelyMenuSitemapUrl,
  normalizeMenuDiscoveryUrl,
} from './menu-detection-quality.ts'

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

Deno.test('Lava Google local reviews are rejected', () => {
  assertEquals(
    isFalsePositiveMenuUrl(
      'https://www.google.com/search?tbm=lcl&rldimm=123#lkt=LocalPoiReviews',
      'Google Reviews',
    ),
    true,
  )
})

Deno.test('Lava Webflow canonical collapses to the primary domain', () => {
  const html = '<link href="https://www.lavaaarhus.dk/mad" rel="canonical">'
  assertEquals(
    extractCanonicalMenuUrl(html, 'https://lava-57a9bf.webflow.io/menu#Full-Menu'),
    'https://www.lavaaarhus.dk/mad',
  )
})

Deno.test('Souk rendered PDF URL follows authoritative image MIME type', () => {
  assertEquals(
    classifyDetectedMenuSource(
      'https://media.uheadless.com/media/souk-menu.pdf?w=1600&page=1',
      'image/jpeg',
      'browser_discovery_image',
    ),
    'image',
  )
})

Deno.test('Valdemar sitemap menu paths are selected', () => {
  assertEquals(isLikelyMenuSitemapUrl('https://restaurantvaldemar.dk/frokost/'), true)
  assertEquals(isLikelyMenuSitemapUrl('https://restaurantvaldemar.dk/aften/'), true)
  assertEquals(isLikelyMenuSitemapUrl('https://restaurantvaldemar.dk/drikkevarer/'), true)
  assertEquals(isLikelyMenuSitemapUrl('https://restaurantvaldemar.dk/galleri/'), false)
})

Deno.test('meaningful render parameters are preserved while presentation width is removed', () => {
  assertEquals(
    normalizeMenuDiscoveryUrl('https://example.com/menu.pdf?w=1600&page=1&token=abc#menu'),
    'https://example.com/menu.pdf?page=1&token=abc',
  )
})
