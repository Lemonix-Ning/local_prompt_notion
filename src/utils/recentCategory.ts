/**
 * Recent Category Manager
 * Stores and retrieves the last accessed category for startup prioritization
 */

const STORAGE_KEY = 'lumina_recent_category';
const STORAGE_TIMESTAMP_KEY = 'lumina_recent_category_timestamp';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface RecentCategoryData {
  category: string;
  timestamp: number;
}

/**
 * Save the recently accessed category
 * @param category - Category path or special category ('favorites', 'trash', etc.)
 */
export function saveRecentCategory(category: string): void {
  try {
    const data: RecentCategoryData = {
      category,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, category);
    localStorage.setItem(STORAGE_TIMESTAMP_KEY, data.timestamp.toString());
  } catch (error) {
    // localStorage not available or quota exceeded
    console.warn('[RecentCategory] Failed to save:', error);
  }
}

/**
 * Get the recently accessed category
 * @returns Recent category or null if not found/expired
 */
export function getRecentCategory(): string | null {
  try {
    const category = localStorage.getItem(STORAGE_KEY);
    const timestampStr = localStorage.getItem(STORAGE_TIMESTAMP_KEY);

    if (!category || !timestampStr) {
      return null;
    }

    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) {
      return null;
    }

    // Check if expired
    if (Date.now() - timestamp > MAX_AGE) {
      clearRecentCategory();
      return null;
    }

    return category;
  } catch (error) {
    // localStorage not available
    console.warn('[RecentCategory] Failed to get:', error);
    return null;
  }
}

/**
 * Clear the recent category data
 */
export function clearRecentCategory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_TIMESTAMP_KEY);
  } catch (error) {
    // localStorage not available
    console.warn('[RecentCategory] Failed to clear:', error);
  }
}

/**
 * Check if a category is the recent one
 * @param category - Category to check
 * @returns True if this is the recent category
 */
export function isRecentCategory(category: string): boolean {
  const recent = getRecentCategory();
  return recent === category;
}
