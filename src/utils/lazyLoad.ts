/**
 * Lazy Load Manager
 * 
 * Uses IntersectionObserver to lazy load images as they enter the viewport.
 * Reduces initial memory usage and improves page load performance.
 */

export interface LazyLoadConfig {
  rootMargin: string;        // e.g., "200px" - load before entering viewport
  threshold: number;         // 0-1, visibility percentage to trigger load
}

export class LazyLoadManager {
  private observer: IntersectionObserver | null = null;
  private config: LazyLoadConfig;
  private callbacks: Map<Element, () => void> = new Map();

  constructor(config: LazyLoadConfig = { rootMargin: '200px', threshold: 0.01 }) {
    this.config = config;
    this.initObserver();
  }

  private initObserver(): void {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const callback = this.callbacks.get(entry.target);
            if (callback) {
              callback();
              this.unobserve(entry.target);
            }
          }
        });
      },
      {
        rootMargin: this.config.rootMargin,
        threshold: this.config.threshold,
      }
    );
  }

  /**
   * Start observing an element and call the callback when it becomes visible
   */
  observe(element: Element, onVisible: () => void): void {
    if (!this.observer) {
      // Fallback: if IntersectionObserver is not supported, load immediately
      onVisible();
      return;
    }

    this.callbacks.set(element, onVisible);
    this.observer.observe(element);
  }

  /**
   * Stop observing an element
   */
  unobserve(element: Element): void {
    if (this.observer) {
      this.observer.unobserve(element);
    }
    this.callbacks.delete(element);
  }

  /**
   * Disconnect the observer and clean up
   */
  disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.callbacks.clear();
  }
}

/**
 * React hook for lazy loading images
 */
export function useLazyLoad(config?: LazyLoadConfig) {
  const managerRef = React.useRef<LazyLoadManager | null>(null);

  React.useEffect(() => {
    managerRef.current = new LazyLoadManager(config);

    return () => {
      if (managerRef.current) {
        managerRef.current.disconnect();
      }
    };
  }, [config]);

  const observe = React.useCallback((element: Element | null, onVisible: () => void) => {
    if (!element || !managerRef.current) return;
    managerRef.current.observe(element, onVisible);
  }, []);

  return { observe };
}

// Add React import for the hook
import React from 'react';
