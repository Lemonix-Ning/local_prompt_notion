/**
 * Interval Task Scheduler - 极简版
 * 
 * 核心原则：
 * 1. 后端负责时间调度
 * 2. 前端只负责展示
 * 3. 数据模型只需要一个字段：nextTriggerAt
 */

const { collectAllPrompts, scanDirectory, updatePrompt, loadPromptsInDirectory } = require('./fileSystem');

class TaskScheduler {
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
    this.startupTime = null; // 🔥 修复 Bug 10: 记录启动时间
    this.startupGracePeriod = 3000; // 🔥 启动后 3 秒内不触发通知
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

    // 🔥 修复 Bug 10: 记录启动时间
    this.startupTime = Date.now();
    
    // 重置所有 interval 任务的 last_notified 为当前时间
    // 这样刷新页面或重启应用时，倒计时会从头开始
    await this._resetAllIntervalTasks();
    
    // 重置完成后，才标记为运行状态并开始调度
    this.isRunning = true;
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
      
      // 🔥 修复 Bug 1: 加载根目录的任务
      const rootPrompts = await loadPromptsInDirectory(this.vaultRoot);
      allPrompts.push(...rootPrompts);
      
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
   * 重置 interval 任务基线（用于前端刷新页面后让倒计时从头开始）
   * - 更新所有 interval 任务 last_notified = now
   * - 清除这些任务在 pendingNotifications 中的记录，避免重复弹窗
   * - 返回更新后的任务列表，供前端立即使用
   */
  async resetIntervalBaselines() {
    await this._resetAllIntervalTasks();

    try {
      const pending = Array.from(this.pendingNotifications.values());
      for (const task of pending) {
        if (task?.meta?.recurrence?.enabled && task.meta.recurrence.type === 'interval') {
          this.pendingNotifications.delete(task.meta.id);
        }
      }
      
      // 🔥 返回更新后的任务列表
      const categories = await scanDirectory(this.vaultRoot, this.vaultRoot);
      const allPrompts = collectAllPrompts(categories);
      const rootPrompts = await loadPromptsInDirectory(this.vaultRoot);
      allPrompts.push(...rootPrompts);
      
      const intervalTasks = allPrompts.filter(prompt => {
        if (prompt.meta.type !== 'TASK') return false;
        if (!prompt.meta.recurrence?.enabled) return false;
        if (prompt.meta.recurrence.type !== 'interval') return false;
        if (prompt.path?.includes('/trash/') || prompt.path?.includes('\\trash\\')) return false;
        return true;
      });
      
      return { 
        success: true, 
        resetCount: intervalTasks.length,
        tasks: intervalTasks.map(t => ({
          id: t.meta.id,
          last_notified: t.meta.last_notified
        }))
      };
    } catch (error) {
      console.error('[Scheduler] Error clearing pending interval notifications:', error);
      return { success: false, error: error.message };
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

    // 🔥 修复 Bug 10: 启动宽限期内不触发通知
    if (this.startupTime && (now - this.startupTime) < this.startupGracePeriod) {
      return;
    }

    // 扫描所有任务
    const categories = await scanDirectory(this.vaultRoot, this.vaultRoot);
    const allPrompts = collectAllPrompts(categories);
    
    // 🔥 修复 Bug 1: 加载根目录的任务
    const rootPrompts = await loadPromptsInDirectory(this.vaultRoot);
    allPrompts.push(...rootPrompts);

    // 过滤任务
    const tasks = allPrompts.filter(prompt => {
      if (prompt.meta.type !== 'TASK') return false;
      if (prompt.path?.includes('/trash/') || prompt.path?.includes('\\trash\\')) return false;
      return true;
    });

    // 清理 stale pending：任务已被删除或已移到回收站
    if (this.pendingNotifications.size > 0) {
      const existingById = new Map();
      for (const p of allPrompts) {
        if (p?.meta?.id) existingById.set(p.meta.id, p);
      }
      for (const [taskId, pendingTask] of this.pendingNotifications.entries()) {
        const latest = existingById.get(taskId);
        const latestPath = latest?.path;
        const pendingPath = pendingTask?.path;
        const pathToCheck = latestPath ?? pendingPath;
        const inTrash = !!pathToCheck && (pathToCheck.includes('/trash/') || pathToCheck.includes('\\trash\\'));
        if (!latest || inTrash) {
          this.pendingNotifications.delete(taskId);
        }
      }
    }

    const resolveRecurringTrigger = (task) => {
      const recurrence = task.meta.recurrence;
      if (!recurrence?.enabled) return null;

      // interval: next trigger is strictly derived from last_notified/created_at
      if (recurrence.type === 'interval') {
        const intervalMinutes = recurrence.intervalMinutes;
        if (!intervalMinutes || intervalMinutes <= 0) return null;
        const baselineStr = task.meta.last_notified ?? task.meta.created_at;
        if (!baselineStr) return null;
        const baseMs = new Date(baselineStr).getTime();
        const intervalMs = intervalMinutes * 60 * 1000;
        return baseMs + intervalMs;
      }

      // daily/weekly/monthly: compute the *most recent cycle trigger* (<= now)
      // then compare against last_notified to decide if it should fire.
      if (!recurrence.time || typeof recurrence.time !== 'string') return null;
      const [hours, minutes] = recurrence.time.split(':').map(Number);
      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

      const nowDate = new Date(now);
      const todayTrigger = new Date(
        nowDate.getFullYear(),
        nowDate.getMonth(),
        nowDate.getDate(),
        hours,
        minutes,
        0,
        0
      );

      if (recurrence.type === 'daily') {
        // 返回今天的触发时间（可能已过）
        return todayTrigger.getTime();
      }

      if (recurrence.type === 'weekly') {
        const weekDays = recurrence.weekDays && recurrence.weekDays.length > 0
          ? recurrence.weekDays
          : [0, 1, 2, 3, 4, 5, 6];

        // 🔥 修复 Bug 5: 如果今天是目标星期几，返回今天的触发时间
        const currentDay = todayTrigger.getDay();
        if (weekDays.includes(currentDay)) {
          return todayTrigger.getTime();
        }

        // 否则查找最近的过去的目标星期几
        for (let i = 1; i <= 7; i++) {
          const check = new Date(todayTrigger);
          check.setDate(check.getDate() - i);
          if (weekDays.includes(check.getDay())) {
            return check.getTime();
          }
        }
        
        // 如果找不到（理论上不应该发生），返回 null
        return null;
      }

      if (recurrence.type === 'monthly') {
        const monthDays = recurrence.monthDays && recurrence.monthDays.length > 0
          ? recurrence.monthDays
          : Array.from({ length: 31 }, (_, i) => i + 1);
        const sortedMonthDays = [...monthDays].sort((a, b) => a - b);
        const todayDate = nowDate.getDate();

        // 🔥 修复 Bug 5: 如果今天是目标日期，返回今天的触发时间
        if (sortedMonthDays.includes(todayDate)) {
          return todayTrigger.getTime();
        }

        // 否则查找本月最近的过去的目标日期
        for (let i = sortedMonthDays.length - 1; i >= 0; i--) {
          const day = sortedMonthDays[i];
          if (day < todayDate) {
            const candidate = new Date(nowDate.getFullYear(), nowDate.getMonth(), day, hours, minutes, 0, 0);
            // 检查日期是否有效（例如，跳过 2月30日）
            if (candidate.getDate() === day) {
              return candidate.getTime();
            }
          }
        }

        // 如果本月没有找到，查找上个月的最后一个目标日期
        const prevMonth = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1, hours, minutes, 0, 0);
        const prevMonthYear = prevMonth.getFullYear();
        const prevMonthIndex = prevMonth.getMonth();

        for (let i = sortedMonthDays.length - 1; i >= 0; i--) {
          const day = sortedMonthDays[i];
          const candidate = new Date(prevMonthYear, prevMonthIndex, day, hours, minutes, 0, 0);
          if (candidate.getDate() === day) {
            return candidate.getTime();
          }
        }
        
        return null;
      }

      return null;
    };

    for (const task of tasks) {
      if (this.pendingNotifications.has(task.meta.id)) {
        continue;
      }

      const scheduledTime = task.meta.scheduled_time ? new Date(task.meta.scheduled_time).getTime() : null;
      const recurrenceTrigger = resolveRecurringTrigger(task);
      const triggerAt = recurrenceTrigger ?? scheduledTime;
      
      if (!triggerAt) continue;

      // One-time tasks (scheduled_time, no recurrence): if we've already notified at/after
      // the scheduled time, do not enqueue again.
      if (!recurrenceTrigger && scheduledTime && task.meta.last_notified) {
        const lastNotified = new Date(task.meta.last_notified).getTime();
        if (Number.isFinite(lastNotified) && lastNotified >= scheduledTime) {
          continue;
        }
      }

      // If this is a recurring trigger (interval/daily/weekly/monthly) and we've already
      // notified for this cycle, skip.
      if (recurrenceTrigger) {
        const lastNotifiedStr = task.meta.last_notified;
        if (lastNotifiedStr) {
          const lastNotified = new Date(lastNotifiedStr).getTime();
          if (lastNotified >= triggerAt) continue;
        }
      }

      if (now >= triggerAt) {
        try {
          const nowIso = new Date(now).toISOString();
          await updatePrompt(task.path, { last_notified: nowIso });
        } catch (error) {
          console.error(`[Scheduler] Failed to update last_notified for task ${task.meta.id}:`, error);
        }

        this.pendingNotifications.set(task.meta.id, {
          ...task,
          nextTriggerAt: triggerAt,
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
   * 🔥 修复 Bug 9: Dismiss 时检查是否需要更新 last_notified
   * - 如果是 interval 任务且下一个周期已到期，更新 last_notified 到当前时间
   * - 这样可以避免 acknowledge 后立即重新触发
   */
  async acknowledgeTask(taskId) {
    const task = this.pendingNotifications.get(taskId);
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    try {
      // 🔥 修复 Bug 9: 对于 interval 任务，检查是否需要重置倒计时
      if (task.meta.recurrence?.type === 'interval' && task.meta.recurrence?.enabled) {
        const intervalMinutes = task.meta.recurrence.intervalMinutes;
        if (intervalMinutes && intervalMinutes > 0) {
          const lastNotifiedStr = task.meta.last_notified ?? task.meta.created_at;
          if (lastNotifiedStr) {
            const lastNotified = new Date(lastNotifiedStr).getTime();
            const intervalMs = intervalMinutes * 60 * 1000;
            const nextTrigger = lastNotified + intervalMs;
            const now = Date.now();
            
            // 如果下一个周期已经到期，更新 last_notified 到当前时间
            if (now >= nextTrigger) {
              const nowIso = new Date(now).toISOString();
              await updatePrompt(task.path, { last_notified: nowIso });
            }
          }
        }
      }
      
      // 从队列中移除
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

  /**
   * 前端驱动的倒计时触发：将任务加入待通知队列
   */
  async notifyTask(taskId) {
    try {
      const categories = await scanDirectory(this.vaultRoot, this.vaultRoot);
      const allPrompts = collectAllPrompts(categories);
      
      // 🔥 修复 Bug 1: 加载根目录的任务
      const rootPrompts = await loadPromptsInDirectory(this.vaultRoot);
      allPrompts.push(...rootPrompts);
      
      const task = allPrompts.find(prompt => prompt.meta.id === taskId);

      if (!task) {
        return { success: false, error: 'Task not found' };
      }

      if (task.meta.type !== 'TASK' || !task.meta.recurrence?.enabled || task.meta.recurrence.type !== 'interval') {
        return { success: false, error: 'Task is not an interval recurrence' };
      }

      if (this.pendingNotifications.has(taskId)) {
        return { success: true };
      }

      const nowIso = new Date().toISOString();
      await updatePrompt(task.path, { last_notified: nowIso });

      this.pendingNotifications.set(taskId, {
        ...task,
        nextTriggerAt: Date.now(),
      });

      return { success: true };
    } catch (error) {
      console.error(`[Scheduler] Failed to notify task ${taskId}:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = TaskScheduler;
