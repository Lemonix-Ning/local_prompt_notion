/**
 * EditorOverlay 组件
 * 实现 Mac 风格共享元素过渡动画 + 沉浸式编辑器UI
 */

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useApp } from '../AppContext';
import { 
  X, 
  Star, 
  Calendar, 
  Hash, 
  Copy,
  Trash2
} from 'lucide-react';
import { getSmartIcon, getSmartGradient } from '../utils/smartIcon';
import { getTagStyle } from '../utils/tagColors';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';

interface EditorOverlayProps {
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
  backdropBlur?: number; // 添加背景模糊控制
}

export function EditorOverlay({ promptId, originCardId, onClose }: EditorOverlayProps) {
  const { theme } = useTheme();
  const { state, savePrompt, deletePrompt } = useApp();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [animationState, setAnimationState] = useState<AnimationState | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const scrollableRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 获取提示词数据
  const prompt = state.fileSystem?.allPrompts.get(promptId);
  const [title, setTitle] = useState(prompt?.meta.title || '');
  const [content, setContent] = useState(prompt?.content || '');
  const [tags, setTags] = useState(prompt?.meta.tags || []);
  const [newTag, setNewTag] = useState('');

  // 当 prompt 数据加载后，更新本地状态
  useEffect(() => {
    if (prompt) {
      setTitle(prompt.meta.title || '');
      setContent(prompt.content || '');
      setTags(prompt.meta.tags || []);
    }
  }, [prompt]);

  // 打开动画
  useLayoutEffect(() => {
    if (!promptId) return;

    // 尝试获取原卡片 DOM
    const originCard = document.getElementById(originCardId);
    
    if (originCard) {
      // ✅ 场景 A：找到了卡片 -> 执行 Mac 展开动画
      const originRect = originCard.getBoundingClientRect();

      // 隐藏原始卡片
      originCard.style.opacity = '0';

      // 1. 初始状态：覆盖在原卡片上
      const startState: AnimationState = {
        top: originRect.top,
        left: originRect.left,
        width: originRect.width,
        height: originRect.height,
        borderRadius: '12px',
        opacity: 1,
        isOpen: false,
        backdropBlur: 0, // 初始无模糊
      };

      setAnimationState(startState);

      // 2. 下一帧：弹射到屏幕中央
      requestAnimationFrame(() => {
        setTimeout(() => {
          const targetState: AnimationState = {
            top: '5%',
            left: '50%',
            width: 'min(90%, 900px)',
            height: '90%',
            borderRadius: '16px',
            opacity: 1,
            transform: 'translateX(-50%)',
            isOpen: true,
            backdropBlur: 12, // 目标模糊度
          };

          setAnimationState(targetState);
        }, 10);
      });

    } else {
      // 🛡️ 场景 B：没找到卡片 -> 执行安全降级
      console.warn(`Could not find origin card with ID: ${originCardId}, using fallback`);
      
      const fallbackState: AnimationState = {
        top: '5%',
        left: '50%',
        width: 'min(90%, 900px)',
        height: '90%',
        transform: 'translateX(-50%)',
        borderRadius: '16px',
        opacity: 1,
        isOpen: true,
        backdropBlur: 12, // 直接显示模糊背景
      };

      setAnimationState(fallbackState);
    }
  }, [promptId, originCardId]);

  // 关闭动画
  const handleClose = async () => {
    if (isClosing) return;
    
    // 保存更改
    if (prompt && (title !== prompt.meta.title || content !== prompt.content || JSON.stringify(tags) !== JSON.stringify(prompt.meta.tags))) {
      try {
        const updated = {
          ...prompt,
          meta: { ...prompt.meta, title, tags },
          content,
        };
        await savePrompt(updated);
        showToast("已保存更改", 'success');
      } catch (error) {
        showToast("保存失败", 'error');
      }
    }

    setIsClosing(true);

    // 获取原始卡片位置作为缩放中心点
    const originCard = document.getElementById(originCardId);
    let centerX = '50%';
    let centerY = '50%';
    
    if (originCard) {
      const originRect = originCard.getBoundingClientRect();
      // 计算卡片中心点相对于当前编辑器的位置
      const currentRect = document.querySelector('.editor-overlay-card')?.getBoundingClientRect();
      if (currentRect) {
        const cardCenterX = originRect.left + originRect.width / 2;
        const cardCenterY = originRect.top + originRect.height / 2;
        centerX = `${((cardCenterX - currentRect.left) / currentRect.width) * 100}%`;
        centerY = `${((cardCenterY - currentRect.top) / currentRect.height) * 100}%`;
      }
    }

    // 设置缩放中心点
    const cardElement = document.querySelector('.editor-overlay-card') as HTMLElement;
    if (cardElement) {
      cardElement.style.transformOrigin = `${centerX} ${centerY}`;
    }

    // 执行单阶段平滑缩小动画
    if (animationState) {
      const closeState: AnimationState = {
        ...animationState,
        opacity: 0,
        transform: `${animationState.transform || ''} scale(0)`,
        isOpen: false,
        backdropBlur: 0,
      };

      setAnimationState(closeState);

      // 在动画进行到70%时显示原卡片
      if (originCard) {
        setTimeout(() => {
          originCard.style.opacity = '1';
        }, 200); // 280ms * 0.7 ≈ 200ms
      }
    }

    // 动画完成后清理
    setTimeout(() => {
      onClose();
    }, 280);
  };

  // 处理滚动条显示/隐藏
  useEffect(() => {
    const scrollableElement = scrollableRef.current;
    if (!scrollableElement) return;

    const handleScroll = () => {
      // 添加滚动中的类
      scrollableElement.classList.add('scrolling');
      
      // 清除之前的定时器
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // 设置新的定时器，滚动停止后隐藏滚动条
      scrollTimeoutRef.current = setTimeout(() => {
        scrollableElement.classList.remove('scrolling');
      }, 800); // 0.8秒后隐藏，更快的响应
    };

    scrollableElement.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      scrollableElement.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // 处理 ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 处理收藏
  const handleToggleFavorite = async () => {
    if (!prompt) return;
    
    const updated = {
      ...prompt,
      meta: { ...prompt.meta, is_favorite: !prompt.meta.is_favorite }
    };
    
    try {
      await savePrompt(updated);
      showToast(updated.meta.is_favorite ? "已添加到收藏" : "已取消收藏", 'success');
    } catch (error) {
      showToast("操作失败", 'error');
    }
  };

  // 处理删除
  const handleDelete = async () => {
    const confirmed = await confirm({
      title: '删除提示词',
      message: '确定要删除这个提示词吗？',
      confirmText: '删除',
      cancelText: '取消',
      type: 'warning'
    });
    
    if (confirmed) {
      try {
        await deletePrompt(promptId, false);
        showToast("已移动到回收站", 'success');
        onClose();
      } catch (error) {
        showToast("删除失败", 'error');
      }
    }
  };

  // 处理复制
  const handleCopy = () => {
    navigator.clipboard.writeText(content)
      .then(() => showToast("已复制到剪贴板", 'success'))
      .catch(() => showToast("复制失败", 'error'));
  };

  // 添加标签
  const handleAddTag = () => {
    const trimmedTag = newTag.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
    }
    setNewTag('');
  };

  // 删除标签
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  if (!animationState) return null;

  // 如果没有 prompt 数据，显示加载状态
  if (!prompt) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)',
        backdropFilter: `blur(${animationState?.backdropBlur || 12}px)`,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'backdrop-filter 0.3s ease, background-color 0.3s ease',
      }}>
        <div style={{
          backgroundColor: theme === 'dark' ? '#000000' : '#ffffff',
          border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          borderRadius: '16px',
          padding: '40px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          textAlign: 'center'
        }}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p style={{ color: theme === 'dark' ? '#ffffff' : '#000000' }}>加载中...</p>
        </div>
      </div>
    );
  }

  const Icon = getSmartIcon(prompt.meta.title, prompt.meta.tags);
  const [gradientFrom, gradientTo] = getSmartGradient(prompt.meta.title, prompt.meta.tags);

  return (
    <>
      {/* CSS 动画样式 */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        /* 自定义滚动条样式 */
        .editor-scrollable {
          scrollbar-width: thin;
          scrollbar-color: transparent transparent;
          transition: scrollbar-color 0.3s ease;
        }

        .editor-scrollable::-webkit-scrollbar {
          width: 4px;
        }

        .editor-scrollable::-webkit-scrollbar-track {
          background: transparent;
        }

        .editor-scrollable::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 2px;
          transition: background 0.3s ease, opacity 0.3s ease;
          opacity: 0;
        }

        /* 滚动时显示滚动条 - 添加渐变过渡 */
        .editor-scrollable.scrolling::-webkit-scrollbar-thumb {
          background: ${theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'};
          opacity: 1;
        }

        .editor-scrollable.scrolling::-webkit-scrollbar-thumb:hover {
          background: ${theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'};
        }

        /* Firefox 滚动条 */
        .editor-scrollable.scrolling {
          scrollbar-color: ${theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'} transparent;
        }
      `}</style>

      {/* 背景遮罩 */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)',
          backdropFilter: `blur(${animationState.backdropBlur || 0}px)`,
          zIndex: 99999,
          transition: isClosing 
            ? 'backdrop-filter 0.28s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.28s ease'
            : 'backdrop-filter 0.4s ease, background-color 0.4s ease',
        }}
        onClick={handleClose}
      />
      
      {/* 动画卡片 */}
      <div
        className="editor-overlay-card"
        style={{
          position: 'absolute',
          backgroundColor: theme === 'dark' ? '#000000' : '#ffffff',
          border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          transformOrigin: 'center center', // 默认从中心缩放
          // 使用统一的平滑动画曲线
          transition: isClosing 
            ? 'all 0.28s cubic-bezier(0.4, 0, 0.2, 1)'
            : 'top 0.4s cubic-bezier(0.19, 1, 0.22, 1), left 0.4s cubic-bezier(0.19, 1, 0.22, 1), width 0.4s cubic-bezier(0.19, 1, 0.22, 1), height 0.4s cubic-bezier(0.19, 1, 0.22, 1), transform 0.4s cubic-bezier(0.19, 1, 0.22, 1), opacity 0.3s ease',
          top: animationState.top,
          left: animationState.left,
          width: animationState.width,
          height: animationState.height,
          borderRadius: animationState.borderRadius,
          opacity: animationState.opacity,
          transform: animationState.transform || 'none',
          zIndex: 100000,
        }}
      >
        {/* 编辑器内容 */}
        <div 
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            opacity: animationState.isOpen ? 1 : 0,
            transition: `opacity 0.3s ease ${animationState.isOpen ? '0.1s' : '0s'}`,
            color: theme === 'dark' ? '#ffffff' : '#000000'
          }}
        >
          {/* 悬浮操作栏 */}
          <div style={{
            position: 'absolute',
            top: '24px',
            right: '24px',
            zIndex: 20,
            display: 'flex',
            gap: '8px'
          }}>
            <button 
              onClick={handleToggleFavorite}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: prompt.meta.is_favorite ? 'rgba(251, 191, 36, 0.1)' : 'rgba(0,0,0,0.05)',
                color: prompt.meta.is_favorite ? '#fbbf24' : theme === 'dark' ? '#ffffff' : '#000000',
                cursor: 'pointer'
              }}
            >
              <Star size={18} fill={prompt.meta.is_favorite ? "currentColor" : "none"} />
            </button>
            <button 
              onClick={handleCopy}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'rgba(0,0,0,0.05)',
                color: theme === 'dark' ? '#ffffff' : '#000000',
                cursor: 'pointer'
              }}
            >
              <Copy size={18} />
            </button>
            <button 
              onClick={handleDelete}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                cursor: 'pointer'
              }}
            >
              <Trash2 size={18} />
            </button>
            <button 
              onClick={handleClose}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'rgba(0,0,0,0.05)',
                color: theme === 'dark' ? '#ffffff' : '#000000',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* 滚动内容区 */}
          <div 
            ref={scrollableRef}
            className="editor-scrollable"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '48px 48px 48px 48px'
            }}
          >
            {/* 头部信息区 */}
            <div style={{ marginBottom: '32px' }}>
              {/* 大图标 */}
              <div 
                className={`bg-gradient-to-br ${gradientFrom} ${gradientTo}`}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '32px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                }}
              >
                <Icon size={36} className="text-black/90" />
              </div>

              {/* 无边框大标题 */}
              <input 
                style={{
                  fontSize: '2.25rem',
                  fontWeight: 700,
                  lineHeight: 1.2,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  width: '100%',
                  color: theme === 'dark' ? '#ffffff' : '#000000',
                  marginBottom: '32px'
                }}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="无标题"
              />

              {/* 属性列表 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                {/* 创建时间 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ 
                    color: theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                    width: '100px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Calendar size={14} />
                    <span>Created</span>
                  </div>
                  <div>
                    {new Date(prompt.meta.created_at).toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                </div>

                {/* 更新时间 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ 
                    color: theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                    width: '100px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Calendar size={14} />
                    <span>Updated</span>
                  </div>
                  <div>
                    {new Date(prompt.meta.updated_at).toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                </div>

                {/* 标签栏 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{ 
                    color: theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                    width: '100px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    paddingTop: '4px'
                  }}>
                    <Hash size={14} />
                    <span>Tags</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                      {/* 现有标签 */}
                      {tags.map(tag => (
                        <span 
                          key={tag} 
                          className={`${getTagStyle(tag)}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            userSelect: 'none'
                          }}
                          onClick={() => handleRemoveTag(tag)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(0.95)';
                            e.currentTarget.style.opacity = '0.8';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.opacity = '1';
                          }}
                        >
                          {tag}
                          <X size={10} style={{ opacity: 0.7 }} />
                        </span>
                      ))}
                      
                      {/* 添加标签区域 */}
                      {newTag ? (
                        /* 输入状态 */
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                          border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
                          borderRadius: '6px',
                          padding: '6px 8px',
                          gap: '6px',
                          animation: 'slideIn 0.2s ease-out',
                          minWidth: '80px',
                          maxWidth: '200px'
                        }}>
                          <input
                            type="text"
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleAddTag();
                              } else if (e.key === 'Escape') {
                                setNewTag('');
                              }
                            }}
                            onBlur={() => {
                              if (newTag.trim()) {
                                handleAddTag();
                              } else {
                                setNewTag('');
                              }
                            }}
                            placeholder="标签名"
                            autoFocus
                            style={{
                              background: 'transparent',
                              border: 'none',
                              outline: 'none',
                              fontSize: '12px',
                              color: theme === 'dark' ? '#ffffff' : '#000000',
                              width: `${Math.max(60, Math.min(180, newTag.length * 8 + 20))}px`,
                              transition: 'width 0.2s ease'
                            }}
                          />
                          <button
                            onClick={handleAddTag}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '2px',
                              borderRadius: '3px',
                              color: '#22c55e',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => setNewTag('')}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '2px',
                              borderRadius: '3px',
                              color: '#ef4444',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        /* 添加按钮状态 */
                        <button
                          onClick={() => setNewTag(' ')} // 设置一个空格来触发输入状态
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            border: `1px dashed ${theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}`,
                            backgroundColor: 'transparent',
                            color: theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            transition: 'all 0.2s ease',
                            userSelect: 'none'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
                            e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
                            e.currentTarget.style.color = theme === 'dark' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)';
                            e.currentTarget.style.transform = 'scale(1.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          +
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 分割线 */}
            <div style={{
              height: '1px',
              width: '100%',
              backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              marginBottom: '32px'
            }} />

            {/* 正文编辑区 */}
            <div style={{ maxWidth: '1200px' }}>
              <textarea 
                style={{
                  fontSize: '1.125rem',
                  lineHeight: 1.7,
                  resize: 'none',
                  minHeight: '500px',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  width: '100%',
                  color: theme === 'dark' ? '#ffffff' : '#000000'
                }}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="开始写作..."
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}