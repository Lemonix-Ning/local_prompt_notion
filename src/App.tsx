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
import { TaskEditorOverlay } from './components/TaskEditorOverlay';
// import { TopBar } from './components/TopBar';
import api from './api/client';

/**
 * 启动画面组件 - Brand Splash (光之构筑)
 * 
 * 基于 SVG 路径动画的品牌启动页
 * - 路径描边 (Path Tracing): 线条自动绘制效果
 * - 等轴投影 (Isometric Projection): "L" 形 Logo
 * - 能量注入 (Fill & Glow): 填充颜色 + 发光质感
 */
interface SplashScreenProps {
  onComplete?: () => void;
}

function SplashScreen({ onComplete }: SplashScreenProps) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // 编排动画时间轴
    // 1.8s: 线条绘制(1.2s) + 填充(0.6s) 完成后开始退出
    const t1 = setTimeout(() => setExiting(true), 1800);
    // 2.4s: 退出动画(0.6s)完成后回调
    const t2 = setTimeout(() => onComplete?.(), 2400);
    
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onComplete]);

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
          PromptManager
        </h1>
        
        {/* Subtitle - 延迟上浮 */}
        <p className="splash-text splash-subtext-animate text-sm text-muted-foreground">
          提示词管理器
        </p>
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
  const [dataLoaded, setDataLoaded] = useState(false);
  const [splashComplete, setSplashComplete] = useState(false);

  useEffect(() => {
    (async () => {
      if (initialRoot === '/api') {
        try {
          await api.trash.visit(10);
        } catch {
        }
      }
      await loadVault(initialRoot);
      setDataLoaded(true);
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
    }
  }, [dataLoaded, splashComplete]);

  // 只有当数据加载完成 AND Splash 动画完成时才显示主界面
  const showSplash = !dataLoaded || !splashComplete;

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
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
      
      {/* 编辑器动画覆盖层 - 根据类型选择不同编辑器 */}
      {state.uiState.editorOverlay.isOpen && 
       state.uiState.editorOverlay.promptId && 
       state.uiState.editorOverlay.originCardId && (
        (() => {
          const prompt = state.fileSystem?.allPrompts.get(state.uiState.editorOverlay.promptId);
          const isTask = prompt?.meta.type === 'TASK';
          
          return isTask ? (
            <TaskEditorOverlay
              promptId={state.uiState.editorOverlay.promptId}
              originCardId={state.uiState.editorOverlay.originCardId}
              onClose={() => dispatch({ type: 'CLOSE_EDITOR_OVERLAY' })}
            />
          ) : (
            <EditorOverlay
              promptId={state.uiState.editorOverlay.promptId}
              originCardId={state.uiState.editorOverlay.originCardId}
              onClose={() => dispatch({ type: 'CLOSE_EDITOR_OVERLAY' })}
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
