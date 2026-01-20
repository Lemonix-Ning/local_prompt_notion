/**
 * Performance Monitoring Utilities
 * 
 * Provides tools for measuring startup time, memory usage, CPU usage,
 * and detecting memory leaks during development.
 */

import type { PerformanceMetrics } from '../types/performance';

// Extend Performance interface to include memory (Chrome-specific)
declare global {
  interface Performance {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  }
}

/**
 * Startup timing markers
 */
export class StartupTimer {
  private markers: Map<string, number> = new Map();
  private startTime: number;
  private timeoutWarning: number = 5000; // 5 seconds
  private timeoutTimer: number | null = null;

  constructor() {
    this.startTime = performance.now();
    this.mark('process_start');
    
    // 🚀 Performance: Start timeout timer
    this.startTimeoutTimer();
  }

  /**
   * Start timeout timer for startup warning
   * @private
   */
  private startTimeoutTimer(): void {
    this.timeoutTimer = window.setTimeout(() => {
      if (!this.markers.has('interactive')) {
        console.warn('[Performance] Startup timeout exceeded 5 seconds');
        console.warn('[Performance] Current timings:', this.getTimings());
        
        // Log detailed breakdown
        const timings = this.getTimings();
        const breakdown: string[] = [];
        
        if (timings.first_paint) {
          breakdown.push(`First paint: ${timings.first_paint.toFixed(0)}ms`);
        }
        if (timings.sidecar_ready) {
          breakdown.push(`Sidecar ready: ${timings.sidecar_ready.toFixed(0)}ms`);
        }
        if (timings.vault_scan_start) {
          breakdown.push(`Vault scan start: ${timings.vault_scan_start.toFixed(0)}ms`);
        }
        if (timings.vault_scanned) {
          breakdown.push(`Vault scanned: ${timings.vault_scanned.toFixed(0)}ms`);
        }
        
        console.warn('[Performance] Breakdown:', breakdown.join(', '));
      }
    }, this.timeoutWarning);
  }

  /**
   * Mark a timing point
   */
  mark(name: string): void {
    this.markers.set(name, performance.now());
    
    // Clear timeout timer when interactive
    if (name === 'interactive' && this.timeoutTimer !== null) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
      
      // Log success if under threshold
      const totalTime = this.getElapsed('interactive');
      if (totalTime < this.timeoutWarning) {
        console.log(`[Performance] Startup completed in ${totalTime.toFixed(0)}ms ✅`);
      } else {
        console.warn(`[Performance] Startup completed in ${totalTime.toFixed(0)}ms (exceeded ${this.timeoutWarning}ms threshold)`);
      }
    }
  }

  /**
   * Get time elapsed since start
   */
  getElapsed(markerName: string): number {
    const markerTime = this.markers.get(markerName);
    if (!markerTime) {
      // 🔥 静默处理：某些标记（如 sidecar_ready）只在特定环境（桌面端）存在
      // 不需要警告，直接返回 0
      return 0;
    }
    return markerTime - this.startTime;
  }

  /**
   * Get time between two markers
   */
  getDuration(startMarker: string, endMarker: string): number {
    const start = this.markers.get(startMarker);
    const end = this.markers.get(endMarker);
    
    if (!start || !end) {
      // 🔥 静默处理：某些标记（如 sidecar_ready, vault_scanned）只在特定环境存在
      // 不需要警告，直接返回 0
      return 0;
    }
    
    return end - start;
  }

  /**
   * Get all timing data
   */
  getTimings(): Record<string, number> {
    const timings: Record<string, number> = {};
    
    for (const [name, time] of this.markers.entries()) {
      timings[name] = time - this.startTime;
    }
    
    return timings;
  }

  /**
   * Get startup metrics
   */
  getStartupMetrics(): PerformanceMetrics['startup'] {
    return {
      totalTime: this.getElapsed('interactive') || 0,
      sidecarStartTime: this.getElapsed('sidecar_ready') || 0,
      vaultScanTime: this.getDuration('sidecar_ready', 'vault_scanned') || 0,
      firstPaintTime: this.getElapsed('first_paint') || 0,
      timeToInteractive: this.getElapsed('interactive') || 0,
    };
  }
}

