/**
 * Markdown Render Cache
 * Caches rendered markdown output to avoid re-rendering unchanged content
 */

interface CacheEntry {
  content: string;
  rendered: string;
  timestamp: number;
}

class MarkdownCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private maxAge: number; // milliseconds

  constructor(maxSize = 100, maxAge = 5 * 60 * 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.maxAge = maxAge; // Default: 5 minutes
  }

  /**
   * Generate cache key from content
   * @param content - Markdown content
   * @returns Cache key (simple hash)
   */
  private generateKey(content: string): string {
    // Simple hash function for cache key
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Get cached rendered output
   * @param content - Markdown content
   * @returns Cached rendered output or null if not found/expired
   */
  get(content: string): string | null {
    const key = this.generateKey(content);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }

    // Verify content matches (hash collision check)
    if (entry.content !== content) {
      return null;
    }

    return entry.rendered;
  }

  /**
   * Set cached rendered output
   * @param content - Markdown content
   * @param rendered - Rendered HTML output
   */
  set(content: string, rendered: string): void {
    const key = this.generateKey(content);

    // Evict oldest entry if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      content,
      rendered,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns Cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      maxAge: this.maxAge,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.maxAge) {
        this.cache.delete(key);
      }
    }
  }
}

// Export singleton instance
export const markdownCache = new MarkdownCache();

// Export class for testing
export default MarkdownCache;
