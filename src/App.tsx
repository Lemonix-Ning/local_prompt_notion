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
import { Sidebar } from './components/Sidebar';
import { PromptList } from './components/PromptList';
import { EditorOverlay } from './components/EditorOverlay';
import { TaskEditorOverlay } from './components/TaskEditorOverlay';
import { SpiritCat, type LumiOrientation } from './components/SpiritCat';
// import { TopBar } from './components/TopBar';
import api from './api/client';
import { startupTimer, startPerformanceMonitoring } from './utils/performanceMonitor';
import { importMarkdownFile } from './utils/markdownImporter';
import { importJsonFile } from './utils/jsonImporter';
import { AlarmClock, Bell, CalendarClock, Check, Copy, Download, FileSignature, FolderPlus, Heart, Pin, RotateCcw, Search, Sparkles, Trash2, Upload } from 'lucide-react';

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

const CAT_SIZE = 100;
const CONTAINER_PADDING = 20;

const calculateSnap = (x: number, y: number, containerWidth: number, containerHeight: number) => {
  const distLeft = x;
  const distRight = containerWidth - x - CAT_SIZE;
  const distBottom = containerHeight - y - CAT_SIZE;

  let snapX = x;
  let snapY = y;
  let orientation: LumiOrientation = 'bottom';

  if (distBottom < 150) {
    orientation = 'bottom';
    snapY = containerHeight - CAT_SIZE - CONTAINER_PADDING;
    snapX = Math.max(CONTAINER_PADDING, Math.min(x, containerWidth - CAT_SIZE - CONTAINER_PADDING));
  } else if (distLeft < distRight) {
    orientation = 'left';
    snapX = CONTAINER_PADDING;
    snapY = Math.max(CONTAINER_PADDING, Math.min(y, containerHeight - CAT_SIZE - CONTAINER_PADDING));
  } else {
    orientation = 'right';
    snapX = containerWidth - CAT_SIZE - CONTAINER_PADDING;
    snapY = Math.max(CONTAINER_PADDING, Math.min(y, containerHeight - CAT_SIZE - CONTAINER_PADDING));
  }

  return { x: snapX, y: snapY, orientation };
};

const pickWanderTarget = (container: HTMLDivElement | null) => {
  if (!container) return null;
  const rect = container.getBoundingClientRect();
  const maxX = rect.width - CAT_SIZE - CONTAINER_PADDING;
  const maxY = rect.height - CAT_SIZE - CONTAINER_PADDING;
  const randomBetween = (min: number, max: number) => min + Math.random() * Math.max(0, max - min);
  const edgeRoll = Math.random();
  const edge: LumiOrientation =
    edgeRoll < 0.4 ? 'bottom' : edgeRoll < 0.6 ? 'left' : edgeRoll < 0.8 ? 'right' : 'top';
  const randX = randomBetween(CONTAINER_PADDING, maxX);
  const randY = randomBetween(CONTAINER_PADDING, maxY);
  const x = Math.max(CONTAINER_PADDING, Math.min(randX, maxX));
  const y = Math.max(CONTAINER_PADDING, Math.min(randY, maxY));

  if (edge === 'bottom') {
    return { x, y: maxY, orientation: 'bottom' as const };
  }
  if (edge === 'left') {
    return { x: CONTAINER_PADDING, y, orientation: 'left' as const };
  }
  if (edge === 'right') {
    return { x: maxX, y, orientation: 'right' as const };
  }
  return { x, y: CONTAINER_PADDING, orientation: 'top' as const };
};

