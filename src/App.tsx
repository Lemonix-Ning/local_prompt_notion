/**
 * 主应用组件
 */

import { useEffect, useMemo } from 'react';
import { AppProvider, useApp } from './AppContext';
import { MockFileSystemAdapter } from './fileSystemAdapter';
import { ApiFileSystemAdapter } from './adapters/ApiFileSystemAdapter';
import { Sidebar } from './components/Sidebar';
import { PromptList } from './components/PromptList';
import api from './api/client';

/**
 * 应用内容组件
 */
interface AppContentProps {
  initialRoot: string;
}

function AppContent({ initialRoot }: AppContentProps) {
  const { state, loadVault } = useApp();

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
      <div className="flex items-center justify-center h-screen bg-[#09090b] text-zinc-200">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-zinc-400">加载 Vault 中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-full bg-[#09090b] text-zinc-200 font-sans overflow-hidden selection:bg-indigo-500/30">
      <div className="absolute inset-0 bg-grid pointer-events-none z-0 opacity-20" />
      <div className="absolute inset-0 aurora-bg pointer-events-none z-0" />
      <div className="relative z-10 flex h-screen w-full overflow-hidden">
        <Sidebar />
        <PromptList />
      </div>
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
    <AppProvider adapter={adapter}>
      <AppContent initialRoot={initialRoot} />
    </AppProvider>
  );
}
