/**
 * useCountdown Hook
 * 实时倒计时计算
 */

import { useState, useEffect } from 'react';

interface CountdownResult {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isExpired: boolean;
  progress: number; // 0-100，用于进度条
}

const calculateTimeLeft = (targetDateStr: string, startDateStr?: string): CountdownResult => {
  const target = new Date(targetDateStr).getTime();
  const now = Date.now();
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
  if (startDateStr) {
    const start = new Date(startDateStr).getTime();
    const total = target - start;
    const elapsed = now - start;
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

export const useCountdown = (targetDateStr: string, startDateStr?: string): CountdownResult => {
  const [timeLeft, setTimeLeft] = useState<CountdownResult>(() =>
    calculateTimeLeft(targetDateStr, startDateStr)
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(targetDateStr, startDateStr));
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDateStr, startDateStr]);

  return timeLeft;
};
