/**
 * Interval 任务路由
 * 提供极简的任务通知 API
 */

const express = require('express');
const router = express.Router();

// 延迟获取 scheduler，避免循环依赖
let scheduler = null;
const getScheduler = () => {
  if (!scheduler) {
    scheduler = require('../index').scheduler;
  }
  return scheduler;
};

/**
 * GET /api/interval-tasks/pending
 * 获取待通知的任务
 */
router.get('/pending', (req, res) => {
  try {
    const pending = getScheduler().getPendingNotifications();
    res.json({
      success: true,
      data: pending,
    });
  } catch (error) {
    console.error('[API] Error getting pending tasks:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/interval-tasks/reset-baselines
 * 刷新/重启时重置 interval 任务的 last_notified，使倒计时从头开始
 */
router.post('/reset-baselines', async (req, res) => {
  try {
    const result = await getScheduler().resetIntervalBaselines();
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, error: result.error || 'Failed to reset baselines' });
    }
  } catch (error) {
    console.error('[API] Error resetting interval baselines:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/interval-tasks/:id/notify
 * 前端倒计时完成时触发通知
 */
router.post('/:id/notify', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getScheduler().notifyTask(id);

    if (result.success) {
      res.json({ success: true, message: 'Task notified' });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[API] Error notifying task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/interval-tasks/:id/acknowledge
 * 确认任务已通知（Dismiss）
 */
router.post('/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getScheduler().acknowledgeTask(id);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Task acknowledged',
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error('[API] Error acknowledging task:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/interval-tasks/:id/next-trigger
 * 获取任务的下次触发时间
 */
router.get('/:id/next-trigger', (req, res) => {
  try {
    const { id } = req.params;
    const nextTriggerAt = getScheduler().getNextTriggerTime(id);
    
    if (nextTriggerAt) {
      res.json({
        success: true,
        data: {
          nextTriggerAt,
          nextTriggerIso: new Date(nextTriggerAt).toISOString(),
        },
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Task not found or not pending',
      });
    }
  } catch (error) {
    console.error('[API] Error getting next trigger time:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/interval-tasks/visibility
 * 通知后端窗口可见性状态变化
 */
router.post('/visibility', (req, res) => {
  try {
    const { isVisible } = req.body;
    
    if (typeof isVisible !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isVisible must be a boolean',
      });
    }
    
    getScheduler().setWindowVisibility(isVisible);
    
    res.json({
      success: true,
      message: `Window visibility set to ${isVisible}`,
      checkInterval: getScheduler().checkInterval,
    });
  } catch (error) {
    console.error('[API] Error setting visibility:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/interval-tasks/debug/status
 * 调试端点：查看调度器状态
 */
router.get('/debug/status', async (req, res) => {
  try {
    const scheduler = getScheduler();
    const pending = scheduler.getPendingNotifications();
    
    const { scanDirectory, collectAllPrompts, loadPromptsInDirectory } = require('../utils/fileSystem');
    const { VAULT_ROOT } = require('../index');
    const categories = await scanDirectory(VAULT_ROOT, VAULT_ROOT);
    const allPrompts = collectAllPrompts(categories);
    const rootPrompts = await loadPromptsInDirectory(VAULT_ROOT);
    allPrompts.push(...rootPrompts);
    
    // 统计所有 prompts 的 type
    const promptsByType = {};
    allPrompts.forEach(p => {
      const type = p.meta.type || 'undefined';
      if (!promptsByType[type]) {
        promptsByType[type] = [];
      }
      promptsByType[type].push({
        id: p.meta.id,
        title: p.meta.title,
        hasRecurrence: !!p.meta.recurrence,
        recurrenceEnabled: p.meta.recurrence?.enabled,
        recurrenceType: p.meta.recurrence?.type,
      });
    });
    
    const tasks = allPrompts.filter(prompt => {
      if (prompt.meta.type !== 'TASK') return false;
      if (prompt.path?.includes('/trash/') || prompt.path?.includes('\\trash\\')) return false;
      return true;
    });

    const resolveRecurringTrigger = (task) => {
      const recurrence = task.meta.recurrence;
      if (!recurrence?.enabled) return null;
      
      if (recurrence.type === 'interval') {
        const intervalMinutes = recurrence.intervalMinutes;
        if (!intervalMinutes || intervalMinutes <= 0) return null;
        const baselineStr = task.meta.last_notified ?? task.meta.created_at;
        if (!baselineStr) return null;
        const baseMs = new Date(baselineStr).getTime();
        const intervalMs = intervalMinutes * 60 * 1000;
        return baseMs + intervalMs;
      }

      if (!recurrence.time || typeof recurrence.time !== 'string') return null;
      const [hours, minutes] = recurrence.time.split(':').map(Number);
      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

      const triggerDate = new Date();
      triggerDate.setHours(hours, minutes, 0, 0);

      if (recurrence.type === 'daily') {
        return triggerDate.getTime();
      }

      if (recurrence.type === 'weekly') {
        const weekDays = recurrence.weekDays && recurrence.weekDays.length > 0
          ? recurrence.weekDays
          : [0, 1, 2, 3, 4, 5, 6];
        
        const currentDay = triggerDate.getDay();
        if (weekDays.includes(currentDay)) {
          return triggerDate.getTime();
        }

        for (let i = 1; i <= 7; i++) {
          const check = new Date(triggerDate);
          check.setDate(check.getDate() - i);
          if (weekDays.includes(check.getDay())) {
            return check.getTime();
          }
        }
        return null;
      }

      if (recurrence.type === 'monthly') {
        const monthDays = recurrence.monthDays && recurrence.monthDays.length > 0
          ? recurrence.monthDays
          : Array.from({ length: 31 }, (_, i) => i + 1);
        const sortedMonthDays = [...monthDays].sort((a, b) => a - b);
        const todayDate = triggerDate.getDate();

        if (sortedMonthDays.includes(todayDate)) {
          return triggerDate.getTime();
        }

        for (let i = sortedMonthDays.length - 1; i >= 0; i--) {
          const day = sortedMonthDays[i];
          if (day < todayDate) {
            const candidate = new Date(triggerDate.getFullYear(), triggerDate.getMonth(), day, hours, minutes, 0, 0);
            if (candidate.getDate() === day) {
              return candidate.getTime();
            }
          }
        }

        const prevMonth = new Date(triggerDate.getFullYear(), triggerDate.getMonth() - 1, 1, hours, minutes, 0, 0);
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

      return triggerDate.getTime();
    };

    const now = Date.now();
    const taskRows = tasks.map(task => {
      const scheduledTime = task.meta.scheduled_time ? new Date(task.meta.scheduled_time).getTime() : null;
      const recurrenceTrigger = resolveRecurringTrigger(task);
      const nextTriggerAt = recurrenceTrigger ?? scheduledTime;
      const isDue = typeof nextTriggerAt === 'number' ? now >= nextTriggerAt : false;
      const isPending = pending.some(p => p.meta.id === task.meta.id);

      return {
        id: task.meta.id,
        title: task.meta.title,
        recurrenceEnabled: task.meta.recurrence?.enabled,
        recurrenceType: task.meta.recurrence?.type,
        intervalMinutes: task.meta.recurrence?.intervalMinutes,
        scheduled_time: task.meta.scheduled_time ?? null,
        last_notified: task.meta.last_notified ?? null,
        nextTriggerAt,
        nextTriggerIso: typeof nextTriggerAt === 'number' ? new Date(nextTriggerAt).toISOString() : null,
        isDue,
        isPending,
      };
    });

    const recurringTypeCounts = {
      interval: 0,
      daily: 0,
      weekly: 0,
      monthly: 0,
    };
    let oneTimeCount = 0;
    for (const t of tasks) {
      if (t.meta.recurrence?.enabled && t.meta.recurrence?.type && recurringTypeCounts[t.meta.recurrence.type] !== undefined) {
        recurringTypeCounts[t.meta.recurrence.type]++;
      } else if (t.meta.scheduled_time) {
        oneTimeCount++;
      }
    }

    const intervalTasks = tasks.filter(t => t.meta.recurrence?.enabled && t.meta.recurrence?.type === 'interval');
    
    res.json({
      success: true,
      data: {
        isRunning: scheduler.isRunning,
        checkInterval: scheduler.checkInterval,
        currentTime: new Date(now).toISOString(),
        totalPrompts: allPrompts.length,
        rootPrompts: rootPrompts.length,
        promptsByType,
        totalTasks: tasks.length,
        recurringCounts: recurringTypeCounts,
        oneTimeCount,
        totalIntervalTasks: intervalTasks.length,
        pendingCount: pending.length,
        tasks: taskRows,
      },
    });
  } catch (error) {
    console.error('[API] Error getting scheduler status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

module.exports = router;
