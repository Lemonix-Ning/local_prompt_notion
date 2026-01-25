/**
 * useCountdownManager Hook
 * 
 * 使用全局 CountdownManager 订阅倒计时更新
 * 相比旧的 useCountdown，性能提升显著：
 * - 共享单一 RAF 循环
 * - 智能节流更新
 * - 自动清理订阅
 */

import { useState, useEffect, useRef } from 'react';
import { countdownManager, type CountdownData } from '../utils/countdownManager';

export function useCountdownManager(
  taskId: string,
  targetDate: string,
  startDate?: string,
  onExpire?: () => void
): CountdownData {
  const [data, setData] = useState<CountdownData>(() => ({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    totalSeconds: 0,
    isExpired: false,
    progress: 0,
  }));
  
  // 使用 ref 存储 onExpire，避免每次变化都重新注册
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);
  
  useEffect(() => {
    // 注册任务
    countdownManager.register(
      taskId,
      targetDate,
      startDate,
      () => onExpireRef.current?.()
    );
    
    // 订阅更新
    const unsubscribe = countdownManager.subscribe(taskId, setData);
    
    // 清理：取消订阅（但不取消注册，因为其他组件可能还在使用）
    return () => {
      unsubscribe();
    };
  }, [taskId, targetDate, startDate]);
  
  return data;
}