/**
 * Memory monitoring
 */
export class MemoryMonitor {
  private samples: Array<{ timestamp: number; usage: number }> = [];
  private maxSamples: number = 100;
  private warningThreshold: number = 150 * 1024 * 1024; // 150MB
  private maxThreshold: number = 200 * 1024 * 1024; // 200MB

  /**
   * Take a memory snapshot
   */
  sample(): void {
    if (!performance.memory) {
      console.warn('performance.memory not available');
      return;
    }

    const usage = performance.memory.usedJSHeapSize;
    
    this.samples.push({
      timestamp: Date.now(),
      usage,
    });

    // Keep only recent samples
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    // 🚀 Performance: Check thresholds and trigger actions
    if (usage > this.maxThreshold) {
      console.error(`❌ Memory usage exceeded ${this.maxThreshold / 1024 / 1024}MB: ${(usage / 1024 / 1024).toFixed(1)}MB`);
      
      // Trigger garbage collection if available (Chrome DevTools)
      if ('gc' in window && typeof (window as any).gc === 'function') {
        console.log('[Performance] Triggering garbage collection...');
        try {
          (window as any).gc();
        } catch (error) {
          console.warn('[Performance] Failed to trigger GC:', error);
        }
      }
      
      // Suggest user actions
      console.warn('[Performance] Consider closing unused prompts or restarting the application');
    } else if (usage > this.warningThreshold) {
      console.warn(`⚠️ Memory usage approaching limit: ${(usage / 1024 / 1024).toFixed(1)}MB / ${this.maxThreshold / 1024 / 1024}MB`);
    }
  }

  /**
   * Get current memory usage in MB
   */
  getCurrentUsage(): number {
    if (!performance.memory) return 0;
    return performance.memory.usedJSHeapSize / 1024 / 1024;
  }

  /**
   * Get peak memory usage in MB
   */
  getPeakUsage(): number {
    if (this.samples.length === 0) return 0;
    const peak = Math.max(...this.samples.map(s => s.usage));
    return peak / 1024 / 1024;
  }

  /**
   * Detect memory leaks by analyzing trend
   */
  detectLeak(): boolean {
    if (this.samples.length < 10) return false;

    // Get recent samples
    const recent = this.samples.slice(-10);
    
    // Calculate trend (linear regression slope)
    const n = recent.length;
    const sumX = recent.reduce((sum, _, i) => sum + i, 0);
    const sumY = recent.reduce((sum, s) => sum + s.usage, 0);
    const sumXY = recent.reduce((sum, s, i) => sum + i * s.usage, 0);
    const sumX2 = recent.reduce((sum, _, i) => sum + i * i, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    // If memory grows >10MB over 10 samples, potential leak
    const growthMB = (slope * n) / 1024 / 1024;
    
    return growthMB > 10;
  }

  /**
   * Get memory statistics
   */
  getStats(): {
    current: number;
    peak: number;
    average: number;
    trend: 'stable' | 'growing' | 'shrinking';
  } {
    if (this.samples.length === 0) {
      return { current: 0, peak: 0, average: 0, trend: 'stable' };
    }

    const current = this.getCurrentUsage();
    const peak = this.getPeakUsage();
    const average = this.samples.reduce((sum, s) => sum + s.usage, 0) / this.samples.length / 1024 / 1024;

    // Determine trend
    let trend: 'stable' | 'growing' | 'shrinking' = 'stable';
    if (this.samples.length >= 5) {
      const recent = this.samples.slice(-5);
      const older = this.samples.slice(-10, -5);
      
      if (older.length > 0) {
        const recentAvg = recent.reduce((sum, s) => sum + s.usage, 0) / recent.length;
        const olderAvg = older.reduce((sum, s) => sum + s.usage, 0) / older.length;
        
        const diff = recentAvg - olderAvg;
        const diffMB = diff / 1024 / 1024;
        
        if (diffMB > 5) trend = 'growing';
        else if (diffMB < -5) trend = 'shrinking';
      }
    }

    return { current, peak, average, trend };
  }
}

/**
 * CPU monitoring (simplified for browser environment)
 */
export class CPUMonitor {
  private lastSample: { timestamp: number; idleTime: number } | null = null;
  private samples: Array<{ timestamp: number; usage: number }> = [];
  private maxSamples: number = 60; // 1 minute at 1 sample/second
  private spikeThreshold: number = 10; // 10% CPU usage
  private spikeDuration: number = 30000; // 30 seconds
  private spikeStartTime: number | null = null;

