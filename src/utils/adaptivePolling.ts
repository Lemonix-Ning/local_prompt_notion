/**
 * Adaptive Polling Manager
 * 
 * Manages polling intervals based on application state:
 * - Pauses when no active tasks
 * - Reduces frequency when window is hidden
 * - Resumes normal frequency when window is visible
 */

export interface AdaptivePollingConfig {
  foregroundInterval: number;    // 5000ms - normal polling when visible
  backgroundInterval: number;    // 30000ms - reduced polling when hidden
  idleInterval: number;          // 0 - paused when no active tasks
}

export type VisibilityState = 'visible' | 'hidden';

export class AdaptivePollingManager {
  private currentInterval: number;
  private visibilityState: VisibilityState;
  private hasActiveTasks: boolean;
  private config: AdaptivePollingConfig;
  private intervalId: number | null = null;
  private callback: () => void;
  private visibilityChangeCallback?: (isVisible: boolean) => void;

  constructor(
    callback: () => void,
    config: AdaptivePollingConfig = {
      foregroundInterval: 5000,
      backgroundInterval: 30000,
      idleInterval: 0,
    }
  ) {
    this.callback = callback;
    this.config = config;
    this.currentInterval = config.foregroundInterval;
    this.visibilityState = document.visibilityState as VisibilityState;
    this.hasActiveTasks = false;

    // Listen to visibility changes
    this.setupVisibilityListener();
  }

  /**
   * Set callback for visibility changes
   */
  setVisibilityChangeCallback(callback: (isVisible: boolean) => void): void {
    this.visibilityChangeCallback = callback;
  }

  /**
   * Start polling
   */
  start(): void {
    this.updatePollingInterval();
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Update task state
   */
  setHasActiveTasks(hasActive: boolean): void {
    if (this.hasActiveTasks !== hasActive) {
      this.hasActiveTasks = hasActive;
      this.updatePollingInterval();
    }
  }

  /**
   * Get current polling interval
   */
  getCurrentInterval(): number {
    return this.currentInterval;
  }

  /**
   * Update polling interval based on current state
   */
  private updatePollingInterval(): void {
    // Stop existing interval
    this.stop();

    // Determine new interval
    let newInterval: number;

    if (!this.hasActiveTasks) {
      // No active tasks - pause polling
      newInterval = this.config.idleInterval;
    } else if (this.visibilityState === 'hidden') {
      // Window hidden - reduce polling frequency
      newInterval = this.config.backgroundInterval;
    } else {
      // Window visible - normal polling frequency
      newInterval = this.config.foregroundInterval;
    }

    this.currentInterval = newInterval;

    // Start new interval if not paused
    if (newInterval > 0) {
      this.intervalId = window.setInterval(() => {
        this.callback();
      }, newInterval);

      // Execute immediately on interval change (except when pausing)
      if (this.hasActiveTasks) {
        this.callback();
      }
    }
  }

  /**
   * Handle visibility change
   */
  private onVisibilityChange = (): void => {
    const newState = document.visibilityState as VisibilityState;
    
    if (this.visibilityState !== newState) {
      this.visibilityState = newState;
      this.updatePollingInterval();

      // Call visibility change callback if set
      if (this.visibilityChangeCallback) {
        this.visibilityChangeCallback(newState === 'visible');
      }

      // Log state change in development
      if (import.meta.env.DEV) {
        console.log(`[AdaptivePolling] Visibility changed to ${newState}, interval: ${this.currentInterval}ms`);
      }
    }
  };

  /**
   * Setup visibility change listener
   */
  private setupVisibilityListener(): void {
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stop();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }
}
