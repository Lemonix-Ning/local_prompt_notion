/**
 * useSystemNotification Hook
 * 系统级通知服务 - 支持桌面端系统通知
 * 
 * 功能：
 * - 检测是否在 Tauri 环境
 * - 请求通知权限
 * - 发送系统通知
 * - 任务到期提醒
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import { NotificationThrottler } from '../utils/notificationThrottler';

// 检测是否在 Tauri 环境
const isTauri = () => {
  if (typeof window === 'undefined') return false;

  if ('__TAURI_INTERNALS__' in window || '__TAURI__' in window) return true;

  // 额外检测：检查 Tauri 的 IPC 协议
  if (
    window.location.protocol === 'tauri:' ||
    (window.location.protocol === 'https:' && window.location.hostname === 'tauri.localhost')
  ) {
    return true;
  }

  return false;
};

export function useSystemNotification() {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  
  // Notification throttler to prevent spam
  const throttlerRef = useRef<NotificationThrottler>(new NotificationThrottler({ throttleInterval: 2000 }));

  // 初始化通知 API
  useEffect(() => {
    const initNotification = async () => {
      if (!isTauri()) {
        // 使用 Web Notification API 作为后备
        if ('Notification' in window) {
          setIsSupported(true);
          setPermissionGranted(Notification.permission === 'granted');
          if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            setPermissionGranted(permission === 'granted');
          }
        }
        return;
      }

      try {
        // 动态导入 Tauri 2.x 通知插件
        const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification');
        setIsSupported(true);

        // 检查权限
        let granted = await isPermissionGranted();

        if (!granted) {
          // 请求权限
          const permission = await requestPermission();
          granted = permission === 'granted';
        }
        
        setPermissionGranted(granted);
      } catch (error) {
        console.error('[notification] failed to init tauri notification plugin', error);
        // 回退到 Web Notification API
        if ('Notification' in window) {
          setIsSupported(true);
          setPermissionGranted(Notification.permission === 'granted');
        }
      }
    };

    initNotification();
  }, []);

  // 请求通知权限
  const requestPermissionFn = useCallback(async () => {
    if (!isSupported) return false;

    if (isTauri()) {
      try {
        const { requestPermission } = await import('@tauri-apps/plugin-notification');
        const permission = await requestPermission();
        const granted = permission === 'granted';
        setPermissionGranted(granted);
        return granted;
      } catch (error) {
        return false;
      }
    }

    // Web Notification API
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      setPermissionGranted(granted);
      return granted;
    }

    return false;
  }, [isSupported]);

  // 发送通知
  const sendNotification = useCallback(async (title: string, body?: string) => {
    if (!isSupported) {
      return false;
    }

    try {
      if (isTauri()) {
        if (!permissionGranted) {
          try {
            const { requestPermission } = await import('@tauri-apps/plugin-notification');
            const permission = await requestPermission();
            const granted = permission === 'granted';
            setPermissionGranted(granted);
            if (!granted) return false;
          } catch {
            return false;
          }
        }
        // 🔥 Tauri 2.x 使用 sendNotification 函数
        const { sendNotification: tauriSendNotification } = await import('@tauri-apps/plugin-notification');
        tauriSendNotification({ title, body });
        return true;
      }

      // Web Notification API
      if ('Notification' in window) {
        if (!permissionGranted) {
          const permission = await Notification.requestPermission();
          const granted = permission === 'granted';
          setPermissionGranted(granted);
          if (!granted) return false;
        }
        new Notification(title, { body });
        return true;
      }
    } catch (error) {
      console.error('[notification] failed to send notification', error);
    }

    return false;
  }, [isSupported, permissionGranted]);

  // 发送任务提醒通知（带节流）
  const sendTaskReminder = useCallback(async (
    taskId: string,
    taskTitle: string, 
    isExpired: boolean = false, 
    isRecurring: boolean = false
  ) => {
    // Check throttle - prevent notification spam
    if (!throttlerRef.current.shouldShowNotification(taskId)) {
      return false;
    }

    // 🔥 修复：重复任务显示"已到期"而不是"即将到期"
    const title = (isExpired || isRecurring) ? '⏰ 任务已到期' : '⏰ 任务即将到期';
    const body = taskTitle;
    return sendNotification(title, body);
  }, [sendNotification]);

  // Reset throttle for a specific task (call when task is dismissed or completed)
  const resetTaskThrottle = useCallback((taskId: string) => {
    throttlerRef.current.reset(taskId);
  }, []);

  return {
    isSupported,
    permissionGranted,
    requestPermission: requestPermissionFn,
    sendNotification,
    sendTaskReminder,
    resetTaskThrottle,
  };
}
