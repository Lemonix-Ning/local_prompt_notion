import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
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

    const id = Date.now().toString();
    const newToast: Toast = { id, message, type, duration };
    setToasts(prev => [...prev, newToast]);
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
  const { id, type, message } = toast;

  // 自动关闭逻辑 (3秒)
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

      <span className="text-sm font-medium flex-1 truncate">{message}</span>

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