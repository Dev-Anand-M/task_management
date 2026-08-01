/**
 * iOS-Level Performance Optimization
 * Simple In-Memory Request Cache with TTL
 * 
 * Usage:
 * import { cache, cachedQuery } from '@/utils/cache';
 * 
 * const data = await cachedQuery(
 *   'user-tasks-' + userId,
 *   async () => {
 *     const { data } = await supabase.from('tasks').select('*');
 *     return data;
 *   },
 *   300000 // 5 minutes cache
 * );
 */

class RequestCache {
  constructor() {
    this.cache = new Map();
    this.maxSize = 100; // Prevent memory leaks
  }

  set(key, data, ttl = 60000) {
    // If cache is full, remove oldest entry
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      expires: Date.now() + ttl,
      createdAt: Date.now()
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  invalidate(key) {
    this.cache.delete(key);
  }

  invalidatePattern(pattern) {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys())
    };
  }
}

export const cache = new RequestCache();

/**
 * Wrapper for queries with automatic caching
 * @param {string} key - Cache key
 * @param {Function} queryFn - Async function that returns data
 * @param {number} ttl - Time to live in milliseconds (default: 1 minute)
 * @returns {Promise} - Cached or fresh data
 */
export async function cachedQuery(key, queryFn, ttl = 60000) {
  const cached = cache.get(key);
  if (cached !== null) {
    console.log(`[Cache HIT] ${key}`);
    return cached;
  }
  
  console.log(`[Cache MISS] ${key}`);
  const result = await queryFn();
  cache.set(key, result, ttl);
  return result;
}

/**
 * Wrapper for mutations that invalidate related cache entries
 * @param {Function} mutationFn - Async function that performs mutation
 * @param {string|string[]} invalidateKeys - Keys or patterns to invalidate
 * @returns {Promise} - Mutation result
 */
export async function cachedMutation(mutationFn, invalidateKeys = []) {
  const result = await mutationFn();
  
  // Invalidate cache entries
  const keys = Array.isArray(invalidateKeys) ? invalidateKeys : [invalidateKeys];
  keys.forEach(key => {
    if (key.includes('*')) {
      // Pattern invalidation
      cache.invalidatePattern(key.replace(/\*/g, '.*'));
    } else {
      cache.invalidate(key);
    }
  });
  
  return result;
}

// Export for debugging in console
if (typeof window !== 'undefined') {
  window.__cacheDebug = {
    getStats: () => cache.getStats(),
    clear: () => cache.clear(),
    get: (key) => cache.get(key),
    invalidate: (key) => cache.invalidate(key)
  };
}
