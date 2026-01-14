/**
 * 主应用组件
 */

import { useEffect, useMemo } from 'react';
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
 * 应用内容组件
 */
interface AppContentProps {
  initialRoot: string;
}

function AppContent({ initialRoot }: AppContentProps) {
  const { state, loadVault, dispatch } = useApp();

  useEffect(() => {
    (async () => {
      if (initialRoot === '/api') {
        try {
          await api.trash.visit(10);
        } catch {
        }
      }
      await loadVault(initialRoot);
    })();
  }, [initialRoot, loadVault]);

  if (state.uiState.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载 Vault 中...</p>
        </div>
      </div>
    );
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
