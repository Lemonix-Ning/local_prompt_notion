/**
 * 倒计时系统集成测试
 * 测试 CountdownManager + useCountdownManager + ChronoCard 的完整流程
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ChronoCard } from '../../components/ChronoCard';
import { countdownManager } from '../../utils/countdownManager';

describe('倒计时系统集成测试', () => {
  beforeEach(() => {
    countdownManager.clear();
    vi.clearAllTimers();
  });

  afterEach(() => {
    countdownManager.clear();
  });

  describe('ChronoCard 集成', () => {
    it('应该正确渲染倒计时', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 3661000).toISOString(); // 1小时1分1秒

      render(
        <ChronoCard
          taskId={taskId}
          targetDate={targetDate}
          compact={false}
        />
      );

      // 应该显示倒计时
      expect(screen.getByText(/01:01:/)).toBeInTheDocument();
    });

    it('应该在过期时显示 EXPIRED', async () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 100).toISOString();

      render(
        <ChronoCard
          taskId={taskId}
          targetDate={targetDate}
          compact={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('EXPIRED')).toBeInTheDocument();
      }, { timeout: 300 });
    });

    it('应该在过期时触发回调', async () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 100).toISOString();
      const onExpire = vi.fn();

      render(
        <ChronoCard
          taskId={taskId}
          targetDate={targetDate}
          onExpire={onExpire}
          compact={false}
        />
      );

      await waitFor(() => {
        expect(onExpire).toHaveBeenCalledTimes(1);
      }, { timeout: 300 });
    });

    it('应该显示进度条', () => {
      const taskId = 'test-task-1';
      const startDate = new Date(Date.now() - 5000).toISOString();
      const targetDate = new Date(Date.now() + 5000).toISOString();

      const { container } = render(
        <ChronoCard
          taskId={taskId}
          targetDate={targetDate}
          startDate={startDate}
          compact={false}
        />
      );

      // 应该有进度条元素
      const progressBar = container.querySelector('[style*="width"]');
      expect(progressBar).toBeInTheDocument();
    });

    it('应该支持紧凑模式', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 10000).toISOString();

      const { container } = render(
        <ChronoCard
          taskId={taskId}
          targetDate={targetDate}
          compact={true}
        />
      );

      // 紧凑模式应该有特定的类名
      expect(container.querySelector('.chrono-compact')).toBeInTheDocument();
    });
  });

  describe('多个 ChronoCard 共享任务', () => {
    it('应该允许多个 ChronoCard 显示同一任务', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 10000).toISOString();

      const { container } = render(
        <>
          <ChronoCard taskId={taskId} targetDate={targetDate} compact={false} />
          <ChronoCard taskId={taskId} targetDate={targetDate} compact={false} />
          <ChronoCard taskId={taskId} targetDate={targetDate} compact={false} />
        </>
      );

      // 应该只有一个任务
      expect(countdownManager.getTaskCount()).toBe(1);

      // 应该有三个订阅者
      expect(countdownManager.getSubscriberCount()).toBe(3);

      // 应该渲染三个卡片
      const cards = container.querySelectorAll('.chrono-card');
      expect(cards.length).toBe(3);
    });

    it('应该在所有卡片卸载后清理订阅', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 10000).toISOString();

      const { unmount } = render(
        <>
          <ChronoCard taskId={taskId} targetDate={targetDate} compact={false} />
          <ChronoCard taskId={taskId} targetDate={targetDate} compact={false} />
        </>
      );

      expect(countdownManager.getSubscriberCount()).toBe(2);

      unmount();

      expect(countdownManager.getSubscriberCount()).toBe(0);
    });
  });

  describe('状态颜色', () => {
    it('应该在紧急时显示红色', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 1800000).toISOString(); // 30分钟

      const { container } = render(
        <ChronoCard
          taskId={taskId}
          targetDate={targetDate}
          isUrgent={true}
          compact={false}
        />
      );

      // 应该有红色相关的类名或样式
      const card = container.querySelector('.chrono-card');
      expect(card?.className).toMatch(/rose/);
    });

    it('应该在正常时显示青色', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 86400000).toISOString(); // 1天

      const { container } = render(
        <ChronoCard
          taskId={taskId}
          targetDate={targetDate}
          compact={false}
        />
      );

      // 应该有青色相关的类名或样式
      const card = container.querySelector('.chrono-card');
      expect(card?.className).toMatch(/cyan/);
    });
  });

  describe('实时更新', () => {
    it('应该随时间更新显示', async () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 5000).toISOString();

      const { container } = render(
        <ChronoCard
          taskId={taskId}
          targetDate={targetDate}
          compact={false}
        />
      );

      // 获取初始文本
      const initialText = container.textContent;

      // 等待 2 秒
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 文本应该已经改变
      const updatedText = container.textContent;
      expect(updatedText).not.toBe(initialText);
    });
  });

  describe('性能测试', () => {
    it('应该能够渲染 100 个 ChronoCard', () => {
      const targetDate = new Date(Date.now() + 10000).toISOString();
      const startTime = performance.now();

      const { container } = render(
        <>
          {Array.from({ length: 100 }, (_, i) => (
            <ChronoCard
              key={i}
              taskId={`task-${i}`}
              targetDate={targetDate}
              compact={true}
            />
          ))}
        </>
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 应该在 1 秒内完成渲染
      expect(duration).toBeLessThan(1000);

      // 应该有 100 个任务
      expect(countdownManager.getTaskCount()).toBe(100);

      // 应该渲染 100 个卡片
      const cards = container.querySelectorAll('.chrono-compact');
      expect(cards.length).toBe(100);
    });
  });

  describe('边界情况', () => {
    it('应该处理无效日期', () => {
      const taskId = 'test-task-1';
      const targetDate = 'invalid-date';

      render(
        <ChronoCard
          taskId={taskId}
          targetDate={targetDate}
          compact={false}
        />
      );

      // 应该显示 EXPIRED
      expect(screen.getByText('EXPIRED')).toBeInTheDocument();
    });

    it('应该处理已过期的日期', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() - 10000).toISOString();

      render(
        <ChronoCard
          taskId={taskId}
          targetDate={targetDate}
          compact={false}
        />
      );

      // 应该显示 EXPIRED
      expect(screen.getByText('EXPIRED')).toBeInTheDocument();
    });

    it('应该处理空 taskId', () => {
      const taskId = '';
      const targetDate = new Date(Date.now() + 10000).toISOString();

      const { container } = render(
        <ChronoCard
          taskId={taskId}
          targetDate={targetDate}
          compact={false}
        />
      );

      // 应该正常渲染
      expect(container.querySelector('.chrono-card')).toBeInTheDocument();
    });
  });

  describe('内存泄漏检测', () => {
    it('应该在卸载后清理所有资源', () => {
      const targetDate = new Date(Date.now() + 10000).toISOString();

      const { unmount } = render(
        <>
          {Array.from({ length: 50 }, (_, i) => (
            <ChronoCard
              key={i}
              taskId={`task-${i}`}
              targetDate={targetDate}
              compact={true}
            />
          ))}
        </>
      );

      expect(countdownManager.getTaskCount()).toBe(50);
      expect(countdownManager.getSubscriberCount()).toBe(50);

      unmount();

      expect(countdownManager.getSubscriberCount()).toBe(0);
    });

    it('应该在重新渲染时不泄漏订阅', () => {
      const taskId = 'test-task-1';
      const targetDate = new Date(Date.now() + 10000).toISOString();

      const { rerender } = render(
        <ChronoCard
          taskId={taskId}
          targetDate={targetDate}
          compact={false}
        />
      );

      expect(countdownManager.getSubscriberCount()).toBe(1);

      // 重新渲染 10 次
      for (let i = 0; i < 10; i++) {
        rerender(
          <ChronoCard
            taskId={taskId}
            targetDate={targetDate}
            compact={false}
          />
        );
      }

      // 订阅者数量应该保持为 1
      expect(countdownManager.getSubscriberCount()).toBe(1);
    });
  });
});
