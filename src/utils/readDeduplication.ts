/**
 * Read Deduplication Utility
 * Prevents duplicate Firebase reads within a time window
 */

interface CacheEntry {
  timestamp: number;
  data: any;
  promise?: Promise<any>;
}

class ReadDeduplicator {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 5000; // 5 seconds cache
  private readonly PENDING_REQUESTS: Map<string, Promise<any>> = new Map();

  /**
   * Get data with deduplication
   * - Returns cached data if fresh
   * - Returns pending promise if request is in-flight
   * - Makes new request only if needed
   */
  async deduplicate<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = this.CACHE_TTL
  ): Promise<T> {
    const now = Date.now();
    const cached = this.cache.get(key);

    // Return cached data if still fresh
    if (cached && now - cached.timestamp < ttl) {
      if (__DEV__) {
        console.log(`✅ [CACHE HIT] Using cached data for: ${key}`);
      }
      return cached.data as T;
    }

    // Return pending promise if request is in-flight
    const pending = this.PENDING_REQUESTS.get(key);
    if (pending) {
      if (__DEV__) {
        console.log(`⏳ [DEDUP] Reusing in-flight request for: ${key}`);
      }
      return pending as Promise<T>;
    }

    // Make new request
    if (__DEV__) {
      console.log(`🔄 [FETCH] Making new request for: ${key}`);
    }

    const promise = fetchFn();
    this.PENDING_REQUESTS.set(key, promise);

    try {
      const data = await promise;
      
      // Cache the result
      this.cache.set(key, {
        timestamp: now,
        data,
      });

      // Remove from pending
      this.PENDING_REQUESTS.delete(key);

      return data;
    } catch (error) {
      // Remove from pending on error
      this.PENDING_REQUESTS.delete(key);
      throw error;
    }
  }

  /**
   * Invalidate cache for a specific key
   */
  invalidate(key: string) {
    this.cache.delete(key);
    if (__DEV__) {
      console.log(`🗑️ [CACHE] Invalidated: ${key}`);
    }
  }

  /**
   * Invalidate all cached data
   */
  invalidateAll() {
    this.cache.clear();
    if (__DEV__) {
      console.log(`🗑️ [CACHE] Cleared all cache`);
    }
  }

  /**
   * Clean up expired cache entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (__DEV__ && cleaned > 0) {
      console.log(`🧹 [CACHE] Cleaned up ${cleaned} expired entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      pendingRequests: this.PENDING_REQUESTS.size,
    };
  }
}

// Singleton instance
export const readDeduplicator = new ReadDeduplicator();

// Clean up expired cache every 30 seconds
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    readDeduplicator.cleanup();
  }, 30000);
}