function LumiOverlay({ containerRef }: { containerRef: RefObject<HTMLDivElement> }) {
  const { theme } = useTheme();
  const { toasts } = useToast();
  const {
    action,
    transferState,
    timeState,
    isWindy,
    isSleeping,
    isDragging,
    notificationMessage,
    alert,
    setDragging,
    notifyMessage,
    notifyActivity,
    focusAlert,
    dismissAlert,
  } = useLumi();
  const [orientation, setOrientation] = useState<LumiOrientation>('bottom');
  const [chatMessage, setChatMessage] = useState<string | null>(null);
  const [wakePulse, setWakePulse] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const pupilX = useMotionValue(0);
  const pupilY = useMotionValue(0);
  const activeMovesRef = useRef<ReturnType<typeof animate>[]>([]);
  const hasInitializedRef = useRef(false);
  const wasSleepingRef = useRef(isSleeping);
  const lastToastIdRef = useRef<string | null>(null);
  const isBusy = isDragging || action !== null || transferState !== null || timeState !== null || isThinking || alert !== null;
  const bubbleStyles = {
    neutral: {
      container: 'bg-background/90 text-foreground border-border',
      tail: 'bg-background/90 border-border',
    },
    cyan: {
      container: 'bg-cyan-500/20 text-cyan-100 border-cyan-500/40',
      tail: 'bg-cyan-500/20 border-cyan-500/40',
    },
    orange: {
      container: 'bg-orange-500/20 text-orange-100 border-orange-500/40',
      tail: 'bg-orange-500/20 border-orange-500/40',
    },
    emerald: {
      container: 'bg-emerald-500/20 text-emerald-100 border-emerald-500/40',
      tail: 'bg-emerald-500/20 border-emerald-500/40',
    },
    rose: {
      container: 'bg-rose-500/20 text-rose-100 border-rose-500/40',
      tail: 'bg-rose-500/20 border-rose-500/40',
    },
    teal: {
      container: 'bg-teal-500/20 text-teal-100 border-teal-500/40',
      tail: 'bg-teal-500/20 border-teal-500/40',
    },
    pink: {
      container: 'bg-pink-500/20 text-pink-100 border-pink-500/40',
      tail: 'bg-pink-500/20 border-pink-500/40',
    },
    amber: {
      container: 'bg-amber-500/20 text-amber-100 border-amber-500/40',
      tail: 'bg-amber-500/20 border-amber-500/40',
    },
    violet: {
      container: 'bg-violet-500/20 text-violet-100 border-violet-500/40',
      tail: 'bg-violet-500/20 border-violet-500/40',
    },
    green: {
      container: 'bg-green-500/20 text-green-100 border-green-500/40',
      tail: 'bg-green-500/20 border-green-500/40',
    },
    blue: {
      container: 'bg-sky-500/20 text-sky-100 border-sky-500/40',
      tail: 'bg-sky-500/20 border-sky-500/40',
    },
    indigo: {
      container: 'bg-indigo-500/20 text-indigo-100 border-indigo-500/40',
      tail: 'bg-indigo-500/20 border-indigo-500/40',
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
    borderless?: boolean;
    variant?: 'thinking';
    positionClassName?: string;
  };
  const defaultActionMotion: BubbleMotion = {
    initial: { opacity: 0, y: 20, scale: 0.8 },
    animate: { opacity: 1, y: -40, scale: 1 },
    exit: { opacity: 0, y: -60, scale: 0.8 },
    transition: { duration: 0.6, ease: 'easeOut' },
  };
  const importMotion: BubbleMotion = {
    initial: { opacity: 0, y: -10, scale: 0.8 },
    animate: { opacity: 1, y: 10, scale: 1 },
    exit: { opacity: 0, y: 25, scale: 0.8 },
    transition: { duration: 0.6, ease: 'easeOut' },
  };
  const exportMotion: BubbleMotion = {
    initial: { opacity: 0, y: 20, scale: 0.8 },
    animate: { opacity: 1, y: -20, scale: 1 },
    exit: { opacity: 0, y: -40, scale: 0.8 },
    transition: { duration: 0.6, ease: 'easeOut' },
  };
  const pinMotion: BubbleMotion = {
    initial: { opacity: 0, y: 10, scale: 0.8 },
    animate: { opacity: 1, y: -25, scale: 1 },
    exit: { opacity: 0, y: -45, scale: 0.8 },
    transition: { duration: 0.6, ease: 'easeOut' },
  };
  const favoriteMotion: BubbleMotion = {
    initial: { opacity: 0, y: 10, scale: 0.8 },
    animate: { opacity: 1, y: -20, scale: 1 },
    exit: { opacity: 0, y: -35, scale: 0.8 },
    transition: { duration: 0.6, ease: 'easeOut' },
  };
  const thinkingMotion: BubbleMotion = {
    initial: { opacity: 0, y: 10, scale: 0.8 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, scale: 0.8 },
    transition: { duration: 0.3, ease: 'easeOut' },
  };
  const countdownMotion: BubbleMotion = {
    initial: { opacity: 0, y: 20, scale: 0.8 },
    animate: { opacity: 1, y: -40, scale: 1, x: [-2, 2, -2, 2, 0] },
    exit: { opacity: 0, y: -60, scale: 0.8 },
    transition: { duration: 0.6, ease: 'easeOut', x: { duration: 0.1, repeat: Infinity } },
  };
  const chatMotion: BubbleMotion = {
    initial: { scale: 0.5, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { opacity: 0 },
    transition: { type: 'spring', stiffness: 260, damping: 18 },
  };

  const stopActiveMoves = useCallback(() => {
    activeMovesRef.current.forEach(control => control.stop());
    activeMovesRef.current = [];
  }, []);

  useEffect(() => {
    const syncPosition = () => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (!hasInitializedRef.current) {
        const centeredX = (rect.width - CAT_SIZE) / 2;
        const initialX = Math.max(CONTAINER_PADDING, Math.min(centeredX, rect.width - CAT_SIZE - CONTAINER_PADDING));
        const initialY = rect.height - CAT_SIZE - CONTAINER_PADDING;
        x.set(initialX);
        y.set(initialY);
        setOrientation('bottom');
        hasInitializedRef.current = true;
        return;
      }
      const snap = calculateSnap(x.get(), y.get(), rect.width, rect.height);
      x.set(snap.x);
      y.set(snap.y);
      setOrientation(snap.orientation);
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
    const handleActivity = () => {
      notifyActivity();
    };
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
    };
  }, [notifyActivity]);

  useEffect(() => {
    if (isBusy || isSleeping) {
      stopActiveMoves();
    }
  }, [isBusy, isSleeping, stopActiveMoves]);

  useEffect(() => {
    if (isBusy || isSleeping) {
      setChatMessage(null);
    }
  }, [isBusy, isSleeping]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const latest = toasts[toasts.length - 1];
    if (latest.id === lastToastIdRef.current) return;
    lastToastIdRef.current = latest.id;
    notifyMessage(latest.message, latest.duration ?? 3000);
  }, [notifyMessage, toasts]);

  useEffect(() => {
    let timeoutId: number | null = null;
    const phrases = ['Lumi Lumi~', 'System stable.', 'Pixel perfect.', 'Meow?', 'stares'];

    const talk = () => {
      if (isBusy || isSleeping) {
        timeoutId = window.setTimeout(talk, 5000);
        return;
      }
      const text = phrases[Math.floor(Math.random() * phrases.length)];
      setChatMessage(text);
      window.setTimeout(() => setChatMessage(null), 3000);
      timeoutId = window.setTimeout(talk, 10000 + Math.random() * 10000);
    };

    timeoutId = window.setTimeout(talk, 2000);
    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isBusy, isSleeping]);

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
      if (isBusy || isSleeping) {
        timeoutId = window.setTimeout(wander, 5000);
        return;
      }
      const target = pickWanderTarget(containerRef.current);
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
  }, [containerRef, isBusy, isSleeping, stopActiveMoves, x, y]);

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

  const handleDragStart = () => {
    setDragging(true);
    setChatMessage(null);
    setIsThinking(false);
    stopActiveMoves();
  };

  const handleDragEnd = () => {
    setDragging(false);
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const snap = calculateSnap(x.get(), y.get(), rect.width, rect.height);
    setOrientation(snap.orientation);
    stopActiveMoves();
    const moveX = animate(x, snap.x, { type: 'spring', stiffness: 300, damping: 25 });
    const moveY = animate(y, snap.y, { type: 'spring', stiffness: 300, damping: 25 });
    activeMovesRef.current = [moveX, moveY];
  };

  const handleClick = () => {
    if (alert) {
      focusAlert();
      return;
    }
    setIsThinking(prev => !prev);
    notifyActivity();
    animate(scale, [1, 0.9, 1.1, 1], { duration: 0.3 });
  };
  const handleContextMenu = (event: React.MouseEvent) => {
    if (!alert) return;
    event.preventDefault();
    dismissAlert();
  };

  const mode: ComponentProps<typeof SpiritCat>['mode'] =
    isDragging
      ? 'dragging'
      : isSleeping
        ? 'sleep'
        : action ?? transferState ?? timeState ?? (isWindy ? 'windy' : notificationMessage || chatMessage || wakePulse ? 'chat' : 'idle');

  const actionBubble = action
    ? {
        create_card: {
          text: 'New Card!',
          icon: (
            <motion.span animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}>
              <Sparkles size={14} />
            </motion.span>
          ),
          tone: 'cyan' as const,
          motion: defaultActionMotion,
        },
        create_folder: { text: 'New Folder!', icon: <FolderPlus size={14} />, tone: 'orange' as const, motion: defaultActionMotion },
        update: { text: 'Saved!', icon: <Check size={12} />, tone: 'emerald' as const, motion: defaultActionMotion },
        delete: { text: 'Deleted!', icon: <Trash2 size={12} />, tone: 'rose' as const, motion: defaultActionMotion },
        restore: { text: 'Restored!', icon: <RotateCcw size={12} />, tone: 'teal' as const, motion: defaultActionMotion },
        favorite: { text: 'Loved!', icon: <Heart size={12} />, tone: 'pink' as const, motion: favoriteMotion },
        pin: { text: 'Pinned!', icon: <Pin size={12} />, tone: 'amber' as const, motion: pinMotion },
        rename: { text: 'Renamed!', icon: <FileSignature size={12} />, tone: 'violet' as const, motion: defaultActionMotion },
        clipboard: { text: 'Copied!', icon: <Copy size={12} />, tone: 'green' as const, motion: defaultActionMotion },
        search: { text: 'Searching...', icon: <Search size={12} />, tone: 'emerald' as const, motion: defaultActionMotion },
      }[action]
    : null;

  const transferBubble = transferState
    ? transferState === 'importing'
      ? { text: 'Importing...', icon: <Download size={12} />, tone: 'green' as const, motion: importMotion }
      : { text: 'Exporting...', icon: <Upload size={12} />, tone: 'blue' as const, motion: exportMotion }
    : null;

  const timeBubble = timeState
    ? timeState === 'countdown'
      ? { text: "Time's Up!", icon: <AlarmClock size={12} />, tone: 'orange' as const, motion: countdownMotion }
      : { text: 'Task Start!', icon: <CalendarClock size={12} />, tone: 'blue' as const, motion: defaultActionMotion }
    : null;
  const alertBubble = alert
    ? {
        text: `MISSION CRITICAL · ${alert.title}`,
        icon: <Bell size={12} />,
        tone: 'rose' as const,
        motion: defaultActionMotion,
      }
    : null;
  const thinkingBubble = isThinking
    ? {
        text: 'Thinking...',
        tone: 'indigo' as const,
        motion: thinkingMotion,
        containerClassName: theme === 'dark' ? 'bg-indigo-500 text-white' : 'bg-indigo-600 text-white',
        tailClassName: theme === 'dark' ? 'bg-indigo-500' : 'bg-indigo-600',
        borderless: true,
        variant: 'thinking' as const,
        positionClassName: '-top-12 left-1/2 -translate-x-1/2',
      }
    : null;

  const priorityBubble = alertBubble ?? actionBubble ?? transferBubble ?? timeBubble ?? thinkingBubble;
  const bubbleConfig: BubbleConfig | null = priorityBubble
    ? { kind: 'action' as const, ...priorityBubble }
    : notificationMessage
      ? { kind: 'chat' as const, text: notificationMessage, tone: 'neutral' as const }
      : isSleeping
        ? { kind: 'chat' as const, text: 'Zzz', tone: 'neutral' as const }
        : chatMessage
          ? { kind: 'chat' as const, text: chatMessage, tone: 'neutral' as const }
          : null;

  return (
    <motion.div
      className="absolute z-40"
      style={{ width: CAT_SIZE, height: CAT_SIZE, x, y, scale }}
      drag
      dragMomentum={false}
      dragElastic={0.1}
      dragConstraints={containerRef}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <AnimatePresence>
        {bubbleConfig && (
          <motion.div
            className={`absolute pointer-events-none ${
              bubbleConfig.kind === 'action'
                ? bubbleConfig.positionClassName ?? '-top-14 left-1/2 -translate-x-1/2'
                : '-top-6 -right-4'
            }`}
            initial={bubbleConfig.kind === 'action' ? bubbleConfig.motion?.initial : chatMotion.initial}
            animate={bubbleConfig.kind === 'action' ? bubbleConfig.motion?.animate : chatMotion.animate}
            exit={bubbleConfig.kind === 'action' ? bubbleConfig.motion?.exit : chatMotion.exit}
            transition={bubbleConfig.kind === 'action' ? bubbleConfig.motion?.transition : chatMotion.transition}
          >
            {bubbleConfig.kind === 'action' && bubbleConfig.variant === 'thinking' ? (
              <div className="relative">
                <div
                  className={`text-white text-xs px-3 py-1.5 rounded-full whitespace-nowrap shadow-lg ${
                    bubbleConfig.containerClassName ?? bubbleStyles[bubbleConfig.tone].container
                  }`}
                >
                  {bubbleConfig.text}
                </div>
                <div
                  className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 w-2 h-2 rotate-45 ${
                    bubbleConfig.tailClassName ?? bubbleStyles[bubbleConfig.tone].tail
                  }`}
                />
              </div>
            ) : (
              <div className="relative">
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-xl shadow-lg backdrop-blur ${bubbleConfig.borderless ? '' : 'border'} ${
                    bubbleConfig.containerClassName ?? bubbleStyles[bubbleConfig.tone].container
                  }`}
                >
                  {bubbleConfig.kind === 'action' && bubbleConfig.icon && (
                    <span className="shrink-0">{bubbleConfig.icon}</span>
                  )}
                  <span className="whitespace-nowrap">{bubbleConfig.text}</span>
                </div>
                <div
                  className={`absolute h-2.5 w-2.5 rotate-45 ${bubbleConfig.borderless ? '' : 'border'} ${
                    bubbleConfig.kind === 'action' ? 'left-1/2 -translate-x-1/2 -bottom-1' : '-bottom-1 left-3'
                  } ${bubbleConfig.tailClassName ?? bubbleStyles[bubbleConfig.tone].tail}`}
                />
              </div>
            )}
          </motion.div>
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
}

function AppContent({ initialRoot }: AppContentProps) {
  const { state, loadVault, dispatch, getFilteredPrompts, refreshVault } = useApp();
  const { showToast } = useToast();
  const { triggerTransfer } = useLumi();
  const [dataLoaded, setDataLoaded] = useState(false);
  const [splashComplete, setSplashComplete] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
    triggerTransfer('importing');
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
          <LumiProvider>
            <AppProvider adapter={adapter}>
              <AppContent initialRoot={initialRoot} />
            </AppProvider>
          </LumiProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
