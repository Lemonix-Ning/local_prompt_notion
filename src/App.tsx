/**
 * 主应用组件
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type RefObject } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, type Transition } from 'framer-motion';
import { AppProvider, useApp } from './AppContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
import { LumiProvider, useLumi } from './contexts/LumiContext';
import { MockFileSystemAdapter } from './mockFileSystemAdapter';
import { ApiFileSystemAdapter } from './adapters/ApiFileSystemAdapter';
import { TauriFileSystemAdapter } from './adapters/TauriFileSystemAdapter';
import { Sidebar } from './components/Sidebar';
import { PromptList } from './components/PromptList';
import { EditorOverlay } from './components/EditorOverlay';
import { TaskEditorOverlay } from './components/TaskEditorOverlay';
import { SpiritCat, type LumiOrientation } from './components/SpiritCat';
// import { TopBar } from './components/TopBar';
import api from './api/client';
import { tauriClient } from './api/tauriClient';
import { startupTimer, startAdaptivePerformanceMonitoring, registerMonitoringController } from './utils/performanceMonitor';
import { createPerformanceSnapshot } from './utils/performanceSnapshot';
import { importMarkdownFile } from './utils/markdownImporter';
import { importJsonFile } from './utils/jsonImporter';
import { isTauriEnv } from './utils/tauriEnv';
import { AlertCircle, Bell, Check, Clock, Copy, Download, FileSignature, FolderPlus, Heart, Loader2, Pin, RotateCcw, Search, Sparkles, Trash2, Upload } from 'lucide-react';

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

  console.log('[SplashScreen] Rendered - dataReady:', dataReady, 'exiting:', exiting, 'minAnimationComplete:', minAnimationComplete);

  // 🔥 首次渲染时不要隐藏 HTML 启动画面，让它继续显示直到 React 启动画面准备好
  useEffect(() => {
    console.log('[SplashScreen] Component mounted');
    
    // 不再立即隐藏 initial-splash，让它保持显示
    // 只在 React 组件挂载后，逐渐过渡到 React 启动画面
    
    // 🔥 显示 Tauri 窗口（如果是桌面应用）- 在 React 渲染后立即显示
    const showWindow = async () => {
      // 检测是否在 Tauri 环境中（通过检查 __TAURI__ 全局变量）
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        try {
          console.log('[SplashScreen] Detected Tauri environment, showing window...');
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const appWindow = getCurrentWindow();
          await appWindow.show();
          await appWindow.setFocus();
          console.log('[SplashScreen] Window shown successfully');
        } catch (error) {
          console.error('[SplashScreen] Failed to show window:', error);
        }
      } else {
        console.log('[SplashScreen] Not in Tauri environment');
      }
    };
    
    showWindow();
    
    // 延迟一小段时间后再隐藏 HTML 启动画面，确保 React 已经渲染
    const hideTimer = setTimeout(() => {
      const initialSplash = document.getElementById('initial-splash');
      if (initialSplash) {
        console.log('[SplashScreen] Hiding HTML splash screen');
        initialSplash.classList.add('hidden');
        // 等待过渡动画完成后再移除元素
        setTimeout(() => {
          initialSplash.remove();
          console.log('[SplashScreen] HTML splash screen removed');
        }, 300);
      }
    }, 100); // 给 React 100ms 时间渲染
    
    return () => {
      clearTimeout(hideTimer);
    };
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

const CAT_SIZE = 100;
const CONTAINER_PADDING = 20;

// const calculateSnap = (x: number, y: number, containerWidth: number, containerHeight: number) => {
//   const distLeft = x;
//   const distRight = containerWidth - x - CAT_SIZE;
//   const distBottom = containerHeight - y - CAT_SIZE;

//   let snapX = x;
//   let snapY = y;
//   let orientation: LumiOrientation = 'bottom';

//   if (distBottom < 150) {
//     orientation = 'bottom';
//     snapY = containerHeight - CAT_SIZE - CONTAINER_PADDING;
//     snapX = Math.max(CONTAINER_PADDING, Math.min(x, containerWidth - CAT_SIZE - CONTAINER_PADDING));
//   } else if (distLeft < distRight) {
//     orientation = 'left';
//     snapX = CONTAINER_PADDING;
//     snapY = Math.max(CONTAINER_PADDING, Math.min(y, containerHeight - CAT_SIZE - CONTAINER_PADDING));
//   } else {
//     orientation = 'right';
//     snapX = containerWidth - CAT_SIZE - CONTAINER_PADDING;
//     snapY = Math.max(CONTAINER_PADDING, Math.min(y, containerHeight - CAT_SIZE - CONTAINER_PADDING));
//   }

//   return { x: snapX, y: snapY, orientation };
// };

// 闲聊词库 - 常量定义，避免重复创建
const IDLE_PHRASES = ['Lumi Lumi~', 'System stable.', 'Pixel perfect.', 'Meow?', 'stares'] as const;

const EDGE_BAND = 64;
const SAFE_MARGIN = 16;

const getSidebarWidth = (sidebarOpen: boolean) => {
  if (!sidebarOpen) return 0;
  const sidebarElement = document.querySelector('[data-sidebar]') as HTMLElement | null;
  return sidebarElement ? sidebarElement.offsetWidth : 0;
};

const getSafeBounds = (rect: DOMRect, sidebarOpen: boolean, sidebarWidth: number) => {
  const minX = (sidebarOpen && sidebarWidth > 0 ? sidebarWidth : 0) + SAFE_MARGIN;
  const maxX = rect.width - CAT_SIZE - SAFE_MARGIN;
  const minY = SAFE_MARGIN;
  const maxY = rect.height - CAT_SIZE - SAFE_MARGIN;
  return { minX, maxX, minY, maxY };
};

const pickWanderTarget = (
  container: HTMLDivElement | null,
  sidebarOpen: boolean,
  sidebarWidth: number
) => {
  if (!container) return null;
  const rect = container.getBoundingClientRect();
  const { minX, maxX, minY, maxY } = getSafeBounds(rect, sidebarOpen, sidebarWidth);
  const randomBetween = (min: number, max: number) => min + Math.random() * Math.max(0, max - min);

  // 只在边缘带内活动，避免覆盖内容区
  // bottom: 35%, right: 35%, top: 20%, left: 10% (侧边栏打开时降为 0)
  const edgeRoll = Math.random();
  const allowLeft = !(sidebarOpen && sidebarWidth > 0);
  const leftWeight = allowLeft ? 0.1 : 0;
  const topWeight = 0.2;
  const bottomWeight = 0.35;
  const rightWeight = 0.35;
  const topCutoff = topWeight;
  const bottomCutoff = topCutoff + bottomWeight;
  const rightCutoff = bottomCutoff + rightWeight;
  const leftCutoff = rightCutoff + leftWeight;
  const edge: LumiOrientation =
    edgeRoll < topCutoff ? 'top'
    : edgeRoll < bottomCutoff ? 'bottom'
    : edgeRoll < rightCutoff ? 'right'
    : edgeRoll < leftCutoff ? 'left'
    : 'bottom'; // fallback

  const randX = randomBetween(minX, maxX);
  const randY = randomBetween(minY, maxY);
  const x = Math.max(minX, Math.min(randX, maxX));
  const y = Math.max(minY, Math.min(randY, maxY));

  if (edge === 'bottom') {
    return { x, y: Math.max(minY, maxY - EDGE_BAND), orientation: 'bottom' as const };
  }
  if (edge === 'left') {
    return { x: minX, y, orientation: 'left' as const };
  }
  if (edge === 'right') {
    return { x: maxX, y, orientation: 'right' as const };
  }
  return { x, y: minY, orientation: 'top' as const };
};

function LumiOverlay({ containerRef }: { containerRef: RefObject<HTMLDivElement> }) {
  const { theme } = useTheme();
  const { toasts } = useToast();
  const { state } = useApp(); // 获取 app 状态，包括侧边栏信息
  const {
    action,
    transferState,
    timeState,
    isWindy,
    isSleeping,
    isDragging,
    notificationMessage,
    alert,
    // setDragging,
    notifyMessage,
    // focusAlert,
    // dismissAlert,
  } = useLumi();
  const [orientation, setOrientation] = useState<LumiOrientation>('bottom');
  const [chatMessage, setChatMessage] = useState<string | null>(null);
  const [wakePulse, setWakePulse] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const chatMessageRef = useRef<string | null>(null);
  const isThinkingRef = useRef(false);
  const lastIdlePulseAtRef = useRef(0);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const pupilX = useMotionValue(0);
  const pupilY = useMotionValue(0);
  const activeMovesRef = useRef<ReturnType<typeof animate>[]>([]);
  const hasInitializedRef = useRef(false);
  const wasSleepingRef = useRef(isSleeping);
  const lastToastIdRef = useRef<string | null>(null);
  const isMovementBusy = isDragging || action !== null || transferState !== null || timeState !== null || alert !== null || isThinking;
  const isIdleBlocked = isDragging || action !== null || transferState !== null || timeState !== null || alert !== null;
  const isBusyForMovement = isMovementBusy || chatMessage !== null;
  const bubbleStyles = {
    neutral: {
      container: 'bg-background/90 text-foreground border-border',
      tail: 'bg-background/90 border-border',
    },
    cyan: {
      container: theme === 'dark' ? 'bg-cyan-900/80 text-cyan-100 border-cyan-800' : 'bg-cyan-50 text-cyan-900 border-cyan-100',
      tail: theme === 'dark' ? 'bg-cyan-900/80 border-cyan-800' : 'bg-cyan-50 border-cyan-100',
    },
    orange: {
      container: theme === 'dark' ? 'bg-orange-900/80 text-orange-100 border-orange-800' : 'bg-orange-50 text-orange-900 border-orange-100',
      tail: theme === 'dark' ? 'bg-orange-900/80 border-orange-800' : 'bg-orange-50 border-orange-100',
    },
    emerald: {
      container: theme === 'dark' ? 'bg-emerald-900/80 text-emerald-100 border-emerald-800' : 'bg-emerald-50 text-emerald-900 border-emerald-100',
      tail: theme === 'dark' ? 'bg-emerald-900/80 border-emerald-800' : 'bg-emerald-50 border-emerald-100',
    },
    rose: {
      container: theme === 'dark' ? 'bg-rose-900/80 text-rose-100 border-rose-800' : 'bg-rose-50 text-rose-900 border-rose-100',
      tail: theme === 'dark' ? 'bg-rose-900/80 border-rose-800' : 'bg-rose-50 border-rose-100',
    },
    teal: {
      container: theme === 'dark' ? 'bg-teal-900/80 text-teal-100 border-teal-800' : 'bg-teal-50 text-teal-900 border-teal-100',
      tail: theme === 'dark' ? 'bg-teal-900/80 border-teal-800' : 'bg-teal-50 border-teal-100',
    },
    pink: {
      container: theme === 'dark' ? 'bg-pink-900/80 text-pink-100 border-pink-800' : 'bg-pink-50 text-pink-900 border-pink-100',
      tail: theme === 'dark' ? 'bg-pink-900/80 border-pink-800' : 'bg-pink-50 border-pink-100',
    },
    amber: {
      container: theme === 'dark' ? 'bg-amber-900/80 text-amber-100 border-amber-800' : 'bg-amber-50 text-amber-900 border-amber-100',
      tail: theme === 'dark' ? 'bg-amber-900/80 border-amber-800' : 'bg-amber-50 border-amber-100',
    },
    violet: {
      container: theme === 'dark' ? 'bg-violet-900/80 text-violet-100 border-violet-800' : 'bg-violet-50 text-violet-900 border-violet-100',
      tail: theme === 'dark' ? 'bg-violet-900/80 border-violet-800' : 'bg-violet-50 border-violet-100',
    },
    green: {
      container: theme === 'dark' ? 'bg-green-900/80 text-green-100 border-green-800' : 'bg-green-50 text-green-900 border-green-100',
      tail: theme === 'dark' ? 'bg-green-900/80 border-green-800' : 'bg-green-50 border-green-100',
    },
    blue: {
      container: theme === 'dark' ? 'bg-blue-900/80 text-blue-100 border-blue-800' : 'bg-blue-50 text-blue-900 border-blue-100',
      tail: theme === 'dark' ? 'bg-blue-900/80 border-blue-800' : 'bg-blue-50 border-blue-100',
    },
    indigo: {
      container: theme === 'dark' ? 'bg-zinc-800 text-white border-zinc-700' : 'bg-white text-zinc-800 border-zinc-200',
      tail: theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-200',
    },
  };
  type BubbleTone = keyof typeof bubbleStyles;
  type BubbleMotion = {
    initial: Record<string, number | number[]>;
    animate: Record<string, number | number[]>;
    exit: Record<string, number | number[]>;
    transition: Transition;
  };
  type BubbleConfig = {
    kind: 'action' | 'chat';
    text: string;
    tone: BubbleTone;
    icon?: JSX.Element;
    motion?: BubbleMotion;
    containerClassName?: string;
    tailClassName?: string;
    containerStyle?: React.CSSProperties;
    borderless?: boolean;
    positionClassName?: string;
  };
  
  // 统一动作气泡动画：从身体中心向上跃升到光环上方
  const unifiedActionMotion: BubbleMotion = {
    initial: { opacity: 0, y: 0, scale: 0.8 },
    animate: { opacity: 1, y: -80, scale: 1 },
    exit: { opacity: 0, y: -100, scale: 0.8 },
    transition: { duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }, // easeOutBack
  };
  
  const stopActiveMoves = useCallback(() => {
    activeMovesRef.current.forEach(control => control.stop());
    activeMovesRef.current = [];
  }, []);

  useEffect(() => {
    chatMessageRef.current = chatMessage;
  }, [chatMessage]);

  useEffect(() => {
    isThinkingRef.current = isThinking;
  }, [isThinking]);

  useEffect(() => {
    const syncPosition = () => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (!hasInitializedRef.current) {
        const centeredX = Math.random() * (rect.width - CAT_SIZE - 2 * CONTAINER_PADDING) + CONTAINER_PADDING;
        const initialX = Math.max(CONTAINER_PADDING, Math.min(centeredX, rect.width - CAT_SIZE - CONTAINER_PADDING));
        const initialY = Math.max(CONTAINER_PADDING, Math.min(rect.height - CAT_SIZE - CONTAINER_PADDING, rect.height - CAT_SIZE - CONTAINER_PADDING));
        x.set(initialX);
        y.set(initialY);
        setOrientation('bottom');
        hasInitializedRef.current = true;
        return;
      }
      const nx = Math.max(CONTAINER_PADDING, Math.min(x.get(), rect.width - CAT_SIZE - CONTAINER_PADDING));
      const ny = Math.max(CONTAINER_PADDING, Math.min(y.get(), rect.height - CAT_SIZE - CONTAINER_PADDING));
      x.set(nx);
      y.set(ny);
    };
    syncPosition();
    window.addEventListener('resize', syncPosition);
    return () => window.removeEventListener('resize', syncPosition);
  }, [containerRef, x, y]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const centerX = rect.left + x.get() + CAT_SIZE / 2;
      const centerY = rect.top + y.get() + CAT_SIZE / 2;
      const dx = event.clientX - centerX;
      const dy = event.clientY - centerY;
      const angle = Math.atan2(dy, dx);
      const distance = Math.min(3, Math.sqrt(dx * dx + dy * dy) / 20);
      pupilX.set(Math.cos(angle) * distance);
      pupilY.set(Math.sin(angle) * distance);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [containerRef, orientation, pupilX, pupilY, x, y]);

  useEffect(() => {
    if (isMovementBusy || isSleeping) {
      stopActiveMoves();
    }
  }, [isMovementBusy, isSleeping, stopActiveMoves]);



  useEffect(() => {
    if (isMovementBusy || isSleeping) {
      setChatMessage(null);
    }
  }, [isMovementBusy, isSleeping]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const latest = toasts[toasts.length - 1];
    if (latest.id === lastToastIdRef.current) return;
    lastToastIdRef.current = latest.id;
    if (latest.type === 'success') {
      notifyMessage(latest.message, latest.duration ?? 3000);
    }
  }, [notifyMessage, toasts]);

  useEffect(() => {
    if (isSleeping) {
      setChatMessage(null);
      setIsThinking(false);
    }
  }, [isSleeping]);

  useEffect(() => {
    let timeoutId: number | null = null;
    let cancelled = false;

    const moveTo = async (target: { x: number; y: number; orientation: LumiOrientation }) => {
      stopActiveMoves();
      setOrientation(target.orientation);
      const distance = Math.hypot(target.x - x.get(), target.y - y.get());
      const duration = distance / 150;
      const moveX = animate(x, target.x, { duration, ease: 'linear' });
      const moveY = animate(y, target.y, { duration, ease: 'linear' });
      activeMovesRef.current = [moveX, moveY];
      await Promise.all([moveX.finished, moveY.finished]);
    };

    const wander = async () => {
      if (cancelled) return;
      if (isBusyForMovement || isSleeping) {
        timeoutId = window.setTimeout(wander, 5000);
        return;
      }
      const sidebarOpen = state.uiState.sidebarOpen;
      const sidebarWidth = getSidebarWidth(sidebarOpen);
      const target = pickWanderTarget(containerRef.current, sidebarOpen, sidebarWidth);
      if (target) {
        await moveTo(target);
      }
      timeoutId = window.setTimeout(wander, 5000 + Math.random() * 7000);
    };

    timeoutId = window.setTimeout(wander, 5000 + Math.random() * 7000);
    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [containerRef, isBusyForMovement, isSleeping, stopActiveMoves, x, y]);

  useEffect(() => {
    let timeoutId: number | null = null;
    if (wasSleepingRef.current && !isSleeping) {
      setWakePulse(true);
      timeoutId = window.setTimeout(() => setWakePulse(false), 600);
    }
    wasSleepingRef.current = isSleeping;
    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isSleeping]);

  // const handleDragStart = () => {
  //   setDragging(true);
  //   setChatMessage(null);
  //   setIsThinking(false);
  //   stopActiveMoves();
  // };

  // const handleDragEnd = () => {
  //   setDragging(false);
  //   const container = containerRef.current;
  //   if (!container) return;
  //   const rect = container.getBoundingClientRect();
  //   const snap = calculateSnap(x.get(), y.get(), rect.width, rect.height);
  //   setOrientation(snap.orientation);
  //   stopActiveMoves();
  //   const moveX = animate(x, snap.x, { type: 'spring', stiffness: 300, damping: 25 });
  //   const moveY = animate(y, snap.y, { type: 'spring', stiffness: 300, damping: 25 });
  //   activeMovesRef.current = [moveX, moveY];
  // };

  useEffect(() => {
    let timeoutId: number | null = null;
    let clearId: number | null = null;
    
    const scheduleNext = (delay: number) => {
      timeoutId = window.setTimeout(runIdlePulse, delay);
    };
    
    const runIdlePulse = () => {
      const now = Date.now();
      if (lastIdlePulseAtRef.current && now - lastIdlePulseAtRef.current < 15000) {
        scheduleNext(Math.max(15000 - (now - lastIdlePulseAtRef.current), 4000));
        return;
      }
      // 合并条件检查：确保互斥和不打扰用户
      const shouldTrigger = !isIdleBlocked && !isSleeping && !chatMessageRef.current && !isThinkingRef.current;
      
      if (!shouldTrigger) {
        scheduleNext(8000);
        return;
      }
      
      // 随机选择触发类型 - Chat 远远高于 Thinking
      const useThinking = Math.random() < 0.15; // 15% Thinking，85% Chat
      
      if (useThinking) {
        // Thinking 模式
        setIsThinking(true);
        const thinkingDuration = 3000 + Math.random() * 2000; // 3-5秒
        lastIdlePulseAtRef.current = now;
        clearId = window.setTimeout(() => {
          setIsThinking(false);
        }, thinkingDuration);
        
        // 下次触发延迟：18-28秒（更长的间隔）
        scheduleNext(18000 + Math.random() * 10000);
      } else {
        // Chat 模式
        const text = IDLE_PHRASES[Math.floor(Math.random() * IDLE_PHRASES.length)];
        setChatMessage(text);
        const chatDuration = 2500 + Math.random() * 500; // 2.5-3秒
        lastIdlePulseAtRef.current = now;
        clearId = window.setTimeout(() => {
          setChatMessage(null);
        }, chatDuration);
        
        // 下次触发延迟：18-28秒（更长的间隔）
        scheduleNext(18000 + Math.random() * 10000);
      }
    };
    
    // 初始延迟：4-8秒
    scheduleNext(4000 + Math.random() * 4000);
    
    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      if (clearId !== null) {
        window.clearTimeout(clearId);
      }
    };
  }, [isIdleBlocked, isSleeping]);

  const mode: ComponentProps<typeof SpiritCat>['mode'] =
    isDragging
      ? 'dragging'
      : isSleeping
        ? 'sleep'
        : action ?? transferState ?? timeState ?? (isWindy ? 'windy' : chatMessage || wakePulse ? 'chat' : 'idle');

  const actionBubble = action
    ? {
        create_card: {
          text: notificationMessage ?? 'New Card!',
          icon: (
            <motion.span animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}>
              <Sparkles size={14} />
            </motion.span>
          ),
          tone: 'cyan' as const,
          motion: unifiedActionMotion,
        },
        create_folder: { text: notificationMessage ?? 'New Folder!', icon: <FolderPlus size={14} />, tone: 'orange' as const, motion: unifiedActionMotion },
        update: { text: notificationMessage ?? 'Saved!', icon: <Check size={12} />, tone: 'emerald' as const, motion: unifiedActionMotion },
        delete: { text: notificationMessage ?? 'Deleted!', icon: <Trash2 size={12} />, tone: 'rose' as const, motion: unifiedActionMotion },
        restore: { text: notificationMessage ?? 'Restored!', icon: <RotateCcw size={12} />, tone: 'teal' as const, motion: unifiedActionMotion },
        favorite: { text: notificationMessage ?? 'Loved!', icon: <Heart size={12} />, tone: 'pink' as const, motion: unifiedActionMotion },
        pin: { text: notificationMessage ?? 'Pinned!', icon: <Pin size={12} />, tone: 'amber' as const, motion: unifiedActionMotion },
        rename: { text: notificationMessage ?? 'Renamed!', icon: <FileSignature size={12} />, tone: 'violet' as const, motion: unifiedActionMotion },
        clipboard: { text: notificationMessage ?? 'Copied!', icon: <Copy size={12} />, tone: 'green' as const, motion: unifiedActionMotion },
        search: { text: notificationMessage ?? 'Searching...', icon: <Search size={12} />, tone: 'emerald' as const, motion: unifiedActionMotion },
      }[action]
    : null;

  const transferBubble = transferState
    ? transferState === 'importing'
      ? { text: 'Importing...', icon: <Download size={12} />, tone: 'green' as const, motion: unifiedActionMotion }
      : { text: 'Exporting...', icon: <Upload size={12} />, tone: 'blue' as const, motion: unifiedActionMotion }
    : null;

  const timeBubble = timeState
    ? timeState === 'alarm'
      ? { text: "Time's Up!", icon: <AlertCircle size={12} />, tone: 'rose' as const, motion: unifiedActionMotion }
      : { text: 'Task Start!', icon: <Clock size={12} />, tone: 'blue' as const, motion: unifiedActionMotion }
    : null;
  const alertBubble = alert
    ? {
        text: `MISSION CRITICAL · ${alert.title}`,
        icon: <Bell size={12} />,
        tone: 'rose' as const,
        motion: unifiedActionMotion,
      }
    : null;
  const thinkingBubble = isThinking
    ? {
        text: 'Computing...',
        tone: 'violet' as const,
        icon: (
          <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
            <Loader2 size={12} />
          </motion.span>
        ),
        motion: unifiedActionMotion,
        containerClassName: 'text-[11px]',
        containerStyle: {
          backgroundColor: theme === 'dark' ? '#A78BFA' : '#8B5CF6', // 紫色背景
          color: '#FFFFFF', // 白色文字
        },
        borderless: true,
      }
    : null;

  const priorityBubble = alertBubble ?? actionBubble ?? transferBubble ?? timeBubble ?? thinkingBubble;
  const bubbleConfig: BubbleConfig | null = priorityBubble
    ? { kind: 'action' as const, ...priorityBubble }
    : isSleeping
        ? null
        : chatMessage
          ? { 
              kind: 'chat' as const, 
              text: chatMessage, 
              tone: 'amber' as const,
              // 使用统一的中心上升动画
            }
          : null;

  // 智能气泡定位：根据 Lumi 的位置动态调整气泡位置，避免被边框割裂

  return (
    <motion.div
      className="absolute z-5 pointer-events-none"
      style={{ width: CAT_SIZE, height: CAT_SIZE, x, y, scale }}
    >
      <AnimatePresence>
        {bubbleConfig && (
          <div
            className="absolute pointer-events-none top-1/2 left-1/2"  // 所有气泡统一：定位在身体中心
            style={{
              transform: orientation === 'top' 
                ? 'translate(-50%, -50%) rotate(180deg) scaleX(-1)'  // 头朝下：居中 + 翻转
                : 'translate(-50%, -50%)',  // 头朝上：只居中
            }}
          >
            <motion.div
              className="pointer-events-none"
              initial={bubbleConfig.motion?.initial ?? unifiedActionMotion.initial}
              animate={bubbleConfig.motion?.animate ?? unifiedActionMotion.animate}
              exit={bubbleConfig.motion?.exit ?? unifiedActionMotion.exit}
              transition={bubbleConfig.motion?.transition ?? unifiedActionMotion.transition}
            >
              <div className="relative">
                {bubbleConfig.kind === 'chat' ? (
                  <div 
                    className="text-[11px] font-medium text-foreground/80 whitespace-nowrap"
                    style={orientation === 'top' ? { transform: 'rotate(180deg) scaleX(-1)' } : undefined}
                  >
                    {bubbleConfig.text}
                  </div>
                ) : (
                  <div
                    className={`flex items-center gap-1.5 px-2 py-1 text-[11px] rounded-xl shadow backdrop-blur ${bubbleConfig.borderless ? '' : 'border'} ${
                      bubbleConfig.containerClassName ?? bubbleStyles[bubbleConfig.tone].container
                    }`}
                    style={{
                      ...bubbleConfig.containerStyle,
                      ...(orientation === 'top' ? { transform: 'rotate(180deg) scaleX(-1)' } : {}),
                    }}
                  >
                    {bubbleConfig.icon && (
                      <span className="shrink-0">{bubbleConfig.icon}</span>
                    )}
                    <span className="whitespace-nowrap">{bubbleConfig.text}</span>
                  </div>
                )}
              </div>
          </motion.div>
          </div>
        )}
      </AnimatePresence>
      <SpiritCat
        orientation={orientation}
        mode={mode}
        theme={theme}
        isThinking={isThinking}
        pupilX={pupilX}
        pupilY={pupilY}
        isWindy={isWindy}
        isSleeping={isSleeping}
      />
    </motion.div>
  );
}

/**
 * 应用内容组件
 */
