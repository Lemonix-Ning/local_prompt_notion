import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, type?: Toast['type'], duration?: number) => void;
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

  const showToast = (message: string, type: Toast['type'] = 'info', duration: number = 3000) => {
    const id = Date.now().toString();
    const newToast: Toast = { id, message, type, duration };
    
    setToasts(prev => [...prev, newToast]);
  };

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
    const timer = setTimeout(() => onClose(id), 3000);
    return () => clearTimeout(timer);
  }, [id, onClose]);

  // 样式配置映射
  const config = {
    success: { icon: CheckCircle, color: 'text-emerald-500', border: 'border-l-emerald-500' },
    error:   { icon: XCircle,     color: 'text-rose-500',    border: 'border-l-rose-500' },
    warning: { icon: AlertCircle, color: 'text-amber-500',   border: 'border-l-amber-500' },
    info:    { icon: AlertCircle, color: 'text-blue-500',    border: 'border-l-blue-500' }
  };
  
  const { icon: Icon, color, border } = config[type] || config.info;

  return (
    <div className={`
      relative w-80 p-4 mb-3 rounded-lg flex items-start gap-3 shadow-2xl toast-enter backdrop-blur-xl
      border border-[var(--toast-border)] bg-[var(--toast-bg)] text-[var(--toast-text)]
      border-l-4 ${border} overflow-hidden group pointer-events-auto
      animate-[slideIn_0.3s_ease-out]
    `}>
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${color}`} />
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold capitalize">
          {type === 'success' ? '操作成功' : type === 'error' ? '操作失败' : type === 'warning' ? '警告' : '提示'}
        </h4>
        <p className="text-xs opacity-80 mt-1 leading-relaxed break-words">{message}</p>
      </div>
      
      {/* 关闭按钮 */}
      <button 
        onClick={() => onClose(id)} 
        className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-black/5 transition-all text-[var(--text-secondary)]"
      >
        <X size={14} />
      </button>
      
      {/* 底部倒计时进度条 (CSS 动画) */}
      <div className={`absolute bottom-0 left-0 h-[2px] bg-current opacity-20 w-full animate-[shrink_3s_linear_forwards] origin-left ${color}`}></div>
    </div>
  );
};

// Toast 容器组件
export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end pointer-events-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
      ))}
    </div>
  );
};