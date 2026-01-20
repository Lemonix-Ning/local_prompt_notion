// Performance metrics data models and types

export interface PerformanceMetrics {
  // Startup metrics
  startup: {
    totalTime: number;              // ms to interactive
    sidecarStartTime: number;       // ms to sidecar ready
    vaultScanTime: number;          // ms to complete vault scan
    firstPaintTime: number;         // ms to first paint
    timeToInteractive: number;      // ms to fully interactive
  };
  
  // Runtime metrics
  runtime: {
    idleCpuUsage: number;          // % average over 1 minute
    activeTaskCpuUsage: number;    // % average with tasks running
    memoryUsage: number;           // MB current usage
    memoryPeak: number;            // MB peak usage
    frameRate: number;             // fps during scrolling
  };
  
  // Bundle metrics
  bundle: {
    mainSize: number;              // bytes uncompressed
    mainGzipSize: number;          // bytes gzipped
    vendorSize: number;            // bytes uncompressed
    vendorGzipSize: number;        // bytes gzipped
    totalSize: number;             // bytes total
    chunkCount: number;            // number of chunks
    largestChunk: {
      name: string;
      size: number;
    };
  };
  
  // Task timer metrics
  taskTimer: {
    frontendPollingInterval: number;  // ms current interval
    backendTickRate: number;          // ms current tick rate
    activeTaskCount: number;          // number of active tasks
    notificationCount: number;        // notifications sent
    batchUpdateCount: number;         // batched updates
  };
  
  // Responsiveness metrics
  responsiveness: {
    searchDebounceDelay: number;      // ms
    categorySwitchTime: number;       // ms
    scrollFrameRate: number;          // fps
    animationFrameRate: number;       // fps
  };
}

export interface PerformanceBaseline {
  startupTime: number;           // milliseconds
  idleCpuUsage: number;         // percentage
  activeTaskCpuUsage: number;   // percentage
  memoryUsage: number;          // megabytes
  bundleSizes: {
    main: number;
    vendor: number;
    chunks: Record<string, number>;
  };
}

export interface PerformanceTest {
  id: string;
  name: string;
  category: 'startup' | 'memory' | 'cpu' | 'bundle' | 'responsiveness';
  threshold: number;
  unit: string;
  run: () => Promise<number>;
}

export interface PerformanceMetric {
  value: number;
  unit: string;
  timestamp: number;
  passed: boolean;
  threshold: number;
}

export interface BundleAnalysis {
  totalSize: number;
  chunks: Array<{
    name: string;
    size: number;
    gzipSize: number;
    modules: Array<{
      name: string;
      size: number;
    }>;
  }>;
  warnings: string[];
}

export interface PerformanceReport {
  timestamp: number;
  baseline: PerformanceMetrics;
  current: PerformanceMetrics;
  improvements: {
    [key: string]: {
      before: number;
      after: number;
      improvement: number;  // percentage
      passed: boolean;
    };
  };
  warnings: string[];
}

export interface OptimizationConfig {
  // Feature flags
  features: {
    virtualScrolling: boolean;
    lazyImageLoading: boolean;
    adaptivePolling: boolean;
    bundleCodeSplitting: boolean;
    apiCaching: boolean;
  };
  
  // Thresholds
  thresholds: {
    virtualScrollingMinItems: number;     // 50
    lazyLoadRootMargin: string;           // "200px"
    searchDebounceDelay: number;          // 300ms
    notificationThrottleInterval: number; // 10000ms
    apiCacheTTL: number;                  // 5000ms
  };
  
  // Polling configuration
  polling: {
    foregroundInterval: number;           // 5000ms
    backgroundInterval: number;           // 30000ms
    backendForegroundTick: number;        // 1000ms
    backendBackgroundTick: number;        // 10000ms
  };
  
  // Memory limits
  memory: {
    maxUsage: number;                     // 200MB
    warningThreshold: number;             // 150MB
    leakDetectionEnabled: boolean;
  };
  
  // Bundle limits
  bundle: {
    maxChunkSize: number;                 // 300KB
    compressionLevel: number;             // 9
    removeConsole: boolean;               // true in production
  };
}
