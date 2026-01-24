/**
 * PromptList 组件
 * Notion 风格的卡片网格布局
 */

// 🚨 TEMP: disable legacy interval scanner (V2 migration)
const ENABLE_LEGACY_INTERVAL = false;

import {
  Plus,
  Copy,
  Star,
  Trash2,
  X,
  Folder,
  FolderOpen,
  RotateCcw,
  Search,
  Minus,
  Square,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  Clock,
  Upload,
  Pin,
  PinOff,
} from 'lucide-react';
import { useApp } from '../AppContext';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useDocumentVisibility } from '../hooks/useDocumentVisibility';
import { createPortal } from 'react-dom';
// EditorPage 现在通过 EditorOverlay 系统使用，不再直接导入
import api from '../api/client';
import { getSmartIcon } from '../utils/smartIcon';
import { getIconGradientConfig, getTagStyle } from '../utils/tagColors';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useLumi } from '../contexts/LumiContext';
import { Button } from './Button';
import { NewPromptOverlay } from './NewPromptOverlay';
import { ElasticScroll } from './ElasticScroll';
import { EmptyState } from './EmptyState';
import { DisintegrateOverlay } from './DisintegrateOverlay';
import { ChronoCard } from './ChronoCard';
import { RecurrenceSelector } from './RecurrenceSelector';
import { ImportPromptsDialog } from './ImportPromptsDialog';
import { ExportPromptsDialog } from './ExportPromptsDialog';
import { useSystemNotification } from '../hooks/useSystemNotification';
import { useIntervalTasks } from '../hooks/useIntervalTasks';
import { generateRecurrenceTag, generateScheduledTimeTag, getNextTriggerTime } from '../utils/recurrenceTag';
import type { PromptData, RecurrenceConfig } from '../types';
import { useVirtualScroll } from '../utils/virtualScroll';

