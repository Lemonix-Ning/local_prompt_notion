/**
 * Memory Manager
 * Centralized cleanup callback registration and execution
 */

type CleanupCallback = () => void | Promise<void>;

class MemoryManager {
  private cleanupCallbacks: Map<string, CleanupCallback>;
  private static instance: MemoryManager | null = null;

  private constructor() {
    this.cleanupCallbacks = new Map();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  /**
   * Register a cleanup callback
   * @param key - Unique identifier for the callback
   * @param callback - Cleanup function to execute
   */
  register(key: string, callback: CleanupCallback): void {
    this.cleanupCallbacks.set(key, callback);
  }

  /**
   * Unregister a cleanup callback
   * @param key - Unique identifier for the callback
   */
  unregister(key: string): void {
    this.cleanupCallbacks.delete(key);
  }

  /**
   * Execute a specific cleanup callback
   * @param key - Unique identifier for the callback
   */
  async executeCleanup(key: string): Promise<void> {
    const callback = this.cleanupCallbacks.get(key);
    if (callback) {
      await callback();
      this.cleanupCallbacks.delete(key);
    }
  }

  /**
   * Execute all cleanup callbacks
   */
  async executeAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const callback of this.cleanupCallbacks.values()) {
      promises.push(Promise.resolve(callback()));
    }

    await Promise.all(promises);
    this.cleanupCallbacks.clear();
  }

  /**
   * Get number of registered callbacks
   */
  getCount(): number {
    return this.cleanupCallbacks.size;
  }

  /**
   * Clear all callbacks without executing them
   */
  clear(): void {
    this.cleanupCallbacks.clear();
  }
}

// Export singleton instance
export const memoryManager = MemoryManager.getInstance();

// Export class for testing
export default MemoryManager;
