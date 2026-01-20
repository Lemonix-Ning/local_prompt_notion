/**
 * 主应用组件
 */

import { useEffect, useMemo, useState } from 'react';
import { AppProvider, useApp } from './AppContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider, ToastContainer, useToast } from './contexts/ToastContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
import { MockFileSystemAdapter } from './mockFileSystemAdapter';
import { ApiFileSystemAdapter } from './adapters/ApiFileSystemAdapter';
import { Sidebar } from './components/Sidebar';
import { PromptList } from './components/PromptList';
import { EditorOverlay } from './components/EditorOverlay';
import { TaskEditorOverlay } from './components/TaskEditorOverlay';
// import { TopBar } from './components/TopBar';
import api from './api/client';
import { startupTimer, startPerformanceMonitoring } from './utils/performanceMonitor';
import { importMarkdownFile } from './utils/markdownImporter';
import { importJsonFile } from './utils/jsonImporter';
import { Upload } from 'lucide-react';

/**
 * 启动画面组件 - Brand Splash (光之构筑)
 * 
 * 基于 SVG 路径动画的品牌启动页
 * - 路径描边 (Path Tracing): 线条自动绘制效果
 * - 等轴投影 (Isometric Projection): "L" 形 Logo
 * - 能量注入 (Fill & Glow): 填充颜色 + 发光质感
 * 
 * 🚀 智能关闭策略：
 * - 第一次启动（需要复制示例数据）：等待数据加载完成
 * - 后续启动（数据已存在）：最短 1.2 秒动画后关闭
 */
interface SplashScreenProps {
  onComplete?: () => void;
  dataReady?: boolean; // 数据是否已加载完成
}

