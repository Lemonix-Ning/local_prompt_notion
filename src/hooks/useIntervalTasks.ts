/**
 * useIntervalTasks - 极简版 Interval 任务 Hook
 * 
 * 核心原则：
 * 1. 前端只负责通知展示
 * 2. 不做任何时间计算
 * 3. 不维护任何黑名单或状态
 */

import { useState, useEffect } from 'react';
import { PromptData } from '../types';

type PendingTask = PromptData;

export function useIntervalTasks(apiBaseUrl: string, enabled: boolean = true) {
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isTauriEnv = typeof window !== 'undefined' && (
    (window as any).__TAURI_INTERNALS__ ||
    (window as any).__TAURI__ ||
    window.location.protocol === 'tauri:' ||
    (window.location.protocol === 'https:' && window.location.hostname === 'tauri.localhost')
  );

  /**
   * 获取待通知的任务
   */
  const fetchPendingTasks = async () => {
    if (!enabled) return;

    try {
      setIsLoading(true);
      setError(null);

      if (isTauriEnv) {
        const { invoke } = await import('@tauri-apps/api/core');
        const tasks = await invoke<PendingTask[]>('get_pending_tasks');
        setPendingTasks(tasks || []);
        return;
      }

      setPendingTasks([]);
      return;
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
      if (isTauriEnv) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('acknowledge_task', { taskId });
        setPendingTasks(prev => prev.filter(t => t.meta.id !== taskId));
        return { success: true };
      }

      return { success: false, error: 'Unsupported' };
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
      if (isTauriEnv) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('set_window_visibility', { isVisible });
        return;
      }

      return;
    } catch (err) {
      console.error('[useIntervalTasks] Error notifying visibility:', err);
    }
  };

  /**
   * 启动自适应轮询
   */
  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (isTauriEnv) {
      let unlisten: (() => void) | undefined;
      let visibility: boolean | null = null;

      const applyVisibility = (isVisible: boolean) => {
        if (visibility === isVisible) return;
        visibility = isVisible;
        notifyVisibility(isVisible);
      };

      const handleVisibility = () => {
        applyVisibility(document.visibilityState === 'visible');
      };

      const handleFocus = () => {
        applyVisibility(true);
      };

      const handleBlur = () => {
        applyVisibility(false);
      };

      (async () => {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen('task_due', () => {
          fetchPendingTasks();
        });
        await fetchPendingTasks();
        applyVisibility(document.visibilityState === 'visible');
      })();

      document.addEventListener('visibilitychange', handleVisibility);
      window.addEventListener('focus', handleFocus);
      window.addEventListener('blur', handleBlur);

      return () => {
        if (unlisten) unlisten();
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('blur', handleBlur);
      };
    }

    return;
  }, [enabled, apiBaseUrl, isTauriEnv]);

  return {
    pendingTasks,
    isLoading,
    error,
    acknowledgeTask,
    refresh: fetchPendingTasks,
  };
}
