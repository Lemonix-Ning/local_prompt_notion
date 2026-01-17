/**
 * TaskEditorOverlay 组件
 * 任务专用编辑器 - 与提示词编辑器完全独立
 * 
 * 支持：
 * - 点击卡片放大打开
 * - 空格键放大打开（当卡片被选中时）
 * - ESC 关闭
 * - 放大/缩小按钮
 * - 双击内容区域进入专注模式
 * - 重复任务配置
 * - Ctrl+F 内容搜索
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useApp } from '../AppContext';
import { X, Clock, Trash2, Calendar, Maximize2, Minimize2, Repeat } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useCountdown } from '../hooks/useCountdown';
import { RecurrenceSelector } from './RecurrenceSelector';
import { ContentSearchBar, type SearchMatch } from './ContentSearchBar';
import { MarkdownRenderer } from './MarkdownRenderer';
import { getNextTriggerTime } from '../utils/recurrenceTag';
import type { RecurrenceConfig } from '../types';

interface TaskEditorOverlayProps {
  promptId: string;
  originCardId: string;
  onClose: () => void;
}

interface AnimationState {
  top: string | number;
  left: string | number;
  width: string | number;
  height: string | number;
  borderRadius: string;
  opacity: number;
  transform?: string;
  isOpen: boolean;
  backdropBlur?: number;
}

export function TaskEditorOverlay({ promptId, originCardId, onClose }: TaskEditorOverlayProps) {
  const { theme } = useTheme();
  const { state, savePrompt, deletePrompt } = useApp();
  const { showToast } = useToast();

  const [animationState, setAnimationState] = useState<AnimationState | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showRecurrenceDetails, setShowRecurrenceDetails] = useState(false); // 控制重复任务详情展开
  const [expandedByRecurrence, setExpandedByRecurrence] = useState(false); // 是否因重复任务而放大
  
  // 🔥 搜索功能状态
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // 🔥 编辑模式
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const markdownContainerRef = useRef<HTMLDivElement>(null);
  
  const prevMountedRef = useRef(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const scrollableRef = useRef<HTMLDivElement>(null);

  // 获取任务数据
  const prompt = state.fileSystem?.allPrompts.get(promptId);
  const [title, setTitle] = useState(prompt?.meta.title || '');
  const [content, setContent] = useState(prompt?.content || '');
  const [scheduledTime, setScheduledTime] = useState(() => {
    if (prompt?.meta.scheduled_time) {
      const date = new Date(prompt.meta.scheduled_time);
      return date.toISOString().slice(0, 16);
    }
    return '';
  });
  // 🔥 处理 null 值：将 null 转换为 undefined
  const [recurrence, setRecurrence] = useState<RecurrenceConfig | undefined>(
    prompt?.meta.recurrence ?? undefined
  );

  // 保存初始状态用于比较是否有实际更改
  const initialStateRef = useRef({
    title: prompt?.meta.title || '',
    content: prompt?.content || '',
    scheduledTime: prompt?.meta.scheduled_time 
      ? new Date(prompt.meta.scheduled_time).toISOString().slice(0, 16) 
      : '',
    recurrence: prompt?.meta.recurrence ?? undefined, // 🔥 处理 null 值
  });

  // 🔥 计算当前应该显示的目标时间
  // 如果是重复任务，使用下一次触发时间；如果是一次性任务，使用 scheduledTime
  const currentTargetDate = useMemo(() => {
    if (recurrence?.enabled) {
      // 重复任务：计算下一次触发时间
      return getNextTriggerTime(recurrence);
    } else if (scheduledTime) {
      // 一次性任务：使用用户设置的时间
      return new Date(scheduledTime).toISOString();
    }
    return new Date().toISOString();
  }, [recurrence, scheduledTime]);

  // 倒计时 - 使用当前编辑状态的时间，而不是原始数据
  const countdown = useCountdown(
    currentTargetDate,
    prompt?.meta.created_at // 传入创建时间作为开始时间
  );

  // 动画相关
  const durationOpenMs = 400;
  const durationCloseMs = 280;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (prevMountedRef.current) return;
    prevMountedRef.current = true;

    const originCard = document.getElementById(originCardId);
    if (originCard) {
      const rect = originCard.getBoundingClientRect();
      originCard.style.opacity = '0';

      setAnimationState({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        borderRadius: '12px',
        opacity: 1,
        isOpen: false,
        backdropBlur: 0,
      });

      requestAnimationFrame(() => {
        setTimeout(() => {
          // 使用与 EditorOverlay 类似的尺寸计算
          const padding = 80;
          const maxWidth = 800; // 任务编辑器稍窄一些
          const maxHeight = window.innerHeight - padding * 2;
          
          const finalWidth = Math.min(window.innerWidth - padding * 2, maxWidth);
          const finalHeight = Math.min(600, maxHeight); // 任务编辑器高度限制
          const finalLeft = (window.innerWidth - finalWidth) / 2;
          const finalTop = (window.innerHeight - finalHeight) / 2;

          setAnimationState({
            top: finalTop,
            left: finalLeft,
            width: finalWidth,
            height: finalHeight,
            borderRadius: '16px',
            opacity: 1,
            isOpen: true,
            backdropBlur: 12,
          });
        }, 10);
      });
    }
  }, [mounted, originCardId]);

  // 放大/缩小切换
  const toggleExpanded = () => {
    if (!animationState) return;

    if (!isExpanded) {
      // 放大到接近全屏
      const topInset = 8;
      const sideInset = 8;
      const bottomInset = 8;
      setAnimationState({
        ...animationState,
        top: topInset,
        left: sideInset,
        width: `calc(100vw - ${sideInset * 2}px)`,
        height: `calc(100vh - ${topInset + bottomInset}px)`,
        borderRadius: '12px',
        transform: undefined,
      });
      setIsExpanded(true);
      return;
    }

    // 缩小回默认尺寸
    // 先关闭重复任务详情（如果打开的话）
    if (showRecurrenceDetails) {
      setShowRecurrenceDetails(false);
    }
    setExpandedByRecurrence(false);
    
    const padding = 80;
    const maxWidth = 800;
    const maxHeight = window.innerHeight - padding * 2;
    const finalWidth = Math.min(window.innerWidth - padding * 2, maxWidth);
    const finalHeight = Math.min(600, maxHeight);
    const finalLeft = (window.innerWidth - finalWidth) / 2;
    const finalTop = (window.innerHeight - finalHeight) / 2;

    setAnimationState({
      ...animationState,
      top: finalTop,
      left: finalLeft,
      width: finalWidth,
      height: finalHeight,
      borderRadius: '16px',
      transform: undefined,
    });
    setIsExpanded(false);
  };

  // 专注模式切换
  const toggleFocusMode = () => {
    const next = !isFocusMode;
    setIsFocusMode(next);
    if (!next) return;
    // 滚动到顶部
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = scrollableRef.current;
        if (!el) return;
        el.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  };

  // ESC 关闭 和 Ctrl+F 搜索
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F 打开搜索
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setIsSearchVisible(true);
        return;
      }
      
      // ESC 关闭搜索或编辑器
      if (e.key === 'Escape') {
        if (isSearchVisible) {
          setIsSearchVisible(false);
        } else {
          handleClose();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchVisible]);

  // 搜索高亮回调
  const handleSearchHighlight = useCallback((_matches: SearchMatch[], _currentIndex: number) => {
    // 预留：将来可以用于高亮显示匹配文本
  }, []);

  const handleClose = async () => {
    if (isClosing) return;

    // 使用初始状态进行比较，避免误触发保存
    if (prompt) {
      const initial = initialStateRef.current;
      const hasChanges = 
        title !== initial.title || 
        content !== initial.content ||
        scheduledTime !== initial.scheduledTime ||
        JSON.stringify(recurrence) !== JSON.stringify(initial.recurrence);

      if (hasChanges) {
        try {
          // 根据任务模式决定保存哪些字段
          const isRecurring = recurrence?.enabled;
          const updated = {
            ...prompt,
            meta: {
              ...prompt.meta,
              title,
              // 🔥 使用 null 而不是 undefined 来清除字段（后端会删除 null 字段）
              // 一次性任务保存 scheduled_time，重复任务清空
              scheduled_time: !isRecurring && scheduledTime ? new Date(scheduledTime).toISOString() : null,
              // 重复任务保存 recurrence，一次性任务清空
              recurrence: isRecurring ? recurrence : null,
            },
            content,
          };
          await savePrompt(updated);
          showToast("已保存更改", 'success');
        } catch (error) {
          showToast("保存失败", 'error');
        }
      }
    }

    setIsClosing(true);

    const originCard = document.getElementById(originCardId);
    if (originCard) {
      setTimeout(() => {
        originCard.style.opacity = '1';
      }, Math.floor(durationCloseMs * 0.7));
    }

    if (animationState) {
      const originRect = originCard ? originCard.getBoundingClientRect() : null;
      const closeState: AnimationState = originRect
        ? {
            top: originRect.top,
            left: originRect.left,
            width: originRect.width,
            height: originRect.height,
            borderRadius: '12px',
            opacity: 1,
            transform: 'none',
            isOpen: false,
            backdropBlur: 0,
          }
        : {
            ...animationState,
            opacity: 0,
            transform: 'scale(0.9)',
            isOpen: false,
            backdropBlur: 0,
          };

      setAnimationState(closeState);
    }

    setTimeout(() => {
      onClose();
    }, durationCloseMs);
  };

  const handleDelete = async () => {
    if (!prompt) return;
    
    if (window.confirm('确定要删除这个任务吗？')) {
      try {
        await deletePrompt(prompt.meta.id, false);
        showToast("已移动到回收站", 'success');
        onClose();
      } catch (error) {
        showToast("删除失败", 'error');
      }
    }
  };

  if (!mounted || !animationState || !prompt) return null;

  const formatCountdown = () => {
    if (countdown.isExpired) return 'EXPIRED';
    if (countdown.days > 0) return `${countdown.days}d ${String(countdown.hours).padStart(2, '0')}:${String(countdown.minutes).padStart(2, '0')}:${String(countdown.seconds).padStart(2, '0')}`;
    return `${String(countdown.hours).padStart(2, '0')}:${String(countdown.minutes).padStart(2, '0')}:${String(countdown.seconds).padStart(2, '0')}`;
  };

  const isUrgent = countdown.totalSeconds < 3600 && !countdown.isExpired;
  const statusColor = countdown.isExpired ? '#f43f5e' : isUrgent ? '#f43f5e' : countdown.totalSeconds < 86400 ? '#f97316' : '#22d3ee';

  return createPortal(
    <>
      {/* 背景遮罩 */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: `blur(${animationState.backdropBlur || 0}px)`,
          zIndex: 99990,
          transition: isClosing
            ? `all ${durationCloseMs}ms ease`
            : `all ${durationOpenMs}ms ease`,
        }}
        onClick={handleClose}
      />

      {/* 任务编辑器 */}
      <div
        style={{
          position: 'fixed',
          overflow: 'hidden',
          transition: isClosing
            ? `all ${durationCloseMs}ms cubic-bezier(0.4, 0, 0.2, 1)`
            : `all ${durationOpenMs}ms cubic-bezier(0.19, 1, 0.22, 1)`,
          top: animationState.top,
          left: animationState.left,
          width: animationState.width,
          height: animationState.height,
          borderRadius: animationState.borderRadius,
          opacity: animationState.opacity,
          transform: animationState.transform || 'none',
          zIndex: 100000,
          background: theme === 'dark' 
            ? 'linear-gradient(135deg, rgba(24, 24, 27, 0.98) 0%, rgba(9, 9, 11, 0.98) 100%)'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 250, 250, 0.98) 100%)',
          border: `1px solid ${statusColor}40`,
          boxShadow: `0 25px 50px -12px ${statusColor}40`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 扫描线效果 */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div className="scan-line" />
        </div>

        {/* 内容 */}
        <div
          ref={scrollableRef}
          style={{
            padding: isExpanded || isFocusMode ? '48px' : '24px',
            opacity: animationState.isOpen ? 1 : 0,
            transition: `opacity 0.3s ease ${animationState.isOpen ? '0.1s' : '0s'}`,
            height: '100%',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* 头部信息区 - 专注模式下隐藏 */}
          <div
            style={{
              marginBottom: isFocusMode ? '0px' : '20px',
              maxHeight: isFocusMode ? '0px' : '2000px',
              opacity: isFocusMode ? 0 : 1,
              overflow: 'hidden',
              transition: 'max-height 0.26s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.18s ease, margin-bottom 0.18s ease',
            }}
          >
            {/* 头部 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: `linear-gradient(135deg, ${statusColor}20 0%, ${statusColor}10 100%)`,
                    border: `1px solid ${statusColor}40`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  {/* 脉冲动画 */}
                  {(isUrgent || countdown.isExpired) && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '12px',
                      background: statusColor,
                      opacity: 0.2,
                      animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
                    }} />
                  )}
                  <Clock size={22} style={{ color: statusColor, position: 'relative', zIndex: 1 }} />
                </div>
                <div>
                  <div style={{ 
                    fontSize: '10px', 
                    color: statusColor, 
                    fontWeight: 700, 
                    letterSpacing: '1px', 
                    marginBottom: '4px',
                    fontFamily: 'monospace',
                  }}>
                    {countdown.isExpired ? 'EXPIRED' : isUrgent ? 'CRITICAL' : 'ACTIVE'}
                  </div>
                  <div style={{ 
                    fontSize: '18px', 
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    color: statusColor,
                    textShadow: `0 0 20px ${statusColor}60`,
                    letterSpacing: '2px',
                  }}>
                    {formatCountdown()}
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={toggleExpanded}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'transparent',
                    color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = theme === 'dark' ? '#fff' : '#000'}
                  onMouseLeave={(e) => e.currentTarget.style.color = theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                  title={isExpanded ? '缩小' : '放大'}
                >
                  {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <button
                  onClick={handleDelete}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'transparent',
                    color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#f43f5e'}
                  onMouseLeave={(e) => e.currentTarget.style.color = theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                >
                  <Trash2 size={18} />
                </button>
                <button
                  onClick={handleClose}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'transparent',
                    color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = theme === 'dark' ? '#fff' : '#000'}
                  onMouseLeave={(e) => e.currentTarget.style.color = theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* 标题 */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="任务标题..."
              style={{
                width: '100%',
                fontSize: '22px',
                fontWeight: 600,
                border: 'none',
                background: 'transparent',
                color: theme === 'dark' ? '#fff' : '#000',
                outline: 'none',
                marginBottom: '20px',
              }}
            />

            {/* 任务模式切换 */}
            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              marginBottom: '16px',
            }}>
              <button
                type="button"
                onClick={() => {
                  // 切换到一次性任务，清空重复配置
                  setRecurrence(undefined);
                  setShowRecurrenceDetails(false);
                  // 如果是因重复任务放大的，缩小回去
                  if (expandedByRecurrence && isExpanded) {
                    toggleExpanded();
                    setExpandedByRecurrence(false);
                  }
                }}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: `1px solid ${!recurrence?.enabled ? statusColor : (theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')}`,
                  background: !recurrence?.enabled ? `${statusColor}20` : 'transparent',
                  color: !recurrence?.enabled ? statusColor : (theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'),
                  fontSize: '13px',
                  fontWeight: !recurrence?.enabled ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <Clock size={14} />
                一次性任务
              </button>
              <button
                type="button"
                onClick={() => {
                  if (recurrence?.enabled) {
                    // 已经是重复任务，切换展开/收起详情
                    const willShow = !showRecurrenceDetails;
                    setShowRecurrenceDetails(willShow);
                    
                    if (willShow) {
                      // 展开：如果是每周/每月，自动放大窗口
                      if ((recurrence.type === 'weekly' || recurrence.type === 'monthly') && !isExpanded) {
                        toggleExpanded();
                        setExpandedByRecurrence(true);
                      }
                    } else {
                      // 收起：如果是因重复任务放大的，缩小回去
                      if (expandedByRecurrence && isExpanded) {
                        toggleExpanded();
                        setExpandedByRecurrence(false);
                      }
                    }
                  } else {
                    // 切换到重复任务
                    setScheduledTime('');
                    const initialRecurrence = initialStateRef.current.recurrence;
                    if (initialRecurrence?.enabled) {
                      setRecurrence(initialRecurrence);
                    } else {
                      setRecurrence({ type: 'daily', time: '09:00', enabled: true });
                    }
                    // 默认不展开详情
                    setShowRecurrenceDetails(false);
                  }
                }}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: `1px solid ${recurrence?.enabled ? statusColor : (theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')}`,
                  background: recurrence?.enabled ? `${statusColor}20` : 'transparent',
                  color: recurrence?.enabled ? statusColor : (theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'),
                  fontSize: '13px',
                  fontWeight: recurrence?.enabled ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <Repeat size={14} />
                重复任务
                {recurrence?.enabled && (
                  <span style={{ fontSize: '10px', opacity: 0.7 }}>
                    {showRecurrenceDetails ? '▲' : '▼'}
                  </span>
                )}
              </button>
            </div>

            {/* 一次性任务：时间选择 */}
            {!recurrence?.enabled && (
            <div 
              onClick={() => dateInputRef.current?.showPicker?.()}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                marginBottom: '20px',
                padding: '14px 16px',
                borderRadius: '12px',
                background: theme === 'dark' ? `${statusColor}10` : `${statusColor}08`,
                border: `1px solid ${statusColor}30`,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = theme === 'dark' ? `${statusColor}20` : `${statusColor}15`;
                e.currentTarget.style.borderColor = `${statusColor}50`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = theme === 'dark' ? `${statusColor}10` : `${statusColor}08`;
                e.currentTarget.style.borderColor = `${statusColor}30`;
              }}
            >
              <Calendar size={18} style={{ color: statusColor, flexShrink: 0 }} />
              <span style={{ 
                fontSize: '13px', 
                color: theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
                flexShrink: 0,
              }}>
                截止时间
              </span>
              <input
                ref={dateInputRef}
                type="datetime-local"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                tabIndex={-1}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${statusColor}30`,
                  background: theme === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.9)',
                  color: theme === 'dark' ? '#fff' : '#000',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  outline: 'none',
                  cursor: 'pointer',
                  pointerEvents: 'none',
                }}
              />
            </div>
            )}
          </div>

          {/* 重复任务配置 - 仅在展开时显示 */}
          {recurrence?.enabled && showRecurrenceDetails && (
          <div style={{ marginBottom: '20px' }}>
            <RecurrenceSelector
              value={recurrence}
              onChange={(config) => {
                setRecurrence(config);
                if (config?.enabled) {
                  setScheduledTime(''); // 清空一次性时间
                  // 如果切换到每周/每月，自动放大窗口
                  if ((config.type === 'weekly' || config.type === 'monthly') && !isExpanded) {
                    toggleExpanded();
                    setExpandedByRecurrence(true);
                  }
                }
              }}
              hideToggle={true}
            />
          </div>
          )}
          
          {/* 重复任务摘要 - 收起时显示 */}
          {recurrence?.enabled && !showRecurrenceDetails && (
          <div 
            onClick={() => {
              setShowRecurrenceDetails(true);
              // 如果是每周/每月，自动放大
              if ((recurrence.type === 'weekly' || recurrence.type === 'monthly') && !isExpanded) {
                toggleExpanded();
                setExpandedByRecurrence(true);
              }
            }}
            style={{ 
              marginBottom: '20px',
              padding: '12px 16px',
              borderRadius: '10px',
              background: theme === 'dark' ? 'rgba(244,63,94,0.1)' : 'rgba(244,63,94,0.08)',
              border: '1px solid rgba(244,63,94,0.3)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme === 'dark' ? 'rgba(244,63,94,0.15)' : 'rgba(244,63,94,0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = theme === 'dark' ? 'rgba(244,63,94,0.1)' : 'rgba(244,63,94,0.08)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Repeat size={14} style={{ color: '#f43f5e' }} />
                <span style={{ fontSize: '13px', color: '#f43f5e', fontWeight: 500 }}>
                  {recurrence.type === 'daily' ? '每天' : recurrence.type === 'weekly' ? '每周' : '每月'} · {recurrence.time}
                </span>
              </div>
              <span style={{ fontSize: '11px', color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                点击编辑 ▼
              </span>
            </div>
          </div>
          )}

          {/* 进度条 - 仅一次性任务显示 */}
          {!recurrence?.enabled && !countdown.isExpired && prompt.meta.created_at && (
            <div style={{ 
              marginBottom: isFocusMode ? '16px' : '20px',
              transition: 'margin-bottom 0.18s ease',
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: '6px',
                fontSize: '11px',
                color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                fontFamily: 'monospace',
              }}>
                <span>进度</span>
                <span>{Math.round(countdown.progress)}%</span>
              </div>
              <div style={{ 
                height: '6px', 
                borderRadius: '3px', 
                background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                overflow: 'hidden',
              }}>
                <div
                  style={{
                    height: '100%',
                    width: `${countdown.progress}%`,
                    background: `linear-gradient(90deg, ${statusColor}, ${statusColor}cc)`,
                    borderRadius: '3px',
                    transition: 'width 1s linear',
                    boxShadow: `0 0 10px ${statusColor}60`,
                  }}
                />
              </div>
            </div>
          )}

          {/* 内容区域 - 专注模式下铺满 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* 🔥 搜索栏 */}
            <ContentSearchBar
              content={content}
              isVisible={isSearchVisible}
              onClose={() => {
                setIsSearchVisible(false);
              }}
              onHighlight={handleSearchHighlight}
              theme={theme}
              textareaRef={contentTextareaRef}
            />
            
            {/* 🔥 OpenAI 风格：点击进入编辑，失焦显示渲染 */}
            {isEditing ? (
              <textarea
                ref={contentTextareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onBlur={() => setIsEditing(false)}
                onKeyDown={(e) => {
                  // Tab 键插入空格
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    const textarea = e.currentTarget;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const newContent = content.substring(0, start) + '  ' + content.substring(end);
                    setContent(newContent);
                    requestAnimationFrame(() => {
                      textarea.selectionStart = textarea.selectionEnd = start + 2;
                    });
                  }
                  // ESC 退出编辑
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setIsEditing(false);
                  }
                }}
                placeholder="任务描述... (支持 Markdown)"
                autoFocus
                style={{
                  width: '100%',
                  flex: 1,
                  minHeight: isFocusMode ? '0' : (isExpanded ? '300px' : '100px'),
                  fontSize: '14px',
                  border: 'none',
                  background: 'transparent',
                  color: theme === 'dark' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)',
                  outline: 'none',
                  resize: 'none',
                  lineHeight: 1.7,
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                }}
              />
            ) : (
              <div
                ref={markdownContainerRef}
                onClick={() => setIsEditing(true)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  toggleFocusMode();
                }}
                style={{
                  flex: 1,
                  minHeight: isFocusMode ? '0' : (isExpanded ? '300px' : '100px'),
                  overflowY: 'auto',
                  cursor: 'text',
                }}
              >
                {content.trim() ? (
                  <MarkdownRenderer content={content} theme={theme} />
                ) : (
                  <div 
                    style={{ 
                      color: theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                      fontSize: '14px',
                      lineHeight: 1.7,
                    }}
                  >
                    点击此处添加任务描述... (支持 Markdown)
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