function SplashScreen({ onComplete, dataReady = false }: SplashScreenProps) {
  const [exiting, setExiting] = useState(false);
  const [minAnimationComplete, setMinAnimationComplete] = useState(false);

  // 🔥 首次渲染时立即隐藏 HTML 层的启动画面，并显示 Tauri 窗口
  useEffect(() => {
    const initialSplash = document.getElementById('initial-splash');
    if (initialSplash) {
      initialSplash.style.display = 'none';
    }
    
    // 🔥 显示 Tauri 窗口（如果是桌面应用）
    if (typeof window !== 'undefined' && window.location.port === '1420') {
      (async () => {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const appWindow = getCurrentWindow();
          await appWindow.show();
        } catch (error) {
          console.error('Failed to show window:', error);
        }
      })();
    }
  }, []);

  useEffect(() => {
    // 🚀 最短动画时间：1.2 秒（线条绘制 + 填充）
    const minAnimationTimer = setTimeout(() => {
      setMinAnimationComplete(true);
    }, 1200);
    
    return () => {
      clearTimeout(minAnimationTimer);
    };
  }, []);

  useEffect(() => {
    // 🚀 智能关闭：当最短动画完成 AND 数据已加载时，开始退出
    if (minAnimationComplete && dataReady && !exiting) {
      setExiting(true);
      
      // 退出动画 0.4 秒后回调
      const exitTimer = setTimeout(() => {
        onComplete?.();
      }, 400);
      
      // 不需要 cleanup，因为我们只设置一次 timer
      return () => {
        clearTimeout(exitTimer);
      };
    }
  }, [minAnimationComplete, dataReady, onComplete]); // 移除 exiting 从依赖数组

  return (
    <div 
      className={`splash-container fixed inset-0 bg-background flex items-center justify-center z-[999999] ${exiting ? 'animate-exit' : ''}`}
    >
      <div className="text-center">
        {/* Logo SVG - 等轴投影 "L" 形 (Lumina 首字母) */}
        <div className="w-24 h-24 mx-auto mb-6 splash-path-glow">
          <svg 
            viewBox="0 0 100 100" 
            className="w-full h-full"
            style={{ filter: 'drop-shadow(0 0 12px rgba(99, 102, 241, 0.5))' }}
          >
            {/* 定义渐变 */}
            <defs>
              <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="50%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
              <linearGradient id="strokeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#c084fc" />
              </linearGradient>
            </defs>
            
            {/* 外轮廓 - 等轴 "L" 形 */}
            <path 
              d="M30 20 L30 70 L80 85 L80 55 L50 45 L50 25 L30 20Z"
              className="splash-path splash-path-animate"
              stroke="url(#strokeGradient)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="url(#logoGradient)"
            />
            
            {/* 内部高光线条 - 增加立体感 */}
            <path 
              d="M35 28 L35 65 L75 78"
              className="splash-path splash-path-animate"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              style={{ animationDelay: '0.3s' }}
            />
            
            {/* 顶部装饰线 */}
            <path 
              d="M32 22 L48 27"
              className="splash-path splash-path-animate"
              stroke="rgba(255,255,255,0.6)"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
              style={{ animationDelay: '0.5s' }}
            />
          </svg>
        </div>
        
        {/* Brand Name - 文字上浮动画 */}
        <h1 className="splash-text splash-text-animate text-2xl font-bold text-foreground mb-2 tracking-tight">
          Lumina
        </h1>
        
        {/* Subtitle - 延迟上浮 */}
        <p className="splash-text splash-subtext-animate text-sm text-muted-foreground">
          本地优先的 AI 卡片与任务工作台
        </p>
        
        {/* 🚀 加载提示 - 只在数据未加载完成且动画已完成时显示 */}
        {minAnimationComplete && !dataReady && (
          <div className="mt-6 text-sm text-muted-foreground animate-pulse">
            正在初始化数据...
          </div>
        )}
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
  const { state, loadVault, dispatch, getFilteredPrompts, refreshVault } = useApp();
  const { showToast } = useToast();
  const [dataLoaded, setDataLoaded] = useState(false);
  const [splashComplete, setSplashComplete] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Global drag-and-drop handlers
  const handleGlobalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Disable drag-drop while importing to prevent concurrent imports
    if (isImporting) {
      return;
    }
    
    // Only show drag feedback if files are being dragged
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingFile(true);
    }
  };

  const handleGlobalDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only hide feedback when leaving the window entirely
    // Check if we're leaving to outside the app (relatedTarget is null)
    if (!e.relatedTarget || !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setIsDraggingFile(false);
    }
  };

  const handleGlobalDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    
    // Disable drag-drop while importing to prevent concurrent imports
    if (isImporting) {
      return;
    }
    
    const files = Array.from(e.dataTransfer.files);
    await processDroppedFiles(files);
  };

  const processDroppedFiles = async (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    for (const file of files) {
      const fileName = file.name.toLowerCase();
      
      if (fileName.endsWith('.md')) {
        await handleMarkdownImport(file);
      } else if (fileName.endsWith('.json')) {
        await handleJsonImport(file);
      } else {
        // Invalid file type - show error
        showToast(`不支持的文件类型: ${file.name}`, 'error');
      }
    }
  };

  /**
   * Handle Markdown file import
   * - Parses the Markdown file to extract title and content
   * - Creates a new prompt in the root category
   * - Refreshes the vault to update the UI
   * - Opens the edit page for the newly created prompt
   */
  const handleMarkdownImport = async (file: File) => {
    setIsImporting(true);
    showToast('正在导入 Markdown 文件...', 'info');
    
    try {
      // Import to root category by default
      const rootCategory = state.fileSystem?.root || '';
      const result = await importMarkdownFile(file, rootCategory, api);
      
      if (result.success && result.promptId) {
        // Refresh vault to update the UI with the new prompt
        try {
          await refreshVault();
        } catch (refreshError) {
          // Handle refresh errors gracefully with toast notification
          const refreshErrorMessage = refreshError instanceof Error ? refreshError.message : '刷新数据失败';
          showToast(`导入成功，但${refreshErrorMessage}`, 'warning');
          console.error('Failed to refresh vault after Markdown import:', refreshError);
        }
        
        showToast('Markdown 导入成功', 'success');
        
        // Navigate to edit page by opening the editor overlay
        const originCardId = `prompt-card-${result.promptId}`;
        dispatch({
          type: 'OPEN_EDITOR_OVERLAY',
          payload: {
            promptId: result.promptId,
            originCardId
          }
        });
      } else {
        showToast(`导入失败: ${result.error}`, 'error');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '导入过程中发生错误';
      showToast(errorMessage, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  /**
   * Handle JSON file import
   * - Parses the JSON file and validates structure
   * - Imports prompts with default category "公共" and rename conflict strategy
   * - Refreshes the vault to update the UI
   * - Shows toast notification with import results (success/failed/skipped counts)
   */
  const handleJsonImport = async (file: File) => {
    setIsImporting(true);
    showToast('正在导入 JSON 文件...', 'info');
    
    try {
      const result = await importJsonFile(file, api, {
        defaultCategory: '公共',
        conflictStrategy: 'rename',
      });
      
      if (result.success && result.results) {
        // Refresh vault to update the UI with the new prompts
        try {
          await refreshVault();
        } catch (refreshError) {
          // Handle refresh errors gracefully with toast notification
          const refreshErrorMessage = refreshError instanceof Error ? refreshError.message : '刷新数据失败';
          showToast(`导入成功，但${refreshErrorMessage}`, 'warning');
          console.error('Failed to refresh vault after JSON import:', refreshError);
        }
        
        const { total, success, failed, skipped } = result.results;
        showToast(
          `导入完成: 成功 ${success}/${total}, 失败 ${failed}, 跳过 ${skipped}`,
          success > 0 ? 'success' : 'error'
        );
      } else {
        // Handle errors: parse errors, API errors
        showToast(`导入失败: ${result.error}`, 'error');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '导入过程中发生错误';
      showToast(errorMessage, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  useEffect(() => {
    (async () => {
      // 🔥 如果是桌面应用，先启动后端（如果需要）
      if (typeof window !== 'undefined' && window.location.port === '1420') {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('start_backend_if_needed');
          
          // 🚀 等待后端完全启动（健康检查）
          const maxRetries = 30; // 最多等待 15 秒
          let retries = 0;
          let backendReady = false;
          
          while (retries < maxRetries && !backendReady) {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 500);
              
              const response = await fetch('http://localhost:3002/health', {
                method: 'GET',
                signal: controller.signal,
              });
              
              clearTimeout(timeoutId);
              
              if (response.ok) {
                backendReady = true;
                break;
              }
            } catch (error) {
              // 后端还没准备好，继续等待
            }
            
            retries++;
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          if (!backendReady) {
            console.warn('Backend health check timeout, proceeding anyway');
          }
        } catch (error) {
          console.error('Failed to start backend:', error);
        }
      }
      
      if (initialRoot === '/api') {
        try {
          await api.trash.visit(10);
        } catch {
        }
      }
      
      try {
        startupTimer.mark('vault_scan_start');
        await loadVault(initialRoot);
        startupTimer.mark('vault_scanned');
        setDataLoaded(true);
      } catch (error) {
        console.error('Failed to load vault:', error);
        // 即使加载失败，也标记为已加载，避免永远卡在启动页面
        setDataLoaded(true);
      }
    })();
  }, [initialRoot, loadVault]);

  // 🔥 隐藏 HTML 层启动画面的函数
  const hideInitialSplash = () => {
    const initialSplash = document.getElementById('initial-splash');
    if (initialSplash) {
      initialSplash.classList.add('hidden');
      setTimeout(() => initialSplash.remove(), 300);
    }
  };

  // 处理 Splash 动画完成
  const handleSplashComplete = () => {
    setSplashComplete(true);
    hideInitialSplash();
  };

  // 🔥 当主界面显示时，确保 HTML 启动画面被隐藏
  useEffect(() => {
    if (dataLoaded && splashComplete) {
      hideInitialSplash();
      // Mark as interactive when main UI is ready
      startupTimer.mark('interactive');
      
      // Log startup metrics in development
      if (import.meta.env.DEV) {
        const metrics = startupTimer.getStartupMetrics();
        console.log('[Startup Metrics]', metrics);
      }
    }
  }, [dataLoaded, splashComplete]);

  // 🚀 智能 Splash 显示逻辑：
  // - 显示 Splash 直到数据加载完成 AND Splash 动画完成
  // - 将 dataLoaded 状态传递给 SplashScreen，让它根据数据状态决定何时退出
  const showSplash = !dataLoaded || !splashComplete;

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} dataReady={dataLoaded} />;
  }

  return (
    <div 
      className="relative flex h-screen w-full bg-transparent text-foreground font-sans selection:bg-primary/30"
      style={{ overflow: 'visible' }}
      onDragOver={handleGlobalDragOver}
      onDragLeave={handleGlobalDragLeave}
      onDrop={handleGlobalDrop}
    >
      <div className="absolute inset-0 bg-grid pointer-events-none z-0" />
      <div className="absolute inset-0 aurora-bg pointer-events-none z-0" />
      <div className="relative z-10 flex h-screen w-full overflow-hidden">
        <Sidebar />
        <PromptList />
      </div>
      <ToastContainer />
      
      {/* Visual feedback overlay for drag operations */}
      {isDraggingFile && (
        <div className="fixed inset-0 z-50 bg-indigo-500/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8 border-2 border-dashed border-indigo-500">
            <Upload className="w-16 h-16 text-indigo-500 mx-auto mb-4" />
            <p className="text-xl font-semibold text-gray-900 dark:text-white">
              拖放文件以导入
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              支持 .md 和 .json 文件
            </p>
          </div>
        </div>
      )}
      
      {/* Loading indicator during import operations */}
      {isImporting && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-zinc-800">
            <div className="flex items-center space-x-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                正在导入文件...
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* 编辑器动画覆盖层 - 根据类型选择不同编辑器 */}
      {state.uiState.editorOverlay.isOpen && 
       state.uiState.editorOverlay.promptId && 
       state.uiState.editorOverlay.originCardId && (
        (() => {
          const prompt = state.fileSystem?.allPrompts.get(state.uiState.editorOverlay.promptId);
          const isTask = prompt?.meta.type === 'TASK';
          
          // 🔥 获取当前视图的所有卡片 ID 列表（用于左右箭头导航）
          const promptIds = getFilteredPrompts().map(p => p.meta.id);
          
          // 🔥 导航到其他卡片的回调
          const handleNavigate = (newPromptId: string, newOriginCardId: string) => {
            dispatch({
              type: 'OPEN_EDITOR_OVERLAY',
              payload: {
                promptId: newPromptId,
                originCardId: newOriginCardId
              }
            });
          };
          
          return isTask ? (
            <TaskEditorOverlay
              promptId={state.uiState.editorOverlay.promptId}
              originCardId={state.uiState.editorOverlay.originCardId}
              onClose={() => dispatch({ type: 'CLOSE_EDITOR_OVERLAY' })}
              promptIds={promptIds}
              onNavigate={handleNavigate}
            />
          ) : (
            <EditorOverlay
              promptId={state.uiState.editorOverlay.promptId}
              originCardId={state.uiState.editorOverlay.originCardId}
              onClose={() => dispatch({ type: 'CLOSE_EDITOR_OVERLAY' })}
              promptIds={promptIds}
              onNavigate={handleNavigate}
            />
          );
        })()
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

  // Start performance monitoring
  useEffect(() => {
    startupTimer.mark('first_paint');
    const stopMonitoring = startPerformanceMonitoring();
    
    return () => {
      stopMonitoring();
    };
  }, []);

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
