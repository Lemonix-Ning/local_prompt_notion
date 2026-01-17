import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  count?: number; // 消息计数
}

interface ToastContextType {
  toasts: Toast[];
  showToast: {
    (message: string, type?: Toast['type'], duration?: number): void;
    (type: Toast['type'], message: string, duration?: number): void;
  };
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function showToast(message: string, type?: Toast['type'], duration?: number): void;
  function showToast(type: Toast['type'], message: string, duration?: number): void;
  function showToast(a: string, b?: string, c: number = 3000) {
    const isTypeFirst = a === 'success' || a === 'error' || a === 'warning' || a === 'info';
    const type = (isTypeFirst ? (a as Toast['type']) : ((b as Toast['type']) || 'info'));
    const message = isTypeFirst ? (b || '') : a;
    const duration = c;

    setToasts(prev => {
      // 查找是否有相同类型和消息的 toast（在 3 秒内）
      const now = Date.now();
      const existingIndex = prev.findIndex(toast => {
        const toastTime = parseInt(toast.id);
        const timeDiff = now - toastTime;
        return toast.message === message && 
               toast.type === type && 
               timeDiff < 3000; // 3秒内的相同消息合并
      });

      if (existingIndex !== -1) {
        // 找到相同消息，增加计数
        const updated = [...prev];
        const oldToast = updated[existingIndex];
        updated[existingIndex] = {
          ...oldToast,
          count: (oldToast.count || 1) + 1,
          id: now.toString(), // 更新 ID 以重置定时器
        };
        return updated;
      } else {
        // 新消息
        const id = now.toString();
        const newToast: Toast = { id, message, type, duration, count: 1 };
        return [...prev, newToast];
      }
    });
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
};

// 单个 Toast 项组件
const ToastItem: React.FC<{ toast: Toast; onClose: (id: string) => void }> = ({ toast, onClose }) => {
  const { id, type, message, count } = toast;

  // 自动关闭逻辑 (3秒)
  // 使用 id 作为依赖，每次 id 变化时重置定时器
  useEffect(() => {
    const timer = setTimeout(() => onClose(id), toast.duration ?? 3000);
    return () => clearTimeout(timer);
  }, [id, onClose, toast.duration]);

  // 样式配置映射
  const config = {
    success: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    error:   { icon: XCircle,     color: 'text-rose-500',    bg: 'bg-rose-500/10' },
    warning: { icon: Info,        color: 'text-amber-500',   bg: 'bg-amber-500/10' },
    info:    { icon: Info,        color: 'text-blue-500',    bg: 'bg-blue-500/10' }
  };

  const { icon: Icon, color, bg } = config[type] || config.info;

  return (
    <div
      key={id} // 添加 key 确保 React 正确识别组件
      className={`
        pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl
        min-w-[280px] max-w-sm group cursor-default
        border border-[var(--toast-border)] bg-[var(--toast-bg)] text-[var(--toast-text)]
        backdrop-blur-md
        toast-enter
      `}
      style={{ boxShadow: 'var(--toast-shadow)' }}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${bg} ${color}`}>
        <Icon size={16} />
      </div>

      <div className="flex-1 flex items-center gap-2">
        <span className="text-sm font-medium truncate">{message}</span>
        {count && count > 1 && (
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${bg} ${color}`}>
            ×{count}
          </span>
        )}
      </div>

      <button
        onClick={() => onClose(id)}
        className="opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity p-1"
      >
        <X size={14} />
      </button>
    </div>
  );
};

// Toast 容器组件
export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-6 right-6 z-[999999] flex flex-col items-end gap-3 pointer-events-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
      ))}
    </div>
  );
};