  /**
   * Estimate CPU usage based on frame timing
   * Note: This is a rough estimate in browser environment
   */
  sample(): void {
    const now = performance.now();
    
    // Use requestIdleCallback to estimate idle time
    if ('requestIdleCallback' in window) {
      requestIdleCallback((deadline) => {
        const idleTime = deadline.timeRemaining();
        
        if (this.lastSample) {
          const elapsed = now - this.lastSample.timestamp;
          const idleDiff = idleTime - this.lastSample.idleTime;
          
          // Rough estimate: (1 - idle/total) * 100
          const usage = Math.max(0, Math.min(100, (1 - idleDiff / elapsed) * 100));
          
          this.samples.push({ timestamp: now, usage });
          
          if (this.samples.length > this.maxSamples) {
            this.samples.shift();
          }
          
          // 🚀 Performance: Check for CPU spikes
          this.checkForSpikes(usage, now);
        }
        
        this.lastSample = { timestamp: now, idleTime };
      });
    }
  }

  /**
   * Check for sustained CPU spikes
   * @private
   */
  private checkForSpikes(currentUsage: number, timestamp: number): void {
    if (currentUsage > this.spikeThreshold) {
      // Start tracking spike if not already tracking
      if (this.spikeStartTime === null) {
        this.spikeStartTime = timestamp;
      } else {
        // Check if spike has lasted too long
        const spikeDuration = timestamp - this.spikeStartTime;
        if (spikeDuration > this.spikeDuration) {
          console.warn(
            `⚠️ CPU usage spike detected: ${currentUsage.toFixed(1)}% for ${(spikeDuration / 1000).toFixed(0)}s`
          );
          console.warn('[Performance] Consider reducing background tasks or closing unused features');
          
          // Reset spike tracking to avoid repeated warnings
          this.spikeStartTime = timestamp;
        }
      }
    } else {
      // Reset spike tracking when usage drops
      this.spikeStartTime = null;
    }
  }

  /**
   * Get average CPU usage over last N samples
   */
  getAverageUsage(samples: number = 60): number {
    if (this.samples.length === 0) return 0;
    
    const recent = this.samples.slice(-samples);
    const sum = recent.reduce((acc, s) => acc + s.usage, 0);
    
    return sum / recent.length;
  }

  /**
   * Get current CPU usage estimate
   */
  getCurrentUsage(): number {
    if (this.samples.length === 0) return 0;
    return this.samples[this.samples.length - 1].usage;
  }
}

/**
 * Global performance monitor instance
 */
export const startupTimer = new StartupTimer();
export const memoryMonitor = new MemoryMonitor();
export const cpuMonitor = new CPUMonitor();

/**
 * Start automatic monitoring
 */
export function startPerformanceMonitoring(interval: number = 5000): () => void {
  // Sample memory every interval
  const memoryInterval = setInterval(() => {
    memoryMonitor.sample();
  }, interval);

  // Sample CPU every second
  const cpuInterval = setInterval(() => {
    cpuMonitor.sample();
  }, 1000);

  // Log stats in development
  if (import.meta.env.DEV) {
    const statsInterval = setInterval(() => {
      const memStats = memoryMonitor.getStats();
      const cpuUsage = cpuMonitor.getAverageUsage(60);
      
      console.log('[Performance]', {
        memory: `${memStats.current.toFixed(1)}MB (peak: ${memStats.peak.toFixed(1)}MB, trend: ${memStats.trend})`,
        cpu: `${cpuUsage.toFixed(1)}%`,
      });

      // Check for memory leaks
      if (memoryMonitor.detectLeak()) {
        console.warn('⚠️ Potential memory leak detected');
      }
    }, 30000); // Log every 30 seconds

    return () => {
      clearInterval(memoryInterval);
      clearInterval(cpuInterval);
      clearInterval(statsInterval);
    };
  }

  return () => {
    clearInterval(memoryInterval);
    clearInterval(cpuInterval);
  };
}
