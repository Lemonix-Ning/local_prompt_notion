/**
 * useCountdown Hook
 * 实时倒计时计算
 */

import { useState, useEffect } from 'react';
import { useDocumentVisibility } from './useDocumentVisibility';

interface CountdownResult {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isExpired: boolean;
  progress: number; // 0-100，用于进度条
}

interface RecurrenceInfo {
  type: 'interval';
  intervalMinutes: number;
}

const calculateTimeLeft = (targetDateStr: string, startDateStr?: string, recurrence?: { type: 'interval'; intervalMinutes: number }): CountdownResult => {
  let target = new Date(targetDateStr).getTime();
  const now = Date.now();
  
  // 🔥 修复核心：如果是 Interval 任务，且时间已过，自动计算"虚拟"的下一周期
  // 这样即使用户断网、或后台卡顿，UI 看起来永远是准确的
  let adjustedStart = startDateStr ? new Date(startDateStr).getTime() : undefined;
  
  if (recurrence?.type === 'interval' && now > target) {
    const intervalMs = recurrence.intervalMinutes * 60 * 1000;
    // 计算由于延迟/休眠，已经错过了多少个周期
    const cyclesPassed = Math.floor((now - target) / intervalMs) + 1;
    // 虚拟出下一个目标时间，用于 UI 显示
    target = target + (cyclesPassed * intervalMs);
    
    // 🎯 关键修复：同时调整 startDate，保持进度条的正确性
    // startDate 应该是当前周期的开始时间，而不是最初的 last_notified
    if (adjustedStart !== undefined) {
      adjustedStart = adjustedStart + (cyclesPassed * intervalMs);
    }
  }
  
  const diff = target - now;

  if (diff <= 0) {
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

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // 计算进度（如果有开始时间）
  let progress = 0;
  if (adjustedStart !== undefined) {
    const total = target - adjustedStart;
    const elapsed = now - adjustedStart;
    progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
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
};

export const useCountdown = (targetDateStr: string, startDateStr?: string, recurrence?: RecurrenceInfo): CountdownResult => {
  const [timeLeft, setTimeLeft] = useState<CountdownResult>(() =>
    calculateTimeLeft(targetDateStr, startDateStr, recurrence)
  );
  const { isHidden } = useDocumentVisibility();

  useEffect(() => {
    if (!targetDateStr) return;

    let timer: ReturnType<typeof setTimeout> | undefined;

    const getDelayMs = (result: CountdownResult) => {
      if (isHidden) return 10000;
      if (result.isExpired) return 60000;

      if (result.totalSeconds <= 60 * 60) return 1000;
      if (result.totalSeconds <= 24 * 60 * 60) return 5000;
      return 60000;
    };

    const stop = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
    };

    const schedule = () => {
      stop();
      const result = calculateTimeLeft(targetDateStr, startDateStr, recurrence);
      setTimeLeft(result);
      timer = setTimeout(schedule, getDelayMs(result));
    };

    schedule();

    return () => {
      stop();
    };
  }, [targetDateStr, startDateStr, recurrence, isHidden]);

  return timeLeft;
};
