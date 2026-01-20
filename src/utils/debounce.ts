/**
 * Debounce and Throttle Utilities
 * 
 * Provides functions to limit the rate of function execution.
 */

/**
 * Debounce function - delays execution until after delay milliseconds have elapsed
 * since the last time it was invoked.
 * 
 * @param func - The function to debounce
 * @param delay - The delay in milliseconds
 * @returns Debounced function
 * 
 * @example
 * const debouncedSearch = debounce((query: string) => {
 *   console.log('Searching for:', query);
 * }, 300);
 * 
 * debouncedSearch('hello'); // Will only execute after 300ms of no more calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function debounced(...args: Parameters<T>) {
    // Clear previous timeout
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    // Set new timeout
    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Throttle function - ensures function is called at most once per interval
 * 
 * @param func - The function to throttle
 * @param interval - The minimum interval in milliseconds between calls
 * @returns Throttled function
 * 
 * @example
 * const throttledScroll = throttle(() => {
 *   console.log('Scroll event');
 * }, 100);
 * 
 * window.addEventListener('scroll', throttledScroll);
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  interval: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function throttled(...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    // If enough time has passed, call immediately
    if (timeSinceLastCall >= interval) {
      lastCall = now;
      func(...args);
    } else {
      // Otherwise, schedule a call at the end of the interval
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        func(...args);
        timeoutId = null;
      }, interval - timeSinceLastCall);
    }
  };
}

/**
 * React hook for debounced values
 * 
 * @param value - The value to debounce
 * @param delay - The delay in milliseconds
 * @returns Debounced value
 * 
 * @example
 * const [searchQuery, setSearchQuery] = useState('');
 * const debouncedQuery = useDebounce(searchQuery, 300);
 * 
 * useEffect(() => {
 *   // This will only run 300ms after the user stops typing
 *   performSearch(debouncedQuery);
 * }, [debouncedQuery]);
 */
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [value, delay]);

  return debouncedValue;
}
