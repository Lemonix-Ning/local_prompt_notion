import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};

interface ConfirmProviderProps {
  children: ReactNode;
}

interface ConfirmState {
  isOpen: boolean;
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

export const ConfirmProvider: React.FC<ConfirmProviderProps> = ({ children }) => {
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const confirm = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        options,
        resolve,
      });
    });
  };

  const handleConfirm = () => {
    if (confirmState) {
      confirmState.resolve(true);
      setConfirmState(null);
    }
  };

  const handleCancel = () => {
    if (confirmState) {
      confirmState.resolve(false);
      setConfirmState(null);
    }
  };

  const getButtonStyles = (type: ConfirmOptions['type']) => {
    switch (type) {
      case 'danger':
        return 'bg-red-500 hover:bg-red-600 text-white';
      case 'warning':
        return 'bg-yellow-500 hover:bg-yellow-600 text-white';
      case 'info':
      default:
        return 'bg-blue-500 hover:bg-blue-600 text-white';
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      
      {/* 确认对话框 */}
      {confirmState?.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] backdrop-blur-sm">
          <div className="bg-background border border-border rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            {confirmState.options.title && (
              <h3 className="text-lg font-semibold mb-3 text-foreground">
                {confirmState.options.title}
              </h3>
            )}
            
            <p className="text-muted-foreground mb-6 leading-relaxed">
              {confirmState.options.message}
            </p>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm rounded-md border border-border bg-background hover:bg-muted transition-colors"
              >
                {confirmState.options.cancelText || '取消'}
              </button>
              <button
                onClick={handleConfirm}
                className={`px-4 py-2 text-sm rounded-md transition-colors ${getButtonStyles(confirmState.options.type)}`}
              >
                {confirmState.options.confirmText || '确定'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};