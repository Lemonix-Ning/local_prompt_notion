/**
 * Interval Task Scheduler - 极简版
 * 
 * 核心原则：
 * 1. 后端负责时间调度
 * 2. 前端只负责展示
 * 3. 数据模型只需要一个字段：nextTriggerAt
 */

const { collectAllPrompts, scanDirectory, updatePrompt } = require('./fileSystem');

class IntervalTaskScheduler {
  constructor(vaultRoot) {
    this.vaultRoot = vaultRoot;
    this.timerId = null;
    this.isRunning = false;
    this.foregroundInterval = 1000; // 1秒检查一次（前台）
    this.backgroundInterval = 10000; // 10秒检查一次（后台）
    this.checkInterval = this.foregroundInterval; // 当前检查间隔
    this.isWindowVisible = true; // 窗口可见性状态
    this.pendingNotifications = new Map(); // taskId -> task
    this._lastTaskCount = null; // 用于检测任务数量变化
    this._lastPendingCount = 0; // 用于检测待通知数量变化
  }

  /**
   * 设置窗口可见性状态
   * 前端通过 API 调用此方法通知后端窗口状态变化
   */
  setWindowVisibility(isVisible) {
    const wasVisible = this.isWindowVisible;
    this.isWindowVisible = isVisible;
    
    // 更新检查间隔
    const oldInterval = this.checkInterval;
    this.checkInterval = isVisible ? this.foregroundInterval : this.backgroundInterval;
    
    // 如果间隔发生变化，记录日志
    if (oldInterval !== this.checkInterval) {
      console.log(`[Scheduler] Tick rate adjusted: ${oldInterval}ms -> ${this.checkInterval}ms (window ${isVisible ? 'visible' : 'hidden'})`);
    }
    
    // 如果从后台切换到前台，立即执行一次检查
    if (!wasVisible && isVisible && this.isRunning) {
      this._checkTasksImmediate();
    }
  }

  /**
   * 立即执行一次任务检查（不等待定时器）
   */
  async _checkTasksImmediate() {
    try {
      await this._checkTasks();
    } catch (error) {
      console.error('[Scheduler] Error in immediate check:', error);
    }
  }

  /**
   * 启动调度器
   */
  async start() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    
    // 🔥 启动时重置所有 interval 任务的 last_notified 为当前时间
    // 这样刷新页面或重启应用时，倒计时会从头开始
    await this._resetAllIntervalTasks();
    
    this._scheduleNext();
  }

  /**
   * 重置所有 interval 任务的 last_notified 为当前时间
   * 用于启动时重置倒计时
   */
  async _resetAllIntervalTasks() {
    try {
      const categories = await scanDirectory(this.vaultRoot, this.vaultRoot);
      const allPrompts = collectAllPrompts(categories);
      
      const intervalTasks = allPrompts.filter(prompt => {
        if (prompt.meta.type !== 'TASK') return false;
        if (!prompt.meta.recurrence?.enabled) return false;
        if (prompt.meta.recurrence.type !== 'interval') return false;
        if (prompt.path?.includes('/trash/') || prompt.path?.includes('\\trash\\')) return false;
        return true;
      });

      const nowIso = new Date().toISOString();
      let resetCount = 0;

      for (const task of intervalTasks) {
        try {
          await updatePrompt(task.path, { last_notified: nowIso });
          resetCount++;
        } catch (error) {
          console.error(`[Scheduler] Failed to reset task ${task.meta.id}:`, error);
        }
      }
    } catch (error) {
      console.error('[Scheduler] Error resetting interval tasks:', error);
    }
  }

  /**
   * 停止调度器
   */
  stop() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.isRunning = false;
  }

  /**
   * 调度下一次检查
   */
  _scheduleNext() {
    if (!this.isRunning) return;

    this.timerId = setTimeout(async () => {
      try {
        await this._checkTasks();
      } catch (error) {
        console.error('[Scheduler] Error:', error);
      }
      this._scheduleNext();
    }, this.checkInterval);
  }

  /**
   * 检查所有任务
   */
  async _checkTasks() {
    const now = Date.now();

    // 扫描所有任务
    const categories = await scanDirectory(this.vaultRoot, this.vaultRoot);
    const allPrompts = collectAllPrompts(categories);

    // 过滤 interval 任务
    const intervalTasks = allPrompts.filter(prompt => {
      if (prompt.meta.type !== 'TASK') return false;
      if (!prompt.meta.recurrence?.enabled) return false;
      if (prompt.meta.recurrence.type !== 'interval') return false;
      if (prompt.path?.includes('/trash/') || prompt.path?.includes('\\trash\\')) return false;
      return true;
    });

    // 检查每个任务
    for (const task of intervalTasks) {
      const { intervalMinutes } = task.meta.recurrence;
      if (!intervalMinutes || intervalMinutes <= 0) continue;

      // 🎯 如果任务已经在待通知队列中，跳过检查
      // 只有前端 dismiss 后才会从队列中移除
      if (this.pendingNotifications.has(task.meta.id)) {
        continue;
      }

      // 计算下次触发时间
      const baselineStr = task.meta.last_notified ?? task.meta.created_at;
      if (!baselineStr) continue;

      const baseMs = new Date(baselineStr).getTime();
      const intervalMs = intervalMinutes * 60 * 1000;
      const nextTriggerAt = baseMs + intervalMs;

      // 判断是否到期
      if (now >= nextTriggerAt) {
        // 🔥 任务到期：立即更新 last_notified 为当前时间
        // 这样下一个周期会从当前时间开始计算，保持固定的 n 分钟间隔
        try {
          const nowIso = new Date(now).toISOString();
          await updatePrompt(task.path, { last_notified: nowIso });
        } catch (error) {
          console.error(`[Scheduler] Failed to update last_notified for task ${task.meta.id}:`, error);
        }
        
        // 添加到待通知队列
        this.pendingNotifications.set(task.meta.id, {
          ...task,
          nextTriggerAt,
        });
      }
    }
  }

  /**
   * 获取待通知的任务
   */
  getPendingNotifications() {
    return Array.from(this.pendingNotifications.values());
  }

  /**
   * 确认任务已通知（Dismiss）
   * 
   * 🔥 关键设计：Dismiss 时不更新 last_notified
   * - 只从待通知队列中移除
   * - 倒计时继续按原有节奏运行
   * - 下一个周期会在固定的 n 分钟后到期
   */
  async acknowledgeTask(taskId) {
    const task = this.pendingNotifications.get(taskId);
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    try {
      // 🎯 只从队列中移除，不更新 last_notified
      // 倒计时会继续运行，保持固定的 n 分钟间隔
      this.pendingNotifications.delete(taskId);

      return { success: true };
    } catch (error) {
      console.error(`[Scheduler] Failed to acknowledge task ${taskId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取任务的下次触发时间
   */
  getNextTriggerTime(taskId) {
    const task = this.pendingNotifications.get(taskId);
    if (!task) return null;
    return task.nextTriggerAt;
  }
}

module.exports = IntervalTaskScheduler;
