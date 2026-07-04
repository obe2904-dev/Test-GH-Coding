/**
 * Context Cache Manager
 * 
 * Simple in-memory cache for external API data with TTL support.
 * Reduces redundant API calls and improves performance.
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

/**
 * Simple in-memory cache with TTL
 */
export class ContextCache {
  private cache: Map<string, CacheEntry<any>>
  private hitCount: number = 0
  private missCount: number = 0

  constructor() {
    this.cache = new Map()
  }

  /**
   * Get cached data if valid
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      this.missCount++
      return null
    }

    const now = Date.now()
    const age = (now - entry.timestamp) / 1000 // Age in seconds

    if (age > entry.ttl) {
      // Expired
      this.cache.delete(key)
      this.missCount++
      return null
    }

    this.hitCount++
    return entry.data as T
  }

  /**
   * Set cached data with TTL
   */
  set<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    })
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
    this.hitCount = 0
    this.missCount = 0
  }

  /**
   * Clear expired entries
   */
  clearExpired(): void {
    const now = Date.now()
    
    for (const [key, entry] of this.cache.entries()) {
      const age = (now - entry.timestamp) / 1000
      if (age > entry.ttl) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: this.hitCount / (this.hitCount + this.missCount) || 0,
    }
  }

  /**
   * Get or fetch with automatic caching
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number
  ): Promise<T | null> {
    // Try cache first
    const cached = this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Fetch fresh data
    try {
      const data = await fetcher()
      if (data !== null && data !== undefined) {
        this.set(key, data, ttl)
      }
      return data
    } catch (error) {
      console.error('Error in getOrFetch:', error)
      return null
    }
  }
}

// Global cache instance
export const globalContextCache = new ContextCache()

// Clear expired entries every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    globalContextCache.clearExpired()
  }, 5 * 60 * 1000)
}
