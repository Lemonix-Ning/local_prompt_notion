/**
 * NotificationThrottler
 * 
 * Prevents notification spam by throttling notifications per task.
 * Ensures a task can only send a notification once every N seconds.
 * 
 * Requirements: 2.5 - Notification throttling (max 1 per 10s per task)
 */

export interface NotificationThrottlerConfig {
  /**
   * Minimum time (in milliseconds) between notifications for the same task
   * @default 10000 (10 seconds)
   */
  throttleInterval?: number;
}

export class NotificationThrottler {
  private lastNotificationTime: Map<string, number> = new Map();
  private throttleInterval: number;

  constructor(config: NotificationThrottlerConfig = {}) {
    this.throttleInterval = config.throttleInterval ?? 10000; // Default: 10 seconds
  }

  /**
   * Check if a notification should be shown for a given task
   * 
   * @param taskId - Unique identifier for the task
   * @returns true if notification should be shown, false if throttled
   */
  shouldShowNotification(taskId: string): boolean {
    const now = Date.now();
    const lastTime = this.lastNotificationTime.get(taskId);

    // If never notified before, allow notification
    if (lastTime === undefined) {
      this.lastNotificationTime.set(taskId, now);
      return true;
    }

    // Check if enough time has passed since last notification
    const timeSinceLastNotification = now - lastTime;
    if (timeSinceLastNotification >= this.throttleInterval) {
      this.lastNotificationTime.set(taskId, now);
      return true;
    }

    // Throttled - too soon since last notification
    return false;
  }

  /**
   * Reset throttle state for a specific task
   * Useful when a task is dismissed or completed
   * 
   * @param taskId - Unique identifier for the task
   */
  reset(taskId: string): void {
    this.lastNotificationTime.delete(taskId);
  }

  /**
   * Clear all throttle state
   * Useful for testing or when resetting the application state
   */
  clear(): void {
    this.lastNotificationTime.clear();
  }

  /**
   * Get the time remaining (in milliseconds) until a notification can be shown again
   * 
   * @param taskId - Unique identifier for the task
   * @returns milliseconds until next notification allowed, or 0 if can notify now
   */
  getTimeUntilNextNotification(taskId: string): number {
    const lastTime = this.lastNotificationTime.get(taskId);
    if (lastTime === undefined) {
      return 0; // Can notify immediately
    }

    const now = Date.now();
    const timeSinceLastNotification = now - lastTime;
    const timeRemaining = this.throttleInterval - timeSinceLastNotification;

    return Math.max(0, timeRemaining);
  }
}
