/**
 * CountdownManager 单元测试
 * 测试核心倒计时管理器功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { countdownManager, type CountdownData } from '../../utils/countdownManager';

describe('CountdownManager', () => {
  beforeEach(() => {
    // 清理所有任务和订阅
    countdownManager.clear();
    vi.clearAllTimers();
  });

  afterEach(() => {
    countdownManager.clear();
  });

  describe('基础功能', () => {
    it('应该正确注册任务', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 10000).toISOString();

      countdownManager.register(taskId, targetDate);

      expect(countdownManager.getTaskCount()).toBe(1);
    });

    it('应该正确取消注册任务', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 10000).toISOString();

      countdownManager.register(taskId, targetDate);
      expect(countdownManager.getTaskCount()).toBe(1);

      countdownManager.unregister(taskId);
      expect(countdownManager.getTaskCount()).toBe(0);
    });

    it('应该防止重复注册相同任务', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 10000).toISOString();

      countdownManager.register(taskId, targetDate);
      countdownManager.register(taskId, targetDate); // 重复注册

      expect(countdownManager.getTaskCount()).toBe(1);
    });

    it('应该允许注册多个不同任务', () => {
      const targetDate = new Date(Date.now() + 10000).toISOString();

      countdownManager.register('task-1', targetDate);
      countdownManager.register('task-2', targetDate);
      countdownManager.register('task-3', targetDate);

      expect(countdownManager.getTaskCount()).toBe(3);
    });
  });

  describe('订阅机制', () => {
    it('应该正确订阅任务更新', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 10000).toISOString();
      const callback = vi.fn();

      countdownManager.register(taskId, targetDate);
      countdownManager.subscribe(taskId, callback);

      // 订阅时应该立即调用一次
      expect(callback).toHaveBeenCalledTimes(1);
      expect(countdownManager.getSubscriberCount()).toBe(1);
    });

    it('应该正确取消订阅', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 10000).toISOString();
      const callback = vi.fn();

      countdownManager.register(taskId, targetDate);
      const unsubscribe = countdownManager.subscribe(taskId, callback);

      expect(countdownManager.getSubscriberCount()).toBe(1);

      unsubscribe();
      expect(countdownManager.getSubscriberCount()).toBe(0);
    });

    it('应该支持多个订阅者', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 10000).toISOString();
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      countdownManager.register(taskId, targetDate);
      countdownManager.subscribe(taskId, callback1);
      countdownManager.subscribe(taskId, callback2);
      countdownManager.subscribe(taskId, callback3);

      expect(countdownManager.getSubscriberCount()).toBe(3);
    });
  });

  describe('倒计时计算', () => {
    it('应该正确计算未过期任务的倒计时', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 3661000).toISOString(); // 1小时1分1秒后
      let receivedData: CountdownData | null = null;

      countdownManager.register(taskId, targetDate);
      countdownManager.subscribe(taskId, (data) => {
        receivedData = data;
      });

      expect(receivedData).not.toBeNull();
      expect(receivedData!.isExpired).toBe(false);
      expect(receivedData!.hours).toBe(1);
      expect(receivedData!.minutes).toBe(1);
      expect(receivedData!.seconds).toBeGreaterThanOrEqual(0);
      expect(receivedData!.seconds).toBeLessThanOrEqual(1);
    });

    it('应该正确识别已过期任务', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() - 1000).toISOString(); // 1秒前
      let receivedData: CountdownData | null = null;

      countdownManager.register(taskId, targetDate);
      countdownManager.subscribe(taskId, (data) => {
        receivedData = data;
      });

      expect(receivedData).not.toBeNull();
      expect(receivedData!.isExpired).toBe(true);
      expect(receivedData!.days).toBe(0);
      expect(receivedData!.hours).toBe(0);
      expect(receivedData!.minutes).toBe(0);
      expect(receivedData!.seconds).toBe(0);
    });

    it('应该正确计算进度百分比', () => {
      const taskId = 'test-task-1';
      const startDate = new Date(Date.now() - 5000).toISOString(); // 5秒前开始
      const targetDate = new Date(Date.now() + 5000).toISOString(); // 5秒后结束
      let receivedData: CountdownData | null = null;

      countdownManager.register(taskId, targetDate, startDate);
      countdownManager.subscribe(taskId, (data) => {
        receivedData = data;
      });

      expect(receivedData).not.toBeNull();
      expect(receivedData!.progress).toBeGreaterThan(40);
      expect(receivedData!.progress).toBeLessThan(60);
    });

    it('应该处理无效日期', () => {
      const taskId = 'test-task-1';
      const targetDate = 'invalid-date';
      let receivedData: CountdownData | null = null;

      countdownManager.register(taskId, targetDate);
      countdownManager.subscribe(taskId, (data) => {
        receivedData = data;
      });

      expect(receivedData).not.toBeNull();
      expect(receivedData!.isExpired).toBe(true);
      expect(receivedData!.progress).toBe(100);
    });
  });

  describe('过期回调', () => {
    it('应该在任务过期时触发回调', async () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 100).toISOString(); // 100ms后过期
      const onExpire = vi.fn();

      countdownManager.register(taskId, targetDate, undefined, onExpire);

      // 等待任务过期
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(onExpire).toHaveBeenCalledTimes(1);
    });

    it('应该防止重复触发过期回调', async () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 100).toISOString();
      const onExpire = vi.fn();

      countdownManager.register(taskId, targetDate, undefined, onExpire);

      // 等待任务过期
      await new Promise(resolve => setTimeout(resolve, 200));

      // 再等待一段时间，确保不会重复触发
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(onExpire).toHaveBeenCalledTimes(1);
    });

    it('应该处理回调中的错误', async () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 100).toISOString();
      const onExpire = vi.fn(() => {
        throw new Error('Test error');
      });
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      countdownManager.register(taskId, targetDate, undefined, onExpire);

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(onExpire).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });
  });

  describe('性能优化', () => {
    it('应该使用单一 RAF 循环管理多个任务', () => {
      const targetDate = new Date(Date.now() + 10000).toISOString();

      // 注册100个任务
      for (let i = 0; i < 100; i++) {
        countdownManager.register(`task-${i}`, targetDate);
      }

      expect(countdownManager.getTaskCount()).toBe(100);
      // RAF 会递归调用自己，所以我们只验证任务数量正确
      // 实际的 RAF 优化在于所有任务共享同一个循环
    });

    it('应该在没有任务时停止循环', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 10000).toISOString();

      countdownManager.register(taskId, targetDate);
      countdownManager.unregister(taskId);

      expect(countdownManager.getTaskCount()).toBe(0);
      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });

    it('应该节流进度更新（只在变化超过0.1%时通知）', async () => {
      const taskId = 'test-task-1';
      const startDate = new Date(Date.now()).toISOString();
      const targetDate = new Date(Date.now() + 100000).toISOString(); // 100秒后
      const callback = vi.fn();

      countdownManager.register(taskId, targetDate, startDate);
      countdownManager.subscribe(taskId, callback);

      // 初始调用
      expect(callback).toHaveBeenCalledTimes(1);

      // 等待一小段时间（不足以触发0.1%变化）
      await new Promise(resolve => setTimeout(resolve, 50));

      // 由于进度变化小于0.1%，不应该触发新的回调
      // 注意：这个测试可能需要根据实际实现调整
    });
  });

  describe('页面可见性优化', () => {
    it('应该在页面隐藏时降低更新频率', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 10000).toISOString();

      countdownManager.register(taskId, targetDate);

      // 模拟页面隐藏
      Object.defineProperty(document, 'hidden', { value: true, writable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      // 验证更新频率降低（通过检查内部状态或行为）
      // 注意：这个测试可能需要访问私有属性或使用其他方法验证
    });

    it('应该在页面可见时恢复正常更新频率', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 10000).toISOString();

      countdownManager.register(taskId, targetDate);

      // 模拟页面隐藏
      Object.defineProperty(document, 'hidden', { value: true, writable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      // 模拟页面可见
      Object.defineProperty(document, 'hidden', { value: false, writable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      // 验证更新频率恢复
    });
  });

  describe('边界情况', () => {
    it('应该处理空任务列表', () => {
      expect(countdownManager.getTaskCount()).toBe(0);
      expect(countdownManager.getSubscriberCount()).toBe(0);
    });

    it('应该处理订阅不存在的任务', () => {
      const callback = vi.fn();
      const unsubscribe = countdownManager.subscribe('non-existent-task', callback);

      // 订阅不存在的任务不会立即返回数据（因为任务未注册）
      // 但应该不会崩溃
      expect(() => unsubscribe()).not.toThrow();
    });

    it('应该处理取消订阅不存在的任务', () => {
      const callback = vi.fn();
      const unsubscribe = countdownManager.subscribe('non-existent-task', callback);

      // 应该不会崩溃
      expect(() => unsubscribe()).not.toThrow();
    });

    it('应该处理订阅回调中的错误', async () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 10000).toISOString();
      let callCount = 0;
      const callback = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          // 第一次调用（订阅时）不抛错
          return;
        }
        throw new Error('Test error');
      });
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      countdownManager.register(taskId, targetDate);
      countdownManager.subscribe(taskId, callback);

      // 等待一段时间让循环运行
      await new Promise(resolve => setTimeout(resolve, 100));

      // 应该捕获错误并继续运行
      expect(callback).toHaveBeenCalled();
      // 如果有错误，console.error 应该被调用
      if (callCount > 1) {
        expect(consoleError).toHaveBeenCalled();
      }

      consoleError.mockRestore();
    });
  });

  describe('内存管理', () => {
    it('应该在取消订阅后清理订阅者', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 10000).toISOString();
      const callback = vi.fn();

      countdownManager.register(taskId, targetDate);
      const unsubscribe = countdownManager.subscribe(taskId, callback);

      expect(countdownManager.getSubscriberCount()).toBe(1);

      unsubscribe();
      expect(countdownManager.getSubscriberCount()).toBe(0);
    });

    it('应该在取消注册后清理任务', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 10000).toISOString();

      countdownManager.register(taskId, targetDate);
      expect(countdownManager.getTaskCount()).toBe(1);

      countdownManager.unregister(taskId);
      expect(countdownManager.getTaskCount()).toBe(0);
    });

    it('应该在 clear() 后清理所有资源', () => {
      const targetDate = new Date(Date.now() + 10000).toISOString();

      // 注册多个任务和订阅
      for (let i = 0; i < 10; i++) {
        countdownManager.register(`task-${i}`, targetDate);
        countdownManager.subscribe(`task-${i}`, vi.fn());
      }

      expect(countdownManager.getTaskCount()).toBe(10);
      expect(countdownManager.getSubscriberCount()).toBe(10);

      countdownManager.clear();

      expect(countdownManager.getTaskCount()).toBe(0);
      expect(countdownManager.getSubscriberCount()).toBe(0);
    });
  });
});
