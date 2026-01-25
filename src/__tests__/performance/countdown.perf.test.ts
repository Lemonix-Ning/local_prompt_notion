/**
 * CountdownManager 性能测试
 * 测试大量任务场景下的性能表现
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { countdownManager } from '../../utils/countdownManager';

describe('CountdownManager 性能测试', () => {
  beforeEach(() => {
    countdownManager.clear();
    vi.clearAllTimers();
  });

  afterEach(() => {
    countdownManager.clear();
  });

  describe('大量任务场景', () => {
    it('应该能够处理 100 个任务', () => {
      const targetDate = new Date(Date.now() + 10000).toISOString();
      const startTime = performance.now();

      // 注册 100 个任务
      for (let i = 0; i < 100; i++) {
        countdownManager.register(`task-${i}`, targetDate);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(countdownManager.getTaskCount()).toBe(100);
      expect(duration).toBeLessThan(100); // 应该在 100ms 内完成
    });

    it('应该能够处理 500 个任务', () => {
      const targetDate = new Date(Date.now() + 10000).toISOString();
      const startTime = performance.now();

      // 注册 500 个任务
      for (let i = 0; i < 500; i++) {
        countdownManager.register(`task-${i}`, targetDate);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(countdownManager.getTaskCount()).toBe(500);
      expect(duration).toBeLessThan(500); // 应该在 500ms 内完成
    });

    it('应该能够处理 1000 个任务', () => {
      const targetDate = new Date(Date.now() + 10000).toISOString();
      const startTime = performance.now();

      // 注册 1000 个任务
      for (let i = 0; i < 1000; i++) {
        countdownManager.register(`task-${i}`, targetDate);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(countdownManager.getTaskCount()).toBe(1000);
      expect(duration).toBeLessThan(1000); // 应该在 1秒 内完成
    });
  });

  describe('订阅性能', () => {
    it('应该能够快速处理 100 个订阅', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 10000).toISOString();
      const callbacks: Array<() => void> = [];

      countdownManager.register(taskId, targetDate);

      const startTime = performance.now();

      // 创建 100 个订阅
      for (let i = 0; i < 100; i++) {
        const callback = vi.fn();
        callbacks.push(callback);
        countdownManager.subscribe(taskId, callback);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(countdownManager.getSubscriberCount()).toBe(100);
      expect(duration).toBeLessThan(100); // 应该在 100ms 内完成
    });

    it('应该能够快速取消 100 个订阅', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 10000).toISOString();
      const unsubscribers: Array<() => void> = [];

      countdownManager.register(taskId, targetDate);

      // 创建 100 个订阅
      for (let i = 0; i < 100; i++) {
        const unsubscribe = countdownManager.subscribe(taskId, vi.fn());
        unsubscribers.push(unsubscribe);
      }

      const startTime = performance.now();

      // 取消所有订阅
      unsubscribers.forEach(unsubscribe => unsubscribe());

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(countdownManager.getSubscriberCount()).toBe(0);
      expect(duration).toBeLessThan(100); // 应该在 100ms 内完成
    });
  });

  describe('内存使用', () => {
    it('应该在取消注册后释放内存', () => {
      const targetDate = new Date(Date.now() + 10000).toISOString();

      // 注册 1000 个任务
      for (let i = 0; i < 1000; i++) {
        countdownManager.register(`task-${i}`, targetDate);
      }

      expect(countdownManager.getTaskCount()).toBe(1000);

      // 取消所有任务
      for (let i = 0; i < 1000; i++) {
        countdownManager.unregister(`task-${i}`);
      }

      expect(countdownManager.getTaskCount()).toBe(0);
    });

    it('应该在 clear() 后释放所有内存', () => {
      const targetDate = new Date(Date.now() + 10000).toISOString();

      // 注册 1000 个任务和订阅
      for (let i = 0; i < 1000; i++) {
        countdownManager.register(`task-${i}`, targetDate);
        countdownManager.subscribe(`task-${i}`, vi.fn());
      }

      expect(countdownManager.getTaskCount()).toBe(1000);
      expect(countdownManager.getSubscriberCount()).toBe(1000);

      countdownManager.clear();

      expect(countdownManager.getTaskCount()).toBe(0);
      expect(countdownManager.getSubscriberCount()).toBe(0);
    });
  });

  describe('RAF 循环性能', () => {
    it('应该使用单一 RAF 循环管理所有任务', () => {
      const targetDate = new Date(Date.now() + 10000).toISOString();
      const rafSpy = vi.spyOn(global, 'requestAnimationFrame');

      // 注册 100 个任务
      for (let i = 0; i < 100; i++) {
        countdownManager.register(`task-${i}`, targetDate);
      }

      // RAF 应该只被调用一次（启动循环）
      expect(rafSpy).toHaveBeenCalledTimes(1);

      rafSpy.mockRestore();
    });

    it('应该在没有任务时停止 RAF 循环', () => {
      const targetDate = new Date(Date.now() + 10000).toISOString();
      const cancelSpy = vi.spyOn(global, 'cancelAnimationFrame');

      // 注册并立即取消任务
      countdownManager.register('task-1', targetDate);
      countdownManager.unregister('task-1');

      expect(cancelSpy).toHaveBeenCalled();

      cancelSpy.mockRestore();
    });
  });

  describe('更新频率', () => {
    it('应该节流进度更新', async () => {
      const taskId = 'test-task-1';
      const startDate = new Date(Date.now()).toISOString();
      const targetDate = new Date(Date.now() + 100000).toISOString(); // 100秒
      const callback = vi.fn();

      countdownManager.register(taskId, targetDate, startDate);
      countdownManager.subscribe(taskId, callback);

      // 初始调用
      const initialCallCount = callback.mock.calls.length;

      // 等待 1 秒
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 由于进度节流（0.1%），回调次数应该远少于 1000 次
      const finalCallCount = callback.mock.calls.length;
      expect(finalCallCount - initialCallCount).toBeLessThan(100);
    });
  });

  describe('并发场景', () => {
    it('应该能够同时注册和取消注册任务', () => {
      const targetDate = new Date(Date.now() + 10000).toISOString();

      // 同时注册和取消注册
      for (let i = 0; i < 100; i++) {
        countdownManager.register(`task-${i}`, targetDate);
        if (i % 2 === 0) {
          countdownManager.unregister(`task-${i}`);
        }
      }

      expect(countdownManager.getTaskCount()).toBe(50);
    });

    it('应该能够同时订阅和取消订阅', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 10000).toISOString();
      const unsubscribers: Array<() => void> = [];

      countdownManager.register(taskId, targetDate);

      // 同时订阅和取消订阅
      for (let i = 0; i < 100; i++) {
        const unsubscribe = countdownManager.subscribe(taskId, vi.fn());
        unsubscribers.push(unsubscribe);
        if (i % 2 === 0) {
          unsubscribe();
        }
      }

      expect(countdownManager.getSubscriberCount()).toBe(50);
    });
  });

  describe('长时间运行', () => {
    it('应该能够稳定运行 10 秒', async () => {
      const targetDate = new Date(Date.now() + 20000).toISOString();
      const callback = vi.fn();

      // 注册 10 个任务
      for (let i = 0; i < 10; i++) {
        countdownManager.register(`task-${i}`, targetDate);
        countdownManager.subscribe(`task-${i}`, callback);
      }

      // 运行 10 秒
      await new Promise(resolve => setTimeout(resolve, 10000));

      // 应该没有崩溃，任务仍然存在
      expect(countdownManager.getTaskCount()).toBe(10);
      expect(countdownManager.getSubscriberCount()).toBe(10);

      // 回调应该被调用多次
      expect(callback.mock.calls.length).toBeGreaterThan(0);
    }, 15000); // 设置更长的超时时间
  });
});