function SpotlightCard({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);
  const [tiltStyle, setTiltStyle] = useState({
    transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
    '--sheen-bg': 'none',
  } as React.CSSProperties & { '--sheen-bg': string });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setPosition({ x, y });

    // 🔥 3D Tilt 计算
    // 归一化坐标 (-1 ~ 1)
    const normalizedX = (x - rect.width / 2) / (rect.width / 2);
    const normalizedY = (y - rect.height / 2) / (rect.height / 2);

    // 计算旋转角度 (强度系数 8deg)
    const rotateX = -normalizedY * 8;
    const rotateY = normalizedX * 8;

    // 计算高光位置 (百分比)
    const sheenX = 50 + normalizedX * 35;
    const sheenY = 50 + normalizedY * 35;

    setTiltStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.01, 1.01, 1.01)`,
      '--sheen-bg': `radial-gradient(circle at ${sheenX}% ${sheenY}%, rgba(255,255,255,0.15) 0%, transparent 50%)`,
    });
  };

  const handleMouseLeave = () => {
    setOpacity(0);
    setTiltStyle({
      transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
      '--sheen-bg': 'none',
    });
  };

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={handleMouseLeave}
      className={`relative rounded-xl border border-border bg-card/50 overflow-hidden group transition-colors tilt-card ${className || ''}`}
      style={tiltStyle}
    >
      {/* 3D 高光层 */}
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 group-hover:opacity-100 sheen-layer"
        style={{
          background: tiltStyle['--sheen-bg'] as string,
        }}
      />
      
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(255,255,255,0.06), transparent 40%)`,
        }}
      />
      {/* 浅色模式光效 */}
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 group-hover:opacity-100 dark:hidden"
        style={{
          opacity: opacity * 0.3,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(0,0,0,0.04), transparent 40%)`,
        }}
      />
      <div className="relative h-full flex flex-col content-layer">{children}</div>
    </div>
  );
}

// 保留旧函数作为备用，现在直接使用新的哈希颜色系统
const getTagColor = (tag: string) => {
  return getTagStyle(tag);
};

export function PromptList() {
  const { state, dispatch, getFilteredPrompts, createPrompt, savePrompt, deletePrompt, restorePrompt, createCategory, adapter, refreshVault } = useApp();
  const { searchQuery, selectedCategory, uiState } = state;
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { notifyMessage, triggerAction, triggerTime, reportScrollSpeed, notifyAlert, clearAlert } = useLumi();
  const newPromptDraftKey = 'newPromptDraft';
  const [isSwitchingList, setIsSwitchingList] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState('');
  const categoryPopoverRef = useRef<HTMLDivElement | null>(null);
  const [dropdownCreatingParentPath, setDropdownCreatingParentPath] = useState<string | null>(null);
  const [dropdownNewCategoryName, setDropdownNewCategoryName] = useState('');
  const dropdownNewCategoryInputRef = useRef<HTMLInputElement | null>(null);
  const [newPrompt, setNewPrompt] = useState({ 
    title: '', 
    content: '', 
    category: '', 
    tags: '',
    type: 'NOTE' as 'NOTE' | 'TASK',
    scheduledTime: '',
    recurrence: undefined as RecurrenceConfig | undefined,
  });
  // 现在使用 EditorOverlay 系统，不再需要本地编辑状态
  // const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [trashCounts, setTrashCounts] = useState<Record<string, number>>({});
  const trashThreshold = 10;

  // 窗口控制状态
  const [isMaximized, setIsMaximized] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const [burstingId, setBurstingId] = useState<string | null>(null);
  const [burstAnchor, setBurstAnchor] = useState<{ id: string; x: number; y: number } | null>(null);
  const burstTimerRef = useRef<number | null>(null);

  // ========== Keyboard Navigation (键盘导航) ==========
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [columnCount, setColumnCount] = useState<number>(3);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [isKeyboardNavigation, setIsKeyboardNavigation] = useState<boolean>(false); // 🔥 新增：标记是否为键盘导航
  
  // ========== Focus Mode (专注模式) ==========
  const [focusModeActive, setFocusModeActive] = useState<boolean>(false);
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  
  // ========== Chrono Alert (时空警报) - V2 极简版 ==========
  const [alertTask, setAlertTask] = useState<PromptData | null>(null);
  const lastAlertIdRef = useRef<string | null>(null);
  // @ts-ignore - Used in handleAlertDismiss for one-time tasks
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const recurringNotifiedRef = useRef<Map<string, string>>(new Map());
  
  // 🔥 防止重复系统通知：记录已发送通知的任务 ID
  const sentSystemNotificationsRef = useRef<Set<string>>(new Set());
  const lastBubbleAlertRef = useRef<string | null>(null);
  
  // 🔥 存储 handleAlertDismiss 的最新引用，用于自动关闭定时器
  const handleAlertDismissRef = useRef<(() => Promise<void>) | null>(null);
  
  // 🔥 V2: 使用后端调度器，前端只负责轮询和显示
  const isTauriEnv = typeof window !== 'undefined' && (
    (window as any).__TAURI_INTERNALS__ ||
    (window as any).__TAURI__ ||
    window.location.protocol === 'tauri:' ||
    (window.location.protocol === 'https:' && window.location.hostname === 'tauri.localhost')
  );
  const apiBaseUrl = isTauriEnv
    ? 'http://localhost:3002'  // Tauri 桌面端
    : 'http://localhost:3001'; // Web 端
  
  const { pendingTasks, acknowledgeTask, refresh: refreshPendingTasks } = useIntervalTasks(apiBaseUrl, true);

  useEffect(() => {
    if (!alertTask) {
      lastAlertIdRef.current = null;
      return;
    }
    if (alertTask.meta.id === lastAlertIdRef.current) return;
    lastAlertIdRef.current = alertTask.meta.id;
  }, [alertTask]);
  
  // ========== System Notification (系统通知) ==========
  const {
    sendTaskReminder,
    resetTaskThrottle,
    // @ts-ignore - Reserved for future use
    isSupported: notificationSupported,
  } = useSystemNotification();
  
  // ========== Import Dialog (导入对话框) ==========
  const [showImportDialog, setShowImportDialog] = useState<boolean>(false);
  const [importDialogMounted, setImportDialogMounted] = useState<boolean>(false);
  
  // ========== Export Dialog (导出对话框) ==========
  const [showExportDialog, setShowExportDialog] = useState<boolean>(false);
  const [exportConfig, setExportConfig] = useState<{ 
    preSelectedIds?: string[]; 
    categoryPath?: string;
    preserveStructure?: boolean;
  }>({});
  
  // 编辑器扩展功能（预留）
  // const [isEditorExpanded, setIsEditorExpanded] = useState(false);
  // const [editorClickCount, setEditorClickCount] = useState(0);
  // const editorClickTimerRef = useRef<number | null>(null);

  // ========== 辅助函数：生成带重复标识的标题 ==========
  const getTaskTitleWithRepeatIndicator = (prompt: PromptData): string => {
    const total = titleRepeatCountsRef.current.get(prompt.meta.title) || 0;
    if (total <= 1) return prompt.meta.title;
    const index = titleRepeatIndexRef.current.get(prompt.meta.id) || 1;
    return `${prompt.meta.title} X${index}`;
  };

  const getRecurringCycleStart = (recurrence: RecurrenceConfig) => {
    const now = new Date();
    const [hours, minutes] = recurrence.time.split(':').map(Number);
    const todayTrigger = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);

    if (recurrence.type === 'daily') {
      if (now < todayTrigger) {
        const yesterday = new Date(todayTrigger);
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString();
      }
      return todayTrigger.toISOString();
    }

    if (recurrence.type === 'weekly') {
      const weekDays = (recurrence.weekDays && recurrence.weekDays.length > 0)
        ? recurrence.weekDays
        : [0, 1, 2, 3, 4, 5, 6];
      const sortedWeekDays = [...weekDays].sort((a, b) => a - b);
      const todayDay = now.getDay();

      if (sortedWeekDays.includes(todayDay) && now >= todayTrigger) {
        return todayTrigger.toISOString();
      }

      for (let i = 1; i <= 7; i++) {
        const checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, hours, minutes, 0, 0);
        if (sortedWeekDays.includes(checkDate.getDay())) {
          return checkDate.toISOString();
        }
      }

      return todayTrigger.toISOString();
    }

    if (recurrence.type === 'monthly') {
      const monthDays = (recurrence.monthDays && recurrence.monthDays.length > 0)
        ? recurrence.monthDays
        : Array.from({ length: 31 }, (_, i) => i + 1);
      const sortedMonthDays = [...monthDays].sort((a, b) => a - b);
      const todayDate = now.getDate();

      if (sortedMonthDays.includes(todayDate) && now >= todayTrigger) {
        return todayTrigger.toISOString();
      }

      for (let i = sortedMonthDays.length - 1; i >= 0; i--) {
        const day = sortedMonthDays[i];
        if (day < todayDate) {
          const checkDate = new Date(now.getFullYear(), now.getMonth(), day, hours, minutes, 0, 0);
          if (checkDate.getDate() === day) {
            return checkDate.toISOString();
          }
        }
      }

      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, hours, minutes, 0, 0);
      const prevMonthYear = prevMonth.getFullYear();
      const prevMonthIndex = prevMonth.getMonth();

      for (let i = sortedMonthDays.length - 1; i >= 0; i--) {
        const day = sortedMonthDays[i];
        const checkDate = new Date(prevMonthYear, prevMonthIndex, day, hours, minutes, 0, 0);
        if (checkDate.getDate() === day) {
          return checkDate.toISOString();
        }
      }

      return todayTrigger.toISOString();
    }

    return todayTrigger.toISOString();
  };

  const fireworkParticles = useMemo(() => {
    return Array.from({ length: 8 }).map((_, i) => {
      const angle = (i * 45) * (Math.PI / 180);
      const distance = 24;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;
      return {
        tx: `${tx}px`,
        ty: `${ty}px`,
        color: i % 2 === 0 ? '#facc15' : '#fb923c',
      };
    });
  }, []);

  // ========== 获取过滤后的提示词列表 (必须在 useEffect 之前) ==========
  const allPrompts = getFilteredPrompts();
  const titleRepeatCountsRef = useRef<Map<string, number>>(new Map());
  const titleRepeatIndexRef = useRef<Map<string, number>>(new Map());

  useMemo(() => {
    const counts = new Map<string, number>();
    const indices = new Map<string, number>();

    allPrompts.forEach(prompt => {
      const title = prompt.meta.title;
      const next = (counts.get(title) || 0) + 1;
      counts.set(title, next);
      indices.set(prompt.meta.id, next);
    });

    titleRepeatCountsRef.current = counts;
    titleRepeatIndexRef.current = indices;
    return null;
  }, [allPrompts]);
  
  // 🔥 调试：检查数据是否加载
  useEffect(() => {
    console.log('[PromptList Debug]', {
      hasFileSystem: !!state.fileSystem,
      allPromptsCount: state.fileSystem?.allPrompts.size || 0,
      filteredPromptsCount: allPrompts.length,
      selectedCategory: state.selectedCategory,
      searchQuery: state.searchQuery,
    });
  }, [state.fileSystem, allPrompts.length, state.selectedCategory, state.searchQuery]);
  
  const isModalOpen = uiState.newPromptModal.isOpen;
  const preselectedCategory = uiState.newPromptModal.preselectedCategory;
  
  // ========== Virtual Scrolling Configuration ==========
  const VIRTUAL_SCROLL_THRESHOLD = 50;
  const CARD_HEIGHT = 272; // 64 (h-64) * 4 (1rem = 4px) + gap
  const [containerHeight, setContainerHeight] = useState(800);
  const elasticScrollRef = useRef<HTMLDivElement>(null);
  const lastScrollRef = useRef<{ y: number; t: number }>({ y: 0, t: Date.now() });
  
  // Enable virtual scrolling only when there are >50 cards
  const enableVirtualScroll = allPrompts.length > VIRTUAL_SCROLL_THRESHOLD;
  
  // Use virtual scroll hook
  const { visibleItems, totalHeight, offsetY, onScroll } = useVirtualScroll(
    allPrompts,
    {
      itemHeight: CARD_HEIGHT,
      overscan: 3,
      containerHeight,
    },
    enableVirtualScroll
  );
  
  // Use visible items when virtual scrolling is enabled, otherwise use all prompts
  const prompts = enableVirtualScroll ? visibleItems : allPrompts;
  
  // Attach scroll listener to ElasticScroll's inner div
  useEffect(() => {
    if (!elasticScrollRef.current) return;
    
    // Find the scrollable div inside ElasticScroll
    const scrollableDiv = elasticScrollRef.current.querySelector('div[style*="overflowY"]') as HTMLDivElement;
    if (!scrollableDiv) return;
    
    const handleScroll = (e: Event) => {
      const target = e.currentTarget as HTMLDivElement;
      const now = Date.now();
      const deltaY = Math.abs(target.scrollTop - lastScrollRef.current.y);
      const deltaT = now - lastScrollRef.current.t;
      const speed = deltaT > 0 ? deltaY / deltaT : 0;
      lastScrollRef.current = { y: target.scrollTop, t: now };
      reportScrollSpeed(speed);
      const syntheticEvent = {
        currentTarget: e.currentTarget,
      } as React.UIEvent<HTMLDivElement>;
      if (enableVirtualScroll) {
        onScroll(syntheticEvent);
      }
    };
    
    scrollableDiv.addEventListener('scroll', handleScroll);
    
    // Update container height
    const updateHeight = () => {
      setContainerHeight(scrollableDiv.clientHeight);
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    
    return () => {
      scrollableDiv.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateHeight);
    };
  }, [enableVirtualScroll, onScroll, reportScrollSpeed]);

  const { isHidden } = useDocumentVisibility();

  // ========== 扫描过期任务 (Scan Expired Tasks) ==========
  // 🔥 使用 ref 存储最新的状态，避免 setInterval 闭包问题
  const allPromptsRef = useRef<Map<string, PromptData>>(new Map());
  const dismissedAlertsRef = useRef<Set<string>>(new Set());
  const notifiedTasksRef = useRef<Set<string>>(new Set());
  const alertTaskRef = useRef<PromptData | null>(null);
  const autoTrashedOneTimeRef = useRef<Set<string>>(new Set());
  const sessionStartedAtRef = useRef<number>(Date.now());
  const firstScanRef = useRef<boolean>(true);
  
  // 🔒 内存锁：存储正在被操作的任务 ID，避免扫描器在保存期间重复触发
  const processingTaskIds = useRef<Set<string>>(new Set());
  
  // 🛡️ 坏任务黑名单：记录本次会话中保存失败的任务，防止死循环
  const brokenTasksRef = useRef<Set<string>>(new Set());
  
  // 🔥 检查过期任务的核心函数（提取出来避免闭包问题）
  // @ts-ignore - V1 legacy scanner, disabled in favor of V2 backend scheduler
  const checkExpiredTasksCore = async () => {
    // 🚨 V2: 旧扫描器已禁用，使用后端调度器
    if (!ENABLE_LEGACY_INTERVAL) {
      return;
    }
    
    // 🚨 紧急停止开关：如果设置了这个标志，立即停止所有扫描和通知
    if (typeof window !== 'undefined' && window.localStorage?.getItem('lumina_stop_scanner') === '1') {
      return;
    }
    
    const now = Date.now();
    const sessionStartMs = sessionStartedAtRef.current;
    const isFirstScan = firstScanRef.current;
    
    // 使用 ref 获取最新的 allPrompts
    const allPrompts = Array.from(allPromptsRef.current.values());
    const currentDismissedAlerts = dismissedAlertsRef.current;
    const currentNotifiedTasks = notifiedTasksRef.current;
    const currentAlertTask = alertTaskRef.current;
    
    const debugDue =
      typeof window !== 'undefined' && window.localStorage?.getItem('lumina_debug_due') === '1';
    
    // 🔥 过期超过 1 小时的任务不再触发通知（避免每次启动都重复提醒）
    const ONE_HOUR = 60 * 60 * 1000;

    // 🔥 重复任务：错过窗口（用于避免重启后立刻补弹）
    const RECURRENCE_GRACE_MS = 2 * 60 * 1000;
    
    // 🔥 启动抑制：启动后5秒内不发送通知和弹窗
    const STARTUP_SUPPRESS_DURATION_MS = 5000;
    const isInStartupPeriod = (now - sessionStartMs) < STARTUP_SUPPRESS_DURATION_MS;
    const missedRecurringUpdates: PromptData[] = [];

    // 🔥 方案A：窗口隐藏且系统通知不支持时，仅扫描 interval（每 N 分钟）任务
    // @ts-ignore - V1 legacy code, disabled
    const intervalOnlyMode = isHidden && !notificationSupported;
    
    // 查找所有过期的任务（一次性任务）- 排除回收站中的任务
    const expiredTasks = intervalOnlyMode ? [] : allPrompts.filter(prompt => {
      // 🔒 关键检查：如果这个任务正在被"处理"（比如正在关闭中），直接跳过！
      if (processingTaskIds.current.has(prompt.meta.id)) return false;
      
      if (prompt.meta.type !== 'TASK') return false;
      if (!prompt.meta.scheduled_time) return false;
      if (currentDismissedAlerts.has(prompt.meta.id)) return false;
      // 排除回收站中的任务
      if (prompt.path?.includes('/trash/') || prompt.path?.includes('\\trash\\')) return false;
      
      const scheduledTime = new Date(prompt.meta.scheduled_time).getTime();
      // 🔥 只触发刚过期的任务（1小时内），超过1小时的不再提醒
      const isExpired = scheduledTime <= now;
      const isRecentlyExpired = (now - scheduledTime) <= ONE_HOUR;
      return isExpired && isRecentlyExpired;
    });

    // 🔥 用于清理/抑制：忽略 dismissed 的到点集合（避免点 X 后被错误清除抑制而反复弹）
    const expiredTasksIgnoringDismissed = intervalOnlyMode ? [] : allPrompts.filter(prompt => {
      if (prompt.meta.type !== 'TASK') return false;
      if (!prompt.meta.scheduled_time) return false;
      // 排除回收站中的任务
      if (prompt.path?.includes('/trash/') || prompt.path?.includes('\\trash\\')) return false;

      const scheduledTime = new Date(prompt.meta.scheduled_time).getTime();
      const isExpired = scheduledTime <= now;
      const isRecentlyExpired = (now - scheduledTime) <= ONE_HOUR;
      return isExpired && isRecentlyExpired;
    });
    
    // 检查重复任务 - 排除回收站中的任务
    const recurringTasks = allPrompts.filter(prompt => {
      // 🛡️ 关键检查：如果这个任务已知是坏的（保存失败过），直接跳过！
      if (brokenTasksRef.current.has(prompt.meta.id)) {
        return false;
      }
      
      // 🔒 关键检查：如果这个任务正在被"处理"（比如正在关闭中），直接跳过！
      if (processingTaskIds.current.has(prompt.meta.id)) return false;
      
      if (prompt.meta.type !== 'TASK') return false;
      if (!prompt.meta.recurrence?.enabled) return false;
      
      // 🔥 自我纠错机制：检查是否进入新周期
      // 如果是新周期，强制清除旧的拦截标记
      if (prompt.meta.recurrence?.type === 'interval') {
        const intervalMinutes = prompt.meta.recurrence.intervalMinutes;
        if (intervalMinutes && intervalMinutes > 0) {
          const baselineStr = prompt.meta.last_notified ?? prompt.meta.created_at;
          if (baselineStr) {
            const baseMs = new Date(baselineStr).getTime();
            const intervalMs = intervalMinutes * 60 * 1000;
            const nowMs = Date.now();
            
            // 判断是否进入新周期
            const isNewCycle = nowMs >= (baseMs + intervalMs);
            
            if (isNewCycle && currentDismissedAlerts.has(prompt.meta.id)) {
              // 强制清除旧的拦截标记
              dismissedAlertsRef.current.delete(prompt.meta.id);
              setDismissedAlerts(prev => {
                const next = new Set(prev);
                next.delete(prompt.meta.id);
                return next;
              });
            }
            
            if (isNewCycle && currentNotifiedTasks.has(prompt.meta.id)) {
              notifiedTasksRef.current.delete(prompt.meta.id);
            }
          }
        }
      }
      
      const isDismissed = currentDismissedAlerts.has(prompt.meta.id);
      
      if (isDismissed) return false;
      // 排除回收站中的任务
      if (prompt.path?.includes('/trash/') || prompt.path?.includes('\\trash\\')) return false;
      
      // 内联检查重复任务触发条件
      const recurrence = prompt.meta.recurrence;
      if (!recurrence.enabled) return false;

      if (intervalOnlyMode && recurrence.type !== 'interval') return false;
      
      const nowDate = new Date();
      if (recurrence.type === 'interval') {
        const intervalMinutes = recurrence.intervalMinutes;
        if (!intervalMinutes || intervalMinutes <= 0) return false;

        const baselineStr = prompt.meta.last_notified ?? prompt.meta.created_at;
        if (!baselineStr) return false;

        const baseMs = new Date(baselineStr).getTime();
        if (!Number.isFinite(baseMs)) return false;

        const intervalMs = intervalMinutes * 60 * 1000;
        const nowMs = nowDate.getTime();
        const diff = nowMs - baseMs;
        if (diff < intervalMs) return false;

        // 🔥 修复：对于 interval 任务，计算当前周期的触发时间
        // 而不是第一次触发时间，避免刷新后被启动抑制误杀
        const cyclesPassed = Math.floor(diff / intervalMs);
        const currentCycleTriggerMs = baseMs + cyclesPassed * intervalMs;

        // 启动抑制：如果当前周期的触发时间在启动前，则跳过补弹
        if (currentCycleTriggerMs < sessionStartMs) {
          // 首次扫描时更新 last_notified
          if (isFirstScan) {
            const updated = {
              ...prompt,
              meta: {
                ...prompt.meta,
                last_notified: new Date(sessionStartMs).toISOString(),
              },
            };
            const nextMap = new Map(allPromptsRef.current);
            nextMap.set(prompt.meta.id, updated);
            allPromptsRef.current = nextMap;
            missedRecurringUpdates.push(updated);
          }
          return false;
        }

        return true;
      }

      const [hours, minutes] = recurrence.time.split(':').map(Number);
      const todayTriggerTime = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), hours, minutes, 0);
      
      if (nowDate < todayTriggerTime) return false;

      const lateMs = nowDate.getTime() - todayTriggerTime.getTime();
      if (lateMs > RECURRENCE_GRACE_MS) {
        const updated = {
          ...prompt,
          meta: {
            ...prompt.meta,
            last_notified: todayTriggerTime.toISOString(),
          },
        };
        const nextMap = new Map(allPromptsRef.current);
        nextMap.set(prompt.meta.id, updated);
        allPromptsRef.current = nextMap;
        missedRecurringUpdates.push(updated);
        return false;
      }
      
      if (prompt.meta.last_notified) {
        const lastNotifiedDate = new Date(prompt.meta.last_notified);
        if (lastNotifiedDate.toDateString() === nowDate.toDateString()) {
          return false;
        }
      }
      
      if (prompt.meta.created_at) {
        const createdDate = new Date(prompt.meta.created_at);
        if (createdDate.toDateString() === nowDate.toDateString() && createdDate > todayTriggerTime) {
          return false;
        }
      }
      
      switch (recurrence.type) {
        case 'daily':
          if (isFirstScan && todayTriggerTime.getTime() < sessionStartMs) {
            const updated = {
              ...prompt,
              meta: {
                ...prompt.meta,
                last_notified: todayTriggerTime.toISOString(),
              },
            };
            const nextMap = new Map(allPromptsRef.current);
            nextMap.set(prompt.meta.id, updated);
            allPromptsRef.current = nextMap;
            missedRecurringUpdates.push(updated);
            return false;
          }
          return true;
        case 'weekly':
          if (!(recurrence.weekDays?.includes(nowDate.getDay()) ?? false)) return false;
          if (isFirstScan && todayTriggerTime.getTime() < sessionStartMs) {
            const updated = {
              ...prompt,
              meta: {
                ...prompt.meta,
                last_notified: todayTriggerTime.toISOString(),
              },
            };
            const nextMap = new Map(allPromptsRef.current);
            nextMap.set(prompt.meta.id, updated);
            allPromptsRef.current = nextMap;
            missedRecurringUpdates.push(updated);
            return false;
          }
          return true;
        case 'monthly':
          if (!(recurrence.monthDays?.includes(nowDate.getDate()) ?? false)) return false;
          if (isFirstScan && todayTriggerTime.getTime() < sessionStartMs) {
            const updated = {
              ...prompt,
              meta: {
                ...prompt.meta,
                last_notified: todayTriggerTime.toISOString(),
              },
            };
            const nextMap = new Map(allPromptsRef.current);
            nextMap.set(prompt.meta.id, updated);
            allPromptsRef.current = nextMap;
            missedRecurringUpdates.push(updated);
            return false;
          }
          return true;
        default:
          return false;
      }
    });

    const recurringTasksIgnoringDismissed = allPrompts.filter(prompt => {
      if (prompt.meta.type !== 'TASK') return false;
      if (!prompt.meta.recurrence?.enabled) return false;
      // 排除回收站中的任务
      if (prompt.path?.includes('/trash/') || prompt.path?.includes('\\trash\\')) return false;

      const recurrence = prompt.meta.recurrence;
      if (!recurrence.enabled) return false;

      if (intervalOnlyMode && recurrence.type !== 'interval') return false;

      const nowDate = new Date();
      if (recurrence.type === 'interval') {
        const intervalMinutes = recurrence.intervalMinutes;
        if (!intervalMinutes || intervalMinutes <= 0) return false;

        const baselineStr = prompt.meta.last_notified ?? prompt.meta.created_at;
        if (!baselineStr) return false;

        const baseMs = new Date(baselineStr).getTime();
        if (!Number.isFinite(baseMs)) return false;

        const intervalMs = intervalMinutes * 60 * 1000;
        const nowMs = nowDate.getTime();
        const diff = nowMs - baseMs;
        
        if (diff < intervalMs) return false;

        // 🔥 修复：对于 interval 任务，计算当前周期的触发时间
        const cyclesPassed = Math.floor(diff / intervalMs);
        const currentCycleTriggerMs = baseMs + cyclesPassed * intervalMs;
        
        // 启动抑制：如果当前周期的触发时间在启动前，则跳过补弹
        if (currentCycleTriggerMs < sessionStartMs) {
          // 首次扫描时更新 last_notified
          if (isFirstScan) {
            const updated = {
              ...prompt,
              meta: {
                ...prompt.meta,
                last_notified: new Date(sessionStartMs).toISOString(),
              },
            };
            const nextMap = new Map(allPromptsRef.current);
            nextMap.set(prompt.meta.id, updated);
            allPromptsRef.current = nextMap;
            missedRecurringUpdates.push(updated);
          }
          return false;
        }

        return true;
      }

      const [hours, minutes] = recurrence.time.split(':').map(Number);
      const todayTriggerTime = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), hours, minutes, 0);

      if (nowDate < todayTriggerTime) return false;

      const lateMs = nowDate.getTime() - todayTriggerTime.getTime();
      if (lateMs > RECURRENCE_GRACE_MS) {
        const updated = {
          ...prompt,
          meta: {
            ...prompt.meta,
            last_notified: todayTriggerTime.toISOString(),
          },
        };
        const nextMap = new Map(allPromptsRef.current);
        nextMap.set(prompt.meta.id, updated);
        allPromptsRef.current = nextMap;
        missedRecurringUpdates.push(updated);
        return false;
      }

      if (prompt.meta.last_notified) {
        const lastNotifiedDate = new Date(prompt.meta.last_notified);
        if (lastNotifiedDate.toDateString() === nowDate.toDateString()) {
          return false;
        }
      }

      if (prompt.meta.created_at) {
        const createdDate = new Date(prompt.meta.created_at);
        if (createdDate.toDateString() === nowDate.toDateString() && createdDate > todayTriggerTime) {
          return false;
        }
      }

      switch (recurrence.type) {
        case 'daily':
          if (isFirstScan && todayTriggerTime.getTime() < sessionStartMs) {
            const updated = {
              ...prompt,
              meta: {
                ...prompt.meta,
                last_notified: todayTriggerTime.toISOString(),
              },
            };
            const nextMap = new Map(allPromptsRef.current);
            nextMap.set(prompt.meta.id, updated);
            allPromptsRef.current = nextMap;
            missedRecurringUpdates.push(updated);
            return false;
          }
          return true;
        case 'weekly':
          if (!(recurrence.weekDays?.includes(nowDate.getDay()) ?? false)) return false;
          if (isFirstScan && todayTriggerTime.getTime() < sessionStartMs) {
            const updated = {
              ...prompt,
              meta: {
                ...prompt.meta,
                last_notified: todayTriggerTime.toISOString(),
              },
            };
            const nextMap = new Map(allPromptsRef.current);
            nextMap.set(prompt.meta.id, updated);
            allPromptsRef.current = nextMap;
            missedRecurringUpdates.push(updated);
            return false;
          }
          return true;
        case 'monthly':
          if (!(recurrence.monthDays?.includes(nowDate.getDate()) ?? false)) return false;
          if (isFirstScan && todayTriggerTime.getTime() < sessionStartMs) {
            const updated = {
              ...prompt,
              meta: {
                ...prompt.meta,
                last_notified: todayTriggerTime.toISOString(),
              },
            };
            const nextMap = new Map(allPromptsRef.current);
            nextMap.set(prompt.meta.id, updated);
            allPromptsRef.current = nextMap;
            missedRecurringUpdates.push(updated);
            return false;
          }
          return true;
        default:
          return false;
      }
    });
    
    // 合并所有需要提醒的任务
    const allAlertTasks = [...expiredTasks, ...recurringTasks];

    if (debugDue) {
      let nearestMs = Infinity;
      let nearestId: string | null = null;
      for (const p of allPrompts) {
        if (p.meta.type !== 'TASK') continue;
        if (p.path?.includes('/trash/') || p.path?.includes('\\trash\\')) continue;

        if (p.meta.scheduled_time && !p.meta.recurrence?.enabled) {
          const t = new Date(p.meta.scheduled_time).getTime();
          if (Number.isFinite(t) && t < nearestMs) {
            nearestMs = t;
            nearestId = p.meta.id;
          }
          continue;
        }

        const r = p.meta.recurrence;
        if (!r?.enabled) continue;
        if (r.type === 'interval') {
          const intervalMinutes = r.intervalMinutes;
          const baseStr = p.meta.last_notified ?? p.meta.created_at;
          if (!intervalMinutes || intervalMinutes <= 0 || !baseStr) continue;
          const baseMs = new Date(baseStr).getTime();
          if (!Number.isFinite(baseMs)) continue;
          const due = baseMs + intervalMinutes * 60 * 1000;
          if (due < nearestMs) {
            nearestMs = due;
            nearestId = p.meta.id;
          }
          continue;
        }

        const baseStr = p.meta.last_notified ?? p.meta.created_at;
        const nextIso = getNextTriggerTime(r, baseStr);
        const nextMs = new Date(nextIso).getTime();
        if (Number.isFinite(nextMs) && nextMs < nearestMs) {
          nearestMs = nextMs;
          nearestId = p.meta.id;
        }
      }

      const delta = Number.isFinite(nearestMs) ? nearestMs - now : null;
      console.debug('[due-debug] scan', {
        now,
        nearestId,
        nearestMs: Number.isFinite(nearestMs) ? nearestMs : null,
        deltaMs: delta,
        alertTasks: allAlertTasks.map(t => t.meta.id),
        currentAlertId: currentAlertTask?.meta.id ?? null,
      });
    }

    // 🔥 清理：重复任务在“未到点”时应允许下次周期再次提醒
    // - notifiedTasks：只保留当前仍到点的任务，避免重复任务只通知一次
    // - dismissedAlerts：对重复任务只做“本轮抑制”，进入下一轮后自动清除
    const dueIgnoringDismissedIds = new Set([
      ...expiredTasksIgnoringDismissed.map(t => t.meta.id),
      ...recurringTasksIgnoringDismissed.map(t => t.meta.id),
    ]);

    // @ts-ignore - V2: 旧扫描器代码，已禁用
    setNotifiedTasks(prev => {
      if (prev.size === 0) return prev;
      const next = new Set<string>();
      prev.forEach((id: string) => {
        if (dueIgnoringDismissedIds.has(id)) next.add(id);
      });
      if (next.size === prev.size) {
        let same = true;
        prev.forEach((id: string) => {
          if (!next.has(id)) same = false;
        });
        if (same) return prev;
      }
      return next;
    });

    setDismissedAlerts(prev => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Set(prev);
      for (const id of Array.from(next)) {
        if (!dueIgnoringDismissedIds.has(id)) {
          const p = allPromptsRef.current.get(id);
          if (p?.meta.recurrence?.enabled) {
            next.delete(id);
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
    
    // 发送系统通知（只发送一次）
    // 🔥 启动后5秒内不发送系统通知，避免重启时立即通知
    if (!isInStartupPeriod) {
      for (const task of allAlertTasks) {
        // 🔥 对于 interval 任务，检查是否进入了新的触发周期
        // 如果当前时间已经超过了 last_notified + interval，说明是新周期，需要清除旧的通知记录
        let shouldNotify = !currentNotifiedTasks.has(task.meta.id);
        
        if (!shouldNotify && task.meta.recurrence?.enabled && task.meta.recurrence.type === 'interval') {
          const intervalMinutes = task.meta.recurrence.intervalMinutes;
          const lastNotified = task.meta.last_notified;
          
          if (intervalMinutes && lastNotified) {
            const lastNotifiedMs = new Date(lastNotified).getTime();
            const intervalMs = intervalMinutes * 60 * 1000;
            const nowMs = Date.now();
            
            // 如果已经过了一个完整的 interval 周期，说明是新的触发周期
            if (nowMs >= lastNotifiedMs + intervalMs) {
              shouldNotify = true;
              // 清除旧的通知记录
              // @ts-ignore - V2: 旧扫描器代码，已禁用
              setNotifiedTasks(prev => {
                const next = new Set(prev);
                next.delete(task.meta.id);
                return next;
              });
            }
          }
        }
        
        if (shouldNotify) {
          // 判断任务是否已过期：一次性任务在expiredTasks中，重复任务都算已过期
          const isExpired = expiredTasks.includes(task) || recurringTasks.includes(task);
          const isRecurring = recurringTasks.includes(task);
          // @ts-ignore - V1 legacy code, disabled
          if (notificationSupported) {
            const sent = await sendTaskReminder(task.meta.id, task.meta.title, isExpired, isRecurring);
            if (sent) {
              // @ts-ignore - V2: 旧扫描器代码，已禁用
              setNotifiedTasks(prev => new Set(prev).add(task.meta.id));
              try {
                const updated = {
                  ...task,
                  meta: {
                    ...task.meta,
                    last_notified: new Date().toISOString(),
                  },
                };
                await savePrompt(updated);
              } catch {
              }
            }
          }
        }
      }
    }

    if (missedRecurringUpdates.length > 0) {
      void (async () => {
        for (const updated of missedRecurringUpdates) {
          try {
            await savePrompt(updated);
          } catch {
          }
        }
      })();
    }

    // 🔥 最小化/隐藏但系统通知可用：仅发系统通知，不弹应用内 ChronoAlert
    // @ts-ignore - V1 legacy code, disabled
    if (isHidden && notificationSupported) {
      if (currentAlertTask) setAlertTask(null);
      if (isFirstScan) firstScanRef.current = false;
      return;
    }
    
    // 🔥 启动后5秒内不显示应用内警报，避免重启时立即弹窗
    if (isInStartupPeriod) {
      if (currentAlertTask) setAlertTask(null);
      if (isFirstScan) firstScanRef.current = false;
      return;
    }
    
    // 显示页面警报：如果当前警报为空，或当前警报已不在待提醒列表中，则切换到最新的第一个
    if (allAlertTasks.length === 0) {
      if (currentAlertTask) setAlertTask(null);
      if (isFirstScan) firstScanRef.current = false;
      return;
    }

    const nextAlert = allAlertTasks[0];
    const currentStillPending =
      !!currentAlertTask && allAlertTasks.some(t => t.meta.id === currentAlertTask.meta.id);
    if (!currentAlertTask || !currentStillPending) {
      setAlertTask(nextAlert);
    }

    if (isFirstScan) firstScanRef.current = false;
  };
  
  // ========== V2: 显示待通知的任务 + 系统通知 + 自动关闭 ==========
  useEffect(() => {
    if (pendingTasks.length > 0) {
      // 显示第一个待通知的任务
      const task = pendingTasks[0];
      const taskId = task.meta.id;
      
      // 🔥 如果 alertTask 不匹配，更新它
      if (!alertTask || alertTask.meta.id !== taskId) {
        setAlertTask(task);
        
        // 🎯 刷新 vault 数据，因为后端在任务到期时更新了 last_notified
        // 这样 ChronoCard 的 key 会变化，组件会重新挂载，动画从头开始
        refreshVault().catch(err => console.error('[V2 Notification] Failed to refresh vault:', err));
      }
      
    } else if (pendingTasks.length === 0 && alertTask) {
      // 所有 interval 任务都已处理，清除 interval 警报；一次性/日常任务保留以便提示/自动回收
      const isIntervalAlert = alertTask.meta.recurrence?.type === 'interval';
      const isStillPending = pendingTasks.some(t => t.meta.id === alertTask.meta.id);
      if (isIntervalAlert && !isStillPending) {
        setAlertTask(null);
        // 清除已发送通知的记录
        sentSystemNotificationsRef.current.delete(alertTask.meta.id);
      }
    }
  }, [pendingTasks, alertTask, refreshVault]);

  // ========== V2: 系统通知 + 自动关闭定时器（独立 effect）==========
  useEffect(() => {
    if (!alertTask) return;

    const STARTUP_SUPPRESS_DURATION_MS = 5000;
    if (Date.now() - sessionStartedAtRef.current < STARTUP_SUPPRESS_DURATION_MS) return;
    
    const taskId = alertTask.meta.id;
    
    // 🔥 立即发送系统通知
    const sendSystemNotification = async () => {
      // 🔥 双重检查：防止 React StrictMode 导致的重复执行
      if (sentSystemNotificationsRef.current.has(taskId)) {
        return; // 已经发送过，跳过
      }
      
      // 标记为已发送
      sentSystemNotificationsRef.current.add(taskId);
      
      try {
        const isRecurring = !!alertTask.meta.recurrence?.enabled;
        await sendTaskReminder(taskId, alertTask.meta.title, true, isRecurring);
      } catch (error) {
        console.error('[V2 Notification] Failed to send system notification:', error);
        // 发送失败，移除标记，允许重试
        sentSystemNotificationsRef.current.delete(taskId);
      }
    };
    
    // 立即发送系统通知
    sendSystemNotification();
    
    // 🔥 3秒后自动关闭通知
    const autoDismissTimer = setTimeout(() => {
      // 使用 ref 获取最新的 handleAlertDismiss 函数
      if (handleAlertDismissRef.current) {
        handleAlertDismissRef.current();
      }
    }, 3000);
    
    // 清理定时器
    return () => {
      clearTimeout(autoDismissTimer);
    };
  }, [alertTask]);

  useEffect(() => {
    if (!alertTask) return;
    if (lastBubbleAlertRef.current === alertTask.meta.id) return;
    lastBubbleAlertRef.current = alertTask.meta.id;
    const title = alertTask.meta.recurrence?.enabled ? '⏰ 任务已到期' : '⏰ 任务即将到期';
    const durationMs = alertTask.meta.recurrence?.enabled ? 3000 : 2000;
    notifyMessage(`${title} · ${alertTask.meta.title}`, durationMs);
    if (alertTask.meta.recurrence?.enabled) {
      triggerTime('countdown', 3000);
    } else {
      triggerTime('schedule', 2000);
    }
  }, [alertTask, notifyMessage, triggerTime]);

  // ========== Focus Mode 处理函数 ==========
  const enterFocusMode = useCallback((promptId: string) => {
    setFocusedCardId(promptId);
    setFocusModeActive(true);
    setTimeout(() => {
      const element = document.getElementById(`card-${promptId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }, []);
  
  const exitFocusMode = () => {
    setFocusModeActive(false);
    setFocusedCardId(null);
  };
  
  // ========== Chrono Alert 处理函数 ==========
  const handleAlertFocus = useCallback(() => {
    if (alertTask) {
      dispatch({ type: 'SELECT_CATEGORY', payload: null });
      
      setTimeout(() => {
        enterFocusMode(alertTask.meta.id);
      }, 150);
      
      setAlertTask(null);
    }
  }, [alertTask, dispatch, enterFocusMode]);
  
  const handleAlertDismiss = useCallback(async () => {
    if (!alertTask) return;
    
    const taskId = alertTask.meta.id;
    const isRecurringTask = !!alertTask.meta.recurrence?.enabled;
    
    // Reset notification throttle for this task
    resetTaskThrottle(taskId);
    
    try {
      // 🔥 先关闭通知栏，防止重复触发系统通知
      setAlertTask(null);

      // 重复任务：interval 走后端 acknowledge；其他重复任务不移入回收站
      if (isRecurringTask) {
        if (alertTask.meta.recurrence?.type === 'interval') {
          const result = await acknowledgeTask(taskId);
          if (!result.success) {
            showToast('确认失败，请重试', 'error');
          }
        }
        sentSystemNotificationsRef.current.delete(taskId);
        return;
      }

      // 一次性任务：移动到回收站
      setDismissedAlerts(prev => new Set(prev).add(taskId));
      
      // 🔥 等待视图切换，然后触发卡片删除动画
      setTimeout(async () => {
        // 触发删除动画
        setDeletingIds(prev => {
          const next = new Set(prev);
          next.add(taskId);
          return next;
        });
        
        // 等待动画完成后删除
        setTimeout(async () => {
          try {
            await deletePrompt(taskId, false); // false = 移动到回收站
            showToast('任务已移至回收站', 'success');
          } catch (error) {
            showToast('移动失败', 'error');
          } finally {
            setDeletingIds(prev => {
              const next = new Set(prev);
              next.delete(taskId);
              return next;
            });
          }
        }, 600); // 等待粒子动画完成
      }, 150); // 等待视图切换
    } catch (error) {
      showToast('操作失败', 'error');
    }
  }, [alertTask, acknowledgeTask, showToast, deletePrompt, resetTaskThrottle]);
  
  // 🔥 更新 ref，确保定时器总是调用最新的函数
  useEffect(() => {
    handleAlertDismissRef.current = handleAlertDismiss;
  }, [handleAlertDismiss]);

  useEffect(() => {
    if (!alertTask) {
      clearAlert();
      return;
    }
    notifyAlert({
      id: alertTask.meta.id,
      title: alertTask.meta.title,
      onFocus: handleAlertFocus,
      onDismiss: handleAlertDismiss,
      durationMs: 5000,
    });
  }, [alertTask, clearAlert, handleAlertDismiss, handleAlertFocus, notifyAlert]);

  // ========== One-time Task Auto Trash ==========
  useEffect(() => {
    const handleDueOneTimeTasks = () => {
      if (pendingTasks.length > 0 || alertTask) return;

      const allPrompts = Array.from(state.fileSystem?.allPrompts.values() || []);
      const now = Date.now();

      const dueOneTimeTasks = allPrompts.filter(prompt => {
        if (prompt.meta.type !== 'TASK') return false;
        if (!prompt.meta.scheduled_time) return false;
        if (prompt.meta.recurrence?.enabled) return false;
        if (prompt.path?.includes('/trash/') || prompt.path?.includes('\\trash\\')) return false;

        const scheduledMs = new Date(prompt.meta.scheduled_time).getTime();
        if (!Number.isFinite(scheduledMs) || scheduledMs > now) return false;
        return !autoTrashedOneTimeRef.current.has(prompt.meta.id);
      });

      if (dueOneTimeTasks.length === 0) return;

      const nextTask = dueOneTimeTasks[0];
      autoTrashedOneTimeRef.current.add(nextTask.meta.id);
      setAlertTask(nextTask);
    };

    handleDueOneTimeTasks();
    const interval = window.setInterval(handleDueOneTimeTasks, 5000);
    return () => window.clearInterval(interval);
  }, [state.fileSystem?.allPrompts, pendingTasks.length, alertTask]);

  // ========== Daily/Weekly/Monthly Recurring Task Notifications ==========
  useEffect(() => {
    const handleDueRecurringTasks = () => {
      const STARTUP_SUPPRESS_DURATION_MS = 5000;
      if (Date.now() - sessionStartedAtRef.current < STARTUP_SUPPRESS_DURATION_MS) return;
      if (alertTask) return;

      const allPrompts = Array.from(state.fileSystem?.allPrompts.values() || []);
      const now = Date.now();

      const dueRecurringTasks = allPrompts.filter(prompt => {
        if (prompt.meta.type !== 'TASK') return false;
        if (!prompt.meta.recurrence?.enabled) return false;
        if (!['daily', 'weekly', 'monthly'].includes(prompt.meta.recurrence.type)) return false;
        if (prompt.path?.includes('/trash/') || prompt.path?.includes('\\trash\\')) return false;

        const recurrence = prompt.meta.recurrence;
        const [hours, minutes] = recurrence.time.split(':').map(Number);
        const triggerDate = new Date();
        triggerDate.setHours(hours, minutes, 0, 0);

        if (recurrence.type === 'weekly') {
          const weekDays = (recurrence.weekDays && recurrence.weekDays.length > 0)
            ? recurrence.weekDays
            : [0, 1, 2, 3, 4, 5, 6];
          if (!weekDays.includes(triggerDate.getDay())) return false;
        }

        if (recurrence.type === 'monthly') {
          const monthDays = (recurrence.monthDays && recurrence.monthDays.length > 0)
            ? recurrence.monthDays
            : Array.from({ length: 31 }, (_, i) => i + 1);
          if (!monthDays.includes(triggerDate.getDate())) return false;
        }

        const triggerMs = triggerDate.getTime();
        if (now < triggerMs) return false;

        const triggerKey = triggerDate.toISOString().slice(0, 10);
        if (recurringNotifiedRef.current.get(prompt.meta.id) === triggerKey) return false;

        if (prompt.meta.last_notified) {
          const lastNotified = new Date(prompt.meta.last_notified).getTime();
          if (lastNotified >= triggerMs) return false;
        }

        return true;
      });

      if (dueRecurringTasks.length === 0) return;

      const nextTask = dueRecurringTasks[0];
      const triggerKey = new Date().toISOString().slice(0, 10);
      recurringNotifiedRef.current.set(nextTask.meta.id, triggerKey);
      setAlertTask(nextTask);
      const nowIso = new Date().toISOString();
      const updated = {
        ...nextTask,
        meta: {
          ...nextTask.meta,
          last_notified: nowIso,
        },
      };
      savePrompt(updated).catch(() => null);
    };

    handleDueRecurringTasks();
    const interval = window.setInterval(handleDueRecurringTasks, 5000);
    return () => window.clearInterval(interval);
  }, [state.fileSystem?.allPrompts, alertTask, savePrompt]);
  
  // ========== ESC 键退出 Focus Mode ==========
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusModeActive) {
        exitFocusMode();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [focusModeActive]);

  useEffect(() => {
    return () => {
      if (burstTimerRef.current) {
        window.clearTimeout(burstTimerRef.current);
        burstTimerRef.current = null;
      }
    };
  }, []);

  // ========== 计算网格列数 (Grid Column Count) ==========
  useEffect(() => {
    const updateColumnCount = () => {
      const width = window.innerWidth;
      if (width >= 1024) {
        setColumnCount(3); // lg: 3 columns
      } else if (width >= 768) {
        setColumnCount(2); // md: 2 columns
      } else {
        setColumnCount(1); // sm: 1 column
      }
    };

    updateColumnCount();
    window.addEventListener('resize', updateColumnCount);
    return () => window.removeEventListener('resize', updateColumnCount);
  }, []);

  // ========== 同步焦点到 DOM (Sync Focus to DOM) ==========
  useEffect(() => {
    // 🔥 只在键盘导航时才滚动到卡片
    if (isKeyboardNavigation && focusedIndex >= 0 && focusedIndex < cardRefs.current.length) {
      const card = cardRefs.current[focusedIndex];
      if (card) {
        // 不使用 focus()，避免触发浏览器的焦点样式
        // 只滚动到可见区域
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [focusedIndex, isKeyboardNavigation]);

  // ========== 键盘快捷键监听 (Keyboard Shortcuts) ==========
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果正在输入框中，不处理快捷键
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // 如果编辑器打开，处理编辑器内的快捷键
      if (uiState.editorOverlay.isOpen) {
        if (e.key === ' ') {
          e.preventDefault();
          handleEditorSpaceKey();
        }
        return;
      }

      // 🔥 方向键操作时标记为键盘导航
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        setIsKeyboardNavigation(true);
      }

      // 全局快捷键
      switch (e.key) {
        case 'c':
        case 'C':
          if (e.ctrlKey || e.metaKey) {
            // Ctrl+C / Cmd+C: 复制内容
            if (focusedIndex >= 0 && focusedIndex < prompts.length) {
              e.preventDefault();
              const prompt = prompts[focusedIndex];
              copyPromptContent(prompt.meta.id);
            }
          } else {
            // C: 打开新建模态框
            e.preventDefault();
            openNewPrompt();
          }
          break;

        case 'Enter':
          if (focusedIndex >= 0 && focusedIndex < prompts.length) {
            e.preventDefault();
            const prompt = prompts[focusedIndex];
            if (selectedCategory !== 'trash') {
              handleCardClick(prompt.meta.id);
            }
          }
          break;

        case ' ':
          if (focusedIndex >= 0 && focusedIndex < prompts.length) {
            e.preventDefault();
            const prompt = prompts[focusedIndex];
            if (selectedCategory !== 'trash') {
              handleCardClick(prompt.meta.id);
            }
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => {
            const newIndex = prev - columnCount;
            return newIndex >= 0 ? newIndex : prev;
          });
          break;

        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => {
            const newIndex = prev + columnCount;
            return newIndex < prompts.length ? newIndex : prev;
          });
          break;

        case 'ArrowLeft':
          e.preventDefault();
          setFocusedIndex((prev) => {
            const newIndex = prev - 1;
            return newIndex >= 0 ? newIndex : prev;
          });
          break;

        case 'ArrowRight':
          e.preventDefault();
          setFocusedIndex((prev) => {
            const newIndex = prev + 1;
            return newIndex < prompts.length ? newIndex : prev;
          });
          break;

        case 'Escape':
          // 🔥 ESC 键取消选中
          e.preventDefault();
          setFocusedIndex(-1);
          setIsKeyboardNavigation(false);
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, columnCount, prompts, selectedCategory, uiState.editorOverlay.isOpen]);

  // ========== 编辑器空格键处理 (Editor Space Key Handler) ==========
  const handleEditorSpaceKey = () => {
    // 编辑器扩展功能（预留）
    // 可以在这里实现：第一次空格进入编辑，第二次放大，第三次全屏，第四次关闭
    /*
    setEditorClickCount((prev) => {
      const newCount = prev + 1;
      
      // 清除之前的定时器
      if (editorClickTimerRef.current) {
        window.clearTimeout(editorClickTimerRef.current);
      }

      // 设置新的定时器，2秒后重置计数
      editorClickTimerRef.current = window.setTimeout(() => {
        setEditorClickCount(0);
        setIsEditorExpanded(false);
      }, 2000);

      // 根据点击次数执行不同操作
      switch (newCount) {
        case 1:
          // 第一次：进入编辑模式（已经在编辑模式中）
          break;
        case 2:
          // 第二次：放大编辑器
          setIsEditorExpanded(true);
          break;
        case 3:
          // 第三次：触发双击效果（可以是全屏或其他操作）
          // 这里可以添加全屏逻辑
          break;
        case 4:
          // 第四次：回到最初状态
          setIsEditorExpanded(false);
          setEditorClickCount(0);
          dispatch({ type: 'CLOSE_EDITOR_OVERLAY' });
          break;
        default:
          break;
      }

      return newCount;
    });
    */
  };

  const dragPendingRef = useRef(false);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragSuppressUntilRef = useRef<number>(0);

  const [newPromptOverlayMounted, setNewPromptOverlayMounted] = useState(false);
  const [newPromptOverlayOpen, setNewPromptOverlayOpen] = useState(false);
  const [contentContextMenu, setContentContextMenu] = useState<{ x: number; y: number } | null>(null);

  const getHasAnyDraftContent = (v: { title: string; content: string; category: string; tags: string }) => {
    return Boolean(v.title.trim() || v.content.trim() || v.category.trim() || v.tags.trim());
  };

  const getIsNewPromptComplete = (v: { title: string; content: string; category: string }) => {
    // 分类可为空（公共），所以“完成”只取决于标题 + 内容
    return Boolean(v.title.trim() && v.content.trim());
  };

  const restoreNewPromptDraft = () => {
    try {
      const raw = localStorage.getItem(newPromptDraftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { title?: string; content?: string; category?: string; tags?: string };
      setNewPrompt((prev) => ({
        ...prev,
        title: typeof parsed.title === 'string' ? parsed.title : prev.title,
        content: typeof parsed.content === 'string' ? parsed.content : prev.content,
        category: typeof parsed.category === 'string' ? parsed.category : prev.category,
        tags: typeof parsed.tags === 'string' ? parsed.tags : prev.tags,
      }));
    } catch {
    }
  };

  const handleTitleBarDoubleClick = async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // 忽略按钮、输入框等交互元素的双击
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('select')
    ) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    // 🔥 关键修复：完全禁用拖拽，防止与最大化/还原冲突
    dragPendingRef.current = false;
    dragStartPosRef.current = null;
    // 延长屏蔽时间，确保拖拽不会在最大化/还原后立即触发
    dragSuppressUntilRef.current = Date.now() + 500;

    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();
      
      // 🔥 关键修复：先检查状态，再执行操作，避免状态不一致
      const maximized = await appWindow.isMaximized();
      
      // 添加小延迟，确保 Windows 完成当前操作
      await new Promise(resolve => setTimeout(resolve, 50));
      
      if (maximized) {
        await appWindow.unmaximize();
        setIsMaximized(false);
      } else {
        await appWindow.maximize();
        setIsMaximized(true);
      }
      
      // 再次延迟，确保窗口状态稳定
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      // 忽略错误，可能不在 Tauri 环境中
    }
  };

  const persistNewPromptDraftIfNeeded = () => {
    const hasAny = getHasAnyDraftContent(newPrompt);
    const complete = getIsNewPromptComplete(newPrompt);

    if (!hasAny) {
      try {
        localStorage.removeItem(newPromptDraftKey);
      } catch {
      }
      return;
    }

    if (complete) {
      try {
        localStorage.removeItem(newPromptDraftKey);
      } catch {
      }
      return;
    }

    try {
      localStorage.setItem(newPromptDraftKey, JSON.stringify(newPrompt));
    } catch {
    }
  };

  const clearNewPromptDraft = () => {
    try {
      localStorage.removeItem(newPromptDraftKey);
    } catch {
    }
  };

  const openNewPrompt = (preselectCategoryPath?: string | null) => {
    dispatch({ type: 'OPEN_NEW_PROMPT_MODAL', payload: preselectCategoryPath || undefined });
    setNewPromptOverlayMounted(true);
    setNewPromptOverlayOpen(true);
  };

  const requestCloseNewPrompt = () => {
    persistNewPromptDraftIfNeeded();
    setNewPromptOverlayOpen(false);
  };

  useEffect(() => {
    if (isModalOpen) {
      restoreNewPromptDraft();
      setNewPromptOverlayMounted(true);
      setNewPromptOverlayOpen(true);
      return;
    }

    if (!isModalOpen) {
      setIsCategoryOpen(false);
      setCategoryQuery('');
      setDropdownCreatingParentPath(null);
      setDropdownNewCategoryName('');
    }
  }, [isModalOpen]);

  useEffect(() => {
    if (!isCategoryOpen) {
      setDropdownCreatingParentPath(null);
      setDropdownNewCategoryName('');
    }
  }, [isCategoryOpen]);

  useEffect(() => {
    if (isCategoryOpen && dropdownCreatingParentPath && dropdownNewCategoryInputRef.current) {
      dropdownNewCategoryInputRef.current.focus();
      dropdownNewCategoryInputRef.current.select();
    }
  }, [isCategoryOpen, dropdownCreatingParentPath]);

  // 处理预选分类
  useEffect(() => {
    if (isModalOpen && preselectedCategory) {
      // 根据分类路径找到分类名称
      const findCategoryNameByPath = (nodes: any[], path: string): string | null => {
        for (const node of nodes) {
          if (node.path === path) return node.name;
          if (node.children && node.children.length > 0) {
            const found = findCategoryNameByPath(node.children, path);
            if (found) return found;
          }
        }
        return null;
      };
      
      if (state.fileSystem?.categories) {
        const categoryName = findCategoryNameByPath(state.fileSystem.categories, preselectedCategory);
        if (categoryName) {
          setNewPrompt(prev => ({ ...prev, category: categoryName }));
        }
      }
    }
  }, [isModalOpen, preselectedCategory, state.fileSystem]);

  useEffect(() => {
    if (!isCategoryOpen) return;

    const onMouseDown = (e: MouseEvent) => {
      const el = categoryPopoverRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setIsCategoryOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCategoryOpen(false);
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isCategoryOpen]);

  useEffect(() => {
    setIsSwitchingList(true);
    const t = window.setTimeout(() => setIsSwitchingList(false), 120);
    return () => window.clearTimeout(t);
  }, [selectedCategory, searchQuery, state.filterTags, state.sortBy]);

  useEffect(() => {
    if (selectedCategory !== 'trash') {
      return;
    }
    if (state.fileSystem?.root === '/vault') {
      return;
    }

    let cancelled = false;
    (async () => {
      const response = await api.trash.status(trashThreshold);
      if (cancelled) return;
      if (!response.success || !response.data) {
        setTrashCounts({});
        return;
      }
      setTrashCounts((response.data as any).counts || {});
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCategory, state.fileSystem?.root]);

  // ========== 窗口控制函数 (Window Control Functions) ==========
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let checkTimeout: number | undefined;
    
    // 🔥 防抖的状态检查函数
    const debouncedCheckMaximized = async () => {
      if (checkTimeout) {
        window.clearTimeout(checkTimeout);
      }
      
      checkTimeout = window.setTimeout(async () => {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const appWindow = getCurrentWindow();
          const maximized = await appWindow.isMaximized();
          setIsMaximized(maximized);
          
          // 🔥 关键修复：状态变化后重置拖拽屏蔽
          if (maximized) {
            dragSuppressUntilRef.current = Date.now() + 300;
          }
        } catch (error) {
          // 忽略错误，可能不在Tauri环境中
        }
      }, 100);
    };

    // 初始检查
    debouncedCheckMaximized();

    // 监听窗口状态变化事件
    const setupListener = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const appWindow = getCurrentWindow();
        
        // 监听窗口大小变化
        unlisten = await appWindow.onResized(() => {
          debouncedCheckMaximized();
        });
      } catch (error) {
        // 忽略错误
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
      if (checkTimeout) {
        window.clearTimeout(checkTimeout);
      }
    };
  }, []);

  const handleMinimize = async () => {
    // 🔥 屏蔽拖拽，防止最小化后的状态异常
    dragSuppressUntilRef.current = Date.now() + 500;
    dragPendingRef.current = false;
    dragStartPosRef.current = null;
    
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();
      await appWindow.minimize();
    } catch (error) {
      showToast('最小化失败: ' + (error instanceof Error ? error.message : String(error)), 'error');
    }
  };

  const handleMaximize = async () => {
    // 🔥 关键修复：屏蔽拖拽，防止最大化/还原时的冲突
    dragSuppressUntilRef.current = Date.now() + 500;
    dragPendingRef.current = false;
    dragStartPosRef.current = null;
    
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();
      
      // 🔥 添加延迟，确保状态稳定
      await new Promise(resolve => setTimeout(resolve, 50));
      
      if (isMaximized) {
        await appWindow.unmaximize();
        setIsMaximized(false);
      } else {
        await appWindow.maximize();
        setIsMaximized(true);
      }
      
      // 🔥 再次延迟，确保窗口状态完全稳定
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      showToast('窗口最大化失败: ' + (error instanceof Error ? error.message : String(error)), 'error');
    }
  };

  const handleClose = async () => {
    // 🔥 版本检查：清理旧的 localStorage 键
    const storageVersion = localStorage.getItem('closePreferenceVersion');
    if (storageVersion !== '2') {
      // 清理旧版本的数据
      localStorage.removeItem('closePreference');
      localStorage.removeItem('minimizeCount');
      localStorage.removeItem('lastCloseChoice');
      localStorage.removeItem('consecutiveCloseCount');
      localStorage.setItem('closePreferenceVersion', '2');
    }
    
    // 🔥 检查用户的关闭行为偏好
    const closePreference = localStorage.getItem('closePreference');
    const lastChoice = localStorage.getItem('lastCloseChoice'); // 'minimize' 或 'exit'
    const consecutiveCount = parseInt(localStorage.getItem('consecutiveCloseCount') || '0', 10);
    
    // 🔥 如果已经记住了偏好，直接执行
    if (closePreference === 'minimize') {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const appWindow = getCurrentWindow();
        await appWindow.hide();
      } catch (hideError) {
        console.error('Failed to hide window:', hideError);
      }
      return;
    }
    
    if (closePreference === 'exit') {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('exit_app');
      } catch (invokeError) {
        console.error('Failed to exit app:', invokeError);
      }
      return;
    }
    
    // 弹出确认对话框
    try {
      const result = await confirm({
        title: '关闭窗口',
        message: '选择关闭方式：',
        confirmText: '最小化到托盘',
        cancelText: '完全退出',
        type: 'info',
      });
      
      // result 为 true 表示点击了"最小化到托盘"
      if (result === true) {
        // 🔥 检查是否与上次选择一致
        if (lastChoice === 'minimize') {
          // 连续选择最小化，增加计数
          const newCount = consecutiveCount + 1;
          localStorage.setItem('consecutiveCloseCount', newCount.toString());
          localStorage.setItem('lastCloseChoice', 'minimize');
          
          // 🔥 如果连续选择了 5 次，记住这个偏好
          if (newCount >= 5) {
            localStorage.setItem('closePreference', 'minimize');
          }
        } else {
          // 切换了选择，重置计数
          localStorage.setItem('consecutiveCloseCount', '1');
          localStorage.setItem('lastCloseChoice', 'minimize');
        }
        
        // 最小化到托盘（隐藏窗口）
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const appWindow = getCurrentWindow();
          await appWindow.hide();
        } catch (hideError) {
          console.error('Failed to hide window:', hideError);
        }
      } else if (result === false) {
        // 🔥 检查是否与上次选择一致
        if (lastChoice === 'exit') {
          // 连续选择退出，增加计数
          const newCount = consecutiveCount + 1;
          localStorage.setItem('consecutiveCloseCount', newCount.toString());
          localStorage.setItem('lastCloseChoice', 'exit');
          
          // 🔥 如果连续选择了 5 次，记住这个偏好
          if (newCount >= 5) {
            localStorage.setItem('closePreference', 'exit');
          }
        } else {
          // 切换了选择，重置计数
          localStorage.setItem('consecutiveCloseCount', '1');
          localStorage.setItem('lastCloseChoice', 'exit');
        }
        
        // 完全退出程序
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('exit_app');
        } catch (invokeError) {
          console.error('Failed to exit app:', invokeError);
          // 如果 invoke 失败，尝试直接销毁窗口
          try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const appWindow = getCurrentWindow();
            await appWindow.destroy();
          } catch (destroyError) {
            console.error('Failed to destroy window:', destroyError);
          }
        }
      }
    } catch (error) {
      console.error('Error handling close:', error);
    }
  };

  const handleTitleBarPointerDown = (e: React.PointerEvent) => {
    const now = Date.now();
    // 🔥 关键修复：在屏蔽期内完全忽略拖拽
    if (now < dragSuppressUntilRef.current) {
      e.preventDefault();
      return;
    }

    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('select')
    ) {
      return;
    }

    // 只记录起点，避免 click 被误判为拖拽启动
    dragPendingRef.current = true;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleTitleBarPointerMove = async (e: React.PointerEvent) => {
    if (!dragPendingRef.current) return;
    const start = dragStartPosRef.current;
    if (!start) return;

    const now = Date.now();
    // 🔥 关键修复：在屏蔽期内取消拖拽
    if (now < dragSuppressUntilRef.current) {
      dragPendingRef.current = false;
      dragStartPosRef.current = null;
      return;
    }

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    // 🔥 增加阈值，避免误触发
    const threshold = 8;
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;

    dragPendingRef.current = false;
    dragStartPosRef.current = null;

    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();
      
      // 🔥 关键修复：只在非最大化状态下允许拖拽
      const maximized = await appWindow.isMaximized();
      if (!maximized) {
        await appWindow.startDragging();
      }
    } catch (error) {
      // 忽略错误，可能不在Tauri环境中
    }
  };

  const handleTitleBarPointerUp = () => {
    dragPendingRef.current = false;
    dragStartPosRef.current = null;
  };

  const getTrashItemName = (promptPath: string): string | null => {
    const unixIdx = promptPath.lastIndexOf('/trash/');
    if (unixIdx >= 0) {
      const rest = promptPath.substring(unixIdx + '/trash/'.length);
      return rest.split('/')[0] || null;
    }
    const winIdx = promptPath.toLowerCase().lastIndexOf('\\trash\\');
    if (winIdx >= 0) {
      const rest = promptPath.substring(winIdx + '\\trash\\'.length);
      return rest.split('\\')[0] || null;
    }
    return null;
  };

  // 扁平化分类树结构，保留层级信息
  interface FlatCategory {
    name: string;
    path: string;
    level: number;
    hasChildren: boolean;
  }

  const getFlatCategories = (): FlatCategory[] => {
    const flatCategories: FlatCategory[] = [];
    
    const traverse = (nodes: any[], level: number = 0) => {
      if (!nodes || !Array.isArray(nodes)) return;
      
      nodes.forEach(node => {
        if (node && node.name && !node.name.toLowerCase().includes('trash')) {
          const hasChildren = node.children && Array.isArray(node.children) && node.children.length > 0;
          
          flatCategories.push({
            name: node.name,
            path: node.path,
            level,
            hasChildren
          });
          
          if (hasChildren) {
            traverse(node.children, level + 1);
          }
        }
      });
    };
    
    if (state.fileSystem?.categories && Array.isArray(state.fileSystem.categories)) {
      traverse(state.fileSystem.categories);
    }
    
    return flatCategories;
  };

  const allFlatCategories = getFlatCategories();
  const filteredCategories = categoryQuery
    ? allFlatCategories.filter((c) => c.name.toLowerCase().includes(categoryQuery.toLowerCase()))
    : allFlatCategories;

  const handleStartCreateSubCategoryFromDropdown = (parentPath: string) => {
    setDropdownCreatingParentPath(parentPath);
    setDropdownNewCategoryName('');
  };

  const handleCancelCreateSubCategoryFromDropdown = () => {
    setDropdownCreatingParentPath(null);
    setDropdownNewCategoryName('');
  };

  const handleSubmitCreateSubCategoryFromDropdown = async () => {
    const name = dropdownNewCategoryName.trim();
    const parentPath = dropdownCreatingParentPath;
    if (!name || !parentPath) {
      handleCancelCreateSubCategoryFromDropdown();
      return;
    }
    if (!state.fileSystem) {
      showToast('尚未加载 Vault，无法创建分类', 'warning');
      return;
    }

    try {
      await createCategory(parentPath, name);
      setNewPrompt((prev) => ({ ...prev, category: name }));
      handleCancelCreateSubCategoryFromDropdown();
      setIsCategoryOpen(false);
      setCategoryQuery('');
      showToast('分类创建成功', 'success');
    } catch (error) {
      showToast(`创建分类失败: ${(error as Error).message}`, 'error');
    }
  };

  const handleDropdownNewCategoryKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmitCreateSubCategoryFromDropdown();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelCreateSubCategoryFromDropdown();
    }
  };

  // 单击进入编辑页面 - 使用动画覆盖层
  const handleCardClick = (promptId: string) => {
    const originCardId = `prompt-card-${promptId}`;
    dispatch({ 
      type: 'OPEN_EDITOR_OVERLAY', 
      payload: { promptId, originCardId } 
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        showToast("已复制到剪贴板", 'success');
        triggerAction('clipboard');
      })
      .catch(() => showToast("复制失败", 'error'));
  };

  const copyPromptContent = (promptId: string) => {
    const prompt = state.fileSystem?.allPrompts.get(promptId);
    if (!prompt) return;
    handleCopy(prompt.content);
  };

  const toggleFavorite = async (promptId: string) => {
    const prompt = state.fileSystem?.allPrompts.get(promptId);
    if (!prompt) return;

    const updated = {
      ...prompt,
      meta: { ...prompt.meta, is_favorite: !prompt.meta.is_favorite }
    };
    
    try {
      await savePrompt(updated);
      triggerAction('favorite');
    } catch (error) {
      showToast("更新失败", 'error');
    }
  };

  // ========== 置顶功能 (Pin) ==========
  const togglePin = async (promptId: string) => {
    const prompt = state.fileSystem?.allPrompts.get(promptId);
    if (!prompt) return;

    const newPinnedState = !prompt.meta.is_pinned;

    const updated = {
      ...prompt,
      meta: { ...prompt.meta, is_pinned: newPinnedState }
    };
    
    try {
      await savePrompt(updated);
      triggerAction('pin');
      // 强制刷新以确保 UI 更新
      await refreshVault();
    } catch (error) {
      showToast("置顶失败", 'error');
    }
  };

  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  
  // ========== 批量删除状态 (Batch Delete) ==========
  const [batchSelectMode, setBatchSelectMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // ========== 导出选择模式 (Export Select Mode) ==========
  const [exportSelectMode, setExportSelectMode] = useState<boolean>(false);
  const [exportSelectedIds, setExportSelectedIds] = useState<Set<string>>(new Set());
  
  // ========== 拖拽选择状态 (Drag Selection) ==========
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStartId, setDragStartId] = useState<string | null>(null);
  const dragSelectionRef = useRef<Set<string>>(new Set());
  const autoScrollIntervalRef = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // 删除队列管理（用于批量显示 toast）
  const deleteQueueRef = useRef<{
    timer: NodeJS.Timeout | null;
    count: number;
    type: 'trash' | 'permanent';
  }>({ timer: null, count: 0, type: 'trash' });

  const handleDelete = async (promptId: string) => {
    // 防止重复删除：如果正在删除中，直接返回
    if (deletingIds.has(promptId)) {
      return;
    }
    
    const isInTrash = selectedCategory === 'trash';
    
    if (isInTrash) {
      // 在回收站中,永久删除（不使用队列，因为有确认对话框）
      const confirmed = await confirm({
        title: '永久删除提示词',
        message: '确定要永久删除这个提示词吗？此操作无法撤销！',
        confirmText: '永久删除',
        cancelText: '取消',
        type: 'danger',
        originElementId: `prompt-card-${promptId}`, // 🔥 传递源元素 ID 用于 Mac 动画
      });
      
      if (confirmed) {
        triggerAction('delete');
        setDeletingIds(prev => {
          const next = new Set(prev);
          next.add(promptId);
          return next;
        });
        window.setTimeout(async () => {
          try {
            await deletePrompt(promptId, true);
            showToast("已永久删除", 'success');
          } catch (error) {
            showToast("删除失败", 'error');
          } finally {
            setDeletingIds(prev => {
              const next = new Set(prev);
              next.delete(promptId);
              return next;
            });
          }
        }, 600);
      }
    } else {
      triggerAction('delete');
      // 不在回收站,直接移动到回收站（带动画 + 队列合并 toast）
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.add(promptId);
        return next;
      });
      
      // 延迟删除以显示动画
      window.setTimeout(async () => {
        try {
          await deletePrompt(promptId, false);
          
          // 批量 toast 逻辑
          deleteQueueRef.current.count++;
          deleteQueueRef.current.type = 'trash';
          
          if (deleteQueueRef.current.timer) {
            clearTimeout(deleteQueueRef.current.timer);
          }
          
          deleteQueueRef.current.timer = setTimeout(() => {
            const count = deleteQueueRef.current.count;
            if (count === 1) {
              showToast("已移动到回收站，可从回收站恢复", 'success');
            } else {
              showToast(`已移动 ${count} 个提示词到回收站`, 'success');
            }
            deleteQueueRef.current.count = 0;
            deleteQueueRef.current.timer = null;
          }, 300); // 300ms 内的删除操作合并
          
        } catch (error) {
          showToast("删除失败", 'error');
        } finally {
          setDeletingIds(prev => {
            const next = new Set(prev);
            next.delete(promptId);
            return next;
          });
        }
      }, 600);
    }
  };

  const handleRestore = async (promptId: string) => {
    try {
      await restorePrompt(promptId);
      triggerAction('restore');
      showToast("已恢复", 'success');
    } catch (error) {
      console.error('[Restore] Failed to restore prompt:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      showToast(`恢复失败: ${errorMessage}`, 'error');
    }
  };
  
  // ========== 批量删除处理函数 (Batch Delete Handlers) ==========
  const toggleBatchSelect = (promptId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(promptId)) {
        next.delete(promptId);
      } else {
        next.add(promptId);
      }
      return next;
    });
  };
  
  const selectAll = () => {
    const allIds = new Set(prompts.map(p => p.meta.id));
    setSelectedIds(allIds);
  };
  
  const deselectAll = () => {
    setSelectedIds(new Set());
  };
  
  // ========== 导出选择模式函数 (Export Select Mode) ==========
  const toggleExportSelect = (promptId: string) => {
    setExportSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(promptId)) {
        newSet.delete(promptId);
      } else {
        newSet.add(promptId);
      }
      return newSet;
    });
  };

  const selectAllForExport = () => {
    const allIds = new Set(prompts.map(p => p.meta.id));
    setExportSelectedIds(allIds);
  };

  const deselectAllForExport = () => {
    setExportSelectedIds(new Set());
  };

  const handleExportSelected = () => {
    if (exportSelectedIds.size === 0) {
      showToast('请至少选择一个提示词', 'error');
      return;
    }

    // 如果选中了特定分类，使用树形结构导出
    if (selectedCategory && selectedCategory !== 'all' && selectedCategory !== 'favorites' && selectedCategory !== 'trash') {
      setExportConfig({ 
        preSelectedIds: Array.from(exportSelectedIds),
        categoryPath: selectedCategory,
        preserveStructure: true,
      });
    } else {
      // 否则使用扁平结构导出
      setExportConfig({ 
        preSelectedIds: Array.from(exportSelectedIds),
        preserveStructure: false,
      });
    }
    
    setShowExportDialog(true);
    setExportSelectMode(false);
    setExportSelectedIds(new Set());
  };
  
  // ========== 拖拽选择处理函数 (Drag Selection Handlers) ==========
  const handleDragStart = (promptId: string) => {
    if (!batchSelectMode) return;
    
    setIsDragging(true);
    setDragStartId(promptId);
    
    // 初始化拖拽选择集合，包含起始卡片
    const initialSelection = new Set(selectedIds);
    initialSelection.add(promptId);
    dragSelectionRef.current = initialSelection;
    setSelectedIds(initialSelection);
  };
  
  const handleDragEnter = (promptId: string) => {
    if (!isDragging || !dragStartId || !batchSelectMode) return;
    
    // 找到起始卡片和当前卡片的索引
    const startIndex = prompts.findIndex(p => p.meta.id === dragStartId);
    const currentIndex = prompts.findIndex(p => p.meta.id === promptId);
    
    if (startIndex === -1 || currentIndex === -1) return;
    
    // 计算范围（支持向上和向下滑动）
    const minIndex = Math.min(startIndex, currentIndex);
    const maxIndex = Math.max(startIndex, currentIndex);
    
    // 选中范围内的所有卡片
    const rangeSelection = new Set(selectedIds);
    for (let i = minIndex; i <= maxIndex; i++) {
      rangeSelection.add(prompts[i].meta.id);
    }
    
    dragSelectionRef.current = rangeSelection;
    setSelectedIds(rangeSelection);
  };
  
  const handleDragEnd = () => {
    setIsDragging(false);
    setDragStartId(null);
    
    // 停止自动滚动
    if (autoScrollIntervalRef.current) {
      window.clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
  };
  
  // ========== 自动滚动处理函数 (Auto Scroll Handlers) ==========
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !batchSelectMode) return;
    
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;
    
    const containerRect = scrollContainer.getBoundingClientRect();
    const mouseY = e.clientY;
    
    // 定义滚动触发区域（距离容器边缘的像素）
    const scrollZone = 100;
    const scrollSpeed = 10;
    
    // 清除之前的自动滚动
    if (autoScrollIntervalRef.current) {
      window.clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
    
    // 检查是否在顶部滚动区域
    if (mouseY < containerRect.top + scrollZone) {
      autoScrollIntervalRef.current = window.setInterval(() => {
        scrollContainer.scrollBy({ top: -scrollSpeed, behavior: 'auto' });
      }, 16); // ~60fps
    }
    // 检查是否在底部滚动区域
    else if (mouseY > containerRect.bottom - scrollZone) {
      autoScrollIntervalRef.current = window.setInterval(() => {
        scrollContainer.scrollBy({ top: scrollSpeed, behavior: 'auto' });
      }, 16); // ~60fps
    }
  };
  
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) {
      showToast("请先选择要删除的项目", 'warning');
      return;
    }
    
    const confirmed = await confirm({
      title: '批量永久删除',
      message: `确定要永久删除选中的 ${selectedIds.size} 个提示词吗？此操作无法撤销！`,
      confirmText: '永久删除',
      cancelText: '取消',
      type: 'danger',
    });
    
    if (!confirmed) return;
    
    const totalCount = selectedIds.size;
    const selectedIdsArray = Array.from(selectedIds);
    
    // 🚀 优化：对于大量删除（50+），跳过动画直接删除
    const skipAnimation = totalCount >= 50;
    
    if (skipAnimation) {
      // 大量删除：跳过动画，直接删除
      // 立即标记为删除中（不播放动画）
      setDeletingIds(new Set(selectedIds));
    } else {
      // 少量删除：分批显示删除动画（每批 10 个）
      const batchSize = 10;
      const batches = [];
      for (let i = 0; i < selectedIdsArray.length; i += batchSize) {
        batches.push(selectedIdsArray.slice(i, i + batchSize));
      }
      
      // 分批添加删除动画
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        setDeletingIds(prev => {
          const next = new Set(prev);
          batch.forEach(id => next.add(id));
          return next;
        });
        
        // 每批之间间隔 50ms，让动画更流畅
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      // 🚀 优化：只等待 300ms（而不是 600ms），让删除更快开始
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    try {
      // 使用批量删除 API（如果适配器支持）
      if ('batchDeletePrompts' in adapter && typeof adapter.batchDeletePrompts === 'function') {
        const promptPaths: string[] = [];
        selectedIds.forEach(id => {
          const prompt = state.fileSystem?.allPrompts.get(id);
          if (prompt) {
            promptPaths.push(prompt.path);
          }
        });
        
        const results = await (adapter as any).batchDeletePrompts(promptPaths, true);
        
        // 🚀 优化：乐观更新 - 先更新 UI，后台刷新
        // 立即从内存中移除已删除的提示词
        selectedIds.forEach(id => {
          dispatch({ type: 'DELETE_PROMPT', payload: id });
        });
        
        // 后台刷新 vault（确保与磁盘同步）
        refreshVault().catch(err => console.error('Background vault refresh failed:', err));
        
        const successCount = results.success.length;
        const failCount = results.failed.length;
        
        // 根据结果显示不同的提示
        if (failCount === 0) {
          showToast(`✅ 已永久删除 ${successCount} 个提示词`, 'success');
        } else if (successCount === 0) {
          showToast("❌ 批量删除失败", 'error');
        } else {
          showToast(`⚠️ 已删除 ${successCount} 个，${failCount} 个失败`, 'warning');
        }
      } else {
        // 回退到逐个删除（捕获单个删除失败）
        let successCount = 0;
        let failCount = 0;
        
        const deletePromises = Array.from(selectedIds).map(async (id) => {
          try {
            const prompt = state.fileSystem?.allPrompts.get(id);
            if (prompt) {
              await adapter.deletePrompt(prompt.path, true);
              successCount++;
            }
          } catch (error) {
            // 单个删除失败不抛出错误，继续删除其他项
            failCount++;
          }
        });
        
        await Promise.all(deletePromises);
        
        // 🚀 优化：乐观更新
        selectedIds.forEach(id => {
          dispatch({ type: 'DELETE_PROMPT', payload: id });
        });
        
        // 后台刷新
        refreshVault().catch(err => console.error('Background vault refresh failed:', err));
        
        // 根据结果显示不同的提示
        if (failCount === 0) {
          showToast(`✅ 已永久删除 ${successCount} 个提示词`, 'success');
        } else if (successCount === 0) {
          showToast("❌ 批量删除失败", 'error');
        } else {
          showToast(`⚠️ 已删除 ${successCount} 个，${failCount} 个失败`, 'warning');
        }
      }
      
      // 清空选择
      setSelectedIds(new Set());
      setBatchSelectMode(false);
    } catch (error) {
      showToast("❌ 批量删除失败", 'error');
      // 即使失败也刷新，确保状态同步
      await refreshVault();
    } finally {
      // 清除删除动画状态
      setDeletingIds(prev => {
        const next = new Set(prev);
        selectedIds.forEach(id => next.delete(id));
        return next;
      });
    }
  };
  
  // 退出批量选择模式时清空选择
  useEffect(() => {
    if (!batchSelectMode) {
      setSelectedIds(new Set());
      setIsDragging(false);
      setDragStartId(null);
    }
  }, [batchSelectMode]);
  
  // 监听全局 mouseup 事件，结束拖拽选择
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleDragEnd();
      }
    };
    
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging]);
  
  // 监听全局 mousemove 事件，处理自动滚动
  useEffect(() => {
    if (isDragging && batchSelectMode) {
      document.addEventListener('mousemove', handleMouseMove);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        // 清理自动滚动定时器
        if (autoScrollIntervalRef.current) {
          window.clearInterval(autoScrollIntervalRef.current);
          autoScrollIntervalRef.current = null;
        }
      };
    }
  }, [isDragging, batchSelectMode]);

  const handleAddPrompt = async () => {
    if (!newPrompt.title || !newPrompt.content) {
      showToast("请填写标题和内容", 'warning');
      return;
    }

    try {
      // 找到分类路径
      let categoryPath = '';
      const findCategoryPath = (nodes: any[], name: string): string | null => {
        for (const node of nodes) {
          if (node.name === name) return node.path;
          if (node.children && node.children.length > 0) {
            const found = findCategoryPath(node.children, name);
            if (found) return found;
          }
        }
        return null;
      };

      if (newPrompt.category) {
        if (state.fileSystem?.categories) {
          categoryPath = findCategoryPath(state.fileSystem.categories, newPrompt.category) || '';
        }

        if (!categoryPath) {
          showToast("找不到指定的分类", 'error');
          return;
        }
      } else {
        // 公共（根目录）
        categoryPath = state.fileSystem?.root || '';
        if (!categoryPath) {
          showToast('尚未加载 Vault，无法创建', 'warning');
          return;
        }
      }

      const normalizeTagKey = (t: string) => t.trim().toLowerCase();
      const dedupeTags = (arr: string[]) => {
        const seen = new Set<string>();
        const out: string[] = [];
        for (const raw of arr) {
          const v = (raw || '').trim();
          if (!v) continue;
          const key = normalizeTagKey(v);
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(v);
        }
        return out;
      };

      // 准备标签(分类标签 + 用户标签 + 任务智能标签)
      const userTags = newPrompt.tags ? newPrompt.tags.split(',').map(t => t.trim()).filter(t => t) : [];
      const taskTags: string[] = [];
      
      // 为任务生成智能标签
      if (newPrompt.type === 'TASK') {
        taskTags.push('任务');
        if (newPrompt.recurrence?.enabled) {
          // 重复任务标签
          const recurrenceTag = generateRecurrenceTag(newPrompt.recurrence);
          if (recurrenceTag) taskTags.push(recurrenceTag);
        } else if (newPrompt.scheduledTime) {
          // 一次性任务标签
          const timeTag = generateScheduledTimeTag(newPrompt.scheduledTime);
          if (timeTag) taskTags.push(timeTag);
        }
      }
      
      const rawTags = [...(newPrompt.category ? [newPrompt.category] : []), ...taskTags, ...userTags];
      const allTags = dedupeTags(rawTags);

      // 创建提示词时直接传递 type 和 scheduled_time
      const created = await createPrompt(categoryPath, newPrompt.title, {
        type: newPrompt.type,
        scheduled_time: newPrompt.type === 'TASK' && !newPrompt.recurrence?.enabled && newPrompt.scheduledTime 
          ? new Date(newPrompt.scheduledTime).toISOString() 
          : undefined,
      });

      
      const updated = {
        ...created,
        content: newPrompt.content,
        meta: {
          ...created.meta,
          tags: allTags,
          category: newPrompt.category,
          category_path: categoryPath,
          recurrence: newPrompt.type === 'TASK' && newPrompt.recurrence?.enabled ? newPrompt.recurrence : undefined,
        }
      };
      await savePrompt(updated);
      triggerAction('create_card');

      setNewPrompt({ title: '', content: '', category: '', tags: '', type: 'NOTE', scheduledTime: '', recurrence: undefined });
      clearNewPromptDraft();
      // 创建成功：直接关闭，不走 persist（否则可能把旧值误写回草稿）
      setNewPromptOverlayOpen(false);
      showToast("已创建新提示词", 'success');
    } catch (error) {
      showToast('创建失败: ' + (error as Error).message, 'error');
    }
  };

  // 现在使用全局 EditorOverlay 系统，不再需要本地编辑页面渲染
  // if (editingPromptId) {
  //   return <EditorPage promptId={editingPromptId} onClose={() => setEditingPromptId(null)} />;
  // }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-transparent">
      {/* Top Navigation Bar */}
      <div 
        className="h-16 flex items-center justify-between px-6 border-b border-border flex-shrink-0 bg-background/50 backdrop-blur-md z-10 sticky top-0"
        data-tauri-drag-region={false}
        onPointerDown={handleTitleBarPointerDown}
        onPointerMove={handleTitleBarPointerMove}
        onPointerUp={handleTitleBarPointerUp}
        onPointerCancel={handleTitleBarPointerUp}
        onDoubleClick={handleTitleBarDoubleClick}
      >
        {/* 左侧：侧边栏切换按钮 */}
        <div className="flex items-center">
          <button 
            onClick={() => {
              dispatch({ type: 'TOGGLE_SIDEBAR' });
            }}
            data-tauri-drag-region={false}
            className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            {uiState.sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
        </div>

        {/* 中间：搜索框 */}
        <div className="flex-1 max-w-lg mx-8">
          <div className={`
            relative flex items-center rounded-lg transition-all duration-200
            ${isSearchFocused 
              ? 'bg-accent ring-2 ring-primary/50' 
              : 'bg-input hover:bg-accent'
            }
          `}>
            <Search 
              size={16} 
              className="ml-3 text-muted-foreground transition-colors" 
            />
            <input
              type="text"
              placeholder="搜索提示词..."
              value={searchQuery}
              onChange={(e) => {
                dispatch({ type: 'SET_SEARCH', payload: e.target.value });
              }}
              onFocus={() => {
                setIsSearchFocused(true);
                triggerAction('search');
              }}
              onBlur={() => setIsSearchFocused(false)}
              data-tauri-drag-region={false}
              className="flex-1 px-3 py-2 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button
                onClick={() => dispatch({ type: 'SET_SEARCH', payload: '' })}
                data-tauri-drag-region={false}
                className="mr-2 p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                title="清除搜索"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* 右侧：窗口控制按钮 */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleMinimize}
            data-tauri-drag-region={false}
            className="p-2 rounded-lg transition-colors hover:bg-accent text-muted-foreground hover:text-foreground"
            title="最小化"
          >
            <Minus size={16} />
          </button>
          
          <button
            onClick={handleMaximize}
            data-tauri-drag-region={false}
            className="p-2 rounded-lg transition-colors hover:bg-accent text-muted-foreground hover:text-foreground"
            title={isMaximized ? "还原" : "最大化"}
          >
            {isMaximized ? <Maximize2 size={14} /> : <Square size={14} />}
          </button>
          
          <button
            onClick={handleClose}
            data-tauri-drag-region={false}
            className="p-2 rounded-lg transition-colors hover:bg-red-500 hover:text-white text-muted-foreground"
            title="关闭"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div
        className="flex-1 overflow-hidden"
        onClick={(e: React.MouseEvent) => {
          // 🔥 点击空白处取消选中
          const target = e.target as HTMLElement;
          // 如果点击的不是卡片或卡片内的元素，则取消选中
          if (!target.closest('[data-card-wrapper]')) {
            setFocusedIndex(-1);
            setIsKeyboardNavigation(false);
            // 🔥 点击空白处退出 Focus Mode
            if (focusModeActive) {
              exitFocusMode();
            }
          }
        }}
      >
      <ElasticScroll
        ref={elasticScrollRef}
        className="h-full bg-background/30"
        onContextMenu={(e) => {
          e.preventDefault();
          setContentContextMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        <div className={`max-w-6xl mx-auto px-6 py-8 pb-20 relative no-scrollbar transition-opacity duration-150 ${isSwitchingList ? 'opacity-70' : 'opacity-100'}`}>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight animate-fade-in mb-6">
            我的内容库
          </h1>

          {/* Content Toolbar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{prompts.length}</span> 个项目
              {selectedCategory === 'trash' && batchSelectMode && (
                <span className="text-primary">
                  · 已选择 {selectedIds.size} 个
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* 回收站批量操作按钮 */}
              {selectedCategory === 'trash' && (
                <>
                  {!batchSelectMode ? (
                    <Button
                      onClick={() => setBatchSelectMode(true)}
                      className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors shadow-sm bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700"
                    >
                      <Square size={16} /> 批量选择
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={selectAll}
                        className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors shadow-sm bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700"
                      >
                        全选
                      </Button>
                      <Button
                        onClick={deselectAll}
                        className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors shadow-sm bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700"
                      >
                        取消选择
                      </Button>
                      <Button
                        onClick={handleBatchDelete}
                        disabled={selectedIds.size === 0}
                        className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors shadow-sm bg-red-500 hover:bg-red-600 text-white border border-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={16} /> 永久删除 ({selectedIds.size})
                      </Button>
                      <Button
                        onClick={() => setBatchSelectMode(false)}
                        className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors shadow-sm bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700"
                      >
                        <X size={16} /> 退出
                      </Button>
                    </>
                  )}
                </>
              )}
              
              {/* 普通视图按钮 */}
              {selectedCategory !== 'trash' && (
                <>
                  {!exportSelectMode ? (
                    <>
                      <Button
                        id="import-button"
                        onClick={() => {
                          setImportDialogMounted(true);
                          setShowImportDialog(true);
                        }}
                        className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors shadow-sm bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700"
                      >
                        <Upload size={16} /> 导入
                      </Button>
                      <Button
                        id="export-button"
                        onClick={() => {
                          setExportSelectMode(true);
                          setExportSelectedIds(new Set());
                        }}
                        className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors shadow-sm bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700"
                      >
                        <Upload size={16} className="rotate-180" /> 导出
                      </Button>
                      <Button
                        onClick={() => openNewPrompt()}
                        className="btn-create px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                        id="new-prompt-button"
                      >
                        <Plus size={16} /> 新建
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={selectAllForExport}
                        className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors shadow-sm bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700"
                      >
                        全选
                      </Button>
                      <Button
                        onClick={deselectAllForExport}
                        className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors shadow-sm bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700"
                      >
                        取消选择
                      </Button>
                      <Button
                        onClick={handleExportSelected}
                        disabled={exportSelectedIds.size === 0}
                        className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors shadow-sm bg-blue-500 hover:bg-blue-600 text-white border border-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Upload size={16} className="rotate-180" /> 导出 ({exportSelectedIds.size})
                      </Button>
                      <Button
                        onClick={() => {
                          setExportSelectMode(false);
                          setExportSelectedIds(new Set());
                        }}
                        className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors shadow-sm bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700"
                      >
                        <X size={16} /> 退出
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Focus Mode 背景覆盖层 - 点击退出焦点模式 */}
          {focusModeActive && (
            <div 
              className="fixed inset-0 z-40 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                exitFocusMode();
              }}
              style={{ background: 'transparent' }}
            />
          )}

          {/* Cards Grid */}
          <div 
            className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${focusModeActive ? 'focus-mode-active' : ''}`}
            style={enableVirtualScroll ? {
              height: `${totalHeight}px`,
              position: 'relative',
            } : undefined}
          >
            <div
              style={enableVirtualScroll ? {
                transform: `translateY(${offsetY}px)`,
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
              } : undefined}
              className={enableVirtualScroll ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'contents'}
            >
            {prompts.map((prompt, index) => {
              const isInTrash = selectedCategory === 'trash';
              const trashItemName = isInTrash ? getTrashItemName(prompt.path) : null;
              const visitCount = trashItemName ? (trashCounts[trashItemName] ?? 0) : 0;
              const isDeleting = deletingIds.has(prompt.meta.id);
              const isFocused = index === focusedIndex;
              // 🔥 只在键盘导航时显示选中样式
              const showFocusRing = isFocused && isKeyboardNavigation;
              const isCardFocused = focusModeActive && focusedCardId === prompt.meta.id;
              
              const isTask = prompt.meta.type === 'TASK';
              const isSelected = selectedIds.has(prompt.meta.id);
              const isExportSelected = exportSelectedIds.has(prompt.meta.id);
              
              return (
              <div
                key={`${prompt.meta.id}-${prompt.meta.is_pinned}-${prompt.meta.updated_at}`}
                ref={(el) => (cardRefs.current[index] = el)}
                tabIndex={-1}
                data-card-wrapper="true"
                onFocus={() => {
                  // 🔥 鼠标点击不触发选中样式
                  // 只有键盘导航才会设置 isKeyboardNavigation
                }}
                onClick={(e) => {
                  // 🔥 鼠标点击时取消键盘导航模式
                  e.stopPropagation();
                  setIsKeyboardNavigation(false);
                  setFocusedIndex(-1);
                }}
                className={`outline-none transition-all duration-200 ${showFocusRing ? 'ring-2 ring-primary rounded-xl shadow-lg' : ''} ${isSelected ? 'ring-2 ring-primary rounded-xl' : ''} ${isExportSelected ? 'ring-2 ring-blue-500 rounded-xl' : ''}`}
              >
              <SpotlightCard
                onClick={(e) => {
                  // 如果是拖拽选择，不触发点击事件
                  if (isDragging) {
                    e.preventDefault();
                    return;
                  }
                  
                  // 导出选择模式下，点击卡片切换选中状态
                  if (exportSelectMode && !isInTrash) {
                    toggleExportSelect(prompt.meta.id);
                  }
                  // 批量选择模式下，点击卡片切换选中状态
                  else if (batchSelectMode && isInTrash) {
                    toggleBatchSelect(prompt.meta.id);
                  } else if (!isInTrash) {
                    handleCardClick(prompt.meta.id);
                  }
                }}
                className={`p-5 flex flex-col h-64 relative overflow-hidden simple-card ${isCardFocused ? 'card-focused' : ''} ${isInTrash && !batchSelectMode ? 'cursor-default opacity-75' : 'cursor-pointer'} ${isTask ? 'task-card border-rose-500/30' : ''} ${isDragging ? 'select-none' : ''}`}
              >
                {/* 任务卡片扫描线效果 */}
                {isTask && (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="scan-line" />
                  </div>
                )}
                
                {/* 批量选择复选框 */}
                {batchSelectMode && isInTrash && (
                  <div className="absolute top-3 left-3 z-20">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBatchSelect(prompt.meta.id);
                      }}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-primary border-primary'
                          : 'bg-background border-border hover:border-primary'
                      }`}
                    >
                      {isSelected && (
                        <svg
                          className="w-3 h-3 text-primary-foreground"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path d="M5 13l4 4L19 7"></path>
                        </svg>
                      )}
                    </div>
                  </div>
                )}
                
                {/* 任务卡片心跳指示点 */}
                {isTask && prompt.meta.scheduled_time && (
                  (() => {
                    const isExpiredOrUrgent = new Date(prompt.meta.scheduled_time).getTime() - Date.now() < 3600000;
                    return isExpiredOrUrgent ? (
                      <div className="absolute top-3 right-3 z-10">
                        <div className="relative">
                          <div className="absolute inset-0 bg-rose-500 rounded-full animate-ping opacity-75" />
                          <div className="relative w-2.5 h-2.5 bg-rose-500 rounded-full pulse-red" />
                        </div>
                      </div>
                    ) : null;
                  })()
                )}
                
                <div 
                  id={`prompt-card-${prompt.meta.id}`} 
                  className="w-full h-full flex flex-col" 
                  style={isDeleting ? { opacity: 0 } : undefined}
                  onMouseDown={(e) => {
                    // 批量选择模式下，按住鼠标开始拖拽选择
                    if (batchSelectMode && isInTrash) {
                      e.preventDefault();
                      handleDragStart(prompt.meta.id);
                    }
                  }}
                  onMouseEnter={() => {
                    // 拖拽过程中，鼠标进入卡片时选中
                    if (isDragging && batchSelectMode && isInTrash) {
                      handleDragEnter(prompt.meta.id);
                    }
                  }}
                >
                {/* Card Header */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 pr-4 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      {(() => {
                        // 任务卡片使用时钟图标
                        if (isTask) {
                          return (
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-rose-500/20 to-red-500/20 border border-rose-500/30"
                            >
                              <Clock size={18} className="text-rose-400" />
                            </div>
                          );
                        }
                        
                        const Icon = getSmartIcon(prompt.meta.title, prompt.meta.tags);
                        const gradient = getIconGradientConfig(prompt.meta.tags);
                        return (
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                              backgroundImage: gradient.backgroundImage,
                              border: gradient.border,
                              boxShadow: gradient.boxShadow,
                            }}
                            title={(prompt.meta.tags || []).join(', ')}
                          >
                            <Icon size={18} style={{ color: gradient.iconColor }} />
                          </div>
                        );
                      })()}
                      <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors" title={getTaskTitleWithRepeatIndicator(prompt)}>{getTaskTitleWithRepeatIndicator(prompt)}</h3>
                      {isInTrash && (
                        <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 bg-muted/50">
                          {visitCount}/{trashThreshold}
                        </span>
                      )}
                    </div>
                    {/* 任务卡片不显示标签，普通卡片显示标签 */}
                    {!isTask && (
                    <div className="flex flex-wrap gap-1.5">
                      {prompt.meta.tags.map(tag => (
                        <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded border ${getTagColor(tag)}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                    )}
                  </div>
                  {/* 卡片操作按钮 */}
                  <div className="flex items-center gap-1">
                    {/* 置顶按钮 - 所有卡片都显示（回收站除外） */}
                    {!isInTrash && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePin(prompt.meta.id);
                        }}
                        className={`p-1.5 rounded-lg transition-all ${
                          prompt.meta.is_pinned === true
                            ? 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20' 
                            : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                        }`}
                        title={prompt.meta.is_pinned === true ? "取消置顶" : "置顶"}
                      >
                        {prompt.meta.is_pinned === true ? (
                          <Pin
                            size={14}
                            fill="currentColor"
                            strokeWidth={2.5}
                          />
                        ) : (
                          <PinOff
                            size={14}
                            strokeWidth={2}
                          />
                        )}
                      </button>
                    )}
                    {/* 收藏按钮 - 任务卡片不显示 */}
                    {!isInTrash && !isTask && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!prompt.meta.is_favorite) {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setBurstingId(prompt.meta.id);
                            setBurstAnchor({
                              id: prompt.meta.id,
                              x: rect.left + rect.width / 2,
                              y: rect.top + rect.height / 2,
                            });
                            if (burstTimerRef.current) {
                              window.clearTimeout(burstTimerRef.current);
                            }
                            burstTimerRef.current = window.setTimeout(() => {
                              setBurstingId((cur) => (cur === prompt.meta.id ? null : cur));
                              setBurstAnchor((cur) => (cur?.id === prompt.meta.id ? null : cur));
                              burstTimerRef.current = null;
                            }, 600);
                          }
                          toggleFavorite(prompt.meta.id);
                        }}
                        className={`p-1.5 rounded-lg hover:bg-accent transition-colors ${prompt.meta.is_favorite ? 'text-yellow-400' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        <Star
                          size={16}
                          fill={prompt.meta.is_favorite ? "currentColor" : "none"}
                          className={burstingId === prompt.meta.id ? 'star-bounce' : undefined}
                        />
                      </button>
                    )}
                  </div>
                  {isDeleting && (
                    <DisintegrateOverlay
                      onComplete={() => {
                      }}
                    />
                  )}
                </div>

                {/* Card Content Preview - 任务卡片不显示内容 */}
                {!isTask && (
                <div className="flex-1 bg-muted/40 rounded-lg p-2.5 text-xs text-muted-foreground font-mono overflow-y-auto border-0 dark:border dark:border-border mb-3 whitespace-pre-wrap leading-relaxed no-scrollbar">
                  {prompt.content}
                </div>
                )}
                
                {/* 任务卡片的计时器/重复标签区域 */}
                {isTask && (
                  <div className="flex-1 flex flex-col justify-center">
                    {/* 重复任务：显示标签 + 倒计时（回收站中停止计时） */}
                    {prompt.meta.recurrence?.enabled && !isInTrash ? (
                      <div className="flex flex-col gap-2">
                        {/* 重复标签 - 简洁文字，无图标 */}
                        <div className="text-center">
                          <span className="text-xs font-medium text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                            {prompt.meta.recurrence.type === 'interval'
                              ? generateRecurrenceTag(prompt.meta.recurrence)
                              : `${generateRecurrenceTag(prompt.meta.recurrence)} · ${prompt.meta.recurrence.time}`}
                          </span>
                        </div>
                        {/* 使用原有的 ChronoCard 显示倒计时 */}
                        <ChronoCard
                          key={`chrono-${prompt.meta.id}-${prompt.meta.recurrence.type === 'interval' ? prompt.meta.recurrence.intervalMinutes : 'other'}-${prompt.meta.last_notified || prompt.meta.created_at}`}
                          targetDate={getNextTriggerTime(
                            prompt.meta.recurrence,
                            prompt.meta.last_notified ?? prompt.meta.created_at
                          )}
                          startDate={
                            prompt.meta.recurrence.type === 'interval'
                              ? (prompt.meta.last_notified ?? prompt.meta.created_at)
                              : ['daily', 'weekly', 'monthly'].includes(prompt.meta.recurrence.type)
                              ? getRecurringCycleStart(prompt.meta.recurrence)
                              : prompt.meta.created_at
                          }
                          invertProgress={prompt.meta.recurrence.type === 'interval'}
                          onExpire={async () => {
                            if (!prompt.meta.recurrence?.enabled || prompt.meta.recurrence.type !== 'interval') return;
                            try {
                              await fetch(`${apiBaseUrl}/api/interval-tasks/${prompt.meta.id}/notify`, { method: 'POST' });
                              await refreshPendingTasks();
                            } catch (error) {
                              console.error('[Countdown] Failed to notify interval task:', error);
                            }
                          }}
                        />
                      </div>
                    ) : prompt.meta.scheduled_time && !isInTrash ? (
                      /* 一次性任务：显示倒计时 */
                      <ChronoCard
                        key={`chrono-${prompt.meta.id}-${prompt.meta.scheduled_time}`}
                        targetDate={prompt.meta.scheduled_time}
                        startDate={prompt.meta.created_at}
                        isUrgent={new Date(prompt.meta.scheduled_time).getTime() - Date.now() < 3600000}
                      />
                    ) : isInTrash ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/60 border border-border text-muted-foreground">
                        <Clock size={12} />
                        <span className="text-[10px] font-mono">已停止计时</span>
                      </div>
                    ) : (
                      /* 没有设置时间的任务 */
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/60 border border-border text-muted-foreground">
                        <Clock size={12} />
                        <span className="text-[10px] font-mono">未设置时间</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <span className="text-[10px] text-muted-foreground font-mono">更新于 {new Date(prompt.meta.updated_at).toLocaleDateString()}</span>
                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    {isInTrash ? (
                      <>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleRestore(prompt.meta.id); }}
                          className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 text-emerald-300 px-2 py-1 rounded text-xs font-medium transition-all active:scale-95"
                          title="恢复"
                        >
                          <RotateCcw size={12} /> 恢复
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(prompt.meta.id); }}
                          className="p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-400 rounded-lg transition-colors"
                          title="永久删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(prompt.meta.id); }}
                          className="p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-400 rounded-lg transition-colors"
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleCopy(prompt.content); }}
                          className="flex items-center gap-1 bg-accent border border-border hover:bg-accent/80 px-2 py-1 rounded text-xs font-medium text-foreground transition-all active:scale-95"
                        >
                          <Copy size={12} /> 复制
                        </button>
                      </>
                    )}
                  </div>
                </div>
                </div>
                {isDeleting && (
                  <DisintegrateOverlay
                    onComplete={() => {
                    }}
                  />
                )}
              </SpotlightCard>
              </div>
            )})}
            </div>
          </div>

          {/* Empty State */}
          {prompts.length === 0 && (
            <EmptyState
              title="这里还是空的"
              description={
                searchQuery || selectedCategory
                  ? '没有找到相关内容，试试清空筛选或新建一个提示词。'
                  : '创建你的第一条提示词，让灵感开始沉淀。'
              }
              primaryActionLabel="新建提示词"
              onPrimaryAction={() => openNewPrompt(selectedCategory && selectedCategory !== 'favorites' && selectedCategory !== 'trash' ? selectedCategory : null)}
            />
          )}
        </div>
      </ElasticScroll>
      </div>

      {/* Add New Prompt Modal */}
      {newPromptOverlayMounted && (
        <NewPromptOverlay
          isOpen={newPromptOverlayOpen}
          originId="new-prompt-button"
          onRequestClose={requestCloseNewPrompt}
          onClosed={() => {
            dispatch({ type: 'CLOSE_NEW_PROMPT_MODAL' });
            setNewPromptOverlayMounted(false);
          }}
        >
          <div className="bg-background border border-border rounded-2xl shadow-2xl w-full h-full flex flex-col overflow-hidden backdrop-blur-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 create-soft-bg rounded-lg flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="create-accent-text">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="12" y1="18" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="9" y1="15" x2="15" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-foreground">新建页面</h2>
              </div>
              <Button
                onClick={requestCloseNewPrompt}
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground hover:bg-accent"
                aria-label="关闭"
              >
                <X size={20} />
              </Button>
            </div>

            {/* Content Area - 可滚动 */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* 可滚动的表单区域 */}
              <div className="flex-1 overflow-y-auto">
                <div className="px-6 py-6 space-y-6">
                {/* 标题 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">标题</label>
                  <input 
                    type="text" 
                    placeholder="输入提示词标题..." 
                    className="w-full px-4 py-3 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 text-foreground placeholder:text-muted-foreground transition-all"
                    value={newPrompt.title}
                    onChange={(e) => setNewPrompt({...newPrompt, title: e.target.value})}
                    autoFocus
                  />
                </div>

                {/* 类型选择 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">类型</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewPrompt({...newPrompt, type: 'NOTE', recurrence: undefined, scheduledTime: ''})}
                      className={`flex-1 px-4 py-2 rounded-lg border transition-all flex items-center justify-center gap-2 ${
                        newPrompt.type === 'NOTE'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-input border-border hover:bg-accent text-foreground'
                      }`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                        <polyline points="14,2 14,8 20,8"/>
                      </svg>
                      提示词
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPrompt({...newPrompt, type: 'TASK'})}
                      className={`flex-1 px-4 py-2 rounded-lg border transition-all flex items-center justify-center gap-2 ${
                        newPrompt.type === 'TASK'
                          ? 'bg-rose-500 text-white border-rose-500'
                          : 'bg-input border-border hover:bg-accent text-foreground'
                      }`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12,6 12,12 16,14"/>
                      </svg>
                      任务
                    </button>
                  </div>
                </div>

                {/* 任务模式选择 - 一次性任务 vs 重复任务 */}
                {newPrompt.type === 'TASK' && (
                  <div className="space-y-4">
                    {/* 模式切换 */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">任务模式</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setNewPrompt({...newPrompt, type: 'TASK', recurrence: undefined})}
                          className={`flex-1 px-4 py-2 rounded-lg border transition-all flex items-center justify-center gap-2 ${
                            !newPrompt.recurrence?.enabled
                              ? 'bg-rose-500 text-white border-rose-500'
                              : 'bg-input border-border hover:bg-accent text-foreground'
                          }`}
                        >
                          <Clock size={16} />
                          一次性任务
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewPrompt({
                            ...newPrompt,
                            type: 'TASK', // 🔥 修复：选择重复任务时自动设置 type 为 TASK
                            scheduledTime: '',
                            recurrence: { type: 'daily', time: '09:00', enabled: true }
                          })}
                          className={`flex-1 px-4 py-2 rounded-lg border transition-all flex items-center justify-center gap-2 ${
                            newPrompt.recurrence?.enabled
                              ? 'bg-rose-500 text-white border-rose-500'
                              : 'bg-input border-border hover:bg-accent text-foreground'
                          }`}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 2.1l4 4-4 4"/>
                            <path d="M3 12.2v-2a4 4 0 0 1 4-4h12.8M7 21.9l-4-4 4-4"/>
                            <path d="M21 11.8v2a4 4 0 0 1-4 4H4.2"/>
                          </svg>
                          重复任务
                        </button>
                      </div>
                    </div>

                    {/* 一次性任务：计划时间 */}
                    {!newPrompt.recurrence?.enabled && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">截止时间</label>
                        <div 
                          className="flex items-center gap-3 w-full px-4 py-3 bg-input border border-border rounded-lg hover:bg-accent/50 hover:border-primary/30 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 text-foreground transition-all cursor-pointer"
                          onClick={() => {
                            const input = document.getElementById('new-task-datetime') as HTMLInputElement;
                            input?.showPicker?.();
                          }}
                        >
                          <Clock size={18} className="text-rose-400 flex-shrink-0" />
                          <input
                            id="new-task-datetime"
                            type="datetime-local"
                            className="flex-1 bg-transparent border-none outline-none text-foreground pointer-events-none"
                            value={newPrompt.scheduledTime}
                            onChange={(e) => {
                              setNewPrompt({ ...newPrompt, scheduledTime: e.target.value });
                            }}
                            tabIndex={-1}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">设置任务的截止日期，到期后会收到提醒</p>
                      </div>
                    )}

                    {/* 重复任务：重复配置 */}
                    {newPrompt.recurrence?.enabled && (
                      <div className="space-y-2">
                        <RecurrenceSelector
                          value={newPrompt.recurrence}
                          onChange={(config) => setNewPrompt({...newPrompt, recurrence: config, scheduledTime: ''})}
                        />
                        <p className="text-xs text-muted-foreground">按设定的周期重复提醒，适合日常习惯或定期任务</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 分类位置 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">分类位置</label>
                  <div className="relative" ref={categoryPopoverRef}>
                    <Button
                      onClick={() => setIsCategoryOpen((v) => !v)}
                      className="w-full flex items-center justify-between bg-input px-4 py-3 rounded-lg border border-border hover:bg-accent focus:outline-none transition-all text-foreground group"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {newPrompt.category ? (
                          <>
                            <FolderOpen size={16} className="notion-sidebar-folder active flex-shrink-0" />
                            <span className="text-foreground truncate font-medium">{newPrompt.category}</span>
                          </>
                        ) : (
                          <>
                            <Folder size={16} className="notion-sidebar-folder flex-shrink-0 opacity-70" />
                            <span className="text-muted-foreground">公共（全部可见）</span>
                          </>
                        )}
                      </div>
                      <div className={`transition-transform duration-200 ${isCategoryOpen ? 'rotate-180' : ''}`}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-muted-foreground">
                          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </Button>

                    {isCategoryOpen && (
                      <div className="absolute left-0 right-0 top-full mt-2 z-[60] rounded-xl border border-border bg-background backdrop-blur-xl shadow-2xl overflow-hidden animate-fade-in">
                        {/* 搜索框 */}
                        <div className="p-3 border-b border-border bg-background">
                          <div className="relative">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                              <path d="M7.333 12.667A5.333 5.333 0 1 0 7.333 2a5.333 5.333 0 0 0 0 10.667ZM14 14l-2.9-2.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <input
                              value={categoryQuery}
                              onChange={(e) => setCategoryQuery(e.target.value)}
                              placeholder="搜索分类..."
                              className="w-full bg-input pl-9 pr-3 py-2 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground text-sm"
                              autoFocus
                            />
                          </div>
                        </div>

                        {/* 分类列表 */}
                        <div className="max-h-60 overflow-y-auto">
                          {/* 公共（无分类） */}
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              setNewPrompt({ ...newPrompt, category: '' });
                              setIsCategoryOpen(false);
                              setCategoryQuery('');
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setNewPrompt({ ...newPrompt, category: '' });
                                setIsCategoryOpen(false);
                                setCategoryQuery('');
                              }
                            }}
                            className={`w-full text-left py-2.5 text-sm transition-all duration-200 flex items-center group relative cursor-pointer ${
                              !newPrompt.category
                                ? 'bg-accent text-foreground shadow-sm'
                                : 'text-foreground hover:bg-accent hover:shadow-sm'
                            }`}
                            style={{ paddingLeft: '16px', paddingRight: '8px' }}
                          >
                            <div className={`absolute left-0 top-0 bottom-0 w-1 create-accent-bar transition-all duration-200 ${
                              !newPrompt.category
                                ? 'opacity-100'
                                : 'opacity-0 group-hover:opacity-100'
                            }`} />
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                <Folder size={16} className={`flex-shrink-0 ${!newPrompt.category ? 'notion-sidebar-folder active' : 'notion-sidebar-folder'}`} />
                                <span className="truncate font-medium group-hover:font-semibold transition-all">公共（全部可见）</span>
                              </div>
                            </div>
                          </div>

                          {filteredCategories.length === 0 ? (
                            <div className="px-4 py-6 text-center">
                              <div className="text-muted-foreground text-sm">没有匹配的分类</div>
                              <div className="text-muted-foreground text-xs mt-1">尝试使用不同的关键词</div>
                            </div>
                          ) : (
                            filteredCategories.map((cat) => {
                              // 生成层级缩进和引导线
                              const indent = cat.level * 16; // 每层级16px缩进
                              const prefix = cat.level > 0 ? '└ ' : '';
                              
                              return (
                                <div key={cat.path}>
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => {
                                      setNewPrompt({ ...newPrompt, category: cat.name });
                                      setIsCategoryOpen(false);
                                      setCategoryQuery('');
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setNewPrompt({ ...newPrompt, category: cat.name });
                                        setIsCategoryOpen(false);
                                        setCategoryQuery('');
                                      }
                                    }}
                                    className={`w-full text-left py-2.5 text-sm transition-all duration-200 flex items-center group relative cursor-pointer ${
                                      newPrompt.category === cat.name
                                        ? 'bg-accent text-foreground shadow-sm'
                                        : 'text-foreground hover:bg-accent hover:shadow-sm'
                                    }`}
                                    style={{ paddingLeft: `${16 + indent}px`, paddingRight: '8px' }}
                                  >
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 create-accent-bar transition-all duration-200 ${
                                      newPrompt.category === cat.name 
                                        ? 'opacity-100' 
                                        : 'opacity-0 group-hover:opacity-100'
                                    }`} />
                                    
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      {cat.level > 0 && (
                                        <span className="text-muted-foreground text-xs font-mono leading-none group-hover:text-foreground transition-colors">
                                          {prefix}
                                        </span>
                                      )}
                                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                        {cat.hasChildren ? (
                                          <FolderOpen
                                            size={16}
                                            className={`${
                                              newPrompt.category === cat.name
                                                ? 'notion-sidebar-folder active'
                                                : 'notion-sidebar-folder'
                                            } flex-shrink-0`}
                                          />
                                        ) : (
                                          <Folder
                                            size={16}
                                            className={`${
                                              newPrompt.category === cat.name
                                                ? 'notion-sidebar-folder active'
                                                : 'notion-sidebar-folder'
                                            } flex-shrink-0`}
                                          />
                                        )}
                                        <span className="truncate font-medium group-hover:font-semibold transition-all">{cat.name}</span>
                                      </div>
                                    </div>

                                    <Button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleStartCreateSubCategoryFromDropdown(cat.path);
                                      }}
                                      variant="ghost"
                                      size="icon"
                                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-accent"
                                      title="在此分类下新建"
                                      aria-label="在此分类下新建"
                                    >
                                      <Plus size={14} />
                                    </Button>
                                  </div>

                                  {dropdownCreatingParentPath === cat.path && (
                                    <div
                                      className="mx-4 my-1 px-3 py-2 rounded-lg bg-accent border border-border animate-fade-in"
                                      style={{ marginLeft: `${16 + indent + 16}px` }}
                                    >
                                      <input
                                        ref={dropdownNewCategoryInputRef}
                                        type="text"
                                        value={dropdownNewCategoryName}
                                        onChange={(e) => setDropdownNewCategoryName(e.target.value)}
                                        onKeyDown={handleDropdownNewCategoryKeyDown}
                                        onBlur={handleSubmitCreateSubCategoryFromDropdown}
                                        placeholder="输入子分类名称..."
                                        className="w-full bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm"
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 内容编辑区域 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">内容</label>
                  <textarea 
                    className="w-full min-h-[120px] resize-none focus:outline-none font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground bg-input border border-border rounded-lg p-4"
                    placeholder="输入提示词详细内容..."
                    value={newPrompt.content}
                    onChange={(e) => setNewPrompt({...newPrompt, content: e.target.value})}
                  ></textarea>
                </div>

                {/* 标签 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">标签</label>
                  <input 
                    type="text" 
                    className="w-full bg-input px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground text-sm"
                    placeholder="python, react... (用逗号分隔)"
                    value={newPrompt.tags}
                    onChange={(e) => setNewPrompt({...newPrompt, tags: e.target.value})}
                  />
                </div>
                </div>
              </div>

              {/* Bottom Actions - 固定在底部 */}
              <div className="px-6 py-4 border-t border-border bg-background flex items-center justify-end gap-3 flex-shrink-0">
                <Button
                  onClick={requestCloseNewPrompt}
                  variant="ghost"
                  className="text-muted-foreground hover:bg-accent"
                >
                  取消
                </Button>
                <Button
                  onClick={handleAddPrompt}
                  className="px-6 py-2 font-medium"
                  disabled={!newPrompt.title.trim()}
                >
                  创建
                </Button>
              </div>
            </div>
          </div>
        </NewPromptOverlay>
      )}

      {contentContextMenu &&
        createPortal(
          <>
            <div
              className="fixed z-[200000] bg-popover/95 backdrop-blur-xl border border-border rounded-lg shadow-2xl py-1 min-w-[160px]"
              style={{ left: contentContextMenu!.x, top: contentContextMenu!.y }}
            >
              <button
                onClick={() => {
                  const preselect =
                    selectedCategory && selectedCategory !== 'favorites' && selectedCategory !== 'trash'
                      ? selectedCategory
                      : undefined;
                  setContentContextMenu(null);
                  openNewPrompt(preselect);
                }}
                className="w-full px-3 py-2 text-sm text-foreground hover:bg-accent flex items-center gap-2 transition-colors"
              >
                <Plus size={14} />
                新建提示词
              </button>
            </div>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setContentContextMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContentContextMenu(null);
              }}
            />
          </>,
          document.body
        )}

      {burstAnchor && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            left: burstAnchor.x,
            top: burstAnchor.y,
            width: 0,
            height: 0,
            pointerEvents: 'none',
            zIndex: 1000001,
          }}
        >
          {fireworkParticles.map((p, idx) => (
            <span
              key={idx}
              className="firework-particle"
              style={{
                ['--tx' as any]: p.tx,
                ['--ty' as any]: p.ty,
                backgroundColor: p.color,
              }}
            />
          ))}
        </div>,
        document.body
      )}

      {/* Import Dialog */}
      {importDialogMounted && (
        <ImportPromptsDialog
          isOpen={showImportDialog}
          originId="import-button"
          onClose={() => setShowImportDialog(false)}
          onClosed={() => {
            setShowImportDialog(false);
            setImportDialogMounted(false);
          }}
          defaultCategoryPath={
            selectedCategory !== 'all' && 
            selectedCategory !== 'favorites' && 
            selectedCategory !== 'trash' && 
            selectedCategory !== null 
              ? selectedCategory 
              : undefined
          }
        />
      )}

      {/* Export Dialog */}
      {showExportDialog && (
        <ExportPromptsDialog
          isOpen={showExportDialog}
          originId="export-button"
          onClose={() => {
            setShowExportDialog(false);
            setExportConfig({});
          }}
          onClosed={() => {
            setShowExportDialog(false);
            setExportConfig({});
          }}
          preSelectedIds={exportConfig.preSelectedIds}
          categoryPath={exportConfig.categoryPath}
          preserveStructure={exportConfig.preserveStructure}
        />
      )}
    </div>
  );
}
