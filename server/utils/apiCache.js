/**
 * API Response Cache
 * Simple in-memory cache with TTL support for frequently accessed endpoints
 */

class ApiCache {
  constructor(defaultTTL = 5000) {
    this.cache = new Map();
    this.defaultTTL = defaultTTL; // Default 5 seconds
  }

  /**
   * Generate cache key from request
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @param {object} query - Query parameters
   * @returns {string} Cache key
   */
  generateKey(method, url, query = {}) {
    const queryString = Object.keys(query)
      .sort()
      .map(key => `${key}=${query[key]}`)
      .join('&');
    return `${method}:${url}${queryString ? '?' + queryString : ''}`;
  }

  /**
   * Get cached response
   * @param {string} key - Cache key
   * @returns {any|null} Cached data or null if expired/not found
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cached response
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {number} ttl - Time to live in milliseconds (optional)
   */
  set(key, data, ttl = this.defaultTTL) {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Invalidate cache entries matching pattern
   * @param {string|RegExp} pattern - Pattern to match keys
   */
  invalidate(pattern) {
    const regex = typeof pattern === 'string' 
      ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      : pattern;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  getStats() {
    let validCount = 0;
    let expiredCount = 0;
    const now = Date.now();

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expiredCount++;
      } else {
        validCount++;
      }
    }

    return {
      total: this.cache.size,
      valid: validCount,
      expired: expiredCount,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

module.exports = ApiCache;
