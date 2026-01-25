import { cpuMonitor, memoryMonitor, startupTimer } from './performanceMonitor';

export const createPerformanceSnapshot = () => {
  const startup = startupTimer.getStartupMetrics();
  const memoryStats = memoryMonitor.getStats();
  const idleCpuUsage = cpuMonitor.getAverageUsage(60);
  return {
    timestamp: new Date().toISOString(),
    startup,
    runtime: {
      idleCpuUsage,
      activeTaskCpuUsage: idleCpuUsage,
      memoryUsage: memoryStats.current,
      memoryPeak: memoryStats.peak,
      frameRate: 60,
    },
  };
};
