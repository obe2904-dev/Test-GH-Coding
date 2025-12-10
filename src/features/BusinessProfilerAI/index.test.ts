import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolveBusinessProfilerFeature } from './index'

describe('SupabaseBusinessProfilerAI', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    if (originalFetch) {
      globalThis.fetch = originalFetch
    } else {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (globalThis as Record<string, unknown>).fetch
    }
  })

  it('returns an error when the url cannot be normalised to http/https', async () => {
    const profiler = resolveBusinessProfilerFeature()

    const result = await profiler.analyze({ url: 'ftp://example.com' })

    expect(result.error).toBe('The provided URL is invalid or unsupported')
    expect(result.url).toBe('ftp://example.com')
  })

  it('propagates failures when mocks are disabled', async () => {
    vi.stubEnv('VITE_BUSINESS_PROFILER_USE_MOCKS', 'false')

    const fetchMock = vi.fn<typeof fetch>()
    fetchMock.mockRejectedValue(new Error('network down'))
    globalThis.fetch = fetchMock

    const profiler = resolveBusinessProfilerFeature()
    const result = await profiler.analyze({ url: 'example.com' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
    const parsedBody = requestInit?.body ? JSON.parse(requestInit.body as string) : null
    expect(parsedBody?.url).toBe('https://example.com/')

    expect(result.error).toBe('network down')
    expect(result.businessName).toBeUndefined()
  })

  it('falls back to mock data when explicitly enabled', async () => {
    vi.stubEnv('VITE_BUSINESS_PROFILER_USE_MOCKS', 'true')

    const fetchMock = vi.fn<typeof fetch>()
    fetchMock.mockRejectedValue(new Error('network down'))
    globalThis.fetch = fetchMock

    const profiler = resolveBusinessProfilerFeature()
    const result = await profiler.analyze({ url: 'cafe.example.com' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.error).toBeUndefined()
    expect(result.businessName).toBe('Café Nørrebro')
    expect(result.offeringsProfile?.categories.length).toBeGreaterThan(0)
  })
})
