/**
 * 主题上下文
 * 管理全局主题状态
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // 从 localStorage 读取保存的主题，默认为浅色
    const saved = localStorage.getItem('theme');
    return (saved as Theme) || 'light';
  });

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

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
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