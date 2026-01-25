/**
 * CountdownManager - 高性能倒计时管理器
 * 
 * 核心特性：
 * - 单一 RAF 循环，统一管理所有倒计时
 * - 智能节流，根据剩余时间调整更新频率
 * - 精准到点触发，使用时间戳而非定时器
 * - 可见性优化，页面隐藏时降低更新频率
 */

export interface CountdownData {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isExpired: boolean;
  progress: number; // 0-100
}

interface CountdownTask {
  taskId: string;
  targetDate: string;
  startDate?: string;
  onExpire?: () => void;
  expired?: boolean; // 标记是否已触发过期回调
  lastProgress?: number; // 上次的进度值，用于减少更新
}

type SubscriberCallback = (data: CountdownData) => void;

class CountdownManager {
  private tasks: Map<string, CountdownTask> = new Map();
  private subscribers: Map<string, Set<SubscriberCallback>> = new Map();
  private rafId: number | null = null;
  private lastUpdate: number = 0;
  private isPageVisible: boolean = true;
  
  constructor() {
    // 监听页面可见性变化
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }
  
  /**
   * 注册倒计时任务
   */
  register(taskId: string, targetDate: string, startDate?: string, onExpire?: () => void): void {
    const existingTask = this.tasks.get(taskId);
    
    console.log('[CountdownManager] 注册任务:', {
      taskId,
      targetDate,
      startDate,
      hasOnExpire: !!onExpire,
      isExisting: !!existingTask,
    });
    
    // 如果任务已存在且参数相同，不重复注册
    if (
      existingTask &&
      existingTask.targetDate === targetDate &&
      existingTask.startDate === startDate
    ) {
      // 更新 onExpire 回调
      if (onExpire) {
        existingTask.onExpire = onExpire;
        console.log('[CountdownManager] 更新现有任务的 onExpire 回调');
      }
      return;
    }
    
    this.tasks.set(taskId, {
      taskId,
      targetDate,
      startDate,
      onExpire,
      expired: false,
      lastProgress: undefined,
    });
    
    console.log('[CountdownManager] 任务已注册，总任务数:', this.tasks.size);
    
    this.startLoop();
  }
  
  /**
   * 取消注册任务
   */
  unregister(taskId: string): void {
    this.tasks.delete(taskId);
    this.subscribers.delete(taskId);
    
    // 如果没有任务了，停止循环
    if (this.tasks.size === 0) {
      this.stopLoop();
    }
  }
  
  /**
   * 订阅任务更新
   */
  subscribe(taskId: string, callback: SubscriberCallback): () => void {
    if (!this.subscribers.has(taskId)) {
      this.subscribers.set(taskId, new Set());
    }
    this.subscribers.get(taskId)!.add(callback);
    
    // 立即返回当前数据
    const task = this.tasks.get(taskId);
    if (task) {
      callback(this.calculate(task));
    }
    
    // 返回取消订阅函数
    return () => {
      const subs = this.subscribers.get(taskId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(taskId);
        }
      }
    };
  }
  
  /**
   * 启动 RAF 循环
   */
  private startLoop(): void {
    if (this.rafId !== null) return;
    
    const loop = (timestamp: number) => {
      // 智能节流：根据页面可见性调整更新频率
      const updateInterval = this.isPageVisible ? 1000 : 5000; // 可见：1秒，隐藏：5秒
      
      if (timestamp - this.lastUpdate < updateInterval) {
        this.rafId = requestAnimationFrame(loop);
        return;
      }
      
      this.lastUpdate = timestamp;
      
      // 更新所有任务
      for (const [taskId, task] of this.tasks) {
        const data = this.calculate(task);
        
        // 触发到期回调（只触发一次）
        if (data.isExpired && task.onExpire && !task.expired) {
          task.expired = true;
          console.log('[CountdownManager] 任务过期，触发回调:', {
            taskId,
            targetDate: task.targetDate,
            hasCallback: !!task.onExpire,
          });
          try {
            task.onExpire();
          } catch (error) {
            console.error(`[CountdownManager] Error in onExpire callback for task ${taskId}:`, error);
          }
        }
        
        // 通知订阅者（优化：只在进度变化超过 0.1% 时通知）
        const shouldNotify = 
          !task.lastProgress || 
          Math.abs(data.progress - task.lastProgress) >= 0.1 ||
          data.isExpired;
        
        if (shouldNotify) {
          task.lastProgress = data.progress;
          const subs = this.subscribers.get(taskId);
          if (subs && subs.size > 0) {
            subs.forEach(cb => {
              try {
                cb(data);
              } catch (error) {
                console.error(`[CountdownManager] Error in subscriber callback for task ${taskId}:`, error);
              }
            });
          }
        }
      }
      
      this.rafId = requestAnimationFrame(loop);
    };
    
    this.rafId = requestAnimationFrame(loop);
  }
  
  /**
   * 停止 RAF 循环
   */
  private stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
  
  /**
   * 处理页面可见性变化
   */
  private handleVisibilityChange = (): void => {
    this.isPageVisible = !document.hidden;
    
    if (this.isPageVisible) {
      // 页面可见：立即更新所有任务
      this.lastUpdate = 0; // 强制下次循环立即更新
      
      // 如果循环已停止，重新启动
      if (this.rafId === null && this.tasks.size > 0) {
        this.startLoop();
      }
    }
  };
  
  /**
   * 计算倒计时数据
   */
  private calculate(task: CountdownTask): CountdownData {
    const target = new Date(task.targetDate).getTime();
    
    if (Number.isNaN(target)) {
      console.warn('[CountdownManager] 无效的目标日期:', task.targetDate);
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        totalSeconds: 0,
        isExpired: true,
        progress: 100,
      };
    }
    
    const now = Date.now();
    const diff = target - now;
    
    // 任务已过期
    if (diff <= 0) {
      // 只在第一次过期时打印日志
      if (!task.expired) {
        console.log('[CountdownManager] 任务过期:', {
          taskId: task.taskId,
          targetDate: task.targetDate,
          diff,
        });
      }
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        totalSeconds: 0,
        isExpired: true,
        progress: 100, // 过期时进度必须是 100%
      };
    }
    
    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    // 计算进度（如果有开始时间）
    let progress = 0;
    if (task.startDate) {
      const start = new Date(task.startDate).getTime();
      if (!Number.isNaN(start) && start < target) {
        const total = target - start;
        const elapsed = now - start;
        progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
      }
    }
    
    return {
      days,
      hours,
      minutes,
      seconds,
      totalSeconds,
      isExpired: false,
      progress,
    };
  }
  
  /**
   * 获取任务数量（用于调试）
   */
  getTaskCount(): number {
    return this.tasks.size;
  }
  
  /**
   * 获取订阅者数量（用于调试）
   */
  getSubscriberCount(): number {
    let count = 0;
    for (const subs of this.subscribers.values()) {
      count += subs.size;
    }
    return count;
  }
  
  /**
   * 清理所有任务和订阅（用于测试）
   */
  clear(): void {
    this.stopLoop();
    this.tasks.clear();
    this.subscribers.clear();
  }
}

// 全局单例
export const countdownManager = new CountdownManager();

// 开发环境下暴露到 window 对象，方便调试
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__countdownManager = countdownManager;
}
