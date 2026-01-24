/**
 * useIntervalTasks - 极简版 Interval 任务 Hook (with Adaptive Polling)
 * 
 * 核心原则：
 * 1. 前端只负责轮询后端 API
 * 2. 不做任何时间计算
 * 3. 不维护任何黑名单或状态
 * 4. 使用自适应轮询：可见时 2s，隐藏时 30s，无任务时暂停
 */

import { useState, useEffect, useRef } from 'react';
import { PromptData } from '../types';
import { AdaptivePollingManager } from '../utils/adaptivePolling';

interface PendingTask extends PromptData {
  nextTriggerAt: number;
}

export function useIntervalTasks(apiBaseUrl: string, enabled: boolean = true) {
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingManagerRef = useRef<AdaptivePollingManager | null>(null);

  /**
   * 获取待通知的任务
   */
  const fetchPendingTasks = async () => {
    if (!enabled) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${apiBaseUrl}/api/interval-tasks/pending`);
      const result = await response.json();

      if (result.success) {
        const tasks = result.data || [];
        setPendingTasks(tasks);
      } else {
        setError(result.error || 'Failed to fetch pending tasks');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 确认任务已通知（Dismiss）
   */
  const acknowledgeTask = async (taskId: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/interval-tasks/${taskId}/acknowledge`, {
        method: 'POST',
      });
      const result = await response.json();

      if (result.success) {
        // 从待通知列表中移除
        setPendingTasks(prev => prev.filter(t => t.meta.id !== taskId));
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (err) {
      console.error('[useIntervalTasks] Error acknowledging task:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  };

  /**
   * 通知后端窗口可见性状态变化
   */
  const notifyVisibility = async (isVisible: boolean) => {
    try {
      await fetch(`${apiBaseUrl}/api/interval-tasks/visibility`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isVisible }),
      });
    } catch (err) {
      console.error('[useIntervalTasks] Error notifying visibility:', err);
    }
  };

  /**
   * 启动自适应轮询
   */
  useEffect(() => {
    if (!enabled) {
      // Cleanup polling manager if disabled
      if (pollingManagerRef.current) {
        pollingManagerRef.current.destroy();
        pollingManagerRef.current = null;
      }
      return;
    }

    // Create adaptive polling manager
    pollingManagerRef.current = new AdaptivePollingManager(
      fetchPendingTasks,
      {
        foregroundInterval: 2000,   // 2s when visible (more responsive)
        backgroundInterval: 30000,  // 30s when hidden (save resources)
        idleInterval: 2000,         // Keep polling even when no active tasks
      }
    );

    // Set visibility change callback to notify backend
    pollingManagerRef.current.setVisibilityChangeCallback((isVisible: boolean) => {
      notifyVisibility(isVisible);
    });

    // Start polling
    pollingManagerRef.current.start();

    // Update task state based on pending tasks
    const updateTaskState = () => {
      if (pollingManagerRef.current) {
        pollingManagerRef.current.setHasActiveTasks(pendingTasks.length > 0);
      }
    };
    updateTaskState();

    return () => {
      if (pollingManagerRef.current) {
        pollingManagerRef.current.destroy();
        pollingManagerRef.current = null;
      }
    };
  }, [enabled, apiBaseUrl]);

  // Update polling manager when pending tasks change
  useEffect(() => {
    if (pollingManagerRef.current) {
      pollingManagerRef.current.setHasActiveTasks(pendingTasks.length > 0);
    }
  }, [pendingTasks.length]);

  return {
    pendingTasks,
    isLoading,
    error,
    acknowledgeTask,
    refresh: fetchPendingTasks,
  };
}
