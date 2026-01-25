/**
 * useCountdownManager Hook 测试
 * 测试 React Hook 集成
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCountdownManager } from '../../hooks/useCountdownManager';
import { countdownManager } from '../../utils/countdownManager';

describe('useCountdownManager', () => {
  beforeEach(() => {
    countdownManager.clear();
    vi.clearAllTimers();
  });

  afterEach(() => {
    countdownManager.clear();
  });

  describe('基础功能', () => {
    it('应该返回倒计时数据', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 10000).toISOString();

      const { result } = renderHook(() =>
        useCountdownManager(taskId, targetDate)
      );

      expect(result.current).toBeDefined();
      expect(result.current.isExpired).toBe(false);
      expect(result.current.totalSeconds).toBeGreaterThan(0);
    });

    it('应该在组件卸载时自动清理订阅', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 10000).toISOString();

      const { unmount } = renderHook(() =>
        useCountdownManager(taskId, targetDate)
      );

      expect(countdownManager.getSubscriberCount()).toBe(1);

      unmount();

      expect(countdownManager.getSubscriberCount()).toBe(0);
    });

    it('应该在 taskId 变化时重新订阅', () => {
      const targetDate = new Date(Date.now() + 10000).toISOString();
      let taskId = 'test-task-1';

      const { rerender } = renderHook(() =>
        useCountdownManager(taskId, targetDate)
      );

      expect(countdownManager.getTaskCount()).toBe(1);

      taskId = 'test-task-2';
      rerender();

      expect(countdownManager.getTaskCount()).toBe(2);
    });

    it('应该在 targetDate 变化时重新注册', () => {
      const taskId = 'test-task-1';
      let targetDate = new Date(Date.now() + 10000).toISOString();

      const { result, rerender } = renderHook(() =>
        useCountdownManager(taskId, targetDate)
      );

      const initialSeconds = result.current.totalSeconds;

      targetDate = new Date(Date.now() + 20000).toISOString();
      rerender();

      expect(result.current.totalSeconds).toBeGreaterThan(initialSeconds);
    });
  });

  describe('过期回调', () => {
    it('应该在任务过期时触发回调', async () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 100).toISOString();
      const onExpire = vi.fn();

      renderHook(() =>
        useCountdownManager(taskId, targetDate, undefined, onExpire)
      );

      await waitFor(() => {
        expect(onExpire).toHaveBeenCalledTimes(1);
      }, { timeout: 300 });
    });

    it('应该使用最新的 onExpire 回调', async () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 100).toISOString();
      const firstOnExpire = vi.fn();

      const { rerender } = renderHook(
        ({ callback }) => useCountdownManager(taskId, targetDate, undefined, callback),
        { initialProps: { callback: firstOnExpire } }
      );

      // 更新回调
      const secondOnExpire = vi.fn();
      rerender({ callback: secondOnExpire });

      await waitFor(() => {
        // 应该调用最新的回调
        expect(secondOnExpire).toHaveBeenCalledTimes(1);
        // 旧回调不应该被调用
        expect(firstOnExpire).not.toHaveBeenCalled();
      }, { timeout: 300 });
    });
  });

  describe('实时更新', () => {
    it('应该随时间更新倒计时', async () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 5000).toISOString();

      const { result } = renderHook(() =>
        useCountdownManager(taskId, targetDate)
      );

      const initialSeconds = result.current.totalSeconds;

      await waitFor(() => {
        expect(result.current.totalSeconds).toBeLessThan(initialSeconds);
      }, { timeout: 2000 });
    });

    it('应该在过期后停止更新', async () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 100).toISOString();

      const { result } = renderHook(() =>
        useCountdownManager(taskId, targetDate)
      );

      await waitFor(() => {
        expect(result.current.isExpired).toBe(true);
      }, { timeout: 300 });

      // 等待一段时间，确保不会继续更新
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(result.current.isExpired).toBe(true);
      expect(result.current.totalSeconds).toBe(0);
    });
  });

  describe('进度计算', () => {
    it('应该正确计算进度百分比', () => {
      const taskId = 'test-task-1';
      const startDate = new Date(Date.now() - 5000).toISOString();
      const targetDate = new Date(Date.now() + 5000).toISOString();

      const { result } = renderHook(() =>
        useCountdownManager(taskId, targetDate, startDate)
      );

      expect(result.current.progress).toBeGreaterThan(40);
      expect(result.current.progress).toBeLessThan(60);
    });

    it('应该在没有 startDate 时返回 0 进度', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 10000).toISOString();

      const { result } = renderHook(() =>
        useCountdownManager(taskId, targetDate)
      );

      expect(result.current.progress).toBe(0);
    });

    it('应该在过期时返回 100% 进度', async () => {
      const taskId = 'test-task-1';
      const startDate = new Date(Date.now() - 5000).toISOString();
      const targetDate = new Date(Date.now() + 100).toISOString();

      const { result } = renderHook(() =>
        useCountdownManager(taskId, targetDate, startDate)
      );

      await waitFor(() => {
        expect(result.current.isExpired).toBe(true);
        expect(result.current.progress).toBe(100);
      }, { timeout: 300 });
    });
  });

  describe('多组件共享', () => {
    it('应该允许多个组件订阅同一任务', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 10000).toISOString();

      const { result: result1 } = renderHook(() =>
        useCountdownManager(taskId, targetDate)
      );

      const { result: result2 } = renderHook(() =>
        useCountdownManager(taskId, targetDate)
      );

      const { result: result3 } = renderHook(() =>
        useCountdownManager(taskId, targetDate)
      );

      // 所有组件应该获得相同的数据
      expect(result1.current.totalSeconds).toBe(result2.current.totalSeconds);
      expect(result2.current.totalSeconds).toBe(result3.current.totalSeconds);

      // 应该只有一个任务
      expect(countdownManager.getTaskCount()).toBe(1);

      // 应该有三个订阅者
      expect(countdownManager.getSubscriberCount()).toBe(3);
    });

    it('应该在所有组件卸载后清理任务', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 10000).toISOString();

      const { unmount: unmount1 } = renderHook(() =>
        useCountdownManager(taskId, targetDate)
      );

      const { unmount: unmount2 } = renderHook(() =>
        useCountdownManager(taskId, targetDate)
      );

      expect(countdownManager.getSubscriberCount()).toBe(2);

      unmount1();
      expect(countdownManager.getSubscriberCount()).toBe(1);

      unmount2();
      expect(countdownManager.getSubscriberCount()).toBe(0);
    });
  });

  describe('边界情况', () => {
    it('应该处理无效日期', () => {
      const taskId = 'test-task-1';
      const targetDate = 'invalid-date';

      const { result } = renderHook(() =>
        useCountdownManager(taskId, targetDate)
      );

      expect(result.current.isExpired).toBe(true);
      expect(result.current.totalSeconds).toBe(0);
    });

    it('应该处理已过期的日期', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() - 10000).toISOString();

      const { result } = renderHook(() =>
        useCountdownManager(taskId, targetDate)
      );

      expect(result.current.isExpired).toBe(true);
      expect(result.current.totalSeconds).toBe(0);
    });

    it('应该处理空 taskId', () => {
      const taskId = '';
      const targetDate = new Date(Date.now() + 10000).toISOString();

      const { result } = renderHook(() =>
        useCountdownManager(taskId, targetDate)
      );

      expect(result.current).toBeDefined();
    });
  });
});
