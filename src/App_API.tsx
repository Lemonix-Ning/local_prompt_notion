/**
 * 主应用组件 (使用后端 API)
 */

import { useEffect } from 'react';
import { AppProvider, useApp } from './AppContext_API';
import { Sidebar } from './components/Sidebar';
import { PromptList } from './components/PromptList';
import { Editor } from './components/Editor';

/**
 * 应用内容组件
 */
function AppContent() {
  const { state, loadVault } = useApp();

  useEffect(() => {
    // 初始化:从后端加载 Vault
    loadVault();
  }, []);

  if (state.uiState.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载 Vault 中...</p>
        </div>
      </div>
    );
  }

  if (!state.fileSystem) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">无法连接到后端服务</p>
          <button
            onClick={loadVault}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-white text-gray-900 font-sans overflow-hidden">
      <Sidebar />
      <PromptList />
      <Editor />
    </div>
  );
}

/**
 * 根组件
 */
export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