interface AppContentProps {
  initialRoot: string;
  onForceMock?: () => void;
}

function AppContent({ initialRoot, onForceMock }: AppContentProps) {
  const { state, loadVault, dispatch, getFilteredPrompts, refreshVault } = useApp();
  const { showToast } = useToast();
  const { triggerTransfer } = useLumi();
  const [dataLoaded, setDataLoaded] = useState(false);
  const [splashComplete, setSplashComplete] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fallbackTriggeredRef = useRef(false);

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
    triggerTransfer('importing');
    showToast('正在导入 Markdown 文件...', 'info');
    try {
      // Import to root category by default
      const rootCategory = state.fileSystem?.root || '';
      const client = isTauriEnv() ? tauriClient : api;
      const result = await importMarkdownFile(file, rootCategory, client);
      
      if (result.success && result.promptId) {
        // Refresh vault to update the UI with the new prompt
        try {
          await refreshVault();
        } catch (refreshError) {
          console.error('Failed to refresh vault after Markdown import:', refreshError);
        }
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
    triggerTransfer('importing');
    showToast('正在导入 JSON 文件...', 'info');

    try {
      const client = isTauriEnv() ? tauriClient : api;
      const result = await importJsonFile(file, client, {
        defaultCategory: '公共',
        conflictStrategy: 'rename',
      });
      
      if (result.success && result.results) {
        // Refresh vault to update the UI with the new prompts
        try {
          await refreshVault();
        } catch (refreshError) {
          console.error('Failed to refresh vault after JSON import:', refreshError);
        }
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
      if (initialRoot === '/api') {
        try {
          await api.trash.visit(10);
        } catch {
        }
      } else if (initialRoot === '/tauri') {
        try {
          await tauriClient.trash.visit(10);
        } catch {
        }
        try {
          await tauriClient.performance.saveSnapshot({ info: 'init' });
        } catch {
        }
        try {
          const resp = await (async () => {
            const r = await import('@tauri-apps/api/core');
            return r.invoke('verify_single_process', {});
          })();
          localStorage.setItem('lumina-single-process', JSON.stringify(resp));
        } catch {
        }
      }
      
      try {
        const timeoutMs = 15000;
        let timeoutId: number | null = null;
        const timeoutPromise = new Promise<void>((_, reject) => {
          timeoutId = window.setTimeout(() => {
            reject(new Error('vault_load_timeout'));
          }, timeoutMs);
        });
        startupTimer.mark('vault_scan_start');
        await Promise.race([loadVault(initialRoot), timeoutPromise]);
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
        startupTimer.mark('vault_scanned');
        setDataLoaded(true);
      } catch (error) {
        console.error('Failed to load vault:', error);
        if (
          initialRoot === '/api' &&
          !fallbackTriggeredRef.current &&
          error instanceof Error &&
          /failed to fetch/i.test(error.message)
        ) {
          fallbackTriggeredRef.current = true;
          if (typeof window !== 'undefined') {
            window.localStorage?.setItem('lumina-force-mock', '1');
          }
          showToast('API 不可用，已切换到 Mock', 'warning');
          onForceMock?.();
        }
        if (error instanceof Error && error.message === 'vault_load_timeout') {
          showToast('初始化超时，已进入降级模式', 'warning');
          setTimeout(() => {
            refreshVault().catch(() => {
            });
          }, 1000);
        }
        setDataLoaded(true);
      }
    })();
  }, [initialRoot, loadVault, refreshVault, showToast, onForceMock]);

  useEffect(() => {
    if (!dataLoaded) return;
    const timeout = window.setTimeout(async () => {
      const snapshot = createPerformanceSnapshot();
      try {
        if (isTauriEnv()) {
          await tauriClient.performance.saveSnapshot(snapshot);
        } else {
          localStorage.setItem('lumina-performance-snapshot', JSON.stringify(snapshot));
        }
      } catch {
      }
    }, 60000);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [dataLoaded]);

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
      ref={containerRef}
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
      <LumiOverlay containerRef={containerRef} />
      
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
  const tauriEnv = isTauriEnv();
  const [forceMock, setForceMock] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage?.getItem('lumina-force-mock') === '1';
  });
  const envUseMock = (import.meta.env.VITE_USE_MOCK ?? 'true') === 'true';
  const useMock = envUseMock || (tauriEnv && forceMock);
  const adapter = useMemo(
    () => (tauriEnv ? new TauriFileSystemAdapter() : useMock ? new MockFileSystemAdapter() : new ApiFileSystemAdapter()),
    [tauriEnv, useMock]
  );
  const initialRoot = tauriEnv ? '/tauri' : useMock ? '/vault' : '/api';

  // Start performance monitoring
  useEffect(() => {
    startupTimer.mark('first_paint');
    const controller = startAdaptivePerformanceMonitoring('normal');
    const unregister = registerMonitoringController(controller);

    return () => {
      unregister();
      controller.stop();
    };
  }, []);

  return (
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <LumiProvider>
            <AppProvider adapter={adapter}>
              <AppContent
                initialRoot={initialRoot}
                onForceMock={() => {
                  setForceMock(true);
                  if (typeof window !== 'undefined') {
                    window.localStorage?.setItem('lumina-force-mock', '1');
                  }
                }}
              />
            </AppProvider>
          </LumiProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
