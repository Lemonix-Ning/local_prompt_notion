/**
 * Virtual Scrolling Manager
 * 
 * Optimizes rendering of large lists by only rendering visible items.
 * Activates automatically when list has >50 items.
 */

export interface VirtualScrollConfig {
  itemHeight: number;        // Height of each item in pixels
  overscan: number;          // Number of items to render outside viewport
  containerHeight: number;   // Height of the scroll container
}

export interface VirtualScrollRange {
  startIndex: number;
  endIndex: number;
  offsetY: number;
}

export class VirtualScrollManager {
  private config: VirtualScrollConfig;

  constructor(config: VirtualScrollConfig) {
    this.config = config;
  }

  /**
   * Calculate which items should be visible based on scroll position
   */
  calculateVisibleRange(scrollTop: number, totalItems: number): VirtualScrollRange {
    const { itemHeight, overscan, containerHeight } = this.config;

    // Calculate visible range
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.ceil((scrollTop + containerHeight) / itemHeight);

    // Add overscan buffer
    const bufferedStart = Math.max(0, startIndex - overscan);
    const bufferedEnd = Math.min(totalItems, endIndex + overscan);

    // Calculate offset for positioning
    const offsetY = bufferedStart * itemHeight;

    return {
      startIndex: bufferedStart,
      endIndex: bufferedEnd,
      offsetY,
    };
  }

  /**
   * Get transform offset for positioning visible items
   */
  getTransformOffset(startIndex: number): number {
    return startIndex * this.config.itemHeight;
  }

  /**
   * Calculate total height of the scrollable container
   */
  getTotalHeight(totalItems: number): number {
    return totalItems * this.config.itemHeight;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VirtualScrollConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * React hook for virtual scrolling
 */
export function useVirtualScroll<T>(
  items: T[],
  config: VirtualScrollConfig,
  enabled: boolean = true
): {
  visibleItems: T[];
  totalHeight: number;
  offsetY: number;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
} {
  const [scrollTop, setScrollTop] = React.useState(0);
  const manager = React.useMemo(() => new VirtualScrollManager(config), [config]);

  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // If virtual scrolling is disabled, return all items
  if (!enabled) {
    return {
      visibleItems: items,
      totalHeight: 0,
      offsetY: 0,
      onScroll: handleScroll,
    };
  }

  const range = manager.calculateVisibleRange(scrollTop, items.length);
  const visibleItems = items.slice(range.startIndex, range.endIndex);
  const totalHeight = manager.getTotalHeight(items.length);

  return {
    visibleItems,
    totalHeight,
    offsetY: range.offsetY,
    onScroll: handleScroll,
  };
}

// Add React import for the hook
import React from 'react';
