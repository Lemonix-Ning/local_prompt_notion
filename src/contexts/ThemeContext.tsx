/**
 * 主题上下文
 * 管理全局主题状态
 */

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

type Theme = 'dark' | 'light';
type ThemeMode = 'manual' | 'auto';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('themeMode');
    return (saved as ThemeMode) || 'manual';
  });

  const [theme, setTheme] = useState<Theme>(() => {
    // 从 localStorage 读取保存的主题，默认为浅色
    const saved = localStorage.getItem('theme');
    return (saved as Theme) || 'light';
  });

  const setThemeManual = useCallback((nextTheme: Theme) => {
    setThemeMode('manual');
    setTheme(nextTheme);
  }, []);

  const getAutoTheme = useCallback((): Theme => {
    const now = new Date();
    const hour = now.getHours();
    return hour >= 7 && hour < 19 ? 'light' : 'dark';
  }, []);

  const scheduleNextAutoSwitch = useCallback(() => {
    const now = new Date();
    const hour = now.getHours();
    const next = new Date(now);
    if (hour < 7) {
      next.setHours(7, 0, 0, 0);
    } else if (hour < 19) {
      next.setHours(19, 0, 0, 0);
    } else {
      next.setDate(next.getDate() + 1);
      next.setHours(7, 0, 0, 0);
    }
    const delay = Math.max(0, next.getTime() - now.getTime());
    return window.setTimeout(() => {
      setTheme(getAutoTheme());
    }, delay);
  }, [getAutoTheme]);

  // 应用主题到 document.documentElement
  useEffect(() => {
    const root = document.documentElement;

    // 移除所有主题类
    root.classList.remove('dark', 'light');

    // 添加当前主题类
    root.classList.add(theme);

    // 保存主题到 localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('themeMode', themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (themeMode !== 'auto') return;
    setTheme(getAutoTheme());
    const timeoutId = scheduleNextAutoSwitch();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setTheme(getAutoTheme());
      }
    };

    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [themeMode, getAutoTheme, scheduleNextAutoSwitch]);

  const toggleTheme = () => {
    setThemeMode('manual');
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeManual, toggleTheme, themeMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}