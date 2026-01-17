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

import { useCallback, useEffect, useState } from 'react';

// 检测是否在 Tauri 环境
const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI__' in window;
};

export function useSystemNotification() {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

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
        // 🔥 Tauri 2.x 使用 sendNotification 函数
        const { sendNotification: tauriSendNotification } = await import('@tauri-apps/plugin-notification');
        tauriSendNotification({ title, body });
        return true;
      }

      // Web Notification API
      if ('Notification' in window && permissionGranted) {
        new Notification(title, { body });
        return true;
      }
    } catch (error) {
      // Failed to send notification
    }

    return false;
  }, [isSupported, permissionGranted]);

  // 发送任务提醒通知
  const sendTaskReminder = useCallback(async (taskTitle: string, isExpired: boolean = false) => {
    const title = isExpired ? '⏰ 任务已到期' : '⏰ 任务即将到期';
    const body = taskTitle;
    return sendNotification(title, body);
  }, [sendNotification]);

  return {
    isSupported,
    permissionGranted,
    requestPermission: requestPermissionFn,
    sendNotification,
    sendTaskReminder,
  };
}
