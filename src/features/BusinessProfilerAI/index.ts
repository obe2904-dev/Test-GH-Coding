// src/features/BusinessProfilerAI/index.ts
// Business Profile AI for web scraping and analysis

//
// Nye typer til sektor og offerings – local to this file (du kan
// altid flytte dem til en fælles types-fil senere)
//

export type BusinessSector = 'hospitality' | 'beauty' | 'wellness' | 'retail'

export type OfferingItem = {
  id: string
  name: string
  short_desc?: string
  popular?: boolean
}

export type OfferingCategory = {
  id: string
  name: string
  items: OfferingItem[]
}

export type BusinessOfferingsProfile = {
  categories: OfferingCategory[]
}

//
// Eksisterende interface udvidet med nye, optionale felter
//

export interface BusinessProfileAnalysis {
  url: string
  businessName?: string
  businessType?: string
  description?: string
  shortDescription?: string  // NEW: Homepage "about" text for Om forretningen tab
  logoUrl?: string
  openingHours?: {
    [key: string]: { open: string; close: string; closed?: boolean }
  }
  offerings?: {
    categories?: string[]  // Legacy format (may still be used)
    signatureItems?: string[]  // Legacy format
    menuStructure?: Array<{  // NEW structured format
      name: string
      timeRange: string | null
      items: string[]
    }>
    dietaryOptions?: string[]
  }
  contact?: {
    phone?: string
    email?: string
    address?:
      | string
      | {
          street?: string
          city?: string
          postalCode?: string
          country?: string
        }
  }
  takeaway?: boolean | null
  outdoorSeating?: boolean | null
  wifi?: boolean | null
  powerOutlets?: boolean | null
  parking?: boolean | null
  establishmentType?: 'FSE' | 'SBO' | null  // FSE = Full-Service Establishment, SBO = Specialized Beverage Outlet
  menuUrl?: string
  bookingUrl?: string
  keywords?: string[]
  detectedPDFs?: Array<{
    url: string
    type: string
    name: string
  }>
  detectedMenuUrls?: string[]  // NEW: Menu URLs detected by AI for user confirmation (Menukort tab)

  // NYT – matcher dine nye felter i Business Profile
  businessSector?: BusinessSector
  offeringsProfile?: BusinessOfferingsProfile

  error?: string
  loading?: boolean
}

export interface BusinessProfileContext {
  url: string
  businessName?: string
  businessType?: string
  location?: { city?: string }
  authToken?: string
  tier?: string
  businessId?: string // Optional: enables server-side persistence
}

