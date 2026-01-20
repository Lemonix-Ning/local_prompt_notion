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
    
    // 手动扫描所有 interval 任务
    const { scanDirectory, collectAllPrompts } = require('../utils/fileSystem');
    const { VAULT_ROOT } = require('../index');
    const categories = await scanDirectory(VAULT_ROOT, VAULT_ROOT);
    const allPrompts = collectAllPrompts(categories);
    
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
    
    const intervalTasks = allPrompts.filter(prompt => {
      if (prompt.meta.type !== 'TASK') return false;
      if (!prompt.meta.recurrence?.enabled) return false;
      if (prompt.meta.recurrence.type !== 'interval') return false;
      if (prompt.path?.includes('/trash/') || prompt.path?.includes('\\trash\\')) return false;
      return true;
    });
    
    const now = Date.now();
    const tasksInfo = intervalTasks.map(task => {
      const { intervalMinutes } = task.meta.recurrence;
      const baselineStr = task.meta.last_notified ?? task.meta.created_at;
      const baseMs = new Date(baselineStr).getTime();
      const intervalMs = intervalMinutes * 60 * 1000;
      const nextTriggerAt = baseMs + intervalMs;
      const timeUntilTrigger = nextTriggerAt - now;
      const isDue = now >= nextTriggerAt;
      
      return {
        id: task.meta.id,
        title: task.meta.title,
        intervalMinutes,
        lastNotified: baselineStr,
        nextTriggerAt,
        nextTriggerIso: new Date(nextTriggerAt).toISOString(),
        timeUntilTriggerMs: timeUntilTrigger,
        timeUntilTriggerMinutes: Math.floor(timeUntilTrigger / 60000),
        timeUntilTriggerSeconds: Math.floor((timeUntilTrigger % 60000) / 1000),
        isDue,
        isPending: pending.some(p => p.meta.id === task.meta.id),
      };
    });
    
    res.json({
      success: true,
      data: {
        isRunning: scheduler.isRunning,
        checkInterval: scheduler.checkInterval,
        currentTime: new Date(now).toISOString(),
        totalPrompts: allPrompts.length,
        promptsByType,
        totalIntervalTasks: intervalTasks.length,
        pendingCount: pending.length,
        tasks: tasksInfo,
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
