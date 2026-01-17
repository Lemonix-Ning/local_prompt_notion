/**
 * 重复任务标签生成器
 * 根据重复配置生成智能标签
 */

import type { RecurrenceConfig } from '../types';

const WEEK_DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/**
 * 生成重复任务的智能标签
 */
export function generateRecurrenceTag(config: RecurrenceConfig): string {
  if (!config.enabled) return '';

  switch (config.type) {
    case 'daily':
      return '每天';
    
    case 'weekly':
      return generateWeeklyTag(config.weekDays || []);
    
    case 'monthly':
      return generateMonthlyTag(config.monthDays || []);
    
    default:
      return '重复';
  }
}

/**
 * 生成每周重复的标签
 */
function generateWeeklyTag(weekDays: number[]): string {
  if (weekDays.length === 0) return '每周';
  if (weekDays.length === 7) return '每天';
  
  // 检查是否是工作日 (周一到周五)
  const workDays = [1, 2, 3, 4, 5];
  if (weekDays.length === 5 && workDays.every(d => weekDays.includes(d))) {
    return '工作日';
  }
  
  // 检查是否是周末
  const weekend = [0, 6];
  if (weekDays.length === 2 && weekend.every(d => weekDays.includes(d))) {
    return '周末';
  }
  
  // 检查是否是连续的
  const sorted = [...weekDays].sort((a, b) => a - b);
  const isConsecutive = sorted.every((day, i) => {
    if (i === 0) return true;
    return day === sorted[i - 1] + 1;
  });
  
  if (isConsecutive && sorted.length >= 3) {
    // 连续的，显示范围
    return `${WEEK_DAY_NAMES[sorted[0]]}-${WEEK_DAY_NAMES[sorted[sorted.length - 1]]}`;
  }
  
  // 检查是否是隔天
  if (sorted.length >= 2) {
    const gaps = sorted.slice(1).map((d, i) => d - sorted[i]);
    if (gaps.every(g => g === 2)) {
      return '隔天';
    }
  }
  
  // 不规则的，最多显示3个
  if (sorted.length <= 3) {
    return sorted.map(d => WEEK_DAY_NAMES[d]).join('');
  }
  
  // 超过3个且不规则，显示前3个
  return sorted.slice(0, 3).map(d => WEEK_DAY_NAMES[d]).join('') + '...';
}

/**
 * 生成每月重复的标签
 */
function generateMonthlyTag(monthDays: number[]): string {
  if (monthDays.length === 0) return '每月';
  if (monthDays.length === 1) return `每月${monthDays[0]}日`;
  
  const sorted = [...monthDays].sort((a, b) => a - b);
  
  // 检查是否是连续的
  const isConsecutive = sorted.every((day, i) => {
    if (i === 0) return true;
    return day === sorted[i - 1] + 1;
  });
  
  if (isConsecutive && sorted.length >= 3) {
    return `每月${sorted[0]}-${sorted[sorted.length - 1]}日`;
  }
  
  // 检查是否是固定间隔
  if (sorted.length >= 2) {
    const gaps = sorted.slice(1).map((d, i) => d - sorted[i]);
    const allSameGap = gaps.every(g => g === gaps[0]);
    if (allSameGap && gaps[0] > 1) {
      return `每隔${gaps[0] - 1}天`;
    }
  }
  
  // 不规则的，最多显示3个
  if (sorted.length <= 3) {
    return `每月${sorted.join('、')}日`;
  }
  
  // 超过3个且不规则
  return `每月${sorted.slice(0, 3).join('、')}日...`;
}

/**
 * 生成一次性任务的时间标签
 */
export function generateScheduledTimeTag(scheduledTime: string): string {
  if (!scheduledTime) return '';
  
  const date = new Date(scheduledTime);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return '已过期';
  } else if (diffDays === 0) {
    return '今天';
  } else if (diffDays === 1) {
    return '明天';
  } else if (diffDays <= 7) {
    return `${diffDays}天后`;
  } else {
    // 显示具体日期
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
  }
}

/**
 * 计算重复任务的下一次触发时间
 * @param config 重复配置
 * @returns ISO 8601 格式的下一次触发时间
 */
export function getNextTriggerTime(config: RecurrenceConfig): string {
  if (!config.enabled) return '';
  
  const now = new Date();
  const [hours, minutes] = config.time.split(':').map(Number);
  
  // 创建今天的触发时间
  const todayTrigger = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
  
  switch (config.type) {
    case 'daily': {
      // 每天触发：如果今天的时间还没到，返回今天；否则返回明天
      if (todayTrigger > now) {
        return todayTrigger.toISOString();
      }
      const tomorrow = new Date(todayTrigger);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString();
    }
    
    case 'weekly': {
      // 每周特定日触发
      if (!config.weekDays || config.weekDays.length === 0) {
        // 没有设置星期几，默认每天
        if (todayTrigger > now) {
          return todayTrigger.toISOString();
        }
        const tomorrow = new Date(todayTrigger);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString();
      }
      
      const sortedWeekDays = [...config.weekDays].sort((a, b) => a - b);
      
      // 检查今天是否是触发日，且时间还没到
      if (sortedWeekDays.includes(now.getDay()) && todayTrigger > now) {
        return todayTrigger.toISOString();
      }
      
      // 查找接下来7天内的下一个触发日
      for (let i = 1; i <= 7; i++) {
        const checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hours, minutes, 0, 0);
        if (sortedWeekDays.includes(checkDate.getDay())) {
          return checkDate.toISOString();
        }
      }
      
      // 不应该到这里，但作为后备
      const nextWeek = new Date(todayTrigger);
      nextWeek.setDate(nextWeek.getDate() + 7);
      return nextWeek.toISOString();
    }
    
    case 'monthly': {
      // 每月特定日触发
      if (!config.monthDays || config.monthDays.length === 0) {
        // 没有设置日期，默认每天
        if (todayTrigger > now) {
          return todayTrigger.toISOString();
        }
        const tomorrow = new Date(todayTrigger);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString();
      }
      
      const sortedMonthDays = [...config.monthDays].sort((a, b) => a - b);
      const todayDate = now.getDate();
      
      // 检查今天是否是触发日，且时间还没到
      if (sortedMonthDays.includes(todayDate) && todayTrigger > now) {
        return todayTrigger.toISOString();
      }
      
      // 查找本月剩余的触发日
      for (const day of sortedMonthDays) {
        if (day > todayDate) {
          const checkDate = new Date(now.getFullYear(), now.getMonth(), day, hours, minutes, 0, 0);
          // 确保日期有效（比如2月30日会变成3月2日）
          if (checkDate.getDate() === day && checkDate.getMonth() === now.getMonth()) {
            return checkDate.toISOString();
          }
        }
      }
      
      // 查找下个月的第一个触发日
      const nextMonth = now.getMonth() + 1;
      const nextYear = nextMonth > 11 ? now.getFullYear() + 1 : now.getFullYear();
      const actualNextMonth = nextMonth > 11 ? 0 : nextMonth;
      
      for (const day of sortedMonthDays) {
        const checkDate = new Date(nextYear, actualNextMonth, day, hours, minutes, 0, 0);
        // 确保日期有效
        if (checkDate.getDate() === day) {
          return checkDate.toISOString();
        }
      }
      
      // 后备：返回下个月1号
      return new Date(nextYear, actualNextMonth, 1, hours, minutes, 0, 0).toISOString();
    }
    
    default:
      return todayTrigger.toISOString();
  }
}