// Deterministic helpers so generated IDs stay stable between renders
const hashString = (input: string) => {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

const makeStableId = (prefix: string, seed: string) => `${prefix}-${hashString(`${prefix}-${seed}`)}`

// Client-side implementation that calls the Supabase Edge Function '/functions/v1/analyze-website'
// Falls back to mock data if the network call fails (for offline development)
class SupabaseBusinessProfilerAI {
  private endpoint: string
  private useMockFallback: boolean
  private debug: boolean

  constructor(endpoint?: string) {
    const envEndpoint = import.meta.env.VITE_SUPABASE_FUNCTION_ANALYZE_WEBSITE as
      | string
      | undefined
    this.endpoint = endpoint ?? envEndpoint ?? ''
    this.useMockFallback = Boolean(
      import.meta.env.DEV && import.meta.env.VITE_BUSINESS_PROFILER_USE_MOCKS === 'true'
    )
    this.debug = Boolean(
      import.meta.env.DEV && import.meta.env.VITE_BUSINESS_PROFILER_DEBUG === 'true'
    )
  }

  async analyze(ctx: BusinessProfileContext): Promise<BusinessProfileAnalysis> {
    const normalizedUrl = this.normalizeUrl(ctx.url)

    if (!normalizedUrl) {
      return {
        url: ctx.url,
        error: 'The provided URL is invalid or unsupported'
      }
    }

    if (this.debug) {
      console.log('🔍 BusinessProfilerAI.analyze() called with:', {
        url: normalizedUrl,
        businessName: ctx.businessName,
        businessType: ctx.businessType
      })
      console.log('📡 Endpoint configured:', this.endpoint)
    }

    // If no endpoint configured, fallback to mock data
    if (!this.endpoint) {
      if (this.useMockFallback) {
        if (this.debug) {
          console.warn('⚠️ No endpoint configured, using mock fallback')
        }
        const fallback = this.mockFallback(normalizedUrl)
        return this.enrichAnalysis(fallback)
      }

      return {
        url: normalizedUrl,
        error: 'Business profiler endpoint is not configured'
      }
    }

    try {
      if (this.debug) {
        console.log('🌐 Fetching:', this.endpoint)
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      // Add authorization header if token is provided
      if (ctx.authToken) {
        headers['Authorization'] = `Bearer ${ctx.authToken}`
        if (this.debug) {
          console.log('🔐 Auth token provided:', ctx.authToken.substring(0, 20) + '...')
        }
      } else {
        if (this.debug) {
          console.warn('⚠️ No auth token provided')
        }
      }

      if (this.debug) {
        console.log('📤 Request headers:', Object.keys(headers))
      }

      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          url: normalizedUrl,
          businessName: ctx.businessName,
          businessType: ctx.businessType,
          tier: ctx.tier,
          businessId: ctx.businessId, // For server-side persistence
        }),
      })

      if (this.debug) {
        console.log('📥 Response status:', res.status, res.statusText)
      }

      if (!res.ok) {
        const errorText = await res.text()
        if (this.debug) {
          console.warn('❌ Analyze-website function returned non-OK:', errorText)
        }

        if (this.useMockFallback) {
          const fallback = this.mockFallback(normalizedUrl)
          return this.enrichAnalysis(fallback)
        }

        return {
          url: normalizedUrl,
          error: `Analyze website failed with status ${res.status}`
        }
      }

      const data = (await res.json()) as BusinessProfileAnalysis
      if (this.debug) {
        console.log('✅ Raw analysis result received')
      }

      const persistenceDebugEnabled =
        String(import.meta.env.VITE_AI_PROMPT_DEBUG || '').toLowerCase() === 'true' ||
        String(import.meta.env.VITE_AI_PROMPT_DEBUG || '').toLowerCase() === '1' ||
        String(import.meta.env.VITE_AI_PROMPT_DEBUG || '').toLowerCase() === 'yes' ||
        String(import.meta.env.VITE_AI_PROMPT_DEBUG || '').toLowerCase() === 'on' ||
        String(import.meta.env.VITE_BUSINESS_PROFILER_DEBUG || '').toLowerCase() === 'true' ||
        String(import.meta.env.VITE_BUSINESS_PROFILER_DEBUG || '').toLowerCase() === '1' ||
        String(import.meta.env.VITE_BUSINESS_PROFILER_DEBUG || '').toLowerCase() === 'yes' ||
        String(import.meta.env.VITE_BUSINESS_PROFILER_DEBUG || '').toLowerCase() === 'on'

      if (persistenceDebugEnabled) {
        // `_persistence` is debug-only metadata from the edge function response
        console.debug('🧾 analyze-website _persistence:', (data as any)?._persistence)
      }

      if (data?.error) {
        if (this.debug) {
          console.warn('⚠️ Analysis returned error:', data.error)
        }

        if (this.useMockFallback) {
          const fallback = this.mockFallback(normalizedUrl)
          return this.enrichAnalysis(fallback)
        }

        return {
          url: normalizedUrl,
          error: data.error
        }
      }

      const enrichedTarget = data.url ? data : { ...data, url: normalizedUrl }
      return this.enrichAnalysis(enrichedTarget)
    } catch (err) {
      if (this.debug) {
        console.error('💥 Website analysis call failed:', err)
      }

      if (this.useMockFallback) {
        const fallback = this.mockFallback(normalizedUrl)
        return this.enrichAnalysis(fallback)
      }

      return {
        url: normalizedUrl,
        error: err instanceof Error ? err.message : 'Unexpected error during business profile analysis'
      }
    }
  }

  private normalizeUrl(raw?: string): string | undefined {
    if (!raw) {
      return undefined
    }

    const trimmed = raw.trim()
    if (!trimmed) {
      return undefined
    }

    const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
    if (hasScheme && !/^https?:\/\//i.test(trimmed)) {
      if (this.debug) {
        console.warn('⚠️ Unsupported protocol supplied to normalizeUrl:', trimmed)
      }
      return undefined
    }

    try {
      const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
      const url = new URL(candidate)
      if (!['http:', 'https:'].includes(url.protocol)) {
        return undefined
      }

      url.hash = ''
      return url.toString()
    } catch (error) {
      if (this.debug) {
        console.warn('⚠️ normalizeUrl failed for input', raw, error)
      }
      return undefined
    }
  }

  /**
   * Enriches analysis with derived businessSector and offeringsProfile
   * so resten af app'en kan regne med, at de (ofte) findes.
   */
  private enrichAnalysis(base: BusinessProfileAnalysis): BusinessProfileAnalysis {
    let businessSector = base.businessSector
    if (!businessSector) {
      businessSector = this.guessSector(base)
    }

    let offeringsProfile = base.offeringsProfile
    if (!offeringsProfile) {
      offeringsProfile = this.buildOfferingsProfile(base, businessSector)
    }

    return {
      ...base,
      businessSector,
      offeringsProfile,
    }
  }

  /**
   * Guess sector from businessType, keywords, url, etc.
   */
  private guessSector(analysis: BusinessProfileAnalysis): BusinessSector | undefined {
    const type = (analysis.businessType || '').toLowerCase()
    const keywordsJoined = (analysis.keywords || []).join(' ').toLowerCase()
    const url = (analysis.url || '').toLowerCase()
    const text = `${type} ${keywordsJoined} ${url}`

    if (
      /cafe|café|coffee|restaurant|pizza|burger|bistro|bar|bakery|bager|food truck|street food/.test(
        text,
      )
    ) {
      return 'hospitality'
    }

    if (
      /frisør|frisor|hair|salon|skønhed|beauty|nails|neglesalon|lash|bryn|vipper/.test(
        text,
      )
    ) {
      return 'beauty'
    }

    if (
      /massage|massør|fysio|fysioterapi|clinic|klinik|yoga|wellness|osteopat|kiropraktor/.test(
        text,
      )
    ) {
      return 'wellness'
    }

    if (
      /butik|shop|store|mode|fashion|tøj|smykk|interiør|interior|design/.test(text)
    ) {
      return 'retail'
    }

    return undefined
  }

  /**
   * Build a simple offeringsProfile from the more generic `offerings` data.
   * Denne er konservativ: hellere lidt simpel end for smart.
   */
  private buildOfferingsProfile(
    analysis: BusinessProfileAnalysis,
    sector?: BusinessSector,
  ): BusinessOfferingsProfile | undefined {
    const menuStructure = analysis.offerings?.menuStructure || []
    const signatureItems = analysis.offerings?.signatureItems || []
    const categoriesFromScrape = analysis.offerings?.categories || []

    const baseSeed = analysis.url || sector || 'unknown'

    // PRIORITY 1: Use new menuStructure if available (preserves restaurant's organization)
    if (menuStructure.length > 0) {
      return {
        categories: menuStructure.map((category) => ({
          id: makeStableId('category', `${baseSeed}-${category.name}`),
          name: category.timeRange 
            ? `${category.name} (${category.timeRange})` 
            : category.name,
          items: category.items.map((itemName, index) => ({
            id: makeStableId('item', `${baseSeed}-${category.name}-${index}-${itemName}`),
            name: itemName,
          })),
        })),
      }
    }

    // FALLBACK: Use legacy signatureItems format
    if (signatureItems.length === 0 && categoriesFromScrape.length === 0) {
      return { categories: [] }
    }

    const sectorName = sector || this.guessSector(analysis)

    // Legacy sector-based mapping (only used if no menuStructure)
    if (sectorName === 'hospitality') {
      return {
        categories: [
          {
            id: makeStableId('category', `${baseSeed}-drinks`),
            name: 'Drikkevarer',
            items: signatureItems.slice(0, 10).map((name, index) => ({
              id: makeStableId('item', `${baseSeed}-signature-${index}-${name}`),
              name,
            })),
          },
        ],
      }
    }

    if (sectorName === 'beauty') {
      return {
        categories: [
          {
            id: makeStableId('category', `${baseSeed}-services`),
            name: 'Behandlinger',
            items: signatureItems.slice(0, 10).map((name, index) => ({
              id: makeStableId('item', `${baseSeed}-signature-${index}-${name}`),
              name,
            })),
          },
        ],
      }
    }

    if (sectorName === 'wellness') {
      return {
        categories: [
          {
            id: makeStableId('category', `${baseSeed}-treatments`),
            name: 'Behandlinger / sessioner',
            items: signatureItems.slice(0, 10).map((name, index) => ({
              id: makeStableId('item', `${baseSeed}-signature-${index}-${name}`),
              name,
            })),
          },
        ],
      }
    }

    if (sectorName === 'retail') {
      return {
        categories: [
          {
            id: makeStableId('category', `${baseSeed}-products`),
            name: 'Produkter',
            items: signatureItems.slice(0, 10).map((name, index) => ({
              id: makeStableId('item', `${baseSeed}-signature-${index}-${name}`),
              name,
            })),
          },
        ],
      }
    }

    // Fallback, hvis vi ikke kunne gætte sektor
    return {
      categories: [
        {
          id: makeStableId('category', `${baseSeed}-main`),
          name: categoriesFromScrape[0] || 'Ydelser / produkter',
          items: signatureItems.slice(0, 10).map((name, index) => ({
            id: makeStableId('item', `${baseSeed}-signature-${index}-${name}`),
            name,
          })),
        },
      ],
    }
  }

  private mockFallback(url: string): BusinessProfileAnalysis {
    const normalizedUrl = url.toLowerCase()
    // Return mock data for offline development
    if (normalizedUrl.includes('cafe') || normalizedUrl.includes('coffee')) {
      const analysis: BusinessProfileAnalysis = {
        url,
        businessName: 'Café Nørrebro',
        businessType: 'cafe',
        description:
          'Cozy neighborhood café serving specialty coffee, fresh pastries, and homemade meals in the heart of Nørrebro.',
        logoUrl: 'https://via.placeholder.com/120x120?text=Logo',
        openingHours: {
          monday: { open: '08:00', close: '17:00' },
          tuesday: { open: '08:00', close: '17:00' },
          wednesday: { open: '08:00', close: '17:00' },
          thursday: { open: '08:00', close: '17:00' },
          friday: { open: '08:00', close: '18:00' },
          saturday: { open: '09:00', close: '18:00' },
          sunday: { open: '10:00', close: '16:00' },
        },
        offerings: {
          categories: ['Breakfast', 'Brunch', 'Lunch', 'Coffee', 'Pastries'],
          signatureItems: ['Avocado Toast', 'Flat White', 'Cinnamon Roll'],
          dietaryOptions: ['Vegetarian', 'Vegan', 'Gluten-Free'],
        },
        contact: {
          phone: '+45 12 34 56 78',
          email: 'hello@cafenorrebro.dk',
          address: 'Nørrebrogade 123, 2200 København N',
        },
        keywords: ['café', 'coffee', 'organic', 'local', 'cozy'],

        // Nye felter – kan også blive overskrevet af enrichAnalysis,
        // men det gør ikke noget
        businessSector: 'hospitality',
        offeringsProfile: {
          categories: [
            {
              id: makeStableId('category', `${url}-drinks`),
              name: 'Drikkevarer',
              items: [
                { id: makeStableId('item', `${url}-flat-white`), name: 'Flat White' },
                { id: makeStableId('item', `${url}-cappuccino`), name: 'Cappuccino' },
              ],
            },
            {
              id: makeStableId('category', `${url}-food`),
              name: 'Mad / brunch',
              items: [
                { id: makeStableId('item', `${url}-avocado-toast`), name: 'Avocado Toast' },
                { id: makeStableId('item', `${url}-croissant`), name: 'Croissant' },
              ],
            },
          ],
        },
      }

      return analysis
    }

    // Default empty analysis for other URLs
    return {
      url: url,
      businessName: '',
      businessType: '',
      description: '',
      openingHours: {},
      offerings: {
        categories: [],
        signatureItems: [],
        dietaryOptions: [],
      },
      contact: {},
      keywords: [],
      businessSector: undefined,
      offeringsProfile: { categories: [] },
    }
  }
}

export function resolveBusinessProfilerFeature() {
  return new SupabaseBusinessProfilerAI()
}

export async function analyzeBusinessProfile(
  ctx: BusinessProfileContext,
): Promise<BusinessProfileAnalysis> {
  const impl = resolveBusinessProfilerFeature()
  return await impl.analyze(ctx)
}
