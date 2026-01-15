/**
 * 主应用组件
 */

import { useEffect, useMemo, useState } from 'react';
import { AppProvider, useApp } from './AppContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider, ToastContainer } from './contexts/ToastContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
import { MockFileSystemAdapter } from './mockFileSystemAdapter';
import { ApiFileSystemAdapter } from './adapters/ApiFileSystemAdapter';
import { Sidebar } from './components/Sidebar';
import { PromptList } from './components/PromptList';
import { EditorOverlay } from './components/EditorOverlay';
// import { TopBar } from './components/TopBar';
import api from './api/client';

/**
 * 启动画面组件 - 优化首屏体验
 */
function SplashScreen() {
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-[999999]">
      <div className="text-center">
        {/* 应用图标 - 与桌面端风格一致 */}
        <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-xl shadow-purple-500/25">
          {/* 提示词/文档图标 */}
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {/* 主文档 */}
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <path d="M14 2v6h6"/>
            {/* 闪光/AI 符号 */}
            <path d="M12 18v-6"/>
            <path d="M9 15l3-3 3 3"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2 tracking-tight">PromptManager</h1>
        <p className="text-sm text-muted-foreground mb-4">提示词管理器</p>
        <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
          <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <span>正在启动...</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 应用内容组件
 */
interface AppContentProps {
  initialRoot: string;
}

function AppContent({ initialRoot }: AppContentProps) {
  const { state, loadVault, dispatch } = useApp();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    (async () => {
      if (initialRoot === '/api') {
        try {
          await api.trash.visit(10);
        } catch {
        }
      }
      await loadVault(initialRoot);
      // 🔥 延迟一小段时间确保 UI 渲染完成
      setTimeout(() => setIsInitializing(false), 100);
    })();
  }, [initialRoot, loadVault]);

  // 🔥 显示启动画面，直到数据加载完成
  if (isInitializing || state.uiState.isLoading) {
    return <SplashScreen />;
  }

  return (
    <div className="relative flex h-screen w-full bg-transparent text-foreground font-sans overflow-hidden selection:bg-primary/30">
      <div className="absolute inset-0 bg-grid pointer-events-none z-0" />
      <div className="absolute inset-0 aurora-bg pointer-events-none z-0" />
      <div className="relative z-10 flex h-screen w-full overflow-hidden">
        <Sidebar />
        <PromptList />
      </div>
      <ToastContainer />
      
      {/* 编辑器动画覆盖层 */}
      {state.uiState.editorOverlay.isOpen && 
       state.uiState.editorOverlay.promptId && 
       state.uiState.editorOverlay.originCardId && (
        <EditorOverlay
          promptId={state.uiState.editorOverlay.promptId}
          originCardId={state.uiState.editorOverlay.originCardId}
          onClose={() => dispatch({ type: 'CLOSE_EDITOR_OVERLAY' })}
        />
      )}
    </div>
  );
}

/**
 * 根组件
 */
export default function App() {
  const useMock = import.meta.env.VITE_USE_MOCK === 'true';
  const adapter = useMemo(
    () => (useMock ? new MockFileSystemAdapter() : new ApiFileSystemAdapter()),
    [useMock]
  );
  const initialRoot = useMock ? '/vault' : '/api';

  return (
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AppProvider adapter={adapter}>
            <AppContent initialRoot={initialRoot} />
          </AppProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
